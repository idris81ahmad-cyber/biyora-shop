"use client";

import { useEffect, useState, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { Product } from "@/types/product";
import { categories } from "@/lib/products";
import ProductImage from "@/components/ProductImage";
import ProductManager from "@/components/admin/ProductManager";
import OrderManager from "@/components/admin/OrderManager";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import ReviewManager from "@/components/admin/ReviewManager";
import SellerDesk from "@/components/admin/SellerDesk";
import { FABRIC_PRESETS } from "@/lib/fabric-presets";
import { CSV_TEMPLATE } from "@/lib/csv-products";
import {
  HOUSE_SELLER_ID,
  isLowStock,
  readCatalogMeta,
  type FabricVariant,
} from "@/lib/catalog-meta";

interface ProductForm {
  name: string;
  category: string;
  price: number;
  salePrice?: number;
  shortDescription: string;
  description: string;
  inStock: number;
  colorFamily: string;
  patternStyle: string;
  lengthOptions: string[];
  specifications: Record<string, string>;
  images: string[];
  imageNotes: string[];
  rating: number;
  reviewCount: number;
  listingStatus: "draft" | "published";
  featured: boolean;
  isNewArrival: boolean;
  composition: string;
  careInstructions: string;
  originStory: string;
  seoTitle: string;
  seoDescription: string;
  lowStockThreshold: number;
  variants: FabricVariant[];
}

const emptyForm: ProductForm = {
  name: "",
  category: "Ankara Prints",
  price: 15000,
  shortDescription: "",
  description: "",
  inStock: 20,
  colorFamily: "Gold",
  patternStyle: "Geometric",
  lengthOptions: ["5 yards", "6 yards"],
  specifications: { "Material": "100% Cotton", "Origin": "Nigeria" },
  images: [],
  imageNotes: [],
  rating: 4.7,
  reviewCount: 50,
  listingStatus: "published",
  featured: false,
  isNewArrival: true,
  composition: "100% Cotton",
  careInstructions: "",
  originStory: "Selected in Kantin Kwari, Kano.",
  seoTitle: "",
  seoDescription: "",
  lowStockThreshold: 10,
  variants: [],
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [storageReady, setStorageReady] = useState(true);

  const [activeTab, setActiveTab] = useState<"products" | "orders" | "reviews" | "sellers">("products");
  const [csvText, setCsvText] = useState(CSV_TEMPLATE);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/admin/login");
      return;
    }
    if (session.user.role !== "admin") {
      router.replace("/account");
    }
  }, [session, status, router]);

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/storage-status", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setStorageReady(Boolean(data.canWrite)))
      .catch(() => setStorageReady(false));
  }, [session]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-[#6B5F54]">Checking access...</div>
      </div>
    );
  }

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm });
    setNewImageUrl("");
    setNewSpecKey("");
    setNewSpecValue("");
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    const meta = readCatalogMeta(product);
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price,
      salePrice: product.salePrice,
      shortDescription: product.shortDescription,
      description: product.description,
      inStock: product.inStock,
      colorFamily: product.colorFamily,
      patternStyle: product.patternStyle,
      lengthOptions: [...product.lengthOptions],
      specifications: Object.fromEntries(
        Object.entries(product.specifications || {}).filter(([key]) => !key.startsWith("__")),
      ),
      images: [...product.images],
      imageNotes: [...meta.imageNotes],
      rating: product.rating,
      reviewCount: product.reviewCount,
      listingStatus: meta.listingStatus,
      featured: meta.featured,
      isNewArrival: meta.isNewArrival,
      composition: meta.composition,
      careInstructions: product.careInstructions || product.specifications?.Care || "",
      originStory: product.originStory || product.specifications?.["Artisan note"] || "",
      seoTitle: meta.seoTitle,
      seoDescription: meta.seoDescription,
      lowStockThreshold: meta.lowStockThreshold,
      variants: meta.variants.map((variant) => ({ ...variant })),
    });
    setNewImageUrl("");
    setNewSpecKey("");
    setNewSpecValue("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const addImage = (url: string) => {
    if (!url.trim()) return;
    if (form.images.includes(url.trim())) {
      toast.info("Image already added");
      return;
    }
    setForm({ ...form, images: [...form.images, url.trim()], imageNotes: [...form.imageNotes, form.images.length === 0 ? "Main" : "Detail"] });
    setNewImageUrl("");
  };

  const removeImage = (index: number) => {
    setForm({
      ...form,
      images: form.images.filter((_, i) => i !== index),
      imageNotes: form.imageNotes.filter((_, i) => i !== index),
    });
  };

  const uploadImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      addImage(data.url);
      toast.success("Image uploaded");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    }
  };

  // Handle click on drop zone to open file browser
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        void uploadImageFile(file);
      }
    });
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const text = e.dataTransfer.getData("text");

    if (text && text.startsWith("http")) {
      addImage(text);
      return;
    }

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        void uploadImageFile(file);
      }
    });
  };

  const addSpecification = () => {
    if (!newSpecKey.trim() || !newSpecValue.trim()) return;
    setForm({
      ...form,
      specifications: {
        ...form.specifications,
        [newSpecKey.trim()]: newSpecValue.trim(),
      },
    });
    setNewSpecKey("");
    setNewSpecValue("");
  };

  const removeSpec = (key: string) => {
    const copy = { ...form.specifications };
    delete copy[key];
    setForm({ ...form, specifications: copy });
  };

  const addLength = (len: string) => {
    if (!len.trim() || form.lengthOptions.includes(len.trim())) return;
    setForm({ ...form, lengthOptions: [...form.lengthOptions, len.trim()] });
  };

  const removeLength = (len: string) => {
    setForm({ ...form, lengthOptions: form.lengthOptions.filter((l) => l !== len) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.shortDescription) {
      toast.error("Name and short description are required");
      return;
    }
    if (form.listingStatus !== "draft" && form.images.length === 0) {
      toast.error("Add at least one image, or save as a draft");
      return;
    }
    if (form.images.some((img) => img.startsWith("data:"))) {
      toast.error(
        "Drag-and-drop file previews cannot be saved. Use an image URL like /images/ankara-premium.jpg instead."
      );
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      images: form.images.length ? form.images : ["/images/ankara-premium.jpg"],
      sellerId: editingProduct?.sellerId || HOUSE_SELLER_ID,
      sellerName: editingProduct?.sellerName || "BIYORA SHOP",
      moderation: editingProduct?.moderation || "approved",
      specifications: {
        ...form.specifications,
        ...(form.composition ? { Material: form.composition } : {}),
        ...(form.careInstructions ? { Care: form.careInstructions } : {}),
        ...(form.originStory ? { "Artisan note": form.originStory } : {}),
      },
      slug: editingProduct?.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      } else {
        res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || (await res.text()) || "Failed to save product");
      }

      toast.success(editingProduct ? "Product updated" : "Product created");
      closeModal();
      await loadProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save product";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (id: string) => {
    const preset = FABRIC_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setForm((current) => ({
      ...current,
      category: preset.category,
      lengthOptions: [...preset.lengths],
      patternStyle: preset.patternStyle,
      colorFamily: preset.colorFamily,
      composition: preset.composition,
      careInstructions: preset.care,
      originStory: preset.originNote,
      specifications: {
        ...current.specifications,
        Material: preset.composition,
        Origin: preset.origin,
        Care: preset.care,
        Opacity: preset.opacity,
        Width: preset.width,
      },
    }));
    toast.success(`${preset.label} template applied`);
  };

  const importCsv = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      const skipped = Array.isArray(data.errors) ? data.errors.length : 0;
      toast.success(`Imported ${data.created} fabric${data.created === 1 ? "" : "s"}${skipped ? ` · ${skipped} row skipped` : ""}`);
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const updateVariant = (index: number, patch: Partial<FabricVariant>) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)),
    }));
  };

  const handleReset = async () => {
    if (!confirm("Reset all products to defaults?")) return;
    try {
      const res = await fetch("/api/admin/products/reset", { method: "POST" });
      if (res.ok) {
        toast.success("Reset to default products");
      }
      await loadProducts();
    } catch {
      toast.error("Reset failed");
    }
  };

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.inStock, 0);
  const avgRating = totalProducts > 0
    ? (products.reduce((s, p) => s + p.rating, 0) / totalProducts).toFixed(1)
    : "0";
  const lowStockProducts = products.filter((p) => isLowStock(p));
  const outOfStockProducts = products.filter((p) => p.inStock <= 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {!storageReady && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <strong>Product storage is read-only in this environment.</strong>{" "}
          {typeof window !== "undefined" && window.location.hostname === "localhost" ? (
            <>
              For local dev, set <code className="font-mono">GITHUB_TOKEN</code> in{" "}
              <code className="font-mono">.env.local</code> and restart{" "}
              <code className="font-mono">npm run dev</code>.
            </>
          ) : (
            <>
              Use{" "}
              <a href="https://biyora-shop.vercel.app/admin" className="underline font-medium">
                biyora-shop.vercel.app
              </a>{" "}
              (not btx3.vercel.app). If the issue persists, confirm{" "}
              <code className="font-mono">GITHUB_TOKEN</code> is set in{" "}
              <a
                href="https://vercel.com/idris81ahmad-2689s-projects/biyora-shop/settings/environment-variables"
                className="underline font-medium"
                target="_blank"
                rel="noreferrer"
              >
                Vercel environment variables
              </a>{" "}
              and redeploy.
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("products")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === "products" ? "bg-[#6B2D3C] text-white" : "border border-[#D4C9B8] hover:bg-white/50"}`}
        >
          Products
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === "orders" ? "bg-[#6B2D3C] text-white" : "border border-[#D4C9B8] hover:bg-white/50"}`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === "reviews" ? "bg-[#6B2D3C] text-white" : "border border-[#D4C9B8] hover:bg-white/50"}`}
        >
          Reviews
        </button>
        <button
          onClick={() => setActiveTab("sellers")}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === "sellers" ? "bg-[#6B2D3C] text-white" : "border border-[#D4C9B8] hover:bg-white/50"}`}
        >
          Sellers
        </button>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="uppercase tracking-[3px] text-xs text-[#C5A46E] mb-1">BIYORA SHOP ADMIN</div>
          <h1 className="text-4xl font-semibold tracking-[-1.5px]">
            {activeTab === "products"
              ? "Product Management"
              : activeTab === "orders"
                ? "Order Management"
                : activeTab === "sellers"
                  ? "Sellers"
                  : "Review Moderation"}
          </h1>
          <p className="text-[#6B5F54] mt-1">
            {activeTab === "products"
              ? "Drafts, templates, CSV import, and Kwari review"
              : activeTab === "orders"
                ? "View orders • Update status • Track fulfilment"
                : activeTab === "sellers"
                  ? "Approve sellers later without opening the shop to everyone today"
                  : "Approve or reject customer product reviews"}
            </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/" className="px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white/50 transition">
            View Live Site
          </Link>
          {activeTab === "products" && (
            <>
              <button onClick={openAdd} className="btn-primary px-5 py-2 text-sm rounded-xl">
                + Add Fabric
              </button>
              <button onClick={handleReset} className="px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white/50">
                Reset Defaults
              </button>
            </>
          )}
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="px-5 py-2 text-sm bg-[#6B2D3C] text-white rounded-xl hover:bg-[#5a2532]">
            Sign Out
          </button>
        </div>
      </div>

      {activeTab === "orders" && (
        <div className="mb-10">
          <AdminAnalytics />
          <OrderManager />
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="mb-10">
          <ReviewManager />
        </div>
      )}

      {activeTab === "sellers" && (
        <div className="mb-10">
          <SellerDesk products={products} />
        </div>
      )}

      {activeTab === "products" && (
        <>
          {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
            <div
              className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950"
              role="status"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="font-semibold">Stock alerts</strong>
                  <p className="mt-1 text-amber-900/90">
                    {outOfStockProducts.length > 0 && (
                      <span>
                        {outOfStockProducts.length} out of stock
                        {lowStockProducts.length > 0 ? " · " : ""}
                      </span>
                    )}
                    {lowStockProducts.length > 0 && (
                      <span>{lowStockProducts.length} low stock</span>
                    )}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-xs text-amber-900/80 max-h-24 overflow-y-auto">
                    {[...outOfStockProducts, ...lowStockProducts].slice(0, 8).map((p) => (
                      <li key={p.id}>
                        {p.name} —{" "}
                        <span className="font-mono tabular-nums">
                          {p.inStock <= 0 ? "0 (restock)" : `${p.inStock} left`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold tabular-nums">
                  {lowStockProducts.length + outOfStockProducts.length} need attention
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-[#D4C9B8] rounded-2xl p-6">
              <div className="text-sm text-[#6B5F54]">Total Fabrics</div>
              <div className="text-4xl font-semibold mt-1 tracking-tight">{totalProducts}</div>
            </div>
            <div className="bg-white border border-[#D4C9B8] rounded-2xl p-6">
              <div className="text-sm text-[#6B5F54]">Units in Stock</div>
              <div className="text-4xl font-semibold mt-1 tracking-tight">{totalStock}</div>
            </div>
            <div
              className={`rounded-2xl p-6 border ${
                lowStockProducts.length > 0
                  ? "bg-amber-50 border-amber-300"
                  : "bg-white border-[#D4C9B8]"
              }`}
            >
              <div className="text-sm text-[#6B5F54]">Low stock</div>
              <div className="text-4xl font-semibold mt-1 tracking-tight tabular-nums">
                {lowStockProducts.length}
              </div>
              <div className="text-[10px] text-[#6B5F54] mt-1">
                {outOfStockProducts.length} out of stock
              </div>
            </div>
            <div className="bg-white border border-[#D4C9B8] rounded-2xl p-6">
              <div className="text-sm text-[#6B5F54]">Avg Rating</div>
              <div className="text-4xl font-semibold mt-1 tracking-tight">{avgRating}</div>
            </div>
          </div>

          <details className="mb-8 bg-white border border-[#D4C9B8] rounded-3xl p-5">
            <summary className="cursor-pointer font-medium">Bulk CSV import</summary>
            <p className="text-sm text-[#6B5F54] mt-2">
              Header row required. Lengths use a pipe, for example <span className="font-mono">5 yards|6 yards</span>.
              New rows publish as BIYORA house stock. Add photos in full edit after import.
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              className="mt-3 w-full font-mono text-xs rounded-2xl border border-[#D4C9B8] p-3"
            />
            <button type="button" onClick={importCsv} disabled={importing} className="mt-3 btn-primary px-5 py-2 rounded-xl text-sm disabled:opacity-60">
              {importing ? "Importing…" : "Import fabrics"}
            </button>
          </details>

          {loading ? (
            <div className="bg-white border border-[#D4C9B8] rounded-3xl p-12 text-center text-[#6B5F54]">
              Loading products…
            </div>
          ) : (
            <ProductManager
              embedded
              initialProducts={products}
              onCreateNew={openAdd}
              onFullEdit={openEdit}
              onMutate={loadProducts}
            />
          )}

          <div className="mt-4 text-xs text-[#6B5F54]">
            <strong>Quick edit</strong> updates price/stock/category in place.{" "}
            <strong>Full edit</strong> / <strong>Add Fabric</strong> open the rich modal for images, specs, and length options.
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">{editingProduct ? "Edit Fabric" : "Add New Fabric"}</h3>
                <p className="text-sm text-[#6B5F54]">All fields update the live shop</p>
              </div>
              <button onClick={closeModal} className="text-2xl leading-none text-[#6B5F54]">×</button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-premium w-full rounded-2xl px-4 py-3" required />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-premium w-full rounded-2xl px-4 py-3">
                    {categories.filter(c => c !== "All Categories").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-sm text-[#6B5F54] mb-2">Fabric template</div>
                <div className="flex flex-wrap gap-2">
                  {FABRIC_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#D4C9B8] hover:bg-[#F8F4EC]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-sm text-[#6B5F54]">
                  Visibility
                  <select
                    value={form.listingStatus}
                    onChange={(e) => setForm({ ...form, listingStatus: e.target.value as "draft" | "published" })}
                    className="mt-1 input-premium w-full rounded-2xl px-4 py-3"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
                <label className="text-sm text-[#6B5F54] flex items-end gap-2 pb-3">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                  Featured
                </label>
                <label className="text-sm text-[#6B5F54] flex items-end gap-2 pb-3">
                  <input type="checkbox" checked={form.isNewArrival} onChange={(e) => setForm({ ...form, isNewArrival: e.target.checked })} />
                  New arrival
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-[#6B5F54]">Composition
                  <input value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" placeholder="100% cotton wax" />
                </label>
                <label className="text-sm text-[#6B5F54]">Low-stock alert at
                  <input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: parseInt(e.target.value, 10) || 10 })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
                </label>
              </div>
              <label className="block text-sm text-[#6B5F54]">Care instructions
                <textarea value={form.careInstructions} onChange={(e) => setForm({ ...form, careInstructions: e.target.value })} rows={2} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
              </label>
              <label className="block text-sm text-[#6B5F54]">Origin note
                <textarea value={form.originStory} onChange={(e) => setForm({ ...form, originStory: e.target.value })} rows={2} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-[#6B5F54]">SEO title
                  <input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
                </label>
                <label className="text-sm text-[#6B5F54]">SEO description
                  <input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} className="mt-1 input-premium w-full rounded-2xl px-4 py-3" />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Price (₦) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="input-premium w-full rounded-2xl px-4 py-3" required />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Sale Price (optional)</label>
                  <input type="number" value={form.salePrice || ""} onChange={e => setForm({ ...form, salePrice: e.target.value ? parseInt(e.target.value) : undefined })} className="input-premium w-full rounded-2xl px-4 py-3" />
                </div>
              </div>

              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Short Description *</label>
                <input value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })} className="input-premium w-full rounded-2xl px-4 py-3" required />
                </div>

              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Full Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="input-premium w-full rounded-3xl px-4 py-3 resize-y" />
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="text-sm text-[#6B5F54] block mb-2">Images</label>
                <p className="text-xs text-[#6B5F54] mb-2">
                  First image is the shop card. Then add a texture close-up and a print detail. JPG, PNG, or WebP, up to 8MB. Daylight, no heavy filters.
                </p>

                {/* Clickable + Drag & Drop Zone */}
                <div
                  onClick={handleDropZoneClick}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center mb-3 transition cursor-pointer hover:border-[#6B2D3C] ${dragActive ? "border-[#6B2D3C] bg-[#F8F4EC]" : "border-[#D4C9B8]"}`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="text-4xl mb-1">📁</div>
                    <p className="text-sm font-medium text-[#6B5F54]">Click to browse or drag &amp; drop images</p>
                    <p className="text-[10px] text-[#6B5F54]">
                      Bulk JPG/PNG/WebP · auto-converted to WebP · max 8MB each
                    </p>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2 mb-3">
                  <input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Or paste image URL here"
                    className="input-premium flex-1 rounded-2xl px-4 py-3 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(newImageUrl); } }}
                  />
                  <button type="button" onClick={() => addImage(newImageUrl)} className="px-5 rounded-2xl border border-[#D4C9B8] text-sm hover:bg-white active:bg-white">
                    Add URL
                  </button>
                </div>

                {form.images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {form.images.map((img, idx) => (
                      <div key={idx} className="group relative border rounded-2xl overflow-hidden aspect-video bg-[#F8F4EC]">
                        <ProductImage src={img} alt={`Product preview ${idx + 1}`} fill sizes="200px" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-white/90 text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50">
                          ×
                        </button>
                        <select
                          value={form.imageNotes[idx] || "Detail"}
                          onChange={(e) => {
                            const imageNotes = [...form.imageNotes];
                            imageNotes[idx] = e.target.value;
                            setForm({ ...form, imageNotes });
                          }}
                          className="absolute bottom-1 left-1 right-1 text-[10px] bg-white/90 rounded"
                        >
                          {["Main", "Texture", "Print", "Width", "Detail"].map((note) => (
                            <option key={note}>{note}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#D4C9B8] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Prices per yard</div>
                    <p className="text-xs text-[#6B5F54]">Optional. A length is then priced as yards times the yard price.</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-full border"
                    onClick={() => setForm({
                      ...form,
                      variants: [
                        ...form.variants,
                        {
                          color: form.colorFamily || "As shown",
                          length: form.lengthOptions[0] || "6 yards",
                          pricePerYard: Math.max(1, Math.round(form.price / 6)),
                          stock: form.inStock,
                        },
                      ],
                    })}
                  >
                    Add variant
                  </button>
                </div>
                {form.variants.map((variant, index) => (
                  <div key={`${variant.length}-${index}`} className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <input value={variant.color} onChange={(e) => updateVariant(index, { color: e.target.value })} className="input-premium rounded-xl px-3 py-2 text-sm" placeholder="Colour" />
                    <input value={variant.length} onChange={(e) => updateVariant(index, { length: e.target.value })} className="input-premium rounded-xl px-3 py-2 text-sm" placeholder="6 yards" />
                    <input type="number" value={variant.pricePerYard} onChange={(e) => updateVariant(index, { pricePerYard: Number(e.target.value) })} className="input-premium rounded-xl px-3 py-2 text-sm" placeholder="₦ / yard" />
                    <input type="number" value={variant.stock} onChange={(e) => updateVariant(index, { stock: Number(e.target.value) })} className="input-premium rounded-xl px-3 py-2 text-sm" placeholder="Stock" />
                    <button type="button" className="text-sm text-red-600" onClick={() => setForm({ ...form, variants: form.variants.filter((_, i) => i !== index) })}>Remove</button>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Available Lengths</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.lengthOptions.map((len) => (
                    <span key={len} className="inline-flex items-center gap-1 bg-[#F8F4EC] px-3 py-1 rounded-full text-sm">
                      {len}
                      <button type="button" onClick={() => removeLength(len)} className="text-[#6B5F54] hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {["5 yards", "6 yards", "10 yards"].map(l => (
                    <button type="button" key={l} onClick={() => addLength(l)} className="text-xs px-3 py-1 border rounded-full hover:bg-[#F8F4EC]">+ {l}</button>
                  ))}
                  <input placeholder="Custom length" className="input-premium text-sm flex-1 rounded-2xl px-3 py-1" onKeyDown={(e) => {
                    if (e.key === "Enter") { addLength((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }
                  }} />
                </div>
              </div>

              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Specifications</label>
                <div className="space-y-1 mb-2 text-sm">
                  {Object.entries(form.specifications).filter(([k]) => !k.startsWith("__")).map(([k, v]) => (
                    <div key={k} className="flex justify-between border rounded-xl px-3 py-1.5 bg-[#F8F4EC]">
                      <span><strong>{k}:</strong> {v}</span>
                      <button type="button" onClick={() => removeSpec(k)} className="text-red-500">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newSpecKey} onChange={e => setNewSpecKey(e.target.value)} placeholder="Key e.g. Width" className="input-premium flex-1 rounded-2xl px-3 py-2 text-sm" />
                  <input value={newSpecValue} onChange={e => setNewSpecValue(e.target.value)} placeholder="Value" className="input-premium flex-1 rounded-2xl px-3 py-2 text-sm" />
                  <button type="button" onClick={addSpecification} className="px-4 rounded-2xl border">Add</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">In Stock</label>
                  <input type="number" value={form.inStock} onChange={e => setForm({ ...form, inStock: parseInt(e.target.value) || 0 })} className="input-premium w-full rounded-2xl px-4 py-3" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Rating</label>
                  <input type="number" step="0.1" value={form.rating} onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) })} className="input-premium w-full rounded-2xl px-4 py-3" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Review Count</label>
                  <input type="number" value={form.reviewCount} onChange={e => setForm({ ...form, reviewCount: parseInt(e.target.value) })} className="input-premium w-full rounded-2xl px-4 py-3" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={closeModal} className="px-6 py-3 rounded-2xl border">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-8 py-3 rounded-2xl disabled:opacity-70">
                  {saving ? "Saving..." : editingProduct ? "Save Changes" : "Create Fabric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
