/**
 * 아스트라 호라이즌(몬스터 수집 기함 데모) 등장인물 흉상·전신 그림.
 * char-gen(OPRN 자체 생성기, 최신 main) 고해상 초상 중 감독이 고른 후보를 대사 상자 그림 칸 88x92 도트로 줄여 구웠다 — scripts/content/monsters/bake_astra_cast.py,
 * 출처·화소 해시: public/assets/emerald-monster/cast/provenance.json. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraCastId = 'hero' | 'mom' | 'professor' | 'naru' | 'nurse' | 'yurim' | 'muyeong';
export type AstraCastExpression = 'base' | 'happy' | 'sad' | 'angry' | 'surprised' | 'serious' | 'determined';

/** 인물마다 구운 표정 — char-gen(최신 main) 의 대사 전환 표정 다섯(기본·기쁨·슬픔·화남·놀람), 품질 관문과 눈가림 정체성 판정을 거쳤다.
 * base 는 고른 그림 그대로(옅은 미소라 smile/content 로 읽힌다). 없는 표정(determined, 무영 밖의 serious)은 base 로 대신한다. */
const FIVE = ['base', 'happy', 'sad', 'angry', 'surprised'] as const;
export const ASTRA_CAST_EXPRESSIONS: Readonly<Record<AstraCastId, readonly AstraCastExpression[]>> = {
  hero: FIVE,
  mom: FIVE,
  professor: FIVE,
  nurse: FIVE,
  naru: FIVE,
  yurim: FIVE,
  muyeong: [...FIVE, 'serious'], // 옛 저장본이 muyeong_bust_serious 를 가리킨다
};

export const astraCastBustId = (cid: AstraCastId, expression: AstraCastExpression = 'base'): string => `oprn_astra_cast_${cid}_bust_${expression}`;
export const astraCastFullId = (cid: AstraCastId, expression: AstraCastExpression = 'base'): string => `oprn_astra_cast_${cid}_full_${expression}`;

/** 전신 카드(대사 상자와 같은 테두리 창 + 전신 1배, 기본 표정). 첫 만남 장면에 쓴다. */
export const astraCastCardId = (cid: AstraCastId): string => `oprn_astra_cast_${cid}_card`;

export const ASTRA_CAST_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  (Object.entries(ASTRA_CAST_EXPRESSIONS) as [AstraCastId, readonly AstraCastExpression[]][]).flatMap(([cid, expressions]) => expressions.flatMap((expression) => [
    [astraCastBustId(cid, expression), `/assets/emerald-monster/cast/${cid}/bust-${expression}.png`],
    [astraCastFullId(cid, expression), `/assets/emerald-monster/cast/${cid}/full-${expression}.png`],
  ]).concat([[astraCastCardId(cid), `/assets/emerald-monster/cast/${cid}/card-base.png`]])),
);
