// 조수 v2 — 추리 청사진을 «투명 칸 네 개를 차례로 누르는» 일직선에서 사건으로 세운다(결정적·되풀이 안전).
//
// 왜(2026-10-29 vm1/vm2 mystery, ~/z-project/assistant-whole-game/suite/runs/vm1-1029/{flash,deepseek}/mystery 판정):
// 「투명한 조사 지점 네 곳을 순서대로 누르면 끝 · NPC 없음 · 추리·선택 없음 · 일직선」. 청사진 경로 빌더는 단계마다 줍기 고리를 지을 뿐이고
// 추리 도구(author_mystery_case·presentItem·고발 선택)는 v2 청사진 경로에서 한 번도 불리지 않았다. 그래서 청사진이 추리면 경로를 지은 뒤:
//  - 용의자 셋(공용 사람 칩) — 둘은 서로의 알리바이를 대 주고, 범인만 알리바이가 비어 있다. 증거를 가지면 「증거를 내민다」(presentItem).
//  - 심문 단계(「용의자 심문」「수상한 투숙객 대화」)의 투명 칸은 범인 증거 대면으로 바꾼다 — 그 단계가 켜던 것은 범인에게 맞는 증거를 내밀 때 켜진다.
//  - 마지막 단계(엔딩)는 범인 고르기 → 맞으면 증거 제시 → 맞는 증거면 원래 엔딩. 틀리면 다시 고른다(엔딩 없음).
//  - 단계 조사 칸이 그림 없는 바닥이면 그 물건(장화 자국·천 조각·장부…) 소품을 세운다(examineSpot·examineArt).
// 모델이 이미 지은 사건(presentItem·author_mystery_case 이벤트·사람이 하는 범인 고르기)이면 사건은 그대로 두고 소품만 세운다.
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { withJosa } from "@/util/josa";
import { eventGives } from "./blueprint";
import { showExaminedThing } from "./examineArt";
import { settleExamineSpot } from "./examineSpot";
import { unreachableEvents } from "./eventReach";
import { mapRegion } from "./discoverability";
import { isPassable } from "@/project/collision";
import { buildPeople } from "./people";
import type { BuildRun } from "./types";

/** 추리 청사진 낱말(요청·목표·단계·엔딩 어디든). 「도난」만으로는 추리로 보지 않는다(심부름 RPG). */
export const MYSTERY_WORDS = /추리|범인|탐정|미스터리|용의자|진범|whodunit|mystery|detective|culprit/iu;
/** 용의자와 말하는 단계(심문). */
const TALK_STEP = /심문|용의자|투숙객|대화|증언|알리바이|추궁|자백|캐묻|탐문|목격/u;
/** 범인이 될 수 있는 사람 부름 + (있으면) 이름 — 「심부름꾼 준」「수상한 상인」. 주인·투숙객·손님은 의뢰인이거나 무리라 범인 이름으로 쓰지 않는다. */
const ROLE = "심부름꾼|마부|상인|하녀|요리사|여행자|하인|집사|정원사|악사|사냥꾼|대장장이|점원|광대|음유시인|경비병|약초상|떠돌이";
const ROLE_NAME = new RegExp(`(${ROLE})(?:\\s+([가-힣]{1,3}?)(?=[\\s이가은는을를의에게께도과와,.!?]|$))?`, "u");

interface Suspect { readonly role: string; readonly name: string; readonly looks: string; readonly place: string }
const POOL: readonly Suspect[] = [
  { role: "상인", name: "상인 도윤", looks: "merchant", place: "식당 구석 자리" },
  { role: "마부", name: "마부 한스", looks: "man", place: "마구간" },
  { role: "여행자", name: "여행자 미라", looks: "woman", place: "2층 복도 끝 방" },
  { role: "요리사", name: "요리사 베티", looks: "woman", place: "부엌" },
  { role: "악사", name: "악사 리노", looks: "man", place: "난롯가" },
  { role: "하녀", name: "하녀 로자", looks: "maid", place: "세탁실" },
];
const LOOKS: Record<string, string> = { 상인: "merchant", 하녀: "maid", 집사: "butler", 경비병: "guard", 대장장이: "blacksmith", 요리사: "woman", 여행자: "woman" };

