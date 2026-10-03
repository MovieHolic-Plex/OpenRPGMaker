// 시공 기록 — 큰 시공 도구(author_beodeul_town 등)가 실제로 밟은 단계를 그 순서대로 남긴다(2026-10-03).
//
// 왜: 마을 하나는 도구 한 번이 0.3~3초 안에 다 짓고 체크포인트 하나로 적용된다. 편집기가 그 뒤에 지어지는 모습을
// 보여 주려면 순서를 지어내야 했다(종이·연필 연출) — 사용자: 「실제 다 깔아 놓고 보여 주기식」. 이 기록은 시공기가
// 실제로 한 일(계획 격자의 구역 → 바탕·길·광장·물 칠하기 → 키트를 한 개씩 찍기 → 막다른 길 정리)을 단계마다 바뀐 칸과
// 그 시점의 값으로 담는다. 편집기는 이것을 사람 눈 속도로 늦춰 그대로 다시 튼다(agentConstructionReveal).
//
// 기록기는 실행 하나를 감싸는 동안에만 켜진다(withConstructionLog). 꺼져 있으면 시공기의 기록 호출은 아무것도 안 한다.
// 도구는 동기 실행이라 전역 기록기 하나로 충분하다. 기록은 저장되지 않는다 — 체크포인트에 실려 편집기로만 간다.

import type { GameMap } from "@/project/types";

/** plan = 계획 격자(아직 타일 없음), paint = 바닥 칠하기, stamp = 키트 하나 찍기, tidy = 다듬기. */
export type ConstructionStepKind = "plan" | "paint" | "stamp" | "tidy";

