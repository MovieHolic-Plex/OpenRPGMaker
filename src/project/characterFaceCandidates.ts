import { reviewedCharsetFace } from "@/assets/charsetFaceMap";
import { GRAPHIC_ATTRIBUTE_AXES, type CharacterFace, type CharacterSprite } from "./characterGraphics";

export interface CharacterFaceCandidate {
  face: CharacterFace;
  score: number;
  reasons: string[];
  conflicts: string[];
  recommendation: "paired" | "similar" | "none" | "conflict";
}
const labels = { kind: "종류", age: "나이", gender: "성별", skin: "피부", hair: "머리", clothing: "의상", role: "역할" };
const priority = { paired: 3, similar: 2, none: 1, conflict: 0 };
export function isRecommendedCharacterFace(candidate: CharacterFaceCandidate): boolean {
  return candidate.recommendation === "paired" || candidate.recommendation === "similar";
}

/** Suggestions only. Contradictions veto table priority; broad gender/kind alone never establish a pair. */
export function rankCharacterFaces(sprite: CharacterSprite, faces: readonly CharacterFace[]): CharacterFaceCandidate[] {
  const reviewed = reviewedCharsetFace(sprite.textureKey, sprite.characterIndex);
  const tokens = [...new Set(`${sprite.label} ${sprite.note}`.toLocaleLowerCase().split(/[\s·,()[\]#]+/).filter((token) => token.length >= 2 && !/^\d+$/.test(token)))];
  return faces.map((face): CharacterFaceCandidate => {
    const reasons: string[] = [];
    const conflicts: string[] = [];
    let score = 0;
    let distinctive = 0;
    const paired = reviewed?.resourceId === face.resourceId;
    for (const axis of GRAPHIC_ATTRIBUTE_AXES) {
      const expected = sprite.attributes[axis];
      const actual = face.attributes[axis];
      if (!expected || !actual) continue;
      if (expected === actual) {
        score += 6;
        reasons.push(`${labels[axis]}: ${actual}`);
        if (["hair", "clothing", "role"].includes(axis)) distinctive++;
      } else {
        score -= 12;
        conflicts.push(`${labels[axis]}: ${expected} ↔ ${actual}`);
      }
    }
    if (face.attributes.age === "어린이" && !sprite.attributes.age) {
      conflicts.push("나이 미확인 · 어린이 얼굴은 추천 제외");
    }
    const description = `${face.label} ${face.note}`.toLocaleLowerCase();
    const overlap = tokens.filter((token) => description.includes(token));
    if (overlap.length) { score += Math.min(overlap.length, 4) * 2; reasons.push(`설명: ${overlap.slice(0, 3).join(" · ")}`); }
    const sameAgeAndGender = Boolean(sprite.attributes.age && sprite.attributes.gender
      && sprite.attributes.age === face.attributes.age && sprite.attributes.gender === face.attributes.gender);
    const recommendation = conflicts.length ? "conflict"
      : paired && !reviewed?.approximate ? "paired"
      : paired || distinctive > 0 || sameAgeAndGender ? "similar" : "none";
    // The source table is provenance, not permission to overrule edited traits.
    if (paired) {
      reasons.unshift(conflicts.length ? "기본 대응표와 현재 속성이 다릅니다"
        : reviewed?.approximate ? "유사 대응 · 피부·나이 차이 확인" : "원본 이미지 대응");
      if (!conflicts.length) score += reviewed?.approximate ? 20 : 100;
    }
    return { face, score, reasons, conflicts, recommendation };
  }).sort((a, b) => priority[b.recommendation] - priority[a.recommendation] || b.score - a.score || a.face.label.localeCompare(b.face.label, "ko"));
}
