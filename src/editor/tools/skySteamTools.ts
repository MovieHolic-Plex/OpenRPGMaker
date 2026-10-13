// compose_sky_steam — 하늘섬·증기 도시(sky_steam) 맵 한 장을 종류·씨앗으로 짠다(src/project/skySteamComposer.ts).
// 견본을 붙이는 것이 아니라 땅 → 길·선로·관·갑판 → 건물 → 소품 무리를 규칙으로 엮고, 구조 검사(문 앞·밑땅·층·이어짐)를 통과한 배치만 쓴다.
// 맵이 없거나 지금 보는 맵이 손대지 않은 빈 맵이면 그 맵을 sky_steam 으로 바꿔 쓰고, 손댄 다른 칩셋 맵이면 새 맵을 만든다(계열 승인은 실행기가 따로 본다).
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { isSkySteamTileset, SKY_STEAM_FAMILY, SKY_STEAM_ID } from "@/project/defaults/skySteam";
import { setLayerTileAt } from "@/project/mapLayers";
import { addMapLocation } from "@/project/mapNamedLocations";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { composeSkySteam, SKY_STEAM_DEFAULT_SIZE, SKY_STEAM_KIND_LABEL, SKY_STEAM_KINDS, SKY_STEAM_MIN_SIZE, type SkySteamKind } from "@/project/skySteamComposer";
import type { GameMap, Project } from "@/project/types";
import { genId } from "@/util/id";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

function blankMap(id: string, name: string, w: number, h: number, draft: Project): GameMap {
  const t = draft.tilesets[SKY_STEAM_ID]!;
  return { id, name, width: w, height: h, tilesetId: SKY_STEAM_ID, tileSize: t.tileSize,
    lowerTiles: new Array<number>(w * h).fill(blankFillTileFor(SKY_STEAM_ID, 0, t)), upperTiles: new Array<number>(w * h).fill(-1), events: [] };
}

/** 손대지 않은 맵을 sky_steam 빈 맵(새 크기)으로 — 이름·이벤트·BGM 등은 남기고, 크기에 묶인 층·그림자·높이·칸 겹은 버린다. */
function reshaped(old: GameMap, w: number, h: number, draft: Project): GameMap {
  const { lowerOverlayTiles: _a, upperOverlayTiles: _b, shadowBits: _c, relief: _d, lowerTileStacks: _e, upperTileStacks: _f, ...rest } = old;
  const keep = old.width === w && old.height === h ? old.events : old.events.filter((e) => e.x < w && e.y < h);
  return { ...rest, ...blankMap(old.id, old.name, w, h, draft), events: keep };
}

function walkableAt(draft: Project, map: GameMap, i: number): boolean {
  const t = draft.tilesets[map.tilesetId]!;
  const u = map.upperTiles[i] ?? -1;
  if (u >= 0) {
    const p = (t.tileMeta?.[u] as { passage?: string } | undefined)?.passage ?? (t.passability[u]?.up ? "passable" : "solid");
    if (p === "solid") return false;
    if (p === "passable") return true;
  }
  const lo = map.lowerTiles[i] ?? -1;
  return lo >= 0 && !!t.passability[lo]?.up;
}

/** 막힌 칸 위 이벤트를 가장 가까운 걷는 칸으로 옮긴다. 옮긴 수를 돌려준다. */
function relocateEvents(draft: Project, map: GameMap): number {
  let moved = 0;
  const taken = new Set(map.events.map((e) => e.y * map.width + e.x));
  for (const ev of map.events) {
    const i0 = ev.y * map.width + ev.x;
    if (ev.x >= 0 && ev.y >= 0 && ev.x < map.width && ev.y < map.height && walkableAt(draft, map, i0)) continue;
    const sx = Math.min(map.width - 1, Math.max(0, ev.x)), sy = Math.min(map.height - 1, Math.max(0, ev.y));
    const seen = new Set([sy * map.width + sx]); const q = [sy * map.width + sx];
    while (q.length) {
      const i = q.shift()!;
      if (walkableAt(draft, map, i) && !taken.has(i)) { taken.delete(i0); taken.add(i); ev.x = i % map.width; ev.y = Math.floor(i / map.width); moved++; break; }
      const x = i % map.width, y = Math.floor(i / map.width);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const j = ny * map.width + nx;
        if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !seen.has(j)) { seen.add(j); q.push(j); }
      }
    }
  }
  return moved;
}

