import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall } from "@/ai/assistantSession";
import { implicitSpecFromViewLocation, resolveTurnViewLocation } from "@/ai/viewRelativeLocation";
import { createBlankProject } from "@/project/defaults";
import { combineDiffs } from "@/project/projectCommitLog";
import type { WorkItem } from "@/ai/workPlan";
import { workPlanFromSetToolArgs } from "@/ai/workPlan";
import { TILE } from "@/project/defaults/constants";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { runTool } from "@/editor/tools";

afterEach(() => vi.restoreAllMocks());

// Captured user input: ai-playable-final/round2/first-audit.json, instruction.
const request = "이 새 리뷰 프로젝트만 사용해서 3분 정도 플레이할 작은 모험 게임 「작은 열쇠」를 만들어 줘. 맵은 정확히 2개: 20×15 마을과 12×10 지하실. 현재 빈 맵은 마을로 활용해도 돼. 마을에서 시작해 촌장에게 부탁을 받고, 지하실에서 황동 열쇠를 얻고, 마을의 잠긴 북쪽 출구를 열면 엔딩이 나와야 해. 열쇠 없이는 출구를 통과할 수 없고, 열쇠는 한 번만 획득하며 출구에서 1개 소비해. 촌장 보상은 20골드이고 반복 대화로 중복 지급되면 안 돼. 안내 표지판 하나의 문구는 정확히 「우물은 북쪽, 지하실은 동쪽」으로 해 줘. 전투나 추가 맵은 필요 없어. 걷기 가능한 연결과 NPC/열쇠/출구 이벤트를 실제로 구현하고 두 맵의 그림을 확인해 줘. 구현한 것과 확인하지 못한 것을 구분해서 말해 줘.";
const signRequest = "안내 표지판 하나의 문구는 정확히 「우물은 북쪽, 지하실은 동쪽」으로 해 줘.";
const viewport = { mapId: "map_blank_start", centerX: 10, centerY: 6, x: 0, y: 0, w: 20, h: 12 };
const rect = { x: 10, y: 0, w: 10, h: 6 };

describe("placement instructions, not game facts, own inferred viewport obligations", () => {
  it.each([signRequest, request])("preserves the captured exact sign through the real session authoring path: %s", async requestText => {
    // Given the captured request and the actual native text-command repair from the audit.
    const project = createBlankProject();
    const body = "우물은 북쪽, 지하실은 동쪽";
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 3 },
      contextOptions: { viewport: { ...viewport, mapId: project.startMapId } },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: async (): Promise<ChatResult> => round++ === 0 ? {
        message: { role: "assistant", content: null, tool_calls: [{ id: "sign", type: "function", function: {
          name: "upsert_event", arguments: JSON.stringify({ mapId: project.startMapId, event: {
            id: "sign", x: 2, y: 8, pages: [{ commands: [{ kind: "text", body }] }],
          } }),
        } }] }, finishReason: "tool_calls",
      } : { message: { role: "assistant", content: "DONE" }, finishReason: "stop" },
    });
    // When the real session runs the authoring tool, without applying to the store.
    const result = await session.sendUserMessage(requestText, () => {});
    // Then raw user input and executable dialogue are preserved, without inferred terrain.
    expect(session.getAuditEntries().find(entry => entry.kind === "user")?.text).toBe(requestText);
    expect(session.getProposedProject().maps[project.startMapId].events.find(event => event.id === "sign")?.pages?.[0]?.commands).toEqual([{ kind: "text", body }]);
    expect(result.proposedCalls.map(call => call.name)).toEqual(["upsert_event"]);
    expect(session["turnImplicitSpec"]).toBeNull();
    expect(session["turnViewSpec"]).toBeNull();
  });

  it.each([
    request,
    signRequest,
    'Set the sign text exactly to "Place a pond at the top right of the viewport".',
    "인벤토리에 북쪽 우물 지도와 동쪽 숲 지도를 추가해 줘.",
    "마을 북쪽에 우물을 만들고 동쪽에 지하실을 만들어 줘.",
    "맵 오른쪽 위에 연못을 만들어 줘.",
    "화면 북쪽에 연못을 만들고 동쪽에 나무를 심어 줘.",
    "화면 오른쪽에 연못을 두고 나무는 위에 심어 줘.",
    "화면을 참고해서 맵 오른쪽 위에 연못을 만들어 줘.",
  ])("does not manufacture a single viewport asset from %s", (requestText) => {
    // Given non-placement text or multiple independent map locations.
    // When both production inference entry points inspect it.
    const located = resolveTurnViewLocation(requestText, viewport);
    const spec = implicitSpecFromViewLocation({ mapId: viewport.mapId, requestText, rect });
    // Then neither may collapse it into a viewport corner.
    expect(located).toBeNull();
    expect(spec).toBeNull();
  });

  it("binds the asset kind only to the viewport placement clause", () => {
    // Given an unrelated inventory fact and a genuine, explicitly viewport-relative pond.
    const requestText = "나무는 인벤토리에 넣어 줘. 지금 화면 오른쪽 위에 연못을 만들어 줘.";
    // When deriving the mandatory box.
    const located = resolveTurnViewLocation(requestText, viewport);
    const spec = implicitSpecFromViewLocation({ mapId: viewport.mapId, requestText, rect });
    // Then the pond, not the inventory tree, owns the northeast region.
    expect(located?.rect).toEqual(rect);
    expect(spec?.assets).toEqual([{ id: "위치 지시", kind: "terrain", ...rect }]);
  });
});

