// omo 할 일 항목의 기계 검사 — 모델이 「다 됐다」고 표시한 항목을 프로젝트만 읽어 결정적으로 판정한다(순수 함수, 부작용 없음).
//
// 대상 고르기(2026-10-30 감독 검토 — 이름만으로는 시작 저장본에 원래 있던 것·부분 일치한 다른 대상·여럿 중 아무거나로 통과했다):
//  ① 항목에 refs(고리가 쓰기 전후 차이로 묶은 id)가 있으면 그 id 들만 판정 대상(이름은 그 안에서 고르는 데만). 묶인 id 가 사라졌으면 실패.
//  ② refs 가 없으면 이름으로 찾되 fresh 면 이번 턴에 새로 생기거나 바뀐 것(ctx.changed)만 후보.
//  ③ 가장 잘 맞는 후보가 이름이 다른 둘 이상이면 통과시키지 않고 「모호함」 — refs 로 묶으라고 적는다. 같은 이름(같은 인물의 여러 이벤트)은 한 무리로 본다.
//     같음 > 부분 일치(같음이 하나도 없을 때만, 짧은 쪽 ≥ 긴 쪽 절반). 이벤트 자기 이름이 대사 화자·적 이름보다 앞선다.
//  ④ detail·evidence 에 잡은 대상 id 를 싣는다. 못 찾으면 가장 가까운 후보를 적어 모델이 다음 바퀴에 고칠 수 있게 한다.
// 걷기 판정은 기존 검사와 같은 함수를 쓴다:
//  - 맵 안: puzzleFlow(앵커=시작점·착지점, 같은 맵 퍼즐 문은 장치를 켤 수 있으면 열림) + bodyReached(그 칸 또는 옆에 닿음).
//  - 맵 사이: 시작 맵에서 출발해, 닿는 이동 이벤트의 도착 맵으로 넓혀 간다(다른 맵 스위치는 puzzleFlow 가 켤 수 있다고 본다).
// 보스 판정은 gateBattleSteps 와 같은 낱말(boss/보스 — 이벤트 id·적 그룹 id)과 도망 불가에 이름(마왕·군주·수문장 등)을 더했다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isPlaceholderMap } from "../blankStart";
import { endingConditionsUnset } from "./shipChecks";
import { isObjectiveCommand } from "./objectiveCommand";
import { isPersonEvent } from "../place/placementRules";
import { nameScore, normName } from "../todo/names";
import type { CheckResult, TodoCheck, TodoCheckContext, TodoItem, TodoPlaceKind } from "../todo/types";
import { Obj, Cmd, setEnglish, t, walk, deepCmds, liveFacts, liveCmds, scanLive, deadNote, mapLabel, evLabel, at, mapAt, q, evKey, evEvidence, eventNameTiers, Named, scoreNamed, choose, Scope, scopeOf, has, refEvent, freshOnly, eventInScope, eventBound, mapInScope, itemInScope, scopeNote, missingRefs, mapNamed, allMapNames, resolveMaps, isResult, scopeMaps, EvRef, evNamed, eventNameList, mapReach, eventReached, transfersOut, walkWorld, startOf, GROUP, mapKinds, troopOf, troopNames, isBossBattle } from "./todoCheckFacts";
import { checkRoomZones, checkLayoutBuilt, checkLayoutReview, checkRoomGraph } from "./todoRoomChecks";
export type { TodoCheckContext };


// ───────────── 판정 ─────────────

export function runTodoCheck(project: Project, check: TodoCheck, ctx: TodoCheckContext = {}): CheckResult {
  if (check.kind === "none") return { pass: true, detail: t("판정자 확인 항목", "judged by a reviewer, not by machine") };
  const gone = missingRefs(project, ctx.refs);
  if (gone.length) return { pass: false, detail: t(`묶인 대상 사라짐: ${gone.slice(0, 4).join(", ")} — 지워졌거나 다른 id 로 다시 만들어졌다`, `bound target gone: ${gone.slice(0, 4).join(", ")} — deleted, or rebuilt with another id`) };
  const sc = scopeOf(check, ctx);
  switch (check.kind) {
    case "place": return checkPlace(project, sc, check.name, check.placeKind);
    case "person": return checkPerson(project, sc, check.name, check.map);
    case "talk": return checkTalk(project, sc, check.who, check.says);
    case "battle": return checkBattle(project, sc, check.who, check.map, check.boss);
    case "link": return checkLink(project, sc, check.from, check.to);
    case "ending": return checkEnding(project, sc, ctx, check.map);
    case "item": return checkItem(project, sc, check.name, check.gives);
    case "present_evidence": return checkPresent(project, sc, check.item, check.to);
    case "objective": return checkObjective(project, sc, check.text);
    case "reachable": return checkReachable(project, sc, check.target, check.from, ctx);
    case "party_join": return checkPartyJoin(project, sc, ctx, check.name, check.map);
    case "room_zones": return checkRoomZones(project, sc, check.map, check.min);
    case "room_graph": return checkRoomGraph(project, sc, check.map);
    case "layout_built": return checkLayoutBuilt(project, sc, check.map);
    case "layout_review": return checkLayoutReview(project, sc, check.map);
    case "code_lock": return checkCodeLock(project, sc, check.code, check.hintAfter, check.on);
  }
}

