import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { submitSellerApplication } from "@/lib/marketplace-store";

const schema = z.object({
  shopName: z.string().min(2).max(80),
  ownerName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  state: z.string().min(2).max(40),
  city: z.string().min(2).max(40),
  fabrics: z.string().min(2).max(200),
  story: z.string().min(20).max(800),
  instagram: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`sell:${ip}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many applications from this network. Try again later." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  try {
    const data = schema.parse(await req.json());
    const application = await submitSellerApplication(data);
    return NextResponse.json(
      {
        ok: true,
        status: application.status,
        message:
          application.status === "approved"
            ? "Your shop is already approved. Open the seller desk to add fabrics."
            : "Application received. BIYORA will review it before your fabrics go live.",
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Check the form" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not save application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
