// 에이전트 레인 매니저 — 레인마다 독립 실행·중단·검토·적용을 소유한다. 스토어와 네트워크를 만지는
// 유일한 레이어이고, 상태 전이·묶음 충돌 판정은 순수 모듈(`@/ai/piAgent/lane`)이 갖는다.
//
// 지키는 계약: 적용 판정은 **그 레인의 묶음 키만** 본다. 기존 게이트처럼 프로젝트 전체 내용 등가를
// 요구하면 레인 A 적용이 레인 B 를 stale-base 로 죽인다(`applyChangesetToStore.ts` isProposalBaseCurrent).
// 묶음 밖 변경은 사람이나 다른 레인의 것이므로 건드리지 않고, 같은 묶음이 움직였으면 덮지 않고 거절한다.

import { loadAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import {
  countToolError,
  createLane,
  laneBundleChangedKeys,
  lanesOverlap,
  reduceLane,
  type LaneResult,
  type LaneSpec,
  type LaneState,
} from "@/ai/piAgent/lane";
import { mapBundleSpill, mergeMapBundles } from "@/ai/piAgent/mapBundle";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";

export interface LaneApplySuccess {
  readonly ok: true;
  readonly changedKeys: readonly string[];
  readonly spills: readonly string[];
}

export interface LaneApplyFailure {
  readonly ok: false;
  readonly reason: "no-result" | "bundle-changed" | "commit-rejected" | "stale-base" | "retired-run";
  readonly issue: string;
  /** bundle-changed 일 때 달라진 키. */
  readonly keys?: readonly string[];
}

export type LaneApplyOutcome = LaneApplySuccess | LaneApplyFailure;

export interface LaneStartOutcome {
  readonly ok: boolean;
  readonly issue?: string;
}

type LaneAgentRunner = (
  request: PiAgentRequest,
  options: { readonly signal?: AbortSignal; readonly onEvent?: (event: PiAgentEvent) => void },
) => Promise<PiAgentDoneEvent>;

export interface LaneManagerOptions {
  readonly clock?: () => number;
  readonly runAgent?: LaneAgentRunner;
  readonly onChange?: (lanes: readonly LaneState[]) => void;
}

export interface LaneStartOptions {
  /** 후속 지시 — 이 지시문으로 갈아 끼우고 같은 묶음 위에서 다시 돈다. */
  readonly instruction?: string;
}

export interface LaneManager {
  lanes(): readonly LaneState[];
  get(id: string): LaneState | null;
  add(spec: LaneSpec): LaneState;
  remove(id: string): void;
  start(id: string, options?: LaneStartOptions): Promise<LaneStartOutcome>;
  stop(id: string): void;
  discard(id: string): void;
  apply(id: string): Promise<LaneApplyOutcome>;
  defaults(): { readonly provider: string; readonly model: string };
  subscribe(listener: (lanes: readonly LaneState[]) => void): () => void;
  dispose(): void;
}

const ARGS_LIMIT = 120;

function describeToolArgs(args: unknown): string {
  if (args === undefined || args === null) return "";
  let text: string;
  try {
    text = JSON.stringify(args) ?? "";
  } catch {
    return "";
  }
  return text.length > ARGS_LIMIT ? `${text.slice(0, ARGS_LIMIT)}…` : text;
}

export function createLaneManager(options: LaneManagerOptions = {}): LaneManager {
  const clock = options.clock ?? (() => Date.now());
  const runAgent: LaneAgentRunner = options.runAgent ?? ((request, runOptions) => runPiAgentViaCompanion(request, runOptions));
  const order: string[] = [];
  const states = new Map<string, LaneState>();
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<(lanes: readonly LaneState[]) => void>();

  const list = (): readonly LaneState[] => order.map((id) => states.get(id)).filter((state): state is LaneState => state !== undefined);

  const emit = (): void => {
    const snapshot = list();
    options.onChange?.(snapshot);
    for (const listener of listeners) listener(snapshot);
  };

  const update = (id: string, event: Parameters<typeof reduceLane>[1]): LaneState => {
    const current = states.get(id);
    if (!current) throw new Error(`lane ${id} 가 없습니다`);
    const next = reduceLane(current, event);
    states.set(id, next);
    emit();
    return next;
  };

  /** 같은 묶음을 이미 돌리는 레인. 둘 다 병합 전 사본에서 출발하는 사고를 계약으로 막는다. */
  const busyOverlap = (lane: LaneState): readonly LaneState[] =>
    list().filter((other) => other.spec.id !== lane.spec.id && other.status === "running" && lanesOverlap(other, lane) .length > 0);

  const startLane = async (id: string, options: LaneStartOptions = {}): Promise<LaneStartOutcome> => {
    const lane = states.get(id);
    if (!lane) return { ok: false, issue: `레인 ${id} 를 찾을 수 없습니다` };
    if (lane.status === "running") return { ok: false, issue: "이미 실행 중입니다" };
    if (lane.spec.mapIds.length === 0) return { ok: false, issue: "묶음이 비어 있습니다 — 맵을 하나 이상 고르세요" };
    const instruction = options.instruction ?? lane.spec.instruction;
    if (instruction.trim().length === 0) return { ok: false, issue: "지시가 비어 있습니다" };
    const busy = busyOverlap(lane);
    if (busy.length > 0) {
      const names = busy.map((other) => other.spec.label).join(", ");
      return { ok: false, issue: `같은 묶음을 이미 돌리는 레인이 있습니다: ${names}` };
    }
    // 출발 사본은 지금 프로젝트를 얼려 잡는다. 레인이 도는 동안 사람이 다른 맵을 고쳐도
    // 이 레인의 음이 그대로면 적용된다 — 그게 레인별 적용의 계약이다.
    const base = structuredClone(store.getCurrent()) as Project;
    const controller = new AbortController();
    controllers.set(id, controller);
    update(id, { type: "start", base, at: clock(), ...(options.instruction === undefined ? {} : { instruction: options.instruction }) });
    update(id, { type: "step", step: { kind: "system", text: `출발 · ${lane.spec.agentLabel} · ${lane.spec.provider}/${lane.spec.model} · 음 ${lane.spec.mapIds.join(", ")}` } });

    const request: PiAgentRequest = {
      mode: "single",
      provider: lane.spec.provider,
      model: lane.spec.model,
      task: instruction,
      mapIds: lane.spec.mapIds,
      project: base,
      ...(lane.spec.maxTurns === undefined ? {} : { maxTurns: lane.spec.maxTurns }),
      ...(lane.spec.thinkingLevel === undefined ? {} : { thinkingLevel: lane.spec.thinkingLevel }),
    };
    const onEvent = (event: PiAgentEvent): void => {
      switch (event.type) {
        case "heartbeat":
          return;
        case "turn":
          update(id, { type: "turn", line: "" });
          return;
        case "delta":
          update(id, { type: "line", line: event.text.trim().slice(0, 200) });
          return;
        case "assistant":
          update(id, { type: "step", step: { kind: "assistant", text: event.text.slice(0, 400) } });
          return;
        case "tool_start":
          update(id, { type: "step", step: { kind: "tool", text: `${event.name} ${describeToolArgs(event.args)}`.trim() } });
          return;
        case "tool_end":
          if (event.ok) update(id, { type: "step", step: { kind: "tool", text: `✓ ${event.name} — ${event.summary.slice(0, 160)}` } });
          else { update(id, { type: "step", step: { kind: "system", text: `✗ ${event.name} — ${event.summary.slice(0, 160)}` } }); states.set(id, countToolError(states.get(id)!)); }
          return;
        case "error":
          update(id, { type: "step", step: { kind: "system", text: `오류: ${event.message.slice(0, 200)}` } });
          return;
        case "done":
          return;
        default:
          return;
      }
    };

    try {
      const done = await runAgent(request, { signal: controller.signal, onEvent });
      const result: LaneResult = {
        project: done.project,
        stats: done.stats,
        changedKeys: done.changedKeys,
        // 묶음 밖 편집은 적용 때 버려진다 — 리뷰 카드가 그 사실을 먼저 보여준다.
        spills: mapBundleSpill(base, done.project, lane.spec.mapIds),
        conflicts: [],
        summary: `툴콜 ${done.stats.toolCalls}회 · 바뀐 키 ${done.changedKeys.length}개`,
      };
      update(id, { type: "done", result, at: clock() });
      return { ok: true };
    } catch (error) {
      const aborted = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      if (aborted) { update(id, { type: "stopped", at: clock() }); return { ok: false, issue: "중단했습니다" }; }
      update(id, { type: "error", message, at: clock() });
      return { ok: false, issue: message };
    } finally {
      controllers.delete(id);
    }
  };

  const applyLane = async (id: string): Promise<LaneApplyOutcome> => {
    const lane = states.get(id);
    if (!lane?.result || !lane.base) return { ok: false, reason: "no-result", issue: "검토할 결과가 없습니다" };
    const current = store.getCurrent();
    const changed = laneBundleChangedKeys(lane.base, current, lane.spec.mapIds);
    if (changed.length > 0) {
      return {
        ok: false,
        reason: "bundle-changed",
        issue: `이 묶음이 도는 동안 바뀌었습니다 — 다시 실행하세요 (${changed.slice(0, 3).join(", ")}${changed.length > 3 ? ` 외 ${changed.length - 3}` : ""})`,
        keys: changed,
      };
    }
    // 지금 프로젝트 위에 이 레인의 묶음만 얹는다. 묶음 밖(다른 레인이 적용된 것, 사람이 고친 다른 맵)은
    // `current` 에서 그대로 살아남는다 — 이것이 «레인 A 적용이 레인 B 를 죽이지 않는» 지점이다.
    const merged = mergeMapBundles(current, [{ mapIds: lane.spec.mapIds, project: lane.result.project, base: lane.base }]);
    const applied = await applyProposedProject(merged.project, {
      // 기준은 «지금» 으로 새로 잡는다. 제안 자체가 지금 위에 얹힌 것이므로 전체 등가 기준을
      // 그대로 요구하면 이 레인이 방금 읽은 그 기준과 같아 통과한다. 묶음 충돌은 위에서 이미 걸렀다.
      base: captureProposalBase(current),
      baseline: new AuthoredProjectBaseline(current),
      source: "agent",
      agentName: lane.spec.agentLabel,
      summary: `${lane.spec.label} — ${lane.spec.agentLabel}`,
      toolNames: ["pi_agent"],
      snapshotMapId: lane.spec.mapIds[0] ?? null,
    });
    if (!applied.ok) {
      return {
        ok: false,
        reason: applied.reason === "stale-base" || applied.reason === "retired-run" ? applied.reason : "commit-rejected",
        issue: applied.issue ?? "적용하지 못했습니다",
      };
    }
    const spills = merged.spills.flatMap((entry) => entry.keys);
    update(id, { type: "applied" });
    return { ok: true, changedKeys: lane.result.changedKeys, spills };
  };

  return {
    lanes: list,
    get: (id) => states.get(id) ?? null,
    add: (spec) => {
      const lane = createLane(spec);
      order.push(spec.id);
      states.set(spec.id, lane);
      emit();
      return lane;
    },
    remove: (id) => {
      controllers.get(id)?.abort();
      controllers.delete(id);
      states.delete(id);
      const index = order.indexOf(id);
      if (index >= 0) order.splice(index, 1);
      emit();
    },
    start: startLane,
    stop: (id) => {
      controllers.get(id)?.abort();
      if (states.has(id)) update(id, { type: "stopped", at: clock() });
    },
    discard: (id) => { if (states.has(id)) update(id, { type: "discarded" }); },
    apply: applyLane,
    defaults: () => {
      const config = loadAiConfig();
      const deep = modelForRole(config, "deep");
      return { provider: deep.provider, model: deep.model };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose: () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      listeners.clear();
    },
  };
}
