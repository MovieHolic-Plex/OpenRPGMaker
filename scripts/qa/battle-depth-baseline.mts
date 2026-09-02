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
    // caveats 는 sims/archetypeSims 를 잰 뒤 그 값에서 **생성**한다(아래 5절).
    // 손으로 숫자를 적지 않는 이유는 그 절의 주석에 있다.
  },
};

// ── R21: 세 축 측정에 필요한 조회표 ──────────────────────────────────────────
// "서로 다른 스킬 수" **단독으로는 개선을 놓친다.** 순수 데미지 스킬끼리는 교대하지
// 않고 승자만 바뀌기 때문이다 — boss 가 `sword_slash` 에서 속성기로 갈려도
// distinctSkills 는 1 → 1 이다. 그런데 무속성이 속성으로 바뀐 것은 큰 변화다.
// 그래서 스킬 종류에 더해 **속성 종류**와 **상태이상 부여 횟수**를 함께 잰다.
const NO_ELEMENT = "(무속성)";
/** 스킬 id → 속성 id. elementId 가 없는 스킬은 NO_ELEMENT. */
const elementBySkillId = new Map<string, string>(
  (fullDb.skills as any[]).map((s: any) => [s.id, s.elementId ?? NO_ELEMENT]),
);
const elementNameById = new Map<string, string>(
  ((fullDb.elements ?? []) as any[]).map((e: any) => [e.id, e.name]),
);
const stateNameById = new Map<string, string>((fullDb.states as any[]).map((s: any) => [s.id, s.name]));
/** 스킬 id → 이 스킬이 add 로 걸 수 있는 상태 id 들. remove 는 부여가 아니므로 뺀다. */
const addedStatesBySkillId = new Map<string, readonly string[]>(
  (fullDb.skills as any[]).map((s: any) => [
    s.id,
    ((s.stateEffects ?? []) as any[]).filter((e: any) => e.operation === "add").map((e: any) => e.stateId),
  ]),
);

/**
 * 저작 표면의 속성/상태 커버리지. **런타임 히스토그램과 목적이 다르다.**
 * archetypeSims 는 계열 9종 대표 **9마리**만 돌리므로 런타임 byElement 는 그 9마리가
 * 쓴 속성밖에 못 본다 — 106마리 전체가 여덟 속성을 쓰게 됐는지는 구조적으로 안 보인다.
 * 그래서 "적이 어떤 속성/상태를 **저작상 쓸 수 있는가**" 는 여기서 센다. rng 가 없는
 * 순수 함수라 전/후 비교에 잡음이 없다.
 */
