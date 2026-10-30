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
import { reachableCells, unreachableEvents } from "./eventReach";
import { isObjectiveCommand, mapRegion, objectiveCommand, withWhere } from "./discoverability";
import { isPassable } from "@/project/collision";
import { buildPeople, tileLabel } from "./people";
import { shownToken } from "./codeClues";
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

export function resolveSteps(project: Project): Resolved[] {
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
  const inner = /«([^«»]+)»/u.exec(gives)?.[1] ?? /\(([^()]+)\)/u.exec(gives)?.[1];
  const base = (inner ?? gives).replace(/^(아이템|스위치)\s*[:：]\s*/u, "").replace(/\s*(아이템|스위치|확인|발견|획득|입수)$/u, "").trim();
  // 진행 낱말(「수사 시작」「모든 단서」)은 물건이 아니다 — 증거 이름으로 쓰면 「『수사 시작』… 내 것이 맞소」가 됐다(vm5 argon 추리).
  // 범인이 「내 것이 맞소」라고 할 수 있는 작은 물건 하나를 gives 글로 골라 쓴다(되풀이해도 같은 이름).
  if (isProgressWord(base)) return PHYSICAL_CLUES[hash(gives) % PHYSICAL_CLUES.length]!;
  return base;
}

/** 물건이 아닌 진행 낱말인가(「수사 시작」「모든 단서」「사건 해결」「found_clue」). */
export function isProgressWord(word: string): boolean {
  const w = word.trim();
  return !w || /(\s|^)(시작|수사|조사|진행|해결|엔딩|정보|탐문|추리)$/u.test(w) || /^(모든\s*|결정적(인)?\s*)?(단서|증거)들?$/u.test(w) || /^(started|found_clue|clue|asked|evidence)$/iu.test(w);
}

/** 진행 낱말 대신 쓰는 증거 물건 — 범인이 제 것이라 털어놓을 만한 작은 소지품. */
const PHYSICAL_CLUES = ["떨어진 은단추", "찢어진 소매 조각", "진흙 묻은 손수건", "이름 새긴 담뱃대", "낯선 열쇠고리", "얼룩진 장갑 한 짝"] as const;

/**
 * 지목에 쓰는 증거 아이템 이름이 진행 낱말(「수사 시작」)이면 물건 이름으로 바꾸고, 대사 속 『옛 이름』도 고친다. 「『수사 시작』을 알아냈다.」 줄은 뺀다(주는 줄이 따로 있다).
 * 왜(2026-10-29 vm5 argon 추리 판정): 유일한 증거가 『수사 시작』이라 상인 오언이 「『수사 시작』… 내 것이 맞소」라고 자백했다 — 앞 빌드가 만든 아이템이라
 * evidenceName 을 고쳐도 이미 지어진 판은 그대로였다.
 */
function renameProgressEvidence(run: BuildRun): string[] {
  const project = run.ctx.project;
  const used = new Set<string>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "presentItem") for (const o of (c.options ?? []) as Obj[]) if (typeof o.itemId === "string") used.add(o.itemId);
  });
  const notes: string[] = [];
  for (const id of used) {
    const item = run.ctx.project.database.items.find((i) => i.id === id);
    const old = String(item?.name ?? "");
    if (!item || !isProgressWord(old)) continue;
    const name = evidenceName(old);
    if (name === old) continue;
    renameItemEverywhere(run, item, name);
    notes.push(`증거 『${old}』(진행 낱말) → 『${name}』`);
  }
  return notes;
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
  if (!run.ctx.project.gameBlueprint || !isMysteryBlueprint(run.ctx.project)) return [];
  // 이름표 되돌리기 → 지름길 닫기(마지막 단계를 지목 이벤트로) → 사건 세우기·남은 단서 → 새로 세운 지목에 대한 지름길 → 증거를 실제로 주는지.
  const named = repairPageNameLabels(run);
  const closed = closeEndingShortcuts(run);
  const notes = stageMysteryCaseInner(run);
  return [...named, ...closed, ...notes, ...closeEndingShortcuts(run), ...ensureEvidenceGiven(run), ...renameProgressEvidence(run), ...alignEvidenceToText(run), ...dropDanglingEvidenceHints(run), ...evidenceOnThing(run), ...deepenCase(run), ...polishCaseNames(run), ...requireInterrogation(run), ...alignCulpritLines(run), ...nameLeakedEventIds(run), ...dropDanglingEvidenceHints(run)];
}

const ROLE_WORDS = ["투숙객", "손님", "하녀", "하인", "요리사", "악사", "마부", "상인", "여행자", "점원", "집사", "정원사", "경비", "하숙생", "직원", "노파", "청년", "사내", "여인"];
const WITNESS_MARK = "저는 아니에요! 어젯밤";

/**
 * 사건을 다시 세워 범인이 바뀌면 모델이 쓴 옛 범인 지칭을 새 범인으로 맞춘다 — 되풀이 안전.
 *  1) 「저 투숙객이 범인이었어요」「범인은 마부 한스」「한스가 훔쳤다」처럼 범인이 아닌 용의자 이름·역할 낱말(새 범인 이름에 없는 것)을 범인으로 부르는 줄 → 새 범인 이름.
 *     부정(「…는 범인이 아니다」)·「범인을 잡아 주세요」처럼 누구를 지칭하지 않는 줄은 건드리지 않는다.
 *  2) 범인이 아닌 사람이 자백하는 장면(「죄송합니다… 돌려드리겠습니다」, 범인 아닌 사람 이벤트의 페이지) → 그 사람이 새 범인을 본 목격 증언으로 다시 쓴다(스위치·아이템 명령은 그대로).
 * 왜(2026-10-29 vm3 argon 추리): 범인 고르기를 다시 세워 범인이 악사 리노가 됐는데, 모델의 투숙객 자백 장면과 지목 성공 대사 「저 투숙객이 범인이었어요」가 남았다.
 */
function alignCulpritLines(run: BuildRun): string[] {
  const project = run.ctx.project;
  let culprit = "";
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (culprit || c.kind !== "choices" || c.prompt !== ACCUSE_PROMPT) return;
    for (const o of (c.options ?? []) as Obj[]) if (JSON.stringify(o.branch ?? []).includes('"presentItem"')) culprit = String(o.text ?? "");
  });
  if (!culprit) return [];
  const others = suspectNames(project).filter((n) => n !== culprit);
  const wrongs = [...others, ...others.map((n) => n.split(/\s+/u).at(-1)!).filter((n) => n.length >= 2 && !culprit.includes(n)), ...ROLE_WORDS.filter((r) => !culprit.includes(r))]
    .sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  if (!wrongs) return [];
  const det = "(?:(?:저|그|이)\\s+)?";
  const claims: [RegExp, (m: string) => string][] = [
    [new RegExp(`${det}(?:${wrongs})(?:이|가)\\s*(범인|진범|훔쳤|훔친)`, "gu"), (m) => `${culprit}${jo(culprit, "이/가")} ${/(범인|진범|훔쳤|훔친)$/u.exec(m)![1]}`],
    [new RegExp(`(범인|진범)(은|는)\\s+${det}(?:${wrongs})(?![가-힣])`, "gu"), (m) => `${/^(범인|진범)/u.exec(m)![1]}${/^(?:범인|진범)(은|는)/u.exec(m)![1]} ${culprit}`],
    [new RegExp(`${det}(?:${wrongs})의\\s*(짓|소행)`, "gu"), (m) => `${culprit}의 ${/(짓|소행)$/u.exec(m)![1]}`],
  ];
  const NEG = /아니|아닌|않|없었/u;
  const CONFESS = /죄송합니다|잘못했|돌려드리겠|제가\s*(?:훔|그랬)|용서해/u;
  const evidenceMap = (() => {
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) {
      let hit = false;
      walkCommands(pg.commands, (c) => { if (c.kind === "changeItem" && c.op !== "-=" && /^item_case_/u.test(String(c.itemId ?? ""))) hit = true; });
      if (hit) return map.name || "";
    }
    return "";
  })();
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const name = nameOf(ev);
    let changed = false;
    const pages = structuredClone(ev.pages ?? []) as unknown as Obj[];
    for (const pg of pages) {
      // 2) 범인이 아닌 사람의 자백 장면 → 목격 증언.
      const cmds = (pg.commands ?? []) as Obj[];
      const texts = cmds.filter((c) => c.kind === "text");
      const confessing = name && name !== culprit && visiblePerson(ev) && !JSON.stringify(cmds).includes(WITNESS_MARK)
        && !JSON.stringify(cmds).includes(ACCUSE_PROMPT)
        && texts.some((c) => CONFESS.test(String(c.body ?? "")) && (!c.speaker || c.speaker === name) && ![culprit, culprit.split(/\s+/u).at(-1)!].some((n) => String(c.body ?? "").startsWith(`${n}:`)));
      if (confessing) {
        const at = cmds.findIndex((c) => c.kind === "text");
        const witness: Obj[] = [
          { kind: "text", speaker: name, body: `${WITNESS_MARK} ${culprit}${jo(culprit, "이/가")} ${evidenceMap ? `${evidenceMap} 쪽으로` : "몰래"} 가는 걸 봤어요.` },
          { kind: "text", body: `${name}의 증언으로 ${culprit}${jo(culprit, "을/를")} 의심할 까닭이 생겼다.` },
        ];
        pg.commands = [...cmds.slice(0, at).filter((c) => c.kind !== "text"), ...witness, ...cmds.slice(at).filter((c) => c.kind !== "text")];
        changed = true;
        notes.push(`범인이 아닌 「${name}」의 자백 장면을 ${culprit} 목격 증언으로`);
        continue;
      }
      // 범인 갈래(증거 제시 맞는 보기) 안의 말하는 이 없는 자백 줄은 범인이 말한다(2026-10-29 vm3 flash: 「크윽... 제가 그랬습니다!」가 누구 말인지 없었다).
      walkCommands(pg.commands, (c) => {
        if (c.kind !== "choices" || c.prompt !== ACCUSE_PROMPT) return;
        for (const o of (c.options ?? []) as Obj[]) if (o.text === culprit) walkCommands(o.branch, (t) => {
          if (t.kind === "text" && !t.speaker && typeof t.body === "string" && CONFESS.test(t.body) && !/^[^:]{1,12}:/u.test(t.body)) { t.speaker = culprit; changed = true; notes.push(`범인 갈래 자백 줄 말하는 이 = ${culprit}`); }
        });
      });
      // 1) 범인이 아닌 사람을 범인으로 부르는 줄.
      walkCommands(pg.commands, (c) => {
        if (c.kind !== "text" || typeof c.body !== "string" || NEG.test(c.body)) return;
        let body = c.body;
        for (const [re, to] of claims) body = body.replace(re, to);
        if (body !== c.body) { notes.push(`「${c.body}」 → 「${body}」`); c.body = body; changed = true; }
      });
    }
    if (changed) run.call("upsert_event", { mapId: map.id, replacePages: true, event: { id: ev.id, ...(name ? { name } : {}), pages } });
  }
  return notes.length ? [`범인 지칭 맞춤(범인 ${culprit}): ${notes.slice(0, 4).join(" · ")}`] : [];
}

