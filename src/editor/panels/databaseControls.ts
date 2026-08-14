import { el } from "@/util/dom";
import {
  FACESET_COLUMNS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_ROWS,
} from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

const AVATAR_CHIP_SIZE = 40;

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

export type NumberFieldBounds = { readonly min: number; readonly max: number };

export type SliderStepperBounds = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
};

/**
 * 슬라이더 + 숫자 입력 쌍. 두 입력은 항상 클램프·스텝 정규화된 같은 값으로 동기화된다
 * (numberField 의 P4 패턴 — 화면과 저장값이 어긋나지 않게 클램프 결과를 되쓴다).
 */
export function sliderStepperField(
  label: string,
  testid: string,
  value: number,
  onInput: (value: number) => void,
  bounds: SliderStepperBounds
): HTMLElement {
  const range = el("input", {
    class: "db-slider-input",
    attrs: { type: "range", min: String(bounds.min), max: String(bounds.max), step: String(bounds.step) },
    value,
    dataset: { testid: `${testid}-slider` },
  }) as HTMLInputElement;
  const stepper = el("input", {
    class: "db-stepper-input",
    attrs: { type: "number", min: String(bounds.min), max: String(bounds.max), step: String(bounds.step) },
    value,
    dataset: { testid: `${testid}-stepper` },
  }) as HTMLInputElement;
  const normalize = (raw: number): number => {
    const numeric = Number.isFinite(raw) ? raw : bounds.min;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, numeric));
    const offset = clamped - bounds.min;
    return bounds.min + Math.round(offset / bounds.step) * bounds.step;
  };
  // 초기값도 즉시 정규화해 두 입력의 표시가 범위 밖 데이터에서도 일치하게 한다.
  const initial = normalize(value);
  range.value = String(initial);
  stepper.value = String(initial);
  const commit = (source: HTMLInputElement, next: number): void => {
    range.value = String(next);
    stepper.value = String(next);
    // 소스 입력은 클램프가 값을 실제로 바꿨을 때만 되쓴다 — 타이핑 중 커서 점프 방지.
    const rewritten = String(next) !== source.value;
    if (rewritten) source.value = String(next);
    onInput(next);
  };
  range.addEventListener("input", () => commit(range, normalize(Number(range.value))));
  stepper.addEventListener("input", () => {
    if (stepper.value === "") return;
    commit(stepper, normalize(Number(stepper.value)));
  });
  stepper.addEventListener("change", () => commit(stepper, normalize(Number(stepper.value))));
  const pair = el("span", {
    class: "db-slider-stepper",
    children: [
      range,
      stepper,
      ...(bounds.unit ? [el("span", { class: "db-slider-unit", text: bounds.unit })] : []),
    ],
  });
  return field(label, pair);
}

/**
 * 숫자 필드. bounds 를 주면 percentField 패턴으로 입력 즉시 클램프하고
 * 클램프된 값을 input.value 에 되써서 화면과 저장값이 어긋나지 않게 한다(P4).
 * bounds 가 없어도 blur(change) 시 표시값을 숫자로 정규화해 NaN/빈 입력 잔상을 막는다.
 */
