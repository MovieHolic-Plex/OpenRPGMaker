// 저장 → 다시 읽기 관문 — 지은 프로젝트를 저장본 형식으로 내보내 다시 읽어(deserialize = 플레이어·편집기가 여는 길) 열리는지 본다.
//
// 왜(2026-10-29 vm6 jrpg 재생): 함수가 맵에 바로 넣은 「잠긴 문」 이벤트에 이벤트 단 trigger 가 빠져 게임이
// 「map map_blank_start.events[9].trigger가 객체가 아닙니다」로 아예 열리지 않았는데, 출하 검사·자동 플레이는 메모리의 프로젝트를 보니 통과했다.
// 같은 날 동굴 기둥 굽기도 「passability 길이 불일치」로 저장본이 안 열렸다.
// 그래서: 끝맺음 마지막(finishAutoBuild)과 재생(finishReplay)이 다시 읽기를 돌리고, 출하 검사(shipBlockers)는 실패를 출하 결함
// `project-reload-failed` 로 센다(어느 필드인지 그대로). 이벤트 모양 구멍(빌더가 넣은 이벤트의 빠진 trigger·commands·페이지 필드)은
// 뜻을 바꾸지 않는 기본값으로 메운다 — 페이지 trigger 를 이벤트 trigger 로, 빈 명령 목록, 투명 그림, 제자리 움직임.
import { deserialize, serialize } from "@/project/io/serialize";
import type { Project } from "@/project/types";

const cache = new WeakMap<object, string | null>();

/** 다시 읽기 실패 글(어느 필드인지 포함) — 열리면 undefined. 같은 프로젝트 객체는 한 번만 잰다(2초 안팎). */
export function reloadProblem(project: Project): string | undefined {
  const hit = cache.get(project);
  if (hit !== undefined) return hit ?? undefined;
  let problem: string | null = null;
  try { deserialize(serialize(project)); }
  catch (error) { problem = error instanceof Error ? error.message : String(error); }
  cache.set(project, problem);
  return problem ?? undefined;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isTrigger = (v: unknown) => isObj(v) && typeof v.kind === "string";

/** 이벤트 모양 구멍을 기본값으로 메운다(제자리). 메운 곳 목록. */
function fillEventShapes(project: Project): string[] {
  const fixed: string[] = [];
  for (const map of Object.values(project.maps)) {
    (map.events ?? []).forEach((ev, i) => {
      const e = ev as unknown as Obj;
      const where = `map ${map.id}.events[${i}](${String(e.id)})`;
      const pages = Array.isArray(e.pages) ? (e.pages as unknown[]) : undefined;
      if (!isTrigger(e.trigger)) {
        const first = pages?.find((p) => isObj(p) && isTrigger(p.trigger)) as Obj | undefined;
        e.trigger = first ? structuredClone(first.trigger) : { kind: "action" };
        fixed.push(`${where}.trigger`);
      }
      if (!Array.isArray(e.commands)) { e.commands = []; fixed.push(`${where}.commands`); }
      pages?.forEach((p, k) => {
        if (!isObj(p)) return;
        const at = `${where}.pages[${k}]`;
        if (typeof p.id !== "string") { p.id = `${String(e.id)}_p${k}`; fixed.push(`${at}.id`); }
        if (typeof p.name !== "string") { p.name = String(e.name ?? e.id ?? `페이지 ${k + 1}`); fixed.push(`${at}.name`); }
        if (!Array.isArray(p.conditions)) { p.conditions = []; fixed.push(`${at}.conditions`); }
        if (!isObj(p.graphic)) { p.graphic = { transparent: true }; fixed.push(`${at}.graphic`); }
        if (!isTrigger(p.trigger)) { p.trigger = structuredClone(e.trigger); fixed.push(`${at}.trigger`); }
        if (typeof p.priority !== "string") { p.priority = "same"; fixed.push(`${at}.priority`); }
        if (!isObj(p.movement)) { p.movement = { type: "fixed", speed: 3, frequency: 3 }; fixed.push(`${at}.movement`); }
        if (!Array.isArray(p.commands)) { p.commands = []; fixed.push(`${at}.commands`); }
      });
    });
  }
  return fixed;
}

/**
 * 다시 읽어 보고, 이벤트 모양 구멍이면 메운 사본으로 한 번 더 읽는다. 결과 프로젝트(메웠으면 사본)·메운 곳·남은 실패.
 * 메운 사본도 안 열리면 남은 실패를 함께 돌려준다(출하 결함으로 남는다).
 */
export function ensureReloadable(project: Project): { project: Project; fixed: string[]; problem?: string } {
  const first = reloadProblem(project);
  if (!first) return { project, fixed: [] };
  const copy = structuredClone(project);
  const fixed = fillEventShapes(copy);
  if (!fixed.length) return { project, fixed: [], problem: first };
  // 메우기는 빠진 필드만 채우니 더 나빠지지 않는다 — 다른 구멍이 남았어도 메운 사본을 쓰고 남은 실패를 알린다.
  const after = reloadProblem(copy);
  return after ? { project: copy, fixed, problem: after } : { project: copy, fixed };
}
