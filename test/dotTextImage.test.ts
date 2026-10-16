import { afterEach, describe, expect, it } from "vitest";
import { generateDotArt, setDotTextChat } from "@/ai/dotTextArt";
import { cropOpaque, DotTextImageError, generateDotTextImage, parseDotGrid, planDotCanvas, scaleNearest, type DotTextChat } from "@/ai/dotTextImage";
import { cutsceneDotPrompt, setCutsceneArtGenerator } from "@/editor/tools/cutsceneArtTools";
import { generateDatabaseRecordWithAi } from "@/editor/aiDatabaseGeneration";
import { generateImageAsset } from "@/editor/imageAssetGeneration";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { defaultAiConfig } from "@/ai/llmClient";

const square = (n: number, fill: (x: number, y: number) => boolean): string[] =>
  Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (fill(x, y) ? "a" : ".")).join(""));
const answer = (rows: string[]): string => JSON.stringify({ legend: { a: "#aa3322" }, rows });
const reply = (text: string) => ({ text, model: "stub-pixel", provider: "stub" });

afterEach(() => { setDotTextChat(undefined); setCutsceneArtGenerator(undefined); });

describe("낱장 도트 생성기(텍스트 모델이 격자로 찍는다)", () => {
  it("긴 변 64 이하는 1배, 넘으면 칸이 64 이하가 되는 정수 배로 확대한다", () => {
    expect(planDotCanvas(32)).toEqual({ box: 32, factor: 1 });
    expect(planDotCanvas(64)).toEqual({ box: 64, factor: 1 });
    expect(planDotCanvas(96)).toEqual({ box: 48, factor: 2 });
    expect(planDotCanvas(224)).toEqual({ box: 56, factor: 4 });
  });

  it("격자를 읽어 여백을 자르고 정수 배로 키운 투명 PNG 를 낸다", async () => {
    const plan = planDotCanvas(96);
    const image = await generateDotTextImage({ prompt: "truck", longSidePx: 96 }, async () => reply(answer(square(plan.box, (x, y) => x > 4 && x < 43 && y > 10 && y < 38))));
    expect(image).toMatchObject({ dot: true, mimeType: "image/png", model: "stub-pixel", width: 38 * 2, height: 27 * 2 });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("줄 수·폭·색이 틀리면 오류 글을 돌려 고치게 하고, 끝까지 틀리면 거절한다 — 다른 경로로 몰래 대체하지 않는다", async () => {
    const plan = planDotCanvas(16);
    let asked = 0;
    const seen: string[] = [];
    const chat: DotTextChat = async (messages) => {
      asked += 1;
      seen.push(messages[messages.length - 1]!.content);
      return reply(asked === 1 ? answer(square(15, () => true)) : answer(square(plan.box, (x, y) => x > 2 && y > 2 && x < 12 && y < 12)));
    };
    const ok = await generateDotTextImage({ prompt: "gem", longSidePx: 16 }, chat);
    expect(asked).toBe(2);
    expect(seen[1]).toContain("16줄");
    expect(ok.width).toBeGreaterThan(0);
    await expect(generateDotTextImage({ prompt: "gem", longSidePx: 16 }, async () => reply("not json"))).rejects.toBeInstanceOf(DotTextImageError);
  });

  it("parseDotGrid 는 legend 밖 글자·팔레트 초과·#rrggbb 아님을 거른다", () => {
    const plan = planDotCanvas(8);
    expect(parseDotGrid(JSON.stringify({ legend: { a: "red" }, rows: square(8, () => true) }), plan)).toMatchObject({ ok: false });
    expect(parseDotGrid(JSON.stringify({ legend: { a: "#000000" }, rows: square(8, () => false).map((r, i) => (i === 0 ? "b".repeat(8) : r)) }), plan)).toMatchObject({ ok: false });
    expect(parseDotGrid(JSON.stringify({ legend: { ".": "#000000" }, rows: square(8, () => true) }), plan)).toMatchObject({ ok: false });
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [String.fromCharCode(98 + i), "#101010"]));
    expect(parseDotGrid(JSON.stringify({ legend: many, rows: square(8, () => false) }), plan)).toMatchObject({ ok: false });
    expect(parseDotGrid(answer(square(8, (x) => x < 4)), plan)).toMatchObject({ ok: true });
  });

  it("cropOpaque·scaleNearest 는 화소를 그대로 둔다", () => {
    const px = new Uint8ClampedArray(4 * 4 * 4);
    px.set([9, 8, 7, 255], (1 * 4 + 2) * 4);
    const cropped = cropOpaque(4, 4, px)!;
    expect(cropped).toMatchObject({ width: 1, height: 1 });
    const big = scaleNearest(1, 1, cropped.rgba, 3);
    expect(big.width).toBe(3);
    expect([...big.rgba.subarray(0, 4)]).toEqual([9, 8, 7, 255]);
  });
});

