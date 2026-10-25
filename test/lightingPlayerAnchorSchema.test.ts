import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools";
import { LIGHT_SOURCE_SCHEMA } from "@/editor/tools/schemaShapes";

// 2026-10-25 공포 학교: 카드가 at:'player' 문자열을 가르쳤는데 스키마는 객체만 받아 set_lighting_volume 이 검증에서 거절됐다.
describe("light source player anchor", () => {
  it("schema teaches the object form {kind:'player'}", () => {
    const at = (LIGHT_SOURCE_SCHEMA.properties as Record<string, { type: string; properties: Record<string, unknown> }>).at!;
    expect(at.type).toBe("object");
    expect(at.properties.kind).toBeDefined();
  });
  it("set_lighting_volume follows the player with at:{kind:'player'}", () => {
    const project = createBlankProject();
    const draft = structuredClone(project);
    const mapId = draft.startMapId!;
    getTool("set_lighting_volume")!.run(draft as never, { mapId, ambient: 0.8, sources: [{ id: "torch", at: { kind: "player" }, radius: 4 }] } as never);
    expect(draft.maps[mapId]!.defaultLighting?.sources[0]?.at).toBe("player");
  });
});
