//! End-to-end service tests against a local fake of the Discogs HTTP API.

use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, Once};

use super::*;

const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3];
const JPEG_DATA_URL_PREFIX: &str = "data:image/jpeg;base64,";

static NEXT_ROOT: AtomicU32 = AtomicU32::new(0);
static CLEAN_PARENT: Once = Once::new();

#[derive(Clone)]
struct FakeResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

fn json(body: &str) -> FakeResponse {
    FakeResponse {
        status: 200,
        headers: Vec::new(),
        body: body.as_bytes().to_vec(),
    }
}

fn image_response() -> FakeResponse {
    FakeResponse {
        status: 200,
        headers: Vec::new(),
        body: JPEG.to_vec(),
    }
}

fn status(status: u16) -> FakeResponse {
    FakeResponse {
        status,
        headers: Vec::new(),
        body: Vec::new(),
    }
}

/// Minimal HTTP/1.1 server. Routes match on a path prefix, query string included.
struct FakeDiscogs {
    base_url: String,
    routes: Arc<Mutex<HashMap<String, FakeResponse>>>,
    requests: Arc<Mutex<Vec<String>>>,
}

impl FakeDiscogs {
    fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind fake server");
        let base_url = format!("http://{}", listener.local_addr().unwrap());
        let routes: Arc<Mutex<HashMap<String, FakeResponse>>> = Arc::default();
        let requests: Arc<Mutex<Vec<String>>> = Arc::default();

        let (thread_routes, thread_requests) = (routes.clone(), requests.clone());
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let routes = thread_routes.clone();
                let requests = thread_requests.clone();
                std::thread::spawn(move || handle(stream, routes, requests));
            }
        });

        Self {
            base_url,
            routes,
            requests,
        }
    }

    fn route(&self, prefix: &str, response: FakeResponse) {
        self.routes
            .lock()
            .unwrap()
            .insert(prefix.to_string(), response);
    }

    fn requests(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }

    fn api_request_count(&self) -> usize {
        self.requests()
            .iter()
            .filter(|request| !request.starts_with("GET /img/"))
            .count()
    }

    fn client(&self) -> DiscogsClient {
        DiscogsClient::for_test(Some(&Credentials::Token("sekret".into())), &self.base_url)
    }
}

fn handle(
    mut stream: TcpStream,
    routes: Arc<Mutex<HashMap<String, FakeResponse>>>,
    requests: Arc<Mutex<Vec<String>>>,
) {
    let mut head = Vec::new();
    let mut buffer = [0_u8; 1024];
    while !head.windows(4).any(|window| window == b"\r\n\r\n") {
        match stream.read(&mut buffer) {
            Ok(0) | Err(_) => return,
            Ok(read) => head.extend_from_slice(&buffer[..read]),
        }
    }
    let head = String::from_utf8_lossy(&head).to_string();
    let target = head.split_whitespace().nth(1).unwrap_or("").to_string();
    requests.lock().unwrap().push(head);

    let response = {
        let routes = routes.lock().unwrap();
        routes
            .iter()
            .filter(|(prefix, _)| target.starts_with(prefix.as_str()))
            .max_by_key(|(prefix, _)| prefix.len())
            .map(|(_, response)| response.clone())
            .unwrap_or_else(|| status(404))
    };

    let mut out = format!(
        "HTTP/1.1 {} X\r\nContent-Length: {}\r\nConnection: close\r\n",
        response.status,
        response.body.len()
    );
    for (name, value) in &response.headers {
        out.push_str(&format!("{name}: {value}\r\n"));
    }
    out.push_str("\r\n");
    let _ = stream.write_all(out.as_bytes());
    let _ = stream.write_all(&response.body);
}

/// Every run shares one parent, emptied on first use, so runs do not pile up.
fn temp_root() -> PathBuf {
    let parent = std::env::temp_dir().join("vinyldeck-discogs-tests");
    CLEAN_PARENT.call_once(|| {
        let _ = fs::remove_dir_all(&parent);
    });
    parent.join(NEXT_ROOT.fetch_add(1, Ordering::Relaxed).to_string())
}

