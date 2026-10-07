import { describe, expect, it } from "vitest";
import {
  collectOpaqueColors, gridToAnswer, imageToGrid, makePalette, onBackground, opaqueBounds,
  parseDrawAnswer, renderGrid, scaleImage, repairStringExpressions, rowsNeedingFix, applyRowFix,
} from "@/harnesses/_core/workshop/grid";

const palette = makePalette([
  { key: "wood:2", rgba: [99, 49, 11, 255] },
  { key: "wood:6", rgba: [183, 114, 70, 255] },
  { key: "shadow:0", rgba: [28, 20, 24, 110] },
]);

describe("parseDrawAnswer", () => {
  it("코드 펜스와 앞뒤 글을 걸러 격자를 읽는다", () => {
    const text = '좋아요.\n```json\n{"legend":{"a":"wood:2","b":"wood:6"},"rows":["ab.","..a"],"note":"윗판 3행","topRows":3}\n```\n끝';
    const parsed = parseDrawAnswer(text, palette);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.grid).toEqual({ width: 3, height: 2, cells: ["wood:2", "wood:6", null, null, null, "wood:2"] });
    expect(parsed.note).toBe("윗판 3행");
    expect(parsed.topRows).toBe(3);
  });
  it("팔레트 밖 색·legend 에 없는 글자·길이가 다른 줄을 이유와 함께 거절한다", () => {
    expect(parseDrawAnswer('{"legend":{"a":"gold:9"},"rows":["a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("gold:9") });
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["ax"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("「x」") });
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["aa","a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("rows[1]") });
    expect(parseDrawAnswer('{"legend":{".":"wood:2"},"rows":["."]}', palette)).toEqual({ ok: false, error: expect.stringContaining("투명") });
    expect(parseDrawAnswer("그림을 못 그렸어요", palette)).toEqual({ ok: false, error: expect.stringContaining("JSON") });
  });
});

describe("격자 ↔ 그림", () => {
  const grid = { width: 2, height: 2, cells: ["wood:2", null, "shadow:0", "wood:6"] };
  it("renderGrid 는 팔레트 색을 그대로, 투명은 0 으로 쓴다", () => {
    const image = renderGrid(grid, palette);
    expect([...image.data.slice(0, 8)]).toEqual([99, 49, 11, 255, 0, 0, 0, 0]);
    expect([...image.data.slice(8, 12)]).toEqual([28, 20, 24, 110]);
  });
  it("imageToGrid 는 renderGrid 의 역이고 모르는 색을 따로 돌려준다", () => {
    expect(imageToGrid(renderGrid(grid, palette), palette)).toEqual({ grid, unknown: [] });
    const odd = renderGrid(grid, palette);
    odd.data.set([1, 2, 3, 255], 4);
    expect(imageToGrid(odd, palette).unknown).toEqual(["#010203"]);
  });
  it("gridToAnswer 는 parseDrawAnswer 로 그대로 되읽힌다", () => {
    const parsed = parseDrawAnswer(JSON.stringify(gridToAnswer(grid)), palette);
    expect(parsed.ok && parsed.grid).toEqual(grid);
  });
  it("scaleImage·onBackground·opaqueBounds·collectOpaqueColors", () => {
    const image = renderGrid(grid, palette);
    const big = scaleImage(image, 3);
    expect([big.width, big.height]).toEqual([6, 6]);
    expect([...big.data.slice((5 * 6 + 5) * 4, (5 * 6 + 5) * 4 + 4)]).toEqual([183, 114, 70, 255]);
    const bg = onBackground(image, [150, 120, 90, 255]);
    expect([...bg.data.slice(4, 8)]).toEqual([150, 120, 90, 255]);
    expect(opaqueBounds(image)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(collectOpaqueColors(image).length).toBe(3);
  });
});

describe("모델 답 수선(2026-10-07 실측 꼴)", () => {
  it("JSON 안에 남긴 .replace·[a:b]·if False else 를 값으로 풀어 읽는다", () => {
    const sliced = '{"legend":{"a":"wood:2"},"rows":["aaa"[0:2],"a."]}';
    expect(parseDrawAnswer(sliced, palette)).toMatchObject({ ok: true, grid: { width: 2, height: 2 } });
    const replaced = '{"legend":{"a":"wood:2"},"rows":["aа".replace("а","a"),"a."]}';
    expect(parseDrawAnswer(replaced, palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", "wood:2", "wood:2", null] } });
    const conditional = '{"legend":{"a":"wood:2"},"rows":["aaa"[0:2] if False else "a.","aa"]}';
    expect(parseDrawAnswer(conditional, palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", null, "wood:2", "wood:2"] } });
    expect(repairStringExpressions('{"a":"x\\"y"}')).toBe('{"a":"x\\"y"}');
  });
  it("[0:0] 으로 지운 빈 줄은 뺀다", () => {
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["aa","aa"[0:0],"a."]}', palette)).toMatchObject({ ok: true, grid: { height: 2 } });
  });
  it("키릴 「о」는 legend 의 라틴 「o」로 읽고, 그 밖의 깨진 JSON 은 그대로 거절한다", () => {
    expect(parseDrawAnswer('{"legend":{"o":"wood:2"},"rows":["oо"]}', palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", "wood:2"] } });
    expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["a." "a"]}', palette).ok).toBe(false);
  });
  it("폭이 틀린 줄만 골라 다시 받고 덮어 쓴다", () => {
    const text = '{"legend":{"a":"wood:2"},"rows":["aa","aaa","a."],"note":"n"}';
    expect(rowsNeedingFix(text, 2, 3)).toEqual({ rows: ["aa", "aaa", "a."], bad: [1] });
    expect(rowsNeedingFix(text, 2, 4)).toBeNull();
    const patched = applyRowFix(text, '고친 줄: {"rows":{"1":".a"}}')!;
    expect(parseDrawAnswer(patched, palette)).toMatchObject({ ok: true, note: "n", grid: { cells: ["wood:2", "wood:2", null, "wood:2", "wood:2", null] } });
    expect(applyRowFix(text, '{"rows":{"9":"aa"}}')).toBeNull();
  });
});
