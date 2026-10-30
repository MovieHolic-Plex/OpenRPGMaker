// 조수 v2 의 `todo` 동사와 동사 감싸개(omo todotools + loop-guard 를 본뜸).
//   - todo: init/start/done/drop/block/append/view. done 은 항목의 기계 확인(runTodoCheck)을 돌려 ✗ 면 끝내지 않는다.
//   - 감싸개(모든 v2 동사·빌린 게임 도구):
//       · 쓰기 요청인데 할 일 목록이 없으면 첫 쓰기 호출을 되돌린다(두 번, 그다음엔 요청 한 줄로 목록을 대신 만든다 — 로컬 CLI 는 tool_choice 를 못 건다)
//       · 같은 도구·같은 인자 연속 3번째에 경고, 4번째부터 실행하지 않는다(omo loop-guard IDENTICAL_RUN_THRESHOLD)
//       · 쓰기 실패는 진행 중 항목의 실패로 센다 — 3번째 또는 같은 실패 서명 연속이면 막힘으로 닫고 기대는 항목도 닫는다
//       · 성공한 쓰기의 결과 지문을 고리(TodoLoop)에 넘긴다(진척 판정)
//       · 성공한 쓰기 전후 차이(맵·이벤트·아이템·적 그룹 id)를 진행 중 항목(또는 인자 todoId 의 항목) refs 에 묶는다(refs.ts)
import type { PiToolExecResult, PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import type { PiAssistantV2Env } from "../env";
import { parseTodoCheck, TODO_CHECK_SCHEMA, type CheckResult, type TodoCheck, type TodoItem } from "../todo/types";
import { checkLabel, isOpen, TODO_MAX_ATTEMPTS, type TodoInput, type TodoPhaseInput, type TodoStore } from "./todoStore";
import { callKey, effectFingerprint, maskVolatile, type TodoLoop } from "./continuation";
import { bindRefs, changedSince, checkItem, indexProject, isAmbiguous, refsFromDiff, refsLabel } from "./refs";
import { HookStats } from "./hookStats";
import { isRegistryTool, preCheck, retryCandidates } from "./argGuard";
import { correctionFor, englishFailureLine, englishVerbFailureHead, formatV2Failure } from "./failureText";
import { covers, requestSkeleton, type SkeletonElement } from "./requestSkeleton";
import { formatCall, MISSING_HIGH_VERB, VERB_SCOPE, nextAfterFailure, nextForItem, scopeRedirect, skeletonFor, strategyAfterRepeat, type NextCall } from "./nextCall";

const text = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

/** 프로젝트를 바꾸지 않는 동사·도구 — 할 일 목록 없이도 부를 수 있고, 실패해도 항목 실패로 세지 않는다. */
const READ_VERB = /^(todo|inspect|ask_user|ask_helpers|room_parts|dungeon_parts)$|^(get|list|find|read|show|preview|search|lint|check|validate|probe|describe|view|inspect)_|^store_(find|read|list|get)/u;
export const isReadVerb = (name: string): boolean => READ_VERB.test(name);

/** 무엇을 바꾸라는 요청인가(질문·조회·설명은 아니다). 이 요청에만 첫 호출 todo 를 강제한다. */
export function isWriteRequest(request: Pick<PiAgentRequest, "task" | "readOnly">): boolean {
  if (request.readOnly) return false;
  const t = request.task.trim();
  return !/\?\s*$|？\s*$|알려\s*줘|뭐야|뭐가 있|어디\s*있|있어\?|보여\s*줘|설명해|정리해서|요약해/u.test(t);
}

/** 도구 결과의 첫 글과 ok:false 여부. */
function readResult(result: PiToolExecResult | undefined): { text: string; failed: boolean } {
  const first = result?.content.find((c) => c.type === "text") as { text?: string } | undefined;
  const body = first?.text ?? "";
  let failed = false;
  try { const parsed = JSON.parse(body) as { ok?: unknown; notFailure?: unknown }; failed = parsed?.ok === false && parsed?.notFailure !== true; } catch { failed = /^\s*(실패|거절|Rejected:)|\bok\s*[:=]\s*false\b/u.test(body.slice(0, 200)); }
  // «아직 짓지 않았다(실패 아님)»(마을 땅 미리보기·굴 입구 되돌림)는 정상 흐름이다 — 항목 실패로 세지 않는다.
  if (failed && /\(실패 아님\)/u.test(body.slice(0, 300))) failed = false;
  return { text: body, failed };
}

const withNote = (result: PiToolExecResult, note: string): PiToolExecResult => ({ ...result, content: [...result.content, { type: "text", text: note }] });

const TODO_ITEM_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "string", description: "One todo line (5-15 words: what, not how), in the user's language. E.g. \"Build a boss room deep in the dungeon\"" },
    id: { type: "string", description: "Short id (optional, e.g. boss_room). Empty means t1, t2, …" },
    check: TODO_CHECK_SCHEMA,
    dependsOn: { type: "array", items: { type: "string" }, description: "ids (or contents) of items that must finish first" },
  },
  required: ["content"],
} as const;

