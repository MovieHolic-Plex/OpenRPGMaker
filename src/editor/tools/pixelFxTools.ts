// pixelfx 코드 픽셀 효과(232종, MIT patch-gg/pixelfx) 조수 도구(2026-10-31).
//
//   list_pixel_fx     효과 찾기(낱말·분류·반복만) — id·이름·길이·반복·크기·태그·설명.
//   preview_pixel_fx  효과 한 개의 시간순 장면 그림(실제 렌더러, 색·뒤집기 반영).
//   attach_pixel_fx   효과를 전투 애니메이션 레코드(anim_pfx_*)로 만들고 기술·아이템·직업에 단다. target "animation" 이면
//                     레코드만 만들어 id 를 준다 — 이벤트 명령 showAnimation(한 번 효과)·script_cutscene animation 비트에 쓴다.
//   set_event_pixel_fx 이벤트 페이지 상시 효과(횃불·모닥불·반딧불·폭포·날씨). 페이지가 켜진 동안 이벤트 자리에서 계속 돈다.
//   place_pixel_fx    맵 칸에 효과만 있는 투명 이벤트를 놓는다(상시 효과). 떼려면 remove:true.
//
// 인자는 모두 고정 키다(자유 키 객체 금지 — Gemini 가 거절한다). 색은 palette(#hex 2~12개) 또는 color(#rrggbb 한 색 → 6단 띠).
import { isKnownPixelFxEffect, nearestPixelFx, PIXEL_FX_CATEGORIES, pixelFxEntry, pixelFxRampFromColor, searchPixelFx, type PixelFxCatalogEntry } from "@/pixelfx/catalog";
import { upsertPixelFxAnimationRecord } from "@/project/pixelFxAnimationRecords";
import { normalizeEventPixelFx, normalizePixelFxSpec } from "@/project/pixelFxSpec";
import type { BattleAnimationPosition, BattleAnimationScope, EventPage, EventPixelFx, GameEvent, PixelFxSpec } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const CATEGORY_IDS = PIXEL_FX_CATEGORIES.map((category) => category.id);
const LIST_DEFAULT = 20;
const LIST_MAX = 60;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function brief(entry: PixelFxCatalogEntry) {
  return {
    id: entry.id, name: entry.name, category: entry.category, loop: entry.loop, durationSec: entry.duration,
    size: `${entry.size[0]}x${entry.size[1]}`, ...(entry.actor ? { onCharacter: true } : {}), tags: entry.tags.slice(0, 8),
    desc: entry.desc.length > 160 ? `${entry.desc.slice(0, 157)}…` : entry.desc,
  };
}

function requireEffect(value: unknown): PixelFxCatalogEntry {
  const id = text(value);
  if (!id) throw new ToolError("effectId 가 필요합니다 — list_pixel_fx 로 찾으세요(예 \"fire/torch\").", { code: "pixel-fx-missing" });
  const entry = pixelFxEntry(id);
  if (!entry) {
    const near = nearestPixelFx(id).map((candidate) => candidate.id).join(", ");
    throw new ToolError(`없는 효과입니다: ${id} — 비슷한 효과: ${near || "(없음)"}. list_pixel_fx 로 id 를 확인하세요.`, { code: "pixel-fx-unknown" });
  }
  return entry;
}

