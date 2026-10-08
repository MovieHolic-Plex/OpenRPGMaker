// 손 도트 실내 v5 도구 — 조수가 실내를 까는 유일한 경로(2026-09-29, 옛 실내 칩셋 폐기).
//   list_hand_interior_parts : 방 종류별 가구(예제 26맵) · 낱말 검색(설명·태그까지) · 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록
//   build_hand_interior_room : 평면 문자열 → 벽·천장 자동, 가구는 v5 물건 id → atlas_biome_interior 새 맵(또는 같은 칩셋 맵 다시 짓기)
//   두 도구 모두 tileset:"jp_city" 이면 일본 실내(jp_city 번들 안, 화실·LDK·욕실·현관)를 같은 규칙으로 짓는다.
// 조립 규칙은 src/editor/handInterior/builder.ts, 칸 사전은 src/assets/handInteriorSpec.json · jpInteriorSpec.json.
import { buildHandInteriorLayers, roomSpecOf, HAND_INTERIOR_SPEC, HAND_INTERIOR_SPECS, HAND_INTERIOR_TILESET_ID, JP_INTERIOR_SPEC, JP_INTERIOR_TILESET_ID, WIZARDING_INTERIOR_SPEC, WIZARDING_INTERIOR_TILESET_ID, HandInteriorError, type HandInteriorInput, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomIndex, roomParts, searchParts, fullRow, shortRow } from "@/editor/handInterior/parts";
import { handInteriorShapeFromPlan, nearestOpening, PLAIN_BOX_MIN_CELLS, type HandInteriorShape } from "@/editor/handInterior/shape";
import { createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { createJpCityTileset, ensureJpCityTileset } from "@/project/defaults/jpCity";
import { createWizardingWorldTileset, ensureWizardingWorldTileset } from "@/project/defaults/wizardingWorld";
import { kitHandObjects } from "@/project/roomKit";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { workshopHandObjects } from "@/project/workshopTiles";
import { referenceOwner } from "@/project/tilesetReferences";
import { handInteriorPlanExits } from '@/editor/handInterior/exits';
import { withComposedRooms } from '@/editor/handInterior/rooms';
import { genId } from "@/util/id";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// 바닥·벽면·천장 id 를 enum 으로 연다 — 자유 문자열이면 모델이 wood·stone·brick 처럼 그럴듯한 이름을 지어
// 「바닥 "wood" 이 없다」로 거부된 뒤 다시 부른다(2026-10-05 헤드리스 스트레스 13판 중 4판).
// 두 칩셋 id 를 합친 enum 이다 — 고른 칩셋에 없는 id 는 조립기가 그 칩셋의 목록과 함께 거부한다.
const uniq = (pick: (s: HandInteriorSpec) => object) => [...new Set([HAND_INTERIOR_SPEC, JP_INTERIOR_SPEC, WIZARDING_INTERIOR_SPEC].flatMap((s) => Object.keys(pick(s))))];
// 타일셋 「방 짓기」 탭에서 사용자가 만든 역할표(src/project/roomKit.ts)는 바닥 floor · 벽면 wall · 천장 default 하나씩이다.
const FLOOR_IDS = [...uniq((s) => s.floors), "floor"];
const WALL_IDS = [...uniq((s) => s.walls), "wall"];
const CEILING_IDS = uniq((s) => s.ceilings);
const TILESET_IDS = Object.keys(HAND_INTERIOR_SPECS);
const TILESET_PARAM = { type: "string", description: `실내 칩셋 id — 방 짓기 역할표(roomKit)가 있는 타일셋. ${HAND_INTERIOR_TILESET_ID}(기본, 판타지·중세 손 도트) · ${JP_INTERIOR_TILESET_ID}(일본 현대 집: 현관·화실·LDK·욕실·화장실·침실, 일본 거리 jp_city 와 같은 칩셋) · ${WIZARDING_INTERIOR_TILESET_ID}(마법 학교 성채·병동·온실·도서관 — 가구는 그 칩셋 조립 부품 wz-… id) · 스토어에서 받은 그 사본(store_…)도 된다. 인자 없이 list_hand_interior_parts 를 부르면 이 프로젝트에서 쓸 수 있는 칩셋이 나온다.` } as const;
/** 역할표가 있는 이 프로젝트의 칩셋 + 번들 칩셋(프로젝트에 아직 없어도 짓기 전에 넣는다). */
function roomTilesetIds(project: Project): string[] {
  return [...new Set([...TILESET_IDS, ...Object.values(project.tilesets).filter((t) => roomSpecOf(t)).map((t) => t.id)])];
}
/**
 * tileset 을 빠뜨린 호출 — 다시 지을 맵의 칩셋, 아니면 바닥·벽면 id 가 한 칩셋에만 있으면 그 칩셋. 그래도 모르면 손 도트 v5.
 * 2026-10-08 조수 시험: 일본 집을 tileset 없이 floor:"flooring" 으로 불러 v5 바닥 목록과 함께 거부됐다.
 */
function inferTileset(project: Project, args: Record<string, unknown>): string {
  const map = typeof args.mapId === "string" ? project.maps[args.mapId] : undefined;
  if (map && (HAND_INTERIOR_SPECS[map.tilesetId] || roomSpecOf(project.tilesets[map.tilesetId]))) return map.tilesetId;
  const owners = (key: "floors" | "walls", id: unknown) => typeof id === "string" ? TILESET_IDS.filter((t) => HAND_INTERIOR_SPECS[t]![key][id]) : [];
  for (const [key, id] of [["floors", args.floor], ["walls", args.wall]] as const) {
    const found = owners(key, id);
    if (found.length === 1) return found[0]!;
  }
  return HAND_INTERIOR_TILESET_ID;
}
function pickTileset(project: Project, args: Record<string, unknown>): string {
  const t = typeof args.tileset === "string" && args.tileset.trim() ? args.tileset.trim() : inferTileset(project, args);
  if (!HAND_INTERIOR_SPECS[t] && !roomSpecOf(project.tilesets[t])) {
    const known = project.tilesets[t] ? ` 사용자에게 「자료집 → 타일 → ${project.tilesets[t]!.name} → 방 짓기」 탭에서 바닥·벽면·천장 칸을 골라 역할표를 만들어 달라고 안내한다(1분이면 된다).` : "";
    throw new ToolError(`실내 칩셋 "${t}" 은 방 짓기 역할표가 없다 — 지금 쓸 수 있는 칩셋: ${roomTilesetIds(project).join(", ")}.${known}`, { code: "unknown-tileset" });
  }
  return t;
}
/** 칩셋 정의를 프로젝트에 두고(없으면 번들 사본) 최신으로 맞춘다. 번들 밖 칩셋(스토어 사본 등)은 그대로 쓴다. */
function ensureInteriorTileset(draft: Project, id: string): TilesetDef | undefined {
  if (!HAND_INTERIOR_SPECS[id]) return draft.tilesets[id];
  if (id === JP_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createJpCityTileset();
    else ensureJpCityTileset(draft.tilesets[id]!);
  } else if (id === WIZARDING_INTERIOR_TILESET_ID) {
    if (!draft.tilesets[id]) draft.tilesets[id] = createWizardingWorldTileset();
    else ensureWizardingWorldTileset(draft.tilesets[id]!);
  } else if (!draft.tilesets[id]) draft.tilesets[id] = createAtlasBiomeInteriorTileset();
  else ensureAtlasBiomeInteriorCurrent(draft, id);
  return draft.tilesets[id];
}
/**
 * 칩셋 역할표 + 사용자가 공방에서 그려 이 칩셋에 구운 기물(id workshop:…).
 * 역할표에 가구 표가 없으면(마법 학교·「방 짓기」 탭에서 만든 역할표) 칩셋의 조립 부품을 가구로 쓴다(kitHandObjects).
 */
let bundledWizarding: TilesetDef | undefined;
function specFor(project: Project, tilesetId: string): HandInteriorSpec {
  // 프로젝트에 아직 마법 학교 칩셋이 없으면(짓기 전 목록 보기) 번들 정의의 조립 부품을 읽는다.
  const tileset = project.tilesets[tilesetId] ?? (tilesetId === WIZARDING_INTERIOR_TILESET_ID ? (bundledWizarding ??= createWizardingWorldTileset()) : undefined);
  const base = roomSpecOf(tileset) ?? HAND_INTERIOR_SPECS[tilesetId]!;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  const workshop = workshopHandObjects(tileset);
  return Object.keys(kits).length || Object.keys(workshop).length ? { ...base, objects: { ...base.objects, ...kits, ...workshop } as HandInteriorSpec["objects"] } : base;
}
const XY = { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false } as const;

/** 검색 결과가 이 수 이하면 행마다 설명·태그·놓는 곳·짝 소품까지, 넘으면 id·이름·종류·크기·설명 한 줄만. */
const FULL_ROWS = 12;

export const LIST_HAND_INTERIOR_PARTS_TOOL: ToolDefinition = {
  name: "list_hand_interior_parts",
  mode: "read",
  domains: ["tile", "map"],
  description: "손 도트 실내(atlas_biome_interior, 또는 tileset:\"jp_city\" 일본 집 실내) 부품 사전 — 가구마다 설명(desc)·쓰는 방(tags)·놓는 곳(place)·짝 소품(pair)이 들어 있어 가구 사전 참고문서를 따로 읽지 않아도 된다. "
    + "① room(방 종류 또는 건물: 빵집·bakery·여관 객실·부엌·침실·서재·선술집·예배당·대장간 등) → 예제 26맵에서 그 방에 실제로 쓰인 가구를 종류별(floor 바닥 가구 막힘 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬 · table 탁자 자동 타일 · line 줄 자동 타일 · dais 단)로, 쓰인 방 수·개수와 함께 준다. 건물이면 방마다 가구 목록도 준다. "
    + "② query(여러 낱말 가능, 예: \"여관 벽\"·\"침실 바닥\"·bed·화덕) → id·이름·분류·태그·설명을 모두 찾아 모든 낱말이 맞는 것부터 준다. 결과가 적으면(12 이하) 행마다 desc·tags·place·pair, 많으면 desc 한 줄만 — 좁히려면 낱말을 더하거나 category 를 준다. "
    + "③ 인자 없이 → 바닥·벽면·천장·탁자·줄·단·탁상 물건 목록, 가구 분류, 방 종류·건물 id. "
    + "행의 use = 게임에서의 쓰임(sit 앉기 · sleep 자기 · open 열기(아이템 이벤트) · search 조사 · read 읽기 · counter 카운터 너머 대화 · travel 이동 · light 불빛 · save 저장 · heal 회복 · switch 켬/끔 장치 · push 밀기 · trap 함정 · key 열쇠·보물 받침 · gate 여닫는 문 · seal 봉인 · walk 밟음 · block 장식), "
    + "facing = 바라보는 쪽(앉는 가구는 탁자·제단 쪽을 보게 놓는다), states = 같은 물건의 다른 상태 그림(닫힘↔열림 등 — 이벤트 1쪽과 2쪽 그림). use 가 open·search·read·save·heal·switch·key 면 그 칸에 이벤트를 붙일 자리다. "
    + "결과 id 는 build_hand_interior_room 의 objects[].id 에 그대로 넣는다. 사용자가 공방에서 그려 넣은 기물은 id workshop:… · 분류 workshop(공방)으로 함께 나온다.",
  parameters: {
    type: "object",
    properties: {
      room: { type: "string", description: "방 종류 또는 건물(한국어·영어 id). 예: 빵집, bakery, 여관 객실, inn_room, 부엌, 침실, 선술집 홀" },
      query: { type: "string", description: "찾을 낱말(여러 개는 띄어 쓴다, 한국어·영어). 예: 여관 벽, 침실 바닥, bed" },
      category: { type: "string", description: "가구 분류 id(bake·pharm·home·church·kitchen·tavern…, 인자 없이 불러 목록 확인)" },
      limit: { type: "integer", minimum: 1, maximum: 200 },
      tileset: TILESET_PARAM,
    },
    additionalProperties: false,
  },
  run(project, args): ToolExecResult {
    const tilesetId = pickTileset(project, args);
    const S = specFor(project, tilesetId);
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const cat = typeof args.category === "string" ? args.category.trim() : "";
    const room = typeof args.room === "string" ? args.room.trim() : "";
    const limit = typeof args.limit === "number" ? args.limit : 40;
    const categories = new Map<string, { ko: string; count: number }>();
    for (const o of Object.values(S.objects)) { const c = categories.get(o.category) ?? { ko: o.category_ko, count: 0 }; c.count++; categories.set(o.category, c); }
    if (room) {
      const r = roomParts(room, Math.min(limit, 16), S);
      if (!r) {
        const idx = roomIndex(S);
        throw new ToolError(`방 종류·건물 '${room}' 을(를) 모른다 — 방: ${idx.rooms} / 건물: ${idx.buildings}`, { code: "unknown-room" });
      }
      const n = Object.values(r.groups).reduce((a, g) => a + (g?.length ?? 0), 0);
      return { summary: `${r.mode === "building" ? "건물" : "방"} ${r.ko}: 예제 ${r.exampleDocs.length}맵 ${r.roomCount}방에서 쓰인 가구 ${n}종(종류별)${r.alsoTagged ? ` + 태그가 맞는 ${r.alsoTagged.length}종` : ""}. 예제 참고문서 documentId: ${r.exampleDocs.slice(0, 4).join(", ")}${r.exampleDocs.length > 4 ? " …" : ""}.`,
        data: { tilesetId, ...r } };
    }
    if (!q && !cat) {
      const idx = roomIndex(S);
      return { summary: `${tilesetId === JP_INTERIOR_TILESET_ID ? "일본 집 실내(jp_city)" : tilesetId === WIZARDING_INTERIOR_TILESET_ID ? "마법 학교 실내(wizarding_world)" : HAND_INTERIOR_SPECS[tilesetId] ? "손 도트 실내" : `${project.tilesets[tilesetId]?.name ?? tilesetId} 실내`} 부품: 가구 ${Object.keys(S.objects).length}종(분류 ${categories.size}) · 바닥 ${Object.keys(S.floors).length} · 벽면 ${Object.keys(S.walls).length} · 천장 ${Object.keys(S.ceilings).length} · 탁상 물건 ${Object.keys(S.goods).length}. 가구는 room(방 종류)·query(낱말)·category 로 찾는다.`,
        data: { tilesetId, roomTilesets: roomTilesetIds(project),
          floors: Object.entries(S.floors).map(([id, f]) => ({ id, ko: f.ko })),
          walls: Object.entries(S.walls).map(([id, w]) => ({ id, ko: w.ko })),
          ceilings: Object.keys(S.ceilings),
          tables: Object.entries(S.tables).map(([id, t]) => ({ id, ko: t.ko, oneRow: t.oneRow, overhangPx: t.up })),
          lines: Object.entries(S.lines).map(([id, l]) => ({ id, ko: l.ko, walkable: l.kind === "flat" })),
          daises: Object.entries(S.daises).map(([id, d]) => ({ id, ko: d.ko })),
          goods: Object.keys(S.goods),
          objectCategories: [...categories].map(([id, c]) => ({ id, ko: c.ko, count: c.count })),
          rooms: idx.rooms, buildings: idx.buildings } };
    }
    const found = searchParts(q, cat, S);
    const shown = found.ids.slice(0, limit);
    const full = shown.length <= FULL_ROWS;
    const multi = found.tokens.length > 1;
    const rows = shown.map((id) => {
      const hit = multi ? `${found.hits.get(id)}/${found.tokens.length}` : undefined;
      return full ? fullRow(id, S.objects[id]!, hit) : shortRow(id, S.objects[id]!, hit);
    });
    const total = found.ids.length;
    const which = !multi ? "" : found.allMatch ? ` — 모든 낱말이 맞는 것만(일부만 맞는 ${found.partial}종은 뺐다)` : ` — 모든 낱말이 맞는 것이 없어 가장 많이 맞는 것부터`;
    return {
      summary: `가구 ${total}종${which}${total > limit ? ` · 앞 ${limit}` : ""}${full ? "" : " · 행이 많아 desc 만 — 낱말·category 를 더해 12종 이하로 좁히면 tags·place·pair 까지 준다"}`,
      data: { tilesetId, objects: rows, total, ...(multi ? { allMatch: found.allMatch, partial: found.partial } : {}) },
    };
  },
};

function transfer(mapId: string, x: number, y: number, to: { mapId: string; x: number; y: number; direction?: string }, index: number): GameEvent {
  const id = `${mapId}-link-${index}`;
  const direction = (to.direction ?? "down") as "up" | "down" | "left" | "right";
  return {
    id, name: "이동", x, y, trigger: { kind: "playerTouch" }, commands: [],
    pages: [{ id: `${id}-p1`, name: "1", conditions: [], graphic: {}, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "transfer", mapId: to.mapId, x: to.x, y: to.y, direction, fade: "black" }] }],
  } as unknown as GameEvent;
}