function authoredCoverage(enemies: readonly any[]): Record<string, unknown> {
  const elements: Record<string, number> = {};
  const states: Record<string, number> = {};
  for (const enemy of enemies) {
    for (const action of (enemy.actions ?? []) as any[]) {
      const skillId = action.skillId;
      if (skillId === undefined) continue;
      const elementId = elementBySkillId.get(skillId) ?? NO_ELEMENT;
      const label = elementId === NO_ELEMENT ? elementId : (elementNameById.get(elementId) ?? elementId);
      elements[label] = (elements[label] ?? 0) + 1;
      for (const stateId of addedStatesBySkillId.get(skillId) ?? []) {
        const stateLabel = stateNameById.get(stateId) ?? stateId;
        states[stateLabel] = (states[stateLabel] ?? 0) + 1;
      }
    }
  }
  return {
    byElement: elements,
    // 무속성은 "속성을 실었다" 가 아니므로 제외한다.
    distinctElements: Object.keys(elements).filter((k) => k !== NO_ELEMENT).length,
    byAddedState: states,
    distinctAddedStates: Object.keys(states).length,
    // 속성기를 하나라도 저작해 둔 적의 수 / 상태 부여기를 저작해 둔 적의 수.
    enemiesWithElementalAction: enemies.filter((e: any) =>
      ((e.actions ?? []) as any[]).some((a: any) => (elementBySkillId.get(a.skillId) ?? NO_ELEMENT) !== NO_ELEMENT),
    ).length,
    enemiesWithStateAction: enemies.filter((e: any) =>
      ((e.actions ?? []) as any[]).some((a: any) => (addedStatesBySkillId.get(a.skillId) ?? []).length > 0),
    ).length,
  };
}

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
  authoredCoverage: authoredCoverage(fullDb.enemies as any[]),
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
  authoredCoverage: authoredCoverage(emberEnemies),
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
   * 적이 실제로 실어 보낸 속성. bySkillId 를 스킬 레코드의 elementId 로 사영한 것이라
   * 새 측정이 아니다 — 같은 roundLogs 를 다르게 접은 값이다(rng 소비 없음).
   */
  readonly byElement: Record<string, number>;
  /**
   * 상태이상이 **실제로 붙은** 횟수. 스킬을 골랐다는 것과 상태가 걸렸다는 것은 다르다
   * (stateEffects 의 chance 를 굴려 실패할 수 있고, 명중 자체가 빗나갈 수 있다).
   * 그래서 저작 표가 아니라 roundLogs 의 stateIds 를 라운드 간 비교해 **부재→존재**
   * 전이만 센다. 같은 상태가 풀렸다 다시 걸리면 2회로 센다 — 부여가 2번 일어난 게 맞다.
   */
  readonly actorStateGains: Record<string, number>;
  /** 적 쪽에 붙은 상태(적의 자기 버프 skill_focus 등). 아래 주석의 근거로 영웅은 못 건다. */
  readonly enemyStateGains: Record<string, number>;
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
const makeBucket = (): UsageBucket => ({
  bySkillId: {},
  byCommandKind: {},
  byElement: {},
  actorStateGains: {},
  enemyStateGains: {},
  unresolved: {},
  rounds: 0,
});

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
      // 판 하나 안에서만 유효한 상태 스냅샷. 판이 바뀌면 초기화해야 이전 판의 잔여
      // 상태가 다음 판 1라운드에서 "새로 걸렸다" 로 오집계되지 않는다.
      const prevStates = { actor: new Map<string, Set<string>>(), enemy: new Map<string, Set<string>>() };
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
          const element = elementBySkillId.get(skillId) ?? NO_ELEMENT;
          bucket.byElement[element] = (bucket.byElement[element] ?? 0) + 1;
        }
        // 상태 부여: 라운드 끝 스냅샷의 stateIds 를 직전 라운드와 비교해 신규만 센다.
        for (const [side, entries, sink] of [
          ["actor", round.actors, bucket.actorStateGains],
          ["enemy", round.enemies, bucket.enemyStateGains],
        ] as const) {
          const seen = prevStates[side];
          for (const entry of entries) {
            const before = seen.get(entry.id) ?? new Set<string>();
            for (const stateId of entry.stateIds) {
              if (!before.has(stateId)) sink[stateId] = (sink[stateId] ?? 0) + 1;
            }
            seen.set(entry.id, new Set(entry.stateIds));
          }
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

const sumValues = (r: Record<string, number>): number => Object.values(r).reduce((s, v) => s + v, 0);
/** 상태 id 집계를 사람이 읽을 이름으로 바꾼다. 이름을 못 찾으면 id 를 그대로 남긴다. */
const namedStates = (r: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(r).map(([id, n]) => [stateNameById.get(id) ?? id, n]));

const summarizeUsage = (b: UsageBucket): Record<string, unknown> => ({
  strictRoundsObserved: b.rounds,
  byCommandKind: b.byCommandKind,
  bySkillId: b.bySkillId,
  // 실제로 스킬 id 로 해소된 것만 센다. 해소 실패는 unresolved 로 빠진다.
  distinctSkills: Object.keys(b.bySkillId).length,
  // ── 축 2: 속성 ────────────────────────────────────────────────────────────
  byElement: Object.fromEntries(
    Object.entries(b.byElement).map(([id, n]) => [id === NO_ELEMENT ? id : (elementNameById.get(id) ?? id), n]),
  ),
  // 무속성은 "속성을 실었다" 가 아니므로 제외한다. 이걸 포함하면 기준선이 0 이 아니라
  // 1 로 잡혀 0→8 이라는 실제 변화가 1→9 로 희석돼 보인다.
  distinctElements: Object.keys(b.byElement).filter((id) => id !== NO_ELEMENT).length,
  // ── 축 3: 상태이상 부여 ───────────────────────────────────────────────────
  // actor 쪽 = 적이 파티에 건 것. 이 시뮬에서 영웅은 스킬을 못 쓰므로(아래 자체 검사
  // '영웅은 통상공격만 한다' 참조) 파티에 붙은 상태의 출처는 적뿐이다.
  actorStateGains: namedStates(b.actorStateGains),
  actorStateGainsTotal: sumValues(b.actorStateGains),
  // enemy 쪽 = 적의 자기 버프(skill_focus 등). 영웅은 통상공격만 하므로 영웅이 건 게 아니다.
  enemyStateGains: namedStates(b.enemyStateGains),
  enemyStateGainsTotal: sumValues(b.enemyStateGains),
  unresolved: b.unresolved,
  unresolvedTotal: sumValues(b.unresolved),
});

out.enemySkillUsage = {
  note:
    `battleFlow:'${LOG_FLOW}' 전용 측정. roundLogs 는 strict 플로우에서만 기록되고, ` +
    "simulateBattle 은 첫 판의 roundLogs 만 보관하므로 seed 를 옮겨 n=1 로 " +
    `${SAMPLES}회씩 돌려 합산했다. sims 의 스칼라(${SIM_FLOW} 플로우)와는 별개 측정이다. ` +
    "distinctSkills 는 스킬 id 로 해소된 것만 센다 — MP 부족/상태이상으로 불발된 행동은 " +
    "unresolved 로 빠지므로, unresolvedTotal 이 0 이 아니면 그쪽을 먼저 봐야 한다. " +
    "★distinctSkills 만으로 판정하지 말 것★: 순수 데미지 스킬끼리는 교대하지 않고 " +
    "승자만 바뀌므로 무속성→속성 같은 변화가 1→1 로 보인다. distinctElements 와 " +
    "actorStateGainsTotal 을 함께 읽어야 한다. 앞의 둘은 같은 roundLogs 를 다르게 접은 " +
    "값이라 추가 rng 소비가 없다(전/후 비교 성립).",
  runsPerTroop: SAMPLES,
  defaultTroops: summarizeUsage(defaultUsage),
  archetypeTroops: summarizeUsage(archetypeUsage),
};

// ── 5. caveat 생성 + 자체 검사 ───────────────────────────────────────────────
// caveat 이 인용하는 수치를 **산출물 값에서 생성**한다. 문자열에 손으로 숫자를 적지
// 않으므로 값이 어긋날 수 없다.
//
// 왜 이렇게까지 하는가(실제 사고): 라운드 3 에서 "50판 중 45판이 15턴에 전멸" 이라고
// 손으로 적었는데, 45 는 **집계 패스**의 winRate 0.1 에서 나온 수인 반면 그것이 설명하는
// perBattleTurns 는 **표본 패스** 산출물이었다. 표본 패스의 실제 패배 수는 49 다.
// 오독을 막으려고 쓴 문서가 옆 caveat 이 금지한 교차 패스 계산을 시연하고 있었다.
// 값이 존재하는지만 보는 검사로는 이걸 못 잡는다 — 45 는 JSON 안에 실제로 존재하는
// 수였기 때문이다. 그래서 각 인용 수치가 **어느 패스에서 왔는지**를 함께 들고 다니며
// 검사한다.
type Pass = "aggregate" | "sample";
interface Cite {
  /** 이 수를 읽어온 산출물 경로. 값도 패스도 전부 여기서 나온다. */
  readonly path: string;
  /**
   * 이 수가 나온 패스. **경로에서 유도한다 — 손으로 선언하지 않는다.**
   * 손으로 적으면 "선언한 패스 == 기대 패스" 검사가 항진명제가 되어, 집계 지표를
   * "sample" 이라 선언해 놓고 표본 패스 주장에 인용해도 무사통과한다(실측 확인).
   * 분류 불가면 undefined — 검사에서 실패시킨다.
   */
  readonly pass: Pass | undefined;
  readonly value: number;
}

function readPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<any>((node, key) => (node === undefined ? undefined : node[key]), root);
}

