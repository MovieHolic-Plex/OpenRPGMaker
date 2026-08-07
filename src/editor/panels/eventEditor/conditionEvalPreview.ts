import { el } from "@/util/dom";
import { evalCondition } from "@/project/session";
import { editorState } from "@/editor/editorState";
import type { Condition } from "@/project/types";
import { commandSummary } from "./commandSummary";
import { createPreviewSimState } from "./previewSimulation";

/**
 * Live TRUE/FALSE evaluation against a session snapshot for author feedback.
 * Uses play-start defaults when no live play session is available.
 */
export function renderConditionEvalPreview(condition: Condition | undefined): HTMLElement {
  const simState = createPreviewSimState();
  const sessionLike = {
    switches: simState.switches,
    selfSwitches: simState.selfSwitches,
    variables: simState.variables,
    timers: {} as Record<string, number>,
    gold: simState.gold,
    inventory: simState.inventory,
    partyActorIds: simState.partyActorIds,
    flags: simState.flags,
    actorVitals: {},
    currentMapId: "",
    x: 0,
    y: 0,
  };
  const hostId = editorState.get().selectedEventId;
  const ok = evalCondition(sessionLike as never, condition, hostId ?? undefined);
  const summary = describeCondition(condition);

  return el("div", {
    class: `event-condition-eval ${ok ? "is-true" : "is-false"}`,
    dataset: { testid: "event-condition-eval", evalOk: ok ? "true" : "false" },
    children: [
      el("div", {
        class: "event-condition-eval-badge",
        text: ok ? "충족" : "불충족",
        dataset: { testid: "event-condition-eval-badge" },
      }),
      el("div", {
        class: "event-condition-eval-body",
        children: [
          el("div", {
            class: "event-condition-eval-summary",
            text: summary,
            dataset: { testid: "event-condition-eval-summary" },
          }),
          el("div", {
            class: "event-condition-eval-note",
            text: hostId
              ? `시뮬 상태 기준 · 호스트 ${hostId.replace(/^ev_[0-9a-f-]+$/i, "(자동 생성)")}`
              : "시뮬 상태 기준 · 선택 이벤트 없음(셀프/활동 조건은 보수적으로 평가)",
          }),
        ],
      }),
    ],
  });
}

function describeCondition(condition: Condition | undefined): string {
  if (!condition) return "(조건 없음)";
  const full = commandSummary({ kind: "fork", condition, then: [] });
  const sep = full.indexOf(": ");
  return sep >= 0 ? full.slice(sep + 2) : full;
}
