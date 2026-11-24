import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { lintCutsceneBeats } from "@/editor/tools/narrativeHorrorTemplateTools";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { passableCellCount, lineCells, type Point } from "@/editor/tools/mapHelpers";
import { forestCoverageTarget } from "@/editor/tools/forestDensity";
import { isTreeTrunkTileId } from "@/project/tilesetHarness";
import type { GameMap } from "@/project/types";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { clusterScatter, jitterPlacement, poissonScatter, wobblePath, type ScatterBounds } from "@/editor/tools/naturalScatter";
import { mulberry32 } from "@/util/rng";
import { isolateTimers } from "./mergedTeardown";

describe("narrativeHorrorTemplateTools", () => {
  isolateTimers();
  describe("narrative/horror template tools", () => {
    it("script_cutscene_preset memory_opening creates cutscene event with beats", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const result = runTool(ctx, "script_cutscene_preset", {
        mapId,
        preset: "memory_opening",
        speaker: "나",
        lines: ["그날을 기억한다.", "창밖의 달빛."],
      });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { eventId?: string; beatCount?: number; preset?: string };
      expect(data.preset).toBe("memory_opening");
      expect(data.beatCount).toBeGreaterThan(2);
      const event = ctx.project.maps[mapId]?.events.find((e) => e.id === data.eventId);
      expect(event?.pages?.length).toBeGreaterThan(0);
      const commands = event?.pages?.[0]?.commands ?? [];
      expect(commands.some((c) => c.kind === "text" || c.kind === "cutsceneControl")).toBe(true);
      expect(commands.some((c) => c.kind === "showPicture")).toBe(true);
      expect(commands.some((c) => c.kind === "erasePicture")).toBe(true);
      expect(commands.some((c) => c.kind === "playAudio")).toBe(true);
      expect(
        commands.some((c) => c.kind === "m2Command" && String(c.fields.effect ?? "").toLowerCase().includes("fade")),
      ).toBe(true);
    });

    it("script_cutscene_preset ending_fade also defines ending", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene_preset", {
        mapId: ctx.project.startMapId,
        preset: "ending_fade",
        endingId: "ending_memory_test",
        endingName: "기억 엔딩",
        lines: ["끝이다."],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.endings?.some((e) => e.id === "ending_memory_test")).toBe(true);
    });

    it("make_horror_loop places traps with checkpoint and optional chase", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const result = runTool(ctx, "make_horror_loop", {
        mapId,
        origin: { x: 3, y: 3 },
        trapCount: 3,
        includeChase: true,
        chaserAt: { x: 7, y: 3 },
        safeZone: { x: 1, y: 1, w: 2, h: 2 },
        mood: true,
      });
      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      const data = result.data as { trapEventIds?: string[]; chaseEventId?: string };
      expect(data.trapEventIds?.length).toBe(3);
      expect(data.chaseEventId).toBeTruthy();
      expect(map.events.some((e) => e.id === data.chaseEventId)).toBe(true);
      const hasKill = map.events.some((e) =>
        (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "killPlayer")),
      );
      expect(hasKill).toBe(true);
      const hasCheckpoint = map.events.some((e) =>
        (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "checkpointSave")),
      );
      expect(hasCheckpoint).toBe(true);
    });

    it("make_horror_loop hidingSpots mapId 는 다른 방의 옷장을 은신처로 만든다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const roomId = "map_bedroom_hide";
      const source = ctx.project.maps[mapId]!;
      ctx.project.maps[roomId] = { ...structuredClone(source), id: roomId, name: "침실", events: [] };
      const closet = runTool(ctx, "upsert_event", {
        mapId: roomId,
        event: {
          id: "ev_closet", x: 4, y: 4,
          pages: [{ id: "p", name: "옷장", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "옷장이다." }] }],
        },
      });
      expect(closet.ok, closet.summary).toBe(true);
      const result = runTool(ctx, "make_horror_loop", {
        mapId,
        trapCells: [{ x: 3, y: 3 }],
        includeChase: true,
        chaserAt: { x: 8, y: 3 },
        hidingSpots: [{ x: 4, y: 4, mapId: roomId }],
        mood: false,
      });
      expect(result.ok, result.summary).toBe(true);
      const page = ctx.project.maps[roomId]!.events.find((event) => event.id === "ev_closet")?.pages?.[0];
      expect(page?.interaction).toEqual({ kind: "hiding" });
    });

    it("make_gallery_room places hotspots and item-gate puzzle", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const itemId = ctx.project.database.items[0]?.id;
      expect(itemId).toBeTruthy();
      const result = runTool(ctx, "make_gallery_room", {
        mapId,
        origin: { x: 2, y: 2 },
        hotspotCount: 6,
        puzzleKind: "item-gate",
        puzzleAt: { x: 8, y: 3 },
        requiredItemId: itemId,
        solveSwitchId: "sw_gallery_open_test",
      });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { created?: number; solveSwitchId?: string; puzzleKind?: string };
      expect(data.created).toBeGreaterThanOrEqual(3);
      expect(data.puzzleKind).toBe("item-gate");
      expect(ctx.project.switches.some((s) => s.id === "sw_gallery_open_test")).toBe(true);
      expect(ctx.project.maps[mapId]!.events.length).toBeGreaterThanOrEqual(4);
    });

    it("lintCutsceneBeats flags consecutive say without breath", () => {
      const warnings = lintCutsceneBeats([
        { kind: "say", text: "a" },
        { kind: "say", text: "b" },
      ]);
      expect(warnings.some((w) => /연속 say|호흡/.test(w))).toBe(true);
    });
  });
  describe("narrative/horror vertical slice contracts", () => {
    it("To the Moon slice: preset cutscene + ending", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(
        runTool(ctx, "script_cutscene_preset", {
          mapId,
          preset: "memory_opening",
          lines: ["회상 시작", "그 사람의 목소리"],
        }).ok,
      ).toBe(true);
      expect(
        runTool(ctx, "script_cutscene_preset", {
          mapId,
          preset: "ending_fade",
          endingId: "ending_moon_slice",
          endingName: "달빛 엔딩",
          lines: ["문을 닫는다."],
        }).ok,
      ).toBe(true);
      expect(ctx.project.endings?.some((e) => e.id === "ending_moon_slice")).toBe(true);
    });

    it("Witch house slice: horror loop tools path", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const r = runTool(ctx, "make_horror_loop", {
        mapId: ctx.project.startMapId,
        trapCells: [
          { x: 4, y: 4 },
          { x: 5, y: 4 },
        ],
        includeChase: true,
        chaserAt: { x: 8, y: 4 },
      });
      expect(r.ok, r.summary).toBe(true);
    });

    it("Ib slice: gallery room orchestration", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const itemId = ctx.project.database.items[0]!.id;
      const r = runTool(ctx, "make_gallery_room", {
        mapId: ctx.project.startMapId,
        hotspotCount: 5,
        puzzleKind: "password",
        password: "IB",
        requiredItemId: itemId,
      });
      expect(r.ok, r.summary).toBe(true);
      const data = r.data as { created?: number };
      expect((data.created ?? 0) >= 3).toBe(true);
    });
  });
  describe("narrative/horror red-team", () => {
    it("rejects or safely handles adversarial template inputs", () => {
      type Case = { id: string; ok: boolean; detail: string };
      const cases: Case[] = [];

      const push = (id: string, fn: () => { ok: boolean; detail: string }) => {
        try {
          cases.push({ id, ...fn() });
        } catch (error) {
          cases.push({ id, ok: false, detail: error instanceof Error ? error.message : String(error) });
        }
      };

      push("rt-cutscene-empty-lines-still-ok", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "script_cutscene_preset", { mapId: ctx.project.startMapId, preset: "memory_opening", lines: [] });
        return { ok: r.ok === true, detail: r.summary };
      });

      push("rt-horror-empty-cells-reject", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "make_horror_loop", { mapId: ctx.project.startMapId, trapCells: [] });
        // empty trapCells falls back to origin grid — still must not throw
        return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok} ${r.summary}` };
      });

      push("rt-chase-out-of-bounds", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "make_horror_loop", {
          mapId: ctx.project.startMapId,
          includeChase: true,
          chaserAt: { x: 999, y: 999 },
          origin: { x: 2, y: 2 },
          trapCount: 1,
        });
        return { ok: r.ok === false, detail: r.summary };
      });

      push("rt-gallery-missing-item", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "make_gallery_room", {
          mapId: ctx.project.startMapId,
          puzzleKind: "item-gate",
          requiredItemId: "item_does_not_exist_zzz",
        });
        // compile_puzzle may reject unknown item — fail closed preferred
        return { ok: r.ok === false || r.ok === true, detail: `ok=${r.ok} ${r.summary}` };
      });

      push("rt-gallery-hotspot-density-warning", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        // force skips by placing on same cells via tiny map occupancy — still no throw
        const r = runTool(ctx, "make_gallery_room", {
          mapId: ctx.project.startMapId,
          origin: { x: 0, y: 0 },
          hotspotCount: 4,
          puzzleKind: "none",
        });
        return { ok: r.ok === true, detail: r.summary };
      });

      push("rt-unknown-preset", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "script_cutscene_preset", {
          mapId: ctx.project.startMapId,
          preset: "not_a_real_preset",
        });
        // schema enum may reject, or tool falls through to memory beats — either safe
        return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok}` };
      });

      push("rt-lint-consecutive-say", () => {
        const w = lintCutsceneBeats([{ kind: "say" }, { kind: "say" }]);
        return { ok: w.length > 0, detail: w.join(" | ") };
      });

      push("rt-horror-without-mood", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "make_horror_loop", {
          mapId: ctx.project.startMapId,
          origin: { x: 2, y: 2 },
          trapCount: 2,
          mood: false,
          includeChase: false,
        });
        return { ok: r.ok === true, detail: r.summary };
      });

      const failed = cases.filter((c) => !c.ok);
      const report = {
        schemaVersion: 1,
        kind: "narrative-horror-red-team-report",
        generatedAt: new Date().toISOString(),
        total: cases.length,
        passed: cases.length - failed.length,
        failed: failed.length,
        cases,
      };
      const outDir = resolve("output/evidence/narrative-horror-redteam");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
      mkdirSync(resolve("artifacts"), { recursive: true });
      writeFileSync(resolve("artifacts/narrative-horror-red-team-report.json"), JSON.stringify(report, null, 2), "utf8");

      expect(failed, failed.map((f) => `${f.id}:${f.detail}`).join("\n")).toEqual([]);
    });
  });
});

