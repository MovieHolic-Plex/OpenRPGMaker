# 에디터 「공방」 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에디터 왼쪽 활동 막대 「공방」에서 하네스(1단계는 손 도트 실내 기물 하나)를 열어, 사용자의 AI 계정으로 후보 5장을 그리기 → 검사 → 자기 점검 → 독립 검수 → 다시 그리기까지 돌리고, 사용자가 화면에서 고르거나 버린다.

**Architecture:** 하네스 공용 실행기(`src/harnesses/_core/workshop/`)가 큐·시도·검수·저장을 맡고, 하네스는 `WorkshopRunner` 하나(팔레트·기물·지시문·검사·판정)만 준다. 매니페스트에 `workshop` 지연 로더를 덧붙여 에디터는 레지스트리로만 하네스를 찾는다. 후보는 팔레트 키 격자로 이 기기의 IndexedDB(`oprn-workshop`)에 두고, 화면이 그때그때 그린다. 칩셋에 굽기는 2단계다.

**Tech Stack:** TypeScript(브라우저), `chatCompletion`(src/ai/llmClient.ts), IndexedDB(+ 메모리 폴백), vitest + fake-indexeddb(테스트), Playwright(화면 캡처).

**Spec:** `docs/superpowers/specs/2026-10-02-workshop-editor-design.md` (1단계. 저장 절은 IndexedDB 로 고쳐졌다)

## Global Constraints

- 작업 공간: `/home/main/z-project/rpg-zzu-workshop` (브랜치 `agent/workshop`). 메인 체크아웃에서 편집하지 않는다.
- **테스트·타입 검사 실행은 사용자가 그 메시지에서 허락한 것만** (AGENTS.md hard rule). 허락이 없으면 각 Task 의 「Run」 단계를 건너뛰고 보고에 「미실행」으로 적는다. `npm run gates`, 전체 `npm test`, 전체 typecheck, `git stash` 는 어떤 경우에도 하지 않는다.
- 허락된 경우의 실행 형식: `cd /home/main/z-project/rpg-zzu-workshop && npx vitest run <파일> --configLoader bundle` (한 파일씩).
- 커밋 꼬리: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. 작업 단위마다 로컬 커밋, push·PR 은 마지막에 따로.
- dev 서버는 `npm run dev:worktree` 로만(이 워크트리 포트 9803). vite 직접 호출 금지.
- 제품명은 OPRN. 화면 문구는 한국어, 쉬운 말.
- 사람만 고른다 — 실행기·감독이 후보를 고르거나 바꿔 끼우지 않는다.
- 검수 통과는 보증이 아니다 — 화면에 「검수 통과」라고만 쓴다(「3/4 ✓」 같은 확정 표현 금지).
- 매니페스트 형식(`src/harnesses/_core/manifest.ts`)은 덧붙이기만 한다(다른 스레드가 같이 쓴다).
- API 키·자격 증명을 코드·문서·증거에 남기지 않는다. LegacyDb·Supabase 에 쓰지 않는다.
- 꼭대기 면 규칙 수치: `TOP_MIN = 3` (바닥 기물·북쪽 벽 앞 기물만), 검수 최대 시도 3, 해석 고치기 최대 2, 동시 기본 3(1~6).

---

## 파일 지도

| 파일 | 책임 |
|---|---|
| `src/harnesses/_core/manifest.ts` (수정) | `workshop?: () => Promise<WorkshopRunner>` 덧붙임 |
| `src/harnesses/_core/registry.ts` (수정) | `INTERIOR_PROPS_HARNESS` 한 줄, `workshopHarnesses()` |
| `src/harnesses/_core/workshop/types.ts` | 공용 타입(격자·판·후보·실행기 계약) |
| `src/harnesses/_core/workshop/grid.ts` | 팔레트·답 해석·격자 ↔ 그림 |
| `src/harnesses/_core/workshop/store.ts` | IndexedDB 저장소 + 메모리 폴백 |
| `src/harnesses/_core/workshop/engine.ts` | 큐·시도·검수·취소·재개·429 |
| `src/harnesses/interior-props/harness.ts` | 매니페스트 |
| `src/harnesses/interior-props/editor/v5Palette.json` | v5.pal 램프(생성) |
| `src/harnesses/interior-props/editor/viewFail.json` | 3/4 전수조사 위반 원본(생성, 기준 그림에서 뺀다) |
| `src/harnesses/interior-props/editor/palette.ts` | 기물별 팔레트 |
| `src/harnesses/interior-props/editor/items.ts` | 기물 사전(번들 사양 + 새 정의), 시트 자르기 |
| `src/harnesses/interior-props/editor/checks.ts` | 깨짐 검사·꼭대기 면 판정·검수 답 해석 |
| `src/harnesses/interior-props/editor/prompts.ts` | 방향·그리기/자기 점검/검수 메시지 |
| `src/harnesses/interior-props/editor/runner.ts` | `createInteriorRunner()` |
| `public/assets/harnesses/interior-props/examples/*.png` | 3/4 예시 9장(복사) |
| `src/ai/assistantEndpoint.ts` (수정) | 표면 `workshop-draw`·`workshop-review` |
| `src/editor/workshop/pixels.ts` | 브라우저 그림 읽기·PNG 쓰기 |
| `src/editor/workshop/chat.ts` | 기본 채팅 함수 + 준비 판정(+ dev 가짜 훅) |
| `src/editor/workshop/workshopSession.ts` | 프로젝트별 실행기·엔진·저장소 묶음 |
| `src/editor/workshop/workshopWorkspace.ts` | 오버레이 셸·기물 목록·키보드 |
| `src/editor/workshop/workshopRoundView.ts` | 판 카드·고르기/버리기·비교 |
| `src/editor/workshop/workshopItemForm.ts` | 새 기물 정의 폼 |
| `src/editor/panels/leftWorkshopPane.ts` | 왼쪽 판 |
| `src/editor/panels/aiSidebarWorkspace.ts` (수정) | `PANES` 에 `workshop` |
| `src/styles/database/workshop/index.css`, `workshop.css` | 화면 스타일 |
| `test/workshop/*.test.ts` | 단위 시험 |
| `scripts/qa/workshop-capture.mjs` | 가짜 모델로 화면 캡처 |
| `openwiki/harnesses/interior-props.md`, `openwiki/editor-workshop.md` | 문서 |

---

### Task 1: 공용 타입 + 격자 (`_core/workshop/types.ts`, `grid.ts`)

**Files:**
- Create: `src/harnesses/_core/workshop/types.ts`
- Create: `src/harnesses/_core/workshop/grid.ts`
- Test: `test/workshop/workshopGrid.test.ts`

**Interfaces:**
- Consumes: `ChatMessage`, `ChatRequest` 타입(`@/ai/llmClient`)
- Produces: 아래 types.ts 의 모든 타입, grid.ts 의 `TRANSPARENT`, `makePalette`, `colorId`, `hexOf`, `extractJsonObject`, `parseDrawAnswer`, `gridToAnswer`, `renderGrid`, `scaleImage`, `onBackground`, `imageToGrid`, `collectOpaqueColors`, `opaqueBounds`

- [ ] **Step 1: types.ts 를 쓴다**

```ts
// src/harnesses/_core/workshop/types.ts
/**
 * 에디터 「공방」 공용 타입. 하네스는 WorkshopRunner 하나를 주고, 큐·시도·검수·저장은 engine 이 맡는다.
 * 후보는 그림이 아니라 팔레트 키 격자로 저장한다 — 16~48px 라 수백 바이트이고 화면이 그때그때 그린다.
 */
import type { ChatMessage, ChatRequest } from "@/ai/llmClient";

export type Rgba = readonly [number, number, number, number];
export type PaletteEntry = { readonly key: string; readonly rgba: Rgba; readonly label?: string };
export type Palette = {
  readonly entries: readonly PaletteEntry[];
  readonly byKey: ReadonlyMap<string, PaletteEntry>;
  /** 같은 색이 둘이면 먼저 나온 키 */
  readonly byColor: ReadonlyMap<string, PaletteEntry>;
};
/** 화소마다 팔레트 키, null = 투명. 행 우선(y * width + x). */
export type Grid = { readonly width: number; readonly height: number; readonly cells: readonly (string | null)[] };
export type RgbaImage = { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray };
export type ParsedDraw =
  | { readonly ok: true; readonly grid: Grid; readonly note: string; readonly topRows: number | null }
  | { readonly ok: false; readonly error: string };

export type WorkshopItem = {
  /** 번들 사양 id 또는 `new:<슬러그>` */
  readonly key: string;
  readonly title: string;
  readonly description: string;
  /** floor 바닥 기물 · wall 북쪽 벽 앞 · hang 벽면 걸이 · flat 바닥 무늬 */
  readonly kind: string;
  readonly category: string;
  /** 캔버스 px */
  readonly width: number;
  readonly height: number;
  /** 위쪽 비워 둘 줄 수(지금 그림의 투명 윗줄) */
  readonly padTop: number;
  readonly isNew: boolean;
  /** 가장 닮은 기존 기물 key */
  readonly refs: readonly string[];
  readonly use: readonly string[];
};

/** 사용자가 공방에서 정의한 새 기물 */
export type ItemDefinition = {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly tilesW: number;
  readonly tilesH: number;
  /** 발밑 칸 위로 솟는 px */
  readonly rise: number;
  readonly kind: string;
  readonly category: string;
  readonly use: readonly string[];
  readonly refs: readonly string[];
};

export type Direction = { readonly letter: string; readonly text: string };

export type Verdict = {
  readonly verdict: "PASS" | "FAIL";
  readonly codes: readonly string[];
  readonly top: string;
  readonly topRows: number | null;
  readonly reasons: string;
  readonly fix: string;
  readonly worse: boolean;
};

export type RunStatus = "queued" | "drawing" | "reviewing" | "done" | "failed" | "cancelled";
export type RunAttempt = { readonly attempt: number; readonly hard: readonly string[]; readonly verdict: Verdict | null; readonly grid: Grid | null };
export type WorkshopRun = {
  readonly letter: string;
  readonly direction: string;
  status: RunStatus;
  /** 지금(또는 마지막) 시도 번호, 1부터 */
  attempt: number;
  attempts: RunAttempt[];
  grid: Grid | null;
  note: string;
  topRows: number | null;
  verdict: Verdict | null;
  error: string | null;
  /** 이 장에 쓴 모델 호출 수 */
  calls: number;
  /** 사용자가 이 장만 다시 그리라며 남긴 말 */
  redrawNote: string;
  startedAt: number | null;
  finishedAt: number | null;
};
export type WorkshopRound = {
  readonly id: string;
  readonly projectKey: string;
  readonly harnessId: string;
  readonly itemKey: string;
  readonly note: string;
  readonly created: number;
  runs: WorkshopRun[];
};
export type WorkshopPick = { readonly projectKey: string; readonly itemKey: string; readonly roundId: string; readonly letter: string; readonly at: number };
export type WorkshopFeedback = {
  readonly id: string;
  readonly projectKey: string;
  readonly itemKey: string;
  readonly roundId: string;
  readonly letter: string | null;
  readonly verdict: "pick" | "reject";
  readonly reasons: readonly string[];
  readonly note: string;
  readonly at: number;
};

export type AnchorSample = { readonly itemKey: string; readonly title: string; readonly grid: Grid; readonly picked: boolean };
export type RejectedSample = { readonly grid: Grid; readonly reasons: readonly string[]; readonly note: string };

export type DrawContext = {
  readonly item: WorkshopItem;
  readonly palette: Palette;
  readonly direction: Direction;
  readonly roundNote: string;
  readonly redrawNote: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  /** 지난 시도의 격자(다시 그리기면 여기서 출발) */
  readonly previousGrid: Grid | null;
  readonly lastVerdict: Verdict | null;
  readonly current: Grid | null;
  readonly anchors: readonly AnchorSample[];
  readonly rejected: readonly RejectedSample[];
  /** 이 기물에 사용자가 남긴 지난 말 */
  readonly notes: readonly string[];
};
export type ReviewContext = {
  readonly item: WorkshopItem;
  readonly palette: Palette;
  readonly direction: Direction;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly candidate: Grid;
  readonly current: Grid | null;
  readonly anchors: readonly AnchorSample[];
  readonly previousVerdict: Verdict | null;
};

export interface WorkshopEnv {
  loadImage(url: string): Promise<RgbaImage>;
  /** data:image/png;base64,… */
  encodePng(image: RgbaImage): string;
  /** 공개 자산 경로(앞 / 없이) → 이 앱에서 쓸 URL */
  assetUrl(path: string): string;
}

export type WorkshopSurface = "workshop-draw" | "workshop-review";
/** 모델 한 번 호출 → 답 글. 오류는 그대로 던진다(status 가 있으면 401·429 판정에 쓴다). */
export type ChatFn = (surface: WorkshopSurface, request: ChatRequest) => Promise<string>;

export interface WorkshopRunner {
  readonly harnessId: string;
  /** 한 판의 후보 수 */
  readonly candidates: number;
  /** 시트·예시 그림 읽기. 여러 번 불러도 한 번만 한다. */
  prepare(env: WorkshopEnv): Promise<void>;
  items(defs: readonly ItemDefinition[]): WorkshopItem[];
  palette(item: WorkshopItem): Palette;
  currentGrid(item: WorkshopItem): Grid | null;
  directions(item: WorkshopItem): Direction[];
  /** picked = 이 프로젝트에서 사용자가 고른 후보들 */
  anchors(item: WorkshopItem, picked: readonly AnchorSample[]): AnchorSample[];
  drawMessages(ctx: DrawContext, env: WorkshopEnv): Promise<ChatMessage[]>;
  selfCheckMessage(ctx: DrawContext, grid: Grid, env: WorkshopEnv): ChatMessage;
  reviewMessages(ctx: ReviewContext, env: WorkshopEnv): Promise<ChatMessage[]>;
  hardCheck(item: WorkshopItem, grid: Grid): string[];
  parseVerdict(text: string): Verdict;
  gate(item: WorkshopItem, verdict: Verdict): Verdict;
}
```

- [ ] **Step 2: 실패하는 격자 시험을 쓴다**

```ts
// test/workshop/workshopGrid.test.ts
import { describe, expect, it } from "vitest";
import {
  collectOpaqueColors, gridToAnswer, imageToGrid, makePalette, onBackground, opaqueBounds,
  parseDrawAnswer, renderGrid, scaleImage,
} from "@/harnesses/_core/workshop/grid";

const palette = makePalette([
  { key: "wood:2", rgba: [99, 49, 11, 255] },
  { key: "wood:6", rgba: [183, 114, 70, 255] },
  { key: "shadow:0", rgba: [28, 20, 24, 110] },
]);

describe("parseDrawAnswer", () => {
  it("코드 펜스와 앞뒤 글을 걸러 격자를 읽는다", () => {
    const text = '좋아요.\n```json\n{"legend":{"a":"wood:2","b":"wood:6"},"rows":["ab.","..a"],"note":"윗판 3행","topRows":3}\n```\n끝';
    const parsed = parseDrawAnswer(text, palette);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.grid).toEqual({ width: 3, height: 2, cells: ["wood:2", "wood:6", null, null, null, "wood:2"] });
    expect(parsed.note).toBe("윗판 3행");
    expect(parsed.topRows).toBe(3);
  });
  it("팔레트 밖 색·legend 에 없는 글자·길이가 다른 줄을 이유와 함께 거절한다", () => {
    expect(parseDrawAnswer('{"legend":{"a":"gold:9"},"rows":["a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("gold:9") });
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["ax"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("「x」") });
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["aa","a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("rows[1]") });
    expect(parseDrawAnswer('{"legend":{".":"wood:2"},"rows":["."]}', palette)).toEqual({ ok: false, error: expect.stringContaining("투명") });
    expect(parseDrawAnswer("그림을 못 그렸어요", palette)).toEqual({ ok: false, error: expect.stringContaining("JSON") });
  });
});

describe("격자 ↔ 그림", () => {
  const grid = { width: 2, height: 2, cells: ["wood:2", null, "shadow:0", "wood:6"] };
  it("renderGrid 는 팔레트 색을 그대로, 투명은 0 으로 쓴다", () => {
    const image = renderGrid(grid, palette);
    expect([...image.data.slice(0, 8)]).toEqual([99, 49, 11, 255, 0, 0, 0, 0]);
    expect([...image.data.slice(8, 12)]).toEqual([28, 20, 24, 110]);
  });
  it("imageToGrid 는 renderGrid 의 역이고 모르는 색을 따로 돌려준다", () => {
    expect(imageToGrid(renderGrid(grid, palette), palette)).toEqual({ grid, unknown: [] });
    const odd = renderGrid(grid, palette);
    odd.data.set([1, 2, 3, 255], 4);
    expect(imageToGrid(odd, palette).unknown).toEqual(["#010203"]);
  });
  it("gridToAnswer 는 parseDrawAnswer 로 그대로 되읽힌다", () => {
    const parsed = parseDrawAnswer(JSON.stringify(gridToAnswer(grid)), palette);
    expect(parsed.ok && parsed.grid).toEqual(grid);
  });
  it("scaleImage·onBackground·opaqueBounds·collectOpaqueColors", () => {
    const image = renderGrid(grid, palette);
    const big = scaleImage(image, 3);
    expect([big.width, big.height]).toEqual([6, 6]);
    expect([...big.data.slice((5 * 6 + 5) * 4, (5 * 6 + 5) * 4 + 4)]).toEqual([183, 114, 70, 255]);
    const bg = onBackground(image, [150, 120, 90, 255]);
    expect([...bg.data.slice(4, 8)]).toEqual([150, 120, 90, 255]);
    expect(opaqueBounds(image)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(collectOpaqueColors(image).length).toBe(3);
  });
});
```

- [ ] **Step 3: Run (허락 시)** `npx vitest run test/workshop/workshopGrid.test.ts --configLoader bundle` → FAIL (모듈 없음)

- [ ] **Step 4: grid.ts 를 쓴다**

```ts
// src/harnesses/_core/workshop/grid.ts
/**
 * 팔레트 키 격자. 모델에게 pxg 를 쓰게 하지 않는다 — 답은 {"legend":{"a":"wood:6"},"rows":["..aa.."]} 하나다.
 * 「.」은 투명. 색은 팔레트 키만 쓰므로 팔레트 밖 색은 해석 단계에서 걸러진다.
 */
import type { Grid, Palette, PaletteEntry, ParsedDraw, Rgba, RgbaImage } from "./types";

export const TRANSPARENT = ".";
const CHAR_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%^&*+=?<>~";

export function colorId([r, g, b, a]: Rgba): string {
  return `${r},${g},${b},${a}`;
}

export function hexOf([r, g, b]: Rgba): string {
  return "#" + [r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function makePalette(entries: readonly PaletteEntry[]): Palette {
  const byKey = new Map<string, PaletteEntry>();
  const byColor = new Map<string, PaletteEntry>();
  for (const entry of entries) {
    if (byKey.has(entry.key)) throw new Error(`팔레트 키 중복: ${entry.key}`);
    byKey.set(entry.key, entry);
    if (!byColor.has(colorId(entry.rgba))) byColor.set(colorId(entry.rgba), entry);
  }
  return { entries, byKey, byColor };
}

export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON 객체가 없다");
  return JSON.parse(body.slice(start, end + 1));
}

const fail = (error: string): ParsedDraw => ({ ok: false, error });

export function parseDrawAnswer(text: string, palette: Palette): ParsedDraw {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch (error) {
    return fail(`답을 JSON 으로 읽지 못했다: ${(error as Error).message}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("답이 JSON 객체가 아니다");
  const { legend, rows, note, topRows } = raw as Record<string, unknown>;
  if (!legend || typeof legend !== "object" || Array.isArray(legend)) return fail("legend 가 객체가 아니다");
  if (!Array.isArray(rows) || rows.length === 0 || rows.some((row) => typeof row !== "string")) return fail("rows 가 글자열 배열이 아니다");
  const keys = new Map<string, string>();
  for (const [char, key] of Object.entries(legend as Record<string, unknown>)) {
    if ([...char].length !== 1) return fail(`legend 의 글자 「${char}」는 한 글자가 아니다`);
    if (char === TRANSPARENT) return fail("「.」은 투명 칸이라 legend 에 쓸 수 없다");
    if (typeof key !== "string" || !palette.byKey.has(key)) return fail(`legend 「${char}」의 색 ${String(key)} 은 팔레트에 없다`);
    keys.set(char, key);
  }
  const lines = rows as string[];
  const width = [...lines[0]].length;
  if (width === 0) return fail("rows[0] 이 비었다");
  const cells: (string | null)[] = [];
  for (let y = 0; y < lines.length; y++) {
    const chars = [...lines[y]];
    if (chars.length !== width) return fail(`rows[${y}] 길이 ${chars.length} ≠ 첫 줄 ${width}`);
    for (let x = 0; x < width; x++) {
      const char = chars[x];
      if (char === TRANSPARENT) {
        cells.push(null);
        continue;
      }
      const key = keys.get(char);
      if (!key) return fail(`rows[${y}][${x}] 글자 「${char}」가 legend 에 없다`);
      cells.push(key);
    }
  }
  return {
    ok: true,
    grid: { width, height: lines.length, cells },
    note: typeof note === "string" ? note : "",
    topRows: typeof topRows === "number" && Number.isInteger(topRows) ? topRows : null,
  };
}

/** 격자 → 모델에게 보여 줄 같은 형식(지금 그림·지난 시도). */
export function gridToAnswer(grid: Grid): { legend: Record<string, string>; rows: string[] } {
  const charOf = new Map<string, string>();
  const legend: Record<string, string> = {};
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      const key = grid.cells[y * grid.width + x];
      if (key === null) {
        row += TRANSPARENT;
        continue;
      }
      let char = charOf.get(key);
      if (!char) {
        char = CHAR_POOL[charOf.size];
        if (!char) throw new Error(`격자 색이 ${CHAR_POOL.length}개를 넘는다`);
        charOf.set(key, char);
        legend[char] = key;
      }
      row += char;
    }
    rows.push(row);
  }
  return { legend, rows };
}

export function renderGrid(grid: Grid, palette: Palette): RgbaImage {
  const data = new Uint8ClampedArray(grid.width * grid.height * 4);
  grid.cells.forEach((key, index) => {
    if (key === null) return;
    const entry = palette.byKey.get(key);
    if (entry) data.set(entry.rgba, index * 4);
  });
  return { width: grid.width, height: grid.height, data };
}

export function scaleImage(image: RgbaImage, factor: number): RgbaImage {
  const width = image.width * factor;
  const height = image.height * factor;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((Math.floor(y / factor) * image.width) + Math.floor(x / factor)) * 4;
      data.set(image.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** 불투명 배경 위에 얹는다(검수자가 투명을 검게 보지 않게). */
export function onBackground(image: RgbaImage, background: Rgba): RgbaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = image.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(image.data[i + c] * alpha + background[c] * (1 - alpha));
    data[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data };
}

export function imageToGrid(image: RgbaImage, palette: Palette): { grid: Grid; unknown: string[] } {
  const cells: (string | null)[] = [];
  const unknown = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    const rgba: Rgba = [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
    if (rgba[3] === 0) {
      cells.push(null);
      continue;
    }
    const entry = palette.byColor.get(colorId(rgba));
    if (!entry) unknown.add(hexOf(rgba));
    cells.push(entry ? entry.key : null);
  }
  return { grid: { width: image.width, height: image.height, cells }, unknown: [...unknown] };
}

export function collectOpaqueColors(image: RgbaImage): Rgba[] {
  const seen = new Map<string, Rgba>();
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] === 0) continue;
    const rgba: Rgba = [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]];
    if (!seen.has(colorId(rgba))) seen.set(colorId(rgba), rgba);
  }
  return [...seen.values()];
}

