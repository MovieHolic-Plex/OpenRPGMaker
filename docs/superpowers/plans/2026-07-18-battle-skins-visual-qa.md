# Battle Skins + Visual-QA Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 10-skin battle-skin system (Pokémon / RM2003 / RM2000 / Octopath / Chrono / Bravely / Dragon Quest / FF / Mother / Golden Sun) driven by a data registry + CSS, plus a screenshot visual-QA loop with an adversarial fable-5-high reviewer.

**Architecture:** Battle *logic* is untouched. A pure-data `BattleSkin` registry drives the existing DOM renderer via `root.dataset.battleSkin=<id>`; layout/color live in per-skin CSS scoped by `[data-battle-skin="<id>"]`. The existing `system.battleUiStyle` field is widened from `"classic"|"pokemon"` to the 10-id union with legacy remap. A Playwright spec screenshots each skin through fixed battle beats; an orchestrator loop feeds shots to a fable-5-high adversarial reviewer, then a fable-5-high builder patches CSS/DOM.

**Tech Stack:** TypeScript, Vite, Vitest (unit), Playwright (e2e), plain CSS `@layer runtime`. Assets via Codex CLI (PNG, `#00FF00` chroma key).

## Global Constraints

- Transparent color for all skin source assets is fixed to `#00FF00` (chroma key → alpha at import).
- Subagents: model `fable`, effort `high`, **at most 2 concurrent** (roles: adversarial-reviewer + builder). Never spawn a third.
- Assets are generated/edited via **Codex CLI** only; register into the generated-asset manifest so they appear in the DB Resources tab.
- Do **not** modify battle logic (`src/battle/runtime.ts`, `simulate.ts`, damage/state files) or balance.
- Back-compat: persisted `"classic"` → `rm2003`, `"pokemon"` → `pokemon`. Never break existing `qa-battle`/`battle-browser-repro` specs.
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch: `feat/battle-skins-visual-qa` (already created; design spec already committed).

## File Structure

Create:
- `src/battle/skins/types.ts` — `BattleSkinId`, `BattleSkin`, `BattleLayout`, `HudTemplate`.
- `src/battle/skins/registry.ts` — `BATTLE_SKINS`, `getBattleSkin`, `listBattleSkinIds`, `resolveSkinId`, `LEGACY_SKIN_LABELS`.
- `src/styles/runtime/battle-skins/index.css` — imports the 10 partials.
- `src/styles/runtime/battle-skins/_<id>.css` ×10 — per-skin scoped blocks.
- `test/battleSkinRegistry.test.ts` — registry + legacy unit tests.
- `test/e2e/battle-skins-visual-qa.spec.ts` — screenshot spec.
- `scripts/assets/chromaKey.mjs` — `#00FF00` → alpha PNG converter.
- `docs/assets/battle-skin-assets.md` — asset convention doc.

Modify:
- `src/project/types/database.ts` — widen `BattleUiStyle`.
- `src/project/databaseRecordModel.ts` — serialize new field values.
- `src/player/battleDom.ts` — set `data-battle-skin`.
- `src/player/battleFieldDom.ts` — `activeSkin()`/layout branch.
- `src/editor/panels/databaseSystemView.ts` — 10-option select from registry labels.
- `src/styles/index.css` — import `battle-skins/index.css`.

---

### Task 1: Skin registry (types + presets + legacy resolver)

**Files:**
- Create: `src/battle/skins/types.ts`
- Create: `src/battle/skins/registry.ts`
- Test: `test/battleSkinRegistry.test.ts`

**Interfaces:**
- Produces:
  - `type BattleSkinId = "pokemon"|"rm2003"|"rm2000"|"octopath"|"chrono"|"bravely"|"dragonquest"|"ff"|"mother"|"goldensun"`
  - `type BattleLayout = "sideview"|"frontview"|"active"|"firstperson"`
  - `type HudTemplate = "boxes"|"rows"|"ring"|"minimal"`
  - `interface BattleSkin { id: BattleSkinId; label: string; layout: BattleLayout; showAllySprites: boolean; hudTemplate: HudTemplate; transition: string; themeVars: Record<string,string>; defaultBackdropResourceId?: string }`
  - `const BATTLE_SKINS: Record<BattleSkinId, BattleSkin>`
  - `function getBattleSkin(id: BattleSkinId): BattleSkin`
  - `function listBattleSkinIds(): BattleSkinId[]`
  - `function resolveSkinId(legacy: string | undefined): BattleSkinId` — maps `undefined`/`"classic"`→`"rm2003"`, `"pokemon"`→`"pokemon"`, valid id→itself, unknown→`"rm2003"`.

- [ ] **Step 1: Write the failing test**

