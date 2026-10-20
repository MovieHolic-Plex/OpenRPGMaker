/**
 * 『첫사랑』 맵 — 실내는 jp_city 손 도트 예제 평면(firstLoveRooms.json)을 build_hand_interior_room 으로,
 * 회사 앞 거리는 modern_city 거리 구성기로 짓는다(간판에 일본 글자가 없는 거리).
 *
 * 낮·밤은 같은 맵을 복사해 조명만 바꾼다(밤 거리·야근 사무실·막차 승강장). 같은 장소가 시간에 따라 바뀌는 것을
 * 같은 그림으로 보여 준다 — 새 그림은 그리지 않는다.
 *
 * 이 파일은 시각 담당(맵·배치)이 다듬는다. 이야기 쪽(firstLove.ts)은 아래 FL_MAP 의 id 와
 * FirstLoveAnchors 의 칸만 쓴다 — 배치를 바꿔도 앵커 계약(걸어서 닿는 바닥 칸)을 지키면 이야기는 그대로 돈다.
 */
import { normalizeAtmosphereEffects } from "@/project/atmosphere";
import { canMove, isPassable } from "@/project/collision";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import type { GameMap, LightSource, Project } from "@/project/types";
import roomsJson from "./firstLoveRooms.json";

export type ExecTool = (name: string, args: Record<string, unknown>) => { data?: unknown };

export const FL_MAP = {
  platformAm: "fl_platform_am",
  platformPm: "fl_platform_pm",
  street: "fl_street",
  streetPm: "fl_street_pm",
  office: "fl_office",
  officePm: "fl_office_pm",
  officeFri: "fl_office_fri",
  rooftop: "fl_rooftop",
  konbini: "fl_konbini",
  broadcast: "fl_broadcast",
} as const;

export type Cell = { x: number; y: number };

export interface FirstLoveAnchors {
  /** 승강장: 내린 자리 · 계단(거리로) · 막차 장면의 지후 자리. */
  readonly platform: { readonly arrive: Cell; readonly exit: Cell; readonly jihu: Cell; readonly heroMeet: Cell };
  /** 거리: 회사 문 · 편의점 문 · 지하철 입구, 각 문 앞에서 다시 나오는 칸. */
  readonly street: {
    readonly officeDoor: Cell; readonly officeOut: Cell;
    readonly konbiniDoor: Cell; readonly konbiniOut: Cell;
    readonly subway: Cell; readonly subwayOut: Cell;
    readonly arrive: Cell;
  };
  /** 사무층: 엘리베이터(거리로) · 계단(옥상으로) · 서하 자리 · 지후 자리 · 팀장 자리 · 탕비실 · 회의실. */
  readonly office: {
    readonly elevator: Cell; readonly elevatorOut: Cell;
    readonly stairs: Cell; readonly stairsOut: Cell;
    readonly heroDesk: Cell; readonly jihuDesk: Cell; readonly leadDesk: Cell;
    readonly pantry: Cell; readonly meeting: Cell; readonly meetingSeat: Cell; readonly whiteboard: Cell;
  };
  readonly rooftop: { readonly door: Cell; readonly doorOut: Cell; readonly rail: Cell; readonly bench: Cell };
  readonly konbini: { readonly door: Cell; readonly doorOut: Cell; readonly cooler: Cell; readonly counter: Cell };
  readonly broadcast: { readonly start: Cell; readonly mailbox: Cell; readonly booth: Cell };
}

type RoomSpec = {
  name: string; plan: string[]; floor: string; wall: string; zones?: unknown[]; objects?: unknown[]; tables?: unknown[]; goods?: unknown[];
  rooms?: unknown[]; narrow?: unknown[]; exitWidth?: number; start: [number, number];
};
const ROOMS = roomsJson as unknown as Record<"office" | "konbini" | "rooftop" | "platform" | "broadcast", RoomSpec>;

function buildRoom(exec: ExecTool, mapId: string, name: string, spec: RoomSpec): void {
  exec("build_hand_interior_room", {
    tileset: JP_CITY_ID, mapId, name, plan: spec.plan, floor: spec.floor, wall: spec.wall,
    zones: spec.zones ?? [], objects: spec.objects ?? [], tables: spec.tables ?? [], goods: spec.goods ?? [],
    ...(spec.exitWidth ? { exitWidth: spec.exitWidth } : {}),
    start: [{ x: spec.start[0], y: spec.start[1] }], links: [], replace: true,
  });
}

