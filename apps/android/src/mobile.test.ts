import { describe, expect, it } from "vitest";
import {
  androidCompanionCapabilities,
  createSharedReminder,
  isMobileNote,
  isSharedReminder,
  migrateLegacyMobileNote,
  mobileNoteTitle,
  type MobileNote,
} from "@skribly/shared";

const valid: MobileNote = {
  schemaVersion: 2,
  documentType: "skrib",
  id: "synthetic-note",
  text: "A thought\nMore detail",
  colour: "yellow",
  context: null,
  reminder: null,
  createdAt: 10,
  updatedAt: 20,
  revision: 1,
  archivedAt: null,
  trashedAt: null,
};
describe("mobile note contract", () => {
  it("accepts current records and reversible Trash", () => {
    expect(isMobileNote(valid)).toBe(true);
    expect(isMobileNote({ ...valid, trashedAt: 25, revision: 2 })).toBe(true);
  });
  it.each([
    { schemaVersion: 3 },
    { documentType: "attachment" },
    { colour: "unknown" },
    { revision: 0 },
    { updatedAt: 9 },
    { trashedAt: -1 },
    { createdAt: NaN },
    { id: "" },
  ])("rejects unsafe/future records %j", (patch) => {
    expect(isMobileNote({ ...valid, ...patch })).toBe(false);
  });
  it("rejects oversized text", () =>
    expect(isMobileNote({ ...valid, text: "x".repeat(100_001) })).toBe(false));
  it("derives a title without rendering HTML", () => {
    expect(mobileNoteTitle("\n Hello\nThere")).toBe("Hello");
    expect(mobileNoteTitle("<script>hello</script>")).toBe(
      "<script>hello</script>",
    );
    expect(mobileNoteTitle("  \n ")).toBe("Untitled Skrib");
  });
  it("migrates v1 mobile records without inventing context", () => {
    expect(
      migrateLegacyMobileNote({
        schemaVersion: 1,
        id: "legacy",
        text: "Kept",
        colour: "mint",
        createdAt: 10,
        updatedAt: 20,
        revision: 4,
        trashedAt: null,
      }),
    ).toMatchObject({
      schemaVersion: 2,
      documentType: "skrib",
      context: null,
      reminder: null,
      archivedAt: null,
      revision: 4,
    });
  });
  it("validates portable reminder metadata", () => {
    const reminder = createSharedReminder(2_000, "monthly", "Review", 1_000, "reminder-1");
    expect(isSharedReminder(reminder)).toBe(true);
    expect(reminder.repeatAnchorDay).toBe(new Date(2_000).getDate());
    expect(isMobileNote({ ...valid, reminder })).toBe(true);
    expect(isSharedReminder({ ...reminder, dueAt: -1 })).toBe(false);
  });
  it("declares implemented companion boundaries truthfully", () => {
    expect(androidCompanionCapabilities.reminders).toBe(true);
    expect(androidCompanionCapabilities.encryptedSyncContract).toBe(true);
    expect(androidCompanionCapabilities.cloudSync).toBe(false);
    expect(androidCompanionCapabilities.notifications).toBe(false);
    expect(androidCompanionCapabilities.overlay).toBe(false);
  });
});
