import { describe, expect, it } from "vitest";
import { lightingGradientParams, type LightingMaskContext, lightingMaskSignature } from "@/player/lighting";
import { lightAtTile, lightFalloffAt, darkenChannel, effectiveDarkness, normalizeLightingState, setSessionLighting } from "@/project/lightingRules";
import { isNpcSight, withinSightRange } from "@/project/npcBehavior";
import type { LightingState } from "@/project/types";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { isolateTimers } from "./mergedTeardown";

describe("lightFollowsFigure", () => {
  isolateTimers();
  const context = (resolveAnchor: LightingMaskContext["resolveAnchor"]): LightingMaskContext => ({
    viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0, resolveAnchor,
  });
  const lamp: LightingState = { ambient: 0.8, color: "#000000", sources: [{ id: "lamp", at: { eventId: "ev_guard" }, radius: 3.5, intensity: 0.8 }] };
  describe("event-anchored light follows the figure", () => {
    it("dims with the carrier's opacity and goes out with it", () => {
      const at = (fade?: number) => () => ({ x: 4, y: 4, ...(fade === undefined ? {} : { fade }) });
      expect(lightingGradientParams(lamp, context(at())).gradients[0]?.intensity).toBeCloseTo(0.8);
      expect(lightingGradientParams(lamp, context(at(0.5))).gradients[0]?.intensity).toBeCloseTo(0.4);
      expect(lightingGradientParams(lamp, context(() => undefined)).gradients).toEqual([]);
      expect(lightAtTile(lamp, 4, 5, at(0))).toBe(false);
      expect(lightAtTile(lamp, 4, 5, at(1))).toBe(true);
    });
  });
  describe("hard-edged sight light and circular sight agree", () => {
    it("keeps the hard edge readable at the rim while the inside falls off like a lantern", () => {
      // 끝 가까이에도 빛이 남아 테두리가 읽힌다(부드러운 곡선은 거의 0).
      expect(lightFalloffAt(0.9, "hard")).toBeGreaterThan(0.2);
      expect(lightFalloffAt(0.9)).toBeLessThan(0.1);
      // 안쪽은 고른 판이 아니라 들고 있는 사람 곁이 밝다.
      expect(lightFalloffAt(0.1, "hard")).toBeGreaterThan(lightFalloffAt(0.5, "hard") * 2);
      // 안쪽 낙차(가운데 → 끝 띠 직전)가 끝 계단보다 훨씬 커야 판이 아니라 등불로 읽힌다.
      expect(lightFalloffAt(0.05, "hard") - lightFalloffAt(0.92, "hard")).toBeGreaterThan(lightFalloffAt(0.92, "hard") * 3);
      expect(lightFalloffAt(0.5, "hard")).toBeGreaterThan(lightFalloffAt(0.85, "hard"));
      // 끝 띠는 짧다 — 반지름 94% 너머에서 끊긴다.
      expect(lightFalloffAt(0.99, "hard")).toBeLessThan(0.05);
      const hard = lightingGradientParams({ ...lamp, sources: [{ ...lamp.sources[0]!, at: { x: 1, y: 1 }, edge: "hard" }] }, context((a) => (a === "player" || "eventId" in a ? undefined : a)));
      expect(hard.gradients[0]?.edge).toBe("hard");
    });

    it("circle sight sees exactly the cells whose centre is inside the range + 0.5 lamp", () => {
      const range = 3;
      for (let dx = -5; dx <= 5; dx += 1) for (let dy = -5; dy <= 5; dy += 1) {
        expect(withinSightRange(dx, dy, range, "circle")).toBe(Math.hypot(dx, dy) <= range + 0.5);
      }
      // 맨해튼은 빛 한가운데 대각선(2,2)을 못 보고, 원은 본다.
      expect(withinSightRange(2, 2, range, undefined)).toBe(false);
      expect(withinSightRange(2, 2, range, "circle")).toBe(true);
      expect(withinSightRange(3, 2, range, "circle")).toBe(false);
    });

    it("validates the sight shape", () => {
      expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "circle" })).toBe(true);
      expect(isNpcSight({ range: 3, lineOfSight: true, facing: "any", shape: "square" })).toBe(false);
    });
  });
});

describe("runtimeLightingBlend", () => {
  isolateTimers();
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
});