/** 칠한 화소의 경계(포함). 비었으면 null. */
export function opaqueBounds(image: RgbaImage): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
```

- [ ] **Step 5: Run (허락 시)** 같은 명령 → PASS

- [ ] **Step 6: Commit**

```bash
git add src/harnesses/_core/workshop/types.ts src/harnesses/_core/workshop/grid.ts test/workshop/workshopGrid.test.ts
git commit -m "feat(workshop): 공방 공용 타입과 팔레트 키 격자"
```

---

### Task 2: 저장소 (`_core/workshop/store.ts`)

**Files:**
- Create: `src/harnesses/_core/workshop/store.ts`
- Test: `test/workshop/workshopStore.test.ts`

**Interfaces:**
- Consumes: Task 1 타입 `WorkshopRound`, `WorkshopPick`, `WorkshopFeedback`, `ItemDefinition`
- Produces: `WORKSHOP_DB_NAME`, `interface WorkshopStore`, `openWorkshopStore(factory?: IDBFactory | null): Promise<WorkshopStore>`, `createMemoryWorkshopStore(): WorkshopStore`

- [ ] **Step 1: 실패하는 시험**

```ts
// test/workshop/workshopStore.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createMemoryWorkshopStore, openWorkshopStore, type WorkshopStore } from "@/harnesses/_core/workshop/store";
import type { WorkshopRound } from "@/harnesses/_core/workshop/types";

const round = (id: string, projectKey: string, itemKey = "bookshelf"): WorkshopRound => ({
  id, projectKey, harnessId: "interior-props", itemKey, note: "", created: 1, runs: [],
});

async function exercise(store: WorkshopStore): Promise<void> {
  await store.putRound(round("r1", "local:A::m1"));
  await store.putRound(round("r2", "local:B::m1"));
  await store.putRound({ ...round("r1", "local:A::m1"), note: "다시" });
  expect((await store.listRounds("local:A::m1")).map((r) => [r.id, r.note])).toEqual([["r1", "다시"]]);
  expect((await store.getRound("r2"))?.projectKey).toBe("local:B::m1");
  await store.deleteRound("r2");
  expect(await store.getRound("r2")).toBeNull();

  await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "C", at: 5 });
  await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "D", at: 6 });
  expect((await store.listPicks("local:A::m1")).map((p) => p.letter)).toEqual(["D"]);
  await store.deletePick("local:A::m1", "bookshelf");
  expect(await store.listPicks("local:A::m1")).toEqual([]);

  await store.addFeedback({ id: "f1", projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "A", verdict: "reject", reasons: ["view"], note: "", at: 1 });
  await store.addFeedback({ id: "f2", projectKey: "local:A::m1", itemKey: "stool", roundId: "r3", letter: null, verdict: "reject", reasons: [], note: "", at: 2 });
  expect((await store.listFeedback("local:A::m1", "bookshelf")).map((f) => f.id)).toEqual(["f1"]);
  expect((await store.listFeedback("local:A::m1")).length).toBe(2);

  const def = { key: "new:herb-rack", title: "약초 걸이", description: "말린 약초", tilesW: 1, tilesH: 1, rise: 16, kind: "wall", category: "약방", use: [], refs: [] };
  await store.putItemDef("local:A::m1", def);
  expect(await store.listItemDefs("local:A::m1")).toEqual([def]);
  expect(await store.listItemDefs("local:B::m1")).toEqual([]);
}

describe("공방 저장소", () => {
  it("IndexedDB: 프로젝트 범위로 판·고른 것·버린 이유·새 기물을 나눠 둔다", async () => {
    const store = await openWorkshopStore(new IDBFactory());
    expect(store.backend).toBe("indexeddb");
    await exercise(store);
  });
  it("메모리 폴백도 같은 계약을 지킨다", async () => {
    const store = createMemoryWorkshopStore();
    expect(store.backend).toBe("memory");
    await exercise(store);
  });
  it("factory 가 없으면 메모리로 산다", async () => {
    expect((await openWorkshopStore(null)).backend).toBe("memory");
  });
  it("메모리 저장소는 넣은 객체를 복사한다(나중에 고쳐도 저장본이 안 바뀐다)", async () => {
    const store = createMemoryWorkshopStore();
    const r = round("r1", "p");
    await store.putRound(r);
    r.runs.push({} as never);
    expect((await store.getRound("r1"))?.runs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run (허락 시)** `npx vitest run test/workshop/workshopStore.test.ts --configLoader bundle` → FAIL

- [ ] **Step 3: store.ts**

```ts
// src/harnesses/_core/workshop/store.ts
/**
 * 공방 저장소 — 이 기기의 IndexedDB `oprn-workshop`. 후보는 고르기 전까지 프로젝트 정본이 아니라서
 * 문서 밖에 둔다(정본에 들어가는 것은 2단계의 칩셋 굽기 결과뿐). 범위 키는 조수 대화와 같은 conversationScopeKey.
 * IndexedDB 가 없거나 열기가 실패하면 메모리로 산다 — 호출자는 backend 로 「새로 고침 뒤에도 남는가」를 안다.
 */
import type { ItemDefinition, WorkshopFeedback, WorkshopPick, WorkshopRound } from "./types";

export const WORKSHOP_DB_NAME = "oprn-workshop";
const DB_VERSION = 1;
const STORE_NAMES = ["rounds", "picks", "feedback", "items"] as const;
type StoreName = (typeof STORE_NAMES)[number];
type Row = { readonly id: string; readonly projectKey: string };
type ItemRow = Row & { readonly def: ItemDefinition };
type PickRow = Row & WorkshopPick;

export interface WorkshopStore {
  readonly backend: "indexeddb" | "memory";
  listRounds(projectKey: string): Promise<WorkshopRound[]>;
  getRound(id: string): Promise<WorkshopRound | null>;
  putRound(round: WorkshopRound): Promise<void>;
  deleteRound(id: string): Promise<void>;
  listPicks(projectKey: string): Promise<WorkshopPick[]>;
  putPick(pick: WorkshopPick): Promise<void>;
  deletePick(projectKey: string, itemKey: string): Promise<void>;
  listFeedback(projectKey: string, itemKey?: string): Promise<WorkshopFeedback[]>;
  addFeedback(entry: WorkshopFeedback): Promise<void>;
  listItemDefs(projectKey: string): Promise<ItemDefinition[]>;
  putItemDef(projectKey: string, def: ItemDefinition): Promise<void>;
}

interface Backend {
  all<T extends Row>(store: StoreName, projectKey: string): Promise<T[]>;
  get<T extends Row>(store: StoreName, id: string): Promise<T | null>;
  put(store: StoreName, row: Row): Promise<void>;
  del(store: StoreName, id: string): Promise<void>;
}

const pickId = (projectKey: string, itemKey: string): string => `${projectKey}\n${itemKey}`;

function storeOver(backend: Backend, kind: WorkshopStore["backend"]): WorkshopStore {
  const byCreated = (a: WorkshopRound, b: WorkshopRound) => a.created - b.created || a.id.localeCompare(b.id);
  return {
    backend: kind,
    listRounds: async (projectKey) => (await backend.all<WorkshopRound>("rounds", projectKey)).sort(byCreated),
    getRound: (id) => backend.get<WorkshopRound>("rounds", id),
    putRound: (round) => backend.put("rounds", round),
    deleteRound: (id) => backend.del("rounds", id),
    listPicks: async (projectKey) => (await backend.all<PickRow>("picks", projectKey))
      .map(({ projectKey: p, itemKey, roundId, letter, at }) => ({ projectKey: p, itemKey, roundId, letter, at })),
    putPick: (pick) => backend.put("picks", { ...pick, id: pickId(pick.projectKey, pick.itemKey) }),
    deletePick: (projectKey, itemKey) => backend.del("picks", pickId(projectKey, itemKey)),
    listFeedback: async (projectKey, itemKey) => (await backend.all<WorkshopFeedback>("feedback", projectKey))
      .filter((entry) => itemKey === undefined || entry.itemKey === itemKey)
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    addFeedback: (entry) => backend.put("feedback", entry),
    listItemDefs: async (projectKey) => (await backend.all<ItemRow>("items", projectKey)).map((row) => row.def),
    putItemDef: (projectKey, def) => backend.put("items", { id: pickId(projectKey, def.key), projectKey, def }),
  };
}

export function createMemoryWorkshopStore(): WorkshopStore {
  const maps = new Map<StoreName, Map<string, Row>>(STORE_NAMES.map((name) => [name, new Map()]));
  const map = (name: StoreName) => maps.get(name)!;
  return storeOver({
    all: async <T extends Row>(name: StoreName, projectKey: string) =>
      [...map(name).values()].filter((row) => row.projectKey === projectKey).map((row) => structuredClone(row) as T),
    get: async <T extends Row>(name: StoreName, id: string) => {
      const row = map(name).get(id);
      return row ? (structuredClone(row) as T) : null;
    },
    put: async (name, row) => { map(name).set(row.id, structuredClone(row)); },
    del: async (name, id) => { map(name).delete(id); },
  }, "memory");
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 요청 실패"));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(WORKSHOP_DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORE_NAMES) {
        if (req.result.objectStoreNames.contains(name)) continue;
        req.result.createObjectStore(name, { keyPath: "id" }).createIndex("projectKey", "projectKey");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 열기 실패"));
    req.onblocked = () => reject(new Error("IndexedDB 열기가 막혔다(다른 탭이 옛 버전을 쥐고 있다)"));
  });
}

function idbBackend(db: IDBDatabase): Backend {
  const store = (name: StoreName, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    all: <T extends Row>(name: StoreName, projectKey: string) =>
      request(store(name, "readonly").index("projectKey").getAll(projectKey)) as Promise<T[]>,
    get: async <T extends Row>(name: StoreName, id: string) => ((await request(store(name, "readonly").get(id))) as T | undefined) ?? null,
    put: async (name, row) => { await request(store(name, "readwrite").put(row)); },
    del: async (name, id) => { await request(store(name, "readwrite").delete(id)); },
  };
}

export async function openWorkshopStore(factory: IDBFactory | null = globalThis.indexedDB ?? null): Promise<WorkshopStore> {
  if (!factory) return createMemoryWorkshopStore();
  try {
    return storeOver(idbBackend(await openDb(factory)), "indexeddb");
  } catch (error) {
    console.warn("[workshop] IndexedDB 를 열지 못해 이 세션은 메모리로 산다:", error);
    return createMemoryWorkshopStore();
  }
}
```

- [ ] **Step 4: Run (허락 시)** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/harnesses/_core/workshop/store.ts test/workshop/workshopStore.test.ts
git commit -m "feat(workshop): 공방 저장소(IndexedDB + 메모리 폴백)"
```

---

### Task 3: 실행기 엔진 (`_core/workshop/engine.ts`)

**Files:**
- Create: `src/harnesses/_core/workshop/engine.ts`
- Test: `test/workshop/workshopEngine.test.ts`

**Interfaces:**
- Consumes: Task 1 타입 전부, Task 2 `WorkshopStore`, `createMemoryWorkshopStore`; grid.ts `parseDrawAnswer`, `gridToAnswer`
- Produces:
  - `MAX_ATTEMPTS = 3`, `MAX_FIXES = 2`, `DEFAULT_CONCURRENCY = 3`, `CALLS_PER_CANDIDATE_ESTIMATE = 4`
  - `type WorkshopEngineOptions = { runner: WorkshopRunner; env: WorkshopEnv; chat: ChatFn; store: WorkshopStore; projectKey: string; concurrency?: number; sleep?: (ms: number) => Promise<void>; now?: () => number; newId?: () => string; onChange?: (round: WorkshopRound) => void }`
  - `interface WorkshopEngine { startRound(item: WorkshopItem, options?: { note?: string }): Promise<WorkshopRound>; redrawRun(roundId: string, letter: string, note: string): Promise<void>; cancelRound(roundId: string): Promise<void>; resume(): Promise<number>; setConcurrency(n: number): void; status(): { running: number; queued: number; concurrency: number; blocked: string | null }; idle(): Promise<void>; dispose(): void }`
  - `createWorkshopEngine(options: WorkshopEngineOptions): WorkshopEngine`

동작(스펙 §2):
1. 그리기 호출 → `parseDrawAnswer` + `runner.hardCheck`. 깨지면 같은 대화에 오류를 붙여 최대 `MAX_FIXES`번 고치게 한다. 그래도 깨지면 그 시도는 실패로 적고 다음 시도로(마지막 시도면 장 상태 `failed`).
2. 자기 점검 1번: `runner.selfCheckMessage` → 답이 깨지지 않았으면 그 격자로 바꾼다(깨졌으면 이전 격자 유지).
3. 검수(`workshop-review`, 새 대화) → `runner.parseVerdict` → `runner.gate`. PASS 면 끝. FAIL 이면 그 판정·격자를 들고 다음 시도. 3번 다 FAIL 이어도 장은 `done`(검수 불통과 표시, 사람이 볼 수 있게).
4. 429: 동시 ��를 하나 줄이고(최소 1) `20s × n` 기다렸다 같은 호출을 다시(최대 5번, 시도 수에 안 셈). 401·403: 그 장 `failed` + 엔진 `blocked = "AI 연결이 끊겼습니다. AI 설정에서 다시 연결하세요."`, 대기 중인 장은 그대로 두고 새로 시작하지 않는다.
5. 취소: 장마다 AbortController. 취소된 장은 `cancelled`, 대기열에서 뺀다.
6. 재개: 저장소에서 `queued·drawing·reviewing` 장을 `queued` 로 되돌려 다시 줄 세운다(탭을 닫았던 경우).
7. 판은 바뀔 때마다 통째로 `putRound`(판마다 쓰기 사슬로 순서를 지킨다) + `onChange`.

- [ ] **Step 1: 실패하는 시험** (가짜 실행기·가짜 채팅으로 엔진만 본다)

```ts
// test/workshop/workshopEngine.test.ts
import { describe, expect, it } from "vitest";
import { createWorkshopEngine } from "@/harnesses/_core/workshop/engine";
import { makePalette } from "@/harnesses/_core/workshop/grid";
import { createMemoryWorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ChatFn, DrawContext, Verdict, WorkshopItem, WorkshopRunner, WorkshopSurface } from "@/harnesses/_core/workshop/types";

const palette = makePalette([{ key: "k", rgba: [0, 0, 0, 255] }]);
const item: WorkshopItem = { key: "box", title: "상자", description: "", kind: "floor", category: "c", width: 2, height: 2, padTop: 0, isNew: false, refs: [], use: [] };
const GOOD = '{"legend":{"a":"k"},"rows":["aa","aa"],"note":"ok","topRows":3}';
const WRONG_SIZE = '{"legend":{"a":"k"},"rows":["a"]}';
const pass = '{"verdict":"PASS","codes":[],"top":"윗판 3행","top_rows":3,"reasons":"","fix":"","worse":false}';
const failVerdict = '{"verdict":"FAIL","codes":["FRONT"],"top":"윗판 1행","top_rows":1,"reasons":"납작","fix":"윗판을 3행으로","worse":false}';

function fakeRunner(seen: DrawContext[] = []): WorkshopRunner {
  return {
    harnessId: "fake", candidates: 2,
    prepare: async () => {},
    items: () => [item],
    palette: () => palette,
    currentGrid: () => null,
    directions: () => [{ letter: "A", text: "가" }, { letter: "B", text: "나" }],
    anchors: () => [],
    drawMessages: async (ctx) => { seen.push(ctx); return [{ role: "user", content: `draw ${ctx.direction.letter} ${ctx.attempt}` }]; },
    selfCheckMessage: () => ({ role: "user", content: "check" }),
    reviewMessages: async () => [{ role: "user", content: "review" }],
    hardCheck: (_item, grid) => (grid.width === 2 && grid.height === 2 ? [] : ["크기"]),
    parseVerdict: (text) => {
      const raw = JSON.parse(text);
      return { verdict: raw.verdict, codes: raw.codes, top: raw.top, topRows: raw.top_rows, reasons: raw.reasons, fix: raw.fix, worse: raw.worse } as Verdict;
    },
    gate: (_item, verdict) => verdict,
  };
}

/** surface·편지별로 답을 차례대로 낸다. 남은 답이 없으면 기본값. */
function scriptedChat(script: Partial<Record<string, string[]>>, log: string[] = []): ChatFn {
  return async (surface: WorkshopSurface, request) => {
    const first = request.messages[0]?.content;
    const letter = typeof first === "string" ? (first.split(" ")[1] ?? "") : "";
    const key = `${surface}:${letter}`;
    log.push(key);
    const queue = script[key] ?? script[surface];
    const next = queue?.shift();
    return next ?? (surface === "workshop-draw" ? GOOD : pass);
  };
}

const engineWith = (chat: ChatFn, runner = fakeRunner(), store = createMemoryWorkshopStore()) =>
  ({ store, engine: createWorkshopEngine({ runner, env: { loadImage: async () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }), encodePng: () => "data:", assetUrl: (p) => p }, chat, store, projectKey: "p", sleep: async () => {}, now: () => 1000 }) });

describe("공방 엔진", () => {
  it("그리기 → 자기 점검 → 검수 PASS 면 장이 done, 호출 3번", async () => {
    const { engine, store } = engineWith(scriptedChat({}));
    const round = await engine.startRound(item);
    await engine.idle();
    const saved = (await store.getRound(round.id))!;
    expect(saved.runs.map((r) => [r.letter, r.status, r.attempt, r.calls, r.verdict?.verdict])).toEqual([["A", "done", 1, 3, "PASS"], ["B", "done", 1, 3, "PASS"]]);
    expect(saved.runs[0].grid).toEqual({ width: 2, height: 2, cells: ["k", "k", "k", "k"] });
  });

  it("검수 FAIL 이면 판정을 들고 다시 그린다", async () => {
    const seen: DrawContext[] = [];
    const { engine, store } = engineWith(scriptedChat({ "workshop-review": [failVerdict] }), fakeRunner(seen));
    const round = await engine.startRound(item);
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    const redrawn = runs.find((r) => r.attempt === 2)!;
    expect(redrawn.status).toBe("done");
    expect(redrawn.attempts.map((a) => a.verdict?.verdict)).toEqual(["FAIL", "PASS"]);
    expect(seen.find((c) => c.attempt === 2)?.lastVerdict?.fix).toBe("윗판을 3행으로");
  });

  it("깨진 답은 같은 대화로 고치게 하고, 고치면 계속한다", async () => {
    const log: string[] = [];
    const { engine, store } = engineWith(scriptedChat({ "workshop-draw:A": [WRONG_SIZE] }, log));
    const round = await engine.startRound(item);
    await engine.idle();
    const a = (await store.getRound(round.id))!.runs[0];
    expect(a.status).toBe("done");
    expect(a.calls).toBe(4);
  });

  it("세 번 다 검수 불통과여도 장은 done(불통과 표시)", async () => {
    const { engine, store } = engineWith(scriptedChat({ "workshop-review": Array(6).fill(failVerdict) }));
    const round = await engine.startRound(item);
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs.map((r) => [r.status, r.attempt, r.verdict?.verdict])).toEqual([["done", 3, "FAIL"], ["done", 3, "FAIL"]]);
  });

  it("고칠 기회를 다 써도 깨진 답이면 마지막 시도 뒤 failed", async () => {
    const { engine, store } = engineWith(scriptedChat({ "workshop-draw:A": Array(20).fill(WRONG_SIZE) }));
    const round = await engine.startRound(item);
    await engine.idle();
    const a = (await store.getRound(round.id))!.runs[0];
    expect(a.status).toBe("failed");
    expect(a.error).toContain("크기");
  });

  it("429 는 동시 수를 줄이고 같은 호출을 다시 한다", async () => {
    let first = true;
    const chat: ChatFn = async (surface) => {
      if (first) { first = false; throw Object.assign(new Error("too many"), { status: 429 }); }
      return surface === "workshop-draw" ? GOOD : pass;
    };
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(3);
    const round = await engine.startRound(item);
    await engine.idle();
    expect(engine.status().concurrency).toBe(2);
    expect((await store.getRound(round.id))!.runs.every((r) => r.status === "done")).toBe(true);
  });

  it("401 이면 그 장은 failed, 엔진은 막힘 표시", async () => {
    const chat: ChatFn = async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }); };
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(1);
    const round = await engine.startRound(item);
    await engine.idle();
    expect(engine.status().blocked).toContain("AI 설정");
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs[0].status).toBe("failed");
    expect(runs[1].status).toBe("queued");
  });

  it("취소하면 대기·진행 중인 장이 cancelled", async () => {
    let release: () => void = () => {};
    const chat: ChatFn = (_surface, request) => new Promise((resolve, reject) => {
      release = () => resolve(GOOD);
      request.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(1);
    const round = await engine.startRound(item);
    await engine.cancelRound(round.id);
    release();
    await engine.idle();
    expect((await store.getRound(round.id))!.runs.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("재개: 저장소에 남은 drawing 장을 다시 돌린다", async () => {
    const store = createMemoryWorkshopStore();
    await store.putRound({
      id: "r9", projectKey: "p", harnessId: "fake", itemKey: "box", note: "", created: 1,
      runs: [{ letter: "A", direction: "가", status: "drawing", attempt: 1, attempts: [], grid: null, note: "", topRows: null, verdict: null, error: null, calls: 1, redrawNote: "", startedAt: 1, finishedAt: null }],
    });
    const { engine } = engineWith(scriptedChat({}), fakeRunner(), store);
    expect(await engine.resume()).toBe(1);
    await engine.idle();
    expect((await store.getRound("r9"))!.runs[0].status).toBe("done");
  });

  it("redrawRun 은 한 장만 메모를 붙여 처음부터 다시 그린다", async () => {
    const seen: DrawContext[] = [];
    const { engine, store } = engineWith(scriptedChat({}), fakeRunner(seen));
    const round = await engine.startRound(item);
    await engine.idle();
    await engine.redrawRun(round.id, "B", "더 밝게");
    await engine.idle();
    const b = (await store.getRound(round.id))!.runs[1];
    expect(b.status).toBe("done");
    expect(b.redrawNote).toBe("더 밝게");
    expect(seen.at(-1)?.redrawNote).toBe("더 밝게");
    expect(seen.at(-1)?.previousGrid).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run (허락 시)** `npx vitest run test/workshop/workshopEngine.test.ts --configLoader bundle` → FAIL

- [ ] **Step 3: engine.ts**

```ts
// src/harnesses/_core/workshop/engine.ts
/**
 * 공방 실행기. 파이썬 하네스(src/harnesses/interior-props/harness.py)와 같은 흐름을 브라우저에서 돈다:
 * 그리기 → (깨지면 고치기 ≤2) → 자기 점검 1번 → 독립 검수 → 하네스 판정(gate) → 불통과면 다시(시도 ≤3).
 * 사람만 고른다 — 엔진은 고르지 않는다. 판은 바뀔 때마다 통째로 저장해, 탭을 닫아도 resume() 로 잇는다.
 */
import type { ChatMessage } from "@/ai/llmClient";
import { gridToAnswer, parseDrawAnswer } from "./grid";
import type { WorkshopStore } from "./store";
import type {
  AnchorSample, ChatFn, DrawContext, Grid, RejectedSample, Verdict, WorkshopEnv, WorkshopItem, WorkshopRound, WorkshopRun,
  WorkshopRunner, WorkshopSurface,
} from "./types";

export const MAX_ATTEMPTS = 3;
export const MAX_FIXES = 2;
export const DEFAULT_CONCURRENCY = 3;
/** 판을 열 때 보여 주는 「호출 약 N번」 계산용(그리기·자기 점검·검수 + 가끔 다시) */
export const CALLS_PER_CANDIDATE_ESTIMATE = 4;
const MAX_RATE_RETRIES = 5;
const RATE_WAIT_MS = 20_000;
const BLOCKED_AUTH = "AI 연결이 끊겼습니다. AI 설정에서 다시 연결하세요.";
const PENDING = new Set(["queued", "drawing", "reviewing"]);

export type WorkshopEngineOptions = {
  runner: WorkshopRunner;
  env: WorkshopEnv;
  chat: ChatFn;
  store: WorkshopStore;
  projectKey: string;
  concurrency?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  newId?: () => string;
  onChange?: (round: WorkshopRound) => void;
};

export interface WorkshopEngine {
  startRound(item: WorkshopItem, options?: { note?: string }): Promise<WorkshopRound>;
  redrawRun(roundId: string, letter: string, note: string): Promise<void>;
  cancelRound(roundId: string): Promise<void>;
  resume(): Promise<number>;
  setConcurrency(n: number): void;
  status(): { running: number; queued: number; concurrency: number; blocked: string | null };
  idle(): Promise<void>;
  dispose(): void;
}

class Cancelled extends Error {}

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
};
const isAbort = (error: unknown): boolean => error instanceof Cancelled || (error as { name?: string } | null)?.name === "AbortError";
const clampConcurrency = (n: number): number => Math.max(1, Math.min(6, Math.round(n)));

export function createWorkshopEngine(options: WorkshopEngineOptions): WorkshopEngine {
  const { runner, env, chat, store, projectKey } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? (() => `w${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
  let concurrency = clampConcurrency(options.concurrency ?? DEFAULT_CONCURRENCY);
  let blocked: string | null = null;
  let disposed = false;
  const rounds = new Map<string, WorkshopRound>();
  const queue: { roundId: string; letter: string }[] = [];
  const running = new Map<string, AbortController>();
  const writes = new Map<string, Promise<void>>();
  let idleWaiters: (() => void)[] = [];

  const runKey = (roundId: string, letter: string) => `${roundId}\n${letter}`;
  const runOf = (round: WorkshopRound, letter: string): WorkshopRun => {
    const run = round.runs.find((r) => r.letter === letter);
    if (!run) throw new Error(`판 ${round.id} 에 장 ${letter} 가 없다`);
    return run;
  };

  function save(round: WorkshopRound): Promise<void> {
    const snapshot = structuredClone(round);
    const next = (writes.get(round.id) ?? Promise.resolve()).then(() => store.putRound(snapshot)).catch((error) => {
      console.warn("[workshop] 판 저장 실패:", error);
    });
    writes.set(round.id, next);
    options.onChange?.(snapshot);
    return next;
  }

  function settleIdle(): void {
    if (running.size > 0 || (queue.length > 0 && !blocked)) return;
    void Promise.all(writes.values()).then(() => {
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
    });
  }

  function pump(): void {
    while (!disposed && !blocked && running.size < concurrency && queue.length > 0) {
      const next = queue.shift()!;
      const round = rounds.get(next.roundId);
      if (!round) continue;
      const controller = new AbortController();
      running.set(runKey(next.roundId, next.letter), controller);
      void runOne(round, runOf(round, next.letter), controller.signal).finally(() => {
        running.delete(runKey(next.roundId, next.letter));
        pump();
        settleIdle();
      });
    }
    settleIdle();
  }

  async function call(surface: WorkshopSurface, messages: ChatMessage[], run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<string> {
    for (let retry = 0; ; retry++) {
      if (signal.aborted) throw new Cancelled();
      try {
        run.calls += 1;
        void save(round);
        return await chat(surface, { messages, response_format: { type: "json_object" }, temperature: surface === "workshop-draw" ? 0.6 : 0.1, signal, disableTransientRetry: true });
      } catch (error) {
        if (isAbort(error)) throw new Cancelled();
        if (statusOf(error) === 429 && retry < MAX_RATE_RETRIES) {
          concurrency = Math.max(1, concurrency - 1);
          await sleep(RATE_WAIT_MS * (retry + 1));
          continue;
        }
        throw error;
      }
    }
  }

  /** 그리기 대화 하나: 답 → 해석·깨짐 검사 → (고치기) → 자기 점검. 끝까지 깨지면 오류 글을 돌려준다. */
  async function drawOnce(ctx: DrawContext, run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<{ grid: Grid; note: string; topRows: number | null } | { error: string }> {
    const messages = await runner.drawMessages(ctx, env);
    let lastError = "";
    for (let fix = 0; fix <= MAX_FIXES; fix++) {
      const text = await call("workshop-draw", messages, run, round, signal);
      const parsed = parseDrawAnswer(text, ctx.palette);
      const problems = parsed.ok ? runner.hardCheck(ctx.item, parsed.grid) : [parsed.error];
      if (parsed.ok && problems.length === 0) {
        messages.push({ role: "assistant", content: text }, runner.selfCheckMessage(ctx, parsed.grid, env));
        const checkedText = await call("workshop-draw", messages, run, round, signal);
        const checked = parseDrawAnswer(checkedText, ctx.palette);
        if (checked.ok && runner.hardCheck(ctx.item, checked.grid).length === 0) {
          return { grid: checked.grid, note: checked.note || parsed.note, topRows: checked.topRows ?? parsed.topRows };
        }
        return { grid: parsed.grid, note: parsed.note, topRows: parsed.topRows };
      }
      lastError = problems.join(" / ");
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `답을 쓸 수 없다: ${lastError}\n같은 JSON 형식으로 전체 격자를 다시 내라. 캔버스는 ${ctx.item.width}×${ctx.item.height}px 이다.` },
      );
    }
    return { error: lastError };
  }

  async function contextFor(round: WorkshopRound, run: WorkshopRun, item: WorkshopItem, attempt: number, previousGrid: Grid | null, lastVerdict: Verdict | null): Promise<DrawContext> {
    const feedback = await store.listFeedback(projectKey, item.key);
    const rejected: RejectedSample[] = [];
    for (const entry of feedback.filter((f) => f.verdict === "reject" && f.letter).slice(-4)) {
      const grid = (rounds.get(entry.roundId) ?? (await store.getRound(entry.roundId)))?.runs.find((r) => r.letter === entry.letter)?.grid;
      if (grid) rejected.push({ grid, reasons: entry.reasons, note: entry.note });
    }
    const picked: AnchorSample[] = [];
    for (const pick of await store.listPicks(projectKey)) {
      if (pick.itemKey === item.key) continue;
      const grid = (rounds.get(pick.roundId) ?? (await store.getRound(pick.roundId)))?.runs.find((r) => r.letter === pick.letter)?.grid;
      if (grid) picked.push({ itemKey: pick.itemKey, title: pick.itemKey, grid, picked: true });
    }
    return {
      item,
      palette: runner.palette(item),
      direction: { letter: run.letter, text: run.direction },
      roundNote: round.note,
      redrawNote: run.redrawNote,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      previousGrid,
      lastVerdict,
      current: runner.currentGrid(item),
      anchors: runner.anchors(item, picked),
      rejected,
      notes: feedback.map((f) => f.note).filter(Boolean).slice(-5),
    };
  }

  async function runOne(round: WorkshopRound, run: WorkshopRun, signal: AbortSignal): Promise<void> {
    try {
      await runner.prepare(env);
      const defs = await store.listItemDefs(projectKey);
      const item = runner.items(defs).find((candidate) => candidate.key === round.itemKey);
      if (!item) throw new Error(`기물 ${round.itemKey} 를 찾지 못했다`);
      run.status = "drawing";
      run.startedAt = now();
      run.error = null;
      void save(round);
      let previousGrid = run.grid;
      // 다시 그리기(redrawRun)는 지난 격자를 출발점으로 넘긴다. 지난 판정은 불통과일 때만 「떨어진 이유」로 넘긴다.
      let lastVerdict: Verdict | null = run.verdict?.verdict === "FAIL" ? run.verdict : null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        run.attempt = attempt;
        run.status = "drawing";
        void save(round);
        const ctx = await contextFor(round, run, item, attempt, previousGrid, lastVerdict);
        const drawn = await drawOnce(ctx, run, round, signal);
        if ("error" in drawn) {
          run.attempts.push({ attempt, hard: [drawn.error], verdict: null, grid: null });
          if (attempt === MAX_ATTEMPTS) {
            run.status = "failed";
            run.error = `그림을 못 냈다: ${drawn.error}`;
            return;
          }
          continue;
        }
        run.grid = drawn.grid;
        run.note = drawn.note;
        run.topRows = drawn.topRows;
        run.status = "reviewing";
        void save(round);
        const reviewText = await call("workshop-review", await runner.reviewMessages({
          item, palette: ctx.palette, direction: ctx.direction, attempt, maxAttempts: MAX_ATTEMPTS,
          candidate: drawn.grid, current: ctx.current, anchors: ctx.anchors, previousVerdict: lastVerdict,
        }, env), run, round, signal);
        const verdict = runner.gate(item, runner.parseVerdict(reviewText));
        run.verdict = verdict;
        run.attempts.push({ attempt, hard: [], verdict, grid: drawn.grid });
        if (verdict.verdict === "PASS") break;
        previousGrid = drawn.grid;
        lastVerdict = verdict;
      }
      run.status = "done";
    } catch (error) {
      if (isAbort(error) || signal.aborted) {
        // dispose(프로젝트 전환)로 끊긴 장은 취소가 아니다 — 다시 열면 resume 이 잇는다.
        run.status = disposed ? "queued" : "cancelled";
        return;
      }
      const status = statusOf(error);
      if (status === 401 || status === 403) blocked = BLOCKED_AUTH;
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
    } finally {
      run.finishedAt = now();
      await save(round);
    }
  }

  function enqueue(round: WorkshopRound, letter: string): void {
    rounds.set(round.id, round);
    if (!queue.some((q) => q.roundId === round.id && q.letter === letter)) queue.push({ roundId: round.id, letter });
  }

  const freshRun = (letter: string, direction: string): WorkshopRun => ({
    letter, direction, status: "queued", attempt: 0, attempts: [], grid: null, note: "", topRows: null, verdict: null,
    error: null, calls: 0, redrawNote: "", startedAt: null, finishedAt: null,
  });

  return {
    async startRound(item, startOptions = {}) {
      blocked = null;
      const round: WorkshopRound = {
        id: newId(), projectKey, harnessId: runner.harnessId, itemKey: item.key, note: startOptions.note ?? "", created: now(),
        runs: runner.directions(item).slice(0, runner.candidates).map((d) => freshRun(d.letter, d.text)),
      };
      await save(round);
      for (const run of round.runs) enqueue(round, run.letter);
      pump();
      return structuredClone(round);
    },
    async redrawRun(roundId, letter, note) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) throw new Error(`판 ${roundId} 가 없다`);
      const old = runOf(round, letter);
      const run = { ...freshRun(letter, old.direction), grid: old.grid, verdict: old.verdict, redrawNote: note };
      round.runs = round.runs.map((r) => (r.letter === letter ? run : r));
      blocked = null;
      await save(round);
      enqueue(round, letter);
      pump();
    },
    async cancelRound(roundId) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) return;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].roundId === roundId) queue.splice(i, 1);
      for (const run of round.runs) {
        const controller = running.get(runKey(roundId, run.letter));
        if (controller) controller.abort();
        else if (run.status === "queued") run.status = "cancelled";
      }
      await save(round);
      settleIdle();
    },
    async resume() {
      let count = 0;
      for (const round of await store.listRounds(projectKey)) {
        if (round.harnessId !== runner.harnessId) continue;
        for (const run of round.runs) {
          if (!PENDING.has(run.status) || running.has(runKey(round.id, run.letter))) continue;
          run.status = "queued";
          enqueue(rounds.get(round.id) ?? round, run.letter);
          count += 1;
        }
        if (count > 0) await save(rounds.get(round.id) ?? round);
      }
      pump();
      return count;
    },
    setConcurrency(n) {
      concurrency = clampConcurrency(n);
      pump();
    },
    status: () => ({ running: running.size, queued: queue.length, concurrency, blocked }),
    idle: () => new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
      settleIdle();
    }),
    dispose() {
      disposed = true;
      for (const controller of running.values()) controller.abort();
      queue.length = 0;
    },
  };
}
```

`redrawRun` 은 지난 격자·판정을 새 장의 `grid`·`verdict` 에 남겨 둔다 — runOne 이 거기서 `previousGrid`·`lastVerdict`(불통과일 때만)를 읽는다. 시험 「redrawRun」이 이것을 본다.

- [ ] **Step 4: Run (허락 시)** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/harnesses/_core/workshop/engine.ts test/workshop/workshopEngine.test.ts
git commit -m "feat(workshop): 공방 실행기(큐·시도·자기 점검·검수·재개·429)"
```

