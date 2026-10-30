// v2 조수 전용 — 편집기 도구 거절 글을 «다음 호출을 고칠 수 있는» 짧은 영어 글로 다시 쓴다(할 일 고리 감싸개가 부른다).
//
// 왜(2026-10-30 omo-loop-1030b terra): 모델이 받던 거절 글은 toolAdapter.formatPiToolFailure 의 JSON 한 덩이였다 —
//   {"ok":false,"summary":"'<도구>' 실행 실패: <200자에서 잘린 첫 줄>","issues":[{severity,code,message}…]}.
//   · 요약과 issues[0] 이 같은 문장을 두 번 싣고(실행 실패), 커밋 거부는 요약에 첫 위반만 «(+N건)»으로 싣는다.
//   · 문장은 규칙만 말하고(«patrol 은 behavior patrol/chase 에서만») 모델이 보낸 값·고칠 방법은 없다.
//   그래서 terra 는 stationary 에서 patrol 을 빼는 대신 patrol 을 고쳐 «patrol.directions 는 2..16개»로 또 거절됐다.
// 이 글은: 막은 이유 전부(최대 8, 코드·맵·칸), 걸린 인자와 실제로 보낸 값, argGuard/nextCall 이 고칠 수 있으면 «Fixed call: 도구({…})».
// 영어로 쓴다(2026-10-30 사용자 결정: 싼 모델은 영어 되먹임을 훨씬 잘 쓴다). 도구 오류 문장(한국어, src/editor/tools/*)은 고치지 않고
// 자주 나는 것만 아래 표(코드·정규식)로 영어로 옮기고, 못 옮긴 것은 «Tool said (Korean): …»로 그대로 넘긴다. 맵·인물 이름·대사는 그대로.
// v1·편집기 경로(toolRunner·toolAdapter)는 건드리지 않는다 — v2 감싸개(todoTools)에서만 바꿔 싣는다.
import type { Project } from "@/project/types";
import { preCheck, retryCandidates } from "./argGuard";
import { nextAfterFailure } from "./nextCall";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export interface FailureIssue { readonly severity?: string; readonly code?: string; readonly message: string; readonly mapId?: string; readonly x?: number; readonly y?: number }
export interface ParsedFailure { readonly summary: string; readonly issues: readonly FailureIssue[]; readonly extra: readonly string[] }

/** 거절 본문(JSON 한 줄 + 덧붙인 줄들, 또는 글) → 요약·이유·덧붙인 줄. 요약 안에 JSON 이 또 들어 있으면(감싸개가 감싼 거절) 풀어 쓴다. */
export function parseFailure(text: string): ParsedFailure {
  const lines = text.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first.startsWith("{")) {
    try {
      const body = JSON.parse(first) as { summary?: unknown; issues?: unknown };
      const summary = String(body.summary ?? "");
      const issues = (Array.isArray(body.issues) ? body.issues : []).filter(isObj).map((i) => ({
        ...(typeof i.severity === "string" ? { severity: i.severity } : {}),
        ...(typeof i.code === "string" ? { code: i.code } : {}),
        message: String(i.message ?? ""),
        ...(typeof i.mapId === "string" ? { mapId: i.mapId } : {}),
        ...(typeof i.x === "number" ? { x: i.x } : {}),
        ...(typeof i.y === "number" ? { y: i.y } : {}),
      }));
      const inner = summary.trim().startsWith("{") ? parseFailure(summary.trim()) : undefined;
      if (inner && !issues.length) return { summary: inner.summary, issues: inner.issues, extra: [...inner.extra, ...lines.slice(1)] };
      return { summary, issues, extra: lines.slice(1) };
    } catch { /* 글 */ }
  }
  return { summary: first, issues: [], extra: lines.slice(1) };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string) => s.replace(/\s+/gu, " ").trim();
