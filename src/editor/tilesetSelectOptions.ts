import type { TilesetDef, TilesetKind } from "@/project/types";
import { groupTilesetsByKind, TILESET_KIND_LABELS } from "@/project/tilesetKind";
import { el } from "@/util/dom";

const TILESET_KIND_ORDER = ["rpg2k", "custom"] as const satisfies readonly TilesetKind[];

export function appendGroupedTilesetOptions(select: HTMLSelectElement, tilesets: readonly TilesetDef[]): void {
  const groups = groupTilesetsByKind(tilesets);
  for (const kind of TILESET_KIND_ORDER) {
    const entries = groups[kind];
    if (entries.length === 0) continue;
    const group = el("optgroup", { attrs: { label: TILESET_KIND_LABELS[kind] } });
    for (const tileset of entries) {
      group.append(el("option", { text: tileset.name?.trim() || "(이름 없음)", attrs: { value: tileset.id } }));
    }
    select.append(group);
  }
}
