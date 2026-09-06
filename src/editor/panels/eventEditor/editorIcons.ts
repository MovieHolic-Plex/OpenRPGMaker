// 이벤트 편집기 전용 SVG 아이콘 세트.
//
// 글리프·이모지 문자(↑ ↓ ✎ ✕ ⛶ ❝ ◇ ➤ ¤ ★ △ …)를 아이콘 자리에 쓰던 것을 대체한다 —
// DESIGN.md 「No emoji icons」. 2026-09-03 실측(제안서 §2)에서 스토리 보기 한 화면에 글리프
// 버튼 43개, SVG 0개였고, 글리프는 폰트·플랫폼마다 모양과 폭이 달라 정렬이 흔들렸다.
//
// 빌더는 저장소 규격 하나(`buildSvgIcon`: 22×22 viewBox · 1.8 스트로크 · currentColor)를 그대로
// 쓴다. 아이콘은 뜻을 보조할 뿐이고 식별은 항상 텍스트(라벨 · aria-label · title)가 한다.
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";

export type EditorIconName =
  | "chat"
  | "choice"
  | "branch"
  | "switch"
  | "variable"
  | "route"
  | "clock"
  | "door"
  | "coin"
  | "cart"
  | "sound"
  | "image"
  | "spark"
  | "search"
  | "plus"
  | "close"
  | "undo"
  | "redo"
  | "refresh"
  | "arrowUp"
  | "arrowDown"
  | "arrowLeft"
  | "arrowRight"
  | "pencil"
  | "trash"
  | "copy"
  | "cut"
  | "star"
  | "starFilled"
  | "warning"
  | "info"
  | "drag"
  | "minimize"
  | "expand"
  | "collapse"
  | "person"
  | "sword"
  | "party"
  | "growth"
  | "gear"
  | "tool"
  | "sun"
  | "lines"
  | "caret"
  | "check";

const path = (d: string): SvgNodeSpec => ({ tag: "path", attrs: { d } });
const dot = (cx: string, cy: string, r = "1"): SvgNodeSpec => ({ tag: "circle", attrs: { cx, cy, r, fill: "currentColor" } });

