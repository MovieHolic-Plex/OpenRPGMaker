// 장면 카드 보기(쉬움·보통). 카드 모델은 sceneCards.ts, 이 파일은 그리기만 한다.
// 단추를 늘리지 않는다(오너 원칙): 카드는 누르면 고치는 면, 보통에서만 줄 수와 「카드」 추가가 보인다.
import { el } from "@/util/dom";
import type { Command, Project } from "@/project/types";
import type { EventDraftIssue } from "@/editor/eventDraftValidator";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import type { EventEditorViewLevel } from "./beginnerChrome";
import { commandSummary } from "./commandSummary";
import { commandKindLabel } from "./options";
import {
  buildSceneCards,
  SCENE_CARD_KIND_LABEL,
  type SceneBranch,
  type SceneCard,
} from "./sceneCards";

export interface SceneCardsViewOptions {
  readonly commands: readonly Command[];
  readonly level: Exclude<EventEditorViewLevel, "advanced">;
  readonly project?: Project | null;
  readonly eventName?: (eventId: string) => string | undefined;
  /** 카드를 두 번 누르거나 Enter — 그 카드의 첫 명령 설정 창. */
  readonly onOpen?: (path: readonly number[]) => void;
  /** 보통의 「카드」 단추 — 맨 끝에 명령을 하나 더한다. */
  readonly onAddCard?: () => void;
  /** 「세부 명령 n개」를 펼친 카드(쉬움·보통이 못 그리는 명령을 연 신호). */
  readonly onRevealHidden?: (card: SceneCard) => void;
  /** 방금 바뀐 명령 경로(JSON) — 그 경로를 덮는 카드에 노란 테두리. */
  readonly changedPaths?: ReadonlySet<string>;
  /** 활성 페이지의 검증 이슈 — 해당 카드에 오류/경고 배지를 띄운다. */
  readonly issues?: readonly EventDraftIssue[];
}

const EASY_TALK_LINES = 4;
const NORMAL_TALK_LINES = 5;
const SHOP_ITEMS = 6;

export function renderSceneCards(options: SceneCardsViewOptions): HTMLElement {
  const cards = buildSceneCards(options.commands, { project: options.project, eventName: options.eventName });
  const host = el("div", {
    class: `event-scene-cards is-${options.level}`,
    dataset: { testid: "event-scene-cards", level: options.level },
  });
  if (cards.length === 0) {
    host.append(el("p", {
      class: "event-scene-empty",
      text: "아직 비어 있어요. 아래 칸에 하고 싶은 일을 적으세요.",
      dataset: { testid: "event-scene-empty" },
    }));
  }
  cards.forEach((card, index) => host.append(renderCard(card, `${index}`, options)));
  if (options.level === "normal" && options.onAddCard) {
    host.append(el("button", {
      class: "event-scene-add",
      text: "+ 카드",
      attrs: { type: "button", title: "맨 끝에 장면을 하나 더합니다" },
      dataset: { testid: "event-scene-add" },
      on: { click: () => options.onAddCard?.() },
    }));
  }
  return host;
}

function primaryPath(card: SceneCard): readonly number[] | undefined {
  return card.paths.find((_path, index) => index > 0 || card.paths.length === 1) ?? card.paths[0];
}

function isChanged(card: SceneCard, changed: ReadonlySet<string> | undefined): boolean {
  if (!changed || changed.size === 0) return false;
  return [...changed].some((raw) => card.paths.some((path) => raw === JSON.stringify(path) || raw.startsWith(`${JSON.stringify(path).slice(0, -1)},`)));
}

function issuesForCard(card: SceneCard, issues: readonly EventDraftIssue[] | undefined): readonly EventDraftIssue[] {
  if (!issues || issues.length === 0) return [];
  const cardSerialized = card.paths.map((path) => JSON.stringify(path));
  return issues.filter((issue) => {
    if (!issue.commandPath || issue.severity === "info") return false;
    const raw = JSON.stringify(issue.commandPath);
    return cardSerialized.some((prefix) => raw === prefix || raw.startsWith(`${prefix.slice(0, -1)},`));
  });
}

