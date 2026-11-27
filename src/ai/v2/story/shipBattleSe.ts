// 출하 기본값 — 전투 효과음 자리표. 차례는 shipDefaults.applyLookDefaults 가 전투 곡 다음에 부른다.
// 왜(2026-11-26 전투 소리 다양성 분석): 조수가 만든 게임 112종 중 효과음 자리표를 저작한 게임은 0종이라 모든 전투 소리가 EasyRPG RTP 기본음
// (피격 Damage2 하나, 쓰러짐 Collapse2 하나 …)이었다. 번들 CC0 효과음(전량 CC0-1.0, 표기 의무 없음)으로 전투 자리를 채운다.
// 몬스터 수집 게임은 자기 칩튠 세트(monsterSfxAssets)가 기본음이라 건드리지 않는다.
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { usesMonsterSfxSet } from "@/assets/monsterSfxAssets";
import type { Project } from "@/project/types";
import { CORE_BATTLE_SE_CUES } from "../judge/audioVarietyLint";
import { battleSites } from "../judge/combatChecks";

/**
 * 자리 → 번들 CC0 효과음(src/assets/seCatalog.ts 의 「전투 · 타격」「아이템」「UI · 경고」 분류, 제목·길이로 골랐다 — 귀로 검수한 값이 아니다).
 * 시전(cast·magic-*)은 비워 둔다: 기술 애니메이션이 이미 자기 타이밍 소리를 들고 있어 여기서 채우면 한 시전에 소리가 겹친다.
 */
export const SHIP_BATTLE_SE: Readonly<Record<string, string>> = {
  attack: "cc0-se-orp-battle-swing",
  "attack-blunt": "cc0-se-osx-hit-04",
  "attack-pierce": "cc0-se-ors-blade-02",
  "attack-claw": "cc0-se-ors-blade-01",
  damage: "cc0-se-osx-hit-01",
  actorDamage: "cc0-se-osx-hit-02",
  critical: "cc0-se-ors-metal-01",
  miss: "cc0-se-orp-battle-swing3",
  heal: "cc0-se-osx-bell-02",
  defend: "cc0-se-ors-metal-03",
  poison: "cc0-se-orp-npc-slime-slime5",
  buff: "cc0-se-ors-spell-01",
  debuff: "cc0-se-ors-spell-02",
  revive: "cc0-se-osx-bell-03",
};

/** 핵심 자리(CORE_BATTLE_SE_CUES) 가운데 하나라도 저작돼 있으면 저작자가 소리를 골랐다고 보고 건드리지 않는다. */
/** 전투가 나는 게임(몬스터 수집 제외)의 비어 있는 전투 효과음 자리를 번들 CC0 소리로 채운다. 이미 걸린 자리는 그대로. */
export function fillBattleSeCues(project: Project): string[] {
  if (usesMonsterSfxSet(project) || battleSites(project).length === 0) return [];
  const table = project.system.seCues ?? {};
  if (CORE_BATTLE_SE_CUES.some((cue) => table[cue]?.trim())) return [];
  const available = new Set(listAudioResources("sound", project).map((resource) => resource.id));
  const next: Record<string, string> = { ...table };
  const added: string[] = [];
  for (const [cue, resourceId] of Object.entries(SHIP_BATTLE_SE)) {
    if (next[cue]?.trim() || !available.has(resourceId)) continue;
    next[cue] = resourceId;
    added.push(cue);
  }
  if (!added.length) return [];
  project.system.seCues = next;
  return [`전투 효과음 자리 ${added.length}개를 번들 CC0 소리로 채움(${added.join("·")})`];
}
