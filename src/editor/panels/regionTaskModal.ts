// 선택 영역 AI 작업 모달/팝오버.
// - 우클릭 메뉴 "이 영역에 AI 작업…"
// - 우클릭 드래그 종료 후 포인터 근처 팝오버 (anchor)
// 지시를 받아 runRegionTask로 넘기고(사각형 하드 스코프), 진행/결과를 표시한다.
// 개발 편의: 헤더 「로그」 작은 버튼 → 감사/툴/하네스 JSON 클립보드 복사.
import type { SessionEvent } from "@/ai/assistantSession";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { subscribePendingRegionApply, type PendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import {
  nextSuggestedRegionCommands,
  regionCommandCategories,
  SUGGESTED_REGION_COMMANDS,
  type SuggestedRegionCommand,
} from "@/editor/regionTask/suggestedCommands";
import { dispatchRegionTaskStatus } from "@/editor/regionTask/regionTaskStatus";
import { suggestRegionCommandsByContext } from "@/editor/regionTask/regionContextSuggestions";
import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { formatRegionTileStatsCompact, summarizeRegionTiles } from "@/editor/regionTask/regionTileStats";
import {
  regionEventChangeLabel,
  summarizeOutsideRegionChanges,
  summarizeRegionEventChanges,
} from "@/editor/regionTask/regionChangeSummary";
import {
  describeChunkPosition,
  groupRegionChanges,
  withChunkLabels,
  type RegionChunk,
} from "@/editor/regionTask/regionChangeGroups";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import {
  loadRecentInstructions,
  pushRecentInstruction,
} from "@/editor/regionTask/recentInstructions";
import {
  describeRegionTaskResult,
  REGION_TASK_MAX_TOOL_CALLS,
  runRegionTask,
  serializeRegionTaskLog,
  type RegionTaskLogExport,
  type RegionTaskResult,
} from "@/editor/regionTask/runRegionTask";
import {
  DIRECT_INTERIOR_PRESETS,
  runDirectInteriorRoomDraft,
  type DirectInteriorPresetId,
  type DirectInteriorRoomDraftRunner,
} from "@/editor/regionTask/runDirectRoomDraft";
import {
  INTERIOR_THEME_MODIFIERS,
  type InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type RegionTaskRunner = (opts: {
  mapId: MapId;
  region: RegionRect;
  instruction: string;
  signal?: AbortSignal;
  onEvent?: (event: SessionEvent) => void;
}) => Promise<RegionTaskResult>;

export type RegionTaskAnchor = {
  readonly x: number;
  readonly y: number;
};

export interface RegionTaskModalOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly initialInstruction?: string;
  readonly autoRun?: boolean;
  /** 화면 좌표(클라이언트). 있으면 중앙 모달 대신 근처 플로팅 팝오버. */
  readonly anchor?: RegionTaskAnchor;
  // 테스트 주입: 기본은 실제 runRegionTask.
  readonly run?: RegionTaskRunner;
  /** 테스트 주입: AI/도구 쿼터를 쓰지 않는 직접 실내 초안 경로. */
  readonly runDirectRoomDraft?: DirectInteriorRoomDraftRunner;
  /** 테스트 주입: 썸네일 렌더러(기본 renderRegionSnapshot 캔버스). */
  readonly renderSnapshot?: (project: Project, map: GameMap, region: RegionRect) => Promise<HTMLElement>;
  /** 테스트 주입: 동적 추천/통계 칩용 project 조회(기본 store.getCurrent). */
  readonly projectForContext?: () => Project;
  /** 테스트 주입: 부분 적용 함수(기본 composePartialProject). UI 테스트용. */
  readonly composePartial?: typeof composePartialProject;
}

/** 툴 인자를 title 툴팁용 문자열로. 순환 참조 등으로 실패하면 빈 문자열. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

let modalRoot: HTMLElement | null = null;
// 현재 열린 모달의 정리 콜백 — 새 모달이 열리거나(closeRegionTaskModal 선호출) 명시적으로
// 닫힐 때 미해소 pending을 discard하고 구독을 해제한다(스펙: 새 영역 작업 시작 시 기존
// pending discard). 이 콜백 내부에서 closeRegionTaskModal을 다시 호출하지 않는다(재귀 방지).
let activeModalCleanup: (() => void) | null = null;

/** 영역 작업 창(모달/팝오버)이 열려 있는가. 캔버스 오버레이(선택 칩)가 겹치지 않게 쓴다. */
export function isRegionTaskModalOpen(): boolean {
  return modalRoot !== null;
}

export const REGION_TASK_MODAL_EVENT = "oprn:region-task-modal";

/** 열림/닫힘을 알린다 — EditScene 이 선택 칩 오버레이를 숨기거나 되살리는 신호. */
function dispatchModalOpenState(open: boolean): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  if (typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent(REGION_TASK_MODAL_EVENT, { detail: { open } }));
    return;
  }
  const event = new Event(REGION_TASK_MODAL_EVENT);
  Object.defineProperty(event, "detail", { configurable: true, value: { open } });
  window.dispatchEvent(event);
}

export function closeRegionTaskModal(): void {
  const wasOpen = modalRoot !== null;
  const cleanup = activeModalCleanup;
  activeModalCleanup = null;
  cleanup?.();
  modalRoot?.remove();
  modalRoot = null;
  if (wasOpen) dispatchModalOpenState(false);
}

