// Walking sheets have eight characters; face sheets have sixteen portraits.
// 2026-09-18 visual audit: Actor1/2 use the two halves of FaceSet/Actor1,
// Actor3/4 use the two halves of FaceSet/Actor2. Equal sheet names are NOT a pair.
// People1 4/5 are approximate (skin/age differences), not identity evidence.
// Evidence: output/evidence/character-face-audit and character-face-correction.

import { findCharsetSemantic, type CharsetAge, type CharsetGender } from "@/assets/charsetSemantics";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { EventPageGraphic, FaceGraphic } from "@/project/types";

/** Source-image correspondences. Offsets are face cells, never walking frames. */
const REVIEWED_FACESETS: Readonly<Record<string, { sheet: string; offset: number }>> = {
  tex_easyrpg_charset_people1: { sheet: "easyrpg-faceset-people1", offset: 0 },
  tex_easyrpg_charset_people3: { sheet: "easyrpg-faceset-people2", offset: 0 },
  tex_easyrpg_charset_actor1: { sheet: "easyrpg-faceset-actor1", offset: 0 },
  tex_easyrpg_charset_actor2: { sheet: "easyrpg-faceset-actor1", offset: 8 },
  tex_easyrpg_charset_actor3: { sheet: "easyrpg-faceset-actor2", offset: 0 },
  tex_easyrpg_charset_actor4: { sheet: "easyrpg-faceset-actor2", offset: 8 },
};

// Legacy tool fallbacks are not reviewed identities and never enter recommendations.
const CHARSET_TO_FACESET: Readonly<Record<string, string>> = {
  tex_easyrpg_charset_people2: "easyrpg-faceset-people1",
  tex_easyrpg_charset_people4: "easyrpg-faceset-people1",
  tex_easyrpg_charset_people5: "easyrpg-faceset-people1",
  tex_easyrpg_charset_monster1: "easyrpg-faceset-monster",
  tex_easyrpg_charset_monster2: "easyrpg-faceset-monster",
  tex_easyrpg_charset_monster3: "easyrpg-faceset-monster",
};

/**
 * FaceSet/People1.png 16칸 라벨. scripts/scratch-faceset-grid.cjs 로 2배 확대해 육안 확인
 * (2026-07-27). 0~7 은 CharSet/People1 과 같은 인물이고, 8~15 는 차셋에 대응이 없는
 * **추가 얼굴**이다 — 짝 없는 시트의 NPC 에게 줄 얼굴이 여기 있다.
 */
export const FACESET_PEOPLE1_FACES: readonly {
  /** 낱장 얼굴 리소스 id(과거 People1 시트의 칸 번호에서 옮겨 왔다). */
  readonly resourceId: string;
  readonly label: string;
  readonly gender: CharsetGender;
  readonly age?: CharsetAge;
}[] = [
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 0), label: "갈색 단발 소년", gender: "male", age: "child" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 1), label: "금발 소녀", gender: "female", age: "child" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 2), label: "청발 청년", gender: "male", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 3), label: "금발 젊은 여성", gender: "female", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 4), label: "콧수염 중년 남성", gender: "male", age: "middle" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 5), label: "갈색 머리 여성", gender: "female", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 6), label: "흰 수염 노인", gender: "male", age: "elder" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 7), label: "백발 노파", gender: "female", age: "elder" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 8), label: "검은 머리 청년", gender: "male", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 9), label: "흰 두건 여성", gender: "female", age: "middle" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 10), label: "대머리 남성", gender: "male", age: "middle" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 11), label: "이국적인 여성", gender: "female", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 12), label: "검은 장발 남성", gender: "male", age: "middle" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 13), label: "금발 곱슬 여성", gender: "female", age: "middle" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 14), label: "붉은 머리 여성", gender: "female", age: "youth" },
  { resourceId: faceIdForSheetCell("easyrpg-faceset-people1", 15), label: "초록 머리 소녀", gender: "female", age: "child" },
];

