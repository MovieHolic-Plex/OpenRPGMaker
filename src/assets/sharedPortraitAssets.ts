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

export const SHARED_PORTRAIT_ASSETS: readonly SharedPortraitAsset[] = FACE_EXPRESSION_SETS.flatMap((set) => {
  const folder = set.id.replace(/^shared-/u, "").replace(/-expressions$/u, "");
  return SHARED_PORTRAIT_MODES.flatMap((mode) => SHARED_PORTRAIT_EXPRESSIONS.map((expression) => ({
    id: sharedPortraitId(set.id, mode, expression),
    name: `${set.name} · ${MODE_LABELS[mode]} ${SHARED_PORTRAIT_EXPRESSION_LABELS[expression]}`,
    path: `assets/shared/portraits/${folder}/${mode}-${expression}.png`,
    setId: set.id,
    mode,
    expression,
  })));
});

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

export function resolveSharedPortraitUrl(resourceId: string): string | null {
  const asset = BY_ID.get(resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 같은 세트·같은 모양의 다른 표정. 공용 초상이 아니면 undefined. */
export function sharedPortraitWithExpression(resourceId: string | undefined, expression: SharedPortraitExpression): string | undefined {
  const asset = findSharedPortrait(resourceId);
  return asset ? sharedPortraitId(asset.setId, asset.mode, expression) : undefined;
}

/** 공용 초상 하나가 참조되면 런타임이 대사 표정으로 바꿔 쓸 수 있는 같은 모양 5장(내보내기용). */
export function sharedPortraitExpressionSiblings(resourceId: string): readonly string[] {
  const asset = findSharedPortrait(resourceId);
  return asset ? SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS.map((expression) => sharedPortraitId(asset.setId, asset.mode, expression)) : [];
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
  return match && FACE_EXPRESSION_SETS.some((set) => set.id === match[1]) ? match[1] : undefined;
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
  return sharedPortraitId(base.setId, base.mode, emotion as SharedPortraitExpression);
}
