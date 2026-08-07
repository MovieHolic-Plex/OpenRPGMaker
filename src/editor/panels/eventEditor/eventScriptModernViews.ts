// [P2] 모던 전용 파생 뷰 2종 — RM2003 보존 원칙 7(기본 접힘 + 명시적 토글) 준수.
//  1) 라이브 미리보기: 페이지 커맨드를 스크립트 순서로 펼쳐 commandPreview 렌더러를
//     스텝 재생(이전/다음/자동)하는 시퀀서. 320x240 런타임을 흉내내는 목업이 아니라
//     기존 프리뷰 렌더러의 재사용이다.
//  2) 플로우차트: 조건 분기/선택지/반복을 노드 그래프로 보여주는 읽기 전용 뷰.
//     데이터 모델은 Command union 그대로 두고(원칙 5) 전부 파생 렌더다.
import { clearChildren, el } from "@/util/dom";
import type { Command, EventPage, MapId } from "@/project/types";
import { auxCompositeKey, bindAuxDetails, isAuxOpenApplying, setAuxOpen, setAuxClosed } from "./auxOpenController";
import { commandCategoryVisual } from "./commandCategoryIcons";
import { renderCommandPreview } from "./commandPreview";
import { commandSummary } from "./commandSummary";
import { simulatePageCommands, branchesOf, type SimulatedStep, type ActiveFace } from "./previewSimulation";

export type EventScriptModernViewsOptions = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
};

const stepByPage = new Map<string, number>();

export function renderEventScriptModernViews(
  optionsOrMapId: EventScriptModernViewsOptions | EventPage | MapId,
  eventIdOrPage?: string | EventPage,
  pageArg?: EventPage
): HTMLElement {
  // ({ mapId, eventId, page }) | (mapId, eventId, page) | (page) 테스트 호환
  let mapId: string;
  let eventId: string;
  let page: EventPage;
  if (typeof optionsOrMapId === "object" && optionsOrMapId !== null && "page" in optionsOrMapId) {
    ({ mapId, eventId, page } = optionsOrMapId as EventScriptModernViewsOptions);
  } else if (typeof optionsOrMapId === "string" && typeof eventIdOrPage === "string" && pageArg) {
    mapId = optionsOrMapId;
    eventId = eventIdOrPage;
    page = pageArg;
  } else {
    page = optionsOrMapId as EventPage;
    mapId = "";
    eventId = "";
  }
  const key = auxCompositeKey(mapId, eventId, page.id);
  const wrap = el("div", { class: "event-script-modern-views" });
  wrap.append(renderLivePreview(key, page, mapId, eventId), renderFlowchart(key, page));
  return wrap;
}

/* ---------------------------------------------------------------- 라이브 미리보기 */

function renderLivePreview(key: string, page: EventPage, _mapId: MapId, eventId: string): HTMLElement {
  const details = el("details", {
    class: "event-script-live-preview",
    dataset: { testid: "event-script-live-preview" },
  }) as HTMLDetailsElement;
  const hostEventId = eventId;
  const simResult = simulatePageCommands(page.commands, hostEventId);
  const steps = simResult.steps;
  let statusText = "empty";
  let statusKind = "empty";
  if (steps.length > 0) {
    statusKind = "ready";
    const first = commandSummary(steps[0]!.command).trim();
    statusText = first.length > 0 && first.length <= 18 ? first : `${steps.length}단계`;
  }
  const summary = el("summary", {
    class: "event-aux-chip-summary",
    children: [
      el("span", { class: "event-aux-chip-icon", attrs: { "aria-hidden": "true" }, text: "▶" }),
      el("span", { class: "event-aux-chip-label", text: "스크립트 둘러보기" }),
      el("span", {
        class: "event-aux-chip-status",
        text: statusText,
        dataset: { testid: "event-preview-chip-status", kind: statusKind },
      }),
    ],
  });
  details.append(summary);
  bindAuxDetails(key, "preview", details);
  details.addEventListener("toggle", () => {
    if (isAuxOpenApplying()) return;
    if (details.open) setAuxOpen(key, "preview");
    else setAuxClosed(key, "preview");
  });

  const body = el("div", { class: "event-script-live-preview-body" });
  body.append(el("div", {
    class: "event-script-preview-disclaimer",
    text: "실제 게임 실행이 아닌 스크립트 둘러보기입니다. 반복은 한 번만 펼치고, 선택지는 모든 분기를 나열하며, 라벨/라벨 이동은 실제 점프를 수행하지 않습니다.",
    dataset: { testid: "event-script-preview-disclaimer" },
  }));
  if (steps.length === 0) {
    body.append(el("div", { class: "empty-hint", text: "둘러볼 명령이 없습니다." }));
    details.append(body);
    return details;
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
      const face = { resourceId: step.command.resourceId, faceIndex: step.command.faceIndex };
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

/* ---------------------------------------------------------------- 플로우차트 */

function renderFlowchart(key: string, page: EventPage): HTMLElement {
  const details = el("details", {
    class: "event-script-flowchart",
    dataset: { testid: "event-script-flowchart" },
  }) as HTMLDetailsElement;
  const nodeCount = countFlowNodes(page.commands);
  const branchCount = countFlowBranches(page.commands);
  // Flow: branch-ish label when branches exist, else node count.
  let statusText = "empty";
  let statusKind = "empty";
  if (nodeCount > 0) {
    statusKind = "ready";
    statusText = branchCount > 0 ? `분기 ${branchCount}` : `${nodeCount}`;
  }
  details.append(
    el("summary", {
      class: "event-aux-chip-summary",
      children: [
        el("span", { class: "event-aux-chip-icon", attrs: { "aria-hidden": "true" }, text: "◎" }),
        el("span", { class: "event-aux-chip-label", text: "플로우" }),
        el("span", {
          class: "event-aux-chip-status",
          text: statusText,
          dataset: { testid: "event-flow-chip-status", kind: statusKind },
        }),
      ],
    })
  );
  bindAuxDetails(key, "flow", details);
  details.addEventListener("toggle", () => {
    if (isAuxOpenApplying()) return;
    if (details.open) setAuxOpen(key, "flow");
    else setAuxClosed(key, "flow");
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

function countFlowNodes(commands: readonly Command[]): number {
  let count = 0;
  for (const command of commands) {
    count += 1;
    for (const branch of branchesOf(command)) {
      count += countFlowNodes(branch.commands);
    }
  }
  return count;
}

function countFlowBranches(commands: readonly Command[]): number {
  let count = 0;
  for (const command of commands) {
    const branches = branchesOf(command);
    count += branches.length;
    for (const branch of branches) count += countFlowBranches(branch.commands);
  }
  return count;
}

// 순차 명령 = 세로 컬럼, 분기 = 가로로 나란한 하위 컬럼.
function flowColumn(commands: readonly Command[]): HTMLElement {
  const column = el("div", { class: "event-flow-column" });
  for (const command of commands) {
    column.append(flowNode(command));
    const branches = branchesOf(command);
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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
