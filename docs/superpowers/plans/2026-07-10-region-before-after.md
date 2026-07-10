# 영역 작업 승인 게이트·before/after + 명령어 능력 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영역 지정 AI 작업을 "즉시 적용"에서 "before/after 비교 후 승인" 게이트로 전환하고, 의도 라우터 + 갭 도구 3종(place_chest/place_savepoint/mirror_region) + 추천 칩 + 시작 화면 카드로 명령어 처리 폭과 발견성을 확장한다.

**Architecture:** `runRegionTask`가 적용 대신 `PendingRegionApply`(전역 단일 pending 스토어)를 반환하고 고스트 프리뷰를 유지한다. PR #12의 `proposalInlineApproval` 툴바를 확장해 캔버스에서 적용/버리기/원본 보기를 제공하고, `mapScreenshot`의 draw 로직을 추출한 `renderRegionSnapshot`으로 팝오버에 before/after 썸네일을 그린다. `regionIntentRouter`가 명령 키워드로 카테고리를 감지해 도구 가이드를 동적 주입한다.

**Tech Stack:** Vanilla TS + Phaser, vitest(node env + `test/fakeDom.ts`), Playwright E2E (`test/e2e`, 포트 9173 자동 기동)

**스펙:** `docs/superpowers/specs/2026-07-10-region-before-after-and-command-breadth-design.md`
**코퍼스(라우터 테스트의 원천):** `docs/superpowers/research/2026-07-10-region-task-command-corpus.md`

## Global Constraints

- 브랜치: `feat/basic-mode-ai-ux`(PR #12) 위 스택 — Task 1 Step 0에서 `git checkout -b feat/region-before-after` 생성. main 직접 작업 금지.
- `RegionTaskOptions.gate`의 기본값은 `"approval"` — 모달·선택 칩·harness runMock 전부 승인 게이트를 탄다. 즉시 적용은 `gate: "immediate"` 명시 시에만.
- pending은 **전역 단일**: 새 영역 작업 시작(`setPendingRegionApply`)이 기존 미해소 pending을 자동 discard 한다. apply/discard는 1회만 유효(이후 no-op).
- undo 스냅샷은 **apply() 시점에만** 1개 생성 — 라벨 `영역 작업: {instruction 40자}` (현행과 동일).
- 신규 testid(정확히 이 문자열): `region-task-compare`, `region-task-before`, `region-task-after`, `region-task-apply`, `region-task-discard`, `ghost-inline-hold-origin`, `region-task-suggestions`, `region-suggest-{id}`, `ai-start-try-region`, `ai-start-recent-work`.
- 헤드리스 훅: `window.__rpgzzuRegionTaskPending = { get, apply, discard }`. Window 타입 선언은 `src/vite-env.d.ts`의 기존 `__rpgzzuRegionTaskLog` 블록 옆에 추가.
- vitest는 node 환경 + `test/fakeDom.ts`(`installFakeDom`, `findByTestId`) — **canvas 2D 컨텍스트 없음**. 썸네일 렌더는 모달에 주입 가능한 `renderSnapshot` 옵션으로 우회하고, 실 캔버스 draw는 E2E/실측으로 검증.
- 캔버스 위 불투명 팝오버/카드 배경은 `var(--editor-popover-bg, #151b2c)` — `--control-bg`는 이 테마에서 반투명이라 금지.
- 브랜치에 기존 vitest 실패 베이스라인 존재(~52건) — "신규 실패 0건" 판단은 이번 커밋이 건드린 테스트 파일 단위로 하고, 의심스러우면 부모 커밋 워크트리 대조.
- 커밋 메시지 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 주석은 한국어, 기존 파일 스타일(파일 헤더 주석 + 제약 설명 위주)을 따른다.

---

### Task 1: `pendingRegionApply` 상태 모듈

**Files:**
- Create: `src/editor/regionTask/pendingRegionApply.ts`
- Modify: `src/vite-env.d.ts` (`__rpgzzuRegionTaskLog` 선언 블록 옆)
- Test: `test/pendingRegionApply.test.ts`

**Interfaces:**
- Consumes: `Project`/`MapId` (`@/project/types`), `RegionRect` (`./clipToRegion`)
- Produces: `PendingRegionApply` 인터페이스(아래 그대로), `setPendingRegionApply(input): PendingRegionApply`, `getPendingRegionApply(): PendingRegionApply | null`, `subscribePendingRegionApply(listener): () => void`. Task 3(runRegionTask)·Task 5(모달)·Task 11(E2E)이 이 시그니처에 의존한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/pendingRegionApply.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  getPendingRegionApply,
  setPendingRegionApply,
  subscribePendingRegionApply,
  __clearPendingRegionApplyForTest,
  type PendingRegionApplyInput,
} from "@/editor/regionTask/pendingRegionApply";
import type { Project } from "@/project/types";

const fakeProject = { maps: {} } as unknown as Project;

function input(overrides: Partial<PendingRegionApplyInput> = {}): PendingRegionApplyInput {
  return {
    baseProject: fakeProject,
    clippedProject: fakeProject,
    mapId: "map_1",
    region: { x: 1, y: 2, width: 3, height: 4 },
    changedCells: 5,
    changedEvents: 1,
    instruction: "테스트",
    onApply: () => {},
    onDiscard: () => {},
    onSettle: () => {},
    ...overrides,
  };
}

