// 추리 사건의 남은 단서 — 아직 못 본 단서 사슬(pendingClueChain)과 그것을 일러 주는 줄(explainRemainingClues·refreshRemainingClues).
import type { GameEvent, GameMap, Project } from "@/project/types";
import { eventGives } from "./blueprint";
import { mapRegion, withWhere } from "../judge/objectiveWhere";
import { objectiveCommand } from "../judge/objectiveCommand";
import { tileLabel } from "../place/cells";
import type { BuildRun } from "../shared/types";
import { Obj, nameOf, visiblePerson, isMysteryBlueprint, Resolved, resolveSteps, jo, evidenceSpot, thingWords } from "./mysteryCaseRead";
import { unheardLines } from "./mysteryCaseLines";
import { floorPhrase } from "./mysteryEvidencePlaces";

export function hostThing(project: Project, map: GameMap, ev: GameEvent): string {
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
 * 지목 페이지들(잠김 페이지 뒤)이 요구하는 것 가운데 사슬이 이미 보장하는 것(chainDone)을 뺀 나머지를 «없을 때만 나오는 줄»로 — 증거 아이템은 어디서 얻는지까지.
 * 용의자 「이야기 들음」 스위치는 unheardLines 가 따로 말하므로 여기서는 아이템과, 켜는 이벤트를 아는 그 밖의 스위치만 짚는다.
 */
function lackingLines(project: Project, last: Resolved, gatePages: readonly Obj[], chainDone: readonly Obj[]): Obj[] {
  const heard = new Set(unheardLines(project).map((c) => String(((c as unknown as Obj).condition as Obj | undefined)?.switchId ?? "")));
  const known = new Set(chainDone.map((c) => `${String(c.kind)}:${String(c.switchId ?? c.itemId)}`));
  const out: Obj[] = [], seen = new Set<string>();
  const sources = (pick: (gives: { switches: string[]; items: string[] }) => boolean) => Object.values(project.maps).flatMap((map) => (map.events ?? []).filter((ev) => ev.id !== last.ev.id && pick(eventGives(project, ev))).map((ev) => ({ map, ev })));
  const elsewhere = (map: GameMap) => (map.id === last.map.id ? "" : `${map.name ?? map.id} `);
  for (const pg of gatePages) for (const c of ((pg.conditions ?? []) as Obj[])) {
    const key = `${String(c.kind)}:${String(c.switchId ?? c.itemId)}`;
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    if (c.kind === "item" && c.present !== false) {
      const name = String(project.database.items.find((i) => i.id === c.itemId)?.name ?? "").trim();
      const from = sources((g) => g.items.includes(String(c.itemId)))[0];
      if (!name || !from) continue;
      const giver = from.ev.id.endsWith("_evidence") ? from.map.events.find((e) => e.id === from.ev.id.replace(/_evidence$/u, "")) : undefined;
      const where = giver ? `「${nameOf(giver)}」${jo(nameOf(giver), "이/가")} 일러 준 ${elsewhere(from.map)}${floorPhrase(project, from.map, from.ev.x, from.ev.y)} 바닥을 살펴보자.`
        : visiblePerson(from.ev) ? `${elsewhere(from.map)}「${nameOf(from.ev)}」에게 말을 걸어 보자.` : `${elsewhere(from.map)}「${nameOf(from.ev)}」${jo(nameOf(from.ev), "을/를")} 살펴보자.`;
      out.push({ kind: "fork", condition: { kind: "item", itemId: c.itemId, present: false }, then: [{ kind: "text", body: `· 증거 『${name}』${jo(name, "이/가")} 아직 없다. ${where}` }] });
    } else if (c.kind === "switch" && c.value !== false && !heard.has(String(c.switchId))) {
      const from = sources((g) => g.switches.includes(String(c.switchId)))[0];
      if (!from || !nameOf(from.ev) || /^ev_/u.test(nameOf(from.ev))) continue;
      out.push({ kind: "fork", condition: { kind: "switch", switchId: c.switchId, value: false }, then: [{ kind: "text", body: `· ${elsewhere(from.map)}「${nameOf(from.ev)}」에서 할 일이 남았다.` }] });
    }
  }
  return out;
}

/**
 * 지목 목표(final) 앞에 «아직 못 찾은 단서» 갈래를 씌운다 — 단서 단계(용의자 아님)마다 마친 조건이 꺼져 있으면 그 단서로 가는 목표(맵 입구 꼬리 포함)를 건다.
 * 왜(2026-10-29 vm7 argon 추리): 용의자 셋과 이야기를 마치자 목표가 「「범인 지목」을 찾아가자」로 바뀌었는데 뒤뜰 덤불 단서를 아직 못 찾은 때였다.
 * 지목 칸은 「단서가 모자라다」고 거절했고, 목표 화살표는 뒤뜰이 아니라 지목 칸을 가리켜 판정자는 넓은 뒤뜰에서 덤불을 끝내 못 찾았다.
 */
export function pendingClueChain(project: Project, fromMapId: string, final: Obj): Obj {
  const bp = project.gameBlueprint;
  const steps = resolveSteps(project);
  const last = steps.at(-1);
  if (!bp || !last || last.k !== bp.steps.length - 1) return final;
  const clues = steps.filter((r) => r.k < last.k);
  const suspect = (ev: GameEvent) => (ev.pages ?? []).some((pg) => / · 탐문$/u.test(String((pg as { name?: string }).name ?? "")));
  const label = (r: Resolved) => { const n = nameOf(r.ev); return n && !/^ev_/u.test(n) ? n : r.step.event; };
  const pending: { cond: Obj; text: string }[] = [];
  let unknown = false;
  for (const [j, r] of clues.entries()) {
    if (suspect(r.ev)) continue;
    const cond = clueDoneCond(project, r, clues[j + 1] ?? last, clues.slice(0, j))?.[0];
    if (!cond) { unknown = true; continue; }
    const spot = evidenceSpot(r.map, r.ev.id);
    const target = spot ?? r.ev;
    const name = spot ? nameOf(spot) : label(r);
    const text = visiblePerson(target) ? `아직 「${name}」의 이야기를 듣지 않았다. 「${name}」에게 말을 걸어 보자.` : `아직 못 찾은 단서가 있다. 「${name}」${jo(name, "을/를")} 찾아보자.`;
    const negated = cond.kind === "switch" ? { kind: "switch", switchId: cond.switchId, value: false } : { kind: "item", itemId: cond.itemId, present: false };
    pending.push({ cond: negated, text: withWhere(project, fromMapId, text, target.id) });
    // 그 사람이 가리킨 증거 칸의 물건은 말을 들은 것(위 조건)과 따로 주워야 한다 — 목표가 다음 단계로 넘어가 버리면 증거 칸을 찾으라는 말이 어디에도 없다.
    // 글은 감싼 갈래 표식(mysteryObjectives PENDING_MARK)으로 시작한다 — 다시 감쌀 때 갈래로 읽혀야 겹쳐 쌓이지 않는다.
    for (const itemId of spot ? eventGives(project, spot).items : []) {
      if (cond.kind === "item" && cond.itemId === itemId) continue;
      pending.push({ cond: { kind: "item", itemId, present: false }, text: withWhere(project, fromMapId, `아직 못 찾은 단서가 있다. 「${label(r)}」${jo(label(r), "이/가")} 일러 준 곳에서 「${name}」${jo(name, "을/를")} 찾아보자.`, spot!.id) });
    }
  }
  // 단서를 다 마친 뒤의 목표는 어느 페이지에서든 지목이다 — 그 페이지가 원래 걸던 «다음 단계»는 이미 끝낸 단계다.
  // 왜(2026-11-12 r1-mystery): 단서를 다 모은 뒤 첫 단계 「서진」에게 다시 말을 걸자 목표가 「「미란」을 찾아가자」로 돌아가, 판정자는 미란에게 일곱 번 다시 물었다.
  const lastName = label(last);
  const settled = !unknown && pending.length > 0 && !/^ev_/u.test(lastName) && !String(((final.fields ?? {}) as Obj).message ?? "").includes(`「${lastName}」`)
    ? objectiveCommand(withWhere(project, fromMapId, `「${lastName}」${jo(lastName, "을/를")} 찾아가자`, last.ev.id)) as Obj
    : final;
  return pending.reduceRight<Obj>((acc, p) => ({ kind: "fork", condition: p.cond, then: [objectiveCommand(p.text) as Obj], else: [acc] }), settled);
}

export function explainRemainingClues(run: BuildRun): string[] {
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
  // 사슬을 다 마쳤는데도 지목 페이지가 안 열리는 까닭을 말한다 — 지목 페이지들의 조건 전부(아이템·스위치)에서 아직 없는 것을 갈래로 짚는다.
  // 왜(2026-11-12 r1-mystery, 엔딩 못 봄): 사슬 스위치는 다 켜졌는데 지목이 요구하는 증거 아이템을 못 주운 채였다. 그 상태에 맞는 페이지가 없어
  // 하나 앞 페이지 「남은 단서 1개는 「서진의 해명」」이 서른네 번 나왔다 — 이미 들은 것을 또 들으라는 말이었다.
  const chainDone = openCond(clues.length);
  const lacking = chainDone?.length ? lackingLines(project, last, pages0.slice(lockedAt + 1), chainDone) : [];
  if (lacking.length) progress.push({ ...structuredClone(locked), id: `${String(locked.id ?? last.ev.id)}_lack`, name: "남은 단서 · 증거", conditions: structuredClone(chainDone), commands: [{ kind: "text", body: "단서는 다 모았다. 그런데 범인을 지목하기에는 아직 모자란 것이 있다." }, ...lacking, ...unheardLines(project)] });
  const pages = [...pages0.slice(0, lockedAt), ...progress, ...pages0.slice(lockedAt + 1)];
  if (JSON.stringify(pages) === JSON.stringify(last.ev.pages ?? [])) return [];
  // 이름을 함께 넘긴다 — 빠지면 첫 페이지 이름 「남은 단서 3」이 이벤트 이름표가 됐다(vm4 argon 추리 판정 「범인 라벨이 시스템 문구」).
  run.call("upsert_event", { mapId: last.map.id, replacePages: true, event: { id: last.ev.id, ...(nameOf(last.ev) ? { name: nameOf(last.ev) } : {}), pages } });
  return [`「${label(last)}」 잠김 대사에 남은 단서 수·자리(${clues.length}단계)`];
}
