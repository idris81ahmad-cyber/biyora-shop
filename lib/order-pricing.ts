/**
 * Server-side cart pricing from the product catalog.
 * Never trust client unitPrice / lineTotal / subtotal for payment amounts.
 */

import type { OrderItemJson } from "@/lib/db/schema";
import type { Product } from "@/types/product";
import { getProducts } from "@/lib/products-store";
import {
  readCatalogMeta,
  unitPriceForSelection,
  variantStock,
} from "@/lib/catalog-meta";

export type PricedCartResult =
  | {
      ok: true;
      items: OrderItemJson[];
      subtotal: number;
    }
  | {
      ok: false;
      error: string;
      code: "empty" | "invalid_item" | "unknown_product" | "out_of_stock" | "catalog";
    };



export function catalogUnitPrice(product: Product): number {
  const sale = product.salePrice;
  if (typeof sale === "number" && Number.isFinite(sale) && sale > 0) {
    return Math.round(sale);
  }
  return Math.round(Number(product.price) || 0);
}

function findProduct(
  products: Product[],
  item: { productId?: number; slug?: string; name?: string },
): Product | undefined {
  if (typeof item.productId === "number" && item.productId > 0) {
    const byId = products.find((p) => p.id === item.productId);
    if (byId) return byId;
  }
  if (item.slug) {
    const slug = item.slug.trim().toLowerCase();
    const bySlug = products.find((p) => p.slug.toLowerCase() === slug);
    if (bySlug) return bySlug;
  }
  if (item.name) {
    const name = item.name.trim().toLowerCase();
    const byName = products.find((p) => p.name.toLowerCase() === name);
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Recompute cart lines using catalog prices. Rejects unknown / zero-price / OOS items.
 */
export function priceCartAgainstCatalog(
  cartItems: Array<Partial<OrderItemJson> & { productId?: number; name?: string }>,
  products: Product[],
): PricedCartResult {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { ok: false, error: "Cart is empty", code: "empty" };
  }

  if (!products.length) {
    return {
      ok: false,
      error: "Product catalog unavailable",
      code: "catalog",
    };
  }

  const priced: OrderItemJson[] = [];
  let subtotal = 0;

  for (const raw of cartItems) {
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 0));
    if (!quantity || !Number.isFinite(quantity)) {
      return {
        ok: false,
        error: "Invalid item quantity",
        code: "invalid_item",
      };
    }

    const product = findProduct(products, raw);
    if (!product) {
      return {
        ok: false,
        error: `Unknown product: ${raw.name || raw.slug || raw.productId || "item"}`,
        code: "unknown_product",
      };
    }

    const length =
      (typeof raw.selectedLength === "string" && raw.selectedLength.trim()) ||
      product.lengthOptions?.[0] ||
      "5 yards";

    const color = typeof (raw as { color?: string }).color === "string"
      ? (raw as { color?: string }).color
      : undefined;

    const variantQty = variantStock(product, length, color);
    const available = variantQty === undefined ? product.inStock : Math.min(product.inStock, variantQty);
    if (available <= 0) {
      return {
        ok: false,
        error: `${product.name} is out of stock`,
        code: "out_of_stock",
      };
    }
    if (quantity > available) {
      return {
        ok: false,
        error: `Only ${available} of ${product.name} available`,
        code: "out_of_stock",
      };
    }

    const unitPrice = unitPriceForSelection(product, length, color);
    if (unitPrice <= 0) {
      return {
        ok: false,
        error: `Invalid catalog price for ${product.name}`,
        code: "catalog",
      };
    }

    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    const meta = readCatalogMeta(product);
    const commissionPercent = meta.commissionPercent;
    const commissionAmount = Math.round((lineTotal * commissionPercent) / 100);

    priced.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      image: product.images?.[0] || "/images/ankara-premium.jpg",
      selectedLength: length,
      quantity,
      unitPrice,
      lineTotal,
      sellerId: meta.sellerId,
      sellerName: meta.sellerName,
      commissionPercent,
      commissionAmount,
    });
  }

  return {
    ok: true,
    items: priced,
    subtotal: Math.round(subtotal),
  };
}

export async function priceCartFromCatalog(
  cartItems: Array<Partial<OrderItemJson> & { productId?: number; name?: string }>,
): Promise<PricedCartResult> {
  try {
    const products = await getProducts();
    return priceCartAgainstCatalog(cartItems, products);
  } catch {
    return {
      ok: false,
      error: "Could not load product catalog",
      code: "catalog",
    };
  }
}

export { getShippingFee } from "@/lib/shipping";

export function computeOrderTotal(params: {
  subtotal: number;
  shippingFee: number;
  discount: number;
}): number {
  return Math.max(
    0,
    Math.round(params.subtotal + params.shippingFee - Math.max(0, params.discount)),
  );
}
