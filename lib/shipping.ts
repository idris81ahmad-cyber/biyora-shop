/** Nigerian delivery estimates — fee display helpers + ETA copy */

/** Server + client safe shipping fee (must match Paystack initialize). */
export function getShippingFee(subtotal?: number): number {
  if (typeof subtotal === "number" && Number.isFinite(subtotal) && subtotal >= 75_000) {
    return 0;
  }
  if (typeof process !== "undefined") {
    const fromEnv = Number(process.env.SHIPPING_FEE_NGN);
    if (Number.isFinite(fromEnv) && fromEnv >= 0) return Math.round(fromEnv);
  }
  return 2500;
}

const LAGOS_AREA = new Set(["Lagos", "Ogun", "Oyo", "Osun", "Ondo", "Ekiti"]);
const KANO_ABUJA = new Set([
  "Kano",
  "Abuja",
  "FCT - Abuja",
  "Kaduna",
  "Katsina",
  "Jigawa",
]);
const NORTH = new Set([
  "Bauchi",
  "Gombe",
  "Borno",
  "Yobe",
  "Adamawa",
  "Taraba",
  "Plateau",
  "Niger",
  "Kebbi",
  "Sokoto",
  "Zamfara",
]);

export const CHECKOUT_STATES = [
  "Kano",
  "Abuja",
  "Lagos",
  "Kaduna",
  "Rivers",
  "Oyo",
  "Ogun",
  "Enugu",
  "Anambra",
  "Delta",
  "Edo",
  "Kwara",
  "Other",
] as const;

export interface ShippingEstimate {
  fee: number;
  label: string;
  eta: string;
  /** One-line window for checkout UI */
  windowSummary: string;
}

export function estimateShipping(state: string, subtotal: number): ShippingEstimate {
  const free = subtotal >= 75_000;

  if (KANO_ABUJA.has(state)) {
    return {
      fee: free ? 0 : 2_500,
      label: "Kano & Abuja corridor",
      eta: "2–4 business days",
      windowSummary: "Kano & Abuja: 2–4 business days",
    };
  }
  if (LAGOS_AREA.has(state)) {
    return {
      fee: free ? 0 : 2_500,
      label: "Lagos & Southwest",
      eta: "3–6 business days",
      windowSummary: "Lagos corridor: 3–6 business days",
    };
  }
  if (NORTH.has(state)) {
    return {
      fee: free ? 0 : 2_500,
      label: "Northern Nigeria",
      eta: "2–5 business days",
      windowSummary: "Northern routes: 2–5 business days",
    };
  }
  return {
    fee: free ? 0 : 2_500,
    label: "Nationwide",
    eta: "3–7 business days",
    windowSummary: "Other states: 3–7 business days",
  };
}

/** Static line used in checkout header / FAQ-style strip */
export const DELIVERY_WINDOWS_BLURB =
  "Kano & Abuja: 2–4 days · Lagos: 3–6 days · Other states: 3–7 days";
