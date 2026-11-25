import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./index";
import type { Product } from "@/types/product";
import { logger } from "@/lib/logger";
import { hydrateProduct } from "@/lib/product-education";
import { persistCatalogFields } from "@/lib/catalog-meta";

function rowToProduct(row: typeof schema.products.$inferSelect): Product {
  return hydrateProduct({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    salePrice: row.salePrice ?? undefined,
    images: row.images,
    rating: row.rating,
    reviewCount: row.reviewCount,
    shortDescription: row.shortDescription,
    description: row.description,
    inStock: row.inStock,
    colorFamily: row.colorFamily,
    patternStyle: row.patternStyle,
    lengthOptions: row.lengthOptions,
    specifications: row.specifications || {},
  });
}

export async function getProductsFromDb(): Promise<Product[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(schema.products).orderBy(schema.products.id);
    return rows.map(rowToProduct);
  } catch (e) {
    logger.error("products", "DB getProducts failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function getProductBySlugFromDb(slug: string): Promise<Product | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1);
    return row ? rowToProduct(row) : null;
  } catch {
    return null;
  }
}

export async function upsertProductInDb(product: Product): Promise<Product | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const packed = persistCatalogFields(product);
    const values = {
      slug: packed.slug,
      name: packed.name,
      category: packed.category,
      price: packed.price,
      salePrice: packed.salePrice ?? null,
      images: packed.images,
      rating: packed.rating,
      reviewCount: packed.reviewCount,
      shortDescription: packed.shortDescription,
      description: packed.description,
      inStock: packed.inStock,
      colorFamily: packed.colorFamily,
      patternStyle: packed.patternStyle,
      lengthOptions: packed.lengthOptions,
      specifications: packed.specifications,
      updatedAt: new Date(),
    };

    if (product.id) {
      const [row] = await db
        .update(schema.products)
        .set(values)
        .where(eq(schema.products.id, product.id))
        .returning();
      return row ? rowToProduct(row) : null;
    }

    const [row] = await db.insert(schema.products).values(values).returning();
    return row ? rowToProduct(row) : null;
  } catch (e) {
    logger.error("products", "DB upsertProduct failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function deleteProductFromDb(id: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.delete(schema.products).where(eq(schema.products.id, id));
    return true;
  } catch {
    return false;
  }
}

export async function updateStockInDb(id: number, inStock: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .update(schema.products)
      .set({ inStock, updatedAt: new Date() })
      .where(eq(schema.products.id, id));
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically decrement stock only if enough units remain.
 * Returns true when a row was updated (no oversell under concurrency).
 */
export async function decrementStockInDb(
  id: number,
  quantity: number,
): Promise<{ ok: boolean; remaining?: number }> {
  const db = getDb();
  if (!db || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false };
  }
  try {
    const rows = await db
      .update(schema.products)
      .set({
        inStock: sql`${schema.products.inStock} - ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.products.id, id), gte(schema.products.inStock, quantity)),
      )
      .returning({ id: schema.products.id, inStock: schema.products.inStock });

    if (!rows[0]) return { ok: false };
    return { ok: true, remaining: rows[0].inStock };
  } catch (e) {
    logger.error("products", "decrementStockInDb failed", {
      id,
      quantity,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false };
  }
}

export async function seedProductsToDb(products: Product[]): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const existing = await db.select({ id: schema.products.id }).from(schema.products).limit(1);
    if (existing.length > 0) return 0;

    for (const p of products) {
      await db.insert(schema.products).values({
        slug: p.slug,
        name: p.name,
        category: p.category,
        price: p.price,
        salePrice: p.salePrice ?? null,
        images: p.images,
        rating: p.rating,
        reviewCount: p.reviewCount,
        shortDescription: p.shortDescription,
        description: p.description,
        inStock: p.inStock,
        colorFamily: p.colorFamily,
        patternStyle: p.patternStyle,
        lengthOptions: p.lengthOptions,
        specifications: p.specifications,
      });
    }
    return products.length;
  } catch (e) {
    logger.error("products", "DB seed failed", { error: e instanceof Error ? e.message : String(e) });
    return 0;
  }
}