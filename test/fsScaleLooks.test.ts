import { describe, expect, it } from "vitest";
import { MEASURE_ID, THRESHOLDS, features, isLater, judgeGame, similarity } from "../scripts/fs-scale/lookSimilarity.mjs";
import { judgeCorpus } from "../scripts/fs-scale/looks.mjs";

// 합성 이미지(화면이 아니다): 작은 RGBA 로 해시·규칙을 시험한다. 이미지 파일은 필요 없다.
const W = 96, H = 64;
function image(kind: "grad" | "checker" | "noise", corner = 0): Uint8Array {
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    let r = 0, g = 0, b = 0;
    if (kind === "grad") { r = Math.floor((x * 255) / (W - 1)); g = 255 - r; b = 128; }
    else if (kind === "checker") { const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0; [r, g, b] = on ? [255, 255, 255] : [20, 40, 200]; }
    else { r = (x * 7 + y * 3) % 256; g = (x * 3 + y * 11) % 256; b = (x * 13 + y * 5) % 256; }
    if (corner > 0 && x >= W - corner && y >= H - corner) { r = 0; g = 0; b = 0; } // 오른쪽 아래 구석을 검게 — sim 을 단계적으로 낮춘다
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
  }
  return rgba;
}
const shot = (kind: "grad" | "checker" | "noise", corner = 0) => features(image(kind, corner), W, H);
const bits = (hex: string) => Array.from(hex, (c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
const game = (id: string, made_at: string, prompt: string, title: ReturnType<typeof shot>, extra: object = {}) => ({ id, made_at, prompt_sha: prompt, shots: { title }, ...extra });
const th = THRESHOLDS[MEASURE_ID]!;

describe("pic-v1 features", () => {
  it("앞 절반이 밝은 가로 그러데이션은 ahash 가 줄마다 1111 0000, dhash 는 전부 0(밝기가 오른쪽으로 줄어든다)", () => {
    expect(bits(shot("grad").ahash)).toBe("1111000011110000111100001111000011110000111100001111000011110000");
    expect(bits(shot("grad").dhash)).toBe("0".repeat(64));
    expect(shot("grad").hist.reduce((a, b) => a + b, 0)).toBe(4096);
    expect(shot("grad").measure).toBe(MEASURE_ID);
  });
  it("같은 그림은 sim 1, 격자와 그러데이션은 낮다(구조 0.4·색 0 — 이 값은 레인 Python 이 같은 합성 이미지에 낸 0.375 와 같다), 이름이 다르면 던진다", () => {
    expect(similarity(shot("grad"), shot("grad")).sim).toBe(1);
    expect(similarity(shot("grad"), shot("checker")).sim).toBeCloseTo(0.375, 3);
    expect(() => similarity({ ...shot("grad"), measure: "pic-v2" }, shot("grad"))).toThrow();
  });
  it("구석을 20칸 검게 하면 0.90~0.999 사이, 2칸이면 0.999 이상이다(규칙 시험에 쓰는 합성 쌍)", () => {
    expect(similarity(shot("grad"), shot("grad", 20)).sim).toBeGreaterThanOrEqual(0.9);
    expect(similarity(shot("grad"), shot("grad", 20)).sim).toBeLessThan(0.999);
    expect(similarity(shot("grad"), shot("grad", 2)).sim).toBeGreaterThanOrEqual(0.999);
  });
});

describe("쌍둥이 0점 규칙", () => {
  it("다른 프롬프트의 똑같은 그림은 양쪽 모두 0점, 줄에 사유·상대·점수·화면이 찍힌다", () => {
    const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad"));
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
    expect(rows.map((r) => r.zero)).toEqual([true, true]);
    expect(rows[0]!.lines[0]).toBe("zero: identical-preset similar game b 1.000 title");
  });
  it("화소가 조금 다른 프리셋 복사(sim ≥ 0.999)도 똑같은 프리셋으로 보고 양쪽 0점이다", () => {
    const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad", 2));
    expect(a.shots.title.sha).not.toBe(b.shots.title.sha);
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
    expect(rows.map((r) => r.zero)).toEqual([true, true]);
    expect(rows[0]!.hits[0]!.reason).toBe("identical-preset");
  });
  it("0.90 이상 0.999 미만으로 닮으면 나중에 만든 쪽만 0점이다", () => {
    const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad", 20));
    expect(isLater(b, a)).toBe(true);
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
    expect(rows.find((r) => r.id === "a")!.zero).toBe(false);
    const later = rows.find((r) => r.id === "b")!;
    expect(later.zero).toBe(true);
    expect(later.lines[0]).toMatch(/^zero: look-similar similar game a 0\.9\d{2} title$/u);
  });
  it("0.70~0.90 사이는 0점이 아니라 −2 감점이고, 상대가 여럿이어도 게임당 한 번이다", () => {
    const a = game("a", "0001", "p1", shot("grad")), c = game("c", "0002", "p3", shot("grad")), b = game("b", "0003", "p2", shot("grad", 38));
    const sim = similarity(a.shots.title, b.shots.title).sim;
    expect(sim).toBeGreaterThanOrEqual(th.penalty);
    expect(sim).toBeLessThan(th.zero);
    const verdict = judgeGame(b, [a, c, b], {});
    expect(verdict.zero).toBe(false);
    expect(verdict.penalty).toBe(th.penaltyPoints);
    expect(verdict.lines.filter((l) => l.startsWith("penalty:"))).toHaveLength(1);
    expect(verdict.hits.filter((h) => h.kind === "penalty").length).toBeGreaterThanOrEqual(2);
  });
  it("같은 프롬프트 쌍은 0점이 아니라 감점이다", () => {
    const a = game("a", "0001", "same", shot("grad")), b = game("b", "0002", "same", shot("grad"));
    const verdict = judgeGame(b, [a, b], {});
    expect(verdict.zero).toBe(false);
    expect(verdict.penalty).toBe(th.penaltyPoints);
  });
  it("기본 화면과 닮은 게임은 0점이다", () => {
    const g = game("g", "0001", "p", shot("noise"));
    const verdict = judgeGame(g, [g], { title: shot("noise") });
    expect(verdict.zero).toBe(true);
    expect(verdict.lines[0]).toBe("zero: default-screen similar game default-title 1.000 title");
  });
  it("시각이 같으면 id 사전순으로 나중을 정한다", () => {
    expect(isLater({ id: "b", made_at: "0001" }, { id: "a", made_at: "0001" })).toBe(true);
    expect(isLater({ id: "a", made_at: "0002" }, { id: "z", made_at: "0001" })).toBe(true);
  });
  it("판정 결과에 project_sha 가 실려 score.mjs --looks 가 파일 내용으로 짝짓는다, 기준값은 인자로 넘기고 전역은 바뀌지 않는다", () => {
    const a = game("a", "0001", "p1", shot("grad"), { project_sha: "abc" }), b = game("b", "0002", "p2", shot("grad", 20), { project_sha: "def" });
    const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never, { thresholds: { ...th, zero: 0.99 } });
    expect(rows.map((r) => r.project_sha)).toEqual(["abc", "def"]);
    expect(rows.find((r) => r.id === "b")!.zero).toBe(false); // 0.99 로 올리면 0.94 쌍은 0점이 아니다
    expect(THRESHOLDS[MEASURE_ID]!.zero).toBe(0.9);
  });
  it("다른 판정 이름으로 만든 화면은 비교하지 않고 던진다", () => {
    const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", { ...shot("grad"), measure: "pic-v2" });
    expect(() => judgeGame(b, [a, b], {})).toThrow();
  });
});