---

### Task 4: AI 표면 두 개

**Files:**
- Modify: `src/ai/assistantEndpoint.ts:39-49` (AiSurface), `:86-99` (SURFACE_POLICIES), `:108-116` (resolveSurfaceAiConfig)
- Test: `test/workshop/workshopSurfaces.test.ts`

**Interfaces:**
- Produces: `AiSurface` 에 `"workshop-draw" | "workshop-review"`. `resolveSurfaceAiConfig("workshop-review")` = vision 역할, `"workshop-draw"` = 감독(ultrabrain) 티어.

- [ ] **Step 1: 실패하는 시험** (`test/modelRoles.test.ts:19` 의 vision 시험과 같은 모양)

```ts
// test/workshop/workshopSurfaces.test.ts
import { describe, expect, it } from "vitest";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { defaultAiConfig } from "@/ai/llmClient";
import { parseRoleModels } from "@/ai/modelRoles";

const roleModels = parseRoleModels({ vision: { provider: "openai-codex", model: "future-vision", thinkingLevel: "high" } });
const config = { ...defaultAiConfig(), roleModels };

describe("공방 AI 표면", () => {
  it("검수는 vision 역할 모델 + 고정 예산 4096", () => {
    expect(resolveSurfaceAiConfig("workshop-review", config)).toMatchObject({ model: "future-vision", providerId: "openai-codex", maxTokens: 4096 });
  });
  it("그리기는 감독(ultrabrain) 티어 + 고정 예산 16384 — 구조물 표면과 같은 모델", () => {
    const draw = resolveSurfaceAiConfig("workshop-draw", config);
    expect(draw.model).toBe(resolveSurfaceAiConfig("structure-kit", config).model);
    expect(draw.maxTokens).toBe(16384);
  });
});
```

- [ ] **Step 2: Run (허락 시)** → FAIL (타입 오류/값 다름)

- [ ] **Step 3: assistantEndpoint.ts 수정**

`AiSurface` 끝에:
```ts
  | "tileset-analysis"
  | "workshop-draw"
  | "workshop-review";
```
`SURFACE_POLICIES` 끝에(주석 목록에도 두 줄):
```ts
  // 공방: 그리기는 격자 JSON 이 길어(48행 × 여러 번 고치기) 감독 모델 + 넉넉한 고정 예산,
  // 검수는 그림을 읽는 판단이라 tileset-analysis 처럼 vision 역할.
  "workshop-draw": { tier: "supervisor", maxTokens: 16384 },
  "workshop-review": { tier: "supervisor", maxTokens: 4096 },
```
`resolveSurfaceAiConfig` 의 vision 분기:
```ts
    ? surface === "tileset-analysis" || surface === "workshop-review" ? configForRole(source, "vision")
```

- [ ] **Step 4: Run (허락 시)** → PASS. 같이: `npx vitest run test/assistantEndpoint.test.ts test/modelRoles.test.ts test/systemPromptEnvelope.test.ts --configLoader bundle` (표면 목록을 세는 시험이 있으면 여기서 깨진다 — 깨지면 그 시험의 목록에 두 표면을 더한다).

- [ ] **Step 5: Commit**

```bash
git add src/ai/assistantEndpoint.ts test/workshop/workshopSurfaces.test.ts
git commit -m "feat(workshop): AI 표면 workshop-draw·workshop-review"
```

---

### Task 5: 실내 기물 매니페스트 + 데이터 + 팔레트·기물 사전·검사

**Files:**
- Create: `src/harnesses/interior-props/harness.ts`
- Modify: `src/harnesses/_core/manifest.ts` (선택 필드 `workshop`)
- Modify: `src/harnesses/_core/registry.ts` (한 줄 + `workshopHarnesses`)
- Create(생성): `src/harnesses/interior-props/editor/v5Palette.json`, `src/harnesses/interior-props/editor/viewFail.json`
- Create(복사): `public/assets/harnesses/interior-props/examples/*.png` (9장)
- Create: `src/harnesses/interior-props/editor/palette.ts`, `items.ts`, `checks.ts`
- Create: `openwiki/harnesses/interior-props.md`
- Modify(생성): `src/harnesses/INDEX.md` (`npm run harness -- list`)
- Test: `test/workshop/interiorPropsRunner.test.ts` (이 Task 에서는 데이터·검사 부분)

**Interfaces:**
- Consumes: Task 1 타입·grid 함수
- Produces:
  - manifest: `workshop?: () => Promise<import("./workshop/types").WorkshopRunner>`
  - registry: `workshopHarnesses(genre): HarnessManifest[]` (editorUi && workshop 있음 && 장르 맞음)
  - `INTERIOR_PROPS_HARNESS`
  - palette.ts: `V5_RAMPS: readonly { name: string; colors: readonly string[] }[]`, `INTERIOR_SHADOWS: readonly PaletteEntry[]`, `basePaletteEntries(): PaletteEntry[]`, `paletteForItem(current: RgbaImage | null): Palette`, `rampSummary(): string`
  - items.ts: `SHEET_PATH = "assets/atlas-interior/interior-chipset.png"`, `TILE = 16`, `SHEET_COLUMNS = 48`, `type SpecObject`, `specObjects(): [string, SpecObject][]`, `cropCells(sheet: RgbaImage, cells: SpecObject["cells"]): RgbaImage`, `itemFromSpec(key, spec, current: RgbaImage | null): WorkshopItem`, `itemFromDefinition(def: ItemDefinition): WorkshopItem`, `newItemKey(title: string, taken: ReadonlySet<string>): string`, `VIEW_FAIL: ReadonlySet<string>`, `FLAT_KINDS`, `KIND_LABELS: Record<string, string>`
  - checks.ts: `TOP_MIN = 3`, `interiorHardCheck(item, grid, current: Grid | null): string[]`, `interiorGate(item, verdict): Verdict`, `parseInteriorVerdict(text): Verdict`

- [ ] **Step 1: 데이터 생성·복사 (명령)**

```bash
cd /home/main/z-project/rpg-zzu-workshop
mkdir -p src/harnesses/interior-props/editor public/assets/harnesses/interior-props/examples
cp src/harnesses/interior-props/examples/*.png public/assets/harnesses/interior-props/examples/
python3 - <<'EOF'
import json, re
ramps = []
for line in open('tiledata/hand-interior/pick/palette/v5.pal', encoding='utf-8'):
    m = re.match(r'@rampc\s+(\w+)\s+(.*)', line.strip())
    if m: ramps.append({'name': m.group(1), 'colors': m.group(2).split()})
json.dump(ramps, open('src/harnesses/interior-props/editor/v5Palette.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
picks = json.load(open('tiledata/hand-interior/pick/picks.json', encoding='utf-8'))
audit = json.load(open('tiledata/hand-interior/pick/audit/v34-audit-verdicts.json', encoding='utf-8'))
fail = sorted(x['key'] for x in audit if x.get('rev') == 'FAIL' and (picks.get(x['key']) or {}).get('choice', 'v5') == 'v5')
json.dump({'source': 'tiledata/hand-interior/pick/audit/v34-audit-verdicts.json ∩ picks.json choice=v5 (2026-10-02)', 'keys': fail},
          open('src/harnesses/interior-props/editor/viewFail.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(ramps), 'ramps;', len(fail), 'view-fail originals')
EOF
```
Expected: `29 ramps; 44 view-fail originals`

- [ ] **Step 2: 실패하는 시험(데이터·검사)**

