// 청사진 경로의 문 — 열쇠로 여는 입구 잠그기(gateKeyedEntrances), 도착하면 켜지는 단계(gateEntrySteps), 잠긴 문 글이 다음 단서를 가리키게(pointLockedPagesIn), 단계 순서대로 문 잠그기(lockStepOrderDoorsIn).
import type { GameMap, Project } from "@/project/types";
import type { BuildRun } from "../shared/types";
import { eventGives } from "./blueprint";
import { bearingWord, landmarkWord } from "../judge/objectiveWhere";
import { norm, sameName, mapFor, isItem, josa, towardJosa, RawPage } from "./blueprintPathNames";

/** 이벤트 페이지들이 옮겨 가는 맵 id. */
function transfersTo(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) { for (const v of value) transfersTo(v, out); return out; }
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
  for (const child of Object.values(record)) if (child && typeof child === "object") transfersTo(child, out);
  return out;
}

const KEY_WORD = /열쇠|키\b|key/iu;

/** 청사진 needs 의 열쇠로 앞 맵 → 그 단계 맵 문을 잠근다(잠긴 페이지 + 열쇠가 있을 때의 원래 페이지). 이미 잠갔으면 그대로. */
export function gateKeyedEntrances(run: BuildRun): string[] {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  bp.steps.forEach((step, k) => {
    if (k === 0) return;
    const need = step.needs?.trim();
    if (!need || /^(시작|없음|none|start)$/iu.test(need) || !isItem(need) || !KEY_WORD.test(need)) return;
    const here = mapFor(run.ctx.project, step.place);
    const prev = mapFor(run.ctx.project, bp.steps[k - 1]!.place);
    if (!here || !prev || here.id === prev.id) return;
    const item = run.ctx.project.database.items.find((i) => sameName(i.name ?? "", need));
    if (!item) return;
    for (const gate of prev.events ?? []) {
      const pages = gate.pages ?? [];
      if (!pages.length || !transfersTo(pages, new Set()).has(here.id)) continue;
      if (pages.some((p) => (p.conditions ?? []).some((c) => (c as { kind?: string; itemId?: string }).kind === "item" && (c as { itemId?: string }).itemId === item.id))) continue;
      const first = pages[0]!;
      const locked = { ...structuredClone(first), id: `${first.id ?? "p"}_locked`, name: "잠김", conditions: [], commands: [{ kind: "text", body: `${need}${josa(need, "이", "가")} 있어야 들어갈 수 있을 것 같다.` }] };
      const open = pages.map((p) => ({ ...structuredClone(p), conditions: [...(p.conditions ?? []), { kind: "item", itemId: item.id, present: true }] }));
      const event = { ...structuredClone(gate), pages: [locked, ...open] };
      if (run.call("upsert_event", { mapId: prev.id, event: event as unknown as Record<string, unknown>, replacePages: true }).ok) notes.push(`${prev.name ?? prev.id} → ${here.name ?? here.id} 문(${gate.x},${gate.y})을 「${need}」로 잠갔다`);
    }
  });
  return notes;
}

/** 명령 나무에서 그 맵으로 옮기는 첫 칸. */
function transferArrival(value: unknown, mapId: string): { x: number; y: number } | undefined {
  if (Array.isArray(value)) { for (const v of value) { const hit = transferArrival(v, mapId); if (hit) return hit; } return undefined; }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.kind === "transfer" && record.mapId === mapId && typeof record.x === "number" && typeof record.y === "number") return { x: record.x, y: record.y };
  for (const child of Object.values(record)) if (child && typeof child === "object") { const hit = transferArrival(child, mapId); if (hit) return hit; }
  return undefined;
}

/** 「문을 열고 <다음 장소>로 들어간다」 — 다음 장소에 들어가는 것이 이 단계의 일인 말. */
const ENTRY_WORD = /들어가|들어간|들어서|진입|입장|안으로/u;

