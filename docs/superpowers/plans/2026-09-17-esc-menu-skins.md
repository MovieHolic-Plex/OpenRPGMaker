# ESC 메뉴 스킨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자료집 → 시스템에서 고르는 게임 메뉴(ESC) 스킨 5종을 레지스트리·런타임·에디터에 끼운다.

**Architecture:** `system.battleUiStyle` 과 같은 골격 — `src/player/menuSkins/registry.ts` 가 스킨 메타를 소유하고, `renderPlayerStatusMenu` 가 루트 `data-menu-skin-*` 속성을 쓰고, CSS(`src/styles/runtime/statusMenuSkins.css`) 가 그 속성으로 배치·색·아이콘을 바꾼다. 첫 화면(파티 개요·허브·시트)과 격자 커서는 렌더러·컨트롤러의 작은 분기 하나씩이다. 기본 스킨 `workbench` 는 지금 DOM·CSS 그대로다.

**Tech Stack:** TypeScript(vanilla DOM, `el()`), vitest + `test/fakeDom.ts`, Playwright 런타임 QA 하네스(`scripts/lib/runtimeQaRun.mjs`), CSS `@layer runtime`.

**Spec:** `docs/superpowers/specs/2026-09-17-esc-menu-skins-design.md`

## Global Constraints

- `npm run gates` · `git stash` 금지. 검증은 `npx tsc --noEmit -p tsconfig.app.json` + `npx vitest run <파일>` + 하네스 캡처.
- CSS: 새 hex 리터럴 0 · `!important` 0 · 미정의 변수 0. 새 클래스는 전부 TS 에서 발행한다(dead/live 클래스 래칫).
- 스킨 라벨에 타사 프랜차이즈 이름 금지(`test/detsukuruBrandStrings.test.ts`).
- 커밋 메시지는 저장소 관례(`feat(runtime): 한국어 설명`) + 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 각 태스크 끝에 커밋. 화면이 바뀌는 태스크는 하네스 캡처를 `docs/2026-09-17-esc-menu-uiux-proposal-assets/after-*.png` 에 남긴다.

---

### Task 1: 메뉴 스킨 레지스트리 · 타입 · 저장 정규화

**Files:**
- Create: `src/player/menuSkins/types.ts`, `src/player/menuSkins/registry.ts`
- Modify: `src/project/types/database.ts`(SystemRecords 근처 `battleUiStyle?` 아래), `src/project/databaseRecordModel.ts`(normalizeSystemRecords 의 battleUiStyle 항목 아래)
- Test: `test/menuSkinRegistry.test.ts`

**Interfaces:**
- Produces: `MenuUiStyle`(database.ts), `MenuSkinId`·`MenuSkin`(types.ts), `MENU_SKINS`, `DEFAULT_MENU_SKIN_ID = "workbench"`, `listMenuSkinIds(): MenuSkinId[]`, `isMenuSkinId(v: unknown): v is MenuSkinId`, `resolveMenuSkinId(v: string | undefined): MenuSkinId`, `menuSkinFor(project: Project): MenuSkin`.

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/menuSkinRegistry.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_MENU_SKIN_ID, MENU_SKINS, listMenuSkinIds, menuSkinFor, resolveMenuSkinId } from "@/player/menuSkins/registry";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";

describe("menu skin registry", () => {
  it("5종을 등록하고 id 가 유일하다", () => {
    expect(listMenuSkinIds()).toEqual(["workbench", "party-first", "party-first-warm", "hub", "sheet"]);
    for (const id of listMenuSkinIds()) {
      const skin = MENU_SKINS[id];
      expect(skin.id).toBe(id);
      expect(skin.label.length).toBeGreaterThan(0);
      expect(skin.description.length).toBeGreaterThan(0);
    }
  });
  it("기본은 workbench 이고 미설정·미지값이 그리로 풀린다", () => {
    expect(DEFAULT_MENU_SKIN_ID).toBe("workbench");
    expect(resolveMenuSkinId(undefined)).toBe("workbench");
    expect(resolveMenuSkinId("no-such-skin")).toBe("workbench");
    expect(resolveMenuSkinId("hub")).toBe("hub");
    expect(menuSkinFor(createBlankProject()).landing).toBe("work");
  });
  it("workbench 는 지금 화면 그대로의 플래그를 갖는다", () => {
    expect(MENU_SKINS.workbench).toMatchObject({ landing: "work", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false, tone: "glass" });
    expect(MENU_SKINS["party-first"]).toMatchObject({ landing: "party", railStyle: "flat", railColumns: 1, sideParty: true });
    expect(MENU_SKINS["party-first-warm"].tone).toBe("warm");
    expect(MENU_SKINS.hub).toMatchObject({ landing: "hub", railStyle: "collapsed", railColumns: 3 });
    expect(MENU_SKINS.sheet).toMatchObject({ landing: "sheet", railStyle: "flat", railColumns: 2 });
  });
  it("저장 정규화는 기본·미등록을 버리고 명시 선택만 남긴다", () => {
    const base = createBlankProject().system;
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "workbench" }).menuUiStyle).toBeUndefined();
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "hub" }).menuUiStyle).toBe("hub");
    expect(normalizeSystemRecords({ ...base, menuUiStyle: "bogus" as never }).menuUiStyle).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/menuSkinRegistry.test.ts` → "Cannot find module '@/player/menuSkins/registry'".

- [ ] **Step 3: 구현**

```ts
// src/project/types/database.ts — BattleUiStyle 정의 아래
/** ESC 게임 메뉴 스킨 — @/player/menuSkins/registry 의 id union. 저장되므로 함부로 바꾸지 않는다. */
export type MenuUiStyle = "workbench" | "party-first" | "party-first-warm" | "hub" | "sheet";
// SystemRecords: battleUiStyle?: BattleUiStyle; 아래에
  /** ESC(X) 게임 메뉴 디자인. 생략 = workbench(작업대). */
  menuUiStyle?: MenuUiStyle;
