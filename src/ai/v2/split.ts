// 조수 v2 리드·워커 나누기(2026-11-01, 기본 꺼짐) — 비싼 모델(리드)은 요청을 할 일과 구체 사양으로 바꾸고 단계 끝에서 검토만 한다.
// 값싼 모델(워커 = 이 실행의 주 모델)이 그 사양대로 도구를 부르고, 도구 오류·재시도를 스스로 처리하며, 기계 확인 없이는 할 일을 닫지 못한다.
// 리드는 도구 호출을 하나도 보지 않는다 — 사양·요약·기계 확인 결과·변경 요약만 받는다(리드 문맥을 작게).
// 켜기: OPRN_V2_SPLIT="lead:<엔진>" — <엔진> 은 로컬 CLI(`claude:claude-opus-5-5:medium`) 또는 계정/모델(`openai-compat:proxy8318/gemini-4-argon@medium`).
//   `worker:` 칸은 받기만 한다(기록용) — 워커는 이 실행의 주 모델(편집기에서 고른 조수 모델)이다.
// 모델에게 가는 글은 영어(사용자 지시 2026-10-30). 순수 함수만 — 호출은 실행기(scripts/lib/assistantV2Runtime.ts)가 한다.
import type { Project } from "../../project/types";

export interface SplitRole { readonly provider: string; readonly model: string; readonly effort?: "low" | "medium" | "high" }
export interface SplitConfig { readonly lead: SplitRole; readonly worker?: string; readonly raw: string }

const EFFORTS = new Set(["low", "medium", "high"]);

/** 엔진 글 하나 → 역할. `claude:claude-opus-5-5:medium` = 로컬 CLI, `prov/model@effort` = 계정 모델. 못 읽으면 undefined. */
export function parseSplitRole(spec: string): SplitRole | undefined {
  const s = spec.trim();
  if (!s) return undefined;
  const cli = /^(claude|codex|gemini):([^:@\s]+)(?::(low|medium|high))?$/u.exec(s);
  if (cli) return { provider: `local-cli:${cli[1]}`, model: cli[2]!, ...(cli[3] ? { effort: cli[3] as SplitRole["effort"] } : {}) };
  const at = s.lastIndexOf("@");
  const body = at > 0 && EFFORTS.has(s.slice(at + 1)) ? s.slice(0, at) : s;
  const effort = body !== s ? (s.slice(at + 1) as SplitRole["effort"]) : undefined;
  const slash = body.lastIndexOf("/");
  if (slash <= 0 || slash === body.length - 1) return undefined;
  return { provider: body.slice(0, slash), model: body.slice(slash + 1), ...(effort ? { effort } : {}) };
}

/** OPRN_V2_SPLIT 값 → 설정. 리드가 없으면 undefined(나누지 않음). 칸 구분은 쉼표. */
export function parseSplitConfig(raw: string | undefined): SplitConfig | undefined {
  if (!raw || raw === "0" || raw === "off") return undefined;
  let lead: SplitRole | undefined, worker: string | undefined;
  for (const part of raw.split(",")) {
    const m = /^\s*(lead|worker)\s*[:=]\s*(.+?)\s*$/u.exec(part);
    if (!m) continue;
    if (m[1] === "lead") lead = parseSplitRole(m[2]!);
    else worker = m[2]!;
  }
  return lead ? { lead, ...(worker ? { worker } : {}), raw } : undefined;
}

export const SPLIT_LIMITS = { digest: 7_000, tools: 5_000, plan: 9_000, diff: 8_000, toolLog: 3_000, report: 1_500, reviews: 2, fixes: 5 } as const;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
type Obj = Record<string, unknown>;