/**
 * 「<다음 장소>로 들어간다」 단계(열쇠 관문 gateKeyedEntrances 와 같은 틀, 2026-10-29 vm1 argon jrpg): 청사진 s2 「마왕의 문 열기」(동굴)
 * 가 「열쇠로 굳게 닫힌 문을 열고 마왕의 방으로 들어간다」 인데 그 이벤트는 스위치만 켜고 아무 데로도 옮기지 않았고, 마왕의 방은 마을 문
 * (24,0)으로 잠금 없이 들어가졌다 — 동굴의 문은 장식이 됐고 목표는 「마을로 돌아가 마왕의 방으로」를 가리켰다.
 * 단계 글(action·gives)이 다음 단계 장소 이름과 들어가는 말을 함께 담고, 다음 단계가 다른 맵이면:
 *  - 그 단계 이벤트가 켜는 스위치(다음 단계 이벤트가 조건으로 읽는 것 우선)로 다음 맵으로 들어가는 다른 문들을 잠그고,
 *  - 이 맵에 다음 맵으로 가는 문이 없으면 그 이벤트가 스위치를 켠 페이지 끝에서 다음 맵의 들어오는 자리로 옮긴다.
 * 결정적·되풀이 안전(이미 잠긴 문·이미 옮기는 페이지는 건드리지 않는다).
 */
export function gateEntrySteps(run: BuildRun): string[] {
  const bp = run.ctx.project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const findEvent = (ref: string) => {
    for (const map of Object.values(run.ctx.project.maps)) {
      const ev = (map.events ?? []).find((e) => e.id === ref) ?? (map.events ?? []).find((e) => norm(String((e as { name?: string }).name ?? "")) === norm(ref));
      if (ev) return { map, ev };
    }
    for (const map of Object.values(run.ctx.project.maps)) {
      const ev = (map.events ?? []).find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), ref));
      if (ev) return { map, ev };
    }
    return undefined;
  };
  bp.steps.forEach((step, k) => {
    const nextStep = bp.steps[k + 1];
    if (!nextStep) return;
    const cur = findEvent(step.event);
    const nxt = findEvent(nextStep.event);
    if (!cur || !nxt || cur.map.id === nxt.map.id) return;
    const target = nxt.map;
    const words = `${step.action ?? ""} ${step.gives ?? ""}`;
    if (!ENTRY_WORD.test(words) || !norm(words).includes(norm(String(target.name ?? nextStep.place)))) return;
    const pages = (cur.ev.pages ?? []) as unknown as RawPage[];
    const setsOf = (page: RawPage): string[] => {
      const out: string[] = [];
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (!value || typeof value !== "object") return;
        const r = value as Record<string, unknown>;
        if (r.kind === "setSwitch" && r.value === true && typeof r.switchId === "string") out.push(r.switchId);
        Object.values(r).forEach((child) => { if (child && typeof child === "object") walk(child); });
      };
      walk(page.commands ?? []);
      return out;
    };
    const readByNext = new Set([...JSON.stringify(nxt.ev.pages ?? []).matchAll(/"switchId":"([^"]+)"/gu)].map((m) => m[1]!));
    const milestone = pages.find((page) => setsOf(page).some((id) => readByNext.has(id))) ?? pages.find((page) => setsOf(page).length > 0);
    if (!milestone) return;
    const sw = setsOf(milestone).find((id) => readByNext.has(id)) ?? setsOf(milestone)[0]!;
    // 다음 맵으로 들어가는 문들(다음 맵 자신의 이벤트는 빼고) — 들어오는 자리는 첫 문의 옮기기 칸.
    const doors: { map: GameMap; ev: GameMap["events"][number] }[] = [];
    let arrival: { x: number; y: number } | undefined;
    for (const map of Object.values(run.ctx.project.maps)) {
      if (map.id === target.id) continue;
      for (const ev of map.events ?? []) {
        if (ev.id === cur.ev.id || !transfersTo(ev.pages ?? [], new Set()).has(target.id)) continue;
        doors.push({ map, ev });
        if (!arrival) {
          arrival = transferArrival(ev.pages ?? [], target.id);
        }
      }
    }
    for (const door of doors) {
      const dpages = (door.ev.pages ?? []) as unknown as RawPage[];
      if (!dpages.length || dpages.some((p) => (p.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === sw))) continue;
      const first = dpages[0]!;
      const body = door.map.id === cur.map.id ? "문이 굳게 닫혀 있다." : `아직 이 길은 닫혀 있다. ${cur.map.name ?? ""}에서 길을 열어야 할 것 같다.`.replace("  ", " ");
      const locked = { ...structuredClone(first), id: `${String(first.id ?? "p")}_shut`, name: "닫힘", conditions: [], commands: [{ kind: "text", body }] };
      const open = dpages.map((p) => ({ ...structuredClone(p), conditions: [...(p.conditions ?? []), { kind: "switch", switchId: sw, value: true }] }));
      if (run.call("upsert_event", { mapId: door.map.id, event: { ...structuredClone(door.ev), pages: [locked, ...open] } as unknown as Record<string, unknown>, replacePages: true }).ok)
        notes.push(`${door.map.name ?? door.map.id} → ${target.name ?? target.id} 문(${door.ev.x},${door.ev.y})을 「${step.event}」 뒤에만 열리게 했다`);
    }
    const hereHasDoor = doors.some((d) => d.map.id === cur.map.id);
    if (!hereHasDoor && arrival && !transfersTo(milestone.commands ?? [], new Set()).has(target.id)) {
      const index = pages.indexOf(milestone);
      const moved = pages.map((page, i) => i === index ? { ...structuredClone(page), commands: [...(page.commands ?? []), { kind: "transfer", mapId: target.id, x: arrival!.x, y: arrival!.y, fade: "black" }] } : structuredClone(page));
      if (run.call("upsert_event", { mapId: cur.map.id, event: { ...structuredClone(cur.ev), pages: moved } as unknown as Record<string, unknown>, replacePages: true }).ok)
        notes.push(`「${String((cur.ev as { name?: string }).name ?? cur.ev.id)}」 이 문을 연 뒤 ${target.name ?? target.id}(${arrival.x},${arrival.y})로 옮긴다`);
    }
  });
  return notes;
}