```

```ts
// src/player/menuSkins/types.ts
import type { MenuUiStyle } from "@/project/types";
export type MenuSkinId = MenuUiStyle;
export type MenuSkinLanding = "work" | "party" | "hub" | "sheet";
export type MenuSkinTone = "glass" | "warm";
export type MenuSkinRailStyle = "collapsed" | "flat";
export type MenuSkin = {
  readonly id: MenuSkinId;
  /** 자료집 드롭다운에 그대로 보인다 — 생김새를 서술하고 타사 프랜차이즈 이름은 쓰지 않는다. */
  readonly label: string;
  readonly description: string;
  readonly landing: MenuSkinLanding;
  readonly tone: MenuSkinTone;
  readonly railIcons: "glyph" | "painted";
  readonly railStyle: MenuSkinRailStyle;
  /** main 모드 커서 격자 열 수. 1 이면 ↑↓ 만, 2 이상이면 ←→ 도 커서를 움직이고 → 는 진입이 아니다. */
  readonly railColumns: 1 | 2 | 3;
  /** 작업 패널 오른쪽 열에 파티 미니를 붙인다. */
  readonly sideParty: boolean;
};
```

```ts
// src/player/menuSkins/registry.ts
import type { Project } from "@/project/types";
import type { MenuSkin, MenuSkinId } from "@/player/menuSkins/types";

export const MENU_SKINS: Record<MenuSkinId, MenuSkin> = {
  workbench: { id: "workbench", label: "작업대 · 아이템 첫 화면", description: "왼쪽 명령 레일, 오른쪽 작업 패널. ESC 직후 아이템 목록이 보입니다.", landing: "work", tone: "glass", railIcons: "glyph", railStyle: "collapsed", railColumns: 1, sideParty: false },
  "party-first": { id: "party-first", label: "파티 퍼스트 · 유리", description: "ESC 직후 파티 4명의 HP·MP 가 보입니다. 컬러 아이콘 레일, 작업 패널 옆 파티 미니.", landing: "party", tone: "glass", railIcons: "painted", railStyle: "flat", railColumns: 1, sideParty: true },
  "party-first-warm": { id: "party-first-warm", label: "파티 퍼스트 · 남색과 금", description: "파티 퍼스트와 같은 배치를 남색 표면·금빛 커서로 그립니다.", landing: "party", tone: "warm", railIcons: "painted", railStyle: "flat", railColumns: 1, sideParty: true },
  hub: { id: "hub", label: "허브 타일 · 요약 6칸", description: "명령 6개를 요약이 붙은 큰 타일로, 아래에 파티 스트립.", landing: "hub", tone: "glass", railIcons: "painted", railStyle: "collapsed", railColumns: 3, sideParty: true },
  sheet: { id: "sheet", label: "사이드 시트 · 지도 노출", description: "오른쪽 시트만 뜨고 주인공과 지도가 그대로 보입니다. 파티 위, 명령 격자 아래.", landing: "sheet", tone: "glass", railIcons: "painted", railStyle: "flat", railColumns: 2, sideParty: true },
};
export const DEFAULT_MENU_SKIN_ID: MenuSkinId = "workbench";
export function listMenuSkinIds(): MenuSkinId[] { return Object.keys(MENU_SKINS) as MenuSkinId[]; }
export function isMenuSkinId(value: unknown): value is MenuSkinId { return typeof value === "string" && value in MENU_SKINS; }
export function resolveMenuSkinId(value: string | undefined): MenuSkinId { return isMenuSkinId(value) ? value : DEFAULT_MENU_SKIN_ID; }
export function menuSkinFor(project: Project): MenuSkin { return MENU_SKINS[resolveMenuSkinId(project.system.menuUiStyle)]; }
```

```ts
// src/project/databaseRecordModel.ts — battleUiStyle 항목 바로 아래
    // 기본 스킨(workbench)과 미등록 값은 저장하지 않는다. 명시 선택만 보존 — battleUiStyle 과 같은 계약.
    ...(isMenuSkinId(system.menuUiStyle) && system.menuUiStyle !== DEFAULT_MENU_SKIN_ID
      ? { menuUiStyle: system.menuUiStyle }
      : {}),