describe("pendingRegionApply", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("set 후 get으로 조회되고 apply는 onApply→onSettle 순서로 1회만 부른다", () => {
    const calls: string[] = [];
    const pending = setPendingRegionApply(input({
      onApply: () => calls.push("apply"),
      onSettle: () => calls.push("settle"),
    }));
    expect(getPendingRegionApply()).toBe(pending);
    expect(pending.settled).toBe(false);
    pending.apply();
    pending.apply(); // 두 번째는 no-op
    expect(calls).toEqual(["apply", "settle"]);
    expect(pending.settled).toBe(true);
    expect(getPendingRegionApply()).toBeNull();
  });

  it("discard는 onDiscard→onSettle을 부르고 이후 apply는 no-op", () => {
    const calls: string[] = [];
    const pending = setPendingRegionApply(input({
      onApply: () => calls.push("apply"),
      onDiscard: () => calls.push("discard"),
      onSettle: () => calls.push("settle"),
    }));
    pending.discard();
    pending.apply();
    expect(calls).toEqual(["discard", "settle"]);
    expect(getPendingRegionApply()).toBeNull();
  });

  it("새 pending 설정 시 기존 미해소 pending을 자동 discard 한다", () => {
    const calls: string[] = [];
    setPendingRegionApply(input({ onDiscard: () => calls.push("old-discard") }));
    const next = setPendingRegionApply(input({ instruction: "새 작업" }));
    expect(calls).toEqual(["old-discard"]);
    expect(getPendingRegionApply()).toBe(next);
  });

  it("구독자는 set/settle 때 호출된다", () => {
    let notified = 0;
    const unsubscribe = subscribePendingRegionApply(() => { notified += 1; });
    const pending = setPendingRegionApply(input());
    pending.discard();
    unsubscribe();
    setPendingRegionApply(input());
    expect(notified).toBe(2); // set 1회 + discard(settle) 1회
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/pendingRegionApply.test.ts`
Expected: FAIL — 모듈 없음 (Cannot find module)

- [ ] **Step 3: 구현**

```ts
// src/editor/regionTask/pendingRegionApply.ts
// 영역 작업 승인 게이트의 pending 보관소 — 전역 단일. 새 작업이 기존 pending을
// 자동 discard 하고, apply/discard는 1회만 유효하다(스펙 §2-A).
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";

export interface PendingRegionApplyInput {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  /** store 반영(undo 스냅샷 포함) — runRegionTask가 주입. */
  readonly onApply: () => void;
  readonly onDiscard: () => void;
  /** apply/discard 공통 후처리(고스트 정리 등). */
  readonly onSettle: () => void;
}

export interface PendingRegionApply {
  readonly baseProject: Project;
  readonly clippedProject: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly changedCells: number;
  readonly changedEvents: number;
  readonly instruction: string;
  readonly settled: boolean;
  apply(): void;
  discard(): void;
}

let current: PendingRegionApply | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPendingRegionApply(): PendingRegionApply | null {
  return current;
}

export function subscribePendingRegionApply(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPendingRegionApply(input: PendingRegionApplyInput): PendingRegionApply {
  current?.discard(); // 미해소 pending은 새 작업이 대체(전역 단일)
  let settled = false;
  const settle = (action: () => void): void => {
    if (settled) return;
    settled = true;
    action();
    input.onSettle();
    if (current === pending) current = null;
    emit();
  };
  const pending: PendingRegionApply = {
    baseProject: input.baseProject,
    clippedProject: input.clippedProject,
    mapId: input.mapId,
    region: input.region,
    changedCells: input.changedCells,
    changedEvents: input.changedEvents,
    instruction: input.instruction,
    get settled() {
      return settled;
    },
    apply: () => settle(input.onApply),
    discard: () => settle(input.onDiscard),
  };
  current = pending;
  publishHeadlessHook();
  emit();
  return pending;
}

/** 테스트 전용 — 리스너/pending 초기화. */
export function __clearPendingRegionApplyForTest(): void {
  current = null;
  listeners.clear();
}

// 헤드리스 훅(E2E/디버깅): window.__rpgzzuRegionTaskPending
function publishHeadlessHook(): void {
  if (typeof window === "undefined") return;
  window.__rpgzzuRegionTaskPending = {
    get: () =>
      current
        ? {
            mapId: current.mapId,
            region: current.region,
            changedCells: current.changedCells,
            changedEvents: current.changedEvents,
            settled: current.settled,
          }
        : null,
    apply: () => current?.apply(),
    discard: () => current?.discard(),
  };
}
```

`get settled()` 게터가 인터페이스의 `readonly settled: boolean`과 호환되는지 확인(TS 구조 타이핑으로 통과함).

`src/vite-env.d.ts`의 `__rpgzzuRegionTaskLog?: unknown;` 줄 아래에 추가:

```ts
  // 영역 작업 승인 게이트 pending (get/apply/discard) — E2E·디버깅용.
  __rpgzzuRegionTaskPending?: {
    get: () => unknown;
    apply: () => void;
    discard: () => void;
  };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/pendingRegionApply.test.ts`
Expected: PASS 4건

- [ ] **Step 5: 커밋**

```bash
git add src/editor/regionTask/pendingRegionApply.ts src/vite-env.d.ts test/pendingRegionApply.test.ts
git commit -m "feat(region): 승인 게이트 pending 보관소 — 전역 단일, 1회성 apply/discard"
```

---

### Task 2: 고스트 프리뷰 숨김 토글 + 인라인 승인 툴바 확장

**Files:**
- Modify: `src/editor/agentGhostPreview.ts` (숨김 상태), `src/editor/proposalInlineApproval.ts` (라벨·원본 보기 버튼), `src/editor/agentPreviewRenderers.ts` (숨김 반영), `src/styles/editor/inline-assist.css`
- Test: `test/proposalInlineApproval.test.ts` (기존 파일에 추가), `test/agentGhostPreviewHidden.test.ts` (신규)

**Interfaces:**
- Consumes: 기존 `InlineProposalActions`(accept/reject/focusCard), `subscribeAgentGhostPreview`/`emit` 내부 패턴
- Produces: `setAgentGhostPreviewHidden(hidden: boolean): void`, `isAgentGhostPreviewHidden(): boolean` (agentGhostPreview), `InlineProposalActions`의 `focusCard`가 **옵셔널**이 되고 `holdOrigin?: { start(): void; end(): void; label: string }` 추가. Task 3이 holdOrigin을 등록하고, Task 11 E2E가 `ghost-inline-hold-origin` testid를 본다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/agentGhostPreviewHidden.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAgentGhostPreview,
  getAgentGhostPreviewState,
  isAgentGhostPreviewHidden,
  setAgentGhostPreviewHidden,
  subscribeAgentGhostPreview,
} from "@/editor/agentGhostPreview";

describe("agentGhostPreview hidden toggle", () => {
  beforeEach(() => {
    setAgentGhostPreviewHidden(false);
    clearAgentGhostPreview();
  });

  it("토글 상태를 보관하고 변경 시 구독자에게 알린다", () => {
    let notified = 0;
    const unsubscribe = subscribeAgentGhostPreview(() => { notified += 1; });
    const before = notified; // 구독 즉시 1회 호출됨
    setAgentGhostPreviewHidden(true);
    expect(isAgentGhostPreviewHidden()).toBe(true);
    expect(notified).toBe(before + 1);
    setAgentGhostPreviewHidden(true); // 동일 값 — emit 없음
    expect(notified).toBe(before + 1);
    setAgentGhostPreviewHidden(false);
    expect(isAgentGhostPreviewHidden()).toBe(false);
    unsubscribe();
  });

  it("숨김은 프리뷰 데이터 자체를 파괴하지 않는다", () => {
    setAgentGhostPreviewHidden(true);
    expect(getAgentGhostPreviewState().previews).toEqual([]);
    setAgentGhostPreviewHidden(false);
  });
});
```

`test/proposalInlineApproval.test.ts`에 추가(기존 import에 `installFakeDom` 패턴이 이미 있으면 그대로 활용):

```ts
it("holdOrigin이 있으면 원본 보기 버튼을 렌더하고 pointerdown/up으로 start/end를 부른다", () => {
  const calls: string[] = [];
  const toolbar = buildInlineApprovalToolbar({
    accept: () => calls.push("accept"),
    reject: () => calls.push("reject"),
    holdOrigin: {
      label: "원본 보기",
      start: () => calls.push("start"),
      end: () => calls.push("end"),
    },
  });
  const hold = findByTestId(toolbar, "ghost-inline-hold-origin");
  expect(hold).not.toBeNull();
  hold!.dispatchEvent(new Event("pointerdown"));
  hold!.dispatchEvent(new Event("pointerup"));
  expect(calls).toEqual(["start", "end"]);
});

it("focusCard가 없으면 상세 버튼을 렌더하지 않는다", () => {
  const toolbar = buildInlineApprovalToolbar({ accept: () => {}, reject: () => {} });
  expect(findByTestId(toolbar, "ghost-inline-detail")).toBeNull();
});
```

(기존 테스트가 `focusCard` 필수를 전제하면 그 케이스는 그대로 두고 — focusCard를 넘기는 기존 호출은 계속 유효 — 새 케이스만 추가한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/agentGhostPreviewHidden.test.ts test/proposalInlineApproval.test.ts`
Expected: FAIL — `setAgentGhostPreviewHidden` 미존재, `holdOrigin` 타입 오류

- [ ] **Step 3: 구현**

`src/editor/agentGhostPreview.ts` — `let revision = 0;` 아래에 추가:

```ts
// 원본 보기(꾹 누름) 동안 렌더만 숨긴다 — 프리뷰 데이터는 유지(시각 토글).
let hidden = false;

export function isAgentGhostPreviewHidden(): boolean {
  return hidden;
}

export function setAgentGhostPreviewHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  emit();
}
```

`src/editor/proposalInlineApproval.ts` — 인터페이스/툴바 교체:

```ts
export interface InlineProposalActions {
  readonly accept: () => void;
  readonly reject: () => void;
  /** 채팅 제안 카드로 스크롤 — 영역 작업 pending에는 없음. */
  readonly focusCard?: () => void;
  /** 누르고 있는 동안 원본(before)을 보여주는 홀드 버튼 — 영역 작업 pending 전용. */
  readonly holdOrigin?: {
    readonly label: string;
    readonly start: () => void;
    readonly end: () => void;
  };
}
```

`buildInlineApprovalToolbar`의 children 배열을 다음으로 교체(✓/✗ 버튼은 기존 그대로 유지):

```ts
export function buildInlineApprovalToolbar(actions: InlineProposalActions): HTMLElement {
  const children: HTMLElement[] = [
    el("button", {
      class: "ghost-inline-btn is-accept",
      text: "✓ 적용",
      attrs: { type: "button", title: "이 제안을 프로젝트에 적용" },
      dataset: { testid: "ghost-inline-accept" },
      on: { click: () => actions.accept() },
    }),
    el("button", {
      class: "ghost-inline-btn is-reject",
      text: "✗ 거부",
      attrs: { type: "button", title: "제안 거부(초안 폐기)" },
      dataset: { testid: "ghost-inline-reject" },
      on: { click: () => actions.reject() },
    }),
  ];
  if (actions.focusCard) {
    const focusCard = actions.focusCard;
    children.push(
      el("button", {
        class: "ghost-inline-btn",
        text: "상세",
        attrs: { type: "button", title: "채팅 패널의 제안 카드로 이동" },
        dataset: { testid: "ghost-inline-detail" },
        on: { click: () => focusCard() },
      }),
    );
  }
  if (actions.holdOrigin) {
    const hold = actions.holdOrigin;
    let holding = false;
    const start = (): void => {
      if (holding) return;
      holding = true;
      hold.start();
    };
    const end = (): void => {
      if (!holding) return;
      holding = false;
      hold.end();
    };
    children.push(
      el("button", {
        class: "ghost-inline-btn is-hold",
        text: hold.label,
        attrs: { type: "button", title: "누르고 있는 동안 변경 전 원본을 보여줍니다" },
        dataset: { testid: "ghost-inline-hold-origin" },
        on: {
          pointerdown: start,
          pointerup: end,
          pointerleave: end,
          // 키보드 접근: Space/Enter 누름-뗌
          keydown: (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === " " || key === "Enter") {
              event.preventDefault();
              start();
            }
          },
          keyup: (event) => {
            const key = (event as KeyboardEvent).key;
            if (key === " " || key === "Enter") end();
          },
          blur: end,
        },
      }),
    );
  }
  return el("div", {
    class: "ghost-inline-approval",
    attrs: { role: "toolbar", "aria-label": "AI 제안 인라인 승인" },
    dataset: { testid: "ghost-inline-approval" },
    children,
  });
}
```

`src/editor/agentPreviewRenderers.ts` — `AgentGhostPreviewRenderer.render()`와 `refreshDomMarkers()`에 숨김 반영:

```ts
// import에 추가
import { isAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
```

`render()`에서 Phaser 그래픽 생성부를 숨김 가드로 감싼다(마커는 툴바 호스트라 유지):

```ts
  render(): void {
    this.layer.removeAll(true);
    this.clearDomMarkers();
    const previews = this.currentPreviews();
    if (previews.length === 0) return;

    if (!isAgentGhostPreviewHidden()) {
      const group = this.scene.add.container(0, 0);
      group.setName("agent-ghost-preview");
      this.layer.add(group);
      const cellCount = previews.reduce((total, preview) => total + preview.cells.length, 0);
      for (const preview of previews) {
        group.add(this.boundsGraphic(preview.bounds));
        if (cellCount > 0 && cellCount <= AGENT_GHOST_MAX_CELL_RECTS) {
          for (const cell of preview.cells) group.add(this.cellRect(cell));
        }
      }
    }
    this.renderDomMarkers(previews);
  }
```

`refreshDomMarkers()`의 marker 생성 직후에:

```ts
      if (isAgentGhostPreviewHidden()) marker.classList.add("is-ghost-hidden");
```

`src/styles/editor/inline-assist.css` 말미에 추가:

```css
/* 원본 보기(홀드) — 고스트 시각만 숨기고 툴바는 유지 */
.agent-ghost-preview.is-ghost-hidden {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.ghost-inline-btn.is-hold {
  border-style: dashed;
}

.ghost-inline-btn.is-hold:active {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 40%, #1a2236);
  color: #fff;
}
```

(`.agent-ghost-preview` 마커의 기존 시각 속성이 `background`/`border`가 아니면 — 해당 CSS를 열어 실제 속성(outline 등)을 확인하고 그 속성을 transparent로 덮는다. 마커 CSS는 `src/styles/` 아래 `rg -n "agent-ghost-preview" src/styles/`로 찾을 수 있다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/agentGhostPreviewHidden.test.ts test/proposalInlineApproval.test.ts`
Expected: PASS (기존 케이스 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/agentGhostPreview.ts src/editor/proposalInlineApproval.ts src/editor/agentPreviewRenderers.ts src/styles/editor/inline-assist.css test/agentGhostPreviewHidden.test.ts test/proposalInlineApproval.test.ts
git commit -m "feat(editor): 고스트 프리뷰 숨김 토글 + 인라인 툴바 원본 보기 버튼"
```

---

### Task 3: `runRegionTask` 승인 게이트

**Files:**
- Modify: `src/editor/regionTask/runRegionTask.ts`, `src/editor/regionTask/regionTaskStatus.ts`
- Test: `test/regionTaskRun.test.ts` (기존), `test/regionTaskStatus.test.ts` (기존)

**Interfaces:**
- Consumes: Task 1 `setPendingRegionApply`, Task 2 `setInlineProposalActions`(확장형)·`setAgentGhostPreviewHidden`
- Produces: `RegionTaskOptions.gate?: "approval" | "immediate"`(기본 `"approval"`), `RegionTaskResult.pending?: PendingRegionApply`, `RegionTaskStatusDetail.phase?: "running" | "pending"`, `describeRegionTaskResult`의 pending 문구. Task 5·11이 의존.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/regionTaskRun.test.ts`에 추가(기존 테스트의 fake deps 헬퍼 재사용 — 파일 상단의 프로젝트/세션 픽스처 패턴을 그대로 따른다):

```ts
import { __clearPendingRegionApplyForTest, getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";

describe("승인 게이트 (gate: approval 기본)", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("성공 시 적용하지 않고 pending을 반환한다", async () => {
    // 기존 '적용 성공' 케이스와 동일한 fake deps 구성에서 applyProject 호출을 기록
    const applied: string[] = [];
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" },
      makeDeps({ onApply: (label) => applied.push(label) }), // 기존 헬퍼 시그니처에 맞춰 조정
    );
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.pending).toBeDefined();
    expect(applied).toEqual([]); // 아직 미적용
    result.pending!.apply();
    expect(applied.length).toBe(1); // apply 시점에만 store 반영
    expect(getPendingRegionApply()).toBeNull();
  });

  it("discard 시 applyProject가 호출되지 않는다", async () => {
    const applied: string[] = [];
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘" },
      makeDeps({ onApply: (label) => applied.push(label) }),
    );
    result.pending!.discard();
    expect(applied).toEqual([]);
  });

  it("gate: immediate는 기존처럼 즉시 적용한다", async () => {
    const applied: string[] = [];
    const result = await runRegionTask(
      { mapId: MAP_ID, region: REGION, instruction: "잔디로 채워줘", gate: "immediate" },
      makeDeps({ onApply: (label) => applied.push(label) }),
    );
    expect(result.applied).toBe(true);
    expect(result.pending).toBeUndefined();
    expect(applied.length).toBe(1);
  });
});
```

주의: `MAP_ID`/`REGION`/`makeDeps`는 이 테스트 파일에 이미 있는 픽스처 이름에 맞춰 조정하되, **위 3개 시나리오(승인 대기/버리기/immediate)는 그대로 구현**한다. 기존 케이스 중 "성공 시 applied=true"를 전제하는 것들은 `gate: "immediate"`를 옵션에 추가해 의미를 유지시킨다(즉시 적용 경로의 회귀 테스트로 남긴다).

`test/regionTaskStatus.test.ts`에 추가:

```ts
it("phase 필드를 그대로 전달하고, 없으면 undefined", () => {
  const events: (RegionTaskStatusDetail | null)[] = [];
  const listener = (event: Event): void => { events.push(regionTaskStatusDetail(event)); };
  window.addEventListener(REGION_TASK_STATUS_EVENT, listener);
  dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true, phase: "pending" });
  dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true });
  window.removeEventListener(REGION_TASK_STATUS_EVENT, listener);
  expect(events[0]?.phase).toBe("pending");
  expect(events[1]?.phase).toBeUndefined();
});
```

`describeRegionTaskResult` pending 문구(같은 파일 `test/regionTaskRun.test.ts`):

```ts
it("describeRegionTaskResult — pending이면 확인 대기 문구", () => {
  const text = describeRegionTaskResult({
    ok: true, applied: false, changedCells: 34, changedEvents: 2, clippedCells: 0,
    proposedCalls: 3, assistantText: "",
    pending: { settled: false } as never,
  });
  expect(text).toBe("제안 준비 — 34칸 타일 · 이벤트 2건 · 적용 여부를 선택하세요");
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/regionTaskRun.test.ts test/regionTaskStatus.test.ts`
Expected: FAIL — `gate`/`pending`/`phase` 미존재

- [ ] **Step 3: 구현**

`src/editor/regionTask/regionTaskStatus.ts`:

```ts
export interface RegionTaskStatusDetail {
  readonly mapId: string;
  readonly region: RegionRect;
  readonly running: boolean;
  /** running=true일 때 세부 단계 — 생략 시 "running"으로 간주. */
  readonly phase?: "running" | "pending";
}
```

`regionTaskStatusDetail()` 반환 직전에 phase 전달(검증은 문자열 2종만 통과):

```ts
  const phase = candidate.phase === "running" || candidate.phase === "pending" ? candidate.phase : undefined;
  return { mapId: candidate.mapId, region: region as RegionRect, running: candidate.running, ...(phase ? { phase } : {}) };
```

`src/editor/regionTask/runRegionTask.ts`:

1. import 추가:

```ts
import { setAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
import { setInlineProposalActions } from "@/editor/proposalInlineApproval";
import { setPendingRegionApply, type PendingRegionApply } from "./pendingRegionApply";
```

2. 타입 확장:

```ts
export interface RegionTaskOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly instruction: string;
  /** 기본 "approval": 적용 전 승인 게이트. "immediate"는 레거시 즉시 적용. */
  readonly gate?: "approval" | "immediate";
  readonly onEvent?: (event: SessionEvent) => void;
}
```

`RegionTaskResult`에 `readonly pending?: PendingRegionApply;` 추가.

3. `describeRegionTaskResult` — 첫 줄 뒤에 pending 분기 추가:

```ts
export function describeRegionTaskResult(result: RegionTaskResult): string {
  if (!result.ok) return `오류: ${result.error ?? "알 수 없는 오류"}`;
  if (result.pending && !result.pending.settled) {
    const parts: string[] = [];
    if (result.changedCells > 0) parts.push(`${result.changedCells}칸 타일`);
    if (result.changedEvents > 0) parts.push(`이벤트 ${result.changedEvents}건`);
    return `제안 준비 — ${parts.join(" · ") || "변경"} · 적용 여부를 선택하세요`;
  }
  // 이하 기존 그대로
```

4. 성공 경로 게이트 — 현재의

```ts
  } else {
    ghostPreviewUpdater.flush();
  }
  clearAgentGhostPreview();
```

에서 무조건 `clearAgentGhostPreview()` 호출을 **제거**하고(오류/중단 분기의 clear는 유지), 이후 각 조기 반환 경로에 정리를 넣는다:

- `changedCells === 0 && changedEvents === 0` 분기: return 직전에 `clearAgentGhostPreview();`
- 검증 실패(`blocking.length > 0`) 분기: return 직전에 `clearAgentGhostPreview();`

5. 마지막 적용부를 게이트로 교체:

```ts
  const gate = opts.gate ?? "approval";
  const label = `영역 작업: ${instruction.slice(0, 40)}`;
  if (gate === "immediate") {
    clearAgentGhostPreview();
    deps.applyProject(clipped, label, opts.mapId);
    return attachLog({
      ok: true,
      applied: true,
      changedCells,
      changedEvents,
      clippedCells,
      proposedCalls: turn.proposedCalls.length,
      assistantText: turn.assistantText,
    }, turn);
  }

  // 승인 게이트: 적용하지 않고 pending 등록 + 고스트 유지 + 캔버스 인라인 툴바 배선.
  const pending = setPendingRegionApply({
    baseProject: base,
    clippedProject: clipped,
    mapId: opts.mapId,
    region: opts.region,
    changedCells,
    changedEvents,
    instruction,
    onApply: () => deps.applyProject(clipped, label, opts.mapId),
    onDiscard: () => {},
    onSettle: () => {
      setInlineProposalActions(null);
      setAgentGhostPreviewHidden(false);
      clearAgentGhostPreview();
    },
  });
  setInlineProposalActions({
    accept: () => pending.apply(),
    reject: () => pending.discard(),
    holdOrigin: {
      label: "원본 보기",
      start: () => setAgentGhostPreviewHidden(true),
      end: () => setAgentGhostPreviewHidden(false),
    },
  });
  const gated = attachLog({
    ok: true,
    applied: false,
    changedCells,
    changedEvents,
    clippedCells,
    proposedCalls: turn.proposedCalls.length,
    assistantText: turn.assistantText,
  }, turn);
  return { ...gated, pending };
```

(attachLog는 순수하게 log만 붙이므로 스프레드로 pending을 더한다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/regionTaskRun.test.ts test/regionTaskStatus.test.ts test/regionTaskLogExport.test.ts test/regionAiPlacementHarness.test.ts`
Expected: PASS — regionTask 계열 기존 파일 전부. `test/regionTaskModal.test.ts`는 Task 5에서 갱신하므로 이 시점에 실패해도 기록만 하고 진행하되, 실패 원인이 gate 외 다른 것이면 수정.

- [ ] **Step 5: 타입체크 확인**

Run: `npx tsc --noEmit 2>&1 | grep -E "runRegionTask|regionTaskStatus|pendingRegionApply" ; echo "exit-grep:$?"`
Expected: `exit-grep:1` (해당 파일 오류 0건)

- [ ] **Step 6: 커밋**

```bash
git add src/editor/regionTask/runRegionTask.ts src/editor/regionTask/regionTaskStatus.ts test/regionTaskRun.test.ts test/regionTaskStatus.test.ts
git commit -m "feat(region): 영역 작업 승인 게이트 — pending 반환·고스트 유지·인라인 툴바 배선"
```

---

### Task 4: `regionSnapshot` — draw 로직 추출 + 영역 크롭 렌더

**Files:**
- Create: `src/editor/mapTileDraw.ts`, `src/editor/regionSnapshot.ts`
- Modify: `src/editor/mapScreenshot.ts` (draw 내부를 mapTileDraw로 이관)
- Test: `test/regionSnapshot.test.ts`

**Interfaces:**
- Consumes: `mapScreenshot.ts`의 기존 private 함수들(drawLayer/drawStackLayer/drawRawTile/drawLakeAutotile/drawTerrainQuarter/loadTilesetImage) — 시그니처에 `scale: number` 파라미터를 추가해 이관
- Produces: `renderRegionSnapshot(project: Project, map: GameMap, region: RegionRect, opts?: { targetWidth?: number }): Promise<HTMLCanvasElement>`, 순수 함수 `regionSnapshotScale(regionWidthPx: number, targetWidth?: number): number`, `eventsInRegion(map: GameMap, region: RegionRect): readonly GameEvent[]`. Task 5가 renderRegionSnapshot을 기본 렌더러로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (순수 함수만 — canvas는 fakeDom에 없음)**

```ts
// test/regionSnapshot.test.ts
import { describe, expect, it } from "vitest";
import { eventsInRegion, regionSnapshotScale } from "@/editor/regionSnapshot";
import type { GameMap } from "@/project/types";

describe("regionSnapshotScale", () => {
  it("영역 픽셀 폭을 목표 폭에 맞춰 축소하되 최대 2배·최소 1/16로 클램프", () => {
    expect(regionSnapshotScale(70, 140)).toBe(2); // 작은 영역은 2배 상한
    expect(regionSnapshotScale(280, 140)).toBe(0.5);
    expect(regionSnapshotScale(140 * 32, 140)).toBe(0.0625); // 거대 영역 하한(1/16 = 타일 16px 기준 1px/타일)
    expect(regionSnapshotScale(0, 140)).toBe(1); // 비정상 입력 방어
  });
});

describe("eventsInRegion", () => {
  const map = {
    width: 10, height: 10,
    events: [
      { id: "a", x: 2, y: 2 },
      { id: "b", x: 5, y: 5 },
      { id: "c", x: 9, y: 9 },
    ],
  } as unknown as GameMap;
  it("영역 안 이벤트만 반환", () => {
    const inside = eventsInRegion(map, { x: 2, y: 2, width: 4, height: 4 });
    expect(inside.map((event) => event.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/regionSnapshot.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `mapTileDraw.ts`로 draw 이관**

`src/editor/mapTileDraw.ts` 신규 — `mapScreenshot.ts`의 `drawLayer`, `drawStackLayer`, `drawLakeAutotile`, `drawTerrainQuarter`, `drawRawTile`, `loadTilesetImage`, `tilesetImagePromises`를 **그대로 옮기되** 모듈 상수 `SCREENSHOT_SCALE` 참조를 전부 `scale` 파라미터로 바꾼다:

```ts
// src/editor/mapTileDraw.ts
// 맵 타일 레이어 → 2D 캔버스 렌더(오프스크린). mapScreenshot(전체 맵)과
// regionSnapshot(영역 크롭 썸네일)이 공유한다. scale은 픽셀 배율(연속값 허용).
import { isDefaultTilesetTexture, tilesetImageUrl } from "@/editor/tilesetImage";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import {
  isTerrainQuarterTile,
  terrainQuarterSources,
  type TerrainQuarterSource,
} from "@/project/defaults/terrainQuarterAutotile";
import { tileStackAt } from "@/project/mapOverlayTiles";
import type { GameMap, TilesetDef } from "@/project/types";

export class MapTileDrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapTileDrawError";
  }
}

/** lower→lower스택→upper→upper스택 순서로 모든 타일 레이어를 그린다. */
export function drawMapTileLayers(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  map: GameMap,
  tileset: TilesetDef,
  scale: number,
): void {
  drawLayer(context, image, map, tileset, map.lowerTiles, scale);
  drawStackLayer(context, image, map, tileset, "lower", scale);
  drawLayer(context, image, map, tileset, map.upperTiles, scale);
  drawStackLayer(context, image, map, tileset, "upper", scale);
}
```

이어서 기존 5개 함수를 `scale` 파라미터 버전으로 이관(모든 `* SCREENSHOT_SCALE`을 `* scale`로 치환, `export`는 `loadTilesetImage`만 추가로 붙인다). `mapScreenshot.ts`는 이관된 함수들을 import로 대체:

```ts
// mapScreenshot.ts — 내부 draw 함수/이미지 캐시 삭제 후
import { drawMapTileLayers, loadTilesetImage, MapTileDrawError } from "@/editor/mapTileDraw";
```

`createMapScreenshot` 본문의 4줄 draw 호출을 `drawMapTileLayers(context, image, map, tileset, SCREENSHOT_SCALE);` 하나로 교체. `MapScreenshotError`는 유지하되 `loadTilesetImage`가 던지는 `MapTileDrawError`를 그대로 전파해도 된다(기존 메시지 규약 변화 없음 — `loadTilesetImage`의 reject 에러 타입만 `MapTileDrawError`로 바뀜; `mapScreenshot`에서 catch해 `MapScreenshotError`로 감싸는 래핑을 추가).

- [ ] **Step 4: `regionSnapshot.ts` 구현**

```ts
// src/editor/regionSnapshot.ts
// 영역 작업 before/after 썸네일 — 프로젝트+맵의 지정 사각형만 크롭 렌더한다.
// 이벤트(NPC)는 셀 마커(파란 원)로 단순 표시. fakeDom(테스트)에는 canvas가 없으므로
// 모달은 이 함수를 주입형 옵션으로 받는다(스펙 §2-C).
import { drawMapTileLayers, loadTilesetImage, MapTileDrawError } from "@/editor/mapTileDraw";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { inRegion } from "@/editor/regionTask/clipToRegion";
import type { GameEvent, GameMap, Project } from "@/project/types";

const DEFAULT_TARGET_WIDTH = 140;
const MAX_SCALE = 2;
const MIN_SCALE = 0.0625; // 16px 타일 기준 타일당 1px

/** 목표 폭 대비 배율 — [MIN_SCALE, MAX_SCALE] 클램프. 비정상 입력은 1. */
export function regionSnapshotScale(regionWidthPx: number, targetWidth = DEFAULT_TARGET_WIDTH): number {
  if (!Number.isFinite(regionWidthPx) || regionWidthPx <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetWidth / regionWidthPx));
}

export function eventsInRegion(map: GameMap, region: RegionRect): readonly GameEvent[] {
  return (map.events ?? []).filter((event) => inRegion(event.x, event.y, region));
}

export async function renderRegionSnapshot(
  project: Project,
  map: GameMap,
  region: RegionRect,
  opts?: { readonly targetWidth?: number },
): Promise<HTMLCanvasElement> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new MapTileDrawError("맵의 타일셋을 찾지 못했습니다.");
  const tileSize = map.tileSize;
  const scale = regionSnapshotScale(region.width * tileSize, opts?.targetWidth);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * tileSize * scale));
  canvas.height = Math.max(1, Math.round(region.height * tileSize * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new MapTileDrawError("썸네일 캔버스를 만들지 못했습니다.");
  context.imageSmoothingEnabled = false;
  // 절대 맵 좌표로 그리는 draw 함수를 영역 원점으로 평행이동 — 캔버스 밖은 자동 클립.
  context.translate(-Math.round(region.x * tileSize * scale), -Math.round(region.y * tileSize * scale));

  const image = await loadTilesetImage(tileset);
  drawMapTileLayers(context, image, map, tileset, scale);

  // 이벤트 마커: 셀 중앙의 파란 원(단순 표시 — 차셋 스프라이트는 비목표)
  for (const event of eventsInRegion(map, region)) {
    const cx = (event.x + 0.5) * tileSize * scale;
    const cy = (event.y + 0.5) * tileSize * scale;
    const radius = Math.max(2, tileSize * scale * 0.32);
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(21, 170, 191, 0.9)";
    context.fill();
    context.lineWidth = Math.max(1, scale);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.stroke();
  }
  return canvas;
}
```

스펙 갱신 1줄 — `docs/superpowers/specs/2026-07-10-region-before-after-and-command-breadth-design.md`에서 다음 문자열을 교체(이 계획이 확정한 단순화):

- old: `이벤트(NPC)는 차셋 스프라이트 1프레임을 셀 위에 오버레이(가능한 범위에서 단순 렌더, 실패 시 셀 마커로 폴백).`
- new: `이벤트(NPC)는 셀 중앙의 파란 원 마커로 단순 표시(차셋 스프라이트 렌더는 후속 과제).`

- [ ] **Step 5: 테스트 통과 + 기존 스크린샷 테스트 확인**

Run: `npx vitest run test/regionSnapshot.test.ts && npx vitest run test/mapScreenshot.test.ts 2>/dev/null; npx tsc --noEmit 2>&1 | grep -E "mapTileDraw|regionSnapshot|mapScreenshot"; echo "exit-grep:$?"`
Expected: regionSnapshot PASS, mapScreenshot 테스트가 존재하면 PASS(없으면 skip), `exit-grep:1`

- [ ] **Step 6: 커밋**

```bash
git add src/editor/mapTileDraw.ts src/editor/regionSnapshot.ts src/editor/mapScreenshot.ts test/regionSnapshot.test.ts docs/superpowers/specs/2026-07-10-region-before-after-and-command-breadth-design.md
git commit -m "feat(editor): 영역 크롭 스냅샷 렌더 — mapScreenshot draw 로직 공유 모듈로 추출"
```

---

### Task 5: `regionTaskModal` pending UI — before/after 썸네일 + 적용/버리기

**Files:**
- Modify: `src/editor/panels/regionTaskModal.ts`, `src/editor/EditScene.ts:1084-1090` (배지 문구), `src/styles/editor/inline-assist.css`
- Test: `test/regionTaskModal.test.ts` (기존 파일 확장)

**Interfaces:**
- Consumes: Task 3 `result.pending`(`PendingRegionApply`), `subscribePendingRegionApply`, `dispatchRegionTaskStatus`(phase), Task 4 `renderRegionSnapshot`
- Produces: `RegionTaskModalOptions.renderSnapshot?: (project: Project, map: GameMap, region: RegionRect) => Promise<HTMLElement>` (기본 `renderRegionSnapshot`), testids `region-task-compare`/`region-task-before`/`region-task-after`/`region-task-apply`/`region-task-discard`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/regionTaskModal.test.ts`에 추가(기존 fake run 주입 패턴 재사용):

```ts
import { __clearPendingRegionApplyForTest, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";

function fakePendingResult(overrides: Partial<RegionTaskResult> = {}): RegionTaskResult {
  const pending = setPendingRegionApply({
    baseProject: { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never,
    clippedProject: { maps: { m1: { id: "m1", name: "맵", width: 4, height: 4, tileSize: 16, events: [] } }, tilesets: {} } as never,
    mapId: "m1",
    region: { x: 0, y: 0, width: 2, height: 2 },
    changedCells: 3,
    changedEvents: 0,
    instruction: "테스트",
    onApply: () => {},
    onDiscard: () => {},
    onSettle: () => {},
  });
  return {
    ok: true, applied: false, changedCells: 3, changedEvents: 0, clippedCells: 0,
    proposedCalls: 1, assistantText: "", pending, ...overrides,
  };
}

describe("pending 비교 UI", () => {
  beforeEach(() => __clearPendingRegionApplyForTest());

  it("pending 결과면 before/after 썸네일과 적용/버리기 버튼을 렌더한다", async () => {
    const stub = () => Promise.resolve(document.createElement("div"));
    const root = openRegionTaskModal({
      mapId: "m1",
      region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트",
      autoRun: true,
      run: async () => fakePendingResult(),
      renderSnapshot: stub,
    });
    await flushPromises(); // 파일에 이미 있는 마이크로태스크 flush 헬퍼 사용(없으면 await Promise.resolve() 2회)
    expect(findByTestId(root, "region-task-compare")).not.toBeNull();
    expect(findByTestId(root, "region-task-before")).not.toBeNull();
    expect(findByTestId(root, "region-task-after")).not.toBeNull();
    expect(findByTestId(root, "region-task-apply")).not.toBeNull();
    expect(findByTestId(root, "region-task-discard")).not.toBeNull();
    closeRegionTaskModal();
  });

  it("적용 클릭 시 pending.apply가 불리고 요약이 갱신된다", async () => {
    const result = fakePendingResult();
    const root = openRegionTaskModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트", autoRun: true,
      run: async () => result,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flushPromises();
    findByTestId(root, "region-task-apply")!.dispatchEvent(new Event("click"));
    expect(result.pending!.settled).toBe(true);
    expect(findByTestId(root, "region-task-summary")!.textContent).toContain("적용됨");
    closeRegionTaskModal();
  });

  it("pending 미해소 상태에서 모달을 닫으면 discard 된다", async () => {
    const result = fakePendingResult();
    const root = openRegionTaskModal({
      mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 },
      initialInstruction: "테스트", autoRun: true,
      run: async () => result,
      renderSnapshot: () => Promise.resolve(document.createElement("div")),
    });
    await flushPromises();
    findByTestId(root, "region-task-close")!.dispatchEvent(new Event("click"));
    expect(result.pending!.settled).toBe(true); // 닫기 = discard
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/regionTaskModal.test.ts`
Expected: FAIL — `renderSnapshot` 옵션/compare UI 미존재

- [ ] **Step 3: 구현**

`src/editor/panels/regionTaskModal.ts`:

1. import 추가:

```ts
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { PendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import type { GameMap, Project } from "@/project/types";
```

2. 옵션 확장:

```ts
export interface RegionTaskModalOptions {
  // ... 기존 필드 유지
  /** 테스트 주입: 썸네일 렌더러(기본 renderRegionSnapshot 캔버스). */
  readonly renderSnapshot?: (project: Project, map: GameMap, region: RegionRect) => Promise<HTMLElement>;
}
```

3. `openRegionTaskModal` 내부에 pending 상태와 비교 UI 빌더 추가(`summary` 선언 아래):

```ts
  const renderSnapshot = options.renderSnapshot
    ?? ((project: Project, map: GameMap, rect: RegionRect) => renderRegionSnapshot(project, map, rect));
  const compareHost = el("div", { class: "region-task-compare-host" });
  let activePending: PendingRegionApply | null = null;

  const settlePendingUi = (applied: boolean): void => {
    setSummary(applied
      ? `적용됨 — ${activePending?.changedCells ?? 0}칸 타일 · 이벤트 ${activePending?.changedEvents ?? 0}건`
      : "버려졌습니다 — 맵은 변경되지 않았습니다");
    compareHost.replaceChildren();
    activePending = null;
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: false });
    runButton.disabled = false;
    textarea.disabled = false;
  };

  const renderPendingCompare = async (pending: PendingRegionApply): Promise<void> => {
    activePending = pending;
    const map = pending.baseProject.maps[pending.mapId];
    const clippedMap = pending.clippedProject.maps[pending.mapId];
    const figures = el("div", { class: "region-task-compare", dataset: { testid: "region-task-compare" } });
    const makeFigure = async (
      label: string,
      testid: string,
      project: Project,
      figureMap: GameMap | undefined,
    ): Promise<HTMLElement> => {
      const body = el("div", { class: "region-task-compare-canvas", dataset: { testid } });
      if (figureMap) {
        try {
          const canvas = await renderSnapshot(project, figureMap, pending.region);
          // 클릭 시 2배 확대 토글
          canvas.addEventListener?.("click", () => body.classList.toggle("is-zoomed"));
          body.append(canvas);
        } catch {
          body.append(el("span", { class: "region-task-compare-fallback", text: "미리보기 실패" }));
        }
      }
      return el("figure", {
        class: "region-task-compare-figure",
        children: [body, el("figcaption", { text: label })],
      });
    };
    figures.append(
      await makeFigure("이전", "region-task-before", pending.baseProject, map),
      el("span", { class: "region-task-compare-arrow", text: "→" }),
      await makeFigure("이후", "region-task-after", pending.clippedProject, clippedMap),
    );
    const applyButton = el("button", {
      class: "region-task-apply",
      text: "✓ 적용",
      attrs: { type: "button" },
      dataset: { testid: "region-task-apply" },
      on: { click: () => { pending.apply(); settlePendingUi(true); } },
    });
    const discardButton = el("button", {
      class: "region-task-discard",
      text: "✕ 버리기",
      attrs: { type: "button" },
      dataset: { testid: "region-task-discard" },
      on: { click: () => { pending.discard(); settlePendingUi(false); } },
    });
    compareHost.replaceChildren(
      figures,
      el("div", { class: "region-task-compare-actions", children: [applyButton, discardButton] }),
    );
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true, phase: "pending" });
  };
```

4. `execute()`의 성공 처리에 pending 분기 추가 — `setSummary(describeRegionTaskResult(result));` 다음:

```ts
      if (result.pending && !result.pending.settled) {
        await renderPendingCompare(result.pending);
      }
```

그리고 `finally` 블록의 `dispatchRegionTaskStatus({ ... running: false })`와 `runButton.disabled = false; textarea.disabled = false;`를 **pending이 없을 때만** 실행하도록 감싼다:

```ts
    } finally {
      running = false;
      if (!activePending) {
        dispatchRegionTaskStatus({ mapId: options.mapId, region, running: false });
        runButton.disabled = false;
        textarea.disabled = false;
      }
    }
```

(pending 중에는 재실행을 막고 — 확인 대기 배지 유지 — settle 시 `settlePendingUi`가 해제한다.)

5. 닫기 경로에서 discard — 모달 조립부의 `closeButton`/backdrop click/Escape 핸들러를 공용 헬퍼로 교체:

```ts
  const discardAndClose = (): void => {
    if (activePending && !activePending.settled) activePending.discard();
    activePending = null;
    closeRegionTaskModal();
  };
```

`closeButton`의 `click: () => closeRegionTaskModal()` → `click: () => discardAndClose()`, backdrop의 `click`/`keydown(Escape)`도 `discardAndClose()` 호출로 교체.

6. `windowNode` children에 `compareHost` 삽입: `children: [header, textarea, log, summary, compareHost, actions]`.

`src/editor/EditScene.ts` — 배지 phase 반영:

- `activeRegionTask` 타입에 phase 추가: `{ readonly mapId: string; readonly region: RegionRect; readonly phase: "running" | "pending" }`
- `handleRegionTaskStatus`: `this.activeRegionTask = detail.running ? { mapId: detail.mapId, region: detail.region, phase: detail.phase ?? "running" } : null;`
- `renderRegionTaskBadge()`의 `badge.textContent = "✨ AI 작업 중…";` 뒤에서 phase 반영(배지 생성 후 매 렌더마다):

```ts
    this.regionTaskBadge.textContent = task.phase === "pending" ? "✓ 변경 확인 대기" : "✨ AI 작업 중…";
```

(기존 생성부의 `badge.textContent = ...` 줄은 제거하고 위 한 줄로 항상 갱신.)

`src/styles/editor/inline-assist.css` 말미:

```css
/* 영역 작업 before/after 비교 */
.region-task-compare {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
}

.region-task-compare-figure {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  text-align: center;
}

.region-task-compare-figure figcaption {
  color: var(--editor-text-muted, #9aa8c7);
  font: 600 11px/1.2 var(--font-ui, system-ui, sans-serif);
}

.region-task-compare-canvas {
  background: var(--editor-popover-bg, #151b2c);
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 8px;
  cursor: zoom-in;
  max-width: 150px;
  overflow: hidden;
}

.region-task-compare-canvas canvas {
  display: block;
  image-rendering: pixelated;
}

.region-task-compare-canvas.is-zoomed {
  cursor: zoom-out;
  max-width: none;
  position: relative;
  z-index: 5;
}

.region-task-compare-canvas.is-zoomed canvas {
  transform: scale(2);
  transform-origin: top left;
}

.region-task-compare-arrow {
  color: var(--editor-text-muted, #9aa8c7);
  font-size: 16px;
}

.region-task-compare-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
}

.region-task-apply,
.region-task-discard {
  border: 1px solid var(--editor-line-strong, #3a4a6a);
  border-radius: 8px;
  cursor: pointer;
  font: 600 12px/1 var(--font-ui, system-ui, sans-serif);
  padding: 7px 14px;
}

.region-task-apply {
  background: color-mix(in srgb, var(--editor-blue, #3d6df0) 80%, #10214a);
  color: #fff;
}

.region-task-discard {
  background: transparent;
  color: var(--editor-text-muted, #9aa8c7);
}

.region-task-discard:hover {
  color: var(--editor-text, #e8eefc);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/regionTaskModal.test.ts test/regionTaskMenu.test.ts`
Expected: PASS(기존 케이스 포함). 기존 케이스 중 "실행 후 즉시 적용 요약"을 전제하는 것이 있으면 fake run이 `pending` 없는 결과를 반환하므로 그대로 통과해야 함 — 실패 시 해당 케이스의 기대 문구만 조정.

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/regionTaskModal.ts src/editor/EditScene.ts src/styles/editor/inline-assist.css test/regionTaskModal.test.ts
git commit -m "feat(region): 모달 before/after 썸네일·적용/버리기 + 확인 대기 배지"
```

---

### Task 6: `place_chest` / `place_savepoint` 도구

**Files:**
- Modify: `src/editor/tools/eventTools.ts` (도구 2개 + EVENT_TOOLS 등록), `src/editor/agentGhostPreview.ts` (프리뷰 케이스 2개)
- Test: `test/placeChestSavepoint.test.ts`

**Interfaces:**
- Consumes: `requireMap`/`inMapBounds`/`nearestPassableCell`/`resolveGraphic`/`genId`/`upsertEventIntoMap`/`assertEventShape`/`PASSIVE` — 전부 eventTools.ts에 이미 있는 내부 유틸
- Produces: 도구 `place_chest {mapId,x,y,contents:{itemId?,gold?},name?,id?}`, `place_savepoint {mapId,x,y,name?,id?}`. Task 8 라우터 가이드가 이름을 참조.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/placeChestSavepoint.test.ts
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { emptyProject } from "@/editor/tools/emptyProject";
import type { Project } from "@/project/types";

// emptyProject()가 기본 맵/타일셋을 제공하는 기존 테스트 픽스처 패턴을 따른다.
// (기존 place_npc 테스트가 있으면 그 픽스처 헬퍼를 재사용할 것: rg -l "place_npc" test/)
function projectWithMap(): { project: Project; mapId: string } {
  const project = emptyProject();
  const mapId = Object.keys(project.maps)[0];
  return { project, mapId };
}

describe("place_chest", () => {
  it("셀프스위치 2페이지 보물상자 이벤트를 만든다 (아이템+골드)", () => {
    const { project, mapId } = projectWithMap();
    const itemId = project.database.items[0]?.id ?? "item_potion";
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId, gold: 50 } });
    expect(result.summary).toContain("보물상자");
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    expect(event.pages).toHaveLength(2);
    const closed = event.pages![0];
    expect(closed.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
    const kinds = closed.commands.map((command) => command.kind);
    expect(kinds).toEqual(["changeItem", "changeGold", "text", "setSelfSwitch"]);
    const opened = event.pages![1];
    expect(opened.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
  });

  it("contents가 비면 ToolError", () => {
    const { project, mapId } = projectWithMap();
    expect(() => getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: {} })).toThrow(/contents/);
  });

  it("DB에 없는 아이템이면 경고를 남긴다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: "item_없는것" } });
    expect(result.warnings?.some((warning) => warning.includes("item_없는것"))).toBe(true);
  });
});

describe("place_savepoint", () => {
  it("checkpointSave 커맨드를 가진 이벤트를 만든다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_savepoint")!.run(project, { mapId, x: 2, y: 2 });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const kinds = event.pages![0].commands.map((command) => command.kind);
    expect(kinds).toContain("checkpointSave");
  });
});
```

주의: `ToolDefinition.run(draft, args)`는 `ToolExecResult`를 반환한다(diff/커밋은 runner 몫) — 기존 eventTools 테스트가 runner 경유(`runTool`)라면 그 패턴을 따르고, 직접 `run` 호출이면 위처럼 간다. `rg -n "place_npc" test/ | head`로 기존 방식 1개를 확인 후 동일하게 맞출 것. `emptyProject()`의 실제 export 위치도 `rg -n "export function emptyProject" src/`로 확인.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/placeChestSavepoint.test.ts`
Expected: FAIL — `getTool("place_chest")` undefined

- [ ] **Step 3: 구현**

`src/editor/tools/eventTools.ts` — `makeChaseScene` 정의 근처에 추가:

```ts
// 보물상자: "상자를 열면 X 지급"을 셀프스위치 2페이지로 완결하는 프리셋.
// (코퍼스 hidden-treasure-chest / chest-potion-reward가 "부분 가능"이던 갭 해소)
const placeChest: ToolDefinition = {
  name: "place_chest",
  description:
    "보물상자 이벤트를 배치한다. 조사하면 contents의 아이템/골드를 지급하고 셀프스위치 A로 개봉 상태를 기억한다(2페이지). '상자를 열면 ~을 주는' 요청은 이 툴 하나로 끝낸다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      contents: {
        type: "object",
        description: "{itemId?: string, gold?: number} — 최소 1개",
        properties: { itemId: { type: "string" }, gold: { type: "integer" } },
      },
      name: { type: "string" },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "contents"],
  },
  invalidArgsExample: { mapId: "map_1", x: 5, y: 5, contents: { itemId: "item_potion", gold: 50 } },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) {
      throw new ToolError(`상자 위치가 맵 밖입니다: (${x}, ${y})`, { code: "chest-out-of-bounds", mapId: map.id, x, y });
    }
    const contents = (args.contents ?? {}) as { itemId?: unknown; gold?: unknown };
    const itemId = typeof contents.itemId === "string" && contents.itemId.length > 0 ? contents.itemId : undefined;
    const gold = typeof contents.gold === "number" && Number.isFinite(contents.gold) && contents.gold > 0
      ? Math.floor(contents.gold)
      : undefined;
    if (!itemId && !gold) {
      throw new ToolError("contents.itemId 또는 contents.gold(양수) 중 최소 하나가 필요합니다.", { code: "chest-empty-contents" });
    }
    const warnings: string[] = [];
    if (itemId && !draft.database.items.some((item) => item.id === itemId)) {
      warnings.push(`아이템 '${itemId}'가 데이터베이스에 없습니다 — upsert_item으로 먼저 만들거나 기존 id를 쓰세요`);
    }
    const graphic = resolveGraphic({ query: "보물상자" });
    const id = (args.id as string | undefined) ?? genId("ev_chest");
    const name = (args.name as string | undefined) ?? "보물상자";
    const rewardText = [itemId ?? null, gold ? `${gold}G` : null].filter(Boolean).join(" · ");
    const trigger: Trigger = { kind: "action" };
    const openCommands: Command[] = [
      ...(itemId ? [{ kind: "changeItem", itemId, op: "+=", amount: 1 } as Command] : []),
      ...(gold ? [{ kind: "changeGold", op: "+=", amount: gold } as Command] : []),
      { kind: "text", body: `보물상자를 열었다! (${rewardText})` },
      { kind: "setSelfSwitch", key: "A", value: true } as Command,
    ];
    const event: GameEvent = {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [
        {
          id: `${id}_closed`,
          name: `${name}(닫힘)`,
          conditions: [{ kind: "selfSwitch", key: "A", value: false }],
          graphic,
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: openCommands,
        },
        {
          id: `${id}_opened`,
          name: `${name}(열림)`,
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          graphic,
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [{ kind: "text", body: "상자는 비어 있다." }],
        },
      ],
    };
    assertEventShape(event, warnings);
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name}에 보물상자 '${name}' 배치 (${x}, ${y}) — 보상 ${rewardText}`,
      data: { eventId: id, x, y },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// 세이브 포인트: 조사 → checkpointSave. (코퍼스 auto-save-point가 "불가"이던 갭 해소)
const placeSavepoint: ToolDefinition = {
  name: "place_savepoint",
  description: "세이브 포인트 이벤트를 배치한다. 조사하면 체크포인트 저장이 실행된다(크리스탈 외형).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) {
      throw new ToolError(`세이브 포인트 위치가 맵 밖입니다: (${x}, ${y})`, { code: "savepoint-out-of-bounds", mapId: map.id, x, y });
    }
    const graphic = resolveGraphic({ query: "크리스탈" });
    const id = (args.id as string | undefined) ?? genId("ev_save");
    const name = (args.name as string | undefined) ?? "세이브 포인트";
    const trigger: Trigger = { kind: "action" };
    const event: GameEvent = {
      id,
      x,
      y,
      trigger,
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name,
          conditions: [],
          graphic,
          trigger,
          priority: "below",
          overlapForbidden: false,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [
            { kind: "checkpointSave", label: "savepoint" },
            { kind: "text", body: "이곳에 모험을 기록했다." },
          ],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return { summary: `${map.name}에 세이브 포인트 '${name}' 배치 (${x}, ${y})`, data: { eventId: id, x, y } };
  },
};
```

`EVENT_TOOLS` 배열의 `placeTrap,` 뒤에 `placeChest, placeSavepoint,` 추가.

`src/editor/agentGhostPreview.ts`의 `summarizeAgentGhostPreviewForToolCall` switch에 케이스 추가(`place_battle_blocker` 케이스 아래):

```ts
    case "place_chest":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_chest", "보물상자 배치"));
      break;
    case "place_savepoint":
      pushArea(pointArea(project, mapId, pointFromXY(args), "place_savepoint", "세이브 포인트 배치"));
      break;
```

`EventPage`/`Trigger`/`Command` 타입은 파일 상단 import에 이미 있다. `assertEventShape(event, warnings)` 시그니처가 warnings 없이도 호출 가능한지 기존 사용부(placeNpc)로 확인.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/placeChestSavepoint.test.ts && npx tsc --noEmit 2>&1 | grep eventTools; echo "exit-grep:$?"`
Expected: PASS + `exit-grep:1`

- [ ] **Step 5: 커밋**

```bash
git add src/editor/tools/eventTools.ts src/editor/agentGhostPreview.ts test/placeChestSavepoint.test.ts
git commit -m "feat(tools): place_chest·place_savepoint 프리셋 — 코퍼스 갭 해소"
```

---

### Task 7: `mirror_region` 도구

**Files:**
- Modify: `src/editor/tools/mapTools.ts` (도구 + MAP_TOOLS 등록), `src/editor/agentGhostPreview.ts` (프리뷰 케이스)
- Test: `test/mirrorRegion.test.ts`

**Interfaces:**
- Consumes: `requireMap`(mapTools 기존), `ToolError`/`ToolDefinition`/`ToolExecResult`
- Produces: 도구 `mirror_region {mapId,x,y,w,h,axis:"horizontal"|"vertical"}` — Task 8 라우터 transform 가이드가 참조

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/mirrorRegion.test.ts
import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { emptyProject } from "@/editor/tools/emptyProject";

function setup() {
  const project = emptyProject();
  const mapId = Object.keys(project.maps)[0];
  const map = project.maps[mapId];
  // 3×2 영역 (1,1)~(3,2)에 식별 가능한 타일 패턴을 깐다
  const at = (x: number, y: number) => y * map.width + x;
  map.lowerTiles[at(1, 1)] = 101; map.lowerTiles[at(2, 1)] = 102; map.lowerTiles[at(3, 1)] = 103;
  map.lowerTiles[at(1, 2)] = 104; map.lowerTiles[at(2, 2)] = 105; map.lowerTiles[at(3, 2)] = 106;
  map.upperTiles[at(1, 1)] = 201;
  map.lowerTileStacks = { [at(1, 1)]: [301, 302] };
  map.events.push({ id: "ev_m", x: 1, y: 2, trigger: { kind: "action" }, commands: [], pages: [] } as never);
  return { project, mapId, map, at };
}

describe("mirror_region", () => {
  it("horizontal: 타일·스택·이벤트 x좌표를 좌우 대칭한다", () => {
    const { project, mapId, map, at } = setup();
    getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "horizontal" });
    expect(map.lowerTiles[at(1, 1)]).toBe(103);
    expect(map.lowerTiles[at(2, 1)]).toBe(102);
    expect(map.lowerTiles[at(3, 1)]).toBe(101);
    expect(map.lowerTiles[at(3, 2)]).toBe(104);
    expect(map.upperTiles[at(3, 1)]).toBe(201); // upper도 대칭
    expect(map.lowerTileStacks?.[at(3, 1)]).toEqual([301, 302]); // 스택 이동
    expect(map.lowerTileStacks?.[at(1, 1)]).toBeUndefined();
    const event = map.events.find((entry) => entry.id === "ev_m")!;
    expect(event.x).toBe(3); // 1 → 3 (영역 [1,3] 대칭)
    expect(event.y).toBe(2);
  });

  it("vertical: y좌표를 상하 대칭한다", () => {
    const { project, mapId, map, at } = setup();
    getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "vertical" });
    expect(map.lowerTiles[at(1, 1)]).toBe(104);
    expect(map.lowerTiles[at(1, 2)]).toBe(101);
  });

  it("영역이 맵과 겹치지 않으면 ToolError", () => {
    const { project, mapId } = setup();
    expect(() => getTool("mirror_region")!.run(project, { mapId, x: 999, y: 999, w: 2, h: 2, axis: "horizontal" })).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/mirrorRegion.test.ts`
Expected: FAIL — 도구 없음

- [ ] **Step 3: 구현**

`src/editor/tools/mapTools.ts` — `clearRegion` 정의 아래에 추가:

```ts
// 영역 대칭 변환 — LLM 판단 없는 결정적 변환(코퍼스 mirror-symmetry가 "불가"이던 갭 해소).
// 비대칭 오토타일 경계는 후처리하지 않는다(설명에 명시).
const mirrorRegion: ToolDefinition = {
  name: "mirror_region",
  description:
    "사각 영역의 타일(하위/상위/스택)과 영역 안 이벤트 좌표를 좌우(horizontal) 또는 상하(vertical)로 대칭 변환한다. 결정적 변환 — 오토타일 경계는 보정하지 않으므로 필요하면 이후 다듬기 지시를 권한다.",
  mode: "write",
  invalidArgsExample: { mapId: "map_1", x: 2, y: 2, w: 8, h: 6, axis: "horizontal" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      axis: { type: "string", enum: ["horizontal", "vertical"] },
    },
    required: ["mapId", "x", "y", "w", "h", "axis"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const axis = args.axis as "horizontal" | "vertical";
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    if (x1 <= x0 || y1 <= y0) throw new ToolError("대칭할 영역이 맵과 겹치지 않습니다.", { code: "invalid-args" });

    const mirrorX = (x: number): number => (axis === "horizontal" ? x0 + (x1 - 1) - x : x);
    const mirrorY = (y: number): number => (axis === "vertical" ? y0 + (y1 - 1) - y : y);

    const srcLower = map.lowerTiles.slice();
    const srcUpper = map.upperTiles.slice();
    const srcLowerStacks = structuredClone(map.lowerTileStacks ?? {});
    const srcUpperStacks = structuredClone(map.upperTileStacks ?? {});
    const nextLowerStacks: Record<number, number[]> = structuredClone(map.lowerTileStacks ?? {});
    const nextUpperStacks: Record<number, number[]> = structuredClone(map.upperTileStacks ?? {});

    let cells = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const di = y * map.width + x;
        const si = mirrorY(y) * map.width + mirrorX(x);
        map.lowerTiles[di] = srcLower[si];
        map.upperTiles[di] = srcUpper[si];
        const lowerStack = srcLowerStacks[si];
        if (lowerStack) nextLowerStacks[di] = lowerStack.slice();
        else delete nextLowerStacks[di];
        const upperStack = srcUpperStacks[si];
        if (upperStack) nextUpperStacks[di] = upperStack.slice();
        else delete nextUpperStacks[di];
        cells += 1;
      }
    }
    if (Object.keys(nextLowerStacks).length > 0) map.lowerTileStacks = nextLowerStacks;
    else delete map.lowerTileStacks;
    if (Object.keys(nextUpperStacks).length > 0) map.upperTileStacks = nextUpperStacks;
    else delete map.upperTileStacks;

    let movedEvents = 0;
    for (const event of map.events) {
      if (event.x < x0 || event.x >= x1 || event.y < y0 || event.y >= y1) continue;
      const nx = mirrorX(event.x);
      const ny = mirrorY(event.y);
      if (nx !== event.x || ny !== event.y) {
        event.x = nx;
        event.y = ny;
        movedEvents += 1;
      }
    }
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1 - 1},${y1 - 1}) ${axis === "horizontal" ? "좌우" : "상하"} 대칭 — ${cells}칸, 이벤트 ${movedEvents}개 이동`,
      data: { cells, movedEvents, axis },
    };
  },
};
```

`MAP_TOOLS` 배열의 `clearRegion,` 뒤에 `mirrorRegion,` 추가.

`agentGhostPreview.ts` switch에 케이스 추가(`clear_region` 아래):

```ts
    case "mirror_region":
      pushArea(rectArea(project, mapId, rectFromXYWH(args), "mirror_region", "대칭 변환"));
      break;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/mirrorRegion.test.ts`
Expected: PASS 3건

- [ ] **Step 5: 커밋**

```bash
git add src/editor/tools/mapTools.ts src/editor/agentGhostPreview.ts test/mirrorRegion.test.ts
git commit -m "feat(tools): mirror_region — 영역 좌우/상하 대칭 결정적 변환"
```

---

### Task 8: 의도 라우터 + `buildRegionTaskMessage` 통합 (코퍼스 50개 전수 테스트)

**Files:**
- Create: `src/editor/regionTask/regionIntentRouter.ts`
- Modify: `src/editor/regionTask/runRegionTask.ts` (`buildRegionTaskMessage`)
- Test: `test/regionIntentRouter.test.ts`

**Interfaces:**
- Consumes: 코퍼스 md 표(`docs/superpowers/research/2026-07-10-region-task-command-corpus.md`) — 테스트가 파싱해 기대값을 도출
- Produces: `RegionIntentCategory`(7종), `routeRegionIntent(instruction: string): RegionIntentCategory[]`, `regionIntentGuideLines(categories: readonly RegionIntentCategory[]): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/regionIntentRouter.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  regionIntentGuideLines,
  routeRegionIntent,
  type RegionIntentCategory,
} from "@/editor/regionTask/regionIntentRouter";
import { buildRegionTaskMessage } from "@/editor/regionTask/runRegionTask";

// 코퍼스 needs → 라우터 카테고리 기대값 매핑. null = 기본 가이드로 충분(기대 없음).
const NEEDS_TO_CATEGORY: Record<string, RegionIntentCategory | null> = {
  "structure-template": "structure",
  "wall-fence": "structure",
  "npc-place": "npc-shop",
  "shop": "npc-shop",
  "npc-schedule": "npc-shop",
  "teleport": "door-transfer",
  "quest-logic": "quest-trigger",
  "story-flag": "quest-trigger",
  "cutscene-script": "quest-trigger",
  "event-logic": "quest-trigger",
  "item-give": "quest-trigger",
  "battle-encounter": "battle-trap",
  "trap": "battle-trap",
  "chase-scene": "battle-trap",
  "lighting-mood": "mood",
  "mirror-symmetry": "transform",
  "repeat-pattern": "transform",
  "clear-region": "transform",
  "move-event": "transform",
  "duplicate-event": "transform",
  "tile-paint": null,
  "prop-scatter": null,
  "road": null,
  "multi-step": null,
  "passability": null,
};

interface CorpusRow { id: string; command: string; needs: string[] }

function loadCorpusRows(): CorpusRow[] {
  const md = readFileSync(
    resolve(__dirname, "../docs/superpowers/research/2026-07-10-region-task-command-corpus.md"),
    "utf8",
  );
  const start = md.indexOf("## 50개 명령어 전체");
  const rows: CorpusRow[] = [];
  for (const line of md.slice(start).split("\n")) {
    if (!line.startsWith("| ") || line.startsWith("| id") || line.startsWith("| ---")) continue;
    const cols = line.split("|").map((col) => col.trim());
    // | id | command | category | needs | feasibility | → cols[1..5]
    if (cols.length < 6) continue;
    rows.push({ id: cols[1], command: cols[2], needs: cols[4].split(",").map((need) => need.trim()) });
  }
  return rows;
}

describe("routeRegionIntent — 코퍼스 50개 전수", () => {
  const rows = loadCorpusRows();

  it("코퍼스 표를 50행 파싱한다", () => {
    expect(rows.length).toBe(50);
  });

  for (const row of rows) {
    const expected = [...new Set(
      row.needs.map((need) => NEEDS_TO_CATEGORY[need] ?? null).filter((category): category is RegionIntentCategory => category !== null),
    )];
    it(`${row.id}: [${expected.join(",") || "기본"}] ⊆ routed`, () => {
      const routed = routeRegionIntent(row.command);
      for (const category of expected) expect(routed).toContain(category);
    });
  }
});

describe("regionIntentGuideLines / buildRegionTaskMessage 통합", () => {
  it("카테고리별 가이드에 대표 도구명이 들어간다", () => {
    const lines = regionIntentGuideLines(["quest-trigger", "transform"]).join("\n");
    expect(lines).toContain("place_chest");
    expect(lines).toContain("place_savepoint");
    expect(lines).toContain("mirror_region");
  });

  it("메시지에 의도 가이드와 정직 지시가 붙는다", () => {
    const message = buildRegionTaskMessage("보물상자를 하나 숨겨줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    expect(message).toContain("place_chest");
    expect(message).toContain("못 한 것");
  });

  it("매치 없는 지시는 기본 가이드만 (place_chest 미포함)", () => {
    const message = buildRegionTaskMessage("이 영역을 잔디로 채워줘", "맵", "m1", { x: 0, y: 0, width: 4, height: 4 });
    expect(message).not.toContain("place_chest");
    expect(message).toContain("build_house_kit"); // 기본 가이드 유지
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/regionIntentRouter.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/editor/regionTask/regionIntentRouter.ts
// 영역 작업 지시의 의도를 키워드로 감지해 카테고리별 도구 가이드를 주입한다(스펙 §3-A).
// LLM 불사용 — assistantToolMode.INTENT_KEYWORDS(도구 노출 도메인)와 별개로,
// 여기서는 "가이드 문장"을 고른다. 도구 노출 자체는 지시문의 키워드가
// INTENT_KEYWORDS를 자연히 활성화하므로 별도 처리하지 않는다.

export type RegionIntentCategory =
  | "structure"
  | "npc-shop"
  | "door-transfer"
  | "quest-trigger"
  | "battle-trap"
  | "mood"
  | "transform";

export const REGION_INTENT_KEYWORDS: Readonly<Record<RegionIntentCategory, readonly string[]>> = {
  structure: [
    "집", "건물", "오두막", "여관", "성벽", "탑", "대장간", "광장", "울타리", "목장",
    "정원", "분수", "안뜰", "폐허", "농장", "밭", "매점", "다리", "벽", "시설",
  ],
  "npc-shop": [
    "npc", "주민", "상인", "경비", "손님", "대장장이", "농부", "도적", "사람",
    "순찰", "상점", "재고", "잡화", "주인",
  ],
  "door-transfer": ["문", "입구", "출구", "텔레포트", "포탈", "계단", "다음 맵", "이어지"],
  "quest-trigger": [
    "퀘스트", "조사", "표지판", "제단", "사당", "전설", "이야기", "대화", "컷신",
    "연출", "트리거", "플래그", "스위치", "상자", "보물", "열쇠", "잠긴", "잠금",
    "세이브", "저장", "우물",
  ],
  "battle-trap": ["몬스터", "전투", "인카운터", "함정", "추격", "쫓아", "적", "슬라임", "유령"],
  mood: ["조명", "분위기", "어둡", "음산", "축제", "등불", "밤", "화려", "을씨년"],
  transform: ["대칭", "반복", "복제", "옮겨", "옮기", "지워", "지우", "비우", "미러", "뒤집"],
};

const GUIDE_LINES: Readonly<Record<RegionIntentCategory, string>> = {
  structure:
    "- 구조물: build_house_kit(집·여관·대장간 등), build_wall+fill_region(울타리·안뜰·광장 바닥), stamp_structure(탑 등 스탬프), create_farm_plot(밭)",
  "npc-shop":
    "- NPC: place_npc/make_villager(주민·경비·상인 — graphic은 query로 외형 지정), set_npc_schedule(순찰·시간표), set_shop_stock(상인 재고 연결)",
  "door-transfer":
    "- 문/이동: create_transfer_pair {a:{mapId,x,y}, b:{mapId,x,y}} — 문·계단·텔레포트 왕복 쌍을 한 번에. 문 시각 배치는 place_door",
  "quest-trigger":
    "- 상호작용: place_chest(보물상자 — contents.itemId/gold 지급, 개봉 기억), place_savepoint(세이브 포인트), place_examine_hotspots(조사 지점), create_quest/declare_story_flag(퀘스트·플래그), script_cutscene(연출·대사)",
  "battle-trap":
    "- 전투: set_encounter_table/make_hunting_ground(인카운터 구역), place_battle_blocker(지키는 몬스터), place_trap(함정), make_chase_scene(추격전)",
  mood:
    "- 분위기: set_scene_mood(어둡게·축제 등 프리셋), set_lighting_volume(영역 조명), 등불·장식 소품은 place_props",
  transform:
    "- 변형: mirror_region {mapId,x,y,w,h,axis:\"horizontal\"|\"vertical\"}(대칭), clear_region(비우기), move_event/duplicate_event(이벤트 이동·복제)",
};

const CATEGORY_ORDER: readonly RegionIntentCategory[] = [
  "structure", "npc-shop", "door-transfer", "quest-trigger", "battle-trap", "mood", "transform",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function routeRegionIntent(instruction: string): RegionIntentCategory[] {
  const normalized = normalize(instruction);
  return CATEGORY_ORDER.filter((category) =>
    REGION_INTENT_KEYWORDS[category].some((keyword) => normalized.includes(keyword)),
  );
}

export function regionIntentGuideLines(categories: readonly RegionIntentCategory[]): string[] {
  return CATEGORY_ORDER.filter((category) => categories.includes(category)).map((category) => GUIDE_LINES[category]);
}
```

`runRegionTask.ts`의 `buildRegionTaskMessage`에 통합 — import 추가:

```ts
import { regionIntentGuideLines, routeRegionIntent } from "./regionIntentRouter";
```

`toolGuide` 배열 마지막 두 줄(`"- 영역 작업은 즉시 적용된다..."`, `"- 영역 밖 타일..."`) 앞에 다음을 삽입하도록 배열 구성을 변경:

```ts
  const intentGuides = regionIntentGuideLines(routeRegionIntent(instruction));
  const toolGuide = [
    "영역 작업 도구 규칙:",
    // ... 기존 기본 가이드 줄들 그대로 ...
    ...intentGuides,
    "- 지원하지 않는 요청 부분은 시도하지 말고, 마지막 응답에 '못 한 것: …' 한 줄로 명시하라",
    "- 영역 작업은 즉시 적용된다. propose_tile_vocabulary 댄스는 하지 말 것",
    "- 영역 밖 타일·이벤트는 절대 수정하지 말 것",
  ].join("\n");
```

("영역 작업은 즉시 적용된다" 문구는 세션 관점에서 여전히 참 — 세션의 제안이 곧 결과이고 승인은 그 밖의 게이트다. 문구 유지.)

키워드가 코퍼스 전수 테스트에서 빠지는 행이 나오면 **해당 카테고리 키워드 배열에 그 명령의 명사를 추가**하는 방식으로 맞춘다(테스트가 사양이다).

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/regionIntentRouter.test.ts test/regionTaskRun.test.ts`
Expected: PASS — 50행 파싱 + 전수 포함 관계 + 통합 3건 + 기존 regionTaskRun 회귀 없음

- [ ] **Step 5: 커밋**

```bash
git add src/editor/regionTask/regionIntentRouter.ts src/editor/regionTask/runRegionTask.ts test/regionIntentRouter.test.ts
git commit -m "feat(region): 의도 라우터 — 카테고리별 도구 가이드 동적 주입 (코퍼스 50개 전수 테스트)"
```

---

### Task 9: 추천 명령 칩 (`suggestedCommands` + 모달 통합)

**Files:**
- Create: `src/editor/regionTask/suggestedCommands.ts`
- Modify: `src/editor/panels/regionTaskModal.ts`, `src/styles/editor/inline-assist.css`
- Test: `test/suggestedCommands.test.ts`, `test/regionTaskModal.test.ts` (1케이스 추가)

**Interfaces:**
- Produces: `SuggestedRegionCommand { id, label, instruction, category }`, `SUGGESTED_REGION_COMMANDS`(12개 상수), `nextSuggestedRegionCommands(count?: number): SuggestedRegionCommand[]`(모듈 카운터 로테이션), `__resetSuggestedRegionRotationForTest()`. Task 10 시작 화면 카드가 재사용.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/suggestedCommands.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  SUGGESTED_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  __resetSuggestedRegionRotationForTest,
} from "@/editor/regionTask/suggestedCommands";

describe("suggestedCommands", () => {
  beforeEach(() => __resetSuggestedRegionRotationForTest());

  it("12개 상수 — id 중복 없음, instruction 비어있지 않음", () => {
    expect(SUGGESTED_REGION_COMMANDS).toHaveLength(12);
    expect(new Set(SUGGESTED_REGION_COMMANDS.map((command) => command.id)).size).toBe(12);
    for (const command of SUGGESTED_REGION_COMMANDS) expect(command.instruction.length).toBeGreaterThan(5);
  });

  it("호출마다 로테이션 — 첫 호출 [0..3], 둘째 호출 [4..7], 랩어라운드", () => {
    const first = nextSuggestedRegionCommands(4);
    const second = nextSuggestedRegionCommands(4);
    const third = nextSuggestedRegionCommands(4);
    const fourth = nextSuggestedRegionCommands(4);
    expect(first.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
    expect(second.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(4, 8).map((command) => command.id));
    expect(third.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(8, 12).map((command) => command.id));
    expect(fourth[0].id).toBe(SUGGESTED_REGION_COMMANDS[0].id); // 랩어라운드
  });
});
```

`test/regionTaskModal.test.ts` 추가 케이스:

```ts
it("추천 칩 클릭 시 입력창이 채워진다", () => {
  const root = openRegionTaskModal({ mapId: "m1", region: { x: 0, y: 0, width: 2, height: 2 } });
  const chips = findByTestId(root, "region-task-suggestions");
  expect(chips).not.toBeNull();
  const firstChip = chips!.querySelector("button") as HTMLElement;
  firstChip.dispatchEvent(new Event("click"));
  const input = findByTestId(root, "region-task-input") as HTMLTextAreaElement;
  expect(input.value.length).toBeGreaterThan(5);
  closeRegionTaskModal();
});
```

(fakeDom에 `querySelector`가 없으면 칩에 `region-suggest-{id}` testid가 있으므로 `findByTestId(root, \`region-suggest-${SUGGESTED_REGION_COMMANDS[0].id}\`)`… 로테이션 때문에 첫 칩 id를 특정할 수 없으니, 테스트 시작 시 `__resetSuggestedRegionRotationForTest()`를 불러 첫 4개가 상수 [0..3]이 되게 한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/suggestedCommands.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/editor/regionTask/suggestedCommands.ts
// 영역 작업 추천 명령 — 코퍼스(2026-07-10 corpus.md)에서 "가능" 판정 + 범용
// (특정 타일셋/기존 지물 의존 없음)만 선별한 12개. 모달이 열릴 때마다 4개씩 로테이션.
export interface SuggestedRegionCommand {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
  readonly category: string;
}

export const SUGGESTED_REGION_COMMANDS: readonly SuggestedRegionCommand[] = [
  { id: "round-pond", label: "🌊 둥근 호수", instruction: "여기에 둥근 호수를 만들어줘", category: "타일" },
  { id: "small-cottage", label: "🏠 오두막", instruction: "이 영역에 작은 오두막 한 채 지어줘", category: "구조물" },
  { id: "flower-scatter", label: "🌸 꽃밭", instruction: "여기 잔디밭에 꽃이랑 잡초를 자연스럽게 흩뿌려줘", category: "다듬기" },
  { id: "treasure-chest", label: "🎁 보물상자", instruction: "이 방에 보물상자를 하나 숨겨줘", category: "상호작용" },
  { id: "merchant-npc", label: "🧑‍🌾 상인", instruction: "이 자리에 잡화점 상인 NPC 하나 배치해줘", category: "NPC" },
  { id: "pasture-fence", label: "🐄 목장 울타리", instruction: "이 구역에 울타리를 둘러서 목장을 만들어줘", category: "구조물" },
  { id: "garden", label: "🌳 정원", instruction: "이 영역에 화단과 나무로 정원을 조성해줘", category: "구조물" },
  { id: "gate-guards", label: "💂 경비병", instruction: "여기 입구 앞에 경비병 두 명 세워줘", category: "NPC" },
  { id: "inn-guests", label: "🛏️ 여관", instruction: "이 공터에 여관을 짓고 손님 NPC 몇 명과 주인을 배치해줘", category: "복합" },
  { id: "festival", label: "🏮 축제 분위기", instruction: "이 광장에 축제 분위기 내게 등불이랑 좌판, 상인들 배치해줘", category: "복합" },
  { id: "dark-mood", label: "🌑 음산한 조명", instruction: "이 방을 어둡고 음산한 조명으로 바꿔줘", category: "분위기" },
  { id: "encounter-zone", label: "⚔️ 몬스터 구역", instruction: "이 영역에 들어서면 슬라임이 나오는 인카운터 구역으로 설정해줘", category: "전투" },
] as const;

let rotation = 0;

/** 모달이 열릴 때 4개(기본)를 순서대로 로테이션해 돌려준다. */
export function nextSuggestedRegionCommands(count = 4): SuggestedRegionCommand[] {
  const total = SUGGESTED_REGION_COMMANDS.length;
  const start = rotation % total;
  rotation = (rotation + count) % total;
  return Array.from({ length: Math.min(count, total) }, (_, index) => SUGGESTED_REGION_COMMANDS[(start + index) % total]);
}

export function __resetSuggestedRegionRotationForTest(): void {
  rotation = 0;
}
```

`regionTaskModal.ts` — textarea 아래 추천 칩 행 추가:

```ts
import { nextSuggestedRegionCommands } from "@/editor/regionTask/suggestedCommands";
```

`textarea` 생성 직후:

```ts
  const suggestions = nextSuggestedRegionCommands(4);
  if (!options.initialInstruction) {
    textarea.setAttribute("placeholder", `이 영역에 무엇을 할까요? 예: ${suggestions[0].instruction}`);
  }
  const suggestionRow = el("div", {
    class: "region-task-suggestions",
    dataset: { testid: "region-task-suggestions" },
    children: suggestions.map((command) =>
      el("button", {
        class: "region-task-suggest-chip",
        text: command.label,
        attrs: { type: "button", title: command.instruction },
        dataset: { testid: `region-suggest-${command.id}` },
        on: {
          click: () => {
            textarea.value = command.instruction;
            textarea.focus();
          },
        },
      }),
    ),
  });
```

`windowNode` children: `[header, textarea, suggestionRow, log, summary, compareHost, actions]`.

CSS(`inline-assist.css` 말미):

```css
.region-task-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.region-task-suggest-chip {
  background: color-mix(in srgb, var(--editor-popover-bg, #151b2c) 88%, #fff);
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 999px;
  color: var(--editor-text-muted, #9aa8c7);
  cursor: pointer;
  font: 500 11px/1 var(--font-ui, system-ui, sans-serif);
  padding: 5px 10px;
  white-space: nowrap;
}

.region-task-suggest-chip:hover,
.region-task-suggest-chip:focus-visible {
  border-color: var(--editor-blue, #3d6df0);
  color: var(--editor-text, #e8eefc);
  outline: none;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/suggestedCommands.test.ts test/regionTaskModal.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/editor/regionTask/suggestedCommands.ts src/editor/panels/regionTaskModal.ts src/styles/editor/inline-assist.css test/suggestedCommands.test.ts test/regionTaskModal.test.ts
git commit -m "feat(region): 추천 명령 칩 12종 로테이션 — 모달 발견성"
```

---

### Task 10: 기본 모드 시작 화면 카드 2종

**Files:**
- Create: `src/editor/panels/aiStartScreenCards.ts`
- Modify: `src/editor/panels/aiChatPanel.ts` (`buildStartScreen`, 1100행 부근), `src/styles/editor/inline-assist.css`
- Test: `test/aiStartScreenCards.test.ts`

**Interfaces:**
- Consumes: Task 9 `nextSuggestedRegionCommands`, `listAiActivityLogs`/`AiActivityLogRecord` (`@/ai/activityLog` — 최신순 반환)
- Produces: `buildTryRegionCard({ commands, onPick })`, `buildRecentAiWorkCard(records, now): HTMLElement | null`, `formatRelativeTime(iso, now)`, `summarizeActivityResult(record)`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// test/aiStartScreenCards.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { installFakeDom, findByTestId } from "./fakeDom";
import {
  buildRecentAiWorkCard,
  buildTryRegionCard,
  formatRelativeTime,
  summarizeActivityResult,
} from "@/editor/panels/aiStartScreenCards";
import type { AiActivityLogRecord } from "@/ai/activityLog";

beforeEach(() => installFakeDom());

const NOW = new Date("2026-07-10T12:00:00Z");

function record(overrides: Partial<AiActivityLogRecord> = {}): AiActivityLogRecord {
  return {
    id: "log1",
    at: "2026-07-10T11:55:00Z",
    channel: "region",
    instruction: "이 영역을 잔디로 채워줘",
    result: { ok: true, applied: true, changedCells: 34, changedEvents: 2 },
    toolCalls: [],
    audit: [],
    ...overrides,
  } as AiActivityLogRecord;
}

describe("formatRelativeTime", () => {
  it("분/시간/일 단위", () => {
    expect(formatRelativeTime("2026-07-10T11:59:40Z", NOW)).toBe("방금 전");
    expect(formatRelativeTime("2026-07-10T11:55:00Z", NOW)).toBe("5분 전");
    expect(formatRelativeTime("2026-07-10T09:00:00Z", NOW)).toBe("3시간 전");
    expect(formatRelativeTime("2026-07-08T12:00:00Z", NOW)).toBe("2일 전");
  });
});

describe("summarizeActivityResult", () => {
  it("적용/오류/무변경을 요약한다", () => {
    expect(summarizeActivityResult(record())).toBe("34칸 · 이벤트 2건");
    expect(summarizeActivityResult(record({ result: { ok: false, applied: false, error: "boom" } as never }))).toBe("오류");
    expect(summarizeActivityResult(record({ result: { ok: true, applied: false, changedCells: 0, changedEvents: 0 } as never }))).toBe("변경 없음");
  });
});

describe("buildTryRegionCard", () => {
  it("예시 칩 클릭 시 onPick에 instruction을 넘긴다", () => {
    const picked: string[] = [];
    const card = buildTryRegionCard({
      commands: [{ id: "c1", label: "🌊 호수", instruction: "둥근 호수를 만들어줘", category: "타일" }],
      onPick: (instruction) => picked.push(instruction),
    });
    expect(findByTestId(card, "ai-start-try-region")).not.toBeNull();
    findByTestId(card, "ai-start-try-c1")!.dispatchEvent(new Event("click"));
    expect(picked).toEqual(["둥근 호수를 만들어줘"]);
  });
});

describe("buildRecentAiWorkCard", () => {
  it("기록이 있으면 최근 항목을 렌더, 없으면 null", () => {
    const card = buildRecentAiWorkCard([record()], NOW);
    expect(card).not.toBeNull();
    expect(findByTestId(card!, "ai-start-recent-work")).not.toBeNull();
    expect(card!.textContent).toContain("34칸");
    expect(card!.textContent).toContain("5분 전");
    expect(buildRecentAiWorkCard([], NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run test/aiStartScreenCards.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/editor/panels/aiStartScreenCards.ts
// 기본 모드 시작 화면 카드(스펙 §5) — "이렇게 해보세요" + "최근 AI 작업".
// aiChatPanel.buildStartScreen이 basic 모드에서만 삽입한다. 표시 전용(YAGNI).
import type { AiActivityLogRecord } from "@/ai/activityLog";
import type { SuggestedRegionCommand } from "@/editor/regionTask/suggestedCommands";
import { el } from "@/util/dom";

export function formatRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function summarizeActivityResult(record: AiActivityLogRecord): string {
  if (!record.result.ok) return "오류";
  const cells = record.result.changedCells ?? 0;
  const events = record.result.changedEvents ?? 0;
  if (cells === 0 && events === 0) return "변경 없음";
  const parts: string[] = [];
  if (cells > 0) parts.push(`${cells}칸`);
  if (events > 0) parts.push(`이벤트 ${events}건`);
  return parts.join(" · ");
}

export function buildTryRegionCard(opts: {
  readonly commands: readonly SuggestedRegionCommand[];
  readonly onPick: (instruction: string) => void;
}): HTMLElement {
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-try-region" },
    children: [
      el("div", { class: "ai-start-basic-card-title", text: "이렇게 해보세요" }),
      el("div", {
        class: "ai-start-basic-card-body",
        text: "맵에서 영역을 드래그로 선택하면 ✨ 칩이 뜹니다. 아래 예시를 눌러 바로 시작할 수도 있어요.",
      }),
      el("div", {
        class: "ai-start-basic-chips",
        children: opts.commands.map((command) =>
          el("button", {
            class: "ai-start-basic-chip",
            text: command.label,
            attrs: { type: "button", title: command.instruction },
            dataset: { testid: `ai-start-try-${command.id}` },
            on: { click: () => opts.onPick(command.instruction) },
          }),
        ),
      }),
    ],
  });
}

export function buildRecentAiWorkCard(records: readonly AiActivityLogRecord[], now: Date): HTMLElement | null {
  if (records.length === 0) return null; // 빈 카드 금지(스펙 §5)
  const rows = records.slice(0, 3).map((record) =>
    el("div", {
      class: "ai-start-recent-row",
      children: [
        el("span", { class: "ai-start-recent-instruction", text: record.instruction.slice(0, 40) }),
        el("span", { class: "ai-start-recent-meta", text: `${summarizeActivityResult(record)} · ${formatRelativeTime(record.at, now)}` }),
      ],
    }),
  );
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-recent-work" },
    children: [el("div", { class: "ai-start-basic-card-title", text: "최근 AI 작업" }), ...rows],
  });
}
```

`aiChatPanel.ts`의 `buildStartScreen` — `el("div", { class: "ai-start-sub", ... })` 다음에 삽입:

```ts
import { listAiActivityLogs } from "@/ai/activityLog";
import { buildRecentAiWorkCard, buildTryRegionCard } from "@/editor/panels/aiStartScreenCards";
import { nextSuggestedRegionCommands } from "@/editor/regionTask/suggestedCommands";
```

```ts
    // 기본 모드 전용 발견성 카드 — 채팅 시작 시 시작 화면과 함께 사라진다(스펙 §5).
    const basicCards: HTMLElement[] = [];
    if (typeof document !== "undefined" && document.body?.classList?.contains?.("editor-ui-basic")) {
      basicCards.push(
        buildTryRegionCard({
          commands: nextSuggestedRegionCommands(3),
          onPick: (instruction) => {
            input.value = instruction;
            input.focus();
          },
        }),
      );
      const recent = buildRecentAiWorkCard(listAiActivityLogs(3), new Date());
      if (recent) basicCards.push(recent);
    }
```

children 배열: `...resume` 다음, `ai-start-grid` 앞에 `...basicCards` 삽입. (`input`은 aiChatPanel의 채팅 입력 요소 변수 — buildStartScreen이 참조 가능한 스코프인지 확인하고, 아니면 `onPick`에서 `panelRoot.querySelector('[data-testid="ai-chat-input"]')` 대신 **함수 정의 순서를 조정해 클로저로 접근**한다. aiChatPanel에서 입력 요소의 실제 변수명/testid는 `rg -n "textarea|ai-chat-input" src/editor/panels/aiChatPanel.ts | head`로 확인.)

CSS(`inline-assist.css` 말미):

```css
/* 기본 모드 시작 화면 카드 */
.ai-start-basic-card {
  background: color-mix(in srgb, var(--editor-popover-bg, #151b2c) 92%, #fff);
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0;
  padding: 12px 14px;
  text-align: left;
}

.ai-start-basic-card-title {
  color: var(--editor-text, #e8eefc);
  font: 700 12px/1.2 var(--font-ui, system-ui, sans-serif);
}

.ai-start-basic-card-body {
  color: var(--editor-text-muted, #9aa8c7);
  font: 500 12px/1.5 var(--font-ui, system-ui, sans-serif);
}

.ai-start-basic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-start-basic-chip {
  background: transparent;
  border: 1px solid var(--editor-line, #2a3550);
  border-radius: 999px;
  color: var(--editor-text-muted, #9aa8c7);
  cursor: pointer;
  font: 500 11px/1 var(--font-ui, system-ui, sans-serif);
  padding: 5px 10px;
}

.ai-start-basic-chip:hover,
.ai-start-basic-chip:focus-visible {
  border-color: var(--editor-blue, #3d6df0);
  color: var(--editor-text, #e8eefc);
  outline: none;
}

.ai-start-recent-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-start-recent-instruction {
  color: var(--editor-text, #e8eefc);
  font: 500 12px/1.3 var(--font-ui, system-ui, sans-serif);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-start-recent-meta {
  color: var(--editor-text-soft, #7f8db0);
  font: 500 11px/1.2 var(--font-ui, system-ui, sans-serif);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/aiStartScreenCards.test.ts test/aiChatPanelSettings.test.ts test/aiChatPanelUxRepairs.test.ts`
Expected: PASS (aiChatPanel 기존 테스트 회귀 없음 — 기본 모드 body 클래스 없는 테스트 환경에서는 카드가 안 붙으므로 기존 스냅샷 유지)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/aiStartScreenCards.ts src/editor/panels/aiChatPanel.ts src/styles/editor/inline-assist.css test/aiStartScreenCards.test.ts
git commit -m "feat(basic): 시작 화면 카드 — 이렇게 해보세요·최근 AI 작업"
```

---

### Task 11: E2E — 승인 게이트 전체 흐름

**Files:**
- Modify: `src/editor/editorToolHook.ts` (`__rpgzzuRegionTaskHarness`에 `currentMapId` 추가)
- Create: `test/e2e/region-approval-gate.spec.ts`

**Interfaces:**
- Consumes: `__rpgzzuRegionTaskHarness.runMock(mapId, region, writes)`(기존), `__rpgzzuRegionTaskPending`(Task 1), testids(Task 2·5·9)

- [ ] **Step 1: harness에 currentMapId 추가**

`src/editor/editorToolHook.ts`의 `w.__rpgzzuRegionTaskHarness = {` 객체에 추가(타입 선언 `RegionTaskHarness`에도 동일 필드 추가):

```ts
    currentMapId: () => editorState.get().mapId,
```

(`editorState.get().mapId` 필드명이 다르면 — `rg -n "mapId" src/editor/editorState.ts | head`로 실제 현재 맵 상태 필드를 확인해 그것을 반환.)

- [ ] **Step 2: E2E 스펙 작성**

```ts
// test/e2e/region-approval-gate.spec.ts
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __rpgzzuRegionTaskHarness?: {
      currentMapId: () => string;
      runMock: (mapId: string, region: { x: number; y: number; width: number; height: number }, writes: { x: number; y: number; layer: "lower" | "upper"; tile: number }[]) => Promise<{ applied: boolean; ok: boolean }>;
      readCell: (mapId: string, layer: "lower" | "upper", x: number, y: number) => number | null;
      openModal: (mapId: string, region: { x: number; y: number; width: number; height: number }) => void;
    };
    __rpgzzuRegionTaskPending?: { get: () => unknown; apply: () => void; discard: () => void };
  }
}

const REGION = { x: 2, y: 2, width: 4, height: 3 };

test.beforeEach(async ({ page }) => {
  await page.goto("/?freshProject=1");
  await page.waitForFunction(() => Boolean(window.__rpgzzuRegionTaskHarness));
});

test("runMock은 즉시 적용하지 않고 pending을 만든다 — 적용 시 셀 반영", async ({ page }) => {
  const initial = await page.evaluate(async (region) => {
    const harness = window.__rpgzzuRegionTaskHarness!;
    const mapId = harness.currentMapId();
    const before = harness.readCell(mapId, "lower", 3, 3);
    const result = await harness.runMock(mapId, region, [{ x: 3, y: 3, layer: "lower", tile: 342 }]);
    return {
      mapId,
      before,
      applied: result.applied,
      afterRun: harness.readCell(mapId, "lower", 3, 3),
      pending: Boolean(window.__rpgzzuRegionTaskPending?.get()),
    };
  }, REGION);
  expect(initial.applied).toBe(false);
  expect(initial.afterRun).toBe(initial.before); // 아직 미적용
  expect(initial.pending).toBe(true);

  // 캔버스 인라인 툴바 노출 (고스트 유지)
  await expect(page.getByTestId("ghost-inline-accept")).toBeVisible();
  await expect(page.getByTestId("ghost-inline-hold-origin")).toBeVisible();

  const afterApply = await page.evaluate((mapId) => {
    window.__rpgzzuRegionTaskPending!.apply();
    return window.__rpgzzuRegionTaskHarness!.readCell(mapId, "lower", 3, 3);
  }, initial.mapId);
  expect(afterApply).toBe(342);
  await expect(page.getByTestId("ghost-inline-accept")).toHaveCount(0); // settle 후 툴바 제거
});

test("버리기 시 맵이 변하지 않는다", async ({ page }) => {
  const outcome = await page.evaluate(async (region) => {
    const harness = window.__rpgzzuRegionTaskHarness!;
    const mapId = harness.currentMapId();
    const before = harness.readCell(mapId, "lower", 4, 3);
    await harness.runMock(mapId, region, [{ x: 4, y: 3, layer: "lower", tile: 342 }]);
    window.__rpgzzuRegionTaskPending!.discard();
    return { before, after: harness.readCell(mapId, "lower", 4, 3), pending: window.__rpgzzuRegionTaskPending!.get() };
  }, REGION);
  expect(outcome.after).toBe(outcome.before);
  expect(outcome.pending).toBeNull();
});

test("영역 작업 모달 — 추천 칩이 입력창을 채운다", async ({ page }) => {
  await page.evaluate((region) => {
    const harness = window.__rpgzzuRegionTaskHarness!;
    harness.openModal(harness.currentMapId(), region);
  }, REGION);
  const chips = page.getByTestId("region-task-suggestions");
  await expect(chips).toBeVisible();
  await chips.locator("button").first().click();
  const value = await page.getByTestId("region-task-input").inputValue();
  expect(value.length).toBeGreaterThan(5);
});
```

- [ ] **Step 3: 실행 확인**

Run: `npx playwright test test/e2e/region-approval-gate.spec.ts --reporter=line`
Expected: 3 passed. runMock의 mock 세션이 `stoppedReason: "final"`을 반환하므로 게이트 경로를 탄다. `validateLayoutPlacement`가 tile 342 쓰기를 차단하면(pending 대신 검증 오류) — 차단되지 않는 다른 tile 값(기존 runMock 사용 테스트가 쓰는 값이 있으면 그것)으로 조정.

- [ ] **Step 4: 3회 반복 안정성**

Run: `for i in 1 2 3; do npx playwright test test/e2e/region-approval-gate.spec.ts --reporter=line || break; done`
Expected: 3회 모두 3 passed

- [ ] **Step 5: 커밋**

```bash
git add src/editor/editorToolHook.ts test/e2e/region-approval-gate.spec.ts
git commit -m "test(e2e): 영역 작업 승인 게이트 — pending·적용/버리기·추천 칩"
```

---

## 최종 검증 (컨트롤러 수행 — 태스크 아님)

1. 전체 vitest: 신규 실패 0건(베이스라인 ~52건 외).
2. E2E: `region-approval-gate.spec.ts` + `responsive-shell.spec.ts` 통과.
3. 실측(실제 LLM + 브라우저): 카테고리별 대표 8~12개 명령 실행 — before/after 썸네일·원본 보기·적용/버리기·place_chest/place_savepoint/mirror_region 결과 확인.
4. `.superpowers/sdd/progress.md`에 후속 이슈 기록: 채팅(비영역) 제안과 영역 pending의 인라인 툴바 경합(마지막 등록 우선), 다리(bridge) 스탬프, 이벤트 썸네일 차셋 스프라이트 렌더.