/** 리드가 읽는 프로젝트 요약 — 맵·이벤트(이름·칸·첫 대사)·데이터베이스 이름들. 도구 호출 기록은 넣지 않는다. */
export function projectDigest(project: Project, maxChars: number = SPLIT_LIMITS.digest): string {
  const out: string[] = [];
  const maps = Object.values(project.maps ?? {});
  out.push(`Start: ${project.startMapId ?? "?"} ${project.startPos ? `(${(project.startPos as { x?: number }).x},${(project.startPos as { y?: number }).y})` : ""}`.trim());
  for (const map of maps) {
    out.push(`Map ${map.id} «${map.name}» ${map.width}x${map.height}`);
    for (const ev of (map.events ?? []).slice(0, 40)) {
      const e = ev as unknown as Obj;
      const pages = (ev.pages ?? []) as unknown as Obj[];
      const first = pages.flatMap((p) => (Array.isArray(p.commands) ? (p.commands as Obj[]) : [])).find((c) => typeof c.text === "string");
      const trig = (pages[0]?.trigger as Obj | undefined)?.kind;
      out.push(`  - ${ev.id} «${String(e.name ?? "")}» (${e.x},${e.y})${trig ? ` ${String(trig)}` : ""}${pages.length > 1 ? ` pages:${pages.length}` : ""}${first ? ` «${clip(String(first.text), 50)}»` : ""}`);
    }
  }
  const db = (project.database ?? {}) as unknown as Obj;
  const names = (key: string) => ((db[key] as Obj[] | undefined) ?? []).map((r) => `${String(r.name ?? r.id)}(${String(r.id)})`).slice(0, 30);
  for (const key of ["actors", "items", "equipment", "enemies", "troops", "skills"]) {
    const list = names(key);
    if (list.length) out.push(`DB ${key}: ${list.join(", ")}`);
  }
  const defs = (list: unknown) => ((list as Obj[] | undefined) ?? []).map((d) => `${String(d.name ?? d.id)}(${String(d.id)})`).slice(0, 40);
  const sw = defs((project as unknown as Obj).switches), vars = defs((project as unknown as Obj).variables);
  if (sw.length) out.push(`Switches: ${sw.join(", ")}`);
  if (vars.length) out.push(`Variables: ${vars.join(", ")}`);
  return clip(out.join("\n"), maxChars);
}

/** 워커 도구 목록 요약(이름 + 설명 첫 문장) — 리드가 사양에 맞는 도구 이름을 쓰게. */
export function toolCatalog(tools: readonly { readonly name: string; readonly description?: string }[], lazy: readonly string[] = [], maxChars: number = SPLIT_LIMITS.tools): string {
  const lines = tools.map((t) => `- ${t.name}: ${clip(String(t.description ?? "").replace(/\s+/gu, " ").split(/(?<=\.)\s/u)[0] ?? "", 180)}`);
  if (lazy.length) lines.push(`- (loaded on demand with load_tools / by name): ${lazy.join(", ")}`);
  return clip(lines.join("\n"), maxChars);
}

/** 리드의 계획 지시(영어). 리드는 도구를 부르지 않는다 — 워커가 따를 할 일과 사양만 쓴다. */
export function leadPlanMessages(input: { task: string; skeleton?: string; digest: string; tools: string }): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: [
      "You are the LEAD designer of an RPG editor assistant. A cheaper WORKER model will carry out your plan with the editor tools; you never call tools yourself.",
      "Turn the user's request into a plan the worker can follow without guessing. Design stays with you; the worker executes.",
      "Write plain text with exactly these sections:",
      "TODO — 4 to 10 numbered items in build order, one line each, each a concrete deliverable that a machine check could confirm (an event with given pages, a variable/switch, a branch, an ending).",
      "SPECS — for each TODO number: which tool to call (use the tool names listed), the target map/event ids or names from the project, the variables/switches to create (exact names), the page conditions and command sequence (choices, branches, counters, timers, battles, transfers, endings), and the exact Korean player-facing lines. Prefer the composite tools (for example author_puzzle_chain for clue/lock chains) when they fit. Reuse the existing named events; do not invent new ones when one with that name exists.",
      "TRAPS — up to 5 short lines on what a small model is likely to get wrong here (wrong event, missing reset, lines replaced, done without saving).",
      "Keep the user's quoted Korean lines and names exactly. Stay within the request; do not add extra content. Be compact: at most about 1,800 words.",
    ].join("\n") },
    { role: "user", content: [
      `User request (Korean):\n${input.task}`,
      input.skeleton ? `\nRequired elements extracted by the editor:\n${input.skeleton}` : "",
      `\nProject now:\n${input.digest}`,
      `\nWorker tools:\n${input.tools}`,
    ].join("\n") },
  ];
}