/** 맨 아래 줄 틈(출입구) 중 가운데 칸. */
function bottomGap(map: GameMap, project: Project): Cell {
  const y = map.height - 1;
  const xs: number[] = [];
  for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) xs.push(x);
  if (xs.length === 0) throw new Error(`[first-love] ${map.id}: 아래 출입구 틈이 없다`);
  return { x: xs[Math.floor((xs.length - 1) / 2)]!, y };
}

/** origin 에서 가장 가까운, 걸어 들어갈 수 있는 빈 칸(이벤트 없는 칸). */
export function nearestFree(project: Project, map: GameMap, origin: Cell, maxR = 8, avoid: readonly Cell[] = []): Cell {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = origin.x + dx, y = origin.y + dy;
        if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
        if (!isPassable(project, map, x, y)) continue;
        if (map.events.some((e) => e.x === x && e.y === y)) continue;
        if (avoid.some((c) => c.x === x && c.y === y)) continue;
        const open = (["up", "down", "left", "right"] as const).some((d) => {
          const nx = x + (d === "left" ? -1 : d === "right" ? 1 : 0), ny = y + (d === "up" ? -1 : d === "down" ? 1 : 0);
          return canMove(project, map, x, y, nx, ny);
        });
        if (open) return { x, y };
      }
    }
  }
  throw new Error(`[first-love] ${map.id}: (${origin.x},${origin.y}) 근처에 빈 칸이 없다`);
}

function cloneMap(project: Project, fromId: string, toId: string, name: string): GameMap {
  const src = project.maps[fromId];
  if (!src) throw new Error(`[first-love] 복사할 맵 없음: ${fromId}`);
  const copy = structuredClone(src);
  copy.id = toId;
  copy.name = name;
  copy.events = [];
  project.maps[toId] = copy;
  return copy;
}

function light(id: string, at: Cell, radius: number, color: string, intensity = 0.9): LightSource {
  return { id, at: { x: at.x, y: at.y }, radius, color, intensity };
}

