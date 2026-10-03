import { describe, expect, it } from "vitest";
import {
  androidFoundationCapabilities,
  isMobileNote,
  mobileNoteTitle,
  type MobileNote,
} from "@skribly/shared";

const valid: MobileNote = {
  schemaVersion: 1,
  id: "synthetic-note",
  text: "A thought\nMore detail",
  colour: "yellow",
  createdAt: 10,
  updatedAt: 20,
  revision: 1,
  trashedAt: null,
};
describe("mobile note contract", () => {
  it("accepts current records and reversible Trash", () => {
    expect(isMobileNote(valid)).toBe(true);
    expect(isMobileNote({ ...valid, trashedAt: 25, revision: 2 })).toBe(true);
  });
  it.each([
    { schemaVersion: 2 },
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
  it("does not pretend to have desktop/sync/OS capabilities", () => {
    expect(androidFoundationCapabilities.cloudSync).toBe(false);
    expect(androidFoundationCapabilities.overlay).toBe(false);
    expect(androidFoundationCapabilities.shareTarget).toBe(false);
  });
});