/**
 * 잠긴 조사 대사가 무엇을 먼저 해야 하는지 말하게 한다 — 대사만 있는 조건 없는 페이지(잠김)와 스위치·아이템 조건 페이지(열림)를 가진
 * 이벤트에서, 그 조건을 켜는·주는 이벤트가 한 곳뿐이고 잠김 대사가 그 이름을 말하지 않으면 「먼저 <자리> 「그 이벤트」…」 한 줄을 덧붙인다.
 * 왜(2026-10-29 vm3 판정): argon 추리 「열린 창문」은 「아직 조사할 필요가 없다」만 되풀이해 앞 단계(여관 주인)를 몰랐고,
 * deepseek jrpg 계단은 「동굴 안쪽의 봉인을 먼저 풀어야」라 했지만 봉인은 계단 바로 옆 투명 칸이었다. 보스 잠김 대사(orderStepBattlesIn)와 같은 방식.
 */
export function pointLockedPagesIn(project: Project): string[] {
  type Ev = GameMap["events"][number];
  type Cmd = { kind?: string; body?: string; switchId?: string; itemId?: string; value?: unknown; op?: string; amount?: number };
  const notes: string[] = [];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const cmdsOf = (ev: Ev): Cmd[] => {
    const out: Cmd[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      const c = node as Cmd & Record<string, unknown>;
      if (typeof c.kind === "string") out.push(c);
      for (const v of Object.values(c)) if (v && typeof v === "object") visit(v);
    };
    for (const page of ev.pages ?? []) visit(page.commands);
    return out;
  };
  const setters = (kind: "switch" | "item", id: string) => all.filter((r) => cmdsOf(r.ev).some((c) => kind === "switch" ? c.kind === "setSwitch" && c.switchId === id && c.value !== false : c.kind === "changeItem" && c.itemId === id && (c.op === undefined || c.op === "+=") && (c.amount ?? 1) > 0));
  const TEXT_ONLY = new Set(["text", "changeFace", "wait", "playSe", "showBalloon"]);
  const named = (ev: Ev) => String((ev as { name?: string }).name ?? "").trim();
  const stepIds = new Set((project.gameBlueprint?.steps ?? []).flatMap((step) => all.filter((r) => r.ev.id === step.event || norm(named(r.ev)) === norm(step.event)).map((r) => r.ev.id)));
  // 사물 칩(문·상자·철창 — Object 시트)은 사람이 아니다 — 「봉인된 동굴 문에게 말을 걸어 보자」가 되지 않게(2026-10-29 vm5 deepseek jrpg).
  const person = (ev: Ev) => (ev.pages ?? []).some((p) => { const g = (p.graphic ?? {}) as { sprite?: { id?: unknown }; appearanceId?: unknown; transparent?: boolean }; return g.transparent !== true && (Boolean(g.appearanceId) || (Boolean(g.sprite) && !/charset_object|_object\d|objects?$/iu.test(String(g.sprite?.id ?? "")))); });
  for (const { map, ev } of all) {
    const pages = (ev.pages ?? []) as unknown as RawPage[];
    if (pages.length < 2) continue;
    const lockedAt = pages.findIndex((p) => !(p.conditions ?? []).length && (p.commands ?? []).length > 0 && ((p.commands ?? []) as Cmd[]).every((c) => TEXT_ONLY.has(String(c.kind))) && ((p.commands ?? []) as Cmd[]).some((c) => c.kind === "text"));
    if (lockedAt < 0) continue;
    const open = pages.find((p, i) => i > lockedAt && (p.conditions ?? []).length > 0);
    const need: { kind: "switch" | "item"; id: string }[] = ((open?.conditions ?? []) as { kind?: string; switchId?: string; itemId?: string; value?: unknown; present?: unknown }[])
      .flatMap((c): { kind: "switch" | "item"; id: string }[] => c.kind === "switch" && c.switchId && c.value !== false ? [{ kind: "switch", id: c.switchId }] : c.kind === "item" && c.itemId && c.present !== false ? [{ kind: "item", id: c.itemId }] : []);
    if (need.length !== 1) continue;
    // 열림 페이지가 실제로 길을 여는 것(옮기기·켜기·주기·싸움·엔딩)만 — 인물의 진행별 잡담(대사만 바뀌는 페이지)에는 덧붙이지 않는다.
    // 단계 순서 잠금(lockStepOrderDoorsIn)이 열림 페이지 앞에 같은 조건의 「닫힘」 대사 페이지를 끼우므로 뒤 페이지들까지 본다.
    if (!/"kind":"(?:transfer|setSwitch|changeItem|battleProcessing|triggerEnding)"/u.test(JSON.stringify(pages.slice(lockedAt + 1).map((p) => p.commands ?? [])))) continue;
    if (person(ev) && !stepIds.has(ev.id)) continue;
    const by = setters(need[0]!.kind, need[0]!.id).filter((r) => r.ev.id !== ev.id);
    if (by.length !== 1) continue;
    const src = by[0]!;
    const name = named(src.ev);
    if (!name || /^ev_/u.test(name)) continue;
    const texts = ((pages[lockedAt]!.commands ?? []) as Cmd[]).filter((c) => c.kind === "text");
    // 말하는 사람의 대사(용의자 첫 탐문·「여관 주인: …」)는 잠김 안내가 아니다 — 대사 뒤에 「먼저 …」를 붙이지 않는다(vm5 argon 추리 상인 오언).
    if (texts.some((c) => typeof (c as { speaker?: unknown }).speaker === "string" && String((c as { speaker?: unknown }).speaker).trim() || /^[^:：\s]{1,8}\s?[:：]\s/u.test(String(c.body ?? ""))) || / · 탐문$/u.test(String(pages[lockedAt]!.name ?? ""))) continue;
    const flat = (s: string) => s.replace(/[\s「」『』]/gu, "");
    // 인물은 말하는 이름으로(이벤트 이름이 「촌장의 부탁」 같은 일 제목이면 「촌장 보른」).
    const speakers = cmdsOf(src.ev).flatMap((c) => typeof (c as { speaker?: unknown }).speaker === "string" && (c as { speaker: string }).speaker.trim() ? [(c as { speaker: string }).speaker.trim()] : []);
    const speaker = speakers.sort((a, b) => speakers.filter((x) => x === b).length - speakers.filter((x) => x === a).length)[0];
    const mentioned = texts.some((c) => flat(String(c.body ?? "")).includes(flat(name)) || (speaker && flat(String(c.body ?? "")).includes(flat(speaker))));
    // 이미 이름을 대는데(「동굴 열쇠가 있어야 한다」 — 주는 것이 그 물건 자체) 어디인지 없으면 자리만 붙인다(2026-10-29 vm8 flash jrpg).
    // 「먼저」는 자리가 아니다 — 「먼저 동굴의 흔적을 살피자.」만 말하던 잠김 대사가 이 검사에 걸려 자리를 못 받았다
    // (2026-10-31 jb3b terra jrpg: 흔적은 잠긴 「새벽의 귀환」 바로 서쪽 칸이었고 판정자는 30분 동안 동굴을 돌았다).
    const located = texts.some((c) => /에 있다|근처|옆|쪽/u.test(String(c.body ?? "")));
    if (mentioned && (located || person(src.ev))) continue;
    // 물건은 눈에 띄는 것에 기대어(「회복의 샘 서쪽」), 사람은 방위로.
    const spot = landmarkWord(project, src.map, src.ev.x, src.ev.y, [src.ev.id, ev.id]);
    const where = (src.map.id === map.id
      ? (person(src.ev) ? `${bearingWord({ x: ev.x, y: ev.y }, { x: src.ev.x, y: src.ev.y })}의 ` : `${spot}의 `)
      : `${src.map.name ?? src.map.id}${person(src.ev) ? "" : ` ${spot}`}의 `);
    const line = mentioned
      ? `「${name}」${josa(name, "은", "는")} ${where.replace(/의 $/u, "")}에 있다.`
      : person(src.ev) ? `먼저 ${where}「${speaker ?? name}」에게 말을 걸어 보자.` : `먼저 ${where}「${name}」${josa(name, "을", "를")} 살펴보자.`;
    const next = structuredClone(pages);
    (next[lockedAt]!.commands as Cmd[]).push({ kind: "text", body: line });
    map.events = map.events.map((e) => e.id === ev.id ? { ...e, pages: next as unknown as typeof e.pages } : e);
    notes.push(`「${named(ev) || ev.id}」 잠김 대사가 「${name}」 을 가리킨다`);
  }
  return notes;
}