type TransferCommand = Extract<Command, { kind: "transfer" }>;
/** 이벤트의 맨 위 명령에 든 이동(문). 조건 분기 안의 이동은 문이 아니다. */
function eventTransfers(event: GameEvent): TransferCommand[] {
  const lists = [event.commands ?? [], ...(event.pages ?? []).map((page) => page.commands)];
  return lists.flatMap((commands) => commands.filter((command): command is TransferCommand => command.kind === "transfer"));
}

/**
 * 다시 지은 실내에 맞춰 문을 옮긴다. 바깥으로 나가는 문 이벤트는 가장자리 틈 위로, 다른 맵에서 들어오는 이동은 틈 바로 안쪽 바닥으로.
 * 왜(2026-10-07): 첫 구간 뼈대의 동쪽 문(19,8)이 새 평면에서 벽이 되자 커밋이 「transfer 목적지가 통행 불가」로 두 번 거부됐고,
 * 모델은 문을 방 안 바닥(18,8)으로 옮겨 통과시켰다 — 벽에 틈도 없는 보이지 않는 이동 칸이 출구가 됐다.
 */
function fitDoorsToPlan(draft: Project, mapId: string, events: GameEvent[], shape: HandInteriorShape, notes: string[]): void {
  const occupied = new Set(events.map((e) => `${e.x},${e.y}`));
  for (const event of events) {
    const outbound = eventTransfers(event).filter((t) => t.mapId !== mapId);
    if (!outbound.length) continue;
    if (shape.openings.some((o) => o.x === event.x && o.y === event.y)) continue;
    const target = nearestOpening(shape, event);
    if (!target) {
      const outdoors = outbound.find((t) => draft.maps[t.mapId] && draft.maps[t.mapId]!.tilesetId !== HAND_INTERIOR_TILESET_ID);
      if (outdoors) throw new ToolError(`바깥(${outdoors.mapId})으로 나가는 문 ${event.id}(${event.x},${event.y}) 이 있는데 평면 가장자리에 출입구 틈이 없다 — plan 맨 아래 줄의 '#' 하나를 '.' 로 비워 문을 낸다(그 칸이 출구가 된다)`, { code: "no-exit-gap", mapId });
      continue;
    }
    if (occupied.has(`${target.x},${target.y}`)) continue;
    occupied.delete(`${event.x},${event.y}`);
    notes.push(`문 ${event.id} (${event.x},${event.y}) → 출입구 틈 (${target.x},${target.y})`);
    event.x = target.x; event.y = target.y;
    occupied.add(`${target.x},${target.y}`);
  }
  // 문이 아닌 이벤트(인물·조사물)가 줄어든 평면 밖이나 벽에 남으면 가장 가까운 빈 바닥으로 — 맵을 줄여 짓는 것을 막지 않는다.
  for (const event of events) {
    if (eventTransfers(event).some((t) => t.mapId !== mapId) || shape.isFloor(event.x, event.y)) continue;
    let best: { x: number; y: number } | null = null, bestDistance = Infinity;
    for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) {
      const distance = Math.abs(x - event.x) + Math.abs(y - event.y);
      if (distance < bestDistance && shape.isFloor(x, y) && !occupied.has(`${x},${y}`) && !shape.openings.some((o) => o.x === x && o.y === y)) { best = { x, y }; bestDistance = distance; }
    }
    if (!best) continue;
    occupied.delete(`${event.x},${event.y}`);
    notes.push(`이벤트 ${event.id} (${event.x},${event.y}) → 바닥 (${best.x},${best.y})`);
    event.x = best.x; event.y = best.y;
    occupied.add(`${best.x},${best.y}`);
  }
  // 시작 위치: 다시 지은 시작 맵에서 벽·밖이 되면 출입구 안쪽으로(평면을 줄이면 「시작 위치가 통행 불가」로 커밋이 거부됐다).
  if (draft.startMapId === mapId && !shape.isFloor(draft.startPos.x, draft.startPos.y)) {
    const opening = nearestOpening(shape, draft.startPos);
    const inward = opening && shape.inwardOf(opening);
    if (inward) {
      notes.push(`시작 위치 (${draft.startPos.x},${draft.startPos.y}) → 출입구 안쪽 (${inward.x},${inward.y})`);
      draft.startPos = { ...draft.startPos, x: inward.x, y: inward.y };
    }
  }
  // 들어오는 이동: 벽·천장이나 문 칸 위로 떨어지면 가장 가까운 틈의 안쪽 바닥으로.
  const doorCells = new Set(events.filter((e) => eventTransfers(e).some((t) => t.mapId !== mapId)).map((e) => `${e.x},${e.y}`));
  for (const other of Object.values(draft.maps)) {
    if (other.id === mapId) continue;
    for (const event of other.events) for (const t of eventTransfers(event)) {
      if (t.mapId !== mapId) continue;
      if (shape.isFloor(t.x, t.y) && !doorCells.has(`${t.x},${t.y}`)) continue;
      const opening = nearestOpening(shape, t);
      const inward = opening && shape.inwardOf(opening);
      if (!inward) continue;
      notes.push(`${other.id}/${event.id} 도착 (${t.x},${t.y}) → 출입구 안쪽 (${inward.x},${inward.y})`);
      const mutable = t as { x: number; y: number; direction?: string };
      mutable.x = inward.x; mutable.y = inward.y; mutable.direction = inward.direction;
    }
  }
}

