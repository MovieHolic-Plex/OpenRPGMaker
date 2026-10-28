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
    // 갈래 이름은 명령마다 다르다 — 전투 victoryBranch/defeatBranch/escapeBranch, 상점 transactionBranch… 「…Branch」 배열은 모두 걷는다
    // (2026-10-29 standin monster: 챔피언 전투 victoryBranch 의 setSwitch mx_ending 을 못 봐 blueprint-condition-unset 거짓 막힘).
    for (const [key, value] of Object.entries(cmd)) if (Array.isArray(value) && (/^(then|else|branch|commands|body|loop|beats)$/u.test(key) || /Branch$/u.test(key))) walk(value, visit);
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

/** 이벤트 하나가 (부르는 공통 이벤트까지) 켜는 스위치·주는 아이템·엔딩 호출 — 경로 빌더가 모델이 지은 단계를 그대로 두고 뒤 단계를 이을 때. */
export function eventGives(project: Project, ev: GameEvent): { switches: string[]; items: string[]; ends: boolean } {
  const s = eventSetter(project, ev);
  return { switches: [...s.switches], items: [...s.items], ends: s.ends };
}

/** 페이지가 열리는 조건(스위치·아이템·변수) — 한 페이지라도 조건이 다 채워질 수 있으면 그 이벤트는 열린다. */
type PageNeed = { kind: "switch" | "item" | "variable"; id: string };
function pageNeeds(page: Obj): PageNeed[] {
  return leafConds(page).flatMap((c): PageNeed[] => c.kind === "switch" && c.value !== false && c.switchId !== undefined ? [{ kind: "switch" as const, id: String(c.switchId) }]
    : c.kind === "item" && c.present !== false && c.itemId !== undefined ? [{ kind: "item" as const, id: String(c.itemId) }]
      : c.kind === "variable" && c.variableId !== undefined && Number(c.value ?? 0) > 0 && /^(>=|>|==)$/u.test(String(c.op ?? "")) ? [{ kind: "variable" as const, id: String(c.variableId) }] : []);
}
const hasCommands = (page: Obj) => Array.isArray(page.commands) && page.commands.length > 0;

// ── 번호·암호 단계 ─────────────────────────────────────────────────────────
// 왜(2026-10-28 mt3 flash 방탈출): 청사진 s2 「비밀번호 입력 — 숫자 자물쇠를 풀고 탈출」인데 경로 빌더가 그 단계를 줍기·엔딩 고리로
// 지어, 열쇠만 들고 조사하면 번호 입력 없이 엔딩이 나왔다(판정 「퍼즐을 풀었다는 느낌이 없다」). 조건 사슬은 이어져 있어 기존 걷기가 못 봤다.

/** 번호·암호를 맞히는 행동 낱말. */
export const CODE_STEP_WORDS = /비밀\s*번호|암호|패스\s*워드|숫자\s*자물쇠|번호\s*자물쇠|다이얼|키\s*패드|번호를?\s*(맞|입력|누르|돌리)|password|passcode|pin\s*code|combination|keypad/iu;
/** 번호를 «주는» 단계(단서)의 gives 낱말 — 이런 단계는 맞히는 단계가 아니다. */
const CODE_GIVES = /비밀\s*번호|암호|번호|단서|쪽지|힌트|password|code|clue|hint|note/iu;
/** 청사진 단계가 번호·암호를 맞히는 단계인가(이벤트 이름·행동에 그 낱말이 있고, gives 가 번호·단서 자체가 아니다). */
export function isCodeStep(step: { readonly event: string; readonly action: string; readonly gives: string }): boolean {
  return CODE_STEP_WORDS.test(`${step.event} ${step.action}`) && !CODE_GIVES.test(step.gives);
}
const isInput = (cmd: Obj) => cmd.kind === "inputNumber" || (cmd.kind === "choices" && Array.isArray(cmd.options) && cmd.options.length > 1);
const progresses = (cmd: Obj) => cmd.kind === "triggerEnding" || (cmd.kind === "setSwitch" && cmd.value !== false) || (cmd.kind === "changeItem" && cmd.op !== "-=") || cmd.kind === "transfer";
/** 명령 목록(공통 이벤트 호출 포함)에 입력이 있나. */
function hasInput(project: Project, commands: unknown, seen = new Set<string>()): boolean {
  let found = false;
  const ces = new Map(((project.commonEvents ?? []) as unknown as Obj[]).map((ce) => [String(ce.id), ce]));
  walk(commands, (cmd) => {
    if (found) return;
    if (isInput(cmd)) found = true;
    else if (cmd.kind === "callCommonEvent") { const id = String(cmd.commonEventId); if (!seen.has(id)) { seen.add(id); found = hasInput(project, ces.get(id)?.commands, seen); } }
  });
  return found;
}
/** 입력(번호·고르기) 뒤 갈래 안에서만 켜지는 스위치·변수 — 이것을 조건으로 건 페이지는 입력을 거친 뒤에만 열린다. */
function inputGatedFlags(project: Project): Set<string> {
  const out = new Set<string>();
  const pages = Object.values(project.maps).flatMap((m) => (m.events ?? []).flatMap((ev) => pagesOf(ev)));
  const lists = [...pages.map((p) => p.commands), ...((project.commonEvents ?? []) as unknown as Obj[]).map((ce) => ce.commands)];
  for (const list of lists) {
    if (!Array.isArray(list) || !hasInput(project, list)) continue;
    // 맨 윗줄(갈래 밖)에서 켜는 것은 입력과 상관없이 켜진다 — 갈래 안에서 켜는 것만.
    const top = new Set((list as unknown[]).map((c) => obj(c)).filter((c): c is Obj => !!c && c.kind === "setSwitch").map((c) => String(c.switchId)));
    walk(list, (cmd) => {
      if (cmd.kind === "setSwitch" && cmd.value !== false && !top.has(String(cmd.switchId))) out.add(`switch:${String(cmd.switchId)}`);
      if (cmd.kind === "inputNumber" && cmd.variableId !== undefined) out.add(`variable:${String(cmd.variableId)}`);
    });
  }
  return out;
}
/**
 * 번호·암호 단계 이벤트가 정말 입력을 거쳐야 넘어가나. 넘어가게 하는(엔딩·스위치·아이템·이동) 페이지마다
 * (a) 그 페이지에 입력이 있고 넘어가는 명령이 입력 뒤 갈래 안에만 있거나, (b) 입력 갈래에서만 켜지는 스위치·변수를 조건으로 건다.
 * 아니면 그 페이지 설명을 돌려준다(통과면 undefined).
 */