/** 아이템 이름을 바꾸고 대사 속 『옛 이름』(조사 받침까지)을 새 이름으로 — 「『옛 이름』을 알아냈다」 줄은 뺀다. */
function renameItemEverywhere(run: BuildRun, item: Project["database"]["items"][number], name: string): void {
  const old = String(item.name ?? "");
  run.call("upsert_item", { item: { ...structuredClone(item), name } });
  const esc = old.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const known = new RegExp(`^『${esc}』(?:을|를|을\\(를\\))\\s*알아냈다\\.?$`, "u");
  const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([mid, m]) => {
    const json = JSON.stringify(m.events ?? []);
    if (!json.includes(`『${old}』`)) return [mid, m];
    const drop = (list: unknown): unknown => Array.isArray(list)
      ? (list as Obj[]).filter((c) => !(c && c.kind === "text" && typeof c.body === "string" && known.test(c.body))).map(drop)
      : list && typeof list === "object" ? Object.fromEntries(Object.entries(list as Obj).map(([k, v]) => [k, drop(v)])) : list;
    const cleaned = JSON.stringify(drop(JSON.parse(json)))
      .replace(new RegExp(`『${esc}』(?:(을|를|이|가|은|는|과|와)(?![가-힣])(?:\\(를\\))?)?`, "gu"), (_m, j?: string) => `『${name}』${j ? jo(name, /을|를/u.test(j) ? "을/를" : /이|가/u.test(j) ? "이/가" : /은|는/u.test(j) ? "은/는" : "와/과") : ""}`);
    return [mid, { ...m, events: JSON.parse(cleaned) }];
  }));
  run.ctx.project = { ...run.ctx.project, maps } as Project;
}

/**
 * 증거 아이템 이름이 그것을 주는 대사의 물건과 다르면(「바닥에 떨어진 뜯어진 단추를 발견했다」 → 『진흙 묻은 조각』을 챙겼다) 대사의 물건 이름으로 맞춘다.
 * 왜(2026-10-29 vm4 argon 추리 재생): 모델 대사는 단추, 아이템은 청사진 gives 의 「진흙 묻은 조각」 — 둘이 다른 물건으로 읽혔다.
 */
function alignEvidenceToText(run: BuildRun): string[] {
  const keys = new Set<string>();
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "presentItem") for (const o of (c.options ?? []) as Obj[]) if (typeof o.itemId === "string") keys.add(o.itemId);
  });
  const notes: string[] = [];
  for (const id of keys) {
    const item = run.ctx.project.database.items.find((i) => i.id === id);
    const old = String(item?.name ?? "").trim();
    if (!item || !old || KEY_ITEM.test(old)) continue;
    let phrase: string | undefined;
    for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) {
      const list = (pg.commands ?? []) as unknown as Obj[];
      if (phrase || !list.some((c) => c.kind === "changeItem" && c.itemId === id && c.op !== "-=")) continue;
      for (const c of list) {
        if (c.kind !== "text" || typeof c.body !== "string" || c.body.includes("『")) continue;
        const m = /([가-힣]+(?:\s[가-힣]+)?)(?:을|를)\s*(?:발견했다|찾았다|주웠다|발견하였다|찾아냈다)/u.exec(c.body);
        if (m) { phrase = m[1]!.replace(/^(그|이|저|어떤)\s/u, "").trim(); break; }
      }
    }
    if (!phrase || phrase.length < 2 || phrase.length > 12 || isProgressWord(phrase) || KEY_ITEM.test(phrase)) continue;
    const head = phrase.split(/\s+/u).at(-1)!;
    if (old.includes(head) || phrase.includes(old)) continue;
    renameItemEverywhere(run, item, phrase);
    notes.push(`증거 『${old}』 → 대사의 물건 『${phrase}』`);
  }
  return notes;
}

/**
 * 지목 자리 이름이 사람처럼 읽히면(「범인 투숙객」·「수상한 손님」 — 투명 칸) 「범인 지목」으로, 지름길을 닫고 남은 빈 투명 칸(「수상한 손님」)은 지우고,
 * 목표 줄 꼬리의 「(남은 단서 3)」·지운 칸 이름은 지목 자리로 고친다.
 * 왜(2026-10-29 vm4 argon 추리 재생·판정 「범인 라벨이 시스템 문구」).
 */
function polishCaseNames(run: BuildRun): string[] {
  const notes: string[] = [];
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  if (!gate) return [];
  const old = nameOf(gate.ev);
  let gateName = old && !/^ev_/u.test(old) ? old : "범인 지목";
  const taken = new Set(Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id !== gate!.ev.id).map(nameOf)));
  const swaps: [string, string][] = [];
  if (!visiblePerson(gate.ev) && (/범인|용의자|손님|투숙객|수상한|사람|남은 단서/u.test(gateName) || /^ev_/u.test(old)) && gateName !== "범인 지목" && !taken.has("범인 지목")) {
    if (old) swaps.push([old, "범인 지목"]);
    gateName = "범인 지목";
    run.call("upsert_event", { mapId: gate.mapId, event: { id: gate.ev.id, name: gateName } });
    notes.push(`지목 자리 「${old || gate.ev.id}」 → 「범인 지목」`);
  }
  // 지름길을 닫고 남은 투명 칸 — 대사가 지목 자리 안내·남은 단서뿐이고 켜는 것도 주는 것도 없다.
  const bp = run.ctx.project.gameBlueprint;
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) {
    if (ev.id === gate.ev.id || visiblePerson(ev) || ev.id.endsWith("_evidence")) continue;
    const pages = ev.pages ?? [];
    if (!pages.length) continue;
    const onlyPointer = pages.every((pg) => (pg.commands ?? []).length > 0 && (pg.commands ?? []).every((c) => { const o = c as unknown as Obj; return o.kind === "text" && /^(범인을 밝히려면 「.+」에서 증거를 내밀고 지목하자\.|아직 단서가 모자라다\. 남은 단서 .+)$/u.test(String(o.body ?? "")); }));
    if (!onlyPointer || !pages.some((pg) => (pg.commands ?? []).some((c) => /^범인을 밝히려면/u.test(String((c as unknown as Obj).body ?? ""))))) continue;
    if (bp?.steps.slice(0, -1).some((st) => st.event === ev.id || st.event === nameOf(ev))) continue;
    run.call("remove_event", { mapId: map.id, eventId: ev.id });
    if (nameOf(ev)) swaps.push([nameOf(ev), gateName]);
    notes.push(`지름길을 닫고 남은 빈 칸 「${nameOf(ev) || ev.id}」 지움`);
  }
  // 대사·목표 속 옛 이름과 「(남은 단서 N)」 꼬리.
  let n = 0;
  const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => {
    let json = JSON.stringify(m.events ?? []);
    const before = json;
    for (const [from, to] of swaps) json = json.split(`「${from}」`).join(`「${to}」`);
    json = json.replace(/"message":"([^"]*?)"/gu, (all, msg: string) => {
      const stale = /\(남은 단서 \d+\)\s*$/u.test(msg) || swaps.some(([from]) => msg.includes(from) && from !== gateName);
      if (!stale) return all;
      n += 1;
      // 꼬리(어디)는 목표 칩과 같은 규칙 withWhere 로 — 다른 맵이면 「(<맵> 입구: 방위 → 범인 지목)」.
      const text = withWhere(run.ctx.project, id, `용의자들의 이야기를 듣고 「${gateName}」에서 증거를 내밀어 범인을 지목하자.`, gate!.ev.id);
      return `"message":${JSON.stringify(text)}`;
    });
    return [id, json === before ? m : { ...m, events: JSON.parse(json) }];
  }));
  run.ctx.project = { ...run.ctx.project, maps } as Project;
  if (bp) {
    const b2 = run.ctx.project.gameBlueprint!;
    const steps = b2.steps.map((st) => swaps.some(([from]) => st.event === from) ? { ...st, event: gate!.ev.id } : st);
    run.ctx.project = { ...run.ctx.project, gameBlueprint: { ...b2, steps } } as Project;
  }
  if (n) notes.push(`목표 줄 ${n}곳을 「${gateName}」 지목으로`);
  return notes;
}

/** 우리 지목 고르기의 용의자 이름(「아직 모르겠다」 빼고). */
function suspectNames(project: Project): string[] {
  const names: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "choices" && c.prompt === ACCUSE_PROMPT && !names.length) for (const o of (c.options ?? []) as Obj[]) { const t = String(o.text ?? ""); if (t && !/모르겠/u.test(t)) names.push(t); }
  });
  return names;
}

/** 지목 고르기에 나오는 용의자(사람 NPC)와 「이야기 들음」 스위치. */
function suspectsHeard(project: Project): { name: string; mapId: string; ev: GameEvent; switchId: string }[] {
  const names: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "choices" && c.prompt === ACCUSE_PROMPT && !names.length) for (const o of (c.options ?? []) as Obj[]) { const t = String(o.text ?? ""); if (t && !/모르겠/u.test(t)) names.push(t); }
  });
  return names.flatMap((name) => {
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) if (nameOf(ev) === name && visiblePerson(ev)) return [{ name, mapId: map.id, ev, switchId: `sw_case_heard_${hash(ev.id).toString(36)}` }];
    return [];
  });
}

/** 지목 전에 아직 이야기를 듣지 못한 용의자를 한 줄씩(스위치가 꺼진 사람만 — 갈래). */
function unheardLines(project: Project): Command[] {
  return suspectsHeard(project).filter((s) => (project.switches ?? []).some((w) => (w as { id?: string }).id === s.switchId))
    .map((s) => ({ kind: "fork", condition: { kind: "switch", switchId: s.switchId, value: false }, then: [{ kind: "text", body: `· 아직 「${s.name}」의 이야기를 듣지 못했다.` }] }) as unknown as Command);
}

/**
 * 용의자 심문 필수: 용의자마다 한 번은 말을 걸어(그 사람 대사가 나오는 페이지) 「이야기 들음」을 켜야 지목 고르기가 열린다.
 * 지목 페이지 앞에 같은 조건의 「탐문 남음」 페이지를 두어, 아직 못 들은 용의자 이름을 말한다(남은 단서 안내에도 같은 줄).
 * 왜(2026-10-29 vm4 flash 추리 판정): 「리노와 한스는 말을 걸지 않아도 엔딩이 나왔다. 용의자 심문이 필수가 아니다」.
 */
