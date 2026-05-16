# ElektrK Design System

> Extracted from the live codebase. Use as input for generating a web Design System via an LLM.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | ElektrK |
| **Tagline** | The store for your electric stuff |
| **Domain** | E-commerce — electronics & electric products |
| **Tone** | Modern, clean, tech-forward, trustworthy |
| **Target Audience** | Tech-savvy consumers, electronics hobbyists, professionals |

---

## 2. Technology Foundation

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router, React Server Components) |
| **UI Library** | React 19 |
| **Styling** | Tailwind CSS v4 (utility-first, JIT, `@import "tailwindcss"`) |
| **Component Primitives** | Radix UI (headless, accessible) |
| **Component System** | shadcn/ui (radix-nova style preset) |
| **Variant Management** | class-variance-authority (CVA v0.7) |
| **Class Merging** | `cn()` utility — clsx + tailwind-merge |
| **Icons** | Lucide React |
| **Animation** | tw-animate-css + motion (formerly framer-motion) |
| **Color Space** | OKLCH — perceptually uniform |
| **Theming** | CSS custom properties, `.dark` class toggle |
| **Font Loading** | next/font/google, CSS variable injection |
| **Runtime** | Bun |

---

## 3. Color System

### 3.1 Semantic Color Tokens (Light Mode — `:root`)

All colors use **OKLCH** notation: `oklch(L C H)` where L = lightness (0–1), C = chroma, H = hue angle.

| Token | Value | Visual Role |
|---|---|---|
| `--background` | `oklch(1 0 0)` | Page background (pure white) |
| `--foreground` | `oklch(0.145 0 0)` | Primary text (near-black) |
| `--card` | `oklch(1 0 0)` | Card/surface background |
| `--card-foreground` | `oklch(0.145 0 0)` | Card text |
| `--popover` | `oklch(1 0 0)` | Popover/dropdown background |
| `--popover-foreground` | `oklch(0.145 0 0)` | Popover text |
| `--primary` | `oklch(0.52 0.105 223.128)` | Primary action color (~blue, hue 223°) |
| `--primary-foreground` | `oklch(0.984 0.019 200.873)` | Text on primary |
| `--secondary` | `oklch(0.967 0.001 286.375)` | Secondary surface (~warm gray) |
| `--secondary-foreground` | `oklch(0.21 0.006 285.885)` | Text on secondary |
| `--muted` | `oklch(0.97 0 0)` | Muted/disabled surface |
| `--muted-foreground` | `oklch(0.556 0 0)` | Muted/disabled text |
| `--accent` | `oklch(0.97 0 0)` | Accent surface (highlights) |
| `--accent-foreground` | `oklch(0.205 0 0)` | Text on accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive action color (~red, hue 27°) |
| `--border` | `oklch(0.922 0 0)` | Default border color |
| `--input` | `oklch(0.922 0 0)` | Input field border |
| `--ring` | `oklch(0.708 0 0)` | Focus/ring indicator |
| `--chart-1` | `oklch(0.855 0.138 181.071)` | Chart color 1 (~teal light) |
| `--chart-2` | `oklch(0.704 0.14 182.503)` | Chart color 2 (~teal) |
| `--chart-3` | `oklch(0.6 0.118 184.704)` | Chart color 3 (~teal mid) |
| `--chart-4` | `oklch(0.511 0.096 186.391)` | Chart color 4 (~teal dark) |
| `--chart-5` | `oklch(0.437 0.078 188.216)` | Chart color 5 (~teal darkest) |

### 3.2 Sidebar-Specific Tokens (Light)

| Token | Value |
|---|---|
| `--sidebar` | `oklch(0.985 0 0)` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` |
| `--sidebar-primary` | `oklch(0.609 0.126 221.723)` |
| `--sidebar-primary-foreground` | `oklch(0.984 0.019 200.873)` |
| `--sidebar-accent` | `oklch(0.97 0 0)` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` |
| `--sidebar-border` | `oklch(0.922 0 0)` |
| `--sidebar-ring` | `oklch(0.708 0 0)` |

