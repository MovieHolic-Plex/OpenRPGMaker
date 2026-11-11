// 몬스터 원정 맞추기의 시간 예산과 모의 전투 — 예산 열고 지키기(beginFitBudget·guardFitBudget), 빠른 모드, 상태 찍기·되돌리기, 승률 모의(fitSimulate).
import { simulateBattle } from "@/battle/simulate";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

/** 곡선으로 올린 길 상대를 스타터 혼자 이겨야 하는 모의전 승률과 판 수(시드 고정 — 결정적). */
export const FIT_WIN_RATE = 0.8;

const FIT_SAMPLES = 40;

/** 전체 마감: 맞춤 전체(단계 예산 둘 + 바퀴)가 이 시간을 넘으면 더 하지 않는다. */
const FIT_TOTAL_MS = 150_000;

const FIT_SAMPLES_FAST = 10;

/**
 * 맞춤 모의전(시드 1·40판·가장 좋은 기술) 결과 캐시 — 입력이 같으면 결과도 같다(결정적).
 * 키 = 트룹 레코드 + 그 적 레코드 전부(종·레벨·능력치·기술) + 영웅 레벨 + 몬스터 파티(종·레벨·HP·기술). 프로젝트마다 따로 둔다.
 * 끝맺음은 같은 판을 수없이 다시 잰다(바퀴 셋 · 후보 시험 뒤 되돌리기 · 단계마다 같은 관문) — 없을 때 맞춤만 416초, 끝맺음 전체 약 9분(2026-10-29).
 * 그 밖에 모의전에 들어가는 것(기술·상태·타입 표·종 능력치)은 맞춤 중에 바뀌지 않는다 — 종의 배우는 기술 레벨(②)은 파티 기술에 드러난다.
 */
const fitSimCache = new WeakMap<Project, Map<string, ReturnType<typeof simulateBattle>>>();

/**
 * 맞춤 시간 예산(벽시계). 끝맺음 한 번이 필수전투 모의전을 수백 초 동기로 돌려 워커 이벤트 루프를 막고, heartbeat 가 멎어 호스트가 300초
 * 무음으로 턴을 끊었다(2026-11-09 monster m3~m9 일곱 판: assembly:ship-defaults 414초 · 프로파일 80% 가 fitRequiredBattlesToStarters 의 simulateBattle,
 * 캐시 키 계산은 0.18초 — 비용은 키가 아니라 모의전 자체). 예산을 넘으면 FitBudgetExceeded 를 던져 맞춤 전체를 «미완» 으로 멈추고, 호출자가
 * 침묵하지 않고 기록한다(applied 한 줄 + session.fitIncomplete → 최종 보고; 끝내기는 막지 않는다). 시험 한가운데서 끊기면 시험값이 남으므로 호출자(applyShipDefaults)가 바퀴 단위로 snapshotFitState/restoreFitState 해 마지막으로 끝난 바퀴로 돌아간다 — 레벨 곡선이 덜 맞을 뿐이다.
 */
export const FIT_BUDGET_MS = 60_000;

/** applied 줄의 머리말 — 끝맺음 단계가 이 접두로 «맞춤 미완» 을 알아본다. */
export const FIT_INCOMPLETE_PREFIX = "required-battle fit incomplete (budget";

export class FitBudgetExceeded extends Error { constructor(readonly spentMs: number) { super(`${FIT_INCOMPLETE_PREFIX} ${Math.round(FIT_BUDGET_MS / 1000)}s)`); } }

interface FitBudget { start: number; limitMs: number; /** 단계 한도와 별개의 전체 마감(처음 시작부터) — 빠른 모드 재시도·바퀴가 쌓여 300초 무음을 넘기지 않게 한다. */ deadline: number; exceededAt?: number; /** 예산은 필수전투 단계에서만 검사한다(곡선·길 맞춤은 싸다 — 실측 gate 2.5s·route 5ms·required 174s). */ guarded: boolean; /** 빠른 모드 = 모의전 표본 10(정밀 40) — 0% 와 80% 는 가르고 시간은 1/4. */ fast: boolean }

const fitBudgets = new WeakMap<Project, FitBudget>();

/** 이 프로젝트의 맞춤 예산을 새로 시작한다(끝맺음 한 번 = applyShipDefaults 한 번). 이미 초과한 기록은 지운다. */
export function beginFitBudget(project: Project, limitMs = FIT_BUDGET_MS): void { fitBudgets.set(project, { start: Date.now(), limitMs, deadline: Date.now() + (limitMs < 0 ? limitMs : FIT_TOTAL_MS), guarded: false, fast: false }); }

