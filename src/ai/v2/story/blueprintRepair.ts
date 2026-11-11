// 청사진 단계 조건 고치기(끝맺음) — 조건이 빈 단계 페이지 채우기(fillUnsetStepConditions), 문을 여는 단계 잠그기(gateOpenSteps). 걷기·검사는 blueprint.ts.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { Obj, obj, findMap, findEvent, pagesOf, settersOf, eventSetter, pageNeeds, hasCommands, walkBlueprint } from "./blueprint";

/**
 * 어디서도 안 켜지는 단계 조건을 앞 단계 이벤트가 켜게 한다(결정적, 출하 전 끝맺음).
 * 왜(2026-10-29 vm3 argon mystery): 「열린 창문」 페이지가 「사건 조사 시작」 스위치를 조건으로 걸었는데 아무도 켜지 않았다 —
 * 앞 단계 여관 주인(뒤 단계 지목도 같은 사람)의 첫 페이지는 목표 대사만 있어 지목 페이지까지 영영 못 갔다.
 * 앞 단계 이벤트가 그 단계 시점에 실제로 도는 페이지(조건이 앞 단계들로 다 채워진 가장 높은 페이지)에 켜기를 붙인다.
 */
export function fillUnsetStepConditions(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const unset = walkBlueprint(project).blockers.filter((b) => b.id === "blueprint-condition-unset");
  if (!unset.length) return [];
  const resolved = bp.steps.map((step) => {
    const map = findMap(project, step.place);
    return { step, map, ev: map ? findEvent(map, step.event) : undefined };
  });
  const switchIds = new Set(((project.switches ?? []) as unknown as { id: unknown }[]).map((s) => String(s.id)));
  const itemIds = new Set(((project.database.items ?? []) as unknown as { id: unknown }[]).map((s) => String(s.id)));
  for (const b of unset) {
    const m = /^(\S+) (\S+) needs (\S+)$/u.exec(b.evidence);
    if (!m) continue;
    const k = resolved.findIndex((r) => r.step.id === m[1] && r.ev?.id === m[2]);
    if (k <= 0) continue;
    let p = k - 1;
    while (p >= 0 && (!resolved[p]!.ev || resolved[p]!.ev === resolved[k]!.ev)) p--;
    if (p < 0) continue;
    const prev = resolved[p]!;
    const have = new Set<string>();
    for (let j = 0; j < p; j++) { const ev = resolved[j]!.ev; if (!ev) continue; const s = eventSetter(project, ev); for (const id of [...s.switches, ...s.items, ...s.variables]) have.add(id); }
    const pages = pagesOf(prev.ev!);
    let page: Obj | undefined;
    // 증거를 내밀어야 넘어가는 페이지(추리 용의자 「· 증거」)가 있으면 그 페이지 — 증거를 앞 단계가 아닌 조사 칸이 주면(evidenceOnThing) have 에 없어
    // 말만 걸면 도는 첫 페이지가 골라져 증거 없이 조건이 켜졌다(2026-10-29 vm5 argon 추리 재생).
    // 단, 그 페이지의 조건이 앞 단계 결과이거나 그 페이지가 내밀게 하는 증거일 때만 — 앞 단계와 뒤 지목 단계가 같은 사람이면 지목 페이지(뒤 단계 자백·
    // 탐문 스위치가 조건)가 골라져 첫 단계 조건이 엔딩 갈래 안에서야 켜졌다(2026-10-29 vm3 argon 추리 회귀: 「사건 조사 시작」이 범인 지목 안에).
    const presentedIds = (pg: Obj): Set<string> => new Set([...JSON.stringify(pg.commands ?? []).matchAll(/"itemIds":\[([^\]]*)\]/gu)].flatMap((x) => [...x[1]!.matchAll(/"([^"]+)"/gu)].map((y) => y[1]!)));
    page = [...pages].reverse().find((pg) => hasCommands(pg) && JSON.stringify(pg.commands).includes('"presentItem"')
      && pageNeeds(pg).every((n) => have.has(n.id) || presentedIds(pg).has(n.id)));
    if (!page) for (let i = pages.length - 1; i >= 0; i--) if (hasCommands(pages[i]!) && pageNeeds(pages[i]!).every((n) => have.has(n.id))) { page = pages[i]; break; }
    if (!page) continue;
    const commands = page.commands as Obj[];
    const add: Obj[] = [];
    for (const id of m[3]!.split(",")) {
      if (JSON.stringify(commands).includes(`"${id}"`)) continue;
      if (switchIds.has(id)) add.push({ kind: "setSwitch", switchId: id, value: true });
      else if (itemIds.has(id)) add.push({ kind: "changeItem", itemId: id, op: "+=", amount: 1 });
    }
    if (!add.length) continue;
    // 증거를 내밀어야 넘어가는 페이지(추리 용의자 「· 증거」)면 맞는 증거 갈래 안에 — 페이지 끝에 두면 말만 걸어도 켜진다
    // (2026-10-29 vm5 argon 추리: 「모든 단서」가 상인 오언에게 말만 걸면 켜져 증거를 안 내밀어도 지목이 열렸다).
    const presented = ((): Obj[] | undefined => {
      const seen: Obj[] = [];
      const walk = (list: unknown): void => { if (!Array.isArray(list)) return; for (const c of list as Obj[]) { if (!c || typeof c !== "object") continue; if (c.kind === "presentItem") seen.push(c); for (const v of Object.values(c)) if (Array.isArray(v)) { walk(v); for (const o of v as Obj[]) if (o && typeof o === "object" && Array.isArray(o.branch)) walk(o.branch); } } };
      walk(commands);
      const right = seen.map((c) => ((c.options ?? []) as Obj[])[0]).find((o) => Array.isArray(o?.branch));
      return right ? right.branch as Obj[] : undefined;
    })();
    const into = presented ?? commands;
    const stop = into.findIndex((c) => /^(transfer|gameOver|returnToTitle|ending|endGame|triggerEnding|battleProcessing)$/u.test(String(c.kind ?? "")));
    into.splice(stop < 0 ? into.length : stop, 0, ...add);
    notes.push(`청사진 ${resolved[k]!.step.id} 「${resolved[k]!.step.event}」 의 조건 ${add.map((c) => String(c.switchId ?? c.itemId)).join("·")} 을 앞 단계 「${prev.step.event}」 가 켜게 했다.`);
  }
  return notes;
}

/**
 * 앞 단계 없이 열리는 단계를 앞 단계 뒤에만 열리게 한다(결정적, 출하 전 끝맺음).
 * 왜(2026-10-29 vm3 deepseek 추리 재짓기, 같은 맵 지름길 검사 `stepSkipSetters`): 모델이 지은 대화 단계(여관 주인 덕수·노파 말순)를
 * 경로 빌더가 그대로 두었는데, 그 이벤트는 자기 스위치만 켜고 청사진 gives(「사건접수」「증언확보」)를 아무것도 켜지 않았다 —
 * 다음 고리(짚 부스러기·곳간 짚더미)가 조건 없이 지어져 덕수·수프 그릇·말순을 건너뛰고 범인 지목까지 갔다.
 *  1) 앞 단계가 대화만 하고 아무것도 켜지 않으면 그 단계의 「마침」 스위치를 만들어 그 대화 페이지들이 켜게 한다.
 *  2) 뒤 단계 이벤트가 앞 단계 결과 없이 돌면(조건 없는 페이지가 무언가를 하거나, 켜는 것이 없는 대화) 앞 단계 결과를 조건으로 붙이고
 *     맨 앞에 조건 없는 「아직」 페이지를 둔다(먼저 할 일은 `pointLockedPagesIn` 이 덧붙인다).
 * 전투·이동·상점·자동 실행 이벤트는 건드리지 않는다(보스·문은 `orderStepBattlesIn`·`lockStepOrderDoorsIn` 몫).
 */
export function gateOpenSteps(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp || bp.steps.length < 2) return [];
  const notes: string[] = [];
  const resolved = bp.steps.map((step) => {
    const map = findMap(project, step.place);
    return { step, map, ev: map ? findEvent(map, step.event) : undefined };
  });
  const label = (e: GameEvent) => String((e as unknown as Obj).name ?? e.id);
  const special = (ev: GameEvent) => /"kind":"(battleProcessing|transfer|shop|inputNumber|choices|presentItem|monster[A-Za-z]*|startBattle)"/u.test(JSON.stringify(ev.pages ?? []))
    || pagesOf(ev).some((p) => /^(auto|parallel|autorun)$/u.test(String(obj(p.trigger)?.kind ?? "")));
  const doing = (page: Obj) => { const s = settersOf(page.commands); return s.switches.size + s.items.size + s.variables.size > 0 || s.ends; };
  const writeEvent = (map: GameMap, ev: GameEvent, pages: Obj[]) => {
    map.events = map.events.map((e) => e.id === ev.id ? ({ ...e, pages } as unknown as GameEvent) : e);
    return map.events.find((e) => e.id === ev.id)!;
  };
  const stopAt = (commands: Obj[]) => { const i = commands.findIndex((c) => /^(transfer|gameOver|returnToTitle|triggerEnding|battleProcessing)$/u.test(String(c.kind ?? ""))); return i < 0 ? commands.length : i; };
  for (let k = 1; k < resolved.length; k += 1) {
    const cur = resolved[k]!;
    if (!cur.ev || !cur.map || special(cur.ev)) continue;
    if (resolved.slice(0, k).some((r) => r.ev?.id === cur.ev!.id)) continue;
    let p = k - 1;
    while (p >= 0 && !resolved[p]!.ev) p--;
    if (p < 0) continue;
    const prev = resolved[p]!;
    // 앞 차례에서 고친 이벤트를 다시 읽는다 — 처음 찾은 객체는 낡았다(말순을 잠근 뒤 곳간 차례가 낡은 말순으로 덮어 잠금이 풀렸다).
    const live = (r: typeof cur) => r.map!.events.find((e) => e.id === r.ev!.id) ?? r.ev!;
    cur.ev = live(cur);
    prev.ev = live(prev);
    const curPages = pagesOf(cur.ev);
    const work = curPages.filter((pg) => Array.isArray(pg.commands) && (pg.commands as unknown[]).length);
    // 열려 있다: 무언가를 하는 페이지가 조건 없이 돈다, 또는 켜는 것 없는 대화가 조건 없이 돈다.
    const open = work.some((pg) => !pageNeeds(pg).length && doing(pg)) || (!work.some(doing) && work.some((pg) => !pageNeeds(pg).length));
    if (!open) continue;
    // 앞 단계 결과 — 대화만 하는 앞 단계면 「마침」 스위치를 만들어 켜게 한다.
    let prevEv = prev.ev!;
    const g = eventSetter(project, prevEv);
    const sw = [...g.switches].find((id) => !/_taken_\d+$/u.test(id)) ?? [...g.switches][0];
    let cond: Obj | undefined = sw ? { kind: "switch", switchId: sw, value: true } : g.items.size ? { kind: "item", itemId: [...g.items][0], present: true } : undefined;
    if (!cond) {
      if (special(prevEv)) continue;
      const id = `sw_bp_${String(prev.step.id).replace(/[^A-Za-z0-9_]/gu, "_")}_done`;
      const switches = ((project as unknown as { switches?: { id: string; name: string }[] }).switches ??= []);
      const givesName = /«([^»]+)»/u.exec(prev.step.gives)?.[1] ?? prev.step.gives;
      if (!switches.some((s) => s.id === id)) switches.push({ id, name: givesName.slice(0, 40) });
      // 앞 단계가 이미 앞앞 단계 뒤에만 열리면(조건 있는 페이지가 있으면) 그 열린 페이지들만 켠다 — 「아직」 페이지가 켜면 잠금이 풀린다.
      const anyGated = pagesOf(prevEv).some((pg) => pageNeeds(pg).length > 0);
      const prevPages = pagesOf(prevEv).map((pg) => {
        if (!Array.isArray(pg.commands) || !(pg.commands as unknown[]).length || (anyGated ? !pageNeeds(pg).length : false)) return pg;
        const commands = [...(pg.commands as Obj[])];
        commands.splice(stopAt(commands), 0, { kind: "setSwitch", switchId: id, value: true });
        return { ...pg, commands };
      });
      prevEv = writeEvent(prev.map!, prevEv, prevPages);
      cond = { kind: "switch", switchId: id, value: true };
      notes.push(`청사진 ${prev.step.id} 「${label(prevEv)}」 대화가 「${givesName}」(${id}) 스위치를 켜게`);
    }
    const key = JSON.stringify(cond);
    const first = curPages[0] ?? {};
    const speakers = JSON.stringify(cur.ev.pages ?? []).match(/"speaker":"([^"]+)"/gu)?.map((m) => m.slice(11, -1).trim()).filter(Boolean) ?? [];
    const who = speakers[0]?.split(/\s+/u).at(-1);
    const body = who ? `${who}${/[가-힣]/u.test(who.at(-1)!) && (who.at(-1)!.charCodeAt(0) - 0xac00) % 28 ? "은" : "는"} 아직 할 이야기가 없는 듯하다.` : "아직 살펴볼 때가 아닌 것 같다.";
    const locked: Obj = { ...structuredClone(first), id: `${String(first.id ?? "p0")}_step_order`, name: "아직", conditions: [], commands: [{ kind: "text", body }] };
    const gated = curPages.map((pg) => {
      const conds = Array.isArray(pg.conditions) ? (pg.conditions as Obj[]) : [];
      return conds.some((c) => JSON.stringify(c) === key) ? pg : { ...pg, conditions: [...conds, structuredClone(cond)] };
    });
    writeEvent(cur.map, cur.ev, [locked, ...gated]);
    notes.push(`청사진 ${cur.step.id} 「${label(cur.ev)}」 — 앞 단계 「${label(prevEv)}」 뒤에만 열리게`);
  }
  return notes;
}
