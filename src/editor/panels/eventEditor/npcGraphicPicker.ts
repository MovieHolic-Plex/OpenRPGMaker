import {
  CHARSET_CHARACTER_COUNT,
  CHARSET_DIRECTIONS,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  EASYRPG_CHARSET_ASSETS,
  charsetFrameIndex,
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetDirection,
  type CharsetFrameSelection,
  type EasyRpgCharsetAsset,
} from "@/assets/easyrpgRtp";
import { updateEventPage } from "@/editor/eventPages";
import type { EventPage, EventPageGraphic, MapId } from "@/project/types";

const PREVIEW_SCALE = 3;
const SLOT_SCALE = 2;
const DEFAULT_SELECTION = {
  characterIndex: 0,
  direction: "down",
  pattern: 1,
} as const satisfies CharsetFrameSelection;

type NpcGraphicSelection = CharsetFrameSelection & {
  readonly asset: EasyRpgCharsetAsset;
};

export function renderNpcGraphicPicker(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  let selection = initialSelection(page);
  const root = document.createElement("div");
  root.className = "npc-graphic-picker";
  root.dataset.testid = "npc-graphic-picker";

  const sheetSelect = renderSheetSelect(selection, (asset) => {
    applySelection({ ...selection, asset });
  });
  const preview = document.createElement("div");
  preview.className = "npc-frame-preview";
  preview.dataset.testid = "npc-frame-preview";

  const slotButtons: HTMLButtonElement[] = [];
  const slotGrid = document.createElement("div");
  slotGrid.className = "npc-character-grid";
  for (let index = 0; index < CHARSET_CHARACTER_COUNT; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "npc-character-cell";
    button.dataset.testid = `npc-character-slot-${index}`;
    button.dataset.slot = String(index);
    button.title = `CharSet ${index + 1}`;
    button.addEventListener("click", () => {
      applySelection({ ...selection, characterIndex: index });
    });
    slotButtons.push(button);
    slotGrid.append(button);
  }

  const directionRow = document.createElement("div");
  directionRow.className = "npc-option-row";
  const directionButtons = CHARSET_DIRECTIONS.map((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "npc-option-button";
    button.dataset.testid = `npc-direction-${direction}`;
    button.dataset.direction = direction;
    button.textContent = directionLabel(direction);
    button.title = directionTitle(direction);
    button.addEventListener("click", () => {
      applySelection({ ...selection, direction });
    });
    directionRow.append(button);
    return button;
  });

  const patternRow = document.createElement("div");
  patternRow.className = "npc-option-row";
  const patternButtons: HTMLButtonElement[] = [];
  for (let pattern = 0; pattern < 3; pattern += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "npc-option-button";
    button.dataset.testid = `npc-pattern-${pattern}`;
    button.dataset.pattern = String(pattern);
    button.textContent = String(pattern + 1);
    button.title = `Pattern ${pattern + 1}`;
    button.addEventListener("click", () => {
      applySelection({ ...selection, pattern });
    });
    patternButtons.push(button);
    patternRow.append(button);
  }

  root.append(sheetSelect, layoutPicker(preview, slotGrid), labeledOptions("방향", directionRow), labeledOptions("패턴", patternRow));
  root.append(renderAdvancedSpriteInput(mapId, eventId, page));
  refresh();
  return root;

  function applySelection(next: NpcGraphicSelection): void {
    selection = next;
    refresh();
    updateEventPage(mapId, eventId, page.id, {
      graphic: {
        ...page.graphic,
        sprite: { type: "bundled", id: next.asset.textureKey },
        direction: next.direction,
        pattern: charsetFrameIndex(next),
      },
    });
  }

  function refresh(): void {
    sheetSelect.value = selection.asset.textureKey;
    applyPreviewStyle(preview, selection, PREVIEW_SCALE);
    for (const button of slotButtons) {
      const slot = Number(button.dataset.slot ?? "-1");
      button.classList.toggle("active", slot === selection.characterIndex);
      applyPreviewStyle(button, { ...selection, characterIndex: slot, direction: "down", pattern: 1 }, SLOT_SCALE);
    }
    for (const button of directionButtons) {
      button.classList.toggle("active", button.dataset.direction === selection.direction);
    }
    for (const button of patternButtons) {
      button.classList.toggle("active", Number(button.dataset.pattern ?? "-1") === selection.pattern);
    }
  }
}

