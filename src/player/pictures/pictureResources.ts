// player/pictures/pictureResources.ts
// 픽처 리소스 해석. resourceId → 렌더 가능한 이미지 URL.
// 오디오(music/sound) 리소스가 그림으로 잘못 참조돼도 이미지로 렌더하지 않도록
// media 종류를 검증한다(audioResources 의 역방향 패턴).

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";

// 이미지로 렌더하면 안 되는 업로드 리소스 kind(오디오). 그 외는 이미지로 취급.
const AUDIO_RESOURCE_KINDS: ReadonlySet<string> = new Set(["music", "sound"]);

// resourceId 를 이미지 URL 로 해석. 없거나 오디오 리소스면 null(텍스트 라벨 폴백 대상).
export function resolvePictureSource(
  resourceId: string | undefined,
  project: Pick<Project, "assets"> | undefined
): string | null {
  if (resourceId === undefined || resourceId.trim().length === 0) return null;
  const uploaded = project?.assets?.uploaded?.[resourceId];
  if (uploaded !== undefined && AUDIO_RESOURCE_KINDS.has(uploaded.kind)) return null;
  return resolveAssetResourceUrl(resourceId, project ? { project } : {});
}
