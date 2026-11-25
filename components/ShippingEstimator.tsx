"use client";

import { useMemo, useState } from "react";
import { CHECKOUT_STATES, estimateShipping } from "@/lib/shipping";

export default function ShippingEstimator({ subtotal }: { subtotal: number }) {
  const [state, setState] = useState<string>("Kano");
  const estimate = useMemo(() => estimateShipping(state, subtotal), [state, subtotal]);
  const free = estimate.fee === 0;

  return (
    <div className="rounded-2xl border border-[#D4C9B8] bg-[#F8F4EC] p-4">
      <div className="text-xs tracking-[2px] text-[#6B5F54] mb-2">DELIVERY ESTIMATE</div>
      <label className="text-sm text-[#6B5F54] block mb-1.5" htmlFor="ship-state">
        State
      </label>
      <select
        id="ship-state"
        value={state}
        onChange={(e) => setState(e.target.value)}
        className="input-premium w-full rounded-2xl px-4 py-3 bg-white"
      >
        {CHECKOUT_STATES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value="International">International</option>
      </select>
      <p className="mt-3 text-sm text-[#2C2522]">
        <strong>{state === "International" ? "Diaspora shipping" : estimate.label}</strong>
        {" · "}
        {state === "International" ? "7–14 business days, quoted before payment" : estimate.eta}
      </p>
      <p className="text-sm text-[#6B5F54] mt-1">
        {state === "International"
          ? "Message us on WhatsApp with your country. We confirm the courier fee before you pay."
          : free
            ? "Delivery is free on this order (₦75,000 and above)."
            : `From ₦${estimate.fee.toLocaleString()} nationwide. Free delivery from ₦75,000.`}
      </p>
    </div>
  );
}
