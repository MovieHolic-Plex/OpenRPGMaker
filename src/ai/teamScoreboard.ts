// 첫 실행 AI 팀 자동 구성의 점수표 — 어떤 모델이 쓸 수 있을 때 어떤 (팀장 + 워커) 조합을 기본으로 고르는가.
//
// 점수 출처: 리드·워커 나누기 점수표 http://mdc-server:18301/lead-worker-split.html (~/claude-viz/lead-worker-split.html, 2026-11-03·04 측정).
// 같은 무대 체크포인트에 요청 하나만 보내고 15분 상한으로 지은 결과를 Opus 5.5 판정·기계 확인으로 매긴 「품질 점수」(0–100)와
// 공개 정가 × 실제 토큰의 「$/요청」이다. 아래 숫자는 그 표의 data-v 값을 소수 첫째 자리로 옮긴 것이다 — 새로 만든 점수는 없다.
// 점수표에 없는 조합(예: Opus 리드 + DeepSeek 워커, Gemini 4 Argon 혼자, Sonnet 5.5, Luna)은 행이 없으므로 고르지 않는다.
// 그 모델은 설정에서 고를 수 있고, 점수표에 행이 생기면 여기에 한 줄만 더하면 기본값 후보가 된다.
//
// 표는 둘이다.
//   full  — 11과제 × 3판(n=33) 종합 표. 조합이 적지만 판 수가 많다.
//   pick3 — 3과제 공통 표(n=3 또는 9). GPT·DeepSeek 워커 조합까지 있지만 판 수가 적다.
// 같은 표 안의 점수만 서로 견준다(같은 조합도 표마다 점수가 다르다 — Opus + Haiku 가 full 62.7, pick3 70.8).
// 고르는 규칙: 쓸 수 있는 모델로 만들 수 있는 조합을 더 많이 채점한 표를 쓰고(같으면 판 수가 큰 full), 그 표에서
// 최고 품질에서 1점 이내인 조합 중 가장 싼 것을 고른다.
//
// 순수 모듈 — 브라우저와 Node 가 같이 읽는다.

export type ModelFamily = "claude" | "openai" | "google" | "deepseek";

export type TeamModelKey = "opus" | "sonnet" | "haiku" | "astra" | "sol" | "terra" | "luna" | "argon" | "flash" | "deepseek";

export interface TeamModel {
  readonly key: TeamModelKey;
  readonly family: ModelFamily;
  /** 그 제공자가 받는 모델 ID(CLI·계정·API 키 모두 같은 ID 를 쓴다. 키 경로는 제공자 목록에서 실제로 확인한 뒤 쓴다). */
  readonly id: string;
  readonly label: string;
}

