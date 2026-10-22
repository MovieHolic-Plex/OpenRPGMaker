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
  /** 구워 넣을 칩셋. 없으면 손 도트 실내(atlas_biome_interior). 맵 기물(map-objects)은 정의할 때 지금 맵의 칩셋을 적는다. */
  readonly tilesetId?: string;
  /** 놓을 맵의 배경(문화·시대) 한 줄 — 「1배에서 그 물건으로 읽히나」를 그 배경 기준으로 본다(일본 거리의 공중전화는 일본식). */
  readonly setting?: string;
  /** 3/4 관문(object-gate) 종류(조언 배지용). 없으면 놓는 방식으로 정한다(hang → wall_mounted, flat → flat, 그 밖 other). */
  readonly gateKind?: string;
  /** 크기 결정(footprint.ts)이 정한 칸 통행: 위→아래 줄마다 X 막힘 · * 위에 그려짐(지나감). 칩셋에 구울 때 칸마다 쓴다. 없으면 발밑 줄 전부 막힘. */
  readonly passage?: readonly string[];
  /** 크기 결정의 윗면 낱말(참고 그림 지시문 {top}) */
  readonly refTop?: string;
  /** 크기 결정 한 줄(왜 이 칸 수인가) — 카드·그리기 지시문에 보인다 */
  readonly footprintNote?: string;
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
  /** 구워 넣을 칩셋(맵 기물). 없으면 손 도트 실내. */
  readonly tilesetId?: string;
  /** 정의할 때 그 칩셋 그림에서 뽑아 둔 팔레트(#rrggbb). 칩셋이 나중에 바뀌어도 후보를 같은 색으로 그린다. */
  readonly palette?: readonly string[];
  /** 놓을 맵의 배경(문화·시대) 한 줄. 조수 요청이 칩셋에서 정한다. */
  readonly setting?: string;
  /** 3/4 관문 종류(조언 배지용). */
  readonly gateKind?: string;
  /** 크기 결정의 칸 통행(위→아래, X 막힘 · * 위에 그려짐). 조수 요청이 footprint.ts 로 정한다. */
  readonly passage?: readonly string[];
  /** 크기 결정의 윗면 낱말(참고 그림 지시문) */
  readonly refTop?: string;
  /** 크기 결정 한 줄 */
  readonly footprintNote?: string;
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
  /** 검수자가 제목을 잊고 1배 그림만 보고 적은 「무엇으로 보이나」(새 기물 검수) */
  readonly looksLike?: string;
};

/**
 * 3/4 관문(object-gate) 조언 — 다 그린 후보마다 관문 판정 규칙(rules.ts)으로 한 번 잰 결과. 공방 굽기(이 게임에만)를 막지 않는다.
 * 보정된 프로필의 영수증이 아니다(판정자 1표, 사용자 AI 계정) — 번들·공용·스토어 출구에는 효력이 없다.
 */
export type GateAdvice = {
  readonly state: "pass" | "refer" | "fail";
  readonly kind: string;
  readonly reasons: readonly string[];
  /** 판정자가 잰 몸통 윗면 행 수 */
  readonly topRows: number | null;
  readonly readsAs: string;
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
  /** 막혀 끝났으면 그 갈래(계정 한도 quota · 잠깐 몰림 rate · 로그인 auth). 옛 저장본에는 없다. */
  errorKind?: "quota" | "rate" | "auth" | null;
  /** 이 장에 쓴 모델 호출 수 */
  calls: number;
  /** 사용자가 이 장만 다시 그리라며 남긴 말 */
  redrawNote: string;
  startedAt: number | null;
  finishedAt: number | null;
  /** 3/4 관문 조언(실행기가 adviseMessages 를 주면 다 그린 뒤 한 번). 없으면 아직 안 쟀거나 그 하네스는 재지 않는다. */
  gate?: GateAdvice | null;
};
/**
 * 판의 「참고 그림」(object-gen ref 단계, referencePrompt.ts). 판 임시 기록에만 있고 그리는 모델만 본다 — 칩셋·스토어로 가지 않는다.
 * none = 그림 계정이 없거나 이 기물은 참고 단계가 없다(「참고 그림 없이 그림」) · failed = 만들었지만 시점 검사를 못 넘었거나 오류.
 */