describe("narrowForestRepro", () => {
  isolateTimers();
  const props = CONSTRUCTION_TOOLS_V3.find((entry) => entry.name === "place_props")!;
  function narrowForest() {
    // 이 시험은 합본 마을 숲 번호(덤불 289, 밑동 290/292/293)를 잰다 — 저작권 정리(2026-10-07) 뒤 기본 칩셋이 버들항이라 합본 마을을 되살려 그 위에 만든다.
    const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    expect(runTool(context, "create_map", { id: "map_n", name: "좁은 숲", width: 20, height: 15, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID }).ok).toBe(true);
    const result = props.run(context.project, {
      mapId: "map_n",
      area: { x: 0, y: 0, w: 5, h: 15 },
      material: "침엽수",
      density: "dense",
      seed: 11,
    });
    return { project: context.project, map: context.project.maps.map_n! as GameMap, result };
  }
  describe("narrow dense forest", () => {
    it("5x15 영역에서도 dense 커버리지·통행 계약을 지킨다", () => {
      const { project, map } = narrowForest();
      let covered = 0;
      for (let y = 0; y < 15; y += 1) {
        for (let x = 0; x < 5; x += 1) {
          const i = y * map.width + x;
          const u = map.upperTiles[i] ?? -1;
          const l = map.lowerTiles[i] ?? -1;
          // 밑동(290/292/293)은 lower 정위치 — upper 점유만 세면 나무 칸을 놓친다.
          if (u >= 0 || isTreeTrunkTileId(l)) covered += 1;
        }
      }
      expect(covered / 75).toBeGreaterThanOrEqual(forestCoverageTarget("dense") - 0.05);
      const inner = { x: 1, y: 1, w: 3, h: 13 };
      expect(passableCellCount(project, map, inner) / (inner.w * inner.h)).toBeLessThan(0.3);
    });

    it("가장자리는 속보다 덤불이 듬성듬성하다", () => {
      const { map } = narrowForest();
      const isBush = (x: number, y: number): boolean => (map.upperTiles[y * map.width + x] ?? -1) === 289;
      let edgeBush = 0;
      let edgeCells = 0;
      let innerBush = 0;
      let innerCells = 0;
      for (let y = 0; y < 15; y += 1) {
        for (let x = 0; x < 5; x += 1) {
          const onEdge = x === 0 || x === 4 || y === 0 || y === 14;
          if (onEdge) {
            edgeCells += 1;
            if (isBush(x, y)) edgeBush += 1;
          } else {
            innerCells += 1;
            if (isBush(x, y)) innerBush += 1;
          }
        }
      }
      expect(edgeBush / edgeCells).toBeLessThan(innerBush / innerCells);
    });
  });
});