```ts
// test/workshop/interiorPropsRunner.test.ts
import { describe, expect, it } from "vitest";
import { getHarness, workshopHarnesses } from "@/harnesses/_core/registry";
import { makePalette, renderGrid } from "@/harnesses/_core/workshop/grid";
import type { Grid, Verdict } from "@/harnesses/_core/workshop/types";
import { interiorGate, interiorHardCheck, parseInteriorVerdict, TOP_MIN } from "@/harnesses/interior-props/editor/checks";
import { cropCells, itemFromDefinition, itemFromSpec, newItemKey, specObjects, VIEW_FAIL } from "@/harnesses/interior-props/editor/items";
import { basePaletteEntries, INTERIOR_SHADOWS, paletteForItem, V5_RAMPS } from "@/harnesses/interior-props/editor/palette";

const sheet = (columns: number, rows: number, fill: (tile: number) => [number, number, number, number]) => {
  const width = columns * 16, height = rows * 16, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(Math.floor(y / 16) * columns + Math.floor(x / 16)), (y * width + x) * 4);
  return { width, height, data };
};

describe("interior-props 매니페스트", () => {
  it("에디터 화면만 있고 공방 실행기를 지연 로드한다", async () => {
    const harness = getHarness("interior-props")!;
    expect(harness.entrypoints).toEqual({ cli: false, editorUi: true, assistantTool: false });
    expect(workshopHarnesses(null).map((h) => h.id)).toContain("interior-props");
    expect(workshopHarnesses("monster-collect").map((h) => h.id)).toContain("interior-props");
    expect(typeof harness.workshop).toBe("function");
  });
});

describe("팔레트", () => {
  it("v5 램프 29개 + 그림자 2색", () => {
    expect(V5_RAMPS.length).toBe(29);
    expect(V5_RAMPS[0]).toEqual({ name: "wood", colors: expect.arrayContaining(["#9a5435"]) });
    const entries = basePaletteEntries();
    expect(entries.find((e) => e.key === "wood:4")?.rgba).toEqual([0x9a, 0x54, 0x35, 255]);
    expect(INTERIOR_SHADOWS.map((e) => e.rgba[3])).toEqual([110, 58]);
  });
  it("지금 그림의 v5 밖 색은 own:N 으로 더한다", () => {
    const current = { width: 2, height: 1, data: new Uint8ClampedArray([0x9a, 0x54, 0x35, 255, 1, 2, 3, 255]) };
    const palette = paletteForItem(current);
    expect(palette.byKey.get("own:0")?.rgba).toEqual([1, 2, 3, 255]);
    expect(palette.byColor.get("154,84,53,255")?.key).toBe("wood:4");
  });
});

describe("기물 사전", () => {
  it("번들 사양 414종, 캔버스는 칸 경계, padTop 은 지금 그림의 투명 윗줄", () => {
    const objects = specObjects();
    expect(objects.length).toBe(414);
    const [, crate] = objects.find(([key]) => key === "crate:cabbage")!;
    const blank = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) };
    blank.data.fill(255, 4 * 16 * 3); // 위 3줄은 투명, 나머지 칠함
    const item = itemFromSpec("crate:cabbage", crate, blank);
    expect([item.width, item.height, item.padTop, item.kind, item.isNew]).toEqual([16, 16, 3, "floor", false]);
  });
  it("cropCells 는 시트 48칸 폭에서 dx·dy 대로 잘라 붙인다", () => {
    const image = sheet(48, 2, (tile) => [tile % 256, 0, 0, 255]);
    const crop = cropCells(image, [[0, -1, 1, 3], [0, 0, 49, 3]]);
    expect([crop.width, crop.height]).toEqual([16, 32]);
    expect(crop.data[0]).toBe(1);
    expect(crop.data[16 * 16 * 4]).toBe(49);
  });
  it("새 기물 정의: 높이는 16 배수로 올리고 남는 위를 padTop 으로", () => {
    const item = itemFromDefinition({ key: "new:herb", title: "약초 걸이", description: "말린 약초", tilesW: 2, tilesH: 1, rise: 10, kind: "wall", category: "약방", use: [], refs: [] });
    expect([item.width, item.height, item.padTop, item.isNew]).toEqual([32, 32, 6, true]);
    expect(newItemKey("약초 걸이", new Set(["new:약초-걸이"]))).toBe("new:약초-걸이-2");
  });
  it("3/4 전수조사 위반 원본 목록이 있다", () => {
    expect(VIEW_FAIL.size).toBe(44);
  });
});

describe("깨짐 검사·꼭대기 면 판정", () => {
  const palette = makePalette(basePaletteEntries());
  const item = itemFromDefinition({ key: "new:box", title: "상자", description: "", tilesW: 1, tilesH: 1, rise: 0, kind: "floor", category: "c", use: [], refs: [] });
  const solid = (rows: (string | null)[][]): Grid => ({ width: rows[0].length, height: rows.length, cells: rows.flat() });
  const box = (): (string | null)[][] => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x >= 2 && x <= 13 && y >= 4 ? "wood:4" : null)));

  it("멀쩡한 격자는 통과", () => {
    expect(interiorHardCheck(item, solid(box()), null)).toEqual([]);
    expect(renderGrid(solid(box()), palette).width).toBe(16);
  });
  it("크기·빈 그림·귀퉁이 배경·위 패딩·접지선", () => {
    expect(interiorHardCheck(item, solid([["wood:4"]]), null)[0]).toContain("크기");
    expect(interiorHardCheck(item, solid(box().map((r) => r.map(() => null))), null)[0]).toContain("비었다");
    const filled = box().map((r) => r.map(() => "wood:4"));
    expect(interiorHardCheck(item, solid(filled), null).join()).toContain("귀퉁이");
    const floating = box().map((r, y) => (y === 15 ? r.map(() => null) : r));
    expect(interiorHardCheck(item, solid(floating), null).join()).toContain("접지선");
    const padded = { ...item, padTop: 6 };
    expect(interiorHardCheck(padded, solid(box()), null).join()).toContain("위 패딩");
  });
  const verdict = (topRows: number | null): Verdict => ({ verdict: "PASS", codes: [], top: "윗판", topRows, reasons: "", fix: "", worse: false });
  it(`가구는 꼭대기 윗면 ${TOP_MIN}행 미만이면 FRONT 로 떨어뜨린다`, () => {
    const gated = interiorGate(item, verdict(2));
    expect([gated.verdict, gated.codes]).toEqual(["FAIL", ["FRONT"]]);
    expect(gated.fix).toContain("3행");
    expect(interiorGate(item, verdict(3)).verdict).toBe("PASS");
    expect(interiorGate({ ...item, kind: "hang" }, verdict(1)).verdict).toBe("PASS");
    expect(interiorGate(item, verdict(null)).verdict).toBe("PASS");
  });
  it("검수 답 해석: top_rows·대소문자·못 읽은 답", () => {
    expect(parseInteriorVerdict('```json\n{"verdict":"pass","codes":[],"top":"윗판 4행","top_rows":4,"reasons":"ok","fix":"","worse":false}\n```'))
      .toMatchObject({ verdict: "PASS", topRows: 4 });
    expect(parseInteriorVerdict("모르겠어요")).toMatchObject({ verdict: "FAIL", codes: ["READ"], reasons: expect.stringContaining("검수 답") });
  });
});
```

- [ ] **Step 3: Run (허락 시)** `npx vitest run test/workshop/interiorPropsRunner.test.ts --configLoader bundle` → FAIL

- [ ] **Step 4: manifest.ts 에 덧붙임** (`entrypoints: HarnessEntrypoints;` 다음 줄)

```ts
  /**
   * 에디터 「공방」 실행기 지연 로더. editorUi 가 true 인 하네스만 둔다.
   * 매니페스트는 가볍게 — 실행기 코드는 부를 때만 import 한다.
   */
  workshop?: () => Promise<import("./workshop/types").WorkshopRunner>;
```

- [ ] **Step 5: harness.ts**

```ts
// src/harnesses/interior-props/harness.ts
import { defineHarness } from "../_core/manifest";

/**
 * 손 도트 실내 기물(16px, interior-chipset). 파이썬 하네스(harness.py·web/)는 이 서버의 작업자용이고,
 * 에디터 「공방」은 editor/ 의 실행기로 사용자 계정 모델이 같은 흐름을 돈다. 칩셋 굽기는 2단계.
 */
export const INTERIOR_PROPS_HARNESS = defineHarness({
  id: "interior-props",
  title: "손 도트 실내 기물 (16px)",
  summary:
    "실내 칩셋(interior-chipset, 48칸 폭)의 가구·소품을 3/4 시점(꼭대기 윗면 3행 이상 + 남쪽 면)으로 다시 찍거나 새로 정의한다. "
    + "후보 5장을 다른 방향으로 그리고 기계 검사 → 자기 점검 → 독립 검수(꼭대기 면 규칙) → 최대 3번 다시 그린 뒤 사람이 고른다.",
  scope: {},
  triggers: [
    "실내 맵의 가구·소품(책장·옷장·벽난로·진열장·궤짝…)이 정면도라 3/4 로 안 읽힌다는 지적이 있을 때",
    "실내 칩셋에 없는 기물을 새로 만들어야 할 때(이름·설명·칸 수를 정의)",
    "에디터 사용자가 자기 AI 계정으로 기물 후보를 뽑아 고르고 싶을 때(왼쪽 막대 「공방」)",
  ],
  seed: "src/assets/handInteriorSpec.json",
  doc: "openwiki/harnesses/interior-props.md",
  stages: [
    { id: "draw", title: "후보 그리기", summary: "기물 하나에 후보 5장(방향 A~E). 깨지면 고치기 2번, 자기 점검 1번." },
    { id: "review", title: "독립 검수", summary: "다른 대화의 vision 모델이 3/4·「지금보다 나빠졌나」를 본다. 가구는 꼭대기 윗면 3행 미만이면 FRONT." },
    { id: "pick", title: "고르기", summary: "사람이 고르거나 이유를 붙여 버린다. 버린 이유는 다음 판의 「하지 말 것��이 된다." },
  ],
  entrypoints: { cli: false, editorUi: true, assistantTool: false },
  workshop: () => import("./editor/runner").then((m) => m.createInteriorRunner()),
});
```

- [ ] **Step 6: registry.ts**

```ts
import { INTERIOR_PROPS_HARNESS } from "../interior-props/harness";

export const HARNESSES: readonly HarnessManifest[] = [
  MONSTER_COLLECT_SPECIES_HARNESS,
  MODERN_CHIPSET_HARNESS,
  INTERIOR_PROPS_HARNESS,
];

/** 에디터 「공방」에 보일 하네스 — 에디터 화면이 있고 실행기가 있고 장르가 맞는 것. */
export function workshopHarnesses(genre: GenrePackId | null | undefined): HarnessManifest[] {
  return harnessesForGenre(genre).filter((harness) => harness.entrypoints.editorUi && harness.workshop !== undefined);
}
```

- [ ] **Step 7: palette.ts**

```ts
// src/harnesses/interior-props/editor/palette.ts
/**
 * 실내 기물 팔레트 = v5 공통 램프 29개(v5Palette.json, tiledata/hand-interior/pick/palette/v5.pal 에서 생성)
 * + 접지 그림자 2색 + 지금 그림에만 있는 색(own:N). 모델은 이 키만 쓴다.
 */
import { colorId, makePalette } from "@/harnesses/_core/workshop/grid";
import { collectOpaqueColors } from "@/harnesses/_core/workshop/grid";
import type { Palette, PaletteEntry, Rgba, RgbaImage } from "@/harnesses/_core/workshop/types";
import ramps from "./v5Palette.json";

export const V5_RAMPS: readonly { name: string; colors: readonly string[] }[] = ramps;

export const INTERIOR_SHADOWS: readonly PaletteEntry[] = [
  { key: "shadow:0", rgba: [0x1c, 0x14, 0x18, 110], label: "그림자 속(발 칸 안, 오른쪽 아래)" },
  { key: "shadow:1", rgba: [0x1c, 0x14, 0x18, 58], label: "그림자 번짐" },
];

const rgbaOf = (hex: string): Rgba => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];

export function basePaletteEntries(): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  for (const ramp of V5_RAMPS) ramp.colors.forEach((hex, index) => entries.push({ key: `${ramp.name}:${index}`, rgba: rgbaOf(hex) }));
  return [...entries, ...INTERIOR_SHADOWS];
}

export function paletteForItem(current: RgbaImage | null): Palette {
  const entries = basePaletteEntries();
  const known = new Set(entries.map((entry) => colorId(entry.rgba)));
  let own = 0;
  for (const rgba of current ? collectOpaqueColors(current) : []) {
    if (known.has(colorId(rgba))) continue;
    known.add(colorId(rgba));
    entries.push({ key: `own:${own++}`, rgba, label: "지금 그림에만 있는 색" });
  }
  return makePalette(entries);
}

/** 지시문에 넣을 팔레트 설명 — 「wood 0(어두움)~8: #000000 …」 */
export function rampSummary(palette: Palette): string {
  const lines = V5_RAMPS.map((ramp) => `- ${ramp.name} 0~${ramp.colors.length - 1}: ${ramp.colors.join(" ")}`);
  const own = palette.entries.filter((entry) => entry.key.startsWith("own:"));
  if (own.length) lines.push(`- own 0~${own.length - 1} (지금 그림에만 있는 색): ${own.map((e) => `#${e.rgba.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")}`).join(" ")}`);
  lines.push("- shadow:0 그림자 속, shadow:1 그림자 번짐 (반투명, 발 칸 안 오른쪽 아래에만)");
  return lines.join("\n");
}
```

- [ ] **Step 8: items.ts**

```ts
// src/harnesses/interior-props/editor/items.ts
/**
 * 기물 사전: 번들 handInteriorSpec.json(414종) + 사용자가 공방에서 정의한 새 기물.
 * 지금 그림은 시트(public/assets/atlas-interior/interior-chipset.png, 16px · 48칸 폭)에서 cells 대로 잘라 붙인다.
 */
import spec from "@/assets/handInteriorSpec.json";
import type { ItemDefinition, RgbaImage, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { opaqueBounds } from "@/harnesses/_core/workshop/grid";
import viewFail from "./viewFail.json";

export const SHEET_PATH = "assets/atlas-interior/interior-chipset.png";
export const TILE = 16;
export const SHEET_COLUMNS = 48;
/** 벽면 걸이·바닥 무늬 — 평평한 게 정상이라 가구의 기준 그림으로 주면 정면도를 배운다(투구 선반 h49) */
export const FLAT_KINDS: ReadonlySet<string> = new Set(["hang", "flat"]);
export const KIND_LABELS: Readonly<Record<string, string>> = { floor: "바닥 기물", wall: "북쪽 벽 앞 기물", hang: "벽면 걸이", flat: "바닥 무늬" };
/** 2026-10-01 3/4 전수조사에서 위반으로 나왔고 아직 v5 원본 그대로인 기물 — 기준 그림에서 뺀다 */
export const VIEW_FAIL: ReadonlySet<string> = new Set(viewFail.keys);

export type SpecObject = {
  ko: string; category: string; category_ko: string; kind: string; w: number; h: number; up: number;
  cells: [number, number, number, number][]; desc: string; tags: string[]; place: string; pair: string[]; use: string[];
};

export function specObjects(): [string, SpecObject][] {
  return Object.entries((spec as unknown as { objects: Record<string, SpecObject> }).objects);
}

export function cropCells(sheet: RgbaImage, cells: SpecObject["cells"]): RgbaImage {
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const width = (Math.max(...xs) - x0 + 1) * TILE, height = (Math.max(...ys) - y0 + 1) * TILE;
  const data = new Uint8ClampedArray(width * height * 4);
  const columns = Math.floor(sheet.width / TILE);
  for (const [dx, dy, tile] of cells) {
    const sx = (tile % columns) * TILE, sy = Math.floor(tile / columns) * TILE;
    const ox = (dx - x0) * TILE, oy = (dy - y0) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const from = ((sy + y) * sheet.width + sx + x) * 4;
        const alpha = sheet.data[from + 3];
        if (alpha === 0) continue;
        const to = ((oy + y) * width + ox + x) * 4;
        // 겹친 칸(층)은 뒤에 온 것이 위다 — 반투명(그림자)만 섞는다
        const a = alpha / 255;
        for (let c = 0; c < 3; c++) data[to + c] = Math.round(sheet.data[from + c] * a + data[to + c] * (1 - a));
        data[to + 3] = Math.max(data[to + 3], alpha);
      }
    }
  }
  return { width, height, data };
}

export function itemFromSpec(key: string, object: SpecObject, current: RgbaImage | null): WorkshopItem {
  const xs = object.cells.map((c) => c[0]), ys = object.cells.map((c) => c[1]);
  const bounds = current ? opaqueBounds(current) : null;
  return {
    key, title: object.ko, description: object.desc, kind: object.kind, category: object.category_ko,
    width: (Math.max(...xs) - Math.min(...xs) + 1) * TILE,
    height: (Math.max(...ys) - Math.min(...ys) + 1) * TILE,
    padTop: bounds ? bounds.y0 : 0,
    isNew: false, refs: [], use: object.use,
  };
}

export function itemFromDefinition(def: ItemDefinition): WorkshopItem {
  const drawn = def.tilesH * TILE + def.rise;
  const height = Math.ceil(drawn / TILE) * TILE;
  return {
    key: def.key, title: def.title, description: def.description, kind: def.kind, category: def.category,
    width: def.tilesW * TILE, height, padTop: height - drawn, isNew: true, refs: def.refs, use: def.use,
  };
}

export function newItemKey(title: string, taken: ReadonlySet<string>): string {
  const base = `new:${title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "") || "item"}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
```

주의: `itemFromDefinition` 의 padTop 은 「솟은 높이를 칸 단위로 올려 남는 위」다. 위 시험 기대값 `tilesH 1, rise 10 → 높이 32, padTop 6` 과 맞는다.

- [ ] **Step 9: checks.ts**

```ts
// src/harnesses/interior-props/editor/checks.ts
/**
 * 깨짐 검사(파이썬 check_candidate.py 의 hard 항목 중 격자로 잴 수 있는 것)와
 * 꼭대기 면 판정(harness.py _top_gate) 그리고 검수 답 해석.
 */
import { extractJsonObject } from "@/harnesses/_core/workshop/grid";
import type { Grid, Verdict, WorkshopItem } from "@/harnesses/_core/workshop/types";

/** 꼭대기 면 윗면 최소 행 수(16px). 칩셋 책장 3~4·옷장 4·찬장 6·벽난로 5 */
export const TOP_MIN = 3;
const FURNITURE = new Set(["floor", "wall"]);

function bottomRow(grid: Grid): number {
  for (let y = grid.height - 1; y >= 0; y--) {
    for (let x = 0; x < grid.width; x++) if (grid.cells[y * grid.width + x] !== null) return y;
  }
  return -1;
}

export function interiorHardCheck(item: WorkshopItem, grid: Grid, current: Grid | null): string[] {
  if (grid.width !== item.width || grid.height !== item.height) return [`크기: ${grid.width}×${grid.height} ≠ 캔버스 ${item.width}×${item.height}`];
  const at = (x: number, y: number) => grid.cells[y * grid.width + x];
  const problems: string[] = [];
  const bottom = bottomRow(grid);
  if (bottom < 0) return ["그림이 비었다(칠한 화소가 없다)"];
  const corners = [at(0, 0), at(grid.width - 1, 0), at(0, grid.height - 1), at(grid.width - 1, grid.height - 1)].filter((c) => c !== null).length;
  if (corners >= 2) problems.push("배경: 귀퉁이 둘 이상이 칠해졌다(배경은 투명이어야 한다)");
  for (let y = 0; y < item.padTop; y++) {
    if (Array.from({ length: grid.width }, (_, x) => at(x, y)).some((c) => c !== null)) {
      problems.push(`위 패딩: 맨 위 ${item.padTop}줄은 비워 둔다(y=${y} 에 그림이 있다)`);
      break;
    }
  }
  if (FURNITURE.has(item.kind)) {
    // 있는 기물은 지금 그림의 접지선 ±1, 새 기물은 캔버스 맨 아래 줄 그대로
    const expected = current ? bottomRow(current) : grid.height - 1;
    const tolerance = current ? 1 : 0;
    if (expected >= 0 && Math.abs(bottom - expected) > tolerance) problems.push(`접지선: 맨 아래 칠한 줄 y=${bottom} (기준 y=${expected}, 허용 ±${tolerance}) — 바닥에 닿게`);
  }
  return problems;
}

export function interiorGate(item: WorkshopItem, verdict: Verdict): Verdict {
  const rows = verdict.topRows;
  if (verdict.verdict !== "PASS" || !FURNITURE.has(item.kind) || rows === null || rows >= TOP_MIN) return verdict;
  return {
    ...verdict,
    verdict: "FAIL",
    codes: [...new Set([...verdict.codes, "FRONT"])],
    reasons: `꼭대기 면 윗면 ${rows}행 < ${TOP_MIN}행(하네스 규칙). ${verdict.reasons}`.trim(),
    fix: `${verdict.fix} 꼭대기 면(${verdict.top}) 윗면을 ${TOP_MIN}행 이상으로 — 필요하면 남쪽 면을 줄인다.`.trim(),
  };
}

export function parseInteriorVerdict(text: string): Verdict {
  try {
    const raw = extractJsonObject(text) as Record<string, unknown>;
    const verdict = String(raw.verdict ?? "").toUpperCase() === "PASS" ? "PASS" : "FAIL";
    const topRows = typeof raw.top_rows === "number" && Number.isInteger(raw.top_rows) ? raw.top_rows : null;
    return {
      verdict,
      codes: Array.isArray(raw.codes) ? raw.codes.filter((c): c is string => typeof c === "string") : [],
      top: typeof raw.top === "string" ? raw.top : "",
      topRows,
      reasons: typeof raw.reasons === "string" ? raw.reasons : "",
      fix: typeof raw.fix === "string" ? raw.fix : "",
      worse: raw.worse === true,
    };
  } catch {
    return { verdict: "FAIL", codes: ["READ"], top: "", topRows: null, reasons: "검수 답을 읽지 못했다", fix: "", worse: false };
  }
}
```

- [ ] **Step 10: 문서 `openwiki/harnesses/interior-props.md`** (짧게)

```markdown
# interior-props — 손 도트 실내 기물 (16px)

- 매니페스트: `src/harnesses/interior-props/harness.ts`. 들어오는 길: 에디터 「공방」(왼쪽 막대). CLI·조수 도구 없음.
- 이 서버의 작업자용 파이썬 하네스는 같은 폴더의 `harness.py`·`web/`(README.md). 에디터 실행기는 `editor/`.
- 흐름: 후보 5장(방향 A~E) → 깨짐 검사(크기·투명 배경·위 패딩·접지선) → 고치기 ≤2 → 자기 점검 1 → 독립 검수(vision) → 꼭대기 면 판정(가구 윗면 3행 미만 = FRONT) → 다시 그리기(시도 ≤3) → 사람이 고른다.
- 팔레트: `editor/v5Palette.json`(v5.pal 램프 29개에서 생성) + 그림자 2색 + 지금 그림에만 있는 색(own:N).
- 기준 그림: 이 프로젝트에서 고른 같은 분류 후보 → 닮은 기물(refs) → 같은 분류 원본(`editor/viewFail.json` 의 3/4 위반 원본·벽면 걸이·바닥 무늬 제외).
- 예시: `public/assets/harnesses/interior-props/examples/`(good-*·bad-*, 원본은 `examples/`).
- 저장: 이 기기 IndexedDB `oprn-workshop`. 칩셋에 굽기는 2단계(`docs/superpowers/specs/2026-10-02-workshop-editor-design.md`).
- 데이터 다시 만들기: `docs/superpowers/plans/2026-10-02-workshop-editor.md` Task 5 Step 1.
```

- [ ] **Step 11: INDEX 다시 쓰기**

Run: `cd /home/main/z-project/rpg-zzu-workshop && npm run harness -- list`
Expected: 세 줄(monster-collect-species, modern-chipset, interior-props) + `→ src/harnesses/INDEX.md`

- [ ] **Step 12: Run (허락 시)** `npx vitest run test/workshop/interiorPropsRunner.test.ts test/harnesses/monsterCollectSpecies.test.ts --configLoader bundle` → 매니페스트·팔레트·사전·검사 시험 PASS (runner 지연 로더는 Task 6 전까지 import 실패 — `typeof harness.workshop` 만 보므로 통과)

- [ ] **Step 13: Commit**

```bash
git add src/harnesses/_core/manifest.ts src/harnesses/_core/registry.ts src/harnesses/INDEX.md src/harnesses/interior-props/harness.ts \
  src/harnesses/interior-props/editor public/assets/harnesses/interior-props openwiki/harnesses/interior-props.md test/workshop/interiorPropsRunner.test.ts
git commit -m "feat(workshop): interior-props 매니페스트·팔레트·기물 사전·깨짐 검사"
```

---

### Task 6: 실내 기물 실행기 — 방향·지시문·검수 (`prompts.ts`, `runner.ts`)

**Files:**
- Create: `src/harnesses/interior-props/editor/prompts.ts`
- Create: `src/harnesses/interior-props/editor/runner.ts`
- Test: `test/workshop/interiorPropsRunner.test.ts` (덧붙임)

**Interfaces:**
- Consumes: Task 1 타입·grid, Task 5 palette/items/checks
- Produces:
  - prompts.ts: `DIRECTIONS`, `NEW_DIRECTIONS` (`Direction[]`), `EXAMPLES: readonly { file: string; label: string }[]`, `REVIEW_REFS: readonly string[]`, `REJECT_REASONS: Readonly<Record<string, string>>`, `drawSystemPrompt(): string`, `drawBrief(ctx: DrawContext): string`, `selfCheckText(ctx: DrawContext): string`, `reviewSystemPrompt(): string`, `reviewBrief(ctx: ReviewContext): string`
  - runner.ts: `createInteriorRunner(): WorkshopRunner` (harnessId `"interior-props"`, candidates 5)

이미지 붙이는 규칙: 사용자 메시지 `content` 는 `[text, (라벨 text, image_url)…]`. 그림은 모두 배경 `#967a5a`(150,120,90) 위 8배(지금 그림·후보·기준·버린 것) — 파이썬 `_bg(im, 8)` 와 같다. 예시는 이미 그 형태가 아니므로 8배로 키워 붙인다.

