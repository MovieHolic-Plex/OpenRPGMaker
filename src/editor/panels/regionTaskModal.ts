// 선택 영역 AI 작업 모달. 우클릭 메뉴 "이 영역에 AI 작업…"이 연다.
// 지시를 받아 runRegionTask로 넘기고(사각형 하드 스코프), 진행/결과를 표시한다.
import type { SessionEvent } from "@/ai/assistantSession";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runRegionTask, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import type { MapId } from "@/project/types";
import { el } from "@/util/dom";

type RegionTaskRunner = (opts: {
  mapId: MapId;
  region: RegionRect;
  instruction: string;
  onEvent?: (event: SessionEvent) => void;
}) => Promise<RegionTaskResult>;

export interface RegionTaskModalOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  // 테스트 주입: 기본은 실제 runRegionTask.
  readonly run?: RegionTaskRunner;
}

let modalRoot: HTMLElement | null = null;

export function closeRegionTaskModal(): void {
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
  const closeButton = el("button", {
    class: "region-task-close",
    text: "✕",
    attrs: { type: "button", "aria-label": "닫기" },
    dataset: { testid: "region-task-close" },
    on: { click: () => closeRegionTaskModal() },
  });
  const header = el("div", {
    class: "region-task-header",
    children: [el("span", { class: "region-task-title", text: "✦ 영역 작업" }), chip, closeButton],
  });

  const textarea = el("textarea", {
    class: "region-task-input",
    attrs: { placeholder: "이 영역에 무엇을 할까요? 예: 침엽수 숲으로 채워줘", rows: "3" },
    dataset: { testid: "region-task-input" },
  }) as HTMLTextAreaElement;

  const log = el("div", { class: "region-task-log", dataset: { testid: "region-task-log" } });
  const summary = el("div", { class: "region-task-summary", dataset: { testid: "region-task-summary" } });

  const runButton = el("button", {
    class: "region-task-run",
    text: "실행",
    attrs: { type: "button" },
    dataset: { testid: "region-task-run" },
  }) as HTMLButtonElement;

  let running = false;
  const setSummary = (text: string): void => {
    summary.textContent = text;
  };
  const appendLog = (text: string): void => {
    if (!text.trim()) return;
    log.append(el("div", { class: "region-task-log-line", text }));
    while (log.childNodes.length > 8) log.firstChild?.remove();
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
    runButton.disabled = true;
    textarea.disabled = true;
    log.replaceChildren();
    setSummary("AI가 이 영역을 작업 중…");
    const onEvent = (event: SessionEvent): void => {
      if (event.type === "status") appendLog(event.text);
      else if (event.type === "tool_call") appendLog(`· ${event.name}`);
      else if (event.type === "assistant_message") appendLog(event.content);
    };
    try {
      const result = await run({ mapId: options.mapId, region, instruction, onEvent });
      setSummary(describeResult(result));
    } catch (cause) {
      setSummary(`오류: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      running = false;
      runButton.disabled = false;
      textarea.disabled = false;
    }
  };

  runButton.addEventListener("click", () => void execute());
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void execute();
    }
  });

  const actions = el("div", { class: "region-task-actions", children: [runButton] });
  const windowNode = el("div", {
    class: "region-task-modal",
    attrs: { role: "dialog", "aria-label": "영역 작업" },
    dataset: { testid: "region-task-modal" },
    children: [header, textarea, log, summary, actions],
  });
  // Escape는 backdrop에 건다(포커스된 textarea의 keydown이 여기로 버블). document
  // 리스너를 피해 fakeDom과 실제 DOM 모두에서 동작.
  const backdrop = el("div", {
    class: "region-task-backdrop",
    dataset: { testid: "region-task-backdrop" },
    on: {
      click: (event) => {
        if (event.target === backdrop) closeRegionTaskModal();
      },
      keydown: (event) => {
        if ((event as KeyboardEvent).key === "Escape") {
          event.preventDefault();
          closeRegionTaskModal();
        }
      },
    },
    children: [windowNode],
  });

  document.body.append(backdrop);
  modalRoot = backdrop;
  textarea.focus();
  return backdrop;
}

function describeResult(result: RegionTaskResult): string {
  if (!result.ok) return `오류: ${result.error ?? "알 수 없는 오류"}`;
  if (!result.applied) {
    return result.changedCells === 0 ? "이 영역에서 바뀐 것이 없습니다." : "적용할 변경이 없습니다.";
  }
  const clipped = result.clippedCells > 0 ? ` · 영역 밖 ${result.clippedCells}칸 차단` : "";
  return `완료 — ${result.changedCells}칸 변경${clipped}`;
}
