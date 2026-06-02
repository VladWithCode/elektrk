/**
 * Store root layout — ElektrK
 *
 * This is the root layout for the entire storefront (all routes under (store)).
 * It owns <html> and <body> so that Payload Admin — which lives in (payload)/admin
 * with its own RootLayout — is never nested inside this layout.
 *
 * Multiple root layouts pattern (Next.js App Router):
 *   app/(store)/layout.tsx   → storefront: html/body + providers + Navbar/Footer
 *   app/(payload)/admin/layout.tsx → Payload Admin: its own html/body via RootLayout
 */

import type { Metadata } from "next";
import { Geist_Mono, Montserrat, Manrope } from "next/font/google";
import "../globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/context/ThemeContext";
import { CartProvider } from "@/context/CartContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { getStoreSettings } from "@/lib/repositories/settings";

const manropeHeading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * metadataBase is required by Next.js to resolve relative Open Graph image
 * URLs. Set to NEXT_PUBLIC_SERVER_URL in production; falls back to localhost
 * so the build succeeds without the env var.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "D.E. MTY — Componentes Eléctricos",
    template: "%s | D.E. MTY",
  },
  description:
    "Distribuidora especializada en interruptores termomagnéticos y componentes eléctricos. Siemens, ABB y Schneider Electric. Precios con IVA incluido.",
  openGraph: {
    siteName: "Distribuidor Electrico Monterrey",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function StoreRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getStoreSettings();

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        geistMono.variable,
        montserrat.variable,
        manropeHeading.variable
      )}
    >
      <head>
        {/* Pre-hydration theme script — runs before first paint to apply
            `.dark` class if user previously chose dark. Default is light;
            no system-preference fallback so first-time visitors get light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('elektrk-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <CartProvider>
            <SessionProvider>
              <AnnouncementBar
                enabled={settings.announcementEnabled}
                message={settings.announcementBanner}
              />
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartDrawer
                shippingRate={settings.flatShippingRate}
                taxIncluded={settings.taxIncludedByDefault}
              />
            </SessionProvider>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
