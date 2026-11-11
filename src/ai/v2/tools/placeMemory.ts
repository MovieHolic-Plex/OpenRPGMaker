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
import { isPlaceholderMap } from "../blankStart";

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

/** 거절 글에 넣는 맵 한 줄 — id 와 이름. */
const mapLine = (project: Project, mapId: string): string => { const m = project.maps[mapId]; return m ? `${mapId} («${m.name ?? ""}», ${m.width}×${m.height})` : `"${mapId}"`; };

/**
 * 칸 배치(spec.layout)로 짓지 않은 장소에 layoutPatch 만 왔을 때의 거절 글 — 고침이 담은 것에 맞는 다음 호출 하나를 실제 값으로 준다.
 * 문을 내려던 고침이면 그 칸으로 create_transfer_pair(전체 배치를 보내라고 하면 방을 통째로 다시 짓는다 — 2026-11-11 작은 일 door-backdoor-built),
 * 아니면 그 맵을 먼저 보게 한다. 전에는 되는 도구 여섯을 늘어놓아, 다음 호출 갈고리가 그중 첫 동사를 강제했다(같은 날 map-vqa 깔기 24판: 25번 거절 뒤 17번 막힘).
 */
export function layoutPatchRefusal(project: Project, mapId: string, patch?: { readonly replace?: Readonly<Record<string, unknown>> }): string {
  const head = `layoutPatch edits an interior that was laid from a cell layout (spec.layout); ${mapLine(project, mapId)} was not, so nothing was changed. Do not send a full layout for a small change — that rebuilds the whole room. `;
  const door = [patch?.replace?.doors, patch?.replace?.openings].flatMap((v) => (Array.isArray(v) ? v : [])).find((d): d is { x: number; y: number } => !!d && typeof (d as { x?: unknown }).x === "number" && typeof (d as { y?: unknown }).y === "number");
  if (door) {
    const others = Object.values(project.maps).filter((m) => m.id !== mapId).slice(0, 6).map((m) => `${m.id} («${m.name ?? ""}»)`).join(", ");
    return `${head}Next call for a door, back door or exit: create_transfer_pair({"a":{"mapId":"${mapId}","x":${door.x},"y":${door.y}},"b":{"mapId":<the map it leads to>,"x":<x>,"y":<y>}}) — give the wall cell where the door goes; the end snaps to the walkable cell in front of it, no door tile needed.${others ? ` Other maps: ${others}.` : ""}`;
  }
  return `${head}Next call: inspect({"mapId":"${mapId}"}) — it shows what stands on this map; then change one thing at a time with the verb for it (a drawn object: place_object, furniture in a room: move_object, a person or event: add_people or move_event, a door or exit to another map: create_transfer_pair with the wall cell where the door goes).`;
}

/**
 * 마을·던전·거리 빌더가 받지 않는 고침(물건 하나·꾸밈 정도, 또는 보낸 칸이 모두 비었거나 지금 값과 같다)의 거절 글 — 선 맵에 그것을 놓는 다음 호출 하나를 실제 값으로 이른다.
 * 전에는 «빌더는 소품 하나하나를 받지 않는다» 만 말해, 광장에 노점을 놓으려던 모델이 같은 고침을 되풀이했다(2026-11-11 map-vqa 깔기 market-town · farm).
 */
export function notRelaidRefusal(project: Project, mapId: string, builderId: string, left: number, asked: { nothing: boolean; anchor?: { what: string; near?: { x: number; y: number } } }): string {
  const head = asked.nothing
    ? `This edit changes nothing: every field sent is empty or equal to what ${mapLine(project, mapId)} already has, so it was not rebuilt`
    : `A ${builderId} place is re-laid only by variant (another layout), features, size or floors — not for single props, dressing, daises or sarcophagi — so ${mapLine(project, mapId)} was not changed`;
  const round = ` (this counted as a repair round; ${Math.max(0, left)} left). `;
  const a = asked.anchor;
  if (a) {
    // draw_object 는 어느 요청에나 실리는 동사다(목록·도장 도구는 요청에 따라 없다) — 이름이 맞는 칩셋 물건이 있으면 그 id 를 돌려주고, 없으면 공방에 맡긴다.
    const at = a.near ? `,"at":{"x":${a.near.x},"y":${a.near.y}}` : "";
    return `${head}${round}To put «${a.what}» on the standing map — Next call: draw_object({"object":{"what":${JSON.stringify(a.what)},"mapId":"${mapId}"${at}}}) — if the chipset already has an object with that name its reply gives the id to place with place_object({"mapId":"${mapId}","objectId":<that id>${at}}); otherwise the workshop draws it.`;
  }
  return `${head}${round}To add or move single things on the standing map — Next call: inspect({"mapId":"${mapId}"}) — it shows what stands on this map; then one verb per thing (a drawn object: place_object, bare outdoor ground: furnish_outdoor_area, a person or event: add_people or move_event, a door or exit: create_transfer_pair).`;
}

