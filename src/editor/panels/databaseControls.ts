import { el } from "@/util/dom";

export function textField(label: string, testid: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value, dataset: { testid } });
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

export function textControl(label: string, value: string, onInput: (value: string) => void, testid?: string): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, value });
  if (testid) input.dataset.testid = testid;
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

export function numberField(label: string, testid: string, value: number, onInput: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number" }, value, dataset: { testid } });
  input.addEventListener("input", () => onInput(Number(input.value)));
  return field(label, input);
}

export function selectField(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void
): HTMLElement {
  const select = baseSelect(value, options);
  select.dataset.testid = testid;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

export function selectRecord(
  label: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onChange: (value: string) => void
): HTMLElement {
  const select = baseSelect(value, options);
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

export function selectLiteral<T extends string>(
  label: string,
  testid: string,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void
): HTMLElement {
  const select = el("select", { dataset: { testid } });
  for (const option of options) select.append(el("option", { text: literalLabel(option), attrs: { value: option } }));
  select.value = value;
  select.addEventListener("change", () => {
    const next = options.find((option) => option === select.value);
    if (next) onChange(next);
  });
  return field(label, select);
}

export function selectTextLiteral<T extends string>(
  label: string,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void
): HTMLElement {
  const select = el("select");
  for (const option of options) select.append(el("option", { text: option, attrs: { value: option } }));
  select.value = value;
  select.addEventListener("change", () => {
    const next = options.find((option) => option === select.value);
    if (next) onChange(next);
  });
  return field(label, select);
}

export function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "db-field", children: [el("span", { text: label }), control] });
}

export function emptyToUndefined(value: string): string | undefined {
  return value.trim() ? value.trim() : undefined;
}

export function matchesNameOrId(name: string, id: string, query: string): boolean {
  const normalized = query.toLowerCase();
  return name.toLowerCase().includes(normalized) || id.toLowerCase().includes(normalized);
}

function literalLabel(value: string): string {
  switch (value) {
    case "self":
      return "자기 자신";
    case "ally":
      return "아군";
    case "enemy":
      return "적";
    case "allEnemies":
      return "적 전체";
    case "none":
      return "없음";
    case "weapon":
      return "무기";
    case "shield":
      return "방패";
    case "armor":
      return "갑옷";
    case "helmet":
      return "투구";
    case "accessory":
      return "장신구";
    default:
      return value;
  }
}

function baseSelect(value: string, options: readonly { readonly id: string; readonly name: string }[]): HTMLSelectElement {
  const select = el("select");
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  for (const option of options) select.append(el("option", { text: option.name, attrs: { value: option.id } }));
  select.value = value;
  return select;
}
