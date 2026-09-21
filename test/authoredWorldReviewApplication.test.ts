// R2: the reviewed authored world candidate must reach the store intact.
// NPC/place registrations and relations survive apply; wiki-owned documents
// (manual/locked/coordinator) survive alongside them; undo restores everything.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import * as history from "@/editor/mapEditHistory";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";
import { independentReviewPayload, imageDeliveryForRequest } from "./independentReviewFixture";
import { getTool } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";
import type { ChatResult } from "@/ai/llmClient";

const MAP_KEY = "map_blank_start";
const EV_ID = "ev_cast";
const PAGE_ID = "ev_cast_p0";

function manualWikiDoc(id: string, summary: string, locked = false) {
  return {
    id, type: "concept", name: `Manual ${id}`, summary, origin: "user",
    ...(locked ? { locked: true } : {}),
    wiki: { kind: "knowledge", basis: "explicit",
      sources: [{ id: `src-${id}`, kind: "manual", text: "human note", at: 1 }] },
  } as never;
}

function seedWorld(): Project["world"] {
  return {
    entities: [
      { id: "w_original", type: "guideline", name: "Existing lore", summary: "Keep me", origin: "user" },
      manualWikiDoc("w_manual", "Human decision"),
      manualWikiDoc("w_locked", "Locked doctrine", true),
    ],
    relations: [],
  };
}

function toolCall(name: string, args: unknown, id: string) {
  return { message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: {
    name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}

interface ScriptState { planned: boolean; staged: boolean; placed: boolean; cast: boolean; shown: boolean }

function writerRound(mapId: string, state: ScriptState) {
  if (!state.planned) {
    state.planned = true;
    return toolCall("set_work_plan", { goal: "Cast Rina", layers: [{ title: "Cast", items: [{
      title: "Cast", instruction: "Cast Rina", successTools: ["author_npc_cast"] }] }],
      acceptance: [{ id: "cast", title: "Cast", criteria: [{ kind: "targetChange", target: { mapId } }] }] }, "plan");
  }
  if (!state.staged) {
    state.staged = true;
    return toolCall("set_build_spec", { mapId, title: "Rina staging",
      assets: [{ id: "npc_a", kind: "npc", x: 3, y: 3, w: 1, h: 1, overExisting: "keep" }],
      buildOrder: ["npc"], density: "normal", layoutStyle: "straight", pathWidth: 1 }, "spec");
  }
  if (!state.placed) {
    state.placed = true;
    return toolCall("place_npc", { mapId, x: 3, y: 3, name: "주민", pages: [{}], id: EV_ID }, "npc");
  }
  if (!state.cast) {
    state.cast = true;
    return toolCall("author_npc_cast", { mapId, residents: [{ eventId: EV_ID, name: "Rina",
      role: "어부", summary: "새벽 어부", knows: [], pages: [{ pageId: PAGE_ID, lines: ["New authored dialogue"] }] }] }, "cast");
  }
  if (!state.shown) {
    state.shown = true;
    return toolCall("show_map_region", { mapId, x: 0, y: 0, w: 20, h: 15 }, "show");
  }
  return { message: { role: "assistant", content: "Finished" }, finishReason: "stop" };
}

function makeSession(project: Project, mapId: string, state: ScriptState) {
  return new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 30 },
    declareIntent: fixedDeclarer({ mode: "modify", tools: ["author_npc_cast"] }),
    renderImages: async () => [{ label: "Current map", dataUrl: "data:image/png;base64,AA==" }],
    chat: async (_config, request) => {
      // 2026-09-17: 검수 모델은 호출되지 않는다(결정적 검사). 들어오면 테스트가 깨지도록 던진다.
      if (independentReviewPayload(request)) throw new Error("unexpected independent-review request");
      return { ...writerRound(mapId, state) as ChatResult, imageDelivery: imageDeliveryForRequest(request) };
    },
  });
}

