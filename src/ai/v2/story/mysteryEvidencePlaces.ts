// 추리 사건의 증거 자리 — 증거를 물건 위에 놓고(evidenceOnThing) 대사의 자리 말을 실제 자리와 맞춘다(realignEvidencePlaces).
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, unreachableEvents } from "../judge/eventReach";
import { mapRegion } from "../judge/objectiveWhere";
import { isPassable } from "@/project/collision";
import { tileLabel } from "../place/cells";
import type { BuildRun } from "../shared/types";
import { Obj, nameOf, visiblePerson, walkCommands, jo, KEY_ITEM, say, narrate, evidenceSpot, thingWords, resolveSteps } from "./mysteryCaseRead";

/** 맵·청사진 안의 이벤트 id 참조를 바꾼다(따옴표로 감싼 정확한 id 만 — 페이지 id `…_p0` 같은 앞부분 일치는 건드리지 않는다). */
function renameEventId(project: Project, oldId: string, newId: string): Project {
  const escaped = oldId.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&");
  const quoted = new RegExp(`"${escaped}"`, "gu");
  const maps = { ...project.maps };
  for (const [mapId, map] of Object.entries(project.maps)) {
    const text = JSON.stringify(map.events ?? []);
    if (text.includes(`"${oldId}"`)) maps[mapId] = { ...map, events: JSON.parse(text.replace(quoted, `"${newId}"`)) as GameEvent[] };
  }
  const bp = project.gameBlueprint;
  return { ...project, maps, ...(bp ? { gameBlueprint: { ...bp, steps: bp.steps.map((st) => (st.event === oldId ? { ...st, event: newId } : st)) } } : {}) };
}

/** 사람이 증거 자리를 일러 주는 두 줄 — 처음 듣는 말(HINT_FIRST: 증거를 주던 자리에 들어간다)과 다시 물을 때의 말(HINT_AGAIN). */
const HINT_FIRST = /^그러고 보니 소동 뒤에 (.+) 바닥에서 뭔가 반짝이던데… 한번 살펴보게\.$/u;
const HINT_AGAIN = /^.+ 바닥을 살펴보게\. 범인이 흘린 게 있을지도 모르네\.$/u;
const HINT = { test: (body: string) => HINT_FIRST.test(body) || HINT_AGAIN.test(body) };
const hintAgain = (near: string) => `${near} 바닥을 살펴보게. 범인이 흘린 게 있을지도 모르네.`;

/**
 * 말로 건네는 증거인가 — 청사진의 말하는 단계(kind talk)가 gives 에 적은 그대로의 이름이면(「사건 의뢰」「정전 증언」) 그 사람의 말이 곧 증거다.
 * 바닥 칸으로 옮기는 것은 세우기가 지어낸 물건(진행 낱말 대신 고른 「떨어진 은단추」, 괄호에서 뽑은 이름)뿐이다.
 * 왜(2026-11-12 r1-mystery, 엔딩 못 봄): 첫 단계 「서진」이 주는 「사건 의뢰」가 다른 맵 건물 앞 바닥 칸이 됐다. 서진은 그 자리를 처음 한 번만 말했고
 * 판정자는 끝까지 줍지 못했다 — 사슬은 다 켜졌는데 지목이 안 열렸다.
 */
function saidInTalk(project: Project, mapId: string, giver: GameEvent, name: string): boolean {
  const steps = project.gameBlueprint?.steps;
  if (!steps) return false;
  return resolveSteps(project).some((r) => r.map.id === mapId && r.ev.id === giver.id && (steps[r.k] as { kind?: string } | undefined)?.kind === "talk" && String(r.step.gives ?? "").trim() === name);
}

