import { describe, expect, it } from "vitest";
import { BLIND_MODEL_FINDING, isBlindImageStatus } from "../scripts/lib/piTeamRuntime";

describe("J69 follow-up: blind-model image gate message", () => {
  it("recognises a not-delivered image status", () => {
    expect(isBlindImageStatus({ type: "execution_status", name: "map.image.delivered", ok: false })).toBe(true);
    expect(isBlindImageStatus({ type: "execution_status", name: "presentation.image.delivered", ok: false })).toBe(true);
    expect(isBlindImageStatus({ type: "execution_status", name: "map.background.delivered", ok: false })).toBe(true);
  });
  it("ignores delivered images and other statuses", () => {
    expect(isBlindImageStatus({ type: "execution_status", name: "map.image.delivered", ok: true })).toBe(false);
    expect(isBlindImageStatus({ type: "execution_status", name: "first_scene.review_passed", ok: false })).toBe(false);
    expect(isBlindImageStatus({ type: "tool_end", name: "map.image.delivered", ok: false })).toBe(false);
  });
  it("blames the model", () => {
    expect(BLIND_MODEL_FINDING).toContain("이 모델은 그림을 못 본다");
  });
});