/** 종류마다 일부러 비워 둔 칸 — 빈 바닥 경고가 나와도 채우지 않는다. */
const CLEAR_NOTE: Readonly<Record<SkySteamKind, string>> = {
  street: "차도·전차 선로 줄과 건물 바로 아래 보도 줄(문 앞)은 일부러 비운 동선이다.",
  yard: "선로 줄과 공장 문 앞 줄은 일부러 비운 동선이다.",
  dock: "구름 바다는 배경이고, 갑판 가운데 통로·다리 줄·격납고 문 앞은 일부러 비운 동선이다.",
  island: "구름 바다는 배경이고, 섬 맨 아래 풀 줄은 다리와 문 앞을 잇는 길이라 비워 둔다.",
  workshop: "문 열(가운데 세로 줄)과 맨 아래 줄은 일부러 비운 통로다.",
  boiler: "문 열(가운데 세로 줄)과 맨 아래 줄은 일부러 비운 통로다.",
  inn: "문 열(가운데 세로 줄)과 맨 아래 줄은 일부러 비운 통로다.",
};

export const COMPOSE_SKY_STEAM_TOOL: ToolDefinition = {
  name: "compose_sky_steam",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "하늘섬·증기 도시(스팀펑크, sky_steam 칩셋) 맵 한 장을 통째로 짠다 — 땅 한 재질 → 차도·선로·관·갑판 → 건물(문 앞 접근칸 보장) → 가스등·소품 무리를 규칙으로 배치하고, "
    + "구조 검사(문 앞 막힘·건물 밑 구름·층 어긋남·문끼리 이어짐)를 통과한 배치만 쓴다. 씨앗마다 다른 맵. "
    + "kind: street(증기 도시 거리: 공동주택·여관·시계탑·전차) | yard(공장 마당: 굴뚝·가스 탱크·석탄 선로·기중기) | dock(비공정 부두: 갑판·격납고·계류탑·비공정 + 다리로 이은 하늘섬) | "
    + "island(하늘섬 마을: 구름 바다 위 섬 여럿·다리·풍차·집) | workshop(공방 실내) | boiler(보일러실·기관실 실내) | inn(여관 1층 실내). "
    + "지금 보는 맵이 sky_steam 이면 그 맵에, 손대지 않은 빈 맵이면 그 맵을 sky_steam 으로 바꿔, 아니면 새 맵을 만들어 짠다(newMap:true 면 늘 새 맵 — 실내를 따로 만들 때). "
    + "손댄 sky_steam 맵은 replace:true 여야 다시 짠다(이벤트는 남기고, 막힌 칸 위 이벤트는 옮긴다). 짠 뒤 건물 문 앞 칸은 list_map_locations 의 이름표에 있다 — 실내 맵을 compose_sky_steam(kind:inn 등, newMap:true)로 만들고 문 이벤트로 잇는다.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...SKY_STEAM_KINDS], description: "맵 종류" },
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵)" },
      seed: { type: "integer", minimum: 0, description: "씨앗 — 다른 값이면 다른 배치. 생략하면 0" },
      name: { type: "string", description: "새 맵을 만들 때 이름(생략하면 종류 이름)" },
      newMap: { type: "boolean", description: "지금 맵 대신 늘 새 sky_steam 맵을 만든다" },
      replace: { type: "boolean", description: "이미 칠한 sky_steam 맵을 지우고 다시 짠다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "street", seed: 3 },
  run(draft: Project, args): ToolExecResult {
    const kind = args.kind as SkySteamKind;
    if (!SKY_STEAM_KINDS.includes(kind)) throw new ToolError(`kind 는 ${SKY_STEAM_KINDS.join("|")} 중 하나다`, { code: "invalid-args" });
    const tileset = draft.tilesets[SKY_STEAM_ID];
    if (!tileset || !isSkySteamTileset(tileset)) throw new ToolError(`이 프로젝트에 하늘섬·증기 도시 칩셋(${SKY_STEAM_ID}, 계열 ${SKY_STEAM_FAMILY})이 없다 — 프로젝트를 다시 열면 번들 타일셋이 붙는다`, { code: "tileset-not-found" });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) && args.seed >= 0 ? args.seed : 0;
    const def = SKY_STEAM_DEFAULT_SIZE[kind], min = SKY_STEAM_MIN_SIZE[kind];
    const requested = typeof args.mapId === "string" && args.mapId.trim() ? draft.maps[args.mapId.trim()] : undefined;
    if (typeof args.mapId === "string" && args.mapId.trim() && !requested) throw new ToolError(`맵 ${args.mapId} 이 없다`, { code: "map-not-found" });

    const next = structuredClone(draft);
    let target: GameMap; let how: string;
    if (requested && args.newMap !== true && requested.tilesetId === SKY_STEAM_ID) {
      target = next.maps[requested.id]!;
      if (!isUntouched(target) && args.replace !== true) throw new ToolError(`맵 '${target.name}' 은 이미 칠했다 — 지우고 다시 짜려면 replace:true(이벤트는 남는다), 다른 맵이면 newMap:true`, { code: "map-not-blank", mapId: target.id });
      if (target.width < min.w || target.height < min.h) {
        if (!isUntouched(target)) throw new ToolError(`맵이 작다(${target.width}×${target.height}) — ${kind} 는 ${min.w}×${min.h} 이상. resize_map 한 뒤 부르거나 newMap:true`, { code: "map-too-small", mapId: target.id });
        target = next.maps[requested.id] = reshaped(target, def.w, def.h, next);
      }
      how = `맵 '${target.name}'(${target.id})에`;
    } else if (requested && args.newMap !== true && isUntouched(requested) && requested.events.length === 0) {
      // 손대지 않은 빈 맵(새 프로젝트 시작 맵 등)은 고아로 남기지 않고 그 자리에서 sky_steam 맵으로 바꾼다.
      target = next.maps[requested.id] = reshaped(next.maps[requested.id]!, def.w, def.h, next);
      how = `빈 맵 '${target.name}'(${target.id})을 sky_steam 칩셋 ${def.w}×${def.h} 로 바꿔`;
    } else {
      const id = genId("map");
      const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : SKY_STEAM_KIND_LABEL[kind];
      target = blankMap(id, name, def.w, def.h, next);
      next.maps[id] = target;
      if (!next.maps[next.mapTree.mapId]) next.mapTree = { mapId: id, children: [] };
      else next.mapTree.children.push({ mapId: id, children: [] });
      if (!next.maps[next.startMapId]) { next.startMapId = id; next.startPos = { x: Math.floor(def.w / 2), y: def.h - 2 }; }
      how = `새 맵 '${name}'(${id}, ${def.w}×${def.h})에`;
    }

    const plan = composeSkySteam(next.tilesets[SKY_STEAM_ID]!, kind, target.width, target.height, seed);
    if (plan.issues.length) {
      throw new ToolError(`배치가 구조 검사를 못 넘었다(${plan.issues.slice(0, 3).map((i) => `${i.code} (${i.x},${i.y}) ${i.message}`).join(" · ")}) — 다른 seed 를 주거나 맵을 ${def.w}×${def.h} 로 맞춘다`, { code: "compose-failed", mapId: target.id });
    }
    for (let i = 0; i < target.width * target.height; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    target.lowerTiles = [...plan.lower];
    target.upperTiles = [...plan.upper];
    const moved = relocateEvents(next, target);
    target.locations = (target.locations ?? []).filter((l) => !(l.tags ?? []).includes("sky-building") && !(l.tags ?? []).includes("sky-composed"));
    // 맵 전체 이름표 = 구성기가 짠 맵이라는 표시(종류·씨앗). 배치 품질 밀도 검사(layoutQuality)는 이 맵을 건너뛴다 — 차도·갑판 통로를 «빈 바닥»으로 세어 채우라고 하기 때문(r1 실측).
    addMapLocation(target, { name: `${SKY_STEAM_KIND_LABEL[kind]} 전체`, x: 0, y: 0, w: target.width, h: target.height,
      note: `compose_sky_steam kind:${kind} seed:${seed} 로 짠 맵 — 다른 배치는 seed 를 바꿔 replace:true`, tags: ["sky-composed", kind, `seed:${seed}`] });
    const kits = new Map((next.tilesets[SKY_STEAM_ID]!.structureKits ?? []).map((k) => [k.id, k.name] as const));
    const doors: string[] = [];
    for (const d of plan.doors) {
      const p = plan.placed.find((q) => q.kit === d.kit && q.x <= d.x && d.x < q.x + q.w && q.y + q.h === d.y);
      if (!p) continue;
      const name = (kits.get(d.kit) ?? d.kit).replace(/\s*\(.*$/u, "");
      const added = addMapLocation(target, { name, x: p.x, y: p.y, w: p.w, h: p.h, note: `문 앞 접근칸 (${d.x},${d.y}) — 실내는 compose_sky_steam(kind:inn|workshop|boiler, newMap:true) 로 만들어 이 칸의 문 이벤트로 잇는다`, tags: ["sky-building", d.kit] });
      if (added.ok) doors.push(`${name} (${d.x},${d.y})`);
    }
    // 시작 맵이면 시작점을 걷는 칸으로 — 하늘섬·부두 맵의 가운데는 구름일 수 있다.
    if (next.startMapId === target.id) {
      const sp = next.startPos ?? { x: 0, y: 0 };
      if (!(sp.x < target.width && sp.y < target.height && walkableAt(next, target, sp.y * target.width + sp.x))) {
        const door = plan.doors[0];
        if (door) next.startPos = { x: door.x, y: door.y };
        else { const i = target.lowerTiles.findIndex((_, j) => walkableAt(next, target, j)); if (i >= 0) next.startPos = { x: i % target.width, y: Math.floor(i / target.width) }; }
      }
    }
    draft.maps = next.maps; draft.mapTree = next.mapTree; draft.startMapId = next.startMapId; draft.startPos = next.startPos;
    return {
      summary: `${how} ${SKY_STEAM_KIND_LABEL[kind]}을(를) 짰다(seed ${seed}) — ${plan.summary}. 구조 검사 통과.`
        + (doors.length ? ` 건물 문 앞: ${doors.slice(0, 8).join(" · ")}${doors.length > 8 ? ` 외 ${doors.length - 8}` : ""}.` : "")
        + (moved ? ` 막힌 칸 위 이벤트 ${moved}개를 옆 칸으로 옮겼다.` : "")
        // 실시험 r1(2026-10-14): 「빈 바닥 비율」 경고를 본 조수가 paint_tiles 로 키트 칸 번호를 한 칸씩 차도 연석에 칠했다 — 비운 칸이 의도라는 것을 결과에 적는다.
        + ` ${CLEAR_NOTE[kind]} 소품을 더할 때는 stamp_object({objectId:"kit:sky_steam/<id>"}) 로 키트 통째로만 찍는다 — paint_tiles 로 키트 칸 번호를 한 칸씩 칠하지 않는다. 다른 배치가 필요하면 seed 를 바꿔 replace:true.`,
      data: { mapId: target.id, kind, seed, width: target.width, height: target.height, placed: plan.placed.length, doors: plan.doors },
    };
  },
};

export const SKY_STEAM_TOOLS: readonly ToolDefinition[] = [COMPOSE_SKY_STEAM_TOOL];
