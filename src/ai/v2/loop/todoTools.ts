// 조수 v2 의 `todo` 동사와 동사 감싸개(omo todotools + loop-guard 를 본뜸).
//   - todo: init/start/done/drop/block/append/view. done 은 항목의 기계 확인(runTodoCheck)을 돌려 ✗ 면 끝내지 않는다.
//   - 감싸개(모든 v2 동사·빌린 게임 도구):
//       · 쓰기 요청인데 할 일 목록이 없으면 첫 쓰기 호출을 되돌린다(두 번, 그다음엔 요청 한 줄로 목록을 대신 만든다 — 로컬 CLI 는 tool_choice 를 못 건다)
//       · 같은 도구·같은 인자 연속 3번째에 경고, 4번째부터 실행하지 않는다(omo loop-guard IDENTICAL_RUN_THRESHOLD)
//       · 쓰기 실패는 진행 중 항목의 실패로 센다 — 3번째 또는 같은 실패 서명 연속이면 막힘으로 닫고 기대는 항목도 닫는다
//       · 성공한 쓰기의 결과 지문을 고리(TodoLoop)에 넘긴다(진척 판정)
import type { PiToolExecResult, PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import type { PiAssistantV2Env } from "../env";
import { parseTodoCheck, TODO_CHECK_SCHEMA, type CheckResult, type TodoCheck, type TodoItem } from "../todo/types";
import { runTodoCheck } from "../todo/checks";
import { checkLabel, isOpen, type TodoInput, type TodoPhaseInput, type TodoStore } from "./todoStore";
import { callKey, effectFingerprint, maskVolatile, type TodoLoop } from "./continuation";

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
  try { const parsed = JSON.parse(body) as { ok?: unknown }; failed = parsed?.ok === false; } catch { failed = /^\s*(실패|거절)|\bok\s*[:=]\s*false\b/u.test(body.slice(0, 200)); }
  return { text: body, failed };
}

const withNote = (result: PiToolExecResult, note: string): PiToolExecResult => ({ ...result, content: [...result.content, { type: "text", text: note }] });

const TODO_ITEM_SCHEMA = {
  type: "object",
  properties: {
    content: { type: "string", description: "할 일 한 줄(5~15낱말, 무엇을 — 어떻게가 아니라). 예: 「지하 던전 안쪽에 보스 방 짓기」" },
    id: { type: "string", description: "짧은 id(선택, 예: boss_room). 비우면 t1·t2… 가 붙는다" },
    check: TODO_CHECK_SCHEMA,
    dependsOn: { type: "array", items: { type: "string" }, description: "먼저 끝나야 하는 항목의 id(또는 내용)" },
  },
  required: ["content"],
} as const;

