// 조수가 큰 시공(새 마을 맵 등)을 적용한 직후, 그 도구가 **실제로 밟은 단계**를 맵 위에서 다시 트는 계획.
//
// 왜(2026-10-03 사용자): 마을 하나는 도구 한 번(author_beodeul_town)이 0.3~3초 안에 다 짓고 체크포인트 하나로 적용된다.
// 처음엔 완성본에서 순서를 지어내 종이·연필로 걷어 보였는데, 사용자가 「실제 다 깔아 놓고 보여 주기식」이라고 짚었다.
// 이제 시공기가 남긴 기록(editor/tools/constructionLog.ts — 계획 격자 구역 → 바닥 칠하기 → 키트 한 개씩 → 다듬기)을
// 체크포인트로 받아, 그 순서와 그 시점의 칸 값 그대로 사람 눈 속도로 늦춰 튼다. 기록이 없으면 연출하지 않는다
// (지어낸 순서는 보이지 않는다 — 기존 「✓ 반영됨」 강조로 간다).
//
// 적용은 늦추지 않는다(다음 도구·체크포인트 ACK 를 잡지 않는다). 그리기는 `agentConstructionRevealRenderer.ts`.

import type { ConstructionLog, ConstructionStep } from "@/editor/tools/constructionLog";
import type { GameMap, MapId, TilesetDef } from "@/project/types";

export interface ConstructionRevealFrame {
  readonly step: ConstructionStep;
  /** 재생 시작부터 이 단계가 시작하는 시각(ms). */
  readonly at: number;
  /** 이 단계의 칸이 다 그려지기까지(ms). */
  readonly duration: number;
}

