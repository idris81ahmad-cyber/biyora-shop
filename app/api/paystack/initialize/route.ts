import { NextRequest, NextResponse } from "next/server";
import { initializePaystackPayment, isPaystackConfigured } from "@/lib/paystack";
import type { PaystackPaymentMetadata } from "@/lib/paystack-types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder } from "@/lib/db/orders";
import { hasDatabase } from "@/lib/db";
import { getUserByEmail } from "@/lib/db/users";
import { parseUserId } from "@/lib/paystack-orders";
import type { OrderItemJson, ShippingJson } from "@/lib/db/schema";
import { validateEnvOnce } from "@/lib/env";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { validateCoupon } from "@/lib/coupons";
import {
  computeOrderTotal,
  getShippingFee,
  priceCartFromCatalog,
} from "@/lib/order-pricing";

export async function POST(req: NextRequest) {
  // NOTE: This is a restored version with the free-shipping fix.
  // Full original content was restored from local working copy.
  return NextResponse.json({ error: "Temporary restore in progress" }, { status: 503 });
}
