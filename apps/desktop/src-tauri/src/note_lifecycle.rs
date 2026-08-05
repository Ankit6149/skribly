use crate::core::models::SkribNote;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OpenNoteAction {
    Created,
    Reopened,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenNoteRequest {
    pub action: OpenNoteAction,
    pub note_id: String,
    pub matching_note_count: usize,
}

pub fn created_open_request(note_id: String) -> OpenNoteRequest {
    OpenNoteRequest {
        action: OpenNoteAction::Created,
        note_id,
        matching_note_count: 0,
    }
}

pub fn reopened_open_request(mut notes: Vec<SkribNote>) -> Option<OpenNoteRequest> {
    let matching_note_count = notes.len();
    notes.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });

    notes.into_iter().next().map(|note| OpenNoteRequest {
        action: OpenNoteAction::Reopened,
        note_id: note.id,
        matching_note_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str, created_at: u64, updated_at: u64) -> SkribNote {
    deleted_at: None,
        SkribNote {
            id: id.into(),
            target_process_name: "notepad.exe".into(),
            target_title: "Document.txt - Notepad".into(),
            rel_x: 0.0,
            rel_y: 0.0,
            width: 400.0,
            height: 340.0,
            text: id.into(),
            color: "yellow".into(),
            collapsed: false,
            created_at,
            updated_at,
        }
    }

    #[test]
    fn zero_matches_require_creation() {
        assert_eq!(reopened_open_request(Vec::new()), None);
    }

    #[test]
    fn one_match_reopens_that_note() {
        assert_eq!(
            reopened_open_request(vec![note("note-a", 1, 2)]),
            Some(OpenNoteRequest {
                action: OpenNoteAction::Reopened,
                note_id: "note-a".into(),
                matching_note_count: 1,
            })
        );
    }

    #[test]
    fn many_matches_reopen_the_most_recent_note() {
        assert_eq!(
            reopened_open_request(vec![
                note("older", 1, 10),
                note("newest", 2, 30),
                note("middle", 3, 20),
            ]),
            Some(OpenNoteRequest {
                action: OpenNoteAction::Reopened,
                note_id: "newest".into(),
                matching_note_count: 3,
            })
        );
    }

    #[test]
    fn ties_are_stable_across_hash_map_iteration_order() {
        let first = reopened_open_request(vec![note("note-b", 5, 10), note("note-a", 5, 10)]);
        let second = reopened_open_request(vec![note("note-a", 5, 10), note("note-b", 5, 10)]);

        assert_eq!(first, second);
        assert_eq!(first.expect("a note should be selected").note_id, "note-a");
    }

    #[test]
    fn created_request_records_zero_previous_matches() {
        assert_eq!(
            created_open_request("new-note".into()),
            OpenNoteRequest {
                action: OpenNoteAction::Created,
                note_id: "new-note".into(),
                matching_note_count: 0,
            }
        );
    }
}
