// 청사진 단계 이벤트의 «주인공»을 이름·대사에 세운다(끝맺음, 결정적).
// 왜(2026-10-29 vm4·vm5 판정): 경로 빌더가 단계 이름을 그대로 이벤트 이름·대사로 썼다 —
//  - vm4 flash jrpg: 「촌장과 대화」 단계가 「촌장의 대화」라는 이름표의 칸이 되어 「촌장의 대화를 살펴보았다」「『낡은 검』을 알아냈다」만 나왔다(판정 「촌장이 사람이 아니라 조사 오브젝트」).
//  - vm4·vm5 flash mystery: 「사건 조사 시작」「증거 수집」 투명 칸이 「…을 살펴보았다」만 하고 이유 없이 객실 열쇠를 줬다.
// 단계 행동(action)이 사람과 이야기하는 일이면 그 사람(Actor 칩)으로 세우고, 단계 이름이 «시작·수집·대치» 같은 진행 낱말뿐이면
// 행동·결과 낱말(gives·조사하는 대상)로 이름과 살펴보기 대사를 짓는다. 모델이 쓴 대사는 건드리지 않고 함수가 넣은 자리표시 줄만 바꾼다.
import type { GameEvent, Project } from "@/project/types";
import type { BuildRun } from "./types";
import { josa } from "@/util/josa";
import { buildPeople } from "./people";
import { isProgressWord, resolveSteps } from "./mysteryCase";
import { reachableCells, unreachableEvents } from "./eventReach";
import { isPassable } from "@/project/collision";

type Obj = Record<string, unknown>;
const PERSON = /(여관\s*주인|가게\s*주인|촌장|이장|주인|할머니|할아버지|노인|노파|박사|교수|선생님|선생|기사단장|기사|대장장이|상인|경비병|경비|병사|여왕|왕비|국왕|왕자|공주|왕|신관|사제|수녀|마법사|현자|사냥꾼|어부|농부|의사|간호사|목격자|투숙객|손님|선장|대장|사장|점장|집사|하녀|요리사|정원사|순경|형사|탐정|경찰|장로|족장|스승|사부)/u;
const TALK = /대화|이야기|말을\s*걸|만나|부탁|의뢰|듣|묻|물어|인사|소개|안내|받/u;
const SEARCH = /뒤지|뒤져|찾|줍|발견|수색/u;
/** 단계 이름이 진행 낱말뿐인가(「사건 조사 시작」「증거 수집」「촌장의 대화」). */
const ABSTRACT = /(시작|수집|탐색|발생|대치|추궁|해결|탐험|결전|대화|만남|의뢰|심문|지목|추리|도착|출발|진입|단계|진행|조사)$/u;
/** 보이지 않는 앎(정보·단서)이라 「받았다」로 쓰지 않는 결과. */
const KNOWLEDGE = /정보|단서|사실|비밀|번호|암호|진실|소문|증언|기억|위치|길|방법|해결|엔딩|시작|허락/u;

const nameOf = (ev: GameEvent) => String((ev as { name?: string }).name ?? "").trim();
const flat = (s: string) => s.replace(/[\s「」『』.,!?]/gu, "");
const isPerson = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; appearanceId?: unknown; transparent?: boolean }; return g.transparent !== true && Boolean(g.sprite || g.appearanceId); });
const transparent = (ev: GameEvent) => (ev.pages ?? []).every((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; appearanceId?: unknown; transparent?: boolean; tileId?: number }; return g.transparent === true || (!g.sprite && !g.appearanceId && !(typeof g.tileId === "number" && g.tileId > 0)); });

