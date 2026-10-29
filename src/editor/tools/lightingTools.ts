import { genId } from "@/util/id";
import { isPassable } from "@/project/collision";
import { normalizeLightingState, normalizeLightSource } from "@/project/lightingRules";
import type { Command, EventPage, GameEvent, LightSource, LightSourceAnchor, Rect, WeatherKind } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { LIGHT_SOURCE_SCHEMA, RECT_SCHEMA } from "./schemaShapes";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

/** 광원 하나 + 켜질 조건(스위치). when 이 있는 광원은 맵 기본 조명이 아니라 그 스위치가 켜진 동안 도는 병렬 이벤트가 붙인다. */
const CONDITIONAL_LIGHT_SOURCE_SCHEMA: JsonSchema = {
  ...LIGHT_SOURCE_SCHEMA,
  properties: {
    ...LIGHT_SOURCE_SCHEMA.properties,
    when: {
      type: "object",
      description: "켜질 조건(선택). {switchId} = 그 스위치가 켜지면 이 빛이 켜진다(맵에 있는 동안 켜져도 바로 켜짐, 맵에 다시 들어와도 유지). 예: 등을 건 집 창불.",
      properties: { switchId: { type: "string" } },
      required: ["switchId"],
    },
  },
};

const setLightingVolume: ToolDefinition = {
  name: "set_lighting_volume",
  description:
    "맵 또는 지정 영역에 암전/광원 설정을 한 번에 적용한다. applyMode='map'은 map.defaultLighting을 설정하고, applyMode='event'는 area 내부의 통행 불가 칸을 건너뛰고 나머지 칸마다 투명 playerTouch 이벤트를 생성한다. 영역 조명·암전은 이 툴, 맵 전체 분위기 프리셋은 set_scene_mood.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      ambient: { type: "number", description: "0=밝음, 1=암전" },
      color: { type: "string", description: "마스크 색상. 기본 #000000" },
      sources: {
        type: "array",
        description: "LightSource[]. at 은 객체: 플레이어를 따라가는 빛 {kind:'player'}, 칸 {x,y}, 이벤트 {eventId}. when:{switchId} 를 단 광원은 그 스위치가 켜졌을 때만 켜진다(applyMode map).",
        items: CONDITIONAL_LIGHT_SOURCE_SCHEMA,
      },
      applyMode: { type: "string", enum: ["map", "event"], description: "기본 map" },
      area: { ...RECT_SCHEMA, description: "event 모드 필수 {x,y,w,h}" },
    },
    required: ["mapId", "ambient"],
  },
  invalidArgsExample: {
    mapId: "map1",
    ambient: 0.85,
    sources: [{ id: "flashlight", at: { kind: "player" }, radius: 4, intensity: 1 }],
    applyMode: "map",
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const applyMode = args.applyMode === "event" ? "event" : "map";
    const split = splitConditionalSources(draft, args.sources, applyMode);
    const lighting = normalizeLightingState({
      ambient: numberArg(args.ambient, "ambient"),
      ...(typeof args.color === "string" && args.color.trim() ? { color: args.color.trim() } : {}),
      sources: sourceArgs(split.always),
    });
    if (applyMode === "map") {
      map.defaultLighting = lighting;
      const conditionalEventIds = upsertConditionalLightEvents(map, split.bySwitch);
      const conditionalCount = [...split.bySwitch.values()].reduce((n, list) => n + list.length, 0);
      return {
        summary: `${map.name} 기본 조명 설정 — ambient ${lighting.ambient.toFixed(2)}, 광원 ${lighting.sources.length}개` +
          (conditionalCount > 0 ? `, 스위치 조건 광원 ${conditionalCount}개(스위치 ${split.bySwitch.size}개)` : ""),
        data: { mapId: map.id, applyMode, lightCount: lighting.sources.length, conditionalLightCount: conditionalCount, conditionalEventIds },
      };
    }

    const area = rectArg(args.area, "area");
    assertAreaInMap(map, area);
    const eventIds: string[] = [];
    const skipped: Array<{ x: number; y: number }> = [];
    let skippedCount = 0;
    const commands = lightingCommands(lighting.ambient, lighting.color, lighting.sources);
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        if (!isPassable(draft, map, x, y)) {
          skippedCount += 1;
          if (skipped.length < 5) skipped.push({ x, y });
          continue;
        }
        const id = genId("ev_light_volume");
        map.events.push(lightingTriggerEvent(id, x, y, commands));
        eventIds.push(id);
      }
    }
    return {
      summary: `${map.name} 영역 조명 트리거 ${eventIds.length}개 생성 — ambient ${lighting.ambient.toFixed(2)}, 광원 ${lighting.sources.length}개`,
      ...(skippedCount > 0 ? { warnings: [impassableCellsWarning(skippedCount, skipped)] } : {}),
      data: { mapId: map.id, applyMode, area, eventIds, lightCount: lighting.sources.length },
    };
  },
};

