import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/products-store";
import { fabricCategories, products as defaultProducts } from "@/lib/products";
import { absoluteUrl } from "@/lib/site";
import { isPublicListing } from "@/lib/catalog-meta";

// Avoid build-time static generation — external Blob/GitHub fetches can exceed 60s
export const dynamic = "force-dynamic";
export const revalidate = 3600;

async function getProductsForSitemap() {
  try {
    return await Promise.race([
      getProducts(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("sitemap product fetch timeout")), 8_000),
      ),
    ]);
  } catch {
    return defaultProducts;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public, indexable marketing & commerce pages only (no cart/auth/checkout)
  const staticPages = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/shop", priority: 0.95, changeFrequency: "daily" as const },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/journal", priority: 0.75, changeFrequency: "weekly" as const },
    { path: "/journal/fabric-care", priority: 0.65, changeFrequency: "monthly" as const },
    { path: "/journal/choosing-lace", priority: 0.65, changeFrequency: "monthly" as const },
    { path: "/journal/styling-tips", priority: 0.65, changeFrequency: "monthly" as const },
    { path: "/journal/meet-artisans", priority: 0.65, changeFrequency: "monthly" as const },
    { path: "/calculator", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/wholesale", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/sell", priority: 0.55, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  ].map(({ path, priority, changeFrequency }) => ({
    url: absoluteUrl(path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  const categoryPages = fabricCategories.map((category) => ({
    url: absoluteUrl(`/shop?category=${encodeURIComponent(category)}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const products = (await getProductsForSitemap()).filter(isPublicListing);
  const productPages = products.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}