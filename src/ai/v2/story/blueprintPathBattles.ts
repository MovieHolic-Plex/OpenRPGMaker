// 청사진 경로의 전투 단계 — 이겨야 진행되게(gateBattleSteps), 단계 순서대로 싸우게(orderStepBattles), 보스 승리가 단계를 끝내게, 못 이기는 전투 맞추기(fitUnwinnableStepBattles).
import type { GameMap, Project } from "@/project/types";
import type { BuildRun } from "../shared/types";
import { battleStepBypass, isBattleStep, isCodeStep, victoryGatedSwitches } from "./blueprint";
import { pickFittedTroops } from "@/editor/tools/jrpgVolumeTools";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { simulateBattle } from "@/battle/simulate";
import { planObjective } from "../judge/objectivePlan";
import { OBJECTIVE_SURFACE } from "../judge/objectiveCommand";
import { norm, sameName, mapFor, josa, RawPage } from "./blueprintPathNames";

const PROGRESS = new Set(["triggerEnding", "setSwitch", "changeItem", "transfer"]);

function pageMoves(page: RawPage): boolean {
  const text = JSON.stringify(page.commands ?? []);
  return [...PROGRESS].some((k) => text.includes(`"kind":"${k}"`));
}

/**
 * 싸워 이기는 청사진 단계가 이기지 않아도 넘어가면(blueprint-battle-bypass) 고친다. 결정적·되풀이 안전.
 *  - 그 맵에 승리 갈래에서만 스위치를 켜는 전투 이벤트(보스)가 있으면: 넘어가는 페이지에 그 스위치 조건을 더하고, 바로 앞에 같은 조건의
 *    「먼저 <보스>를 쓰러뜨려야 한다」 페이지를 둔다(열쇠는 있는데 아직 못 이긴 때).
 *  - 없으면: 그 페이지 안에서 시작 파티에 맞춘 보스 그룹과 싸우고(도망·패배 불가), 원래 명령은 승리 갈래에서만 한다.
 */