/** 다시 묻는 페이지(증거를 일러 준 페이지가 켠 스위치로 열리는 대사 페이지)에도 자리를 일러 준다 — 증거를 아직 못 주웠을 때만. 붙였으면 true. */
function remindOnRepeat(pages: Obj[], pi: number, who: string, near: string, itemId: string): boolean {
  const set = new Set(((pages[pi]!.commands ?? []) as Obj[]).filter((c) => c.kind === "setSwitch" && c.value !== false).map((c) => String(c.switchId)));
  let added = false;
  for (const [k, pg] of pages.entries()) {
    if (k === pi) continue;
    const list = (pg.commands ?? []) as Obj[];
    const opens = ((pg.conditions ?? []) as Obj[]).some((c) => c.kind === "switch" && c.value !== false && set.has(String(c.switchId)));
    if (!opens || !list.some((c) => c.kind === "text") || JSON.stringify(list).includes(" 바닥을 살펴보게.")) continue;
    pg.commands = [...list, { kind: "fork", condition: { kind: "item", itemId, present: false }, then: [{ kind: "text", speaker: who, body: hintAgain(near) }] }];
    added = true;
  }
  return added;
}

/** 대사에서 증거 자리 귀띔 줄을 걷는다(갈래 안까지). 걷은 줄 수를 센다. 귀띔만 들어 있던 갈래(remindOnRepeat)는 갈래째 뺀다. */
function stripHints(list: unknown, count: { n: number }): unknown {
  if (!Array.isArray(list)) return list;
  const isHint = (c: unknown) => (c as Obj)?.kind === "text" && HINT.test(String((c as Obj).body ?? ""));
  const out: unknown[] = [];
  for (const c of list) {
    if (isHint(c)) { count.n += 1; continue; }
    if (!c || typeof c !== "object") { out.push(c); continue; }
    const o = { ...(c as Obj) };
    const hintOnly = o.kind === "fork" && Array.isArray(o.then) && o.then.length > 0 && o.then.every(isHint) && !((o.else as unknown[] | undefined)?.length);
    for (const k of ["then", "else", "commands", "branch", "otherwiseBranch", "cancelBranch"]) if (Array.isArray(o[k])) o[k] = stripHints(o[k], count);
    if (Array.isArray(o.options)) o.options = (o.options as Obj[]).map((opt) => (Array.isArray(opt.branch) ? { ...opt, branch: stripHints(opt.branch, count) } : opt));
    if (!hintOnly) out.push(o);
  }
  return out;
}

/**
 * 이미 바닥 칸이 된 말 증거를 되돌린다(저장된 판) — 자리를 일러 주던 줄 자리에 증거를 다시 주고, 칸과 나머지 귀띔을 걷는다.
 * 처음 귀띔 줄을 못 찾으면(모델이 대사를 고쳤다) 건드리지 않는다.
 */
function handBackToTalk(run: BuildRun, mapId: string, giver: GameEvent, spot: GameEvent, itemId: string, name: string): string | undefined {
  let put = false;
  const count = { n: 0 };
  const pages = (structuredClone(giver.pages ?? []) as unknown as Obj[]).map((pg) => {
    const list = ((pg.commands ?? []) as Obj[]).flatMap((c): Obj[] => {
      if (put || c.kind !== "text" || !HINT_FIRST.test(String(c.body ?? ""))) return [c];
      put = true;
      return [{ kind: "changeItem", itemId, op: "+=", amount: 1 }, { kind: "text", body: `『${name}』${jo(name, "을/를")} 증거로 챙겼다.` }];
    });
    const rest = stripHints(list, count) as Obj[];
    return { ...pg, commands: rest.length ? rest : say(nameOf(giver), ["이제 내가 아는 건 다 말했네."]) };
  });
  if (!put) return undefined;
  const snapshot = run.ctx.project;
  const ok = run.call("upsert_event", { mapId, replacePages: true, event: { id: giver.id, ...(nameOf(giver) ? { name: nameOf(giver) } : {}), pages } }).ok
    && run.call("remove_event", { mapId, eventId: spot.id }).ok;
  if (!ok) { run.ctx.project = snapshot; return undefined; }
  return `말로 건네는 증거 『${name}』${jo(name, "은/는")} 바닥 칸(${spot.x},${spot.y}) 대신 「${nameOf(giver) || giver.id}」의 말에서 바로 얻는다`;
}