- [ ] **Step 1: 실패하는 시험 덧붙임**

```ts
// test/workshop/interiorPropsRunner.test.ts 끝에 덧붙임
import { DIRECTIONS, NEW_DIRECTIONS, drawBrief, reviewBrief } from "@/harnesses/interior-props/editor/prompts";
import { createInteriorRunner } from "@/harnesses/interior-props/editor/runner";
import type { DrawContext, WorkshopEnv } from "@/harnesses/_core/workshop/types";

const fakeEnv = (): WorkshopEnv & { loaded: string[] } => {
  const loaded: string[] = [];
  return {
    loaded,
    loadImage: async (url) => {
      loaded.push(url);
      if (url.includes("interior-chipset")) return sheet(48, 131, (tile) => (tile % 7 === 0 ? [0x9a, 0x54, 0x35, 255] : [0, 0, 0, 0]));
      return { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(200) };
    },
    encodePng: (image) => `data:image/png;fake,${image.width}x${image.height}`,
    assetUrl: (path) => `/${path}`,
  };
};

describe("interior-props 실행기", () => {
  it("방향: 있는 기물은 DIRECTIONS, 새 기물은 NEW_DIRECTIONS, 5장", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    await runner.prepare(env);
    expect(env.loaded.filter((u) => u.includes("interior-chipset")).length).toBe(1);
    const items = runner.items([{ key: "new:herb", title: "약초 걸이", description: "말린 약초", tilesW: 1, tilesH: 1, rise: 16, kind: "wall", category: "약방", use: [], refs: ["bookshelf"] }]);
    expect(items.length).toBe(415);
    const existing = items.find((i) => i.key === "crate:cabbage")!;
    const fresh = items.find((i) => i.key === "new:herb")!;
    expect(runner.directions(existing)).toEqual(DIRECTIONS);
    expect(runner.directions(fresh)).toEqual(NEW_DIRECTIONS);
    expect(runner.candidates).toBe(5);
    expect(runner.currentGrid(fresh)).toBeNull();
  });

  it("기준 그림: 가구에는 벽면 걸이·바닥 무늬와 3/4 위반 원본을 주지 않는다", async () => {
    const runner = createInteriorRunner();
    await runner.prepare(fakeEnv());
    const items = runner.items([]);
    const floorItem = items.find((i) => i.kind === "floor")!;
    const anchors = runner.anchors(floorItem, []);
    const kindOf = new Map(items.map((i) => [i.key, i.kind]));
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.length).toBeLessThanOrEqual(4);
    expect(anchors.every((a) => kindOf.get(a.itemKey) !== "hang" && kindOf.get(a.itemKey) !== "flat")).toBe(true);
    expect(anchors.some((a) => VIEW_FAIL.has(a.itemKey))).toBe(false);
    expect(anchors.some((a) => a.itemKey === floorItem.key)).toBe(false);
  });

  it("그리기 지시문: 캔버스·방향·꼭대기 면 규칙·지난 판정·답 형식", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    const item = runner.items([]).find((i) => i.key === "crate:cabbage")!;
    const ctx: DrawContext = {
      item, palette: runner.palette(item), direction: DIRECTIONS[2], roundNote: "더 밝은 나무", redrawNote: "", attempt: 2, maxAttempts: 3,
      previousGrid: runner.currentGrid(item), lastVerdict: { verdict: "FAIL", codes: ["FRONT"], top: "윗판 1행", topRows: 1, reasons: "납작", fix: "윗판 3행으로", worse: false },
      current: runner.currentGrid(item), anchors: [], rejected: [], notes: [],
    };
    const brief = drawBrief(ctx);
    expect(brief).toContain(`캔버스 ${item.width}×${item.height}px`);
    expect(brief).toContain("방향 C");
    expect(brief).toContain("3행 이상");
    expect(brief).toContain("윗판 3행으로");
    expect(brief).toContain("더 밝은 나무");
    expect(brief).toContain('"legend"');
    const messages = await runner.drawMessages(ctx, env);
    const parts = messages[1].content as { type: string }[];
    expect(parts.filter((p) => p.type === "image_url").length).toBeGreaterThanOrEqual(10);
  });

  it("검수 지시문: 꼭대기 면을 먼저 재고 JSON 하나로", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    const item = runner.items([]).find((i) => i.key === "crate:cabbage")!;
    const grid = runner.currentGrid(item)!;
    const text = reviewBrief({ item, palette: runner.palette(item), direction: DIRECTIONS[0], attempt: 1, maxAttempts: 3, candidate: grid, current: grid, anchors: [], previousVerdict: null });
    expect(text).toContain("꼭대기 면");
    expect(text).toContain("top_rows");
    const messages = await runner.reviewMessages({ item, palette: runner.palette(item), direction: DIRECTIONS[0], attempt: 1, maxAttempts: 3, candidate: grid, current: grid, anchors: [], previousVerdict: null }, env);
    expect((messages[1].content as { type: string }[]).some((p) => p.type === "image_url")).toBe(true);
  });
});
```

(시트 높이 131 칸 = 6268칸 ÷ 48 을 올림. `crate:cabbage` 의 칸 3292 가 들어간다.)

- [ ] **Step 2: Run (허락 시)** → FAIL

- [ ] **Step 3: prompts.ts** (파이썬 `brief.py`·`prompt.md`·`review.md` 의 내용을 에디터용으로 옮긴다 — 파일·도구 대신 첨부 그림과 JSON 답)

```ts
// src/harnesses/interior-props/editor/prompts.ts
/**
 * 실내 기물 지시문. 파이썬 하네스의 brief.py(방향·시점 절)·prompt.md(작업자)·review.md(검수자)를
 * 에디터용으로 옮겼다: 파일을 열게 하는 대신 그림을 첨부하고, pxg 대신 팔레트 키 JSON 격자로 답하게 한다.
 * 규칙 문장을 바꿀 때는 파이썬 쪽과 같이 바꾼다.
 */
import { gridToAnswer } from "@/harnesses/_core/workshop/grid";
import type { Direction, DrawContext, ReviewContext } from "@/harnesses/_core/workshop/types";
import { FLAT_KINDS, KIND_LABELS } from "./items";
import { rampSummary } from "./palette";

export const DIRECTIONS: Direction[] = [
  { letter: "A", text: "최소 수정: 지금 그림의 디자인·비율·색·결을 그대로 두고, 3/4 로 안 읽히는 곳(얇은 윗면 등)만 고친다. 화소 대부분이 그대로여야 한다." },
  { letter: "B", text: "최소 수정 (A 와 다른 해석): 지금 그림을 출발점으로, 윤곽·명암·윗면을 다듬어 더 단단하게. 모양과 크기는 지금과 같게." },
  { letter: "C", text: "기준 맞추기: 기준 그림들과 같은 결(윤곽 굵기·명암 단 수·나뭇결·윗면 두께)로 다시 찍는다. 물건과 크기는 지금 그대로." },
  { letter: "D", text: "기준 맞추기 (C 와 다른 해석): 기준 그림의 결을 따르되 디자인을 한 단계 더 다듬는다(장식·비례). 물건은 같다." },
  { letter: "E", text: "자유: 같은 화풍(기준 그림) 안에서 이 물건을 가장 잘 읽히게 새로 디자인한다. 캔버스는 지킨다." },
];
export const NEW_DIRECTIONS: Direction[] = [
  { letter: "A", text: "설명 충실: 설명 문장의 요소를 빠짐없이, 가장 전형적인 SFC 시절 JRPG 모양으로 그린다." },
  { letter: "B", text: "같은 방 화풍: 기준 그림의 다른 가구 결을 그대로 따라, 원래 그 방에 있던 물건처럼 그린다." },
  { letter: "C", text: "단순·또렷: 16px 칸에서 한눈에 읽히게 덩어리를 크게, 세부는 최소로." },
  { letter: "D", text: "장식: 같은 물건을 한 단계 화려하게(금장·문양·빛). 잔점·노이즈는 금지." },
  { letter: "E", text: "자유 해석: 같은 쓰임의 물건을 다른 디자인으로 해석한다. 캔버스는 지킨다." },
];
export const REJECT_REASONS: Readonly<Record<string, string>> = {
  view: "시점 이상", size: "크기·비율 이상", style: "화풍이 다름", read: "무슨 물건인지 안 읽힘", messy: "지저분함·잔점", worse: "원래 그림이 더 나음",
};
/** 3/4 예시(public/assets/harnesses/interior-props/examples) */
export const EXAMPLES: readonly { file: string; label: string }[] = [
  { file: "good-bookshelf", label: "맞는 예: 책장 — 윗판 윗면 3~4행" },
  { file: "bad-bookshelf", label: "틀린 예: 책장 — 윗판이 1행 띠(정면도)" },
  { file: "good-wardrobe", label: "맞는 예: 옷장 — 윗면 4행" },
  { file: "bad-wardrobe", label: "틀린 예: 옷장 — 정면도" },
  { file: "good-fireplace", label: "맞는 예: 벽난로 — 선반 윗면 5행" },
  { file: "bad-fireplace", label: "틀린 예: 벽난로 — 정면도" },
  { file: "good-sideboard", label: "맞는 예: 찬장 — 윗면 6행" },
  { file: "good-helmet-shelf", label: "맞는 예: 투구 선반 — 꼭대기 판 + 투구 정수리도 윗면이 보인다" },
  { file: "bad-helmet-shelf", label: "틀린 예: 투구 선반 — 위가 뚫린 틀, 투구는 납작한 정면 아이콘" },
];
/** 검수자가 꼭대기 행 수를 같은 배율로 비교할 칩셋 기준 */
export const REVIEW_REFS: readonly string[] = ["good-bookshelf", "good-wardrobe", "good-sideboard", "good-fireplace"];

const ANSWER_FORMAT = [
  "## 답 형식 — JSON 객체 하나만 (설명·마크다운 없이)",
  '{"legend": {"a": "wood:2", "b": "wood:6", "c": "shadow:0"}, "rows": ["..aab..", ".abbba.", …], "note": "무엇을 바꿨나 한 줄", "topRows": 3}',
  "- rows 는 위에서 아래로 한 줄씩, 글자 하나 = 화소 하나. 「.」 = 투명. 줄 수 = 캔버스 높이, 줄 길이 = 캔버스 폭.",
  "- legend 의 값은 아래 팔레트 키(램프이름:번호)만. 팔레트 밖 색은 못 쓴다.",
  "- topRows = 꼭대기 면 윗면 행 수(정수). 벽면 걸이·바닥 무늬면 null.",
].join("\n");

const VIEW_SECTION = [
  "## 시점 (3/4) — 재서 지킨다",
  "첨부한 예시 그림부터 본다. 「맞는 예」는 칩셋의 3/4 가구, 「틀린 예」는 같은 물건의 틀린 그림이다. 둘의 차이(꼭대기 윗면 행 수)를 눈에 익힌 뒤 그린다.",
  "- 카메라는 남쪽 위에서 내려다본다. 보이는 면 = 수평 면의 윗면 + 남쪽 면. 순수 정면도(아이콘)는 틀린다.",
  "- 꼭대기 면: 가구의 가장 높은 수평 면(윗판·뚜껑·덮개·좌판·기둥 머리)의 윗면을 3행 이상(큰 가구 4~6행). 칩셋 책장 3~4행 · 옷장 4행 · 찬장 6행 · 벽난로 5행.",
  "  위가 뚫린 틀(기둥만 솟고 윗판이 없다)은 안 된다.",
  "- 안쪽 판(선반판·칸막이판)은 윗면 2~3행 + 앞 모서리 1~2행. 안쪽 판이 잘 보여도 꼭대기 판을 대신하지 못한다.",
  "- 얹힌 물건(투구·책·단지·병·빵·화분)도 정수리·입구·뚜껑의 윗면이 보인다. 납작한 정면 아이콘으로 찍지 않는다.",
  "- 「북쪽 벽 앞 기물」은 벽 앞에 서 있는 가구다(깊이가 있다). 평평해도 되는 것은 벽면 걸이·바닥 무늬뿐이다.",
  "- 윗면 자리가 모자라면 남쪽 면(앞면)을 줄여서 만든다. 꼭대기 윗면을 깎지 않는다.",
  "- 옆을 보는 물건(동쪽을 보는 의자 등)의 남쪽 면은 그 물건의 옆모습이다 — 옆모습은 정상.",
  "- 기하 도형(원통·상자)으로 통째로 다시 만들지 마라. 손 도트 화풍(기준 그림·지금 그림)을 지킨다.",
  "- 끝내기 전에 세어서 note 에 「꼭대기 윗면 N행(y=a~b)」을 적고 topRows 에 N 을 넣는다. 3행 미만이면 고친 뒤 낸다 — 검수가 다시 재고, 3행 미만이면 무조건 떨어진다.",
].join("\n");

export function drawSystemPrompt(): string {
  return [
    "너는 OPRN 의 16px 손 도트 실내 기물 작업자다. 후보 한 장을 찍는다. 사용자가 같은 기물의 후보 5장 중에서 하나를 고른다 — 다른 4장과 다르게, 네 방향을 지켜서 찍어라.",
    "화풍: SFC 시절 JRPG 실내. 윤곽은 어두운 같은 램프 색, 명암은 램프 안에서 3~5단, 잔점·노이즈 금지.",
    "제3자 그림의 화소를 옮기지 마라. 답은 JSON 하나뿐이다.",
  ].join("\n");
}

export function drawBrief(ctx: DrawContext): string {
  const { item } = ctx;
  const flat = FLAT_KINDS.has(item.kind);
  const lines = [
    `# ${item.title} (\`${item.key}\`) — 방향 ${ctx.direction.letter}, 시도 ${ctx.attempt}/${ctx.maxAttempts}`,
    "",
    `- 물건: ${item.description || "(설명 없음)"}`,
    `- 종류: ${KIND_LABELS[item.kind] ?? item.kind} · 분류: ${item.category}${item.use.length ? ` · 쓰임: ${item.use.join(", ")}` : ""}`,
    `- 캔버스 ${item.width}×${item.height}px. 맨 위 ${item.padTop}줄은 비운다. 맨 아래 칠한 줄 = 바닥 접지선(캔버스 맨 아래). 배경은 투명.`,
    `- 너의 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    "",
  ];
  if (item.isNew && !ctx.current) {
    lines.push("## 새 기물 — 지금 그림이 없다", "설명대로 처음부터 그린다. 같은 방에 놓을 기준 그림과 윤곽 굵기·명암 단 수·크기감이 같아야 한다.", "");
  }
  if (ctx.roundNote) lines.push("## 사용자 메모 (가장 먼저 따른다)", ctx.roundNote, "");
  if (ctx.redrawNote) lines.push("## 이 장만 다시 — 사용자가 남긴 말", ctx.redrawNote, "");
  if (ctx.notes.length) lines.push("## 이 기물에 대한 사용자의 지난 말", ...ctx.notes.map((n) => `- ${n}`), "");
  if (ctx.lastVerdict) {
    lines.push(
      `## 지난 시도가 검수에서 떨어졌다 (${ctx.lastVerdict.codes.join(", ") || "이유 코드 없음"})`,
      `- 꼭대기: ${ctx.lastVerdict.top || "?"}`,
      `- 이유: ${ctx.lastVerdict.reasons || "?"}`,
      `- 고칠 것: ${ctx.lastVerdict.fix || "?"}`,
      "지난 격자(아래)에서 출발해 고칠 것만 고친다.",
      "",
    );
  }
  if (ctx.rejected.length) {
    lines.push("## 사용자가 버린 후보 (이렇게 하지 말 것 — 그림 첨부)", ...ctx.rejected.map((r, i) => `- 버린 것 ${i + 1}: ${r.reasons.join(", ") || "이유 없음"}${r.note ? ` · 「${r.note}」` : ""}`), "");
  }
  lines.push(
    "## 화풍 기준 (첨부한 기준 그림)",
    "윤곽 굵기·명암 단 수·결·크기감은 기준 그림을 따른다. 시점(윗면 행 수)은 아래 시점 절이 우선한다 — 기준 그림이 그보다 납작하면 시점 절을 따른다.",
    "",
  );
  lines.push(flat ? `## 시점\n- 이 물건은 ${KIND_LABELS[item.kind]}이다 — 평평한 게 정상이다. 칩셋의 같은 종류처럼 그린다.\n` : `${VIEW_SECTION}\n`);
  lines.push("## 팔레트 키", rampSummary(ctx.palette), "", ANSWER_FORMAT, "");
  const start = ctx.previousGrid ?? ctx.current;
  if (start) lines.push(ctx.previousGrid ? "## 지난 시도 격자 (여기서 출발)" : "## 지금 그림 격자 (여기서 출발)", JSON.stringify(gridToAnswer(start)), "");
  return lines.join("\n");
}

export function selfCheckText(ctx: DrawContext): string {
  return [
    "첨부한 것은 네 격자를 8배로 그린 그림이다(옆은 지금 그림). 다시 본다:",
    "- 지금 그림보다 나빠진 데가 없나? (사용자가 가장 싫어한 것: 「고쳤는데 더 이상해졌다」)",
    "- 기준 그림과 화풍(윤곽·명암·결)이 같나?",
    FLAT_KINDS.has(ctx.item.kind) ? "- 평평한 물건으로 읽히나?" : "- 꼭대기 면 윗면을 세어 본다 — 3행 이상인가? 위가 뚫린 틀이 아닌가? 얹힌 물건도 윗면이 보이나?",
    "고칠 것이 있으면 고친 전체 격자를, 없으면 같은 격자를 그대로 같은 JSON 형식으로 다시 낸다.",
  ].join("\n");
}

export function reviewSystemPrompt(): string {
  return [
    "너는 OPRN 16px 손 도트 실내 기물 후보의 독립 검수자다. 그린 사람이 아니다. 후보 한 장을 두 가지만 보고 합격/불합격을 낸다:",
    "(1) 3/4 시점이 지켜졌나, (2) 지금 그림보다 나빠지지 않았나. 취향(어느 후보가 제일 예쁜가)은 판정하지 않는다 — 그건 사용자가 고른다.",
    "답은 JSON 객체 하나뿐이다.",
  ].join("\n");
}

