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
import { formatCall, nextAfterFailure, nextForItem, strategyAfterRepeat, type NextCall } from "./nextCall";

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
  try { const parsed = JSON.parse(body) as { ok?: unknown; notFailure?: unknown }; failed = parsed?.ok === false && parsed?.notFailure !== true; } catch { failed = /^\s*(실패|거절)|\bok\s*[:=]\s*false\b/u.test(body.slice(0, 200)); }
  // «아직 짓지 않았다(실패 아님)»(마을 땅 미리보기·굴 입구 되돌림)는 정상 흐름이다 — 항목 실패로 세지 않는다.
  if (failed && /\(실패 아님\)/u.test(body.slice(0, 300))) failed = false;
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
  "ops: init(list) · start(task) · done(task — 기계 확인을 돌려 ✗ 면 끝나지 않는다) · block(task, reason — 할 수 없을 때 이유 한 줄, 다음 항목으로) · drop(task, reason — 요청에 필요 없게 됐을 때) · append(phase, items) · bind(task, mapId/eventId/itemId/troopId — 확인이 「모호함」일 때 그 항목이 가리키는 실제 id) · view.",
  "쓰기 동사가 만든 맵·이벤트·아이템·적 그룹 id 는 그때 진행 중인 항목에 자동으로 묶인다 — 한 호출로 다른 항목을 지으면 그 동사에 todoId 를 준다. 「만들어 달라」 항목은 원래 있던 것으로는 ✓ 가 나지 않는다.",
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
function attributeFailure(env: PiAssistantV2Env, store: TodoStore, sig: string, detail: string, strategy?: (item: TodoItem) => string | undefined): string | undefined {
  const item = store.current();
  if (!item) return undefined;
  const why = store.recordFailure(item, sig, detail);
  if (!why) return undefined;
  // H8 같은 거절 두 번: 시도 상한 전이고 전략 글이 있으면 한 번은 막지 않고 전략을 준다(그다음 같은 거절은 막는다).
  const meta = store.meta.get(item.id);
  if (strategy && meta && !meta.strategyGiven && item.attempts < TODO_MAX_ATTEMPTS && why.startsWith("같은 실패")) {
    const text = strategy(item);
    if (text) { meta.strategyGiven = true; return text; }
  }
  const cascaded = store.block(item, why, "auto");
  env.emit({ type: "execution_status", name: "v2.todo.auto_block", ok: false, summary: `할 일 ${item.id} «${item.content.slice(0, 60)}» 막힘으로 닫음 — ${why}${cascaded.length ? ` · 기대던 ${cascaded.map((c) => c.id).join(",")}도` : ""}`, data: { id: item.id, why, cascaded: cascaded.map((c) => c.id) } });
  const next = store.next();
  return `[할 일 막힘 자동] ${item.id} «${item.content}» — ${why}. 막힘으로 닫았다${cascaded.length ? `(기대던 ${cascaded.map((c) => c.id).join(", ")}도)` : ""}. ${next ? `다음 항목 ${next.id} «${next.content}» 로 간다.` : "열린 항목이 없다."}`;
}

function runCheck(env: PiAssistantV2Env, store: TodoStore, item: TodoItem): CheckResult | undefined {
  try { return checkItem(env.ctx.project, store, item); }
  catch (error) {
    env.emit({ type: "execution_status", name: "v2.todo.check_error", ok: false, summary: `기계 확인(${checkLabel(item.check)}) 실행 오류 — 확인 못 함: ${error instanceof Error ? error.message : String(error)}` });
    return undefined;
  }
}

/** 「모호함」 판정에 붙이는 한 줄 — 후보 id 는 판정 글에 있다. */
export const BIND_HINT = (id: string) => `→ 후보 중 이 항목이 가리키는 것을 todo(op:"bind", task:"${id}", mapId|eventId|itemId|troopId:<id>)로 묶고 다시 done 한다.`;