```
import: `import { DEFAULT_MENU_SKIN_ID, isMenuSkinId } from "@/player/menuSkins/registry";`

- [ ] **Step 4: 통과 확인** — `npx vitest run test/menuSkinRegistry.test.ts test/battleSkinRegistry.test.ts` PASS, `npx tsc --noEmit -p tsconfig.app.json` 0.
- [ ] **Step 5: 커밋** — `feat(runtime): ESC 메뉴 스킨 레지스트리 5종과 system.menuUiStyle 저장 계약`

---

### Task 2: 평탄 레일 모델

**Files:**
- Modify: `src/player/playerStatusMenuModel.ts`(`listStatusMenuRailIds`, `listStatusMenuGroupCommandIds`, `statusMenuRailIdForCommand`), `src/player/playerStatusMenu.ts:149`, `src/player/playerStatusMenuController.ts:275,317,553`
- Test: `test/statusMenuRailFlat.test.ts`

**Interfaces:**
- Produces: `statusMenuRailStyle(project): MenuSkinRailStyle`; `statusMenuRailIdForCommand(commandId, project?, session?)` — project·session 을 주면 평탄 규칙, 없으면 기존 접힌 규칙.

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/statusMenuRailFlat.test.ts
import { describe, expect, it } from "vitest";
import { listStatusMenuGroupCommandIds, listStatusMenuRailIds, statusMenuRailIdForCommand } from "@/player/playerStatusMenuModel";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

function flatProject() { const p = createBlankProject(); p.system.menuUiStyle = "party-first"; return p; }

describe("flat status menu rail (painted skins)", () => {
  it("행동·파티를 펼치고 임무는 그대로, 저장은 꺼내고 시스템은 접는다", () => {
    const project = flatProject();
    expect(listStatusMenuRailIds(project, startSession(project))).toEqual([
      "items", "skills", "equipment", "status", "row", "formation", "monsters", "quests", "save", "system-menu",
    ]);
  });
  it("시스템 트레이는 저장을 빼고 로드·대기·타이틀만 담는다", () => {
    const project = flatProject();
    expect(listStatusMenuGroupCommandIds("system-menu", project, startSession(project))).toEqual(["load", "wait", "to-title"]);
  });
  it("기록 명령이 둘 이상이면 「기록 ▸」 로 접는다", () => {
    const project = flatProject();
    project.system.giftSystem = true; // relationships 노출
    const session = startSession(project);
    const rail = listStatusMenuRailIds(project, session);
    expect(rail).toContain("record-menu");
    expect(rail).not.toContain("quests");
    expect(listStatusMenuGroupCommandIds("record-menu", project, session)).toEqual(["quests", "relationships"]);
  });
  it("커서 강조 대상: 펼친 명령은 자신, 접힌 명령은 그룹 항목", () => {
    const project = flatProject();
    const session = startSession(project);
    expect(statusMenuRailIdForCommand("status", project, session)).toBe("status");
    expect(statusMenuRailIdForCommand("save", project, session)).toBe("save");
    expect(statusMenuRailIdForCommand("load", project, session)).toBe("system-menu");
    expect(statusMenuRailIdForCommand("quests", project, session)).toBe("quests");
  });
  it("기본 스킨은 접힌 레일 6항목 그대로", () => {
    const project = createBlankProject();
    expect(listStatusMenuRailIds(project, startSession(project))).toEqual(["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]);
    expect(statusMenuRailIdForCommand("status", project, startSession(project))).toBe("party-menu");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/statusMenuRailFlat.test.ts` → 첫 케이스가 접힌 6항목을 내며 FAIL.
- [ ] **Step 3: 구현**

```ts
// playerStatusMenuModel.ts
import { menuSkinFor } from "@/player/menuSkins/registry";
import type { MenuSkinRailStyle } from "@/player/menuSkins/types";

export function statusMenuRailStyle(project: Project): MenuSkinRailStyle { return menuSkinFor(project).railStyle; }

/** 평탄 레일 — 행동 3 + 파티 4 + 기록(하나면 그대로, 둘 이상이면 접기) + 저장 + 시스템 ▸. 최대 10항목. */
function flatRailIds(visible: readonly StatusMenuCommandId[]): StatusMenuRailId[] {
  const recordCount = visible.filter((id) => commandGroupIdOf(id) === "record").length;
  const out: StatusMenuRailId[] = [];
  for (const id of visible) {
    const group = commandGroupIdOf(id);
    if (group === "action" || group === "party") out.push(id);
    else if (group === "record") { if (recordCount === 1) out.push(id); else if (!out.includes("record-menu")) out.push("record-menu"); }
    else if (id === "save") out.push(id);
    else if (!out.includes("system-menu")) out.push("system-menu");
  }
  return out;
}
// listStatusMenuRailIds 맨 앞:
  if (statusMenuRailStyle(project) === "flat") return flatRailIds(listStatusMenuCommandIds(project, session));
// listStatusMenuGroupCommandIds 반환 직전 filter 에 추가:
    .filter((id) => !(statusMenuRailStyle(project) === "flat" && id === "save"));
// statusMenuRailIdForCommand:
export function statusMenuRailIdForCommand(commandId: StatusMenuRailId, project?: Project, session?: PlaySession): StatusMenuRailId {
  if (isStatusMenuGroupEntryId(commandId)) return commandId;
  const groupId = commandGroupIdOf(commandId);
  if (project && session && statusMenuRailStyle(project) === "flat") {
    if (listStatusMenuRailIds(project, session).includes(commandId)) return commandId;
    return groupId === "record" ? "record-menu" : groupId === "system" ? "system-menu" : commandId;
  }
  const collapsed = COLLAPSED_GROUPS.find((candidate) => candidate.groupId === groupId);
  return collapsed ? collapsed.entryId : commandId;
}
```
호출부: `playerStatusMenu.ts:149` → `statusMenuRailIdForCommand(options.selectedCommand, options.project, options.session)`; 컨트롤러 275·553 → `statusMenuRailIdForCommand(selectedCommand, store.getCurrent(), options.getActiveScene()?.getSession())`; 317 → 같은 인자.

- [ ] **Step 4: 통과 확인** — `npx vitest run test/statusMenuRailFlat.test.ts test/playerStatusMenu.test.ts test/playerStatusMenuEdgeDock.test.ts` PASS, tsc 0.
- [ ] **Step 5: 커밋** — `feat(runtime): 컬러 아이콘 스킨용 평탄 레일 — 파티 펼침·저장 꺼냄·시스템 접기`

---

### Task 3: 스킨 속성 · 컬러 아이콘 · 파티 퍼스트 첫 화면 · 사이드 파티 · CSS

**Files:**
- Modify: `src/player/playerStatusMenu.ts`, `src/player/playerStatusMenuModel.ts`(`PlayerStatusMenuPartyRow` 에 `className`·`level`), `src/player/playerStatusMenuDetailRenderer.ts`(`side` 옵션), `src/player/runtimeAssets.json`, `src/styles/runtime/index.css`
- Create: `src/styles/runtime/statusMenuSkins.css`
- Test: `test/playerStatusMenuSkins.test.ts`