### 3.3 Dark Mode (`.dark` selector)

Dark mode inverts the background/foreground stack: backgrounds go from white to near-black (`oklch(0.145 0 0)`), text goes to off-white (`oklch(0.985 0 0)`). Cards and popovers shift to `oklch(0.205 0 0)`. Primary becomes slightly darker blue (`oklch(0.45 0.085 224.283)`). Borders use translucent white (`oklch(1 0 0 / 10%)`). Destructive shifts to a lighter red (`oklch(0.704 0.191 22.216)`). The chart palette remains identical in both modes.

### 3.4 Color Architecture Rules

- **Never hardcode colors** — always reference semantic CSS variables via Tailwind utilities (e.g. `bg-primary`, `text-foreground`, `border-border`).
- **OKLCH only** — no hex, no rgb/hsl in new tokens.
- **Tailwind token bridging** — each `--variable` is mapped into a Tailwind utility via the `@theme inline` block (e.g., `--color-primary: var(--primary)` enables `bg-primary`).
- **Dark mode variant** — use `dark:` Tailwind prefix (backed by `@custom-variant dark (&:is(.dark *))`).

---

## 4. Typography

### 4.1 Font Families

| CSS Variable | Typeface | Role | Loading |
|---|---|---|---|
| `--font-sans` | **Montserrat** | Body/UI text | next/font/google, variable font |
| `--font-heading` | **Manrope** | Headlines, display | next/font/google, variable font |
| `--font-geist-mono` | **Geist Mono** | Code, monospace | next/font/google, variable font |

### 4.2 Tailwind Font Utilities

| Utility | Maps To |
|---|---|
| `font-sans` | `var(--font-sans)` (Montserrat) |
| `font-heading` | `var(--font-heading)` (Manrope) |
| `font-mono` | `var(--font-geist-mono)` (Geist Mono) |

### 4.3 Typography Rules

- Default body uses `font-sans` (set on `<html>` via `@apply font-sans`).
- Headings (`h1`–`h6`) should use `font-heading`.
- Code blocks and inline code use `font-mono`.
- Font smoothing: `antialiased` applied globally on `<html>`.

---

## 5. Spacing & Sizing

### 5.1 Radius Scale

The radius system is a 7-step scale derived from a single `--radius` base token.

| Base | Value |
|---|---|
| `--radius` | `0.625rem` (10px) |

| Token | Formula | Computed | Usage |
|---|---|---|---|
| `--radius-sm` | `var(--radius) * 0.6` | ~6px | Inputs, badges, small chips |
| `--radius-md` | `var(--radius) * 0.8` | ~8px | Buttons (some sizes) |
| `--radius-lg` | `var(--radius)` | 10px | Default button, card corners |
| `--radius-xl` | `var(--radius) * 1.4` | ~14px | Large cards, modals |
| `--radius-2xl` | `var(--radius) * 1.8` | ~18px | Large modals, dialogs |
| `--radius-3xl` | `var(--radius) * 2.2` | ~22px | Hero sections |
| `--radius-4xl` | `var(--radius) * 2.6` | ~26px | Rounded containers |