export function gateBattleSteps(run: BuildRun): string[] {
  const bp = run.ctx.project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  for (const step of bp.steps) {
    if (isCodeStep(step) || !isBattleStep(step)) continue;
    const project = run.ctx.project;
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event))
      ?? map?.events.find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), step.event));
    if (!map || !ev || !battleStepBypass(project, ev)) continue;
    const won = victoryGatedSwitches(project);
    const bosses = map.events.filter((e) => e.id !== ev.id).flatMap((e) => {
      const text = JSON.stringify(e.pages ?? []);
      const sw = [...text.matchAll(/"switchId":"([^"]+)"/gu)].map((m) => m[1]!).find((id) => won.has(id));
      const troopId = /"troopId":"([^"]+)"/u.exec(text)?.[1];
      // 보스·수문장만 — 도망칠 수 있는 떠도는 잡몹(임프 무리)을 「이겨야 할 상대」로 걸지 않는다.
      const boss = /boss|보스/iu.test(`${e.id} ${troopId ?? ""}`) || text.includes('"canEscape":false');
      return sw && boss ? [{ event: e, sw, troopId, named: /boss|보스/iu.test(`${e.id} ${troopId ?? ""}`) }] : [];
    });
    const boss = bosses.find((b) => b.named) ?? bosses.at(-1);
    const pages = structuredClone(ev.pages ?? []) as unknown as RawPage[];
    const out: RawPage[] = [];
    if (boss) {
      const troop = project.database.troops.find((t) => t.id === boss.troopId);
      const name = troop?.name ?? "길을 막는 적";
      const cond = { kind: "switch", switchId: boss.sw, value: true };
      for (const page of pages) {
        const gated = (page.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === boss.sw);
        if (!pageMoves(page) || gated) { out.push(page); continue; }
        out.push({ ...structuredClone(page), id: `${String(page.id ?? "p")}_unbeaten`, name: "아직 못 이김", commands: [{ kind: "text", body: `먼저 ${name}${josa(name, "을", "를")} 쓰러뜨려야 한다.` }] });
        out.push({ ...page, conditions: [...(page.conditions ?? []), cond] });
      }
      notes.push(`「${step.event}」은 ${name}(${boss.event.id}) 승리 뒤에만 넘어간다`);
      // 보스 승리가 이제 이정표다 — 이긴 뒤 목표 줄이 이 단계 이벤트를 가리키게 한다(없으면 앞 목표가 남아 길을 잃는다).
      if (!JSON.stringify(boss.event.pages ?? []).includes(OBJECTIVE_SURFACE)) {
        const plan = planObjective(run.ctx.project, { text: `${step.event}${josa(step.event, "을", "를")} 마무리하자`, eventId: boss.event.id, mapId: map.id, where: ev.id });
        if (plan.ok) for (const entry of plan.events) run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true });
      }
    } else {
      // 이미 싸우는 페이지는 두 번째 전투로 감싸지 않는다 — 승리 갈래 밖 진행 명령을 그 전투의 승리 갈래로 옮긴다(foldProgressIntoVictory).
      const folded = pages.map((page) => foldProgressIntoVictory(page));
      if (folded.some((f) => f.moved > 0) && !battleStepBypass(project, { ...ev, pages: folded.map((f) => f.page) } as unknown as typeof ev)) {
        const moved = folded.flatMap((f, i) => (f.moved ? [`page ${i + 1} (${f.moved} commands)`] : []));
        notes.push(`Fixed: «${step.event}» already fights a battle, but ${moved.join(", ")} ran story progress outside the battle's victory branch, so the step could be passed without winning. Moved those commands into that battle's victory branch instead of adding a second battle.`);
        if (!run.call("upsert_event", { mapId: map.id, event: { ...structuredClone(ev), pages: folded.map((f) => f.page) } as unknown as Record<string, unknown>, replacePages: true }).ok) notes.pop();
        continue;
      }
      const troopId = pickFittedTroops(project, undefined).boss;
      if (!troopId) continue;
      for (const page of pages) {
        if (!pageMoves(page)) { out.push(page); continue; }
        out.push({ ...page, commands: [
          { kind: "battleProcessing", troopId, canEscape: false, canLose: false },
          { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: page.commands ?? [] },
        ] });
      }
      notes.push(`「${step.event}」 안에서 ${troopId} 와 싸우고 이겨야 넘어간다`);
    }
    const event = { ...structuredClone(ev), pages: out };
    if (!run.call("upsert_event", { mapId: map.id, event: event as unknown as Record<string, unknown>, replacePages: true }).ok) notes.pop();
  }
  return notes;
}

/**
 * 이미 전투가 있는 페이지에서, 맨 위 줄의 진행 명령(엔딩·스위치·아이템·이동)과 그 바로 앞에 이어 붙은 대사를 첫 전투의 승리 갈래 끝으로 옮긴다.
 * 왜(2026-10-31 ja2a·ja2b argon jrpg): 단계 「마왕」 페이지가 [「마왕을 살펴보았다」, 엔딩 글, triggerEnding, 마왕 전투] 꼴이라 이기지 않아도
 * 엔딩이 불렸고(blueprint-battle-bypass), gateBattleSteps 가 페이지 통째를 맞춘 보스 그룹(troop_fit_boss_dragon) 전투로 한 번 더 감쌌다 —
 * 플레이어는 용과 싸운 뒤 바로 마왕과 또 싸웠다(판정자 「보스가 두 번 나온다」). 전투가 이미 있으면 그 승리 갈래가 진행을 맡는다.
 */
