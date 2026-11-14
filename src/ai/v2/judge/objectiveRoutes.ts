// 목표 꼬리 다시 맞추기 — 이미 걸린 목표의 「어디」를 지금 맵·도착 칸 기준으로 고쳐 쓴다(끝맺음 objective-routes 단계). 목표가 읽히는 착지 자리와 이정표 뒤 끼워 넣기도 여기.
import { allPages, childLists, visitPageCommands, type RawCommand } from "@/qa/gameCheck/walk";
import type { GameMap, Project } from "@/project/types";
import { mapRoute } from "@/player/objectiveTarget";
import { josa } from "@/util/josa";
import { objectiveCommand, isObjectiveCommand, objectiveTargetOf, setObjectiveTarget, type ObjectiveTarget } from "./objectiveCommand";
import { Cell, landmarkWord, bare, withWhere } from "./objectiveWhere";
import { stepGoal } from "../story/playerLines";

/**
 * 전투 승리 스위치로 잠긴 이벤트 → 그 스위치를 켜는 전투 이벤트(같은 맵·다른 맵). 잠김 = 그 스위치를 조건으로 단 페이지와 달지 않은
 * 페이지가 함께 있다(gateBattleSteps 의 「아직 못 이김」). 켜는 쪽 = battleProcessing 과 그 스위치 켜기를 함께 가진 다른 이벤트.
 * 켜는 쪽 이름이 비었으면 부대 이름으로 채운다(제자리 수정).
 */
function battleGateHolders(project: Project): Map<string, { switchId: string; holder: { map: GameMap; event: GameMap["events"][number] } }> {
  const setters = new Map<string, { map: GameMap; event: GameMap["events"][number]; troopId?: string }>();
  for (const ref of allPages(project)) {
    let troopId: string | undefined;
    const sets: string[] = [];
    visitPageCommands(ref, ({ command }) => {
      if (command.kind === "battleProcessing") troopId ??= String(command.troopId ?? "");
      if (command.kind === "setSwitch" && command.value === true && typeof command.switchId === "string") sets.push(command.switchId);
    });
    if (troopId !== undefined && ref.map && ref.event) for (const id of sets) if (!setters.has(id)) setters.set(id, { map: ref.map!, event: ref.event!, troopId });
  }
  const out = new Map<string, { switchId: string; holder: { map: GameMap; event: GameMap["events"][number] } }>();
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const pages = event.pages ?? [];
    for (const [switchId, setter] of setters) {
      if (setter.event.id === event.id) continue;
      const has = (page: (typeof pages)[number]) => (page.conditions ?? []).some((c) => (c as { switchId?: string }).switchId === switchId);
      if (!pages.some(has) || pages.every(has)) continue;
      if (!String(setter.event.name ?? "").trim()) {
        const troop = project.database.troops.find((t) => t.id === setter.troopId);
        if (troop?.name) (setter.event as { name?: string }).name = troop.name;
      }
      // 이름 없는 전투 이벤트도 남긴다 — 목표 글은 이름이 있어야 고쳐 쓰지만, 목표가 가리키는 대상(target)은 이름이 없어도 그 전투다.
      out.set(event.id, { switchId, holder: { map: setter.map, event: setter.event } });
      break;
    }
  }
  return out;
}

/**
 * 「(<맵> 입구: …)」 꼬리를 지금 맵 연결로 다시 쓴다(끝맺음 조립에서 한 번, 모델 없음).
 * 목표 글은 짓는 도중에 걸리고 문·맵은 그 뒤에도 바뀐다 — 마지막 상태에서 «목표가 걸리는 자리에서 본 첫 출구» 방위와
 * 그 뒤 대상(다음 청사진 단계 이벤트)을 다시 붙인다. 바꾼 목표 수를 돌려준다.
 * 대상 이벤트가 전투 승리 스위치로 잠겨 있으면(gateBattleSteps: 「마왕과의 결전」은 보스를 이긴 뒤에만 넘어간다) 목표는 그 전투를 가리킨다 —
 * 2026-10-29 vm2 terra jrpg: 「동굴의 흔적」 뒤 목표가 「(마왕과의 결전)」 이라 표시가 바로 옆(1칸) 결전 이벤트를 짚었고, 진짜 할 일인
 * 마왕(27,9)은 이름이 없어 아무 표시도 받지 못했다. 이름 없는 보스 이벤트에는 부대 이름을 붙인다(런타임 표시는 이름으로 짚는다).
 */
