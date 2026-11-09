import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { factoryArtResourceIds } from "@/project/defaultLeaks";
import { applyShipDefaults } from "@/ai/v2/shipDefaults";
import { buildsWholeGame, openingMissing, shipBlockers } from "@/ai/v2/shipChecks";
import { splitPreexisting } from "@/ai/v2/loop/gates";
import type { Project } from "@/project/types";

const WHOLE = "마을 하나 만들어줘. 거기서 시작하는 모험 게임으로";
const CONTINUE = "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을";

function adventure(): Project {
  const p = createBlankProject() as Project;
  p.meta.title = "새벽의 약속";
  p.system.titleScreen = { ...p.system.titleScreen!, title: "새벽의 약속", backgroundResourceId: "bg-dawn-village" };
  p.gameBlueprint = {
    request: WHOLE, title: "새벽의 약속", premise: "마을에서 시작하는 모험", playerGoal: "등불을 밝힌다", steps: [],
    ending: { name: "새벽의 약속", how: "등불을 밝혀 마을에 희망을 되찾는다", feeling: "희망" },
  } as never;
  p.endings = [{ id: "e1", name: "새벽의 약속", conditions: [], priority: 0, presentation: { finalTitle: "새벽의 약속", backgroundResourceId: "oprn-still-kingdom-day" }, epilogue: [] } as never];
  return p;
}

describe("ship gate keeps checking a continuation turn", () => {
  it("a blueprint remembers the first request, so 'finish it' still counts as building a whole game", () => {
    const p = adventure();
    expect(buildsWholeGame(p, CONTINUE)).toBe(true);
    expect(buildsWholeGame(createBlankProject() as Project, CONTINUE)).toBe(false);
    expect(shipBlockers(p, CONTINUE).map((b) => b.id)).toContain("ending-bg");
  });

  it("an ending that sits on the engine's default opening picture is blocked even when the start project already had it", () => {
    const p = adventure();
    const text = shipBlockers(p, WHOLE).find((b) => b.id === "ending-bg")!;
    const problem = { key: "game:ending-bg", text: `[출하 차단 ending-bg] ${text.message}`, source: "gate" as const };
    const baselineKeys = new Set([problem.key]);
    const split = splitPreexisting([problem], baselineKeys, undefined, undefined);
    expect(split.current).toHaveLength(1);
    expect(split.preexisting).toHaveLength(0);
    const other = { key: "game:scene repeat", text: "[scene repeat] 같은 줄", source: "gate" as const };
    expect(splitPreexisting([other], new Set([other.key]), undefined, undefined).preexisting).toHaveLength(1);
  });
});

describe("the assistant's own fill never picks the engine's default picture for an ending", () => {
  it("replaces a default ending picture and avoids the factory art in the story table", () => {
    const factory = factoryArtResourceIds();
    expect(factory.has("oprn-still-kingdom-day")).toBe(true);
    const p = adventure();
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "oprn-still-kingdom-day" } as never;
    const applied = applyShipDefaults(p, CONTINUE);
    const shown = p.endings[0]!.presentation!.backgroundResourceId!;
    expect(factory.has(shown)).toBe(false);
    expect(applied.some((line) => line.includes("엔딩"))).toBe(true);
    expect(shipBlockers(p, CONTINUE).map((b) => b.id)).not.toContain("ending-bg");
  });

  it("closes a bare ending with a story picture that is not the engine default", () => {
    const p = adventure();
    p.endings[0]!.presentation = undefined as never;
    p.endings[0]!.epilogue = [{ kind: "say", text: "끝." } as never];
    applyShipDefaults(p, WHOLE);
    const shown = p.endings[0]!.presentation?.backgroundResourceId;
    expect(shown).toBeTruthy();
    expect(factoryArtResourceIds().has(shown!)).toBe(false);
  });

  it("leaves a picture the author chose alone", () => {
    const p = adventure();
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "bg-lantern-night" } as never;
    applyShipDefaults(p, WHOLE);
    expect(p.endings[0]!.presentation!.backgroundResourceId).toBe("bg-lantern-night");
  });
});

describe("a finished game must open with an opening", () => {
  it("flags an opening that is switched off or has no scenes, and passes one with scenes or a stage", () => {
    const p = createBlankProject() as Project;
    p.system.opening = { ...p.system.opening!, enabled: false, scenes: [] };
    expect(openingMissing(p).map((b) => b.id)).toEqual(["opening-missing"]);
    p.system.opening = { ...p.system.opening!, enabled: true, scenes: [] };
    expect(openingMissing(p)).toHaveLength(1);
    p.system.opening = { ...p.system.opening!, enabled: true, scenes: [{ id: "s1", kind: "text", narration: "새벽마을의 등불이 꺼졌다.", durationMs: 3000 } as never] };
    expect(openingMissing(p)).toHaveLength(0);
    p.system.opening = { ...p.system.opening!, enabled: true, scenes: [], stage: { mapId: p.startMapId, x: 1, y: 1, eventId: "ev_opening_stage" } as never };
    expect(openingMissing(p)).toHaveLength(0);
  });

  it("shows up in the whole-game ship list and not for a small edit", () => {
    const p = adventure();
    p.system.opening = { ...p.system.opening!, enabled: false, scenes: [] };
    expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("opening-missing");
    const blank = createBlankProject() as Project;
    blank.system.opening = { ...blank.system.opening!, enabled: false, scenes: [] };
    expect(shipBlockers(blank, "촌장을 광장으로 옮겨 줘")).toHaveLength(0);
  });
});