function foldProgressIntoVictory(page: RawPage): { page: RawPage; moved: number } {
  type Cmd = Record<string, unknown> & { kind?: string };
  const cmds = (page.commands ?? []) as Cmd[];
  const b = cmds.findIndex((c) => c.kind === "battleProcessing");
  if (b < 0) return { page, moved: 0 };
  const take = new Set<number>();
  cmds.forEach((c, i) => {
    if (i === b || !PROGRESS.has(String(c.kind))) return;
    take.add(i);
    for (let j = i - 1; j >= 0 && j !== b && cmds[j]!.kind === "text" && !take.has(j); j -= 1) take.add(j);
  });
  if (!take.size) return { page, moved: 0 };
  const moving = cmds.filter((_, i) => take.has(i)).map((c) => structuredClone(c));
  const battle = structuredClone(cmds[b]!) as Cmd & { victoryBranch?: Cmd[]; branchOnResult?: boolean };
  const rest = cmds.filter((_, i) => !take.has(i) && i !== b);
  const at = cmds.slice(0, b).filter((_, i) => !take.has(i)).length;
  const after: Cmd[] = [];
  if (Array.isArray(battle.victoryBranch)) {
    const fork = battle.victoryBranch.find((c) => c.kind === "fork" && (c.condition as { kind?: string; result?: string } | undefined)?.kind === "battleResult" && (c.condition as { result?: string }).result === "victory") as (Cmd & { then?: Cmd[] }) | undefined;
    if (fork) fork.then = [...(fork.then ?? []), ...moving];
    else battle.victoryBranch = [...battle.victoryBranch, ...moving];
  } else {
    after.push({ kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: moving });
  }
  const commands = [...rest.slice(0, at), battle, ...after, ...rest.slice(at)];
  return { page: { ...page, commands }, moved: moving.length };
}

/**
 * 싸우는 단계가 아닌데 gateBattleSteps 가 «안에서 싸우기»로 감싼 페이지를 푼다 — `[보스 그룹 전투(도망·패배 불가), 승리 갈래 { 원래 명령 }]`
 * 꼴이고 그룹이 경로 빌더 사본(`troop_path_*`)이면 원래 명령만 남긴다. 결정적·되풀이 안전.
 * 2026-10-29 vm7 argon jrpg: 「촌장에게 마왕 토벌의 부탁과 동굴 열쇠를 받는다」를 전투 단계로 읽어(낱말 「토벌」) 촌장에게 말 걸자마자 용과 싸웠다.
 * 낱말 판정은 고쳤지만(`isBattleStep` 의 맡는 일 구) 이미 감싼 저장본은 이 함수로 되돌린다.
 */
export function ungateTalkStepBattlesIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  for (const step of bp.steps) {
    if (isCodeStep(step) || isBattleStep(step)) continue;
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event));
    if (!map || !ev) continue;
    let touched = false;
    const pages = ((ev.pages ?? []) as unknown as RawPage[]).map((page) => {
      const cmds = (page.commands ?? []) as { kind?: string; troopId?: unknown; canEscape?: unknown; canLose?: unknown; condition?: { kind?: string; result?: string }; then?: unknown; else?: unknown }[];
      const [fight, fork] = cmds;
      const wrapped = cmds.length === 2 && fight?.kind === "battleProcessing" && typeof fight.troopId === "string" && fight.troopId.startsWith("troop_path_")
        && fight.canEscape === false && fight.canLose === false
        && fork?.kind === "fork" && fork.condition?.kind === "battleResult" && fork.condition.result === "victory" && Array.isArray(fork.then)
        && !(Array.isArray(fork.else) && fork.else.length);
      if (!wrapped) return page;
      touched = true;
      return { ...page, commands: structuredClone(fork!.then) as RawPage["commands"] };
    });
    if (!touched) continue;
    map.events = map.events.map((e) => e.id === ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
    notes.push(`「${String((ev as { name?: string }).name ?? ev.id)}」은 싸우는 단계가 아니라 붙어 있던 보스 전투를 뺐다`);
  }
  return notes;
}

