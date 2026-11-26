import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { canMove, cellPassability, isPassable, layeredPassability, passabilityOf, tilePassability } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { passageMarkForTile, directionalPassageFromPreset, togglePassageDirection } from "@/project/tilesetPassage";
import type { TilesetDef, PassFlag, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { padRuns, stickSector, stickSectorKeys } from "@/player/touchPad";
import { normalizeTouchControls, resolveTouchControls } from "@/project/touchControls";
import { createTransitSim, stepTransitSim, transitPose, transitRectCells, type MapTransit } from "@/project/mapTransit";
import { deserialize, ProjectFormatError } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";
import { BUNDLED_TILESET_REF } from "@/project/bundledTilesetRefs";
import { jsonEqual } from "@/util/structuralJson";
import { WebExportContractError, contractFailure } from "@/project/playerDeploymentErrors";
import { exactWebExportEntries } from "@/project/webExportZip";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { listBundledPlayAssetPaths } from "@/assets/bundledAssetWarmup";
import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentManifest";
import { startSession } from "@/project/session";
import { placeFarmBuilding, placeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { conditionalRuntimeAssetPaths, requiredRuntimeAssetPaths, usesGeneratedHeroBattlers } from "@/project/webExportRuntimeAssets";
import { buildWorldDigest, lintWorld, normalizeProjectWorld, normalizeWorld, type ProjectWorld, type WorldEntity } from "@/project/world";

describe("tilesetPassage", () => {
  isolateTimers();
  describe("collisionLayers", () => {
    isolateTimers();
    function setup() {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      const tileset = project.tilesets[map.tilesetId];
      const find = (mark: "o" | "x" | "star") => {
        for (let t = 0; t < tileset.count; t++) if (passageMarkForTile(tileset, t) === mark) return t;
        throw new Error(`no ${mark} tile`);
      };
      return { project, map, tileset, O: find("o"), X: find("x"), STAR: find("star") };
    }
    describe("layeredPassability", () => {
      it("두 층이면 기존 tilePassability 와 같다", () => {
        const { tileset, O, X, STAR } = setup();
        for (const lower of [O, X]) for (const upper of [-1, O, X, STAR]) {
          expect(layeredPassability(tileset, [lower, -1, upper, -1])).toEqual(tilePassability(tileset, lower, upper));
        }
      });
      it("맨 위의 ★ 아닌 타일이 정한다 — 4층 X 는 3층 O 를 막는다", () => {
        const { tileset, O, X } = setup();
        expect(layeredPassability(tileset, [O, -1, O, X]).up).toBe(false);
      });
      it("★ 는 건너뛴다 — 4층 ★ 아래 2층 X 가 정한다", () => {
        const { tileset, O, X, STAR } = setup();
        expect(layeredPassability(tileset, [O, X, -1, STAR]).up).toBe(false);
      });
      it("2층 O 는 1층 X 위에서 통행을 연다(MZ 와 같음)", () => {
        const { tileset, O, X } = setup();
        expect(layeredPassability(tileset, [X, O, -1, -1]).up).toBe(true);
      });
      it("1층이 비면 막힘", () => {
        const { tileset, O } = setup();
        expect(layeredPassability(tileset as TilesetDef, [-1, O, -1, -1])).toEqual({ up: false, down: false, left: false, right: false });
      });
      it("isPassable 이 4층을 본다", () => {
        const { project, map, O, X } = setup();
        setLayerTileAt(map, 1, 0, O);
        expect(isPassable(project, map, 0, 0)).toBe(true);
        setLayerTileAt(map, 4, 0, X);
        expect(isPassable(project, map, 0, 0)).toBe(false);
      });
    });
    describe("배열 없는 통행 읽기", () => {
      it("passabilityOf 는 layeredPassability 와 같다 — ★·빈칸·범위 밖 번호 포함", () => {
        const { tileset, O, X, STAR } = setup();
        const ids = [-1, O, X, STAR, tileset.count + 5];
        for (const a of ids) for (const b of ids) for (const c of ids) for (const d of ids) {
          expect(passabilityOf(tileset, a, b, c, d)).toEqual(layeredPassability(tileset, [a, b, c, d]));
        }
      });
      it("cellPassability 와 canMove 가 4층을 읽는다", () => {
        const { project, map, tileset, O, X } = setup();
        for (let i = 0; i < 2; i++) setLayerTileAt(map, 1, i, O);
        expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], -1]));
        expect(canMove(project, map, 0, 0, 1, 0)).toBe(true);
        setLayerTileAt(map, 4, 1, X);
        expect(cellPassability(tileset, map, 1)).toEqual(layeredPassability(tileset, [O, -1, map.upperTiles[1], X]));
        expect(canMove(project, map, 0, 0, 1, 0)).toBe(false);
        expect(canMove(project, map, 0, 0, -1, 0)).toBe(false);
      });
    });
  });
  describe("tilesetDirectionalPassage", () => {
    isolateTimers();
    describe("directional tileset passage", () => {
      it("maps O, X, and star without collapsing explicit arrows", () => {
        expect(directionalPassageFromPreset("open")).toEqual({
          passability: { down: true, left: true, right: true, up: true },
          priority: "lower",
        });
        expect(directionalPassageFromPreset("blocked")).toEqual({
          passability: { down: false, left: false, right: false, up: false },
          priority: "lower",
        });
        expect(directionalPassageFromPreset("star")).toEqual({
          passability: { down: true, left: true, right: true, up: true },
          priority: "upper",
        });
      });

      it("toggles exactly one movement direction", () => {
        const passage: PassFlag = { down: false, left: true, right: false, up: true };

        expect(togglePassageDirection(passage, "right")).toEqual({ down: false, left: true, right: true, up: true });
        expect(passage).toEqual({ down: false, left: true, right: false, up: true });
      });
    });
  });
});

