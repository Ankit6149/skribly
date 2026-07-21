use crate::core::models::{HitTestRect, SkribNote, TargetWindowInfo};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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

    pub fn find_best_context_match(&self, candidates: &[TargetWindowInfo]) -> MatchResult {
        if let Ok(state) = self.state.lock() {
            if state.skribs.is_empty() {
                return MatchResult::None;
            }

            let mut scored: Vec<(u32, TargetWindowInfo)> = Vec::new();
            for cand in candidates {
                let max_score = state
                    .skribs
                    .values()
                    .map(|note| cand.match_score(&note.target_process_name, &note.target_title))
                    .max()
                    .unwrap_or(0);

                if max_score >= 50 {
                    scored.push((max_score, cand.clone()));
                }
            }

            if scored.is_empty() {
                return MatchResult::None;
            }

            // Sort by score descending
            scored.sort_by(|a, b| b.0.cmp(&a.0));

            let top_score = scored[0].0;
            let top_matches: Vec<TargetWindowInfo> = scored
                .into_iter()
                .filter(|(s, _)| *s == top_score)
                .map(|(_, cand)| cand)
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

    #[test]
    fn test_ambiguity_safe_matching() {
        let coordinator = Coordinator::new();
        let note = SkribNote {
            id: "note-a".into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document-A.txt".into(),
            rel_x: 20.0,
            rel_y: 30.0,
            width: 200.0,
            height: 150.0,
            text: "Doc A note".into(),
            color: "yellow".into(),
            collapsed: false,
            created_at: 100,
            updated_at: 100,
        };

        coordinator.upsert_skrib(note);

        let cand_a = sample_target_a();
        let cand_b = sample_target_b();

        let res = coordinator.find_best_context_match(&[cand_a.clone(), cand_b.clone()]);
        assert_eq!(res, MatchResult::Unique(cand_a));
    }
}
