import { describe, it, expect } from "vitest";
import { detectLocaleFromAcceptLanguage } from "../../../lib/i18n/detect";

describe("detectLocaleFromAcceptLanguage", () => {
  it("returns 'en' when the header is null", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
  });

  it("returns 'en' when the header is empty", () => {
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
  });

  it("returns 'es' for a plain 'es' preference", () => {
    expect(detectLocaleFromAcceptLanguage("es")).toBe("es");
  });

  it("returns 'es' for a regional Spanish variant like 'es-MX'", () => {
    expect(detectLocaleFromAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
  });

  it("returns 'en' for English variants", () => {
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("returns 'en' for an unsupported language like French", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("returns 'en' for a header that is only whitespace", () => {
    expect(detectLocaleFromAcceptLanguage("   ")).toBe("en");
  });
});