// ───────────── 번호 자물쇠 ─────────────
// 2026-11-01 값싼 모델 대조(gemini-3.8-flash 자물쇠 판): 할 일을 «목표 줄»로 확인하게 적어 자물쇠 없이 ✓ 로 닫았다. 요청 뼈대가
// 이 확인을 덧붙여 «입력 → 정답 분기 → 열림(+틀린 횟수 힌트)» 이 실제 명령으로 있어야 끝난다.
type CmdNode = Record<string, unknown>;
function branchesOf(c: CmdNode): CmdNode[][] {
  const out: CmdNode[][] = [];
  for (const k of ["then", "else", "body", "commands", "cancelBranch", "otherwiseBranch", "victoryBranch", "defeatBranch", "escapeBranch"]) if (Array.isArray(c[k])) out.push(c[k] as CmdNode[]);
  for (const o of (Array.isArray(c.options) ? c.options : []) as CmdNode[]) if (o && Array.isArray(o.branch)) out.push(o.branch as CmdNode[]);
  return out;
}
function flatCmds(list: unknown, out: CmdNode[] = []): CmdNode[] {
  for (const c of (Array.isArray(list) ? list : []) as CmdNode[]) { if (!c || typeof c !== "object") continue; out.push(c); for (const b of branchesOf(c)) flatCmds(b, out); }
  return out;
}
/** 정답 갈래가 실제로 무엇을 여나 — 이동·엔딩·타일·공통 이벤트·물건은 그 자체로, 스위치는 그 스위치를 조건으로 읽는 페이지·분기가
 * 그런 일을 할 때만(두 단계까지). 2026-11-01 cheap r6 deepseek: 정답에 스위치만 켜고 그 스위치로 «문이 조금 열렸다» 글만 보여
 * 서재 문은 그대로 잠겨 엔딩에 못 갔는데 ✓ 였다. */
const EFFECT = new Set(["transfer", "triggerEnding", "ending", "changeTile", "callCommonEvent", "changeItem"]);
function opensSomething(project: Project, ev: GameEvent, cmds: CmdNode[], depth = 0): boolean {
  if (cmds.some((c) => EFFECT.has(String(c.kind)))) return true;
  if (depth >= 2) return false;
  for (const c of cmds) {
    const self = c.kind === "setSelfSwitch";
    if (c.kind !== "setSwitch" && !self) continue;
    const key = self ? `"key":"${String(c.key ?? c.selfSwitch ?? "A")}"` : `"switchId":"${String(c.switchId)}"`;
    const reads = (cond: unknown) => { const j = JSON.stringify(cond ?? null); return j.includes(key) && (!self || j.includes("selfSwitch")); };
    for (const map of Object.values(project.maps)) for (const other of (map.events ?? []) as GameEvent[]) {
      if (self && other.id !== ev.id) continue;
      for (const page of ((other as unknown as { pages?: { conditions?: unknown; commands?: unknown }[] }).pages ?? [])) {
        if (reads(page.conditions) && opensSomething(project, other, flatCmds(page.commands), depth + 1)) return true;
        for (const f of flatCmds(page.commands)) if (f.kind === "fork" && reads(f.condition) && opensSomething(project, other, flatCmds(f.then), depth + 1)) return true;
      }
    }
  }
  return false;
}
function checkCodeLock(project: Project, sc: Scope, code: string, hintAfter?: number, on?: string): CheckResult {
  const want = Number(code);
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) {
    for (const ev of (map.events ?? []) as GameEvent[]) {
      if (!eventInScope(sc, map, ev)) continue;
      const pages = ((ev as unknown as { pages?: { commands?: unknown }[] }).pages ?? [{ commands: (ev as unknown as { commands?: unknown }).commands }]);
      for (const page of pages) {
        const all = flatCmds(page.commands);
        const inputs = all.filter((c) => c.kind === "inputNumber" && typeof c.variableId === "string").map((c) => String(c.variableId));
        if (!inputs.length) continue;
        // 요청이 자물쇠 자리를 이름으로 말했으면(「자물쇠」를 조사하면 …) 그 이벤트여야 한다 — 2026-11-01 cheap r4 flash: 번호 입력을 「액자」에 붙이고 ✓ 로 닫았다.
        if (on && nameScore(on, String(ev.name ?? "")) <= 0) { notes.push(t(`${at(map, ev)}: 번호를 받지만 요청의 자물쇠는 「${on}」이다 — 「${on}」 이벤트에 붙인다`, `${at(map, ev)}: takes the number, but the request puts the lock on «${on}» — put it on the «${on}» event`)); continue; }
        const forks = all.filter((c) => c.kind === "fork");
        const right = forks.find((f) => { const k = f.condition as CmdNode | undefined; return k?.kind === "variable" && inputs.includes(String(k.variableId)) && Number(k.value) === want && (k.op === "==" || k.op === undefined); });
        if (!right) { notes.push(t(`${at(map, ev)}: 숫자를 받지만 ${code} 와 같은지 묻는 분기가 없다`, `${at(map, ev)}: takes a number but no fork compares it == ${code}`)); continue; }
        const opens = opensSomething(project, ev, flatCmds(right.then));
        if (!opens) { notes.push(t(`${at(map, ev)}: ${code} 정답 분기가 아무것도 열지 않는다 — 이동·엔딩이 없고, 켠 스위치를 읽어 문을 여는(이동·엔딩) 페이지도 없다`, `${at(map, ev)}: the == ${code} branch opens nothing — no transfer or ending, and no page reads the switch it sets to open a way out (a transfer or an ending)`)); continue; }
        if (hintAfter) {
          const counters = all.filter((c) => c.kind === "setVariable" && (c.op === "+=" || c.op === "+") && Number(c.value) === 1).map((c) => String(c.variableId));
          const hint = forks.find((f) => { const k = f.condition as CmdNode | undefined; return k?.kind === "variable" && counters.includes(String(k.variableId)) && Number(k.value) === hintAfter && [">=", "=="].includes(String(k.op)) && flatCmds(f.then).some((c) => c.kind === "text"); });
          if (!counters.length) { notes.push(t(`${at(map, ev)}: 틀린 횟수를 세는 명령(변수 +1)이 없다`, `${at(map, ev)}: nothing counts wrong tries (no variable += 1)`)); continue; }
          if (!hint) { notes.push(t(`${at(map, ev)}: 틀린 횟수가 ${hintAfter} 일 때 힌트 대사를 보이는 분기가 없다`, `${at(map, ev)}: no fork shows a hint line when the wrong-try count reaches ${hintAfter}`)); continue; }
        }
        return { pass: true, detail: t(`번호 자물쇠 ${code} — ${at(map, ev)}: 입력 → 정답 분기 → 열림${hintAfter ? ` · ${hintAfter}번째 오답 힌트` : ""}`, `number lock ${code} — ${at(map, ev)}: input → == ${code} → opens${hintAfter ? `, hint at wrong try ${hintAfter}` : ""}`), evidence: evEvidence(map, ev) };
      }
    }
  }
  return { pass: false, detail: notes.length ? notes.slice(0, 3).join(" / ") : t(`숫자를 입력받는(inputNumber) 이벤트가 없다 — 번호 ${code} 자물쇠가 아직 없다`, `no event asks for a number (inputNumber) — the ${code} lock does not exist yet`) };
}

