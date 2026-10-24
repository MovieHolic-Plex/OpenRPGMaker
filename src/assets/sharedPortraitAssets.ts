import { FACE_EXPRESSION_SETS } from "./faceExpressionSets";
import expressionSources from "../../scripts/shared-face-expression-sources.json";

/**
 * 공용 표정 세트 76종의 대화용 흉상·전신(2026-10-01, scripts/content/portraits/).
 * 세트마다 2모양 × 16표정(얼굴 16칸과 같은 표정) = 32장. 그림: public/assets/shared/portraits/<세트 줄기>/<모양>-<표정>.png
 *
 * id 는 `${세트 id}-${모양}-${표정}` (예: shared-people1-boy-expressions-bust-happy).
 * id 안의 `-bust`/`-full` 이 대화창의 표시 방식을 정한다(dialogue.ts dialoguePortraitMode,
 * facesetPreview.ts faceDisplayModeOf) — 이 규약을 바꾸면 두 곳이 같이 깨진다.
 */
export const SHARED_PORTRAIT_MODES = ["bust", "full"] as const;
export type SharedPortraitMode = (typeof SHARED_PORTRAIT_MODES)[number];
/**
 * 얼굴 16칸과 같은 순서의 표정. base=00, happy=02, surprised=04, angry=09, sad=10 은 대사 표정
 * (DIALOGUE_EMOTION_IDS)과 같은 이름이라 대사 emotion 이 자동으로 고른다. 나머지 11개는 직접 고른다.
 */
export const SHARED_PORTRAIT_EXPRESSIONS = [
  "base", "smile", "happy", "content", "surprised", "embarrassed", "doubtful", "serious",
  "annoyed", "angry", "sad", "crying", "worried", "determined", "shy", "wink",
] as const;
export type SharedPortraitExpression = (typeof SHARED_PORTRAIT_EXPRESSIONS)[number];
/** 대사 emotion 으로 바뀌는 표정(나머지는 내보내기에 자동으로 실리지 않는다 — 직접 참조될 때만). */
export const SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS = ["base", "happy", "sad", "angry", "surprised"] as const satisfies readonly SharedPortraitExpression[];

export type SharedPortraitAsset = {
  readonly id: string;
  readonly name: string;
  /** public/ 아래 경로. 런타임 URL 은 `/${path}`. */
  readonly path: string;
  /** 짝 표정 세트 id(shared-<줄기>-expressions). */
  readonly setId: string;
  readonly mode: SharedPortraitMode;
  readonly expression: SharedPortraitExpression;
  /** 화면 보간. 도트 초상은 pixelated, 현대 연애 고해상도 일러스트는 smooth(보간을 끄면 계단이 생긴다). */
  readonly rendering: "pixel" | "smooth";
};

const MODE_LABELS: Readonly<Record<SharedPortraitMode, string>> = { bust: "흉상", full: "전신" };
export const SHARED_PORTRAIT_EXPRESSION_LABELS: Readonly<Record<SharedPortraitExpression, string>> = {
  base: "기본", smile: "눈웃음", happy: "기쁨", content: "흐뭇함", surprised: "놀람", embarrassed: "당황",
  doubtful: "의심", serious: "진지함", annoyed: "짜증", angry: "분노", sad: "슬픔", crying: "울음",
  worried: "걱정", determined: "결의", shy: "수줍음", wink: "윙크",
};

export function sharedPortraitId(setId: string, mode: SharedPortraitMode, expression: SharedPortraitExpression): string {
  return `${setId}-${mode}-${expression}`;
}

