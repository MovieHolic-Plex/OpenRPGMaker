---
kind: frontend_style
name: CSS Layers + Scoped Runtime Styles (No CSS Framework)
category: frontend_style
scope:
    - '**'
source_files:
    - src/player/player.css
    - src/styles/tokens.css
    - src/styles/dialogue.css
    - vite.config.ts
    - package.json
---

RPG ZZU uses a minimal, framework-free CSS approach built on native CSS `@layer` cascade control and per-feature stylesheet imports. There is no Tailwind, Sass, Less, or CSS-in-JS library in the dependency graph — only Vite, Phaser, Vitest, Playwright, and TypeScript.

**System / approach**
- Plain `.css` files compiled by Vite’s default PostCSS pipeline.
- Global layer ordering declared once via `@layer tokens, base, runtime, overrides;` so design tokens always win over component rules.
- The player entry (`src/player/player.css`) imports a curated set of feature-scoped stylesheets under `src/styles/runtime/` (system, battle, commerce, title, playLoading, timer, touchpad, pictures, weather, transitions, nameEntry, keyboardNav) plus a shared `dialogue.css`. This keeps each game subsystem self-contained.
- A single `tokens.css` centralizes design tokens (colors, fonts, spacing) consumed via CSS custom properties (e.g. `--font-ui`, `color-scheme: dark`).

**Key files**
- `src/player/player.css` — root import orchestrator that sets `@layer` order, applies `color-scheme: dark`, and wires all runtime style modules.
- `src/styles/tokens.css` — global design-token definitions (variables for colors, typography, spacing).
- `src/styles/dialogue.css` — shared dialogue UI styling reused across editor and player.
- `src/styles/runtime/*.css` — feature-scoped sheets (battle, commerce, title, weather, etc.) imported from the player entry.
- `vite.config.ts` — standard Vite config with no CSS preprocessor plugins; builds target ES2022.
- `package.json` — zero CSS-framework dependencies; only `phaser` at runtime.

**Architecture & conventions**
- **Layer-first**: every new rule must declare its layer (`@layer runtime { ... }`) so it participates in the documented cascade order rather than relying on selector specificity.
- **Feature scoping**: one CSS file per game subsystem under `src/styles/runtime/`; the player entry is the single source of truth for which features are included in the shipped build.
- **Token-driven**: visual values live in `tokens.css` as CSS variables; components reference them instead of hardcoding hex values.
- **Dark-first**: `color-scheme: dark` is applied globally, so browser-native controls (scrollbars, selects) follow the theme automatically.
- **No utility class library**: layout and appearance are expressed with conventional CSS selectors, not atomic classes.

**Rules developers should follow**
1. Put reusable values in `src/styles/tokens.css` as CSS custom properties; never inline brand colors or font families.
2. Wrap new UI code in an appropriate `@layer` block (`runtime` for game screens, `overrides` only when intentionally breaking the cascade).
3. Keep feature-specific styles in `src/styles/runtime/<feature>.css` and add an `@import` in `src/player/player.css` to include it in the build.
4. Avoid adding CSS frameworks to `package.json`; if a need arises, introduce it through a dedicated layer and token bridge rather than mixing paradigms.
5. Prefer CSS variables for any value that might be themed later (palette, font size, spacing); keep selectors simple and scoped to the feature module.