/** «'도구' 실행 실패: …»·«'도구' 커밋 거부(무결성 오류) — …» 머리를 걷은 본문. */
const stripHead = (s: string) => s.replace(/^'[^']+'\s*(?:실행 실패|후처리 실패):\s*/u, "").replace(/^'[^']+'\s*커밋 거부\(무결성 오류\)\s*(?:—\s*)?/u, "");
const isCommitRejection = (s: string) => /커밋 거부\(무결성 오류\)/u.test(s);
/** 도구가 붙인 «다시 보낼 형식 예시»·«호출 예시»·repair JSON — 인자 이름 찾기에서는 뺀다(예시 속 칸을 보낸 칸으로 오인하지 않게). */
const EXAMPLE_TAIL = /\s*—\s*(?:다시 보낼 형식 예시|호출 예시):\s*\{.*$|\nrepair:.*$/su;
const withoutExample = (s: string) => s.replace(EXAMPLE_TAIL, "");

// ───────────── 도구 오류 → 영어 ─────────────

type Rule = { readonly code?: RegExp; readonly re: RegExp; readonly en: (m: RegExpExecArray) => string };
/** 자주 나는 도구 거절(2026-10-30 terra 판에서 센 것)부터. 첫 맞는 규칙 하나. */
const EN_RULES: readonly Rule[] = [
  { re: /^([AB]): doorAt은 문 하단 칸이며.*?받은 값 x,y=\((-?\d+),(-?\d+)\), doorAt=\((-?\d+),(-?\d+)\)/su,
    en: (m) => `${m[1]}: doorAt must be the door's bottom cell and the entrance (x,y) must be the cell directly south of it (x=doorAt.x, y=doorAt.y+1). Got x,y=(${m[2]},${m[3]}), doorAt=(${m[4]},${m[5]}). If the door is at (${m[4]},${m[5]}) send {x:${m[4]},y:${Number(m[5]) + 1},doorAt:{x:${m[4]},y:${m[5]}}}; if the entrance is at (${m[2]},${m[3]}) send {x:${m[2]},y:${m[3]},doorAt:{x:${m[2]},y:${Number(m[3]) - 1}}}. With no door picture, omit doorAt.` },
  // 캐릭터 칩 관문(charsetSelectionGate): 본 적 없는 칩을 골라 쓰기 전체가 되돌려졌다. 2026-10-30 en-loop 판 upsert_actor 재실패 1위(판당 0.33).
  { re: /^캐릭터 그림 선택을 되돌렸습니다: (\S+?)의 실제 칩은 「(.*?)」\((charset:([^:)]+):(\d+))\)/u,
    en: (m) => `Not saved: chip ${m[3]} «${m[2]}» on ${/events\/([^/]+)/u.exec(m[1]!)?.[1] ? `event ${/events\/([^/]+)/u.exec(m[1]!)![1]}` : /actors\/([^/]+)/u.exec(m[1]!)?.[1] ? `actor ${/actors\/([^/]+)/u.exec(m[1]!)![1]}` : m[1]} was not picked from a list_npc_graphics result you saw. Call list_npc_graphics{query:'<look>'}, then copy a row: events → its nativeGraphic as graphic; actors → selectionId charset:<sheet>:<slot> as characterResourceId/characterIndex. Or leave the graphic out.` },
  { re: /트룹에는 최소 1마리의 적/u, en: () => "A troop needs at least one enemy in enemyIds (or members). An empty members:[] clears enemyIds — omit members." },
  { re: /^patrol 은 behavior:"patrol" 또는 "chase"/u, en: () => `patrol is only allowed with behavior "patrol" or "chase". For any other behavior (e.g. "stationary") omit patrol entirely.` },
  { re: /^patrol\.directions 는 up\|down\|left\|right 2\.\.16개/u, en: () => "patrol.directions must be a closed path of 2..16 steps, each up|down|left|right. If you do not want a route, omit patrol.directions (or the whole patrol)." },
  { re: /^repelSteps 는 1 이상의 걸음 수/u, en: () => "repelSteps must be a whole number of steps, 1..9999. If this is not a repel item, omit repelSteps (and repelBelowLead)." },
  { re: /^transfer 목적지가 통행 불가 타일입니다: (\S+) \((-?\d+), (-?\d+)\)/u, en: (m) => `A transfer lands on a blocked tile: ${m[1]} (${m[2]},${m[3]}). This write covers an arrival cell — place it elsewhere and keep that cell walkable.` },
  { re: /완성된 집의 보호 영역은 AI가 변경할 수 없습니다/u, en: () => "That area belongs to a completed house; the assistant may not change it. Work outside the house footprint." },
  { re: /^(?:.*?)이벤트를 찾을 수 없습니다: (\S+?)(?: \(이 맵의 이벤트: (.*?)\)?)?$/su, en: (m) => `Event ${m[1]} was not found on that map${m[2] ? `. Events on this map: ${m[2]}` : ""}.` },
  { re: /^graphic 이 전투 그림과 다릅니다/u, en: () => "graphic does not match the battle picture of the troop's lead enemy. Omit graphic; the tool matches it automatically." },
  { re: /^(?:[가-힣]+ )?다시 짓기 안 함|다시 지을 방 구성도|기록이 없고/u, en: () => "edit_place will not rebuild this place (other maps link into it, or there is no build record). Do not retry edit_place for it; make local changes with move_event / stamp_object, or todo block(reason)." },
  { re: /^출입구 ([AB]) \((-?\d+),(-?\d+)\) 는 기존 출입구 (.*?) 이\(가\) 봉쇄된다/u, en: (m) => `Entrance ${m[1]} at (${m[2]},${m[3]}) would seal the existing entrance ${m[4]}, and no free cell was found nearby. Move the existing door (move_event) or pick another free cell.` },
  { re: /^문앞 \((-?\d+),(-?\d+)\)에 안전한 출입구를 만들 수 없습니다/u, en: (m) => `No safe entrance can be made at the door front (${m[1]},${m[2]}) (it must be reachable from the start or another entrance, with a free landing cell next to it). Omit doorAt so the tool picks the nearest walkable cell, or pick another cell.` },
  { re: /^출입구 자리를 찾지 못했습니다\.\s*(.*)$/su, en: (m) => `No usable entrance cell was found. Move the entrance coordinates. Tool said (Korean): ${clip(oneLine(m[1] ?? ""), 220)}` },
  // ── v2 동사(편집기 도구가 아닌 것)의 거절 — 2026-10-30 scenes-duel·scenes 판에서 센 것부터 ──
  { re: /dungeonDesign\.rooms 에 방이 둘 이상 있어야 한다/u, en: () => "dungeonDesign.rooms needs at least two rooms (an entrance room and a boss room included). Send rooms:[{id, role:'entrance', size, at}, …, {id, role:'boss', size, at}] with links between them — or omit dungeonDesign to keep the current layout." },
  { re: /^이 방은 네가 design 으로 설계한 방이라/u, en: () => "This room is one you designed with design, so dress_room does not pick furniture for it. If the floor is too empty, shrink design w/h or add groups (what, how many, where) and rebuild with edit_place({patch:{mapId, design:<the whole fixed design>}})." },
  { re: /^(\S+) 는 손 도트 실내가 아니다/u, en: (m) => `${m[1]} is not a hand-pixel interior — dress_room only fills hand-pixel interior rooms. Do not call dress_room for this map; stamp props with stamp_object, or rebuild with edit_place.` },
  { re: /^고치기 상한\((\d+)(?:바퀴|번)\)에 닿았다/u, en: (m) => `Repair limit (${m[1]} round${m[1] === "1" ? "" : "s"}) reached for this place. Do not call edit_place for it again — put the remaining problems in your report (or todo block(reason)).` },
  { re: /^고친 결과의 문제\((\d+)\)가 앞\((\d+)\)보다 많아 앞 상태로 되돌렸다/u, en: (m) => `The rebuild had more problems (${m[1]}) than before (${m[2]}), so the place was restored and this patch dropped. If rounds remain, try one smaller patch (one or two critic majors with coordinates, within those cells); otherwise report.` },
  { re: /^엔딩이 언제 열리는지 없다.*?지금 스위치: (.*)$/u, en: (m) => `The ending has no trigger — as it is, the game would end right at the start. Give afterSwitchId (e.g. the boss-defeated switch), after (a word for that event, e.g. «마왕»), or talkTo (a person on that map to talk to). Switches now: ${clip(m[1]!, 360)}` },
  { re: /^엔딩이 언제 열리는지 없다/u, en: () => "The ending has no trigger — as it is, the game would end right at the start. Give afterSwitchId (e.g. the boss-defeated switch), after (a word for that event), or talkTo (a person on that map to talk to)." },
  { re: /^「([^」]+)」 인물이 (.+?) 에 없다$/u, en: (m) => `Person «${m[1]}» is not on ${m[2]} (talkTo takes a person's name or event id on that map).` },
  { re: /^고친 결과가 더 나빠\(문제 (\d+)→(\d+)\) 되돌렸다/u, en: (m) => `The rebuild made it worse (problems ${m[1]}→${m[2]}), so it was reverted. If rounds remain, try one smaller patch (one or two critic majors with coordinates); otherwise report.` },
  { re: /^(\S+) 의 가구 옮기기 상한\((\d+)번\)에 닿았다/u, en: (m) => `Furniture-move limit (${m[2]}) reached on ${m[1]}. Do not call move_object there again — report the remaining problems.` },
  { re: /^그렇게 놓으면 바닥 (\d+)칸에 갈 수 없게 돼 되돌렸다/u, en: (m) => `Placing it there would cut off ${m[1]} floor cells from the door, so it was reverted. Pick a cell that does not block the walkway (against a wall, out of the path).` },
  { re: /^직렬화 왕복 실패: (\S+?): 알 수 없는 trigger "([^"]+)"\. 허용: (.*)$/u, en: (m) => `Save round-trip failed: ${m[1]} has an unknown trigger "${m[2]}". Allowed: ${clip(m[3]!, 120)}` },
  { re: /^(\S+) 빌더는 소품 하나하나·꾸밈\(dressing\)/u, en: (m) => `The ${m[1]} builder does not take individual props, dressing, daises or sarcophagi — only variant (another layout), features, size and floors can change. This rejection counted as a round. Do not try to fix majors those four cannot; report them.` },
  { re: /^(\S+) 는 v2 가 지은 기록이 없고 다시 지을 방 구성도 읽지 못했다/u, en: (m) => `${m[1]} has no v2 build record and its room layout could not be read, so edit_place cannot rebuild it. Build anew in place with make_place({spec:{…, mapId:'${m[1]}'}}), make local changes with move_event / stamp_object, or report it.` },
  { re: /^맵이 없습니다: (\S+)/u, en: (m) => `Map ${m[1]} does not exist. Use a mapId from the [Current project] list (or the result of the tool that built the place).` },
  { re: /^'([^']+)' 인자 검증 실패/u, en: (m) => `${m[1]} refused the arguments (validation failed) — check the field names and types in the schema; send only the fields you need.` },
  { re: /^요청 전 프로젝트에 「([^」]+)」 이벤트가 없다\(맵 (\S+?)\)/u, en: (m) => `There was no event «${m[1]}» on ${m[2]} before this request, so there is nothing to restore.` },
  { re: /^필수 인자 누락: (\S+)/u, en: (m) => `Missing required argument: ${m[1]}.` },
  { re: /^허용되지 않은 인자: (\S+) — 이 도구가 받는 인자: (.*)$/u, en: (m) => `Unknown argument: ${m[1]} — this tool accepts: ${m[2]}.` },
];
/** 도구 오류 한 줄을 영어로. 표에 없으면 «Tool said (Korean): …». 예시 JSON 은 «Example: …»로 살린다. */
export function englishToolMessage(message: string, code?: string): string {
  const example = /—\s*(?:다시 보낼 형식 예시|호출 예시):\s*(\{.*\})/su.exec(message)?.[1];
  const core = oneLine(withoutExample(message));
  for (const rule of EN_RULES) {
    if (rule.code && !(code && rule.code.test(code))) continue;
    const m = rule.re.exec(core);
    if (m) return `${rule.en(m)}${example ? ` Example: ${clip(example, 220)}` : ""}`;
  }
  return `Tool said (Korean): ${core}${example ? ` Example: ${clip(example, 220)}` : ""}`;
}