type Obj = Record<string, unknown>;
const textOf = (value: unknown): string => JSON.stringify(value ?? "").replace(/"(kind|id|switchId|itemId|endingId|commandId|surface)":"[^"]*"/gu, "");
const hash = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const nameOf = (ev: GameEvent | undefined): string => String((ev as { name?: string } | undefined)?.name ?? "");
const visiblePerson = (ev: GameEvent): boolean => (ev.pages ?? []).some((p) => Boolean((p.graphic as { sprite?: unknown } | undefined)?.sprite) && !(p.graphic as { transparent?: boolean }).transparent);

function walkCommands(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const cmd = raw as Obj;
    visit(cmd);
    for (const [key, value] of Object.entries(cmd)) if (Array.isArray(value) && (/^(then|else|branch|commands|body)$/u.test(key) || /Branch$/u.test(key))) walkCommands(value, visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options) walkCommands((o as Obj | undefined)?.branch, visit);
  }
}

export function isMysteryBlueprint(project: Project): boolean {
  const bp = project.gameBlueprint;
  if (!bp) return false;
  return MYSTERY_WORDS.test([bp.request ?? "", bp.playerGoal, bp.title, bp.genre, bp.ending.name, bp.ending.how, ...bp.steps.flatMap((s) => [s.event, s.action, s.gives])].join(" "));
}

/** 모델이 이미 사건을 지었나 — presentItem, author_mystery_case 이벤트, 사람이 하는 범인 고르기(엔딩 갈래와 아닌 갈래가 섞인 선택지). */
export function modelBuiltCase(project: Project): boolean {
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (ev.id.startsWith("ev_mystery_") || ev.id.startsWith("ev_case_")) return true;
    let found = false;
    for (const page of ev.pages ?? []) walkCommands(page.commands, (cmd) => {
      if (cmd.kind === "presentItem") found = true;
      if (cmd.kind === "choices" && Array.isArray(cmd.options) && cmd.options.length >= 2 && visiblePerson(ev)) {
        const ends = (cmd.options as Obj[]).map((o) => JSON.stringify(o.branch ?? []).includes('"triggerEnding"'));
        if (ends.some(Boolean) && ends.some((e) => !e)) found = true;
      }
    });
    if (found) return true;
  }
  return false;
}

interface Resolved { readonly k: number; readonly step: { id: string; place: string; event: string; action: string; needs: string; gives: string }; readonly map: GameMap; readonly ev: GameEvent }

function resolveSteps(project: Project): Resolved[] {
  const bp = project.gameBlueprint!;
  const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();
  const maps = Object.values(project.maps);
  const blueprintMapFor = (_: Project, place: string): GameMap | undefined => maps.find((m) => m.id === place || norm(m.name ?? "") === norm(place))
    ?? maps.find((m) => { const x = norm(m.name ?? ""), y = norm(place); return Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)); });
  const out: Resolved[] = [];
  bp.steps.forEach((step, k) => {
    const map = blueprintMapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(nameOf(e)) === norm(step.event))
      ?? map?.events.find((e) => !e.id.startsWith("ev_objective") && norm(nameOf(e)).length >= 2 && (norm(nameOf(e)).includes(norm(step.event)) || norm(step.event).includes(norm(nameOf(e)))));
    if (map && ev) out.push({ k, step: step as Resolved["step"], map, ev });
  });
  return out;
}

/** 조사만 하는 그림 없는 단계 칸에 그 물건을 보이게 한다(가구 옆에 붙이기 → 소품 세우기). */
function showClueThings(run: BuildRun, resolved: readonly Resolved[]): string[] {
  const notes: string[] = [];
  const lastK = resolved.reduce((m, r) => Math.max(m, r.k), -1);
  for (const r of resolved) {
    if (visiblePerson(r.ev)) continue;
    // 마지막(범인 지목) 칸은 사건 수첩 — 「보물을 압수한다」 글로 자루를 세우면 자루에 대고 범인을 고른다.
    const hint = r.k === lastK ? "사건 수첩" : `${r.step.event} ${r.step.gives} ${r.step.action}`;
    notes.push(...settleExamineSpot(run, r.map.id, r.ev.id, hint));
    // 소품이 다른 이벤트(용의자·문·다음 단계 칸)로 가는 길을 막으면 되돌린다 — examineArt 는 자기 칸만 본다(vm1 argon: 자루·일기장 받침이 줄을 막아 여관 주인에게 못 갔다).
    const before = new Set(unreachableEvents(run.ctx.project, r.map.id));
    const snapshot = run.ctx.project;
    const shown = showExaminedThing(run, r.map.id, r.ev.id, hint);
    if (shown && unreachableEvents(run.ctx.project, r.map.id).some((id) => !before.has(id))) run.ctx.project = snapshot;
    else if (shown) notes.push(shown);
  }
  return notes;
}