describe("touchStickFeel", () => {
  isolateTimers();
  const at = (deg: number, r = 40): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
  describe("touch stick sectors (2026-10-24 mobile feel)", () => {
    it("cardinals are wide, diagonals narrow (28..62 degrees only)", () => {
      expect(stickSectorKeys(stickSector(...at(25), null))).toEqual(["ArrowRight"]);
      expect(stickSectorKeys(stickSector(...at(30), null))).toEqual(["ArrowRight", "ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(60), null))).toEqual(["ArrowRight", "ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(65), null))).toEqual(["ArrowDown"]);
      expect(stickSectorKeys(stickSector(...at(-90), null))).toEqual(["ArrowUp"]);
      expect(stickSectorKeys(stickSector(...at(180), null))).toEqual(["ArrowLeft"]);
    });
    it("keeps the held sector across a small wobble (hysteresis)", () => {
      expect(stickSectorKeys(stickSector(...at(32), 0))).toEqual(["ArrowRight"]);
      expect(stickSectorKeys(stickSector(...at(40), 0))).toEqual(["ArrowRight", "ArrowDown"]);
    });
    it("dead zone: 12px to start, 8px to release", () => {
      expect(stickSector(10, 0, null)).toBeNull();
      expect(stickSector(10, 0, 0)).toBe(0);
      expect(stickSector(7, 0, 0)).toBeNull();
    });
    it("dead zone scales with the pad radius: 12% to start, 8% to release (2026-10-30)", () => {
      // 세로 판 반지름 65px: 7.8px 를 넘으면 출발(예전 고정 12px = 18%), 5.2px 밑이면 멈춤.
      expect(stickSector(7, 0, null, 65)).toBeNull();
      expect(stickSector(9, 0, null, 65)).toBe(0);
      expect(stickSector(6, 0, 0, 65)).toBe(0);
      expect(stickSector(5, 0, 0, 65)).toBeNull();
      // 아주 작은 판도 6px 밑으로는 내리지 않는다(엄지를 얹기만 해서 걷지 않게).
      expect(stickSector(5.5, 0, null, 30)).toBeNull();
    });
  });
  describe("running on touch = holding A (2026-11-11, replaces «push the stick past 70%»)", () => {
    it("runs while A is held, and never sends the dash key under always-run (Shift would invert to walking)", () => {
      expect(padRuns(false, false)).toBe(false);
      expect(padRuns(true, false)).toBe(true);
      expect(padRuns(true, true)).toBe(false);
      expect(padRuns(false, true)).toBe(false);
    });
  });
  describe("system.touchControls", () => {
    it("stores only non-default fields", () => {
      expect(normalizeTouchControls({ tapToMove: true, stick: "auto", haptics: true, runButton: false })).toBeUndefined();
      expect(normalizeTouchControls({ runButton: true })).toEqual({ runButton: true });
      expect(normalizeTouchControls({ tapToMove: false, stick: "fixed", bogus: 1 })).toEqual({ tapToMove: false, stick: "fixed" });
    });
    it("device preference beats authored value beats default", () => {
      expect(resolveTouchControls(undefined)).toEqual({ tapToMove: true, stick: "auto", haptics: true, runButton: false });
      expect(resolveTouchControls({ tapToMove: false }).tapToMove).toBe(false);
      expect(resolveTouchControls({ tapToMove: false }, { tapToMove: true }).tapToMove).toBe(true);
    });
  });
});

