// 포켓몬식 지닌 도구(held item). 아이템 레코드의 선택 필드 `heldEffect` 하나가 효과를 선언하고, 파티 몬스터 개체가 도구 id 하나를 지닌다.
// 효과는 다섯 종류의 매개변수 효과뿐이다(자유 코드 없음): 열매형(HP 이하 회복·상태 치료·버티기)은 한 번 쓰면 사라지고 전투가 끝나도 돌아오지 않는다.
// 지금은 gen1 전투 모델(몬스터 수집)에서만 적용한다.
import type { HeldItemEffect, HeldItemEffectKind, HeldItemStatus, ItemRecord, Project } from "@/project/types";

export const HELD_ITEM_KINDS: readonly HeldItemEffectKind[] = ["healBelow", "cureStatus", "boostType", "endureOnce", "regen"];
export const HELD_ITEM_STATUSES: readonly HeldItemStatus[] = ["poison", "burn", "sleep", "freeze", "paralysis", "any"];

export const HELD_ITEM_KIND_LABELS: Readonly<Record<HeldItemEffectKind, string>> = {
  healBelow: "HP 가 줄면 회복(열매)",
  cureStatus: "상태이상 치료(열매)",
  boostType: "같은 타입 기술 강화",
  endureOnce: "한 번 버티기(1회용)",
  regen: "매 차례 조금씩 회복",
};

const STATUS_LABELS: Readonly<Record<HeldItemStatus, string>> = { poison: "독", burn: "화상", sleep: "수면", freeze: "얼음", paralysis: "마비", any: "모든 주요 상태이상" };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, number));
}

/** 필수 매개변수가 빠진 효과는 버린다(undefined) — 반쪽짜리 도구가 조용히 아무 일도 안 하게 두지 않는다. */
export function normalizeHeldItemEffect(raw: unknown): HeldItemEffect | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const kind = record.kind as HeldItemEffectKind;
  if (!HELD_ITEM_KINDS.includes(kind)) return undefined;
  switch (kind) {
    case "healBelow": {
      const healPercent = clampInt(record.healPercent, 0, 100, 0);
      const healFlat = clampInt(record.healFlat, 0, 999, 0);
      // 둘 다 비면 기본 30% 회복(회복이 없는 열매는 의미가 없다).
      return { kind, thresholdPercent: clampInt(record.thresholdPercent, 1, 100, 50), healPercent: healPercent === 0 && healFlat === 0 ? 30 : healPercent, ...(healFlat > 0 ? { healFlat } : {}) };
    }
    case "cureStatus": {
      const status = HELD_ITEM_STATUSES.includes(record.status as HeldItemStatus) ? record.status as HeldItemStatus : "any";
      return { kind, status };
    }
    case "boostType": {
      const type = typeof record.type === "string" ? record.type.trim().slice(0, 40) : "";
      return type ? { kind, type, percent: clampInt(record.percent, 101, 200, 120) } : undefined;
    }
    case "endureOnce":
      return { kind };
    case "regen":
      return { kind, percent: clampInt(record.percent, 1, 25, 6) };
  }
}

export function heldEffectOfItem(project: Project, itemId: string | undefined): HeldItemEffect | undefined {
  if (!itemId) return undefined;
  return project.database.items.find((item) => item.id === itemId)?.heldEffect;
}

/** 아이템 설명 한 줄(저작자 description 이 따로 있어도 효과 요약은 이 줄). */
export function heldEffectText(effect: HeldItemEffect, typeName: (id: string) => string = (id) => id): string {
  switch (effect.kind) {
    case "healBelow": return `HP 가 ${effect.thresholdPercent}% 이하가 되면 먹고 ${[effect.healPercent ? `최대 HP 의 ${effect.healPercent}%` : "", effect.healFlat ? `${effect.healFlat}` : ""].filter(Boolean).join(" + ")} 회복한다(1회용).`;
    case "cureStatus": return `${STATUS_LABELS[effect.status ?? "any"]} 상태가 되면 먹고 낫는다(1회용).`;
    case "boostType": return `${typeName(effect.type!)} 타입 기술의 피해가 ${effect.percent}% 가 된다.`;
    case "endureOnce": return "가득 찬 HP 에서 쓰러질 피해를 받아도 HP 1 로 버틴다(1회용).";
    case "regen": return `매 차례 말에 최대 HP 의 ${effect.percent}% 를 회복한다.`;
  }
}

/** 이 효과가 한 번 쓰면 사라지는 열매형인가. */
export function heldEffectConsumes(effect: HeldItemEffect): boolean {
  return effect.kind === "healBelow" || effect.kind === "cureStatus" || effect.kind === "endureOnce";
}

/** 같은 타입 기술 강화 배율(%). */
export function heldBoostPercent(effect: HeldItemEffect | undefined, moveType: string | undefined): number {
  return effect?.kind === "boostType" && moveType && effect.type === moveType ? effect.percent ?? 120 : 100;
}

/** 열매: HP 가 문턱 이하일 때 회복량(최소 1, 가득 차지 않게). 안 걸리면 0. */
export function heldHealAmount(effect: HeldItemEffect | undefined, hp: number, maxHp: number): number {
  if (effect?.kind !== "healBelow" || hp <= 0 || hp >= maxHp) return 0;
  if (hp * 100 > maxHp * (effect.thresholdPercent ?? 50)) return 0;
  const amount = Math.floor(maxHp * (effect.healPercent ?? 0) / 100) + (effect.healFlat ?? 0);
  return Math.min(maxHp - hp, Math.max(1, amount));
}

/** 매 차례 회복량(최소 1). */
export function heldRegenAmount(effect: HeldItemEffect | undefined, hp: number, maxHp: number): number {
  if (effect?.kind !== "regen" || hp <= 0 || hp >= maxHp) return 0;
  return Math.min(maxHp - hp, Math.max(1, Math.floor(maxHp * (effect.percent ?? 6) / 100)));
}

export function heldCuresStatus(effect: HeldItemEffect | undefined, status: string | undefined): boolean {
  if (effect?.kind !== "cureStatus" || !status) return false;
  return (effect.status ?? "any") === "any" || effect.status === status;
}

/** 버티기 도구: 가득 찬 HP 에서 쓰러질 피해면 HP 1 이 남는 피해로 줄인다. */
export function heldEndureDamage(effect: HeldItemEffect | undefined, hpBefore: number, maxHp: number, damage: number): { readonly damage: number; readonly endured: boolean } {
  if (effect?.kind === "endureOnce" && hpBefore >= maxHp && hpBefore > 1 && damage >= hpBefore) return { damage: hpBefore - 1, endured: true };
  return { damage, endured: false };
}

export function itemHasHeldEffect(item: Pick<ItemRecord, "heldEffect"> | undefined): boolean {
  return Boolean(item?.heldEffect);
}