/** 단계 gives 글에서 물건 이름만(「물증(천 조각) 아이템」→「천 조각」, 「장화 자국 확인」→「장화 자국」). */
export function evidenceName(gives: string): string {
  const inner = /\(([^()]+)\)/u.exec(gives)?.[1];
  const base = (inner ?? gives).replace(/^(아이템|스위치)\s*[:：]\s*/u, "").replace(/\s*(아이템|스위치|확인|발견|획득|입수)$/u, "").trim();
  return base || gives.trim();
}

/** 범인 — 마지막·심문 단계 글에 나온 「부름 이름」(심부름꾼 준), 없으면 부름만(수상한 상인), 없으면 풀에서. */
function pickCulprit(project: Project, texts: readonly string[], taken: ReadonlySet<string>): Suspect | undefined {
  for (const t of texts) {
    const m = ROLE_NAME.exec(t);
    if (!m) continue;
    const role = m[1]!;
    const fromPool = POOL.find((p) => p.role === role && !taken.has(p.name));
    const name = m[2] ? `${role} ${m[2]}` : fromPool?.name ?? `${role} 오언`;
    if (taken.has(name)) continue;
    return { role, name, looks: LOOKS[role] ?? "man", place: fromPool?.place ?? "방" };
  }
  // 직함 없이 이름만 나온 사람(「도윤의 서명이 든 출납 기록」) — 풀의 이름과 맞으면 그 사람(2026-10-29 vm3 terra 추리: 장부가 도윤을 가리키는데 범인을 베티로 세웠다).
  for (const t of texts) {
    // 글에 먼저 나온 이름(「도윤의 서명… 베티의 진흙은 외양간에서」 — 앞이 범인, 뒤는 풀려나는 사람).
    const hits = POOL.flatMap((p) => {
      const given = p.name.split(" ")[1];
      const at = given && !taken.has(p.name) ? new RegExp(`${given}(?=[\\s이가은는을를의에게께도과와,.!?]|$)`, "u").exec(t)?.index : undefined;
      return at === undefined ? [] : [{ p, at }];
    }).sort((a, b) => a.at - b.at);
    if (hits[0]) return hits[0].p;
  }
  void project;
  return undefined;
}

/** 조사만(괄호로 감싼 이름 뒤에 붙일 때). */
const jo = (word: string, pair: "이/가" | "을/를" | "은/는" | "와/과"): string => withJosa(word, pair).slice(word.length);
const KEY_ITEM = /열쇠|키\b|key|출입증|통행증/iu;
const say = (speaker: string, lines: readonly string[]): Command[] => lines.map((body) => ({ kind: "text", speaker, body }) as unknown as Command);
/** 내레이션 줄 앞에 인물 얼굴을 내린다(얼굴이 남으면 그 인물이 서술하는 것처럼 보였다). */
const CLEAR_FACE = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as unknown as Command;
const narrate = (lines: readonly string[]): Command[] => lines.map((body) => ({ kind: "text", body }) as unknown as Command);

/**
 * 추리 청사진이면 사건을 세운다. 바꾼 것을 줄로 돌려준다. 되풀이해도 같은 결과(이미 세웠으면 소품만 다시 본다).
 */