export const TODO_TOOL_DESCRIPTION = [
  "The todo list for this request. For a write request, the first call is op:\"init\" listing the whole request as items grouped by phase — one item per place, person, line, battle, link, ending, and object in the request.",
  "Give every item a check (machine check): place=place, person=person, line=talk, battle=battle(boss), map link=link, ending=ending, item=item, present evidence=present_evidence, objective line=objective, reachable on foot=reachable. Use none only for what a machine cannot see.",
  "ops: init(list) · start(task) · done(task — runs the machine check; ✗ means it is not done) · block(task, reason — when you cannot do it: one-line reason, then the next item) · drop(task, reason — no longer needed for the request) · append(phase, items) · bind(task, mapId/eventId/itemId/troopId — the real id the item means, when the check says \"ambiguous\") · view.",
  "Map, event, item and troop ids created by a write verb are bound automatically to the item in progress — if one call builds a different item, pass todoId to that verb. A \"make X\" item never passes with something that existed before.",
  "One item in progress at a time. Mark an item done as soon as it is finished. Do not end your turn after calling only todo — continue with real verbs in the same response.",
  "Problems found by function checks, critics and screen review come back as items in this list (source shown). Report \"complete\" only when no item is open and every machine check is ✓.",
].join(" ");

/** check 인자를 정리한다. 틀리면 check 없이 두고 경고 글을 돌려준다(항목 자체는 버리지 않는다). */
function itemOf(raw: unknown, warnings: string[]): TodoInput | undefined {
  if (typeof raw === "string") return raw.trim() ? { content: raw } : undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { content?: unknown; id?: unknown; check?: unknown; dependsOn?: unknown };
  const content = typeof r.content === "string" ? r.content : "";
  if (!content.trim()) return undefined;
  let check: TodoCheck | undefined;
  if (r.check !== undefined && r.check !== null) {
    const parsed = parseTodoCheck(r.check);
    if ("error" in parsed) warnings.push(`«${content.slice(0, 40)}»: ${parsed.error} — added without a check (to fix it, append it again)`);
    else check = parsed;
  }
  const deps = Array.isArray(r.dependsOn) ? r.dependsOn.filter((d): d is string => typeof d === "string" && !!d.trim()) : [];
  return { content, ...(typeof r.id === "string" && r.id.trim() ? { id: r.id } : {}), ...(check ? { check } : {}), ...(deps.length ? { dependsOn: deps } : {}) };
}

export interface TodoToolsState {
  /** 쓰기 실패 기록(대안 동사 되돌리기용). */
  readonly failures: { name: string; text: string; at: number }[];
  /** 도구 이름 → 마지막으로 부른 호출 번호. */
  readonly calledAt: Map<string, number>;
  callNo: number;
}

/** 진행 중 항목의 실패를 세고, 막힘이면 닫는다. 돌려주는 값: 조수에게 덧붙일 한 줄. */
function attributeFailure(env: PiAssistantV2Env, store: TodoStore, sig: string, detail: string, strategy?: (item: TodoItem) => string | undefined, detailEn?: string): string | undefined {
  const item = store.current();
  if (!item) return undefined;
  const why = store.recordFailure(item, sig, detail, detailEn);
  if (!why) return undefined;
  // 막힘 이유(why)는 장부·보고에 한국어로 남고, 모델에게는 같은 사실을 영어로 준다.
  const de = (detailEn ?? detail).slice(0, 160);
  const whyEn = item.attempts >= TODO_MAX_ATTEMPTS ? `${item.attempts} failures — last: ${de}` : `the same failure ${store.meta.get(item.id)?.sigStreak ?? 2} times in a row — ${de}`;
  // H8 같은 거절 두 번: 시도 상한 전이고 전략 글이 있으면 한 번은 막지 않고 전략을 준다(그다음 같은 거절은 막는다).
  const meta = store.meta.get(item.id);
  if (strategy && meta && !meta.strategyGiven && item.attempts < TODO_MAX_ATTEMPTS && why.startsWith("같은 실패")) {
    const text = strategy(item);
    if (text) { meta.strategyGiven = true; return text; }
  }
  const cascaded = store.block(item, why, "auto");
  env.emit({ type: "execution_status", name: "v2.todo.auto_block", ok: false, summary: `할 일 ${item.id} «${item.content.slice(0, 60)}» 막힘으로 닫음 — ${why}${cascaded.length ? ` · 기대던 ${cascaded.map((c) => c.id).join(",")}도` : ""}`, data: { id: item.id, why, cascaded: cascaded.map((c) => c.id) } });
  const next = store.next();
  return `[Todo auto-blocked] ${item.id} «${item.content}» — ${whyEn}. Closed as blocked${cascaded.length ? ` (with dependent ${cascaded.map((c) => c.id).join(", ")})` : ""}. ${next ? `Moving to the next item ${next.id} «${next.content}».` : "No open items left."}`;
}

function runCheck(env: PiAssistantV2Env, store: TodoStore, item: TodoItem): CheckResult | undefined {
  try { return checkItem(env.ctx.project, store, item); }
  catch (error) {
    env.emit({ type: "execution_status", name: "v2.todo.check_error", ok: false, summary: `기계 확인(${checkLabel(item.check)}) 실행 오류 — 확인 못 함: ${error instanceof Error ? error.message : String(error)}` });
    return undefined;
  }
}

/** 「모호함」 판정에 붙이는 한 줄 — 후보 id 는 판정 글에 있다. */
export const BIND_HINT = (id: string) => `→ bind the candidate this item means with todo(op:"bind", task:"${id}", mapId|eventId|itemId|troopId:<id>) and call done again.`;

