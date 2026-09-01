// scripts/qa/battle-depth-baseline.mts
// 기본 데이터베이스의 "전투 깊이" 를 수치로 고정한다. 적 행동 레퍼토리 변경의 전/후를
// 같은 seed 로 재서 비교하기 위한 것 — 변경 후에 처음 재면 비교 대상이 사라진다.
//
// 실행 (변경 후 재측정):
//   npx vite-node --script scripts/qa/battle-depth-baseline.mts verify-shots/battle-depth/after.json
//
// 기준선 최초 생성 / 갱신(기존 파일이 있으면 --force 없이는 거부한다):
//   npx vite-node --script scripts/qa/battle-depth-baseline.mts
//   npx vite-node --script scripts/qa/battle-depth-baseline.mts verify-shots/battle-depth/baseline.json --force
//
// tsx 는 이 저장소에 설치돼 있지 않다(node_modules/.bin 에 vite-node/vitest 만 있다).
// `npx tsx` 는 네트워크 설치를 유발하므로 로컬 vite-node 를 쓴다 — `@/` 별칭도 그대로 풀린다.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { simulateBattle } from "@/battle/simulate";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { normalizeTroopRecord } from "@/project/databaseRecordModel";
import type { BattleFlow } from "@/battle/types";

// ── 인자 ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const OUT_PATH = argv.find((a) => !a.startsWith("--")) ?? "verify-shots/battle-depth/baseline.json";

// 기준선은 이 태스크의 유일한 산출물이다. 인자 없이 습관적으로 재실행해서 "전" 을
// 조용히 날리는 사고를 막는다(Task 6 은 after.json 경로를 줘야 한다).
if (existsSync(OUT_PATH) && !FORCE) {
  console.error(`거부: ${OUT_PATH} 가 이미 있다. 덮어쓰려면 --force 를, 새로 재려면 다른 경로를 줘라.`);
  console.error(`  예) npx vite-node --script scripts/qa/battle-depth-baseline.mts verify-shots/battle-depth/after.json`);
  process.exit(1);
}

// ── 고정 파라미터. 전/후 비교가 성립하려면 절대 바뀌면 안 된다 ────────────────
const HERO_LEVEL = 5;
const SAMPLES = 50;
const SEED = 12345;
// sims 의 플로우를 못박는다. simulateBattle 은
// input.battleFlow ?? troop.battleFlow ?? system.battleFlow ?? "strict" 로 해석하므로
// (simulate.ts:301), 명시하지 않으면 후속 태스크가 트룹/시스템을 건드릴 때 "후" 가
// 말없이 다른 플로우로 갈아타 비교가 무너진다.
const SIM_FLOW: BattleFlow = "gauge";
// roundLogs 는 strict 플로우에서만 기록된다(아래 4절 주석 참조).
const LOG_FLOW: BattleFlow = "strict";

// ── 시뮬 기질(substrate) ─────────────────────────────────────────────────────
// 검증된 경로를 쓴다 — test/battleSimulate.test.ts 가 쓰는 그 경로다.
// createEmberQuestProject() 는 내부에서 defaultDatabase() 를 부른 뒤 적/트룹/아이템을
// 데모 게임용으로 걸러내고 5마리 적의 stats/rewards 만 재조정한다. `actions`(이 과제의
// 대상 필드) 는 손대지 않으므로, 앞으로 defaultDatabase 의 적 행동이 늘면 여기에도 그대로
// 반영된다.
const project = createEmberQuestProject();
const db = project.database as any;

// 저작 표면(authoring surface) 은 defaultDatabase 전체다. emberQuest 가 106마리 중
// 5마리만 남기고 걸러내므로, "적 106마리가 전부 행동 1개" 라는 인구조사는 여기서만
// 읽을 수 있다. 읽기 전용이며 시뮬에 들어가지 않는다.
const fullDb = defaultDatabase() as any;

const DEFAULT_TROOP_IDS: string[] = (db.troops as any[]).map((t: any) => t.id);

