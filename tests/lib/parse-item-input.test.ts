// tests/lib/parse-item-input.test.ts
import { describe, it, expect } from "vitest";
import { parseItemInput, InvalidItemInputError } from "../../lib/items";

describe("parseItemInput", () => {
  it("passes through a valid full input correctly", () => {
    const result = parseItemInput({
      name: "Widget",
      sku: "W-1",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: "Some notes",
      cost: 2.5,
      price: 9.99,
    });
    expect(result).toEqual({
      name: "Widget",
      sku: "W-1",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: "Some notes",
      cost: 2.5,
      price: 9.99,
    });
  });

  it("trims the name", () => {
    const result = parseItemInput({ name: "  Widget  " });
    expect(result.name).toBe("Widget");
  });

  it("throws when name is missing", () => {
    expect(() => parseItemInput({})).toThrow(InvalidItemInputError);
  });

  it("throws when name is empty string", () => {
    expect(() => parseItemInput({ name: "" })).toThrow(InvalidItemInputError);
  });

  it("throws when name is only whitespace", () => {
    expect(() => parseItemInput({ name: "   " })).toThrow(InvalidItemInputError);
  });

  it("throws when name is not a string", () => {
    expect(() => parseItemInput({ name: 123 })).toThrow(InvalidItemInputError);
  });

  it("throws when quantity is non-numeric", () => {
    expect(() => parseItemInput({ name: "Widget", quantity: "not-a-number" })).toThrow(
      InvalidItemInputError
    );
  });

  it("defaults quantity to 0 when omitted", () => {
    const result = parseItemInput({ name: "Widget" });
    expect(result.quantity).toBe(0);
  });

  describe("optional numeric fields (reorder_at, cost, price)", () => {
    for (const field of ["reorder_at", "cost", "price"] as const) {
      it(`${field}: undefined becomes null`, () => {
        const result = parseItemInput({ name: "Widget" });
        expect(result[field]).toBeNull();
      });

      it(`${field}: null stays null`, () => {
        const result = parseItemInput({ name: "Widget", [field]: null });
        expect(result[field]).toBeNull();
      });

      it(`${field}: empty string becomes null`, () => {
        const result = parseItemInput({ name: "Widget", [field]: "" });
        expect(result[field]).toBeNull();
      });

      it(`${field}: valid number passes through`, () => {
        const result = parseItemInput({ name: "Widget", [field]: 5 });
        expect(result[field]).toBe(5);
      });

      it(`${field}: non-numeric string throws`, () => {
        expect(() => parseItemInput({ name: "Widget", [field]: "abc" })).toThrow(
          InvalidItemInputError
        );
      });
    }
  });

  describe("optional string fields (sku, location, category, notes)", () => {
    for (const field of ["sku", "location", "category", "notes"] as const) {
      it(`${field}: undefined becomes null`, () => {
        const result = parseItemInput({ name: "Widget" });
        expect(result[field]).toBeNull();
      });

      it(`${field}: null stays null`, () => {
        const result = parseItemInput({ name: "Widget", [field]: null });
        expect(result[field]).toBeNull();
      });

      it(`${field}: valid string passes through`, () => {
        const result = parseItemInput({ name: "Widget", [field]: "value" });
        expect(result[field]).toBe("value");
      });

      it(`${field}: non-string throws`, () => {
        expect(() => parseItemInput({ name: "Widget", [field]: 123 })).toThrow(
          InvalidItemInputError
        );
      });
    }
  });

  it("passes through a provided qr_code", () => {
    const result = parseItemInput({ name: "Widget", qr_code: "bb_abc123" });
    expect(result.qr_code).toBe("bb_abc123");
  });

  it("throws when qr_code is an empty string", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: "" })).toThrow(InvalidItemInputError);
  });

  it("throws when qr_code is only whitespace", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: "   " })).toThrow(
      InvalidItemInputError
    );
  });

  it("throws when qr_code is not a string", () => {
    expect(() => parseItemInput({ name: "Widget", qr_code: 123 })).toThrow(InvalidItemInputError);
  });

  it("does not include qr_code when not provided", () => {
    const result = parseItemInput({ name: "Widget" });
    expect("qr_code" in result).toBe(false);
  });

  it("throws when body is null", () => {
    expect(() => parseItemInput(null)).toThrow(InvalidItemInputError);
  });

  it("throws when body is not an object", () => {
    expect(() => parseItemInput("a string")).toThrow(InvalidItemInputError);
  });

  it("silently ignores id, created_at, updated_at, and photo_url from the input body", () => {
    const result = parseItemInput({
      name: "Widget",
      id: "some-fake-id",
      created_at: "2020-01-01T00:00:00Z",
      updated_at: "2020-01-01T00:00:00Z",
      photo_url: "https://evil.example.com/other-item-photo.jpg",
    }) as Record<string, unknown>;

    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("updated_at");
    expect(result).not.toHaveProperty("photo_url");
  });
});