describe("transitYieldLaneShift", () => {
  isolateTimers();
  // 폭 6 도로(laneShift 0.5)에서 차 몸이 덮는 셋째 줄에 선 사람 앞에서도 1칸 넘게 띄우고 서는지(첫사랑 r7: 0.07칸 앞에서 섰다).
  function run(shift: number, personRow: number) {
    const transit = { routes: [{ id: "r", kind: "road", path: [{ x: 0, y: 10 }, { x: 40, y: 10 }], vehicles: ["mc-veh-truck-a"], headwaySec: 1, ...(shift ? { laneShift: { ew: shift } } : {}) }] } as unknown as MapTransit;
    const sim = createTransitSim(transit, { width: 50, height: 30 }, 0);
    const person = { x: 20, y: personRow };
    for (let i = 0; i < 600; i += 1) stepTransitSim(sim, 1 / 30, (x, y) => x === person.x && y === person.y);
    const v = sim.vehicles[0];
    expect(v, "차가 나와 움직였다").toBeDefined();
    const pose = transitPose(sim, v!);
    return { pose, person, front: pose.rect.x + pose.rect.w };
  }
  describe("사람 앞 양보는 차선 맞춤이 들어간 몸으로 본다", () => {
    for (const row of [10, 11, 12]) {
      it(`laneShift 0.5 · 사람 줄 ${row}`, () => {
        const { pose, person, front } = run(0.5, row);
        expect(pose.rect.x, "출발 칸에서 움직였다").toBeGreaterThan(0);
        expect(front).toBeLessThanOrEqual(person.x - 1);
        expect(transitRectCells(pose.rect).some((c) => c.x === person.x && c.y === person.y)).toBe(false);
      });
    }
    it("laneShift 0 · 사람 줄 11", () => {
      const { front, person } = run(0, 11);
      expect(front).toBeLessThanOrEqual(person.x - 1);
    });
  });
});

