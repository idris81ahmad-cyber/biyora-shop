"use client";

import { useState } from "react";

export default function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const light = tone === "light";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join");
      setMessage(data.message);
      setEmail("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not join");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="text-xs tracking-[1.5px] mb-2 text-[#C5A46E]">NEW ARRIVALS</div>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email for Kwari drops"
          className={`flex-1 min-w-0 rounded-xl px-3 py-2 text-sm ${
            light ? "border border-[#D4C9B8] bg-white" : "bg-white/10 border border-white/15 placeholder:text-white/40"
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl px-3 py-2 text-sm bg-[#C5A46E] text-[#2C2522] font-medium disabled:opacity-60"
        >
          {pending ? "…" : "Join"}
        </button>
      </div>
      {message && <p className="text-xs mt-2 text-[#C5A46E]">{message}</p>}
    </form>
  );
}