export function numberField(
  label: string,
  testid: string,
  value: number,
  onInput: (value: number) => void,
  bounds?: NumberFieldBounds
): HTMLElement {
  const attrs: Record<string, string> = { type: "number" };
  if (bounds) {
    attrs.min = String(bounds.min);
    attrs.max = String(bounds.max);
  }
  const input = el("input", { attrs, value, dataset: { testid } });
  const normalize = (raw: number): number => {
    const numeric = Number.isFinite(raw) ? raw : bounds ? bounds.min : 0;
    if (!bounds) return numeric;
    return Math.min(bounds.max, Math.max(bounds.min, numeric));
  };
  input.addEventListener("input", () => {
    const next = normalize(Number(input.value));
    // 클램프가 실제로 값을 바꿨을 때만 되쓴다 — 타이핑 중 커서 점프 방지.
    if (bounds && input.value !== "" && String(next) !== input.value) input.value = String(next);
    onInput(next);
  });
  input.addEventListener("change", () => {
    const next = normalize(Number(input.value));
    input.value = String(next);
    onInput(next);
  });
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

/**
 * 배타 선택 필(세그먼티드 컨트롤) — 네이티브 radio 그룹. 방향키 이동은 브라우저
 * 기본 동작에 맡긴다(포커스 트랩/커스텀 키 처리 없음), Escape 도 모달 최상층
 * 라우팅 그대로 통과시킨다.
 */
export function segmentedControl(
  label: string,
  testid: string,
  value: string,
  options: readonly { readonly id: string; readonly name: string }[],
  onInput: (value: string) => void
): HTMLElement {
  const groupName = `db-segmented-${testid}`;
  const group = el("div", {
    class: "db-segmented",
    attrs: { role: "radiogroup" },
    dataset: { testid },
  });
  for (const option of options) {
    const input = el("input", {
      attrs: { type: "radio", name: groupName, value: option.id },
      dataset: { testid: `${testid}-option` },
    }) as HTMLInputElement;
    input.checked = option.id === value;
    input.addEventListener("change", () => {
      if (input.checked) onInput(input.value);
    });
    group.append(el("label", { class: "db-segmented-pill", children: [input, el("span", { text: option.name })] }));
  }
  return field(label, group);
}

/**
 * 토글 스위치 — checkbox input 을 CSS 로 스위치처럼 꾸민다. Space/클릭 토글은
 * 네이티브 checkbox 기본 동작(키 핸들러 없음).
 */
export function toggleSwitch(
  label: string,
  testid: string,
  checked: boolean,
  onInput: (checked: boolean) => void
): HTMLElement {
  const input = el("input", {
    class: "db-toggle-input",
    attrs: { type: "checkbox", role: "switch" },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  return field(
    label,
    el("span", { class: "db-toggle-switch", children: [input, el("span", { class: "db-toggle-thumb" })] })
  );
}

export type AvatarChipActor = {
  readonly id: string;
  readonly name: string;
  readonly faceResourceId?: string;
  readonly faceIndex?: number;
};

/**
 * 배우 아바타 칩 행 — faceset 원형 칩 버튼(actorThumbnail 과 같은 크롭 수식,
 * 크기만 칩 사이즈로 조정). 미선택 칩은 dim, 선택 상태는 aria-pressed 로 노출.
 * 칩은 네이티브 button — Tab 포커스/Enter·Space 활성화 모두 브라우저 기본 동작.
 */
export function avatarChipRow(
  label: string,
  testid: string,
  actors: readonly AvatarChipActor[],
  selectedIds: readonly string[],
  onToggle: (actorId: string, nextSelected: boolean) => void
): HTMLElement {
  const row = el("div", { class: "db-avatar-chip-row", dataset: { testid } });
  for (const actor of actors) {
    const chip = el("button", {
      class: "db-avatar-chip",
      attrs: { type: "button", "aria-pressed": selectedIds.includes(actor.id) ? "true" : "false" },
      dataset: { testid: `${testid}-chip`, actorId: actor.id },
    });
    if (!selectedIds.includes(actor.id)) chip.classList.add("dimmed");
    chip.append(faceChipAvatar(actor));
    chip.append(el("span", { class: "db-avatar-chip-name", text: actor.name }));
    chip.addEventListener("click", () => {
      const nextSelected = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", nextSelected ? "true" : "false");
      chip.classList.toggle("dimmed", !nextSelected);
      onToggle(actor.id, nextSelected);
    });
    row.append(chip);
  }
  return field(label, row);
}

function faceChipAvatar(actor: AvatarChipActor): HTMLElement {
  const size = AVATAR_CHIP_SIZE;
  const url = resolveAssetResourceUrl(actor.faceResourceId);
  const slot = el("span", {
    class: "db-avatar-chip-face",
    attrs: { "aria-hidden": "true" },
  });
  if (!url) return slot;
  const faceIndex = actor.faceIndex ?? 0;
  const column = faceIndex % FACESET_COLUMNS;
  const row = Math.floor(faceIndex / FACESET_COLUMNS);
  const scale = size / FACESET_FACE_WIDTH;
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = `-${column * FACESET_FACE_WIDTH * scale}px -${row * FACESET_FACE_HEIGHT * scale}px`;
  slot.style.backgroundSize = `${FACESET_COLUMNS * FACESET_FACE_WIDTH * scale}px ${FACESET_ROWS * FACESET_FACE_HEIGHT * scale}px`;
  return slot;
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
      return "일반";
    case "normalGoods":
      return "일반 물품";
    case "add":
      return "부여";
    case "remove":
      return "해제";
    case "resist":
      return "저항";
    case "inflict":
      return "공격 시 부여";
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
    case "capture":
      return "포획";
    case "gauge":
      return "게이지";
    case "strict":
      return "엄격 턴제";
    case "classic":
      return "클래식 (RM2003풍)";
    case "pokemon":
      return "포켓몬풍";
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
