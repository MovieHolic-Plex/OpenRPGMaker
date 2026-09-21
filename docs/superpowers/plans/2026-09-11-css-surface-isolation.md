# CSS 표면 격리 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에디터·DB 스타일을 표면(surface)별 디렉토리·진입 시트·`@layer` 로 격리하고, 세대 덮어쓰기를 접고, 재발을 게이트로 막는다. 시각 결과는 바뀌지 않는다.

**Architecture:** `index.css` 첫 줄의 `@layer` 순서 선언 하나가 승자를 정한다. 표면마다 진입 시트 하나가 `@import "x.css" layer(<surface>)` 로 리프 시트를 자기 레이어에 넣고, 지연 로드 표면(`event`, `database`)은 마운트하는 TS 가 진입 시트를 import 한다. 새 게이트 `scripts/check-css-surfaces.mjs` 가 R1–R6(언레이어·표면 밖 선택자·`!important` 래칫·미정의 변수·CSS→TS 죽은 선택자·순서 주석)을 한 패스로 검사한다. 모든 단계는 픽셀 기준선 + 기존 계산 스타일 기준선이 동일함으로 닫는다.

**Tech Stack:** Vite 6.4.3(`@import … layer()` 인라인 확인됨), postcss(`node_modules/postcss`), vitest(node 환경, `test/**/*.test.ts`), Playwright(`toHaveScreenshot`), Node 24.

**Spec:** `docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md`

## Global Constraints

- 시각 결과 불변. 기준선 갱신은 §3.5 의 예외 4건(마을 정보 모달 크기, 명령 피커 푸터 배경, `--editor-row-hover`, `--editor-surface`·`--surface-1`)만, 별도 커밋에서.
- 리프 시트 내용은 1단계까지 불변. 2단계부터만 편집.
- 레이어 순서: `@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;` 이 선언은 `src/styles/index.css` 첫 줄에만 존재.
- 허브 깊이 1: 진입 시트(`src/styles/<surface>/index.css`)만 `@import` 할 수 있다.
- `!important` 는 `overrides` 레이어 밖에서 늘 수 없다(래칫).
- 커밋 메시지는 리포 관행 `type(scope): 한국어 서술형` (예: `feat(css): 표면 진입 시트와 레이어 선언을 만든다`).
- 브랜치는 `css/<phase>-<slug>`, 병합은 `gh pr create` 로만. 워크트리에서 작업하면 `node_modules` 심링크와 `.env.local` 이 필요하다.
- 게이트 실행: `node scripts/verify-gates.mjs --only css` (수 초). 전체 vitest 는 OOM 이 나므로 파일 단위로 돌린다.

---

## 파일 구조

**새 스크립트 (`scripts/`)**
- `css-flatten.mjs` — 진입 시트에서 @import 를 재귀 평탄화하고 postcss 로 선언 인덱스(`{seq,file,line,sel,layer,at,prop,value,imp}`)를 만든다. 다른 스크립트가 import 하는 라이브러리이자 CLI.
- `css-surfaces.json` — 표면 레지스트리: 표면 → 디렉토리, 진입 시트, 허용 클래스 접두어, 루트 선택자.
- `check-css-surfaces.mjs` — R1–R6 검사. `--baseline` 으로 `scripts/css-surfaces.baseline.json` 저장, `--enforce <surface>` 로 표면별 실패 승격.
- `css-prune-shadowed.mjs` — 같은 (선택자, 속성, 조건)의 뒤 선언에 완전히 가려지는 앞 선언을 지운다. `--surface <name> --write`.
- `css-drop-dead.mjs` — R5 판정 죽은 규칙을 지운다. `--surface <name> --write`.

**새 테스트**
- `test/cssFlatten.test.ts`, `test/checkCssSurfaces.test.ts`, `test/cssPruneShadowed.test.ts` — 픽스처 디렉토리 `test/fixtures/css-surfaces/` 에 작은 CSS 를 두고 스크립트 함수를 직접 호출.
- `test/e2e/css-surface-shots.spec.ts` + `playwright.css-shots.config.ts` — 픽셀 기준선. 스냅샷은 `test/e2e/css-surface-shots.spec.ts-snapshots/`.

**스타일 트리 (완료 후)**
```
src/styles/
  index.css              @layer 선언 + tokens/base/components/shell/map/resources/runtime/overrides 진입 import
  tokens.css
  overrides.css          표면 경계 예외. 항목마다 이유·만기
  base/index.css         (index.css 하단 블록 이동)
  components/index.css
  shell/index.css        shell/*.css, shell/dialogs/*.css
  map/index.css          map/*.css (editor/ 의 맵 편집 시트 이동)
  event/index.css        event/*.css, event/subdialogs/, event/command-forms/, event/previews/
  database/index.css     database/**/*.css
  resources/index.css
  runtime/index.css      runtime/**/*.css + dialogue.css (내용 불변)
```
`src/styles/editor/` 는 3단계 끝에 삭제된다.

**TS 변경**
- `src/main.ts:9` 는 그대로 `./styles/index.css`.
- `src/editor/panels/eventEditor/modal.ts` 상단에 `import "@/styles/event/index.css";`
- `src/editor/panels/databaseModal.ts` 상단에 `import "@/styles/database/index.css";` (기존 패널별 `import "@/styles/database/modern/*.css"` 15곳은 진입 시트로 흡수 후 제거)

---

## 0단계 — 잠금

### Task 1: `css-flatten.mjs` 선언 인덱스

**Files:**
- Create: `scripts/css-flatten.mjs`
- Create: `test/fixtures/css-surfaces/flat/entry.css`, `test/fixtures/css-surfaces/flat/a.css`, `test/fixtures/css-surfaces/flat/b.css`
- Test: `test/cssFlatten.test.ts`

**Interfaces:**
- Produces: `flattenImports(entryAbs: string): Array<{file: string, depth: number, layer: string|null, copy: number}>` — 유효 로드 순서. `layer` 는 `@import … layer(x)` 의 x.
- Produces: `indexDeclarations(order, rootAbs): Decl[]` with `Decl = {seq, file, line, sel, layer, at, prop, value, imp}`; `file` 은 `rootAbs` 기준 상대경로, `layer` 는 import 레이어 또는 파일 안 `@layer` 블록 이름, `at` 은 감싸는 `@media …`/`@supports …` 문자열(없으면 `""`).
- Produces: `specificity(sel: string): number` — `id*10000 + class/attr/pseudo-class*100 + type/pseudo-element`.
- Produces: `lastCompound(sel: string): string` — 마지막 복합 선택자에서 의사 클래스를 뗀 것.

- [ ] **Step 1: 픽스처 작성**

`test/fixtures/css-surfaces/flat/entry.css`
```css
@layer one, two;
@import "./a.css" layer(one);
@import "./b.css";
.plain { color: red; }
```
`test/fixtures/css-surfaces/flat/a.css`
```css
.x { color: blue; }
@media (max-width: 700px) { .x { color: green !important; } }
```
`test/fixtures/css-surfaces/flat/b.css`
```css
@layer two { .y#id:hover > b::before { margin: 0; } }
```

- [ ] **Step 2: 실패하는 테스트**

`test/cssFlatten.test.ts`
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { flattenImports, indexDeclarations, lastCompound, specificity } from "../scripts/css-flatten.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/flat");

describe("css-flatten", () => {
  it("평탄화 순서와 import 레이어를 기록한다", () => {
    const order = flattenImports(resolve(ROOT, "entry.css"));
    expect(order.map((o) => [o.file, o.layer])).toEqual([
      [resolve(ROOT, "entry.css"), null],
      [resolve(ROOT, "a.css"), "one"],
      [resolve(ROOT, "b.css"), null],
    ]);
  });
  it("선언에 파일·줄·레이어·@media·!important 를 붙인다", () => {
    const decls = indexDeclarations(flattenImports(resolve(ROOT, "entry.css")), ROOT);
    const x = decls.filter((d) => d.sel === ".x");
    expect(x).toHaveLength(2);
    expect(x[0]).toMatchObject({ file: "a.css", line: 1, layer: "one", at: "", prop: "color", value: "blue", imp: false });
    expect(x[1]).toMatchObject({ layer: "one", at: "@media (max-width: 700px)", imp: true });
    const y = decls.find((d) => d.prop === "margin");
    expect(y).toMatchObject({ file: "b.css", layer: "two" });
    const plain = decls.find((d) => d.sel === ".plain");
    expect(plain?.layer).toBeNull();
    // 진입 시트 자신의 규칙은 import 뒤에 온다
    expect(plain!.seq).toBeGreaterThan(y!.seq);
  });
  it("특이도와 마지막 복합 선택자", () => {
    expect(specificity(".y#id:hover > b::before")).toBe(10000 + 200 + 2);
    expect(lastCompound(".a .b:hover > .c.d::after")).toBe(".c.d");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run test/cssFlatten.test.ts`
Expected: FAIL — `Cannot find module '../scripts/css-flatten.mjs'`

- [ ] **Step 4: 구현**

`scripts/css-flatten.mjs`
```js
// CSS 평탄화 + 선언 인덱스. 다른 css-* 스크립트의 공통 라이브러리. 단독 실행 시 JSON 출력.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?([^;]*);/g;

export function flattenImports(entryAbs) {
  const order = [];
  const seen = new Map();
  const walk = (file, depth, layer) => {
    const abs = path.resolve(file);
    const copy = (seen.get(abs) ?? 0) + 1;
    seen.set(abs, copy);
    order.push({ file: abs, depth, layer, copy });
    if (copy > 1) return; // postcss-import 는 첫 위치로 dedup 한다
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { return; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(IMPORT_RE)) {
      const tail = m[2] ?? "";
      const lm = /layer\(\s*([\w.-]+)\s*\)/.exec(tail);
      walk(path.resolve(path.dirname(abs), m[1]), depth + 1, lm ? lm[1] : layer);
    }
  };
  walk(entryAbs, 0, null);
  return order;
}

function contextOf(node) {
  let layer = null;
  const at = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "atrule") continue;
    if (p.name === "layer") layer = p.params.trim();
    else at.push(`@${p.name} ${p.params.trim()}`);
  }
  return { layer, at: at.reverse().join(" / ") };
}

function declsOfFile(entry, rootAbs) {
  let src;
  try { src = fs.readFileSync(entry.file, "utf8"); } catch { return []; }
  const ast = postcss.parse(src, { from: entry.file });
  const rel = path.relative(rootAbs, entry.file);
  const out = [];
  ast.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") return;
    const ctx = contextOf(rule);
    const layer = ctx.layer ?? entry.layer;
    for (const sel of rule.selectors.map((s) => s.replace(/\s+/g, " ").trim())) {
      rule.each((d) => {
        if (d.type !== "decl") return;
        out.push({
          file: rel, line: d.source.start.line, sel, layer, at: ctx.at,
          prop: d.prop.toLowerCase(), value: d.value.replace(/\s+/g, " ").trim(), imp: Boolean(d.important),
        });
      });
    }
  });
  return out;
}

// CSS 는 @import 가 규칙보다 앞에 와야 하므로, 허브 자신의 규칙은 그 허브가 import 한 모든 시트 뒤에 온다.
// 따라서 자식(깊이 큰 파일)을 먼저 내보내고 부모 자신의 선언은 부모의 부분 트리가 끝날 때 내보낸다.
export function indexDeclarations(order, rootAbs) {
  const decls = [];
  let seq = 0;
  const emit = (entry) => { for (const d of declsOfFile(entry, rootAbs)) decls.push({ seq: seq++, ...d }); };
  const stack = [];
  for (const entry of order) {
    if (entry.copy > 1) continue;
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) emit(stack.pop());
    stack.push(entry);
  }
  while (stack.length) emit(stack.pop());
  return decls;
}

