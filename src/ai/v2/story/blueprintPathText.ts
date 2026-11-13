// 청사진 경로의 글 — 모델이 쓴 단계 글 간직하기(keepStepText)·검사(pathTextProblems), 번호 알리는 줄, 단계 목표 줄(stepObjectives).
import { digitWord } from "./codeClues";
import type { Project } from "@/project/types";
import { normalizeStepText, type GameBlueprint } from "@/project/gameBlueprint";
import type { BuildRun } from "../shared/types";
import { planObjective } from "../judge/objectivePlan";
import { OBJECTIVE_SURFACE } from "../judge/objectiveCommand";
import { PathStepText, norm, mapFor, josa, lookLine } from "./blueprintPathNames";

/** 청사진에 남긴 그 단계의 글. */
export function storedStepText(bp: GameBlueprint, id: string): PathStepText | undefined {
  const text = bp.steps.find((st) => st.id === id)?.text;
  return text ? { id, ...text } : undefined;
}

/**
 * 받은 글을 청사진 단계에 남긴다(준 칸만 바꾼다 — 안 준 칸은 앞서 남긴 글 그대로). 바뀐 청사진을 돌려준다(없는 단계 id 는 버린다).
 */
export function keepStepText(bp: GameBlueprint, text: readonly PathStepText[]): GameBlueprint {
  const byId = new Map(text.map((t) => [t.id, t]));
  return { ...bp, steps: bp.steps.map((st) => {
    const t = byId.get(st.id);
    if (!t) return st;
    const { id: _id, ...fields } = t;
    const merged = normalizeStepText({ ...st.text, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null)) });
    const { text: _old, ...rest } = st;
    return merged ? { ...rest, text: merged } : rest;
  }) };
}

/**
 * build_blueprint_path 에 빠진 글 — 사람이 말하는 단계(talk·choice·battle)에 대사가 없거나 고르기 단계에 고를 것이 없으면 모델에게 돌려줄 영어 줄들.
 * 이미 명령이 있는 단계 이벤트(모델이 직접 지은 것)는 묻지 않는다.
 */
export function pathTextProblems(project: Project, text: readonly PathStepText[]): string[] {
  const bp = project.gameBlueprint;
  if (!bp) return [];
  const given = new Map(text.map((t) => [t.id, t]));
  const byId = { get: (id: string): PathStepText | undefined => given.get(id) ?? storedStepText(bp, id) };
  const out: string[] = [];
  for (const step of bp.steps) {
    if (step.kind !== "talk" && step.kind !== "choice" && step.kind !== "battle") continue;
    const map = mapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(String((e as { name?: string }).name ?? "")) === norm(step.event));
    if (ev && (ev.pages ?? []).some((p) => (p.commands ?? []).length)) continue;
    const t = byId.get(step.id);
    const label = `${step.id} (${step.kind}${step.who ? `, ${step.who}` : ""})`;
    if (!t?.lines?.length) out.push(`${label}: lines missing — 2–4 lines in ${step.who ?? "that person"}'s own voice.`);
    if (step.kind === "choice" && (t?.choices ?? []).filter((o) => o?.text?.trim()).length < 2) out.push(`${label}: choices missing — 2–3 of {text, lines, later}.`);
  }
  return out;
}

/** 모델 대사에 적힌 번호(3~6자리) 하나 — 둘 이상이면 고르지 않는다. */
export function modelCode(run: BuildRun, lines: readonly string[], kept: { mapId: string; eventId: string } | undefined): string | undefined {
  const texts = [...lines];
  if (kept) {
    const ev = run.ctx.project.maps[kept.mapId]?.events.find((e) => e.id === kept.eventId);
    for (const m of JSON.stringify(ev?.pages ?? []).matchAll(/"body":"((?:[^"\\]|\\.)*)"/gu)) texts.push(m[1]!);
  }
  const nums = [...new Set(texts.filter((l) => /비밀번호|번호|암호|숫자|자물쇠|code|password/iu.test(l)).flatMap((l) => l.match(/(?<!\d)\d{3,6}(?!\d)/gu) ?? []))];
  return nums.length === 1 ? nums[0] : undefined;
}

/** 앞선 빌드가 남긴 「X 조사를 살펴보았다」(이벤트 이름 그대로) 대사를 「X를 살펴보았다」로 — 2026-10-29 vm2 flash 판정 「이벤트 이름을 그대로 노출」. */
export function fixLookLines(run: BuildRun, mapId: string, eventId: string, event: string): void {
  const ev = run.ctx.project.maps[mapId]?.events.find((e) => e.id === eventId);
  const raw = `${event}${josa(event, "을", "를")} 살펴보았다.`;
  const fixed = lookLine(event);
  if (!ev || raw === fixed || !JSON.stringify(ev.pages ?? []).includes(raw)) return;
  const pages = structuredClone(ev.pages ?? []);
  for (const page of pages) for (const c of (page.commands ?? []) as { kind: string; body?: string }[]) if (c.kind === "text" && c.body === raw) c.body = fixed;
  run.call("upsert_event", { mapId, event: { ...ev, pages }, replacePages: true });
}

