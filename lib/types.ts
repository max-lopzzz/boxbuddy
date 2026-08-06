export interface Item {
  id: string;
  sku: string;
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
  quantity: number;
  reorder_at: number | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  cost: number | null;
  price: number | null;
  sku?: string;
  photo_url?: string | null;
};
