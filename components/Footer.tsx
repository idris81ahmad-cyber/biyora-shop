import Link from "next/link";
import NewsletterForm from "@/components/NewsletterForm";
import Image from "next/image";
import { fabricCategories, categoryShopHref } from "@/lib/products";
import { siteConfig } from "@/lib/site";

const waHref = `https://wa.me/${String(siteConfig.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
  "Hello BIYORA SHOP — I have a question about fabrics / my order.",
)}`;

export default function Footer() {
  return (
    <footer className="bg-[#2C2522] text-[#EDE4D4] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-y-12">
        {/* Brand */}
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/biyora-logo.png"
              alt="BIYORA SHOP"
              width={36}
              height={36}
              sizes="36px"
              className="w-9 h-9 rounded-full object-cover ring-1 ring-[#C5A46E]/30"
            />
            <span className="font-semibold text-xl tracking-[-0.8px] text-white">BIYORA SHOP</span>
          </div>
          <p className="max-w-sm text-[#A89B8A] text-[15px] leading-relaxed">
            Bringing the legendary quality and vibrant heritage of Kantin Kwari Market in Kano
            to discerning customers around the world. Premium textiles, elevated.
          </p>
          <div className="mt-6 text-xs tracking-[2px] text-[#C5A46E]">EST. 2024 • KANO, NIGERIA</div>
        </div>

        {/* Links */}
        <div className="md:col-span-2">
          <div className="font-semibold text-white mb-4 tracking-wider text-sm">EXPLORE</div>
          <div className="space-y-2.5 text-sm">
            <Link href="/shop" className="block hover:text-[#C5A46E] transition">All Fabrics</Link>
            {fabricCategories.map((category) => (
              <Link key={category} href={categoryShopHref(category)} className="block hover:text-[#C5A46E] transition">
                {category}
              </Link>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="font-semibold text-white mb-4 tracking-wider text-sm">COMPANY</div>
          <div className="space-y-2.5 text-sm">
            <Link href="/about" className="block hover:text-[#C5A46E] transition">Our Story</Link>
            <Link href="/sourcing" className="block hover:text-[#C5A46E] transition">Our Sourcing</Link>
            <Link href="/journal" className="block hover:text-[#C5A46E] transition">Fabric Journal</Link>
            <Link href="/wholesale" className="block hover:text-[#C5A46E] transition">Wholesale / B2B</Link>
            <Link href="/sell" className="block hover:text-[#C5A46E] transition">Sell on BIYORA</Link>
            <Link href="/calculator" className="block hover:text-[#C5A46E] transition">Fabric Calculator</Link>
            <Link href="/contact" className="block hover:text-[#C5A46E] transition">Contact Us</Link>
            <Link href="/faq" className="block hover:text-[#C5A46E] transition">FAQ &amp; Returns</Link>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="font-semibold text-white mb-4 tracking-wider text-sm">OUR PROMISE</div>
          <div className="text-sm space-y-1.5 text-[#A89B8A]">
            <div>✓ Sourced from Kantin Kwari, Kano</div>
            <div>✓ Inspected before shipping</div>
            <div>✓ Fast nationwide + international delivery</div>
            <div>✓ {siteConfig.returnPolicyDays}-day easy returns on all fabrics</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px]">
            <span className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 font-semibold tracking-wide">
              PAYSTACK SECURE
            </span>
            <span className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 tracking-wide">CARDS</span>
            <span className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 tracking-wide">TRANSFER</span>
            <span className="px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 tracking-wide">USSD</span>
          </div>
          <div className="mt-6 flex gap-5 text-[#C5A46E] text-sm">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              WhatsApp
            </a>
            <Link href="/sourcing" className="hover:text-white transition">
              Authenticity
            </Link>
          </div>
          <NewsletterForm />
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-white/10 max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#6B5F54]">
        <div>© {new Date().getFullYear()} BIYORA SHOP. All rights reserved. Kano, Nigeria.</div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/faq" className="hover:text-[#C5A46E] transition">Returns ({siteConfig.returnPolicyDays} days)</Link>
          <Link href="/sourcing" className="hover:text-[#C5A46E] transition">Sourcing</Link>
          <Link href="/contact" className="hover:text-[#C5A46E] transition">Support</Link>
        </div>
      </div>
    </footer>
  );
}