// 레인 렌더 모듬 — 하단 덱의 레인 보드 표·오른쪽 레인 스레드·「＋ 새 레인」 팝오버 폼.
//
// 순수 렌더 모듈이다(상태를 만들지 않는다). 열려 있는 레인·폼 값·선택은 셸이 소유하고,
// 여기는 «그려서 콜백으로 되돌려주는» 일만 한다.
// 배치 결정: docs/superpowers/specs/2026-09-15-studio-agent-lanes-design.md §11 (2026-09-17, 하단 레인 보드).

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

export function formatElapsed(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초`;
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
    attrs: { type: "number", min: "1", max: "600", value: String(input.form.maxTurns), "aria-label": "턴 상한" },
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

/** 「＋ 새 레인」 팝오버 — 폼 하나만 담는다. */
export function renderNewLanePane(input: NewLanePaneInput): HTMLElement {
  return el("div", {
    class: "ai-lane-pane",
    dataset: { testid: "lane-pane" },
    children: [
      el("p", { class: "ai-lane-hint", text: "묶음 하나에 에이전트 하나 — 같은 묶음에 둘을 동시에 붙이면 시작이 거절됩니다." }),
      renderNewLaneForm(input),
    ],
  });
}

// ── 하단 레인 보드 (2026-09-17 §11) ──────────────────────────────────────────
// 에이전트별 진행 상황은 이 표 하나로 본다. 열: 에이전트 · 상태 · 묶음(장면) · 턴·툴·경과 · 마지막 줄 · 동작.
// 팀 실행(/pi team)의 팀장·팀원도 같은 표에 행으로 선다 — 두 시스템이 두 곳에 갈라져 보이지 않게.

export interface LaneBoardInput {
  readonly lanes: readonly LaneState[];
  readonly teamAgents: readonly TeamBoardAgent[];
  readonly project: Project;
  readonly now: number;
  readonly selectedThreadId: string;
  readonly notice: string | null;
  readonly onSelectThread: (id: string) => void;
  readonly onStart: (id: string) => void;
  readonly onStop: (id: string) => void;
  readonly onApply: (id: string) => void;
  readonly onDiscard: (id: string) => void;
  /** 팀 행을 눌렀다 — 오른쪽 열에 팀 보드를 연다. */
  readonly onOpenTeam: () => void;
}

export interface LaneBoardSummary {
  readonly running: number;
  readonly review: number;
  readonly waiting: number;
  readonly total: number;
  /** 「작업 중 2 · 결과 대기 1 · 대기 1」. 레인이 없으면 빈 문자열. */
  readonly text: string;
}

export function laneBoardSummary(lanes: readonly LaneState[], teamAgents: readonly TeamBoardAgent[]): LaneBoardSummary {
  const running = lanes.filter((lane) => lane.status === "running").length + teamAgents.filter((agent) => agent.state === "실행 중").length;
  const review = lanes.filter((lane) => lane.status === "review").length;
  const waiting = lanes.filter((lane) => lane.status === "idle").length + teamAgents.filter((agent) => agent.state === "대기").length;
  const total = lanes.length + teamAgents.length;
  const parts: string[] = [];
  if (running > 0) parts.push(`작업 중 ${running}`);
  if (review > 0) parts.push(`결과 대기 ${review}`);
  if (waiting > 0) parts.push(`대기 ${waiting}`);
  if (parts.length === 0 && total > 0) parts.push(`끝난 레인 ${total}`);
  return { running, review, waiting, total, text: parts.join(" · ") };
}

/** 레인 0 — 덱은 한 줄 미니 상태다. 접어도 같은 한 줄. */
export const LANE_BOARD_EMPTY_TEXT = "레인 0 — 지시를 보내면 감독이 에이전트를 배정하고, 레인이 여기 한 줄씩 쌓입니다.";

export function renderLaneBoardEmpty(notice: string | null): HTMLElement {
  return el("div", {
    class: "lane-board-empty",
    dataset: { testid: "lane-board-empty" },
    children: [
      el("p", { class: "ai-lane-hint", text: LANE_BOARD_EMPTY_TEXT }),
      ...(notice ? [el("p", { class: "ai-lane-notice", text: notice, dataset: { testid: "lane-notice" } })] : []),
    ],
  });
}

/** 「시공A」→「A」, 「검수」→「검」. 표 첫 칸의 동그란 글자. */
export function laneAvatarLetter(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) return "?";
  const last = trimmed[trimmed.length - 1] ?? "";
  return /^[A-Za-z0-9]$/u.test(last) ? last.toUpperCase() : trimmed[0] ?? "?";
}

function providerLabel(id: string): string {
  return OH_MY_PI_PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}

function laneLastLine(lane: LaneState): string {
  switch (lane.status) {
    case "running":
      return lane.progress.lastLine || "모델이 시작하기를 기다리는 중…";
    case "review":
      return lane.result?.summary ?? "결과 도착";
    case "failed":
      return lane.error ?? "실패";
    case "stopped":
      return lane.progress.lastLine ? `중단됨 — ${lane.progress.lastLine}` : "중단됨";
    case "applied":
      return "적용됨";
    case "discarded":
      return "버림";
    default:
      return "「시작」 을 누르면 출발합니다";
  }
}

function laneProgressRatio(lane: LaneState): number {
  if (lane.status === "review" || lane.status === "applied") return 1;
  const max = lane.spec.maxTurns ?? 0;
  if (max <= 0) return lane.status === "running" ? 0.15 : 0;
  return Math.min(1, lane.progress.turns / max);
}

function progressCell(text: string, ratio: number, live: boolean): HTMLElement {
  return el("div", {
    class: "lane-cell lane-cell-progress",
    children: [
      el("span", { class: "lane-progress-text", text }),
      el("span", {
        class: live ? "lane-progress-bar is-live" : "lane-progress-bar",
        attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(ratio * 100)) },
        children: [el("span", { class: "lane-progress-fill", attrs: { style: `--progress:${ratio.toFixed(2)}` } })],
      }),
    ],
  });
}

function laneRow(input: LaneBoardInput, lane: LaneState): HTMLElement {
  const actions = el("div", { class: "lane-cell lane-cell-actions ai-lane-actions" });
  // 행 클릭이 스레드를 여니, 버튼은 자기 일만 하고 행으로 번지지 않는다.
  const guard = (fn: () => void) => (event: Event): void => { event.stopPropagation(); fn(); };
  const add = (label: string, testId: string, fn: () => void, tone?: "primary" | "danger"): void => {
    actions.append(el("button", {
      class: `ai-lane-btn${tone ? ` is-${tone}` : ""}`,
      text: label,
      attrs: { type: "button" },
      dataset: { testid: testId },
      on: { click: guard(fn) },
    }));
  };
  if (lane.status === "running") add("중단", "lane-row-stop", () => input.onStop(lane.spec.id), "danger");
  if (lane.status === "review") {
    add("적용", "lane-row-apply", () => input.onApply(lane.spec.id), "primary");
    add("버리기", "lane-row-discard", () => input.onDiscard(lane.spec.id));
  }
  if (lane.status === "idle") add("시작", "lane-row-start", () => input.onStart(lane.spec.id), "primary");
  if (lane.status === "failed" || lane.status === "stopped") add("다시 실행", "lane-row-start", () => input.onStart(lane.spec.id));
  actions.append(el("button", {
    class: "ai-lane-btn is-ghost lane-row-open",
    text: "›",
    attrs: { type: "button", title: "이 레인 스레드 열기", "aria-label": `${lane.spec.agentLabel} 스레드 열기` },
    dataset: { testid: "lane-row-open" },
    on: { click: guard(() => input.onSelectThread(lane.spec.id)) },
  }));

  const interiors = Math.max(0, lane.bundleIds.length - lane.spec.mapIds.length);
  const elapsed = formatElapsed(laneElapsedMs(lane, input.now));
  const turns = `${lane.progress.turns}${lane.spec.maxTurns ? `/${lane.spec.maxTurns}` : ""}턴`;
  const selected = input.selectedThreadId === lane.spec.id;
  return el("div", {
    class: `lane-row ${laneStatusClass(lane.status)}${selected ? " is-selected" : ""}`,
    attrs: { role: "row", tabindex: "0", "aria-selected": String(selected) },
    dataset: { testid: "lane-row", laneId: lane.spec.id, status: lane.status },
    on: {
      click: () => input.onSelectThread(lane.spec.id),
      keydown: ((event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.onSelectThread(lane.spec.id); }
      }) as EventListener,
    },
    children: [
      el("div", {
        class: "lane-cell lane-cell-agent",
        children: [
          el("span", { class: `lane-avatar ${laneStatusClass(lane.status)}`, text: laneAvatarLetter(lane.spec.agentLabel), attrs: { "aria-hidden": "true" } }),
          el("span", {
            class: "lane-agent-body",
            children: [
              el("b", { class: "lane-agent-name", text: lane.spec.agentLabel }),
              el("span", { class: "lane-agent-model", text: `${providerLabel(lane.spec.provider)} · ${lane.spec.model}` }),
            ],
          }),
        ],
      }),
      el("div", { class: "lane-cell lane-cell-status", children: [statusBadge(lane)] }),
      el("div", {
        class: "lane-cell lane-cell-bundle",
        children: [
          el("span", { class: "lane-bundle-name", text: laneMapNames(input.project, lane) }),
          el("span", { class: "lane-bundle-meta", text: interiors > 0 ? `실내 ${interiors} 포함` : "실내 0" }),
        ],
      }),
      progressCell(`${turns} · 툴 ${lane.progress.toolCalls} · ${elapsed}`, laneProgressRatio(lane), lane.status === "running"),
      el("div", { class: "lane-cell lane-cell-last", text: laneLastLine(lane), attrs: { title: laneLastLine(lane) } }),
      actions,
    ],
  });
}

const TEAM_STATE_CLASS: Record<TeamBoardAgent["state"], string> = {
  "대기": "is-idle",
  "실행 중": "is-running",
  "완료": "is-applied",
  "실패": "is-failed",
  "중단": "is-stopped",
};

function teamRow(input: LaneBoardInput, agent: TeamBoardAgent): HTMLElement {
  const selected = input.selectedThreadId === "team";
  const last = agent.lastLine ?? "";
  return el("div", {
    class: `lane-row is-team ${TEAM_STATE_CLASS[agent.state]}${selected ? " is-selected" : ""}`,
    attrs: { role: "row", tabindex: "0", "aria-selected": String(selected) },
    dataset: { testid: "lane-team-row", agentId: agent.agentId, state: agent.state },
    on: { click: () => input.onOpenTeam() },
    children: [
      el("div", {
        class: "lane-cell lane-cell-agent",
        children: [
          el("span", { class: `lane-avatar ${TEAM_STATE_CLASS[agent.state]}`, text: laneAvatarLetter(agent.roleLabel), attrs: { "aria-hidden": "true" } }),
          el("span", {
            class: "lane-agent-body",
            children: [
              el("b", { class: "lane-agent-name", text: agent.roleLabel }),
              el("span", { class: "lane-agent-model", text: `팀 · ${agent.kindLabel}` }),
            ],
          }),
        ],
      }),
      el("div", { class: "lane-cell lane-cell-status", children: [el("span", { class: `ai-lane-status ${TEAM_STATE_CLASS[agent.state]}`, text: agent.state })] }),
      el("div", {
        class: "lane-cell lane-cell-bundle",
        children: [el("span", { class: "lane-bundle-name", text: agent.mapName ?? "프로젝트 전체" })],
      }),
      progressCell(`${agent.turns}턴 · 툴 ${agent.toolCalls}${agent.toolErrors > 0 ? ` (실패 ${agent.toolErrors})` : ""}`, agent.state === "완료" ? 1 : 0.15, agent.state === "실행 중"),
      el("div", { class: "lane-cell lane-cell-last", text: last, attrs: { title: last } }),
      el("div", {
        class: "lane-cell lane-cell-actions ai-lane-actions",
        children: [el("button", {
          class: "ai-lane-btn is-ghost lane-row-open",
          text: "›",
          attrs: { type: "button", title: "팀 보드 열기", "aria-label": "팀 보드 열기" },
          dataset: { testid: "lane-team-open" },
          on: { click: (event) => { event.stopPropagation(); input.onOpenTeam(); } },
        })],
      }),
    ],
  });
}

const BOARD_COLUMNS: readonly { readonly label: string; readonly cell: string }[] = [
  { label: "에이전트", cell: "lane-cell-agent" },
  { label: "상태", cell: "lane-cell-status" },
  { label: "묶음 (장면)", cell: "lane-cell-bundle" },
  { label: "턴 · 툴 · 경과", cell: "lane-cell-progress" },
  { label: "마지막 줄", cell: "lane-cell-last" },
  { label: "동작", cell: "lane-cell-actions" },
];

/** 하단 덱 「레인」 탭 — 표 하나. 행을 누르면 오른쪽 열이 그 레인 스레드로 바뀐다. */
export function renderLaneBoard(input: LaneBoardInput): HTMLElement {
  // 머리 셀도 본문과 같은 열 클래스를 단다 — 좁은 덱에서 컨테이너 쿼리가 열을 감출 때 머리도 같이 사라져야 한다.
  const head = el("div", {
    class: "lane-row is-head",
    attrs: { role: "row" },
    children: BOARD_COLUMNS.map((column) => el("div", {
      class: `lane-cell lane-cell-head ${column.cell}`,
      attrs: { role: "columnheader" },
      text: column.label,
    })),
  });
  const rows = [
    ...input.lanes.map((lane) => laneRow(input, lane)),
    ...input.teamAgents.map((agent) => teamRow(input, agent)),
  ];
  return el("div", {
    class: "lane-board",
    dataset: { testid: "lane-table" },
    attrs: { role: "table", "aria-label": "에이전트 레인" },
    children: [
      ...(input.notice ? [el("p", { class: "ai-lane-notice lane-board-notice", text: input.notice, dataset: { testid: "lane-notice" } })] : []),
      head,
      ...rows,
    ],
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
        children: [
          // 수신자 칩 — 이 입력은 감독이 아니라 «이 레인» 에게 간다(§11 결정 5).
          el("span", { class: "ai-lane-receiver", text: `→ ${lane.spec.agentLabel}`, dataset: { testid: "lane-receiver" } }),
          followUpInput,
          actionButton("보내기", "lane-follow-up-send", followUp, "primary"),
        ],
      }),
      actions,
    ],
  });
}
