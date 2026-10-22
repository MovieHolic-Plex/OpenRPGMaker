// 고딕 저택·묘지(gothic_manor) 장소 도구 — 조수가 이 칩셋으로 실제 게임 맵 한 장(야외 장소·실내 방)을 한 번에 짓는다.
//   list_gothic_places  : 야외 장소 3종(저택 정원·공동묘지·미술관 앞마당) + 실내 공간 8종(홀·서재·침실·부엌·지하실·예배당·납골당·전시실)
//   build_gothic_place  : 야외는 composeGothicPlace(src/editor/gothic/composer.ts), 실내는 같은 조립기 buildWizardingSpace 에
//                         고딕 공간 사양(src/assets/gothicSpaceSpec.json, scripts/content/gothic-manor/space_recipes_gm.py)을 넣어 짓는다.
//                         오류가 하나라도 있으면 맵을 바꾸지 않는다. 새 맵은 create_map 경로로 만든다(맵 트리·BGM·시작 맵 규칙 그대로).
import gothicSpaceSpec from "@/assets/gothicSpaceSpec.json";
import { composeGothicPlace, GOTHIC_PLACE_INFO, GOTHIC_PLACE_KINDS, type GothicPlaceKind } from "@/editor/gothic/composer";
import { buildWizardingSpace, type WizardingDoorInput, type WizardingFurnitureInput, type WizardingSpaceInput, type WizardingSpaceSpec } from "@/editor/wizarding/builder";
import { createGothicManorTileset, ensureGothicManorTileset, GOTHIC_MANOR_ID, isGothicManorTileset } from "@/project/defaults/gothicManor";
import { layoutQualityLimits, measureLayoutQuality } from "@/ai/piAgent/layoutQuality";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const GOTHIC_SPACE_SPEC = gothicSpaceSpec as unknown as WizardingSpaceSpec;
export const GOTHIC_ROOM_KEYS: readonly string[] = Object.keys(GOTHIC_SPACE_SPEC.spaces);
const PLACE_KEYS: readonly string[] = [...GOTHIC_PLACE_KINDS, ...GOTHIC_ROOM_KEYS];
const placesLine = (): string => [
  ...GOTHIC_PLACE_KINDS.map((k) => `${k}=${GOTHIC_PLACE_INFO[k].ko}(야외)`),
  ...GOTHIC_ROOM_KEYS.map((k) => `${k}=${GOTHIC_SPACE_SPEC.spaces[k]!.ko}`),
].join(" · ");
const isOutdoor = (k: string): k is GothicPlaceKind => (GOTHIC_PLACE_KINDS as readonly string[]).includes(k);

function ensureTileset(draft: Project) {
  if (!draft.tilesets[GOTHIC_MANOR_ID]) draft.tilesets[GOTHIC_MANOR_ID] = createGothicManorTileset();
  else ensureGothicManorTileset(draft.tilesets[GOTHIC_MANOR_ID]!);
  const ts = draft.tilesets[GOTHIC_MANOR_ID]!;
  if (!isGothicManorTileset(ts)) throw new ToolError(`타일셋 ${GOTHIC_MANOR_ID} 이 번들 고딕 저택 시트가 아니다`, { code: "tileset-not-found" });
  return ts;
}

function isBlankMap(map: GameMap): boolean {
  if ((map.events ?? []).length) return false;
  const first = map.lowerTiles[0];
  if (map.lowerTiles.some((t) => t !== first)) return false;
  for (const layer of [map.upperTiles, map.lowerOverlayTiles ?? [], map.upperOverlayTiles ?? []]) if (layer.some((t) => t >= 0)) return false;
  return true;
}

/** 다른 맵·커먼 이벤트의 transfer 중 이 맵을 가리키는데 새 크기·새 벽에 걸리는 것을 시작 칸으로 옮긴다(다시 짓기가 들어오는 문을 깨지 않게). */
function retargetIncomingTransfers(draft: Project, mapId: string, spawn: { x: number; y: number }): number {
  const map = draft.maps[mapId]!;
  let moved = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.kind === "transfer" && o.mapId === mapId && typeof o.x === "number" && typeof o.y === "number" && !isPassable(draft, map, o.x, o.y)) {
      o.x = spawn.x; o.y = spawn.y; moved++;
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  for (const m of Object.values(draft.maps)) walk(m.events ?? []);
  walk(draft.commonEvents ?? []);
  return moved;
}