export function specificity(sel) {
  let ids = 0, classes = 0, types = 0;
  const s = sel.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, (m) => {
    if (m.startsWith("::") || /^:(before|after|first-line|first-letter)/.test(m)) types++;
    else if (!/^:(is|where|not|has)\(/.test(m)) classes++;
    return " ";
  });
  ids += (s.match(/#[\w-]+/g) ?? []).length;
  classes += (s.match(/\.[\w-]+/g) ?? []).length + (s.match(/\[[^\]]+\]/g) ?? []).length;
  types += (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length;
  return ids * 10000 + classes * 100 + types;
}

export function lastCompound(sel) {
  const parts = sel.trim().split(/\s*[>~+]\s*|\s+(?![^(]*\))/);
  return parts[parts.length - 1].replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = path.resolve(process.argv[2] ?? "src/styles/index.css");
  const root = path.resolve("src/styles");
  const order = flattenImports(entry);
  const decls = indexDeclarations(order, root);
  process.stdout.write(JSON.stringify({ order: order.map((o) => ({ ...o, file: path.relative(root, o.file) })), decls }));
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run test/cssFlatten.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 실데이터 스모크**

Run: `node scripts/css-flatten.mjs | node -e 'const j=JSON.parse(require("fs").readFileSync(0));console.log(j.order.length, j.decls.length)'`
Expected: `275 62xxx` 근처(2026-09-11 측정 275 / 62,189).

- [ ] **Step 7: 커밋**

```bash
git add scripts/css-flatten.mjs test/cssFlatten.test.ts test/fixtures/css-surfaces/flat
git commit -m "feat(css): @import 평탄화와 선언 인덱스 라이브러리를 만든다"
```

### Task 2: 표면 레지스트리와 `check-css-surfaces.mjs` (R1–R6, 경고 모드)

**Files:**
- Create: `scripts/css-surfaces.json`
- Create: `scripts/check-css-surfaces.mjs`
- Create: `test/fixtures/css-surfaces/gate/**` (아래)
- Test: `test/checkCssSurfaces.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `flattenImports`, `indexDeclarations`, `lastCompound`.
- Produces: `runSurfaceChecks({stylesRoot, srcRoot, registry, entries}): {violations: Violation[], counts: Record<surface, {important: number}>}` with `Violation = {rule: "R1"|"R2"|"R3"|"R4"|"R5"|"R6", surface: string|null, file: string, line: number, message: string}`.
- Produces: CLI `node scripts/check-css-surfaces.mjs [--baseline] [--enforce <surface|all>]...`. 기본은 모든 위반을 경고로 출력하고 exit 0. `--enforce s` 는 표면 s 의 위반(R1/R2/R4/R5/R6)과 R3 래칫 초과를 exit 1 로 승격. `--baseline` 은 `scripts/css-surfaces.baseline.json` 에 표면별 `!important` 개수와 현재 위반 지문(`rule|file|sel|prop`)을 저장한다. 지문에 있는 위반은 enforce 에서도 실패가 아니다(기존 부채). 새 지문만 실패.

레지스트리 초안. 접두어는 이번 리뷰의 선언 인덱스에서 추출한 것이고, 표면 작업(2–4단계)에서 확정한다.

- [ ] **Step 1: 레지스트리**

`scripts/css-surfaces.json`
```json
{
  "layerOrder": ["tokens", "base", "components", "shell", "map", "event", "database", "resources", "runtime", "overrides"],
  "surfaces": {
    "tokens":     { "dir": "src/styles/tokens.css", "entry": "src/styles/tokens.css", "prefixes": [], "roots": [":root", "html", "body"] },
    "base":       { "dir": "src/styles/base", "entry": "src/styles/base/index.css", "prefixes": [], "roots": ["html", "body", "*", "::selection", "::-webkit-scrollbar"] },
    "components": { "dir": "src/styles/components", "entry": "src/styles/components/index.css",
                    "prefixes": ["btn", "icon", "app-modal", "empty-state", "grid-4", "field", "input", "select", "checkbox", "chip", "badge", "toast"], "roots": [] },
    "shell":      { "dir": "src/styles/shell", "entry": "src/styles/shell/index.css",
                    "prefixes": ["topbar", "oprn-menu", "oprn-toolbar", "editor-layout", "left-panel", "basic-rail", "team-", "coach-mark", "editor-welcome", "director-briefing", "editor-statusbar", "map-context-menu", "chipset-sheet-popout", "authoring-journey", "ai-settings", "ai-auth", "help-modal", "audio-test", "audio-preview", "cluster-ai", "local-diagnostics", "project-picker", "db-config-project"],
                    "roots": ["body.editor-ui-beginner", "body.editor-ui-standard", "body.editor-ui-expert", ".editor-layout"] },
    "map":        { "dir": "src/styles/map", "entry": "src/styles/map/index.css",
                    "prefixes": ["map-", "tile-", "chipset-", "palette-", "brush-", "quick-tile", "canvas-", "region-task", "region-size", "selection-action", "world-", "village-info", "map-props", "map-history", "map-event-search", "event-marker-tooltip", "build-palette", "harness-", "structure-kit", "inline-assist", "ghost-", "ai-ghost", "ai-activity", "agent-", "runtime-overlay", "runtime-debug", "resource-"],
                    "roots": [".editor-layout"] },
    "event":      { "dir": "src/styles/event", "entry": "src/styles/event/index.css",
                    "prefixes": ["event-", "ecp-", "cmd-", "rich-", "m2-", "page3-", "schema-", "shop-", "move-route", "coordinate-move", "cream-command", "input-number-command", "play-audio-command", "change-", "transfer-", "party-member", "actor-m2", "storage-chest", "character-id", "npc-", "record-browser", "pick-", "blk-", "oprn-command"],
                    "roots": [".event-editor-modal-backdrop", ".event-editor-modal-window", ".event-subdialog-backdrop"] },
    "database":   { "dir": "src/styles/database", "entry": "src/styles/database/index.css",
                    "prefixes": ["database-", "db-", "oprn-record", "oprn-tileset", "actor-", "enemy-", "troop-", "tileset-", "palette-preset", "ai-chat", "ai-command-bar", "ai-deck", "ai-studio", "ai-assistant", "ai-status", "ai-abort", "ai-sticky", "spatial-", "world-gen", "scratch-", "title-", "system-", "growth-", "battle-studio", "animation-", "curve-"],
                    "roots": [".database-modal-backdrop", ".database-modal-window", "body.ai-studio-open", "body.ai-panel-docked", "body.ai-command-bar-active"] },
    "resources":  { "dir": "src/styles/resources", "entry": "src/styles/resources/index.css", "prefixes": ["resource-manager", "rm-"], "roots": [] },
    "runtime":    { "dir": "src/styles/runtime", "entry": "src/styles/runtime/index.css", "prefixes": ["*"], "roots": [] },
    "overrides":  { "dir": "src/styles/overrides.css", "entry": "src/styles/overrides.css", "prefixes": ["*"], "roots": [] }
  },
  "orderCommentPatterns": ["뒤에 와야", "뒤에 읽", "앞에 와야", "마지막 발언자", "마지막 @import", "must come after", "must follow", "load order", "cascade order", "순서 금지", "재배열 금지"],
  "dynamicPrefixMinLength": 3
}
```
`runtime`·`overrides` 의 `"*"` 는 R2 검사 제외를 뜻한다.

- [ ] **Step 2: 픽스처**

`test/fixtures/css-surfaces/gate/styles/index.css`
```css
@layer tokens, base, alpha, beta, overrides;
@import "./tokens.css" layer(tokens);
@import "./alpha/index.css";
@import "./beta/index.css";
.unlayered-leak { color: red; }
```
`test/fixtures/css-surfaces/gate/styles/tokens.css`
```css
:root { --accent: #4a57d6; }
```
`test/fixtures/css-surfaces/gate/styles/alpha/index.css`
```css
/* 반드시 beta 뒤에 와야 이긴다 */
@import "./a.css" layer(alpha);
```
`test/fixtures/css-surfaces/gate/styles/alpha/a.css`
```css
.al-card { color: var(--accent); background: var(--nope); border: var(--nope2, var(--accent)); }
.al-card .bt-row { margin: 0 !important; }
.al-ghost { color: blue; }
```
`test/fixtures/css-surfaces/gate/styles/beta/index.css`
```css
@import "./b.css" layer(beta);
```
`test/fixtures/css-surfaces/gate/styles/beta/b.css`
```css
.bt-row { padding: 0; }
.bt-row.is-active { --bt-tone: red; color: var(--bt-tone); }
```
`test/fixtures/css-surfaces/gate/src/view.ts`
```ts
export const classes = ["al-card", "bt-row", `bt-${"is-active"}`];
```
`test/fixtures/css-surfaces/gate/registry.json`
```json
{
  "layerOrder": ["tokens", "base", "alpha", "beta", "overrides"],
  "surfaces": {
    "tokens": { "dir": "styles/tokens.css", "entry": "styles/tokens.css", "prefixes": [], "roots": [":root"] },
    "alpha":  { "dir": "styles/alpha", "entry": "styles/alpha/index.css", "prefixes": ["al-"], "roots": [] },
    "beta":   { "dir": "styles/beta", "entry": "styles/beta/index.css", "prefixes": ["bt-"], "roots": [] }
  },
  "orderCommentPatterns": ["뒤에 와야"],
  "dynamicPrefixMinLength": 3
}
```

- [ ] **Step 3: 실패하는 테스트**

`test/checkCssSurfaces.test.ts`
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runSurfaceChecks } from "../scripts/check-css-surfaces.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/gate");
const registry = JSON.parse(readFileSync(resolve(ROOT, "registry.json"), "utf8"));

function run() {
  return runSurfaceChecks({ stylesRoot: resolve(ROOT, "styles"), srcRoot: resolve(ROOT, "src"), registry, entries: [resolve(ROOT, "styles/index.css")] });
}
const by = (rule: string) => run().violations.filter((v) => v.rule === rule);

describe("check-css-surfaces", () => {
  it("R1 언레이어 규칙을 잡는다", () => {
    expect(by("R1")).toEqual([expect.objectContaining({ file: "index.css", line: 5, message: expect.stringContaining(".unlayered-leak") })]);
  });
  it("R2 표면 밖 접두어를 잡는다 (alpha 시트가 bt- 를 건드림)", () => {
    expect(by("R2")).toEqual([expect.objectContaining({ surface: "alpha", file: "alpha/a.css", line: 2 })]);
  });
  it("R3 표면별 !important 를 센다", () => {
    expect(run().counts.alpha.important).toBe(1);
    expect(run().counts.beta.important).toBe(0);
  });
  it("R4 폴백 없는 미정의 변수만 잡는다 (--nope2 는 폴백이 토큰으로 떨어져 통과, --bt-tone 은 같은 표면 정의)", () => {
    expect(by("R4")).toEqual([expect.objectContaining({ file: "alpha/a.css", message: expect.stringContaining("--nope") })]);
    expect(by("R4")).toHaveLength(1);
  });
  it("R5 TS 에 없는 클래스만 요구하는 규칙을 잡고, 동적 접두어(bt-)는 살려 둔다", () => {
    const r5 = by("R5").map((v) => v.message).sort();
    expect(r5).toEqual([expect.stringContaining(".al-ghost"), expect.stringContaining(".unlayered-leak")]);
  });
  it("R6 순서 주석을 잡는다", () => {
    expect(by("R6")).toEqual([expect.objectContaining({ file: "alpha/index.css", line: 1 })]);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run test/checkCssSurfaces.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: 구현**

`scripts/check-css-surfaces.mjs`
```js
// CSS 표면 격리 게이트 — 스펙 docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md §3.3 R1–R6.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenImports, indexDeclarations, lastCompound } from "./css-flatten.mjs";

const BASELINE_PATH = "scripts/css-surfaces.baseline.json";

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|^\.|dist|output/.test(e.name)) walkFiles(p, exts, out); }
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

function surfaceOfFile(relFile, registry) {
  for (const [name, s] of Object.entries(registry.surfaces)) {
    const dir = s.dir.replace(/^src\/styles\/?/, "").replace(/^styles\/?/, "");
    if (dir && (relFile === dir || relFile.startsWith(dir + "/"))) return name;
  }
  return null;
}

function classTokens(sel) {
  // :not(.x) 안의 클래스는 규칙이 스타일하는 대상이 아니다 → 제외
  const stripped = sel.replace(/:not\([^)]*\)/g, "");
  return [...stripped.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

function collectSourceTokens(srcRoot, minLen) {
  const files = walkFiles(srcRoot, [".ts", ".tsx", ".js", ".html"]);
  const literal = new Set();
  const dynamicPrefixes = new Set();
  for (const f of files) {
    if (f.includes(`${path.sep}styles${path.sep}`)) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/[\w-]+/g)) literal.add(m[0]);
    for (const m of src.matchAll(/`([\w-]*-)\$\{/g)) if (m[1].length >= minLen) dynamicPrefixes.add(m[1]);
    for (const m of src.matchAll(/["']([\w-]*-)["']\s*\+/g)) if (m[1].length >= minLen) dynamicPrefixes.add(m[1]);
  }
  return { literal, dynamicPrefixes: [...dynamicPrefixes] };
}

function parseVarUses(value) {
  const out = [];
  let i = 0;
  while ((i = value.indexOf("var(", i)) !== -1) {
    let j = i + 4, depth = 1;
    while (j < value.length && depth > 0) { if (value[j] === "(") depth++; else if (value[j] === ")") depth--; j++; }
    const inner = value.slice(i + 4, j - 1);
    const c = inner.indexOf(",");
    out.push({ name: (c === -1 ? inner : inner.slice(0, c)).trim(), fallback: c === -1 ? null : inner.slice(c + 1).trim() });
    i = j;
  }
  return out;
}

export function runSurfaceChecks({ stylesRoot, srcRoot, registry, entries }) {
  const violations = [];
  const counts = Object.fromEntries(Object.keys(registry.surfaces).map((s) => [s, { important: 0 }]));
  const push = (rule, surface, file, line, message) => violations.push({ rule, surface, file, line, message });

  const order = entries.flatMap((e) => flattenImports(e));
  const decls = indexDeclarations(order, stylesRoot);
  const entryRel = new Set(entries.map((e) => path.relative(stylesRoot, e)));
  for (const s of Object.values(registry.surfaces)) entryRel.add(s.entry.replace(/^src\/styles\/?/, "").replace(/^styles\/?/, ""));

  // 토큰 정의 수집 (R4)
  const defsBySurface = new Map(); // surface|null -> Set(name)
  for (const d of decls) {
    if (!d.prop.startsWith("--")) continue;
    const s = surfaceOfFile(d.file, registry);
    if (!defsBySurface.has(s)) defsBySurface.set(s, new Set());
    defsBySurface.get(s).add(d.prop);
  }
  const tokenDefs = defsBySurface.get("tokens") ?? new Set();
  const tsDefs = new Set();
  for (const f of walkFiles(srcRoot, [".ts", ".tsx"])) {
    if (f.includes(`${path.sep}styles${path.sep}`)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/setProperty\(\s*[`"'](--[\w-]+)/g)) tsDefs.add(m[1]);
    for (const m of fs.readFileSync(f, "utf8").matchAll(/setProperty\(\s*`(--[\w-]*)\$\{/g)) tsDefs.add(m[1] + "*");
  }
  const tsDefined = (name) => tsDefs.has(name) || [...tsDefs].some((k) => k.endsWith("*") && name.startsWith(k.slice(0, -1)));

  const source = collectSourceTokens(srcRoot, registry.dynamicPrefixMinLength ?? 3);
  const alive = (cls) => source.literal.has(cls) || source.dynamicPrefixes.some((p) => cls.startsWith(p));

  const seenRule = new Set();
  for (const d of decls) {
    const surface = surfaceOfFile(d.file, registry);
    const spec = surface ? registry.surfaces[surface] : null;
    // R1
    if (!d.layer && !(d.file === "index.css" && d.sel === "@layer")) {
      if (!surface || !["tokens", "base"].includes(surface)) push("R1", surface, d.file, d.line, `언레이어 규칙: ${d.sel}`);
    }
    // R3
    if (d.imp && surface && surface !== "overrides") counts[surface].important++;
    // R2
    if (spec && !spec.prefixes.includes("*")) {
      const allowed = [...spec.prefixes, ...(registry.surfaces.components?.prefixes ?? [])];
      for (const cls of classTokens(d.sel)) {
        if (!allowed.some((p) => cls === p.replace(/-$/, "") || cls.startsWith(p))) {
          const key = `R2|${d.file}|${d.line}|${cls}`;
          if (!seenRule.has(key)) { seenRule.add(key); push("R2", surface, d.file, d.line, `표면 밖 클래스 .${cls} in ${d.sel}`); }
        }
      }
    }
    // R4
    for (const u of parseVarUses(d.value)) {
      const definedHere = defsBySurface.get(surface)?.has(u.name);
      if (tokenDefs.has(u.name) || definedHere || tsDefined(u.name)) continue;
      const fallbackOk = u.fallback !== null && (!/var\(/.test(u.fallback) || parseVarUses(u.fallback).every((f) => tokenDefs.has(f.name)));
      if (fallbackOk) continue;
      const key = `R4|${d.file}|${d.line}|${u.name}`;
      if (!seenRule.has(key)) { seenRule.add(key); push("R4", surface, d.file, d.line, `미정의 변수 ${u.name} (폴백 없음)`); }
    }
    // R5 — 선택자의 클래스 전부가 소스에 없을 때만
    const classes = classTokens(d.sel);
    if (classes.length > 0 && classes.every((c) => !alive(c))) {
      const key = `R5|${d.file}|${d.sel}`;
      if (!seenRule.has(key)) { seenRule.add(key); push("R5", surface, d.file, d.line, `죽은 선택자 ${d.sel}`); }
    }
  }
  // R6 — 순서 주석
  const patterns = registry.orderCommentPatterns ?? [];
  const cssFiles = new Set(order.map((o) => o.file));
  for (const abs of cssFiles) {
    const rel = path.relative(stylesRoot, abs);
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    lines.forEach((L, i) => { if (patterns.some((p) => L.includes(p))) push("R6", surfaceOfFile(rel, registry), rel, i + 1, `순서 주석: ${L.trim().slice(0, 80)}`); });
  }
  // 허브 깊이 1 (진입 시트 밖 @import)
  for (const o of order) {
    const rel = path.relative(stylesRoot, o.file);
    if (o.depth >= 1 && !entryRel.has(rel) && /@import/.test(fs.readFileSync(o.file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))) {
      push("R1", surfaceOfFile(rel, registry), rel, 1, "진입 시트가 아닌 파일의 @import (허브 깊이 1 위반)");
    }
  }
  return { violations, counts };
}

function fingerprint(v) { return `${v.rule}|${v.file}|${v.line}|${v.message}`; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
  const stylesRoot = path.resolve("src/styles");
  const entries = [path.resolve("src/styles/index.css"), ...Object.values(registry.surfaces).map((s) => path.resolve(s.entry))]
    .filter((p, i, a) => fs.existsSync(p) && a.indexOf(p) === i);
  const { violations, counts } = runSurfaceChecks({ stylesRoot, srcRoot: path.resolve("src"), registry, entries });
  if (args.includes("--baseline")) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ counts, known: violations.map(fingerprint).sort() }, null, 2) + "\n");
    console.log(`baseline saved: ${violations.length} known violations`);
    process.exit(0);
  }
  const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : { counts: {}, known: [] };
  const known = new Set(baseline.known);
  const enforce = new Set(args.flatMap((a, i) => (a === "--enforce" ? [args[i + 1]] : [])));
  const enforced = (s) => enforce.has("all") || (s && enforce.has(s));
  let failed = false;
  const byRule = {};
  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    const isNew = !known.has(fingerprint(v));
    if (isNew && enforced(v.surface)) { failed = true; console.error(`FAIL ${v.rule} [${v.surface}] ${v.file}:${v.line} ${v.message}`); }
  }
  for (const [s, c] of Object.entries(counts)) {
    const base = baseline.counts?.[s]?.important ?? Infinity;
    if (c.important > base && enforced(s)) { failed = true; console.error(`FAIL R3 [${s}] !important ${base} → ${c.important}`); }
  }
  console.log("css-surfaces:", JSON.stringify(byRule), "important:", JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v.important]))));
  process.exit(failed ? 1 : 0);
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run test/checkCssSurfaces.test.ts`
Expected: PASS (6 tests). 실패하면 픽스처 기대값이 아니라 구현을 고친다.

- [ ] **Step 7: 실리포에 경고 모드로 돌려 기준선 저장**

Run: `node scripts/check-css-surfaces.mjs --baseline && node scripts/check-css-surfaces.mjs`
Expected: 두 번째 명령 exit 0. 출력에 `R1` 수천 건(현재 거의 전부 언레이어), `R5` ≈ 190, `R4` ≈ 4, `R6` ≈ 12. R2 는 현재 디렉토리 구조(`editor/`)가 레지스트리에 없어 대부분 `surface=null` 로 잡히지 않는다 — 정상. 3단계에서 의미를 갖는다.

- [ ] **Step 8: gates 배선**

`package.json` 의 `gates:css` 를:
```json
"gates:css": "node scripts/check-css-budget.mjs && node scripts/check-css-graph.mjs && node scripts/check-css-live-classes.mjs && node scripts/check-css-surfaces.mjs",
```
Run: `npm run gates:css`
Expected: exit 0.

- [ ] **Step 9: 커밋**

```bash
git add scripts/css-surfaces.json scripts/check-css-surfaces.mjs scripts/css-surfaces.baseline.json test/checkCssSurfaces.test.ts test/fixtures/css-surfaces/gate package.json
git commit -m "feat(css): 표면 레지스트리와 R1–R6 격리 게이트를 경고 모드로 붙인다"
```

### Task 3: 픽셀 기준선 (`css-surface-shots.spec.ts`)

**Files:**
- Create: `playwright.css-shots.config.ts`
- Create: `test/e2e/css-surface-shots.spec.ts`
- Modify: `src/editor/panels/databaseModal.ts` (탭 내비게이션 버튼에 `data-testid`) — 아래 Step 1 에서 위치 확정
- Modify: `package.json` scripts

**Interfaces:**
- Produces: 스냅샷 디렉토리 `test/e2e/css-surface-shots.spec.ts-snapshots/*.png`. 이후 모든 단계의 "시각 동일" 판정은 `npm run shots:css` 가 exit 0 인 것.

- [ ] **Step 1: DB 탭 내비게이션 testid 위치 확인**

Run: `grep -rn "switchDatabaseActiveTab" src/editor/panels/*.ts | grep -v "^src/editor/panels/databaseModal.ts:382"`
그 결과 중 탭 버튼을 만드는 곳(`el("button"` 이 있는 줄)을 찾아 그 버튼의 `dataset` 에 `testid: \`database-nav-${tab}\`` 를 추가한다. 이미 testid 가 있으면 그 이름을 Step 3 의 `NAV_TESTID` 로 쓴다. 변경은 이 한 속성만.

- [ ] **Step 2: Playwright 설정**

`playwright.css-shots.config.ts`
```ts
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// CSS 표면 격리 픽셀 기준선. 갱신: npm run shots:css:update (스펙 §3.5 예외 4건 외 갱신 금지)
export default defineConfig(base, {
  testMatch: "**/css-surface-shots.spec.ts",
  retries: 0,
  workers: 1,
  timeout: 180_000,
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", caret: "hide", scale: "css" } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce" } }],
});
```

- [ ] **Step 3: 스펙**

`test/e2e/css-surface-shots.spec.ts`
```ts
// CSS 표면 격리 픽셀 기준선 — 스펙 §3.5.
// 기준선은 표면 작업 시작 전 main 에서 찍고, 표면 작업 중에는 갱신하지 않는다.
import { expect, test, type Page } from "@playwright/test";
import { mockupProject } from "./mockupProbeSeeds";
import { openEventEditor } from "./eventEditorCertEvidence";
import { seedProjectForEditor } from "./projectSeed";

const NAV_TESTID = (tab: string) => `database-nav-${tab}`;
const VIEWPORTS = [{ w: 1280, h: 800 }, { w: 1440, h: 900 }];
const DB_TABS = [
  "overview", "characters", "characterGraphics", "characterAppearances", "elements", "monsterSpecies",
  "skillTrees", "promotionTree", "animations", "battleCommands", "battleScreen", "terrain",
  "commonEvents", "switches", "variables", "system", "opening", "gameOver", "terms",
  "tilesets", "tilesetAutotile", "tilesetUnlabeled", "tilesetSpaces", "structureKits", "spatialTiles",
  "crops", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "factions", "lifeCollections",
  "villages", "worldCanon", "worldCodex", "worldGen", "scratchConcepts",
];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function boot(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  const seed = mockupProject();
  await seedProjectForEditor(page, seed.project);
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 60_000 });
  await settle(page);
  return seed;
}

for (const { w, h } of VIEWPORTS) {
  test(`shell ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await expect(page).toHaveScreenshot(`shell-${w}.png`, { fullPage: false });
  });

  test(`shell beginner mode ${w}x${h}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", JSON.stringify("beginner")));
    await boot(page, w, h);
    await expect(page.locator("body.editor-ui-beginner")).toHaveCount(1);
    await expect(page).toHaveScreenshot(`shell-beginner-${w}.png`);
  });

  test(`event editor pages ${w}x${h}`, async ({ page }) => {
    const { eventId } = await boot(page, w, h);
    await openEventEditor(page, eventId);
    const modal = page.getByTestId("event-editor-modal");
    await settle(page);
    await expect(page).toHaveScreenshot(`event-page1-${w}.png`);
    const tabs = modal.locator(".event-page-tab, .event-page-tab-rich");
    if ((await tabs.count()) > 1) {
      await tabs.nth(1).click();
      await settle(page);
      await expect(page).toHaveScreenshot(`event-page2-${w}.png`);
    }
    await modal.getByTestId("event-command-toolbar-add").first().click();
    await expect(page.getByTestId("event-command-picker")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-command-picker-${w}.png`);
    await page.keyboard.press("Escape");
    await modal.getByTestId("event-page-graphic-set").click();
    await expect(page.getByTestId("event-graphic-dialog")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-graphic-dialog-${w}.png`);
    await page.keyboard.press("Escape");
    await modal.getByTestId("event-page-movement-type").selectOption("custom");
    await modal.getByTestId("event-page-custom-route").click();
    await expect(page.getByTestId("event-page-move-route-dialog")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-move-route-${w}.png`);
  });
}

test("database tabs 1440x900", async ({ page }) => {
  await boot(page, 1440, 900);
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 30_000 });
  for (const tab of DB_TABS) {
    const nav = page.getByTestId(NAV_TESTID(tab));
    if ((await nav.count()) === 0) { test.info().annotations.push({ type: "skip-tab", description: tab }); continue; }
    await nav.first().click();
    await settle(page);
    await expect(page).toHaveScreenshot(`db-${tab}.png`);
  }
});
```
`mockupProject()` 가 이벤트 페이지를 2개 이상 만들지 않으면 `event-page2` 는 건너뛴다(조건문). 그래도 기준선 개수는 고정된다.

- [ ] **Step 4: 스크립트 배선**

`package.json` scripts 에:
```json
"shots:css": "playwright test -c playwright.css-shots.config.ts",
"shots:css:update": "playwright test -c playwright.css-shots.config.ts --update-snapshots",
```

- [ ] **Step 5: 기준선 촬영**

Run: `npm run shots:css:update`
Expected: exit 0, `test/e2e/css-surface-shots.spec.ts-snapshots/` 에 png 약 2×7 + 37 = 51장 안팎. 건너뛴 DB 탭이 있으면 리포트 annotation 에 `skip-tab` 으로 남는다 — 그 탭들은 Step 1 의 testid 가 안 붙은 곳이니 Step 1 로 돌아가 붙인다. 37탭 전부 찍힐 때까지 반복.

- [ ] **Step 6: 재현성 확인**

Run: `npm run shots:css`
Expected: exit 0 (같은 트리에서 두 번째 실행이 동일). 실패하는 항목은 소음이다 — 해당 화면의 시계·랜덤 요소를 찾아 `settle()` 뒤에 `page.evaluate` 로 고정하거나, 그 항목에 `mask: [locator]` 를 준다. 소음 항목 0 이 될 때까지.

- [ ] **Step 7: 커밋**

```bash
git add playwright.css-shots.config.ts test/e2e/css-surface-shots.spec.ts test/e2e/css-surface-shots.spec.ts-snapshots src/editor/panels/databaseModal.ts package.json
git commit -m "test(css): 셸·이벤트 에디터·DB 37탭 픽셀 기준선을 찍는다"
```

### Task 4: `TOKENS.md` 재작성

**Files:**
- Modify: `src/styles/TOKENS.md` (전면)

- [ ] **Step 1: 현재 토큰 값 표 생성**

Run:
```bash
node -e '
const s=require("fs").readFileSync("src/styles/tokens.css","utf8").replace(/\/\*[\s\S]*?\*\//g,"");
for(const m of s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) console.log(`| \`${m[1]}\` | \`${m[2].trim()}\` |`);
'
```
출력을 문서의 값 표로 쓴다(수동 전사 금지).

- [ ] **Step 2: 문서 구조**

`src/styles/TOKENS.md` 를 다음 구조로 다시 쓴다. 값은 Step 1 출력 그대로.
```markdown
# rpg-zzu 디자인 토큰 가이드

**원본:** `src/styles/tokens.css` (유일한 `:root` 토큰 정의). 이 문서의 값 표는 `node -e` 로 생성한다 — 손으로 고치지 말고 tokens.css 를 고친 뒤 재생성.
**방향:** 쿨 화이트 + 인디고 단일 액센트(2026-08-25 이후). 크림/골드 팔레트는 폐기됐다. `html { color-scheme: light }`.

## 1. 토큰 값 (자동 생성)
| 토큰 | 값 |
|---|---|
(Step 1 출력)

## 2. 레이어와 표면
(스펙 §3.1 표를 그대로 옮긴다)

## 3. 규칙
- 토큰은 tokens.css 에서만 `:root` 로 정의한다. 다른 파일의 `:root` 재정의 금지(게이트 R4).
- 표면 사설 토큰은 표면 접두어(`--ev-*`, `--db-*`, `--map-*`, `--shell-*`)를 쓰고 표면 루트 선택자 아래에서만 정의한다.
- `var(--x)` 는 정의가 있거나 토큰으로 떨어지는 폴백이 있어야 한다. 리터럴 폴백(`var(--x, #fff)`) 금지.
- 색·간격·그림자 리터럴은 tokens.css 밖에서 쓰지 않는다. 필요하면 토큰을 추가한다.
- `!important` 는 `overrides` 레이어에서만, 이유 주석과 만기일과 함께.
- "뒤에 와야" 류 순서 주석은 설계 결함 신호다. 레이어 순서로 풀어라(게이트 R6).
```

- [ ] **Step 3: 크림 값이 남지 않았는지 확인**

Run: `grep -n "F7F3EA\|2A2521\|42, 37, 33\|웜 크림\|warm cream" src/styles/TOKENS.md`
Expected: 출력 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/styles/TOKENS.md
git commit -m "docs(css): TOKENS.md 를 tokens.css 실제 값과 레이어 표로 다시 쓴다"
```

### Task 5: 확정 결함 4건 수정 (기준선 갱신 예외)

**Files:**
- Modify: `src/styles/editor/region-task.css:336,1035,1211`
- Modify: `src/styles/editor/ai-settings-modal.css:546`
- Modify: `src/styles/editor/event-editor.part-3/03-event-condition-label.css:139-146` (`--event-popup-surface` 스코프)
- Modify: `src/styles/editor/village-info.css:1-13`
- Modify: `src/styles/shell/shell-density.part-1.css:285`

- [ ] **Step 1: 미정의 변수 치환**

`region-task.css:336` `var(--editor-row-hover)` → `var(--bg-hover)`; `:1035` 같은 치환; `:1211` `var(--editor-surface)` → `var(--bg-surface)`; `ai-settings-modal.css:546` `var(--surface-1)` → `var(--bg-inset)`.

- [ ] **Step 2: `--event-popup-surface` 를 모든 서브다이얼로그 창으로**

`03-event-condition-label.css:139-146` 의 선택자를 `.event-subdialog-window` 로 넓힌다(기존 3종 testid 한정 선택자를 이 한 줄로 교체). 명령 피커 푸터가 이제 배경을 가진다.

- [ ] **Step 3: 마을 정보 모달을 레이어 밖으로**

`village-info.css` 의 `@layer editor {` 와 마지막 `}` 를 지운다(1단계에서 진입 시트가 `map` 레이어에 넣는다). 그리고 `studio-theme.css:276` 의 `display:flex !important` 를 이기기 위해 `.database-modal-window.village-info-window` 선택자를 `.database-modal-backdrop .database-modal-window.village-info-window` 로 바꾸고 `display: grid !important; flex-direction: unset !important;` 를 준다. 이 `!important` 2개는 1단계에서 `overrides.css` 로 옮긴다(Task 8).

- [ ] **Step 4: 잘못된 주석**

`shell-density.part-1.css:285` 주석을 `/* 이벤트 에디터 모달(1000)·서브다이얼로그(--z-popover-high 1200)보다 위, 앱 모달(--z-app-modal 2600)보다 아래. */` 로.

- [ ] **Step 5: 기준선 갱신과 증거**

Run: `npm run shots:css`
Expected: `event-command-picker-*`(푸터 배경)과 마을 정보가 찍혔다면 그 항목만 실패, 다른 항목 통과. 실패 항목이 예상과 다르면 되돌린다.
Run: `npm run shots:css:update && npm run shots:css`
Expected: exit 0.
Run: `node scripts/check-css-surfaces.mjs --baseline`

- [ ] **Step 6: 커밋**

```bash
git add src/styles scripts/css-surfaces.baseline.json test/e2e/css-surface-shots.spec.ts-snapshots
git commit -m "fix(css): 미정의 변수 4종·피커 푸터 배경·마을 정보 모달 크기를 고친다"
```

- [ ] **Step 7: 0단계 PR**

```bash
git push -u origin css/0-lock
gh pr create --title "css: 표면 격리 0단계 — 기준선·게이트·토큰 문서" --body "$(cat <<'EOF'
스펙: docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md §4 0단계
- css-flatten.mjs / check-css-surfaces.mjs (R1–R6, 경고 모드, 기준선 저장)
- 픽셀 기준선 51장 (shots:css)
- TOKENS.md 재작성
- 확정 결함 4건 수정 (§3.5 예외)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 1단계 — 레이어 씌우기 (리프 불변)

### Task 6: 표면 간 `!important` 전수 조사와 `overrides.css`

**Files:**
- Create: `src/styles/overrides.css`
- Create: `scripts/css-important-pairs.mjs`

**Interfaces:**
- Produces: `overrides.css` — `@layer overrides { … }` 블록. 항목 형식:
```css
/* [event→database] 마을 정보 모달은 DB 모달 셸 안에 뜬다. studio-theme 의 flex !important 를 넘는다.
   만기: 4a 단계(studio-theme 흡수)에서 제거. */
```

- [ ] **Step 1: 쌍 열거 스크립트**

`scripts/css-important-pairs.mjs`
```js
// 레이어를 씌우면 승자가 바뀔 수 있는 !important 쌍을 열거한다. 1단계 전 1회용.
import path from "node:path";
import fs from "node:fs";
import { flattenImports, indexDeclarations, lastCompound } from "./css-flatten.mjs";
const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
const root = path.resolve("src/styles");
const decls = indexDeclarations(flattenImports(path.resolve("src/styles/index.css")), root);
const planned = (file) => { // 1단계 배정표(Task 7 Step 1)와 같은 규칙
  if (file.startsWith("database/")) return "database";
  if (file.startsWith("shell/")) return "shell";
  if (/^editor\/(event-editor|storyboard)/.test(file)) return "event";
  if (file.startsWith("editor/")) return "map";
  if (file.startsWith("runtime/") || file === "dialogue.css") return "runtime";
  if (file.startsWith("components/")) return "components";
  if (file.startsWith("resources/")) return "resources";
  return "base";
};
const rank = Object.fromEntries(registry.layerOrder.map((l, i) => [l, i]));
const imps = decls.filter((d) => d.imp);
const byKey = new Map();
for (const d of decls) { const k = lastCompound(d.sel) + "|" + d.prop; (byKey.get(k) ?? byKey.set(k, []).get(k)).push(d); }
for (const a of imps) {
  for (const b of byKey.get(lastCompound(a.sel) + "|" + a.prop) ?? []) {
    if (b === a || !b.imp) continue;
    const sa = planned(a.file), sb = planned(b.file);
    if (sa === sb) continue;
    // 현재: 뒤(seq 큼)가 이김. 레이어 후: !important 는 낮은 레이어가 이김.
    const nowWinner = a.seq > b.seq ? a : b;
    const laterWinner = rank[sa] < rank[sb] ? a : b;
    if (nowWinner !== laterWinner) console.log(`FLIP ${a.file}:${a.line} [${sa}] vs ${b.file}:${b.line} [${sb}]  ${a.sel} {${a.prop}}`);
  }
}
```

- [ ] **Step 2: 실행**

Run: `node scripts/css-important-pairs.mjs | sort -u`
Expected: 표면 간 `!important` 쌍 목록. 2026-09-11 인덱스 기준 후보: `village-info`↔`studio-theme`(Task 5 에서 만든 것), `editor-ui-modes`(shell)↔`left-sidebar.modern`(map) 의 `.left-panel-stack` padding, `figma-editor/09`(shell)↔`editor-ui-modes`(shell, 같은 표면이라 제외).

- [ ] **Step 3: `overrides.css` 작성**

FLIP 으로 나온 쌍마다 현재 승자 선언을 `overrides.css` 에 옮기고(원 파일에서는 삭제), 이유·만기 주석을 붙인다. 형식:
```css
/* 표면 경계 예외. 항목마다 [출발→도착] 이유, 만기(어느 단계에서 지우나). 게이트 R3 는 이 파일을 세지 않는다. */
@layer overrides {
  /* [map→database] 마을 정보 모달은 DB 모달 셸(.database-modal-window) 안에 뜬다. studio-theme.css 의 display:flex !important 를 넘는다.
     만기: 4a (studio-theme 흡수 시 village-info 가 자기 창 클래스를 갖게 하고 제거). */
  .database-modal-backdrop .database-modal-window.village-info-window { display: grid !important; flex-direction: unset !important; }
}
```

- [ ] **Step 4: 시각 동일 확인**

Run: `npm run shots:css`
Expected: exit 0.

- [ ] **Step 5: 커밋**

```bash
git add src/styles/overrides.css src/styles scripts/css-important-pairs.mjs
git commit -m "refactor(css): 표면을 넘는 !important 를 overrides 레이어로 모은다"
```

### Task 7: 표면 진입 시트와 `index.css` 재작성

**Files:**
- Create: `src/styles/base/index.css`, `src/styles/components/index.css`, `src/styles/shell/index.css`, `src/styles/map/index.css`, `src/styles/event/index.css`, `src/styles/database/index.css`, `src/styles/resources/index.css`, `src/styles/runtime/index.css`
- Modify: `src/styles/index.css` (전면)
- Modify: `src/editor/panels/eventEditor/modal.ts:1`, `src/editor/panels/databaseModal.ts:1`
- Delete: 허브 파일들 (`editor/core.css`, `editor/event-editor.css`, `editor/event-editor-legacy.css`, `editor/event-editor.modern.css`, `editor/event-editor-rich-forms.css`, `editor/event-editor.part-3.css`, `editor/event-editor.command-preview.css`, `shell/figma-editor.css`, `shell/shell-density.css`, `database/core.css`, `database/tabs-a.css`, `database/tabs-b.css`, `database/desktop-record-shell.css`, `database/troops.css`, `database/enemies.css`, `database/tilesets.css`, `database/tabs-b-assistant-panel.css`, `database/troops.part-2.css` 의 @import 부분, `database/modern/life-crafting.css`·`database/modern/tilesets.css` 의 @import 부분, `map/resource-system.css`, `runtime/playerRuntime.css`·`runtime/battle.css`·`runtime/battle-skins/index.css` 의 @import 부분, `editor/core.part-2.css:1`)

이 단계에서 파일은 **이동하지 않는다**. `editor/` 시트는 제자리에 두고 진입 시트가 상대경로로 가져온다. 이동은 2·3단계.

**Interfaces:**
- Produces: `src/styles/index.css` 첫 줄 `@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;`
- Produces: 각 진입 시트는 `@import "<leaf>" layer(<surface>);` 만 담는다. 규칙 없음.

- [ ] **Step 1: 현재 유효 순서를 배정표로 뽑기**

Run:
```bash
node scripts/css-flatten.mjs | node -e '
const j=JSON.parse(require("fs").readFileSync(0));
const seen=new Set();
for(const o of j.order){ if(o.copy>1||seen.has(o.file))continue; seen.add(o.file);
  const isHub=/@import/.test(require("fs").readFileSync("src/styles/"+o.file,"utf8").replace(/\/\*[\s\S]*?\*\//g,""));
  if(isHub&&o.file!=="index.css")continue;
  const s = o.file.startsWith("database/")?"database":o.file.startsWith("shell/")?"shell":/^editor\/(event-editor|storyboard)/.test(o.file)?"event":o.file.startsWith("editor/")?"map":(o.file.startsWith("runtime/")||o.file==="dialogue.css")?"runtime":o.file.startsWith("components/")?"components":o.file.startsWith("resources/")?"resources":o.file==="tokens.css"?"tokens":"base";
  console.log(s+"\t"+o.file);
}' > /tmp/css-assign.tsv
cut -f1 /tmp/css-assign.tsv | sort | uniq -c
```
Expected: 표면별 리프 개수. `base` 에는 `index.css` 만 있어야 한다. 그 외가 `base` 로 떨어지면 배정 규칙(정규식)을 고친다. `editor/` 안에서 `map` 이 아닌 셸 대화상자(`ai-settings-modal`, `help-modal`, `audio-test-dialog`, `cluster-ai-modal`, `local-diagnostics`)는 `shell` 로 수동 배정한다: `sed -i 's#^map\t\(editor/\(ai-settings-modal\|help-modal\|audio-test-dialog\|cluster-ai-modal\|local-diagnostics\)\.css\)#shell\t\1#' /tmp/css-assign.tsv`.

- [ ] **Step 2: 진입 시트 생성**

Run:
```bash
node -e '
const fs=require("fs"),path=require("path");
const rows=fs.readFileSync("/tmp/css-assign.tsv","utf8").trim().split("\n").map(l=>l.split("\t"));
const bySurface={};
for(const [s,f] of rows){ if(s==="tokens"||s==="base")continue; (bySurface[s]??=[]).push(f); }
for(const [s,files] of Object.entries(bySurface)){
  const dir=path.join("src/styles",s); fs.mkdirSync(dir,{recursive:true});
  const lines=[`/* ${s} 표면 진입 시트 — 리프 시트를 @layer ${s} 에 넣는다. 규칙을 여기 쓰지 말 것. 순서는 2026-09-11 유효 순서 그대로(세대 접기 전). */`];
  for(const f of files){ const rel=path.relative(dir,path.join("src/styles",f)).split(path.sep).join("/"); lines.push(`@import "${rel.startsWith(".")?rel:"./"+rel}" layer(${s});`); }
  fs.writeFileSync(path.join(dir,"index.css"),lines.join("\n")+"\n");
  console.log(s,files.length);
}'
```
`runtime/index.css` 가 `runtime/playerRuntime.css` 같은 옛 허브를 가리키면 안 된다 — Step 1 이 허브를 걸렀으므로 리프만 들어간다. 단 `src/qa/backBattlerHarness.ts:11` 이 `runtime/playerRuntime.css` 를 import 하므로 그 파일은 **허브로 유지**하되 내용을 `@import "./index.css";` 한 줄로 바꾼다.

- [ ] **Step 3: `base/index.css`**

`src/styles/index.css` 의 `html { color-scheme … }` 부터 끝까지(스크롤바 블록 포함)를 `src/styles/base/index.css` 로 옮기고 `@layer base { … }` 로 감싼다.

- [ ] **Step 4: `index.css` 재작성**

```css
/* CSS 진입점. 승자는 아래 레이어 순서로만 정해진다 — import 순서·!important 로 이기지 않는다.
   스펙: docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md */
@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;

@import "./tokens.css" layer(tokens);
@import "./base/index.css";
@import "./components/index.css";
@import "./shell/index.css";
@import "./map/index.css";
@import "./resources/index.css";
@import "./runtime/index.css";
@import "./overrides.css";
```
`event`·`database` 는 여기 없다.

- [ ] **Step 5: TS import**

`src/editor/panels/eventEditor/modal.ts` 첫 import 앞에 `import "@/styles/event/index.css";`
`src/editor/panels/databaseModal.ts` 첫 import 앞에 `import "@/styles/database/index.css";`
기존 15곳의 `import "@/styles/database/...css"` 와 `src/editor/panels/localDiagnosticsDialog.ts:7` 의 `import "@/styles/editor/local-diagnostics.css"` 를 삭제한다(전부 진입 시트에 들어갔다). 삭제 대상 확인: `grep -rn 'import "@/styles/' src --include=*.ts | grep -v "styles/index.css\|styles/event/index.css\|styles/database/index.css"` → `src/qa/backBattlerHarness.ts` 와 `src/benchmark/ui/landing.ts` 만 남아야 한다.

- [ ] **Step 6: 옛 허브 삭제**

`git rm` 대상: Step 1 에서 `isHub` 로 걸러진 파일 중 다른 곳에서 안 쓰는 것. 목록은 `node scripts/css-flatten.mjs` 를 다시 돌려 `order` 에 `depth>=1` 로 나타나는 허브. `runtime/playerRuntime.css` 만 예외(Step 2). 허브이면서 규칙도 가진 파일(`event-editor.css:23-137` 의 `:root` 별칭과 규칙, `troops.part-2.css`, `modern/life-crafting.css`, `modern/tilesets.css`, `core.part-2.css`)은 @import 줄만 지우고 규칙은 남긴다. 그 남은 규칙 파일은 진입 시트에 들어 있어야 한다 — Step 1 은 허브를 걸렀으니 이 5개를 진입 시트에 원래 위치에 맞게 수동 추가한다(`event-editor.css` 는 `event/index.css` 에서 `event-editor.shop.css` 다음, 나머지는 각 database 위치).

- [ ] **Step 7: 빌드·게이트·시각 동일**

Run: `npx vite build --logLevel warn 2>&1 | tail -3`
Expected: 경고 없이 빌드. `dist/assets/main-*.css` 첫 바이트가 `@layer tokens,base,components,...` 로 시작: `head -c 120 dist/assets/main-*.css`.
Run: `node scripts/check-css-graph.mjs`
Expected: `orphan=0`. 실패하면 진입 시트가 빼먹은 리프다 — 목록을 진입 시트에 추가.
Run: `node scripts/check-css-surfaces.mjs`
Expected: R1 이 수천 → 거의 0(진입 시트 밖 규칙 없음). 남은 R1 은 진입 시트에 안 들어간 파일 → 추가.
Run: `npm run shots:css`
Expected: exit 0. 실패 항목이 있으면 그 화면의 규칙 중 `!important` 쌍이 Task 6 을 빠져나간 것이다. `scripts/css-important-pairs.mjs` 를 다시 돌려 그 선택자를 찾아 `overrides.css` 로 옮긴다. 기준선을 갱신하지 않는다.
Run: `npx vitest run test/eventEditorShellSurface.baseline.test.ts test/eventEditorFormSurface.baseline.test.ts test/eventEditorM2Surface.baseline.test.ts test/eventEditorPortalSurface.baseline.test.ts test/eventEditorConditionSurface.baseline.test.ts test/eventEditorInteractionSurface.baseline.test.ts`
Expected: PASS.

- [ ] **Step 8: R1 승격, 기준선 갱신**

`package.json` `gates:css` 의 마지막을 `node scripts/check-css-surfaces.mjs --enforce all` 로 바꾸되, R2/R4/R5/R6 기존 부채는 기준선 지문으로 보호된다: `node scripts/check-css-surfaces.mjs --baseline`. 이후 `npm run gates:css` exit 0.

- [ ] **Step 9: 커밋 + PR**

```bash
git add -A src/styles src/editor/panels package.json scripts/css-surfaces.baseline.json
git commit -m "refactor(css): 표면 진입 시트와 레이어 선언으로 캐스케이드 순서를 고정한다"
git push -u origin css/1-layers
gh pr create --title "css: 표면 격리 1단계 — 레이어 씌우기 (리프 불변)" --body "$(cat <<'EOF'
스펙 §4 1단계. 리프 시트 내용 불변, 허브만 진입 시트로 교체. event/database 는 마운트 TS 가 import.
검증: shots:css 51장 동일, eventEditor*Surface 기준선 6종 PASS, check-css-graph orphan=0, R1 enforce.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 2단계 — 이벤트 에디터 접기

### Task 8: `css-prune-shadowed.mjs`

**Files:**
- Create: `scripts/css-prune-shadowed.mjs`
- Create: `test/fixtures/css-surfaces/prune/index.css`, `.../a.css`, `.../b.css`
- Test: `test/cssPruneShadowed.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `findShadowed(decls): Decl[]` — 같은 `sel`, 같은 `prop`, 같은 `at`, 같은 `layer` 인 뒤 선언이 있고, 앞 선언이 `!important` 가 아니거나 뒤 선언도 `!important` 인 경우의 **앞 선언**. 값이 같아도 가려진 것이다(중복).
- Produces: `pruneFile(fileAbs, shadowedLines: number[]): string` — 해당 줄의 선언만 지운 새 소스. 선언이 빠져 빈 규칙이 되면 규칙도 지운다.
- CLI: `node scripts/css-prune-shadowed.mjs --surface event [--write]`. `--write` 없으면 목록만.

- [ ] **Step 1: 픽스처**

`prune/index.css`
```css
@layer s;
@import "./a.css" layer(s);
@import "./b.css" layer(s);
```
`prune/a.css`
```css
.k { color: red; margin: 0; }
.k:hover { color: blue; }
@media (max-width: 700px) { .k { color: green; } }
.z { padding: 1px !important; }
```
`prune/b.css`
```css
.k { color: black; }
.z { padding: 2px; }
```

- [ ] **Step 2: 실패하는 테스트**

`test/cssPruneShadowed.test.ts`
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { flattenImports, indexDeclarations } from "../scripts/css-flatten.mjs";
import { findShadowed, pruneFile } from "../scripts/css-prune-shadowed.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/prune");

describe("css-prune-shadowed", () => {
  const decls = indexDeclarations(flattenImports(resolve(ROOT, "index.css")), ROOT);
  it("같은 선택자·속성·조건의 앞 선언만 가려진 것으로 본다", () => {
    const shadowed = findShadowed(decls);
    expect(shadowed.map((d) => `${d.file}:${d.line} ${d.sel} ${d.prop}`)).toEqual(["a.css:1 .k color"]);
    // :hover 와 @media 는 조건이 달라 남고, .z 는 앞이 !important 라 뒤의 일반 선언에 가려지지 않는다
  });
  it("선언을 지우고 빈 규칙을 정리한다", () => {
    const out = pruneFile(resolve(ROOT, "a.css"), [1]);
    expect(out).toContain(".k { margin: 0; }");
    expect(out).not.toContain("color: red");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run test/cssPruneShadowed.test.ts` — Expected: FAIL (module not found)

- [ ] **Step 4: 구현**

`scripts/css-prune-shadowed.mjs`
```js
// 뒤 선언에 완전히 가려지는 앞 선언을 찾아 지운다. 스펙 §3.4 2단계.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { flattenImports, indexDeclarations } from "./css-flatten.mjs";

export function findShadowed(decls) {
  const byKey = new Map();
  for (const d of decls) {
    const k = `${d.layer}|${d.at}|${d.sel}|${d.prop}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)).push(d);
  }
  const out = [];
  for (const arr of byKey.values()) {
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i];
      const laterWins = arr.slice(i + 1).some((b) => !a.imp || b.imp);
      if (laterWins) out.push(a);
    }
  }
  return out.sort((x, y) => x.seq - y.seq);
}

