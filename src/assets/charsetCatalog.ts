// 프로젝트에서 선택 가능한 전체 캐릭셋 카탈로그.
// EasyRPG RTP(자동 생성 easyrpgRtp.ts — 수정 금지)에 Scarloxy 팩을 합산한다.
// 캐릭셋을 열거/조회하는 소비자는 EASYRPG_CHARSET_ASSETS 대신 이 배열을 사용한다.
// 프로젝트 uploaded charset까지 포함하려면 projectCharsetAssets()를 사용한다.

import { EASYRPG_CHARSET_ASSETS, type EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import { FARMING_ANIMAL_CHARSET_ASSETS } from "@/assets/farmingSprites";
import { OPRN_MONSTER_CHARSET_ASSETS } from "@/assets/oprnMonsterCharsets";
import { SCARLOXY_CHARSET_ASSETS } from "@/assets/scarloxyPack";
import type { UploadedAsset } from "@/project/types";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";

export const CHARSET_ASSETS: readonly EasyRpgCharsetAsset[] = [
  ...EASYRPG_CHARSET_ASSETS,
  ...SCARLOXY_CHARSET_ASSETS,
  ...FARMING_ANIMAL_CHARSET_ASSETS,
  ...OPRN_MONSTER_CHARSET_ASSETS,
];

/**
 * 피커에서 사용하는 최소 캐릭터칩 인터페이스.
 * 번들 EasyRpgCharsetAsset과 uploaded charset 모두 이 형태를 만족한다.
 */
export interface CharsetPickerAsset {
  readonly textureKey: string;
  readonly path: string;
  readonly fileName: string;
  readonly group: string;
}

/** uploaded charset 자산을 피커용 아이템으로 변환 */
function uploadedCharsetToPickerAsset(asset: UploadedAsset): CharsetPickerAsset {
  return {
    textureKey: asset.id,
    path: uploadedAssetUrl(asset),
    fileName: asset.name,
    group: "업로드",
  };
}

/**
 * 프로젝트 상태 기반 통합 캐릭터칩 목록.
 * 번들(EasyRPG RTP + Scarloxy + Farming) + 자료 보관함에서 업로드한 charset을 합친다.
 * NPC 그래픽 피커, 이벤트 커맨드 에디터 등 모든 charset 선택 UI가 이 함수를 사용한다.
 */
export function projectCharsetAssets(project: {
  assets: { uploaded: Record<string, UploadedAsset> };
}): readonly CharsetPickerAsset[] {
  const uploadedCharsets = Object.values(project.assets.uploaded)
    .filter((asset) => asset.kind === "charset")
    .map(uploadedCharsetToPickerAsset);
  return [...CHARSET_ASSETS, ...uploadedCharsets];
}

export function findCharsetAsset(idOrTextureKey: string): EasyRpgCharsetAsset | undefined {
  return CHARSET_ASSETS.find((asset) => asset.id === idOrTextureKey || asset.textureKey === idOrTextureKey);
}