/**
 * 바닥만 바꾼 구역이 칸막이 없이 다른 바닥 한가운데 떠 있는가 — 둘레 바닥 칸의 절반 넘게가 구역 밖 바닥과 맞닿으면 경고.
 * 2026-10-08 조수 시험: 일본 집 1층의 다다미방·부엌이 마루 위 무늬 구역일 뿐이었다(칸막이 0).
 */
function floatingZones(input: HandInteriorInput, shape: HandInteriorShape): string[] {
  const out: string[] = [];
  for (const z of input.zones ?? []) {
    if (!z.floor || z.floor === input.floor) continue;
    // 출구에 붙은 구역(현관 타타키·문 앞 깔판)은 트여 있는 것이 맞다.
    if (shape.openings.some((o) => o.x >= z.x0 - 1 && o.x <= z.x1 + 1 && o.y >= z.y0 - 1 && o.y <= z.y1 + 1)) continue;
    const inZ = (x: number, y: number) => z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1;
    let edge = 0, open = 0;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      if (!shape.isFloor(x, y)) continue;
      const out4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !inZ(x + dx!, y + dy!));
      if (!out4.length) continue;
      edge++;
      if (out4.some(([dx, dy]) => shape.isFloor(x + dx!, y + dy!))) open++;
    }
    if (edge >= 6 && open * 2 > edge) out.push(`구역 (${z.x0},${z.y0})~(${z.x1},${z.y1}) 바닥 ${z.floor} 이 칸막이 없이 다른 바닥과 ${open}칸 맞닿아 떠 있다 — 따로 쓰는 방(화실·욕실·부엌·침실)이면 rooms+connect 로 칸막이를 세운다`);
  }
  return out;
}