const SPEC_PROPERTIES: Record<string, JsonSchema> = {
  effectId: { type: "string", description: "효과 id \"분류/이름\" (list_pixel_fx 결과). 예 \"fire/torch\", \"ice/frost-nova\"" },
  palette: { type: "array", items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, minItems: 2, maxItems: 12, description: "주 색 띠, 어두운→밝은 #rrggbb. 생략 = 효과 기본색" },
  color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$", description: "한 색(#rrggbb)으로 칠하기 — 어두운→밝은 6단 띠를 만든다. palette 와 같이 주면 palette 가 이긴다" },
  flip: { type: "boolean", description: "좌우 뒤집기(방향 있는 효과는 오른쪽을 본다). 전투에서 생략하면 대상 쪽을 자동으로 본다" },
  seed: { type: "integer", minimum: 0, maximum: 999999, description: "무작위 씨앗(같은 효과 여러 개를 서로 다르게)" },
};

/** 인자에서 효과 지정을 만든다(없는 효과는 거절). */
function specFromArgs(args: Record<string, unknown>): { spec: PixelFxSpec; entry: PixelFxCatalogEntry; warnings: string[] } {
  const entry = requireEffect(args.effectId);
  const warnings: string[] = [];
  let palette: string[] | undefined;
  if (Array.isArray(args.palette)) palette = args.palette.filter((c): c is string => typeof c === "string");
  else if (text(args.color)) {
    palette = pixelFxRampFromColor(text(args.color)!);
    if (!palette) warnings.push(`color 는 #rrggbb 여야 합니다(받은 값 ${String(args.color)}) — 기본색으로 둡니다.`);
  }
  const raw: Record<string, unknown> = { effectId: entry.id, palette, flip: args.flip, seed: args.seed, scale: args.scale, offsetX: args.offsetX, offsetY: args.offsetY, speed: args.speed };
  const spec = normalizePixelFxSpec(raw);
  if (!spec) throw new ToolError(`효과 지정을 만들 수 없습니다: ${entry.id}`, { code: "pixel-fx-invalid" });
  if (palette && !spec.palette) warnings.push("palette 는 #hex 2개 이상이어야 합니다 — 기본색으로 둡니다.");
  return { spec, entry, warnings };
}

const listPixelFx: ToolDefinition = {
  name: "list_pixel_fx",
  description:
    "코드로 그리는 픽셀 효과(pixelfx, 232종: 불·폭발·물·얼음·번개·SF·근접·타격·투사체·등장·비전·신성·어둠·상태·자연·날씨·UI·획득·전환·작은 생물)를 찾는다. " +
    "query 는 영어·한국어 낱말(예 'torch', '횃불', 'heal', '서리 폭발'), category 로 분류를 좁히고, loopOnly:true 면 상시로 돌릴 반복 효과(횃불·모닥불·반딧불·폭포·날씨)만. " +
    "결과의 id 를 attach_pixel_fx(기술·아이템·한 번 효과)·set_event_pixel_fx / place_pixel_fx(상시 효과)에 넣는다. 그리기 전에 preview_pixel_fx 로 모양을 본다. query·category 없이 부르면 분류별 개수만 준다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "찾을 낱말(공백으로 여러 개). 예 'campfire', '번개 내려치기'" },
      category: { type: "string", enum: CATEGORY_IDS, description: "분류로 좁히기" },
      loopOnly: { type: "boolean", description: "true = 반복 효과만(상시 효과용)" },
      limit: { type: "integer", minimum: 1, maximum: LIST_MAX, description: `최대 건수(기본 ${LIST_DEFAULT})` },
    },
  },
  invalidArgsExample: { query: "torch", loopOnly: true },
  run(_draft, args): ToolExecResult {
    const query = text(args.query) ?? "";
    const category = text(args.category);
    if (!query && !category) {
      const counts = PIXEL_FX_CATEGORIES.map((c) => ({ id: c.id, about: c.blurb, count: searchPixelFx("", { category: c.id, limit: 999 }).length }));
      return { summary: `픽셀 효과 ${counts.reduce((sum, c) => sum + c.count, 0)}종 — query 나 category 로 좁혀 다시 조회`, data: { categories: counts } };
    }
    const limit = Math.min(LIST_MAX, Math.max(1, Math.floor(Number(args.limit)) || LIST_DEFAULT));
    const found = searchPixelFx(query, { ...(category ? { category } : {}), ...(args.loopOnly === true ? { loop: true } : {}), limit });
    return { summary: `픽셀 효과 ${found.length}종${query ? ` ('${query}')` : ""}`, data: { items: found.map(brief) } };
  },
};

