import type { TilesetDef, TilesetKind } from "@/project/types";
import { groupTilesetsByKind, isDeprecatedTileset, TILESET_KIND_LABELS } from "@/project/tilesetKind";
import { el } from "@/util/dom";

const TILESET_KIND_ORDER = ["rpg2k", "custom"] as const satisfies readonly TilesetKind[];

export function appendGroupedTilesetOptions(select: HTMLSelectElement, tilesets: readonly TilesetDef[]): void {
  const groups = groupTilesetsByKind(tilesets);
  for (const kind of TILESET_KIND_ORDER) {
    const entries = groups[kind];
    if (entries.length === 0) continue;
    const group = el("optgroup", { attrs: { label: TILESET_KIND_LABELS[kind] } });
    // 사용 중단 칩셋은 기존 맵이 계속 고를 수 있게 남기되, 이름에 표시하고 묶음 끝으로 보낸다.
    const ordered = [...entries].sort((a, b) => Number(isDeprecatedTileset(a)) - Number(isDeprecatedTileset(b)));
    for (const tileset of ordered) {
      const name = tileset.name?.trim() || "(이름 없음)";
      const text = isDeprecatedTileset(tileset) ? `${name} (사용 중단 · 숲마을 칩 사용)` : name;
      group.append(el("option", { text, attrs: { value: tileset.id } }));
    }
    select.append(group);
  }
}