export function codeStepBypass(project: Project, ev: GameEvent): string | undefined {
  const gated = inputGatedFlags(project);
  for (const [i, page] of pagesOf(ev).entries()) {
    const cmds = Array.isArray(page.commands) ? (page.commands as unknown[]) : [];
    let moves = false;
    walk(cmds, (c) => { if (progresses(c)) moves = true; });
    if (!moves) continue;
    const conds = leafConds(page);
    if (conds.some((c) => (c.kind === "switch" && c.value !== false && gated.has(`switch:${String(c.switchId)}`)) || (c.kind === "variable" && gated.has(`variable:${String(c.variableId)}`)))) continue;
    if (hasInput(project, cmds)) {
      const bare = cmds.map((c) => obj(c)).find((c) => !!c && progresses(c));
      if (!bare) continue;
      return `${i + 1}쪽이 번호를 받고도 맞든 틀리든 ${String(bare.kind)} 를 한다(정답 갈래 밖)`;
    }
    return `${i + 1}쪽이 번호 입력·고르기 없이 ${cmds.map((c) => obj(c)).filter((c) => !!c && progresses(c)).map((c) => String(c!.kind)).join("·") || "다음으로 넘기기"} 를 한다`;
  }
  return undefined;
}

// ── 전투 단계 ─────────────────────────────────────────────────────────────
// 왜(2026-10-29 vm1 flash jrpg): 청사진 마지막 단계 「마왕과의 결전 — 마왕을 처치한다」를 경로 빌더가 열쇠 줍기·엔딩 고리로 지었고,
// 던전 빌더의 보스 전투는 따로 서 있었다. 열쇠만 있으면 보스를 지나쳐 「마왕과의 결전」을 조사해 엔딩이 났다(이기지 않아도).
// 번호 단계와 같은 방식: 넘어가는(엔딩·스위치·아이템·이동) 명령이 전투 승리 갈래 안에만 있거나, 승리 갈래에서만 켜지는 스위치를 조건으로 건다.