const previewPixelFx: ToolDefinition = {
  name: "preview_pixel_fx",
  description:
    "픽셀 효과 하나를 실제 렌더러로 그린 시간순 장면 그림(한 장, 6~8칸, 2배)을 본다. 색(palette/color)·flip 을 주면 그대로 반영한다. " +
    "attach_pixel_fx·set_event_pixel_fx 전에 모양·크기·색이 장면에 맞는지 확인할 때 쓴다. 그림은 이미지 입력으로 전달된다.",
  mode: "read",
  parameters: { type: "object", properties: { ...SPEC_PROPERTIES }, required: ["effectId"] },
  invalidArgsExample: { effectId: "fire/campfire" },
  run(_draft, args): ToolExecResult {
    const { spec, entry, warnings } = specFromArgs(args);
    return {
      summary: `「${entry.name}」(${entry.id}) ${entry.loop ? "반복" : "한 번"} ${entry.duration}초 · ${entry.size[0]}×${entry.size[1]} — 장면 그림을 확인하세요.`,
      warnings,
      data: { spec, ...brief(entry) },
    };
  },
};

const attachPixelFx: ToolDefinition = {
  name: "attach_pixel_fx",
  description:
    "픽셀 효과를 전투 애니메이션 레코드(anim_pfx_*)로 만들고(같은 효과·색이면 있는 것을 다시 쓴다) 기술(skill)·아이템(item)·직업 통상 공격(class)의 animationId 로 단다. " +
    "도트 측면 전투에서도 기술 연출보다 이 효과가 보인다. target:'animation' 이면 레코드만 만들고 id 를 돌려준다 — 이벤트 명령 {kind:'showAnimation', target, animationId, wait} 나 " +
    "script_cutscene 의 animation 비트에 그 id 를 넣으면 필드에서 대상(주인공·이벤트·칸) 발밑에 한 번 튼다. position 은 효과 원점(발·착탄점)을 놓을 자리(기본 feet).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      ...SPEC_PROPERTIES,
      target: { type: "string", enum: ["skill", "item", "class", "animation"], description: "어디에 다나. animation = 레코드만" },
      recordId: { type: "string", description: "target 이 skill/item/class 일 때 그 레코드 id" },
      name: { type: "string", description: "애니메이션 레코드 이름(생략 = 효과 이름)" },
      position: { type: "string", enum: ["feet", "center", "head", "screen"], description: "앵커(기본 feet)" },
      scope: { type: "string", enum: ["singleTarget", "allTargets", "screen"], description: "범위(기본 singleTarget)" },
      speed: { type: "number", minimum: 0.25, maximum: 4, description: "재생 속도(기본 1)" },
      scale: { type: "integer", minimum: 1, maximum: 4, description: "화면 배율(기본 1 = 게임 한 화소)" },
    },
    required: ["effectId", "target"],
  },
  invalidArgsExample: { effectId: "ice/frost-nova", target: "skill", recordId: "skill_ice" },
  run(draft, args): ToolExecResult {
    const { spec, entry, warnings } = specFromArgs(args);
    const target = text(args.target);
    const position = text(args.position) as BattleAnimationPosition | undefined;
    const scope = text(args.scope) as BattleAnimationScope | undefined;
    const recordId = text(args.recordId);
    const collection = target === "skill" ? draft.database.skills : target === "item" ? draft.database.items : target === "class" ? draft.database.classes : undefined;
    const record = collection && recordId ? collection.find((entry) => entry.id === recordId) : undefined;
    if (collection && !record) {
      throw new ToolError(`${target} 레코드를 찾을 수 없습니다: ${recordId ?? "(recordId 없음)"} — get_database_records 로 id 를 확인하세요.`, { code: "pixel-fx-record-missing" });
    }
    const id = upsertPixelFxAnimationRecord(draft.database.battleAnimations, spec, {
      name: text(args.name) ?? (record ? `${record.name} — ${entry.name}` : `${entry.name} (pixelfx)`),
      ...(position ? { position } : {}),
      ...(scope ? { scope } : {}),
    });
    if (!id) throw new ToolError(`효과 레코드를 만들지 못했습니다: ${entry.id}`, { code: "pixel-fx-invalid" });
    if (record) record.animationId = id;
    if (entry.loop && target !== "animation") warnings.push(`「${entry.id}」는 반복 효과다 — 전투에서는 1.2초만 돌고 꺼진다. 한 번 효과(loop:false)가 더 맞을 수 있다.`);
    return {
      summary: record ? `「${record.name}」(${record.id})에 픽셀 효과 「${entry.name}」(${entry.id}) → 애니메이션 ${id}` : `픽셀 효과 애니메이션 ${id} (「${entry.name}」) — showAnimation 의 animationId 로 쓰세요`,
      warnings,
      data: { animationId: id, effectId: entry.id, ...(record ? { target, recordId: record.id } : {}) },
    };
  },
};