fn image_json(server: &FakeDiscogs, name: &str, kind: &str) -> String {
    format!(
        r#"{{"type":"{kind}","uri":"{base}/img/{name}.jpeg","uri150":"{base}/img/{name}-150.jpeg","width":600,"height":600}}"#,
        base = server.base_url
    )
}

/// Random Access Memories: one master, two master images, one alternate vinyl cover.
fn server_with_album() -> FakeDiscogs {
    let server = FakeDiscogs::start();
    server.route(
        "/database/search?type=master",
        json(
            r#"{"results":[
                {"id":9,"title":"Daft Punk - Memories","format":["Vinyl"]},
                {"id":7,"title":"Daft Punk - Random Access Memories","format":["Vinyl","LP"]}
            ]}"#,
        ),
    );
    let master = format!(
        r#"{{"main_release":70,"images":[{},{}]}}"#,
        image_json(&server, "back", "secondary"),
        image_json(&server, "cover", "primary"),
    );
    server.route("/masters/7", json(&master));
    let versions = format!(
        r#"{{"versions":[
            {{"id":70,"major_formats":["Vinyl"],"released":"2013","thumb":"{base}/img/main-150.jpeg"}},
            {{"id":71,"country":"Europe","major_formats":["Vinyl"],"released":"2013-05-17",
              "thumb":"{base}/img/v71-150.jpeg","stats":{{"community":{{"in_collection":50}}}}}}
        ]}}"#,
        base = server.base_url
    );
    server.route("/masters/7/versions", json(&versions));
    let release = format!(
        r#"{{"images":[{},{}]}}"#,
        image_json(&server, "label", "secondary"),
        image_json(&server, "v71full", "primary"),
    );
    server.route("/releases/71", json(&release));
    server.route("/img/", image_response());
    server
}

const ARTIST: &str = "Daft Punk";
const ALBUM: &str = "Random Access Memories";

#[tokio::test]
async fn resolves_album_with_primary_image_as_default() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Found);
    assert_eq!(art.key, "daft punk|random access memories");
    let sources: Vec<(&str, &str)> = art
        .images
        .iter()
        .map(|image| (image.kind.as_str(), image.source.as_str()))
        .collect();
    assert_eq!(
        sources,
        vec![
            ("primary", "Main release"),
            ("primary", "Vinyl · Europe · 2013"),
            ("secondary", "Main release"),
        ],
        "covers lead, and the main release is not listed twice"
    );
    assert_eq!(art.selected_image_id.as_ref(), Some(&art.images[0].id));
    assert!(art
        .artwork_data_url
        .as_deref()
        .unwrap()
        .starts_with(JPEG_DATA_URL_PREFIX));
    assert!(
        !server.requests().iter().any(|r| r.contains("/masters/999")),
        "similar titled master must not be used"
    );
}

#[tokio::test]
async fn api_requests_identify_app_and_carry_token_only_in_header() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());
    service.resolve(ARTIST, ALBUM).await;

    let requests = server.requests();
    let search = requests
        .iter()
        .find(|request| request.contains("/database/search"))
        .unwrap();
    let lowered = search.to_lowercase();
    assert!(lowered.contains("authorization: discogs token=sekret"));
    assert!(lowered.contains("user-agent: vinyldeck/"));
    assert!(search.contains("artist=daft+punk") || search.contains("artist=daft%20punk"));
    assert!(search.contains("release_title=Random"));

    for request in &requests {
        let request_line = request.lines().next().unwrap();
        assert!(!request_line.contains("sekret"), "{request_line}");
    }
    let image_request = requests
        .iter()
        .find(|request| request.starts_with("GET /img/"))
        .unwrap();
    assert!(
        !image_request.to_lowercase().contains("authorization"),
        "CDN requests must not receive the credential"
    );
}

#[tokio::test]
async fn other_tracks_of_the_album_reuse_the_cache() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let first = service.resolve(ARTIST, ALBUM).await;
    let calls_after_first = server.api_request_count();
    let second = service
        .resolve("Daft Punk, Pharrell Williams", "RANDOM ACCESS MEMORIES")
        .await;

    assert_eq!(second, first);
    assert_eq!(server.api_request_count(), calls_after_first);
}

