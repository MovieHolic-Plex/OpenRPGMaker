// 폴른 스타 전투 헤드리스 밸런스 — 구운 project.json 으로 트룹마다 자동 전투 AI(기술 사용)를 n판 돌린다.
//   node_modules/.bin/vite-node --script scripts/qa/fallen-battle-sim.mts /tmp/fsb/demos/chrono-bell.project.json [n]
// 출력: 트룹·레벨·파티별 승률, 평균 차례, 남은 HP, 페이즈 발동, 기술 사용 상위.
import { readFileSync } from "node:fs";
import { simulateBattle } from "@/battle/simulate";
import type { Project } from "@/project/types";

const path = process.argv[2] ?? "/tmp/fsb/demos/chrono-bell.project.json";
const n = Number(process.argv[3] ?? 40);
const project = JSON.parse(readFileSync(path, "utf8")) as Project;
// 조정 실험: FS_SIM_ENEMY="enemy_fs_valen:maxHp=1500,attack=100" 처럼 적 능력치를 덮어 본다(구운 파일은 그대로).
for (const spec of (process.env.FS_SIM_ENEMY ?? "").split(";").filter(Boolean)) {
  const [id, body] = spec.split(":");
  const enemy = project.database.enemies.find((e) => e.id === id) as unknown as Record<string, unknown> | undefined;
  if (!enemy) throw new Error(`no enemy ${id}`);
  for (const pair of body.split(",")) {
    const [key, value] = pair.split("=");
    const params = (enemy.stats ?? enemy.params) as Record<string, number> | undefined;
    if (params && key in params) params[key] = Number(value); else enemy[key] = Number(value);
  }
}
const cases0 = process.env.FS_SIM_ONLY;
const duo = ["actor_hero", "actor_fs_elena"];
const trio = ["actor_hero", "actor_fs_elena", "actor_fs_iris"];
const cases: Array<{ troopId: string; level: number; party: string[] }> = [
  { troopId: "troop_fs_wolves", level: 6, party: duo },
  { troopId: "troop_fs_spiders", level: 6, party: duo },
  { troopId: "troop_fs_wisps", level: 6, party: duo },
  { troopId: "troop_fs_finale", level: 8, party: trio },
  { troopId: "troop_fs_finale", level: 9, party: trio },
];
for (const c of cases.filter((x) => !cases0 || x.troopId.endsWith(cases0))) {
  const result = simulateBattle({
    project, troopId: c.troopId, heroLevel: c.level, partyActorIds: c.party, n, seed: 7, useSkills: true,
    inventory: { item_potion: 5, item_hi_potion: 1, item_ether: 2 }, potionItemId: "item_potion", maxSteps: 8000,
  });
  const top = Object.entries(result.skillUses).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, k]) => `${id.replace(/^skill_/, "")}:${k}`).join(" ");
  console.log(JSON.stringify({
    troop: c.troopId, lv: c.level, party: c.party.length, win: result.winRate, turns: Math.round(result.avgTurns * 10) / 10,
    hpLeft: Math.round(result.avgHpRemaining), potions: Math.round(result.avgPotionsUsed * 10) / 10,
    phases: result.phaseCoverage.map((p) => `${p.pageId.replace("troop_fs_finale_", "")}:${p.firedRuns}/${n}@r${p.firstRound ?? "-"}`).join(" "),
    top,
  }));
}
