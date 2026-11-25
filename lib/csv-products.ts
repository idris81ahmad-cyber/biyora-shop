import type { FabricVariant } from "@/lib/catalog-meta";

export interface CsvProductDraft {
  name: string;
  category: string;
  price: number;
  salePrice?: number;
  inStock: number;
  shortDescription: string;
  description: string;
  colorFamily: string;
  patternStyle: string;
  lengthOptions: string[];
  composition: string;
  careInstructions: string;
  originStory: string;
  featured: boolean;
  isNewArrival: boolean;
  listingStatus: "draft" | "published";
  sellerId?: string;
  variants: FabricVariant[];
}

export interface CsvImportResult {
  products: CsvProductDraft[];
  errors: { line: number; message: string }[];
}

const HEADER_ALIASES: Record<string, keyof CsvProductDraft | "lengths" | "care" | "origin" | "status" | "newArrival"> = {
  name: "name",
  category: "category",
  price: "price",
  saleprice: "salePrice",
  sale_price: "salePrice",
  stock: "inStock",
  instock: "inStock",
  shortdescription: "shortDescription",
  short_description: "shortDescription",
  description: "description",
  color: "colorFamily",
  colorfamily: "colorFamily",
  pattern: "patternStyle",
  patternstyle: "patternStyle",
  lengths: "lengths",
  lengthoptions: "lengths",
  composition: "composition",
  material: "composition",
  care: "care",
  careinstructions: "care",
  origin: "origin",
  originstory: "origin",
  featured: "featured",
  new: "newArrival",
  newarrival: "newArrival",
  status: "status",
  seller: "sellerId",
  sellerid: "sellerId",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  pushCell();
  pushRow();
  return rows;
}

function truthy(value: string | undefined): boolean {
  const v = (value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y";
}

function money(value: string | undefined): number {
  const n = Number(String(value || "").replace(/[₦,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export const CSV_TEMPLATE = `name,category,price,salePrice,stock,shortDescription,description,colorFamily,patternStyle,lengths,composition,care,origin,featured,newArrival,status
Royal Indigo Ankara,Ankara Prints,18500,,24,Deep indigo wax with gold geometry,Six-yard Ankara selected in Kantin Kwari.,Indigo,Geometric,5 yards|6 yards,100% cotton wax,Cold wash. Iron reverse.,Kano Nigeria,yes,yes,published
`;

/**
 * Bulk listing format. First row is a header.
 * lengths are separated with | or ; (example: 5 yards|6 yards).
 * price is the shelf price per piece. Optional pricePerYard is ignored here —
 * set yard prices in the admin variant editor after import.
 */
export function parseProductCsv(text: string): CsvImportResult {
  const table = parseCsv(text);
  const errors: CsvImportResult["errors"] = [];
  const products: CsvProductDraft[] = [];
  if (table.length < 2) {
    return { products, errors: [{ line: 1, message: "Add a header row and at least one fabric." }] };
  }

  const header = table[0].map((h) => h.toLowerCase().replace(/[\s_-]/g, ""));
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) index.set(key, i);
  });

  if (!index.has("name") || !index.has("price")) {
    return {
      products,
      errors: [{ line: 1, message: "CSV needs name and price columns." }],
    };
  }

  const cell = (line: string[], key: string) => {
    const i = index.get(key);
    return i === undefined ? "" : (line[i] || "").trim();
  };

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    const lineNo = r + 1;
    const name = cell(line, "name");
    const price = money(cell(line, "price"));
    if (!name) {
      errors.push({ line: lineNo, message: "Missing name" });
      continue;
    }
    if (price <= 0) {
      errors.push({ line: lineNo, message: `${name}: price must be greater than 0` });
      continue;
    }

    const lengths = cell(line, "lengths")
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const statusRaw = cell(line, "status").toLowerCase();
    const listingStatus = statusRaw === "draft" ? "draft" : "published";
    const sale = money(cell(line, "salePrice"));

    products.push({
      name,
      category: cell(line, "category") || "Ankara Prints",
      price,
      salePrice: sale > 0 ? sale : undefined,
      inStock: Math.max(0, money(cell(line, "inStock") || "10")),
      shortDescription: cell(line, "shortDescription") || name,
      description: cell(line, "description") || cell(line, "shortDescription") || name,
      colorFamily: cell(line, "colorFamily") || "Multi",
      patternStyle: cell(line, "patternStyle") || "Print",
      lengthOptions: lengths.length ? lengths : ["5 yards", "6 yards"],
      composition: cell(line, "composition"),
      careInstructions: cell(line, "care"),
      originStory: cell(line, "origin"),
      featured: truthy(cell(line, "featured")),
      isNewArrival: truthy(cell(line, "newArrival")),
      listingStatus,
      sellerId: cell(line, "sellerId") || undefined,
      variants: [],
    });
  }

  return { products, errors };
}
