import { describe, expect, it } from "vitest";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { RM_TYPE_GRAMMAR_PROFILE } from "@/editor/tools/v3/grammarProfiles";
import { LEGACY_ROLE_CAPABILITIES, roleCapabilities } from "@/project/tileRoles";

/** 구 어휘 13종 = TileGroupRole 8 + PaletteSlotRole 8 − 공유 3(wall/water/roof). */
const LEGACY_ROLE_IDS = [
  "building", "castle", "fence", "roof", "terrain", "water", "wall", "prop",
  "ground", "path", "decor", "boundary", "furniture",
] as const;

describe("roleCapabilities — A-1 동등성", () => {
  it("구 어휘 13종 전부에 대해 능력을 돌려준다", () => {
    const tileset = defaultTileset();
    for (const roleId of LEGACY_ROLE_IDS) {
      const caps = roleCapabilities(tileset, roleId);
      expect(caps, `역할 ${roleId}`).toBeDefined();
      expect(caps.layerHome, `역할 ${roleId} 의 layerHome`).toMatch(/^(lower|upper|perCell)$/);
    }
  });

  it("layerHome 은 RM_TYPE 프로파일의 layerHomeByRole 과 일치한다", () => {
    const tileset = defaultTileset();
    for (const [roleId, expected] of Object.entries(RM_TYPE_GRAMMAR_PROFILE.layerHomeByRole)) {
      expect(roleCapabilities(tileset, roleId).layerHome, `역할 ${roleId}`).toBe(expected);
    }
  });

  it("sampleLayer 는 layerHome 과 별개이며 prop 에서 갈린다", () => {
    // groupSampleBuilder.targetLayer 는 prop 을 upper 로 강제하지만
    // 어휘 홈(layerHomeByRole)은 perCell 이다. 둘을 합치면 동작이 바뀐다.
    const tileset = defaultTileset();
    expect(roleCapabilities(tileset, "prop").layerHome).toBe("perCell");
    expect(roleCapabilities(tileset, "prop").sampleLayer).toBe("upper");
  });

  it("모르는 역할에는 결정론적 폴백을 준다", () => {
    const tileset = defaultTileset();
    const caps = roleCapabilities(tileset, "존재하지-않는-역할");
    expect(caps.layerHome).toBe("lower");
    expect(caps.sampleAs).toBeUndefined();
    expect(caps.autotile).toBe(false);
  });

  it("구 어휘 13종이 모두 표에 있다", () => {
    for (const roleId of LEGACY_ROLE_IDS) {
      expect(LEGACY_ROLE_CAPABILITIES[roleId], `역할 ${roleId} 가 표에 없다`).toBeDefined();
    }
  });

  it("필수 4필드는 모든 역할에 있다", () => {
    // 선택 필드(sampleLayer·sampleAs·expectedPassage·terrainTag)의 부재는 결함이 아니라
    // 설계다 — undefined = "이 역할은 이 질문에 답하지 않는다".
    const required = ["layerHome", "requiresPatternGrammar", "autotile", "needsBackdrop"] as const;
    for (const roleId of LEGACY_ROLE_IDS) {
      const caps = LEGACY_ROLE_CAPABILITIES[roleId]!;
      for (const key of required) {
        expect(key in caps, `역할 ${roleId} 의 ${key} 칸이 비었다`).toBe(true);
      }
    }
  });
});
