// src/harnesses/map-objects/editor/runner.ts
/**
 * map-objects 의 공방 실행기 — 지금 맵 칩셋에 없는 물건을 그 칩셋 화풍으로 그린다.
 * 화풍 기준(닮은 물체·시트 조각)은 그릴 때마다 env.tilesetSource 로 받은 칩셋에서 잘라 붙이고,
 * 팔레트는 기물을 정의할 때 뽑아 정의에 넣어 둔다(카드 그림이 칩셋 상태와 무관하게 같은 색으로 나오게).
 */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type { AnchorSample, Grid, ItemDefinition, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem, WorkshopRunner, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";
import { mapObjectHardCheck, parseMapObjectVerdict } from "./checks";
import { mapItemFromDefinition, paletteFromHexes } from "./items";
import { drawBrief, drawSystemPrompt, MAP_DIRECTIONS, reviewBrief, reviewSystemPrompt } from "./prompts";
import { dominantColor, sheetExcerpt, similarObjects } from "./sheet";

const FALLBACK_BACKGROUND: Rgba = [96, 96, 96, 255];
const ANCHOR_LIMIT = 3;
type Style = { readonly name: string; readonly background: Rgba; readonly refs: readonly { label: string; url: string }[] };

export function createMapObjectRunner(): WorkshopRunner {
  let defs: readonly ItemDefinition[] = [];
  let items: WorkshopItem[] = [];
  const palettes = new Map<string, Palette>();
  const styles = new Map<string, Promise<Style>>();

  const image = (url: string): ContentPart => ({ type: "image_url", image_url: { url, detail: "high" } });
  const label = (text: string): ContentPart => ({ type: "text", text });
  const shot = (env: WorkshopEnv, grid: Grid, palette: Palette, background: Rgba): string =>
    env.encodePng(scaleImage(onBackground(renderGrid(grid, palette), background), 8));
  const picture = (env: WorkshopEnv, source: RgbaImage, background: Rgba, scale: number): string =>
    env.encodePng(scaleImage(onBackground(source, background), scale));

  /** 칩셋에서 화풍 기준 그림을 한 번만 만든다(같은 칩셋 기물끼리 나눠 쓴다). 칩셋을 못 읽으면 기준 없이 그린다. */
  function styleFor(item: WorkshopItem, env: WorkshopEnv): Promise<Style> {
    const id = item.tilesetId ?? "";
    const key = `${id}|${item.key}`;
    let pending = styles.get(key);
    if (!pending) {
      pending = (async (): Promise<Style> => {
        const source: WorkshopTilesetSource | null = id && env.tilesetSource ? await env.tilesetSource(id) : null;
        if (!source) return { name: id || "(칩셋 없음)", background: FALLBACK_BACKGROUND, refs: [] };
        const background = dominantColor(source.image);
        const refs = similarObjects(source, item.title, item.description).map((object) => ({
          label: `칩셋 물체: ${object.name} (8배)`, url: picture(env, object.image, background, 8),
        }));
        const excerpt = sheetExcerpt(source);
        refs.push({ label: "칩셋 조각 (3배)", url: picture(env, excerpt, background, 3) });
        return { name: source.name, background, refs };
      })();
      pending.catch(() => styles.delete(key));
      styles.set(key, pending);
    }
    return pending;
  }

  const runner: WorkshopRunner = {
    harnessId: "map-objects",
    label: "맵 기물",
    candidates: 3,
    async prepare() { /* 시트는 기물마다 그릴 때 읽는다 */ },
    items(next) {
      if (next !== defs || items.length !== next.filter((def) => def.tilesetId).length) {
        defs = next;
        items = next.filter((def) => def.tilesetId).map(mapItemFromDefinition);
        palettes.clear();
      }
      return items;
    },
    palette(item) {
      let palette = palettes.get(item.key);
      if (!palette) {
        palette = paletteFromHexes(defs.find((def) => def.key === item.key)?.palette);
        palettes.set(item.key, palette);
      }
      return palette;
    },
    currentGrid: () => null,
    directions: () => MAP_DIRECTIONS,
    anchors(item, picked) {
      // 같은 칩셋에서 사용자가 고른 기물만 기준으로 — 다른 칩셋 것은 색이 다르다
      const sameSheet = new Set(items.filter((other) => other.tilesetId === item.tilesetId && other.key !== item.key).map((other) => other.key));
      return picked.filter((pick) => sameSheet.has(pick.itemKey)).slice(0, ANCHOR_LIMIT)
        .map((pick): AnchorSample => ({ ...pick, title: items.find((other) => other.key === pick.itemKey)?.title ?? pick.itemKey }));
    },
    async drawMessages(ctx, env) {
      const style = await styleFor(ctx.item, env);
      const parts: ContentPart[] = [label(drawBrief(ctx, style.name))];
      for (const ref of style.refs) parts.push(label(ref.label), image(ref.url));
      if (ctx.previousGrid) parts.push(label("지난 시도(8배)"), image(shot(env, ctx.previousGrid, ctx.palette, style.background)));
      for (const anchor of ctx.anchors) parts.push(label(`이 칩셋에서 사용자가 고른 기물: ${anchor.title} (8배)`), image(shot(env, anchor.grid, runner.palette(items.find((i) => i.key === anchor.itemKey) ?? ctx.item), style.background)));
      ctx.rejected.forEach((rejected, index) => parts.push(label(`버린 것 ${index + 1}`), image(shot(env, rejected.grid, ctx.palette, style.background))));
      return [{ role: "system", content: drawSystemPrompt() }, { role: "user", content: parts }] satisfies ChatMessage[];
    },
    async reviewMessages(ctx, env) {
      const style = await styleFor(ctx.item, env);
      const parts: ContentPart[] = [label(reviewBrief(ctx)), label("후보 (8배)"), image(shot(env, ctx.candidate, ctx.palette, style.background))];
      for (const ref of style.refs) parts.push(label(ref.label), image(ref.url));
      return [{ role: "system", content: reviewSystemPrompt() }, { role: "user", content: parts }];
    },
    hardCheck: mapObjectHardCheck,
    parseVerdict: parseMapObjectVerdict,
    gate: (_item, verdict) => verdict,
  };
  return runner;
}
