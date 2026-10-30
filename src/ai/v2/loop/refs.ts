// 할 일 항목을 실제 id 에 묶는다(2026-10-30 omo 고리 — 이름 오인 대책).
//   - 기준선: 쓰기 턴 시작 때 맵·이벤트·아이템·적 그룹마다 지문. 판정에는 기준선 대비 새로 생기거나 바뀐 것(changed)을 넘긴다
//     — 「만들어 달라」 항목(fresh)은 시작 저장본에 원래 있던 것으로 통과하지 못한다(sc-1031-b5 엔딩: 원래 있던 엔딩으로 ✓).
//   - 자동 묶기: 쓰기 동사 전후 차이를 그때 진행 중인 항목(또는 인자 todoId 의 항목)의 refs 에 붙인다. 모델 기억에 기대지 않는다.
//     항목의 「주 대상」만: 장소=맵, 인물·대사·엔딩·목표·증거 내밀기=이벤트, 전투=이벤트·적 그룹, 아이템=아이템. link·reachable 은 이름으로 찾는다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { runTodoItemCheck } from "../todo/checks";
import type { CheckResult, TodoChanged, TodoItem, TodoRefs } from "../todo/types";
import type { TodoStore } from "./todoStore";

/** FNV-1a 두 번 — continuation.ts 와 같은 식(편집기 번들에서도 돌게 node:crypto 없이). */
function hash(text: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x01000193); }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export interface ProjectIndex {
  readonly maps: ReadonlyMap<string, string>;
  /** 「mapId:eventId」 → 지문. */
  readonly events: ReadonlyMap<string, string>;
  readonly items: ReadonlyMap<string, string>;
  readonly troops: ReadonlyMap<string, string>;
}

/** 맵 지문은 이벤트를 뺀다(사람 하나 더한 것이 그 장소를 «새로 지은» 것은 아니다). */
export function indexProject(project: Project): ProjectIndex {
  const maps = new Map<string, string>();
  const events = new Map<string, string>();
  for (const map of Object.values(project.maps ?? {})) {
    if (!map) continue;
    const { events: evs, ...rest } = map as GameMap;
    maps.set(map.id, hash(JSON.stringify(rest)));
    for (const ev of evs ?? []) events.set(`${map.id}:${ev.id}`, hash(JSON.stringify(ev)));
  }
  const byId = (list: readonly { id: unknown }[] | undefined) => new Map((list ?? []).map((x) => [String(x.id), hash(JSON.stringify(x))] as const));
  return { maps, events, items: byId(project.database?.items as unknown as { id: unknown }[]), troops: byId(project.database?.troops as unknown as { id: unknown }[]) };
}

const fresh = (before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>) => new Set([...after].filter(([k, v]) => before.get(k) !== v).map(([k]) => k));

/** 기준선 대비 새로 생기거나 바뀐 것. */
export function changedSince(before: ProjectIndex, after: ProjectIndex): TodoChanged {
  return { mapIds: fresh(before.maps, after.maps), eventKeys: fresh(before.events, after.events), itemIds: fresh(before.items, after.items), troopIds: fresh(before.troops, after.troops) };
}

const EVENT_KINDS = new Set(["person", "talk", "ending", "objective", "present_evidence", "battle", "party_join"]);
/** 맵을 짓고 꾸미는 동사 — 이벤트 항목에는 이 동사가 만든 이벤트(문·계단·자동 마감)를 묶지 않는다. */
const MAP_VERB = /^(make_place|edit_place|dress_room|stamp_object|fill_region|move_object|place_object|create_transfer_pair|link_|draw_|paint|tile_|erase_)/u;
const kindsOf = (e: GameEvent) => (e.pages ?? []).flatMap((p) => (p.commands ?? []).map((c) => String((c as { kind?: string }).kind)));
const transferOnly = (e: GameEvent) => { const k = kindsOf(e); return k.length > 0 && k.every((x) => x === "transfer"); };

