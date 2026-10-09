import { describe, expect, it } from "vitest";

import type { AiPreviewThemeEligibilityEvidence, AiPreviewThemeId } from "@/project/aiPreviewContracts";
import { generateAiPreviewThemeMap } from "@/project/aiPreviewThemeGrammar";
import { TILE } from "@/project/defaults/constants";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import {
  MODERN_EXTERIORS_GRAMMAR_PROFILE,
  registerGrammarProfile,
  RM_TYPE_GRAMMAR_PROFILE,
} from "@/editor/tools/v3/grammarProfiles";
import type { TileGroupMetadata, TileGroupRole } from "@/project/types";

// 역할별 대표 타일 id. 서로 겹치지 않게 두어 맵에 찍힌 숫자만 보고
// 어떤 role 이 선택됐는지 역추적할 수 있게 한다.
const TILE_BY_ROLE: Readonly<Record<string, number>> = {
  terrain: 11,
  wall: 22,
  building: 33,
  prop: 44,
  water: 55,
  fence: 66,
  roof: 77,
  castle: 88,
};

function group(role: TileGroupRole): TileGroupMetadata {
  return {
    id: `g-${role}`,
    name: `${role} group`,
    role,
    defaultLayer: "lower",
    tileIds: [TILE_BY_ROLE[role]],
    description: "",
    placementRules: "",
  };
}

function evidence(roles: readonly TileGroupRole[]): AiPreviewThemeEligibilityEvidence {
  return {
    themeId: "interior-house",
    metadataPack: { metadataPackId: "test", metadataPackVersion: "1", bundledTextureIds: [] },
    satisfiedCapabilities: [],
    missingCapabilities: [],
    semanticGroups: roles.map(group),
  };
}

// generateAiPreviewThemeMap → firstCapabilityTile → groupsForCapability 로 실제로
// 내려가는 유일한 공개 진입점. 표만 읽는 특성화 테스트와 달리 함수 본문을 통과한다.
function themeMap(
  themeId: AiPreviewThemeId,
  roles: readonly TileGroupRole[],
  grammarProfile?: string
) {
  return generateAiPreviewThemeMap({
    charsetAssetId: "charset-1",
    charsetTextureKey: "charset-1",
    goal: "테스트",
    height: 5,
    mapId: "map-1",
    name: "테스트 맵",
    themeEligibility: { ...evidence(roles), themeId },
    themeId,
    tileset: { ...defaultTileset(), grammarProfile },
    width: 5,
  });
}

// 표가 완전히 빈 프로파일. 모든 능력이 소비처의 폴백으로 떨어지므로,
// module-private 인 groupsForCapability 의 폴백 분기를 공개 진입점만으로 관통할 수 있다.
const EMPTY_TABLE_PROFILE_ID = "test-empty-theme-capability-table";
registerGrammarProfile({
  id: EMPTY_TABLE_PROFILE_ID,
  label: "테스트용 빈 themeCapabilityRoles",
  supportedPatternKinds: ["single"],
  layerHomeByRole: {
    terrain: "lower",
    water: "lower",
    wall: "lower",
    building: "lower",
    castle: "lower",
    fence: "upper",
    roof: "perCell",
    prop: "perCell",
  },
  autotileNeighborhood: 8,
  themeCapabilityRoles: {},
});

// 빈 표 프로파일에서 walkableFloor 를 폴백으로 흘려보낸 뒤 바닥에 찍힌 타일을 돌려준다.
function fallbackFloorTile(roles: readonly TileGroupRole[]): number | undefined {
  return themeMap("interior-house", roles, EMPTY_TABLE_PROFILE_ID).map.lowerTiles[FLOOR];
}

// width 5 / height 5 기준 좌표 → lowerTiles 인덱스.
const BORDER = 0; // (0,0)
const TRIM = 7; // (2,1) — interior-house 의 roomTrim 행
const FLOOR = 12; // (2,2) — 내부 바닥

