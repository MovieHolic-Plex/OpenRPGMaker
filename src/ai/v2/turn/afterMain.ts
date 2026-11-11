// 모델이 멈출 때마다 도는 판정자 차례 — ① 기계 확인 다시 ② 재주입 ③ 끝맺음 자동 짓기 ④ 끝맺음 관문 ⑤ 리드·독립 검토자 ⑥ 화면 검수. 2026-11-11 리팩토링 R3: runAssistantV2 의 afterMain 에서 옮겼다.
import { relookChangedPlaces } from "./relook";
import { englishToolCopy } from "../tools/toolExposure";
import { v2BaselineGameKeys, v2GateProblems } from "../judge/finishGate";
import { alignCodeClues } from "../story/codeClues";
import { realignEvidencePlaces } from "../story/mysteryEvidencePlaces";
import { reviewKey } from "./carryOver";
import type { PiAssistantV2Env } from "../shared/env";
import { adviseTurn, scopeAdviceToRequest, advisorSummary, compactToolLog } from "../judge/advisor";
import { splitPreexisting, syncGateItems } from "../judge/gates";
import { syncRoomZoneItems } from "../loop/roomZones";
import { isOpen } from "../loop/todoStore";
import { changedSince, indexProject } from "../loop/refs";
import type { TodoItem } from "../todo/types";
import { leadFixNote, leadReviewMessages, parseLeadReview, SPLIT_LIMITS } from "./split";
import { advisorEnabled, advisorChatOf, timed, timedAsync, safeDiff } from "./support";
import type { TurnContext } from "./context";
import type { turnRecheck } from "./recheck";
import type { turnReinject } from "./reinject";
import type { turnAutoBuild } from "./autoBuild";
import type { turnVqa } from "./vqaRound";

