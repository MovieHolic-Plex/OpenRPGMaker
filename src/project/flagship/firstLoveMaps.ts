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

/**
 * 아래쪽 출입구 틈의 가운데 칸 — 맨 아래 줄부터 위로 올라가며 걸을 수 있는 칸이 있는 첫 줄을 쓴다.
 * 승강장 평면은 맨 아래 줄이 벽이고 그 위 줄(역사 앞 뒷길)이 열려 있다. #3182 전에는 맵 이름의 「승강장」이 평면을
 * 표준 지하철역 청사진으로 바꿔 맨 아래 줄에 틈이 있었고, 이제 준 평면대로 지어 맨 아래 줄만 보던 검사가 데모를 멈췄다.
 */
function bottomGap(map: GameMap, project: Project): Cell {
  for (let y = map.height - 1; y >= Math.floor(map.height / 2); y--) {
    const xs: number[] = [];
    for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) xs.push(x);
    if (xs.length > 0) return { x: xs[Math.floor((xs.length - 1) / 2)]!, y };
  }
  throw new Error(`[first-love] ${map.id}: 아래 출입구 틈이 없다`);
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

/**
 * 옥상 좌상단 계단탑 윗면 — 평면의 '#' 덩이는 빌더가 검은 허공으로 두므로, 그 윗면(x0..5, y0..2)을
 * 옥상 바닥과 같은 콘크리트 판 + 난간 모서리 띠로 덮는다. 전부 막힌 칸(문 위 벽·좌우 가장자리)에 둘러싸여 못 걷는 칸이라
 * 통행·앵커에는 영향이 없다(데모 전용 후처리).
 */
/** 옥상 한 판 = 이웃 건물 낮은 옥상(둘레) + 우리 옥상 블록(20×14). 블록의 왼쪽 위 좌표. */
const ROOF_OX = 6, ROOF_OY = 4;
// 사무층(34x20)·편의점·방송실(30x17)은 원래 방을 더 큰 평면 가운데에 놓았다 — 카메라가 맵 밖(검정)을 비추지 않게.
const OFC_OX = 5;
const KB_OX = 8, KB_OY = 2, KB_W = 14, KB_H = 12;
const BC_OX = 8, BC_OY = 2;
function paintStairwellRoof(map: GameMap): void {
  const W = map.width;
  const CAP_TOP = 9347, EDGE_LEFT = 9338;
  for (let y = 0; y <= 2; y++) {
    for (let x = 0; x <= 5; x++) {
      const i = (y + ROOF_OY) * W + (x + ROOF_OX);
      if (y === 0) map.lowerTiles[i] = CAP_TOP;
      else if (x === 0) map.lowerTiles[i] = EDGE_LEFT;
      else map.lowerTiles[i] = map.lowerTiles[(y + 4 + ROOF_OY) * W + (x + 7 + ROOF_OX)]!;
    }
  }
}

/**
 * 역 운임표(st-fare-map, 3×2) — 글자 없이 흰 판에 점만 있어 「0000000」 플레이스홀더처럼 읽힌다.
 * 승강장 프리셋이 깔아 주는 두 장을 걷어 내고, 승강장 쪽은 벽시계 한 칸으로 바꾼다(데모 전용 후처리).
 */
