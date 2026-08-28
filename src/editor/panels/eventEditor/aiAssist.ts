// editor/panels/eventEditor/aiAssist.ts
// 이벤트 에디터 「AI 명령」 작성기. 「이 페이지가 하는 일」 칼럼 **맨 아래에 붙는 인플로우 도크**다.
// 자연어 입력 → runEventCommandAssist(순수 로직) → 프리뷰(commandSummaryParts 요약)
// → [넣기] 시 CommandListActions 로 반영. LLM 설정은 loadAiConfig 재사용.
//
// 왜 도크인가(실측): 예전에는 도구 팝오버 안의 칩이 `position:absolute` 카드로 열려
// **자기가 명령을 넣을 목록을 덮었다**(1440 폭에서 목록 면적의 46%, 1024 폭에서는 전폭).
// 삽입 위치를 못 보면서 삽입 위치를 고르라고 하는 구조였다. 도크는 목록을 밀어 올리므로
// 프롬프트를 쓰는 동안에도 선택한 명령과 삽입 지점이 계속 보인다.
//
// 스토어 갱신 때마다 에디터 본문이 통째로 재렌더되므로, 입력 초안/펼침 상태/프리뷰는
// 모듈 레벨 캐시(이벤트+페이지 키)로 보존해 재렌더 후 복원한다.

import { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { isAiConfigReady } from "@/editor/panels/aiChatPanelHelpers";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { auxCompositeKey } from "./auxOpenController";
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
let panelInstanceId = 0;

const TARGET_NAME_MAX = 18;

// 예시는 입력을 채우기만 한다 — 누른 즉시 LLM 을 호출하면 의도와 다른 초안에 돈을 쓴다.
const PROMPT_EXAMPLES: readonly { readonly label: string; readonly prompt: string }[] = [
  {
    label: "보물상자",
    prompt: "열면 회복약 2개를 주고 이 이벤트 기억 A를 켠다. 이미 열었으면 «비어 있다»고 말한다.",
  },
  {
    label: "말 거는 NPC",
    prompt: "인사하고 마을 소문을 한 줄 말한 뒤, 계속 물어볼지 «네/아니오»로 묻는다.",
  },
  {
    label: "문 통과",
    prompt: "«문이 열렸다»고 말한 다음 여관 안으로 장소를 옮긴다.",
  },
];

function stateOf(key: string): PanelState {
  const existing = panelStates.get(key);
  if (existing) return existing;
  const fresh: PanelState = { open: false, draft: "", preview: null, status: "", statusKind: "" };
  panelStates.set(key, fresh);
  return fresh;
}

// 칩 배지는 한국어만 쓴다. 예전에는 `busy`/`error`/`ready`/`draft` 영문 기계 토큰이
// 한국어 UI 위에 그대로 노출됐다.
function chipStatusOf(state: PanelState): { text: string; kind: string; quiet: boolean } {
  if (state.statusKind === "busy") return { text: "생성 중", kind: "busy", quiet: false };
  if (state.statusKind === "error") return { text: "오류", kind: "error", quiet: false };
  if (state.preview && state.preview.length > 0) {
    return { text: `초안 ${state.preview.length}개`, kind: "ready", quiet: false };
  }
  if (state.draft.trim().length > 0) return { text: "작성 중", kind: "idle", quiet: false };
  return { text: "", kind: "idle", quiet: true };
}

export function renderEventAiAssist(options: EventAiAssistOptions): HTMLElement {
  const { mapId, eventId, page, actions, cmdList } = options;
  const key = auxCompositeKey(mapId, eventId, page.id);
  const state = stateOf(key);
  const instanceId = ++panelInstanceId;
  const headingId = `event-ai-heading-${instanceId}`;
  const inputId = `event-ai-input-${instanceId}`;
  const promptHelpId = `event-ai-prompt-help-${instanceId}`;
  const resultTitleId = `event-ai-result-title-${instanceId}`;

  const root = el("details", {
    class: "ai-event-assist",
    dataset: { testid: "ai-event-assist" },
  }) as HTMLDetailsElement;
  root.open = state.open;

  const input = el("textarea", {
    class: "ai-event-input",
    attrs: {
      id: inputId,
      rows: "3",
      "aria-describedby": promptHelpId,
      placeholder: "예) 열면 회복약 2개를 주고, 이미 열었으면 «비어 있다»고 말한다",
    },
    dataset: { testid: "ai-event-input" },
  });
  input.value = state.draft;

  const status = el("div", {
    class: "ai-event-status",
    text: state.status,
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "ai-event-status" },
  });
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

  const setStatus = (text: string, kind: StatusKind = ""): void => {
    state.status = text;
    state.statusKind = kind;
    status.textContent = text;
    status.className = `ai-event-status${kind ? ` ${kind}` : ""}`;
    refreshChip();
  };

  // 재렌더 시 기존 statusKind 클래스 복원.
  if (state.statusKind) status.className = `ai-event-status ${state.statusKind}`;

  // ── 삽입 위치 표시 ─────────────────────────────────────────────────────────
  // 선택 상태는 스토어 갱신 없이 클래스만 바뀌므로 목록 클릭·패널 열기 때마다 다시 읽는다.
  const target = el("span", {
    class: "ai-event-target",
    dataset: { testid: "ai-event-target" },
  });
  const insertBtn = button("맨 아래에 넣기", "ai-event-insert", "primary");
  const refreshTarget = (): void => {
    const path = selectedCommandPath(cmdList);
    const name = path ? commandNameAtPath(page.commands, path) : null;
    if (name) {
      target.textContent = `「${name}」 다음에 넣습니다`;
      insertBtn.textContent = "선택한 명령 다음에 넣기";
    } else {
      target.textContent = "맨 아래에 이어서 넣습니다";
      insertBtn.textContent = "맨 아래에 넣기";
    }
  };
  refreshTarget();
  cmdList.addEventListener("click", refreshTarget);

  input.addEventListener("input", () => {
    state.draft = input.value;
    // 사용자가 고치는 중이면 지난 오류는 유효하지 않다. 예전에는 «생성할 내용을
    // 입력하세요» 가 입력을 다 쓴 뒤에도 빨간 글씨로 남아 있었다.
    if (state.statusKind === "error") setStatus("");
    else refreshChip();
  });

  const previewHost = el("div", {
    class: "ai-event-preview",
    dataset: { testid: "ai-event-preview" },
  });

  const discardBtn = button("버리기", "ai-event-discard");
  const previewFooter = el("div", { class: "ai-event-preview-actions", children: [insertBtn, discardBtn] });
  const resultTitle = el("h4", {
    class: "ai-event-result-title",
    text: "만든 명령",
    attrs: { id: resultTitleId },
    dataset: { testid: "ai-event-result-title" },
  });
  const resultMeta = el("span", { class: "ai-event-result-meta" });
  const resultSection = el("section", {
    class: "ai-event-result",
    attrs: { role: "region", "aria-labelledby": resultTitleId },
    dataset: { testid: "ai-event-result" },
    children: [
      el("div", { class: "ai-event-result-header", children: [resultTitle, resultMeta] }),
      previewHost,
      previewFooter,
    ],
  });

  const renderPreview = (): void => {
    previewHost.textContent = "";
    const commands = state.preview;
    if (!commands) {
      resultSection.hidden = true;
      previewHost.hidden = true;
      previewFooter.hidden = true;
      resultMeta.textContent = "";
      refreshChip();
      return;
    }
    resultSection.hidden = false;
    previewHost.hidden = false;
    previewFooter.hidden = false;
    refreshTarget();
    resultMeta.textContent = `${commands.length}개 · 넣기 전에 확인하세요`;
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

  const generateBtn = el("button", {
    class: "ai-event-btn primary ai-event-generate",
    attrs: { type: "button", title: "초안 만들기 (Ctrl+Enter)" },
    dataset: { testid: "ai-event-generate" },
    children: [
      el("span", { class: "ai-event-generate-label", text: "초안 만들기" }),
      el("kbd", { class: "ai-event-kbd", text: "Ctrl↵" }),
    ],
  }) as HTMLButtonElement;

  const generate = async (): Promise<void> => {
    if (generateBtn.disabled) return;
    const prompt = input.value.trim();
    if (!prompt) {
      setStatus("무엇을 하는 이벤트인지 한 줄 적어 주세요.", "error");
      input.focus();
      return;
    }
    const config = (options.loadConfig ?? loadAiConfig)();
    if (!isAiConfigReady(config)) {
      setStatus(
        config.authMode === "chatgpt"
          ? "AI 설정에서 ChatGPT 연결과 모델을 확인하세요."
          : "AI 설정에서 연결 방식(구독 로그인 또는 API 키)을 완료하세요.",
        "error"
      );
      return;
    }
    generateBtn.disabled = true;
    setStatus("명령 초안을 만들고 있어요…", "busy");
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
        `명령 ${result.commands.length}개를 만들었어요. 아래에서 확인하세요.`
          + (result.attempts > 1 ? ` (스스로 ${result.attempts - 1}번 고쳤습니다)` : "")
      );
      renderPreview();
    } catch (cause) {
      // 검증기 원문(kind/필드 이름)은 원인 추적에 필요하니 버리지 않고, 사용자가 다음에
      // 무엇을 할지 아는 한 줄을 앞에 붙인다.
      const detail = cause instanceof Error ? cause.message : String(cause);
      setStatus(`명령을 만들지 못했어요. 문장을 조금 더 구체적으로 적고 다시 시도해 보세요. — ${detail}`, "error");
    } finally {
      generateBtn.disabled = false;
    }
  };

  generateBtn.addEventListener("click", () => void generate());
  input.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void generate();
    }
  });

  insertBtn.addEventListener("click", () => {
    const commands = state.preview;
    if (!commands || commands.length === 0) return;
    // 삽입 전에 캐시를 비워, 스토어 갱신으로 재생성될 패널이 빈 프리뷰로 복원되게 한다.
    state.preview = null;
    const base = selectedCommandPath(cmdList);
    state.status = `명령 ${commands.length}개를 넣었어요. 되돌리려면 툴바의 ↶ 되돌리기.`;
    state.statusKind = "";
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
    setStatus("초안을 버렸어요.");
    renderPreview();
  });

  const examples = el("div", {
    class: "ai-event-examples",
    attrs: { role: "group", "aria-label": "예시 문장" },
    dataset: { testid: "ai-event-examples" },
    children: PROMPT_EXAMPLES.map((example, index) => el("button", {
      class: "ai-event-example",
      text: example.label,
      attrs: { type: "button", title: example.prompt },
      dataset: { testid: `ai-event-example-${index}` },
      on: {
        click: () => {
          input.value = example.prompt;
          state.draft = example.prompt;
          if (state.statusKind === "error") setStatus("");
          else refreshChip();
          input.focus();
          input.setSelectionRange(example.prompt.length, example.prompt.length);
        },
      },
    })),
  });

  // Escape 는 모달 스택 최상단만 닫는다. 도크가 열려 있으면 도크가 최상단이므로
  // 예전처럼 «프롬프트 쓰다가 Escape → 이벤트 에디터 전체가 닫힘» 이 나지 않는다.
  root.addEventListener("toggle", () => {
    state.open = root.open;
    if (root.open) {
      registerModal(root, () => { root.open = false; });
      refreshTarget();
      input.focus();
    } else {
      unregisterModal(root);
    }
  });
  if (root.open) registerModal(root, () => { root.open = false; });

  root.append(
    el("summary", {
      class: "ai-event-assist-summary event-aux-chip-summary",
      children: [
        el("span", { class: "event-aux-chip-icon", attrs: { "aria-hidden": "true" }, text: "✧" }),
        el("span", { class: "event-aux-chip-label", text: "AI로 명령 만들기" }),
        chipStatus,
        el("span", { class: "ai-event-caret", attrs: { "aria-hidden": "true" }, text: "▾" }),
      ],
    }),
    el("div", {
      class: "ai-event-assist-body",
      children: [
        el("div", {
          class: "ai-event-compose",
          children: [
            el("label", {
              class: "ai-event-prompt-label",
              text: "이 페이지가 무엇을 하면 되나요?",
              attrs: { for: inputId, id: headingId },
              dataset: { testid: "ai-event-prompt-label" },
            }),
            input,
            el("div", {
              class: "ai-event-hintrow",
              children: [
                el("span", {
                  class: "ai-event-prompt-help",
                  text: "대사·조건·보상을 한 문장으로 적어도 됩니다.",
                  attrs: { id: promptHelpId },
                }),
                examples,
              ],
            }),
            el("div", { class: "ai-event-generate-row", children: [target, status, generateBtn] }),
          ],
        }),
        resultSection,
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

// 삽입 위치 라벨용 짧은 명령 이름.
function commandNameAtPath(commands: Command[], path: readonly number[]): string | null {
  const command = resolveCommandAtPath(commands, path);
  if (!command) return null;
  const parts = commandSummaryParts(command);
  const name = parts.map((part) => part.text).join(" ").replace(/\s+/gu, " ").trim();
  if (!name) return null;
  return name.length > TARGET_NAME_MAX ? `${name.slice(0, TARGET_NAME_MAX)}…` : name;
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
