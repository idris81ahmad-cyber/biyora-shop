import type { Product } from "@/types/product";

/** Occasion / outfit tags used for education + recommendations */
export const OCCASION_LABELS: Record<string, string> = {
  asoebi: "Asoebi / Owambe",
  bridal: "Bridal",
  everyday: "Everyday",
  agbada: "Agbada",
  kaftan: "Kaftan",
  office: "Office / Smart",
  gele: "Gele / Headtie",
  evening: "Evening wear",
  senator: "Senator / Formal",
  wrapper: "Iro & Buba",
};

export function formatOccasion(tag: string): string {
  return OCCASION_LABELS[tag.toLowerCase()] || tag;
}

export function defaultCare(category: string): string {
  const map: Record<string, string> = {
    "Ankara Prints":
      "Hand-wash or gentle machine wash cold. Do not bleach. Iron on medium (reverse side). Avoid high heat in dryer.",
    "Premium Lace":
      "Dry-clean preferred. If washing, cold hand-wash only. Lay flat to dry. Iron on low with a pressing cloth.",
    "Brocade & Damask":
      "Dry-clean or cold hand-wash. Steam or iron on medium with cloth. Hang to dry — avoid wringing.",
    "Adire & Tie-Dye":
      "First wash separately in cold water (colour may bleed). Mild detergent. Air dry in shade. Iron on reverse.",
    "Silk, Chiffon & Voile":
      "Cold hand-wash or dry-clean. Never wring. Dry flat or hang in shade. Cool iron if needed.",
    "Plain & Solid Premium Cottons":
      "Machine wash cold. Tumble low or air dry. Iron medium-hot. Pre-wash before sewing for shrinkage.",
    "Shadda & Atiku":
      "Dry-clean recommended. Steam to refresh. Store folded with tissue to protect sheen.",
    Bazin:
      "Cold hand-wash or dry-clean. Iron while slightly damp for crisp finish. Avoid bleach.",
  };
  return (
    map[category] ||
    "Follow garment care label after sewing. Cold wash preferred for African textiles. Air dry when possible."
  );
}

export function defaultUses(category: string): string[] {
  const map: Record<string, string[]> = {
    "Ankara Prints": ["asoebi", "wrapper", "everyday", "office"],
    "Premium Lace": ["bridal", "asoebi", "evening", "gele"],
    "Brocade & Damask": ["agbada", "kaftan", "senator", "asoebi"],
    "Adire & Tie-Dye": ["everyday", "wrapper", "office", "asoebi"],
    "Silk, Chiffon & Voile": ["gele", "evening", "bridal", "everyday"],
    "Plain & Solid Premium Cottons": ["senator", "everyday", "office", "wrapper"],
    "Shadda & Atiku": ["agbada", "kaftan", "senator"],
    Bazin: ["agbada", "kaftan", "senator", "asoebi"],
  };
  return map[category] || ["everyday", "asoebi"];
}

export function defaultOpacity(category: string): string {
  if (category === "Premium Lace") return "Semi-sheer (lining recommended)";
  if (category === "Silk, Chiffon & Voile") return "Sheer to semi-sheer (lining recommended)";
  if (category === "Adire & Tie-Dye" || category === "Ankara Prints") return "Opaque";
  if (category === "Plain & Solid Premium Cottons") return "Opaque";
  return "Mostly opaque";
}

export function defaultOriginStory(product: Product): string {
  const origin =
    product.specifications?.["Origin"] || product.originStory || "West Africa";
  return `Sourced with care for BIYORA SHOP from ${origin}. Selected for colour depth, hand-feel, and how it sews for Nigerian and diaspora wardrobes.`;
}

function parseList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;|/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fill education fields from explicit props or specifications JSON (DB-safe).
 */
