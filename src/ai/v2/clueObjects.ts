// 조수 v2 — 단서 대사가 가리키는 물건과 실제 단서 이벤트 자리를 맞추고, 앞 판 빌드가 남긴 죽은 단서 고리를 걷어 낸다.
//
// 왜(2026-10-29 vm5 flash 방탈출 판정 major): 「시작 조사」 대사가 「'비밀번호의 첫 단서는 책장 속 책에 있다.'」인데 실제 다음 단서
// 「번호 쪽지(3552)」는 책상 위였다. 같은 이벤트가 「책상 위에 놓인 일지를 발견했다」고 말하는데 정작 안락의자 칸에 있었다.
// 경로 빌더는 단서 칸을 「쪽지 앞」 낱말로만 고르고, 모델 대사의 물건 낱말은 읽지 않는다.
// 규칙(결정적, 대사 문구는 물건 낱말만 바꾼다):
//  1) 가리키기 — 진행 쪽(스위치·아이템을 주는 쪽) 대사 한 문장이 «단서·번호·쪽지…가 <물건> (속·위·뒤…)에 있다/숨겨져 있다/찾아보자»면
//     그 이벤트가 주는 것을 조건으로 받는 다음 이벤트가 그 물건 칸 위에 있어야 한다. 아니면 그 물건 칸으로 옮긴다(eventReach 의 물건 자리 고르기).
//     물건이 맵에 없거나 옮길 수 없으면(다음 이벤트 이름이 다른 물건을 말하는 등) 대사의 물건 낱말을 다음 이벤트가 실제로 놓인 물건 이름으로 바꾼다.
//  2) 제자리 — 대사가 «<물건> 위에 놓인 X를 발견했다/<물건> 서랍에서 찾았다»처럼 지금 조사하는 물건을 말하면 이 이벤트가 그 물건 칸 위에 있어야 한다.
//     이름에 물건 낱말이 있는 이벤트는 이름이 이긴다(eventReach 가 이름으로 맞춘다) — 여기서는 건드리지 않는다.
// 다른 이벤트를 못 닿게 만드는 자리는 고르지 않는다(repairEventReach 의 판정).
//
// 왜(2026-10-29 vm4 argon 방탈출 판정 «번호 쪽지 『네 자리 숫자 「38」』인데 2자리, 금고는 숫자 입력 없이 열림»): 모델이 청사진을 여러 번 고쳐
// 쓰며 build_blueprint_path 를 거듭 불렀고, 앞 판에서 지은 고리(「책장」「번호 쪽지 38」)가 새 청사진에는 없는 채 남았다. 그 고리가 켜는 스위치를
// 아무도 조건으로 받지 않는다 — 플레이어에게는 «틀린 번호를 주는 단서»다. dropStaleChainClues 는 경로 빌더가 지은 고리(ev_chain_*) 중
// 지금 청사진 단계가 아니고 주는 것을 아무도 받지 않는(엔딩·이동·전투도 없는) 이벤트를 걷어 낸다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import { doorArtCells, hostMentions, isDoorName, objectBaseName, objectCells, repairEventReach, unreachableEvents } from "./eventReach";
import { staleBody } from "./examineSpot";
import { objectAt, tileLabel } from "./people";
import type { BuildRun } from "./types";

type Cmd = Record<string, unknown> & { kind?: string };

const CLUE_WORD = /단서|힌트|번호|비밀|열쇠|쪽지|메모|암호|숫자|답|clue|hint|code|key|note/iu;
const POINTER = /에\s*있다|에\s*있을|에\s*있어|에\s*있는\s*(?:것|듯)|숨겨져\s*있(?!었)|숨어\s*있(?!었)|찾아\s*보|살펴\s*보자|살펴봐|확인해\s*보|조사해\s*보|가\s*보자|있을\s*거|있을지/u;
const SELF = /놓인|놓여|위의|위에서|에서|서랍을|끼워져|꽂혀|발견|찾았|꺼냈|집어/u;
/** 제자리 문장은 지금 집어 든 물건을 말해야 한다(«그림 뒤에서 소리가 난다» 같은 문장으로 옮기지 않게). */
const THING = /일지|일기|책|쪽지|메모|편지|종이|서류|열쇠|단서|힌트|기록|사진|지도|번호|암호|diary|journal|note|letter|key|clue/iu;

