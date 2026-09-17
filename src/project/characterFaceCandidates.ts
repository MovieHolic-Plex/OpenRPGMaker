import { reviewedCharsetFace } from "@/assets/charsetFaceMap";
import { GRAPHIC_ATTRIBUTE_AXES, type CharacterFace, type CharacterSprite } from "./characterGraphics";

export interface CharacterFaceCandidate {
  face: CharacterFace;
  score: number;
  reasons: string[];
  conflicts: string[];
}
const labels = { kind: "종류", age: "나이", gender: "성별", skin: "피부", hair: "머리", clothing: "의상", role: "역할" };

/** Suggestions only: written evidence never changes an authored mapping or proves identity. */
export function rankCharacterFaces(sprite: CharacterSprite, faces: readonly CharacterFace[]): CharacterFaceCandidate[] {
  const reviewed = reviewedCharsetFace(sprite.textureKey, sprite.characterIndex);
  const tokens = [...new Set(`${sprite.label} ${sprite.note}`.toLocaleLowerCase().split(/[\s·,()[\]#]+/).filter((token) => token.length >= 2 && !/^\d+$/.test(token)))];
  return faces.map((face): CharacterFaceCandidate => {
    const reasons: string[] = [];
    const conflicts: string[] = [];
    let score = 0;
    if (reviewed?.resourceId === face.resourceId) {
      score += 100;
      reasons.push(reviewed.approximate ? "기본 대응표 · 피부·나이 차이 확인" : "기본 대응표의 얼굴");
    }
    for (const axis of GRAPHIC_ATTRIBUTE_AXES) {
      const expected = sprite.attributes[axis];
      const actual = face.attributes[axis];
      if (!expected || !actual) continue;
      if (expected === actual) { score += 6; reasons.push(`${labels[axis]}: ${actual}`); }
      else { score -= 12; conflicts.push(`${labels[axis]}: ${expected} ↔ ${actual}`); }
    }
    const description = `${face.label} ${face.note}`.toLocaleLowerCase();
    const overlap = tokens.filter((token) => description.includes(token));
    if (overlap.length) { score += Math.min(overlap.length, 4) * 2; reasons.push(`설명: ${overlap.slice(0, 3).join(" · ")}`); }
    return { face, score, reasons, conflicts };
  }).sort((a, b) => b.score - a.score || a.face.label.localeCompare(b.face.label, "ko"));
}