/**
 * 경로만 보고 어느 패스의 산출물인지 판정한다. 산출물 구조가 이미 답을 정해 두었다:
 * `perBattle*` 는 표본 패스(n=1 × SAMPLES) 전용이고, `winRate`/`avgTurns`/
 * `avgHpRemaining`/`avgPotionsUsed` 는 집계 패스(n=SAMPLES 1회)의 필드다.
 * `perBattleWinRate` 처럼 이름에 winRate 가 들어간 표본 필드가 있으므로 perBattle 판정이
 * 먼저 와야 한다.
 * 분류할 수 없으면 undefined 를 돌려준다 — 조용히 넘기면 새로 추가된 지표가 검사 밖으로 샌다.
 */
function passOf(path: string): Pass | undefined {
  if (/\.perBattle[A-Za-z]+\./.test(path)) return "sample";
  if (/\.(winRate|avgTurns|avgHpRemaining|avgPotionsUsed)$/.test(path)) return "aggregate";
  return undefined;
}

/** 경로 하나로 값과 패스를 **함께** 끌어온다. 둘이 어긋날 여지를 없앤다. */
function cite(path: string): Cite {
  return { path, pass: passOf(path), value: readPath(out, path) as number };
}

const EXAMPLE_TROOP = "드래곤·보스";
const ex = (archetypeSims as Record<string, any>)[EXAMPLE_TROOP];
// 이 예시는 perBattleTurns(= 표본 패스 산출물)를 설명한다. 따라서 인용하는 수는
// 전부 표본 패스에서 와야 한다. 아래 검사가 이 불변식을 강제한다.
const EXAMPLE_PASS: Pass = "sample";
const P = `archetypeSims.${EXAMPLE_TROOP}`;

