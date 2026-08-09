import { describe, it, expect } from "vitest";
import { isAtItemLimit } from "../../lib/items";

describe("isAtItemLimit", () => {
  it("is false when count is below the limit", () => {
    expect(isAtItemLimit(49, 50)).toBe(false);
  });

  it("is true when count equals the limit", () => {
    expect(isAtItemLimit(50, 50)).toBe(true);
  });

  it("is true when count exceeds the limit", () => {
    expect(isAtItemLimit(51, 50)).toBe(true);
  });

  it("is always false when the limit is null (unlimited)", () => {
    expect(isAtItemLimit(1_000_000, null)).toBe(false);
  });

  it("is true at count zero when the limit is zero", () => {
    expect(isAtItemLimit(0, 0)).toBe(true);
  });
});
