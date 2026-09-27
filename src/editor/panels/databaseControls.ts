import { el } from "@/util/dom";
import {
} from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { buildSvgIcon, type SvgNodeSpec } from "@/editor/panels/tileToolbarIcons";

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

// step 을 주면 <input type="number"> 의 기본 step=1 대신 소수 입력이 유효값이 된다.
// 이게 없으면 6.25(=1/16) 같은 값이 브라우저 검증에서 :invalid 로 표시된다.
export type NumberFieldBounds = { readonly min: number; readonly max: number; readonly step?: number };

/**
 * 스위치가 꺼져 있어 지금은 쓰이지 않는 값을 잠글 때 쓴다. 잠금은 `disabled` 하나로
 * 끝내지 말고 **왜 잠겼는지**를 `disabledReason` 으로 같이 준다 — 이유 없는 회색 입력은
 * 고장으로 읽힌다.
 */
export type NumberFieldOptions = {
  readonly disabled?: boolean;
  readonly disabledReason?: string;
};

const NUMBER_STEPPER_ICONS: Readonly<Record<"dec" | "inc", readonly SvgNodeSpec[]>> = {
  dec: [{ tag: "path", attrs: { d: "M5 11h12" } }],
  inc: [
    { tag: "path", attrs: { d: "M5 11h12" } },
    { tag: "path", attrs: { d: "M11 5v12" } },
  ],
};

function numberStepperIcon(kind: "dec" | "inc"): SVGSVGElement {
  const icon = buildSvgIcon(NUMBER_STEPPER_ICONS[kind]);
  icon.setAttribute("class", "db-number-stepper-icon");
  return icon;
}

