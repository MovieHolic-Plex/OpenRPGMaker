// 명작 공백 #25(2026-09-27) — 필드 걸음 상태 효과(드퀘 독 늪·LISA 출혈·F&H 상처).
//
// 상태의 hpReleaseStep/mpReleaseStep 은 편집기에 「맵 이동(걸음당)」으로 있었지만 읽는 런타임이 없었다.
// 걸을 때마다 파티 각자가 가진 상태를 보고 HP·MP 를 바꾸고, releaseAfterSteps 를 채우면 상태를 푼다.
import { syncActorVitals } from "@/project/sessionVitals";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import type { Project, StateRecord } from "@/project/types";

export interface FieldStepStateResult {
  /** 이번 걸음에 HP 가 바뀐 배우 수. */
  readonly changed: number;
  /** 걸음 수를 채워 풀린 (배우, 상태) 쌍. */
  readonly released: readonly { readonly actorId: string; readonly stateId: string }[];
  /** 걸음 피해로 파티 전원이 0 이 됐다. */
  readonly defeated: boolean;
}

type StepSession = PlaySessionLike & { stateStepCounts?: Record<string, Record<string, number>> };

function stepEffect(state: StateRecord): boolean {
  return Boolean(state.hpReleaseStep || state.mpReleaseStep || (state.releaseAfterSteps ?? 0) > 0);
}

export function applyFieldStepStates(project: Project, session: StepSession): FieldStepStateResult {
  const states = new Map((project.database.states ?? []).filter(stepEffect).map((state) => [state.id, state]));
  if (states.size === 0) return { changed: 0, released: [], defeated: false };
  const released: { actorId: string; stateId: string }[] = [];
  let changed = 0;
  let anyLethal = false;
  for (const actorId of session.partyActorIds ?? []) {
    const held = session.actorStateIds?.[actorId] ?? [];
    for (const stateId of held) {
      const state = states.get(stateId);
      if (!state) continue;
      session.stateStepCounts ??= {};
      const counts = (session.stateStepCounts[actorId] ??= {});
      const steps = (counts[stateId] ?? 0) + 1;
      counts[stateId] = steps;
      const interval = Math.max(1, Math.trunc(state.fieldStepInterval ?? 1));
      if (steps % interval === 0 && (state.hpReleaseStep || state.mpReleaseStep)) {
        syncActorVitals(project, session.actorVitals, actorId);
        const vitals = session.actorVitals[actorId];
        if (vitals && vitals.hp > 0) {
          const floor = state.fieldStepCanKill ? 0 : 1;
          const beforeHp = vitals.hp;
          if (state.hpReleaseStep) {
            const next = beforeHp + Math.trunc(state.hpReleaseStep);
            vitals.hp = Math.min(vitals.maxHp, Math.max(Math.min(floor, beforeHp), next));
          }
          if (state.mpReleaseStep) vitals.mp = Math.min(vitals.maxMp, Math.max(0, vitals.mp + Math.trunc(state.mpReleaseStep)));
          if (vitals.hp !== beforeHp) changed += 1;
          if (state.fieldStepCanKill) anyLethal = true;
        }
      }
      const limit = Math.trunc(state.releaseAfterSteps ?? 0);
      if (limit > 0 && steps >= limit) released.push({ actorId, stateId });
    }
  }
  for (const { actorId, stateId } of released) {
    session.actorStateIds![actorId] = (session.actorStateIds![actorId] ?? []).filter((id) => id !== stateId);
    delete session.stateStepCounts?.[actorId]?.[stateId];
  }
  // 이벤트로 풀린 상태의 카운터는 치운다 — 다시 걸리면 0 부터 센다.
  for (const [actorId, counts] of Object.entries(session.stateStepCounts ?? {})) {
    const held = new Set(session.actorStateIds?.[actorId] ?? []);
    for (const stateId of Object.keys(counts)) if (!held.has(stateId)) delete counts[stateId];
  }
  const party = session.partyActorIds ?? [];
  const defeated = anyLethal && party.length > 0 && party.every((id) => (session.actorVitals[id]?.hp ?? 0) <= 0);
  return { changed, released, defeated };
}
