/**
 * 세계 지도(월드맵 키트) 지형 편집 — 조수가 대륙·바다·섬·산줄기·강·숲·바닥 종류까지 바꾼다(2026-10-03).
 *
 * 지형은 키트의 공용 지형(96×72칸) 위에 「작업(ops)」을 차례로 얹어 만든다. 작업은 칸 좌표 다각형·꺾은선이고,
 * 키트가 같은 노이즈 왜곡으로 그려 손으로 만든 지형과 결이 같다. 빌드는 호스트의 Python 키트가 한다
 * (src/editor/worldmap/worldmapBuild.ts). 결과 지도는 `worldmap_<mapId>` 타일셋(지도 그림을 칸마다 한 타일)과
 * 키트의 걷기 표로 통행을 갖는 맵이 된다. 장소는 맵의 이름 붙은 로케이션으로 들어간다.
 *
 * 작업 문법·검사의 정본: tiledata/worldmap-kit/kit/lib/kit_terrain.py (이 파일의 스키마는 그 거울).
 */
import type { GameMap, MapId, MapNamedLocation, PassFlag, Project, TilesetDef, TilesetId } from "@/project/types";
import {
  buildWorldmap, WORLDMAP_GROUNDS, WORLDMAP_OPS,
  type WorldmapBuildRequest, type WorldmapBuildResult,
} from "@/editor/worldmap/worldmapBuild";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const WORLDMAP_THEMES = [
  "fantasy", "fantasy-dungeons", "monster", "joseon", "sengoku", "wuxia", "classical", "desert-east", "dark-gothic", "snow-north",
  "sea-isles", "prehistoric", "alien", "steampunk", "modern-town", "modern-sf", "starmap",
] as const;
const TILE = 16;
const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
const CLOSED: PassFlag = { up: false, down: false, left: false, right: false };

const point: JsonSchema = { type: "array", items: { type: "number" } };
const opSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: { type: "string", enum: [...WORLDMAP_OPS] },
    poly: { type: "array", items: point, description: "land·sea·biome·forest·clear·plateau: 꼭짓점 [[x,y],...] (칸 좌표)" },
    line: { type: "array", items: point, description: "ridge·river: 꺾은선 [[x,y],...]. 강은 바다에서 끝낸다" },
    x: { type: "number", description: "island 중심 · pass 중심 · move_place 새 왼쪽 위 칸" },
    y: { type: "number" },
    rx: { type: "number", description: "island 가로 반지름(칸)" },
    ry: { type: "number", description: "island 세로 반지름(칸)" },
    r: { type: "number", description: "pass 반지름(기본 1.5)" },
    ground: { type: "string", enum: [...WORLDMAP_GROUNDS], description: "land·island·biome·plateau 바닥" },
    kind: { type: "string", enum: ["mount", "small", "mesa", "broad", "conifer", "snow", "jungle", "dead"], description: "ridge: mount|small|mesa · forest: broad|conifer|snow|jungle|dead" },
    width: { type: "number", description: "ridge 최대 폭 1~3(기본 2)" },
    peak: point,
    widen: { type: "number", description: "river: 이 비율(0~1)부터 하류가 두 칸 폭" },
    density: { type: "number", description: "forest 빽빽함 0~1(기본 0.55)" },
    what: { type: "string", enum: ["forest", "mount", "all"], description: "clear: 걷을 물체" },
    level: { type: "integer", enum: [1, 2], description: "plateau 높이" },
    id: { type: "string", description: "move_place: 장소 id(read_world_terrain 의 places)" },
    note: { type: "string", description: "왜 이 작업을 했는지(지도 원본에 남는다)" },
  },
};

