// ai/workItemOutcome.ts
//
// WorkItem 완료 게이트의 **산출물 검사**.
//
// 2026-08-28 실측(project oprn-4f65d09fb1, 요청 "음 다른맵을 더 만들자"): 플래너가 낸 항목은
//   instruction "create_map으로 30x30 크기의 야외 필드 맵 생성 후 지형 및 길 타일 페인팅"
//   doneWhen    "새로운 야외 필드 맵이 생성되고 기본 지형이 칠해짐"
// 인데 successTools 는 ["create_map"] 하나였다. advanceWorkPlanFromTools 가 doneWhen 을
// 읽지 않으므로 create_map 이 성공한 그 초(08:06:23)에 항목이 done 으로 넘어갔고 페인팅은
// 한 번도 실행되지 않았다. 남은 결과물은 create_map 초기값 그대로인 잔디 단색 맵 2장
// (30×30 · 20×20, lower 고유 타일 1종, upper 전부 EMPTY, 이벤트 0)이었다.
//
// 그래서 완료 판정을 "툴 이름이 성공했나"에서 **"산출물이 실제로 채워졌나"** 로 한 겹 더 조인다.
// 이 검사는 자연어 doneWhen 을 파싱하지 않는다 — 프로젝트 상태만 본다.

import { TILE } from "@/project/defaults/constants";
import {
  findQuestById,
  findQuestGraph,
  generateQuestWalkthrough,
  lintQuestGraph,
} from "@/project/quest/questGraph";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import type { BattleEventCondition, TroopRecord } from "@/project/types";
import type { GameMap, Project } from "@/project/types/project";

/** 새 맵을 만들어 내는 툴 — 이 툴이 성공하면 만들어진 mapId 를 항목 산출물로 추적한다. */
export const MAP_CREATING_TOOLS: ReadonlySet<string> = new Set([
  "create_map",
  "duplicate_map",
  "run_interior_room_pipeline",
]);

/** 툴 결과에서 새로 만들어진 mapId 를 꺼낸다(툴마다 data/args 위치가 달라 순서대로 훑는다). */
export function createdMapIdFrom(
  name: string,
  args: Record<string, unknown> | undefined,
  data: unknown,
): string | null {
  if (!MAP_CREATING_TOOLS.has(name)) return null;
  const fromData =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).mapId : undefined;
  for (const candidate of [fromData, args?.id, args?.mapId]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

/**
 * create_map 직후 상태 그대로인 맵인가 — 즉 "만들기만 하고 아무것도 안 채운" 맵.
 * 판정: 이벤트 0 + upper 전부 EMPTY + 타일 스택 없음 + lower 가 단일 타일로 균일.
 * 하나라도 어긋나면(길 한 줄, 가구 한 칸, 이벤트 하나) 저작이 시작된 것으로 본다.
 */
export function isUnauthoredMap(map: GameMap): boolean {
  if (map.events.length > 0) return false;
  if (Object.keys(map.lowerTileStacks ?? {}).length > 0) return false;
  if (Object.keys(map.upperTileStacks ?? {}).length > 0) return false;
  if (map.upperTiles.some((tile) => tile !== TILE.EMPTY)) return false;
  if (map.lowerTiles.length === 0) return true;
  const first = map.lowerTiles[0];
  return map.lowerTiles.every((tile) => tile === first);
}

/** 주어진 mapId 중 아직 손도 대지 않은 맵의 이름 목록(사용자/모델에게 보여줄 문구용). */
export function unauthoredMapLabels(project: Project, mapIds: Iterable<string>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const mapId of mapIds) {
    if (seen.has(mapId)) continue;
    seen.add(mapId);
    const map = project.maps[mapId];
    if (map && isUnauthoredMap(map)) labels.push(`${map.name}(${mapId})`);
  }
  return labels;
}

export type WorkItemOutcomeVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * 이번 항목에서 **새로 만든 맵**이 전부 저작됐는지 확인한다.
 * 기존 맵은 검사하지 않는다 — 사용자가 의도적으로 비워 둔 맵(예: "빈 맵")을 건드렸다는
 * 이유만으로 항목을 막으면 오탐이 된다. 항목이 만든 맵은 그 항목이 채울 책임이 있다.
 */
