import { describe, expect, it } from "vitest";
import { PiRepeatBreaker, REPEAT_STEER_AT, REPEAT_STOP_AT } from "@/ai/piAgent/repeatBreaker";

describe("반복 루프 차단", () => {
  it("키 순서만 바꾼 같은 무변화 호출을 세어 한 번 일러 주고 멈춘다", () => {
    const breaker = new PiRepeatBreaker();
    const verdicts = [];
    for (let i = 0; i < REPEAT_STOP_AT; i++) {
      const args = i % 2 ? { x: 15, y: 4, layers: { 3: [[3380]] } } : { layers: { 3: [[3380]] }, y: 4, x: 15 };
      verdicts.push(breaker.observe("stamp_layer_block", args, i === 0));
    }
    // 첫 호출은 맵을 바꿨다 → 두 번째부터 센다.
    expect(verdicts.filter(v => v?.action === "steer")).toHaveLength(1);
    expect(verdicts.findIndex(v => v?.action === "steer")).toBe(REPEAT_STEER_AT);
    expect(verdicts.at(-1)).toBeNull();
    expect(breaker.observe("stamp_layer_block", { x: 15, y: 4, layers: { 3: [[3380]] } }, false)?.action).toBe("stop");
  });

  it("맵이 바뀌거나 다른 호출이 끼면 처음부터 센다", () => {
    const breaker = new PiRepeatBreaker();
    for (let i = 0; i < 20; i++) {
      expect(breaker.observe("show_map_region", { mapId: "m" }, false)?.action === "stop").toBe(i + 1 >= REPEAT_STOP_AT);
      if (i === 5) { breaker.observe("paint_tiles", { mapId: "m" }, true); }
      if (i === 5) break;
    }
    expect(breaker.observe("show_map_region", { mapId: "m" }, false)).toBeNull();
    expect(breaker.observe("show_map_region", { mapId: "n" }, false)).toBeNull();
  });
});
