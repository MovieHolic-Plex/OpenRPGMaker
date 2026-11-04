// editor/panels/aiChangeSummaryCard.ts
// 실행이 끝나면 대화에 남는 「바뀐 것」 카드 — 맵·이벤트·캐릭터·아이템을 종류별 개수로 묶고, 줄마다
// 「보기」(그 자리로 데려가기)와 「되돌리기」(그 항목만 실행 전으로)를 단다.
//
// 되돌리기는 새 기록 장치를 만들지 않는다: 지금 프로젝트에서 그 항목만 실행 전 값으로 바꾼 프로젝트를
// `applyProjectWithHistory` 로 커밋한다 — 편집기 실행 취소(Ctrl+Z) 스택에 한 칸으로 올라가므로
// 되돌린 것도 다시 실행 취소로 되살릴 수 있다. 실행 뒤 사용자가 같은 항목을 손으로 고쳤으면 덮지 않고 묻는다.
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export type ChangeItemKind = "map" | "event" | "actor" | "item" | "enemy" | "skill" | "equipment" | "state" | "music";

export interface ChangeItem {
  readonly kind: ChangeItemKind;
  readonly change: "added" | "modified" | "removed";
  readonly id: string;
  readonly mapId?: string;
  readonly label: string;
  /** 보기 대상 좌표(이벤트) — 맵은 전체. */
  readonly at?: { readonly x: number; readonly y: number };
}

export type RecordCollection = "actors" | "items" | "enemies" | "skills" | "equipment" | "states";
const RECORD_KINDS: readonly { readonly key: RecordCollection; readonly kind: ChangeItemKind }[] = [
  { key: "actors", kind: "actor" },
  { key: "items", kind: "item" },
  { key: "enemies", kind: "enemy" },
  { key: "skills", kind: "skill" },
  { key: "equipment", kind: "equipment" },
  { key: "states", kind: "state" },
];

/** 데이터베이스 항목 종류 → 컬렉션(맵·이벤트·음악은 없다). */
export function recordCollectionOf(kind: ChangeItemKind): RecordCollection | undefined {
  return RECORD_KINDS.find((entry) => entry.kind === kind)?.key;
}

export const CHANGE_KIND_LABEL: Readonly<Record<ChangeItemKind, string>> = {
  map: "맵", event: "이벤트", actor: "캐릭터", item: "아이템", enemy: "몬스터", skill: "스킬", equipment: "장비", state: "상태", music: "음악",
};

/** 프로젝트 곡 칸 — 조수가 「전투 음악 정해줘」 로 바꾸는 자리. 맵 곡은 맵 칸 변경으로 센다. */
const SYSTEM_MUSIC_FIELDS = [
  { field: "battleBgmResourceId", label: "전투 음악" },
  { field: "defaultBgmResourceId", label: "기본 배경 음악" },
  { field: "battleVictoryMeResourceId", label: "승리 음악" },
] as const;
type SystemMusicField = typeof SYSTEM_MUSIC_FIELDS[number]["field"];
const systemMusic = (project: Project, field: string): string | undefined =>
  (project.system as unknown as Record<string, string | undefined> | undefined)?.[field];
/** 음악 항목이 가리키는 곡 id(지금 값). */
export function musicResourceOf(project: Project, item: ChangeItem): string | undefined {
  return item.kind === "music" ? systemMusic(project, item.id) : undefined;
}

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

interface Named { readonly id: number | string; readonly name?: string }
const recordsOf = (project: Project, key: RecordCollection): readonly Named[] =>
  ((project.database as unknown as Record<string, unknown> | undefined)?.[key] as readonly Named[] | undefined) ?? [];

/** 맵 칸 내용만 비교한다(이벤트는 따로 센다). */
function mapTilesOf(map: Project["maps"][string]): unknown {
  const { events: _events, ...rest } = map;
  return rest;
}

