// tests/lib/items.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSupabaseClient } from "../../lib/supabase";
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
  let ownerAId: string;
  let ownerBId: string;
  let createdId: string;

  beforeAll(async () => {
    const supabase = getSupabaseClient();
    const emailSuffix = Date.now();
    const { data: userA, error: errorA } = await supabase.auth.admin.createUser({
      email: `test-owner-a-${emailSuffix}@example.com`,
      password: "test-password-not-real",
      email_confirm: true,
    });
    if (errorA || !userA.user) throw errorA ?? new Error("Failed to create test owner A");
    ownerAId = userA.user.id;

    const { data: userB, error: errorB } = await supabase.auth.admin.createUser({
      email: `test-owner-b-${emailSuffix}@example.com`,
      password: "test-password-not-real",
      email_confirm: true,
    });
    if (errorB || !userB.user) throw errorB ?? new Error("Failed to create test owner B");
    ownerBId = userB.user.id;
  });

  afterAll(async () => {
    const supabase = getSupabaseClient();
    // Deleting the auth users cascades to delete any items still owned by them.
    if (ownerAId) await supabase.auth.admin.deleteUser(ownerAId);
    if (ownerBId) await supabase.auth.admin.deleteUser(ownerBId);
  });

  it("creates an item with a generated sku, owned by the caller", async () => {
    const item = await createItem(ownerAId, {
      name: "Integration Test Widget",
      quantity: 10,
      reorder_at: 2,
      location: "Shelf A",
      category: "Widgets",
      notes: null,
      cost: 2.5,
      price: 9.99,
    });
    createdId = item.id;
    expect(item.sku.startsWith("bb_")).toBe(true);
    expect(item.name).toBe("Integration Test Widget");
  });

  it("finds the item by id for its owner", async () => {
    const item = await getItem(ownerAId, createdId);
    expect(item?.name).toBe("Integration Test Widget");
  });

  it("returns null when a different owner requests the same item id", async () => {
    const item = await getItem(ownerBId, createdId);
    expect(item).toBeNull();
  });

  it("finds the item by sku for its owner only", async () => {
    const created = await getItem(ownerAId, createdId);
    const foundByOwner = await lookupByCode(ownerAId, created!.sku);
    expect(foundByOwner?.id).toBe(createdId);

    const foundByOtherOwner = await lookupByCode(ownerBId, created!.sku);
    expect(foundByOtherOwner).toBeNull();
  });

  it("allows a different owner to use the identical sku", async () => {
    const created = await getItem(ownerAId, createdId);
    const otherItem = await createItem(ownerBId, {
      name: "Owner B's Own Widget",
      quantity: 1,
      reorder_at: null,
      location: null,
      category: null,
      notes: null,
      cost: null,
      price: null,
      sku: created!.sku,
    });
    expect(otherItem.sku).toBe(created!.sku);
    await deleteItem(ownerBId, otherItem.id);
  });

  it("rejects the owner reusing their own sku on a second item", async () => {
    const created = await getItem(ownerAId, createdId);
    await expect(
      createItem(ownerAId, {
        name: "Duplicate Code Item",
        quantity: 1,
        reorder_at: null,
        location: null,
        category: null,
        notes: null,
        cost: null,
        price: null,
        sku: created!.sku,
      })
    ).rejects.toThrow();
  });

  it("updates the item for its owner", async () => {
    const updated = await updateItem(ownerAId, createdId, { quantity: 5 } as any);
    expect(updated.quantity).toBe(5);
  });

  it("rejects a different owner's attempt to update the item", async () => {
    await expect(updateItem(ownerBId, createdId, { quantity: 99 } as any)).rejects.toThrow();
  });

  it("lists items scoped to the requesting owner", async () => {
    const ownerAItems = await listItems(ownerAId, "Integration Test Widget");
    expect(ownerAItems.some((i) => i.id === createdId)).toBe(true);

    const ownerBItems = await listItems(ownerBId, "Integration Test Widget");
    expect(ownerBItems.some((i) => i.id === createdId)).toBe(false);
  });

  it("a different owner's delete attempt has no effect", async () => {
    await deleteItem(ownerBId, createdId);
    const stillThere = await getItem(ownerAId, createdId);
    expect(stillThere).not.toBeNull();
  });

  it("deletes the item for its actual owner", async () => {
    await deleteItem(ownerAId, createdId);
    const gone = await getItem(ownerAId, createdId);
    expect(gone).toBeNull();
  });
});
