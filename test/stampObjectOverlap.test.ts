// stamp_object 겹침 처리(2026-10-25 J64): 학교 교실에 남은 소파·냉장고 때문에 책상 11번 거부 — 쓰임에 안 맞는 가구는 걷어 내고,
// onOverlap:'nearest' 는 가까운 빈 자리에, 'replace' 는 겹친 가구를 걷고 찍는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { offPurposeProps } from "@/ai/v2/roomPurpose";

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
