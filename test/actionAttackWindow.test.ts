import { describe, expect, it } from "vitest";
import {
  ATTACK_BUFFER_LIFETIME_MS,
  bufferAttackPress,
  createAttackBuffer,
  tickAttackBuffer,
} from "@/battle/action/attackWindow";

// 씬과 동일한 규칙으로 버퍼를 구동하는 고정 델타 리플레이. 쿨다운 감소는
// tickAttackBuffer 가 returning cooldownRemainingMs 로 책임진다.
function replay(cooldownMs: number, totalMs: number, stepMs: number, pressAtElapsedMs: number[] = []): {
  swings: number;
  pressCount: number;
} {
  const buffer = createAttackBuffer();
  let cooldown = cooldownMs;
  let elapsed = 0;
  let swings = 0;
  let pressCount = 0;
  while (elapsed < totalMs) {
    if (pressAtElapsedMs.includes(elapsed)) {
      bufferAttackPress(buffer);
      pressCount += 1;
    }
    const before = cooldown;
    const tick = tickAttackBuffer(buffer, before, stepMs);
    cooldown = tick.cooldownRemainingMs;
    if (tick.fired) swings += 1;
    elapsed += stepMs;
  }
  return { swings, pressCount };
}

describe("attackWindow buffer", () => {
  it("releases exactly one swing when the cooldown reaches zero", () => {
    const out = replay(200, 600, 16, [0]);
    expect(out.pressCount).toBe(1);
    expect(out.swings).toBe(1);
  });

  it("never releases a second swing for one press", () => {
    const buffer = createAttackBuffer();
    bufferAttackPress(buffer);
    let cooldown = 200;
    let fired = 0;
    for (let i = 0; i < 60; i += 1) {
      const tick = tickAttackBuffer(buffer, cooldown, 16);
      cooldown = tick.cooldownRemainingMs;
      if (tick.fired) fired += 1;
    }
    expect(cooldown).toBe(0);
    expect(fired).toBe(1);
  });

  it("does not fire without a buffered press", () => {
    expect(replay(200, 600, 16).swings).toBe(0);
  });

  it("does not fire from a tick that starts already off cooldown", () => {
    const buffer = createAttackBuffer();
    const tick = tickAttackBuffer(buffer, 0, 16);
    expect(tick.fired).toBe(false);
    expect(tick.cooldownRemainingMs).toBe(0);
  });

  it("drops the buffered press once the bounded lifetime expires", () => {
    // 쿨다운이 버퍼 수명보다 길면 오래된 입력은 절대 발화하지 않는다.
    expect(ATTACK_BUFFER_LIFETIME_MS).toBeLessThan(400);
    expect(replay(400, 800, 16, [0]).swings).toBe(0);
    expect(replay(400, 800, 50, [0]).swings).toBe(0);
  });

  it("ignores extra presses while a press is already buffered", () => {
    const out = replay(200, 600, 16, [0, 32, 64, 96]);
    expect(out.pressCount).toBe(4);
    expect(out.swings).toBe(1);
  });

  it("16ms steps and 50ms steps over the same total time agree", () => {
    const fine = replay(200, 600, 16, [0]);
    const coarse = replay(200, 600, 50, [0]);
    expect(fine.swings).toBe(1);
    expect(coarse.swings).toBe(1);
  });

  it("16ms and 50ms replays also agree on the expiry case", () => {
    const fine = replay(400, 800, 16, [0]);
    const coarse = replay(400, 800, 50, [0]);
    expect(fine.swings).toBe(0);
    expect(coarse.swings).toBe(0);
  });
});
