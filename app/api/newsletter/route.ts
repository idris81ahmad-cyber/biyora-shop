import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { addSubscriber } from "@/lib/marketplace-store";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(`news:${clientIp(req)}`, { limit: 8, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Please try again later." }, { status: 429 });
  }
  try {
    const { email } = schema.parse(await req.json());
    const result = await addSubscriber(email);
    return NextResponse.json(
      {
        ok: true,
        already: result.already,
        message: result.already
          ? "You are already on the list."
          : "You are on the early-access list. We will write when new Kwari cloth lands.",
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Could not save email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
