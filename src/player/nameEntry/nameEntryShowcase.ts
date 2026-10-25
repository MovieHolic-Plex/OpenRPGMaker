// player/nameEntry/nameEntryShowcase.ts
// enterHeroName presentation:"showcase" — 이름을 지을 주인공의 걷기 그림을 찾는다(옷 갈아입기·성별 선택 덮어쓰기 반영).
// 그림 URL 을 못 풀면 null: 오버레이는 별빛 배경과 반짝이만 보인다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type NameEntryShowcaseHero = { readonly spriteUrl: string; readonly characterIndex: number };

export function nameEntryShowcaseHero(project: Project, session: PlaySession, actorId: string): NameEntryShowcaseHero | null {
  const id = actorId || session.partyActorIds[0];
  if (!id) return null;
  const sprite = resolvePlayerSpriteResource(project, { ...session, vehicle: undefined, partyActorIds: [id] });
  const spriteUrl = resolveAssetResourceUrl(sprite.resourceId, { project });
  return spriteUrl ? { spriteUrl, characterIndex: sprite.characterIndex } : null;
}
