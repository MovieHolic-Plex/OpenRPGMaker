import { genId } from "@/util/id";
import { isPassable } from "@/project/collision";
import { normalizeLightingState, normalizeLightSource } from "@/project/lightingRules";
import type { Command, EventPage, GameEvent, LightSource, LightSourceAnchor, Rect, WeatherKind } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { LIGHT_SOURCE_SCHEMA, RECT_SCHEMA } from "./schemaShapes";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

const setLightingVolume: ToolDefinition = {
  name: "set_lighting_volume",
  description:
    "맵 또는 지정 영역에 암전/광원 설정을 한 번에 적용한다. applyMode='map'은 map.defaultLighting을 설정하고, applyMode='event'는 area 내부의 통행 불가 칸을 건너뛰고 나머지 칸마다 투명 playerTouch 이벤트를 생성한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      ambient: { type: "number", description: "0=밝음, 1=암전" },
      color: { type: "string", description: "마스크 색상. 기본 #000000" },
      sources: {
        type: "array",
        description: "LightSource[]. at은 'player' 문자열, {x,y}, {eventId}, 또는 {kind:'player'}를 허용한다.",
        items: LIGHT_SOURCE_SCHEMA,
      },
      applyMode: { type: "string", enum: ["map", "event"], description: "기본 map" },
      area: { ...RECT_SCHEMA, description: "event 모드 필수 {x,y,w,h}" },
    },
    required: ["mapId", "ambient"],
  },
  invalidArgsExample: {
    mapId: "map1",
    ambient: 0.85,
    sources: [{ id: "flashlight", at: "player", radius: 4, intensity: 1 }],
    applyMode: "map",
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const lighting = normalizeLightingState({
      ambient: numberArg(args.ambient, "ambient"),
      ...(typeof args.color === "string" && args.color.trim() ? { color: args.color.trim() } : {}),
      sources: sourceArgs(args.sources),
    });
    const applyMode = args.applyMode === "event" ? "event" : "map";
    if (applyMode === "map") {
      map.defaultLighting = lighting;
      return {
        summary: `${map.name} 기본 조명 설정 — ambient ${lighting.ambient.toFixed(2)}, 광원 ${lighting.sources.length}개`,
        data: { mapId: map.id, applyMode, lightCount: lighting.sources.length },
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
    "맵 분위기 프리셋처럼 날씨와 Phase 6a 조명 인자를 한 번에 적용한다. applyMode='map'은 map.defaultLighting과 맵 진입 날씨 이벤트를 설정하고, applyMode='event'는 lighting.area 내부의 통행 불가 칸을 건너뛰고 playerTouch 분위기 이벤트를 만든다.",
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
        description: "set_lighting_volume의 ambient/color/sources/area 인자를 재사용한다.",
        additionalProperties: true,
      },
      applyMode: { type: "string", enum: ["map", "event"], description: "기본 map" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: {
    mapId: "map1",
    weather: { kind: "storm", intensity: 0.7, transitionMs: 300 },
    lighting: { ambient: 0.85, color: "#000000", sources: [{ id: "flashlight", at: "player", radius: 4, intensity: 1 }] },
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
    at: lightAnchorArg(record.at, `${label}.at`),
    radius: numberArg(record.radius, `${label}.radius`),
    ...(record.intensity !== undefined ? { intensity: numberArg(record.intensity, `${label}.intensity`) } : {}),
    ...(typeof record.color === "string" && record.color.trim() ? { color: record.color.trim() } : {}),
    ...(record.flicker === true ? { flicker: true } : {}),
  };
}

function lightAnchorArg(value: unknown, label: string): LightSourceAnchor {
  if (value === "player") return "player";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 'player', {x,y}, {eventId} 중 하나여야 합니다.`, { code: "lighting-anchor" });
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