export function stageMysteryCase(run: BuildRun): string[] {
  const project0 = run.ctx.project;
  if (!project0.gameBlueprint || !isMysteryBlueprint(project0)) return [];
  const pre: string[] = [];
  if (modelBuiltCase(project0)) {
    // 우리가 세운 용의자는 남았는데 경로를 다시 지어 마지막 단계의 범인 고르기가 사라졌으면(2026-10-29 vm3 terra 추리: 단서 셋 뒤 장부 보관함이 대사만 하고 엔딩)
    // 우리 용의자를 걷고 사건을 다시 세운다. 모델이 지은 사건(우리 표식 없는 증거 제시·고르기)은 그대로 둔다.
    const ours = Object.values(project0.maps).flatMap((map) => (map.events ?? []).filter((ev) => (ev.pages ?? []).some((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? "")))).map((ev) => ({ mapId: map.id, ev })));
    const last = resolveSteps(project0).at(-1);
    const lost = last && last.k === project0.gameBlueprint.steps.length - 1 && !(last.ev.pages ?? []).some((pg) => /"kind":"(?:choices|presentItem)"/u.test(JSON.stringify(pg.commands ?? [])));
    if (!ours.length || !lost) {
      const art = showClueThings(run, resolveSteps(project0));
      return [...(art.length ? [...art, "추리 사건은 이미 지어져 있어(증거 제시·범인 고르기) 그대로 두었다"] : []), ...explainRemainingClues(run)];
    }
    for (const { mapId, ev } of ours) run.call("remove_event", { mapId, eventId: ev.id });
    if (modelBuiltCase(run.ctx.project)) return [...showClueThings(run, resolveSteps(run.ctx.project)), ...explainRemainingClues(run)];
    pre.push(`경로를 다시 지어 범인 고르기가 사라져 사건을 다시 세웠다(용의자 ${ours.length}명 걷음)`);
  }
  const notes = stageCase(run);
  // 단서 칸 소품은 사건을 세운 뒤에 — 범인 대면으로 바뀌어 지운 심문 칸에 소품이 남지 않게.
  return [...pre, ...showClueThings(run, resolveSteps(run.ctx.project)), ...notes, ...explainRemainingClues(run)];
}

/**
 * 마지막(범인 지목) 단계가 잠겨 있을 때 남은 단서를 센다 — 「아직 단서가 모자라다. 남은 단서 2개: 「젖은 장화」(여관 동쪽)·「부엌 장부」」.
 * 앞 단계를 하나씩 마칠 때마다 켜지는 조건으로 페이지를 나눠, 지금 남은 것만 말한다. 되풀이 안전(이름 「남은 단서」 페이지를 다시 쓴다).
 * 왜(2026-10-29 vm3 terra 추리 판정): 단서 없이 장부 보관함을 조사하면 「먼저 금고를 살펴보자.」뿐 — 몇 개가 남았고 어디인지 몰라 맵을 뒤졌다.
 */
function explainRemainingClues(run: BuildRun): string[] {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const steps = resolveSteps(project);
  const last = steps.at(-1);
  if (!last || last.k !== bp.steps.length - 1 || steps.length < 3) return [];
  const clues = steps.filter((r) => r.k < last.k);
  // 단계 j 를 마쳤다는 표시 = 그 단계 이벤트가 켜는(주는) 전역 스위치·아이템 가운데 다음 단계(마지막이면 지목 단계)의 페이지 조건으로 쓰이는 것.
  // 자기 스위치·「taken」 같은 그 이벤트 안 표식은 다른 이벤트 조건으로 옮기면 뜻이 없다(vm3 deepseek 추리 재생: 남의 selfSwitch 를 복사해 자동 플레이가 깨졌다).
  const doneCond = (r: Resolved, next: Resolved): Obj[] | undefined => {
    const gives = eventGives(project, r.ev);
    for (const pg of next.ev.pages ?? []) for (const c of ((pg.conditions ?? []) as unknown as Obj[])) {
      if (c.kind === "switch" && c.value !== false && gives.switches.includes(String(c.switchId))) return [{ kind: "switch", switchId: c.switchId, value: true }];
      if (c.kind === "item" && c.present !== false && gives.items.includes(String(c.itemId))) return [{ kind: "item", itemId: c.itemId, present: true }];
    }
    return undefined;
  };
  const openCond = (j: number): Obj[] | undefined => doneCond(clues[j - 1]!, clues[j] ?? last);
  const pages0 = ((last.ev.pages ?? []) as unknown as Obj[]).filter((pg) => !/^남은 단서/u.test(String(pg.name ?? "")));
  // 마지막 단계 이벤트가 앞 단계도 맡으면(standin 추리: 「여관 주인」이 첫 단계와 범인 지목을 함께) 그 잠김 페이지는 앞 단계의 일이다 — 건드리지 않는다.
  if (clues.some((r) => r.ev.id === last.ev.id && r.map.id === last.map.id)) return [];
  // 잠김 페이지 = 조건 없이 대사만 하는 페이지(스위치·아이템·이동 같은 다른 명령이 없다).
  const lockedAt = pages0.findIndex((pg) => !(pg.conditions as unknown[] | undefined)?.length && Array.isArray(pg.commands) && pg.commands.length > 0 && (pg.commands as Obj[]).every((c) => c.kind === "text" || c.kind === "changeFace"));
  if (lockedAt < 0) return [];
  const locked = pages0[lockedAt]!;
  const where = (r: Resolved) => `「${r.step.event}」(${r.map.id === last.map.id ? mapRegion(r.map, r.ev.x, r.ev.y) : r.map.name ?? r.map.id})`;
  const progress: Obj[] = [];
  for (let j = 0; j < clues.length; j += 1) {
    const cond = j === 0 ? [] : openCond(j);
    if (j > 0 && !cond?.length) return [];
    const left = clues.slice(j);
    const body = `아직 단서가 모자라다. 남은 단서 ${left.length}개: ${left.map(where).join("·")}`;
    progress.push({ ...structuredClone(locked), id: `${String(locked.id ?? last.ev.id)}_left${j}`, name: `남은 단서 ${left.length}`, conditions: structuredClone(cond ?? []), commands: [{ kind: "text", body }] });
  }
  const pages = [...pages0.slice(0, lockedAt), ...progress, ...pages0.slice(lockedAt + 1)];
  if (JSON.stringify(pages) === JSON.stringify(last.ev.pages ?? [])) return [];
  run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, pages } });
  return [`「${last.step.event}」 잠김 대사에 남은 단서 수·자리(${clues.length}단계)`];
}