const SPECS: Readonly<Record<EditorIconName, readonly SvgNodeSpec[]>> = {
  chat: [path("M3.5 4.5h15v9.5h-7l-4 3.5v-3.5h-4z")],
  choice: [path("M4 6.5h1M8 6.5h10M4 11h1M8 11h10M4 15.5h1M8 15.5h10")],
  branch: [path("M6 3.5v15M6 9c0 3 3.5 3.5 7 3.5h4M14.5 9.5l3 3-3 3")],
  switch: [
    { tag: "rect", attrs: { x: "2.5", y: "6.5", width: "17", height: "9", rx: "4.5" } },
    { tag: "circle", attrs: { cx: "15", cy: "11", r: "2.5" } },
  ],
  variable: [path("M8.5 3.5 6.5 18.5M15.5 3.5l-2 15M3.5 8.5h15.5M2.5 14h15.5")],
  route: [path("M3.5 16c4 0 4-9 7.5-9s3.5 9 7.5 9M15 13l3.5 3-3.5 3")],
  clock: [{ tag: "circle", attrs: { cx: "11", cy: "11", r: "8" } }, path("M11 6.5V11l3.5 2")],
  door: [path("M5.5 18.5V4.5h11v14M4 18.5h14"), dot("13.5", "11.5", "1.1")],
  coin: [{ tag: "circle", attrs: { cx: "11", cy: "11", r: "8" } }, path("M8 11h6M9.5 8.5v5")],
  cart: [path("M2.5 4.5h2.5l2.2 9.5h9.8l2-7H6"), dot("8", "17.5", "1.3"), dot("15.5", "17.5", "1.3")],
  sound: [path("M4 8.5v5h3.5L12 17.5V4.5L7.5 8.5zM15.5 7.5a5 5 0 0 1 0 7")],
  image: [
    { tag: "rect", attrs: { x: "3", y: "4.5", width: "16", height: "13", rx: "1.5" } },
    path("m3 14 4.5-4.5 4.5 4.5 3-3 4 4"),
    { tag: "circle", attrs: { cx: "14.5", cy: "8.5", r: "1.3" } },
  ],
  spark: [path("M11 2.5l1.9 6.6L19.5 11l-6.6 1.9L11 19.5l-1.9-6.6L2.5 11l6.6-1.9z")],
  search: [{ tag: "circle", attrs: { cx: "9.5", cy: "9.5", r: "6" } }, path("m14 14 5 5")],
  plus: [path("M11 4v14M4 11h14")],
  close: [path("M6 6l10 10M16 6 6 16")],
  undo: [path("M7 5.5 3.5 9l3.5 3.5M3.5 9h9.5a4.5 4.5 0 0 1 0 9H9.5")],
  redo: [path("M15 5.5 18.5 9 15 12.5M18.5 9H9a4.5 4.5 0 0 0 0 9h3.5")],
  refresh: [path("M18 11a7 7 0 1 1-2-4.9M18 4v3.5h-3.5")],
  arrowUp: [path("M11 18V4M5.5 9.5 11 4l5.5 5.5")],
  arrowDown: [path("M11 4v14M5.5 12.5 11 18l5.5-5.5")],
  arrowLeft: [path("M18 11H4M9.5 5.5 4 11l5.5 5.5")],
  arrowRight: [path("M4 11h14M12.5 5.5 18 11l-5.5 5.5")],
  pencil: [path("M4 18l1-4.5L15.5 3l3.5 3.5L8.5 17zM13.5 5l3.5 3.5")],
  trash: [path("M4 6.5h14M8.5 6.5V4.5h5v2M6 6.5l.8 11.5h8.4L16 6.5M9.5 10v5M12.5 10v5")],
  copy: [
    { tag: "rect", attrs: { x: "8", y: "8", width: "10", height: "10", rx: "1.5" } },
    path("M14 8V5.5A1.5 1.5 0 0 0 12.5 4h-7A1.5 1.5 0 0 0 4 5.5v7A1.5 1.5 0 0 0 5.5 14H8"),
  ],
  cut: [
    { tag: "circle", attrs: { cx: "6.5", cy: "16", r: "2.5" } },
    { tag: "circle", attrs: { cx: "15.5", cy: "16", r: "2.5" } },
    path("M8.3 14.2 17 3.5M13.7 14.2 5 3.5"),
  ],
  star: [path("M11 3.5l2.4 5 5.4.7-4 3.8 1 5.4L11 15.8l-4.8 2.6 1-5.4-4-3.8 5.4-.7z")],
  starFilled: [{ tag: "path", attrs: { d: "M11 3.5l2.4 5 5.4.7-4 3.8 1 5.4L11 15.8l-4.8 2.6 1-5.4-4-3.8 5.4-.7z", fill: "currentColor" } }],
  warning: [path("M11 3.5l8.5 15H2.5L11 3.5z"), path("M11 9v4"), dot("11", "16", "0.9")],
  info: [{ tag: "circle", attrs: { cx: "11", cy: "11", r: "8" } }, path("M11 10v5"), dot("11", "7", "0.9")],
  drag: [dot("8", "6"), dot("14", "6"), dot("8", "11"), dot("14", "11"), dot("8", "16"), dot("14", "16")],
  minimize: [path("M5 11h12")],
  expand: [path("M4 8.5V4h4.5M18 8.5V4h-4.5M4 13.5V18h4.5M18 13.5V18h-4.5")],
  collapse: [path("M8.5 4v4.5H4M13.5 4v4.5H18M8.5 18v-4.5H4M13.5 18v-4.5H18")],
  person: [{ tag: "circle", attrs: { cx: "11", cy: "7.5", r: "3.5" } }, path("M4 19c.7-4 3.5-6 7-6s6.3 2 7 6")],
  sword: [path("M4 18l9.5-9.5M15 4l3 3-2 2-3-3zM6.5 15.5 4 18M8 12l2 2")],
  party: [
    { tag: "circle", attrs: { cx: "8", cy: "7.5", r: "2.8" } },
    { tag: "circle", attrs: { cx: "15", cy: "8.5", r: "2.3" } },
    path("M2.5 18c.5-3.5 2.5-5.3 5.5-5.3s5 1.8 5.5 5.3M13 13.2c2.6.2 4.5 1.8 5 4.8"),
  ],
  growth: [path("M4 17.5l5-5.5 3.5 3.5L18 8.5M13.5 8.5H18V13")],
  gear: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "3" } },
    path("M11 2.5v3M11 16.5v3M2.5 11h3M16.5 11h3M5 5l2 2M15 15l2 2M5 17l2-2M15 7l2-2"),
  ],
  tool: [path("M14.5 3.5a4.5 4.5 0 0 0-3.8 6.8L4 17l1.5 1.5 6.7-6.7A4.5 4.5 0 1 0 14.5 3.5z")],
  sun: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "3.5" } },
    path("M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M5 5l1.4 1.4M15.6 15.6 17 17M5 17l1.4-1.4M15.6 6.4 17 5"),
  ],
  lines: [path("M4 6.5h14M4 11h14M4 15.5h14")],
  caret: [path("M6 9l5 5 5-5")],
  check: [path("M5 12l4 4 8-9")],
};

export interface EditorIconOptions {
  /** 아이콘 혼자 뜻을 전할 때만 준다(`role="img"` + `aria-label`). 라벨 옆 장식이면 비운다. */
  readonly label?: string;
}

export const EDITOR_ICON_NAMES = Object.keys(SPECS) as readonly EditorIconName[];

function svgAvailable(): boolean {
  return typeof document !== "undefined" && typeof document.createElementNS === "function";
}

/**
 * `.ee-icon.ee-icon-<name>` 클래스를 단 16px 아이콘 노드. SVG 를 못 만드는 환경에서는
 * 같은 클래스의 빈 `span` 을 돌려주므로 호출자는 분기하지 않는다.
 */
export function renderEditorIcon(name: EditorIconName, options: EditorIconOptions = {}): Element {
  const node: Element = svgAvailable()
    ? buildSvgIcon(SPECS[name])
    : document.createElement("span");
  node.setAttribute("class", `ee-icon ee-icon-${name}`);
  if (options.label) {
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", options.label);
    node.removeAttribute("aria-hidden");
  } else {
    node.setAttribute("aria-hidden", "true");
  }
  return node;
}