function requireInterrogation(run: BuildRun): string[] {
  const project = run.ctx.project;
  const suspects = suspectsHeard(project);
  if (suspects.length < 2) return [];
  const switches = ((project as unknown as { switches?: { id: string; name: string }[] }).switches ??= []);
  let marked = 0;
  for (const s of suspects) {
    if (!switches.some((w) => w.id === s.switchId)) switches.push({ id: s.switchId, name: `${s.name} 이야기 들음`.slice(0, 40) });
    const ev = run.ctx.project.maps[s.mapId]!.events.find((e) => e.id === s.ev.id)!;
    let touched = false;
    const pages = ((ev.pages ?? []) as unknown as Obj[]).map((pg) => {
      const cmds = (pg.commands ?? []) as Obj[];
      const speaks = cmds.some((c) => c.kind === "text" && (c.speaker === s.name || String(c.body ?? "").startsWith(`${s.name}:`)));
      if (!speaks || cmds.some((c) => c.kind === "setSwitch" && c.switchId === s.switchId)) return pg;
      touched = true;
      return { ...structuredClone(pg), commands: [{ kind: "setSwitch", switchId: s.switchId, value: true }, ...structuredClone(cmds)] };
    });
    if (!touched) continue;
    marked += 1;
    run.call("upsert_event", { mapId: s.mapId, replacePages: true, event: { id: ev.id, name: s.name, pages } });
  }
  // 지목 페이지에 조건, 그 앞에 「탐문 남음」.
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  if (!gate) return [];
  const heard = suspects.filter((s) => (run.ctx.project.maps[s.mapId]?.events ?? []).some((e) => e.id === s.ev.id && JSON.stringify(e.pages ?? []).includes(`"${s.switchId}"`)));
  if (heard.length < 2) return marked ? [`용의자 ${marked}명에 「이야기 들음」`] : [];
  const pages0 = (gate.ev.pages ?? []) as unknown as Obj[];
  const at = pages0.findIndex((pg) => JSON.stringify(pg.commands ?? []).includes(`"prompt":"${ACCUSE_PROMPT}"`));
  if (at < 0) return [];
  const page = pages0[at]!;
  const conds = (page.conditions ?? []) as Obj[];
  const need = heard.filter((s) => !conds.some((c) => c.kind === "switch" && c.switchId === s.switchId));
  if (!need.length) return [];
  const waiting: Obj = { ...structuredClone(page), id: `${String(page.id ?? gate.ev.id)}_unheard`, name: "탐문 남음", conditions: structuredClone(conds), commands: [{ kind: "text", body: "범인을 지목하기 전에 용의자들의 이야기를 모두 들어 보자." }, ...unheardLines(run.ctx.project)] };
  const gated: Obj = { ...structuredClone(page), conditions: [...structuredClone(conds), ...need.map((s) => ({ kind: "switch", switchId: s.switchId, value: true }))] };
  const pages = [...pages0.slice(0, at).filter((pg) => pg.name !== "탐문 남음"), waiting, gated, ...pages0.slice(at + 1)];
  run.call("upsert_event", { mapId: gate.mapId, replacePages: true, event: { id: gate.ev.id, ...(nameOf(gate.ev) ? { name: nameOf(gate.ev) } : {}), pages } });
  return [`용의자 심문 필수: ${heard.map((s) => s.name).join("·")}에게 한 번씩 말을 걸어야 지목이 열린다`];
}

const UNHEARD_OBJECTIVE = "아직 이야기 안 한 용의자";

const PENDING_MARK = /아직 못 찾은 단서가 있다|의 이야기를 듣지 않았다/u;
const forkObjectiveText = (c: Obj): string => {
  const then = (c.then ?? []) as Obj[];
  return then.length === 1 && isObjectiveCommand(then[0] as never) ? String(((then[0]!.fields ?? {}) as Obj).message ?? "") : "";
};
/** gateSuspectObjectives·pendingClueChain 이 씌운 갈래인가. */
const isWrapFork = (c: Obj): boolean => c.kind === "fork" && Array.isArray(c.else) && (c.else as Obj[]).length === 1 && (forkObjectiveText(c).includes(UNHEARD_OBJECTIVE) || PENDING_MARK.test(forkObjectiveText(c)));
/** 씌운 갈래를 벗긴 맨 안쪽 목표. */
const innerFinal = (c: Obj): Obj => (isWrapFork(c) ? innerFinal((c.else as Obj[])[0]!) : c);

/**
 * 용의자 대화 페이지의 목표를 「아직 이야기 안 한 용의자」 갈래로 건다 — 「이야기 들음」 스위치가 꺼진 용의자가 남아 있으면 그 사람에게 말을 걸라고,
 * 모두 들었을 때만 원래 목표(지목 자리)로. 끝맺음 맨 끝(fillStaleObjectives·refreshObjectiveRoutes 뒤)에 돈다 — 그 둘이 걸거나 다시 쓰는 목표도 감싼다.
 * 왜(2026-10-29 vm4 argon 추리 재생, 감독 지적): 리노와 이야기하자 다른 둘을 듣기 전인데도 목표가 「「범인 지목」을 찾아가자」였다(지목은 다 들어야 열린다).
 */
export function gateSuspectObjectives(project: Project): string[] {
  const registered = new Set((project.switches ?? []).map((w) => String((w as { id?: string }).id ?? "")));
  const suspects = suspectsHeard(project).filter((s) => registered.has(s.switchId));
  if (suspects.length < 2) return [];
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  const gateName = gate ? nameOf(gate.ev) : "";
  let wrapped = 0;
  for (const s of suspects) {
    const ev = (project.maps[s.mapId]?.events ?? []).find((e) => e.id === s.ev.id);
    if (!ev) continue;
    const chain = (final0: Obj): Obj[] => suspects.slice().reverse().reduce<Obj[]>((acc, other) => [{
      kind: "fork",
      condition: { kind: "switch", switchId: other.switchId, value: false },
      then: [objectiveCommand(withWhere(project, s.mapId, `${UNHEARD_OBJECTIVE} 「${other.name}」에게 말을 걸어 보자.`, other.ev.id)) as Obj],
      else: acc,
    }], [pendingClueChain(project, s.mapId, final0)]);
    for (const pg of (ev.pages ?? []) as unknown as Obj[]) {
      const cmds = (pg.commands ?? []) as Obj[];
      const at = cmds.findIndex((c) => c.kind === "setSwitch" && c.switchId === s.switchId);
      if (at < 0) continue;
      // 이미 감싼 페이지는 감싼 갈래를 풀어 맨 안쪽 목표를 다시 감싼다(남은 단서 갈래가 새로 붙거나 바뀌게 — 되풀이 안전).
      if (cmds.some(isWrapFork)) {
        const before = JSON.stringify(cmds);
        pg.commands = cmds.flatMap((c) => (isWrapFork(c) ? chain(innerFinal(c)) : [c]));
        if (JSON.stringify(pg.commands) !== before) wrapped += 1;
        continue;
      }
      if (JSON.stringify(cmds).includes(UNHEARD_OBJECTIVE)) continue;
      const chips = cmds.filter((c) => isObjectiveCommand(c as never));
      if (chips.length) pg.commands = cmds.flatMap((c) => chips.includes(c) ? chain(c) : [c]);
      else if (gate) pg.commands = [...cmds.slice(0, at + 1), ...chain(objectiveCommand(withWhere(project, s.mapId, `용의자들의 이야기를 모두 들었다. 「${gateName}」에서 증거를 내밀어 범인을 지목하자.`, gate.ev.id)) as Obj), ...cmds.slice(at + 1)];
      else continue;
      wrapped += 1;
    }
  }
  return wrapped ? [`용의자 대화 목표 ${wrapped}곳: 다 듣기 전엔 「${UNHEARD_OBJECTIVE}」, 다 들은 뒤에만 지목`] : [];
}

const THING_NOUN = "책상|탁자|테이블|식탁|의자|상자|궤짝|금고|서랍|책장|선반|침대|난로|벽난로|게시판|단상|제단|석상|우물|항아리|화분|장롱|옷장|진열장|진열대|계산대|카운터|수납장|보관함|장식장|책꽂이|작업대";

/**
 * 목표 글이 가리키는 물건이 맵에 없으면(이벤트 이름·칩셋 그림 어디에도 없는 꾸민 이름) 실제 대상 이벤트 이름으로 바꾼다 —
 * 지목 목표면 지목 이벤트, 아니면 그 목표를 거는 이벤트 다음 청사진 단계 이벤트. 대상을 모르면 두고, 「」로 감싼 이름은 건드리지 않는다.
 * 왜(2026-10-29 vm6 terra 추리): 목표 「홀의 단서 정리 책상에서 범인을 지목하고 증거를 제시하자」 — 그 책상은 맵 어디에도 없고 지목 칸은 「범인 지목」이었다.
 */
export function alignObjectiveThings(project: Project): string[] {
  const bare = (t: string) => t.replace(/\s+/gu, "");
  const eventNames = Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => bare(nameOf(e)))).filter((n) => n.length >= 2);
  const artOn = new Map<string, string[]>();
  const artNames = (map: GameMap): string[] => {
    const hit = artOn.get(map.id);
    if (hit) return hit;
    const seen = new Set<number>();
    const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
    for (const key of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"]) { const a = m[key]; if (a) for (let i = 0; i < a.length; i += 1) if (a[i]! >= 0) seen.add(a[i]!); }
    const out = [...seen].map((t) => bare(thingWords(tileLabel(project, map, t).replace(/^.*·\s*/u, "")))).filter(Boolean);
    artOn.set(map.id, out);
    return out;
  };
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  const steps = project.gameBlueprint ? resolveSteps(project) : [];
  const phrase = new RegExp(`((?:[가-힣]+\\s+){1,3})([가-힣]*(?:${THING_NOUN}))(에서|을|를|에게|으로|로|에|앞|옆|위)`, "gu");
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (!isObjectiveCommand(c as never)) return;
    const fields = c.fields as Obj;
    const message = String(fields.message);
    const body = message.replace(/\s*\([^()]*\)\s*$/u, "");
    let next = body;
    for (const hit of body.matchAll(phrase)) {
      // 「X의」·조사 붙은 앞말은 꾸밈말이 아니다 — 물건 이름은 그 뒤부터.
      const lead = hit[1]!.trim().split(/\s+/u);
      let cut = lead.length;
      while (cut > 0 && !/(의|에서|에게|을|를|은|는|하고|하여|해서|하면)$/u.test(lead[cut - 1]!)) cut -= 1;
      const words = [...lead.slice(cut), hit[2]!];
      if (words.length < 2) continue; // 「책상」 하나는 그림 아무 책상 — 꾸민 이름만 본다
      const name = bare(words.join(""));
      if (eventNames.some((n) => n.includes(name) || name.includes(n) && n.length >= 3) || artNames(map).some((a) => a.includes(name))) continue;
      const target = /지목|범인/u.test(body) && gate ? gate
        : (() => { const k = steps.findIndex((r) => r.ev.id === ev.id); const r = k >= 0 ? steps[k + 1] : undefined; return r ? { mapId: r.map.id, ev: r.ev } : undefined; })();
      const targetName = target ? nameOf(target.ev) : "";
      if (!targetName || /^ev_/u.test(targetName)) continue;
      const particle = hit[3]!;
      const fixed = /^(을|를)$/u.test(particle) ? jo(targetName, "을/를") : /^(으로|로)$/u.test(particle) ? (() => { const code = targetName.charCodeAt(targetName.length - 1) - 0xac00; const fin = code >= 0 && code < 11172 ? code % 28 : 0; return fin && fin !== 8 ? "으로" : "로"; })() : particle;
      next = next.replace(`${words.join(" ")}${particle}`, `「${targetName}」${fixed}`);
    }
    if (next === body) return;
    fields.message = withWhere(project, map.id, next, gate && next.includes(`「${nameOf(gate.ev)}」`) ? gate.ev.id : undefined);
    notes.push(`목표 「${body}」 → 「${String(fields.message)}」(맵에 없는 물건 이름)`);
  });
  return notes;
}