export function openRegionTaskModal(options: RegionTaskModalOptions): HTMLElement {
  closeRegionTaskModal();
  const run: RegionTaskRunner = options.run ?? runRegionTask;
  const runDirectRoom = options.runDirectRoomDraft ?? runDirectInteriorRoomDraft;
  const { region } = options;

  const chip = el("span", {
    class: "region-task-chip",
    dataset: { testid: "region-task-chip" },
    children: [
      makeSvgIcon("select"),
      el("span", { text: `(${region.x},${region.y}) ${region.width}×${region.height}` }),
    ],
  });
  // F: 영역 통계 칩 — 현재 타일 분포 컴팩트 표시. 빈 영역이면 숨김.
  const statsText = (() => {
    try {
      const proj = (options.projectForContext ?? (() => store.getCurrent()))();
      const map = proj?.maps?.[options.mapId];
      if (!map) return "";
      return formatRegionTileStatsCompact(summarizeRegionTiles(map, region));
    } catch {
      return "";
    }
  })();
  const statsChip = el("span", {
    class: "region-task-stats-chip" + (statsText ? "" : " hidden"),
    text: statsText,
    dataset: { testid: "region-task-stats-chip" },
  });
  const copyLogButton = el("button", {
    class: "region-task-copy-log",
    text: "로그",
    attrs: {
      type: "button",
      disabled: "",
      title: "영역 작업 감사·툴 로그 JSON 복사 (실행 시 localStorage/DB에도 자동 저장)",
      "aria-label": "영역 작업 로그 복사",
    },
    dataset: { testid: "region-task-copy-log" },
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "region-task-close",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "region-task-close" },
    children: [makeSvgIcon("close")],
    on: { click: () => discardAndClose() },
  });
  // 로그 버튼은 헤더에서 「고급」 안으로 옮겼다 — 초보자에게 첫 화면에 보일 이유가 없다.
  const titleRow = el("div", {
    class: "region-task-title-row",
    children: [el("span", { class: "region-task-title", text: "영역 작업" })],
  });
  const header = el("div", {
    class: "region-task-header",
    children: [titleRow, chip, statsChip, closeButton],
  });

  // E: 컨텍스트 인식 동적 추천 — 영역 주변 인접 타일 분석 기반. 정적 로테이션은 폴백.
  const projectForCtx = options.projectForContext ?? (() => store.getCurrent());
  const suggestions = (() => {
    try {
      return suggestRegionCommandsByContext(projectForCtx(), options.mapId, region, 4);
    } catch {
      return nextSuggestedRegionCommands(4);
    }
  })();
  const textarea = el("textarea", {
    class: "region-task-input",
    attrs: { placeholder: "이 영역에 무엇을 할까요? 예: 침엽수 숲으로 채워줘", rows: "3" },
    dataset: { testid: "region-task-input" },
  }) as HTMLTextAreaElement;
  if (options.initialInstruction) {
    textarea.value = options.initialInstruction;
  } else {
    textarea.setAttribute("placeholder", `이 영역에 무엇을 할까요? 예: ${suggestions[0].instruction}`);
  }
  const makeCommandChip = (command: SuggestedRegionCommand): HTMLElement =>
    el("button", {
      class: "region-task-suggest-chip",
      attrs: { type: "button", title: command.instruction },
      dataset: { testid: `region-suggest-${command.id}` },
      children: [
        makeSvgIcon(command.icon),
        el("span", { class: "region-task-chip-label", text: command.label }),
      ],
      on: {
        click: () => {
          textarea.value = command.instruction;
          textarea.focus();
        },
      },
    });
  const suggestionRow = el("div", {
    class: "region-task-suggestions",
    dataset: { testid: "region-task-suggestions" },
    children: suggestions.map(makeCommandChip),
  });
  // 카테고리 줄 — 로테이션 4개만 보이면 "타일 채우기 도구"로 오해된다. 무엇을 시킬 수 있는지의
  // 범위(NPC·전투·분위기…)를 항상 눈에 두고, 고르면 그 카테고리 명령으로 아래 줄을 갈아 끼운다.
  const categories = regionCommandCategories();
  let activeCategoryId: string | null = null;
  const categoryChips = new Map<string, HTMLElement>();
  const showCategory = (id: string | null): void => {
    // 같은 칩을 다시 누르면 해제 — 문맥 추천(4개)으로 돌아온다.
    activeCategoryId = id;
    for (const [chipId, chip] of categoryChips) chip.classList.toggle("is-active", chipId === id);
    const picked = id === null ? null : categories.find((category) => category.id === id);
    suggestionRow.replaceChildren(
      ...(picked ? picked.commands.map(makeCommandChip) : suggestions.map(makeCommandChip)),
    );
  };
  const categoryRow = el("div", {
    class: "region-task-categories",
    dataset: { testid: "region-task-categories" },
    children: categories.map((category) => {
      const chip = el("button", {
        class: "region-task-category-chip",
        attrs: { type: "button" },
        dataset: { testid: `region-category-${category.id}` },
        children: [
          makeSvgIcon(category.icon),
          el("span", { class: "region-task-chip-label", text: category.label }),
        ],
        on: { click: () => showCategory(activeCategoryId === category.id ? null : category.id) },
      });
      categoryChips.set(category.id, chip);
      return chip;
    }),
  });

  const log = el("div", { class: "region-task-log", dataset: { testid: "region-task-log" } });
  const summary = el("div", { class: "region-task-summary", dataset: { testid: "region-task-summary" } });
  const progressTimeline = el("div", {
    class: "region-task-live-progress",
    dataset: { testid: "region-task-live-progress" },
  });

  const runButton = el("button", {
    class: "region-task-run",
    text: "AI 실행",
    attrs: { type: "button" },
    dataset: { testid: "region-task-run" },
  }) as HTMLButtonElement;
  const cancelButton = el("button", {
    class: "region-task-cancel",
    text: "중단",
    attrs: { type: "button", title: "현재 작업을 중단하고 초안을 버립니다" },
    dataset: { testid: "region-task-cancel" },
  }) as HTMLButtonElement;
  const directPresetSelect = el("select", {
    class: "region-task-direct-select",
    attrs: { "aria-label": "실내 초안 종류", title: "AI 없이 만들 실내 구조" },
    dataset: { testid: "region-task-direct-preset" },
    children: DIRECT_INTERIOR_PRESETS.map((preset) => el("option", {
      text: preset.label,
      attrs: { value: preset.id },
    })),
  }) as HTMLSelectElement;
  directPresetSelect.value = "inn";
  const directModifierSelect = el("select", {
    class: "region-task-direct-select",
    attrs: { "aria-label": "실내 분위기", title: "역할 테마 위에 겹칠 조합형 분위기" },
    dataset: { testid: "region-task-direct-modifier" },
    children: [
      el("option", { text: "기본 분위기", attrs: { value: "" } }),
      ...INTERIOR_THEME_MODIFIERS.map((modifier) => el("option", {
        text: `+ ${modifier}`,
        attrs: { value: modifier },
      })),
    ],
  }) as HTMLSelectElement;
  directModifierSelect.value = "";
  const directRoomButton = el("button", {
    class: "region-task-direct-room",
    text: "AI 없이 실내 초안",
    attrs: { type: "button", title: "도구 쿼터를 쓰지 않고 연결된 실내를 생성" },
    dataset: { testid: "region-task-direct-room" },
  }) as HTMLButtonElement;

  const renderSnapshot = options.renderSnapshot
    // targetWidth 를 기본 140 → 240 으로 키운다. 단일 A/B 미리보기가 결정의 근거이므로 충분한 해상도로 보여 준다.
    ?? ((project: Project, map: GameMap, rect: RegionRect) =>
      renderRegionSnapshot(project, map, rect, { targetWidth: 240 }));
  const compareHost = el("div", { class: "region-task-compare-host" });

  // 검토 단계에서 입력창 대신 보여 줄 지시 요약 — 무엇을 시켰는지는 남되 자리는 한 줄만 쓴다.
  const recapText = el("span", { class: "region-task-recap-text", dataset: { testid: "region-task-recap-text" } });
  const recapEdit = el("button", {
    class: "region-task-recap-edit",
    text: "지시 수정",
    attrs: { type: "button" },
    dataset: { testid: "region-task-recap-edit" },
  });
  const recapRow = el("div", {
    class: "region-task-recap",
    dataset: { testid: "region-task-recap" },
    children: [recapText, recapEdit],
  });

  // ── 단계 상태 ────────────────────────────────────────────────────────────
  // compose: 무엇을 만들지 고른다 / running: 생성 중 / review: 제안을 보고 결정한다.
  // 어떤 요소를 보일지는 CSS 가 data-stage 로 정한다 — JS 가 개별 요소를 숨기지 않는다.
  type RegionTaskStage = "compose" | "running" | "review";
  let stageHost: HTMLElement | null = null;
  let currentStage: RegionTaskStage = "compose";
  const setStage = (stage: RegionTaskStage): void => {
    currentStage = stage;
    if (stageHost?.dataset) stageHost.dataset.stage = stage;
  };

  // ── 「고급」 접이식 영역 ──────────────────────────────────────────────────
  // 로그·부분 적용·스탬프는 초보자가 첫 화면에서 만날 이유가 없다. 다만 한번 펼치면
  // (advancedPinned) 사용자가 명시적으로 연 것이므로 자동으로 닫지 않는다.
  const partialHost = el("div", {
    class: "region-task-partial-host hidden",
    dataset: { testid: "region-task-partial-host" },
  });
  const advancedBody = el("div", { class: "region-task-advanced-body hidden" });
  const advancedToggle = el("button", {
    class: "region-task-advanced-toggle",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: "region-task-advanced-toggle" },
    children: [
      el("span", { class: "region-task-advanced-chevron" }),
      el("span", { class: "region-task-advanced-label", text: "고급 (로그 · 부분 적용 · 스탬프)" }),
    ],
  }) as HTMLButtonElement;
  let advancedPinned = false;
  const setAdvancedOpen = (open: boolean): void => {
    advancedBody.classList.toggle("hidden", !open);
    advancedToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };
  advancedToggle.addEventListener("click", () => {
    const open = advancedBody.classList.contains("hidden");
    advancedPinned = open;
    setAdvancedOpen(open);
    schedulePopoverReposition();
  });

  let activePending: PendingRegionApply | null = null;
  let pendingUnsubscribe: (() => void) | null = null;
  let schedulePopoverReposition: () => void = () => undefined;
  type ActiveExecution = {
    readonly id: number;
    readonly controller: AbortController;
    elapsedTimer: ReturnType<typeof setInterval> | null;
  };
  let disposed = false;
  let running = false;
  let executionGeneration = 0;
  let activeExecution: ActiveExecution | null = null;
  const clearExecutionTimer = (execution: ActiveExecution | null): void => {
    if (!execution?.elapsedTimer) return;
    clearInterval(execution.elapsedTimer);
    execution.elapsedTimer = null;
  };
  const invalidateExecution = (abort: boolean): void => {
    const execution = activeExecution;
    executionGeneration += 1;
    activeExecution = null;
    running = false;
    clearExecutionTimer(execution);
    if (abort && execution && !execution.controller.signal.aborted) execution.controller.abort();
  };
  // id 생략 = AI 실행 세대에 속하지 않는 경로(직접 실내 초안/헤드리스). 이때는 모달이
  // 살아 있는지만 본다. id 를 준 경로는 그 세대가 아직 현재이고 abort 되지 않았는지까지 본다.
  const isCurrentExecution = (id?: number): boolean =>
    !disposed && (id === undefined || (activeExecution?.id === id && !activeExecution.controller.signal.aborted));
  const releaseExecution = (id?: number): void => {
    if (id !== undefined && activeExecution?.id !== id) return;
    clearExecutionTimer(activeExecution);
    activeExecution = null;
    running = false;
  };
  activeModalCleanup = (): void => {
    disposed = true;
    // 신호/세대를 먼저 끊어 late result와 pending subscriber가 DOM을 만지지 못하게 한다.
    invalidateExecution(true);
    pendingUnsubscribe?.();
    pendingUnsubscribe = null;
    if (activePending && !activePending.settled) activePending.discard();
    activePending = null;
  };

  // applied: true=적용, false=버리기, null=외부(캔버스 인라인 툴바 등)에서 settle되어 결과를 알 수 없음.
  const settlePendingUi = (applied: boolean | null): void => {
    if (disposed) return;
    releaseExecution();
    const appliedSummary = `적용됨 — ${activePending?.changedCells ?? 0}칸 타일 · 이벤트 ${activePending?.changedEvents ?? 0}건`;
    setSummary(
      applied === true
        ? appliedSummary
        : applied === false
          ? "버려졌습니다 — 맵은 변경되지 않았습니다"
          : "제안이 처리되었습니다",
    );
    // 적용했으면 할 일이 끝났으므로 창을 닫는다 — 결과는 캔버스에 이미 보이고, 창이 남아
    // 있으면 방금 만든 것을 가린다. 무엇이 반영됐는지는 토스트로 알린다.
    if (applied === true) {
      toast(appliedSummary, "ok");
      // 이 함수는 pending.apply() 직후 동기적으로 불린다. 여기서 바로 닫으면 호출부(버튼
      // 핸들러)가 이미 사라진 DOM 을 계속 만지므로, 현재 콜스택을 빠져나온 뒤 닫는다.
      const close = (): void => closeRegionTaskModal();
      if (typeof globalThis.setTimeout === "function") globalThis.setTimeout(close, 0);
      else close();
      return;
    }
    compareHost.replaceChildren();
    partialHost.replaceChildren();
    partialHost.classList.add("hidden");
    setStage("compose");
    activePending = null;
    // running:false 배지 해제는 pending.apply()/discard() → onSettle(runRegionTask.ts)에서
    // 담당한다 — 캔버스 인라인 툴바 등 이 모달을 거치지 않는 settle 경로도 있어 여기서 중복 발행하지 않는다.
    runButton.disabled = false;
    directRoomButton.disabled = false;
    directPresetSelect.disabled = false;
    directModifierSelect.disabled = false;
    textarea.disabled = false;
    schedulePopoverReposition();
  };

  const renderPendingCompare = async (pending: PendingRegionApply, executionId?: number): Promise<void> => {
    if (!isCurrentExecution(executionId)) return;
    activePending = pending;
    pendingUnsubscribe?.();
    pendingUnsubscribe = null;
    // 이 pending 전용 settle 감시 — 모달 버튼이 아니라 캔버스 인라인 툴바(✓/✗) 등 밖에서
    // settle 되어도(썸네일 await 도중 포함) 모달 UI(요약/버튼 재활성화)가 반영되도록 구독한다.
    let selfSettling = false;
    let settledHandled = false;
    const finalizeSettle = (applied: boolean | null): void => {
      if (settledHandled) return;
      settledHandled = true;
      pendingUnsubscribe?.();
      pendingUnsubscribe = null;
      settlePendingUi(applied);
    };
    pendingUnsubscribe = subscribePendingRegionApply(() => {
      if (!isCurrentExecution(executionId) || selfSettling || !pending.settled) return;
      finalizeSettle(null);
    });

    const map = pending.baseProject.maps[pending.mapId];
    const clippedMap = pending.clippedProject.maps[pending.mapId];

    // A: 부분 적용 — 청크 그룹화. 썸네일보다 먼저 계산한다: "이후" 그림에 변경 칸
    // 하이라이트를 겹치려면 어떤 칸이 바뀌었는지 알아야 한다.
    // groupRegionChanges/labeling 이 예외를 던지면(예: 테스트용 최소 맵) 안전하게 폴백 — 비교 UI는 정상 렌더.
    const compose = options.composePartial ?? composePartialProject;
    let groups: { lower: readonly RegionChunk[]; upper: readonly RegionChunk[]; unchangedCells: number } = { lower: [], upper: [], unchangedCells: 0 };
    let rawGroups = groups;
    try {
      const tileset = map ? pending.baseProject.tilesets[map.tilesetId] : undefined;
      rawGroups = groupRegionChanges(pending.baseProject, pending.clippedProject, pending.mapId, pending.region);
      groups = withChunkLabels(rawGroups, tileset);
    } catch {
      groups = { lower: [], upper: [], unchangedCells: 0 };
      rawGroups = groups;
    }
    const allChunks = [...groups.lower, ...groups.upper];
    const hasChanges = allChunks.length > 0;
    const structuralProposal = pending.roomDrafts.length > 0
      || Object.keys(pending.clippedProject.maps).some((mapId) => !pending.baseProject.maps[mapId]);
    // 청크가 1개뿐이면 "선택 적용"이 "모두 적용"과 완전히 같은 동작이라 고를 이유가 없다.
    // 실내/맵 추가 제안은 타일만 부분 복사하면 문·맵·세션이 분리되므로 아예 제공하지 않는다.
    const partialUseful = allChunks.length > 1 && !structuralProposal;
    const selectedChunkIds = new Set<string>();
    const allChunkIds = allChunks.map((c) => c.id);
    // 기본: 모든 청크 선택(=전체 적용과 동일). 사용자가 일부 해제하면 부분 적용.
    for (const id of allChunkIds) selectedChunkIds.add(id);
    const cellsOf = (ids: Iterable<string>): number => {
      let total = 0;
      const wanted = new Set(ids);
      for (const chunk of allChunks) if (wanted.has(chunk.id)) total += chunk.cells.length;
      return total;
    };
    // 총합은 pending.changedCells 를 쓴다. 청크 셀을 더하면 **레이어별로 따로 세므로**
    // 한 칸이 바닥과 위 양쪽에서 바뀌면 2로 계산된다(실측: 버튼 18칸 vs 적용 요약 12칸).
    // 적용 후 요약("적용됨 — N칸")과 같은 수를 보여야 한다.
    const totalChangedCells = pending.changedCells;

    const figures = el("div", { class: "region-task-compare", dataset: { testid: "region-task-compare" } });

    // 이벤트 변경 목록은 **오버레이보다 먼저** 계산한다 — "이후" 그림 위에 이벤트 마커를
    // 얹으려면 어떤 이벤트가 어디에 놓이는지 알아야 한다. (아래 변경 목록에서도 그대로 쓴다.)
    const eventChanges = (() => {
      try {
        return summarizeRegionEventChanges(pending.baseProject, pending.clippedProject, pending.mapId, pending.region);
      } catch {
        return [];
      }
    })();

    // 변경 칸 하이라이트 — 어디가 바뀌는지 그림만 보고 알 수 있어야 한다.
    // 청크 id → 그 청크가 차지하는 오버레이 칸들. 체크박스 hover/해제 시 이 칸들만 손댄다.
    const overlayCellsByChunk = new Map<string, HTMLElement[]>();
    // 이벤트 id → 미리보기 마커. 변경 목록 행에 마우스를 올리면 이 마커를 강조한다 —
    // 예전엔 캔버스에 작은 파란 점 하나여서 "무엇이 어디에 놓였는지"를 알 수 없었다.
    const eventMarkersById = new Map<string, HTMLElement>();
    const changeOverlay = (): HTMLElement | null => {
      // 타일이 하나도 안 바뀌어도 이벤트만 놓이는 제안(NPC·상자)이 있다 — 그때도 마커를
      // 얹을 격자가 필요하므로 오버레이를 만든다.
      if (!hasChanges && eventChanges.length === 0) return null;
      const { width: rw, height: rh } = pending.region;
      if (rw <= 0 || rh <= 0) return null;
      const chunkAt = new Map<string, string>();
      for (const chunk of allChunks) for (const cell of chunk.cells) chunkAt.set(`${cell.x},${cell.y}`, chunk.id);
      const cells: HTMLElement[] = [];
      for (let cy = 0; cy < rh; cy += 1) {
        for (let cx = 0; cx < rw; cx += 1) {
          const chunkId = chunkAt.get(`${cx},${cy}`);
          const cell = el("span", {
            class: chunkId ? "region-task-change-cell is-changed" : "region-task-change-cell",
          });
          if (chunkId) {
            const bucket = overlayCellsByChunk.get(chunkId);
            if (bucket) bucket.push(cell);
            else overlayCellsByChunk.set(chunkId, [cell]);
          }
          cells.push(cell);
        }
      }
      // 이벤트 마커 — 절대 좌표를 영역 로컬 좌표로 환산해 같은 격자에 배치한다.
      // 영역 밖(clipToRegion 이 되돌리기 전 좌표 등)은 격자에 자리가 없으므로 건너뛴다.
      let eventMarkerIndex = 0;
      for (const change of eventChanges) {
        eventMarkerIndex += 1;
        const markerIndex = eventMarkerIndex;
        const lx = change.x - pending.region.x;
        const ly = change.y - pending.region.y;
        if (lx < 0 || ly < 0 || lx >= rw || ly >= rh) continue;
        const marker = el("span", {
          class: "region-task-event-marker",
          text: String(markerIndex),
          attrs: { style: `grid-column: ${lx + 1}; grid-row: ${ly + 1};` },
          dataset: { markerIndex: String(markerIndex) },
        });
        eventMarkersById.set(change.eventId, marker);
        cells.push(marker);
      }
      return el("div", {
        class: "region-task-change-overlay",
        attrs: { style: `grid-template-columns: repeat(${rw}, 1fr); grid-template-rows: repeat(${rh}, 1fr);`, "aria-hidden": "true" },
        dataset: { testid: "region-task-change-overlay" },
        children: cells,
      });
    };
    const makeFigure = async (
      label: string,
      testid: string,
      project: Project,
      figureMap: GameMap | undefined,
      overlay: HTMLElement | null,
    ): Promise<HTMLElement> => {
      const body = el("div", { class: "region-task-compare-canvas", dataset: { testid } });
      if (figureMap) {
        try {
          const canvas = await renderSnapshot(project, figureMap, pending.region);
          // 클릭 시 2배 확대 토글
          canvas.addEventListener?.("click", () => body.classList.toggle("is-zoomed"));
          body.append(canvas);
          if (overlay) body.append(overlay);
        } catch {
          body.append(el("span", { class: "region-task-compare-fallback", text: "미리보기 실패" }));
        }
      }
      return el("figure", {
        class: "region-task-compare-figure",
        children: [body, el("figcaption", { text: label })],
      });
    };
    const overlay = changeOverlay();
    const beforeFigure = await makeFigure("이전", "region-task-before", pending.baseProject, map, null);
    if (!isCurrentExecution(executionId)) return;
    const afterFigure = await makeFigure("이후", "region-task-after", pending.clippedProject, clippedMap, overlay);
    if (!isCurrentExecution(executionId)) return;

    let currentAbView: "before" | "after" = "after";
    const previewWrapper = el("div", {
      class: "region-task-preview",
      dataset: { testid: "region-task-preview", abView: currentAbView },
    });

    const abBeforeBtn = el("button", {
      class: "region-task-preview-ab-btn",
      text: "이전",
      attrs: { type: "button" },
      dataset: { testid: "region-task-preview-ab-before" },
    }) as HTMLButtonElement;

    const abAfterBtn = el("button", {
      class: "region-task-preview-ab-btn is-active",
      text: "이후",
      attrs: { type: "button" },
      dataset: { testid: "region-task-preview-ab-after" },
    }) as HTMLButtonElement;

    const setAbView = (view: "before" | "after"): void => {
      currentAbView = view;
      previewWrapper.dataset.abView = view;
      abBeforeBtn.classList.toggle("is-active", view === "before");
      abAfterBtn.classList.toggle("is-active", view === "after");
    };

    abBeforeBtn.addEventListener("click", () => setAbView("before"));
    abAfterBtn.addEventListener("click", () => setAbView("after"));

    const abToggle = el("div", {
      class: "region-task-preview-ab-toggle",
      children: [abBeforeBtn, abAfterBtn],
    });

    const previewStage = el("div", {
      class: "region-task-preview-stage",
      children: [beforeFigure, afterFigure],
    });

    previewWrapper.append(abToggle, previewStage);
    figures.append(previewWrapper);
    // 썸네일 렌더 도중 이미 밖에서(캔버스 등) settle 됐다면 — 구독이 이미 처리했으므로
    // 지금 와서 apply/discard 버튼이 있는 비교 UI를 새로 그리지 않는다.
    if (pending.settled || !isCurrentExecution(executionId)) return;

    const partialApplyButton = el("button", {
      class: "region-task-partial-apply",
      text: `선택 적용`,
      attrs: { type: "button", title: "선택한 구역만 적용" },
      dataset: { testid: "region-task-partial-apply" },
    }) as HTMLButtonElement;
    partialApplyButton.addEventListener("click", () => {
      if (!isCurrentExecution(executionId)) return;
      const ids = Array.from(selectedChunkIds);
      if (ids.length === 0) return;
      selfSettling = true;
      const outcome = ids.length === allChunkIds.length
        ? pending.apply()
        : pending.applyProject(
          compose({
            base: pending.baseProject,
            clipped: pending.clippedProject,
            mapId: pending.mapId,
            region: pending.region,
            selectedChunkIds: ids,
            groups: rawGroups,
          }),
        );
      if (!outcome.ok) {
        selfSettling = false;
        setSummary(outcome.error ?? "적용 안전 검사를 통과하지 못했습니다.");
        schedulePopoverReposition();
        return;
      }
      finalizeSettle(true);
    });

    const applyButton = el("button", {
      class: "region-task-apply",
      text: totalChangedCells > 0 ? `적용 · ${totalChangedCells}칸` : "적용",
      attrs: { type: "button" },
      dataset: { testid: "region-task-apply" },
      on: { click: () => {
        if (!isCurrentExecution(executionId)) return;
        selfSettling = true;
        const outcome = pending.apply();
        if (!outcome.ok) {
          selfSettling = false;
          setSummary(outcome.error ?? "적용 안전 검사를 통과하지 못했습니다.");
          schedulePopoverReposition();
          return;
        }
        finalizeSettle(true);
      } },
    });
    // "다시 만들기" — 같은 지시로 재실행. 마음에 안 드는 결과를 버리고 다시 뽑는 흐름이
    // 버리기→입력창 찾기→실행 3단계였던 것을 1단계로 줄인다.
    const retryButton = el("button", {
      class: "region-task-retry",
      attrs: { type: "button", title: "같은 지시로 다시 생성" },
      dataset: { testid: "region-task-retry" },
      children: [
        makeSvgIcon("undo"),
        el("span", { class: "region-task-action-label", text: "다시 만들기" }),
      ],
      on: {
        click: () => {
          if (!isCurrentExecution(executionId)) return;
          selfSettling = true;
          pending.discard();
          finalizeSettle(false);
          if (lastRunMode === "direct") void executeDirectRoom();
          else void execute();
        },
      },
    });
    const discardButton = el("button", {
      class: "region-task-discard",
      text: "버리기",
      attrs: { type: "button" },
      dataset: { testid: "region-task-discard" },
      on: { click: () => {
        if (!isCurrentExecution(executionId)) return;
        selfSettling = true;
        pending.discard();
        finalizeSettle(false);
      } },
    });

    // 청크 트리 — 각 청크 체크박스. 토글 시 부분 적용 버튼 라벨/활성 갱신.
    // 라벨은 **칸 수**다. 예전엔 선택된 청크 개수를 "N칸"으로 찍어서 37칸짜리 하나를
    // 고르면 "선택 1칸 적용"이라고 표시했다 — 정반대로 읽히는 오표기였다.
    const updatePartialState = (): void => {
      const selectedCells = cellsOf(selectedChunkIds);
      const partial = selectedChunkIds.size < allChunkIds.length;
      partialApplyButton.textContent =
        selectedCells === 0 ? "선택 적용" : `선택한 ${selectedCells}칸만 적용`;
      partialApplyButton.disabled = selectedCells === 0;
      // 일부만 선택했을 때만 "선택 적용"이 의미가 있다 — 전부 선택이면 아래 「적용」과 동일.
      partialApplyButton.classList.toggle("hidden", !partial);
      // 체크를 푼 덩어리는 미리보기에서도 빠진 것으로 보여야 한다 — 어느 칸을 버리는지가 보인다.
      for (const [id, cells] of overlayCellsByChunk) {
        const excluded = !selectedChunkIds.has(id);
        for (const cell of cells) cell.classList.toggle("is-excluded", excluded);
      }
    };
    // 같은 타일로 된 덩어리가 여럿이면 라벨이 완전히 겹친다("Stone floor(3칸)" 두 줄).
    // 겹치는 것들에만 위치를 붙인다 — 안 겹치는데 붙이면 그냥 소음이다.
    // 겹치는 것은 **이름**이지 칸 수가 아니다 — chunk.label 은 "(N칸)" 까지 포함하므로
    // 그걸로 세면 "Stone floor(3칸)" 과 "Stone floor(1칸)" 이 서로 다른 것으로 잡힌다.
    // 라벨의 출처인 (레이어, 대표 타일)로 센다.
    const nameKey = (chunk: RegionChunk): string => `${chunk.layer}:${chunk.dominantTile}`;
    const labelCounts = new Map<string, number>();
    for (const chunk of allChunks) labelCounts.set(nameKey(chunk), (labelCounts.get(nameKey(chunk)) ?? 0) + 1);
    const chunkText = (chunk: RegionChunk): string => {
      if ((labelCounts.get(nameKey(chunk)) ?? 0) < 2) return chunk.label;
      const where = describeChunkPosition(chunk, pending.region);
      return where ? `${chunk.label} · ${where}` : chunk.label;
    };

    const setChunkHighlight = (chunkId: string | null): void => {
      for (const [id, cells] of overlayCellsByChunk) {
        for (const cell of cells) cell.classList.toggle("is-focus", chunkId === id);
      }
      // 하나를 지목하는 동안 나머지는 물러나게 — 어느 덩어리인지가 한눈에 보인다.
      overlay?.classList.toggle("is-isolating", chunkId !== null);
    };

    // 변경 목록의 이벤트 행과 미리보기 마커를 잇는다. setChunkHighlight 와 같은 모양:
    // 지목된 것만 살리고 나머지는 물러난다.
    const setEventHighlight = (eventId: string | null): void => {
      for (const [id, marker] of eventMarkersById) {
        marker.classList.toggle("is-focus", eventId === id);
      }
      overlay?.classList.toggle("is-isolating", eventId !== null);
    };

    const makeChunkCheckbox = (chunk: RegionChunk): HTMLElement => {
      const cb = el("input", {
        class: "region-task-chunk-cb",
        attrs: { type: "checkbox" },
        dataset: { testid: `region-task-chunk-${chunk.id}` },
      }) as HTMLInputElement;
      cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) selectedChunkIds.add(chunk.id);
        else selectedChunkIds.delete(chunk.id);
        updatePartialState();
      });
      const label = el("label", {
        class: "region-task-chunk-label",
        attrs: { title: `${chunkText(chunk)} — 마우스를 올리면 미리보기에서 이 덩어리가 표시됩니다` },
        dataset: { testid: `region-task-chunk-label-${chunk.id}` },
        children: [cb, document.createTextNode(` ${chunkText(chunk)}`)],
      });
      // 마우스가 없어도 되게 포커스에도 같은 강조를 건다(체크박스 탭 이동).
      label.addEventListener("mouseenter", () => setChunkHighlight(chunk.id));
      label.addEventListener("mouseleave", () => setChunkHighlight(null));
      cb.addEventListener("focus", () => setChunkHighlight(chunk.id));
      cb.addEventListener("blur", () => setChunkHighlight(null));
      return label;
    };
    const chunkTree = el("div", {
      class: "region-task-chunk-tree" + (hasChanges ? "" : " hidden"),
      dataset: { testid: "region-task-chunk-tree" },
      children: hasChanges ? [
        el("div", { class: "region-task-chunk-layer-title", text: "적용할 구역을 고르세요" }),
        // "하위/상위" 는 내부 레이어 이름이었다 — 무엇이 놓이는 자리인지로 바꿨다.
        ...(groups.lower.length > 0 ? [
          el("div", { class: "region-task-chunk-layer", children: [
            el("span", { class: "region-task-chunk-layer-name", text: "바닥(지형)" }),
            ...groups.lower.map(makeChunkCheckbox),
          ] }),
        ] : []),
        ...(groups.upper.length > 0 ? [
          el("div", { class: "region-task-chunk-layer", children: [
            el("span", { class: "region-task-chunk-layer-name", text: "위(사물)" }),
            ...groups.upper.map(makeChunkCheckbox),
          ] }),
        ] : []),
      ] : [],
    });
    updatePartialState();

    // 부분 적용은 「고급」 안으로 — 구조 변경은 타일만 떼어내면 연결이 끊기므로 숨긴다.
    // 일반 타일 제안은 기존 계약대로 청크가 하나여도 DOM은 유지하고 고급 영역만 접는다.
    if (structuralProposal) {
      partialHost.replaceChildren();
      partialHost.classList.add("hidden");
    } else {
      partialHost.replaceChildren(chunkTree, partialApplyButton);
      partialHost.classList.toggle("hidden", !partialUseful);
    }

    // ── 변경 목록 — 타일 밖의 변경을 같은 승인 화면에 세운다 ─────────────────
    // 예전에는 미리보기(타일 스냅샷)와 "이벤트 N건" 숫자뿐이라, NPC·상자·조명을 놓아도
    // 무엇이 반영되는지 알 수 없었다. 영역 밖 변경은 아예 보이지 않았다.
    const outsideChanges = (() => {
      try {
        return summarizeOutsideRegionChanges(pending.baseProject, pending.clippedProject, pending.mapId);
      } catch {
        return [];
      }
    })();

    // 목록은 **타일 밖 변경이 있을 때만** 띄운다. 타일 한 줄만 있으면 「적용 · N칸」 버튼과
    // 같은 말을 두 번 하는 셈이라 소음이다.
    const hasNonTileChanges = eventChanges.length > 0 || outsideChanges.length > 0;
    // 목록이 항목별로 세어 주므로 버튼은 단순히 「적용」으로 둔다. 타일만 바뀔 때만 칸 수를
    // 버튼에 남긴다 — 그때는 목록이 없어서 버튼이 유일한 수량 표시다.
    if (hasNonTileChanges) applyButton.textContent = "적용";
    const changeRows: HTMLElement[] = [];
    if (hasNonTileChanges && totalChangedCells > 0) {
      changeRows.push(el("div", {
        class: "region-task-change-row",
        dataset: { testid: "region-task-change-row-tiles" },
        children: [
          el("span", { class: "region-task-change-icon", children: [makeSvgIcon("tile")] }),
          el("span", { class: "region-task-change-text", text: `타일 ${totalChangedCells}칸` }),
        ],
      }));
    }
    for (const change of eventChanges) {
      const row = el("div", {
        class: "region-task-change-row",
        attrs: { title: "마우스를 올리면 미리보기에서 이 위치가 표시됩니다", tabindex: "0" },
        dataset: { testid: `region-task-change-row-event-${change.eventId}` },
        children: [
          el("span", { class: "region-task-change-icon", children: [makeSvgIcon(change.icon)] }),
          el("span", { class: "region-task-change-text", text: regionEventChangeLabel(change) }),
        ],
      });
      // 마우스가 없어도 되게 포커스에도 같은 강조를 건다(청크 체크박스와 같은 규칙).
      row.addEventListener("mouseenter", () => setEventHighlight(change.eventId));
      row.addEventListener("mouseleave", () => setEventHighlight(null));
      row.addEventListener("focus", () => setEventHighlight(change.eventId));
      row.addEventListener("blur", () => setEventHighlight(null));
      changeRows.push(row);
    }
    for (const change of outsideChanges) {
      changeRows.push(el("div", {
        class: "region-task-change-row is-outside",
        attrs: { title: "이 변경은 선택한 영역 밖입니다 — 적용하면 프로젝트 전체에 반영됩니다" },
        dataset: { testid: `region-task-change-row-outside-${change.kind}` },
        children: [
          el("span", { class: "region-task-change-icon", children: [makeSvgIcon("warning")] }),
          el("span", { class: "region-task-change-text", text: `${change.label} · 영역 밖` }),
        ],
      }));
    }
    const changeList = el("div", {
      class: "region-task-change-list" + (changeRows.length > 0 ? "" : " hidden"),
      dataset: { testid: "region-task-change-list" },
      children: changeRows,
    });

    const review = pending.report;
    const timeline = el("div", {
      class: "region-task-checkpoint-timeline",
      dataset: { testid: "region-task-checkpoint-timeline" },
      children: (review?.checkpoints ?? []).map((checkpoint) => el("div", {
        class: `region-task-checkpoint is-${checkpoint.status}`,
        attrs: { title: checkpoint.detail },
        children: [
          el("span", {
            class: "region-task-checkpoint-dot",
            children: [makeSvgIcon(checkpoint.status === "done" ? "check" : "warning")],
          }),
          el("span", { text: checkpoint.label }),
        ],
      })),
    });
    const metrics = review?.metrics;
    const metricsRow = el("div", {
      class: "region-task-review-metrics" + (metrics ? "" : " hidden"),
      dataset: { testid: "region-task-review-metrics" },
      text: metrics
        ? `변경 ${metrics.changedCells}칸 · 이벤트 ${metrics.changedEvents} · 통행 ${metrics.passableChangedCells}칸 · 수리 ${metrics.deterministicRepairs} · 목표 ${metrics.reachableObjectives ?? 0}개 도달${(metrics.unreachableObjectives ?? 0) > 0 ? `/${metrics.unreachableObjectives} 차단` : ""} · 조합 ${metrics.compositionScore ?? 100}점 · NPC 일정 ${metrics.scheduledNpcs}명 · 시간 ${metrics.timeSystemEnabled ? "켜짐" : "꺼짐"}${metrics.roomScoreAverage === null ? "" : ` · 방 점수 ${metrics.roomScoreAverage}`}`
        : "",
    });
    const issueRows = (review?.issues ?? []).map((issue, index) => el("div", {
      class: `region-task-review-issue is-${issue.severity}`,
      dataset: { testid: `region-task-review-issue-${index}` },
      text: `${issue.severity === "error" ? "차단" : issue.repaired ? "수리" : "주의"} · ${issue.message}${issue.mapId ? ` [${issue.mapId}${issue.x === undefined ? "" : ` ${issue.x},${issue.y}`}]` : ""}`,
    }));
    const issuesHost = el("div", {
      class: "region-task-review-issues" + (issueRows.length ? "" : " is-clear"),
      dataset: { testid: "region-task-review-issues" },
      children: issueRows.length ? issueRows : [el("div", { class: "region-task-review-clear", text: "플레이 가능성 검사 통과" })],
    });
    const blockerHost = el("div", {
      class: "region-task-blockers" + (pending.blockers.length ? "" : " hidden"),
      dataset: { testid: "region-task-blockers" },
      children: pending.blockers.map((reason) => el("div", { text: `적용 차단 · ${reason}` })),
    });
    const scheduleDecisionRequired = (review?.issues ?? []).some(
      (issue) => issue.code === "npc-schedule-time-disabled" && issue.severity === "error",
    );
    const npcScheduleDecision = el("div", {
      class: "region-task-npc-decision" + (scheduleDecisionRequired ? "" : " hidden"),
      dataset: { testid: "region-task-npc-decision" },
      children: scheduleDecisionRequired ? [
        el("div", { class: "region-task-npc-decision-title", text: "NPC 일정 실행 방식을 선택하세요" }),
        el("div", { class: "region-task-npc-decision-help", text: "시간을 켜면 일정대로 이동하고, 고정하면 새 일정을 제거해 현재 위치를 유지합니다." }),
        el("div", {
          class: "region-task-npc-decision-actions",
          children: [
            el("button", {
              text: "시간 시스템 켜기",
              attrs: { type: "button" },
              dataset: { testid: "region-task-npc-enable-time" },
              on: { click: () => {
                pending.resolveNpcSchedules("enable-time");
                setSummary("시간 시스템을 켰습니다. 안전 검사를 다시 실행했습니다.");
                void renderPendingCompare(pending);
              } },
            }),
            el("button", {
              text: "NPC 현재 위치에 고정",
              attrs: { type: "button" },
              dataset: { testid: "region-task-npc-keep-fixed" },
              on: { click: () => {
                pending.resolveNpcSchedules("keep-fixed");
                setSummary("새 NPC 일정을 제거하고 현재 위치에 고정했습니다.");
                void renderPendingCompare(pending);
              } },
            }),
            el("button", {
              text: "제안 취소",
              attrs: { type: "button" },
              dataset: { testid: "region-task-npc-cancel" },
              on: { click: () => {
                selfSettling = true;
                pending.discard();
                finalizeSettle(false);
              } },
            }),
          ],
        }),
      ] : [],
    });

    const roomSeedByKey = new Map<string, number>();
    const roomRows: HTMLElement[] = [];
    const checkpointPreviewHost = el("div", {
      class: "region-task-room-checkpoint-preview hidden",
      dataset: { testid: "region-task-room-checkpoint-preview" },
    });
    let checkpointPreviewVersion = 0;
    const checkpointButtons: HTMLButtonElement[] = [];
    const defaultCheckpointPreview: { run?: () => Promise<void> } = {};
    const showCheckpointPreview = async (
      draftMapId: string,
      checkpoint: { readonly layer: string; readonly summary: string; readonly mapSnapshot?: GameMap },
      button: HTMLButtonElement,
      latest: boolean,
    ): Promise<void> => {
      const snapshot = checkpoint.mapSnapshot;
      if (!snapshot) return;
      const version = ++checkpointPreviewVersion;
      for (const candidate of checkpointButtons) candidate.classList.toggle("is-selected", candidate === button);
      checkpointPreviewHost.classList.remove("hidden");
      checkpointPreviewHost.replaceChildren(el("span", { text: `${checkpoint.layer} 미리보기 준비 중…` }));
      const previewProject = structuredClone(pending.clippedProject);
      previewProject.maps[draftMapId] = structuredClone(snapshot);
      try {
        const node = await renderSnapshot(previewProject, snapshot, { x: 0, y: 0, width: snapshot.width, height: snapshot.height });
        if (version !== checkpointPreviewVersion) return;
        checkpointPreviewHost.replaceChildren(
          el("div", {
            class: "region-task-room-checkpoint-caption",
            text: `${latest ? "완성 실내 미리보기" : "레이어 미리보기"} · ${checkpoint.layer} · ${checkpoint.summary}`,
          }),
          node,
        );
        schedulePopoverReposition();
      } catch {
        if (version !== checkpointPreviewVersion) return;
        checkpointPreviewHost.replaceChildren(el("span", { text: "레이어 미리보기에 실패했습니다." }));
      }
    };
    for (const draft of pending.roomDrafts) {
      const previewable = draft.checkpoints.filter((checkpoint) => checkpoint.mapSnapshot);
      if (previewable.length > 0) {
        const buttons = previewable.map((checkpoint, index) => {
          const latest = index === previewable.length - 1;
          const button = el("button", {
            class: `region-task-room-checkpoint is-${checkpoint.state}`,
            text: `${checkpoint.index}. ${checkpoint.layer}`,
            attrs: { type: "button", title: checkpoint.summary },
            dataset: { testid: `region-task-room-checkpoint-${checkpoint.index}` },
          }) as HTMLButtonElement;
          checkpointButtons.push(button);
          button.addEventListener("click", () => void showCheckpointPreview(draft.mapId, checkpoint, button, latest));
          if (latest) defaultCheckpointPreview.run = () => showCheckpointPreview(draft.mapId, checkpoint, button, true);
          return button;
        });
        roomRows.push(el("div", {
          class: "region-task-room-checkpoints",
          children: [
            el("span", { class: "region-task-room-name", text: `${draft.mapId} 진행 스냅샷` }),
            ...buttons,
          ],
        }));
      }
      for (const room of draft.rooms) {
        const key = `${draft.sessionId}:${room.id}`;
        const nextSeed = draft.checkpoints.filter((checkpoint) => checkpoint.layer === `room:${room.id}`).length + 1;
        roomSeedByKey.set(key, nextSeed);
        const lockButton = el("button", {
          class: "region-task-room-lock",
          text: room.locked ? "잠금 해제" : "방 잠금",
          attrs: { type: "button" },
          dataset: { testid: `region-task-room-lock-${room.id}` },
        }) as HTMLButtonElement;
        const rerollButton = el("button", {
          class: "region-task-room-reroll",
          text: `방만 재생성 · seed ${nextSeed}`,
          attrs: { type: "button" },
          dataset: { testid: `region-task-room-reroll-${room.id}` },
        }) as HTMLButtonElement;
        let locked = room.locked;
        lockButton.addEventListener("click", () => {
          locked = !locked;
          pending.setRoomLocked(draft.sessionId, room.id, locked);
          lockButton.textContent = locked ? "잠금 해제" : "방 잠금";
          rerollButton.disabled = locked;
        });
        rerollButton.disabled = locked;
        rerollButton.addEventListener("click", () => {
          const seed = roomSeedByKey.get(key) ?? 1;
          try {
            const outcome = pending.rerollRoom(draft.sessionId, room.id, seed);
            roomSeedByKey.set(key, seed + 1);
            rerollButton.textContent = `방만 재생성 · seed ${seed + 1}`;
            setSummary(outcome.ok ? `${room.id} 방만 seed ${seed}로 재생성했습니다.` : `${room.id} 재생성 후 이슈를 확인하세요.`);
            void renderPendingCompare(pending);
          } catch (cause) {
            setSummary(cause instanceof Error ? cause.message : String(cause));
          }
        });
        roomRows.push(el("div", {
          class: "region-task-room-row",
          children: [
            el("span", {
              class: "region-task-room-name",
              text: `${room.id} · ${room.theme}${room.modifiers.length ? ` + ${room.modifiers.join("+")}` : ""}`,
            }),
            lockButton,
            rerollButton,
          ],
        }));
      }
    }
    const roomsHost = el("div", {
      class: "region-task-room-controls" + (roomRows.length ? "" : " hidden"),
      dataset: { testid: "region-task-room-controls" },
      children: roomRows.length ? [
        el("div", { class: "region-task-room-title", text: "완성 실내 미리보기 · 방별 제어" }),
        ...roomRows,
        checkpointPreviewHost,
      ] : [],
    });

    const reviewCard = el("div", {
      class: "region-task-review-card",
      children: [timeline, metricsRow, blockerHost, npcScheduleDecision, issuesHost, roomsHost],
    });

    compareHost.replaceChildren(
      reviewCard,
      figures,
      changeList,
      el("div", {
        class: "region-task-compare-actions",
        dataset: { testid: "region-task-compare-actions" },
        children: [applyButton, retryButton, discardButton],
      }),
    );
    setStage("review");
    // 결과가 나오면 로그는 접는다 — 결정에 필요한 건 미리보기와 변경 칸 수다.
    if (!advancedPinned) setAdvancedOpen(false);
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true, phase: "pending" });
    if (defaultCheckpointPreview.run) await defaultCheckpointPreview.run();
    schedulePopoverReposition();
  };

  let lastRunMode: "ai" | "direct" = "ai";
  let lastLog: RegionTaskLogExport | undefined;
  // 복사 버튼 라벨 — 실행 후에는 툴 호출 수를 함께 보여 준다("복사됨" 후 여기로 되돌린다).
  let copyLogLabel = "로그";
  const setSummary = (text: string): void => {
    summary.textContent = text;
  };
  // detail: 전체 인자 JSON 등 사람이 읽을 필요 없는 부속 정보 — 화면에 찍지 않고 title 로만 단다.
  const appendLog = (text: string, className = "region-task-log-line", detail?: string): void => {
    if (!text.trim()) return;
    const line = el("div", { class: className, text });
    if (detail) line.setAttribute("title", detail);
    log.append(line);
    while (log.childNodes.length > 40) log.firstChild?.remove();
    log.scrollTop = log.scrollHeight;
  };
  const setCopyEnabled = (enabled: boolean): void => {
    // fakeDom 은 removeAttribute 가 없을 수 있어 disabled 프로퍼티 + setAttribute 만 사용.
    copyLogButton.disabled = !enabled;
    if (enabled) {
      if ("attrs" in copyLogButton && copyLogButton.attrs && typeof copyLogButton.attrs === "object") {
        delete (copyLogButton.attrs as Record<string, string>).disabled;
      } else if (typeof copyLogButton.removeAttribute === "function") {
        copyLogButton.removeAttribute("disabled");
      }
      copyLogButton.classList?.add?.("is-ready");
    } else {
      copyLogButton.setAttribute("disabled", "");
      copyLogButton.classList?.remove?.("is-ready");
    }
  };

  const copyLastLog = async (): Promise<void> => {
    if (!lastLog) {
      toast("복사할 영역 작업 로그가 없습니다. 먼저 실행하세요.", "error");
      return;
    }
    const json = serializeRegionTaskLog(lastLog);
    const ok = await copyTextToClipboard(json);
    if (ok) {
      copyLogButton.textContent = "복사됨";
      toast("로그 복사 · 활동 DB에도 자동 저장됨 (window.__oprnAiActivityLog)", "ok");
      const resetLabel = (): void => {
        if (copyLogButton.isConnected) copyLogButton.textContent = copyLogLabel;
      };
      if (typeof globalThis.setTimeout === "function") globalThis.setTimeout(resetLabel, 1200);
      else resetLabel();
    } else {
      toast("클립보드 복사에 실패했습니다.", "error");
    }
  };

  const execute = async (): Promise<void> => {
    if (running) return;
    const instruction = textarea.value.trim();
    if (!instruction) {
      setSummary("지시 내용을 입력하세요.");
      textarea.focus();
      return;
    }
    // 검토 중 단축키로 다시 실행하는 기존 흐름도 한 소유자만 남도록 먼저 해소한다.
    if (activePending && !activePending.settled) activePending.discard();
    if (activeExecution) invalidateExecution(true);

    const executionId = ++executionGeneration;
    const controller = new AbortController();
    const execution: ActiveExecution = { id: executionId, controller, elapsedTimer: null };
    activeExecution = execution;
    running = true;
    lastRunMode = "ai";
    const startedAt = Date.now();
    let progressMilestone = "영역을 살펴보는 중";
    // 스트리밍으로 이미 찍은 어시스턴트 문단을 결과에서 또 찍지 않기 위한 플래그.
    let sawAssistantMessage = false;
    let toolCount = 0;
    let hadError = false;
    const renderProgress = (): void => {
      if (!isCurrentExecution(executionId)) return;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const toolProgress = toolCount > 0 ? ` · 도구 ${toolCount}/${REGION_TASK_MAX_TOOL_CALLS}` : "";
      setSummary(`${progressMilestone}${toolProgress} · ${elapsedSeconds}초`);
    };

    setStage("running");
    runButton.disabled = true;
    directRoomButton.disabled = true;
    directPresetSelect.disabled = true;
    directModifierSelect.disabled = true;
    textarea.disabled = true;
    setCopyEnabled(false);
    copyLogLabel = "로그";
    copyLogButton.textContent = copyLogLabel;
    recapText.textContent = instruction;
    lastLog = undefined;
    log.replaceChildren();
    progressTimeline.replaceChildren(el("span", { class: "is-active", text: "1. 초안 생성" }));
    renderProgress();
    execution.elapsedTimer = setInterval(renderProgress, 1000);
    appendLog(`지시: ${instruction}`);
    appendLog(`영역: (${region.x},${region.y}) ${region.width}×${region.height}`);
    const onEvent = (event: SessionEvent): void => {
      if (!isCurrentExecution(executionId)) return;
      if (event.type === "status") appendLog(event.text);
      else if (event.type === "tool_call") {
        const ok = event.result.ok ? "✓" : "✗";
        // 인자 JSON 은 120자에서 잘리면 중괄호가 깨진 채로 보였다 — 이제 title 로만 붙인다.
        appendLog(
          `${ok} ${event.name}${event.result.summary ? ` — ${event.result.summary}` : ""}`,
          event.result.ok ? "region-task-log-line" : "region-task-log-line is-error",
          safeJson(event.args),
        );
        toolCount += 1;
        progressTimeline.append(el("span", { text: `${toolCount + 1}. ${event.name}` }));
        while (progressTimeline.childNodes.length > 6) progressTimeline.firstChild?.remove();
        progressMilestone = "변경안을 만드는 중";
        renderProgress();
      } else if (event.type === "assistant_message") {
        sawAssistantMessage = true;
        progressMilestone = "결과를 정리하는 중";
        appendLog(event.content.slice(0, 280), "region-task-log-line is-assistant");
        renderProgress();
      } else if (event.type === "phase") {
        progressMilestone = event.value === "plan"
          ? "요청을 이해하는 중"
          : event.value === "execute"
            ? "변경안을 만드는 중"
            : "결과를 확인하는 중";
        renderProgress();
      }
    };
    try {
      const result = await run({
        mapId: options.mapId,
        region,
        instruction,
        signal: controller.signal,
        onEvent,
      });
      if (!isCurrentExecution(executionId)) {
        if (result.pending && !result.pending.settled) result.pending.discard();
        return;
      }
      setSummary(describeRegionTaskResult(result));
      // F: 성공적 실행 시 지시어를 최근 목록에 기록(자동완성 소스).
      if (result.ok) pushRecentInstruction(instruction);
      if (result.pending && !result.pending.settled) {
        progressTimeline.append(el("span", { class: result.pending.blockers.length ? "is-blocked" : "is-done", text: result.pending.blockers.length ? "검사 차단" : "검사 완료 · 승인 대기" }));
        progressMilestone = "미리보기를 준비하는 중";
        renderProgress();
        await renderPendingCompare(result.pending, executionId);
        if (!isCurrentExecution(executionId)) return;
        setSummary(describeRegionTaskResult(result));
      }
      lastLog = result.log;
      if (result.log) {
        // "로그 준비 · 툴 N · audit M" 을 로그 줄로 찍던 것을 버튼 라벨로 옮겼다 —
        // 사용자용 로그에 개발자 계측 문자열이 섞이지 않게.
        setCopyEnabled(true);
        copyLogLabel = `로그 · 툴 ${result.log.toolCalls.length}`;
        copyLogButton.textContent = copyLogLabel;
      }
      if (result.error) {
        hadError = true;
        appendLog(`오류: ${result.error}`, "region-task-log-line is-error");
      }
      // 스트리밍 경로가 이미 찍었으면 중복 출력하지 않는다(같은 문단이 280/400자로 두 번 남던 버그).
      if (result.assistantText && !sawAssistantMessage) {
        appendLog(result.assistantText.slice(0, 400), "region-task-log-line is-assistant");
      }
    } catch (cause) {
      if (!isCurrentExecution(executionId)) return;
      hadError = true;
      setSummary(`오류: ${cause instanceof Error ? cause.message : String(cause)}`);
      appendLog(String(cause), "region-task-log-line is-error");
    } finally {
      if (!isCurrentExecution(executionId)) return;
      clearExecutionTimer(activeExecution);
      running = false;
      if (!activePending) {
        releaseExecution(executionId);
        setStage("compose");
        runButton.disabled = false;
        directRoomButton.disabled = false;
        directPresetSelect.disabled = false;
        directModifierSelect.disabled = false;
        textarea.disabled = false;
      }
      // 오류는 접힌 「고급」 안에 숨으면 안 된다 — 실패했을 때만 자동으로 펼친다.
      if (hadError) setAdvancedOpen(true);
      schedulePopoverReposition();
    }
  };

  const cancelCurrentExecution = (): void => {
    if (!running || !activeExecution) return;
    // 먼저 세대와 신호를 끊어 abort를 무시하는 세션이 나중에 resolve해도 UI를 건드리지 못하게 한다.
    invalidateExecution(true);
    pendingUnsubscribe?.();
    pendingUnsubscribe = null;
    if (activePending && !activePending.settled) activePending.discard();
    activePending = null;
    compareHost.replaceChildren();
    partialHost.replaceChildren();
    partialHost.classList.add("hidden");
    setStage("compose");
    runButton.disabled = false;
    textarea.disabled = false;
    setSummary("작업을 중단했습니다 — 맵은 변경되지 않았습니다.");
    appendLog("사용자가 작업을 중단했습니다.");
    schedulePopoverReposition();
    textarea.focus();
  };

  const executeDirectRoom = async (): Promise<void> => {
    if (running) return;
    running = true;
    lastRunMode = "direct";
    let hadError = false;
    const preset = (directPresetSelect.value || "inn") as DirectInteriorPresetId;
    const modifier = (directModifierSelect.value || undefined) as InteriorThemeModifier | undefined;
    const presetLabel = DIRECT_INTERIOR_PRESETS.find((candidate) => candidate.id === preset)?.label ?? preset;
    const instruction = `AI 없이 실내 초안 · ${presetLabel}${modifier ? ` + ${modifier}` : ""}`;
    setStage("running");
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true });
    runButton.disabled = true;
    directRoomButton.disabled = true;
    directPresetSelect.disabled = true;
    directModifierSelect.disabled = true;
    textarea.disabled = true;
    setCopyEnabled(false);
    lastLog = undefined;
    recapText.textContent = instruction;
    log.replaceChildren();
    progressTimeline.replaceChildren(el("span", { class: "is-active", text: "1. 안전한 문 위치 확인" }));
    setSummary("AI 호출 없이 실내 레이어를 생성 중…");
    appendLog(`직접 실내: ${presetLabel}${modifier ? ` + ${modifier}` : ""}`);
    try {
      const result = await runDirectRoom({
        mapId: options.mapId,
        region,
        preset,
        ...(modifier ? { modifier } : {}),
      });
      setSummary(describeRegionTaskResult(result));
      if (result.pending && !result.pending.settled) {
        progressTimeline.append(el("span", {
          class: result.pending.blockers.length ? "is-blocked" : "is-done",
          text: result.pending.blockers.length ? "2. 검사 차단" : "2. 검사 완료 · 승인 대기",
        }));
        await renderPendingCompare(result.pending);
      }
      if (result.error) {
        hadError = true;
        appendLog(`오류: ${result.error}`, "region-task-log-line is-error");
      }
    } catch (cause) {
      hadError = true;
      setSummary(`오류: ${cause instanceof Error ? cause.message : String(cause)}`);
      appendLog(String(cause), "region-task-log-line is-error");
    } finally {
      running = false;
      if (!activePending) {
        setStage("compose");
        runButton.disabled = false;
        directRoomButton.disabled = false;
        directPresetSelect.disabled = false;
        directModifierSelect.disabled = false;
        textarea.disabled = false;
      }
      if (hadError) setAdvancedOpen(true);
      schedulePopoverReposition();
    }
  };

  // 실제 discard + 구독 해제는 activeModalCleanup(closeRegionTaskModal이 호출)이 담당 —
  // 여기서 중복 처리하지 않는다(이중 discard 자체는 settled 가드로 무해하지만, 정리 로직을
  // 한 곳에 모아 모달 교체 경로와 완전히 동일하게 유지한다).
  const discardAndClose = (): void => {
    closeRegionTaskModal();
  };

  runButton.addEventListener("click", () => void execute());
  cancelButton.addEventListener("click", cancelCurrentExecution);
  directRoomButton.addEventListener("click", () => void executeDirectRoom());
  copyLogButton.addEventListener("click", () => void copyLastLog());
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void execute();
    }
  });

  // ── F: 키보드 단축키 (textarea 비포커스시) + 슬래시 자동완성 ─────────────────
  // textarea/input 포커스 중에는 단일키가 입력으로 들어가므로 무시.
  const isTextFocused = (): boolean => {
    const active = document.activeElement;
    return active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement;
  };
  const onShortcutKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTextFocused()) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void execute();
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      void execute(); // 같은 지시 재실행
    }
  };
  document.addEventListener("keydown", onShortcutKey);
  // activeModalCleanup 에 정리 추가 등록 — 기존 cleanup 먼저 호출 후 리스너 해제.
  const prevCleanup = activeModalCleanup;
  activeModalCleanup = (): void => {
    prevCleanup?.();
    document.removeEventListener("keydown", onShortcutKey);
  };

  // 슬래시 자동완성 드롭다운 — 소스: 동적 추천 + 코퍼스 + 최근 지시어.
  const autocompleteHost = el("div", {
    class: "region-task-autocomplete hidden",
    dataset: { testid: "region-task-autocomplete" },
  });
  const autocompleteItems = (() => {
    const seen = new Set<string>();
    const out: Array<{ label: string; instruction: string }> = [];
    const push = (label: string, instruction: string): void => {
      if (seen.has(instruction)) return;
      seen.add(instruction);
      out.push({ label, instruction });
    };
    for (const s of suggestions) push(s.label, s.instruction);
    for (const cmd of SUGGESTED_REGION_COMMANDS) push(cmd.label, cmd.instruction);
    for (const recent of loadRecentInstructions()) push(`최근: ${recent.slice(0, 30)}`, recent);
    return out;
  })();
  let autocompleteSelected = 0;
  const renderAutocomplete = (filter: string): void => {
    const query = filter.toLowerCase();
    const matches = autocompleteItems.filter((it) =>
      it.label.toLowerCase().includes(query) || it.instruction.toLowerCase().includes(query),
    );
    autocompleteHost.replaceChildren();
    if (matches.length === 0) {
      autocompleteHost.classList.add("hidden");
      return;
    }
    autocompleteSelected = 0;
    matches.forEach((it, i) => {
      const item = el("button", {
        class: "region-task-autocomplete-item" + (i === 0 ? " is-selected" : ""),
        text: it.label,
        attrs: { type: "button", title: it.instruction },
        dataset: { testid: `region-task-autocomplete-item-${i}` },
        on: { click: () => { textarea.value = it.instruction; closeAutocomplete(); textarea.focus(); } },
      });
      autocompleteHost.append(item);
    });
    autocompleteHost.classList.remove("hidden");
    autocompleteHost.dataset.total = String(matches.length);
  };
  const closeAutocomplete = (): void => {
    autocompleteHost.classList.add("hidden");
    autocompleteHost.replaceChildren();
  };
  textarea.addEventListener("input", () => {
    const v = textarea.value;
    // `/` 로 시작하거나 `/` 가 포함된 경우 자동완성 오픈
    if (v.startsWith("/") || v.includes("/")) {
      const query = v.replace(/^\//, "").trim();
      renderAutocomplete(query);
    } else {
      closeAutocomplete();
    }
  });
  textarea.addEventListener("keydown", (event) => {
    if (autocompleteHost.classList.contains("hidden")) return;
    const total = Number(autocompleteHost.dataset.total ?? "0");
    if (total === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      autocompleteSelected = (autocompleteSelected + 1) % total;
      updateAutocompleteSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      autocompleteSelected = (autocompleteSelected - 1 + total) % total;
      updateAutocompleteSelection();
    } else if (event.key === "Enter" && total > 0) {
      event.preventDefault();
      const items = autocompleteHost.querySelectorAll(".region-task-autocomplete-item");
      const target = items[autocompleteSelected] as HTMLElement | undefined;
      target?.click();
    } else if (event.key === "Escape") {
      closeAutocomplete();
    }
  });
  function updateAutocompleteSelection(): void {
    const items = autocompleteHost.querySelectorAll(".region-task-autocomplete-item");
    items.forEach((item, i) => {
      item.classList.toggle("is-selected", i === autocompleteSelected);
    });
  }

  recapEdit.addEventListener("click", () => {
    // 미해소 제안이 있으면 버리고 입력 단계로 되돌린다(settlePendingUi 가 stage 를 compose 로).
    const hadPending = Boolean(activePending && !activePending.settled);
    if (activePending && !activePending.settled) activePending.discard();
    setStage("compose");
    textarea.disabled = false;
    // settlePendingUi 의 기본 문구("제안이 처리되었습니다")는 외부 경로용이라 여기선 모호하다.
    if (hadPending) setSummary("제안을 버렸습니다 — 지시를 고쳐 다시 실행하세요.");
    textarea.focus();
  });

  // ① 무엇을 만들지 — 추천 칩을 입력창 위에 둔다(먼저 고르고, 아니면 직접 쓴다).
  const actions = el("div", {
    class: "region-task-actions",
    children: [directPresetSelect, directModifierSelect, directRoomButton, runButton, cancelButton],
  });
  const promptSection = el("div", {
    class: "region-task-prompt",
    dataset: { testid: "region-task-prompt" },
    children: [categoryRow, suggestionRow, textarea, autocompleteHost, actions],
  });

  advancedBody.replaceChildren(
    el("div", { class: "region-task-advanced-row", children: [copyLogButton] }),
    log,
    partialHost,
  );

  const asPopover = Boolean(options.anchor);
  const windowNode = el("div", {
    class: asPopover ? "region-task-modal region-task-popover" : "region-task-modal",
    attrs: { role: "dialog", "aria-label": "영역 작업" },
    dataset: { testid: asPopover ? "region-task-popover" : "region-task-modal", stage: currentStage },
    children: [header, promptSection, recapRow, summary, progressTimeline, compareHost, advancedToggle, advancedBody],
  });
  stageHost = windowNode;
  setStage(currentStage);
  /** 로그/비교 UI가 커진 뒤에도 뷰포트 안에 남도록 재클램프 (레이아웃 반영 후 1프레임). */
  schedulePopoverReposition = (): void => {
    if (!asPopover || !options.anchor) return;
    const reposition = (): void => {
      if (!windowNode.isConnected) return;
      positionRegionTaskPopover(windowNode, options.anchor!);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(reposition);
    else reposition();
  };
  // Escape는 backdrop에 건다(포커스된 textarea의 keydown이 여기로 버블). document
  // 리스너를 피해 fakeDom과 실제 DOM 모두에서 동작.
  const backdrop = el("div", {
    class: asPopover ? "region-task-backdrop region-task-backdrop-popover" : "region-task-backdrop",
    dataset: { testid: "region-task-backdrop" },
    on: {
      click: (event) => {
        if (event.target === backdrop) discardAndClose();
      },
      keydown: (event) => {
        if ((event as KeyboardEvent).key === "Escape") {
          event.preventDefault();
          discardAndClose();
        }
      },
    },
    children: [windowNode],
  });

  document.body.append(backdrop);
  modalRoot = backdrop;
  dispatchModalOpenState(true);
  if (asPopover && options.anchor) {
    positionRegionTaskPopover(windowNode, options.anchor);
  }
  textarea.focus();
  if (options.autoRun) void execute();
  return backdrop;
}

/**
 * 앵커 근처 fixed 팝오버를 뷰포트 안으로 클램프.
 * 결과 로그·before/after로 높이가 커진 뒤에도 재호출해야 화면 밖으로 밀리지 않는다.
 */
export function positionRegionTaskPopover(panel: HTMLElement, anchor: RegionTaskAnchor): void {
  const margin = 12;
  // browser: globalThis === window; tests can stub globalThis.innerWidth/Height without full window.
  const view = globalThis as { innerWidth?: number; innerHeight?: number };
  const vw = typeof view.innerWidth === "number" && view.innerWidth > 0 ? view.innerWidth : 1024;
  const vh = typeof view.innerHeight === "number" && view.innerHeight > 0 ? view.innerHeight : 768;
  // 380: 단일 A/B 전환형 썸네일(targetWidth 240px)과 액션·메타를 담는 슬림한 팝오버 폭.
  const maxWidth = Math.min(380, Math.max(200, vw - margin * 2));
  const maxHeight = Math.max(160, vh - margin * 2);

  panel.style.position = "fixed";
  panel.style.width = `${maxWidth}px`;
  panel.style.maxWidth = `min(380px, calc(100vw - ${margin * 2}px))`;
  panel.style.maxHeight = `${maxHeight}px`;
  // 임시 배치 후 실측 → 좌/우·위/아래 플립·클램프.
  let left = anchor.x + 12;
  let top = anchor.y + 12;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;

  const rect = panel.getBoundingClientRect?.() ?? {
    width: maxWidth,
    height: Math.min(220, maxHeight),
    left,
    top,
  };
  const width = Math.min(rect.width || maxWidth, maxWidth);
  // maxHeight를 넘기면 CSS overflow로 스크롤 — 위치 계산은 클램프된 높이를 기준으로.
  const height = Math.min(rect.height || 220, maxHeight);

  if (left + width > vw - margin) left = Math.max(margin, anchor.x - width - 12);
  if (left < margin) left = margin;
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);

  if (top + height > vh - margin) {
    const above = anchor.y - height - 12;
    if (above >= margin) top = above;
    else top = Math.max(margin, vh - height - margin);
  }
  if (top < margin) top = margin;
  if (top + height > vh - margin) top = Math.max(margin, vh - height - margin);

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

/** 클립보드 복사 — Clipboard API 실패 시 textarea fallback. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
