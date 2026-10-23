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
import { refCells, workshopRefDescribe } from "@/harnesses/_core/workshop/referencePrompt";
import {
  aspectOf, aspectSheet, kitValue, loadAnchors, ogBaseGrid, ogIsOrganic, ogPaletteWithBase, ogPickBase, ogStyleSetFor, OG_DIRECTIONS, OG_LOOKS, ogCheck, ogDrawMessages, ogLookMessage, ogReview, type OgAnchors, type OgStyle,
} from "@/harnesses/_core/workshop/objectGenFlow";
import { parseMapObjectVerdict } from "./checks";
import { mapItemFromDefinition, paletteFromHexes } from "./items";
import { reviewBrief, reviewSystemPrompt } from "./prompts";
import { classObjects, dominantColor, sheetExcerpt, similarObjects } from "./sheet";
import { footprintClass } from "@/harnesses/_core/workshop/footprint";

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
  // 견본 묶음은 물건마다 고른다: 자연물(나무·덤불·꽃·바위…)은 버들항 손 도트 나무(oprn-beodeul-organic), 나머지는 실내 v5 가구.
  const anchorsPending = new Map<string, Promise<OgAnchors | null>>();
  const anchorsFor = (env: WorkshopEnv, item: WorkshopItem): Promise<OgAnchors | null> => {
    const set = ogStyleSetFor(item);
    let pending = anchorsPending.get(set);
    if (!pending) {
      pending = loadAnchors(env, set).catch((error) => { console.warn("[workshop] object-gen 견본을 못 읽음:", error); anchorsPending.delete(set); return null; });
      anchorsPending.set(set, pending);
    }
    return pending;
  };

  const runner: WorkshopRunner = {
    harnessId: "map-objects",
    label: "맵 기물",
    // 원본 flow: 후보 A·B 두 장, 참고 그림 2장, 그리기 + 불통과 다시 그리기 1번, 미리보기 고치기.
    candidates: OG_DIRECTIONS.length,
    referenceCount: 2,
    referenceStyleNote: kitValue("reference", "STYLE_NOTE"),
    // 자연물은 시도 3번(2026-10-23 감독 결정): 잎 질감 검사 하나를 고치면 다른 검사에 걸리는 일이 잦아 두 번으로는 후보가 안 남았다.
    maxAttempts: (item) => (ogIsOrganic(item) ? 3 : 2),
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
        // 칩셋 출발 그림이 있으면 그 그림의 색을 뒤에 붙인다(object-gen bases.with_colors — 앞 키의 뜻은 그대로)
        palette = paletteFromHexes(ogPaletteWithBase(defs.find((def) => def.key === item.key)?.palette ?? [], ogPickBase(item)));
        palettes.set(item.key, palette);
      }
      return palette;
    },
    currentGrid: () => null,
    // 자연물(나무·덤불·꽃밭·바위)은 칩셋의 가장 가까운 손 도트 기물에서 출발한다(object-gen base-from-chipset, 2026-10-23).
    async base(item, env) {
      const base = ogPickBase(item);
      if (!base) return null;
      return { id: base.id, label: base.label, sources: base.sources, grid: await ogBaseGrid(base, item, runner.palette(item), env) };
    },
    directions: () => OG_DIRECTIONS,
    anchors(item, picked) {
      // 같은 칩셋에서 사용자가 고른 기물만 기준으로 — 다른 칩셋 것은 색이 다르다
      const sameSheet = new Set(items.filter((other) => other.tilesetId === item.tilesetId && other.key !== item.key).map((other) => other.key));
      return picked.filter((pick) => sameSheet.has(pick.itemKey)).slice(0, ANCHOR_LIMIT)
        .map((pick): AnchorSample => ({ ...pick, title: items.find((other) => other.key === pick.itemKey)?.title ?? pick.itemKey }));
    },
    async drawMessages(ctx, env) {
      const style = await styleFor(ctx.item, env);
      return ogDrawMessages(ctx, env, ogStyle(style), await anchorsFor(env, ctx.item));
    },
    async lookMessage(ctx, grid, env, look, max) {
      const style = await styleFor(ctx.item, env);
      return ogLookMessage(ctx, grid, env, ogStyle(style), look, max);
    },
    async review(ctx, env, ask) {
      const style = await styleFor(ctx.item, env);
      return ogReview(ctx, env, ogStyle(style), await anchorsFor(env, ctx.item), ask);
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
    // 참고 그림 견본(원본 reference 흐름의 exemplar_sheet + job refs, 물체 비율 캔버스): 이름이 맞는 칩셋 물체 ≤2(대상 게임의 시점·결) + object-gen 견본.
    // 이름이 안 맞는 칩셋 물체는 넣지 않는다 — 2026-10-22 A/B 에서 아무 화분이나 붙였더니 나무 참고 그림이 화분을 베꼈다.
    async referenceAnchor(item, env) {
      const anchors = await anchorsFor(env, item);
      const id = item.tilesetId ?? "";
      const source = id && env.tilesetSource ? await env.tilesetSource(id) : null;
      // 칩셋 안 같은 종류(이름이 맞거나 크기 사전 종류가 같은 것) → 없으면 칩셋의 여러 칸 물체. 실내 예시(침대·옷장)는 칩셋이 없을 때만 —
      // 야외 짐마차·분수 견본에 침대·옷장이 붙어 비율만 흐렸다(2026-10-22 VQA).
      const own = source ? similarObjects(source, item.title, item.description, 2, true) : [];
      const cls = footprintClass(item.title, item.description);
      if (source && cls && own.length < 2) {
        for (const object of classObjects(source, cls, 2)) if (own.length < 2 && !own.some((o) => o.name === object.name)) own.push(object);
      }
      if (source && !own.length) own.push(...similarObjects(source, item.title, item.description, 2, false));
      const pictures = own.length ? own.map((object) => object.image) : (anchors?.examples.map((anchor) => anchor.image) ?? []);
      if (!pictures.length) return null;
      const cells = refCells(item);
      const sheet = aspectSheet(pictures, aspectOf(cells.w, cells.h), source ? dominantColor(source.image) : FALLBACK_BACKGROUND);
      return sheet ? env.encodePng(sheet) : null;
    },
    adviseMessages: gateAdviceMessages,
    parseAdvice: parseGateAdvice,
    // 원본 checks.check 의 FAIL 코드만 막는다(WARN 은 미리보기에서 보여 준다). 판정은 블라인드 검수 다수결이 정한다.
    hardCheck: (item, grid) => ogCheck(item, grid, runner.palette(item)).hard.map((issue) => `${issue.code}: ${issue.msg}`),
    parseVerdict: parseMapObjectVerdict,
    gate: (_item, verdict) => verdict,
  };
  return runner;
}
