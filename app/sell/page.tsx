"use client";

import { useState } from "react";
import Link from "next/link";

const empty = {
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  state: "Kano",
  city: "",
  fabrics: "Ankara, Lace",
  story: "",
  instagram: "",
};

export default function SellPage() {
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof empty, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send application");
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send application");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-xs tracking-[3px] text-[#C5A46E]">SELL WITH BIYORA</p>
      <h1 className="text-4xl font-semibold tracking-tight mt-2">Bring your cloth to Kantin Kwari's standard</h1>
      <p className="text-[#6B5F54] mt-3 leading-relaxed">
        BIYORA lists its own fabrics first. When a seller is approved, their cloth still passes a Kwari review
        before it appears in the shop. You keep the sale, BIYORA keeps a fee you can see before you join.
      </p>
      <ul className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
        <li className="rounded-2xl border border-[#D4C9B8] bg-white p-4">Apply with your shop details</li>
        <li className="rounded-2xl border border-[#D4C9B8] bg-white p-4">We approve the seller, then each fabric</li>
        <li className="rounded-2xl border border-[#D4C9B8] bg-white p-4">Default fee is 12%. Payouts are recorded in admin</li>
      </ul>

      <form onSubmit={submit} className="mt-8 bg-white border border-[#D4C9B8] rounded-3xl p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Shop name" value={form.shopName} onChange={(v) => set("shopName", v)} />
          <Field label="Your name" value={form.ownerName} onChange={(v) => set("ownerName", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <Field label="Phone / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
        </div>
        <Field label="Fabrics you sell" value={form.fabrics} onChange={(v) => set("fabrics", v)} />
        <label className="block text-sm text-[#6B5F54]">
          Why should BIYORA trust this cloth?
          <textarea
            required
            minLength={20}
            value={form.story}
            onChange={(e) => set("story", e.target.value)}
            rows={4}
            className="mt-1 input-premium w-full rounded-2xl px-4 py-3"
          />
        </label>
        <Field label="Instagram (optional)" value={form.instagram} onChange={(v) => set("instagram", v)} required={false} />
        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-emerald-800">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} className="btn-primary px-6 py-3 rounded-2xl disabled:opacity-60">
            {pending ? "Sending…" : "Submit application"}
          </button>
          <Link href="/seller" className="px-6 py-3 rounded-2xl border border-[#D4C9B8]">
            I already applied
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm text-[#6B5F54]">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 input-premium w-full rounded-2xl px-4 py-3"
      />
    </label>
  );
}
