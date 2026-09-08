import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAcceptance, parseAcceptanceCriteriaResult } from "@/ai/assistantAcceptance";
import { evaluateAcceptanceCriterion } from "@/ai/assistantAcceptanceEvaluation";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { workPlanFromSetToolArgs } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { renderTitleScreen } from "@/player/titleScreen";
import { store } from "@/project/store";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { fixedDeclarer } from "./intentFixture";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";

const title = "작은 열쇠";
const criterion = { kind: "gameTitle", title };
const plan = { goal: "Requested title", layers: [{ title: "Author", items: [{ id: "work", title: "Title", instruction: "Set the requested title" }] }] };
afterEach(() => vi.restoreAllMocks());

describe("literal displayed game-title acceptance", () => {
  it("parses the narrow shape through normal plan requirements without changing Unicode", () => {
    expect(parseAcceptanceCriteriaResult([criterion])).toEqual({ criteria: [criterion], issues: [] });
    expect(workPlanFromSetToolArgs({ ...plan, requirements: [{ id: "req_title", title, criteria: [criterion] }] })?.requirements)
      .toEqual([{ id: "req_title", title, required: true, criteria: [criterion] }]);
  });

  it.each([undefined, null, true, 1, {}, [], "", " \t\n"])("rejects malformed title %j with field diagnostics", value => {
    const parsed = parseAcceptanceCriteriaResult([{ kind: "gameTitle", title: value }]);
    expect(parsed.criteria).toBeNull();
    expect(parsed.issues).toMatchObject([{ criterionIndex: 0, field: "criteria[0].title", example: { kind: "gameTitle" } }]);
  });

  it.each([{ ...criterion, passed: true }, { ...criterion, path: "meta.title" }, { ...criterion, target: { mapId: "map_id" } }, { kind: "projectTitle", title }])("rejects unknown kinds/fields atomically: %j", value => {
    expect(parseAcceptanceCriteriaResult([criterion, value]).criteria).toBeNull();
  });

  it.each([
    { meta: title, visible: "Wrong title", expected: title, passed: false },
    { meta: "Unrelated metadata", visible: title, expected: title, passed: true },
    { meta: title, visible: `${title}!`, expected: title, passed: false },
    { meta: title, visible: title.normalize("NFD"), expected: title, passed: false },
    { meta: title, visible: title, expected: ` ${title}`, passed: false },
    { meta: title, visible: undefined, expected: title, passed: false },
    { meta: title, visible: undefined, expected: defaultTitleScreenSettings().title, passed: true },
  ])("agrees with the actual renderer for override/default/exact Unicode: %j", ({ meta, visible, expected, passed }) => {
    const project = createBlankProject();
    project.meta.title = meta;
    project.system.titleScreen = visible === undefined ? undefined : { ...defaultTitleScreenSettings(), title: visible };
    const parsed = parseAcceptanceCriteriaResult([{ kind: "gameTitle", title: expected }]).criteria;
    expect(parsed).not.toBeNull();
    const restore = installFakeDom();
    try {
      const screen = renderWithFakeDom(() => renderTitleScreen(project, { onNewGame() {}, onResume() {}, onContinue() {}, onQuit() {} }));
      const displayed = screen.querySelector(".rm-title-screen-title")?.textContent;
      expect(displayed).toBe(visible ?? defaultTitleScreenSettings().title);
      expect(evaluateAcceptanceCriterion(parsed![0], { project, baseline: project, bindings: new Map(), reviewed: () => false }).passed).toBe(passed);
      expect(passed).toBe(displayed === expected);
    } finally { restore(); }
  });

  it.each([
    { mode: "text" as const, resourceId: "oprn-title-field", passed: true },
    { mode: "both" as const, resourceId: "oprn-title-field", passed: true },
    { mode: "graphic" as const, resourceId: "oprn-title-field", passed: false },
    { mode: "graphic" as const, resourceId: "missing-logo", passed: false },
    { mode: "graphic" as const, resourceId: undefined, passed: true },
  ])("cannot verify hidden text behind a graphic, but honors the renderer's text fallback: %j", ({ mode, resourceId, passed }) => {
    const project = createBlankProject();
    project.system.titleScreen = { ...defaultTitleScreenSettings(), title, titleGraphic: { mode, resourceId, x: 0, y: 0 } };
    const parsed = parseAcceptanceCriteriaResult([criterion]).criteria;
    expect(parsed).not.toBeNull();
    const restore = installFakeDom();
    try {
      const screen = renderWithFakeDom(() => renderTitleScreen(project, { onNewGame() {}, onResume() {}, onContinue() {}, onQuit() {} }));
      expect(screen.querySelector(".rm-title-screen-title")?.textContent === title).toBe(passed);
      expect(evaluateAcceptanceCriterion(parsed![0], { project, baseline: project, bindings: new Map(), reviewed: () => true }).passed).toBe(passed);
    } finally { restore(); }
  });

  it("retains original source, required flag, valid siblings and baseline across malformed repair and re-adoption", () => {
    const project = createBlankProject();
    const source = { requestId: "original-request", text: "Keep the map and display the required title", scope: null };
    const keep = { kind: "preserve", target: { mapId: project.startMapId } };
    const ledger = new AssistantAcceptanceLedger("owner", "Original goal", project);
    ledger.adopt(parseAcceptance([{ id: "req_title", title, required: false, criteria: [{ kind: "gameTitle", title: true }] },
      { id: "keep", title: "Original map", criteria: [keep] }])!, project, source);
    const sibling = ledger.evaluate(project, project).items[1];
    expect(ledger.repair("req_title", [criterion, { ...criterion, title: false }]).code).toBe("malformed-criteria");
    expect(ledger.repair("req_title", [criterion])).toMatchObject({ ok: true, code: "repaired" });
    project.maps[project.startMapId].name = "Changed after original request";
    ledger.adopt(parseAcceptance([{ id: "req_title", title: "Replacement", required: false, criteria: [{ kind: "gameTitle", title: "Wrong" }] },
      { id: "keep", title: "Rebased", criteria: [keep] }])!, project, { ...source, requestId: "later" });
    expect(ledger.repair("req_title", [{ kind: "gameTitle", title: "Wrong" }]).code).toBe("immutable-valid");
    expect(ledger.repair("keep", [criterion]).code).toBe("immutable-valid");
    const snapshot = ledger.evaluate(project, project);
    expect(snapshot).toMatchObject({ id: "owner", items: [{ id: "req_title", title, required: true, source },
      { id: "keep", title: sibling.title, source, evidence: [{ expected: JSON.stringify(keep), passed: false }] }] });
  });
});