export function createTodoTool(env: PiAssistantV2Env, store: TodoStore, state: TodoToolsState, verbNames: ReadonlySet<string>): PiToolShape {
  const done = (summary: string, ok = true, extra: Record<string, unknown> = {}): PiToolExecResult => text({ ok, summary, ...extra, list: store.view() });
  return {
    name: "todo", label: "할 일", concurrency: "exclusive", description: TODO_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      properties: {
        op: { type: "string", enum: ["init", "start", "done", "drop", "block", "append", "bind", "view"], description: "할 일 조작" },
        list: { type: "array", description: "init: 단계별 목록", items: { type: "object", properties: { phase: { type: "string", description: "단계 이름(짧은 명사구)" }, items: { type: "array", items: TODO_ITEM_SCHEMA } }, required: ["phase", "items"] } },
        phase: { type: "string", description: "append: 덧붙일 단계 이름" },
        items: { type: "array", items: TODO_ITEM_SCHEMA, description: "append: 덧붙일 항목" },
        task: { type: "string", description: "start·done·drop·block: 항목 id(또는 내용 그대로). done 은 비우면 진행 중 항목" },
        reason: { type: "string", description: "block·drop: 이유 한 줄(block 은 무엇이 막았는지 — 도구 거절 글이면 그 요지)" },
        mapId: { type: "string", description: "bind: 이 항목이 가리키는 맵 id" },
        eventId: { type: "string", description: "bind: 이 항목이 가리키는 이벤트 id(또는 mapId:eventId)" },
        itemId: { type: "string", description: "bind: 이 항목이 가리키는 아이템 id" },
        troopId: { type: "string", description: "bind: 이 항목이 가리키는 적 그룹 id" },
      },
      required: ["op"],
    },
    async execute(id, params) {
      const p = (params ?? {}) as { op?: string; list?: unknown; phase?: string; items?: unknown; task?: string; reason?: string; mapId?: string; eventId?: string; itemId?: string; troopId?: string };
      const op = String(p.op ?? "view");
      const warnings: string[] = [];
      let result: PiToolExecResult;
      const target = (): TodoItem | undefined => store.resolve(p.task) ?? (op === "done" || op === "block" || op === "bind" ? store.current() : undefined);
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
          const check = runCheck(env, store, item);
          const bound = refsLabel(item.refs);
          if (store.done(item, check)) {
            const next = store.current();
            env.emit({ type: "execution_status", name: "v2.todo.done", ok: true, summary: `할 일 ${item.id} ✓${check ? ` — ${check.detail.slice(0, 120)}` : ""}${bound ? ` · ${bound}` : ""}` });
            result = done(`${item.id} ✓${check ? ` 기계 확인: ${check.detail}` : ""}${bound ? ` (${bound})` : ""}. ${next ? `다음: ${next.id} «${next.content}» — 바로 진행한다.` : store.openCount() ? "" : "열린 항목 0."}`);
          } else {
            const why = attributeFailure(env, store, `check:${maskVolatile(check!.detail).slice(0, 160)}`, `기계 확인 ✗ ${check!.detail}`);
            env.emit({ type: "execution_status", name: "v2.todo.false_done", ok: false, summary: `할 일 ${item.id} done 요청 — 기계 확인 ✗: ${check!.detail.slice(0, 160)}` });
            const hint = isAmbiguous(check) ? ` ${BIND_HINT(item.id)}` : "";
            result = done(`${item.id} 는 끝나지 않았다 — 기계 확인(${checkLabel(item.check)}) ✗: ${check!.detail}${bound ? ` (${bound})` : ""}.${hint} 고친 뒤 다시 done 하고, 할 수 없으면 block(이유). 확인이 ✗ 인 채 끝났다고 보고하면 거짓 완료다.${why ? `\n${why}` : ""}`, false, check!.evidence ? { evidence: check!.evidence } : {});
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
        case "bind": {
          const item = target();
          if (!item) { result = notFound(); break; }
          const want = { mapIds: p.mapId?.trim() ? [p.mapId.trim()] : undefined, eventIds: p.eventId?.trim() ? [p.eventId.trim()] : undefined, itemIds: p.itemId?.trim() ? [p.itemId.trim()] : undefined, troopIds: p.troopId?.trim() ? [p.troopId.trim()] : undefined };
          const project = env.ctx.project;
          const missing = [
            ...(want.mapIds ?? []).filter((m) => !project.maps[m]).map((m) => `맵 ${m}`),
            ...(want.eventIds ?? []).filter((e) => !Object.values(project.maps).some((m) => m?.events?.some((ev) => ev.id === e || `${m.id}:${ev.id}` === e))).map((e) => `이벤트 ${e}`),
            ...(want.itemIds ?? []).filter((i) => !(project.database?.items ?? []).some((x) => String(x.id) === i)).map((i) => `아이템 ${i}`),
            ...(want.troopIds ?? []).filter((t) => !(project.database?.troops ?? []).some((x) => String(x.id) === t)).map((t) => `적 그룹 ${t}`),
          ];
          if (!want.mapIds && !want.eventIds && !want.itemIds && !want.troopIds) { result = done("bind 에는 mapId·eventId·itemId·troopId 중 하나가 필요하다", false); break; }
          if (missing.length) { result = done(`없는 id: ${missing.join(", ")} — 판정 글의 후보 id 를 그대로 준다`, false); break; }
          // 모델이 직접 묶으면 그 종류의 자동 묶음을 바꾼다(자동 묶기가 엉뚱한 것을 붙였을 수 있다).
          for (const k of ["mapIds", "eventIds", "itemIds", "troopIds"] as const) if (want[k] && item.refs) delete item.refs[k];
          bindRefs(item, want, project, false);
          const check = runCheck(env, store, item);
          env.emit({ type: "execution_status", name: "v2.todo.bind", ok: true, summary: `할 일 ${item.id} 묶음 — ${refsLabel(item.refs)}${check ? ` · 확인 ${check.pass ? "✓" : "✗"}` : ""}` });
          result = done(`${item.id} ${refsLabel(item.refs)}${check ? ` · 지금 기계 확인 ${check.pass ? "✓" : "✗"}: ${check.detail}` : ""}${check?.pass ? " — done 으로 닫는다." : ""}`);
          break;
        }
        default:
          result = done("할 일 목록");
      }
      const parsed = JSON.parse((result.content[0] as { text: string }).text) as { ok: boolean; summary: string };
      // 항목을 닫거나 뺐으면 그 항목을 위해 걸어 둔 «다음 호출 우선»(H3)을 내린다.
      if (parsed.ok && (op === "block" || op === "drop" || op === "done" || op === "start")) env.clearToolPreference?.();
      env.record({ toolCallId: id, name: "todo", args: params, result: { ok: parsed.ok, summary: `todo ${op}: ${parsed.summary}`.slice(0, 300) } });
      return result;
    },
  };
}