/**
 * 고른 칩셋 사양에 맞춰 인자를 고친다 — 2026-10-08 조수 시험(사용자가 올린 칩셋): 역할표가 바닥 floor·벽면 wall·천장 default 하나씩인데
 * 모델이 v5 이름(plank·log·wood)을 넣어 세 번 거부된 뒤 칩셋을 바꾸자고 물었다.
 *  · 바닥·벽면·천장이 하나뿐인 사양이면 모르는 id 를 그 하나로 바꾼다.
 *  · 가구·탁자·줄·단·탁상 물건이 하나도 없는 사양이면 그 목록을 빼고 방만 짓는다(경고로 알린다).
 */
function fitToSpec(args: Record<string, unknown>, S: HandInteriorSpec, tilesetId: string, notes: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  const only = (table: object) => { const keys = Object.keys(table); return keys.length === 1 ? keys[0]! : undefined; };
  const fit = (table: object, label: string) => {
    const one = only(table);
    const seen = new Set<string>();
    return (id: unknown) => {
      if (!one || typeof id !== "string" || id in table) return id;
      if (!seen.has(id)) { seen.add(id); notes.push(`이 칩셋 ${label}은 "${one}" 하나뿐이라 "${id}" 대신 깔았다`); }
      return one;
    };
  };
  const floor = fit(S.floors, "바닥"), wall = fit(S.walls, "벽면"), ceiling = fit(S.ceilings, "천장");
  if ("floor" in out) out.floor = floor(out.floor);
  if ("wall" in out) out.wall = wall(out.wall);
  if ("ceiling" in out) out.ceiling = ceiling(out.ceiling);
  const fixRect = (list: unknown) => Array.isArray(list) ? list.map((z) => z && typeof z === "object"
    ? { ...z, ...("floor" in z ? { floor: floor((z as { floor?: unknown }).floor) } : {}), ...("wall" in z ? { wall: wall((z as { wall?: unknown }).wall) } : {}) } : z) : list;
  if (out.zones) out.zones = fixRect(out.zones);
  if (out.rooms) out.rooms = fixRect(out.rooms);
  const dropped: string[] = [];
  for (const [key, table, label] of [["objects", S.objects, "가구"], ["tables", S.tables, "탁자"], ["lines", S.lines, "줄"], ["daises", S.daises, "단"], ["goods", S.goods, "탁상 물건"]] as const) {
    if (!Object.keys(table).length && Array.isArray(out[key]) && (out[key] as unknown[]).length) {
      // 문(door·sidedoor)은 rooms 가 사양에서 고르므로 여기 오는 것은 모두 모델이 지은 이름이다.
      dropped.push(`${label} ${(out[key] as unknown[]).length}개`);
      delete out[key];
    }
  }
  if (dropped.length) notes.push(`칩셋 ${tilesetId} 에는 방 짓기 ${dropped.map((d) => d.split(" ")[0]).join("·")} 가 없어 ${dropped.join("·")}를 빼고 방(바닥·벽·천장)만 지었다 — 가구는 이 칩셋의 기물(list_tileset_objects → stamp_tileset_object)이나 공용 기물(list_spatial_designs kind:object → stamp_object, 그림이 이 칩셋에 이식된다)로 놓는다. 칩셋을 바꾸자고 하지 않는다`);
  return out;
}

/** 양옆 또는 위아래가 실내인 막힌 칸 수 — 칸막이의 양. */
function partitionCells(plan: readonly string[]): number {
  const open = (x: number, y: number) => (plan[y]?.[x] ?? "#") !== "#";
  let n = 0;
  for (let y = 0; y < plan.length; y++) for (let x = 0; x < plan[y]!.length; x++) {
    if (open(x, y)) continue;
    if ((open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1))) n++;
  }
  return n;
}
const examplePlanCache = new WeakMap<object, { name: string; plan: string[] }[]>();
/** 칩셋 참고문서 예제의 build_hand_interior_room 입력 평면들(마크다운 안 ```json 의 "plan"). */
function examplePlans(project: Project, tileset: TilesetDef): { name: string; plan: string[] }[] {
  const docs = referenceOwner(project, tileset).referenceDocuments;
  if (!docs) return [];
  const hit = examplePlanCache.get(docs);
  if (hit) return hit;
  const out: { name: string; plan: string[] }[] = [];
  for (const category of docs) for (const doc of category.documents ?? []) {
    const md = doc.markdown ?? "";
    for (const m of md.matchAll(/"plan"\s*:\s*(\[[^\]]*\])/gu)) {
      try {
        const plan = JSON.parse(m[1]!) as unknown;
        // 칸막이로 방이 나뉜 예제만 — 네모 방 하나짜리 예제와는 어떤 네모 방이든 닮는다.
        if (Array.isArray(plan) && plan.length >= 3 && plan.every((r) => typeof r === "string") && partitionCells(plan as string[]) >= 5) out.push({ name: doc.name || doc.id, plan: plan as string[] });
      } catch { /* 예제가 아닌 글 */ }
    }
  }
  examplePlanCache.set(docs, out);
  return out;
}
/**
 * 참고 예제 평면을 그대로 베꼈는가(같은 크기, 칸 90% 이상 같음) — 2026-10-08 조수 시험: 「일본 집 1층」 요청에 예제 2층 단독주택 1층의
 * 평면·가구를 통째로 넣었다. 매번 같은 집이 나온다.
 */
