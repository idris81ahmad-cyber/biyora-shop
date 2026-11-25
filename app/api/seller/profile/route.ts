import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { findSellerByEmail, getMarketplace } from "@/lib/marketplace-store";
import { slugifySeller } from "@/lib/marketplace";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const doc = await getMarketplace();
  const seller = findSellerByEmail(doc, session.user.email) ?? null;
  return NextResponse.json({
    email: session.user.email,
    role: session.user.role,
    seller,
    sellerId: seller ? slugifySeller(seller.shopName, seller.email) : null,
  });
}