export function reviewBrief(ctx: ReviewContext): string {
  const flat = FLAT_KINDS.has(ctx.item.kind);
  return [
    `- 기물: ${ctx.item.title} — ${ctx.item.description} (종류 ${KIND_LABELS[ctx.item.kind] ?? ctx.item.kind} · 분류 ${ctx.item.category})`,
    `- 후보: 시도 ${ctx.attempt}/${ctx.maxAttempts}, 방향 ${ctx.direction.letter}: ${ctx.direction.text}`,
    ctx.current ? "- 첨부: 지금 그림|후보 나란히(8배), 후보(8배), 칩셋 기준 가구(8배), 화풍 기준." : "- 새 기물이라 지금 그림이 없다. 첨부: 후보(8배), 칩셋 기준 가구(8배), 화풍 기준. 「나빠졌나」 대신 같은 방 가구와 화풍·크기감이 같은지(STYLE)를 본다.",
    ctx.previousVerdict ? `- 지난 시도는 ${ctx.previousVerdict.codes.join(", ")} 로 떨어졌다: ${ctx.previousVerdict.reasons}. 이번에 고쳐졌는지 본다.` : "",
    "",
    flat ? "## 이 물건은 벽면 걸이·바닥 무늬다\n평평한 게 정상이다. 꼭대기 면은 「해당 없음」, top_rows 는 null. WORSE·READ·STYLE 만 본다." : [
      "## 꼭대기 면 — 가장 먼저 잰다",
      "- 가구의 가장 높은 수평 면(윗판·뚜껑·덮개·좌판·기둥 머리)을 찾아 그 윗면 행 수를 8배 그림에서 센다. 칩셋 기준: 책장 3~4행, 옷장 4행, 찬장 6행, 벽난로 5행(첨부 기준 가구).",
      "- 16px 판에서 3행 미만이면 FRONT. 위가 뚫린 틀(기둥만 솟고 윗판이 없다)도 FRONT.",
      "- 선반판·칸막이판처럼 안쪽 판은 꼭대기를 대신하지 못한다.",
      "- 얹힌 물건(투구·책·단지·병)도 윗면이 보여야 한다. 납작한 정면 도식이면 FRONT — 「소품 크기라 허용」은 없다.",
      "- 「북쪽 벽 앞 기물」은 벽 앞에 서 있는 가구다. 평평해도 되는 것은 벽면 걸이뿐이다.",
    ].join("\n"),
    "",
    "## 불합격 코드",
    "FRONT 정면 도면(윗면 없음·1~2행 띠) · THIN 수평 면이 납작한 띠로 읽힘 · TOPDOWN 위에서 본 판만 있고 남쪽 면이 없음 · CAP 기둥 머리 단면이 안 보임 · MIXED 부분마다 시점이 다름 · SIDE 안 보여야 할 동·서쪽 면이 크게 보임(옆을 보는 물건의 옆모습은 해당 없음) · WORSE 지금보다 나빠짐(디자인·비율이 깨짐, 기하 도형으로 다시 찍은 꼴, 뭉툭·지저분, 화풍이 다름) · READ 무슨 물건인지 안 읽힘 · STYLE (새 기물만) 같은 방 가구와 화풍·크기감이 다름",
    "- 지금 그림이 이미 3/4 로 충분히 읽히고 후보가 그것을 해치지 않았으면 합격이다. 고친 양이 적은 것은 불합격 사유가 아니다.",
    "- 있는 그림을 고친 후보는 확실하지 않은 의심만으로 떨어뜨리지 않는다. 그러나 꼭대기 면 규칙은 예외 없이 잰 수로 판정한다.",
    "",
    "## 답 형식 (JSON 하나, 한국어)",
    '{"verdict": "PASS" 또는 "FAIL", "codes": ["THIN", …], "top": "꼭대기 면 이름과 윗면 행 수 — 예: 윗판 윗면 3행(y=2~4). 없는 물건이면 \\"해당 없음: 이유\\"", "top_rows": 정수 또는 null, "surfaces": "그 밖의 수평 면 행 수", "worse": true/false, "reasons": "불합격이면 화소 위치로(행·열), 합격이면 한 줄 근거", "fix": "불합격이면 다음 시도에 고칠 것만 구체적으로, 합격이면 빈 문자열"}',
  ].filter((line) => line !== "").join("\n");
}
```

- [ ] **Step 4: runner.ts**

```ts
// src/harnesses/interior-props/editor/runner.ts
/** interior-props 의 공방 실행기. 매니페스트 harness.ts 의 workshop 로더가 부른다. */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { imageToGrid, onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type {
  AnchorSample, DrawContext, Grid, ItemDefinition, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem, WorkshopRunner,
} from "@/harnesses/_core/workshop/types";
import { interiorGate, interiorHardCheck, parseInteriorVerdict } from "./checks";
import { cropCells, FLAT_KINDS, itemFromDefinition, itemFromSpec, SHEET_PATH, specObjects, VIEW_FAIL } from "./items";
import { paletteForItem } from "./palette";
import { DIRECTIONS, drawBrief, drawSystemPrompt, EXAMPLES, NEW_DIRECTIONS, REVIEW_REFS, reviewBrief, reviewSystemPrompt, selfCheckText } from "./prompts";

const BACKGROUND: Rgba = [150, 120, 90, 255];
const ANCHOR_LIMIT = 4;

export function createInteriorRunner(): WorkshopRunner {
  let prepared: Promise<void> | null = null;
  const currentImages = new Map<string, RgbaImage>();
  const examples = new Map<string, string>();
  const palettes = new Map<string, Palette>();
  const currentGrids = new Map<string, Grid | null>();
  let specItems: WorkshopItem[] = [];
  let lastDefs: readonly ItemDefinition[] = [];
  let allItems: WorkshopItem[] = [];

  const shot = (env: WorkshopEnv, grid: Grid, palette: Palette, scale = 8): string =>
    env.encodePng(scaleImage(onBackground(renderGrid(grid, palette), BACKGROUND), scale));
  const image = (url: string): ContentPart => ({ type: "image_url", image_url: { url, detail: "high" } });
  const label = (text: string): ContentPart => ({ type: "text", text });

  function sideBySide(env: WorkshopEnv, left: Grid, right: Grid, palette: Palette): string {
    const a = onBackground(renderGrid(left, palette), BACKGROUND), b = onBackground(renderGrid(right, palette), BACKGROUND);
    const gap = 4, width = a.width + gap + b.width, height = Math.max(a.height, b.height);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set([60, 48, 36, 255], i);
    const blit = (src: RgbaImage, ox: number) => {
      for (let y = 0; y < src.height; y++) data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((y + height - src.height) * width + ox) * 4);
    };
    blit(a, 0);
    blit(b, a.width + gap);
    return env.encodePng(scaleImage({ width, height, data }, 8));
  }

  /** 기준 그림 격자는 그 기물의 팔레트 키다(own:N 은 기물마다 다르다) — 자기 팔레트로 그린다. 버린 후보는 같은 기물이라 ctx.palette. */
  const paletteOf = (itemKey: string, fallback: Palette): Palette => {
    const meta = allItems.find((i) => i.key === itemKey);
    return meta ? runner.palette(meta) : fallback;
  };

  const runner: WorkshopRunner = {
    harnessId: "interior-props",
    candidates: 5,
    prepare(env) {
      prepared ??= (async () => {
        const sheet = await env.loadImage(env.assetUrl(SHEET_PATH));
        specItems = specObjects().map(([key, object]) => {
          const current = cropCells(sheet, object.cells);
          currentImages.set(key, current);
          return itemFromSpec(key, object, current);
        });
        for (const example of EXAMPLES) {
          const picture = await env.loadImage(env.assetUrl(`assets/harnesses/interior-props/examples/${example.file}.png`));
          examples.set(example.file, env.encodePng(scaleImage(onBackground(picture, BACKGROUND), 8)));
        }
      })();
      return prepared;
    },
    items(defs) {
      if (defs !== lastDefs || allItems.length === 0) {
        lastDefs = defs;
        allItems = [...specItems, ...defs.map(itemFromDefinition)];
      }
      return allItems;
    },
    palette(item) {
      let palette = palettes.get(item.key);
      if (!palette) {
        palette = paletteForItem(currentImages.get(item.key) ?? null);
        palettes.set(item.key, palette);
      }
      return palette;
    },
    currentGrid(item) {
      if (!currentGrids.has(item.key)) {
        const current = currentImages.get(item.key);
        currentGrids.set(item.key, current ? imageToGrid(current, runner.palette(item)).grid : null);
      }
      return currentGrids.get(item.key) ?? null;
    },
    directions: (item) => (item.isNew ? NEW_DIRECTIONS : DIRECTIONS),
    anchors(item, picked) {
      const byKey = new Map(allItems.map((i) => [i.key, i]));
      const furniture = !FLAT_KINDS.has(item.kind);
      const ok = (candidate: WorkshopItem | undefined, fromSheet: boolean) =>
        candidate !== undefined && candidate.key !== item.key && !(furniture && FLAT_KINDS.has(candidate.kind)) && !(fromSheet && VIEW_FAIL.has(candidate.key));
      const out: AnchorSample[] = [];
      const push = (sample: AnchorSample) => { if (out.length < ANCHOR_LIMIT && !out.some((a) => a.itemKey === sample.itemKey)) out.push(sample); };
      for (const pick of picked) {
        const meta = byKey.get(pick.itemKey);
        if (ok(meta, false) && meta!.category === item.category) push({ ...pick, title: meta!.title });
      }
      const fromSheet = (candidate: WorkshopItem) => {
        const grid = runner.currentGrid(candidate);
        if (grid) push({ itemKey: candidate.key, title: candidate.title, grid, picked: false });
      };
      for (const ref of item.refs) { const meta = byKey.get(ref); if (ok(meta, true)) fromSheet(meta!); }
      for (const candidate of specItems) if (ok(candidate, true) && candidate.category === item.category) fromSheet(candidate);
      for (const candidate of specItems) if (ok(candidate, true) && candidate.kind === item.kind) fromSheet(candidate);
      return out;
    },
    async drawMessages(ctx: DrawContext, env) {
      const parts: ContentPart[] = [label(drawBrief(ctx))];
      if (!FLAT_KINDS.has(ctx.item.kind)) for (const example of EXAMPLES) parts.push(label(example.label), image(examples.get(example.file)!));
      if (ctx.current) parts.push(label("지금 시트의 그림(8배)"), image(shot(env, ctx.current, ctx.palette)));
      if (ctx.previousGrid) parts.push(label("지난 시도(8배)"), image(shot(env, ctx.previousGrid, ctx.palette)));
      for (const anchor of ctx.anchors) parts.push(label(`기준 그림: ${anchor.title}${anchor.picked ? " (이 프로젝트에서 고른 것)" : ""}`), image(shot(env, anchor.grid, paletteOf(anchor.itemKey, ctx.palette))));
      ctx.rejected.forEach((rejected, index) => parts.push(label(`버린 것 ${index + 1}`), image(shot(env, rejected.grid, ctx.palette))));
      return [{ role: "system", content: drawSystemPrompt() }, { role: "user", content: parts }] satisfies ChatMessage[];
    },
    selfCheckMessage(ctx, grid, env) {
      const parts: ContentPart[] = [label(selfCheckText(ctx)), label("네 격자(8배)"), image(shot(env, grid, ctx.palette))];
      if (ctx.current) parts.push(label("지금 그림(8배)"), image(shot(env, ctx.current, ctx.palette)));
      return { role: "user", content: parts };
    },
    async reviewMessages(ctx, env) {
      const parts: ContentPart[] = [label(reviewBrief(ctx))];
      if (ctx.current) parts.push(label("왼쪽 = 지금 그림, 오른쪽 = 후보 (8배)"), image(sideBySide(env, ctx.current, ctx.candidate, ctx.palette)));
      parts.push(label("후보 (8배)"), image(shot(env, ctx.candidate, ctx.palette)));
      if (!FLAT_KINDS.has(ctx.item.kind)) for (const file of REVIEW_REFS) parts.push(label(`칩셋 기준 가구: ${file.replace("good-", "")}`), image(examples.get(file)!));
      for (const anchor of ctx.anchors) parts.push(label(`화풍 기준: ${anchor.title}`), image(shot(env, anchor.grid, paletteOf(anchor.itemKey, ctx.palette))));
      return [{ role: "system", content: reviewSystemPrompt() }, { role: "user", content: parts }];
    },
    hardCheck: (item, grid) => interiorHardCheck(item, grid, runner.currentGrid(item)),
    parseVerdict: parseInteriorVerdict,
    gate: interiorGate,
  };
  return runner;
}
```

- [ ] **Step 5: Run (허락 시)** `npx vitest run test/workshop/interiorPropsRunner.test.ts --configLoader bundle` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/harnesses/interior-props/editor/prompts.ts src/harnesses/interior-props/editor/runner.ts test/workshop/interiorPropsRunner.test.ts
git commit -m "feat(workshop): 실내 기물 실행기(방향·그리기·자기 점검·검수 지시문)"
```

---

### Task 7: 에디터 어댑터 — 그림·채팅·세션

**Files:**
- Create: `src/editor/workshop/pixels.ts`
- Create: `src/editor/workshop/chat.ts`
- Create: `src/editor/workshop/workshopSession.ts`

**Interfaces:**
- Consumes: Task 1~6 전부, `chatCompletion`·`loadAiConfig`(`@/ai/llmClient`), `resolveSurfaceAiConfig`·`isAssistantEndpointReady`(`@/ai/assistantEndpoint`), `getAiConnectionStatus`(`@/editor/panels/aiConnectionStatus`), `composeSystemPrompt`(쓰지 않음 — 실행기가 system 을 이미 만든다), `conversationScopeKey`(`@/ai/conversationStore`), `store`(`@/project/store`), `getHarness`(`@/harnesses/_core/registry`)
- Produces:
  - pixels.ts: `browserWorkshopEnv(): WorkshopEnv`, `gridDataUrl(grid: Grid, palette: Palette, scale: number, background?: Rgba): string`
  - chat.ts: `createWorkshopChat(): ChatFn`, `workshopAiReady(): boolean`, `WORKSHOP_FAKE_CHAT_KEY = "__oprnWorkshopChat"`
  - workshopSession.ts: `WORKSHOP_CHANGED_EVENT = "oprn:workshop-changed"`, `savedConcurrency(): number`, `saveConcurrency(n: number): void`, `type WorkshopSession = { harnessId: string; projectKey: string; runner: WorkshopRunner; engine: WorkshopEngine; store: WorkshopStore; env: WorkshopEnv; items(): WorkshopItem[]; defs: ItemDefinition[]; rounds: WorkshopRound[]; picks: WorkshopPick[]; subscribe(listener: () => void): () => void; reload(): Promise<void> }`, `getWorkshopSession(harnessId: string): Promise<WorkshopSession>`, `peekWorkshopSession(harnessId: string): WorkshopSession | null`, `currentWorkshopProjectKey(): string`

이 Task 는 브라우저 전용(canvas·Image)이라 단위 시험이 없다. Task 10 화면 캡처로 확인한다.

- [ ] **Step 1: pixels.ts**

```ts
// src/editor/workshop/pixels.ts
/** 공방 실행기에 넘기는 브라우저 어댑터: 그림 읽기(canvas getImageData)·PNG 쓰기(toDataURL). */
import { onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type { Grid, Palette, Rgba, RgbaImage, WorkshopEnv } from "@/harnesses/_core/workshop/types";

function canvasOf(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d 를 못 연다");
  return context;
}

async function loadImage(url: string): Promise<RgbaImage> {
  const picture = new Image();
  picture.decoding = "async";
  picture.src = url;
  await picture.decode();
  const context = canvasOf(picture.naturalWidth, picture.naturalHeight);
  context.drawImage(picture, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, picture.naturalWidth, picture.naturalHeight);
  return { width, height, data };
}

function encodePng(image: RgbaImage): string {
  const context = canvasOf(image.width, image.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return context.canvas.toDataURL("image/png");
}

export function browserWorkshopEnv(): WorkshopEnv {
  return { loadImage, encodePng, assetUrl: (path) => `${import.meta.env.BASE_URL}${path}` };
}

const cache = new Map<string, string>();
/** 카드 그림. 같은 격자·배율은 다시 그리지 않는다(판 화면이 몇 초마다 다시 그려도 깜빡이지 않게). */
export function gridDataUrl(grid: Grid, palette: Palette, scale: number, background?: Rgba): string {
  const key = `${scale}|${background?.join(",") ?? ""}|${grid.width}x${grid.height}|${grid.cells.join(",")}`;
  let url = cache.get(key);
  if (!url) {
    const flat = renderGrid(grid, palette);
    url = encodePng(scaleImage(background ? onBackground(flat, background) : flat, scale));
    if (cache.size > 600) cache.clear();
    cache.set(key, url);
  }
  return url;
}
```

- [ ] **Step 2: chat.ts**

```ts
// src/editor/workshop/chat.ts
/**
 * 공방의 모델 호출 = 조수와 같은 엔드포인트(llmClient.chatCompletion), 표면 정책만 workshop-draw·workshop-review.
 * dev 빌드에서는 window.__oprnWorkshopChat 가 있으면 그것을 쓴다 — 모델 없이 화면을 찍는 QA 용(scripts/qa/workshop-capture.mjs).
 */
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { chatCompletion, loadAiConfig } from "@/ai/llmClient";
import type { ChatFn } from "@/harnesses/_core/workshop/types";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";

export const WORKSHOP_FAKE_CHAT_KEY = "__oprnWorkshopChat";

function fakeChat(): ChatFn | null {
  if (!import.meta.env.DEV) return null;
  const candidate = (window as unknown as Record<string, unknown>)[WORKSHOP_FAKE_CHAT_KEY];
  return typeof candidate === "function" ? (candidate as ChatFn) : null;
}

export function workshopAiReady(): boolean {
  if (fakeChat()) return true;
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}

export function createWorkshopChat(): ChatFn {
  return async (surface, request) => {
    const fake = fakeChat();
    if (fake) return fake(surface, request);
    const result = await chatCompletion(resolveSurfaceAiConfig(surface, loadAiConfig()), request);
    const content = result.message.content;
    return typeof content === "string" ? content : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");
  };
}
```

- [ ] **Step 3: workshopSession.ts**

```ts
// src/editor/workshop/workshopSession.ts
/**
 * 프로젝트 하나 × 하네스 하나의 공방 묶음(실행기·엔진·저장소). 화면을 닫아도 엔진은 계속 돈다.
 * 프로젝트가 바뀌면 옛 묶음을 dispose 한다 — 돌던 장은 저장소에 queued 로 남아 그 프로젝트를 다시 열면 resume 된다.
 */
import { conversationScopeKey } from "@/ai/conversationStore";
import { getHarness } from "@/harnesses/_core/registry";
import { createWorkshopEngine, type WorkshopEngine } from "@/harnesses/_core/workshop/engine";
import { openWorkshopStore, type WorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ItemDefinition, WorkshopEnv, WorkshopItem, WorkshopPick, WorkshopRound, WorkshopRunner } from "@/harnesses/_core/workshop/types";
import { store as projectStore } from "@/project/store";
import { createWorkshopChat } from "./chat";
import { browserWorkshopEnv } from "./pixels";

const CONCURRENCY_KEY = "oprn:workshop-concurrency";
/** 세션(판·고른 것)이 바뀌면 window 에 낸다 — 왼쪽 판이 듣는다. */
export const WORKSHOP_CHANGED_EVENT = "oprn:workshop-changed";

export type WorkshopSession = {
  readonly harnessId: string;
  readonly projectKey: string;
  readonly runner: WorkshopRunner;
  readonly engine: WorkshopEngine;
  readonly store: WorkshopStore;
  readonly env: WorkshopEnv;
  items(): WorkshopItem[];
  defs: ItemDefinition[];
  rounds: WorkshopRound[];
  picks: WorkshopPick[];
  subscribe(listener: () => void): () => void;
  reload(): Promise<void>;
};

const sessions = new Map<string, Promise<WorkshopSession>>();
const ready = new Map<string, WorkshopSession>();
let storePromise: Promise<WorkshopStore> | null = null;

export function currentWorkshopProjectKey(): string {
  return conversationScopeKey(projectStore.getProjectIdentity(), projectStore.getCurrent());
}

export function savedConcurrency(): number {
  try {
    const value = Number(localStorage.getItem(CONCURRENCY_KEY));
    return Number.isFinite(value) && value >= 1 && value <= 6 ? value : 3;
  } catch {
    return 3;
  }
}

export function saveConcurrency(n: number): void {
  try { localStorage.setItem(CONCURRENCY_KEY, String(n)); } catch { /* restricted storage */ }
}

export function peekWorkshopSession(harnessId: string): WorkshopSession | null {
  return ready.get(`${harnessId}|${currentWorkshopProjectKey()}`) ?? null;
}

export function getWorkshopSession(harnessId: string): Promise<WorkshopSession> {
  const projectKey = currentWorkshopProjectKey();
  const id = `${harnessId}|${projectKey}`;
  for (const [key, session] of ready) {
    if (key.startsWith(`${harnessId}|`) && key !== id) {
      session.engine.dispose();
      ready.delete(key);
      sessions.delete(key);
    }
  }
  let pending = sessions.get(id);
  if (!pending) {
    pending = createSession(harnessId, projectKey);
    sessions.set(id, pending);
    pending.then((session) => ready.set(id, session), () => sessions.delete(id));
  }
  return pending;
}

async function createSession(harnessId: string, projectKey: string): Promise<WorkshopSession> {
  const harness = getHarness(harnessId);
  if (!harness?.workshop) throw new Error(`${harnessId} 는 공방 실행기가 없다`);
  const [runner, store] = await Promise.all([harness.workshop(), (storePromise ??= openWorkshopStore())]);
  const env = browserWorkshopEnv();
  await runner.prepare(env);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
    window.dispatchEvent(new Event(WORKSHOP_CHANGED_EVENT));
  };
  const session: WorkshopSession = {
    harnessId, projectKey, runner, store, env,
    engine: createWorkshopEngine({
      runner, env, store, projectKey, chat: createWorkshopChat(), concurrency: savedConcurrency(),
      onChange: (round) => {
        const index = session.rounds.findIndex((r) => r.id === round.id);
        if (index >= 0) session.rounds[index] = round;
        else session.rounds.push(round);
        notify();
      },
    }),
    defs: [], rounds: [], picks: [],
    items: () => runner.items(session.defs),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async reload() {
      const [defs, rounds, picks] = await Promise.all([store.listItemDefs(projectKey), store.listRounds(projectKey), store.listPicks(projectKey)]);
      session.defs = defs;
      session.rounds = rounds.filter((round) => round.harnessId === harnessId);
      session.picks = picks;
      notify();
    },
  };
  await session.reload();
  await session.engine.resume();
  return session;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/editor/workshop/pixels.ts src/editor/workshop/chat.ts src/editor/workshop/workshopSession.ts
git commit -m "feat(workshop): 에디터 어댑터(그림·채팅·세션)"
```

---

### Task 8: 왼쪽 「공방」 판 + 오버레이 셸 + 기물 목록

**Files:**
- Create: `src/editor/panels/leftWorkshopPane.ts`
- Modify: `src/editor/panels/aiSidebarWorkspace.ts:8-15, 38-58`
- Create: `src/editor/workshop/workshopWorkspace.ts`
- Create: `src/editor/workshop/workshopStatus.ts`
- Create: `src/styles/database/workshop/index.css`, `src/styles/database/workshop/workshop.css`
- Test: `test/workshop/workshopStatus.test.ts`

**Interfaces:**
- Consumes: Task 7 세션, `workshopHarnesses`(registry), `workshopAiReady`, `openAiSettingsModal`(`@/editor/panels/aiSettingsModal`), `deckIcon`, `el`·`clearChildren`(`@/util/dom`), `store`(`@/project/store`)
- Produces:
  - workshopStatus.ts: `type ItemState = "drawing" | "choose" | "picked" | "idle"`, `itemState(itemKey: string, rounds: readonly WorkshopRound[], picks: readonly WorkshopPick[]): ItemState`, `latestRound(itemKey, rounds): WorkshopRound | null`, `roundProgress(round): { done: number; total: number }`, `etaMinutes(rounds: readonly WorkshopRound[], concurrency: number): number`, `ITEM_STATE_LABELS`
  - workshopWorkspace.ts: `openWorkshop(harnessId: string): Promise<void>`, `closeWorkshop(): void`, `isWorkshopOpen(): boolean`
  - leftWorkshopPane.ts: `createLeftWorkshopPane(): { root: HTMLElement; show(): void; dispose(): void }`

- [ ] **Step 1: 상태 계산 시험 (순수 함수만)**

```ts
// test/workshop/workshopStatus.test.ts
import { describe, expect, it } from "vitest";
import { etaMinutes, itemState, roundProgress } from "@/editor/workshop/workshopStatus";
import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";

const run = (status: WorkshopRun["status"], startedAt: number | null = null, finishedAt: number | null = null): WorkshopRun => ({
  letter: "A", direction: "", status, attempt: 1, attempts: [], grid: null, note: "", topRows: null, verdict: null, error: null, calls: 0, redrawNote: "", startedAt, finishedAt,
});
const round = (id: string, created: number, statuses: WorkshopRun["status"][]): WorkshopRound => ({ id, projectKey: "p", harnessId: "h", itemKey: "box", note: "", created, runs: statuses.map((s) => run(s)) });

describe("공방 기물 상태", () => {
  it("그리는 중 > 고를 차례 > 고름 > 아직", () => {
    expect(itemState("box", [], [])).toBe("idle");
    expect(itemState("box", [round("r1", 1, ["done", "drawing"])], [])).toBe("drawing");
    expect(itemState("box", [round("r1", 1, ["done", "failed"])], [])).toBe("choose");
    expect(itemState("box", [round("r1", 1, ["done"])], [{ projectKey: "p", itemKey: "box", roundId: "r1", letter: "A", at: 5 }])).toBe("picked");
    // 고른 뒤 새 판을 뽑아 다 그렸으면 다시 고를 차례
    expect(itemState("box", [round("r1", 1, ["done"]), round("r2", 9, ["done"])], [{ projectKey: "p", itemKey: "box", roundId: "r1", letter: "A", at: 5 }])).toBe("choose");
    // 취소만 남은 판은 고를 것이 없다
    expect(itemState("box", [round("r1", 1, ["cancelled"])], [])).toBe("idle");
  });
  it("진행·예상 시간", () => {
    expect(roundProgress(round("r", 1, ["done", "queued", "failed"]))).toEqual({ done: 2, total: 3 });
    const finished = { ...round("r", 1, []), runs: [run("done", 0, 120_000), run("done", 0, 240_000), run("queued"), run("queued")] };
    expect(etaMinutes([finished], 2)).toBe(3); // 평균 3분 × 남은 2장 ÷ 동시 2
    expect(etaMinutes([round("r", 1, ["queued", "queued", "queued"])], 3)).toBe(3); // 기록 없으면 장당 3분
  });
});
```

- [ ] **Step 2: Run (허락 시)** → FAIL

- [ ] **Step 3: workshopStatus.ts**

