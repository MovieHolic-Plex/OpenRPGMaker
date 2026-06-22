import { field } from "@/editor/panels/databaseControls";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderDbGroup(title: string, child: HTMLElement): HTMLElement {
  return el("fieldset", { class: "tileset-db-group", children: [el("legend", { text: title }), child] });
}

export function numberControl(label: string, value: number, onInput: (value: number) => void): HTMLElement {
  const input = el("input", { attrs: { type: "number", min: "0", max: "99" }, value });
  input.addEventListener("input", () => onInput(Number(input.value)));
  return field(label, input);
}

export function textAreaControl(label: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("textarea", { text: value });
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

export function ensureTileMeta(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= Array.from({ length: tileset.count }, () => ({ label: "", description: "" }));
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "" });
  }
  tileset.tileMeta[tile] ??= { label: "", description: "" };
  return tileset.tileMeta[tile];
}

export function metadataForTile(tileset: TilesetDef, tile: number): TileAiMetadata {
  return tileset.tileMeta?.[tile] ?? { label: "", description: "" };
}

export function hasAiMetadata(tileset: TilesetDef, tile: number): boolean {
  const meta = metadataForTile(tileset, tile);
  return meta.label.trim().length > 0 || meta.description.trim().length > 0;
}

export function passageText(tileset: TilesetDef, tile: number): string {
  const mark = passageMarkForTile(tileset, tile);
  return mark === "star" ? "★" : mark.toUpperCase();
}

export function cellTitle(tileset: TilesetDef, tile: number): string {
  const meta = metadataForTile(tileset, tile);
  const groups =
    tileset.tileGroups?.filter((group) => group.tileIds.includes(tile)).map((group) => group.name).join(", ") ||
    "세트 없음";
  return `${tile}: ${meta.label || "라벨 없음"} / ${meta.description || "설명 없음"} / ${groups}`;
}