/** 워커의 첫 지시 뒤에 붙는 리드 계획(영어). 대화 기록 첫 줄에 남아 워커가 끝까지 본다. */
export function planForWorker(plan: string): string {
  return [
    "[Lead plan — written by the lead designer for this request. Follow it.]",
    "Make your todo list from TODO (same order, one todo item per TODO line, with the machine check that fits). Build each item with its SPEC. If a call is rejected, fix the arguments yourself and retry; do not skip the item. Keep the Korean lines exactly. An item is done only when its machine check passes.",
    clip(plan.trim(), SPLIT_LIMITS.plan),
  ].join("\n");
}

export interface LeadReview { readonly approve: boolean; readonly fixes: readonly string[]; readonly problem?: string }

/** 단계 끝 리드 검토 지시(영어). 리드는 사양·할 일 표(기계 확인)·변경 요약·워커 보고만 본다 — 도구 호출은 짧은 요약뿐. */
export function leadReviewMessages(input: { task: string; plan: string; todo: string; diff: string; toolLog: string; report: string; round: number }): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: [
      "You are the LEAD designer reviewing the WORKER's result at a phase gate. You see your plan, the todo list with machine-check results, a summary of what actually changed in the project, and the worker's report.",
      "Judge only against the user's request and your plan: is every requested behaviour actually built (events, conditions, branches, counters, lines, endings), wired to the right named events, and reachable in play? Ignore style and things the request did not ask for.",
      "Reply with JSON only: {\"approve\": true|false, \"fixes\": [\"one concrete English fix note per problem: which event/page/variable, what is wrong, what to change\"]}. At most 5 fixes, most important first. approve=true means nothing important is missing; then fixes is [].",
      "Do not ask for things the diff already shows are done. Do not re-plan from scratch.",
    ].join("\n") },
    { role: "user", content: [
      `User request (Korean):\n${input.task}`,
      `\nYour plan:\n${clip(input.plan, 5_000)}`,
      `\nTodo list (machine checks):\n${clip(input.todo, 3_000)}`,
      `\nWhat changed in the project:\n${clip(input.diff, SPLIT_LIMITS.diff)}`,
      input.toolLog ? `\nWorker tool calls (short):\n${clip(input.toolLog, SPLIT_LIMITS.toolLog)}` : "",
      `\nWorker report:\n${clip(input.report || "(none)", SPLIT_LIMITS.report)}`,
      `\nReview round ${input.round}.`,
    ].join("\n") },
  ];
}

/** 리드 검토 답 읽기. JSON 이 없으면 «승인 못 함» 문제로 — 실행을 막지 않는다(고칠 것 0). */
export function parseLeadReview(text: string): LeadReview {
  const m = /\{[\s\S]*\}/u.exec(text.replace(/```(?:json)?/gu, ""));
  if (!m) return { approve: true, fixes: [], problem: `no JSON in lead reply: ${clip(text.trim(), 120)}` };
  try {
    const j = JSON.parse(m[0]) as { approve?: unknown; fixes?: unknown };
    const fixes = Array.isArray(j.fixes) ? j.fixes.map((f) => (typeof f === "string" ? f : JSON.stringify(f))).map((f) => f.trim()).filter(Boolean).slice(0, SPLIT_LIMITS.fixes) : [];
    const approve = j.approve === true || (j.approve !== false && fixes.length === 0);
    return { approve, fixes: approve ? [] : fixes };
  } catch (error) {
    return { approve: true, fixes: [], problem: `lead reply JSON did not parse: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** 리드 검토가 고칠 것을 돌려줬을 때 워커에게 가는 재주입 머리말(영어). */
export function leadFixNote(n: number, round: number): string {
  return `[Lead review round ${round} — the lead designer checked the result against the request and the plan and returned ${n} fix(es); they were added to the todo list. Fix each with the tools and call done (the machine check still decides), or block(reason) if it cannot be done]`;
}
