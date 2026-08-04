// lib/items.ts
import { getSupabaseClient } from "./supabase";
import { generateUniqueCode } from "./qr";
import type { Item, ItemInput } from "./types";

function escapeForOrFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