const exTurnsMean = cite(`${P}.perBattleTurns.mean`);
const exTurnsStddev = cite(`${P}.perBattleTurns.stddev`);
const exTurnsMin = cite(`${P}.perBattleTurns.min`);
const exTurnsMax = cite(`${P}.perBattleTurns.max`);
const exSampleWinMean = cite(`${P}.perBattleWinRate.mean`);
const exHpMean = cite(`${P}.perBattleHpRemaining.mean`);
const exHpStddev = cite(`${P}.perBattleHpRemaining.stddev`);
const exHpMin = cite(`${P}.perBattleHpRemaining.min`);
const exHpMax = cite(`${P}.perBattleHpRemaining.max`);
// 승/패 수는 **표본 패스 승률**에서 유도한다. 집계 패스 winRate 로 계산하면 교차 패스다.
const exSampleWins = Math.round(exSampleWinMean.value * SAMPLES);
const exSampleLosses = SAMPLES - exSampleWins;
// 인용하면 안 되는 수(집계 패스에서 유도한 패배 수). 검사에서 본문에 없는지 확인한다.
const exAggWinRate: number = ex.winRate;
const exAggLosses = SAMPLES - Math.round(exAggWinRate * SAMPLES);

const EXAMPLE_CITES: readonly Cite[] = [
  exTurnsMean, exTurnsStddev, exTurnsMin, exTurnsMax,
  exSampleWinMean, exHpMean, exHpStddev, exHpMin, exHpMax,
];