/** `<사람 id>_evidence` 조사 칸 — 사람(그림 있는 NPC)이 그 id 를 쥐고 있으면 칸이 아니다. */
const evidenceSpot = (map: GameMap, giverId: string): GameEvent | undefined => (map.events ?? []).find((e) => e.id === `${giverId}_evidence` && !visiblePerson(e));

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

/**
 * 증거 자리 안내가 허공을 가리키지 않게 — 사람이 「그러고 보니 소동 뒤에 <자리> 바닥에서 뭔가 반짝이던데…」「<자리> 바닥을 살펴보게…」라고 하는데
 * 그 사람의 조사 칸(`<id>_evidence`)이 없으면 그 두 줄을 뺀다. 그 id 를 사람(용의자)이 쥐고 있으면 사람 id 를 `<…>_person` 으로 바꾼다.
 * 왜(2026-10-29 vm7 argon 추리): 「주민 탐문」이 「가운데 안락의자 옆 바닥」을 보라고 했는데 그 조사 칸 id 를 용의자 「상인 도윤」이 쥐고 있었다
 * (다시 세운 사건이 같은 id 로 사람을 세웠다). 판정자는 안락의자 둘레를 여러 칸 눌러도 반응이 없어 진행이 막혔다고 했다.
 */
function dropDanglingEvidenceHints(run: BuildRun): string[] {
  const notes: string[] = [];
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of [...(map.events ?? [])]) {
    if (!ev.id.endsWith("_evidence") || !visiblePerson(ev)) continue;
    const next = `${ev.id.replace(/_evidence$/u, "")}_person`;
    if (Object.values(run.ctx.project.maps).some((m) => (m.events ?? []).some((e) => e.id === next))) continue;
    run.ctx.project = renameEventId(run.ctx.project, ev.id, next);
    notes.push(`사람 「${nameOf(ev)}」이 증거 조사 칸 id(${ev.id})를 쥐고 있어 ${next} 로 바꿈`);
  }
  const HINT = /^(?:그러고 보니 소동 뒤에 .+ 바닥에서 뭔가 반짝이던데… 한번 살펴보게\.|.+ 바닥을 살펴보게\. 범인이 흘린 게 있을지도 모르네\.)$/u;
  for (const [mapId, map] of Object.entries(run.ctx.project.maps)) {
    let changed = false;
    const events = (map.events ?? []).map((ev) => {
      if (!visiblePerson(ev) || evidenceSpot(map, ev.id)) return ev;
      let dropped = 0;
      const strip = (list: unknown): unknown => Array.isArray(list)
        ? list.filter((c) => { const hit = (c as Obj)?.kind === "text" && HINT.test(String((c as Obj).body ?? "")); if (hit) dropped += 1; return !hit; }).map((c) => {
          if (!c || typeof c !== "object") return c;
          const o = { ...(c as Obj) };
          for (const k of ["then", "else", "commands", "branch", "otherwiseBranch", "cancelBranch"]) if (Array.isArray(o[k])) o[k] = strip(o[k]);
          if (Array.isArray(o.options)) o.options = (o.options as Obj[]).map((opt) => (Array.isArray(opt.branch) ? { ...opt, branch: strip(opt.branch) } : opt));
          return o;
        })
        : list;
      const pages = (ev.pages ?? []).map((pg) => ({ ...pg, commands: strip(pg.commands ?? []) as typeof pg.commands }));
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
function evidenceOnThing(run: BuildRun): string[] {
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
      // 그 id 를 사람이 쥐고 있으면(다시 세운 용의자) 칸이 있는 것으로 치지 않는다 — 사람 id 는 dropDanglingEvidenceHints 가 먼저 바꾼다.
      if ((map0.events ?? []).some((e) => e.id === spotId)) continue;
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
        if (k !== pi && list.length && list.every((c) => c.kind === "text" && /^더는 볼 것이 없다\.?$/u.test(String(c.body ?? "")))) pg.commands = [{ kind: "text", speaker: who, body: `${near} 바닥을 살펴보게. 범인이 흘린 게 있을지도 모르네.` }];
      }
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

/** 증거가 떨어진 바닥 칸 — 사람 둘레 2~7걸음, 걸어 닿는 빈 바닥(이벤트·이동 칸 없음), 가구 곁이면 먼저. 가구 이름을 같이 준다. */
function evidenceCell(run: BuildRun, map: GameMap, giver: GameEvent): { x: number; y: number; near?: string } | undefined {
  const project = run.ctx.project;
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  const w = map.width;
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const furniture = (x: number, y: number): string => {
    if (x < 0 || y < 0 || x >= w || y >= map.height || isPassable(project, map, x, y)) return "";
    for (const key of ["upperTiles", "upperOverlayTiles"]) {
      const t = m[key]?.[y * w + x];
      if (typeof t !== "number" || t < 0) continue;
      const label = tileLabel(project, map, t).replace(/\s*\((?:-?\d+,\s*-?\d+)\)\s*$/u, "").replace(/^.*·\s*/u, "").replace(/\s*\d+[×x]\d+$/u, "").replace(/\s+[NSEW]$/u, "").trim();
      const named = thingWords(label);
      if (named && !/바닥|벽|깔개|러그|그림자|공허|천장|창|문|floor|wall|rug|shadow|ceiling|void|door/iu.test(named)) return named;
    }
    return "";
  };
  const taken = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
  const start = project.startMapId === map.id ? project.startPos : undefined;
  let best: { x: number; y: number; near?: string; score: number } | undefined;
  for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const d = Math.abs(x - giver.x) + Math.abs(y - giver.y);
    if (d < 2 || d > 7 || !reach[y * w + x] || taken.has(`${x},${y}`) || (start && start.x === x && start.y === y) || !isPassable(project, map, x, y)) continue;
    const near = [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => furniture(x + dx!, y + dy!)).find(Boolean);
    const score = (near ? 0 : 20) + d;
    if (!best || score < best.score || (score === best.score && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, near, score };
  }
  return best ? { x: best.x, y: best.y, near: best.near } : undefined;
}

/**
 * 추리 깊이(결정적): 범인의 진술과 그 진술을 깨는 증거를 잇고, 오답 지목에는 그 사람의 진술·증인으로 반박한다. 우리가 세운 사건 틀(「· 탐문」 용의자,
 * 「범인은 누구일까?」 고르기)에만 하고, 되풀이 안전(이미 쓴 줄은 다시 쓰지 않는다).
 *  - 범인 진술: 「밤새 <곳>에 혼자 있었소…」 뒤에 「<증거가 나온 맵>엔 간 적도 없소.」
 *  - 범인에게 증거를 내밀면: 「<범인>은 <맵>엔 간 적도 없다고 했다. 그런데 『X』는 <맵 자리>에 떨어져 있었다.」
 *  - 지목 증명: 「『X』는 <자리>에서 나왔다. <맵>엔 간 적도 없다던 <범인>의 말과 맞지 않는다.」
 *  - 오답: 「<그 사람>은 밤새 <곳>에 있었고, <증인>이 함께 있었다고 증언했다. 『X』도 처음 본다고 했다. 범인이 아니다.」
 *  - 증거 설명: 「[증거] <자리>에 떨어져 있던 『X』. 주인은 그 밤 <맵>에 있었다.」
 * 왜(2026-10-29 vm3~vm5 추리 판정): 「추리가 한 줄 증언으로 풀린다」「어떤 증거가 왜 범인을 가리키는지 한 번도 안 나온다」「증언이 어떻게 정리되는지 모른다」.
 */
function deepenCase(run: BuildRun): string[] {
  const project = run.ctx.project;
  let accuse: { mapId: string; ev: GameEvent } | undefined;
  let keyId: string | undefined, culprit = "";
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind !== "choices" || c.prompt !== ACCUSE_PROMPT || accuse) return;
    for (const o of (c.options ?? []) as Obj[]) {
      const first = ((o.branch ?? []) as Obj[])[0];
      if (first?.kind === "presentItem") { keyId = String((((first.options ?? []) as Obj[])[0]?.itemId) ?? ""); culprit = String(o.text ?? ""); }
    }
    if (keyId) accuse = { mapId: map.id, ev };
  });
  if (!accuse || !keyId || !culprit) return [];
  const item = project.database.items.find((i) => i.id === keyId);
  if (!item) return [];
  const X = String(item.name ?? "").trim();
  // 용의자 진술(「· 탐문」 페이지): 머문 곳·증인.
  const said = new Map<string, { place: string; witness?: string }>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const ask = (ev.pages ?? []).find((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? "")));
    if (!ask) continue;
    const text = textOf(ask.commands);
    const place = /밤새 ([^"]+?)에 (?:혼자 )?있었/u.exec(text)?.[1];
    if (place) said.set(nameOf(ev), { place, witness: /([^".]+?)(?:이|가) 같이 있었으니/u.exec(text)?.[1]?.replace(/^.*\s(?=\S+\s\S+$)/u, "").trim() });
  }
  // 증거가 나온 자리 — 그 아이템을 주는(사람 아닌) 조사 칸.
  let scene: { map: string; mapId: string; spot: string; near: string } | undefined;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (scene || visiblePerson(ev)) continue;
    let gives = false;
    for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (c.kind === "changeItem" && c.itemId === keyId && c.op !== "-=") gives = true; });
    if (!gives) continue;
    // 증거 물건 칸(evidenceOnThing)은 사람이 일러 준 자리 말(「남서쪽 의자 옆」)을 그대로 — 둘이 다르게 말하지 않게.
    const told = ev.id.endsWith("_evidence") ? /"body":"([^"]+?) 바닥에 『/u.exec(JSON.stringify(ev.pages ?? []))?.[1] : undefined;
    const thing = told ?? (hostThing(project, map, ev) || mapRegion(map, ev.x, ev.y));
    scene = { map: String(map.name ?? map.id), mapId: map.id, spot: `${String(map.name ?? map.id)} ${thing}`, near: /(옆|앞|근처|곁)$/u.test(thing) ? thing : `${thing} 근처` };
  }
  const notes: string[] = [];
  const C = culprit;
  const where = said.get(C);
  const contradiction = Boolean(scene && where && !where.place.includes(scene.map) && !scene.map.includes(where.place));
  // 용의자가 증거가 나온 그 맵에 서 있으면 맵 이름으로 부인하면 우습다(「여관 로비엔 간 적도 없소」라고 로비에서 말했다) — 그 자리 근처로.
  const culpritMap = Object.values(project.maps).find((m) => (m.events ?? []).some((e) => nameOf(e) === C && visiblePerson(e)))?.id;
  const denied = scene ? (culpritMap === scene.mapId ? `어젯밤 ${scene.near}` : scene.map) : "";
  let n = 0;
  const rewrite = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    const out: Obj[] = [];
    for (const raw of list as Obj[]) {
      if (!raw || typeof raw !== "object") { out.push(raw); continue; }
      // 앞서 쓴 깊이 줄은 걷고 지금 자리로 다시 쓴다(끝맺음이 증거 칸을 옮긴 뒤 다시 불린다 — 자리 말이 낡지 않게).
      if (raw.kind === "text" && typeof raw.body === "string" && /간 적도 없다고 했다|말과 맞지 않는다/u.test(raw.body)) continue;
      const c: Obj = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v as Obj[]).map((o) => o && typeof o === "object" && Array.isArray(o.branch) ? { ...o, branch: rewrite(o.branch) } : o) : v]));
      for (const [k, v] of Object.entries(c)) if (Array.isArray(v) && /^(then|else|branch|commands)$|Branch$/u.test(k)) c[k] = rewrite(v);
      if (c.kind === "text" && typeof c.body === "string") c.body = c.body.replace(/ [^.]+엔 간 적도 없소\.$/u, "");
      const body = c.kind === "text" && typeof c.body === "string" ? c.body : undefined;
      if (body !== undefined && contradiction && c.speaker === C && /^밤새 .+에 혼자 있었소\. 본 사람\? …없지만, 그게 무슨 상관이오\.$/u.test(body)) { c.body = `${body} ${denied}엔 간 적도 없소.`; n += 1; }
      const wrong = body !== undefined ? (/^(.+)에게는 (.+)의 증언이 있다\. 범인이 아니다\. 다시 생각해 보자\.$/u.exec(body)
        ?? /^(.+?)(?:은|는) (?:밤새 .+?에 있었고, )?(.+?)(?:이|가) 함께 있었다고 증언했다\. 『.+』도 처음 본다고 했다\. .+ 범인이 아니다\. 다시 생각해 보자\.$/u.exec(body)) : null;
      if (wrong) {
        const who = wrong[1]!, w = said.get(who)?.witness ?? wrong[2]!, at = said.get(who)?.place;
        c.body = `${who}${jo(who, "은/는")} ${at ? `밤새 ${at}에 있었고, ` : ""}${w}${jo(w, "이/가")} 함께 있었다고 증언했다. 『${X}』도 처음 본다고 했다. ${who}${jo(who, "은/는")} 범인이 아니다. 다시 생각해 보자.`;
        n += 1;
      }
      // 지목 증명 앞 — 진술과 증거가 맞지 않는다는 줄.
      if (body !== undefined && contradiction && body === `『${X}』${jo(X, "을/를")} 내밀자 ${C}${jo(C, "은/는")} 더는 버티지 못했다.` && !out.some((o) => String(o.body ?? "").includes("말과 맞지 않는다"))) {
        out.push({ kind: "text", body: `『${X}』${jo(X, "은/는")} ${scene!.spot}에서 나왔다. ${denied}엔 간 적도 없다던 ${C}의 말과 맞지 않는다.` });
        n += 1;
      }
      out.push(c);
      // 범인이 제 것이라 인정한 뒤 — 진술과 어긋난다는 서술.
      if (body !== undefined && contradiction && c.speaker === C && body === `『${X}』… 그건… 내 것이 맞소.`) {
        out.push({ kind: "text", body: `${C}${jo(C, "은/는")} ${denied}엔 간 적도 없다고 했다. 그런데 『${X}』${jo(X, "은/는")} ${scene!.spot}에서 나왔다.` });
        n += 1;
      }
    }
    // 되풀이 안전: 같은 서술이 둘이면 하나만.
    return out.filter((c, i) => !(c && c.kind === "text" && typeof c.body === "string" && /간 적도 없다고 했다|말과 맞지 않는다/u.test(c.body) && out.findIndex((o) => o && o.body === c.body) !== i));
  };
  const maps = Object.fromEntries(Object.entries(project.maps).map(([id, m]) => [id, { ...m, events: (m.events ?? []).map((ev) => ({ ...ev, pages: (ev.pages ?? []).map((pg) => ({ ...pg, commands: rewrite(pg.commands) })) })) }]));
  if (!n || JSON.stringify(maps) === JSON.stringify(project.maps)) return [];
  run.ctx.project = { ...project, maps: maps as unknown as Project["maps"] } as Project;
  if (scene && /^\[증거\]/u.test(String(item.description ?? ""))) run.call("upsert_item", { item: { ...structuredClone(item), description: `[증거] ${scene.spot}에 떨어져 있던 『${X}』. 주인은 그 밤 ${scene.map}에 있었다.` } });
  notes.push(`추리 깊이: 범인 ${C} 진술${contradiction ? `(「${where!.place}」) ↔ 증거 『${X}』(${scene!.spot}) 모순` : ""}·오답 반박 ${n}줄`);
  return notes;
}

