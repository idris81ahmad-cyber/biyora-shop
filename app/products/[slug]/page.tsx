"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/product";
import { productImageAlt } from "@/lib/image-blur";
import { motion, AnimatePresence } from "framer-motion";
import WishlistButton from "@/components/WishlistButton";
import RecentlyViewed from "@/components/RecentlyViewed";
import { addToCartWithFeedback } from "@/lib/add-to-cart";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { getSmartRelatedProducts, relatedReason } from "@/lib/related-products";
import { formatOccasion, hydrateProduct } from "@/lib/product-education";
import ProductReviews from "@/components/ProductReviews";
import ProductEducation from "@/components/ProductEducation";
import FabricCalculatorCta from "@/components/FabricCalculatorCta";
import StockBadge from "@/components/StockBadge";
import ShareFabric from "@/components/ShareFabric";
import { ProductTrustStrip, PaymentBadges } from "@/components/TrustSignals";
import PageSkeleton from "@/components/PageSkeleton";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    params.then(({ slug }) => {
      fetch("/api/products")
        .then(r => r.json())
        .then((list: Product[]) => {
          const found = list.find((p) => p.slug === slug);
          if (!found) {
            router.replace("/shop");
            return;
          }
          const hydrated = hydrateProduct(found);
          const catalog = list.map(hydrateProduct);
          setProduct(hydrated);
          addRecentlyViewed(hydrated);
          setRelatedProducts(getSmartRelatedProducts(hydrated, catalog, 4));
          setLoading(false);
        })
        .catch(() => {
          setError("We could not load this fabric. Please try again.");
          setLoading(false);
        });
    });
  }, [params, router]);

  if (loading) {
    return <PageSkeleton variant="detail" />;
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-[#6B5F54] mb-4" role="alert">
          {error || "Fabric not found."}
        </p>
        <Link href="/shop" className="btn-primary inline-block px-8 py-3">
          Back to shop
        </Link>
      </div>
    );
  }

  return <ProductDetailClient product={product} relatedProducts={relatedProducts} />;
}