/**
 * 단계 순서 문 잠금 — 청사진 단계 k(맵 A) 다음 단계 k+1 이 다른 맵 B 에 있으면, A 에서 B 로 가는 문·계단을 단계 k 가 켜는(주는) 것으로 잠근다.
 * 왜(2026-10-29 vm5 deepseek jrpg): 지하 1층 계단은 「봉인된 동굴 문」 스위치로만 열려 「빛의 검」(같은 층 제단)을 뽑기 전에 지하 2층으로 내려가졌고,
 * 판정자는 2층에서 제단·옥좌를 찾다 시간이 다 갔다. 마을 서쪽 길 끝 출구도 조건 없는 첫 페이지가 옮겨 열쇠 없이 동굴에 들어가졌다
 * (모델이 열쇠 조건 페이지를 뒤에 두었을 뿐). 열쇠 관문(gateKeyedEntrances)·들어가기 단계(gateEntrySteps)는 경로를 다시 지을 때만 돌고
 * 「들어간다」 낱말·열쇠 낱말에 묶여 있어, 끝맺음에서 낱말 없이 단계 순서만 보고 건다.
 *  - 잠그는 것은 다음 단계 이벤트가 조건으로 읽는 스위치·아이템 중 단계 k 이벤트가 켜는·주는 것(없으면 건너뜀).
 *  - 단계 0..k 중 하나라도 B 에 있으면(B 를 앞서 지나야 하면) 건너뛴다. 시작 맵에서 B 를 거치지 않고 A 에 닿지 못해도 건너뛴다.
 *  - B 로 옮기는 페이지마다, 같은 조건의 「닫힘」 페이지를 바로 앞에 두고 원래 페이지에 그 조건을 더한다(뒤 페이지가 이긴다).
 * 결정적·되풀이 안전(이미 그 조건이 있는 페이지는 건드리지 않는다).
 */
