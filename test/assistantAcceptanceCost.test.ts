import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import * as sync from "@/project/supabaseProjectSync";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";
import { fixture, plan, skip, target } from "./requiredOutcomeFixture";

beforeEach(resetIntentDeclarationCache);
afterEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  resetIntentDeclarationCache();
});

const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const titleRequirements = (raw: string, value: string) => ({ entries: [{
  source: [anchor(raw)], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value }],
  bindings: [{ source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath: ["value"] }],
}] });
// Private applied snapshots are clones, so caller-reference-only counts would miss half the work.
const isProject = (value: unknown): value is Project => typeof value === "object" && value !== null
  && "meta" in value && "maps" in value && "database" in value && "tilesets" in value;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Cost fixture did not reach its subscribed boundary")), 10_000);
    })]);
  } finally { clearTimeout(deadline); }
}

// Spies call the real fingerprint/clone implementations: counts measure work, not elapsed time.
describe("bounded canonical project comparisons", () => {
  it.each(["same-reference", "same-content", "changed-content"] as const)("compares shared project content once for %s", scenario => {
    // Given several promises that share the same applied/draft pair.
    const applied = createBlankProject();
    const draft = scenario === "same-reference" ? applied : structuredClone(applied);
    if (scenario === "changed-content") draft.meta.title = "Unapplied change";
    const ledger = new AssistantAcceptanceLedger("cost", "Cost", applied);
    ledger.adopt(parseAcceptance(["first", "second", "third"].map(id => ({
      id, title: id, criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }],
    }))) ?? []);
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    // When the real canonical ledger evaluates all promises.
    const snapshot = ledger.evaluate(applied, draft, evidence);
    // Then reference identity costs no serialization; distinct content is compared only once per side.
    expect(fingerprints.mock.calls.filter(([value]) => value === applied || value === draft)).toHaveLength(scenario === "same-reference" ? 0 : 2);
    const expected = scenario === "changed-content" ? "verifying" : "verified";
    expect(snapshot.items.map(item => item.status)).toEqual([expected, expected, expected]);
  });

  it("does not compare or clone an unrelated editor update without authority or verifier evidence", () => {
    // Given a session that has never established an assessment or observed verification.
    const f = fixture();
    const project = structuredClone(f.session.baselineProject);
    project.meta.title = "Unrelated edit";
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    const clones = vi.spyOn(globalThis, "structuredClone");
    // When its applied-state refresh receives an editor update.
    f.session.refreshAcceptance(project);
    // Then the absent authority remains cheap without inventing an assessment.
    expect(fingerprints).not.toHaveBeenCalled();
    expect(clones).not.toHaveBeenCalled();
    expect(f.session.getAcceptanceSnapshot()).toBeNull();
  });

  it.each([false, true])("preserves late-adoption freshness when content changed=%s", async changed => {
    // Given a real verification result before any canonical requirement is declared.
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    await f.run([[{ name: "check_reachability", args }]]);
    const project = structuredClone(f.session.baselineProject);
    if (changed) project.meta.title = "Changed after verification";
    // When a detached applied refresh precedes late adoption, with no new verification call.
    f.session.rebaseProject(project);
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip]]);
    // Then equal content preserves proof while changed content retires it.
    expect(f.session.getAcceptanceSnapshot()?.status).toBe(changed ? "blocked" : "verified");
  });

  it("refreshes a prepared source ledger without fingerprinting projects when no checks exist", async () => {
    // Given a real, satisfied canonical source requirement on the full blank project.
    const f = fixture(), project = structuredClone(f.session.baselineProject);
    const raw = `Set project title to exactly ${JSON.stringify(project.meta.title)}`;
    f.setIntent({ mode: "modify", requestRequirements: titleRequirements(raw, project.meta.title) });
    await f.run([[{ name: "get_project_summary", args: {} }]], {}, raw);
    const source = f.session.getHarnessSnapshot().requests;
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{
      id: "request-1:source:0", required: true, coverage: "declared", sourceSpan: anchor(raw),
      source: { requestId: "request-1", text: raw }, evidence: [{ passed: true }],
    }] });
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    const clones = vi.spyOn(globalThis, "structuredClone");
    const evaluations = vi.spyOn(AssistantAcceptanceLedger.prototype, "evaluate");
    const checks = vi.spyOn(ToolVerificationEvidence.prototype, "hasChecks");
    const events: SessionEvent[] = [];
    // When the same applied content is observed repeatedly, capture/evaluation/publication remain real.
    for (let index = 0; index < 3; index++) f.session.refreshAcceptance(project, event => events.push(event));
    const projectFingerprints = fingerprints.mock.calls.filter(([value]) => isProject(value)).length;
    expect(clones.mock.calls.filter(([value]) => isProject(value))).toHaveLength(3);
    expect(evaluations).toHaveBeenCalledTimes(3);
    expect(events).toHaveLength(3);
    expect(events.every(event => event.type === "acceptance" && event.snapshot?.status === "verified")).toBe(true);
    expect(checks.mock.results.every(result => result.type === "return" && result.value === false)).toBe(true);
    expect(f.session.getHarnessSnapshot().requests).toEqual(source);
    console.log(JSON.stringify({ case: "prepared-source-refresh", refreshes: 3, projectFingerprints, projectClones: 3, evaluations: 3 }));
    expect(projectFingerprints).toBe(0);
  });

  it("keeps missing verifier obligations blocked without inventing evidence to invalidate", async () => {
    const f = fixture();
    await f.run([[plan([{ id: "missing-lint", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }]), skip]]);
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    f.session.refreshAcceptance(f.session.baselineProject);
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{
      id: "missing-lint", status: "blocked", evidence: [{ passed: false }],
    }] });
    expect(fingerprints.mock.calls.filter(([value]) => isProject(value))).toHaveLength(0);
  });

  it.each(["replacement", "in-place"] as const)("still compares real verifier evidence through equal content, %s change and undo", async scenario => {
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    await f.run([[{ name: "check_reachability", args }]]);
    let project = structuredClone(f.session.baselineProject);
    const originalTitle = project.meta.title;
    f.session.rebaseProject(project);
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip]]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    // Equal content still has exact proof, including a different object with the same content.
    project = structuredClone(project);
    f.session.refreshAcceptance(project);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    if (scenario === "replacement") project = structuredClone(project);
    project.meta.title = "Changed after exact verification";
    f.session.refreshAcceptance(project);
    expect(f.session.getAcceptanceSnapshot()?.items.find(item => item.id === "route")?.evidence[0]?.passed).toBe(false);
    project.meta.title = originalTitle;
    f.session.refreshAcceptance(project);
    expect(f.session.getAcceptanceSnapshot()?.items.find(item => item.id === "route")?.evidence[0]?.passed).toBe(false);
    expect(fingerprints.mock.calls.filter(([value]) => isProject(value))).toHaveLength(6);
  });

  it("avoids eight fingerprints across a real applied checkpoint with the panel-equivalent subscriber", async () => {
    // Only transports are scripted. Keep the full project, real tools/apply/store/history and 64-item plan.
    vi.useFakeTimers(); // Unrelated autosave is disabled; no clock advancement drives progress.
    vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
    vi.stubEnv("VITE_SUPABASE_URL", "http://cost.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "cost-checkpoint");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async input => {
      const path = new URL(String(input)).pathname;
      if (["/rest/v1/projects", "/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(path)) return Response.json([]);
      throw new Error(`Unexpected cost transport: ${path}`);
    }));
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(createBlankProject());
    resetMapEditHistory();
    const raw = 'Set project title to exactly "Final 64"';
    const entered = deferred(), release = deferred();
    const applied = deferred(), controller = new AbortController();
    const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
    const evaluations = vi.spyOn(AssistantAcceptanceLedger.prototype, "evaluate");
    const commits = vi.spyOn(sync, "recordProjectCommitToSupabase");
    const events: SessionEvent[] = [], titles: string[] = [];
    let writers = 0;
    const session = new AssistantSession(store.getCurrent(), {
      config: { ...defaultAiConfig(), agentMode: "auto", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, tools: ["set_title_screen"], requestRequirements: titleRequirements(raw, "Final 64") }),
      yieldToUi: async () => {},
      chat: async (_config, request): Promise<ChatResult> => {
        if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", goal: raw,
          layers: [{ id: "titles", title: "Title checkpoints", items: Array.from({ length: 64 }, (_, index) => ({
            id: `title_${index + 1}`, title: `Checkpoint ${index + 1}`, instruction: "Apply the next title", successTools: ["set_title_screen"],
          })) }],
        }) }, finishReason: "stop" };
        writers++;
        if (writers === 1) {
          // Start after source preparation/planning, before the first actual writer.
          fingerprints.mockClear(); evaluations.mockClear(); refreshes.mockClear(); events.length = 0;
        } else if (writers === 2) {
          entered.resolve();
          await release.promise;
        } else throw new Error("Unexpected writer beyond the subscribed checkpoint");
        return { message: { role: "assistant", content: null, tool_calls: [{ id: `title-${writers}`, type: "function", function: {
          name: "set_title_screen", arguments: JSON.stringify({ title: `Stage ${writers}` }),
        } }] }, finishReason: "tool_calls" };
      },
    });
    const refreshes = vi.spyOn(session, "refreshAcceptance");
    const unsubscribe = store.subscribe(project => {
      titles.push(project.meta.title);
      session.refreshAcceptance(project, event => events.push(event));
    });
    const running = session.sendUserMessage(raw, event => {
      events.push(event);
      if (event.type === "milestone_applied") applied.resolve();
    }, controller.signal, { autonomous: true });
    try {
      await bounded(Promise.race([Promise.all([applied.promise, entered.promise]), running.then(() => {
        throw new Error("Run ended before the subscribed applied checkpoint");
      })]));
      const projectFingerprints = fingerprints.mock.calls.filter(([value]) => isProject(value)).length;
      const snapshots = evaluations.mock.results.map(result => {
        if (result.type !== "return") throw new Error("Canonical evaluation did not return");
        return result.value;
      });
      expect(refreshes).toHaveBeenCalledTimes(4);
      expect(evaluations).toHaveBeenCalledTimes(7);
      expect(commits).toHaveBeenCalledTimes(1);
      expect(titles).toEqual(["Stage 1"]);
      expect(store.getCurrent().meta.title).toBe("Stage 1");
      expect(session.getWorkPlan()?.layers[0]?.items).toHaveLength(64);
      expect(snapshots.some(snapshot => snapshot.status === "verifying")).toBe(true);
      expect(snapshots.at(-1)?.status).toBe("working");
      for (const snapshot of snapshots) expect(snapshot.items).toMatchObject([{
        id: "request-1:source:0", required: true, coverage: "declared", sourceSpan: anchor(raw),
        source: { requestId: "request-1", text: raw }, evidence: [{ passed: false }],
      }]);
      const requests = session.getHarnessSnapshot().requests;
      if (requests === undefined) throw new Error("Applied checkpoint is missing its request sources");
      expect(requests[0]?.units[0]).toMatchObject({
        criteria: titleRequirements(raw, "Final 64").entries[0]!.criteria,
        bindings: titleRequirements(raw, "Final 64").entries[0]!.bindings,
      });
      expect(session.getRunOutcome()).toBeNull();
      console.log(JSON.stringify({ case: "applied-checkpoint", refreshes: refreshes.mock.calls.length,
        projectFingerprints, evaluations: evaluations.mock.calls.length, applies: titles.length, commits: commits.mock.calls.length }));
      expect(projectFingerprints).toBe(0);
    } finally {
      controller.abort(); release.resolve();
      try {
        const result = await bounded(running);
        expect(result.stoppedReason).toBe("aborted");
        expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen"]);
        expect(titles).toEqual(["Stage 1"]);
        await bounded(Promise.all(commits.mock.results.map(result => {
          if (result.type !== "return") throw new Error("Commit writer did not return its completion");
          return result.value;
        })));
      } finally { unsubscribe(); }
    }
  });
});
