import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { offPurposeProps } from "@/ai/v2/place/roomPurpose";
import { canMove, isPassable } from "@/project/collision";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";
import { v2ExtraToolNames } from "@/ai/v2/request/readers";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { isolateTimers } from "./mergedTeardown";

// stamp_object 겹침 처리(2026-10-25 J64): 학교 교실에 남은 소파·냉장고 때문에 책상 11번 거부 — 쓰임에 안 맞는 가구는 걷어 내고,
// onOverlap:'nearest' 는 가까운 빈 자리에, 'replace' 는 겹친 가구를 걷고 찍는다.
describe("stampObjectOverlap", () => {
  isolateTimers();
  const DESK = "kit:modern_city/mc-in-mci-desk-pc-back";
  function room(name: string, kind: string): { ctx: ToolContext; mapId: string } {
    const ctx: ToolContext = { project: createBlankProject() };
    const built = runTool(ctx, "build_hand_interior_room", { tileset: "modern_city", name, layout: { rooms: [{ id: kind, kind, w: 9, h: 8 }] } });
    expect(built.ok).toBe(true);
    return { ctx, mapId: String((built.data as { mapId?: string } | undefined)?.mapId ?? ctx.project.startMapId) };
  }
  describe("stamp_object 겹침", () => {
    it("겹치면 거부하고 nearest·replace 를 알려 준다, nearest 는 빈 자리에, replace 는 걷고 찍는다", () => {
      const { ctx, mapId } = room("사무실", "staffroom");
      expect(runTool(ctx, "stamp_object", { objectId: DESK, mapId, x: 3, y: 4 }).ok).toBe(true);
      const refused = runTool(structuredClone(ctx), "stamp_object", { objectId: DESK, mapId, x: 4, y: 4 });
      expect(refused.ok).toBe(false);
      expect(refused.issues?.[0]?.message).toContain("onOverlap:'replace'");
      const near = runTool({ project: structuredClone(ctx.project) }, "stamp_object", { objectId: DESK, mapId, x: 4, y: 4, onOverlap: "nearest" });
      expect(near.ok).toBe(true);
      expect(near.summary).not.toContain("(4,4)");
      const replaced = runTool({ project: structuredClone(ctx.project) }, "stamp_object", { objectId: DESK, mapId, x: 4, y: 4, onOverlap: "replace" });
      expect(replaced.ok).toBe(true);
      expect(replaced.summary).toContain("(4,4)");
    });

    it("학교 맵의 거실 견본 소파 위에는 기본값으로도 걷어 내고 찍는다", () => {
      const { ctx, mapId } = room("밤의 학교 본관", "living");
      const off = offPurposeProps(ctx.project, ctx.project.maps[mapId]!);
      const sofa = off[0]?.props.find((p) => /소파/u.test(p.label));
      expect(sofa).toBeDefined();
      const res = runTool(ctx, "stamp_object", { objectId: DESK, mapId, x: sofa!.at.x, y: sofa!.at.y + 1 });
      expect(res.ok).toBe(true);
      const left = offPurposeProps(ctx.project, ctx.project.maps[mapId]!).flatMap((r) => r.props.map((p) => p.label));
      expect(left.filter((l) => /소파/u.test(l)).length).toBeLessThan(off[0]!.props.filter((p) => /소파/u.test(p.label)).length);
    });
  });
  it("stamps a desk and warns only when it cuts off nearby walkable floor", () => {
    const { ctx, mapId } = room("창고", "storage");
    const map = ctx.project.maps[mapId]!;
    // Extend the north wall by a tile. The corner can now be approached only from the south.
    map.lowerTiles[3 * map.width + 3] = map.lowerTiles[2 * map.width + 3]!;
    expect(canMove(ctx.project, map, 1, 4, 1, 3)).toBe(true);

    const closing = runTool(ctx, "stamp_object", { objectId: DESK, mapId, x: 1, y: 3 });
    expect(closing.ok).toBe(true);
    expect(closing.diff?.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/Boxed in:.*\(1,3\).*\(2,3\)/u)]));
    const stamped = ctx.project.maps[mapId]!;
    expect(isPassable(ctx.project, stamped, 1, 3)).toBe(true);
    expect(canMove(ctx.project, stamped, 1, 4, 1, 3)).toBe(false);

    const open = runTool(ctx, "stamp_object", { objectId: DESK, mapId, x: 4, y: 5 });
    expect(open.ok).toBe(true);
    expect(open.diff?.warnings ?? []).not.toEqual(expect.arrayContaining([expect.stringContaining("Boxed in:")]));
  });
});

// 「동료가 파티에 있을 때만」을 다른 이름으로 쓴 조건과 장면 시험의 파티 바꾸기(2026-11-03 조수 대조 B7 설원:
// Argon 의 {kind:"actorInParty"} 페이지 조건 넷이 이벤트째 거절, Opus 의 {kind:"actor"} present 누락·run_scene_test set.party 거절,
// v2 도구 풀에 place_field_obstacle 이 없어 「없는 도구」).
describe("partyConditionAliases", () => {
  isolateTimers();
  describe("파티 조건 별칭", () => {
    it("actorInParty 페이지 조건을 actor 조건으로 받는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const actorId = ctx.project.database.actors[0]!.id;
      const r = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_gap", name: "틈", x: 3, y: 3, pages: [
        { id: "p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "혼자는 못 건넌다." }] },
        { id: "p2", conditions: [{ kind: "actorInParty", actorId, present: true }], trigger: { kind: "action" }, commands: [{ kind: "text", body: "건넜다." }] },
      ] } });
      expect(r.ok, r.summary).toBe(true);
      const ev = ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_gap")!;
      expect(ev.pages![1]!.conditions).toEqual([{ kind: "actor", actorId, present: true }]);
    });

    it("fork 의 actor 조건에 present 가 없으면 「있다」로 채운다", () => {
      const command: Record<string, unknown> = { kind: "fork", condition: { kind: "actor", actorId: "actor_ranger" }, then: [], else: [] };
      expect(canonicalizeCommandFieldAlias(command)).toContain("파티에 있다");
      expect(command.condition).toEqual({ kind: "actor", actorId: "actor_ranger", present: true });
    });
  });
  describe("장면 시험 set.party", () => {
    it("전투 파티를 바꿔 조건 양쪽을 시험한다", () => {
      const project = createBlankProject();
      const [a, b] = project.database.actors.map((actor) => actor.id);
      const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 2, y: 2 }, steps: [
        { kind: "set", party: [b ?? a!] }, { kind: "expect", partyExcludes: b ? [a!] : [] },
      ] } as never);
      expect(result.ok, JSON.stringify(result)).toBe(true);
    });
  });
  describe("v2 도구 묶음", () => {
    it("틈을 건너는 요청은 place_field_obstacle 을 싣는다", () => {
      expect(v2ExtraToolNames("두 장 모두 길을 가로지르는 얼음 틈이 하나씩 있어서 새라가 파티에 있을 때만 건널 수 있어.")).toContain("place_field_obstacle");
    });
  });
});
