"use client";

import { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types/product';
import { toast } from 'sonner';
import { isLowStock, listingBadge, readCatalogMeta } from '@/lib/catalog-meta';

interface ProductManagerProps {
  initialProducts: Product[];
  /** Opens the rich admin create modal (images, specs, descriptions). */
  onCreateNew?: () => void;
  /**
   * Opens the rich full-edit modal on the parent dashboard.
   * Quick edits (price/stock/category) always stay in ProductManager.
   */
  onFullEdit?: (product: Product) => void;
  /** @deprecated Use onFullEdit — kept for backward compatibility */
  onEditProduct?: (product: Product) => void;
  onMutate?: () => void;
  /** Hides the standalone page header when embedded in the admin dashboard */
  embedded?: boolean;
}

interface EditFormData {
  name: string;
  price: number;
  salePrice?: number;
  inStock: number;
  category: string;
}

type CreateFormData = EditFormData;

// Stock status filter options
type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

const stockStatusOptions: { value: StockStatus; label: string }[] = [
  { value: 'all', label: 'All Stock' },
  { value: 'in_stock', label: 'In Stock (> 0)' },
  { value: 'low_stock', label: 'Low Stock (1-10)' },
  { value: 'out_of_stock', label: 'Out of Stock (0)' },
];

type SortKey = 'name' | 'price' | 'inStock';

type SortConfig = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

export default function ProductManager({
  initialProducts,
  onCreateNew,
  onFullEdit,
  onEditProduct,
  onMutate,
  embedded = false,
}: ProductManagerProps) {
  const openFullEdit = onFullEdit ?? onEditProduct;
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Search, category, and stock status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk Category Change Modal
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkNewCategory, setBulkNewCategory] = useState('');

  // Bulk Price Adjustment Modal
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [priceAdjustmentType, setPriceAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
  const [priceAdjustmentValue, setPriceAdjustmentValue] = useState(10);
  const [priceAdjustmentDirection, setPriceAdjustmentDirection] = useState<'increase' | 'decrease'>('increase');

  // Bulk Sale Management Modal
  const [showBulkSaleModal, setShowBulkSaleModal] = useState(false);
  const [bulkSaleAction, setBulkSaleAction] = useState<'set' | 'remove'>('set');
  const [bulkSalePrice, setBulkSalePrice] = useState(0);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  // Sync with parent when initialProducts change
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Derived unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All Categories', ...cats.sort()];
  }, [products]);

  // Filtered + Sorted products
  const displayedProducts = useMemo(() => {
    let result = [...products];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.slug.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (selectedCategory !== 'All Categories') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Stock status filter
    if (stockStatus !== 'all') {
      if (stockStatus === 'in_stock') {
        result = result.filter(p => p.inStock > 0);
      } else if (stockStatus === 'low_stock') {
        result = result.filter((p) => isLowStock(p));
      } else if (stockStatus === 'out_of_stock') {
        result = result.filter(p => p.inStock === 0);
      }
    }

    // Sorting
    result.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      if (sortConfig.key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortConfig.key === 'price') {
        valA = a.salePrice ?? a.price;
        valB = b.salePrice ?? b.price;
      } else {
        valA = a.inStock;
        valB = b.inStock;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [products, searchTerm, selectedCategory, stockStatus, sortConfig]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All Categories');
    setStockStatus('all');
  };

  // Toggle sort
  const handleSort = (key: SortKey) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  // Get sort indicator
  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Bulk selection helpers
  const isSelected = (id: number) => selectedIds.includes(id);

  const toggleSelect = (id: number) => {
    if (isSelected(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    const visibleIds = displayedProducts.map(p => p.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    } else {
      const newSelected = [...new Set([...selectedIds, ...visibleIds])];
      setSelectedIds(newSelected);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setShowBulkCategoryModal(false);
    setShowBulkPriceModal(false);
    setShowBulkSaleModal(false);
  };

  // Confirmation helper
  const showConfirmation = (title: string, message: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const executeConfirmedAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    closeConfirmModal();
  };

  // Bulk Stock Update
  const handleBulkStockUpdate = async () => {
    if (selectedIds.length === 0) return;

    const newStockStr = prompt(`Enter new stock value for ${selectedIds.length} selected product(s):`, '10');
    if (newStockStr === null) return;

    const newStock = parseInt(newStockStr);
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Please enter a valid non-negative number');
      return;
    }

    setLoading(true);

    try {
      const updatedProducts = products.map(p =>
        selectedIds.includes(p.id) ? { ...p, inStock: newStock } : p
      );
      setProducts(updatedProducts);

      const updatePromises = selectedIds.map(id =>
        fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ inStock: newStock }),
        })
      );

      await Promise.allSettled(updatePromises);

      toast.success(`Stock updated to ${newStock} for ${selectedIds.length} products`);
      clearSelection();
      onMutate?.();
    } catch {
      toast.error('Some updates may have failed');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Category Change
  const openBulkCategoryModal = () => {
    if (selectedIds.length === 0) return;
    const firstSelected = products.find(p => selectedIds.includes(p.id));
    setBulkNewCategory(firstSelected?.category || uniqueCategories[1] || '');
    setShowBulkCategoryModal(true);
  };

  const handleBulkCategoryChange = async () => {
    if (selectedIds.length === 0 || !bulkNewCategory) return;

    setLoading(true);
    setShowBulkCategoryModal(false);

    try {
      const updatedProducts = products.map(p =>
        selectedIds.includes(p.id) ? { ...p, category: bulkNewCategory } : p
      );
      setProducts(updatedProducts);

      const updatePromises = selectedIds.map(id =>
        fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ category: bulkNewCategory }),
        })
      );

      await Promise.allSettled(updatePromises);

      toast.success(`Category changed to "${bulkNewCategory}" for ${selectedIds.length} products`);
      clearSelection();
      onMutate?.();
    } catch {
      toast.error('Some category updates may have failed');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Price Adjustment
  const openBulkPriceModal = () => {
    if (selectedIds.length === 0) return;
    setPriceAdjustmentType('percentage');
    setPriceAdjustmentValue(10);
    setPriceAdjustmentDirection('increase');
    setShowBulkPriceModal(true);
  };

  const handleBulkPriceAdjustment = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    setShowBulkPriceModal(false);

    try {
      const updatedProducts = products.map(p => {
        if (!selectedIds.includes(p.id)) return p;

        const currentPrice = p.salePrice ?? p.price;
        let newPrice: number;

        if (priceAdjustmentType === 'percentage') {
          const multiplier = priceAdjustmentDirection === 'increase' ? (1 + priceAdjustmentValue / 100) : (1 - priceAdjustmentValue / 100);
          newPrice = Math.round(currentPrice * multiplier);
        } else {
          newPrice = priceAdjustmentDirection === 'increase' 
            ? currentPrice + priceAdjustmentValue 
            : Math.max(0, currentPrice - priceAdjustmentValue);
        }

        return { ...p, price: Math.max(1000, newPrice) };
      });

      setProducts(updatedProducts);

      const updatePromises = selectedIds.map(id => {
        const product = updatedProducts.find(p => p.id === id)!;
        return fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ price: product.price }),
        });
      });

      await Promise.allSettled(updatePromises);

      const actionText = `${priceAdjustmentDirection === 'increase' ? '+' : '-'}${priceAdjustmentValue}${priceAdjustmentType === 'percentage' ? '%' : ' ₦'}`;
      toast.success(`Prices adjusted by ${actionText} for ${selectedIds.length} products`);
      clearSelection();
      onMutate?.();
    } catch {
      toast.error('Some price updates may have failed');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Sale Management
  const openBulkSaleModal = () => {
    if (selectedIds.length === 0) return;
    setBulkSaleAction('set');
    const first = products.find(p => selectedIds.includes(p.id));
    const basePrice = first ? (first.salePrice ?? first.price) : 15000;
    setBulkSalePrice(Math.round(basePrice * 0.8));
    setShowBulkSaleModal(true);
  };

  const handleBulkSaleUpdate = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    setShowBulkSaleModal(false);

    try {
      const updatedProducts = products.map(p => {
        if (!selectedIds.includes(p.id)) return p;

        if (bulkSaleAction === 'remove') {
          return { ...p, salePrice: undefined };
        } else {
          const regularPrice = p.price;
          const newSale = Math.min(bulkSalePrice, Math.floor(regularPrice * 0.95));
          return { ...p, salePrice: Math.max(1000, newSale) };
        }
      });

      setProducts(updatedProducts);

      const updatePromises = selectedIds.map(id => {
        const product = updatedProducts.find(p => p.id === id)!;
        return fetch(`/api/admin/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ salePrice: product.salePrice }),
        });
      });

      await Promise.allSettled(updatePromises);

      const message = bulkSaleAction === 'remove' 
        ? `Removed from sale for ${selectedIds.length} products`
        : `Sale price set for ${selectedIds.length} products`;
      toast.success(message);
      clearSelection();
      onMutate?.();
    } catch {
      toast.error('Some sale updates may have failed');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Delete with confirmation
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;

    showConfirmation(
      'Delete Selected Products',
      `Are you sure you want to delete ${selectedIds.length} selected products? This action cannot be undone.`,
      async () => {
        setLoading(true);

        try {
          const remainingProducts = products.filter(p => !selectedIds.includes(p.id));
          setProducts(remainingProducts);

          const deletePromises = selectedIds.map(id =>
            fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' })
          );

          await Promise.allSettled(deletePromises);

          toast.success(`Deleted ${selectedIds.length} products`);
          clearSelection();
          onMutate?.();
        } catch {
          toast.error('Some deletions may have failed');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Helper to get stock status label and color
  const getStockStatus = (product: Product) => {
    const limit = readCatalogMeta(product).lowStockThreshold;
    if (product.inStock === 0) return { label: 'Out', color: 'text-red-600 bg-red-50 border-red-200' };
    if (product.inStock <= limit) return { label: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: 'Good', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  /** Always opens ProductManager quick edit (price / stock / category). */
  const startQuickEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: product.price,
      salePrice: product.salePrice,
      inStock: product.inStock,
      category: product.category,
    });
  };

  const closeEdit = () => {
    setEditingProduct(null);
    setEditForm(null);
  };

  // Handle form changes
  const handleFormChange = (field: keyof EditFormData, value: string | number | undefined) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  // Save edited product
  const handleSaveEdit = async () => {
    if (!editingProduct || !editForm) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error('Failed to update product');

      const updatedProducts = products.map(p =>
        p.id === editingProduct.id ? { ...p, ...editForm } : p
      );
      setProducts(updatedProducts);

      toast.success('Product updated successfully');
      closeEdit();
      onMutate?.();
    } catch {
      toast.error('Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  // Delete single product with confirmation
  const handleDelete = (id: number, name: string) => {
    showConfirmation(
      'Delete Product',
      `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      async () => {
        setDeletingId(id);

        try {
          const res = await fetch(`/api/admin/products/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok) throw new Error('Failed to delete');

          setProducts(products.filter(p => p.id !== id));
          setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
          toast.success('Product deleted');
          onMutate?.();
        } catch {
          toast.error('Failed to delete product');
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  // Quick stock update (single)
  const updateStock = async (id: number, newStock: number) => {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inStock: newStock }),
      });

      if (!res.ok) throw new Error('Failed to update stock');

      setProducts(products.map(p =>
        p.id === id ? { ...p, inStock: newStock } : p
      ));
      toast.success('Stock updated');
      onMutate?.();
    } catch {
      toast.error('Failed to update stock');
    }
  };

  // Create New Product
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormData>({
    name: '',
    price: 15000,
    inStock: 20,
    category: 'Ankara Prints',
  });

  const openCreate = () => {
    if (onCreateNew) {
      onCreateNew();
      return;
    }
    setCreateForm({ name: '', price: 15000, inStock: 20, category: 'Ankara Prints', salePrice: undefined });
    setShowCreateModal(true);
  };

  const closeCreate = () => setShowCreateModal(false);

  const handleCreateFormChange = (field: keyof CreateFormData, value: string | number | undefined) => {
    setCreateForm({ ...createForm, [field]: value });
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...createForm,
        slug: createForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        shortDescription: createForm.name,
        description: '',
        images: [],
        rating: 4.5,
        reviewCount: 0,
        colorFamily: 'Mixed',
        patternStyle: 'Various',
        lengthOptions: ['5 yards', '6 yards'],
        specifications: {},
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create product');
      }

      const newProduct = await res.json();
      setProducts([...products, newProduct]);
      toast.success('New product created successfully');
      closeCreate();
      onMutate?.();
    } catch {
      toast.error('Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  // Seed to DB
  const handleSeedToDb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Products synced to database');
      } else {
        toast.error(data.error || 'Failed to seed products');
      }
    } catch {
      toast.error('Error seeding products to database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {!embedded && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Product Management</h2>
            <p className="text-sm text-[#6B5F54] mt-1">Manage your premium textile catalog</p>
          </div>
        )}

        <div
          className={`flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-[#D4C9B8] rounded-xl px-3 py-2 w-full ${embedded ? "" : "md:w-auto"}`}
          role="search"
          aria-label="Filter products"
        >
          <input
            type="search"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search products"
            className="input-premium w-full sm:w-40 text-sm border-0 focus:ring-0 px-2 py-2 min-h-[40px]"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="input-premium text-sm border-0 focus:ring-0 px-2 py-2 bg-transparent w-full sm:w-auto min-h-[40px]"
          >
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value as StockStatus)}
            aria-label="Filter by stock status"
            className="input-premium text-sm border-0 focus:ring-0 px-2 py-2 bg-transparent w-full sm:w-auto min-h-[40px]"
          >
            {stockStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {(searchTerm || selectedCategory !== 'All Categories' || stockStatus !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs px-3 py-2 text-[#6B5F54] hover:text-red-600 min-h-[40px]"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button type="button" onClick={openCreate} className="btn-primary px-4 py-2.5 text-sm flex-1 md:flex-none min-h-[44px]">
            + Create
          </button>
          <button
            type="button"
            onClick={handleSeedToDb}
            disabled={loading}
            className="px-4 py-2.5 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white/50 flex-1 md:flex-none min-h-[44px]"
          >
            {loading ? 'Syncing...' : 'Seed DB'}
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[#F8F4EC] border border-[#D4C9B8] rounded-2xl px-4 py-3">
          <div className="font-medium text-sm">
            {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={handleBulkStockUpdate}
              disabled={loading}
              className="flex-1 md:flex-none px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white active:bg-white transition-colors"
            >
              Update Stock
            </button>
            <button
              onClick={openBulkPriceModal}
              disabled={loading}
              className="flex-1 md:flex-none px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white active:bg-white transition-colors"
            >
              Adjust Price
            </button>
            <button
              onClick={openBulkCategoryModal}
              disabled={loading}
              className="flex-1 md:flex-none px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white active:bg-white transition-colors"
            >
              Change Category
            </button>
            <button
              onClick={openBulkSaleModal}
              disabled={loading}
              className="flex-1 md:flex-none px-4 py-2 text-sm border border-[#D4C9B8] rounded-xl hover:bg-white active:bg-white transition-colors"
            >
              Manage Sale
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={loading}
              className="flex-1 md:flex-none px-4 py-2 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 active:bg-red-50 transition-colors"
            >
              Delete
            </button>
            <button onClick={clearSelection} className="flex-1 md:flex-none px-4 py-2 text-sm text-[#6B5F54] hover:text-[#3A2F27] border border-[#D4C9B8] rounded-xl">
              Clear
            </button>
          </div>
        </div>
      )}

      {(searchTerm || selectedCategory !== 'All Categories' || stockStatus !== 'all') && (
        <div className="text-xs md:text-sm text-[#6B5F54]">Showing {displayedProducts.length} of {products.length} products</div>
      )}

      <div className="bg-white rounded-2xl border border-[#D4C9B8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#F8F4EC] border-b border-[#D4C9B8]">
              <tr>
                <th className="w-10 p-3 md:p-4 sticky left-0 bg-[#F8F4EC] z-10">
                  <input
                    type="checkbox"
                    checked={displayedProducts.length > 0 && displayedProducts.every(p => selectedIds.includes(p.id))}
                    onChange={toggleSelectAll}
                    className="accent-[#6B2D3C] scale-110 md:scale-100"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="text-left p-3 md:p-4 font-medium cursor-pointer hover:bg-[#F1EDE4] select-none sticky left-10 bg-[#F8F4EC] z-10 min-w-[180px]"
                >
                  Product {getSortIndicator('name')}
                </th>
                <th className="text-left p-3 md:p-4 font-medium text-[#6B5F54] hidden md:table-cell">Category</th>
                <th
                  onClick={() => handleSort('price')}
                  className="text-right p-3 md:p-4 font-medium cursor-pointer hover:bg-[#F1EDE4] select-none"
                >
                  Price {getSortIndicator('price')}
                </th>
                <th
                  onClick={() => handleSort('inStock')}
                  className="text-center p-3 md:p-4 font-medium cursor-pointer hover:bg-[#F1EDE4] select-none min-w-[120px]"
                >
                  Stock {getSortIndicator('inStock')}
                </th>
                <th className="text-right p-3 md:p-4 font-medium w-36 md:w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE6D9]">
              {displayedProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#6B5F54] text-sm">
                    {products.length === 0
                      ? 'No products found. Tap Create to add your first fabric.'
                      : 'No products match your current filters.'}
                  </td>
                </tr>
              )}
              {displayedProducts.map((product) => {
                const stockInfo = getStockStatus(product);
                const checked = isSelected(product.id);
                const badge = listingBadge(product);

                return (
                  <tr key={product.id} className="hover:bg-[#F8F4EC] active:bg-[#F1EDE4] transition-colors">
                    <td className="p-3 md:p-4 sticky left-0 bg-white z-10">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(product.id)}
                        className="accent-[#6B2D3C] scale-110 md:scale-100"
                      />
                    </td>
                    <td className="p-3 md:p-4 sticky left-10 bg-white z-10 min-w-[180px]">
                      <div className="font-medium leading-tight">{product.name}</div>
                      <div className="text-[10px] md:text-xs text-[#6B5F54] mt-0.5 truncate">
                        {product.slug}
                        {badge ? ` · ${badge}` : ""}
                      </div>
                    </td>
                    <td className="p-3 md:p-4 text-sm text-[#6B5F54] hidden md:table-cell">{product.category}</td>
                    <td className="p-3 md:p-4 text-right font-medium whitespace-nowrap">
                      {(product.salePrice || product.price).toLocaleString()}
                      {product.salePrice && <span className="text-[10px] text-red-500 line-through ml-1">{product.price}</span>}
                    </td>
                    <td className="p-3 md:p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] md:text-xs font-medium rounded-full border ${stockInfo.color} whitespace-nowrap`}>
                          {product.inStock} {stockInfo.label}
                        </span>
                        <input
                          type="number"
                          value={product.inStock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const updated = products.map(p => p.id === product.id ? { ...p, inStock: val } : p);
                            setProducts(updated);
                          }}
                          onBlur={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                          className="w-12 md:w-14 text-center border border-[#D4C9B8] rounded px-1 py-0.5 text-xs md:text-sm"
                        />
                      </div>
                    </td>
                    <td className="p-3 md:p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startQuickEdit(product)}
                          className="px-2.5 py-1 text-xs border border-[#D4C9B8] rounded-lg hover:bg-white active:bg-white transition-colors"
                        >
                          Quick edit
                        </button>
                        {openFullEdit && (
                          <button
                            type="button"
                            onClick={() => openFullEdit(product)}
                            className="px-2.5 py-1 text-xs border border-[#6B2D3C]/30 text-[#6B2D3C] rounded-lg hover:bg-[#F8F4EC] active:bg-[#F1EDE4] transition-colors"
                          >
                            Full edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id, product.name)}
                          disabled={deletingId === product.id}
                          className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 active:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === product.id ? '...' : 'Del'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[10px] md:text-xs text-[#6B5F54] px-1">
        Tip: Scroll horizontally on mobile. Use bulk actions for fast inventory management.
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">{confirmTitle}</h3>
            <p className="text-[#6B5F54] mb-6">{confirmMessage}</p>

            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkCategoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Change Category</h3>
            <p className="text-sm text-[#6B5F54] mb-4">
              Update category for <strong>{selectedIds.length}</strong> selected product{selectedIds.length > 1 ? 's' : ''}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">New Category</label>
                <select
                  value={bulkNewCategory}
                  onChange={(e) => setBulkNewCategory(e.target.value)}
                  className="input-premium w-full"
                >
                  {uniqueCategories.filter(c => c !== 'All Categories').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkCategoryModal(false)}
                className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors active:bg-[#F1EDE4]">
                Cancel
              </button>
              <button
                onClick={handleBulkCategoryChange}
                disabled={loading || !bulkNewCategory}
                className="flex-1 py-3 btn-primary disabled:opacity-60">
                {loading ? 'Updating...' : 'Apply to Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkPriceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Adjust Prices</h3>
            <p className="text-sm text-[#6B5F54] mb-4">
              Adjust price for <strong>{selectedIds.length}</strong> selected product{selectedIds.length > 1 ? 's' : ''}.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Adjustment Type</label>
                  <select
                    value={priceAdjustmentType}
                    onChange={(e) => setPriceAdjustmentType(e.target.value as 'percentage' | 'fixed')}
                    className="input-premium w-full"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Direction</label>
                  <select
                    value={priceAdjustmentDirection}
                    onChange={(e) => setPriceAdjustmentDirection(e.target.value as 'increase' | 'decrease')}
                    className="input-premium w-full"
                  >
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">
                  {priceAdjustmentType === 'percentage' ? 'Percentage Value' : 'Amount (₦)'}
                </label>
                <input
                  type="number"
                  value={priceAdjustmentValue}
                  onChange={(e) => setPriceAdjustmentValue(parseInt(e.target.value) || 0)}
                  className="input-premium w-full"
                  min="0"
                />
              </div>

              <div className="text-xs text-[#6B5F54] bg-[#F8F4EC] p-3 rounded-xl">
                Example: {priceAdjustmentDirection === 'increase' ? '+' : '-'}{priceAdjustmentValue}
                {priceAdjustmentType === 'percentage' ? '%' : ' ₦'} on current price.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors active:bg-[#F1EDE4]">
                Cancel
              </button>
              <button
                onClick={handleBulkPriceAdjustment}
                disabled={loading || priceAdjustmentValue <= 0}
                className="flex-1 py-3 btn-primary disabled:opacity-60">
                {loading ? 'Updating...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-2">Manage Sale Pricing</h3>
            <p className="text-sm text-[#6B5F54] mb-4">
              Update sale status for <strong>{selectedIds.length}</strong> selected product{selectedIds.length > 1 ? 's' : ''}.
            </p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkSaleAction('set')}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${bulkSaleAction === 'set' ? 'bg-[#6B2D3C] text-white border-[#6B2D3C]' : 'border-[#D4C9B8] hover:bg-[#F8F4EC]'}`}
                >
                  Set Sale Price
                </button>
                <button
                  onClick={() => setBulkSaleAction('remove')}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${bulkSaleAction === 'remove' ? 'bg-[#6B2D3C] text-white border-[#6B2D3C]' : 'border-[#D4C9B8] hover:bg-[#F8F4EC]'}`}
                >
                  Remove from Sale
                </button>
              </div>

              {bulkSaleAction === 'set' && (
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">New Sale Price (₦)</label>
                  <input
                    type="number"
                    value={bulkSalePrice}
                    onChange={(e) => setBulkSalePrice(parseInt(e.target.value) || 0)}
                    className="input-premium w-full"
                    min="1000"
                  />
                  <p className="text-xs text-[#6B5F54] mt-1">Will be set lower than regular price automatically.</p>
                </div>
              )}

              {bulkSaleAction === 'remove' && (
                <div className="text-sm text-[#6B5F54] bg-[#F8F4EC] p-4 rounded-xl">
                  This will remove the sale price from all selected products (they will show regular price only).
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkSaleModal(false)}
                className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors active:bg-[#F1EDE4]">
                Cancel
              </button>
              <button
                onClick={handleBulkSaleUpdate}
                disabled={loading}
                className="flex-1 py-3 btn-primary disabled:opacity-60">
                {loading ? 'Updating...' : bulkSaleAction === 'set' ? 'Set Sale Price' : 'Remove from Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-1">Quick edit</h3>
            <p className="text-xs text-[#6B5F54] mb-4">
              Name, price, stock &amp; category. Use Full edit for images and specs.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Product Name</label>
                <input type="text" value={editForm.name} onChange={(e) => handleFormChange('name', e.target.value)} className="input-premium w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Price (₦)</label>
                  <input type="number" value={editForm.price} onChange={(e) => handleFormChange('price', parseInt(e.target.value) || 0)} className="input-premium w-full" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Sale Price (optional)</label>
                  <input type="number" value={editForm.salePrice || ''} onChange={(e) => handleFormChange('salePrice', e.target.value ? parseInt(e.target.value) : undefined)} className="input-premium w-full" placeholder="No sale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Stock</label>
                  <input type="number" value={editForm.inStock} onChange={(e) => handleFormChange('inStock', parseInt(e.target.value) || 0)} className="input-premium w-full" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Category</label>
                  <input type="text" value={editForm.category} onChange={(e) => handleFormChange('category', e.target.value)} className="input-premium w-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeEdit} className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors active:bg-[#F1EDE4]">Cancel</button>
              <button onClick={handleSaveEdit} disabled={loading} className="flex-1 py-3 btn-primary">{loading ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-semibold mb-4">Create New Product</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#6B5F54] block mb-1.5">Product Name *</label>
                <input type="text" value={createForm.name} onChange={(e) => handleCreateFormChange('name', e.target.value)} className="input-premium w-full" placeholder="e.g. Royal Gold Ankara" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Price (₦) *</label>
                  <input type="number" value={createForm.price} onChange={(e) => handleCreateFormChange('price', parseInt(e.target.value) || 0)} className="input-premium w-full" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Sale Price (optional)</label>
                  <input type="number" value={createForm.salePrice || ''} onChange={(e) => handleCreateFormChange('salePrice', e.target.value ? parseInt(e.target.value) : undefined)} className="input-premium w-full" placeholder="No sale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Initial Stock</label>
                  <input type="number" value={createForm.inStock} onChange={(e) => handleCreateFormChange('inStock', parseInt(e.target.value) || 0)} className="input-premium w-full" />
                </div>
                <div>
                  <label className="text-sm text-[#6B5F54] block mb-1.5">Category</label>
                  <input type="text" value={createForm.category} onChange={(e) => handleCreateFormChange('category', e.target.value)} className="input-premium w-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeCreate} className="flex-1 py-3 border border-[#D4C9B8] rounded-xl hover:bg-[#F8F4EC] transition-colors active:bg-[#F1EDE4]">Cancel</button>
              <button onClick={handleCreate} disabled={loading} className="flex-1 py-3 btn-primary">{loading ? 'Creating...' : 'Create Product'}</button>
            </div>
            <p className="text-xs text-[#6B5F54] mt-4 text-center">
              For full options (images, specs), use the rich &quot;Add Fabric&quot; button in the header.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
