// 몬스터 수집 손 도트 시트(지역별) 번들 목록 — src/harnesses/tileset-authoring 하네스가 굽고 lib/wire.py 가 index.json 을 쓴다.
// 그림은 전부 좌표로 찍은 원본 도트(생성 이미지·외부 팩 픽셀 없음). 정의는 project/defaults/monsterKit.ts, openwiki/harnesses/tileset-authoring.md.
import index from "./monsterKit/index.json";

export type MonsterKitSheetEntry = {
  readonly theme: string;
  readonly id: string;
  readonly textureKey: string;
  readonly name: string;
  readonly path: string;
  readonly count: number;
  readonly tilesPerRow: number;
  readonly tileSize: number;
};

export const MONSTER_KIT_SHEETS = index as readonly MonsterKitSheetEntry[];

// bundled.ts 의 BundledImageAsset 과 구조 동일(순환 import 방지).
export const MONSTER_KIT_CHIPSET_ASSETS: readonly { readonly textureKey: string; readonly path: string; readonly name: string }[] =
  MONSTER_KIT_SHEETS.map((sheet) => ({ textureKey: sheet.textureKey, path: sheet.path, name: sheet.name }));

const BY_TEXTURE = new Map(MONSTER_KIT_SHEETS.map((sheet) => [sheet.textureKey, sheet]));

export function monsterKitSheet(textureKey: string): MonsterKitSheetEntry | undefined {
  return BY_TEXTURE.get(textureKey);
}
