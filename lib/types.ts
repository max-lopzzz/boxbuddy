// lib/types.ts
export interface Item {
  id: string;
  qr_code: string;
  sku: string | null;
  name: string;
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ItemInput = {
  name: string;
  sku: string | null;
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  qr_code?: string;
  photo_url?: string | null;
};