export function refreshObjectiveRoutes(project: Project): number {
  const holders = battleGateHolders(project);
  const landings = objectiveLandings(project);
  const steps = project.gameBlueprint?.steps ?? [];
  const find = (ref: string | undefined) => {
    if (!ref) return undefined;
    for (const map of Object.values(project.maps)) {
      const event = (map.events ?? []).find((e) => e.id === ref || e.name === ref);
      if (event) return { map, event };
    }
    return undefined;
  };
  // 청사진 단계의 이벤트 — 빌더가 지은 것을 적어 두었으면(step.built) 그것, 아니면 이름·id 로 찾는다.
  // 지어 둔 이벤트가 그 뒤 지워졌으면(맵을 다시 지음) 이름으로 돌아간다.
  const builtEvent = (step: (typeof steps)[number] | undefined) => {
    const map = step?.built ? project.maps[step.built.mapId] : undefined;
    const event = map?.events?.find((e) => e.id === step?.built?.eventId);
    return map && event ? { map, event } : undefined;
  };
  const isStepEvent = (step: (typeof steps)[number], mapId: string, event: GameMap["events"][number]): boolean => {
    const built = builtEvent(step);
    return built ? built.event.id === event.id && built.map.id === mapId : step.event === event.id || step.event === event.name;
  };
  const findStep = (step: (typeof steps)[number] | undefined) => builtEvent(step) ?? find(step?.event);
  let changed = 0;
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    const stepIndexes = steps.flatMap((step, index) => (isStepEvent(step, map.id, event) ? [index] : []));
    const k = stepIndexes[0] ?? -1;
    for (const page of event.pages ?? []) {
      const opening = map.id === project.startMapId && ["auto", "parallel"].includes(String((page.trigger as { kind?: string } | undefined)?.kind));
      const pageOrigin: Cell = opening && project.startPos ? project.startPos as Cell : { x: event.x, y: event.y };
      const stepNext = k >= 0 ? findStep(steps[k + 1]) : opening ? findStep(steps[0]) : undefined;
      // 이 페이지가 이미 그 승리 뒤에만 도는 페이지면(보스 자신·승리 조건 페이지) 잠금 대상을 그대로 가리킨다.
      const pageSwitches = new Set((page.conditions ?? []).map((c) => String((c as { switchId?: string }).switchId ?? "")));
      // 글을 고쳐 쓸 때는 이름 있는 전투만(이름 없는 대상을 글에 넣을 수 없다), 대상(target)은 이름이 없어도 그 전투.
      // 같은 사람이 여러 단계를 맡은 이벤트(촌장: 첫 단계와 마지막 단계)는 뒤 단계의 페이지만 그 승리 뒤에 열린다 — 그 이벤트가 맡은 첫 단계를 가리키는 목표는 전투로 돌리지 않는다
      // (2026-11-13: 시작 목표 「촌장에게 …」 가 마지막 보스를 가리켰다).
      const meant = k >= 0 ? k + 1 : opening ? 0 : -1;
      const battleFor = (target: { map: GameMap; event: GameMap["events"][number] } | undefined) => {
        const served = target ? steps.flatMap((step, index) => (isStepEvent(step, target.map.id, target.event) ? [index] : [])) : [];
        if (served.length > 1 && served[0] === meant) return undefined;
        const gate = target ? holders.get(target.event.id) : undefined;
        return gate && gate.holder.event.id !== event.id && !pageSwitches.has(gate.switchId) ? gate.holder : undefined;
      };
      const holderFor = (target: { map: GameMap; event: GameMap["events"][number] } | undefined) => {
        const holder = battleFor(target);
        return holder && String(holder.event.name ?? "").trim() ? holder : undefined;
      };
      const next = holderFor(stepNext) ?? stepNext;
      // 단계 목표(글이 다음 단계의 할 일 그대로 — stepObjectives 가 건 것)가 가리킬 이벤트 = 다음 단계를 넘기는 이벤트.
      // 같은 이벤트가 여러 단계를 맡으면 어느 페이지의 목표인지 알 수 없어 묶지 않는다.
      const advance = stepNext && stepNext.event.id !== event.id && stepIndexes.length <= 1 ? stepNext : undefined;
      // 단계 목표의 글 = 그 단계의 목표 줄(stepGoal). 옛 빌드는 action 을 그대로 걸었다 — 둘 다 알아본다.
      const nextStepOf = k >= 0 ? steps[k + 1] : opening ? steps[0] : undefined;
      const stepTexts = [nextStepOf ? stepGoal(nextStepOf) : undefined, nextStepOf?.action, opening && k < 0 ? project.gameBlueprint?.playerGoal : undefined]
        .filter((t): t is string => typeof t === "string").map((t) => t.trim().replace(/[.。!]+$/u, "").slice(0, 60));
      /** 대상이 싸워 이겨야 열리는 이벤트면 그 전투(이름이 없어도)로. */
      const throughBattle = (target: ObjectiveTarget): ObjectiveTarget => {
        const at = project.maps[target.mapId]?.events?.find((e) => e.id === target.eventId);
        const battle = at ? battleFor({ map: project.maps[target.mapId]!, event: at }) : undefined;
        return battle ? { mapId: battle.map.id, eventId: battle.event.id } : target;
      };
      const visit = (list: RawCommand[]): void => {
        for (const command of list) {
          for (const child of childLists(command)) { const raw = rawChild(command, child.key); if (raw) visit(raw); }
          if (!isObjectiveCommand(command)) continue;
          // 대상 묶기: 단계 목표(와 같은 글의 시작 목표)는 다음 단계를 넘기는 이벤트를 든다. 그 밖의 목표는 건 쪽이 적은 대상을 두되 없어진 이벤트면 뗀다.
          // 용의자 목표처럼 다른 것을 말하는 목표에 다음 단계를 묶으면 표시가 글과 다른 곳에 선다 — 글이 단계의 할 일 그대로일 때만 묶는다.
          {
            const text0 = String((command.fields as Record<string, unknown>).message ?? "").replace(/\s*\([^()]*\)\s*$/u, "").trim().replace(/[.。!]+$/u, "").slice(0, 60);
            const had = objectiveTargetOf(command);
            const alive = had && (project.maps[had.mapId]?.events ?? []).some((e) => e.id === had.eventId) ? had : undefined;
            const bound = advance && stepTexts.includes(text0) ? { mapId: advance.map.id, eventId: advance.event.id } : alive;
            if (setObjectiveTarget(command, bound ? throughBattle(bound) : undefined)) changed += 1;
          }
          const fields = command.fields as Record<string, unknown>;
          const message = String(fields.message ?? "");
          const landing = landings.get(command);
          const from = landing?.mapId ?? map.id;
          const origin = landing ? { x: landing.x, y: landing.y } : pageOrigin;
          const tail = /\s*\(([^()]*?)\s*입구:[^()]*\)\s*$/u.exec(message);
          if (!tail) {
            // 같은 맵 꼬리 「(마왕과의 결전)」 또는 글에 잠긴 이벤트 이름이 나오면 그 잠금을 여는 전투로 돌린다.
            // 「(북서쪽)」 처럼 방위 한 낱말만 있는 꼬리는 꼬리가 없는 것으로 본다 — 다른 맵 입구까지 이어 주는 꼬리로 다시 쓴다
            // (2026-10-29 vm4 deepseek jrpg: 「…돌문에 동굴 열쇠를 쓰자 (북서쪽)」 — 돌문은 동굴 맵 안이고 마을 입구는 언덕 아래 길로만 닿았다).
            const tail0 = /\s*\(([^()]*)\)\s*$/u.exec(message);
            const plainTail = tail0 && !/^(?:북|남|동|서|북동|북서|남동|남서|가운데)쪽?$/u.test(tail0[1]!.trim()) ? tail0 : null;
            const base = tail0 ? message.slice(0, tail0.index).trimEnd() : message;
            const gated = [...holders.keys()].map((id) => find(id)).find((ref) => ref && bare(String(ref.event.name ?? "")).length >= 2
              && (plainTail ? bare(plainTail[1]!) === bare(String(ref.event.name)) : bare(base).includes(bare(String(ref.event.name)))));
            const holder = holderFor(gated);
            if (!gated || !holder) {
              // 꼬리 없는 목표가 글에 나온 이벤트·장소로 「어디」를 붙일 수 있으면 붙인다 — 출하 검사 objective-missing 과 같은 판정(withWhere).
              // 2026-10-29 vm1 argon jrpg: 보스에 「마왕」 이름이 붙은 뒤 「마왕과 최후의 결전을 벌여 승리한다」(동굴의 문 이벤트) 가
              // 「(시작 마을 입구: 남쪽 → 마왕의 방 · 마왕)」 을 붙일 수 있게 됐는데, 위 가지는 잠긴 이벤트 이름을 담은 글만 고쳐 출하 검사가 남았다.
              if (plainTail) {
                // 시작 목표 꼬리 첫 조각이 어느 이벤트·맵 이름도 아니면(「(동굴 입구 도착 / 회복의 샘: …)」 — 지운 옛 단계 이름) 첫 청사진 단계 대상과 그 자리로 바꾼다.
                // 왜(2026-10-29 vm8 flash jrpg): 시작 목표가 없는 「동굴 입구 도착」을 가리켜, 판정자는 먼저 얻어야 할 「동굴 열쇠」를 모른 채 잠긴 동굴 문부터 갔다.
                const parts = plainTail[1]!.split(/\s*\/\s*/u);
                const head = parts[0]!.replace(/:.*$/u, "").trim();
                const known = Object.values(project.maps).some((m) => bare(String(m.name ?? "")) === bare(head) || (m.events ?? []).some((e) => bare(String(e.name ?? "")) === bare(head)));
                const first = opening ? find(steps[0]?.event) : undefined;
                if (!known && first && head.length >= 2) {
                  const spot = first.map.id === from ? landmarkWord(project, first.map, first.event.x, first.event.y, first.event.id) : `${first.map.name ?? first.map.id}`;
                  const updated = `${base} (${String(first.event.name ?? steps[0]!.event)}: ${spot}${parts.length > 1 ? ` / ${parts.slice(1).join(" / ")}` : ""})`;
                  if (updated !== message) { fields.message = updated; changed += 1; }
                } else if (known && first && first.map.id === from && !parts[0]!.includes(":") && bare(head) === bare(String(first.event.name ?? ""))) {
                  // 첫 단계 대상 이름만 있고 어디인지 없으면(「(마을 주민)」) 그 자리를 눈에 띄는 것에 기대어 붙인다(2026-10-29 vm8 terra jrpg «경고 전할 사람을 못 찾음»).
                  const spot = landmarkWord(project, first.map, first.event.x, first.event.y, first.event.id);
                  const updated = `${base} (${head}: ${spot}${parts.length > 1 ? ` / ${parts.slice(1).join(" / ")}` : ""})`;
                  if (updated !== message) { fields.message = updated; changed += 1; }
                }
                continue;
              }
              let updated = withWhere(project, from, base, undefined, origin);
              // 글에서 어디를 못 찾으면 다음 청사진 단계가 다른 맵에 있을 때 그 맵 입구로 — 이 목표를 거는 단계 다음이 곧 갈 곳이다.
              if (updated === base && next && next.map.id !== from) updated = withWhere(project, from, base, next.event.id, origin);
              if (updated === base && tail0) updated = message;
              if (updated !== message) { fields.message = updated; changed += 1; }
              continue;
            }
            const holderName = String(holder.event.name ?? "");
            // 글이 잠긴 이벤트 이름을 담으면(런타임은 글에 나온 더 긴 이름을 고른다) 전투를 부르는 글로 바꾼다.
            const text = bare(base).includes(bare(String(gated.event.name))) ? `${holderName}${josa(holderName, "을/를")} 쓰러뜨리자` : base;
            const updated = withWhere(project, from, text, holder.event.id, origin);
            if (updated !== message) { fields.message = updated; changed += 1; }
            continue;
          }
          const named = Object.values(project.maps).find((m) => bare(m.name ?? "") === bare(tail[1]!));
          if (!named) continue;
          const base = message.slice(0, tail.index).trimEnd();
          // 글이 이름을 댄 대상 · 목표를 걸 때 묶은 대상(꼬리의 이름)이 먼저다 — 함수가 단계 사이에 끼운 고리(번호 쪽지)는 청사진 단계가 아니라서,
          // 다음 단계만 보면 「번호 쪽지를 살펴보자」 의 표시가 그다음 단계(봉인)에 섰다.
          const bound = boundTarget(project, base, message.slice(tail.index), from, event.id);
          // 묶은 대상이 없으면: 다음 단계 이벤트가 그 입구 맵(또는 그 맵을 거쳐 가는 곳)에 있으면 그 이벤트를, 아니면 입구 맵을 가리킨다.
          const route = next && next.map.id !== from ? mapRoute(project, from, next.map.id) : undefined;
          const where = bound ? bound.id : next && (next.map.id === from || route?.includes(named.id)) ? next.event.id : named.id;
          const updated = withWhere(project, from, base, where, origin);
          // 옮긴 뒤 맵이 바로 그 입구 맵이면 「입구」 꼬리는 틀린 말이다 — 꼬리 없는 글(이름이 이미 글에 있으면)도 쓴다.
          if (updated !== message && (updated !== base || from === named.id)) { fields.message = updated; changed += 1; }
        }
      };
      visit((page.commands as RawCommand[] | undefined) ?? []);
    }
  }
  return changed;
}