/** 단계가 이야기하는 사람 — 행동(또는 이름)에서 사람 낱말 바로 뒤에 이야기 낱말이 오고, 무리(「투숙객들」)가 아니며, 뒤져 찾는 단계가 아니다. */
export function talkPerson(step: { event: string; action: string; gives?: string }): string | undefined {
  for (const text of [step.action, step.event]) {
    const m = new RegExp(`(?<![가-힣])${PERSON.source}(들)?\\s*(?:과|와|의|에게서|에게|께|을|를)?\\s*([^.,]{0,12})`, "u").exec(text);
    if (!m || m[2] || !TALK.test(m[3] ?? "")) continue;
    if (SEARCH.test(step.action) && step.gives && !KNOWLEDGE.test(step.gives)) return undefined;
    const who = m[1]!.replace(/\s+/gu, " ");
    // 「주인에게 안내를 받자」 — 어느 집 주인인지 장소 낱말로(여관 로비 → 여관 주인).
    const house = who === "주인" ? /(여관|가게|상점|식당|주점|술집|카페|빵집|대장간|약방|여인숙)/u.exec(`${(step as { place?: string }).place ?? ""} ${step.action}`)?.[1] : undefined;
    return house ? `${house} 주인` : who;
  }
  return undefined;
}

/**
 * 「마을 사람들과 대화하며 동굴 위치를 알아낸다」처럼 사람 무리와 이야기하는 단계 — 그 단계를 맡은 투명 칸을 대표 한 사람으로 세운다.
 * 결과(gives)·행동에 직함(촌장…)이 있으면 그 사람, 없으면 「마을 주민」.
 * 왜(2026-10-29 vm6 argon·flash jrpg 판정 major «동굴 가는 길 못 찾음»): 「동굴 가는 길 열기」「마을 광장」이 집 벽·맨바닥의 투명 칸이라
 * 판정자는 동굴 위치를 알려 줄 사람을 끝내 못 찾았다(목표는 그 칸 이름만 댔다). talkPerson 은 무리(「…들」)를 건너뛴다(추리의 투숙객들은 여럿이다).
 */
const GROUP = /(?<![가-힣])(?:마을\s*)?(?:사람|주민|이웃|동네\s*사람)들?\s*(?:과|와|에게서|에게|께|을|를)?\s*([^.,]{0,12})/u;
export function groupPerson(step: { event: string; action: string; gives?: string; place?: string }): string | undefined {
  for (const text of [step.action, step.event]) {
    const m = GROUP.exec(text);
    if (!m || !TALK.test(m[1] ?? "")) continue;
    // 앞 글자가 붙은 직함은 사람이 아니다(「마왕의 동굴」의 「왕」 — vm6 argon jrpg 재생에서 「왕」을 세웠다).
    const titled = new RegExp(`(?<![가-힣])${PERSON.source}`, "u").exec(`${step.gives ?? ""} ${step.action}`)?.[1];
    return titled && titled !== "주인" ? titled.replace(/\s+/gu, " ") : "마을 주민";
  }
  return undefined;
}

/** 행동에서 살펴보는 대상(「사건 현장을 조사한다」 → 사건 현장, 「방을 뒤져」 → 방). */
function lookTarget(action: string): string | undefined {
  const m = /([가-힣]+(?:\s[가-힣]+)?)[을를]\s*(?:조사|살펴|뒤지|뒤져|수색|확인|찾)/u.exec(action);
  // 「심문하고 방」처럼 앞 낱말이 이음 말(…고·…며·…서)이면 떼고 명사만.
  const words = (m?.[1] ?? "").split(/\s+/u).filter(Boolean);
  while (words.length > 1 && /(고|며|서|여|해|면|니|다)$/u.test(words[0]!)) words.shift();
  const noun = words.join(" ").replace(/^(그|이|저|모든|모은|여러)\s/u, "").trim();
  return noun && noun.length >= 1 && !/단서|증거|정보|범인|진실/u.test(noun) ? noun : undefined;
}

const lookLines = (event: string): string[] => {
  const noun = event.replace(/\s*(조사하기|조사|살펴보기|확인하기|확인|열기|탈출하기|탈출|찾기|수색)$/u, "").trim() || event;
  return [`${event}${josa(event, "을/를")} 살펴보았다.`, `${noun}${josa(noun, "을/를")} 살펴보았다.`];
};

