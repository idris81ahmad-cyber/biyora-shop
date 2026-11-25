"use client";

import Link from "next/link";
import { Star, ShoppingCart, Eye } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import WishlistButton from "@/components/WishlistButton";
import StockBadge from "@/components/StockBadge";
import { productImageAlt } from "@/lib/image-blur";
import { Product } from "@/types/product";
import { addToCartWithFeedback } from "@/lib/add-to-cart";
import { useUIStore } from "@/lib/ui-store";
import { readCatalogMeta } from "@/lib/catalog-meta";

interface ProductCardProps {
  product: Product;
  /** LCP: set true for above-the-fold cards (e.g. first home/shop results). */
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const setQuickViewProduct = useUIStore((s) => s.setQuickViewProduct);
  const displayPrice = product.salePrice || product.price;
  const hasSale = !!product.salePrice;
  const meta = readCatalogMeta(product);

  const handleQuickAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    addToCartWithFeedback({
      product,
      imageRect: e.currentTarget.getBoundingClientRect(),
    });
  };

  const openQuickView = () => setQuickViewProduct(product);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Quick view ${product.name}, ₦${displayPrice.toLocaleString()}`}
      onClick={openQuickView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openQuickView();
        }
      }}
      className="group block cursor-pointer rounded-3xl focus-visible:ring-2 focus-visible:ring-[#C5A46E] focus-visible:ring-offset-2"
    >
      <div className="product-card bg-white rounded-3xl overflow-hidden h-full flex flex-col border border-[#D4C9B8] fabric-texture-hover transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3.2] bg-[#F4EDE3] overflow-hidden">
          <ProductImage
            src={product.images[0]}
            alt={productImageAlt(product.name, product.category)}
            fill
            priority={priority}
            quality={priority ? 85 : 75}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 16vw"
            className="group-hover:scale-[1.06] transition-transform duration-700"
          />
          <div className="absolute inset-0 fabric-weave-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
            <WishlistButton product={product} size="sm" />
          </div>

          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
            {hasSale && (
              <div className="sale-badge bg-[#6B2D3C] text-white text-[10px] px-3.5 py-1 rounded-full font-medium tracking-[1px]">
                SALE
              </div>
            )}
            {meta.featured && (
              <div className="bg-[#C5A46E] text-[#2C2522] text-[10px] px-3 py-1 rounded-full font-medium tracking-[1px]">
                FEATURED
              </div>
            )}
            {meta.isNewArrival && !meta.featured && (
              <div className="bg-white/90 text-[#2C2522] text-[10px] px-3 py-1 rounded-full font-medium tracking-[1px]">
                NEW
              </div>
            )}
            <StockBadge inStock={product.inStock} />
          </div>

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all duration-300">
            <div className="opacity-0 group-hover:opacity-100 text-white text-xs tracking-[2px] font-medium bg-black/60 px-4 py-1.5 rounded-full transition flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> QUICK VIEW
            </div>
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex-1">
            <div className="text-xs text-[#C5A46E] tracking-[1px] font-medium mb-px">{product.category}</div>
            <h3 className="font-semibold text-[17px] tracking-[-0.3px] leading-tight line-clamp-2 group-hover:text-[#6B2D3C] transition">
              {product.name}
            </h3>

            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="flex text-[#C5A46E]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>
              <span className="text-xs text-[#6B5F54] font-mono tabular-nums">
                {product.rating} <span className="text-[#A89B8A]">({product.reviewCount})</span>
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                ₦{displayPrice.toLocaleString()}
              </span>
              {hasSale && (
                <span className="text-sm text-[#6B5F54] line-through">₦{product.price.toLocaleString()}</span>
              )}
            </div>

            <div className="text-xs text-[#6B5F54] mt-1">
              {product.lengthOptions.join(" • ")} available
            </div>
          </div>

          <div className="mt-5 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={`Add ${product.name} to cart`}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border border-[#D4C9B8] hover:bg-[#6B2D3C] hover:text-white hover:border-[#6B2D3C] rounded-2xl transition-all active:scale-[0.985] min-h-[44px]"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" /> ADD
            </button>
            <Link
              href={`/products/${product.slug}`}
              aria-label={`View details for ${product.name}`}
              className="px-4 py-3 text-sm border border-[#D4C9B8] rounded-2xl hover:bg-[#F8F4EC] transition min-h-[44px] inline-flex items-center"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}