const setSceneMood: ToolDefinition = {
  name: "set_scene_mood",
  description:
    "맵 분위기 프리셋처럼 날씨와 Phase 6a 조명 인자를 한 번에 적용한다. applyMode='map'은 map.defaultLighting과 맵 진입 날씨 이벤트를 설정하고, applyMode='event'는 lighting.area 내부의 통행 불가 칸을 건너뛰고 playerTouch 분위기 이벤트를 만든다. 「어둡게」「축제」「음산하게」 같은 분위기 요청의 정본. 등불·장식 소품은 place_props, 호러 슬라이스는 make_horror_loop/make_gallery_room 과 함께.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      weather: {
        type: "object",
        description: "{kind:'none'|'rain'|'storm'|'snow'|'fog', intensity?:0~1, transitionMs?:number}",
        additionalProperties: true,
      },
      lighting: {
        type: "object",
        description: "set_lighting_volume 와 같은 꼴: {ambient:0~1, color, sources:[{at:{kind:'player'}|{x,y}|{eventId}, radius, intensity?, color?, flicker?}], area?(applyMode event)} — 광원 자리는 at 안에 둔다.",
        additionalProperties: true,
      },
      applyMode: { type: "string", enum: ["map", "event"], description: "기본 map" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: {
    mapId: "map1",
    weather: { kind: "storm", intensity: 0.7, transitionMs: 300 },
    lighting: { ambient: 0.85, color: "#000000", sources: [{ id: "flashlight", at: { kind: "player" }, radius: 4, intensity: 1 }] },
    applyMode: "map",
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const weather = weatherCommandArg(args.weather);
    const lighting = lightingStateArg(args.lighting);
    if (!weather && !lighting) {
      throw new ToolError("weather 또는 lighting 중 하나는 필요합니다.", { code: "scene-mood-empty", mapId: map.id });
    }
    const applyMode = args.applyMode === "event" ? "event" : "map";
    if (applyMode === "map") {
      if (lighting) map.defaultLighting = lighting;
      const moodEventId = weather ? upsertSceneMoodAutoEvent(map, [weather]) : undefined;
      return {
        summary: `${map.name} 분위기 설정 — ${weather ? `날씨 ${weather.weather}` : "날씨 유지"}, ${lighting ? `ambient ${lighting.ambient.toFixed(2)}` : "조명 유지"}`,
        data: { mapId: map.id, applyMode, weatherKind: weather?.weather, lightCount: lighting?.sources.length ?? 0, eventIds: moodEventId ? [moodEventId] : [] },
      };
    }

    const area = sceneMoodAreaArg(args.lighting);
    assertAreaInMap(map, area);
    const commands = [
      ...(weather ? [weather] : []),
      ...(lighting ? lightingCommands(lighting.ambient, lighting.color, lighting.sources) : []),
    ];
    const eventIds: string[] = [];
    const skipped: Array<{ x: number; y: number }> = [];
    let skippedCount = 0;
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        if (!isPassable(draft, map, x, y)) {
          skippedCount += 1;
          if (skipped.length < 5) skipped.push({ x, y });
          continue;
        }
        const id = genId("ev_scene_mood");
        map.events.push(sceneMoodTriggerEvent(id, x, y, commands));
        eventIds.push(id);
      }
    }
    return {
      summary: `${map.name} 분위기 트리거 ${eventIds.length}개 생성 — ${weather ? `날씨 ${weather.weather}` : "날씨 유지"}, ${lighting ? `ambient ${lighting.ambient.toFixed(2)}` : "조명 유지"}`,
      ...(skippedCount > 0 ? { warnings: [impassableCellsWarning(skippedCount, skipped)] } : {}),
      data: { mapId: map.id, applyMode, area, weatherKind: weather?.weather, lightCount: lighting?.sources.length ?? 0, eventIds },
    };
  },
};

