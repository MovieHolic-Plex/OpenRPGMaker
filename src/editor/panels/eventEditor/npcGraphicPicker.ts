import { projectCharsetAssets, type CharsetPickerAsset } from "@/assets/charsetCatalog";
import { applyCharsetFrameCrop, charsetFrameCropPosition } from "@/assets/charsetFrameCrop";
import { findCharsetSemantic, upsertCharsetLabelOverride } from "@/assets/charsetSemantics";
import {
  CHARSET_CHARACTER_COUNT,
  charsetFrameIndex,
  decodeCharsetFrameIndex,
  type CharsetFrameSelection,
} from "@/assets/easyrpgRtp";
import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
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
  const root = document.createElement("div");
  root.className = "npc-graphic-picker event-graphic-rm-picker";
  root.dataset.testid = "npc-graphic-picker";

  const assets = currentCharsetAssets();
  const recovery = el("p", {
    class: "npc-charset-teach-status", attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "event-graphic-recovery" },
  });
  const placeholder = el("button", {
    class: "btn", text: "그림 없이 계속", attrs: { type: "button" },
    dataset: { testid: "event-graphic-placeholder" },
    on: { click: () => {
      const graphic = { ...page.graphic, transparent: true };
      delete graphic.sprite;
      updateEventPage(mapId, eventId, page.id, { graphic });
      close();
    } },
  });
  const first = assets[0];
  if (!first) {
    recovery.dataset.code = "graphic-not-found";
    recovery.textContent = "기본·업로드 캐릭터 목록이 비어 있습니다. 취소한 뒤 소재에서 캐릭터 그림을 가져오거나, 그림 없이 계속할 수 있습니다. 기존 이벤트 내용은 유지됩니다.";
    const footer = renderNpcGraphicPickerFooter(() => {}, close);
    footer.querySelector<HTMLButtonElement>('[data-testid="event-graphic-confirm"]')!.disabled = true;
    footer.append(placeholder);
    root.append(recovery, footer);
    return root;
  }
  let selection = initialSelection(page, assets, first);
  let directSpriteId = page.graphic.sprite?.id ?? selection.asset.textureKey;
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
  const teach = renderCharsetTeachForm(() => selection, () => {
    refresh();
  });
  optionArea.append(directionGroup.root, patternGroup.root, teach.root);

  const directBox = document.createElement("div");
  directBox.className = "event-graphic-direct-box";
  const directInput = document.createElement("input");
  directInput.type = "text";
  directInput.value = directSpriteId;
  directInput.dataset.testid = "event-graphic-direct-sprite-input";
  directInput.setAttribute("aria-label", "캐릭터 그림 ID");
  directInput.addEventListener("input", () => {
    directSpriteId = directInput.value.trim();
    clearRecovery();
  });
  directBox.append(directInput, recovery);

  const advancedDetails = document.createElement("details");
  advancedDetails.className = "npc-advanced-sprite";
  const advancedSummary = document.createElement("summary");
  advancedSummary.textContent = "고급 · 파일 이름 직접 넣기";
  advancedDetails.append(advancedSummary, directBox);

  const rightPane = document.createElement("div");
  rightPane.className = "event-graphic-right-pane";
  rightPane.append(slotGrid, optionArea, advancedDetails, probeStack);

  const pickerFrame = document.createElement("div");
  pickerFrame.className = "event-graphic-picker-frame";
  pickerFrame.append(resourceList.root, rightPane);

  const footer = renderNpcGraphicPickerFooter(commitSelection, close);
  footer.append(placeholder);
  root.append(pickerFrame, footer);
  refresh();
  return root;

  function applySelection(next: NpcGraphicSelection): void {
    selection = next;
    directSpriteId = next.asset.textureKey;
    clearRecovery();
    refresh();
  }

  function clearRecovery(): void {
    recovery.textContent = "";
    delete recovery.dataset.code;
    directInput.removeAttribute("aria-invalid");
  }

  function commitSelection(): void {
    const result = graphicForConfirmedSelection(page.graphic, selection, directSpriteId);
    if (result.status === "no-match") {
      recovery.dataset.code = "graphic-not-found";
      recovery.textContent = "기본·업로드 캐릭터 목록에 입력한 ID의 그림이 없습니다. 목록에서 직접 고르거나, 그림 없이 계속 또는 취소를 선택하세요. 기존 이벤트 내용은 유지됩니다.";
      advancedDetails.open = true;
      directInput.setAttribute("aria-invalid", "true");
      directInput.focus();
      return;
    }
    updateEventPage(mapId, eventId, page.id, { graphic: result.graphic });
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
      const taught = slotTeachState(selection.asset.textureKey, slot);
      button.title = taught.label;
      button.setAttribute("aria-label", taught.label);
    }
    teach.sync();
  }
}

