import type { CharsetDirection, EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

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

const TILESET_LABELS = ["*Tileset 1", "*Tileset 2", "*Tileset 3"] as const;

export function renderGraphicResourceList(
  assets: readonly EasyRpgCharsetAsset[],
  onSelect: (asset: EasyRpgCharsetAsset) => void
): GraphicResourceList {
  const root = document.createElement("div");
  root.className = "event-graphic-resource-list";
  root.dataset.testid = "event-graphic-resource-list";
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "Graphic resources");

  for (const label of TILESET_LABELS) {
    const row = document.createElement("div");
    row.className = "event-graphic-resource-row disabled";
    row.setAttribute("aria-disabled", "true");
    row.append(renderResourceIcon(), document.createTextNode(label));
    root.append(row);
  }

  const buttons = assets.map((asset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-graphic-resource-row";
    button.dataset.testid = `event-graphic-resource-${asset.textureKey}`;
    button.dataset.textureKey = asset.textureKey;
    button.setAttribute("role", "option");
    button.append(renderResourceIcon(), document.createTextNode(charsetResourceLabel(asset)));
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
  return renderGraphicRadioGroup("Direction", "event-graphic-direction-group", [
    { label: "Up", testId: "npc-direction-up", value: "up" },
    { label: "Left", testId: "npc-direction-left", value: "left" },
    { label: "Right", testId: "npc-direction-right", value: "right" },
    { label: "Down", testId: "npc-direction-down", value: "down" },
  ], current, onChange);
}

export function renderPatternRadioGroup(
  current: number,
  onChange: (pattern: number) => void
): GraphicRadioGroup<number> {
  return renderGraphicRadioGroup("Pattern", "event-graphic-pattern-group", [
    { label: "LEFT", testId: "npc-pattern-0", value: 0 },
    { label: "MIDDLE", testId: "npc-pattern-1", value: 1 },
    { label: "RIGHT", testId: "npc-pattern-2", value: 2 },
  ], current, onChange);
}

export function renderAdvancedSpriteInput(
  initialId: string,
  onInput: (id: string) => void
): AdvancedSpriteInput {
  const details = document.createElement("details");
  details.className = "npc-advanced-sprite";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = "직접 ID";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "그래픽 ID 예: tex_easyrpg_charset_people1";
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
    footerButton("OK", "event-graphic-confirm", "primary", onConfirm),
    footerButton("Cancel", "event-graphic-cancel", "", onCancel)
  );
  return footer;
}

export function setActiveGraphicResource(
  buttons: readonly HTMLButtonElement[],
  textureKey: string
): void {
  for (const button of buttons) {
    const selected = button.dataset.textureKey === textureKey;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  }
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

function renderResourceIcon(): HTMLElement {
  const icon = document.createElement("span");
  icon.className = "event-graphic-resource-icon";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function charsetResourceLabel(asset: EasyRpgCharsetAsset): string {
  return asset.fileName.replace(/\.png$/u, "");
}
