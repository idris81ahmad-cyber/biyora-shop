/**
 * Startup / request-time environment validation for critical BIYORA config.
 * Soft checks (warnings) vs hard checks (isConfigured helpers used by routes).
 */

import { logger } from "@/lib/logger";

export type EnvReport = {
  ok: boolean;
  missingCritical: string[];
  missingOptional: string[];
  warnings: string[];
  flags: {
    database: boolean;
    paystack: boolean;
    nextAuth: boolean;
    email: boolean;
    blob: boolean;
    voice: boolean;
  };
};

function present(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/** Normalize Neon/Vercel Postgres URL aliases into POSTGRES_URL for @vercel/postgres. */
export function ensureDatabaseUrl(): string | null {
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      "";
  }
  if (!process.env.POSTGRES_URL) {
    delete process.env.POSTGRES_URL;
    return null;
  }
  return process.env.POSTGRES_URL;
}

export function getEnvReport(): EnvReport {
  ensureDatabaseUrl();

  const missingCritical: string[] = [];
  const missingOptional: string[] = [];
  const warnings: string[] = [];

  if (!present("NEXTAUTH_SECRET")) missingCritical.push("NEXTAUTH_SECRET");
  if (!present("PAYSTACK_SECRET_KEY")) missingCritical.push("PAYSTACK_SECRET_KEY");
  if (!present("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY")) {
    missingCritical.push("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY");
  }
  if (!present("POSTGRES_URL") && !present("DATABASE_URL")) {
    missingCritical.push("POSTGRES_URL|DATABASE_URL");
  }

  if (!present("NEXT_PUBLIC_SITE_URL")) {
    missingOptional.push("NEXT_PUBLIC_SITE_URL");
    warnings.push(
      "NEXT_PUBLIC_SITE_URL missing — Paystack callback may use a deployment-specific URL",
    );
  }
  if (!present("RESEND_API_KEY")) {
    missingOptional.push("RESEND_API_KEY");
    warnings.push("RESEND_API_KEY missing — order emails run in demo/log mode");
  } else {
    const from = process.env.RESEND_FROM_EMAIL || "";
    if (!from.trim()) {
      missingOptional.push("RESEND_FROM_EMAIL");
      warnings.push(
        "RESEND_FROM_EMAIL missing — defaults to onboarding@resend.dev (limited delivery)",
      );
    } else if (from.includes("onboarding@resend.dev") && process.env.NODE_ENV === "production") {
      warnings.push(
        "RESEND_FROM_EMAIL uses onboarding@resend.dev — verify a domain for production delivery",
      );
    }
  }
  if (!present("BLOB_READ_WRITE_TOKEN")) {
    missingOptional.push("BLOB_READ_WRITE_TOKEN");
  }
  if (!present("XAI_API_KEY")) {
    missingOptional.push("XAI_API_KEY");
  } else if (!present("XAI_AGENT_ID") && !present("XAI_VOICE_MODEL")) {
    warnings.push(
      "XAI_API_KEY set but XAI_AGENT_ID (or XAI_VOICE_MODEL) missing — voice will use grok-voice-latest",
    );
  }
  if (!present("NEXTAUTH_URL") && process.env.NODE_ENV === "production") {
    missingOptional.push("NEXTAUTH_URL");
    warnings.push("NEXTAUTH_URL should be set in production for correct auth callbacks");
  }

  const pub = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  const sec = process.env.PAYSTACK_SECRET_KEY || "";
  if (pub && sec) {
    const pubTest = pub.includes("_test_");
    const secTest = sec.includes("_test_");
    if (pubTest !== secTest) {
      warnings.push("Paystack public/secret key modes mismatch (test vs live)");
    }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (site.includes("localhost") && process.env.VERCEL === "1") {
    warnings.push("NEXT_PUBLIC_SITE_URL is localhost on Vercel — fix production env");
  }

  return {
    ok: missingCritical.length === 0,
    missingCritical,
    missingOptional,
    warnings,
    flags: {
      database: Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL),
      paystack: present("PAYSTACK_SECRET_KEY") && present("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"),
      nextAuth: present("NEXTAUTH_SECRET"),
      email: present("RESEND_API_KEY"),
      blob: present("BLOB_READ_WRITE_TOKEN"),
      voice: isVoiceEnvReady(),
    },
  };
}

let validatedOnce = false;

/** Log a one-time env report (safe for serverless cold starts). */
export function validateEnvOnce(): EnvReport {
  const report = getEnvReport();
  if (validatedOnce) return report;
  validatedOnce = true;

  if (report.missingCritical.length) {
    logger.error("env", "Missing critical environment variables", {
      missing: report.missingCritical,
    });
  }
  for (const w of report.warnings) {
    logger.warn("env", w);
  }
  logger.info("env", "Environment status", {
    ok: report.ok,
    flags: report.flags,
  });
  return report;
}

export function isPaystackEnvReady(): boolean {
  return present("PAYSTACK_SECRET_KEY");
}

export function isDatabaseEnvReady(): boolean {
  return Boolean(ensureDatabaseUrl());
}

export function isEmailEnvReady(): boolean {
  return present("RESEND_API_KEY");
}

/** Grok Voice: server mints ephemeral client secrets with XAI_API_KEY only. */
export function isVoiceEnvReady(): boolean {
  return present("XAI_API_KEY");
}

export function getXaiAgentId(): string | null {
  const id = process.env.XAI_AGENT_ID?.trim();
  return id || null;
}

export function getXaiVoiceModel(): string {
  return process.env.XAI_VOICE_MODEL?.trim() || "grok-voice-latest";
}