/** 할 일 항목 하나 판정 — 항목의 refs 를 ctx 에 얹는다. */
export function runTodoItemCheck(project: Project, item: Pick<TodoItem, "check" | "refs">, ctx: TodoCheckContext = {}): CheckResult {
  if (!item.check) return { pass: true, detail: "검사 없음(판정자 확인 항목)", en: "no check (judged by a reviewer)" };
  const c = { ...ctx, refs: item.refs ?? ctx.refs };
  const ko = runTodoCheck(project, item.check, c);
  // 같은 판정의 영어 글(모델에게 간다). 판정이 갈리면(있을 수 없지만) 한국어 판정을 따른다.
  let en: string | undefined;
  setEnglish(true);
  try { en = runTodoCheck(project, item.check, c).detail; } catch { en = undefined; } finally { setEnglish(false); }
  return en ? { ...ko, en } : ko;
}

function checkPlace(project: Project, sc: Scope, name: string, kind?: TodoPlaceKind): CheckResult {
  const cands = Object.values(project.maps).filter((m) => mapInScope(sc, m)).map(mapNamed);
  const r = choose(name, cands, "장소", has(sc.refs?.mapIds), () => allMapNames(project));
  if (!r.ok) {
    const old = !has(sc.refs?.mapIds) && freshOnly(sc) ? resolveMaps(project, name) : undefined;
    return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "맵")}${old?.ok ? t(` — ${old.picked.map((p) => mapAt(p.t)).join(", ")} 는 전부터 있던 맵이다`, ` — ${old.picked.map((p) => mapAt(p.t)).join(", ")} existed before this turn`) : ""}` };
  }
  const maps = r.picked.map((p) => p.t);
  const real = maps.filter((m) => !isPlaceholderMap(m));
  if (!real.length) return { pass: false, detail: t(`${mapAt(maps[0]!)} 는 바닥 한 가지뿐인 빈 자리표시 맵이다 — 장소를 실제로 지어야 한다`, `${mapAt(maps[0]!)} is an empty placeholder map (one floor tile only) — actually build the place`), evidence: { mapId: maps[0]!.id } };
  for (const m of real) {
    const ks = mapKinds(m);
    // 세계 청사진이 장소 목록에 적은 맵은 그 종류로 지은 것이다 — 이름 낱말로 추정한 종류(「속삭임 숲」 = 들판)와 할 일의 종류(던전)가 달라도 지어진 장소다
    // (2026-11-10 Terra jrpg-w2: 버들항 세계의 deep-forest 를 지었는데 «looks like field — not a dungeon place» 로 끝내기가 거절됐다).
    const listed = (project.gameBlueprint?.places ?? []).some((pl) => pl.name.normalize("NFC").replace(/\s+/gu, "") === String(m.name ?? "").normalize("NFC").replace(/\s+/gu, ""));
    if (!kind || !ks.size || ks.has(kind) || listed || [...ks].some((k) => GROUP[k] === GROUP[kind])) {
      return { pass: true, detail: t(`장소 ${mapAt(m)} 가 있다(${m.width}×${m.height}, 이벤트 ${m.events?.length ?? 0}${kind ? `, 종류 ${ks.size ? [...ks].join("/") : "모름"} — 요청 ${kind}` : ""})`, `place ${mapAt(m)} exists (${m.width}x${m.height}, ${m.events?.length ?? 0} events${kind ? `, kind ${ks.size ? [...ks].join("/") : "unknown"} — requested ${kind}` : ""})`), evidence: { mapId: m.id } };
    }
  }
  const m = real[0]!;
  return { pass: false, detail: t(`${mapAt(m)} 는 ${[...mapKinds(m)].join("/")} 로 보인다 — ${kind} 장소가 아니다`, `${mapAt(m)} looks like ${[...mapKinds(m)].join("/")} — not a ${kind} place`), evidence: { mapId: m.id } };
}

/** 범위 안 이벤트 후보(맵 좁히기·거르기 포함). */
function eventCands(project: Project, sc: Scope, maps: readonly GameMap[], filter: (ev: GameEvent) => boolean = () => true): Named<EvRef>[] {
  const out: Named<EvRef>[] = [];
  for (const map of maps) for (const ev of map.events ?? []) if (filter(ev) && eventInScope(sc, map, ev)) out.push(evNamed(project, { map, ev }));
  return out;
}

function checkPerson(project: Project, sc: Scope, name: string, map?: string): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const r = choose(name, eventCands(project, sc, scope, isPersonEvent), "인물", eventBound(sc), () => eventNameList(scope, isPersonEvent));
  if (r.ok) { const h = r.picked[0]!.t; return { pass: true, detail: t(`인물 「${r.matched}」 = ${r.picked.map((p) => at(p.t.map, p.t.ev)).slice(0, 3).join(", ")}`, `person "${r.matched}" = ${r.picked.map((p) => at(p.t.map, p.t.ev)).slice(0, 3).join(", ")}`), evidence: evEvidence(h.map, h.ev) }; }
  if (r.result.detail.startsWith("모호함") || r.result.detail.startsWith("ambiguous")) return r.result;
  const faceless = choose(name, eventCands(project, sc, scope), "이벤트", eventBound(sc), () => []);
  if (faceless.ok) { const h = faceless.picked[0]!.t; return { pass: false, detail: t(`${at(h.map, h.ev)} 는 있지만 사람 그림(걷기 칩)이 없다`, `${at(h.map, h.ev)} exists but has no person sprite (walking charset)`), evidence: evEvidence(h.map, h.ev) }; }
  if (map) {
    const elsewhere = choose(name, eventCands(project, sc, Object.values(project.maps), isPersonEvent), "인물", eventBound(sc), () => []);
    if (elsewhere.ok) { const h = elsewhere.picked[0]!.t; return { pass: false, detail: t(`「${name}」 는 ${at(h.map, h.ev)} 에 있다 — 「${map}」 에는 없다`, `"${name}" is at ${at(h.map, h.ev)} — not on "${map}"`), evidence: evEvidence(h.map, h.ev) }; }
  }
  return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
}

/**
 * Literal lines a TypeScript event script shows (`game.showMessage("…")`, quotes or template text) — a script is a
 * real dialogue command (openwiki/script-sandbox.md). 2026-10-31 live run: a merchant written as one script kept
 * failing «has no live dialogue command», and the model added a plain text line in front just to pass.
 */
function scriptMessageLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /game\.showMessage\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/gu;
  for (const m of source.matchAll(re)) if (m[2]?.trim()) out.push(m[2]);
  return out;
}

function checkTalk(project: Project, sc: Scope, who: string, says?: string): CheckResult {
  const maps = Object.values(project.maps);
  const r = choose(who, eventCands(project, sc, maps), "말하는 인물", eventBound(sc), () => eventNameList(maps));
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
  // 고른 인물(같은 이름 무리)의 살아 있는 페이지 대사.
  const lines: { map: GameMap; ev: GameEvent; body: string }[] = [];
  const dead: { map: GameMap; ev: GameEvent; why: string }[] = [];
  for (const { t: { map, ev } } of r.picked) {
    const live = liveCmds(project, ev);
    for (const c of live.cmds) {
      if (c.kind === "text") lines.push({ map, ev, body: String(c.body ?? "") });
      else if (c.kind === "script") for (const body of scriptMessageLiterals(String(c.source ?? ""))) lines.push({ map, ev, body });
    }
    for (const d of live.dead) if (d.cmds.some((c) => c.kind === "text" || c.kind === "script")) dead.push({ map, ev, why: d.why });
  }
  const ids = r.picked.map((p) => p.id).slice(0, 4).join(", ");
  const first = r.picked[0]!.t;
  if (!lines.length) return { pass: false, detail: t(`「${r.matched}」(${ids}) 에 도는 대사 명령이 없다`, `"${r.matched}" (${ids}) has no live dialogue command`) + deadNote(dead), evidence: evEvidence(first.map, first.ev) };
  // refs 로 묶인 이벤트 하나는 이름이 안 맞아도 골라진다 — 그때는 그 이벤트 대사에 「who」 가 말하는 줄(speaker 또는 「who: …」 머리)이 있어야 한다.
  // 2026-10-30 omo-loop-1030 terra boss-room r3: 이름이 id 뿐인 컷신 하나에 묶여 「해골 기사」 대사로 통과했다.
  if (!r.picked.some((p) => scoreNamed(who, p).s > 0)) {
    const w = normName(who, true);
    const speaking = lines.filter((l) => normName(l.body, true).startsWith(w));
    if (!speaking.length) return { pass: false, detail: t(`묶인 이벤트 ${ids} 에 「${who}」 가 말하는 줄이 없다(이름·speaker·「${who}: …」 머리 없음) — 대사의 speaker 를 「${who}」로 쓰거나 그 인물 이벤트에 묶는다(todo bind)`, `bound event ${ids} has no line spoken by "${who}" (no name, speaker, or "${who}: …" prefix) — set the line's speaker to "${who}" or bind that person's event (todo bind)`), evidence: evEvidence(first.map, first.ev) };
    lines.splice(0, lines.length, ...speaking);
  }
  if (says) {
    const want = normName(says, true);
    const hit = lines.find((l) => normName(l.body, true).includes(want));
    if (!hit) return { pass: false, detail: t(`「${r.matched}」(${ids}) 대사 ${lines.length}줄에 「${says}」 가 없다 — 예: 「${lines[0]!.body.slice(0, 40)}」`, `"${r.matched}" (${ids}): none of ${lines.length} lines contains "${says}" — e.g. "${lines[0]!.body.slice(0, 40)}"`), evidence: evEvidence(lines[0]!.map, lines[0]!.ev) };
    return { pass: true, detail: `${at(hit.map, hit.ev)}: ${q(hit.body.slice(0, 50))}`, evidence: evEvidence(hit.map, hit.ev) };
  }
  const l = lines[0]!;
  return { pass: true, detail: t(`「${r.matched}」 ${at(l.map, l.ev)} 대사 ${lines.length}줄: 「${l.body.slice(0, 40)}」`, `"${r.matched}" ${at(l.map, l.ev)} ${lines.length} lines: "${l.body.slice(0, 40)}"`), evidence: evEvidence(l.map, l.ev) };
}

function checkBattle(project: Project, sc: Scope, who?: string, map?: string, boss?: boolean): CheckResult {
  const scope = scopeMaps(project, map);
  if (isResult(scope)) return scope;
  const scan = scanLive(project, scope, (c) => c.kind === "battleProcessing");
  const inScope = scan.hits.filter((h) => eventInScope(sc, h.map, h.ev, h.c.troopId));
  const troopName = (c: Cmd) => troopOf(project, c.troopId)?.name ?? String(c.troopId);
  if (!inScope.length) return { pass: false, detail: t(`${map ? `「${map}」 에` : "어느 맵에도"} 도는 전투 명령(battleProcessing)이 있는 이벤트가 없다`, `no event ${map ? `on "${map}"` : "on any map"} has a live battle command (battleProcessing)`) + scopeNote(sc, "이벤트") + deadNote(scan.dead) };
  type B = (typeof inScope)[number];
  const named = inScope.map((b): Named<B> => ({ t: b, id: `${b.ev.id}/${String(b.c.troopId)}`, label: `${evLabel(b.ev)}(${troopName(b.c)})`, primary: [String(b.ev.name ?? ""), b.ev.id, ...troopNames(project, b.c.troopId)].filter(Boolean), secondary: eventNameTiers(project, b.ev).secondary }));
  let cands = named;
  let matched = "";
  if (who) {
    const r = choose(who, named, "전투 상대", eventBound(sc) || has(sc.refs?.troopIds), () => named.map((n) => n.label));
    if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
    cands = r.picked; matched = r.matched;
  }
  const desc = (b: B) => t(`${at(b.map, b.ev)} 적 그룹 「${troopName(b.c)}」 [${String(b.c.troopId)}]${b.c.canEscape === false ? " 도망 불가" : ""}`, `${at(b.map, b.ev)} troop "${troopName(b.c)}" [${String(b.c.troopId)}]${b.c.canEscape === false ? " no escape" : ""}`);
  if (boss) {
    const hit = cands.find((b) => isBossBattle(project, b.t.ev, b.t.c));
    if (!hit) { const b = cands[0]!.t; return { pass: false, detail: t(`${desc(b)} 는 보스전으로 안 보인다(이름·그룹에 보스 낱말 없음, 도망 가능) — 보스면 canEscape:false·보스 그룹으로`, `${desc(b)} does not look like a boss battle (no boss word in the name or troop, escape allowed) — for a boss use canEscape:false and a boss troop`), evidence: evEvidence(b.map, b.ev) }; }
    return { pass: true, detail: `${t("보스전", "boss battle")}${matched ? ` ${q(matched)}` : ""} ${desc(hit.t)}`, evidence: evEvidence(hit.t.map, hit.t.ev) };
  }
  const b = cands[0]!.t;
  return { pass: true, detail: `${t("전투", "battle")}${matched ? ` ${q(matched)}` : ""} ${desc(b)}`, evidence: evEvidence(b.map, b.ev) };
}

function checkLink(project: Project, sc: Scope, from: string, to: string): CheckResult {
  const tr = t;
  const f = resolveMaps(project, from, "출발 맵"), dst = resolveMaps(project, to, "도착 맵");
  if (!f.ok) return f.result;
  if (!dst.ok) return dst.result;
  const toIds = new Set(dst.picked.map((p) => p.id));
  const problems: string[] = [];
  for (const { t: fm } of f.picked) {
    const all = transfersOut(fm).filter((x) => toIds.has(x.to.mapId));
    // 판정 대상 이동 이벤트: refs 의 이벤트, 아니면 fresh 면 이번 턴에 바뀐 이벤트이거나 이번 턴에 생긴 도착 맵으로 가는 것.
    const links = all.filter((x) => has(sc.refs?.eventIds) ? refEvent(sc, fm, x.ev)
      : has(sc.refs?.mapIds) ? sc.refs!.mapIds!.includes(x.to.mapId) || sc.refs!.mapIds!.includes(fm.id)
      : freshOnly(sc) ? sc.changed!.eventKeys.has(evKey(fm, x.ev)) || sc.changed!.mapIds.has(x.to.mapId) : true);
    if (!links.length) { problems.push(tr(`${mapAt(fm)} 에 ${dst.picked.map((p) => mapAt(p.t)).join("/")} 로 가는 ${all.length ? "이번 턴의 " : ""}이동 이벤트가 없다`, `${mapAt(fm)} has no ${all.length ? "new (this turn) " : ""}transfer event to ${dst.picked.map((p) => mapAt(p.t)).join("/")}`) + (all.length ? scopeNote(sc, "이벤트") : "")); continue; }
    const reach = mapReach(project, fm);
    for (const x of links) {
      const target = project.maps[x.to.mapId]!;
      const landOk = x.to.x >= 0 && x.to.y >= 0 && x.to.x < target.width && x.to.y < target.height && isPassable(project, target, x.to.x, x.to.y);
      const fromOk = eventReached(fm, reach, x.ev);
      if (fromOk && landOk) return { pass: true, detail: tr(`${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}) 걸어 닿고 도착 칸도 걸을 수 있다`, `${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}) is reachable on foot and the arrival cell is walkable`), evidence: evEvidence(fm, x.ev) };
      problems.push(`${at(fm, x.ev)} → ${mapAt(target)}(${x.to.x},${x.to.y}): ${!reach ? tr("이 맵에 들어오는 칸·시작점이 없어 걸어 볼 수 없다", "this map has no entry cell or start point to walk from") : !fromOk ? tr("들어오는 칸에서 걸어 닿지 못한다", "not reachable on foot from the entry cells") : tr("도착 칸이 벽·물건이다", "the arrival cell is a wall or object")}`);
    }
  }
  return { pass: false, detail: problems.slice(0, 3).join(" / ") };
}

const ENDING_KINDS = new Set(["triggerEnding", "ending", "returnToTitle"]);

function checkEnding(project: Project, sc: Scope, ctx: TodoCheckContext, onMap?: string): CheckResult {
  const scope = scopeMaps(project, onMap);
  if (isResult(scope)) return scope;
  const unsetEndings = new Set(endingConditionsUnset(project).map((b) => b.evidence.split(":")[0]!));
  const scan = scanLive(project, scope, (c) => ENDING_KINDS.has(c.kind));
  const sites: { map: GameMap; ev: GameEvent; kind: string; why?: string }[] = [];
  const seen = new Set<GameEvent>();
  for (const h of scan.hits) {
    if (seen.has(h.ev)) continue;
    seen.add(h.ev);
    const why = h.c.kind === "triggerEnding" && typeof h.c.endingId === "string" && unsetEndings.has(h.c.endingId) ? t(`엔딩 ${h.c.endingId} 의 조건 스위치·변수를 켜는 곳이 없다`, `nothing sets the condition switch/variable of ending ${h.c.endingId}`) : undefined;
    sites.push({ map: h.map, ev: h.ev, kind: h.c.kind, why });
  }
  for (const d of scan.dead) if (!seen.has(d.ev)) sites.push({ map: d.map, ev: d.ev, kind: "triggerEnding", why: d.why });
  const mine = sites.filter((s) => eventInScope(sc, s.map, s.ev));
  if (!mine.length) {
    const others = sites.length ? t(` — 엔딩은 ${sites.slice(0, 3).map((s) => at(s.map, s.ev)).join(", ")} 에 있다${mine.length !== sites.length && (freshOnly(sc) || eventBound(sc)) ? "(원래 있던·묶이지 않은 엔딩이라 이 항목을 통과시키지 않는다)" : ""}`, ` — endings exist at ${sites.slice(0, 3).map((s) => at(s.map, s.ev)).join(", ")}${mine.length !== sites.length && (freshOnly(sc) || eventBound(sc)) ? " (pre-existing or unbound endings do not pass this item)" : ""}`) : "";
    const elsewhere = onMap && !sites.length ? Object.values(project.maps).filter((m) => !scope.includes(m)).flatMap((m) => (m.events ?? []).filter((ev) => deepCmds(project, ev).some((c) => ENDING_KINDS.has(c.kind))).map((ev) => at(m, ev))) : [];
    return { pass: false, detail: t(`${onMap ? `「${onMap}」 에 ` : ""}${freshOnly(sc) && !eventBound(sc) ? "이번 턴에 만든 " : ""}엔딩을 부르는 이벤트(triggerEnding·ending·returnToTitle)가 없다`, `no ${freshOnly(sc) && !eventBound(sc) ? "new (this turn) " : ""}event ${onMap ? `on "${onMap}" ` : ""}calls an ending (triggerEnding/ending/returnToTitle)`) + others + (elsewhere.length ? t(` — 엔딩은 ${elsewhere.slice(0, 3).join(", ")} 에 있다`, ` — endings exist at ${elsewhere.slice(0, 3).join(", ")}`) : "") };
  }
  const world = walkWorld(project, startOf(project, ctx));
  const notes: string[] = [];
  for (const s of mine) {
    if (s.why) { notes.push(`${at(s.map, s.ev)}: ${s.why}`); continue; }
    if (!world.maps.has(s.map.id)) { notes.push(`${at(s.map, s.ev)}: ${t(`시작 맵에서 ${mapAt(s.map)} 로 가는 길이 없다`, `no way from the start map to ${mapAt(s.map)}`)}`); continue; }
    if (!eventReached(s.map, world.reach.get(s.map.id), s.ev)) { notes.push(`${at(s.map, s.ev)}: ${t("그 맵 안에서 걸어 닿지 못한다", "not reachable on foot inside that map")}`); continue; }
    return { pass: true, detail: t(`엔딩 ${s.kind} — ${at(s.map, s.ev)}, 시작에서 걸어 닿는다`, `ending ${s.kind} — ${at(s.map, s.ev)}, reachable on foot from the start`), evidence: evEvidence(s.map, s.ev) };
  }
  const s = mine[0]!;
  return { pass: false, detail: t(`엔딩 명령에 닿지 못한다 — ${notes.slice(0, 3).join(" / ")}`, `the ending command cannot be reached — ${notes.slice(0, 3).join(" / ")}`), evidence: evEvidence(s.map, s.ev) };
}

const itemNamed = (it: Obj): Named<Obj> => ({ t: it, id: String(it.id), label: String(it.name ?? it.id), primary: [String(it.name ?? ""), String(it.id ?? "")].filter(Boolean) });
const allItemNames = (project: Project) => (project.database.items as unknown as Obj[]).map((i) => String(i.name ?? ""));

function checkItem(project: Project, sc: Scope, name: string, gives?: boolean): CheckResult {
  const cands = (project.database.items as unknown as Obj[]).filter((i) => itemInScope(sc, String(i.id))).map(itemNamed);
  const r = choose(name, cands, "아이템", has(sc.refs?.itemIds), () => allItemNames(project));
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "아이템")}` };
  const ids = new Set(r.picked.map((p) => p.id));
  const label = `${q(r.matched)} [${[...ids].join(", ")}]`;
  if (!gives) return { pass: true, detail: t(`아이템 ${label} 이 DB 에 있다`, `item ${label} exists in the database`) };
  const giving = (c: Cmd) => {
    if (c.kind !== "changeItem" || !ids.has(String(c.itemId))) return false;
    const amt = c.amount as unknown;
    const n = typeof amt === "number" ? amt : typeof (amt as Obj | undefined)?.value === "number" ? Number((amt as Obj).value) : 1;
    return (c.op === "+=" || c.op === "=") && n > 0;
  };
  const scan = scanLive(project, Object.values(project.maps), giving);
  const h = scan.hits[0];
  if (h) return { pass: true, detail: t(`${label} 지급 — ${at(h.map, h.ev)}`, `${label} is given — ${at(h.map, h.ev)}`), evidence: evEvidence(h.map, h.ev) };
  return { pass: false, detail: t(`아이템 ${label} 은 있지만 주는 명령(changeItem +=)이 도는 이벤트에 없다`, `item ${label} exists but no live event gives it (changeItem +=)`) + deadNote(scan.dead) };
}