export function lockStepOrderDoorsIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  type Ev = GameMap["events"][number];
  type Cond = { kind?: string; switchId?: string; itemId?: string; value?: unknown; present?: unknown };
  const notes: string[] = [];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const named = (ev: Ev) => String((ev as { name?: string }).name ?? "").trim();
  const stepEvents = bp.steps.map((step) => all.find((r) => r.ev.id === step.event) ?? all.find((r) => norm(named(r.ev)) === norm(step.event)) ?? all.find((r) => !r.ev.id.startsWith("ev_objective") && sameName(named(r.ev), step.event)));
  /** 시작 맵에서 B 를 거치지 않고 닿는 맵들. */
  const reachWithout = (avoid: string): Set<string> => {
    const seen = new Set<string>([project.startMapId]);
    const queue = [project.startMapId];
    for (let i = 0; i < queue.length; i += 1) {
      const map = project.maps[queue[i]!];
      if (!map) continue;
      for (const ev of map.events ?? []) for (const id of transfersTo(ev.pages ?? [], new Set())) {
        if (id === avoid || seen.has(id) || !project.maps[id]) continue;
        seen.add(id);
        queue.push(id);
      }
    }
    return seen;
  };
  const condHas = (page: RawPage, c: Cond) => ((page.conditions ?? []) as Cond[]).some((x) => x.kind === c.kind && (c.kind === "switch" ? x.switchId === c.switchId && x.value !== false : x.itemId === c.itemId && x.present !== false));
  bp.steps.forEach((step, k) => {
    const cur = stepEvents[k];
    const nxt = stepEvents[k + 1];
    if (!cur || !nxt || cur.map.id === nxt.map.id) return;
    const target = nxt.map;
    if (stepEvents.slice(0, k + 1).some((r) => r?.map.id === target.id)) return;
    if (!reachWithout(target.id).has(cur.map.id)) return;
    // 시작 맵·앞 단계로 가는 길목(허브 홀)은 잠그지 않는다 — 모든 앞 단계 맵이 B 를 거치지 않고 닿아야 한다
    // (vm3 deepseek 방탈출: 마지막 단계가 현관 홀이라 응접실→홀 문까지 잠그면 서재로 못 간다).
    const others = target.id === project.startMapId || stepEvents.slice(0, k + 1).some((r) => r && !reachWithout(target.id).has(r.map.id)) ? new Set([cur.map.id]) : undefined;
    const gives = eventGives(project, cur.ev);
    const reads = ((nxt.ev.pages ?? []) as unknown as RawPage[]).flatMap((p) => (p.conditions ?? []) as Cond[]);
    const readSwitch = reads.find((c) => c.kind === "switch" && c.value !== false && c.switchId && gives.switches.includes(c.switchId));
    const readItem = reads.find((c) => c.kind === "item" && c.present !== false && c.itemId && gives.items.includes(c.itemId));
    const cond: Cond | undefined = readSwitch ? { kind: "switch", switchId: readSwitch.switchId, value: true } : readItem ? { kind: "item", itemId: readItem.itemId, present: true } : undefined;
    if (!cond) return;
    const stepName = named(cur.ev) || step.event;
    // 단계 이벤트가 사람이면 말하는 이름으로(「촌장의 부탁」 → 「촌장 노인」에게 말을 걸어 보자).
    const speakers = JSON.stringify(cur.ev.pages ?? []).match(/"speaker":"([^"]+)"/gu)?.map((m) => m.slice(11, -1).trim()).filter(Boolean) ?? [];
    const speaker = speakers.sort((a, b) => speakers.filter((x) => x === b).length - speakers.filter((x) => x === a).length)[0];
    const itemName = cond.kind === "item" ? String(project.database.items.find((i) => i.id === cond.itemId)?.name ?? "").trim() : "";
    // 단계 k 맵의 문뿐 아니라 B 로 가는 모든 맵의 문을 잠근다 — 2026-10-29 vm3 argon jrpg: 단계 1(결계 해제)은 동굴, 단계 2(최후의 결전)는 옥좌인데
    // 마을 서쪽 가장자리 (0,20)이 조건 없이 옥좌로 옮겨 동굴·결계를 건너뛰었다(동굴 문만 잠갔다).
    for (const doorMap of Object.values(project.maps)) for (const door of doorMap.events ?? []) {
      if (doorMap.id === target.id || door.id === cur.ev.id || (others && !others.has(doorMap.id))) continue;
      const pages = (door.pages ?? []) as unknown as RawPage[];
      if (!pages.some((p) => transfersTo(p.commands ?? [], new Set()).has(target.id) && !condHas(p, cond))) continue;
      const bearing = doorMap.id === cur.map.id ? bearingWord({ x: door.x, y: door.y }, { x: cur.ev.x, y: cur.ev.y }) : "";
      const where = doorMap.id !== cur.map.id ? `${cur.map.name ?? cur.map.id}의` : bearing === "바로 옆" ? "바로 옆" : `${bearing}의`;
      const place = String(target.name ?? "").trim();
      const first = itemName ? `${itemName}${josa(itemName, "이", "가")} 있어야 이 길로 갈 수 있을 것 같다.` : place ? `아직 ${place}${towardJosa(place)} 갈 때가 아니다.` : "아직 이 길로 갈 때가 아니다.";
      const body = `${first} ${speaker ? `먼저 ${where} 「${speaker}」에게 말을 걸어 보자.` : `먼저 ${where} 「${stepName}」${josa(stepName, "을", "를")} 찾아보자.`}`;
      const next: RawPage[] = [];
      pages.forEach((p, i) => {
        if (!transfersTo(p.commands ?? [], new Set()).has(target.id) || condHas(p, cond)) { next.push(structuredClone(p)); return; }
        next.push({ ...structuredClone(p), id: `${String(p.id ?? `p${i}`)}_order`, name: "닫힘", commands: [{ kind: "text", body }] });
        next.push({ ...structuredClone(p), conditions: [...(p.conditions ?? []), cond] });
      });
      doorMap.events = doorMap.events.map((e) => e.id === door.id ? { ...e, pages: next as unknown as typeof e.pages } : e);
      notes.push(`${doorMap.name ?? doorMap.id} → ${target.name ?? target.id} (${door.x},${door.y})를 「${stepName}」 뒤에만 열리게`);
    }
  });
  return notes;
}
