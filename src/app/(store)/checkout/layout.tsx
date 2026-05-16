import type { Metadata } from "next";

/**
 * Layout for /checkout and its children (/checkout/success, /checkout/cancel).
 *
 * checkout/page.tsx is "use client" (reads CartContext), so metadata lives here.
 */
export const metadata: Metadata = {
  title: "Checkout",
  description: "Completa tu compra de componentes eléctricos en ElektrK.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
