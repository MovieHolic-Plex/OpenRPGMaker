// 모델 호출 앞뒤의 갈고리 — 도구 싣기·상태 카드·리드 계획·첫 호출 todo 강제·도구 호출 강제. 2026-11-11 리팩토링 R3: runAssistantV2 의 runPiAgent 호출에서 옮겼다.
import { createV2Tools } from "../verbs";
import type { PiAssistantV2Env } from "../env";
import { withTodoLoop } from "../loop/todoTools";
import { exposeV2Tools } from "../toolExposure";
import { formatCall, nextForItem } from "../loop/nextCall";
import { requestSkeleton, skeletonCard } from "../loop/requestSkeleton";
import { checkLabel } from "../loop/todoStore";
import { leadPlanMessages, planForWorker, projectDigest, toolCatalog } from "../split";
import type { TurnContext } from "./context";

/** runPiAgent 의 v2 갈고리 가운데 모델 호출 앞뒤의 것 다섯. */
export function turnModelHooks(turn: TurnContext) {
  const { session, store, state, writeRequest, toolNames } = turn;
  // 처음부터 싣는 도구 + 필요할 때 싣는 도구(load_tools·이름 호출) — src/ai/v2/toolExposure.ts. 다음 호출 제안(nextCall)은 둘 다 부를 수 있다.
  const tools = (env: PiAssistantV2Env) => {
    const all = withTodoLoop(env, store, session.loop, createV2Tools(env, session), session.hooks);
    for (const t of all) toolNames.add(t.name);
    state.exposure = exposeV2Tools(env, all);
    return state.exposure.tools;
  };
  // H6 상태 카드(src/ai/v2/loop/contextTrim.ts 와 함께): 호출마다 마지막 메시지 끝에만 붙는 짧은 카드 — 진척 줄·지금 할 것+다음 호출·그 항목의 마지막 ✗.
  // 오래된 도구 결과가 줄어도 할 일과 마지막 실패는 매 호출 눈앞에 있다. 대화 기록에는 남지 않는다.
  const stateCard = (env: PiAssistantV2Env) => {
    if (!store.items.length) {
      // H1: 목록을 적기 전 호출에는 요청 뼈대 카드(함수가 요청 글에서 뽑은 필수 요소)를 보인다.
      if (!writeRequest) return undefined;
      const card = skeletonCard(requestSkeleton(env.request.task));
      if (card && !state.skeletonShown) { state.skeletonShown = true; env.emit({ type: "execution_status", name: "v2.hook.skeleton_card", ok: true, summary: card.slice(0, 400) }); }
      return card;
    }
    const cur = store.next();
    const lines = [`[State card — this call only] ${store.view(0, true).split("\n")[0]}`];
    if (cur) {
      const m = store.meta.get(cur.id);
      let call = m?.nextCall?.text;
      if (!call) { try { const nc = nextForItem(cur, env.ctx.project, toolNames); call = nc ? formatCall(nc) : undefined; } catch { call = undefined; } }
      lines.push(`Do now: ${cur.id} «${cur.content.slice(0, 120)}»${cur.check && cur.check.kind !== "none" ? ` (check: ${checkLabel(cur.check, true)})` : ""}`);
      if (call) lines.push(`Next call: ${call.slice(0, 400)}`);
      if (m?.lastCheck && !m.lastCheck.pass) lines.push(`Last check ✗: ${(m.lastCheck.en ?? m.lastCheck.detail).slice(0, 240)}`);
    }
    const rest = store.open().filter((i) => i !== cur).slice(0, 6).map((i) => `${i.id} «${i.content.slice(0, 50)}»`);
    if (rest.length) lines.push(`Still open: ${rest.join(" · ")}${store.openCount() - 1 > rest.length ? " …" : ""}`);
    return lines.join("\n");
  };
  // 리드 계획 — 리드는 요청·요청 뼈대·프로젝트 요약·워커 도구 목록만 보고 할 일+사양을 쓴다. 그 글이 워커 첫 지시 뒤에 붙는다.
  const firstPromptSuffix = async (env: PiAssistantV2Env) => {
    if (!env.leadChat || !writeRequest) return undefined;
    const t0 = Date.now();
    try {
      const skeleton = skeletonCard(requestSkeleton(env.request.task));
      const messages = leadPlanMessages({ task: env.request.task, ...(skeleton ? { skeleton } : {}), digest: projectDigest(env.ctx.project), tools: toolCatalog(state.exposure?.tools ?? [], [...(state.exposure?.lazy.keys() ?? [])]) });
      const plan = (await env.leadChat(messages, env.signal)).trim();
      if (!plan) { env.emit({ type: "execution_status", name: "v2.split.plan", ok: false, summary: `리드 계획이 비어 옴 — 워커 혼자 한다 · ${env.leadModel}` }); return undefined; }
      state.leadPlan = plan;
      env.emit({ type: "execution_status", name: "v2.split.plan", ok: true, summary: `리드 계획 ${plan.length}자 · ${env.leadModel} · ${Math.round((Date.now() - t0) / 1000)}초`, data: { plan, model: env.leadModel, ms: Date.now() - t0 } });
      return planForWorker(plan);
    } catch (error) {
      if (env.signal?.aborted) throw error;
      env.emit({ type: "execution_status", name: "v2.split.plan", ok: false, summary: `리드 계획 실패 — 워커 혼자 한다: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) });
      return undefined;
    }
  };
  // 첫 호출 todo 강제(omo first-turn) — 쓰기 요청이고 이어 받은 목록이 없을 때. 로컬 CLI 는 감싸개가 첫 쓰기를 되돌린다.
  const beforeFirstPrompt = (env: PiAssistantV2Env) => { if (writeRequest && !store.initialized) env.requireToolNextTurn?.("todo"); };
  // 열린 항목이 있는 동안 도구 호출을 강제한다 — 다만 항목이 하나도 닫히지 않은 채 연속 12번이면 풀어 모델이 멈추고 고리(afterMain)가 판정하게 한다.
  const keepToolsOn = () => {
    // 할 일이 열린 채 글로 멈춘 적이 있는 모델만(Flash) — 멈추지 않는 모델(DeepSeek)에는 걸지 않는다.
    if (!writeRequest || !store.initialized || state.loopStop || store.openCount() === 0 || state.textStops === 0) return false;
    const c = store.counts(); const sig = `${c.done}/${c.blocked}/${c.dropped}/${c.total}`;
    if (sig !== state.forcedSig) { state.forcedSig = sig; state.forcedCalls = 0; }
    state.forcedCalls += 1;
    return state.forcedCalls <= 12;
  };
  return { tools, stateCard, firstPromptSuffix, beforeFirstPrompt, keepToolsOn };
}
