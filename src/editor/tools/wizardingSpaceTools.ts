// 마법 학교(해리포터풍, wizarding_world) 공간 빌더 도구 — 조수가 이 칩셋으로 실제 게임 맵 한 장(방·야외)을 한 번에 짓는다.
//   list_wizarding_spaces  : 13공간 레시피(크기·바닥·벽·문·가구 키트·NPC 걷기 칩 추천)
//   build_wizarding_space  : 공간 하나 → 벽 고리·바닥·러너·가구·덧그림을 결정론으로 짓고, 엔진 통행으로 한 덩이·출입구 도달을 검사한다.
//                            오류가 하나라도 있으면 맵을 바꾸지 않는다. 새 맵은 create_map 경로로 만든다(맵 트리·BGM·시작 맵 규칙 그대로).
// 조립 규칙은 src/editor/wizarding/builder.ts(순수 함수), 레시피는 src/assets/wizardingSpaceSpec.json(scripts/content/wizarding/space_recipes.py).
import {
  buildWizardingSpace, resolveWizardingRecipe, WIZARDING_ISSUE_CODES, WIZARDING_SPACE_KEYS, WIZARDING_SPACE_SPEC as SPEC,
  type WizardingDoorInput, type WizardingFurnitureInput, type WizardingSpaceInput,
} from "@/editor/wizarding/builder";
import { createWizardingWorldTileset, ensureWizardingWorldTileset, isWizardingWorldTileset, WIZARDING_WORLD_ID } from "@/project/defaults/wizardingWorld";
import type { GameMap, Project } from "@/project/types";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DENSITY = ["sparse", "normal", "full"] as const;
const FURNITURE_MODES = ["auto", "none", "list"] as const;
const spacesLine = (): string => WIZARDING_SPACE_KEYS.map((k) => `${k}=${SPEC.spaces[k]!.ko}`).join(" · ");

function pieceName(id: string): string { return SPEC.pieces[id]?.name ?? id; }

/** 프로젝트에 wizarding_world 가 없으면 번들 정의로 만들고, 옛 굽기 사본이면 칸 표를 맞춘다. */
function ensureTileset(draft: Project) {
  if (!draft.tilesets[WIZARDING_WORLD_ID]) draft.tilesets[WIZARDING_WORLD_ID] = createWizardingWorldTileset();
  else ensureWizardingWorldTileset(draft.tilesets[WIZARDING_WORLD_ID]!);
  const ts = draft.tilesets[WIZARDING_WORLD_ID]!;
  if (!isWizardingWorldTileset(ts)) throw new ToolError(`타일셋 ${WIZARDING_WORLD_ID} 이 번들 마법 학교 시트가 아니다`, { code: "tileset-not-found" });
  return ts;
}

/** 아직 아무것도 그리지 않은 맵(create_map 직후처럼 1층 한 가지·위층·이벤트 없음). */
function isBlankMap(map: GameMap): boolean {
  if ((map.events ?? []).length) return false;
  const first = map.lowerTiles[0];
  if (map.lowerTiles.some((t) => t !== first)) return false;
  for (const layer of [map.upperTiles, map.lowerOverlayTiles ?? [], map.upperOverlayTiles ?? []]) if (layer.some((t) => t >= 0)) return false;
  return true;
}