**Interfaces:**
- `renderStatusMenuDetailPanel(project, detail, { selectedActionIndex, showcase, side?: HTMLElement })` — `side` 가 있으면 `.status-menu-detail-side` 열을 만들고 쇼케이스를 그 안 첫 자식으로 둔다.
- 루트 dataset: `menuSkin`, `menuSkinTone`, `menuSkinLanding`, `menuSkinIcons`, `menuSkinRail`.
- testid: `status-menu-party-overview`, `status-menu-overview-row-<i>`, `status-menu-overview-hp-<i>`, `status-menu-overview-mp-<i>`, `status-menu-side-party`, `status-menu-side-party-row-<i>`.

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/playerStatusMenuSkins.test.ts
import { describe, expect, it } from "vitest";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import type { MenuUiStyle } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions: PlayerStatusMenuActions = { /* test/playerStatusMenuEdgeDock.test.ts 와 동일한 noop 묶음 */ } as never;

function render(skin: MenuUiStyle | undefined, mode: "main" | "function" = "main", selectedCommand: "items" | "status" = "items") {
  const project = createBlankProject();
  if (skin) project.system.menuUiStyle = skin;
  return renderWithFakeDom(() => renderPlayerStatusMenu({ project, session: startSession(project), slots: [], actions: noopActions, mode, selectedCommand }));
}

