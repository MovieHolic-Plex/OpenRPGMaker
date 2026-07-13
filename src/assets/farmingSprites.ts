// 농사 데모용 자체 생성 에셋 카탈로그 — 작물 성장 스프라이트 시트 + 농장 동물 캐릭셋.
// PNG 는 scripts/generate-farming-crop-sprites.mjs / generate-farming-animal-sprites.mjs 가 생성한다.
// 캐릭셋은 Scarloxy 팩과 동일한 방식으로 CHARSET_ASSETS(charsetCatalog)에 합류시킨다.
import type { EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";

export type FarmingCropSpriteAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
};

// 작물 성장 단계 시트 — 16x16 프레임을 가로로 이어붙였고, 프레임 인덱스 = 성장 단계 순서.
export const FARMING_CROP_SPRITE_ASSETS = [
  {
    id: "farming-crop-potato",
    name: "감자 성장 스프라이트",
    path: "assets/farming/crops/crop_potato.png",
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 2,
  },
  {
    id: "farming-crop-strawberry",
    name: "딸기 성장 스프라이트",
    path: "assets/farming/crops/crop_strawberry.png",
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 2,
  },
  {
    id: "farming-crop-tomato",
    name: "토마토 성장 스프라이트",
    path: "assets/farming/crops/crop_tomato.png",
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 3,
  },
  {
    id: "farming-crop-corn",
    name: "옥수수 성장 스프라이트",
    path: "assets/farming/crops/crop_corn.png",
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 3,
  },
] as const satisfies readonly FarmingCropSpriteAsset[];

// 농장 동물 캐릭셋 — RM2K3 규격 288x256, 캐릭터 슬롯 0 사용.
export const FARMING_ANIMAL_CHARSET_ASSETS = [
  {
    category: "charset",
    id: "farming-charset-chicken",
    name: "농장 닭 CharSet",
    sourcePath: "scripts/generate-farming-animal-sprites.mjs",
    path: "assets/farming/animals/chicken.png",
    fileName: "chicken.png",
    textureKey: "tex_farming_charset_chicken",
    group: "Farm",
  },
  {
    category: "charset",
    id: "farming-charset-cow",
    name: "농장 젖소 CharSet",
    sourcePath: "scripts/generate-farming-animal-sprites.mjs",
    path: "assets/farming/animals/cow.png",
    fileName: "cow.png",
    textureKey: "tex_farming_charset_cow",
    group: "Farm",
  },
] as const satisfies readonly EasyRpgCharsetAsset[];

// 프로젝트 직렬화 참조 검증(collectResourceIds)에 등록할 전체 리소스 ID 목록.
export const FARMING_RESOURCE_IDS: readonly string[] = [
  ...FARMING_CROP_SPRITE_ASSETS.map((asset) => asset.id),
  ...FARMING_ANIMAL_CHARSET_ASSETS.flatMap((asset) => [asset.id, asset.textureKey]),
];

export function resolveFarmingAssetUrl(resourceId: string): string | null {
  const crop = FARMING_CROP_SPRITE_ASSETS.find((asset) => asset.id === resourceId);
  if (crop) return `/${crop.path}`;
  const charset = FARMING_ANIMAL_CHARSET_ASSETS.find(
    (asset) => asset.id === resourceId || asset.textureKey === resourceId
  );
  if (charset) return `/${charset.path}`;
  return null;
}
