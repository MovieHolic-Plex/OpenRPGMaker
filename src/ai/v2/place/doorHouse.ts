// 문 앞 칸 → 그 문이 달린 건물(집 킷) — 맵의 타일에서 읽는다(마을 빌더가 세운 집과 stamp_object 로 손으로 찍은 건물 둘 다; 손으로 찍은 킷은 structurePlacements 에 남지 않는다).
//
// 왜(2026-11-16 r6 실모델 「갈매나루」): 마을 결과의 문 목록이 킷 id 뿐이라 모델이 어느 문이 어떤 건물인지 못 읽었고(어물전이 화물 창고 문에 달렸다),
// 모델이 직접 부르는 make_place 실내는 어느 문 뒤인지 코드에 말할 길이 없어 크기 단(대형·초대형 구성)이 한 번도 붙지 않았다 —
// 손으로 찍은 초대형 성당의 안이 모델의 방 둘로 섰다. 여기서는 문 앞 칸으로 건물을 찾고(hints.door), 문 목록에 건물 이름과 단을 싣고,
// 큰 건물 문에 방이 모자란 안이 이어지면 그 사실과 고칠 호출을 알린다.
import { kitTier } from "@/project/kitTier";
import type { GameMap, Project, StructureKitDef } from "@/project/types";
import { buildingEntrances } from "./entrances";
import { LAYOUT_TAG } from "./interiorLayout";

/** 크기 단마다 안에 있어야 하는 방 수(실내 빌더의 거절 기준과 같은 표). */
export const TIER_MIN_ROOMS: Readonly<Record<string, number>> = { medium: 2, large: 4, xlarge: 8 };

export interface DoorHouse { readonly kit: string; readonly label: string; readonly tier?: string; readonly front: { x: number; y: number }; readonly tileset: string }

/** 킷 이름에서 칩셋 이름 머리와 크기 꼬리를 뗀 건물 이름(«버들항 첨탑 성당 12×13» → «첨탑 성당»). */
export function kitLabel(def: Pick<StructureKitDef, "id" | "name"> | undefined): string {
  return String(def?.name ?? def?.id ?? "").replace(/\s*\d+×\d+\s*$/u, "").replace(/^버들항\s+(?:읍 건물|[^·]*건물)\s*·\s*/u, "").replace(/^버들항\s+/u, "").trim();
}

/** 이 맵에 선 건물들의 문 — 맵의 타일에서 읽는다(킷이 문이라고 적은 그림 칸, place/entrances.ts): 마을 빌더가 세운 집도 stamp_object 로 손으로 찍은 건물도 같다. */
export function doorHouses(project: Project, map: GameMap | undefined): DoorHouse[] {
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset?.structureKits?.length) return [];
  return buildingEntrances(project, map).map((e) => {
    // 킷은 그 문 칸을 덮은 놓기 기록(마을 빌더의 집)이 먼저다 — 입구 타일은 킷 이름만 알려 주고, 이름이 같은 킷(«살림집» 여럿)이 있다. 기록이 없는 손 찍기는 이름으로 찾는다.
    const placed = [...(map.structurePlacements ?? [])].reverse().find((pl) => e.x >= pl.x && e.x < pl.x + pl.w && e.y >= pl.y && e.y < pl.y + pl.h);
    const def = (placed ? tileset.structureKits!.find((k) => k.id === placed.kitId) : undefined) ?? tileset.structureKits!.find((k) => k.id === e.kit) ?? tileset.structureKits!.find((k) => k.name === e.kit);
    const tier = kitTier(def);
    return { kit: def?.id ?? String(e.kit ?? ""), label: kitLabel(def), ...(tier ? { tier } : {}), front: e.front, tileset: tileset.id };
  });
}

/** (x,y) 가 문 앞 칸(또는 그 문 칸 · 문 앞 줄의 옆 칸)인 건물. 여럿이 걸리면 나중에 찍힌 것. */
export function doorHouseAt(project: Project, mapId: string | undefined, x: number, y: number): DoorHouse | undefined {
  const all = doorHouses(project, project.maps[mapId ?? ""]);
  const pick = (ok: (d: DoorHouse) => boolean) => [...all].reverse().find(ok);
  return pick((d) => d.front.x === x && d.front.y === y) ?? pick((d) => d.front.x === x && (d.front.y - 1 === y || d.front.y + 1 === y)) ?? pick((d) => Math.abs(d.front.x - x) === 1 && d.front.y === y);
}

/** 문 목록 한 줄의 꼬리: « 건물 이름» 과 단(작은 집은 단을 적지 않는다). */
export function doorTail(project: Project, mapId: string, kit: string | undefined): string {
  const map = project.maps[mapId];
  const def = map && kit ? project.tilesets[map.tilesetId]?.structureKits?.find((k) => k.id === kit) : undefined;
  if (!def) return "";
  const tier = kitTier(def), label = kitLabel(def);
  return `${label ? ` «${label}»` : ""}${tier && tier !== "small" ? ` ${tier}` : ""}`;
}

/** 칸 배치로 깐 실내 맵의 방 수(칸 배치 선언이 없으면 undefined — 구성 표로 지은 집·다른 빌더의 맵). */
function laidRooms(map: GameMap | undefined): number | undefined {
  if (!map || !(map.locations ?? []).some((l) => (l.tags ?? []).includes(LAYOUT_TAG))) return undefined;
  return (map.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")).length || undefined;
}

/**
 * create_transfer_pair 가 큰 건물(대형·초대형)의 문과 방이 모자란 칸 배치 실내를 이었으면 그 사실과 고칠 호출 한 줄. 아니면 undefined.
 * 실내를 먼저 짓고 겉을 나중에 찍어 잇는 순서(r6 대성당)에서는 이 순간에야 어느 건물의 안인지가 정해진다.
 */
export function thinInsideNote(project: Project, args: unknown): string | undefined {
  const a = (args as { a?: { mapId?: string; x?: number; y?: number }; b?: { mapId?: string; x?: number; y?: number } } | undefined) ?? {};
  for (const [out, inn] of [[a.a, a.b], [a.b, a.a]] as const) {
    if (!out?.mapId || !inn?.mapId || typeof out.x !== "number" || typeof out.y !== "number") continue;
    const house = doorHouseAt(project, out.mapId, out.x, out.y);
    const need = house?.tier ? TIER_MIN_ROOMS[house.tier] : undefined;
    const rooms = laidRooms(project.maps[inn.mapId]);
    if (!house || !need || house.tier === "medium" || rooms === undefined || rooms >= need) continue;
    const name = project.maps[inn.mapId]?.name ?? inn.mapId;
    return `[Building size] The door at (${house.front.x},${house.front.y}) belongs to «${house.label}» (${house.kit}), a ${house.tier} building — a ${house.tier} building has ${need} or more rooms inside, and «${name}» has ${rooms}. `
      + `To make the inside match the building: make_place({"type":"interior","name":${JSON.stringify(name)},"mapId":${JSON.stringify(inn.mapId)},"hints":{"door":[${house.front.x},${house.front.y}]}}) without layout lays the ${house.tier} plan (rooms, doors between them, stairs), or send a layout with ${need}+ rooms the same way. Leave it if a small inside is what you want.`;
  }
  return undefined;
}