export function pruneFile(fileAbs, lines) {
  const set = new Set(lines);
  const root = postcss.parse(fs.readFileSync(fileAbs, "utf8"), { from: fileAbs });
  root.walkDecls((d) => { if (set.has(d.source.start.line)) d.remove(); });
  root.walkRules((r) => { if (r.nodes.length === 0) r.remove(); });
  root.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0 && a.name !== "import" && a.name !== "layer") a.remove(); });
  return root.toString();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const surface = args[args.indexOf("--surface") + 1];
  const write = args.includes("--write");
  const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
  const entry = path.resolve(registry.surfaces[surface].entry);
  const root = path.resolve("src/styles");
  const decls = indexDeclarations(flattenImports(entry), root).filter((d) => d.layer === surface);
  const shadowed = findShadowed(decls);
  const byFile = new Map();
  for (const d of shadowed) (byFile.get(d.file) ?? byFile.set(d.file, []).get(d.file)).push(d.line);
  let total = 0;
  for (const [file, lines] of byFile) {
    total += lines.length;
    console.log(`${file}: ${lines.length} shadowed decls`);
    if (write) fs.writeFileSync(path.join(root, file), pruneFile(path.join(root, file), lines));
  }
  console.log(`total shadowed: ${total}${write ? " (written)" : " (dry run)"}`);
}
```
주의: 같은 파일에서 여러 줄을 지울 때 줄 번호는 원본 기준이다. `pruneFile` 이 한 번에 처리하므로 안전하다.

- [ ] **Step 5: 통과 확인** — `npx vitest run test/cssPruneShadowed.test.ts` PASS.

- [ ] **Step 6: 커밋**

```bash
git add scripts/css-prune-shadowed.mjs test/cssPruneShadowed.test.ts test/fixtures/css-surfaces/prune
git commit -m "feat(css): 가려진 선언을 찾아 지우는 도구를 만든다"
```

### Task 9: `css-drop-dead.mjs`

**Files:**
- Create: `scripts/css-drop-dead.mjs`
- Test: `test/cssDropDead.test.ts` (Task 2 의 `gate` 픽스처 재사용)

**Interfaces:**
- Consumes: `runSurfaceChecks` (Task 2) 의 R5 위반.
- Produces: CLI `node scripts/css-drop-dead.mjs --surface event [--write]` — 그 표면 파일의 R5 규칙을 통째로 지운다(선택자 리스트 중 죽은 항목만 있는 규칙은 규칙 삭제, 리스트 일부만 죽었으면 그 선택자만 제거).
- Produces: `dropDeadRules(fileAbs, deadSelectors: Set<string>): string`.

- [ ] **Step 1: 실패하는 테스트**

`test/cssDropDead.test.ts`
```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { dropDeadRules } from "../scripts/css-drop-dead.mjs";