/**
 * 단계 순서 보호(2026-10-29 vm3 terra jrpg): 「마왕과의 결전」 이 「은신처 발견」(앞 단계 스위치)과 마왕 승리 스위치를 둘 다 요구하는데,
 * 마왕 전투 이벤트는 조건 없이 서 있어 앞 단계 단서(2칸 옆 「동굴의 흔적」)를 보기 전에 부딪혀 싸웠고, 이긴 뒤 목표 「마왕과의 결전을 마무리하자」 가
 * 채울 길 없는 조건(은신처 발견)에 막혔다. 단계 이벤트의 넘어가는 페이지가 승리 스위치 W 와 함께 요구하는 다른 스위치(앞 단계가 켜는 것)를,
 * W 를 켜는 전투 이벤트의 싸우는 페이지 조건에도 건다 — 앞 단계 전에는 그 적이 나타나지 않는다. 결정적·되풀이 안전.
 * 안내 줄도 고친다: 「X이 있어야 할 것 같다.」 만 말하던 잠김 대사에, X 를 주는 앞 단계 이벤트 이름을 붙인다.
 */
export function orderStepBattles(run: BuildRun): string[] {
  return orderStepBattlesIn(run.ctx.project);
}

/** orderStepBattles 의 본체 — 프로젝트를 제자리에서 고친다(끝맺음 조립 finishAutoBuild 도 부른다: 경로를 다시 짓지 않는 판에도 돌게). */
export function orderStepBattlesIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const won = victoryGatedSwitches(project);
  type Ev = GameMap["events"][number];
  const all: { map: GameMap; ev: Ev }[] = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev })));
  const setsSwitch = (value: unknown, id: string): boolean => JSON.stringify(value ?? []).includes(`"switchId":"${id}"`) && JSON.stringify(value ?? []).includes('"setSwitch"');
  // 이름은 같은 이름 먼저 — 「마왕과의 결전」 이 품은 짧은 이름(보스 「마왕」)을 먼저 잡지 않게.
  const stepEvents = bp.steps.map((step) => all.find((r) => r.ev.id === step.event) ?? all.find((r) => norm(String((r.ev as { name?: string }).name ?? "")) === norm(step.event)) ?? all.find((r) => !r.ev.id.startsWith("ev_objective") && sameName(String((r.ev as { name?: string }).name ?? ""), step.event)));
  for (const ref of stepEvents) {
    if (!ref) continue;
    for (const page of (ref.ev.pages ?? []) as unknown as RawPage[]) {
      const conds = (page.conditions ?? []) as { kind?: string; switchId?: string; itemId?: string; present?: unknown }[];
      const w = conds.find((c) => c.kind === "switch" && c.switchId && won.has(c.switchId))?.switchId;
      if (!w || !pageMoves(page)) continue;
      // 앞 단계 조건 — 스위치와 아이템(vm5 flash jrpg: 「동굴 열쇠」 아이템 조건이라 보스가 열쇠 전에도 싸웠다).
      type Need = { kind: "switch" | "item"; id: string };
      const prereqs: Need[] = conds.flatMap((c): Need[] => c.kind === "switch" && c.switchId && c.switchId !== w ? [{ kind: "switch", id: c.switchId }] : c.kind === "item" && c.itemId && c.present !== false ? [{ kind: "item", id: c.itemId }] : []);
      if (!prereqs.length) continue;
      const holder = all.find((r) => r.ev.id !== ref.ev.id && (r.ev.pages ?? []).some((pg) => JSON.stringify(pg.commands ?? []).includes('"battleProcessing"') && setsSwitch(pg.commands, w)));
      if (!holder) continue;
      const givesItem = (value: unknown, id: string): boolean => JSON.stringify(value ?? []).includes(`"itemId":"${id}"`) && JSON.stringify(value ?? []).includes('"changeItem"');
      // 앞 단계 스위치·아이템을 다른 이벤트(전투 이벤트 자신이 아닌)가 켜야·줘야 건다 — 아무도 안 주면 적이 영영 안 나타난다.
      // 그 전투에 이겨야 켜지는 페이지만 주는 조건은 빼다 — 전투 앞에 걸면 서로 기다린다(vm4 flash jrpg: 동굴의 열쇠는 과부 거미를 이긴 뒤에야 나온다).
      const wonGated = (pg: RawPage) => ((pg.conditions ?? []) as { kind?: string; switchId?: string }[]).some((c) => c.kind === "switch" && c.switchId === w);
      const need = prereqs.filter((n) => all.some((r) => r.ev.id !== holder.ev.id && (r.ev.pages ?? []).some((pg) => !wonGated(pg as unknown as RawPage) && (n.kind === "switch" ? setsSwitch(pg.commands, n.id) : givesItem(pg.commands, n.id)))));
      if (!need.length) continue;
      let touched = false;
      const pages = ((holder.ev.pages ?? []) as unknown as RawPage[]).map((pg) => {
        const fights = JSON.stringify(pg.commands ?? []).includes('"battleProcessing"') && setsSwitch(pg.commands, w);
        const have = new Set(((pg.conditions ?? []) as { switchId?: string; itemId?: string }[]).map((c) => c.switchId ?? c.itemId));
        const add = fights ? need.filter((n) => !have.has(n.id)) : [];
        if (!add.length) return structuredClone(pg);
        touched = true;
        return { ...structuredClone(pg), conditions: [...(pg.conditions ?? []), ...add.map((n) => n.kind === "switch" ? { kind: "switch", switchId: n.id, value: true } : { kind: "item", itemId: n.id, present: true })] };
      });
      if (touched) {
        holder.map.events = holder.map.events.map((e) => e.id === holder.ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
        notes.push(`${String((holder.ev as { name?: string }).name || holder.ev.id)} 전투는 「${String((ref.ev as { name?: string }).name ?? ref.ev.id)}」 앞 단계 뒤에만 나타난다`);
      }
    }
  }
  // 잠김 대사 「X이 있어야 할 것 같다.」 → X 를 주는 앞 단계 이벤트를 함께 말한다.
  bp.steps.forEach((_step, k) => {
    const ref = stepEvents[k];
    const prev = k > 0 ? bp.steps[k - 1] : undefined;
    const prevRef = k > 0 ? stepEvents[k - 1] : undefined;
    if (!ref || !prev?.gives || !prevRef) return;
    const prevName = String((prevRef.ev as { name?: string }).name ?? prev.event);
    const where = prevRef.map.id === ref.map.id ? "" : `${prevRef.map.name ?? prevRef.map.id}의 `;
    let touched = false;
    const pages = ((ref.ev.pages ?? []) as unknown as RawPage[]).map((pg) => {
      const cmds = (pg.commands ?? []) as { kind?: string; body?: string }[];
      const hit = cmds.findIndex((c) => c.kind === "text" && typeof c.body === "string" && /^(.+?)(이|가) 있어야 할 것 같다\.$/u.test(c.body) && sameName(/^(.+?)(이|가) 있어야/u.exec(c.body)![1]!, prev.gives!));
      if (hit < 0) return structuredClone(pg);
      touched = true;
      const next = structuredClone(cmds);
      const talkTo = ((prevRef.ev.pages ?? []) as unknown as RawPage[]).some((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; transparent?: boolean }; return Boolean(g.sprite) && g.transparent !== true; }) && !JSON.stringify(prevRef.ev.pages ?? []).includes('"battleProcessing"');
      next[hit] = { ...next[hit], body: `${next[hit]!.body} 먼저 ${where}「${prevName}」${talkTo ? "에게 말을 걸어야 한다." : `${josa(prevName, "을", "를")} 마쳐야 한다.`}` };
      return { ...structuredClone(pg), commands: next };
    });
    if (touched) ref.map.events = ref.map.events.map((e) => e.id === ref.ev.id ? { ...e, pages: pages as unknown as typeof e.pages } : e);
    if (touched) notes.push(`「${String((ref.ev as { name?: string }).name ?? ref.ev.id)}」 잠김 대사가 「${prevName}」 을 가리킨다`);
  });
  return notes;
}

