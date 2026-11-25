import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  addSellerPayout,
  getMarketplace,
  updateSeller,
} from "@/lib/marketplace-store";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const doc = await getMarketplace();
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    id?: string;
    status?: "pending" | "approved" | "rejected";
    commissionPercent?: number;
    adminNote?: string;
    payoutAmount?: number;
    payoutNote?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Seller id required" }, { status: 400 });
  }

  if (body.payoutAmount) {
    const seller = await addSellerPayout(body.id, {
      amount: body.payoutAmount,
      note: body.payoutNote || "Payout",
    });
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    return NextResponse.json(seller);
  }

  const seller = await updateSeller(body.id, {
    status: body.status,
    commissionPercent: body.commissionPercent,
    adminNote: body.adminNote,
  });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  return NextResponse.json(seller);
}
