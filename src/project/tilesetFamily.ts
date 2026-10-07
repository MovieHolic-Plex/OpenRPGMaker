// project/tilesetFamily.ts
// 칩셋 계열 판정(2026-09-25). 조수가 새 맵을 만들거나 맵의 칩셋을 정할 때 "지금 보는 맵과 같은 그림체인가"를 가른다.
// 실행기(toolRunner.rejectTilesetFamilyChange)와 ask_tileset_change·질문 카드가 같은 판정을 쓴다.

import { TILESET_ART_STYLES, tilesetArtStyle } from "./tilesetArtStyle";
import type { Project, TilesetDef } from "./types";

type TilesetOwner = Pick<Project, "tilesets">;

const UPLOADED_PREFIX = "uploaded:";
const UNKNOWN_PREFIX = "unknown:";

/** 이름을 알고 있는 저작 계열(`TilesetDef.family`). 모르는 값은 낱말 첫 글자만 키워 보여 준다. */
const KNOWN_FAMILY_LABELS: Readonly<Record<string, string>> = {
  "oprn-atlas": "생성 칩셋",
  "oprn-joseon": "조선 칩셋",
  "oprn-modern": "현대 도시(도트)",
  "oprn-jp": "일본 도시(도트)",
  "oprn-wizard": "마법 학교(해리포터풍)",
  "oprn-monster": "몬스터 수집(포켓몬풍)",
  "oprn-monster-emerald": "몬스터 수집(에메랄드풍)",
};

/** referenceSourceTilesetId 를 따라 뿌리 타일셋까지 간다. 끊기거나 돌면 마지막으로 찾은 것에서 멈춘다. */
function rootTileset(project: TilesetOwner, tileset: TilesetDef): TilesetDef {
  const seen = new Set<string>([tileset.id]);
  let current = tileset;
  while (current.family === undefined && current.referenceSourceTilesetId) {
    const next = project.tilesets[current.referenceSourceTilesetId];
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    current = next;
  }
  return current;
}

/** 칩셋 계열 — 그림체가 같은 묶음. 같은 계열끼리는 말없이 바꿔도 되고, 다른 계열로 가려면 사용자 승인이 필요하다. */
export function tilesetFamily(project: TilesetOwner, tilesetId: string): string {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return `${UNKNOWN_PREFIX}${tilesetId}`;
  if (tileset.family) return tileset.family;
  const root = rootTileset(project, tileset);
  if (root.family) return root.family;
  if (root.image.type === "uploaded") return `${UPLOADED_PREFIX}${root.id}`;
  return tilesetArtStyle(root, Object.values(project.tilesets));
}

function titleCase(value: string): string {
  return value.split(/[-_\s]+/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
}

/** 사람용 계열 이름: "조선 칩셋" 등, 업로드 칩셋은 그 칩셋 이름. */
export function tilesetFamilyLabel(project: TilesetOwner, family: string): string {
  if (family.startsWith(UPLOADED_PREFIX)) {
    const id = family.slice(UPLOADED_PREFIX.length);
    return project.tilesets[id]?.name ?? id;
  }
  if (family.startsWith(UNKNOWN_PREFIX)) return family.slice(UNKNOWN_PREFIX.length);
  const style = TILESET_ART_STYLES.find((entry) => entry.id === family);
  if (style) return style.label;
  return KNOWN_FAMILY_LABELS[family] ?? titleCase(family);
}

/** 같은 계열의 타일셋 전부(프로젝트 순서). */
export function sameFamilyTilesets(project: TilesetOwner, family: string): TilesetDef[] {
  return Object.values(project.tilesets).filter((tileset) => tilesetFamily(project, tileset.id) === family);
}
