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
  /** 발밑(막히는) 칸 줄 수 — 칩셋에 구울 때 통행을 정한다(없으면 맨 아래 1줄). */
  readonly footRows?: number;
  /** 발밑 위로 솟은 px — 칩셋에 구울 때 손 도트 사양의 up 이 된다. */
  readonly risePx?: number;
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