/**
 * 현대 연애 인물 칩(Modern1~3) 24종 짝 초상(2026-10-16 1차 12종 · 2026-10-17 나머지 12종, scripts/content/portraits/modern_portraits.py).
 * 현대 칩에는 48px 얼굴이 없다 — 칩이 정답이고 흉상·전신을 새로 그렸다. 줄기는 `modern-<칩 id 뒤쪽>`(칩 id 와 1:1)이고
 * 표정은 기본·기쁨·놀람·슬픔·당황 5개뿐이다(나머지 11표정은 2단계, 없는 표정은 대사가 기본 그림으로 폴백한다).
 * 대응표(sharedCharacterGraphics.json)가 칩 → 이 세트의 흉상 base 를 「얼굴」로 잇는다.
 */
export const MODERN_PORTRAIT_EXPRESSIONS = ["base", "happy", "surprised", "sad", "embarrassed"] as const satisfies readonly SharedPortraitExpression[];
export const MODERN_PORTRAIT_SETS: readonly { readonly stem: string; readonly name: string }[] = [
  { stem: "modern-uni-boy-navy", name: "남학생 · 남색 블레이저" },
  { stem: "modern-uni-boy-sidetail", name: "남학생 · 옆머리 묶음" },
  { stem: "modern-uni-girl-navy", name: "여학생 · 남색 블레이저" },
  { stem: "modern-uni-girl-sailor", name: "여학생 · 세일러복" },
  { stem: "modern-uni-girl-twintail", name: "여학생 · 양갈래" },
  { stem: "modern-casual-boy-hoodie", name: "캐주얼 남 · 회색 후드티" },
  { stem: "modern-casual-girl-mint", name: "캐주얼 여 · 민트 원피스" },
  { stem: "modern-suit-boy-navy", name: "정장 남 · 네이비" },
  { stem: "modern-suit-girl-navy", name: "정장 여 · 남색" },
  { stem: "modern-apron-brown", name: "카페 점원 · 갈색 앞치마" },
  { stem: "modern-teacher-tweed", name: "교수 · 트위드 재킷" },
  { stem: "modern-teacher-cardigan", name: "여선생 · 버건디 카디건" },
  { stem: "modern-uni-boy-grey", name: "남학생 · 회색 블레이저" },
  { stem: "modern-uni-boy-summer", name: "남학생 · 여름 교복" },
  { stem: "modern-uni-girl-bun", name: "여학생 · 올림머리 카디건" },
  { stem: "modern-uni-girl-long", name: "여학생 · 긴 머리 회색 블레이저" },
  { stem: "modern-casual-boy-mustard", name: "캐주얼 남 · 머스터드 스웨트셔츠" },
  { stem: "modern-casual-boy-olive", name: "캐주얼 남 · 올리브 재킷" },
  { stem: "modern-casual-girl-pink", name: "캐주얼 여 · 분홍 후드티" },
  { stem: "modern-casual-girl-lavender", name: "캐주얼 여 · 라벤더 블라우스" },
  { stem: "modern-casual-girl-stripe", name: "캐주얼 여 · 줄무늬 티" },
  { stem: "modern-suit-boy-charcoal", name: "정장 남 · 차콜" },
  { stem: "modern-apron-navy", name: "카페 점원 · 남색 앞치마" },
  { stem: "modern-apron-olive", name: "카페 점원 · 올리브 앞치마" },
];