/** when:{switchId} 가 달린 광원을 떼어 스위치별로 묶는다. 없는 스위치는 거절(오타로 영영 안 켜지는 빛을 막는다). */
function splitConditionalSources(
  draft: { readonly switches: ReadonlyArray<{ readonly id: string }> },
  value: unknown,
  applyMode: "map" | "event",
): { always: unknown; bySwitch: Map<string, LightSource[]> } {
  const bySwitch = new Map<string, LightSource[]>();
  if (!Array.isArray(value)) return { always: value, bySwitch };
  const always: unknown[] = [];
  value.forEach((entry, index) => {
    const when = entry && typeof entry === "object" ? (entry as Record<string, unknown>).when : undefined;
    if (when === undefined) { always.push(entry); return; }
    const switchId = when && typeof when === "object" ? (when as Record<string, unknown>).switchId : undefined;
    if (typeof switchId !== "string" || !switchId.trim()) {
      throw new ToolError(`sources[${index}].when 은 {switchId} 입니다.`, { code: "lighting-source" });
    }
    if (applyMode !== "map") throw new ToolError(`sources[${index}].when 은 applyMode 'map' 에서만 씁니다.`, { code: "lighting-source" });
    if (!draft.switches.some((sw) => sw.id === switchId)) {
      throw new ToolError(`sources[${index}].when.switchId 스위치가 없습니다: ${switchId}. 먼저 스위치를 만드세요.`, { code: "lighting-source" });
    }
    const { when: _when, ...rest } = entry as Record<string, unknown>;
    const list = bySwitch.get(switchId) ?? [];
    list.push(normalizeLightSource(sourceArg(rest, `sources[${index}]`)));
    bySwitch.set(switchId, list);
  });
  return { always, bySwitch };
}

/**
 * 스위치 조건 광원 — 맵 조명은 맵에 들 때마다 기본값으로 돌아가므로, 그 스위치가 켜진 동안 도는 투명 병렬 이벤트가
 * 들 때마다 광원을 다시 붙인다(한 번 붙이고 오래 기다려 같은 빛을 거듭 붙이지 않는다). 같은 맵·스위치로 다시 부르면 덮어쓴다.
 */
function upsertConditionalLightEvents(map: GameMapLike, bySwitch: ReadonlyMap<string, readonly LightSource[]>): string[] {
  const ids: string[] = [];
  for (const [switchId, sources] of bySwitch) {
    const id = `ev_light_when_${sanitizeId(switchId)}`;
    const base = { graphic: { transparent: true }, priority: "below" as const, overlapForbidden: false, animationType: "fixedGraphic" as const, movement: PASSIVE };
    const event: GameEvent = {
      id, name: `조건 광원 · ${switchId}`, x: 0, y: 0, trigger: { kind: "parallel" }, commands: [],
      pages: [
        { ...base, id: `${id}_off`, name: "꺼짐", conditions: [], trigger: { kind: "action" }, commands: [] },
        {
          ...base, id: `${id}_on`, name: "켜짐", conditions: [{ kind: "switch", switchId, value: true }], trigger: { kind: "parallel" },
          commands: [...sources.map((source): Command => ({ kind: "addLight", source })), { kind: "wait", ms: 600000 } as unknown as Command],
        },
      ],
    } as GameEvent;
    const index = map.events.findIndex((entry) => entry.id === id);
    if (index >= 0) map.events[index] = event;
    else map.events.push(event);
    ids.push(id);
  }
  return ids;
}