/**
 * 증거 자리 안내가 허공을 가리키지 않게 — 사람이 「그러고 보니 소동 뒤에 <자리> 바닥에서 뭔가 반짝이던데…」「<자리> 바닥을 살펴보게…」라고 하는데
 * 그 사람의 조사 칸(`<id>_evidence`)이 없으면 그 두 줄을 뺀다. 그 id 를 사람(용의자)이 쥐고 있으면 사람 id 를 `<…>_person` 으로 바꾼다.
 * 왜(2026-10-29 vm7 argon 추리): 「주민 탐문」이 「가운데 안락의자 옆 바닥」을 보라고 했는데 그 조사 칸 id 를 용의자 「상인 도윤」이 쥐고 있었다
 * (다시 세운 사건이 같은 id 로 사람을 세웠다). 판정자는 안락의자 둘레를 여러 칸 눌러도 반응이 없어 진행이 막혔다고 했다.
 */
export function dropDanglingEvidenceHints(run: BuildRun): string[] {
  const notes: string[] = [];
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of [...(map.events ?? [])]) {
    if (!ev.id.endsWith("_evidence") || !visiblePerson(ev)) continue;
    const next = `${ev.id.replace(/_evidence$/u, "")}_person`;
    if (Object.values(run.ctx.project.maps).some((m) => (m.events ?? []).some((e) => e.id === next))) continue;
    run.ctx.project = renameEventId(run.ctx.project, ev.id, next);
    notes.push(`사람 「${nameOf(ev)}」이 증거 조사 칸 id(${ev.id})를 쥐고 있어 ${next} 로 바꿈`);
  }
  for (const [mapId, map] of Object.entries(run.ctx.project.maps)) {
    let changed = false;
    const events = (map.events ?? []).map((ev) => {
      if (!visiblePerson(ev) || evidenceSpot(map, ev.id)) return ev;
      const count = { n: 0 };
      const pages = (ev.pages ?? []).map((pg) => ({ ...pg, commands: stripHints(pg.commands ?? [], count) as typeof pg.commands }));
      const dropped = count.n;
      if (!dropped) return ev;
      changed = true;
      notes.push(`「${nameOf(ev)}」 대사에서 없는 증거 조사 칸을 가리키던 ${dropped}줄을 뺌`);
      // 그 사람의 페이지가 비면(「다시 말을 걸면 자리를 다시 일러 준다」 페이지) 「더는 볼 것이 없다」 대신 사람 말투로 한 줄.
      return { ...ev, pages: pages.map((pg) => ((pg.commands ?? []).length ? pg : { ...pg, commands: say(nameOf(ev), ["이제 내가 아는 건 다 말했네."]) })) };
    });
    if (changed) run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...map, events } } };
  }
  return notes;
}

/**
 * 지목 증거를 사람이 말 끝에 그냥 건네면(「…발소리를 들었어.」 → 「『떨어진 은단추』를 증거로 챙겼다.」) 그 물건을 바닥에 떨어진 조사 칸으로 옮긴다 —
 * 사람은 어디를 보라고 말하고(그 사람 이야기를 들은 뒤에만 열림), 플레이어가 그 칸을 조사해 증거를 얻는다. 되풀이 안전(`<사람 id>_evidence`).
 * 왜(2026-10-29 vm5 argon 추리, 감독 지적): 여관 주인이 발소리 얘기 뒤 아무 물건도 건네지 않았는데 증거가 손에 들어와 급전개였다.
 */
