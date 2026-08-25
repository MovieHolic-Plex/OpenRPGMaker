import { el } from "@/util/dom";

export type LifeCardState = "ready" | "needs-setup" | "info";

export type LifeCard = {
  readonly testid: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly state?: LifeCardState;
  readonly data?: Readonly<Record<string, string>>;
  readonly action?: {
    readonly label: string;
    readonly testid: string;
    readonly onClick: EventListener;
  };
};

export function renderLifePanel(options: {
  readonly testid: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly cards: readonly LifeCard[];
  readonly compact?: boolean;
}): HTMLElement {
  return el("section", {
    class: `db-life-panel${options.compact ? " is-compact" : ""}`,
    dataset: { testid: options.testid },
    children: [
      el("div", {
        class: "db-life-panel-heading",
        children: [
          el("span", { class: "db-life-panel-eyebrow", text: options.eyebrow }),
          el("div", {
            children: [
              el("h3", { text: options.title }),
              el("p", { text: options.description }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "db-life-card-grid",
        children: options.cards.map((card) => renderLifeCard(card)),
      }),
    ],
  });
}

function renderLifeCard(card: LifeCard): HTMLElement {
  const state = card.state ?? "info";
  return el("article", {
    class: `db-life-card is-${state}`,
    dataset: { testid: card.testid, state, ...(card.data ?? {}) },
    children: [
      el("span", { class: "db-life-card-label", text: card.label }),
      el("strong", { class: "db-life-card-value", text: card.value }),
      el("small", { class: "db-life-card-detail", text: card.detail }),
      ...(card.action ? [el("button", {
        class: "db-life-card-action",
        text: card.action.label,
        attrs: { type: "button" },
        dataset: { testid: card.action.testid },
        on: { click: card.action.onClick },
      })] : []),
    ],
  });
}

export function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-tabs") && current.querySelector(".db-body")) return current;
    current = current.parentElement;
  }
  return null;
}

export function clickDatabaseTabFrom(node: HTMLElement | null, testid: string): boolean {
  const panelRoot = databasePanelRootFrom(node);
  const tab = panelRoot?.querySelector(`[data-testid="${testid}"]`);
  if (!(tab instanceof HTMLElement)) return false;
  tab.click();
  return true;
}