function freshState(): ScriptState {
  return { planned: false, staged: false, placed: false, cast: false, shown: false };
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("npc cast review apply undo preserves existing manual/locked wiki plus the new graph", async () => {
  const project = createBlankProject();
  project.world = seedWorld();
  store.replace(project);
  history.resetMapEditHistory();
  const mapId = project.startMapId;
  const session = makeSession(project, mapId, freshState());
  const result = await session.sendUserMessage("Cast Rina", () => {}, undefined, { autonomous: true });

  expect(result.review?.status, result.error).toBe("approved");
  expect(result.appliedCalls?.map(call => call.name)).toEqual(["place_npc", "author_npc_cast"]);
  const world = store.getCurrent().world!;
  const ids = world.entities.map(entity => entity.id);
  // Existing wiki-owned documents survive alongside the reviewed registrations.
  expect(ids).toEqual(expect.arrayContaining(["w_original", "w_manual", "w_locked"]));
  // Reviewed authored graph is intact: place, character, locatedIn.
  expect(ids).toEqual(expect.arrayContaining(["w_place_map_blank_start", "w_npc_ev_cast"]));
  expect(world.relations).toContainEqual({ a: "w_npc_ev_cast", b: "w_place_map_blank_start", kind: "locatedIn" });
  const castEvent = store.getCurrent().maps[MAP_KEY]!.events.find(event => event.id === EV_ID)!;
  expect(JSON.stringify(castEvent)).toContain("New authored dialogue");
  // The exact authored values and recorded approval survive; live apply authority is consumed.
  expect(session.getResultReview()).toEqual(result.review);
  expect(session.getResultReview()?.status).toBe("approved");
  expect(session.isDraftReviewApproved()).toBe(false);
  // Undo restores the pre-apply project; work logs add no extra wiki snapshot.
  const entries = history.getMapEditHistoryEntries().length;
  expect(entries).toBeGreaterThanOrEqual(1);
  let undone = 0;
  while (history.undoMapEdit()) {
    undone += 1;
    if (undone > entries + 1) throw new Error("Undo did not converge");
  }
  expect(store.getCurrent().world?.entities.map(entity => entity.id).sort())
    .toEqual(["w_locked", "w_manual", "w_original"]);
  expect(store.getCurrent().maps[MAP_KEY]!.events.some(event => event.id === EV_ID)).toBe(false);
}, 90000);

it("a newer manual wiki document during the held review is preserved, never lost", async () => {
  // 2026-09-17: 검수 모델 호출이 없어 응답을 붙잡아 둘 수 없다. 결정적 검사의 유일한 외부 경계인
  // run_lint 실행 중에 수동 위키 편집을 끼워 넣는다 — 검사 도중에 들어온 문서도 적용에서 보존돼야 한다.
  const project = createBlankProject();
  project.world = seedWorld();
  store.replace(project);
  history.resetMapEditHistory();
  const mapId = project.startMapId;
  const session = makeSession(project, mapId, freshState());
  const lint = getTool("run_lint")!;
  const realLint = lint.run.bind(lint);
  let interleaved = 0;
  vi.spyOn(lint, "run").mockImplementation((...args) => {
    if (interleaved++ === 0) {
      // Intervening manual wiki edit on another surface while the deterministic check runs.
      store.update((draft) => {
        draft.world!.entities.push(manualWikiDoc("w_held_note", "Note written during review"));
      }, { scope: "project", origin: "human", label: "Manual wiki note" });
      session.refreshAcceptance(store.getCurrent());
    }
    return realLint(...args);
  });
  const result = await session.sendUserMessage("Cast Rina", () => {}, undefined, { autonomous: true });

  expect(interleaved).toBeGreaterThan(0);
  expect(result.review?.status, result.error).toBe("approved");
  const ids = store.getCurrent().world!.entities.map(entity => entity.id);
  expect(ids).toEqual(expect.arrayContaining(["w_original", "w_manual", "w_locked", "w_held_note"]));
  expect(ids).toEqual(expect.arrayContaining(["w_place_map_blank_start", "w_npc_ev_cast"]));
  expect(store.getCurrent().world!.relations)
    .toContainEqual({ a: "w_npc_ev_cast", b: "w_place_map_blank_start", kind: "locatedIn" });
}, 90000);

it("region apply preserves the reviewed npc graph while keeping live wiki documents", async () => {
  const base = createBlankProject();
  base.world = seedWorld();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(base);
  history.resetMapEditHistory();
  const reviewed = structuredClone(base);
  reviewed.world!.entities.push(
    { id: "w_place_map_blank_start", type: "place", name: "Start", summary: " Reviewed place",
      refs: [{ kind: "map", id: reviewed.startMapId }], origin: "ai" } as never,
    { id: "w_npc_ev_cast", type: "character", name: "Rina", summary: "Reviewed character",
      refs: [{ kind: "event", id: "ev_cast" }], origin: "ai" } as never,
  );
  reviewed.world!.relations.push({ a: "w_npc_ev_cast", b: "w_place_map_blank_start", kind: "locatedIn" });
  // Newer live wiki document arrives after review.
  store.update((draft) => {
    draft.world!.entities.push(manualWikiDoc("w_region_note", "Note during region review"));
  }, { scope: "project", origin: "human", label: "Manual wiki note" });

  applyRegionProjectWithHistory(reviewed, "Region NPC test", reviewed.startMapId);

  const ids = store.getCurrent().world!.entities.map(entity => entity.id);
  expect(ids).toEqual(expect.arrayContaining(
    ["w_original", "w_manual", "w_locked", "w_region_note", "w_place_map_blank_start", "w_npc_ev_cast"]));
  expect(store.getCurrent().world!.relations)
    .toContainEqual({ a: "w_npc_ev_cast", b: "w_place_map_blank_start", kind: "locatedIn" });
});