// ───────────── 보낸 값·고친 곳 ─────────────

/** 인자 안의 칸 경로(깊이 3까지)와 값. */
function argPaths(value: unknown, prefix = "", depth = 0, out: { path: string; leaf: string; value: unknown }[] = []): typeof out {
  if (!isObj(value)) return out;
  for (const [k, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push({ path, leaf: k, value: v });
    if (depth < 2 && isObj(v)) argPaths(v, path, depth + 1, out);
  }
  return out;
}
const wordAt = (text: string, word: string) => {
  const m = new RegExp(`(^|[^A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}([^A-Za-z0-9_]|$)`, "u").exec(text);
  return m ? m.index : -1;
};
const show = (v: unknown) => clip(JSON.stringify(v) ?? String(v), 140);

/**
 * 거절 글이 이름을 댄 인자와 실제로 보낸 값(글에 나온 차례). 깊은 경로(patrol.directions)가 글에 그대로 나오면 그것만, 아니면 부모만.
 * 칸 좌표로만 말하는 거절(«(0, 22)»)은 보낸 x,y 를 같이 보인다.
 */
export function offendingArgs(sent: unknown, texts: readonly string[]): { path: string; value: unknown }[] {
  const all = texts.map(withoutExample).join("\n");
  const paths = argPaths(sent).filter((p) => p.leaf !== "todoId");
  const pos = (p: { path: string; leaf: string }) => { const a = wordAt(all, p.path); return a >= 0 ? a : p.leaf.length >= 3 ? wordAt(all, p.leaf) : -1; };
  const hit = paths.map((p) => ({ ...p, at: pos(p) })).filter((p) => p.at >= 0);
  const exact = (p: { path: string }) => wordAt(all, p.path) >= 0;
  const picked = hit
    .filter((p) => !hit.some((q) => q !== p && p.path.startsWith(`${q.path}.`) && !exact(p)))
    .filter((p) => !hit.some((q) => q !== p && q.path.startsWith(`${p.path}.`) && exact(q)))
    .sort((a, b) => a.at - b.at);
  const out = picked.map((p) => ({ path: p.path, value: p.value }));
  if (isObj(sent) && /\(\s*-?\d+\s*,\s*-?\d+\s*\)/u.test(all) && sent.x !== undefined && sent.y !== undefined && !out.some((o) => o.path === "x" || o.path === "y")) {
    out.push({ path: "x,y", value: `(${String(sent.x)},${String(sent.y)})` });
  }
  return out.slice(0, 5);
}

/** 보낸 인자 → 고친 인자의 차이: 바뀐 값·넣은 칸, 그리고 뺀 칸. */
export function argDiff(sent: unknown, fixed: unknown, prefix = ""): { changed: string[]; removed: string[] } {
  const changed: string[] = [], removed: string[] = [];
  if (!isObj(sent) || !isObj(fixed)) {
    if (JSON.stringify(sent) !== JSON.stringify(fixed)) changed.push(`${prefix || "args"} ${show(sent)}→${show(fixed)}`);
    return { changed, removed };
  }
  for (const k of new Set([...Object.keys(sent), ...Object.keys(fixed)])) {
    if (k === "todoId") continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in fixed)) { removed.push(path); continue; }
    if (!(k in sent)) { changed.push(`${path}=${show(fixed[k])} added`); continue; }
    if (JSON.stringify(sent[k]) === JSON.stringify(fixed[k])) continue;
    if (isObj(sent[k]) && isObj(fixed[k]) && prefix.split(".").length < 3) {
      const inner = argDiff(sent[k], fixed[k], path);
      changed.push(...inner.changed); removed.push(...inner.removed);
    } else changed.push(`${path} ${show(sent[k])}→${show(fixed[k])}`);
  }
  return { changed, removed };
}

