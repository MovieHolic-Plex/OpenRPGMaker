import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import type { MapContextMenuItem, MapContextMenuPoint } from "@/editor/panels/mapContextMenu";
import { ensureTileMeta } from "@/editor/panels/tilesetMetadataControls";
import { PALETTE_SLOT_ROLES, isPaletteSlotRole } from "@/project/tilesetPalette";
import { passageMarkForTile, setPassageMark, type PassageMark } from "@/project/tilesetPassage";
import { store } from "@/project/store";
import type { PaletteSlotRole, TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export interface TileMetaFixDraft {
  readonly groupIds: readonly string[];
  readonly label: string;
  readonly passage: PassageMark;
  readonly role: PaletteSlotRole | "";
}

export interface OpenTileMetaFixPopoverOptions {
  readonly onSaved?: () => void;
  readonly point?: MapContextMenuPoint;
  readonly rerender?: () => void;
  readonly tile: number;
  readonly tilesetId: string;
}

const ROLE_LABELS: Record<PaletteSlotRole, string> = {
  boundary: "경계",
  decor: "장식",
  furniture: "가구",
  ground: "바닥",
  path: "길",
  roof: "지붕",
  wall: "벽",
  water: "물",
};

let activePopover: HTMLElement | null = null;

export function tileMetaFixDraft(tileset: TilesetDef, tile: number): TileMetaFixDraft {
  const meta = tileset.tileMeta?.[tile];
  const role = isPaletteSlotRole(meta?.role) ? meta.role : "";
  return {
    groupIds: (tileset.tileGroups ?? []).filter((group) => group.tileIds.includes(tile)).map((group) => group.id),
    label: meta?.label ?? "",
    passage: passageMarkForTile(tileset, tile),
    role,
  };
}

export function applyTileMetaFix(tileset: TilesetDef, tile: number, draft: TileMetaFixDraft): TileAiMetadata | null {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) return null;
  setPassageMark(tileset, tile, draft.passage);
  const meta = ensureTileMeta(tileset, tile);
  meta.label = draft.label.trim();
  if (draft.role) meta.role = draft.role;
  else delete meta.role;
  meta.passage = passageForMark(draft.passage);
  meta.origin = "user";
  meta.confidence = 1;
  meta.locked = true;
  meta.source = "user";
  meta.userLocked = true;

  const selectedGroups = new Set(draft.groupIds);
  for (const group of tileset.tileGroups ?? []) {
    if (selectedGroups.has(group.id)) {
      group.tileIds = [...new Set([...group.tileIds, tile])].sort((a, b) => a - b);
    } else {
      group.tileIds = group.tileIds.filter((candidate) => candidate !== tile);
    }
  }
  return { ...meta };
}

export function saveTileMetaFixToStore(tilesetId: string, tile: number, draft: TileMetaFixDraft): void {
  recordProjectSnapshot("타일 정보 수정");
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    applyTileMetaFix(tileset, tile, draft);
  });
}

export function openTileMetaFixPopover(options: OpenTileMetaFixPopoverOptions): void {
  closeTileMetaFixPopover();
  const tileset = store.getCurrent().tilesets[options.tilesetId];
  if (!tileset) return;
  const draft = tileMetaFixDraft(tileset, options.tile);
  const groupInputs: HTMLInputElement[] = [];
  const labelInput = el("input", {
    attrs: { "aria-label": "의미 라벨", type: "text" },
    value: draft.label,
  }) as HTMLInputElement;
  const roleSelect = renderRoleSelect(draft.role);
  const passageSelect = renderPassageSelect(draft.passage);
  const saveButton = el("button", {
    class: "database-footer-button primary",
    text: "저장",
    attrs: { type: "button" },
    dataset: { testid: "tile-meta-fix-save" },
    on: {
      click: () => {
        saveTileMetaFixToStore(options.tilesetId, options.tile, {
          groupIds: groupInputs.filter((input) => input.checked).map((input) => input.value),
          label: labelInput.value,
          passage: passageSelect.value as PassageMark,
          role: isPaletteSlotRole(roleSelect.value) ? roleSelect.value : "",
        });
        closeTileMetaFixPopover();
        options.onSaved?.();
        options.rerender?.();
      },
    },
  });

  const popover = el("section", {
    class: "tile-meta-fix-popover",
    attrs: { role: "dialog", "aria-label": "타일 정보 수정" },
    dataset: { testid: "tile-meta-fix-popover" },
    children: [
      el("div", { class: "tile-meta-fix-title", text: `${options.tile}번 타일 정보 수정` }),
      labelWithControl("의미 라벨", labelInput),
      labelWithControl("역할", roleSelect),
      labelWithControl("통행", passageSelect),
      renderGroupChecks(tileset, draft.groupIds, groupInputs),
      el("div", {
        class: "tile-meta-fix-actions",
        children: [
          el("button", {
            class: "database-footer-button",
            text: "취소",
            attrs: { type: "button" },
            on: { click: () => closeTileMetaFixPopover() },
          }),
          saveButton,
        ],
      }),
    ],
  });
  positionPopover(popover, options.point);
  document.body.append(popover);
  activePopover = popover;
  labelInput.focus();
}