function copiedExample(project: Project, tileset: TilesetDef, plan: readonly string[]): { name: string; same: number } | undefined {
  // 한두 줄·열을 더하거나 빼 비켜 가는 것도 잡는다(2026-10-08 시험: 경고 뒤 가로 1칸만 늘려 다시 냈다) — 위치를 ±3칸 밀어 보며
  // 두 평면 중 큰 쪽 넓이 대비 같은 칸(막힘/실내) 비율을 본다.
  const H = plan.length, W = Math.max(0, ...plan.map((r) => r.length));
  const at = (p: readonly string[], x: number, y: number) => (p[y]?.[x] ?? "#") === "#";
  let best: { name: string; same: number } | undefined;
  for (const ex of examplePlans(project, tileset)) {
    const eh = ex.plan.length, ew = Math.max(0, ...ex.plan.map((r) => r.length));
    if (Math.abs(eh - H) > 3 || Math.abs(ew - W) > 3) continue;
    const area = Math.max(W * H, ew * eh);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      let same = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ey = y + dy, exX = x + dx;
        if (ey < 0 || ey >= eh || exX < 0 || exX >= ew) continue;
        if (at(plan, x, y) === at(ex.plan, exX, ey)) same++;
      }
      const pct = Math.round(same * 100 / Math.max(1, area));
      if (pct >= 94 && (!best || pct > best.same)) best = { name: ex.name, same: pct };
    }
  }
  return best;
}

/** 맨 아래 출입구 틈 안쪽에 발깔개를 깐다 — 모델이 출구를 표시하지 않았을 때 「여기가 문」이 보이게. */
function withDoormat(input: HandInteriorInput, shape: HandInteriorShape): HandInteriorInput {
  if ((input.objects ?? []).some((o) => o.id === "doormat") || !HAND_INTERIOR_SPEC.objects.doormat) return input;
  const first = shape.openings.find((o) => o.y === shape.height - 1);
  const gap = first && nearestOpening(shape, first);   // 이어진 틈의 가운데 — 문 이벤트가 서는 칸과 같다.
  // 2칸 틈이면 깔개(2칸)가 틈과 딱 맞는다. 1칸 틈은 반 칸 어긋날 수밖에 없다.
  const inward = gap && shape.inwardOf(gap);
  if (!inward) return input;
  const taken = (x: number, y: number) => (input.objects ?? []).some((o) => o.x === x && o.y === y)
    || (input.tables ?? []).some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)
    || (input.lines ?? []).some((l) => (l.cells ?? []).some((c) => c.x === x && c.y === y)
      || (l.rect ? x >= Math.min(l.rect.x0, l.rect.x1) && x <= Math.max(l.rect.x0, l.rect.x1) && y >= Math.min(l.rect.y0, l.rect.y1) && y <= Math.max(l.rect.y0, l.rect.y1) : false));
  for (const x of [inward.x, inward.x - 1]) {
    if ([x, x + 1].every((cx) => shape.isFloor(cx, inward.y) && !taken(cx, inward.y))) {
      return { ...input, objects: [...(input.objects ?? []), { id: "doormat", x, y: inward.y }] };
    }
  }
  return input;
}


type XYLike = { x: number; y: number };
/**
 * 평면 바깥의 「막힌 칸('#')만 있는」 여백을 한 칸만 남기고 잘라 낸다. 좌표 인자(가구·탁자·깔개·단·물건·구역·출입구·links)는
 * 같은 만큼 옮긴다. 실측(2026-10-07 space-craft): gpt-6.1-sol 이 서재 82칸을 44×28 평면 구석에 그려 맵 대부분이 빈 공간이었다.
 */
function trimPlanMargin(args: Record<string, unknown>): { args: Record<string, unknown>; dx: number; dy: number; trimmed?: true } {
  const plan = Array.isArray(args.plan) ? (args.plan as unknown[]).filter((row): row is string => typeof row === "string") : [];
  if (plan.length === 0) return { args, dx: 0, dy: 0 };
  const W = Math.max(...plan.map((row) => row.length));
  let x0 = W, y0 = plan.length, x1 = -1, y1 = -1;
  const include = (x: unknown, y: unknown) => {
    if (typeof x !== "number" || typeof y !== "number") return;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  plan.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== "#") include(x, y); });
  if (x1 < 0) return { args, dx: 0, dy: 0 };
  const points = (value: unknown): XYLike[] => Array.isArray(value) ? value.filter((v): v is XYLike => !!v && typeof v === "object" && typeof (v as XYLike).x === "number" && typeof (v as XYLike).y === "number") : [];
  for (const key of ["objects", "goods", "start", "links"]) for (const p of points(args[key])) include(p.x, p.y);
  for (const key of ["tables", "daises"]) for (const p of points(args[key]) as (XYLike & { w?: number; h?: number })[]) { include(p.x, p.y); include(p.x + (p.w ?? 1) - 1, p.y + (p.h ?? 1) - 1); }
  for (const zone of Array.isArray(args.zones) ? args.zones as Record<string, number>[] : []) { include(zone.x0, zone.y0); include(zone.x1, zone.y1); }
  for (const line of Array.isArray(args.lines) ? args.lines as { cells?: unknown; rect?: Record<string, number> }[] : []) {
    for (const p of points(line.cells)) include(p.x, p.y);
    if (line.rect) { include(line.rect.x0, line.rect.y0); include(line.rect.x1, line.rect.y1); }
  }
  const dx = Math.max(0, x0 - 1), dy = Math.max(0, y0 - 1);
  const right = Math.min(W - 1, x1 + 1), bottom = Math.min(plan.length - 1, y1 + 1);
  if (dx === 0 && dy === 0 && right === W - 1 && bottom === plan.length - 1) return { args, dx: 0, dy: 0 };
  const shift = <T extends XYLike>(p: T): T => ({ ...p, x: p.x - dx, y: p.y - dy });
  const shiftList = (value: unknown) => Array.isArray(value) ? value.map((v) => v && typeof v === "object" && typeof (v as XYLike).x === "number" ? shift(v as XYLike) : v) : value;
  const next: Record<string, unknown> = { ...args, plan: plan.slice(dy, bottom + 1).map((row) => row.padEnd(W, "#").slice(dx, right + 1)) };
  for (const key of ["objects", "goods", "start", "links", "tables", "daises"]) if (key in args) next[key] = shiftList(args[key]);
  if (Array.isArray(args.zones)) next.zones = (args.zones as Record<string, number>[]).map((z) => ({ ...z, x0: z.x0 - dx, x1: z.x1 - dx, y0: z.y0 - dy, y1: z.y1 - dy }));
  if (Array.isArray(args.lines)) next.lines = (args.lines as { cells?: unknown; rect?: Record<string, number> }[]).map((line) => ({
    ...line,
    ...(line.cells ? { cells: shiftList(line.cells) } : {}),
    ...(line.rect ? { rect: { x0: line.rect.x0 - dx, x1: line.rect.x1 - dx, y0: line.rect.y0 - dy, y1: line.rect.y1 - dy } } : {}),
  }));
  return { args: next, dx, dy, trimmed: true };
}

