// 액션 스킬 슬롯 순수 규칙.
// 예전에는 씬이 배운 스킬 목록에서 actionSkill 프로필이 붙은 **첫 번째**를 find 로
// 집어 캐스트했다. 스킬을 여러 개 배워도 두 번째 이후는 영원히 닿지 않았다.
// 여기서 슬롯 목록(순서·중복 제거·상한)과 순환/활성 해석만 정한다 — 씬/Phaser 무관.

/** 동시에 들 수 있는 액션 스킬 수. 순환 키 한 번으로 다 돌 수 있는 크기로 묶는다. */
export const ACTION_SKILL_SLOT_MAX = 3;

/**
 * 배운 스킬 순서를 그대로 유지하면서 액션 스킬만 골라 슬롯에 채운다.
 * 중복 id 는 한 번만, 상한을 넘으면 뒤는 버린다.
 */
export function resolveActionSkillSlots(
  learnedSkillIds: readonly string[],
  isActionSkill: (skillId: string) => boolean
): string[] {
  const slots: string[] = [];
  for (const skillId of learnedSkillIds) {
    if (slots.length >= ACTION_SKILL_SLOT_MAX) break;
    if (typeof skillId !== "string" || skillId.length === 0) continue;
    if (slots.includes(skillId)) continue;
    if (!isActionSkill(skillId)) continue;
    slots.push(skillId);
  }
  return slots;
}

/** 범위를 벗어난(슬롯이 줄어든 뒤 남은) 인덱스는 0 번으로 스냅한다. */
function normalizeSlot(activeSlot: number, slotCount: number): number {
  if (slotCount <= 0) return 0;
  if (!Number.isInteger(activeSlot) || activeSlot < 0 || activeSlot >= slotCount) return 0;
  return activeSlot;
}

/** 다음(delta<0 이면 이전) 슬롯으로 순환한다. 슬롯이 0~1 개면 항상 0. */
export function cycleActionSkillSlot(activeSlot: number, slotCount: number, delta = 1): number {
  if (slotCount <= 1) return 0;
  const current = normalizeSlot(activeSlot, slotCount);
  if (current !== activeSlot) return current;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 1;
  return ((current + step) % slotCount + slotCount) % slotCount;
}

/** 활성 슬롯의 스킬 id. 슬롯이 없으면 undefined. */
export function activeActionSkillId(slots: readonly string[], activeSlot: number): string | undefined {
  if (slots.length === 0) return undefined;
  return slots[normalizeSlot(activeSlot, slots.length)];
}
