// editor/tools/village/npcs.ts
// 마을 NPC — 이름/대사 오버라이드, 배치(문 앞/광장), 스케줄, 그래픽 시드 셔플.

import {
  applyCharsetLabelOverrides,
  CHARSET_SEMANTICS,
  findCharsetSemantic,
  type CharsetSemanticEntry,
} from "@/assets/charsetSemantics";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { EVENT_TOOLS } from "../eventTools";
import { inMapBounds } from "../mapHelpers";
import { ToolError } from "../types";
import { resolveTimeSystem } from "@/project/gameTime";
import {
  coordKey,
  pointInMap,
  pointInRect,
  requireTool,
  ROAD_TILES,
  runNested,
  VILLAGE_NPC_GRAPHIC_REFS,
  type BuiltHouse,
  type NpcText,
  type Plaza,
  type Point,
  type Rect,
} from "./constants";
import { villageRoadAnchors } from "./roads";

const placeNpcTool = requireTool(EVENT_TOOLS, "place_npc");
const setNpcScheduleTool = requireTool(EVENT_TOOLS, "set_npc_schedule");

const MIN_NPC_CLEARANCE = 1;

export function placeVillageNpcs(
  draft: Project,
  map: GameMap,
  area: Rect,
  houses: readonly BuiltHouse[],
  plaza: Plaza,
  overrides: readonly Partial<NpcText>[],
  seed: number,
  warnings: string[],
  requestedCount = houses.length + 2,
): void {
  const occupied = new Set<string>();
  const placements: Point[] = [
    ...houses.map((house, index) => npcPointNearHouseFront(map, area, house, index, occupied)),
    { x: plaza.centerX - 1, y: plaza.centerRow },
    { x: plaza.centerX + 1, y: plaza.centerRow },
  ].slice(0, requestedCount);
  for (let y = area.y; placements.length < requestedCount && y < area.y + area.h; y += 1) {
    for (let x = area.x; placements.length < requestedCount && x < area.x + area.w; x += 1) {
      const key = coordKey(x, y);
      if (occupied.has(key) || map.events.some((event) => event.x === x && event.y === y)) continue;
      if (map.upperTiles[y * map.width + x] !== TILE.EMPTY || !isPassable(draft, map, x, y)) continue;
      if (placements.some((point) => chebyshevDistance(point, { x, y }) <= MIN_NPC_CLEARANCE)) continue;
      occupied.add(key);
      placements.push({ x, y });
    }
  }
  if (placements.length !== requestedCount) {
    throw new ToolError(`요청한 NPC ${requestedCount}명을 배치할 통행 가능 고유 칸이 부족합니다.`, {
      code: "village-population-shortfall",
      mapId: map.id,
    });
  }
  const graphics = seededVillageNpcGraphics(seed, draft);
  const workAnchors = villageNpcWorkAnchors(area, plaza, seed);
  for (let index = 0; index < placements.length; index += 1) {
    const point = placements[index] as Point;
    const text = npcText(index, overrides);
    const graphic = graphics[index % graphics.length] as CharsetSemanticEntry;
    const placement = runNested(placeNpcTool, draft, {
      mapId: map.id,
      x: point.x,
      y: point.y,
      name: text.name,
      graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex },
      movement: index % 3 === 0 || index >= houses.length ? "fixed" : "random",
      pages: [{ lines: text.lines }],
      id: uniqueEventId(draft, map.id, seed, index),
    }, warnings);
    const placed = placement.data as { eventId: string; x: number; y: number };
    const home = { x: placed.x, y: placed.y };
    const work = nearestOpenRoadPoint(draft, map, workAnchors[index % workAnchors.length]!, 12) ?? home;
    const evening = nearestOpenRoadPoint(draft, map, { x: plaza.centerX + (index % 3) - 1, y: plaza.centerRow }, 8) ?? home;
    runNested(setNpcScheduleTool, draft, {
      mapId: map.id,
      eventId: placed.eventId,
      schedule: [
        { when: { timePhase: "morning" }, at: { mapId: map.id, ...home }, facing: "down", activity: "아침 집안일" },
        { when: { timePhase: "day" }, at: { mapId: map.id, ...work }, facing: index % 2 === 0 ? "right" : "left", activity: villageNpcActivity(index) },
        { when: { timePhase: "evening" }, at: { mapId: map.id, ...evening }, facing: "down", activity: index % 2 === 0 ? "장터 소식 나누기" : "이웃 안부 묻기" },
      ],
    }, warnings);
  }
  warnIfSchedulesCannotRun(draft, warnings);
}
function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}


