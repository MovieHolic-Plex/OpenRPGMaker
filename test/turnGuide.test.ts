// 조수 턴 가이드(src/ai/turnGuide.ts) — 스코프 유/무 두 형태를 고정한다.
//
// 이 모듈이 생긴 이유: 예전에는 같은 규칙이 영역 작업 전용 경로에만 있어서, 선택 없이 조수에게
// 말하면 재료·소품·시공 규칙을 아무것도 못 받았다. 그래서 여기서 검증할 것은 두 가지다.
//   (1) 스코프가 없어도 재료·도구 규칙은 붙는다 (통합의 이득)
//   (2) 스코프 전용 문구(영역 밖 금지·bounds·대상 맵 고정)는 스코프가 있을 때만 붙는다
import { describe, expect, it } from "vitest";
import { buildTurnGuide, formatMaterialLabelHint, PROP_VOCAB } from "@/ai/turnGuide";
import { BUILD_PALETTE_GROUP_IDS, ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { runTool } from "@/editor/tools/toolRunner";
import type { TilesetDef } from "@/project/types";

const MAP_ID = "map_turn_guide";
const REGION = { x: 2, y: 3, width: 12, height: 10 };
const SCOPE = { mapId: MAP_ID, region: REGION };

function makeTileset(): TilesetDef {
  const context = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: MAP_ID, name: "가이드", width: 20, height: 16 }).ok).toBe(true);
  context.project.maps[MAP_ID]!.lowerTiles.fill(TILE.GRASS);
  const tileset = context.project.tilesets[context.project.maps[MAP_ID]!.tilesetId]!;
  ensureBuildPaletteTileGroups(tileset);
  return tileset;
}

describe("buildTurnGuide — 스코프 없음", () => {
  it("공간 요청이면 스코프 없이도 재료·소품 규칙을 붙인다", () => {
    const guide = buildTurnGuide({ instruction: "나무 좀 심어줘" });
    expect(guide).not.toBe("");
    expect(guide).toContain("place_props");
    expect(guide).toContain("보물상자");
    expect(guide).toContain("shape=circle");
  });

  it("스코프 전용 문구는 붙이지 않는다", () => {
    const guide = buildTurnGuide({ instruction: "이 마을 집 3채로 정리해줘" });
    expect(guide).not.toContain("영역 밖");
    expect(guide).not.toContain("선택 영역 안에서만");
    expect(guide).not.toContain("bounds:");
    expect(guide).not.toContain("대상 맵 고정");
    expect(guide).not.toContain("(영역 작업:");
    expect(guide).toContain("도구 규칙:");
  });

  it("공간 카테고리에 걸리지 않는 요청에는 아무것도 붙이지 않는다", () => {
    // 매 턴 2KB 타일 규칙을 무조건 싣지 않는다 — 도구 노출 상한(40)을 헛되게 잠식한다.
    expect(buildTurnGuide({ instruction: "아이템 데이터베이스에 회복약 하나 추가해줘" })).toBe("");
    expect(buildTurnGuide({ instruction: "지금 프로젝트에 맵이 몇 개야?" })).toBe("");
    expect(buildTurnGuide({ instruction: "직업 목록 알려줘" })).toBe("");
    expect(buildTurnGuide({ instruction: "타이틀 화면 문구 알려줘" })).toBe("");
    expect(buildTurnGuide({ instruction: "" })).toBe("");
  });

  it("배치·지형 어휘는 카테고리에 없어도 규칙을 연다", () => {
    // 9카테고리는 전부 주제축이라 가장 흔한 요청이 어디에도 안 걸린다.
    for (const instruction of ["나무 좀 심어줘", "물 채워줘", "길 좀 깔아줘", "박스 2개 놓아줘"]) {
      expect(buildTurnGuide({ instruction }), instruction).toContain("place_props");
    }
  });

  it("의도 가이드는 선택 여부와 무관하게 붙는다", () => {
    const scoped = buildTurnGuide({ instruction: "보물상자를 하나 숨겨줘", scope: SCOPE });
    const unscoped = buildTurnGuide({ instruction: "보물상자를 하나 숨겨줘" });
    expect(scoped).toContain("place_chest");
    expect(unscoped).toContain("place_chest");
  });
});

