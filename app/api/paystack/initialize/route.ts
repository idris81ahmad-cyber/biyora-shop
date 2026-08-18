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
  const limited = rateLimit(`paystack-init:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: rateLimitHeaders(limited) },
    );
  }

  try {
    validateEnvOnce();
  } catch (e) {
    logger.error("paystack-init", "env validation failed", e);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  let body: {
    email?: string;
    amount?: number;
    metadata?: PaystackPaymentMetadata & {
      cartItems?: Array<Partial<OrderItemJson> & { productId?: number; name?: string }>;
      couponCode?: string;
      shipping?: {
        fullName?: string;
        phone?: string;
        address?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const amount = body.amount;
  const metadata = body.metadata || {};
  const rawCartItems = metadata.cartItems || [];

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  let userId: number | null = null;
  if (session?.user?.email) {
    const user = await getUserByEmail(session.user.email);
    userId = user?.id ?? null;
  }

  const shipping: ShippingJson = {
    fullName: metadata.shipping?.fullName || "",
    phone: metadata.shipping?.phone || "",
    address: metadata.shipping?.address || "",
    city: metadata.shipping?.city || "",
    state: metadata.shipping?.state || "",
    postalCode: metadata.shipping?.postalCode,
    country: metadata.shipping?.country || "Nigeria",
  };

  if (!shipping.phone || !shipping.address || !shipping.city || !shipping.state) {
    return NextResponse.json(
      { error: "Complete shipping details are required before payment" },
      { status: 400 },
    );
  }

  // Server-side pricing from catalog — ignore client unitPrice / lineTotal / subtotal
  const priced = await priceCartFromCatalog(rawCartItems);
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: 400 });
  }
  const cartItems = priced.items;
  const subtotal = priced.subtotal;

  // Shipping fee is server-owned (clients cannot lower it)
  const shippingFee = getShippingFee(subtotal);

  // Re-validate coupon against server subtotal
  let discount = 0;
  let couponCode: string | undefined;
  const rawCoupon = metadata.couponCode?.trim();
  if (rawCoupon) {
    const result = validateCoupon(rawCoupon, subtotal);
    if (!result.valid) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    discount = result.discount;
    couponCode = result.coupon.code;
  }

  const expectedTotal = computeOrderTotal({ subtotal, shippingFee, discount });
  const clientTotal = Math.round(Number(amount));
  if (Math.abs(clientTotal - expectedTotal) > 1) {
    logger.warn("paystack-init", "Client total rejected", {
      clientTotal,
      expectedTotal,
      subtotal,
      shippingFee,
      discount,
    });
    return NextResponse.json(
      { error: "Cart total mismatch. Please refresh and try again." },
      { status: 400 },
    );
  }

  // Create pending order before initializing payment
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const order = await createOrder({
    userId,
    email,
    items: cartItems,
    subtotal,
    shippingFee,
    discount,
    total: expectedTotal,
    shipping,
    couponCode,
    status: "pending",
  });

  if (!order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  const init = await initializePaystackPayment({
    email,
    amount: expectedTotal * 100, // kobo
    metadata: {
      ...metadata,
      orderId: order.id,
      orderReference: order.reference,
      cartItems,
      couponCode,
      shipping,
    },
    callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?reference={reference}`,
  });

  if (!init?.authorization_url) {
    logger.error("paystack-init", "Paystack initialize failed", init);
    return NextResponse.json({ error: "Could not start payment" }, { status: 502 });
  }

  return NextResponse.json({
    authorization_url: init.authorization_url,
    access_code: init.access_code,
    reference: init.reference,
    orderId: order.id,
  });
}
