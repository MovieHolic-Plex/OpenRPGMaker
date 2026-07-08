// [P2] 모던 전용 파생 뷰 2종 — RM2003 보존 원칙 7(기본 접힘 + 명시적 토글) 준수.
//  1) 라이브 미리보기: 페이지 커맨드를 스크립트 순서로 펼쳐 commandPreview 렌더러를
//     스텝 재생(이전/다음/자동)하는 시퀀서. 320x240 런타임을 흉내내는 목업이 아니라
//     기존 프리뷰 렌더러의 재사용이다.
//  2) 플로우차트: 조건 분기/선택지/반복을 노드 그래프로 보여주는 읽기 전용 뷰.
//     데이터 모델은 Command union 그대로 두고(원칙 5) 전부 파생 렌더다.
import { clearChildren, el } from "@/util/dom";
import type { Command, EventPage } from "@/project/types";
import { commandCategoryVisual } from "./commandCategoryIcons";
import { renderCommandPreview } from "./commandPreview";
import { commandSummary } from "./commandSummary";

type ActiveFace = { readonly resourceId: string; readonly faceIndex: number };

type ScriptStep = {
  readonly command: Command;
  readonly depth: number;
  readonly branchLabel?: string;
  readonly face?: ActiveFace;
};

// 접힘/스텝 상태는 재렌더(스토어 구독)를 넘어 유지한다. 페이지 id 키.
const openLivePreview = new Set<string>();
const openFlowchart = new Set<string>();
const stepByPage = new Map<string, number>();

export function renderEventScriptModernViews(page: EventPage): HTMLElement {
  const wrap = el("div", { class: "event-script-modern-views" });
  wrap.append(renderLivePreview(page), renderFlowchart(page));
  return wrap;
}

/* ---------------------------------------------------------------- 라이브 미리보기 */

function renderLivePreview(page: EventPage): HTMLElement {
  const details = el("details", {
    class: "event-script-live-preview",
    dataset: { testid: "event-script-live-preview" },
  }) as HTMLDetailsElement;
  if (openLivePreview.has(page.id)) details.open = true;
  const summary = el("summary", { text: "라이브 미리보기 (스텝 재생)" });
  details.append(summary);
  details.addEventListener("toggle", () => {
    if (details.open) openLivePreview.add(page.id);
    else openLivePreview.delete(page.id);
  });

  const steps = flattenScript(page.commands);
  const body = el("div", { class: "event-script-live-preview-body" });
  if (steps.length === 0) {
    body.append(el("div", { class: "empty-hint", text: "재생할 명령이 없습니다." }));
    details.append(body);
    return details;
  }

  let index = Math.min(stepByPage.get(page.id) ?? 0, steps.length - 1);
  let playTimer: ReturnType<typeof setInterval> | null = null;

  const stage = el("div", { class: "event-script-live-stage", dataset: { testid: "event-script-live-stage" } });
  const caption = el("div", { class: "event-script-live-caption", dataset: { testid: "event-script-live-caption" } });
  const position = el("span", { class: "event-script-live-position" });

  const renderStep = () => {
    stepByPage.set(page.id, index);
    const step = steps[index];
    if (!step) return;
    clearChildren(stage);
    stage.append(renderCommandPreview(step.command, { face: step.face }));
    const branch = step.branchLabel ? `[${step.branchLabel}] ` : "";
    caption.textContent = `${branch}${commandSummary(step.command)}`;
    position.textContent = `${index + 1}/${steps.length}`;
  };

  const stopPlayback = () => {
    if (playTimer !== null) clearInterval(playTimer);
    playTimer = null;
    playButton.textContent = "자동 재생";
    playButton.setAttribute("aria-pressed", "false");
  };

  const playButton = el("button", {
    class: "btn small",
    text: "자동 재생",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "event-script-live-play" },
    on: {
      click: () => {
        if (playTimer !== null) {
          stopPlayback();
          return;
        }
        playButton.textContent = "정지";
        playButton.setAttribute("aria-pressed", "true");
        playTimer = setInterval(() => {
          // 패널이 DOM 에서 떨어지거나 닫히면 자동 정지(잔여 타이머 방지).
          if (!details.isConnected || !details.open || index >= steps.length - 1) {
            stopPlayback();
            return;
          }
          index += 1;
          renderStep();
        }, 1200);
      },
    },
  }) as HTMLButtonElement;

  const controls = el("div", {
    class: "event-script-live-controls",
    children: [
      el("button", {
        class: "btn small",
        text: "이전",
        attrs: { type: "button" },
        dataset: { testid: "event-script-live-prev" },
        on: {
          click: () => {
            stopPlayback();
            index = Math.max(0, index - 1);
            renderStep();
          },
        },
      }),
      el("button", {
        class: "btn small",
        text: "다음",
        attrs: { type: "button" },
        dataset: { testid: "event-script-live-next" },
        on: {
          click: () => {
            stopPlayback();
            index = Math.min(steps.length - 1, index + 1);
            renderStep();
          },
        },
      }),
      playButton,
      position,
    ],
  });

  body.append(controls, stage, caption);
  details.append(body);
  renderStep();
  return details;
}

