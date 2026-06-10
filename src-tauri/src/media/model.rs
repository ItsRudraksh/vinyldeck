use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSnapshot {
    pub track: String,
    pub artist: String,
    pub album: String,
    pub artwork_data_url: Option<String>,
    pub duration: f64,
    pub position: f64,
    pub is_playing: bool,
    pub source_name: String,
    pub source_id: String,
    pub can_seek: bool,
    pub can_skip: bool,
    pub can_control: bool,
}

impl Default for MediaSnapshot {
    fn default() -> Self {
        Self {
            track: String::new(),
            artist: String::new(),
            album: String::new(),
            artwork_data_url: None,
            duration: 0.0,
            position: 0.0,
            is_playing: false,
            source_name: String::new(),
            source_id: String::new(),
            can_seek: false,
            can_skip: false,
            can_control: false,
        }
    }
}