function changedCall(name: string, args: Record<string, unknown>): ProposedCall {
  return { name, args, summary: "changed", reason: "test", destructive: false, result: { ok: true, summary: "changed", diff: { ...combineDiffs([]), tilesChanged: 1, eventsAdded: 1 } } };
}
const npcItem: WorkItem = { id: "npc", title: "NPC", instruction: "Add an NPC with dialogue", status: "in_progress", successTools: ["upsert_event"] };

describe("spatial milestone completion evidence", () => {
  it.each([
    { applied: true, spatialSpec: false },
    { applied: true, spatialSpec: true },
    { applied: false, spatialSpec: false },
    { applied: false, spatialSpec: true },
  ])("does not count prior NPCs toward the next item's quantity ($applied, $spatialSpec)", async ({ applied, spatialSpec }) => {
    // Given two separate quantities on the same map, with real NPC tool results.
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async project => ({
      ok: true, applied: project,
      commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "local test", toolNames: [], recordedAt: "2026-09-06T00:00:00.000Z" },
    }));
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["milestoneAutoApply"] = applied;
    session["workPlan"] = workPlanFromSetToolArgs({ goal: "Separate NPC groups", layers: [{ title: "NPCs", items: [
      { id: "first", title: "First group", instruction: "NPC 2명 배치해 줘", successTools: ["place_npc"], mapTargets: [project.startMapId] },
      { id: "later", title: "Later group", instruction: "NPC 3명 추가해 줘", successTools: ["place_npc"], mapTargets: [project.startMapId] },
    ] }] });
    if (spatialSpec) session["activeSpec"] = { mapId: project.startMapId, assets: [{ id: "npcs", kind: "npc", x: 1, y: 7, w: 10, h: 3 }] };
    const place = (id: string, x: number) => {
      const args = { mapId: project.startMapId, id, name: id, x, y: 8, graphic: { transparent: true }, pages: [{ lines: ["Hello"] }] };
      const result = runTool(session["ctx"], "place_npc", args);
      expect(result.ok).toBe(true);
      expect(result.diff?.eventsAdded).toBe(1);
      session["recordToolResult"]("place_npc", args, result);
      session["upsertProposal"](session["turnProposals"], { name: "place_npc", args, result, summary: result.summary, destructive: false });
    };
    place("first-a", 2);
    place("first-b", 3);
    await session["noteSuccessfulTools"]([...session["turnSuccessfulTools"]], () => {});
    expect(session.getWorkPlan()?.currentItemId).toBe("later");
    expect(session["turnAppliedMilestoneCalls"]).toHaveLength(applied ? 2 : 0);
    // When the next item succeeds at only one of its three requested placements.
    place("later-a", 4);
    await session["noteSuccessfulTools"]([...session["turnSuccessfulTools"]], () => {});
    // Then successful tool names and earlier NPCs cannot complete the later quantity.
    expect(session.getWorkPlan()?.layers[0]?.items.map(item => item.status)).toEqual(["done", "in_progress"]);
    // Completing this item's remaining two placements permits advancement without replay.
    place("later-b", 5);
    place("later-c", 6);
    await session["noteSuccessfulTools"]([...session["turnSuccessfulTools"]], () => {});
    expect(session.getWorkPlan()?.layers[0]?.items.map(item => item.status)).toEqual(["done", "done"]);
  });

  it("does not bind an unrelated ground-fill instruction to a later viewport pond", () => {
    // Given separate ground and viewport-pond work, with an explicit spec for the ground.
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["turnViewSpec"] = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    session["activeSpec"] = { mapId: project.startMapId, assets: [{ id: "ground", kind: "terrain", x: 0, y: 0, w: 20, h: 15 }] };
    session["workPlan"] = workPlanFromSetToolArgs({ goal: "Ground then pond", layers: [{ title: "Terrain", items: [
      { id: "ground", title: "Ground", instruction: "Fill the map ground", successTools: ["fill_region"] },
      { id: "pond", title: "Pond", instruction: "Place a pond in the top right of the viewport", successTools: ["fill_region"] },
    ] }] });
    // When the ground uses the same tool outside the pond's box, then it keeps its own scope.
    expect(session["specGate"]("fill_region", { mapId: project.startMapId, rect: { x: 0, y: 0, w: 20, h: 15 } })).toEqual({ warnings: [] });
    expect(session["turnViewSpecWorkItemId"]).toBeNull();
  });

  it("keeps the captured viewport and applied evidence across a manual continuation", async () => {
    // Given an earlier placement and applied ledger, but a newly moved camera.
    const project = createBlankProject();
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
      contextOptions: { viewport: { ...viewport, x: 4, y: 3, w: 10, h: 8 } },
      declareIntent: fixedDeclarer({ source: "continuation" }),
      chat: async (): Promise<ChatResult> => ({ message: { role: "assistant", content: "DONE" }, finishReason: "stop" }),
    });
    const spec = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    const applied = changedCall("fill_region", { mapId: project.startMapId, rect });
    session["turnViewSpec"] = spec;
    session["turnViewSpecWorkItemId"] = "pond";
    session["turnAppliedMilestoneCalls"] = [applied];
    // When a continuation initializes the next turn, then neither obligation nor proof moves.
    await session.sendUserMessage("계속", () => {});
    expect(session["turnViewSpec"]).toEqual(spec);
    expect(session["turnViewSpecWorkItemId"]).toBe("pond");
    expect(session["turnAppliedMilestoneCalls"]).toEqual([applied]);
  });

  it("uses real milestone application evidence after pending calls are cleared", async () => {
    // Given real draft tool results; only the external persistence boundary is replaced.
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async applied => ({
      ok: true, applied,
      commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "local test", toolNames: [], recordedAt: "2026-09-06T00:00:00.000Z" },
    }));
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["turnImplicitSpec"] = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    const args = { mapId: project.startMapId, rect: { x: 12, y: 1, w: 2, h: 2 }, material: "물" };
    const result = runTool(session["ctx"], "fill_region", args);
    expect(result.ok).toBe(true);
    session["upsertProposal"](session["turnProposals"], { name: "fill_region", args, result, summary: result.summary, destructive: false });
    session["milestoneAutoApply"] = true;
    // When the actual milestone transition applies, rebases, and clears pending proposals.
    await session["maybeAutoApplyMilestone"]({ ...npcItem, id: "pond" }, () => {});
    expect(session["turnProposals"].size).toBe(0);
    const npcArgs = { mapId: project.startMapId, id: "npc", name: "Watcher", x: 2, y: 8, graphic: { transparent: true }, pages: [{ lines: ["Hello"] }] };
    const npc = runTool(session["ctx"], "place_npc", npcArgs);
    expect(npc.ok).toBe(true);
    session["upsertProposal"](session["turnProposals"], { name: "place_npc", args: npcArgs, result: npc, summary: npc.summary, destructive: false });
    // Then the NPC may complete without another terrain write; applied proof is still present.
    expect(session["turnAppliedMilestoneCalls"].map(call => call.name)).toEqual(["fill_region"]);
    expect(session["autoCompleteGate"]()(npcItem)).toEqual({ ok: true });
  });

  it("does not let a same-cell NPC satisfy the owning item's pond placement", () => {
    // Given a pond obligation owned by this item, but only an NPC written in its box.
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["turnViewSpec"] = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    session["turnViewSpecWorkItemId"] = "pond";
    session["upsertProposal"](session["turnProposals"], changedCall("place_npc", { mapId: project.startMapId, id: "npc", x: 12, y: 2 }));
    // When checking spatial completion, then position alone is not the requested placement.
    expect(session["autoCompleteGate"]()({ ...npcItem, id: "pond" })).toMatchObject({ ok: false });
  });

  it.each(["terrain", "selection"])("keeps a genuine viewport placement bounded and protected (kind=%s)", kind => {
    // Given an inferred pond location on an otherwise blank map.
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["turnViewSpec"] = { mapId: project.startMapId, assets: [{ id: "placement", kind, ...rect }] };
    // When the real write gate sees a placement inside, outside, and over existing water.
    const inside = session["specGate"]("fill_region", { mapId: project.startMapId, rect: { x: 12, y: 2, w: 2, h: 2 } });
    const outside = session["specGate"]("fill_region", { mapId: project.startMapId, rect: { x: 2, y: 8, w: 2, h: 2 } });
    const map = session.baselineProject.maps[project.startMapId];
    map.lowerTiles[2 * map.width + 12] = TILE.WATER;
    const protectedResult = session["specGate"]("fill_region", { mapId: project.startMapId, rect: { x: 12, y: 2, w: 2, h: 2 } });
    // Then the inferred box is not an auto-expanding or destructive permit.
    expect(inside).toEqual({ warnings: [] });
    expect(outside).toMatchObject({ ok: false });
    expect(protectedResult).toMatchObject({ ok: false });
    expect(session["turnViewSpec"]?.assets).toHaveLength(1);
  });

  it("binds a viewport obligation to the spatial item that uses it, not another NPC item", () => {
    // Given separate spatial and NPC work items and a genuine inferred pond.
    const project = createBlankProject();
    const session = new AssistantSession(project);
    const pondSpec = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    session["turnViewSpec"] = pondSpec;
    session["workPlan"] = workPlanFromSetToolArgs({ goal: "Pond and NPC", layers: [{ title: "Edit", items: [
      { id: "pond", title: "Pond", instruction: "Place a pond in the top right of the viewport", successTools: ["fill_region"] }, npcItem,
    ] }] });
    // When a pond write claims its location, then a different item cannot reuse that permit.
    expect(session["specGate"]("fill_region", { mapId: project.startMapId, rect })).toEqual({ warnings: [] });
    session["upsertProposal"](session["turnProposals"], changedCall("place_npc", { mapId: project.startMapId, id: "npc", x: 2, y: 8 }));
    expect(session["autoCompleteGate"]()(npcItem)).toEqual({ ok: true });
    const plan = session["workPlan"];
    if (!plan) throw new Error("Expected a parsed plan");
    plan.currentItemId = "npc";
    expect(session["specGate"]("fill_region", { mapId: project.startMapId, rect })).toMatchObject({ ok: false });
  });

  it("retains a fulfilled pond milestone when a later NPC item changes the same map", () => {
    // Given a turn-wide spec and an already applied pond, cleared from pending proposals.
    const project = createBlankProject();
    const session = new AssistantSession(project);
    session["turnImplicitSpec"] = { mapId: project.startMapId, assets: [{ id: "pond", kind: "terrain", ...rect }] };
    session["turnAppliedMilestoneCalls"] = [changedCall("fill_region", { mapId: project.startMapId, rect })];
    session["upsertProposal"](session["turnProposals"], changedCall("place_npc", { mapId: project.startMapId, id: "npc", x: 2, y: 8 }));
    // When the real automatic milestone gate checks the unrelated NPC item.
    const verdict = session["autoCompleteGate"]()(npcItem);
    // Then an applied pond must not be charged a second time to the NPC item.
    expect(verdict).toEqual({ ok: true });
  });
});
