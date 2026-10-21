// src/harnesses/map-objects/editor/runner.ts
/**
 * map-objects 의 공방 실행기 — 지금 맵 칩셋에 없는 물건을 그 칩셋 화풍으로 그린다.
 * 그리기·고치기·검수는 object-gen 흐름 그대로다(_core/workshop/objectGenFlow.ts, 2026-10-21): 원본 지시문·견본·숨긴 반려 표본·다수결.
 * 화풍 기준(닮은 물체·시트 조각)은 그릴 때마다 env.tilesetSource 로 받은 칩셋에서 잘라 붙이고,
 * 팔레트는 기물을 정의할 때 뽑아 정의에 넣어 둔다(카드 그림이 칩셋 상태와 무관하게 같은 색으로 나오게).
 */
import type { ContentPart } from "@/ai/llmClient";
import { onBackground, renderGrid, scaleImage } from "@/harnesses/_core/workshop/grid";
import type { AnchorSample, Grid, ItemDefinition, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem, WorkshopRunner, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";
import { gateAdviceMessages, parseGateAdvice } from "@/harnesses/_core/workshop/gateAdvice";
import { workshopRefDescribe } from "@/harnesses/_core/workshop/referencePrompt";
import {
  kitValue, loadAnchors, OG_DIRECTIONS, OG_LOOKS, ogCheck, ogDrawMessages, ogLookMessage, ogReview, type OgAnchors, type OgStyle,
} from "@/harnesses/_core/workshop/objectGenFlow";
import { parseMapObjectVerdict } from "./checks";
import { mapItemFromDefinition, paletteFromHexes } from "./items";
import { reviewBrief, reviewSystemPrompt } from "./prompts";
import { dominantColor, sheetExcerpt, similarObjects } from "./sheet";

const FALLBACK_BACKGROUND: Rgba = [96, 96, 96, 255];
const ANCHOR_LIMIT = 3;
type Style = { readonly name: string; readonly background: Rgba; readonly refs: readonly { label: string; url: string }[] };
const ogStyle = (style: Style): OgStyle => ({ name: style.name, floor: style.background, refs: style.refs });

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

  /** 원본 견본 묶음(oprn-interior-v5-large). 못 읽으면 칩셋 물체를 GOOD 으로 쓴다(원본 anchor_cards 의 견본 없는 갈래). */
  let anchorsPending: Promise<OgAnchors | null> | null = null;
  const anchorsFor = (env: WorkshopEnv): Promise<OgAnchors | null> =>
    (anchorsPending ??= loadAnchors(env).catch((error) => { console.warn("[workshop] object-gen 견본을 못 읽음:", error); anchorsPending = null; return null; }));

  const runner: WorkshopRunner = {
    harnessId: "map-objects",
    label: "맵 기물",
    // 원본 flow: 후보 A·B 두 장, 참고 그림 2장, 그리기 + 불통과 다시 그리기 1번, 미리보기 고치기.
    candidates: OG_DIRECTIONS.length,
    referenceCount: 2,
    referenceStyleNote: kitValue("reference", "STYLE_NOTE"),
    maxAttempts: 2,
    looks: OG_LOOKS,
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
    directions: () => OG_DIRECTIONS,
    anchors(item, picked) {
      // 같은 칩셋에서 사용자가 고른 기물만 기준으로 — 다른 칩셋 것은 색이 다르다
      const sameSheet = new Set(items.filter((other) => other.tilesetId === item.tilesetId && other.key !== item.key).map((other) => other.key));
      return picked.filter((pick) => sameSheet.has(pick.itemKey)).slice(0, ANCHOR_LIMIT)
        .map((pick): AnchorSample => ({ ...pick, title: items.find((other) => other.key === pick.itemKey)?.title ?? pick.itemKey }));
    },
    async drawMessages(ctx, env) {
      const style = await styleFor(ctx.item, env);
      return ogDrawMessages(ctx, env, ogStyle(style), await anchorsFor(env));
    },
    async lookMessage(ctx, grid, env, look, max) {
      const style = await styleFor(ctx.item, env);
      return ogLookMessage(ctx, grid, env, ogStyle(style), look, max);
    },
    async review(ctx, env, ask) {
      const style = await styleFor(ctx.item, env);
      return ogReview(ctx, env, ogStyle(style), await anchorsFor(env), ask);
    },
    async reviewMessages(ctx, env) {
      const style = await styleFor(ctx.item, env);
      const actual = (scale: number) => env.encodePng(scaleImage(onBackground(renderGrid(ctx.candidate, ctx.palette), style.background), scale));
      const parts: ContentPart[] = [
        label(reviewBrief(ctx, style.name)),
        label("후보 1배 (실제 게임 크기 — 먼저 본다)"), image(actual(1)),
        label("후보 2배"), image(actual(2)),
        label("후보 (8배)"), image(shot(env, ctx.candidate, ctx.palette, style.background)),
      ];
      for (const ref of style.refs) parts.push(label(ref.label), image(ref.url));
      return [{ role: "system", content: reviewSystemPrompt() }, { role: "user", content: parts }];
    },
    referenceDescribe: workshopRefDescribe,
    adviseMessages: gateAdviceMessages,
    parseAdvice: parseGateAdvice,
    // 원본 checks.check 의 FAIL 코드만 막는다(WARN 은 미리보기에서 보여 준다). 판정은 블라인드 검수 다수결이 정한다.
    hardCheck: (item, grid) => ogCheck(item, grid, runner.palette(item)).hard.map((issue) => `${issue.code}: ${issue.msg}`),
    parseVerdict: parseMapObjectVerdict,
    gate: (_item, verdict) => verdict,
  };
  return runner;
}
