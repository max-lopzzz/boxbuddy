// tests/lib/items.integration.test.ts
import { describe, it, expect, afterAll } from "vitest";
import {
  createItem,
  getItem,
  updateItem,
  deleteItem,
  lookupByCode,
  listItems,
} from "../../lib/items";

const hasEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("items DB layer (integration)", () => {
  let createdId: string;

  it("creates an item with a generated qr_code", async () => {
    const item = await createItem({
      name: "Integration Test Widget",
      sku: "ITW-1",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: null,
      cost: 2.5,
      price: 9.99,
    });
    createdId = item.id;
    expect(item.qr_code.startsWith("bb_")).toBe(true);
    expect(item.name).toBe("Integration Test Widget");
  });

  it("finds the item by id", async () => {
    const item = await getItem(createdId);
    expect(item?.name).toBe("Integration Test Widget");
  });

  it("finds the item by qr_code", async () => {
    const created = await getItem(createdId);
    const found = await lookupByCode(created!.qr_code);
    expect(found?.id).toBe(createdId);
  });

  it("updates the item", async () => {
    const updated = await updateItem(createdId, { quantity: 5 });
    expect(updated.quantity).toBe(5);
  });

  it("lists items including the created one when searched by name", async () => {
    const items = await listItems("Integration Test Widget");
    expect(items.some((i) => i.id === createdId)).toBe(true);
  });

  it("rejects creating a second item with a duplicate qr_code", async () => {
    const existing = await getItem(createdId);
    await expect(
      createItem({
        name: "Duplicate Code Item",
        sku: null,
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        qr_code: existing!.qr_code,
      })
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await deleteItem(createdId);
  });
});
