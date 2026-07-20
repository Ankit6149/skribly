use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowContext {
    pub platform: String,
    pub app_name: String,
    pub title: Option<String>,
    pub position: NormalizedPoint,
}