/** 싸워 이기는 행동 낱말. */
export const BATTLE_STEP_WORDS = /결전|전투|처치|쓰러뜨|물리치|격파|무찌르|무찔|토벌|대결|보스전|battle|fight|defeat|slay|boss/iu;
/** 듣기·묻기 단계(「마왕을 처치할 방법을 듣는다」)는 싸우는 단계가 아니다. */
const TALK_ACTION = /대화|듣는|듣고|묻는|물어|이야기|말을\s*건|방법을|소문|정보/u;
/** 청사진 단계가 싸워 이기는 단계인가(이벤트 이름에 전투 낱말, 또는 행동에 전투 낱말이 있고 듣기·묻기 단계가 아니다). */
export function isBattleStep(step: { readonly event: string; readonly action: string }): boolean {
  return BATTLE_STEP_WORDS.test(step.event) || (BATTLE_STEP_WORDS.test(step.action) && !TALK_ACTION.test(step.action));
}
const isVictoryFork = (cmd: Obj) => cmd.kind === "fork" && obj(cmd.condition)?.kind === "battleResult" && obj(cmd.condition)?.result === "victory";
/** 명령 목록에서 전투 승리 갈래 밖에 있는 넘어가는 명령(첫 것). */
function progressOutsideVictory(list: unknown): Obj | undefined {
  if (!Array.isArray(list)) return undefined;
  for (const raw of list) {
    const cmd = obj(raw);
    if (!cmd) continue;
    if (progresses(cmd)) return cmd;
    for (const [key, value] of Object.entries(cmd)) {
      if (!Array.isArray(value)) continue;
      if (isVictoryFork(cmd) && key === "then") continue;
      if (cmd.kind === "battleProcessing" && key === "victoryBranch") continue;
      if (/^(then|else|branch|commands|body|loop|beats)$/u.test(key) || /Branch$/u.test(key)) { const hit = progressOutsideVictory(value); if (hit) return hit; }
    }
    if (Array.isArray(cmd.options)) for (const o of cmd.options) { const hit = progressOutsideVictory(obj(o)?.branch); if (hit) return hit; }
  }
  return undefined;
}
/** 전투 승리 갈래 안에서만 켜지는 스위치 — 그 스위치를 조건으로 건 페이지는 이긴 뒤에만 열린다. */
export function victoryGatedSwitches(project: Project): Set<string> {
  const out = new Set<string>();
  const lists = [...Object.values(project.maps).flatMap((m) => (m.events ?? []).flatMap((ev) => pagesOf(ev).map((p) => p.commands))), ...((project.commonEvents ?? []) as unknown as Obj[]).map((ce) => ce.commands)];
  for (const list of lists) walk(list, (cmd) => {
    const inside = isVictoryFork(cmd) ? cmd.then : cmd.kind === "battleProcessing" ? cmd.victoryBranch : undefined;
    walk(inside, (c) => { if (c.kind === "setSwitch" && c.value !== false && c.switchId !== undefined) out.add(String(c.switchId)); });
  });
  // 같은 스위치를 승리 갈래 밖에서도 켜면 이긴 표시가 아니다.
  for (const list of lists) {
    const outside = (l: unknown): void => {
      if (!Array.isArray(l)) return;
      for (const raw of l) {
        const cmd = obj(raw);
        if (!cmd) continue;
        if (cmd.kind === "setSwitch" && cmd.value !== false) out.delete(String(cmd.switchId));
        for (const [key, value] of Object.entries(cmd)) if (Array.isArray(value) && !(isVictoryFork(cmd) && key === "then") && !(cmd.kind === "battleProcessing" && key === "victoryBranch") && (/^(then|else|branch|commands|body|loop|beats)$/u.test(key) || /Branch$/u.test(key))) outside(value);
      }
    };
    outside(list);
  }
  return out;
}
/** 전투 단계 이벤트가 정말 이겨야 넘어가나. 넘어가는 페이지마다 승리 스위치 조건이거나, 넘어가는 명령이 승리 갈래 안에만 있다. 아니면 설명. */
export function battleStepBypass(project: Project, ev: GameEvent): string | undefined {
  const won = victoryGatedSwitches(project);
  for (const [i, page] of pagesOf(ev).entries()) {
    let moves = false;
    walk(page.commands, (c) => { if (progresses(c)) moves = true; });
    if (!moves) continue;
    if (leafConds(page).some((c) => c.kind === "switch" && c.value !== false && won.has(String(c.switchId)))) continue;
    const bare = progressOutsideVictory(page.commands);
    if (!bare) continue;
    let fights = false;
    walk(page.commands, (c) => { if (c.kind === "battleProcessing") fights = true; });
    return fights ? `${i + 1}쪽이 전투 결과와 상관없이(승리 갈래 밖) ${String(bare.kind)} 를 한다` : `${i + 1}쪽이 전투 없이 ${String(bare.kind)} 를 한다(보스를 이긴 표시 스위치를 조건으로 걸지 않았다)`;
  }
  return undefined;
}

// ── 갇힌 방에서 걸어 나가는 길 ─────────────────────────────────────────────
// 왜(2026-10-29 mt3 flash 방탈출): 밀실 남쪽 틈에 시작 «빈 맵»으로 가는 이동 칸이 조건 없이 남아, 잠긴 방인데 걸어서 나갔다.
// 빈 시작 맵 은퇴(blankStart.ts)는 자리표시 맵만 치우므로, 장소 맵이 아니면서 그림이 있는 맵(옛 마을·현관)으로 가는 출구는 못 잡는다.