/**
 * 시간표를 저장했지만 시간 시스템이 꺼져 있으면 경고한다.
 *
 * 왜(2026-07-26 실측): 이 함수는 주민마다 아침/낮/저녁 3단계 시간표를 저장하는데
 * updateNpcSchedules 는 시간 시스템이 없으면 즉시 return 한다(npcSchedules.ts:31).
 * 즉 **생성된 모든 마을의 시간표가 죽어 있었고** 아무 경고도 없었다 — 주민이 영원히 제자리에 선다.
 *
 * 여기서 system.timeSystem 을 직접 켜지 않는 이유: 마을 시공은 선언한 데이터(맵·이벤트) 밖을
 * 바꿀 수 없다("Village changed undeclared project data" 가드가 실제로 거부한다). 프로젝트
 * 설정을 바꾸는 것은 감독의 결정이므로 알리기만 한다.
 */
function warnIfSchedulesCannotRun(draft: Project, warnings: string[]): void {
  if (resolveTimeSystem(draft)) return;
  warnings.push(
    "주민 시간표를 저장했지만 시간 시스템이 꺼져 있어 실행되지 않습니다 — 주민이 제자리에 머무릅니다. " +
      "system.timeSystem.enabled 를 켜면 시간표대로 이동합니다.",
  );
}

function villageNpcWorkAnchors(area: Rect, plaza: Plaza, seed: number): readonly Point[] {
  const [north, south, west, east] = villageRoadAnchors(area, plaza, seed);
  return [
    { x: plaza.rect.x + 1, y: plaza.centerRow },
    { x: plaza.centerX, y: plaza.rect.y + 1 },
    { x: plaza.rect.x + plaza.rect.w - 2, y: plaza.centerRow },
    north!,
    { x: plaza.centerX, y: plaza.rect.y + plaza.rect.h - 2 },
    east!,
    south!,
    west!,
    { x: plaza.rect.x + 2, y: plaza.rect.y + plaza.rect.h - 2 },
    { x: plaza.rect.x + plaza.rect.w - 3, y: plaza.rect.y + 1 },
  ];
}

function nearestOpenRoadPoint(draft: Project, map: GameMap, origin: Point, maxRadius: number): Point | undefined {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const dx = radius - Math.abs(dy);
      for (const x of dx === 0 ? [origin.x] : [origin.x - dx, origin.x + dx]) {
        const y = origin.y + dy;
        if (!inMapBounds(map, x, y)) continue;
        const index = y * map.width + x;
        if (!ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY) || map.upperTiles[index] !== TILE.EMPTY) continue;
        // 타일 판정만으론 부족 — 스케줄 검증과 같은 실통행(isPassable) 기준으로 확정한다.
        if (!isPassable(draft, map, x, y)) continue;
        return { x, y };
      }
    }
  }
  return undefined;
}

function villageNpcActivity(index: number): string {
  const activities = [
    "채소밭 돌보기",
    "지붕 수리",
    "장작 패기",
    "창문 닦기",
    "동쪽 길 순찰",
    "저녁거리 손질",
    "목공 작업",
    "약초와 꽃 돌보기",
    "서쪽 배송 받기",
    "장터 진열 정리",
    "우물물 긷기",
    "아이들 돌보기",
  ] as const;
  return activities[index % activities.length]!;
}

