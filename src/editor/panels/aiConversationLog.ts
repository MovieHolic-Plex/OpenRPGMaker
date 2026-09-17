// editor/panels/aiConversationLog.ts
// RM @> 커맨드 로·추론·타일 시각 자료. 패널 클로저에서 팩토리로 상태만 공유한다.
//
// 2026-09-17(방향 G): 툴 활동·변경 카드는 더 이상 로그에 붙지 않는다. 이 호스트는 행을 **만들기만** 하고
// `workSink`(작업 띠, aiWorkStrip) 에 넘긴다 — 대화 창에는 말풍선·질문·시각 자료만 남는다.

import type { AuditEntry } from "@/ai/assistantSession";
import type { ToolResult } from "@/editor/tools";
import { renderAiDocument } from "@/editor/panels/aiDocRenderers";
import { getEditorChrome } from "@/editor/editorUiMode";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { AiDocument } from "@/project/types";
import { formatRunRecapPlayerLine, parseRunRecapPayload } from "@/ai/runRecap";
import { renderAssistantAnswer } from "./aiAnswerLinkRender";
import { el } from "@/util/dom";
import {
  reasoningToggleText,
  renderToolActivityEntry,
} from "./aiChatRenderers";
import {
  aiDayKey,
  displayUserAuditText,
  formatAiDayLabel,
  isReadOnlyToolNoise,
  parseAiDayDate,
  type TileGridData,
} from "./aiChatPanelHelpers";

export type AiBubbleRole = "user" | "assistant" | "tool" | "system";

const COMMAND_PREFIX = "@>" as const;

function logElements(log: HTMLElement): HTMLElement[] {
  return Array.from(log.childNodes).filter(
    (node): node is HTMLElement => Boolean(node && (node as HTMLElement).classList)
  );
}

function lastCommandRow(log: HTMLElement): HTMLElement | null {
  const children = logElements(log);
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child?.classList.contains("ai-command-row")) return child;
  }
  return null;
}

function attachToLastRow(log: HTMLElement, node: HTMLElement): void {
  (lastCommandRow(log) ?? log).append(node);
}

/** 기록 뷰용 날짜 구분선 — 같은 날이면 생략. */
export function ensureDayDivider(log: HTMLElement, at: Date = new Date()): HTMLElement | null {
  const key = aiDayKey(at);
  let lastKey: string | null = null;
  for (const child of logElements(log)) {
    const day = child.dataset?.dayKey;
    if (day) lastKey = day;
  }
  if (lastKey === key) return null;
  const divider = el("div", {
    class: "ai-day-divider",
    dataset: { testid: "ai-day-divider", dayKey: key },
    children: [el("span", { class: "ai-day-divider-label", text: formatAiDayLabel(at) })],
  });
  log.append(divider);
  return divider;
}

/**
 * 새 사용자 턴이 시작되면 직전 턴 노드를 접이식 그룹으로 묶는다.
 * 새 턴을 시작할 때 기존 노드를 그룹으로 묶고, 실제 축약은 `.is-collapsed`가 맡는다.
 */
export function markPriorTurns(log: HTMLElement): void {
  const children = logElements(log);
  const keep: HTMLElement[] = [];
  const toWrap: HTMLElement[] = [];
  for (const child of children) {
    if (child.classList.contains("ai-start-screen") || child.classList.contains("ai-day-divider")) {
      keep.push(child);
      continue;
    }
    if (child.classList.contains("ai-turn-group") || child.classList.contains("is-prior-turn")) {
      child.classList.add("is-prior-turn");
      keep.push(child);
      continue;
    }
    toWrap.push(child);
  }
  if (toWrap.length === 0) return;

  for (const node of toWrap) node.classList.add("is-prior-turn");

  const previewSource = toWrap.find((node) => node.dataset.role === "user");
  const previewBody = previewSource?.querySelector(".ai-command-row-body") ?? previewSource;
  // 요약은 한 줄로 줄인다. 자를 때는 말줄임표를 붙인다 — 없으면 문장이 단어 중간에서
  // 끊겨(실측: "…북쪽 숲에서 마을") 잘린 UI 로 읽힌다.
  const previewFull = (previewBody?.textContent ?? "이전 턴").replace(/\s+/gu, " ").trim();
  const preview = (previewFull.length > 36 ? `${previewFull.slice(0, 36)}…` : previewFull) || "이전 턴";

  const body = el("div", {
    class: "ai-turn-group-body",
    dataset: { testid: "ai-turn-group-body" },
  });
  // FakeElement.append는 이전 부모에서 떼지 않을 수 있어 remove 후 붙인다.
  for (const node of toWrap) {
    node.parentNode?.removeChild?.(node);
    body.append(node);
  }

  const group = el("div", {
    class: "ai-turn-group is-prior-turn is-collapsed",
    dataset: { testid: "ai-turn-group" },
  });
  const toggle = el("button", {
    class: "ai-turn-group-toggle",
    attrs: {
      type: "button",
      title: "이전 턴 펼치기/접기",
      "aria-expanded": "false",
      "aria-label": "이전 턴 펼치기/접기",
    },
    dataset: { testid: "ai-turn-group-toggle" },
    text: `▸ ${preview}`,
    on: {
      click: () => {
        const collapsed = group.classList.toggle("is-collapsed");
        toggle.textContent = `${collapsed ? "▸" : "▾"} ${preview}`;
        toggle.setAttribute("aria-expanded", String(!collapsed));
      },
    },
  });
  group.append(toggle, body);
  log.replaceChildren(...keep, group);
}