```ts
// test/battleSkinRegistry.test.ts
import { describe, expect, it } from "vitest";
import { BATTLE_SKINS, getBattleSkin, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";

describe("battle skin registry", () => {
  it("정확히 10개 스킨을 노출한다", () => {
    expect(listBattleSkinIds()).toHaveLength(10);
    expect(new Set(listBattleSkinIds()).size).toBe(10);
  });

  it("모든 스킨은 label·layout·themeVars를 갖는다", () => {
    for (const id of listBattleSkinIds()) {
      const skin = getBattleSkin(id);
      expect(skin.id).toBe(id);
      expect(skin.label.length).toBeGreaterThan(0);
      expect(["sideview", "frontview", "active", "firstperson"]).toContain(skin.layout);
      expect(Object.keys(skin.themeVars).length).toBeGreaterThan(0);
    }
  });

  it("legacy 값을 매핑한다(back-compat)", () => {
    expect(resolveSkinId(undefined)).toBe("rm2003");
    expect(resolveSkinId("classic")).toBe("rm2003");
    expect(resolveSkinId("pokemon")).toBe("pokemon");
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("bogus")).toBe("rm2003");
  });

  it("BATTLE_SKINS 키와 id가 일치한다", () => {
    for (const [key, skin] of Object.entries(BATTLE_SKINS)) expect(skin.id).toBe(key);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/battleSkinRegistry.test.ts`
Expected: FAIL — cannot resolve `@/battle/skins/registry`.

- [ ] **Step 3: Write `types.ts`**

```ts
// src/battle/skins/types.ts
export type BattleSkinId =
  | "pokemon" | "rm2003" | "rm2000" | "octopath" | "chrono"
  | "bravely" | "dragonquest" | "ff" | "mother" | "goldensun";

export type BattleLayout = "sideview" | "frontview" | "active" | "firstperson";
export type HudTemplate = "boxes" | "rows" | "ring" | "minimal";

/** 전투 스킨 = 순수 데이터 프리셋. 렌더러는 이 데이터만 읽고, 레이아웃·색은 CSS가 분기한다. */
export interface BattleSkin {
  readonly id: BattleSkinId;
  readonly label: string;
  readonly layout: BattleLayout;
  /** frontview 일부(드퀘 등)는 아군 스프라이트를 숨긴다. */
  readonly showAllySprites: boolean;
  readonly hudTemplate: HudTemplate;
  /** 인트로 연출 클래스 키(.battle-scene[data-battle-skin] 에서 사용). */
  readonly transition: string;
  /** --battle-* CSS 변수 오버라이드. */
  readonly themeVars: Record<string, string>;
  readonly defaultBackdropResourceId?: string;
}
```

- [ ] **Step 4: Write `registry.ts`**

