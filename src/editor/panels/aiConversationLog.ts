// editor/panels/aiConversationLog.ts
// 대화 버블·추론·툴 활동·타일 시각 자료. 패널 클로저에서 팩토리로 상태만 공유한다.

import type { AuditEntry } from "@/ai/assistantSession";
import type { ToolResult } from "@/editor/tools";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { renderMarkdown } from "@/util/markdown";
import { el } from "@/util/dom";
import {
  reasoningToggleText,
  renderToolActivityEntry,
} from "./aiChatRenderers";
import { displayUserAuditText, type TileGridData } from "./aiChatPanelHelpers";

export type AiBubbleRole = "user" | "assistant" | "tool" | "system";

export function markPriorTurns(log: HTMLElement): void {
  for (const child of Array.from(log.childNodes)) {
    (child as HTMLElement).classList?.add?.("is-prior-turn");
  }
}

export function appendConversationBubble(options: {
  readonly log: HTMLElement;
  readonly role: AiBubbleRole;
  readonly text: string;
  readonly revealVolatileZone: () => void;
  readonly removeStartScreen: () => void;
}): HTMLElement {
  options.revealVolatileZone();
  options.removeStartScreen();
  if (options.role === "user") markPriorTurns(options.log);
  const bubble = el("div", {
    class: `ai-chat-bubble ai-chat-${options.role}`,
    dataset: { testid: `ai-bubble-${options.role}` },
  });
  // 어시스턴트/시스템 말풍선은 마크다운을 렌더한다(굵게/목록/코드/링크 — 안전한 DOM 생성).
  // 사용자·툴 버블은 원문 그대로. 빈 텍스트(스트리밍 자리표시자)는 그대로 두고 완료 시 렌더한다.
  if (options.text && (options.role === "assistant" || options.role === "system")) bubble.replaceChildren(renderMarkdown(options.text));
  else if (options.text) bubble.textContent = options.text;
  options.log.append(bubble);
  options.log.scrollTop = options.log.scrollHeight;
  return bubble;
}

export function renderStreamedMarkdown(bubble: HTMLElement | null): void {
  const raw = bubble?.textContent ?? "";
  if (bubble && raw.trim()) bubble.replaceChildren(renderMarkdown(raw));
}

export function appendSkillPromptToggle(bubble: HTMLElement, prompt: string): void {
  const details = el("details", {
    class: "ai-skill-prompt-details",
    dataset: { testid: "ai-skill-prompt-details" },
    children: [
      el("summary", { text: "실제 지시 보기", dataset: { testid: "ai-skill-prompt-toggle" } }),
      el("pre", { class: "ai-skill-prompt-raw", text: prompt, dataset: { testid: "ai-skill-prompt-raw" } }),
    ],
  });
  bubble.append(details);
}

export interface ConversationLogHost {
  appendBubble: (role: AiBubbleRole, text: string) => HTMLElement;
  appendReasoning: () => { box: HTMLElement; body: HTMLElement };
  closeToolActivity: () => void;
  appendToolLine: (name: string, result: ToolResult, args?: Record<string, unknown>) => void;
  appendTileThumbs: (tilesetId: string, tiles: readonly number[]) => void;
  appendTileGrid: (data: TileGridData) => void;
  renderConversationEntry: (entry: AuditEntry) => void;
  clearLastReasoning: () => void;
  isLastReasoningBox: (node: HTMLElement) => boolean;
}