/**
 * 싸워 이기는 단계는 이기면 끝난다 — 단계 이벤트의 넘어가는 페이지가 같은 맵 보스의 승리 스위치 W 를 조건으로 걸 때(gateBattleSteps·
 * 모델이 지은 고리), 그 보스의 승리 갈래(W 를 켜는 곳) 끝에서 단계 이벤트를 부른다(callMapEvent — 지금 켜진 페이지를 돈다).
 * 앞 단계가 안 됐으면 그 이벤트의 잠김 대사가 바로 뜨고, 됐으면 다음 목표·엔딩이 이어진다. 결정적·되풀이 안전(이미 부르면 그대로).
 * 왜(2026-10-30 sl2 opus jrpg 「무엇을 할지 모름」): 마왕을 이긴 뒤 「쓰러진 마왕 곁의 검은 기운에 빛의 검을 겨누자」 목표만 남았고,
 * 엔딩은 마왕 옆 칸 「마왕의 최후」(사람 그림)에게 다시 말을 걸어야 났다. 판정자는 동쪽 빛나는 구슬을 조사하다 시간이 끝났다.
 * jb1b terra(엔딩 닿음)도 승리 뒤 그 칸을 찾아 다시 눌러야 했다.
 */
export function finishStepOnBossVictoryIn(project: Project): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const notes: string[] = [];
  const won = victoryGatedSwitches(project);
  for (const step of bp.steps) {
    const map = mapFor(project, step.place);
    if (!map) continue;
    const ev = map.events.find((e) => e.id === step.event) ?? map.events.find((e) => norm(String((e as { name?: string }).name ?? "")) === norm(step.event))
      ?? map.events.find((e) => !e.id.startsWith("ev_objective") && sameName(String((e as { name?: string }).name ?? ""), step.event));
    if (!ev) continue;
    const gates = new Set<string>();
    for (const page of (ev.pages ?? []) as unknown as RawPage[]) {
      if (!pageMoves(page)) continue;
      for (const c of (page.conditions ?? []) as { kind?: string; switchId?: string; value?: unknown }[]) if (c.kind === "switch" && c.switchId && c.value !== false && won.has(c.switchId)) gates.add(c.switchId);
    }
    for (const w of gates) {
      const setsW = (list: unknown): boolean => Array.isArray(list) && list.some((c) => (c as { kind?: string; switchId?: string }).kind === "setSwitch" && (c as { switchId?: string }).switchId === w && (c as { value?: unknown }).value !== false);
      const calls = (list: unknown): boolean => Array.isArray(list) && list.some((c) => (c as { kind?: string; eventId?: string }).kind === "callMapEvent" && (c as { eventId?: string }).eventId === ev.id);
      for (const holder of map.events) {
        if (holder.id === ev.id || !JSON.stringify(holder.pages ?? []).includes('"battleProcessing"')) continue;
        let touched = false;
        // 승리 갈래(fork battleResult victory 의 then, battleProcessing 의 victoryBranch) 중 W 를 켜는 목록 끝에 부르기를 단다.
        const visit = (node: unknown): unknown => {
          if (Array.isArray(node)) return node.map(visit);
          if (!node || typeof node !== "object") return node;
          const cmd = { ...(node as Record<string, unknown>) };
          for (const [key, value] of Object.entries(cmd)) if (value && typeof value === "object") cmd[key] = visit(value);
          const isWinFork = cmd.kind === "fork" && (cmd.condition as { kind?: string; result?: string } | undefined)?.kind === "battleResult" && (cmd.condition as { result?: string }).result === "victory";
          const key = isWinFork ? "then" : cmd.kind === "battleProcessing" ? "victoryBranch" : undefined;
          if (key && setsW(cmd[key]) && !calls(cmd[key])) { cmd[key] = [...(cmd[key] as unknown[]), { kind: "callMapEvent", eventId: ev.id }]; touched = true; }
          return cmd;
        };
        const pages = visit(structuredClone(holder.pages ?? [])) as typeof holder.pages;
        if (!touched) continue;
        map.events = map.events.map((e) => e.id === holder.id ? { ...e, pages } : e);
        notes.push(`${String((holder as { name?: string }).name || holder.id)} 을 이기면 바로 「${String((ev as { name?: string }).name ?? ev.id)}」 단계가 이어진다`);
      }
    }
  }
  return notes;
}