export interface ConstructionRevealPlan {
  readonly mapId: MapId;
  readonly width: number;
  readonly height: number;
  readonly tilesetId: string;
  readonly log: ConstructionLog;
  readonly frames: readonly ConstructionRevealFrame[];
  /** 마지막 단계가 끝나고 잠깐 머문 뒤 덮개가 걷히기 시작하는 시각. */
  readonly holdUntilMs: number;
  readonly durationMs: number;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** 계획 구역 하나가 그려지는 시간. */
const PLAN_STEP_MS = 380;
/** 바닥 칠하기 한 단계(바탕·길·광장·물). */
const PAINT_STEP_MS = 520;
/** 집·큰 건물·다리 한 채. */
const MAJOR_STAMP_MS = 210;
/** 나무·소품·풀꽃 하나. */
const MINOR_STAMP_MS = 28;
/** 찍기 단계 전체 상한 — 넘으면 같은 비율로 당긴다(순서는 그대로). */
const STAMP_SPAN_MAX_MS = 5200;
const TIDY_MS = 320;
/** 계획 → 칠하기 → 찍기로 넘어갈 때 잠깐 쉰다. */
const PHASE_GAP_MS = 200;
const FINISH_HOLD_MS = 500;
export const CONSTRUCTION_FADE_OUT_MS = 320;
/** 체크포인트에서 받은 기록이 이보다 오래 적용을 못 만나면 버린다. */
const PENDING_TTL_MS = 120_000;

const pending = new Map<string, { readonly log: ConstructionLog; readonly at: number }>();

/** Background work must not leave replay material for a later foreground checkpoint. */
export function discardConstructionLogs(mapId?: MapId): void {
  if (mapId) pending.delete(mapId);
  else pending.clear();
}

/** 체크포인트에 실려 온 시공 기록을 맡긴다 — 곧 이어지는 적용(focusAcceptedAgentChanges)이 꺼내 쓴다. */
export function offerConstructionLogs(logs: readonly ConstructionLog[] | undefined): void {
  const now = Date.now();
  for (const [id, entry] of pending) if (now - entry.at > PENDING_TTL_MS) pending.delete(id);
  for (const log of logs ?? []) if (!log.truncated && log.steps.length) pending.set(log.mapId, { log, at: now });
}

function stepDuration(step: ConstructionStep): number {
  if (step.kind === "plan") return PLAN_STEP_MS;
  if (step.kind === "paint") return PAINT_STEP_MS;
  if (step.kind === "tidy") return TIDY_MS;
  return step.major ? MAJOR_STAMP_MS : MINOR_STAMP_MS;
}

/**
 * 적용된 맵 → 재생 계획. 이 맵을 지은 시공 기록이 체크포인트로 와 있을 때만 만든다(한 번 쓰면 버린다).
 * 기록이 없거나 크기가 다르면 null — 지어낸 연출은 하지 않는다.
 */
export function planConstructionReveal(
  _before: GameMap | undefined,
  after: GameMap,
  _tileset: TilesetDef | undefined,
): ConstructionRevealPlan | null {
  const entry = pending.get(after.id);
  if (!entry) return null;
  pending.delete(after.id);
  const log = entry.log;
  if (Date.now() - entry.at > PENDING_TTL_MS || log.width !== after.width || log.height !== after.height) return null;

  // 도구 하나의 실제 변경(synthetic)은 칸 수에 맞춘 속도로 — 한 칸 고치기에 0.5초를 쓰지 않고, 큰 칠하기도 1.4초 안에.
  if (log.synthetic) return synthesizedPlan(after, log);
  const stampTotal = log.steps.reduce((sum, step) => sum + (step.kind === "stamp" ? stepDuration(step) : 0), 0);
  const stampScale = stampTotal > STAMP_SPAN_MAX_MS ? STAMP_SPAN_MAX_MS / stampTotal : 1;
  const frames: ConstructionRevealFrame[] = [];
  let t = 0;
  let previousKind: ConstructionStep["kind"] | null = null;
  let minX = after.width, minY = after.height, maxX = -1, maxY = -1;
  for (const step of log.steps) {
    if (previousKind && previousKind !== step.kind && (step.kind === "paint" || step.kind === "stamp")) t += PHASE_GAP_MS;
    previousKind = step.kind;
    const duration = Math.max(1, Math.round(stepDuration(step) * (step.kind === "stamp" ? stampScale : 1)));
    frames.push({ step, at: Math.round(t), duration });
    t += duration;
    for (const c of step.cells) {
      const x = c % log.width, y = (c - x) / log.width;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!frames.length || maxX < 0) return null;
  const holdUntilMs = Math.round(t + FINISH_HOLD_MS);
  return {
    mapId: after.id,
    width: log.width,
    height: log.height,
    tilesetId: after.tilesetId,
    log,
    frames,
    holdUntilMs,
    durationMs: holdUntilMs + CONSTRUCTION_FADE_OUT_MS,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

function synthesizedPlan(after: GameMap, log: ConstructionLog): ConstructionRevealPlan | null {
  const frames: ConstructionRevealFrame[] = [];
  let t = 0;
  let minX = after.width, minY = after.height, maxX = -1, maxY = -1;
  for (const step of log.steps) {
    const duration = Math.round(Math.min(1400, Math.max(step.kind === "stamp" ? 220 : 260, 140 + step.cells.length * 6)));
    frames.push({ step, at: t, duration });
    t += duration + 80;
    for (const c of step.cells) {
      const x = c % log.width, y = (c - x) / log.width;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!frames.length || maxX < 0) return null;
  const holdUntilMs = t + 120;
  return {
    mapId: after.id, width: log.width, height: log.height, tilesetId: after.tilesetId, log, frames, holdUntilMs,
    durationMs: holdUntilMs + CONSTRUCTION_FADE_OUT_MS,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

// ── 요청 버스 ── 씬(EditScene)이 구독한다. agentFocus 와 같은 모양이다.

/** 재생을 맡았으면 true(맵이 다르거나 그림이 너무 크면 false). */
type Listener = (plan: ConstructionRevealPlan) => boolean;
const listeners = new Set<Listener>();

export function subscribeAgentConstructionReveal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 누군가 재생을 맡았으면 true — 아니면(헤드리스·테스트·재생 불가) 호출부가 기존 강조로 돌아간다. */
export function requestAgentConstructionReveal(plan: ConstructionRevealPlan): boolean {
  let played = false;
  for (const listener of listeners) played = listener(plan) || played;
  return played;
}