function removeFareMapBoards(map: GameMap): void {
  const W = map.width, H = map.height;
  const CLOCK = 9409;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const id = map.upperTiles[i]!;
      if (id < 11457 || id > 11462) continue;
      map.upperTiles[i] = id === 11458 && y >= H / 2 ? CLOCK : -1;
    }
  }
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
  // 퇴근길 사무가 거리에 소방차·구급차·경찰차가 도는 것은 이야기와 맞지 않는다 — 민간 차량만 남긴다(데모 전용 후처리).
  const EMERGENCY_VEHICLES = new Set(["mc-veh-ambulance-a", "mc-veh-firetruck-b", "mc-veh-police-a"]);
  for (const route of street.transit?.routes ?? []) {
    const civil = route.vehicles.filter((v) => !EMERGENCY_VEHICLES.has(v));
    if (civil.length > 0) route.vehicles = civil;
  }
  const office = streetData.buildings.find((b) => b.kind === "office");
  const conv = streetData.buildings.find((b) => b.kind === "conv");
  if (!office || !conv) throw new Error("[first-love] 거리에 사무소·편의점 건물이 없다");
  // 지하철 입구: 구성기가 공원 옆에 둔다(요약 문장 「지하철 입구 (x,y)」). 데이터에 없으면 공원 오른쪽 아래.
  const subwayMatch = /지하철 입구 \((\d+),(\d+)\)/.exec(String((composed as { summary?: string }).summary ?? ""));
  const subway: Cell = subwayMatch ? { x: Number(subwayMatch[1]), y: Number(subwayMatch[2]) } : { x: 17, y: 8 };
  // 지하철 입구 덩어리는 막혀 있고 계단이 아래로 열린다 — 덩어리 바로 아래 첫 통행 칸이 발판.
  let subwayStepY = subway.y;
  while (subwayStepY < street.height - 1 && !isPassable(project, street, subway.x, subwayStepY)) subwayStepY += 1;
  const subwayStep: Cell = { x: subway.x, y: subwayStepY };
  const below = (c: Cell): Cell => nearestFree(project, street, { x: c.x, y: c.y + 1 });

  const officeRoom = project.maps[FL_MAP.office]!;
  const konbiniRoom = project.maps[FL_MAP.konbini]!;
  const roofRoom = project.maps[FL_MAP.rooftop]!;
  const platform = project.maps[FL_MAP.platformAm]!;
  paintStairwellRoof(roofRoom);
  removeFareMapBoards(platform);
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
      // 문 칸 자체는 막혀 있다(건물 정면) — 밟는 발판은 문 바로 아래 접근칸, 나오는 칸은 그 한 칸 아래.
      officeDoor: office.access[0]!, officeOut: below(office.access[0]!),
      konbiniDoor: conv.access[1] ?? conv.access[0]!, konbiniOut: below(conv.access[1] ?? conv.access[0]!),
      subway: subwayStep, subwayOut: below(subwayStep),
      arrive: below(subwayStep),
    },
    office: {
      elevator: { x: 18 + OFC_OX, y: 14 }, elevatorOut: nearestFree(project, officeRoom, { x: 19 + OFC_OX, y: 15 }),
      stairs: { x: 14 + OFC_OX, y: 15 }, stairsOut: nearestFree(project, officeRoom, { x: 14 + OFC_OX, y: 13 }),
      heroDesk: nearestFree(project, officeRoom, { x: 9 + OFC_OX, y: 8 }),
      jihuDesk: nearestFree(project, officeRoom, { x: 10 + OFC_OX, y: 4 }),
      leadDesk: nearestFree(project, officeRoom, { x: 20 + OFC_OX, y: 8 }),
      pantry: nearestFree(project, officeRoom, { x: 10 + OFC_OX, y: 15 }),
      meeting: nearestFree(project, officeRoom, { x: 5 + OFC_OX, y: 15 }),
      meetingSeat: nearestFree(project, officeRoom, { x: 3 + OFC_OX, y: 15 }),
      whiteboard: nearestFree(project, officeRoom, { x: 21 + OFC_OX, y: 9 }),
    },
    rooftop: {
      door: nearestFree(project, roofRoom, { x: 3 + ROOF_OX, y: 6 + ROOF_OY }), doorOut: nearestFree(project, roofRoom, { x: 3 + ROOF_OX, y: 7 + ROOF_OY }),
      rail: nearestFree(project, roofRoom, { x: 10 + ROOF_OX, y: 4 + ROOF_OY }), bench: nearestFree(project, roofRoom, { x: 6 + ROOF_OX, y: 10 + ROOF_OY }),
    },
    konbini: {
      door: { x: 6 + KB_OX, y: 11 + KB_OY }, doorOut: nearestFree(project, konbiniRoom, { x: 6 + KB_OX, y: 9 + KB_OY }),
      cooler: nearestFree(project, konbiniRoom, { x: 3 + KB_OX, y: 4 + KB_OY }), counter: nearestFree(project, konbiniRoom, { x: 9 + KB_OX, y: 8 + KB_OY }),
    },
    broadcast: {
      start: nearestFree(project, broadcast, { x: 6 + BC_OX, y: 11 + BC_OY }),
      mailbox: nearestFree(project, broadcast, { x: 7 + BC_OX, y: 10 + BC_OY }),
      booth: nearestFree(project, broadcast, { x: 6 + BC_OX, y: 6 + BC_OY }),
    },
  };

  // ── 낮·밤 복사 ──
  const streetPm = cloneMap(project, FL_MAP.street, FL_MAP.streetPm, "늘봄 빌딩 앞 거리 · 밤");
  const officePm = cloneMap(project, FL_MAP.office, FL_MAP.officePm, "스튜디오 늘봄 · 야근");
  cloneMap(project, FL_MAP.office, FL_MAP.officeFri, "스튜디오 늘봄 · 금요일");
  const platformPm = cloneMap(project, FL_MAP.platformAm, FL_MAP.platformPm, "한결역 승강장 · 막차");

  // 밤 거리: 푸른 어둠 + 실제 가로등(3칸 기둥의 머리 높이)·공원 가로등·간판 빛.
  // 좌표는 거리 맵(modern_city, 시드 5)에 찍힌 mc-prop-lamp-a 기둥 윗칸 + 1 이다.
  const lamps: LightSource[] = [];
  const streetLamps: Array<[number, number]> = [[21, 2], [1, 21], [14, 21], [41, 21], [21, 26], [21, 33], [6, 4], [13, 4]];
  for (const [i, [x, y]] of streetLamps.entries()) lamps.push(light(`fl_lamp_${i}`, { x, y }, 4, "#ffd98a", 0.95));
  for (const [i, b] of streetData.buildings.entries()) {
    const d = b.access[0];
    if (d) lamps.push(light(`fl_shop_${i}`, d, 3, b.kind === "conv" ? "#e8fff4" : "#ffd9a0", 0.8));
  }
  lamps.push(light("fl_subway", anchors.street.subway, 3, "#cfe4ff", 0.8));
  streetPm.defaultLighting = { ambient: 0.62, color: "#0e1630", sources: lamps };
  officePm.defaultLighting = {
    // 야근 밤: 너무 어두우면 인물이 안 읽힌다(VQA r3) — 어둠은 한 단계 줄이고 책상·탕비실·회의 자리 불을 넓힌다.
    ambient: 0.3, color: "#1c1a34",
    sources: [
      light("fl_desk_hero", anchors.office.heroDesk, 5, "#ffe6b8"), light("fl_desk_jihu", anchors.office.jihuDesk, 5, "#ffe6b8"),
      light("fl_pantry", anchors.office.pantry, 5, "#fff2d0"), light("fl_meeting", anchors.office.meetingSeat, 5, "#ffeecc", 0.8),
    ],
  };
  platformPm.defaultLighting = {
    ambient: 0.48, color: "#121a36",
    // 승강장에는 가로등이 없다 — 실제로 빛나는 것(발차 LED 판·자판기·매표기·벽시계·역명 간판)만 켠다.
    sources: [
      light("fl_led_a", { x: 7, y: 3 }, 4, "#bfe0ff", 0.8), light("fl_led_b", { x: 26, y: 3 }, 4, "#bfe0ff", 0.8),
      light("fl_led_c", { x: 2, y: 12 }, 4, "#bfe0ff", 0.8), light("fl_led_d", { x: 25, y: 12 }, 4, "#bfe0ff", 0.8),
      light("fl_vend_a", { x: 12, y: 4 }, 3, "#d9f4ff", 0.85), light("fl_vend_b", { x: 24, y: 4 }, 3, "#d9f4ff", 0.85),
      light("fl_ticket_a", { x: 1, y: 4 }, 3, "#c8ffe0", 0.7), light("fl_ticket_b", { x: 5, y: 4 }, 3, "#c8ffe0", 0.7),
      light("fl_sign_a", { x: 8, y: 14 }, 4, "#fff0c8", 0.8), light("fl_sign_b", { x: 24, y: 14 }, 4, "#fff0c8", 0.8),
      light("fl_plat_a", { x: 4, y: 12 }, 4, "#e8f0ff", 0.6), light("fl_plat_b", { x: 13, y: 12 }, 4, "#e8f0ff", 0.6), light("fl_plat_c", { x: 29, y: 12 }, 4, "#e8f0ff", 0.6),
    ],
  };
  // 편의점은 밤에도 형광등이 켜진 밝은 가게 — 거리의 어두운 조명을 물려받지 않게 따로 건다.
  {
    const w = KB_W, h = KB_H;
    konbiniRoom.defaultLighting = {
      ambient: 0.04, color: "#f0f6ff",
      sources: [
        light("fl_kb_a", { x: KB_OX + Math.round(w * 0.25), y: KB_OY + Math.round(h * 0.3) }, 6, "#f4fbff", 0.7),
        light("fl_kb_b", { x: KB_OX + Math.round(w * 0.7), y: KB_OY + Math.round(h * 0.3) }, 6, "#f4fbff", 0.7),
        light("fl_kb_c", { x: KB_OX + Math.round(w * 0.3), y: KB_OY + Math.round(h * 0.75) }, 6, "#f4fbff", 0.7),
        light("fl_kb_d", { x: KB_OX + Math.round(w * 0.7), y: KB_OY + Math.round(h * 0.75) }, 6, "#f4fbff", 0.7),
      ],
    };
  }
  roofRoom.defaultLighting = { ambient: 0.06, color: "#ffd9a8", sources: [] };
  roofRoom.atmosphereEffects = normalizeAtmosphereEffects([{ kind: "sunrays", amount: 0.5, speed: 0.4, size: 1, opacity: 0.5 }]);

  return anchors;
}
