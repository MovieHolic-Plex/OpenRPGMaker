// 폴른 스타 — 화면 없는 전투 시뮬 트랙(broad QA 2026-11-07). 부대 × 3상태(예상/−3/+3)를 수백 판씩 돌려
// 승률·턴·남은 HP·회복약·전멸을 낸다. 스크린샷 트랙과 같은 상태 정의를 쓰려고 레벨·장비 티어는
// scripts/qa/pipeline/data/story-levels.json(이야기 순서 누적)에서 읽는다.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/broad/battle-sim.mts <project.json> [n] [out.json]
// env: STATES=expected,weak,strong · TROOPS=id,id(쉼표) · SEED=7 · SKILLS=1(자동 전투 AI)
import { readFileSync, writeFileSync } from "node:fs";
import { simulateBattle } from "../../../src/battle/simulate";
import { parameterValueAtLevel } from "../../../src/project/actorModel";
import type { ActorInitialEquipment, Project } from "../../../src/project/types";

type StoryEntry = { act: string; map: string; kind: string | null; party: string[]; level: number; gold: number; gearTier: number };
type StoryData = { byTroop: Record<string, StoryEntry>; gearSets: Record<string, Record<string, Record<string, string>>> };

const args = process.argv.slice(2);
const projectPath = args[0];
const n = Number(args[1] ?? 200);
const outPath = args[2];
if (!projectPath) throw new Error("usage: battle-sim.mts <project.json> [n] [out.json]");

const STORY_PATH = new URL("../pipeline/data/story-levels.json", import.meta.url);
const story = JSON.parse(readFileSync(STORY_PATH, "utf8")) as StoryData;
const project = JSON.parse(readFileSync(projectPath, "utf8")) as Project;

const STATES = (process.env.STATES ?? "expected,weak,strong").split(",");
const STATE_SPEC: Record<string, { dLevel: number; dTier: number }> = {
  expected: { dLevel: 0, dTier: 0 },
  weak: { dLevel: -3, dTier: -1 },
  strong: { dLevel: 3, dTier: 0 },
};
const SEED = Number(process.env.SEED ?? 7);
const USE_SKILLS = process.env.SKILLS === "1";
const TROOP_FILTER = process.env.TROOPS ? new Set(process.env.TROOPS.split(",")) : null;

const party = project.system?.startActorIds ?? [];
const actorsById = new Map(project.database.actors.map((actor) => [actor.id, actor]));
const savedGear = new Map(party.map((id) => [id, actorsById.get(id)?.initialEquipment]));

/** 파티 총 최대 HP — 남은 HP 비율의 분모. */
function partyMaxHp(members: readonly string[], level: number): number {
  return members.reduce((sum, actorId) => {
    const curve = actorsById.get(actorId)?.parameterCurves?.maxHp;
    return sum + (curve ? parameterValueAtLevel(curve, level) : 0);
  }, 0);
}

function applyGear(tier: number): void {
  for (const actorId of party) {
    const actor = actorsById.get(actorId);
    if (!actor) continue;
    actor.initialEquipment = { ...(savedGear.get(actorId) ?? {}) } as ActorInitialEquipment;
  }
  const gear = tier > 0 ? story.gearSets[String(tier)] : null;
  if (!gear) return;
  for (const [actorId, slots] of Object.entries(gear)) {
    const actor = actorsById.get(actorId);
    if (!actor) continue;
    actor.initialEquipment = { ...(actor.initialEquipment ?? {}), ...slots } as ActorInitialEquipment;
  }
}

type Row = {
  troop: string;
  name: string;
  act: string | null;
  map: string | null;
  kind: string | null;
  state: string;
  level: number;
  gearTier: number;
  winRate: number;
  avgTurns: number;
  avgHpPct: number;
  avgPotions: number;
  samples: number;
  unwinnable: boolean;
  trivial: boolean;
  missingStory: boolean;
};

const rows: Row[] = [];
const allTroops = project.database.troops.map((troop) => troop.id);
const targets = TROOP_FILTER ? allTroops.filter((id) => TROOP_FILTER.has(id)) : allTroops;

for (const troopId of targets) {
  const troop = project.database.troops.find((entry) => entry.id === troopId);
  if (!troop) continue;
  const entry = story.byTroop[troopId] ?? null;
  // 이야기 순서에 없는 부대(비밀·분기·옛 판)는 시작 레벨로 잰다 — 표에 없다는 사실도 함께 보고한다.
  const baseLevel = entry?.level ?? (project.database.actors.find((a) => a.id === "actor_hero")?.initialLevel ?? 6);
  const baseTier = entry?.gearTier ?? 0;
  for (const state of STATES) {
    const spec = STATE_SPEC[state];
    if (!spec) continue;
    const level = Math.max(1, Math.min(99, baseLevel + spec.dLevel));
    const tier = Math.max(0, baseTier + spec.dTier);
    applyGear(tier);
    const result = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: entry?.party ?? party, n, seed: SEED, useSkills: USE_SKILLS });
    const totalHp = partyMaxHp(entry?.party ?? party, level) || 1;
    rows.push({
      troop: troopId,
      name: troop.name,
      act: entry?.act ?? null,
      map: entry?.map ?? null,
      kind: entry?.kind ?? null,
      state,
      level,
      gearTier: tier,
      winRate: Math.round(result.winRate * 1000) / 10,
      avgTurns: Math.round(result.avgTurns * 10) / 10,
      avgHpPct: Math.round((result.avgHpRemaining / totalHp) * 1000) / 10,
      avgPotions: Math.round(result.avgPotionsUsed * 10) / 10,
      samples: result.samples ?? n,
      unwinnable: result.winRate < 0.05,
      trivial: result.winRate > 0.99 && result.avgTurns < 2.5,
      missingStory: !entry,
    });
    if (process.env.LOG === "1") {
      console.log(`${troopId.padEnd(32)} ${state.padEnd(9)} Lv${String(level).padStart(2)} T${tier} win ${String(rows.at(-1)!.winRate).padStart(5)}% turns ${rows.at(-1)!.avgTurns}`);
    }
  }
}
applyGear(0);
const summary = {
  game: "fallen-star",
  generatedAt: new Date().toISOString(),
  samplesPerCell: n,
  states: STATES,
  useSkills: USE_SKILLS,
  troops: new Set(rows.map((r) => r.troop)).size,
  // 부대 중 이야기 표에 없는 것(비밀·분기·옛 판·초기 트룹)은 시작 레벨로만 잰 값이라 «결함» 으로 세지 않는다.
  missingStory: [...new Set(rows.filter((r) => r.missingStory).map((r) => r.troop))],
  unassessed: rows.filter((r) => r.missingStory).map((r) => `${r.troop}@${r.state}`),
  unwinnable: rows.filter((r) => r.unwinnable && !r.missingStory).map((r) => `${r.troop}@${r.state}`),
  trivial: rows.filter((r) => r.trivial && !r.missingStory).map((r) => `${r.troop}@${r.state}`),
  rows,
};
if (outPath) writeFileSync(outPath, `${JSON.stringify(summary, null, 1)}\n`);
console.log(
  `battle-sim: ${summary.troops} troops × ${STATES.length} states × ${n} = ${rows.length * n} battles · unwinnable ${summary.unwinnable.length} · trivial ${summary.trivial.length} · no-story ${summary.missingStory.length}${outPath ? ` → ${outPath}` : ""}`,
);
