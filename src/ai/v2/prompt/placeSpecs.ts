// 장소 짓기 지식 카드 — 종류별 카드 묶음, 가벼운 지시문의 색인 한 줄, 실내 칩셋 목록 카드. read_specs 와 첫 짓기 호출이 같은 글을 준다.
import type { Project } from "@/project/types";
import { INTERIOR_CARD } from "../place/builders/interior";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { chipsetCatalog } from "../place/interiorCatalog";
import { VILLAGE_CARD } from "../place/builders/village";
import { DUNGEON_CARD } from "../place/builders/dungeon";
import { JP_CITY_CARD } from "../place/builders/jpCity";
import { MODERN_KR_CARD } from "../place/builders/modernCity";
import { PEOPLE_CARD } from "../place/people";
import { EVENT_CARD } from "../story/events";
import { DRAW_OBJECT_CARD } from "../place/drawObject";

export const V2_CARDS: readonly string[] = [INTERIOR_CARD, VILLAGE_CARD, DUNGEON_CARD, JP_CITY_CARD, MODERN_KR_CARD, PEOPLE_CARD, EVENT_CARD, DRAW_OBJECT_CARD];

/** 가벼운 지시문에서 처음부터 싣지 않는 장소 짓기 동사(toolExposure.ts 가 load_tools 로 돌린다). add_people·move_object 같은 작은 동사는 남긴다. */
export const PLACE_BUILD_VERBS: ReadonlySet<string> = new Set(["make_place", "edit_place", "review_layout", "dress_room", "room_parts", "dungeon_parts", "find_pieces", "draw_object"]);

export const PLACE_SPEC_KINDS = ["interior", "village", "dungeon", "street", "people", "draw_object"] as const;

export type PlaceSpecKind = (typeof PLACE_SPEC_KINDS)[number];

export const PLACE_SPEC_INDEX = "[Place specs — not loaded] This request works on maps that already exist (events, logic, dialogue, database), so the place-building tools (make_place, edit_place, review_layout, dress_room, room_parts, dungeon_parts, find_pieces, draw_object) and their specs are left out. If you really must build or rebuild a place, load the tool with load_tools and read its spec first with read_specs{names:[…]} — interior (inns, shops, studies, jails, houses inside; with the interior chipset catalog), village, dungeon (also caves), street (modern Japan/Korea streets and houses), people (NPCs, for add_people), draw_object. A build call whose spec you have not read returns the spec instead of building (not a failure) — then call it again following the spec.";

/** 장소 종류(make_place type) → 지식 카드 종류. */
export function placeSpecKindOf(type: string | undefined): PlaceSpecKind | undefined {
  if (type === "interior") return "interior";
  if (type === "village") return "village";
  if (type === "dungeon" || type === "cave") return "dungeon";
  if (type === "street" || type === "house") return "street";
  return undefined;
}

/** 한 종류의 카드 글(실내는 칩셋 목록까지). */
export function placeSpecCards(kind: PlaceSpecKind, project?: Project, currentMapId?: string, task = ""): string[] {
  switch (kind) {
    case "interior": return [INTERIOR_CARD, interiorCatalogCard(project, currentMapId, task)];
    case "village": return [VILLAGE_CARD];
    case "dungeon": return [DUNGEON_CARD];
    case "street": return [JP_CITY_CARD, MODERN_KR_CARD];
    case "people": return [PEOPLE_CARD];
    case "draw_object": return [DRAW_OBJECT_CARD];
  }
}

let catalogCard: string | undefined;

/** 칸 배치 목록 카드 — 칩셋 메타데이터에서 생성(interiorCatalog.ts). 지금 맵의 칩셋이 방 역할표를 가진 실내 칩셋이면 그것, 아니면 손 도트 실내 v5. */
export function interiorCatalogCard(project?: Project, currentMapId?: string, task = ""): string {
  const cur = project?.tilesets[project.maps[currentMapId ?? project.startMapId]?.tilesetId ?? ""];
  const v5 = project?.tilesets[HAND_INTERIOR_TILESET_ID];
  const fromCur = cur && cur.id !== HAND_INTERIOR_TILESET_ID && cur.roomKit ? chipsetCatalog(cur, task) : undefined;
  if (fromCur) return fromCur;
  if (v5) { const c = chipsetCatalog(v5, task); if (c) return c; }
  catalogCard ??= chipsetCatalog({ id: HAND_INTERIOR_TILESET_ID } as never, task) ?? `[Interior catalog — chipset ${HAND_INTERIOR_TILESET_ID}] (no spec)`;
  return catalogCard;
}