describe("도트 용도는 도트 경로로, 낱장 도트가 아닌 용도는 거절", () => {
  it("generateDotArt 는 생성형·공방 용도를 거절한다", async () => {
    setDotTextChat(async () => reply(answer(square(8, () => true))));
    await expect(generateDotArt({ prompt: "x", purpose: "title-art" })).rejects.toBeInstanceOf(DotTextImageError);
    await expect(generateDotArt({ prompt: "x", purpose: "tileset" })).rejects.toBeInstanceOf(DotTextImageError);
    await expect(generateDotArt({ prompt: "x", purpose: "item-icon", longSidePx: 8 })).resolves.toMatchObject({ dot: true });
  });

  it("컷신 style:game 소품은 이미지 모델이 아니라 도트 저작 모델로 찍는다 (이미지 생성기를 불러서는 안 된다)", async () => {
    let imageCalls = 0;
    let prompts = 0;
    setCutsceneArtGenerator(async () => { imageCalls += 1; throw new Error("불려서는 안 된다"); });
    setDotTextChat(async (messages) => {
      prompts += 1;
      expect(messages[1]!.content).toContain("3/4 top-down");
      const plan = planDotCanvas(64);
      return reply(answer(square(plan.box, (x, y) => x > 3 && x < 60 && y > 20 && y < 44)));
    });
    const ctx = { project: createBlankProject() };
    const args = { role: "sprite", prompt: "white box delivery truck, side-on", name: "트럭", tiles: 4 };
    await prepareTool("generate_cutscene_art", args);
    const result = runTool(ctx, "generate_cutscene_art", args, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(imageCalls).toBe(0);
    expect(prompts).toBe(1);
    expect(cutsceneDotPrompt("truck")).not.toContain("magenta");
  });

  it("이미지 생성기만 꽂힌 헤드리스 하네스는 옛 경로를 쓴다(준비된 그림 그대로)", async () => {
    let imageCalls = 0;
    setCutsceneArtGenerator(async () => {
      imageCalls += 1;
      throw new Error("헤드리스 생성기 호출됨");
    });
    const args = { role: "sprite", prompt: "headless legacy truck", name: "옛 경로", tiles: 4 };
    await prepareTool("generate_cutscene_art", args);
    expect(imageCalls).toBe(1);
  });

  it("아이템 아이콘은 도트 저작 모델이 찍은 투명 PNG 를 그대로 쓴다(배경 지우기 없음)", async () => {
    setDotTextChat(async () => reply(answer(square(32, (x, y) => x > 8 && x < 24 && y > 6 && y < 26))));
    let flattened = 0;
    const outcome = await generateDatabaseRecordWithAi(
      { kind: "item", brief: "푸른 엘릭서", config: defaultAiConfig(), withArtwork: true },
      {
        currentProject: () => createBlankProject(),
        complete: async () => ({ message: { role: "assistant", content: '{"name":"푸른 엘릭서","price":300}' }, finishReason: "stop" }),
        flattenArtwork: async (dataUrl) => { flattened += 1; return dataUrl; },
        applyCalls: (calls) => calls.map(() => ({ ok: true, summary: "적용" })),
      },
    );
    expect(flattened).toBe(0);
    expect(outcome.artworkDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(outcome.artworkModel).toBe("stub-pixel");
  });

  it("조수 generate_image_asset pixel:true 는 도트 저작 모델로 가고, 생략하면 이미지 모델로 간다", async () => {
    setDotTextChat(async () => reply(answer(square(32, (x, y) => x > 8 && x < 24 && y > 6 && y < 26))));
    let imageCalls = 0;
    const generateImage = async () => { imageCalls += 1; return { dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "img", provider: "img" }; };
    const dot = await generateImageAsset({ kind: "picture", prompt: "붉은 열쇠 아이콘", pixel: true }, { generateImage });
    expect(dot).toMatchObject({ ok: true, kind: "picture" });
    expect(imageCalls).toBe(0);
    const art = await generateImageAsset({ kind: "picture", prompt: "붉은 열쇠 아이콘" }, { generateImage });
    expect(art.ok).toBe(true);
    expect(imageCalls).toBe(1);
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "generate_image_asset", { kind: "title", prompt: "타이틀 배경", pixel: true }).ok).toBe(false);
  });
});