function findEvent(draft: Parameters<ToolDefinition["run"]>[0], mapId: string, eventId: string): GameEvent {
  const map = requireMap(draft, mapId);
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) throw new ToolError(`이벤트를 찾을 수 없습니다: ${eventId} (맵 ${mapId}) — find_events 로 id 를 확인하세요.`, { code: "event-not-found", mapId });
  return event;
}

const LAYER_SCHEMA: JsonSchema = {
  type: "string", enum: ["auto", "back", "front"],
  description: "auto = 효과의 뒤·앞 층을 캐릭터와 y 정렬(횃불·모닥불, 기본) · back = 통째로 캐릭터 뒤(바닥 마법진·물결) · front = 통째로 위(날씨·안개·반딧불 떼)",
};
const PLACEMENT_PROPERTIES: Record<string, JsonSchema> = {
  layer: LAYER_SCHEMA,
  scale: { type: "integer", minimum: 1, maximum: 4, description: "화면 배율(기본 1)" },
  offsetX: { type: "integer", minimum: -64, maximum: 64, description: "칸 바닥 가운데에서 가로 밀기(게임 화소)" },
  offsetY: { type: "integer", minimum: -64, maximum: 64, description: "칸 바닥에서 세로 밀기(게임 화소, 위는 음수) — 벽 횃불은 -8~-16" },
  speed: { type: "number", minimum: 0.25, maximum: 4, description: "재생 속도(기본 1)" },
};

function eventSpec(args: Record<string, unknown>): { spec: EventPixelFx; entry: PixelFxCatalogEntry; warnings: string[] } {
  const { spec, entry, warnings } = specFromArgs(args);
  const layer = text(args.layer);
  const full = normalizeEventPixelFx({ ...spec, ...(layer ? { layer } : {}) })!;
  if (!entry.loop) warnings.push(`「${entry.id}」는 한 번 효과다 — 상시 효과로 달면 끝날 때마다 다시 튼다. 계속 도는 것(loopOnly)을 고르면 더 자연스럽다.`);
  return { spec: full, entry, warnings };
}

const setEventPixelFx: ToolDefinition = {
  name: "set_event_pixel_fx",
  description:
    "이벤트 페이지에 상시 픽셀 효과(page.pixelFx)를 단다 — 그 페이지가 켜진 동안 이벤트 칸 바닥 가운데에서 계속 돈다(횃불·모닥불·화로·촛불·분수·폭포·반딧불·벚꽃·날씨). " +
    "페이지 전환으로 켜고 끈다(예: 불 붙이기 스위치 뒤 페이지에만 fire/campfire). pageId 생략 = 모든 페이지. remove:true 면 뗀다. " +
    "새 칸에 효과만 놓으려면 place_pixel_fx. 이벤트 그림(횃대·모닥불 나무)은 그대로 두고 효과만 겹친다 — 벽 횃불은 offsetY 로 불꽃 높이를 맞춘다.",
  mode: "write",
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "맵 id(생략 = 보고 있는 맵)" },
      eventId: { type: "string", description: "이벤트 id" },
      pageId: { type: "string", description: "페이지 id(생략 = 모든 페이지)" },
      remove: { type: "boolean", description: "true = 효과 떼기(effectId 불필요)" },
      ...SPEC_PROPERTIES,
      ...PLACEMENT_PROPERTIES,
    },
    required: ["eventId"],
  },
  invalidArgsExample: { eventId: "ev_campfire", effectId: "fire/campfire" },
  run(draft, args): ToolExecResult {
    const mapId = text(args.mapId);
    if (!mapId) throw new ToolError("mapId 가 필요합니다.", { code: "map-missing" });
    const event = findEvent(draft, mapId, text(args.eventId) ?? "");
    const pageId = text(args.pageId);
    const pages = (event.pages ?? []).filter((page) => !pageId || page.id === pageId);
    if (pages.length === 0) throw new ToolError(`페이지를 찾을 수 없습니다: ${pageId ?? "(페이지 없음)"} — get_event 로 페이지 id 를 확인하세요.`, { code: "page-not-found", mapId });
    if (args.remove === true) {
      for (const page of pages) delete page.pixelFx;
      return { summary: `이벤트 ${event.id} 페이지 ${pages.length}개에서 상시 효과를 뗐습니다.` };
    }
    const { spec, entry, warnings } = eventSpec(args);
    for (const page of pages) page.pixelFx = { ...spec };
    return {
      summary: `이벤트 ${event.id}(${event.x},${event.y}) 페이지 ${pages.length}개에 상시 효과 「${entry.name}」(${entry.id}${spec.layer ? `, ${spec.layer}` : ""})`,
      warnings,
      data: { mapId, eventId: event.id, pageIds: pages.map((page) => page.id), pixelFx: spec },
    };
  },
};

