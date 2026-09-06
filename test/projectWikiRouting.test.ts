import { describe, expect, it } from "vitest";
import { buildIntentFacts, declareIntentCached, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { fixedDeclarer } from "./intentFixture";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";

describe("project wiki intent grounding", () => {
  it("classifies wiki retrieval as a read-only activity", () => {
    expect(aiActivityFamilySource("read_project_wiki")).toBe("read-only");
  });
  it("passes sourced project decisions into intent facts before tool selection", () => {
    const project = createEmptyToolProject("Wiki routing");
    project.world = {
      entities: [{
        id: "w_rule", type: "guideline", name: "Combat", summary: "Direct action", origin: "ai",
        wiki: {
          kind: "declaration", basis: "explicit", combatMode: "action",
          sources: [{ id: "u1", kind: "user", text: "Fight directly on the map", at: 1 }],
        },
      }],
      relations: [],
    };

    const facts = buildIntentFacts({ project, userText: "Add a monster", currentMapId: null, selection: null, hasActivePlan: false });
    const context = Reflect.get(facts, "wikiContext");

    expect(typeof context).toBe("string");
    if (typeof context !== "string") throw new Error("Wiki context was not provided to intent routing");
    expect(JSON.parse(context).combatMode).toBe("action");
  });

  it("does not reuse old routing after a wiki correction with the same request", async () => {
    resetIntentDeclarationCache();
    const project = createEmptyToolProject("Wiki cache");
    const facts = buildIntentFacts({ project, userText: "Add a monster", currentMapId: null, selection: null, hasActivePlan: false });
    await declareIntentCached(fixedDeclarer({ tools: ["make_hunting_ground"] }), { ...facts, wikiContext: '{"combatMode":"contact"}' });

    const corrected = await declareIntentCached(fixedDeclarer({ tools: ["make_action_enemy"] }), { ...facts, wikiContext: '{"combatMode":"action"}' });

    expect(corrected.intent.tools).toEqual(["make_action_enemy"]);
    resetIntentDeclarationCache();
  });
});
