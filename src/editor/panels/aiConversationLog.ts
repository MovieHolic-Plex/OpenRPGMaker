// editor/panels/aiConversationLog.ts
// RM @> 커맨드 로·추론·툴 활동·타일 시각 자료. 패널 클로저에서 팩토리로 상태만 공유한다.

import type { AuditEntry } from "@/ai/assistantSession";
import type { ToolResult } from "@/editor/tools";
import { renderAiDocument } from "@/editor/panels/aiDocRenderers";
import { getEditorChrome } from "@/editor/editorUiMode";
import { sanitizeUserFacingToolId } from "@/editor/uiCopy";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { AiDocument } from "@/project/types";
import { stripQuickReplyLine } from "@/ai/interviewPrompt";
import { formatRunRecapPlayerLine, parseRunRecapPayload } from "@/ai/runRecap";
import { renderAssistantAnswer } from "./aiAnswerLinkRender";
import { el } from "@/util/dom";
import {
  reasoningToggleText,
  renderToolActivityEntry,
} from "./aiChatRenderers";
import { deckIcon } from "./aiDeckIcons";
import { toolLabelSummary } from "./aiToolLabels";
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

function scrollToBottomAfterLayout(log: HTMLElement): void {
  const pin = (): void => {
    log.scrollTop = log.scrollHeight;
  };
  pin();
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    pin();
    requestAnimationFrame(pin);
  });
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
  const displayText = options.role === "assistant" || options.role === "system"
    ? stripQuickReplyLine(options.text)
    : options.text;
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
  closeToolActivity: () => void;
  /**
   * 툴 행 추가. `live` 는 지금 도는 턴의 행 — 그룹을 펼친 채 둔다. 복원(기록 재생) 경로는 live 가
   * 아니어서 접힌 채 붙는다(e2e assistant-change-preview: 복원된 툴 호출은 접힌 한 줄 요약).
   */
  appendToolLine: (name: string, result: ToolResult, args?: Record<string, unknown>, options?: { readonly live?: boolean }) => void;
  appendTileThumbs: (tilesetId: string, tiles: readonly number[]) => void;
  appendTileGrid: (data: TileGridData) => void;
  appendAiDocument: (documentData: AiDocument) => void;
  appendChangeCard: (card: HTMLElement) => HTMLElement;
  renderConversationEntry: (entry: AuditEntry) => void;
  clearLastReasoning: () => void;
  isLastReasoningBox: (node: HTMLElement) => boolean;
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
}): ConversationLogHost {
  const { log, removeStartScreen } = options;

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

  // 툴콜을 접이식 한 줄 요약으로 묶는다. 조회성 성공 호출은 목록에 넣지 않고 개수만 센다.
  let toolActivity: {
    list: HTMLElement;
    toggle: HTMLElement;
    count: number;
    writeOrFailCount: number;
    readOkCount: number;
    /** 쓰기·실패 행의 툴 이름(접힌 헤더 요약용). */
    names: string[];
  } | null = null;
  let toolDetailSeq = 0;
  /**
   * 그룹 헤더(데크 2026-09-03). 펼침: 「작업 N단계」. 접힘: 「작업 N단계 · 라벨 → 라벨 → …」 —
   * 접힌 한 줄이 무엇을 했는지 말해야 한다(「작업 1 ▸」 는 말하지 않았다). 조회만 있으면 「조회 N건」.
   */
  const refreshToolActivityToggle = (): void => {
    if (!toolActivity) return;
    const { count, writeOrFailCount, readOkCount, list, toggle, names } = toolActivity;
    let text: string;
    if (writeOrFailCount > 0) text = `작업 ${writeOrFailCount}단계`;
    else if (readOkCount > 0) text = `조회 ${readOkCount}건`;
    else text = `작업 ${count}단계`;
    if (list.hidden && names.length > 0) text += ` · ${toolLabelSummary(names)}`;
    toggle.replaceChildren(
      deckIcon(list.hidden ? "chevron-right" : "chevron-down", { size: 15 }),
      el("span", { class: "ai-tool-activity-toggle-text", text }),
    );
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  };
  /** 턴이 끝났다(또는 다음 발화가 왔다) — 완료된 그룹은 요약 한 줄로 접는다(제안서 D3). */
  const closeToolActivity = (): void => {
    if (toolActivity) {
      toolActivity.list.hidden = true;
      refreshToolActivityToggle();
    }
    toolActivity = null;
  };
  const appendToolLine = (
    name: string,
    result: ToolResult,
    args?: Record<string, unknown>,
    lineOptions: { readonly live?: boolean } = {},
  ): void => {
    if (!toolActivity) {
      const list = el("div", { class: "ai-tool-activity-list" });
      // 진행 중 턴의 그룹은 펼친 채 자란다. 복원 경로는 접힌 채 붙는다.
      list.hidden = !lineOptions.live;
      const toggle = el("button", {
        class: "ai-tool-activity-toggle",
        attrs: { type: "button", title: "작업 단계 펼치기/접기", "aria-label": "작업 단계 펼치기/접기" },
        dataset: { testid: "ai-tool-activity-toggle" },
      });
      const group = el("div", { class: "ai-command-attachment ai-tool-activity", dataset: { testid: "ai-tool-activity" }, children: [toggle, list] });
      const current = { list, toggle, count: 0, writeOrFailCount: 0, readOkCount: 0, names: [] as string[] };
      toggle.addEventListener("click", () => {
        list.hidden = !list.hidden;
        refreshToolActivityToggle();
      });
      attachToLastRow(log, group);
      toolActivity = current;
    }
    toolActivity.count += 1;
    const noiseRead = result.ok && isReadOnlyToolNoise(name);
    if (noiseRead) {
      toolActivity.readOkCount += 1;
      refreshToolActivityToggle();
      log.scrollTop = log.scrollHeight;
      return;
    }
    toolActivity.writeOrFailCount += 1;
    toolActivity.names.push(name);
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
    toolActivity.list.append(entry);
    refreshToolActivityToggle();
    log.scrollTop = log.scrollHeight;
  };

  const renderConversationEntry = (entry: AuditEntry): void => {
    if (entry.kind === "user") {
      closeToolActivity();
      appendBubble("user", displayUserAuditText(entry.text), entry.at);
      return;
    }
    if (entry.kind === "assistant" && entry.text.trim()) {
      closeToolActivity();
      appendBubble("assistant", stripQuickReplyLine(entry.text), entry.at);
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

  // 변경 카드는 툴 활동보다 먼저 읽혀야 한다 — 사용자의 관심은 "무엇이 바뀌었나"이고
  // 툴 호출 내역은 각주다. 이미 붙은 툴 활동은 떼어 카드 뒤로 옮기고 조용하게 만든다.
  const appendChangeCard = (card: HTMLElement): HTMLElement => {
    removeStartScreen();
    const host = lastCommandRow(log) ?? log;
    const wrap = el("div", {
      class: "ai-command-attachment ai-change-card-host",
      dataset: { testid: "ai-change-card-host" },
      children: [card],
    });
    const tools = host.querySelector<HTMLElement>(".ai-tool-activity");
    host.append(wrap);
    if (tools) {
      tools.classList.add("is-quiet");
      tools.remove();
      host.append(tools);
    }
    // 변경 카드는 전/후 캔버스 두 장이 들어있어 붙이는 순간의 높이가 최종 높이가 아니다.
    // 그 자리에서 한 번만 스크롤하면 카드 밑(되돌리기 버튼)이 입력란 뒤로 잠긴다 — 레이아웃이
    // 자리를 잡은 다음 한 번 더 맞춰준다.
    scrollToBottomAfterLayout(log);
    return wrap;
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