function rewriteTexts(pages: Obj[], swap: (body: string) => string | { body: string; speaker: string } | undefined): number {
  let n = 0;
  const visit = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const c of list as Obj[]) {
      if (!c || typeof c !== "object") continue;
      if (c.kind === "text" && typeof c.body === "string") {
        const next = swap(c.body);
        if (typeof next === "string" && next !== c.body) { c.body = next; n += 1; }
        else if (next && typeof next === "object") { c.body = next.body; c.speaker = next.speaker; n += 1; }
      }
      for (const v of Object.values(c)) if (Array.isArray(v)) visit(v);
    }
  };
  for (const p of pages) visit(p.commands);
  return n;
}

/** 대사 목록에서 자리표시 줄을 뺀다 — 같은 목록에 다른 글이 남을 때만(빈 페이지를 만들지 않는다). */
function dropTexts(pages: Obj[], drop: (body: string) => boolean): number {
  let n = 0;
  const isDrop = (c: unknown) => Boolean(c && typeof c === "object" && (c as Obj).kind === "text" && typeof (c as Obj).body === "string" && drop((c as Obj).body as string));
  const visit = (list: unknown[]): unknown[] => {
    const others = list.some((c) => c && !isDrop(c));
    const kept = others ? list.filter((c) => { if (!isDrop(c)) return true; n += 1; return false; }) : list;
    return kept.map(recurse);
  };
  const recurse = (c: unknown): unknown => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return c;
    return Object.fromEntries(Object.entries(c as Obj).map(([k, v]) => [k, !Array.isArray(v) ? v : v.every((x) => x && typeof x === "object" && "kind" in (x as Obj)) ? visit(v) : v.map(recurse)]));
  };
  for (const p of pages) if (Array.isArray(p.commands)) p.commands = visit(p.commands);
  return n;
}

/** 사람에게 듣는 단계의 첫 말 — 행동이 살펴볼 대상을 말하면 그 부탁, 아니면 이야기를 나눴다는 서술. */
function personLine(who: string, action: string): string | { body: string; speaker: string } {
  const target = lookTarget(action);
  if (target) return { speaker: who, body: `부탁하오. ${target}${josa(target, "을/를")} 좀 살펴봐 주시오.` };
  return `${who}${josa(who, "와/과")} 이야기를 나누었다.`;
}

/** 사람 그림 하나를 고른다 — 같은 맵 빈 칸에 잠깐 세워 그림을 읽고 바로 걷는다(buildPeople 이 역할·외형으로 Actor 칩을 고른다). */
function personGraphic(run: BuildRun, mapId: string, role: string, at: { x: number; y: number }): Obj | undefined {
  const before = run.ctx.project;
  const placed = buildPeople(run, [{ role, name: `__look_${role}`, mapId, at, firstTalk: ["…"] }], mapId);
  const id = placed.eventIds?.[0]?.eventId;
  const ev = id ? run.ctx.project.maps[mapId]?.events.find((e) => e.id === id) : undefined;
  const graphic = ev?.pages?.[0]?.graphic ? structuredClone(ev.pages[0]!.graphic) as unknown as Obj : undefined;
  run.ctx.project = before;
  return graphic && !(graphic as { transparent?: boolean }).transparent ? graphic : undefined;
}

/**
 * 사람으로 세운 칸이 건물 벽·지붕(못 걷는 칸) 위면 3걸음 안의 걸어 닿는 빈 바닥으로 내린다 — 벽에 사람 그림이 박힌다(vm6 argon jrpg (6,7) 집 벽).
 * 못 닿는 이벤트가 늘면 그 자리는 쓰지 않는다. 옮긴 자리 글(「(x,y)」) 또는 undefined.
 */
