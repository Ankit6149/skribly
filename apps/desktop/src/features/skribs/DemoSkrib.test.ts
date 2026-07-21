import { describe, expect, it } from "vitest";

import { DEFAULT_SKRIB_TEXT } from "./DemoSkrib";

describe("DemoSkrib", () => {
  it("starts with contextual copy", () => {
    expect(DEFAULT_SKRIB_TEXT).toContain("context");
  });
});