// ── 아키타입 대표 적: 임시 인메모리 트룹 ─────────────────────────────────────
// 왜 필요한가: createEmberQuestProject() 는 적 5마리만 남긴다. 그 5마리는 스타터 적과
// 겹치지만, generatedEnemyRecords.ts 의 **생성된 적 100마리는 어떤 시뮬로도 실행되지
// 않는다**. 그 100마리를 건드리는 변경이 전투에 어떤 영향을 주는지 볼 수 없다는 뜻이다.
// 계열 9종의 대표 1마리씩을 골라 임시 트룹을 만들어 함께 잰다. DB 에는 커밋하지 않는다.
//
// 대표는 각 계열의 중간 난이도(정렬된 목록의 중앙)에서 골랐다.
// count/heroLevel 은 승률이 0%/100% 로 몰리지 않는 지점을 실측 탐색해서 정했다
// (계열별 HP 가 32~650 으로 20배 차이나 단일 레벨로는 전부 포화된다).
// contested=false 인 둘은 영웅이 한 방에 잡아서 승률을 어떤 구성으로도 못 움직인다 —
// 그 계열은 avgTurns/avgHpRemaining 만 신호를 갖는다.
interface ArchetypeSpec {
  readonly archetype: string;
  readonly enemyId: string;
  readonly count: number;
  readonly heroLevel: number;
  readonly contested: boolean;
}
const ARCHETYPES: readonly ArchetypeSpec[] = [
  { archetype: "슬라임·젤리", enemyId: "enemy_slime_king", count: 24, heroLevel: 1, contested: false },
  { archetype: "곤충·절지", enemyId: "enemy_beetle_horn", count: 24, heroLevel: 1, contested: false },
  { archetype: "야수", enemyId: "enemy_snake_viper", count: 24, heroLevel: 1, contested: true },
  { archetype: "언데드", enemyId: "enemy_wraith_dark", count: 20, heroLevel: 4, contested: true },
  { archetype: "정령·원소", enemyId: "enemy_spirit_dark", count: 12, heroLevel: 3, contested: true },
  { archetype: "골렘·구조물", enemyId: "enemy_sword_flying", count: 10, heroLevel: 5, contested: true },
  { archetype: "인간형", enemyId: "enemy_knight_fallen", count: 7, heroLevel: 5, contested: true },
  { archetype: "수생·비행", enemyId: "enemy_griffin_sky", count: 4, heroLevel: 2, contested: true },
  { archetype: "드래곤·보스", enemyId: "enemy_behemoth_horn", count: 1, heroLevel: 5, contested: true },
];
const ARCH_TROOP_PREFIX = "__archetype_probe_";

// 이 적들은 emberQuest 가 걸러내 project 에 없다. defaultDatabase 판을 그대로 주입한다
// — emberQuest 가 재조정한 5마리와 달리 이 100마리는 판본이 하나뿐이라 모호함이 없다.
for (const spec of ARCHETYPES) {
  const record = fullDb.enemies.find((e: any) => e.id === spec.enemyId);
  if (!record) throw new Error(`아키타입 대표 적을 찾을 수 없다: ${spec.enemyId}`);
  db.enemies.push(record);
  db.troops.push(
    normalizeTroopRecord({
      id: `${ARCH_TROOP_PREFIX}${spec.enemyId}`,
      name: `${spec.archetype} 대표 x${spec.count}`,
      enemyIds: Array.from({ length: spec.count }, () => spec.enemyId),
      autoAlign: true,
      battleEventPages: [],
    } as any),
  );
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
const countActions = (e: any): number => (e.actions ?? []).length;

function tally(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** 판당 표본의 평균/표준편차/최솟값/최댓값. 평균만으로는 "후" 의 변화가 유의한지 못 본다. */
function spread(values: readonly number[]): Record<string, number> {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean: round4(mean), stddev: round4(Math.sqrt(variance)), min: Math.min(...values), max: Math.max(...values) };
}

/**
 * 트룹 하나의 지표. 두 패스로 나뉜다:
 *  - 집계 패스: n=SAMPLES 를 한 번 불러 브리프가 지정한 스칼라를 그대로 받는다.
 *  - 표본 패스: n=1 을 seed 를 옮겨 SAMPLES 회 불러 판당 값을 모은다(분산용).
 *    simulateBattle 은 집계만 돌려주므로 판당 값을 얻으려면 이 방법뿐이다.
 * 두 패스는 rng 스트림이 달라 평균이 다르다. "미세하게" 가 아니다 — mulberry32 는 n판
 * 전체가 스트림 하나를 공유하므로(simulate.ts:240) 두 패스는 아예 다른 50판을 뽑는다.
 * 실측 편차: 골렘·구조물 winRate 0.58 vs perBattleWinRate.mean 0.42, 드래곤·보스 0.10 vs 0.02.
 * 그래서 표본 패스의 평균도 같이 기록한다(perBattle*.mean). 전/후 비교는 같은 패스끼리만
 * 하면 성립한다 — meta.caveats.두패스승률차이 참조.
 */
function measureTroop(troopId: string, heroLevel: number): Record<string, unknown> {
  const agg = simulateBattle({ project, troopId, heroLevel, n: SAMPLES, seed: SEED, battleFlow: SIM_FLOW });
  const turns: number[] = [];
  const hp: number[] = [];
  const wins: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const r = simulateBattle({ project, troopId, heroLevel, n: 1, seed: SEED + i, battleFlow: SIM_FLOW });
    turns.push(r.avgTurns);
    hp.push(r.avgHpRemaining);
    wins.push(r.winRate);
  }
  return {
    heroLevel,
    samples: agg.samples,
    // simulateBattle 이 실제로 해석한 플로우. 하드코딩이 아니라 결과에서 읽는다.
    battleFlow: agg.battleFlow,
    winRate: round4(agg.winRate),
    avgTurns: round4(agg.avgTurns),
    avgHpRemaining: round4(agg.avgHpRemaining),
    // 항상 0 이다 — 아래 meta.deadMetrics 참조. 값 자체로는 아무것도 읽지 말 것.
    avgPotionsUsed: round4(agg.avgPotionsUsed),
    perBattleTurns: spread(turns),
    perBattleHpRemaining: spread(hp),
    perBattleWinRate: spread(wins),
  };
}

