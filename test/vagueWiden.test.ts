import { beforeEach, describe, expect, it } from "vitest";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { feasibleModifiers, pickWidenModifier } from "@/ai/vagueWiden";
import { WIDEN_MODIFIERS } from "@/ai/vagueWidenCatalog";
import { resetWidenHistory } from "@/ai/vagueWidenHistory";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { createBlankProject } from "@/project/defaults";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { fixedDeclarer } from "./intentFixture";

const classify = (text: string, intent: Partial<IntentDeclaration>, project = createBlankProject()) => classifyPlainPiTurn({
  project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, piTeam: false,
  autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer(intent), widenRandom: () => 0,
});

describe("vague create requests widen instead of asking", () => {
  beforeEach(() => { resetWidenHistory(); resetIntentDeclarationCache(); });

  it("builds a feasible scene at once instead of returning the clarify question", async () => {
    const result = await classify("집 지어줘", { mode: "create", space: "unclear", widenSubject: "house", clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외"] });
    expect(result.clarify).toBeUndefined();
    expect(result.widen?.startLine).toContain("다른 느낌이면 말해 주세요");
    expect(result.intentNote).toContain(result.widen!.label);
  });

  it("still asks when the declaration is ambiguous without a widen subject", async () => {
    const result = await classify("방 만들어줘", { mode: "create", space: "unclear", clarify: "실내인가요 야외인가요?", clarifyOptions: ["실내", "야외"] });
    expect(result.clarify).toContain("실내인가요");
    expect(result.widen).toBeUndefined();
  });

  it("does not repeat a scene already used in the same project", async () => {
    const first = await classify("마을 만들어줘", { mode: "create", widenSubject: "village" });
    const second = await classify("마을 만들어줘 ", { mode: "create", widenSubject: "village" });
    expect(second.widen?.id).not.toBe(first.widen?.id);
  });
});

describe("widen feasibility filter", () => {
  it("drops a scene whose landmark kit the project does not have", () => {
    const project = createBlankProject();
    expect(feasibleModifiers(project, "village").map((m) => m.id)).toContain("village-windmill-hill");
    const tileset = project.tilesets.beodeul_city!;
    tileset.structureKits = tileset.structureKits?.filter((kit) => kit.id !== "bd-windmill");
    expect(feasibleModifiers(project, "village").map((m) => m.id)).not.toContain("village-windmill-hill");
  });

  it("offers nothing when the scene tileset is missing", () => {
    const project = createBlankProject();
    delete (project.tilesets as Record<string, unknown>).beodeul_city;
    expect(feasibleModifiers(project, "dungeon")).toEqual([]);
    expect(pickWidenModifier([], [])).toBeNull();
  });

  it("reuses the least recently used scene once every feasible one was used", () => {
    const villages = WIDEN_MODIFIERS.filter((m) => m.subject === "village");
    const history = villages.map((m) => m.id);
    expect(pickWidenModifier(villages, history)?.id).toBe(history[0]);
  });
});
