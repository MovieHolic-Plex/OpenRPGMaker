// 조수 v2 청사진 — 게임 하나를 짓기 전에 쓰는 설계(write_blueprint)와, 그 설계에서 저절로 나오는 출하 검사.
//
// 왜(2026-10-28 스위트·청사진 방식, ~/z-project/assistant-whole-game/HANDOFF-suite-blueprint.md): 장르마다 플레이 판정 결함을
// 사후 검사로 하나씩 막았지만 설계 단계가 없어 «엔딩까지 길이 끊김·조건을 켜는 곳 없음»이 되풀이됐다. 청사진의 핵심 경로
// (장소 → 이벤트 → 조건 → 다음 장소)를 데이터로 걸어 본다: 맵이 있나, 시작에서 걸어 닿나, 이벤트가 있나, 조건을 켜는 곳이
// 그 단계 전에 있나, 마지막이 엔딩을 부르나. 순수 함수(프로젝트만 읽는다) — shipBlockers 가 부른다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { gameBlueprintText, normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { walkGame } from "./makeGame";
import { unreachableEvents } from "./eventReach";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);
export interface BlueprintBlocker { readonly id: string; readonly message: string; readonly evidence: string }

export const BLUEPRINT_CARD = [
  "[청사진 먼저 — write_blueprint] 게임 하나를 만드는 요청이면 장소를 짓기 전에 write_blueprint 로 이 게임의 설계 한 장을 쓴다(짓는 동사는 청사진이 없으면 거절된다).",
  "- playerGoal: 새 플레이어에게 줄 안내 한 줄(무엇을 하면 엔딩인가). 판정자는 이 한 줄만 받고 게임을 끝까지 해 본다.",
  "- steps: 시작부터 엔딩까지 반드시 지나는 핵심 경로 3~8단계. 단계마다 place(지을 맵 이름 그대로)·event(그 맵 위 이벤트 이름 그대로)·action(플레이어가 하는 일)·needs(이 단계를 여는 조건)·gives(다음 단계를 여는 것: 열쇠·스위치·호감, 마지막은 엔딩)·feeling(장면의 느낌).",
  "- ending: {name, how, feeling}. 여러 엔딩이면 핵심 경로는 가장 기본 엔딩 하나로 쓰고 나머지는 how 에 적는다.",
  "- 장소를 지은 뒤 build_blueprint_path 를 한 번 부른다 — 단계마다 이벤트, 앞 단계 gives 를 조건으로, 마지막이 엔딩 호출까지 함수가 짓는다(upsert_event·define_ending 으로 하나씩 맞추지 않는다). 대사는 steps[{id,lines}] 로만 준다.",
  "- 짓는 동안 장소·이벤트 이름은 청사진과 똑같이 쓴다(이름 없는 이벤트는 event 에 그 id 를 써도 된다). 바뀌면 write_blueprint 를 다시 불러 실제 이름에 맞춘다. 출하 검사가 이 경로를 데이터로 걸어 본다(맵·이벤트가 있나, 시작에서 걸어 닿나, 조건을 켜는 이벤트가 앞 단계에 있나, 마지막 이벤트가 엔딩을 부르나).",
].join("\n");

export const WRITE_BLUEPRINT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    genre: { type: "string", description: "짧은 장르 낱말(공포·연애·JRPG…)" },
    playerGoal: { type: "string", description: "새 플레이어에게 줄 안내 한 줄(140자 안)" },
    steps: { type: "array", minItems: 2, maxItems: 12, items: { type: "object", properties: {
      id: { type: "string", description: "s1, s2 …" },
      place: { type: "string", description: "맵 이름(지을 이름 그대로)" },
      event: { type: "string", description: "그 맵 위 이벤트 이름(지을 이름 그대로)" },
      action: { type: "string", description: "플레이어가 하는 일" },
      needs: { type: "string", description: "이 단계를 여는 조건(첫 단계는 생략)" },
      gives: { type: "string", description: "다음 단계를 여는 것(열쇠·스위치·호감) — 마지막은 엔딩" },
      feeling: { type: "string", description: "이 장면의 느낌" },
    }, required: ["place", "event", "action", "gives", "feeling"] } },
    ending: { type: "object", properties: { name: { type: "string" }, how: { type: "string" }, feeling: { type: "string" } }, required: ["name", "how", "feeling"] },
  },
  // title·genre 는 빠뜨려도 된다 — 다시 쓸 때 앞 청사진·프로젝트 제목으로 채운다(mt2 Flash: 매 턴 이 둘이 빠져 한 번씩 실패했다).
  required: ["playerGoal", "steps", "ending"],
} as const;

