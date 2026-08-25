import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
  type CharsetDirection,
  type CharsetFrameSelection,
} from "@/assets/easyrpgRtp";
import type { CharsetPickerAsset } from "@/assets/charsetCatalog";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";

export type AdvancedSpriteInput = {
  readonly details: HTMLElement;
  readonly input: HTMLInputElement;
};

export type GraphicResourceList = {
  readonly root: HTMLElement;
  readonly buttons: readonly HTMLButtonElement[];
};

export type GraphicRadioOption<TValue extends string | number> = {
  readonly label: string;
  readonly testId: string;
  readonly value: TValue;
};

export type GraphicRadioGroup<TValue extends string | number> = {
  readonly root: HTMLElement;
  readonly inputs: readonly HTMLInputElement[];
  readonly setValue: (value: TValue) => void;
};

const RESOURCE_THUMB_SELECTION = {
  characterIndex: 0,
  direction: "down",
  pattern: 1,
} as const satisfies CharsetFrameSelection;

export function renderGraphicResourceList(
  assets: readonly CharsetPickerAsset[],
  onSelect: (asset: CharsetPickerAsset) => void
): GraphicResourceList {
  const root = document.createElement("div");
  root.className = "event-graphic-resource-list";
  root.dataset.testid = "event-graphic-resource-list";
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "모습");

  const buttons = assets.map((asset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-graphic-resource-row";
    button.dataset.testid = `event-graphic-resource-${asset.textureKey}`;
    button.dataset.textureKey = asset.textureKey;
    button.setAttribute("role", "option");
    button.append(renderResourceIcon(asset), document.createTextNode(charsetResourceLabel(asset)));
    button.addEventListener("click", () => {
      onSelect(asset);
    });
    root.append(button);
    return button;
  });

  return { root, buttons };
}

export function renderDirectionRadioGroup(
  current: CharsetDirection,
  onChange: (direction: CharsetDirection) => void
): GraphicRadioGroup<CharsetDirection> {
  return renderGraphicRadioGroup("방향", "event-graphic-direction-group", [
    { label: "위", testId: "npc-direction-up", value: "up" },
    { label: "왼쪽", testId: "npc-direction-left", value: "left" },
    { label: "오른쪽", testId: "npc-direction-right", value: "right" },
    { label: "아래", testId: "npc-direction-down", value: "down" },
  ], current, onChange);
}

export function renderPatternRadioGroup(
  current: number,
  onChange: (pattern: number) => void
): GraphicRadioGroup<number> {
  return renderGraphicRadioGroup("패턴", "event-graphic-pattern-group", [
    { label: "왼쪽", testId: "npc-pattern-0", value: 0 },
    { label: "가운데", testId: "npc-pattern-1", value: 1 },
    { label: "오른쪽", testId: "npc-pattern-2", value: 2 },
  ], current, onChange);
}

export function renderAdvancedSpriteInput(
  initialId: string,
  onInput: (id: string) => void
): AdvancedSpriteInput {
  const details = document.createElement("details");
  details.className = "npc-advanced-sprite";

  const summary = document.createElement("summary");
  summary.textContent = "직접 ID";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "모습 예: tex_easyrpg_charset_people1";
  input.value = initialId;
  input.dataset.testid = "event-page-sprite-input";
  input.addEventListener("input", () => {
    onInput(input.value.trim());
  });

  details.append(summary, input);
  return { details, input };
}

export function renderNpcGraphicPickerFooter(
  onConfirm: () => void,
  onCancel: () => void
): HTMLElement {
  const footer = document.createElement("div");
  footer.className = "event-graphic-picker-footer";
  footer.dataset.testid = "event-graphic-dialog-footer";
  footer.append(
    footerButton("확인", "event-graphic-confirm", "primary", onConfirm),
    footerButton("취소", "event-graphic-cancel", "", onCancel)
  );
  return footer;
}

export function setActiveGraphicResource(
  buttons: readonly HTMLButtonElement[],
  textureKey: string
): void {
  for (const button of buttons) {
    const selected = button.dataset.textureKey === textureKey;
    setClass(button, "active", selected);
    button.setAttribute("aria-selected", String(selected));
  }
}

export function setClass(target: HTMLElement, token: string, enabled: boolean): void {
  if (enabled) {
    target.classList.add(token);
    return;
  }
  target.classList.remove(token);
}

function footerButton(
  label: string,
  testId: string,
  extraClass: string,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${extraClass}`.trim();
  button.textContent = label;
  button.dataset.testid = testId;
  button.addEventListener("click", onClick);
  return button;
}

function renderGraphicRadioGroup<TValue extends string | number>(
  title: string,
  className: string,
  options: readonly GraphicRadioOption<TValue>[],
  current: TValue,
  onChange: (value: TValue) => void
): GraphicRadioGroup<TValue> {
  const fieldset = document.createElement("fieldset");
  fieldset.className = `event-graphic-radio-group ${className}`;
  const legend = document.createElement("legend");
  legend.textContent = title;
  fieldset.append(legend);

  const inputs = options.map((option) => {
    const label = document.createElement("label");
    label.className = "event-graphic-radio-option";
    label.dataset.testid = option.testId;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = className;
    input.value = String(option.value);
    input.checked = option.value === current;
    input.addEventListener("change", () => {
      if (input.checked) onChange(option.value);
    });
    label.append(input, document.createTextNode(option.label));
    fieldset.append(label);
    return input;
  });

  return {
    root: fieldset,
    inputs,
    setValue: (value) => {
      options.forEach((option, index) => {
        const input = inputs[index];
        if (input) input.checked = option.value === value;
      });
    },
  };
}

function renderResourceIcon(asset?: CharsetPickerAsset): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "event-graphic-resource-icon";
  icon.setAttribute("aria-hidden", "true");
  if (asset) applyResourceThumbnail(icon, asset);
  return icon;
}

function applyResourceThumbnail(icon: HTMLElement, asset: CharsetPickerAsset): void {
  const source = charsetFrameSource(RESOURCE_THUMB_SELECTION);
  icon.classList.add("charset-thumb");
  icon.style.width = `${CHARSET_FRAME_WIDTH}px`;
  icon.style.height = `${CHARSET_FRAME_HEIGHT}px`;
  applyTransparentColorKeyBackground(icon, asset.path);
  icon.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT}px`;
  icon.style.backgroundPosition = `-${source.x}px -${source.y}px`;
}

function charsetResourceLabel(asset: CharsetPickerAsset): string {
  return humanizeCharsetFileName(asset.fileName.replace(/\.png$/u, ""));
}

function humanizeCharsetFileName(name: string): string {
  const trimmed = name.replace(/^\*/u, "").trim();
  const numbered = /^(Actor|Monster|Object|People)(\d+)$/u.exec(trimmed);
  if (numbered) {
    const kind = {
      Actor: "배역",
      Monster: "몬스터",
      Object: "물건",
      People: "사람",
    }[numbered[1]!] ?? numbered[1]!;
    return `${kind} ${numbered[2]}`;
  }
  if (trimmed === "Animal") return "동물";
  if (trimmed === "Vehicles") return "탈것";
  if (trimmed === "Template") return "양식";
  return trimmed;
}