```ts
// src/battle/skins/registry.ts
import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";

export const BATTLE_SKINS: Record<BattleSkinId, BattleSkin> = {
  pokemon: {
    id: "pokemon", label: "포켓몬", layout: "frontview", showAllySprites: true,
    hudTemplate: "boxes", transition: "flash-white",
    themeVars: { "--battle-window-bg": "#f8f8f8", "--battle-window-edge": "#4858a0", "--battle-text": "#282828", "--battle-accent": "#f04030" },
  },
  rm2003: {
    id: "rm2003", label: "RM2003", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#1742a5", "--battle-window-edge": "#315dc0", "--battle-text": "#f8fbff", "--battle-accent": "#ffd75a" },
  },
  rm2000: {
    id: "rm2000", label: "RM2000", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#101c48", "--battle-window-edge": "#2a52a0", "--battle-text": "#eef4ff", "--battle-accent": "#ffcf3a" },
  },
  octopath: {
    id: "octopath", label: "옥토패스", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur",
    themeVars: { "--battle-window-bg": "#0c1220", "--battle-window-edge": "#c9a24a", "--battle-text": "#f2e9d0", "--battle-accent": "#e0b24a" },
  },
  chrono: {
    id: "chrono", label: "크로노 트리거", layout: "active", showAllySprites: true,
    hudTemplate: "ring", transition: "sweep-cyan",
    themeVars: { "--battle-window-bg": "#0a1a3a", "--battle-window-edge": "#2fa8ff", "--battle-text": "#eaf6ff", "--battle-accent": "#ffd24a" },
  },
  bravely: {
    id: "bravely", label: "브레이블리", layout: "sideview", showAllySprites: true,
    hudTemplate: "minimal", transition: "focus-blur",
    themeVars: { "--battle-window-bg": "#141018", "--battle-window-edge": "#b89a6a", "--battle-text": "#f6efe2", "--battle-accent": "#d8a24a" },
  },
  dragonquest: {
    id: "dragonquest", label: "드퀘", layout: "firstperson", showAllySprites: false,
    hudTemplate: "rows", transition: "flash-white",
    themeVars: { "--battle-window-bg": "#000814", "--battle-window-edge": "#f8f8f8", "--battle-text": "#f8f8f8", "--battle-accent": "#f8d030" },
  },
  ff: {
    id: "ff", label: "FF 정통", layout: "sideview", showAllySprites: true,
    hudTemplate: "rows", transition: "wipe-blue",
    themeVars: { "--battle-window-bg": "#101838", "--battle-window-edge": "#5878c8", "--battle-text": "#f4f8ff", "--battle-accent": "#48c0f0" },
  },
  mother: {
    id: "mother", label: "마더/언더", layout: "frontview", showAllySprites: false,
    hudTemplate: "rows", transition: "psychedelic",
    themeVars: { "--battle-window-bg": "#101010", "--battle-window-edge": "#f8f8f8", "--battle-text": "#f8f8f8", "--battle-accent": "#ff4fd8" },
  },
  goldensun: {
    id: "goldensun", label: "골든선", layout: "sideview", showAllySprites: true,
    hudTemplate: "boxes", transition: "sweep-cyan",
    themeVars: { "--battle-window-bg": "#0e1830", "--battle-window-edge": "#e0a030", "--battle-text": "#f4ecd8", "--battle-accent": "#ffcf3a" },
  },
};

const VALID_IDS = new Set(Object.keys(BATTLE_SKINS) as BattleSkinId[]);

export function getBattleSkin(id: BattleSkinId): BattleSkin {
  return BATTLE_SKINS[id];
}

export function listBattleSkinIds(): BattleSkinId[] {
  return Object.keys(BATTLE_SKINS) as BattleSkinId[];
}

/** legacy(`classic`/`pokemon`/undefined) 및 임의 문자열을 유효 스킨 id로 정규화한다. */
export function resolveSkinId(legacy: string | undefined): BattleSkinId {
  if (legacy === "pokemon") return "pokemon";
  if (!legacy || legacy === "classic") return "rm2003";
  return VALID_IDS.has(legacy as BattleSkinId) ? (legacy as BattleSkinId) : "rm2003";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/battleSkinRegistry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/battle/skins/types.ts src/battle/skins/registry.ts test/battleSkinRegistry.test.ts
git commit -m "feat(battle): 10-skin battle-skin registry + legacy resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Widen `battleUiStyle` type + serialization

**Files:**
- Modify: `src/project/types/database.ts:120` and `:656`
- Modify: `src/project/databaseRecordModel.ts:79`
- Test: `test/battleSkinRegistry.test.ts` (extend)

**Interfaces:**
- Consumes: `BattleSkinId`, `resolveSkinId` from Task 1.
- Produces: `system.battleUiStyle?: BattleSkinId` persisted verbatim for any non-default id; default `rm2003` (and legacy `classic`) persisted as omitted.

- [ ] **Step 1: Add serialization test**

Append to `test/battleSkinRegistry.test.ts`:

```ts
import { createBlankProject } from "@/project/defaults";
import { serializeDatabase } from "@/project/databaseRecordModel";

describe("battleUiStyle serialization", () => {
  it("비-기본 스킨 id는 그대로 보존한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "octopath";
    const out = serializeDatabase(project) as { system: { battleUiStyle?: string } };
    expect(out.system.battleUiStyle).toBe("octopath");
  });

  it("기본(rm2003) 및 미설정은 생략한다", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "rm2003";
    const out = serializeDatabase(project) as { system: { battleUiStyle?: string } };
    expect(out.system.battleUiStyle).toBeUndefined();
  });
});
```

> Before writing, confirm the exact exported serializer name and signature:
> Run `grep -nE "export function .*[Ss]erialize.*[Dd]atabase|export function .*[Ss]ystem" src/project/databaseRecordModel.ts`
> If the system serializer is not `serializeDatabase(project)`, adjust the import and call in the test to the real exported function (e.g. a `serializeSystem(system)` helper), keeping the two assertions identical in intent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/battleSkinRegistry.test.ts`
Expected: FAIL — `octopath` not assignable to `BattleUiStyle` (tsc) / value dropped at runtime.

- [ ] **Step 3: Widen the type** — `src/project/types/database.ts`

Replace line 120:
```ts
export type BattleUiStyle =
  | "pokemon" | "rm2003" | "rm2000" | "octopath" | "chrono"
  | "bravely" | "dragonquest" | "ff" | "mother" | "goldensun"
  | "classic"; // legacy alias, remapped by resolveSkinId → rm2003
```

- [ ] **Step 4: Persist any non-default id** — `src/project/databaseRecordModel.ts:79`

Replace the single spread line:
```ts
    // 기본(rm2003/classic)은 저장하지 않고, 그 외 스킨 선택만 보존한다.
    ...(system.battleUiStyle && system.battleUiStyle !== "classic" && system.battleUiStyle !== "rm2003"
      ? { battleUiStyle: system.battleUiStyle }
      : {}),
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/battleSkinRegistry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "database.ts|databaseRecordModel" || echo "no new type errors in touched files"`
Expected: `no new type errors in touched files`.

- [ ] **Step 7: Commit**

