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
import type { Command, GameEvent, Project } from "@/project/types";
import { withJosa } from "@/util/josa";
import { eventGives } from "./blueprint";
import { showExaminedThing } from "./examineArt";
import { settleExamineSpot } from "./examineSpot";
import { unreachableEvents } from "../judge/eventReach";
import { isPassable } from "@/project/collision";
import { buildPeople } from "../place/people";
import type { BuildRun } from "../shared/types";
import { TALK_STEP, ROLE_NAME, Suspect, POOL, LOOKS, Obj, textOf, hash, nameOf, visiblePerson, walkCommands, isMysteryBlueprint, modelBuiltCase, Resolved, resolveSteps, isProgressWord, jo, KEY_ITEM, say, CLEAR_FACE, narrate, ACCUSE_PROMPT } from "./mysteryCaseRead";
import { alignCulpritLines, renameItemEverywhere, alignEvidenceToText, polishCaseNames, suspectNames, requireInterrogation } from "./mysteryCaseLines";
import { dropDanglingEvidenceHints, evidenceOnThing } from "./mysteryEvidencePlaces";
import { explainRemainingClues } from "./mysteryClues";
import { deepenCase, nameLeakedEventIds, ensureEvidenceGiven, repairPageNameLabels, closeEndingShortcuts } from "./mysteryCaseRepair";

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
function evidenceName(gives: string): string {
  const inner = /«([^«»]+)»/u.exec(gives)?.[1] ?? /\(([^()]+)\)/u.exec(gives)?.[1];
  const base = (inner ?? gives).replace(/^(아이템|스위치)\s*[:：]\s*/u, "").replace(/\s*(아이템|스위치|확인|발견|획득|입수)$/u, "").trim();
  // 진행 낱말(「수사 시작」「모든 단서」)은 물건이 아니다 — 증거 이름으로 쓰면 「『수사 시작』… 내 것이 맞소」가 됐다(vm5 argon 추리).
  // 범인이 「내 것이 맞소」라고 할 수 있는 작은 물건 하나를 gives 글로 골라 쓴다(되풀이해도 같은 이름).
  if (isProgressWord(base)) return PHYSICAL_CLUES[hash(gives) % PHYSICAL_CLUES.length]!;
  return base;
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

/**
 * 마지막 단계 글이 가게·여관 주인을 범인으로 부르는데(「여관 주인의 고백」「여관 주인에게 진실을 묻는다」) 맵에 「주인」이 서 있지 않으면 그 주인을 범인으로 세운다.
 * 주인이 서 있으면 의뢰인이라 범인으로 쓰지 않는다(ROLE 머리말).
 * 왜(2026-10-31 meb2 terra 추리): 단서(우산 실·장부)는 여관 주인을 가리키는데 주인이 ROLE 에 없어 풀에서 「하녀 로자」를 범인으로 세웠고,
 * 고르기에는 주인이 없는데 엔딩은 주인이 고백했다 — 판정 major 「범인 논리가 모순」.
 */
function ownerSuspect(project: Project, texts: readonly string[], taken: ReadonlySet<string>, seed: number): Suspect | undefined {
  const m = texts.map((t) => /((?:여관|주점|객잔|가게|상점|저택|하숙집|찻집|빵집)\s*)?주인(?![공장])/u.exec(t)).find(Boolean);
  if (!m) return undefined;
  const ownerStanding = Object.values(project.maps).some((map) => (map.events ?? []).some((e) => nameOf(e).includes("주인") && visiblePerson(e)));
  if (ownerStanding) return undefined;
  const role = `${m[1]?.trim() ?? ""} 주인`.trim();
  const given = ["한나", "오언", "마르타", "베른"].filter((g) => !taken.has(`${role} ${g}`));
  if (!given.length) return undefined;
  return { role, name: `${role} ${given[seed % given.length]}`, looks: "man", place: "카운터 뒤" };
}

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
  const fromText = (standing ? namedAny : undefined) ?? pickCulprit(run.ctx.project, culpritTexts, taken);
  const culprit = fromText ?? ownerSuspect(run.ctx.project, culpritTexts, taken, seed) ?? POOL.filter((p) => !taken.has(p.name))[seed % POOL.length]!;
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
  if (!run.call("upsert_item", { item: { id, name, description: `${src.map.name ?? src.step.place}의 「${String((src.ev as { name?: string }).name ?? "").trim() || src.step.event}」에서 얻은 증거.`, price: 0, consumable: false } }).ok) return undefined;
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
