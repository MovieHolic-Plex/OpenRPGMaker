import { describe, expect, it } from "vitest";
import {
  attemptGen1Capture,
  gen1CaptureProbability,
  type Gen1CaptureInput,
} from "@/battle/gen1/capture";

function bytes(values: readonly number[]): { readonly next: () => number; readonly consumed: () => number } {
  let index = 0;
  return {
    next: () => {
      const value = values[index];
      if (value === undefined) throw new Error(`unexpected RNG read at ${index}`);
      index += 1;
      return value;
    },
    consumed: () => index,
  };
}

const fullHp: Omit<Gen1CaptureInput, "ballClass"> = {
  maxHp: 100,
  currentHp: 100,
  catchRate: 45,
};

describe("Red/Blue exact capture probability", () => {
  it.each([
    ["poke", undefined, 989, 16_384, 85],
    ["great", undefined, 23, 201, 127],
    ["ultra", undefined, 989, 9_664, 85],
    ["poke", "sleep", 2_589, 16_384, 85],
    ["poke", "burn", 1_757, 16_384, 85],
  ] as const)("break: %s/%s keeps the exact rational", (ballClass, majorStatus, numerator, denominator, x) => {
    expect(gen1CaptureProbability({ ...fullHp, ballClass, majorStatus })).toMatchObject({
      numerator,
      denominator,
      x,
    });
  });

  it("break: W above 255 skips Rand2 but still requires the Rand1 catch-rate gate", () => {
    expect(gen1CaptureProbability({ ...fullHp, ballClass: "poke", currentHp: 1 }))
      .toMatchObject({ numerator: 23, denominator: 128, w: 2_125, x: 255 });
  });

  it("break: trainer battles are impossible even with a Master Ball", () => {
    expect(gen1CaptureProbability({ ...fullHp, ballClass: "master", trainerBattle: true }))
      .toMatchObject({ numerator: 0, denominator: 1 });
  });
});

describe("Red/Blue two-stage capture attempt and byte consumption", () => {
  it("uses inclusive Rand1 and Rand2 boundaries", () => {
    const successBytes = bytes([45, 85]);
    expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, successBytes.next))
      .toMatchObject({ caught: true, shakes: 3, trace: { rand1: 45, rand2: 85 } });
    expect(successBytes.consumed()).toBe(2);

    const rand2Failure = bytes([45, 86]);
    expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, rand2Failure.next))
      .toMatchObject({ caught: false, failureReason: "rand2", shakes: 0 });

    const rand1Failure = bytes([46]);
    expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, rand1Failure.next))
      .toMatchObject({ caught: false, failureReason: "rand1", trace: { rand1: 46 } });
    expect(rand1Failure.consumed()).toBe(1);
  });

  it.each([
    ["great", [201, 200, 127], [201], 200, 127],
    ["ultra", [151, 150, 85], [151], 150, 85],
  ] as const)("break: %s rerolls out-of-range Rand1 bytes", (ballClass, sequence, rejected, rand1, rand2) => {
    const rng = bytes(sequence);
    const result = attemptGen1Capture(
      { ...fullHp, ballClass, catchRate: 255 },
      rng.next,
    );
    expect(result).toMatchObject({
      caught: true,
      trace: { rand1, rand2, rejectedRand1Bytes: rejected },
    });
    expect(rng.consumed()).toBe(3);
  });

  it("break: Master Ball consumes Rand1, while status-underflow succeeds without Rand2", () => {
    const masterRng = bytes([211]);
    expect(attemptGen1Capture({ ...fullHp, ballClass: "master" }, masterRng.next))
      .toMatchObject({ caught: true, trace: { rand1: 211 } });
    expect(masterRng.consumed()).toBe(1);

    const sleepRng = bytes([24]);
    expect(attemptGen1Capture({ ...fullHp, ballClass: "poke", majorStatus: "sleep" }, sleepRng.next))
      .toMatchObject({ caught: true, trace: { rand1: 24, adjustedRand1: undefined } });
    expect(sleepRng.consumed()).toBe(1);
  });

  it.each([
    ["poke", 0],
    ["great", 1],
    ["ultra", 1],
  ] as const)("break: failed %s attempts derive the original shake count", (ballClass, shakes) => {
    const rng = bytes([45, 255]);
    expect(attemptGen1Capture({ ...fullHp, ballClass }, rng.next)).toMatchObject({
      caught: false,
      failureReason: "rand2",
      shakes,
    });
  });

  it("does not consume RNG when the trainer-battle gate rejects the throw", () => {
    const rng = bytes([]);
    expect(attemptGen1Capture(
      { ...fullHp, ballClass: "master", trainerBattle: true },
      rng.next,
    )).toMatchObject({ caught: false, failureReason: "trainerBattle", shakes: 0 });
    expect(rng.consumed()).toBe(0);
  });
});
