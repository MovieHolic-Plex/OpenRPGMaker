import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { blankMap } from "@/project/blueprintAssembly";
import { factoryArtResourceIds } from "@/project/defaultLeaks";
import { applyShipDefaults } from "@/ai/v2/story/shipDefaults";
import { bundledPictureLeft, openingMissing, shipBlockers } from "@/ai/v2/shipChecks";
import { buildsWholeGame } from "@/ai/v2/request/readers";
import { splitPreexisting } from "@/ai/v2/judge/gates";
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

describe("the harness no longer paints the title or ending picture itself", () => {
  it("leaves a default ending picture in place so the ship check keeps blocking the finish", () => {
    const factory = factoryArtResourceIds();
    expect(factory.has("oprn-still-kingdom-day")).toBe(true);
    const p = adventure();
    const applied = applyShipDefaults(p, CONTINUE);
    expect(p.endings[0]!.presentation!.backgroundResourceId).toBe("oprn-still-kingdom-day");
    expect(applied.some((line) => line.includes("그림"))).toBe(false);
    expect(shipBlockers(p, CONTINUE).map((b) => b.id)).toContain("ending-bg");
  });

  it("does not give a bare ending a bundled still either", () => {
    const p = adventure();
    p.endings[0]!.presentation = undefined as never;
    p.endings[0]!.epilogue = [{ kind: "say", text: "끝." } as never];
    applyShipDefaults(p, WHOLE);
    expect(p.endings[0]!.presentation?.backgroundResourceId).toBeUndefined();
    expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("ending-screen");
  });

  it("leaves a picture the author chose alone", () => {
    const p = adventure();
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "bg-lantern-night" } as never;
    applyShipDefaults(p, WHOLE);
    expect(p.endings[0]!.presentation!.backgroundResourceId).toBe("bg-lantern-night");
    expect(shipBlockers(p, WHOLE).map((b) => b.id)).not.toContain("ending-bg");
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
    expect(openingMissing(p)).toHaveLength(1);
    p.system.opening = { ...p.system.opening!, enabled: true, scenes: [
      { id: "s1", kind: "text", narration: "새벽마을의 등불이 꺼졌다.", durationMs: 3000 } as never,
      { id: "s2", kind: "text", narration: "이안은 낡은 표지판을 향해 걸었다.", durationMs: 3000 } as never,
    ] };
    expect(openingMissing(p)).toHaveLength(0);
    p.system.opening = { ...p.system.opening!, enabled: true, scenes: [
      { id: "s1", kind: "text", narration: "  ", durationMs: 3000 } as never,
      { id: "s2", kind: "text", narration: "", durationMs: 3000 } as never,
    ] };
    expect(openingMissing(p)).toHaveLength(1);
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

describe("a bundled still is not this game's picture", () => {
  it("blocks a bundled still on the title and on the ending, and passes the game's own map view", () => {
    const p = adventure();
    p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: "oprn-still-farm-golden" };
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "oprn-pack-still-sky-01" } as never;
    expect(bundledPictureLeft(p).map((b) => b.evidence.split("=")[0])).toEqual(["titleScreen.backgroundResourceId", expect.stringContaining("endings[e1]")]);
    expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("bundled-picture");
    const start = p.maps[p.startMapId!]!;
    expect(blankMap(start)).toBe(true);
    p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: `map-view:${p.startMapId}` };
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: `map-view:${p.startMapId}` } as never;
    expect(bundledPictureLeft(p).map((b) => b.message)).toEqual([expect.stringContaining("빈 맵"), expect.stringContaining("빈 맵")]);
    start.events.push({ id: "ev_sign", name: "표지판", x: 3, y: 3, pages: [{ conditions: [], trigger: "action", commands: [] }] } as never);
    expect(blankMap(start)).toBe(false);
    expect(bundledPictureLeft(p)).toHaveLength(0);
  });

  it("blocks any engine-bundled picture outside the stills catalog: a pack backdrop, an item icon, a panorama", () => {
    // 실측 2026-11-09 번들 1 측정: 엔딩 그림이 scarloxy-backdrop-forest·oprn-item-treasure-ruby-3·oprn-pano-… 로 끝났는데 스틸 카탈로그 판정이 놓쳤다.
    for (const id of ["scarloxy-backdrop-forest", "oprn-item-treasure-ruby-3", "oprn-pano-sky-01"]) {
      const p = adventure();
      p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: id } as never;
      expect(bundledPictureLeft(p).map((b) => b.evidence), id).toEqual([expect.stringContaining("endings[e1]")]);
    }
    const own = adventure();
    own.assets.uploaded["own-ending"] = { id: "own-ending" } as never;
    own.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "own-ending" } as never;
    expect(bundledPictureLeft(own)).toHaveLength(0);
    own.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: `opening-still:forest_title_dark@1000` } as never;
    expect(bundledPictureLeft(own)).toHaveLength(0);
  });

  it("lets the romance key art through only in a romance game, and an uploaded or generated picture always", () => {
    const p = adventure();
    p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: "oprn-title-romance-campus" };
    p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "generated-ending-dawn" } as never;
    // 연애 게임이 아니면 연애 키아트도 번들 그림이다(b1 school-1: 학교 추리 엔딩이 oprn-title-romance-school 로 통과했다).
    expect(bundledPictureLeft(p).map((b) => b.evidence.split("=")[0])).toEqual(["titleScreen.backgroundResourceId", expect.stringContaining("endings[e1]")].slice(0, 1));
    p.system.genreLock = { preset: "romance" } as never;
    expect(bundledPictureLeft(p)).toHaveLength(0);
  });

  it("is never excused as a preexisting defect on a continuation turn", () => {
    for (const id of ["bundled-picture", "ending-screen", "ending-bg", "title-image", "opening-missing"]) {
      const problem = { key: `game:${id}`, text: `[출하 차단 ${id}] 남은 기본값`, source: "gate" as const };
      const split = splitPreexisting([problem], new Set([problem.key]), undefined, undefined);
      expect(split.current, id).toHaveLength(1);
      expect(split.preexisting, id).toHaveLength(0);
    }
  });
});