export function buildFirstLoveMaps(project: Project, exec: ExecTool): FirstLoveAnchors {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();

  // ── 실내 (jp_city 손 도트) ──
  buildRoom(exec, FL_MAP.office, "스튜디오 늘봄 · 7층 사무실", ROOMS.office);
  buildRoom(exec, FL_MAP.konbini, "회사 앞 편의점", ROOMS.konbini);
  buildRoom(exec, FL_MAP.rooftop, "늘봄 빌딩 옥상", ROOMS.rooftop);
  buildRoom(exec, FL_MAP.platformAm, "한결역 승강장 · 아침", ROOMS.platform);
  buildRoom(exec, FL_MAP.broadcast, "성하고 방송실 · 10년 전", ROOMS.broadcast);

  // ── 거리 (modern_city 구성기) ──
  exec("create_map", { id: FL_MAP.street, name: "늘봄 빌딩 앞 거리", width: 48, height: 36, tilesetId: "modern_city" });
  const composed = exec("compose_modern_city_street", { mapId: FL_MAP.street, seed: 5, shops: ["office", "conv", "cafe"], replace: true });
  const streetData = composed.data as {
    start: Cell;
    buildings: { kind: string; doors: Cell[]; access: Cell[] }[];
  };
  const street = project.maps[FL_MAP.street]!;
  const office = streetData.buildings.find((b) => b.kind === "office");
  const conv = streetData.buildings.find((b) => b.kind === "conv");
  if (!office || !conv) throw new Error("[first-love] 거리에 사무소·편의점 건물이 없다");
  // 지하철 입구: 구성기가 공원 옆에 둔다(요약 문장 「지하철 입구 (x,y)」). 데이터에 없으면 공원 오른쪽 아래.
  const subwayMatch = /지하철 입구 \((\d+),(\d+)\)/.exec(String((composed as { summary?: string }).summary ?? ""));
  const subway: Cell = subwayMatch ? { x: Number(subwayMatch[1]), y: Number(subwayMatch[2]) } : { x: 17, y: 8 };

  const officeRoom = project.maps[FL_MAP.office]!;
  const konbiniRoom = project.maps[FL_MAP.konbini]!;
  const roofRoom = project.maps[FL_MAP.rooftop]!;
  const platform = project.maps[FL_MAP.platformAm]!;
  const broadcast = project.maps[FL_MAP.broadcast]!;

  // 사무층 좌표(예제 office-floor 평면 기준): 위 큰 방 = 자리, 아래 왼쪽 = 회의실, 가운데 = 탕비실, 계단실, 엘리베이터 홀.
  const anchors: FirstLoveAnchors = {
    platform: {
      arrive: nearestFree(project, platform, { x: 8, y: 7 }),
      exit: nearestFree(project, platform, bottomGap(platform, project), 2),
      jihu: nearestFree(project, platform, { x: 12, y: 6 }),
      heroMeet: nearestFree(project, platform, { x: 10, y: 6 }),
    },
    street: {
      officeDoor: office.doors[0]!, officeOut: office.access[0]!,
      konbiniDoor: conv.doors[1] ?? conv.doors[0]!, konbiniOut: conv.access[1] ?? conv.access[0]!,
      subway, subwayOut: nearestFree(project, street, { x: subway.x + 1, y: subway.y + 3 }),
      arrive: nearestFree(project, street, { x: subway.x + 1, y: subway.y + 3 }),
    },
    office: {
      elevator: { x: 18, y: 14 }, elevatorOut: nearestFree(project, officeRoom, { x: 19, y: 15 }),
      stairs: { x: 14, y: 15 }, stairsOut: nearestFree(project, officeRoom, { x: 14, y: 13 }),
      heroDesk: nearestFree(project, officeRoom, { x: 9, y: 8 }),
      jihuDesk: nearestFree(project, officeRoom, { x: 10, y: 4 }),
      leadDesk: nearestFree(project, officeRoom, { x: 20, y: 8 }),
      pantry: nearestFree(project, officeRoom, { x: 10, y: 15 }),
      meeting: nearestFree(project, officeRoom, { x: 4, y: 15 }),
      meetingSeat: nearestFree(project, officeRoom, { x: 3, y: 14 }),
      whiteboard: nearestFree(project, officeRoom, { x: 21, y: 9 }),
    },
    rooftop: {
      door: { x: 6, y: 4 }, doorOut: nearestFree(project, roofRoom, { x: 6, y: 5 }),
      rail: nearestFree(project, roofRoom, { x: 9, y: 7 }), bench: nearestFree(project, roofRoom, { x: 3, y: 6 }),
    },
    konbini: {
      door: bottomGap(konbiniRoom, project), doorOut: nearestFree(project, konbiniRoom, { x: 6, y: 9 }),
      cooler: nearestFree(project, konbiniRoom, { x: 3, y: 4 }), counter: nearestFree(project, konbiniRoom, { x: 9, y: 8 }),
    },
    broadcast: {
      start: nearestFree(project, broadcast, { x: 6, y: 11 }),
      mailbox: nearestFree(project, broadcast, { x: 7, y: 10 }),
      booth: nearestFree(project, broadcast, { x: 6, y: 6 }),
    },
  };

  // ── 낮·밤 복사 ──
  const streetPm = cloneMap(project, FL_MAP.street, FL_MAP.streetPm, "늘봄 빌딩 앞 거리 · 밤");
  const officePm = cloneMap(project, FL_MAP.office, FL_MAP.officePm, "스튜디오 늘봄 · 야근");
  cloneMap(project, FL_MAP.office, FL_MAP.officeFri, "스튜디오 늘봄 · 금요일");
  const platformPm = cloneMap(project, FL_MAP.platformAm, FL_MAP.platformPm, "한결역 승강장 · 막차");

  // 밤 거리: 푸른 어둠 + 가로등·간판 빛. 가로등 칸은 거리 맵의 램프 소품 자리를 모르면 문 앞을 밝힌다.
  const lamps: LightSource[] = [];
  for (const [i, b] of streetData.buildings.entries()) {
    const d = b.access[0];
    if (d) lamps.push(light(`fl_shop_${i}`, d, 3, b.kind === "conv" ? "#e8fff4" : "#ffd9a0", 0.8));
  }
  lamps.push(light("fl_subway", anchors.street.subway, 3, "#cfe4ff", 0.8));
  streetPm.defaultLighting = { ambient: 0.62, color: "#0e1630", sources: lamps };
  officePm.defaultLighting = {
    ambient: 0.5, color: "#1a1830",
    sources: [light("fl_desk_hero", anchors.office.heroDesk, 3, "#ffe6b8"), light("fl_desk_jihu", anchors.office.jihuDesk, 3, "#ffe6b8"), light("fl_pantry", anchors.office.pantry, 3, "#fff2d0")],
  };
  platformPm.defaultLighting = {
    ambient: 0.48, color: "#121a36",
    sources: [light("fl_plat_a", { x: 4, y: 6 }, 4, "#e8f0ff", 0.7), light("fl_plat_b", { x: 13, y: 6 }, 4, "#e8f0ff", 0.7)],
  };
  roofRoom.defaultLighting = { ambient: 0.06, color: "#ffd9a8", sources: [] };
  roofRoom.atmosphereEffects = normalizeAtmosphereEffects([{ kind: "sunrays", amount: 0.5, speed: 0.4, size: 1, opacity: 0.5 }]);

  return anchors;
}
