// player/handSlot.ts
// 손 슬롯(hand slot) 순환 모델. 순수 함수만 — DOM 도 씬도 모른다.
//
// 손에 든 아이템이 농사 의도를 결정한다(farmIntentForHand). 그래서 "무엇을 들 수 있는가"는
// 한 곳에서만 정의해야 한다: 농기구(item.farmTool) + 씨앗(item.type === "seed") 중
// 실제 인벤토리 보유분만.
//
// 빈 손은 목록의 첫 칸으로 반드시 남는다. 빈 손 = 레거시 캐스케이드(수확→경작→파종→물주기)이고,
// 그게 예전 원버튼 조작을 되찾는 유일한 방법이다. 빈 손을 지우면 조작 후퇴다.
import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { setEquippedTool } from "@/project/toolActions";

export type HandSlotEntry = { readonly itemId: string; readonly name: string; readonly count: number };

/** 손에 들 수 있는 아이템(농사 도구 + 씨앗) 순환 목록. 인벤토리 보유분만. */
export function handSlotEntries(project: Project, session: PlaySession): readonly HandSlotEntry[] {
  const tools: HandSlotEntry[] = [];
  const seeds: HandSlotEntry[] = [];
  for (const item of project.database.items) {
    const count = session.inventory[item.id] ?? 0;
    if (count <= 0) continue;
    const entry: HandSlotEntry = { itemId: item.id, name: item.name, count };
    // 도구를 씨앗보다 앞에 두면 순환 순서가 데이터베이스 편집과 무관하게 안정된다.
    if (item.farmTool) tools.push(entry);
    else if (item.type === "seed") seeds.push(entry);
  }
  return [...tools, ...seeds];
}

/** 현재 손에 든 항목의 인덱스. 빈 손이면 0(= 목록의 "빈 손" 칸). */
export function handSlotIndex(project: Project, session: PlaySession): number {
  const equipped = session.equippedToolItemId?.trim();
  if (!equipped) return 0;
  const entries = handSlotEntries(project, session);
  const found = entries.findIndex((entry) => entry.itemId === equipped);
  // 들고 있던 아이템이 소진되면 목록에서 사라진다 → 빈 손으로 취급한다.
  return found < 0 ? 0 : found + 1;
}

/** 현재 손에 든 항목. 빈 손이면 undefined. */
export function handSlotCurrent(project: Project, session: PlaySession): HandSlotEntry | undefined {
  const index = handSlotIndex(project, session);
  return index === 0 ? undefined : handSlotEntries(project, session)[index - 1];
}

/** [빈 손, ...entries] 를 delta 칸 순환 이동한다. */
export function cycleHandSlot(project: Project, session: PlaySession, delta: number): void {
  const entries = handSlotEntries(project, session);
  const size = entries.length + 1;
  const current = handSlotIndex(project, session);
  const step = Math.trunc(delta);
  const next = ((current + step) % size + size) % size;
  setEquippedTool(session, next === 0 ? undefined : entries[next - 1]?.itemId);
}

/**
 * 숫자키 직접 선택. slot 1..9 는 entries[slot - 1], slot 0 은 빈 손.
 * 보유 개수를 넘는 숫자는 아무 일도 하지 않는다(빈 손으로 튕기지 않는다).
 */
export function selectHandSlot(project: Project, session: PlaySession, slot: number): void {
  if (slot === 0) {
    setEquippedTool(session, undefined);
    return;
  }
  const entry = handSlotEntries(project, session)[slot - 1];
  if (!entry) return;
  setEquippedTool(session, entry.itemId);
}
