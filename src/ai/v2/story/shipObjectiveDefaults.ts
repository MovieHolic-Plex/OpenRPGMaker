// 출하 기본값 — 목표 줄과 입구: 입구를 그림 위로, 사라진 대상을 가리키는 목표 지우기, 낡은 목표 채우기, 시작 목표 다듬기, 체육관 도착 목표.
import type { Project } from "@/project/types";
import { doorCellBlocked, offArtEntrances, sideQuestObjectives, staleMilestoneTargets } from "../judge/discoverability";
import { lateStartObjective, planObjective, repeatingStartObjectives } from "../judge/objectivePlan";
import { withWhere } from "../judge/objectiveWhere";
import { objectiveCommand } from "../judge/objectiveCommand";
import { Obj } from "./shipLookDefaults";

/**
 * 그려진 입구(계단·문짝) 옆 맨바닥에 선 문·이야기 이벤트를 그림 칸으로 옮긴다(offArtEntrances — 출하 검사와 같은 판정). 그 칸이 막힌 칸이면
 * 부딪혀 열리게(priority same, 겹침 금지). 다른 맵에서 그 칸으로 도착하는 이동이 있으면 옮기지 않는다(밟자마자 되돌아가는 왕복).
 */
export function moveEntrancesOntoArt(project: Project): string[] {
  const out: string[] = [];
  const arrivals = new Set<string>();
  const visit = (node: unknown, depth = 0): void => {
    if (depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    const o = node as Obj;
    if (o.kind === "transfer" && typeof o.mapId === "string") arrivals.add(`${o.mapId}|${String(o.x)},${String(o.y)}`);
    for (const value of Object.values(o)) if (value && typeof value === "object") visit(value, depth + 1);
  };
  for (const map of Object.values(project.maps)) visit(map.events ?? []);
  for (const ce of project.commonEvents ?? []) visit(ce);
  const start = { mapId: project.startMapId, x: project.startPos?.x, y: project.startPos?.y };
  for (const entry of offArtEntrances(project)) {
    const map = project.maps[entry.mapId];
    const event = map?.events.find((e) => e.id === entry.eventId);
    if (!map || !event) continue;
    if (arrivals.has(`${entry.mapId}|${entry.door.x},${entry.door.y}`)) continue;
    if (start.mapId === entry.mapId && start.x === entry.door.x && start.y === entry.door.y) continue;
    const blocked = doorCellBlocked(project, entry.mapId, entry.door.x, entry.door.y);
    event.x = entry.door.x;
    event.y = entry.door.y;
    if (blocked) for (const page of event.pages ?? []) { page.priority = "same"; page.overlapForbidden = true; }
    out.push(`입구 「${entry.name}」(${map.name || map.id}) (${entry.x},${entry.y}) → 그림 칸 (${entry.door.x},${entry.door.y})${blocked ? " · 부딪혀 열림" : ""}`);
  }
  return out;
}

/** 이 이벤트가 조건이 켜지면 사라지는가 — 조건 붙은 페이지가 그림 없음·아래 층·명령 없음(레버가 치우는 바위·열리는 덤불). */
function vanishesWhenRead(project: Project, mapId: string, eventId: string): boolean {
  const ev = project.maps[mapId]?.events.find((e) => e.id === eventId);
  return !!ev && (ev.pages ?? []).some((p) => {
    const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown; tileId?: number };
    const drawn = g.transparent !== true && Boolean(g.sprite || g.appearanceId || (typeof g.tileId === "number" && g.tileId > 0));
    return (p.conditions ?? []).length > 0 && !drawn && (p.priority ?? "same") !== "same" && !(p.commands ?? []).length;
  });
}

/**
 * 「「X」를 찾아가자」 목표가 그 이벤트가 켜자마자 사라지는 X(치워진 바위)를 가리키면 그 목표를 뗀다 — 아래 fillStaleObjectives 가 다음 대상으로 다시 건다.
 * 왜(2026-10-29 vm6 terra jrpg 판정 major): 레버를 당기자 목표가 「「막힌 바위」를 찾아가자」가 됐는데 바위는 그 레버로 굴러가 사라졌다 —
 * 판정자는 30분 동안 없는 바위를 찾았고 바로 곁의 「동굴의 봉인」을 못 찾았다.
 */
