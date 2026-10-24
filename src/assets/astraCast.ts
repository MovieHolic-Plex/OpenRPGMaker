/**
 * 아스트라 호라이즌(몬스터 수집 기함 데모) 등장인물 흉상·전신 그림.
 * 흉상(bust-*)은 2026-10-23 「징그럽다」는 지적으로 다시 만들었다: char-gen(OPRN 자체 생성기) 이미지 엔진에 저해상도 도트 초상을 직접 그리게 하고,
 * 그 그림의 원래 격자를 되찾아 64x64(인물마다 16색, 표정은 기본 그림의 얼굴 칸만 바꿈)로 구웠다. 화면에서는 2배(128x128, bustPixelate.ts).
 * 후보는 인물마다 4장 이상을 눈가림 판정단(Opus 3 + Argon 1)이 골랐다 — scripts/content/monsters/bake_astra_busts64.py,
 * 출처·화소 해시: public/assets/emerald-monster/cast/provenance-busts64.json. 전신(full-*)·카드는 옛 44x46 시절 그림이며 지금 게임 화면에는 쓰지 않는다
 * (emeraldCrownCast.ts 의 SPOTLIGHTS 가 비어 있다 — 첫 만남 등장은 전투 트레이너 그림이 맡는다). 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type AstraCastId = 'hero' | 'mom' | 'professor' | 'naru' | 'nurse' | 'yurim' | 'muyeong';
export type AstraCastExpression = 'base' | 'happy' | 'sad' | 'angry' | 'surprised' | 'serious' | 'determined';

/** 인물마다 구운 표정 — char-gen(최신 main) 의 대사 전환 표정 다섯(기본·기쁨·슬픔·화남·놀람), 품질 관문과 눈가림 정체성 판정을 거쳤다.
 * base 는 입 다문 차분한 얼굴(기쁨과 구별되게 입을 닫았다). 없는 표정(determined, 무영 밖의 serious)은 base 로 대신한다. */
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

/**
 * 천문박사 흉상 후보(2026-10-24 「박사 포트레잇 존나 괴물같음」). char-gen 64x64 흉상은 머리가 칸을 꽉 채운 극단 클로즈업에
 * 걷기 칩에 없는 큰 동그란 안경, 표정 편집이 깨진 놀람(눈 크기가 좌우 다름)·윙크 기쁨이라 다른 인물과 어긋났다.
 * - hand-a·hand-b: 코드 손 도트(scripts/content/monsters/astra_professor_hand/variant_a.py·variant_b.py), 걷기 칩 색 그대로.
 * - shared-elder·shared-moustache: 공용 흉상(people2-white-elder·people1-mustache)을 칩 색으로 다시 칠하고 64x64 로 줄임(shared_recolor.py).
 * - chargen: 옛 그림(cast/professor/).
 * 기본(ASTRA_PROFESSOR_BUST)이 대사에 쓰이고, 나머지도 oprn_astra_cast_professor_<후보>_bust_<표정> id 로 고를 수 있다.
 */
export const ASTRA_PROFESSOR_BUST_VARIANTS = ["cg-nat10", "cg-nat9", "cg-nat12", "cg-nat1", "hand-a", "hand-b", "shared-elder", "shared-moustache", "chargen"] as const;
export type AstraProfessorBustVariant = (typeof ASTRA_PROFESSOR_BUST_VARIANTS)[number];
/** 대사에 쓰는 박사 흉상. 바꾸려면 이 값 하나만 바꾼다(눈가림 검수 순위는 위 PR·verify-shots/astra-presentation 참고). */
export const ASTRA_PROFESSOR_BUST: AstraProfessorBustVariant = "hand-a";
const professorBustFolder = (variant: AstraProfessorBustVariant): string => variant === "chargen" ? "professor" : `professor-${variant}`;
export const astraProfessorVariantBustId = (variant: AstraProfessorBustVariant, expression: AstraCastExpression = "base"): string =>
  `oprn_astra_cast_professor_${variant.replace(/-/gu, "_")}_bust_${expression}`;

const castBustUrl = (cid: AstraCastId, expression: AstraCastExpression): string =>
  `/assets/emerald-monster/cast/${cid === "professor" ? professorBustFolder(ASTRA_PROFESSOR_BUST) : cid}/bust-${expression}.png`;

export const ASTRA_CAST_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  (Object.entries(ASTRA_CAST_EXPRESSIONS) as [AstraCastId, readonly AstraCastExpression[]][]).flatMap(([cid, expressions]) => expressions.flatMap((expression) => [
    [astraCastBustId(cid, expression), castBustUrl(cid, expression)],
    [astraCastFullId(cid, expression), `/assets/emerald-monster/cast/${cid}/full-${expression}.png`],
  ]).concat([[astraCastCardId(cid), `/assets/emerald-monster/cast/${cid}/card-base.png`]])).concat(
    ASTRA_PROFESSOR_BUST_VARIANTS.flatMap((variant) => ASTRA_CAST_EXPRESSIONS.professor.map((expression) =>
      [astraProfessorVariantBustId(variant, expression), `/assets/emerald-monster/cast/${professorBustFolder(variant)}/bust-${expression}.png`] as [string, string])),
  ),
);
