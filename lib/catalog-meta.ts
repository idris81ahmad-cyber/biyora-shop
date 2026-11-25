import type { Product } from "@/types/product";

/** Stored inside specifications JSON so Postgres and the JSON catalog both keep them. */
export const HOUSE_SELLER_ID = "biyora";
export const DEFAULT_SELLER_COMMISSION = 12;

export type ListingStatus = "draft" | "published";
export type ListingModeration = "approved" | "pending" | "rejected";

export interface FabricVariant {
  color: string;
  length: string;
  /** Naira charged per yard for this colour and cut. */
  pricePerYard: number;
  stock: number;
}

export interface CatalogMeta {
  listingStatus: ListingStatus;
  featured: boolean;
  isNewArrival: boolean;
  composition: string;
  seoTitle: string;
  seoDescription: string;
  variants: FabricVariant[];
  sellerId: string;
  sellerName: string;
  moderation: ListingModeration;
  lowStockThreshold: number;
  imageNotes: string[];
  /** Snapshot of the seller fee at listing time. House stock is 0. */
  commissionPercent: number;
}

const K = {
  status: "__listingStatus",
  featured: "__featured",
  newArrival: "__newArrival",
  composition: "__composition",
  seoTitle: "__seoTitle",
  seoDescription: "__seoDescription",
  variants: "__variants",
  sellerId: "__sellerId",
  sellerName: "__sellerName",
  moderation: "__moderation",
  lowStock: "__lowStock",
  imageNotes: "__imageNotes",
  commission: "__commissionPercent",
} as const;

export const INTERNAL_SPEC_PREFIX = "__";

export function isInternalSpecKey(key: string): boolean {
  return key.startsWith(INTERNAL_SPEC_PREFIX);
}

function asStatus(value: unknown): ListingStatus | undefined {
  return value === "draft" || value === "published" ? value : undefined;
}

function asModeration(value: unknown): ListingModeration | undefined {
  return value === "approved" || value === "pending" || value === "rejected" ? value : undefined;
}

function parseVariants(raw: unknown): FabricVariant[] {
  if (Array.isArray(raw)) return sanitizeVariants(raw);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sanitizeVariants(parsed) : [];
  } catch {
    return [];
  }
}

function sanitizeVariants(rows: unknown[]): FabricVariant[] {
  const out: FabricVariant[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const v = row as Partial<FabricVariant>;
    const length = String(v.length || "").trim();
    const color = String(v.color || "").trim();
    const pricePerYard = Math.round(Number(v.pricePerYard) || 0);
    const stock = Math.max(0, Math.round(Number(v.stock) || 0));
    if (!length || pricePerYard <= 0) continue;
    out.push({ color: color || "As shown", length, pricePerYard, stock });
  }
  return out;
}

function parseNotes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((n) => String(n || ""));
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((n) => String(n || "")) : [];
  } catch {
    return [];
  }
}