function standOffWall(run: BuildRun, mapId: string, eventId: string): string | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  const ev = map?.events.find((e) => e.id === eventId);
  if (!map || !ev || isPassable(project, map, ev.x, ev.y)) return undefined;
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const before = new Set(unreachableEvents(project, mapId));
  const taken = new Set(map.events.map((e) => e.y * map.width + e.x));
  const cands: { x: number; y: number; d: number }[] = [];
  for (let y = Math.max(0, ev.y - 3); y <= Math.min(map.height - 1, ev.y + 3); y++) for (let x = Math.max(0, ev.x - 3); x <= Math.min(map.width - 1, ev.x + 3); x++) {
    const d = Math.abs(x - ev.x) + Math.abs(y - ev.y);
    const i = y * map.width + x;
    if (d === 0 || d > 3 || !reach[i] || taken.has(i)) continue;
    cands.push({ x, y, d: d + (y < ev.y ? 1 : 0) });
  }
  cands.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const c of cands) {
    const snapshot = run.ctx.project;
    const res = run.call("move_event", { mapId, eventId, x: c.x, y: c.y });
    if (res.ok && !unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id))) return `(${c.x},${c.y})`;
    run.ctx.project = snapshot;
  }
  return undefined;
}

export function settleStepSubjects(run: BuildRun): string[] {
  const project0 = run.ctx.project;
  const bp = project0.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const resolved = resolveSteps(project0);
  const renamed = new Map<string, string>();
  const olds = new Map<string, string>();
  const personIds = new Set<string>();
  for (const r of resolved) {
    const last = r.k === bp.steps.length - 1;
    const map = run.ctx.project.maps[r.map.id];
    const ev = map?.events.find((e) => e.id === r.ev.id);
    if (!map || !ev) continue;
    const name = nameOf(ev);
    if (name) olds.set(ev.id, name);
    const person = talkPerson(r.step) ?? (transparent(ev) ? groupPerson(r.step) : undefined);
    const pages = structuredClone(ev.pages ?? []) as unknown as Obj[];
    const looks = new Set(lookLines(r.step.event).concat(name ? lookLines(name) : []));
    if (person && !last) {
      // 이미 이 사람 이름을 가진 다른 NPC 가 같은 맵에 서 있으면 이 칸은 그대로 둔다(둘이 되지 않게).
      const twin = map.events.find((e) => e.id !== ev.id && isPerson(e) && flat(nameOf(e)).includes(flat(person)));
      if (twin) continue;
      const speaker = JSON.stringify(ev.pages ?? []).match(new RegExp(`"speaker":"([^"]*${person.replace(/\s+/gu, "\\s*")}[^"]*)"`, "u"))?.[1];
      // 이미 사람으로 선 NPC 는 제 이름 그대로(「여관 주인 덕수」를 「여관 주인」으로 줄이지 않는다).
      const who = isPerson(ev) && name && !ABSTRACT.test(name) ? name : speaker ?? person;
      // 함수가 넣은 「사건 조사 시작을 살펴보았다」 자리는 그 사람의 말로(행동 문장을 그대로 읽히면 지시문처럼 보였다 — vm5 flash 추리 「여관 주인의 이야기를 듣고 사건 현장을 조사한다.」).
      let n = rewriteTexts(pages, (body) => looks.has(body) ? personLine(who, r.step.action) : undefined);
      n += rewriteTexts(pages, (body) => {
        const m = /^『([^』]+)』(?:을|를|을\(를\))\s*(알아냈다|얻었다)\.$/u.exec(body);
        if (!m || KNOWLEDGE.test(m[1]!)) return undefined;
        return `${who}에게서 『${m[1]}』${josa(m[1]!, "을/를")} 받았다.`;
      });
      let graphicNote = "";
      if (!isPerson(ev)) {
        const graphic = personGraphic(run, map.id, person, { x: ev.x, y: ev.y });
        if (graphic) {
          const trial = pages.map((p) => ({ ...p, graphic: structuredClone(graphic), priority: "same" }));
          const snapshot = run.ctx.project;
          const was = new Set(unreachableEvents(snapshot, map.id));
          run.ctx.project = { ...snapshot, maps: { ...snapshot.maps, [map.id]: { ...map, events: map.events.map((e) => e.id === ev.id ? { ...e, name: who, pages: trial as unknown as typeof e.pages } : e) } } } as Project;
          if (unreachableEvents(run.ctx.project, map.id).some((id) => !was.has(id))) run.ctx.project = snapshot;
          else {
            renamed.set(ev.id, who); personIds.add(ev.id);
            const off = standOffWall(run, map.id, ev.id);
            notes.push(`「${name || ev.id}」 → 사람 「${who}」(${ev.x},${ev.y})${off ? ` · 벽에서 ${off} 로 내려 세움` : ""}${n ? ` · 자리표시 대사 ${n}줄` : ""}`);
            continue;
          }
          graphicNote = " (사람 그림은 길을 막아 못 세움)";
        }
      }
      const cur = run.ctx.project.maps[map.id]!;
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [map.id]: { ...cur, events: cur.events.map((e) => e.id === ev.id ? { ...e, name: who, pages: pages as unknown as typeof e.pages } : e) } } } as Project;
      renamed.set(ev.id, who);
      if (isPerson(ev)) personIds.add(ev.id);
      notes.push(`「${name || ev.id}」 → 「${who}」${n ? ` · 자리표시 대사 ${n}줄` : ""}${graphicNote}`);
      continue;
    }
    // 마지막 단계(지목·엔딩)는 사건 세우기가 맡는다 — 다만 「진범 대치를 살펴보았다」 같은 자리표시 줄은 다른 글이 있으면 뺀다(vm5 flash 추리 엔딩 갈래).
    if (last) {
      if (ABSTRACT.test(name || r.step.event)) {
        const dropped = dropTexts(pages, (body) => looks.has(body));
        if (dropped) {
          const cur = run.ctx.project.maps[map.id]!;
          run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [map.id]: { ...cur, events: cur.events.map((e) => e.id === ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e) } } } as Project;
          notes.push(`「${name || r.step.event}」 자리표시 줄 ${dropped}개 뺌`);
        }
      }
      continue;
    }
    // 진행 낱말뿐인 투명 칸 — 결과 물건(gives)이나 살펴보는 대상으로 이름·대사를 짓는다.
    if (!transparent(ev) || !ABSTRACT.test(name || r.step.event)) continue;
    const target = lookTarget(r.step.action);
    const thing = r.step.gives && !KNOWLEDGE.test(r.step.gives) && !/^(?:엔딩|ending)$/iu.test(r.step.gives) ? r.step.gives.trim() : target;
    if (!thing) continue;
    const seen = target ?? thing;
    const n = rewriteTexts(pages, (body) => looks.has(body) ? `${seen}${josa(seen, "을/를")} 살펴보았다.` : undefined);
    const cur = run.ctx.project.maps[map.id]!;
    run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [map.id]: { ...cur, events: cur.events.map((e) => e.id === ev.id ? { ...e, name: thing, pages: pages as unknown as typeof e.pages } : e) } } } as Project;
    renamed.set(ev.id, thing);
    notes.push(`「${name || r.step.event}」 → 「${thing}」${n ? ` · 살펴보기 대사 「${seen}」` : ""}`);
  }
  // 다른 이벤트 대사·목표 글이 옛 이름(「사건 조사 시작」)을 가리키면 새 이름으로(잠김 대사·남은 단서·목표 꼬리).
  if (renamed.size) {
    const pairs = [...renamed].flatMap(([id, to]) => { const from = olds.get(id); return from && from !== to ? [[from, to] as const] : []; });
    if (pairs.length) {
      const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const people = new Set([...renamed].filter(([id]) => personIds.has(id)).map(([, to]) => to));
      // 「옛 이름」 + 조사는 새 이름 받침에 맞추고, 사람에게 「…을 마쳐야 한다」는 「…에게 말을 걸어야 한다」로. 목표 꼬리 (옛 이름)·→ 옛 이름) 도.
      const swapAll = (text: string) => pairs.reduce((t, [from, to]) => t
        .replace(new RegExp(`「${esc(from)}」(?:을|를)\\s*마쳐야 한다`, "gu"), people.has(to) ? `「${to}」에게 말을 걸어야 한다` : `「${to}」${josa(to, "을/를")} 찾아야 한다`)
        .replace(new RegExp(`「${esc(from)}」(을|를|이|가|은|는|과|와)(?![가-힣])`, "gu"), (_m, j: string) => `「${to}」${josa(to, /을|를/u.test(j) ? "을/를" : /이|가/u.test(j) ? "이/가" : /은|는/u.test(j) ? "은/는" : "와/과")}`)
        .split(`「${from}」`).join(`「${to}」`)
        .replace(new RegExp(`([(→·]\\s*)${esc(from)}(\\s*[)·])`, "gu"), `$1${to}$2`), text);
      const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => {
        const json = JSON.stringify(m.events ?? []);
        const next = swapAll(json).replace(/『([^』"]+)』을\(를\)/gu, (_m, w: string) => `『${w}』${josa(w, "을/를")}`);
        return [id, next === json ? m : { ...m, events: JSON.parse(next) }];
      }));
      run.ctx.project = { ...run.ctx.project, maps } as Project;
    }
  }
  // 사람에게 「「촌장」을 마쳐야 한다」 — 사람은 마치는 것이 아니라 말을 거는 것(vm5 flash jrpg 잠김 대사).
  {
    const people = new Set(Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).filter((e) => isPerson(e) && !JSON.stringify(e.pages ?? []).includes('"battleProcessing"')).map(nameOf)).filter((n) => n.length >= 1));
    if (people.size) {
      let n = 0;
      const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => {
        const json = JSON.stringify(m.events ?? []);
        const next = json.replace(/「([^」"]+)」(?:을|를)\s*마쳐야 한다/gu, (all, who: string) => { if (!people.has(who)) return all; n += 1; return `「${who}」에게 말을 걸어야 한다`; });
        return [id, next === json ? m : { ...m, events: JSON.parse(next) }];
      }));
      if (n) { run.ctx.project = { ...run.ctx.project, maps } as Project; notes.push(`사람에게 「마쳐야」 → 「말을 걸어야」 ${n}곳`); }
    }
  }
  // 청사진 단계가 바뀐 이름 대신 이벤트 id 로 가리키게(출하 검사·목표가 같은 이벤트를 찾는다).
  if (renamed.size) {
    const steps = bp.steps.map((step) => { const hit = resolved.find((r) => r.step.id === step.id && renamed.has(r.ev.id)); return hit ? { ...step, event: hit.ev.id } : step; });
    run.ctx.project = { ...run.ctx.project, gameBlueprint: { ...run.ctx.project.gameBlueprint!, steps } } as Project;
  }
  notes.push(...dropTokenLines(run), ...matchSpeakerPrefix(run));
  return notes;
}