function checkPresent(project: Project, sc: Scope, item: string, to?: string): CheckResult {
  // 증거 아이템은 묶인 아이템이 있으면 그 안에서, 아니면 전부에서(원래 있던 증거를 새 심문에 써도 된다).
  const itemCands = (project.database.items as unknown as Obj[]).filter((i) => !has(sc.refs?.itemIds) || sc.refs!.itemIds!.includes(String(i.id))).map(itemNamed);
  const ri = choose(item, itemCands, "증거 아이템", has(sc.refs?.itemIds), () => allItemNames(project));
  if (!ri.ok) return ri.result;
  const ids = new Set(ri.picked.map((p) => p.id));
  const label = `${q(ri.matched)} [${[...ids].join(", ")}]`;
  if (![...ids].some((id) => liveFacts(project).given.has(id))) return { pass: false, detail: t(`증거 ${label} 을 주는 곳(아이템 넣기·상점·드롭)이 없다 — 플레이어가 가질 수 없다`, `nothing gives evidence ${label} (give item, shop, drop) — the player cannot have it`) };
  const takes = (c: Cmd) => c.kind === "presentItem" && ((c.options as Obj[] | undefined) ?? []).some((o) => ids.has(String(o.itemId)));
  const maps = Object.values(project.maps);
  const scan = scanLive(project, maps, takes);
  const all = [...new Map(scan.hits.map((h) => [h.ev, { map: h.map, ev: h.ev }])).values()];
  const sites = all.filter((s) => eventInScope(sc, s.map, s.ev));
  if (!sites.length) {
    if (all.length) return { pass: false, detail: t(`${label} 을 받는 증거 내밀기는 ${all.map((s) => at(s.map, s.ev)).slice(0, 3).join(", ")} 에 있지만 이 항목의 대상이 아니다`, `evidence presentation accepting ${label} exists at ${all.map((s) => at(s.map, s.ev)).slice(0, 3).join(", ")} but is not this item's target`) + scopeNote(sc, "이벤트") };
    const anyPresent = scanLive(project, maps, (c) => c.kind === "presentItem").hits.length;
    return { pass: false, detail: scan.dead.length ? t(`${label} 을 받는 증거 내밀기가 있지만`, `evidence presentation accepting ${label} exists, but`) + deadNote(scan.dead) : anyPresent ? t(`증거 내밀기(presentItem)는 ${anyPresent}곳 있지만 ${label} 을 맞는 증거로 받는 갈래가 없다`, `there are ${anyPresent} evidence presentations (presentItem) but none accepts ${label} as the right evidence`) : t(`증거 내밀기(presentItem) 명령이 어디에도 없다 — ${label} 을 내밀 수단이 없다`, `there is no presentItem command anywhere — no way to present ${label}`) };
  }
  if (to) {
    const r = choose(to, sites.map((s) => evNamed(project, s)), "증거를 받을 인물", false, () => sites.map((s) => evLabel(s.ev)));
    if (!r.ok) return { pass: false, detail: t(`${label} 을 받는 곳은 ${sites.map((s) => at(s.map, s.ev)).join(", ")} — ${r.result.detail}`, `${label} is accepted at ${sites.map((s) => at(s.map, s.ev)).join(", ")} — ${r.result.detail}`) };
    const hit = r.picked[0]!.t;
    return { pass: true, detail: t(`${label} 을 ${at(hit.map, hit.ev)} 에게 내밀 수 있다`, `${label} can be presented to ${at(hit.map, hit.ev)}`), evidence: evEvidence(hit.map, hit.ev) };
  }
  const s = sites[0]!;
  return { pass: true, detail: t(`${label} 을 ${at(s.map, s.ev)} 에서 내밀 수 있다`, `${label} can be presented at ${at(s.map, s.ev)}`), evidence: evEvidence(s.map, s.ev) };
}

