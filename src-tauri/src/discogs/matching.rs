//! Album identity and search-result scoring. Pure functions, no I/O.
//!
//! Matching is deliberately strict: showing the generic label is better than
//! pressing the wrong album's art onto the record.

use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

const MIN_ARTIST_SCORE: f32 = 0.6;
const MIN_ALBUM_SCORE: f32 = 0.85;
const VINYL_BONUS: f32 = 0.02;

/// Suffix words that describe a pressing of an album, not a different album.
/// "version" is excluded on purpose: "Fearless (Taylor's Version)" is its own record.
const EDITION_WORDS: &[&str] = &[
    "deluxe",
    "remaster",
    "edition",
    "anniversary",
    "expanded",
    "bonus",
    "reissue",
    "explicit",
    "clean",
    "mono",
    "stereo",
];

const ARTIST_SEPARATORS: &[&str] = &[
    ",",
    ";",
    " feat. ",
    " feat ",
    " ft. ",
    " ft ",
    " featuring ",
    " with ",
    " x ",
    " / ",
    " vs. ",
    " vs ",
];

/// Case, accent and punctuation-insensitive form used for all comparisons.
pub(crate) fn normalize(value: &str) -> String {
    let folded: String = value.nfkd().filter(|ch| !is_combining_mark(*ch)).collect();
    let mut spaced = String::with_capacity(folded.len());
    for ch in folded.to_lowercase().chars() {
        match ch {
            '&' => spaced.push_str(" and "),
            '\'' | '\u{2019}' => {}
            ch if ch.is_alphanumeric() => spaced.push(ch),
            _ => spaced.push(' '),
        }
    }

    let words: Vec<&str> = spaced.split_whitespace().collect();
    match words.as_slice() {
        ["the", rest @ ..] if !rest.is_empty() => rest.join(" "),
        all => all.join(" "),
    }
}

/// First credited artist, so every track of an album shares one identity even
/// when the player reports "Daft Punk, Pharrell Williams" for some of them.
pub(crate) fn primary_artist(artist: &str) -> String {
    let lowered = artist.to_lowercase();
    let end = ARTIST_SEPARATORS
        .iter()
        .filter_map(|separator| lowered.find(separator))
        .min()
        .unwrap_or(lowered.len());
    lowered[..end].trim().to_string()
}

/// Removes trailing "(Deluxe Edition)" / "- 2011 Remaster" style qualifiers.
pub(crate) fn strip_edition(album: &str) -> String {
    let mut current = album.trim();
    loop {
        let suffix_start = trailing_group_start(current).or_else(|| current.rfind(" - "));
        let Some(start) = suffix_start else { break };

        let suffix = current[start..].to_lowercase();
        if start == 0 || !EDITION_WORDS.iter().any(|word| suffix.contains(word)) {
            break;
        }
        current = current[..start].trim_end();
    }
    current.to_string()
}

fn trailing_group_start(value: &str) -> Option<usize> {
    if value.ends_with(')') {
        value.rfind('(')
    } else if value.ends_with(']') {
        value.rfind('[')
    } else {
        None
    }
}

/// One album being looked up. `key` identifies it everywhere (cache, IPC, events).
#[derive(Debug, Clone)]
pub(crate) struct AlbumLookup {
    pub(crate) key: String,
    pub(crate) search_artist: String,
    pub(crate) search_album: String,
    pub(crate) raw_album: String,
    full_artist_norm: String,
    primary_artist_norm: String,
    album_norm: String,
}

impl AlbumLookup {
    /// `None` when artist or album is missing: without both, a lookup would guess.
    pub(crate) fn new(artist: &str, album: &str) -> Option<Self> {
        let search_artist = primary_artist(artist);
        let search_album = strip_edition(album);
        let primary_artist_norm = normalize(&search_artist);
        let album_norm = normalize(&search_album);
        if primary_artist_norm.is_empty() || album_norm.is_empty() {
            return None;
        }

        Some(Self {
            key: format!("{primary_artist_norm}|{album_norm}"),
            search_artist,
            search_album,
            raw_album: album.trim().to_string(),
            full_artist_norm: normalize(artist),
            primary_artist_norm,
            album_norm,
        })
    }