```bash
git add src/project/types/database.ts src/project/databaseRecordModel.ts test/battleSkinRegistry.test.ts
git commit -m "feat(battle): widen battleUiStyle to 10-skin union + serialize

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Renderer wiring — `data-battle-skin` + layout branch

**Files:**
- Modify: `src/player/battleDom.ts:57`
- Modify: `src/player/battleFieldDom.ts:14-16` (add `activeSkin`), `:201`, `:283`
- Test: `test/e2e/battle-skins-visual-qa.spec.ts` covers this at runtime (Task 7); no unit test here (DOM-in-browser). Add a lightweight jsdom check instead.

**Interfaces:**
- Consumes: `resolveSkinId`, `getBattleSkin` from Task 1.
- Produces: `.battle-scene[data-battle-skin="<id>"]` on the battle root; `body`-level nothing. `battleFieldDom` exports unchanged; internal `activeSkin()` helper.

- [ ] **Step 1: Set `data-battle-skin` in `battleDom.ts`**

Replace line 57 (keep the legacy `battleUiStyle` dataset for back-compat, add skin):
```ts
  root.dataset.battleUiStyle = store.getCurrent().system.battleUiStyle === "pokemon" ? "pokemon" : "classic";
  root.dataset.battleSkin = resolveSkinId(store.getCurrent().system.battleUiStyle);
```
Add import at top of `battleDom.ts`:
```ts
import { resolveSkinId } from "@/battle/skins/registry";
```

- [ ] **Step 2: Add `activeSkin()` + layout use in `battleFieldDom.ts`**

Replace the `pokemonUiActive` helper (lines 14-16):
```ts
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkin } from "@/battle/skins/types";

function activeSkin(): BattleSkin {
  return getBattleSkin(resolveSkinId(store.getCurrent().system.battleUiStyle));
}
function pokemonUiActive(): boolean {
  return activeSkin().id === "pokemon";
}
```
Keep the two existing `pokemonUiActive()` call sites (`:201`, `:283`) working unchanged. In `actorSpriteGroup` (line 261), gate ally sprites on the skin:
```ts
function actorSpriteGroup(actors: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-actor-sprites";
  group.dataset.testid = "battle-actor-sprites";
  if (!activeSkin().showAllySprites) { group.dataset.hidden = "true"; return group; }
  // ...existing body unchanged...
}
```
> Read lines 261-269 first; insert the `showAllySprites` guard immediately after the group element is created and before actor nodes are appended. Do not remove existing logic.

- [ ] **Step 3: jsdom smoke test**

Add to `test/battleSkinRegistry.test.ts`:
```ts
import { resolveSkinId as _resolve } from "@/battle/skins/registry";
describe("skin dataset wiring", () => {
  it("resolveSkinId는 dataset에 넣기 안전한 문자열만 반환한다", () => {
    for (const v of [undefined, "classic", "pokemon", "mother", "zzz"]) {
      expect(_resolve(v)).toMatch(/^[a-z]+$/);
    }
  });
});
```

- [ ] **Step 4: Run unit + typecheck**

Run: `npx vitest run test/battleSkinRegistry.test.ts && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "battleDom|battleFieldDom" || echo "clean"`
Expected: PASS; `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/player/battleDom.ts src/player/battleFieldDom.ts test/battleSkinRegistry.test.ts
git commit -m "feat(battle): drive renderer from data-battle-skin + layout branch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Skin CSS scaffolding (10 partials + registration)

**Files:**
- Create: `src/styles/runtime/battle-skins/index.css`
- Create: `src/styles/runtime/battle-skins/_<id>.css` ×10
- Modify: `src/styles/index.css:22` (import after `battle.css`)

**Interfaces:**
- Consumes: `data-battle-skin` from Task 3.
- Produces: each partial defines `.battle-scene[data-battle-skin="<id>"]` overriding `--battle-window-*`/`--battle-text`/`--battle-accent` and layout hooks.

- [ ] **Step 1: Create `index.css`**

```css
/* src/styles/runtime/battle-skins/index.css */
@import "./_pokemon.css";
@import "./_rm2003.css";
@import "./_rm2000.css";
@import "./_octopath.css";
@import "./_chrono.css";
@import "./_bravely.css";
@import "./_dragonquest.css";
@import "./_ff.css";
@import "./_mother.css";
@import "./_goldensun.css";
```

- [ ] **Step 2: Create each `_<id>.css` starter block**