describe("webExportCatalogAudio", () => {
  isolateTimers();
  describe("webExportBundledTilesetRefs", () => {
    isolateTimers();
    // 2026-10-25 심사 S4: 내보낸 project.json 이 쓰는 번들 타일셋 정의(칸 통행·tileMeta·킷, 하나에 수 MB)를 통째로 실어
    // 98MB 급 게임이 출하 플레이어 부팅 중 렌더러를 잃었다. 번들 정의와 같은 타일셋은 참조로 싣고 플레이어가 되돌린다.

    describe("web export references bundled tilesets", () => {
      it("a project using only bundled tilesets exports small and round-trips to the same tilesets", () => {
        const project = createBlankProject() as Project;
        const prepared = prepareWebExport(project);
        const wire = JSON.parse(prepared.projectJson) as { tilesets: Record<string, Record<string, unknown>> };
        const refs = Object.entries(wire.tilesets).filter(([, tileset]) => typeof tileset[BUNDLED_TILESET_REF] === "string");
        expect(refs.length).toBe(Object.keys(prepared.project.tilesets).length);
        for (const [, tileset] of refs) expect(tileset.passability).toBeUndefined();
        // 번들 정의를 통째로 실으면 10MB 를 넘는다(beodeul_city 하나가 8MB).
        expect(prepared.summary.projectJsonBytes).toBeLessThan(5_000_000);

        const reloaded = deserialize(prepared.projectJson);
        for (const id of Object.keys(prepared.project.tilesets)) expect(jsonEqual(reloaded.tilesets[id], prepared.project.tilesets[id])).toBe(true);
      });

      it("an edited bundled tileset is still inlined", () => {
        const project = createBlankProject() as Project;
        const id = Object.values(project.maps)[0]!.tilesetId!;
        const tileset = project.tilesets[id]!;
        tileset.tileMeta = tileset.tileMeta?.map((meta, index) => (index === 1 ? { ...meta, label: "저자가 고친 이름" } : meta));
        const wire = JSON.parse(prepareWebExport(project).projectJson) as { tilesets: Record<string, Record<string, unknown>> };
        expect(wire.tilesets[id]![BUNDLED_TILESET_REF]).toBeUndefined();
        expect(Array.isArray(wire.tilesets[id]!.passability)).toBe(true);
      });

      it("a reference whose digest differs from this player's bundle is refused, not silently remapped", () => {
        const prepared = prepareWebExport(createBlankProject() as Project);
        const wire = JSON.parse(prepared.projectJson) as { tilesets: Record<string, Record<string, unknown>> };
        const [id] = Object.entries(wire.tilesets).find(([, tileset]) => tileset[BUNDLED_TILESET_REF])!;
        wire.tilesets[id]![BUNDLED_TILESET_REF] = "0-0-0";
        expect(() => deserialize(JSON.stringify(wire))).toThrow(ProjectFormatError);
      });
    });
  });
  describe("webExportCatalogAudio", () => {
    isolateTimers();
    const sourceUrl = "https://music.example.test/rpg-zzu/bgm/v1/rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";
    const zipPath = "assets/cc0/audio/catalog/rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";
    afterEach(() => vi.unstubAllEnvs());
    function catalogProject() {
      const project = createBlankProject();
      project.system.defaultBgmResourceId = "cc0-bgm-rtp-fld-001";
      return project;
    }
    describe("catalog audio export", () => {
      it.each([
        ["empty", new Uint8Array()],
        ["HTML fallback", new TextEncoder().encode("<!doctype html><html>Not an asset</html>")],
      ] as const)("rejects %s asset bytes instead of writing a broken ZIP", async (_label, bytes) => {
        // Given
        const prepared = prepareWebExport(catalogProject());

        // When
        const error = await exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async () => bytes)
          .catch((caught: unknown) => caught);

        // Then
        expect(error).toBeInstanceOf(WebExportContractError);
        const failure = error as WebExportContractError;
        expect(failure.code).toBe("runtime-asset-unavailable");
        expect(failure.paths).toHaveLength(1);
        expect(prepared.assets.map((asset) => asset.zipPath)).toContain(failure.paths[0]);
        expect(String(failure)).toContain(failure.paths[0]);
      });

      it("names the missing zip path and omits the fetch error", async () => {
        const prepared = prepareWebExport(catalogProject());
        const secret = `C:/private/${"export-canary"}`;
        const error = await exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async () => {
          throw new Error(secret);
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(WebExportContractError);
        const failure = error as WebExportContractError;
        expect(failure.code).toBe("runtime-asset-unavailable");
        expect(prepared.assets.map((asset) => asset.zipPath)).toContain(failure.paths[0]);
        expect(String(failure)).not.toContain(secret);
        expect(JSON.stringify(failure)).not.toContain("canary");
      });

      it("packages the played CDN track at the player's local fallback path", () => {
        // Given
        vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");

        // When
        const prepared = prepareWebExport(catalogProject());

        // Then
        expect(prepared.assets).toContainEqual({
          kind: "public",
          sourcePath: sourceUrl,
          zipPath,
          resourceId: "cc0-bgm-rtp-fld-001",
        });
      });

      it("fetches the exact CDN URL and stores the returned bytes in the ZIP entries", async () => {
        // Given
        vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");
        const music = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]);
        const requested: string[] = [];
        const prepared = prepareWebExport(catalogProject());

        // When
        const entries = await exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async (url) => {
          requested.push(url);
          return url === sourceUrl ? music : new Uint8Array([1]);
        });

        // Then
        expect(requested).toContain(sourceUrl);
        expect(entries.find((entry) => entry.name === zipPath)?.bytes).toEqual(music);
      });

      it("embeds CDN music bytes under the offline player's canonical asset key", async () => {
        // Given
        vi.stubEnv("VITE_BGM_CDN_BASE", "https://music.example.test");
        const music = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]);

        // When
        const result = await createStandaloneHtmlExport(catalogProject(), {
          fetchBytes: async (url) => url === sourceUrl ? music : new Uint8Array([1]),
        });
        const html = await result.blob.text();
        const payload = html.match(/id="oprn-standalone-assets">([^<]*)<\/script>/)?.[1];
        if (!payload) throw new Error("Standalone asset payload missing");

        // Then
        expect(JSON.parse(payload)).toMatchObject({ [zipPath]: "data:audio/mpeg;base64,SUQzBAAAAAAAAA==" });
      });
    });
  });
  describe("webExportContractError", () => {
    isolateTimers();
    function failure(path?: string | readonly string[]): WebExportContractError {
      try {
        contractFailure("runtime-asset-unavailable", path);
      } catch (error) {
        if (error instanceof WebExportContractError) return error;
        throw error;
      }
      throw new Error("contractFailure returned");
    }
    describe("web export contract errors", () => {
      it("names a relative zip path on the failure", () => {
        const error = failure("assets/fonts/Galmuri9.woff2");

        expect(error.code).toBe("runtime-asset-unavailable");
        expect(error.paths).toEqual(["assets/fonts/Galmuri9.woff2"]);
        expect(error.message).toBe(
          "A declared player runtime asset is unavailable. Redeploy the runtime assets. (assets/fonts/Galmuri9.woff2)",
        );
      });

      it("names both sides of a case collision, including a non-ascii path", () => {
        const error = failure(["assets/uploaded/STRASSE.png", "assets/uploaded/Straße.png"]);

        expect(error.paths).toEqual(["assets/uploaded/STRASSE.png", "assets/uploaded/Straße.png"]);
        expect(error.message).toContain("assets/uploaded/STRASSE.png, assets/uploaded/Straße.png");
      });

      it("drops host paths, URLs, and thrown sentences", () => {
        const error = failure([
          "C:/private/build/player.js",
          "https://cdn.example/secret-token",
          "fixture dependency unavailable",
          "../assets/secret.png",
          "/assets/from-root.png",
          "assets/ok.png",
        ]);

        expect(error.paths).toEqual(["assets/ok.png"]);
        expect(error.message).not.toContain("C:/private");
        expect(error.message).not.toContain("secret");
        expect(error.message).not.toContain("fixture dependency");
        expect(String(error)).toContain("assets/ok.png");
      });

      it("keeps the generic message when nothing safe can be shown", () => {
        const error = failure("C:/private/build/player.js");

        expect(error.paths).toEqual([]);
        expect(error.message).toBe("A declared player runtime asset is unavailable. Redeploy the runtime assets.");
      });
    });
  });
  describe("webExportRuntimeAssets", () => {
    isolateTimers();
    const farmingCardPaths = Object.values(FARMING_LIFE_UI_ASSETS).map((path) => path.replace(/^\//, ""));
    function withLifeLedgerData(project: Project): Project {
      return {
        ...project,
        system: { ...project.system, shipping: { ...project.system.shipping, enabled: true } },
      } as Project;
    }
    const heroBattlerPaths = [
      "assets/generated/starter/hires/hero-01-battle.png",
      "assets/generated/starter/hires/idle/hero-01-battle.png",
      "assets/generated/starter/idle/hero-01-battle.png",
    ];
    function withoutGeneratedHeroes(project: Project): Project {
      return {
        ...project,
        database: {
          ...project.database,
          actors: project.database.actors.map((actor) => ({ ...actor, battleCharacterResourceId: "uploaded-custom-battler" })),
        },
      } as Project;
    }
    describe("web export runtime assets — 폐기된 starter 전투 시트", () => {
      it("기본 도트 프로젝트는 삭제된 starter 시트와 idle 스트립을 싣지 않는다", () => {
        const project = createBlankProject();
        expect(usesGeneratedHeroBattlers(project)).toBe(false);
        const required = requiredRuntimeAssetPaths(project);
        const planned = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
        for (const path of heroBattlerPaths) {
          expect(required.has(path), path).toBe(false);
          expect(planned.has(path), path).toBe(false);
        }
      });

      it("생성 영웅 시트를 쓰는 액터가 없으면 그 경로를 뺀다", () => {
        const project = withoutGeneratedHeroes(createBlankProject());
        expect(usesGeneratedHeroBattlers(project)).toBe(false);
        const required = requiredRuntimeAssetPaths(project);
        for (const path of heroBattlerPaths) expect(required.has(path), path).toBe(false);
      });
    });
    describe("web export runtime assets", () => {
      // 기본 게임오버 그림(EasyRPG Game Over.png)은 2026-10-07 저작권 정리로 지웠다 — 「기본 그림을 늘 싣는다」 사례는 은퇴(retiredAssets.ts 가 그 id 를 건너뛴다).
      it("drops life-ledger art from a project that has no life-ledger data", () => {
        // Given
        const project = createBlankProject();

        // When
        const required = requiredRuntimeAssetPaths(project);

        // Then
        for (const path of farmingCardPaths) expect(required.has(path)).toBe(false);
      });

      it("keeps life-ledger art once the project enables that system", () => {
        // Given
        const project = withLifeLedgerData(createBlankProject());

        // When
        const required = requiredRuntimeAssetPaths(project);

        // Then
        for (const path of farmingCardPaths) expect(required.has(path)).toBe(true);
        // 다른 조건부 묶음(#3302 의 에메랄드 전투 배경 등)은 이 프로젝트에서 꺼져 있으니 빠진다 — 무조건 경로 + 생활 장부 그림만 남는다.
        const conditional = new Set(conditionalRuntimeAssetPaths());
        const expected = PLAYER_RUNTIME_ASSET_PATHS.filter((path) => !conditional.has(path) || farmingCardPaths.includes(path));
        expect([...required].sort()).toEqual([...expected].sort());
      });

      it("keeps every runtime asset that no conditional group claims", () => {
        // Given
        const conditional = new Set(conditionalRuntimeAssetPaths());
        const project = createBlankProject();

        // When
        const required = requiredRuntimeAssetPaths(project);

        // Then
        const unconditional = PLAYER_RUNTIME_ASSET_PATHS.filter((path) => !conditional.has(path));
        expect(unconditional.length).toBeGreaterThan(0);
        for (const path of unconditional) expect(required.has(path)).toBe(true);
      });

      it("no longer ships the retired forest reference backdrop", () => {
        // Given
        const project = createBlankProject();

        // When
        const required = requiredRuntimeAssetPaths(project);

        // Then
        // 기본 배경은 도트 겹 배경이다(webExportAssets 가 네 장을 싣는다). 옛 숲 그림은 deprecated/ 로 옮겼다.
        expect(required.has("generated/battle-reference-forest.png")).toBe(false);
      });

      it("plans no life-ledger art in the collected export asset list", () => {
        // Given
        const project = createBlankProject();

        // When
        const planned = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

        // Then
        for (const path of farmingCardPaths) expect(planned.has(path)).toBe(false);
      });

      it("keeps the life-ledger art in the collected list once the project enables that system", () => {
        // Given
        const project = withLifeLedgerData(createBlankProject());

        // When
        const planned = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

        // Then
        for (const path of farmingCardPaths) expect(planned.has(path)).toBe(true);
      });

      // 부팅 검증의 단위 테스트판. player.ts 가 기동 직후 warmBundledPlayAssets(project) 로 실제
      // 요청하는 경로가 곧 「부팅에 필요한 것」 이다. 그 집합이 산출물에 없으면 내보낸 게임이 404 로
      // 깨진다 — 프루닝을 더 좁힐 때 여기가 먼저 빨개져야 한다.
      it("ships every path the exported player warms at boot", () => {
        // Given
        const project = createBlankProject();
        const warmed = listBundledPlayAssetPaths(project);

        // When
        const planned = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

        // Then
        expect(warmed.length).toBeGreaterThan(0);
        const missing = warmed.filter((path) => !planned.has(path));
        expect(missing).toEqual([]);
      });

      // 프루닝이 안전한 근거는 「지금 안 쓴다」가 아니라 「플레이 중에도 쓰이게 될 수 없다」다.
      // hasLifeLedgerData 는 session.farmBuildingPlacements / homeDecorationPlacements 같은
      // **런타임** 필드도 보므로, 내보낼 때 비어 있던 프로젝트가 플레이 중에 그 데이터를 얻으면
      // 잘라낸 카드 아트가 404 가 된다. 실제로는 두 배치 트랜잭션이 database.*Types 를 요구해서
      // 그런 프로젝트는 내보내기 시점에 이미 술어가 참이다 — 그 지배 관계를 여기서 고정한다.
      it("cannot gain life-ledger data at runtime once its art was pruned", () => {
        // Given
        const project = createBlankProject();
        const session = startSession(project, 4242);
        session.gold = 100_000;
        const input = {
          instanceId: "probe_1",
          typeId: project.database.items[0]!.id,
          mapId: project.startMapId,
          x: 2,
          y: 2,
          orientation: "down",
        } as const;

        // When
        const pruned = requiredRuntimeAssetPaths(project);
        const building = placeFarmBuilding(project, session, input);
        const decoration = placeHomeDecoration(project, session, input);

        // Then
        expect(hasLifeLedgerData(project)).toBe(false);
        for (const path of farmingCardPaths) expect(pruned.has(path)).toBe(false);
        expect(building.ok).toBe(false);
        expect(decoration.ok).toBe(false);
        expect(session.farmBuildingPlacements ?? {}).toEqual({});
        expect(session.homeDecorationPlacements ?? {}).toEqual({});
      });
    });
  });
});

