import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { darkenChannel, effectiveDarkness, normalizeLightingState, setSessionLighting } from "@/project/lightingRules";
import { lightingGradientParams, lightingMaskSignature } from "@/player/lighting";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

const context = {
  viewportWidth: 320, viewportHeight: 180, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
  resolveAnchor: () => undefined,
};

describe("lighting blend · vignette", () => {
  it("곱하기 막은 밝은 색도 색조로 묶지 않고 화면 색에 곱한다", () => {
    expect(effectiveDarkness("#8090ff", 0.9, "multiply")).toEqual({ color: "#8090ff", ambient: 0.9 });
    expect(effectiveDarkness("#8090ff", 0.9).ambient).toBeLessThan(0.9);
    // 흰 눈(255)은 막 색 그대로, 검은 바닥(0)은 검게 남는다 — 덮기 막처럼 회색 판으로 뭉개지지 않는다.
    expect(darkenChannel(255, 64, 1, "multiply")).toBeCloseTo(64);
    expect(darkenChannel(0, 64, 1, "multiply")).toBe(0);
    expect(darkenChannel(0, 64, 1, "over")).toBe(64);
  });

  it("마스크 인자·서명에 섞기와 비네트가 실린다(생략은 예전과 같다)", () => {
    const plain = lightingGradientParams({ ambient: 0.8, color: "#000000", sources: [] }, context);
    expect(plain.blend).toBe("over");
    expect(plain.vignette).toBe(0);
    const night = lightingGradientParams({ ambient: 0.8, color: "#203060", sources: [], blend: "multiply", vignette: 0.6 }, context);
    expect(night.blend).toBe("multiply");
    expect(night.vignette).toBeCloseTo(0.6);
    expect(lightingMaskSignature(night)).not.toBe(lightingMaskSignature(plain));
  });

  it("setLighting(진하기·색만)은 맵 기본 조명의 섞기·비네트를 지우지 않는다", () => {
    const session = { lighting: normalizeLightingState({ ambient: 0.5, sources: [], blend: "multiply", vignette: 0.4 }) } as PlaySessionLike;
    const next = setSessionLighting(session, { ambient: 0.9, color: "#101830" });
    expect(next.blend).toBe("multiply");
    expect(next.vignette).toBeCloseTo(0.4);
  });

  it("set_lighting_volume 가 blend·vignette 를 기본 조명에 저장하고 모르는 섞기는 거절한다", () => {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const ok = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, color: "#263a70", blend: "multiply", vignette: 0.5, sources: [] });
    expect(ok.ok, ok.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.defaultLighting).toMatchObject({ blend: "multiply", vignette: 0.5 });
    const bad = runTool(ctx, "set_lighting_volume", { mapId, ambient: 0.9, blend: "screen", sources: [] });
    expect(bad.ok).toBe(false);
  });
});
