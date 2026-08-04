export function computeMargin(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null) return null;
  return Math.round((price - cost) * 100) / 100;
}

export function isLowStock(quantity: number, reorderAt: number | null): boolean {
  if (reorderAt === null) return false;
  return quantity <= reorderAt;
}
