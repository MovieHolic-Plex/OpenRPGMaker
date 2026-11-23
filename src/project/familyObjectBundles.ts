// 계열 기반 기물 묶음 등록부 — 그림체가 같은 계열(TilesetDef.family)의 칩셋이 함께 쓰는 기물 묶음.
// 버들항 기물(bd-object:*)은 beodeul_city 에만 구조 킷으로 들어 있어, 같은 oprn-atlas 계열의 다른 칩셋(실내 v5·건물 덩어리 등) 맵에서는
// 조수 목록에 안 떴다. 등록부에 한 줄을 두고 list_tileset_objects·stamp_tileset_object 가 여기서 읽는다.
// 찍을 때 그 킷 칸만 대상 타일셋에 이식(tileGrafts)하므로 저장 형식은 그대로다. 근거: ~/claude-viz/beodeul-style-survey.html (a)안.
import { BEODEUL_OBJECT_KIT_PREFIX } from "@/assets/beodeulPlaceableObjects";
import { beodeulObjectFamilyKits, installBeodeulObjectKit } from "./defaults/beodeulPlaceableObjects";
import { tilesetFamily } from "./tilesetFamily";
import type { Project, SectionStructureKitDef, TilesetDef } from "./types";

export interface FamilyObjectBundle {
  readonly family: string;
  readonly label: string;
  readonly kitPrefix: string;
  kits(): readonly SectionStructureKitDef[];
  install(target: TilesetDef, kitId: string): SectionStructureKitDef | undefined;
}

export const FAMILY_OBJECT_BUNDLES: readonly FamilyObjectBundle[] = [
  { family: "oprn-atlas", label: "버들항풍 기물", kitPrefix: BEODEUL_OBJECT_KIT_PREFIX, kits: beodeulObjectFamilyKits, install: installBeodeulObjectKit },
];

export function familyObjectBundlesFor(project: Pick<Project, "tilesets">, tilesetId: string): FamilyObjectBundle[] {
  const tileset = project.tilesets[tilesetId];
  if (!tileset || tileset.tileSize !== 16) return [];
  const family = tilesetFamily(project, tilesetId);
  return FAMILY_OBJECT_BUNDLES.filter(bundle => bundle.family === family);
}
