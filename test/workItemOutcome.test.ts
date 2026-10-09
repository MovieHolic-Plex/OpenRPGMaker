import { describe, expect, it } from "vitest";
import {
  advanceWorkPlanFromTools,
  canCompleteWorkItem,
  completeWorkItemById,
  workPlanFromOrchestratorDecision,
} from "@/ai/workPlan";
import { createdMapIdFrom, isUnauthoredMap, verifyCreatedMapsAuthored } from "@/ai/workItemOutcome";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";

/** create_map 을 실제로 실행해 "만들기만 한 맵" 을 얻는다(초기값을 테스트가 흉내내지 않도록). */
function projectWithCreatedMap(mapId: string): { project: Project; map: GameMap } {
  // 쓰기 툴은 draft 를 만들어 ctx.project 를 갈아끼운다 — 원본이 아니라 ctx 쪽을 읽어야 한다.
  const ctx = { project: createEmptyToolProject() };
  const result = runTool(ctx, "create_map", { id: mapId, name: "숲길", width: 8, height: 8 }, { dryRun: false });
  expect(result.ok).toBe(true);
  const map = ctx.project.maps[mapId];
  expect(map).toBeDefined();
  return { project: ctx.project, map: map! };
}

describe("산출물 게이트 — create_map 직후 상태 판별", () => {
  it("create_map 직후의 맵은 미저작으로 본다", () => {
    const { map } = projectWithCreatedMap("m_new");
    expect(isUnauthoredMap(map)).toBe(true);
  });

  it("upper 타일이 한 칸이라도 있으면 저작된 것으로 본다", () => {
    const { map } = projectWithCreatedMap("m_new");
    map.upperTiles[0] = 297;
    expect(isUnauthoredMap(map)).toBe(false);
  });

  it("lower 가 두 종류 이상이면 저작된 것으로 본다", () => {
    const { map } = projectWithCreatedMap("m_new");
    map.lowerTiles[0] = TILE.PATH;
    expect(isUnauthoredMap(map)).toBe(false);
  });

  it("이벤트가 있으면 저작된 것으로 본다", () => {
    const { map } = projectWithCreatedMap("m_new");
    map.events.push({ id: "ev1", x: 1, y: 1, pages: [] } as unknown as GameMap["events"][number]);
    expect(isUnauthoredMap(map)).toBe(false);
  });

  it("이 항목이 만들지 않은 맵은 비어 있어도 검사하지 않는다", () => {
    const { project } = projectWithCreatedMap("m_untouched");
    expect(verifyCreatedMapsAuthored(project, []).ok).toBe(true);
  });

  it("만든 맵이 비어 있으면 사유에 맵 이름과 다음 행동이 담긴다", () => {
    const { project } = projectWithCreatedMap("m_new");
    const verdict = verifyCreatedMapsAuthored(project, ["m_new"]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("숲길(m_new)");
    expect(verdict.reason).toContain("skip_work_item");
  });
});

describe("createdMapIdFrom", () => {
  it("create_map 결과의 mapId 를 뽑는다", () => {
    expect(createdMapIdFrom("create_map", { name: "숲" }, { mapId: "m_a" })).toBe("m_a");
  });

  it("data 에 없으면 인자 id/mapId 로 폴백한다", () => {
    expect(createdMapIdFrom("create_map", { id: "m_b" }, undefined)).toBe("m_b");
    expect(createdMapIdFrom("run_interior_room_pipeline", { mapId: "m_c" }, undefined)).toBe("m_c");
  });

  it("맵을 만들지 않는 툴은 무시한다", () => {
    expect(createdMapIdFrom("place_npc", { mapId: "m_d" }, { mapId: "m_d" })).toBeNull();
  });
});

/**
 * 2026-08-28 회귀: doneWhen 이 "생성되고 칠해짐" 인데 successTools 가 ["create_map"] 하나여서
 * create_map 성공 즉시 항목이 done 이 됐고, 잔디 단색 맵이 그대로 남았다.
 */
describe("WorkPlan 완료 게이트 회귀 — 만들고 안 채운 맵", () => {
  const planWithPaintItem = () =>
    workPlanFromOrchestratorDecision({
      action: "new_plan",
      goal: "야외 필드 추가",
      layers: [
        {
          title: "신규 맵",
          items: [
            {
              title: "야외 필드 맵 생성",
              instruction: "create_map 후 지형 및 길 타일 페인팅",
              doneWhen: "맵이 생성되고 기본 지형이 칠해짐",
              successTools: ["create_map"],
            },
            { title: "다음", instruction: "noop", successTools: ["place_npc"] },
          ],
        },
      ],
    });

  it("successTools 를 채워도 산출물이 비면 자동 완료를 막는다", () => {
    const plan = planWithPaintItem();
    const { project } = projectWithCreatedMap("m_field");
    const gate = () => verifyCreatedMapsAuthored(project, ["m_field"]);

    const result = advanceWorkPlanFromTools(plan, ["create_map"], gate);
    expect(result.completed).toBeNull();
    expect(result.blocked?.item.title).toBe("야외 필드 맵 생성");
    expect(result.blocked?.reason).toContain("산출물 미완성");
    expect(plan.layers[0]?.items[0]?.status).toBe("in_progress");
  });

  it("맵을 채우면 같은 항목이 자동 완료된다", () => {
    const plan = planWithPaintItem();
    const { project, map } = projectWithCreatedMap("m_field");
    map.lowerTiles[0] = TILE.PATH;
    const gate = () => verifyCreatedMapsAuthored(project, ["m_field"]);

    const result = advanceWorkPlanFromTools(plan, ["create_map"], gate);
    expect(result.completed?.title).toBe("야외 필드 맵 생성");
    expect(result.next?.title).toBe("다음");
  });

  it("명시 complete_work_item 도 같은 게이트를 통과해야 한다", () => {
    const plan = planWithPaintItem();
    const { project } = projectWithCreatedMap("m_field");
    const gate = () => verifyCreatedMapsAuthored(project, ["m_field"]);
    const itemId = plan.layers[0]!.items[0]!.id;

    const blocked = completeWorkItemById(plan, itemId, undefined, {
      successfulTools: ["create_map"],
      outcomeGate: gate,
    });
    expect(blocked.ok).toBe(false);
    expect(plan.layers[0]?.items[0]?.status).toBe("in_progress");
  });

  it("게이트를 넘기지 않으면 종전 동작(툴 이름 매칭)을 유지한다", () => {
    const plan = planWithPaintItem();
    expect(advanceWorkPlanFromTools(plan, ["create_map"]).completed?.title).toBe("야외 필드 맵 생성");
  });

  it("successTools 가 없는 항목도 게이트를 적용받는다", () => {
    const item = { id: "L1-1", title: "t", instruction: "i", status: "in_progress" as const };
    const failing = () => ({ ok: false as const, reason: "산출물 미완성: 숲길(m_field)" });
    expect(canCompleteWorkItem(item, [], failing).ok).toBe(false);
    expect(canCompleteWorkItem(item, []).ok).toBe(true);
  });
});
