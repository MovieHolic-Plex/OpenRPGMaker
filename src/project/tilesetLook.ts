// project/tilesetLook.ts — «게임마다 한 가지 겉모습»: 바닥·길·광장 재질, 나무 수종, 숲 생김새를 게임 열쇠로 고른다.
//
// 왜(2026-11-12 오너): 기물 그림을 게임마다 다르게 골라도(project/kitLook.ts) 마을의 바닥 칸·길 칸·나무와 숲 모양이 모든 게임에서 같아
// «같은 마을의 반복» 으로 보였다. 버들항 마을 한 장은 바닥 칸 하나(737)가 6할을 덮는다.
//
// 무엇을: 타일셋 사본에 look 한 줄을 적는다(갈래마다 선택지 이름). 그림은 그릴 때만 겹친다(assets/tilesetLooks.ts) — 맵의 칸 번호·통행·
// 오토타일·킷 이름은 그대로라 도구·검사·조수가 읽는 것은 달라지지 않는다. 숲 생김새(woods)만 시공기가 읽어 숲 덩이를 다르게 잡는다.
//
// 언제: 조수 실행(게임 열쇠 lookKey)이 «아직 그 칩셋으로 지은 맵이 없는» 프로젝트에 처음 맵을 지을 때 한 번. 이미 그 칩셋 맵이 있는
// 프로젝트(이 기능 전에 만든 게임·손으로 만든 게임)는 고르지 않는다 — 한 게임 안에서는 늘 같은 겉모습이고, 옛 맵이 바뀌지 않는다.
// 요청 낱말은 보지 않는다. 모델이 읽는 글도 없다.
import { tilesetLookOptions, tilesetLookTableFor, TILESET_LOOK_PARTS, type TilesetLookTable } from "@/assets/tilesetLooks";
import { lookHash } from "./kitLook";
import type { GameMap, Project, TilesetLook } from "./types";

/** 함께 고르지 않는 짝(바닥과 길이 같은 색이라 길이 안 보이는 조합 등)은 표가 겉모습 묶음으로 이미 걸렀다 — 여기서는 갈래마다 따로 고른다. */
export function chooseTilesetLook(table: TilesetLookTable, key: string): TilesetLook | undefined {
  const look: TilesetLook = { textureKey: table.texture };
  let chosen = false;
  for (const part of TILESET_LOOK_PARTS) {
    const options = tilesetLookOptions(table, part);
    const pick = options[lookHash(`look|${key}|${table.tilesetId}|${part}`) % options.length]!;
    if (pick) { look[part] = pick; chosen = true; }
  }
  return chosen ? look : undefined;
}

/** 손댄 맵인가 — 위층 칸이 있거나, 이벤트가 있거나, 바닥이 한 가지 칸이 아니다(빈 시작 맵은 아니다). */
function authored(map: GameMap): boolean {
  if (map.events.length > 0) return true;
  const first = map.lowerTiles[0];
  for (let index = 0; index < map.lowerTiles.length; index += 1) {
    if (map.lowerTiles[index] !== first) return true;
    if ((map.upperTiles[index] ?? -1) >= 0) return true;
  }
  return false;
}

function hasAuthoredMap(project: Project, tilesetId: string): boolean {
  return Object.values(project.maps).some((map) => map.tilesetId === tilesetId && authored(map));
}

/**
 * 이 프로젝트에서 그 칩셋이 쓰는(또는 지금 처음 지으면 쓰게 될) 겉모습. 시공기가 숲 생김새를 정할 때 읽는다.
 * 이미 고른 프로젝트는 그 값, 그 칩셋 맵이 이미 있는 프로젝트는 없음(원래 모습), 새 프로젝트는 열쇠로 고른 값.
 */
export function projectTilesetLook(project: Project, tilesetId: string, key: string | undefined): TilesetLook | undefined {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return undefined;
  if (tileset.look) return tileset.look;
  const table = tilesetLookTableFor(tilesetId);
  if (!table || !key || tileset.image.type !== "bundled" || tileset.image.id !== table.image) return undefined;
  return hasAuthoredMap(project, tilesetId) ? undefined : chooseTilesetLook(table, key);
}

/**
 * 도구 한 번이 끝난 뒤: 그 도구가 «그 칩셋의 첫 맵» 을 지었으면 겉모습을 타일셋에 적는다.
 * before 에 그 칩셋으로 지은 맵이 있었으면(옛 게임) 아무것도 하지 않는다. 읽기만 한 도구는 타일셋을 건드리지 않는다.
 */
export function settleProjectLook(before: Project, draft: Project, key: string | undefined): void {
  if (!key) return;
  for (const tilesetId of Object.keys(before.tilesets)) {
    const table = tilesetLookTableFor(tilesetId);
    if (!table || before.tilesets[tilesetId]!.look) continue;
    if (hasAuthoredMap(before, tilesetId) || !hasAuthoredMap(draft, tilesetId)) continue;
    const tileset = draft.tilesets[tilesetId];
    if (!tileset || tileset.look || tileset.image.type !== "bundled" || tileset.image.id !== table.image) continue;
    const look = chooseTilesetLook(table, key);
    if (look) tileset.look = look;
  }
}
