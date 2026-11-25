import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { findSellerByEmail, getMarketplace } from "@/lib/marketplace-store";
import { slugifySeller } from "@/lib/marketplace";
import { getAllOrders } from "@/lib/db/orders";
import { hasDatabase } from "@/lib/db";
import type { OrderItemJson } from "@/lib/db/schema";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const doc = await getMarketplace();
  const seller = findSellerByEmail(doc, session.user.email);
  if (!seller || seller.status !== "approved") {
    return NextResponse.json({ orders: [], seller });
  }
  if (!hasDatabase()) {
    return NextResponse.json({
      orders: [],
      seller,
      message: "Orders appear here once Postgres is connected.",
    });
  }

  const sellerId = slugifySeller(seller.shopName, seller.email);
  const all = await getAllOrders();
  const orders = all
    .map((order) => {
      const items = (order.items as OrderItemJson[]).filter((item) => item.sellerId === sellerId);
      if (!items.length) return null;
      const commission = items.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
      const sales = items.reduce((sum, item) => sum + item.lineTotal, 0);
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        items,
        sales,
        commission,
      };
    })
    .filter(Boolean);

  const earned = orders.reduce((sum, order) => sum + (order?.commission || 0), 0);
  const paid = seller.payouts.reduce((sum, payout) => sum + payout.amount, 0);

  return NextResponse.json({
    orders,
    seller,
    earned,
    paid,
    balance: Math.max(0, earned - paid),
  });
}
