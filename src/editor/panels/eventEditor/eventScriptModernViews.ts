// [P2] 모던 전용 파생 뷰 2종. 둘 다 「이 페이지가 하는 일」 컬럼의 **보기 방식**이라
// 열 전체 높이를 쓴다 — 예전처럼 도구 팝오버 안 280px 오버레이가 아니다.
//  1) 미리보기: 페이지 커맨드를 스크립트 순서로 펼쳐 commandPreview 렌더러를
//     스텝 재생(이전/다음/자동)하는 시퀀서. 320x240 런타임을 흉내내는 목업이 아니라
//     기존 프리뷰 렌더러의 재사용이다.
//  2) 플로우: 조건 분기/선택지/반복을 노드 그래프로 보여주는 읽기 전용 뷰.
//     데이터 모델은 Command union 그대로 두고(원칙 5) 전부 파생 렌더다.
//
// 왜 플로우가 팝오버에서 나왔나: 팝오버는 미리보기 **위에** 떠서 「자동 재생」과 단계
// 카운터를 덮었고, 618×280 으로 묶여 최상위 명령 7개 중 2개만 보였다. 게다가 겹쳐 뜨는
// 동안에도 미리보기가 몇 번째 단계인지 알려주지 않아 두 화면이 서로 남남이었다.
// 지금은 네 번째 보기 방식이고, 미리보기가 보던 단계를 `stepByPage` 로 이어받아 짚는다.
import { clearChildren, el } from "@/util/dom";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import type { Command, EventPage, MapId } from "@/project/types";
import { auxCompositeKey } from "./auxOpenController";
import { commandCategoryVisual } from "./commandCategoryIcons";
import { renderCommandPreview } from "./commandPreview";
import { commandSummary } from "./commandSummary";
import { commandKindLabel } from "./options";
import { renderEditorIcon, type EditorIconName } from "./editorIcons";
import { simulatePageCommands, type SimulatedStep } from "./previewSimulation";

export type EventScriptModernViewsOptions = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
};

/**
 * 「미리보기가 마지막으로 보던 단계」. 미리보기와 플로우가 **같이** 읽는다.
 * 두 보기는 동시에 뜨지 않으므로(서로 배타적인 보기 방식) 이 값이 둘 사이의 유일한 이음줄이다.
 */
const stepByPage = new Map<string, number>();

/* ---------------------------------------------------------------- 미리보기 */