/** 이 항목 종류에 맞는 차이만 refs 로 고른다. 빈 결과면 undefined. */
export function refsFromDiff(item: Pick<TodoItem, "check">, verb: string, diff: TodoChanged, project: Project): TodoRefs | undefined {
  const kind = item.check?.kind;
  if (!kind || kind === "none" || kind === "link" || kind === "reachable") return undefined;
  if (kind === "place") return diff.mapIds.size ? { mapIds: [...diff.mapIds] } : undefined;
  if (kind === "item") return diff.itemIds.size ? { itemIds: [...diff.itemIds] } : undefined;
  if (!EVENT_KINDS.has(kind)) return undefined;
  const refs: TodoRefs = {};
  if (!MAP_VERB.test(verb)) {
    const eventIds = [...diff.eventKeys].filter((key) => {
      const [mapId, ...rest] = key.split(":");
      const ev = project.maps[mapId!]?.events?.find((e) => e.id === rest.join(":"));
      return !!ev && !transferOnly(ev);
    });
    if (eventIds.length) refs.eventIds = eventIds;
  }
  if (kind === "battle" && diff.troopIds.size) refs.troopIds = [...diff.troopIds];
  return refs.eventIds || refs.troopIds ? refs : undefined;
}

/** 지금 프로젝트에 있는 id 인가(이벤트는 「mapId:eventId」 또는 eventId). */
function exists(project: Project, kind: keyof TodoRefs, id: string): boolean {
  switch (kind) {
    case "mapIds": return !!project.maps[id];
    case "itemIds": return (project.database?.items ?? []).some((i) => String(i.id) === id);
    case "troopIds": return (project.database?.troops ?? []).some((t) => String(t.id) === id);
    case "eventIds": {
      const i = id.indexOf(":");
      if (i > 0 && project.maps[id.slice(0, i)]?.events?.some((e) => e.id === id.slice(i + 1))) return true;
      return Object.values(project.maps).some((m) => m?.events?.some((e) => e.id === id));
    }
  }
}

/**
 * 항목 refs 에 덧붙인다. prune 이면 같은 종류에서 이미 사라진 id 는 뺀다(같은 항목을 다시 지으며 새 id 로 바뀐 경우 —
 * 마을 다시 짓기가 새 맵 id 를 쓴다). 돌려주는 값: 새로 붙은 id.
 */
export function bindRefs(item: TodoItem, add: TodoRefs, project: Project, prune = true): string[] {
  const added: string[] = [];
  const refs: TodoRefs = { ...(item.refs ?? {}) };
  for (const kind of ["mapIds", "eventIds", "itemIds", "troopIds"] as const) {
    const more = add[kind];
    if (!more?.length) continue;
    const kept = (refs[kind] ?? []).filter((id) => !prune || exists(project, kind, id));
    for (const id of more) if (!kept.includes(id)) { kept.push(id); added.push(id); }
    refs[kind] = kept.slice(-12);
  }
  if (added.length) item.refs = refs;
  return added;
}

const short = (id: string) => (id.length > 22 ? `${id.slice(0, 20)}…` : id);
/** 사람이 읽는 묶음 한 줄(없으면 빈 글). */
export function refsLabel(refs: TodoRefs | undefined): string {
  if (!refs) return "";
  const parts = [
    refs.mapIds?.length ? `맵 ${refs.mapIds.map(short).join(",")}` : "",
    refs.eventIds?.length ? `이벤트 ${refs.eventIds.map((e) => short(e.includes(":") ? e.slice(e.indexOf(":") + 1) : e)).join(",")}` : "",
    refs.itemIds?.length ? `아이템 ${refs.itemIds.map(short).join(",")}` : "",
    refs.troopIds?.length ? `적 그룹 ${refs.troopIds.map(short).join(",")}` : "",
  ].filter(Boolean);
  return parts.length ? `묶음 ${parts.join(" · ")}` : "";
}

/**
 * 항목 하나 판정 — 기준선이 있으면 changed 를 넘긴다. 앞 실행에서 이어 받은 항목(restored)인데 refs 가 없으면 changed 를 넘기지 않는다
 * (그 항목의 대상은 앞 실행에서 생겨 이번 기준선에 이미 들어 있다).
 */
export function checkItem(project: Project, store: TodoStore, item: TodoItem, changedNow?: TodoChanged): CheckResult | undefined {
  if (!item.check || item.check.kind === "none") return undefined;
  const restored = store.meta.get(item.id)?.restored && !item.refs;
  const changed = store.baseline && !restored ? changedNow ?? changedSince(store.baseline, indexProject(project)) : undefined;
  return runTodoItemCheck(project, item, { startMapId: project.startMapId, ...(changed ? { changed } : {}) });
}

export const isAmbiguous = (r: CheckResult | undefined): boolean => !!r && !r.pass && r.detail.startsWith("모호함");