describe("buildTurnGuide — 스코프 있음", () => {
  it("영역 밖 금지와 선택 영역 한정 문구를 붙인다", () => {
    const guide = buildTurnGuide({ instruction: "여기 채워", scope: SCOPE });
    expect(guide).toContain("이 작업은 아래 선택 영역 안에서만 수행하라.");
    expect(guide).toContain("영역 밖 타일·이벤트는 절대 수정하지 말 것");
    expect(guide).toContain("(영역 작업:");
    expect(guide).toContain(`mapId:"${MAP_ID}"`);
  });

  it("마을 시공에 bounds 시그니처를 못박는다", () => {
    const guide = buildTurnGuide({ instruction: "현재 영역에 집 4채인 마을을 만들어줘", scope: SCOPE });
    expect(guide).toContain("author_village");
    expect(guide).toContain(`bounds:{x:${REGION.x},y:${REGION.y},w:${REGION.width},h:${REGION.height}}`);
    expect(guide).toContain("houseCount:4");
  });

  it("수정 요청이면 대상 맵을 고정하고 시공 시그니처는 붙이지 않는다", () => {
    const guide = buildTurnGuide({ instruction: "이 집 외벽 타일 좀 바꿔줘", scope: SCOPE });
    expect(guide).toContain("대상 맵 고정");
    expect(guide).toContain("create_map·duplicate_map 으로 새 맵을 만들지 말고");
    expect(guide).not.toContain("author_house {");
  });

  it("실내 신규는 새 맵 시공을 허용하고 영역 밖 금지를 풀어준다", () => {
    const guide = buildTurnGuide({ instruction: "연금술사의 실내 방 하나 만들어줘", scope: SCOPE });
    expect(guide).toContain("start_interior_room_session");
    expect(guide).toContain("새 맵 시공은 선택 영역 밖이어도 허용한다");
    expect(guide).not.toContain("영역 밖 타일·이벤트는 절대 수정하지 말 것");
  });

  it("실내 수정은 기존 맵 직접 편집으로 안내한다", () => {
    const guide = buildTurnGuide({ instruction: "이 침실 가구 배치 좀 고쳐줘", scope: SCOPE });
    expect(guide).toContain("실내 수정");
    expect(guide).toContain("furnish_interior_space");
    expect(guide).not.toContain("start_interior_room_session (새 mapId)");
  });

  it("스코프가 있으면 키워드가 안 걸려도 규칙을 붙인다", () => {
    const guide = buildTurnGuide({ instruction: "여기 정리", scope: SCOPE });
    expect(guide).toContain("place_props");
  });
});

describe("formatMaterialLabelHint", () => {
  it("가방 그룹 id 대신 라벨 예시를 준다", () => {
    const hint = formatMaterialLabelHint(makeTileset());
    expect(hint).not.toContain(BUILD_PALETTE_GROUP_IDS.tree);
    expect(hint).not.toContain(PROP_VOCAB.woodBox);
    expect(hint).toContain("material 라벨 예");
  });

  it("타일셋이 없으면 tile_query 안내로 폴백한다", () => {
    expect(formatMaterialLabelHint(undefined)).toContain("tile_query");
  });
});

describe("승인 문구는 사라졌다", () => {
  // approvalPolicy: 승인 게이트 없음. 옛 영역 프롬프트는 "결과는 사용자 승인 후에만 반영된다"를
  // 매 턴 실어 보냈고, 그것은 이제 거짓이다(적용은 즉시, 복구는 되돌리기).
  it("사용자 승인 후에만 반영된다는 거짓 문구를 싣지 않는다", () => {
    const guide = buildTurnGuide({ instruction: "나무 심어줘", scope: SCOPE });
    expect(guide).not.toContain("승인");
    expect(guide).toContain("propose_tile_vocabulary 댄스는 하지 말 것");
  });
});