/** 실행 전/후 프로젝트에서 바뀐 항목 목록(순수). 맵의 칸 변경과 맵 안 이벤트는 따로 센다. */
export function listChangeItems(before: Project, after: Project, options: { readonly skipMapTiles?: boolean } = {}): ChangeItem[] {
  const items: ChangeItem[] = [];
  const mapIds = new Set([...Object.keys(before.maps ?? {}), ...Object.keys(after.maps ?? {})]);
  for (const mapId of mapIds) {
    const a = before.maps?.[mapId];
    const b = after.maps?.[mapId];
    if (a === b) continue;
    const mapLabel = (b ?? a)?.name?.trim() || mapId;
    if (!options.skipMapTiles) {
      if (!a && b) items.push({ kind: "map", change: "added", id: mapId, mapId, label: mapLabel });
      else if (a && !b) { items.push({ kind: "map", change: "removed", id: mapId, mapId, label: mapLabel }); continue; }
      else if (a && b && !same(mapTilesOf(a), mapTilesOf(b))) items.push({ kind: "map", change: "modified", id: mapId, mapId, label: mapLabel });
    }
    if (!b) continue;
    const beforeEvents = new Map((a?.events ?? []).map((event) => [event.id, event]));
    const afterEvents = new Map(b.events.map((event) => [event.id, event]));
    for (const [id, event] of afterEvents) {
      const old = beforeEvents.get(id);
      const label = `${event.name?.trim() || id} · ${mapLabel}`;
      if (!old) items.push({ kind: "event", change: "added", id, mapId, label, at: { x: event.x, y: event.y } });
      else if (!same(old, event)) items.push({ kind: "event", change: "modified", id, mapId, label, at: { x: event.x, y: event.y } });
    }
    for (const [id, event] of beforeEvents) {
      if (!afterEvents.has(id)) items.push({ kind: "event", change: "removed", id, mapId, label: `${event.name?.trim() || id} · ${mapLabel}`, at: { x: event.x, y: event.y } });
    }
  }
  for (const { key, kind } of RECORD_KINDS) {
    const old = new Map(recordsOf(before, key).map((record) => [String(record.id), record]));
    const now = new Map(recordsOf(after, key).map((record) => [String(record.id), record]));
    for (const [id, record] of now) {
      const prev = old.get(id);
      if (!prev) items.push({ kind, change: "added", id, label: record.name?.trim() || `#${id}` });
      else if (!same(prev, record)) items.push({ kind, change: "modified", id, label: record.name?.trim() || `#${id}` });
    }
    for (const [id, record] of old) if (!now.has(id)) items.push({ kind, change: "removed", id, label: record.name?.trim() || `#${id}` });
  }
  for (const { field, label } of SYSTEM_MUSIC_FIELDS) {
    const a = systemMusic(before, field);
    const b = systemMusic(after, field);
    if (a === b) continue;
    items.push({ kind: "music", change: !a ? "added" : !b ? "removed" : "modified", id: field, label });
  }
  return items;
}

/** 종류별 개수 — 「맵 1 · 이벤트 6 · 캐릭터 2」. */
export function changeCountsLine(items: readonly ChangeItem[]): string {
  const counts = new Map<ChangeItemKind, number>();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => `${CHANGE_KIND_LABEL[kind]} ${n}`).join(" · ");
}

function currentValue(project: Project, item: ChangeItem): unknown {
  if (item.kind === "map") { const map = project.maps?.[item.id]; return map ? mapTilesOf(map) : undefined; }
  if (item.kind === "music") return systemMusic(project, item.id);
  if (item.kind === "event") return project.maps?.[item.mapId!]?.events.find((event) => event.id === item.id);
  const key = RECORD_KINDS.find((entry) => entry.kind === item.kind)!.key;
  return recordsOf(project, key).find((record) => String(record.id) === item.id);
}

/** 실행 뒤 사용자가 이 항목을 손으로 또 바꿨나 — 그러면 되돌리기가 그 손편집을 덮는다. */
export function changedSinceRun(item: ChangeItem, after: Project, current: Project): boolean {
  return !same(currentValue(after, item), currentValue(current, item));
}

/**
 * 지금 프로젝트에서 그 항목만 실행 전 상태로 돌린 새 프로젝트(순수). 다른 항목·다른 맵은 손대지 않는다.
 * 맵 「추가」 되돌리기는 맵을 지우고, 「삭제」 되돌리기는 맵을 되살린다. 맵 칸 되돌리기는 그 맵의 이벤트를 지금 그대로 둔다.
 */
export function revertChangeItem(current: Project, before: Project, item: ChangeItem): Project {
  if (item.kind === "music") {
    const system = { ...current.system } as unknown as Record<string, string | undefined>;
    const old = systemMusic(before, item.id);
    if (old === undefined) delete system[item.id as SystemMusicField];
    else system[item.id as SystemMusicField] = old;
    return { ...current, system: system as unknown as Project["system"] };
  }
  if (item.kind === "map") {
    const maps = { ...current.maps };
    const old = before.maps?.[item.id];
    if (!old) delete maps[item.id];
    else if (!maps[item.id]) maps[item.id] = old;
    else maps[item.id] = { ...old, events: maps[item.id]!.events };
    return { ...current, maps };
  }
  if (item.kind === "event") {
    const map = current.maps?.[item.mapId!];
    if (!map) return current;
    const old = before.maps?.[item.mapId!]?.events.find((event) => event.id === item.id);
    const without = map.events.filter((event) => event.id !== item.id);
    const index = map.events.findIndex((event) => event.id === item.id);
    const events = old ? (index >= 0 ? map.events.map((event) => event.id === item.id ? old : event) : [...without, old]) : without;
    return { ...current, maps: { ...current.maps, [map.id]: { ...map, events } } };
  }
  const key = RECORD_KINDS.find((entry) => entry.kind === item.kind)!.key;
  const old = recordsOf(before, key).find((record) => String(record.id) === item.id);
  const list = recordsOf(current, key);
  const exists = list.some((record) => String(record.id) === item.id);
  const next = old ? (exists ? list.map((record) => String(record.id) === item.id ? old : record) : [...list, old]) : list.filter((record) => String(record.id) !== item.id);
  return { ...current, database: { ...current.database, [key]: next } } as Project;
}

