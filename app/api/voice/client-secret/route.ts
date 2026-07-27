import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isVoiceEnvReady } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    if (!isVoiceEnvReady()) {
      return NextResponse.json(
        { error: "Voice support is not configured" },
        { status: 503 },
      );
    }

    const ip = clientIp(req);
    const rl = rateLimit(`voice-secret:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    const apiKey = process.env.XAI_API_KEY!.trim();

    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 }, // 5 minutes is plenty for a support session
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error("voice", "Failed to mint xAI client secret", {
        status: res.status,
        body: text.slice(0, 300),
      });
      return NextResponse.json(
        { error: "Unable to start voice session" },
        { status: 502, headers: rateLimitHeaders(rl) },
      );
    }

    const data = (await res.json()) as {
      value?: string;
      expires_at?: number;
    };

    if (!data.value) {
      return NextResponse.json(
        { error: "Invalid response from voice provider" },
        { status: 502, headers: rateLimitHeaders(rl) },
      );
    }

    return NextResponse.json(
      {
        client_secret: data.value,
        expires_at: data.expires_at,
        agent_id: process.env.XAI_AGENT_ID?.trim() || null,
      },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (e) {
    logger.error("voice", "client-secret route error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Failed to start voice session" }, { status: 500 });
  }
}
