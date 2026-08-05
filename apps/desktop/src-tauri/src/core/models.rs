use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WindowRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl WindowRect {
    pub fn contains_point(&self, px: i32, py: i32) -> bool {
        px >= self.x && px <= (self.x + self.width) && py >= self.y && py <= (self.y + self.height)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HitTestRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl HitTestRect {
    pub fn contains_point(&self, px: i32, py: i32) -> bool {
        px >= self.x && px <= (self.x + self.width) && py >= self.y && py <= (self.y + self.height)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TargetWindowInfo {
    pub hwnd_val: isize,
    pub title: String,
    pub process_name: String,
    pub class_name: String,
    pub bounds: WindowRect,
    pub is_minimized: bool,
    pub is_focused: bool,
    pub dpi: u32,
    pub scale_factor: f64,
}

impl TargetWindowInfo {
    pub fn context_fingerprint(&self) -> String {
        format!(
            "{}:{}",
            self.process_name.to_lowercase(),
            self.title.trim().to_lowercase()
        )
    }

    pub fn match_score(&self, target_process: &str, target_title: &str) -> u32 {
        let same_process = self.process_name.eq_ignore_ascii_case(target_process);
        if !same_process {
            return 0;
        }

        let p1 = self.title.trim().to_lowercase();
        let p2 = target_title.trim().to_lowercase();

        if p1.is_empty() || p2.is_empty() {
            return 50;
        }

        if p1 == p2 {
            100
        } else if p1.contains(&p2) || p2.contains(&p1) {
            75
        } else {
            0
        }
    }

    pub fn matches_context(&self, target_process: &str, target_title: &str) -> bool {
        self.match_score(target_process, target_title) >= 50
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SkribNote {
    pub id: String,
    pub target_process_name: String,
    pub target_title: String,
    pub rel_x: f64,
    pub rel_y: f64,
    pub width: f64,
    pub height: f64,
    pub text: String,
    pub color: String,
    pub collapsed: bool,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<u64>,
}

impl SkribNote {
    pub fn calculate_absolute_bounds(&self, target: &TargetWindowInfo) -> WindowRect {
        let abs_x = target.bounds.x + self.rel_x.round() as i32;
        let abs_y = target.bounds.y + self.rel_y.round() as i32;
        WindowRect {
            x: abs_x,
            y: abs_y,
            width: self.width.round() as i32,
            height: self.height.round() as i32,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload")]
pub enum OverlayInitializationStatus {
    Initializing,
    Ready(OverlayMetrics),
    Failed(String),
}

impl Default for OverlayInitializationStatus {
    fn default() -> Self {
        Self::Initializing
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OverlayMetrics {
    pub overlay_physical_x: i32,
    pub overlay_physical_y: i32,
    pub overlay_physical_width: i32,
    pub overlay_physical_height: i32,
    pub dpi: u32,
    pub scale_factor: f64,
}

impl Default for OverlayMetrics {
    fn default() -> Self {
        Self {
            overlay_physical_x: 0,
            overlay_physical_y: 0,
            overlay_physical_width: 1920,
            overlay_physical_height: 1080,
            dpi: 96,
            scale_factor: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayStatePayload {
    pub active_target: Option<TargetWindowInfo>,
    pub skribs: Vec<SkribNote>,
    pub available_windows: Vec<TargetWindowInfo>,
    pub is_shortcut_active: bool,
    pub is_ambiguous: bool,
    pub overlay_metrics: OverlayMetrics,
    pub init_status: OverlayInitializationStatus,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_note(deleted_at: Option<u64>) -> SkribNote {
        SkribNote {
            id: "skrib_1".into(),
            target_process_name: "test.exe".into(),
            target_title: "Test".into(),
            rel_x: 50.0,
            rel_y: 40.0,
            width: 250.0,
            height: 180.0,
            text: "Hello".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 1000,
            updated_at: 1000,
            deleted_at,
        }
    }

    #[test]
    fn test_window_rect_contains_point() {
        let rect = WindowRect {
            x: 100,
            y: 100,
            width: 200,
            height: 150,
        };
        assert!(rect.contains_point(150, 150));
        assert!(rect.contains_point(100, 100));
        assert!(rect.contains_point(300, 250));
        assert!(!rect.contains_point(99, 150));
        assert!(!rect.contains_point(350, 150));
    }

    #[test]
    fn test_hwnd_val_serialization_reconstruction() {
        let raw_handle: isize = 0x000204AE;
        let win = TargetWindowInfo {
            hwnd_val: raw_handle,
            title: "Test Notepad".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: WindowRect {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        };

        let json = serde_json::to_string(&win).expect("Serialization failed");
        let decoded: TargetWindowInfo =
            serde_json::from_str(&json).expect("Deserialization failed");

        assert_eq!(decoded.hwnd_val, raw_handle);
    }

    #[test]
    fn test_match_scoring_multiple_notepad_windows() {
        let notepad1 = TargetWindowInfo {
            hwnd_val: 1001,
            title: "Document-A.txt - Notepad".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: WindowRect {
                x: 0,
                y: 0,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        };

        let notepad2 = TargetWindowInfo {
            hwnd_val: 1002,
            title: "Project-Plan.txt - Notepad".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: WindowRect {
                x: 100,
                y: 100,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: false,
            dpi: 96,
            scale_factor: 1.0,
        };

        let score1 = notepad1.match_score("notepad.exe", "Document-A.txt");
        let score2 = notepad2.match_score("notepad.exe", "Document-A.txt");

        assert_eq!(score1, 75);
        assert_eq!(score2, 0);
    }

    #[test]
    fn test_calculate_absolute_bounds() {
        let win = TargetWindowInfo {
            hwnd_val: 12345,
            title: "Test".into(),
            process_name: "test.exe".into(),
            class_name: "TestClass".into(),
            bounds: WindowRect {
                x: 200,
                y: 150,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        };

        let note = sample_note(None);
        let abs_bounds = note.calculate_absolute_bounds(&win);
        assert_eq!(abs_bounds.x, 250);
        assert_eq!(abs_bounds.y, 190);
    }

    #[test]
    fn active_note_serialization_preserves_the_schema_v2_integrity_shape() {
        let json = serde_json::to_string(&sample_note(None)).expect("serialize active note");
        assert_eq!(
            json,
            r#"{"id":"skrib_1","target_process_name":"test.exe","target_title":"Test","rel_x":50.0,"rel_y":40.0,"width":250.0,"height":180.0,"text":"Hello","color":"yellow","collapsed":false,"created_at":1000,"updated_at":1000}"#
        );
        assert!(!json.contains("deleted_at"));
    }

    #[test]
    fn trashed_note_serialization_includes_schema_v3_lifecycle_metadata() {
        let json = serde_json::to_string(&sample_note(Some(2000))).expect("serialize trashed note");
        let value: serde_json::Value = serde_json::from_str(&json).expect("parse trashed note");
        assert_eq!(
            value.get("deleted_at").and_then(serde_json::Value::as_u64),
            Some(2000)
        );
        let decoded: SkribNote = serde_json::from_str(&json).expect("deserialize trashed note");
        assert_eq!(decoded.deleted_at, Some(2000));
    }

    #[test]
    fn legacy_note_without_lifecycle_metadata_deserializes_as_active() {
        let json = r#"{"id":"legacy","target_process_name":"notepad.exe","target_title":"Legacy","rel_x":0.0,"rel_y":0.0,"width":400.0,"height":340.0,"text":"Old","color":"yellow","collapsed":false,"created_at":1,"updated_at":2}"#;
        let decoded: SkribNote = serde_json::from_str(json).expect("deserialize legacy note");
        assert_eq!(decoded.deleted_at, None);
    }
}
