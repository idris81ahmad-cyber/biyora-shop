import { NextRequest, NextResponse } from "next/server";
import {
  getXaiAgentId,
  getXaiVoiceModel,
  isVoiceEnvReady,
} from "@/lib/env";
import { logger } from "@/lib/logger";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const XAI_CLIENT_SECRETS = "https://api.x.ai/v1/realtime/client_secrets";

function extractSecret(data: Record<string, unknown>): {
  value: string | null;
  expiresAt: number | string | null;
} {
  if (typeof data.value === "string" && data.value) {
    return {
      value: data.value,
      expiresAt:
        typeof data.expires_at === "number" || typeof data.expires_at === "string"
          ? data.expires_at
          : null,
    };
  }
  if (typeof data.client_secret === "string" && data.client_secret) {
    return { value: data.client_secret, expiresAt: null };
  }
  const nested = data.client_secret;
  if (nested && typeof nested === "object") {
    const obj = nested as Record<string, unknown>;
    return {
      value: typeof obj.value === "string" ? obj.value : null,
      expiresAt:
        typeof obj.expires_at === "number" || typeof obj.expires_at === "string"
          ? obj.expires_at
          : null,
    };
  }
  return { value: null, expiresAt: null };
}

/**
 * Mint a short-lived xAI realtime client secret for browser WebSocket auth.
 * The real XAI_API_KEY never leaves the server.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`voice-secret:${ip}`, { limit: 12, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many voice sessions. Please wait a minute." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  if (!isVoiceEnvReady()) {
    return NextResponse.json(
      { error: "Voice support is not configured", code: "voice_not_configured" },
      { status: 503 },
    );
  }

  const apiKey = process.env.XAI_API_KEY!.trim();
  const agentId = getXaiAgentId();
  const model = getXaiVoiceModel();

  try {
    const xaiRes = await fetch(XAI_CLIENT_SECRETS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
      cache: "no-store",
    });

    const raw = (await xaiRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!xaiRes.ok) {
      const xaiError =
        (typeof raw.error === "string" && raw.error) ||
        (typeof raw.message === "string" && raw.message) ||
        (raw.error &&
        typeof raw.error === "object" &&
        typeof (raw.error as { message?: string }).message === "string"
          ? (raw.error as { message: string }).message
          : null) ||
        null;

      logger.error("voice", "xAI client_secrets failed", {
        status: xaiRes.status,
        error: raw.error ?? raw.message ?? raw,
      });

      const invalidKey =
        xaiRes.status === 401 ||
        (xaiError && /incorrect api key|invalid api key|unauthorized/i.test(xaiError));
      const noCredits =
        xaiRes.status === 403 ||
        (xaiError && /credits|licenses|permission/i.test(xaiError));

      let error = "Could not start voice session. Please try again in a moment.";
      let code = "xai_client_secret_failed";
      let hint: string | undefined;

      if (invalidKey) {
        error =
          "Voice API key is invalid. Set a real XAI_API_KEY from console.x.ai in Vercel env, then redeploy.";
        code = "invalid_api_key";
        hint =
          "Keys usually look like xai-… Create one under console.x.ai → API Keys.";
      } else if (noCredits) {
        error =
          "xAI account has no credits yet. Add credits or a license in the xAI console to enable voice.";
        code = "xai_no_credits";
        hint = "https://console.x.ai — Billing / credits for your team.";
      }

      return NextResponse.json(
        {
          error,
          code,
          hint,
          xaiStatus: xaiRes.status,
        },
        { status: invalidKey || noCredits ? 503 : 502, headers: rateLimitHeaders(rl) },
      );
    }

    const { value, expiresAt } = extractSecret(raw);
    if (!value) {
      logger.error("voice", "Unexpected client_secrets response shape", {
        keys: Object.keys(raw),
      });
      return NextResponse.json(
        { error: "Invalid voice token response", code: "invalid_secret" },
        { status: 502, headers: rateLimitHeaders(rl) },
      );
    }

    // snake_case for VoiceSupportButton + camelCase for newer clients
    return NextResponse.json(
      {
        client_secret: value,
        clientSecret: value,
        expires_at: expiresAt,
        expiresAt,
        agent_id: agentId,
        agentId,
        model,
        realtimeUrl: agentId
          ? `wss://api.x.ai/v1/realtime?agent_id=${encodeURIComponent(agentId)}`
          : `wss://api.x.ai/v1/realtime?model=${encodeURIComponent(model)}`,
        protocol: `xai-client-secret.${value}`,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          ...rateLimitHeaders(rl),
        },
      },
    );
  } catch (err) {
    logger.error("voice", "client-secret route error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Voice service unavailable", code: "voice_error" },
      { status: 500 },
    );
  }
}

/** Public readiness probe for the floating button (no secret minted). */
export async function GET() {
  return NextResponse.json({
    ready: isVoiceEnvReady(),
    agentConfigured: Boolean(getXaiAgentId()),
  });
}