const ROOT = resolve(process.cwd(), "test/fixtures/css-surfaces/gate/styles");

describe("css-drop-dead", () => {
  it("죽은 선택자의 규칙을 지우고 산 규칙은 남긴다", () => {
    const out = dropDeadRules(resolve(ROOT, "alpha/a.css"), new Set([".al-ghost"]));
    expect(out).not.toContain(".al-ghost");
    expect(out).toContain(".al-card");
    expect(out).toContain(".al-card .bt-row");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/cssDropDead.test.ts` FAIL.

- [ ] **Step 3: 구현**

`scripts/css-drop-dead.mjs`
```js
// R5(CSS→TS 죽은 선택자) 규칙을 지운다. 스펙 §3.4 3단계.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { runSurfaceChecks } from "./check-css-surfaces.mjs";

const norm = (s) => s.replace(/\s+/g, " ").trim();

export function dropDeadRules(fileAbs, deadSelectors) {
  const root = postcss.parse(fs.readFileSync(fileAbs, "utf8"), { from: fileAbs });
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") return;
    const keep = rule.selectors.filter((s) => !deadSelectors.has(norm(s)));
    if (keep.length === 0) rule.remove();
    else if (keep.length !== rule.selectors.length) rule.selectors = keep;
  });
  root.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0 && a.name !== "import" && a.name !== "layer") a.remove(); });
  return root.toString();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const surface = args[args.indexOf("--surface") + 1];
  const write = args.includes("--write");
  const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
  const stylesRoot = path.resolve("src/styles");
  const entries = [path.resolve("src/styles/index.css"), ...Object.values(registry.surfaces).map((s) => path.resolve(s.entry))].filter((p, i, a) => fs.existsSync(p) && a.indexOf(p) === i);
  const { violations } = runSurfaceChecks({ stylesRoot, srcRoot: path.resolve("src"), registry, entries });
  const byFile = new Map();
  for (const v of violations) {
    if (v.rule !== "R5" || v.surface !== surface) continue;
    const sel = v.message.replace(/^죽은 선택자 /, "");
    (byFile.get(v.file) ?? byFile.set(v.file, new Set()).get(v.file)).add(norm(sel));
  }
  let n = 0;
  for (const [file, sels] of byFile) {
    n += sels.size;
    console.log(`${file}: ${sels.size} dead selectors`);
    if (write) fs.writeFileSync(path.join(stylesRoot, file), dropDeadRules(path.join(stylesRoot, file), sels));
  }
  console.log(`total dead selectors: ${n}${write ? " (written)" : " (dry run)"}`);
}
```

- [ ] **Step 4: 통과 확인** — PASS. **Step 5: 커밋**

```bash
git add scripts/css-drop-dead.mjs test/cssDropDead.test.ts
git commit -m "feat(css): 죽은 선택자 규칙을 지우는 도구를 만든다"
```

### Task 10: 이벤트 에디터 시트를 `event/` 로 이동

**Files:**
- Move: `src/styles/editor/event-editor*.css`, `event-editor*/` 디렉토리들, `storyboard.css` → `src/styles/event/`
- Modify: `src/styles/event/index.css` (경로), `scripts/css-surfaces.json` (`event.dir` 는 이미 `src/styles/event`)

- [ ] **Step 1: 이동**

```bash
cd src/styles
git mv editor/storyboard.css event/
for f in editor/event-editor*; do git mv "$f" event/; done
sed -i 's#"\.\./editor/#"./#g' event/index.css
```
Run: `node scripts/check-css-graph.mjs` → `orphan=0`. 아니면 index.css 경로 수정.

- [ ] **Step 2: 시각 동일** — `npm run shots:css` exit 0. 6종 기준선 vitest PASS (Task 7 Step 7 의 명령).

- [ ] **Step 3: 커밋**

```bash
git add -A src/styles
git commit -m "refactor(css): 이벤트 에디터 시트를 event/ 표면 디렉토리로 옮긴다"
```

### Task 11: 이벤트 에디터 가려진 선언·죽은 규칙 제거

**Files:**
- Modify: `src/styles/event/**/*.css` (도구가 편집)

- [ ] **Step 1: 드라이런**

Run: `node scripts/css-prune-shadowed.mjs --surface event`
Expected: 파일별 개수. 2026-09-11 인덱스 기준으로 legacy/part-*/modern/mockup 에서 수백 건.
Run: `node scripts/css-drop-dead.mjs --surface event`
Expected: 파일별 개수(리뷰 기준 event 범위 약 60 규칙).

- [ ] **Step 2: 적용**

Run: `node scripts/css-prune-shadowed.mjs --surface event --write && node scripts/css-drop-dead.mjs --surface event --write`

- [ ] **Step 3: 검증**

Run: `npm run shots:css` → exit 0. 6종 기준선 vitest PASS.
실패하면 원인은 둘 중 하나다. (a) 가림 판정이 틀린 경우 — 두 선언의 `at`/`layer` 가 같지만 특이도가 다른 선택자를 같은 `sel` 로 본 것은 아니므로 `findShadowed` 의 키에 문제는 없다. 실패 스크린샷의 diff 영역에서 선택자를 찾아 `git diff` 로 그 선택자의 삭제된 선언을 되살리고, 왜 가려지지 않았는지(대개 `:root` 별칭 변수의 정의 순서) 주석으로 남긴다. (b) R5 오탐 — 동적 클래스. `css-surfaces.json` 의 `event.prefixes` 에 그 접두어를 추가하고 `git checkout` 으로 그 파일만 되살려 재실행.

- [ ] **Step 4: 빈 파일 정리**

Run: `for f in $(find src/styles/event -name '*.css'); do [ "$(grep -cv '^\s*$\|^\s*/\*\|^\s*\*' $f)" -eq 0 ] && echo EMPTY $f; done`
빈 파일은 `git rm` 하고 `event/index.css` 에서 그 줄을 지운다.

- [ ] **Step 5: 커밋**

```bash
git add -A src/styles/event scripts/css-surfaces.json
git commit -m "refactor(css): 이벤트 에디터의 가려진 선언과 죽은 규칙을 지운다"
```

### Task 12: 이벤트 에디터 `!important` 해체

**Files:**
- Modify: `src/styles/event/**/*.css`, `src/styles/overrides.css`

- [ ] **Step 1: 목록**

Run: `grep -rn "!important" src/styles/event | wc -l && grep -rn "!important" src/styles/event`
Expected: Task 11 이후 남은 개수(리뷰 기준 63 중 event 몫 ≈ 40, 가림 제거 후 더 적음).

- [ ] **Step 2: 항목별 판정**

각 `!important` 선언에 대해 `node scripts/css-flatten.mjs | node -e '...'` 로 같은 `lastCompound`·`prop` 의 다른 선언을 찍어 본다(Task 6 스크립트의 `byKey` 부분을 재사용):
```bash
node -e '
import("./scripts/css-flatten.mjs").then(({flattenImports,indexDeclarations,lastCompound})=>{
 const path=require("path"); const root=path.resolve("src/styles");
 const decls=indexDeclarations(flattenImports(path.resolve("src/styles/index.css")).concat(flattenImports(path.resolve("src/styles/event/index.css"))),root);
 const target=process.argv[1], prop=process.argv[2];
 for(const d of decls) if(lastCompound(d.sel)===target&&d.prop===prop) console.log(`${d.file}:${d.line} [${d.layer}] ${d.sel} = ${d.value}${d.imp?" !important":""} ${d.at}`);
});' -- ".event-editor-workbench" "grid-template-columns"
```
판정:
- 같은 표면 안에서만 경쟁 → 뒤 선언만 남기고 플래그 제거. 앞 선언(다른 파일)은 삭제.
- 다른 표면(`components`·`shell`·`database`)의 선언을 이기려는 것 → 레이어 순서로 `event` 가 이미 그 위라면 플래그만 제거. `database` 위를 이겨야 하면 `overrides.css` 로 이동(이유·만기).
- 브라우저 기본값·인라인 스타일을 이기려는 것(예: `[hidden] { display:none !important }`) → 유지하되 `overrides.css` 로 이동.

- [ ] **Step 3: 검증** — `npm run shots:css` exit 0, 6종 기준선 PASS, `grep -rn "!important" src/styles/event | wc -l` = 0.

- [ ] **Step 4: 커밋**

```bash
git add -A src/styles
git commit -m "refactor(css): 이벤트 에디터의 !important 를 레이어 순서로 대체한다"
```

### Task 13: 이벤트 에디터 파일 재편성

**Files:**
- Create: `src/styles/event/shell.css`, `pages.css`, `command-list.css`, `inspector.css`, `footer.css`, `subdialogs/*.css`, `command-forms/*.css`, `previews/*.css`
- Delete: 세대 이름 파일들 (`event-editor-legacy.part-*.css`, `event-editor.part-*.css`, `event-editor.modern/*`, `event-editor.modernize.css`, `event-editor.mockup.css`, `event-editor.balanced.css`, `event-editor.windowing.css`, `event-editor.blocks.css`, `event-editor.p1-*.css`, `event-editor.custom-select.css`, `event-editor.shop.css`, `event-editor.commerce.css`, `event-editor-rich-forms/*`, `event-editor.command-preview/*`, `event-editor.part-3/*`, `event-editor-ai.css`, `event-editor-help.css`, `event-editor-follower-preset.css`, `storyboard.css`, `event-editor.css` 잔여)
- Modify: `src/styles/event/index.css`

이 작업은 **순서 보존 이동**이다. 규칙의 상대 순서는 유지하되 파일만 바꾼다. Task 11·12 이후에는 같은 (선택자, 속성, 조건) 이 두 파일에 없으므로 파일 간 순서는 승자에 영향이 없고, 파일 안 순서만 지키면 된다.

- [ ] **Step 1: 분류 스크립트**

```bash
node -e '
import("./scripts/css-flatten.mjs").then(({flattenImports,indexDeclarations})=>{
 const fs=require("fs"),path=require("path"),postcss=require("postcss");
 const root=path.resolve("src/styles");
 const order=flattenImports(path.resolve("src/styles/event/index.css")).filter(o=>o.copy===1&&o.depth>=1);
 const bucket=(sel)=>{
  if(/subdialog|command-picker|graphic-dialog|move-route|transfer-player|character-id-picker|field-monster/.test(sel)) return "subdialogs/dialogs.css";
  if(/^\.ecp-|command-preview|face-crop|screen-effect|charset-frame/.test(sel)) return "previews/command-preview.css";
  if(/rich-|m2-|page3-|schema-|shop-|storage-chest|change-|party-member|actor-m2|cream-command|input-number|play-audio|record-browser|move-route-editor|coordinate-move/.test(sel)) return "command-forms/forms.css";
  if(/event-page-tab|\.pages\b|pagebar|event-page-/.test(sel)) return "pages.css";
  if(/cmd-list|cmd-line|cmd-empty|event-contents-fieldset|event-command-toolbar|event-storyboard|event-view-toggle|blk-/.test(sel)) return "command-list.css";
  if(/inspector|event-command-edit|command-tools-popover/.test(sel)) return "inspector.css";
  if(/modal-footer|footer-button|footer-more|draft-validation|window-restore|resize-handle/.test(sel)) return "footer.css";
  return "shell.css";
 };
 const out=new Map();
 for(const o of order){ const ast=postcss.parse(fs.readFileSync(o.file,"utf8"),{from:o.file});
  ast.each(node=>{ if(node.type==="atrule"&&node.name==="import")return; if(node.type==="comment")return;
   const sel=node.type==="rule"?node.selector:(node.nodes?.find(n=>n.type==="rule")?.selector??"");
   const b=bucket(sel.replace(/\s+/g," "));
   (out.get(b)??out.set(b,[]).get(b)).push(node.toString()); });
 }
 for(const [b,chunks] of out){ const p=path.join(root,"event",b); fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,`/* event 표면 — ${b}. 규칙 순서는 2026-09 세대 접기 전 유효 순서를 보존한다. */\n\n`+chunks.join("\n\n")+"\n"); console.log(b,chunks.length); }
});'
```
`event/index.css` 를 새 파일 8종(+하위)만 가리키게 다시 쓴다: 순서 `shell.css, pages.css, command-list.css, inspector.css, footer.css, subdialogs/dialogs.css, command-forms/forms.css, previews/command-preview.css`, 전부 `layer(event)`. 옛 파일은 `git rm`.

