# Shared frontend code

Only code that is genuinely cross-feature belongs here.

- `hooks/` — reusable React hooks with no product-domain ownership;
- `native/` — small frontend helpers for Tauri/native-window interaction.

Do not move feature rules here merely because more than one component uses them. Notes, reminders, widgets, account and licensing keep their own domain logic.
