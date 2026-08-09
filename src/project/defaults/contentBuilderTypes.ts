/** 저작 콘텐츠 빌더가 공유하는 순수 타입. editor/content/ 와 project/defaults/ 양쪽이 사용한다. */

export type TilePoint = {
  readonly x: number;
  readonly y: number;
};

export type SmallHouseVariantIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SmallHouseMaterial = "plaster" | "wood" | "stone";
