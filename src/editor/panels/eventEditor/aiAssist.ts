// editor/panels/eventEditor/aiAssist.ts
// 이벤트 에디터 "✨ AI로 명령 생성" 패널(커맨드 리스트 하단, 접이식).
// 자연어 입력 → runEventCommandAssist(순수 로직) → 프리뷰(commandSummaryParts 요약)
// → [선택 위치에 삽입] 시 CommandListActions로 반영. LLM 설정은 loadAiConfig 재사용.
//
// 스토어 갱신 때마다 에디터 본문이 통째로 재렌더되므로, 입력 초안/펼침 상태/프리뷰는
// 모듈 레벨 캐시(이벤트+페이지 키)로 보존해 재렌더 후 복원한다.
// open 은 auxOpenController 배타 아코디언과 동기화한다(draft/preview 는 닫아도 유지).

import { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { auxCompositeKey, bindAuxDetails, getAuxOpen, isAuxOpenApplying, setAuxOpen } from "./auxOpenController";
import { commandSummaryParts, type CommandSummaryPart } from "./commandSummary";
import type { CommandListActions } from "./types";

export interface EventAiAssistOptions {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  readonly actions: CommandListActions;
  // 현재 선택 커맨드 조회용 커맨드 리스트 루트(.cmd-item.selected 탐색).
  readonly cmdList: HTMLElement;
  // 테스트 주입용 설정 로더(생략 시 loadAiConfig).
  readonly loadConfig?: () => AiConfig;
}

type StatusKind = "" | "error" | "busy";

// 재렌더를 살아남는 패널 상태(이벤트+페이지 단위).
type PanelState = {
  open: boolean;
  draft: string;
  preview: Command[] | null;
  status: string;
  statusKind: StatusKind;
};

const panelStates = new Map<string, PanelState>();

function stateOf(key: string): PanelState {
  const existing = panelStates.get(key);
  if (existing) return existing;
  const fresh: PanelState = { open: false, draft: "", preview: null, status: "", statusKind: "" };
  panelStates.set(key, fresh);
  return fresh;
}

// setAuxOpen/toggle 경로에서 panelStates.open 을 맞춘다. 배타 닫기는 details.toggle 재진입으로 동기화.

function chipStatusOf(state: PanelState): { text: string; kind: string; quiet: boolean } {
  if (state.statusKind === "busy") return { text: "busy", kind: "busy", quiet: false };
  if (state.statusKind === "error") return { text: "error", kind: "error", quiet: false };
  if (state.preview && state.preview.length > 0) return { text: "ready", kind: "ready", quiet: false };
  // idle + draft/preview 없음 → 칩 노이즈 숨김 (aria-hidden / empty)
  if (state.draft.trim().length > 0) return { text: "draft", kind: "idle", quiet: false };
  return { text: "", kind: "idle", quiet: true };
}

export function renderEventAiAssist(options: EventAiAssistOptions): HTMLElement {
  const { mapId, eventId, page, actions, cmdList } = options;
  const key = auxCompositeKey(mapId, eventId, page.id);
  const state = stateOf(key);

  // 소스 오브 트루스: auxOpenController. panelStates.open 은 레거시 복원용으로만 이관.
  if (getAuxOpen(key) === null && state.open) {
    setAuxOpen(key, "ai");
  } else {
    state.open = getAuxOpen(key) === "ai";
  }

  const root = el("details", {
    class: "ai-event-assist",
    dataset: { testid: "ai-event-assist" },
  }) as HTMLDetailsElement;
  bindAuxDetails(key, "ai", root);
  root.addEventListener("toggle", () => {
    state.open = root.open;
    if (isAuxOpenApplying()) return;
    if (root.open) setAuxOpen(key, "ai");
    else if (getAuxOpen(key) === "ai") setAuxOpen(key, null);
    // 배타 닫기 후 다른 패널이 열릴 때 AI state 는 setAuxOpen → toggle(applying) 경로로 동기화.
    state.open = getAuxOpen(key) === "ai";
  });

  const input = el("textarea", {
    class: "ai-event-input",
    attrs: {
      rows: "3",
      placeholder: "예) 보물상자: 열면 회복약 2개 주고 셀프스위치 A ON, 이미 열었으면 '비어 있다' 표시",
    },
    dataset: { testid: "ai-event-input" },
  });
  input.value = state.draft;

  const status = el("div", { class: "ai-event-status", text: state.status });
  const chip = chipStatusOf(state);
  const chipStatus = el("span", {
    class: "event-aux-chip-status",
    text: chip.text,
    dataset: { testid: "ai-event-chip-status", kind: chip.kind },
    attrs: chip.quiet ? { "aria-hidden": "true" } : {},
  });
  if (chip.quiet) chipStatus.hidden = true;

  const refreshChip = (): void => {
    const next = chipStatusOf(state);
    chipStatus.textContent = next.text;
    chipStatus.dataset.kind = next.kind;
    chipStatus.hidden = next.quiet;
    if (next.quiet) chipStatus.setAttribute("aria-hidden", "true");
    else chipStatus.removeAttribute("aria-hidden");
  };

  input.addEventListener("input", () => {
    state.draft = input.value;
    refreshChip();
  });

  const setStatus = (text: string, kind: StatusKind = ""): void => {
    state.status = text;
    state.statusKind = kind;
    status.textContent = text;
    status.className = `ai-event-status${kind ? ` ${kind}` : ""}`;
    refreshChip();
  };

  // 재렌더 시 기존 statusKind 클래스 복원.
  if (state.statusKind) status.className = `ai-event-status ${state.statusKind}`;

  const previewHost = el("div", {
    class: "ai-event-preview",
    dataset: { testid: "ai-event-preview" },
  });

  const insertBtn = button("선택 위치에 삽입", "ai-event-insert", "primary");
  const discardBtn = button("버리기", "ai-event-discard");
  const previewFooter = el("div", { class: "ai-event-preview-actions", children: [insertBtn, discardBtn] });

  const renderPreview = (): void => {
    previewHost.textContent = "";
    const commands = state.preview;
    if (!commands) {
      previewHost.hidden = true;
      previewFooter.hidden = true;
      refreshChip();
      return;
    }
    previewHost.hidden = false;
    previewFooter.hidden = false;
    for (const line of previewLines(commands, 0)) {
      const row = el("div", { class: "ai-event-preview-line" });
      row.style.setProperty("--cmd-depth", String(line.depth));
      for (const part of line.parts) {
        row.append(el("span", { class: `cmd-summary-token ${part.tone}`, text: part.text }));
      }
      previewHost.append(row);
    }
    refreshChip();
  };

  const generateBtn = button("생성", "ai-event-generate", "primary");
  generateBtn.addEventListener("click", async () => {
    const prompt = input.value.trim();
    if (!prompt) {
      setStatus("생성할 내용을 입력하세요.", "error");
      return;
    }
    const config = (options.loadConfig ?? loadAiConfig)();
    if (!config.apiKey || !config.apiKey.trim()) {
      setStatus("AI 설정에서 API 키를 입력하세요.", "error");
      return;
    }
    generateBtn.disabled = true;
    setStatus("생성 중…", "busy");
    try {
      const project = store.getCurrent();
      const event = project.maps[mapId]?.events.find((entry) => entry.id === eventId);
      const result = await runEventCommandAssist({
        config,
        prompt,
        context: { project, mapId, event, page, selection: selectedCommandPath(cmdList) },
      });
      state.preview = result.commands;
      setStatus(
        `커맨드 ${result.commands.length}개 생성됨` + (result.attempts > 1 ? ` (자가수정 ${result.attempts - 1}회)` : "")
      );
      renderPreview();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause), "error");
    } finally {
      generateBtn.disabled = false;
    }
  });

  insertBtn.addEventListener("click", () => {
    const commands = state.preview;
    if (!commands || commands.length === 0) return;
    // 삽입 전에 캐시를 비워, 스토어 갱신으로 재생성될 패널이 빈 프리뷰로 복원되게 한다.
    state.preview = null;
    state.status = `커맨드 ${commands.length}개 삽입됨`;
    state.statusKind = "";
    const base = selectedCommandPath(cmdList);
    if (base && base.length > 0) {
      // 선택된 커맨드 "바로 뒤"부터 순서대로 삽입.
      const prefix = base.slice(0, -1);
      const start = base[base.length - 1] + 1;
      commands.forEach((command, index) => actions.insertCommand([...prefix, start + index], command));
    } else {
      // 선택이 없으면 페이지 끝에 순서대로 추가.
      for (const command of commands) actions.addCommand([], command);
    }
    renderPreview();
    setStatus(state.status);
  });

  discardBtn.addEventListener("click", () => {
    state.preview = null;
    setStatus("프리뷰를 버렸습니다.");
    renderPreview();
  });

  root.append(
    el("summary", {
      class: "ai-event-assist-summary event-aux-chip-summary",
      children: [
        el("span", { class: "event-aux-chip-icon", attrs: { "aria-hidden": "true" }, text: "✦" }),
        el("span", { class: "event-aux-chip-label", text: "AI 명령" }),
        chipStatus,
      ],
    }),
    el("div", {
      class: "ai-event-assist-body",
      children: [
        input,
        el("div", { class: "ai-event-generate-row", children: [generateBtn, status] }),
        previewHost,
        previewFooter,
      ],
    })
  );
  renderPreview();
  return root;
}