const faceSetPortraits = FACE_EXPRESSION_SETS.flatMap((set) => {
  const folder = set.id.replace(/^shared-/u, "").replace(/-expressions$/u, "");
  return SHARED_PORTRAIT_MODES.flatMap((mode) => SHARED_PORTRAIT_EXPRESSIONS.map((expression) => ({
    id: sharedPortraitId(set.id, mode, expression),
    name: `${set.name} · ${MODE_LABELS[mode]} ${SHARED_PORTRAIT_EXPRESSION_LABELS[expression]}`,
    path: `assets/shared/portraits/${folder}/${mode}-${expression}.png`,
    setId: set.id,
    mode,
    expression,
    rendering: "pixel" as const,
  })));
});
// 옆머리 묶음 남학생 세트는 현대 연애 무대에서 여학생으로 읽혀 같은 교복 남학생 세트로 연결한다.
const MODERN_CLEAN_STEM_OVERRIDES: Readonly<Record<string, string>> = {
  "modern-uni-boy-sidetail": "modern-uni-boy-grey",
};
const modernPortraits = MODERN_PORTRAIT_SETS.flatMap((set) => {
  const setId = `shared-${set.stem}-expressions`;
  return SHARED_PORTRAIT_MODES.flatMap((mode) => MODERN_PORTRAIT_EXPRESSIONS.map((expression) => ({
    id: sharedPortraitId(setId, mode, expression),
    name: `${set.name} · ${MODE_LABELS[mode]} ${SHARED_PORTRAIT_EXPRESSION_LABELS[expression]}`,
    path: `assets/shared/portraits/${MODERN_CLEAN_STEM_OVERRIDES[set.stem] ?? set.stem}/${mode}-${expression}.png`,
    setId,
    mode,
    expression,
    rendering: "smooth" as const,
  })));
});
export const SHARED_PORTRAIT_ASSETS: readonly SharedPortraitAsset[] = [...faceSetPortraits, ...modernPortraits];

const BY_ID = new Map(SHARED_PORTRAIT_ASSETS.map((asset) => [asset.id, asset]));
const ORIGINAL_FACE_SETS = new Map(expressionSources.map(source => [
  `easyrpg-faceset-${source.baseSheet.toLowerCase()}-${String(source.baseCell).padStart(2, "0")}`,
  `shared-${source.stem}`,
]));

const VARIANT_NOTES: Readonly<Record<string, string>> = {
  "shared-green-scholar-expressions": "원본 얼굴의 안경은 파생 초상에 없다.",
  "shared-blue-headband-expressions": "전신에는 검은 모자가 추가되어 있다.",
  "shared-people1-blonde-wave-expressions": "전신에는 토끼 귀 장식이 추가되어 있다.",
  "shared-people1-red-woman-expressions": "초상에는 날개와 광륜이 추가되어 있다.",
  "shared-people1-mint-woman-expressions": "초상에는 요정 날개가 추가되어 있다.",
  "shared-people2-blue-woman-expressions": "초상의 왕관은 원본 얼굴에는 없다.",
  "shared-monster-white-dragon-expressions": "흰 머리·갈기와 청록색 몸을 가진 용이다.",
};

/** Provenance links a family, not identical clothing/body details. */
export function sharedPortraitReferenceNote(setId: string): string {
  return `${VARIANT_NOTES[setId] ?? ""} 원본 얼굴·표정 얼굴·흉상·전신은 별도 그림이다. 복장과 장식을 각각 확인한다.`.trim();
}

export function findSharedPortrait(resourceId: string | undefined): SharedPortraitAsset | undefined {
  return resourceId === undefined ? undefined : BY_ID.get(resourceId);
}

/** 초상 노드의 `data-portrait-render`. 공용 세트 밖(업로드·원본 얼굴)은 도트로 본다. */
export function sharedPortraitRendering(resourceId: string | undefined): SharedPortraitAsset["rendering"] {
  return findSharedPortrait(resourceId)?.rendering ?? "pixel";
}

