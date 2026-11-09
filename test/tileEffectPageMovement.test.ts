import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

// 도구가 만드는 이벤트 페이지는 movement.speed·frequency 를 갖고 있어야 한다 — 없으면 프로젝트 무결성 검사
// (deserialize(serialize()))가 거부해 그 뒤 쓰기 도구(remove_map 등)가 모두 실패했다(폴른 스타 우물 갱도 굽기 실측).
describe("tool-made event pages carry full movement", () => {
  it("tile_change_effect trigger pages round-trip through serialize/deserialize", () => {
    const context: ToolContext = { project: createBlankProject() };
    const map = context.project.maps[0]!;
    const result = runTool(context, "tile_change_effect", {
      targetMapId: map.id,
      changes: [{ layer: "lower", rect: { x: 1, y: 1, w: 1, h: 1 }, tile: 0 }],
      trigger: { mapId: map.id, x: 2, y: 2, name: "레버", text: "레버를 당겼다." },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const pages = context.project.maps[0]!.events.flatMap((event) => event.pages);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.movement).toMatchObject({ type: "fixed", speed: expect.any(Number), frequency: expect.any(Number) });
    }
    expect(() => deserialize(serialize(context.project))).not.toThrow();
  });
});
