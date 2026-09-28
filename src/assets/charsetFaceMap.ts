// Walking sheets have eight characters; face sheets have sixteen portraits.
// 2026-09-18 visual audit: Actor1/2 use the two halves of FaceSet/Actor1,
// Actor3/4 use the two halves of FaceSet/Actor2. Equal sheet names are NOT a pair.
// People1 4/5 are approximate (skin/age differences), not identity evidence.
// Evidence: output/evidence/character-face-audit and character-face-correction.
//
// 2026-09-28: 시트 이름·성별·나이로 얼굴을 추정하던 함수(faceGraphicForCharset·npcFaceGraphic 등)를 지웠다.
// 그 추정이 하늘계단 NPC 10명에게 다른 인물의 얼굴을 붙였다. 얼굴 배정은 이제 공용 대응표
// (reviewedCharsetFaces.ts → sharedCharacterGraphics.json) 한 곳에서만 나온다.

import type { CharsetAge, CharsetGender } from "@/assets/charsetSemantics";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";

/** Source-image correspondences. Offsets are face cells, never walking frames. */
const REVIEWED_FACESETS: Readonly<Record<string, { sheet: string; offset: number }>> = {
  tex_easyrpg_charset_people1: { sheet: "easyrpg-faceset-people1", offset: 0 },
  tex_easyrpg_charset_people3: { sheet: "easyrpg-faceset-people2", offset: 0 },
  tex_easyrpg_charset_actor1: { sheet: "easyrpg-faceset-actor1", offset: 0 },
  tex_easyrpg_charset_actor2: { sheet: "easyrpg-faceset-actor1", offset: 8 },
  tex_easyrpg_charset_actor3: { sheet: "easyrpg-faceset-actor2", offset: 0 },
  tex_easyrpg_charset_actor4: { sheet: "easyrpg-faceset-actor2", offset: 8 },
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
  // Actor3 #5(청록 머리 무도가)는 FaceSet/Actor2 에 이 인물이 없다 — 반쪽 규칙의 유일한 예외(2026-09-28 원본 대조).
  if (canonical === "tex_easyrpg_charset_actor3" && characterIndex === 5) return null;
  return { resourceId: faceIdForSheetCell(pair.sheet, characterIndex + pair.offset), approximate: canonical === "tex_easyrpg_charset_people1" && [4, 5].includes(characterIndex) };
}
