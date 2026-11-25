import type { Product } from "@/types/product";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { toast } from "sonner";
import { unitPriceForSelection } from "@/lib/catalog-meta";

interface AddToCartOptions {
  product: Product;
  length?: string;
  quantity?: number;
  imageRect?: DOMRect;
  openDrawer?: boolean;
  showToast?: boolean;
}

export function addToCartWithFeedback({
  product,
  length,
  quantity = 1,
  imageRect,
  openDrawer = true,
  showToast = true,
}: AddToCartOptions) {
  const selectedLength = length ?? product.lengthOptions[0];
  const { addToCart } = useCartStore.getState();
  const { triggerFlyToCart, setCartDrawerOpen } = useUIStore.getState();
  const price = unitPriceForSelection(product, selectedLength);

  for (let i = 0; i < quantity; i++) {
    addToCart(product, selectedLength);
  }

  if (imageRect) {
    triggerFlyToCart(product.images[0], imageRect);
  }

  if (showToast) {
    toast.success("Added to cart", {
      description: `${product.name} • ${selectedLength} × ${quantity} — ₦${(price * quantity).toLocaleString()}`,
      action: {
        label: "View cart",
        onClick: () => setCartDrawerOpen(true),
      },
    });
  }

  if (openDrawer) {
    setTimeout(() => setCartDrawerOpen(true), imageRect ? 600 : 0);
  }
}