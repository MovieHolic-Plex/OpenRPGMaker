import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { EVENT_PAGE_SEMANTICS_BLOCK } from "@/ai/eventPageSemantics";
import { runTool } from "@/editor/tools";
import { SIMPLE_PAGE_SCHEMA, CONDITION_SCHEMA } from "@/editor/tools/schemaShapes";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { findShadowedPages, findUnwrittenSelfSwitchGates, shadowedPageWarnings } from "@/project/eventPageShadow";
import { resolveEventPage } from "@/project/io/pageResolution";
import { projectLint } from "@/project/lint/projectLint";
import { explainEvent } from "@/project/storyEventExplain";
import type { Command, EventPage, EventPageCondition, GameEvent } from "@/project/types";

function page(id: string, conditions: readonly EventPageCondition[] = []): EventPage {
  return {
    id,
    name: id,
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: id }],
  };
}

describe("event page shadowing", () => {
  it("runtime keeps exactly one page and the last match wins", () => {
    const event = { id: "npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page("p1"), page("p2"), page("p3")] } as unknown as GameEvent;
    const resolved = resolveEventPage(event, { switches: {}, variables: {} });
    expect(resolved?.id).toBe("p3");
  });

  it("flags every earlier page when later pages are unconditional", () => {
    const shadows = findShadowedPages([page("p1"), page("p2"), page("p3")]);
    expect(shadows.map((shadow) => shadow.pageId)).toEqual(["p1", "p2"]);
    expect(shadows.every((shadow) => shadow.byPageId === "p3")).toBe(true);
    expect(shadows.every((shadow) => shadow.byUnconditional)).toBe(true);
  });

  it("names the last matching page as the winner, not the nearest one", () => {
    const shadows = findShadowedPages([
      page("p1", [{ kind: "switch", switchId: "s1", value: true }]),
      page("p2", []),
      page("p3", []),
    ]);
    expect(shadows[0]?.pageId).toBe("p1");
    expect(shadows[0]?.byPageId).toBe("p3");
  });

  it("treats a later page as shadowing only when its conditions are a subset", () => {
    const strictLater = findShadowedPages([
      page("base", []),
      page("progressed", [{ kind: "switch", switchId: "s1", value: true }]),
    ]);
    expect(strictLater).toEqual([]);
  });

  it("sees through all-wrapping and key order", () => {
    const wrapped = findShadowedPages([
      page("p1", [{ kind: "switch", switchId: "s1", value: true }, { kind: "timePhase", phase: "night" }]),
      page("p2", [{ kind: "all", conditions: [{ kind: "timePhase", phase: "night" }, { kind: "switch", value: true, switchId: "s1" } as EventPageCondition] }]),
    ]);
    expect(wrapped.map((shadow) => shadow.pageId)).toEqual(["p1"]);
  });

  it("treats any/not composites conservatively instead of inferring semantic subsets", () => {
    const anyComposite = findShadowedPages([
      page("any", [{ kind: "any", conditions: [
        { kind: "switch", switchId: "s1", value: true },
        { kind: "switch", switchId: "s2", value: true },
      ] }]),
      page("s1", [{ kind: "switch", switchId: "s1", value: true }]),
    ]);
    const notComposite = findShadowedPages([
      page("not-off", [{ kind: "not", condition: { kind: "switch", switchId: "s1", value: false } }]),
      page("on", [{ kind: "switch", switchId: "s1", value: true }]),
    ]);
    expect(anyComposite).toEqual([]);
    expect(notComposite).toEqual([]);
  });

  it("stays quiet for a single page and for genuinely distinct conditions", () => {
    expect(findShadowedPages([page("only")])).toEqual([]);
    expect(findShadowedPages([
      page("day", [{ kind: "timePhase", phase: "day" }]),
      page("night", [{ kind: "timePhase", phase: "night" }]),
    ])).toEqual([]);
  });

  it("warning text explains the runtime rule and the random-dialogue fix", () => {
    const warnings = shadowedPageWarnings("'잡화상'", [page("p1"), page("p2")]);
    expect(warnings.some((warning) => warning.includes("p1"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("m2-211-weighted-branch"))).toBe(true);
  });
});

describe("AI surfaces that teach page semantics", () => {
  it("system prompt always carries the page semantics block", () => {
    const project = createBlankProject();
    for (const budgetChars of [6000, 12_000, 40_000]) {
      const prompt = buildSystemPrompt(project, { budgetChars });
      expect(prompt).toContain(EVENT_PAGE_SEMANTICS_BLOCK);
    }
  });

  it("page semantics exposes the machine-consumed authoring tokens", () => {
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("m2-211-weighted-branch");
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("selfSwitch");
  });

  it("SimplePage.conditions is typed as a condition, not a command", () => {
    const conditions = SIMPLE_PAGE_SCHEMA.properties?.conditions as { items?: unknown; description?: string };
    expect(conditions.items).toBe(CONDITION_SCHEMA);
    expect(conditions.description).toContain("마지막");
  });

  it("condition kind enum is the registry, so no kind is silently missing", () => {
    const kind = CONDITION_SCHEMA.properties?.kind as { enum?: readonly string[] };
    expect([...(kind.enum ?? [])].sort()).toEqual([...CONDITION_KINDS].sort());
    expect(kind.enum).toContain("run");
  });
});

describe("dead pages are reported by the diagnostics the model is told to use", () => {
  function projectWithDeadPages() {
    const project = structuredClone(createBlankProject()) as ReturnType<typeof createBlankProject>;
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    (map.events as GameEvent[]).push({
      id: "gossip",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [page("p1"), page("p2"), page("p3")],
    } as unknown as GameEvent);
    return project;
  }

  it("project lint reports event-page-shadowed once per dead page", () => {
    const issues = projectLint(projectWithDeadPages()).filter((issue) => issue.code === "event-page-shadowed");
    expect(issues).toHaveLength(2);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain("gossip");
  });

  it("explain_event marks the dead pages and says so in the summary", () => {
    const project = projectWithDeadPages();
    const explanation = explainEvent(project, project.startMapId, "gossip", { switches: {}, variables: {} } as never, "editor-default");
    expect(explanation.activePageNumber).toBe(3);
    expect(explanation.pages[0]?.shadowedByPageNumber).toBe(3);
    expect(explanation.pages[1]?.shadowedByPageNumber).toBe(3);
    expect(explanation.pages[2]?.shadowedByPageNumber).toBeUndefined();
    expect(explanation.summary).toContain("절대 발동하지 않는 페이지");
  });

  it("place_npc warns in the same turn the model authors the dead pages", () => {
    const project = createBlankProject();
    const result = runTool({ project }, "place_npc", {
      mapId: project.startMapId,
      x: 3,
      y: 3,
      name: "잡화상",
      id: "gossip_npc",
      pages: [{ lines: ["안녕"] }, { lines: ["날씨 좋네"] }, { lines: ["밥 먹었나"] }],
    });
    expect(result.ok, result.summary).toBe(true);
    // 쓰기 툴의 경고는 top-level 이 아니라 diff.warnings 로 나간다(toolRunner) — 모델이 실제로 보는 자리.
    const warnings = ((result.diff?.warnings ?? []) as readonly string[]).join("\n");
    expect(warnings).toContain("절대 발동하지 않습니다");
    expect(warnings).toContain("m2-211-weighted-branch");
  });

  it("place_npc forwards selfSwitch gate warnings through diff.warnings", () => {
    const project = createBlankProject();
    const result = runTool({ project }, "place_npc", {
      mapId: project.startMapId,
      x: 3,
      y: 3,
      name: "gated npc",
      id: "gated_npc",
      pages: [
        { lines: ["first"] },
        { conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["second"] },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const warnings = ((result.diff?.warnings ?? []) as readonly string[]).join("\n");
    expect(warnings).toContain("gated_npc_p1");
    expect(warnings).toContain("setSelfSwitch");
  });
});

describe("selfSwitch gates nobody opens", () => {
  function gatedEvent(withWrite: boolean) {
    const first = page("p1");
    if (withWrite) (first.commands as Command[]).push({ kind: "setSelfSwitch", key: "A", value: true });
    return {
      id: "granny",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [first, page("p2", [{ kind: "selfSwitch", key: "A", value: true }])],
    } as unknown as GameEvent;
  }

  it("flags a page whose selfSwitch is never turned on", () => {
    const gates = findUnwrittenSelfSwitchGates(gatedEvent(false));
    expect(gates).toHaveLength(1);
    expect(gates[0]?.pageId).toBe("p2");
    expect(gates[0]?.keys).toEqual(["A"]);
  });

  it("stays quiet once some page writes that selfSwitch", () => {
    expect(findUnwrittenSelfSwitchGates(gatedEvent(true))).toEqual([]);
  });

  it("finds writes nested inside forks", () => {
    const first = page("p1");
    (first.commands as Command[]).push({
      kind: "fork",
      condition: { kind: "switch", switchId: "s1", value: true },
      then: [{ kind: "setSelfSwitch", key: "A", value: true }],
      else: [],
    } as unknown as Command);
    const event = {
      id: "nested",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [first, page("p2", [{ kind: "selfSwitch", key: "A", value: true }])],
    } as unknown as GameEvent;
    expect(findUnwrittenSelfSwitchGates(event)).toEqual([]);
  });

  it("finds writes reachable only through a choices branch", () => {
    const first = page("p1");
    (first.commands as Command[]).push({
      kind: "choices",
      options: [{
        text: "advance",
        branch: [{ kind: "setSelfSwitch", key: "A", value: true }],
      }],
      cancelBehavior: "disallow",
    });
    const event = {
      id: "nested-choice",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [first, page("p2", [{ kind: "selfSwitch", key: "A", value: true }])],
    } as unknown as GameEvent;
    expect(findUnwrittenSelfSwitchGates(event)).toEqual([]);
  });

  it.each<Command>([
    { kind: "callCommonEvent", commonEventId: "advance-stage" },
    { kind: "callMapEvent", eventId: "advance-stage" },
    { kind: "battleProcessing", troopId: "stage-battle", canEscape: false, canLose: false },
  ])("suppresses gate findings when $kind makes the write set unknown", (command) => {
    const event = gatedEvent(false);
    (event.pages?.[0]?.commands as Command[]).push(command);
    expect(findUnwrittenSelfSwitchGates(event)).toEqual([]);
  });

  it("ignores conditions that require the switch to be OFF", () => {
    const event = {
      id: "offgate",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page("p1"), page("p2", [{ kind: "selfSwitch", key: "A", value: false }])],
    } as unknown as GameEvent;
    expect(findUnwrittenSelfSwitchGates(event)).toEqual([]);
  });

  it("warning list carries the condition-and-write pairing hint", () => {
    const warnings = shadowedPageWarnings("'granny'", gatedEvent(false).pages, []);
    expect(warnings.join("\n")).toContain("영원히 열리지 않습니다");
    expect(warnings.join("\n")).toContain("setSelfSwitch");
  });

});

describe("make_villager does not ship dead pages of its own", () => {
  // runTool 은 draft 를 커밋한 뒤 ctx.project 를 **교체**한다(toolRunner) — 넘긴 객체가 아니라
  // 컨텍스트에서 결과 프로젝트를 읽어야 한다.
  function villager(dialogue: readonly Record<string, unknown>[], extra: Record<string, unknown> = {}) {
    const ctx = { project: createBlankProject() };
    const startMapId = ctx.project.startMapId;
    const result = runTool(ctx, "make_villager", {
      mapId: startMapId,
      home: { x: 4, y: 4 },
      name: "밀집",
      dialogue,
      ...extra,
    });
    const map = ctx.project.maps[startMapId];
    const event = (map?.events ?? []).find((entry) => entry.id.startsWith("ev_villager"));
    return { result, event };
  }

  it("folds unconditional dialogue into one page instead of stacking dead ones", () => {
    const { result, event } = villager([{ text: "첫째" }, { text: "둘째" }]);
    expect(result.ok, result.summary).toBe(true);
    const pages = event?.pages ?? [];
    expect(pages.filter((page) => page.conditions.length === 0)).toHaveLength(1);
    expect(findShadowedPages(pages)).toEqual([]);
    const bodies = (pages[0]?.commands ?? [])
      .filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text")
      .map((command) => command.body);
    expect(bodies).toEqual(["첫째", "둘째"]);
  });

  it("keeps conditional dialogue on its own page", () => {
    const { event } = villager([{ text: "낙" }, { when: { timePhase: "night" }, text: "밤" }]);
    const pages = event?.pages ?? [];
    expect(pages).toHaveLength(2);
    expect(pages[0]?.conditions).toEqual([]);
    expect(pages[1]?.conditions).toEqual([{ kind: "timePhase", phase: "night" }]);
    expect(findShadowedPages(pages)).toEqual([]);
  });

  it("still greets when no unconditional dialogue was given", () => {
    const { event } = villager([{ when: { timePhase: "night" }, text: "밤" }]);
    const pages = event?.pages ?? [];
    expect(pages[0]?.conditions).toEqual([]);
    expect((pages[0]?.commands ?? []).some((command) => command.kind === "text")).toBe(true);
    expect(findShadowedPages(pages)).toEqual([]);
  });

  it("does not warn for the generated friendship progression pages", () => {
    const { result, event } = villager([{ text: "hello" }], { friendshipUnlock: 10 });
    expect(findShadowedPages(event?.pages)).toEqual([]);
    expect(findUnwrittenSelfSwitchGates(event ?? {})).toEqual([]);
    const warnings = ((result.diff?.warnings ?? []) as readonly string[]).join("\n");
    expect(warnings).not.toContain("setSelfSwitch");
    expect(warnings).not.toContain("m2-211-weighted-branch");
  });
});
