export interface FabricPreset {
  id: string;
  label: string;
  category: string;
  lengths: string[];
  patternStyle: string;
  colorFamily: string;
  composition: string;
  opacity: string;
  care: string;
  origin: string;
  originNote: string;
  width: string;
}

export const FABRIC_PRESETS: FabricPreset[] = [
  {
    id: "ankara",
    label: "Ankara",
    category: "Ankara Prints",
    lengths: ["5 yards", "6 yards"],
    patternStyle: "Geometric",
    colorFamily: "Gold",
    composition: "100% cotton wax print",
    opacity: "Opaque",
    care: "Hand-wash or gentle machine wash cold. Do not bleach. Iron on medium, reverse side.",
    origin: "Nigeria",
    originNote: "Selected in Kantin Kwari, Kano for colour depth and a crisp hand.",
    width: "46–47 inches",
  },
  {
    id: "lace",
    label: "Lace",
    category: "Premium Lace",
    lengths: ["5 yards", "6 yards"],
    patternStyle: "Floral",
    colorFamily: "Ivory",
    composition: "Cotton lace with sequin or cord embroidery",
    opacity: "Semi-sheer (lining recommended)",
    care: "Dry-clean preferred. Cold hand-wash only if needed. Lay flat to dry. Low iron with a cloth.",
    origin: "Nigeria",
    originNote: "Bridal and asoebi lace inspected for even embroidery before it leaves Kwari.",
    width: "45–50 inches",
  },
  {
    id: "bazin",
    label: "Bazin",
    category: "Bazin",
    lengths: ["5 yards", "10 yards"],
    patternStyle: "Solid",
    colorFamily: "White",
    composition: "100% cotton damask (getzner-style bazin)",
    opacity: "Opaque",
    care: "Cold hand-wash or dry-clean. Iron while slightly damp for a crisp finish. No bleach.",
    origin: "Mali / Nigeria",
    originNote: "Rich bazin for agbada and kaftan, chosen for sheen and body.",
    width: "58–60 inches",
  },
  {
    id: "brocade",
    label: "Brocade",
    category: "Brocade & Damask",
    lengths: ["5 yards", "8 yards"],
    patternStyle: "Damask",
    colorFamily: "Gold",
    composition: "Woven brocade with metallic thread",
    opacity: "Mostly opaque",
    care: "Dry-clean or cold hand-wash. Steam or iron on medium with a cloth. Hang to dry.",
    origin: "Kano, Nigeria",
    originNote: "Woven for ceremonial volume — agbada, senator, and evening wrappers.",
    width: "50–54 inches",
  },
  {
    id: "adire",
    label: "Adire",
    category: "Adire & Tie-Dye",
    lengths: ["5 yards", "6 yards"],
    patternStyle: "Tie-dye",
    colorFamily: "Indigo",
    composition: "Cotton adire (indigo resist)",
    opacity: "Opaque",
    care: "First wash separately in cold water. Mild detergent. Air dry in shade. Iron on reverse.",
    origin: "Abeokuta / Kano",
    originNote: "Resist-dyed cotton with the irregularities that make each piece one of one.",
    width: "44–46 inches",
  },
  {
    id: "atiku",
    label: "Atiku / Shadda",
    category: "Shadda & Atiku",
    lengths: ["5 yards", "8 yards"],
    patternStyle: "Stripe",
    colorFamily: "Sky blue",
    composition: "Premium cotton atiku / shadda",
    opacity: "Mostly opaque",
    care: "Dry-clean recommended. Steam to refresh. Store folded with tissue to protect the sheen.",
    origin: "Kano, Nigeria",
    originNote: "Northern formal cloth for kaftan and senator cuts.",
    width: "58 inches",
  },
];

export function presetById(id: string): FabricPreset | undefined {
  return FABRIC_PRESETS.find((p) => p.id === id);
}
