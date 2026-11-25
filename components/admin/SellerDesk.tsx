"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/types/product";
import { listingBadge, readCatalogMeta } from "@/lib/catalog-meta";
import type { SellerApplication } from "@/lib/marketplace";

export default function SellerDesk({ products }: { products: Product[] }) {
  const [sellers, setSellers] = useState<SellerApplication[]>([]);
  const [subscribers, setSubscribers] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/marketplace", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load sellers");
      setSellers(data.applications || []);
      setSubscribers((data.subscribers || []).length);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sellers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patchSeller = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/marketplace", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Update failed");
      return;
    }
    toast.success("Seller updated");
    await load();
  };

  const moderate = async (product: Product, moderation: "approved" | "rejected") => {
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moderation,
        listingStatus: moderation === "approved" ? "published" : "draft",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Could not update listing");
      return;
    }
    toast.success(moderation === "approved" ? "Listing approved" : "Listing held back");
    window.location.reload();
  };

  const queue = products.filter((p) => readCatalogMeta(p).moderation === "pending");

  if (loading) return <p className="text-[#6B5F54]">Loading seller desk…</p>;

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Applications" value={String(sellers.length)} />
        <Stat label="Awaiting fabric review" value={String(queue.length)} />
        <Stat label="Newsletter" value={String(subscribers)} />
      </div>

      <section className="bg-white border border-[#D4C9B8] rounded-3xl p-6">
        <h2 className="text-xl font-semibold mb-1">Kwari review queue</h2>
        <p className="text-sm text-[#6B5F54] mb-4">
          Seller fabrics stay off the shop until you approve them. Your own uploads are already approved.
        </p>
        {queue.length === 0 ? (
          <p className="text-sm text-[#6B5F54]">Nothing waiting.</p>
        ) : (
          <ul className="space-y-3">
            {queue.map((product) => {
              const meta = readCatalogMeta(product);
              return (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#D4C9B8] rounded-2xl px-4 py-3">
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-[#6B5F54]">
                      {meta.sellerName || meta.sellerId} · {listingBadge(product)} · {product.inStock} in stock
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => moderate(product, "approved")} className="px-3 py-2 text-sm rounded-xl bg-[#6B2D3C] text-white">
                      Approve
                    </button>
                    <button type="button" onClick={() => moderate(product, "rejected")} className="px-3 py-2 text-sm rounded-xl border">
                      Hold
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[#D4C9B8] rounded-3xl p-6">
        <h2 className="text-xl font-semibold mb-4">Seller applications</h2>
        {sellers.length === 0 ? (
          <p className="text-sm text-[#6B5F54]">No applications yet. Share /sell when you are ready.</p>
        ) : (
          <div className="space-y-4">
            {sellers.map((seller) => (
              <article key={seller.id} className="border border-[#D4C9B8] rounded-2xl p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{seller.shopName}</h3>
                    <p className="text-sm text-[#6B5F54]">
                      {seller.ownerName} · {seller.email} · {seller.city}, {seller.state}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full bg-[#F8F4EC]">{seller.status}</span>
                </div>
                <p className="text-sm mt-2">{seller.fabrics}</p>
                <p className="text-sm text-[#6B5F54] mt-1">{seller.story}</p>
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <label className="text-xs text-[#6B5F54]">
                    Fee %
                    <input
                      type="number"
                      defaultValue={seller.commissionPercent}
                      className="ml-2 w-16 border rounded-lg px-2 py-1"
                      onBlur={(e) => patchSeller(seller.id, { commissionPercent: Number(e.target.value) })}
                    />
                  </label>
                  {seller.status !== "approved" && (
                    <button type="button" className="px-3 py-2 text-sm rounded-xl bg-[#6B2D3C] text-white" onClick={() => patchSeller(seller.id, { status: "approved" })}>
                      Approve seller
                    </button>
                  )}
                  {seller.status !== "rejected" && (
                    <button type="button" className="px-3 py-2 text-sm rounded-xl border" onClick={() => patchSeller(seller.id, { status: "rejected" })}>
                      Decline
                    </button>
                  )}
                  <PayoutForm onPay={(amount, note) => patchSeller(seller.id, { payoutAmount: amount, payoutNote: note })} />
                </div>
                {seller.payouts.length > 0 && (
                  <p className="text-xs text-[#6B5F54] mt-2">
                    Paid out ₦{seller.payouts.reduce((s, p) => s + p.amount, 0).toLocaleString()} across {seller.payouts.length} transfer{seller.payouts.length === 1 ? "" : "s"}.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#D4C9B8] rounded-2xl p-5">
      <div className="text-sm text-[#6B5F54]">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function PayoutForm({ onPay }: { onPay: (amount: number, note: string) => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Bank transfer");
  return (
    <form
      className="flex gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Math.round(Number(amount));
        if (!value) return;
        onPay(value, note);
        setAmount("");
      }}
    >
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Payout ₦"
        className="w-28 border rounded-lg px-2 py-1 text-sm"
      />
      <input value={note} onChange={(e) => setNote(e.target.value)} className="w-32 border rounded-lg px-2 py-1 text-sm" />
      <button type="submit" className="text-sm px-3 py-1.5 rounded-lg border">Record</button>
    </form>
  );
}