#[tokio::test]
async fn concurrent_windows_trigger_a_single_lookup() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let (main, mini) = tokio::join!(
        service.resolve(ARTIST, ALBUM),
        service.resolve(ARTIST, ALBUM)
    );

    assert_eq!(main, mini);
    let searches = server
        .requests()
        .iter()
        .filter(|request| request.contains("/database/search"))
        .count();
    assert_eq!(searches, 1);
}

#[tokio::test]
async fn selection_persists_across_restart_and_offline() {
    let server = server_with_album();
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;
    let chosen = art.images[2].id.clone();

    let selected = service.select(&art.key, &chosen).await.unwrap();
    assert_eq!(selected.selected_image_id.as_ref(), Some(&chosen));
    drop(service);

    // Restarted with Discogs unreachable (nothing listens on port 9).
    let offline = DiscogsClient::for_test(
        Some(&Credentials::Token("sekret".into())),
        "http://127.0.0.1:9",
    );
    let restarted = DiscogsService::new(Some(offline), root);
    let restored = restarted.resolve(ARTIST, ALBUM).await;

    assert_eq!(restored.status, AlbumArtStatus::Found);
    assert_eq!(restored.selected_image_id.as_ref(), Some(&chosen));
    assert!(restored.artwork_data_url.is_some());
}

#[tokio::test]
async fn expired_entry_is_served_when_refresh_fails() {
    let server = server_with_album();
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;

    let mut stored = service.cache.load(&art.key).unwrap();
    stored.fetched_at = 0;
    service.cache.save(&stored).unwrap();

    let offline = DiscogsClient::for_test(None, "http://127.0.0.1:9");
    let restarted = DiscogsService::new(Some(offline), root);
    let restored = restarted.resolve(ARTIST, ALBUM).await;

    assert_eq!(restored.status, AlbumArtStatus::Found);
    assert_eq!(restored.artwork_data_url, art.artwork_data_url);
}

#[tokio::test]
async fn offline_without_cache_reports_unavailable_with_retry() {
    let offline = DiscogsClient::for_test(None, "http://127.0.0.1:9");
    let service = DiscogsService::new(Some(offline), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Unavailable);
    assert_eq!(art.artwork_data_url, None);
    assert_eq!(art.retry_after_seconds, Some(NETWORK_RETRY_SECONDS));
}

