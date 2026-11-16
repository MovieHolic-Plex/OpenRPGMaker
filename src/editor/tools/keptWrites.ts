// 페이지를 통째로 다시 쓸 때 빠진 상태 쓰기(스위치 켜기 · 아이템 주기 · 변수 쓰기)를 지킨다.
//
// 왜(2026-11-16 pf4 명세 은행 r5a-river): patch_event_page 가 한씨의 첫 페이지 commands 를 통째로 바꾸며 경로의 스위치 켜기 둘을 뺐다.
// 도구는 «원래 명령 6개 빠짐 — 되살릴 것» 만 적고 그대로 썼고, 그 스위치를 기다리던 어부의 페이지가 영영 안 열려 곁 의뢰를 끝낼 수 없었다.
// 오너 원칙(2026-11-16): 거절은 게임이 깨질 때만 — 여기서는 거절하지 않고, 깨지지 않게 그 명령을 새 페이지 끝에 이어 붙이고 알린다.
// 판단은 프로젝트로 한다: 빠진 쓰기의 대상을 무엇이 읽는가(페이지 조건 · 분기 조건 · 엔딩 조건 · 퀘스트 단계)와, 남는 쓰기가 있는가. 요청 글은 보지 않는다.
import type { GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";

type Node = Record<string, unknown>;
type Key = string; // "sw:<id>" | "item:<id>" | "var:<id>"

function visit(node: unknown, fn: (n: Node) => void): void {
  if (Array.isArray(node)) { for (const v of node) visit(v, fn); return; }
  if (!node || typeof node !== "object") return;
  fn(node as Node);
  for (const v of Object.values(node as Node)) if (v && typeof v === "object") visit(v, fn);
}

/** 이 명령 하나가 «만드는» 상태 — 켜기(true)·주기(+=, =)·변수 쓰기. 끄기·빼앗기는 다른 이벤트가 기다리는 것을 만들지 않는다. */
function writeKey(command: Node): Key | undefined {
  if (command.kind === "setSwitch" && typeof command.switchId === "string" && command.value !== false) return `sw:${command.switchId}`;
  if (command.kind === "changeItem" && typeof command.itemId === "string" && command.op !== "-=") return `item:${command.itemId}`;
  if (command.kind === "setVariable" && typeof command.variableId === "string") return `var:${command.variableId}`;
  return undefined;
}

function writesIn(node: unknown): Set<Key> {
  const out = new Set<Key>();
  visit(node, (n) => { const key = writeKey(n); if (key) out.add(key); });
  return out;
}

/** 무엇이 읽는가 — 이벤트 페이지 조건 · 분기(fork) 조건 · 엔딩 조건 · 퀘스트 정의(단계 · 완료 조건)에 나온 스위치·아이템·변수. */
function readKeys(node: unknown): Set<Key> {
  const out = new Set<Key>();
  const leaf = (n: Node) => {
    if (typeof n.switchId === "string" && (n.kind === "switch" || n.kind === undefined)) out.add(`sw:${n.switchId}`);
    if (typeof n.itemId === "string" && (n.kind === "item" || n.kind === "hasItem")) out.add(`item:${n.itemId}`);
    if (typeof n.variableId === "string" && n.kind === "variable") out.add(`var:${n.variableId}`);
  };
  visit(node, (n) => {
    for (const key of ["conditions", "condition"]) if (n[key]) visit(n[key], leaf);
  });
  return out;
}

export interface KeptWrite { readonly command: Node; readonly key: Key; readonly readBy: string; readonly pageId?: string; readonly pageIndex: number }

/** 프로젝트에서 이 상태를 읽는 곳 하나(알림 글에 쓴다) — 없으면 undefined. 지금 고치는 이벤트의 페이지는 자기 읽기라 빼지 않는다(다른 페이지가 기다릴 수 있다). */
function readerOf(project: Project, key: Key): string | undefined {
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    for (const [i, page] of (event.pages ?? []).entries()) if (readKeys({ conditions: page.conditions ?? [], commands: page.commands ?? [] }).has(key)) return `${(event as GameEvent & { name?: string }).name ? `«${(event as GameEvent & { name?: string }).name}» ` : ""}${event.id} page ${i}`;
  }
  for (const ending of (project.endings ?? []) as unknown as Node[]) if (readKeys(ending).has(key)) return `ending ${String(ending.id ?? "")}`;
  const quests = ((project as unknown as { quests?: Node[] }).quests ?? []);
  const id = key.slice(key.indexOf(":") + 1);
  for (const quest of quests) if (JSON.stringify(quest).includes(`"${id}"`)) return `quest ${String(quest.key ?? quest.id ?? "")}`;
  for (const ce of (project.commonEvents ?? []) as unknown as Node[]) if (readKeys(ce).has(key)) return `common event ${String(ce.id ?? "")}`;
  return undefined;
}