// ───────────────────────────── 읽기 도구
export const LIST_WIZARDING_SPACES_TOOL: ToolDefinition = {
  name: "list_wizarding_spaces",
  mode: "read",
  domains: ["tile", "map"],
  description: "마법 학교·해리포터풍(wizarding_world) 공간 레시피 — build_wizarding_space 에 넣는 space·variant·가구 kit id 를 찾는다. "
    + "인자 없이 → 13공간의 이름·실내/야외·크기(최소·기본·최대)·기본 문·변형 목록. space 를 주면 → 그 공간의 벽 묶음·문 종류·바닥·가구 키트(놓는 자리·개수·크기·이름)·덧그림·NPC 걷기 칩 추천(place_npc graphic 에 textureKey·characterIndex 로 넣는다).",
  parameters: {
    type: "object",
    properties: {
      space: { type: "string", enum: [...WIZARDING_SPACE_KEYS], description: "공간 키" },
      variant: { type: "string", description: "변형(shared 만: corridor·common·dorm). 생략하면 기본" },
    },
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const space = typeof args.space === "string" ? args.space : "";
    if (!space) {
      return {
        summary: `마법 학교 공간 ${WIZARDING_SPACE_KEYS.length}종 — ${spacesLine()}. space 를 주면 가구 키트·NPC 추천까지 준다.`,
        data: {
          tilesetId: WIZARDING_WORLD_ID,
          spaces: WIZARDING_SPACE_KEYS.map((k) => {
            const r = SPEC.spaces[k]!;
            return { space: k, ko: r.ko, indoor: r.indoor, layout: r.layout, size: r.size, defaultDoors: r.defaultDoors,
              variants: Object.entries(r.variants ?? {}).map(([id, v]) => ({ id, ko: v.ko, size: v.size })) };
          }),
        },
      };
    }
    const resolved = resolveWizardingRecipe(space, typeof args.variant === "string" && args.variant ? args.variant : undefined);
    if (!resolved) throw new ToolError(`공간 ${space} 에 변형 ${String(args.variant)} 이 없다 — ${Object.keys(SPEC.spaces[space]?.variants ?? {}).join(", ") || "변형 없음"}`, { code: "UNKNOWN_VARIANT" });
    const r = resolved.recipe;
    const ws = r.wall ? SPEC.wallsets[r.wall] : undefined;
    const doorKinds = r.layout === "room"
      ? { n: { single: r.doors?.door1 ?? ws?.door1 ?? null, double: r.doors?.door2 ?? ws?.door2 ?? (r.doors?.door1 ?? ws?.door1 ? "single 두 개" : null) }, s: ws?.doorS ?? "벽 틈", e: "벽 틈", w: "벽 틈" }
      : r.layout === "lake" ? { n: "땅 가장자리", s: "부두가 맵 끝까지 이어진다", e: "땅 가장자리(위쪽 땅 줄)", w: "땅 가장자리(위쪽 땅 줄)" }
        : { n: "길 끝", s: "길 끝", e: "길 끝", w: "길 끝" };
    return {
      summary: `${r.ko}(${space}${resolved.variant ? `/${resolved.variant}` : ""}) — ${r.indoor ? "실내" : "야외"} ${r.size.default.join("×")}(최소 ${r.size.min.join("×")}, 최대 ${r.size.max.join("×")}), 가구 ${r.furniture.length}종, NPC 추천 ${r.npcs.length}명`,
      data: {
        tilesetId: WIZARDING_WORLD_ID, space, variant: resolved.variant, ko: r.ko, indoor: r.indoor, layout: r.layout, size: r.size,
        wall: ws ? { id: r.wall, ko: ws.ko, northRows: ws.northRows, southRows: ws.southRows } : null,
        floor: r.floor, runner: r.runner ?? null, doors: doorKinds, defaultDoors: r.defaultDoors,
        furniture: r.furniture.map((f) => ({ kit: f.kit, name: pieceName(f.kit), w: SPEC.pieces[f.kit]?.w, h: SPEC.pieces[f.kit]?.h, placement: f.placement, count: f.count,
          clearance: f.clearance, ...(f.wallTop !== undefined ? { wallTop: f.wallTop } : {}), ...(f.on ? { on: f.on } : {}),
          ...(f.with?.length ? { with: f.with.map((w) => `${w.kit}@${w.dx},${w.dy}`) } : {}) })),
        decals: r.decals.map((d) => ({ kit: d.kit, name: pieceName(d.kit) })),
        npcs: r.npcs,
        variants: Object.keys(SPEC.spaces[space]?.variants ?? {}),
      },
    };
  },
};