export function readCatalogMeta(product: Pick<Product, "specifications"> & Partial<Product>): CatalogMeta {
  const s = product.specifications || {};
  const fromSpecsVariants = parseVariants(s[K.variants]);
  const variants = product.variants?.length ? sanitizeVariants(product.variants) : fromSpecsVariants;
  const sellerId = (product.sellerId || s[K.sellerId] || "").trim();
  const isHouse = !sellerId || sellerId === HOUSE_SELLER_ID;

  return {
    listingStatus: product.listingStatus || asStatus(s[K.status]) || "published",
    featured: product.featured ?? s[K.featured] === "true",
    isNewArrival: product.isNewArrival ?? s[K.newArrival] === "true",
    composition: product.composition || s[K.composition] || s["Material"] || "",
    seoTitle: product.seoTitle || s[K.seoTitle] || "",
    seoDescription: product.seoDescription || s[K.seoDescription] || "",
    variants,
    sellerId: sellerId || HOUSE_SELLER_ID,
    sellerName: product.sellerName || s[K.sellerName] || (isHouse ? "BIYORA SHOP" : ""),
    moderation: product.moderation || asModeration(s[K.moderation]) || (isHouse ? "approved" : "pending"),
    lowStockThreshold: positiveInt(product.lowStockThreshold ?? s[K.lowStock], 10),
    imageNotes: product.imageNotes?.length ? product.imageNotes.map(String) : parseNotes(s[K.imageNotes]),
    commissionPercent: isHouse
      ? 0
      : clampPercent(product.commissionPercent ?? s[K.commission] ?? DEFAULT_SELLER_COMMISSION),
  };
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clampPercent(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SELLER_COMMISSION;
  return Math.min(80, Math.max(0, n));
}

/** Copy meta onto the product and into specifications so a DB save does not drop it. */
export function persistCatalogFields<T extends Product>(product: T): T {
  const meta = readCatalogMeta(product);
  const specifications: Record<string, string> = { ...(product.specifications || {}) };

  specifications[K.status] = meta.listingStatus;
  specifications[K.featured] = meta.featured ? "true" : "false";
  specifications[K.newArrival] = meta.isNewArrival ? "true" : "false";
  if (meta.composition) specifications[K.composition] = meta.composition;
  else delete specifications[K.composition];
  if (meta.seoTitle) specifications[K.seoTitle] = meta.seoTitle;
  else delete specifications[K.seoTitle];
  if (meta.seoDescription) specifications[K.seoDescription] = meta.seoDescription;
  else delete specifications[K.seoDescription];
  if (meta.variants.length) specifications[K.variants] = JSON.stringify(meta.variants);
  else delete specifications[K.variants];
  specifications[K.sellerId] = meta.sellerId;
  if (meta.sellerName) specifications[K.sellerName] = meta.sellerName;
  specifications[K.moderation] = meta.moderation;
  specifications[K.lowStock] = String(meta.lowStockThreshold);
  if (meta.imageNotes.some(Boolean)) specifications[K.imageNotes] = JSON.stringify(meta.imageNotes);
  else delete specifications[K.imageNotes];
  specifications[K.commission] = String(meta.commissionPercent);
  if (meta.composition) specifications.Material = specifications.Material || meta.composition;

  return {
    ...product,
    ...meta,
    specifications,
  };
}

export function liftCatalogMeta<T extends Product>(product: T): T {
  const meta = readCatalogMeta(product);
  return { ...product, ...meta };
}

/** Shoppers only see published, Kwari-approved fabrics. Missing flags stay public (legacy catalog). */
export function isPublicListing(product: Product): boolean {
  const meta = readCatalogMeta(product);
  if (meta.listingStatus === "draft") return false;
  if (meta.moderation === "pending" || meta.moderation === "rejected") return false;
  return true;
}

export function isLowStock(product: Product): boolean {
  const limit = readCatalogMeta(product).lowStockThreshold;
  return product.inStock > 0 && product.inStock <= limit;
}

export function yardsFromLength(length: string): number {
  const match = String(length || "").match(/(\d+(\.\d+)?)/);
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : 5;
}

export function baseUnitPrice(product: Pick<Product, "price" | "salePrice">): number {
  if (typeof product.salePrice === "number" && product.salePrice > 0) {
    return Math.round(product.salePrice);
  }
  return Math.max(0, Math.round(Number(product.price) || 0));
}

export function unitPriceForSelection(product: Product, length?: string, color?: string): number {
  const variants = readCatalogMeta(product).variants;
  if (length && variants.length) {
    const wanted = length.toLowerCase();
    const colorWanted = color?.trim().toLowerCase();
    const match =
      variants.find((v) => {
        const lengthOk = v.length.toLowerCase() === wanted;
        if (!lengthOk) return false;
        if (!colorWanted) return true;
        return v.color.toLowerCase() === colorWanted;
      }) || variants.find((v) => v.length.toLowerCase() === wanted);
    if (match) return Math.round(match.pricePerYard * yardsFromLength(match.length));
  }
  return baseUnitPrice(product);
}

export function variantStock(product: Product, length?: string, color?: string): number | undefined {
  const variants = readCatalogMeta(product).variants;
  if (!variants.length || !length) return undefined;
  const wanted = length.toLowerCase();
  const colorWanted = color?.trim().toLowerCase();
  const match = variants.find((v) => {
    if (v.length.toLowerCase() !== wanted) return false;
    if (!colorWanted) return true;
    return v.color.toLowerCase() === colorWanted;
  });
  return match ? match.stock : undefined;
}

export function listingBadge(product: Product): string | null {
  const meta = readCatalogMeta(product);
  if (meta.listingStatus === "draft") return "Draft";
  if (meta.moderation === "pending") return "In review";
  if (meta.moderation === "rejected") return "Needs changes";
  if (meta.featured) return "Featured";
  if (meta.isNewArrival) return "New";
  return null;
}