function renderSheetSelect(
  selection: NpcGraphicSelection,
  onChange: (asset: EasyRpgCharsetAsset) => void
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "npc-sheet-select";
  select.dataset.testid = "npc-charset-sheet-select";
  for (const [group, assets] of charsetAssetGroups()) {
    const optionGroup = document.createElement("optgroup");
    optionGroup.label = group;
    for (const asset of assets) {
      const option = document.createElement("option");
      option.value = asset.textureKey;
      option.textContent = asset.name.replace("EasyRPG RTP ", "");
      optionGroup.append(option);
    }
    select.append(optionGroup);
  }
  select.value = selection.asset.textureKey;
  select.addEventListener("change", () => {
    const asset = findCharsetAsset(select.value);
    if (asset) onChange(asset);
  });
  return select;
}

function renderAdvancedSpriteInput(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const details = document.createElement("details");
  details.className = "npc-advanced-sprite";
  details.open = true;
  const summary = document.createElement("summary");
  summary.textContent = "직접 ID";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "그래픽 ID 예: tex_easyrpg_charset_people1";
  input.value = page.graphic.sprite?.id ?? "";
  input.dataset.testid = "event-page-sprite-input";
  input.addEventListener("change", () => {
    const id = input.value.trim();
    updateEventPage(mapId, eventId, page.id, {
      graphic: id ? { ...page.graphic, sprite: { type: "bundled", id } } : graphicWithoutSprite(page.graphic),
    });
  });
  details.append(summary, input);
  return details;
}

function layoutPicker(preview: HTMLElement, slotGrid: HTMLElement): HTMLElement {
  const layout = document.createElement("div");
  layout.className = "npc-picker-layout";
  layout.append(preview, slotGrid);
  return layout;
}

function labeledOptions(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement("div");
  row.className = "npc-labeled-options";
  const text = document.createElement("span");
  text.textContent = label;
  row.append(text, control);
  return row;
}

function initialSelection(page: EventPage): NpcGraphicSelection {
  const asset = page.graphic.sprite ? findCharsetAsset(page.graphic.sprite.id) : undefined;
  if (!asset) {
    return { asset: firstCharsetAsset(), ...DEFAULT_SELECTION };
  }
  return { asset, ...decodeCharsetFrameIndex(page.graphic.pattern ?? charsetFrameIndex(DEFAULT_SELECTION)) };
}

function firstCharsetAsset(): EasyRpgCharsetAsset {
  const first = EASYRPG_CHARSET_ASSETS[0];
  if (!first) {
    throw new Error("EasyRPG RTP CharSet manifest is empty");
  }
  return first;
}

function findCharsetAsset(textureKey: string): EasyRpgCharsetAsset | undefined {
  return EASYRPG_CHARSET_ASSETS.find((asset) => asset.textureKey === textureKey);
}

function charsetAssetGroups(): ReadonlyMap<string, readonly EasyRpgCharsetAsset[]> {
  const groups = new Map<string, EasyRpgCharsetAsset[]>();
  for (const asset of EASYRPG_CHARSET_ASSETS) {
    const current = groups.get(asset.group) ?? [];
    current.push(asset);
    groups.set(asset.group, current);
  }
  return groups;
}

function applyPreviewStyle(target: HTMLElement, selection: NpcGraphicSelection, scale: number): void {
  const source = charsetFrameSource(selection);
  target.dataset.slot = String(selection.characterIndex);
  target.dataset.direction = selection.direction;
  target.dataset.pattern = String(selection.pattern);
  target.style.width = `${CHARSET_FRAME_WIDTH * scale}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * scale}px`;
  target.style.backgroundImage = `url("${selection.asset.path}")`;
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale}px`;
  target.style.backgroundPosition = `-${source.x * scale}px -${source.y * scale}px`;
}

function graphicWithoutSprite(graphic: EventPageGraphic): EventPageGraphic {
  return graphic.transparent === undefined ? {} : { transparent: graphic.transparent };
}

function directionLabel(direction: CharsetDirection): string {
  switch (direction) {
    case "down":
      return "↓";
    case "left":
      return "←";
    case "right":
      return "→";
    case "up":
      return "↑";
  }
}

function directionTitle(direction: CharsetDirection): string {
  switch (direction) {
    case "down":
      return "아래";
    case "left":
      return "왼쪽";
    case "right":
      return "오른쪽";
    case "up":
      return "위";
  }
}
