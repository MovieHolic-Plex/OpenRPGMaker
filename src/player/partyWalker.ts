// player/partyWalker.ts — 파티원을 필드와 같은 걷기 그림으로 정면 보행시킨다.
//
// 상점 파티 창(playSceneShopParts.shopPartyWalker)에서 처음 만들었고, ESC 메뉴·여관·전투 결과가 같은
// 도트 창 컨셉(RPG_RT Window_ShopParty 계열)으로 통일되면서 공용으로 뺐다. 프레임 위치는 CSS 변수
// (--party-walk-0/1/2)로 넘기고 CSS 가 순환한다 — 타이머가 없어서 창이 닫히면 같이 사라진다.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { applyCharsetFrameCrop, charsetFrameCropPosition } from "@/assets/charsetFrameCrop";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import { resolveActorAppearance } from "@/project/characterAppearances";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type PartyWalkerOptions = {
  readonly className?: string;
  readonly testId?: string;
};

/**
 * 한 파티원의 정면 걷기 그림. 업로드 charset 처럼 URL 을 못 푸는 그림이면 null(호출부가 얼굴로 대신한다).
 * 탈것에 탄 상태여도 사람 그림을 쓴다 — 세션 사본에서 탈것을 뗀다.
 */
export function partyWalker(project: Project, session: PlaySession, actorId: string, label: string, options: PartyWalkerOptions = {}): HTMLElement | null {
  const actor = project.database.actors.find((entry) => entry.id === actorId);
  if (!actor) return null;
  const sprite = resolvePlayerSpriteResource(project, { ...session, vehicle: undefined, partyActorIds: [actorId] });
  const url = resolveAssetResourceUrl(sprite.resourceId, { project });
  if (!url) return null;
  const override = session.actorCharacterResourceIds?.[actorId];
  const requested = override ?? resolveActorAppearance(project, actor)?.characterResourceId;
  const requestedId = requested ? findCharsetAsset(requested)?.id ?? requested : undefined;
  const characterIndex = override !== undefined || requestedId === sprite.resourceId ? sprite.characterIndex : 0;
  const node = el("span", {
    class: `party-walker${options.className ? ` ${options.className}` : ""}`,
    attrs: { role: "img", "aria-label": label },
    dataset: { ...(options.testId ? { testid: options.testId } : {}), characterResourceId: sprite.resourceId },
  });
  applyCharsetFrameCrop(node, url, { characterIndex, direction: "down", pattern: 1 }, 1);
  // 이름을 리터럴로 쓴다 — CSS 예산 게이트(check-css-budget undefinedVars)가 setProperty("--x") 로 정의를 찾는다.
  node.style.setProperty("--party-walk-0", charsetFrameCropPosition({ characterIndex, direction: "down", pattern: 0 }, 1));
  node.style.setProperty("--party-walk-1", charsetFrameCropPosition({ characterIndex, direction: "down", pattern: 1 }, 1));
  node.style.setProperty("--party-walk-2", charsetFrameCropPosition({ characterIndex, direction: "down", pattern: 2 }, 1));
  return node;
}

