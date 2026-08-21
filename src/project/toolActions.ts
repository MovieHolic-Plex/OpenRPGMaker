// Opt-in tool→world action table.
// - system.toolActions empty/absent → default hoe till / wateringCan water / axe chop / pickaxe mine
// - session.equippedToolItemId set → ONLY that item may satisfy tool checks (hand slot)
// - equipped empty → any matching inventory item (legacy convenience)
// - equipped item that is NOT a farmTool (씨앗 등) → satisfies no farmTool check; 농사 의도는
//   `farmIntentForHand` 가 판단하고, 도구가 필요한 분기는 여기서 막혀 ignored 사유로 남는다.
import type { FarmTool, GameMap, ItemId, Project, Rect } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { placeableKey } from "@/project/placeables";

export type ToolWorldAction =
  | "till"
  | "water"
  | "chop"
  | "mine"
  | "fish"
  | "harvest";

export type ToolActionRule = {
  readonly id: string;
  readonly farmTool?: FarmTool;
  readonly itemId?: ItemId;
  /** When true, tile must be in map.farmableArea. Default true for till/water. */
  readonly requiresFarmable?: boolean;
  /** placeables kind that this action targets (chop→tree, mine→rock). */
  readonly targetPlaceableKind?: string;
  readonly action: ToolWorldAction;
};

export type ResolvedToolUse = {
  readonly itemId: ItemId;
  readonly farmTool?: FarmTool;
  readonly action: ToolWorldAction;
  readonly ruleId: string;
};

const DEFAULT_FARM_RULES: readonly ToolActionRule[] = [
  { id: "legacy-hoe-till", farmTool: "hoe", requiresFarmable: true, action: "till" },
  { id: "legacy-can-water", farmTool: "wateringCan", requiresFarmable: true, action: "water" },
  { id: "legacy-axe-chop", farmTool: "axe", requiresFarmable: false, targetPlaceableKind: "tree", action: "chop" },
  { id: "legacy-pick-mine", farmTool: "pickaxe", requiresFarmable: false, targetPlaceableKind: "rock", action: "mine" },
];

export function toolActionRulesOf(project: Project): readonly ToolActionRule[] {
  const authored = project.system.toolActions;
  if (authored && authored.length > 0) return authored;
  return DEFAULT_FARM_RULES;
}

/**
 * 실제로 보유한 장착 아이템만 "손에 든 것"으로 본다. 손 슬롯 HUD(handSlotEntries)와 같은 정의여야 한다 —
 * 마지막 씨앗을 심으면 칩은 「빈 손」이 되는데 equippedToolItemId 는 그대로 남아, 그 유령 id 가
 * 도구 해석을 마지 면 생산토지에서 물주기·경작이 모두 조용하게 실패한다.
 */
export function heldToolItemId(session: PlaySession): ItemId | undefined {
  const equipped = session.equippedToolItemId?.trim();
  if (!equipped) return undefined;
  return (session.inventory[equipped] ?? 0) > 0 ? equipped : undefined;
}

/**
 * Resolve which inventory item satisfies a farmTool kind.
 * If hand is equipped, only the equipped item may match; a non-farmTool hand item matches nothing.
 */
export function resolveEquippedOrInventoryToolItemId(
  project: Project,
  session: PlaySession,
  farmTool: FarmTool
): ItemId | undefined {
  const equipped = heldToolItemId(session);
  if (equipped) {
    const item = project.database.items.find((entry) => entry.id === equipped);
    if (item?.farmTool === farmTool) return equipped;
    return undefined;
  }
  const found = project.database.items.find(
    (item) => item.farmTool === farmTool && (session.inventory[item.id] ?? 0) > 0
  );
  return found?.id;
}

export function hasFarmToolAvailable(project: Project, session: PlaySession, farmTool: FarmTool): boolean {
  return resolveEquippedOrInventoryToolItemId(project, session, farmTool) !== undefined;
}

function ruleMatchesInventory(
  project: Project,
  session: PlaySession,
  rule: ToolActionRule
): { itemId: ItemId; farmTool?: FarmTool } | undefined {
  const equipped = heldToolItemId(session);
  if (rule.itemId) {
    if ((session.inventory[rule.itemId] ?? 0) <= 0) return undefined;
    if (equipped && equipped !== rule.itemId) return undefined;
    const item = project.database.items.find((entry) => entry.id === rule.itemId);
    return { itemId: rule.itemId, farmTool: item?.farmTool };
  }
  if (rule.farmTool) {
    const itemId = resolveEquippedOrInventoryToolItemId(project, session, rule.farmTool);
    if (!itemId) return undefined;
    return { itemId, farmTool: rule.farmTool };
  }
  return undefined;
}

export function resolveToolUseOnTile(
  project: Project,
  session: PlaySession,
  map: GameMap,
  x: number,
  y: number,
  preferredAction?: ToolWorldAction
): ResolvedToolUse | undefined {
  const farmable = isTileFarmable(map, x, y);
  const key = placeableKey(map.id, x, y);
  const placeable = session.placeables?.[key];

  for (const rule of toolActionRulesOf(project)) {
    if (preferredAction && rule.action !== preferredAction) continue;

    const needsFarmable =
      rule.requiresFarmable === true ||
      (rule.requiresFarmable !== false && (rule.action === "till" || rule.action === "water"));
    if (needsFarmable && !farmable) continue;

    if (rule.targetPlaceableKind) {
      if (!placeable || placeable.kind !== rule.targetPlaceableKind) continue;
    }

    const match = ruleMatchesInventory(project, session, rule);
    if (!match) continue;
    return {
      itemId: match.itemId,
      farmTool: match.farmTool,
      action: rule.action,
      ruleId: rule.id,
    };
  }
  return undefined;
}

/** True when authored table (not only defaults) is present. */
export function hasAuthoredToolActions(project: Project): boolean {
  return Array.isArray(project.system.toolActions) && project.system.toolActions.length > 0;
}

export function setEquippedTool(session: PlaySession, itemId: ItemId | undefined): void {
  if (!itemId?.trim()) {
    delete session.equippedToolItemId;
    return;
  }
  session.equippedToolItemId = itemId.trim();
}
function isTileFarmable(map: GameMap, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return false;
  }
  return (map.farmableArea ?? []).some((rect) => rectContainsTile(rect, x, y));
}

function rectContainsTile(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
