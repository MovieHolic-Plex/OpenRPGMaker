// 「진행 깊이」 — 완성도 척도(scripts/fs-scale/score.mjs progressionDepth, 척도 항목 act_structure)를 조수 하네스 안으로 옮긴 것이다(mapCount.ts·questCount.ts 와 같은 방식).
// 척도와 같아야 한다: 센 맵(시작 맵에서 닿고·100칸·타일 6종·명령 든 이벤트·다른 배치)의 명령 든 이벤트를 내용(id·이름·자리·그림 뺀)이 같으면 한 번씩만 세고,
// «스위치/변수를 켠다(set) → 다른 이벤트가 그 스위치/변수를 조건으로 읽는다» 로 이어진 가장 긴 사슬의 길이가 깊이다.
// 왜 청사진 단계 수가 아니라 이 깊이로 재는가: 단계 이름만 늘리거나 이미 있는 이벤트 이름을 붙여도 사슬은 늘지 않는다 — 점수와 같은 값을 직접 잰다.
// test/aiV2ActDepth.test.ts 가 같은 입력에서 척도 act_structure 와 같은 값을 내는지 겨룬다.
import type { Project } from "@/project/types";
import { countMaps } from "./mapCount";

/** 끝맺음 관문이 강제하는 진행 깊이(2026-11-10 리드·오너: 맵 다음 act_structure — 청사진 단계 4→8). 한 번에 한 단계씩 올린다. */
export const MIN_ACT_DEPTH = 5;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function walk(node: unknown, visit: (n: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (isObj(node)) { visit(node); for (const key of Object.keys(node)) walk(node[key], visit); }
}
function canon(value: unknown, dropKeys: ReadonlySet<string>): string {
  if (Array.isArray(value)) return `[${value.map((item) => canon(item, dropKeys)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Obj).filter((key) => !dropKeys.has(key)).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canon((value as Obj)[key], dropKeys)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const DROP_EVENT: ReadonlySet<string> = new Set(["id", "name", "x", "y", "graphic"]);
const pagesOf = (event: Obj): Obj[] => (Array.isArray(event.pages) ? (event.pages as Obj[]) : []);
function commandCount(event: Obj): number {
  let count = 0;
  walk([event.commands, ...pagesOf(event).map((page) => page.commands)], (node) => { if (typeof node.kind === "string") count += 1; });
  return count;
}
const eventKey = (event: Obj): string => canon({
  trigger: event.trigger,
  commands: event.commands,
  pages: pagesOf(event).map((page) => ({ conditions: page.conditions, trigger: page.trigger, commands: page.commands })),
}, DROP_EVENT);

/** 척도 countedContent 의 events — 센 맵의 명령 든 이벤트, 내용이 같으면 하나. */
function countedEvents(project: Project): Obj[] {
  const maps = ((project as unknown as Obj).maps ?? {}) as Record<string, Obj>;
  const byHash = new Map<string, Obj>();
  for (const mapId of countMaps(project).counted) {
    for (const event of ((maps[mapId]?.events ?? []) as Obj[]).filter((e) => commandCount(e) > 0)) {
      const key = eventKey(event);
      if (!byHash.has(key)) byHash.set(key, event);
    }
  }
  return [...byHash.values()];
}

/** 센 이벤트들이 스위치/변수 set → 읽기 로 이어진 가장 긴 사슬(척도 progressionDepth 와 같다). */
export function progressionDepth(project: Project): number {
  const events = countedEvents(project);
  const tokenOf = (kind: string, node: Obj): string => (kind === "switch" ? `s:${String(node.switchId)}` : `v:${String(node.variableId)}`);
  const nodes = events.map((event) => {
    const needs = new Set<string>(); const sets = new Set<string>();
    walk(event, (node) => {
      if ((node.kind === "switch" || node.kind === "variable") && (node.switchId || node.variableId)) needs.add(tokenOf(node.kind, node));
      if (node.kind === "setSwitch" && node.value && node.switchId) sets.add(`s:${String(node.switchId)}`);
      if (node.kind === "setVariable" && node.variableId) sets.add(`v:${String(node.variableId)}`);
    });
    return { needs, sets };
  });
  const setters = new Map<string, number[]>();
  nodes.forEach((node, index) => { for (const token of node.sets) { if (!setters.has(token)) setters.set(token, []); setters.get(token)!.push(index); } });
  const depth: number[] = new Array(nodes.length).fill(-1);
  const state: number[] = new Array(nodes.length).fill(0);
  const visit = (index: number): number => {
    if (state[index] === 2) return depth[index]!;
    if (state[index] === 1) return 0;
    state[index] = 1;
    let best = 0;
    for (const token of nodes[index]!.needs) for (const setter of setters.get(token) ?? []) if (setter !== index) best = Math.max(best, 1 + visit(setter));
    state[index] = 2; depth[index] = best;
    return best;
  };
  let max = 0;
  for (let index = 0; index < nodes.length; index += 1) max = Math.max(max, visit(index));
  return max;
}
