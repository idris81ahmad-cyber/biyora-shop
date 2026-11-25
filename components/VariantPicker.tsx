"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types/product";
import { readCatalogMeta, unitPriceForSelection } from "@/lib/catalog-meta";

export default function VariantPicker({
  product,
  onChange,
}: {
  product: Product;
  onChange: (selection: { length: string; color?: string; unitPrice: number }) => void;
}) {
  const meta = readCatalogMeta(product);
  const colors = useMemo(
    () => [...new Set(meta.variants.map((v) => v.color).filter(Boolean))],
    [meta.variants],
  );
  const [color, setColor] = useState(colors[0] || "");
  const lengths = useMemo(() => {
    if (!meta.variants.length) return product.lengthOptions;
    const scoped = color
      ? meta.variants.filter((v) => v.color === color).map((v) => v.length)
      : meta.variants.map((v) => v.length);
    const unique = [...new Set(scoped)];
    return unique.length ? unique : product.lengthOptions;
  }, [meta.variants, color, product.lengthOptions]);
  const [length, setLength] = useState(lengths[0] || product.lengthOptions[0] || "5 yards");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!lengths.includes(length)) setLength(lengths[0] || length);
  }, [lengths, length]);

  useEffect(() => {
    onChangeRef.current({
      length,
      color: color || undefined,
      unitPrice: unitPriceForSelection(product, length, color || undefined),
    });
  }, [product, length, color]);

  return (
    <div className="mb-8 space-y-5">
      {colors.length > 1 && (
        <div>
          <div className="text-xs tracking-[2px] text-[#6B5F54] mb-3">COLOUR</div>
          <div className="flex flex-wrap gap-2">
            {colors.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setColor(name)}
                className={`px-4 py-2.5 rounded-2xl border text-sm ${
                  color === name ? "border-[#6B2D3C] bg-[#6B2D3C] text-white" : "border-[#D4C9B8]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs tracking-[2px] text-[#6B5F54] mb-3">SELECT LENGTH</div>
        <div className="flex flex-wrap gap-3">
          {lengths.map((option) => {
            const variant = meta.variants.find(
              (v) => v.length === option && (!color || v.color === color),
            );
            const price = unitPriceForSelection(product, option, color || undefined);
            return (
              <button
                key={option}
                type="button"
                onClick={() => setLength(option)}
                className={`px-5 py-3 rounded-2xl border text-sm font-medium text-left ${
                  length === option ? "border-[#6B2D3C] bg-[#6B2D3C] text-white" : "border-[#D4C9B8]"
                }`}
              >
                <span className="block">{option}</span>
                {variant && (
                  <span className={`block text-[11px] mt-0.5 ${length === option ? "text-white/80" : "text-[#6B5F54]"}`}>
                    ₦{variant.pricePerYard.toLocaleString()}/yd · ₦{price.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#6B5F54] mt-2">
          Most outfits take 6 yards. Use the fabric calculator if your tailor gave a different cut.
        </p>
      </div>
    </div>
  );
}