export function hydrateProduct(product: Product): Product {
  const s = product.specifications || {};
  const bestUses =
    product.bestUses && product.bestUses.length > 0
      ? product.bestUses
      : parseList(s["Best uses"] || s["Best Uses"] || s["Occasions"]);

  const care =
    product.careInstructions ||
    s["Care"] ||
    s["Care instructions"] ||
    defaultCare(product.category);

  const originStory =
    product.originStory ||
    s["Artisan note"] ||
    s["Origin story"] ||
    defaultOriginStory(product);

  const width = product.width || s["Width"];
  const weight = product.weight || s["Weight"];
  const opacity =
    product.opacity || s["Opacity"] || defaultOpacity(product.category);

  const uses = bestUses.length > 0 ? bestUses : defaultUses(product.category);

  // Keep specifications complete for admin/spec table display
  const specifications: Record<string, string> = {
    ...s,
    ...(width ? { Width: width } : {}),
    ...(weight ? { Weight: weight } : {}),
    ...(opacity ? { Opacity: opacity } : {}),
    Care: care,
    "Best uses": uses.map(formatOccasion).join(", "),
    "Artisan note": originStory,
  };

  return {
    ...product,
    careInstructions: care,
    bestUses: uses,
    originStory,
    width,
    weight,
    opacity,
    specifications,
  };
}

/** Spec keys to show first in the product education grid */
export const HIGHLIGHT_SPEC_KEYS = ["Width", "Weight", "Opacity", "Material", "Origin"] as const;

/** Keys already featured elsewhere — hide from dense specs table */
export const EDUCATION_FEATURED_SPEC_KEYS = [
  "Width",
  "Weight",
  "Opacity",
  "Material",
  "Origin",
  "Care",
  "Care instructions",
  "Best uses",
  "Best Uses",
  "Occasions",
  "Artisan note",
  "Origin story",
] as const;

/** Split care prose into short scannable steps */
export function parseCareSteps(care: string, max = 5): string[] {
  const cleaned = care.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?])\s+|\s*;\s*|\s+—\s+|\s+-\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[•\-\d.)\s]+/, "").trim())
    .filter((s) => s.length > 3);
  if (parts.length <= 1) {
    // Fallback: split on "and" clauses only if long
    if (cleaned.length > 90) {
      return cleaned
        .split(/\.\s+/)
        .map((s) => s.trim().replace(/\.$/, ""))
        .filter(Boolean)
        .slice(0, max);
    }
    return [cleaned.replace(/\.$/, "")];
  }
  return parts.slice(0, max).map((s) => s.replace(/\.$/, ""));
}

export type OpacityLevel = {
  label: string;
  /** 1–4 fill segments for the opacity meter */
  fill: 1 | 2 | 3 | 4;
  tip?: string;
};

export function opacityLevel(opacity?: string): OpacityLevel {
  const t = (opacity || "").toLowerCase();
  if (t.includes("sheer") && !t.includes("semi") && !t.includes("mostly")) {
    return {
      label: opacity || "Sheer",
      fill: 1,
      tip: "Lining is strongly recommended for outfits and asoebi.",
    };
  }
  if (t.includes("semi")) {
    return {
      label: opacity || "Semi-sheer",
      fill: 2,
      tip: "Most bridal and asoebi looks need lining — confirm with your tailor.",
    };
  }
  if (t.includes("mostly")) {
    return {
      label: opacity || "Mostly opaque",
      fill: 3,
      tip: "Usually fine without full lining; still check under strong light.",
    };
  }
  if (t.includes("opaque")) {
    return {
      label: opacity || "Opaque",
      fill: 4,
      tip: "Solid coverage — great for structured silhouettes and day wear.",
    };
  }
  return {
    label: opacity || "See details",
    fill: 3,
  };
}

/** Short blurb under each occasion chip for scannability */
export const OCCASION_HINTS: Record<string, string> = {
  asoebi: "Group colours & owambe",
  bridal: "White, ivory & reception",
  everyday: "Daily polish",
  agbada: "Ceremonial volume",
  kaftan: "Relaxed luxury",
  office: "Work-ready cuts",
  gele: "Headwrap drama",
  evening: "Night events",
  senator: "Formal men’s wear",
  wrapper: "Iro, buba & skirts",
};

export function occasionHint(tag: string): string | undefined {
  return OCCASION_HINTS[tag.toLowerCase()];
}