/** Reviewed human-sheet correspondence, without the index/age fallback used by NPC tools. */
export function reviewedCharsetFace(textureKey: string, characterIndex: number): { resourceId: string; approximate: boolean } | null {
  const canonical = findCharsetAsset(textureKey)?.textureKey ?? textureKey;
  const pair = REVIEWED_FACESETS[canonical];
  if (!pair || !Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return null;
  return { resourceId: faceIdForSheetCell(pair.sheet, characterIndex + pair.offset), approximate: canonical === "tex_easyrpg_charset_people1" && [4, 5].includes(characterIndex) };
}

/** textureKey(charset) + characterIndex → FaceGraphic. 없으면 null. */
export function faceGraphicForCharset(
  textureKey: string,
  characterIndex = 0,
): FaceGraphic | null {
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return null;
  const reviewed = reviewedCharsetFace(textureKey, characterIndex);
  if (reviewed) return { resourceId: reviewed.resourceId, position: "left", flipHorizontally: false };
  const sheetResourceId = CHARSET_TO_FACESET[textureKey]
    ?? inferFacesetFromTextureKey(textureKey);
  if (!sheetResourceId) return null;
  return {
    resourceId: faceIdForSheetCell(sheetResourceId, characterIndex),
    position: "left",
    flipHorizontally: false,
  };
}

/** EventPage graphic에서 페이스 추정. 투명 그래픽은 null. */
export function faceGraphicFromEventGraphic(graphic: EventPageGraphic): FaceGraphic | null {
  if (!graphic || graphic.transparent) return null;
  const sprite = graphic.sprite;
  if (!sprite || sprite.type !== "bundled" || !sprite.id) return null;
  const textureKey = sprite.id;
  let characterIndex = 0;
  if (typeof graphic.pattern === "number") {
    try {
      characterIndex = decodeCharsetFrameIndex(graphic.pattern).characterIndex;
    } catch {
      characterIndex = 0;
    }
  }
  return faceGraphicForCharset(textureKey, characterIndex);
}

/**
 * 손으로 저작하는 NPC 용 얼굴. **짝이 맞는 시트만 인덱스를 그대로 쓰고**, 짝이 없으면
 * 카탈로그의 성별·나이로 FaceSet/People1 에서 고른다. 사람이 아닌 차셋
 * (monster/object/animal/vehicle)에는 얼굴을 주지 않는다 — 몬스터에게 사람 얼굴을
 * 붙이는 것보다 얼굴이 없는 게 맞다.
 */
export function npcFaceGraphic(textureKey: string, characterIndex = 0): FaceGraphic | null {
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex > 7) return null;
  textureKey = findCharsetAsset(textureKey)?.textureKey ?? textureKey;
  const reviewed = reviewedCharsetFace(textureKey, characterIndex);
  if (reviewed) return { resourceId: reviewed.resourceId, position: "left", flipHorizontally: false };
  if (!textureKey.includes("people") && !textureKey.includes("actor")) return null;

  const semantic = findCharsetSemantic(textureKey, characterIndex);
  if (!semantic) return null;
  const gender = semantic.gender === "none" ? undefined : semantic.gender;
  const age = semantic.age;
  // 성별·나이가 **둘 다** 비어 있으면 고를 근거가 없다 — 얼굴을 붙이지 않는다.
  if (!gender && !age) return null;

  let best: { readonly resourceId: string; readonly score: number } | null = null;
  for (const face of FACESET_PEOPLE1_FACES) {
    if (gender && face.gender !== gender) continue;
    if (age && face.age !== age) continue;
    // 나이를 모르는 역할(상인·승려처럼 카탈로그에 age 가 없는 칸)에는 **어른 얼굴**을 준다.
    // 이 갈래를 안 두면 성별만 맞춰 시트 첫 칸(소년/소녀)이 항상 뽑혀,
    // 중절모 신사에게 소년 얼굴이 붙는다.
    if (!age && face.age === "child") continue;
    let score = 0;
    if (gender && face.gender === gender) score += 40;
    if (age && face.age === age) score += 40;
    // 라벨 토큰 겹침 — "대머리 이국 주민"→"대머리 남성", "터번 노인"→"흰 수염 노인" 처럼
    // 같은 특징 단어가 있으면 그 칸을 고른다.
    for (const tag of semantic.tags) {
      if (tag.length >= 2 && face.label.includes(tag)) score += 25;
    }
    if (!best || score > best.score) best = { resourceId: face.resourceId, score };
  }
  if (!best) return null;
  return {
    resourceId: best.resourceId,
    position: "left",
    flipHorizontally: false,
  };
}

/** EventPage graphic → NPC 용 얼굴(짝이 맞는 것만 인덱스 추종). 투명·비인간은 null. */
export function npcFaceGraphicFromEventGraphic(graphic: EventPageGraphic): FaceGraphic | null {
  if (!graphic || graphic.transparent) return null;
  const sprite = graphic.sprite;
  if (!sprite || sprite.type !== "bundled" || !sprite.id) return null;
  let characterIndex = 0;
  if (typeof graphic.pattern === "number") {
    try {
      characterIndex = decodeCharsetFrameIndex(graphic.pattern).characterIndex;
    } catch {
      characterIndex = 0;
    }
  }
  return npcFaceGraphic(sprite.id, characterIndex);
}

function inferFacesetFromTextureKey(textureKey: string): string | null {
  const lower = textureKey.toLowerCase();
  // 짝은 이름이 아니라 실물로 정해진다(파일 머리말 참조): People3 ↔ FaceSet/People2.
  if (lower.includes("people3")) return "easyrpg-faceset-people2";
  if (
    lower.includes("people1") || lower.includes("people2")
    || lower.includes("people4") || lower.includes("people5")
  ) return "easyrpg-faceset-people1";
  if (lower.includes("actor1")) return "easyrpg-faceset-actor1";
  if (lower.includes("actor2")) return "easyrpg-faceset-actor2";
  if (lower.includes("monster")) return "easyrpg-faceset-monster";
  return null;
}