function initialSelection(page: EventPage, assets: readonly CharsetPickerAsset[], first: CharsetPickerAsset): NpcGraphicSelection {
  const asset = page.graphic.sprite ? assets.find((a) => a.textureKey === page.graphic.sprite?.id) : undefined;
  if (!asset) {
    return { asset: first, ...DEFAULT_SELECTION };
  }
  return { asset, ...decodeCharsetFrameIndex(page.graphic.pattern ?? charsetFrameIndex(DEFAULT_SELECTION)) };
}

function applyPreviewStyle(target: HTMLElement, selection: NpcGraphicSelection, scale: number): void {
  applyFrameDataset(target, selection);
  applyCharsetFrameCrop(target, selection.asset.path, selection, scale);
}

function applyWalkPreviewStyle(target: HTMLElement, selection: NpcGraphicSelection): void {
  applyPreviewStyle(target, selection, WALK_PREVIEW_SCALE);
  for (const pattern of WALK_PATTERNS) {
    target.style.setProperty(
      `--npc-walk-frame-${pattern}`,
      charsetFrameCropPosition({ ...selection, pattern }, WALK_PREVIEW_SCALE)
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
): { status: "matched"; graphic: EventPageGraphic } | { status: "no-match" } {
  const id = spriteId.trim();
  if (!id) return { status: "matched", graphic: graphicWithoutSprite(graphic) };
  const assets = currentCharsetAssets();
  if (!assets.some((a) => a.textureKey === id)) return { status: "no-match" };
  return { status: "matched", graphic: {
    ...graphic,
    sprite: { type: "bundled", id },
    direction: selection.direction,
    pattern: charsetFrameIndex(selection),
  } };
}

function graphicWithoutSprite(graphic: EventPageGraphic): EventPageGraphic {
  return graphic.transparent === undefined ? {} : { transparent: graphic.transparent };
}

function slotTeachState(textureKey: string, characterIndex: number): { label: string; tags: string; taught: boolean } {
  const override = store.getCurrent().charsetLabels?.find(
    (entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex,
  );
  if (override?.label.trim()) {
    return {
      label: override.label.trim(),
      tags: (override.tags ?? []).join(", "),
      taught: true,
    };
  }
  const bundled = findCharsetSemantic(textureKey, characterIndex);
  return {
    label: bundled?.label ?? `칸 ${characterIndex}`,
    tags: (bundled?.tags ?? []).filter((tag) => tag !== bundled?.label).join(", "),
    taught: false,
  };
}

function renderCharsetTeachForm(
  current: () => NpcGraphicSelection,
  onSaved: () => void,
): { readonly root: HTMLElement; readonly sync: () => void } {
  let syncedKey = "";
  const root = document.createElement("div");
  root.className = "npc-charset-teach";
  root.dataset.testid = "npc-charset-teach";
  const heading = document.createElement("p");
  heading.className = "npc-charset-teach-heading";
  heading.textContent = "이 칸 이름 (AI가 이 이름으로 찾습니다)";
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.dataset.testid = "npc-charset-label-input";
  labelInput.placeholder = "예: 우리 마을 촌장";
  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  tagsInput.dataset.testid = "npc-charset-tags-input";
  tagsInput.placeholder = "태그, 쉼표로 구분";
  const status = document.createElement("p");
  status.className = "npc-charset-teach-status";
  status.dataset.testid = "npc-charset-teach-status";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn";
  save.dataset.testid = "npc-charset-teach-save";
  save.textContent = "이름 가르치기";
  save.addEventListener("click", () => {
    const selection = current();
    store.update((project) => {
      project.charsetLabels = upsertCharsetLabelOverride(project.charsetLabels, {
        textureKey: selection.asset.textureKey,
        characterIndex: selection.characterIndex,
        label: labelInput.value,
        tags: tagsInput.value.split(/[,，]/u).map((tag) => tag.trim()).filter((tag) => tag.length > 0),
        origin: "user",
      });
    }, { scope: "project", label: "캐릭터 칩 이름" });
    syncedKey = "";
    onSaved();
  });
  root.append(heading, labelInput, tagsInput, save, status);
  return {
    root,
    sync: () => {
      const selection = current();
      const key = `${selection.asset.textureKey}#${selection.characterIndex}`;
      if (key === syncedKey) return;
      syncedKey = key;
      const taught = slotTeachState(selection.asset.textureKey, selection.characterIndex);
      labelInput.value = taught.label;
      tagsInput.value = taught.tags;
      status.textContent = taught.taught ? "가르친 이름 · 저장됨" : "번들 기본 이름";
    },
  };
}
