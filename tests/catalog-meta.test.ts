import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import {
  HOUSE_SELLER_ID,
  isPublicListing,
  persistCatalogFields,
  unitPriceForSelection,
  variantStock,
} from "@/lib/catalog-meta";
import { parseProductCsv } from "@/lib/csv-products";

function sample(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    slug: "indigo-ankara",
    name: "Indigo Ankara",
    category: "Ankara Prints",
    price: 18000,
    images: ["/images/ankara-premium.jpg"],
    rating: 4.8,
    reviewCount: 12,
    shortDescription: "Deep indigo",
    description: "Kwari Ankara",
    inStock: 8,
    colorFamily: "Indigo",
    patternStyle: "Geometric",
    lengthOptions: ["5 yards", "6 yards"],
    specifications: {},
    ...overrides,
  };
}

describe("catalog meta", () => {
  it("keeps legacy products public", () => {
    expect(isPublicListing(sample())).toBe(true);
  });

  it("hides drafts and unapproved seller listings", () => {
    expect(isPublicListing(sample({ listingStatus: "draft" }))).toBe(false);
    expect(isPublicListing(sample({ sellerId: "lace-house", moderation: "pending" }))).toBe(false);
    expect(isPublicListing(sample({ sellerId: "lace-house", moderation: "approved" }))).toBe(true);
  });

  it("round-trips variants through specifications", () => {
    const saved = persistCatalogFields(
      sample({
        listingStatus: "draft",
        featured: true,
        variants: [{ color: "Gold", length: "6 yards", pricePerYard: 4000, stock: 3 }],
        sellerId: HOUSE_SELLER_ID,
      }),
    );
    const restored = persistCatalogFields({
      ...sample(),
      specifications: saved.specifications,
    });
    expect(restored.listingStatus).toBe("draft");
    expect(restored.featured).toBe(true);
    expect(restored.variants?.[0]?.pricePerYard).toBe(4000);
    expect(unitPriceForSelection(restored, "6 yards", "Gold")).toBe(24000);
    expect(variantStock(restored, "6 yards", "Gold")).toBe(3);
  });

  it("prices a cut from yards when variants exist, otherwise the shelf price", () => {
    expect(unitPriceForSelection(sample({ salePrice: 15000 }), "6 yards")).toBe(15000);
  });
});

describe("product csv", () => {
  it("parses a headered fabric sheet", () => {
    const result = parseProductCsv(
      "name,category,price,stock,lengths,featured,status\nGold Lace,Premium Lace,42000,4,5 yards|6 yards,yes,draft\n",
    );
    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      name: "Gold Lace",
      price: 42000,
      inStock: 4,
      featured: true,
      listingStatus: "draft",
      lengthOptions: ["5 yards", "6 yards"],
    });
  });

  it("rejects rows without a price", () => {
    const result = parseProductCsv("name,price\nNo Price,\n");
    expect(result.products).toHaveLength(0);
    expect(result.errors[0]?.message).toMatch(/price/i);
  });
});
