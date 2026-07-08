import { genId } from "@/util/id";
import { normalizeLightingState, normalizeLightSource } from "@/player/lighting";
import type { Command, EventPage, GameEvent, LightSource, LightSourceAnchor, Rect } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

const setLightingVolume: ToolDefinition = {
  name: "set_lighting_volume",
  description:
    "맵 또는 지정 영역에 암전/광원 설정을 한 번에 적용한다. applyMode='map'은 map.defaultLighting을 설정하고, applyMode='event'는 area 내부 칸마다 투명 playerTouch 이벤트를 생성한다.",
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
        items: { type: "object" },
      },
      applyMode: { type: "string", enum: ["map", "event"], description: "기본 map" },
      area: { type: "object", description: "event 모드 필수 {x,y,w,h}" },
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
    const commands = lightingCommands(lighting.ambient, lighting.color, lighting.sources);
    for (let y = area.y; y < area.y + area.h; y += 1) {
      for (let x = area.x; x < area.x + area.w; x += 1) {
        const id = genId("ev_light_volume");
        map.events.push(lightingTriggerEvent(id, x, y, commands));
        eventIds.push(id);
      }
    }
    return {
      summary: `${map.name} 영역 조명 트리거 ${eventIds.length}개 생성 — ambient ${lighting.ambient.toFixed(2)}, 광원 ${lighting.sources.length}개`,
      data: { mapId: map.id, applyMode, area, eventIds, lightCount: lighting.sources.length },
    };
  },
};

function lightingCommands(ambient: number, color: string | undefined, sources: readonly LightSource[]): Command[] {
  return [
    { kind: "setLighting", ambient, ...(color ? { color } : {}) },
    ...sources.map((source): Command => ({ kind: "addLight", source })),
  ];
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

export const LIGHTING_TOOLS: readonly ToolDefinition[] = [setLightingVolume];