/** 모델 입력 → 청사진. 틀리면 { error }. */
export function parseBlueprintArgs(args: unknown, request: string, now = new Date()): { blueprint: GameBlueprint } | { error: string } {
  try {
    const raw = obj(args) ?? {};
    return { blueprint: normalizeGameBlueprint({ ...raw, version: 1, request: request.slice(0, 600), updatedAt: now.toISOString() }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function blueprintPin(project: Project): string[] {
  return project.gameBlueprint ? [gameBlueprintText(project.gameBlueprint)] : [];
}

// ── 데이터로 경로 걷기 ─────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();
/** 이름이 같거나 한쪽이 다른 쪽을 품는다(「카페」 ↔ 「카페 온기」). 두 글자 미만은 같을 때만. */
function sameName(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && long.includes(short);
}

function findMap(project: Project, name: string): GameMap | undefined {
  const maps = Object.values(project.maps);
  return maps.find((m) => m.id === name || norm(m.name ?? "") === norm(name)) ?? maps.find((m) => sameName(m.name ?? "", name));
}
function findEvent(map: GameMap, name: string): GameEvent | undefined {
  const evs = map.events ?? [];
  const label = (e: GameEvent) => String((e as unknown as Obj).name ?? "");
  return evs.find((e) => e.id === name || norm(label(e)) === norm(name)) ?? evs.find((e) => sameName(label(e), name));
}

function walk(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    const cmd = obj(raw);
    if (!cmd) continue;
    visit(cmd);
    for (const key of ["then", "else", "branch", "cancelBranch", "commands", "body", "loop", "beats"]) if (Array.isArray(cmd[key])) walk(cmd[key], visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options) walk(obj(o)?.branch, visit);
    if (Array.isArray(cmd.branches)) for (const b of cmd.branches) walk(obj(b)?.commands, visit);
  }
}
function pagesOf(ev: GameEvent): Obj[] {
  const pages = ((ev as unknown as Obj).pages as unknown[] | undefined) ?? [];
  return pages.map((p) => obj(p) ?? {});
}
function leafConds(page: Obj): Obj[] {
  const out: Obj[] = [];
  const visit = (c: unknown): void => {
    if (Array.isArray(c)) { c.forEach(visit); return; }
    const o = obj(c);
    if (!o) return;
    if (Array.isArray(o.all)) o.all.forEach(visit);
    else if (Array.isArray(o.any)) o.any.forEach(visit);
    else out.push(o);
  };
  visit(page.conditions);
  return out;
}

type Setter = { switches: Set<string>; items: Set<string>; variables: Set<string>; ends: boolean; commonEvents: Set<string> };
function settersOf(commands: unknown): Setter {
  const s: Setter = { switches: new Set(), items: new Set(), variables: new Set(), ends: false, commonEvents: new Set() };
  walk(commands, (cmd) => {
    if (cmd.kind === "setSwitch" && cmd.value !== false) s.switches.add(String(cmd.switchId));
    else if (cmd.kind === "changeItem" && cmd.op !== "-=") s.items.add(String(cmd.itemId));
    else if (cmd.kind === "setVariable" && cmd.op !== "-=") s.variables.add(String(cmd.variableId));
    else if (cmd.kind === "triggerEnding") s.ends = true;
    else if (cmd.kind === "callCommonEvent") s.commonEvents.add(String(cmd.commonEventId));
    // 상점 구입도 물건을 준다.
    else if (cmd.kind === "shop") for (const id of (cmd.itemIds as unknown[] | undefined) ?? []) s.items.add(String(id));
  });
  return s;
}
function merge(into: Setter, from: Setter): void {
  for (const k of ["switches", "items", "variables", "commonEvents"] as const) for (const v of from[k]) into[k].add(v);
  into.ends ||= from.ends;
}
/** 이벤트 하나가 (부르는 공통 이벤트까지) 켜는 것. */
function eventSetter(project: Project, ev: GameEvent): Setter {
  const s = settersOf(pagesOf(ev).map((p) => p.commands).flat());
  merge(s, settersOf((ev as unknown as Obj).commands));
  const ces = new Map(((project.commonEvents ?? []) as unknown as Obj[]).map((ce) => [String(ce.id), ce]));
  const seen = new Set<string>();
  const queue = [...s.commonEvents];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const sub = settersOf(ces.get(id)?.commands);
    merge(s, sub);
    queue.push(...sub.commonEvents);
  }
  return s;
}

/** 페이지가 열리는 조건(스위치·아이템·변수) — 한 페이지라도 조건이 다 채워질 수 있으면 그 이벤트는 열린다. */
function pageNeeds(page: Obj): { kind: "switch" | "item" | "variable"; id: string }[] {
  return leafConds(page).flatMap((c) => c.kind === "switch" && c.value !== false && c.switchId !== undefined ? [{ kind: "switch" as const, id: String(c.switchId) }]
    : c.kind === "item" && c.present !== false && c.itemId !== undefined ? [{ kind: "item" as const, id: String(c.itemId) }]
      : c.kind === "variable" && c.variableId !== undefined && Number(c.value ?? 0) > 0 && /^(>=|>|==)$/u.test(String(c.op ?? "")) ? [{ kind: "variable" as const, id: String(c.variableId) }] : []);
}
const hasCommands = (page: Obj) => Array.isArray(page.commands) && page.commands.length > 0;

/** 경로 막힘의 고칠 동사 한 줄 — 하위 도구(upsert_event·define_ending…)를 하나씩 맞추게 하지 않는다(2026-10-28 mt2 Flash: upsert_event 6번 인자 실패). */
export const BLUEPRINT_PATH_FIX = "고치기: build_blueprint_path 를 한 번 부른다 — 청사진 단계대로 이벤트·조건·스위치·아이템·엔딩 호출을 함수가 짓는다(대사만 steps[{id,lines}] 로 준다).";
export const BLUEPRINT_PATH_IDS: ReadonlySet<string> = new Set(["blueprint-event-unreachable", "blueprint-event-missing", "blueprint-event-empty", "blueprint-condition-unset", "blueprint-condition-order", "blueprint-no-ending"]);

export interface BlueprintWalk {
  readonly blockers: BlueprintBlocker[];
  readonly lines: string[];
}

/** 청사진 경로를 데이터로 걷는다. 청사진이 없으면 빈 결과. */
export function walkBlueprint(project: Project): BlueprintWalk {
  const bp = project.gameBlueprint;
  if (!bp) return { blockers: [], lines: [] };
  const blockers: BlueprintBlocker[] = [];
  const lines: string[] = [];
  const add = (id: string, message: string, evidence: string) => blockers.push({ id, message, evidence });
  const resolved = bp.steps.map((step) => {
    const map = findMap(project, step.place);
    const ev = map ? findEvent(map, step.event) : undefined;
    return { step, map, ev };
  });
  // 1) 맵·이벤트가 있나
  for (const r of resolved) {
    if (!r.map) { add("blueprint-place-missing", `청사진 ${r.step.id} 의 장소 「${r.step.place}」 맵이 없다 — 짓거나, 다른 이름으로 지었으면 write_blueprint 로 청사진의 place 를 실제 맵 이름에 맞춘다.`, `${r.step.id} place=${r.step.place}`); continue; }
    if (!r.ev) add("blueprint-event-missing", `청사진 ${r.step.id} 의 이벤트 「${r.step.event}」가 「${r.map.name}」(${r.map.id})에 없다 — 이 단계(${r.step.action})를 할 이벤트를 두거나, 다른 이름으로 두었으면 write_blueprint 로 event 를 실제 이벤트 이름에 맞춘다.`, `${r.step.id} ${r.map.id} event=${r.step.event}`);
  }
  // 2) 시작에서 걸어 닿나
  const mapIds = [...new Set(resolved.flatMap((r) => r.map ? [r.map.id] : []))];
  if (mapIds.length) {
    const path = walkGame(project, mapIds);
    for (const id of path.unreached) {
      const step = resolved.find((r) => r.map?.id === id)!.step;
      add("blueprint-place-unreachable", `청사진 ${step.id} 의 「${project.maps[id]?.name ?? id}」(${id}) 에 시작 맵에서 문·길을 따라 걸어 닿지 못한다 — create_transfer_pair 로 앞 단계 장소와 잇는다.`, `${step.id} ${id}`);
    }
  }
  // 2b) 단계 이벤트 옆에 걸어 가 설 칸이 있나(시작점·착지점에서, 같은 높이 이벤트는 못 지난다) — mt2 deepseek: 쪽지가 통로를 막아 자물쇠에 못 갔다.
  for (const r of resolved) {
    if (!r.map || !r.ev) continue;
    if (unreachableEvents(project, r.map.id, [r.ev.id]).length) add("blueprint-event-unreachable", `청사진 ${r.step.id} 「${r.step.event}」(${r.map.id} ${r.ev.id}, (${r.ev.x},${r.ev.y})) 옆에 걸어 가서 설 칸이 없다(벽이나 다른 이벤트가 길목을 막았다) — 플레이어가 조사할 수 없다.`, `${r.step.id} ${r.ev.id} (${r.ev.x},${r.ev.y})`);
  }
  // 3) 조건을 켜는 곳이 그 단계 전에 있나(또는 경로 밖 아무 이벤트가 켜나)
  const stepSetters = resolved.map((r) => r.ev ? eventSetter(project, r.ev) : undefined);
  const pathIds = new Set(resolved.flatMap((r) => r.ev && r.map ? [`${r.map.id}/${r.ev.id}`] : []));
  const offPath: Setter = { switches: new Set(), items: new Set(), variables: new Set(), ends: false, commonEvents: new Set() };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) if (!pathIds.has(`${map.id}/${ev.id}`)) merge(offPath, eventSetter(project, ev));
  const nameOf = (kind: string, id: string): string => {
    const list = kind === "switch" ? project.switches : kind === "variable" ? project.variables : (project.database.items as unknown as { id: string; name?: string }[] | undefined);
    const hit = (list as unknown as { id: string; name?: string }[] | undefined)?.find((x) => String(x.id) === id);
    return hit?.name ? `${hit.name}(${id})` : id;
  };
  resolved.forEach((r, k) => {
    if (!r.ev || !r.map) return;
    const pages = pagesOf(r.ev).filter(hasCommands);
    if (!pages.length) { add("blueprint-event-empty", `청사진 ${r.step.id} 「${r.step.event}」(${r.map.id} ${r.ev.id}) 에 실행할 명령이 하나도 없다 — ${r.step.action} 를 할 수 있게 대사·선택·결과를 넣는다.`, `${r.step.id} ${r.ev.id}`); return; }
    const before: Setter = { switches: new Set(), items: new Set(), variables: new Set(), ends: false, commonEvents: new Set() };
    // 자기 자신이 켜는 것(다른 페이지·날마다 오르는 카운터)도 앞에 있는 것으로 본다 — 다시 말을 걸면 열린다.
    for (let j = 0; j <= k; j++) if (stepSetters[j]) merge(before, stepSetters[j]!);
    const after: Setter = { switches: new Set(), items: new Set(), variables: new Set(), ends: false, commonEvents: new Set() };
    for (let j = k + 1; j < stepSetters.length; j++) if (stepSetters[j]) merge(after, stepSetters[j]!);
    const has = (s: Setter, n: { kind: string; id: string }) => n.kind === "switch" ? s.switches.has(n.id) : n.kind === "item" ? s.items.has(n.id) : s.variables.has(n.id);
    // 열리는 페이지가 하나라도 있으면 통과. 아니면 가장 가까운 페이지의 막힌 조건을 짚는다.
    const verdicts = pages.map((page) => {
      const needs = pageNeeds(page);
      const never = needs.filter((n) => !has(before, n) && !has(offPath, n) && !has(after, n));
      const late = needs.filter((n) => !has(before, n) && !has(offPath, n) && has(after, n));
      return { never, late };
    });
    if (verdicts.some((v) => !v.never.length && !v.late.length)) return;
    const best = [...verdicts].sort((a, b) => a.never.length - b.never.length || a.late.length - b.late.length)[0]!;
    if (best.never.length) add("blueprint-condition-unset", `청사진 ${r.step.id} 「${r.step.event}」(${r.map.id} ${r.ev.id}) 의 페이지가 ${best.never.map((n) => `${n.kind === "switch" ? "스위치" : n.kind === "item" ? "아이템" : "변수"} ${nameOf(n.kind, n.id)}`).join("·")} 를 조건으로 거는데 그것을 켜는·주는 이벤트가 게임 어디에도 없다 — 앞 단계(${resolved[k - 1]?.step.event ?? "시작"})의 결과에서 켜게 한다.`, `${r.step.id} ${r.ev.id} needs ${best.never.map((n) => n.id).join(",")}`);
    else add("blueprint-condition-order", `청사진 ${r.step.id} 「${r.step.event}」 의 조건 ${best.late.map((n) => nameOf(n.kind, n.id)).join("·")} 은 뒤 단계에서만 켜진다 — 앞 단계에서 켜지게 순서를 바로잡는다.`, `${r.step.id} ${r.ev.id} late ${best.late.map((n) => n.id).join(",")}`);
  });
  // 4) 마지막 단계가 엔딩을 부르나 — 직접, 공통 이벤트로, 또는 켠 스위치가 여는 다른 이벤트(자동 실행 엔딩)로.
  const last = resolved.at(-1);
  if (last?.ev && last.map) {
    const s = stepSetters.at(-1)!;
    let ends = s.ends;
    if (!ends) for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
      if (ends) break;
      for (const page of pagesOf(ev)) {
        const needs = pageNeeds(page);
        if (needs.length && needs.some((n) => (n.kind === "switch" ? s.switches : n.kind === "item" ? s.items : s.variables).has(n.id)) && settersOf(page.commands).ends) { ends = true; break; }
      }
    }
    if (!ends) add("blueprint-no-ending", `청사진 마지막 단계 ${last.step.id} 「${last.step.event}」(${last.map.id} ${last.ev.id}) 가 엔딩을 부르지 않는다 — 이 이벤트(또는 이 이벤트가 켜는 스위치로 열리는 자동 실행 이벤트)에 엔딩 「${bp.ending.name}」을 연결한다.`, `${last.step.id} ${last.ev.id}`);
  }
  // 5) 게임 어디에도 엔딩을 부르는 맵 이벤트가 없다 — 마지막 단계 이벤트가 없어 4)가 건너뛰어도 막는다(mt2 Flash·Argon: define_ending 만 하고 끝났다).
  if (!blockers.some((b) => b.id === "blueprint-no-ending")) {
    const anyEnding = Object.values(project.maps).some((map) => (map.events ?? []).some((ev) => eventSetter(project, ev).ends));
    // 맨 앞에 둔다 — 출하 검사는 앞 6개만 싣는다.
    if (!anyEnding) blockers.unshift({ id: "blueprint-no-ending", message: `게임 어디에도 엔딩 「${bp.ending.name}」을 부르는 맵 이벤트가 없다(define_ending 은 정의일 뿐이다) — 새 플레이어가 게임을 끝낼 수 없다.`, evidence: `triggerEnding 0 · endings ${(project.endings ?? []).length}` });
  }
  // 경로 막힘에는 고칠 동사 한 줄을 붙인다(한 번만 — 메시지마다 같은 줄을 반복하지 않는다).
  const firstPath = blockers.findIndex((b) => BLUEPRINT_PATH_IDS.has(b.id));
  if (firstPath >= 0) blockers[firstPath] = { ...blockers[firstPath]!, message: `${blockers[firstPath]!.message} ${BLUEPRINT_PATH_FIX}` };
  lines.push(`청사진 경로 ${bp.steps.length}단계: ${resolved.map((r) => `${r.step.id} ${r.map ? "맵✓" : "맵✗"}${r.ev ? "이벤트✓" : r.map ? "이벤트✗" : ""}`).join(" · ")} · 막힘 ${blockers.length}`);
  return { blockers, lines };
}