/** 대사 속 「ev_npc_…」(청사진 step.event 가 id 라 그대로 적힌 이름)을 그 이벤트 이름으로. */
function nameLeakedEventIds(run: BuildRun): string[] {
  const names = new Map(Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).map((ev) => [ev.id, nameOf(ev)] as const)).filter(([, n]) => n && !/^ev_/u.test(n)));
  let n = 0;
  const maps = Object.fromEntries(Object.entries(run.ctx.project.maps).map(([id, m]) => {
    const json = JSON.stringify(m.events ?? []);
    const next = json.replace(/「(ev_[^」"]+)」/gu, (all, evId: string) => { const to = names.get(evId); if (!to) return all; n += 1; return `「${to}」`; });
    return [id, next === json ? m : { ...m, events: JSON.parse(next) }];
  }));
  if (!n) return [];
  run.ctx.project = { ...run.ctx.project, maps } as Project;
  return [`대사 속 이벤트 id ${n}곳을 이름으로`];
}

/**
 * 지목의 증거 제시(presentItem)가 요구하는 아이템을 아무도 주지 않으면 그 단서 단계가 준다 — 청사진 gives 가 그 아이템 이름(또는 그 스위치)인 단계,
 * 없으면 마지막 앞 단서 단계. 아이템 이름이 영문 토큰(「found_clue」)이면 설명의 괄호 속 물건 이름(없으면 「결정적 단서」)으로.
 * 왜(2026-10-29 vm4 argon 추리): 앞 빌드가 준 증거 아이템이 경로를 다시 지을 때 빠져, 지목은 영영 증명할 수 없고 판정자는 지름길로만 끝냈다.
 */
function ensureEvidenceGiven(run: BuildRun): string[] {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const wanted = new Set<string>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "presentItem") for (const o of (c.options ?? []) as Obj[]) if (typeof o.itemId === "string" && JSON.stringify(o.branch ?? []).includes('"triggerEnding"')) wanted.add(o.itemId);
  });
  const given = (id: string) => Object.values(run.ctx.project.maps).some((m) => (m.events ?? []).some((ev) => { let g = false; for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (c.kind === "changeItem" && c.itemId === id && c.op !== "-=") g = true; }); return g; }));
  const steps = resolveSteps(project);
  const last = steps.at(-1);
  for (const id of wanted) {
    if (given(id)) continue;
    const item = run.ctx.project.database.items.find((i) => i.id === id);
    if (!item) continue;
    const token = String(item.name ?? "");
    const src = steps.find((r) => r.k < (last?.k ?? Infinity) && (r.step.gives === token || shownToken(r.step.gives) === token)) ?? steps.filter((r) => r.k < (last?.k ?? Infinity) && !visiblePerson(r.ev)).at(-1);
    if (!src) continue;
    let name = token;
    if (!name || /^[A-Za-z0-9_\-]+$/u.test(name)) {
      name = /\(([^()]{2,16})\)/u.exec(String(item.description ?? ""))?.[1]?.trim() ?? "결정적 단서";
      run.call("upsert_item", { item: { ...structuredClone(item), name } });
    }
    let added = false;
    const pages = (src.ev.pages ?? []).map((page) => {
      const commands = [...(page.commands ?? [])] as Command[];
      const at = commands.findIndex((c) => (c as unknown as Obj).kind === "setSwitch" && (c as unknown as Obj).value !== false && !String((c as unknown as Obj).switchId).includes("taken"));
      if (at < 0 || added) return structuredClone(page);
      added = true;
      commands.splice(at + 1, 0, { kind: "changeItem", itemId: id, op: "+=", amount: 1 } as unknown as Command, { kind: "text", body: `『${name}』${jo(name, "을/를")} 증거로 챙겼다.` } as unknown as Command);
      return { ...structuredClone(page), commands };
    });
    if (!added) continue;
    run.call("upsert_event", { mapId: src.map.id, replacePages: true, event: { id: src.ev.id, ...(nameOf(src.ev) ? { name: nameOf(src.ev) } : {}), pages } });
    notes.push(`지목 증거 『${name}』 를 「${nameOf(src.ev) || src.step.event}」 에서 주게 함(아무도 주지 않았다)`);
  }
  return notes;
}