function dropVanishedTargetObjectives(project: Project): string[] {
  const out: string[] = [];
  const steps = project.gameBlueprint?.steps ?? [];
  // 다시 걸 대상(같은 맵의 청사진 단계)이 없는 맵에서는 떼지 않는다 — 떼면 목표 없는 이정표가 남는다(vm3 terra 「지하 던전」 레버).
  const hasStep = (map: Project["maps"][string], self: string) => steps.some((step) => (map.events ?? []).some((e) => e.id !== self && (e.id === step.event || e.name === step.event)));
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    if (!hasStep(map, ev.id)) continue;
    const cmds = page.commands ?? [];
    const written = new Set<string>();
    for (const c of cmds as unknown as Record<string, unknown>[]) if (c.kind === "setSwitch" && c.value === true) written.add(`sw:${String(c.switchId)}`);
    if (!written.size) continue;
    const keep = (cmds as unknown as Record<string, unknown>[]).filter((c) => {
      if (c.kind !== "m2Command" || c.commandId !== "m2-214-ui-command") return true;
      const name = /^「([^」]+)」[을를] 찾아가자/u.exec(String((c.fields as Record<string, unknown> | undefined)?.message ?? ""))?.[1];
      if (!name) return true;
      const hits = (map.events ?? []).filter((o) => o.id !== ev.id && String(o.name ?? "") === name);
      const gone = hits.length > 0 && hits.every((o) => vanishesWhenRead(project, map.id, o.id) && (o.pages ?? []).some((p) => (p.conditions ?? []).some((cond) => { const r = cond as { kind?: string; switchId?: string; value?: boolean }; return r.kind === "switch" && r.value !== false && written.has(`sw:${r.switchId}`); })));
      if (gone) out.push(`목표 「「${name}」 찾아가자」(${ev.name ?? ev.id}) 는 이 이벤트가 치우는 대상이라 뗌`);
      return !gone;
    });
    if (keep.length !== cmds.length) page.commands = keep as unknown as typeof page.commands;
  }
  return out;
}

/**
 * 곁 퀘스트의 진행 페이지(수락 · 도착 칸 · 완료)에 걸린 「「X」를 찾아가자」 목표를 뗀다 — 이 파일의 fillStaleObjectives 가 예전에 건 것이다.
 * 곁 퀘스트는 본편 「현재 목표」 줄을 바꾸지 않는다: 도착 칸을 밟자 본편 목표가 「「사미라」를 찾아가자」 로 바뀌어 화살표가 온 길을 가리켰다.
 * 모델이 set_objective 로 직접 건 글(「찾아가자」 꼴이 아닌 것)은 그대로 둔다.
 */
function dropSideQuestObjectives(project: Project): string[] {
  const out: string[] = [];
  for (const hit of sideQuestObjectives(project)) {
    if (!/^「[^」]+」[을를] 찾아가자/u.test(hit.message)) continue;
    const at = hit.list.indexOf(hit.command);
    if (at < 0) continue;
    hit.list.splice(at, 1);
    out.push(`곁 퀘스트 페이지(${hit.eventId})의 목표 「${hit.message.slice(0, 30)}」 뗌 — 본편 목표 줄을 덮어쓰지 않게`);
  }
  return out;
}

/**
 * 이야기를 한 단계 넘기면서 다음 목표를 안 바꾸는 이정표 이벤트(objectiveGaps)에 다음 목표를 건다 — 청사진 다음 단계 이벤트가 있으면 그것,
 * 없으면 이 이벤트가 켠 스위치·준 아이템을 읽는 첫 이벤트를 「찾아가자」로. 거는 자리·「어디」 힌트는 set_objective 와 같은 planObjective.
 * 다음 대상을 모르면(엔딩 정의만 읽는다) 건너뛴다.
 */
