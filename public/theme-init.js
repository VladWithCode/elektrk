// Pre-hydration theme init — runs before first paint to avoid a flash of the
// wrong theme. Default is light; we only opt in to dark if the user previously
// chose it (stored in localStorage). No prefers-color-scheme fallback, so
// first-time visitors always get the light theme.
//
// Served as a static asset (script-src 'self') instead of an inline script so
// the page needs no 'unsafe-inline' in its Content-Security-Policy.
(function () {
  try {
    if (localStorage.getItem("elektrk-theme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    /* localStorage unavailable (private mode, disabled cookies) — stay light */
  }
})();
