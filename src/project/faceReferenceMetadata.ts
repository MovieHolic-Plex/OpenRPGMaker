import { FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { findSharedPortrait, sharedExpressionSetIdOf, sharedPortraitReferenceNote } from "@/assets/sharedPortraitAssets";
import { sharedFaceRow } from "./sharedCharacterFaceResolver";
import type { Project } from "./types";
import previousNames from "@/assets/previousFaceReferenceNames.json";
import { faceLookText } from "@/assets/faceLooks";

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
  // 그림을 보고 적은 나이·종류·외형(faceLooks.ts) — 조수가 이름표만 보고 노인 얼굴을 「젊은」 인물에게, 사람 얼굴을 인형에게 주지 않게
  // 설명 맨 앞에 싣는다(2026-10-25 심사 J35·J30). 저작자가 쓴 그림 메모가 있으면 그것이 먼저다.
  const look = profile?.graphicNote ? undefined : faceLookText(id);
  return {
    name: authoredName ?? face?.label ?? portrait?.name ?? fallbackName,
    description: profile?.graphicNote ?? [look, legacy, face?.note, setId ? sharedPortraitReferenceNote(setId) : ""].filter(Boolean).join(" "),
    searchTerms: [...Object.values(profile?.graphicAttributes ?? face?.attributes ?? {}), ...(look ? [look] : [])],
  };
}