function stageCase(run: BuildRun): string[] {
  const bp = run.ctx.project.gameBlueprint!;
  const notes: string[] = [];
  const resolved = resolveSteps(run.ctx.project);
  const last = resolved.at(-1);
  if (!last || last.k !== bp.steps.length - 1) return notes;
  const ends = (ev: GameEvent) => (ev.pages ?? []).some((p) => JSON.stringify(p.commands ?? []).includes('"triggerEnding"'));
  if (!ends(last.ev)) return notes;
  // 심문 단계 — 마지막 앞 단계 중 말하는 단계(사람이 아닌 칸만 범인 대면으로 바꾼다).
  const talk = [...resolved].reverse().find((r) => r.k > 0 && r.k < last.k && TALK_STEP.test(`${r.step.event} ${r.step.action}`));
  const replaceTalk = talk && !visiblePerson(talk.ev) ? talk : undefined;
  // 증거 — 심문(없으면 마지막) 앞 단계들이 주는 아이템. 없으면 바로 앞 단계가 켜는 것을 증거 아이템으로도 준다.
  const pivot = talk ?? last;
  const before = resolved.filter((r) => r.k < pivot.k);
  let evidence: { id: string; name: string }[] = [];
  for (const r of before) for (const id of eventGives(run.ctx.project, r.ev).items) {
    const item = run.ctx.project.database.items.find((i) => i.id === id);
    // 문을 여는 열쇠는 증거가 아니다(flash: 「객실 열쇠」).
    if (item && !KEY_ITEM.test(item.name ?? "") && !evidence.some((e) => e.id === id)) evidence.push({ id, name: evidenceName(item.name ?? id) });
  }
  if (!evidence.length) {
    const src = before.at(-1);
    if (!src) return notes;
    const made = giveEvidenceItem(run, src, bp.title);
    if (!made) return notes;
    evidence = [made];
    notes.push(`「${src.step.event}」에서 증거 『${made.name}』도 챙기게 했다`);
  }
  const key = evidence.at(-1)!;
  // 용의자 셋 — 범인은 글에 나온 사람(없으면 풀), 나머지 둘은 서로의 알리바이 증인.
  const taken = new Set(Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).map(nameOf)));
  const culpritTexts = [textOf(last.ev.pages), talk ? textOf(talk.ev.pages) : "", bp.steps.at(-1)!.action, talk?.step.action ?? ""];
  const seed = hash(bp.title + bp.request);
  const culprit = pickCulprit(run.ctx.project, culpritTexts, taken) ?? POOL.filter((p) => !taken.has(p.name))[seed % POOL.length]!;
  const innocents = POOL.filter((p) => p.name !== culprit.name && p.role !== culprit.role && !taken.has(p.name));
  if (innocents.length < 2) return notes;
  const a = innocents[seed % innocents.length]!;
  const b = innocents.filter((p) => p !== a)[(seed >> 3) % (innocents.length - 1)]!;
  const stage = (replaceTalk ?? talk ?? last).map;
  const anchor = replaceTalk?.ev ?? talk?.ev ?? last.ev;
  // 심문 칸의 「넘어가는」 페이지 — 범인 대면 갈래가 그 결과(스위치·아이템·다음 목표)를 그대로 한다.
  const talkOpen = replaceTalk ? (replaceTalk.ev.pages ?? []).find((p) => (p.commands ?? []).some((c) => ["setSwitch", "changeItem"].includes(String((c as { kind?: string }).kind)))) : undefined;
  const talkResult = (talkOpen?.commands ?? []).filter((c) => (c as { kind?: string }).kind !== "text") as Command[];
  const talkConditions = talkOpen?.conditions ?? [];
  if (replaceTalk) {
    if (!run.call("remove_event", { mapId: replaceTalk.map.id, eventId: replaceTalk.ev.id }).ok) return notes;
  }
  const baseline = new Set(unreachableEvents(run.ctx.project, stage.id));
  const people = [culprit, a, b];
  const order = [...people].sort((x, y) => (hash(x.name + seed) % 97) - (hash(y.name + seed) % 97));
  const placed = buildPeople(run, order.map((p, i) => ({ role: p.role, name: p.name, looks: p.looks, mapId: stage.id, at: { x: anchor.x + (i - 1) * 2, y: anchor.y }, firstTalk: ["…"] })), stage.id);
  const ids = new Map<string, string>();
  for (const [i, e] of (placed.eventIds ?? []).entries()) ids.set(order[i]!.name, e.eventId);
  if (ids.size < 3) return [...notes, `용의자를 다 세우지 못했다: ${placed.summary}`];
  // 세운 사람이 다른 조사 칸·문 앞을 막으면(vm1 argon: 「상인」이 좁은 줄의 마지막 틈에 서서 여관 주인에게 못 갔다) 막지 않는 칸으로 옮긴다.
  for (const id of ids.values()) unblockPerson(run, stage.id, id, baseline, anchor);
  const witness = new Map<string, Suspect>([[a.name, b], [b.name, a]]);
  const allIds = evidence.map((e) => e.id);
  const evName = key.name;
  for (const p of people) {
    const id = ids.get(p.name)!;
    const ev = run.ctx.project.maps[stage.id]!.events.find((e) => e.id === id);
    if (!ev) continue;
    const page0 = ev.pages?.[0];
    const face = (page0?.commands ?? []).filter((c) => (c as { kind?: string }).kind === "changeFace");
    const guilty = p.name === culprit.name;
    const w = witness.get(p.name);
    const greeting = guilty ? ["무, 무슨 일이오? 난 바쁜 사람이오."] : ["어젯밤 소동 말이지요? 저도 놀랐어요."];
    const alibi = guilty
      ? [`밤새 ${p.place}에 혼자 있었소. 본 사람? …없지만, 그게 무슨 상관이오.`]
      : [`밤새 ${p.place}에 있었어요. ${withJosa(w!.name, "이/가")} 같이 있었으니 물어보세요.`];
    const reaction: Command[] = guilty
      ? [...say(p.name, ["…그, 그걸 어디서 찾았소?!", `『${evName}』… 그건… 내 것이 맞소.`]), CLEAR_FACE, ...narrate([`${p.name}의 얼굴이 하얗게 질렸다. 알리바이도 없다. 이 사람이 숨기는 게 있다.`]), ...structuredClone(talkResult)]
      : say(p.name, [`『${evName}』? 처음 보는 물건이에요.`, `저는 ${withJosa(w!.name, "와/과")} 함께 있었다니까요.`]);
    const present: Command = {
      kind: "presentItem", prompt: "어떤 증거를 내밀까?", itemIds: allIds,
      options: [{ itemId: key.id, branch: reaction }],
      otherwiseBranch: say(p.name, ["…그게 저와 무슨 상관이죠?"]), cancelBranch: narrate(["다음에 묻자."]), consume: false,
    } as unknown as Command;
    const ask: Command = {
      kind: "choices", prompt: `${p.name}에게 무엇을 할까?`, cancelBehavior: "branch", cancelBranch: [],
      options: [{ text: "알리바이를 묻는다", branch: say(p.name, alibi) }, { text: "증거를 내민다", branch: [present] }, { text: "그만둔다", branch: [] }],
    } as unknown as Command;
    const g = page0?.graphic;
    const base = { trigger: page0?.trigger ?? { kind: "action" }, priority: "same", graphic: g, movement: page0?.movement };
    const pages: Obj[] = [
      { ...base, id: `${id}_p0`, name: `${p.name} · 탐문`, conditions: [], commands: [...face, ...say(p.name, [...greeting, ...alibi])] },
      { ...base, id: `${id}_p1`, name: `${p.name} · 증거`, conditions: [{ kind: "item", itemId: key.id, present: true }, ...(guilty ? talkConditions.filter((c) => (c as { kind?: string }).kind !== "item") : [])], commands: [...face, ...say(p.name, greeting.slice(0, 1)), ask] },
    ];
    if (guilty && replaceTalk) {
      const doneSwitch = talkResult.map((c) => c as unknown as Obj).find((c) => c.kind === "setSwitch" && c.value !== false && !String(c.switchId).includes("taken"))?.switchId;
      if (doneSwitch) pages.push({ ...base, id: `${id}_p2`, name: `${p.name} · 들킴`, conditions: [{ kind: "switch", switchId: doneSwitch, value: true }], commands: [...face, ...say(p.name, ["…할 말이 없소."])] });
    }
    run.call("upsert_event", { mapId: stage.id, replacePages: true, event: { id, name: p.name, pages } });
  }
  // 심문 단계 이름을 범인 이벤트에 맞춘다(출하 검사·목표 줄이 같은 이름으로 걷는다) — 목표 줄은 셋 모두를 가리키게 고친다.
  const names = order.map((p) => p.name);
  if (replaceTalk) {
    const culpritId = ids.get(culprit.name)!;
    const steps = bp.steps.map((s, k) => (k === replaceTalk.k ? { ...s, event: culpritId } : s));
    run.ctx.project = { ...run.ctx.project, gameBlueprint: { ...run.ctx.project.gameBlueprint!, steps } };
    rewriteObjectiveTail(run, replaceTalk.step.event, `${names.join("·")}에게 이야기를 듣고, 수상한 사람에게 증거를 내밀자 (용의자: ${names.join("·")})`);
  }
  // 마지막 단계 — 범인 고르기 → 증거 제시 → 원래 엔딩. 틀리면 다시.
  const lastNow = run.ctx.project.maps[last.map.id]?.events.find((e) => e.id === last.ev.id) ?? last.ev;
  const accused = (lastNow.pages ?? []).map((page) => {
    if (!JSON.stringify(page.commands ?? []).includes('"triggerEnding"')) return structuredClone(page);
    const original = structuredClone(page.commands ?? []);
    const prove: Command = {
      kind: "presentItem", prompt: `무엇으로 ${withJosa(culprit.name, "을/를")} 증명할까?`, itemIds: allIds,
      options: [{ itemId: key.id, branch: [...narrate([`『${evName}』${jo(evName, "을/를")} 내밀자 ${withJosa(culprit.name, "은/는")} 더는 버티지 못했다.`]), ...original] }],
      otherwiseBranch: narrate(["그것만으로는 증명할 수 없다. 다시 생각해 보자."]), cancelBranch: narrate(["증거를 다시 살펴보자."]), consume: false,
    } as unknown as Command;
    const options = [...names].sort().map((n) => n === culprit.name
      ? { text: n, branch: [prove] }
      : { text: n, branch: narrate([`${n}에게는 ${witness.get(n)?.name ?? "다른 사람"}의 증언이 있다. 범인이 아니다. 다시 생각해 보자.`]) });
    options.push({ text: "아직 모르겠다", branch: narrate(["조금 더 조사해 보자."]) });
    const pick: Command = { kind: "choices", prompt: "범인은 누구일까?", options, cancelBehavior: "branch", cancelBranch: narrate(["조금 더 조사해 보자."]) } as unknown as Command;
    const lead = (page.commands ?? []).filter((c) => (c as { kind?: string }).kind === "changeFace");
    return { ...structuredClone(page), commands: [...lead, ...narrate(["모은 단서를 정리했다."]), pick] };
  });
  run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, pages: accused } });
  notes.push(`추리 사건: 용의자 ${names.join("·")}(범인 ${culprit.name}) — 증거 『${evName}』${jo(evName, "을/를")} 내밀면 ${replaceTalk ? `「${replaceTalk.step.event}」 단계가 넘어가고` : "반응하고"}, 「${last.step.event}」${jo(last.step.event, "은/는")} 범인 고르기(틀리면 다시) → 증거 제시 → 엔딩`);
  return notes;
}