function ProductDetailClient({ product, relatedProducts }: { product: Product; relatedProducts: Product[] }) {
  const [selectedLength, setSelectedLength] = useState(product.lengthOptions[0]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const currentPrice = product.salePrice || product.price;
  const totalPrice = currentPrice * quantity;

  const handleAddToCart = (e?: React.MouseEvent<HTMLButtonElement>) => {
    addToCartWithFeedback({
      product,
      length: selectedLength,
      quantity,
      imageRect: e?.currentTarget.getBoundingClientRect(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-28 lg:pb-10">
      <div className="flex items-center gap-2 text-sm mb-8 text-[#6B5F54]">
        <Link href="/shop" className="hover:text-[#6B2D3C] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Shop
        </Link>
        <span>/</span>
        <span>{product.category}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-16 gap-y-10">
        <div>
          <div 
            className="gallery-main aspect-[4/3.15] rounded-3xl overflow-hidden border border-[#D4C9B8] bg-[#F4EDE3] relative cursor-zoom-in group fabric-texture-hover"
            onClick={() => setIsLightboxOpen(true)}
          >
            <ProductImage
              src={product.images[selectedImageIndex]}
              alt={productImageAlt(product.name, product.category, selectedImageIndex)}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              quality={88}
              className="transition-transform duration-500 group-hover:scale-[1.015]"
            />
            <div className="absolute bottom-4 right-4 px-3 py-1 text-[10px] tracking-widest bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition">CLICK TO ENLARGE</div>
          </div>

          <div className="flex gap-3 mt-4">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImageIndex(idx)}
                className={`gallery-thumb relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition ${selectedImageIndex === idx ? 'active border-[#6B2D3C]' : 'border-transparent hover:border-[#D4C9B8]'}`}
              >
                <ProductImage src={img} alt={productImageAlt(product.name, product.category, idx)} fill sizes="80px" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between">
            <div>
              <div className="uppercase tracking-[2px] text-xs text-[#C5A46E]">{product.category}</div>
              <h1 className="text-5xl tracking-[-1.8px] font-semibold leading-none mt-1 mb-3">{product.name}</h1>
            </div>
            <WishlistButton product={product} />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex text-[#C5A46E]">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
            </div>
            <span className="font-mono text-sm">{product.rating} <span className="text-[#6B5F54]">({product.reviewCount} reviews)</span></span>
          </div>

          <div className="mb-8">
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-semibold tabular-nums tracking-[-1.5px]">₦{currentPrice.toLocaleString()}</span>
              {product.salePrice && (
                <>
                  <span className="text-2xl text-[#6B5F54] line-through">₦{product.price.toLocaleString()}</span>
                  <span className="text-sm px-2.5 py-0.5 rounded-full bg-[#6B2D3C] text-white">Save ₦{(product.price - currentPrice).toLocaleString()}</span>
                </>
              )}
            </div>
            <div className="text-sm text-[#6B5F54]">per piece • prices vary by length selected</div>
          </div>

          <div className="mb-8">
            <div className="text-xs tracking-[2px] text-[#6B5F54] mb-3">SELECT LENGTH</div>
            <div className="flex flex-wrap gap-3">
              {product.lengthOptions.map((length) => (
                <button
                  key={length}
                  onClick={() => setSelectedLength(length)}
                  className={`length-btn px-8 py-3.5 rounded-2xl border text-sm font-medium transition-all ${selectedLength === length ? 'active border-[#6B2D3C] bg-[#6B2D3C] text-white' : 'border-[#D4C9B8] hover:bg-white'}`}
                >
                  {length}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6B5F54] mt-2">
              Most popular: 6 yards for full traditional outfits.{" "}
              <FabricCalculatorCta
                productName={product.name}
                category={product.category}
                variant="compact"
                className="inline-flex align-baseline"
              />
            </p>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div>
              <div className="text-xs tracking-widest text-[#6B5F54] mb-1.5">QUANTITY</div>
              <div className="flex border border-[#D4C9B8] rounded-2xl overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-5 py-3 hover:bg-[#F8F4EC] active:bg-white">-</button>
                <div className="px-8 py-3 font-mono tabular-nums border-x border-[#D4C9B8]">{quantity}</div>
                <button onClick={() => setQuantity(quantity + 1)} className="px-5 py-3 hover:bg-[#F8F4EC] active:bg-white">+</button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className="btn-primary flex-1 max-lg:hidden flex items-center justify-center gap-3 py-[17px] text-lg rounded-2xl font-medium self-end"
            >
              <ShoppingCart className="w-5 h-5" /> 
              ADD TO CART — ₦{totalPrice.toLocaleString()}
            </button>
          </div>

          <p className="text-lg text-[#4A4038] leading-relaxed mb-6">{product.shortDescription}</p>

          {/* At-a-glance chips — scannable before full education block */}
          {(product.bestUses?.length || product.opacity) && (
            <div className="flex flex-wrap gap-2 mb-8">
              {product.opacity && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8DFD0] bg-[#FBF8F3] px-3 py-1.5 text-xs font-medium text-[#2C2522]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C5A46E]" aria-hidden="true" />
                  {product.opacity}
                </span>
              )}
              {(product.bestUses || []).slice(0, 4).map((use) => (
                <span
                  key={use}
                  className="inline-flex items-center rounded-full border border-[#E8DFD0] bg-white px-3 py-1.5 text-xs font-medium text-[#4A4038]"
                >
                  {formatOccasion(use)}
                </span>
              ))}
            </div>
          )}

          <div className="prose prose-stone max-w-none mb-8 text-[15px] leading-relaxed text-[#4A4038]">
            <p>{product.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B5F54] mb-4">
            <StockBadge inStock={product.inStock} alwaysShow />
            {product.inStock > 0 && product.inStock <= 10 && (
              <span className="text-xs">Act soon if this is your colour — popular pieces move fast.</span>
            )}
            <div className="text-xs">Free shipping on orders over ₦75,000</div>
          </div>

          <ProductTrustStrip className="mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <PaymentBadges />
            <ShareFabric name={product.name} slug={product.slug} />
          </div>
        </div>
      </div>

      {/* Full-width education: care, opacity, origin, uses — premium scannable layout */}
      <div className="mt-14 lg:mt-16">
        <ProductEducation product={product} />
      </div>

      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center p-4"
            onClick={() => setIsLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-[95vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-3 -right-3 z-10 bg-white text-black rounded-full w-9 h-9 flex items-center justify-center shadow text-sm"
                aria-label="Close image viewer"
              >
                ✕
              </button>
              <ProductImage
                src={product.images[selectedImageIndex]}
                alt={productImageAlt(product.name, product.category, selectedImageIndex)}
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 95vw, 1200px"
                quality={90}
                objectFit="contain"
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
              />
              <div className="flex justify-center gap-2 mt-4">
                {product.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition ${selectedImageIndex === idx ? "bg-white scale-125" : "bg-white/40"}`}
                    aria-label={`View image ${idx + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProductReviews
        productId={product.id}
        fallbackRating={product.rating}
        fallbackCount={product.reviewCount}
      />

      <RecentlyViewed excludeId={product.id} />

      {relatedProducts.length > 0 && (
        <div className="mt-12 pt-12 border-t border-[#D4C9B8]">
          <div className="flex items-center justify-between mb-8 gap-4">
            <div>
              <div className="text-xs tracking-[2px] text-[#C5A46E]">COMPLETE THE LOOK</div>
              <h3 className="text-3xl tracking-tight font-semibold">Pairs well with</h3>
              <p className="text-sm text-[#6B5F54] mt-1 max-w-lg">
                Matched by colour family, occasion, and complementary categories — not random fills.
              </p>
            </div>
            <Link href="/shop" className="text-sm hover:underline shrink-0">
              Browse more →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((related) => (
              <Link key={related.id} href={`/products/${related.slug}`} className="group block">
                <div className="product-card bg-white rounded-3xl overflow-hidden border border-[#D4C9B8] h-full">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <ProductImage
                      src={related.images[0]}
                      alt={productImageAlt(related.name, related.category)}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="group-hover:scale-[1.04] transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] tracking-wide text-[#C5A46E] font-medium mb-1">
                      {relatedReason(product, related)}
                    </div>
                    <div className="text-xs text-[#6B5F54] tracking-wide">{related.category}</div>
                    <div className="font-semibold tracking-tight mt-0.5 line-clamp-2">{related.name}</div>
                    <div className="mt-1 text-sm font-medium tabular-nums">
                      ₦{(related.salePrice || related.price).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile sticky add-to-cart */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-30 px-4 pb-2">
        <div className="bg-white/95 backdrop-blur-md border border-[#D4C9B8] rounded-2xl shadow-lg flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0">
            <div className="font-mono font-semibold text-lg">₦{totalPrice.toLocaleString()}</div>
            <div className="text-xs text-[#6B5F54] truncate">{selectedLength} × {quantity}</div>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            className="btn-primary flex items-center gap-2 px-6 py-3.5 rounded-xl font-medium shrink-0"
          >
            <ShoppingCart className="w-4 h-4" /> Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}