export function renderEventPagePreview(options: EventScriptModernViewsOptions): HTMLElement {
  const { mapId, eventId, page } = options;
  const key = auxCompositeKey(mapId, eventId, page.id);
  const panel = el("section", {
    class: "event-page-preview",
    attrs: { "aria-label": "이 페이지 미리보기" },
    dataset: { testid: "event-page-preview" },
  });
  const hostEventId = eventId;
  const steps = simulatePageCommands(page.commands, hostEventId, mapId).steps;
  panel.append(el("div", {
    class: "event-script-preview-disclaimer",
    text: "실제 게임 실행이 아닌 스크립트 미리보기입니다. 반복은 한 번만 펼치고, 선택지는 모든 분기를 나열하며, 라벨/라벨 이동은 실제 점프를 수행하지 않습니다.",
    dataset: { testid: "event-script-preview-disclaimer" },
  }));
  if (steps.length === 0) {
    panel.append(el("div", {
      class: "empty-hint",
      text: "미리볼 명령이 없습니다. 명령을 추가하면 여기에서 차례대로 볼 수 있습니다.",
      dataset: { testid: "event-page-preview-empty" },
    }));
    return panel;
  }

  let index = Math.min(stepByPage.get(key) ?? 0, steps.length - 1);
  let playTimer: ReturnType<typeof setInterval> | null = null;

  const stage = el("div", { class: "event-script-live-stage", dataset: { testid: "event-script-live-stage" } });
  const caption = el("div", { class: "event-script-live-caption", dataset: { testid: "event-script-live-caption" } });
  const position = el("span", { class: "event-script-live-position" });

  stage.setAttribute("role", "region");
  stage.setAttribute("aria-label", "미리보기 내용 · 긴 내용은 스크롤하여 확인");
  stage.setAttribute("tabindex", "0");
  const contextBody = el("div", { class: "event-script-live-context-body", attrs: {
    tabindex: "0", role: "region", "aria-label": "전체 명령 및 분기 맥락",
  } });
  const context = el("details", { class: "event-script-live-context", children: [
    el("summary", { attrs: { "aria-label": "전체 명령 및 분기 맥락 보기" }, children: [
      el("span", { text: "전체 맥락 보기 · 긴 미리보기는 위 무대에서 스크롤", class: "event-script-live-context-label" }), caption,
    ] }),
    contextBody,
  ] });
  const status = el("span", { class: "event-script-live-status", attrs: {
    role: "status", "aria-live": "polite", "aria-atomic": "true",
  } });
  // Observe removal only while playing. View/page replacement and modal close all
  // remove this panel; a detached panel must neither advance nor announce.
  let removalObserver: MutationObserver | null = null;

  const stopPlayback = () => {
    if (playTimer !== null) clearInterval(playTimer);
    playTimer = null;
    removalObserver?.disconnect();
    removalObserver = null;
  };

  const control = (action: string, label: string, icon: EditorIconName, click: () => void) => el("button", {
    class: "btn event-script-transport-button",
    attrs: { type: "button" }, dataset: { testid: `event-script-live-${action}` },
    children: [renderEditorIcon(icon), el("span", { text: label })], on: { click },
  }) as HTMLButtonElement;
  const moveTo = (next: number) => { stopPlayback(); index = next; renderStep(); };
  const previous = control("prev", "이전", "arrowLeft", () => moveTo(Math.max(0, index - 1)));
  const next = control("next", "다음", "arrowRight", () => moveTo(Math.min(steps.length - 1, index + 1)));
  const restart = control("restart", "처음으로", "refresh", () => moveTo(0));
  const playButton = control("play", "자동 재생", "play", () => {
    if (playTimer !== null) {
      stopPlayback();
      renderControls();
      return;
    }
    const replay = index === steps.length - 1;
    if (replay) index = 0;
    playTimer = setInterval(() => {
      if (!panel.isConnected) { stopPlayback(); return; }
      index += 1;
      if (index === steps.length - 1) stopPlayback();
      renderStep();
    }, 1200);
    removalObserver = new MutationObserver(() => {
      if (!panel.isConnected) stopPlayback();
    });
    removalObserver.observe(document.body, { childList: true, subtree: true });
    if (replay) renderStep();
    else renderControls();
  });
  const renderControls = () => {
    const focused = document.activeElement;
    previous.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    restart.disabled = index === 0 && playTimer === null;
    playButton.disabled = steps.length < 2;
    playButton.setAttribute("aria-pressed", String(playTimer !== null));
    playButton.replaceChildren(renderEditorIcon(playTimer !== null ? "pause" : "play"), el("span", {
      text: playTimer !== null ? "일시정지" : index === steps.length - 1 && steps.length > 1 ? "처음부터 재생" : "자동 재생",
    }));
    // Native disabling can blur the active button. Only that transition needs a
    // fallback; ordinary navigation and background refresh never move focus.
    if ([previous, next, restart, playButton].some(button => button === focused && button.disabled)) {
      [next, previous, playButton].find(button => !button.disabled)?.focus();
    }
  };

  const renderStep = () => {
    stepByPage.set(key, index);
    const step = steps[index];
    if (!step) return;
    clearChildren(stage);
    stage.append(renderCommandPreview(step.command, {
      face: step.simState.face,
      simState: step.simState,
      hostEventId,
      forkTaken: step.forkTaken,
      skipped: step.skipped,
    }));
    const branch = step.branchLabel ? `[${step.branchLabel}] ` : "";
    const skipMark = step.skipped ? " (건너뜀)" : "";
    caption.textContent = `${branch}${commandSummary(step.command)}${skipMark}`;
    contextBody.textContent = caption.textContent;
    position.textContent = `${index + 1}/${steps.length}`;
    const branchExcerpt = step.branchLabel ? ` [${step.branchLabel.slice(0, 60)}${step.branchLabel.length > 60 ? "…" : ""}]` : "";
    status.textContent = `${index + 1}/${steps.length} · ${commandKindLabel(step.command.kind)}${branchExcerpt}${skipMark}`;
    status.dataset.current = String(index + 1);
    status.dataset.total = String(steps.length);
    stage.scrollTop = 0;
    contextBody.scrollTop = 0;
    renderControls();
  };

  const controls = el("div", {
    class: "event-script-live-controls",
    children: [previous, next, restart, playButton, position],
  });

  panel.append(controls, stage, context, status);
  renderStep();
  return panel;
}

export function flattenScript(commands: readonly Command[], hostEventId?: string, mapId?: string): readonly SimulatedStep[] {
  return simulatePageCommands(commands, hostEventId, mapId).steps;
}

/* ---------------------------------------------------------------- 플로우 */

export type EventPageFlowOptions = EventScriptModernViewsOptions & {
  /** 노드를 누르면 목록·스토리와 **같은** 인스펙터를 채운다. 없으면 읽기 전용. */
  readonly onSelect?: (path: number[]) => void;
};

