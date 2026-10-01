//! Paint acknowledgement and cancellable native reveal for the global shelf.

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum Phase {
    #[default]
    Stable,
    Paint(bool),
    Revealing,
    Closing,
}

#[derive(Debug, Default)]
pub struct RailPresentation {
    generation: u64,
    phase: Phase,
}

impl RailPresentation {
    pub fn prepare(&mut self, expanded: bool) -> u64 {
        self.generation = self.generation.wrapping_add(1);
        self.phase = Phase::Paint(expanded);
        self.generation
    }

    pub fn begin_close(&mut self) -> Option<u64> {
        if self.phase == Phase::Closing {
            return None;
        }
        self.generation = self.generation.wrapping_add(1);
        self.phase = Phase::Closing;
        Some(self.generation)
    }

    pub fn pending_paint(&self) -> Option<u64> {
        matches!(self.phase, Phase::Paint(_)).then_some(self.generation)
    }

    pub fn acknowledge(&mut self, generation: u64) -> Option<bool> {
        if !self.is_current(generation) {
            return None;
        }
        let Phase::Paint(expanded) = self.phase else {
            return None;
        };
        self.phase = if expanded {
            Phase::Revealing
        } else {
            Phase::Stable
        };
        Some(expanded)
    }

    pub fn is_current(&self, generation: u64) -> bool {
        self.generation == generation
    }
    pub fn is_busy(&self) -> bool {
        self.phase != Phase::Stable
    }
    pub fn is_closing(&self) -> bool {
        self.phase == Phase::Closing
    }
    pub fn cancel(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        self.phase = Phase::Stable;
    }

    pub fn finish_open(&mut self, generation: u64) -> bool {
        if !self.is_current(generation) || self.phase != Phase::Revealing {
            return false;
        }
        self.phase = Phase::Stable;
        true
    }

    pub fn finish_close(&mut self, generation: u64) -> bool {
        if !self.is_current(generation) || self.phase != Phase::Closing {
            return false;
        }
        self.phase = Phase::Paint(false);
        true
    }
}

/// Absolute progress, not frame count: a missed frame never extends the animation.
pub fn reveal_width(full_width: u32, start_width: u32, opening: bool, progress: f64) -> u32 {
    let t = progress.clamp(0.0, 1.0);
    let ease = if opening {
        1.0 - (1.0 - t).powi(3)
    } else {
        t * t * (3.0 - 2.0 * t)
    };
    let width = if opening {
        full_width as f64 * ease
    } else {
        start_width as f64 * (1.0 - ease)
    };
    (width.round() as u32).min(full_width)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opening_requires_current_paint_and_can_only_be_acknowledged_once() {
        let mut state = RailPresentation::default();
        let old = state.prepare(true);
        let current = state.prepare(false);
        assert_eq!(state.acknowledge(old), None);
        assert_eq!(state.pending_paint(), Some(current));
        assert_eq!(state.acknowledge(current), Some(false));
        assert_eq!(state.acknowledge(current), None);
        assert!(!state.is_busy());
    }

    #[test]
    fn a_new_open_invalidates_delayed_close_completion_and_paint() {
        let mut state = RailPresentation::default();
        let closing = state.begin_close().unwrap();
        assert_eq!(state.begin_close(), None);
        let opening = state.prepare(true);
        assert!(!state.finish_close(closing));
        assert_eq!(state.acknowledge(closing), None);
        assert_eq!(state.acknowledge(opening), Some(true));
        assert!(state.is_busy());
        assert!(state.finish_open(opening));
        assert!(!state.is_busy());
    }

    #[test]
    fn closing_waits_for_compact_paint_before_becoming_stable() {
        let mut state = RailPresentation::default();
        let closing = state.begin_close().unwrap();
        assert!(state.finish_close(closing));
        assert_eq!(state.pending_paint(), Some(closing));
        assert!(state.is_busy());
        assert_eq!(state.acknowledge(closing), Some(false));
        assert!(!state.is_busy());
    }

    #[test]
    fn reveal_is_monotonic_bounded_and_retracts_from_the_actual_partial_width() {
        for full in [388, 485, 776] {
            let mut previous = 0;
            for frame in 0..=60 {
                let next = reveal_width(full, 0, true, frame as f64 / 60.0);
                assert!(next >= previous && next <= full);
                previous = next;
            }
            assert_eq!(previous, full);
            let mut previous = full / 3;
            for frame in 0..=60 {
                let next = reveal_width(full, full / 3, false, frame as f64 / 60.0);
                assert!(next <= previous);
                previous = next;
            }
            assert_eq!(previous, 0);
        }
    }
}