/** H1 요청 뼈대 맞추기: 모델 목록(added)이 덮지 못한 확인 요소를 «요청 뼈대» 단계로 덧붙이고, 다시 init 해 이제 덮인 뼈대 항목은 뺀다. 돌려주는 값: 결과에 붙일 한 줄. */
export function applySkeleton(env: PiAssistantV2Env, store: TodoStore, hooks: HookStats, added: readonly TodoItem[]): string | undefined {
  if (!isWriteRequest(env.request)) return undefined;
  const els = requestSkeleton(env.request.task).filter((e) => e.check);
  if (!els.length) return undefined;
  const model = store.items.filter((i) => i.source === "model");
  for (const item of store.items) {
    const key = store.meta.get(item.id)?.key;
    if (!key?.startsWith("skeleton:") || !isOpen(item.status)) continue;
    const el = els.find((e) => skeletonKey(e) === key);
    if (el && covers(model, el)) store.drop(item, "조수 목록이 이 요소를 덮는다", "auto");
  }
  const missing = els.filter((e) => !covers(model, e));
  const opened = store.append("요청 뼈대", missing.map((e) => ({ content: `[요청 뼈대] ${e.content}`, check: e.check!, key: skeletonKey(e) })), "gate");
  if (!opened.length) return undefined;
  hooks.fire("skeleton", `조수 목록이 빠뜨린 요청 요소 ${opened.length}개 덧붙임: ${opened.map((i) => i.content).join(" · ").slice(0, 300)}`, { items: opened.map((i) => ({ id: i.id, content: i.content, check: i.check })), modelItems: added.length });
  return `[Request skeleton] Added ${opened.length} element(s) that are in the request but missing from your list: ${opened.map((i) => `${i.id} «${i.content.replace("[요청 뼈대] ", "")}» (${checkLabel(i.check, true)})`).join(" · ")} — these must be finished too.`;
}
const skeletonKey = (e: SkeletonElement) => `skeleton:${e.check?.kind}:${JSON.stringify(e.check)}`;