export const TODO_TOOL_DESCRIPTION = [
  "이번 요청의 할 일 목록. 쓰기 요청이면 첫 호출로 op:\"init\" 에 요청 전체를 단계(phase)별 항목으로 빠짐없이 적는다 — 요청의 장소·사람·대사·전투·연결·엔딩·물건마다 항목 하나.",
  "항목마다 check(기계 확인)를 단다: 장소=place, 인물=person, 대사=talk, 전투=battle(boss), 맵 잇기=link, 엔딩=ending, 아이템=item, 증거 내밀기=present_evidence, 목표 줄=objective, 걸어 닿기=reachable. 기계로 볼 수 없는 것만 none.",
  "ops: init(list) · start(task) · done(task — 기계 확인을 돌려 ✗ 면 끝나지 않는다) · block(task, reason — 할 수 없을 때 이유 한 줄, 다음 항목으로) · drop(task, reason — 요청에 필요 없게 됐을 때) · append(phase, items) · view.",
  "진행 중은 하나. 끝낸 항목은 바로 done 한다. todo 만 부르고 차례를 끝내지 않는다 — 같은 응답에서 실제 동사를 이어 부른다.",
  "함수 검사·비평·화면 검수가 짚은 문제도 이 목록에 항목으로 덧붙어 돌아온다(출처 표시). 열린 항목이 0 이고 기계 확인이 모두 ✓ 일 때만 「완료」라고 보고한다.",
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
    if ("error" in parsed) warnings.push(`«${content.slice(0, 40)}»: ${parsed.error} — 확인 없이 적었다(고치려면 append 로 다시)`);
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
function attributeFailure(env: PiAssistantV2Env, store: TodoStore, sig: string, detail: string): string | undefined {
  const item = store.current();
  if (!item) return undefined;
  const why = store.recordFailure(item, sig, detail);
  if (!why) return undefined;
  const cascaded = store.block(item, why, "auto");
  env.emit({ type: "execution_status", name: "v2.todo.auto_block", ok: false, summary: `할 일 ${item.id} «${item.content.slice(0, 60)}» 막힘으로 닫음 — ${why}${cascaded.length ? ` · 기대던 ${cascaded.map((c) => c.id).join(",")}도` : ""}`, data: { id: item.id, why, cascaded: cascaded.map((c) => c.id) } });
  const next = store.next();
  return `[할 일 막힘 자동] ${item.id} «${item.content}» — ${why}. 막힘으로 닫았다${cascaded.length ? `(기대던 ${cascaded.map((c) => c.id).join(", ")}도)` : ""}. ${next ? `다음 항목 ${next.id} «${next.content}» 로 간다.` : "열린 항목이 없다."}`;
}

function runCheck(env: PiAssistantV2Env, check: TodoCheck | undefined): CheckResult | undefined {
  if (!check || check.kind === "none") return undefined;
  try { return runTodoCheck(env.ctx.project, check, { startMapId: env.ctx.project.startMapId }); }
  catch (error) {
    env.emit({ type: "execution_status", name: "v2.todo.check_error", ok: false, summary: `기계 확인(${checkLabel(check)}) 실행 오류 — 확인 못 함: ${error instanceof Error ? error.message : String(error)}` });
    return undefined;
  }
}

export function createTodoTool(env: PiAssistantV2Env, store: TodoStore, state: TodoToolsState, verbNames: ReadonlySet<string>): PiToolShape {
  const done = (summary: string, ok = true, extra: Record<string, unknown> = {}): PiToolExecResult => text({ ok, summary, ...extra, list: store.view() });
  return {
    name: "todo", label: "할 일", concurrency: "exclusive", description: TODO_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      properties: {
        op: { type: "string", enum: ["init", "start", "done", "drop", "block", "append", "view"], description: "할 일 조작" },
        list: { type: "array", description: "init: 단계별 목록", items: { type: "object", properties: { phase: { type: "string", description: "단계 이름(짧은 명사구)" }, items: { type: "array", items: TODO_ITEM_SCHEMA } }, required: ["phase", "items"] } },
        phase: { type: "string", description: "append: 덧붙일 단계 이름" },
        items: { type: "array", items: TODO_ITEM_SCHEMA, description: "append: 덧붙일 항목" },
        task: { type: "string", description: "start·done·drop·block: 항목 id(또는 내용 그대로). done 은 비우면 진행 중 항목" },
        reason: { type: "string", description: "block·drop: 이유 한 줄(block 은 무엇이 막았는지 — 도구 거절 글이면 그 요지)" },
      },
      required: ["op"],
    },
    async execute(id, params) {
      const p = (params ?? {}) as { op?: string; list?: unknown; phase?: string; items?: unknown; task?: string; reason?: string };
      const op = String(p.op ?? "view");
      const warnings: string[] = [];
      let result: PiToolExecResult;
      const target = (): TodoItem | undefined => store.resolve(p.task) ?? (op === "done" || op === "block" ? store.current() : undefined);
      const notFound = () => done(`항목 «${p.task ?? ""}» 를 찾지 못했다 — id(t1…)나 내용을 그대로 준다`, false);
      switch (op) {
        case "init": {
          const raw = Array.isArray(p.list) ? p.list : Array.isArray(p.items) ? [{ phase: p.phase ?? "할 일", items: p.items }] : [];
          const phases: TodoPhaseInput[] = raw.map((ph) => {
            const o = (ph ?? {}) as { phase?: unknown; items?: unknown };
            return { phase: typeof o.phase === "string" ? o.phase : "할 일", items: (Array.isArray(o.items) ? o.items : []).map((it) => itemOf(it, warnings)).filter((it): it is TodoInput => !!it) };
          }).filter((ph) => ph.items.length);
          if (!phases.length) { result = done("목록이 비었다 — list:[{phase, items:[{content, check}]}] 로 적는다", false); break; }
          const added = store.init(phases);
          const unchecked = added.filter((i) => !i.check || i.check.kind === "none").length;
          const first = store.current();
          env.emit({ type: "execution_status", name: "v2.todo.init", ok: true, summary: `할 일 ${added.length}개(기계 확인 ${added.length - unchecked})`, data: { items: added.map(({ id: iid, content, check }) => ({ id: iid, content, check })) } });
          result = done(`할 일 ${added.length}개를 적었다${unchecked ? ` (기계 확인 없는 항목 ${unchecked}개 — 확인할 수 있으면 check 를 달아 append 로 다시)` : ""}. ${first ? `${first.id} «${first.content}» 를 진행 중으로 올렸다 — 이 응답에서 바로 동사로 진행한다.` : ""}`, true, warnings.length ? { warnings } : {});
          break;
        }
        case "append": {
          const raw = Array.isArray(p.items) ? p.items : [];
          const inputs = raw.map((it) => itemOf(it, warnings)).filter((it): it is TodoInput => !!it);
          if (!inputs.length) { result = done("덧붙일 항목이 없다 — items:[{content, check}]", false); break; }
          const opened = store.append(p.phase ?? "덧붙임", inputs, "model");
          result = done(`항목 ${opened.length}개를 덧붙였다`, true, warnings.length ? { warnings } : {});
          break;
        }
        case "start": {
          const item = target();
          if (!item) { result = notFound(); break; }
          store.start(item);
          result = done(`${item.id} 진행 중`);
          break;
        }
        case "done": {
          const item = target();
          if (!item) { result = notFound(); break; }
          if (!isOpen(item.status) && item.status !== "blocked") { result = done(`${item.id} 는 이미 ${item.status === "completed" ? "끝났다" : "뺐다"}`); break; }
          const check = runCheck(env, item.check);
          if (store.done(item, check)) {
            const next = store.current();
            env.emit({ type: "execution_status", name: "v2.todo.done", ok: true, summary: `할 일 ${item.id} ✓${check ? ` — ${check.detail.slice(0, 120)}` : ""}` });
            result = done(`${item.id} ✓${check ? ` 기계 확인: ${check.detail}` : ""}. ${next ? `다음: ${next.id} «${next.content}» — 바로 진행한다.` : store.openCount() ? "" : "열린 항목 0."}`);
          } else {
            const why = attributeFailure(env, store, `check:${maskVolatile(check!.detail).slice(0, 160)}`, `기계 확인 ✗ ${check!.detail}`);
            env.emit({ type: "execution_status", name: "v2.todo.false_done", ok: false, summary: `할 일 ${item.id} done 요청 — 기계 확인 ✗: ${check!.detail.slice(0, 160)}` });
            result = done(`${item.id} 는 끝나지 않았다 — 기계 확인(${checkLabel(item.check)}) ✗: ${check!.detail}. 고친 뒤 다시 done 하고, 할 수 없으면 block(이유). 확인이 ✗ 인 채 끝났다고 보고하면 거짓 완료다.${why ? `\n${why}` : ""}`, false, check!.evidence ? { evidence: check!.evidence } : {});
          }
          break;
        }
        case "drop":
        case "block": {
          const item = target();
          if (!item) { result = notFound(); break; }
          const reason = String(p.reason ?? "").trim();
          if (!reason) { result = done(`${op} 에는 reason(이유 한 줄)이 필요하다`, false); break; }
          if (op === "block") {
            // 거절 글이 대안 동사를 일렀는데 아직 안 써 봤으면 한 번 되돌린다(omo: 막힘은 «어렵다»가 아니라 다른 길이 없을 때만).
            const meta = store.meta.get(item.id) ?? {};
            const recent = state.failures.filter((f) => f.at >= state.callNo - 8).at(-1);
            const alternatives = recent ? [...verbNames].filter((n) => n !== recent.name && n !== "todo" && new RegExp(`(^|[^a-z_])${n}([^a-z_]|$)`, "u").test(recent.text) && (state.calledAt.get(n) ?? 0) < recent.at) : [];
            if (alternatives.length && !meta.blockBounced) {
              meta.blockBounced = true; store.meta.set(item.id, meta);
              env.emit({ type: "execution_status", name: "v2.todo.block_bounce", ok: false, summary: `할 일 ${item.id} 막힘 되돌림 — ${recent!.name} 거절 글이 이른 ${alternatives.join(", ")} 를 아직 안 씀` });
              result = done(`아직 막힘이 아니다 — 앞 ${recent!.name} 거절 글이 ${alternatives.join(", ")} 를 일렀는데 써 보지 않았다: «${recent!.text.slice(0, 240)}». 먼저 ${alternatives[0]} 로 해 보고, 그래도 안 되면 다시 block 한다.`, false);
              break;
            }
            const cascaded = store.block(item, reason, "model");
            env.emit({ type: "execution_status", name: "v2.todo.block", ok: false, summary: `할 일 ${item.id} 막힘 — ${reason.slice(0, 160)}${cascaded.length ? ` · 기대던 ${cascaded.map((c) => c.id).join(",")}도` : ""}` });
            const next = store.current();
            result = done(`${item.id} 막힘으로 닫았다${cascaded.length ? `(기대던 ${cascaded.map((c) => c.id).join(", ")}도)` : ""}. ${next ? `다음: ${next.id} «${next.content}» — 바로 진행한다.` : ""}`);
          } else {
            store.drop(item, reason, "model");
            const next = store.current();
            result = done(`${item.id} 를 뺐다. ${next ? `다음: ${next.id} «${next.content}»` : ""}`);
          }
          break;
        }
        default:
          result = done("할 일 목록");
      }
      const parsed = JSON.parse((result.content[0] as { text: string }).text) as { ok: boolean; summary: string };
      env.record({ toolCallId: id, name: "todo", args: params, result: { ok: parsed.ok, summary: `todo ${op}: ${parsed.summary}`.slice(0, 300) } });
      return result;
    },
  };
}

