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
import { tilesetStandTableFor } from "@/assets/tilesetStands";
import { lookHash } from "./kitLook";
import type { GameMap, Project, TilesetLook } from "./types";

/**
 * 함께 고르지 않는 짝(바닥과 길이 같은 색이라 길이 안 보이는 조합 등)은 표가 겉모습 묶음으로 이미 걸렀다 — 여기서는 갈래마다 따로 고른다.
 * taken: 같은 사람이 이미 만든 다른 게임들의 겉모습. 주면 갈래마다 «그 게임들이 가장 덜 쓴 선택지» 가운데서 열쇠로 고른다 — 선택지가 남아 있는 동안은
 * 두 게임이 우연히 같은 숲 구성·바닥을 받지 않는다(먼저 퍼뜨린다). 주지 않으면 갈래마다 열쇠 해시만으로 고른다(게임끼리 서로를 모른다 — 스물한 가지에서
 * 여섯 게임이 한 쌍도 겹치지 않을 확률은 절반쯤이다). 같은 열쇠·같은 taken 이면 늘 같은 겉모습이다.
 */
export function chooseTilesetLook(table: TilesetLookTable, key: string, taken?: readonly (TilesetLook | undefined)[]): TilesetLook | undefined {
  const look: TilesetLook = { textureKey: table.texture };
  const stands = tilesetStandTableFor(table.tilesetId);
  let chosen = false;
  for (const part of TILESET_LOOK_PARTS) {
    let options = tilesetLookOptions(table, part);
    // 다른 타일셋의 겉모습은 세지 않는다(그림판 열쇠가 같은 것만) — 선택지 이름이 우연히 같아도 다른 그림이다.
    const siblings = taken?.filter((other) => other?.textureKey === table.texture);
    if (siblings?.length) {
      const used = (option: string): number => siblings.reduce((n, other) => n + ((other?.[part] ?? "") === option ? 1 : 0), 0);
      const least = Math.min(...options.map(used));
      options = options.filter((option) => used(option) === least);
      // 숲 구성은 이름이 달라도 주 수종이 같으면 닮았다(올리브 숲과 양지 비탈 — 둘 다 올리브) — 남은 선택지 가운데 다른 게임이 안 쓴 주 수종을 먼저 고른다
      if (part === "stand" && stands) {
        const seen = new Set(siblings.map((other) => stands.stands[other?.stand ?? ""]?.dominant).filter(Boolean));
        const fresh = options.filter((option) => !seen.has(stands.stands[option]?.dominant));
        if (fresh.length) options = fresh;
      }
    }
    const pick = options[lookHash(`look|${key}|${table.tilesetId}|${part}`) % options.length]!;
    if (pick) { look[part] = pick; chosen = true; }
  }
  // 숲 구성·풀밭 얼룩·풀 결의 그림은 둘째 그림판에 있다 — 그 열쇠도 적어 둔다(미리 싣기·내보내기가 프로젝트 문자열에서 그림판을 찾는다).
  if (stands && (look.stand || look.meadow || look.grain)) look.standKey = stands.texture;
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
export function projectTilesetLook(project: Project, tilesetId: string, key: string | undefined, taken?: readonly (TilesetLook | undefined)[]): TilesetLook | undefined {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return undefined;
  if (tileset.look) return tileset.look;
  const table = tilesetLookTableFor(tilesetId);
  if (!table || !key || tileset.image.type !== "bundled" || tileset.image.id !== table.image) return undefined;
  return hasAuthoredMap(project, tilesetId) ? undefined : chooseTilesetLook(table, key, taken);
}

/**
 * 도구 한 번이 끝난 뒤: 그 도구가 «그 칩셋의 첫 맵» 을 지었으면 겉모습을 타일셋에 적는다.
 * before 에 그 칩셋으로 지은 맵이 있었으면(옛 게임) 아무것도 하지 않는다. 읽기만 한 도구는 타일셋을 건드리지 않는다.
 */
export function settleProjectLook(before: Project, draft: Project, key: string | undefined, taken?: readonly (TilesetLook | undefined)[]): void {
  if (!key) return;
  for (const tilesetId of Object.keys(before.tilesets)) {
    const table = tilesetLookTableFor(tilesetId);
    if (!table || before.tilesets[tilesetId]!.look) continue;
    if (hasAuthoredMap(before, tilesetId) || !hasAuthoredMap(draft, tilesetId)) continue;
    const tileset = draft.tilesets[tilesetId];
    if (!tileset || tileset.look || tileset.image.type !== "bundled" || tileset.image.id !== table.image) continue;
    const look = chooseTilesetLook(table, key, taken);
    if (look) tileset.look = look;
  }
}