    /// Scores a Discogs result title ("Artist - Album"). `None` means rejected.
    pub(crate) fn score(&self, result_title: &str, formats: &[String]) -> Option<f32> {
        let (artist, album) = result_title.split_once(" - ")?;
        let artist_score = self.artist_score(artist);
        let album_score = self.album_score(album);
        if artist_score < MIN_ARTIST_SCORE || album_score < MIN_ALBUM_SCORE {
            return None;
        }

        let vinyl = formats.iter().any(|format| format == "Vinyl");
        Some(album_score * 0.6 + artist_score * 0.4 + if vinyl { VINYL_BONUS } else { 0.0 })
    }

    fn artist_score(&self, candidate: &str) -> f32 {
        let candidate = normalize(&strip_discogs_artist_suffix(candidate));
        if candidate == self.full_artist_norm || candidate == self.primary_artist_norm {
            return 1.0;
        }

        // Collaborations: "Daft Punk" is credited inside "Daft Punk & Friends".
        // A single word only counts at the start, so "Bush" never becomes "Kate Bush".
        let wanted = &self.primary_artist_norm;
        if candidate.starts_with(&format!("{wanted} ")) {
            return 0.85;
        }
        if wanted.contains(' ') && format!(" {candidate} ").contains(&format!(" {wanted} ")) {
            return 0.7;
        }

        word_overlap(&candidate, &self.full_artist_norm)
    }

    fn album_score(&self, candidate: &str) -> f32 {
        let stripped = normalize(&strip_edition(candidate));
        if stripped == self.album_norm {
            return 1.0;
        }
        word_overlap(&stripped, &self.album_norm)
    }
}

/// Discogs disambiguates names as "Nirvana (2)" and marks name variations with "*".
fn strip_discogs_artist_suffix(artist: &str) -> String {
    let trimmed = artist.trim().trim_end_matches('*').trim_end();
    if let (Some(open), true) = (trimmed.rfind(" ("), trimmed.ends_with(')')) {
        let inner = &trimmed[open + 2..trimmed.len() - 1];
        if !inner.is_empty() && inner.chars().all(|ch| ch.is_ascii_digit()) {
            return trimmed[..open].to_string();
        }
    }
    trimmed.to_string()
}

