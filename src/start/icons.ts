// start/icons.ts
// 시작 화면과 컨셉 피드의 16px 선 아이콘. 아이콘 라이브러리를 싣지 않는다 — 이 화면들에 필요한 것만.
// 그림 문자(▶ ✏️)는 글꼴마다 모양·색이 달라 쓰지 않는다. CSS 를 싣지 않으므로 편집기의 덮는 창도 가져다 쓴다.
import { el } from "@/util/dom";

const svg = (body: string, filled = false): string =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

const START_ICONS = {
  play: svg('<path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z"/>', true),
  make: svg('<path d="M10.8 2.2 13.8 5.2 5.6 13.4H2.6v-3z"/><path d="M9.2 3.8l3 3"/>'),
  search: svg('<circle cx="7" cy="7" r="4.5"/><path d="m10.4 10.4 3.4 3.4"/>'),
  folder: svg('<path d="M1.8 4.2c0-.6.5-1.1 1.1-1.1h3.2l1.5 1.6h5.5c.6 0 1.1.5 1.1 1.1v6.3c0 .6-.5 1.1-1.1 1.1H2.9c-.6 0-1.1-.5-1.1-1.1z"/>'),
  team: svg('<circle cx="6" cy="5.5" r="2.3"/><path d="M1.9 13.2c.5-2.2 2.1-3.5 4.1-3.5s3.6 1.3 4.1 3.5"/><path d="M10.6 3.4a2.2 2.2 0 0 1 0 4.2M12.2 9.9c1 .5 1.7 1.6 1.9 3.3"/>'),
  file: svg('<path d="M3.5 1.8h5.6l3.4 3.4v8.4c0 .3-.3.6-.6.6H3.5c-.3 0-.6-.3-.6-.6V2.4c0-.3.3-.6.6-.6Z"/><path d="M9 1.9v3.4h3.4"/>'),
  back: svg('<path d="M9.8 3.5 5.3 8l4.5 4.5"/>'),
  close: svg('<path d="m4 4 8 8M12 4l-8 8"/>'),
} as const;

export type StartIconName = keyof typeof START_ICONS;

export function startIcon(name: StartIconName, className: string): HTMLElement {
  return el("span", { class: className, html: START_ICONS[name], attrs: { "aria-hidden": "true" } });
}