export interface ConstructionStep {
  readonly kind: ConstructionStepKind;
  /** 사람이 읽는 단계 이름(「큰길」「집 3/14」…). */
  readonly label: string;
  /** 이 단계에서 바뀐 칸(y*width+x). */
  readonly cells: readonly number[];
  /** plan: 칸마다 계획 분류(ConstructionLog.planClasses 의 키). */
  readonly plan?: readonly number[];
  /** paint·stamp·tidy: 칸마다 그 시점의 층 값(-1 = 빈칸). */
  readonly lower?: readonly number[];
  readonly upper?: readonly number[];
  readonly lowerOverlay?: readonly number[];
  readonly upperOverlay?: readonly number[];
  /** paint: 이 칠하기가 마무리하는 계획 분류 — 그 분류의 밑그림만 걷힌다. */
  readonly realizes?: readonly number[];
  /** stamp: 집·큰 건물·다리처럼 한 채씩 눈에 띄게 놓을 것(나무·소품·풀꽃은 빠르게). */
  readonly major?: boolean;
  /** stamp: 찍은 키트 자리. */
  readonly rect?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface ConstructionLog {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly toolName: string;
  /** 도구가 실제로 이 시공에 쓴 시간(ms) — 재생이 이것보다 길다는 걸 화면에 밝힌다. */
  readonly elapsedMs: number;
  /** 계획 분류 번호 → 이름(road·water·plaza·building·prop·field·keep·ring). */
  readonly planClasses: Readonly<Record<number, string>>;
  readonly steps: readonly ConstructionStep[];
  /** 단계가 건드린 칸의 시공 직전 값(새 맵이면 create_map 이 만든 빈 바탕). 재생은 여기서 시작한다. */
  readonly initial?: Omit<ConstructionStep, "kind" | "label">;
  /** 기록 상한을 넘어 뒤를 버렸다. */
  readonly truncated?: boolean;
  /** 도구가 스스로 남긴 기록이 아니라 그 도구의 실제 변경(적용 전 → 후)을 층 순서로 나눈 것. 재생 속도를 칸 수에 맞춘다. */
  readonly synthetic?: boolean;
}

/** 칸 값 총량 상한 — 넘으면 기록을 멈춘다(체크포인트 한 줄이 무거워지지 않게). 56×44 마을 실측 ≈ 1~2만. */
const MAX_CELL_ENTRIES = 250_000;

interface MapRecorder {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  planClasses: Record<number, string>;
  plan: Uint8Array | null;
  lower: Int32Array | null;
  upper: Int32Array | null;
  lowerOverlay: Int32Array | null;
  upperOverlay: Int32Array | null;
  baseline: { lower: Int32Array; upper: Int32Array; lowerOverlay: Int32Array; upperOverlay: Int32Array } | null;
  steps: ConstructionStep[];
  entries: number;
  truncated: boolean;
}

interface Recorder {
  readonly toolName: string;
  readonly maps: Map<string, MapRecorder>;
}

let active: Recorder | null = null;

/** run 하나를 기록하며 실행한다. 중첩되면 바깥 기록기를 그대로 쓴다. */
export function withConstructionLog<T>(toolName: string, run: () => T): { readonly value: T; readonly logs: readonly ConstructionLog[] } {
  if (active) return { value: run(), logs: [] };
  const recorder: Recorder = { toolName, maps: new Map() };
  active = recorder;
  const started = Date.now();
  try {
    const value = run();
    const elapsedMs = Date.now() - started;
    return { value, logs: [...recorder.maps.values()].filter((m) => m.steps.length > 0).map((m) => ({
      mapId: m.mapId, width: m.width, height: m.height, toolName, elapsedMs,
      planClasses: m.planClasses, steps: m.steps, ...initialOf(m), ...(m.truncated ? { truncated: true } : {}),
    })) };
  } finally {
    active = null;
  }
}

function initialOf(rec: MapRecorder): { initial?: ConstructionLog["initial"] } {
  const base = rec.baseline;
  if (!base) return {};
  const touched = new Set<number>();
  for (const step of rec.steps) if (step.kind !== "plan") for (const c of step.cells) touched.add(c);
  const cells = [...touched].sort((a, b) => a - b);
  if (!cells.length) return {};
  const pick = (values: Int32Array) => cells.map((c) => values[c]!);
  const overlays = cells.some((c) => base.lowerOverlay[c] !== -1 || base.upperOverlay[c] !== -1);
  return { initial: { cells, lower: pick(base.lower), upper: pick(base.upper),
    ...(overlays ? { lowerOverlay: pick(base.lowerOverlay), upperOverlay: pick(base.upperOverlay) } : {}) } };
}

export function constructionLogActive(): boolean {
  return active !== null;
}

function recorderFor(mapId: string, width: number, height: number): MapRecorder | null {
  if (!active) return null;
  let rec = active.maps.get(mapId);
  if (rec && (rec.width !== width || rec.height !== height)) { active.maps.delete(mapId); rec = undefined; }
  if (!rec) {
    rec = { mapId, width, height, planClasses: {}, plan: null, lower: null, upper: null, lowerOverlay: null, upperOverlay: null, baseline: null, steps: [], entries: 0, truncated: false };
    active.maps.set(mapId, rec);
  }
  return rec.truncated ? null : rec;
}

function push(rec: MapRecorder, step: ConstructionStep, size: number): void {
  if (rec.entries + size > MAX_CELL_ENTRIES) { rec.truncated = true; return; }
  rec.entries += size;
  rec.steps.push(step);
}

/** 계획 격자를 지금 상태로 한 단계 남긴다(직전 기록과 달라진 칸만). */
export function logConstructionPlan(mapId: string, width: number, height: number, occ: Uint8Array, label: string, classes: Readonly<Record<number, string>>): void {
  const rec = recorderFor(mapId, width, height);
  if (!rec) return;
  rec.planClasses = { ...rec.planClasses, ...classes };
  const prev = rec.plan ?? new Uint8Array(width * height);
  const cells: number[] = [], plan: number[] = [];
  for (let i = 0; i < occ.length; i++) if (occ[i] !== prev[i]) { cells.push(i); plan.push(occ[i]!); }
  rec.plan = occ.slice();
  if (cells.length) push(rec, { kind: "plan", label, cells, plan }, cells.length * 2);
}

function layer(values: readonly number[] | undefined, size: number): Int32Array {
  const out = new Int32Array(size).fill(-1);
  if (values) for (let i = 0; i < size && i < values.length; i++) out[i] = values[i] ?? -1;
  return out;
}

/** 시공 직전 맵 상태를 기준으로 잡는다 — 이후 단계는 이것과의 차이만 남긴다. */
export function beginConstructionTiles(map: GameMap): void {
  const rec = recorderFor(map.id, map.width, map.height);
  if (!rec) return;
  const size = map.width * map.height;
  rec.lower = layer(map.lowerTiles, size);
  rec.upper = layer(map.upperTiles, size);
  rec.lowerOverlay = layer(map.lowerOverlayTiles, size);
  rec.upperOverlay = layer(map.upperOverlayTiles, size);
  rec.baseline = { lower: rec.lower, upper: rec.upper, lowerOverlay: rec.lowerOverlay, upperOverlay: rec.upperOverlay };
}

/** 맵 타일을 지금 상태로 한 단계 남긴다(직전 기록과 달라진 칸만). */
export function logConstructionTiles(
  map: GameMap,
  kind: Exclude<ConstructionStepKind, "plan">,
  label: string,
  extra: { readonly realizes?: readonly number[]; readonly rect?: ConstructionStep["rect"]; readonly major?: boolean } = {},
): void {
  const rec = recorderFor(map.id, map.width, map.height);
  if (!rec) return;
  if (!rec.lower) beginConstructionTiles(map);
  const size = map.width * map.height;
  const now = {
    lower: layer(map.lowerTiles, size), upper: layer(map.upperTiles, size),
    lowerOverlay: layer(map.lowerOverlayTiles, size), upperOverlay: layer(map.upperOverlayTiles, size),
  };
  const cells: number[] = [], lower: number[] = [], upper: number[] = [], lowerOverlay: number[] = [], upperOverlay: number[] = [];
  let overlays = false;
  for (let i = 0; i < size; i++) {
    if (now.lower[i] === rec.lower![i] && now.upper[i] === rec.upper![i]
      && now.lowerOverlay[i] === rec.lowerOverlay![i] && now.upperOverlay[i] === rec.upperOverlay![i]) continue;
    cells.push(i);
    lower.push(now.lower[i]!); upper.push(now.upper[i]!);
    lowerOverlay.push(now.lowerOverlay[i]!); upperOverlay.push(now.upperOverlay[i]!);
    if (now.lowerOverlay[i] !== -1 || now.upperOverlay[i] !== -1) overlays = true;
  }
  rec.lower = now.lower; rec.upper = now.upper; rec.lowerOverlay = now.lowerOverlay; rec.upperOverlay = now.upperOverlay;
  if (!cells.length) return;
  push(rec, {
    kind, label, cells, lower, upper,
    ...(overlays ? { lowerOverlay, upperOverlay } : {}),
    ...(extra.realizes ? { realizes: extra.realizes } : {}),
    ...(extra.rect ? { rect: extra.rect } : {}),
    ...(extra.major ? { major: true } : {}),
  }, cells.length * (overlays ? 5 : 3));
}

/**
 * 시공 기록을 남기지 않는 쓰기 도구(칠하기·소품·집 하나·이벤트 옆 타일…)의 실제 변경을 기록 한 벌로 만든다(2026-10-04).
 *
 * 왜: 사용자 「마을뿐 아니라 다른 명령도 실시간으로 보여 줘야」. 조수는 보통 작은 쓰기 도구를 여러 번 부르고, 도구마다
 * 체크포인트로 실제 맵에 바로 적용된다 — 예전 밑그림(연필이 아래층 → 위층 순으로 그려 가던 것)이 #1130 뒤로 안 보였다.
 * 지어내는 것은 없다: 칸·값은 이 도구가 실제로 바꾼 것 그대로(적용 전 → 적용 후)이고, 나누는 것은 예전 밑그림과 같은
 * 층 순서(아래층을 먼저, 위층을 나중)뿐이다. 도구가 스스로 기록을 남긴 맵(마을 짓기)은 건드리지 않는다.
 */
export function synthesizeToolConstructionLogs(
  toolName: string,
  before: { readonly maps: Readonly<Record<string, GameMap>> },
  after: { readonly maps: Readonly<Record<string, GameMap>> },
  recorded: readonly ConstructionLog[],
  elapsedMs: number,
): ConstructionLog[] {
  const covered = new Set(recorded.map((log) => log.mapId));
  const out: ConstructionLog[] = [];
  for (const [mapId, map] of Object.entries(after.maps)) {
    const prev = before.maps[mapId];
    if (prev === map || covered.has(mapId)) continue;
    const log = diffLog(toolName, prev && prev.width === map.width && prev.height === map.height ? prev : undefined, map, elapsedMs);
    if (log) out.push(log);
  }
  return out;
}

/** 이보다 많이 바뀐 도구는 기록하지 않는다(재생이 의미 없을 만큼 크거나 체크포인트가 무거워진다). */
const MAX_SYNTH_CELLS = 40_000;

function diffLog(toolName: string, prev: GameMap | undefined, map: GameMap, elapsedMs: number): ConstructionLog | null {
  const size = map.width * map.height;
  if (size <= 0) return null;
  const was = prev
    ? { lower: layer(prev.lowerTiles, size), upper: layer(prev.upperTiles, size), lowerOverlay: layer(prev.lowerOverlayTiles, size), upperOverlay: layer(prev.upperOverlayTiles, size) }
    : null;
  const now = { lower: layer(map.lowerTiles, size), upper: layer(map.upperTiles, size), lowerOverlay: layer(map.lowerOverlayTiles, size), upperOverlay: layer(map.upperOverlayTiles, size) };
  const cells: number[] = [];
  const upperCells: number[] = [];
  for (let i = 0; i < size; i++) {
    const lowerChanged = !was || was.lower[i] !== now.lower[i] || was.lowerOverlay[i] !== now.lowerOverlay[i];
    const upperChanged = !was || was.upper[i] !== now.upper[i] || was.upperOverlay[i] !== now.upperOverlay[i];
    if (!lowerChanged && !upperChanged) continue;
    // 새 맵의 빈 칸(-1/0 만 있는 칸)은 그릴 것이 없다.
    if (!was && now.lower[i]! < 0 && now.upper[i]! < 0 && now.lowerOverlay[i]! < 0 && now.upperOverlay[i]! < 0) continue;
    cells.push(i);
    if (upperChanged && (now.upper[i]! >= 0 || now.upperOverlay[i]! >= 0 || (was && (was.upper[i]! >= 0 || was.upperOverlay[i]! >= 0)))) upperCells.push(i);
  }
  if (!cells.length || cells.length > MAX_SYNTH_CELLS) return null;
  // 예전 밑그림처럼 왼쪽 열부터 오른쪽으로(열 우선) 그린다.
  const byColumn = (a: number, b: number) => (a % map.width) - (b % map.width) || a - b;
  cells.sort(byColumn);
  upperCells.sort(byColumn);
  const pick = (values: Int32Array, list: readonly number[]) => list.map((c) => values[c]!);
  const overlays = cells.some((c) => now.lowerOverlay[c] !== -1 || now.upperOverlay[c] !== -1 || (was && (was.lowerOverlay[c] !== -1 || was.upperOverlay[c] !== -1)));
  const coverOf = (list: readonly number[]) => ({
    cells: list,
    lower: was ? pick(was.lower, list) : list.map(() => -1),
    upper: was ? pick(was.upper, list) : list.map(() => -1),
    ...(overlays ? { lowerOverlay: was ? pick(was.lowerOverlay, list) : list.map(() => -1), upperOverlay: was ? pick(was.upperOverlay, list) : list.map(() => -1) } : {}),
  });
  const steps: ConstructionStep[] = [];
  const upperSet = new Set(upperCells);
  // ① 아래층: 바뀐 칸 전부를 아래층만 새 값으로(위층은 아직 이전 값).
  const lowerStep = cells.filter((c) => !was || was.lower[c] !== now.lower[c] || was.lowerOverlay[c] !== now.lowerOverlay[c] || !upperSet.has(c));
  if (lowerStep.length) {
    steps.push({
      kind: "paint", label: `${toolName} · 바닥`, cells: lowerStep,
      lower: pick(now.lower, lowerStep),
      upper: lowerStep.map((c) => (upperSet.has(c) ? (was ? was.upper[c]! : -1) : now.upper[c]!)),
      ...(overlays ? {
        lowerOverlay: pick(now.lowerOverlay, lowerStep),
        upperOverlay: lowerStep.map((c) => (upperSet.has(c) ? (was ? was.upperOverlay[c]! : -1) : now.upperOverlay[c]!)),
      } : {}),
    });
  }
  // ② 위층: 물체·나무·지붕이 바뀐 칸을 최종 값으로.
  if (upperCells.length) {
    let minX = map.width, minY = map.height, maxX = -1, maxY = -1;
    for (const c of upperCells) {
      const x = c % map.width, y = (c - x) / map.width;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    const compact = upperCells.length <= 96 && rect.w * rect.h <= 160;
    steps.push({
      kind: compact ? "stamp" : "paint", label: `${toolName} · 물체`, cells: upperCells,
      lower: pick(now.lower, upperCells), upper: pick(now.upper, upperCells),
      ...(overlays ? { lowerOverlay: pick(now.lowerOverlay, upperCells), upperOverlay: pick(now.upperOverlay, upperCells) } : {}),
      ...(compact ? { rect, major: true } : {}),
    });
  }
  if (!steps.length) return null;
  return { mapId: map.id, width: map.width, height: map.height, toolName, elapsedMs, planClasses: {}, steps, initial: coverOf(cells), synthetic: true };
}

/**
 * 체크포인트 하나 사이에 쓰기 도구가 여러 번 돈 경우(단계 적용·비배타 도구) 같은 맵의 기록을 순서대로 잇는다.
 * 시작 덮개(initial)는 먼저 바뀐 칸의 값이 이긴다 — 뒤 기록에만 있는 칸은 그 앞 도구들이 안 건드렸으니 그 값이 곧 원래 값이다.
 */
export function mergeConstructionLogs(logs: readonly ConstructionLog[]): ConstructionLog[] {
  const byMap = new Map<string, ConstructionLog>();
  for (const log of logs) {
    const prev = byMap.get(log.mapId);
    if (!prev || prev.width !== log.width || prev.height !== log.height || !prev.initial || !log.initial) { byMap.set(log.mapId, log); continue; }
    const seen = new Set(prev.initial.cells);
    const add = log.initial.cells.map((c, k) => [c, k] as const).filter(([c]) => !seen.has(c));
    const join = (a: readonly number[] | undefined, b: readonly number[] | undefined, n: number) =>
      a || b ? [...(a ?? Array<number>(n).fill(-1)), ...add.map(([, k]) => (b ? b[k]! : -1))] : undefined;
    const n = prev.initial.cells.length;
    const lowerOverlay = join(prev.initial.lowerOverlay, log.initial.lowerOverlay, n);
    const upperOverlay = join(prev.initial.upperOverlay, log.initial.upperOverlay, n);
    const lower = join(prev.initial.lower, log.initial.lower, n);
    const upper = join(prev.initial.upper, log.initial.upper, n);
    const { synthetic: _synthetic, truncated: _truncated, ...base } = prev;
    byMap.set(log.mapId, {
      ...base,
      toolName: prev.toolName === log.toolName ? prev.toolName : `${prev.toolName} 외`,
      elapsedMs: prev.elapsedMs + log.elapsedMs,
      planClasses: { ...prev.planClasses, ...log.planClasses },
      steps: [...prev.steps, ...log.steps],
      initial: {
        cells: [...prev.initial.cells, ...add.map(([c]) => c)],
        ...(lower ? { lower } : {}),
        ...(upper ? { upper } : {}),
        ...(lowerOverlay ? { lowerOverlay } : {}),
        ...(upperOverlay ? { upperOverlay } : {}),
      },
      ...(prev.synthetic && log.synthetic ? { synthetic: true } : {}),
      ...(prev.truncated || log.truncated ? { truncated: true } : {}),
    });
  }
  return [...byMap.values()];
}