/** 첫 실행이 쓰는 최신 모델 열 — 오너 지시(2026-11-04): Opus·Sonnet·Haiku 5.5, Astra 6·Sol 6.1·Terra 6.1·Luna 6, Gemini 4 Argon·3.8 Flash, DeepSeek V4.1 Flash. */
export const TEAM_MODELS: Readonly<Record<TeamModelKey, TeamModel>> = {
  opus: { key: "opus", family: "claude", id: "claude-opus-5-5", label: "Opus 5.5" },
  sonnet: { key: "sonnet", family: "claude", id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  haiku: { key: "haiku", family: "claude", id: "claude-haiku-5-5", label: "Haiku 5.5" },
  astra: { key: "astra", family: "openai", id: "gpt-6-astra", label: "GPT-6 Astra" },
  sol: { key: "sol", family: "openai", id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
  terra: { key: "terra", family: "openai", id: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
  luna: { key: "luna", family: "openai", id: "gpt-6-luna", label: "GPT-6 Luna" },
  argon: { key: "argon", family: "google", id: "gemini-4-argon", label: "Gemini 4 Argon" },
  flash: { key: "flash", family: "google", id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  deepseek: { key: "deepseek", family: "deepseek", id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
};

export const FAMILY_MODEL_KEYS: Readonly<Record<ModelFamily, readonly TeamModelKey[]>> = {
  claude: ["opus", "sonnet", "haiku"],
  openai: ["astra", "sol", "terra", "luna"],
  google: ["argon", "flash"],
  deepseek: ["deepseek"],
};

export type ScoreTable = "full" | "pick3";

export interface ScoreRow {
  readonly table: ScoreTable;
  /** 팀장. 없으면 워커 혼자. */
  readonly lead?: TeamModelKey;
  readonly worker: TeamModelKey;
  /** 점수표의 「품질 점수」(0–100). */
  readonly quality: number;
  /** 점수표의 「$/요청」. */
  readonly costUsd: number;
  /** 판 수. */
  readonly n: number;
  /** 비용이 글자 수 ÷ 3.04 로 «추정»한 값인가(점수표 표기). */
  readonly costEstimated?: boolean;
}

export const SCORE_ROWS: readonly ScoreRow[] = [
  // full — 11과제 × 3판
  { table: "full", worker: "opus", quality: 63.5, costUsd: 1.832, n: 33 },
  { table: "full", lead: "opus", worker: "haiku", quality: 62.7, costUsd: 0.303, n: 33 },
  { table: "full", worker: "deepseek", quality: 59.7, costUsd: 0.148, n: 33 },
  { table: "full", worker: "haiku", quality: 58.6, costUsd: 0.093, n: 33 },
  { table: "full", lead: "argon", worker: "haiku", quality: 57.6, costUsd: 0.106, n: 33, costEstimated: true },
  // pick3 — 3과제 공통
  { table: "pick3", lead: "opus", worker: "terra", quality: 74.9, costUsd: 1.125, n: 3 },
  { table: "pick3", worker: "opus", quality: 72.9, costUsd: 1.244, n: 9 },
  { table: "pick3", lead: "opus", worker: "haiku", quality: 70.8, costUsd: 0.206, n: 9 },
  { table: "pick3", worker: "terra", quality: 70.3, costUsd: 0.738, n: 3 },
  { table: "pick3", lead: "sol", worker: "terra", quality: 69.2, costUsd: 0.879, n: 3, costEstimated: true },
  { table: "pick3", worker: "haiku", quality: 69.0, costUsd: 0.087, n: 9 },
  { table: "pick3", lead: "astra", worker: "terra", quality: 67.4, costUsd: 0.964, n: 3, costEstimated: true },
  { table: "pick3", lead: "astra", worker: "deepseek", quality: 67.3, costUsd: 0.225, n: 3, costEstimated: true },
  { table: "pick3", worker: "astra", quality: 67.2, costUsd: 12.749, n: 3 },
  { table: "pick3", lead: "argon", worker: "haiku", quality: 64.8, costUsd: 0.071, n: 9, costEstimated: true },
  { table: "pick3", lead: "astra", worker: "haiku", quality: 64.3, costUsd: 0.24, n: 3, costEstimated: true },
  { table: "pick3", worker: "deepseek", quality: 63.5, costUsd: 0.101, n: 9 },
];

/** 최고 품질에서 이 점수 이내인 조합이면 «거의 같다» 로 보고 더 싼 쪽을 고른다. */
export const NEAR_BEST_POINTS = 1;

export interface TeamChoice {
  readonly lead?: TeamModelKey;
  readonly worker: TeamModelKey;
  readonly table: ScoreTable;
  readonly quality: number;
  readonly costUsd: number;
  readonly n: number;
  readonly costEstimated: boolean;
  /** 그 표에서 쓸 수 있는 모델로 만들 수 있었던 가장 높은 품질(고른 것과 1점 이내면 같은 값일 수 있다). */
  readonly bestQuality: number;
}

const usable = (row: ScoreRow, available: ReadonlySet<TeamModelKey>): boolean =>
  available.has(row.worker) && (row.lead === undefined || available.has(row.lead));

/** 쓸 수 있는 모델 집합 → 기본 팀. 점수표가 채점한 조합이 하나도 없으면 undefined(호출부가 그 제공자의 기본값을 쓴다). */
export function chooseTeam(available: ReadonlySet<TeamModelKey>): TeamChoice | undefined {
  const byTable: Record<ScoreTable, ScoreRow[]> = {
    full: SCORE_ROWS.filter((row) => row.table === "full" && usable(row, available)),
    pick3: SCORE_ROWS.filter((row) => row.table === "pick3" && usable(row, available)),
  };
  const table: ScoreTable = byTable.pick3.length > byTable.full.length ? "pick3" : "full";
  const rows = byTable[table];
  if (!rows.length) return undefined;
  const bestQuality = Math.max(...rows.map((row) => row.quality));
  const near = rows.filter((row) => bestQuality - row.quality <= NEAR_BEST_POINTS + 1e-9);
  const pick = [...near].sort((a, b) => a.costUsd - b.costUsd || b.quality - a.quality)[0]!;
  return {
    ...(pick.lead ? { lead: pick.lead } : {}),
    worker: pick.worker,
    table,
    quality: pick.quality,
    costUsd: pick.costUsd,
    n: pick.n,
    costEstimated: pick.costEstimated === true,
    bestQuality,
  };
}

/** 점수표가 채점한 조합이 없는 제공자만 쓸 수 있을 때의 혼자 쓰는 기본 모델(점수 없음 — 제품 기본값). */
export const UNRATED_DEFAULT_WORKER: Readonly<Partial<Record<ModelFamily, TeamModelKey>>> = {
  // 사용자 결정(2026-10-14): 조수 기본은 Gemini 4 Argon medium. 점수표에 Argon 혼자 행은 없다.
  google: "argon",
};
