/**
 * OPRN BGM — Google Lyria 로 만든 AI 생성 음악(CC0 아님). 라이선스 원문은 public/assets/oprn-bgm/LICENSE.txt:
 * 게임·상업 포함 자유, 원본 음원 단독 재배포 금지. 표기 권장 「Music: OPRN BGM (AI-generated, Google Lyria)」.
 * CC0 표(cc0AudioAssets.ts)와 섞지 않는다 — 라이선스 칸이 CC0-1.0 하나로 고정돼 있어 다른 라이선스를 거기에 적으면 거짓이 된다.
 */
export const OPRN_BGM_CREDIT = "Music: OPRN BGM (AI-generated, Google Lyria)";

export type OprnBgmAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly kind: "music";
  readonly license: "OPRN-BGM-1";
  readonly sourceName: string;
};

const SOURCE_NAME = "OPRN BGM (AI-generated, Google Lyria)";
const track = (slug: string, name: string): OprnBgmAsset => ({
  id: `oprn-bgm-${slug}`,
  name: `${name} (OPRN BGM)`,
  path: `assets/oprn-bgm/fallen/${slug}.ogg`,
  kind: "music",
  license: "OPRN-BGM-1",
  sourceName: SOURCE_NAME,
});

export const OPRN_BGM_ASSETS: readonly OprnBgmAsset[] = [
  track("ct2-battle-v1-1", "시간의 칼날"),
  track("gal-portraitboss-v0-1", "살아있는 액자의 추격"),
  track("dfk-battlefield-v1-1", "잿더미 속의 애가"),
  track("dfk-battlefield-v0-1", "잿더미 속의 탄식"),
  track("dfk-battlefield-v0-0", "잿더미가 된 들판"),
  track("dfk-boss-v0-0", "거대한 야수의 포효"),
  track("dfk-boss-v1-0", "거대한 그림자의 포효"),
  track("ct2-finalboss-v0-1", "운명의 시계탑 결전"),
];

export function resolveOprnBgmAssetUrl(resourceId: string): string | null {
  const asset = OPRN_BGM_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}