describe("worldSystem", () => {
  isolateTimers();
  function world(entities: readonly WorldEntity[], relations: ProjectWorld["relations"] = []): ProjectWorld {
    return { entities, relations };
  }
  function entity(patch: Partial<WorldEntity> = {}): WorldEntity {
    return {
      id: "w_entity",
      type: "character",
      name: "아린",
      summary: "마을의 수호자",
      origin: "user",
      ...patch,
    };
  }
  function smallProject(): Project {
    return {
      startMapId: "map_1",
      maps: {
        map_1: {
          id: "map_1",
          name: "테스트 맵",
          width: 10,
          height: 10,
          tilesetId: "tileset_1",
          tileSize: 16,
          lowerTiles: [],
          upperTiles: [],
          events: [],
        },
      },
      database: {
        items: [],
        skills: [],
        actors: [],
      },
    } as unknown as Project;
  }
  function addNamedNpc(project: Project, id = "ev_sera"): void {
    project.maps[project.startMapId].events.push({
      id,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name: "세라",
          conditions: [],
          graphic: { sprite: { type: "bundled", id: "charset_sera" } },
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: "안녕하세요." }],
        },
      ],
    });
  }
  describe("world guards", () => {
    it("project.world가 없으면 빈 world로 정규화한다", () => {
      expect(normalizeProjectWorld({ title: "legacy" })).toEqual({ entities: [], relations: [] });
    });

    it("알 수 없는 필드를 제거하고 world id prefix와 relation id를 정규화한다", () => {
      const normalized = normalizeWorld({
        extra: "drop",
        entities: [
          {
            id: "hero",
            type: "character",
            name: "아린",
            summary: "수호자",
            origin: "user",
            tags: ["hero"],
            refs: [{ kind: "map", id: "map_1", extra: "drop" }],
            extra: "drop",
          },
          { id: "guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
        ],
        relations: [{ a: "hero", b: "guild", kind: "memberOf", extra: "drop" }],
      });

      expect(normalized).toEqual({
        entities: [
          {
            id: "w_hero",
            type: "character",
            name: "아린",
            summary: "수호자",
            origin: "user",
            tags: ["hero"],
            refs: [{ kind: "map", id: "map_1" }],
          },
          { id: "w_guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
        ],
        relations: [{ a: "w_hero", b: "w_guild", kind: "memberOf" }],
      });
    });

    it("잘못된 entity type을 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [{ ...entity(), type: "monster" }], relations: [] })
      ).toThrow(/type/);
    });

    it("잘못된 ref kind를 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [{ ...entity({ refs: [{ kind: "monster", id: "m1" } as never] }) }], relations: [] })
      ).toThrow(/refs\[0\]\.kind/);
    });

    it("중복 id를 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [entity({ id: "hero" }), entity({ id: "w_hero", name: "복제" })], relations: [] })
      ).toThrow(/중복/);
    });

    it("relation이 없는 entity를 가리키면 거부한다", () => {
      expect(() =>
        normalizeWorld({ entities: [entity({ id: "hero" })], relations: [{ a: "hero", b: "ghost", kind: "knows" }] })
      ).toThrow(/entities에 없습니다/);
    });
  });
  describe("world digest", () => {
    it("빈 world를 짧은 문장으로 반환한다", () => {
      expect(buildWorldDigest(world([]), { maxTokens: 20 })).toBe("세계관 없음");
    });

    it("이름, 타입, summary만 압축해서 출력한다", () => {
      const digest = buildWorldDigest(world([entity({ name: "  아린  ", summary: "  마을을   지킨다  ", body: "긴 본문" })]), {
        maxTokens: 50,
      });
      expect(digest).toBe("[character] 아린: 마을을 지킨다");
      expect(digest).not.toContain("긴 본문");
    });

    it("상한 초과 시 타입 우선순위로 자르고 생략 수를 표시한다", () => {
      const digest = buildWorldDigest(
        world([
          entity({ id: "w_concept", type: "concept", name: "마력", summary: "세계의 힘" }),
          entity({ id: "w_rule", type: "guideline", name: "톤", summary: "차분하게" }),
          entity({ id: "w_faction", type: "faction", name: "상단", summary: "도시를 움직인다" }),
          entity({ id: "w_character", type: "character", name: "세라", summary: "길잡이" }),
        ]),
        { maxTokens: 14 }
      );

      expect(digest).toContain("[guideline] 톤");
      expect(digest).toContain("[faction] 상단");
      expect(digest).not.toContain("[concept] 마력");
      expect(digest).toContain("…외 2개");
    });
  });
  describe("world lint", () => {
    it.each([
      ["map", "missing_map"],
      ["event", "missing_event"],
      ["item", "missing_item"],
      ["skill", "missing_skill"],
      ["actor", "missing_actor"],
    ] as const)("없는 %s ref를 error로 보고한다", (kind, id) => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ refs: [{ kind, id }] })]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "world-ref-missing",
          message: expect.stringContaining(`${kind}:${id}`),
        })
      );
      expect(issues.find((issue) => issue.code === "world-ref-missing")).not.toHaveProperty("x");
    });

    it("refs 없는 lore 개체를 warning으로 보고한다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "place", refs: [] })]), project);

      expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "world-lore-unlinked" }));
    });

    it("world에 등록되지 않은 명명 NPC 이벤트를 warning으로 보고한다", () => {
      const project = smallProject();
      addNamedNpc(project);
      const issues = lintWorld(world([]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "warning", code: "world-npc-unregistered", mapId: project.startMapId, x: 4, y: 5 })
      );
    });

    it("event ref가 있는 명명 NPC 이벤트는 미등록 warning을 내지 않는다", () => {
      const project = smallProject();
      addNamedNpc(project);
      const issues = lintWorld(world([entity({ refs: [{ kind: "event", id: "ev_sera" }] })]), project);

      expect(issues.some((issue) => issue.code === "world-npc-unregistered")).toBe(false);
    });

    it("world에 등록되지 않은 명명 아이템을 warning으로 보고한다", () => {
      const project = smallProject();
      const item = { id: "item_potion", name: "회복약" };
      project.database.items = [item as never];

      const issues = lintWorld(world([]), project);

      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "warning", code: "world-item-unregistered", message: expect.stringContaining(item.id) })
      );
    });

    it("item ref가 있는 명명 아이템은 미등록 warning을 내지 않는다", () => {
      const project = smallProject();
      const item = { id: "item_potion", name: "회복약" };
      project.database.items = [item as never];

      const issues = lintWorld(world([entity({ refs: [{ kind: "item", id: item.id }] })]), project);

      expect(issues.some((issue) => issue.code === "world-item-unregistered")).toBe(false);
    });

    it("body 없는 guideline을 info로 보고한다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "guideline", body: " " })]), project);

      expect(issues).toContainEqual(expect.objectContaining({ severity: "info", code: "world-guideline-body-missing" }));
    });

    it("body가 있는 guideline은 info를 내지 않는다", () => {
      const project = smallProject();
      const issues = lintWorld(world([entity({ type: "guideline", body: "문체는 간결하게." })]), project);

      expect(issues.some((issue) => issue.code === "world-guideline-body-missing")).toBe(false);
    });
  });
});
