import { attemptFishingCatch, fishingSpotAt } from "@/project/fishing";
import { placeableKey } from "@/project/placeables";
import { collectForageAt } from "@/project/seasonalForage";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

type LifeFieldTarget = { readonly mapId: string; readonly x: number; readonly y: number };
export type LifeFieldInteractionResult =
  | { readonly kind: "unhandled" }
  | { readonly kind: "success"; readonly source: "forage" | "fishing"; readonly itemId: string }
  | { readonly kind: "refused"; readonly source: "forage" | "fishing"; readonly reason: string; readonly message: string };

/** Both input authorities call this after events/chests and before farming. */
export function interactWithLifeField(project: Project, session: PlaySession, target: LifeFieldTarget): LifeFieldInteractionResult {
  const object = session.placeables?.[placeableKey(target.mapId, target.x, target.y)];
  if (object?.forageSpawn) {
    const result = collectForageAt(project, session, target.mapId, target.x, target.y);
    return result.ok ? { kind: "success", source: "forage", itemId: result.itemId }
      : { kind: "refused", source: "forage", reason: result.reason, message: refusalMessage("forage", result.reason) };
  }
  if (fishingSpotAt(project, target)) {
    const result = attemptFishingCatch(project, session, target);
    return result.ok ? { kind: "success", source: "fishing", itemId: result.itemId }
      : { kind: "refused", source: "fishing", reason: result.reason, message: refusalMessage("fishing", result.reason) };
  }
  return { kind: "unhandled" };
}

function refusalMessage(source: "forage" | "fishing", reason: string): string {
  if (reason === "energy") return "기력이 부족합니다";
  if (reason === "inventory") return "가방이 가득 찼습니다";
  if (reason === "tool") return "지금 든 도구로는 낚시할 수 없습니다";
  if (reason === "xp") return "생활 기술 기록을 확인할 수 없습니다";
  if (reason === "expired") return "이 채집물은 더 이상 주울 수 없습니다";
  return source === "fishing" ? "지금은 이곳에서 낚시할 수 없습니다" : "이 채집물을 주울 수 없습니다";
}