/** afterMain = 모델이 멈출 때마다 한 번. 돌려주는 글이 있으면 그 글로 같은 대화를 한 차례 더 돌고, 없으면 턴이 끝난다. */
export function turnAfterMain(turn: TurnContext & Pick<ReturnType<typeof turnRecheck>, "refreshChecks" | "stamp"> & Pick<ReturnType<typeof turnReinject>, "reinject" | "newBatch"> & Pick<ReturnType<typeof turnAutoBuild>, "autoBuild" | "lateBuildPending"> & Pick<ReturnType<typeof turnVqa>, "vqaStep">) {
  const { session, store, state, preexisting, calls, vqaRounds, autoNotes, advisorItems, writeRequest, toolNames, autoTouched, leadItems, vqaStep, refreshChecks, stamp, reinject, newBatch, autoBuild, lateBuildPending } = turn;
  // 끝맺음 관문이 고치는 법으로 이른 도구를 모델의 도구 목록에 올린다 — 묶음 밖 도구는 만들어 넣고, 묶음에 있지만 아직 안 실은 도구는 선언한다(모델은 목록에 없는 도구를 «없다» 고 읽었다).
  const shown = new Set<string>();
  const addRepairTool = (env: PiAssistantV2Env, name: string): "loaded" | "ready" | undefined => {
    const exposure = state.exposure;
    if (!exposure) return toolNames.has(name) ? "ready" : undefined;
    if (shown.has(name) || exposure.tools.some((t) => t.name === name)) return "ready";
    let tool = exposure.lazy.get(name);
    if (!tool) {
      const made = session.repairTool?.(name);
      if (!made || !session.loop.wrapLate) return undefined;
      tool = englishToolCopy(session.loop.wrapLate(made), false);
      toolNames.add(name);
      exposure.lazy.set(name, tool);
    }
    shown.add(name);
    env.declareTool?.(tool);
    return "loaded";
  };
  const afterMain = async (env: PiAssistantV2Env) => {
    state.liveEnv = env;
    if (store.initialized && store.openCount() > 0) state.textStops += 1;
    try {
      // 쓰기 요청인데 할 일 목록이 끝내 안 생겼다 — 도구를 하나도 안 부르고 글로 끝낸 것이다. 2026-11-01 cheap r5 flash:
      // 첫 답에 todo 호출을 ```tool_call``` 글 묶음으로 «써» 놓고 멈춰 아무것도 안 지은 채 끝났다(목록이 없으니 재주입도 없었다).
      if (writeRequest && !store.initialized && state.noTodoKicks < 2) {
        state.noTodoKicks += 1;
        env.requireToolNextTurn?.("todo");
        env.emit({ type: "execution_status", name: "v2.no_todo", ok: false, summary: `할 일 목록 없이 멈춤 — 실제 todo 호출을 다시 요청(${state.noTodoKicks}/2)` });
        return "[No tool ran] Nothing was built: your todo list does not exist yet. A tool call written as text (for example a ```tool_call``` block or a JSON object in your reply) is NOT executed. Make the real `todo` tool call now (op \"init\" with the items), then build with the tools.";
      }
      // 번호 자물쇠 ↔ 단서 대사는 모델이 멈출 때마다 다시 맞춘다 — 끝맺음(code-clues 단계)은 한 번만 돌아, 그 뒤 모델이 대사·자물쇠를 고치면
      // 어긋난 채 출하됐다(2026-10-31 meb1 terra 방탈출: 서랍 «4816» · 탈출문 정답 5937 → 엔딩 불가).
      const codes = timed("alignCodeClues", () => alignCodeClues(env.ctx.project));
      if (codes.notes.length) {
        env.ctx.project = codes.project;
        await env.checkpoint("align_code_clues");
        env.emit({ type: "execution_status", name: "v2.code_clues", ok: true, summary: `번호·단서 대사 다시 맞춤: ${codes.notes.join(" / ").slice(0, 300)}` });
        autoNotes.push(`번호 자물쇠를 단서 대사에 다시 맞춤: ${codes.notes.join(" / ").slice(0, 300)}`);
      }
      // 증거 물건 칸의 자리 말도 같다 — 모델이 칸을 옮기면 귀띔·진술·지목 대사가 옛 자리를 가리켰다(2026-10-31 mef3 terra 추리).
      const places = timed("realignEvidencePlaces", () => realignEvidencePlaces(env.ctx.project));
      if (places.notes.length) {
        env.ctx.project = places.project;
        await env.checkpoint("align_evidence_places");
        env.emit({ type: "execution_status", name: "v2.evidence_places", ok: true, summary: places.notes.join(" / ").slice(0, 300) });
        autoNotes.push(`증거 자리 대사를 지금 칸에 다시 맞춤: ${places.notes.join(" / ").slice(0, 300)}`);
      }
      refreshChecks(env);
      // 끝맺음 뒤에 청사진이 처음 생겼거나 다시 끊겼으면 지금 짓는다.
      if (state.autoBuilt && lateBuildPending(env)) {
        const late = await autoBuild(env);
        if (late) { autoNotes.push(late); env.emit({ type: "execution_status", name: "v2.blueprint.late", ok: true, summary: "끝맺음 뒤에 생긴 청사진을 함수가 지었다" }); refreshChecks(env); }
      }
      // ② 열린 항목 — 재주입.
      if (!state.loopStop && store.openCount()) {
        const prompt = reinject(env);
        if (prompt) return prompt;
      }
      if (session.questions.length) return undefined;
      // ③ 끝맺음 자동 짓기(결정적 — 고리가 멈췄어도 돈다). 지은 뒤 기계 확인을 다시 본다(막힌 항목을 함수가 해냈을 수 있다).
      if (!state.autoBuilt) {
        state.autoBuilt = true;
        const note = await timedAsync("autoBuild", () => autoBuild(env));
        if (note) autoNotes.push(note);
        refreshChecks(env);
        if (!state.loopStop && store.openCount()) { const prompt = reinject(env, "[Items reopened by the machine check after the function finish]"); if (prompt) return prompt; }
      }
      if (state.loopStop) {
        // 고리가 멈추면 관문·검토자·화면 검수를 돌리지 않는다(모델을 더 부르지 않는다). 그래도 관문이 본 문제는 최종 보고에 싣는다 —
        // 싣지 않으면 «엔딩을 부르는 이벤트가 없다» 같은 출하 차단이 조용히 빠진 채 «막힘 N» 만 남는다.
        try {
          const unseen = v2GateProblems(session, env).problems.filter((p) => !store.items.some((i) => i.content.includes(p.text.slice(0, 60))));
          if (unseen.length) autoNotes.push(`끝맺음 관문이 본 문제 ${unseen.length}건(고리가 멈춰 고치지 못함): ${unseen.slice(0, 5).map((p) => p.text.slice(0, 140)).join(" / ")}`);
        } catch { /* 관문 계산 실패는 보고를 막지 않는다 */ }
        return undefined;
      }
      // ③b 이번 턴에 지은 설계 실내 맵마다 room_zones 항목(구역·초점·갈 이유·반복) — 조수가 안 달았으면 함수가 덧붙인다(roomZones.ts).
      {
        let opened: TodoItem[] = [];
        try { opened = syncRoomZoneItems(store, env.ctx.project, store.baseline ? changedSince(store.baseline, indexProject(env.ctx.project)) : undefined, env.request.task); }
        catch (error) { env.emit({ type: "execution_status", name: "v2.zones.error", ok: false, summary: `실내 구역 항목 맞추기 실패: ${error instanceof Error ? error.message : String(error)}` }); }
        if (opened.length) {
          env.emit({ type: "execution_status", name: "v2.zones.items", ok: false, summary: `실내 구역 확인 ✗ ${opened.length}건을 할 일에 덧붙임`, data: { items: opened.map((i) => ({ id: i.id, content: i.content, check: i.check, refs: i.refs })) } });
          // 칸 배치 자기 검토(layout_review)만 열렸으면 검토 글, 아니면 구조 고치기 글(2026-10-31 bbox-better 자기 검토 단계).
          const reviewOnly = opened.every((i) => i.check?.kind === "layout_review");
          const prompt = newBatch(env, opened, reviewOnly
            ? `[Interior self-review — ${opened.length} interior map(s) laid from your layout. Look at each picture (inspect mapId for the current one) as a player walking in: bare floor areas, zones that do not read as what they are for, odd or illogical placements, blocked or cramped paths, pieces that look wrong in the art, a weak landmark, a boring rectangle. Send review_layout({mapId, problems:["short description with cells"], patch:{remove_objects, add_objects, remove_wall_items, add_wall_items, replace}}) — the patch is applied to your layout exactly and validated (Rejected / Fixed call). Send an empty patch when nothing is wrong. Then done]`
            : `[Interior rooms — ${opened.length} interior map(s) you built do not yet match the structure: laid as your layout (layout_built), self-reviewed (layout_review: review_layout), declared rooms reachable, connections open, stairs and landmarks placed (room_graph), or distinct zones each with a focal part and a reason to go there (room_zones). Fix a laid layout with review_layout or edit_place({patch:{mapId, layoutPatch}}); other rooms with edit_place (zones with x, y, design, landmark; connections), add_event (inspect points) and add_people inside those rooms. Then done; if you cannot, block(reason)]`);
          if (prompt) return prompt;
        }
      }
      // ④-0 비평가가 본 그림이 낡았으면 다시 본다 — 다시 짓지 않는 도구로 고친 것을 못 본 지적이 항목으로 되풀이되지 않게(relook.ts).
      for (const note of await timedAsync("relook", () => relookChangedPlaces(env, session))) env.emit({ type: "execution_status", name: "v2.relook", ok: true, summary: note });
      // ④ 끝맺음 관문 — 남은 문제는 «한 바퀴 더» 글이 아니라 할 일 항목이다.
      const gate = timed("v2GateProblems", () => v2GateProblems(session, env));
      if (!state.baselineKeys) { try { state.baselineKeys = v2BaselineGameKeys(env.request.project, env.request.task); } catch { state.baselineKeys = new Set(); } }
      let nowIndex; try { nowIndex = indexProject(env.ctx.project); } catch { nowIndex = undefined; }
      const split = splitPreexisting(gate.problems, state.baselineKeys, store.baseline, nowIndex, autoTouched);
      for (const p of split.preexisting) if (!preexisting.has(p.key)) {
        preexisting.set(p.key, p.text);
        env.emit({ type: "execution_status", name: "v2.gate.preexisting", ok: true, summary: `기존 결함(시작 저장본에 있었음 — 완료를 막지 않음): ${p.text.slice(0, 160)}` });
      }
      const capMapIds = new Set(session.unresolved().filter((o) => o.rounds >= o.cap).map((o) => o.mapId));
      const synced = syncGateItems(store, split.current, capMapIds, toolNames, (name) => addRepairTool(env, name));
      if (synced.closed.length || synced.capped.length) env.emit({ type: "execution_status", name: "v2.gate.sync", ok: true, summary: `관문 항목 — 사라져 닫음 ${synced.closed.length} · 상한 막힘 ${synced.capped.length}` });
      if (synced.loaded.length) env.emit({ type: "execution_status", name: "v2.gate.tools", ok: true, summary: `관문이 고치는 법으로 이른 도구를 실음: ${synced.loaded.join(", ")}` });
      if (synced.unfixable.length) {
        env.emit({ type: "execution_status", name: "v2.gate.unfixable", ok: false, summary: `고치는 도구가 조수 v2 에 없는 지적 ${synced.unfixable.length}건 — 완료를 막지 않고 보고에 남김` });
        autoNotes.push(`이 요청에서 고칠 수 없는 지적 ${synced.unfixable.length}건(고치는 도구가 조수 v2 에 없다 — 완료를 막지 않음): ${synced.unfixable.map((i) => i.content.slice(0, 120)).join(" / ")}`);
      }
      if (synced.opened.length) {
        env.emit({ type: "execution_status", name: "v2.gate.items", ok: false, summary: `끝맺음 관문이 짚은 것 ${synced.opened.length}건을 할 일에 덧붙임`, data: { items: synced.opened.map((i) => ({ id: i.id, source: i.source, content: i.content })) } });
        const toolNote = synced.loaded.length ? ` The tool(s) these fixes need were added for you: ${synced.loaded.join(", ")} — ${env.declareTool && env.lazyToolsVia !== "call_tool" ? "they are in your tool list from your next call" : `get their parameters with load_tools({"names":${JSON.stringify(synced.loaded)}})`}.` : "";
        const prompt = newBatch(env, synced.opened, `[Finish gate — added ${synced.opened.length} problem(s) found by function checks and critics to the todo list. Fix each and call done, or block(reason) if you cannot.${toolNote}]`);
        if (prompt) return prompt;
        return undefined;
      }
      // ⑤a 리드 검토(나누기 켜짐) — 열린 항목이 없을 때 리드가 계획·할 일 표·변경 요약·보고를 보고 승인하거나 영어 고칠 것을 준다.
      // 고칠 것은 critic 항목(기계 확인·완료 관문 그대로). 처음 한 번 + 그 항목을 닫은 뒤 한 번. 나누기에서는 독립 검토자 대신이다.
      if (env.leadChat && state.leadPlan) {
        const leadOpen = [...leadItems].some((id) => { const i = store.get(id); return i && isOpen(i.status); });
        if (state.leadReviews < SPLIT_LIMITS.reviews && !leadOpen && (state.leadReviews === 0 || leadItems.size > 0)) {
          state.leadReviews += 1;
          const t0 = Date.now();
          let review;
          try {
            review = parseLeadReview(await env.leadChat(leadReviewMessages({ task: env.request.task, plan: state.leadPlan, todo: store.view(40, true), diff: safeDiff(env), toolLog: compactToolLog(calls, SPLIT_LIMITS.toolLog), report: state.draft, round: state.leadReviews }), env.signal));
          } catch (error) {
            if (env.signal?.aborted) throw error;
            review = { approve: true, fixes: [], problem: error instanceof Error ? error.message : String(error) };
          }
          env.emit({ type: "execution_status", name: "v2.split.review", ok: review.approve, summary: `리드 검토 ${state.leadReviews} — ${review.problem ? `답 못 읽음(${review.problem.slice(0, 120)})` : review.approve ? "승인" : `고칠 것 ${review.fixes.length}`} · ${Math.round((Date.now() - t0) / 1000)}초`, data: { ...review, round: state.leadReviews, model: env.leadModel } });
          const opened = store.append(state.leadReviews === 1 ? "리드 검토" : "리드 검토 다시", review.fixes.map((f) => ({ content: f.slice(0, 220), key: reviewKey("lead", f) })), "critic");
          for (const item of opened) leadItems.add(item.id);
          if (opened.length) {
            const prompt = newBatch(env, opened, leadFixNote(opened.length, state.leadReviews));
            if (prompt) return prompt;
            return undefined;
          }
        }
      }
      // ⑤ 독립 검토자 — 보고 초안을 «실제로 바뀐 것»에 대어 본다. 막음만 항목으로(우려·참고는 기록만). 처음 한 번 + 그 항목을 닫은 뒤 한 번.
      // 출하 차단은 ④ 관문만 본다(기존 결함 면제도 거기 하나) — 검토자가 같은 차단을 다시 항목으로 만들지 않는다.
      const advisorOpen = [...advisorItems].some((id) => { const i = store.get(id); return i && isOpen(i.status); });
      if (advisorEnabled(env.request) && !(env.leadChat && state.leadPlan) && state.advisorRuns < 2 && !advisorOpen && (state.advisorRuns === 0 || advisorItems.size > 0)) {
        state.advisorRuns += 1;
        const verdict = scopeAdviceToRequest(await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: state.draft }, advisorChatOf(env), env.signal), env.request.task);
        state.advice = state.advice ? { ...verdict, ms: state.advice.ms + verdict.ms, inputChars: state.advice.inputChars + verdict.inputChars } : verdict;
        env.emit({ type: "execution_status", name: state.advisorRuns === 1 ? "v2.advisor" : "v2.advisor.recheck", ok: !verdict.notes.some((n) => n.level === "blocker"), summary: `${state.advisorRuns === 1 ? "" : "다시 검토 — "}${advisorSummary(verdict)} · ${env.advisorModel ?? "주 모델"}`, data: { ...verdict, model: env.advisorModel ?? "main" } });
        const blockers = verdict.notes.filter((n) => n.level === "blocker");
        const opened = store.append(state.advisorRuns === 1 ? "검토자" : "검토자 다시", blockers.map((n) => ({ content: `${n.what}${n.claim ? ` (보고: «${n.claim.slice(0, 60)}»)` : ""}`.slice(0, 220), key: reviewKey("adv", `${n.what}|${n.claim ?? ""}`) })), "critic");
        for (const item of opened) advisorItems.add(item.id);
        if (opened.length) {
          const prompt = newBatch(env, opened, `[Independent reviewer blocked ${opened.length} item(s) — the draft report does not match the actual changes or misses part of the request. Fix them, or block(reason) if you cannot]`);
          if (prompt) return prompt;
          return undefined;
        }
      }
      // ⑥ 화면 검수(게임 전체 요청만) — 결함은 vqa 항목.
      if (!state.vqaDone) {
        const opened = await vqaStep(env);
        if (opened.length) {
          const r = vqaRounds.at(-1);
          const prompt = newBatch(env, opened, `[Screen review ${r ? `round ${r.round} — a reviewer on another model (${r.reviewer})` : "(carried from the previous turn) — a reviewer on another model"} found ${opened.length} defect(s) in the actual rendered images; they were added to the todo list. Look again with inspect, fix each and call done. If the reviewer is wrong about one, drop it with the reason; if you cannot fix one, block it with the reason. Items marked [다듬기] are polish: try once, they do not hold completion]`);
          if (prompt) return prompt;
        }
      }
      return undefined;
    } finally {
      stamp(env);
    }
  };
  return { afterMain };
}