/**
 * 그대로 둔 단서 이벤트의 «얻는» 페이지(스위치를 켜거나 아이템을 주는 것) 대사에 번호를 적는다. 이미 적혀 있으면 그대로.
 * 「X 조사를 살펴보았다」 같은 이름 그대로의 대사도 「X를 살펴보았다」로 고친다. 성공하면 true.
 */
export function tellCode(run: BuildRun, kept: { mapId: string; eventId: string; gives: string; event: string }, code: string, body?: string): boolean {
  const ev = run.ctx.project.maps[kept.mapId]?.events.find((e) => e.id === kept.eventId);
  if (!ev) return false;
  if (JSON.stringify(ev.pages ?? []).includes(body ?? code)) return true;
  const gives = (c: { kind?: string; value?: unknown; op?: unknown }) => (c.kind === "setSwitch" && c.value !== false) || (c.kind === "changeItem" && c.op !== "-=");
  const pageIndex = (ev.pages ?? []).findIndex((p) => (p.commands ?? []).some((c) => gives(c as { kind?: string })));
  if (pageIndex < 0) return false;
  const pages = structuredClone(ev.pages ?? []);
  const cmds = pages[pageIndex]!.commands as { kind: string; body?: string }[];
  for (const c of cmds) if (c.kind === "text" && typeof c.body === "string" && c.body === `${kept.event}${josa(kept.event, "을", "를")} 살펴보았다.`) c.body = lookLine(kept.event);
  const at = cmds.findIndex((c) => gives(c));
  const learned = cmds.findIndex((c) => c.kind === "text" && typeof c.body === "string" && c.body.includes(`『${kept.gives}』`));
  const note = { kind: "text", body: body ?? `${kept.gives}: ${digitWord(code.length)} 숫자 「${code}」가 적혀 있다.` };
  cmds.splice(learned >= 0 && learned < at ? learned + 1 : at, 0, note);
  return run.call("upsert_event", { mapId: kept.mapId, event: { ...ev, pages }, replacePages: true }).ok;
}

/**
 * 단계마다 「현재 목표」 — 시작 목표(없을 때만)와, 단계 이벤트가 이정표를 켠 바로 뒤에 다음 단계의 목표 줄(goals[k]) + 그 이벤트 자리.
 * 왜(2026-10-28 mt3 argon escape): 사슬은 함수가 지었지만 목표 줄은 모델 몫이라, 모델이 set_objective 를 잘못 걸자(where 만 줌)
 * 게임 시작부터 마지막 목표만 떠 판정자가 「조사할 위치를 잡는 데 헤맸다」. 이미 목표가 있는 이벤트는 건드리지 않는다
 * (모델이 나중에 같은 이벤트에 set_objective 를 부르면 같은 자리를 바꾼다).
 */
export function stepObjectives(run: BuildRun, goals: readonly string[], made: readonly { step: number; name: string; made?: { mapId: string; eventId: string } }[]): string[] {
  const notes: string[] = [];
  const has = (pages: unknown, auto = false): boolean => (Array.isArray(pages) ? pages : []).some((p: { trigger?: { kind?: string }; commands?: unknown }) => (!auto || ["auto", "parallel"].includes(String(p.trigger?.kind))) && JSON.stringify(p.commands ?? []).includes(OBJECTIVE_SURFACE));
  const write = (plan: ReturnType<typeof planObjective>): boolean => {
    if (!plan.ok) return false;
    for (const entry of plan.events) if (!run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true }).ok) return false;
    return true;
  };
  const project = run.ctx.project;
  const start = project.maps[project.startMapId];
  const bp = project.gameBlueprint;
  if (bp && start && !(start.events ?? []).some((e) => has(e.pages, true))) {
    const plan = planObjective(project, { at: "start", text: bp.playerGoal.trim().replace(/[.。!]+$/u, "") });
    if (write(plan)) notes.push("시작 목표");
  }
  for (let i = 0; i + 1 < made.length; i += 1) {
    const cur = made[i]!.made, next = made[i + 1]!.made;
    // 다음 고리가 함수가 덧붙인 번호 단서(step < 0)면 그 단서를 살펴보라고 한다.
    const k = made[i + 1]!.step;
    const nextGoal = k >= 0 ? goals[k] : undefined;
    const nextName = made[i + 1]!.name;
    if (!cur || !next || (!nextGoal && !nextName)) continue;
    const ev = run.ctx.project.maps[cur.mapId]?.events.find((e) => e.id === cur.eventId);
    if (!ev || has(ev.pages)) continue;
    // 목표 줄은 플레이어에게 쓴 글(goals — playerLines.stepGoal)이다. 단계의 action 은 설계 메모라 쓰지 않는다.
    const text = nextGoal ?? `${nextName}${josa(nextName, "을", "를")} 살펴보자`;
    if (write(planObjective(run.ctx.project, { text, eventId: cur.eventId, mapId: cur.mapId, where: next.eventId }))) notes.push(`${String(ev.name ?? ev.id)} 뒤`);
  }
  if (notes.length && run.ctx.project.system.fieldHud?.objective === false) run.call("set_field_hud", { objective: true });
  return notes;
}
