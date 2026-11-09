import { describe, expect, it } from "vitest";
import { MEASURE_ID, THRESHOLDS, features, isLater, judgeGame, similarity } from "../scripts/fs-scale/lookSimilarity.mjs";
import { judgeCorpus } from "../scripts/fs-scale/looks.mjs";

// 합성 이미지(화면이 아니다): 작은 RGBA 로 해시·규칙을 시험한다. 이미지 파일은 필요 없다.
function image(kind: "grad" | "checker" | "noise", width = 96, height = 64): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    let r = 0, g = 0, b = 0;
    if (kind === "grad") { r = Math.floor((x * 255) / (width - 1)); g = 255 - r; b = 128; }
    else if (kind === "checker") { const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0; [r, g, b] = on ? [255, 255, 255] : [20, 40, 200]; }
    else { r = (x * 7 + y * 3) % 256; g = (x * 3 + y * 11) % 256; b = (x * 13 + y * 5) % 256; }
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
  }
  return rgba;
}
const shot = (kind: "grad" | "checker" | "noise") => features(image(kind), 96, 64);
const bits = (hex: string) => Array.from(hex, (c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
const game = (id: string, made_at: string, prompt: string, title: ReturnType<typeof shot>, start?: ReturnType<typeof shot>) => ({ id, made_at, prompt_sha: prompt, shots: { title, ...(start ? { start } : {}) } });

describe("pic-v1 features (PIL 과 같은 값)", () => {
  it("ahash 는 앞 절반이 밝은 가로 그러데이션을 PIL 과 같은 비트로 만든다", () => {
    // Python rdb.ahash 가 같은 합성 이미지(grad)에 낸 값: 8x8 중 앞 4열이 1 — 줄마다 1111 0000.
    expect(bits(shot("grad").ahash)).toBe("1111000011110000111100001111000011110000111100001111000011110000");
    expect(bits(shot("grad").dhash)).toBe("0".repeat(64));
    expect(shot("grad").hist.reduce((a, b) => a + b, 0)).toBe(4096);
    expect(shot("grad").measure).toBe(MEASURE_ID);
  });
  it("같은 그림은 sim 1, 다른 그림은 그보다 한참 낮다, 이름이 다르면 던진다", () => {
    expect(similarity(shot("grad"), shot("grad")).sim).toBe(1);
    expect(similarity(shot("grad"), shot("checker")).sim).toBeCloseTo(0.375, 3);
    expect(() => similarity({ ...shot("grad"), measure: "pic-v2" }, shot("grad"))).toThrow();
  });
});

describe("쌍둥이 0점 규칙", () => {
  const defaults = { title: shot("noise") };
  it("다른 프롬프트의 똑같은 그림은 양쪽 모두 0점, 줄에 사유·상대·점수·화면이 찍힌다", () => {
    const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad"));
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
    expect(rows.map((r) => r.zero)).toEqual([true, true]);
    expect(rows[0]!.lines[0]).toBe("zero: identical-preset similar game b 1.000 title");
  });
  it("닮았지만 똑같지는 않으면 나중에 만든 쪽만 0점이다", () => {
    const base = image("grad"); const tweaked = base.slice(); tweaked[10] = (tweaked[10]! + 1) % 256; // 한 화소만 다르다 — sha 는 다르고 sim 은 0.9 이상
    const a = game("a", "0001", "p1", features(base, 96, 64)), b = game("b", "0002", "p2", features(tweaked, 96, 64));
    expect(isLater(b, a)).toBe(true);
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
    expect(rows.find((r) => r.id === "a")!.zero).toBe(false);
    const later = rows.find((r) => r.id === "b")!;
    expect(later.zero).toBe(true);
    expect(later.lines[0]).toMatch(/^zero: look-similar similar game a [01]\.\d{3} title$/u);
  });
  it("같은 프롬프트 쌍은 0점이 아니라 감점이다", () => {
    const a = game("a", "0001", "same", shot("grad")), b = game("b", "0002", "same", shot("grad"));
    const verdict = judgeGame(b, [a, b], {});
    expect(verdict.zero).toBe(false);
    expect(verdict.penalty).toBe(THRESHOLDS[MEASURE_ID]!.penaltyPoints);
  });
  it("기본 화면과 닮은 게임은 0점이다", () => {
    const g = game("g", "0001", "p", shot("noise"));
    const verdict = judgeGame(g, [g], defaults);
    expect(verdict.zero).toBe(true);
    expect(verdict.lines[0]).toBe("zero: default-screen similar game default-title 1.000 title");
  });
  it("시각이 같으면 id 사전순으로 나중을 정한다", () => {
    expect(isLater({ id: "b", made_at: "0001" }, { id: "a", made_at: "0001" })).toBe(true);
    expect(isLater({ id: "a", made_at: "0002" }, { id: "z", made_at: "0001" })).toBe(true);
  });
});
