// 조사 지점 — 2026-11-11 작은 일 재측정(sign-starter · examine-fireplace-built): 「벽난로를 조사하면 글」 을 조수는 컷신 동사(add_event)로 만들었고,
// 연출 비평가가 한 줄짜리 조사 글에 「두 인물이 멀다」 를 달아 고칠 수 없는 할 일이 막힘으로 닫혔다. 자리 낱말은 채워 보낸 at:{0,0} 에 밀려 버려졌다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { resolveWhere } from "@/ai/v2/place/where";
import { classifyRequest } from "@/ai/v2/request/intent";
import { buildEvent } from "@/ai/v2/story/events";
import type { EventSpec } from "@/ai/v2/shared/types";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { GameMap, Project } from "@/project/types";

const hallOf = (project: Project): GameMap => Object.values(project.maps).find((map) => map?.name === "족장의 긴 집")!;

describe("place_examine_hotspots — on(물건 이름)", () => {
  it("이미 있는 물건의 칸을 찾아 그 위에 놓는다 — 채워 보낸 at:{0,0} 보다 앞선다", () => {
    const ctx = { project: buildFixture("built") };
    const hall = hallOf(ctx.project);
    const result = runTool(ctx, "place_examine_hotspots", { mapId: hall.id, hotspots: [{ on: "벽난로", at: { x: 0, y: 0 }, lines: ["장작이 따뜻하게 타오르고 있다."] }] });
    expect(result.ok, result.summary).toBe(true);
    const eventId = (result.data as { eventIds: string[] }).eventIds[0]!;
    const event = hallOf(ctx.project).events.find((entry) => entry.id === eventId)!;
    expect(event.name).toBe("벽난로");
    expect(result.summary).toContain(`벽난로(${event.x},${event.y})`);
    // 물건 칸 위다: 그 칸 윗층에 물건 타일이 있다(빈 바닥 위 투명 이벤트가 아니다).
    expect(hallOf(ctx.project).upperTiles[event.y * hall.width + event.x]).toBeGreaterThan(0);
    expect(event.trigger).toEqual({ kind: "action" });
    expect(event.pages![0]!.commands).toEqual([expect.objectContaining({ kind: "text", body: "장작이 따뜻하게 타오르고 있다." })]);
  });

  it("없는 물건이면 실패로 돌려준다(「0개 생성」 을 성공으로 주지 않는다)", () => {
    const ctx = { project: buildFixture("built") };
    const result = runTool(ctx, "place_examine_hotspots", { mapId: hallOf(ctx.project).id, hotspots: [{ on: "분수대", lines: ["…"] }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("분수대");
    expect(result.summary).toContain("stamp_object");
  });

  it("방금 찍은 표지판도 이름으로 찾는다(이정표 = 표지판)", () => {
    const ctx = { project: buildFixture("starter") };
    expect(runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-out-signpost", mapId: "map_ember_village", x: 12, y: 15, layers: "both", onOverlap: "nearest" }).ok).toBe(true);
    const result = runTool(ctx, "place_examine_hotspots", { mapId: "map_ember_village", hotspots: [{ on: "표지판", lines: ["잿불 마을에 오신 것을 환영합니다"] }] });
    expect(result.ok, result.summary).toBe(true);
    expect(result.warnings ?? []).toEqual([]);
  });

  it("조사 요청에는 이 도구가 처음부터 실린다", () => {
    const project = buildFixture("built");
    expect(classifyRequest("족장의 긴 집 벽난로를 조사하면 \"장작이 따뜻하게 타오르고 있다.\"라고 나오게 해 줘", project).smallTools).toContain("place_examine_hotspots");
  });
});

describe("자리 낱말과 함께 온 at (0,0)", () => {
  it("낱말이 있으면 (0,0) 은 채움으로 보고 낱말로 푼다 — 낱말이 없으면 그 칸이다", () => {
    const project = buildFixture("built");
    const hall = hallOf(project);
    const worded = resolveWhere(project, hall, "벽난로 앞", {});
    expect(resolveWhere(project, hall, "벽난로 앞", { at: { x: 0, y: 0 } }).cell).toEqual(worded.cell);
    expect(worded.how).toContain("벽난로");
    expect(resolveWhere(project, hall, "벽난로 앞", { at: { x: 3, y: 8 } }).cell).toEqual({ x: 3, y: 8 });
    expect(resolveWhere(project, hall, undefined, { at: { x: 0, y: 0 } }).how).toMatch(/^칸 /u);
  });
});

describe("add_event — 글만 나오는 조사·읽기는 연출한 장면이 아니다", () => {
  const build = (beats: EventSpec["beats"], when: "talk" | "touch") => {
    const ctx = { project: buildFixture("built") };
    return buildEvent(createBuildRun(ctx), { kind: "talk", mapId: hallOf(ctx.project).id, when, where: "벽난로 앞", beats } as EventSpec);
  };
  it("내레이션 한 줄은 무대를 싣지 않는다(연출 비평을 부르지 않는다)", () => {
    const read = build([{ do: "say", who: "", text: "장작이 따뜻하게 타오르고 있다." }], "talk");
    expect(read.ok, read.summary).toBe(true);
    expect(read.stage).toBeUndefined();
    expect(read.summary).toContain("조사 글");
    expect(build([{ do: "say", who: "", text: "찬 바람이 분다." }], "touch").stage).toBeUndefined();
  });
  it("사람이 말하거나 걷는 장면은 그대로 무대를 싣는다", () => {
    expect(build([{ do: "say", who: "이르마", text: "어서 와." }], "talk").stage).toBeDefined();
    expect(build([{ do: "walk", who: "주인공", to: "벽난로 앞" }, { do: "say", who: "", text: "따뜻하다." }], "talk").stage).toBeDefined();
  });
});