export interface FailureCorrection {
  /** 고친 인자(자리표시 <…> 가 남을 수 있다). reject 만 있으면 없다. */
  readonly args?: Obj;
  readonly why: string;
}

/**
 * 거절된 호출의 고친 호출 — argGuard(실행 전 규칙·거절 뒤 다시 부르기)와 nextCall(같은 도구 다시 부르기)에서 결정적으로 고른다.
 * 실행 전 규칙(빈 칸 걷기 등)을 먼저 얹고, 그 위에서 거절 글로 다시 부르기 후보를 찾는다 — 둘을 합친 인자가 고친 호출이다.
 * skip: 이미 해 본(그래도 거절된) 인자의 JSON — 같은 것을 고친 호출로 내밀지 않는다.
 */
export function correctionFor(tool: string, schema: unknown, sent: unknown, failText: string, project: Project, skip: ReadonlySet<string> = new Set()): FailureCorrection | undefined {
  if (!isObj(sent)) return undefined;
  const plain = (() => { const { todoId: _t, ...rest } = sent; return rest; })();
  const tried = (a: Obj) => skip.has(JSON.stringify(a)) || JSON.stringify(a) === JSON.stringify(plain);
  let base: Obj = plain;
  let preWhy = "";
  try {
    const pre = preCheck(tool, schema, plain, project);
    if (pre.kind === "reject") return { why: pre.message };
    if (pre.notes.length && isObj(pre.args)) {
      base = pre.args; preWhy = pre.notes.join(" · ");
      // 실행 전 규칙이 값을 바꿨으면(자리 옮김·doorAt 맞춤) 거절 글은 바꾸기 전 인자의 것이다 — 그 위에 거절 뒤 고침을 또 얹지 않는다.
      if (argDiff(plain, base).changed.length && !tried(base)) return { args: base, why: preWhy };
    }
  } catch { /* 규칙 오류는 고침 없음 */ }
  try {
    const parsed = parseFailure(failText);
    const bodies = [failText, stripHead(parsed.summary), ...parsed.issues.map((i) => i.message)].filter(Boolean);
    for (const text of bodies) {
      const cand = retryCandidates(tool, schema, base, text, project).find((c) => !tried(c.args));
      if (cand) return { args: cand.args, why: [preWhy, cand.note.replace(/called again/gu, "call again").replace(/stamped again/gu, "stamp again")].filter(Boolean).join(" · ") };
    }
  } catch { /* 없음 */ }
  if (preWhy && !tried(base)) return { args: base, why: preWhy };
  try {
    const nc = nextAfterFailure(tool, base, failText, project, new Set([tool]));
    if (nc && nc.verb === tool && !tried(nc.args)) return { args: nc.args, why: nc.why };
  } catch { /* 없음 */ }
  return undefined;
}

