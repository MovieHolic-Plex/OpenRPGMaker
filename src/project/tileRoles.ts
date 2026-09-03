// project/tileRoles.ts
// 역할 능력 조회 (A-1). 15개 분기에 흩어진 role 이름 비교를 한 함수로 모은다.
//
// A-1 규약: 이 표의 값은 창작이 아니라 기존 코드에서 베낀 것이다. 각 필드에
// 출처 주석이 붙어 있고, 값을 "더 맞게" 고치는 것은 A-1 범위가 아니다 —
// 동작 변화 0 이 이 단계의 유일한 합격 기준이다.
//
// A-3 에서 이 표는 GrammarProfile.roles 로 이사하고 타일셋 오버라이드가 붙는다.

import type { TilesetDef } from "./types";

export interface RoleCapabilities {
  /** 어휘 홈 — 재료가 어느 레이어에 사는가. 출처: grammarProfiles.layerHomeByRole */
  layerHome: "lower" | "upper" | "perCell";
  /**
   * 그룹 샘플 미리보기를 그릴 레이어. layerHome 과 **다른 질문**이며 prop 에서 답이 갈린다
   * (layerHome=perCell, sampleLayer=upper). 출처: groupSampleBuilder.targetLayer:174
   * undefined = 역할로 결정하지 않고 tileset.priority 를 따른다.
   */
  sampleLayer?: "lower" | "upper";
  /** 문법이 없을 때의 샘플 모양. 출처: groupSampleBuilder.buildBaseGroupSample:54,59,60 */
  sampleAs?: "nineSlice" | "verticalPair" | "roof";
  /** 통행 일관성 린트의 기대값. undefined = 검사하지 않음. 출처: tilesetPaletteLint:104-115 */
  expectedPassage?: "passable" | "solid";
  /** 패턴 문법 필수 여부. 출처: aiPreviewContracts.needsPatternGrammar:431 */
  requiresPatternGrammar: boolean;
  /** 문법 없이도 오토타일로 취급. 출처: tileVocabulary.isAutotileGroup:257 */
  autotile: boolean;
  /** 지형 태그 강제. undefined = 폴백 유지. 출처: combinedTown.terrainTagForGroup:348 */
  terrainTag?: "water";
  /** 샘플 배경에 잔디를 깔아야 하는가. 출처: groupSampleBuilder.backdropTile:199 */
  needsBackdrop: boolean;
  /**
   * 면 채우기(fill_region)가 덮어쓰면 안 되는 저작물인가 — 벽·지붕·건물·성채.
   * 출처: 2026-09-03 적대적 리뷰 07(8×6 모래 채움이 집 한 채를 지움) → constructionTools.splitStructureCells.
   */
  structure: boolean;
  /**
   * place_props 가 소품으로 산포할 수 있는 재료인가. 벽·지붕·건물·수역은 아니다.
   * 출처: 2026-09-03 적대적 리뷰 01(fill 거절 뒤 place_props 로 통행 불가 바닥 타일 산포) → placePropsDomain.
   */
  scatterAsProp: boolean;
}

const BASE: RoleCapabilities = {
  layerHome: "lower",
  requiresPatternGrammar: false,
  autotile: false,
  needsBackdrop: false,
  structure: false,
  scatterAsProp: true,
};

/**
 * 구 어휘 13종의 능력 표. TileGroupRole 8 + PaletteSlotRole 8 − 공유 3.
 * 두 enum 이 한 표에 섞여 있는 것은 의도적이다 — A-3 에서 통합될 예정이고,
 * 그때까지 호출자는 어느 enum 에서 온 값인지 신경 쓰지 않아도 된다.
 */
export const LEGACY_ROLE_CAPABILITIES: Record<string, RoleCapabilities> = {
  // ── TileGroupRole ──────────────────────────────────────────────
  terrain: { ...BASE, layerHome: "lower", requiresPatternGrammar: true },
  water: { ...BASE, layerHome: "lower", requiresPatternGrammar: true, autotile: true, terrainTag: "water", scatterAsProp: false },
  wall: { ...BASE, layerHome: "lower", sampleAs: "nineSlice", expectedPassage: "solid", requiresPatternGrammar: true, structure: true, scatterAsProp: false },
  building: { ...BASE, layerHome: "lower", structure: true, scatterAsProp: false },
  castle: { ...BASE, layerHome: "lower", structure: true, scatterAsProp: false },
  fence: { ...BASE, layerHome: "upper" },
  roof: { ...BASE, layerHome: "perCell", sampleAs: "roof", structure: true, scatterAsProp: false },
  prop: { ...BASE, layerHome: "perCell", sampleLayer: "upper", sampleAs: "verticalPair", needsBackdrop: true },

  // ── PaletteSlotRole 전용 (낱개 타일·팔레트 슬롯) ────────────────
  // 이 5종은 grammarProfiles.layerHomeByRole 에 없다 — **layerHome 만** 가장
  // 가까운 그룹 역할에서 베낀다(ground→terrain, boundary→fence, decor→prop).
  //
  // 그 면책은 layerHome 에만 적용된다. 샘플 관련 능력(sampleLayer·sampleAs·
  // needsBackdrop)은 여기 두지 않는다 — 출처인 groupSampleBuilder 의
  // targetLayer/backdropTile 은 인자 타입이 TileGroupRole 이라 이 5종이
  // 애초에 도달하지 못한다. 즉 현행 동작에서 이들의 답은 "없음"이고,
  // 유추한 값을 적어 두면 A-3 에서 역할이 열리는 순간 없던 잔디 배경이
  // 생긴다(동작 변화 0 위반).
  ground: { ...BASE, layerHome: "lower" },
  path: { ...BASE, layerHome: "lower", expectedPassage: "passable" },
  decor: { ...BASE, layerHome: "perCell" },
  boundary: { ...BASE, layerHome: "upper" },
  furniture: { ...BASE, layerHome: "perCell" },
};

/**
 * 역할의 능력을 돌려준다. 모르는 역할에는 BASE 폴백을 준다 —
 * 조용한 폴백을 택한 이유는 getGrammarProfile(grammarProfiles.ts:82)이 알 수 없는
 * 프로파일 id 에 대해 이미 같은 규약(조용히 기본값)을 쓰기 때문이다.
 *
 * tileset 인자는 A-1 에서 쓰이지 않는다. A-3 에서 tileset.roleOverrides 를
 * 읽으므로 시그니처를 미리 확정해 두어 호출자를 두 번 고치지 않는다.
 *
 * 반환은 Readonly 다 — 표 항목(또는 BASE 싱글턴)의 **참조**를 그대로 넘기므로
 * 호출자가 한 곳에서 필드를 대입하면 프로세스 전역이 오염된다. 15개 호출부가
 * 이 객체를 만질 예정이라 타입으로 막아 둔다.
 */
export function roleCapabilities(_tileset: TilesetDef, roleId: string): Readonly<RoleCapabilities> {
  return LEGACY_ROLE_CAPABILITIES[roleId] ?? BASE;
}
