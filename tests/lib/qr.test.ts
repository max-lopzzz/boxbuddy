import { describe, it, expect, vi } from "vitest";
import { generateCandidateCode, generateUniqueCode, renderQrSvg } from "../../lib/qr";

describe("generateCandidateCode", () => {
  it("starts with bb_ and has 8 characters after the prefix", () => {
    const code = generateCandidateCode();
    expect(code.startsWith("bb_")).toBe(true);
    expect(code.length).toBe(3 + 8);
  });

  it("produces different codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCandidateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateUniqueCode", () => {
  it("returns the first candidate when it does not exist yet", async () => {
    const codeExists = vi.fn().mockResolvedValue(false);
    const code = await generateUniqueCode(codeExists);
    expect(codeExists).toHaveBeenCalledTimes(1);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("retries when a candidate already exists", async () => {
    const codeExists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const code = await generateUniqueCode(codeExists);
    expect(codeExists).toHaveBeenCalledTimes(2);
    expect(code.startsWith("bb_")).toBe(true);
  });

  it("throws after 10 failed attempts", async () => {
    const codeExists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueCode(codeExists)).rejects.toThrow(
      "Could not generate a unique QR code after 10 attempts"
    );
  });
});

describe("renderQrSvg", () => {
  it("renders an SVG string", async () => {
    const svg = await renderQrSvg("bb_abc12345");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