```ts
// src/editor/workshop/workshopStatus.ts
/** 공방 화면의 순수 계산(기물 상태·진행·예상 시간). DOM 없음 — 시험한다. */
import type { WorkshopPick, WorkshopRound } from "@/harnesses/_core/workshop/types";

export type ItemState = "drawing" | "choose" | "picked" | "idle";
export const ITEM_STATE_LABELS: Readonly<Record<ItemState, string>> = { choose: "고를 차례", drawing: "그리는 중", picked: "고름", idle: "아직" };
const PENDING = new Set(["queued", "drawing", "reviewing"]);
const FALLBACK_MINUTES = 3;

export function latestRound(itemKey: string, rounds: readonly WorkshopRound[]): WorkshopRound | null {
  let latest: WorkshopRound | null = null;
  for (const round of rounds) if (round.itemKey === itemKey && (!latest || round.created >= latest.created)) latest = round;
  return latest;
}

export function itemState(itemKey: string, rounds: readonly WorkshopRound[], picks: readonly WorkshopPick[]): ItemState {
  const round = latestRound(itemKey, rounds);
  const pick = picks.find((p) => p.itemKey === itemKey);
  if (round?.runs.some((run) => PENDING.has(run.status))) return "drawing";
  const choosable = round?.runs.some((run) => run.status === "done" || run.status === "failed");
  // 고른 판이 지워졌으면(pickedRound 없음) 새 판이 고를 차례다
  const pickedRound = pick ? rounds.find((r) => r.id === pick.roundId) : undefined;
  if (round && choosable && (!pick || (pick.roundId !== round.id && (!pickedRound || pickedRound.created < round.created)))) return "choose";
  return pick ? "picked" : "idle";
}

export function roundProgress(round: WorkshopRound): { done: number; total: number } {
  return { done: round.runs.filter((run) => !PENDING.has(run.status)).length, total: round.runs.length };
}

export function etaMinutes(rounds: readonly WorkshopRound[], concurrency: number): number {
  const durations: number[] = [];
  let remaining = 0;
  for (const round of rounds) {
    for (const run of round.runs) {
      if (PENDING.has(run.status)) remaining += 1;
      else if (run.status === "done" && run.startedAt !== null && run.finishedAt !== null) durations.push(run.finishedAt - run.startedAt);
    }
  }
  const perRun = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length / 60_000 : FALLBACK_MINUTES;
  return Math.ceil((perRun * remaining) / Math.max(1, concurrency));
}
```

- [ ] **Step 4: Run (허락 시)** → PASS

- [ ] **Step 5: leftWorkshopPane.ts**

```ts
// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 이 프로젝트에서 쓸 수 있는 하네스(레지스트리 workshopHarnesses)와 진행 중인 판 수.
 * 누르면 큰 화면(오버레이)을 연다. 모델 연결이 안 됐으면 AI 설정으로 가는 버튼만 보인다.
 */
import { workshopHarnesses } from "@/harnesses/_core/registry";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { workshopAiReady } from "@/editor/workshop/chat";
import { peekWorkshopSession, WORKSHOP_CHANGED_EVENT } from "@/editor/workshop/workshopSession";
import { itemState } from "@/editor/workshop/workshopStatus";
import { openWorkshop } from "@/editor/workshop/workshopWorkspace";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

export function createLeftWorkshopPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-workshop-pane", attrs: { "aria-label": "공방" }, dataset: { testid: "left-workshop-pane" } });
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    root.append(
      el("h2", { class: "left-workshop-title", text: "공방" }),
      el("p", { class: "left-workshop-lead", text: "AI 가 그림 후보를 여러 장 그리고, 고르는 건 직접 합니다. 결과는 이 프로젝트에만 남습니다." }),
    );
    if (!workshopAiReady()) {
      root.append(el("button", {
        class: "left-workshop-connect", text: "AI 설정에서 연결", attrs: { type: "button" }, dataset: { testid: "left-workshop-connect" },
        on: { click: () => { openAiSettingsModal(); } },
      }));
      return;
    }
    const harnesses = workshopHarnesses(store.getCurrent().system.genre ?? null);
    if (harnesses.length === 0) {
      root.append(el("p", { class: "left-workshop-empty", text: "이 프로젝트에서 쓸 수 있는 공방이 아직 없습니다." }));
      return;
    }
    root.append(el("ul", {
      class: "left-workshop-list",
      children: harnesses.map((harness) => {
        const session = peekWorkshopSession(harness.id);
        const items = session?.items() ?? [];
        const drawing = items.filter((item) => itemState(item.key, session!.rounds, session!.picks) === "drawing").length;
        const choose = items.filter((item) => itemState(item.key, session!.rounds, session!.picks) === "choose").length;
        return el("li", {
          children: [el("button", {
            class: "left-workshop-open", attrs: { type: "button" }, dataset: { testid: `left-workshop-open-${harness.id}` },
            on: { click: () => { void openWorkshop(harness.id); } },
            children: [
              el("strong", { text: harness.title }),
              el("span", { class: "left-workshop-meta", text: session ? `그리는 중 ${drawing} · 고를 차례 ${choose}` : "열기" }),
            ],
          })],
        });
      }),
    }));
  };
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, render);
  return { root, show: render, dispose: () => window.removeEventListener(WORKSHOP_CHANGED_EVENT, render) };
}
```

- [ ] **Step 6: aiSidebarWorkspace.ts 수정**

```ts
import { createLeftWorkshopPane } from "./leftWorkshopPane";
...
const PANES = ["tools", "maps", "favorites", "progress", "links", "workshop"] as const;
...
  const surfaces: Record<Exclude<Pane, "tools">, PaneSurface> = {
    maps: createMapSidebarSection(),
    favorites: createLeftFavoritesPane(),
    progress: createLeftProgressPane(journeyScope),
    links: createLeftLinksPane(),
    workshop: createLeftWorkshopPane(),
  };
...
    links: item("link", "연결", "sidebar-links", () => activate("links")),
    workshop: item("wrench", "공방", "sidebar-workshop", () => activate("workshop")),
```

- [ ] **Step 7: workshopWorkspace.ts (셸·기물 목록·키보드. 판 화면은 Task 9)**

```ts
// src/editor/workshop/workshopWorkspace.ts
/**
 * 공방 큰 화면 — tilesetAiWorkspaceModal 처럼 document.body 위 오버레이.
 * 왼쪽: 기물 목록(고를 차례·그리는 중·고름·전체 + 검색, 새 기물). 오른쪽: 판 화면(workshopRoundView).
 * 화면을 닫아도 엔진은 계속 돈다. 다시 그리기는 세션 변경 알림 때 서명(signature)이 바뀐 경우에만 — 깜빡임 방지.
 */
import "@/styles/database/workshop/index.css";
import type { WorkshopItem } from "@/harnesses/_core/workshop/types";
import { clearChildren, el } from "@/util/dom";
import { renderItemForm } from "./workshopItemForm";
import { renderRoundView, type RoundViewState } from "./workshopRoundView";
import { getWorkshopSession, saveConcurrency, type WorkshopSession } from "./workshopSession";
import { etaMinutes, ITEM_STATE_LABELS, itemState, type ItemState } from "./workshopStatus";

type Filter = ItemState | "all";
const FILTERS: Filter[] = ["choose", "drawing", "picked", "all"];

let host: HTMLElement | null = null;
let session: WorkshopSession | null = null;
let unsubscribe: (() => void) | null = null;
let filter: Filter = "choose";
let query = "";
let selectedKey: string | null = null;
let showForm = false;
let lastSignature = "";
const view: RoundViewState = { selected: 0, zoom: "fit", rejectFor: null };

export function isWorkshopOpen(): boolean {
  return host !== null;
}

export async function openWorkshop(harnessId: string): Promise<void> {
  closeWorkshop();
  host = el("div", {
    class: "workshop-host", dataset: { testid: "workshop-host" },
    on: { click: (event) => { if (event.target === host) closeWorkshop(); } },
  });
  host.append(el("div", { class: "workshop-loading", text: "공방을 여는 중…" }));
  document.body.append(host);
  document.addEventListener("keydown", onKeydown);
  try {
    session = await getWorkshopSession(harnessId);
  } catch (error) {
    clearChildren(host);
    host.append(el("div", { class: "workshop-loading", text: `공방을 열지 못했습니다: ${(error as Error).message}` }));
    return;
  }
  unsubscribe = session.subscribe(() => render(false));
  render(true);
}

export function closeWorkshop(): void {
  document.removeEventListener("keydown", onKeydown);
  unsubscribe?.();
  unsubscribe = null;
  host?.remove();
  host = null;
  session = null;
  lastSignature = "";
}

function visibleItems(s: WorkshopSession): WorkshopItem[] {
  const needle = query.trim().toLowerCase();
  return s.items().filter((item) => {
    if (needle && !`${item.title} ${item.key} ${item.category}`.toLowerCase().includes(needle)) return false;
    return filter === "all" || itemState(item.key, s.rounds, s.picks) === filter;
  });
}

function signature(s: WorkshopSession): string {
  return JSON.stringify([filter, query, selectedKey, showForm, view, s.picks.map((p) => `${p.itemKey}|${p.roundId}|${p.letter}`), s.defs.length,
    s.rounds.map((r) => [r.id, r.runs.map((run) => [run.status, run.attempt, run.verdict?.verdict, run.grid?.cells.length])]), s.engine.status()]);
}

function render(force: boolean): void {
  if (!host || !session) return;
  const s = session;
  const next = signature(s);
  if (!force && next === lastSignature) return;
  lastSignature = next;
  const items = visibleItems(s);
  // 보이는 목록에서 빠지면(예: 「고를 차례」에서 하나 고름) 다음 것을 자동으로 연다 — 기다림 화면 겸 다음 차례
  if (!selectedKey || !items.some((item) => item.key === selectedKey)) {
    selectedKey = items[0]?.key ?? null;
    view.selected = 0;
    view.rejectFor = null;
  }
  const status = s.engine.status();
  const eta = etaMinutes(s.rounds, status.concurrency);
  const selected = s.items().find((item) => item.key === selectedKey) ?? null;
  const scrollTop = host.querySelector(".workshop-items")?.scrollTop ?? 0;
  clearChildren(host);
  host.append(el("section", {
    class: "workshop", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "공방" }, dataset: { testid: "workshop" },
    children: [
      el("header", {
        class: "workshop-head",
        children: [
          el("h2", { text: "공방 · 손 도트 실내 기물" }),
          el("span", {
            class: "workshop-progress", dataset: { testid: "workshop-progress" },
            text: status.running + status.queued > 0 ? `그리는 중 ${status.running} · 대기 ${status.queued} · 약 ${eta}분 남음` : "쉬는 중",
          }),
          ...(status.blocked ? [el("span", { class: "workshop-blocked", text: status.blocked })] : []),
          ...(s.store.backend === "memory" ? [el("span", { class: "workshop-blocked", text: "이 브라우저는 저장소를 못 열어 새로 고침하면 후보��� 사라집니다." })] : []),
          el("label", {
            class: "workshop-concurrency",
            children: ["동시에", el("select", {
              dataset: { testid: "workshop-concurrency" },
              on: { change: (event) => { const n = Number((event.target as HTMLSelectElement).value); s.engine.setConcurrency(n); saveConcurrency(n); render(true); } },
              children: [1, 2, 3, 4, 5, 6].map((n) => el("option", { value: n, text: `${n}장`, attrs: n === status.concurrency ? { selected: "" } : {} })),
            })],
          }),
          el("button", { class: "workshop-close", text: "닫기", attrs: { type: "button", "aria-label": "공방 닫기" }, on: { click: closeWorkshop } }),
        ],
      }),
      el("div", {
        class: "workshop-body",
        children: [
          el("nav", {
            class: "workshop-side",
            children: [
              el("div", {
                class: "workshop-filters", attrs: { role: "tablist" },
                children: FILTERS.map((f) => el("button", {
                  class: "workshop-filter" + (f === filter ? " is-active" : ""), attrs: { type: "button", role: "tab", "aria-selected": String(f === filter) },
                  dataset: { testid: `workshop-filter-${f}` },
                  text: `${f === "all" ? "전체" : ITEM_STATE_LABELS[f]} ${f === "all" ? s.items().length : s.items().filter((item) => itemState(item.key, s.rounds, s.picks) === f).length}`,
                  on: { click: () => { filter = f; selectedKey = null; render(true); } },
                })),
              }),
              el("input", {
                class: "workshop-search", value: query, attrs: { type: "search", placeholder: "기물 찾기", "aria-label": "기물 찾기" },
                on: { input: (event) => { query = (event.target as HTMLInputElement).value; render(true); } },
              }),
              el("button", { class: "workshop-new", text: "+ 새 기물 정의", attrs: { type: "button" }, dataset: { testid: "workshop-new-item" }, on: { click: () => { showForm = true; render(true); } } }),
              el("ul", {
                class: "workshop-items",
                children: items.map((item) => el("li", {
                  children: [el("button", {
                    class: "workshop-item" + (item.key === selectedKey ? " is-selected" : ""), attrs: { type: "button" },
                    dataset: { testid: "workshop-item", key: item.key, state: itemState(item.key, s.rounds, s.picks) },
                    on: { click: () => { selectedKey = item.key; showForm = false; view.selected = 0; view.rejectFor = null; render(true); } },
                    children: [el("span", { class: "workshop-item-title", text: item.title }), el("span", { class: "workshop-item-meta", text: `${item.category} · ${ITEM_STATE_LABELS[itemState(item.key, s.rounds, s.picks)]}` })],
                  })],
                })),
              }),
            ],
          }),
          el("main", {
            class: "workshop-main",
            children: [showForm
              ? renderItemForm(s, (key) => { showForm = false; selectedKey = key; filter = "all"; render(true); }, () => { showForm = false; render(true); })
              : selected ? renderRoundView(s, selected, view, () => render(true))
              : el("p", { class: "workshop-empty", text: filter === "choose" ? "고를 차례인 기물이 없습니다. 다 그리면 여기 나타납니다." : "기물이 없습니다." })],
          }),
        ],
      }),
    ],
  }));
  const list = host.querySelector(".workshop-items");
  if (list) list.scrollTop = scrollTop;
}

function onKeydown(event: KeyboardEvent): void {
  if (!host || !session) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
  if (event.key === "Escape") {
    if (view.rejectFor) { view.rejectFor = null; render(true); } else closeWorkshop();
    event.preventDefault();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const items = visibleItems(session);
    const index = items.findIndex((item) => item.key === selectedKey);
    const next = items[Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) { selectedKey = next.key; view.selected = 0; view.rejectFor = null; render(true); }
    event.preventDefault();
    return;
  }
  host.querySelector<HTMLElement>(`[data-key-action="${event.key.toLowerCase()}"]`)?.click();
}
```

판 화면(Task 9)은 단축키를 `data-key-action` 단추로 노출한다(1~5·0·enter·x·r·f). 이렇게 하면 키보드 경로와 클릭 경로가 같은 처리기를 탄다.

- [ ] **Step 8: CSS**

`src/styles/database/workshop/index.css`:
```css
/* 공방 화면 — workshopWorkspace.ts 가 처음 열 때 불러온다(자료집 모달과 같은 지연 시트 방식). */
@import "./workshop.css" layer(database);
```

`src/styles/database/workshop/workshop.css`:
```css
.workshop-host { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; background: rgb(8 10 14 / 0.62); }
.workshop-loading { color: var(--text-1, #e8e4dc); font-size: 14px; }
.workshop { display: grid; grid-template-rows: auto 1fr; width: min(1320px, 96vw); height: min(880px, 94vh); background: var(--surface-1, #1b1d22); color: var(--text-1, #e8e4dc); border: 1px solid var(--border-1, #33363d); border-radius: 10px; overflow: hidden; }
.workshop-head { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border-1, #33363d); }
.workshop-head h2 { margin: 0; font-size: 15px; }
.workshop-progress { font-size: 12px; opacity: 0.8; }
.workshop-blocked { font-size: 12px; color: #f0a35a; }
.workshop-concurrency { margin-left: auto; display: flex; gap: 6px; align-items: center; font-size: 12px; }
.workshop-close { padding: 4px 10px; }
.workshop-body { display: grid; grid-template-columns: 260px 1fr; min-height: 0; }
.workshop-side { display: grid; grid-template-rows: auto auto auto 1fr; gap: 8px; padding: 10px; border-right: 1px solid var(--border-1, #33363d); min-height: 0; }
.workshop-filters { display: flex; flex-wrap: wrap; gap: 4px; }
.workshop-filter { font-size: 12px; padding: 3px 8px; border-radius: 999px; }
.workshop-filter.is-active { background: var(--accent-1, #4a7bd0); color: #fff; }
.workshop-search { width: 100%; }
.workshop-items { list-style: none; margin: 0; padding: 0; overflow: auto; min-height: 0; }
.workshop-item { display: grid; width: 100%; text-align: left; padding: 6px 8px; border-radius: 6px; gap: 2px; }
.workshop-item.is-selected { background: var(--surface-3, #2c3038); }
.workshop-item-title { font-size: 13px; }
.workshop-item-meta { font-size: 11px; opacity: 0.7; }
.workshop-main { overflow: auto; padding: 14px; min-height: 0; }
.workshop-empty { opacity: 0.75; }
.workshop-round-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; margin-bottom: 10px; }
.workshop-round-head h3 { margin: 0; font-size: 16px; }
.workshop-round-desc { font-size: 12px; opacity: 0.8; flex-basis: 100%; }
.workshop-start { display: grid; gap: 6px; max-width: 560px; margin: 8px 0 16px; }
.workshop-start textarea { min-height: 52px; }
.workshop-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.workshop-card { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--border-1, #33363d); border-radius: 8px; background: var(--surface-2, #22252b); }
.workshop-card.is-selected { outline: 2px solid var(--accent-1, #4a7bd0); }
.workshop-card.is-picked { border-color: #5fbf6a; }
.workshop-card-art { display: grid; place-items: center; min-height: 150px; background: #967a5a; border-radius: 4px; }
.workshop-card-art img { image-rendering: pixelated; }
.workshop-card[data-zoom="fit"] .workshop-card-art img { width: 100%; max-height: 260px; object-fit: contain; }
.workshop-card-facts { display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; }
.workshop-chip { padding: 1px 6px; border-radius: 999px; background: var(--surface-3, #2c3038); }
.workshop-chip.is-pass { background: #23452a; }
.workshop-chip.is-fail { background: #4d2626; }
.workshop-card-actions { display: flex; gap: 4px; flex-wrap: wrap; }
.workshop-card-actions button { font-size: 12px; padding: 3px 8px; }
.workshop-reasons { display: flex; flex-wrap: wrap; gap: 4px; }
.workshop-compare { display: flex; gap: 16px; align-items: end; margin-top: 16px; padding: 10px; background: #967a5a; border-radius: 8px; }
.workshop-compare figure { margin: 0; display: grid; gap: 4px; justify-items: center; color: #1b1d22; font-size: 12px; }
.workshop-compare img { image-rendering: pixelated; }
.workshop-form { display: grid; gap: 8px; max-width: 560px; }
.workshop-form label { display: grid; gap: 3px; font-size: 12px; }
.workshop-form-row { display: flex; gap: 8px; }
.workshop-form-actions { display: flex; gap: 8px; }
.left-workshop-pane { display: grid; gap: 8px; padding: 10px; }
.left-workshop-title { margin: 0; font-size: 14px; }
.left-workshop-lead { margin: 0; font-size: 12px; opacity: 0.8; }
.left-workshop-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.left-workshop-open { display: grid; width: 100%; text-align: left; gap: 2px; padding: 8px; border-radius: 6px; }
.left-workshop-meta { font-size: 11px; opacity: 0.75; }
```

`.left-workshop-*` 는 왼쪽 판이 공방 화면보다 먼저 보이므로 `leftWorkshopPane.ts` 도 같은 시트를 import 한다(한 번만 들어간다).

CSS 게이트(`gates:css` — 예산·표면·죽은 클래스)는 감독자가 돌린다. 새 시트 등록이 필요하다고 나오면 그 출력대로 `src/styles/TOKENS.md` 표와 예산 기준선을 고친다.

- [ ] **Step 9: Commit**

```bash
git add src/editor/panels/leftWorkshopPane.ts src/editor/panels/aiSidebarWorkspace.ts src/editor/workshop/workshopWorkspace.ts src/editor/workshop/workshopStatus.ts src/styles/database/workshop test/workshop/workshopStatus.test.ts
git commit -m "feat(workshop): 왼쪽 「공방」 판과 공방 화면 셸·기물 목록"
```

(이 커밋 시점에는 `workshopRoundView.ts`·`workshopItemForm.ts` 가 없어 빌드가 안 된다. Task 9 와 한 커밋으로 묶어도 된다 — 구현자 판단. 묶으면 Step 9 를 Task 9 끝으로 옮긴다.)

---

### Task 9: 판 화면 — 카드·고르기·버리기·다시 그리기·비교 + 새 기물 폼

**Files:**
- Create: `src/editor/workshop/workshopRoundView.ts`
- Create: `src/editor/workshop/workshopItemForm.ts`

**Interfaces:**
- Consumes: Task 7 `WorkshopSession`, `gridDataUrl`; Task 8 `latestRound`, `roundProgress`; Task 6 `REJECT_REASONS`; engine `CALLS_PER_CANDIDATE_ESTIMATE`; items `KIND_LABELS`, `newItemKey`, `itemFromDefinition`
- Produces:
  - `type RoundViewState = { selected: number; zoom: "fit" | "big"; rejectFor: string | null }`
  - `renderRoundView(session: WorkshopSession, item: WorkshopItem, state: RoundViewState, rerender: () => void): HTMLElement`
  - `renderItemForm(session: WorkshopSession, onSaved: (key: string) => void, onCancel: () => void): HTMLElement`

스펙의 V(단품/방 안 보기)는 방 안 미리보기가 2단계라 1단계에서 뺀다.

단축키(단추의 `data-key-action`): `1`~`5` 카드 고르기 위치, `enter` 선택한 카드 고르기, `0` 「지금 것이 낫다」(이 판 전부 버림, 이유 worse), `x` 선택한 카드 버리기(이유 칩 열기), `r` 선택한 카드만 다시 그리기, `f` 확대 맞춤/크게.

- [ ] **Step 1: workshopRoundView.ts**