export function evidenceOnThing(run: BuildRun): string[] {
  const keys = new Set<string>();
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "presentItem") for (const o of (c.options ?? []) as Obj[]) if (typeof o.itemId === "string") keys.add(o.itemId);
  });
  const notes: string[] = [];
  for (const itemId of keys) {
    const item = run.ctx.project.database.items.find((i) => i.id === itemId);
    if (!item || KEY_ITEM.test(item.name ?? "")) continue;
    const name = String(item.name ?? "").trim();
    for (const map0 of Object.values(run.ctx.project.maps)) for (const giver of map0.events ?? []) {
      if (!visiblePerson(giver) || /^용의자|· 탐문$/u.test(nameOf(giver))) continue;
      if ((giver.pages ?? []).some((pg) => / · (탐문|증거)$/u.test(String((pg as { name?: string }).name ?? "")))) continue;
      const spotId = `${giver.id}_evidence`;
      const said = saidInTalk(run.ctx.project, map0.id, giver, name);
      // 그 id 를 사람이 쥐고 있으면(다시 세운 용의자) 칸이 있는 것으로 치지 않는다 — 사람 id 는 dropDanglingEvidenceHints 가 먼저 바꾼다.
      const standing = (map0.events ?? []).find((e) => e.id === spotId);
      if (standing) {
        if (visiblePerson(standing) || !JSON.stringify(standing.pages ?? []).includes(`"itemId":"${itemId}"`)) continue;
        if (said) { const back = handBackToTalk(run, map0.id, giver, standing, itemId, name); if (back) notes.push(back); continue; }
        // 이미 지어진 판: 다시 물을 때도 자리를 일러 주게 한다(처음 한 번만 말하면 놓친 사람은 다시 들을 길이 없다).
        const old = structuredClone(giver.pages ?? []) as unknown as Obj[];
        const at = old.findIndex((pg) => ((pg.commands ?? []) as Obj[]).some((c) => c.kind === "text" && HINT_FIRST.test(String(c.body ?? ""))));
        const told = at < 0 ? undefined : HINT_FIRST.exec(String(((old[at]!.commands ?? []) as Obj[]).find((c) => c.kind === "text" && HINT_FIRST.test(String(c.body ?? "")))!.body))?.[1];
        if (told && remindOnRepeat(old, at, nameOf(giver) || "그 사람", told, itemId)
          && run.call("upsert_event", { mapId: map0.id, replacePages: true, event: { id: giver.id, ...(nameOf(giver) ? { name: nameOf(giver) } : {}), pages: old } }).ok) notes.push(`「${nameOf(giver)}」에게 다시 물어도 증거 『${name}』 자리를 일러 준다`);
        continue;
      }
      // 말로 건네는 증거는 그 말이 건넨다 — 바닥 칸으로 옮기지 않는다.
      if (said) continue;
      const pages = structuredClone(giver.pages ?? []) as unknown as Obj[];
      const pi = pages.findIndex((pg) => ((pg.commands ?? []) as Obj[]).some((c) => c.kind === "changeItem" && c.itemId === itemId && c.op !== "-="));
      if (pi < 0) continue;
      const cmds = (pages[pi]!.commands ?? []) as Obj[];
      const gate = cmds.find((c) => c.kind === "setSwitch" && c.value !== false && !String(c.switchId).includes("taken"))?.switchId
        ?? cmds.find((c) => c.kind === "setSwitch" && c.value !== false)?.switchId;
      if (typeof gate !== "string") continue;
      const map = run.ctx.project.maps[map0.id]!;
      const spot = evidenceCell(run, map, giver);
      if (!spot) continue;
      const who = nameOf(giver) || "그 사람";
      // 의자·탁자는 방에 여럿이다 — 방위를 앞에 붙인다(「남서쪽 의자 옆」).
      const near = spot.near ? `${mapRegion(map, spot.x, spot.y)} ${spot.near} 옆` : mapRegion(map, spot.x, spot.y);
      const at = cmds.findIndex((c) => c.kind === "changeItem" && c.itemId === itemId);
      const next = cmds[at + 1];
      const drop = next && next.kind === "text" && typeof next.body === "string" && next.body.includes(`『${name}』`) ? 2 : 1;
      cmds.splice(at, drop, { kind: "text", speaker: who, body: `그러고 보니 소동 뒤에 ${near} 바닥에서 뭔가 반짝이던데… 한번 살펴보게.` });
      pages[pi]!.commands = cmds;
      // 다시 말을 걸면 「더는 볼 것이 없다」(조사 칸 말투) 대신 그 사람이 자리를 다시 일러 준다.
      for (const [k, pg] of pages.entries()) {
        const list = (pg.commands ?? []) as Obj[];
        if (k !== pi && list.length && list.every((c) => c.kind === "text" && /^더는 볼 것이 없다\.?$/u.test(String(c.body ?? "")))) pg.commands = [{ kind: "text", speaker: who, body: hintAgain(near) }];
      }
      remindOnRepeat(pages, pi, who, near, itemId);
      const before = new Set(unreachableEvents(run.ctx.project, map.id));
      const snapshot = run.ctx.project;
      const base = { trigger: { kind: "action" }, priority: "below", graphic: { transparent: true }, nearSparkle: { radius: 2 }, movement: { type: "fixed", speed: 3, frequency: 3 } };
      const spotPages: Obj[] = [
        { ...base, id: `${spotId}_p0`, name: "증거 물건 · 아직", conditions: [], commands: narrate([`바닥에 무언가 떨어져 있다. 먼저 「${who}」의 이야기를 들어 보자.`]) },
        { ...base, id: `${spotId}_p1`, name: "증거 물건", conditions: [{ kind: "switch", switchId: gate, value: true }], commands: [...narrate([`${near} 바닥에 『${name}』${jo(name, "이/가")} 떨어져 있다. 누군가 서둘러 떨어뜨린 것 같다.`]), { kind: "changeItem", itemId, op: "+=", amount: 1 } as unknown as Command, ...narrate([`『${name}』${jo(name, "을/를")} 증거로 챙겼다.`]), { kind: "setSelfSwitch", key: "A", value: true } as unknown as Command] },
        { ...base, id: `${spotId}_p2`, name: "증거 물건 · 끝", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: narrate(["더는 볼 것이 없다."]) },
      ];
      run.call("upsert_event", { mapId: map.id, replacePages: true, event: { id: giver.id, ...(nameOf(giver) ? { name: nameOf(giver) } : {}), pages } });
      run.call("upsert_event", { mapId: map.id, event: { id: spotId, name, x: spot.x, y: spot.y, pages: spotPages } });
      if (unreachableEvents(run.ctx.project, map.id).some((id) => !before.has(id))) { run.ctx.project = snapshot; continue; }
      notes.push(`증거 『${name}』${jo(name, "을/를")} 「${who}」${jo(who, "이/가")} 건네지 않고 (${spot.x},${spot.y}) ${near} 바닥 조사로(이야기를 들은 뒤 열림)`);
    }
  }
  return notes;
}