fn word_overlap(a: &str, b: &str) -> f32 {
    let a_words: std::collections::HashSet<&str> = a.split_whitespace().collect();
    let b_words: std::collections::HashSet<&str> = b.split_whitespace().collect();
    let union = a_words.union(&b_words).count();
    if union == 0 {
        return 0.0;
    }
    a_words.intersection(&b_words).count() as f32 / union as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lookup(artist: &str, album: &str) -> AlbumLookup {
        AlbumLookup::new(artist, album).expect("valid lookup")
    }

    #[test]
    fn normalize_folds_case_accents_and_punctuation() {
        assert_eq!(normalize("Björk"), "bjork");
        assert_eq!(normalize("BEYONCÉ"), "beyonce");
        assert_eq!(normalize("Simon & Garfunkel"), "simon and garfunkel");
        assert_eq!(normalize("Don't Stop!"), "dont stop");
        assert_eq!(normalize("The Beatles"), "beatles");
        assert_eq!(normalize("The The"), "the");
        assert_eq!(normalize("東京事変"), "東京事変");
    }

    #[test]
    fn primary_artist_ignores_featured_credits() {
        assert_eq!(primary_artist("Daft Punk, Pharrell Williams"), "daft punk");
        assert_eq!(primary_artist("Daft Punk feat. Nile Rodgers"), "daft punk");
        assert_eq!(primary_artist("Simon & Garfunkel"), "simon & garfunkel");
    }

    #[test]
    fn strip_edition_removes_only_pressing_qualifiers() {
        assert_eq!(
            strip_edition("Abbey Road (Super Deluxe Edition)"),
            "Abbey Road"
        );
        assert_eq!(strip_edition("Rumours - 2004 Remaster"), "Rumours");
        assert_eq!(
            strip_edition("Discovery [Remastered] (Explicit)"),
            "Discovery"
        );
        assert_eq!(
            strip_edition("Fearless (Taylor's Version)"),
            "Fearless (Taylor's Version)"
        );
        assert_eq!(strip_edition("Alive 2007 (Live)"), "Alive 2007 (Live)");
        assert_eq!(strip_edition("(Deluxe)"), "(Deluxe)");
    }

    #[test]
    fn tracks_of_one_album_share_a_key_across_credits_and_editions() {
        let base = lookup("Daft Punk", "Random Access Memories");
        assert_eq!(base.key, "daft punk|random access memories");
        for (artist, album) in [
            ("Daft Punk, Pharrell Williams", "Random Access Memories"),
            ("DAFT PUNK feat. Nile Rodgers", "random access memories"),
            (
                "Daft Punk",
                "Random Access Memories (10th Anniversary Edition)",
            ),
        ] {
            assert_eq!(lookup(artist, album).key, base.key);
        }
    }

    #[test]
    fn different_albums_or_artists_never_share_a_key() {
        let base = lookup("Daft Punk", "Discovery");
        assert_ne!(base.key, lookup("Daft Punk", "Homework").key);
        assert_ne!(
            base.key,
            lookup("Electric Light Orchestra", "Discovery").key
        );
    }

    #[test]
    fn lookup_requires_both_artist_and_album() {
        assert!(AlbumLookup::new("", "Discovery").is_none());
        assert!(AlbumLookup::new("Daft Punk", "   ").is_none());
        assert!(AlbumLookup::new("!!!", "...").is_none());
    }

    #[test]
    fn score_accepts_exact_and_rejects_similar_titles() {
        let wanted = lookup("Daft Punk", "Random Access Memories");
        assert!(wanted
            .score("Daft Punk - Random Access Memories", &[])
            .is_some());
        for wrong in [
            "Daft Punk - Random Access Memories Remixed Tribute Album",
            "Daft Punk - Memories",
            "Daft Punk - Discovery",
            "Various - Random Access Memories",
            "Random Access Memories",
        ] {
            assert_eq!(wanted.score(wrong, &[]), None, "{wrong}");
        }
    }

    #[test]
    fn score_rejects_album_with_extra_identity_words() {
        let wanted = lookup("Michael Jackson", "Thriller");
        assert_eq!(wanted.score("Michael Jackson - Thriller 25", &[]), None);
    }

    #[test]
    fn score_handles_discogs_artist_suffixes_and_comma_names() {
        assert!(lookup("Nirvana", "Nevermind")
            .score("Nirvana (2) - Nevermind", &[])
            .is_some());
        assert!(lookup("Tyler, The Creator", "Igor")
            .score("Tyler, The Creator - Igor", &[])
            .is_some());
        assert!(lookup("Earth, Wind & Fire", "I Am")
            .score("Earth, Wind & Fire - I Am", &[])
            .is_some());
        assert_eq!(
            lookup("Bush", "Sixteen Stone").score("Kate Bush - Sixteen Stone", &[]),
            None
        );
    }

    #[test]
    fn score_prefers_exact_artist_and_vinyl() {
        let wanted = lookup("Daft Punk", "Discovery");
        let exact = wanted.score("Daft Punk - Discovery", &[]).unwrap();
        let collab = wanted.score("Daft Punk & Friend - Discovery", &[]).unwrap();
        let vinyl = wanted
            .score("Daft Punk - Discovery", &["Vinyl".to_string()])
            .unwrap();
        assert!(exact > collab);
        assert!(vinyl > exact);
    }
}
