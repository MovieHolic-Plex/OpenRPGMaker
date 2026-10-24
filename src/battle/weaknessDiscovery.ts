/**
 * 적 약점은 플레이어가 알아 가는 것(2026-10-25, 사용자 「스킬 설명에서 몬스터의 약점까지 알려주는 건 좀… 알아가는 재미가 있는 거 아니냐」).
 *
 * - 공개 전에는 기술 한 줄·도움말·대상 고르기 어디에도 「이 적이 무엇에 약한가」를 보이지 않는다.
 * - 처음으로 적 종류에 약점·저항 속성(또는 물리·마법 피해 종류)을 맞히는 그 타격이 **발견**이다 — 숫자 위 「약점 발견!」.
 *   적 종류(레코드 id)마다 세이브에 남는다: `session.knownWeaknesses[enemyRecordId][key] = 배율`.
 *   key 는 `element:<속성 id>` 또는 `type:physical|magic`. 배율 1(보통)은 남기지 않는다.
 * - 발견한 뒤 대상 고르기에서 보일지는 설정 `system.battleStaging.revealWeakness`:
 *   never(안 보임) · afterDiscovery(기본, 발견한 것만) · always(처음부터).
 */
import type { Project } from "@/project/types";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import { battleEffectivenessMultiplier, damageTypeMultiplier } from "@/battle/battleElementModifiers";

export type KnownWeaknesses = Record<string, Record<string, number>>;

export interface EffectivenessPart {
  readonly key: string;
  readonly rate: number;
}

type Target = MutableBattler | BattleBattlerSnapshot;

/** 한 타격의 상성을 속성·피해 종류로 나눈다(배율 1 은 뺀다). 곱이 엔트리 effectiveness 와 같다. */
export function effectivenessParts(project: Project, elementId: string | undefined, kind: "physical" | "magic", target: Target): EffectivenessPart[] {
  const parts: EffectivenessPart[] = [];
  const element = battleEffectivenessMultiplier(project, elementId, target);
  if (elementId && Number.isFinite(element) && element !== 1) parts.push({ key: `element:${elementId}`, rate: element });
  const type = damageTypeMultiplier(project, kind, target, elementId);
  if (Number.isFinite(type) && type !== 1) parts.push({ key: `type:${kind}`, rate: type });
  return parts;
}

/** 새로 알게 된 칸이 있으면 기록하고 true. 이미 아는 칸은 배율만 갱신(상태로 바뀐 값이 아니라 레코드 기준이 아니므로 최근 값). */
export function recordWeaknessDiscovery(known: KnownWeaknesses, enemyRecordId: string, parts: readonly EffectivenessPart[]): boolean {
  if (!enemyRecordId || parts.length === 0) return false;
  const row = (known[enemyRecordId] ??= {});
  let fresh = false;
  for (const part of parts) {
    if (!(part.key in row)) fresh = true;
    row[part.key] = part.rate;
  }
  return fresh;
}

export type WeaknessReveal = "weak" | "resist" | "immune";

function classify(rate: number): WeaknessReveal | undefined {
  if (!Number.isFinite(rate) || rate === 1) return undefined;
  return rate <= 0 ? "immune" : rate > 1 ? "weak" : "resist";
}

/**
 * 대상 고르기 표시 — 이 공격(속성·피해 종류)이 이 적에게 어떤지. 설정·발견 여부에 따라 모르면 undefined.
 * afterDiscovery: 아는 칸만 곱한다(속성은 몰라도 물리 저항을 알면 그것만).
 */
export function revealedEffectiveness(
  project: Project,
  mode: "never" | "afterDiscovery" | "always",
  known: KnownWeaknesses | undefined,
  target: Target,
  elementId: string | undefined,
  kind: "physical" | "magic",
): WeaknessReveal | undefined {
  if (mode === "never") return undefined;
  const parts = effectivenessParts(project, elementId, kind, target);
  if (mode === "always") return classify(parts.reduce((product, part) => product * part.rate, 1));
  const row = known?.[target.recordId];
  if (!row) return undefined;
  const knownParts = parts.filter((part) => part.key in row);
  if (knownParts.length === 0) return undefined;
  return classify(knownParts.reduce((product, part) => product * part.rate, 1));
}

export const WEAKNESS_REVEAL_LABEL: Readonly<Record<WeaknessReveal, string>> = { weak: "약점", resist: "저항", immune: "무효" };
