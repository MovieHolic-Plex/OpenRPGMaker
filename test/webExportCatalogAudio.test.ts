import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, ProjectFormatError } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";
import { BUNDLED_TILESET_REF } from "@/project/bundledTilesetRefs";
import { jsonEqual } from "@/util/structuralJson";
import type { Project } from "@/project/types";
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
import { isolateTimers } from "./mergedTeardown";

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
