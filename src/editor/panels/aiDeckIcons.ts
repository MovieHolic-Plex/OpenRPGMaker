// editor/panels/aiDeckIcons.ts
// 조수 데크의 아이콘 한 세트 — 인라인 SVG, stroke 1.75, currentColor.
//
// 왜 글리프(☰ 🕒 ⌾ ▼)를 버리는가: 이모지·기호는 글꼴마다 굵기와 폭이 제각각이라 한 행에
// 놓으면 서로 다른 가족처럼 보이고, 호버 전에는 뜻을 알 수 없다(2026-09-03 제안서 §01-3).
// 경로 데이터는 제안서 목업(docs/2026-09-03-ai-assistant-modern-ui-assets/mock/deck.html)의
// <symbol> 과 같다 — 목업과 제품이 같은 그림을 쓴다.
//
// 이벤트 편집기 `renderEditorIcon`(.ee-icon) 과 같은 house spec 이지만 크기 규칙이 `.event-*`
// 스코프라 여기서는 데크 전용 클래스(.ai-deck-icon)로 크기를 다시 준다.

const SVG_NS = "http://www.w3.org/2000/svg";

export const DECK_ICON_NAMES = [
  "plus", "clock", "more", "chevron-down", "chevron-right", "arrow-up", "stop", "check", "spark", "pin",
  "selection", "x", "undo", "expand", "list", "question", "gear", "export", "book", "compress", "wrench",
  "scroll", "eye", "house", "wall", "road", "door", "box", "user", "shop", "flag", "grid", "shield", "map",
  "tree", "link", "search", "memory", "alert",
] as const;

export type DeckIconName = (typeof DECK_ICON_NAMES)[number];

type Shape =
  | { readonly kind: "path"; readonly d: string }
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: "rect"; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx: number };

const path = (d: string): Shape => ({ kind: "path", d });
const circle = (cx: number, cy: number, r: number): Shape => ({ kind: "circle", cx, cy, r });
const rect = (x: number, y: number, w: number, h: number, rx: number): Shape => ({ kind: "rect", x, y, w, h, rx });

const SHAPES: Readonly<Record<DeckIconName, readonly Shape[]>> = {
  plus: [path("M12 5v14M5 12h14")],
  clock: [circle(12, 12, 9), path("M12 7v5l3 2")],
  more: [circle(5, 12, 1.2), circle(12, 12, 1.2), circle(19, 12, 1.2)],
  "chevron-down": [path("M6 9l6 6 6-6")],
  "chevron-right": [path("M9 6l6 6-6 6")],
  "arrow-up": [path("M12 19V5M5 12l7-7 7 7")],
  stop: [rect(6, 6, 12, 12, 2)],
  check: [path("M5 12.5l4.5 4.5L19 7.5")],
  spark: [path("M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z")],
  // 느낌표 — 「살펴볼 것이 있다」는 뜻. 물음표(question)와 헷갈리지 않게 삼각형 안에 세운다.
  alert: [path("M12 3.5l9 16H3z"), path("M12 10v4"), circle(12, 17, 0.9)],
  pin: [path("M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11z"), circle(12, 10, 2.2)],
  selection: [path("M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2")],
  x: [path("M6 6l12 12M18 6L6 18")],
  undo: [path("M9 14L4 9l5-5"), path("M4 9h10a6 6 0 0 1 0 12h-3")],
  expand: [path("M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7")],
  list: [path("M10 6h11M10 12h11M10 18h11"), path("M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17")],
  question: [circle(12, 12, 9), path("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01")],
  gear: [
    circle(12, 12, 3),
    path("M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"),
  ],
  export: [path("M12 15V4M7 9l5-5 5 5"), path("M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3")],
  book: [path("M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"), path("M4 19a2 2 0 0 1 2-2h13")],
  compress: [path("M4 14h6v6M20 10h-6V4M14 10l6-6M4 20l6-6")],
  wrench: [path("M14.7 6.3a4 4 0 0 0 5 5L21 10l-3 3-3-3 1.7-1.7zM3 21l8.5-8.5")],
  scroll: [path("M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"), path("M19 17V5a2 2 0 0 0-2-2H4")],
  eye: [path("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"), circle(12, 12, 3)],
  house: [path("M3 11l9-8 9 8"), path("M5 10v10h14V10"), path("M10 20v-6h4v6")],
  wall: [path("M3 5h18v14H3z"), path("M3 10h18M3 15h18M8 5v5M14 10v5M8 15v4M16 5v5M12 15v4")],
  road: [path("M6 21L9 3M18 21L15 3"), path("M12 6v3M12 12v3M12 18v2")],
  door: [path("M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"), path("M3 21h18"), circle(14.5, 12, 1)],
  box: [path("M21 8l-9-5-9 5v8l9 5 9-5z"), path("M3 8l9 5 9-5M12 13v8")],
  user: [circle(12, 8, 4), path("M4 21a8 8 0 0 1 16 0")],
  shop: [path("M3 9l1.5-5h15L21 9"), path("M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"), path("M5 13v8h14v-8M10 21v-5h4v5")],
  flag: [path("M5 21V4"), path("M5 4h12l-2 4 2 4H5")],
  grid: [path("M3 3h18v18H3z"), path("M3 9h18M3 15h18M9 3v18M15 3v18")],
  shield: [path("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), path("M9 12l2 2 4-4")],
  map: [path("M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"), path("M9 4v14M15 6v14")],
  tree: [path("M12 2l5 7h-3l4 6h-4l3 5H7l3-5H6l4-6H7z"), path("M12 20v2")],
  link: [path("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"), path("M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")],
  search: [circle(11, 11, 7), path("M20 20l-3.5-3.5")],
  memory: [circle(12, 12, 9), circle(12, 12, 3), path("M12 3v2M12 19v2M3 12h2M19 12h2")],
};

export type DeckIconSize = 15 | 18 | 22;

export interface DeckIconOptions {
  readonly size?: DeckIconSize;
  readonly class?: string;
}

function shapeElement(shape: Shape): SVGElement {
  switch (shape.kind) {
    case "path": {
      const node = document.createElementNS(SVG_NS, "path");
      node.setAttribute("d", shape.d);
      return node;
    }
    case "circle": {
      const node = document.createElementNS(SVG_NS, "circle");
      node.setAttribute("cx", String(shape.cx));
      node.setAttribute("cy", String(shape.cy));
      node.setAttribute("r", String(shape.r));
      return node;
    }
    case "rect": {
      const node = document.createElementNS(SVG_NS, "rect");
      node.setAttribute("x", String(shape.x));
      node.setAttribute("y", String(shape.y));
      node.setAttribute("width", String(shape.w));
      node.setAttribute("height", String(shape.h));
      node.setAttribute("rx", String(shape.rx));
      return node;
    }
    default:
      return assertNever(shape);
  }
}

function assertNever(value: never): never {
  throw new Error(`unreachable icon shape: ${String(value)}`);
}

/** 데크 아이콘 하나. 장식이므로 aria-hidden — 뜻은 감싸는 버튼의 aria-label 이 든다. */
export function deckIcon(name: DeckIconName, options: DeckIconOptions = {}): SVGSVGElement {
  const size = options.size ?? 18;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", options.class ? `ai-deck-icon ${options.class}` : "ai-deck-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("data-icon", name);
  for (const shape of SHAPES[name]) svg.append(shapeElement(shape));
  return svg;
}
