/**
 * Platform-neutral Skrib records used by mobile today and by a future desktop
 * import/sync adapter. A missing context means a general Skrib and must not be
 * rendered as though it belongs to an application.
 */
export const mobileColours = [
  "yellow", "peach", "mint", "sky", "lavender", "rose", "aqua", "sand",
] as const;

export type MobileColour = (typeof mobileColours)[number];
export type SharedReminderRepeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface SharedSkribContext {
  schemaVersion: 1;
  kind: "application" | "link" | "file";
  label: string;
  applicationId: string | null;
  locator: string | null;
}

export interface SharedReminder {
  schemaVersion: 1;
  id: string;
  title: string;
  dueAt: number;
  repeat: SharedReminderRepeat;
  repeatAnchorDay: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  dismissedAt: number | null;
  notifiedAt: number | null;
}

export interface SharedSkrib {
  schemaVersion: 2;
  documentType: "skrib";
  id: string;
  text: string;
  colour: MobileColour;
  context: SharedSkribContext | null;
  reminder: SharedReminder | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
  archivedAt: number | null;
  trashedAt: number | null;
}

/** Compatibility name retained while Android callers move to SharedSkrib. */
export type MobileNote = SharedSkrib;

export interface LegacyMobileNoteV1 {
  schemaVersion: 1;
  id: string;
  text: string;
  colour: MobileColour;
  createdAt: number;
  updatedAt: number;
  revision: number;
  trashedAt: number | null;
}

export const androidCompanionCapabilities = Object.freeze({
  localText: true,
  search: true,
  reversibleTrash: true,
  reminders: true,
  sharedRecordContract: true,
  encryptedSyncContract: true,
  desktopContextDisplay: true,
  desktopWindowContextCapture: false,
  overlay: false,
  cloudSync: false,
  shareTarget: false,
  attachments: false,
  ink: false,
  notifications: false,
  payments: false,
});

/** @deprecated Prefer androidCompanionCapabilities. */
export const androidFoundationCapabilities = androidCompanionCapabilities;

export const mobileTextLimit = 100_000;
const idLimit = 100;
const titleLimit = 200;
const contextLabelLimit = 500;
const locatorLimit = 2_048;
const repeats = new Set<SharedReminderRepeat>(["none", "daily", "weekdays", "weekly", "monthly"]);

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= idLimit;
}

function validTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validOptionalTimestamp(value: unknown): value is number | null {
  return value === null || validTimestamp(value);
}

export function isSharedSkribContext(value: unknown): value is SharedSkribContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Record<string, unknown>;
  return (
    context.schemaVersion === 1 &&
    ["application", "link", "file"].includes(context.kind as string) &&
    typeof context.label === "string" &&
    context.label.trim().length > 0 &&
    context.label.length <= contextLabelLimit &&
    (context.applicationId === null ||
      (typeof context.applicationId === "string" && context.applicationId.length <= contextLabelLimit)) &&
    (context.locator === null ||
      (typeof context.locator === "string" && context.locator.length <= locatorLimit))
  );
}

export function isSharedReminder(value: unknown): value is SharedReminder {
  if (!value || typeof value !== "object") return false;
  const reminder = value as Record<string, unknown>;
  return (
    reminder.schemaVersion === 1 &&
    validId(reminder.id) &&
    typeof reminder.title === "string" &&
    reminder.title.length <= titleLimit &&
    validTimestamp(reminder.dueAt) &&
    repeats.has(reminder.repeat as SharedReminderRepeat) &&
    (reminder.repeatAnchorDay === null ||
      (Number.isInteger(reminder.repeatAnchorDay) &&
        (reminder.repeatAnchorDay as number) >= 1 &&
        (reminder.repeatAnchorDay as number) <= 31)) &&
    validTimestamp(reminder.createdAt) &&
    validTimestamp(reminder.updatedAt) &&
    (reminder.updatedAt as number) >= (reminder.createdAt as number) &&
    validOptionalTimestamp(reminder.completedAt) &&
    validOptionalTimestamp(reminder.dismissedAt) &&
    validOptionalTimestamp(reminder.notifiedAt)
  );
}

export function isMobileNote(value: unknown): value is SharedSkrib {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return (
    note.schemaVersion === 2 &&
    note.documentType === "skrib" &&
    validId(note.id) &&
    typeof note.text === "string" &&
    note.text.length <= mobileTextLimit &&
    mobileColours.includes(note.colour as MobileColour) &&
    (note.context === null || isSharedSkribContext(note.context)) &&
    (note.reminder === null || isSharedReminder(note.reminder)) &&
    validTimestamp(note.createdAt) &&
    validTimestamp(note.updatedAt) &&
    (note.updatedAt as number) >= (note.createdAt as number) &&
    Number.isSafeInteger(note.revision) &&
    (note.revision as number) >= 1 &&
    validOptionalTimestamp(note.archivedAt) &&
    validOptionalTimestamp(note.trashedAt)
  );
}

export function isLegacyMobileNote(value: unknown): value is LegacyMobileNoteV1 {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return (
    note.schemaVersion === 1 &&
    validId(note.id) &&
    typeof note.text === "string" &&
    note.text.length <= mobileTextLimit &&
    mobileColours.includes(note.colour as MobileColour) &&
    validTimestamp(note.createdAt) &&
    validTimestamp(note.updatedAt) &&
    (note.updatedAt as number) >= (note.createdAt as number) &&
    Number.isSafeInteger(note.revision) &&
    (note.revision as number) >= 1 &&
    validOptionalTimestamp(note.trashedAt)
  );
}

export function migrateLegacyMobileNote(note: LegacyMobileNoteV1): SharedSkrib {
  return {
    schemaVersion: 2,
    documentType: "skrib",
    id: note.id,
    text: note.text,
    colour: note.colour,
    context: null,
    reminder: null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    revision: note.revision,
    archivedAt: null,
    trashedAt: note.trashedAt,
  };
}

export function mobileNoteTitle(text: string): string {
  return text.split("\n").find((line) => line.trim())?.trim().slice(0, 100) || "Untitled Skrib";
}

export function createSharedReminder(
  dueAt: number,
  repeat: SharedReminderRepeat = "none",
  title = "",
  now = Date.now(),
  id: string = crypto.randomUUID(),
): SharedReminder {
  return {
    schemaVersion: 1,
    id,
    title: title.slice(0, titleLimit),
    dueAt,
    repeat,
    repeatAnchorDay: repeat === "monthly" ? new Date(dueAt).getDate() : null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    dismissedAt: null,
    notifiedAt: null,
  };
}
