import { requestSystemSection, type SystemSectionSlug } from "@/editor/panels/databaseSystemView";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";
import { el } from "@/util/dom";

export type LifeCardState = "ready" | "needs-setup" | "info";
export type LifeCardIcon =
  | "calendar" | "capture" | "crop" | "drop" | "field" | "gift" | "item" | "link"
  | "map" | "monster" | "people" | "repeat" | "season" | "tool" | "warning";

export type LifeCard = {
  readonly testid: string;
  readonly icon: LifeCardIcon;
  readonly label: string;
  readonly value: string;
  /** 긴 설명은 화면을 차지하지 않고 칩의 title 도움말로 남는다. */
  readonly detail: string;
  readonly state?: LifeCardState;
  readonly data?: Readonly<Record<string, string>>;
  /** 칩 전체가 기존 인터랙션인 경우(생활 컬렉션 필터 등). */
  readonly onClick?: EventListener;
  readonly action?: {
    readonly label: string;
    readonly testid: string;
    readonly onClick: EventListener;
  };
};

const LIFE_CARD_ICONS: Record<LifeCardIcon, readonly SvgNodeSpec[]> = {
  calendar: [
    { tag: "rect", attrs: { x: "3.5", y: "5", width: "15", height: "13.5", rx: "2" } },
    { tag: "path", attrs: { d: "M7 3v4M15 3v4M3.5 9h15" } },
  ],
  capture: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7.5" } },
    { tag: "path", attrs: { d: "M3.5 11h15" } },
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "2.3" } },
  ],
  crop: [
    { tag: "path", attrs: { d: "M11 19v-8" } },
    { tag: "path", attrs: { d: "M11 11c0-3 2.2-5 5.3-5 0 3-2.2 5-5.3 5zM11 14c0-2.5-1.9-4.3-4.5-4.3 0 2.6 1.9 4.3 4.5 4.3z" } },
  ],
  drop: [
    { tag: "path", attrs: { d: "M11 3.2c3.7 4.6 5.6 7.4 5.6 10a5.6 5.6 0 0 1-11.2 0c0-2.6 1.9-5.4 5.6-10z" } },
  ],
  field: [
    { tag: "path", attrs: { d: "M3 17.5h16M5 14.5h12M7 11.5h8M11 4v13.5" } },
    { tag: "path", attrs: { d: "M11 9c0-2.7 2-4.5 4.7-4.5 0 2.7-2 4.5-4.7 4.5z" } },
  ],
  gift: [
    { tag: "rect", attrs: { x: "3.5", y: "8", width: "15", height: "10.5", rx: "1.5" } },
    { tag: "path", attrs: { d: "M11 8v10.5M3.5 11.5h15M11 8C7.3 8 6 6.9 6 5.5S7.3 3 8.7 4C10 5 11 8 11 8zm0 0c3.7 0 5-1.1 5-2.5S14.7 3 13.3 4C12 5 11 8 11 8z" } },
  ],
  item: [
    { tag: "rect", attrs: { x: "4", y: "4", width: "14", height: "14", rx: "2" } },
    { tag: "path", attrs: { d: "M7 8h8M7 11h8M7 14h5" } },
  ],
  link: [
    { tag: "path", attrs: { d: "M8.5 13.5 6.7 15.3a3.3 3.3 0 0 1-4.7-4.7l3-3a3.3 3.3 0 0 1 4.7 0M13.5 8.5l1.8-1.8a3.3 3.3 0 0 1 4.7 4.7l-3 3a3.3 3.3 0 0 1-4.7 0M7.5 14.5l7-7" } },
  ],
  map: [
    { tag: "path", attrs: { d: "M3 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM8 4v14M14 6v14" } },
  ],
  monster: [
    { tag: "path", attrs: { d: "M5.5 12a5.5 5.5 0 0 1 11 0v2.5a3.5 3.5 0 0 1-3.5 3.5H9a3.5 3.5 0 0 1-3.5-3.5zM6.5 8.5 4 5M15.5 8.5 18 5" } },
    { tag: "path", attrs: { d: "M9 12v1M13 12v1" } },
  ],
  people: [
    { tag: "circle", attrs: { cx: "7", cy: "7", r: "2.7" } },
    { tag: "circle", attrs: { cx: "15", cy: "7", r: "2.7" } },
    { tag: "path", attrs: { d: "M2.8 18c0-3 1.8-5 4.2-5s4.2 2 4.2 5M10.8 18c0-3 1.8-5 4.2-5s4.2 2 4.2 5" } },
  ],
  repeat: [
    { tag: "path", attrs: { d: "M17.5 8A7 7 0 0 0 5 6l-2 2M4.5 14A7 7 0 0 0 17 16l2-2M3 4v4h4M19 18v-4h-4" } },
  ],
  season: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "3.2" } },
    { tag: "path", attrs: { d: "M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M5 5l1.4 1.4M15.6 15.6 17 17M17 5l-1.4 1.4M6.4 15.6 5 17" } },
  ],
  tool: [
    { tag: "path", attrs: { d: "M4 18 13.5 8.5M12 5l2-2 5 5-2 2zM3 19l4-1-3-3z" } },
  ],
  warning: [
    { tag: "path", attrs: { d: "M11 3 20 19H2zM11 8v5" } },
    { tag: "circle", attrs: { cx: "11", cy: "16", r: ".6", fill: "currentColor" } },
  ],
};