/**
 * 목표의 대상 이벤트 — 글이 «무엇을·누구에게» 로 이름을 댄 이벤트가 하나뿐이면 그것(「번호 쪽지를 살펴보자」 → 번호 쪽지),
 * 아니면 꼬리 맨 끝이 이름을 댄 이벤트(「… → 번호 쪽지」 · 「… → 맵 · 번호 쪽지」 — 목표를 걸 때 묶은 대상). 둘 다 없으면 undefined.
 * 「파리드가 말한 …」 처럼 지나가며 부른 이름은 대상이 아니다(을·를·에게·한테·께 가 붙은 이름만). 목표를 거는 이벤트 자신과 목표·이동 이벤트는 뺀다.
 */
function boundTarget(project: Project, base: string, tail: string, fromMapId: string, selfId: string): GameMap["events"][number] | undefined {
  const events = Object.values(project.maps).flatMap((map) => (map.events ?? []).map((ev) => ({ map, ev, name: bare(String(ev.name ?? "")) })))
    .filter((r) => r.ev.id !== selfId && !r.ev.id.startsWith("ev_objective") && !r.ev.id.startsWith("ev_gate_") && r.name.length >= 2)
    .sort((a, b) => Number(b.map.id === fromMapId) - Number(a.map.id === fromMapId));
  const text = bare(base);
  const aimed = [...new Set(events.filter((r) => ["을", "를", "에게", "한테", "께"].some((p) => text.includes(`${r.name}${p}`))).map((r) => r.name))];
  const whole = aimed.filter((n) => !aimed.some((o) => o !== n && o.includes(n)));
  if (whole.length === 1) return events.find((r) => r.name === whole[0])!.ev;
  const label = bare((/→\s*([^→()]+?)\s*\)\s*$/u.exec(tail)?.[1] ?? "").split("·").at(-1) ?? "");
  return label.length >= 2 ? events.find((r) => r.name === label)?.ev : undefined;
}