const placePixelFx: ToolDefinition = {
  name: "place_pixel_fx",
  description:
    "맵 칸(x,y)에 효과만 있는 투명 이벤트(통과 가능, 조사 없음)를 놓고 상시 픽셀 효과를 단다 — 횃불·모닥불 불꽃, 분수 물, 폭포 물보라, 반딧불·벚꽃·눈 같은 장소 분위기. " +
    "같은 칸에 이미 놓은 효과 이벤트가 있으면 바꾼다. remove:true 면 그 칸의 효과 이벤트를 지운다. 장작·횃대 같은 받침 그림은 타일·기물로 따로 깐다. " +
    "날씨류(weather/*)는 화면만 한 큰 효과라 맵 가운데쯤 한 개, layer:'front'.",
  mode: "write",
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "맵 id(생략 = 보고 있는 맵)" },
      x: { type: "integer", minimum: 0, description: "칸 x" },
      y: { type: "integer", minimum: 0, description: "칸 y" },
      remove: { type: "boolean", description: "true = 이 칸의 효과 이벤트 지우기" },
      name: { type: "string", description: "이벤트 이름(생략 = 효과 이름)" },
      ...SPEC_PROPERTIES,
      ...PLACEMENT_PROPERTIES,
    },
    required: ["x", "y"],
  },
  invalidArgsExample: { x: 10, y: 6, effectId: "fire/torch", offsetY: -10 },
  run(draft, args): ToolExecResult {
    const mapId = text(args.mapId);
    if (!mapId) throw new ToolError("mapId 가 필요합니다.", { code: "map-missing" });
    const map = requireMap(draft, mapId);
    const x = Math.floor(Number(args.x));
    const y = Math.floor(Number(args.y));
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
      throw new ToolError(`칸이 맵 밖입니다: (${String(args.x)},${String(args.y)}) — 맵 크기 ${map.width}×${map.height}`, { code: "out-of-bounds", mapId });
    }
    const id = `ev_pfx_${x}_${y}`;
    const index = map.events.findIndex((event) => event.id === id);
    if (args.remove === true) {
      if (index < 0) return { summary: `(${x},${y}) 에 효과 이벤트가 없습니다.` };
      map.events.splice(index, 1);
      return { summary: `(${x},${y}) 의 효과 이벤트 ${id} 를 지웠습니다.` };
    }
    const { spec, entry, warnings } = eventSpec(args);
    const page: EventPage = {
      id: `${id}_p1`, name: entry.name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" },
      priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], pixelFx: spec,
    };
    const event: GameEvent = { id, name: text(args.name) ?? `효과: ${entry.name}`, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
    if (index >= 0) map.events[index] = event;
    else map.events.push(event);
    return {
      summary: `(${x},${y}) 에 상시 효과 「${entry.name}」(${entry.id}) — 이벤트 ${id}${index >= 0 ? " (바꿈)" : ""}`,
      warnings,
      data: { mapId, eventId: id, pixelFx: spec },
    };
  },
};

export const PIXEL_FX_TOOLS: readonly ToolDefinition[] = [listPixelFx, previewPixelFx, attachPixelFx, setEventPixelFx, placePixelFx];

/** 조수 오류 메시지·테스트용: 효과 id 가 목록에 있는가. */
export { isKnownPixelFxEffect };