// ───────────────────────────── 쓰기 도구
const DOOR_ITEM = {
  type: "object",
  properties: {
    side: { type: "string", enum: ["n", "s", "e", "w"], description: "벽(변): n 북 · s 남 · e 동 · w 서" },
    offset: { type: "integer", minimum: 0, description: "문 왼쪽(n·s) 또는 위쪽(e·w) 칸의 맵 좌표. 생략하면 그 변 가운데(같은 변에 여럿이면 고르게)" },
    kind: { type: "string", enum: ["single", "double"], description: "1칸 문 · 2칸 문(기본 single)" },
  },
  required: ["side"],
  additionalProperties: false,
} as const;
const FURNITURE_ITEM = {
  type: "object",
  properties: {
    kit: { type: "string", description: "가구 키트 id(list_wizarding_spaces 의 furniture[].kit, 또는 다른 wz- 키트)" },
    x: { type: "integer", minimum: 0, description: "키트 왼쪽 위 칸 x(y 와 함께. 생략하면 자동 자리)" },
    y: { type: "integer", minimum: 0, description: "키트 왼쪽 위 칸 y. 북벽 줄(0~3)이면 벽에 거는 물건" },
  },
  required: ["kit"],
  additionalProperties: false,
} as const;

export const BUILD_WIZARDING_SPACE_TOOL: ToolDefinition = {
  name: "build_wizarding_space",
  mode: "write",
  domains: ["tile", "map"],
  description: "해리포터풍·마법 학교(호그와트풍) 맵을 짓는 길 — 번들 칩셋 wizarding_world 로 방·야외 한 장을 한 번에 짓는다(벽 고리·문·바닥·러너·가구·덧그림 자동, 결정론 seed). "
    + `space: ${spacesLine()}. shared 는 variant corridor(복도 10×22)·common(기숙사 휴게실)·dorm(기숙사 침실 — 사주식 침대 줄·트렁크·옷장·거울). `
    + "mapId 가 비어 있는 맵이면 칩셋을 wizarding_world 로 바꿔 그 맵에 짓고, 이미 그린 맵이면 overwrite:true 가 있어야 다시 짓는다. mapId 없이 name 을 주면 새 맵을 만든다. "
    + "doors=[{side:n|s|e|w, offset?, kind?:single|double}](생략하면 공간 기본 출입구), furnitureMode auto(레시피 가구, furniture 를 먼저 놓는다)·list(furniture 만)·none, density sparse|normal|full. "
    + "가구는 놓을 때마다 엔진 통행으로 검사해 바닥이 갈리거나 문 앞을 막거나 앞 가구에 못 가게 하면 버린다. 결과의 doorCells 에 이동 이벤트(transfer)를, spawn 에 도착 지점을 쓴다. "
    + "오류가 있으면 맵을 바꾸지 않는다. 가구 id·NPC 걷기 칩은 list_wizarding_spaces({space}) 로 먼저 본다. 이 칩셋 맵을 낱칸 칠하기로 처음부터 그리지 않는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "지을 맵 id. 없는 id 면 그 id 로 새 맵, 생략하면 새 id" },
      name: { type: "string", description: "새 맵 이름(생략하면 공간 이름)" },
      overwrite: { type: "boolean", description: "이미 그린 맵을 통째로 다시 짓기(이벤트는 맵 안에 남는 것만 둔다)" },
      space: { type: "string", enum: [...WIZARDING_SPACE_KEYS], description: "공간 키" },
      variant: { type: "string", description: "변형(shared: corridor·common·dorm). 생략하면 기본" },
      width: { type: "integer", minimum: 8, maximum: 64, description: "맵 폭(생략하면 공간 기본)" },
      height: { type: "integer", minimum: 12, maximum: 48, description: "맵 높이(생략하면 공간 기본 크기로 짓고, 실내는 가구가 끝나는 줄 아래 통로 3줄만 남기고 줄인다 — 빈 바닥을 남기지 않는다)" },
      doors: { type: "array", items: DOOR_ITEM, description: "출입구. 첫 문이 주 출입구(시작 칸·러너 기준)" },
      furnitureMode: { type: "string", enum: [...FURNITURE_MODES], description: "auto 레시피 가구(기본) · list furniture 만 · none 가구 없음" },
      furniture: { type: "array", items: FURNITURE_ITEM, description: "놓을 가구(좌표를 주면 그 자리, 아니면 자동 자리)" },
      density: { type: "string", enum: [...DENSITY], description: "가구 양(기본 normal)" },
      seed: { type: "integer", description: "배치 시드(같은 시드 = 같은 결과, 기본 1)" },
    },
    required: ["space"],
    additionalProperties: false,
  },
  invalidArgsExample: { name: "마법약 교실", space: "potions", doors: [{ side: "s" }], density: "normal", seed: 2 },
  run(draft, args): ToolExecResult {
    const space = typeof args.space === "string" ? args.space : "";
    if (!SPEC.spaces[space]) throw new ToolError(`space "${space}" 이 없다 — ${spacesLine()}`, { code: "UNKNOWN_SPACE" });
    const tileset = ensureTileset(draft);
    const input: WizardingSpaceInput = {
      space,
      ...(typeof args.variant === "string" && args.variant ? { variant: args.variant } : {}),
      ...(typeof args.width === "number" ? { width: args.width } : {}),
      ...(typeof args.height === "number" ? { height: args.height } : {}),
      ...(Array.isArray(args.doors) ? { doors: args.doors as WizardingDoorInput[] } : {}),
      ...(typeof args.furnitureMode === "string" ? { furnitureMode: args.furnitureMode as WizardingSpaceInput["furnitureMode"] } : {}),
      ...(Array.isArray(args.furniture) ? { furniture: args.furniture as WizardingFurnitureInput[] } : {}),
      ...(typeof args.density === "string" ? { density: args.density as WizardingSpaceInput["density"] } : {}),
      ...(typeof args.seed === "number" ? { seed: args.seed } : {}),
    };
    // 맵 대상 결정(아직 아무것도 쓰지 않는다)
    const wantId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    const existing = wantId ? draft.maps[wantId] : undefined;
    if (existing && !isBlankMap(existing) && args.overwrite !== true) {
      throw new ToolError(`맵 '${existing.name}'(${wantId}) 에 이미 그린 것이 있다(칩셋 ${existing.tilesetId}) — 통째로 다시 지으려면 overwrite:true, 아니면 mapId 를 빼고 name 으로 새 맵을 만든다`, { code: "map-not-empty", mapId: wantId });
    }
    const built = buildWizardingSpace(input, tileset);
    const errors = built.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      const e0 = errors[0]!;
      throw new ToolError(`마법 학교 공간을 짓지 않았다 — 오류 ${errors.length}건: ${errors.slice(0, 6).map((e) => `${e.code} ${e.message}`).join(" / ")}${errors.length > 6 ? " …" : ""}`,
        { code: e0.code, ...(wantId ? { mapId: wantId } : {}), ...(e0.x !== undefined ? { x: e0.x, y: e0.y } : {}) });
    }
    // 새 맵은 create_map 경로로(맵 트리·BGM·시작 맵 채택)
    let mapId = wantId;
    let created = false;
    if (!existing) {
      const createMap = MAP_TOOLS.find((t) => t.name === "create_map");
      if (!createMap?.run) throw new ToolError("create_map 도구를 찾지 못했다", { code: "internal" });
      const res = createMap.run(draft, { name: typeof args.name === "string" && args.name.trim() ? args.name.trim() : built.ko, width: built.width, height: built.height,
        tilesetId: WIZARDING_WORLD_ID, ...(wantId ? { id: wantId } : {}) }) as ToolExecResult;
      mapId = (res.data as { mapId: string }).mapId;
      created = true;
    }
    const map = draft.maps[mapId]!;
    const W = built.width, H = built.height;
    const keptEvents = (map.events ?? []).filter((e) => e.x >= 0 && e.y >= 0 && e.x < W && e.y < H);
    const droppedEvents = (map.events ?? []).length - keptEvents.length;
    const next: GameMap = {
      ...map,
      ...(typeof args.name === "string" && args.name.trim() && !created ? { name: args.name.trim() } : {}),
      width: W, height: H, tilesetId: WIZARDING_WORLD_ID, tileSize: tileset.tileSize,
      lowerTiles: built.lowerTiles, upperTiles: built.upperTiles, lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles,
      events: keptEvents,
      ...(built.indoor ? { climate: { mode: "indoor" } } : {}),
    } as GameMap;
    for (const k of ["lowerTileStacks", "upperTileStacks", "shadowBits", "relief", "terrainDesign", "doodadGroups", "visualTopOverhangPx", "worldmapSource"] as const) delete (next as Partial<GameMap>)[k];
    draft.maps[mapId] = next;
    // 시작 맵을 다시 지으면 옛 시작 칸이 벽·가구 밑이 될 수 있다(실측: 커밋 무결성 거부) — 시작 맵이면 늘 새 spawn 으로 옮긴다.
    if (draft.startMapId === mapId) draft.startPos = { x: built.spawn.x, y: built.spawn.y };

    const warnings = built.issues.filter((i) => i.severity === "warning").map((i) => i.message);
    if (droppedEvents) warnings.push(`맵 밖으로 나간 이벤트 ${droppedEvents}개를 지웠다`);
    // 문 앞 접근 칸 — 여기에 NPC·이벤트를 세우면 1칸 문으로 가는 길이 막힌다(실측: 교수 NPC 를 문 바로 앞에 세워 자동 플레이가 막힘).
    const step = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] } as const;
    const keepClear = built.doorCells.flatMap((d) => [1, 2].map((k) => ({ x: d.x + step[d.side][0] * k, y: d.y + step[d.side][1] * k })))
      .filter((c) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H);
    const keepText = keepClear.map((c) => `(${c.x},${c.y})`).join(" ");
    const npcLine = (resolveWizardingRecipe(space, input.variant)?.recipe.npcs ?? []).slice(0, 4).map((n) => n.name).join("·") || "없음";
    const furniture = built.placed.filter((p) => p.role === "furniture").map((p) => ({ kit: p.kit, x: p.x, y: p.y }));
    const doorText = built.doorCells.map((d) => `${d.side}(${d.x},${d.y})`).join(" ");
    return {
      summary: `${built.ko} ${W}×${H} 를 ${created ? "새 맵" : "맵"} '${next.name}'(${mapId}, ${WIZARDING_WORLD_ID}) 에 지었다 — 출입구 ${doorText}, 시작 칸 (${built.spawn.x},${built.spawn.y}), 걸어 닿는 칸 ${built.walkableCount}(한 덩이), 가구 ${furniture.length}개`
        + `${warnings.length ? ` · 경고 ${warnings.length}: ${warnings.slice(0, 3).join(" / ")}` : ""}. 다음: doorCells 에 이동 이벤트(transfer)를 달고(문 앞 ${keepText} 는 비워 둔다 — NPC·물건 이벤트를 세우면 길이 막힌다), NPC 는 list_npc_graphics({query:'마법약 교수'·'호그와트 학생'·'사서' 같은 역할}) 로 Wizarding 걷기 칩 그림을 본 뒤 그 selectionId 로 place_npc(추천 칩: ${npcLine}).`,
      data: {
        mapId, created, tilesetId: WIZARDING_WORLD_ID, space, variant: built.variant, width: W, height: H,
        doorCells: built.doorCells, keepClear, spawn: built.spawn, placed: furniture,
        walkability: { walkableCount: built.walkableCount, components: built.components, ignoredPockets: built.pockets },
        npcSuggestions: (resolveWizardingRecipe(space, input.variant)?.recipe.npcs ?? []).slice(0, 4),
        warnings, errorCodes: WIZARDING_ISSUE_CODES,
      },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const WIZARDING_SPACE_TOOLS: readonly ToolDefinition[] = [LIST_WIZARDING_SPACES_TOOL, BUILD_WIZARDING_SPACE_TOOL];
