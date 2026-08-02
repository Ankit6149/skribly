//! Bounded, privacy-safe delivery for Windows accessibility events.
//!
//! The native callback performs only scalar filtering, duplicate detection, atomic counters, and
//! a non-blocking `try_send`. Window titles, process names, geometry, and all other expensive or
//! sensitive inspection remain in the consumer thread.

use std::collections::HashSet;
use std::sync::atomic::{AtomicIsize, AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;

pub const EVENT_SYSTEM_FOREGROUND: u32 = 0x0003;
pub const EVENT_SYSTEM_MINIMIZESTART: u32 = 0x0016;
pub const EVENT_SYSTEM_MINIMIZEEND: u32 = 0x0017;
pub const EVENT_OBJECT_DESTROY: u32 = 0x8001;
pub const EVENT_OBJECT_LOCATIONCHANGE: u32 = 0x800B;
pub const OBJID_WINDOW_VALUE: i32 = 0;
pub const CHILDID_SELF_VALUE: i32 = 0;
pub const WIN_EVENT_QUEUE_CAPACITY: usize = 64;

static GLOBAL_PIPELINE: OnceLock<WinEventPipeline> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum WinEventClass {
    Foreground,
    TargetMinimizeStart,
    TargetMinimizeEnd,
    TargetDestroyed,
    TargetLocation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct WinEventKey {
    class: WinEventClass,
    hwnd_val: isize,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WinEventMetrics {
    pub capacity: usize,
    pub pending: usize,
    pub received: u64,
    pub filtered: u64,
    pub forwarded: u64,
    pub coalesced: u64,
    pub saturated: u64,
    pub disconnected: u64,
    pub processed: u64,
}

struct WinEventPipelineInner {
    sender: SyncSender<WinEventNotice>,
    capacity: usize,
    active_target_hwnd: AtomicIsize,
    pending: Mutex<HashSet<WinEventKey>>,
    received: AtomicU64,
    filtered: AtomicU64,
    forwarded: AtomicU64,
    coalesced: AtomicU64,
    saturated: AtomicU64,
    disconnected: AtomicU64,
    processed: AtomicU64,
}

#[derive(Clone)]
pub struct WinEventPipeline {
    inner: Arc<WinEventPipelineInner>,
}

pub struct WinEventNotice {
    pub event_type: u32,
    pub hwnd_val: isize,
    key: WinEventKey,
    pipeline: WinEventPipeline,
    processing_started: bool,
}

impl WinEventNotice {
    pub fn mark_processing_started(&mut self) {
        self.processing_started = true;
    }
}

impl Drop for WinEventNotice {
    fn drop(&mut self) {
        if let Ok(mut pending) = self.pipeline.inner.pending.lock() {
            pending.remove(&self.key);
        }
        if self.processing_started {
            self.pipeline
                .inner
                .processed
                .fetch_add(1, Ordering::Relaxed);
        }
    }
}

impl WinEventPipeline {
    pub fn new(capacity: usize) -> (Self, Receiver<WinEventNotice>) {
        let capacity = capacity.max(1);
        let (sender, receiver) = sync_channel(capacity);
        let pipeline = Self {
            inner: Arc::new(WinEventPipelineInner {
                sender,
                capacity,
                active_target_hwnd: AtomicIsize::new(0),
                pending: Mutex::new(HashSet::with_capacity(capacity)),
                received: AtomicU64::new(0),
                filtered: AtomicU64::new(0),
                forwarded: AtomicU64::new(0),
                coalesced: AtomicU64::new(0),
                saturated: AtomicU64::new(0),
                disconnected: AtomicU64::new(0),
                processed: AtomicU64::new(0),
            }),
        };
        (pipeline, receiver)
    }

    pub fn set_active_target(&self, hwnd_val: Option<isize>) {
        self.inner
            .active_target_hwnd
            .store(hwnd_val.unwrap_or(0), Ordering::Release);
    }

    pub fn metrics(&self) -> WinEventMetrics {
        let pending = self
            .inner
            .pending
            .lock()
            .map(|pending| pending.len())
            .unwrap_or(self.inner.capacity);
        WinEventMetrics {
            capacity: self.inner.capacity,
            pending,
            received: self.inner.received.load(Ordering::Relaxed),
            filtered: self.inner.filtered.load(Ordering::Relaxed),
            forwarded: self.inner.forwarded.load(Ordering::Relaxed),
            coalesced: self.inner.coalesced.load(Ordering::Relaxed),
            saturated: self.inner.saturated.load(Ordering::Relaxed),
            disconnected: self.inner.disconnected.load(Ordering::Relaxed),
            processed: self.inner.processed.load(Ordering::Relaxed),
        }
    }

    pub fn install_global(&self) -> bool {
        if GLOBAL_PIPELINE.get().is_some() {
            return true;
        }
        GLOBAL_PIPELINE.set(self.clone()).is_ok()
    }

    pub fn deliver_raw(&self, event_type: u32, hwnd_val: isize, id_object: i32, id_child: i32) {
        self.inner.received.fetch_add(1, Ordering::Relaxed);

        let active_target_hwnd = self.inner.active_target_hwnd.load(Ordering::Acquire);
        let Some(class) = classify_event(
            event_type,
            hwnd_val,
            id_object,
            id_child,
            active_target_hwnd,
        ) else {
            self.inner.filtered.fetch_add(1, Ordering::Relaxed);
            return;
        };

        let key = WinEventKey { class, hwnd_val };
        {
            let Ok(mut pending) = self.inner.pending.try_lock() else {
                self.inner.saturated.fetch_add(1, Ordering::Relaxed);
                return;
            };
            if pending.contains(&key) {
                self.inner.coalesced.fetch_add(1, Ordering::Relaxed);
                return;
            }
            pending.insert(key);
        }

        let notice = WinEventNotice {
            event_type,
            hwnd_val,
            key,
            pipeline: self.clone(),
            processing_started: false,
        };
        match self.inner.sender.try_send(notice) {
            Ok(()) => {
                self.inner.forwarded.fetch_add(1, Ordering::Relaxed);
            }
            Err(TrySendError::Full(notice)) => {
                self.inner.saturated.fetch_add(1, Ordering::Relaxed);
                drop(notice);
            }
            Err(TrySendError::Disconnected(notice)) => {
                self.inner.disconnected.fetch_add(1, Ordering::Relaxed);
                drop(notice);
            }
        }
    }
}

fn classify_event(
    event_type: u32,
    hwnd_val: isize,
    id_object: i32,
    id_child: i32,
    active_target_hwnd: isize,
) -> Option<WinEventClass> {
    if hwnd_val == 0 || id_object != OBJID_WINDOW_VALUE || id_child != CHILDID_SELF_VALUE {
        return None;
    }

    match event_type {
        EVENT_SYSTEM_FOREGROUND => Some(WinEventClass::Foreground),
        EVENT_SYSTEM_MINIMIZESTART if hwnd_val == active_target_hwnd && active_target_hwnd != 0 => {
            Some(WinEventClass::TargetMinimizeStart)
        }
        EVENT_SYSTEM_MINIMIZEEND if hwnd_val == active_target_hwnd && active_target_hwnd != 0 => {
            Some(WinEventClass::TargetMinimizeEnd)
        }
        EVENT_OBJECT_DESTROY if hwnd_val == active_target_hwnd && active_target_hwnd != 0 => {
            Some(WinEventClass::TargetDestroyed)
        }
        EVENT_OBJECT_LOCATIONCHANGE
            if hwnd_val == active_target_hwnd && active_target_hwnd != 0 =>
        {
            Some(WinEventClass::TargetLocation)
        }
        _ => None,
    }
}

pub fn deliver_global_win_event(event_type: u32, hwnd_val: isize, id_object: i32, id_child: i32) {
    if let Some(pipeline) = GLOBAL_PIPELINE.get() {
        pipeline.deliver_raw(event_type, hwnd_val, id_object, id_child);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::TryRecvError;

    #[test]
    fn filters_child_object_and_unrelated_target_events_before_delivery() {
        let (pipeline, receiver) = WinEventPipeline::new(8);
        pipeline.set_active_target(Some(100));

        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 1, 0);
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 0, 1);
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 200, 0, 0);

        assert!(matches!(receiver.try_recv(), Err(TryRecvError::Empty)));
        let metrics = pipeline.metrics();
        assert_eq!(metrics.received, 3);
        assert_eq!(metrics.filtered, 3);
        assert_eq!(metrics.forwarded, 0);
        assert_eq!(metrics.pending, 0);
    }

    #[test]
    fn forwards_top_level_foreground_and_current_target_events() {
        let (pipeline, receiver) = WinEventPipeline::new(8);
        pipeline.set_active_target(Some(100));

        pipeline.deliver_raw(EVENT_SYSTEM_FOREGROUND, 200, 0, 0);
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 0, 0);

        let mut foreground = receiver.try_recv().expect("foreground notice");
        foreground.mark_processing_started();
        assert_eq!(foreground.event_type, EVENT_SYSTEM_FOREGROUND);
        drop(foreground);

        let mut location = receiver.try_recv().expect("location notice");
        location.mark_processing_started();
        assert_eq!(location.hwnd_val, 100);
        drop(location);

        let metrics = pipeline.metrics();
        assert_eq!(metrics.forwarded, 2);
        assert_eq!(metrics.processed, 2);
        assert_eq!(metrics.pending, 0);
    }

    #[test]
    fn coalesces_duplicate_notices_while_the_first_is_pending() {
        let (pipeline, receiver) = WinEventPipeline::new(8);
        pipeline.set_active_target(Some(100));

        for _ in 0..10_000 {
            pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 0, 0);
        }

        let metrics = pipeline.metrics();
        assert_eq!(metrics.received, 10_000);
        assert_eq!(metrics.forwarded, 1);
        assert_eq!(metrics.coalesced, 9_999);
        assert_eq!(metrics.pending, 1);

        drop(receiver.try_recv().expect("coalesced notice"));
        assert_eq!(pipeline.metrics().pending, 0);
    }

    #[test]
    fn queue_saturation_is_bounded_and_non_blocking() {
        let (pipeline, receiver) = WinEventPipeline::new(2);
        pipeline.set_active_target(Some(100));

        pipeline.deliver_raw(EVENT_SYSTEM_FOREGROUND, 201, 0, 0);
        pipeline.deliver_raw(EVENT_SYSTEM_FOREGROUND, 202, 0, 0);
        pipeline.deliver_raw(EVENT_SYSTEM_FOREGROUND, 203, 0, 0);

        let metrics = pipeline.metrics();
        assert_eq!(metrics.capacity, 2);
        assert_eq!(metrics.forwarded, 2);
        assert_eq!(metrics.saturated, 1);
        assert_eq!(metrics.pending, 2);

        drop(receiver.try_recv().expect("first bounded notice"));
        drop(receiver.try_recv().expect("second bounded notice"));
        assert_eq!(pipeline.metrics().pending, 0);
    }

    #[test]
    fn dropping_the_receiver_releases_pending_keys_and_counts_disconnects() {
        let (pipeline, receiver) = WinEventPipeline::new(2);
        drop(receiver);

        pipeline.deliver_raw(EVENT_SYSTEM_FOREGROUND, 201, 0, 0);

        let metrics = pipeline.metrics();
        assert_eq!(metrics.disconnected, 1);
        assert_eq!(metrics.pending, 0);
    }

    #[test]
    fn changing_the_active_target_changes_callback_filtering_immediately() {
        let (pipeline, receiver) = WinEventPipeline::new(8);
        pipeline.set_active_target(Some(100));
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 0, 0);
        drop(receiver.try_recv().expect("old target notice"));

        pipeline.set_active_target(Some(200));
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 100, 0, 0);
        pipeline.deliver_raw(EVENT_OBJECT_LOCATIONCHANGE, 200, 0, 0);

        let notice = receiver.try_recv().expect("new target notice");
        assert_eq!(notice.hwnd_val, 200);
        assert!(matches!(receiver.try_recv(), Err(TryRecvError::Empty)));
    }
}
