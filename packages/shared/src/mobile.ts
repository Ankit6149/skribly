/** Mobile-only local notes. This is not the desktop record or a sync protocol. */
export const mobileColours = [
  "yellow",
  "peach",
  "mint",
  "sky",
  "lavender",
  "rose",
  "aqua",
  "sand",
] as const;
export type MobileColour = (typeof mobileColours)[number];
export interface MobileNote {
  schemaVersion: 1;
  id: string;
  text: string;
  colour: MobileColour;
  createdAt: number;
  updatedAt: number;
  revision: number;
  trashedAt: number | null;
}
export const androidFoundationCapabilities = Object.freeze({
  localText: true,
  search: true,
  reversibleTrash: true,
  desktopWindowContext: false,
  overlay: false,
  cloudSync: false,
  shareTarget: false,
  attachments: false,
  ink: false,
  notifications: false,
  payments: false,
});
export const mobileTextLimit = 100_000;
export function isMobileNote(value: unknown): value is MobileNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return (
    note.schemaVersion === 1 &&
    typeof note.id === "string" &&
    note.id.length > 0 &&
    note.id.length <= 100 &&
    typeof note.text === "string" &&
    note.text.length <= mobileTextLimit &&
    mobileColours.includes(note.colour as MobileColour) &&
    Number.isSafeInteger(note.createdAt) &&
    (note.createdAt as number) >= 0 &&
    Number.isSafeInteger(note.updatedAt) &&
    (note.updatedAt as number) >= (note.createdAt as number) &&
    Number.isSafeInteger(note.revision) &&
    (note.revision as number) >= 1 &&
    (note.trashedAt === null ||
      (Number.isSafeInteger(note.trashedAt) && (note.trashedAt as number) >= 0))
  );
}
export function mobileNoteTitle(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim())
      ?.trim()
      .slice(0, 100) || "Untitled Skrib"
  );
}
