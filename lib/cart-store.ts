import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, Product } from "@/types/product";
import { unitPriceForSelection } from "@/lib/catalog-meta";

interface CartStore {
  items: CartItem[];
  /** Add product; optional quantity (default 1) for reorder / bulk. */
  addToCart: (product: Product, selectedLength: string, quantity?: number) => void;
  removeFromCart: (id: number | string, selectedLength: string) => void;
  updateQuantity: (id: number | string, selectedLength: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (product, selectedLength, quantity = 1) => {
        const qty = Math.max(1, Math.floor(Number(quantity) || 1));
        const currentPrice = unitPriceForSelection(product, selectedLength);
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.id === product.id && item.selectedLength === selectedLength
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.id === product.id && item.selectedLength === selectedLength
                  ? { ...item, quantity: item.quantity + qty }
                  : item
              ),
            };
          } else {
            return {
              items: [
                ...state.items,
                {
                  ...product,
                  quantity: qty,
                  selectedLength,
                  currentPrice,
                } as CartItem,
              ],
            };
          }
        });
      },

      removeFromCart: (id, selectedLength) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.id === id && item.selectedLength === selectedLength)
          ),
        }));
      },

      updateQuantity: (id, selectedLength, quantity) => {
        if (quantity < 1) return;
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.selectedLength === selectedLength
              ? { ...item, quantity }
              : item
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotalPrice: () => {
        return get().items.reduce((total, item) => {
          return total + (item.currentPrice || item.price) * item.quantity;
        }, 0);
      },

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: "biyora-cart",
    }
  )
);