export function closeTileMetaFixPopover(): void {
  activePopover?.remove();
  activePopover = null;
}

export function tileInfoFixMenuItem(options: {
  readonly testId?: string;
  readonly tile: number;
  readonly tilesetId: string;
  readonly point?: MapContextMenuPoint;
  readonly rerender?: () => void;
}): MapContextMenuItem {
  return {
    action: () => openTileMetaFixPopover(options),
    icon: "map-settings",
    id: "tile-meta-fix",
    label: "타일 정보 수정",
    testId: options.testId ?? "tileset-tile-meta-fix",
  };
}

export function tileFixFromCanvasMenuItem(options: {
  readonly tile: number;
  readonly tilesetId: string;
  readonly point?: MapContextMenuPoint;
  readonly rerender?: () => void;
}): MapContextMenuItem {
  return {
    action: () => openTileMetaFixPopover(options),
    icon: "map-settings",
    id: "tile-fix-from-canvas",
    label: "이 타일 잘못 쓰임",
    testId: "tile-fix-from-canvas",
  };
}

function renderRoleSelect(role: PaletteSlotRole | ""): HTMLSelectElement {
  const select = el("select", {
    attrs: { "aria-label": "역할" },
    value: role,
    children: [
      el("option", { text: "없음", attrs: { value: "" } }),
      ...PALETTE_SLOT_ROLES.map((entry) => el("option", { text: ROLE_LABELS[entry], attrs: { value: entry } })),
    ],
  }) as HTMLSelectElement;
  select.value = role;
  return select;
}

function renderPassageSelect(passage: PassageMark): HTMLSelectElement {
  const select = el("select", {
    attrs: { "aria-label": "통행" },
    value: passage,
    children: [
      el("option", { text: "통행", attrs: { value: "o" } }),
      el("option", { text: "차단", attrs: { value: "x" } }),
      el("option", { text: "상위 통행", attrs: { value: "star" } }),
    ],
  }) as HTMLSelectElement;
  select.value = passage;
  return select;
}

function renderGroupChecks(tileset: TilesetDef, selectedGroupIds: readonly string[], inputs: HTMLInputElement[]): HTMLElement {
  const selected = new Set(selectedGroupIds);
  const rows = (tileset.tileGroups ?? []).map((group) => {
    const input = el("input", {
      attrs: { type: "checkbox", value: group.id },
    }) as HTMLInputElement;
    input.checked = selected.has(group.id);
    inputs.push(input);
    return el("label", {
      class: "tile-meta-fix-group-row",
      children: [input, el("span", { text: `${group.name} / ${group.role}` })],
    });
  });
  return el("fieldset", {
    class: "rm2k3-db-fieldset tile-meta-fix-groups",
    children: [
      el("legend", { text: "그룹" }),
      ...(rows.length > 0 ? rows : [el("div", { class: "tile-meta-fix-empty", text: "그룹 없음" })]),
    ],
  });
}

function labelWithControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "tile-meta-fix-field",
    children: [el("span", { text: label }), control],
  });
}

function passageForMark(mark: PassageMark): NonNullable<TileAiMetadata["passage"]> {
  if (mark === "x") return "solid";
  if (mark === "star") return "star";
  return "passable";
}

function positionPopover(popover: HTMLElement, point: MapContextMenuPoint | undefined): void {
  if (!point) return;
  popover.style.position = "fixed";
  popover.style.left = `${Math.round(point.x)}px`;
  popover.style.top = `${Math.round(point.y)}px`;
}
