// 「동료가 파티에 있을 때만」을 다른 이름으로 쓴 조건과 장면 시험의 파티 바꾸기(2026-11-03 조수 대조 B7 설원:
// Argon 의 {kind:"actorInParty"} 페이지 조건 넷이 이벤트째 거절, Opus 의 {kind:"actor"} present 누락·run_scene_test set.party 거절,
// v2 도구 풀에 place_field_obstacle 이 없어 「없는 도구」).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";
import { v2ExtraToolNames } from "@/ai/v2/game";
import { runSceneTest } from "@/testing/sceneTestRunner";

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