/** 페이지 이름(「남은 단서 3」)이 이벤트 이름이 된 판을 되돌린다 — 대사의 말하는 이(「수상한 손님: …」·speaker)가 있으면 그 이름, 없으면 「수상한 사람」. */
function repairPageNameLabels(run: BuildRun): string[] {
  const notes: string[] = [];
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) {
    const name = nameOf(ev);
    if (!/^남은 단서 \d+$/u.test(name)) continue;
    const said = [...JSON.stringify(ev.pages ?? []).matchAll(/"(?:speaker":"([^"]+)"|body":"([^":]{1,8}): )/gu)].map((m) => (m[1] ?? m[2] ?? "").trim()).filter((n) => n && !/^(주인공|나|플레이어)$/u.test(n));
    const to = said[0] ?? "수상한 사람";
    run.call("upsert_event", { mapId: map.id, event: { id: ev.id, name: to } });
    const bp = run.ctx.project.gameBlueprint;
    if (bp?.steps.some((st) => st.event === name)) run.ctx.project = { ...run.ctx.project, gameBlueprint: { ...bp, steps: bp.steps.map((st) => st.event === name ? { ...st, event: ev.id } : st) } } as Project;
    notes.push(`이벤트 이름 「${name}」 → 「${to}」`);
  }
  return notes;
}

/**
 * 범인 고르기·증거 제시를 거치지 않고 같은 엔딩을 부르는 다른 이벤트(지름길)를 닫는다 — 그 페이지는 지목하는 곳을 가리키는 한 줄만 남기고,
 * 청사진 마지막 단계가 그 지름길이면 지목 이벤트로 옮긴다.
 * 왜(2026-10-29 vm4 argon 추리 판정 major): 지목 고르기는 「범인 투숙객」에 섰는데, 모델 사슬의 마지막 「수상한 손님」은 단서 하나 뒤 말만 걸어도 자백·엔딩이었다.
 */
function closeEndingShortcuts(run: BuildRun): string[] {
  const project = run.ctx.project;
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const endsIn = (list: unknown): string[] => { const ids: string[] = []; walkCommands(list, (c) => { if (c.kind === "triggerEnding" && typeof c.endingId === "string") ids.push(c.endingId); }); return ids; };
  const gates: { mapId: string; ev: GameEvent; endings: Set<string> }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    let gate = false;
    for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if ((c.kind === "choices" && c.prompt === ACCUSE_PROMPT) || c.kind === "presentItem") gate = true; });
    if (gate) gates.push({ mapId: map.id, ev, endings: new Set((ev.pages ?? []).flatMap((pg) => endsIn(pg.commands))) });
  }
  const gate = gates.find((g) => g.endings.size > 0);
  if (!gate) return [];
  const gateName = nameOf(gate.ev) && !/^ev_/u.test(nameOf(gate.ev)) ? nameOf(gate.ev) : "범인 지목";
  const notes: string[] = [];
  let lastMoved = false;
  const lastStep = bp.steps.at(-1)!;
  for (const map of Object.values(run.ctx.project.maps)) for (const ev of map.events ?? []) {
    if (gates.some((g) => g.ev.id === ev.id)) continue;
    let touched = false;
    const pages = ((ev.pages ?? []) as unknown as Obj[]).map((pg) => {
      const hits = endsIn(pg.commands);
      if (!hits.length || !hits.some((id) => gate.endings.has(id))) return pg;
      let decides = false;
      walkCommands(pg.commands, (c) => { if (c.kind === "choices" || c.kind === "presentItem") decides = true; });
      if (decides) return pg;
      touched = true;
      const keep = ((pg.commands ?? []) as Obj[]).filter((c) => c.kind === "setSwitch" || c.kind === "changeItem" || c.kind === "setSelfSwitch");
      return { ...structuredClone(pg), commands: [{ kind: "text", body: `범인을 밝히려면 「${gateName}」에서 증거를 내밀고 지목하자.` }, ...structuredClone(keep)] };
    });
    if (!touched) continue;
    run.call("upsert_event", { mapId: map.id, replacePages: true, event: { id: ev.id, ...(nameOf(ev) ? { name: nameOf(ev) } : {}), pages } });
    notes.push(`「${nameOf(ev) || ev.id}」 의 바로 엔딩(자백)을 닫고 「${gateName}」 지목으로 보냄`);
    if (lastStep.event === ev.id || lastStep.event === nameOf(ev)) lastMoved = true;
  }
  if (lastMoved) {
    const gateMap = run.ctx.project.maps[gate.mapId];
    const steps = bp.steps.map((st, i) => i === bp.steps.length - 1 ? { ...st, event: gate.ev.id, place: gateMap?.name ?? gate.mapId } : st);
    run.ctx.project = { ...run.ctx.project, gameBlueprint: { ...run.ctx.project.gameBlueprint!, steps } } as Project;
    notes.push(`청사진 마지막 단계를 「${gateName}」 로`);
  }
  return notes;
}

function stageMysteryCaseInner(run: BuildRun): string[] {
  const project0 = run.ctx.project;
  if (!project0.gameBlueprint) return [];
  const pre: string[] = [];
  if (modelBuiltCase(project0)) {
    // 우리가 세운 용의자는 남았는데 경로를 다시 지어 마지막 단계의 범인 고르기가 사라졌으면(2026-10-29 vm3 terra 추리: 단서 셋 뒤 장부 보관함이 대사만 하고 엔딩)
    // 우리 용의자를 걷고 사건을 다시 세운다. 모델이 지은 사건(우리 표식 없는 증거 제시·고르기)은 그대로 둔다.
    const ours = Object.values(project0.maps).flatMap((map) => (map.events ?? []).filter((ev) => (ev.pages ?? []).some((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? "")))).map((ev) => ({ mapId: map.id, ev })));
    const last = resolveSteps(project0).at(-1);
    const lost = last && last.k === project0.gameBlueprint.steps.length - 1 && !(last.ev.pages ?? []).some((pg) => /"kind":"(?:choices|presentItem)"/u.test(JSON.stringify(pg.commands ?? [])));
    // 우리가 세운 범인이 엔딩 글이 말하는 범인과 다르면(vm3 deepseek 추리: 글은 「심부름꾼 두식」, 세운 범인은 악사 리노) 고르기를 풀고 다시 세운다.
    const ourNames = ours.map(({ ev }) => nameOf(ev));
    const unwrapped = last && !lost ? unwrapAccusation(last.ev) : undefined;
    const named = unwrapped ? pickCulprit(project0, [textOf(unwrapped.original)], new Set()) : undefined;
    const ourCulprit = unwrapped?.culprit;
    const mismatch = Boolean(named && ourCulprit && named.name !== ourCulprit && !ourNames.includes(named.name));
    // 고르기에 나오는 용의자가 맵 어디에도 없으면(유령 용의자) 고르기를 풀고 다시 세운다 — 2026-10-29 vm4 argon 추리 재생: 고르기는 미라·베티·로자인데
    // 경로를 다시 지으며 세 사람의 이벤트가 사라져, 말을 걸 사람 없이 이름만 고르는 지목이었다.
    const ghosts = unwrapped ? suspectNames(project0).filter((n) => !Object.values(project0.maps).some((m) => (m.events ?? []).some((e) => nameOf(e) === n && visiblePerson(e)))) : [];
    if (ghosts.length && last && unwrapped) {
      run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, ...(nameOf(last.ev) ? { name: nameOf(last.ev) } : {}), pages: unwrapped.pages } });
      for (const { mapId, ev } of ours) run.call("remove_event", { mapId, eventId: ev.id });
      pre.push(`고르기의 용의자 ${ghosts.join("·")}${jo(ghosts.at(-1)!, "이/가")} 맵에 없어 사건을 다시 세웠다`);
    } else if (!ours.length || (!lost && !mismatch)) {
      const art = showClueThings(run, resolveSteps(project0));
      return [...ensureEvidenceCondition(run), ...(art.length ? [...art, "추리 사건은 이미 지어져 있어(증거 제시·범인 고르기) 그대로 두었다"] : []), ...explainRemainingClues(run)];
    }
    if (mismatch && last && unwrapped) {
      run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, pages: unwrapped.pages } });
      pre.push(`세운 범인(${ourCulprit})이 엔딩 글의 범인(${named!.name})과 달라 다시 세웠다`);
    }
    if (!ghosts.length) {
      for (const { mapId, ev } of ours) run.call("remove_event", { mapId, eventId: ev.id });
      if (modelBuiltCase(run.ctx.project)) return [...showClueThings(run, resolveSteps(run.ctx.project)), ...explainRemainingClues(run)];
      pre.push(`경로를 다시 지어 범인 고르기가 사라져 사건을 다시 세웠다(용의자 ${ours.length}명 걷음)`);
    }
  }
  const notes = [...stageCase(run), ...ensureEvidenceCondition(run)];
  // 단서 칸 소품은 사건을 세운 뒤에 — 범인 대면으로 바뀌어 지운 심문 칸에 소품이 남지 않게.
  return [...pre, ...showClueThings(run, resolveSteps(run.ctx.project)), ...notes, ...explainRemainingClues(run)];
}

const ACCUSE_PROMPT = "범인은 누구일까?";
/** 우리가 세운 범인 고르기 페이지를 풀어 원래 엔딩 명령을 돌려준다(범인 이름·원래 명령·푼 페이지들). 고르기가 없으면 undefined. */
function unwrapAccusation(ev: GameEvent): { culprit: string; original: Command[]; pages: Obj[] } | undefined {
  let culprit = "", original: Command[] | undefined;
  const pages = ((ev.pages ?? []) as unknown as Obj[]).map((page) => {
    const cmds = (page.commands ?? []) as Obj[];
    const pick = cmds.find((c) => c.kind === "choices" && c.prompt === ACCUSE_PROMPT);
    if (!pick) return structuredClone(page);
    const right = ((pick.options ?? []) as Obj[]).find((o) => ((o.branch ?? []) as Obj[])[0]?.kind === "presentItem");
    const prove = right ? ((right.branch as Obj[])[0]!) : undefined;
    const branch = ((((prove?.options ?? []) as Obj[])[0]?.branch ?? []) as Command[]);
    if (!right || !branch.length) return structuredClone(page);
    culprit = String(right.text ?? "");
    original = structuredClone(branch.slice(1));
    const lead = cmds.filter((c) => c.kind === "changeFace");
    return { ...structuredClone(page), commands: [...lead, ...original] };
  });
  return original && culprit ? { culprit, original, pages } : undefined;
}

/**
 * 범인 고르기 페이지는 결정적 증거를 가졌을 때만 열린다 — 앞 단계 사슬이 끊겨(모델 단계를 그대로 둔 판) 증거 없이 고르기에 닿으면
 * 증거 제시가 「다른 것」 갈래로만 가서 엔딩에 못 간다(2026-10-29 vm3 deepseek·argon 추리 자동 플레이 실패 「페이지 2 대신 다른 페이지」).
 */