export type RoundReference = {
  readonly status: "ok" | "none" | "failed";
  /** 통과한 참고 그림(줄인 PNG data URL). status ok 일 때만. */
  readonly dataUrl?: string;
  readonly prompt?: string;
  /** 시점 검사(마지막 시도) */
  readonly view?: { readonly view: string; readonly topShare: number; readonly why: string; readonly ok: boolean; readonly minTop: number };
  /** 만든 횟수(시점 검사에서 떨어진 것 포함) */
  readonly tries: number;
  /** 시점 검사에서 떨어진 참고 그림(작게, 기록용) */
  readonly rejected?: readonly { readonly dataUrl: string; readonly view: string; readonly topShare: number; readonly why: string }[];
  readonly source?: string;
  readonly note: string;
  /** 시점 검사를 넘은 다음 참고 그림들(object-gen 흐름은 2장을 만든다). dataUrl 이 첫 장. */
  readonly more?: readonly { readonly dataUrl: string; readonly view: { readonly view: string; readonly topShare: number; readonly why: string; readonly ok: boolean; readonly minTop: number } }[];
  /** 붙인 시점·화풍 견본(작게, 기록용). 없으면 견본 없이 만들었다. */
  readonly anchor?: string;
};

export type WorkshopRound = {
  readonly id: string;
  readonly projectKey: string;
  readonly harnessId: string;
  readonly itemKey: string;
  readonly note: string;
  readonly created: number;
  runs: WorkshopRun[];
  /** 참고 그림 단계 결과(실행기가 referenceDescribe 를 주고 env 에 그림 경로가 있을 때). 옛 판에는 없다. */
  reference?: RoundReference;
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
  /** 판의 참고 그림(모양만 — 화소를 옮기지 않는다). 없으면 null. */
  readonly reference?: string | null;
  /** 참고 그림 전부(object-gen 흐름은 2장). 첫 장이 reference 와 같다. */
  readonly references?: readonly string[];
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

/** 맵 기물 실행기가 화풍을 맞출 칩셋 — 편집기가 지금 프로젝트에서 꺼내 준다(하네스는 프로젝트를 모른다). */
export type WorkshopTilesetSource = {
  readonly id: string;
  readonly name: string;
  readonly tileSize: number;
  readonly tilesPerRow: number;
  /** 이식 없는 바탕 시트(투명색 키를 뺀 것) */
  readonly image: RgbaImage;
  /** 칩셋에 학습된 물체(구조 킷): 칸 번호 격자, -1 = 빈 칸. 아래층·위층 순서로 겹친다. */
  readonly objects: readonly { readonly name: string; readonly description: string; readonly layers: readonly (readonly (readonly number[])[])[] }[];
};

export interface WorkshopEnv {
  loadImage(url: string): Promise<RgbaImage>;
  /** 지금 프로젝트의 칩셋 하나. 없거나 그림을 못 읽으면 null. 편집기 밖(시험)에서는 없을 수 있다. */
  tilesetSource?(tilesetId: string): Promise<WorkshopTilesetSource | null>;
  /** data:image/png;base64,… */
  encodePng(image: RgbaImage): string;
  /**
   * 참고 그림 한 장(사용자 자기 그림 계정). null = 그림을 만들 수 있는 계정이 없다(참고 없이 그린다). 오류는 던진다.
   * 돌려받은 그림은 판 임시 기록에만 두고 칩셋·스토어로 보내지 않는다.
   */
  referenceImage?(prompt: string, signal: AbortSignal, options?: { readonly image?: string }): Promise<{ readonly dataUrl: string; readonly source: string } | null>;
  /** 공개 자산 경로(앞 / 없이) → 이 앱에서 쓸 URL */
  assetUrl(path: string): string;
}

export type PerItem<T> = T | ((item: WorkshopItem) => T);
export const perItem = <T>(value: PerItem<T>, item: WorkshopItem): T => (typeof value === "function" ? (value as (item: WorkshopItem) => T)(item) : value);

export type WorkshopSurface = "workshop-draw" | "workshop-review";
/** 모델 한 번 호출 → 답 글. 오류는 그대로 던진다(status 가 있으면 401·429 판정에 쓴다). */
/** meta = 이 호출이 어느 판·장의 것인가(작업 줄이 작업별 호출을 세고, dev 에서 한도 막힘을 흉내 낸다). */
export type ChatCallMeta = { readonly roundId: string; readonly letter: string };
export type ChatFn = (surface: WorkshopSurface, request: ChatRequest, meta?: ChatCallMeta) => Promise<string>;

export interface WorkshopRunner {
  readonly harnessId: string;
  /** 공방 화면 머리에 붙는 이름(없으면 「손 도트 실내 기물」) */
  readonly label?: string;
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
  /** 있으면 그린 뒤 같은 대화에서 한 번 더 보게 한다(호출 1번 추가). 없으면 바로 독립 검수로 간다. */
  selfCheckMessage?(ctx: DrawContext, grid: Grid, env: WorkshopEnv): ChatMessage;
  reviewMessages(ctx: ReviewContext, env: WorkshopEnv): Promise<ChatMessage[]>;
  /** 있으면 판을 시작할 때 참고 그림을 한 번 만든다(object-gen ref 단계). 돌려준 글은 물건 설명(영어 지시문 끝의 Object:). null = 이 기물은 참고 단계 없음. */
  referenceDescribe?(item: WorkshopItem): string | null;
  /**
   * 참고 그림에 붙이는 시점·화풍 견본(object-gen exemplar_sheet, 물체 비율 캔버스) data URL. 그림 경로는 붙인 그림의 비율로 답한다.
   * 없거나 null 이면 견본 없이 만들고, 「붙인 그림」을 말하는 STYLE_NOTE 도 붙이지 않는다.
   */
  referenceAnchor?(item: WorkshopItem, env: WorkshopEnv): Promise<string | null>;
  /** 있으면 다 그린 후보마다 3/4 관문 조언 호출을 한 번 더 한다(굽기를 막지 않는 배지). */
  adviseMessages?(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv): Promise<ChatMessage[]>;
  parseAdvice?(item: WorkshopItem, text: string): GateAdvice;
  /**
   * object-gen 흐름(objectGenFlow.ts)을 쓰는 실행기가 주는 갈래. 있으면 엔진이 그 단계를 이것으로 돈다.
   * - referenceCount: 시점 검사를 넘은 참고 그림을 이만큼 모은다(원본 n_refs 2). referenceStyleNote: 참고 지시문 끝에 붙일 원본 STYLE_NOTE.
   * - maxAttempts: 그리기 시도 수(원본: 그리기 + 불통과 다시 그리기 1번 = 2).
   * - looks/lookMessage: 그린 뒤 미리보기를 보여 주고 고치게 하는 횟수와 메시지(원본 drawer 의 preview 고리). {"keep":true} 면 멈춘다.
   * - review: 독립 검수를 통째로(원본: 블라인드 판정 유효 3판 다수결, 숨긴 반려 표본). ask 는 새 검수 호출 하나.
   */
  /** 기물마다 다를 수 있다(손 도트 실내: 새 기물만 object-gen 흐름). 함수면 기물을 받아 값을 낸다. */
  readonly referenceCount?: PerItem<number>;
  readonly referenceStyleNote?: PerItem<string | undefined>;
  readonly maxAttempts?: PerItem<number>;
  readonly looks?: PerItem<number>;
  lookMessage?(ctx: DrawContext, grid: Grid, env: WorkshopEnv, look: number, max: number): Promise<ChatMessage>;
  /** null = 이 기물은 기본 검수(reviewMessages + parseVerdict)로. */
  review?(ctx: ReviewContext, env: WorkshopEnv, ask: (messages: ChatMessage[]) => Promise<string>): Promise<Verdict | null>;
  hardCheck(item: WorkshopItem, grid: Grid): string[];
  parseVerdict(text: string): Verdict;
  gate(item: WorkshopItem, verdict: Verdict): Verdict;
}
