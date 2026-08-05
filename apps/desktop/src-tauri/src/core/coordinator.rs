use crate::core::license;
use crate::core::models::{HitTestRect, SkribNote, TargetWindowInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub const MAX_NOTE_CHARACTERS: usize = 20_000;
const MAX_NOTE_ID_CHARACTERS: usize = 256;
const MAX_GEOMETRY_COORDINATE: f64 = 1_000_000.0;
const MAX_GEOMETRY_DIMENSION: f64 = 100_000.0;
const ALLOWED_NOTE_COLORS: [&str; 5] = ["yellow", "peach", "mint", "sky", "lavender"];

#[derive(Debug, Clone, PartialEq)]
pub enum MatchResult {
    Unique(TargetWindowInfo),
    Ambiguous(Vec<TargetWindowInfo>),
    None,
}

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

fn is_valid_note_id(id: &str) -> bool {
    let character_count = id.chars().count();
    character_count > 0
        && character_count <= MAX_NOTE_ID_CHARACTERS
        && !id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
}

fn is_valid_note_text(text: &str) -> bool {
    text.chars().count() <= MAX_NOTE_CHARACTERS
}

fn is_valid_note_color(color: &str) -> bool {
    ALLOWED_NOTE_COLORS.contains(&color)
}

fn is_valid_note_geometry(rel_x: f64, rel_y: f64, width: f64, height: f64) -> bool {
    [rel_x, rel_y, width, height]
        .iter()
        .all(|value| value.is_finite())
        && rel_x.abs() <= MAX_GEOMETRY_COORDINATE
        && rel_y.abs() <= MAX_GEOMETRY_COORDINATE
        && width > 0.0
        && height > 0.0
        && width <= MAX_GEOMETRY_DIMENSION
        && height <= MAX_GEOMETRY_DIMENSION
}

fn is_valid_note(note: &SkribNote) -> bool {
    is_valid_note_id(&note.id)
        && is_valid_note_text(&note.text)
        && is_valid_note_color(&note.color)
        && is_valid_note_geometry(note.rel_x, note.rel_y, note.width, note.height)
}

fn can_mutate_note(note: &SkribNote) -> bool {
    note.deleted_at.is_none()
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
                .any(|rect| rect.contains_point(px, py))
        } else {
            false
        }
    }

    pub fn upsert_skrib(&self, note: SkribNote) -> bool {
        if license::require_global_write_access().is_err()
            || !is_valid_note(&note)
            || note.deleted_at.is_some()
        {
            return false;
        }
        if let Ok(mut state) = self.state.lock() {
            state.skribs.insert(note.id.clone(), note);
            true
        } else {
            false
        }
    }

    pub fn replace_all_skribs(&self, notes: Vec<SkribNote>) {
        if let Ok(mut state) = self.state.lock() {
            state.skribs = notes
                .into_iter()
                .map(|note| (note.id.clone(), note))
                .collect();
        }
    }

    pub fn trash_skrib(&self, id: &str, deleted_at: u64) -> Option<SkribNote> {
        if license::require_global_write_access().is_err()
            || !is_valid_note_id(id)
            || deleted_at == 0
        {
            return None;
        }
        let mut state = self.state.lock().ok()?;
        let note = state.skribs.get_mut(id)?;
        if note.deleted_at.is_some() {
            return None;
        }
        note.deleted_at = Some(deleted_at);
        note.updated_at = deleted_at;
        Some(note.clone())
    }

    pub fn restore_skrib(&self, id: &str, restored_at: u64) -> Option<SkribNote> {
        if license::require_global_write_access().is_err()
            || !is_valid_note_id(id)
            || restored_at == 0
        {
            return None;
        }
        let mut state = self.state.lock().ok()?;
        let note = state.skribs.get_mut(id)?;
        note.deleted_at?;
        note.deleted_at = None;
        note.updated_at = restored_at;
        Some(note.clone())
    }

    pub fn permanently_delete_skrib(&self, id: &str) -> Option<SkribNote> {
        if license::require_global_write_access().is_err() || !is_valid_note_id(id) {
            return None;
        }
        let mut state = self.state.lock().ok()?;
        if state.skribs.get(id)?.deleted_at.is_none() {
            return None;
        }
        state.skribs.remove(id)
    }

    pub fn discard_empty_skrib(&self, id: &str) -> Option<SkribNote> {
        if license::require_global_write_access().is_err() || !is_valid_note_id(id) {
            return None;
        }
        let mut state = self.state.lock().ok()?;
        let note = state.skribs.get(id)?;
        if note.deleted_at.is_some() || !note.text.trim().is_empty() {
            return None;
        }
        state.skribs.remove(id)
    }

    pub fn get_skribs_for_target(&self, target: &TargetWindowInfo) -> Vec<SkribNote> {
        if let Ok(state) = self.state.lock() {
            state
                .skribs
                .values()
                .filter(|note| {
                    note.deleted_at.is_none()
                        && target.matches_context(&note.target_process_name, &note.target_title)
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

    pub fn get_active_skribs(&self) -> Vec<SkribNote> {
        if let Ok(state) = self.state.lock() {
            state
                .skribs
                .values()
                .filter(|note| note.deleted_at.is_none())
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn get_trashed_skribs(&self) -> Vec<SkribNote> {
        if let Ok(state) = self.state.lock() {
            state
                .skribs
                .values()
                .filter(|note| note.deleted_at.is_some())
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn find_best_context_match(&self, candidates: &[TargetWindowInfo]) -> MatchResult {
        if let Ok(state) = self.state.lock() {
            if !state.skribs.values().any(|note| note.deleted_at.is_none()) {
                return MatchResult::None;
            }

            let mut scored: Vec<(u32, TargetWindowInfo)> = Vec::new();
            for candidate in candidates {
                let max_score = state
                    .skribs
                    .values()
                    .filter(|note| note.deleted_at.is_none())
                    .map(|note| {
                        candidate.match_score(&note.target_process_name, &note.target_title)
                    })
                    .max()
                    .unwrap_or(0);

                if max_score >= 50 {
                    scored.push((max_score, candidate.clone()));
                }
            }

            if scored.is_empty() {
                return MatchResult::None;
            }

            scored.sort_by(|a, b| b.0.cmp(&a.0));

            let top_score = scored[0].0;
            let top_matches: Vec<TargetWindowInfo> = scored
                .into_iter()
                .filter(|(score, _)| *score == top_score)
                .map(|(_, candidate)| candidate)
                .collect();

            if top_matches.len() == 1 {
                MatchResult::Unique(top_matches[0].clone())
            } else {
                MatchResult::Ambiguous(top_matches)
            }
        } else {
            MatchResult::None
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
        if license::require_global_write_access().is_err()
            || !is_valid_note_id(id)
            || !is_valid_note_geometry(rel_x, rel_y, width, height)
        {
            return false;
        }
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                if !can_mutate_note(note) {
                    return false;
                }
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
        if license::require_global_write_access().is_err()
            || !is_valid_note_id(id)
            || !is_valid_note_text(&text)
        {
            return false;
        }
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                if !can_mutate_note(note) {
                    return false;
                }
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
        if license::require_global_write_access().is_err()
            || !is_valid_note_id(id)
            || !is_valid_note_color(&color)
        {
            return false;
        }
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                if !can_mutate_note(note) {
                    return false;
                }
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
        if license::require_global_write_access().is_err() || !is_valid_note_id(id) {
            return None;
        }
        if let Ok(mut state) = self.state.lock() {
            if let Some(note) = state.skribs.get_mut(id) {
                if !can_mutate_note(note) {
                    return None;
                }
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

    fn sample_target_a() -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_val: 1001,
            title: "Document-A.txt - Notepad".into(),
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

    fn sample_target_b() -> TargetWindowInfo {
        TargetWindowInfo {
            hwnd_val: 1002,
            title: "Document-B.txt - Notepad".into(),
            process_name: "notepad.exe".into(),
            class_name: "Notepad".into(),
            bounds: WindowRect {
                x: 200,
                y: 200,
                width: 800,
                height: 600,
            },
            is_minimized: false,
            is_focused: false,
            dpi: 96,
            scale_factor: 1.0,
        }
    }

    fn sample_note() -> SkribNote {
        SkribNote {
            id: "note-a".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document-A.txt".into(),
            rel_x: 20.0,
            rel_y: 30.0,
            width: 320.0,
            height: 230.0,
            text: "Doc A note".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 100,
            updated_at: 100,
            deleted_at: None,
        }
    }

    #[test]
    fn test_ambiguity_safe_matching() {
        let coordinator = Coordinator::new();
        assert!(coordinator.upsert_skrib(sample_note()));

        let candidate_a = sample_target_a();
        let candidate_b = sample_target_b();

        let result =
            coordinator.find_best_context_match(&[candidate_a.clone(), candidate_b.clone()]);
        assert_eq!(result, MatchResult::Unique(candidate_a));
    }

    #[test]
    fn rejects_invalid_note_ids_without_mutating_state() {
        let coordinator = Coordinator::new();
        let mut note = sample_note();
        note.id = "invalid id".into();

        assert!(!coordinator.upsert_skrib(note));
        assert!(coordinator.get_all_skribs().is_empty());
    }

    #[test]
    fn rejects_upserting_pretrashed_frontend_notes() {
        let coordinator = Coordinator::new();
        let mut note = sample_note();
        note.deleted_at = Some(200);

        assert!(!coordinator.upsert_skrib(note));
        assert!(coordinator.get_all_skribs().is_empty());
    }

    #[test]
    fn trash_hides_note_from_context_and_restore_preserves_identity() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        let trashed = coordinator
            .trash_skrib(&note.id, 500)
            .expect("active note should move to trash");
        assert_eq!(trashed.id, note.id);
        assert_eq!(trashed.deleted_at, Some(500));
        assert!(coordinator
            .get_skribs_for_target(&sample_target_a())
            .is_empty());
        assert!(matches!(
            coordinator.find_best_context_match(&[sample_target_a()]),
            MatchResult::None
        ));
        assert_eq!(coordinator.get_active_skribs().len(), 0);
        assert_eq!(coordinator.get_trashed_skribs().len(), 1);

        let restored = coordinator
            .restore_skrib(&note.id, 600)
            .expect("trashed note should restore");
        assert_eq!(restored.id, note.id);
        assert_eq!(restored.text, note.text);
        assert_eq!(restored.deleted_at, None);
        assert_eq!(restored.updated_at, 600);
        assert_eq!(coordinator.get_active_skribs().len(), 1);
        assert_eq!(coordinator.get_trashed_skribs().len(), 0);
    }

    #[test]
    fn lifecycle_operations_fail_closed_for_the_wrong_state() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        assert!(coordinator.restore_skrib(&note.id, 200).is_none());
        assert!(coordinator.permanently_delete_skrib(&note.id).is_none());
        assert!(coordinator.trash_skrib(&note.id, 0).is_none());

        coordinator
            .trash_skrib(&note.id, 300)
            .expect("trash should succeed once");
        assert!(coordinator.trash_skrib(&note.id, 301).is_none());
        assert!(!coordinator.update_skrib_text(&note.id, "Changed".into()));
        assert!(!coordinator.update_skrib_color(&note.id, "mint".into()));
        assert!(coordinator.toggle_skrib_collapse(&note.id).is_none());
    }

    #[test]
    fn permanent_delete_is_available_only_after_trash() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));
        assert!(coordinator.permanently_delete_skrib(&note.id).is_none());

        coordinator
            .trash_skrib(&note.id, 300)
            .expect("trash should succeed");
        let deleted = coordinator
            .permanently_delete_skrib(&note.id)
            .expect("trashed note should delete permanently");
        assert_eq!(deleted.id, note.id);
        assert!(coordinator.get_all_skribs().is_empty());
    }

    #[test]
    fn empty_discard_never_removes_nonempty_or_trashed_notes() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));
        assert!(coordinator.discard_empty_skrib(&note.id).is_none());

        assert!(coordinator.update_skrib_text(&note.id, "   ".into()));
        let discarded = coordinator
            .discard_empty_skrib(&note.id)
            .expect("whitespace-only active note should discard");
        assert_eq!(discarded.id, note.id);

        let mut trashed_empty = sample_note();
        trashed_empty.id = "trashed-empty".into();
        trashed_empty.text.clear();
        assert!(coordinator.upsert_skrib(trashed_empty.clone()));
        coordinator
            .trash_skrib(&trashed_empty.id, 400)
            .expect("empty note can be explicitly trashed");
        assert!(coordinator.discard_empty_skrib(&trashed_empty.id).is_none());
    }

    #[test]
    fn rejects_oversized_unicode_text_and_preserves_previous_value() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        let oversized = "📝".repeat(MAX_NOTE_CHARACTERS + 1);
        assert!(!coordinator.update_skrib_text(&note.id, oversized));

        let stored = coordinator
            .get_all_skribs()
            .into_iter()
            .find(|candidate| candidate.id == note.id)
            .expect("sample note should remain available");
        assert_eq!(stored.text, note.text);
    }

    #[test]
    fn accepts_text_at_the_unicode_character_limit() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        let maximum = "é".repeat(MAX_NOTE_CHARACTERS);
        assert!(coordinator.update_skrib_text(&note.id, maximum.clone()));

        let stored = coordinator
            .get_all_skribs()
            .into_iter()
            .find(|candidate| candidate.id == note.id)
            .expect("sample note should remain available");
        assert_eq!(stored.text, maximum);
    }

    #[test]
    fn rejects_non_finite_or_invalid_geometry_without_mutating_state() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        assert!(!coordinator.update_skrib_position(
            &note.id,
            f64::NAN,
            note.rel_y,
            note.width,
            note.height,
        ));
        assert!(!coordinator.update_skrib_position(
            &note.id,
            note.rel_x,
            f64::INFINITY,
            note.width,
            note.height,
        ));
        assert!(!coordinator.update_skrib_position(
            &note.id,
            note.rel_x,
            note.rel_y,
            0.0,
            note.height,
        ));

        let stored = coordinator
            .get_all_skribs()
            .into_iter()
            .find(|candidate| candidate.id == note.id)
            .expect("sample note should remain available");
        assert_eq!(stored.rel_x, note.rel_x);
        assert_eq!(stored.rel_y, note.rel_y);
        assert_eq!(stored.width, note.width);
        assert_eq!(stored.height, note.height);
    }

    #[test]
    fn rejects_unsupported_colors_without_mutating_state() {
        let coordinator = Coordinator::new();
        let note = sample_note();
        assert!(coordinator.upsert_skrib(note.clone()));

        assert!(!coordinator.update_skrib_color(&note.id, "transparent".into()));

        let stored = coordinator
            .get_all_skribs()
            .into_iter()
            .find(|candidate| candidate.id == note.id)
            .expect("sample note should remain available");
        assert_eq!(stored.color, note.color);
    }
}