export function createTodoTool(env: PiAssistantV2Env, store: TodoStore, state: TodoToolsState, verbNames: ReadonlySet<string>, hooks: HookStats = new HookStats()): PiToolShape {
  const done = (summary: string, ok = true, extra: Record<string, unknown> = {}): PiToolExecResult => text({ ok, summary, ...extra, list: store.view(40, true) });
  return {
    name: "todo", label: "todo", concurrency: "exclusive", description: TODO_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      properties: {
        op: { type: "string", enum: ["init", "start", "done", "drop", "block", "append", "bind", "view"], description: "todo operation" },
        list: { type: "array", description: "init: the list by phase", items: { type: "object", properties: { phase: { type: "string", description: "phase name (short noun phrase)" }, items: { type: "array", items: TODO_ITEM_SCHEMA } }, required: ["phase", "items"] } },
        phase: { type: "string", description: "append: phase name to add to" },
        items: { type: "array", items: TODO_ITEM_SCHEMA, description: "append: items to add" },
        task: { type: "string", description: "start/done/drop/block: item id (or its exact content). done with no task means the item in progress" },
        reason: { type: "string", description: "block/drop: one-line reason (for block, what stopped you — the gist of the tool rejection if any)" },
        mapId: { type: "string", description: "bind: the map id this item means" },
        eventId: { type: "string", description: "bind: the event id this item means (or mapId:eventId)" },
        itemId: { type: "string", description: "bind: the item id this item means" },
        troopId: { type: "string", description: "bind: the troop id this item means" },
      },
      required: ["op"],
    },
    async execute(id, params) {
      const p = (params ?? {}) as { op?: string; list?: unknown; phase?: string; items?: unknown; task?: string; reason?: string; mapId?: string; eventId?: string; itemId?: string; troopId?: string };
      const op = String(p.op ?? "view");
      const warnings: string[] = [];
      let result: PiToolExecResult;
      const target = (): TodoItem | undefined => store.resolve(p.task) ?? (op === "done" || op === "block" || op === "bind" ? store.current() : undefined);
      const notFound = () => done(`Item «${p.task ?? ""}» not found — pass its id (t1…) or its exact content`, false);
      switch (op) {
        case "init": {
          const raw = Array.isArray(p.list) ? p.list : Array.isArray(p.items) ? [{ phase: p.phase ?? "할 일", items: p.items }] : [];
          const phases: TodoPhaseInput[] = raw.map((ph) => {
            const o = (ph ?? {}) as { phase?: unknown; items?: unknown };
            return { phase: typeof o.phase === "string" ? o.phase : "할 일", items: (Array.isArray(o.items) ? o.items : []).map((it) => itemOf(it, warnings)).filter((it): it is TodoInput => !!it) };
          }).filter((ph) => ph.items.length);
          if (!phases.length) { result = done("The list is empty — write it as list:[{phase, items:[{content, check}]}]", false); break; }
          const added = store.init(phases);
          const skeletonNote = applySkeleton(env, store, hooks, added);
          const unchecked = added.filter((i) => !i.check || i.check.kind === "none").length;
          const first = store.current();
          env.emit({ type: "execution_status", name: "v2.todo.init", ok: true, summary: `할 일 ${added.length}개(기계 확인 ${added.length - unchecked})`, data: { items: added.map(({ id: iid, content, check }) => ({ id: iid, content, check })) } });
          result = done(`Wrote ${added.length} todo items${unchecked ? ` (${unchecked} without a machine check — if they can be checked, append them again with a check)` : ""}. ${first ? `${first.id} «${first.content}» is now in progress — continue with a verb in this same response.` : ""}${skeletonNote ? `\n${skeletonNote}` : ""}`, true, warnings.length ? { warnings } : {});
          break;
        }
        case "append": {
          const raw = Array.isArray(p.items) ? p.items : [];
          const inputs = raw.map((it) => itemOf(it, warnings)).filter((it): it is TodoInput => !!it);
          if (!inputs.length) { result = done("Nothing to append — items:[{content, check}]", false); break; }
          const opened = store.append(p.phase ?? "덧붙임", inputs, "model");
          result = done(`Appended ${opened.length} items`, true, warnings.length ? { warnings } : {});
          break;
        }
        case "start": {
          const item = target();
          if (!item) { result = notFound(); break; }
          store.start(item);
          result = done(`${item.id} in progress`);
          break;
        }
        case "done": {
          const item = target();
          if (!item) { result = notFound(); break; }
          if (!isOpen(item.status) && item.status !== "blocked") { result = done(`${item.id} is already ${item.status === "completed" ? "done" : "dropped"}`); break; }
          const check = runCheck(env, store, item);
          const bound = refsLabel(item.refs, true);
          const ce = check?.en ?? check?.detail ?? "";
          if (store.done(item, check)) {
            const next = store.current();
            env.emit({ type: "execution_status", name: "v2.todo.done", ok: true, summary: `할 일 ${item.id} ✓${check ? ` — ${check.detail.slice(0, 120)}` : ""}${bound ? ` · ${bound}` : ""}` });
            result = done(`${item.id} ✓${check ? ` machine check: ${ce}` : ""}${bound ? ` (${bound})` : ""}. ${next ? `Next: ${next.id} «${next.content}» — continue now.` : store.openCount() ? "" : "No open items."}`);
          } else {
            const why = attributeFailure(env, store, `check:${maskVolatile(check!.detail).slice(0, 160)}`, `기계 확인 ✗ ${check!.detail}`, undefined, `machine check ✗ ${ce}`);
            env.emit({ type: "execution_status", name: "v2.todo.false_done", ok: false, summary: `할 일 ${item.id} done 요청 — 기계 확인 ✗: ${check!.detail.slice(0, 160)}` });
            const hint = isAmbiguous(check) ? ` ${BIND_HINT(item.id)}` : "";
            result = done(`${item.id} is not done — machine check (${checkLabel(item.check, true)}) ✗: ${ce}${bound ? ` (${bound})` : ""}.${hint} Fix it and call done again, or block(reason) if you cannot. Reporting it finished while the check is ✗ is a false completion.${why ? `\n${why}` : ""}`, false, check!.evidence ? { evidence: check!.evidence } : {});
          }
          break;
        }
        case "drop":
        case "block": {
          const item = target();
          if (!item) { result = notFound(); break; }
          const reason = String(p.reason ?? "").trim();
          if (!reason) { result = done(`${op} needs a reason (one line)`, false); break; }
          if (op === "block") {
            // 거절 글이 대안 동사를 일렀는데 아직 안 써 봤으면 한 번 되돌린다(omo: 막힘은 «어렵다»가 아니라 다른 길이 없을 때만).
            const meta = store.meta.get(item.id) ?? {};
            const recent = state.failures.filter((f) => f.at >= state.callNo - 8).at(-1);
            const alternatives = recent ? [...verbNames].filter((n) => n !== recent.name && n !== "todo" && new RegExp(`(^|[^a-z_])${n}([^a-z_]|$)`, "u").test(recent.text) && (state.calledAt.get(n) ?? 0) < recent.at) : [];
            if (alternatives.length && !meta.blockBounced) {
              meta.blockBounced = true; store.meta.set(item.id, meta);
              env.emit({ type: "execution_status", name: "v2.todo.block_bounce", ok: false, summary: `할 일 ${item.id} 막힘 되돌림 — ${recent!.name} 거절 글이 이른 ${alternatives.join(", ")} 를 아직 안 씀` });
              // 되돌릴 때는 «무엇을 부를지»를 채운 호출 하나로 준다(H7 뼈대) — 2026-10-30 ce04 판: 막힘 되돌림이 판당 0.33, 모델은 같은 막힘을 다시 보냈다.
              // 그 항목의 다음 호출이 대안 동사면 그것, 아니면 첫 대안 동사의 뼈대. 다음 차례 상태 카드가 그 호출을 보인다(H3 강제는 걸지 않는다 — 대안이 여럿이면 다른 대안도 맞다). 두 번째 막힘은 받는다(blockBounced).
              const fromItem = nextForItem(item, env.ctx.project, verbNames);
              const alt = alternatives[0]!;
              const call: NextCall = fromItem && alternatives.includes(fromItem.verb) ? fromItem
                : { verb: alt, args: skeletonFor(alt, /\b(map_[\w-]+)/u.exec(`${item.content} ${recent!.text}`)?.[1]), why: `the ${recent!.name} rejection names ${alt}` };
              const callText = formatCall(call);
              store.meta.set(item.id, { ...meta, nextCall: { verb: call.verb, text: callText } });
              result = done(`Not blocked yet — ${englishFailureLine(recent!.text, 220)} That ${recent!.name} rejection points to ${alternatives.join(", ")}, which you have not tried for ${item.id}. Next call: ${callText}. If that also fails, send todo block again with the reason — the second block is accepted.`, false);
              break;
            }
            const cascaded = store.block(item, reason, "model");
            env.emit({ type: "execution_status", name: "v2.todo.block", ok: false, summary: `할 일 ${item.id} 막힘 — ${reason.slice(0, 160)}${cascaded.length ? ` · 기대던 ${cascaded.map((c) => c.id).join(",")}도` : ""}` });
            const next = store.current();
            result = done(`${item.id} closed as blocked${cascaded.length ? ` (with dependent ${cascaded.map((c) => c.id).join(", ")})` : ""}. ${next ? `Next: ${next.id} «${next.content}» — continue now.` : ""}`);
          } else {
            store.drop(item, reason, "model");
            const next = store.current();
            result = done(`${item.id} dropped. ${next ? `Next: ${next.id} «${next.content}»` : ""}`);
          }
          break;
        }
        case "bind": {
          const item = target();
          if (!item) { result = notFound(); break; }
          const want = { mapIds: p.mapId?.trim() ? [p.mapId.trim()] : undefined, eventIds: p.eventId?.trim() ? [p.eventId.trim()] : undefined, itemIds: p.itemId?.trim() ? [p.itemId.trim()] : undefined, troopIds: p.troopId?.trim() ? [p.troopId.trim()] : undefined };
          const project = env.ctx.project;
          const missing = [
            ...(want.mapIds ?? []).filter((m) => !project.maps[m]).map((m) => `map ${m}`),
            ...(want.eventIds ?? []).filter((e) => !Object.values(project.maps).some((m) => m?.events?.some((ev) => ev.id === e || `${m.id}:${ev.id}` === e))).map((e) => `event ${e}`),
            ...(want.itemIds ?? []).filter((i) => !(project.database?.items ?? []).some((x) => String(x.id) === i)).map((i) => `item ${i}`),
            ...(want.troopIds ?? []).filter((t) => !(project.database?.troops ?? []).some((x) => String(x.id) === t)).map((t) => `troop ${t}`),
          ];
          if (!want.mapIds && !want.eventIds && !want.itemIds && !want.troopIds) { result = done("bind needs one of mapId, eventId, itemId, troopId", false); break; }
          if (missing.length) { result = done(`Unknown id: ${missing.join(", ")} — pass a candidate id exactly as the check listed it`, false); break; }
          // 모델이 직접 묶으면 그 종류의 자동 묶음을 바꾼다(자동 묶기가 엉뚱한 것을 붙였을 수 있다).
          for (const k of ["mapIds", "eventIds", "itemIds", "troopIds"] as const) if (want[k] && item.refs) delete item.refs[k];
          bindRefs(item, want, project, false);
          const check = runCheck(env, store, item);
          env.emit({ type: "execution_status", name: "v2.todo.bind", ok: true, summary: `할 일 ${item.id} 묶음 — ${refsLabel(item.refs)}${check ? ` · 확인 ${check.pass ? "✓" : "✗"}` : ""}` });
          result = done(`${item.id} ${refsLabel(item.refs, true)}${check ? ` · machine check now ${check.pass ? "✓" : "✗"}: ${check.en ?? check.detail}` : ""}${check?.pass ? " — close it with done." : ""}`);
          break;
        }
        default:
          result = done("todo list");
      }
      const parsed = JSON.parse((result.content[0] as { text: string }).text) as { ok: boolean; summary: string };
      // 항목을 닫거나 뺐으면 그 항목을 위해 걸어 둔 «다음 호출 우선»(H3)을 내린다.
      if (parsed.ok && (op === "block" || op === "drop" || op === "done" || op === "start")) env.clearToolPreference?.();
      env.record({ toolCallId: id, name: "todo", args: params, result: { ok: parsed.ok, summary: `todo ${op}: ${parsed.summary}`.slice(0, 300) } });
      return result;
    },
  };
}

