import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { renderChipsetPreviewPanel } from "@/editor/panels/tilesetChipsetPreview";
import { PALETTE_SLOT_ROLES, isPaletteSlotRole } from "@/project/tilesetPalette";
import { store } from "@/project/store";
import type { PalettePreset, PaletteSlotRole, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";

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

let selectedPresetId: string | null = null;
let selectedRole: PaletteSlotRole = "ground";
let selectedTile = 0;

export function addPalettePresetToTileset(tileset: TilesetDef, id = genId("pp")): string {
  const preset: PalettePreset = {
    id,
    name: "새 프리셋",
    origin: "user",
    slots: [],
  };
  tileset.palettePresets = [...(tileset.palettePresets ?? []), preset];
  return id;
}

export function setPalettePresetLocked(tileset: TilesetDef, presetId: string, locked: boolean): void {
  const preset = presetById(tileset, presetId);
  if (!preset) return;
  preset.locked = locked;
}

export function updatePalettePresetName(tileset: TilesetDef, presetId: string, name: string): void {
  const preset = presetById(tileset, presetId);
  if (!preset) return;
  preset.name = cleanName(name) || "새 프리셋";
  preset.origin = "user";
}

export function setPalettePresetSlotTiles(
  tileset: TilesetDef,
  presetId: string,
  role: PaletteSlotRole,
  tileIds: readonly number[]
): void {
  const preset = presetById(tileset, presetId);
  if (!preset) return;
  const normalizedTiles = [...new Set(tileIds.filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count))].sort((a, b) => a - b);
  const existing = preset.slots.find((slot) => slot.role === role);
  if (existing) existing.tileIds = normalizedTiles;
  else preset.slots.push({ role, tileIds: normalizedTiles });
  preset.origin = "user";
}

export function togglePalettePresetSlotTile(tileset: TilesetDef, presetId: string, role: PaletteSlotRole, tile: number): void {
  const preset = presetById(tileset, presetId);
  if (!preset || tile < 0 || tile >= tileset.count) return;
  const current = preset.slots.find((slot) => slot.role === role)?.tileIds ?? [];
  const next = current.includes(tile) ? current.filter((candidate) => candidate !== tile) : [...current, tile];
  setPalettePresetSlotTiles(tileset, presetId, role, next);
}

export function renderPalettePresetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const presets = tileset.palettePresets ?? [];
  if (selectedPresetId && !presets.some((preset) => preset.id === selectedPresetId)) selectedPresetId = null;
  selectedPresetId ??= presets[0]?.id ?? null;
  const selected = selectedPresetId ? presets.find((preset) => preset.id === selectedPresetId) ?? null : null;
  return el("section", {
    class: "palette-preset-editor",
    children: [
      el("div", {
        class: "palette-preset-header",
        children: [
          el("strong", { text: "팔레트 프리셋" }),
          el("button", {
            class: "database-footer-button",
            text: "신규 생성",
            attrs: { type: "button" },
            dataset: { testid: "palette-preset-add" },
            on: {
              click: () => {
                recordProjectSnapshot("팔레트 프리셋 생성");
                store.update((project) => {
                  const target = project.tilesets[tileset.id];
                  if (!target) return;
                  selectedPresetId = addPalettePresetToTileset(target);
                });
                rerender();
              },
            },
          }),
        ],
      }),
      renderPresetList(presets, rerender),
      ...(selected ? [renderPresetEditor(tileset, selected, rerender)] : [el("div", { class: "palette-preset-empty", text: "프리셋 없음" })]),
    ],
  });
}

function renderPresetList(presets: readonly PalettePreset[], rerender: () => void): HTMLElement {
  return el("div", {
    class: "palette-preset-list",
    dataset: { testid: "palette-preset-list" },
    children: presets.map((preset) =>
      el("button", {
        class: `palette-preset-row${preset.id === selectedPresetId ? " active" : ""}`,
        attrs: { type: "button" },
        dataset: { testid: `palette-preset-edit-${preset.id}` },
        children: [
          el("span", { text: preset.name }),
          el("span", { class: "palette-preset-badge", text: preset.origin === "user" ? "사용자" : "AI" }),
          ...(preset.locked ? [el("span", { class: "palette-preset-badge locked", text: "잠금" })] : []),
        ],
        on: {
          click: () => {
            selectedPresetId = preset.id;
            rerender();
          },
        },
      })
    ),
  });
}