/** 사람 하나가 새로 못 닿는 이벤트를 만들면(자기 포함) 기준점에서 가까운 칸부터 옮겨 본다. */
function unblockPerson(run: BuildRun, mapId: string, id: string, baseline: ReadonlySet<string>, anchor: { x: number; y: number }): void {
  const worse = () => unreachableEvents(run.ctx.project, mapId).some((e) => !baseline.has(e));
  if (!worse()) return;
  const map = run.ctx.project.maps[mapId]!;
  const start = run.ctx.project.startMapId === mapId ? run.ctx.project.startPos : undefined;
  const cells: { x: number; y: number }[] = [];
  for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
    if (!isPassable(run.ctx.project, map, x, y) || map.events.some((e) => e.x === x && e.y === y) || (start && start.x === x && start.y === y)) continue;
    cells.push({ x, y });
  }
  cells.sort((a, b) => Math.abs(a.x - anchor.x) + Math.abs(a.y - anchor.y) - (Math.abs(b.x - anchor.x) + Math.abs(b.y - anchor.y)));
  for (const c of cells.slice(0, 120)) {
    const snapshot = run.ctx.project;
    if (run.call("move_event", { mapId, eventId: id, x: c.x, y: c.y }).ok && !worse()) return;
    run.ctx.project = snapshot;
  }
}

