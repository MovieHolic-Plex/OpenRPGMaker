/**
 * 아스트라 호라이즌(몬스터 수집 기함 데모) 등장인물 흉상·전신 그림.
 * char-gen(OPRN 자체 생성기) 산출물 중 감독이 고른 후보를 원래 도트 크기로 되돌려 구웠다 — scripts/content/monsters/bake_astra_cast.py,
 * 출처·화소 해시: public/assets/emerald-monster/cast/provenance.json. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraCastId = 'hero' | 'mom' | 'professor' | 'naru' | 'nurse' | 'yurim' | 'muyeong';
export type AstraCastExpression = 'base' | 'happy' | 'sad' | 'angry' | 'surprised' | 'serious' | 'determined';

/**
 * 인물마다 있는 흉상 표정. 2026-10-21 사용자 「char-gen 흉상·전신이 칩·전투 화면과 안 맞는다」 → 흉상은 손 도트로 다시 찍었다
 * (scripts/content/monsters/astra_handpixel/draw_portraits.py — 행 문자열 도트, 생성 그림 없음, 걷기 칩 팔레트). 44×46 격자를 2배(88×92) —
 * bustPixelate 는 이 크기면 다시 변환하지 않는다. 없는 표정은 base 로 대신한다.
 */
export const ASTRA_CAST_EXPRESSIONS: Readonly<Record<AstraCastId, readonly AstraCastExpression[]>> = {
  hero: ['base', 'happy', 'surprised'],
  mom: ['base', 'happy', 'surprised'],
  professor: ['base', 'happy', 'surprised'],
  nurse: ['base', 'happy', 'surprised'],
  naru: ['base', 'happy', 'surprised', 'angry'],
  yurim: ['base', 'happy', 'surprised', 'angry'],
  muyeong: ['base', 'happy', 'surprised', 'angry'],
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
