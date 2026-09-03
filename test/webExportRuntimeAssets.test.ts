import { listBundledPlayAssetPaths } from "@/assets/bundledAssetWarmup";
import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { hasLifeLedgerData } from "@/player/lifeLedger";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_RUNTIME_ASSET_PATHS } from "@/project/playerDeploymentManifest";
import { startSession } from "@/project/session";
import {
  placeFarmBuilding,
  placeHomeDecoration,
} from "@/project/spatialPlacementTransactions";
import { collectWebExportAssets } from "@/project/webExportAssets";
import {
  conditionalRuntimeAssetPaths,
  requiredRuntimeAssetPaths,
  usesGeneratedHeroBattlers,
} from "@/project/webExportRuntimeAssets";
import type { Project } from "@/project/types";
import { describe, expect, it } from "vitest";

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

describe("web export runtime assets — 영웅 전투 시트 고해상도 짝", () => {
  it("기본 프로젝트(액터가 생성 영웅 시트를 쓴다)는 시트·idle 스트립을 싣는다", () => {
    const project = createBlankProject();
    expect(usesGeneratedHeroBattlers(project)).toBe(true);
    const required = requiredRuntimeAssetPaths(project);
    for (const path of heroBattlerPaths) expect(required.has(path), path).toBe(true);
    // 내보내기 계획에도 들어간다 — 리소스 id 스캔이 아니라 이 그룹이 싣는 경로다.
    const planned = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
    for (const path of heroBattlerPaths) expect(planned.has(path), path).toBe(true);
  });

  it("생성 영웅 시트를 쓰는 액터가 없으면 그 경로를 뺀다", () => {
    const project = withoutGeneratedHeroes(createBlankProject());
    expect(usesGeneratedHeroBattlers(project)).toBe(false);
    const required = requiredRuntimeAssetPaths(project);
    for (const path of heroBattlerPaths) expect(required.has(path), path).toBe(false);
  });
});

describe("web export runtime assets", () => {
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
    expect(required.size).toBe(PLAYER_RUNTIME_ASSET_PATHS.length);
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

  it("keeps the default battle background, which battles fall back to without a battleback", () => {
    // Given
    const project = createBlankProject();

    // When
    const required = requiredRuntimeAssetPaths(project);

    // Then
    expect(required.has("generated/battle-reference-forest.png")).toBe(true);
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