function impassableCellsWarning(count: number, cells: readonly { x: number; y: number }[]): string {
  return `통행 불가 칸 ${count}개를 건너뛰었습니다: ${cells.map(({ x, y }) => `(${x}, ${y})`).join(", ")}`;
}

function lightingCommands(ambient: number, color: string | undefined, sources: readonly LightSource[]): Command[] {
  return [
    { kind: "setLighting", ambient, ...(color ? { color } : {}) },
    ...sources.map((source): Command => ({ kind: "addLight", source })),
  ];
}

function sceneMoodTriggerEvent(id: string, x: number, y: number, commands: readonly Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "분위기 영역",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [...commands],
      },
    ],
  };
}

function upsertSceneMoodAutoEvent(map: GameMapLike, commands: readonly Command[]): string {
  const id = `ev_scene_mood_${sanitizeId(map.id)}`;
  const event = sceneMoodAutoEvent(id, commands);
  const index = map.events.findIndex((entry) => entry.id === id);
  if (index >= 0) map.events[index] = event;
  else map.events.push(event);
  return id;
}

type GameMapLike = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  events: GameEvent[];
};

function sceneMoodAutoEvent(id: string, commands: readonly Command[]): GameEvent {
  return {
    id,
    x: 0,
    y: 0,
    trigger: { kind: "auto" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "맵 분위기",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "auto" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [...commands],
      },
    ],
  };
}

function lightingTriggerEvent(id: string, x: number, y: number, commands: readonly Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "조명 영역",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [...commands],
      },
    ],
  };
}

function sourceArgs(value: unknown): LightSource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError("sources는 배열이어야 합니다.", { code: "lighting-sources" });
  return value.map((entry, index) => normalizeLightSource(sourceArg(entry, `sources[${index}]`)));
}

function lightingStateArg(value: unknown): ReturnType<typeof normalizeLightingState> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("lighting은 객체여야 합니다.", { code: "scene-mood-lighting" });
  }
  const record = value as Record<string, unknown>;
  return normalizeLightingState({
    ambient: numberArg(record.ambient, "lighting.ambient"),
    ...(typeof record.color === "string" && record.color.trim() ? { color: record.color.trim() } : {}),
    sources: sourceArgs(record.sources),
  });
}

function weatherCommandArg(value: unknown): Extract<Command, { kind: "setWeather" }> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("weather는 객체여야 합니다.", { code: "scene-mood-weather" });
  }
  const record = value as Record<string, unknown>;
  const kind = weatherKindArg(record.kind);
  const intensity = record.intensity === undefined ? undefined : clamp01(numberArg(record.intensity, "weather.intensity"));
  const transitionMs = record.transitionMs === undefined ? undefined : Math.max(0, Math.round(numberArg(record.transitionMs, "weather.transitionMs")));
  return {
    kind: "setWeather",
    weather: kind,
    ...(intensity !== undefined ? { intensity } : {}),
    ...(transitionMs !== undefined ? { transitionMs } : {}),
  };
}

function weatherKindArg(value: unknown): WeatherKind {
  if (value === "none" || value === "rain" || value === "storm" || value === "snow" || value === "fog") return value;
  throw new ToolError("weather.kind는 none/rain/storm/snow/fog 중 하나여야 합니다.", { code: "scene-mood-weather-kind" });
}

function sceneMoodAreaArg(lighting: unknown): Rect {
  if (typeof lighting !== "object" || lighting === null || Array.isArray(lighting)) {
    throw new ToolError("applyMode='event'에는 lighting.area:{x,y,w,h}가 필요합니다.", { code: "scene-mood-area" });
  }
  return rectArg((lighting as Record<string, unknown>).area, "lighting.area");
}