export function renderEventPageFlow(options: EventPageFlowOptions): HTMLElement {
  const { mapId, eventId, page, onSelect } = options;
  const key = auxCompositeKey(mapId, eventId, page.id);
  const panel = el("section", {
    class: "event-page-flow",
    attrs: { "aria-label": "이 페이지 흐름" },
    dataset: { testid: "event-page-flow" },
  });

  if (page.commands.length === 0) {
    panel.append(el("div", {
      class: "empty-hint",
      text: "그릴 명령이 없습니다. 명령을 추가하면 여기에서 갈라지는 모양을 볼 수 있습니다.",
      dataset: { testid: "event-page-flow-empty" },
    }));
    return panel;
  }

  const steps = simulatePageCommands(page.commands, eventId, mapId).steps;
  const branchCount = countFlowBranches(page.commands);
  // 미리보기를 한 번도 열지 않았으면 짚을 단계가 없다 — 그럴 때는 아무것도 강조하지 않는다.
  const storedStep = stepByPage.get(key);
  const currentStep = storedStep === undefined ? undefined : Math.min(storedStep, steps.length - 1);
  const currentPath = currentStep === undefined ? undefined : steps[currentStep]?.path;

  panel.append(el("div", {
    class: "event-page-flow-status",
    dataset: { testid: "event-page-flow-status" },
    children: [
      el("span", { text: `명령 ${steps.length}개 · 분기 ${branchCount}개` }),
      el("span", {
        class: "event-page-flow-current",
        dataset: { testid: "event-page-flow-current" },
        text: currentStep === undefined
          ? "미리보기에서 보던 단계가 여기에 표시됩니다"
          : `미리보기 현재 단계 ${currentStep + 1}/${steps.length}`,
      }),
    ],
  }));

  const body = el("div", { class: "event-page-flow-body", dataset: { testid: "event-flowchart-body" } });
  body.append(flowColumn(page.commands, [], { currentPath, onSelect }));
  panel.append(body);
  return panel;
}

type FlowRenderContext = {
  readonly currentPath?: readonly number[];
  readonly onSelect?: (path: number[]) => void;
};

function samePath(a: readonly number[], b: readonly number[] | undefined): boolean {
  return !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}

function countFlowBranches(commands: readonly Command[]): number {
  let count = 0;
  for (const command of commands) {
    const branches = eventCommandBranches(command);
    count += branches.length;
    for (const branch of branches) count += countFlowBranches(branch.commands);
  }
  return count;
}

// 순차 명령 = 세로 컬럼, 분기 = 가로로 나란한 하위 컬럼.
function flowColumn(
  commands: readonly Command[],
  pathPrefix: readonly number[],
  ctx: FlowRenderContext,
): HTMLElement {
  const column = el("div", { class: "event-flow-column" });
  commands.forEach((command, index) => {
    const path = [...pathPrefix, index];
    column.append(flowNode(command, path, ctx));
    const branches = eventCommandBranches(command);
    if (branches.length > 0) {
      const branchRow = el("div", { class: "event-flow-branches" });
      for (const branch of branches) {
        const cell = el("div", { class: "event-flow-branch" });
        cell.append(el("div", { class: "event-flow-branch-label", text: branch.label }));
        cell.append(
          branch.commands.length > 0
            ? flowColumn(branch.commands, [...path, branch.branchIndex], ctx)
            : el("div", { class: "event-flow-empty", text: "(비어 있음)" })
        );
        branchRow.append(cell);
      }
      column.append(branchRow);
    }
  });
  return column;
}

function flowNode(command: Command, path: readonly number[], ctx: FlowRenderContext): HTMLElement {
  const visual = commandCategoryVisual(command);
  const isCurrent = samePath(path, ctx.currentPath);
  const summary = commandSummary(command);
  const node = el(ctx.onSelect ? "button" : "div", {
    class: `event-flow-node${isCurrent ? " is-current" : ""}`,
    ...(ctx.onSelect
      ? { attrs: { type: "button", title: "누르면 오른쪽에서 고칠 수 있습니다", "aria-label": `${summary}${isCurrent ? " (미리보기 현재 단계)" : ""}` } }
      : {}),
    dataset: {
      category: visual.key,
      testid: `event-flow-node-${command.kind}`,
      cmdPath: JSON.stringify(path),
      ...(isCurrent ? { current: "true" } : {}),
    },
    ...(ctx.onSelect ? { on: { click: () => ctx.onSelect!([...path]) } } : {}),
    children: [
      el("span", { class: "event-flow-node-icon", text: visual.glyph, attrs: { "aria-hidden": "true" } }),
      el("span", { class: "event-flow-node-text", text: truncate(summary, 46) }),
    ],
  });
  if (isCurrent) node.setAttribute("aria-current", "step");
  return node;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
