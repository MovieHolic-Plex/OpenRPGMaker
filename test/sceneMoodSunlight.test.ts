// set_scene_mood 의 sunlight — 해 질 녘 「집·소나무가 동쪽으로 길게 그림자」를 같은 호출로(2026-11-03 조수 대조 B8 서리나루:
// Opus 가 「그림자를 만들 도구가 없다」며 그 요구를 막힘으로 닫았다. 도구는 set_map_properties.sunlight 에 있었다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("set_scene_mood sunlight", () => {
  it("곱하기 노을 조명과 서쪽 낮은 해 그림자를 한 번에 켠다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const r = runTool(ctx, "set_scene_mood", {
      mapId, applyMode: "map",
      lighting: { ambient: 0.9, color: "#5a3f86", blend: "multiply", vignette: 0.55, sources: [] },
      sunlight: { azimuth: 262, altitude: 24, opacity: 0.45 },
    });
    expect(r.ok, r.summary).toBe(true);
    const map = ctx.project.maps[mapId]!;
    expect(map.sunlight).toMatchObject({ enabled: true, azimuth: 262, altitude: 24 });
    expect(map.defaultLighting).toMatchObject({ blend: "multiply" });
  });

  it("이벤트 구역 분위기에는 해를 받지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const r = runTool(ctx, "set_scene_mood", { mapId: ctx.project.startMapId, applyMode: "event", sunlight: { azimuth: 90 }, lighting: { ambient: 0.5, color: "#000000", sources: [], area: { x: 0, y: 0, w: 2, h: 2 } } });
    expect(r.ok).toBe(false);
  });
});