function checkObjective(project: Project, sc: Scope, text?: string): CheckResult {
  const found: { map: GameMap | undefined; ev: GameEvent | undefined; message: string }[] = [];
  for (const h of scanLive(project, Object.values(project.maps), (c) => isObjectiveCommand(c as never)).hits) {
    if (eventInScope(sc, h.map, h.ev)) found.push({ map: h.map, ev: h.ev, message: String((h.c.fields as Obj).message) });
  }
  if (!freshOnly(sc) && !eventBound(sc)) for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (c) => { if (isObjectiveCommand(c as never)) found.push({ map: undefined, ev: undefined, message: String((c.fields as Obj).message) }); });
  if (!found.length) return { pass: false, detail: t("목표 줄 설정 명령이 없다", "there is no command that sets the objective line") + scopeNote(sc, "이벤트") };
  const pick = text ? found.find((f) => normName(f.message, true).includes(normName(text, true))) : found[0];
  if (!pick) return { pass: false, detail: t(`목표 줄 ${found.length}개에 「${text}」 가 없다 — 있는 것: `, `none of ${found.length} objective lines contains "${text}" — existing: `) + [...new Set(found.map((f) => q(f.message.slice(0, 30))))].slice(0, 4).join(", ") };
  return { pass: true, detail: `${t("목표 줄", "objective line")} ${q(pick.message.slice(0, 50))}${pick.map && pick.ev ? ` — ${at(pick.map, pick.ev)}` : t(" — 공통 이벤트", " — common event")}`, ...(pick.map && pick.ev ? { evidence: evEvidence(pick.map, pick.ev) } : {}) };
}