/** 시작 파티가 이 정도도 못 이기면 «길을 막는 전투»가 아니라 막힌 길이다. */
const STEP_BATTLE_MIN_WIN = 0.5;

/**
 * 청사진 단계 맵의 «이겨야 넘어가는» 전투(도망 불가 또는 보스 이름)를 시작 파티·시작 레벨로 모의하고, 승률이 STEP_BATTLE_MIN_WIN 아래면
 * 그 전투를 시작 파티에 맞춘 사본 무리(fitTroopCopy — 원본 DB 적은 그대로)로 바꾼다. 결정적(모의 시드 고정)·되풀이 안전(맞춘 사본은 다시 안 맞춘다).
 * 왜(2026-10-29 vm1 argon·flash jrpg): 승리 관문을 건 뒤 옛 빌더의 마왕(Lv3, 승률 0)이 길을 막아 자동 플레이가 보스전 패배로 끝났다.
 */
export function fitUnwinnableStepBattles(run: BuildRun): string[] {
  return fitUnwinnableStepBattlesIn(run.ctx.project, (mapId, ev, pages) => run.call("upsert_event", { mapId, event: { ...structuredClone(ev), pages } as unknown as Record<string, unknown>, replacePages: true }));
}

/**
 * 끝맺음에서도 같은 맞추기를 한다 — 청사진 경로에 막힘이 없으면 buildBlueprintPath 가 돌지 않아,
 * 시작 파티로 못 이기는 보스가 그대로 나갔다(2026-10-29 vm3 flash jrpg: Lv1 로 Lv3 리치를 못 이겨 판정 「전투 못 이김」).
 */