/** 물건이 아닌 막연한 토큰(「필요한 것」「단서」「수사 시작」) — 『』에 넣어 「알아냈다·받았다」로 쓰면 자리표시로 읽힌다. */
const vagueToken = (x: string) => isProgressWord(x) || /^(필요한\s*것|무언가|그것|단서|증거|정보|힌트)$/u.test(x.trim());

/**
 * 『필요한 것』을 알아냈다 · 여관 주인에게서 『필요한 것』을 받았다 · 「필요한 것이 있어야 할 것 같다」 — 스위치 토큰이 물건처럼 새어 나온 줄을 뺀다
 * (같은 목록에 그 이름의 아이템을 실제로 주는 명령이 있으면 둔다. 잠김 줄은 뒤에 「먼저 …」 안내가 이어질 때만 뺀다).
 * 왜(2026-10-29 vm4 argon 추리 재생): 여관 주인이 아무것도 안 주는데 「『필요한 것』을 받았다」, 짐을 뒤지자 「『단서』를 알아냈다」.
 */
export function dropTokenLines(run: BuildRun): string[] {
  const items = new Map(run.ctx.project.database.items.map((i) => [i.id, String(i.name ?? "")]));
  let n = 0;
  const visit = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    const arr = list as Obj[];
    const given = new Set(arr.filter((c) => c && c.kind === "changeItem").map((c) => items.get(String(c.itemId)) ?? ""));
    const kept = arr.filter((c, i) => {
      if (!c || c.kind !== "text" || typeof c.body !== "string") return true;
      const got = /^(?:.+에게서\s)?『([^』]+)』(?:을|를|을\(를\))\s*(?:알아냈다|얻었다|받았다)\.?$/u.exec(c.body);
      if (got && vagueToken(got[1]!) && !given.has(got[1]!)) { n += 1; return false; }
      const need = /^(.+?)(?:이|가|이\(가\))\s*있어야 할 것 같다\.?$/u.exec(c.body);
      const next = arr[i + 1];
      if (need && vagueToken(need[1]!) && next && next.kind === "text" && /^먼저 /u.test(String(next.body ?? ""))) { n += 1; return false; }
      return true;
    });
    return kept.map((c) => !c || typeof c !== "object" ? c : Object.fromEntries(Object.entries(c).map(([k, v]) => [k, !Array.isArray(v) ? v : (v as Obj[]).every((x) => x && typeof x === "object" && "kind" in x) ? visit(v) : (v as Obj[]).map((o) => o && typeof o === "object" && Array.isArray(o.branch) ? { ...o, branch: visit(o.branch) } : o)])));
  };
  const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => [id, { ...m, events: (m.events ?? []).map((ev) => ({ ...ev, pages: (ev.pages ?? []).map((pg) => ({ ...pg, commands: visit(pg.commands) })) })) }]));
  if (!n) return [];
  run.ctx.project = { ...run.ctx.project, maps: maps as unknown as Project["maps"] } as Project;
  return [`토큰 줄(『필요한 것』을 받았다 등) ${n}개 뺌`];
}