/** 청사진이 갇힌 방을 빠져나가는 게임인가(엔딩 = 잠긴 문 열기). */
export function isEscapeBlueprint(bp: GameBlueprint): boolean {
  return /방\s*탈출|탈출|밀실|갇힌|갇혀|잠긴\s*방|escape|locked\s*room/iu.test([bp.playerGoal, bp.ending.name, bp.ending.how, bp.request ?? ""].join(" "));
}
/** 조건 없이 열리는 페이지에서 청사진 장소가 아닌 맵으로 가는 이동. */
export interface EscapeLeak { readonly mapId: string; readonly eventId: string; readonly x: number; readonly y: number; readonly toMapId: string }
export function escapeLeaks(project: Project): EscapeLeak[] {
  const bp = project.gameBlueprint;
  if (!bp || !isEscapeBlueprint(bp)) return [];
  const places = new Set(bp.steps.flatMap((s) => { const m = findMap(project, s.place); return m ? [m.id] : []; }));
  const out: EscapeLeak[] = [];
  for (const mapId of places) for (const ev of project.maps[mapId]?.events ?? []) {
    for (const page of pagesOf(ev)) {
      if (leafConds(page).length) continue;
      let to: string | undefined;
      walk(page.commands, (cmd) => { if (!to && cmd.kind === "transfer" && typeof cmd.mapId === "string" && !places.has(cmd.mapId)) to = cmd.mapId; });
      if (to) { out.push({ mapId, eventId: ev.id, x: ev.x, y: ev.y, toMapId: to }); break; }
    }
  }
  return out;
}

/** 경로 막힘의 고칠 동사 한 줄 — 하위 도구(upsert_event·define_ending…)를 하나씩 맞추게 하지 않는다(2026-10-28 mt2 Flash: upsert_event 6번 인자 실패). */
export const BLUEPRINT_PATH_FIX = "고치기: build_blueprint_path 를 한 번 부른다 — 청사진 단계대로 이벤트·조건·스위치·아이템·엔딩 호출을 함수가 짓는다(대사만 steps[{id,lines}] 로 준다).";
export const BLUEPRINT_PATH_IDS: ReadonlySet<string> = new Set(["blueprint-event-unreachable", "blueprint-event-missing", "blueprint-event-empty", "blueprint-condition-unset", "blueprint-condition-order", "blueprint-no-ending", "blueprint-code-bypass", "blueprint-escape-leak"]);

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
  // 3b) 번호·암호를 맞히는 단계가 정말 입력을 거쳐야 넘어가나(조사만 하면 엔딩이 나오지 않나).
  for (const r of resolved) {
    if (!r.ev || !r.map || !isCodeStep(r.step)) continue;
    const why = codeStepBypass(project, r.ev);
    if (why) add("blueprint-code-bypass", `청사진 ${r.step.id} 「${r.step.event}」(${r.map.id} ${r.ev.id}) 은 번호·암호를 맞히는 단계(${r.step.action})인데 ${why} — 조사만 하면 ${r === resolved.at(-1) ? "엔딩" : "다음 단계"}로 넘어가 퍼즐이 없다.`, `${r.step.id} ${r.ev.id} ${why}`);
  }
  // 3b') 싸워 이기는 단계가 정말 이겨야 넘어가나(보스를 지나쳐 조사만 해도 엔딩이 나오지 않나).
  for (const r of resolved) {
    if (!r.ev || !r.map || isCodeStep(r.step) || !isBattleStep(r.step)) continue;
    const why = battleStepBypass(project, r.ev);
    if (why) add("blueprint-battle-bypass", `청사진 ${r.step.id} 「${r.step.event}」(${r.map.id} ${r.ev.id}) 은 싸워 이기는 단계(${r.step.action})인데 ${why} — 이기지 않아도 ${r === resolved.at(-1) ? "엔딩" : "다음 단계"}로 넘어간다. build_blueprint_path 를 다시 부르면 그 맵 보스 전투의 승리 스위치를 조건으로 걸거나(보스가 없으면 이 이벤트 안에서 싸우고 승리 갈래에서만) 넘어가게 고친다.`, `${r.step.id} ${r.ev.id} ${why}`);
  }
  // 3c) 갇힌 방 게임인데 청사진 장소 밖으로 조건 없이 걸어 나가는 이동이 있나.
  for (const leak of escapeLeaks(project)) add("blueprint-escape-leak", `방탈출 청사진인데 「${project.maps[leak.mapId]?.name ?? leak.mapId}」(${leak.mapId}) (${leak.x},${leak.y}) 이동 ${leak.eventId} 가 조건 없이 청사진 장소가 아닌 「${project.maps[leak.toMapId]?.name ?? leak.toMapId}」(${leak.toMapId})로 나간다 — 잠긴 방을 퍼즐 없이 걸어서 빠져나간다.`, `${leak.mapId} ${leak.eventId} → ${leak.toMapId}`);
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