function seededVillageNpcGraphics(seed: number, draft: Project): readonly CharsetSemanticEntry[] {
  const catalog = applyCharsetLabelOverrides(CHARSET_SEMANTICS, draft.charsetLabels);
  const byKey = new Map<string, CharsetSemanticEntry>();
  for (const entry of catalog) byKey.set(`${entry.textureKey}#${entry.characterIndex}`, entry);
  const fromRefs = VILLAGE_NPC_GRAPHIC_REFS.map(([textureKey, characterIndex]) => byKey.get(`${textureKey}#${characterIndex}`) ?? findCharsetSemantic(textureKey, characterIndex))
    .filter((entry): entry is CharsetSemanticEntry => entry !== undefined);
  const taught: CharsetSemanticEntry[] = [];
  for (const override of draft.charsetLabels ?? []) {
    if (!override.label.trim()) continue;
    const entry = byKey.get(`${override.textureKey}#${override.characterIndex}`);
    if (entry) taught.push(entry);
  }
  const seen = new Set<string>();
  const entries: CharsetSemanticEntry[] = [];
  for (const entry of [...taught, ...fromRefs]) {
    const key = `${entry.textureKey}#${entry.characterIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  if (entries.length === 0) throw new Error("마을 NPC 그래픽 후보가 비어 있습니다.");
  const rng = mulberry32((seed ^ 0x6d2b79f5) >>> 0);
  const offset = Math.floor(rng() * entries.length);
  return [...entries.slice(offset), ...entries.slice(0, offset)];
}

function npcPointNearHouseFront(map: GameMap, area: Rect, house: BuiltHouse, index: number, occupied: Set<string>): Point {
  const leftFirst = index % 2 === 0;
  const candidates = leftFirst
    ? [
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x - 2, y: house.front.y },
        { x: house.front.x + 2, y: house.front.y },
      ]
    : [
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x + 2, y: house.front.y },
        { x: house.front.x - 2, y: house.front.y },
      ];
  for (const point of candidates) {
    if (!pointInMap(map, point)) continue;
    if (!pointInRect(point, area)) continue;
    if (point.x === house.front.x && point.y === house.front.y) continue;
    if (point.x === house.doorAt.x && point.y === house.doorAt.y) continue;
    if (pointInRect(point, house.bbox)) continue;
    const key = coordKey(point.x, point.y);
    if (occupied.has(key)) continue;
    occupied.add(key);
    return point;
  }
  const fallback = house.front;
  occupied.add(coordKey(fallback.x, fallback.y));
  return fallback;
}

function uniqueEventId(draft: Project, mapId: string, seed: number, index: number): string {
  const mapPart = mapId.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  const base = `ev_village_${seed >>> 0}_${mapPart}_${index + 1}`;
  let id = base;
  let suffix = 2;
  const existing = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (existing.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  return id;
}

export function npcOverrides(value: unknown): Partial<NpcText>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError("npcs는 [{name, role?, lines?}] 배열이어야 합니다.", { code: "invalid-args" });
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ToolError(`npcs[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const record = entry as Record<string, unknown>;
    const name = record.name;
    const role = record.role;
    const lines = record.lines;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      throw new ToolError(`npcs[${index}].name은 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
    }
    if (lines !== undefined && (!Array.isArray(lines) || !lines.every((line) => typeof line === "string" && line.length > 0))) {
      throw new ToolError(`npcs[${index}].lines는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
    }
    if (role !== undefined && typeof role !== "string") {
      throw new ToolError(`npcs[${index}].role은 문자열이어야 합니다.`, { code: "invalid-args" });
    }
    return {
      ...(typeof name === "string" ? { name: name.trim() } : {}),
      ...(typeof role === "string" && role.trim() ? { role: role.trim() } : {}),
      ...(Array.isArray(lines) ? { lines: lines as string[] } : {}),
    };
  });
}

/**
 * 슬롯 index 의 주민 텍스트. 오버라이드가 없으면 이름은 임시 라벨(`주민 N`)이고 대사는 **비어 있다** —
 * 캐스트 라이터가 이름과 대사를 함께 채운다. 예전의 고정 10인 명단(DEFAULT_NPCS)은 테마와 무관한
 * 같은 마을을 매번 만들어 삭제했다.
 */
export function npcText(index: number, overrides: readonly Partial<NpcText>[]): NpcText {
  const override = overrides[index];
  return {
    name: override?.name ?? `주민 ${index + 1}`,
    ...(override?.role === undefined ? {} : { role: override.role }),
    lines: override?.lines ?? [],
  };
}