/**
 * before → after 로 이 이벤트의 페이지가 바뀔 때 빠진 상태 쓰기 가운데, 다른 어디서도 쓰지 않는데 무엇이 읽는 것.
 * project 는 바꾸기 전 프로젝트(그 이벤트는 before 그대로). 같은 명령이 새 페이지 어디에든 남아 있으면 빠진 것이 아니다.
 */
export function droppedNeededWrites(project: Project, mapId: string, before: GameEvent, after: GameEvent): KeptWrite[] {
  const nextWrites = writesIn(after.pages ?? after.commands ?? []);
  const lost: { command: Node; pageId?: string; pageIndex: number }[] = [];
  (before.pages ?? []).forEach((page, pageIndex) => visit(page.commands ?? [], (n) => {
    const key = writeKey(n);
    if (key && !nextWrites.has(key) && !lost.some((c) => jsonEqual(c.command, n))) lost.push({ command: n, pageId: page.id, pageIndex });
  }));
  if (!lost.length) return [];
  // 이 이벤트 밖에서 쓰는 것(다른 맵 이벤트 · 공통 이벤트 · 적 그룹 페이지 등).
  const elsewhere = new Set<Key>();
  for (const [key, value] of Object.entries(project as unknown as Node)) if (key !== "maps") for (const k of writesIn(value)) elsewhere.add(k);
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    if (map.id === mapId && event.id === before.id) continue;
    for (const k of writesIn(event)) elsewhere.add(k);
  }
  const out: KeptWrite[] = [];
  for (const { command, pageId, pageIndex } of lost) {
    const key = writeKey(command)!;
    if (elsewhere.has(key) || out.some((k) => k.key === key)) continue;
    const readBy = readerOf(project, key);
    if (readBy) out.push({ command: structuredClone(command), key, readBy, ...(pageId ? { pageId } : {}), pageIndex });
  }
  return out;
}

/** 지킬 쓰기를 이벤트의 페이지에 되돌린다 — 같은 id 의 페이지, 없으면 같은 자리의 페이지, 그것도 없으면 마지막 페이지. */
export function restoreKeptWrites(event: GameEvent, kept: readonly KeptWrite[]): void {
  const pages = event.pages ?? [];
  if (!pages.length) return;
  for (const k of kept) {
    const page = pages.find((p) => k.pageId && p.id === k.pageId) ?? pages[k.pageIndex] ?? pages[pages.length - 1]!;
    page.commands = appendKeptWrites(page.commands ?? [], [k]) as typeof page.commands;
  }
}

/** 지킬 쓰기를 페이지 명령 끝에(자기 지우기 앞) 이어 붙인다. */
export function appendKeptWrites(commands: unknown[], kept: readonly KeptWrite[]): unknown[] {
  const list = [...commands];
  let at = list.length;
  while (at > 0 && ["eraseEvent", "setSelfSwitch"].includes(String((list[at - 1] as Node | undefined)?.kind))) at -= 1;
  list.splice(at, 0, ...kept.map((k) => structuredClone(k.command)));
  return list;
}

const label = (k: KeptWrite) => `${k.key.startsWith("sw:") ? "switch" : k.key.startsWith("item:") ? "item" : "variable"} ${k.key.slice(k.key.indexOf(":") + 1)} (read by ${k.readBy})`;

/** 결과에 싣는 영어 글. */
export function keptWritesNote(kept: readonly KeptWrite[]): string {
  return `Carried over ${kept.length} state write(s) your new commands left out — nothing else sets them and the game still reads them: ${kept.map(label).join("; ")}. They were added at the end of the page. To really remove them, call again with dropWrites:true.`;
}

export function droppedWritesNote(kept: readonly KeptWrite[]): string {
  return `Removed as asked (dropWrites:true) — these now have no writer anywhere, so what reads them can never open: ${kept.map(label).join("; ")}.`;
}

// ── 지킨 쓰기 물리기 ─────────────────────────────────────────────────────────────
// 왜(2026-11-16 #4751 실모델 확인): 「열쇠를 주는 대신 옆 상자에서 얻게」 는 정당한 옮기기다. 모델이 주는 사람을 먼저 다시 쓰면
// 위 droppedNeededWrites 가 열쇠 주기를 지켜 되붙이고, 그 뒤 같은 세션에서 상자를 놓으면 열쇠가 두 군데서 나온다.
// 그래서 되붙인 쓰기를 세션(도구 ctx)마다 적어 두고, 뒤의 쓰기 호출이 그 상태를 쓰는 곳을 새로 만들면 되붙인 사본을 걷고 알린다.
// 모델이 그 이벤트를 다시 쓰면(되붙인 것을 보고 받아들인 것) 기록을 지운다 — 그때부터는 모델의 명령이다.

export interface CarriedRecord { readonly mapId: string; readonly eventId: string; readonly key: Key; readonly eventJson: string }
const carriedBySession = new WeakMap<object, CarriedRecord[]>();

