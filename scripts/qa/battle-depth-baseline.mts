// scripts/qa/battle-depth-baseline.mts
// 기본 데이터베이스의 "전투 깊이" 를 수치로 고정한다. 적 행동 레퍼토리 변경의 전/후를
// 같은 seed 로 재서 비교하기 위한 것 — 변경 후에 처음 재면 비교 대상이 사라진다.
//
// 실행:
//   npx vite-node --script scripts/qa/battle-depth-baseline.mts [출력경로]
//   기본 출력경로: verify-shots/battle-depth/baseline.json
//   변경 후 재측정: ... scripts/qa/battle-depth-baseline.mts verify-shots/battle-depth/after.json
//
// tsx 는 이 저장소에 설치돼 있지 않다(node_modules/.bin 에 vite-node/vitest 만 있다).
// `npx tsx` 는 네트워크 설치를 유발하므로 로컬 vite-node 를 쓴다 — `@/` 별칭도 그대로 풀린다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { simulateBattle } from "@/battle/simulate";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

const OUT_PATH = process.argv[2] ?? "verify-shots/battle-depth/baseline.json";

// 시뮬레이션 파라미터. 전/후 비교가 성립하려면 이 값들이 절대 바뀌면 안 된다.
const HERO_LEVEL = 5;
const SAMPLES = 50;
const SEED = 12345;

// 시뮬 기질(substrate)은 검증된 경로를 쓴다 — test/battleSimulate.test.ts 가 쓰는 그 경로다.
// createEmberQuestProject() 는 내부에서 defaultDatabase() 를 부른 뒤 적/트룹/아이템을
// 데모 게임용으로 걸러내고 5마리 적의 stats/rewards 만 재조정한다. `actions`(이 과제의
// 대상 필드) 는 손대지 않으므로, 앞으로 defaultDatabase 의 적 행동이 늘면 여기에도 그대로
// 반영된다.
const project = createEmberQuestProject();
const db = project.database as any;

// 저작 표면(authoring surface) 은 defaultDatabase 전체다. emberQuest 가 106마리 중
// 5마리만 남기고 걸러내므로, "적 106마리가 전부 행동 1개" 라는 인구조사는 여기서만
// 읽을 수 있다. 시뮬은 위의 project 로만 돌린다 — 두 표면을 섞지 않고 따로 기록한다.
const fullDb = defaultDatabase() as any;

const countActions = (e: any): number => (e.actions ?? []).length;

const out: Record<string, unknown> = {
  meta: {
    generatedFrom: "scripts/qa/battle-depth-baseline.mts",
    heroLevel: HERO_LEVEL,
    samples: SAMPLES,
    seed: SEED,
    simSubstrate: "createEmberQuestProject()",
    censusSurface: "defaultDatabase()",
    note:
      "sims 는 emberQuest 프로젝트(트룹 5개, 재조정된 적 스탯)에서 돌린다. " +
      "fullDatabaseCensus 는 저작 표면인 defaultDatabase() 전체(적 106, 트룹 7)를 센다. " +
      "emberQuest 는 defaultDatabase 를 걸러 만들되 적의 actions 는 그대로 물려받으므로 " +
      "행동 레퍼토리 변경은 양쪽에 함께 나타난다.",
  },
};

// ── 1. 인구조사: 저작 표면 전체(적 106 / 트룹 7) ─────────────────────────────
out.fullDatabaseCensus = {
  enemyCount: fullDb.enemies.length,
  troopCount: fullDb.troops.length,
  skillCount: fullDb.skills.length,
  enemiesWithOneAction: fullDb.enemies.filter((e: any) => countActions(e) <= 1).length,
  enemyActionCounts: Object.fromEntries(fullDb.enemies.map((e: any) => [e.id, countActions(e)])),
  enemyMaxMp: Object.fromEntries(fullDb.enemies.map((e: any) => [e.id, e.stats?.maxMp ?? 0])),
  // 적이 실제로 저작해 둔 스킬 id 의 분포. 지금은 전부 skill_attack 하나다.
  authoredEnemySkillCounts: tally(
    fullDb.enemies.flatMap((e: any) => (e.actions ?? []).map((a: any) => a.skillId ?? "(none)")),
  ),
  troopIds: fullDb.troops.map((t: any) => t.id),
};

// ── 2. 인구조사: 실제로 싸우는 적(emberQuest) ────────────────────────────────
out.simulatedCensus = {
  enemyCount: db.enemies.length,
  troopCount: db.troops.length,
  enemiesWithOneAction: db.enemies.filter((e: any) => countActions(e) <= 1).length,
  enemyActionCounts: Object.fromEntries(db.enemies.map((e: any) => [e.id, countActions(e)])),
  enemyMaxMp: Object.fromEntries(db.enemies.map((e: any) => [e.id, e.stats?.maxMp ?? 0])),
};

// MP 를 쓰는 스킬이 있어야 maxMp 10 이 제약으로 작동한다 — 후속 태스크의 근거 자료.
out.skillCosts = Object.fromEntries(
  (db.skills as any[]).map((s: any) => [s.id, { name: s.name, mpFlat: s.mpCost?.flat ?? 0, mpPercentMax: s.mpCost?.percentMax ?? 0 }]),
);

