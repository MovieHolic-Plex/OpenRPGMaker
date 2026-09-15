import { AUTHORABLE_FACESET_FACE_ASSETS } from "./facesetFaceAssets";

/** Common expression sets retain standalone resource ids for dialogue and actor pickers. */
export const FACE_EXPRESSION_SETS = [{
  id: "shared-blue-traveler-expressions",
  name: "푸른 머리 여행자",
  faces: AUTHORABLE_FACESET_FACE_ASSETS.filter(face => face.sheetResourceId === "shared-blue-traveler-expressions"),
}] as const;

const expressionIds = new Set(FACE_EXPRESSION_SETS.flatMap(set => set.faces.map(face => face.id)));
export function isFaceExpressionResource(assetId: string | undefined): boolean {
  return assetId !== undefined && expressionIds.has(assetId);
}
