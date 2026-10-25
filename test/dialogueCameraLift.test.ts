import { describe, expect, it } from "vitest";
import { dialogueLiftWorldPx, syncDialogueCameraLift } from "@/player/dialogueCameraLift";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("dialogue camera lift (system.dialogueKeepActorsVisible)", () => {
  it("moves the camera centre down so the hero sits in the clear band above the dialogue/choice windows", () => {
    // 선택지 창이 화면 40% 높이부터 덮는다(시타마치 캡처: 960x540 에서 약 210px) → 주인공을 22% 높이에.
    const lift = dialogueLiftWorldPx({ coverTopFraction: 0.4, worldViewHeight: 270 });
    expect(lift).toBeCloseTo((0.5 - 0.22) * 270);
    // 대사창만(68%) — 덜 내린다.
    expect(dialogueLiftWorldPx({ coverTopFraction: 0.68, worldViewHeight: 270 })).toBeLessThan(lift);
  });

  it("does nothing for tiny bottom bubbles or windows docked at the top", () => {
    expect(dialogueLiftWorldPx({ coverTopFraction: 0.9, worldViewHeight: 270 })).toBe(0);
    expect(dialogueLiftWorldPx({ coverTopFraction: 0.1, worldViewHeight: 270 })).toBe(0);
    expect(dialogueLiftWorldPx({ coverTopFraction: Number.NaN, worldViewHeight: 270 })).toBe(0);
  });

  it("only resets an offset it set itself, and never touches a camera that is not following the hero", () => {
    const calls: number[] = [];
    const player = {};
    const camera = { worldView: { height: 270 }, followOffset: { y: 0 }, _follow: player, setFollowOffset: (_x?: number, y?: number) => { calls.push(y ?? 0); } };
    const scene = { cameras: { main: camera }, player, game: { canvas: null } };
    expect(syncDialogueCameraLift(scene, undefined, true, false)).toBe(false);
    expect(calls).toEqual([]);
    expect(syncDialogueCameraLift(scene, undefined, true, true)).toBe(false);
    expect(calls).toEqual([0]);
  });

  it("survives system normalization, including an explicit false", () => {
    expect(normalizeSystemRecords({ startActorIds: [], dialogueKeepActorsVisible: true }).dialogueKeepActorsVisible).toBe(true);
    expect(normalizeSystemRecords({ startActorIds: [], dialogueKeepActorsVisible: false }).dialogueKeepActorsVisible).toBe(false);
    expect(normalizeSystemRecords({ startActorIds: [] }).dialogueKeepActorsVisible).toBeUndefined();
  });
});