function renderCard(card: SceneCard, key: string, options: SceneCardsViewOptions): HTMLElement {
  const changed = isChanged(card, options.changedPaths);
  const cardIssues = issuesForCard(card, options.issues);
  const cardErrorCount = cardIssues.filter((i) => i.severity === "error").length;
  const cardWarningCount = cardIssues.filter((i) => i.severity === "warning").length;
  const cardSeverity = cardErrorCount > 0
    ? "error"
    : cardWarningCount > 0
      ? "warning"
      : null;
  const cardBadgeText = [
    cardErrorCount > 0 ? `오류 ${cardErrorCount}` : "",
    cardWarningCount > 0 ? `경고 ${cardWarningCount}` : "",
  ].filter(Boolean).join(" · ");
  const cardBadgeAriaPrefix = [
    cardErrorCount > 0 ? `오류 ${cardErrorCount}건` : "",
    cardWarningCount > 0 ? `경고 ${cardWarningCount}건` : "",
  ].filter(Boolean).join(" · ");
  const open = (): void => {
    const path = card.kind === "talk" ? card.lines[0]?.path ?? primaryPath(card) : primaryPath(card);
    if (path) options.onOpen?.(path);
  };
  const head = el("div", {
    class: "event-scene-card-head",
    children: [
      el("span", { class: "event-scene-card-kind", text: SCENE_CARD_KIND_LABEL[card.kind] }),
      el("span", { class: "event-scene-card-title", text: card.title }),
      ...(cardSeverity
        ? [el("span", {
            class: `event-command-issue-badge ${cardSeverity} event-scene-card-issue`,
            text: cardBadgeText,
            attrs: {
              title: cardIssues.map((i) => i.message).join("\n"),
              "aria-label": `${cardBadgeAriaPrefix}: ${cardIssues.map((i) => i.message).join("; ")}`,
            },
            dataset: { testid: `event-scene-card-issue-${key}`, severity: cardSeverity },
          })]
        : []),
      ...(options.level === "normal"
        ? [el("span", { class: "event-scene-card-count", text: `${card.commandCount}줄`, dataset: { testid: "event-scene-card-count" } })]
        : []),
      ...(changed ? [el("span", { class: "event-scene-card-changed", text: "방금 바뀜" })] : []),
    ],
  });
  const article = el("article", {
    class: `event-scene-card is-${card.kind}${changed ? " is-changed" : ""}`,
    attrs: {
      tabindex: "0",
      "aria-label": `${SCENE_CARD_KIND_LABEL[card.kind]}: ${card.title}`,
      title: "두 번 누르면 고칩니다",
    },
    dataset: { testid: `event-scene-card-${key}`, cardKind: card.kind, cmdPaths: JSON.stringify(card.paths) },
    children: [head, ...renderBody(card, key, options)],
  });
  article.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement | null)?.closest?.("button")) return;
    event.preventDefault();
    open();
  });
  article.addEventListener("keydown", (event) => {
    if (event.target !== article || (event as KeyboardEvent).key !== "Enter") return;
    event.preventDefault();
    open();
  });
  return article;
}