export function fillStaleObjectives(project: Project): string[] {
  const out: string[] = [];
  const steps = project.gameBlueprint?.steps ?? [];
  const object = (word: string): string => `${word}${hasFinal(word.replace(/[」』"”')\]\s]+$/u, "")) ? "을" : "를"}`;
  out.push(...dropVanishedTargetObjectives(project));
  out.push(...dropSideQuestObjectives(project));
  const stepEventName = (ref: string) => Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === ref || e.name === ref).map((e) => String(e.name ?? e.id))).at(0);
  for (const { event, readers } of staleMilestoneTargets(project)) {
    const k = steps.findIndex((step) => step.event === event.eventId || step.event === event.name);
    const nextStep = k >= 0 ? steps[k + 1] : undefined;
    const stepTarget = nextStep ? stepEventName(nextStep.event) : undefined;
    // 켜면 사라지는 장애물(레버가 치우는 「막힌 바위」)은 찾아갈 대상이 아니다 — 치운 뒤엔 그 자리에 아무것도 없다.
    const live = readers.filter((r) => !vanishesWhenRead(project, r.mapId, r.eventId));
    // 청사진 밖 장치(레버)면 같은 맵의 청사진 단계 대상으로 — 길이 열린 뒤 할 일은 그 단계다.
    const sameMapStep = k < 0 ? steps.map((step) => (project.maps[event.mapId]?.events ?? []).find((e) => e.id === step.event || e.name === step.event)).find((e) => !!e && e.id !== event.eventId) : undefined;
    const liveNamed = live.find((r) => r.name && !/^ev_/u.test(r.name));
    const target = stepTarget ?? liveNamed?.name ?? (sameMapStep ? String(sameMapStep.name ?? sameMapStep.id) : undefined);
    if (!target) continue;
    // 목표가 가리킬 이벤트를 함께 싣는다 — 이름이 같은 다른 이벤트가 있어도 표시는 이 이벤트에 선다(다음 단계 이벤트 · 이 이벤트가 켠 것을 읽는 이벤트 · 같은 맵 단계).
    const builtNext = nextStep?.built && (project.maps[nextStep.built.mapId]?.events ?? []).some((e) => e.id === nextStep.built!.eventId) ? { mapId: nextStep.built.mapId, eventId: nextStep.built.eventId } : undefined;
    const stepEvent = builtNext ?? (nextStep ? Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === nextStep.event || e.name === nextStep.event).map((e) => ({ mapId: m.id, eventId: e.id }))).at(0) : undefined);
    const aim = stepTarget ? stepEvent : liveNamed ? { mapId: liveNamed.mapId, eventId: liveNamed.eventId } : sameMapStep ? { mapId: event.mapId, eventId: sameMapStep.id } : undefined;
    const plan = planObjective(project, { text: `${object(`「${target}」`)} 찾아가자`, eventId: event.eventId, mapId: event.mapId, ...(aim ? { target: aim } : {}) });
    if (!plan.ok) continue;
    for (const { mapId, event: next } of plan.events) {
      const map = project.maps[mapId];
      if (!map) continue;
      map.events = map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e);
    }
    out.push(`다음 목표: ${event.name} 뒤 → 「${target}」`);
  }
  return out;
}

/**
 * 필드 안내(주인공 곁 화살표 · 목표 대상의 빛무리 · 머리 위 ▼ · 목표 글의 「어디」 꼬리)는 끈 채로 출하한다 — 켜기·끄기를 아무도 고르지 않았을 때만.
 * 끄는 것은 그리기뿐이다: 목표 명령의 글과 대상(target)은 그대로 두어 자동 플레이·검사가 같은 대상을 따라가고, 켜면(set_project_settings{fieldGuides:"on"} ·
 * 자료집 「필드 안내 표시」) 그대로 돌아온다. 왜: 화살표로 길을 다 알려 주는 게임은 걷는 일이 남지 않는다(오너 2026-10-30 · 2026-11-12).
 */
export function quietFieldGuides(project: Project): string[] {
  if (project.system.fieldGuides !== undefined) return [];
  project.system.fieldGuides = "off";
  return ["필드 안내 끔(화살표·대상 표식·목표 글의 「어디」 꼬리 — 목표 문장만 보인다)"];
}

/**
 * 맵에 들어올 때마다 도는 페이지(장면 분위기)에 걸린 시작 목표를 한 번만 도는 자리로 옮긴다(planObjective at:start 가 그 페이지에서 빼고 다시 건다).
 * 왜(2026-10-29 vm2 deepseek 방탈출 A6): 열쇠를 얻고 저장 → 불러오기 하자 분위기 페이지가 다시 돌며 「일지를 읽자」로 되돌렸다.
 */
export function moveRepeatingStartObjective(project: Project): string[] {
  const first = repeatingStartObjectives(project)[0];
  if (!first) return [];
  const plan = planObjective(project, { at: "start", text: first.message });
  if (!plan.ok) return [];
  for (const { mapId, event: next } of plan.events) {
    const map = project.maps[mapId];
    if (!map) continue;
    const has = map.events.some((e) => e.id === next.id);
    map.events = has ? map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e) : [...map.events, next as unknown as (typeof map.events)[number]];
  }
  return [`시작 목표를 매번 도는 「${first.eventId}」에서 옮김: ${plan.summary}`];
}