/**
 * 구성기가 한 번에 깐 장소를 edit_place 로 다시 깔라는 호출의 거절 글 — 되는 도구를 늘어놓으면 다음 호출 갈고리가 그중 한 동사의 빈 뼈대를 준다.
 * 다음 호출 하나: 지금 항목이 빌더가 덮은 방 검사면 todo done, 물건 고침이면 draw_object, 아니면 inspect.
 */
export function composedRefusal(project: Project, mapId: string, asked: { layout: boolean; anchor?: { what: string; near?: { x: number; y: number } }; coveredItem?: string }): string {
  const head = `${mapLine(project, mapId)} was laid by its composer in one pass and is not re-laid — nothing was changed. `
    + (asked.layout ? "A cell layout cannot be applied to it: the composer's chipset has its own rooms, and the layout, self-review and room-graph checks for this map are covered by the builder. " : "");
  if (asked.coveredItem) return `${head}Next call: todo({"op":"done","task":${JSON.stringify(asked.coveredItem)}}) — its machine check passes as covered by the builder.`;
  const a = asked.anchor;
  if (a) {
    const at = a.near ? `,"at":{"x":${a.near.x},"y":${a.near.y}}` : "";
    return `${head}To put «${a.what}» on the standing map — Next call: draw_object({"object":{"what":${JSON.stringify(a.what)},"mapId":"${mapId}"${at}}}) — if the chipset already has an object with that name its reply gives the id to place; otherwise the workshop draws it.`;
  }
  return `${head}Next call: inspect({"mapId":"${mapId}"}) — it shows what stands on this map; then change one thing at a time with the verb for it (a drawn object: place_object, bare outdoor ground: furnish_outdoor_area, a person or event: add_people or move_event).`;
}

/** 할 일 항목의 장소 종류 → make_place 의 type(들판·거리는 바깥 장소다). */
const MAKE_TYPE: Readonly<Record<string, string>> = { village: "village", field: "village", street: "street", dungeon: "dungeon", cave: "cave", interior: "interior" };

/** edit_place 가 고칠 설계를 못 찾았을 때의 거절 글 — 왜 없는지와 다음 호출 하나. */
export function noDesignRefusal(session: V2Session, project: Project, mapId: string, openPlace?: { name: string; kind?: string }): string {
  const map = project.maps[mapId];
  // 빈 시작 맵(아직 아무것도 짓지 않았다): 고칠 장소가 없다 — 짓는 호출을 준다.
  if (map && isPlaceholderMap(map)) {
    return `edit_place changes a place that is already built, and ${mapLine(project, mapId)} is still the empty start map — no place has been built yet. Nothing was changed. `
      + `Next call: make_place({"type":"${MAKE_TYPE[openPlace?.kind ?? ""] ?? "interior"}","name":${JSON.stringify(openPlace?.name ?? "<place name>")},"mapId":"${mapId}"}) — use the type of the place the request asks for (interior, village, dungeon, cave); it is laid on this map.`;
  }
  const why = session.stalePlaces.has(mapId)
    ? "the map was changed outside the assistant after it was built, so the saved design no longer describes it (rebuilding would erase those changes)"
    : "it was not built by make_place, or its design was not kept";
  return `edit_place rebuilds a place from its saved design, and ${mapLine(project, mapId)} has none — ${why}. Nothing was changed. `
    + `Next call: inspect({"mapId":"${mapId}"}) — it shows what stands on this map; then change one thing at a time with the verb for it (a drawn object: place_object, bare outdoor ground: furnish_outdoor_area, furniture in a room: move_object, a person or event: add_people or move_event, a door or exit: create_transfer_pair). `
    + `Only if the request asks to replace the whole map: make_place with spec.mapId="${mapId}" (that discards what is on the map now).`;
}
