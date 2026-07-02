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
    case "allAllies":
      return "아군 전체";
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
    case "body":
      return "갑옷";
    case "helmet":
      return "머리";
    case "accessory":
      return "장신구";
    case "normal":
    case "normalGoods":
      return "일반 물품";
    case "switch":
      return "스위치";
    case "medicine":
      return "약";
    case "book":
    case "skillBook":
      return "책";
    case "seed":
      return "씨앗";
    case "special":
      return "특수";
    case "noLimit":
      return "제한 없음";
    case "always":
      return "항상";
    case "battle":
      return "전투 중";
    case "turn":
      return "턴";
    case "moment":
      return "순간";
    case "field":
      return "필드";
    case "never":
      return "사용 불가";
    case "teleport":
      return "장소 이동";
    case "escape":
      return "탈출";
    case "singleTarget":
      return "단일 대상";
    case "allTargets":
      return "전체 대상";
    case "screen":
      return "화면";
    case "head":
      return "머리";
    case "center":
      return "중앙";
    case "feet":
      return "발";
    case "attack":
      return "공격";
    case "skill":
      return "스킬";
    case "skillSubset":
      return "스킬 계열";
    case "defend":
      return "방어";
    case "item":
      return "아이템";
    case "event":
      return "이벤트";
    case "physical":
      return "물리";
    case "magical":
      return "마법";
    case "damage":
      return "피해";
    case "healing":
      return "회복";
    case "support":
      return "보조";
    case "hp":
      return "HP";
    case "mp":
      return "MP";
    case "mind":
      return "정신력";
    case "transparent":
      return "투명";
    case "variable":
      return "변수";
    case "enemyHp":
      return "적 HP";
    case "actorHp":
      return "배우 HP";
    case "actorCommand":
      return "배우 명령";
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