function ensureEvidenceCondition(run: BuildRun): string[] {
  const last = resolveSteps(run.ctx.project).at(-1);
  if (!last) return [];
  let changed = false;
  const pages = ((last.ev.pages ?? []) as unknown as Obj[]).map((page) => {
    const pick = ((page.commands ?? []) as Obj[]).find((c) => c.kind === "choices" && c.prompt === ACCUSE_PROMPT);
    if (!pick) return page;
    const prove = ((pick.options ?? []) as Obj[]).map((o) => ((o.branch ?? []) as Obj[])[0]).find((c) => c?.kind === "presentItem");
    const key = (((prove?.options ?? []) as Obj[])[0]?.itemId) as string | undefined;
    const conds = (page.conditions ?? []) as Obj[];
    if (!key || conds.some((c) => c.kind === "item" && c.itemId === key)) return page;
    changed = true;
    return { ...page, conditions: [...conds, { kind: "item", itemId: key, present: true }] };
  });
  if (!changed) return [];
  run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, pages } });
  return [`「${last.step.event}」 범인 고르기는 결정적 증거를 가졌을 때만`];
}

/**
 * 마지막(범인 지목) 단계가 잠겨 있을 때 남은 단서를 센다 — 「아직 단서가 모자라다. 남은 단서 2개: 「젖은 장화」(여관 동쪽)·「부엌 장부」」.
 * 앞 단계를 하나씩 마칠 때마다 켜지는 조건으로 페이지를 나눠, 지금 남은 것만 말한다. 되풀이 안전(이름 「남은 단서」 페이지를 다시 쓴다).
 * 왜(2026-10-29 vm3 terra 추리 판정): 단서 없이 장부 보관함을 조사하면 「먼저 금고를 살펴보자.」뿐 — 몇 개가 남았고 어디인지 몰라 맵을 뒤졌다.
 */
/**
 * 이벤트가 놓인 칸(몸 사각 포함)의 가구 이름 — 바닥·벽·깔개·그림자는 뺀다. 없으면 "".
 * 의자 칸 조사(단서 그림을 옆 탁자 위에 얹은 경우, examineArt)는 탁자 위 물건 이름(「책」)이 찾을 것이다.
 */
/**
 * 칩셋 이름표 꼬리(조각 자리·방향·크기 표식)를 떼어 물건 이름만 — 「책장 1w」「탁자 조각 LB」「긴 목재 탁자 상단」「거실 탁자 1,0」 → 책장·탁자·긴 목재 탁자·거실 탁자.
 * 왜(2026-10-29 vm6 terra 추리): 남은 단서 안내가 「「여관 장부」(남서쪽 책장 1w)」로 이름표 꼬리를 그대로 보였다.
 */
function thingWords(label: string): string {
  const words = label.replace(/\s*\([^()]*\)/gu, "").trim().split(/\s+/u).filter(Boolean);
  const tail = /[0-9A-Za-z]|^(상단|하단|중단|좌측|우측|중앙|왼쪽|오른쪽|윗부분|아랫부분|위|아래|조각|부분|끝|몸통|머리|다리)$/u;
  while (words.length > 1 && tail.test(words.at(-1)!)) words.pop();
  return words.length === 1 && /[0-9A-Za-z]/u.test(words[0]!) && !/[가-힣]/u.test(words[0]!) ? "" : words.join(" ");
}

function hostThing(project: Project, map: GameMap, ev: GameEvent): string {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const labelsAt = (x: number, y: number): string[] => x < 0 || y < 0 || x >= map.width || y >= map.height ? []
    : ["upperTiles", "upperOverlayTiles", "lowerOverlayTiles"].map((key) => m[key]?.[y * map.width + x])
      .filter((t): t is number => typeof t === "number" && t >= 0).map((t) => tileLabel(project, map, t));
  const clean = (label: string) => thingWords(label.replace(/\s*\((?:-?\d+,\s*-?\d+)\)\s*$/u, "").replace(/\s*\([^()]*\)/gu, "").replace(/\s+[NSEW]{2,4}$/u, "").replace(/^.*·\s*/u, "").replace(/\s*\d+[×x]\d+$/u, "").replace(/\s+[NSEW]$/u, "").trim());
  const fp = (ev.pages?.[0] as { footprint?: { width?: number; height?: number } } | undefined)?.footprint;
  const w = Math.max(1, fp?.width ?? 1), h = Math.max(1, fp?.height ?? 1), left = ev.x - Math.floor((w - 1) / 2);
  for (let y = ev.y; y > ev.y - h; y -= 1) for (let x = left; x < left + w; x += 1) {
    for (const raw of labelsAt(x, y)) {
      const label = clean(raw);
      if (!label || /바닥|벽|깔개|러그|양탄자|카펫|그림자|공허|천장|창|floor|wall|rug|carpet|shadow|ceiling|void/iu.test(label)) continue;
      if (/의자|걸상|chair|stool|bench/iu.test(label)) {
        const onTop = [[0, -1], [-1, 0], [1, 0], [0, 1]].flatMap(([dx, dy]) => labelsAt(ev.x + dx!, ev.y + dy!)).find((l) => /탁상 물건/u.test(l));
        if (onTop) return `탁자 위 ${clean(onTop)}`;
      }
      return label;
    }
  }
  return "";
}

/**
 * 끝맺음이 단서 이벤트를 옮긴 뒤(길목 비우기·물건 맞추기·가구 앉히기) 다시 불러 「남은 단서」 자리를 지금 자리로 고친다.
 * 왜(2026-10-29 vm5 terra 추리): 사건을 세울 때 쓴 「난로 옆 보관함(동쪽)」이 그대로 남았는데 이벤트는 그 뒤 가운데 안락의자로 옮겨졌다 —
 * 판정자가 동쪽 상자를 눌러 보다가 헤맸다.
 */
export function refreshRemainingClues(run: BuildRun): string[] {
  const project = run.ctx.project;
  if (!project.gameBlueprint || !isMysteryBlueprint(project)) return [];
  return explainRemainingClues(run);
}

/** 단계 r 을 마쳤다는 조건 — r 이벤트(와 그 사람이 가리킨 증거 조사 칸)가 켜는·주는 것 가운데 다음 단계 페이지 조건으로 쓰이는 것. */
function clueDoneCond(project: Project, r: Resolved, next: Resolved, earlier: readonly Resolved[] = []): Obj[] | undefined {
  const givesOf = (x: Resolved) => {
    const spot = evidenceSpot(x.map, x.ev.id);
    const own = eventGives(project, x.ev), more = spot ? eventGives(project, spot) : undefined;
    return { switches: [...own.switches, ...(more?.switches ?? [])], items: [...own.items, ...(more?.items ?? [])] };
  };
  const gives = givesOf(r);
  // 앞 단계도 켜는·주는 것은 이 단계를 마쳤다는 표시가 못 된다(vm7 argon 추리: 「주민 탐문」이 준 『상인과 용병의 증언』을 뒤뜰 단서도 다시 주어,
  // «뒤뜰 단서 찾음»이 그 아이템으로 잡혔다) — 이 단계만의 것을 먼저, 없으면 같이 주는 것.
  const before = earlier.filter((x) => x !== r).map(givesOf);
  const shared = (kind: "switches" | "items", id: string) => before.some((b) => b[kind].includes(id));
  let fallback: Obj[] | undefined;
  for (const pg of next.ev.pages ?? []) for (const c of ((pg.conditions ?? []) as unknown as Obj[])) {
    let hit: Obj[] | undefined, kind: "switches" | "items" = "switches", id = "";
    if (c.kind === "switch" && c.value !== false && gives.switches.includes(String(c.switchId))) { hit = [{ kind: "switch", switchId: c.switchId, value: true }]; id = String(c.switchId); }
    if (c.kind === "item" && c.present !== false && gives.items.includes(String(c.itemId))) { hit = [{ kind: "item", itemId: c.itemId, present: true }]; kind = "items"; id = String(c.itemId); }
    if (!hit) continue;
    if (!shared(kind, id)) return hit;
    fallback ??= hit;
  }
  return fallback;
}

/**
 * 지목 목표(final) 앞에 «아직 못 찾은 단서» 갈래를 씌운다 — 단서 단계(용의자 아님)마다 마친 조건이 꺼져 있으면 그 단서로 가는 목표(맵 입구 꼬리 포함)를 건다.
 * 왜(2026-10-29 vm7 argon 추리): 용의자 셋과 이야기를 마치자 목표가 「「범인 지목」을 찾아가자」로 바뀌었는데 뒤뜰 덤불 단서를 아직 못 찾은 때였다.
 * 지목 칸은 「단서가 모자라다」고 거절했고, 목표 화살표는 뒤뜰이 아니라 지목 칸을 가리켜 판정자는 넓은 뒤뜰에서 덤불을 끝내 못 찾았다.
 */