/** 필수전투 단계의 시작·끝 — 예산 검사는 이 사이에서만 한다. 시작할 때 예산 시계를 새로 켠다(앞 싼 단계의 시간은 세지 않는다). */
export function guardFitBudget(project: Project, on: boolean): void { const b = fitBudgets.get(project); if (!b) return; b.guarded = on; if (on) { b.start = Date.now(); b.exceededAt = undefined; } }

/** 빠른 모드로 바꾸고 예산 시계를 새로 켠다(예산을 넘긴 뒤 한 번 더 시도할 때). */
export function enterFastFit(project: Project): void { const b = fitBudgets.get(project); if (b) { b.fast = true; b.start = Date.now(); b.exceededAt = undefined; } }

/** 빠른 모드는 필수전투 단계(guarded) 안에서만 쓴다 — 싼 단계(곡선·길)는 예산 밖이라 정밀 40판으로 돈다. */
export function fitIsFast(project: Project): boolean { const b = fitBudgets.get(project); return b?.fast === true && b.guarded; }

/** 마지막 맞춤이 예산을 넘겨 멈췄나(다음 beginFitBudget 까지 남는다). 프로젝트 객체는 체크포인트·다시 읽기에서 바뀌어 기록을 못 지키므로 보고용 기록은 session.fitIncomplete 에 있다 — 이것은 같은 호출 안의 확인·테스트용이다. */
export function fitBudgetExceeded(project: Project): number | undefined { return fitBudgets.get(project)?.exceededAt; }

/** 맞춤이 건드리는 부분의 스냅숏 — 적·트룹·종 배우는 기술 레벨·맵 조우표와 이벤트(선물 동료 splice). 예산이 시험 한가운데서 터져도 이 상태로 돌린다. */
interface FitState { readonly enemies: unknown; readonly troops: unknown; readonly species: unknown; readonly maps: ReadonlyMap<string, { readonly encounterTable: unknown; readonly events: unknown }> }

export function snapshotFitState(project: Project): FitState {
  const maps = new Map<string, { encounterTable: unknown; events: unknown }>();
  for (const [id, map] of Object.entries(project.maps)) maps.set(id, { encounterTable: structuredClone(map.encounterTable), events: structuredClone(map.events) });
  return { enemies: structuredClone(project.database.enemies), troops: structuredClone(project.database.troops), species: structuredClone(project.database.monsterSpecies), maps };
}

/** snapshotFitState 로 돌린다 — 값을 제자리에서 다시 대입한다(프로젝트 객체의 정체성은 그대로). */
export function restoreFitState(project: Project, state: FitState): void {
  project.database.enemies = state.enemies as typeof project.database.enemies;
  project.database.troops = state.troops as typeof project.database.troops;
  if (state.species !== undefined) project.database.monsterSpecies = state.species as NonNullable<typeof project.database.monsterSpecies>;
  for (const [id, saved] of state.maps) {
    const map = project.maps[id];
    if (!map) continue;
    map.encounterTable = saved.encounterTable as typeof map.encounterTable;
    map.events = saved.events as typeof map.events;
  }
}

export function checkFitBudget(project: Project): void {
  const budget = fitBudgets.get(project);
  if (!budget || !budget.guarded) return;
  if (budget.exceededAt !== undefined) throw new FitBudgetExceeded(budget.exceededAt);
  const now = Date.now();
  const spent = now - budget.start;
  if (spent > budget.limitMs || now > budget.deadline) { budget.exceededAt = spent; throw new FitBudgetExceeded(spent); }
}

export function fitSimulate(project: Project, troopId: string, heroLevel: number, monsterParty: MonsterInstance[]): ReturnType<typeof simulateBattle> {
  const troop = project.database.troops.find((item) => item.id === troopId);
  const enemies = (troop?.enemyIds ?? []).map((id) => project.database.enemies.find((item) => item.id === id) ?? null);
  const samples = fitIsFast(project) ? FIT_SAMPLES_FAST : FIT_SAMPLES;
  const key = JSON.stringify([troop ?? troopId, enemies, heroLevel, monsterParty, samples]);
  let cache = fitSimCache.get(project);
  if (!cache) fitSimCache.set(project, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  checkFitBudget(project); // 캐시 적중은 공짜 — 새 모의전을 시작하기 전에만 예산을 본다.
  const result = simulateBattle({ project, troopId, heroLevel, monsterParty, n: samples, seed: 1, useSkills: true });
  cache.set(key, result);
  return result;
}