- [ ] **Step 2: 1,000줄 상한 분할**

Run: `wc -l src/styles/event/**/*.css src/styles/event/*.css | sort -rn | head`
1,000줄을 넘는 파일은 내용 경계(주석 헤더)에서 `-2.css` 로 잘라 index.css 에 연속으로 등록한다.

- [ ] **Step 3: 검증**

`npm run shots:css` exit 0. 6종 기준선 PASS. `node scripts/check-css-graph.mjs` orphan=0.
**분류가 승자를 바꿀 수 있는 유일한 경우**는 같은 (선택자,속성,조건)이 두 버킷에 남은 경우인데 Task 11 이 제거했다. 그래도 실패하면 `node scripts/css-prune-shadowed.mjs --surface event` 를 다시 돌려 남은 쌍을 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add -A src/styles/event
git commit -m "refactor(css): 이벤트 에디터 시트를 세대가 아니라 구성 요소로 묶는다"
```

### Task 14: `event` 표면 게이트 승격 + PR

- [ ] **Step 1: 레지스트리 접두어 확정**

Run: `node scripts/check-css-surfaces.mjs 2>&1 | grep "R2 \[event\]" | sed 's/.*표면 밖 클래스 \.\([a-zA-Z0-9-]*\).*/\1/' | sort | uniq -c | sort -rn | head -40`
나온 클래스 중 이벤트 에디터가 진짜 소유하는 것은 `css-surfaces.json` 의 `event.prefixes` 에 추가한다. `components` 것(`.btn`, `.field`)은 `components.prefixes` 에. 다른 표면 것(`.database-*`)은 그 규칙을 `overrides.css` 로 옮기거나 지운다.

- [ ] **Step 2: 기준선 재저장 후 승격**

Run: `node scripts/check-css-surfaces.mjs --baseline` — 그 다음 `scripts/css-surfaces.baseline.json` 을 열어 `known` 에서 `|event/` 가 들어간 지문을 전부 지우고, `counts.event.important` 를 `0` 으로 고정한다(수동 편집, `event` 표면은 부채 0 으로 시작).
Run: `node scripts/check-css-surfaces.mjs --enforce all` → exit 0.

- [ ] **Step 3: 커밋 + PR**

```bash
git add scripts/css-surfaces.json scripts/css-surfaces.baseline.json
git commit -m "chore(css): event 표면의 R2·R3·R5 를 실패로 승격한다"
git push -u origin css/2-event
gh pr create --title "css: 표면 격리 2단계 — 이벤트 에디터 7세대를 한 세대로" --body "$(cat <<'EOF'
스펙 §4 2단계. event/ 로 이동, 가려진 선언·죽은 규칙 제거, !important 0, 구성 요소 기준 재편성, R2/R3/R5 승격.
검증: shots:css 동일, eventEditor*Surface 6종 PASS, check-css-surfaces --enforce all.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 3단계 — 셸·맵 접기

