import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { addProduct, getProducts } from "@/lib/products-store";
import { parseProductCsv } from "@/lib/csv-products";
import { HOUSE_SELLER_ID } from "@/lib/catalog-meta";
import { logger } from "@/lib/logger";

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { csv?: string };
    const csv = body.csv?.trim();
    if (!csv) {
      return NextResponse.json({ error: "Paste a CSV first." }, { status: 400 });
    }

    const parsed = parseProductCsv(csv);
    if (!parsed.products.length) {
      return NextResponse.json(
        { error: "No fabrics to import.", errors: parsed.errors },
        { status: 400 },
      );
    }

    const existing = await getProducts();
    const slugs = new Set(existing.map((p) => p.slug));
    const created: { name: string; slug: string }[] = [];

    for (const draft of parsed.products) {
      let slug = slugify(draft.name) || `fabric-${Date.now()}`;
      if (slugs.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      slugs.add(slug);

      const product = await addProduct({
        slug,
        name: draft.name,
        category: draft.category,
        price: draft.price,
        salePrice: draft.salePrice,
        images: ["/images/ankara-premium.jpg"],
        rating: 5,
        reviewCount: 0,
        shortDescription: draft.shortDescription,
        description: draft.description,
        inStock: draft.inStock,
        colorFamily: draft.colorFamily,
        patternStyle: draft.patternStyle,
        lengthOptions: draft.lengthOptions,
        specifications: {
          ...(draft.composition ? { Material: draft.composition } : {}),
          ...(draft.careInstructions ? { Care: draft.careInstructions } : {}),
          ...(draft.originStory ? { Origin: draft.originStory } : {}),
        },
        composition: draft.composition,
        careInstructions: draft.careInstructions,
        originStory: draft.originStory,
        featured: draft.featured,
        isNewArrival: draft.isNewArrival,
        listingStatus: draft.listingStatus,
        sellerId: draft.sellerId || HOUSE_SELLER_ID,
        sellerName: "BIYORA SHOP",
        moderation: "approved",
        variants: draft.variants,
      });
      created.push({ name: product.name, slug: product.slug });
    }

    return NextResponse.json({
      created: created.length,
      products: created,
      errors: parsed.errors,
    });
  } catch (error) {
    logger.error("admin-import", "CSV import failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