const simEntries = Object.entries(sims as Record<string, any>);
const archEntries = Object.entries(archetypeSims as Record<string, any>);
// `contested` 는 기준선을 뜰 때 **손으로 적어 둔 기대치**다(ARCHETYPES 표). 승패혼합 함정이
// 실제로 걸리는 집합은 그게 아니라 **실측 winRate < 1** 집합이다. 기준선에서는 둘이 일치했다.
//
// 변경 후에는 갈릴 수 있고, 실제로 갈렸다. 그때 "기대치와 실측이 다르니 파일을 쓰지 않는다"
// 로 죽으면 **세상이 변했다는 이유로 측정을 거부하는 게이트**가 된다 — 이 스크립트의 존재
// 목적(전/후 비교)과 정면으로 충돌한다. 그래서 caveat 본문은 **실측 집합**을 인용하고,
// 기대치와의 어긋남은 죽이는 대신 산출물(archetypeContestedDivergence)에 기록해 드러낸다.
// 어긋남 자체가 이 과제가 봐야 할 신호다(적이 세졌나 약해졌나).
const authoredContested = archEntries.filter(([, v]) => v.contested).map(([k]) => k).sort();
const measuredContested = archEntries.filter(([, v]) => v.winRate < 1).map(([k]) => k).sort();
const contestedCount = measuredContested.length;
out.archetypeContestedDivergence = {
  note:
    "authored 는 ARCHETYPES 표의 contested 기대치, measured 는 이번 실측의 winRate<1 집합이다. " +
    "둘이 갈리면 적의 위협도가 달라졌다는 뜻이다 — onlyAuthored 는 '기대보다 약해져 승률이 " +
    "1.00 으로 포화한' 계열, onlyMeasured 는 '기대와 달리 승률을 끌어내린' 계열이다.",
  authored: authoredContested,
  measured: measuredContested,
  onlyAuthored: authoredContested.filter((k) => !measuredContested.includes(k)),
  onlyMeasured: measuredContested.filter((k) => !authoredContested.includes(k)),
};

// 두패스승률차이 예시: 편차가 가장 큰 항목 + 위 worked example. 이름을 손으로 적지 않는다.
const worstDivergence = archEntries
  .map(([k, v]) => ({ key: k, agg: v.winRate, sample: v.perBattleWinRate.mean, gap: Math.abs(v.winRate - v.perBattleWinRate.mean) }))
  .sort((a, b) => b.gap - a.gap)[0]!;
const exampleDivergence = { key: EXAMPLE_TROOP, agg: exAggWinRate, sample: exSampleWinMean.value };
const fmtDiv = (d: { key: string; agg: number; sample: number }): string => `${d.key} ${d.agg} vs ${d.sample}`;

// 본문을 세 조각으로 나눈다. 아래 검사 (3)이 **주장(claim)** 조각만 검사하기 위해서다.
// 경고(selfWarning) 조각은 "이렇게 계산하면 틀린다" 며 집계 패스 수를 **일부러** 인용하므로,
// 본문 전체를 검사하면 그 교육용 인용까지 오탐으로 잡힌다(실제로 첫 실행에서 잡혔다).
// 불변식은 "주장에 교차 패스 수를 쓰지 않는다" 이지 "본문에 그 수가 없다" 가 아니다.
const claim승패혼합통계 =
  "winRate 가 1 미만인 항목의 avgTurns / avgHpRemaining 은 **승리 판과 패배 판을 " +
  "섞은 평균**이다. simulateBattle 은 승패를 가리지 않고 totalTurns/totalHp 를 " +
  "누적하고(simulate.ts:257-260), 파티가 전멸하면 hpRemaining 이 0 으로 들어간다" +
  "(simulate.ts:186). 따라서 이 두 지표는 winRate 와 **반드시 함께** 읽어야 한다. " +
  "★방향 함정★: 적이 강해지면 winRate 가 내려가고 → 전멸 판이 늘어 avgHpRemaining 이 " +
  "내려가며 → 더 일찍 전멸해 avgTurns 도 **내려간다**. 즉 '전투가 깊어졌다' 와 " +
  "'전투가 짧아졌다' 가 같은 방향으로 움직인다. avgTurns 증가를 성공 신호로 쓰면 " +
  "정반대로 읽힌다. 승률이 크게 달라진 항목은 avgTurns/avgHpRemaining 을 직접 " +
  "비교하지 말고, winRate 를 먼저 보고 승률이 비슷한 항목끼리만 비교하라. " +
  `실례(이 기준선): archetypeSims['${EXAMPLE_TROOP}'] 의 perBattleTurns 는 ` +
  `{mean:${exTurnsMean.value}, stddev:${exTurnsStddev.value}, min:${exTurnsMin.value}, max:${exTurnsMax.value}} 다. ` +
  `stddev ${exTurnsStddev.value}, min=max=${exTurnsMax.value} — 이는 그 표본 패스 ` +
  `${SAMPLES}판이 **승패와 무관하게 전부 ${exTurnsMax.value}턴** 에 끝났다는 뜻이다 — 같은 패스의 승률인 ` +
  `perBattleWinRate.mean 값 ${exSampleWinMean.value} 기준으로 보면 ${exSampleWins}승 ${exSampleLosses}패인데, ` +
  `**유일한 ${exSampleWins}승도 ${exTurnsMax.value}턴**이었다. ` +
  `같은 항목의 perBattleHpRemaining 은 {mean:${exHpMean.value}, stddev:${exHpStddev.value}, ` +
  `min:${exHpMin.value}, max:${exHpMax.value}} 로 ` +
  `승패에 따라 ${exHpMin.value} / ${exHpMax.value} 두 값으로 갈리는데, 턴수만 승패에 전혀 반응하지 않는다. ` +
  `즉 이 값(${exTurnsMax.value})은 '전투 깊이' 가 아니라 '지금 이 전투에는 턴수를 바꿀 변수가 없다' 는 ` +
  "증거이고, 그래서 깊이 지표로 쓸 수 없다.";