export function appendConversationBubble(options: {
  readonly log: HTMLElement;
  readonly role: AiBubbleRole;
  readonly text: string;
  readonly removeStartScreen: () => void;
  /** 복원·감사 로그용 시각(날짜 구분선). */
  readonly at?: Date | string | null;
}): HTMLElement {
  options.removeStartScreen();
  if (options.role === "user") {
    ensureDayDivider(options.log, parseAiDayDate(options.at));
    markPriorTurns(options.log);
  }
  const body = el("div", {
    class: "ai-command-row-body",
    dataset: { testid: `ai-command-row-${options.role}` },
  });
  const row = el("div", {
    class: "ai-command-row",
    dataset: { testid: "ai-command-row", role: options.role },
    children: [
      el("span", {
        class: "ai-command-prefix",
        text: COMMAND_PREFIX,
        attrs: { "aria-hidden": "true" },
      }),
      body,
    ],
  });
  // 어시스턴트/시스템 줄은 마크다운, 사용자·툴은 원문. 빈 텍스트는 스트리밍 자리표시자.
  const displayText = options.text;
  if (displayText && (options.role === "assistant" || options.role === "system")) body.replaceChildren(renderAssistantAnswer(displayText));
  else if (displayText) body.textContent = displayText;
  options.log.append(row);
  options.log.scrollTop = options.log.scrollHeight;
  return body;
}

export function renderStreamedMarkdown(target: HTMLElement | null): void {
  if (!target) return;
  const body = target.querySelector(".ai-command-row-body") ?? target;
  const raw = body.textContent ?? "";
  if (raw.trim()) body.replaceChildren(renderAssistantAnswer(raw));
}

export interface ConversationLogHost {
  appendBubble: (role: AiBubbleRole, text: string) => HTMLElement;
  appendReasoning: () => { box: HTMLElement; body: HTMLElement };
  /**
   * 툴 그룹 경계. 툴 활동이 작업 띠로 옮겨간 뒤(2026-09-17) 로그엔 접을 그룹이 없다 —
   * 턴 러너·영역 작업 러너의 호출 계약만 유지하는 빈 동작이다.
   */
  closeToolActivity: () => void;
  /**
   * 툴 행을 만들어 작업 띠(`workSink`)로 보낸다. 조회성 성공 호출은 행을 만들지 않고 개수만 알린다.
   * `live` 는 지금 도는 턴의 행, 아니면 복원(기록 재생) 경로다. 돌려주는 값은 만든 행(없으면 null).
   */
  appendToolLine: (name: string, result: ToolResult, args?: Record<string, unknown>, options?: { readonly live?: boolean }) => HTMLElement | null;
  appendTileThumbs: (tilesetId: string, tiles: readonly number[]) => void;
  appendTileGrid: (data: TileGridData) => void;
  appendAiDocument: (documentData: AiDocument) => void;
  /** 변경 카드·보드를 작업 띠로 보낸다. 로그에는 붙지 않는다. */
  appendChangeCard: (card: HTMLElement) => HTMLElement;
  renderConversationEntry: (entry: AuditEntry) => void;
  clearLastReasoning: () => void;
  isLastReasoningBox: (node: HTMLElement) => boolean;
}

/** 로그가 만든 작업 산출물을 받는 쪽 — 실제 구현은 캔버스 하단 작업 띠(aiWorkStrip). */
export interface ConversationWorkSink {
  /** 쓰기·실패 툴 행. `live` 가 아니면 복원 경로다. */
  appendToolEntry: (entry: HTMLElement, meta: { readonly name: string; readonly result: ToolResult; readonly live: boolean }) => void;
  /** 조회성 성공 호출 — 행 없이 개수만. */
  noteReadOnlyTool: (name: string, live: boolean) => void;
  /** 변경 카드 등 이미 그려진 요소. */
  appendCard: (card: HTMLElement) => void;
}

export type ToolChipRenderer = (
  name: string,
  args: Record<string, unknown> | undefined,
  result: ToolResult,
) => HTMLElement | null;