export interface V2FailureInput {
  readonly tool: string;
  /** 실제로 실행한 인자(실행 전 고침 뒤). */
  readonly sent: unknown;
  /** 도구가 돌려준 거절 본문 그대로(JSON 한 줄 + 덧붙인 줄, 또는 글). */
  readonly failText: string;
  readonly correction?: FailureCorrection;
  /** 이미 해 본 고침과 그 거절(같은 호출 id 로 다시 불렀는데 또 거절). */
  readonly tried?: readonly { readonly note: string; readonly failure: string }[];
  /** 글 상한(대략). */
  readonly budget?: number;
}

const FULL_CALL_MAX = 420;

/** v2 모델이 받는 거절 글(영어). 덧붙인 줄(고침·다음 호출·막힘)은 호출자가 뒤에 잇는다. */
export function formatV2Failure(input: V2FailureInput): string {
  const budget = input.budget ?? 1200;
  const parsed = parseFailure(input.failText);
  const errors = parsed.issues.filter((i) => i.severity === undefined || i.severity === "error");
  // 같은 이유가 두 번 실리면(커밋 거부가 같은 칸을 두 번 짚는다) 한 줄 «×2»로.
  const grouped: { issue: FailureIssue; n: number }[] = [];
  for (const i of (errors.length ? errors : parsed.issues).filter((x) => x.message.trim())) {
    const same = grouped.find((g) => g.issue.message === i.message && g.issue.code === i.code && g.issue.mapId === i.mapId && g.issue.x === i.x && g.issue.y === i.y);
    if (same) same.n += 1; else grouped.push({ issue: i, n: 1 });
  }
  const commit = isCommitRejection(parsed.summary);
  const head = stripHead(parsed.summary);
  const lines: string[] = [];
  // 실행 실패의 요약은 issues[0] 의 잘린 사본이다 — 이유가 하나뿐이면 머리에 한 번만 온전히 싣는다.
  const single = grouped.length === 1 && grouped[0]!.n === 1 && !commit;
  const headline = commit ? "commit refused (integrity error)"
    : single ? englishToolMessage(grouped[0]!.issue.message, grouped[0]!.issue.code)
    : /인자 검증 실패/u.test(head) ? "argument validation failed"
    : head ? englishToolMessage(head) : "failed";
  lines.push(`Rejected: ${input.tool} — ${clip(headline, single || !grouped.length ? 520 : 320)}`);
  if (grouped.length && !single) {
    const shown = grouped.slice(0, 8);
    const total = grouped.reduce((n, g) => n + g.n, 0);
    lines.push(`Blocking issues (${total})${grouped.length > shown.length ? `, first ${shown.length} kinds` : ""}:`);
    const per = Math.max(90, Math.floor((budget * 0.5) / shown.length));
    shown.forEach(({ issue: i, n }, k) => {
      const where = [i.mapId, i.x !== undefined && i.y !== undefined ? `(${i.x},${i.y})` : ""].filter(Boolean).join(" ");
      lines.push(`${k + 1}. ${i.code ? `[${i.code}] ` : ""}${where ? `${where}: ` : ""}${clip(englishToolMessage(i.message, i.code), per)}${n > 1 ? ` (x${n})` : ""}`);
    });
  }
  const texts = [parsed.summary, ...grouped.map((g) => g.issue.message)];
  const off = offendingArgs(input.sent, texts);
  if (off.length) lines.push(`You sent: ${off.map((o) => `${o.path}=${o.path === "x,y" ? String(o.value) : show(o.value)}`).join(" · ")}`);
  for (const t of (input.tried ?? []).slice(0, 2)) lines.push(`Already tried: ${clip(oneLine(t.note), 140)} → still rejected: ${clip(englishToolMessage(stripHead(parseFailure(t.failure).summary)), 160)}`);
  const c = input.correction;
  if (c?.args) {
    const sentPlain = isObj(input.sent) ? (({ todoId: _t, ...r }) => r)(input.sent) : input.sent;
    const diff = argDiff(sentPlain, c.args);
    const all = texts.map(withoutExample).join("\n");
    // 뺀 칸 중 거절 글이 말한 칸은 이름으로, 나머지(빈 기본값 걷기)는 수로만.
    const named = diff.removed.filter((p) => wordAt(all, p) >= 0 || wordAt(all, p.split(".").pop()!) >= 0);
    const quiet = diff.removed.length - named.length;
    const parts = [...named.map((p) => `remove ${p}`), ...diff.changed, ...(quiet > 0 ? [`drop ${quiet} empty/default optional field${quiet > 1 ? "s" : ""}`] : [])];
    const body = JSON.stringify(c.args).replace(/"(<[^"<>]*>)"/gu, "$1");
    if (body.length <= FULL_CALL_MAX) lines.push(`Fixed call: ${input.tool}(${body})`);
    else lines.push(`Fixed call: ${input.tool}(…same arguments you sent, with the changes below…)`);
    // 빈 기본값 걷기 목록은 «drop N …»으로 이미 셌다 — 이유 글에서 뺀다.
    const why = c.why.split(" · ").filter((w) => !w.startsWith("dropped empty/default optional fields")).join(" · ");
    lines.push(`Changes: ${clip(parts.join(" · ") || "none", 260)}${why ? ` — ${clip(oneLine(why), 220)}` : ""}`);
  } else if (c) {
    lines.push(`How to fix: ${clip(oneLine(c.why), 360)}`);
  }
  return lines.join("\n");
}

