import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 회상 스토리 도그푸딩(2026-09-24): priority 를 생략한 투명 논리 이벤트(진입 컷신·문 열림 검사)가
// 기본 「same」 으로 서서 방 가운데를 막았다. 그림 없는 페이지는 발밑으로 둔다.
describe("upsert_event 그림 없는 페이지는 보이지 않는 벽이 되지 않는다", () => {
  it("priority 생략한 투명 auto·빈 action 페이지 위를 걸어 지나간다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const sw = ctx.project.switches[0]!.id;
    const put = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_gate", name: "문 열림 검사", x: 4, y: 2, pages: [
        { trigger: { kind: "action" }, graphic: { transparent: true } },
        { trigger: { kind: "auto" }, conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, commands: [{ kind: "wait", ms: 100 }] },
      ] },
    });
    expect(put.ok, put.summary).toBe(true);
    const pages = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_gate")!.pages!;
    expect(pages.map((page) => [page.priority, page.overlapForbidden])).toEqual([["below", false], ["below", false]]);
    const walk = runTool(ctx, "run_scene_test", {
      mapId, start: { x: 3, y: 2 },
      steps: [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }, { kind: "expect", playerAt: { x: 5, y: 2 } }],
    });
    expect(walk.ok, walk.summary).toBe(true);
  });

  it("그림이 있는 인물 페이지와 명시한 priority 는 그대로 둔다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const put = runTool(ctx, "upsert_event", {
      mapId,
      event: { id: "ev_wall", x: 6, y: 2, pages: [{ trigger: { kind: "action" }, priority: "same", graphic: { transparent: true } }] },
    });
    expect(put.ok, put.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_wall")!.pages![0]!.priority).toBe("same");
  });
});

describe("upsert_event 조건 모양 오류", () => {
  it("conditions 없는 all 조건을 JS 예외가 아니라 고칠 칸을 짚어 거부한다", () => {
    const ctx = { project: createBlankProject() };
    const res = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_x", x: 3, y: 3, pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "all" }] }] } });
    expect(res.ok).toBe(false);
    expect(res.summary).toContain("conditions[0].conditions");
    expect(res.summary).not.toContain("not iterable");
  });
});
