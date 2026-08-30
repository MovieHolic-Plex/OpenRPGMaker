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
import { simulatePageCommands, type SimulatedStep, type ActiveFace } from "./previewSimulation";

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
  const steps = simulatePageCommands(page.commands, hostEventId).steps;
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

  const renderStep = () => {
    stepByPage.set(key, index);
    const step = steps[index];
    if (!step) return;
    clearChildren(stage);
    const activeFace = trackFace(steps, index, key);
    stage.append(renderCommandPreview(step.command, {
      face: activeFace,
      simState: step.simState,
      hostEventId,
      forkTaken: step.forkTaken,
      skipped: step.skipped,
    }));
    const branch = step.branchLabel ? `[${step.branchLabel}] ` : "";
    const skipMark = step.skipped ? " (건너뜀)" : "";
    caption.textContent = `${branch}${commandSummary(step.command)}${skipMark}`;
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
          if (!panel.isConnected || index >= steps.length - 1) {
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

  panel.append(controls, stage, caption);
  renderStep();
  return panel;
}

const faceCacheByPage = new Map<string, Map<number, ActiveFace | undefined>>();

function trackFace(steps: readonly SimulatedStep[], uptoIndex: number, cacheKey?: string): ActiveFace | undefined {
  if (cacheKey) {
    const cache = faceCacheByPage.get(cacheKey);
    if (cache) {
      const cached = cache.get(uptoIndex);
      if (cached !== undefined || cache.has(uptoIndex)) return cached;
    }
  }
  for (let i = uptoIndex; i >= 0; i--) {
    const step = steps[i];
    if (!step) continue;
    if (step.command.kind === "changeFace" && step.command.resourceId) {
      const face = { resourceId: step.command.resourceId };
      if (cacheKey) {
        if (!faceCacheByPage.has(cacheKey)) faceCacheByPage.set(cacheKey, new Map());
        faceCacheByPage.get(cacheKey)!.set(uptoIndex, face);
      }
      return face;
    }
  }
  if (cacheKey) {
    if (!faceCacheByPage.has(cacheKey)) faceCacheByPage.set(cacheKey, new Map());
    faceCacheByPage.get(cacheKey)!.set(uptoIndex, undefined);
  }
  return undefined;
}

export function invalidateFaceCache(cacheKey: string): void {
  faceCacheByPage.delete(cacheKey);
}

export function flattenScript(commands: readonly Command[]): readonly SimulatedStep[] {
  return simulatePageCommands(commands).steps;
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

  const steps = simulatePageCommands(page.commands, eventId).steps;
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
