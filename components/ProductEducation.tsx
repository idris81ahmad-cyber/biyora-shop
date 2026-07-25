import Link from "next/link";
import {
  BookOpen,
  Droplets,
  Layers,
  MapPin,
  Ruler,
  Scale,
  Sparkles,
  Sun,
  Wind,
} from "lucide-react";
import type { Product } from "@/types/product";
import {
  EDUCATION_FEATURED_SPEC_KEYS,
  formatOccasion,
  hydrateProduct,
  occasionHint,
  opacityLevel,
  parseCareSteps,
} from "@/lib/product-education";
import FabricCalculatorCta from "@/components/FabricCalculatorCta";
import { cn } from "@/lib/utils";

const FEATURED_SET = new Set<string>(EDUCATION_FEATURED_SPEC_KEYS);

export default function ProductEducation({ product }: { product: Product }) {
  const p = hydrateProduct(product);
  const careSteps = parseCareSteps(p.careInstructions || "");
  const opacity = opacityLevel(p.opacity);

  const facts: { key: string; label: string; value: string; icon: typeof Ruler }[] = [
    {
      key: "width",
      label: "Width",
      value: p.width || p.specifications?.Width || "",
      icon: Ruler,
    },
    {
      key: "weight",
      label: "Weight",
      value: p.weight || p.specifications?.Weight || "",
      icon: Scale,
    },
    {
      key: "opacity",
      label: "Opacity",
      value: p.opacity || p.specifications?.Opacity || "",
      icon: Layers,
    },
    {
      key: "material",
      label: "Material",
      value: p.specifications?.Material || p.material || "",
      icon: Wind,
    },
    {
      key: "origin",
      label: "Origin",
      value: p.specifications?.Origin || "",
      icon: MapPin,
    },
  ].filter((f) => f.value);

  const remainingSpecs = Object.entries(p.specifications || {}).filter(
    ([key]) => !FEATURED_SET.has(key),
  );

  return (
    <div className="mb-12 space-y-6">
      {/* Section frame */}
      <div className="rounded-[1.75rem] border border-[#E0D5C4] bg-gradient-to-b from-white via-[#FDFBF7] to-[#F8F4EC] overflow-hidden shadow-[0_1px_0_rgba(44,37,34,0.04)]">
        <header className="px-5 sm:px-7 pt-6 sm:pt-7 pb-4 border-b border-[#EDE6D9]/90">
          <p className="text-[11px] tracking-[0.28em] text-[#C5A46E] font-medium mb-1.5">
            KNOW YOUR FABRIC
          </p>
          <h2 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-[#2C2522]">
            Details that matter before you cut
          </h2>
          <p className="text-sm text-[#6B5F54] mt-1.5 max-w-xl leading-relaxed">
            Scannable facts for you and your tailor — coverage, care, origin, and best looks.
          </p>
        </header>

        {/* Metric tiles */}
        {facts.length > 0 && (
          <div className="px-5 sm:px-7 py-5 border-b border-[#EDE6D9]/90">
            <div
              className={cn(
                "grid gap-2.5",
                facts.length <= 3
                  ? "grid-cols-1 sm:grid-cols-3"
                  : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
              )}
            >
              {facts.map(({ key, label, value, icon: Icon }) => (
                <div
                  key={key}
                  className="group relative rounded-2xl border border-[#E8DFD0] bg-white/90 px-3.5 py-3.5 sm:px-4 hover:border-[#C5A46E]/50 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="inline-flex w-7 h-7 items-center justify-center rounded-xl bg-[#F8F4EC] text-[#6B2D3C]">
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] tracking-[0.16em] uppercase text-[#A89B8A] font-medium">
                      {label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#2C2522] leading-snug">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opacity callout — critical for lace / chiffon */}
        {p.opacity && (
          <div className="px-5 sm:px-7 py-5 border-b border-[#EDE6D9]/90">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="w-4 h-4 text-[#C5A46E]" aria-hidden="true" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#C5A46E] font-medium">
                    Light &amp; coverage
                  </span>
                </div>
                <p className="text-base font-semibold text-[#2C2522] tracking-tight">
                  {opacity.label}
                </p>
                {opacity.tip && (
                  <p className="text-xs sm:text-sm text-[#6B5F54] mt-1.5 leading-relaxed max-w-md">
                    {opacity.tip}
                  </p>
                )}
              </div>
              <div
                className="shrink-0 w-full sm:w-44"
                role="img"
                aria-label={`Opacity: ${opacity.label}`}
              >
                <div className="flex justify-between text-[10px] text-[#A89B8A] mb-1.5 tracking-wide">
                  <span>Sheer</span>
                  <span>Opaque</span>
                </div>
                <div className="flex gap-1.5 h-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-full transition",
                        i <= opacity.fill
                          ? "bg-gradient-to-r from-[#C5A46E] to-[#6B2D3C]"
                          : "bg-[#EDE6D9]",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Best uses */}
        {p.bestUses && p.bestUses.length > 0 && (
          <div className="px-5 sm:px-7 py-5 border-b border-[#EDE6D9]/90">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#C5A46E]" aria-hidden="true" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#C5A46E] font-medium">
                Perfect for
              </span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {p.bestUses.map((use) => {
                const hint = occasionHint(use);
                return (
                  <li
                    key={use}
                    className="flex items-start gap-3 rounded-2xl border border-[#E8DFD0] bg-white/80 px-3.5 py-3"
                  >
                    <span
                      className="mt-0.5 w-2 h-2 rounded-full bg-[#C5A46E] shrink-0 ring-4 ring-[#C5A46E]/15"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#2C2522] leading-snug">
                        {formatOccasion(use)}
                      </p>
                      {hint && (
                        <p className="text-xs text-[#6B5F54] mt-0.5">{hint}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Care as steps */}
        {careSteps.length > 0 && (
          <div className="px-5 sm:px-7 py-5 border-b border-[#EDE6D9]/90">
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="w-4 h-4 text-[#6B2D3C]" aria-hidden="true" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-[#C5A46E] font-medium">
                Care
              </span>
            </div>
            <ol className="space-y-2.5">
              {careSteps.map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 w-7 h-7 rounded-full bg-[#6B2D3C] text-white text-xs font-semibold flex items-center justify-center tabular-nums"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#4A4038] leading-relaxed pt-1">{step}</p>
                </li>
              ))}
            </ol>
            {p.careInstructions && careSteps.length === 1 && (
              <p className="sr-only">{p.careInstructions}</p>
            )}
          </div>
        )}

        {/* Origin story — editorial */}
        {p.originStory && (
          <div className="px-5 sm:px-7 py-6 sm:py-7 bg-[#2C2522] text-[#EDE4D4]">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#C5A46E]" aria-hidden="true" />
              <span className="text-[10px] tracking-[0.22em] uppercase text-[#C5A46E] font-medium">
                Origin story
              </span>
            </div>
            <blockquote className="relative">
              <span
                className="absolute -left-1 -top-3 text-5xl leading-none text-[#C5A46E]/35 font-serif select-none"
                aria-hidden="true"
              >
                “
              </span>
              <p className="text-[15px] sm:text-base leading-relaxed text-[#EDE4D4]/95 pl-4 sm:pl-5">
                {p.originStory}
              </p>
            </blockquote>
            <p className="mt-4 pl-4 sm:pl-5 text-xs text-[#A89B8A]">
              Sourced for BIYORA ·{" "}
              <Link
                href="/sourcing"
                className="text-[#C5A46E] underline underline-offset-2 hover:text-white transition"
              >
                How we buy at Kantin Kwari
              </Link>
            </p>
          </div>
        )}
      </div>

      {/* How to style — compact dual cards */}
      <section aria-labelledby="style-heading">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#C5A46E]" aria-hidden="true" />
          <h3
            id="style-heading"
            className="text-[10px] tracking-[0.2em] uppercase text-[#C5A46E] font-medium"
          >
            How to style
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#E8DFD0] bg-white p-5">
            <p className="text-sm font-semibold text-[#2C2522] mb-1.5">Traditional</p>
            <p className="text-sm text-[#6B5F54] leading-relaxed">
              {(p.bestUses || []).some((u) =>
                ["asoebi", "bridal", "gele", "wrapper"].includes(u.toLowerCase()),
              )
                ? "Match gele and ipele for asoebi, owambe, or bridal — keep one colour story with your tailor."
                : "Classic silhouettes, quality finishing, and room to move for ceremonies and family events."}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E8DFD0] bg-white p-5">
            <p className="text-sm font-semibold text-[#2C2522] mb-1.5">Modern</p>
            <p className="text-sm text-[#6B5F54] leading-relaxed">
              {(p.bestUses || []).some((u) =>
                ["office", "everyday", "senator"].includes(u.toLowerCase()),
              )
                ? "Shirt dresses, tailored trousers, blazers, or senator cuts for contemporary polish."
                : "Structured jacket, wide-leg trouser, or a minimal gown for a clean modern line."}
            </p>
          </div>
        </div>
      </section>

      {/* Remaining specs — only if useful extras exist */}
      {remainingSpecs.length > 0 && (
        <section aria-labelledby="specs-heading">
          <h3
            id="specs-heading"
            className="text-[10px] tracking-[0.2em] uppercase text-[#C5A46E] font-medium mb-3"
          >
            More specifications
          </h3>
          <div className="border border-[#E8DFD0] rounded-2xl overflow-hidden text-sm bg-white">
            {remainingSpecs.map(([key, value], idx) => (
              <div
                key={key}
                className={cn(
                  "flex gap-4 px-5 py-3.5",
                  idx % 2 === 0 ? "bg-white" : "bg-[#FBF8F3]/80",
                  idx < remainingSpecs.length - 1 && "border-b border-[#EDE6D9]",
                )}
              >
                <div className="w-28 sm:w-36 text-[#6B5F54] shrink-0 text-[13px]">{key}</div>
                <div className="font-medium text-[#2C2522] text-[13px] leading-snug">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <FabricCalculatorCta
        productName={p.name}
        category={p.category}
        variant="card"
      />

      <p className="text-xs text-[#8A7E72]">
        Need help choosing?{" "}
        <Link href="/contact" className="text-[#6B2D3C] underline underline-offset-2">
          Message our team
        </Link>
        {" · "}
        <Link href="/journal" className="text-[#6B2D3C] underline underline-offset-2">
          Fabric journal
        </Link>
        {" · "}
        <Link href="/sourcing" className="text-[#6B2D3C] underline underline-offset-2">
          Our sourcing
        </Link>
      </p>
    </div>
  );
}
