// 청사진의 싸우는 단계를 이야기 사슬에 잇는다(결정적 · 되풀이 안전).
//
// 왜(2026-11-16 r6a 포구 마을, 플레이 결함 P2): 모델이 add_boss_encounter 로 「해골 병사」·「검은 종지기」 를 세운 뒤 build_blueprint_path 를 부르자
// 경로 빌더가 «전투 명령이 있다» 며 호출을 통째로 거절했다. 끝맺음의 단계 잠그기(gateOpenSteps)는 싸움 이벤트를 건드리지 않아 사슬이 대화 단계 셋에서
// 끊겼다 — 신부도 병사도 건너뛰고 보스만 이기면 2분 만에 엔딩이었고, 병사는 «길이 열렸다» 고 말하는데 닫힌 것이 없었다.
// 하는 일:
//  - chainFightStepsIn: 싸우는 단계 이벤트의 싸우는 페이지가 조건 없이 열려 있으면, 앞 단계가 넘기는 것(지은 고리의 스위치·물건, 싸움이면 승리 스위치,
//    대화뿐이면 「마침」 스위치)을 그 페이지의 조건으로 걸고 맨 앞에 «아직» 페이지를 둔다. 이긴 뒤 페이지는 그대로다.
//  - endAfterFinalFightIn: 마지막 단계가 싸움인데 엔딩을 부르지 않으면 그 싸움의 승리 갈래 끝에서 엔딩을 부른다.
// 부르는 곳: 경로 빌더(buildBlueprintPath)와 끝맺음 gate-open-steps — 모델이 경로를 부르지 않고 제 손으로 이어도 싸움 단계가 사슬에 든다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { type Obj, findMap, findEvent, pagesOf, eventSetter, pageNeeds, victoryGatedSwitches, walk, walkBlueprint } from "./blueprint";
import { markStepDone } from "./blueprintRepair";
import { josa, sameName } from "./blueprintPathNames";
import { anchorsOf, blockersOf, bodyReached, reachFrom } from "../judge/eventReach";
import { eventPassageRect } from "@/project/eventFootprintQuery";

const fights = (page: Obj): boolean => { let hit = false; walk(page.commands, (c) => { if (c.kind === "battleProcessing") hit = true; }); return hit; };
const open = (page: Obj): boolean => fights(page) && !pageNeeds(page).length;
const write = (map: GameMap, ev: GameEvent, pages: Obj[]): void => { map.events = map.events.map((e) => (e.id === ev.id ? ({ ...e, pages } as unknown as GameEvent) : e)); };
const condName = (project: Project, cond: Obj): string => cond.kind === "item"
  ? `item ${project.database.items.find((i) => i.id === cond.itemId)?.name ?? String(cond.itemId)}`
  : `switch ${((project.switches ?? []) as unknown as { id: string; name?: string }[]).find((s) => s.id === cond.switchId)?.name ?? String(cond.switchId)}`;

/** 그 적의 몸을 못 지나는 칸으로 두면 들어오는 쪽에서 target 에 닿지 못하는가(같은 맵). 들어오는 칸이 없는 맵은 판단하지 않는다. */
function beyondFoe(project: Project, map: GameMap, foe: GameEvent, target: GameEvent): boolean {
  const anchors = anchorsOf(project, map);
  if (!anchors.length) return false;
  const others = blockersOf(map, target.id);
  if (!bodyReached(map, reachFrom(project, map, anchors, others), target)) return false;
  const hard = new Set(others);
  const rect = eventPassageRect(foe);
  hard.add(foe.y * map.width + foe.x);
  for (let y = Math.max(0, rect.top); y <= Math.min(map.height - 1, rect.bottom); y += 1) for (let x = Math.max(0, rect.left); x <= Math.min(map.width - 1, rect.right); x += 1) hard.add(y * map.width + x);
  return !bodyReached(map, reachFrom(project, map, anchors, hard), target);
}

