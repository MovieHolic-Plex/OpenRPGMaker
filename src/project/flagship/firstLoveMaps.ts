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
import { clearMapCellForBackground } from "@/project/mapBackgroundVisibility";
import { mapBackgroundFromPanoramaSet } from "@/assets/oprnPanoramas";

export type ExecTool = (name: string, args: Record<string, unknown>) => { data?: unknown };

/** 금요일 밤 승강장: 켜면 막차가 들어온다 / 켜면 선 막차가 문을 닫고 떠난다. */
export const FL_TRAIN_CALL = "sw_fl_train_call";
export const FL_TRAIN_GO = "sw_fl_train_go";
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
/**
 * 지나갈 수는 있지만 위층(★) 그림이 늘 인물 위에 그려지는 칸(의자 등받이·수관·차양) — 거기 세운 인물은 그림에 덮인다.
 * 밟고 오르는 계단 칸은 렌더러가 인물 아래에 그리므로 뺀다(characterDepth isWalkableStairTile 과 같은 규칙).
 * 수요일 밤 지후가 의자 칸(★)에 서서 의자가 몸 위로 그려졌다(VQA r22).
 */
export function drawnOverActor(project: Project, map: GameMap, x: number, y: number): boolean {
  const tileset = project.tilesets?.[map.tilesetId];
  const tile = (map as { upperTiles?: readonly number[] }).upperTiles?.[y * map.width + x];
  if (!tileset || tile === undefined || tile < 0 || tileset.priority?.[tile] !== "upper") return false;
  const tags = tileset.tileMeta?.[tile]?.tags ?? [];
  return !tags.some((tag) => /stair/i.test(tag) || tag.includes("계단") || tag.includes("사다리") || /^foot-dy:/.test(tag));
}