#[tokio::test]
async fn similar_album_only_results_in_cached_not_found() {
    let server = FakeDiscogs::start();
    server.route(
        "/database/search",
        json(r#"{"results":[{"id":1,"title":"Daft Punk - Memories"},{"id":2,"title":"Other - Random Access Memories"}]}"#),
    );
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;
    assert_eq!(art.status, AlbumArtStatus::NotFound);
    assert!(art.images.is_empty());
    assert_eq!(art.artwork_data_url, None);
    assert!(!server
        .requests()
        .iter()
        .any(|request| request.contains("/masters/") || request.contains("/releases/")));

    let calls = server.api_request_count();
    service.resolve(ARTIST, ALBUM).await;
    assert_eq!(
        server.api_request_count(),
        calls,
        "negative result is cached"
    );
}

#[tokio::test]
async fn falls_back_to_releases_when_no_master_exists() {
    let server = FakeDiscogs::start();
    server.route("/database/search?type=master", json(r#"{"results":[]}"#));
    server.route(
        "/database/search?type=release",
        json(r#"{"results":[{"id":5,"title":"Daft Punk - Random Access Memories","format":["CD"],"label":["Columbia"],"year":"2013"}]}"#),
    );
    let release = format!(r#"{{"images":[{}]}}"#, image_json(&server, "cd", "primary"));
    server.route("/releases/5", json(&release));
    server.route("/img/", image_response());
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Found);
    assert_eq!(art.images[0].source, "CD · Columbia · 2013");
}

#[tokio::test]
async fn matched_album_without_images_is_not_found() {
    let server = FakeDiscogs::start();
    server.route(
        "/database/search?type=master",
        json(r#"{"results":[{"id":7,"title":"Daft Punk - Random Access Memories"}]}"#),
    );
    server.route("/masters/7", json(r#"{"main_release":70,"images":[]}"#));
    server.route("/masters/7/versions", json(r#"{"versions":[]}"#));
    server.route("/database/search?type=release", json(r#"{"results":[]}"#));
    let service = DiscogsService::new(Some(server.client()), temp_root());

    assert_eq!(
        service.resolve(ARTIST, ALBUM).await.status,
        AlbumArtStatus::NotFound
    );
}

#[tokio::test]
async fn rate_limit_response_is_honored_without_further_requests() {
    let server = FakeDiscogs::start();
    server.route(
        "/database/search",
        FakeResponse {
            status: 429,
            headers: vec![("Retry-After".to_string(), "42".to_string())],
            body: Vec::new(),
        },
    );
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;
    assert_eq!(art.status, AlbumArtStatus::Unavailable);
    assert_eq!(art.retry_after_seconds, Some(42));
    assert_eq!(server.api_request_count(), 1);

    let again = service.resolve("Other", "Album").await;
    assert_eq!(again.status, AlbumArtStatus::Unavailable);
    assert_eq!(server.api_request_count(), 1, "cooldown blocks the network");
    assert!(again
        .retry_after_seconds
        .is_some_and(|seconds| seconds <= 42));
}

#[tokio::test]
async fn spent_rate_limit_window_stops_requests_before_a_429() {
    let server = FakeDiscogs::start();
    server.route(
        "/database/search",
        FakeResponse {
            status: 200,
            headers: vec![("X-Discogs-Ratelimit-Remaining".to_string(), "0".to_string())],
            body: br#"{"results":[]}"#.to_vec(),
        },
    );
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Unavailable);
    assert_eq!(server.api_request_count(), 1);
    assert!(art.retry_after_seconds.is_some());
    assert!(
        service.cache.load(&art.key).is_none(),
        "must not cache a false negative"
    );
}

#[tokio::test]
async fn rejected_credentials_do_not_schedule_retries() {
    let server = FakeDiscogs::start();
    server.route("/database/search", status(401));
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Unavailable);
    assert_eq!(art.retry_after_seconds, None);
}

#[tokio::test]
async fn pressing_failure_keeps_master_images() {
    let server = server_with_album();
    server.route("/masters/7/versions", status(500));
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert_eq!(art.status, AlbumArtStatus::Found);
    assert_eq!(art.images.len(), 2);
}

#[tokio::test]
async fn missing_credentials_never_touch_the_network() {
    let service = DiscogsService::new(None, temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;
    assert_eq!(art.status, AlbumArtStatus::Unconfigured);
    assert_eq!(art.retry_after_seconds, None);
}

#[tokio::test]
async fn missing_album_metadata_skips_lookup() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve("Daft Punk", "").await;

    assert_eq!(art.status, AlbumArtStatus::NotFound);
    assert_eq!(server.api_request_count(), 0);
}

#[tokio::test]
async fn gone_default_image_falls_through_to_next_image() {
    let server = server_with_album();
    server.route("/img/cover", status(404));
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;

    assert!(art.artwork_data_url.is_some());
    assert_eq!(art.selected_image_id.as_ref(), Some(&art.images[1].id));
}

#[tokio::test]
async fn placement_persists_per_image_across_restart() {
    let server = server_with_album();
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;
    let first = art.images[0].id.clone();
    let second = art.images[1].id.clone();
    assert_eq!(art.placement, ArtPlacement::default());

    let placement = ArtPlacement {
        mode: cache::ArtMode::Disc,
        zoom_percent: 130,
        offset_x: 12,
        offset_y: -8,
    };
    let placed = service
        .set_placement(&art.key, &first, placement)
        .await
        .unwrap();
    assert_eq!(placed.placement, placement);
    assert_eq!(placed.artwork_data_url, art.artwork_data_url);
    drop(service);

    let restarted = DiscogsService::new(Some(server.client()), root);
    let restored = restarted.resolve(ARTIST, ALBUM).await;
    assert_eq!(restored.placement, placement);

    // Each image keeps its own: another image starts from the default.
    let other = restarted.select(&art.key, &second).await.unwrap();
    assert_eq!(other.placement, ArtPlacement::default());
    let back = restarted.select(&art.key, &first).await.unwrap();
    assert_eq!(back.placement, placement);
}

#[tokio::test]
async fn placement_rejects_an_image_from_elsewhere() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    let result = service
        .set_placement(&art.key, "not-this-album", ArtPlacement::default())
        .await;

    assert!(result.is_err());
}

/// Adds what the album's page lists: editions with their own names and images.
fn add_editions(server: &FakeDiscogs) {
    let versions = format!(
        r#"{{"pagination":{{"pages":2,"items":3}},"versions":[
            {{"id":80,"title":"RAM","major_formats":["CD"],"format":"Album","released":"2013",
              "catno":"C1","thumb":"{base}/img/e80-150.jpeg",
              "stats":{{"community":{{"in_collection":900}}}}}},
            {{"id":81,"title":"RAM ","major_formats":["Vinyl"],"format":"LP, Album","country":"US",
              "released":"2013-05-17","label":"Columbia","catno":"V1",
              "stats":{{"community":{{"in_collection":10}}}}}}
        ]}}"#,
        base = server.base_url
    );
    server.route("/masters/7/versions?per_page=100&page=1", json(&versions));
    server.route(
        "/masters/7/versions?per_page=100&page=2",
        json(
            r#"{"pagination":{"pages":2,"items":3},"versions":[
                {"id":82,"title":"RAM","major_formats":["Vinyl"],"format":"LP",
                 "stats":{"community":{"in_collection":70}}}
            ]}"#,
        ),
    );
    let release = format!(
        r#"{{"formats":[{{"name":"Vinyl","text":"Glow In The Dark"}},{{"name":"Vinyl","text":" "}}],
            "images":[{},{}]}}"#,
        image_json(server, "e81disc", "secondary"),
        image_json(server, "e81cover", "primary"),
    );
    server.route("/releases/81", json(&release));
}

fn release_requests(server: &FakeDiscogs, id: u64) -> usize {
    server
        .requests()
        .iter()
        .filter(|request| request.starts_with(&format!("GET /releases/{id} ")))
        .count()
}

#[tokio::test]
async fn editions_list_every_page_vinyl_first_and_only_once() {
    let server = server_with_album();
    add_editions(&server);
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    let listed = service.editions(&art.key).await.unwrap();

    let ids: Vec<u64> = listed.editions.iter().map(|e| e.release_id).collect();
    assert_eq!(ids, [82, 81, 80], "vinyl first, then most collected");
    assert_eq!(listed.total_count, 3);
    assert_eq!(listed.editions[1].title, "RAM");
    assert_eq!(listed.editions[1].year, "2013");
    assert_eq!(listed.editions[1].country, "US");

    let requests = server.api_request_count();
    service.editions(&art.key).await.unwrap();
    assert_eq!(server.api_request_count(), requests, "served from cache");
}

#[tokio::test]
async fn editions_keep_earlier_pages_when_a_later_one_fails() {
    let server = server_with_album();
    add_editions(&server);
    server.route("/masters/7/versions?per_page=100&page=2", status(500));
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    let listed = service.editions(&art.key).await.unwrap();

    assert_eq!(listed.editions.len(), 2);
    assert_eq!(listed.total_count, 3, "the rest is known to exist");
}

#[tokio::test]
async fn album_without_a_master_lists_the_releases_found() {
    let server = FakeDiscogs::start();
    server.route("/database/search?type=master", json(r#"{"results":[]}"#));
    let release = format!(
        r#"{{"images":[{}]}}"#,
        image_json(&server, "cover", "primary")
    );
    server.route("/releases/5", json(&release));
    server.route(
        "/database/search?type=release",
        json(
            r#"{"results":[{"id":5,"title":"Daft Punk - Random Access Memories",
                "format":["Vinyl","LP","Album"],"label":["Columbia"],"year":"2013",
                "country":"US","catno":"V1"}]}"#,
        ),
    );
    server.route("/img/", image_response());
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    let listed = service.editions(&art.key).await.unwrap();

    assert_eq!(listed.editions.len(), 1);
    let edition = &listed.editions[0];
    assert_eq!(edition.title, "Random Access Memories");
    assert_eq!(edition.major_format, "Vinyl");
    assert_eq!(edition.format, "LP, Album");
    assert_eq!(edition.year, "2013");
}

