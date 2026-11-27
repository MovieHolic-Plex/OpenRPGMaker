/**
 * OPRN BGM — Google Lyria 로 만든 AI 생성 음악(CC0 아님). 라이선스 원문은 public/assets/oprn-bgm/LICENSE.txt:
 * 게임·상업 포함 자유, 원본 음원 단독 재배포 금지. 표기 권장 「Music: OPRN BGM (AI-generated, Google Lyria)」.
 * CC0 표(cc0AudioAssets.ts)와 섞지 않는다 — 라이선스 칸이 CC0-1.0 하나로 고정돼 있어 다른 라이선스를 거기에 적으면 거짓이 된다.
 */
export const OPRN_BGM_CREDIT = "Music: OPRN BGM (AI-generated, Google Lyria)";

/** 조수 곡 추천(recommend_bgm scene:battle|boss)과 출하 기본값(전투곡 고르기)이 읽는 장면. 곡 이름에는 「전투·보스」가 없어 이름으로는 못 찾는다. */
export type OprnBgmScene = "battle" | "boss";

export type OprnBgmAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly kind: "music";
  readonly license: "OPRN-BGM-1";
  readonly sourceName: string;
  /** 이 곡이 어울리는 전투 장면. 일반 전투곡은 battle, 보스전 곡은 boss(보스곡도 battle 후보에 든다). */
  readonly scenes: readonly OprnBgmScene[];
  /** 곡 분위기·어울리는 지역 한 줄(제목과 『폴른 스타』 지역 배치 기록 기준). 곡 목록 설명으로 나간다. */
  readonly brief: string;
};

const SOURCE_NAME = "OPRN BGM (AI-generated, Google Lyria)";
const track = (slug: string, name: string, scenes: readonly OprnBgmScene[], brief: string): OprnBgmAsset => ({
  id: `oprn-bgm-${slug}`,
  name: `${name} (OPRN BGM)`,
  path: `assets/oprn-bgm/fallen/${slug}.ogg`,
  kind: "music",
  license: "OPRN-BGM-1",
  sourceName: SOURCE_NAME,
  scenes,
  brief,
});

export const OPRN_BGM_ASSETS: readonly OprnBgmAsset[] = [
  track("ct2-battle-v1-1", "시간의 칼날", ["battle"], "일반 전투곡. 숲·들판 같은 야외 지역의 속도감 있는 전투."),
  track("gal-portraitboss-v0-1", "살아있는 액자의 추격", ["boss"], "보스전·추격전 곡. 저택·화랑·금고 같은 으스스한 실내의 긴박한 전투."),
  track("dfk-battlefield-v1-1", "잿더미 속의 애가", ["battle"], "일반 전투곡. 밤·폐허처럼 애잔하고 어두운 전장."),
  track("dfk-battlefield-v0-1", "잿더미 속의 탄식", ["battle"], "일반 전투곡. 북쪽 설원·황량한 고지처럼 차갑고 쓸쓸한 전장."),
  track("dfk-battlefield-v0-0", "잿더미가 된 들판", ["battle"], "일반 전투곡. 요새·성채 앞뜰처럼 묵직한 전장의 기본 전투."),
  track("dfk-boss-v0-0", "거대한 야수의 포효", ["boss"], "보스전 곡. 거대한 적·탑 꼭대기 같은 위압적인 결전."),
  track("dfk-boss-v1-0", "거대한 그림자의 포효", ["boss"], "보스전 곡. 어둡고 거대한 우두머리와의 결전."),
  track("ct2-finalboss-v0-1", "운명의 시계탑 결전", ["boss"], "마지막 보스전 곡. 이야기의 최종 결전·시계탑 같은 클라이맥스."),
];

export function resolveOprnBgmAssetUrl(resourceId: string): string | null {
  const asset = OPRN_BGM_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}