For each of the 10 ids, create the file with this shape (values from the registry's `themeVars`; the layout rule differs by `layout`). Example `_pokemon.css`:
```css
/* src/styles/runtime/battle-skins/_pokemon.css */
@layer runtime {
  .battle-scene[data-battle-skin="pokemon"] {
    --rm2k3-battle-window-light: #f8f8f8;
    --rm2k3-battle-text: #282828;
    background: #98d0d8;
  }
  .battle-scene[data-battle-skin="pokemon"] .battle-actor-sprites { justify-content: flex-start; }
  .battle-scene[data-battle-skin="pokemon"] .battle-enemy-group { justify-content: flex-end; align-items: flex-start; }
  .battle-scene[data-battle-skin="pokemon"] .battle-party-status { border: 2px solid #4858a0; border-radius: 8px; background: #f8f8f8; color: #282828; }
}
```
Create the other 9 with their own `themeVars` and one layout intent each:
- `_rm2003.css`: sideview, blue windows (inherit existing base look; minimal override).
- `_rm2000.css`: frontview, ally sprites hidden (`.battle-actor-sprites[data-hidden] { display:none }`), enemies centered.
- `_octopath.css`: sideview, dark HD-2D vignette (`box-shadow: inset 0 0 120px #000`), gold accents.
- `_chrono.css`: active, command ring hint (`.battle-command-panel { border-radius: 999px }`), cyan edge.
- `_bravely.css`: sideview, thin frame HUD (`border-width:1px`), warm parchment.
- `_dragonquest.css`: firstperson — `.battle-actor-sprites{display:none}`, single enemy centered, black bg, white window borders, command window pinned bottom.
- `_ff.css`: sideview, allies right column (`.battle-actor-sprites{justify-content:flex-end}`), blue window.
- `_mother.css`: frontview, allies hidden, animated psychedelic bg (`@keyframes mother-swirl` + `background: conic-gradient(...)`).
- `_goldensun.css`: sideview low-angle (`transform: perspective(600px) rotateX(6deg)` on `.battle-field`), amber accents.

> Each file must set `background` on `.battle-scene[data-battle-skin="<id>"]` and at least one layout hook. No empty rules. These are *starter* values; Task 8 refines them.

- [ ] **Step 3: Register in `src/styles/index.css`**

After line 22 (`@import "./runtime/battle.css";`) add:
```css
@import "./runtime/battle-skins/index.css";
```

- [ ] **Step 4: Verify build picks up CSS**

Run: `npx vite build --configLoader runner 2>&1 | tail -5`
Expected: build succeeds; no unresolved `@import` errors for `battle-skins`.

- [ ] **Step 5: Commit**

```bash
git add src/styles/runtime/battle-skins/ src/styles/index.css
git commit -m "feat(battle): per-skin CSS scaffolding (10 partials)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Editor system view — 10-skin select

**Files:**
- Modify: `src/editor/panels/databaseSystemView.ts:30`, `:118-129`

**Interfaces:**
- Consumes: `BATTLE_SKINS`, `listBattleSkinIds` from Task 1.
- Produces: the System tab's "전투 UI 스타일" select lists all 10 skins by Korean label; selection sets `draft.system.battleUiStyle = id`.

- [ ] **Step 1: Replace the options constant** — line 30

```ts
import { BATTLE_SKINS, listBattleSkinIds } from "@/battle/skins/registry";
const BATTLE_UI_STYLE_OPTIONS = listBattleSkinIds();
```
(Remove the old `["classic","pokemon"] as const satisfies ...` line and its now-unused `BattleUiStyle` type import if unused elsewhere in the file — verify with grep before deleting the import.)

- [ ] **Step 2: Replace the select builder** — lines 118-129

Because the shared `literalLabel` switch has no skin labels, build the select from registry labels via `selectTextLiteral` is not id-preserving; instead use `selectLiteral` but pass a label lookup. Simplest: inline a `<select>` with registry labels.

```ts
      field("전투 UI 스타일", (() => {
        const select = el("select", { dataset: { testid: "db-field-system-battle-ui-style" } });
        for (const id of BATTLE_UI_STYLE_OPTIONS) {
          select.append(el("option", { text: BATTLE_SKINS[id].label, attrs: { value: id } }));
        }
        select.value = resolveSkinId(project.system.battleUiStyle);
        select.addEventListener("change", () => {
          updateSystem((draft) => { draft.system.battleUiStyle = select.value as typeof BATTLE_UI_STYLE_OPTIONS[number]; });
        });
        return select;
      })()),
```
Add imports: `import { el } from "..."` (reuse the existing `el`/`field` imports already in the file — verify their import path via grep; `field` and `el` come from `databaseControls`), and `import { resolveSkinId } from "@/battle/skins/registry";`.

> Verify `el` and `field` are already imported in this file (`grep -nE "\b(el|field)\b" src/editor/panels/databaseSystemView.ts | head`). If `field` takes `(label, node)` as elsewhere, match that arity.

- [ ] **Step 3: Typecheck + existing system test**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep databaseSystemView || echo clean`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/editor/panels/databaseSystemView.ts
git commit -m "feat(editor): 10-skin battle UI style select

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Chroma-key util + asset convention doc

**Files:**
- Create: `scripts/assets/chromaKey.mjs`
- Create: `docs/assets/battle-skin-assets.md`
- Test: `test/chromaKey.test.ts`

**Interfaces:**
- Produces: `chromaKeyToAlpha(rgba: Uint8ClampedArray, key = [0,255,0], tol = 24): Uint8ClampedArray` — sets alpha 0 where pixel ≈ `#00FF00` within `tol`. Exported from `scripts/assets/chromaKey.mjs`.

- [ ] **Step 1: Write the failing test**

```ts
// test/chromaKey.test.ts
import { describe, expect, it } from "vitest";
import { chromaKeyToAlpha } from "../scripts/assets/chromaKey.mjs";

describe("chromaKeyToAlpha", () => {
  it("#00FF00 픽셀을 투명(alpha=0)으로 만든다", () => {
    const px = new Uint8ClampedArray([0, 255, 0, 255,  10, 20, 30, 255]);
    const out = chromaKeyToAlpha(px);
    expect(out[3]).toBe(0);    // green → transparent
    expect(out[7]).toBe(255);  // other → opaque
  });
  it("허용오차 안의 근접 초록도 제거한다", () => {
    const px = new Uint8ClampedArray([8, 250, 6, 255]);
    expect(chromaKeyToAlpha(px, [0, 255, 0], 24)[3]).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run test/chromaKey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `chromaKey.mjs`**

```js
// scripts/assets/chromaKey.mjs
/** RGBA 버퍼에서 #00FF00(±tol) 픽셀의 alpha를 0으로 만든다. 새 버퍼 반환. */
export function chromaKeyToAlpha(rgba, key = [0, 255, 0], tol = 24) {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const dr = out[i] - key[0], dg = out[i + 1] - key[1], db = out[i + 2] - key[2];
    if (dr * dr + dg * dg + db * db <= tol * tol * 3) out[i + 3] = 0;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run test/chromaKey.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the convention doc**

```markdown
<!-- docs/assets/battle-skin-assets.md -->
# 전투 스킨 에셋 규약

- 투명 영역은 **#00FF00 (순수 초록)** 로 칠한다. 다른 투명 표현 금지.
- 임포트 시 `scripts/assets/chromaKey.mjs` 의 `chromaKeyToAlpha` 로 알파 변환.
- 배틀러: 스킨 레이아웃에 맞춘 방향(sideview=측면, frontview=정면/후면, firstperson=적만).
- 배경(backdrop): 스킨별 1장 이상, 16:9 또는 4:3.
- 생성/편집은 **Codex CLI** 로만. 결과는 generated-asset manifest 에 등록 → DB Resources 탭에서 확인.
- 파일명: `battle-skin-<id>-<enemy|ally|backdrop>-NN.png`.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/assets/chromaKey.mjs docs/assets/battle-skin-assets.md test/chromaKey.test.ts
git commit -m "feat(assets): #00FF00 chroma-key util + battle-skin asset convention

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Visual-QA screenshot spec

**Files:**
- Create: `test/e2e/battle-skins-visual-qa.spec.ts`

**Interfaces:**
- Consumes: `seedReferenceBattleProject`, `startReferenceBattle`, `waitForActorCommand`, `performBattleAttack`, `performBattleSkill` from `./battleReferenceProject`; `listBattleSkinIds` from Task 1.
- Produces: screenshots under `output/evidence/battle-skins/<skin>/<beat>.png` + `diag.json` per skin.

- [ ] **Step 1: Write the spec**

```ts
// test/e2e/battle-skins-visual-qa.spec.ts
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { listBattleSkinIds } from "@/battle/skins/registry";
import {
  seedReferenceBattleProject, startReferenceBattle,
  waitForActorCommand, performBattleAttack,
} from "./battleReferenceProject";

const OUT = "output/evidence/battle-skins";

async function setSkin(page: Page, skin: string): Promise<void> {
  await page.addInitScript((s) => {
    window.localStorage.setItem("rpg-zzu:battle-skin-override", s);
  }, skin);
}

async function diag(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
    if (!scene) return { present: false };
    const overflowX = scene.scrollWidth - scene.clientWidth;
    const overflowY = scene.scrollHeight - scene.clientHeight;
    return {
      present: true,
      skin: scene.dataset.battleSkin ?? null,
      overflowX, overflowY,
      clipped: overflowX > 2 || overflowY > 2,
      enemies: document.querySelectorAll(".battle-enemy").length,
    };
  });
}