#[tokio::test]
async fn an_edition_image_can_be_chosen_and_survives_restart_offline() {
    let server = server_with_album();
    add_editions(&server);
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;
    service.editions(&art.key).await.unwrap();

    let details = service
        .edition_details(&art.key, 81, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(details.name.as_deref(), Some("Glow In The Dark"));
    assert_eq!(details.images.len(), 2);
    assert_eq!(details.images[0].kind, "primary", "cover first");

    service
        .edition_details(&art.key, 81, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(release_requests(&server, 81), 1, "details are cached");

    let listed = service.editions(&art.key).await.unwrap();
    assert_eq!(
        listed.editions[1].name.as_deref(),
        Some("Glow In The Dark"),
        "the list now knows its name"
    );

    let disc = details.images[1].id.clone();
    let selected = service.select(&art.key, &disc).await.unwrap();
    assert_eq!(selected.selected_image_id.as_ref(), Some(&disc));
    assert_eq!(selected.selected_release_id, Some(81));
    assert!(
        !selected.images.iter().any(|image| image.id == disc),
        "an edition's image is not listed among the album's own"
    );
    drop(service);

    let offline = DiscogsClient::for_test(
        Some(&Credentials::Token("sekret".into())),
        "http://127.0.0.1:9",
    );
    let restarted = DiscogsService::new(Some(offline), root);
    let restored = restarted.resolve(ARTIST, ALBUM).await;
    assert_eq!(restored.selected_image_id.as_ref(), Some(&disc));
    assert_eq!(restored.selected_release_id, Some(81));
    assert!(restored.artwork_data_url.is_some());
    let cached = restarted.editions(&art.key).await.unwrap();
    assert_eq!(cached.editions.len(), 3, "the list works offline too");
}

#[tokio::test]
async fn background_details_leave_requests_for_real_lookups() {
    let server = server_with_album();
    add_editions(&server);
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;
    service.editions(&art.key).await.unwrap();

    // Any API response reports the budget: this one says it is nearly spent.
    let mut nearly_spent = json(r#"{"images":[]}"#);
    nearly_spent
        .headers
        .push(("x-discogs-ratelimit-remaining".to_string(), "5".to_string()));
    server.route("/releases/82", nearly_spent);
    service.edition_details(&art.key, 82, false).await.unwrap();

    let waiting = service.edition_details(&art.key, 81, true).await.unwrap();
    assert_eq!(waiting, None, "background work waits");
    assert_eq!(release_requests(&server, 81), 0);

    let opened = service.edition_details(&art.key, 81, false).await.unwrap();
    assert!(opened.is_some(), "opening an edition still works");
    assert_eq!(release_requests(&server, 81), 1);
}

#[tokio::test]
async fn editions_reject_a_release_from_elsewhere() {
    let server = server_with_album();
    add_editions(&server);
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;
    service.editions(&art.key).await.unwrap();

    assert!(service.edition_details(&art.key, 999, false).await.is_err());
    assert!(service.edition_thumbnail(&art.key, 999).await.is_err());
    assert_eq!(release_requests(&server, 999), 0);
}

#[tokio::test]
async fn edition_thumbnail_downloads_once_and_handles_a_missing_one() {
    let server = server_with_album();
    add_editions(&server);
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;
    service.editions(&art.key).await.unwrap();

    let first = service.edition_thumbnail(&art.key, 80).await.unwrap();
    assert!(first.unwrap().starts_with(JPEG_DATA_URL_PREFIX));
    service.edition_thumbnail(&art.key, 80).await.unwrap();
    let downloads = server
        .requests()
        .iter()
        .filter(|request| request.starts_with("GET /img/e80-150.jpeg"))
        .count();
    assert_eq!(downloads, 1);

    assert_eq!(service.edition_thumbnail(&art.key, 82).await.unwrap(), None);
}

#[tokio::test]
async fn failed_selection_changes_nothing() {
    let server = server_with_album();
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    server.route("/img/back", status(500));
    assert!(service.select(&art.key, &art.images[2].id).await.is_err());
    assert!(service.select(&art.key, "not-an-image").await.is_err());
    assert!(service.select("no|album", &art.images[0].id).await.is_err());

    assert_eq!(
        service.cache.load(&art.key).unwrap().selected_image_id,
        None
    );
}

#[tokio::test]
async fn thumbnails_download_once_and_work_offline() {
    let server = server_with_album();
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;
    let id = &art.images[2].id;

    let thumb = service.thumbnail(&art.key, id).await.unwrap().unwrap();
    assert!(thumb.starts_with(JPEG_DATA_URL_PREFIX));
    service.thumbnail(&art.key, id).await.unwrap();
    let downloads = server
        .requests()
        .iter()
        .filter(|request| request.starts_with("GET /img/back-150"))
        .count();
    assert_eq!(downloads, 1);

    let offline = DiscogsClient::for_test(None, "http://127.0.0.1:9");
    let restarted = DiscogsService::new(Some(offline), root);
    assert!(restarted.thumbnail(&art.key, id).await.unwrap().is_some());
}

#[tokio::test]
async fn version_cover_costs_a_release_request_only_when_chosen() {
    let server = server_with_album();
    let root = temp_root();
    let service = DiscogsService::new(Some(server.client()), root.clone());
    let art = service.resolve(ARTIST, ALBUM).await;
    let cover = art.images[1].id.clone();

    let release_requests = || {
        server
            .requests()
            .iter()
            .filter(|request| request.contains("/releases/"))
            .count()
    };
    assert_eq!(
        release_requests(),
        0,
        "listing covers needs no release lookup"
    );

    let thumbnail = service.thumbnail(&art.key, &cover).await.unwrap();
    assert!(thumbnail.is_some());
    assert!(server
        .requests()
        .iter()
        .any(|request| request.starts_with("GET /img/v71-150")));
    assert_eq!(release_requests(), 0, "thumbnails need no release lookup");

    let selected = service.select(&art.key, &cover).await.unwrap();
    assert_eq!(selected.selected_image_id.as_ref(), Some(&cover));
    assert_eq!(release_requests(), 1);
    assert!(server
        .requests()
        .iter()
        .any(|request| request.starts_with("GET /img/v71full")));

    // The chosen cover is on disk now: a restart offline still shows it.
    let offline = DiscogsClient::for_test(None, "http://127.0.0.1:9");
    let restored = DiscogsService::new(Some(offline), root)
        .resolve(ARTIST, ALBUM)
        .await;
    assert_eq!(restored.selected_image_id.as_ref(), Some(&cover));
    assert!(restored.artwork_data_url.is_some());
}

#[tokio::test]
async fn choosing_a_cover_whose_release_has_no_images_fails_cleanly() {
    let server = server_with_album();
    server.route("/releases/71", json(r#"{"images":[]}"#));
    let service = DiscogsService::new(Some(server.client()), temp_root());
    let art = service.resolve(ARTIST, ALBUM).await;

    assert!(service.select(&art.key, &art.images[1].id).await.is_err());
    assert_eq!(
        service.cache.load(&art.key).unwrap().selected_image_id,
        None
    );
}

#[tokio::test]
async fn photos_cannot_crowd_out_covers_and_bootlegs_are_excluded() {
    let server = server_with_album();
    let photos: Vec<String> = (0..60)
        .map(|index| image_json(&server, &format!("photo{index}"), "secondary"))
        .collect();
    let master = format!(
        r#"{{"main_release":70,"images":[{},{}]}}"#,
        photos.join(","),
        image_json(&server, "cover", "primary"),
    );
    server.route("/masters/7", json(&master));

    let mut versions: Vec<String> = (100..140)
        .map(|id| {
            format!(
                r#"{{"id":{id},"format":"LP","major_formats":["Vinyl"],"released":"2000","thumb":"{base}/img/t{id}.jpeg","stats":{{"community":{{"in_collection":{id}}}}}}}"#,
                base = server.base_url
            )
        })
        .collect();
    versions.push(format!(
        r#"{{"id":200,"format":"LP, Unofficial Release","major_formats":["Vinyl"],"thumb":"{}/img/bootleg.jpeg","stats":{{"community":{{"in_collection":99999}}}}}}"#,
        server.base_url
    ));
    versions.push(format!(
        r#"{{"id":201,"format":"CD","major_formats":["CD"],"thumb":"{}/img/cd.jpeg","stats":{{"community":{{"in_collection":99999}}}}}}"#,
        server.base_url
    ));
    versions.push(r#"{"id":202,"format":"LP","major_formats":["Vinyl"],"thumb":""}"#.to_string());
    server.route(
        "/masters/7/versions",
        json(&format!(r#"{{"versions":[{}]}}"#, versions.join(","))),
    );
    let service = DiscogsService::new(Some(server.client()), temp_root());

    let art = service.resolve(ARTIST, ALBUM).await;
    let stored = service.cache.load(&art.key).unwrap();

    assert_eq!(art.images.len(), MAX_IMAGES_PER_ALBUM);
    let covers = art
        .images
        .iter()
        .filter(|image| image.kind == "primary")
        .count();
    assert_eq!(covers, 1 + MAX_VERSION_COVERS);
    assert_eq!(
        stored.images[1].release_id,
        Some(139),
        "vinyl first, most collected first, even over a more collected CD"
    );
    assert!(!stored
        .images
        .iter()
        .any(|image| image.uri150.contains("bootleg")));
    assert!(!stored
        .images
        .iter()
        .any(|image| image.uri150.contains("/cd.")));
}

/// Hits the real API without a credential, so it stays within the anonymous limit.
/// Run with: cargo test discogs::tests::live_ -- --ignored
#[tokio::test]
#[ignore = "requires network access and a Discogs credential"]
async fn live_editions_list_names_and_images() {
    let credentials = load_credentials().expect("a Discogs credential in the environment");
    let client = DiscogsClient::new(Some(&credentials)).unwrap();
    let service = DiscogsService::new(Some(client), temp_root());

    let art = service.resolve("Ariana Grande", "Positions").await;
    assert_eq!(art.status, AlbumArtStatus::Found);

    let listed = service.editions(&art.key).await.unwrap();
    assert!(listed.editions.len() >= 50, "{}", listed.editions.len());
    assert_eq!(listed.editions[0].major_format, "Vinyl");
    for format in ["CD", "Cassette"] {
        assert!(listed.editions.iter().any(|e| e.major_format == format));
    }

    let glow = 18_132_004;
    assert!(listed.editions.iter().any(|e| e.release_id == glow));
    let details = service
        .edition_details(&art.key, glow, false)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(details.name.as_deref(), Some("Glow In The Dark"));
    assert!(details.images.len() > 5, "{}", details.images.len());

    assert!(service
        .edition_thumbnail(&art.key, glow)
        .await
        .unwrap()
        .is_some());
    let disc = &details.images[4].id;
    let selected = service.select(&art.key, disc).await.unwrap();
    assert_eq!(selected.selected_image_id.as_ref(), Some(disc));
    assert_eq!(selected.selected_release_id, Some(glow));
    assert!(selected.artwork_data_url.is_some());
}

#[tokio::test]
#[ignore = "requires network access to api.discogs.com"]
async fn live_master_flow_resolves_real_images() {
    let client = DiscogsClient::new(None).unwrap();
    let service = DiscogsService::new(Some(client), temp_root());

    let art = service.resolve("Daft Punk", "Random Access Memories").await;

    assert_eq!(art.status, AlbumArtStatus::Found, "{art:?}");
    assert!(art.images.len() > 1);
    assert_eq!(art.images[0].kind, "primary");
    assert!(art.artwork_data_url.is_some());
    assert!(service
        .thumbnail(&art.key, &art.images[1].id)
        .await
        .unwrap()
        .is_some());

    let wrong = service
        .resolve("Daft Punk", "An Album That Does Not Exist 4821")
        .await;
    assert_eq!(wrong.status, AlbumArtStatus::NotFound, "{wrong:?}");
}
