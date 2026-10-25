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

/**
 * 배우 걷기 그림 픽처 — resourceId 를 "actor:<배우 ID>" 로 주면 그 배우가 지금 입은 걷기 그림(아래를 보고 선 칸)을 픽처로 보인다.
 * 성별 선택(Change Actor Graphic)·옷 갈아입기를 따르므로, 「주인공이 작아지며 세계로 들어간다」 같은 연출을 그림 없이 만든다.
 */
export const ACTOR_PICTURE_PREFIX = "actor:";

export function actorPictureActorId(resourceId: string | undefined): string | null {
  if (!resourceId?.startsWith(ACTOR_PICTURE_PREFIX)) return null;
  const id = resourceId.slice(ACTOR_PICTURE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