const OP_HELP =
  "작업(ops, 칸 좌표 96×72, x 오른쪽·y 아래): "
  + "land{poly,ground?} 땅 더하기 · sea{poly} 바다로 자르기(대륙 가르기·만 파기) · island{x,y,rx,ry,ground?} · "
  + "biome{poly,ground} 바닥 바꾸기 · ridge{line,kind?,width?,peak?} 산줄기 · pass{x,y,r?} 고개 뚫기 · "
  + "river{line,widen?} 강(바다로 끝낼 것) · forest{poly,kind?,density?} · clear{poly,what?} 숲·산 걷기 · "
  + "plateau{poly,level?,ground?} 고원(절벽이 생긴다) · move_place{id,x,y} 장소 옮기기. "
  + `바닥: ${WORLDMAP_GROUNDS.join(" ")}.`;

// ── 준비(prepare) 결과 캐시: 같은 (테마, 작업, 미리보기) 는 한 번만 빌드한다 ──
const prepared = new Map<string, WorldmapBuildResult>();
const lastImage = new Map<string, string>();

function requestKey(request: WorldmapBuildRequest): string {
  return JSON.stringify([request.theme, request.terrain?.ops ?? [], request.preview === true]);
}

function remember(key: string, result: WorldmapBuildResult): void {
  prepared.set(key, result);
  while (prepared.size > 8) prepared.delete(prepared.keys().next().value as string);
}

function theme(args: Record<string, unknown>, map: GameMap | undefined): string {
  const t = typeof args.theme === "string" && args.theme ? args.theme : map?.worldmapSource?.theme ?? "fantasy";
  if (!(WORLDMAP_THEMES as readonly string[]).includes(t)) {
    throw new ToolError(`theme 은 ${WORLDMAP_THEMES.join(", ")} 중 하나다: ${t}`, { code: "invalid-args" });
  }
  return t;
}

function opsOf(value: unknown): Array<Record<string, unknown>> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(o => !o || typeof o !== "object" || Array.isArray(o))) {
    throw new ToolError("ops 는 작업 객체 배열이다. " + OP_HELP, { code: "invalid-args" });
  }
  return value as Array<Record<string, unknown>>;
}

function mapOf(project: Project | undefined, args: Record<string, unknown>): GameMap | undefined {
  const id = typeof args.mapId === "string" ? args.mapId : "";
  return id && project ? project.maps[id as MapId] : undefined;
}

/** 작업이 없으면 null — 테마 기본 지형의 공용 캐시를 그대로 쓴다(새로 그리면 2분). */
function terrainOf(ops: Array<Record<string, unknown>>): WorldmapBuildRequest["terrain"] {
  return ops.length ? { id: "edit", ops } : null;
}

/** edit_world_terrain 이 빌드할 요청 — 맵에 쌓인 작업 + 이번 작업(replace 면 이번 작업만). */
function editRequest(args: Record<string, unknown>, map: GameMap | undefined): WorldmapBuildRequest {
  const add = opsOf(args.ops);
  const base = args.replace === true ? [] : map?.worldmapSource?.ops ?? [];
  return { theme: theme(args, map), terrain: terrainOf([...base, ...add]), preview: args.preview === true };
}

function readRequest(args: Record<string, unknown>, map: GameMap | undefined): WorldmapBuildRequest {
  const ops = args.ops !== undefined ? opsOf(args.ops) : map?.worldmapSource?.ops ?? [];
  return { theme: theme(args, map), terrain: terrainOf(ops), preview: true };
}

