// project/pictureSources.ts
// 픽처(showPicture) 리소스 칸의 특수 출처. 지금은 하나 — 배우 걷기 그림.

/**
 * 배우 걷기 그림 픽처 — resourceId 를 "actor:<배우 ID>" 로 주면 그 배우가 지금 입은 걷기 그림(아래를 보고 선 칸)을 픽처로 보인다.
 * 성별 선택(Change Actor Graphic)·옷 갈아입기를 따르므로, 「주인공이 작아지며 세계로 들어간다」 같은 연출을 새 그림 없이 만든다.
 * 그림은 24×32 한 칸이 배율 100% 이다(놀이 화면 px).
 */
export const ACTOR_PICTURE_PREFIX = "actor:";

export function actorPictureActorId(resourceId: string | undefined): string | null {
  if (!resourceId?.startsWith(ACTOR_PICTURE_PREFIX)) return null;
  const id = resourceId.slice(ACTOR_PICTURE_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
