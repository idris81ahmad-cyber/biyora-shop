"use client";

import { useState, useMemo, Suspense, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductGridSkeleton from "@/components/ProductGridSkeleton";
import ActiveFilterChips, { type FilterChip } from "@/components/ActiveFilterChips";
import { categories, colorFamilies, patternStyles } from "@/lib/products";
import type { Product } from "@/types/product";
import { useWishlistStore } from "@/lib/wishlist-store";
import { Filter, X, Heart, ShoppingBag } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { readCatalogMeta } from "@/lib/catalog-meta";

const PRICE_MAX = 60000;

function parseList(param: string | null): string[] {
  return param ? param.split(",").filter(Boolean) : [];
}

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const wishlistItems = useWishlistStore((s) => s.items);
  const showWishlist = searchParams.get("wishlist") === "1";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "All Categories");
  const [selectedColors, setSelectedColors] = useState<string[]>(parseList(searchParams.get("colors")));
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>(parseList(searchParams.get("patterns")));
  const [priceRange, setPriceRange] = useState<[number, number]>([
    parseInt(searchParams.get("min") || "0", 10) || 0,
    parseInt(searchParams.get("max") || String(PRICE_MAX), 10) || PRICE_MAX,
  ]);
  const [sortBy, setSortBy] = useState<"featured" | "price-low" | "price-high" | "rating">(
    (searchParams.get("sort") as "featured" | "price-low" | "price-high" | "rating") || "featured",
  );

  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory !== "All Categories") params.set("category", selectedCategory);
    if (selectedColors.length) params.set("colors", selectedColors.join(","));
    if (selectedPatterns.length) params.set("patterns", selectedPatterns.join(","));
    if (priceRange[0] > 0) params.set("min", String(priceRange[0]));
    if (priceRange[1] < PRICE_MAX) params.set("max", String(priceRange[1]));
    if (sortBy !== "featured") params.set("sort", sortBy);
    if (showWishlist) params.set("wishlist", "1");
    const qs = params.toString();
    router.replace(qs ? `/shop?${qs}` : "/shop", { scroll: false });
  }, [searchQuery, selectedCategory, selectedColors, selectedPatterns, priceRange, sortBy, showWishlist, router]);

  useEffect(() => {
    const t = setTimeout(syncUrl, 300);
    return () => clearTimeout(t);
  }, [syncUrl]);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setAllProducts(Array.isArray(data) ? data : []))
      .catch(() => setAllProducts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const sourceProducts = showWishlist ? wishlistItems : allProducts;

  const filteredProducts = useMemo(() => {
    let result = [...sourceProducts];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.colorFamily.toLowerCase().includes(q),
      );
    }

    if (selectedCategory !== "All Categories") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (selectedColors.length) {
      result = result.filter((p) => selectedColors.includes(p.colorFamily));
    }

    if (selectedPatterns.length) {
      result = result.filter((p) => selectedPatterns.includes(p.patternStyle));
    }

    result = result.filter((p) => {
      const price = p.salePrice || p.price;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    if (sortBy === "price-low") {
      result.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sortBy === "price-high") {
      result.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      result.sort((a, b) => {
        const score = (p: Product) => {
          const meta = readCatalogMeta(p);
          return (meta.featured ? 2 : 0) + (meta.isNewArrival ? 1 : 0);
        };
        return score(b) - score(a);
      });
    }

    return result;
  }, [sourceProducts, searchQuery, selectedCategory, selectedColors, selectedPatterns, priceRange, sortBy]);

  const toggleColor = (color: string) => {
    if (color === "All Colors") {
      setSelectedColors([]);
      return;
    }
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color],
    );
  };

  const togglePattern = (style: string) => {
    setSelectedPatterns((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All Categories");
    setSelectedColors([]);
    setSelectedPatterns([]);
    setPriceRange([0, PRICE_MAX]);
    setSortBy("featured");
    if (showWishlist) router.replace("/shop");
  };

  const filterChips: FilterChip[] = [];
  if (searchQuery) filterChips.push({ key: "q", label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery("") });
  if (selectedCategory !== "All Categories")
    filterChips.push({ key: "cat", label: selectedCategory, onRemove: () => setSelectedCategory("All Categories") });
  selectedColors.forEach((c) =>
    filterChips.push({ key: `color-${c}`, label: c, onRemove: () => toggleColor(c) }),
  );
  selectedPatterns.forEach((p) =>
    filterChips.push({ key: `pattern-${p}`, label: p, onRemove: () => togglePattern(p) }),
  );
  if (priceRange[0] > 0 || priceRange[1] < PRICE_MAX)
    filterChips.push({
      key: "price",
      label: `₦${priceRange[0].toLocaleString()} – ₦${priceRange[1].toLocaleString()}`,
      onRemove: () => setPriceRange([0, PRICE_MAX]),
    });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <div className="uppercase text-xs tracking-[3px] text-[#C5A46E]">
            {showWishlist ? "YOUR WISHLIST" : "THE COLLECTION"}
          </div>
          <h1 className="text-5xl md:text-6xl tracking-[-2.5px] font-semibold">
            {showWishlist ? "Saved Fabrics" : "Shop Premium Fabrics"}
          </h1>
          <p className="text-[#6B5F54] mt-2">
            Showing <span className="font-medium text-[#2C2522]">{filteredProducts.length}</span>
            {showWishlist ? " saved" : ` of ${allProducts.length}`} pieces
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.replace(showWishlist ? "/shop" : "/shop?wishlist=1")}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-2xl text-sm transition ${
              showWishlist ? "border-[#6B2D3C] bg-[#6B2D3C] text-white" : "border-[#D4C9B8]"
            }`}
          >
            <Heart className="w-4 h-4" /> Saved ({wishlistItems.length})
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 px-5 py-2.5 border border-[#D4C9B8] rounded-2xl text-sm"
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort products"
            className="bg-white border border-[#D4C9B8] rounded-2xl px-5 py-2.5 text-sm focus:outline-none focus:border-[#C5A46E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C5A46E]"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      <ActiveFilterChips chips={filterChips} onClearAll={clearFilters} />

      <div className="flex flex-col lg:flex-row gap-8">
        <div className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-72 shrink-0`}>
          <div className="sticky top-24 bg-white border border-[#D4C9B8] rounded-3xl p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="font-semibold tracking-tight">Filters</div>
              {filterChips.length > 0 && (
                <button type="button" onClick={clearFilters} className="text-xs flex items-center gap-1 text-[#C5A46E] hover:underline">
                  CLEAR ALL <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="mb-6">
              <label className="text-xs tracking-widest text-[#6B5F54] block mb-2">SEARCH</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fabrics..."
                className="input-premium w-full rounded-2xl px-4 py-3 text-sm"
              />
            </div>

            <div className="mb-6">
              <label className="text-xs tracking-widest text-[#6B5F54] block mb-3">CATEGORY</label>
              <div className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`filter-chip w-full text-left px-4 py-2 rounded-2xl border transition flex justify-between items-center ${
                      selectedCategory === cat
                        ? "active border-[#6B2D3C] bg-[#6B2D3C] text-white"
                        : "border-[#D4C9B8] hover:bg-[#F8F4EC]"
                    }`}
                  >
                    {cat}
                    {cat !== "All Categories" && (
                      <span className="text-xs opacity-60">
                        {allProducts.filter((p) => p.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs tracking-widest text-[#6B5F54] block mb-3">COLOR FAMILY</label>
              <div className="flex flex-wrap gap-2">
                {colorFamilies.filter((c) => c !== "All Colors").map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleColor(color)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      selectedColors.includes(color)
                        ? "border-[#6B2D3C] bg-[#6B2D3C] text-white"
                        : "border-[#D4C9B8] hover:bg-[#F8F4EC]"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs tracking-widest text-[#6B5F54] block mb-3">PATTERN STYLE</label>
              <div className="flex flex-wrap gap-2">
                {patternStyles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => togglePattern(style)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      selectedPatterns.includes(style)
                        ? "border-[#6B2D3C] bg-[#6B2D3C] text-white"
                        : "border-[#D4C9B8] hover:bg-[#F8F4EC]"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs tracking-widest text-[#6B5F54] block mb-3">
                PRICE RANGE — ₦{priceRange[0].toLocaleString()} – ₦{priceRange[1].toLocaleString()}
              </label>
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={1000}
                value={priceRange[0]}
                onChange={(e) => setPriceRange([Math.min(parseInt(e.target.value, 10), priceRange[1] - 1000), priceRange[1]])}
                className="w-full accent-[#6B2D3C] mb-2"
              />
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={1000}
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], Math.max(parseInt(e.target.value, 10), priceRange[0] + 1000)])}
                className="w-full accent-[#6B2D3C]"
              />
            </div>
          </div>
        </div>

        <div className="flex-1">
          {isLoading ? (
            <ProductGridSkeleton />
          ) : filteredProducts.length > 0 ? (
            <div className="product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={index < 3}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={showWishlist ? Heart : ShoppingBag}
              eyebrow={showWishlist ? "WISHLIST" : "NO MATCHES"}
              title={showWishlist ? "No saved fabrics yet" : "No fabrics found"}
              description={
                showWishlist
                  ? "Tap the heart on any fabric to save it here for later."
                  : "Try adjusting filters or search — our full Kwari collection is a click away."
              }
              actions={[
                showWishlist
                  ? { label: "Browse shop", href: "/shop" }
                  : { label: "Clear all filters", onClick: clearFilters, variant: "secondary" },
                { label: "View all fabrics", href: "/shop" },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-20"><ProductGridSkeleton /></div>}>
      <ShopContent />
    </Suspense>
  );
}