### Task 15: `editor/` 잔여를 `map/`·`shell/dialogs/` 로 이동, `editor/` 삭제

**Files:**
- Move: `src/styles/editor/{ai-settings-modal,help-modal,audio-test-dialog,cluster-ai-modal,local-diagnostics}.css` → `src/styles/shell/dialogs/`
- Move: `src/styles/editor/*.css` 나머지 → `src/styles/map/`
- Modify: `src/styles/map/index.css`, `src/styles/shell/index.css` (경로)

- [ ] **Step 1: 이동**

```bash
cd src/styles && mkdir -p shell/dialogs
for f in ai-settings-modal help-modal audio-test-dialog cluster-ai-modal local-diagnostics; do git mv editor/$f.css shell/dialogs/; done
for f in editor/*.css; do git mv "$f" map/; done
rmdir editor
sed -i 's#"\.\./editor/#"./#g' map/index.css
sed -i 's#"\.\./editor/\(ai-settings-modal\|help-modal\|audio-test-dialog\|cluster-ai-modal\|local-diagnostics\)\.css"#"./dialogs/\1.css"#g' shell/index.css
```
Run: `node scripts/check-css-graph.mjs` orphan=0; `npm run shots:css` exit 0.

- [ ] **Step 2: 커밋**

```bash
git add -A src/styles && git commit -m "refactor(css): editor/ 를 map/ 과 shell/dialogs/ 로 나누고 없앤다"
```

