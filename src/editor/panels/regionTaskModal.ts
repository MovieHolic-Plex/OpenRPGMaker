// 선택 영역 AI 작업 모달/팝오버.
// - 우클릭 메뉴 "이 영역에 AI 작업…"
// - 우클릭 드래그 종료 후 포인터 근처 팝오버 (anchor)
// 지시를 받아 runRegionTask로 넘기고(사각형 하드 스코프), 진행/결과를 표시한다.
// 개발 편의: 헤더 「로그」 작은 버튼 → 감사/툴/하네스 JSON 클립보드 복사.
import type { SessionEvent } from "@/ai/assistantSession";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import {
  describeRegionTaskResult,
  runRegionTask,
  serializeRegionTaskLog,
  type RegionTaskLogExport,
  type RegionTaskResult,
} from "@/editor/regionTask/runRegionTask";
import type { MapId } from "@/project/types";
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
    on: { click: () => closeRegionTaskModal() },
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
    children: [titleRow, chip, closeButton],
  });

  const textarea = el("textarea", {
    class: "region-task-input",
    attrs: { placeholder: "이 영역에 무엇을 할까요? 예: 침엽수 숲으로 채워줘", rows: "3" },
    dataset: { testid: "region-task-input" },
  }) as HTMLTextAreaElement;
  if (options.initialInstruction) textarea.value = options.initialInstruction;

  const log = el("div", { class: "region-task-log", dataset: { testid: "region-task-log" } });
  const summary = el("div", { class: "region-task-summary", dataset: { testid: "region-task-summary" } });

  const runButton = el("button", {
    class: "region-task-run",
    text: "실행",
    attrs: { type: "button" },
    dataset: { testid: "region-task-run" },
  }) as HTMLButtonElement;

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
    runButton.disabled = true;
    textarea.disabled = true;
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
      runButton.disabled = false;
      textarea.disabled = false;
    }
  };

  runButton.addEventListener("click", () => void execute());
  copyLogButton.addEventListener("click", () => void copyLastLog());
  textarea.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void execute();
    }
  });

  const actions = el("div", { class: "region-task-actions", children: [runButton] });
  const asPopover = Boolean(options.anchor);
  const windowNode = el("div", {
    class: asPopover ? "region-task-modal region-task-popover" : "region-task-modal",
    attrs: { role: "dialog", "aria-label": "영역 작업" },
    dataset: { testid: asPopover ? "region-task-popover" : "region-task-modal" },
    children: [header, textarea, log, summary, actions],
  });
  // Escape는 backdrop에 건다(포커스된 textarea의 keydown이 여기로 버블). document
  // 리스너를 피해 fakeDom과 실제 DOM 모두에서 동작.
  const backdrop = el("div", {
    class: asPopover ? "region-task-backdrop region-task-backdrop-popover" : "region-task-backdrop",
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
  if (asPopover && options.anchor) {
    positionRegionTaskPopover(windowNode, options.anchor);
  }
  textarea.focus();
  if (options.autoRun) void execute();
  return backdrop;
}

function positionRegionTaskPopover(panel: HTMLElement, anchor: RegionTaskAnchor): void {
  const margin = 12;
  const width = Math.min(360, Math.max(280, window.innerWidth - margin * 2));
  panel.style.position = "fixed";
  panel.style.width = `${width}px`;
  panel.style.maxWidth = `min(360px, calc(100vw - ${margin * 2}px))`;
  // 먼저 배치한 뒤 실측 크기로 화면 안으로 클램프.
  panel.style.left = `${anchor.x + 12}px`;
  panel.style.top = `${anchor.y + 12}px`;
  const rect = panel.getBoundingClientRect?.() ?? { width, height: 220, left: anchor.x, top: anchor.y };
  let left = anchor.x + 12;
  let top = anchor.y + 12;
  if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, anchor.x - rect.width - 12);
  if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - rect.height - margin);
  if (left < margin) left = margin;
  if (top < margin) top = margin;
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
