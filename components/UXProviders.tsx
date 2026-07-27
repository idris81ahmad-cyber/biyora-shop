"use client";

import CartDrawer from "@/components/CartDrawer";
import QuickViewModal from "@/components/QuickViewModal";
import AddToCartFly from "@/components/AddToCartFly";
import MobileNav from "@/components/MobileNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import VoiceSupportButton from "@/components/VoiceSupportButton";

export default function UXProviders() {
  return (
    <>
      <CartDrawer />
      <QuickViewModal />
      <AddToCartFly />
      <MobileNav />
      <WhatsAppButton />
      <VoiceSupportButton />
    </>
  );
}