/**
 * 목표 명령 뒤 같은 목록에 옮기기(transfer)가 오면 그 목표는 옮긴 뒤 맵에서 읽힌다 — 「어디」는 그 맵·도착 칸에서 본다.
 * 2026-10-29 vm1 argon jrpg: 동굴 「마왕의 문 열기」 가 목표를 건 뒤 마왕의 방으로 옮기는데, 동굴에서 본 「(마왕의 방 입구: 바로 옆)」 이 붙었다.
 */
export function objectiveLandings(project: Project): WeakMap<object, { mapId: string; x: number; y: number }> {
  const out = new WeakMap<object, { mapId: string; x: number; y: number }>();
  const walk = (list: readonly RawCommand[]): void => {
    list.forEach((command, i) => {
      for (const child of childLists(command)) walk(child.list);
      if (!isObjectiveCommand(command)) return;
      const t = list.slice(i + 1).find((c) => c.kind === "transfer" && typeof c.mapId === "string" && project.maps[c.mapId as string]);
      if (t) out.set(command, { mapId: String(t.mapId), x: Number(t.x ?? 0), y: Number(t.y ?? 0) });
    });
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) walk(Array.isArray(page.commands) ? page.commands as unknown as RawCommand[] : []);
  return out;
}

const isMilestoneWrite = (command: RawCommand): boolean =>
  command.kind === "setSwitch" ? command.value === true : command.kind === "changeItem" ? command.op !== "-=" : false;