function decimalPlaces(value: number): number {
  const [coefficient, exponentText] = String(value).toLowerCase().split("e");
  const fractionPlaces = coefficient?.split(".")[1]?.length ?? 0;
  return Math.max(0, fractionPlaces - Number(exponentText ?? 0));
}

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
  // 초기 표시는 **클램프만** 한다. 스텝까지 스냅하면 저장값이 스텝 배수가 아닐 때
  // (모델 계층은 clamp 만 하므로 흔하다 — 예: percentMax=33, step=5) 화면은 35, store 는 33
  // 이 되어 "표시값 ≠ 저장값"이 렌더 시점부터 생긴다. 그 상태에서 아무 입력이나 하면 첫
  // 커밋이 33→35 를 조용히 덮어썼다.
  // 스텝 정규화는 사용자가 실제로 조작할 때만 한다(commit 경로의 normalize).
  // range 는 step 속성 때문에 브라우저가 가장 가까운 유효값으로 붙여 그리지만, 권위 있는
  // 숫자를 보여 주는 stepper 는 저장값 그대로 남는다.
  const initialDisplay = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(value) ? value : bounds.min));
  range.value = String(initialDisplay);
  stepper.value = String(initialDisplay);
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
  return numericField(label, pair, stepper, range);
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
  bounds?: NumberFieldBounds,
  options?: NumberFieldOptions
): HTMLElement {
  const attrs: Record<string, string> = { type: "number" };
  if (bounds) {
    attrs.min = String(bounds.min);
    attrs.max = String(bounds.max);
    if (bounds.step !== undefined) attrs.step = String(bounds.step);
  }
  if (options?.disabled) {
    attrs.disabled = "true";
    if (options.disabledReason) attrs.title = options.disabledReason;
  }
  const input = el("input", { attrs, value, dataset: { testid } });
  const normalize = (raw: number): number => {
    const numeric = Number.isFinite(raw) ? raw : bounds ? bounds.min : 0;
    if (!bounds) return numeric;
    return Math.min(bounds.max, Math.max(bounds.min, numeric));
  };
  const decrement = el("button", {
    class: "db-number-stepper-button db-number-stepper-dec",
    attrs: { type: "button", "aria-label": `${label} 감소` },
    dataset: { testid: `${testid}-dec` },
    children: [numberStepperIcon("dec")],
  });
  const increment = el("button", {
    class: "db-number-stepper-button db-number-stepper-inc",
    attrs: { type: "button", "aria-label": `${label} 증가` },
    dataset: { testid: `${testid}-inc` },
    children: [numberStepperIcon("inc")],
  });
  const syncButtonState = (): void => {
    if (options?.disabled) {
      decrement.disabled = true;
      increment.disabled = true;
      return;
    }
    const current = normalize(Number(input.value));
    decrement.disabled = bounds !== undefined && current <= bounds.min;
    increment.disabled = bounds !== undefined && current >= bounds.max;
  };
  const commitInput = (rewrite: boolean): void => {
    const next = normalize(Number(input.value));
    // 클램프가 실제로 값을 바꿨을 때만 되쓴다 — 타이핑 중 커서 점프 방지.
    if (rewrite || (bounds && input.value !== "" && String(next) !== input.value)) input.value = String(next);
    syncButtonState();
    onInput(next);
  };
  input.addEventListener("input", () => {
    // 빈 칸은 "지우는 중"이지 0 이 아니다. Number("") === 0 이 isFinite 를 통과하는 탓에
    // 전체 선택 후 삭제하는 평범한 제스처가 매 keystroke 0(또는 min)을 커밋했고, 화면은
    // rewrite 가드(input.value !== "") 때문에 빈 칸으로 남아 사용자가 알아채지 못했다.
    // 가격 0, 최소 기부 개수 0 같은 조용한 데이터 손상 경로다.
    // 형제 컨트롤 sliderStepperField 는 이미 빈 입력을 무시한다 — 같은 규약으로 맞춘다.
    // 빈 칸의 최종 확정은 아래 change(블러)가 normalize 해서 맡는다.
    if (input.value === "") return;
    commitInput(false);
  });
  input.addEventListener("change", () => commitInput(true));

  const stepBy = (direction: -1 | 1): void => {
    const step = bounds?.step ?? 1;
    const current = normalize(Number(input.value));
    const precision = Math.min(12, Math.max(decimalPlaces(current), decimalPlaces(step), decimalPlaces(bounds?.min ?? 0)));
    input.value = String(normalize(Number((current + direction * step).toFixed(precision))));
    // 타이핑과 같은 이벤트/콜백 경로를 사용해 호출자의 저장·리렌더 동작을 보존한다.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  decrement.addEventListener("click", () => stepBy(-1));
  increment.addEventListener("click", () => stepBy(1));
  syncButtonState();

  return numericField(
    label,
    el("span", {
      class: `db-number-stepper${options?.disabled ? " is-disabled" : ""}`,
      children: [decrement, input, increment],
    }),
    input
  );
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
  // field() 로 감싸면 캡션 클릭이 첫 라디오를 체크한다 — labelledGroupField() 참고.
  return labelledGroupField(label, group);
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
};

/**
 * 배우 아바타 칩 행 — 낱장 얼굴 그림을 원형 칩 버튼에 담는다(actorThumbnail 과 같은 수식,
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
  // 칩은 button 이라 field() 로 감싸면 캡션 클릭이 첫 칩을 토글한다 — labelledGroupField() 참고.
  row.setAttribute("role", "group");
  return labelledGroupField(label, row);
}

function faceChipAvatar(actor: AvatarChipActor): HTMLElement {
  const size = AVATAR_CHIP_SIZE;
  const url = resolveAssetResourceUrl(actor.faceResourceId);
  const slot = el("span", {
    class: "db-avatar-chip-face",
    attrs: { "aria-hidden": "true" },
  });
  if (!url) return slot;
  slot.style.backgroundImage = `url("${url}")`;
  slot.style.backgroundPosition = "center";
  slot.style.backgroundSize = `${size}px ${size}px`;
  return slot;
}

let numericFieldSequence = 0;

function numericField(label: string, control: HTMLElement, input: HTMLInputElement, range?: HTMLInputElement): HTMLElement {
  const labelId = `db-numeric-field-${++numericFieldSequence}`;
  input.id = `${labelId}-input`;
  const caption = el("label", { text: label, attrs: { id: labelId, for: input.id } });
  if (range) range.setAttribute("aria-labelledby", labelId);
  // Keep both grid spans, but put only the caption inside the label: a wrapping
  // label activates the first stepper button instead of the numeric input.
  return el("div", {
    class: "db-field",
    children: [el("span", { attrs: { title: label }, children: [caption] }), control],
  });
}

export function field(label: string, control: HTMLElement): HTMLElement {
  // 라벨 칸은 `text-overflow: ellipsis` 라 좁아지면 글자가 잘린다("이동 간격(ms)" 가
  // "이동 간격(..." 로 실측됐다). 잘려도 전체 문구에 닿을 수 있게 title 을 항상 건다.
  //
  // 주의: 이 래퍼는 **컨트롤이 하나일 때만** 쓴다. 감싸는 label 은 "안쪽 첫 labelable
  // 자손"을 캡션 클릭만으로 발화시키므로(button 도 labelable), 컨트롤이 여럿인 그룹에
  // 쓰면 첫 라디오·첫 칩이 조용히 눌린다. 그룹은 labelledGroupField() 를 쓸 것.
  return el("label", {
    class: "db-field",
    children: [el("span", { text: label, attrs: { title: label } }), control],
  });
}

let groupFieldSequence = 0;

/**
 * 컨트롤이 여럿인 그룹(라디오 그룹·칩 행)용 필드. field() 와 **격자 모양은 같지만**
 * 캡션을 label 로 감싸지 않는다.
 *
 * 왜: 감싸는 `<label>` 은 `for` 가 없으면 "안쪽 첫 labelable 자손"을 라벨 대상으로 잡고,
 * 캡션 글자 클릭이 그 대상에 synthetic click 을 보낸다. button 도 labelable 이라
 * 라디오 그룹은 첫 라디오가 체크되고, 칩 행은 첫 칩의 onToggle 이 발화해 **데이터가
 * 조용히 바뀐다**(2026-09-19 크로미움 실측: 세그먼티드는 현재 선택이 첫 옵션이 아닐 때,
 * 칩은 조건 없이 매번). numericField 가 같은 이유로 이미 회피하고 있던 규약을 그룹으로 넓힌다.
 *
 * 접근명은 캡션 id 를 그룹에 `aria-labelledby` 로 물려 유지한다.
 */
function labelledGroupField(label: string, group: HTMLElement): HTMLElement {
  const captionId = `db-group-field-${++groupFieldSequence}`;
  group.setAttribute("aria-labelledby", captionId);
  return el("div", {
    class: "db-field",
    children: [el("span", { text: label, attrs: { id: captionId, title: label } }), group],
  });
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
      return "턴 전투";
    case "classic":
      return "클래식 (정면 전투)";
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
    case "steal":
      return "훔치기";
    case "scan":
      return "라이브라(탐색)";
    case "learnEnemySkill":
      return "적 기술 습득(청마법)";
    case "randomSkillFrom":
      return "무작위 기술(흉내·춤·슬롯)";
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
