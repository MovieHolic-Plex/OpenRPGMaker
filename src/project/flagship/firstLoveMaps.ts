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
  readonly platform: { readonly arrive: Cell; readonly exit: Cell; readonly exitOut: Cell; readonly jihu: Cell; readonly heroMeet: Cell };
  /** 거리: 회사 문 · 편의점 문 · 지하철 입구, 각 문 앞에서 다시 나오는 칸. */
  readonly street: {
    readonly officeDoor: Cell; readonly officeOut: Cell;
    readonly konbiniDoor: Cell; readonly konbiniOut: Cell;
    readonly subway: Cell; readonly subwayOut: Cell;
    readonly arrive: Cell;
  };
  /** 사무층: 엘리베이터(거리로) · 계단(옥상으로) · 서하 자리 · 지후 자리 · 팀장 자리 · 탕비실 · 회의실. */
  readonly office: {
    readonly elevator: Cell; readonly elevatorOut: Cell; readonly npcExit: Cell;
    readonly stairs: Cell; readonly stairsOut: Cell;
    /** 엘리베이터 앞 첫 만남 자리(팀장·지후) — 트인 바닥. */
    readonly meetLead: Cell; readonly meetJihu: Cell;
    readonly heroDesk: Cell; readonly jihuDesk: Cell; readonly leadDesk: Cell;
    readonly pantry: Cell; readonly meeting: Cell; readonly meetingSeat: Cell; readonly whiteboard: Cell;
    /** 회의 탁자 둘레의 빈 바닥 다섯 칸(서하·고객·팀장·지후·민호). */
    readonly meetSeats: readonly Cell[];
  };
  readonly rooftop: { readonly door: Cell; readonly doorOut: Cell; readonly rail: Cell; readonly railHero: Cell; readonly bench: Cell };
  readonly konbini: { readonly door: Cell; readonly doorOut: Cell; readonly npcExit: Cell; readonly cooler: Cell; readonly counter: Cell };
  readonly broadcast: { readonly start: Cell; readonly mailbox: Cell; readonly booth: Cell };
}

type RoomSpec = {
  name: string; plan: string[]; floor: string; wall: string; zones?: unknown[]; objects?: unknown[]; tables?: unknown[]; goods?: unknown[];
  rooms?: unknown[]; narrow?: unknown[]; exitWidth?: number; start: [number, number];
  /** 옥상: 난간 너머로 보이는 도시(칸 번호 줄 — 쉼표로 이은 숫자 줄들). */
  view?: { w: number; h: number; lower: string[]; upper: string[]; upper2: string[] };
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
 * 옥상 난간 너머의 도시 — 맵 위쪽 줄(0..view.h-1)을 jp_city 거리 구성기가 짠 운하 거리(건물·보도·옹벽·운하·다리)의 한 토막으로 덮는다.
 * 새 그림이 아니라 같은 칩셋의 기존 칸 번호이고, 칸마다 걷기 막힘은 난간 줄(y = view.h)이 막는다(데모 전용 후처리).
 */
function paintRoofView(map: GameMap, view: NonNullable<RoomSpec["view"]>): void {
  const W = map.width;
  const parse = (rows: string[]): number[][] => rows.map((r) => r.split(",").map(Number));
  const lower = parse(view.lower), upper = parse(view.upper), upper2 = parse(view.upper2);
  for (let y = 0; y < view.h; y++) {
    for (let x = 0; x < view.w && x < W; x++) {
      const i = y * W + x;
      map.lowerTiles[i] = lower[y]![x]!;
      map.upperTiles[i] = upper[y]![x]!;
      if (map.lowerOverlayTiles) map.lowerOverlayTiles[i] = -1;
      if (map.upperOverlayTiles) map.upperOverlayTiles[i] = upper2[y]![x]!;
      if (map.shadowBits) map.shadowBits[i] = 0;
    }
  }
}

/**
 * 맵 폭이 화면(30칸)보다 좁으면 카메라 둘레가 검다(옥상 24칸 = 화면 20% 검정, 전체 VQA 축 1). 왼쪽 left·오른쪽 right 칸을 덧대고
 * 모든 칸 배열·이벤트를 left 만큼 민다. 덧댄 칸은 pick(y, side) 가 고른 원래 열을 그대로 복사한다.
 */
function padMapX(map: GameMap, left: number, right: number, pick: (y: number, side: "left" | "right") => number): void {
  const W = map.width, H = map.height, NW = W + left + right;
  const bag = map as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(bag)) {
    if (!Array.isArray(value) || value.length !== W * H || !value.every((v) => v === null || typeof v === "number")) continue;
    const src = value as number[];
    const out = new Array<number>(NW * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < NW; x++) {
        const sx = x < left ? pick(y, "left") : x >= left + W ? pick(y, "right") : x - left;
        out[y * NW + x] = src[y * W + sx]!;
      }
    }
    bag[key] = out;
  }
  map.width = NW;
  for (const e of map.events) e.x += left;
}