// ── 설계자(다른 모델)가 청사진을 쓰는 길 — 비교 C(Argon 설계 + Flash 실행) ──────────────────────

export interface BlueprintDesigner { readonly provider: string; readonly model: string; readonly effort?: "low" | "medium" | "high" }
/** OPRN_V2_BLUEPRINT_DESIGNER="provider|model|effort" — 시험 묶음에서만 켠다(제품 설정 칸이 아니다). */
export function blueprintDesignerFromEnv(): BlueprintDesigner | undefined {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPRN_V2_BLUEPRINT_DESIGNER;
  if (!raw) return undefined;
  const [provider, model, effort] = raw.split("|");
  if (!provider || !model) return undefined;
  return { provider, model, ...(effort === "low" || effort === "medium" || effort === "high" ? { effort } : {}) };
}

/** 설계자에게 청사진 JSON 하나를 받아 온다. 한 번 틀리면 틀린 이유를 그대로 붙여 한 번 더. */
export async function designBlueprint(chat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>, task: string, brief: string, signal?: AbortSignal): Promise<{ blueprint: GameBlueprint } | { error: string }> {
  const system = [
    "너는 RPG 편집기 조수의 설계자다. 사용자 요청으로 게임 하나의 청사진을 JSON 한 덩어리로만 쓴다(설명·코드 울타리 없이).",
    BLUEPRINT_CARD,
    `JSON 모양: ${JSON.stringify(WRITE_BLUEPRINT_SCHEMA)}`,
    "장소는 이 편집기가 지을 수 있는 것(마을·거리·집·실내 방·던전·동굴)으로, 3~6곳 안에서. 핵심 경로는 3~8단계, 새 플레이어가 20분 안에 엔딩을 볼 크기로.",
  ].join("\n");
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? `요청: ${task}\n\n${brief}` : `앞 답을 읽지 못했다: ${last}\n같은 요청으로 JSON 한 덩어리만 다시 쓴다.\n요청: ${task}`;
    let reply = "";
    try { reply = await chat([{ role: "system", content: system }, { role: "user", content: user }], signal); }
    catch (error) { return { error: `설계자 호출 실패: ${error instanceof Error ? error.message : String(error)}` }; }
    const body = reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1);
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch (error) { last = `JSON 이 아니다(${error instanceof Error ? error.message : String(error)})`; continue; }
    const result = parseBlueprintArgs(parsed, task);
    if ("blueprint" in result) return result;
    last = result.error;
  }
  return { error: `설계자 청사진을 읽지 못했다: ${last}` };
}

/** 짓는 동사 결과 뒤에 붙이는 청사진 진행(매 단계가 청사진과 대조되게). */
export function blueprintProgressNote(project: Project): string | undefined {
  if (!project.gameBlueprint) return undefined;
  const walked = walkBlueprint(project);
  return ["[청사진 진행]", ...walked.lines, ...walked.blockers.slice(0, 4).map((b) => `- ${b.message}`)].join("\n");
}
