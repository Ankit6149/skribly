use crate::core::models::{HitTestRect, SkribNote, TargetWindowInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Default)]
pub struct CoordinatorState {
    pub skribs: HashMap<String, SkribNote>,
    pub active_target: Option<TargetWindowInfo>,
    pub hit_test_rects: Vec<HitTestRect>,
}

#[derive(Clone, Default)]
pub struct Coordinator {
    state: Arc<Mutex<CoordinatorState>>,
}

impl Coordinator {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(CoordinatorState::default())),
        }
    }

    pub fn set_active_target(&self, target: Option<TargetWindowInfo>) {
        if let Ok(mut state) = self.state.lock() {
            state.active_target = target;
        }
    }

    pub fn get_active_target(&self) -> Option<TargetWindowInfo> {
        if let Ok(state) = self.state.lock() {
            state.active_target.clone()
        } else {
            None
        }
    }

    pub fn set_hit_test_rects(&self, rects: Vec<HitTestRect>) {
        if let Ok(mut state) = self.state.lock() {
            state.hit_test_rects = rects;
        }
    }

    pub fn get_hit_test_rects(&self) -> Vec<HitTestRect> {
        if let Ok(state) = self.state.lock() {
            state.hit_test_rects.clone()
        } else {
            Vec::new()
        }
    }

    pub fn is_point_interactive(&self, px: i32, py: i32) -> bool {
        if let Ok(state) = self.state.lock() {
            state
                .hit_test_rects
                .iter()
                .any(|r| r.contains_point(px, py))
        } else {
            false
        }
    }

    pub fn upsert_skrib(&self, note: SkribNote) {
        if let Ok(mut state) = self.state.lock() {
            state.skribs.insert(note.id.clone(), note);
        }
    }

    pub fn remove_skrib(&self, id: &str) -> Option<SkribNote> {
        if let Ok(mut state) = self.state.lock() {
            state.skribs.remove(id)
        } else {
            None
        }
    }

    pub fn get_skribs_for_target(&self, target: &TargetWindowInfo) -> Vec<SkribNote> {
        if let Ok(state) = self.state.lock() {
            state
                .skribs
                .values()
                .filter(|note| {
                    target.matches_context(&note.target_process_name, &note.target_title)
                })
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn get_all_skribs(&self) -> Vec<SkribNote> {
        if let Ok(state) = self.state.lock() {
            state.skribs.values().cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub fn find_disconnected_context_match(&self, candidate: &TargetWindowInfo) -> bool {
        if let Ok(state) = self.state.lock() {
            state.skribs.values().any(|note| {
                candidate.matches_context(&note.target_process_name, &note.target_title)
            })
        } else {
            false
        }
    }

    pub fn update_skrib_position(
        &self,
        id: &str,
        rel_x: f64,
        rel_y: f64,
        width: f64,
        height: f64,
    ) -> bool {
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                note.rel_x = rel_x;
                note.rel_y = rel_y;
                note.width = width;
                note.height = height;
                note.updated_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn update_skrib_text(&self, id: &str, text: String) -> bool {
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                note.text = text;
                note.updated_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn update_skrib_color(&self, id: &str, color: String) -> bool {
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                note.color = color;
                note.updated_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn toggle_skrib_collapse(&self, id: &str) -> Option<bool> {
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                note.collapsed = !note.collapsed;
                note.updated_at = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                Some(note.collapsed)
            } else {
                None
            }
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::models::WindowRect;

    fn sample_target() -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_val: 1001,
            title: "Document.txt - Notepad".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: WindowRect {
                x: 100,
                y: 100,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: true,
            dpi: 96,
            scale_factor: 1.0,
        }
    }

    #[test]
    fn test_coordinator_lifecycle_and_lock_safety() {
        let coordinator = Coordinator::new();
        let target = sample_target();

        coordinator.set_active_target(Some(target.clone()));
        assert_eq!(coordinator.get_active_target(), Some(target.clone()));

        let note = SkribNote {
            id: "note-1".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt".into(),
            rel_x: 20.0,
            rel_y: 30.0,
            width: 200.0,
            height: 150.0,
            text: "Important note".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 100,
            updated_at: 100,
        };

        coordinator.upsert_skrib(note);
        let active_notes = coordinator.get_skribs_for_target(&target);
        assert_eq!(active_notes.len(), 1);
        assert_eq!(active_notes[0].text, "Important note");

        // Test hit test rects
        let rects = vec![HitTestRect {
            x: 120,
            y: 130,
            width: 200,
            height: 150,
        }];
        coordinator.set_hit_test_rects(rects);
        assert!(coordinator.is_point_interactive(150, 150));
        assert!(!coordinator.is_point_interactive(10, 10));

        // Test position update
        assert!(coordinator.update_skrib_position("note-1", 50.0, 60.0, 220.0, 160.0));
        let updated = coordinator.get_all_skribs();
        assert_eq!(updated[0].rel_x, 50.0);

        // Test deletion
        assert!(coordinator.remove_skrib("note-1").is_some());
        assert_eq!(coordinator.get_all_skribs().len(), 0);
    }

    #[test]
    fn test_context_restore_on_target_return() {
        let coordinator = Coordinator::new();
        let target = sample_target();

        let note = SkribNote {
            id: "note-saved".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Notepad".into(),
            rel_x: 10.0,
            rel_y: 10.0,
            width: 200.0,
            height: 150.0,
            text: "Saved note".into(),
            color: "peach".into(),
            collapsed: false,
            created_at: 100,
            updated_at: 100,
        };

        coordinator.upsert_skrib(note);

        // Target disconnects (window closed)
        coordinator.set_active_target(None);
        assert_eq!(coordinator.get_active_target(), None);

        // Verify note is retained in memory as disconnected context
        assert!(coordinator.find_disconnected_context_match(&target));

        // Target reopens in same session
        coordinator.set_active_target(Some(target.clone()));
        let restored_notes = coordinator.get_skribs_for_target(&target);
        assert_eq!(restored_notes.len(), 1);
        assert_eq!(restored_notes[0].id, "note-saved");
    }
}