export function verifyCreatedMapsAuthored(
  project: Project,
  createdMapIds: Iterable<string>,
): WorkItemOutcomeVerdict {
  const blank = unauthoredMapLabels(project, createdMapIds);
  if (blank.length === 0) return { ok: true };
  return {
    ok: false,
    reason:
      `산출물 미완성: ${blank.join(", ")} — 맵을 만들기만 하고 지형·구조·이벤트를 하나도 넣지 않았습니다. ` +
      `fill_region/paint_road/author_house/place_props/place_npc 등으로 내용을 채운 뒤 완료하세요. ` +
      `정말 빈 맵으로 남겨야 하면 skip_work_item으로 사유를 남기고 건너뛰세요.`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 보스 페이즈 — "페이지를 썼다"가 아니라 "그 페이지가 실제로 발동했다"를 완료 조건으로 만든다.
//
// 저작 시점 검증(조건 kind/참조/무한반복)은 upsert_troop_battle_page 가 이미 한다. 그래도
// "조건이 도달 불가"는 정적으로 못 잡는다(HP 5% 임계, 30라운드 조건 → 8라운드에 끝나는 전투).
// 그래서 완료 게이트는 시뮬레이션 근거를 요구한다: 이 항목이 페이지를 쓴 트룹은
// simulate_battle 이 돌아가 있어야 하고, 모든 페이지가 최소 1판에서 발동해야 한다.
// ────────────────────────────────────────────────────────────────────────────

/** 트룹 전투 이벤트 페이지(=보스 페이즈)를 쓰는 툴. */
export const BATTLE_PAGE_AUTHORING_TOOLS: ReadonlySet<string> = new Set([
  "author_boss_phases",
  "upsert_troop_battle_page",
]);

/** 페이지를 저작한 트룹 id 를 꺼낸다(둘 다 args.troopId 계약). */
export function authoredTroopIdFrom(
  name: string,
  args: Record<string, unknown> | undefined,
  data: unknown,
): string | null {
  if (!BATTLE_PAGE_AUTHORING_TOOLS.has(name)) return null;
  const fromData =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).troopId : undefined;
  for (const candidate of [fromData, args?.troopId]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

/** simulate_battle 한 번의 페이즈 발동 근거(프로젝트 상태에 남지 않으므로 세션이 들고 있어야 한다). */
export interface BattlePhaseSimulation {
  readonly troopId: string;
  readonly samples: number;
  /** 한 판도 발동하지 않은 페이지 id. */
  readonly silentPageIds: readonly string[];
  /** 런타임이 처리하지 못한 커맨드가 있던 페이지 id. */
  readonly unsupportedPageIds: readonly string[];
}

/** simulate_battle 결과에서 페이즈 발동 근거를 꺼낸다. 다른 툴이면 null. */
export function battlePhaseSimulationFrom(
  name: string,
  args: Record<string, unknown> | undefined,
  data: unknown,
): BattlePhaseSimulation | null {
  if (name !== "simulate_battle") return null;
  const troopId = typeof args?.troopId === "string" ? args.troopId.trim() : "";
  if (troopId.length === 0) return null;
  const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const coverage = Array.isArray(record.phaseCoverage) ? record.phaseCoverage : [];
  const silentPageIds: string[] = [];
  const unsupportedPageIds: string[] = [];
  for (const entry of coverage) {
    if (typeof entry !== "object" || entry === null) continue;
    const phase = entry as { pageId?: unknown; firedRuns?: unknown; unsupported?: unknown };
    if (typeof phase.pageId !== "string") continue;
    if (typeof phase.firedRuns === "number" && phase.firedRuns === 0) silentPageIds.push(phase.pageId);
    if (typeof phase.unsupported === "number" && phase.unsupported > 0) unsupportedPageIds.push(phase.pageId);
  }
  return {
    troopId,
    samples: typeof record.samples === "number" ? record.samples : 0,
    silentPageIds,
    unsupportedPageIds,
  };
}

/** 조건이 참조하는 적 id — 트룹 편성이 나중에 바뀌면 페이지가 조용히 죽으므로 게이트가 다시 본다. */
function conditionEnemyIds(conditions: readonly BattleEventCondition[] | undefined): string[] {
  const ids: string[] = [];
  for (const condition of conditions ?? []) {
    const enemyId = (condition as { readonly enemyId?: unknown }).enemyId;
    if (typeof enemyId === "string" && enemyId.trim().length > 0) ids.push(enemyId);
  }
  return ids;
}

function troopEnemyIdSet(troop: TroopRecord): Set<string> {
  return new Set([...(troop.enemyIds ?? []), ...(troop.members ?? []).map((member) => member.enemyId)]);
}

/**
 * 이번 항목이 보스 페이즈를 쓴 트룹이 **연출까지 확인됐는지** 본다.
 * 검사: ① 페이지가 남아 있는지 ② 조건이 참조하는 적이 여전히 편성돼 있는지
 * ③ simulate_battle 근거가 있는지 ④ 모든 페이지가 최소 1판 발동했는지 ⑤ unsupported 커맨드가 없는지.
 */
export function verifyAuthoredBossPhases(
  project: Project,
  authoredTroopIds: Iterable<string>,
  simulations: ReadonlyMap<string, BattlePhaseSimulation>,
): WorkItemOutcomeVerdict {
  const seen = new Set<string>();
  for (const troopId of authoredTroopIds) {
    if (seen.has(troopId)) continue;
    seen.add(troopId);
    const troop = project.database.troops.find((entry) => entry.id === troopId);
    if (!troop) {
      return { ok: false, reason: `산출물 미완성: 페이즈를 쓴 트룹 '${troopId}'가 프로젝트에 없습니다.` };
    }
    const pages = troop.battleEventPages ?? [];
    if (pages.length === 0) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 트룹 '${troop.name}'(${troopId})에 전투 이벤트 페이지가 하나도 없습니다 — ` +
          `author_boss_phases 로 페이즈를 만든 뒤 완료하세요.`,
      };
    }
    const enemies = troopEnemyIdSet(troop);
    for (const page of pages) {
      const missing = conditionEnemyIds(page.conditions).filter((id) => !enemies.has(id));
      if (missing.length > 0) {
        return {
          ok: false,
          reason:
            `산출물 미완성: 트룹 '${troopId}' 페이지 '${page.id}' 조건이 편성에 없는 적(${missing.join(", ")})을 봅니다 — ` +
            `이 페이지는 절대 발동하지 않습니다. upsert_troop 으로 적을 편성하거나 조건을 고치세요.`,
        };
      }
    }
    const simulation = simulations.get(troopId);
    if (!simulation) {
      return {
        ok: false,
        reason:
          `검증 미실행: 트룹 '${troop.name}'(${troopId})의 페이즈 ${pages.length}개가 실제로 뜨는지 확인하지 않았습니다 — ` +
          `simulate_battle{troopId:'${troopId}', heroLevel:...} 을 돌려 phaseCoverage 를 확인한 뒤 완료하세요.`,
      };
    }
    const alive = new Set(pages.map((page) => page.id));
    const silent = simulation.silentPageIds.filter((id) => alive.has(id));
    if (silent.length > 0) {
      return {
        ok: false,
        reason:
          `산출물 미완성: ${simulation.samples}판 시뮬 동안 한 번도 발동하지 않은 페이즈 ${silent.join(", ")} — ` +
          `조건이 도달 불가합니다(HP 임계가 너무 낮거나 라운드 조건이 전투 길이보다 깁니다). ` +
          `임계를 올리거나 적 HP/공격을 조정한 뒤 simulate_battle 을 다시 돌리세요.`,
      };
    }
    const unsupported = simulation.unsupportedPageIds.filter((id) => alive.has(id));
    if (unsupported.length > 0) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 런타임이 처리하지 못한 커맨드가 있는 페이즈 ${unsupported.join(", ")} — 연출이 조용히 생략됩니다. ` +
          `해당 커맨드를 지원되는 것으로 바꾸세요.`,
      };
    }
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// 퀘스트 — "컴파일됐다"가 아니라 "완주 가능하다"를 완료 조건으로 만든다.
//
// 2026-08-24 감사: 퀘스트 툴(create_quest/define_quest/lint_quest/verify_quest)은 전부
// 구현돼 있는데도 실제 생성 세션에서 호출 횟수가 0이었다. 모델은 이벤트를 직접 깔고
// "퀘스트 완성"이라고 보고했고, 아무도 완주 가능한지 확인하지 않았다.
// 그래서 퀘스트를 만든 항목은 lint 0 + walkthrough + 실제 씬 완주까지 통과해야 완료된다.
// ────────────────────────────────────────────────────────────────────────────

/** 퀘스트를 등록하는 툴. */
export const QUEST_AUTHORING_TOOLS: ReadonlySet<string> = new Set(["create_quest", "define_quest"]);

/** 등록된 퀘스트 id 를 꺼낸다(create_quest 는 def.key, define_quest 는 id). */
export function authoredQuestIdFrom(name: string, args: Record<string, unknown> | undefined): string | null {
  if (!QUEST_AUTHORING_TOOLS.has(name)) return null;
  if (name === "define_quest") {
    return typeof args?.id === "string" && args.id.trim().length > 0 ? args.id.trim() : null;
  }
  const def = args?.def;
  if (typeof def !== "object" || def === null) return null;
  const key = (def as Record<string, unknown>).key;
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null;
}

/**
 * 이번 항목이 만든 퀘스트가 **완주 가능한지** 본다.
 * ① project.quests 메타 존재 ② 그래프 존재(검증 가능한 형태) ③ lint error 0
 * ④ walkthrough 생성 ⑤ 그 walkthrough 로 씬을 실제로 돌려 완주.
 */
export function verifyAuthoredQuestsPlayable(
  project: Project,
  questIds: Iterable<string>,
): WorkItemOutcomeVerdict {
  const seen = new Set<string>();
  for (const questId of questIds) {
    if (seen.has(questId)) continue;
    seen.add(questId);
    if (!findQuestById(project, questId)) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 퀘스트 '${questId}' 메타가 project.quests 에 없습니다 — ` +
          `create_quest 또는 define_quest 로 다시 등록하세요.`,
      };
    }
    const graph = findQuestGraph(project, questId);
    if (!graph) {
      return {
        ok: false,
        reason:
          `검증 불가: 퀘스트 '${questId}'는 컴파일 메타만 있고 그래프가 없어 완주 검증을 할 수 없습니다 — ` +
          `define_quest{id:'${questId}', nodes:[단계별 completesWhen 은 sw_${questId}_step0.. / sw_${questId}_done]} ` +
          `로 그래프를 등록한 뒤 verify_quest 로 확인하세요.`,
      };
    }
    const errors = lintQuestGraph(project, graph).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 퀘스트 '${questId}' lint error ${errors.length}건 — ` +
          `${errors.slice(0, 2).map((issue) => issue.message).join(" / ")}. lint_quest 로 전체를 보고 고치세요.`,
      };
    }
    let steps: readonly SceneStep[];
    let startMapId: string;
    let start: { readonly x: number; readonly y: number };
    try {
      const walkthrough = generateQuestWalkthrough(project, questId);
      steps = walkthrough.scenario.steps as readonly SceneStep[];
      startMapId = walkthrough.scenario.mapId;
      start = walkthrough.scenario.start;
    } catch (cause) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 퀘스트 '${questId}' walkthrough 생성 실패 — ` +
          `${cause instanceof Error ? cause.message : String(cause)}`,
      };
    }
    const result = runSceneTest(project, { mapId: startMapId, start, steps: steps as SceneStep[] });
    if (!result.ok) {
      return {
        ok: false,
        reason:
          `산출물 미완성: 퀘스트 '${questId}' 완주 실패 — step ${result.failedStepIndex}: ${result.failureReason ?? "원인 불명"}. ` +
          `흔한 원인은 선행 단계 누락입니다 — 기버 대화(sw_${questId}_started) 노드가 없으면 뒤 단계 이벤트가 아무것도 하지 않습니다. ` +
          `verify_quest{questId:'${questId}'} 로 재현해 고치세요.`,
      };
    }
  }
  return { ok: true };
}