export function nearestFree(project: Project, map: GameMap, origin: Cell, maxR = 8, avoid: readonly Cell[] = [], allowCovered = false): Cell {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = origin.x + dx, y = origin.y + dy;
        if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
        if (!isPassable(project, map, x, y)) continue;
        if (!allowCovered && drawnOverActor(project, map, x, y)) continue;
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

/** 맵 아래에 bottom 줄을 덧댄다(덧댄 줄 = pick(y) 가 고른 원래 줄의 복사). 좌표는 그대로다. */
function padMapBottom(map: GameMap, bottom: number, pick: (y: number) => number): void {
  const W = map.width, H = map.height, NH = H + bottom;
  const bag = map as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(bag)) {
    if (!Array.isArray(value) || value.length !== W * H || !value.every((v) => v === null || typeof v === "number")) continue;
    const src = value as number[];
    const out = src.slice();
    for (let y = H; y < NH; y++) {
      const sy = pick(y);
      for (let x = 0; x < W; x++) out.push(src[sy * W + x]!);
    }
    bag[key] = out;
  }
  map.height = NH;
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
  // 승강장은 선로 아래가 바로 바깥이다 — 화면(17칸)보다 낮으면 아래가 검은 둘레로 남는다. 어두운 천장 줄을 덧대 화면 높이를 채운다.
  {
    const pl = project.maps[FL_MAP.platformAm]!, h0 = pl.height, pad = Math.max(0, 17 - h0);
    if (pad > 0) {
      padMapBottom(pl, pad, () => h0 - 1);
      for (let y = h0; y < h0 + pad; y++) for (let x = 0; x < pl.width; x++) clearMapCellForBackground(pl, y * pl.width + x);
    }
  }
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
  // 편집기 예제 가게는 바깥(옆 벽돌 띠·앞 보도 두 줄)까지 그려져 있다 — 실내 장면에서는 «상자 속 상자»로 읽혔다(VQA r25).
  // 앞면(문·유리 두 줄)까지만 남기고 옆 세 열과 보도 세 줄(화분 줄 포함)은 비운다(실내 둘레는 어둠). 비운 칸은 아무도 밟지 않는다(문은 앞면 칸).
  for (let y = 0; y < konbiniRoom.height; y++) for (let x = 0; x < konbiniRoom.width; x++) {
    if (x <= 2 || x >= konbiniRoom.width - 3 || y >= konbiniRoom.height - 3) clearMapCellForBackground(konbiniRoom, y * konbiniRoom.width + x);
  }
  // 옥상(24칸)을 화면 폭 30칸으로: 옥상 줄은 바깥 벽 열을 복사한다. 아래 옥상 좌표는 모두 +ROOF_PAD.
  padMapX(roofRoom, ROOF_PAD, ROOF_PAD, (_y, side) => (side === "left" ? 0 : 23));
  // 난간 너머는 하늘이다 — 같은 크기의 길·벤치·우체통(땅에서 본 거리)을 그리면 옥상이 1층 광장으로 읽힌다(VQA r10).
  // 난간 위 줄을 모두 비우고 맑은 낮 하늘 배경(빈 칸에도 보이기)을 깐다.
  for (let i = 0; i < ROOF_FENCE_Y * roofRoom.width; i++) clearMapCellForBackground(roofRoom, i);
  // 덧댄 옆 열도 하늘로 — 검은 난간 벽을 4칸씩 늘리면 검은 띠로 읽힌다(VQA r10). 맨 아래 두 줄(건물 앞면)만 이어 붙인 그대로 둔다.
  for (let y = ROOF_FENCE_Y; y < roofRoom.height - 2; y++) {
    for (let k = 0; k < ROOF_PAD; k++) {
      clearMapCellForBackground(roofRoom, y * roofRoom.width + k);
      clearMapCellForBackground(roofRoom, y * roofRoom.width + roofRoom.width - 1 - k);
    }
  }
  // 둘레 빌딩 숲(VQA r22: 하늘만 두르면 옥상이 공중에 뜬 상자로 읽혔다) — 옆 빈 칸과 난간 위로 이웃 빌딩이 보인다.
  roofRoom.background = mapBackgroundFromPanoramaSet("oprn-sky-day-city");
  // 옥상 양옆의 검은 벽 열(원래 맵 바깥벽)과 덧댄 하늘 열이 «하늘에 뜬 액자»로 읽혔다(VQA r25·r26). 옥상 바닥과 철망 난간을
  // 화면 양 끝까지 이어 «화면 밖으로 이어지는 넓은 옥상»으로 만든다 — 같은 줄의 빈 바닥 칸·난간 칸 그림을 그대로 복사한다.
  {
    const W = roofRoom.width, H = roofRoom.height;
    const copyCell = (from: number, to: number): void => {
      roofRoom.lowerTiles[to] = roofRoom.lowerTiles[from]!;
      roofRoom.upperTiles[to] = roofRoom.upperTiles[from]!;
      if (roofRoom.lowerOverlayTiles) roofRoom.lowerOverlayTiles[to] = roofRoom.lowerOverlayTiles[from]!;
      if (roofRoom.upperOverlayTiles) roofRoom.upperOverlayTiles[to] = roofRoom.upperOverlayTiles[from]!;
      if (roofRoom.shadowBits) roofRoom.shadowBits[to] = 0;
    };
    const edgeCols = [...Array.from({ length: ROOF_PAD + 1 }, (_, k) => k), ...Array.from({ length: ROOF_PAD + 1 }, (_, k) => W - 1 - k)];
    for (let y = ROOF_FENCE_Y; y < H - 2; y++) {
      // 같은 줄 가운데 쪽에서 위층 그림이 없는 칸(난간 줄은 난간 칸)을 고른다.
      let src = -1;
      for (let x = ROOF_PAD + 7; x < W - ROOF_PAD - 1 && src < 0; x++) {
        const i = y * W + x;
        if (y === ROOF_FENCE_Y ? roofRoom.upperTiles[i]! >= 0 || !isPassable(project, roofRoom, x, y) : roofRoom.upperTiles[i]! < 0 && isPassable(project, roofRoom, x, y)) src = i;
      }
      if (src < 0) continue;
      for (const x of edgeCols) copyCell(src, y * W + x);
    }
  }
  const broadcast = project.maps[FL_MAP.broadcast]!;

  // 사무층 좌표(예제 office-floor 평면 기준): 위 큰 방 = 자리, 아래 왼쪽 = 회의실, 가운데 = 탕비실, 계단실, 엘리베이터 홀.
  const anchors: FirstLoveAnchors = {
    platform: {
      // 내린 자리: 아침 승강장 가운데쯤 — 한 화면에 노란 점자 끝선과 선로가 같이 보인다(끝선은 아래 두 줄).
      arrive: nearestFree(project, platform, { x: 14, y: 8 }),
      // 나가는 계단은 승강장 동쪽 끝 북쪽 벽에 박혀 있다(나무 계단 2칸 폭 그림, 그림 칸을 밟을 수 있다) — 왼 칸이 계단 칸, 바로 아래가 나오는 칸.
      // 사용자 r2: 「승강장이 작고 답답하다」 — 50칸 길이 승강장(양 끝 벽까지 보인다)·선로 두 줄. 계단은 동쪽 끝.
      exit: { x: 46, y: 3 }, exitOut: { x: 46, y: 4 },
      // 막차 장면의 지후는 계단(동쪽 끝) 가까이, 서는 열차의 머리 칸 문 앞 탑승 표시(x 37) 바로 위.
      // 옛 자리(x≈25)는 계단에서 23칸이라 서하가 텅 빈 승강장을 한참 걸었고(VQA r25), 문 가운데와도 반 칸 어긋났다.
      // 열차 몸은 x 10~39(정류장 머리 x=39, 길이 30), 문 가운데는 그림 기준 x≈11.8·15.0·18.1·…·38.1.
      jihu: nearestFree(project, platform, { x: 37, y: 8 }),
      heroMeet: nearestFree(project, platform, { x: 36, y: 8 }),
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
      // 계단(옥상으로)은 엘리베이터 홀 옆 계단실 자리(사용자 r2: 사무실 한가운데 벽의 계단이 어색하다) — 바로 아래 칸이 바닥.
      stairs: { x: 12, y: 3 }, stairsOut: { x: 12, y: 4 },
      // 엘리베이터 앞 첫 만남: 서하는 elevatorOut, 팀장은 두 칸 아래(트인 사무실 쪽), 지후는 그 옆 — 전부 석재 로비 바닥 위, 벽·엘리베이터 그림에 안 가린다.
      // 사용자 r2: 「대화를 너무 멀리서 한다」 — 팀장은 서하 바로 오른쪽(같은 줄, 한 칸), 민호는 바로 왼쪽, 지후는 두 칸 앞에서 서하를 마주 본다.
      // 위아래로 붙어 서면 3/4 시점에서 그림이 겹치므로(VQA r14) 바로 앞 칸은 비운다.
      meetLead: { x: 17, y: 4 }, meetJihu: { x: 16, y: 6 },
      // 한 팀 책상 무리(3열 6자리) 옆에 서하·지후, 팀장 책상은 그 동쪽.
      heroDesk: nearestFree(project, officeRoom, { x: 13, y: 9 }),
      jihuDesk: nearestFree(project, officeRoom, { x: 17, y: 9 }),
      leadDesk: nearestFree(project, officeRoom, { x: 20, y: 10 }),
      pantry: nearestFree(project, officeRoom, { x: 6, y: 4 }),
      // 회의실: 유리문(10,12) 바로 안쪽이 meeting, 탁자(4×2) 둘레의 빈 바닥 다섯 칸이 meetSeats(의자·탁자 위가 아니다).
      meeting: nearestFree(project, officeRoom, { x: 10, y: 14 }),
      // 발표 배치(VQA r4 M3): 발표자 둘은 탁자 동쪽 끝에 나란히 서서 서쪽(탁자)을 본다 — 한 열로 쌓이지 않는다.
      // 본부장은 유리문 가까운 북쪽 의자(6,16), 민호는 남쪽 의자(5,19)에 앉고, 팀장은 서쪽 끝(3,17)에 선다.
      // 금요일 발표(VQA r14 M: 발표자 둘이 위아래로 겹쳐 섰다): 발표자 서하·지후는 탁자 동쪽 끝 북쪽 줄(y16)에 나란히 서서
      // 아래를 보고, 본부장·팀장·민호는 남쪽 줄(y19)에 나란히 서서 위를 본다. 아무도 위아래로 붙어 서지 않고, 모두 x≥7 이라 왼쪽 흉상에 가리지 않는다.
      // 금요일 발표(VQA r21·r22: 다섯이 탁자 옆 2×3 덩어리로 섰다): 발표자 서하·지후는 탁자 북쪽 양 끝(4,16)·(7,16)에 서서 아래를 보고,
      // 듣는 셋(팀장·민호·본부장)은 탁자 남쪽 의자(4·5·6,19)에 앉아 위를 본다 — 탁자를 사이에 둔 맞은편 3칸(scene-talk-far 의 탁자 건너편).
      meetingSeat: { x: 4, y: 16 },
      // 본부장은 탁자 서쪽 머리(3,17)에 서서 탁자 쪽(동)을 본다 — 남쪽 의자에 팀원과 어깨를 붙여 앉히면 손님이 팀원 줄에 끼어 보였다(VQA r23).
      // r27: 지후는 발표자 줄(북쪽, 의자 없는 칸)이 아니라 남쪽 의자 줄 끝 의자(6,19)에 앉는다 — 빈 의자 둘 사이에 선 사람으로 읽혔다.
      meetSeats: [{ x: 4, y: 16 }, { x: 6, y: 19 }, { x: 5, y: 19 }, { x: 4, y: 19 }, { x: 3, y: 17 }],
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
  // 편의점 문 앞(konbiniOut)이 맵 맨 아래 둘째 줄이라 카메라가 서하를 화면 아래 끝 대화창 뒤에 뒀다(VQA r22).
  // 맨 아랫줄(보도·차도, 위층 없음)을 네 줄 더 이어 거리가 남쪽으로 계속되게 한다 — 카메라가 서하를 화면 가운데 둘 수 있다.
  const streetH = streetPm.height;
  padMapBottom(streetPm, 4, () => streetH - 1);
  const officePm = cloneMap(project, FL_MAP.office, FL_MAP.officePm, "스튜디오 늘봄 · 야근");
  const officeFri = cloneMap(project, FL_MAP.office, FL_MAP.officeFri, "스튜디오 늘봄 · 금요일");
  // 금요일 회의실은 사무층 맨 아래(y 13~20)라 카메라가 맵 끝에 걸려 다섯 사람이 흉상·대화창 사이에 끼었다(VQA r10).
  // 바깥 채움 두 줄(맨 아래 두 줄 무늬)을 FRI_PAD 줄 더 덧대 카메라가 회의실을 화면 위쪽에 둘 수 있게 한다 — 덧댄 줄은 대화창 뒤다.
  const FRI_PAD = 3, friH = officeFri.height;
  padMapBottom(officeFri, FRI_PAD, (y) => friH - 2 + ((y - friH) % 2));
  // 덧댄 줄은 빈 칸(맵 밖과 같은 어둠)이다 — 바깥벽 무늬를 되풀이하면 대화창이 없을 때 빈 띠가 화면 1/3을 채웠다(VQA r12).
  for (let y = friH; y < friH + FRI_PAD; y++) for (let x = 0; x < officeFri.width; x++) clearMapCellForBackground(officeFri, y * officeFri.width + x);
  // 회의실 탁자 북쪽의 빈 의자 둘을 걷어 낸다 — 발표자(서하·본부장)는 서 있고 듣는 셋은 남쪽 의자에 앉으므로 북쪽 의자는 늘 비어
  // «다들 서 있는데 의자는 비었다»로 읽혔고(VQA r29), 서하가 회의실을 나갈 때 그 의자 위로 걸었다. 탁자(y 17) 위 줄의 의자 그림만 지운다.
  {
    const up = (officeFri as { upperTiles?: number[] }).upperTiles;
    const chairTop = up?.[15 * officeFri.width + 5];
    if (up && chairTop !== undefined && chairTop >= 0) {
      const chairIds = new Set([chairTop, up[16 * officeFri.width + 5]!]);
      for (let y = 13; y < 17; y++) for (let x = 1; x < 12; x++) if (chairIds.has(up[y * officeFri.width + x]!)) up[y * officeFri.width + x] = -1;
    }
  }
  const platformPm = cloneMap(project, FL_MAP.platformAm, FL_MAP.platformPm, "한결역 승강장 · 막차");

  // 밤 거리: 푸른 어둠 + 실제 가로등(3칸 기둥의 머리 높이)·공원 가로등·간판 빛.
  // 좌표는 거리 맵(modern_city, 시드 5)에 찍힌 mc-prop-lamp-a 기둥 윗칸 + 1 이다.
  const lamps: LightSource[] = [];
  const streetLamps: Array<[number, number]> = [[21, 2], [1, 21], [14, 21], [41, 21], [21, 26], [21, 33], [6, 4], [13, 4]];
  // 반지름 5 는 화면 밖 가로등의 빛 웅덩이가 잔디·지붕까지 번져 «광원 없는 빛»으로 읽혔다(VQA r25) — 기둥 둘레만 밝힌다.
  // 빛은 기둥 발치(밑칸)에 작게 — 기둥 가운데에 반지름 3.5 로 두면 둥근 웅덩이가 지붕·잔디까지 번져 «아무 데나 뜬 빛»이었다(VQA r30 중대).
  for (const [i, [x, y]] of streetLamps.entries()) lamps.push(light(`fl_lamp_${i}`, { x, y: y + 1 }, 2.3, "#ffd98a", 0.6));
  // 가게 문 앞 웅덩이는 뺐다 — 가로등 없는 데 뜬 원반으로 읽혔다(VQA r30). 불 켜진 가게는 편의점 하나다(아래 fl_kb_*).
  // 불 켜진 창(VQA r22: 「밤거리가 밤으로 덜 읽힌다」) — 건물마다 문 위 막힌 덩어리(건물 그림)를 찾아 앞면 아래 두 줄에
  // 한 칸 건너 작은 따뜻한 빛을 둔다. 모든 창이 켜지지 않게 칸 좌표로 정한 절반만(같은 맵이면 늘 같은 창).
  for (const [i, b] of streetData.buildings.entries()) {
    const d = b.doors[0] ?? b.access[0];
    // 편의점은 문 앞 가게 불빛(fl_kb_spill)이 맡는다 — 낮은 건물이라 «앞면 아래 세 줄»이 지붕에 걸려 지붕 위에 불이 떴다(VQA r25).
    if (!d || b.kind === "conv") continue;
    const seen = new Set<string>(), queue: Cell[] = [{ x: d.x, y: d.y - 1 }];
    const cells: Cell[] = [];
    while (queue.length && cells.length < 400) {
      const c = queue.pop()!; const k = `${c.x},${c.y}`;
      if (seen.has(k) || c.x < 0 || c.y < 0 || c.x >= streetPm.width || c.y >= streetPm.height) continue;
      seen.add(k);
      if (Math.abs(c.x - d.x) > 8 || d.y - c.y > 14 || c.y > d.y) continue;
      if (isPassable(project, streetPm, c.x, c.y) && !(c.x === d.x && c.y === d.y)) continue;
      cells.push(c);
      queue.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y - 1 }, { x: c.x, y: c.y + 1 });
    }
    if (cells.length < 6) continue;
    const minX = Math.min(...cells.map((c) => c.x)), maxX = Math.max(...cells.map((c) => c.x));
    const bottom = Math.max(...cells.map((c) => c.y));
    // 낮은 건물은 앞면이 두세 줄뿐이라 아래 세 줄에 지붕이 섞인다 — 키 큰 건물(여섯 줄 넘게)만 창에 불을 켠다.
    if (bottom - Math.min(...cells.map((c) => c.y)) < 6) continue;
    for (let y = bottom - 3; y <= bottom - 1; y++) for (let x = minX + 1; x < maxX; x += 2) {
      if (x === d.x || !cells.some((c) => c.x === x && c.y === y) || ((x * 7 + y * 3 + i) % 3 === 0)) continue;
      lamps.push(light(`fl_win_${i}_${x}_${y}`, { x, y }, 0.7, "#ffc86e", 0.7)); // 창 한 칸만(1.1 은 창들이 뭉쳐 앞면에 얼룩, r30)
    }
  }
  lamps.push(light("fl_subway", anchors.street.subway, 3, "#cfe4ff", 0.8));
  // 편의점 문 앞 보도로 새어 나오는 따뜻한 가게 불빛(밤에 들르는 곳이 한눈에 읽히게).
  // 편의점: 가게 앞면(유리창)을 환하게 — «편의점 불빛이 환하다»에 창이 어두웠다(VQA r30). 문 위 두 줄(앞면 유리) 양옆에 흰 빛,
  // 문 앞 보도에 작은 웅덩이 하나.
  const kb = anchors.street.konbiniOut;
  lamps.push(
    light("fl_kb_front_l", { x: kb.x - 1, y: kb.y - 2 }, 2, "#effff6", 1),
    light("fl_kb_front_r", { x: kb.x + 2, y: kb.y - 2 }, 2, "#effff6", 1),
    light("fl_kb_spill", { x: kb.x, y: kb.y + 1 }, 2.6, "#fff0c4", 0.8),
  );
  streetPm.defaultLighting = { ambient: 0.74, color: "#0b1230", sources: lamps };
  officePm.defaultLighting = {
    // 야근 밤: 너무 어두우면 인물이 안 읽힌다(VQA r3) — 어둠은 한 단계 줄이고 책상·탕비실·회의 자리 불을 넓힌다.
    // 밤 10시대 사무실이 낮과 같은 밝기로 읽혔다(VQA r16) — 한 단계 더 어둡게, 책상 불은 그대로.
    ambient: 0.42, color: "#18183a",
    sources: [
      light("fl_desk_hero", anchors.office.heroDesk, 5, "#ffe6b8"), light("fl_desk_jihu", anchors.office.jihuDesk, 5, "#ffe6b8"),
      light("fl_pantry", anchors.office.pantry, 5, "#fff2d0"), light("fl_meeting", anchors.office.meetingSeat, 5, "#ffeecc", 0.8),
    ],
  };
  platformPm.defaultLighting = {
    // 지하 승강장은 형광등으로 고르게 밝다 — 바닥의 큰 빛 웅덩이 사이가 구름 그림자처럼 얼룩졌다(VQA r16). 고른 밤색만 얇게 깔고 간판 불만 둔다.
    // 아침 승강장과 같은 밝기로 읽혔다(VQA r23) — 막차 시간의 푸른 밤색을 한 단계 더(얼룩이 생기지 않게 큰 빛은 더하지 않는다).
    ambient: 0.32, color: "#101836",
    // 승강장에는 가로등이 없다 — 실제로 빛나는 것(발차 LED 판·자판기·매표기·벽시계·역명 간판)만 켠다.
    sources: [
      light("fl_led_a", { x: 10, y: 3 }, 4, "#bfe0ff", 0.8), light("fl_led_b", { x: 24, y: 3 }, 4, "#bfe0ff", 0.8), light("fl_led_c", { x: 38, y: 3 }, 4, "#bfe0ff", 0.8),
      light("fl_vend_a", { x: 2, y: 4 }, 3, "#d9f4ff", 0.85), light("fl_vend_b", { x: 4, y: 4 }, 3, "#d9f4ff", 0.85),
      light("fl_kiosk", { x: 19, y: 4 }, 4, "#fff0c8", 0.8),
      light("fl_sign_a", { x: 11, y: 8 }, 4, "#fff0c8", 0.8), light("fl_sign_b", { x: 25, y: 8 }, 4, "#fff0c8", 0.8), light("fl_sign_c", { x: 39, y: 8 }, 4, "#fff0c8", 0.8),
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

  // 도구 실행(exec)은 프로젝트 맵 객체를 새로 만들 수 있다 — 위에서 잡아 둔 맵 참조(조명 등)가 끊기지 않게 맨 끝에 둔다(VQA r10: 밤거리 조명 사라짐).
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
      exec("set_map_transit", { mapId: id, auto: { subway: { vehicle: "jp-subway", name: "한결선", stopName: "한결역", headwaySec: 50, waitSec: 10, centerX: 25 } } });
    } catch (error) {
      console.warn(`[first-love] ${id} 열차를 깔지 못했다: ${(error as Error).message}`);
    }
    // 건너편 선로 — 승강장 아래가 검은 허공으로 끝나지 않게 선로를 한 벌 더 깐다(열차는 안 다닌다). 탈것 도구가 선로 띠를 찾은 뒤에 칠한다
    // (두 벌이 붙어 있으면 도구가 4줄 띠를 선로로 못 읽는다). 선로 칸은 막힘이라 걸을 수 있는 고립 바닥이 되지 않는다.
    const m = project.maps[id]!;
    // 맨 아래 두 줄(덧댄 줄)도 선로를 한 벌 더 — 그대로 두면 화면 아래 1/5이 검은 띠였다(VQA r20).
    for (const ty of [NEAR_TRACK_Y + 2, NEAR_TRACK_Y + 4]) {
      if (ty + 1 >= m.height) continue;
      for (let x = 0; x < m.width; x++) {
        m.lowerTiles[ty * m.width + x] = TRACK_TOP;
        m.lowerTiles[(ty + 1) * m.width + x] = TRACK_BOTTOM;
        if (m.upperTiles) { m.upperTiles[ty * m.width + x] = -1; m.upperTiles[(ty + 1) * m.width + x] = -1; }
      }
    }
  }
  // 금요일 밤 막차는 장면이 부른다 — 대화 도중 아무 열차나 드나들면 「지후가 탈 열차가 지후를 두고 떠난다」(VQA r17).
  // 안내 방송에서 FL_TRAIN_CALL 을 켜면 한 대가 들어와 서고, 지후가 탄 뒤 FL_TRAIN_GO 를 켜야 문을 닫고 떠난다.
  // 들어오는 열차가 맵 밖 먼 데서 출발하면 부른 뒤 10초 넘게 빈 선로를 보게 된다 — 머리가 맵 왼쪽 끝 바로 밖에서 출발하게 경로 앞을 자른다
  // (정류장 번호도 같은 만큼 당긴다). 건너편 선로(반대 방향)는 이 장면에서 끈다 — 대화 중 다른 열차가 지나가지 않게.
  const pmRoutes = project.maps[FL_MAP.platformPm]?.transit?.routes ?? [];
  pmRoutes.forEach((route) => {
    const head = route.path[0];
    // 승강장 바로 앞 선로(위 두 줄, 머리 행 y=11)를 동쪽으로 달리는 노선만 막차다.
    if (!head || head.y !== 11 || route.path.length < 2 || route.path[1]!.y !== head.y || route.path[1]!.x <= head.x) { route.enabled = false; return; }
    const cut = Math.max(0, -1 - head.x);
    route.path[0] = { x: head.x + cut, y: head.y };
    for (const stop of route.stops ?? []) { stop.index -= cut; stop.departSwitch = FL_TRAIN_GO; }
    route.callSwitch = FL_TRAIN_CALL;
    route.headwaySec = 600;
    route.speed = 8;
  });
  return anchors;
}