/**
 * v2 동사 목록에 todo 를 더하고 나머지를 감싼다. loop 는 진척 판정용(성공한 쓰기 결과 지문).
 * 쓰기 요청인데 목록 없이 쓰기 동사를 부르면 두 번 되돌리고, 세 번째에는 요청 한 줄로 목록을 대신 적고 진행한다.
 */
export function withTodoLoop(env: PiAssistantV2Env, store: TodoStore, loop: TodoLoop, tools: readonly PiToolShape[]): PiToolShape[] {
  const writeRequest = isWriteRequest(env.request);
  const state: TodoToolsState = { failures: [], calledAt: new Map(), callNo: 0 };
  const verbNames = new Set(tools.map((t) => t.name));
  let firstWriteBounces = 0;
  let lastKey = "";
  let same = 0;
  const wrap = (tool: PiToolShape): PiToolShape => Object.assign(Object.create(Object.getPrototypeOf(tool)) as PiToolShape, tool, {
    execute: async (id: string, params: unknown, signal?: AbortSignal): Promise<PiToolExecResult> => {
      state.callNo += 1;
      const write = !isReadVerb(tool.name);
      if (write && writeRequest && !store.initialized) {
        if (firstWriteBounces < 2) {
          firstWriteBounces += 1;
          env.emit({ type: "execution_status", name: "v2.todo.first", ok: false, summary: `할 일 목록 없이 ${tool.name} — 되돌림(${firstWriteBounces}/2)` });
          return text({ ok: false, summary: `[할 일 먼저] 쓰기 전에 todo(op:"init")로 요청 전체를 단계별 항목으로 적는다(항목마다 check). 같은 응답에서 이어 이 ${tool.name} 호출을 다시 한다.` });
        }
        store.init([{ phase: "요청", items: [{ content: `요청 전체: ${env.request.task.trim().slice(0, 160)}` }] }]);
        env.emit({ type: "execution_status", name: "v2.todo.auto_init", ok: false, summary: "조수가 할 일 목록을 두 번 거르고 쓰기를 불러 — 요청 한 줄로 목록을 대신 적었다" });
      }
      const key = callKey(tool.name, params);
      same = key === lastKey ? same + 1 : 1;
      lastKey = key;
      if (same >= 4) {
        env.emit({ type: "execution_status", name: "v2.loop_guard.block", ok: false, summary: `${tool.name} 같은 인자 ${same}번째 — 실행하지 않음` });
        const why = write ? attributeFailure(env, store, `repeat:${tool.name}`, `${tool.name} 를 같은 인자로 ${same}번 되풀이`) : undefined;
        return text({ ok: false, summary: `[같은 호출 차단] ${tool.name} 를 같은 인자로 ${same}번째 부른다 — 실행하지 않았다. 결과는 앞과 같다. 인자를 바꾸거나 다른 동사를 쓰거나, 할 수 없으면 todo block(이유).${why ? `\n${why}` : ""}` });
      }
      state.calledAt.set(tool.name, state.callNo);
      let result: PiToolExecResult;
      try { result = await tool.execute(id, params, signal); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (write && !signal?.aborted) {
          state.failures.push({ name: tool.name, text: message, at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(message).slice(0, 160)}`, `${tool.name} 실패: ${message}`);
          if (note) throw new Error(`${message}\n${note}`);
        }
        throw error;
      }
      const read = readResult(result);
      const notes: string[] = [];
      if (write) {
        if (read.failed) {
          state.failures.push({ name: tool.name, text: read.text.slice(0, 1200), at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(read.text).slice(0, 160)}`, `${tool.name} 거절: ${read.text.slice(0, 240)}`);
          if (note) notes.push(note);
        } else loop.noteEffect(effectFingerprint(tool.name, params, read.text));
      }
      if (same === 3) {
        env.emit({ type: "execution_status", name: "v2.loop_guard.warn", ok: false, summary: `${tool.name} 같은 인자 3번째` });
        notes.push(`[반복 경고] ${tool.name} 를 같은 인자로 3번 불렀다. 다음 같은 호출은 실행하지 않는다 — 인자를 바꾸거나 다음 항목으로 간다.`);
      }
      return notes.length ? withNote(result, notes.join("\n")) : result;
    },
  });
  return [createTodoTool(env, store, state, verbNames), ...tools.map(wrap)];
}
