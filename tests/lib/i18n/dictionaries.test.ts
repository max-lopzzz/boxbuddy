import { describe, it, expect } from "vitest";
import { en } from "../../../lib/i18n/en";
import { es } from "../../../lib/i18n/es";

describe("i18n dictionaries", () => {
  it("have exactly the same set of keys", () => {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("have no empty string values in either dictionary", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.length, `en["${key}"] is empty`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(es)) {
      expect(value.length, `es["${key}"] is empty`).toBeGreaterThan(0);
    }
  });
});
