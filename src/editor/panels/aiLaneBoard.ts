// 레인 렌더 모듬 — 좌 레일의 실시간 조수 행·채팅 스레드 목록·오른쪽 레인 스레드·드로워의 새 레인 폼.
//
// 순수 렌더 모듈이다(상태를 만들지 않는다). 열려 있는 레인·폼 값·선택은 셸이 소유하고,
// 여기는 «그려서 콜백으로 되돌려주는» 일만 한다.

import { defaultModelForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { OH_MY_PI_PROVIDERS } from "@/ai/ohMyPiProviders";
import { LANE_STATUS_LABEL, laneElapsedMs, type LaneState, type LaneStatus } from "@/ai/piAgent/lane";
import type { TeamBoardAgent } from "@/ai/piAgent/teamBoardState";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export interface LaneFormState {
  readonly mapIds: readonly string[];
  readonly agentLabel: string;
  readonly provider: string;
  readonly model: string;
  readonly instruction: string;
  readonly maxTurns: number;
}

export interface NewLanePaneInput {
  readonly form: LaneFormState;
  readonly project: Project;
  readonly currentMapId: string | null;
  readonly notice: string | null;
  readonly onFormChange: (patch: Partial<LaneFormState>) => void;
  readonly onCreate: () => void;
}

export interface LaneThreadInput {
  readonly lane: LaneState;
  readonly project: Project;
  readonly now: number;
  readonly notice: string | null;
  readonly onStart: (id: string) => void;
  readonly onStop: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onApply: (id: string) => void;
  readonly onDiscard: (id: string) => void;
  readonly onFollowUp: (id: string, text: string) => void;
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function laneStatusClass(status: LaneStatus): string {
  return `is-${status}`;
}

function statusBadge(lane: LaneState): HTMLElement {
  return el("span", {
    class: `ai-lane-status ${laneStatusClass(lane.status)}`,
    text: LANE_STATUS_LABEL[lane.status],
    dataset: { testid: "lane-status", laneId: lane.spec.id, status: lane.status },
  });
}

function bundleLabel(project: Project, mapIds: readonly string[]): string {
  const names = mapIds.map((id) => project.maps[id]?.name ?? id);
  return names.join(" + ") || "묶음 없음";
}

function laneMapNames(project: Project, lane: LaneState): string {
  return bundleLabel(project, lane.spec.mapIds);
}

function actionButton(label: string, testId: string, onClick: () => void, tone?: "primary" | "danger"): HTMLButtonElement {
  return el("button", {
    class: `ai-lane-btn${tone ? ` is-${tone}` : ""}`,
    text: label,
    attrs: { type: "button" },
    dataset: { testid: testId },
    on: { click: onClick },
  }) as HTMLButtonElement;
}

function renderNewLaneForm(input: NewLanePaneInput): HTMLElement {
  const maps = Object.entries(input.project.maps).map(([id, map]) => ({ id, name: map.name || id }));
  const chips = maps.map((map) => {
    const on = input.form.mapIds.includes(map.id);
    return el("button", {
      class: on ? "ai-lane-map-chip is-on" : "ai-lane-map-chip",
      text: map.name,
      attrs: { type: "button", "aria-pressed": String(on) },
      dataset: { testid: "lane-map-chip", mapId: map.id },
      on: {
        click: () => {
          const next = on ? input.form.mapIds.filter((id) => id !== map.id) : [...input.form.mapIds, map.id];
          input.onFormChange({ mapIds: next });
        },
      },
    });
  });

  const providerSelect = el("select", {
    class: "ai-lane-select",
    dataset: { testid: "lane-provider" },
    on: {
      change: () => {
        const provider = providerSelect.value;
        input.onFormChange({ provider, model: defaultModelForAuthMode("chatgpt", provider) });
      },
    },
    children: OH_MY_PI_PROVIDERS.map((provider) => el("option", {
      text: provider.label,
      attrs: { value: provider.id, ...(provider.id === input.form.provider ? { selected: "" } : {}) },
    })),
  }) as HTMLSelectElement;

  const models = modelCatalogForAuthMode("chatgpt", input.form.provider).flatMap((group) => group.models);
  const modelSelect = el("select", {
    class: "ai-lane-select",
    dataset: { testid: "lane-model" },
    on: { change: () => input.onFormChange({ model: modelSelect.value }) },
    children: models.map((model) => el("option", {
      text: model,
      attrs: { value: model, ...(model === input.form.model ? { selected: "" } : {}) },
    })),
  }) as HTMLSelectElement;

  const agentInput = el("input", {
    class: "ai-lane-input",
    attrs: { type: "text", value: input.form.agentLabel, placeholder: "시공A", "aria-label": "에이전트 이름" },
    dataset: { testid: "lane-agent" },
    on: { input: () => input.onFormChange({ agentLabel: agentInput.value }) },
  }) as HTMLInputElement;

  const turnsInput = el("input", {
    class: "ai-lane-input is-narrow",
    attrs: { type: "number", min: "1", max: "60", value: String(input.form.maxTurns), "aria-label": "턴 상한" },
    dataset: { testid: "lane-turns" },
    on: { input: () => input.onFormChange({ maxTurns: Number(turnsInput.value) || 1 }) },
  }) as HTMLInputElement;

  const instruction = el("textarea", {
    class: "ai-lane-instruction",
    attrs: { rows: "2", placeholder: "이 묶음에게 한 문장으로 — 무엇을, 어디까지", "aria-label": "레인 지시" },
    dataset: { testid: "lane-instruction" },
    on: { input: () => { input.onFormChange({ instruction: instruction.value }); syncStart(); } },
  }) as HTMLTextAreaElement;
  instruction.value = input.form.instruction;

  const start = actionButton("레인 추가", "lane-create", () => input.onCreate(), "primary");
  // 입력 중에는 다시 그리지 않으므로(타이핑이 사라진다) 버튼 활성 상태만 직접 맞춘다.
  function syncStart(): void {
    start.disabled = input.form.mapIds.length === 0 || instruction.value.trim().length === 0;
  }
  syncStart();

  return el("div", {
    class: "ai-lane-form",
    dataset: { testid: "lane-form" },
    children: [
      el("div", {
        class: "ai-lane-form-row",
        children: [
          el("span", { class: "ai-lane-form-label", text: "묶음" }),
          el("div", { class: "ai-lane-map-picker", children: chips.length > 0 ? chips : [el("span", { class: "ai-lane-empty-text", text: "맵이 없습니다" })] }),
        ],
      }),
      el("div", {
        class: "ai-lane-form-row",
        children: [
          el("span", { class: "ai-lane-form-label", text: "에이전트" }),
          agentInput,
          providerSelect,
          modelSelect,
          el("span", {
            class: "ai-lane-field",
            children: [el("span", { class: "ai-lane-form-label", text: "턴" }), turnsInput],
          }),
        ],
      }),
      instruction,
      el("div", {
        class: "ai-lane-form-row is-actions",
        children: [
          start,
          el("span", {
            class: "ai-lane-hint",
            text: "같은 묶음에 둘을 동시에 붙일 수 없습니다 — 겹치면 시작이 거절됩니다.",
          }),
          ...(input.notice ? [el("span", { class: "ai-lane-notice", text: input.notice, dataset: { testid: "lane-notice" } })] : []),
        ],
      }),
    ],
  });
}

/** 덱 드로워의 「세 레인」 탭 — 폼 하나만 담는다(레인 표는 좌 레일의 실시간 행이 대신한다). */
export function renderNewLanePane(input: NewLanePaneInput): HTMLElement {
  return el("div", {
    class: "ai-lane-pane",
    dataset: { testid: "lane-pane" },
    children: [
      el("p", { class: "ai-lane-hint", text: "음 하나에 에이전트 하나 — 같은 음에 둘을 동시에 붙이면 시작이 거절됩니다." }),
      renderNewLaneForm(input),
    ],
  });
}

export interface StudioThread {
  /** "director" 또는 레인 id. */
  readonly id: string;
  readonly label: string;
  readonly kind: "director" | "lane";
  readonly status?: LaneStatus;
  readonly detail?: string;
}

export interface AgentLiveListInput {
  readonly lanes: readonly LaneState[];
  readonly project: Project;
  readonly now: number;
  readonly selectedThreadId: string;
  readonly notice: string | null;
  readonly onSelectThread: (id: string) => void;
  readonly onStop: (id: string) => void;
  readonly onApply: (id: string) => void;
  readonly onDiscard: (id: string) => void;
}

export interface ThreadListInput {
  readonly threads: readonly StudioThread[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

/** 좌 레일 「조수」 절 — 레인이 지금 무엇을 하는지 한 줄씩 산다. */
export function renderAgentLiveList(input: AgentLiveListInput): HTMLElement {
  const noticeLine = input.notice ? [el("p", { class: "ai-lane-notice", text: input.notice, dataset: { testid: "lane-notice" } })] : [];
  if (input.lanes.length === 0) {
    return el("div", {
      class: "ai-studio-agents",
      dataset: { testid: "ai-studio-agents" },
      children: [
        ...noticeLine,
        el("p", { class: "ai-lane-empty-text", text: "세워 둔 조수가 없습니다 — 조수 ＋ 또는 아래 「도구」 드로워의 「새 레인」 에서 하나 세우세요." }),
      ],
    });
  }
  const rows = input.lanes.map((lane) => {
    const actions = el("span", { class: "ai-lane-actions" });
    if (lane.status === "running") actions.append(actionButton("중단", "agent-row-stop", () => input.onStop(lane.spec.id), "danger"));
    if (lane.status === "review") {
      actions.append(
        actionButton("적용", "agent-row-apply", () => input.onApply(lane.spec.id), "primary"),
        actionButton("버리기", "agent-row-discard", () => input.onDiscard(lane.spec.id)),
      );
    }
    const live = lane.status === "running"
      ? (lane.progress.lastLine || "모델이 시작하기를 기다리는 중…")
      : lane.result?.summary ?? lane.error ?? "";
    const selected = input.selectedThreadId === lane.spec.id;
    return el("div", {
      class: selected ? "ai-studio-agent-row is-selected" : "ai-studio-agent-row",
      dataset: { testid: "ai-studio-agent-row", laneId: lane.spec.id, status: lane.status },
      on: { click: () => input.onSelectThread(lane.spec.id) },
      children: [
        el("span", {
          class: "ai-studio-agent-head",
          children: [
            el("b", { text: lane.spec.agentLabel }),
            statusBadge(lane),
            el("span", { class: "ai-studio-agent-map", text: laneMapNames(input.project, lane) }),
          ],
        }),
        el("span", {
          class: "ai-studio-agent-live",
          text: `${lane.progress.turns}턴 · 툴 ${lane.progress.toolCalls} · ${formatElapsed(laneElapsedMs(lane, input.now))}`,
        }),
        ...(live ? [el("span", { class: "ai-studio-agent-line", text: live })] : []),
        actions,
      ],
    });
  });
  return el("div", {
    class: "ai-studio-agents",
    dataset: { testid: "ai-studio-agents" },
    children: [...noticeLine, ...rows],
  });
}

/** 좌 레일 「팅」 절 — 감독 + 레인 스레드 목록. 고른 스레드가 오른쪽 열에 산다. */
export interface TeamLiveRowsInput {
  readonly agents: readonly TeamBoardAgent[];
  readonly onOpenBoard: () => void;
}

const TEAM_STATE_CLASS: Record<TeamBoardAgent["state"], string> = {
  "대기": "is-idle",
  "실행 중": "is-running",
  "완료": "is-applied",
  "실패": "is-failed",
  "중단": "is-stopped",
};

/** 좌 레일 「조수」 절 — 팀 실행(/pi team)의 팀장·팀원도 레인과 나란히 실시간으로 보인다.
 *  팀 보드 자체(트랜스크립트·툴 인자)는 드로워의 「작업」 탭이고, 여기는 «누가 무엇을 하는 중» 한 줄씩이다. */
export function renderTeamLiveRows(input: TeamLiveRowsInput): HTMLElement | null {
  if (input.agents.length === 0) return null;
  const rows = input.agents.map((agent) => el("div", {
    class: "ai-studio-agent-row is-team",
    dataset: { testid: "ai-studio-team-row", agentId: agent.agentId, state: agent.state },
    on: { click: input.onOpenBoard },
    children: [
      el("span", {
        class: "ai-studio-agent-head",
        children: [
          el("b", { text: agent.roleLabel }),
          el("span", { class: "ai-lane-status " + TEAM_STATE_CLASS[agent.state], text: agent.state }),
          el("span", { class: "ai-studio-agent-kind", text: agent.kindLabel }),
          el("span", { class: "ai-studio-agent-map", text: agent.mapName ?? "프로젝트 전체" }),
        ],
      }),
      el("span", {
        class: "ai-studio-agent-live",
        text: agent.turns + "턴 · 툴 " + agent.toolCalls + (agent.toolErrors > 0 ? " (실패 " + agent.toolErrors + ")" : ""),
      }),
      ...(agent.lastLine
        ? [el("span", { class: agent.lastKind === "text" ? "ai-studio-agent-line is-text" : "ai-studio-agent-line", text: agent.lastLine })]
        : []),
    ],
  }));
  return el("div", { class: "ai-studio-team-rows", dataset: { testid: "ai-studio-team-rows" }, children: rows });
}

export function renderThreadList(input: ThreadListInput): HTMLElement {
  const rows = input.threads.map((thread) => {
    const selected = thread.id === input.selectedId;
    return el("button", {
      class: selected ? "ai-studio-thread is-on" : "ai-studio-thread",
      attrs: { type: "button", "aria-current": selected ? "true" : "false" },
      dataset: { testid: `ai-studio-thread-${thread.id}`, kind: thread.kind },
      on: { click: () => input.onSelect(thread.id) },
      children: [
        el("span", { class: "ai-studio-thread-label", text: thread.label }),
        ...(thread.status ? [el("span", { class: `ai-lane-status ${laneStatusClass(thread.status)}`, text: LANE_STATUS_LABEL[thread.status] })] : []),
        ...(thread.detail ? [el("span", { class: "ai-studio-thread-detail", text: thread.detail })] : []),
      ],
    });
  });
  return el("div", {
    class: "ai-studio-threads",
    dataset: { testid: "ai-studio-threads" },
    children: rows,
  });
}

function stepList(lane: LaneState): HTMLElement {
  if (lane.steps.length === 0) {
    return el("p", { class: "ai-lane-empty-text", text: lane.status === "running" ? "아직 단계가 없습니다 — 모델이 생각 중입니다." : "단계 기록이 없습니다." });
  }
  return el("div", {
    class: "ai-lane-steps",
    dataset: { testid: "lane-steps" },
    children: lane.steps.map((step) => el("div", {
      class: `ai-lane-step is-${step.kind}`,
      text: step.text,
    })),
  });
}

/** 오른쪽 열 — 지금 보고 있는 레인 스레드. 그 조수와의 대화·결과·후속 지시가 여기 산다. */
export function renderLaneThread(input: LaneThreadInput): HTMLElement {
  const lane = input.lane;
  const actions = el("span", { class: "ai-lane-actions" });
  if (lane.status === "running") actions.append(actionButton("이 레인 중단", "lane-inspector-stop", () => input.onStop(lane.spec.id), "danger"));
  if (lane.status === "review") {
    actions.append(
      actionButton("이 레인만 적용", "lane-inspector-apply", () => void input.onApply(lane.spec.id), "primary"),
      actionButton("버리기", "lane-inspector-discard", () => input.onDiscard(lane.spec.id)),
      actionButton("다시 실행", "lane-inspector-retry", () => input.onRetry(lane.spec.id)),
    );
  }
  if (lane.status === "idle" || lane.status === "failed" || lane.status === "stopped") {
    actions.append(actionButton("시작", "lane-inspector-start", () => input.onStart(lane.spec.id), "primary"));
  }

  const result = lane.result;
  const resultBlock = result
    ? el("div", {
      class: "ai-lane-result",
      dataset: { testid: "lane-result" },
      children: [
        el("span", { class: "ai-lane-result-line", text: result.summary }),
        el("span", {
          class: "ai-lane-result-line",
          text: `바뀐 키 ${result.changedKeys.length}개${result.changedKeys.length > 0 ? ` — ${result.changedKeys.slice(0, 4).join(", ")}${result.changedKeys.length > 4 ? " …" : ""}` : ""}`,
        }),
        ...(result.spills.length > 0
          ? [el("span", {
            class: "ai-lane-result-line is-warn",
            text: `묶음 밖 ${result.spills.length}건은 적용 때 버려집니다 — ${result.spills.slice(0, 3).join(", ")}${result.spills.length > 3 ? " …" : ""}`,
          })]
          : []),
      ],
    })
    : el("p", { class: "ai-lane-empty-text", text: "아직 결과가 없습니다." });

  const followUpInput = el("input", {
    class: "ai-lane-input is-wide",
    attrs: { type: "text", placeholder: "이 레인에게 한 문장 더", "aria-label": "레인 후속 지시" },
    dataset: { testid: "lane-follow-up" },
  }) as HTMLInputElement;
  const followUp = (): void => {
    const text = followUpInput.value.trim();
    if (text.length === 0) return;
    followUpInput.value = "";
    input.onFollowUp(lane.spec.id, text);
  };

  return el("section", {
    class: "ai-lane-thread",
    dataset: { testid: "lane-thread", laneId: lane.spec.id },
    children: [
      el("div", {
        class: "ai-lane-inspector-head",
        children: [
          el("b", { text: `${lane.spec.label} · ${lane.spec.agentLabel}` }),
          statusBadge(lane),
          el("span", { class: "ai-lane-model", text: `${lane.spec.provider} · ${lane.spec.model}` }),
        ],
      }),
      el("div", {
        class: "ai-lane-inspector-meta",
        children: [
          el("span", { text: `묶음 ${laneMapNames(input.project, lane)}` }),
          el("span", { text: `턴 상한 ${lane.spec.maxTurns ?? "기본"}` }),
          el("span", { text: `경과 ${formatElapsed(laneElapsedMs(lane, input.now))}` }),
        ],
      }),
      el("p", { class: "ai-lane-instruction-text", text: `지시: ${lane.spec.instruction}` }),
      stepList(lane),
      resultBlock,
      ...(lane.error ? [el("p", { class: "ai-lane-error", text: lane.error })] : []),
      ...(input.notice ? [el("p", { class: "ai-lane-notice", text: input.notice, dataset: { testid: "lane-notice" } })] : []),
      el("div", {
        class: "ai-lane-follow-up",
        children: [followUpInput, actionButton("이 레인에게 보내기", "lane-follow-up-send", followUp, "primary")],
      }),
      actions,
    ],
  });
}