```ts
// src/editor/workshop/workshopRoundView.ts
/**
 * 판 화면. 카드마다 단품(맞춤 확대) + 사실 칩(꼭대기 N행 · 검수 통과/불통과 · 다시 그린 횟수).
 * 「검수 통과」는 보증이 아니다 — 사람이 본다. 고르기는 사람만 한다.
 * 버린 이유는 다음 판 지시문의 「하지 말 것」이 된다(engine.contextFor → rejected).
 */
import { CALLS_PER_CANDIDATE_ESTIMATE } from "@/harnesses/_core/workshop/engine";
import type { WorkshopItem, WorkshopRun } from "@/harnesses/_core/workshop/types";
import { REJECT_REASONS } from "@/harnesses/interior-props/editor/prompts";
import { el } from "@/util/dom";
import { gridDataUrl } from "./pixels";
import type { WorkshopSession } from "./workshopSession";
import { latestRound, roundProgress } from "./workshopStatus";

export type RoundViewState = { selected: number; zoom: "fit" | "big"; rejectFor: string | null };

const BACKGROUND = [150, 120, 90, 255] as const;
const RUN_STATUS: Readonly<Record<WorkshopRun["status"], string>> = {
  queued: "기다리는 중", drawing: "그리는 중", reviewing: "검수 중", done: "다 그림", failed: "못 그림", cancelled: "취소됨",
};
const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function keyButton(action: string, text: string, onClick: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
  return el("button", { text, attrs: { type: "button", ...extra }, dataset: { keyAction: action }, on: { click: onClick } }) as HTMLButtonElement;
}

export function renderRoundView(session: WorkshopSession, item: WorkshopItem, state: RoundViewState, rerender: () => void): HTMLElement {
  const round = latestRound(item.key, session.rounds);
  const palette = session.runner.palette(item);
  const current = session.runner.currentGrid(item);
  const pick = session.picks.find((p) => p.itemKey === item.key);
  const scale = state.zoom === "big" ? 8 : 4;

  async function startRound(note: string): Promise<void> {
    await session.engine.startRound(item, { note });
    state.selected = 0;
    await session.reload();
  }
  async function choose(run: WorkshopRun): Promise<void> {
    if (!round) return;
    await session.store.putPick({ projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: run.letter, at: Date.now() });
    await session.store.addFeedback({ id: newId(), projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: run.letter, verdict: "pick", reasons: [], note: "", at: Date.now() });
    await session.reload();
  }
  async function reject(run: WorkshopRun | null, reasons: string[], note = ""): Promise<void> {
    if (!round) return;
    const targets = run ? [run] : round.runs.filter((r) => r.grid);
    for (const target of targets) {
      await session.store.addFeedback({ id: newId(), projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: target.letter, verdict: "reject", reasons, note, at: Date.now() });
    }
    state.rejectFor = null;
    await session.reload();
    rerender();
  }

  const note = el("textarea", { attrs: { placeholder: "그릴 때 지킬 말(선택) — 예: 나무를 더 밝게, 윗판을 두껍게", "aria-label": "판 메모" } }) as HTMLTextAreaElement;
  const startBlock = el("div", {
    class: "workshop-start",
    children: [
      note,
      el("button", {
        attrs: { type: "button" }, dataset: { testid: "workshop-start-round" },
        text: `후보 ${session.runner.candidates}장 뽑기 (모델 호출 약 ${session.runner.candidates * CALLS_PER_CANDIDATE_ESTIMATE}번)`,
        on: { click: () => { void startRound(note.value.trim()); } },
      }),
    ],
  });

  const head = el("div", {
    class: "workshop-round-head",
    children: [
      el("h3", { text: item.title }),
      el("span", { class: "workshop-chip", text: `${item.width}×${item.height}px` }),
      el("span", { class: "workshop-chip", text: item.category }),
      ...(round ? [el("span", { class: "workshop-chip", text: `판 ${roundProgress(round).done}/${roundProgress(round).total}` })] : []),
      ...(pick ? [el("span", { class: "workshop-chip is-pass", text: `고름: ${pick.letter}` })] : []),
      el("span", { class: "workshop-round-desc", text: item.description }),
    ],
  });

  if (!round) return el("div", { children: [head, startBlock, ...(current ? [compare(null)] : [])] });

  const runs = round.runs;
  state.selected = Math.max(0, Math.min(runs.length - 1, state.selected));
  const selectedRun = runs[state.selected];

  function card(run: WorkshopRun, index: number): HTMLElement {
    const picked = pick?.roundId === round!.id && pick.letter === run.letter;
    const rejected = state.rejectFor === run.letter;
    const facts = [
      el("span", { class: "workshop-chip", text: `${run.letter} · ${RUN_STATUS[run.status]}${run.status === "drawing" || run.status === "reviewing" ? ` ${run.attempt}/3` : ""}` }),
      ...(run.topRows !== null ? [el("span", { class: "workshop-chip", text: `꼭대기 ${run.topRows}행` })] : []),
      ...(run.verdict ? [el("span", { class: `workshop-chip ${run.verdict.verdict === "PASS" ? "is-pass" : "is-fail"}`, text: run.verdict.verdict === "PASS" ? "검수 통과" : `검수 불통과 ${run.verdict.codes.join(",")}`, attrs: { title: run.verdict.reasons } })] : []),
      ...(run.attempt > 1 ? [el("span", { class: "workshop-chip", text: `다시 그림 ${run.attempt - 1}번` })] : []),
      ...(run.error ? [el("span", { class: "workshop-chip is-fail", text: run.error, attrs: { title: run.error } })] : []),
    ];
    return el("article", {
      class: "workshop-card" + (index === state.selected ? " is-selected" : "") + (picked ? " is-picked" : ""),
      dataset: { testid: "workshop-card", letter: run.letter, status: run.status, zoom: state.zoom },
      on: { click: () => { state.selected = index; rerender(); } },
      children: [
        el("div", {
          class: "workshop-card-art",
          children: run.grid ? [el("img", { attrs: { src: gridDataUrl(run.grid, palette, scale, BACKGROUND), alt: `후보 ${run.letter}` } })] : [el("span", { text: RUN_STATUS[run.status] })],
        }),
        el("div", { class: "workshop-card-facts", children: facts }),
        ...(run.note ? [el("div", { class: "workshop-item-meta", text: run.note })] : []),
        el("div", {
          class: "workshop-card-actions",
          children: run.grid ? [
            el("button", { text: picked ? "고름 ✓" : "고르기", attrs: { type: "button" }, dataset: { testid: "workshop-pick" }, on: { click: (e) => { e.stopPropagation(); void choose(run); } } }),
            el("button", { text: "버리기", attrs: { type: "button" }, dataset: { testid: "workshop-reject" }, on: { click: (e) => { e.stopPropagation(); state.rejectFor = run.letter; rerender(); } } }),
            el("button", { text: "이 장 다시", attrs: { type: "button" }, on: { click: (e) => { e.stopPropagation(); void session.engine.redrawRun(round!.id, run.letter, note.value.trim()); } } }),
          ] : [],
        }),
        ...(rejected ? [el("div", {
          class: "workshop-reasons",
          children: Object.entries(REJECT_REASONS).map(([code, labelText]) => el("button", {
            text: labelText, attrs: { type: "button" }, on: { click: (e) => { e.stopPropagation(); void reject(run, [code]); } },
          })),
        })] : []),
      ],
    });
  }

  function compare(run: WorkshopRun | null): HTMLElement {
    const figures: HTMLElement[] = [];
    if (current) figures.push(el("figure", { children: [el("img", { attrs: { src: gridDataUrl(current, palette, 8, BACKGROUND), alt: "지금 그림" } }), el("figcaption", { text: "지금 시트의 그림" })] }));
    if (run?.grid) figures.push(el("figure", { children: [el("img", { attrs: { src: gridDataUrl(run.grid, palette, 8, BACKGROUND), alt: `후보 ${run.letter}` } }), el("figcaption", { text: `후보 ${run.letter}` })] }));
    return el("div", { class: "workshop-compare", dataset: { testid: "workshop-compare" }, children: figures });
  }

  const hidden = el("div", {
    attrs: { hidden: "" },
    children: [
      ...runs.map((_, index) => keyButton(String(index + 1), "", () => { state.selected = index; rerender(); })),
      keyButton("enter", "", () => { if (selectedRun?.grid) void choose(selectedRun); }),
      keyButton("x", "", () => { if (selectedRun?.grid) { state.rejectFor = selectedRun.letter; rerender(); } }),
      keyButton("0", "", () => { void reject(null, ["worse"], "지금 그림이 낫다"); }),
      keyButton("r", "", () => { if (selectedRun) void session.engine.redrawRun(round.id, selectedRun.letter, note.value.trim()); }),
      keyButton("f", "", () => { state.zoom = state.zoom === "fit" ? "big" : "fit"; rerender(); }),
    ],
  });

  const pending = runs.some((run) => run.status === "queued" || run.status === "drawing" || run.status === "reviewing");
  return el("div", {
    children: [
      head,
      el("p", { class: "workshop-item-meta", text: "1~5 카드 · Enter 고르기 · X 버리기 · 0 지금 것이 낫다 · R 이 장 다시 · F 확대 · ↑↓ 기물. 「검수 통과」는 AI 판정일 뿐입니다 — 직접 보고 고르세요." }),
      el("div", { class: "workshop-cards", children: runs.map(card) }),
      compare(selectedRun ?? null),
      pending
        ? el("button", { attrs: { type: "button" }, text: "이 판 그만 그리기", on: { click: () => { void session.engine.cancelRound(round.id); } } })
        : startBlock,
      hidden,
    ],
  });
}
```

- [ ] **Step 2: workshopItemForm.ts**

```ts
// src/editor/workshop/workshopItemForm.ts
/** 새 기물 정의 폼. 저장하면 이 프로젝트의 기물 목록에 들어가고 바로 후보를 뽑을 수 있다. */
import type { ItemDefinition } from "@/harnesses/_core/workshop/types";
import { KIND_LABELS, newItemKey } from "@/harnesses/interior-props/editor/items";
import { el } from "@/util/dom";
import type { WorkshopSession } from "./workshopSession";

export function renderItemForm(session: WorkshopSession, onSaved: (key: string) => void, onCancel: () => void): HTMLElement {
  const items = session.items();
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const field = (labelText: string, control: HTMLElement) => el("label", { children: [labelText, control] });
  const title = el("input", { attrs: { required: "", placeholder: "예: 약초 말리는 선반" } }) as HTMLInputElement;
  const description = el("textarea", { attrs: { placeholder: "그림 명세 — 무엇이 어디에 몇 개, 재료·색. 예: 나무 선반 3단, 말린 약초 다발이 걸려 있다." } }) as HTMLTextAreaElement;
  const tilesW = el("input", { value: 1, attrs: { type: "number", min: "1", max: "3" } }) as HTMLInputElement;
  const tilesH = el("input", { value: 1, attrs: { type: "number", min: "1", max: "2" } }) as HTMLInputElement;
  const rise = el("input", { value: 16, attrs: { type: "number", min: "0", max: "32", step: "1" } }) as HTMLInputElement;
  const kind = el("select", { children: Object.entries(KIND_LABELS).map(([value, text]) => el("option", { value, text })) }) as HTMLSelectElement;
  const category = el("input", { attrs: { list: "workshop-categories", placeholder: "분류(예: 약방)" } }) as HTMLInputElement;
  const use = el("input", { attrs: { placeholder: "쓰임(쉼표로) — 예: search" } }) as HTMLInputElement;
  const refs = el("select", {
    attrs: { multiple: "", size: "6", "aria-label": "닮은 기존 기물" },
    children: items.filter((item) => !item.isNew).map((item) => el("option", { value: item.key, text: `${item.title} · ${item.category}` })),
  }) as HTMLSelectElement;
  const error = el("p", { class: "workshop-blocked" });

  async function save(): Promise<void> {
    if (!title.value.trim() || !description.value.trim()) {
      error.textContent = "이름과 설명은 꼭 적어 주세요.";
      return;
    }
    const def: ItemDefinition = {
      key: newItemKey(title.value, new Set(items.map((item) => item.key))),
      title: title.value.trim(),
      description: description.value.trim(),
      tilesW: Math.max(1, Math.min(3, Number(tilesW.value) || 1)),
      tilesH: Math.max(1, Math.min(2, Number(tilesH.value) || 1)),
      rise: Math.max(0, Math.min(32, Number(rise.value) || 0)),
      kind: kind.value,
      category: category.value.trim() || "새 기물",
      use: use.value.split(",").map((s) => s.trim()).filter(Boolean),
      refs: [...refs.selectedOptions].map((option) => option.value).slice(0, 3),
    };
    await session.store.putItemDef(session.projectKey, def);
    await session.reload();
    onSaved(def.key);
  }

  return el("form", {
    class: "workshop-form", dataset: { testid: "workshop-item-form" },
    on: { submit: (event) => { event.preventDefault(); void save(); } },
    children: [
      el("h3", { text: "새 기물 정의" }),
      field("이름", title),
      field("설명(그림 명세)", description),
      el("div", { class: "workshop-form-row", children: [field("가로 칸", tilesW), field("세로 칸(발밑)", tilesH), field("위로 솟는 px", rise)] }),
      field("종류", kind),
      field("분류", category),
      el("datalist", { attrs: { id: "workshop-categories" }, children: categories.map((c) => el("option", { value: c })) }),
      field("쓰임", use),
      field("닮은 기존 기물(최대 3개, Ctrl/⌘ 로 여러 개)", refs),
      error,
      el("div", {
        class: "workshop-form-actions",
        children: [
          el("button", { text: "저장", attrs: { type: "submit" }, dataset: { testid: "workshop-item-save" } }),
          el("button", { text: "취소", attrs: { type: "button" }, on: { click: onCancel } }),
        ],
      }),
    ],
  });
}
```

- [ ] **Step 3: 실제 화면에서 손으로 확인**

```bash
cd /home/main/z-project/rpg-zzu-workshop && npm run dev:worktree
```
브라우저로 `http://127.0.0.1:9803/` 를 열어 왼쪽 막대 렌치 → 「공방」 판 → 「손 도트 실내 기물」 → 기물 하나 선택 → 화면이 열리는지만 본다(모델 호출은 Task 10 의 가짜 채팅으로).

- [ ] **Step 4: Commit**

```bash
git add src/editor/workshop/workshopRoundView.ts src/editor/workshop/workshopItemForm.ts
git commit -m "feat(workshop): 판 화면(카드·고르기·버리기·다시 그리기·비교)과 새 기물 폼"
```

---

### Task 10: 모델 없이 화면 캡처 + 문서

**Files:**
- Create: `scripts/qa/workshop-capture.mjs`
- Create: `openwiki/editor-workshop.md`
- Modify: `AGENTS.md` (Editor 목록에 한 줄), `openwiki/INDEX.md` (`npm run openwiki:index` 로 재생성)
- Output: `verify-shots/workshop/*.png`, `verify-shots/workshop/SUMMARY.md`

**Interfaces:**
- Consumes: dev 훅 `window.__oprnWorkshopChat`(Task 7), 시험 id(`sidebar-workshop`, `left-workshop-open-interior-props`, `workshop-item`, `workshop-start-round`, `workshop-card`, `workshop-pick`, `workshop-reject`, `workshop-new-item`, `workshop-item-form`)

- [ ] **Step 1: 캡처 스크립트**

```js
// scripts/qa/workshop-capture.mjs
// 공방 화면을 모델 없이 찍는다: window.__oprnWorkshopChat 가짜 채팅(dev 빌드 전용)이 격자와 검수 답을 낸다.
// BASE=http://127.0.0.1:9803 node scripts/qa/workshop-capture.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE ?? "http://127.0.0.1:9803";
const out = resolve("verify-shots/workshop");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const shots = [];
page.on("pageerror", (error) => errors.push(error.message));
const shot = async (name, note) => { await page.screenshot({ path: resolve(out, `${name}.png`) }); shots.push({ name, note }); };

await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "standard");
  localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  localStorage.setItem("oprn:standard-welcome-seen", "1");
  localStorage.setItem("oprn:ai-studio", "0");
  localStorage.removeItem("oprn:ai-sidebar-collapsed");
  let calls = 0;
  window.__oprnWorkshopChat = async (surface, request) => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 300));
    const text = JSON.stringify(request.messages);
    if (surface === "workshop-review") {
      const failing = calls % 7 === 0;
      return JSON.stringify({ verdict: failing ? "FAIL" : "PASS", codes: failing ? ["FRONT"] : [], top: failing ? "윗판 윗면 2행" : "윗판 윗면 3행(y=4~6)", top_rows: failing ? 2 : 3, reasons: failing ? "윗판이 2행" : "윗판 3행", fix: failing ? "윗판을 3행으로" : "", worse: false });
    }
    const m = /캔버스 (\d+)×(\d+)px/.exec(text);
    const w = Number(m?.[1] ?? 16), h = Number(m?.[2] ?? 16);
    const pad = Number(/맨 위 (\d+)줄은 비운다/.exec(text)?.[1] ?? 0);
    const shade = ["wood:3", "wood:5", "pine:3", "dwood:4", "stone:4"][calls % 5];
    const rows = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
      if (y < Math.max(pad, 2) || x < 1 || x >= w - 1) return ".";
      if (y < Math.max(pad, 2) + 3) return "t";
      return x === 1 || x === w - 2 || y === h - 1 ? "o" : "f";
    }).join(""));
    return JSON.stringify({ legend: { t: "wood:7", f: shade, o: "wood:1" }, rows, note: "가짜 그림 · 꼭대기 윗면 3행", topRows: 3 });
  };
});
await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByTestId("sidebar-workshop").click();
  await page.getByTestId("left-workshop-pane").waitFor();
  await shot("01-left-pane", "왼쪽 막대 「공방」 판");
  await page.getByTestId("left-workshop-open-interior-props").click();
  await page.getByTestId("workshop").waitFor();
  await page.getByTestId("workshop-filter-all").click();
  await page.locator('[data-testid="workshop-item"][data-key="wardrobe"]').click().catch(() => page.getByTestId("workshop-item").first().click());
  await shot("02-item-empty", "기물 선택, 아직 판 없음 — 지금 그림 비교");
  await page.getByTestId("workshop-start-round").click();
  await page.waitForTimeout(1500);
  await shot("03-drawing", "후보 그리는 중(진행 줄)");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="workshop-card"]')].every((card) => ["done", "failed"].includes(card.getAttribute("data-status"))), null, { timeout: 120_000 });
  await shot("04-round-done", "후보 5장 · 꼭대기 행 · 검수 칩");
  await page.keyboard.press("3");
  await page.keyboard.press("f");
  await shot("05-zoom-compare", "3번 선택 · 크게 · 비교");
  await page.keyboard.press("x");
  await shot("06-reject-reasons", "버리기 이유 칩");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await shot("07-picked", "고름 표시");
  await page.getByTestId("workshop-new-item").click();
  await page.getByTestId("workshop-item-form").waitFor();
  await shot("08-new-item-form", "새 기물 정의 폼");
} finally {
  writeFileSync(resolve(out, "SUMMARY.md"), [
    "# 공방 화면 캡처 (가짜 모델)", "",
    `- 기준: ${base}`, `- 페이지 오류: ${errors.length ? errors.join(" / ") : "없음"}`, "",
    ...shots.map((s) => `- \`${s.name}.png\` — ${s.note}`), "",
    "즉시 확인: 04-round-done.png, 05-zoom-compare.png",
  ].join("\n") + "\n");
  await browser.close();
}
if (errors.length) process.exitCode = 1;
```

- [ ] **Step 2: 실행**

```bash
cd /home/main/z-project/rpg-zzu-workshop && npm run dev:worktree   # 백그라운드로 띄워 둔다(이미 떠 있으면 생략)
BASE=http://127.0.0.1:9803 node scripts/qa/workshop-capture.mjs
```
Expected: `verify-shots/workshop/SUMMARY.md` 의 「페이지 오류: 없음」. 그다음 `04-round-done.png`·`05-zoom-compare.png` 를 열어 카드 5장·칩·비교가 보이는지 눈으로 확인한다. 크로미움이 백지(모듈이 `net::ERR_NETWORK_CHANGED` 로 끊김)면 `unshare -rn` 격리 netns 안에서 `ip link set lo up` 후 dev 서버와 이 스크립트를 같이 띄운다.

- [ ] **Step 3: `openwiki/editor-workshop.md`**

```markdown
# 에디터 「공방」 — 하네스를 에디터 안에서 돌린다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`) → 큰 화면(`src/editor/workshop/workshopWorkspace.ts`, body 오버레이).
- 어떤 하네스가 보이나: `workshopHarnesses(genre)` — 매니페스트 `entrypoints.editorUi` 가 true 이고 `workshop` 로더가 있고 장르가 맞는 것. 에디터는 하네스 폴더를 직접 import 하지 않는다.
- 실행기: `src/harnesses/_core/workshop/engine.ts`. 한 장 = 그리기 → 깨지면 고치기 ≤2 → 자기 점검 1 → 독립 검수(vision) → `runner.gate` → 불통과면 다시(시도 ≤3). 3번 다 불통과여도 사람이 볼 수 있게 「검수 불통과」로 남긴다. 동시 기본 3(1~6, `oprn:workshop-concurrency`), 429 면 하나 줄이고 기다린다, 401·403 이면 멈추고 AI 설정으로 안내.
- 모델: 표면 `workshop-draw`(감독 티어, 16384 토큰) · `workshop-review`(vision 역할, 4096). `src/ai/assistantEndpoint.ts` 표 한 줄씩. 사용자 자기 계정·조수와 같은 엔드포인트.
- 답 형식: 팔레트 키 격자 JSON `{"legend":{"a":"wood:6"},"rows":[…],"note","topRows"}`(`grid.ts`). pxg 아님.
- 저장: 이 기기 IndexedDB `oprn-workshop`(`store.ts`), 범위 키 = `conversationScopeKey`. 그림은 저장하지 않고 격자만. 문서·내보내기와 무관. 칩셋에 굽기는 2단계.
- 새 하네스 입주: 하네스 폴더에 `editor/runner.ts`(`WorkshopRunner`) + 매니페스트에 `workshop: () => import("./editor/runner").then(…)` + `editorUi: true`. 공용 화면은 지금 실내 기물 문구가 들어 있다(제목·버리기 이유) — 둘째 하네스가 들어올 때 실행기 쪽으로 옮긴다.
- QA: `BASE=http://127.0.0.1:<포트> node scripts/qa/workshop-capture.mjs` — dev 빌드의 `window.__oprnWorkshopChat` 가짜 채팅으로 모델 없이 찍는다. 결과 `verify-shots/workshop/`.
- 설계·계획: `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`.
```

`AGENTS.md` 의 Editor 목록(「Editor misc workflows」 줄 다음)에:
```markdown
   - 에디터 「공방」 (하네스를 에디터 안에서 사용자 계정 모델로 돌리기 — 왼쪽 막대, 실행기·저장·표면): `openwiki/editor-workshop.md`
```

Run: `cd /home/main/z-project/rpg-zzu-workshop && npm run openwiki:index`

- [ ] **Step 4: Commit**

```bash
git add scripts/qa/workshop-capture.mjs verify-shots/workshop openwiki/editor-workshop.md openwiki/INDEX.md AGENTS.md
git commit -m "docs(workshop): 공방 문서와 모델 없는 화면 캡처"
```

---

### Task 11: 실제 계정 시험 (사용자 확인 후)

**Files:** 없음(보고만). 결과 메모는 `verify-shots/workshop/REAL-RUN.md`.

- [ ] **Step 1:** 사용자에게 「실제 AI 계정으로 기물 3개 × 5장(호출 약 60번)을 돌려도 되는지」 묻는다. 허락 전에는 하지 않는다.
- [ ] **Step 2:** 허락되면 dev 서버(9803)에서 에디터 AI 설정이 연결된 상태로 공방을 열어 `bookshelf`·`wardrobe`·새 기물 하나(예: 약초 걸이)를 뽑는다. 장당 걸린 시간·호출 수·검수 결과·실패 이유를 `REAL-RUN.md` 에 적는다.
- [ ] **Step 3:** 같은 기물의 파이썬 하네스(gpt-6.1-sol) 결과와 나란히 놓은 비교 HTML 을 `~/claude-viz/workshop-real-run.html` 에 쓰고 Playwright 로 렌더를 확인한 뒤 `http://mdc-server:18301/workshop-real-run.html` 을 준다.
- [ ] **Step 4: Commit** `git add verify-shots/workshop/REAL-RUN.md && git commit -m "docs(workshop): 실제 계정 시험 기록"`

---

## 마무리

- 감독자(또는 허락받은 범위)가 `npx vitest run test/workshop --configLoader bundle` 와 `test/harnesses/monsterCollectSpecies.test.ts`·`test/assistantEndpoint.test.ts`·`test/modelRoles.test.ts` 를 돌린다. 게이트(`npm run gates`)는 감독자 몫.
- push → `gh pr create` → `link_pull_request` → 머지는 사용자 확인 후.
