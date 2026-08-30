import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { EVENT_PAGE_SEMANTICS_BLOCK } from "@/ai/eventPageSemantics";
import { runTool } from "@/editor/tools";
import { SIMPLE_PAGE_SCHEMA, CONDITION_SCHEMA } from "@/editor/tools/schemaShapes";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { findShadowedPages, shadowedPageWarnings } from "@/project/eventPageShadow";
import { resolveEventPage } from "@/project/io/pageResolution";
import { projectLint } from "@/project/lint/projectLint";
import { explainEvent } from "@/project/storyEventExplain";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";

function page(id: string, conditions: readonly EventPageCondition[] = []): EventPage {
  return {
    id,
    name: id,
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { kind: "fixed", route: { moves: [], repeat: false, ignoreImpossible: true } },
    commands: [{ kind: "text", body: id }],
  } as EventPage;
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

  it("stays quiet for a single page and for genuinely distinct conditions", () => {
    expect(findShadowedPages([page("only")])).toEqual([]);
    expect(findShadowedPages([
      page("day", [{ kind: "timePhase", phase: "day" }]),
      page("night", [{ kind: "timePhase", phase: "night" }]),
    ])).toEqual([]);
  });

  it("warning text explains the runtime rule and the random-dialogue fix", () => {
    const warnings = shadowedPageWarnings("'잡화상'", [page("p1"), page("p2")]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("절대 발동하지 않습니다");
    expect(warnings[1]).toContain("m2-211-weighted-branch");
  });
});

describe("AI surfaces that teach page semantics", () => {
  it("system prompt always carries the page semantics block", () => {
    const project = createBlankProject();
    for (const budgetChars of [6000, 12_000, 40_000]) {
      const prompt = buildSystemPrompt(project, { budgetChars });
      expect(prompt).toContain("## 이벤트 페이지 의미론");
      expect(prompt).toContain(EVENT_PAGE_SEMANTICS_BLOCK);
    }
  });

  it("page semantics states one-active-page, last-wins and the random pattern", () => {
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("정확히 1장");
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("뒤에서 앞으로");
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("m2-211-weighted-branch");
    expect(EVENT_PAGE_SEMANTICS_BLOCK).toContain("selfSwitch");
  });

  it("rule 8 no longer tells the model to multiply pages", () => {
    const prompt = buildSystemPrompt(createBlankProject(), { budgetChars: 40_000 });
    expect(prompt).not.toContain("분기 대사로 페이지를 풍부하게");
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
});