/** 싸우는 단계를 앞 단계 뒤에만 열리게 한다. 돌려주는 글은 모델이 읽는다(영어). */
export function chainFightStepsIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp || bp.steps.length < 2) return [];
  const notes: string[] = [];
  const resolved = bp.steps.map((step) => { const map = findMap(project, step.place); return { step, map, ev: map ? findEvent(map, step.event) : undefined }; });
  for (let k = 1; k < resolved.length; k += 1) {
    const cur = resolved[k]!;
    if (!cur.ev || !cur.map || resolved.slice(0, k).some((r) => r.ev?.id === cur.ev!.id)) continue;
    const ev = cur.map.events.find((e) => e.id === cur.ev!.id) ?? cur.ev;
    const pages = pagesOf(ev);
    const first = pages.find(open);
    if (!first) continue;
    let p = k - 1;
    while (p >= 0 && (!resolved[p]!.ev || !resolved[p]!.map)) p -= 1;
    if (p < 0) continue;
    const prev = resolved[p]!;
    const prevEv = prev.map!.events.find((e) => e.id === prev.ev!.id) ?? prev.ev!;
    // 앞 단계가 넘기는 것: 경로 빌더가 적어 둔 것 → 이겨야 켜지는 스위치 → 그 이벤트가 켜는 스위치·주는 물건 → (대화뿐이면) 「마침」 스위치.
    const built = prev.step.built?.eventId === prevEv.id ? prev.step.built : undefined;
    const gave = eventSetter(project, prevEv);
    const won = victoryGatedSwitches(project);
    const sw = built?.switchId ?? [...gave.switches].find((id) => won.has(id)) ?? [...gave.switches].find((id) => !/_taken_\d+$/u.test(id)) ?? [...gave.switches][0];
    const item = built?.itemId ?? (sw ? undefined : [...gave.items][0]);
    let cond: Obj | undefined = built?.itemId && !built.switchId ? { kind: "item", itemId: built.itemId, present: true } : sw ? { kind: "switch", switchId: sw, value: true } : item ? { kind: "item", itemId: item, present: true } : undefined;
    if (!cond) {
      // 상점·이동처럼 대화가 아닌 앞 단계는 「마침」 을 켤 자리가 없다 — 잇지 않는다.
      if (pagesOf(prevEv).some((pg) => { let hit = false; walk(pg.commands, (c) => { if (/^(battleProcessing|transfer|shop)$/u.test(String(c.kind ?? ""))) hit = true; }); return hit; })) continue;
      cond = markStepDone(project, prev.map!, prevEv, prev.step).cond;
    }
    // 제가 켜는 것을 제 조건으로 걸면 영영 못 싸운다.
    const own = eventSetter(project, ev);
    if (own.switches.has(String(cond.switchId ?? "")) || own.items.has(String(cond.itemId ?? ""))) continue;
    const name = String((ev as unknown as Obj).name ?? cur.step.event);
    // 앞 단계의 이벤트가 이 적 너머에 있으면 잠그지 않는다 — 적은 앞 단계를 기다리고, 앞 단계는 적을 이겨야 닿아 서로 기다린다.
    if (prev.map === cur.map && beyondFoe(project, cur.map, ev, prevEv)) {
      notes.push(`Not chained: fight step ${cur.step.id} «${name}» stands between the way in and ${prev.step.id} «${String((prevEv as unknown as Obj).name ?? prev.step.event)}», so it stays fightable at once (move one of them if the order matters)`);
      continue;
    }
    const locked: Obj = { ...structuredClone(first), id: `${String(first.id ?? "p0")}_step_order`, name: "아직", conditions: [], commands: [{ kind: "text", body: `(${name}${josa(name, "은", "는")} 아직 움직이지 않는다.)` }] };
    write(cur.map, ev, [locked, ...pages.map((pg) => (open(pg) ? { ...pg, conditions: [...(Array.isArray(pg.conditions) ? (pg.conditions as Obj[]) : []), structuredClone(cond)] } : pg))]);
    notes.push(`Chained fight step ${cur.step.id} «${name}»: it fights only after ${prev.step.id} «${String((prevEv as unknown as Obj).name ?? prev.step.event)}» (${condName(project, cond)}); before that it only says it does not move yet`);
  }
  return notes;
}

/** 마지막 단계가 싸움이고 엔딩을 부르지 않으면 그 승리 갈래 끝에서 엔딩을 부른다. */
export function endAfterFinalFightIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  const last = bp?.steps.at(-1);
  const map = last ? findMap(project, last.place) : undefined;
  const ev = map && last ? findEvent(map, last.event) : undefined;
  if (!bp || !last || !map || !ev || !pagesOf(ev).some(fights)) return [];
  if (!walkBlueprint(project).blockers.some((b) => b.id === "blueprint-no-ending" && b.evidence === `${last.id} ${ev.id}`)) return [];
  const endings = (project.endings ?? []) as unknown as { id: string; name?: string }[];
  const ending = endings.find((e) => sameName(e.name ?? "", bp.ending.name)) ?? (endings.length === 1 ? endings[0] : undefined);
  if (!ending) return [];
  const pages = structuredClone(pagesOf(ev));
  // 승리 갈래들 — 승리 스위치를 켜는 갈래가 먼저, 없으면 처음 만난 갈래.
  const wins: Obj[][] = [];
  for (const pg of pages) walk(pg.commands, (c) => {
    const cond = c.condition as { kind?: string; result?: string } | undefined;
    if (c.kind === "battleProcessing" && Array.isArray(c.victoryBranch) && (c.victoryBranch.length || c.branchOnResult === true)) wins.push(c.victoryBranch as Obj[]);
    if (c.kind === "fork" && cond?.kind === "battleResult" && cond.result === "victory" && Array.isArray(c.then)) wins.push(c.then as Obj[]);
  });
  const call: Obj = { kind: "triggerEnding", endingId: ending.id };
  const into = wins.find((list) => list.some((c) => c.kind === "setSwitch")) ?? wins[0];
  if (into) into.push(call);
  else {
    const page = pages.find(fights)!;
    const cmds = page.commands as Obj[];
    const at = cmds.findIndex((c) => c.kind === "battleProcessing");
    if (at < 0) return [];
    cmds.splice(at + 1, 0, { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [call] });
  }
  write(map, ev, pages);
  return [`Winning the last fight ${last.id} «${String((ev as unknown as Obj).name ?? last.event)}» now calls the ending «${ending.name ?? ending.id}»`];
}