export function renderLifePanel(options: {
  readonly testid: string;
  readonly title: string;
  readonly headingTestid?: string;
  readonly media?: HTMLElement;
  readonly cards: readonly LifeCard[];
  readonly compact?: boolean;
}): HTMLElement {
  return el("section", {
    class: `${options.compact ? "db-life-summary is-compact" : "db-life-panel"}`,
    dataset: { testid: options.testid },
    children: [
      el("div", {
        class: "db-life-panel-heading",
        children: [
          ...(options.media ? [el("span", { class: "db-life-panel-media", children: [options.media] })] : []),
          el("h3", {
            text: options.title,
            ...(options.headingTestid ? { dataset: { testid: options.headingTestid } } : {}),
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

function lifeCardIcon(icon: LifeCardIcon): SVGSVGElement {
  const svg = buildSvgIcon(LIFE_CARD_ICONS[icon]);
  svg.setAttribute("class", "db-life-card-icon");
  return svg;
}

function actionIcon(): SVGSVGElement {
  const svg = buildSvgIcon([{ tag: "path", attrs: { d: "M5 11h12M13 7l4 4-4 4" } }]);
  svg.setAttribute("class", "db-life-card-action-icon");
  return svg;
}

function renderLifeCard(card: LifeCard): HTMLElement {
  const state = card.state ?? "info";
  // action 만 있고 onClick 이 없으면 칩 전체가 그 이동을 담당한다.
  // 화살표를 버튼으로 남기면 button 안에 button 이 되어, 본문 클릭이 죽은 것처럼 보인다.
  const clickHandler = card.onClick ?? card.action?.onClick;
  const children = [
    lifeCardIcon(card.icon),
    el("span", { class: "db-life-card-label", text: card.label }),
    el("strong", { class: "db-life-card-value", text: card.value }),
    ...(card.action ? [el("span", {
      class: "db-life-card-action",
      attrs: {
        title: card.action.label,
        "aria-hidden": "true",
      },
      dataset: { testid: card.action.testid },
      // fakeDom 의 element.click() 은 bubble 하지 않는다. e2e/유닛이 action testid 를
      // 눌러도 같은 이동이 일어나게 화살표에도 핸들러를 둔다.
      ...(clickHandler ? { on: { click: (event: Event) => {
        event.stopPropagation();
        clickHandler(event);
      } } } : {}),
      children: [actionIcon()],
    })] : []),
  ];
  const common = {
    class: `db-life-card is-${state}${clickHandler ? " is-clickable" : ""}`,
    attrs: {
      title: card.detail,
      ...(clickHandler ? { type: "button", "aria-label": card.action?.label ?? card.detail } : {}),
    },
    dataset: { testid: card.testid, state, ...(card.data ?? {}) },
    ...(clickHandler ? { on: { click: clickHandler } } : {}),
    children,
  };
  return clickHandler ? el("button", common) : el("article", common);
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

export function clickDatabaseTabFrom(
  node: HTMLElement | null,
  testid: string,
  options?: { readonly systemSection?: SystemSectionSlug; readonly focusTestId?: string },
): boolean {
  const panelRoot = databasePanelRootFrom(node);
  const tab = panelRoot?.querySelector(`[data-testid="${testid}"]`);
  if (!(tab instanceof HTMLElement)) return false;
  if (options?.systemSection) requestSystemSection(options.systemSection, options.focusTestId);
  tab.click();
  return true;
}
