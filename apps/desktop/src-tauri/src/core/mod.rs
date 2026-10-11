//! Shared product logic belongs here: Skrib models, context matching,
//! persistence, licensing, reminders, and overlay coordination.

pub mod account;
pub mod coordinator;
pub(crate) mod durable_state;
pub mod license;
pub mod models;
pub(crate) mod note_colors;
pub mod notes;
pub mod preferences;
pub mod storage;