const TODO_ID_PARAM = { type: "string", description: "이 호출이 짓는 할 일 항목 id(선택) — 비우면 진행 중 항목에 묶인다" } as const;
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
    const line = `${st.text}${st.call ? ` 다음 호출: ${formatCall(st.call)}` : ""}`;
    if (st.call) prefer(st.call, line);
    return line;
  };
  /** H3 — 거절 하나 뒤의 다음 호출 한 줄(막힘·전략 글이 없을 때). */
  const suggestNext = (toolName: string, args: unknown, failText: string): string | undefined => {
    let nc: NextCall | undefined;
    try { nc = nextAfterFailure(toolName, args, failText, env.ctx.project, verbNames, sinceFailure); } catch { nc = undefined; }
    sinceFailure.clear();
    if (!nc) return undefined;
    const line = `[다음 호출] ${formatCall(nc)} — ${nc.why}. 이 호출을 하거나, 할 수 없으면 todo block(이유).`;
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
      sinceFailure.add(tool.name);
      if (pendingPrefer && tool.name === pendingPrefer) { env.clearToolPreference?.(); pendingPrefer = undefined; }
      // 묶을 항목: 인자 todoId 의 항목, 없으면 진행 중 항목. 판정이 refs 를 쓰는 항목일 때만 전후 지문을 뜬다.
      const bindTo = write ? (todoId ? store.resolve(todoId) : undefined) ?? store.current() : undefined;
      const before = bindTo?.check && bindTo.check.kind !== "none" ? indexProject(env.ctx.project) : undefined;
      // H2 실행 전 인자 검사·보정(argGuard.ts): 답이 하나뿐이면 고쳐 실행하고 결과에 «고침:», 아니면 실행하지 않고 고친 호출 예시를 돌려준다.
      const fixNotes: string[] = [];
      let callParams = params;
      const pre = preCheck(tool.name, tool.parameters, params, env.ctx.project);
      if (pre.kind === "reject") {
        hooks.fire("arg_reject", `${tool.name}: ${pre.message}`, { tool: tool.name });
        const summary = `[인자 검사 — 실행 안 함] ${pre.message}`;
        env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: false, summary: summary.slice(0, 400) } });
        if (write) state.failures.push({ name: tool.name, text: summary, at: state.callNo });
        const why = write ? attributeFailure(env, store, `${tool.name}:arg:${maskVolatile(pre.message).slice(0, 120)}`, `${tool.name} 인자 거절: ${pre.message.slice(0, 200)}`) : undefined;
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
        }
      }
      let result: PiToolExecResult;
      if (outcome.error !== undefined) {
        const error = outcome.error;
        const message = error instanceof Error ? error.message : String(error);
        if (write && !signal?.aborted) {
          state.failures.push({ name: tool.name, text: message, at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(message).slice(0, 160)}`, `${tool.name} 실패: ${message}`, strategyFor(tool.name, message));
          const next = note ? undefined : suggestNext(tool.name, callParams, message);
          if (note || next || fixNotes.length) throw new Error([message, ...fixNotes.map((n) => `고침(실행 전): ${n}`), ...(note ? [note] : []), ...(next ? [next] : [])].join("\n"));
        }
        throw error;
      }
      result = outcome.result!;
      if (fixNotes.length) result = withNote(result, `고침: ${fixNotes.join(" · ")}`);
      const read = readResult(result);
      const notes: string[] = [];
      if (write) {
        if (read.failed) {
          state.failures.push({ name: tool.name, text: read.text.slice(0, 1200), at: state.callNo });
          const note = attributeFailure(env, store, `${tool.name}:${maskVolatile(read.text).slice(0, 160)}`, `${tool.name} 거절: ${read.text.slice(0, 240)}`, strategyFor(tool.name, read.text));
          if (note) notes.push(note);
          else { const next = suggestNext(tool.name, callParams, read.text); if (next) notes.push(next); }
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
                notes.push(`[자동 확인 ✓] ${bindTo.id} «${bindTo.content}» 끝 — ${check.detail.slice(0, 200)}. ${next ? `다음: ${next.id} «${next.content}»${nc ? ` — 다음 호출: ${formatCall(nc)}` : ""} (todo done 은 부르지 않아도 된다)` : store.openCount() ? "" : "열린 항목 0."}`);
              } else {
                store.meta.set(bindTo.id, { ...(store.meta.get(bindTo.id) ?? {}), lastCheck: check });
                notes.push(`[자동 확인] ${bindTo.id} «${bindTo.content.slice(0, 60)}» 아직 ✗ — ${check.detail.slice(0, 240)}${isAmbiguous(check) ? ` ${BIND_HINT(bindTo.id)}` : ""}`);
              }
            }
          }
        }
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
