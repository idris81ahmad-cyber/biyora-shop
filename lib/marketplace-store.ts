import fs from "fs";
import path from "path";
import { list, put } from "@vercel/blob";
import { logger } from "@/lib/logger";
import {
  emptyMarketplace,
  normalizeMarketplace,
  type MarketplaceDoc,
  type SellerApplication,
  type SellerPayout,
} from "@/lib/marketplace";
import { DEFAULT_SELLER_COMMISSION } from "@/lib/catalog-meta";

const FILE_PATH = "data/marketplace.json";
const BLOB_PATH = "biyora/marketplace.json";
const REPO = "idris81ahmad-cyber/biyora-shop";
const BRANCH = "master";

function dataFile() {
  return path.join(process.cwd(), FILE_PATH);
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readFromFilesystem(): Promise<MarketplaceDoc | null> {
  try {
    const file = dataFile();
    if (!fs.existsSync(file)) return null;
    return normalizeMarketplace(JSON.parse(fs.readFileSync(file, "utf-8")));
  } catch (e) {
    logger.error("marketplace", "filesystem read failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function readFromBlob(): Promise<MarketplaceDoc | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { blobs } = await list({ prefix: BLOB_PATH });
    const blob = blobs.find((b) => b.pathname === BLOB_PATH) ?? blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.downloadUrl, { cache: "no-store" });
    if (!res.ok) return null;
    return normalizeMarketplace(await res.json());
  } catch (e) {
    logger.error("marketplace", "blob read failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function readFromGitHub(): Promise<MarketplaceDoc | null> {
  try {
    const headers = githubHeaders();
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers, cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      if (!data.content) return null;
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return normalizeMarketplace(JSON.parse(decoded));
    }
    const raw = await fetch(
      `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE_PATH}`,
      { cache: "no-store" },
    );
    if (!raw.ok) return null;
    return normalizeMarketplace(await raw.json());
  } catch {
    return null;
  }
}

export async function getMarketplace(): Promise<MarketplaceDoc> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const fromBlob = await readFromBlob();
    if (fromBlob) return fromBlob;
  }
  if (process.env.GITHUB_TOKEN || process.env.VERCEL) {
    const fromGitHub = await readFromGitHub();
    if (fromGitHub) return fromGitHub;
  }
  return (await readFromFilesystem()) ?? emptyMarketplace();
}

async function writeMarketplace(doc: MarketplaceDoc): Promise<void> {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(next, null, 2);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await put(BLOB_PATH, body, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }

  if (process.env.GITHUB_TOKEN) {
    const headers = githubHeaders();
    const metaRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers, cache: "no-store" },
    );
    const meta = metaRes.ok ? await metaRes.json() : null;
    const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "chore: update BIYORA marketplace records",
        content: Buffer.from(body).toString("base64"),
        branch: BRANCH,
        ...(meta?.sha ? { sha: meta.sha } : {}),
      }),
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`Marketplace GitHub write failed: ${err}`);
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Marketplace storage is read-only. Add BLOB_READ_WRITE_TOKEN or GITHUB_TOKEN.",
    );
  }

  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf-8");
}

export async function saveMarketplace(doc: MarketplaceDoc): Promise<MarketplaceDoc> {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  await writeMarketplace(next);
  return next;
}

export function findSellerByEmail(doc: MarketplaceDoc, email: string): SellerApplication | undefined {
  const wanted = email.trim().toLowerCase();
  return doc.applications.find((a) => a.email === wanted);
}

export async function submitSellerApplication(
  input: Omit<SellerApplication, "id" | "status" | "payouts" | "createdAt" | "updatedAt" | "commissionPercent"> & {
    commissionPercent?: number;
  },
): Promise<SellerApplication> {
  const doc = await getMarketplace();
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const existing = findSellerByEmail(doc, email);
  const application: SellerApplication = {
    id: existing?.id || `sel_${Date.now().toString(36)}`,
    shopName: input.shopName.trim(),
    ownerName: input.ownerName.trim(),
    email,
    phone: input.phone.trim(),
    state: input.state.trim(),
    city: input.city.trim(),
    fabrics: input.fabrics.trim(),
    story: input.story.trim(),
    instagram: input.instagram?.trim() || undefined,
    status: existing?.status === "approved" ? "approved" : "pending",
    commissionPercent: existing?.commissionPercent ?? input.commissionPercent ?? DEFAULT_SELLER_COMMISSION,
    adminNote: existing?.adminNote,
    payouts: existing?.payouts ?? [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const applications = existing
    ? doc.applications.map((a) => (a.email === email ? application : a))
    : [...doc.applications, application];
  await saveMarketplace({ ...doc, applications });
  return application;
}

export async function updateSeller(
  id: string,
  patch: Partial<Pick<SellerApplication, "status" | "commissionPercent" | "adminNote">>,
): Promise<SellerApplication | null> {
  const doc = await getMarketplace();
  const current = doc.applications.find((a) => a.id === id);
  if (!current) return null;
  const next: SellerApplication = {
    ...current,
    ...patch,
    commissionPercent:
      patch.commissionPercent === undefined
        ? current.commissionPercent
        : Math.min(80, Math.max(0, Math.round(patch.commissionPercent))),
    updatedAt: new Date().toISOString(),
  };
  await saveMarketplace({
    ...doc,
    applications: doc.applications.map((a) => (a.id === id ? next : a)),
  });
  return next;
}

export async function addSellerPayout(
  id: string,
  payout: Omit<SellerPayout, "id" | "paidAt"> & { paidAt?: string },
): Promise<SellerApplication | null> {
  const doc = await getMarketplace();
  const current = doc.applications.find((a) => a.id === id);
  if (!current) return null;
  const amount = Math.round(Number(payout.amount) || 0);
  if (amount <= 0) return null;
  const next: SellerApplication = {
    ...current,
    payouts: [
      ...current.payouts,
      {
        id: `pay_${Date.now().toString(36)}`,
        amount,
        note: payout.note?.trim() || "Payout",
        paidAt: payout.paidAt || new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  await saveMarketplace({
    ...doc,
    applications: doc.applications.map((a) => (a.id === id ? next : a)),
  });
  return next;
}

export async function addSubscriber(email: string): Promise<{ ok: true; already: boolean }> {
  const doc = await getMarketplace();
  const clean = email.trim().toLowerCase();
  if (doc.subscribers.includes(clean)) return { ok: true, already: true };
  await saveMarketplace({ ...doc, subscribers: [...doc.subscribers, clean] });
  return { ok: true, already: false };
}
