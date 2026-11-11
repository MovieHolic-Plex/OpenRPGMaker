// 장소 설계 기억 — 지은 장소의 빌더·명세·상태를 프로젝트에 같이 저장해, 다음 턴의 edit_place · move_object · review_layout 이 그 설계에서 고친다.
//
// 왜: 장소 기록은 실행(턴)마다 새로 만드는 세션에만 있었다. 다음 턴에 «그 마을 좀 고쳐 줘» 는 항상 «지은 기록이 없다» 로 거절됐다
//   (2026-11-11 구조 재점검 3-3, openwiki/assistant-v2.md 「장소 설계는 턴을 넘어 남는다」).
// 규칙:
//   - 저장할 때의 맵 지문(이벤트 제외)과 다음 턴 시작 때의 지문이 같을 때만 되살린다. 사이에 조수 밖에서 바뀐 맵은 설계가 더는 그 맵을 말하지 않는다 —
//     그 설계로 다시 지으면 사람이 손으로 고친 것이 지워진다.
//   - 되살린 기록은 session.pastPlaces 에 둔다. session.places 는 «이번 턴에 지은 것» 이라 끝맺음 단계·관문이 읽는다 — 앞 턴의 장소가 거기 들어가면
//     이번 턴이 손대지 않은 맵까지 끝맺음이 만진다. 고치는 동사가 쓰면 그때 이번 턴 기록이 된다.
//   - 고치기 바퀴 수는 넘기지 않는다(새 턴의 요청은 새로 센다).
import type { Project } from "@/project/types";
import type { ProjectIndex } from "../loop/refs";
import type { V2Session } from "../turn/session";
import type { PlaceBuildResult, PlaceRecord, PlaceSpec } from "../shared/types";

interface SavedPlace {
  readonly builder: string;
  readonly spec: PlaceSpec;
  readonly mapIds: readonly string[];
  readonly entrance?: PlaceBuildResult["entrance"];
  readonly state?: unknown;
  /** mapIds 와 같은 차례의 맵 지문. */
  readonly prints: readonly string[];
}
export interface PlaceMemory { readonly places: readonly SavedPlace[] }

const PLACE_MAX = 40;
/** 한 장소 기록의 글자 상한 — 넘는 설계(아주 큰 칸 배치)는 넘기지 않는다. 저장본이 턴마다 불어나지 않게. */
const RECORD_MAX_CHARS = 60_000;

/** 턴 끝에 부른다 — 이번 턴에 지은 장소와, 앞 턴에서 이어 받아 그대로인 장소. */
export function savePlaces(session: V2Session, project: Project, index: ProjectIndex): PlaceMemory | undefined {
  const records = new Set<PlaceRecord>([...session.places.values(), ...[...session.pastPlaces].filter(([mapId]) => !session.places.has(mapId)).map(([, r]) => r)]);
  const places: SavedPlace[] = [];
  const taken = new Set<string>();
  for (const record of records) {
    const mapIds = record.result.mapIds.filter((id) => !!project.maps[id]);
    // 다시 짓기로 층이 새 id 로 바뀐 옛 기록·실패한 짓기는 넘기지 않는다.
    if (!record.result.ok || !mapIds.length || mapIds.length !== record.result.mapIds.length || mapIds.some((id) => taken.has(id))) continue;
    const prints = mapIds.map((id) => index.maps.get(id) ?? "");
    if (prints.some((p) => !p)) continue;
    let saved: SavedPlace;
    try {
      saved = JSON.parse(JSON.stringify({ builder: record.builder, spec: record.spec, mapIds, ...(record.result.entrance ? { entrance: record.result.entrance } : {}), ...(record.result.state !== undefined ? { state: record.result.state } : {}), prints })) as SavedPlace;
    } catch { continue; }
    if (JSON.stringify(saved).length > RECORD_MAX_CHARS) continue;
    for (const id of mapIds) taken.add(id);
    places.push(saved);
  }
  return places.length ? { places: places.slice(-PLACE_MAX) } : undefined;
}