export const LIST_GOTHIC_PLACES_TOOL: ToolDefinition = {
  name: "list_gothic_places",
  mode: "read",
  domains: ["tile", "map"],
  description: "고딕 저택·묘지·호러(gothic_manor) 장소 목록 — build_gothic_place 에 넣는 place·variant 를 찾는다. "
    + "인자 없이 → 야외 3종(저택 정원·공동묘지·미술관 앞마당)과 실내 8종의 이름·크기·담긴 것. place 를 주면 → 그 장소의 크기 범위와 (실내면) 벽·바닥·가구 키트·변형.",
  parameters: {
    type: "object",
    properties: { place: { type: "string", enum: [...PLACE_KEYS], description: "장소 키" } },
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const place = typeof args.place === "string" ? args.place : "";
    if (!place) {
      return {
        summary: `고딕 장소 ${PLACE_KEYS.length}종 — ${placesLine()}. 야외는 철책·정문·건물 문까지 길이 이어진 한 장, 실내는 벽 고리·문·가구까지.`,
        data: {
          tilesetId: GOTHIC_MANOR_ID,
          outdoor: GOTHIC_PLACE_KINDS.map((k) => ({ place: k, ko: GOTHIC_PLACE_INFO[k].ko, size: GOTHIC_PLACE_INFO[k].size, contains: GOTHIC_PLACE_INFO[k].desc })),
          indoor: GOTHIC_ROOM_KEYS.map((k) => { const r = GOTHIC_SPACE_SPEC.spaces[k]!; return { place: k, ko: r.ko, size: r.size, variants: Object.keys(r.variants ?? {}) }; }),
        },
      };
    }
    if (isOutdoor(place)) {
      const i = GOTHIC_PLACE_INFO[place];
      return { summary: `${i.ko}(${place}) — 야외 ${i.size.default.join("×")}(최소 ${i.size.min.join("×")}, 최대 ${i.size.max.join("×")}): ${i.desc}`, data: { tilesetId: GOTHIC_MANOR_ID, place, ko: i.ko, size: i.size, contains: i.desc } };
    }
    const r = GOTHIC_SPACE_SPEC.spaces[place];
    if (!r) throw new ToolError(`장소 "${place}" 가 없다 — ${placesLine()}`, { code: "UNKNOWN_SPACE" });
    const ws = r.wall ? GOTHIC_SPACE_SPEC.wallsets[r.wall] : undefined;
    return {
      summary: `${r.ko}(${place}) — 실내 ${r.size.default.join("×")}(최소 ${r.size.min.join("×")}, 최대 ${r.size.max.join("×")}), 벽 ${ws?.ko ?? "-"}, 가구 ${r.furniture.length}종`,
      data: {
        tilesetId: GOTHIC_MANOR_ID, place, ko: r.ko, size: r.size, wall: ws?.ko, floor: r.floor, defaultDoors: r.defaultDoors, variants: Object.keys(r.variants ?? {}),
        furniture: r.furniture.map((f) => ({ kit: f.kit, name: GOTHIC_SPACE_SPEC.pieces[f.kit]?.name ?? f.kit, placement: f.placement, count: f.count })),
        decals: r.decals.map((d) => d.kit),
      },
    };
  },
};

