// 추리 사건 고치기 — 일직선 사건 깊게(deepenCase), 새어 나온 이벤트 id 이름으로, 증거를 꼭 주게, 쪽 이름표, 엔딩 지름길 막기.
import type { Command, GameEvent, Project } from "@/project/types";
import { mapRegion } from "../judge/objectiveWhere";
import { shownToken } from "./codeClues";
import type { BuildRun } from "../shared/types";
import { Obj, textOf, nameOf, visiblePerson, walkCommands, resolveSteps, jo, ACCUSE_PROMPT } from "./mysteryCaseRead";
import { hostThing } from "./mysteryClues";

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
export function deepenCase(run: BuildRun): string[] {
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
export function nameLeakedEventIds(run: BuildRun): string[] {
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
export function ensureEvidenceGiven(run: BuildRun): string[] {
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
export function repairPageNameLabels(run: BuildRun): string[] {
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
export function closeEndingShortcuts(run: BuildRun): string[] {
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
