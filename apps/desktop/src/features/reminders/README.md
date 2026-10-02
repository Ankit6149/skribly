# Reminders feature

This directory is the canonical home for reminder-specific frontend behavior.

Current ownership:

- `components/` — reminder editing UI used by the note composer;
- `model/` — calendar/date and repeat models;
- `persistence/` — reminder IndexedDB repository;
- `notifications/` — permission, delivery, and due-reminder monitoring.

Reminder code should not be added back to the Notes compatibility surface.
