import { describe, it, expect } from "vitest";
import { computeMargin, isLowStock } from "../../lib/item-helpers";

describe("computeMargin", () => {
  it("returns price minus cost when both are set", () => {
    expect(computeMargin(2.5, 9.99)).toBe(7.49);
  });

  it("returns null when cost is null", () => {
    expect(computeMargin(null, 9.99)).toBeNull();
  });

  it("returns null when price is null", () => {
    expect(computeMargin(2.5, null)).toBeNull();
  });
});

describe("isLowStock", () => {
  it("is false when reorderAt is null", () => {
    expect(isLowStock(0, null)).toBe(false);
  });

  it("is true when quantity is at or below reorderAt", () => {
    expect(isLowStock(2, 2)).toBe(true);
    expect(isLowStock(1, 2)).toBe(true);
  });

  it("is false when quantity is above reorderAt", () => {
    expect(isLowStock(3, 2)).toBe(false);
  });
});