function sourceArg(value: unknown, label: string): LightSource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "lighting-source" });
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : genId("light");
  return {
    id,
    // at 을 빼고 x·y(또는 eventId)를 광원에 바로 쓴 꼴도 받는다 — 조수가 8번 연달아 이 꼴로 거절당했다(2026-10-25 G21).
    at: lightAnchorArg(record.at === undefined && (typeof record.eventId === "string" || (record.x !== undefined && record.y !== undefined)) ? (typeof record.eventId === "string" ? { eventId: record.eventId } : { x: record.x, y: record.y }) : record.at, `${label}.at`),
    radius: numberArg(record.radius, `${label}.radius`),
    ...(record.intensity !== undefined ? { intensity: numberArg(record.intensity, `${label}.intensity`) } : {}),
    ...(typeof record.color === "string" && record.color.trim() ? { color: record.color.trim() } : {}),
    ...(record.flicker === true ? { flicker: true } : {}),
    ...(record.cone !== undefined ? { cone: coneArg(record.cone, `${label}.cone`) } : {}),
  };
}

/** 부채꼴 빛 {degrees, facing?} — 이벤트 앵커면 그 이벤트가 보는 쪽으로 돈다(경비 등불 시야). */
function coneArg(value: unknown, label: string): NonNullable<LightSource["cone"]> {
  const record = typeof value === "number" ? { degrees: value } : value;
  if (typeof record !== "object" || record === null || Array.isArray(record)) throw new ToolError(`${label}는 {degrees:20~180, facing?} 입니다.`, { code: "lighting-source" });
  const r = record as Record<string, unknown>;
  const degrees = Number(r.degrees);
  if (!Number.isFinite(degrees) || degrees < 20 || degrees > 180) throw new ToolError(`${label}.degrees 는 20~180 입니다.`, { code: "lighting-source" });
  const facing = r.facing;
  if (facing !== undefined && facing !== "up" && facing !== "down" && facing !== "left" && facing !== "right") throw new ToolError(`${label}.facing 은 up/down/left/right 입니다.`, { code: "lighting-source" });
  return { degrees, ...(facing ? { facing } : {}) };
}

function lightAnchorArg(value: unknown, label: string): LightSourceAnchor {
  if (value === "player") return "player";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 {kind:'player'}, {x,y}, {eventId} 중 하나여야 합니다(받은 값 ${JSON.stringify(value) ?? "없음"}). 예: sources:[{at:{kind:'player'},radius:4}, {at:{x:7,y:8},radius:3,color:'#ff9944'}, {at:{eventId:'ev_candle'},radius:2}].`, { code: "lighting-anchor" });
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "player" || record.target === "player") return "player";
  if (typeof record.eventId === "string") return { eventId: record.eventId };
  return { x: Math.trunc(numberArg(record.x, `${label}.x`)), y: Math.trunc(numberArg(record.y, `${label}.y`)) };
}

function rectArg(value: unknown, label: string): Rect {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("applyMode='event'에는 area:{x,y,w,h}가 필요합니다.", { code: "lighting-area" });
  }
  const record = value as Record<string, unknown>;
  return {
    x: Math.trunc(numberArg(record.x, `${label}.x`)),
    y: Math.trunc(numberArg(record.y, `${label}.y`)),
    w: Math.max(1, Math.trunc(numberArg(record.w ?? record.width, `${label}.w`))),
    h: Math.max(1, Math.trunc(numberArg(record.h ?? record.height, `${label}.h`))),
  };
}

function assertAreaInMap(map: { readonly id: string; readonly width: number; readonly height: number }, area: Rect): void {
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        throw new ToolError(`area가 맵 밖입니다: (${x}, ${y})`, { code: "lighting-area-out-of-bounds", mapId: map.id, x, y });
      }
    }
  }
}

function numberArg(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`${label} 숫자가 필요합니다.`, { code: "lighting-number" });
  }
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, "_");
}

export const LIGHTING_TOOLS: readonly ToolDefinition[] = [setLightingVolume, setSceneMood];
