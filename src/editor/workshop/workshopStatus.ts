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
