/** Shared pictures for the terrain dock and its guide. Labels stay on the controls. */
const PATHS = {
  height: '<path d="m2 19 6-9 4 5 4-11 6 15Z"/><path d="M3 22h18"/>',
  surface: '<path d="m3 9 9-5 9 5-9 5Z"/><path d="m3 13 9 5 9-5M3 17l9 5 9-5"/>',
  river: '<path d="M8 2c8 4-7 6 1 10s-5 7 1 10M14 2c8 4-7 6 1 10s-5 7 1 10"/>',
  group: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="14" r="2"/>',
  house: '<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/><path d="M16 4V2h3v4"/>',
  road: '<path d="M7 2 4 22M17 2l3 20M12 3v4M12 10v4M12 17v4"/>',
  doodad: '<path d="m9 2-5 7h3l-4 6h12l-4-6h3ZM9 15v6M15 21h7l-2-6h-4Z"/>',
  design: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
  reachable: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 18h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  grass: '<path d="M4 21h16M7 21 4 11l6 5 2-12 2 12 6-5-3 10"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
} as const;

export type TerrainToolbarIcon = keyof typeof PATHS;

export function terrainToolbarIcon(icon: TerrainToolbarIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = PATHS[icon];
  return svg;
}
