// presentItem(아이템 제시) 명령의 후보 산출과 재개 분기.
// 정지(commandCatalog)와 재개(resume)가 같은 후보 규칙을 써야 하므로 한 곳에 둔다.
import { isKeyItem } from "@/player/playerBagPockets";
import type { Command, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { changeItem } from "@/project/session";

type PresentItemCommand = Extract<Command, { kind: "presentItem" }>;

export interface PresentableItem {
  readonly itemId: string;
  readonly count: number;
}

/**
 * 목록에 올릴 아이템: 후보(itemIds) 가운데 1개 이상 가진 것만.
 * itemIds 를 생략하고 정답(options[].itemId)이 모두 「중요한 물건」(isKeyItem — pocket key, 또는 쓸 곳 없고 가격 0)이면
 * 증거를 내미는 자리다 — 소지한 중요한 물건만 띄워 회복약·돈 될 물건이 섞이지 않는다.
 * 정답에 보통 물건이 있거나(약을 건네는 자리) 정답이 없으면 소지품 전체 그대로다.
 * 정지(commandCatalog)와 재개(resume)가 같은 project 를 넘겨야 같은 목록이 된다.
 */
export function presentableItems(session: PlaySessionLike, command: PresentItemCommand, project?: Pick<Project, "database">): PresentableItem[] {
  const candidates = command.itemIds ?? defaultCandidates(session, command, project);
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

function defaultCandidates(session: PlaySessionLike, command: PresentItemCommand, project: Pick<Project, "database"> | undefined): string[] {
  const owned = Object.keys(session.inventory);
  if (!project || command.options.length === 0) return owned;
  const keyIds = new Set(project.database.items.filter(isKeyItem).map((item) => item.id));
  return command.options.every((option) => keyIds.has(option.itemId)) ? owned.filter((itemId) => keyIds.has(itemId)) : owned;
}

/**
 * 재개 값(고른 itemId)으로 실행할 분기를 고른다.
 * 목록에 없던 id(미소지·후보 밖)나 문자열이 아닌 값은 닫은 것으로 본다.
 * consume 이면 맞는 아이템을 낸 경우에만 1개 소모한다.
 */
export function presentItemBranch(session: PlaySessionLike, command: PresentItemCommand, value: unknown, project?: Pick<Project, "database">): Command[] {
  const itemId = typeof value === "string" ? value : undefined;
  if (!itemId || !presentableItems(session, command, project).some((item) => item.itemId === itemId)) {
    return command.cancelBranch ?? [];
  }
  const option = command.options.find((entry) => entry.itemId === itemId);
  if (!option) return command.otherwiseBranch ?? [];
  if (command.consume === true) changeItem(session, itemId, "-=", 1);
  return option.branch;
}
