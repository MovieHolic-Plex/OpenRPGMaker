// 집 벌(house set) — 게임마다 집 그림 가족을 통째로 갈아 끼운다(2026-11-13 오너: «집들도 싹 바뀌고 … 메인 칩셋으로 쓰려면»).
//
// 버들항 강가·포구 마을은 어느 게임이든 붉은 기와·목골 집 한 가족이었다(60판 실측: 망루 집 55 · 여관 47 · 4×6 박공집 101채).
// 벌 하나는 그 가족의 킷마다 «같은 칸 크기 · 같은 문 칸 · 같은 막힌 칸» 그림이다. 킷 목록·킷 id·이름은 그대로 두고, 찍는 순간에
// 킷의 칸 번호만 벌 그림판(이식 칸)으로 바꾼다 — 그래서
//   · 배치·문·통행·연결·도달이 달라지지 않고(통행·위아래·이름표는 원본 킷의 같은 자리 칸에서 옮긴다),
//   · 도구·검사·조수가 읽는 킷 이름과 목록은 한 글자도 달라지지 않으며,
//   · 옛 저장본(겉모습 없음)은 원본 칸 그대로라 화소 하나 달라지지 않는다.
// 한 벌 안에서도 집마다 그림이 갈린다: 킷마다 변형 2~3장을 굽고, 찍는 자리(맵·칸)와 게임 열쇠로 한 장을 고른다 — 같은 집 여덟 채가 한 마을에 서지 않게.
// 벌 이름은 겉모습(tileset.look.houses)에 한 번 적힌다(project/tilesetLook.ts) — 그 게임의 모든 맵이 같은 벌이다.
// 그림판·표는 scripts/content/beodeul-houses/bake.py 가 굽는다(부품은 벌마다 한 번 그리고 코드가 조립 — assemble.py). 찍을 때 갈아 끼우기는 project/houseSetKit.ts.
import beodeulHouseSets from "./beodeulHouseSets.json";

/** kits[원본 킷 id] = 그 킷의 벌 그림들(같은 벌 안 변형 — 지붕 색조·아래층 재질·문/덧문 색이 다른 2~3장), 그림마다 줄 × 칸의 그림판 칸 번호. */
type HouseSet = { readonly label: string; readonly en?: string; readonly kits: Readonly<Record<string, readonly (readonly (readonly number[])[])[]>> };
export type HouseSetTable = {
  readonly version: number;
  readonly tilesetId: string;
  readonly image: string;
  readonly texture: string;
  readonly tileSize: number;
  readonly tilesPerRow: number;
  readonly count: number;
  readonly gate: string;
  readonly sets: Readonly<Record<string, HouseSet>>;
};

const TABLES: readonly HouseSetTable[] = [beodeulHouseSets as unknown as HouseSetTable];

/** 집 벌 그림판 textureKey → 칸 수(bundledChipsetFrameCount 가 쓴다). */
export function houseSetSheetCount(textureKey: string): number | undefined {
  return TABLES.find((table) => table.texture === textureKey)?.count;
}

export function houseSetTableFor(tilesetId: string): HouseSetTable | undefined {
  return TABLES.find((table) => table.tilesetId === tilesetId);
}

/** 그 타일셋의 벌 이름들(표 순서). */
export function houseSetNames(tilesetId: string): string[] {
  return Object.keys(houseSetTableFor(tilesetId)?.sets ?? {});
}

/** 그 벌이 덮는 원본 킷인가. */
export function houseSetCovers(tilesetId: string, set: string | undefined, kitId: string): boolean {
  return !!set && !!houseSetTableFor(tilesetId)?.sets[set]?.kits[kitId];
}