/** 턴 시작에 부른다. restored = 되살린 장소 수, stale = 맵이 조수 밖에서 바뀌었거나 없어져 버린 장소 수. */
export function loadPlaces(memory: unknown, session: V2Session, project: Project, index: ProjectIndex | undefined): { restored: number; stale: number } {
  const list = (memory as Partial<PlaceMemory> | undefined)?.places;
  let restored = 0, stale = 0;
  if (!index || !Array.isArray(list)) return { restored, stale };
  for (const raw of list) {
    const s = raw as Partial<SavedPlace> | undefined;
    if (!s || typeof s.builder !== "string" || !s.spec || typeof s.spec !== "object" || !Array.isArray(s.mapIds) || !Array.isArray(s.prints) || !s.mapIds.length) continue;
    const mapIds = s.mapIds.map(String);
    if (!mapIds.every((id, i) => !!project.maps[id] && index.maps.get(id) === s.prints![i])) {
      stale += 1;
      for (const id of mapIds) if (project.maps[id]) session.stalePlaces.add(id);
      continue;
    }
    const result: PlaceBuildResult = { ok: true, mapIds, ...(s.entrance ? { entrance: s.entrance } : {}), summary: "", warnings: [], missingArt: [], calls: [], ...(s.state !== undefined ? { state: s.state } : {}) };
    const record: PlaceRecord = { builder: s.builder, spec: s.spec, result, rounds: 0 };
    for (const id of mapIds) session.pastPlaces.set(id, record);
    restored += 1;
  }
  return { restored, stale };
}

/** 앞 턴의 설계에서 다시 지었을 때 결과에 붙이는 글(모델이 읽는다). */
export const PAST_DESIGN_NOTE = "Edited from the design saved when this place was built in an earlier turn. If the place was re-laid, things put on this map after that build (objects, hand-painted tiles) are not part of the design — look at the picture and put back anything that is missing.";

/**
 * 칸 배치(spec.layout)로 짓지 않은 장소에 layoutPatch 가 왔을 때의 거절 글. 전에는 «전체 배치를 보내라» 고만 해서, 뒷문 하나 내려던 모델이
 * 같은 호출을 다섯 번 되풀이하다 막혔다(2026-11-11 작은 일 재측정 door-backdoor-built) — 전체 배치는 방을 통째로 다시 짓는 일이다.
 */
export function layoutPatchRefusal(mapId: string): string {
  return `layoutPatch edits a place that was laid from a cell layout (spec.layout); ${mapId} was not, so nothing was changed. Do not send a full layout for a small change — that rebuilds the whole room. `
    + `Use the tools that work on any map: a door, back door or exit to another map → create_transfer_pair{a:{mapId:"${mapId}", x, y}, b:{mapId:<the other map>, x, y}} (give the wall cell where the door goes; the end snaps to the walkable cell in front of it — no door tile needed); `
    + "people and events → add_people / move_event; a drawn object → place_object; furniture already in the room → move_object. "
    + `Only if the request asks to rebuild the room: make_place with spec.mapId="${mapId}".`;
}

/** edit_place 가 고칠 설계를 못 찾았을 때의 거절 글 — 왜 없는지와, 그 맵에서 되는 길을 준다. */
export function noDesignRefusal(session: V2Session, mapId: string): string {
  const why = session.stalePlaces.has(mapId)
    ? "the map was changed outside the assistant after it was built, so the saved design no longer describes it (rebuilding would erase those changes)"
    : "it was not built by make_place, or its design was not kept";
  return `edit_place rebuilds a place from its saved design, and ${mapId} has none — ${why}. Nothing was changed. `
    + "For a small change, use the tools that work on any map: add_people / move_event (people, events), place_object (a drawn object), furnish_outdoor_area (fill bare outdoor ground), move_object (furniture in an interior), create_transfer_pair (a door, back door or exit to another map — give the wall cell where it goes). "
    + `To replace the whole map with a newly designed place, call make_place with spec.mapId="${mapId}" — that discards what is on the map now, so do it only if the request asks for a rebuild.`;
}