/** 옥상 한 판 = 위 18줄 도시 풍경 + 아래 옥상(24×12). 난간 줄의 y. */
const ROOF_FENCE_Y = 18;
const ROOF_PAD = 3;
// 사무층(34x20)·편의점·방송실(30x17)은 원래 방을 더 큰 평면 가운데에 놓았다 — 카메라가 맵 밖(검정)을 비추지 않게.
export function buildFirstLoveMaps(project: Project, exec: ExecTool): FirstLoveAnchors {
  project.tilesets[JP_CITY_ID] = createJpCityTileset();

  // ── 실내 (jp_city 손 도트) ──
  buildRoom(exec, FL_MAP.office, "스튜디오 늘봄 · 7층 사무실", ROOMS.office);
  buildRoom(exec, FL_MAP.konbini, "회사 앞 편의점", ROOMS.konbini);
  buildRoom(exec, FL_MAP.rooftop, "늘봄 빌딩 옥상", ROOMS.rooftop);
  // 도구가 맵 이름에서 「승강장」 같은 낱말을 보면 평면을 버리고 무작위 씨앗의 역 구성으로 바꾼다 — 짓는 동안은 낱말 없는 이름으로 짓고 뒤에 이름을 붙인다.
  buildRoom(exec, FL_MAP.platformAm, "한결 플랫폼", ROOMS.platform);
  project.maps[FL_MAP.platformAm]!.name = "한결역 승강장 · 아침";
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
  const subwayHint: Cell = subwayMatch ? { x: Number(subwayMatch[1]), y: Number(subwayMatch[2]) } : { x: 17, y: 8 };
  // 요약의 좌표는 입구 덩어리(3칸 폭)의 왼쪽 기둥 칸이다 — 계단이 열린 칸은 아래 줄 가운데(타일 7621, 지붕 처마 3칸 아래)다.
  // 왼쪽 기둥 칸에 문을 두면 계단 그림이 아닌 벽 모서리에 부딪힌다.
  const SUBWAY_STAIR_TILE = 7621;
  const stairIdx = (street.upperTiles ?? []).findIndex((t, i) => t === SUBWAY_STAIR_TILE && Math.abs((i % street.width) - subwayHint.x) <= 2);
  const subway: Cell = stairIdx >= 0 ? { x: stairIdx % street.width, y: Math.floor(stairIdx / street.width) } : { x: subwayHint.x + 1, y: subwayHint.y };
  // 지하철 입구 덩어리는 막혀 있고 계단이 아래로 열린다 — 덩어리 바로 아래 첫 통행 칸이 발판.
  let subwayStepY = subway.y;
  while (subwayStepY < street.height - 1 && !isPassable(project, street, subway.x, subwayStepY)) subwayStepY += 1;
  const subwayStep: Cell = { x: subway.x, y: subwayStepY };

  const officeRoom = project.maps[FL_MAP.office]!;
  const konbiniRoom = project.maps[FL_MAP.konbini]!;
  const roofRoom = project.maps[FL_MAP.rooftop]!;
  const platform = project.maps[FL_MAP.platformAm]!;
  if (ROOMS.rooftop.view) paintRoofView(roofRoom, ROOMS.rooftop.view);
  // 옥상(24칸)을 화면 폭 30칸으로: 도시 풍경 줄은 빈 하늘·길 열(21)을, 옥상 줄은 바깥 벽 열을 복사한다. 아래 옥상 좌표는 모두 +ROOF_PAD.
  padMapX(roofRoom, ROOF_PAD, ROOF_PAD, (y, side) => (y < ROOF_FENCE_Y ? 21 : side === "left" ? 0 : 23));
  const broadcast = project.maps[FL_MAP.broadcast]!;

  // 사무층 좌표(예제 office-floor 평면 기준): 위 큰 방 = 자리, 아래 왼쪽 = 회의실, 가운데 = 탕비실, 계단실, 엘리베이터 홀.
  const anchors: FirstLoveAnchors = {
    platform: {
      // 내린 자리: 아침 승강장 가운데쯤 — 한 화면에 노란 점자 끝선과 선로가 같이 보인다(끝선은 아래 두 줄).
      arrive: nearestFree(project, platform, { x: 8, y: 8 }),
      // 나가는 계단은 승강장 동쪽 끝 북쪽 벽에 박혀 있다(나무 계단 2칸 폭 그림, 그림 칸을 밟을 수 있다) — 왼 칸이 계단 칸, 바로 아래가 나오는 칸.
      exit: { x: 28, y: 3 }, exitOut: { x: 28, y: 4 },
      jihu: nearestFree(project, platform, { x: 12, y: 8 }),
      heroMeet: nearestFree(project, platform, { x: 10, y: 8 }),
    },
    street: {
      // 문 칸 = 건물 정면의 문 그림 칸(막혀 있다 — 부딪히면 이동이 발동한다), 나오는 칸 = 그 바로 아래(바깥) 접근칸.
      officeDoor: office.doors[0]!, officeOut: office.access[0]!,
      konbiniDoor: conv.doors[1] ?? conv.doors[0]!, konbiniOut: conv.access[1] ?? conv.access[0]!,
      subway: { x: subwayStep.x, y: subwayStep.y - 1 }, subwayOut: subwayStep,
      // 내린 사람은 계단 바로 아래 칸(나오는 칸)에 선다 — 문 그림에 붙어 아래를 본다.
      arrive: subwayStep,
    },
    office: {
      // 엘리베이터·계단 그림은 북쪽 벽면에 박혀 있고 그림 칸 자체를 밟을 수 있다 — 문 칸 = 그림 칸, 나오는 칸 = 바로 아래(안쪽) 칸.
      elevator: { x: 16, y: 3 }, elevatorOut: { x: 16, y: 4 }, npcExit: { x: 21, y: 3 },
      stairs: { x: 10, y: 3 }, stairsOut: { x: 10, y: 4 },
      // 엘리베이터 앞 첫 만남: 서하는 elevatorOut, 팀장은 두 칸 아래(트인 사무실 쪽), 지후는 그 옆 — 전부 석재 로비 바닥 위, 벽·엘리베이터 그림에 안 가린다.
      meetLead: { x: 16, y: 6 }, meetJihu: { x: 17, y: 6 },
      // 한 팀 책상 무리(3열 6자리) 옆에 서하·지후, 팀장 책상은 그 동쪽.
      heroDesk: nearestFree(project, officeRoom, { x: 13, y: 9 }),
      jihuDesk: nearestFree(project, officeRoom, { x: 17, y: 9 }),
      leadDesk: nearestFree(project, officeRoom, { x: 20, y: 10 }),
      pantry: nearestFree(project, officeRoom, { x: 6, y: 4 }),
      // 회의실: 유리문(10,12) 바로 안쪽이 meeting, 탁자(4×2) 둘레의 빈 바닥 다섯 칸이 meetSeats(의자·탁자 위가 아니다).
      meeting: nearestFree(project, officeRoom, { x: 10, y: 14 }),
      // 발표 배치(VQA r4 M3): 발표자 둘은 탁자 동쪽 끝에 나란히 서서 서쪽(탁자)을 본다 — 한 열로 쌓이지 않는다.
      // 본부장은 유리문 가까운 북쪽 의자(6,16), 민호는 남쪽 의자(5,19)에 앉고, 팀장은 서쪽 끝(3,17)에 선다.
      meetingSeat: { x: 8, y: 17 },
      meetSeats: [{ x: 8, y: 17 }, { x: 9, y: 17 }, { x: 4, y: 16 }, { x: 3, y: 17 }, { x: 7, y: 16 }],
      whiteboard: nearestFree(project, officeRoom, { x: 23, y: 10 }),
    },
    rooftop: {
      // 탑옥(계단탑) 철문 그림은 북쪽 벽면에 박혀 있다(두 칸 높이, 막힘 — 부딪히면 이동) — door = 문 그림 맨 아랫칸, doorOut = 그 바로 아래(안쪽) 바닥 칸.
      door: { x: ROOF_PAD + 3, y: ROOF_FENCE_Y + 3 }, doorOut: nearestFree(project, roofRoom, { x: ROOF_PAD + 3, y: ROOF_FENCE_Y + 4 }),
      // 난간(철망 펜스) 바로 아래 줄 가운데 — 북쪽을 보고 선다. 옆 칸은 서하 자리.
      rail: nearestFree(project, roofRoom, { x: ROOF_PAD + 14, y: ROOF_FENCE_Y + 1 }), railHero: nearestFree(project, roofRoom, { x: ROOF_PAD + 13, y: ROOF_FENCE_Y + 1 }),
      bench: nearestFree(project, roofRoom, { x: ROOF_PAD + 11, y: ROOF_FENCE_Y + 8 }),
    },
    konbini: {
      // 자동문 그림 두 칸(12,14)(13,14)이 남쪽 벽 틈에 박혀 있고 밟을 수 있다 — 왼 칸이 문 칸, 오른 칸이 점원·손님이 사라지는 문 칸, 나오는 칸 = 바로 위(안쪽) 칸.
      door: { x: 12, y: 14 }, doorOut: { x: 12, y: 13 }, npcExit: { x: 13, y: 14 },
      // 음료 쿨러(북쪽 벽, 두 줄 높이) 바로 앞 통로 칸 — 양옆이 비어 있다. 계산대는 점원 쪽(계산대 줄 뒤).
      cooler: nearestFree(project, konbiniRoom, { x: 7, y: 7 }), counter: nearestFree(project, konbiniRoom, { x: 17, y: 8 }),
    },
    broadcast: {
      // 방송실(왼쪽 위, 흡음벽) 문(11,9)에서 복도로 나오는 세로 한 줄(x=11)이 비어 있다 — 부스 칸에서 문을 지나 복도 아래까지 곧장 걸어 내려온다.
      start: nearestFree(project, broadcast, { x: 16, y: 13 }),
      mailbox: nearestFree(project, broadcast, { x: 13, y: 13 }),
      booth: nearestFree(project, broadcast, { x: 11, y: 5 }),
    },
  };

  // ── 낮·밤 복사 ──
  const streetPm = cloneMap(project, FL_MAP.street, FL_MAP.streetPm, "늘봄 빌딩 앞 거리 · 밤");
  const officePm = cloneMap(project, FL_MAP.office, FL_MAP.officePm, "스튜디오 늘봄 · 야근");
  cloneMap(project, FL_MAP.office, FL_MAP.officeFri, "스튜디오 늘봄 · 금요일");
  const platformPm = cloneMap(project, FL_MAP.platformAm, FL_MAP.platformPm, "한결역 승강장 · 막차");
  // 열차가 실제로 들어와 서고 떠난다(VQA r8: 「열차가 들어오고 있습니다」 안내만 있고 열차가 없다).
  // 탈것 도구는 1층 jp-subway-track(2줄) 선로를 찾는다 — 방 키트가 노란 끝선 바로 아래 그린 가까운 선로 두 줄(y 11·12)을
  // 같은 계열의 그 선로 칸으로 바꾼다. 열차가 승강장 끝에 붙어 서고, 대화창(y192~) 위로 몸이 보인다. 맨 아래 두 줄은 건너편 선로 그대로.
  const TRACK_TOP = 8597, TRACK_BOTTOM = 8598, NEAR_TRACK_Y = 11;
  for (const id of [FL_MAP.platformAm, FL_MAP.platformPm]) {
    const m = project.maps[id]!;
    for (let x = 0; x < m.width; x++) {
      m.lowerTiles[NEAR_TRACK_Y * m.width + x] = TRACK_TOP;
      m.lowerTiles[(NEAR_TRACK_Y + 1) * m.width + x] = TRACK_BOTTOM;
      if (m.upperTiles) { m.upperTiles[NEAR_TRACK_Y * m.width + x] = -1; m.upperTiles[(NEAR_TRACK_Y + 1) * m.width + x] = -1; }
    }
  }
  for (const id of [FL_MAP.platformAm, FL_MAP.platformPm]) {
    try {
      exec("set_map_transit", { mapId: id, auto: { subway: { vehicle: "jp-subway", name: "한결선", stopName: "한결역", headwaySec: 50, waitSec: 10 } } });
    } catch (error) {
      console.warn(`[first-love] ${id} 열차를 깔지 못했다: ${(error as Error).message}`);
    }
  }

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
  // 편의점 문 앞 보도로 새어 나오는 따뜻한 가게 불빛(밤에 들르는 곳이 한눈에 읽히게).
  lamps.push(light("fl_kb_spill", anchors.street.konbiniOut, 5, "#fff0c4", 1), light("fl_kb_spill2", { x: anchors.street.konbiniOut.x, y: anchors.street.konbiniOut.y + 2 }, 4, "#ffe8b0", 0.7));
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
      light("fl_led_a", { x: 6, y: 3 }, 4, "#bfe0ff", 0.8), light("fl_led_b", { x: 20, y: 3 }, 4, "#bfe0ff", 0.8),
      light("fl_vend_a", { x: 3, y: 4 }, 3, "#d9f4ff", 0.85), light("fl_vend_b", { x: 4, y: 4 }, 3, "#d9f4ff", 0.85),
      light("fl_kiosk", { x: 16, y: 4 }, 4, "#fff0c8", 0.8),
      light("fl_sign_a", { x: 10, y: 8 }, 4, "#fff0c8", 0.8), light("fl_sign_b", { x: 24, y: 8 }, 4, "#fff0c8", 0.8),
      light("fl_plat_a", { x: 6, y: 8 }, 5, "#e8f0ff", 0.6), light("fl_plat_b", { x: 16, y: 8 }, 5, "#e8f0ff", 0.6), light("fl_plat_c", { x: 26, y: 8 }, 5, "#e8f0ff", 0.6),
    ],
  };
  // 편의점은 밤에만 들른다 — 바깥 광장은 어두운 밤, 가게 안은 형광등이 켜진 밝은 바닥. 거리의 어두운 조명을 물려받지 않게 따로 건다.
  konbiniRoom.defaultLighting = {
    ambient: 0.5, color: "#0f1a3c",
    sources: [
      light("fl_kb_a", { x: 8, y: 7 }, 7, "#f4fbff", 1), light("fl_kb_b", { x: 16, y: 7 }, 7, "#f4fbff", 1),
      light("fl_kb_c", { x: 8, y: 11 }, 7, "#f4fbff", 1), light("fl_kb_d", { x: 16, y: 11 }, 7, "#f4fbff", 1),
      light("fl_kb_door", { x: 12, y: 13 }, 5, "#f4fbff", 0.9),
      // 계산대 쪽은 따뜻한 온장고·커피 불빛.
      light("fl_kb_counter", anchors.konbini.counter, 4, "#ffe2a8", 0.7),
      // 문 앞 보도에 새어 나오는 가게 불빛(희미하게).
      light("fl_kb_glow", { x: 12, y: 16 }, 4, "#dfeeff", 0.45),
    ],
  };
  roofRoom.defaultLighting = { ambient: 0.06, color: "#ffd9a8", sources: [] };
  roofRoom.atmosphereEffects = normalizeAtmosphereEffects([{ kind: "sunrays", amount: 0.5, speed: 0.4, size: 1, opacity: 0.5 }]);

  return anchors;
}
