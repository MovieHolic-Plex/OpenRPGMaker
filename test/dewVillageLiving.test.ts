// 데모 마을이 "살아 있는" 상태로 출하되는지 지키는 가드.
//
// 실측 배경(2026-07-26): 집 12채 마을에 주민 4명, 그중 3명이 movement=fixed 로 고정,
// 시간표 0개, system.timeSystem 미설정. 시간 시스템이 꺼지면 updateNpcSchedules 가 즉시
// return 하므로 시간표를 넣어도 아무도 움직이지 않는다.
import { describe, expect, it } from "vitest";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { enlivenDewVillage } from "@/project/defaults/dewVillageLiving";
import { isPassable } from "@/project/collision";
import { resolveTimeSystem } from "@/project/gameTime";
import { runTool, type ToolContext } from "@/editor/tools";

describe("데모 마을 하루 일과", () => {
  const project = createSampleAdventureProject();
  const map = project.maps[project.startMapId]!;
  const scheduled = map.events.filter((event) => (event.schedule?.length ?? 0) > 0);

  it("시간 시스템이 켜져 있다 — 꺼지면 시간표가 실행되지 않는다", () => {
    expect(resolveTimeSystem(project)).toBeDefined();
  });

  it("주민에게 시간표가 붙어 있다", () => {
    expect(scheduled.length).toBeGreaterThanOrEqual(4);
  });

  it("모든 시간표 목적지가 통행 가능한 칸이다 — 벽 안으로 걸어가면 NPC 가 끼인다", () => {
    const stuck: string[] = [];
    for (const event of scheduled) {
      for (const entry of event.schedule ?? []) {
        const target = project.maps[entry.at.mapId];
        if (!target || !isPassable(project, target, entry.at.x, entry.at.y)) {
          stuck.push(`${event.id} → (${entry.at.x},${entry.at.y})`);
        }
      }
    }
    expect(stuck).toEqual([]);
  });

  it("하루가 아침·낮·저녁 3단계를 덮는다", () => {
    for (const event of scheduled) {
      expect(event.schedule?.length, `${event.id} 단계 수`).toBe(3);
    }
  });

  it("활동이 단조롭지 않다 — 평가기의 npcActivityKinds 지표가 이 다양성을 본다", () => {
    const activities = new Set(scheduled.flatMap((e) => (e.schedule ?? []).map((s) => s.activity)));
    expect(activities.size).toBeGreaterThanOrEqual(4);
  });

  it("저녁에 전원이 귀가하지는 않는다 — 밤 마을이 텅 비면 죽은 마을로 보인다", () => {
    const eveningOut = scheduled.filter((event) => {
      const home = event.schedule?.[0]?.at;
      const evening = event.schedule?.[2]?.at;
      return home && evening && (home.x !== evening.x || home.y !== evening.y);
    });
    expect(eveningOut.length).toBeGreaterThan(0);
  });

  it("두 번 적용해도 시간표가 중복되지 않는다(멱등)", () => {
    const again = enlivenDewVillage(project);
    expect(again.scheduledNpcs).toBe(scheduled.length);
    for (const event of map.events) {
      if ((event.schedule?.length ?? 0) > 0) expect(event.schedule!.length).toBe(3);
    }
  });

  it("붙이지 못한 주민이 없다 — 조용히 건너뛰면 마을이 반만 살아난다", () => {
    const fresh = createSampleAdventureProject();
    // 이미 적용된 프로젝트라 skipped 를 다시 보려면 시간표를 지우고 재적용한다.
    for (const event of fresh.maps[fresh.startMapId]!.events) delete event.schedule;
    expect(enlivenDewVillage(fresh).skipped).toEqual([]);
  });
});

describe("시간 시스템이 꺼진 프로젝트 경고", () => {
  it("set_npc_schedule 은 시간표가 실행되지 않는다고 경고한다", () => {
    const project = createSampleAdventureProject();
    // 시간 시스템을 끈 상태를 만든다 — 사용자가 끄고 시간표를 넣는 상황.
    project.system = { ...project.system, timeSystem: { enabled: false } };
    const mapId = project.startMapId;
    const ctx: ToolContext = { project };
    const result = runTool(
      ctx,
      "set_npc_schedule",
      {
        mapId,
        eventId: "ev_kid",
        schedule: [{ when: { hourRange: [10, 18] }, at: { mapId, x: 50, y: 52 }, activity: "play" }],
      },
      { dryRun: true },
    );
    // 쓰기 도구의 경고는 diff.warnings 로 모인다(toolRunner.ts:121).
    expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ")).toContain("시간 시스템이 꺼져 있어");
  });

  it("시간 시스템이 켜져 있으면 경고하지 않는다", () => {
    const project = createSampleAdventureProject();
    const mapId = project.startMapId;
    const ctx: ToolContext = { project };
    const result = runTool(
      ctx,
      "set_npc_schedule",
      {
        mapId,
        eventId: "ev_kid",
        schedule: [{ when: { hourRange: [10, 18] }, at: { mapId, x: 50, y: 52 }, activity: "play" }],
      },
      { dryRun: true },
    );
    expect([...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ")).not.toContain("시간 시스템이 꺼져 있어");
  });
});
