/**
 * AnnouncementBar — ElektrK storefront
 *
 * Server component. Rendered by the store root layout just above the Navbar.
 * Reads `announcementEnabled` + `announcementBanner` from the already-fetched
 * StorefrontSettings so no additional DB call is needed.
 *
 * Rules:
 *  - Only renders when `announcementEnabled === true` AND `announcementBanner`
 *    is a non-empty string.
 *  - Returns null (nothing rendered) otherwise — zero layout impact.
 *  - Responsive: full-width strip, text centred on all viewports.
 *  - Respects dark mode via Tailwind semantic colour tokens.
 */

interface AnnouncementBarProps {
  enabled?: boolean | null;
  message?: string | null;
}

export function AnnouncementBar({ enabled, message }: AnnouncementBarProps) {
  if (!enabled || !message?.trim()) return null;

  return (
    <div
      role="banner"
      aria-label="Anuncio de la tienda"
      className="w-full bg-primary text-primary-foreground text-xs sm:text-sm font-medium text-center px-4 py-2 leading-snug"
    >
      <span>{message.trim()}</span>
    </div>
  );
}
