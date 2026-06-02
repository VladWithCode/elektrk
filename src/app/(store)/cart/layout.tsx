import type { Metadata } from "next";

/**
 * Layout for /cart
 *
 * cart/page.tsx is a "use client" component (requires CartContext), so it
 * cannot export `metadata` directly. This layout acts as the metadata owner
 * for the route while leaving the page component untouched.
 */
export const metadata: Metadata = {
  title: "Tu carrito",
  description:
    "Revisa los productos en tu carrito, ajusta cantidades y procede al pago de forma segura en Distribuidor Electrico Monterrey.",
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