const selfWarning승패혼합통계 =
  "(이 예시의 승패 수는 perBattleTurns 와 **같은 표본 패스**에서 읽었다. 집계 패스의 " +
  `winRate 값 ${exAggWinRate} 기준으로 '${exAggLosses}패' 를 계산하면 아래 두패스승률차이 가 금지한 교차 계산이 된다.)`;
const scope승패혼합통계 =
  `sims(기본 트룹 ${simEntries.length}개)는 전부 winRate ${simEntries[0]![1].winRate.toFixed(2)} 이라 이 함정이 ` +
  `걸리지 않는다. archetypeSims ${archEntries.length}개 중 ${contestedCount}개(이번 실측 winRate<1)가 해당된다.`;
const caveat승패혼합통계 = `${claim승패혼합통계} ${selfWarning승패혼합통계} ${scope승패혼합통계}`;

const caveat두패스승률차이 =
  "같은 항목의 winRate(집계 패스)와 perBattleWinRate.mean(표본 패스)이 눈에 띄게 " +
  `다를 수 있다. 실측(이 기준선): ${fmtDiv(worstDivergence)}, ${fmtDiv(exampleDivergence)}. ` +
  "모순이 아니라 표본 잡음이다 — mulberry32 는 n판 전체가 rng 스트림 하나를 " +
  `공유하므로(simulate.ts:240) 'n=${SAMPLES} 한 번' 과 'n=1 을 seed 옮겨 ${SAMPLES}번' 은 롤 소비 ` +
  `순서가 달라 서로 다른 ${SAMPLES}판을 뽑는다. n=${SAMPLES} 에서는 이 정도 편차가 정상이다. ` +
  "전/후 비교는 **같은 패스끼리만** 하라(winRate↔winRate, " +
  "perBattleWinRate.mean↔perBattleWinRate.mean). 둘을 교차 비교하면 없는 변화를 만든다.";

(out.meta as any).caveats = { 승패혼합통계: caveat승패혼합통계, 두패스승률차이: caveat두패스승률차이 };

// ── 자체 검사 ────────────────────────────────────────────────────────────────
// 통과 못 하면 파일을 쓰지 않고 종료 코드 1 로 죽는다. 조용히 잘못된 기준선을 남기면
// Task 6 이 그걸 진실로 믿는다.
const checks: { readonly name: string; readonly ok: boolean; readonly detail: string }[] = [];
const check = (name: string, ok: boolean, detail = ""): void => {
  checks.push({ name, ok, detail });
};

// 패배 수 대조용. `5패` 가 `45패` 의 접미사로 걸리는 오탐을 막으려고 앞자리 숫자를 배제한다.
const mentionsLosses = (text: string, losses: number): boolean =>
  new RegExp(`(?<!\\d)${losses}패`).test(text);

