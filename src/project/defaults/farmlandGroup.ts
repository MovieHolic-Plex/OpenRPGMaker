import type { AutotileGroup, TilesetDef } from "../types";
import { autotileGroupsForTileset } from "./autotileGroups";

// 농사 런타임이 밭 흙을 그릴 때 쓰는 경작지 오토타일 그룹을 타일셋 정의에서 읽는다.
// 예전엔 EasyRPG 외부 아틀라스의 번호(FARMLAND_TILE=187…)를 어느 타일셋에나 그대로 그려서,
// 버들항(beodeul_city) 같은 다른 시트에서는 187번이 「언덕 성벽」 칸이라 밭 자리에 성벽이 찍혔다.
// 그룹이 없는 타일셋은 undefined — 호출자가 단색 흙 사각형으로 폴백한다(틀린 번호 그리기 금지).
export const FARMLAND_GROUP_IDS: readonly string[] = ["builtin_farmland", "farmland"];

export function farmlandGroupForTileset(tileset: TilesetDef | undefined): AutotileGroup | undefined {
  const groups = autotileGroupsForTileset(tileset);
  for (const id of FARMLAND_GROUP_IDS) {
    const group = groups.find((candidate) => candidate.id === id);
    if (group && group.memberTileIds.length > 0 && Object.keys(group.variantMap).length > 0) return group;
  }
  return undefined;
}
