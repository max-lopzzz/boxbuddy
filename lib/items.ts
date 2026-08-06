// lib/items.ts
import { getSupabaseClient } from "./supabase";
import { generateUniqueSku } from "./barcode";
import type { Item, ItemInput } from "./types";

function escapeForOrFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export class InvalidItemInputError extends Error {}

export function parseItemInput(body: unknown): ItemInput {
  if (typeof body !== "object" || body === null) {
    throw new InvalidItemInputError("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") {
    throw new InvalidItemInputError("name is required and must be a non-empty string");
  }

  const rawQuantity = b.quantity === undefined ? 0 : b.quantity;
  if (typeof rawQuantity !== "number" && typeof rawQuantity !== "string") {
    throw new InvalidItemInputError("quantity must be a number");
  }
  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity)) {
    throw new InvalidItemInputError("quantity must be a number");
  }

  const parseOptionalNumber = (value: unknown, field: string): number | null => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "number" && typeof value !== "string") {
      throw new InvalidItemInputError(`${field} must be a number or null`);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new InvalidItemInputError(`${field} must be a number or null`);
    return n;
  };

  const parseOptionalString = (value: unknown, field: string): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new InvalidItemInputError(`${field} must be a string or null`);
    return value;
  };

  const input: ItemInput = {
    name: b.name.trim(),
    quantity,
    reorder_at: parseOptionalNumber(b.reorder_at, "reorder_at"),
    location: parseOptionalString(b.location, "location"),
    category: parseOptionalString(b.category, "category"),
    notes: parseOptionalString(b.notes, "notes"),
    cost: parseOptionalNumber(b.cost, "cost"),
    price: parseOptionalNumber(b.price, "price"),
  };

  // sku is intentionally allowed through when explicitly provided (e.g. adopting a scanned
  // barcode), but must be a non-empty string if present — never silently coerced from junk.
  // undefined and null both mean "not provided" — the server generates one in that case.
  if (b.sku !== undefined && b.sku !== null) {
    if (typeof b.sku !== "string" || b.sku.trim() === "") {
      throw new InvalidItemInputError("sku must be a non-empty string if provided");
    }
    input.sku = b.sku;
  }

  return input;
}

export async function listItems(ownerId: string, search?: string): Promise<Item[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("items")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (search) {
    const escaped = escapeForOrFilter(search);
    query = query.or(`name.ilike."%${escaped}%",sku.ilike."%${escaped}%"`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Item[];
}

export async function getItem(ownerId: string, id: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

export async function lookupByCode(ownerId: string, code: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("sku", code)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

async function codeExists(ownerId: string, code: string): Promise<boolean> {
  return (await lookupByCode(ownerId, code)) !== null;
}

export async function createItem(ownerId: string, input: ItemInput): Promise<Item> {
  const supabase = getSupabaseClient();
  const sku = input.sku ?? (await generateUniqueSku((code) => codeExists(ownerId, code)));
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, sku, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(
  ownerId: string,
  id: string,
  input: Partial<ItemInput>
): Promise<Item> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .update(input)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(ownerId: string, id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("items").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function autocompleteValues(
  ownerId: string,
  field: "location" | "category",
  search: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select(field)
    .eq("owner_id", ownerId)
    .ilike(field, `%${search}%`)
    .not(field, "is", null)
    .limit(50);
  if (error) throw error;
  const values = (data as Record<string, string>[]).map((row) => row[field]);
  return Array.from(new Set(values)).slice(0, 10);
}
