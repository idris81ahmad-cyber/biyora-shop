import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession, authOptions } from "@/lib/auth";
import { findSellerByEmail, getMarketplace } from "@/lib/marketplace-store";
import { slugifySeller } from "@/lib/marketplace";
import { addProduct, getProducts } from "@/lib/products-store";
import { readCatalogMeta } from "@/lib/catalog-meta";
import { presetById } from "@/lib/fabric-presets";

const schema = z.object({
  name: z.string().min(2),
  presetId: z.string().optional(),
  category: z.string().min(2).optional(),
  price: z.number().positive(),
  pricePerYard: z.number().positive().optional(),
  inStock: z.number().int().min(0).max(100000),
  shortDescription: z.string().min(8),
  description: z.string().min(8),
  lengths: z.array(z.string()).min(1).optional(),
  color: z.string().min(2).optional(),
  imageUrl: z.string().optional(),
  listingStatus: z.enum(["draft", "published"]).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const doc = await getMarketplace();
  const seller = findSellerByEmail(doc, session.user.email);
  if (!seller) return NextResponse.json({ products: [], seller: null });
  const sellerId = slugifySeller(seller.shopName, seller.email);
  const products = (await getProducts()).filter((p) => readCatalogMeta(p).sellerId === sellerId);
  return NextResponse.json({ products, seller, sellerId });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const doc = await getMarketplace();
  const seller = findSellerByEmail(doc, session.user.email);
  if (!seller || seller.status !== "approved") {
    return NextResponse.json(
      { error: "Your seller application is not approved yet." },
      { status: 403 },
    );
  }

  try {
    const body = schema.parse(await req.json());
    const preset = body.presetId ? presetById(body.presetId) : undefined;
    const lengths = body.lengths?.length ? body.lengths : preset?.lengths || ["5 yards", "6 yards"];
    const pricePerYard = body.pricePerYard && body.pricePerYard > 0 ? Math.round(body.pricePerYard) : undefined;
    const variants = pricePerYard
      ? lengths.map((length) => ({
          color: body.color || preset?.colorFamily || "As shown",
          length,
          pricePerYard,
          stock: body.inStock,
        }))
      : [];
    const sellerId = slugifySeller(seller.shopName, seller.email);
    const slugBase = body.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const image = body.imageUrl?.trim() || "/images/ankara-premium.jpg";
    const listingStatus = body.listingStatus || "published";

    const product = await addProduct({
      slug: `${slugBase}-${sellerId}`.slice(0, 80),
      name: body.name.trim(),
      category: body.category || preset?.category || "Ankara Prints",
      price: Math.round(body.price),
      images: [image],
      imageNotes: ["Main"],
      rating: 5,
      reviewCount: 0,
      shortDescription: body.shortDescription.trim(),
      description: body.description.trim(),
      inStock: body.inStock,
      colorFamily: body.color || preset?.colorFamily || "Multi",
      patternStyle: preset?.patternStyle || "Print",
      lengthOptions: lengths,
      specifications: {
        Material: preset?.composition || "",
        Origin: preset?.origin || seller.city,
        Care: preset?.care || "",
        Opacity: preset?.opacity || "",
      },
      composition: preset?.composition,
      careInstructions: preset?.care,
      originStory: preset?.originNote || seller.story,
      variants,
      sellerId,
      sellerName: seller.shopName,
      moderation: "pending",
      listingStatus,
      featured: false,
      isNewArrival: true,
      commissionPercent: seller.commissionPercent,
      lowStockThreshold: 5,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Check the form" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not save fabric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
