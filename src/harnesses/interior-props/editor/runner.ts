// src/harnesses/interior-props/editor/runner.ts
/** interior-props 의 공방 실행기. 매니페스트 harness.ts 의 workshop 로더가 부른다. */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { imageToGrid, onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type {
  AnchorSample, DrawContext, Grid, ItemDefinition, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem, WorkshopRunner,
} from "@/harnesses/_core/workshop/types";
import { interiorGate, interiorHardCheck, parseInteriorVerdict } from "./checks";
import { cropCells, FLAT_KINDS, itemFromDefinition, itemFromSpec, SHEET_PATH, specObjects, VIEW_FAIL } from "./items";
import { paletteForItem } from "./palette";
import { DIRECTIONS, drawBrief, drawSystemPrompt, EXAMPLES, NEW_DIRECTIONS, REVIEW_REFS, reviewBrief, reviewSystemPrompt, selfCheckText } from "./prompts";

const BACKGROUND: Rgba = [150, 120, 90, 255];
const ANCHOR_LIMIT = 4;

export function createInteriorRunner(): WorkshopRunner {
  let prepared: Promise<void> | null = null;
  const currentImages = new Map<string, RgbaImage>();
  const examples = new Map<string, string>();
  const palettes = new Map<string, Palette>();
  const currentGrids = new Map<string, Grid | null>();
  let specItems: WorkshopItem[] = [];
  let lastDefs: readonly ItemDefinition[] = [];
  let allItems: WorkshopItem[] = [];

  const shot = (env: WorkshopEnv, grid: Grid, palette: Palette, scale = 8): string =>
    env.encodePng(scaleImage(onBackground(renderGrid(grid, palette), BACKGROUND), scale));
  const image = (url: string): ContentPart => ({ type: "image_url", image_url: { url, detail: "high" } });
  const label = (text: string): ContentPart => ({ type: "text", text });

  function sideBySide(env: WorkshopEnv, left: Grid, right: Grid, palette: Palette): string {
    const a = onBackground(renderGrid(left, palette), BACKGROUND), b = onBackground(renderGrid(right, palette), BACKGROUND);
    const gap = 4, width = a.width + gap + b.width, height = Math.max(a.height, b.height);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set([60, 48, 36, 255], i);
    const blit = (src: RgbaImage, ox: number) => {
      for (let y = 0; y < src.height; y++) data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((y + height - src.height) * width + ox) * 4);
    };
    blit(a, 0);
    blit(b, a.width + gap);
    return env.encodePng(scaleImage({ width, height, data }, 8));
  }

  /** 기준 그림 격자는 그 기물의 팔레트 키다(own:N 은 기물마다 다르다) — 자기 팔레트로 그린다. 버린 후보는 같은 기물이라 ctx.palette. */
  const paletteOf = (itemKey: string, fallback: Palette): Palette => {
    const meta = allItems.find((i) => i.key === itemKey);
    return meta ? runner.palette(meta) : fallback;
  };

  const runner: WorkshopRunner = {
    harnessId: "interior-props",
    candidates: 5,
    prepare(env) {
      if (prepared) return prepared;
      const attempt = (async () => {
        const sheet = await env.loadImage(env.assetUrl(SHEET_PATH));
        specItems = specObjects().map(([key, object]) => {
          const current = cropCells(sheet, object.cells);
          currentImages.set(key, current);
          return itemFromSpec(key, object, current);
        });
        for (const example of EXAMPLES) {
          const picture = await env.loadImage(env.assetUrl(`assets/harnesses/interior-props/examples/${example.file}.png`));
          examples.set(example.file, env.encodePng(scaleImage(onBackground(picture, BACKGROUND), 8)));
        }
      })();
      prepared = attempt;
      // 실패한 약속을 굳히지 않는다 — 다음 prepare 가 처음부터 다시 시도한다.
      attempt.catch(() => { if (prepared === attempt) prepared = null; });
      return attempt;
    },
    items(defs) {
      if (defs !== lastDefs || allItems.length === 0) {
        lastDefs = defs;
        allItems = [...specItems, ...defs.map(itemFromDefinition)];
      }
      return allItems;
    },
    palette(item) {
      let palette = palettes.get(item.key);
      if (!palette) {
        palette = paletteForItem(currentImages.get(item.key) ?? null);
        palettes.set(item.key, palette);
      }
      return palette;
    },
    currentGrid(item) {
      if (!currentGrids.has(item.key)) {
        const current = currentImages.get(item.key);
        currentGrids.set(item.key, current ? imageToGrid(current, runner.palette(item)).grid : null);
      }
      return currentGrids.get(item.key) ?? null;
    },
    directions: (item) => (item.isNew ? NEW_DIRECTIONS : DIRECTIONS),
    anchors(item, picked) {
      const byKey = new Map(allItems.map((i) => [i.key, i]));
      const furniture = !FLAT_KINDS.has(item.kind);
      const ok = (candidate: WorkshopItem | undefined, fromSheet: boolean) =>
        candidate !== undefined && candidate.key !== item.key && !(furniture && FLAT_KINDS.has(candidate.kind)) && !(fromSheet && VIEW_FAIL.has(candidate.key));
      const out: AnchorSample[] = [];
      const push = (sample: AnchorSample) => { if (out.length < ANCHOR_LIMIT && !out.some((a) => a.itemKey === sample.itemKey)) out.push(sample); };
      for (const pick of picked) {
        const meta = byKey.get(pick.itemKey);
        if (ok(meta, false) && meta!.category === item.category) push({ ...pick, title: meta!.title });
      }
      const fromSheet = (candidate: WorkshopItem) => {
        const grid = runner.currentGrid(candidate);
        if (grid) push({ itemKey: candidate.key, title: candidate.title, grid, picked: false });
      };
      for (const ref of item.refs) { const meta = byKey.get(ref); if (ok(meta, true)) fromSheet(meta!); }
      for (const candidate of specItems) if (ok(candidate, true) && candidate.category === item.category) fromSheet(candidate);
      for (const candidate of specItems) if (ok(candidate, true) && candidate.kind === item.kind) fromSheet(candidate);
      return out;
    },
    async drawMessages(ctx: DrawContext, env) {
      const parts: ContentPart[] = [label(drawBrief(ctx))];
      if (!FLAT_KINDS.has(ctx.item.kind)) for (const example of EXAMPLES) parts.push(label(example.label), image(examples.get(example.file)!));
      if (ctx.current) parts.push(label("지금 시트의 그림(8배)"), image(shot(env, ctx.current, ctx.palette)));
      if (ctx.previousGrid) parts.push(label("지난 시도(8배)"), image(shot(env, ctx.previousGrid, ctx.palette)));
      for (const anchor of ctx.anchors) parts.push(label(`기준 그림: ${anchor.title}${anchor.picked ? " (이 프로젝트에서 고른 것)" : ""}`), image(shot(env, anchor.grid, paletteOf(anchor.itemKey, ctx.palette))));
      ctx.rejected.forEach((rejected, index) => parts.push(label(`버린 것 ${index + 1}`), image(shot(env, rejected.grid, ctx.palette))));
      return [{ role: "system", content: drawSystemPrompt() }, { role: "user", content: parts }] satisfies ChatMessage[];
    },
    selfCheckMessage(ctx, grid, env) {
      const parts: ContentPart[] = [label(selfCheckText(ctx)), label("네 격자(8배)"), image(shot(env, grid, ctx.palette))];
      if (ctx.current) parts.push(label("지금 그림(8배)"), image(shot(env, ctx.current, ctx.palette)));
      return { role: "user", content: parts };
    },
    async reviewMessages(ctx, env) {
      const parts: ContentPart[] = [label(reviewBrief(ctx))];
      if (ctx.current) parts.push(label("왼쪽 = 지금 그림, 오른쪽 = 후보 (8배)"), image(sideBySide(env, ctx.current, ctx.candidate, ctx.palette)));
      parts.push(label("후보 (8배)"), image(shot(env, ctx.candidate, ctx.palette)));
      if (!FLAT_KINDS.has(ctx.item.kind)) for (const file of REVIEW_REFS) parts.push(label(`칩셋 기준 가구: ${file.replace("good-", "")}`), image(examples.get(file)!));
      for (const anchor of ctx.anchors) parts.push(label(`화풍 기준: ${anchor.title}`), image(shot(env, anchor.grid, paletteOf(anchor.itemKey, ctx.palette))));
      return [{ role: "system", content: reviewSystemPrompt() }, { role: "user", content: parts }];
    },
    hardCheck: (item, grid) => interiorHardCheck(item, grid, runner.currentGrid(item)),
    parseVerdict: parseInteriorVerdict,
    gate: interiorGate,
  };
  return runner;
}
