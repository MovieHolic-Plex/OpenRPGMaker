import { el } from "@/util/dom";

export const CINEMATIC_KIND_NAMES = {
  text: "텍스트",
  image: "이미지",
  video: "동영상",
  animatic: "애니메틱",
} as const;

export function cinematicButton(
  suffix: string,
  label: string,
  action: () => void,
): HTMLButtonElement {
  return el("button", {
    class: "db-ws-btn",
    attrs: { type: "button" },
    dataset: { testid: `db-cinematic-${suffix}` },
    text: label,
    on: { click: action },
  });
}

export function cinematicNote(text: string): HTMLElement {
  return el("p", { class: "db-cinematic-note", text });
}