/**
 * v2 동사(편집기 도구가 아닌 것)의 거절 — 표에 있는 거절만 영어 머리를 앞에 단다(본문은 장소 이름·id 가 많아 그대로 둔다).
 * 표에 없으면 undefined(바꾸지 않는다).
 */
export function englishVerbFailureHead(tool: string, failText: string): string | undefined {
  const s = oneLine(stripHead(parseFailure(failText).summary));
  const en = englishToolMessage(s);
  return en.startsWith("Tool said (Korean)") ? undefined : `Rejected: ${tool} — ${en}`;
}

/** 거절 본문(JSON·글)의 첫 이유를 영어 한 줄로 — 할 일 막힘 글(모델용)에 쓴다. */
export function englishFailureLine(text: string, max = 200): string {
  const p = parseFailure(text);
  const first = p.issues[0];
  const raw = first?.message ?? stripHead(p.summary);
  return clip(oneLine(first ? englishToolMessage(first.message, first.code) : raw.startsWith("Rejected:") ? raw : englishToolMessage(raw)), max);
}

// ───────────── v2 동사 거절 ─────────────

/** v2 동사 요약 머리(«던전 짓기 실패: 'author_dungeon' 실행 실패: …», «add_ending_scene 실패: 적용 실패(commit-rejected): …»)를 걷는다. */
const VERB_HEAD = /^(?:'[^']+'\s*(?:실행|후처리) 실패|적용 실패\([\w-]+\)|실행 실패\(인자 검증 또는 예외\)|[A-Za-z_]+ 실패|[가-힣]+(?: [가-힣]+)? 실패)\s*:\s*|^컷신을 만들지 못했다\s*—\s*/u;
export function stripVerbHead(s: string): string {
  let t = s.trim();
  for (let i = 0; i < 4; i += 1) { const n = stripHead(t).replace(VERB_HEAD, ""); if (n === t) break; t = n; }
  return t;
}

