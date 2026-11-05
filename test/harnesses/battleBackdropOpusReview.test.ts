import { describe, expect, it } from "vitest";
import {
  BACKDROP_REVIEW_STANDARD, backdropBatchCounts, isOpusModel, parseBackdropReview, passingBackdrops, reviewedShas,
  type ReviewBatch, type ReviewEntry,
} from "@/harnesses/battle-backdrop/opusReview";

const entries: ReviewEntry[] = [
  { label: "11", pixelSha256: "a", letter: "A" },
  { label: "22", pixelSha256: "b", letter: "B" },
  { label: "33", pixelSha256: "c1", control: "flipped" },
];
const batch = (answers: ReviewBatch["answers"], over: Partial<ReviewBatch> = {}): ReviewBatch => {
  const { counted, reason } = backdropBatchCounts(entries, answers);
  return { id: "b1", at: "t", standard: BACKDROP_REVIEW_STANDARD, model: "claude-opus-5.5", runId: "r", rawFile: "f", rawSha256: "s", entries, answers, counted, reason, ...over };
};
const now = [{ letter: "A", nativePixelSha256: "a", machineOk: true }, { letter: "B", nativePixelSha256: "b", machineOk: true }];

describe("battle-backdrop Opus review", () => {
  it("accepts only Opus models", () => {
    expect(isOpusModel("klb/claude-opus-5.5")).toBe(true);
    expect(isOpusModel("claude-opus-5-5")).toBe(true);
    expect(isOpusModel("claude-sonnet-5")).toBe(false);
    expect(isOpusModel("gemini-3.8-flash")).toBe(false);
    expect(isOpusModel(undefined)).toBe(false);
  });

  it("reads scores on the 0.5 grid and turns a low pass into a reject", () => {
    const got = parseBackdropReview('ok {"11":{"v":"pass","score":3,"why":"x"},"22":{"v":"pass","score":4.5,"why":"y"}}', ["11", "22"]);
    expect(got?.["11"]?.v).toBe("reject");
    expect(got?.["22"]).toEqual({ v: "pass", score: 4.5, why: "y" });
    expect(parseBackdropReview('{"11":{"v":"pass","score":3.7}}', ["11"])).toBeNull();
    expect(parseBackdropReview('{"11":{"v":"pass","score":4}}', ["11", "22"])).toBeNull();
  });

  it("counts a batch only when every hidden control is rejected", () => {
    const ok = { "11": { v: "pass", score: 4, why: "" }, "22": { v: "reject", score: 2, why: "" } } as const;
    expect(backdropBatchCounts(entries, { ...ok, "33": { v: "reject", score: 1, why: "" } }).counted).toBe(true);
    expect(backdropBatchCounts(entries, { ...ok, "33": { v: "pass", score: 4, why: "" } }).counted).toBe(false);
    expect(backdropBatchCounts(entries.slice(0, 2), ok).reason).toBe("batch has no hidden control");
  });

  it("picks the best current pass and ignores uncounted batches and changed pixels", () => {
    const answers = { "11": { v: "pass", score: 4, why: "" }, "22": { v: "pass", score: 4.5, why: "" }, "33": { v: "reject", score: 1, why: "" } } as const;
    expect(passingBackdrops([batch(answers)], now).map((p) => [p.letter, p.score])).toEqual([["B", 4.5], ["A", 4]]);
    expect(passingBackdrops([batch(answers, { counted: false })], now)).toEqual([]);
    expect(passingBackdrops([batch(answers)], [{ letter: "B", nativePixelSha256: "b2", machineOk: true }])).toEqual([]);
    expect(passingBackdrops([batch(answers)], [{ letter: "B", nativePixelSha256: "b", machineOk: false }])).toEqual([]);
    expect([...reviewedShas([batch(answers)])].sort()).toEqual(["a", "b"]);
  });
});