function pendingClueChain(project: Project, fromMapId: string, final: Obj): Obj {
  const bp = project.gameBlueprint;
  const steps = resolveSteps(project);
  const last = steps.at(-1);
  if (!bp || !last || last.k !== bp.steps.length - 1) return final;
  const clues = steps.filter((r) => r.k < last.k);
  const suspect = (ev: GameEvent) => (ev.pages ?? []).some((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? "")));
  const label = (r: Resolved) => { const n = nameOf(r.ev); return n && !/^ev_/u.test(n) ? n : r.step.event; };
  const pending: { cond: Obj; text: string }[] = [];
  for (const [j, r] of clues.entries()) {
    if (suspect(r.ev)) continue;
    const cond = clueDoneCond(project, r, clues[j + 1] ?? last, clues.slice(0, j))?.[0];
    if (!cond) continue;
    const spot = evidenceSpot(r.map, r.ev.id);
    const target = spot ?? r.ev;
    const name = spot ? nameOf(spot) : label(r);
    const text = visiblePerson(target) ? `아직 「${name}」의 이야기를 듣지 않았다. 「${name}」에게 말을 걸어 보자.` : `아직 못 찾은 단서가 있다. 「${name}」${jo(name, "을/를")} 찾아보자.`;
    const negated = cond.kind === "switch" ? { kind: "switch", switchId: cond.switchId, value: false } : { kind: "item", itemId: cond.itemId, present: false };
    pending.push({ cond: negated, text: withWhere(project, fromMapId, text, target.id) });
  }
  return pending.reduceRight<Obj>((acc, p) => ({ kind: "fork", condition: p.cond, then: [objectiveCommand(p.text) as Obj], else: [acc] }), final);
}

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
  // 단계 사람이 가리킨 증거 물건 칸(evidenceOnThing `<id>_evidence`)이 주는 것도 그 단계의 결과다.
  const spotOf = (r: Resolved) => evidenceSpot(r.map, r.ev.id);
  const doneCond = (r: Resolved, next: Resolved): Obj[] | undefined => clueDoneCond(project, r, next, steps.filter((x) => x.k < r.k));
  const openCond = (j: number): Obj[] | undefined => doneCond(clues[j - 1]!, clues[j] ?? last);
  const pages0 = ((last.ev.pages ?? []) as unknown as Obj[]).filter((pg) => !/^남은 단서/u.test(String(pg.name ?? "")));
  // 마지막 단계 이벤트가 앞 단계도 맡으면(standin 추리: 「여관 주인」이 첫 단계와 범인 지목을 함께) 그 잠김 페이지는 앞 단계의 일이다 — 건드리지 않는다.
  if (clues.some((r) => r.ev.id === last.ev.id && r.map.id === last.map.id)) return [];
  // 잠김 페이지 = 조건 없이 대사만 하는 페이지(스위치·아이템·이동 같은 다른 명령이 없다).
  const isLocked = (pg: Obj) => !(pg.conditions as unknown[] | undefined)?.length && Array.isArray(pg.commands) && pg.commands.length > 0 && (pg.commands as Obj[]).every((c) => c.kind === "text" || c.kind === "changeFace");
  let lockedAt = pages0.findIndex(isLocked);
  let locked = pages0[lockedAt];
  // 다시 부를 때(끝맺음이 단서를 옮긴 뒤 refreshRemainingClues): 잠김 페이지는 이미 「남은 단서 n」 페이지들로 바뀌었다 — 그 첫 장을 틀로, 그 자리에 다시 쓴다.
  const all = (last.ev.pages ?? []) as unknown as Obj[];
  // 「남은 단서」 페이지에는 「아직 「X」의 이야기를 듣지 못했다」 갈래가 붙는다 — 그 갈래(대사뿐)도 잠김 페이지로 친다. 전에는 갈래 때문에 다시 쓰기를 못 해
  // 사건을 다시 세워 사라진 옛 용의자(「마부 한스」)를 계속 «아직 못 들었다»고 했다(2026-10-29 vm7 argon 추리).
  const textFork = (c: Obj) => c.kind === "fork" && ((c.then ?? []) as Obj[]).every((t) => t.kind === "text") && !((c.else ?? []) as Obj[]).length;
  const firstOld = all.findIndex((pg) => /^남은 단서/u.test(String(pg.name ?? "")) && !(pg.conditions as unknown[] | undefined)?.length && Array.isArray(pg.commands) && (pg.commands as Obj[]).every((c) => c.kind === "text" || c.kind === "changeFace" || textFork(c)));
  if (lockedAt < 0 && firstOld >= 0) {
    lockedAt = all.slice(0, firstOld).filter((pg) => !/^남은 단서/u.test(String(pg.name ?? ""))).length;
    locked = { ...all[firstOld]!, name: undefined, id: String(all[firstOld]!.id ?? "").replace(/_left\d+$/u, "") };
    pages0.splice(lockedAt, 0, locked);
  }
  if (lockedAt < 0 || !locked) return [];
  // 자리 = 맵 방위 + 이벤트가 실제로 놓인 물건 이름(「난로 옆 보관함」이 안락의자 위면 「가운데 안락의자」) — 이름 낱말만으로는 어느 가구를 눌러야 할지 모른다.
  // 이름은 이벤트 이름(청사진 step.event 가 이벤트 id 로 바뀐 판에 「ev_npc_…」가 샜다 — vm4 argon 추리).
  const label = (r: Resolved) => { const n = nameOf(r.ev); return n && !/^ev_/u.test(n) ? n : r.step.event; };
  // 우리가 세운 용의자 단계는 범인 한 명 이름 대신 용의자 모두(이름만 대면 범인을 알려 주는 셈 — vm5 argon 「남은 단서 1개: 「상인 오언」」),
  // 같은 맵에 선 사람은 방위를 붙이지 않는다(보이는 사람이다. 사람은 비켜 서며 옮겨 방위가 틀렸다 — 판정자는 「(남쪽)」을 남쪽 출구로 읽었다).
  const ours = (m: GameMap) => (m.events ?? []).filter((e) => (e.pages ?? []).some((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? ""))));
  const where = (r: Resolved) => {
    const suspects = ours(r.map);
    if (suspects.some((e) => e.id === r.ev.id)) return `용의자 ${suspects.map((e) => `「${nameOf(e)}」`).join("·")}에게 증거 내밀기${r.map.id === last.map.id ? "" : `(${r.map.name ?? r.map.id})`}`;
    const spot = spotOf(r);
    if (spot) return `「${label(r)}」${jo(label(r), "이/가")} 말한 「${nameOf(spot)}」${r.map.id === last.map.id ? "" : `(${r.map.name ?? r.map.id})`}`;
    if (r.map.id === last.map.id && visiblePerson(r.ev)) return `「${label(r)}」`;
    const thing = hostThing(project, r.map, r.ev);
    const place = r.map.id === last.map.id ? mapRegion(r.map, r.ev.x, r.ev.y) : r.map.name ?? r.map.id;
    return `「${label(r)}」(${thing && !label(r).includes(thing) ? `${place} ${thing}` : place})`;
  };
  const progress: Obj[] = [];
  for (let j = 0; j < clues.length; j += 1) {
    const cond = j === 0 ? [] : openCond(j);
    if (j > 0 && !cond?.length) return [];
    const left = clues.slice(j);
    const body = `아직 단서가 모자라다. 남은 단서 ${left.length}개: ${left.map(where).join("·")}`;
    progress.push({ ...structuredClone(locked), id: `${String(locked.id ?? last.ev.id)}_left${j}`, name: `남은 단서 ${left.length}`, conditions: structuredClone(cond ?? []), commands: [{ kind: "text", body }, ...unheardLines(project)] });
  }
  const pages = [...pages0.slice(0, lockedAt), ...progress, ...pages0.slice(lockedAt + 1)];
  if (JSON.stringify(pages) === JSON.stringify(last.ev.pages ?? [])) return [];
  // 이름을 함께 넘긴다 — 빠지면 첫 페이지 이름 「남은 단서 3」이 이벤트 이름표가 됐다(vm4 argon 추리 판정 「범인 라벨이 시스템 문구」).
  run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, ...(nameOf(last.ev) ? { name: nameOf(last.ev) } : {}), pages } });
  return [`「${label(last)}」 잠김 대사에 남은 단서 수·자리(${clues.length}단계)`];
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
  // 증거 물건(열쇠 아닌 아이템)을 주는 단계는 «심문»이 아니라 단서 단계다 — vm5 flash 「증거 수집」(투숙객 심문하고 방을 뒤져 밀봉된 편지)을
  // 심문으로 잡아 증거가 앞 단계의 객실 열쇠뿐이 되자 사건을 못 세웠다(용의자 0명).
  const givesEvidence = (r: Resolved) => eventGives(run.ctx.project, r.ev).items.some((id) => { const it = run.ctx.project.database.items.find((i) => i.id === id); return Boolean(it) && !KEY_ITEM.test(it!.name ?? ""); });
  const talk = [...resolved].reverse().find((r) => r.k > 0 && r.k < last.k && TALK_STEP.test(`${r.step.event} ${r.step.action}`) && !givesEvidence(r));
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
  // 글이 범인으로 부르는 사람이 이미 맵에 서 있으면(모델이 세운 NPC) 그 사람을 범인으로 쓴다 — 새로 세우면 글은 「심부름꾼 두식을 지목한다」인데
  // 고르기의 범인은 풀에서 뽑은 「악사 리노」가 됐다(2026-10-29 vm3 deepseek 추리).
  const namedAny = pickCulprit(run.ctx.project, culpritTexts, new Set());
  const standing = namedAny ? Object.values(run.ctx.project.maps).flatMap((m) => (m.events ?? []).filter((e) => nameOf(e) === namedAny.name && visiblePerson(e)).map((e) => ({ mapId: m.id, ev: e })))[0] : undefined;
  const culprit = (standing ? namedAny : undefined) ?? pickCulprit(run.ctx.project, culpritTexts, taken) ?? POOL.filter((p) => !taken.has(p.name))[seed % POOL.length]!;
  const innocents = POOL.filter((p) => p.name !== culprit.name && p.role !== culprit.role && !taken.has(p.name));
  if (innocents.length < 2) return notes;
  const a = innocents[seed % innocents.length]!;
  const b = innocents.filter((p) => p !== a)[(seed >> 3) % (innocents.length - 1)]!;
  const stage = standing ? run.ctx.project.maps[standing.mapId]! : (replaceTalk ?? talk ?? last).map;
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
  const toPlace = order.filter((p) => !(standing && p.name === culprit.name));
  const placed = buildPeople(run, toPlace.map((p, i) => ({ role: p.role, name: p.name, looks: p.looks, mapId: stage.id, at: { x: anchor.x + (i - 1) * 2, y: anchor.y }, firstTalk: ["…"] })), stage.id);
  const ids = new Map<string, string>();
  for (const [i, e] of (placed.eventIds ?? []).entries()) ids.set(toPlace[i]!.name, e.eventId);
  if (standing) ids.set(culprit.name, standing.ev.id);
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
    // 모델이 대사에 남긴 설계 메모 「(범인을 잘못 지목하는 갈래도 있으나 진엔딩은 두식 지목)」는 뺀다.
    const original = (structuredClone(page.commands ?? []) as unknown as Obj[]).map((c) => c.kind === "text" && typeof c.body === "string" ? { ...c, body: c.body.replace(/\s*\([^()]*(?:갈래|분기|진엔딩|엔딩은|플레이어가)[^()]*\)/gu, "").trim() } : c).filter((c) => c.kind !== "text" || String(c.body).length > 0) as unknown as Command[];
    const prove: Command = {
      kind: "presentItem", prompt: `무엇으로 ${withJosa(culprit.name, "을/를")} 증명할까?`, itemIds: allIds,
      options: [{ itemId: key.id, branch: [...narrate([`『${evName}』${jo(evName, "을/를")} 내밀자 ${withJosa(culprit.name, "은/는")} 더는 버티지 못했다.`]), ...original] }],
      otherwiseBranch: narrate(["그것만으로는 증명할 수 없다. 다시 생각해 보자."]), cancelBranch: narrate(["증거를 다시 살펴보자."]), consume: false,
    } as unknown as Command;
    const options = [...names].sort().map((n) => n === culprit.name
      ? { text: n, branch: [prove] }
      : { text: n, branch: narrate([`${n}에게는 ${witness.get(n)?.name ?? "다른 사람"}의 증언이 있다. 범인이 아니다. 다시 생각해 보자.`]) });
    options.push({ text: "아직 모르겠다", branch: narrate(["조금 더 조사해 보자."]) });
    const pick: Command = { kind: "choices", prompt: ACCUSE_PROMPT, options, cancelBehavior: "branch", cancelBranch: narrate(["조금 더 조사해 보자."]) } as unknown as Command;
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
