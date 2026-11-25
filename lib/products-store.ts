import fs from "fs";
import path from "path";
import { list, put } from "@vercel/blob";
import { Product } from "@/types/product";
import {
  readProductsFromGitHub,
  hasGitHubStorage,
  writeProductsToGitHub,
} from "@/lib/products-github";
import { getDb, hasDatabase } from "@/lib/db";
import {
  getProductsFromDb,
  upsertProductInDb,
  deleteProductFromDb,
  updateStockInDb,
  decrementStockInDb,
} from "@/lib/db/products";
import { seedProducts } from "@/lib/db/seed";
import { getDefaultProducts } from "@/lib/products-defaults";
import { logger } from "@/lib/logger";
import { liftCatalogMeta, persistCatalogFields } from "@/lib/catalog-meta";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const BLOB_PATHNAMES = ["biyora/products.json", "btx3/products.json"];
const FETCH_TIMEOUT_MS = 8_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function canWriteToFilesystem(): boolean {
  if (process.env.VERCEL) return false;
  try {
    ensureDir();
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readProductsFromFilesystem(): Product[] | null {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    logger.error("products-store", "Failed to read products.json from filesystem", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return null;
}

async function readProductsFromBlob(): Promise<Product[] | null> {
  for (const pathname of BLOB_PATHNAMES) {
    try {
      const { blobs } = await list({ prefix: pathname });
      const blob = blobs.find((b) => b.pathname === pathname) ?? blobs[0];
      if (!blob) continue;

      const res = await fetchWithTimeout(blob.downloadUrl, { cache: "no-store" });
      if (!res.ok) continue;

      const parsed = await res.json();
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      logger.error("products-store", "Failed to read products from blob", {
        pathname,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return null;
}

async function writeProductsToBlob(products: Product[]): Promise<void> {
  await put(BLOB_PATHNAMES[0], JSON.stringify(products, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

function writeProductsToFilesystem(products: Product[]): void {
  ensureDir();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

async function getProductsLegacy(): Promise<Product[]> {
  if (hasBlobStorage()) {
    const fromBlob = await readProductsFromBlob();
    if (fromBlob) return fromBlob;
  }

  if (hasGitHubStorage() || process.env.VERCEL) {
    const fromGitHub = await readProductsFromGitHub();
    if (fromGitHub) return fromGitHub;
  }

  const fromFs = readProductsFromFilesystem();
  if (fromFs) {
    if (hasBlobStorage()) {
      try {
        await writeProductsToBlob(fromFs);
      } catch (e) {
        logger.error("products-store", "Failed to seed blob store from filesystem", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return fromFs;
  }

  const defaults = getDefaultProducts();
  if (defaults.length > 0) {
    await saveProducts(defaults);
  }
  return defaults;
}

function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function timeoutPromise<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      promise,
      timeoutPromise<T>(FETCH_TIMEOUT_MS, "product fetch timeout"),
    ]);
  } catch {
    return fallback;
  }
}

/**
 * Primary product getter.
 * Prefers Drizzle DB when available at runtime.
 * During production builds, uses fast legacy/default fallback to avoid Vercel timeouts.
 */
export async function getProducts(): Promise<Product[]> {
  const products = await loadProducts();
  return products.map((product) => liftCatalogMeta(product));
}

async function loadProducts(): Promise<Product[]> {
  if (isProductionBuild()) {
    const legacy = await withTimeout(getProductsLegacy(), getDefaultProducts());
    return legacy.length > 0 ? legacy : getDefaultProducts();
  }

  if (hasDatabase()) {
    const fromDb = await withTimeout(getProductsFromDb(), null);
    if (fromDb && fromDb.length > 0) {
      return fromDb;
    }
    const legacy = await withTimeout(getProductsLegacy(), getDefaultProducts());
    if (legacy.length > 0) {
      try {
        const seededCount = await seedProducts(false);
        if (seededCount > 0) {
          logger.ops("products-store", "Seeded products into database", {
            count: seededCount,
          });
        }
        const seeded = await getProductsFromDb();
        if (seeded && seeded.length > 0) return seeded;
      } catch (e) {
        logger.error("products-store", "DB seed during getProducts failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return legacy;
    }
  }
  return withTimeout(getProductsLegacy(), getDefaultProducts());
}

async function saveProductsToDb(products: Product[]): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    for (const product of products) {
      await upsertProductInDb(product);
    }
    return true;
  } catch (e) {
    logger.error("products-store", "saveProductsToDb failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

export async function saveProducts(products: Product[]): Promise<void> {
  if (hasDatabase()) {
    const saved = await saveProductsToDb(products);
    if (saved) return;
  }

  if (hasBlobStorage()) {
    await writeProductsToBlob(products);
    return;
  }

  if (hasGitHubStorage()) {
    await writeProductsToGitHub(products);
    return;
  }

  if (canWriteToFilesystem()) {
    writeProductsToFilesystem(products);
    return;
  }

  throw new Error(
    "Product storage is read-only on Vercel. Add POSTGRES_URL, BLOB_READ_WRITE_TOKEN, or GITHUB_TOKEN in environment variables."
  );
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug);
}

/**
 * Add a new product. Uses DB when available.
 */
export async function addProduct(
  product: Omit<Product, "id"> & { id?: number }
): Promise<Product> {
  if (hasDatabase()) {
    const dbResult = await upsertProductInDb(persistCatalogFields(product as Product));
    if (dbResult) return dbResult;
  }

  const all = await getProducts();
  const newId = product.id || Math.max(0, ...all.map((p) => p.id)) + 1;
  const newProduct = persistCatalogFields({
    ...product,
    id: newId,
  } as Product);
  all.push(newProduct);
  await saveProducts(all);
  return newProduct;
}

/**
 * Update an existing product. Prefers DB.
 */
export async function updateProduct(
  id: number,
  updates: Partial<Product>
): Promise<Product | null> {
  if (hasDatabase()) {
    const current = await getProducts();
    const existing = current.find((p) => p.id === id);
    if (existing) {
      const updated = persistCatalogFields({ ...existing, ...updates } as Product);
      const dbResult = await upsertProductInDb(updated);
      if (dbResult) return dbResult;
    }
  }

  const all = await getProducts();
  const index = all.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updated = persistCatalogFields({ ...all[index], ...updates } as Product);
  all[index] = updated;
  await saveProducts(all);
  return updated;
}

export async function updateProductStock(id: number, inStock: number): Promise<boolean> {
  if (hasDatabase()) {
    const ok = await updateStockInDb(id, inStock);
    if (ok) return true;
  }
  const result = await updateProduct(id, { inStock });
  return result !== null;
}

/**
 * Atomic stock decrement (DB). Falls back to read-modify-write only without DB.
 * Returns false if insufficient stock or product missing.
 */
export async function decrementProductStock(
  id: number,
  quantity: number,
): Promise<boolean> {
  const qty = Math.floor(Number(quantity) || 0);
  if (qty <= 0) return false;

  if (hasDatabase()) {
    const result = await decrementStockInDb(id, qty);
    return result.ok;
  }

  const products = await getProducts();
  const product = products.find((p) => p.id === id);
  if (!product || product.inStock < qty) return false;
  return updateProductStock(id, product.inStock - qty);
}

export async function deleteProduct(id: number): Promise<boolean> {
  if (hasDatabase()) {
    const ok = await deleteProductFromDb(id);
    if (ok) return true;
  }
  const all = await getProducts();
  const filtered = all.filter((p) => p.id !== id);
  if (filtered.length === all.length) return false;
  await saveProducts(filtered);
  return true;
}

export async function resetToDefaults(): Promise<Product[]> {
  const defaults = getDefaultProducts();
  if (hasDatabase()) {
    await seedProducts(true);
    const fromDb = await getProductsFromDb();
    if (fromDb && fromDb.length > 0) return fromDb;
  }
  await saveProducts(defaults);
  return defaults;
}

/** Force re-seed products from defaults into Postgres (admin action). */
export async function forceSeedProductsToDb(): Promise<number> {
  if (!hasDatabase()) return 0;
  const legacy = await getProductsLegacy();
  if (legacy.length > 0) {
    for (const product of legacy) {
      await upsertProductInDb(product);
    }
    return legacy.length;
  }
  return seedProducts(true);
}