describe("themeCapabilityRoles (특성화)", () => {
  it("기존 groupsForCapability 매핑을 그대로 재현한다", () => {
    const table = RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles;
    expect(table.walkableFloor).toEqual(["terrain"]);
    expect(table.solidBoundary).toEqual(["wall"]);
    expect(table.wallFace).toEqual(["wall"]);
    expect(table.roomTrim).toEqual(["building", "prop"]);
    expect(table.buildingShell).toEqual(["building", "prop"]);
    expect(table.doorOrEntrance).toEqual(["building", "prop"]);
    expect(table.waterOrHazard).toEqual(["water"]);
  });

  it("decorProp 은 표에 없고 폴백(prop/fence/roof)으로 떨어진다", () => {
    // 원본 groupsForCapability 도 decorProp 을 명시 분기하지 않고 catch-all 로
    // 처리했다. 표에 넣어버리면 폴백 경로가 죽어 동작 변화가 된다.
    expect(RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles.decorProp).toBeUndefined();
  });

  it("두 프로파일이 같은 표를 갖는다 (현행 코드가 프로파일 무관 단일 매핑이므로)", () => {
    expect(MODERN_EXTERIORS_GRAMMAR_PROFILE.themeCapabilityRoles).toEqual(
      RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles
    );
  });
});

describe("groupsForCapability (동작)", () => {
  it("walkableFloor 는 terrain, wallFace 는 wall, roomTrim 은 building 을 고른다", () => {
    const { map } = themeMap("interior-house", ["terrain", "wall", "building", "water"]);
    expect(map.lowerTiles[FLOOR]).toBe(TILE_BY_ROLE.terrain);
    expect(map.lowerTiles[BORDER]).toBe(TILE_BY_ROLE.wall);
    expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.building);
  });

  it("roomTrim 은 building 이 없으면 prop 으로 간다", () => {
    const { map } = themeMap("interior-house", ["terrain", "wall", "prop"]);
    expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.prop);
  });

  it("roomTrim 은 building/prop 이 모두 없으면 없는 것으로 취급한다", () => {
    // trimTile === null → roomTrim 행이 바닥으로 채워진다.
    const { map } = themeMap("interior-house", ["terrain", "wall", "water", "fence", "roof"]);
    expect(map.lowerTiles[TRIM]).toBe(TILE_BY_ROLE.terrain);
  });

  it("dungeon 의 solidBoundary 는 wall 을 고른다", () => {
    const { map } = themeMap("dungeon", ["terrain", "wall", "building"]);
    expect(map.lowerTiles[BORDER]).toBe(TILE_BY_ROLE.wall);
    expect(map.lowerTiles[FLOOR]).toBe(TILE_BY_ROLE.terrain);
  });

  it("역할이 하나도 안 맞으면 타일을 못 고른다", () => {
    // terrain 이 없으니 walkableFloor 는 null → floorTile 이 TILE.EMPTY(-1) 로 떨어지고,
    // wall 도 없으니 wallTile 은 floorTile 을 물려받는다.
    const { map } = themeMap("interior-house", ["water", "fence", "roof", "castle"]);
    expect(map.lowerTiles[FLOOR]).toBe(TILE.EMPTY);
    expect(map.lowerTiles[BORDER]).toBe(TILE.EMPTY);
  });
});

// 이 블록이 지키는 것: 표에 없는 능력의 폴백 목록 내용. decorProp 은 표에 없으므로
// 전적으로 이 폴백에 의존하며, 공개 진입점은 decorProp 을 쓰지 않는다. 따라서 폴백
// 리터럴을 직접 고정하지 않으면 decorProp 보증이 비어 있게 된다.
describe("groupsForCapability 폴백 (표에 없는 능력)", () => {
  it("폴백은 prop 을 포함한다", () => {
    expect(fallbackFloorTile(["terrain", "prop"])).toBe(TILE_BY_ROLE.prop);
  });

  it("폴백은 fence 를 포함한다", () => {
    expect(fallbackFloorTile(["terrain", "fence"])).toBe(TILE_BY_ROLE.fence);
  });

  it("폴백은 roof 를 포함한다", () => {
    expect(fallbackFloorTile(["terrain", "roof"])).toBe(TILE_BY_ROLE.roof);
  });

  it("폴백은 prop/fence/roof 외의 역할은 받지 않는다", () => {
    // terrain·water·wall·building·castle 만 있으면 폴백은 아무것도 못 고른다.
    // 폴백이 "전부 허용"으로 넓어지면 이 단정이 깨진다.
    expect(fallbackFloorTile(["terrain", "water", "wall", "building", "castle"])).toBe(TILE.EMPTY);
  });
});