/** 다른 맵에서 이 맵으로 오는 이동의 도착 칸을 같은 만큼 옮긴다(다시 짓기에서 여백을 잘랐을 때). */
function shiftIncomingTransfers(draft: Project, mapId: string, dx: number, dy: number): number {
  let moved = 0;
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.kind === "transfer" && record.mapId === mapId && typeof record.x === "number" && typeof record.y === "number") {
      record.x = (record.x as number) - dx; record.y = (record.y as number) - dy; moved++;
    }
    Object.values(record).forEach(walk);
  };
  for (const other of Object.values(draft.maps)) if (other.id !== mapId) walk(other.events);
  return moved;
}

export const BUILD_HAND_INTERIOR_ROOM_TOOL: ToolDefinition = {
  name: "build_hand_interior_room",
  mode: "write",
  domains: ["tile", "map"],
  description: "실내(집·민가·가게·상점·여관·주막·빵집·대장간·저택·교회·성 방·지하 등)를 지어줘·만들어줘 — 한 층을 손 도트 실내 칩셋 atlas_biome_interior 로 짓는다 — 실내를 까는 유일한 도구다. "
    + "plan = 한 줄씩 문자열 배열, '#' = 막힌 칸(외벽·칸막이·건물 밖), 그 밖 문자('.') = 실내. 벽면(막힌 칸 바로 아래 두 줄)·천장 띠·바닥·그림자는 자동이다. "
    + "방을 네모 하나로만 그리지 않는다 — 바깥 모양을 ㄱ·ㄷ·T 자로 꺾거나 알코브(벽에서 들어간 자리)·칸막이로 공간을 나눈다. 꺾인 모서리 벽·천장도 자동이다(예: [\"################\",\"#......#########\",\"#......#########\",\"#..............#\",\"#..............#\",\"#######..#######\"] = ㄱ자 방). "
    + "방이 둘 이상(집·여관·가게 뒤채·기숙사 등)이면 plan 을 손으로 그리지 말고 rooms(방 사각형) + connect(이을 방 쌍) + exit(출구 방)를 준다 — 칸막이·문 틈·남쪽 출구·방별 바닥/벽면·문 기물(일본 집)을 도구가 계산하고 결과 data.plan·openings(문 자리)를 돌려준다. "
    + "방마다 쓰임이 다르면(화실·욕실·화장실·부엌·침실·창고) 바닥만 zones 로 바꾸지 말고 칸막이로 나눈 방으로 만든다 — 바닥 무늬만 다른 구역은 마루 한가운데 떠 보인다. 큰 방 하나는 방 사각형 둘을 맞닿게(사이 0칸) 놓아 ㄱ·ㄷ자로 만든다. "
    + "예: rooms:[{id:\"hall\",x0:6,y0:8,x1:11,y1:14},{id:\"washitsu\",x0:1,y0:1,x1:7,y1:6,floor:\"tatami\"}], connect:[{a:\"washitsu\",b:\"hall\",door:\"fusuma-open\"}], exit:{room:\"hall\"}. "
    + "칸막이 규칙: 세로 칸막이('#' 한 열) 틈 1칸 = 문, 가로 칸막이('#' 한 줄) 틈은 그 아래 벽면 두 줄까지 통로가 된다. 맨 아래 줄의 '.' 틈이 실제 출구이며 결과 exits[].x,y로 반환한다. start는 통행 검사 출발점이다. "
    + "거리 문에 연결할 남쪽 출구 폭은 기본 1칸이다. 한 칸 문이면 마지막 줄을 '####.#####'처럼 한 칸만 연다. '..'로 두 칸을 열면 거부한다. start를 한 칸 지정해도 실제 열린 폭은 줄지 않는다. 넓은 외부 문·대문에 맞출 때만 exitWidth를 명시하며 실제 문 폭과 같아야 한다. "
    + "floor·wall = list_hand_interior_parts 의 바닥·벽면 id, zones 로 방마다 바꾼다(찬 창고·손질터=wetstone, 가게=plank/terra, 부엌=ktile, 작업장=earth, 침실=dplank+깔개). "
    + "objects[].id = v5 가구 id(좌표 = 발밑 왼쪽 위 칸; wall 종류는 북쪽 벽면 바로 아래 첫 바닥 줄, hang 은 벽면 윗줄 y). tables = 탁자 자동 타일(dining·work·desk·display·counter·kcounter·sideboard·tea·felt), "
    + "lines = 깔개·울타리·창살·선로·제단 난간(칸 목록 또는 rect), daises = 밟는 단, goods = 탁상 물건(윗면 있는 가구 칸 위). "
    + "결과는 통행 BFS(출입구에서 모든 바닥·가구 옆 칸)와 오류를 돌려준다 — error 가 있으면 맵을 만들지 않는다. 층 사이 계단은 links 로 이동 이벤트를 단다. 외부 집 문과 연결하는 작업은 exits의 실제 좌표에 playerTouch 이동을 연결한다. 출구 그림만으로는 이동 이벤트가 생기지 않는다. "
    + "칩셋은 사용자가 보고 있는 맵의 칩셋을 먼저 쓴다 — 그 칩셋에 역할표가 있으면 tileset 에 그 id 를 넣는다(사용자가 올린 칩셋의 바닥·벽면·천장 id 는 floor·wall·default 하나씩, list_hand_interior_parts({tileset}) 로 확인). 사용자가 올린 칩셋에 가구가 없으면 방만 짓고 가구는 그 칩셋 기물로 놓는다 — 가구 때문에 다른 칩셋으로 바꾸자고 하지 않는다. "
    + "손 도트 v5(atlas_biome_interior)로 지을 때는 먼저 list_tileset_references({tilesetId:\"atlas_biome_interior\"}) 의 조립법(정답 배열·예제 그림)을 읽는다. 참고 예제 평면을 그대로 베끼지 않는다 — 예제는 문법이고, 방 수·크기·배치는 요청에 맞춰 새로 짠다. "
    + "일본 현대 집(현관 타타키·화실 다다미·LDK·욕실·화장실·아파트 원룸)은 tileset:\"jp_city\" 로 짓는다 — 가구·바닥·벽면 id 는 list_hand_interior_parts({tileset:\"jp_city\"}) 로 찾고, 조립법은 list_tileset_references({tilesetId:\"jp_city\"}) 의 일본 실내 용도를 읽는다. "
    + "jp_city 방문(door 종류: 열린 양식 문·화장실 문·후스마·쇼지)은 objects 에 넣되 좌표 = 가로 칸막이('#' 줄)의 1칸 틈 칸 — 틈 위 인방과 아래 벽면 높이 문틀을 그리고 통로는 막지 않는다. 세로 칸막이('#' 열) 3줄 틈에는 옆문(sidedoor 종류)을 그 통로 칸(셋째 줄)에 단다.",
  parameters: {
    type: "object",
    properties: {
      tileset: TILESET_PARAM,
      mapId: { type: "string", description: "새 맵 id(생략 시 자동). 이미 있는 같은 칩셋 실내 맵이면 replace:true 로 다시 짓는다." },
      name: { type: "string", description: "맵 이름" },
      replace: { type: "boolean", description: "같은 칩셋의 기존 맵을 통째로 다시 짓기(기본 false)" },
      plan: { type: "array", items: { type: "string" }, description: "평면 — 줄마다 같은 길이, '#' 막힘 · '.' 실내. 방이 여럿이면 plan 대신 rooms 를 준다." },
      rooms: { type: "array", description: "방 사각형 목록(plan 대신) — 바닥 칸 x0..x1·y0..y1(맨 위 두 줄은 벽면), 방 밖은 전부 벽. 사이 1칸 = 칸막이, 맞닿음 = 트인 한 방(ㄱ·ㄷ자), 2칸 이상 = 두꺼운 벽. floor·wall 은 그 방 바닥·벽면.",
        items: { type: "object", properties: { id: { type: "string" }, x0: { type: "integer", minimum: 1 }, y0: { type: "integer", minimum: 1 }, x1: { type: "integer" }, y1: { type: "integer" },
          floor: { type: "string", enum: FLOOR_IDS }, wall: { type: "string", enum: WALL_IDS } }, required: ["id", "x0", "y0", "x1", "y1"], additionalProperties: false } },
      connect: { type: "array", description: "1칸 칸막이를 사이에 둔 두 방을 문으로 잇는다 — 위·아래 방은 1칸 틈, 왼·오른 방은 3줄 틈(셋째 줄이 통로). at = 문 자리(가로 칸막이 x · 세로 칸막이 통로 y), door = 문 기물 id(일본 집: fusuma-open·door-open-toilet·door-side-sliding…, none = 틈만).",
        items: { type: "object", properties: { a: { type: "string" }, b: { type: "string" }, at: { type: "integer" }, door: { type: "string" } }, required: ["a", "b"], additionalProperties: false } },
      exit: { type: "object", description: "남쪽 출구 — room(맨 아래 줄에 닿은 방 id)·x(생략 시 그 방 가운데)·width(기본 1). 생략하면 가장 아래 방.",
        properties: { room: { type: "string" }, x: { type: "integer" }, width: { type: "integer", minimum: 1 } }, required: ["room"], additionalProperties: false },
      exitWidth: { type: 'integer', minimum: 1, maximum: 120, description: '남쪽 출구의 실제 가로 폭. 기본 1칸. 외부 문 폭과 일치해야 하며 한 칸 문에 두 칸 출구를 연결하지 않는다.' },
      floor: { type: "string", enum: FLOOR_IDS, description: "기본 바닥 id (사용자가 만든 역할표 칩셋은 floor)" },
      wall: { type: "string", enum: WALL_IDS, description: "기본 벽면 id (사용자가 만든 역할표 칩셋은 wall)" },
      ceiling: { type: "string", enum: CEILING_IDS, description: "천장 색" },
      zones: { type: "array", items: { type: "object", properties: { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" }, floor: { type: "string", enum: FLOOR_IDS }, wall: { type: "string", enum: WALL_IDS } }, required: ["x0", "y0", "x1", "y1"], additionalProperties: false } },
      objects: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"], additionalProperties: false } },
      tables: { type: "array", items: { type: "object", properties: { style: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["style", "x", "y", "w", "h"], additionalProperties: false } },
      lines: { type: "array", items: { type: "object", properties: {
        id: { type: "string" },
        cells: { type: "array", items: XY },
        rect: { type: "object", properties: { x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" } }, required: ["x0", "y0", "x1", "y1"], additionalProperties: false },
      }, required: ["id"], additionalProperties: false } },
      daises: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } }, required: ["id", "x", "y", "w", "h"], additionalProperties: false } },
      goods: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"], additionalProperties: false } },
      start: { type: "array", items: XY, description: "출입구 칸(생략 시 맨 아래 줄 실내 칸). 위층은 계단 도착 칸." },
      links: { type: "array", description: "이동 이벤트(계단·문): 이 맵의 x,y 에 닿으면 toMapId 의 toX,toY 로", items: { type: "object", properties: {
        x: { type: "integer" }, y: { type: "integer" }, toMapId: { type: "string" }, toX: { type: "integer" }, toY: { type: "integer" }, direction: { type: "string", enum: ["up", "down", "left", "right"] },
      }, required: ["x", "y", "toMapId", "toX", "toY"], additionalProperties: false } },
    },
    required: ["floor", "wall"],
    additionalProperties: false,
  },
  invalidArgsExample: { name: "빵집", plan: ["##########", "#....#####", "#....#####", "#....#####", "#........#", "#........#", "####.#####"], floor: "plank", wall: "plaster", objects: [{ id: "bread oven", x: 1, y: 3 }] },
  run(draft, rawArgs): ToolExecResult {
    const trimmed = trimPlanMargin(rawArgs);
    let args = trimmed.args;
    const tilesetId = pickTileset(draft, args);
    const spec = specFor(draft, tilesetId);
    const fitNotes: string[] = [];
    args = fitToSpec(args, spec, tilesetId, fitNotes);
    // rooms(방 사각형 + 이을 쌍)면 평면·칸막이·문 틈·방별 바닥/벽면·문 기물을 계산해 plan 으로 바꾼다.
    let composed: ReturnType<typeof withComposedRooms>["composed"];
    try {
      const c = withComposedRooms(args as never, spec);
      args = c.input as unknown as typeof args; composed = c.composed;
    } catch (error) {
      if (error instanceof HandInteriorError) throw new ToolError(error.message, { code: error.code });
      throw error;
    }
    if (!Array.isArray(args.plan) || !args.plan.length) throw new ToolError("plan(평면 글자) 또는 rooms(방 사각형 목록) 중 하나를 준다", { code: "plan-missing" });
    const exitWidth = (args.exitWidth as number | undefined) ?? 1;
    const exits = Array.isArray(args.plan) && args.plan.every(row => typeof row === 'string')
      ? handInteriorPlanExits(args.plan as string[]) : [];
    const mismatch = exits.find(exit => exit.width !== exitWidth);
    if (mismatch) throw new ToolError(`남쪽 출구 (${mismatch.x},${mismatch.y})가 가로 ${mismatch.width}칸으로 열려 있지만 문 폭은 ${exitWidth}칸입니다. 마지막 줄의 '.' 틈을 ${exitWidth}칸으로 고치세요. start는 통행 검사 출발점이며 출구 폭을 정하지 않습니다. 한 칸 문을 두 칸 출구에 연결하지 않습니다.`, { code: 'interior-exit-width', x: mismatch.x, y: mismatch.y });
    const tileset = ensureInteriorTileset(draft, tilesetId);
    if (!tileset) throw new ToolError(`타일셋 ${tilesetId} 이 없다`, { code: "tileset-not-found" });
    const shape = handInteriorShapeFromPlan((args as unknown as HandInteriorInput).plan ?? []);
    // 틈=문 맞춤·문 앞 매트는 손 도트 실내(판타지) 문법이다. 일본 집·스토어 칩셋은 문을 기물(door·sidedoor)로 단다.
    const fitsGapDoors = tilesetId === HAND_INTERIOR_TILESET_ID;
    const input = fitsGapDoors ? withDoormat(args as unknown as HandInteriorInput, shape) : args as unknown as HandInteriorInput;
    let built;
    try { built = buildHandInteriorLayers(input, tileset, spec); }
    catch (error) {
      if (error instanceof HandInteriorError) throw new ToolError(error.message, { code: error.code });
      throw error;
    }
    const errors = built.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new ToolError(`실내를 짓지 않았다 — 오류 ${errors.length}건: ${errors.slice(0, 8).map((e) => e.message).join(" / ")}${errors.length > 8 ? " …" : ""}`, { code: errors[0]!.code });
    }
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : genId("map");
    const existing = draft.maps[mapId];
    if (existing && !(args.replace === true && existing.tilesetId === tilesetId)) {
      throw new ToolError(existing.tilesetId === tilesetId
        ? `맵 ${mapId} 가 이미 있다 — 다시 지으려면 replace:true`
        : roomSpecOf(draft.tilesets[existing.tilesetId])
          ? `맵 ${mapId} 는 칩셋 ${existing.tilesetId}(${draft.tilesets[existing.tilesetId]!.name}) 맵이다 — 이 맵에 지으려면 tileset:"${existing.tilesetId}"·replace:true 로 부른다(그 칩셋 바닥·벽면 id 는 list_hand_interior_parts({tileset:"${existing.tilesetId}"})). 다른 칩셋으로 지으려면 새 mapId`
          : `맵 ${mapId} 는 다른 칩셋(${existing.tilesetId}) 맵이다 — 새 mapId 로 짓는다`, { code: "map-exists", mapId });
    }
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : existing?.name ?? "실내";
    const links = Array.isArray(args.links) ? (args.links as { x: number; y: number; toMapId: string; toX: number; toY: number; direction?: string }[]) : [];
    // 아직 없는 맵을 가리키는 이동은 커밋 무결성 검사가 일반 오류로 거부한다 — 층 여럿을 짓는 순서를 알려 주며 먼저 거부한다(2026-10-07 조수 시험: 1층을 2층 links 와 함께 먼저 지으려다 거부).
    const missing = links.filter((l) => l.toMapId !== mapId && !draft.maps[l.toMapId]);
    if (missing.length) {
      throw new ToolError(`links 의 toMapId ${[...new Set(missing.map((l) => l.toMapId))].join(", ")} 맵이 아직 없다 — 층이 여럿이면 ① 한 층을 links 없이 짓고 ② 다른 층을 그 층으로 가는 links 와 함께 짓고 ③ 처음 층을 같은 mapId·replace:true 로 links 를 넣어 다시 짓는다(또는 두 층을 다 지은 뒤 create_transfer_pair). 도착 칸(toX,toY)은 그 맵에서 걸을 수 있는 바닥이어야 한다.`, { code: "link-target-missing" });
    }
    const events: GameEvent[] = [
      ...structuredClone(existing?.events ?? []).filter((e) => !e.id.startsWith(`${mapId}-link-`)),
      ...links.map((l, i) => transfer(mapId, l.x, l.y, { mapId: l.toMapId, x: l.toX, y: l.toY, direction: l.direction }, i)),
    ];
    // 여백을 잘라 다시 지으면 이 맵의 기존 이벤트·시작 위치·들어오는 이동을 같은 만큼 먼저 옮긴다 — 그다음 문 맞춤이 남은 어긋남을 고친다.
    if (trimmed.trimmed && existing) {
      for (const event of events) if (!event.id.startsWith(`${mapId}-link-`)) { event.x -= trimmed.dx; event.y -= trimmed.dy; }
      if (draft.startMapId === mapId) draft.startPos = { ...draft.startPos, x: draft.startPos.x - trimmed.dx, y: draft.startPos.y - trimmed.dy };
      shiftIncomingTransfers(draft, mapId, trimmed.dx, trimmed.dy);
    }
    const doorNotes: string[] = [];
    if (fitsGapDoors) fitDoorsToPlan(draft, mapId, events, shape, doorNotes);
    const map: GameMap = {
      ...(existing ?? {}),
      id: mapId, name, width: built.width, height: built.height, tilesetId, tileSize: tileset.tileSize,
      lowerTiles: built.lowerTiles, upperTiles: built.upperTiles, lowerOverlayTiles: built.lowerOverlayTiles, upperOverlayTiles: built.upperOverlayTiles,
      events, climate: { mode: "indoor" },
    } as GameMap;
    delete (map as Partial<GameMap>).lowerTileStacks; delete (map as Partial<GameMap>).upperTileStacks; delete (map as Partial<GameMap>).shadowBits; delete (map as Partial<GameMap>).relief;
    draft.maps[mapId] = map;
    const trimNote = trimmed.trimmed
      ? `평면 바깥 막힌 여백을 잘라 ${built.width}×${built.height} 로 지었다 — 입력 좌표는 왼쪽 ${trimmed.dx}·위 ${trimmed.dy} 칸만큼 옮겨졌다. 이후 이 맵 좌표는 새 기준을 쓴다.`
      : "";
    if (!existing) {
      if (!draft.maps[draft.mapTree.mapId]) draft.mapTree = { mapId, children: [] };
      else if (draft.mapTree.mapId !== mapId && !draft.mapTree.children.some((c) => c.mapId === mapId)) draft.mapTree.children.push({ mapId, children: [] });
      if (!draft.maps[draft.startMapId]) { draft.startMapId = mapId; const s = built.start[Math.floor(built.start.length / 2)]; draft.startPos = { x: s?.x ?? 0, y: s?.y ?? 0 }; }
    }
    const warnings = [...(trimNote ? [trimNote] : []), ...built.issues.filter((i) => i.severity === "warning").map((i) => i.message)];
    if (shape.plainBox && shape.innerCells >= PLAIN_BOX_MIN_CELLS) warnings.push(`방이 칸막이·알코브 없는 직사각형 하나(ㅁ자, 실내 ${shape.innerCells}칸)다 — 큰 방은 ㄱ·ㄷ자 외곽, 벽에서 들어간 알코브, 두꺼운 칸막이('#' 덩이)로 공간을 나누거나 평면을 줄인다`);
    warnings.push(...fitNotes);
    if (!composed) warnings.push(...floatingZones(input, shape));
    const copied = copiedExample(draft, tileset, input.plan);
    if (copied) warnings.push(`평면이 참고 예제 「${copied.name}」와 ${copied.same}% 같다 — 사용자가 그 예제를 달라고 한 게 아니면 요청(방 수·쓰임·크기)에 맞게 새로 짠다(rooms 로 방 사각형을 다시 놓는다). 예제는 문법을 배우는 자료다`);
    warnings.push(...doorNotes.map((note) => `자동 맞춤: ${note}`));
    return {
      summary: `손 도트 실내 '${name}' ${built.width}×${built.height} (${mapId}, ${tilesetId}) — 출입구에서 닿는 칸 ${built.reachable}, 닿지 못한 빈 바닥 ${built.unreachedFloor.length}, 경고 ${warnings.length}${warnings.length ? ` — ${warnings.slice(0, 4).join(" / ")}${warnings.length > 4 ? " …" : ""}` : ""}`,
      data: { mapId, tilesetId, width: built.width, height: built.height, reachable: built.reachable, floorCells: built.floorCells,
        unreachedFloor: built.unreachedFloor.slice(0, 20), entrance: built.start, exitWidth, exits, links: links.length, warnings: warnings.slice(0, 20),
        ...(composed ? { plan: composed.plan, openings: composed.openings } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const HAND_INTERIOR_TOOLS: readonly ToolDefinition[] = [LIST_HAND_INTERIOR_PARTS_TOOL, BUILD_HAND_INTERIOR_ROOM_TOOL];