/** 그 단계 이벤트가 켜는 스위치 옆에서 같은 이름의 증거 아이템도 준다. */
function giveEvidenceItem(run: BuildRun, src: Resolved, title: string): { id: string; name: string } | undefined {
  const name = evidenceName(src.step.gives);
  if (!name || /엔딩|ending/iu.test(name)) return undefined;
  const id = `item_case_${hash(`${title}|${src.step.id}|${name}`).toString(36)}`;
  if (!run.call("upsert_item", { item: { id, name, description: `[증거] ${src.step.action}`, price: 0, consumable: false } }).ok) return undefined;
  let added = false;
  const pages = (src.ev.pages ?? []).map((page) => {
    const commands = [...(page.commands ?? [])] as Command[];
    const at = commands.findIndex((c) => (c as unknown as Obj).kind === "setSwitch" && (c as unknown as Obj).value !== false && !String((c as unknown as Obj).switchId).includes("taken"));
    if (at < 0 || added) return structuredClone(page);
    added = true;
    commands.splice(at + 1, 0, { kind: "changeItem", itemId: id, op: "+=", amount: 1 } as unknown as Command, { kind: "text", body: `『${name}』${jo(name, "을/를")} 증거로 챙겼다.` } as unknown as Command);
    return { ...structuredClone(page), commands };
  });
  if (!added) return undefined;
  if (!run.call("upsert_event", { mapId: src.map.id, replacePages: true, event: { id: src.ev.id, pages } }).ok) return undefined;
  return { id, name };
}

/** 목표 줄 꼬리가 「(<이름>: …)」 인 것을 새 글로 바꾼다(그 이벤트를 지웠을 때). */
function rewriteObjectiveTail(run: BuildRun, eventName: string, text: string): void {
  const needle = `(${eventName}:`;
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) {
    const raw = JSON.stringify(ev.pages ?? []);
    if (!raw.includes(needle)) continue;
    const pages = structuredClone(ev.pages ?? []);
    for (const page of pages) walkCommands(page.commands, (cmd) => {
      const fields = cmd.fields as Obj | undefined;
      if (cmd.kind === "m2Command" && fields && typeof fields.message === "string" && fields.message.includes(needle)) fields.message = text;
    });
    run.call("upsert_event", { mapId: map.id, replacePages: true, event: { id: ev.id, pages } });
  }
}