describe("title declaration and repair through the actual session/registered tool", () => {
  it.each([false, true])("wrong visible title fails and correct exact title passes after normal repair (missing=%s)", async missing => {
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async applied => ({ ok: true, applied,
      commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "test", toolNames: [], recordedAt: "2026-09-08T00:00:00.000Z" } }));
    const project = createBlankProject();
    project.meta.title = title;
    project.system.titleScreen = { ...defaultTitleScreenSettings(), title: "Wrong visible title" };
    const events: SessionEvent[] = [];
    const batches = [
      [{ name: "set_work_plan", args: { ...plan, requirements: [
        { id: "req_title", title, ...(missing ? {} : { criteria: [{ kind: "gameTitle", title: true }] }) },
        { id: "keep", title: "Keep map", criteria: [{ kind: "preserve", target: { mapId: project.startMapId } }] },
      ] } }],
      [{ name: "repair_acceptance", args: { itemId: "req_title", criteria: [criterion] } }],
      [{ name: "review_acceptance", args: { itemId: "req_title", verdict: "pass", note: "Worker claims title is correct" } }],
      [{ name: "repair_acceptance", args: { itemId: "req_title", criteria: [{ kind: "gameTitle", title: "Wrong visible title" }] } }],
      [{ name: "set_title_screen", args: { title } }, { name: "skip_work_item", args: { itemId: "work" } }],
    ];
    let index = 0;
    const session = new AssistantSession(project, { config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: async (): Promise<ChatResult> => {
        const batch = batches[index++];
        return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({ id: `${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "TITLE_COMPLETE" }, finishReason: "stop" };
      } });
    await session.sendUserMessage("Display the exact requested game title", event => events.push(event), undefined, { autonomous: true });
    const repairs = events.filter(event => event.type === "tool_call" && event.name === "repair_acceptance");
    expect(repairs).toMatchObject([{ result: { ok: true, data: { code: "repaired" } } }, { result: { ok: false, data: { code: "immutable-valid" } } }]);
    expect(events.find(event => event.type === "tool_call" && event.name === "review_acceptance")).toMatchObject({ result: { ok: false } });
    expect(events.find(event => event.type === "tool_call" && event.name === "set_title_screen")).toMatchObject({ result: { ok: true } });
    expect(events.some(event => event.type === "acceptance" && event.snapshot?.items[0]?.evidence[0]?.passed === false)).toBe(true);
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [
      { id: "req_title", title, required: true, source: { requestId: "request-1" }, evidence: [{ expected: JSON.stringify(criterion), passed: true }] },
      { id: "keep", status: "verified", source: { requestId: "request-1" } },
    ] });
    session.refreshAcceptance(project);
    expect(session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
  });
});