async function prepareRequest(request: WorldmapBuildRequest): Promise<void> {
  const key = requestKey(request);
  if (prepared.get(key)?.ok) return;
  try {
    remember(key, await buildWorldmap(request));
  } catch (error) {
    remember(key, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function resultFor(request: WorldmapBuildRequest): Extract<WorldmapBuildResult, { ok: true }> {
  const entry = prepared.get(requestKey(request));
  if (!entry) throw new ToolError("월드맵 빌드가 실행되지 않았다 — 같은 인자로 다시 호출하라.", { code: "worldmap-not-prepared" });
  if (!entry.ok) throw new ToolError(`월드맵 빌드 실패:\n${entry.error}\n\n${OP_HELP}`, { code: "worldmap-build-failed" });
  return entry;
}

function placesSummary(result: Extract<WorldmapBuildResult, { ok: true }>): string[] {
  return result.world.places.map(p => `${p.id}(${p.role}) ${p.x},${p.y} ${p.w}×${p.h}`);
}

function slug(text: string, i: number): string {
  const ascii = text.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  return `wm_${ascii || "place"}_${i}`;
}

/** 지도 그림을 칸마다 한 타일로 쓰는 타일셋 + 걷기 표 통행. */
function worldmapTileset(id: TilesetId, assetId: string, name: string, walk: readonly string[], width: number, height: number): TilesetDef {
  const count = width * height;
  const passability: PassFlag[] = new Array(count);
  for (let y = 0; y < height; y += 1) {
    const row = walk[y] ?? "";
    for (let x = 0; x < width; x += 1) passability[y * width + x] = row[x] === "1" ? OPEN : CLOSED;
  }
  return {
    id, name, image: { type: "uploaded", id: assetId }, kind: "custom", family: "worldmap-kit",
    tileSize: TILE, tilesPerRow: width, count, passability,
    priority: new Array(count).fill("lower"), terrain: new Array(count).fill(0),
  };
}

function applyWorldmap(
  draft: Project, mapId: MapId, name: string | undefined, request: WorldmapBuildRequest,
  result: Extract<WorldmapBuildResult, { ok: true }>,
): { created: boolean; strandedEvents: string[] } {
  const { world } = result;
  const tilesetId = `worldmap_${mapId}` as TilesetId;
  const assetId = `worldmap_${mapId}_image`;
  const existing = draft.maps[mapId];
  if (existing && !existing.worldmapSource) {
    throw new ToolError(`맵 ${mapId} 은 월드맵 키트 지도가 아니다 — 새 mapId 를 주거나 mapId 를 비워 새 세계 지도를 만들어라.`, { code: "not-worldmap" });
  }
  const mapName = name ?? existing?.name ?? "세계 지도";
  draft.assets.uploaded[assetId] = {
    id: assetId, name: `${mapName} 지도 그림`, kind: "tileset", dataUrl: result.imageDataUrl,
    meta: { tileSize: TILE, width: world.width * TILE, height: world.height * TILE },
  };
  draft.tilesets[tilesetId] = worldmapTileset(tilesetId, assetId, `${mapName} (월드맵 키트)`, world.walk, world.width, world.height);
  const size = world.width * world.height;
  const lowerTiles = Array.from({ length: size }, (_, i) => i);
  const locations: MapNamedLocation[] = world.places.map((p, i) => ({
    id: slug(p.id, i), name: p.id, x: p.x, y: p.y, w: p.w, h: p.h, tags: [p.role, `act${p.act}`], note: `월드맵 장소(${p.role}, ${p.act + 1}막)`,
  }));
  const strandedEvents: string[] = [];
  const events = existing?.events ?? [];
  for (const event of events) {
    const row = world.walk[event.y] ?? "";
    if (row[event.x] !== "1") strandedEvents.push(`${event.name ?? event.id}(${event.x},${event.y})`);
  }
  const map: GameMap = {
    ...(existing ?? { events: [] as GameMap["events"] }),
    id: mapId, name: mapName, width: world.width, height: world.height, tilesetId, tileSize: TILE,
    lowerTiles, upperTiles: new Array<number>(size).fill(-1),
    locations,
    worldmapSource: { theme: request.theme, ops: request.terrain?.ops ?? [], terrainId: world.terrain, palette: world.palette },
  } as GameMap;
  delete (map as Partial<GameMap>).lowerOverlayTiles;
  delete (map as Partial<GameMap>).upperOverlayTiles;
  delete (map as Partial<GameMap>).shadowBits;
  draft.maps[mapId] = map;
  if (!existing) {
    if (!draft.maps[draft.mapTree.mapId]) draft.mapTree = { mapId, children: [] };
    else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some(child => child.mapId === mapId)) {
      draft.mapTree.children.push({ mapId, children: [] });
    }
  }
  return { created: !existing, strandedEvents };
}

const readWorldTerrain: ToolDefinition = {
  name: "read_world_terrain",
  description:
    "세계 지도(월드맵 키트 96×72칸)의 지형을 읽는다 — 칸 글자 지도(첫 줄이 범례: ~ 바다 . 초원 s 사막 ^ 산 * 숲 = 길 @ 장소 …), 장소 목록(id·역할·칸), 지금까지 쌓인 지형 작업(ops), "
    + "여정 도달성 검사, 도식 그림. mapId 가 월드맵 키트 지도면 그 원본을, 없으면 theme 의 기본 지형을 읽는다. "
    + "ops 를 주면 그 작업을 얹은 결과를 저장하지 않고 미리 본다(몇 초). edit_world_terrain 전에 좌표를 고르려고 부른다.",
  mode: "read",
  domains: ["map", "world"],
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      mapId: { type: "string", description: "월드맵 키트 지도 id(edit_world_terrain 이 만든 맵)" },
      theme: { type: "string", enum: [...WORLDMAP_THEMES], description: "세계관 테마(mapId 가 없을 때, 기본 fantasy)" },
      ops: { type: "array", items: opSchema, description: "미리 볼 작업 목록(쌓인 작업 대신 이것으로 본다)" },
    },
  },
  async prepare(args, project): Promise<void> {
    await prepareRequest(readRequest(args, mapOf(project, args)));
  },
  run(project, args): ToolExecResult {
    const map = mapOf(project, args);
    const request = readRequest(args, map);
    const result = resultFor(request);
    lastImage.set("read_world_terrain", result.imageDataUrl);
    return {
      summary: `세계 지형 ${result.world.terrain}(${request.theme}) — 장소 ${result.world.places.length}곳, 여정 검사 ${result.journeyCheck?.ok === false ? "불일치" : "통과"}`,
      data: {
        theme: request.theme, mapId: map?.id ?? null, ops: request.terrain?.ops ?? [],
        ascii: result.ascii, places: placesSummary(result), journeyCheck: result.journeyCheck, warnings: result.warnings,
        help: OP_HELP,
      },
    };
  },
};