const TODO_ID_PARAM = { type: "string", description: "id of the todo item this call builds (optional) — empty binds it to the item in progress" } as const;
/** 쓰기 동사 인자 스키마에 todoId 를 더한다(객체 스키마일 때만). */
function withTodoId(schema: PiToolShape["parameters"]): PiToolShape["parameters"] {
  const s = schema as unknown as { type?: string; properties?: Record<string, unknown> } | undefined;
  if (!s || s.type !== "object" || !s.properties || "todoId" in s.properties) return schema;
  return { ...s, properties: { ...s.properties, todoId: TODO_ID_PARAM } } as unknown as PiToolShape["parameters"];
}
function splitTodoId(raw: unknown): { params: unknown; todoId?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("todoId" in raw)) return { params: raw };
  const { todoId, ...rest } = raw as { todoId?: unknown };
  return { params: rest, ...(typeof todoId === "string" && todoId.trim() ? { todoId: todoId.trim() } : {}) };
}

/**
 * v2 동사 목록에 todo 를 더하고 나머지를 감싼다. loop 는 진척 판정용(성공한 쓰기 결과 지문).
 * 쓰기 요청인데 목록 없이 쓰기 동사를 부르면 두 번 되돌리고, 세 번째에는 요청 한 줄로 목록을 대신 적고 진행한다.
 */
