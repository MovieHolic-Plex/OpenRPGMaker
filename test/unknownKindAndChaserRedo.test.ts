// 알 수 없는 명령 kind 에 「이걸 뜻했나」를 붙이고, 같은 id 로 make_chase_scene 을 다시 부르면 그 추격자를 다시 만든다
// (2026-11-04 조수 대조: Argon 의 {kind:"conditionalBranch"} 가 「알 수 없는 kind」뿐인 글로 두 번 거절, Opus 의 추격자 속도 고치기가
// 「이미 있습니다」로 두 번 거절).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const page = (commands: unknown[]) => ({ id: "p", conditions: [], trigger: { kind: "action" }, commands });

describe("알 수 없는 명령 kind 안내", () => {
  it("다른 엔진 이름은 이 엔진의 모양을, 오타는 가까운 kind 를 알려 준다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const foreign = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_a", name: "a", x: 3, y: 3, pages: [page([{ kind: "conditionalBranch", condition: { kind: "gold", op: ">=", amount: 20 }, then: [] }])] } });
    expect(foreign.ok).toBe(false);
    expect(foreign.summary).toContain("this engine's equivalent is fork");
    const typo = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_b", name: "b", x: 4, y: 3, pages: [page([{ kind: "showPicturez", pictureId: "x" }])] } });
    expect(typo.ok).toBe(false);
    expect(typo.summary).toMatch(/did you mean: showPicture\b/u);
  });
});

describe("make_chase_scene 같은 id 다시 부르기", () => {
  it("추격자는 새 인자로 다시 만들고, 추격자가 아닌 이벤트는 덮지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx, "make_chase_scene", { mapId, id: "ev_knight", chaser: { at: { x: 5, y: 5 }, speed: 3 } }).ok).toBe(true);
    const again = runTool(ctx, "make_chase_scene", { mapId, id: "ev_knight", chaser: { at: { x: 5, y: 5 }, speed: 5 } });
    expect(again.ok, again.summary).toBe(true);
    const knights = ctx.project.maps[mapId]!.events.filter((e) => e.id === "ev_knight");
    expect(knights).toHaveLength(1);
    expect(knights[0]!.pages![0]!.movement.speed).toBe(5);
    expect(runTool(ctx, "upsert_event", { mapId, event: { id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [page([{ kind: "text", body: "x" }])] } }).ok).toBe(true);
    const clash = runTool(ctx, "make_chase_scene", { mapId, id: "ev_sign", chaser: { at: { x: 6, y: 5 } } });
    expect(clash.ok).toBe(false);
    expect(clash.summary).toContain("not a chaser");
  });
});
