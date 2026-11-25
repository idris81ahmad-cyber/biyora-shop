import type { Metadata } from "next";
import { getProducts } from "@/lib/products-store";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { isPublicListing, readCatalogMeta } from "@/lib/catalog-meta";

export const dynamic = "force-dynamic";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find((p) => p.slug === slug);

  if (!product || !isPublicListing(product)) {
    return {
      title: "Product Not Found",
      description: "This fabric is no longer available in the BIYORA SHOP catalog.",
      robots: { index: false, follow: true },
    };
  }

  const meta = readCatalogMeta(product);
  const price = product.salePrice ?? product.price;
  const inStock = product.inStock > 0;
  const title = meta.seoTitle || `${product.name} · ${product.category}`;
  const description = (meta.seoDescription || [
    product.shortDescription?.trim(),
    `₦${price.toLocaleString()}`,
    product.colorFamily ? `${product.colorFamily}` : null,
    product.patternStyle ? `${product.patternStyle}` : null,
    inStock ? "In stock" : "Currently low stock",
    "Premium African textile from Kantin Kwari Market, Kano — BIYORA SHOP.",
  ]
    .filter(Boolean)
    .join(" · "))
    .slice(0, 300);

  const imagePath = product.images[0] ?? siteConfig.ogImage;
  const image = imagePath.startsWith("http") ? imagePath : absoluteUrl(imagePath);
  const url = absoluteUrl(`/products/${slug}`);
  const brandTitle = `${title} | ${siteConfig.name}`;

  return {
    title,
    description,
    keywords: [
      product.name,
      product.category,
      product.colorFamily,
      product.patternStyle,
      "African fabric",
      "Kano textile",
      "Kwari Market",
      "BIYORA SHOP",
      "Nigeria",
    ].filter(Boolean) as string[],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      url,
      siteName: siteConfig.name,
      title: brandTitle,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${product.name} — ${product.category} fabric`,
        },
        ...product.images.slice(1, 3).map((img) => ({
          url: img.startsWith("http") ? img : absoluteUrl(img),
          width: 800,
          height: 600,
          alt: product.name,
        })),
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: brandTitle,
      description,
      images: [image],
    },
    other: {
      "product:price:amount": String(price),
      "product:price:currency": "NGN",
      "product:availability": inStock ? "in stock" : "out of stock",
      "product:brand": siteConfig.name,
      "product:category": product.category,
    },
  };
}

export default async function ProductLayout({ children, params }: Props) {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find((p) => p.slug === slug);

  return (
    <>
      {product && (
        <>
          <ProductJsonLd product={product} url={absoluteUrl(`/products/${slug}`)} />
          <BreadcrumbJsonLd
            items={[
              { name: "Home", href: "/" },
              { name: "Shop", href: "/shop" },
              {
                name: product.category,
                href: `/shop?category=${encodeURIComponent(product.category)}`,
              },
              { name: product.name, href: `/products/${slug}` },
            ]}
          />
        </>
      )}
      {children}
    </>
  );
}
