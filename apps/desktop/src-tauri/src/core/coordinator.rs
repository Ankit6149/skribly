use crate::core::models::{SkribNote, TargetWindowInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Default)]
pub struct CoordinatorState {
    pub skribs: HashMap<String, SkribNote>,
    pub active_target: Option<TargetWindowInfo>,
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
        let mut state = self.state.lock().unwrap();
        state.active_target = target;
    }

    pub fn get_active_target(&self) -> Option<TargetWindowInfo> {
        let state = self.state.lock().unwrap();
        state.active_target.clone()
    }

    pub fn upsert_skrib(&self, note: SkribNote) {
        let mut state = self.state.lock().unwrap();
        state.skribs.insert(note.id.clone(), note);
    }

    pub fn remove_skrib(&self, id: &str) -> Option<SkribNote> {
        let mut state = self.state.lock().unwrap();
        state.skribs.remove(id)
    }

    pub fn get_skribs_for_target(&self, target: &TargetWindowInfo) -> Vec<SkribNote> {
        let state = self.state.lock().unwrap();
        state
            .skribs
            .values()
            .filter(|note| target.matches_context(&note.target_process_name, &note.target_title))
            .cloned()
            .collect()
    }

    pub fn get_all_skribs(&self) -> Vec<SkribNote> {
        let state = self.state.lock().unwrap();
        state.skribs.values().cloned().collect()
    }

    pub fn update_skrib_position(
        &self,
        id: &str,
        rel_x: f64,
        rel_y: f64,
        width: f64,
        height: f64,
    ) -> bool {
        let mut state = self.state.lock().unwrap();
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
    }

    pub fn update_skrib_text(&self, id: &str, text: String) -> bool {
        let mut state = self.state.lock().unwrap();
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
    }

    pub fn update_skrib_color(&self, id: &str, color: String) -> bool {
        let mut state = self.state.lock().unwrap();
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
    }

    pub fn toggle_skrib_collapse(&self, id: &str) -> Option<bool> {
        let mut state = self.state.lock().unwrap();
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::models::WindowRect;

    fn sample_target() -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_id: "1001".into(),
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
    fn test_coordinator_lifecycle() {
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

        // Test position update
        assert!(coordinator.update_skrib_position("note-1", 50.0, 60.0, 220.0, 160.0));
        let updated = coordinator.get_all_skribs();
        assert_eq!(updated[0].rel_x, 50.0);
        assert_eq!(updated[0].width, 220.0);

        // Test collapse toggle
        let collapsed_state = coordinator.toggle_skrib_collapse("note-1");
        assert_eq!(collapsed_state, Some(true));

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

        // Target minimizes/closes (active_target set to None)
        coordinator.set_active_target(None);
        assert_eq!(coordinator.get_active_target(), None);

        // Target returns
        coordinator.set_active_target(Some(target.clone()));
        let restored_notes = coordinator.get_skribs_for_target(&target);
        assert_eq!(restored_notes.len(), 1);
        assert_eq!(restored_notes[0].id, "note-saved");
    }
}