// ── 출력 뼈대 ────────────────────────────────────────────────────────────────
const out: Record<string, unknown> = {
  meta: {
    generatedFrom: "scripts/qa/battle-depth-baseline.mts",
    heroLevel: HERO_LEVEL,
    samples: SAMPLES,
    seed: SEED,
    simBattleFlow: SIM_FLOW,
    logBattleFlow: LOG_FLOW,
    simSubstrate: "createEmberQuestProject()",
    censusSurface: "defaultDatabase()",
    note:
      "sims 는 emberQuest 프로젝트(트룹 5개, 재조정된 적 스탯)에서 돌린다. " +
      "archetypeSims 는 generatedEnemyRecords 의 계열 9종 대표를 임시 인메모리 트룹으로 만들어 잰다(DB 미커밋). " +
      "fullDatabaseCensus 는 저작 표면인 defaultDatabase() 전체(적 106, 트룹 7)를 센다. " +
      "emberQuest 는 defaultDatabase 를 걸러 만들되 적의 actions 는 그대로 물려받으므로 " +
      "행동 레퍼토리 변경은 양쪽에 함께 나타난다.",
    deadMetrics: {
      avgPotionsUsed:
        "항상 0 이다. simulateBattle 은 potionItemId 가 없으면 회복 아이템을 쓰지 않는데" +
        "(simulate.ts:163) 이 스크립트는 inventory/potionItemId 를 주지 않는다. " +
        "'AI 가 포션을 안 썼다(=쉬웠다)' 가 아니라 '쓸 수 없다' 이다. 전/후 비교에서 읽지 말 것.",
    },
    caveats: {
      승패혼합통계:
        "winRate 가 1 미만인 항목의 avgTurns / avgHpRemaining 은 **승리 판과 패배 판을 " +
        "섞은 평균**이다. simulateBattle 은 승패를 가리지 않고 totalTurns/totalHp 를 " +
        "누적하고(simulate.ts:257-260), 파티가 전멸하면 hpRemaining 이 0 으로 들어간다" +
        "(simulate.ts:186). 따라서 이 두 지표는 winRate 와 **반드시 함께** 읽어야 한다. " +
        "★방향 함정★: 적이 강해지면 winRate 가 내려가고 → 전멸 판이 늘어 avgHpRemaining 이 " +
        "내려가며 → 더 일찍 전멸해 avgTurns 도 **내려간다**. 즉 '전투가 깊어졌다' 와 " +
        "'전투가 짧아졌다' 가 같은 방향으로 움직인다. avgTurns 증가를 성공 신호로 쓰면 " +
        "정반대로 읽힌다. 승률이 크게 달라진 항목은 avgTurns/avgHpRemaining 을 직접 " +
        "비교하지 말고, winRate 를 먼저 보고 승률이 비슷한 항목끼리만 비교하라. " +
        "실례(이 기준선): archetypeSims['드래곤·보스'] 의 perBattleTurns 는 " +
        "{mean:15, stddev:0, min:15, max:15} 다. stddev 0 에 min=max=15 라는 건 그 표본 패스 " +
        "50판이 **승패와 무관하게 전부 15턴** 에 끝났다는 뜻이다 — 같은 패스의 승률인 " +
        "perBattleWinRate.mean 0.02 로 보면 1승 49패인데, **유일한 1승도 15턴**이었다. " +
        "같은 항목의 perBattleHpRemaining 은 {mean:1.86, stddev:13.02, min:0, max:93} 로 " +
        "승패에 따라 0 과 93 으로 갈리는데, 턴수만 승패에 전혀 반응하지 않는다. " +
        "즉 이 15는 '전투 깊이' 가 아니라 '지금 이 전투에는 턴수를 바꿀 변수가 없다' 는 " +
        "증거이고, 그래서 깊이 지표로 쓸 수 없다. " +
        "(이 예시의 승패 수는 perBattleTurns 와 **같은 표본 패스**에서 읽었다. 집계 패스의 " +
        "winRate 0.1 로 '45패' 를 계산하면 아래 두패스승률차이 가 금지한 교차 계산이 된다.) " +
        "sims(기본 트룹 5개)는 전부 winRate 1.00 이라 이 함정이 " +
        "걸리지 않는다. archetypeSims 9개 중 7개(contested:true)가 해당된다.",
      두패스승률차이:
        "같은 항목의 winRate(집계 패스)와 perBattleWinRate.mean(표본 패스)이 눈에 띄게 " +
        "다를 수 있다. 실측(이 기준선): 골렘·구조물 0.58 vs 0.42, 드래곤·보스 0.10 vs 0.02. " +
        "모순이 아니라 표본 잡음이다 — mulberry32 는 n판 전체가 rng 스트림 하나를 " +
        "공유하므로(simulate.ts:240) 'n=50 한 번' 과 'n=1 을 seed 옮겨 50번' 은 롤 소비 " +
        "순서가 달라 서로 다른 50판을 뽑는다. n=50 에서는 이 정도 편차가 정상이다. " +
        "전/후 비교는 **같은 패스끼리만** 하라(winRate↔winRate, " +
        "perBattleWinRate.mean↔perBattleWinRate.mean). 둘을 교차 비교하면 없는 변화를 만든다.",
    },
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

// ── 2. 인구조사: 실제로 싸우는 적(emberQuest 원본 5마리) ─────────────────────
// 아키타입 대표는 위에서 project 에 주입했으므로 원본 5마리만 세도록 id 로 거른다.
const EMBER_ENEMY_IDS = new Set<string>(
  (db.enemies as any[]).map((e: any) => e.id).filter((id: string) => !ARCHETYPES.some((a) => a.enemyId === id)),
);
const emberEnemies = (db.enemies as any[]).filter((e: any) => EMBER_ENEMY_IDS.has(e.id));
out.simulatedCensus = {
  enemyCount: emberEnemies.length,
  troopCount: DEFAULT_TROOP_IDS.length,
  skillCount: db.skills.length,
  enemiesWithOneAction: emberEnemies.filter((e: any) => countActions(e) <= 1).length,
  enemyActionCounts: Object.fromEntries(emberEnemies.map((e: any) => [e.id, countActions(e)])),
  enemyMaxMp: Object.fromEntries(emberEnemies.map((e: any) => [e.id, e.stats?.maxMp ?? 0])),
  authoredEnemySkillCounts: tally(
    emberEnemies.flatMap((e: any) => (e.actions ?? []).map((a: any) => a.skillId ?? "(none)")),
  ),
  troopIds: DEFAULT_TROOP_IDS,
};

// MP 를 쓰는 스킬이 있어야 maxMp 10 이 제약으로 작동한다 — 후속 태스크의 근거 자료.
// 인구조사와 같은 표면(fullDb)에서 읽는다.
out.skillCosts = Object.fromEntries(
  (fullDb.skills as any[]).map((s: any) => [
    s.id,
    { name: s.name, mpFlat: s.mpCost?.flat ?? 0, mpPercentMax: s.mpCost?.percentMax ?? 0 },
  ]),
);

// ── 3. 시뮬레이션: 스칼라 지표 + 분산 ────────────────────────────────────────
// SimulateBattleResult 를 통째로 쓰면 roundLogs/eventLogs 때문에 파일이 거대해진다.
const sims: Record<string, unknown> = {};
for (const troopId of DEFAULT_TROOP_IDS) sims[troopId] = measureTroop(troopId, HERO_LEVEL);
out.sims = sims;

const archetypeSims: Record<string, unknown> = {};
for (const spec of ARCHETYPES) {
  archetypeSims[spec.archetype] = {
    enemyId: spec.enemyId,
    enemyCountInTroop: spec.count,
    // 승률이 0/100 에 붙어 못 움직이는 계열인지. false 면 winRate 는 신호가 없고
    // avgTurns/avgHpRemaining 만 읽어야 한다.
    contested: spec.contested,
    ...measureTroop(`${ARCH_TROOP_PREFIX}${spec.enemyId}`, spec.heroLevel),
  };
}
out.archetypeSims = archetypeSims;

// ── 4. 적 스킬 사용 히스토그램 ───────────────────────────────────────────────
// 두 가지 실측 제약이 있다(src/battle/runtime.ts, src/battle/simulate.ts 확인):
//  (a) roundLogs 는 strict 플로우에서만 채워진다 — roundLogs.push 는 finishStrictRoundLog
//      한 곳뿐이다. 이 프로젝트의 기본 battleFlow 는 "gauge" 라 roundLogs 가 항상 빈 배열이다.
//      그래서 히스토그램 전용으로 battleFlow: "strict" 를 명시해 따로 한 번 더 돌린다.
//  (b) simulateBattle 은 n 판 중 첫 판(i===0)의 roundLogs 만 보관한다. 그래서 n=50 을
//      한 번 부르면 표본이 1판뿐이다. seed 를 옮겨 가며 n=1 로 SAMPLES 회 돌려 합산한다.
// 위 두 가지 때문에 이 수치는 sims 의 스칼라와 다른 플로우에서 나온 별개의 측정이다.
const skillIdByName = new Map<string, string>((fullDb.skills as any[]).map((s: any) => [s.name, s.id]));

interface UsageBucket {
  readonly bySkillId: Record<string, number>;
  readonly byCommandKind: Record<string, number>;
  /**
   * 스킬 id 로 해소하지 못한 적 행동. **bySkillId 에 섞으면 안 된다.**
   * 상태이상 봉인(skillBlocked)이나 MP 부족(insufficientMp)이면 executeEnemyAction 이
   * 조기 return 해서(runtime.ts:1491) lastActionResult 가 안 바뀌고, 그래도
   * logStrictAction 은 실행되므로(runtime.ts:1237-1238) skillName 이 undefined 로 남는다.
   * 이걸 commandKind 로 폴백해 bySkillId 에 넣으면 "적이 새 스킬을 쓴다" 로 오독된다 —
   * MP 고갈은 실패인데 distinctSkills 가 늘어 성공 신호로 읽힌다.
   */
  readonly unresolved: Record<string, number>;
  rounds: number;
}
const makeBucket = (): UsageBucket => ({ bySkillId: {}, byCommandKind: {}, unresolved: {}, rounds: 0 });

function collectUsage(troopIds: readonly string[], heroLevelFor: (id: string) => number): UsageBucket {
  const bucket = makeBucket();
  for (const troopId of troopIds) {
    for (let i = 0; i < SAMPLES; i += 1) {
      const r = simulateBattle({
        project,
        troopId,
        heroLevel: heroLevelFor(troopId),
        n: 1,
        seed: SEED + i,
        battleFlow: LOG_FLOW,
      });
      bucket.rounds += r.roundLogs.length;
      for (const round of r.roundLogs) {
        for (const action of round.actions) {
          if (action.side !== "enemy") continue;
          const kind = action.commandKind;
          bucket.byCommandKind[kind] = (bucket.byCommandKind[kind] ?? 0) + 1;
          // 로그는 스킬 id 가 아니라 이름(skillName)만 남긴다 — id 로 되돌린다.
          if (action.skillName === undefined) {
            const key = `${kind}:skillName없음`;
            bucket.unresolved[key] = (bucket.unresolved[key] ?? 0) + 1;
            continue;
          }
          const skillId = skillIdByName.get(action.skillName);
          if (skillId === undefined) {
            const key = `${kind}:이름미매칭(${action.skillName})`;
            bucket.unresolved[key] = (bucket.unresolved[key] ?? 0) + 1;
            continue;
          }
          bucket.bySkillId[skillId] = (bucket.bySkillId[skillId] ?? 0) + 1;
        }
      }
    }
  }
  return bucket;
}

const archLevelById = new Map<string, number>(
  ARCHETYPES.map((s) => [`${ARCH_TROOP_PREFIX}${s.enemyId}`, s.heroLevel]),
);
const defaultUsage = collectUsage(DEFAULT_TROOP_IDS, () => HERO_LEVEL);
const archetypeUsage = collectUsage([...archLevelById.keys()], (id) => archLevelById.get(id) ?? HERO_LEVEL);

const summarizeUsage = (b: UsageBucket): Record<string, unknown> => ({
  strictRoundsObserved: b.rounds,
  byCommandKind: b.byCommandKind,
  bySkillId: b.bySkillId,
  // 실제로 스킬 id 로 해소된 것만 센다. 해소 실패는 unresolved 로 빠진다.
  distinctSkills: Object.keys(b.bySkillId).length,
  unresolved: b.unresolved,
  unresolvedTotal: Object.values(b.unresolved).reduce((s, v) => s + v, 0),
});

out.enemySkillUsage = {
  note:
    `battleFlow:'${LOG_FLOW}' 전용 측정. roundLogs 는 strict 플로우에서만 기록되고, ` +
    "simulateBattle 은 첫 판의 roundLogs 만 보관하므로 seed 를 옮겨 n=1 로 " +
    `${SAMPLES}회씩 돌려 합산했다. sims 의 스칼라(${SIM_FLOW} 플로우)와는 별개 측정이다. ` +
    "distinctSkills 는 스킬 id 로 해소된 것만 센다 — MP 부족/상태이상으로 불발된 행동은 " +
    "unresolved 로 빠지므로, unresolvedTotal 이 0 이 아니면 그쪽을 먼저 봐야 한다.",
  runsPerTroop: SAMPLES,
  defaultTroops: summarizeUsage(defaultUsage),
  archetypeTroops: summarizeUsage(archetypeUsage),
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);

// ── 콘솔 요약 ────────────────────────────────────────────────────────────────
const census = out.fullDatabaseCensus as any;
console.log(`적 행동 1개뿐: ${census.enemiesWithOneAction} / ${census.enemyCount}  (저작 표면: defaultDatabase)`);
console.log(`트룹: ${census.troopCount}개 (저작) / ${DEFAULT_TROOP_IDS.length}개 (시뮬) + 아키타입 대표 ${ARCHETYPES.length}종`);

const line = (label: string, r: any, extra = ""): void => {
  console.log(
    `  ${label.padEnd(24)} win=${r.winRate.toFixed(2)} turns=${r.avgTurns.toFixed(2)}` +
      `±${r.perBattleTurns.stddev.toFixed(2)} [${r.perBattleTurns.min}~${r.perBattleTurns.max}] ` +
      `hp=${r.avgHpRemaining.toFixed(1)}${extra}`,
  );
};

console.log(`\n=== 기본 트룹 (Lv${HERO_LEVEL}, n=${SAMPLES}, seed=${SEED}, flow=${SIM_FLOW}) ===`);
for (const [id, r] of Object.entries(sims as Record<string, any>)) line(id, r);

console.log(`\n=== 아키타입 대표 (계열 9종, 임시 트룹) ===`);
for (const [arch, r] of Object.entries(archetypeSims as Record<string, any>)) {
  line(`${arch} x${r.enemyCountInTroop}`, r, ` Lv${r.heroLevel}${r.contested ? "" : " (승률포화)"}`);
}

console.log(`\n=== 적 스킬 사용 (flow=${LOG_FLOW}) ===`);
for (const [label, b] of [["기본 트룹", defaultUsage], ["아키타입", archetypeUsage]] as const) {
  const s = summarizeUsage(b) as any;
  console.log(`  ${label.padEnd(10)} 라운드=${s.strictRoundsObserved} kinds=${JSON.stringify(s.byCommandKind)}`);
  console.log(`  ${" ".repeat(10)} bySkillId=${JSON.stringify(s.bySkillId)} distinct=${s.distinctSkills} unresolved=${s.unresolvedTotal}`);
}
console.log(`\n기록: ${OUT_PATH}`);