// 현재 선택된 커맨드의 경로(.cmd-item.selected → data-cmd-path). 없으면 null.
function selectedCommandPath(cmdList: HTMLElement): number[] | null {
  const selected = cmdList.querySelector<HTMLElement>(".cmd-item.selected");
  const raw = selected?.dataset.cmdPath;
  if (!raw) return null;
  try {
    const path = JSON.parse(raw) as unknown;
    return Array.isArray(path) && path.every((part) => Number.isInteger(part)) ? (path as number[]) : null;
  } catch {
    return null;
  }
}

// ── 프리뷰 요약(중첩은 들여쓰기 라인으로 평탄화) ─────────────────────────────

type PreviewLine = { readonly parts: readonly CommandSummaryPart[]; readonly depth: number };

function markerLine(text: string, depth: number): PreviewLine {
  return { parts: [{ text, tone: "plain" }], depth };
}

function previewLines(commands: readonly Command[], depth: number): PreviewLine[] {
  const lines: PreviewLine[] = [];
  for (const command of commands) {
    lines.push({ parts: commandSummaryParts(command), depth });
    if (command.kind === "fork") {
      lines.push(...previewLines(command.then, depth + 1));
      if (command.else && command.else.length > 0) {
        lines.push(markerLine(": 그 외의 경우", depth));
        lines.push(...previewLines(command.else, depth + 1));
      }
    } else if (command.kind === "choices") {
      command.options.forEach((option, index) => {
        lines.push(markerLine(`: ${option.text || `선택지 ${index + 1}`}`, depth));
        lines.push(...previewLines(option.branch, depth + 1));
      });
      if (command.cancelBranch && command.cancelBranch.length > 0) {
        lines.push(markerLine(": 취소할 때", depth));
        lines.push(...previewLines(command.cancelBranch, depth + 1));
      }
    } else if (command.kind === "loop") {
      lines.push(...previewLines(command.body, depth + 1));
    }
  }
  return lines;
}

function button(text: string, testid: string, variant?: "primary"): HTMLButtonElement {
  return el("button", {
    class: `ai-event-btn${variant ? ` ${variant}` : ""}`,
    text,
    attrs: { type: "button" },
    dataset: { testid },
  }) as HTMLButtonElement;
}