describe("status menu skins", () => {
  it("기본 스킨은 workbench 속성을 달고 파티 개요·사이드 파티가 없다", () => {
    const restore = installFakeDom();
    try {
      const menu = render(undefined);
      expect(menu.getAttribute("data-menu-skin")).toBe("workbench");
      expect(menu.getAttribute("data-menu-skin-icons")).toBe("glyph");
      expect(findByTestId(menu, "status-menu-party-overview")).toBeNull();
      expect(findByTestId(menu, "status-menu-detail")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-command-icon-items")?.getAttribute("data-icon")).toBe("◇");
    } finally { restore(); }
  });
  it("party-first 는 main 모드에 파티 개요를 그리고 작업 패널을 그리지 않는다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first");
      expect(menu.getAttribute("data-menu-skin")).toBe("party-first");
      expect(menu.getAttribute("data-menu-skin-landing")).toBe("party");
      expect(menu.getAttribute("data-menu-skin-rail")).toBe("flat");
      expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-overview-row-0")?.textContent).toContain("Lv");
      expect(findByTestId(menu, "status-menu-overview-hp-0")?.getAttribute("role")).toBe("meter");
      expect(findByTestId(menu, "status-menu-detail")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-icon-items")?.getAttribute("data-icon-name")).toBe("bag");
      expect(findByTestId(menu, "status-menu-command-status")).not.toBeNull();
    } finally { restore(); }
  });
  it("party-first 는 function 모드에 작업 패널 + 사이드 파티를 그린다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first", "function");
      expect(findByTestId(menu, "status-menu-party-overview")).toBeNull();
      expect(findByTestId(menu, "status-menu-detail")).not.toBeNull();
      const side = findByTestId(menu, "status-menu-side-party");
      expect(side).not.toBeNull();
      expect(findByTestId(menu, "status-menu-side-party-row-0")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-detail")?.className).toContain("has-side");
    } finally { restore(); }
  });
  it("party-first-warm 은 톤만 warm 이다", () => {
    const restore = installFakeDom();
    try {
      const menu = render("party-first-warm");
      expect(menu.getAttribute("data-menu-skin-tone")).toBe("warm");
      expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
    } finally { restore(); }
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/playerStatusMenuSkins.test.ts` → `data-menu-skin` null 로 FAIL.
- [ ] **Step 3: 구현**

모델(`createPlayerStatusMenuSnapshot`): `PlayerStatusMenuPartyRow` 에 `readonly className: string; readonly level: number;` 추가. `className` 은 `effectiveActorClassId(project, session, actor.id)` 로 `project.database.classes` 에서 찾고 없으면 `"직업 없음"`(`@/project/sessionClass` import).

렌더러(`renderPlayerStatusMenu`):
```ts
const skin = menuSkinFor(options.project);
panel.dataset.menuSkin = skin.id; panel.dataset.menuSkinTone = skin.tone; panel.dataset.menuSkinLanding = skin.landing;
panel.dataset.menuSkinIcons = skin.railIcons; panel.dataset.menuSkinRail = skin.railStyle;
const landingOnly = mode === "main" && skin.landing !== "work";   // 첫 화면이 작업 패널이 아닌 스킨
const side = skin.sideParty && mode === "function" && detailPanel.dataset.statusMenuPresentation === "work-panel" ? renderSidePartyMini(options.project, snapshot) : undefined;
```
`renderStatusMenuDetailPanel(..., { selectedActionIndex, showcase, side })` 로 전달. `panel.append(header, sidebar, ...(landingOnly ? [renderPartyOverview(options.project, snapshot)] : [detailPanel]), ...(showParty ? [renderPartyPanel(...)] : []), footer)`.

아이콘: `statusMenuCommandIconName(id)` — items bag · skills fire · equipment sword · status cross · row next · formation shield · monsters shard · quests map · relationships world · life-ledger book-magic · save crystal · load warp-scroll · wait clock · to-title boot · party-menu cross · record-menu map · system-menu gear. 아이콘 span dataset 에 `iconName` 추가(`data-icon` 글리프는 유지).

파티 개요·사이드 파티(새 함수, 클래스는 아래 CSS 와 1:1):
```ts
function renderPartyOverview(project, snapshot): HTMLElement // section.status-menu-party-overview[data-testid=status-menu-party-overview]
//  ├ article.status-menu-overview-row.{safe|warn|crit}[data-testid=status-menu-overview-row-i]
//  │  ├ renderPartyFace(project,row,i,34)  (boxSize 인자 추가, 기본 22)
//  │  └ div.status-menu-overview-info
//  │     ├ div.status-menu-overview-head: span.status-menu-actor-name · span.status-menu-actor-subline(`${className} · Lv ${level}`) · [span.status-menu-overview-chip.crit "위험"]
//  │     ├ renderOverviewVital("HP", row.hpValueLabel, row.hpRatio, `hp ${row.hpLevel}`, `status-menu-overview-hp-${i}`)
//  │     └ renderOverviewVital("MP", row.mpValueLabel, row.mpRatio, "mp", `status-menu-overview-mp-${i}`)
//  빈 파티: div.status-menu-empty(snapshot.emptyPartyLabel)
function renderOverviewVital(label, value, ratio, variant, testId) // div.status-menu-overview-vital > span.status-menu-overview-vital-label + div.status-menu-overview-track.{variant}[role=meter aria-valuemin/max/now][data-testid] > span.status-menu-overview-fill[style=width:%] , span.status-menu-overview-value
function renderSidePartyMini(project, snapshot): HTMLElement // aside.status-menu-side-party[data-testid=status-menu-side-party] > div.status-menu-side-party-title "파티" + div.status-menu-side-party-row.{level}[data-testid=status-menu-side-party-row-i] > renderPartyFace(...,12) + div.status-menu-side-party-body > div.status-menu-side-party-head(name + span.status-menu-side-party-value hpValueLabel) + track hp + track mp (renderOverviewVital 의 track 부분만 재사용: div.status-menu-overview-track)
```
상세 패널 렌더러: `side` 옵션 → `const sideColumn = el("div", { class: "status-menu-detail-side" })`; 쇼케이스가 있으면 `sideColumn.append(showcase)`, 이어 `sideColumn.append(options.side)`, `panel.classList.add("has-side")`, `panel.append(sideColumn)`. `updateStatusMenuDetailSelection`: `const sideColumn = panel.querySelector(".status-menu-detail-side"); if (sideColumn) sideColumn.prepend(next) else panel.append(next)`; `has-showcase` 토글은 그대로.

CSS `src/styles/runtime/statusMenuSkins.css`(index.css 에서 `statusMenuEdgeDock.css` 바로 다음 줄에 `@import "./statusMenuSkins.css" layer(runtime);`):
- painted 아이콘: `.oprn-status-menu[data-menu-skin-icons="painted"] .status-menu-command-icon::before{content:""}` + `.oprn-status-menu[data-menu-skin-icons="painted"] .status-menu-command-icon{background:center/contain no-repeat}` + `[data-icon-name="bag"]{background-image:url("../../../public/assets/generated/starter/battle-icon-bag.png")}` … 17개.
- 평탄 레일 행 높이: `.oprn-status-menu[data-menu-skin-rail="flat"] .status-menu-primary-dock > .status-menu-command{flex:0 0 15px;padding:1px 4px;gap:4px}`.
- 파티 개요(`data-menu-skin-landing="party"`): `.status-menu-party-overview{position:absolute;left:88px;right:17px;top:39px;bottom:49px;display:grid;grid-template-rows:repeat(4,minmax(0,1fr));gap:3px;min-height:0}` · 행 `display:grid;grid-template-columns:34px minmax(0,1fr);gap:5px;padding:3px 5px 3px 4px;border-radius:3px;background:var(--runtime-glass-card);border:1px solid transparent` · `.crit{background:rgba(190,55,50,.16);border-color:rgba(255,127,118,.35)}` · 트랙 `height:3px;border-radius:2px;background:rgba(255,255,255,.08);position:relative` · 채움 hp `linear-gradient(90deg,rgba(63,154,103,1),rgba(106,193,142,1))` · warn `rgba(184,119,42,1)→rgba(232,169,74,1)` · crit `rgba(179,64,58,1)→rgba(255,127,118,1)` · mp `rgba(85,112,201,1)→rgba(124,151,226,1)`.
- 사이드 파티: `.status-menu-detail.has-side{grid-template-areas:"title title" "list side";grid-template-columns:minmax(0,1fr) 84px;column-gap:8px}` · `.status-menu-detail-side{grid-area:side;display:grid;gap:4px;align-content:start;min-height:0;overflow:hidden;border-left:1px solid var(--status-edge-border);padding-left:7px}` · `.status-menu-detail-side > .status-menu-detail-showcase{border-left:0;padding-left:0}` · `.status-menu-side-party{display:grid;gap:2px;font:500 6px/1.3 var(--runtime-ui-font)}` 등.
- 톤 warm: `.oprn-status-menu.main-menu[data-menu-skin-tone="warm"]{--status-edge-ivory:rgba(246,240,226,.98);--status-edge-muted:rgba(205,192,168,.86);--status-edge-amber:rgba(227,176,75,.95);--status-edge-amber-soft:rgba(227,176,75,.2);--status-edge-border:rgba(227,196,120,.45)}` + `::before{background:linear-gradient(180deg,rgba(24,30,66,.92),rgba(10,14,40,.95))}`.

`runtimeAssets.json` paths 에 `assets/cc0/jetrel/icons/crystal.png`, `assets/cc0/jetrel/icons/map.png`, `assets/cc0/jetrel/icons/clock.png` 추가(정렬 유지).

- [ ] **Step 4: 통과 확인** — `npx vitest run test/playerStatusMenuSkins.test.ts test/playerStatusMenu.test.ts test/playerStatusMenuEdgeDock.test.ts test/playerStatusMenuItemShowcase.test.ts test/playerRuntimeCss.test.ts` PASS, tsc 0.
- [ ] **Step 5: 캡처** — 하네스로 `party-first` 첫 화면·아이템·장비 캡처 → `docs/…-assets/after-party-first-{main,items,equipment}.png`. 눈으로 확인 후 어긋난 CSS 수정.
- [ ] **Step 6: 커밋** — `feat(runtime): 파티 퍼스트 메뉴 스킨 — 컬러 아이콘 레일·파티 개요 첫 화면·사이드 파티`

---

### Task 4: 격자 커서 + 허브 스킨

**Files:**
- Modify: `src/player/runtimeKeyboardMenu.ts`(`StatusMenuKeyboardState.columns?`), `src/player/playerStatusMenuController.ts`(handleKey main 분기), `src/player/playerStatusMenuModel.ts`(`statusMenuCommandSummary`), `src/player/playerStatusMenu.ts`(summary span · party strip), `src/styles/runtime/statusMenuSkins.css`
- Test: `test/runtimeKeyboardMenu.test.ts`(추가), `test/playerStatusMenuSkins.test.ts`(추가), `test/statusMenuRailFlat.test.ts`(summary 추가)

- [ ] **Step 1: 실패하는 테스트**

```ts
// test/runtimeKeyboardMenu.test.ts 에 추가
it("columns>1 이면 ←→ 도 격자를 움직이고 ↑↓ 는 열 수만큼 뛴다(토러스 래핑)", () => {
  const ids = ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"] as const;
  const base = { mode: "main" as const, commandIds: ids, columns: 3 };
  expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").selectedCommand).toBe("skills");
  expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowDown").selectedCommand).toBe("party-menu");
  expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowLeft").selectedCommand).toBe("system-menu");
  expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "party-menu" }, "ArrowDown").selectedCommand).toBe("items");
  expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").action).toBe("select");
  // 1열은 기존과 같다 — ←→ 는 none
  expect(reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main", commandIds: ids }, "ArrowRight").action).toBe("none");
});
```
```ts
// test/playerStatusMenuSkins.test.ts 에 추가
it("hub 는 main 모드에 명령 요약과 파티 스트립을 그린다", () => {
  const restore = installFakeDom();
  try {
    const menu = render("hub");
    expect(menu.getAttribute("data-menu-skin-landing")).toBe("hub");
    expect(findByTestId(menu, "status-menu-command-summary-items")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-party-strip")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-strip-card-0")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-detail")).toBeNull();
    for (const id of ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"]) expect(findByTestId(menu, `status-menu-command-${id}`)).not.toBeNull();
  } finally { restore(); }
});
```
```ts
// test/statusMenuRailFlat.test.ts 에 추가
it("허브 요약 문구", () => {
  const project = createBlankProject(); const session = startSession(project);
  expect(statusMenuCommandSummary("items", project, session, [])).toMatch(/종$/);
  expect(statusMenuCommandSummary("party-menu", project, session, [])).toContain("명");
  expect(statusMenuCommandSummary("system-menu", project, session, [])).toContain("저장");
});
```

- [ ] **Step 2: 실패 확인** — 세 파일 실행, 새 케이스 FAIL.
- [ ] **Step 3: 구현**

```ts
// runtimeKeyboardMenu.ts — StatusMenuKeyboardState 에 `readonly columns?: number;`
// reduceStatusMenuKeyboard 첫 분기 교체:
  const dir = directionForKey(key);
  const columns = Math.max(1, state.columns ?? 1);
  if (dir && (columns > 1 || dir === "up" || dir === "down")) {
    const ids = state.commandIds && state.commandIds.length > 0 ? state.commandIds : STATUS_MENU_COMMAND_IDS;
    const index = Math.max(0, ids.indexOf(state.selectedCommand));
    return { selectedCommand: ids[moveCursorIndex(index, ids.length, dir, { columns })] ?? "items", mode: state.mode, action: "select" };
  }
```
컨트롤러 main 분기 — 기존 `if (direction === "right" || isConfirmMenuKey(key))` 를 다음으로:
```ts
    const skin = menuSkinFor(store.getCurrent());
    const grid = skin.railColumns > 1;
    if ((!grid && direction === "right") || isConfirmMenuKey(key)) { …기존 진입 코드… }
    if (!grid && direction === "left") return true;
    if (isRailNavKey(key)) {
      const railKey: RuntimeMenuKey = grid ? key : (direction === "right" || direction === "down" ? "ArrowDown" : "ArrowUp");
      … reduceStatusMenuKeyboard({ selectedCommand: statusMenuRailIdForCommand(selectedCommand, store.getCurrent(), session), mode, commandIds, columns: skin.railColumns }, railKey) …
```
모델:
```ts
export function statusMenuCommandSummary(id: StatusMenuRailId, project: Project, session: PlaySession, slots: readonly SaveSlotReadResult[]): string {
  const party = session.partyActorIds.length;
  switch (id) {
    case "items": return `${Object.values(session.inventory).filter((n) => (n ?? 0) > 0).length}종`;
    case "skills": case "equipment": case "status": case "row": case "formation": return `${party}명`;
    case "monsters": return `${session.monsterParty.length}마리`;
    case "quests": return `${buildQuestLog(project, session).length}건`;
    case "save": case "load": return `${slots.filter((s) => s.kind === "present").length}/${Math.max(slots.length, 1)}칸`;
    case "wait": case "to-title": case "relationships": case "life-ledger": return "";
    case "party-menu": { const crit = createPlayerStatusMenuSnapshot(project, session).partyRows.filter((r) => r.hpLevel === "crit").length; return crit > 0 ? `위험 ${crit} · ${party}명` : `${party}명 양호`; }
    case "record-menu": return listStatusMenuGroupCommandIds("record-menu", project, session).map((c) => statusMenuCommandLabel(c, true)).join(" · ");
    case "system-menu": return listStatusMenuGroupCommandIds("system-menu", project, session).map((c) => statusMenuCommandLabel(c, true)).join(" · ");
  }
}
```
(`SaveSlotReadResult.kind` 는 `test/playerStatusMenu.test.ts` 의 empty/corrupt/present 계약을 따른다 — 실제 필드명은 `@/player/saveSlots` 에서 확인해 맞춘다.)
렌더러: `skin.landing === "hub"` 이면 각 명령 버튼에 `el("span", { class: "status-menu-command-summary", text: statusMenuCommandSummary(...), dataset: { testid: `status-menu-command-summary-${command.id}` } })` 를 라벨 뒤에 붙이고, main 모드에 `renderPartyStrip(project, snapshot)` → `section.status-menu-party-strip[data-testid=status-menu-party-strip] > div.status-menu-strip-card.{level}[data-testid=status-menu-strip-card-i] > face(24) + div.status-menu-strip-body(name + track hp + track mp + span.status-menu-strip-value "HP a/b")`.
CSS(`[data-menu-skin="hub"][data-status-menu-screen="main"]`): 레일을 `left:17px;right:17px;top:39px;height:126px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:4px;border-right:0;width:auto;padding:0;bottom:auto` 로, 버튼을 타일(`display:grid;grid-template-rows:auto 1fr auto;padding:6px 7px;border-radius:4px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.035));white-space:normal;font-size:8.5px`)로, 아이콘 18px, 요약 `font-size:6px;color:var(--status-edge-muted)`. 선택 타일 `border-color:var(--status-edge-amber);background:var(--status-edge-amber-soft)`. 스트립 `left:17px;right:17px;top:170px;bottom:49px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px`. function 모드는 기본 레일 규칙 그대로(요약 span 은 `display:none`).

- [ ] **Step 4: 통과 확인** — 위 세 파일 + `test/playerStatusMenu.test.ts` PASS, tsc 0.
- [ ] **Step 5: 캡처** — `hub` 첫 화면·아이템 → `after-hub-{main,items}.png`.
- [ ] **Step 6: 커밋** — `feat(runtime): 허브 타일 메뉴 스킨 — 3열 격자 커서·명령 요약·파티 스트립`

---

### Task 5: 사이드 시트 스킨

**Files:** Modify `src/styles/runtime/statusMenuSkins.css`(`[data-menu-skin="sheet"]`), `test/playerStatusMenuSkins.test.ts`(추가). 렌더러 변경 없음(landing `sheet` 는 `party` 와 같은 DOM).

- [ ] **Step 1: 테스트 추가**
```ts
it("sheet 는 party 와 같은 DOM 에 2열 격자 속성만 다르다", () => {
  const restore = installFakeDom();
  try {
    const menu = render("sheet");
    expect(menu.getAttribute("data-menu-skin-landing")).toBe("sheet");
    expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
    expect(findByTestId(menu, "status-menu-detail")).toBeNull();
  } finally { restore(); }
});
```
- [ ] **Step 2: 실패 확인** — `landing` 속성 비교는 Task 3 구현으로 이미 통과할 수 있다. 통과하면 그대로 두고 CSS 로 간다(렌더 계약이 같다는 뜻).
- [ ] **Step 3: CSS** — main 화면 한정 `.oprn-status-menu.main-menu[data-menu-skin="sheet"][data-status-menu-screen="main"]`: `::before{inset:6px 6px 6px 174px;box-shadow:-4px 0 14px rgba(3,5,14,.45)}` `::after{background:linear-gradient(90deg,rgba(6,8,18,.04),rgba(6,8,18,.12) 50%,rgba(6,8,18,.5))}` 헤더 `left:181px;right:13px;top:12px` · 파티 개요 `left:181px;right:13px;top:28px;height:118px;grid-template-rows:repeat(4,28px);gap:2px`(행 `grid-template-columns:22px 1fr`, 얼굴 22px 는 `background-size` 로 축소: `.status-menu-party-overview .status-menu-face{width:22px;height:22px;background-size:22px 22px}`) · 레일 `left:181px;right:13px;top:150px;bottom:30px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:13px;gap:2px;border-right:0;width:auto;padding:0` · 버튼 `font-size:6.5px;padding:0 4px;gap:3px` 아이콘 8px · 푸터 `left:181px;right:13px`. function 모드는 기본 배치.
- [ ] **Step 4: 캡처** — `sheet` 첫 화면·아이템 → `after-sheet-{main,items}.png`. 주인공이 시트 왼쪽에 보이는지 확인.
- [ ] **Step 5: 커밋** — `feat(runtime): 사이드 시트 메뉴 스킨 — 지도를 남기는 오른쪽 시트와 2열 명령 격자`

---

### Task 6: 자료집 시스템 탭 선택기 · 스튜디오 카드 · 미리보기 썸네일

**Files:**
- Modify: `src/editor/panels/databaseSystemView.ts`(display 절에 `menuSkinFieldset(project)` 추가), `src/editor/panels/databaseSystemStudio.ts`(display 카드 status), 편집기 시스템 CSS(`.db-system-` 규칙이 있는 파일에 `.db-system-menu-skin-preview` · `.db-system-menu-skin-description` 규칙)
- Create: `public/assets/ui/menu-skins/{workbench,party-first,party-first-warm,hub,sheet}.png`(하네스 캡처 320×240)
- Test: `test/databaseSystemMenuSkin.test.ts`

- [ ] **Step 1: 실패하는 테스트**
```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { listMenuSkinIds, MENU_SKINS } from "@/player/menuSkins/registry";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => { host.replaceChildren(); renderSystemTab(host as unknown as HTMLElement, rerender); };
  rerender();
  return host;
}
describe("system tab menu skin select", () => {
  let cleanup: (() => void) | undefined;
  beforeEach(() => { cleanup = installFakeDom(); store.replace(createBlankProject()); });
  afterEach(() => { cleanup?.(); cleanup = undefined; });
  it("스킨 5종을 레지스트리 순서·라벨로 내놓고 기본이 선택돼 있다", () => {
    const select = findByTestId(renderSystem(), "db-field-system-menu-ui-style");
    const options = select!.children.filter((c) => c.tagName === "OPTION");
    expect(options.map((o) => o.getAttribute("value"))).toEqual(listMenuSkinIds());
    expect(options.map((o) => o.textContent)).toEqual(listMenuSkinIds().map((id) => MENU_SKINS[id].label));
    expect(select!.value).toBe("workbench");
  });
  it("선택을 바꾸면 store 에 반영되고 기본으로 돌리면 키를 지운다", () => {
    const host = renderSystem();
    const select = findByTestId(host, "db-field-system-menu-ui-style")!;
    select.value = "hub"; select.dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.menuUiStyle).toBe("hub");
    expect(findByTestId(host, "db-system-menu-skin-preview")?.getAttribute("src")).toContain("/menu-skins/hub.png");
    select.value = "workbench"; select.dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.menuUiStyle).toBeUndefined();
  });
  it("저장된 선택으로 다시 열면 그 값이 선택돼 있다", () => {
    store.update((draft) => { draft.system.menuUiStyle = "sheet"; });
    expect(findByTestId(renderSystem(), "db-field-system-menu-ui-style")?.value).toBe("sheet");
  });
});
```
- [ ] **Step 2: 실패 확인** — select 없음으로 FAIL.
- [ ] **Step 3: 구현**
```ts
// databaseSystemView.ts
import { DEFAULT_MENU_SKIN_ID, listMenuSkinIds, MENU_SKINS, resolveMenuSkinId } from "@/player/menuSkins/registry";
export function menuSkinPreviewUrl(id: MenuSkinId): string { return `/assets/ui/menu-skins/${id}.png`; }
function menuSkinFieldset(project: Project): HTMLElement {
  const saved = resolveMenuSkinId(project.system.menuUiStyle);
  const select = el("select", { dataset: { testid: "db-field-system-menu-ui-style" } });
  for (const id of listMenuSkinIds()) select.append(el("option", { text: MENU_SKINS[id].label, attrs: { value: id, title: MENU_SKINS[id].description } }));
  select.value = saved;
  const description = el("p", { class: "db-system-menu-skin-description", text: MENU_SKINS[saved].description, dataset: { testid: "db-system-menu-skin-description" } });
  const preview = el("img", { class: "db-system-menu-skin-preview", attrs: { src: menuSkinPreviewUrl(saved), alt: `${MENU_SKINS[saved].label} 미리보기`, width: "320", height: "240", loading: "lazy" }, dataset: { testid: "db-system-menu-skin-preview" } });
  select.addEventListener("change", () => {
    const id = resolveMenuSkinId(select.value);
    updateSystem((draft) => { if (id === DEFAULT_MENU_SKIN_ID) delete draft.system.menuUiStyle; else draft.system.menuUiStyle = id; });
    description.textContent = MENU_SKINS[id].description;
    preview.setAttribute("src", menuSkinPreviewUrl(id));
    preview.setAttribute("alt", `${MENU_SKINS[id].label} 미리보기`);
  });
  return rm2k3Fieldset("게임 메뉴 디자인", [
    systemHelp("ESC(X) 로 여는 게임 메뉴의 생김새입니다. 다음 테스트 플레이부터 적용됩니다."),
    field("메뉴 디자인", select), description, preview,
  ]);
}
// display: section("display", [playResolutionFieldset(project, rerender), menuSkinFieldset(project)]),
```
스튜디오 display 카드: `status: \`${resolution.width}×${resolution.height} · 메뉴 ${MENU_SKINS[resolveMenuSkinId(project.system.menuUiStyle)].label}\``.
CSS(편집기 시스템 CSS 파일): `.db-system-menu-skin-preview{display:block;width:320px;max-width:100%;height:auto;border:1px solid var(--border-default);border-radius:var(--radius-s);background:rgba(0,0,0,1)}` `.db-system-menu-skin-description{margin:4px 0 8px;font-size:12px;color:var(--text-2)}` — 변수 이름은 그 파일이 이미 쓰는 것으로 맞춘다(미정의 변수 0).
썸네일: Task 3~5 의 캡처(1280×960)를 PIL LANCZOS 로 320×240 축소해 저장. `workbench` 는 현재 화면 캡처.
- [ ] **Step 4: 통과 확인** — `npx vitest run test/databaseSystemMenuSkin.test.ts test/battleSystemDeprecation.test.ts test/databaseSystemSections.test.ts` PASS, tsc 0.
- [ ] **Step 5: 캡처(가능하면)** — `npm run dev:worktree` 로 편집기를 띄워 시스템 탭 「게임 메뉴 디자인」 fieldset 을 Playwright 로 찍는다 → `after-editor-system-tab.png`. 프로젝트 열기가 막히면 이유를 기록하고 넘어간다.
- [ ] **Step 6: 커밋** — `feat(editor): 자료집 시스템 탭에서 게임 메뉴 디자인을 고른다 — 5종 드롭다운·설명·미리보기`

---

### Task 7: 증거 문서

- [ ] 제안서 `docs/2026-09-17-esc-menu-uiux-proposal.html` 끝에 「구현 결과」 절: 스킨별 after 캡처 + 자료집 선택 화면 + 남긴 일(상태이상 칩·EXP·사용자 CSS).
- [ ] 커밋 — `docs(runtime): ESC 메뉴 스킨 구현 결과 캡처`
