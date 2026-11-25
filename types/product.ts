export interface Product {
  id: number;
  slug: string;
  name: string;
  category: string;
  price: number;
  salePrice?: number;
  images: string[];
  rating: number;
  reviewCount: number;
  shortDescription: string;
  description: string;
  inStock: number;
  colorFamily: string;
  patternStyle: string;
  lengthOptions: string[];
  specifications: Record<string, string>;
  /** Optional legacy / display fields */
  material?: string;
  width?: string;
  weight?: string;
  /** Sheer / opaque — critical for lace & chiffon */
  opacity?: string;
  /** Wash & iron guidance */
  careInstructions?: string;
  /**
   * Occasion tags: asoebi, bridal, everyday, agbada, kaftan, office, gele, evening, senator, wrapper
   */
  bestUses?: string[];
  /** Short origin / artisan story */
  originStory?: string;
  /** draft stays off the shop until you publish */
  listingStatus?: "draft" | "published";
  featured?: boolean;
  isNewArrival?: boolean;
  /** Fibre content, e.g. 100% cotton wax */
  composition?: string;
  seoTitle?: string;
  seoDescription?: string;
  variants?: import("@/lib/catalog-meta").FabricVariant[];
  sellerId?: string;
  sellerName?: string;
  moderation?: "approved" | "pending" | "rejected";
  lowStockThreshold?: number;
  /** Caption per gallery image: Main, Texture, Print… */
  imageNotes?: string[];
  /** Fee kept back for this seller on each sale. House stock is 0. */
  commissionPercent?: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedLength: string;
  currentPrice: number;
}