export function createConversationLogHost(options: {
  readonly log: HTMLElement;
  readonly revealVolatileZone: () => void;
  readonly removeStartScreen: () => void;
}): ConversationLogHost {
  const { log, revealVolatileZone, removeStartScreen } = options;

  const appendBubble = (role: AiBubbleRole, text: string): HTMLElement =>
    appendConversationBubble({ log, role, text, revealVolatileZone, removeStartScreen });

  // 모델의 추론(reasoning) 스트림을 접이식 상자로 보여준다 — 기본 접힘(💭), 클릭하면 펼침.
  // 병합(추론 N회) 시 각 추론의 원문 전체를 별도 아이템으로 보존한다 — 펼치면 전부 보인다(V3C).
  let lastReasoning: { box: HTMLElement; body: HTMLElement; toggle: HTMLElement; state: { count: number } } | null = null;
  const appendReasoningItem = (body: HTMLElement): HTMLElement => {
    const item = el("div", { class: "ai-reasoning-item", dataset: { testid: "ai-reasoning-item" } });
    body.append(item);
    return item;
  };
  const appendReasoning = (): { box: HTMLElement; body: HTMLElement } => {
    revealVolatileZone();
    removeStartScreen();
    if (lastReasoning?.box.parentNode === log && log.childNodes[log.childNodes.length - 1] === lastReasoning.box) {
      lastReasoning.state.count += 1;
      lastReasoning.toggle.textContent = reasoningToggleText(lastReasoning.state.count, lastReasoning.body.hidden);
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
    const box = el("div", { class: "ai-chat-bubble ai-reasoning", dataset: { testid: "ai-reasoning" }, children: [toggle, body] });
    log.append(box);
    lastReasoning = { box, body, toggle, state };
    log.scrollTop = log.scrollHeight;
    return { box, body: appendReasoningItem(body) };
  };

  // 툴콜을 원문 버블로 쏟지 않고 접이식 한 줄 요약("🔧 툴 N회 실행 ▸")으로 묶는다.
  let toolActivity: { list: HTMLElement; toggle: HTMLElement; count: number } | null = null;
  let toolDetailSeq = 0;
  const closeToolActivity = (): void => {
    toolActivity = null;
  };
  const appendToolLine = (name: string, result: ToolResult, args?: Record<string, unknown>): void => {
    revealVolatileZone();
    if (!toolActivity) {
      const list = el("div", { class: "ai-tool-activity-list" });
      list.hidden = true;
      const toggle = el("button", {
        class: "ai-tool-activity-toggle",
        attrs: { type: "button", title: "툴 실행 내역 펼치기/접기", "aria-label": "도구 실행 내역 펼치기/접기" },
        dataset: { testid: "ai-tool-activity-toggle" },
      });
      const group = el("div", { class: "ai-chat-bubble ai-chat-tool-activity", dataset: { testid: "ai-tool-activity" }, children: [toggle, list] });
      const current = { list, toggle, count: 0 };
      toggle.addEventListener("click", () => {
        list.hidden = !list.hidden;
        current.toggle.textContent = `🔧 도구 ${current.count}회 실행 ${list.hidden ? "▸" : "▾"}`;
      });
      log.append(group);
      toolActivity = current;
    }
    toolActivity.count += 1;
    toolDetailSeq += 1;
    toolActivity.list.append(renderToolActivityEntry(name, result, { args, index: toolDetailSeq }));
    toolActivity.toggle.textContent = `🔧 도구 ${toolActivity.count}회 실행 ${toolActivity.list.hidden ? "▸" : "▾"}`;
    log.scrollTop = log.scrollHeight;
  };

  const renderConversationEntry = (entry: AuditEntry): void => {
    if (entry.kind === "user") {
      closeToolActivity();
      appendBubble("user", displayUserAuditText(entry.text));
      return;
    }
    if (entry.kind === "assistant" && entry.text.trim()) {
      closeToolActivity();
      appendBubble("assistant", entry.text);
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
    revealVolatileZone();
    removeStartScreen();
    const tileset = store.getCurrent().tilesets[tilesetId] ?? store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    const bubble = el("div", {
      class: "ai-chat-bubble ai-chat-tiles",
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
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };

  // 맵 영역을 하위+상위 합성 그리드로 채팅에 렌더 — 구조물 학습 인터뷰의 시각 자료.
  const appendTileGrid = (data: TileGridData): void => {
    revealVolatileZone();
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
      class: "ai-chat-bubble ai-chat-tile-grid",
      dataset: { testid: "ai-bubble-tile-grid" },
      children: [
        el("div", { class: "ai-tile-grid-caption", text: `(${data.x},${data.y}) ${data.w}×${data.h}` }),
        el("div", { class: "ai-tile-grid", children: rows }),
      ],
    });
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };

  return {
    appendBubble,
    appendReasoning,
    closeToolActivity,
    appendToolLine,
    appendTileThumbs,
    appendTileGrid,
    renderConversationEntry,
    clearLastReasoning: () => {
      lastReasoning = null;
    },
    isLastReasoningBox: (node) => Boolean(lastReasoning && lastReasoning.box === node),
  };
}