export function createConversationLogHost(options: {
  readonly log: HTMLElement;
  readonly removeStartScreen: () => void;
  /** 행 앞 맵 칩. 패널이 프로젝트·현재 맵을 알고 있어 여기서 주입한다(aiMapChip). */
  readonly renderChip?: ToolChipRenderer;
  /** 툴 행·변경 카드를 받는 작업 띠. 없으면(단위 테스트) 만들기만 하고 버린다. */
  readonly workSink?: ConversationWorkSink;
}): ConversationLogHost {
  const { log, removeStartScreen, workSink } = options;

  const appendBubble = (role: AiBubbleRole, text: string, at?: Date | string | null): HTMLElement =>
    appendConversationBubble({ log, role, text, removeStartScreen, at });

  // 모델의 추론(reasoning) 스트림을 접이식 상자로 보여준다 — 기본 접힘(💭), 클릭하면 펼침.
  // 병합(추론 N회) 시 각 추론의 원문 전체를 별도 아이템으로 보존한다 — 펼치면 전부 보인다(V3C).
  let lastReasoning: { box: HTMLElement; body: HTMLElement; toggle: HTMLElement; state: { count: number } } | null = null;
  const appendReasoningItem = (body: HTMLElement): HTMLElement => {
    const item = el("div", { class: "ai-reasoning-item", dataset: { testid: "ai-reasoning-item" } });
    body.append(item);
    return item;
  };
  const appendReasoning = (): { box: HTMLElement; body: HTMLElement } => {
    removeStartScreen();
    const lastRow = lastCommandRow(log);
    const reasoningCurrent = lastReasoning?.box.parentNode === log
      ? log.childNodes[log.childNodes.length - 1] === lastReasoning.box
      : Boolean(lastRow && lastReasoning && lastRow.contains(lastReasoning.box));
    if (lastReasoning && reasoningCurrent) {
      lastReasoning.state.count += 1;
      // hidden 은 lib.dom 에서 string | boolean 이다("until-found") — 접힘 여부는 참·거짓으로 본다.
      lastReasoning.toggle.textContent = reasoningToggleText(lastReasoning.state.count, Boolean(lastReasoning.body.hidden));
      log.scrollTop = log.scrollHeight;
      return { box: lastReasoning.box, body: appendReasoningItem(lastReasoning.body) };
    }
    const body = el("div", { class: "ai-reasoning-body", dataset: { testid: "ai-reasoning-body" } });
    body.hidden = true;
    const state = { count: 1 };
    const toggle = el("button", {
      class: "ai-reasoning-toggle",
      attrs: { type: "button", title: "모델의 추론 원문 전체 펼치기/접기", "aria-label": "추론 펼치기/접기" },
      text: reasoningToggleText(1, true),
    });
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = reasoningToggleText(state.count, body.hidden);
    });
    const box = el("div", { class: "ai-command-attachment ai-reasoning", dataset: { testid: "ai-reasoning" }, children: [toggle, body] });
    attachToLastRow(log, box);
    lastReasoning = { box, body, toggle, state };
    log.scrollTop = log.scrollHeight;
    return { box, body: appendReasoningItem(body) };
  };

  // 툴 행은 로그가 아니라 작업 띠의 카드로 간다. 조회성 성공 호출은 행 없이 개수만 알린다.
  let toolDetailSeq = 0;
  const closeToolActivity = (): void => {};
  const appendToolLine = (
    name: string,
    result: ToolResult,
    args?: Record<string, unknown>,
    lineOptions: { readonly live?: boolean } = {},
  ): HTMLElement | null => {
    const live = Boolean(lineOptions.live);
    if (result.ok && isReadOnlyToolNoise(name)) {
      workSink?.noteReadOnlyTool(name, live);
      return null;
    }
    toolDetailSeq += 1;
    const plainToolNames = getEditorChrome().jargonStyle === "plain";
    const visibleResult = plainToolNames
      ? { ...result, summary: sanitizeUserFacingToolId(result.summary) }
      : result;
    const chip = options.renderChip?.(name, args, result) ?? null;
    const entry = renderToolActivityEntry(name, visibleResult, { args, index: toolDetailSeq }, { chip });
    if (plainToolNames && !result.ok) {
      const title = entry.querySelector(".ai-tool-failure-summary");
      if (title?.textContent) {
        title.textContent = title.textContent.replace(name, sanitizeUserFacingToolId(name));
      }
    }
    workSink?.appendToolEntry(entry, { name, result, live });
    return entry;
  };

  const renderConversationEntry = (entry: AuditEntry): void => {
    if (entry.kind === "user") {
      closeToolActivity();
      appendBubble("user", displayUserAuditText(entry.text), entry.at);
      return;
    }
    if (entry.kind === "assistant" && entry.text.trim()) {
      closeToolActivity();
      appendBubble("assistant", entry.text, entry.at);
      return;
    }
    if (entry.kind === "status" && entry.text.startsWith("run-recap ")) {
      const recap = parseRunRecapPayload(entry.text);
      if (recap) {
        const body = appendBubble("system", formatRunRecapPlayerLine(recap), entry.at);
        body.classList.add("ai-run-recap");
        body.dataset.testid = "ai-run-recap";
      }
      return;
    }
    if (entry.kind === "tool") {
      appendToolLine(
        entry.name,
        {
          ok: entry.ok,
          summary: entry.summary,
          issues: entry.issues?.map((message) => ({ severity: "error", code: "restored-tool", message })),
        },
        entry.args
      );
    }
  };

  // 타일 이미지를 채팅에 렌더한다(show_tiles 툴콜).
  const appendTileThumbs = (tilesetId: string, tiles: readonly number[]): void => {
    removeStartScreen();
    const tileset = store.getCurrent().tilesets[tilesetId] ?? store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    const bubble = el("div", {
      class: "ai-command-attachment ai-chat-tiles",
      dataset: { testid: "ai-bubble-tiles" },
      children: tiles.map((tile) =>
        el("figure", {
          class: "ai-tile-thumb-item",
          children: [
            el("div", {
              class: "ai-tile-thumb",
              attrs: { style: tilesetTileBackgroundStyle(tileset, tile, 48) },
              dataset: { testid: `ai-tile-thumb-${tile}` },
            }),
            el("figcaption", { class: "ai-tile-thumb-caption", text: String(tile) }),
          ],
        })
      ),
    });
    attachToLastRow(log, bubble);
    log.scrollTop = log.scrollHeight;
  };

  // AI 리치 문서(present_doc)를 마지막 커맨드 줄에 붙인다.
  const appendAiDocument = (documentData: AiDocument): void => {
    removeStartScreen();
    const bubble = el("div", {
      class: "ai-command-attachment ai-chat-doc",
      dataset: { testid: "ai-bubble-doc" },
      children: [renderAiDocument(documentData, store.getCurrent().tilesets)],
    });
    attachToLastRow(log, bubble);
    log.scrollTop = log.scrollHeight;
  };

  // 맵 영역을 하위+상위 합성 그리드로 채팅에 렌더 — 구조물 학습 인터뷰의 시각 자료.
  const appendTileGrid = (data: TileGridData): void => {
    removeStartScreen();
    const tileset = store.getCurrent().tilesets[data.tilesetId] ?? store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    const rows: HTMLElement[] = [];
    for (let row = 0; row < data.h; row += 1) {
      const cells: HTMLElement[] = [];
      for (let col = 0; col < data.w; col += 1) {
        const lower = data.lower[row]?.[col] ?? -1;
        const upper = data.upper[row]?.[col] ?? -1;
        const children: HTMLElement[] = [];
        if (upper >= 0) {
          children.push(el("div", { class: "ai-tile-grid-upper", attrs: { style: tilesetTileBackgroundStyle(tileset, upper, 24) } }));
        }
        cells.push(
          el("div", {
            class: "ai-tile-grid-cell",
            attrs: { style: lower >= 0 ? tilesetTileBackgroundStyle(tileset, lower, 24) : "", title: `(${data.x + col},${data.y + row}) ${lower >= 0 ? lower : ""}${upper >= 0 ? `/${upper}` : ""}` },
            children,
          })
        );
      }
      rows.push(el("div", { class: "ai-tile-grid-row", children: cells }));
    }
    const bubble = el("div", {
      class: "ai-command-attachment ai-chat-tile-grid",
      dataset: { testid: "ai-bubble-tile-grid" },
      children: [
        el("div", { class: "ai-tile-grid-caption", text: `(${data.x},${data.y}) ${data.w}×${data.h}` }),
        el("div", { class: "ai-tile-grid", children: rows }),
      ],
    });
    attachToLastRow(log, bubble);
    log.scrollTop = log.scrollHeight;
  };

  // 변경 카드는 작업 띠로 간다 — 대화 창에는 「무엇이 바뀌었나」 를 말로만 남긴다.
  const appendChangeCard = (card: HTMLElement): HTMLElement => {
    removeStartScreen();
    workSink?.appendCard(card);
    return card;
  };

  return {
    appendBubble,
    appendReasoning,
    closeToolActivity,
    appendToolLine,
    appendTileThumbs,
    appendTileGrid,
    appendAiDocument,
    appendChangeCard,
    renderConversationEntry,
    clearLastReasoning: () => {
      lastReasoning = null;
    },
    isLastReasoningBox: (node) => Boolean(lastReasoning && lastReasoning.box === node),
  };
}
