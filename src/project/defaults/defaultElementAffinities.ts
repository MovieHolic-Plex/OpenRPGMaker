// 새 프로젝트 기본 적의 속성 상성 예시(qa1124 항목 8-3, 오너 2026-11-24 «망치로는 골렘 같은 몬스터를 쉽게 잡는다 이런 설정»).
//
// 예전 기본 적 106종은 모든 속성이 보통(C)이라 약점이 있는 적이 하나도 없었고, 속성 탭이 무엇을 위한 것인지 예시가 없었다.
// 적 id 꼬리의 종류 낱말로 상성을 정한다: 골렘·돌 ← 타격 2배, 슬라임 ← 화염 2배, 망령·해골 ← 신성 2배 …
// 새 프로젝트(createBlankProject)에서만 부른다 — 저장된 프로젝트·폴른 스타 같은 게임의 균형은 바꾸지 않는다.
// 작가가 이미 정한 등급(C 가 아닌 값)은 덮지 않는다. 그 속성이 프로젝트에 없으면 건너뛴다.
import type { ActorRateGrade, DatabaseElementRecord, EnemyRecord } from "../types";

type Rule = { readonly match: RegExp; readonly rates: Readonly<Record<string, ActorRateGrade>> };

/** 위에서부터 맞는 규칙을 모두 적용하되, 앞 규칙이 정한 속성은 뒤 규칙이 바꾸지 않는다. */
export const DEFAULT_ELEMENT_AFFINITY_RULES: readonly Rule[] = [
  { match: /^eel_electric$/u, rates: { earth: "A", thunder: "E" } },
  { match: /golem|gargoyle|ape_stone|totem|crab_rock|armor_living|puppet_string|sword_flying|mimic/u, rates: { hit: "A", sword: "D", spear: "D" } },
  { match: /slime|ooze|jelly_cube|slime_cube/u, rates: { fire: "A", hit: "D" } },
  { match: /ghost|skeleton|skel|zombie|ghoul|mummy|banshee|wraith|lich|revenant|bonepile|spirit_dark|knight_fallen/u, rates: { holy: "A", dark: "E" } },
  { match: /frost|yeti|ice/u, rates: { fire: "A", ice: "E" } },
  { match: /plant|leafling|scarecrow|mantis/u, rates: { fire: "A" } },
  { match: /fire|flame|salamander|hound_hell|phoenix|dragon_red|ember/u, rates: { water: "A", fire: "E" } },
  { match: /water|undine|squid|shark|fish|jelly_lantern|well_olm/u, rates: { thunder: "A", water: "E" } },
  { match: /bat|bird|hawk|harpy|griffin|roc_giant|bee|moth|wyvern/u, rates: { bow: "A" } },
  { match: /dragon|hydra/u, rates: { spear: "B" } },
];

/** 기본 적에 예시 상성을 싣는다. 바꾼 적 수. */
export function applyDefaultElementAffinities(enemies: EnemyRecord[], elements: readonly DatabaseElementRecord[]): number {
  const known = new Set(elements.map((element) => element.id));
  let changed = 0;
  for (const enemy of enemies) {
    const tail = enemy.id.replace(/^enemy_/u, "");
    const rates = { ...enemy.elementRates };
    const decided = new Set<string>();
    let touched = false;
    for (const rule of DEFAULT_ELEMENT_AFFINITY_RULES) {
      if (!rule.match.test(tail)) continue;
      for (const [elementId, grade] of Object.entries(rule.rates)) {
        if (!known.has(elementId) || decided.has(elementId)) continue;
        decided.add(elementId);
        const current = rates[elementId];
        if (current !== undefined && current !== "C") continue;
        rates[elementId] = grade;
        touched = true;
      }
    }
    if (!touched) continue;
    enemy.elementRates = rates;
    changed++;
  }
  return changed;
}