/** dungeonDesign 방을 둘 이상으로 — 보낸 방은 남기고 입구·보스 중 빠진 것만 더한다(함수가 설계를 고르지 않는다: 자리·크기는 모델이 다시 정할 자리표시). */
function twoRoomDesign(design: unknown): Obj {
  const d = isObj(design) ? design : {};
  const rooms = (Array.isArray(d.rooms) ? d.rooms : []).filter(isObj);
  const has = (re: RegExp) => rooms.some((r) => re.test(String(r.role ?? "")));
  const out: Obj[] = [...rooms];
  if (!has(/entrance|입구/u)) out.unshift({ id: "entrance", role: "entrance", size: "small", at: "s" });
  if (!has(/boss|보스/u)) out.push({ id: "boss", role: "boss", size: "large", at: "n" });
  const ids = out.map((r) => String(r.id ?? ""));
  const links = (Array.isArray(d.links) ? d.links : []).filter(isObj).filter((l) => ids.includes(String(l.from)) && ids.includes(String(l.to)));
  const linked = links.length ? links : ids.slice(1).map((to, i) => ({ from: ids[i]!, to }));
  return { ...(typeof d.entrance === "string" && d.entrance ? { entrance: d.entrance } : { entrance: "south" }), rooms: out, links: linked };
}

/** v2 동사 거절의 결정적 고친 호출 — 표에 있는 것만. show = 모델에게 보일 호출 글(인자가 길면 바뀐 칸만 담은 짧은 호출). */
export function verbCorrection(tool: string, sent: unknown, core: string): { args: Obj; show: string; why: string } | undefined {
  if (!isObj(sent)) return undefined;
  if (/dungeonDesign\.rooms 에 방이 둘 이상/u.test(core)) {
    if (tool === "edit_place" && isObj(sent.patch)) {
      const patch = sent.patch as Obj;
      const set = isObj(patch.set) ? patch.set : {};
      const design = twoRoomDesign(set.dungeonDesign);
      const args: Obj = { patch: { mapId: patch.mapId ?? sent.mapId, set: { dungeonDesign: design } } };
      return { args, show: `edit_place(${JSON.stringify(args)})`, why: "dungeonDesign with an entrance and a boss room linked; replace the placeholder sizes/spots (at: s|n|e|w|c or 'x,y' 0–1) with your design — or omit dungeonDesign to keep the layout" };
    }
    if (tool === "make_place" && isObj(sent.spec)) {
      const spec = sent.spec as Obj;
      const design = twoRoomDesign(spec.dungeonDesign);
      const args: Obj = { ...sent, spec: { ...spec, dungeonDesign: design } };
      const body = JSON.stringify(args);
      return { args, show: body.length <= FULL_CALL_MAX ? `make_place(${body})` : `make_place({spec:{…the same spec…, dungeonDesign:${JSON.stringify(design)}}})`, why: "dungeonDesign with an entrance and a boss room linked; replace the placeholder sizes/spots with your design" };
    }
  }
  return undefined;
}

/**
 * v2 동사(편집기 레지스트리 밖: edit_place·make_place·dress_room·add_ending_scene…)의 거절을 편집기 도구와 같은 꼴로 — Rejected / You sent / Fixed call.
 * 동사 결과의 warnings·next(한국어 문장, 장소 이름이 많다)는 «Tool notes (Korean)»로 짧게 남긴다(«고침:»·형식 예시가 거기 있다).
 */