/** childLists 가 돌려주는 목록은 사본이다 — 넣기는 원본 배열에 해야 하므로 키로 원본을 다시 찾는다(탐지와 같은 분기를 걷는다). */
export function rawChild(command: RawCommand, key: string): RawCommand[] | undefined {
  const option = /^options\[(\d+)\]\.branch$/u.exec(key);
  const value = option ? (command.options as Record<string, unknown>[] | undefined)?.[Number(option[1])]?.branch : command[key];
  return Array.isArray(value) ? value as RawCommand[] : undefined;
}

/** 명령 목록 안에서 이정표 쓰기 바로 뒤(같은 목록)에 목표 명령을 넣는다. 이미 같은 글의 목표가 있으면 그 자리를 바꾼다. 넣은 수. */
export function insertAfterMilestones(list: RawCommand[], message: string, target?: ObjectiveTarget): number {
  let placed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const command = list[i]!;
    for (const child of childLists(command)) {
      const raw = rawChild(command, child.key);
      if (raw) placed += insertAfterMilestones(raw, message, target);
    }
  }
  let last = -1;
  list.forEach((command, i) => { if (isMilestoneWrite(command)) last = i; });
  if (last < 0) return placed;
  const next = list[last + 1];
  if (next && isObjectiveCommand(next)) { list[last + 1] = objectiveCommand(message, target); return placed + 1; }
  list.splice(last + 1, 0, objectiveCommand(message, target));
  return placed + 1;
}
