import { FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitReferenceNote } from "@/assets/sharedPortraitAssets";
import { sharedFaceRow } from "./sharedCharacterFaceResolver";
import type { Project } from "./types";
import previousNames from "@/assets/previousFaceReferenceNames.json";

type FaceProject = Pick<Project, "assets" | "resourceProfiles">;

/** Known empty/generated cells stay resolvable for saved data, but are not proposals. */
export function isAuthorableFaceReference(id: string, project: FaceProject): boolean {
  return Boolean(project.assets.uploaded?.[id]) || !GENERATED_FACESET_FACE_IDS.has(id);
}

/** Names and notes describe these pixels. Uploaded replacements never inherit bundle traits. */
export function faceReferenceMetadata(id: string, fallbackName: string, project: FaceProject): {
  name: string; description: string; searchTerms: readonly string[];
} {
  const uploaded = project.assets.uploaded?.[id];
  const profile = project.resourceProfiles.find(row => row.kind === "faceset" && row.assetId === id);
  const asset = FACESET_FACE_ASSETS.find(row => row.id === id);
  const previousName = (previousNames as Readonly<Record<string, string>>)[id];
  const authoredName = profile?.name && profile.name !== asset?.name
    && (uploaded || profile.name !== previousName) ? profile.name : undefined;
  if (uploaded) return {
    name: authoredName ?? uploaded.name ?? fallbackName,
    description: profile?.graphicNote ?? "사용자 업로드 얼굴. 공용 원본과 별도 그림이다.",
    searchTerms: Object.values(profile?.graphicAttributes ?? {}),
  };
  const face = sharedFaceRow(id);
  const portrait = findSharedPortrait(id);
  const setId = sharedExpressionSetIdOf(id);
  const legacy = id === "generated-face-actor1-full"
    ? "실제 그림은 흉상이다. 이 옛 ID의 full은 전신 그림이 아닌 배치 방식이다."
    : id === "generated-face-actor1-bust" ? "실제 그림은 흉상이다." : undefined;
  return {
    name: authoredName ?? face?.label ?? portrait?.name ?? fallbackName,
    description: profile?.graphicNote ?? [legacy, face?.note, setId ? sharedPortraitReferenceNote(setId) : ""].filter(Boolean).join(" "),
    searchTerms: Object.values(profile?.graphicAttributes ?? face?.attributes ?? {}),
  };
}