// ── 3. 시뮬레이션: 스칼라 지표만 기록한다 ────────────────────────────────────
// SimulateBattleResult 를 통째로 쓰면 roundLogs/eventLogs 때문에 파일이 거대해진다.
const sims: Record<string, unknown> = {};
for (const troop of db.troops as any[]) {
  const r = simulateBattle({ project, troopId: troop.id, heroLevel: HERO_LEVEL, n: SAMPLES, seed: SEED });
  sims[troop.id] = {
    samples: r.samples,
    winRate: r.winRate,
    avgTurns: r.avgTurns,
    avgPotionsUsed: r.avgPotionsUsed,
    avgHpRemaining: r.avgHpRemaining,
  };
}
out.sims = sims;

// ── 4. 적 스킬 사용 히스토그램 ───────────────────────────────────────────────
// 두 가지 실측 제약이 있다(src/battle/runtime.ts, src/battle/simulate.ts 확인):
//  (a) roundLogs 는 strict 플로우에서만 채워진다 — roundLogs.push 는 finishStrictRoundLog
//      한 곳뿐이다. 이 프로젝트의 기본 battleFlow 는 "gauge" 라 roundLogs 가 항상 빈 배열이다.
//      그래서 히스토그램 전용으로 battleFlow: "strict" 를 명시해 따로 한 번 더 돌린다.
//  (b) simulateBattle 은 n 판 중 첫 판(i===0)의 roundLogs 만 보관한다. 그래서 n=50 을
//      한 번 부르면 표본이 1판뿐이다. seed 를 옮겨 가며 n=1 로 50번 돌려 전 판을 합산한다.
// 위 두 가지 때문에 이 수치는 sims 의 스칼라와 다른 플로우에서 나온 별개의 측정이다.
// 전/후 비교는 같은 스크립트끼리만 하면 성립한다.
const enemySkillUsage: Record<string, number> = {};
const enemyCommandKinds: Record<string, number> = {};
let strictRoundsObserved = 0;
for (const troop of db.troops as any[]) {
  for (let i = 0; i < SAMPLES; i += 1) {
    const r = simulateBattle({
      project,
      troopId: troop.id,
      heroLevel: HERO_LEVEL,
      n: 1,
      seed: SEED + i,
      battleFlow: "strict",
    });
    strictRoundsObserved += r.roundLogs.length;
    for (const round of r.roundLogs) {
      for (const action of round.actions) {
        if (action.side !== "enemy") continue;
        const kind = action.commandKind;
        enemyCommandKinds[kind] = (enemyCommandKinds[kind] ?? 0) + 1;
        // 로그는 스킬 id 가 아니라 이름(skillName)만 남긴다 — id 로 되돌린다.
        const skill = (db.skills as any[]).find((s: any) => s.name === action.skillName);
        const key = skill?.id ?? action.skillName ?? kind;
        enemySkillUsage[key] = (enemySkillUsage[key] ?? 0) + 1;
      }
    }
  }
}
out.enemySkillUsage = {
  note:
    "battleFlow:'strict' 전용 측정. roundLogs 는 strict 플로우에서만 기록되고, " +
    "simulateBattle 은 첫 판의 roundLogs 만 보관하므로 seed 를 옮겨 n=1 로 " +
    `${SAMPLES}회씩 돌려 합산했다. sims 의 스칼라(기본 gauge 플로우)와는 별개 측정이다.`,
  runsPerTroop: SAMPLES,
  strictRoundsObserved,
  byCommandKind: enemyCommandKinds,
  bySkillId: enemySkillUsage,
  distinctSkills: Object.keys(enemySkillUsage).length,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);

// ── 콘솔 요약 ────────────────────────────────────────────────────────────────
const census = out.fullDatabaseCensus as any;
console.log(`적 행동 1개뿐: ${census.enemiesWithOneAction} / ${census.enemyCount}  (저작 표면: defaultDatabase)`);
console.log(`트룹: ${census.troopCount}개 (저작) / ${(out.simulatedCensus as any).troopCount}개 (시뮬)`);
console.log(`\n=== 시뮬 (Lv${HERO_LEVEL}, n=${SAMPLES}, seed=${SEED}, flow=gauge) ===`);
for (const [id, r] of Object.entries(sims as Record<string, any>)) {
  console.log(
    `  ${id.padEnd(22)} win=${r.winRate.toFixed(2)} turns=${r.avgTurns.toFixed(2)} ` +
      `potions=${r.avgPotionsUsed.toFixed(2)} hp=${r.avgHpRemaining.toFixed(1)}`,
  );
}
console.log(`\n=== 적 스킬 사용 (strict 플로우, ${strictRoundsObserved} 라운드) ===`);
console.log("  commandKind:", JSON.stringify(enemyCommandKinds));
console.log("  bySkillId  :", JSON.stringify(enemySkillUsage));
console.log(`\n기록: ${OUT_PATH}`);

function tally(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}
