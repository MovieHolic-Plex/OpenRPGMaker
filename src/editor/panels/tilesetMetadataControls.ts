import { field } from "@/editor/panels/databaseControls";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TileAiMetadata, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderDbGroup(title: string, child: HTMLElement): HTMLElement {
  return el("fieldset", { class: "tileset-db-group", children: [el("legend", { text: title }), child] });
}

export function numberControl(label: string, value: number, onInput: (value: number) => void, testid?: string): HTMLElement {
  const input = el("input", { attrs: { type: "number", min: "0", max: "99" }, value });
  if (testid) input.dataset.testid = testid;
  input.addEventListener("input", () => onInput(Number(input.value)));
  return field(label, input);
}

export function textAreaControl(label: string, value: string, onInput: (value: string) => void, testid?: string): HTMLElement {
  const input = el("textarea", { text: value });
  if (testid) input.dataset.testid = testid;
  input.addEventListener("input", () => onInput(input.value));
  return field(label, input);
}

export function ensureTileMeta(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= Array.from({ length: tileset.count }, () => ({ label: "", description: "" }));
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "" });
  }
  tileset.tileMeta[tile] ??= { label: "", description: "" };
  const meta = tileset.tileMeta[tile];
  meta.label ??= "";
  meta.description ??= "";
  return meta;
}

export function metadataForTile(tileset: TilesetDef, tile: number): TileAiMetadata {
  const meta = tileset.tileMeta?.[tile];
  return { ...meta, label: meta?.label ?? "", description: meta?.description ?? "" };
}

export function hasAiMetadata(tileset: TilesetDef, tile: number): boolean {
  const meta = metadataForTile(tileset, tile);
  return meta.label.trim().length > 0 || meta.description.trim().length > 0;
}

/** 라벨·설명 둘 다 비어 있으면 미설정 (사용자/하네스 확정 전) */
export function isUnlabeledTile(tileset: TilesetDef, tile: number): boolean {
  const meta = metadataForTile(tileset, tile);
  return meta.label.trim().length === 0 && meta.description.trim().length === 0;
}

export function listUnlabeledTileIds(tileset: TilesetDef): number[] {
  const out: number[] = [];
  for (let i = 0; i < tileset.count; i += 1) {
    if (isUnlabeledTile(tileset, i)) out.push(i);
  }
  return out;
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
