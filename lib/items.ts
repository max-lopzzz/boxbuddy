// lib/items.ts
import { getSupabaseClient } from "./supabase";
import { generateUniqueCode } from "./qr";
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

  const quantity = b.quantity === undefined ? 0 : Number(b.quantity);
  if (!Number.isFinite(quantity)) {
    throw new InvalidItemInputError("quantity must be a number");
  }

  const parseOptionalNumber = (value: unknown, field: string): number | null => {
    if (value === undefined || value === null || value === "") return null;
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
    sku: parseOptionalString(b.sku, "sku"),
    quantity,
    reorder_at: parseOptionalNumber(b.reorder_at, "reorder_at"),
    location: parseOptionalString(b.location, "location"),
    category: parseOptionalString(b.category, "category"),
    notes: parseOptionalString(b.notes, "notes"),
    cost: parseOptionalNumber(b.cost, "cost"),
    price: parseOptionalNumber(b.price, "price"),
  };

  // qr_code is intentionally allowed through when explicitly provided (e.g. adopting a scanned
  // barcode), but must be a non-empty string if present — never silently coerced from junk.
  if (b.qr_code !== undefined) {
    if (typeof b.qr_code !== "string" || b.qr_code.trim() === "") {
      throw new InvalidItemInputError("qr_code must be a non-empty string if provided");
    }
    input.qr_code = b.qr_code;
  }

  return input;
}

export async function listItems(search?: string): Promise<Item[]> {
  const supabase = getSupabaseClient();
  let query = supabase.from("items").select("*").order("updated_at", { ascending: false });
  if (search) {
    const escaped = escapeForOrFilter(search);
    query = query.or(`name.ilike."%${escaped}%",sku.ilike."%${escaped}%"`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

export async function lookupByCode(code: string): Promise<Item | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").select("*").eq("qr_code", code).maybeSingle();
  if (error) throw error;
  return data as Item | null;
}

async function codeExists(code: string): Promise<boolean> {
  return (await lookupByCode(code)) !== null;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const supabase = getSupabaseClient();
  const qr_code = input.qr_code ?? (await generateUniqueCode(codeExists));
  const { data, error } = await supabase
    .from("items")
    .insert({ ...input, qr_code })
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("items").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Item;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function autocompleteValues(
  field: "location" | "category",
  search: string
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select(field)
    .ilike(field, `%${search}%`)
    .not(field, "is", null)
    .limit(50);
  if (error) throw error;
  const values = (data as Record<string, string>[]).map((row) => row[field]);
  return Array.from(new Set(values)).slice(0, 10);
}
