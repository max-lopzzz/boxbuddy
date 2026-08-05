import { describe, it, expect, vi } from "vitest";
import { generateCandidateSku, generateUniqueSku, renderBarcodeSvg } from "../../lib/barcode";

describe("generateCandidateSku", () => {
  it("starts with bb_ and has 8 characters after the prefix", () => {
    const code = generateCandidateSku();
    expect(code.startsWith("bb_")).toBe(true);
    expect(code.length).toBe(3 + 8);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCandidateSku()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateUniqueSku", () => {
  it("returns the first candidate when it does not exist yet", async () => {
    const skuExists = vi.fn().mockResolvedValue(false);
    const code = await generateUniqueSku(skuExists);
    expect(skuExists).toHaveBeenCalledTimes(1);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("retries when a candidate already exists", async () => {
    const skuExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await generateUniqueSku(skuExists);
    expect(skuExists).toHaveBeenCalledTimes(2);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("throws after 10 failed attempts", async () => {
    const skuExists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueSku(skuExists)).rejects.toThrow(
      "Could not generate a unique SKU after 10 attempts"
    );
  });
});

describe("renderBarcodeSvg", () => {
  it("renders an SVG string", () => {
    const svg = renderBarcodeSvg("bb_abc12345");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