const HANGUL_RE = /[ㄱ-ㆎ가-힣]/u;
/** v2 동사 결과의 next(한국어 고정 문장, verbs.ts) → 영어. */
const NEXT_EN: readonly (readonly [RegExp, string])[] = [
  [/^명세를 고쳐 다시 부르거나 못 하는 것을 보고한다/u, "fix the spec and call again, or report what you cannot do."],
  [/^명세를 바꿔 다시 하거나\(다른 type·style\)/u, "change the spec (another type or style) and try again, or tell the user as it is."],
  [/^더 작은 패치로 한 번 더 고친다/u, "one more, smaller patch — only one or two critic majors with coordinates, within those cells (leave the whole floor and room structure alone); report the rest."],
  [/^고치기 상한/u, "repair limit reached — report the remaining problems."],
];
/** 영어로 옮기지 못한 글: 한국어면 «Tool said (Korean): …», 영어면 그대로. */
const plainOrKorean = (en: string, raw: string) => (en.startsWith("Tool said (Korean): ") && !HANGUL_RE.test(raw) ? raw : en);

export function formatV2VerbFailure(tool: string, sent: unknown, failText: string, budget = 1400): string {
  const lines0 = failText.split("\n");
  let body: Obj = {};
  try { const p = JSON.parse(lines0[0]!.trim()); if (isObj(p)) body = p; } catch { body = { summary: lines0[0] ?? "" }; }
  const parsed = parseFailure(failText);
  const core = oneLine(withoutExample(stripVerbHead(String(body.summary ?? parsed.summary))));
  const issues = parsed.issues.filter((i) => i.message.trim());
  const head = plainOrKorean(englishToolMessage(core), core);
  const out: string[] = [`Rejected: ${tool} — ${clip(head, 560)}`];
  if (issues.length > 1 || (issues.length === 1 && oneLine(issues[0]!.message) !== core)) {
    out.push(`Blocking issues (${issues.length}):`);
    issues.slice(0, 6).forEach((i, k) => out.push(`${k + 1}. ${i.code ? `[${i.code}] ` : ""}${clip(englishToolMessage(i.message, i.code), 200)}`));
  }
  const off = offendingArgs(sent, [core, ...issues.map((i) => i.message)]);
  if (off.length) out.push(`You sent: ${off.map((o) => `${o.path}=${o.path === "x,y" ? String(o.value) : show(o.value)}`).join(" · ")}`);
  const fix = verbCorrection(tool, sent, core);
  if (fix) out.push(`Fixed call: ${fix.show}`, `Changes: ${clip(fix.why, 240)}`);
  // 동사 결과의 덧붙임: 같은 문장을 되풀이하지 않고, 형식 예시는 영어 머리로.
  const warnings = (Array.isArray(body.warnings) ? body.warnings : []).map((w) => oneLine(String(w))).filter((w) => w && oneLine(withoutExample(w)) !== core);
  // «알 수 없는 hints.X 는 무시했다» 줄은 한 줄로 묶는다(빈 기본값을 채워 보낸 판에서 열 줄 넘게 나왔다).
  const ignored = warnings.map((w) => /^알 수 없는 (hints\.\S+) 는 무시했다$/u.exec(w)?.[1]).filter((x): x is string => !!x);
  const notes = [
    ...(ignored.length ? [`ignored unknown ${ignored.join(", ")}`] : []),
    ...warnings.filter((w) => !/^알 수 없는 hints\.\S+ 는 무시했다$/u.test(w)).map((w) => { const en = englishToolMessage(w); return en.startsWith("Tool said (Korean): ") ? en.slice("Tool said (Korean): ".length) : en; }),
  ];
  const left = Math.max(200, budget - out.join("\n").length);
  if (notes.length) out.push(`Tool notes${notes.some((n) => HANGUL_RE.test(n)) ? " (partly Korean)" : ""}: ${clip(notes.join(" · "), Math.floor(left * 0.7))}`);
  if (typeof body.next === "string" && body.next.trim() && !fix) {
    const next = oneLine(body.next);
    const en = NEXT_EN.find(([re]) => re.test(next))?.[1];
    out.push(en ? `Next: ${en}` : `Tool's next step${HANGUL_RE.test(next) ? " (Korean)" : ""}: ${clip(next, Math.floor(left * 0.3))}`);
  }
  // 그 밖의 칸(후보 목록·mapIds 등)은 버리지 않는다 — 짧게 JSON 으로.
  const known = new Set(["ok", "summary", "warnings", "missingArt", "next", "machineChecks", "issues", "notFailure"]);
  const others = Object.fromEntries(Object.entries(body).filter(([k, v]) => !known.has(k) && v !== undefined && !(Array.isArray(v) && !v.length)));
  if (Object.keys(others).length) out.push(`Other result fields: ${clip(JSON.stringify(others), 500)}`);
  const extra = lines0.slice(1).filter((l) => l.trim());
  if (extra.length) out.push(...extra);
  return out.join("\n");
}
