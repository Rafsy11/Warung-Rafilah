export interface CachedProduct {
  id: string;
  barcode: string;
  name: string;
  sell_price: string;
  cost_price?: string;
  stock_qty: string;
  unit?: string;
  category?: string;
}

let cachedProducts: CachedProduct[] = [];
let barcodeMap = new Map<string, CachedProduct>();
let lastFetchedAt = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL

/**
 * Fetch and populate product cache from API
 */
export async function refreshProductCache(force = false): Promise<CachedProduct[]> {
  const now = Date.now();
  if (!force && cachedProducts.length > 0 && (now - lastFetchedAt) < CACHE_TTL_MS) {
    return cachedProducts;
  }

  try {
    const res = await fetch('/api/products?limit=1000');
    if (!res.ok) return cachedProducts;

    const data = await res.json();
    const items: CachedProduct[] = data.items || [];

    const newBarcodeMap = new Map<string, CachedProduct>();
    for (const item of items) {
      if (item.barcode) {
        newBarcodeMap.set(item.barcode.trim(), item);
      }
    }

    cachedProducts = items;
    barcodeMap = newBarcodeMap;
    lastFetchedAt = now;
    return cachedProducts;
  } catch (err) {
    console.warn('Failed to refresh local product cache:', err);
    return cachedProducts;
  }
}

/**
 * Fast client-side product search
 */
export function searchProductsLocal(query: string, limit = 5): CachedProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  // Match exact barcode first
  const exactBarcode = barcodeMap.get(query.trim());
  if (exactBarcode) {
    return [exactBarcode];
  }

  // Filter by name or barcode prefix
  const matches: CachedProduct[] = [];
  for (const item of cachedProducts) {
    const nameMatch = item.name ? item.name.toLowerCase().includes(q) : false;
    const barcodeMatch = item.barcode ? item.barcode.toLowerCase().includes(q) : false;
    if (nameMatch || barcodeMatch) {
      matches.push(item);
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

/**
 * Fast barcode lookup
 */
export function getProductByBarcodeLocal(barcode: string): CachedProduct | undefined {
  return barcodeMap.get(barcode.trim());
}