// (1) 경로가 산출물에서 **숫자로 해소되는가**. 경로 오타/구조 변경을 잡는다.
//     (값은 이 경로에서 읽어 문자열을 조립하므로 "값 == 산출물값" 은 항진명제라 무의미하다.
//      실제로 위험한 것은 경로가 조용히 undefined 로 풀려 본문에 undefined 가 박히는 쪽이다.)
for (const c of EXAMPLE_CITES) {
  check(`경로가 숫자로 해소  ${c.path}`, Number.isFinite(c.value), `값 ${String(c.value)}`);
}

// (2) ★핵심★ 인용한 수가 **설명 대상과 같은 패스**에서 왔는가.
//     라운드 3 의 결함이 정확히 이것이었다. (1) 같은 값 검사로는 절대 못 잡는다.
//     pass 는 passOf(path) 로 **유도**한 값이다 — 손으로 선언하면 이 검사가 항진명제가 되어
//     집계 지표를 표본 패스 주장에 인용해도 무사통과한다(라운드 4 의 실제 구멍이었다).
for (const c of EXAMPLE_CITES) {
  check(`패스 분류 가능  ${c.path}`, c.pass !== undefined, "passOf 가 분류하지 못했다(새 지표?)");
  check(`패스 일치(${EXAMPLE_PASS})  ${c.path}`, c.pass === EXAMPLE_PASS, `유도된 패스 ${String(c.pass)}`);
}
check(
  "승/패 수를 표본 패스 승률에서 유도했는가",
  exSampleWins === Math.round(exSampleWinMean.value * SAMPLES) && exSampleWinMean.pass === "sample",
  `${exSampleWins}승 ${exSampleLosses}패 (perBattleWinRate.mean ${exSampleWinMean.value}, 유도 패스 ${String(exSampleWinMean.pass)})`,
);

// (3) 교차 패스 오염 탐지: 두 패스의 패배 수가 다를 때, 본문이 집계 패스 쪽 수를
//     패배 수로 인용하고 있으면 라운드 3 의 결함이 재발한 것이다.
// 검사 대상은 **주장 조각**이다. 경고 조각은 반례로 집계 패스 수를 일부러 인용한다.
check(
  "주장에 집계 패스 패배 수를 쓰지 않았는가",
  exAggLosses === exSampleLosses || !mentionsLosses(claim승패혼합통계, exAggLosses),
  `집계 ${exAggLosses}패 / 표본 ${exSampleLosses}패`,
);
check("주장이 표본 패스 패배 수를 쓰는가", mentionsLosses(claim승패혼합통계, exSampleLosses), `${exSampleLosses}패`);

// (4) caveat 이 전제로 삼는 관계가 실제로 성립하는가.
// 기대치(contested)와 실측(winRate<1)의 어긋남은 **실패가 아니라 기록 대상**이다 —
// 위 archetypeContestedDivergence 주석 참조. 여기서는 그 기록이 실제로 남았는지만 본다.
check(
  "contested 기대/실측 어긋남이 산출물에 기록됐는가",
  (() => {
    const d = out.archetypeContestedDivergence as any;
    return Array.isArray(d?.onlyAuthored) && Array.isArray(d?.onlyMeasured);
  })(),
  `onlyAuthored ${(out.archetypeContestedDivergence as any).onlyAuthored.length} / onlyMeasured ${(out.archetypeContestedDivergence as any).onlyMeasured.length}`,
);
check("sims 는 전부 winRate 1.00(함정 비적용)", simEntries.every(([, v]) => v.winRate === 1), `${simEntries.length}개`);
check(
  "본문의 contested 개수가 실측과 일치",
  caveat승패혼합통계.includes(`${archEntries.length}개 중 ${contestedCount}개`),
  `${archEntries.length}개 중 ${contestedCount}개`,
);

