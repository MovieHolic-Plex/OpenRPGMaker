// 선택 영역 AI 작업 모달/팝오버.
// - 우클릭 메뉴 "이 영역에 AI 작업…"
// - 우클릭 드래그 종료 후 포인터 근처 팝오버 (anchor)
// 지시를 받아 runRegionTask로 넘기고(사각형 하드 스코프), 진행/결과를 표시한다.
// 개발 편의: 헤더 「로그」 작은 버튼 → 감사/툴/하네스 JSON 클립보드 복사.
import type { SessionEvent } from "@/ai/assistantSession";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { subscribePendingRegionApply, type PendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import {
  ALL_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  POLISH_INSTRUCTION,
  regionCommandCategories,
  type SuggestedRegionCommand,
} from "@/editor/regionTask/suggestedCommands";
import { isRegionPolishRequest } from "@/editor/regionTask/regionPolish";
import { expandRegion } from "@/editor/regionTask/regionBlend";
import { dismissCoachMarks } from "@/editor/coachMarks";
import { dispatchRegionTaskStatus } from "@/editor/regionTask/regionTaskStatus";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
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
  type RegionTaskMode,
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
import {
  readGenerationMode,
  writeGenerationMode,
  type GenerationMode,
} from "@/editor/regionTask/generationMode";
import { getOperator, listOperators } from "@/editor/operators/operatorRegistry";
import { defaultOperatorParams } from "@/editor/operators/operatorTypes";
import {
  isOperatorIntentFailure,
  resolveOperatorIntent,
  type OperatorIntentResult,
} from "@/editor/operators/operatorIntent";
import { completeOperatorIntent } from "@/editor/operators/operatorIntentClient";
import {
  randomOperatorSeed,
  runOperatorTask,
  type OperatorTaskOptions,
  type OperatorTaskResult,
} from "@/editor/regionTask/runOperatorTask";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type RegionTaskRunner = (opts: {
  mapId: MapId;
  region: RegionRect;
  instruction: string;
  mode?: RegionTaskMode;
  signal?: AbortSignal;
  onEvent?: (event: SessionEvent) => void;
}) => Promise<RegionTaskResult>;

export type RegionTaskAnchor = {
  readonly x: number;
  readonly y: number;
};

/** 화면 좌표(클라이언트) 사각형 — 팝오버가 겹치면 안 되는 영역(=작업 대상 선택 영역). */
export type RegionTaskAvoidRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export interface RegionTaskModalOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly initialInstruction?: string;
  readonly autoRun?: boolean;
  /** "polish" 면 자동 실행·실행 버튼이 다듬기 경로로 간다(캔버스 「다듬기」 칩 등). */
  readonly mode?: RegionTaskMode;
  /** 화면 좌표(클라이언트). 있으면 중앙 모달 대신 근처 플로팅 팝오버. */
  readonly anchor?: RegionTaskAnchor;
  /**
   * 작업 대상 영역의 화면 사각형. 주면 팝오버를 그 옆에 세운다 — 우클릭 드래그는 놓은 자리가
   * 곧 대상 영역 안이라, anchor 만 쓰면 창이 **자기가 바꾸는 곳을 덮는다**(캔버스 고스트
   * 미리보기까지 가린다). 옆에 자리가 좁으면 간격을 줄이거나 겹침이 가장 적은 쪽에 세운다.
   */
  readonly avoid?: RegionTaskAvoidRect;
  // 테스트 주입: 기본은 실제 runRegionTask.
  readonly run?: RegionTaskRunner;
  /** 테스트 주입: AI/도구 쿼터를 쓰지 않는 직접 실내 초안 경로. */
  readonly runDirectRoomDraft?: DirectInteriorRoomDraftRunner;
  /** 테스트 주입: 생성기 모드(LLM 없는 오퍼레이터) 실행 경로. */
  readonly runOperator?: (options: OperatorTaskOptions) => OperatorTaskResult | Promise<OperatorTaskResult>;
  /** 테스트 주입: 문장 → 생성기 의도 해석. 기본은 LLM 1콜 + 키워드 폴백. */
  readonly resolveIntent?: (instruction: string) => Promise<OperatorIntentResult>;
  /** 모달을 열 때의 생성 모드. 생략하면 사용자가 마지막에 쓴 모드(기본 조수). */
  readonly generationMode?: GenerationMode;
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

// 열려 있는 창의 「대상 영역 재지정」 손잡이. 창이 비모달이 된 뒤로 사용자는 창을 띄운 채로
// 캔버스에 다시 우클릭 드래그를 할 수 있다 — 그때 선택만 바뀌고 창이 옛 영역을 들고 있으면
// 「적용」이 화면에 보이는 선택과 **다른 곳**을 고친다. 그래서 제스처가 창을 갈아 끼운다.
// 지시 단계에서만 허용한다: 실행 중이거나 검토 중인 결과를 말없이 버릴 수는 없다.
let activeModalRegionControl: {
  readonly canRetarget: () => boolean;
  readonly retarget: (region: RegionRect, anchor?: RegionTaskAnchor) => void;
} | null = null;

/** 창이 떠 있고 그 영역이 잠겨 있는가(실행 중·검토 중) — 이때 캔버스 재지정을 막는다. */
export function isRegionTaskRegionLocked(): boolean {
  return modalRoot !== null && !(activeModalRegionControl?.canRetarget() ?? false);
}

/**
 * 열려 있는 창을 새 영역으로 갈아 끼운다. 입력해 둔 지시문은 그대로 옮겨 온다.
 * 창이 없거나 영역이 잠겨 있으면 아무것도 하지 않고 `false`.
 */
export function retargetRegionTaskModal(region: RegionRect, anchor?: RegionTaskAnchor): boolean {
  const control = activeModalRegionControl;
  if (modalRoot === null || !control || !control.canRetarget()) return false;
  control.retarget(region, anchor);
  return true;
}

export const REGION_TASK_MODAL_EVENT = "oprn:region-task-modal";

/** 열림/닫힘을 알린다 — EditScene 이 선택 칩 오버레이를 숨기거나 되살리는 신호. */
function dispatchModalOpenState(open: boolean): void {
  // 같은 작업의 입구가 두 개 보이지 않게 한다: 이 모달이 열려 있는 동안 AI 조수 패널의 입력
  // 경로는 물러난다(실측: 모달 뒤에 "한 문장으로 지시" 입력창이 절반 가려진 채 살아 있었다).
  document.body?.classList?.[open ? "add" : "remove"]?.("region-task-modal-open");
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
  activeModalRegionControl = null;
  cleanup?.();
  modalRoot?.remove();
  modalRoot = null;
  if (wasOpen) dispatchModalOpenState(false);
}

export function openRegionTaskModal(options: RegionTaskModalOptions): HTMLElement {
  closeRegionTaskModal();
  const run: RegionTaskRunner = options.run ?? runRegionTask;
  const runDirectRoom = options.runDirectRoomDraft ?? runDirectInteriorRoomDraft;
  const runOperator = options.runOperator ?? runOperatorTask;
  const resolveIntent = options.resolveIntent
    ?? ((instruction: string) => resolveOperatorIntent(instruction, { complete: completeOperatorIntent }));
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
    children: [el("span", { class: "region-task-title", text: "영역 작업" }), closeButton],
  });
  // 단계 세그즜트 — 지시 → 생성 → 검토. 어떤 단계가 활성이냐는 CSS 가 data-stage 로 정한다
  // — JS 는 stage 만 바꾼다는 이 파일의 기존 원칙을 그대로 따른다.
  const stageSegments = el("div", {
    class: "region-task-stage-steps",
    dataset: { testid: "region-task-stage-steps" },
    children: (["compose", "running", "review"] as const).map((step, index) =>
      el("span", {
        class: "region-task-stage-step",
        dataset: { stageStep: step },
        text: ["지시", "생성", "검토"][index],
      }),
    ),
  });
  // 제목·닫기 한 줄, 메타(단계·좌표·타일 분포) 한 줄. 380px 팝오버에서 다섯 덩어리를 한 줄에
  // 밀어 넣으면 제목과 좌표 칩이 서로를 밀어내 읽을 수 없었다.
  const metaRow = el("div", {
    class: "region-task-meta-row",
    dataset: { testid: "region-task-meta-row" },
    children: [stageSegments, chip, statsChip],
  });
  const header = el("div", {
    class: "region-task-header",
    children: [titleRow, metaRow],
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
  // ── 무엇을 시킬 수 있는지: 문맥 추천 4개 + 「모두 보기」 한 칩 ──────────────────
  // 예전에는 추천 줄 위에 **카테고리 필터 칩 8개**가 가로 스크롤러로 상주했다. 380px 폭
  // 팝오버에서 다섯 번째 칩이 경계에서 잘리고, 칩을 누르면 추천 줄이 그 계열로 갈아치워져
  // "지금 무엇을 보고 있나"가 상태로 남았다(자동완성 범위까지 그 상태를 따라갔다).
  // 이제 필터 상태는 없다. 추천 줄은 항상 이 영역에 맞춘 4개 그대로고, 전체 명령은
  // 「모두 보기」 시트에 카테고리 소제목으로 묶여 한 번에 펼쳐진다 — 고를 것을 눈으로 보고
  // 바로 집는다. 상태가 없으니 두 표면이 서로 다른 것을 가리킬 수도 없다.
  const categories = regionCommandCategories();
  const totalCommandCount = categories.reduce((acc, category) => acc + category.commands.length, 0);
  const hiddenCommandCount = Math.max(0, totalCommandCount - suggestions.length);
  const categorySheet = el("div", {
    class: "region-task-categories hidden",
    dataset: { testid: "region-task-categories" },
    children: categories.map((category) => el("div", {
      class: "region-task-category-group",
      dataset: { testid: `region-category-${category.id}` },
      children: [
        el("div", {
          class: "region-task-category-group-title",
          children: [
            makeSvgIcon(category.icon),
            el("span", { class: "region-task-chip-label", text: category.label }),
          ],
        }),
        el("div", {
          class: "region-task-category-group-chips",
          children: category.commands.map(makeCommandChip),
        }),
      ],
    })),
  });
  // 「(+18)」이 범위를 말한다 — 추천 4개가 전부라는 오해(= "타일 채우기 도구")를 막는 건
  // 카테고리 줄을 상시 노출했던 원래 의도였고, 그 값을 이 숫자 하나가 대신한다.
  const browseAllChip = el("button", {
    class: "region-task-suggest-chip is-browse-all",
    attrs: { type: "button", title: "명령 전체를 계열별로 보기", "aria-expanded": "false" },
    dataset: { testid: "region-task-browse-all" },
    children: [
      makeSvgIcon("more"),
      el("span", {
        class: "region-task-chip-label",
        text: hiddenCommandCount > 0 ? `모두 보기 (+${hiddenCommandCount})` : "모두 보기",
      }),
      el("span", { class: "region-task-browse-chevron" }),
    ],
    on: {
      click: () => {
        const open = categorySheet.classList.contains("hidden");
        categorySheet.classList.toggle("hidden", !open);
        browseAllChip.classList.toggle("is-active", open);
        browseAllChip.setAttribute("aria-expanded", open ? "true" : "false");
        schedulePopoverReposition();
      },
    },
  });
  const suggestionRow = el("div", {
    class: "region-task-suggestions",
    dataset: { testid: "region-task-suggestions" },
    children: [...suggestions.map(makeCommandChip), browseAllChip],
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
  // 다듬기는 「무엇을 만들지」를 고를 것이 없다 — 대상은 이 사각형, 목표는 주변 어울림이다.
  // 그래서 입력창이 비어 있어도 눌리는 별도 버튼으로 둔다(추천 칩을 거쳐 문장을 넣게 하면
  // 사용자가 그 문장을 편집할 이유도 없이 왕복만 한다).
  const polishButton = el("button", {
    class: "region-task-polish",
    text: "주변과 어울리게 다듬기",
    attrs: { type: "button", title: "이 영역을 주변과 어울리게 AI가 다시 짜기 (타일·이벤트 전권)" },
    dataset: { testid: "region-task-polish" },
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
  // 섹션 제목과 버튼이 같은 문구("AI 없이 실내 초안")면 접힌 상태에선 컨트롤 없는 죽은 캡션처럼,
  // 펼친 상태에선 같은 말이 두 번 보인다. 제목은 무엇인지, 버튼은 무엇을 하는지로 나눈다.
  const directRoomButton = el("button", {
    class: "region-task-direct-room",
    text: "초안 만들기",
    attrs: { type: "button", title: "도구 쿼터를 쓰지 않고 연결된 실내를 생성" },
    dataset: { testid: "region-task-direct-room" },
  }) as HTMLButtonElement;

  // ── 생성 모드 ──
  // 조수(LLM) 와 생성기(오퍼레이터)는 "무엇을 입력하는가" 가 다르다 — 문장이냐, 파라미터냐.
  // 한 화면에 둘을 겹쳐 놓으면 사용자가 지금 어느 쪽에 말하는지 잃어버린다. 그래서 스위치로
  // 갈라 놓되, **조수 쪽 화면은 한 픽셀도 바꾸지 않는다**(기본값도 조수).
  let generationMode: GenerationMode = options.generationMode ?? readGenerationMode();
  const operators = listOperators();
  let operatorId = operators[0]?.id ?? "forest";
  let operatorParams: Record<string, number | boolean> = operators[0] ? defaultOperatorParams(operators[0]) : {};
  let operatorSeed = randomOperatorSeed();

  const modeAssistantButton = el("button", {
    class: "region-task-mode-button",
    text: "조수",
    attrs: { type: "button", title: "문장으로 지시합니다 (AI 호출)" },
    dataset: { testid: "region-task-mode-assistant" },
  }) as HTMLButtonElement;
  const modeOperatorButton = el("button", {
    class: "region-task-mode-button",
    text: "생성기",
    attrs: { type: "button", title: "파라미터와 시드로 만듭니다 (AI 호출 없음)" },
    dataset: { testid: "region-task-mode-operator" },
  }) as HTMLButtonElement;
  const modeSwitch = el("div", {
    class: "region-task-mode-switch",
    attrs: { role: "group", "aria-label": "생성 모드" },
    dataset: { testid: "region-task-mode-switch" },
    children: [modeAssistantButton, modeOperatorButton],
  });

  const operatorSelect = el("select", {
    class: "region-task-direct-select",
    attrs: { "aria-label": "생성기 종류" },
    dataset: { testid: "region-task-operator-select" },
    children: operators.map((operator) => el("option", {
      text: operator.label,
      attrs: { value: operator.id, title: operator.hint },
    })),
  }) as HTMLSelectElement;
  operatorSelect.value = operatorId;
  const operatorHint = el("div", {
    class: "region-task-operator-hint",
    text: operators[0]?.hint ?? "",
    dataset: { testid: "region-task-operator-hint" },
  });
  const operatorParamHost = el("div", {
    class: "region-task-operator-params",
    dataset: { testid: "region-task-operator-params" },
  });
  const operatorSeedValue = el("span", {
    class: "region-task-operator-seed-value",
    text: String(operatorSeed),
    dataset: { testid: "region-task-operator-seed" },
  });
  const operatorReseedButton = el("button", {
    class: "region-task-operator-reseed",
    text: "새 시드",
    attrs: { type: "button", title: "같은 설정으로 다른 변형을 뽑습니다" },
    dataset: { testid: "region-task-operator-reseed" },
  }) as HTMLButtonElement;
  const operatorRunButton = el("button", {
    class: "region-task-operator-run",
    text: "만들기",
    attrs: { type: "button", title: "AI 호출 없이 이 영역을 생성합니다" },
    dataset: { testid: "region-task-operator-run" },
  }) as HTMLButtonElement;
  // 문장 입력 — 모델은 이 한 줄을 (생성기 + 파라미터) 로 옮기기만 한다. 타일은 만지지 않는다.
  const intentInput = el("input", {
    class: "region-task-operator-intent-input",
    attrs: {
      type: "text",
      placeholder: "문장으로: 예) 울창한 숲에 오솔길 하나",
      "aria-label": "문장으로 생성기 설정",
    },
    dataset: { testid: "region-task-operator-intent-input" },
  }) as HTMLInputElement;
  const intentButton = el("button", {
    class: "region-task-operator-intent-run",
    text: "해석",
    attrs: { type: "button", title: "문장을 읽어 아래 설정을 채웁니다" },
    dataset: { testid: "region-task-operator-intent-run" },
  }) as HTMLButtonElement;
  const intentNote = el("div", {
    class: "region-task-operator-intent-note hidden",
    dataset: { testid: "region-task-operator-intent-note" },
  });

  const operatorPanel = el("div", {
    class: "region-task-operator-panel hidden",
    dataset: { testid: "region-task-operator-panel" },
    children: [
      el("div", {
        class: "region-task-operator-intent",
        children: [intentInput, intentButton],
      }),
      intentNote,
      el("div", {
        class: "region-task-operator-head",
        children: [operatorSelect, operatorHint],
      }),
      operatorParamHost,
      el("div", {
        class: "region-task-operator-foot",
        children: [
          el("span", { class: "region-task-operator-seed-label", text: "시드" }),
          operatorSeedValue,
          operatorReseedButton,
          operatorRunButton,
        ],
      }),
    ],
  });

  /** 파라미터 위젯은 스펙에서 만든다 — 오퍼레이터를 늘려도 이 함수만 그대로 돈다. */
  const renderOperatorParams = (): void => {
    const def = getOperator(operatorId);
    operatorParamHost.replaceChildren();
    if (!def) return;
    operatorHint.textContent = def.hint;
    for (const spec of def.params) {
      if (spec.kind === "toggle") {
        const input = el("input", {
          attrs: { type: "checkbox", id: `region-task-op-${spec.id}` },
          dataset: { testid: `region-task-operator-param-${spec.id}` },
        }) as HTMLInputElement;
        input.checked = Boolean(operatorParams[spec.id]);
        input.addEventListener("change", () => {
          operatorParams = { ...operatorParams, [spec.id]: input.checked };
        });
        operatorParamHost.append(el("label", {
          class: "region-task-operator-toggle",
          attrs: { for: `region-task-op-${spec.id}`, ...(spec.hint ? { title: spec.hint } : {}) },
          children: [input, el("span", { text: spec.label })],
        }));
        continue;
      }
      const input = el("input", {
        class: "region-task-operator-range",
        attrs: {
          type: "range",
          id: `region-task-op-${spec.id}`,
          min: String(spec.min),
          max: String(spec.max),
          step: String(spec.step),
        },
        dataset: { testid: `region-task-operator-param-${spec.id}` },
      }) as HTMLInputElement;
      input.value = String(operatorParams[spec.id] ?? spec.defaultValue);
      const readout = el("span", { class: "region-task-operator-readout", text: input.value });
      input.addEventListener("input", () => {
        const next = Number(input.value);
        operatorParams = { ...operatorParams, [spec.id]: next };
        readout.textContent = input.value;
      });
      operatorParamHost.append(el("label", {
        class: "region-task-operator-slider",
        attrs: { for: `region-task-op-${spec.id}`, ...(spec.hint ? { title: spec.hint } : {}) },
        children: [
          el("span", { class: "region-task-operator-name", text: spec.label }),
          input,
          readout,
        ],
      }));
    }
  };

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
      el("span", { class: "region-task-advanced-label", text: "고급 (실행 로그)" }),
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
  // 검토 단계의 세 결정(적용·다시 만들기·버리기) — 버튼과 단축키가 같은 함수를 부른다.
  // pending 이 없는 단계에서는 null 이라 Enter 가 엉뚱한 곳에서 적용을 부를 수 없다.
  let reviewShortcuts: {
    readonly apply: () => void;
    readonly retry: () => void;
    readonly discard: () => void;
  } | null = null;
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
    reviewShortcuts = null;
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
    reviewShortcuts = null;
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
      // 그 사이에 다른 경로(하네스·빌드 팔레트·새 우클릭 드래그)가 새 모달을 열었다면 그것을
      // 닫아서는 안 된다 — 예약 당시의 root 가 아직 살아 있을 때만 닫는다.
      const ownRoot = modalRoot;
      const close = (): void => {
        if (modalRoot !== ownRoot) return;
        closeRegionTaskModal();
      };
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
    polishButton.disabled = false;
    directRoomButton.disabled = false;
    directPresetSelect.disabled = false;
    directModifierSelect.disabled = false;
    textarea.disabled = false;
    // 생성기 컨트롤도 같은 자리에서 되살린다 — 적용/버리기 뒤에 파라미터가 잠겨 있으면
    // "다시 만들기" 를 못 해 모드가 한 번 쓰고 죽은 것처럼 보인다.
    setOperatorControlsDisabled(false);
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
    // 이벤트 변경 목록은 **부분 적용 판정·오버레이보다 먼저** 계산한다 — 부분 적용 가능 여부와
    // "이후" 그림 위의 이벤트 마커가 둘 다 이 목록을 본다.
    const eventChanges = (() => {
      try {
        return summarizeRegionEventChanges(pending.baseProject, pending.clippedProject, pending.mapId, pending.region);
      } catch {
        return [];
      }
    })();
    const structuralProposal = pending.roomDrafts.length > 0
      || Object.keys(pending.clippedProject.maps).some((mapId) => !pending.baseProject.maps[mapId]);
    // 청크가 1개뿐이면 "선택 적용"이 "모두 적용"과 완전히 같은 동작이라 고를 이유가 없다.
    // 실내/맵 추가 제안은 타일만 부분 복사하면 문·맵·세션이 분리되므로 아예 제공하지 않는다.
    // 이벤트가 섞인 제안도 제공하지 않는다: composePartialProject 는 **타일만** 옮기므로
    // 부분 적용을 고르면 NPC 이동·상자 배치가 조용히 사라진다(다듬기는 재배치가 본업이다).
    const partialUseful = allChunks.length > 1 && !structuralProposal && eventChanges.length === 0;
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

    // 미리보기 프레임 — 다듬기는 "주변과 이어졌는가"가 결정 근거라, 영역만 크롭하면 판단할
    // 재료가 화면에 없다. 다듬기 초안에서만 여백 2칸을 포함한 사각형을 찍는다(맵 밖은 클램프).
    const previewRect = lastRunMode === "ai" && lastAiMode === "polish" && map
      ? expandRegion(pending.region, 2, map)
      : pending.region;
    const hasPreviewMargin = previewRect.width !== pending.region.width
      || previewRect.height !== pending.region.height;

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
      // 격자는 **찍은 그림과 같은 사각형**이어야 한다 — 여백 프레임에서 영역 크기로 격자를
      // 만들면 하이라이트가 실제 칸과 어긋난다. 영역 로컬 좌표는 이 오프셋만큼 밀어 넣는다.
      const { width: rw, height: rh } = previewRect;
      const offsetX = pending.region.x - previewRect.x;
      const offsetY = pending.region.y - previewRect.y;
      if (rw <= 0 || rh <= 0) return null;
      const chunkAt = new Map<string, string>();
      for (const chunk of allChunks) for (const cell of chunk.cells) chunkAt.set(`${cell.x},${cell.y}`, chunk.id);
      const cells: HTMLElement[] = [];
      for (let cy = 0; cy < rh; cy += 1) {
        for (let cx = 0; cx < rw; cx += 1) {
          const insideRegion = cx >= offsetX && cy >= offsetY
            && cx < offsetX + pending.region.width && cy < offsetY + pending.region.height;
          const chunkId = insideRegion ? chunkAt.get(`${cx - offsetX},${cy - offsetY}`) : undefined;
          const cell = el("span", {
            class: chunkId
              ? "region-task-change-cell is-changed"
              : insideRegion
                ? "region-task-change-cell"
                // 여백 칸 — 작업 대상이 아니라 비교 대상이다. 흐리게 깔아 영역과 구분한다.
                : "region-task-change-cell is-context",
          });
          if (chunkId) {
            const bucket = overlayCellsByChunk.get(chunkId);
            if (bucket) bucket.push(cell);
            else overlayCellsByChunk.set(chunkId, [cell]);
          }
          cells.push(cell);
        }
      }
      // 이벤트 마커 — 절대 좌표를 프레임 로컬 좌표로 환산해 같은 격자에 배치한다.
      // 프레임 밖(clipToRegion 이 되돌리기 전 좌표 등)은 격자에 자리가 없으므로 건너뛴다.
      let eventMarkerIndex = 0;
      for (const change of eventChanges) {
        eventMarkerIndex += 1;
        const markerIndex = eventMarkerIndex;
        const lx = change.x - previewRect.x;
        const ly = change.y - previewRect.y;
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
      // 영역 테두리 — 여백이 있을 때만. 어디까지가 AI 가 손댄 사각형인지 한 줄로 보여 준다.
      if (hasPreviewMargin) {
        cells.push(el("span", {
          class: "region-task-region-frame",
          attrs: {
            style: `grid-column: ${offsetX + 1} / span ${pending.region.width};`
              + ` grid-row: ${offsetY + 1} / span ${pending.region.height};`,
          },
          dataset: { testid: "region-task-region-frame" },
        }));
      }
      return el("div", {
        class: "region-task-change-overlay",
        attrs: { style: `grid-template-columns: repeat(${rw}, 1fr); grid-template-rows: repeat(${rh}, 1fr);`, "aria-hidden": "true" },
        dataset: { testid: "region-task-change-overlay", cols: String(rw), rows: String(rh) },
        children: cells,
      });
    };
    // A/B 토글이 이미 「이전 | 이후」를 이름표로 달고 있으므로 figure 안에 캡션을 또 두지 않는다.
    // (실측: 캡션을 남기면 숨긴 쪽 figure 가 캡션만 남아 이후 그림 옆에 "이전" 이 떠 있었다.)
    const makeFigure = async (
      testid: string,
      project: Project,
      figureMap: GameMap | undefined,
      overlay: HTMLElement | null,
    ): Promise<HTMLElement> => {
      const body = el("div", { class: "region-task-compare-canvas", dataset: { testid } });
      if (figureMap) {
        try {
          const canvas = await renderSnapshot(project, figureMap, previewRect);
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
        children: [body],
      });
    };
    const overlay = changeOverlay();
    const beforeFigure = await makeFigure("region-task-before", pending.baseProject, map, null);
    if (!isCurrentExecution(executionId)) return;
    const afterFigure = await makeFigure("region-task-after", pending.clippedProject, clippedMap, overlay);
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

    // 바뀐 곳이 타일 몇 칸일 때 두 버튼을 왕복하며 눈으로 차이를 찾는 것이 검토의 실제 비용이었다.
    // 「이전」에 마우스를 올리거나 포커스만 주면 잠깐 이전 상태를 보여 주고, 떼면 원래 보던 쪽으로
    // 돌아온다. 클릭은 그대로 고정 전환이다(기존 계약 유지).
    let committedAbView: "before" | "after" = "after";
    const setAbView = (view: "before" | "after", options?: { readonly peek?: boolean }): void => {
      if (!options?.peek) committedAbView = view;
      currentAbView = view;
      previewWrapper.dataset.abView = view;
      abBeforeBtn.classList.toggle("is-active", view === "before");
      abAfterBtn.classList.toggle("is-active", view === "after");
    };

    abBeforeBtn.addEventListener("click", () => setAbView("before"));
    abAfterBtn.addEventListener("click", () => setAbView("after"));
    const peekBefore = (): void => setAbView("before", { peek: true });
    const peekEnd = (): void => setAbView(committedAbView, { peek: true });
    abBeforeBtn.addEventListener("mouseenter", peekBefore);
    abBeforeBtn.addEventListener("mouseleave", peekEnd);
    abBeforeBtn.addEventListener("focus", peekBefore);
    abBeforeBtn.addEventListener("blur", peekEnd);

    const abToggle = el("div", {
      class: "region-task-preview-ab-toggle",
      children: [abBeforeBtn, abAfterBtn],
    });
    // 호버 비교·테두리 표시를 글로 설명하던 줄은 지웠다 — 버튼에 올리면 바로 보이는 동작을
    // 문장으로 한 번 더 말할 필요가 없다. 툴팁(title)만 남긴다.
    abBeforeBtn.setAttribute("title", "올리면 잠깐 비교, 누르면 고정");

    const previewStage = el("div", {
      class: "region-task-preview-stage",
      children: [beforeFigure, afterFigure],
    });

    previewWrapper.append(abToggle, previewStage);
    figures.append(previewWrapper);
    // 썸네일 렌더 도중 이미 밖에서(캔버스 등) settle 됐다면 — 구독이 이미 처리했으므로
    // 지금 와서 apply/discard 버튼이 있는 비교 UI를 새로 그리지 않는다.
    if (pending.settled || !isCurrentExecution(executionId)) return;

    // 버튼과 단축키가 같은 함수를 부른다. 이미 settle 된 pending 에 다시 적용을 보내면
    // "이미 처리된 제안입니다" 오류가 summary 에 찍히므로, 버튼에 포커스가 있는 상태에서
    // Enter 가 click 과 document keydown 으로 두 번 들어오는 경우를 여기서 막는다.
    //
    // **적용 버튼은 하나다.** 예전에는 둘이었고 서로 다른 범위를 가졌다: 하단 CTA
    // 「적용 · N칸」은 언제나 전량이었고, 체크를 반영하는 「선택한 M칸만 적용」은 본문
    // 위쪽에 따로 생겼다. 그래서 구역 체크를 풀고 그 아래 큰 버튼을 누르면 **의도와 반대로
    // 전부 적용**됐다. 이제 이 함수 하나가 체크 상태를 읽어 범위를 정한다.
    const doApply = (): void => {
      if (!isCurrentExecution(executionId) || pending.settled) return;
      const ids = Array.from(selectedChunkIds);
      // 구역 체크 UI 자체가 없는 제안(단일 덩어리·실내/맵 추가)은 언제나 전량이다.
      // 부분 선택일 때만 합성 경로를 탄다.
      if (partialUseful && ids.length === 0) return;
      const partial = partialUseful && ids.length > 0 && ids.length < allChunkIds.length;
      selfSettling = true;
      const outcome = partial
        ? pending.applyProject(
          compose({
            base: pending.baseProject,
            clipped: pending.clippedProject,
            mapId: pending.mapId,
            region: pending.region,
            selectedChunkIds: ids,
            groups: rawGroups,
          }),
        )
        : pending.apply();
      if (!outcome.ok) {
        selfSettling = false;
        setSummary(outcome.error ?? "적용 안전 검사를 통과하지 못했습니다.");
        schedulePopoverReposition();
        return;
      }
      finalizeSettle(true);
    };
    const doRetry = (): void => {
      if (!isCurrentExecution(executionId) || pending.settled) return;
      selfSettling = true;
      pending.discard();
      finalizeSettle(false);
      if (lastRunMode === "direct") void executeDirectRoom();
      // 다듬기 초안을 버리고 다시 뽑을 때도 다듬기여야 한다 — 모드를 안 넘기면 같은 문장이
      // 키워드로 우연히 잡힐 때만 유지된다(사용자가 지시를 고쳐 두면 조용히 일반 경로가 된다).
      else void execute({ mode: lastAiMode });
    };
    const doDiscard = (): void => {
      if (!isCurrentExecution(executionId) || pending.settled) return;
      selfSettling = true;
      pending.discard();
      finalizeSettle(false);
    };
    reviewShortcuts = { apply: doApply, retry: doRetry, discard: doDiscard };

    // 전량 적용일 때의 라벨. 아래에서 "타일 밖 변경"이 있다고 판명되면 「적용」으로 낮춘다.
    // 부분 선택 라벨과 한 곳에서 갈라져야 해서(updatePartialState) 변수로 들고 있는다.
    let fullApplyLabel = totalChangedCells > 0 ? `적용 · ${totalChangedCells}칸` : "적용";
    const applyButton = el("button", {
      class: "region-task-apply",
      text: fullApplyLabel,
      attrs: { type: "button", title: "이 제안을 맵에 적용 (Enter)" },
      dataset: { testid: "region-task-apply" },
      on: { click: doApply },
    });
    // "다시 만들기" — 같은 지시로 재실행. 마음에 안 드는 결과를 버리고 다시 뽑는 흐름이
    // 버리기→입력창 찾기→실행 3단계였던 것을 1단계로 줄인다.
    const retryButton = el("button", {
      class: "region-task-retry",
      attrs: { type: "button", title: "같은 지시로 다시 생성 (R)" },
      dataset: { testid: "region-task-retry" },
      children: [
        makeSvgIcon("undo"),
        el("span", { class: "region-task-action-label", text: "다시 만들기" }),
      ],
      on: { click: doRetry },
    });
    const discardButton = el("button", {
      class: "region-task-discard",
      text: "버리기",
      attrs: { type: "button", title: "제안을 버리고 지시 단계로" },
      dataset: { testid: "region-task-discard" },
      on: { click: doDiscard },
    });

    // 청크 트리 — 각 청크 체크박스. 토글 시 **주 적용 버튼**의 라벨/활성이 따라온다.
    // 체크 상태와 CTA 가 한 몸이어야 한다 — 별도 「선택 적용」 버튼을 위쪽에 띄우던 시절엔
    // 체크를 풀고 아래 큰 버튼을 누르면 전부 적용되는 함정이 있었다.
    // 라벨은 **칸 수**다. 예전엔 선택된 청크 개수를 "N칸"으로 찍어서 37칸짜리 하나를
    // 고르면 "선택 1칸 적용"이라고 표시했다 — 정반대로 읽히는 오표기였다.
    const updatePartialState = (): void => {
      const selectedCells = cellsOf(selectedChunkIds);
      const partial = partialUseful && selectedChunkIds.size < allChunkIds.length;
      if (partial) {
        applyButton.textContent = selectedCells === 0 ? "적용할 구역을 고르세요" : `선택한 ${selectedCells}칸만 적용`;
      } else {
        applyButton.textContent = fullApplyLabel;
      }
      // 전부 해제하면 적용할 게 없다 — 누를 수 없게 하고 라벨이 다음 행동을 말한다.
      applyButton.disabled = partial && selectedCells === 0;
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

    // 부분 적용은 검토 화면의 본문에 둔다. 「고급(로그·부분 적용·스탬프)」 안에 있던 동안은
    // "이건 받고 저건 뺀다" 는 검토의 핵심 결정을 하려면 접힌 섹션을 열고 로그를 지나쳐야 했다.
    // 구조 변경(실내·맵 추가)은 타일만 떼어내면 문·맵 연결이 끊기므로 여전히 제공하지 않는다.
    if (structuralProposal) {
      partialHost.replaceChildren();
      partialHost.classList.add("hidden");
    } else {
      partialHost.replaceChildren(chunkTree);
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
    // 라벨을 직접 쓰지 않고 전량 라벨을 낮춘 뒤 갱신을 다시 태운다 — 부분 선택 중이면
    // 「선택한 M칸만 적용」이 유지돼야 하고, 그 판단은 updatePartialState 한 곳에만 있다.
    if (hasNonTileChanges) {
      fullApplyLabel = "적용";
      updatePartialState();
    }
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
    // 체크포인트 타임라인은 없앴다: 통과/차단이라는 판정 자체가 없어졌고(검증게이트 배제),
    // 이 타임라인은 "막힌 검사"만 그리던 UI 였다. 소견은 아래 지표 칩·이슈 목록이 말한다.
    const metrics = review?.metrics;
    // 지표는 예전에 한 줄 문자열이었고(무엇의 단위인지 알 수 없었다), 그다음엔 칩 8개였다
    // ("바뀐 칸 4칸 · 이벤트 1건 · 갈 수 있는 목표 36개 · 타일 조합 50/100점 · NPC 일정 4명 ·
    // 시간 시스템 켜짐 …"). 개수는 변경 목록이 이미 말하고, 점수·켜짐은 이 편집에서 사용자가
    // 할 일이 없다. 이제 **손을 봐야 하는 값만** 남긴다 — 좋을 때는 아무것도 안 뜬다.
    // 전체 수치는 「고급 (실행 로그)」의 로그 복사로 확인한다.
    const metricChips: Array<{ readonly text: string; readonly warn?: boolean }> = [];
    if (metrics) {
      if ((metrics.unreachableObjectives ?? 0) > 0) {
        metricChips.push({ text: `못 가는 목표 ${metrics.unreachableObjectives}개`, warn: true });
      }
      if ((metrics.outOfScopeChanges ?? 0) > 0) {
        metricChips.push({ text: `영역 밖 변경 ${metrics.outOfScopeChanges}건`, warn: true });
      }
      if (metrics.scheduledNpcs > 0 && !metrics.timeSystemEnabled) {
        metricChips.push({ text: `시간 시스템 꺼짐 · NPC 일정 ${metrics.scheduledNpcs}명`, warn: true });
      }
      // 다듬기 전용 지표. 어울림은 적용을 막지 않는다(경계가 조금 어긋난 초안조차 못 쓰게 하면
      // 사용자가 막힌다) — 대신 여기서 보이고 결정은 사람이 한다.
      if ((metrics.brokenCrossings ?? 0) > 0) {
        metricChips.push({ text: `경계 어긋남 ${metrics.brokenCrossings}곳`, warn: true });
      }
      if ((metrics.blockedEntrances ?? 0) > 0) {
        metricChips.push({ text: `진입 막힘 ${metrics.blockedEntrances}곳`, warn: true });
      }
      // 점수는 **나빠졌거나 낮을 때만** 뜬다. 다듬어서 올라간 점수는 사용자가 할 일이 없다.
      if (metrics.blendScore !== undefined) {
        const before = metrics.blendScoreBefore;
        const worse = before !== undefined && metrics.blendScore < before;
        if (worse || metrics.blendScore < 70) {
          metricChips.push({
            text: before !== undefined
              ? `어울림 ${before}→${metrics.blendScore}`
              : `어울림 ${metrics.blendScore}점`,
            warn: true,
          });
        }
      }
    }
    const metricsRow = el("div", {
      class: "region-task-review-metrics" + (metricChips.length ? "" : " hidden"),
      dataset: { testid: "region-task-review-metrics" },
      children: metricChips.map((chip) => el("span", {
        class: "region-task-metric" + (chip.warn ? " is-warn" : ""),
        text: chip.text,
      })),
    });
    const issueRows = (review?.issues ?? []).map((issue, index) => el("div", {
      class: `region-task-review-issue is-${issue.severity}`,
      dataset: { testid: `region-task-review-issue-${index}` },
      text: `${issue.severity === "error" ? "확인" : "주의"} · ${issue.message}${issue.mapId ? ` [${issue.mapId}${issue.x === undefined ? "" : ` ${issue.x},${issue.y}`}]` : ""}`,
    }));
    // "막는 문제·주의 없음" 같은 빈 상태 문구도 없앴다 — 문제가 없으면 진단 줄 자체가 안 뜬다.
    const issuesHost = el("div", {
      class: "region-task-review-issues" + (issueRows.length ? "" : " hidden"),
      dataset: { testid: "region-task-review-issues" },
      children: issueRows,
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

    // 사용자 결정을 요구하는 것들 — 결정 버튼 바로 위에 항상 보이게 둔다.
    const gateHost = el("div", {
      class: "region-task-gates",
      dataset: { testid: "region-task-gates" },
      children: [npcScheduleDecision],
    });
    // 진단(체크포인트·지표·이슈)은 접는다. 예전에는 이 셋이 미리보기보다 **위**에 있어서
    // 380px 팝오버에서 「적용」이 스크롤 아래로 밀려 있었다 — 우클릭 드래그의 목적이 적용인데
    // 그게 화면에서 가장 멀었다. 한 줄 소견만 남기고, error 소견이 있을 때만 자동으로 펼친다.
    const errorIssues = (review?.issues ?? []).filter((issue) => issue.severity === "error").length;
    const warnIssues = (review?.issues ?? []).length - errorIssues;
    // 그리고 아무 소견이 없을 때는 진단 줄 자체를 만들지 않는다.
    const hasSomethingToSay = errorIssues > 0 || warnIssues > 0 || metricChips.length > 0;
    // "적용 차단" 은 더 이상 존재하지 않는다(검증게이트 배제) — 소견 건수만 말한다.
    const verdictText = errorIssues > 0
      ? `확인 ${errorIssues}건`
      : warnIssues > 0
        ? `주의 ${warnIssues}건`
        : "확인할 값";
    const diagnostics = hasSomethingToSay
      ? el("details", {
        class: "region-task-diagnostics",
        dataset: { testid: "region-task-diagnostics" },
        children: [
          el("summary", {
            class: "region-task-diagnostics-summary",
            text: verdictText,
            dataset: { testid: "region-task-verdict" },
          }),
          el("div", {
            class: "region-task-review-card",
            children: [metricsRow, issuesHost],
          }),
        ],
      })
      : null;
    if (diagnostics && errorIssues > 0) diagnostics.setAttribute("open", "");
    diagnostics?.addEventListener("toggle", schedulePopoverReposition);

    compareHost.replaceChildren(
      figures,
      changeList,
      // 변경 목록 바로 아래 = 무엇이 바뀌는지 읽은 자리에서 무엇만 받을지 고른다.
      partialHost,
      roomsHost,
      gateHost,
      el("div", {
        class: "region-task-compare-actions",
        dataset: { testid: "region-task-compare-actions" },
        children: [applyButton, retryButton, discardButton],
      }),
      ...(diagnostics ? [diagnostics] : []),
    );
    setStage("review");
    // 검토 DOM이 한꺼번에 자란 뒤 다음 프레임까지 이전 높이의 좌표를 유지하면 하단이 잘린 채
    // 노출된다. CSS가 검토 내용을 드러낸 직후 실측하고, 아래 rAF 재측정도 그대로 둔다.
    if (asPopover && options.anchor) positionRegionTaskPopover(windowNode, options.anchor, options.avoid);
    // 결정 화면에 들어오면 기본 결정(적용)에 포커스를 준다. 브라우저는 Enter/Space 를 포커스된
    // 버튼의 동작으로 처리하므로, 이것만으로 "결과를 보고 Enter" 가 확정이 된다. 입력창은 이
    // 단계에서 display:none 이라 포커스를 잃는데, 그 포커스가 body 로 흘러가면 어떤 키도
    // 결정으로 이어지지 않았다.
    applyButton.focus?.();
    // 결과가 나오면 로그는 접는다 — 결정에 필요한 건 미리보기와 변경 칸 수다.
    if (!advancedPinned) setAdvancedOpen(false);
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true, phase: "pending" });
    if (defaultCheckpointPreview.run) await defaultCheckpointPreview.run();
    schedulePopoverReposition();
  };

  let lastRunMode: "ai" | "direct" = "ai";
  // 마지막 AI 실행이 다듬기였는가. 「다시 만들기」가 같은 경로로 돌아야 하고, 승인 미리보기의
  // 여백 프레임도 이 값으로 결정한다(다듬기는 주변과의 이음새가 판단 근거다).
  let lastAiMode: RegionTaskMode = "task";
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

  /**
   * AI 실행. overrides 를 주면 입력창 대신 그 지시·모드로 돈다 — 「다듬기」처럼 사용자가
   * 문장을 고를 것이 없는 진입점이 있다. 이때 입력창에도 그 문장을 채워 두어야
   * 「지시 수정」·「다시 만들기」가 같은 지시를 이어받는다(빈 입력창으로 되돌아가면
   * 무엇을 시켰는지 화면에서 사라진다).
   */
  const execute = async (
    overrides?: { readonly instruction?: string; readonly mode?: RegionTaskMode },
  ): Promise<void> => {
    if (running) return;
    if (overrides?.instruction !== undefined) textarea.value = overrides.instruction;
    const instruction = textarea.value.trim();
    if (!instruction) {
      setSummary("지시 내용을 입력하세요.");
      textarea.focus();
      return;
    }
    // 자유 입력도 어휘로 라우팅한다 — "주변과 어울리게 해줘" 를 직접 쓴 사람이 일반 경로로
    // 가면 주변 브리핑 없이 영역 안만 보고 채운다(요청을 이행할 근거 자체가 없다).
    const mode: RegionTaskMode = overrides?.mode ?? (isRegionPolishRequest(instruction) ? "polish" : "task");
    // 검토 중 단축키로 다시 실행하는 기존 흐름도 한 소유자만 남도록 먼저 해소한다.
    if (activePending && !activePending.settled) activePending.discard();
    if (activeExecution) invalidateExecution(true);

    const executionId = ++executionGeneration;
    const controller = new AbortController();
    const execution: ActiveExecution = { id: executionId, controller, elapsedTimer: null };
    activeExecution = execution;
    running = true;
    lastRunMode = "ai";
    lastAiMode = mode;
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
    polishButton.disabled = true;
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
    if (mode === "polish") appendLog("모드: 다듬기 (주변 브리핑 + 영역 안 전권)");
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
        // 일반 경로에서는 키를 넣지 않는다 — 기존 호출 계약(주입 러너의 인자 검증)을 그대로 둔다.
        ...(mode === "polish" ? { mode } : {}),
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
        // 검토 화면에서 "제안 준비 — 4칸 타일 · 이벤트 1건 · 적용 여부를 선택하세요" 는
        // 바로 아래 변경 목록(타일 4칸/보물상자 …)과 지표 칩이 이미 하는 말이었다 — 같은 숫자를
        // 세 번 읽게 했다. 여기서는 요약 줄을 비우고 변경 목록 한 곳만 남긴다.
        // (채팅 패널은 말풍선이라 문장이 필요하다 — describeRegionTaskResult 는 그대로 쓴다.)
        setSummary("");
        // 통과·차단이라는 판정이 없어졌다 — 진행 칩은 비우고 진단은 검토 카드에서 읽는다.
        progressTimeline.replaceChildren();
        progressMilestone = "미리보기를 준비하는 중";
        await renderPendingCompare(result.pending, executionId);
        if (!isCurrentExecution(executionId)) return;
        // 1초 타이머가 요약 줄을 다시 채우기 전에 끈다 — 안 끄면 검토 화면에
        // "미리보기를 준비하는 중 · 12초" 가 그대로 남는다.
        clearExecutionTimer(execution);
        setSummary("");
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
        polishButton.disabled = false;
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
    polishButton.disabled = false;
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
    polishButton.disabled = true;
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
        // 검증게이트가 없으므로 이 단계는 "검사 완료"만 있다 — 진단은 검토 카드에서 읽는다.
        progressTimeline.append(el("span", { class: "is-done", text: "2. 검사 완료" }));
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
        polishButton.disabled = false;
        directRoomButton.disabled = false;
        directPresetSelect.disabled = false;
        directModifierSelect.disabled = false;
        textarea.disabled = false;
      }
      if (hadError) setAdvancedOpen(true);
      schedulePopoverReposition();
    }
  };

  const setOperatorControlsDisabled = (disabled: boolean): void => {
    operatorRunButton.disabled = disabled;
    operatorReseedButton.disabled = disabled;
    operatorSelect.disabled = disabled;
    intentInput.disabled = disabled;
    intentButton.disabled = disabled;
    for (const input of operatorParamHost.querySelectorAll("input")) {
      (input as HTMLInputElement).disabled = disabled;
    }
  };

  /**
   * 문장 → 설정. 해석 결과를 **슬라이더에 채워 보여 준 뒤** 사용자가 만들기를 누른다.
   * 곧바로 생성하지 않는 이유: 모델이 무엇으로 읽었는지가 화면에 남아야 사용자가 고칠 수 있다.
   * (조수 경로의 실패 모드가 정확히 "무엇을 하려는지 모른 채 결과만 받는 것" 이었다.)
   */
  const interpretIntent = async (): Promise<void> => {
    if (running) return;
    const text = intentInput.value.trim();
    if (!text) {
      intentInput.focus();
      return;
    }
    intentButton.disabled = true;
    intentInput.disabled = true;
    intentNote.classList.remove("hidden", "is-error");
    intentNote.textContent = "해석 중…";
    try {
      const intent = await resolveIntent(text);
      if (isOperatorIntentFailure(intent)) {
        intentNote.classList.add("is-error");
        intentNote.textContent = intent.error;
        return;
      }
      const def = getOperator(intent.operatorId);
      if (!def) {
        intentNote.classList.add("is-error");
        intentNote.textContent = `모르는 생성기입니다: ${intent.operatorId}`;
        return;
      }
      operatorId = def.id;
      operatorSelect.value = def.id;
      operatorParams = { ...intent.params };
      renderOperatorParams();
      // 어떻게 읽었는지 + 누가 읽었는지를 함께 밝힌다. 키워드 폴백을 AI 해석으로 오해하면 안 된다.
      const via = intent.source === "llm" ? "AI 해석" : "키워드 해석 (AI 미사용)";
      intentNote.textContent = `${via} → ${intent.note} · [만들기]를 누르세요`;
    } catch (cause) {
      intentNote.classList.add("is-error");
      intentNote.textContent = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (!running) {
        intentButton.disabled = false;
        intentInput.disabled = false;
      }
    }
  };

  /**
   * 생성기 실행. 조수 경로(execute)와 공유하는 것은 **결과 처리부뿐**이다 —
   * 같은 승인 카드·같은 before/after·같은 undo 로 끝나야 사용자가 두 모드를 하나의 도구로 쓴다.
   */
  const executeOperator = async (reseed: boolean): Promise<void> => {
    if (running) return;
    const def = getOperator(operatorId);
    if (!def) return;
    running = true;
    lastRunMode = "direct";
    let hadError = false;
    if (reseed) {
      operatorSeed = randomOperatorSeed();
      operatorSeedValue.textContent = String(operatorSeed);
    }
    const instruction = `생성기 · ${def.label} (시드 ${operatorSeed})`;
    setStage("running");
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true });
    runButton.disabled = true;
    polishButton.disabled = true;
    directRoomButton.disabled = true;
    textarea.disabled = true;
    setOperatorControlsDisabled(true);
    setCopyEnabled(false);
    lastLog = undefined;
    recapText.textContent = instruction;
    log.replaceChildren();
    progressTimeline.replaceChildren(el("span", { class: "is-active", text: "1. 생성" }));
    setSummary("AI 호출 없이 생성 중…");
    appendLog(instruction);
    try {
      const result = await runOperator({
        mapId: options.mapId,
        region,
        operatorId,
        params: operatorParams,
        seed: operatorSeed,
      });
      setSummary(describeRegionTaskResult(result));
      if (result.assistantText) appendLog(result.assistantText);
      if (result.pending && !result.pending.settled) {
        progressTimeline.append(el("span", { class: "is-done", text: "2. 검사 완료" }));
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
        polishButton.disabled = false;
        directRoomButton.disabled = false;
        textarea.disabled = false;
        setOperatorControlsDisabled(false);
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
  polishButton.addEventListener("click", () => void execute({ instruction: POLISH_INSTRUCTION, mode: "polish" }));
  cancelButton.addEventListener("click", cancelCurrentExecution);
  directRoomButton.addEventListener("click", () => void executeDirectRoom());
  operatorRunButton.addEventListener("click", () => void executeOperator(false));
  operatorReseedButton.addEventListener("click", () => void executeOperator(true));
  intentButton.addEventListener("click", () => void interpretIntent());
  intentInput.addEventListener("keydown", (event) => {
    const key = (event as KeyboardEvent).key;
    // IME 조합 중 Enter 는 한글 확정이다 — 여기서 해석을 걸면 글자가 잘린다.
    if (key !== "Enter" || (event as KeyboardEvent).isComposing) return;
    event.preventDefault();
    void interpretIntent();
  });
  operatorSelect.addEventListener("change", () => {
    const next = getOperator(operatorSelect.value);
    if (!next) return;
    operatorId = next.id;
    operatorParams = defaultOperatorParams(next);
    renderOperatorParams();
  });
  copyLogButton.addEventListener("click", () => void copyLastLog());
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void execute();
    }
  });

  // ── F: 키보드 단축키 + 슬래시 자동완성 ──────────────────────────────────────
  // 단축키는 **단계별로** 뜻이 달라야 한다. 예전에는 단계와 무관하게 Enter 가 execute() 였고,
  // 그래서 검토 단계에서 결과를 보고 Enter 를 누르면 확정이 아니라 **방금 만든 제안을 버리고
  // AI 를 한 번 더 호출**했다. 결정 화면에 확정 키가 아예 없었던 셈이다.
  const hasNeutralShortcutFocus = (): boolean => {
    const active = document.activeElement;
    return active === null || active === document.body || active === stageHost || active === modalRoot;
  };
  const onShortcutKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Escape 는 포커스 위치와 무관하게 이 창의 것이다 — 중립 포커스 게이트보다 먼저 본다.
    // 팝오버가 비모달이 되면서 사용자가 캔버스를 만진 뒤 Esc 를 누를 수 있게 됐고, 그때
    // 백드롭 keydown(포커스가 창 안일 때만 버블)에는 아무것도 도착하지 않는다.
    // EditScene.handleEscapeKey 는 창이 열려 있으면 물러나므로 선택은 남는다.
    if (event.key === "Escape") {
      event.preventDefault();
      discardAndClose();
      return;
    }
    // 변경 행처럼 탐색용으로 포커스되는 요소의 Enter 가 제안 전체 적용으로 새지 않게,
    // 문서 단축키는 어떤 자식도 키 동작을 소유하지 않는 중립 지점에서만 받는다.
    if (!hasNeutralShortcutFocus()) return;
    if (currentStage === "review") {
      if (event.key === "Enter") {
        event.preventDefault();
        reviewShortcuts?.apply();
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        reviewShortcuts?.retry();
      }
      return;
    }
    if (currentStage === "running") return;
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
    const out: Array<{ label: string; instruction: string; category?: string }> = [];
    const push = (label: string, instruction: string, category?: string): void => {
      if (seen.has(instruction)) return;
      seen.add(instruction);
      out.push({ label, instruction, ...(category ? { category } : {}) });
    };
    for (const s of suggestions) push(s.label, s.instruction, s.category);
    for (const cmd of ALL_REGION_COMMANDS) push(cmd.label, cmd.instruction, cmd.category);
    for (const recent of loadRecentInstructions()) push(`최근: ${recent.slice(0, 30)}`, recent);
    return out;
  })();
  let autocompleteSelected = 0;
  const renderAutocomplete = (filter: string): void => {
    const query = filter.toLowerCase();
    // 예전에는 켜져 있는 카테고리 칩으로 이 목록의 범위를 좁혔다 — 칩 필터와 `/` 목록이
    // 서로 다른 상태를 보고 있으면 안 되니까. 카테고리 필터 상태 자체가 없어졌으므로
    // (「모두 보기」 시트는 상태를 남기지 않는다) 좁힐 것도, 어긋날 것도 없다.
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
      // 드롭다운만 닫는다. stopPropagation 이 없으면 backdrop 의 keydown 까지 올라가
      // 창 전체가 닫혔다 — 자동완성을 물리려던 Escape 가 작업을 날렸다.
      event.preventDefault();
      event.stopPropagation();
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
  // 실내 초안은 매번 쓰는 경로가 아니다 — select 2개 + 버튼을 종일 한 줄에 놓지 않고 접어 둔다.
  // 접힌 상태여도 querySelector 로 찾아 click 하는 기존 경로(하네스·테스트)는 그대로 동작한다.
  const directDisclosure = el("details", {
    class: "region-task-direct-disclosure",
    dataset: { testid: "region-task-direct-disclosure" },
    children: [
      el("summary", {
        class: "region-task-direct-summary",
        children: [
          // 펼칠 수 있다는 표시. 「고급」 줄에는 셰브론이 있는데 이 줄에는 없어서 텍스트로만 보였다.
          el("span", { class: "region-task-direct-chevron" }),
          el("span", { text: "AI 없이 실내 초안 만들기" }),
        ],
      }),
      el("div", {
        class: "region-task-direct-body",
        children: [directPresetSelect, directModifierSelect, directRoomButton],
      }),
    ],
  });
  const actions = el("div", {
    class: "region-task-actions",
    children: [directDisclosure, polishButton, runButton, cancelButton],
  });
  const promptSection = el("div", {
    class: "region-task-prompt",
    dataset: { testid: "region-task-prompt" },
    // 시트는 추천 줄 **아래**에 온다 — 「모두 보기」를 누른 자리 바로 밑에서 열려야 한다.
    // 모드 스위치는 맨 위 — 지금 무엇에게 말하는지가 입력 전에 보여야 한다.
    children: [modeSwitch, suggestionRow, categorySheet, textarea, autocompleteHost, operatorPanel, actions],
  });

  /**
   * 모드 적용. 조수 쪽 요소는 **각자의 hidden 상태를 건드리지 않고** 부모 클래스로만 가린다 —
   * 카테고리 시트·자동완성은 자기 열림 상태를 hidden 으로 관리하므로, 여기서 remove 하면
   * 모드를 되돌릴 때 닫혀 있어야 할 것이 열린 채로 나타난다.
   */
  const applyGenerationMode = (mode: GenerationMode, persist: boolean): void => {
    generationMode = mode;
    const operatorMode = mode === "operator" && operators.length > 0;
    promptSection.classList.toggle("is-operator-mode", operatorMode);
    operatorPanel.classList.toggle("hidden", !operatorMode);
    modeAssistantButton.classList.toggle("is-active", !operatorMode);
    modeOperatorButton.classList.toggle("is-active", operatorMode);
    modeAssistantButton.setAttribute("aria-pressed", String(!operatorMode));
    modeOperatorButton.setAttribute("aria-pressed", String(operatorMode));
    if (persist) writeGenerationMode(mode);
  };
  modeAssistantButton.addEventListener("click", () => applyGenerationMode("assistant", true));
  modeOperatorButton.addEventListener("click", () => applyGenerationMode("operator", true));
  renderOperatorParams();
  applyGenerationMode(operators.length > 0 ? generationMode : "assistant", false);

  // 부분 적용은 compareHost(검토 본문)로 옮겼다 — 여기 남는 것은 개발자용 로그뿐이다.
  advancedBody.replaceChildren(
    el("div", { class: "region-task-advanced-row", children: [copyLogButton] }),
    log,
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
      positionRegionTaskPopover(windowNode, options.anchor!, options.avoid);
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
  // 캔버스에서 영역을 다시 잡았을 때 이 창이 새 영역으로 갈아 끼워지는 경로.
  // `avoid`(창이 덮지 말아야 할 화면 사각형)는 새 영역으로 다시 계산한다 — 옛 값을 물려주면
  // 창이 예전 대상 옆에 서서 지금 대상을 덮는다. 자동 실행은 물려주지 않는다(사용자가 새
  // 영역에 무엇을 시킬지 아직 말하지 않았다).
  activeModalRegionControl = {
    canRetarget: () => currentStage === "compose",
    retarget: (nextRegion, nextAnchor) => {
      const nextAvoid = resolveRegionClientRect(nextRegion);
      const anchor = nextAnchor ?? options.anchor;
      openRegionTaskModal({
        ...options,
        region: nextRegion,
        initialInstruction: textarea.value,
        autoRun: false,
        ...(anchor ? { anchor } : {}),
        avoid: nextAvoid ?? undefined,
      });
    },
  };
  // 코치/웰컴 카드는 이 팝오버의 본문(좌표 칩·결정 문장)을 덮는다 — 모달이 표면을 가져간다.
  // databaseModal 과 같은 처리다. '본 것'으로 기록하지 않으므로 다음 부팅에 다시 안내한다.
  dismissCoachMarks();
  dispatchModalOpenState(true);
  if (asPopover && options.anchor) {
    positionRegionTaskPopover(windowNode, options.anchor, options.avoid);
  }
  textarea.focus();
  if (options.autoRun) void execute(options.mode ? { mode: options.mode } : undefined);
  return backdrop;
}

/**
 * 앵커 근처 fixed 팝오버를 뷰포트 안으로 클램프.
 * 결과 로그·before/after로 높이가 커진 뒤에도 재호출해야 화면 밖으로 밀리지 않는다.
 */
export function positionRegionTaskPopover(
  panel: HTMLElement,
  anchor: RegionTaskAnchor,
  avoid?: RegionTaskAvoidRect,
): void {
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

  // 회피 영역(=작업 대상 선택 영역)이 주어지면 그 옆에 세운다. 우클릭 드래그는 놓은 자리가
  // 곧 대상 영역 안이므로 anchor 만 쓰면 창이 자기가 바꾸는 곳과 캔버스 고스트 미리보기를
  // 덮는다. 완전히 비켜설 수 없어도 anchor 로 돌아가지 않고 겹침이 가장 적은 쪽을 고른다.
  const beside = placePopoverBesideRect({
    avoid,
    width,
    height,
    viewport: { width: vw, height: vh },
    margin,
  });
  if (beside) {
    panel.style.left = `${Math.round(beside.x)}px`;
    panel.style.top = `${Math.round(beside.y)}px`;
    return;
  }

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

/**
 * 회피 사각형(대상 영역) 옆의 팝오버 좌상단을 고른다. 오른쪽 → 왼쪽 → 아래 → 위 순으로
 * 먼저 요청 간격, 다음 0 간격에서 겹치지 않는 자리를 찾는다. 그래도 없으면 뷰포트 안으로
 * 클램프한 네 자리 중 대상 영역과의 겹침이 가장 작은 곳을 쓴다. 회피 영역이 없을 때만
 * null을 반환해 호출부의 anchor 배치를 유지한다. DOM 없이 검증할 수 있게 순수 함수로 분리했다.
 */
export function placePopoverBesideRect(opts: {
  readonly avoid?: RegionTaskAvoidRect;
  readonly width: number;
  readonly height: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly margin: number;
  readonly gap?: number;
}): { readonly x: number; readonly y: number } | null {
  const { avoid, width, height, viewport, margin } = opts;
  if (!avoid) return null;

  const gap = opts.gap ?? 12;
  const clamp = (value: number, min: number, max: number): number =>
    max < min ? min : Math.min(Math.max(value, min), max);
  const maxLeft = viewport.width - margin - width;
  const maxTop = viewport.height - margin - height;
  // 세로 배치는 영역의 세로 중앙에, 가로 배치는 영역의 가로 중앙에 맞춘다.
  const centeredTop = clamp(avoid.y + avoid.height / 2 - height / 2, margin, maxTop);
  const centeredLeft = clamp(avoid.x + avoid.width / 2 - width / 2, margin, maxLeft);
  const candidates = (candidateGap: number): ReadonlyArray<{ readonly x: number; readonly y: number }> => [
    { x: avoid.x + avoid.width + candidateGap, y: centeredTop },
    { x: avoid.x - width - candidateGap, y: centeredTop },
    { x: centeredLeft, y: avoid.y + avoid.height + candidateGap },
    { x: centeredLeft, y: avoid.y - height - candidateGap },
  ];
  const insideViewport = (candidate: { readonly x: number; readonly y: number }): boolean =>
    candidate.x >= margin && candidate.x <= maxLeft && candidate.y >= margin && candidate.y <= maxTop;

  for (const candidateGap of gap === 0 ? [0] : [gap, 0]) {
    const placed = candidates(candidateGap).find(insideViewport);
    if (placed) return placed;
  }

  const overlapArea = (candidate: { readonly x: number; readonly y: number }): number => {
    const overlapWidth = Math.max(
      0,
      Math.min(candidate.x + width, avoid.x + avoid.width) - Math.max(candidate.x, avoid.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(candidate.y + height, avoid.y + avoid.height) - Math.max(candidate.y, avoid.y),
    );
    return overlapWidth * overlapHeight;
  };
  const clamped = candidates(0).map((candidate) => ({
    x: clamp(candidate.x, margin, maxLeft),
    y: clamp(candidate.y, margin, maxTop),
  }));
  return clamped.reduce((best, candidate) =>
    overlapArea(candidate) < overlapArea(best) ? candidate : best);
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