/** 막힌 칸의 가구 이름(「카운터」「의자」) — 바닥·벽·문 같은 것은 빈 글. */
function furnitureAt(project: Project, map: GameMap, x: number, y: number): string {
  const w = map.width;
  if (x < 0 || y < 0 || x >= w || y >= map.height || isPassable(project, map, x, y)) return "";
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  for (const key of ["upperTiles", "upperOverlayTiles"]) {
    const t = m[key]?.[y * w + x];
    if (typeof t !== "number" || t < 0) continue;
    const label = tileLabel(project, map, t).replace(/\s*\((?:-?\d+,\s*-?\d+)\)\s*$/u, "").replace(/^.*·\s*/u, "").replace(/\s*\d+[×x]\d+$/u, "").replace(/\s+[NSEW]$/u, "").trim();
    const named = thingWords(label);
    if (named && !/바닥|벽|깔개|러그|그림자|공허|천장|창|문|floor|wall|rug|shadow|ceiling|void|door/iu.test(named)) return named;
  }
  return "";
}

/** 바닥 칸의 자리 말 — 곁 가구가 있으면 「가운데 카운터 옆」, 없으면 방위(「북서쪽」). evidenceOnThing 이 대사에 쓰는 말과 같은 규칙. */
export function floorPhrase(project: Project, map: GameMap, x: number, y: number): string {
  const near = [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => furnitureAt(project, map, x + dx!, y + dy!)).find(Boolean);
  return near ? `${mapRegion(map, x, y)} ${near} 옆` : mapRegion(map, x, y);
}

