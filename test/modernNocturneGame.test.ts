import { describe, expect, it } from "vitest";
import { runScatterObject } from "@/editor/tools/placementTools";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { projectLint } from "@/project/lint/projectLint";
import { deserialize, serialize } from "@/project/io";
import { TILE } from "@/project/defaults/constants";
import { runSceneTest } from "@/testing/sceneTestRunner";
import {
  createModernNocturneProject,
  MODERN_MAP,
  MODERN_SWITCH,
} from "@/project/defaults/modernNocturneGame";

function commandKinds(project: ReturnType<typeof createModernNocturneProject>): string[] {
  const kinds: string[] = [];
  const walk = (commands: readonly { kind: string }[]): void => {
    for (const command of commands) {
      kinds.push(command.kind);
      if (command.kind === "choices") {
        for (const option of (command as { options: { branch: { kind: string }[] }[] }).options) walk(option.branch);
      }
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) walk(page.commands);
  return kinds;
}

describe("ModernNocturneGame", () => {
  it("builds a serializable Modern Exteriors RPG with two connected maps", () => {
    const project = createModernNocturneProject();
    expect(project.meta.title).toBe("네온의 유언");
    expect(Object.keys(project.maps)).toEqual([MODERN_MAP.city, MODERN_MAP.rooftop]);
    expect(project.maps[MODERN_MAP.city]?.events).toHaveLength(9);
    expect(project.maps[MODERN_MAP.rooftop]?.events).toHaveLength(2);
    expect(project.tilesets.tileset_modern_exteriors?.tilesPerRow).toBe(30);
    expect(project.tilesets.tileset_modern_exteriors?.image).toEqual({ type: "bundled", id: "tex_modern_exteriors_nocturne" });
    expect(() => JSON.parse(serialize(project))).not.toThrow();
  });

  it("contains the full clue, battle, transfer, choice, and ending contract", () => {
    const project = createModernNocturneProject();
    const kinds = commandKinds(project);
    expect(kinds).toContain("battleProcessing");
    expect(kinds).toContain("transfer");
    expect(kinds).toContain("choices");
    expect(kinds.filter((kind) => kind === "ending")).toHaveLength(2);
    for (const id of Object.values(MODERN_SWITCH)) expect(project.session.switches[id]).toBe(false);
  });

  it("keeps every mandatory interaction reachable from its authored arrival", () => {
    const project = createModernNocturneProject();
    const city = project.maps[MODERN_MAP.city]!;
    const cityReachable = computeReachableCells(project, city, project.startPos.x, project.startPos.y);
    for (const [eventId, label] of [
      ["ev_neon_detective", "형사"],
      ["ev_neon_witness", "목격자"],
      ["ev_neon_alley_clue", "골목 단서"],
      ["ev_neon_memorial", "추모비"],
      ["ev_neon_alley_ghost", "네온 망령"],
      ["ev_neon_rooftop_door", "옥상 계단"],
    ] as const) {
      const target = city.events.find((event) => event.id === eventId)!;
      expect(isAdjacentOrOn(cityReachable, target.x, target.y), label).toBe(true);
    }
    const rooftop = project.maps[MODERN_MAP.rooftop]!;
    const rooftopReachable = computeReachableCells(project, rooftop, 10, 15);
    const custodian = rooftop.events.find((event) => event.id === "ev_neon_custodian")!;
    expect(isAdjacentOrOn(rooftopReachable, custodian.x, custodian.y), "기록수호자").toBe(true);
    expect(cityReachable.size).toBeGreaterThan(300);
  });

  it("passes canonical roundtrip, references, transfers, and collision lint", () => {
    const project = deserialize(serialize(createModernNocturneProject()));
    const errors = projectLint(project).filter((issue) => issue.severity === "error");
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it.each([
    [0, MODERN_SWITCH.endingMercy],
    [1, MODERN_SWITCH.endingExpose],
  ] as const)("plays the authored investigation through ending choice %i", (endingChoice, endingSwitch) => {
    const project = createModernNocturneProject();
    const result = runSceneTest(project, {
      mapId: MODERN_MAP.city,
      start: project.startPos,
      steps: [
        { kind: "set", x: 17, y: 17, facing: "up" },
        { kind: "interact" },
        { kind: "choose", index: 0 },
        { kind: "expect", switchOn: MODERN_SWITCH.caseStarted },

        { kind: "move", to: { x: 10, y: 9 } },
        { kind: "face", dir: "up" },
        { kind: "interact" },
        { kind: "expect", switchOn: MODERN_SWITCH.clueWitness },

        { kind: "move", to: { x: 3, y: 14 } },
        { kind: "face", dir: "down" },
        { kind: "interact" },
        { kind: "expect", switchOn: MODERN_SWITCH.clueDumpster },

        { kind: "move", to: { x: 27, y: 21 } },
        { kind: "face", dir: "up" },
        { kind: "interact" },
        { kind: "expect", switchOn: MODERN_SWITCH.clueMemorial },

        { kind: "move", to: { x: 7, y: 14 } },
        { kind: "face", dir: "down" },
        { kind: "interact" },
        { kind: "expect", switchOn: MODERN_SWITCH.alleyWon },

        { kind: "move", to: { x: 26, y: 10 } },
        { kind: "face", dir: "up" },
        { kind: "interact" },
        { kind: "expect", playerAt: { x: 10, y: 11, mapId: MODERN_MAP.rooftop } },

        { kind: "move", to: { x: 11, y: 9 } },
        { kind: "face", dir: "up" },
        { kind: "interact" },
        { kind: "choose", index: endingChoice },
        { kind: "expect", switchOn: [MODERN_SWITCH.rooftopWon, endingSwitch] },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log).toContain("battle troop_neon_wraith: victory");
    expect(result.log).toContain("battle troop_archive_custodian: victory");
  });
  it("scatters the modern source_rect stamps through the real placement path with exact footprint/size/row-major ids", () => {
    const cases: Array<{ groupId: string; w: number; h: number }> = [
      { groupId: "modern-west-civic", w: 8, h: 8 },
      { groupId: "modern-archive", w: 8, h: 8 },
      { groupId: "modern-utility", w: 8, h: 7 },
      { groupId: "modern-police", w: 6, h: 8 },
      { groupId: "modern-industrial", w: 6, h: 7 },
    ];
    for (const { groupId, w, h } of cases) {
      const project = createModernNocturneProject();
      const map = project.maps[MODERN_MAP.city]!;
      map.lowerTiles.fill(TILE.GRASS);
      map.upperTiles.fill(TILE.EMPTY);
      map.events = [];
      project.startPos = { x: 0, y: 0 };
      const groups = project.tilesets[map.tilesetId]!.tileGroups ?? [];
      const group = groups.find((entry) => entry.id === groupId);
      expect(group, `missing modern group ${groupId}`).toBeDefined();
      expect(group!.patternGrammar?.kind).toBe("source_rect");
      expect(group!.sourceRect, `${groupId} needs sourceRect`).toEqual({ x: expect.any(Number), y: expect.any(Number), width: w, height: h });
      expect(group!.tileIds).toHaveLength(w * h);
      // Building facade ids are all-lower on this pass-through tileset — assert that the production
      // footprintLayer does NOT reroute them as Combined Town tree canopy/trunk.
      const result = runScatterObject(project, {
        mapId: map.id,
        groupId,
        area: { x: 2, y: 2, w, h },
        count: 1,
        minGap: 0,
        maxGap: 0,
        avoidProtected: false,
      });
      expect(result.data, `${groupId}: ${result.summary}`).toMatchObject({ placed: 1, skipped: 0 });
      expect((result.data as { tilesPlaced: number }).tilesPlaced).toBe(w * h);
      const origin = { x: 2, y: 2 };
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const tid = group!.tileIds[y * w + x]!;
          const idx = (origin.y + y) * map.width + (origin.x + x);
          expect(map.lowerTiles[idx], `${groupId} row-major @ ${x},${y}`).toBe(tid);
        }
      }
      expect(map.upperTiles.every((value) => value === TILE.EMPTY), `${groupId} upper stays empty on all-lower priority`).toBe(true);
    }
  });
});
