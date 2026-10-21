// 아스트라 호라이즌 스타터 3종 × 주요 승부 모의전 표(브라우저 없이). node scripts/qa/astra-horizon/balance-sim.mjs
import { simulateBattle } from "@/battle/simulate";
import { createEmeraldCrownFlagshipDemo } from "@/project/flagship/emeraldCrown";
import { monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

const STARTERS = ["mx_species_spriglet", "mx_species_coalbit", "mx_species_rivulet"] as const;
type Fight = { readonly label: string; readonly troopId: string; readonly level: number; readonly partner?: readonly [string, number] };

function mon(project: Project, speciesId: string, level: number, tag: string): MonsterInstance {
  const species = monsterSpeciesById(project, speciesId)!;
  return { instanceId: `sim_${tag}`, speciesId, level, exp: 0, skillIds: monsterSkillIdsAtLevel(species, level), friendship: 0, caughtAt: { mapId: project.startMapId, x: 0, y: 0 } } as MonsterInstance;
}

export function runTable(fights: readonly Fight[], n = 60): string[] {
  const { project } = createEmeraldCrownFlagshipDemo();
  const out: string[] = [];
  for (const fight of fights) {
    const cells: string[] = [];
    for (const starter of STARTERS) {
      const party = [mon(project, starter, fight.level, "a")];
      if (fight.partner) party.push(mon(project, fight.partner[0], fight.partner[1], "b"));
      const maxHp = party.reduce((sum) => sum, 0);
      const r = simulateBattle({ project, troopId: fight.troopId, heroLevel: fight.level, monsterParty: party, n, seed: 7, useSkills: true });
      void maxHp;
      cells.push(`${starter.replace("mx_species_", "").padEnd(8)} win ${(r.winRate * 100).toFixed(0).padStart(3)}% turns ${r.avgTurns.toFixed(1).padStart(4)} hpLeft ${r.avgHpRemaining.toFixed(1).padStart(5)}`);
    }
    out.push(`${fight.label}\n  ${cells.join("\n  ")}`);
  }
  return out;
}