/**
 * 증거 물건 칸(`<사람 id>_evidence`)이 옮겨지면 대사의 자리 말을 지금 칸에 다시 맞춘다 — 모델이 멈출 때마다 돈다(되풀이 안전).
 * 자리 말은 사람의 귀띔(「…<자리> 바닥에서 뭔가 반짝이던데」), 칸 대사(「<자리> 바닥에 『X』」), 범인 진술(「<자리>엔 간 적도 없소」),
 * 지목 증명(「『X』는 <맵> <자리>에서 나왔다」)에 같은 글로 들어간다. 칸 대사의 옛 말을 찾아 그 틀 안에서만 바꾼다.
 * 왜(2026-10-31 mef3 terra 추리 32.3점, 엔딩 못 봄): 「게임 검사 보임」에 쫓겨 모델이 증거 칸을 (10,5)→(9,4)→…→(4,3) 로 일곱 번 옮겼는데
 * 대사는 처음 자리 「가운데 카운터 옆」을 그대로 말했다. 판정자는 카운터 둘레만 뒤지다 증거를 못 찾고 은시계에서 막혔다.
 */
export function realignEvidencePlaces(project: Project): { project: Project; notes: string[] } {
  const notes: string[] = [];
  let next = project;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (!ev.id.endsWith("_evidence") || visiblePerson(ev)) continue;
    const old = /"body":"([^"]+?) 바닥에 『/u.exec(JSON.stringify(ev.pages ?? []))?.[1];
    if (!old) continue;
    const now = floorPhrase(project, map, ev.x, ev.y);
    if (!now || now === old) continue;
    const esc = old.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&");
    const re = new RegExp(`${esc}(?=( 바닥| 근처|엔 |에서 |에 떨어져))`, "gu");
    const maps = { ...next.maps };
    let hits = 0;
    for (const [id, m] of Object.entries(next.maps)) {
      const text = JSON.stringify(m.events ?? []);
      const swapped = text.replace(re, () => { hits += 1; return now; });
      if (swapped !== text) maps[id] = { ...m, events: JSON.parse(swapped) as GameEvent[] };
    }
    const items = JSON.stringify(next.database.items);
    const itemsSwapped = items.replace(re, () => { hits += 1; return now; });
    if (!hits) continue;
    next = { ...next, maps, database: { ...next.database, items: JSON.parse(itemsSwapped) as typeof next.database.items } };
    notes.push(`증거 「${nameOf(ev)}」 칸 (${ev.x},${ev.y}) — 대사의 자리 말 「${old}」 → 「${now}」 (${hits}곳)`);
  }
  return { project: next, notes };
}

/** 증거가 떨어진 바닥 칸 — 사람 둘레 2~7걸음, 걸어 닿는 빈 바닥(이벤트·이동 칸 없음), 가구 곁이면 먼저. 가구 이름을 같이 준다. */
function evidenceCell(run: BuildRun, map: GameMap, giver: GameEvent): { x: number; y: number; near?: string } | undefined {
  const project = run.ctx.project;
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width;
  const furniture = (x: number, y: number): string => furnitureAt(project, map, x, y);
  const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  const markers = (map.events ?? []).filter((e) => e.id !== giver.id && !visiblePerson(e));
  const start = project.startMapId === map.id ? project.startPos : undefined;
  let best: { x: number; y: number; near?: string; score: number } | undefined;
  for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const d = Math.abs(x - giver.x) + Math.abs(y - giver.y);
    if (d < 2 || d > 7 || !reach[y * w + x] || taken.has(`${x},${y}`) || (start && start.x === x && start.y === y) || !isPassable(project, map, x, y)) continue;
    const near = [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => furniture(x + dx!, y + dy!)).find(Boolean);
    // 조사 칸·문 표시가 가로로 늘어선 줄(건물 앞 「들어갈 수 없는 입구」 줄)은 맨 뒤로 — 증거 칸이 그 사이에 섞이면 못 찾는다.
    const score = (near ? 0 : 20) + d + (markers.some((e) => e.y === y && Math.abs(e.x - x) <= 3) ? 100 : 0);
    if (!best || score < best.score || (score === best.score && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, near, score };
  }
  return best ? { x: best.x, y: best.y, near: best.near } : undefined;
}