const editWorldTerrain: ToolDefinition = {
  name: "edit_world_terrain",
  description:
    "세계 지도의 지형 자체를 바꾼다 — 대륙을 바다로 갈라 섬나라로, 섬을 더하고, 산줄기·고개·강·숲·고원을 놓고, 지역의 바닥(사막·설원·늪…)을 바꾸고, 장소를 옮긴다. "
    + "월드맵 키트(테마 17종: 판타지·우주·현대·스팀펑크·조선…)가 같은 화풍으로 다시 그리고 여정 도달성(걸어서·배·사막선·비공정)을 검사한다. "
    + "mapId 가 기존 월드맵 키트 지도면 거기 쌓인 작업 뒤에 ops 를 잇는다(replace=true 면 ops 로 갈아 끼운다). mapId 가 없으면 새 세계 지도 맵을 만든다. "
    + "좌표는 먼저 read_world_terrain 의 글자 지도로 고른다. 장소 발자국이 물이 되거나 길이 막히면 실패하고 이유를 돌려준다 — 그 문장대로 작업을 고쳐 다시 부른다. "
    + "preview=true 는 저장하지 않고 몇 초 만에 도식 그림만 본다. 실제 빌드는 지형이 바뀌면 2분 남짓 걸린다. "
    + OP_HELP,
  mode: "write",
  domains: ["map", "world"],
  preservesAuthoredRaster: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["ops"],
    properties: {
      mapId: { type: "string", description: "고칠 월드맵 키트 지도 id. 없으면 새 맵(아래 newMapId)" },
      newMapId: { type: "string", description: "새로 만들 맵 id(mapId 가 없을 때, 생략 시 world_map)" },
      name: { type: "string", description: "맵 이름(새 맵 기본 「세계 지도」)" },
      theme: { type: "string", enum: [...WORLDMAP_THEMES], description: "세계관 테마(기존 지도는 그 테마, 새 지도는 fantasy)" },
      ops: { type: "array", items: opSchema, description: "더할 지형 작업(차례대로). 테마만 바꾸려면 빈 배열" },
      replace: { type: "boolean", description: "true 면 쌓인 작업을 버리고 ops 만으로" },
      preview: { type: "boolean", description: "true 면 저장하지 않고 도식 그림·검사만" },
    },
  },
  invalidArgsExample: { ops: [{ op: "sea", poly: [[58, 30], [80, 29], [80, 32], [58, 33]], note: "동대륙을 두 섬으로" }] },
  async prepare(args, project): Promise<void> {
    await prepareRequest(editRequest(args, mapOf(project, args)));
  },
  run(draft, args): ToolExecResult {
    const map = mapOf(draft, args);
    if (typeof args.mapId === "string" && args.mapId && !map) {
      throw new ToolError(`맵을 찾을 수 없다: ${args.mapId}`, { code: "map-not-found" });
    }
    const request = editRequest(args, map);
    const result = resultFor(request);
    lastImage.set("edit_world_terrain", result.imageDataUrl);
    const base = {
      theme: request.theme, ops: request.terrain?.ops ?? [], ascii: result.ascii, places: placesSummary(result),
      journeyCheck: result.journeyCheck, warnings: result.warnings, seconds: result.seconds,
    };
    if (result.journeyCheck && !result.journeyCheck.ok) {
      throw new ToolError(`여정 도달성 검사 불일치 — 지도는 저장하지 않았다:\n${result.journeyCheck.bad.join("\n")}\n작업을 고쳐 다시 부르라.`, { code: "journey-check-failed" });
    }
    if (request.preview) {
      return { summary: `미리보기(저장 안 함, ${result.seconds}초) — 작업 ${base.ops.length}개, 여정 검사 통과`, data: { preview: true, ...base } };
    }
    const mapId = (map?.id ?? (typeof args.newMapId === "string" && args.newMapId ? args.newMapId : "world_map")) as MapId;
    if (!map && draft.maps[mapId] && !draft.maps[mapId]!.worldmapSource) {
      throw new ToolError(`맵 id ${mapId} 가 이미 다른 맵이다 — newMapId 를 바꿔라.`, { code: "map-id-taken" });
    }
    const { created, strandedEvents } = applyWorldmap(draft, mapId, typeof args.name === "string" ? args.name : undefined, request, result);
    const warnings = [
      ...result.warnings,
      ...(strandedEvents.length ? [`걸을 수 없는 칸에 놓인 이벤트 ${strandedEvents.length}개: ${strandedEvents.slice(0, 8).join(", ")} — 옮겨야 한다`] : []),
    ];
    return {
      summary: `${created ? "새 세계 지도" : "세계 지도"} ${mapId} — 테마 ${request.theme}, 지형 작업 ${base.ops.length}개, 장소 ${result.world.places.length}곳, 여정 검사 통과(${result.seconds}초)`,
      data: { mapId, created, tilesetId: `worldmap_${mapId}`, ...base },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const WORLD_TERRAIN_TOOLS: readonly ToolDefinition[] = [readWorldTerrain, editWorldTerrain];

/** 조수가 방금 빌드한 지도(미리보기면 도식)를 눈으로 보게 한다. */
export function worldTerrainImages(toolName: string): { dataUrl: string; label: string }[] {
  const dataUrl = lastImage.get(toolName);
  return dataUrl ? [{ dataUrl, label: toolName === "read_world_terrain" ? "세계 지형 도식" : "세계 지도" }] : [];
}