function textsOf(node: unknown, out: Cmd[] = []): Cmd[] {
  if (Array.isArray(node)) { for (const n of node) textsOf(n, out); return out; }
  if (!node || typeof node !== "object") return out;
  const c = node as Cmd;
  if (c.kind === "text" && typeof c.body === "string") out.push(c);
  for (const v of Object.values(c)) if (v && typeof v === "object") textsOf(v, out);
  return out;
}
function walk(node: unknown, fn: (c: Cmd) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, fn); return; }
  if (!node || typeof node !== "object") return;
  const c = node as Cmd;
  if (typeof c.kind === "string") fn(c);
  for (const v of Object.values(c)) if (v && typeof v === "object") walk(v, fn);
}
const nameOf = (ev: GameEvent) => String((ev as { name?: string }).name ?? "");
const pagesOf = (ev: GameEvent) => (ev.pages ?? []) as unknown as (Record<string, unknown> & { commands?: unknown[]; conditions?: unknown[] })[];
const sprited = (ev: GameEvent) => pagesOf(ev).some((p) => !!(p.graphic as { sprite?: unknown } | undefined)?.sprite);

/** 이벤트가 «주는» 것(켜는 스위치·늘리는 아이템) — 자기 페이지 조건으로 다시 받는 것(다 봤음 표시)은 뺀다. */
function givesOf(ev: GameEvent): { switches: Set<string>; items: Set<string> } {
  const switches = new Set<string>(), items = new Set<string>();
  for (const p of pagesOf(ev)) walk(p.commands, (c) => {
    if (c.kind === "setSwitch" && c.value !== false && typeof c.switchId === "string") switches.add(c.switchId);
    if (c.kind === "changeItem" && c.op !== "-=" && typeof c.itemId === "string") items.add(c.itemId);
  });
  for (const p of pagesOf(ev)) for (const c of (p.conditions ?? []) as Cmd[]) {
    if (typeof c.switchId === "string") switches.delete(c.switchId);
    if (typeof c.itemId === "string") items.delete(c.itemId);
  }
  return { switches, items };
}
/** 이 이벤트가 조건(페이지 조건·분기 조건·아이템 빼기)으로 받는 id 들. */
function takesOf(ev: GameEvent): Set<string> {
  const out = new Set<string>();
  for (const p of pagesOf(ev)) {
    for (const c of (p.conditions ?? []) as Cmd[]) for (const k of ["switchId", "itemId"]) if (typeof c[k] === "string") out.add(c[k] as string);
    walk(p.commands, (c) => {
      if (c.kind === "setSwitch") return;
      if (c.kind === "changeItem" && c.op !== "-=") return;
      for (const k of ["switchId", "itemId"]) if (typeof c[k] === "string") out.add(c[k] as string);
    });
  }
  return out;
}
/** 진행 쪽 — 주는 명령이 든 페이지들. */
function progressPages(ev: GameEvent) {
  return pagesOf(ev).filter((p) => { let hit = false; walk(p.commands, (c) => { if ((c.kind === "setSwitch" && c.value !== false) || (c.kind === "changeItem" && c.op !== "-=") || c.kind === "triggerEnding") hit = true; }); return hit; });
}
const sentences = (body: string) => body.split(/(?<=[.!?。])\s+|['"「」『』“”‘’]/u).map((s) => s.trim()).filter(Boolean);

/** 이벤트 몸이 이 물건 칸들과 겹치나. */
function onCells(map: GameMap, ev: GameEvent, cells: ReadonlySet<number>): boolean {
  const r = eventBodyRect(ev);
  for (let y = r.top; y <= r.bottom; y++) for (let x = r.left; x <= r.right; x++) if (cells.has(y * map.width + x)) return true;
  return false;
}
/** 이벤트가 놓인 물건 이름(HOSTS 낱말이 들어 있으면 그 낱말). */
function objectNameUnder(project: Project, map: GameMap, ev: GameEvent): string | undefined {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const r = eventBodyRect(ev);
  for (let y = r.top; y <= r.bottom; y++) for (let x = r.left; x <= r.right; x++) for (const k of ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles"]) {
    const t = m[k]?.[y * map.width + x];
    if (typeof t !== "number" || t < 0) continue;
    const label = objectBaseName(tileLabel(project, map, t));
    if (!label || /바닥|벽면|천장|깔개|양탄자|발깔개|그림자|floor|wall|rug/iu.test(label)) continue;
    const host = hostMentions(label)[0];
    if (host) return host.word;
  }
  return undefined;
}

interface Want { readonly eventId: string; readonly words: readonly string[]; readonly word: string; readonly from: { ev: GameEvent; cmd: Cmd; sentence: string } }

/** 한 맵의 단서 대사 ↔ 물건 자리를 맞춘다. 바꾼 것을 줄로 돌려준다. */
export function alignClueObjects(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  if (!run.ctx.project.maps[mapId]?.events?.length) return notes;
  // 옛 자리 가구에 맞춰 넓힌 몸 사각은 먼저 지운다 — 남의 칸을 덮어 옮길 자리를 막는다(examineSpot.staleBody).
  for (const ev of run.ctx.project.maps[mapId]!.events) if (!sprited(ev)) staleBody(run, mapId, ev.id, []);
  const map0 = run.ctx.project.maps[mapId]!;
  const movable = (ev: GameEvent) => !sprited(ev) && !isDoorName(nameOf(ev)) && !JSON.stringify(ev.pages ?? []).includes("\"transfer\"");
  const pointers: Want[] = [];
  const selves: Want[] = [];
  for (const ev of map0.events) {
    const gives = givesOf(ev);
    const next = map0.events.filter((o) => o.id !== ev.id && [...takesOf(o)].some((id) => gives.switches.has(id) || gives.items.has(id)));
    const ownHost = hostMentions(nameOf(ev)).length > 0;
    let pointed = false, selfed = false;
    for (const page of progressPages(ev)) for (const cmd of textsOf(page.commands)) for (const s of sentences(String(cmd.body))) {
      const host = hostMentions(s)[0];
      if (!host) continue;
      const cells = objectCells(run.ctx.project, map0, host.words);
      if (POINTER.test(s) && CLUE_WORD.test(s)) {
        if (pointed || onCells(map0, ev, cells)) continue; // 자기 물건 속을 말하는 것(«서랍 안에 쪽지가 있다»)
        const target = next.length === 1 ? next[0] : next.find((o) => movable(o));
        if (!target) continue;
        pointed = true;
        if (!onCells(map0, target, cells)) pointers.push({ eventId: target.id, words: host.words, word: host.word, from: { ev, cmd, sentence: s } });
      } else if (SELF.test(s) && THING.test(s) && !ownHost && !selfed) {
        selfed = true;
        if (!onCells(map0, ev, cells)) selves.push({ eventId: ev.id, words: host.words, word: host.word, from: { ev, cmd, sentence: s } });
      }
    }
  }
  const settle = (want: Want, kind: "가리킴" | "제자리") => {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === want.eventId);
    if (!ev) return;
    const cells = objectCells(project, map, want.words);
    const ownName = hostMentions(nameOf(ev))[0];
    // 옮긴다: 물건이 있고, 이벤트 이름이 다른 물건을 말하지 않고, 그림 없는 조사 칸일 때.
    if (cells.size && movable(ev) && (!ownName || want.words.some((w) => ownName.words.includes(w)))) {
      // 앞 빌드가 다른 가구에 맞춰 넓힌 몸 사각은 지운다 — 새 물건에서 settleFurnitureSpots 가 다시 맞춘다.
      const reset = pagesOf(ev).some((p) => p.footprint);
      if (reset) {
        const events = map.events.map((e) => e.id !== ev.id ? e : { ...e, pages: (e.pages ?? []).map((p) => { const { footprint: _f, ...rest } = p as typeof p & { footprint?: unknown }; return rest as typeof p; }) });
        run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
      }
      const before = { x: ev.x, y: ev.y };
      const fixed = repairEventReach(run, mapId, [ev.id], new Map([[ev.id, [want.words]]]));
      const now = run.ctx.project.maps[mapId]!.events.find((e) => e.id === ev.id)!;
      if (onCells(run.ctx.project.maps[mapId]!, now, cells)) {
        notes.push(`${kind}: 「${nameOf(ev) || ev.id}」 (${before.x},${before.y})→(${now.x},${now.y}) ${want.word} 위 — 대사 「${want.from.sentence.slice(0, 40)}」`);
        return;
      }
      if (reset) run.ctx.project = project; // 못 옮겼으면 몸 사각도 되돌린다
      void fixed;
    }
    // 바꾼다: 대사의 물건 낱말을 이벤트가 실제로 놓인 물건 이름으로.
    const cur = run.ctx.project.maps[mapId]!;
    const under = objectNameUnder(run.ctx.project, cur, cur.events.find((e) => e.id === want.eventId)!);
    if (!under || under === want.word) return;
    const srcId = want.from.ev.id;
    const events = cur.events.map((e) => {
      if (e.id !== srcId) return e;
      const pages = structuredClone(e.pages ?? []);
      for (const c of textsOf(pages)) if (String(c.body).includes(want.from.sentence)) c.body = String(c.body).replace(want.from.sentence, want.from.sentence.replace(want.word, under));
      return { ...e, pages };
    });
    run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...cur, events } } };
    notes.push(`${kind}: 「${nameOf(want.from.ev) || srcId}」 대사의 「${want.word}」 → 「${under}」(단서가 실제로 놓인 물건)`);
  };
  for (const w of pointers) settle(w, "가리킴");
  for (const w of selves) settle(w, "제자리");
  // 문 — 맨바닥 가운데 선 「굳게 닫힌 철문」이 책장 앞을 막으면 책장 이벤트가 책장으로 못 간다(vm5 argon 방탈출). 문 이름 조사 칸을 먼저 문 그림 칸으로.
  {
    const project = run.ctx.project, map = project.maps[mapId]!;
    const doors = doorArtCells(project, map);
    const doorCells = new Set(doors.map((d) => d.y * map.width + d.x));
    for (const ev of map.events) {
      if (!isDoorName(nameOf(ev)) || sprited(ev) || JSON.stringify(ev.pages ?? []).includes("\"transfer\"") || !doors.length || onCells(map, ev, doorCells)) continue;
      const before = { x: ev.x, y: ev.y };
      const snapshot = run.ctx.project;
      repairEventReach(run, mapId, [ev.id]);
      const cur = run.ctx.project.maps[mapId]!;
      const now = cur.events.find((e) => e.id === ev.id)!;
      if (onCells(cur, now, doorCells)) notes.push(`문: 「${nameOf(ev)}」 (${before.x},${before.y})→(${now.x},${now.y}) 문 그림 칸`);
      else run.ctx.project = snapshot;
    }
  }
  // 이름 — 「벽에 걸린 그림」이 상자 칸에 있으면 그림 칸으로(eventReach 의 이름 물건 맞추기는 닿지 않는 이벤트에만 돌았다, vm4 argon 방탈출).
  // 못 옮기면(그림 앞에 설 칸이 없다) 그대로 둔다 — 대사를 바꾸지 않는다.
  for (const ev of run.ctx.project.maps[mapId]!.events) {
    const host = hostMentions(nameOf(ev))[0];
    if (!host || !movable(ev) || pointers.some((w) => w.eventId === ev.id) || selves.some((w) => w.eventId === ev.id)) continue;
    const map = run.ctx.project.maps[mapId]!;
    const cells = objectCells(run.ctx.project, map, host.words);
    if (!cells.size || onCells(map, ev, cells)) continue;
    const snapshot = run.ctx.project;
    const before = { x: ev.x, y: ev.y };
    if (pagesOf(ev).some((p) => p.footprint)) {
      const events = map.events.map((e) => e.id !== ev.id ? e : { ...e, pages: (e.pages ?? []).map((p) => { const { footprint: _f, ...rest } = p as typeof p & { footprint?: unknown }; return rest as typeof p; }) });
      run.ctx.project = { ...snapshot, maps: { ...snapshot.maps, [mapId]: { ...map, events } } };
    }
    repairEventReach(run, mapId, [ev.id], new Map([[ev.id, [host.words]]]));
    let now = run.ctx.project.maps[mapId]!.events.find((e) => e.id === ev.id)!;
    // 그 물건 앞 맨바닥에 이름 없는(물건 낱말 없는) 투명 조사 칸이 서서 막으면 잠시 빼고 다시 놓은 뒤, 그 칸은 닿는 다른 바닥으로 보낸다
    // (vm5 argon 방탈출: 길목 비우기가 「벽의 장치」를 책장 앞 (6,4)에 세워 「먼지 쌓인 책장」이 책장으로 못 갔다).
    if (!onCells(run.ctx.project.maps[mapId]!, now, cells)) {
      const cur = run.ctx.project.maps[mapId]!;
      const nearHost = (e: GameEvent) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => cells.has((e.y + dy!) * cur.width + e.x + dx!));
      const blockers = cur.events.filter((e) => e.id !== ev.id && movable(e) && !hostMentions(nameOf(e)).length && !objectAt(cur, e) && nearHost(e));
      if (blockers.length) {
        const ids = new Set(blockers.map((e) => e.id));
        run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...cur, events: cur.events.filter((e) => !ids.has(e.id)) } } };
        repairEventReach(run, mapId, [ev.id], new Map([[ev.id, [host.words]]]));
        const after = run.ctx.project.maps[mapId]!;
        run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...after, events: [...after.events, ...blockers] } } };
        const moved = repairEventReach(run, mapId, [...ids]);
        now = run.ctx.project.maps[mapId]!.events.find((e) => e.id === ev.id)!;
        if (onCells(run.ctx.project.maps[mapId]!, now, cells) && !unreachableEvents(run.ctx.project, mapId).some((id) => ids.has(id) || id === ev.id) && !moved.stuck.length) {
          notes.push(`이름: 앞을 막던 ${blockers.map((b) => `「${nameOf(b)}」`).join("·")} 옮김(${moved.moved.join(", ")})`);
        } else { run.ctx.project = snapshot; continue; }
      }
    }
    if (onCells(run.ctx.project.maps[mapId]!, now, cells)) notes.push(`이름: 「${nameOf(ev)}」 (${before.x},${before.y})→(${now.x},${now.y}) ${host.word} 위`);
    else run.ctx.project = snapshot;
  }
  return notes;
}

