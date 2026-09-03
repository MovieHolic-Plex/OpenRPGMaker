type SvgIconName =
  | "brush" | "eraser" | "fill" | "inspector" | "pen" | "rect" | "round" | "select" | "template" | "undo"
  | "eyedropper" | "event" | "tile" | "layers" | "layerGround" | "layerOverlay" | "layerEvent"
  | "map" | "hand" | "collision" | "more"
  | "terrain" | "structure" | "polish" | "npc" | "chest" | "combat" | "mood"
  | "composite" | "pin" | "save" | "warning" | "door" | "sign" | "shop"
  | "close" | "check"
  // 스튜디오 바(톱바) 세트 — 2026-09-03 표준·전문가 셸 개편. 클래식 툴바의 CSS 배경 아이콘
  // (components/icons.css 의 .oprn-icon-*) 대신 사이드바와 같은 22px 스트로크 규격을 쓴다.
  | "database" | "image" | "globe" | "music" | "docSearch" | "command" | "play" | "gear"
  | "history" | "user" | "help" | "expand" | "chevronDown" | "panels";
type SvgTag = "path" | "rect" | "circle";
type SvgNodeSpec = {
  readonly tag: SvgTag;
  readonly attrs: Readonly<Record<string, string>>;
};

const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS: Record<SvgIconName, readonly SvgNodeSpec[]> = {
  brush: [
    { tag: "path", attrs: { d: "M5 17c2.5-.4 4-1.6 4-3.6V12l6.5-6.5a2.1 2.1 0 0 1 3 3L12 15v1.2c0 2.5-1.9 4.3-5.7 4.8" } },
    { tag: "path", attrs: { d: "M13.5 7.5l3 3" } },
  ],
  eraser: [
    { tag: "path", attrs: { d: "M4 15.5l8.5-8.5a2.2 2.2 0 0 1 3.1 0l2.4 2.4a2.2 2.2 0 0 1 0 3.1L11.5 19H7.6z" } },
    { tag: "path", attrs: { d: "M10.5 9l4.5 4.5" } },
    { tag: "path", attrs: { d: "M12 19h7" } },
  ],
  fill: [
    { tag: "path", attrs: { d: "M5 10l5-5 7 7-5 5H5z" } },
    { tag: "path", attrs: { d: "M6 10h11" } },
    { tag: "path", attrs: { d: "M17 16c1.6 1.8 2.5 3 2.5 4a2.5 2.5 0 0 1-5 0c0-1 .9-2.2 2.5-4z" } },
  ],
  inspector: [
    { tag: "rect", attrs: { x: "4", y: "4", width: "14", height: "14", rx: "2" } },
    { tag: "path", attrs: { d: "M8 8h6" } },
    { tag: "path", attrs: { d: "M8 11h7" } },
    { tag: "path", attrs: { d: "M8 14h4" } },
  ],
  pen: [
    { tag: "path", attrs: { d: "M4 16l1.5-4.5L14 3l3 3-8.5 8.5z" } },
    { tag: "path", attrs: { d: "M12.5 4.5l3 3" } },
    { tag: "path", attrs: { d: "M4 20h14" } },
  ],
  rect: [
    { tag: "rect", attrs: { x: "4", y: "5", width: "14", height: "11", rx: "1.5" } },
    { tag: "rect", attrs: { x: "7", y: "8", width: "8", height: "5", fill: "currentColor", opacity: "0.22" } },
  ],
  round: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7" } },
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "3.5", fill: "currentColor", opacity: "0.22" } },
  ],
  select: [
    { tag: "rect", attrs: { x: "4", y: "4", width: "11", height: "9", "stroke-dasharray": "2 2" } },
    { tag: "path", attrs: { d: "M13 13l5 2-2 1 2 3-2 1-2-3-2 2z" } },
  ],
  template: [
    { tag: "path", attrs: { d: "M4 11l7-6 7 6" } },
    { tag: "path", attrs: { d: "M6 10v8h10v-8" } },
    { tag: "rect", attrs: { x: "9", y: "13", width: "4", height: "5" } },
  ],
  undo: [
    { tag: "path", attrs: { d: "M7 7H3V3" } },
    { tag: "path", attrs: { d: "M3 7c2.6-3.2 7.9-4.2 11.4-1.7 3.7 2.6 4.1 8 .8 11.1-2.3 2.1-5.7 2.5-8.4 1" } },
  ],
  eyedropper: [
    { tag: "path", attrs: { d: "M14.5 3.5l4 4-2.5 2.5-4-4z" } },
    { tag: "path", attrs: { d: "M12 6L5 13l-1 5 5-1 7-7" } },
  ],
  event: [
    { tag: "path", attrs: { d: "M6 3v18" } },
    { tag: "path", attrs: { d: "M6 4h11l-2.5 3.5L17 11H6" } },
  ],
  tile: [
    { tag: "rect", attrs: { x: "4", y: "4", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "12", y: "4", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "4", y: "12", width: "6", height: "6" } },
    { tag: "rect", attrs: { x: "12", y: "12", width: "6", height: "6", fill: "currentColor", opacity: "0.22" } },
  ],
  layers: [
    { tag: "path", attrs: { d: "M11 3l8 4.5-8 4.5-8-4.5z" } },
    { tag: "path", attrs: { d: "M3 12l8 4.5 8-4.5" } },
    { tag: "path", attrs: { d: "M3 16.5L11 21l8-4.5" } },
  ],
  layerGround: [
    { tag: "path", attrs: { d: "M3 11l8-4.5 8 4.5-8 4.5z" } },
    { tag: "path", attrs: { d: "M3 11v4l8 4.5 8-4.5v-4" } },
  ],
  layerOverlay: [
    { tag: "path", attrs: { d: "M3 16l8-4 8 4-8 4z" } },
    { tag: "path", attrs: { d: "M11 2l1.2 3.3 3.3 1.2-3.3 1.2L11 11 9.8 7.7 6.5 6.5l3.3-1.2z" } },
  ],
  layerEvent: [
    { tag: "path", attrs: { d: "M4 16l7-4 7 4-7 4z" } },
    { tag: "path", attrs: { d: "M11 16V3" } },
    { tag: "path", attrs: { d: "M11 4h7l-2 2.5L18 9h-7" } },
  ],
  map: [
    { tag: "path", attrs: { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" } },
    { tag: "path", attrs: { d: "M9 4v14" } },
    { tag: "path", attrs: { d: "M15 6v14" } },
  ],
  hand: [
    { tag: "path", attrs: { d: "M11 3v16" } },
    { tag: "path", attrs: { d: "M3 11h16" } },
    { tag: "path", attrs: { d: "M8 6l3-3 3 3" } },
    { tag: "path", attrs: { d: "M8 16l3 3 3-3" } },
    { tag: "path", attrs: { d: "M6 8l-3 3 3 3" } },
    { tag: "path", attrs: { d: "M16 8l3 3-3 3" } },
  ],
  collision: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7.5" } },
    { tag: "path", attrs: { d: "M5.8 5.8l10.4 10.4" } },
  ],
  more: [
    { tag: "circle", attrs: { cx: "5", cy: "11", r: "1.1", fill: "currentColor" } },
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "1.1", fill: "currentColor" } },
    { tag: "circle", attrs: { cx: "17", cy: "11", r: "1.1", fill: "currentColor" } },
  ],
  terrain: [
    { tag: "path", attrs: { d: "M3 17l6-9 5 7" } },
    { tag: "path", attrs: { d: "M11 15l3-4.5L19 17H3z" } },
  ],
  structure: [
    { tag: "path", attrs: { d: "M3 10.5L11 4l8 6.5" } },
    { tag: "path", attrs: { d: "M5 10v8h12v-8" } },
    { tag: "path", attrs: { d: "M9 18v-5h4v5" } },
  ],
  polish: [
    { tag: "path", attrs: { d: "M13 3l1.8 5.2L20 10l-5.2 1.8L13 17l-1.8-5.2L6 10l5.2-1.8L13 3z" } },
    { tag: "path", attrs: { d: "M5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z" } },
  ],
  npc: [
    { tag: "circle", attrs: { cx: "11", cy: "7.5", r: "3.5" } },
    { tag: "path", attrs: { d: "M4.5 18.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" } },
  ],
  chest: [
    { tag: "rect", attrs: { x: "3.5", y: "10", width: "15", height: "8", rx: "1.5" } },
    { tag: "path", attrs: { d: "M4 10a4 4 0 0 1 7-3 4 4 0 0 1 7 3" } },
    { tag: "path", attrs: { d: "M3.5 12.5h15" } },
    { tag: "circle", attrs: { cx: "11", cy: "14.5", r: "1", fill: "currentColor" } },
  ],
  combat: [
    { tag: "path", attrs: { d: "M18.5 3.5L3.5 18.5" } },
    { tag: "path", attrs: { d: "M3.5 3.5l15 15" } },
    { tag: "path", attrs: { d: "M15 3h4v4" } },
    { tag: "path", attrs: { d: "M3 7V3h4" } },
  ],
  mood: [
    { tag: "path", attrs: { d: "M11.5 3.5a7.5 7.5 0 1 0 7 10.8A8 8 0 0 1 11.5 3.5z" } },
    { tag: "circle", attrs: { cx: "16.5", cy: "6.5", r: "1", fill: "currentColor" } },
  ],
  composite: [
    { tag: "rect", attrs: { x: "3.5", y: "7.5", width: "9", height: "9", rx: "1.5" } },
    { tag: "rect", attrs: { x: "9.5", y: "5.5", width: "9", height: "9", rx: "1.5", fill: "currentColor", opacity: "0.22" } },
  ],
  pin: [
    { tag: "path", attrs: { d: "M11 20s6-6.5 6-11a6 6 0 1 0-12 0c0 4.5 6 11 6 11z" } },
    { tag: "circle", attrs: { cx: "11", cy: "9", r: "2" } },
  ],
  save: [
    { tag: "path", attrs: { d: "M4 4.5A1.5 1.5 0 0 1 5.5 3H15l4 4v10.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 17.5z" } },
    { tag: "path", attrs: { d: "M7 3v5h8V3" } },
    { tag: "rect", attrs: { x: "7", y: "13", width: "8", height: "5" } },
  ],
  warning: [
    { tag: "path", attrs: { d: "M11 3.5l8.5 15H2.5L11 3.5z" } },
    { tag: "path", attrs: { d: "M11 9v4" } },
    { tag: "circle", attrs: { cx: "11", cy: "16", r: "0.9", fill: "currentColor" } },
  ],
  door: [
    { tag: "path", attrs: { d: "M4 19h14" } },
    { tag: "path", attrs: { d: "M6 19V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 16 5v14" } },
    { tag: "circle", attrs: { cx: "13.5", cy: "12", r: "1", fill: "currentColor" } },
  ],
  sign: [
    { tag: "rect", attrs: { x: "3.5", y: "4.5", width: "15", height: "8", rx: "1.5" } },
    { tag: "path", attrs: { d: "M11 12.5V19" } },
    { tag: "path", attrs: { d: "M7 19h8" } },
  ],
  shop: [
    { tag: "path", attrs: { d: "M3.5 8.5L5 4h12l1.5 4.5" } },
    { tag: "path", attrs: { d: "M3.5 8.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" } },
    { tag: "path", attrs: { d: "M5 10.5V18h12v-7.5" } },
  ],
  close: [
    { tag: "path", attrs: { d: "M6 6l10 10" } },
    { tag: "path", attrs: { d: "M16 6l-10 10" } },
  ],
  check: [
    { tag: "path", attrs: { d: "M5 12l4 4 8-9" } },
  ],
  database: [
    { tag: "path", attrs: { d: "M4 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z" } },
    { tag: "path", attrs: { d: "M4 6v10c0 1.7 3.1 3 7 3s7-1.3 7-3V6" } },
    { tag: "path", attrs: { d: "M4 11c0 1.7 3.1 3 7 3s7-1.3 7-3" } },
  ],
  image: [
    { tag: "rect", attrs: { x: "3.5", y: "4.5", width: "15", height: "13", rx: "1.5" } },
    { tag: "path", attrs: { d: "M3.5 15l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" } },
    { tag: "circle", attrs: { cx: "14.5", cy: "8.5", r: "1.3", fill: "currentColor" } },
  ],
  globe: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7.5" } },
    { tag: "path", attrs: { d: "M3.5 11h15" } },
    { tag: "path", attrs: { d: "M11 3.5c2.3 2.2 3.4 4.7 3.4 7.5s-1.1 5.3-3.4 7.5c-2.3-2.2-3.4-4.7-3.4-7.5S8.7 5.7 11 3.5z" } },
  ],
  music: [
    { tag: "path", attrs: { d: "M8.5 16.5V5l9-2v11.5" } },
    { tag: "circle", attrs: { cx: "6", cy: "16.5", r: "2.5" } },
    { tag: "circle", attrs: { cx: "15", cy: "14.5", r: "2.5" } },
  ],
  docSearch: [
    { tag: "path", attrs: { d: "M12 3.5H6.5A1.5 1.5 0 0 0 5 5v12a1.5 1.5 0 0 0 1.5 1.5H10" } },
    { tag: "path", attrs: { d: "M12 3.5V8h4.5" } },
    { tag: "path", attrs: { d: "M8 12h3" } },
    { tag: "circle", attrs: { cx: "14.5", cy: "14.5", r: "2.8" } },
    { tag: "path", attrs: { d: "M16.6 16.6L19 19" } },
  ],
  command: [
    { tag: "circle", attrs: { cx: "10", cy: "10", r: "5.5" } },
    { tag: "path", attrs: { d: "M14 14l4.5 4.5" } },
  ],
  play: [
    { tag: "path", attrs: { d: "M7 4.5v13l10-6.5z", fill: "currentColor", stroke: "none" } },
  ],
  gear: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "2.6" } },
    { tag: "path", attrs: { d: "M11 3.2l1.3 2.2 2.5-.5.7 2.5 2.4 1-1 2.4 1.6 2-2 1.6-.1 2.6-2.5.3-1.5 2.1-2.4-1.1-2.4 1.1-1.5-2.1-2.5-.3-.1-2.6-2-1.6 1.6-2-1-2.4 2.4-1 .7-2.5 2.5.5z" } },
  ],
  history: [
    { tag: "path", attrs: { d: "M4.5 11a6.5 6.5 0 1 0 1.9-4.6" } },
    { tag: "path", attrs: { d: "M4 3.5v3.5h3.5" } },
    { tag: "path", attrs: { d: "M11 7.5V11l2.5 1.8" } },
  ],
  user: [
    { tag: "circle", attrs: { cx: "11", cy: "7.5", r: "3.3" } },
    { tag: "path", attrs: { d: "M4.5 18.5c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6" } },
  ],
  help: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "7.5" } },
    { tag: "path", attrs: { d: "M8.6 8.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 .9-1 1.6" } },
    { tag: "circle", attrs: { cx: "11", cy: "15.3", r: "0.9", fill: "currentColor" } },
  ],
  expand: [
    { tag: "path", attrs: { d: "M13 4h5v5" } },
    { tag: "path", attrs: { d: "M18 4l-5.5 5.5" } },
    { tag: "path", attrs: { d: "M9 18H4v-5" } },
    { tag: "path", attrs: { d: "M4 18l5.5-5.5" } },
  ],
  chevronDown: [
    { tag: "path", attrs: { d: "M6.5 9l4.5 4.5L15.5 9" } },
  ],
  panels: [
    { tag: "rect", attrs: { x: "3.5", y: "4.5", width: "15", height: "13", rx: "1.5" } },
    { tag: "path", attrs: { d: "M9 4.5v13" } },
    { tag: "path", attrs: { d: "M3.5 12H9" } },
  ],
};

/** 노드 스펙에서 22×22 스트로크 아이콘을 만든다. 이 저장소의 아이콘은 전부 이 규격을
 *  통과한다 — 다른 화면이 자기 아이콘 세트를 가질 때도 빌더는 하나만 쓴다
 *  (예: databaseTabIcons.ts 의 DB 사이드바 세트). */
export function buildSvgIcon(nodes: readonly SvgNodeSpec[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const spec of nodes) {
    const child = document.createElementNS(SVG_NS, spec.tag);
    for (const [name, value] of Object.entries(spec.attrs)) {
      child.setAttribute(name, value);
    }
    svg.append(child);
  }

  return svg;
}

export function makeSvgIcon(icon: SvgIconName): SVGSVGElement {
  return buildSvgIcon(ICONS[icon]);
}

export const SVG_ICON_NAMES = Object.keys(ICONS) as readonly SvgIconName[];

export type { SvgIconName, SvgNodeSpec };