### Task 16: `map`·`shell` 가려진 선언·죽은 규칙·`!important` 제거

Task 11·12 와 같은 절차를 표면 이름만 바꿔 두 번 수행한다.

- [ ] **Step 1: map**

```bash
node scripts/css-prune-shadowed.mjs --surface map && node scripts/css-drop-dead.mjs --surface map
node scripts/css-prune-shadowed.mjs --surface map --write && node scripts/css-drop-dead.mjs --surface map --write
npm run shots:css
```
실패 시 Task 11 Step 3 의 (a)/(b) 절차. 2026-09-11 리뷰의 죽은 규칙 다수가 여기 있다: `tile-palette-clusters.css`(61% 죽음), `responsive-a.css`(`@media` 0개), `left-sidebar.modern.css` 의 `palette-inline-*`. `responsive-a.css` 가 비면 삭제한다.

- [ ] **Step 2: shell**

```bash
node scripts/css-prune-shadowed.mjs --surface shell --write && node scripts/css-drop-dead.mjs --surface shell --write
npm run shots:css
```
`shell-density.part-1.css` 의 `chipset-band-*`·`palette-collapsible`, `figma-editor/03·07·08·09` 의 `stamp-button`·`palette-option-*` 가 주 대상.

- [ ] **Step 3: `!important`**

`grep -rn "!important" src/styles/map src/styles/shell` 각 항목을 Task 12 Step 2 판정으로 처리. `shell/editor-ui-modes.css` 의 초보 모드 `padding:0 !important` 는 같은 표면(`shell`)이 `map` 의 `left-sidebar.modern.css` 를 이기려는 것이다 — 레이어 순서가 `shell < map` 이므로 플래그를 빼면 진다. 이 경우 **규칙을 `map/left-sidebar.modern.css` 로 옮긴다**(초보 모드 패딩은 사이드바의 속성이다). `body.editor-ui-beginner` 는 `map.roots` 에 추가.

- [ ] **Step 4: 검증·커밋**

`npm run shots:css` exit 0(초보 모드 스크린샷 포함). `grep -rn "!important" src/styles/map src/styles/shell | wc -l` = 0.
```bash
git add -A src/styles scripts/css-surfaces.json
git commit -m "refactor(css): 셸·맵 표면의 가려진 선언·죽은 규칙·!important 를 지운다"
```

### Task 17: `map`·`shell` 재편성 + 게이트 승격 + PR

- [ ] **Step 1: 재편성**

Task 13 Step 1 의 스크립트를 `map` 에 대해 버킷 함수만 바꿔 실행한다:
```js
const bucket=(sel)=>{
  if(/region-task|region-size|selection-action|inline-assist/.test(sel)) return "region-task.css";
  if(/world-|village-info/.test(sel)) return "world-panel.css";
  if(/map-props|map-history|map-event-search|map-location/.test(sel)) return "map-dialogs.css";
  if(/harness-|structure-kit|build-palette|ghost-|ai-ghost|ai-activity|agent-/.test(sel)) return "authoring-assist.css";
  if(/chipset-|tile-|palette-|brush-|quick-tile|cluster/.test(sel)) return "palette.css";
  if(/canvas-|runtime-overlay|runtime-debug|event-marker-tooltip|statusbar/.test(sel)) return "canvas.css";
  return "panel.css";
};
```
`shell` 은 파일 수가 적어(`figma-editor/01..11`, `shell-density.part-1/2`, `editor-ui-modes`, `studio-bar.modern`, `editor-welcome`, `dialogs/*`) 재편성하지 않고 `figma-editor/NN-` 번호 접두어만 뗀다(`git mv 01-shell-topbar-team.css topbar-team.css` 식). `shell-density.part-1/2` 는 `density.css` 하나로 합친다(순서: part-1, part-2).

- [ ] **Step 2: 1,000줄 상한** — Task 13 Step 2 와 같다.

- [ ] **Step 3: 검증** — `npm run shots:css` exit 0, `check-css-graph` orphan=0.

- [ ] **Step 4: 승격**

Task 14 Step 1·2 를 `map`, `shell` 에 대해 수행(접두어 확정, 기준선의 `|map/`·`|shell/` 지문 삭제, `counts.map.important`·`counts.shell.important` = 0). 열어 둔 결정(스펙 §7): 접두어 확정 중 `map`↔`shell` R2 위반이 20건을 넘으면 두 표면을 `shell` 하나로 합친다 — 그 경우 `map/index.css` 내용을 `shell/index.css` 뒤에 붙이고 `layer(shell)` 로 바꾸고 `map` 을 레지스트리·레이어 선언에서 지운다. 결정 내용을 스펙 §7 에 기록한다.

- [ ] **Step 5: 커밋 + PR**