for (const skin of listBattleSkinIds()) {
  test(`battle skin visual QA — ${skin}`, async ({ page }) => {
    test.setTimeout(120_000);
    const dir = `${OUT}/${skin}`;
    await mkdir(dir, { recursive: true });
    await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
    await setSkin(page, skin);
    await page.goto("/?freshProject=1");
    await seedReferenceBattleProject(page);
    // apply skin to seeded project before battle starts
    await page.evaluate((s) => {
      const store = (window as unknown as { __rpgStore?: { getCurrent(): { system: Record<string, unknown> }; commit(fn: (d: { system: Record<string, unknown> }) => void): void } }).__rpgStore;
      store?.commit((d) => { d.system.battleUiStyle = s; });
    }, skin);
    await startReferenceBattle(page);

    const scene = page.getByTestId("battle-scene");
    await expect(scene).toHaveAttribute("data-battle-skin", skin);
    await page.screenshot({ path: `${dir}/01-intro.png`, fullPage: true });

    await waitForActorCommand(page);
    await page.screenshot({ path: `${dir}/02-command.png`, fullPage: true });

    await performBattleAttack(page);
    await page.screenshot({ path: `${dir}/04-attack-impact.png`, fullPage: true });

    const d = await diag(page);
    await writeFile(`${dir}/diag.json`, JSON.stringify(d, null, 2), "utf8");
    expect(d.present, `${skin}: battle-scene missing`).toBe(true);
    expect(d.clipped, `${skin}: content clipped (${d.overflowX}x${d.overflowY})`).toBe(false);
  });
}
```

> **Store hook check:** confirm the browser-global store accessor name. Run `grep -rnE "window\.[A-Za-z_]*[Ss]tore|__rpgStore|exposeStore|globalThis\.store" src/ | head`. If the global is not `window.__rpgStore`, either (a) use the exposed name, or (b) drive the skin via the DB System-tab select (`db-field-system-battle-ui-style`) before `mode-play`, which is the more robust path. Prefer (b) if no global store is exposed:
> ```ts
> await page.getByTestId("db-field-system-battle-ui-style").selectOption(skin);
> ```
> (Open the database first per `qa-battle.spec.ts`'s `openDatabase(page)` helper.)

- [ ] **Step 2: Run for a single skin to validate wiring**

Run: `npx playwright test battle-skins-visual-qa --grep "rm2003" --reporter=line`
Expected: PASS; `output/evidence/battle-skins/rm2003/01-intro.png` exists.

- [ ] **Step 3: Run all skins**

Run: `npx playwright test battle-skins-visual-qa --reporter=line`
Expected: 10 tests. Any `clipped` failure is a real QA finding for Task 8 (not a spec bug) — note which skins fail.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/battle-skins-visual-qa.spec.ts
git commit -m "test(battle): visual-QA screenshot spec across 10 skins

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Adversarial QA polish loop (per-skin CSS refinement)

**Files:**
- Modify: `src/styles/runtime/battle-skins/_<id>.css` (all 10, iteratively)
- Create: `output/evidence/battle-skins/review-round-*.json` (loop artifacts, git-ignored if `output/` is ignored; otherwise commit summaries only)

**Interfaces:**
- Consumes: screenshots from Task 7.
- Produces: refined CSS so every skin passes the reviewer's readability/fidelity/fun/clipping gate.

This task is the **workflow itself**. Run it as a bounded loop (`N = 3` rounds max), orchestrated by the parent session using the Agent tool. **Exactly two subagent roles, model `fable`, effort `high`, ≤2 concurrent.**

- [ ] **Step 1: Capture baseline** — run Task 7 spec, ensure all 10 shot-sets exist.

- [ ] **Step 2: Adversarial review (subagent A — `fable`, `high`)**

Dispatch one reviewer subagent per round with the screenshot paths. Prompt contract:
> "You are an ADVERSARIAL battle-UI reviewer. Default verdict is FAIL; only pass a skin with explicit evidence. For each of the 10 skins, inspect `output/evidence/battle-skins/<skin>/*.png` and score 4 axes 0–5: **readability** (text/HP legible, contrast), **fidelity** (matches the named style: pokemon/rm2003/…), **fun** (game-feel, does it read as a real battle), **layout** (no clipping/overlap). Return strict JSON: `{ skin: {readability,fidelity,fun,layout, pass:boolean, defects:[{axis,fix}]} }`. A skin passes only if every axis ≥3 and no clipping."

Save its JSON to `output/evidence/battle-skins/review-round-<n>.json`.

- [ ] **Step 3: Build fixes (subagent B — `fable`, `high`)**

If any skin failed, dispatch one builder subagent with the defect list. Prompt contract:
> "Apply CSS-only fixes to `src/styles/runtime/battle-skins/_<id>.css` for the listed defects. Scope every rule under `.battle-scene[data-battle-skin=\"<id>\"]`. Do not touch battle logic or shared `battle.css`. Do not change DOM structure. Return the list of files changed."

Reviewer (A) and builder (B) may run concurrently across independent skins, but never more than 2 subagents at once.

- [ ] **Step 4: Re-run spec + repeat**

Run: `npx playwright test battle-skins-visual-qa --reporter=line`
Loop steps 2–4 until all skins pass or `N=3` rounds reached. Log the final review JSON.

- [ ] **Step 5: Commit each round's CSS**

```bash
git add src/styles/runtime/battle-skins/ output/evidence/battle-skins/review-round-*.json
git commit -m "polish(battle): QA round <n> — skin CSS refinements

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
> If `output/` is git-ignored, drop it from the `git add` and instead paste the round summary into the commit body.

---

### Task 9: Codex-generated skin assets + DB registration

**Files:**
- Create (via Codex CLI): `public/assets/battle-skins/battle-skin-<id>-*.png` (or the repo's generated-asset dir — verify).
- Modify: generated-asset manifest so `resolveAssetResourceUrl` finds them (verify exact manifest path).

**Interfaces:**
- Consumes: `chromaKeyToAlpha` (Task 6), `defaultBackdropResourceId` slot on `BattleSkin` (Task 1).
- Produces: per-skin battler/backdrop resources resolvable by id and visible in the DB Resources tab.

- [ ] **Step 1: Locate the generated-asset manifest + public asset dir**

Run:
```bash
grep -rnE "GeneratedAssetManifest|builtinGeneratedResourceIds|generated-actor-hero" src/assets src/project | head
ls public/assets 2>/dev/null | head
```
Record the manifest module and the resource-id naming scheme (mirrors `generated-actor-hero-01-battle` seen in `battleReferenceProject.ts`).

- [ ] **Step 2: Generate assets via Codex CLI**

For each skin, delegate to Codex CLI to author battler + backdrop PNGs with `#00FF00` transparent background, per `docs/assets/battle-skin-assets.md`. (Codex is the only asset authoring path.) Save under the located public asset dir with names `battle-skin-<id>-backdrop-01.png`, etc.

- [ ] **Step 3: Chroma-key → alpha at import**

Run a one-shot node script that reads each PNG, applies `chromaKeyToAlpha`, and writes the alpha version in place. (Use the repo's existing PNG tooling if present — check `scripts/` for an existing decoder before adding a `pngjs` dependency; if none, add a minimal decode step in `scripts/assets/`.)

- [ ] **Step 4: Register in manifest + set `defaultBackdropResourceId`**

Add each backdrop resource id to the manifest and set `defaultBackdropResourceId` on the matching skin in `registry.ts`.

- [ ] **Step 5: Verify DB visibility (Playwright)**

Add a check to the visual-QA spec (or a small new spec) that opens DB → Resources and asserts at least one `battle-skin-*` resource is listed. Run it.

Run: `npx playwright test --grep "battle-skin.*resource" --reporter=line`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/assets/battle-skins/ src/battle/skins/registry.ts <manifest-file>
git commit -m "feat(assets): Codex-generated skin battlers/backdrops, DB-registered

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full verification + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full unit + typecheck**

Run: `npx vitest run test/battleSkinRegistry.test.ts test/chromaKey.test.ts && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -vE "defaultProject.ts:135|largeRiverMarketVillageBuild" | grep error || echo "no new type errors"`
Expected: unit PASS; `no new type errors` (the 3 pre-existing main-branch tsc errors are excluded).

- [ ] **Step 2: Full visual-QA spec**

Run: `npx playwright test battle-skins-visual-qa --reporter=line`
Expected: 10/10 pass.

- [ ] **Step 3: Regression — existing battle specs**

Run: `npx playwright test qa-battle battle-browser-repro --reporter=line`
Expected: PASS (no regression from renderer wiring).

- [ ] **Step 4: Build**

Run: `npx vite build --configLoader runner && npm run build:player`
Expected: succeeds.

- [ ] **Step 5: Open PR**

```bash
git push -u origin feat/battle-skins-visual-qa
gh pr create --base main --title "feat(battle): 10 battle skins + visual-QA workflow" --body "$(cat <<'EOF'
## 요약
- 10종 전투 스킨(pokemon/rm2003/rm2000/octopath/chrono/bravely/dragonquest/ff/mother/goldensun) — 데이터 레지스트리 + CSS 구동.
- `system.battleUiStyle` 유니온 확장(legacy classic→rm2003, pokemon 유지).
- 스크린샷 visual-QA 스펙 + 적대적 fable-5-high 리뷰어 루프.
- #00FF00 크로마키 에셋 파이프라인, DB Resources 탭 노출.

## 검증
- 유닛: battleSkinRegistry, chromaKey.
- e2e: battle-skins-visual-qa 10/10, qa-battle·battle-browser-repro 회귀 통과.
- 빌드 통과.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:** 요구사항 1(Task 7)·2(Task 8)·3(Task 1-5)·4·5(Task 8)·6(Task 8 readability 축)·7(Task 9)·8(Task 6)·9(Task 9)·10(Task 8 fun 축)·11(Task 10 PR) 전부 매핑됨.

**Placeholder scan:** infra 태스크(1-7,9-10)는 실제 코드/명령 포함. Task 8·9는 본질적으로 반복·외부도구(Codex) 의존이라 절차를 구체 계약(프롬프트·JSON 스키마·경로)으로 명시. 남은 검증 지점(store 글로벌명·serializer명·manifest 경로)은 각 태스크에 grep 확인 스텝으로 못박음.

**Type consistency:** `BattleSkinId`/`resolveSkinId`/`getBattleSkin`/`listBattleSkinIds`/`BATTLE_SKINS` 이름이 Task 1 정의와 2·3·5·7에서 일관. `battleUiStyle` 필드명 유지.
