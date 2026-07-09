type SvgIconName =
  | "brush" | "eraser" | "fill" | "inspector" | "pen" | "rect" | "round" | "select" | "template" | "undo"
  | "eyedropper" | "event" | "tile" | "layers" | "map";
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
  map: [
    { tag: "path", attrs: { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" } },
    { tag: "path", attrs: { d: "M9 4v14" } },
    { tag: "path", attrs: { d: "M15 6v14" } },
  ],
};

export function makeSvgIcon(icon: SvgIconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const spec of ICONS[icon]) {
    const child = document.createElementNS(SVG_NS, spec.tag);
    for (const [name, value] of Object.entries(spec.attrs)) {
      child.setAttribute(name, value);
    }
    svg.append(child);
  }

  return svg;
}

export const SVG_ICON_NAMES = Object.keys(ICONS) as readonly SvgIconName[];

export type { SvgIconName };