Tailwind utilities: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-4xl`.

### 5.2 Spacing

Default Tailwind v4 spacing scale (0.25rem = 4px base). No custom spacing overrides defined yet.

---

## 6. Component Patterns

### 6.1 CVA-Based Variant Pattern

Every UI component follows this pattern:

```
1. Define variant/size configuration with cva()
2. Export the variants object for external composition
3. Accept VariantProps<typeof variants> in component props
4. Merge user className via cn(variants({ variant, size, className }))
5. Apply data-slot, data-variant, data-size attributes for debugging/testing
```

**Example (Button):**

```tsx
// 1. Define
const buttonVariants = cva("base classes", {
  variants: {
    variant: { default: "...", outline: "...", secondary: "...", ghost: "...", destructive: "...", link: "..." },
    size: { default: "h-8...", xs: "h-6...", sm: "h-7...", lg: "h-9...", icon: "size-8...", "icon-xs": "...", "icon-sm": "...", "icon-lg": "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
})

// 2. Export for composition
export { Button, buttonVariants }

// 3+4+5. Component
function Button({ className, variant = "default", size = "default", asChild, ...props }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### 6.2 Polimorphic Rendering (Slot Pattern)

Components that can render as a child element use Radix UI's `Slot.Root` with an `asChild` prop. When `asChild={true}`, the component merges its styles onto the single child element instead of wrapping it. This is used for composing links, router links, form triggers, etc.

### 6.3 Interaction State Classes

Standard focus/active/disabled ring pattern:
- `focus-visible:border-ring` — ring border on keyboard focus
- `focus-visible:ring-3 focus-visible:ring-ring/50` — ring outline at 50% opacity
- `disabled:pointer-events-none disabled:opacity-50` — visual disable state
- `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20` — validation error state
- `active:not-aria-[haspopup]:translate-y-px` — press feedback (1px down)
- `[&_svg]:pointer-events-none [&_svg]:shrink-0` — icon constraints inside buttons
- `[&_svg:not([class*='size-'])]:size-4` — default icon size override
- `group/button` + `[a]:hover:bg-primary/80` — inner anchor hover styles via parent group

### 6.4 Dark Mode Interaction Overrides

Dark mode uses separate interaction states for better contrast:
- Buttons: `dark:border-input dark:bg-input/30 dark:hover:bg-input/50`
- Ghost: `dark:hover:bg-muted/50`
- Destructive: `dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40`
- Ring: `dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`

---

## 7. shadcn/ui Custom Variants

Available from `shadcn/tailwind.css` (data-attribute-driven):

| Variant | Trigger |
|---|---|
| `data-open:` | Element has `data-state="open"` |
| `data-closed:` | Element has `data-state="closed"` |
| `data-checked:` | Element has `data-state="checked"` |
| `data-selected:` | Element is selected |
| `data-disabled:` | Element is disabled |
| `data-active:` | Element is active |
| `data-horizontal:` | Orientation is horizontal |
| `data-vertical:` | Orientation is vertical |

Accordion keyframes are also provided by this import.

---

## 8. CSS Architecture

### 8.1 File Architecture

```
src/app/globals.css
  ├── @import "tailwindcss"          # Tailwind v4 engine
  ├── @import "tw-animate-css"       # Animation utilities
  ├── @import "shadcn/tailwind.css"  # shadcn data-variants + accordion
  ├── @custom-variant dark (...)     # Dark mode variant registration
  ├── @theme inline { ... }          # Token bridging (CSS vars → Tailwind utils)
  ├── :root { ... }                  # Light mode CSS custom properties
  ├── .dark { ... }                  # Dark mode overrides
  └── @layer base { ... }            # Base element resets
```

### 8.2 Base Layer Rules

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
```

### 8.3 Key Principles

- **No CSS Modules** — all styling via Tailwind utility classes or CSS custom properties.
- **No inline styles** — avoid `style={{}}`.
- **No CSS-in-JS** — no styled-components, Emotion, etc.
- **No tailwind.config** — Tailwind v4 is config-less; all configuration is inline via `@theme` and CSS.
- **Class merging via `cn()`** — always use `cn()` to combine classes safely; it deduplicates conflicting Tailwind utilities via `tailwind-merge`.

---

## 9. Utility Library

### `cn()` — Class Name Merger

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usage: `cn("base-class", condition && "conditional-class", classNameFromProps)`
This must be used in every component for className composition.

### Path Aliases

| Alias | Path |
|---|---|
| `@/components/*` | `./src/components/*` |
| `@/lib/*` | `./src/lib/*` |
| `@/hooks/*` | `./src/hooks/*` |

---

## 10. Icon System

- **Library**: Lucide React (`lucide-react` v1.14)
- **Usage**: `<IconName />` components (e.g., `<Search />`, `<ShoppingCart />`)
- **Sizing**: Icons auto-size to `size-4` (16px) inside buttons via `[&_svg:not([class*='size-'])]:size-4`, or `size-3`/`size-3.5` for smaller button variants.
- **Constraints**: Always apply `[&_svg]:pointer-events-none [&_svg]:shrink-0` on icon containers.

---

## 11. Animation & Motion

### 11.1 CSS Animations (tw-animate-css)
- Provides Tailwind animation utility classes.
- Accordion open/close keyframes from `shadcn/tailwind.css`.

### 11.2 JavaScript Motion (motion)
- The `motion` library (v12.38, formerly framer-motion) is available for declarative animations, layout transitions, and gesture-based interactions.
- Use for: page transitions, hover effects, scroll-triggered animations, entrance/exit animations.

---

## 12. Layout Patterns

### 12.1 Root Layout

```tsx
<html lang="en" className="h-full antialiased font-sans [font-variables]">
  <body className="min-h-full flex flex-col">
    {children}
  </body>
</html>
```

Key properties:
- Full-height layout (`h-full` on html, `min-h-full` on body).
- Body is a flex column — enables sticky footer patterns.
- Antialiased font rendering globally.
- Font CSS variables set on `<html>` for cascade to all children.

### 12.2 Page Layout

Pages should use `flex flex-col flex-1` for content area to fill remaining viewport height. Backgrounds on page wrappers, not `<body>`, to allow layout flexibility.

---

## 13. Accessibility Patterns

- All interactive components are built on Radix UI primitives (guaranteeing keyboard nav, ARIA attributes, focus management).
- `focus-visible:` used instead of `focus:` for focus indicators (shows only on keyboard focus, not mouse clicks).
- `sr-only` Tailwind utility for screen-reader-only content.
- Data attributes (`data-slot`, `data-variant`, `data-size`) for assistive technology and testing locators.
- `aria-invalid` support on form inputs and buttons.
- `aria-expanded` state support on collapsible triggers.
- Disabled states properly handled with `pointer-events-none` + `opacity-50`.

---

## 14. Theme Switching

Dark/light mode is toggled by adding/removing the `.dark` class on the `<html>` element. Implementation approach:

```
html.dark → all .dark { ... } overrides activate
```

Use a theme provider component that manages this class and persists preference to localStorage with a "system" / "light" / "dark" tri-state.

---

## 15. shadcn/ui Configuration

```json
{
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

New components are scaffolded via `npx shadcn@latest add <component-name>`.

---

## 16. Repository Structure for Components

```
src/
├── app/
│   ├── globals.css          # Design tokens, theming, base styles
│   ├── layout.tsx           # Root layout (fonts, metadata)
│   └── page.tsx             # Home page
├── components/
│   └── ui/                  # shadcn/ui components
│       └── button.tsx       # Button component (example pattern)
├── hooks/                   # Custom React hooks (empty, ready for use)
└── lib/
    └── utils.ts             # cn() utility
```

New components go in `src/components/ui/`. Feature-specific components go in `src/components/` in domain folders (e.g., `src/components/product/`).

---

## 17. Design Decisions & Constraints

1. **No hex/rgb/hsl** — all new color tokens must use OKLCH notation.
2. **No hardcoded colors** — always reference semantic CSS variables.
3. **No inline styles** — all styling through Tailwind utilities or CSS variables.
4. **Every component exports its variants** — enables composition (e.g., `<Link className={buttonVariants({ variant: "outline" })} />`).
5. **Component file = one component** — no barrel files, no multi-component files.
6. **All components are server-compatible** — no `use client` unless client interactivity is required.
7. **Icons from Lucide only** — do not introduce other icon libraries.
8. **Animations via tw-animate-css or motion** — no raw CSS keyframes unless for shadcn components.
