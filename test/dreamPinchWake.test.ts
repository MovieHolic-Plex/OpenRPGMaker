// 꿈 세계 도그푸딩 2026-09-24: 볼 꼬집기가 type special + switchId 라 사용해도 안 깨고,
// 출구 없는 꿈 맵에 갇힌 채 자동 플레이가 「가는 문이 없다」로 막혔다.
import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runAutoPlay } from "@/qa/gameCheck/autoPlay";

function passableNear(project: ReturnType<typeof createBlankProject>, mapId: string, x: number, y: number, avoid: { x: number; y: number }[] = []): { x: number; y: number } {
  const map = project.maps[mapId]!;
  const blocked = new Set(avoid.map((cell) => `${cell.x},${cell.y}`));
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const candidate = { x: x + dx, y: y + dy };
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= map.width || candidate.y >= map.height) continue;
      if (blocked.has(`${candidate.x},${candidate.y}`)) continue;
      if (dx === 0 && dy === 0) continue;
      if (isPassable(project, map, candidate.x, candidate.y)) return candidate;
    }
  }
  throw new Error(`통행 칸 없음 ${mapId} (${x},${y})`);
}

function firstPassable(project: ReturnType<typeof createBlankProject>, mapId: string): { x: number; y: number } {
  const map = project.maps[mapId]!;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isPassable(project, map, x, y)) return { x, y };
    }
  }
  throw new Error(`통행 칸 없음 ${mapId}`);
}

describe("꿈에서 깨는 스위치 아이템", () => {
  it("switchId 만 있는 special 아이템은 switch 로 저장한다", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_wake", name: "깨기" });
    const ctx: ToolContext = { project };
    const result = runTool(ctx, "upsert_item", {
      item: { id: "item_pinch", name: "볼 꼬집기", type: "special", switchId: "sw_wake", occasion: "field", consumable: false, scope: "none" },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.database.items.find((item) => item.id === "item_pinch")).toMatchObject({ type: "switch", switchId: "sw_wake" });
    expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("switch");
  });

  it("출구 없는 맵에서 꼬집으면 방으로 돌아와 다음 맵의 엔딩까지 간다", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_wake", name: "깨기" }, { id: "sw_seen", name: "봄" });
    const ctx: ToolContext = { project };
    expect(runTool(ctx, "create_map", { id: "map_trap", name: "함정", width: 8, height: 8 }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_goal", name: "결말", width: 8, height: 8 }).ok).toBe(true);
    expect(runTool(ctx, "upsert_item", {
      item: { id: "item_pinch", name: "볼 꼬집기", type: "special", switchId: "sw_wake", occasion: "field", consumable: false, scope: "none" },
    }).ok).toBe(true);
    expect(runTool(ctx, "upsert_common_event", {
      id: "ce_wake", name: "깨기", trigger: "auto", conditionSwitchId: "sw_wake",
      commands: [
        { kind: "setSwitch", switchId: "sw_wake", value: false },
        { kind: "transfer", mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y, fade: "none" },
      ],
    }).ok).toBe(true);
    expect(runTool(ctx, "set_session_start", { inventory: { item_pinch: 1 }, partyActorIds: project.session.partyActorIds }).ok).toBe(true);

    const live = () => ctx.project;
    const trapLand = firstPassable(live(), "map_trap");
    const goalLand = firstPassable(live(), "map_goal");
    const trapMark = passableNear(live(), "map_trap", trapLand.x, trapLand.y);
    const goalMark = passableNear(live(), "map_goal", goalLand.x, goalLand.y);
    const door = passableNear(live(), live().startMapId, live().startPos.x, live().startPos.y);
    const goalDoor = passableNear(live(), live().startMapId, live().startPos.x, live().startPos.y, [door]);
    const touch = (id: string, name: string, at: { x: number; y: number }, mapId: string, land: { x: number; y: number }) => ({
      id, name, x: at.x, y: at.y,
      pages: [{
        conditions: [], graphic: { transparent: true }, priority: "below", overlapForbidden: false,
        trigger: { kind: "playerTouch" },
        commands: [{ kind: "transfer", mapId, x: land.x, y: land.y, fade: "none" }],
      }],
    });
    const trapDoor = runTool(ctx, "upsert_event", { mapId: live().startMapId, event: touch("ev_to_trap", "함정문", door, "map_trap", trapLand) });
    expect(trapDoor.ok, trapDoor.summary).toBe(true);
    const goalDoorEvent = runTool(ctx, "upsert_event", { mapId: live().startMapId, event: touch("ev_to_goal", "결말문", goalDoor, "map_goal", goalLand) });
    expect(goalDoorEvent.ok, goalDoorEvent.summary).toBe(true);
    const mark = runTool(ctx, "upsert_event", {
      mapId: "map_trap",
      event: {
        id: "ev_mark", name: "표식", x: trapMark.x, y: trapMark.y,
        pages: [{
          conditions: [], graphic: { transparent: true }, priority: "below", overlapForbidden: false,
          trigger: { kind: "action" },
          commands: [{ kind: "setSwitch", switchId: "sw_seen", value: true }],
        }],
      },
    });
    expect(mark.ok, mark.summary).toBe(true);
    live().endings = [{ id: "ending_wake", name: "끝", conditions: [], priority: 1 }];
    const endingEvent = runTool(ctx, "upsert_event", {
      mapId: "map_goal",
      event: {
        id: "ev_end", name: "거울", x: goalMark.x, y: goalMark.y,
        pages: [{
          conditions: [{ kind: "switch", switchId: "sw_seen", value: true }],
          graphic: { transparent: true }, priority: "below", overlapForbidden: false,
          trigger: { kind: "action" },
          commands: [{ kind: "triggerEnding", endingId: "ending_wake" }],
        }],
      },
    });
    expect(endingEvent.ok, endingEvent.summary).toBe(true);

    const woken = runSceneTest(live(), {
      mapId: "map_trap", start: trapLand,
      steps: [{ kind: "useItem", itemId: "item_pinch" }, { kind: "expect", mapId: live().startMapId }],
    });
    expect(woken.ok, woken.failureReason).toBe(true);

    const report = runAutoPlay(live(), { budgetMs: 20_000 });
    expect(report.runs[0]?.ok, report.runs[0]?.failure?.detail).toBe(true);
    expect(report.runs[0]?.endingReached).toBe("ending_wake");
  });
});
