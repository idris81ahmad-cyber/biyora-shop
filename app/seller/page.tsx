"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FABRIC_PRESETS } from "@/lib/fabric-presets";
import type { Product } from "@/types/product";
import { listingBadge } from "@/lib/catalog-meta";

interface SellerOrder {
  orderNumber: string;
  status: string;
  sales: number;
  commission: number;
  createdAt: string;
}

export default function SellerDeskPage() {
  const { data: session, status } = useSession();
  const [sellerStatus, setSellerStatus] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    presetId: "ankara",
    price: 18000,
    pricePerYard: 3000,
    inStock: 10,
    shortDescription: "",
    description: "",
    color: "",
    imageUrl: "",
    listingStatus: "published" as "draft" | "published",
  });

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch("/api/seller/products", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || []);
        setSellerStatus(data.seller?.status || "none");
        setShopName(data.seller?.shopName || "");
      })
      .catch(() => setError("Could not load your shop"));
    fetch("/api/seller/orders", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        if (typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => undefined);
  }, [session?.user?.email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const res = await fetch("/api/seller/products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    setProducts((list) => [data.product, ...list]);
    setNotice(
      form.listingStatus === "draft"
        ? "Saved as a draft. It is hidden until you submit it and BIYORA approves."
        : "Submitted for Kwari review. It stays off the shop until BIYORA approves it.",
    );
    setForm((f) => ({ ...f, name: "", shortDescription: "", description: "", imageUrl: "" }));
  };

  if (status === "loading") {
    return <p className="max-w-3xl mx-auto px-6 py-16 text-[#6B5F54]">Checking your account…</p>;
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold">Seller desk</h1>
        <p className="text-[#6B5F54] mt-3">Sign in with the email you used on your application.</p>
        <Link href="/login?callbackUrl=/seller" className="btn-primary inline-block mt-6 px-6 py-3 rounded-2xl">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div>
        <p className="text-xs tracking-[3px] text-[#C5A46E]">SELLER DESK</p>
        <h1 className="text-4xl font-semibold tracking-tight">{shopName || "Your fabrics"}</h1>
        <p className="text-[#6B5F54] mt-2">
          Status: {sellerStatus === "none" ? "no application yet" : sellerStatus}
          {balance !== null ? ` · Commission balance ₦${balance.toLocaleString()}` : ""}
        </p>
      </div>

      {sellerStatus !== "approved" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm">
          {sellerStatus === "none" ? (
            <>
              You have not applied. <Link href="/sell" className="underline">Start an application</Link>.
            </>
          ) : sellerStatus === "pending" ? (
            "BIYORA is still reviewing your shop. You can prepare copy, but listings open after approval."
          ) : (
            "This application was not approved. Write to the shop if you want it reconsidered."
          )}
        </div>
      )}

      {sellerStatus === "approved" && (
        <form onSubmit={submit} className="bg-white border border-[#D4C9B8] rounded-3xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Add a fabric</h2>
          <p className="text-sm text-[#6B5F54]">
            Use a clear main photo, then a close-up of the print. Price per yard fills the length prices. BIYORA reviews before it goes public.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm text-[#6B5F54]">Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
            </label>
            <label className="text-sm text-[#6B5F54]">Template
              <select value={form.presetId} onChange={(e) => setForm({ ...form, presetId: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3">
                {FABRIC_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#6B5F54]">Shelf price (₦)
              <input type="number" required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
            </label>
            <label className="text-sm text-[#6B5F54]">Price per yard (₦)
              <input type="number" required value={form.pricePerYard} onChange={(e) => setForm({ ...form, pricePerYard: Number(e.target.value) })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
            </label>
            <label className="text-sm text-[#6B5F54]">Stock
              <input type="number" required value={form.inStock} onChange={(e) => setForm({ ...form, inStock: Number(e.target.value) })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
            </label>
            <label className="text-sm text-[#6B5F54]">Colour
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
            </label>
          </div>
          <label className="block text-sm text-[#6B5F54]">Short description
            <input required value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
          </label>
          <label className="block text-sm text-[#6B5F54]">Full description
            <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
          </label>
          <label className="block text-sm text-[#6B5F54]">Image URL
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://… or leave blank for a placeholder" className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
          </label>
          <label className="text-sm text-[#6B5F54] flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.listingStatus === "draft"}
              onChange={(e) => setForm({ ...form, listingStatus: e.target.checked ? "draft" : "published" })}
            />
            Save as draft instead of sending for review
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {notice && <p className="text-sm text-emerald-800">{notice}</p>}
          <button className="btn-primary px-6 py-3 rounded-2xl">Save fabric</button>
        </form>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-3">Your listings</h2>
        {products.length === 0 ? (
          <p className="text-sm text-[#6B5F54]">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {products.map((product) => (
              <li key={product.id} className="bg-white border border-[#D4C9B8] rounded-2xl px-4 py-3 flex justify-between gap-3">
                <span>{product.name}</span>
                <span className="text-xs uppercase tracking-wide text-[#6B5F54]">{listingBadge(product) || "Live"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Your orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-[#6B5F54]">No paid orders with your fabrics yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.orderNumber} className="bg-white border border-[#D4C9B8] rounded-2xl px-4 py-3 text-sm flex justify-between gap-3">
                <span>{order.orderNumber} · {order.status}</span>
                <span>₦{order.sales.toLocaleString()} · fee ₦{order.commission.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
