// 선택 영역 AI 작업 모달/팝오버.
// - 우클릭 메뉴 "이 영역에 AI 작업…"
// - 우클릭 드래그 종료 후 포인터 근처 팝오버 (anchor)
// 지시를 받아 runRegionTask로 넘기고(사각형 하드 스코프), 진행/결과를 표시한다.
// 개발 편의: 헤더 「로그」 작은 버튼 → 감사/툴/하네스 JSON 클립보드 복사.
import type { SessionEvent } from "@/ai/assistantSession";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { subscribePendingRegionApply, type PendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { dispatchRegionTaskStatus } from "@/editor/regionTask/regionTaskStatus";
import { nextSuggestedRegionCommands, SUGGESTED_REGION_COMMANDS } from "@/editor/regionTask/suggestedCommands";
import { suggestRegionCommandsByContext } from "@/editor/regionTask/regionContextSuggestions";
import { formatRegionTileStatsCompact, summarizeRegionTiles } from "@/editor/regionTask/regionTileStats";
import {
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
  runRegionTask,
  serializeRegionTaskLog,
  type RegionTaskLogExport,
  type RegionTaskResult,
} from "@/editor/regionTask/runRegionTask";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import {
  defaultStampName,
  saveRegionAsStamp,
  type SaveRegionAsStampArgs,
  type SaveRegionAsStampResult,
} from "@/editor/regionStampCreate";
import { store } from "@/project/store";
import type { GameMap, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type RegionTaskRunner = (opts: {
  mapId: MapId;
  region: RegionRect;
  instruction: string;
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
  /** 테스트 주입: 썸네일 렌더러(기본 renderRegionSnapshot 캔버스). */
  readonly renderSnapshot?: (project: Project, map: GameMap, region: RegionRect) => Promise<HTMLElement>;
  /** 테스트 주입: 스탬프 저장 함수(기본 saveRegionAsStamp). */
  readonly saveStamp?: (args: SaveRegionAsStampArgs) => SaveRegionAsStampResult | null;
  /** 테스트 주입: 기본 이름용 project 조회(기본 store.getCurrent). */
  readonly projectForStampName?: () => Project;
  /** 테스트 주입: 동적 추천/통계 칩용 project 조회(기본 store.getCurrent). */
  readonly projectForContext?: () => Project;
  /** 테스트 주입: 부분 적용 함수(기본 composePartialProject). UI 테스트용. */
  readonly composePartial?: typeof composePartialProject;
  /** 테스트/프로덕션 주입: 부분 적용 프로젝트를 store.replace 로 반영. 기본은 runRegionTask.applyProject.
   *  시그니처: (project, label, mapId) => void. 미주입 시 부분 적용은 전체 적용으로 폴백. */
  readonly applyPartialProject?: (project: Project, label: string, mapId: MapId) => void;
}

let modalRoot: HTMLElement | null = null;
// 현재 열린 모달의 정리 콜백 — 새 모달이 열리거나(closeRegionTaskModal 선호출) 명시적으로
// 닫힐 때 미해소 pending을 discard하고 구독을 해제한다(스펙: 새 영역 작업 시작 시 기존
// pending discard). 이 콜백 내부에서 closeRegionTaskModal을 다시 호출하지 않는다(재귀 방지).
let activeModalCleanup: (() => void) | null = null;

export function closeRegionTaskModal(): void {
  const cleanup = activeModalCleanup;
  activeModalCleanup = null;
  cleanup?.();
  modalRoot?.remove();
  modalRoot = null;
}

export function openRegionTaskModal(options: RegionTaskModalOptions): HTMLElement {
  closeRegionTaskModal();
  const run: RegionTaskRunner = options.run ?? runRegionTask;
  const { region } = options;

  const chip = el("span", {
    class: "region-task-chip",
    text: `▦ (${region.x},${region.y}) ${region.width}×${region.height}`,
    dataset: { testid: "region-task-chip" },
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
    text: "✕",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "region-task-close" },
    on: { click: () => discardAndClose() },
  });
  const titleRow = el("div", {
    class: "region-task-title-row",
    children: [
      el("span", { class: "region-task-title", text: "✦ 영역 작업" }),
      copyLogButton,
    ],
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
  const suggestionRow = el("div", {
    class: "region-task-suggestions",
    dataset: { testid: "region-task-suggestions" },
    children: suggestions.map((command) =>
      el("button", {
        class: "region-task-suggest-chip",
        text: command.label,
        attrs: { type: "button", title: command.instruction },
        dataset: { testid: `region-suggest-${command.id}` },
        on: {
          click: () => {
            textarea.value = command.instruction;
            textarea.focus();
          },
        },
      }),
    ),
  });

  const log = el("div", { class: "region-task-log", dataset: { testid: "region-task-log" } });
  const summary = el("div", { class: "region-task-summary", dataset: { testid: "region-task-summary" } });

  const runButton = el("button", {
    class: "region-task-run",
    text: "실행",
    attrs: { type: "button" },
    dataset: { testid: "region-task-run" },
  }) as HTMLButtonElement;

  const renderSnapshot = options.renderSnapshot
    ?? ((project: Project, map: GameMap, rect: RegionRect) => renderRegionSnapshot(project, map, rect));
  const compareHost = el("div", { class: "region-task-compare-host" });
  let activePending: PendingRegionApply | null = null;
  // renderPendingCompare가 건 subscribePendingRegionApply 구독의 해제 함수 — 모달 스코프에
  // 저장해 activeModalCleanup(모달 교체/닫기 시)이 정확히 1회 해제할 수 있게 한다.
  let pendingUnsubscribe: (() => void) | null = null;
  // windowNode 생성 후 할당 — 로그/비교 UI 성장 시 뷰포트 재클램프.
  let schedulePopoverReposition: () => void = () => undefined;
  activeModalCleanup = (): void => {
    pendingUnsubscribe?.();
    pendingUnsubscribe = null;
    if (activePending && !activePending.settled) activePending.discard();
    activePending = null;
  };

  // applied: true=적용, false=버리기, null=외부(캔버스 인라인 툴바 등)에서 settle되어 결과를 알 수 없음.
  const settlePendingUi = (applied: boolean | null): void => {
    setSummary(
      applied === true
        ? `적용됨 — ${activePending?.changedCells ?? 0}칸 타일 · 이벤트 ${activePending?.changedEvents ?? 0}건`
        : applied === false
          ? "버려졌습니다 — 맵은 변경되지 않았습니다"
          : "제안이 처리되었습니다",
    );
    compareHost.replaceChildren();
    activePending = null;
    // running:false 배지 해제는 pending.apply()/discard() → onSettle(runRegionTask.ts)에서
    // 담당한다 — 캔버스 인라인 툴바 등 이 모달을 거치지 않는 settle 경로도 있어 여기서 중복 발행하지 않는다.
    runButton.disabled = false;
    textarea.disabled = false;
    updateStampButtonState();
    schedulePopoverReposition();
  };

  const renderPendingCompare = async (pending: PendingRegionApply): Promise<void> => {
    activePending = pending;
    updateStampButtonState();
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
      if (selfSettling || !pending.settled) return;
      finalizeSettle(null);
    });

    const map = pending.baseProject.maps[pending.mapId];
    const clippedMap = pending.clippedProject.maps[pending.mapId];
    const figures = el("div", { class: "region-task-compare", dataset: { testid: "region-task-compare" } });
    const makeFigure = async (
      label: string,
      testid: string,
      project: Project,
      figureMap: GameMap | undefined,
    ): Promise<HTMLElement> => {
      const body = el("div", { class: "region-task-compare-canvas", dataset: { testid } });
      if (figureMap) {
        try {
          const canvas = await renderSnapshot(project, figureMap, pending.region);
          // 클릭 시 2배 확대 토글
          canvas.addEventListener?.("click", () => body.classList.toggle("is-zoomed"));
          body.append(canvas);
        } catch {
          body.append(el("span", { class: "region-task-compare-fallback", text: "미리보기 실패" }));
        }
      }
      return el("figure", {
        class: "region-task-compare-figure",
        children: [body, el("figcaption", { text: label })],
      });
    };
    figures.append(
      await makeFigure("이전", "region-task-before", pending.baseProject, map),
      el("span", { class: "region-task-compare-arrow", text: "→" }),
      await makeFigure("이후", "region-task-after", pending.clippedProject, clippedMap),
    );
    // 썸네일 렌더 도중 이미 밖에서(캔버스 등) settle 됐다면 — 구독이 이미 처리했으므로
    // 지금 와서 apply/discard 버튼이 있는 비교 UI를 새로 그리지 않는다.
    if (pending.settled) return;
    // A: 부분 적용 — 청크 그룹화. 빈 변경이면 트리 숨김.
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
    const hasChanges = groups.lower.length > 0 || groups.upper.length > 0;
    const selectedChunkIds = new Set<string>();
    const allChunkIds = [...groups.lower, ...groups.upper].map((c) => c.id);
    // 기본: 모든 청크 선택(=전체 적용과 동일). 사용자가 일부 해제하면 부분 적용.
    for (const id of allChunkIds) selectedChunkIds.add(id);

    const partialApplyButton = el("button", {
      class: "region-task-apply region-task-partial-apply",
      text: `✓ 선택 적용`,
      attrs: { type: "button", title: "선택한 구역만 적용" },
      dataset: { testid: "region-task-partial-apply" },
    }) as HTMLButtonElement;
    partialApplyButton.addEventListener("click", () => {
      const ids = Array.from(selectedChunkIds);
      if (ids.length === 0) return;
      selfSettling = true;
      if (ids.length === allChunkIds.length) {
        // 전체 선택 = pending.apply() 경로 (일관성)
        pending.apply();
      } else {
        // 부분: 병합 프로젝트를 applyProject 로 넘긴다 — pending 내부 onApply 가
        // store.replace(clipped) 를 부르므로, 여기서는 먼저 discard 한 뒤 별도 적용.
        // 단, pending.discard() 는 no-op(onDiscard 가 빈 함수)이므로 안전.
        const merged = compose({
          base: pending.baseProject,
          clipped: pending.clippedProject,
          mapId: pending.mapId,
          region: pending.region,
          selectedChunkIds: ids,
          groups: rawGroups,
        });
        // pending 을 settle 시키고 커스텀 적용 — applyProject 는 runRegionTask deps 주입.
        // 여기서 직접 store.replace 못하므로 pending.apply() 의 onApply 흐름을 쓰되,
        // clipped 대신 merged 를 쓰기 위해 pending 을 먼저 discard 하고 options.applyPartialProject 로 처리.
        const applier = options.applyPartialProject;
        if (applier) {
          applier(merged, `영역 작업(부분 ${ids.length}/${allChunkIds.length}): ${pending.instruction.slice(0, 40)}`, pending.mapId);
          pending.discard();
        } else {
          // 적용 경로 미주입시 전체 적용으로 폴백(안전).
          pending.apply();
        }
      }
      finalizeSettle(true);
    });

    const applyButton = el("button", {
      class: "region-task-apply",
      text: "✓ 모두 적용",
      attrs: { type: "button" },
      dataset: { testid: "region-task-apply" },
      on: { click: () => { selfSettling = true; pending.apply(); finalizeSettle(true); } },
    });
    const discardButton = el("button", {
      class: "region-task-discard",
      text: "✕ 버리기",
      attrs: { type: "button" },
      dataset: { testid: "region-task-discard" },
      on: { click: () => { selfSettling = true; pending.discard(); finalizeSettle(false); } },
    });

    // 청크 트리 — 각 청크 체크박스. 토글 시 부분 적용 버튼 라벨/활성 갱신.
    const updatePartialState = (): void => {
      const n = selectedChunkIds.size;
      partialApplyButton.textContent = n === 0 ? "✓ 선택 적용" : `✓ 선택 ${n}칸 적용`;
      partialApplyButton.disabled = n === 0;
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
      return el("label", {
        class: "region-task-chunk-label",
        children: [cb, document.createTextNode(` ${chunk.label}`)],
      });
    };
    const chunkTree = el("div", {
      class: "region-task-chunk-tree" + (hasChanges ? "" : " hidden"),
      dataset: { testid: "region-task-chunk-tree" },
      children: hasChanges ? [
        el("div", { class: "region-task-chunk-layer-title", text: `적용 범위:` }),
        ...(groups.lower.length > 0 ? [
          el("div", { class: "region-task-chunk-layer", children: [
            el("span", { class: "region-task-chunk-layer-name", text: "하위" }),
            ...groups.lower.map(makeChunkCheckbox),
          ] }),
        ] : []),
        ...(groups.upper.length > 0 ? [
          el("div", { class: "region-task-chunk-layer", children: [
            el("span", { class: "region-task-chunk-layer-name", text: "상위" }),
            ...groups.upper.map(makeChunkCheckbox),
          ] }),
        ] : []),
      ] : [],
    });
    updatePartialState();

    compareHost.replaceChildren(
      figures,
      chunkTree,
      el("div", { class: "region-task-compare-actions", children: [partialApplyButton, applyButton, discardButton] }),
    );
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true, phase: "pending" });
    schedulePopoverReposition();
  };

  let running = false;
  let lastLog: RegionTaskLogExport | undefined;
  const setSummary = (text: string): void => {
    summary.textContent = text;
  };
  const appendLog = (text: string, className = "region-task-log-line"): void => {
    if (!text.trim()) return;
    log.append(el("div", { class: className, text }));
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
      toast("로그 복사 · 활동 DB에도 자동 저장됨 (window.__rpgzzuAiActivityLog)", "ok");
      const resetLabel = (): void => {
        if (copyLogButton.isConnected) copyLogButton.textContent = "로그";
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
    running = true;
    dispatchRegionTaskStatus({ mapId: options.mapId, region, running: true });
    runButton.disabled = true;
    textarea.disabled = true;
    updateStampButtonState();
    setCopyEnabled(false);
    copyLogButton.textContent = "로그";
    lastLog = undefined;
    log.replaceChildren();
    setSummary("AI가 이 영역을 작업 중…");
    appendLog(`지시: ${instruction}`);
    appendLog(`영역: (${region.x},${region.y}) ${region.width}×${region.height}`);
    const onEvent = (event: SessionEvent): void => {
      if (event.type === "status") appendLog(event.text);
      else if (event.type === "tool_call") {
        const ok = event.result.ok ? "✓" : "✗";
        const argsPreview = JSON.stringify(event.args);
        appendLog(
          `${ok} ${event.name} — ${event.result.summary || ""}${argsPreview.length > 120 ? ` · ${argsPreview.slice(0, 120)}…` : ` · ${argsPreview}`}`,
          event.result.ok ? "region-task-log-line" : "region-task-log-line is-error",
        );
      } else if (event.type === "assistant_message") appendLog(event.content.slice(0, 280));
      else if (event.type === "phase") appendLog(`phase: ${event.value}`);
    };
    try {
      const result = await run({ mapId: options.mapId, region, instruction, onEvent });
      setSummary(describeRegionTaskResult(result));
      // F: 성공적 실행 시 지시어를 최근 목록에 기록(자동완성 소스).
      if (result.ok) pushRecentInstruction(instruction);
      if (result.pending && !result.pending.settled) {
        await renderPendingCompare(result.pending);
      }
      lastLog = result.log;
      if (result.log) {
        setCopyEnabled(true);
        appendLog(`로그 준비 · 툴 ${result.log.toolCalls.length} · audit ${result.log.audit.length} (헤더 「로그」로 복사)`);
      }
      if (result.error) appendLog(`오류: ${result.error}`, "region-task-log-line is-error");
      if (result.assistantText) appendLog(result.assistantText.slice(0, 400));
    } catch (cause) {
      setSummary(`오류: ${cause instanceof Error ? cause.message : String(cause)}`);
      appendLog(String(cause), "region-task-log-line is-error");
    } finally {
      running = false;
      if (!activePending) {
        runButton.disabled = false;
        textarea.disabled = false;
        updateStampButtonState();
      }
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
  copyLogButton.addEventListener("click", () => void copyLastLog());
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void execute();
    }
  });

  // ── 스탬프로 만들기 (보조 동작) ──────────────────────────────────────────
  // AI 실행/제안 대기 중에는 비활성화. 인라인 입력필드로 전환 후 Enter=저장, Esc=취소.
  const saveStamp = options.saveStamp ?? saveRegionAsStamp;
  const stampButton = el("button", {
    class: "region-task-stamp",
    text: "스탬프로 만들기",
    attrs: { type: "button", title: "이 영역을 '내 스탬프'에 저장하고 페인트 브러시로 즉시 활성화" },
    dataset: { testid: "region-task-stamp" },
  }) as HTMLButtonElement;
  const stampInput = el("input", {
    class: "region-task-stamp-input",
    attrs: { type: "text", placeholder: "스탬프 이름" },
    dataset: { testid: "region-task-stamp-input" },
  }) as HTMLInputElement;
  const stampConfirm = el("button", {
    class: "region-task-stamp-confirm",
    text: "✓",
    attrs: { type: "button", title: "저장 (Enter)" },
    dataset: { testid: "region-task-stamp-confirm" },
  }) as HTMLButtonElement;
  const stampCancel = el("button", {
    class: "region-task-stamp-cancel",
    text: "✕",
    attrs: { type: "button", title: "취소 (Esc)" },
    dataset: { testid: "region-task-stamp-cancel" },
  }) as HTMLButtonElement;
  const stampEditor = el("div", {
    class: "region-task-stamp-editor hidden",
    dataset: { testid: "region-task-stamp-editor" },
    children: [stampInput, stampConfirm, stampCancel],
  });
  // running/activePending 변화를 반영하기 위한 게이터 — execute()/settlePendingUi() 끝에서 호출.
  const updateStampButtonState = (): void => {
    const busy = running || activePending !== null;
    stampButton.disabled = busy;
    stampButton.title = busy
      ? "AI 작업 중에는 스탬프를 만들 수 없습니다"
      : "이 영역을 '내 스탬프'에 저장하고 페인트 브러시로 즉시 활성화";
  };
  updateStampButtonState();
  const enterStampEditor = (): void => {
    stampButton.classList.add("hidden");
    stampEditor.classList.remove("hidden");
    stampInput.value = stampEditorInitialName();
    stampInput.focus();
    stampInput.select?.();
  };
  const exitStampEditor = (): void => {
    stampEditor.classList.add("hidden");
    stampButton.classList.remove("hidden");
    stampInput.value = "";
  };
  // 기본 이름: 현재 타일셋 기준 defaultStampName. 맵/타일셋 접근 불가시 폴백.
  const stampEditorInitialName = (): string => {
    const proj = options.projectForStampName?.() ?? store.getCurrent();
    const map = proj?.maps?.[options.mapId];
    const tileset = map ? proj?.tilesets?.[map.tilesetId] : undefined;
    return defaultStampName(tileset, region);
  };
  const commitStamp = (): void => {
    const result = saveStamp({ mapId: options.mapId, region, name: stampInput.value });
    if (result?.ok) {
      discardAndClose();
    }
  };
  stampButton.addEventListener("click", () => {
    if (stampButton.disabled) return;
    enterStampEditor();
  });
  stampConfirm.addEventListener("mousedown", (event) => {
    // blur(→focusout 취소) 보다 click 이 먼저 발화하도록 기본 동작 억제.
    event.preventDefault();
  });
  stampConfirm.addEventListener("click", () => commitStamp());
  stampCancel.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  stampCancel.addEventListener("click", () => exitStampEditor());
  stampInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitStamp();
    } else if (event.key === "Escape") {
      event.preventDefault();
      exitStampEditor();
    }
  });
  stampInput.addEventListener("focusout", () => {
    // [✓]/[✕] 버튼 클릭은 mousedown preventDefault 로 blur 를 막았으므로,
    // 여기 도달하면 다른 곳 클릭(박스 바깥 등)이다. 취소로 간주.
    if (!stampEditor.classList.contains("hidden")) exitStampEditor();
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
    } else if (event.key === "s" || event.key === "S") {
      event.preventDefault();
      enterStampEditor();
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

  const actions = el("div", {
    class: "region-task-actions",
    children: [runButton, stampButton, stampEditor],
  });
  const asPopover = Boolean(options.anchor);
  const windowNode = el("div", {
    class: asPopover ? "region-task-modal region-task-popover" : "region-task-modal",
    attrs: { role: "dialog", "aria-label": "영역 작업" },
    dataset: { testid: asPopover ? "region-task-popover" : "region-task-modal" },
    children: [header, textarea, suggestionRow, autocompleteHost, log, summary, compareHost, actions],
  });
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
  const maxWidth = Math.min(360, Math.max(200, vw - margin * 2));
  const maxHeight = Math.max(160, vh - margin * 2);

  panel.style.position = "fixed";
  panel.style.width = `${maxWidth}px`;
  panel.style.maxWidth = `min(360px, calc(100vw - ${margin * 2}px))`;
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
