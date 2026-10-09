// 「도트 연출」 탭의 손잡이 입력 조각 — 색 견본 칩·속도 슬라이더·무게 3단·화면 효과·효과음 고르기.
// 값 정규화는 저장 쪽(skillChoreographyRecords)이 맡고, 여기는 입력 위젯만 만든다.
//
// DOM 계약: 칩은 button[data-tint=<id|original|inherit>][aria-pressed]. 화면 색은 input[type=color].
import { EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { RETRO_TINT_ORIGINAL, RETRO_TINT_PRESETS } from "@/assets/retroChoreographyTints";
import { selectField } from "@/editor/panels/databaseControls";
import { el } from "@/util/dom";

/** 층 색 칩에서 「연출 전체 색을 따른다」를 뜻하는 값. 저장할 때는 tint 를 지운다. */
export const RETRO_TINT_INHERIT = "inherit";

function groupField(label: string, group: HTMLElement): HTMLElement {
  // 컨트롤이 여럿이라 label 로 감싸지 않는다(첫 칩이 캡션 클릭에 발화하는 함정).
  return el("div", { class: "db-field", children: [el("span", { text: label, attrs: { title: label } }), group] });
}

/**
 * 색 견본 칩 행. current 가 undefined 면 「따름/원본」 칩이 눌린 상태.
 * inheritLabel 을 주면(층용) 「따름」 칩과 「원본」 칩이 둘 다 나온다. 없으면(연출 전체용) 「원본」 하나.
 */
export function tintChipRow(
  label: string, testid: string, current: string | undefined, onPick: (value: string) => void, options: { inheritLabel?: string; compact?: boolean } = {},
): HTMLElement {
  const group = el("div", { class: "db-retro-tint-chips" + (options.compact ? " compact" : ""), attrs: { role: "group" }, dataset: { testid } });
  const chip = (value: string, text: string, swatch: string | undefined, pressed: boolean): void => {
    const button = el("button", {
      class: "db-retro-tint-chip" + (pressed ? " active" : ""),
      attrs: { type: "button", title: text, "aria-label": `${label}: ${text}`, "aria-pressed": String(pressed) },
      dataset: { tint: value },
    });
    const dot = el("i", { class: "db-retro-tint-dot" });
    if (swatch) dot.style.background = swatch; else dot.classList.add("none");
    button.append(dot);
    if (!options.compact) button.append(el("span", { text }));
    button.addEventListener("click", () => onPick(value));
    group.append(button);
  };
  if (options.inheritLabel) {
    chip(RETRO_TINT_INHERIT, options.inheritLabel, undefined, current === undefined);
    chip(RETRO_TINT_ORIGINAL, "원본색", undefined, current === RETRO_TINT_ORIGINAL);
  } else {
    chip(RETRO_TINT_ORIGINAL, "원본", undefined, current === undefined || current === RETRO_TINT_ORIGINAL);
  }
  for (const preset of RETRO_TINT_PRESETS) chip(preset.id, preset.label, preset.swatch, current === preset.id);
  return groupField(label, group);
}

/** 슬라이더 + 숫자 표시. onInput 은 드래그하는 동안 계속 불린다(호출자가 커밋 병합). */
export function sliderField(
  label: string, testid: string, value: number, bounds: { min: number; max: number; step: number }, format: (value: number) => string, onInput: (value: number) => void,
): HTMLElement {
  const input = el("input", { class: "db-retro-slider", attrs: { type: "range", min: String(bounds.min), max: String(bounds.max), step: String(bounds.step) }, dataset: { testid } }) as HTMLInputElement;
  input.value = String(value);
  const readout = el("output", { class: "db-retro-slider-out", text: format(value) });
  input.addEventListener("input", () => { const next = Number(input.value); readout.textContent = format(next); onInput(next); });
  return groupField(label, el("div", { class: "db-retro-slider-row", children: [input, readout] }));
}

/** 무게 3단 라디오 형태 칩. */
export function weightField(current: "light" | "normal" | "heavy" | undefined, onPick: (value: "light" | "normal" | "heavy") => void): HTMLElement {
  const group = el("div", { class: "db-retro-weight", attrs: { role: "radiogroup" }, dataset: { testid: "db-retro-choreo-weight" } });
  const items: readonly ["light" | "normal" | "heavy", string, string][] = [
    ["light", "가볍게", "다가가고 물러서는 게 빠르고 맞은 뒤 멈춤이 없다"],
    ["normal", "보통", "기본 박자"],
    ["heavy", "묵직하게", "다가가고 물러서는 게 느리고 맞은 뒤 오래 멈춘다"],
  ];
  for (const [value, text, hint] of items) {
    const pressed = (current ?? "normal") === value;
    const button = el("button", {
      class: "db-retro-weight-btn" + (pressed ? " active" : ""),
      text, attrs: { type: "button", role: "radio", "aria-checked": String(pressed), title: hint }, dataset: { weight: value },
    });
    button.addEventListener("click", () => onPick(value));
    group.append(button);
  }
  return groupField("무게", group);
}

/** 색 고르기(input[type=color]) + 「끄기」. 값이 없으면 꺼진 상태로 흰색을 보여 준다. */
export function colorToggleField(label: string, testid: string, value: string | undefined, onChange: (value: string | undefined) => void): HTMLElement {
  const box = el("input", { attrs: { type: "checkbox", "aria-label": `${label} 켜기` }, dataset: { testid: `${testid}-on` } }) as HTMLInputElement;
  box.checked = value !== undefined;
  const color = el("input", { attrs: { type: "color", "aria-label": label }, dataset: { testid } }) as HTMLInputElement;
  color.value = value ?? "#ffffff";
  color.disabled = value === undefined;
  box.addEventListener("change", () => { color.disabled = !box.checked; onChange(box.checked ? color.value : undefined); });
  color.addEventListener("input", () => onChange(color.value));
  return groupField(label, el("div", { class: "db-retro-color-row", children: [box, color] }));
}

/** 효과음 후보(EasyRPG RTP 효과음 96종). id → 표시 이름은 파일 이름. */
export const RETRO_SE_OPTIONS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "", name: "자동(이펙트에 맞춤)" },
  ...EASYRPG_SOUND_ASSETS.map((asset) => ({ id: asset.id, name: asset.fileName.replace(/\.[^.]+$/, "") })),
];

export function seField(testid: string, current: string | undefined, onPick: (value: string | undefined) => void): HTMLElement {
  const options = current && !RETRO_SE_OPTIONS.some((option) => option.id === current)
    ? [...RETRO_SE_OPTIONS, { id: current, name: current }] : RETRO_SE_OPTIONS;
  return selectField("효과음", testid, current ?? "", options, (value) => onPick(value || undefined));
}
