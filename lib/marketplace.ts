export interface SellerPayout {
  id: string;
  amount: number;
  note: string;
  paidAt: string;
}

export interface SellerApplication {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  fabrics: string;
  story: string;
  instagram?: string;
  status: "pending" | "approved" | "rejected";
  commissionPercent: number;
  adminNote?: string;
  payouts: SellerPayout[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceDoc {
  applications: SellerApplication[];
  subscribers: string[];
  updatedAt: string;
}

export function emptyMarketplace(): MarketplaceDoc {
  return {
    applications: [],
    subscribers: [],
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeMarketplace(raw: unknown): MarketplaceDoc {
  const base = emptyMarketplace();
  if (!raw || typeof raw !== "object") return base;
  const doc = raw as Partial<MarketplaceDoc>;
  return {
    applications: Array.isArray(doc.applications) ? doc.applications.map(normalizeApplication) : [],
    subscribers: Array.isArray(doc.subscribers)
      ? [...new Set(doc.subscribers.map((e) => String(e).trim().toLowerCase()).filter(Boolean))]
      : [],
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : base.updatedAt,
  };
}

function normalizeApplication(raw: SellerApplication): SellerApplication {
  return {
    ...raw,
    email: (raw.email || "").trim().toLowerCase(),
    commissionPercent: Math.min(80, Math.max(0, Math.round(Number(raw.commissionPercent) || 12))),
    payouts: Array.isArray(raw.payouts) ? raw.payouts : [],
    status: raw.status === "approved" || raw.status === "rejected" ? raw.status : "pending",
  };
}

export function slugifySeller(shopName: string, email: string): string {
  const base = shopName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const tail = email.split("@")[0]?.replace(/[^a-z0-9]/g, "").slice(0, 8) || "shop";
  return `${base || "seller"}-${tail}`;
}