function checkReachable(project: Project, sc: Scope, target: string, from: string | undefined, ctx: TodoCheckContext): CheckResult {
  let startId = startOf(project, ctx);
  if (from) {
    const f = resolveMaps(project, from, "출발 맵");
    if (!f.ok) return f.result;
    startId = f.picked[0]!.id;
  }
  // 목표 후보: 범위 안 이벤트와 맵을 함께 놓고 이름으로 고른다.
  type T = { kind: "ev"; ref: EvRef } | { kind: "map"; map: GameMap };
  const cands: Named<T>[] = [
    ...eventCands(project, sc, Object.values(project.maps)).map((n): Named<T> => ({ ...n, t: { kind: "ev", ref: n.t } })),
    ...Object.values(project.maps).filter((m) => mapInScope(sc, m) && (!has(sc.refs?.eventIds) || has(sc.refs?.mapIds))).map((m): Named<T> => ({ ...mapNamed(m), t: { kind: "map", map: m } })),
  ];
  const r = choose(target, cands, "목표", eventBound(sc) || has(sc.refs?.mapIds), () => [...allMapNames(project), ...eventNameList(Object.values(project.maps))]);
  if (!r.ok) return { pass: false, detail: `${r.result.detail}${scopeNote(sc, "이벤트")}` };
  const world = walkWorld(project, startId);
  const startLabel = mapAt(project.maps[startId]!);
  for (const p of r.picked) {
    if (p.t.kind === "ev") {
      const { map, ev } = p.t.ref;
      if (world.maps.has(map.id) && eventReached(map, world.reach.get(map.id), ev)) return { pass: true, detail: t(`${at(map, ev)} 에 ${startLabel} 에서 걸어 닿는다`, `${at(map, ev)} is reachable on foot from ${startLabel}`) + (world.via.get(map.id) ? `(${world.via.get(map.id)})` : ""), evidence: evEvidence(map, ev) };
    } else if (world.maps.has(p.t.map.id)) {
      return { pass: true, detail: t(`${mapAt(p.t.map)} 에 ${startLabel} 에서 걸어 닿는다`, `${mapAt(p.t.map)} is reachable on foot from ${startLabel}`) + (world.via.get(p.t.map.id) ? `(${world.via.get(p.t.map.id)})` : ""), evidence: { mapId: p.t.map.id } };
    }
  }
  const p = r.picked[0]!.t;
  if (p.kind === "ev") {
    const { map, ev } = p.ref;
    return { pass: false, detail: t(`${at(map, ev)} 에 ${startLabel} 에서 걸어 닿지 못한다 — ${world.maps.has(map.id) ? "그 맵 안에서 막힌다(벽·물건·안 열리는 문)" : "그 맵으로 가는 이동 이벤트에 닿지 못한다"}`, `${at(map, ev)} is not reachable on foot from ${startLabel} — ${world.maps.has(map.id) ? "blocked inside that map (wall, object, or a door that does not open)" : "no reachable transfer event leads to that map"}`), evidence: evEvidence(map, ev) };
  }
  return { pass: false, detail: t(`${mapAt(p.map)} 에 ${startLabel} 에서 가는 길이 없다(닿는 맵: `, `no way from ${startLabel} to ${mapAt(p.map)} (reachable maps: `) + `${[...world.maps].map((id) => mapLabel(project.maps[id]!)).join(", ")})`, evidence: { mapId: p.map.id } };
}