function renderPresetEditor(tileset: TilesetDef, preset: PalettePreset, rerender: () => void): HTMLElement {
  const nameInput = el("input", {
    attrs: { "aria-label": "프리셋 이름", type: "text" },
    value: preset.name,
  }) as HTMLInputElement;
  nameInput.addEventListener("change", () => {
    recordProjectSnapshot("팔레트 프리셋 이름");
    store.update((project) => {
      const target = project.tilesets[tileset.id];
      if (target) updatePalettePresetName(target, preset.id, nameInput.value);
    });
    rerender();
  });
  return el("section", {
    class: "palette-preset-detail",
    children: [
      el("label", { class: "palette-preset-name", children: [el("span", { text: "이름" }), nameInput] }),
      el("button", {
        class: `database-footer-button palette-preset-lock${preset.locked ? " locked" : ""}`,
        text: preset.locked ? "잠금" : "열림",
        attrs: { type: "button", "aria-pressed": String(preset.locked === true) },
        dataset: { testid: "palette-preset-lock" },
        on: {
          click: () => {
            recordProjectSnapshot("팔레트 프리셋 잠금");
            store.update((project) => {
              const target = project.tilesets[tileset.id];
              if (target) setPalettePresetLocked(target, preset.id, preset.locked !== true);
            });
            rerender();
          },
        },
      }),
      renderSlotControls(tileset, preset, rerender),
    ],
  });
}

function renderSlotControls(tileset: TilesetDef, preset: PalettePreset, rerender: () => void): HTMLElement {
  const slot = preset.slots.find((entry) => entry.role === selectedRole);
  const roleSelect = el("select", {
    attrs: { "aria-label": "프리셋 역할" },
    value: selectedRole,
    children: PALETTE_SLOT_ROLES.map((role) => el("option", { text: ROLE_LABELS[role], attrs: { value: role } })),
  }) as HTMLSelectElement;
  roleSelect.value = selectedRole;
  roleSelect.addEventListener("change", () => {
    if (isPaletteSlotRole(roleSelect.value)) selectedRole = roleSelect.value;
    rerender();
  });
  const tileInput = el("input", {
    attrs: { "aria-label": "타일 구성", type: "text" },
    value: (slot?.tileIds ?? []).join(","),
  }) as HTMLInputElement;
  tileInput.addEventListener("change", () => {
    recordProjectSnapshot("팔레트 프리셋 타일");
    store.update((project) => {
      const target = project.tilesets[tileset.id];
      if (!target) return;
      setPalettePresetSlotTiles(target, preset.id, selectedRole, parseTileIds(tileInput.value));
    });
    rerender();
  });
  return el("section", {
    class: "palette-preset-slots",
    children: [
      el("label", { children: [el("span", { text: "역할" }), roleSelect] }),
      el("label", { children: [el("span", { text: "타일" }), tileInput] }),
      renderChipsetPreviewPanel({
        mode: "passage",
        onApplyModeTile: (tile) => {
          recordProjectSnapshot("팔레트 프리셋 타일");
          store.update((project) => {
            const target = project.tilesets[tileset.id];
            if (target) togglePalettePresetSlotTile(target, preset.id, selectedRole, tile);
          });
        },
        onSelectTile: (tile) => {
          selectedTile = tile;
        },
        rerender,
        selectedTile,
        tileset,
      }),
    ],
  });
}

function presetById(tileset: TilesetDef, presetId: string): PalettePreset | undefined {
  return (tileset.palettePresets ?? []).find((preset) => preset.id === presetId);
}

function parseTileIds(value: string): number[] {
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((tile) => Number.isInteger(tile));
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