// (4b) R21 세 축의 전제 검증.
// actorStateGains 를 "적이 건 상태" 로 읽으려면 영웅이 상태를 못 걸어야 한다.
// simulateBattle 의 자동 행동은 battleModel==="gen1" 일 때만 chooseAutoBattleCommand 를
// 쓰고, 아니면 무조건 {kind:"attack"} 이다(simulate.ts:171-175). 이 전제가 깨지면
// 파티에 붙은 상태의 출처가 모호해지므로 여기서 죽인다.
check(
  "영웅은 통상공격만 한다(actorStateGains 의 출처가 적으로 확정)",
  (project as any).system?.battleModel !== "gen1",
  `battleModel=${String((project as any).system?.battleModel)}`,
);
// 속성 축이 의미를 가지려면 스킬 레코드에 elementId 가 실제로 존재해야 한다.
check(
  "DB 에 속성 부착 스킬이 존재한다",
  (fullDb.skills as any[]).some((s: any) => s.elementId !== undefined),
  `${(fullDb.skills as any[]).filter((s: any) => s.elementId !== undefined).length}개`,
);

// (5) 두패스승률차이 예시가 실값과 일치하는가.
for (const d of [worstDivergence, exampleDivergence]) {
  const entry = (archetypeSims as Record<string, any>)[d.key];
  check(
    `두패스 예시 실값 일치  ${d.key}`,
    entry.winRate === d.agg && entry.perBattleWinRate.mean === d.sample,
    `${d.agg} vs ${d.sample}`,
  );
}

// (6) 조립 검사: 실제로 산출물에 들어간 문자열이 세 조각을 전부 담고 있는가.
//     지역 변수를 자기 자신과 대조하면 항진명제라 무의미하다 — **기록된 값**(out) 을 읽는다.
//     조립 중 조각이 빠지면(특히 교차 계산 자기경고) 다음 사람이 같은 실수를 되풀이한다.
const written승패혼합통계 = readPath(out, "meta.caveats.승패혼합통계");
for (const [label, segment] of [
  ["주장", claim승패혼합통계],
  ["자기경고", selfWarning승패혼합통계],
  ["적용범위", scope승패혼합통계],
] as const) {
  check(
    `산출물에 ${label} 조각이 담겼는가`,
    typeof written승패혼합통계 === "string" && written승패혼합통계.includes(segment),
    `${segment.slice(0, 24)}…`,
  );
}

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  console.error(`\n✗ caveat 자체 검사 실패 ${failed.length}/${checks.length} — 파일을 쓰지 않는다.`);
  for (const c of failed) console.error(`  FAIL  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  process.exit(1);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`);

// ── 콘솔 요약 ────────────────────────────────────────────────────────────────
const census = out.fullDatabaseCensus as any;
console.log(`적 행동 1개뿐: ${census.enemiesWithOneAction} / ${census.enemyCount}  (저작 표면: defaultDatabase)`);
const cov = census.authoredCoverage;
console.log(
  `저작 커버리지: 속성 ${cov.distinctElements}종 ${JSON.stringify(cov.byElement)} / ` +
    `상태 ${cov.distinctAddedStates}종 ${JSON.stringify(cov.byAddedState)}`,
);
console.log(`  속성기 보유 적 ${cov.enemiesWithElementalAction} / 상태기 보유 적 ${cov.enemiesWithStateAction} (총 ${census.enemyCount})`);
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
  console.log(`  ${" ".repeat(10)} byElement=${JSON.stringify(s.byElement)} distinctElements=${s.distinctElements}`);
  console.log(
    `  ${" ".repeat(10)} 상태부여 party=${s.actorStateGainsTotal} ${JSON.stringify(s.actorStateGains)}` +
      ` / enemy=${s.enemyStateGainsTotal} ${JSON.stringify(s.enemyStateGains)}`,
  );
}

const div = out.archetypeContestedDivergence as any;
if (div.onlyAuthored.length > 0 || div.onlyMeasured.length > 0) {
  console.log(`\n=== contested 기대/실측 어긋남 ===`);
  console.log(`  기대에만 있음(승률 포화로 약해짐): ${JSON.stringify(div.onlyAuthored)}`);
  console.log(`  실측에만 있음(기대보다 위협적):   ${JSON.stringify(div.onlyMeasured)}`);
}
console.log(`\ncaveat 자체 검사: ${checks.length}건 전부 통과`);
console.log(`\n기록: ${OUT_PATH}`);
