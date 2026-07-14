// 프로젝트에서 선택 가능한 전체 캐릭셋 카탈로그.
// EasyRPG RTP(자동 생성 easyrpgRtp.ts — 수정 금지)에 Scarloxy 팩을 합산한다.
// 캐릭셋을 열거/조회하는 소비자는 EASYRPG_CHARSET_ASSETS 대신 이 배열을 사용한다.

import { EASYRPG_CHARSET_ASSETS, type EasyRpgCharsetAsset } from "@/assets/easyrpgRtp";
import { FARMING_ANIMAL_CHARSET_ASSETS } from "@/assets/farmingSprites";
import { SCARLOXY_CHARSET_ASSETS } from "@/assets/scarloxyPack";

export const CHARSET_ASSETS: readonly EasyRpgCharsetAsset[] = [
  ...EASYRPG_CHARSET_ASSETS,
  ...SCARLOXY_CHARSET_ASSETS,
  ...FARMING_ANIMAL_CHARSET_ASSETS,
];

export function findCharsetAsset(idOrTextureKey: string): EasyRpgCharsetAsset | undefined {
  return CHARSET_ASSETS.find((asset) => asset.id === idOrTextureKey || asset.textureKey === idOrTextureKey);
}
