"use client";

/**
 * WhatsAppFloatButton — ElektrK
 *
 * Floating WhatsApp CTA, fixed to the bottom-right corner of the viewport on
 * every storefront page. Lives in the (store) root layout, which stays
 * mounted across client-side navigation, so the mount animation below plays
 * once per session instead of replaying on every page change.
 */

import { motion, useReducedMotion } from "motion/react";

interface WhatsAppFloatButtonProps {
  /** Prebuilt https://wa.me/... link. Button renders nothing when null. */
  whatsappUrl: string | null;
}

export function WhatsAppFloatButton({ whatsappUrl }: WhatsAppFloatButtonProps) {
  const shouldReduce = useReducedMotion();

  if (!whatsappUrl) return null;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear por WhatsApp"
      initial={{ opacity: 0, scale: 0.4, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: shouldReduce ? 0 : 0.5,
        delay: shouldReduce ? 0 : 0.6,
        ease: "backOut",
      }}
      whileHover={{ scale: shouldReduce ? 1 : 1.08 }}
      whileTap={{ scale: shouldReduce ? 1 : 0.95 }}
      className="fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-shadow hover:shadow-xl sm:bottom-6 sm:right-6 sm:size-14 lg:size-16"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="size-6 sm:size-7 lg:size-8"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7C17.18 3.03 14.7 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.17 8.17 0 0 1-1.26-4.36c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.4a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.24-8.15 8.24Zm4.5-6.15c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.96-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.66-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
      </svg>
    </motion.a>
  );
}
