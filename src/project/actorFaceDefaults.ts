import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import type { ActorRecord } from "@/project/types";

/**
 * 액터 기본 얼굴 = 걷기 그림의 **검토된 짝**(공용 대응표). 얼굴을 비워 둔 배우가 전투·메뉴·HUD·상점에서 쓴다.
 *
 * 예전엔 "이름이 같은 시트의 0번 칸" 이었다(Actor2 → FaceSet/Actor2-00). 그런데 걷기 시트와 얼굴 시트는
 * 이름이 같아도 짝이 아니다 — Actor2 의 얼굴은 FaceSet/Actor1 의 8~15칸이다. 2026-09-28 전수 조사에서
 * 저장된 배우 얼굴 3,085건 중 2,602건이 이 가정 때문에 틀렸다.
 */
export function defaultActorFaceResourceId(
  actor: Pick<ActorRecord, "id" | "characterResourceId"> & { readonly characterIndex?: number },
): string | undefined {
  const characterResourceId = actor.characterResourceId ?? (actor.id === "actor_hero" ? "easyrpg-charset-actor1" : undefined);
  if (!characterResourceId) return undefined;
  return reviewedFaceIdForCharset(characterResourceId, actor.characterIndex ?? 0);
}