function renderBody(card: SceneCard, key: string, options: SceneCardsViewOptions): HTMLElement[] {
  const body: HTMLElement[] = [];
  const limit = options.level === "normal" ? NORMAL_TALK_LINES : EASY_TALK_LINES;
  if (card.kind === "talk") {
    const shown = card.lines.slice(0, limit);
    body.push(el("div", {
      class: "event-scene-dialogue",
      children: shown.map((line) => el("div", {
        class: "event-scene-line",
        children: [
          ...(line.speaker ? [el("span", { class: "event-scene-speaker", text: line.speaker })] : []),
          el("span", { class: "event-scene-body", text: line.body }),
        ],
      })),
    }));
    if (card.lines.length > shown.length) {
      body.push(el("p", { class: "event-scene-more", text: `대사 ${card.lines.length - shown.length}개 더` }));
    }
  } else if (card.kind === "shop" && card.shop) {
    const items = card.shop.items.slice(0, SHOP_ITEMS);
    body.push(el("div", {
      class: "event-scene-shop",
      children: [
        el("div", { class: "event-scene-shop-title", text: card.shop.title }),
        el("ul", {
          class: "event-scene-shop-items",
          children: items.map((item) => el("li", {
            children: [
              el("span", { class: "event-scene-shop-name", text: item.name }),
              el("span", { class: "event-scene-shop-price", text: item.price === null ? "" : `${item.price}G` }),
            ],
          })),
        }),
        ...(card.shop.items.length > items.length
          ? [el("p", { class: "event-scene-more", text: `품목 ${card.shop.items.length - items.length}개 더` })]
          : []),
        el("div", {
          class: "event-scene-shop-tabs",
          children: [el("span", { text: "사기" }), ...(card.shop.allowSell ? [el("span", { text: "팔기" })] : [])],
        }),
      ],
    }));
  } else {
    const quotes = card.lines.map((line) => (line.speaker ? `${line.speaker}: 「${line.body}」` : `「${line.body}」`));
    const bits = card.bits.slice(0, 4);
    const text = [...bits, ...quotes.slice(0, 2)].join(" · ");
    if (text) body.push(el("p", { class: "event-scene-bits", text }));
  }
  // 상점의 거래 갈래처럼 비어 있는 갈래만 있으면 카드에 싣지 않는다.
  if (card.branches.some((branch) => branch.commandCount > 0) || (card.branches.length > 0 && card.kind !== "shop")) {
    body.push(renderBranches(card.branches, options));
  }
  if (card.hiddenCount > 0) {
    body.push(el("button", {
      class: "event-scene-hidden",
      text: `세부 명령 ${card.hiddenCount}개`,
      attrs: { type: "button", title: "이 카드의 명령을 한 줄씩 펼칩니다" },
      dataset: { testid: `event-scene-hidden-${key}` },
      on: { click: (event) => {
        const button = event.currentTarget as HTMLElement;
        const article = button.closest(".event-scene-card");
        const existing = article?.querySelector(".event-scene-raw");
        if (existing) { existing.remove(); return; }
        button.after(renderRawRows(card, options));
        options.onRevealHidden?.(card);
      } },
    }));
  }
  return body;
}

function renderRawRows(card: SceneCard, options: SceneCardsViewOptions): HTMLElement {
  return el("ol", {
    class: "event-scene-raw",
    dataset: { testid: "event-scene-raw" },
    children: card.paths.map((path) => {
      const command = resolveCommandAtPath(options.commands as Command[], [...path]);
      let text = "";
      try { text = command ? `${commandKindLabel(command.kind)}: ${commandSummary(command)}` : ""; } catch { text = String(command?.kind ?? ""); }
      const row = el("li", { class: "event-scene-raw-row", text, attrs: { title: "두 번 누르면 고칩니다" } });
      row.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        options.onOpen?.(path);
      });
      return row;
    }),
  });
}

function renderBranches(all: readonly SceneBranch[], options: SceneCardsViewOptions): HTMLElement {
  // 빈 갈래(「아니다」에 아무것도 없음)는 카드를 길게만 한다. 모두 비었을 때만 보인다.
  const filled = all.filter((branch) => branch.commandCount > 0);
  const branches = filled.length > 0 ? filled : all;
  return el("div", {
    class: "event-scene-branches",
    children: branches.map((branch) => el("div", {
      class: "event-scene-branch",
      children: [
        el("span", { class: "event-scene-branch-label", text: branch.label }),
        el("span", {
          class: "event-scene-branch-steps",
          children: branch.cards.length === 0
            ? [el("span", { class: "event-scene-branch-step is-empty", text: "아무 일 없음" })]
            : branch.cards.map((sub) => el("span", {
                class: `event-scene-branch-step is-${sub.kind}`,
                text: options.level === "normal" ? `${sub.title} ${sub.commandCount}줄` : sub.title,
              })),
        }),
      ],
    })),
  });
}
