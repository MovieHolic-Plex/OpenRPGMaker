// 추리 사건의 대사 — 범인·증거 이름을 대사와 맞추고(alignCulpritLines·alignEvidenceToText·polishCaseNames), 용의자를 다 들어야 지목하게 한다(requireInterrogation).
import type { Command, GameEvent, Project } from "@/project/types";
import { withWhere } from "../judge/objectiveWhere";
import type { BuildRun } from "../shared/types";
import { Obj, hash, nameOf, visiblePerson, walkCommands, isProgressWord, jo, KEY_ITEM, ACCUSE_PROMPT } from "./mysteryCaseRead";

const ROLE_WORDS = ["투숙객", "손님", "하녀", "하인", "요리사", "악사", "마부", "상인", "여행자", "점원", "집사", "정원사", "경비", "하숙생", "직원", "노파", "청년", "사내", "여인"];

const WITNESS_MARK = "저는 아니에요! 어젯밤";

/**
 * 사건을 다시 세워 범인이 바뀌면 모델이 쓴 옛 범인 지칭을 새 범인으로 맞춘다 — 되풀이 안전.
 *  1) 「저 투숙객이 범인이었어요」「범인은 마부 한스」「한스가 훔쳤다」처럼 범인이 아닌 용의자 이름·역할 낱말(새 범인 이름에 없는 것)을 범인으로 부르는 줄 → 새 범인 이름.
 *     부정(「…는 범인이 아니다」)·「범인을 잡아 주세요」처럼 누구를 지칭하지 않는 줄은 건드리지 않는다.
 *  2) 범인이 아닌 사람이 자백하는 장면(「죄송합니다… 돌려드리겠습니다」, 범인 아닌 사람 이벤트의 페이지) → 그 사람이 새 범인을 본 목격 증언으로 다시 쓴다(스위치·아이템 명령은 그대로).
 * 왜(2026-10-29 vm3 argon 추리): 범인 고르기를 다시 세워 범인이 악사 리노가 됐는데, 모델의 투숙객 자백 장면과 지목 성공 대사 「저 투숙객이 범인이었어요」가 남았다.
 */
export function alignCulpritLines(run: BuildRun): string[] {
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
export function renameItemEverywhere(run: BuildRun, item: Project["database"]["items"][number], name: string): void {
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
export function alignEvidenceToText(run: BuildRun): string[] {
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
export function polishCaseNames(run: BuildRun): string[] {
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
export function suspectNames(project: Project): string[] {
  const names: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (c.kind === "choices" && c.prompt === ACCUSE_PROMPT && !names.length) for (const o of (c.options ?? []) as Obj[]) { const t = String(o.text ?? ""); if (t && !/모르겠/u.test(t)) names.push(t); }
  });
  return names;
}

/** 지목 고르기에 나오는 용의자(사람 NPC)와 「이야기 들음」 스위치. */
export function suspectsHeard(project: Project): { name: string; mapId: string; ev: GameEvent; switchId: string }[] {
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
export function unheardLines(project: Project): Command[] {
  return suspectsHeard(project).filter((s) => (project.switches ?? []).some((w) => (w as { id?: string }).id === s.switchId))
    .map((s) => ({ kind: "fork", condition: { kind: "switch", switchId: s.switchId, value: false }, then: [{ kind: "text", body: `· 아직 「${s.name}」의 이야기를 듣지 못했다.` }] }) as unknown as Command);
}

/**
 * 용의자 심문 필수: 용의자마다 한 번은 말을 걸어(그 사람 대사가 나오는 페이지) 「이야기 들음」을 켜야 지목 고르기가 열린다.
 * 지목 페이지 앞에 같은 조건의 「탐문 남음」 페이지를 두어, 아직 못 들은 용의자 이름을 말한다(남은 단서 안내에도 같은 줄).
 * 왜(2026-10-29 vm4 flash 추리 판정): 「리노와 한스는 말을 걸지 않아도 엔딩이 나왔다. 용의자 심문이 필수가 아니다」.
 */
export function requireInterrogation(run: BuildRun): string[] {
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