export function resolveSharedPortraitUrl(resourceId: string): string | null {
  const asset = BY_ID.get(resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 같은 세트·같은 모양의 다른 표정. 공용 초상이 아니거나 그 세트에 그 표정이 없으면 undefined. */
export function sharedPortraitWithExpression(resourceId: string | undefined, expression: SharedPortraitExpression): string | undefined {
  const asset = findSharedPortrait(resourceId);
  const id = asset ? sharedPortraitId(asset.setId, asset.mode, expression) : undefined;
  return id && BY_ID.has(id) ? id : undefined;
}

/** 48px 얼굴 낱장(-00~-15)이 있는 세트인가. 현대 연애 세트는 흉상·전신뿐이다. */
export function sharedPortraitSetHasFaceCells(setId: string): boolean {
  return FACE_EXPRESSION_SETS.some((set) => set.id === setId);
}

/** 이 세트에 실제로 그려져 있는 표정(공용 76종은 16개, 현대 연애 세트는 5개). */
export function sharedPortraitExpressionsOfSet(setId: string): readonly SharedPortraitExpression[] {
  const found = new Set(SHARED_PORTRAIT_ASSETS.filter((asset) => asset.setId === setId).map((asset) => asset.expression));
  return SHARED_PORTRAIT_EXPRESSIONS.filter((expression) => found.has(expression));
}

/** 공용 초상 하나가 참조되면 런타임이 대사 표정으로 바꿔 쓸 수 있는 같은 모양 5장(내보내기용). */
export function sharedPortraitExpressionSiblings(resourceId: string): readonly string[] {
  const asset = findSharedPortrait(resourceId);
  return asset
    ? SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS.map((expression) => sharedPortraitId(asset.setId, asset.mode, expression)).filter((id) => BY_ID.has(id))
    : [];
}

/** 표정 세트 id → 그 세트의 흉상·전신 10장. */
export function sharedPortraitsForSet(setId: string): readonly SharedPortraitAsset[] {
  return SHARED_PORTRAIT_ASSETS.filter((asset) => asset.setId === setId);
}

/** 얼굴 낱장 id(shared-<줄기>-expressions-NN) 또는 공용 초상 id → 표정 세트 id. */
export function sharedExpressionSetIdOf(resourceId: string | undefined): string | undefined {
  if (!resourceId) return undefined;
  const portrait = findSharedPortrait(resourceId);
  if (portrait) return portrait.setId;
  const sourceSet = ORIGINAL_FACE_SETS.get(resourceId);
  if (sourceSet) return sourceSet;
  const match = /^(shared-.+-expressions)-\d{2}$/u.exec(resourceId);
  return match && (FACE_EXPRESSION_SETS.some((set) => set.id === match[1]) || MODERN_PORTRAIT_SETS.some((set) => `shared-${set.stem}-expressions` === match[1])) ? match[1] : undefined;
}

/**
 * 대사 한 줄에 실제로 띄울 얼굴. 바탕 얼굴이 공용 초상이면 표정에 맞는 같은 모양 그림으로 바꾼다 —
 * 화자 프로필의 표정 얼굴이 48px 낱장이어도 흉상·전신이 낱장으로 떨어지지 않는다.
 * 프로필 표정 얼굴이 따로 흉상·전신이면 그것이 이긴다.
 */
export function dialogueFaceForEmotion(
  baseResourceId: string | undefined,
  emotion: string | undefined,
  profileFace: string | undefined,
): string | undefined {
  const base = findSharedPortrait(baseResourceId);
  if (!base) return profileFace ?? baseResourceId;
  if (profileFace && /-(?:bust|full)\b|^generated-face-/u.test(profileFace)) return profileFace;
  if (!emotion || !(SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS as readonly string[]).includes(emotion)) return baseResourceId;
  const next = sharedPortraitId(base.setId, base.mode, emotion as SharedPortraitExpression);
  // 표정이 일부만 그려진 세트(현대 연애 5표정 — 분노 없음)는 없는 표정에서 기본 그림에 머문다(깨진 이미지 금지).
  return BY_ID.has(next) ? next : baseResourceId;
}

/**
 * 초상 그림의 원래 시선(화면 기준). 현대 연애 흉상·전신(modern-*)은 모두 화면 오른쪽(→)을 보게 그렸다(2026-10-21 실측, 24종).
 * 대화창은 이 값으로 오른쪽 자리의 초상을 거울로 뒤집어 두 사람이 마주 보게 한다. 모르는 그림은 null(뒤집지 않는다).
 */
export function sharedPortraitNativeGaze(resourceId: string | undefined): "left" | "right" | null {
  if (!resourceId) return null;
  if (/^shared-modern-.+-expressions-(?:bust|full)-[a-z]+$/u.test(resourceId)) return "right";
  return null;
}