export function fitUnwinnableStepBattlesIn(project: Project, write?: (mapId: string, ev: GameMap["events"][number], pages: RawPage[]) => void): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const put = write ?? ((mapId: string, ev: GameMap["events"][number], pages: RawPage[]) => {
    const live = project.maps[mapId]?.events.find((e) => e.id === ev.id);
    if (live) (live as { pages: unknown }).pages = pages;
  });
  if (project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) return [];
  const party = (project.system.startActorIds ?? []).filter((id) => project.database.actors.some((a) => a.id === id));
  if (!party.length) return [];
  const level = Math.max(1, ...party.map((id) => project.database.actors.find((a) => a.id === id)!.initialLevel ?? 1));
  const mapIds = [...new Set(bp.steps.map((step) => mapFor(project, step.place)?.id).filter((id): id is string => !!id))];
  const verdict = new Map<string, string | undefined>();
  const notes: string[] = [];
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const ev of map.events ?? []) {
      const text = JSON.stringify(ev.pages ?? []);
      if (!text.includes('"battleProcessing"')) continue;
      const pages = structuredClone(ev.pages ?? []) as unknown as RawPage[];
      let changed = false;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== "object") return;
        const cmd = node as Record<string, unknown>;
        if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") {
          const troopId = cmd.troopId;
          const gating = cmd.canEscape === false || /boss|보스|마왕/iu.test(`${ev.id} ${troopId} ${project.database.troops.find((t) => t.id === troopId)?.name ?? ""}`);
          if (gating) {
            if (!verdict.has(troopId)) {
              let replace: string | undefined;
              try {
                const sim = simulateBattle({ project, troopId, heroLevel: level, partyActorIds: party, n: 12, seed: 7, useSkills: true });
                if (sim.winRate < STEP_BATTLE_MIN_WIN) {
                  const fitted = fitTroopCopy(project, troopId, "boss");
                  if (fitted && fitted !== troopId) { replace = fitted; notes.push(`「${ev.name ?? ev.id}」 전투 ${troopId}(승률 ${Math.round(sim.winRate * 100)}%)를 시작 파티에 맞춘 ${fitted} 로`); }
                }
              } catch { /* 모의 실패는 그대로 둔다 */ }
              verdict.set(troopId, replace);
            }
            const replace = verdict.get(troopId);
            if (replace) { cmd.troopId = replace; changed = true; }
          }
        }
        for (const value of Object.values(cmd)) if (value && typeof value === "object") visit(value);
      };
      visit(pages);
      if (changed) put(mapId, ev, pages);
    }
  }
  return notes;
}
