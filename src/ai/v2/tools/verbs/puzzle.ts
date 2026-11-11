// 퍼즐·목표 동사 — author_puzzle_chain · set_objective · seal_locked_room.
import { SET_OBJECTIVE_DESCRIPTION } from "@/ai/agentRules";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { buildPuzzleChain, sealLockedRoom, type ChainArgs } from "../../story/puzzle";
import { planObjective } from "../../judge/objectivePlan";
import { text } from "../support";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — LINES · authorPuzzleChain · setObjectiveVerb · sealLockedRoomVerb. (puzzleVerbs) */
export function puzzleVerbs(c: VerbContext) {
  const { env, run, finishContent } = c;
  // 퍼즐 사슬·잠긴 방 막기(2026-10-25 공포 판정 J12/J13): 조각을 따로 지으면 답이 새고 잠긴 방에 벽 틈이 남는다.
  const LINES = { type: "array", items: { type: "string" } } as const;
  const authorPuzzleChain: PiToolShape = {
    name: "author_puzzle_chain", label: "퍼즐 사슬", concurrency: "exclusive",
    description: "Build clue → lock (password or choice, optional wrong-try count with a hint) → reward or ending → locked door in one go. Links in order: only the previous link's learn · reward.flag · reward.item names become a later link's needs. Put the answer (code) only in the clue's lines, never in the lock's lines (a leak is rejected). A door, after building, blocks the door cell and walks; if the room behind is reachable another way, the gap is filled with wall. Existing events are rewritten by eventId; new ones get at{x,y} and name.",
    parameters: { type: "object", properties: {
      mapId: { type: "string" }, name: { type: "string", description: "chain name (e.g. 서재의 비밀)" },
      links: { type: "array", items: { type: "object", properties: {
        role: { type: "string", enum: ["clue", "code", "door", "pickup", "ending"], description: "ending: a code (optional) then triggerEnding endingId" },
        eventId: { type: "string" }, name: { type: "string" }, mapId: { type: "string" },
        at: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
        learn: { type: "string", description: "clue: what you learn by reading (the needs name of a later link)" },
        needs: { type: "string", description: "what must exist first — a previous link's learn · reward.flag · reward.item name" },
        code: { type: "string", description: "code: the number answer, or the right one among options" },
        options: LINES,
        lines: { ...LINES, description: "said when the player examines it. clue: the clue text (with the answer digits). code/ending: the prompt shown BEFORE the number input — success text goes in reward.lines" },
        lockedLines: { ...LINES, description: "said while needs/needsAny/needsAll are not met (e.g. no clue yet)" },
        wrongLines: { ...LINES, description: "code: said after a wrong answer" }, doneLines: LINES,
        reward: { type: "object", properties: { item: { type: "string" }, flag: { type: "string" }, lines: { ...LINES, description: "said on success (right code / pickup)" } } },
        needsAll: { ...LINES, description: "tryable only once ALL of these earlier learn names are known" },
        seal: { type: "boolean", description: "door: seal gaps behind the door (default true)" },
        endingId: { type: "string", description: "ending: the ending id to trigger (omit to make one named after the chain)" },
        needsAny: { ...LINES, description: "code/ending: tryable once ANY of these earlier learn names is known; before that lockedLines shows" },
        hintAfter: { type: "number", description: "code/ending: count wrong tries; from this many on, hintLines show after wrongLines" },
        hintLines: LINES,
      }, required: ["role"] } },
    }, required: ["mapId", "name", "links"] },
    async execute(id, params) {
      const args = params as unknown as ChainArgs;
      return finishContent(id, "author_puzzle_chain", params, buildPuzzleChain(run, { ...args, mapId: args.mapId || env.ctx.currentMapId || "" }));
    },
  };
  const setObjectiveVerb: PiToolShape = {
    name: "set_objective", label: "현재 목표 걸기", concurrency: "exclusive",
    description: SET_OBJECTIVE_DESCRIPTION,
    parameters: { type: "object", properties: {
      text: { type: "string", description: "one line of what to do now (within 80 chars)" },
      at: { type: "string", enum: ["start"], description: "start = the game-start objective" },
      eventId: { type: "string", description: "the objective after this event (id or name) advances the story" },
      mapId: { type: "string" },
      where: { type: "string", description: "target event or place of the objective (id or name) — its direction/entrance is attached to the objective bar" },
    }, required: ["text"] },
    async execute(_id, params) {
      const p = params as { text?: string; at?: string; eventId?: string; mapId?: string; where?: string };
      const plan = planObjective(env.ctx.project, { text: String(p.text ?? ""), ...(p.at ? { at: p.at } : {}), ...(p.eventId ? { eventId: String(p.eventId) } : {}), ...(p.mapId ? { mapId: String(p.mapId) } : {}), ...(p.where ? { where: String(p.where) } : {}) });
      if (!plan.ok) return text({ ok: false, summary: plan.summary });
      for (const entry of plan.events) {
        // 목표 명령만 넣은 같은 페이지 묶음을 다시 쓴다 — 조수 「통째 다시 보내기」 거부(assistantRewriteGuard)가 이 동사의 쓰기까지 막아
        // romance-j91 에서 set_objective 가 여섯 번 모두 실패했다(「현재 목표 줄을 넣는 기능이 계속 오류」). 의도한 전체 쓰기라 replacePages.
        const wrote = run.call("upsert_event", { mapId: entry.mapId, event: entry.event, replacePages: true });
        if (!wrote.ok) return text({ ok: false, summary: `목표를 넣지 못했다: ${wrote.summary}` });
      }
      // 목표 줄을 숨기는 HUD(이야기·공포 기본값은 objective:false 였다)면 켠다.
      if (env.ctx.project.system.fieldHud?.objective === false) run.call("set_field_hud", { objective: true });
      await env.checkpoint("set_objective");
      return text({ ok: true, summary: plan.summary });
    },
  };
  const sealLockedRoomVerb: PiToolShape = {
    name: "seal_locked_room", label: "잠긴 방 막기", concurrency: "exclusive",
    description: "If the room behind a locked door (eventId) can be walked into without passing the door, fill the gap with the adjacent wall tile (blocks the door cell and walks from the start and landing spots). Use it when the game check «잠긴 방» (locked room) flags one.",
    parameters: { type: "object", properties: { mapId: { type: "string" }, eventId: { type: "string" } }, required: ["mapId", "eventId"] },
    async execute(id, params) {
      const p = params as { mapId: string; eventId: string };
      return finishContent(id, "seal_locked_room", params, sealLockedRoom(run, p.mapId, p.eventId));
    },
  };
  return { authorPuzzleChain, setObjectiveVerb, sealLockedRoomVerb };
}