/** 뒤 단계를 말하는 시작 목표(lateStartObjective)를 첫 단계 할 일로 되돌린다 — 자리 힌트는 planObjective 가 첫 단계 이벤트로 붙인다. */
export function pullBackStartObjective(project: Project): string[] {
  const late = lateStartObjective(project);
  if (!late) return [];
  const plan = planObjective(project, { at: "start", text: late.first });
  if (!plan.ok) return [];
  for (const { mapId, event: next } of plan.events) {
    const map = project.maps[mapId];
    if (!map) continue;
    const has = map.events.some((e) => e.id === next.id);
    map.events = has ? map.events.map((e) => e.id === next.id ? next as unknown as typeof e : e) : [...map.events, next as unknown as (typeof map.events)[number]];
  }
  return [`시작 목표 「${late.message}」 는 뒤 단계 일이라 첫 단계로: ${plan.summary}`];
}

/**
 * 몬스터 원정의 체육관 마을에 들어서면 「현재 목표」가 그 체육관을 가리킨다 — 배지마다(monsterCampaign.badges) 그 마을(cityMapId)로 들어오는
 * 다른 원정 장소(locations: 길·마을·던전·리그)의 이동 명령 앞에, 배지 목표(objectives 의 switchId = 배지 스위치)의 앞 조건이 켜지고 배지는 아직일 때 목표 글(방위 붙임)을 건다.
 * 왜(2026-10-29 standin monster 「새싹 몬스터 모험」): 박사가 건 「1번길 풀숲에서 몬스터를 잡고 새순 마을로 가자」가 마을에 와서도 그대로였고,
 * 체육관을 가리키는 목표는 길가 라이벌(말을 걸지 않아도 되는 이벤트)만 걸었다. 같은 프로젝트에 두 번 불러도 결과가 같다.
 */
export function fillGymArrivalObjectives(project: Project): string[] {
  const campaign = project.system.monsterCampaign;
  if (!campaign?.badges?.length) return [];
  const out: string[] = [];
  for (const badge of campaign.badges) {
    const objective = campaign.objectives?.find((o) => o.switchId === badge.switchId);
    const city = project.maps[badge.cityMapId];
    if (!objective || !city) continue;
    const message = withWhere(project, city.id, objective.title.trim().replace(/[.。]$/u, ""));
    const conditions: Obj[] = [{ kind: "switch", switchId: badge.switchId, value: false }];
    if (objective.requiresSwitchId) conditions.unshift({ kind: "switch", switchId: objective.requiresSwitchId, value: true });
    const guard = (): Obj => ({ kind: "fork", condition: conditions.length > 1 ? { kind: "all", conditions } : conditions[0], then: [objectiveCommand(message)] });
    const already = (cmd: unknown): boolean => !!cmd && typeof cmd === "object" && (cmd as Obj).kind === "fork" && JSON.stringify((cmd as Obj).then ?? []).includes(JSON.stringify(message));
    let placed = 0;
    const visit = (list: unknown[]): void => {
      for (let i = 0; i < list.length; i += 1) {
        const cmd = list[i] as Obj | undefined;
        if (!cmd || typeof cmd !== "object") continue;
        for (const value of Object.values(cmd)) {
          if (Array.isArray(value)) visit(value);
          else if (value && typeof value === "object") for (const inner of Object.values(value as Obj)) if (Array.isArray(inner)) visit(inner);
        }
        if (cmd.kind === "transfer" && cmd.mapId === city.id && !already(list[i - 1])) {
          list.splice(i, 0, guard());
          i += 1;
          placed += 1;
        }
      }
    };
    // 원정 장소(길·다른 마을·던전)에서 들어올 때만 — 마을 안 건물(센터·상점·체육관)에서 나올 때 덮으면 라이벌·체육관 장치가 건 더 자세한 목표가 지워진다.
    const from = new Set(campaign.locations.map((location) => location.mapId).filter((id) => id !== city.id));
    for (const map of Object.values(project.maps)) {
      if (!from.has(map.id)) continue;
      for (const event of map.events ?? []) for (const page of event.pages ?? []) if (Array.isArray(page.commands)) visit(page.commands as unknown[]);
    }
    if (placed) out.push(`체육관 마을 「${city.name ?? city.id}」에 들어서면 목표 「${message}」(이동 ${placed}곳)`);
  }
  return out;
}

// ── 엔딩 마무리 ─────────────────────────────────────────────────────────

export const hasFinal = (word: string): boolean => { const c = word.trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
