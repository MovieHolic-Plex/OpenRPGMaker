// presentItem(아이템 제시) 명령의 후보 산출과 재개 분기.
// 정지(commandCatalog)와 재개(resume)가 같은 후보 규칙을 써야 하므로 한 곳에 둔다.
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { changeItem } from "@/project/session";

type PresentItemCommand = Extract<Command, { kind: "presentItem" }>;

export interface PresentableItem {
  readonly itemId: string;
  readonly count: number;
}

/** 목록에 올릴 아이템: 후보(itemIds, 생략 시 소지품 전체) 가운데 1개 이상 가진 것만. */
export function presentableItems(session: PlaySessionLike, command: PresentItemCommand): PresentableItem[] {
  const candidates = command.itemIds ?? Object.keys(session.inventory);
  const seen = new Set<string>();
  const items: PresentableItem[] = [];
  for (const itemId of candidates) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const count = Object.hasOwn(session.inventory, itemId) ? session.inventory[itemId] ?? 0 : 0;
    if (count > 0) items.push({ itemId, count });
  }
  return items;
}

/**
 * 재개 값(고른 itemId)으로 실행할 분기를 고른다.
 * 목록에 없던 id(미소지·후보 밖)나 문자열이 아닌 값은 닫은 것으로 본다.
 * consume 이면 맞는 아이템을 낸 경우에만 1개 소모한다.
 */
export function presentItemBranch(session: PlaySessionLike, command: PresentItemCommand, value: unknown): Command[] {
  const itemId = typeof value === "string" ? value : undefined;
  if (!itemId || !presentableItems(session, command).some((item) => item.itemId === itemId)) {
    return command.cancelBranch ?? [];
  }
  const option = command.options.find((entry) => entry.itemId === itemId);
  if (!option) return command.otherwiseBranch ?? [];
  if (command.consume === true) changeItem(session, itemId, "-=", 1);
  return option.branch;
}