/**
 * 앞 판 경로 빌드가 남긴 죽은 단서 고리를 걷어 낸다 — 경로 빌더 이벤트(ev_chain_*, 봉인 문 제외)이면서 지금 청사진 단계 이벤트가 아니고,
 * 켜는 스위치·주는 아이템을 다른 어떤 이벤트·공통 이벤트도 받지 않으며, 엔딩·이동·전투가 없는 것.
 */
export function dropStaleChainClues(project0: Project): { project: Project; notes: string[] } {
  const bp = project0.gameBlueprint;
  if (!bp?.steps?.length) return { project: project0, notes: [] };
  const norm = (s: string) => s.replace(/\s+/gu, "").toLowerCase();
  const stepNames = new Set(bp.steps.map((s) => norm(s.event)));
  const all = Object.values(project0.maps).flatMap((m) => (m.events ?? []).map((e) => ({ m, e })));
  const taken = new Map<string, Set<string>>();
  for (const { e } of all) taken.set(e.id, takesOf(e));
  const common = JSON.stringify((project0 as { commonEvents?: unknown }).commonEvents ?? {});
  const drop = new Map<string, Set<string>>();
  const notes: string[] = [];
  for (const { m, e } of all) {
    if (!e.id.startsWith("ev_chain_") || e.id.startsWith("ev_chain_seal_")) continue;
    if (stepNames.has(norm(nameOf(e))) || stepNames.has(norm(e.id))) continue;
    const raw = JSON.stringify(e.pages ?? []);
    if (/"kind":"(?:triggerEnding|transfer|battleProcessing|shop|recruit)"/u.test(raw)) continue;
    const g = givesOf(e);
    const ids = [...g.switches, ...g.items];
    if (!ids.length) continue;
    if (ids.some((id) => common.includes(`"${id}"`) || all.some(({ e: o }) => o.id !== e.id && taken.get(o.id)!.has(id)))) continue;
    (drop.get(m.id) ?? drop.set(m.id, new Set()).get(m.id)!).add(e.id);
    notes.push(`「${nameOf(e) || e.id}」(${e.x},${e.y})`);
  }
  if (!drop.size) return { project: project0, notes };
  const maps = { ...project0.maps };
  for (const [mapId, ids] of drop) maps[mapId] = { ...maps[mapId]!, events: maps[mapId]!.events.filter((e) => !ids.has(e.id)) };
  return { project: { ...project0, maps }, notes };
}
