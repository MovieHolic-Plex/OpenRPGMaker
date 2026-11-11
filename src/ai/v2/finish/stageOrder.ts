// 단계 목록을 묶음 → order 순으로 세운다. 끝맺음과 마감이 같이 쓴다 — 순서가 import 순서에 기대지 않게 겹침은 모듈을 읽을 때 던진다.
import type { FinishPhase, FinishStage } from "./types";

/** phases = 이 목록이 도는 묶음(이 순서대로). 같은 묶음 안 order 가 겹치거나, id 가 겹치거나, 목록에 다른 묶음의 단계가 섞였으면 던진다. */
export function orderedStages(stages: readonly FinishStage[], phases: readonly FinishPhase[]): FinishStage[] {
  const out: FinishStage[] = [];
  for (const phase of phases) {
    const list = stages.filter((s) => s.phase === phase).sort((a, b) => a.order - b.order);
    for (let i = 1; i < list.length; i++) if (list[i]!.order === list[i - 1]!.order) throw new Error(`끝맺음 단계 order 겹침: ${phase} ${list[i - 1]!.id}·${list[i]!.id} = ${list[i]!.order}`);
    out.push(...list);
  }
  const ids = new Set<string>();
  for (const s of out) { if (ids.has(s.id)) throw new Error(`끝맺음 단계 id 겹침: ${s.id}`); ids.add(s.id); }
  if (out.length !== stages.length) throw new Error(`끝맺음 단계 phase 가 이 목록의 묶음(${phases.join("·")})이 아니다`);
  return out;
}