/**
 * 사람 NPC 대사 머리 「투숙객: …」가 그 사람 이름(「악사 리노」)과 다른 일반 역할 낱말이면 이름으로 맞춘다 — 사건 세우기가 그 칸을 용의자로 바꿔 이름이 달라졌다.
 * 왜(2026-10-29 vm4 argon 추리 재생): 이름표는 「악사 리노」인데 대사는 「투숙객: 네? 도난 사건이라뇨.」.
 */
function matchSpeakerPrefix(run: BuildRun): string[] {
  let n = 0;
  const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => [id, { ...m, events: (m.events ?? []).map((ev) => {
    const name = nameOf(ev);
    if (!name || !isPerson(ev)) return ev;
    const json = JSON.stringify(ev.pages ?? []);
    const heads = new Set([...json.matchAll(/"body":"([^":]{1,8}):\s/gu)].map((x) => x[1]!.trim()));
    if (heads.size !== 1) return ev;
    const head = [...heads][0]!;
    if (head === name || name.includes(head) || !new RegExp(`^${PERSON.source}$`, "u").test(head)) return ev;
    const next = json.split(`"body":"${head}: `).join(`"body":"${name}: `);
    n += 1;
    return { ...ev, pages: JSON.parse(next) };
  }) }]));
  if (!n) return [];
  run.ctx.project = { ...run.ctx.project, maps: maps as unknown as Project["maps"] } as Project;
  return [`대사 머리 역할 낱말을 이름으로 ${n}명`];
}
