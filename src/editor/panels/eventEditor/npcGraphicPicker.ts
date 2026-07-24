import { projectCharsetAssets, type CharsetPickerAsset } from "@/assets/charsetCatalog";
import {
  CHARSET_CHARACTER_COUNT,
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameIndex,
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetFrameSelection,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import { updateEventPage } from "@/editor/eventPages";
import { store } from "@/project/store";
import type { EventPage, EventPageGraphic, MapId } from "@/project/types";
import {
  renderDirectionRadioGroup,
  renderGraphicResourceList,
  renderNpcGraphicPickerFooter,
  renderPatternRadioGroup,
  setActiveGraphicResource,
  setClass,
} from "./npcGraphicPickerControls";

const SLOT_SCALE = 2;
const WALK_PREVIEW_SCALE = 2;
const WALK_PATTERNS = [0, 1, 2] as const;
const DEFAULT_SELECTION = {
  characterIndex: 0,
  direction: "down",
  pattern: 1,
} as const satisfies CharsetFrameSelection;
type NpcGraphicSelection = CharsetFrameSelection & {
  readonly asset: CharsetPickerAsset;
};

function currentCharsetAssets(): readonly CharsetPickerAsset[] {
  return projectCharsetAssets(store.getCurrent());
}

export function renderNpcGraphicPicker(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  close: () => void
): HTMLElement {
  let selection = initialSelection(page);
  let directSpriteId = page.graphic.sprite?.id ?? selection.asset.textureKey;
  const root = document.createElement("div");
  root.className = "npc-graphic-picker event-graphic-rm-picker";
  root.dataset.testid = "npc-graphic-picker";

  const assets = currentCharsetAssets();
  const resourceList = renderGraphicResourceList(assets, (asset) => {
    applySelection({ ...selection, asset });
  });

  const slotButtons: HTMLButtonElement[] = [];
  const slotGrid = document.createElement("div");
  slotGrid.className = "npc-character-grid event-graphic-preview-panel";
  slotGrid.dataset.testid = "event-graphic-preview-panel";
  for (let index = 0; index < CHARSET_CHARACTER_COUNT; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "npc-character-cell";
    button.dataset.testid = `npc-character-slot-${index}`;
    button.dataset.slot = String(index);
    button.title = `캐릭터 슬롯 ${index + 1}`;
    button.addEventListener("click", () => {
      applySelection({ ...selection, characterIndex: index });
    });
    slotButtons.push(button);
    slotGrid.append(button);
  }

  const frameProbe = document.createElement("div");
  frameProbe.className = "npc-frame-preview event-graphic-frame-probe";
  frameProbe.dataset.testid = "npc-frame-preview";

  const walkPreview = document.createElement("div");
  walkPreview.className = "npc-walk-preview";
  walkPreview.dataset.testid = "npc-walk-preview";
  walkPreview.title = "걷기 애니메이션 미리보기";

  const probeStack = document.createElement("div");
  probeStack.className = "event-graphic-probe-stack";
  probeStack.append(frameProbe, walkPreview);

  const directionGroup = renderDirectionRadioGroup(selection.direction, (direction) => {
    applySelection({ ...selection, direction });
  });
  const patternGroup = renderPatternRadioGroup(selection.pattern, (pattern) => {
    applySelection({ ...selection, pattern });
  });

  const optionArea = document.createElement("div");
  optionArea.className = "event-graphic-option-area";
  optionArea.append(directionGroup.root, patternGroup.root);

  const directBox = document.createElement("div");
  directBox.className = "event-graphic-direct-box";
  const directInput = document.createElement("input");
  directInput.type = "text";
  directInput.value = directSpriteId;
  directInput.dataset.testid = "event-graphic-direct-sprite-input";
  directInput.addEventListener("input", () => {
    directSpriteId = directInput.value.trim();
  });
  directBox.append(directInput);

  const advancedDetails = document.createElement("details");
  advancedDetails.className = "npc-advanced-sprite";
  const advancedSummary = document.createElement("summary");
  advancedSummary.textContent = "고급: 직접 ID";
  advancedDetails.append(advancedSummary, directBox);

  const rightPane = document.createElement("div");
  rightPane.className = "event-graphic-right-pane";
  rightPane.append(slotGrid, optionArea, advancedDetails, probeStack);

  const pickerFrame = document.createElement("div");
  pickerFrame.className = "event-graphic-picker-frame";
  pickerFrame.append(resourceList.root, rightPane);

  root.append(pickerFrame, renderNpcGraphicPickerFooter(commitSelection, close));
  refresh();
  return root;

  function applySelection(next: NpcGraphicSelection): void {
    selection = next;
    directSpriteId = next.asset.textureKey;
    refresh();
  }

  function commitSelection(): void {
    updateEventPage(mapId, eventId, page.id, {
      graphic: graphicForConfirmedSelection(page.graphic, selection, directSpriteId),
    });
    close();
  }

  function refresh(): void {
    directInput.value = directSpriteId;
    setActiveGraphicResource(resourceList.buttons, selection.asset.textureKey);
    directionGroup.setValue(selection.direction);
    patternGroup.setValue(selection.pattern);
    applyFrameDataset(frameProbe, selection);
    applyWalkPreviewStyle(walkPreview, selection);
    for (const button of slotButtons) {
      const slot = Number(button.dataset.slot ?? "-1");
      setClass(button, "active", slot === selection.characterIndex);
      applyPreviewStyle(button, { ...selection, characterIndex: slot }, SLOT_SCALE);
    }
  }
}

function initialSelection(page: EventPage): NpcGraphicSelection {
  const assets = currentCharsetAssets();
  const asset = page.graphic.sprite ? assets.find((a) => a.textureKey === page.graphic.sprite?.id) : undefined;
  if (!asset) {
    return { asset: firstCharsetAsset(assets), ...DEFAULT_SELECTION };
  }
  return { asset, ...decodeCharsetFrameIndex(page.graphic.pattern ?? charsetFrameIndex(DEFAULT_SELECTION)) };
}

function firstCharsetAsset(assets: readonly CharsetPickerAsset[]): CharsetPickerAsset {
  const first = assets[0];
  if (!first) {
    throw new Error("EasyRPG RTP 캐릭터칩 목록이 비어 있습니다");
  }
  return first;
}

function applyPreviewStyle(target: HTMLElement, selection: NpcGraphicSelection, scale: number): void {
  const source = charsetFrameSource(selection);
  applyFrameDataset(target, selection);
  target.style.width = `${CHARSET_FRAME_WIDTH * scale}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * scale}px`;
  applyTransparentColorKeyBackground(target, selection.asset.path);
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale}px`;
  target.style.backgroundPosition = `-${source.x * scale}px -${source.y * scale}px`;
}

function applyWalkPreviewStyle(target: HTMLElement, selection: NpcGraphicSelection): void {
  applyPreviewStyle(target, selection, WALK_PREVIEW_SCALE);
  for (const pattern of WALK_PATTERNS) {
    const source = charsetFrameSource({ ...selection, pattern });
    target.style.setProperty(
      `--npc-walk-frame-${pattern}`,
      `-${source.x * WALK_PREVIEW_SCALE}px -${source.y * WALK_PREVIEW_SCALE}px`
    );
  }
}

function applyFrameDataset(target: HTMLElement, selection: NpcGraphicSelection): void {
  target.dataset.slot = String(selection.characterIndex);
  target.dataset.direction = selection.direction;
  target.dataset.pattern = String(selection.pattern);
}

function graphicForConfirmedSelection(
  graphic: EventPageGraphic,
  selection: NpcGraphicSelection,
  spriteId: string
): EventPageGraphic {
  const id = spriteId.trim();
  if (!id) return graphicWithoutSprite(graphic);
  const assets = currentCharsetAssets();
  if (!assets.some((a) => a.textureKey === id)) return { ...graphic, sprite: { type: "bundled", id } };
  return {
    ...graphic,
    sprite: { type: "bundled", id },
    direction: selection.direction,
    pattern: charsetFrameIndex(selection),
  };
}

function graphicWithoutSprite(graphic: EventPageGraphic): EventPageGraphic {
  return graphic.transparent === undefined ? {} : { transparent: graphic.transparent };
}