/** 동료 합류: 파티에 넣는 명령(changeParty add)이 살아 있는 이벤트 페이지에 있고, 그 배우 이름이나 그 이벤트 이름이 name 에 맞고, 시작에서 그 이벤트에 걸어 닿는다. */
function checkPartyJoin(project: Project, sc: Scope, ctx: TodoCheckContext, name: string, onMap?: string): CheckResult {
  const actors = (project.database.actors ?? []) as unknown as Obj[];
  const actorName = (id: unknown) => String(actors.find((a) => String(a.id) === String(id))?.name ?? id ?? "");
  const scope = scopeMaps(project, onMap);
  if (isResult(scope)) return scope;
  const scan = scanLive(project, scope, (c) => c.kind === "changeParty" && c.action === "add");
  const live = scan.hits.filter((h) => eventInScope(sc, h.map, h.ev));
  const mine = eventBound(sc) ? live : live.filter((h) => nameScore(name, actorName(h.c.actorId)) > 0 || eventNameTiers(project, h.ev).primary.some((n) => nameScore(name, n) > 0) || nameScore(name, String(h.ev.name ?? "")) > 0);
  if (!mine.length) {
    const seen = live.length ? t(` — 합류 명령은 있지만 다른 동료다: `, ` — there are join commands, but for other companions: `) + live.slice(0, 3).map((h) => `${q(actorName(h.c.actorId))} ${at(h.map, h.ev)}`).join(", ") : scan.hits.length ? t(` — 합류 명령은 ${scan.hits.slice(0, 2).map((h) => at(h.map, h.ev)).join(", ")} 에 있다(이번 턴 것이 아니다)`, ` — join commands exist at ${scan.hits.slice(0, 2).map((h) => at(h.map, h.ev)).join(", ")} (not from this turn)`) : "";
    return { pass: false, detail: t(`「${name}」 을 파티에 넣는 명령(changeParty add)이 ${onMap ? `「${onMap}」 의 ` : ""}${freshOnly(sc) && !eventBound(sc) ? "이번 턴에 만든 " : ""}도는 이벤트에 없다`, `no live ${freshOnly(sc) && !eventBound(sc) ? "new (this turn) " : ""}event ${onMap ? `on "${onMap}" ` : ""}adds "${name}" to the party (changeParty add)`) + seen + deadNote(scan.dead) + t(" — 동료는 DB 배우(upsert_actor)로 두고 그 인물 대화 끝에 changeParty add", " — make the companion a database actor (upsert_actor) and put changeParty add at the end of their talk") };
  }
  const world = walkWorld(project, startOf(project, ctx));
  for (const h of mine) {
    if (world.maps.has(h.map.id) && eventReached(h.map, world.reach.get(h.map.id), h.ev)) return { pass: true, detail: t(`동료 「${actorName(h.c.actorId)}」 합류 — ${at(h.map, h.ev)}, 시작에서 걸어 닿는다`, `companion "${actorName(h.c.actorId)}" joins — ${at(h.map, h.ev)}, reachable on foot from the start`), evidence: evEvidence(h.map, h.ev) };
  }
  const h = mine[0]!;
  return { pass: false, detail: t(`${at(h.map, h.ev)} 에 합류 명령은 있지만 시작에서 걸어 닿지 못한다`, `${at(h.map, h.ev)} has a join command but is not reachable on foot from the start`), evidence: evEvidence(h.map, h.ev) };
}