export interface ChangeUndoDeps {
  readonly getCurrent: () => Project;
  /** 기록에 남기며 적용 — 편집기 실행 취소 스택에 한 칸으로 오른다. 바뀐 게 없으면 false. */
  readonly commit: (project: Project, label: string) => boolean;
  readonly confirmOverwrite: (item: ChangeItem) => boolean | Promise<boolean>;
}

export interface ChangeSummaryCardDeps extends ChangeUndoDeps {
  readonly reveal: (item: ChangeItem) => void;
  /** 줄 앞 작은 그림(아이콘·얼굴·맵 조각). 없으면 종류 글자만. */
  readonly thumbnail?: (item: ChangeItem) => HTMLElement | null;
}

/**
 * 그 항목만 실행 전 값으로 되돌린다 — 「바뀐 것」 카드와 생성 카드가 같은 길을 쓴다(되돌리기 장치는 하나).
 * 실행 뒤 손으로 고쳤으면 먼저 묻는다. 적용했으면 true.
 */
export async function undoChangeItem(item: ChangeItem, before: Project, after: Project, deps: ChangeUndoDeps): Promise<boolean> {
  if (changedSinceRun(item, after, deps.getCurrent()) && !await deps.confirmOverwrite(item)) return false;
  return deps.commit(revertChangeItem(deps.getCurrent(), before, item), `조수 변경 되돌림 — ${CHANGE_KIND_LABEL[item.kind]} ${item.label}`);
}

const VISIBLE_ROWS = 8;
const CHANGE_VERB: Readonly<Record<ChangeItem["change"], string>> = { added: "새로", modified: "고침", removed: "지움" };

export function createChangeSummaryCard(before: Project, after: Project, deps: ChangeSummaryCardDeps): HTMLElement | null {
  const items = listChangeItems(before, after);
  if (!items.length) return null;
  const rows = items.map((item) => {
    const undo = el("button", { class: "ai-change-summary-undo", text: "되돌리기",
      attrs: { type: "button", "aria-label": `${item.label} 되돌리기` }, dataset: { testid: "ai-change-summary-undo" } }) as HTMLButtonElement;
    const view = el("button", { class: "ai-change-summary-view", text: "보기",
      attrs: { type: "button", "aria-label": `${item.label} 보기` }, dataset: { testid: "ai-change-summary-view" } }) as HTMLButtonElement;
    const thumb = item.change === "removed" ? null : deps.thumbnail?.(item) ?? null;
    const row = el("li", { class: `ai-change-summary-row${thumb ? " has-thumb" : ""}`, dataset: { kind: item.kind, change: item.change }, children: [
      ...(thumb ? [el("span", { class: "ai-change-summary-thumb", attrs: { "aria-hidden": "true" }, dataset: { testid: "ai-change-summary-thumb" }, children: [thumb] })] : []),
      el("span", { class: "ai-change-summary-kind", text: CHANGE_KIND_LABEL[item.kind] }),
      el("span", { class: "ai-change-summary-label", text: item.label }),
      el("span", { class: "ai-change-summary-verb", text: CHANGE_VERB[item.change] }),
      view, undo,
    ] });
    view.disabled = item.change === "removed" && item.kind !== "map" ? !item.mapId : item.change === "removed";
    view.addEventListener("click", () => deps.reveal(item));
    undo.addEventListener("click", async () => {
      if (!await undoChangeItem(item, before, after, deps)) return;
      row.classList.add("is-reverted");
      undo.disabled = true;
      undo.textContent = "되돌림";
      view.disabled = true;
    });
    return row;
  });
  const list = el("ul", { class: "ai-change-summary-list", children: rows.slice(0, VISIBLE_ROWS) });
  const children: HTMLElement[] = [
    el("div", { class: "ai-change-summary-head", children: [
      el("strong", { text: "바뀐 것" }),
      el("span", { class: "ai-change-summary-counts", dataset: { testid: "ai-change-summary-counts" }, text: changeCountsLine(items) }),
    ] }),
    list,
  ];
  if (rows.length > VISIBLE_ROWS) {
    const more = el("button", { class: "ai-change-summary-more", text: `${rows.length - VISIBLE_ROWS}개 더 보기`, attrs: { type: "button" } }) as HTMLButtonElement;
    more.addEventListener("click", () => { list.append(...rows.slice(VISIBLE_ROWS)); more.remove(); });
    children.push(more);
  }
  children.push(el("p", { class: "ai-change-summary-note", text: "되돌린 것도 실행 취소(Ctrl+Z)로 다시 살릴 수 있어요." }));
  return el("section", { class: "ai-change-summary", attrs: { "aria-label": "바뀐 것" }, dataset: { testid: "ai-change-summary" }, children });
}
