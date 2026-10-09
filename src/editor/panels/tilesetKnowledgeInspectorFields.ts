import { el } from "@/util/dom";

export function renderKnowledgeTextField(
  label: string,
  value: string,
  testid: string,
  onInput: (value: string) => void,
): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } });
  input.addEventListener("input", () => onInput(input.value));
  return el("label", { class: "tileset-knowledge-field", children: [el("span", { text: label }), input] });
}

export function renderKnowledgeTextArea(
  label: string,
  value: string,
  onInput: (value: string) => void,
): HTMLElement {
  const input = el("textarea", { text: value });
  input.addEventListener("input", () => onInput(input.value));
  return el("label", { class: "tileset-knowledge-field", children: [el("span", { text: label }), input] });
}