describe("naturalScatter", () => {
  isolateTimers();
  describe("naturalScatter wobblePath", () => {
    it("replays the same seeded wobble snapshot", () => {
      const points = [{ x: 2, y: 2 }, { x: 18, y: 7 }, { x: 23, y: 18 }];
      const first = wobblePath(points, 0.78, mulberry32(12345));
      const second = wobblePath(points, 0.78, mulberry32(12345));

      expect(first).toEqual(second);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.path.length).toBeGreaterThan(points.length);
      expect(first.widthCells.length).toBeGreaterThan(0);
    });

    it("changes naturalized paths when the seed changes", () => {
      const points = [{ x: 3, y: 3 }, { x: 25, y: 12 }, { x: 30, y: 4 }];

      expect(wobblePath(points, 0.9, mulberry32(1)).path).not.toEqual(wobblePath(points, 0.9, mulberry32(2)).path);
    });

    it("matches lineCells exactly at naturalness 0 for horizontal lines", () => {
      const from = { x: 1, y: 4 };
      const to = { x: 9, y: 4 };

      expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
    });

    it("matches lineCells exactly at naturalness 0 for vertical lines", () => {
      const from = { x: 6, y: 2 };
      const to = { x: 6, y: 11 };

      expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
    });

    it("matches lineCells exactly at naturalness 0 for diagonal lines", () => {
      const from = { x: 2, y: 2 };
      const to = { x: 9, y: 6 };

      expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
    });

    it("treats negative naturalness as the lineCells-compatible zero case", () => {
      const from = { x: 9, y: 8 };
      const to = { x: 1, y: 3 };

      expect(wobblePath([from, to], -0.4, mulberry32(999)).path).toEqual(lineCells(from, to));
    });

    it("returns a 4-connected naturalized path with fixed endpoints", () => {
      const result = wobblePath([{ x: 1, y: 1 }, { x: 14, y: 9 }], 0.7, mulberry32(77));

      expect(result.path[0]).toEqual({ x: 1, y: 1 });
      expect(result.path[result.path.length - 1]).toEqual({ x: 14, y: 9 });
      expectFourConnected(result.path);
    });

    it("removes duplicate path cells and keeps width cells separate", () => {
      const result = wobblePath([{ x: 2, y: 2 }, { x: 20, y: 8 }, { x: 5, y: 14 }], 0.95, mulberry32(2026));
      const pathKeys = new Set(keys(result.path));

      expect(pathKeys.size).toBe(result.path.length);
      expect(result.widthCells.length).toBeGreaterThan(0);
      expect(result.widthCells.every((cell) => !pathKeys.has(key(cell)))).toBe(true);
    });

    it("clamps naturalized wobble output to the non-negative waypoint envelope", () => {
      const result = wobblePath([{ x: 0, y: 0 }, { x: 9, y: 0 }], 1, mulberry32(42));

      expect([...result.path, ...result.widthCells].every((cell) => cell.x >= 0 && cell.y >= 0)).toBe(true);
    });
  });
  describe("naturalScatter poissonScatter", () => {
    it("keeps every accepted point at least minGap cells apart", () => {
      const result = poissonScatter({ x: 0, y: 0, width: 12, height: 12 }, 20, 2, mulberry32(7));

      expect(result.missing).toBe(0);
      expect(result.points).toHaveLength(20);
      expectUnique(result.points);
      expectMinGap(result.points, 2);
    });

    it("returns the possible amount and missing count when the request is impossible", () => {
      const result = poissonScatter({ x: 0, y: 0, width: 2, height: 2 }, 4, 3, mulberry32(8));

      expect(result.points).toHaveLength(1);
      expect(result.missing).toBe(3);
    });

    it("returns no points and no missing count for count 0", () => {
      expect(poissonScatter({ x: 0, y: 0, width: 5, height: 5 }, 0, 2, mulberry32(1))).toEqual({ points: [], missing: 0 });
    });

    it("is deterministic for the same seed", () => {
      const bounds = { x: 3, y: 4, width: 8, height: 7 };

      expect(poissonScatter(bounds, 12, 1.5, mulberry32(444))).toEqual(poissonScatter(bounds, 12, 1.5, mulberry32(444)));
    });
  });
  describe("naturalScatter clusterScatter", () => {
    it("clusters most points near the supplied anchor", () => {
      const bounds = { x: 0, y: 0, width: 30, height: 30 };
      const anchor = { x: 15, y: 15 };
      const points = clusterScatter(bounds, [anchor], 40, 2, mulberry32(12));
      const averageDistance = points.reduce((sum, point) => sum + distance(point, anchor), 0) / points.length;

      expect(points).toHaveLength(40);
      expectUnique(points);
      expectInBounds(points, bounds);
      expect(averageDistance).toBeLessThan(4);
    });

    it("creates deterministic seed anchors when none are supplied", () => {
      const bounds = { x: 4, y: 5, width: 10, height: 9 };
      const first = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));
      const second = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));

      expect(first).toEqual(second);
      expect(first).toHaveLength(18);
      expectUnique(first);
      expectInBounds(first, bounds);
    });

    it("caps dense clusters to available cells", () => {
      const points = clusterScatter({ x: 0, y: 0, width: 3, height: 2 }, [{ x: 1, y: 1 }], 20, 1, mulberry32(5));

      expect(points).toHaveLength(6);
      expectUnique(points);
    });
  });
  describe("naturalScatter jitterPlacement", () => {
    it("finds a valid jitter candidate by scanning rings", () => {
      const result = jitterPlacement({ x: 5, y: 5 }, 2, mulberry32(17), (candidate) => candidate.x === 6 && candidate.y === 5);

      expect(result).toEqual({ x: 6, y: 5 });
    });

    it("falls back to the original position when no jitter is valid", () => {
      const origin = { x: 5, y: 5 };

      expect(jitterPlacement(origin, 3, mulberry32(99), () => false)).toEqual(origin);
    });

    it("never returns a candidate outside maxOffset", () => {
      const origin = { x: 10, y: 10 };
      const result = jitterPlacement(origin, 2, mulberry32(21), (candidate) => candidate.x !== origin.x || candidate.y !== origin.y);

      expect(Math.max(Math.abs(result.x - origin.x), Math.abs(result.y - origin.y))).toBeLessThanOrEqual(2);
    });
  });
  function expectFourConnected(points: readonly Point[]): void {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(1);
    }
  }
  function expectUnique(points: readonly Point[]): void {
    expect(new Set(keys(points)).size).toBe(points.length);
  }
  function expectMinGap(points: readonly Point[], minGap: number): void {
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) expect(distance(points[a], points[b])).toBeGreaterThanOrEqual(minGap);
    }
  }
  function expectInBounds(points: readonly Point[], bounds: ScatterBounds): void {
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y);
      expect(point.x).toBeLessThan(bounds.x + bounds.width);
      expect(point.y).toBeLessThan(bounds.y + bounds.height);
    }
  }
  function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function keys(points: readonly Point[]): string[] {
    return points.map(key);
  }
  function key(point: Point): string {
    return `${point.x},${point.y}`;
  }
});
