/**
 * 아스트라 호라이즌(몬스터 수집 기함 데모) 등장인물 흉상·전신 그림.
 * char-gen(OPRN 자체 생성기) 산출물 중 감독이 고른 후보를 원래 도트 크기로 되돌려 구웠다 — scripts/content/monsters/bake_astra_cast.py,
 * 출처·화소 해시: public/assets/emerald-monster/cast/provenance.json. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraCastId = 'hero' | 'mom' | 'professor' | 'naru' | 'nurse' | 'yurim' | 'muyeong';
export type AstraCastExpression = 'base' | 'happy' | 'sad' | 'angry' | 'surprised' | 'serious' | 'determined';

/** 인물마다 구운 표정. serious·determined 는 나루·유림·무영만 있다. */
export const ASTRA_CAST_EXPRESSIONS: Readonly<Record<AstraCastId, readonly AstraCastExpression[]>> = {
  hero: ['base', 'happy', 'sad', 'angry', 'surprised'],
  mom: ['base', 'happy', 'sad', 'angry', 'surprised'],
  professor: ['base', 'happy', 'sad', 'angry', 'surprised'],
  nurse: ['base', 'happy', 'sad', 'angry', 'surprised'],
  naru: ['base', 'happy', 'sad', 'angry', 'surprised', 'serious', 'determined'],
  yurim: ['base', 'happy', 'sad', 'angry', 'surprised', 'serious', 'determined'],
  muyeong: ['base', 'happy', 'sad', 'angry', 'surprised', 'serious', 'determined'],
};

export const astraCastBustId = (cid: AstraCastId, expression: AstraCastExpression = 'base'): string => `oprn_astra_cast_${cid}_bust_${expression}`;
export const astraCastFullId = (cid: AstraCastId, expression: AstraCastExpression = 'base'): string => `oprn_astra_cast_${cid}_full_${expression}`;

export const ASTRA_CAST_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  (Object.entries(ASTRA_CAST_EXPRESSIONS) as [AstraCastId, readonly AstraCastExpression[]][]).flatMap(([cid, expressions]) => expressions.flatMap((expression) => [
    [astraCastBustId(cid, expression), `/assets/emerald-monster/cast/${cid}/bust-${expression}.png`],
    [astraCastFullId(cid, expression), `/assets/emerald-monster/cast/${cid}/full-${expression}.png`],
  ])),
);