export function withTodoLoop(env: PiAssistantV2Env, store: TodoStore, loop: TodoLoop, tools: readonly PiToolShape[], hooks: HookStats = new HookStats()): PiToolShape[] {
  hooks.emit = env.emit;
  const writeRequest = isWriteRequest(env.request);
  const state: TodoToolsState = { failures: [], calledAt: new Map(), callNo: 0 };
  const verbNames = new Set(tools.map((t) => t.name));
  let firstWriteBounces = 0;
  let lastKey = "";
  let same = 0;
  // H3 — 거절 뒤 다음 호출 우선: 고른 동사가 불리면 내린다. 거절 뒤로 부른 동사(같은 제안을 되풀이하지 않게).
  let pendingPrefer: string | undefined;
  const sinceFailure = new Set<string>();
  /** H5 — 항목마다 이 항목에 묶여 부른 쓰기 동사. */
  const itemVerbs = new Map<string, Set<string>>();
  const remember = (nc: NextCall) => {
    const cur = store.current();
    if (cur) store.meta.set(cur.id, { ...(store.meta.get(cur.id) ?? {}), nextCall: { verb: nc.verb, text: formatCall(nc) } });
  };
  const prefer = (nc: NextCall, line: string) => {
    remember(nc);
    if (!env.preferToolNextTurn) return;
    env.preferToolNextTurn(nc.verb, line);
    pendingPrefer = nc.verb;
    hooks.fire("prefer", `다음 차례 ${nc.verb} 우선`, { verb: nc.verb });
  };
  /** H8 — 같은 항목에서 같은 거절 두 번: 전략 글(한 번). */
  const strategyFor = (toolName: string, failText: string) => (item: TodoItem): string | undefined => {
    const st = strategyAfterRepeat(toolName, failText, item, verbNames);
    if (!st) return undefined;
    hooks.fire("strategy", `${item.id} ${toolName}: ${st.text.slice(0, 160)}`, { item: item.id, tool: toolName });
    const line = `${st.text}${st.call ? ` Next call: ${formatCall(st.call)}` : ""}`;
    if (st.call) prefer(st.call, line);
    return line;
  };
  /** H3 — 거절 하나 뒤의 다음 호출 한 줄(막힘·전략 글이 없을 때). */
  const suggestNext = (toolName: string, args: unknown, failText: string): string | undefined => {
    let nc: NextCall | undefined;
    try { nc = nextAfterFailure(toolName, args, failText, env.ctx.project, verbNames, sinceFailure); } catch { nc = undefined; }
    sinceFailure.clear();
    if (!nc) return undefined;
    const line = `[Next call] ${formatCall(nc)} — ${nc.why}. Make this call, or todo block(reason) if you cannot.`;
    hooks.fire("next_call", `${toolName} 거절 뒤 → ${formatCall(nc).slice(0, 200)}`, { tool: toolName, verb: nc.verb });
    prefer(nc, line);
    return line;
  };
  const wrap = (tool: PiToolShape): PiToolShape => Object.assign(Object.create(Object.getPrototypeOf(tool)) as PiToolShape, tool, {
    ...(isReadVerb(tool.name) ? {} : { parameters: withTodoId(tool.parameters) }),
    execute: async (id: string, rawParams: unknown, signal?: AbortSignal): Promise<PiToolExecResult> => {
      state.callNo += 1;
      const write = !isReadVerb(tool.name);
      // todoId 는 감싸개 몫이다 — 동사에는 넘기지 않는다.
      const { params, todoId } = splitTodoId(rawParams);
      if (write && writeRequest && !store.initialized) {
        if (firstWriteBounces < 2) {
          firstWriteBounces += 1;
          env.emit({ type: "execution_status", name: "v2.todo.first", ok: false, summary: `할 일 목록 없이 ${tool.name} — 되돌림(${firstWriteBounces}/2)` });
          return text({ ok: false, summary: `[Todo first] Before writing, list the whole request as phased items with todo(op:"init") (a check on each item). Then repeat this ${tool.name} call in the same response.` });
        }
        store.init([{ phase: "요청", items: [{ content: `요청 전체: ${env.request.task.trim().slice(0, 160)}` }] }]);
        applySkeleton(env, store, hooks, []);
        env.emit({ type: "execution_status", name: "v2.todo.auto_init", ok: false, summary: "조수가 할 일 목록을 두 번 거르고 쓰기를 불러 — 요청 한 줄로 목록을 대신 적었다" });
      }
      const key = callKey(tool.name, params);
      same = key === lastKey ? same + 1 : 1;
      lastKey = key;
      if (same >= 4) {
        env.emit({ type: "execution_status", name: "v2.loop_guard.block", ok: false, summary: `${tool.name} 같은 인자 ${same}번째 — 실행하지 않음` });
        const why = write ? attributeFailure(env, store, `repeat:${tool.name}`, `${tool.name} 를 같은 인자로 ${same}번 되풀이`, undefined, `${tool.name} repeated ${same} times with the same arguments`) : undefined;
        return text({ ok: false, summary: `[Repeated call blocked] call ${same} of ${tool.name} with the same arguments — not run; the result would be the same as before. Change the arguments, use another verb, or todo block(reason) if you cannot.${why ? `\n${why}` : ""}` });
      }
      state.calledAt.set(tool.name, state.callNo);
      sinceFailure.add(tool.name);
      if (pendingPrefer && tool.name === pendingPrefer) { env.clearToolPreference?.(); pendingPrefer = undefined; }
      // 묶을 항목: 인자 todoId 의 항목, 없으면 진행 중 항목. 판정이 refs 를 쓰는 항목일 때만 전후 지문을 뜬다.
      const bindTo = write ? (todoId ? store.resolve(todoId) : undefined) ?? store.current() : undefined;
      const before = bindTo?.check && bindTo.check.kind !== "none" ? indexProject(env.ctx.project) : undefined;
      // H5 동사 범위(nextCall.ts VERB_SCOPE): 항목 종류의 상위 동사를 아직 안 부르고 하위 도구로 조립하려 하면 항목마다 한 번 돌려보내고 상위 동사 호출을 준다.
      // 같은 호출을 다시 하면 실행한다(실패로 세지 않는다). 상위 동사가 없는 종류(전투·엔딩)는 기록만 한다.
      if (write && bindTo && isOpen(bindTo.status)) {
        const meta = store.meta.get(bindTo.id) ?? {};
        const kind = bindTo.check?.kind ?? "";
        const missing = MISSING_HIGH_VERB[kind] && !(VERB_SCOPE[kind]?.high ?? []).some((v) => verbNames.has(v)) && (kind !== "battle" || (bindTo.check as { boss?: boolean }).boss) ? MISSING_HIGH_VERB[kind] : undefined;
        if (missing && !meta.scoped) {
          store.meta.set(bindTo.id, { ...meta, scoped: true });
          hooks.fire("scope", `${bindTo.id} ${kind}: 상위 동사 없음 — ${tool.name} 로 조립 (${missing})`, { item: bindTo.id, kind, tool: tool.name, missingHighVerb: true });
        } else if (!meta.scoped) {
          let redirect: NextCall | undefined;
          try { redirect = scopeRedirect(bindTo, tool.name, itemVerbs.get(bindTo.id), env.ctx.project, verbNames); } catch { redirect = undefined; }
          if (redirect) {
            store.meta.set(bindTo.id, { ...meta, scoped: true, nextCall: { verb: redirect.verb, text: formatCall(redirect) } });
            hooks.fire("scope", `${bindTo.id} ${kind}: ${tool.name} → ${redirect.verb}`, { item: bindTo.id, kind, tool: tool.name, to: redirect.verb });
            prefer(redirect, `${bindTo.id} is built with ${redirect.verb}`);
            const summary = `[Verb scope — not run (not a failure)] ${bindTo.id} «${bindTo.content.slice(0, 60)}» (${checkLabel(bindTo.check, true)}) is built with one high-level verb call, not piece by piece with the low-level tool ${tool.name} — Next call: ${formatCall(redirect)}. If you really need ${tool.name}, repeat the same call and it will run.`;
            if (isRegistryTool(tool.name)) env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: true, summary: summary.slice(0, 400), notFailure: true } as never }); // 실패 아님 — tool_end 를 FAIL 로 남기지 않는다
            return text({ ok: false, notFailure: true, summary });
          }
        }
      }
      if (write && bindTo) { const set = itemVerbs.get(bindTo.id) ?? new Set<string>(); set.add(tool.name); itemVerbs.set(bindTo.id, set); }
      // H2 실행 전 인자 검사·보정(argGuard.ts): 답이 하나뿐이면 고쳐 실행하고 결과에 «고침:», 아니면 실행하지 않고 고친 호출 예시를 돌려준다.
      const fixNotes: string[] = [];
      let callParams = params;
      const pre = preCheck(tool.name, tool.parameters, params, env.ctx.project);
      if (pre.kind === "reject") {
        hooks.fire("arg_reject", `${tool.name}: ${pre.message}`, { tool: tool.name });
        const summary = `[Argument check — not run] ${pre.message}`;
        env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: false, summary: summary.slice(0, 400) } });
        if (write) state.failures.push({ name: tool.name, text: summary, at: state.callNo });
        const why = write ? attributeFailure(env, store, `${tool.name}:arg:${maskVolatile(pre.message).slice(0, 120)}`, `${tool.name} 인자 거절: ${pre.message.slice(0, 200)}`, undefined, `${tool.name} arguments refused: ${pre.message.slice(0, 200)}`) : undefined;
        return text({ ok: false, summary: `${summary}${why ? `\n${why}` : ""}` });
      }
      if (pre.notes.length) {
        callParams = pre.args;
        fixNotes.push(...pre.notes);
        hooks.fire("arg_fix", `${tool.name}: ${pre.notes.join(" · ")}`, { tool: tool.name });
      }
      // 실행 — 거절되면 결정적으로 고칠 수 있는 것만 같은 호출 id 로 다시 부른다(retryCandidates). 실패한 쓰기는 커밋되지 않는다.
      const attempt = async (p: unknown): Promise<{ result?: PiToolExecResult; error?: unknown; failText?: string }> => {
        try {
          const r = await tool.execute(id, p, signal);
          const rr = readResult(r);
          return rr.failed ? { result: r, failText: rr.text } : { result: r };
        } catch (error) { return { error, failText: error instanceof Error ? error.message : String(error) }; }
      };
      let outcome = await attempt(callParams);
      const triedFixes: { note: string; failure: string; args: unknown }[] = [];
      if (outcome.failText !== undefined && !signal?.aborted && isRegistryTool(tool.name)) {
        let candidates: ReturnType<typeof retryCandidates> = [];
        try { candidates = retryCandidates(tool.name, tool.parameters, callParams, outcome.failText, env.ctx.project); } catch { candidates = []; }
        for (const cand of candidates.slice(0, 4)) {
          const again = await attempt(cand.args);
          if (again.failText === undefined) {
            hooks.fire("retry_fix", `${tool.name}: ${cand.note}`, { tool: tool.name });
            fixNotes.push(cand.note);
            outcome = again; callParams = cand.args;
            break;
          }
          triedFixes.push({ note: cand.note, failure: again.failText ?? "", args: cand.args });
        }
      }
      // 편집기 도구 거절을 모델이 바로 고칠 수 있는 글로(failureText.ts): 막은 이유 전부·걸린 인자의 보낸 값·고친 호출.
      // 기록·실패 세기(state.failures·attributeFailure)는 원래 글 그대로 쓴다 — 같은 거절인지 가르는 서명이 바뀌지 않게.
      const forModel = (failText: string): string => {
        if (!isRegistryTool(tool.name)) { const head = englishVerbFailureHead(tool.name, failText); return head ? `${head}\n${failText}` : failText; }
        try {
          const correction = correctionFor(tool.name, tool.parameters, callParams, failText, env.ctx.project, new Set(triedFixes.map((t) => JSON.stringify(t.args))));
          return formatV2Failure({ tool: tool.name, sent: callParams, failText, ...(correction ? { correction } : {}), tried: triedFixes });
        } catch { return failText; }
      };
      let result: PiToolExecResult;
      if (outcome.error !== undefined) {
        const error = outcome.error;
        const message = error instanceof Error ? error.message : String(error);
        const shown = signal?.aborted ? message : forModel(message);
        if (write && !signal?.aborted) {
          state.failures.push({ name: tool.name, text: message, at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(message).slice(0, 160)}`, `${tool.name} 실패: ${message}`, strategyFor(tool.name, message), `${tool.name} failed: ${englishFailureLine(message)}`);
          const next = note ? undefined : suggestNext(tool.name, callParams, message);
          // 고친 호출을 이미 실었으면 같은 도구의 [다음 호출] 줄은 겹친다(우선 순위 지정은 suggestNext 안에서 이미 했다).
          const nextLine = next && !(shown.includes("\nFixed call: ") && next.startsWith(`[Next call] ${tool.name}(`)) ? next : undefined;
          if (note || nextLine || fixNotes.length) throw new Error([shown, ...fixNotes.map((n) => `Fixed before run: ${n}`), ...(note ? [note] : []), ...(nextLine ? [nextLine] : [])].join("\n"));
        }
        if (shown !== message) throw new Error(shown);
        throw error;
      }
      result = outcome.result!;
      {
        const r0 = readResult(result);
        if (r0.failed && !signal?.aborted) {
          const shown = forModel(r0.text);
          if (shown !== r0.text) { const at = result.content.findIndex((c) => c.type === "text"); result = { ...result, content: result.content.map((c, k) => k === at ? { type: "text" as const, text: shown } : c) }; }
        }
      }
      if (fixNotes.length) result = withNote(result, `Fixed: ${fixNotes.join(" · ")}`);
      const read = readResult(outcome.result);
      const notes: string[] = [];
      if (write) {
        if (read.failed) {
          state.failures.push({ name: tool.name, text: read.text.slice(0, 1200), at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(read.text).slice(0, 160)}`, `${tool.name} 거절: ${read.text.slice(0, 240)}`, strategyFor(tool.name, read.text), `${tool.name} rejected: ${englishFailureLine(read.text)}`);
          if (note) notes.push(note);
          else {
            const next = suggestNext(tool.name, callParams, read.text);
            const sent = (result.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
            if (next && !(sent.includes("\nFixed call: ") && next.startsWith(`[Next call] ${tool.name}(`))) notes.push(next);
          }
        } else {
          loop.noteEffect(effectFingerprint(tool.name, params, read.text));
          { const cur = bindTo ?? store.current(); const m = cur ? store.meta.get(cur.id) : undefined; if (m?.nextCall?.verb === tool.name) { const { nextCall: _n, ...rest } = m; store.meta.set(cur!.id, rest); } }
          if (bindTo && before) {
            const add = refsFromDiff(bindTo, tool.name, changedSince(before, indexProject(env.ctx.project)), env.ctx.project);
            const added = add ? bindRefs(bindTo, add, env.ctx.project) : [];
            if (added.length) env.emit({ type: "execution_status", name: "v2.todo.autobind", ok: true, summary: `할 일 ${bindTo.id} ← ${tool.name}: ${refsLabel(bindTo.refs)}`, data: { id: bindTo.id, verb: tool.name, refs: bindTo.refs } });
          }
          // H4 쓰기 성공 직후 즉시 검사: 묶인 항목의 기계 확인을 바로 돌린다 — ✓ 면 자동으로 끝내고 다음 항목을 올리고(todo done 호출 낭비를 줄인다),
          // ✗ 면 그 이유를 이 결과에 바로 싣는다(끝에서야 알던 것을 지금). 실패로 세지 않는다.
          if (bindTo && before && isOpen(bindTo.status)) {
            const check = runCheck(env, store, bindTo);
            if (check) {
              hooks.fire("auto_check", `${bindTo.id} ${check.pass ? "✓" : "✗"} ← ${tool.name}: ${check.detail.slice(0, 160)}`, { item: bindTo.id, pass: check.pass });
              if (check.pass) {
                store.done(bindTo, check, "auto");
                hooks.fire("auto_done", `${bindTo.id} «${bindTo.content.slice(0, 60)}» 자동 끝`, { item: bindTo.id });
                env.emit({ type: "execution_status", name: "v2.todo.auto_done", ok: true, summary: `할 일 ${bindTo.id} 쓰기 직후 기계 확인 ✓ — 닫음: ${check.detail.slice(0, 120)}` });
                const next = store.current();
                const nc = next ? nextForItem(next, env.ctx.project, verbNames) : undefined;
                notes.push(`[Auto-check ✓] ${bindTo.id} «${bindTo.content}» done — ${(check.en ?? check.detail).slice(0, 200)}. ${next ? `Next: ${next.id} «${next.content}»${nc ? ` — Next call: ${formatCall(nc)}` : ""} (no need to call todo done)` : store.openCount() ? "" : "No open items."}`);
              } else {
                store.meta.set(bindTo.id, { ...(store.meta.get(bindTo.id) ?? {}), lastCheck: check });
                notes.push(`[Auto-check] ${bindTo.id} «${bindTo.content.slice(0, 60)}» still ✗ — ${(check.en ?? check.detail).slice(0, 240)}${isAmbiguous(check) ? ` ${BIND_HINT(bindTo.id)}` : ""}`);
              }
            }
          }
        }
      }
      if (same === 3) {
        env.emit({ type: "execution_status", name: "v2.loop_guard.warn", ok: false, summary: `${tool.name} 같은 인자 3번째` });
        notes.push(`[Repeat warning] ${tool.name} was called 3 times with the same arguments. The next identical call will not run — change the arguments or move to the next item.`);
      }
      return notes.length ? withNote(result, notes.join("\n")) : result;
    },
  });
  return [createTodoTool(env, store, state, verbNames, hooks), ...tools.map(wrap)];
}