const DOOR_ITEM = {
  type: "object",
  properties: {
    side: { type: "string", enum: ["n", "s", "e", "w"], description: "벽(변): n 북 · s 남 · e 동 · w 서" },
    offset: { type: "integer", minimum: 0, description: "문 왼쪽(n·s) 또는 위쪽(e·w) 칸의 맵 좌표. 생략하면 그 변 가운데" },
    kind: { type: "string", enum: ["single", "double"], description: "1칸 문 · 2칸 문(기본 single)" },
  },
  required: ["side"],
  additionalProperties: false,
} as const;
const FURNITURE_ITEM = {
  type: "object",
  properties: {
    kit: { type: "string", description: "가구 키트 id(list_gothic_places({place}) 의 furniture[].kit, 또는 다른 gm- 키트)" },
    x: { type: "integer", minimum: 0, description: "키트 왼쪽 위 칸 x(생략하면 자동 자리)" },
    y: { type: "integer", minimum: 0, description: "키트 왼쪽 위 칸 y" },
  },
  required: ["kit"],
  additionalProperties: false,
} as const;

export const BUILD_GOTHIC_PLACE_TOOL: ToolDefinition = {
  name: "build_gothic_place",
  mode: "write",
  domains: ["tile", "map"],
  description: "호러·흉가·저택·공동묘지·예배당·미술관 맵을 짓는 길 — 번들 칩셋 gothic_manor 로 장소 한 장을 한 번에 짓는다(결정론 seed). 「던전」인 지하 묘지·카타콤(묘실·복도·보물 방·적이 이어진 층)은 이 도구로 방을 여러 장 지어 잇지 말고 author_dungeon type:'catacomb' 를 쓴다. "
    + `place: ${placesLine()}. `
    + "야외(manor-grounds·graveyard·gallery-plaza)는 둘레 철책·돌담과 남쪽 정문, 북쪽 본 건물, 곁 건물·연못·묘비 줄·고사목·등불·안개까지 놓고, 모든 건물 문 앞까지 길을 잇는다. "
    + "실내(hall·library·bedroom·kitchen·cellar·chapel·crypt·gallery)는 벽 고리·문·바닥·러너·가구·덧그림을 짓는다(doors·furniture·density 로 조절). "
    + "mapId 가 비어 있는 맵이면 그 맵에 짓고, 이미 그린 맵이면 overwrite:true 가 있어야 다시 짓는다. mapId 없이 name 을 주면 새 맵을 만든다. "
    + "맵을 이을 때는 결과의 transferEndpoints[].endpoint 를 create_transfer_pair 의 a/b 에 그대로 넣는다(건물 문은 doorAt 포함). 지은 맵을 크기만 바꾸려 다시 짓지 않는다. 오류가 있으면 맵을 바꾸지 않는다. 이 칩셋 맵을 낱칸 칠하기로 처음부터 그리지 않는다.",
  parameters: {
    type: "object",
    properties: {
      place: { type: "string", enum: [...PLACE_KEYS], description: "장소 키" },
      mapId: { type: "string", description: "지을 맵 id. 없는 id 면 그 id 로 새 맵, 생략하면 새 id" },
      name: { type: "string", description: "새 맵 이름(생략하면 장소 이름)" },
      overwrite: { type: "boolean", description: "이미 그린 맵을 통째로 다시 짓기" },
      variant: { type: "string", description: "실내 변형(hall: corridor·dining). 생략하면 기본" },
      width: { type: "integer", minimum: 8, maximum: 64, description: "맵 폭(생략하면 장소 기본)" },
      height: { type: "integer", minimum: 8, maximum: 48, description: "맵 높이(생략하면 장소 기본)" },
      doors: { type: "array", items: DOOR_ITEM, description: "실내 출입구. 첫 문이 주 출입구" },
      furniture: { type: "array", items: FURNITURE_ITEM, description: "실내에 놓을 가구(좌표를 주면 그 자리)" },
      density: { type: "string", enum: ["sparse", "normal", "full"], description: "소품·가구 양(기본 normal)" },
      fog: { type: "boolean", description: "야외 안개 덧그림·안개 이끼(기본 true)" },
      seed: { type: "integer", description: "배치 시드(같은 시드 = 같은 결과, 기본 1)" },
    },
    required: ["place"],
    additionalProperties: false,
  },
  invalidArgsExample: { place: "graveyard", name: "버려진 공동묘지", density: "normal", seed: 2 },
  run(draft, args): ToolExecResult {
    const place = typeof args.place === "string" ? args.place : "";
    if (!PLACE_KEYS.includes(place)) throw new ToolError(`place "${place}" 가 없다 — ${placesLine()}`, { code: "UNKNOWN_SPACE" });
    const tileset = ensureTileset(draft);
    const wantId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    const existing = wantId ? draft.maps[wantId] : undefined;
    if (existing && !isBlankMap(existing) && args.overwrite !== true) {
      throw new ToolError(`맵 '${existing.name}'(${wantId}) 에 이미 그린 것이 있다 — 통째로 다시 지으려면 overwrite:true, 아니면 mapId 를 빼고 name 으로 새 맵을 만든다`, { code: "map-not-empty", mapId: wantId });
    }
    const seed = typeof args.seed === "number" ? args.seed : undefined;
    const density = typeof args.density === "string" ? (args.density as "sparse" | "normal" | "full") : undefined;
    let built: { ko: string; width: number; height: number; indoor: boolean; lowerTiles: number[]; lowerOverlayTiles: number[]; upperTiles: number[]; upperOverlayTiles: number[]; spawn: { x: number; y: number }; walkableCount: number; issues: { severity: string; code: string; message: string }[] };
    let extra: Record<string, unknown> = {};
    let next: string;
    if (isOutdoor(place)) {
      const r = composeGothicPlace({ place, ...(typeof args.width === "number" ? { width: args.width } : {}), ...(typeof args.height === "number" ? { height: args.height } : {}),
        ...(seed !== undefined ? { seed } : {}), ...(density ? { density } : {}), ...(typeof args.fog === "boolean" ? { fog: args.fog } : {}) }, tileset);
      built = { ...r, indoor: false };
      extra = { entrances: r.entrances.map((e) => ({ building: e.name, kit: e.kit, x: e.x, y: e.y, access: e.access })), exits: r.exits,
        transferEndpoints: [
          ...r.entrances.filter((e, i, all) => !all.some((o, j) => j < i && o.kit === e.kit && o.y === e.y && Math.abs(o.x - e.x) === 1))
            .map((e) => ({ building: e.name.split("(")[0], endpoint: { mapId: "@", x: e.access.x, y: e.access.y, doorAt: { x: e.access.x, y: e.access.y - 1 } } })),
          ...r.exits.map((c) => ({ building: "정문", endpoint: { mapId: "@", x: c.x, y: c.y } })),
        ],
        placed: r.placed.filter((p) => p.role !== "decal").map((p) => ({ kit: p.kit, x: p.x, y: p.y, role: p.role })) };
      const doorText = r.entrances.map((e) => `${e.name.split("(")[0]}(${e.x},${e.y})`).join(" ");
      next = `건물 문 ${r.entrances.length}곳 ${doorText} — 문 칸에 실내 맵으로 가는 이동 이벤트(transfer)를 달고(그 아래 접근 칸은 비워 둔다), 정문 ${r.exits.map((c) => `(${c.x},${c.y})`).join(" ")} 에 바깥 맵 이동을 단다. 실내는 build_gothic_place({place:"hall"|"library"|"gallery"…}).`;
    } else {
      const input: WizardingSpaceInput = {
        space: place,
        ...(typeof args.variant === "string" && args.variant ? { variant: args.variant } : {}),
        ...(typeof args.width === "number" ? { width: args.width } : {}),
        ...(typeof args.height === "number" ? { height: args.height } : {}),
        ...(Array.isArray(args.doors) ? { doors: args.doors as WizardingDoorInput[] } : {}),
        ...(Array.isArray(args.furniture) ? { furniture: args.furniture as WizardingFurnitureInput[], furnitureMode: "auto" as const } : {}),
        ...(density ? { density } : {}),
        ...(seed !== undefined ? { seed } : {}),
      };
      // 같은 입력이면 같은 방 — 다만 소품 자리 시드가 빈 바닥 6×6 을 남기면 조수 실행기의 배치 품질 권고(빈 바닥 ≤30%, 빈 정사각형 ≤5)가
      // 「채우기 수리」를 시켜 방을 다시 짓게 된다(2026-10-14 실제 입력창). 그래서 정해진 순서의 시드 몇 개를 재서 처음 기준 안인 배치를 쓴다.
      const baseSeed = seed ?? 1;
      let r = buildWizardingSpace({ ...input, seed: baseSeed }, tileset, GOTHIC_SPACE_SPEC);
      const fitsLimits = (x: typeof r) => {
        if (x.issues.some((i) => i.severity === "error")) return true;
        if (x.issues.some((i) => i.severity === "warning")) return false;   // 가구가 모자란 배치(자리 부족 경고)보다 다른 시드를 먼저 본다
        if (x.width * x.height < 150) return true;
        const probe = { id: "_probe", name: "_probe", width: x.width, height: x.height, tilesetId: GOTHIC_MANOR_ID, events: [],
          lowerTiles: x.lowerTiles, upperTiles: x.upperTiles, lowerOverlayTiles: x.lowerOverlayTiles, upperOverlayTiles: x.upperOverlayTiles } as unknown as GameMap;
        const q = measureLayoutQuality(draft, probe);
        if (!q || q.floorCells < 40) return true;
        const lim = layoutQualityLimits(q);
        return q.empty <= lim.empty && q.square <= lim.square && q.mirror <= lim.mirror;
      };
      for (let k = 1; k <= 8 && !fitsLimits(r); k++) {
        const alt = buildWizardingSpace({ ...input, seed: baseSeed + k * 1009 }, tileset, GOTHIC_SPACE_SPEC);
        if (!alt.issues.some((i) => i.severity === "error")) r = alt;
      }
      built = r;
      const step = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] } as const;
      const keepClear = r.doorCells.flatMap((d) => [1, 2].map((k) => ({ x: d.x + step[d.side][0] * k, y: d.y + step[d.side][1] * k }))).filter((c) => c.x >= 0 && c.y >= 0 && c.x < r.width && c.y < r.height);
      extra = { doorCells: r.doorCells, keepClear,
        transferEndpoints: r.doorCells.map((d, i) => ({ building: i === 0 ? "주 출입구" : `출입구 ${i + 1}`, endpoint: { mapId: "@", x: d.x, y: d.y } })), placed: r.placed.filter((p) => p.role === "furniture").map((p) => ({ kit: p.kit, x: p.x, y: p.y })), components: r.components };
      next = `출입구 ${r.doorCells.map((d) => `${d.side}(${d.x},${d.y})`).join(" ")} 에 이동 이벤트(transfer)를 단다(문 앞 ${keepClear.map((c) => `(${c.x},${c.y})`).join(" ")} 은 비운다). 은신처(옷장·침대)는 기물 앞 칸에 상호작용 이벤트를 건다.`;
    }
    const errors = built.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      const e0 = errors[0]!;
      throw new ToolError(`고딕 장소를 짓지 않았다 — 오류 ${errors.length}건: ${errors.slice(0, 6).map((e) => `${e.code} ${e.message}`).join(" / ")}`, { code: e0.code, ...(wantId ? { mapId: wantId } : {}) });
    }
    let mapId = wantId;
    let created = false;
    if (!existing) {
      const createMap = MAP_TOOLS.find((t) => t.name === "create_map");
      if (!createMap?.run) throw new ToolError("create_map 도구를 찾지 못했다", { code: "internal" });
      const res = createMap.run(draft, { name: typeof args.name === "string" && args.name.trim() ? args.name.trim() : built.ko, width: built.width, height: built.height,
        tilesetId: GOTHIC_MANOR_ID, ...(wantId ? { id: wantId } : {}) }) as ToolExecResult;
      mapId = (res.data as { mapId: string }).mapId;
      created = true;
    }
    const map = draft.maps[mapId]!;
    const W = built.width, H = built.height;
    const inside = (e: { x: number; y: number }) => e.x >= 0 && e.y >= 0 && e.x < W && e.y < H;
    const keptEvents = (map.events ?? []).filter(inside);
    // 맵 밖으로 나간 나가는 문(transfer 이벤트)은 버리지 않고 새 출입구 칸으로 옮긴다 — 다시 짓기가 돌아가는 길을 끊지 않게.
    const freeDoors = ((extra.doorCells as { x: number; y: number }[] | undefined) ?? []).filter((d) => !keptEvents.some((e) => e.x === d.x && e.y === d.y));
    let movedDoors = 0;
    for (const e of (map.events ?? []).filter((ev) => !inside(ev))) {
      const door = JSON.stringify(e).includes('"kind":"transfer"') ? freeDoors.shift() : undefined;
      if (door) { keptEvents.push({ ...e, x: door.x, y: door.y }); movedDoors++; }
    }
    const droppedEvents = (map.events ?? []).length - keptEvents.length;
    const nextMap: GameMap = {
      ...map,
      ...(typeof args.name === "string" && args.name.trim() && !created ? { name: args.name.trim() } : {}),
      width: W, height: H, tilesetId: GOTHIC_MANOR_ID, tileSize: tileset.tileSize,
      lowerTiles: built.lowerTiles, upperTiles: built.upperTiles, lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles,
      events: keptEvents,
      ...(built.indoor ? { climate: { mode: "indoor" } } : {}),
    } as GameMap;
    for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "terrainDesign", "doodadGroups", "visualTopOverhangPx", "worldmapSource"] as const) delete (nextMap as Partial<GameMap>)[k];
    draft.maps[mapId] = nextMap;
    if (draft.startMapId === mapId) draft.startPos = { x: built.spawn.x, y: built.spawn.y };
    const warnings = built.issues.filter((i) => i.severity === "warning").map((i) => i.message);
    if (droppedEvents) warnings.push(`맵 밖으로 나간 이벤트 ${droppedEvents}개를 지웠다`);
    if (movedDoors) warnings.push(`맵 밖으로 나간 나가는 문 이벤트 ${movedDoors}개를 새 출입구 칸으로 옮겼다`);
    const retargeted = created ? 0 : retargetIncomingTransfers(draft, mapId, built.spawn);
    if (retargeted) warnings.push(`다른 맵에서 이 맵으로 오는 이동 ${retargeted}개가 새 벽·맵 밖을 가리켜 시작 칸 (${built.spawn.x},${built.spawn.y}) 으로 옮겼다 — 문 앞으로 다시 잇는 것이 좋다`);
    const stranded = keptEvents.filter((e) => !isPassable(draft, nextMap, e.x, e.y)).length;
    if (stranded) warnings.push(`남긴 이벤트 ${stranded}개가 새 벽·가구 칸 위에 있다 — 옮기거나 지운다`);
    const endpoints = (extra.transferEndpoints as { building: string; endpoint: Record<string, unknown> }[] | undefined) ?? [];
    for (const t of endpoints) t.endpoint.mapId = mapId;
    if (endpoints.length) extra.transferEndpoints = endpoints;
    const endpointText = endpoints.length ? ` create_transfer_pair 의 a/b 에는 transferEndpoints[].endpoint 를 그대로 넣는다: ${endpoints.slice(0, 4).map((t) => `${t.building}=${JSON.stringify(t.endpoint)}`).join(" · ")}.` : "";
    return {
      summary: `${built.ko} ${W}×${H} 를 ${created ? "새 맵" : "맵"} '${nextMap.name}'(${mapId}, ${GOTHIC_MANOR_ID}) 에 지었다 — 시작 칸 (${built.spawn.x},${built.spawn.y}), 걸어 닿는 칸 ${built.walkableCount}`
        + `${warnings.length ? ` · 경고 ${warnings.length}: ${warnings.slice(0, 3).join(" / ")}` : ""}. 다음: ${next}${endpointText} NPC 는 list_npc_graphics 로 고른 걷기 칩으로 place_npc.`,
      data: { mapId, created, tilesetId: GOTHIC_MANOR_ID, place, width: W, height: H, spawn: built.spawn, walkableCount: built.walkableCount, ...extra, warnings },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const GOTHIC_PLACE_TOOLS: readonly ToolDefinition[] = [LIST_GOTHIC_PLACES_TOOL, BUILD_GOTHIC_PLACE_TOOL];