// 페이지 커맨드를 스크립트(문서) 순서로 펼친다. 분기 라벨과 활성 얼굴 상태를 함께 기록.
export function flattenScript(commands: readonly Command[]): ScriptStep[] {
  const steps: ScriptStep[] = [];
  const face: { current: ActiveFace | undefined } = { current: undefined };
  const walk = (list: readonly Command[], depth: number, branchLabel?: string): void => {
    for (const command of list) {
      steps.push({ command, depth, branchLabel, face: face.current });
      if (command.kind === "changeFace") {
        face.current = command.resourceId
          ? { resourceId: command.resourceId, faceIndex: command.faceIndex }
          : undefined;
      }
      if (command.kind === "choices") {
        command.options.forEach((option, optionIndex) => {
          walk(option.branch, depth + 1, option.text || `선택지 ${optionIndex + 1}`);
        });
        if (command.cancelBehavior === "branch") walk(command.cancelBranch ?? [], depth + 1, "취소할 때");
      } else if (command.kind === "fork") {
        walk(command.then, depth + 1, "참일 때");
        if (command.else) walk(command.else, depth + 1, "그 외");
      } else if (command.kind === "loop") {
        walk(command.body, depth + 1, "반복");
      } else if (command.kind === "shop" && command.branchOnTransaction) {
        walk(command.transactionBranch ?? [], depth + 1, "구매/판매");
      } else if (command.kind === "promoteActor") {
        walk(command.successBranch ?? [], depth + 1, "승급 성공");
        walk(command.failureBranch ?? [], depth + 1, "승급 실패");
      } else if (command.kind === "evolveMonster") {
        walk(command.successBranch ?? [], depth + 1, "진화 성공");
        walk(command.failureBranch ?? [], depth + 1, "진화 실패");
      }
    }
  };
  walk(commands, 0);
  return steps;
}

/* ---------------------------------------------------------------- 플로우차트 */

function renderFlowchart(page: EventPage): HTMLElement {
  const details = el("details", {
    class: "event-script-flowchart",
    dataset: { testid: "event-script-flowchart" },
  }) as HTMLDetailsElement;
  if (openFlowchart.has(page.id)) details.open = true;
  details.append(el("summary", { text: "플로우차트 보기" }));
  details.addEventListener("toggle", () => {
    if (details.open) openFlowchart.add(page.id);
    else openFlowchart.delete(page.id);
  });
  const body = el("div", { class: "event-flowchart-body", dataset: { testid: "event-flowchart-body" } });
  if (page.commands.length === 0) {
    body.append(el("div", { class: "empty-hint", text: "표시할 명령이 없습니다." }));
  } else {
    body.append(flowColumn(page.commands));
  }
  details.append(body);
  return details;
}

// 순차 명령 = 세로 컬럼, 분기 = 가로로 나란한 하위 컬럼.
function flowColumn(commands: readonly Command[]): HTMLElement {
  const column = el("div", { class: "event-flow-column" });
  for (const command of commands) {
    column.append(flowNode(command));
    const branches = flowBranchesOf(command);
    if (branches.length > 0) {
      const branchRow = el("div", { class: "event-flow-branches" });
      for (const branch of branches) {
        const cell = el("div", { class: "event-flow-branch" });
        cell.append(el("div", { class: "event-flow-branch-label", text: branch.label }));
        cell.append(
          branch.commands.length > 0
            ? flowColumn(branch.commands)
            : el("div", { class: "event-flow-empty", text: "(비어 있음)" })
        );
        branchRow.append(cell);
      }
      column.append(branchRow);
    }
  }
  return column;
}

function flowNode(command: Command): HTMLElement {
  const visual = commandCategoryVisual(command);
  return el("div", {
    class: "event-flow-node",
    dataset: { category: visual.key, testid: `event-flow-node-${command.kind}` },
    children: [
      el("span", { class: "event-flow-node-icon", text: visual.glyph, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "event-flow-node-text", text: truncate(commandSummary(command), 46) }),
    ],
  });
}

type FlowBranch = { readonly label: string; readonly commands: readonly Command[] };

function flowBranchesOf(command: Command): FlowBranch[] {
  if (command.kind === "fork") {
    const branches: FlowBranch[] = [{ label: "참", commands: command.then }];
    if (command.else) branches.push({ label: "그 외", commands: command.else });
    return branches;
  }
  if (command.kind === "choices") {
    const branches: FlowBranch[] = command.options.map((option, index) => ({
      label: option.text || `선택지 ${index + 1}`,
      commands: option.branch,
    }));
    if (command.cancelBehavior === "branch") branches.push({ label: "취소", commands: command.cancelBranch ?? [] });
    return branches;
  }
  if (command.kind === "loop") return [{ label: "반복", commands: command.body }];
  if (command.kind === "shop" && command.branchOnTransaction) {
    return [{ label: "구매/판매", commands: command.transactionBranch ?? [] }];
  }
  if (command.kind === "promoteActor") {
    return [
      { label: "성공", commands: command.successBranch ?? [] },
      { label: "실패", commands: command.failureBranch ?? [] },
    ];
  }
  if (command.kind === "evolveMonster") {
    return [
      { label: "성공", commands: command.successBranch ?? [] },
      { label: "실패", commands: command.failureBranch ?? [] },
    ];
  }
  return [];
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