function eventIn(project: Project, mapId: string, eventId: string): GameEvent | undefined {
  return project.maps[mapId]?.events?.find((e) => e.id === eventId);
}

/** 이 상태를 이 이벤트 밖에서 쓰는 곳 하나(알림 글용) — 없으면 undefined. */
function otherWriter(project: Project, mapId: string, eventId: string, key: Key): string | undefined {
  for (const [field, value] of Object.entries(project as unknown as Node)) if (field !== "maps" && writesIn(value).has(key)) return field;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    if (map.id === mapId && event.id === eventId) continue;
    for (const [i, page] of (event.pages ?? []).entries()) if (writesIn(page.commands ?? []).has(key)) {
      const name = (event as GameEvent & { name?: string }).name;
      return `${name ? `«${name}» ` : ""}${event.id} page ${i}`;
    }
    if (writesIn(event.commands ?? []).has(key)) return event.id;
  }
  return undefined;
}

/** 명령 목록(가지 안 포함)에서 이 상태를 쓰는 첫 명령을 빼낸다. 뺐으면 true. */
function removeFirstWrite(list: unknown[], key: Key): boolean {
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i] as Node | undefined;
    if (!node || typeof node !== "object") continue;
    if (writeKey(node) === key) { list.splice(i, 1); return true; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value) && removeFirstWrite(value, key)) return true;
      if (value && typeof value === "object" && !Array.isArray(value)) for (const inner of Object.values(value as Node)) if (Array.isArray(inner) && removeFirstWrite(inner, key)) return true;
    }
  }
  return false;
}

const keyLabel = (key: Key) => `${key.startsWith("sw:") ? "switch" : key.startsWith("item:") ? "item" : "variable"} ${key.slice(key.indexOf(":") + 1)}`;

/**
 * 쓰기 호출 하나가 끝난 draft 에서: 앞서 되붙인 쓰기의 상태를 이제 다른 곳이 쓰면 되붙인 사본을 걷는다(draft 를 고친다).
 * 돌려주는 next 는 커밋이 성공했을 때만 commitCarried 로 적는다. notes 는 모델에게 가는 영어 글.
 */
export function settleCarriedWrites(session: object, before: Project, draft: Project): { notes: string[]; next: CarriedRecord[] } {
  const records = carriedBySession.get(session) ?? [];
  const notes: string[] = [];
  const next: CarriedRecord[] = [];
  for (const record of records) {
    const was = eventIn(before, record.mapId, record.eventId);
    const now = eventIn(draft, record.mapId, record.eventId);
    // 그 이벤트가 없어졌거나 이번 호출이 그 이벤트를 다시 썼으면 모델이 정한 것이다 — 기록을 놓는다.
    if (!was || !now || JSON.stringify(was) !== JSON.stringify(now) || JSON.stringify(now) !== record.eventJson) continue;
    const writer = otherWriter(draft, record.mapId, record.eventId, record.key);
    if (!writer) { next.push(record); continue; }
    const pages = now.pages ?? [];
    const removed = pages.some((page) => removeFirstWrite((page.commands ?? []) as unknown[], record.key)) || removeFirstWrite((now.commands ?? []) as unknown[], record.key);
    if (!removed) continue;
    const name = (now as GameEvent & { name?: string }).name;
    notes.push(`Withdrew the ${keyLabel(record.key)} write that an earlier call carried over on ${name ? `«${name}» ` : ""}${record.eventId} — ${writer} now sets it, so keeping both would set/give it twice. If the old place should still do it too, add it back there.`);
  }
  return { notes, next };
}

/** 커밋이 성공한 뒤: 남은 기록 + 이번 호출이 새로 되붙인 쓰기를 적는다. */
export function commitCarried(session: object, next: CarriedRecord[], added: { project: Project; mapId?: unknown; data?: unknown }): void {
  const data = added.data as { eventId?: unknown; carriedWrites?: unknown } | undefined;
  const keys = Array.isArray(data?.carriedWrites) ? (data!.carriedWrites as unknown[]).filter((k): k is Key => typeof k === "string") : [];
  const mapId = typeof added.mapId === "string" ? added.mapId : undefined;
  const eventId = typeof data?.eventId === "string" ? data.eventId : undefined;
  const event = mapId && eventId ? eventIn(added.project, mapId, eventId) : undefined;
  const fresh = event && mapId && eventId ? keys.map((key) => ({ mapId, eventId, key, eventJson: JSON.stringify(event) })) : [];
  // 같은 이벤트의 옛 기록은 새 것으로 바뀐다(이벤트가 다시 쓰였다).
  const kept = next.filter((r) => !(r.mapId === mapId && r.eventId === eventId));
  if (kept.length || fresh.length) carriedBySession.set(session, [...kept, ...fresh]); else carriedBySession.delete(session);
}
