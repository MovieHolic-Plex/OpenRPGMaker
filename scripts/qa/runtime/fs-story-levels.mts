// 폴른 스타 — 이야기 순서로 「그 전투에 도달했을 때의 레벨·골드·장비 티어」를 낸다(2026-11-07, broad QA 레인).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/fs-story-levels.mts <project.json> <out.json>
// 순서·파티·이야기 장비의 정본은 scripts/qa/runtime/fs-mob-balance-lib.mts 의 ACTS 다 — 이 표를 손으로 고치지 말고 다시 낸다.
// 출력은 scripts/qa/pipeline/data/story-levels.json 이고, QA 파이프라인(lib/plan.mjs)이 체크포인트 레벨로 쓴다.
//   level    = 그 전투가 시작될 때의 파티 레벨(앞선 싸움의 경험치를 누적)
//   gold     = 그때까지 모은 골드(상점 구입 여력)
//   gearTier = 0 처음 장비 / 1 대장간 방어구 / 2 방어구 + 가장 센 무기
import { readFileSync, writeFileSync } from "node:fs";
import { ACTS } from "./fs-mob-balance-lib.mts";
import { ARMOR, WEAPONS } from "./fs-gear-lib.mts";
import { totalExpForLevel } from "../../../src/project/actorModel";

type Project = {
  database: {
    actors: { id: string; expCurve: { base: number; extra: number; acceleration: number } }[];
    troops: { id: string; enemyIds: string[] }[];
    enemies: { id: string; rewards?: { exp?: number; gold?: number } }[];
  };
};

const [projectPath, outPath] = process.argv.slice(2);
if (!projectPath || !outPath) throw new Error("usage: fs-story-levels.mts <project.json> <out.json>");
const project = JSON.parse(readFileSync(projectPath, "utf8")) as Project;
const hero = project.database.actors.find((actor) => actor.id === "actor_hero");
if (!hero?.expCurve) throw new Error("actor_hero expCurve is missing");
const curve = hero.expCurve;

const levelFor = (exp: number): number => {
  let level = 1;
  while (level < 99 && totalExpForLevel(curve, level + 1) <= exp) level += 1;
  return level;
};
const enemyOf = (id: string) => project.database.enemies.find((enemy) => enemy.id === id);
const troopTotals = (troopId: string): { exp: number; gold: number } => {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  return (troop?.enemyIds ?? []).reduce(
    (sum, enemyId) => {
      const rewards = enemyOf(enemyId)?.rewards ?? {};
      return { exp: sum.exp + (rewards.exp ?? 0), gold: sum.gold + (rewards.gold ?? 0) };
    },
    { exp: 0, gold: 0 },
  );
};

/** 1막 대장간에서 산 뒤의 티어 — fs-gear-balance.mts 의 BUY_FROM 과 같은 지점. */
const BUY_FROM = process.env.BUY_FROM ?? "troop_fs_inq_zeal";

const byTroop: Record<string, unknown> = {};
let exp = 0;
let gold = 0;
for (const act of ACTS) {
  if (typeof act.startLevel === "number") {
    exp = totalExpForLevel(curve, act.startLevel);
    gold = 0;
  }
  for (const step of act.steps) {
    const gearTier = act.act === "2막" ? 2 : act.steps.findIndex((entry) => entry.troop === BUY_FROM) >= 0 && act.steps.indexOf(step) >= act.steps.findIndex((entry) => entry.troop === BUY_FROM) ? 1 : 0;
    byTroop[step.troop] = {
      act: act.act,
      map: step.map,
      kind: step.kind ?? null,
      party: step.party,
      level: levelFor(exp),
      exp,
      gold,
      gearTier,
      // 이야기가 쥐여 주는 장비(act2Opening 의 로한의 창)는 티어와 별개로 항상 적용된다.
      storyGear: step.gear ?? null,
    };
    const totals = troopTotals(step.troop);
    exp += totals.exp;
    gold += totals.gold;
  }
}

const data = {
  game: "fallen-star",
  generatedAt: new Date().toISOString(),
  source: "scripts/qa/runtime/fs-story-levels.mts (ACTS story order + troop rewards; gear tiers from fs-gear-lib)",
  gearSets: { 1: ARMOR, 2: { ...ARMOR, ...Object.fromEntries(Object.entries(WEAPONS).map(([actorId, gear]) => [actorId, { ...(ARMOR[actorId] ?? {}), ...gear }])) } },
  byTroop,
};
writeFileSync(outPath, `${JSON.stringify(data, null, 1)}\n`);
const rows = Object.entries(byTroop) as [string, { act: string; level: number; gearTier: number }][];
console.log(
  `story levels: ${rows.length} troops · Lv${Math.min(...rows.map(([, r]) => r.level))}..Lv${Math.max(...rows.map(([, r]) => r.level))} · tiers ${[...new Set(rows.map(([, r]) => r.gearTier))].sort().join("/")} → ${outPath}`,
);