```bash
git add -A src/styles scripts docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md
git commit -m "refactor(css): 셸·맵 표면을 재편성하고 게이트를 승격한다"
git push -u origin css/3-shell-map
gh pr create --title "css: 표면 격리 3단계 — 셸·맵, editor/ 소멸" --body "$(cat <<'EOF'
스펙 §4 3단계. editor/ 삭제, map/·shell/dialogs/ 로 이동, 죽은 규칙·!important 0, 재편성, R2/R3/R5 승격.
검증: shots:css 동일(초보 모드 포함), check-css-surfaces --enforce all.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 4단계 — DB 접기 (PR 4개)

DB 는 41k 줄, `!important` 315, `.database-modal-window` 를 34개 파일이 건드린다. 실질 기준은 `studio-v2.css` + `modern/*`. 네 PR 은 같은 절차(이동 없음 → 가림·죽음 제거 → `!important` 해체 → 재편성 → 승격)를 파일 부분집합에 적용한다. `css-prune-shadowed`·`css-drop-dead` 는 표면 단위로 동작하므로 부분집합 제한은 `--files <glob>` 옵션을 추가해 쓴다.

### Task 18: 도구에 `--files` 옵션

**Files:**
- Modify: `scripts/css-prune-shadowed.mjs`, `scripts/css-drop-dead.mjs` (CLI 부분)
- Test: `test/cssPruneShadowed.test.ts` 에 케이스 추가

- [ ] **Step 1: 테스트 추가**

```ts
import { filterByGlob } from "../scripts/css-prune-shadowed.mjs";
it("--files 글롭으로 대상 파일을 제한한다", () => {
  expect(filterByGlob(["a.css", "sub/b.css", "sub/deep/c.css"], "sub/*.css")).toEqual(["sub/b.css"]);
  expect(filterByGlob(["a.css", "sub/b.css", "sub/deep/c.css"], "sub/**")).toEqual(["sub/b.css", "sub/deep/c.css"]);
});
```

- [ ] **Step 2: 구현**

두 스크립트에 공통 함수(prune 에 정의, drop 이 import):
```js
export function filterByGlob(files, glob) {
  if (!glob) return files;
  const re = new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, ".*") + "$");
  return files.filter((f) => re.test(f));
}
```
CLI 에서 `const glob = args.includes("--files") ? args[args.indexOf("--files") + 1] : null;` 를 읽어 `byFile` 순회 전에 `filterByGlob([...byFile.keys()], glob)` 에 없는 파일을 건너뛴다. 가림 판정(`findShadowed`) 자체는 표면 전체로 계산해야 한다(뒤 선언이 다른 파일에 있을 수 있다) — 필터는 **쓰기 대상**만 제한한다.

- [ ] **Step 3: PASS 확인 후 커밋**

```bash
git add scripts/css-prune-shadowed.mjs scripts/css-drop-dead.mjs test/cssPruneShadowed.test.ts
git commit -m "feat(css): 정리 도구에 --files 글롭을 붙여 DB 를 부분집합으로 다룬다"
```

### Task 19 (4a): DB 셸·레일·목록 — `studio-v2` 기준으로 `light-theme`·`studio-theme`·`workspace-modern`·`desktop`·`sidebar`·`dock` 흡수

**Files:**
- Modify: `src/styles/database/{core.part-*,tabs-a.part-*,desktop,desktop-record-shell/*,light-theme,studio-theme,workspace-modern,sidebar,dock,record-list-modern,modern-controls,virtual-list,studio-v2}.css`
- Modify: `src/styles/overrides.css` (마을 정보 예외 만기 → 삭제)

- [ ] **Step 1: 가림·죽음 제거 (셸 파일 집합)**

```bash
G='database/{core.part-*,tabs-a.part-*,desktop,light-theme,studio-theme,workspace-modern,sidebar,dock,record-list-modern,modern-controls,virtual-list,studio-v2}.css'
node scripts/css-prune-shadowed.mjs --surface database --files "database/*.css"
node scripts/css-prune-shadowed.mjs --surface database --files "database/*.css" --write
node scripts/css-drop-dead.mjs --surface database --files "database/*.css" --write
node scripts/css-prune-shadowed.mjs --surface database --files "database/desktop-record-shell/*.css" --write
npm run shots:css
```
`database/*.css` 는 최상위 파일만이라 `modern/`·`tabs-b-assistant-panel/`·`spatial-*` 하위는 건드리지 않는다(`spatial-*.css` 는 최상위에 있으므로 이번에 같이 처리된다 — 4d 와 겹치지만 무해하다).

- [ ] **Step 2: `!important` 해체 (studio-theme 88, sidebar 40, dock 11)**

Task 12 Step 2 판정. `studio-theme.css:276` 의 `display:flex !important` 는 같은 표면 안 경쟁이면 플래그 제거. 제거 후 `overrides.css` 의 마을 정보 항목(만기 4a)을 지우고, `map/world-panel.css`(village-info 이관분)의 `.village-info-window` 규칙에서 `!important` 를 뺀다 — `map` 레이어가 `database` 보다 **낮으므로** 이 규칙은 진다. 따라서 마을 정보 창은 `database` 표면이 소유해야 맞다: `village-info.css` 의 창·본문 규칙을 `database/village-info.css` 로 옮기고 `village-info` 접두어를 `database.prefixes` 로 이동한다. 스펙 §3.1 배정표에 이 변경을 기록한다.

- [ ] **Step 3: 검증·커밋·PR**

`npm run shots:css` exit 0(DB 37장). `grep -rn "!important" src/styles/database/*.css | wc -l` = 0.
```bash
git add -A src/styles scripts docs && git commit -m "refactor(css): DB 셸·레일·목록을 studio-v2 한 세대로 접는다"
git push -u origin css/4a-db-shell && gh pr create --title "css: 표면 격리 4a — DB 셸·레일·목록" --body "스펙 §4 4a. 검증: shots:css DB 37장 동일.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Task 20 (4b): DB `modern/*` 탭

- [ ] **Step 1**
```bash
node scripts/css-prune-shadowed.mjs --surface database --files "database/modern/**" --write
node scripts/css-drop-dead.mjs --surface database --files "database/modern/**" --write
npm run shots:css
```
- [ ] **Step 2: `!important`** — `spatial-collections.css` 125 건은 여기(`modern/` 아님, 최상위)가 아니라 4d. `modern/*` 의 잔여를 Task 12 판정으로 0 으로.
- [ ] **Step 3: 재편성** — `modern/*.css` 는 이미 탭 단위 파일이라 재편성 없음. 1,000줄 초과 파일(`modern/troops.css` 549 선언 등)만 확인.
- [ ] **Step 4: 검증·커밋·PR**
```bash
git add -A src/styles && git commit -m "refactor(css): DB 탭별 modern 시트의 가림·죽음·!important 를 지운다"
git push -u origin css/4b-db-modern && gh pr create --title "css: 표면 격리 4b — DB modern/* 탭" --body "스펙 §4 4b. 검증: shots:css DB 37장 동일.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Task 21 (4c): DB 조수 패널 (`tabs-b-assistant-panel/*`, `assistant-*.css`, `ai-bar.css`)

- [ ] **Step 1**
```bash
node scripts/css-prune-shadowed.mjs --surface database --files "database/tabs-b-assistant-panel/**" --write
node scripts/css-prune-shadowed.mjs --surface database --files "database/assistant-*.css" --write
node scripts/css-drop-dead.mjs --surface database --files "database/tabs-b-assistant-panel/**" --write
npm run shots:css
```
조수 패널은 DB 모달 밖(`body.ai-*` 루트)에서도 뜬다. 픽셀 기준선에 조수 패널 열린 화면이 없으므로 **이 PR 에서 기준선 1장을 추가**한다: `css-surface-shots.spec.ts` 의 `database tabs` 테스트 끝에 `page.getByTestId("database-dock-toggle").click(); await settle(page); await expect(page).toHaveScreenshot("db-assistant-dock.png");` 를 넣고 `npm run shots:css:update` 로 **정리 전 트리에서 먼저 찍는다**(순서: 기준선 커밋 → 정리 커밋).
- [ ] **Step 2: `!important`** — `09-ux-polish-density.css` 21건 등을 판정. `body.ai-*` 루트로 셸(`.ai-command-bar` 위치)을 건드리는 규칙 중 `shell` 표면과 겹치는 것은 `overrides.css` 가 아니라 **조수 패널이 소유**한다(`database.roots` 에 이미 `body.ai-*` 가 있다).
- [ ] **Step 3: 검증·커밋·PR**
```bash
git add -A src/styles test/e2e && git commit -m "refactor(css): DB 조수 패널 시트의 가림·죽음·!important 를 지운다"
git push -u origin css/4c-db-assistant && gh pr create --title "css: 표면 격리 4c — DB 조수 패널" --body "스펙 §4 4c. 검증: shots:css 동일 + 조수 도크 기준선 1장 추가(정리 전 촬영).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

### Task 22 (4d): DB 공간 (`spatial-*.css`, `desktop-record-shell/12-spatial-authoring.css`, `modern/spatial-collections.css`)

- [ ] **Step 1**
```bash
node scripts/css-prune-shadowed.mjs --surface database --files "database/spatial-*.css" --write
node scripts/css-prune-shadowed.mjs --surface database --files "database/modern/spatial-collections.css" --write
node scripts/css-drop-dead.mjs --surface database --files "database/spatial-*.css" --write
npm run shots:css
```
- [ ] **Step 2: `!important` 125건 (`modern/spatial-collections.css`)** — 대부분 `.database-modal-backdrop .database-modal-window .database-modal-body …` 의 긴 선택자로 특이도 경쟁을 하는 것이다. 판정 절차는 같지만, 뒤 선언만 남기면서 **선택자도 짧게** 줄인다(`.db-spatial-*` 로 시작하도록). 짧은 선택자가 다른 규칙에 지면 그 다른 규칙이 가려진 선언이었어야 하므로 Task 19–21 을 거친 뒤에는 남아 있지 않다.
- [ ] **Step 3: 재편성** — `spatial-shell.css`, `spatial-spaces.css`, `spatial-places.css`, `spatial-geography.css`, `modern/spatial-collections.css` 를 `database/spatial/` 디렉토리로 `git mv` 하고 index.css 경로 수정.
- [ ] **Step 4: 승격 + PR**

Task 14 Step 1·2 를 `database` 에 대해 수행(접두어 확정, `|database/` 지문 삭제, `counts.database.important = 0`).
```bash
git add -A src/styles scripts && git commit -m "refactor(css): DB 공간 시트를 접고 database 표면 게이트를 승격한다"
git push -u origin css/4d-db-spatial && gh pr create --title "css: 표면 격리 4d — DB 공간, database 표면 승격" --body "스펙 §4 4d. !important 315→0, R2/R3/R5 승격. 검증: shots:css 동일.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## 5단계 — 마감

### Task 23: 옛 게이트 제거, R6 승격, 스펙 수치 갱신

**Files:**
- Delete: `scripts/check-css-live-classes.mjs`, `scripts/check-dead-css-classes.mjs`, `scripts/dead-css-baseline.json`, `scripts/measure-css-deletable.mjs`, `scripts/css-important-pairs.mjs`
- Modify: `scripts/check-css-graph.mjs` (허브 깊이 검사만 남김 — 검사 2·3 은 `check-css-surfaces` 가 대체), `package.json`, `scripts/verify-gates.mjs`(css 단계 명령), `docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md` §5

- [ ] **Step 1: `overrides.css` 만기 검토**

`grep -n "만기" src/styles/overrides.css` — 만기가 지난 항목은 지우고 `npm run shots:css` 로 확인. 남는 항목 ≤ 10.

- [ ] **Step 2: R6 승격**

`grep -rn "뒤에 와야\|뒤에 읽\|마지막 발언자\|재배열 금지\|must come after\|cascade order" src/styles` 의 남은 주석을 지운다(진입 시트 헤더의 "순서는 … 보존" 문구도 포함 — 이제 순서가 규칙이 아니다). `scripts/css-surfaces.baseline.json` 의 `known` 에서 `R6|` 지문을 전부 삭제. `node scripts/check-css-surfaces.mjs --enforce all` exit 0.

- [ ] **Step 3: 옛 게이트 제거**

`git rm` 위 파일들. `package.json` 에서 `gates:css:live`, `gates:dead-css`, `gates:dead-css:report`, `measure:css-deletable` 스크립트 삭제, `gates:css` 를 `node scripts/check-css-budget.mjs && node scripts/check-css-graph.mjs && node scripts/check-css-surfaces.mjs --enforce all` 로. `scripts/verify-gates.mjs` 에서 삭제된 스크립트를 부르는 줄이 있으면 같은 명령으로 교체(`grep -n "live-classes\|dead-css" scripts/verify-gates.mjs`). `check-css-live-classes` 를 참조하는 테스트 주석(`test/eventEditorShellSurface.baseline.test.ts:6-7`)은 `check-css-surfaces` 로 고친다.

- [ ] **Step 4: 스펙 §5 이후 수치**

```bash
node scripts/check-css-surfaces.mjs | tail -1
grep -rn "!important" src/styles --include=*.css | grep -v overrides.css | wc -l
node scripts/css-flatten.mjs | node -e 'const j=JSON.parse(require("fs").readFileSync(0));const f=new Set(j.decls.filter(d=>d.sel.includes(".event-editor-modal-window")).map(d=>d.file));console.log("event-editor-modal-window files",f.size);const g=new Set(j.decls.filter(d=>d.sel.includes(".database-modal-window")).map(d=>d.file));console.log("database-modal-window files",g.size)'
cat src/styles/**/*.css src/styles/*.css | wc -l
```
결과를 스펙 §5 표의 "목표" 옆 "이후" 열로 기록한다.

- [ ] **Step 5: 커밋 + PR**

```bash
git add -A scripts package.json src/styles test docs
git commit -m "chore(css): 옛 CSS 게이트를 걷어내고 R6 를 승격하며 스펙에 이후 수치를 적는다"
git push -u origin css/5-close
gh pr create --title "css: 표면 격리 5단계 — 마감" --body "스펙 §4 5단계. 옛 게이트 3종 제거, R6 승격, overrides 만기 정리, §5 이후 수치.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## 자체 검토

- **스펙 커버리지**: §3.1 표면·레이어 → Task 7·10·15·17·22; §3.2 layer() → Task 7; §3.3 R1–R6 → Task 2(구현)·7(R1 승격)·14/17/22(R2·R3·R5 승격)·23(R6 승격); §3.4 세대 접기 → Task 8·9(도구)·11–13(event)·16–17(map/shell)·19–22(DB); §3.5 하네스 → Task 3(+21 조수 1장); §3.6 TOKENS.md → Task 4; §4 단계·PR → 각 단계 마지막 Task; §5 수치 → Task 23; §6 위험(`!important` 역전) → Task 6; §7 열어 둔 결정 → Task 17 Step 4.
- **플레이스홀더**: Task 3 Step 1 과 Task 7 Step 1 은 실행 결과에 따라 갈리는 조사 단계지만, 명령과 판단 기준과 편집 형태를 적었다. "적절히" 류 표현 없음.
- **이름 일관성**: `flattenImports`/`indexDeclarations`/`lastCompound`/`specificity`(Task 1) 를 Task 2·6·8·9·12·13 이 같은 이름으로 쓴다. `runSurfaceChecks` (Task 2) 를 Task 9 가 쓴다. `findShadowed`/`pruneFile`/`filterByGlob` (Task 8·18). CLI 플래그 `--surface`/`--write`/`--files`/`--baseline`/`--enforce` 는 전 Task 동일. 스냅샷 명령 `npm run shots:css`/`shots:css:update` 동일.
