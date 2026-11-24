import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMaterialSlotOverride, hasMaterialSlotOverride, setMaterialSlotOverride } from "@/editor/operators/materialSlotEdit";
import { resolveMaterialSlots, MATERIAL_SLOT_IDS, materialSlotCoverage } from "@/editor/operators/materialSlots";
import { renderMaterialSlotBoard } from "@/editor/panels/materialSlotBoard";
import { forestPaletteFromSlots, buildForestWrites, COMBINED_TOWN_FOREST_PALETTE } from "@/editor/regionTask/forestWrites";
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import { RETIRED_COMBINED_TOWN_TILESET_ID, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import type { TilesetDef } from "@/project/types";
import { type FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { buildOperatorIntentPrompt, describeIntent, heuristicOperatorIntent, isOperatorIntentFailure, parseOperatorIntentJson, resolveOperatorIntent } from "@/editor/operators/operatorIntent";
import { getOperator, listOperators } from "@/editor/operators/operatorRegistry";
import { isolateTimers } from "./mergedTeardown";

// 재료 보드 계약 — 사람이 자동 해석을 **보고 고치는** 유일한 창구.
// 핵심: 고친 것만 저장되고("자동" 은 오버라이드 삭제), 고친 값이 곧바로 생성에 반영된다.
describe("materialSlotBoard", () => {
  isolateTimers();
  // The combined-town sheet is no longer the start map's tileset (beodeul_city since the 2026-10-07 copyright purge);
  // build the retired definition explicitly, as an old save carries it.
  function combinedTownTileset(): TilesetDef {
    const tileset = retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID);
    ensureBuildPaletteTileGroups(tileset);
    return tileset;
  }
  describe("슬롯 오버라이드 쓰기", () => {
    it("지정한 값이 자동 해석을 이긴다", () => {
      const tileset = combinedTownTileset();
      const autoGround = resolveMaterialSlots(tileset).ground!.tiles[0];
      expect(setMaterialSlotOverride(tileset, "ground", { tiles: [512] })).toBe(true);
      const slots = resolveMaterialSlots(tileset);
      expect(slots.ground!.tiles).toEqual([512]);
      expect(slots.ground!.source).toBe("user");
      expect(slots.ground!.tiles[0]).not.toBe(autoGround);
    });

    it("「자동」은 값을 다시 넣는 게 아니라 오버라이드를 지운다", () => {
      const tileset = combinedTownTileset();
      const before = resolveMaterialSlots(tileset).ground!.tiles;
      setMaterialSlotOverride(tileset, "ground", { tiles: [512] });
      expect(hasMaterialSlotOverride(tileset, "ground")).toBe(true);
      expect(clearMaterialSlotOverride(tileset, "ground")).toBe(true);
      expect(hasMaterialSlotOverride(tileset, "ground")).toBe(false);
      // 지운 뒤에는 어휘에서 다시 유도된다.
      expect(resolveMaterialSlots(tileset).ground!.tiles).toEqual(before);
    });

    it("마지막 오버라이드를 지우면 빈 객체를 남기지 않는다", () => {
      const tileset = combinedTownTileset();
      setMaterialSlotOverride(tileset, "tree", { tiles: [1] });
      clearMaterialSlotOverride(tileset, "tree");
      expect(tileset.materialSlots).toBeUndefined();
    });

    it("빈 타일 목록·음수는 저장하지 않는다", () => {
      const tileset = combinedTownTileset();
      expect(setMaterialSlotOverride(tileset, "ground", { tiles: [] })).toBe(false);
      expect(setMaterialSlotOverride(tileset, "ground", { tiles: [-1] })).toBe(false);
      expect(tileset.materialSlots).toBeUndefined();
    });

    it("고친 재료가 곧바로 생성 팔레트에 반영된다", () => {
      const tileset = combinedTownTileset();
      setMaterialSlotOverride(tileset, "ground", { tiles: [512] });
      expect(forestPaletteFromSlots(resolveMaterialSlots(tileset)).groundBase).toBe(512);
      clearMaterialSlotOverride(tileset, "ground");
      expect(forestPaletteFromSlots(resolveMaterialSlots(tileset)).groundBase).toBe(240);
    });
  });
  describe("보드 렌더", () => {
    let restoreDom: (() => void) | undefined;
    beforeEach(() => { restoreDom = installFakeDom(); });
    afterEach(() => { restoreDom?.(); });

    const open = (tileset: TilesetDef, currentTile = 512, onChange?: () => void): FakeElement =>
      renderMaterialSlotBoard({
        tileset,
        currentTile: () => currentTile,
        ...(onChange ? { onChange } : {}),
      }) as unknown as FakeElement;

    it("슬롯 12칸과 채움 수를 보여 준다", () => {
      const root = open(combinedTownTileset());
      expect(findByTestId(root, "material-slot-coverage")?.textContent).toContain("/ 12 채움");
      for (const id of ["ground", "path", "tree", "plaza"]) {
        expect(findByTestId(root, `material-slot-${id}`), `${id} 카드 없음`).not.toBeNull();
      }
      // 자동으로 잡힌 슬롯과 비어 있는 슬롯이 구분된다.
      expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("bundled");
      expect(findByTestId(root, "material-slot-plaza")?.dataset.source).toBe("none");
    });

    it("「현재 타일」이 그 슬롯을 사용자 지정으로 바꾸고 다시 그린다", () => {
      const tileset = combinedTownTileset();
      const onChange = vi.fn();
      const root = open(tileset, 512, onChange);
      findByTestId(root, "material-slot-set-ground")?.click();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(tileset.materialSlots?.ground?.tiles).toEqual([512]);
      expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("user");
    });

    it("「자동」은 사용자 지정이 있을 때만 눌린다", () => {
      const tileset = combinedTownTileset();
      const root = open(tileset);
      const reset = findByTestId(root, "material-slot-reset-ground") as unknown as { disabled: boolean };
      expect(reset.disabled).toBe(true);
      findByTestId(root, "material-slot-set-ground")?.click();
      expect((findByTestId(root, "material-slot-reset-ground") as unknown as { disabled: boolean }).disabled).toBe(false);
      findByTestId(root, "material-slot-reset-ground")?.click();
      expect(hasMaterialSlotOverride(tileset, "ground")).toBe(false);
      expect(findByTestId(root, "material-slot-ground")?.dataset.source).toBe("bundled");
    });

    it("붓 타일이 없으면(음수) 아무 것도 바꾸지 않는다", () => {
      const tileset = combinedTownTileset();
      const onChange = vi.fn();
      const root = open(tileset, -1, onChange);
      findByTestId(root, "material-slot-set-ground")?.click();
      expect(onChange).not.toHaveBeenCalled();
      expect(tileset.materialSlots).toBeUndefined();
    });

    it("수종이 여러 개면 종 수를 밝힌다", () => {
      const root = open(combinedTownTileset());
      expect(findByTestId(root, "material-slot-tree")?.textContent).toContain("종");
    });
  });
});

// 재료 슬롯 계약 — 오퍼레이터가 칩셋에 닿는 유일한 통로.
// 핵심 불변식: 슬롯은 저장이 아니라 승인 어휘에서 유도되고, 사용자 오버라이드가 최우선이며,
// combined_town 에서는 기존 하드코딩과 **같은 타일**을 낸다(회귀 0의 근거).
describe("materialSlots", () => {
  isolateTimers();
  const REGION = { x: 1, y: 1, width: 18, height: 14 };
  // The combined-town sheet is no longer the start map's tileset (beodeul_city since the 2026-10-07 copyright purge);
  // build the retired definition explicitly, as an old save carries it.
  function combinedTownTileset(): TilesetDef {
    const tileset = retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID);
    ensureBuildPaletteTileGroups(tileset);
    return tileset;
  }
  function grassMap(width = 24, height = 20) {
    return {
      width,
      height,
      lowerTiles: Array.from({ length: width * height }, () => 240),
      upperTiles: Array.from({ length: width * height }, () => -1),
    };
  }
  describe("슬롯 해석", () => {
    it("번들 칩셋은 설정 없이 채워진다 — 사람이 할 일이 0", () => {
      const slots = resolveMaterialSlots(combinedTownTileset());
      const coverage = materialSlotCoverage(slots);
      expect(coverage.total).toBe(MATERIAL_SLOT_IDS.length);
      expect(coverage.filled).toBeGreaterThanOrEqual(6);
      // forest 가 실제로 쓰는 재료는 반드시 있어야 한다.
      for (const id of ["ground", "path", "tree"] as const) {
        expect(slots[id], `${id} 슬롯이 비었다`).toBeDefined();
        expect(slots[id]!.source).toBe("bundled");
        expect(slots[id]!.tiles.length).toBeGreaterThan(0);
      }
    });

    it("나무 슬롯은 수관·밑동 쌍으로 읽힌다", () => {
      const slots = resolveMaterialSlots(combinedTownTileset());
      const tree = slots.tree!;
      expect(tree.pair).toBeDefined();
      expect(tree.pair!.top).not.toBe(tree.pair!.bottom);
      // combined_town 침엽수 = 260(수관)/290(밑동)
      expect([260, 262]).toContain(tree.pair!.top);
      expect([290, 292]).toContain(tree.pair!.bottom);
    });

    it("사용자 오버라이드가 번들보다 우선한다", () => {
      const tileset = combinedTownTileset();
      tileset.materialSlots = { ground: { tiles: [999, 998] } };
      const slots = resolveMaterialSlots(tileset);
      expect(slots.ground!.tiles).toEqual([999, 998]);
      expect(slots.ground!.source).toBe("user");
      // 오버라이드하지 않은 슬롯은 그대로 번들에서 온다.
      expect(slots.tree!.source).toBe("bundled");
    });

    it("승인되지 않은 그룹은 재료가 되지 않는다 (zero-trust 유지)", () => {
      const tileset = combinedTownTileset();
      for (const group of tileset.tileGroups ?? []) {
        delete (group as { origin?: string }).origin;
        delete (group as { source?: string }).source;
      }
      expect(materialSlotCoverage(resolveMaterialSlots(tileset)).filled).toBe(0);
    });

    it("타일셋이 없으면 빈 슬롯", () => {
      expect(resolveMaterialSlots(undefined)).toEqual({});
    });
  });
  describe("팔레트 유도", () => {
    it("combined_town 유도 팔레트가 하드코딩과 같은 수종·지면·덤불을 낸다", () => {
      const slots = resolveMaterialSlots(combinedTownTileset());
      const derived = forestPaletteFromSlots(slots);
      const base = COMBINED_TOWN_FOREST_PALETTE;
      // 수종 혼합이 핵심이다 — 침엽수 + 활엽수 2종이 그대로 나와야 "뻔한 숲" 으로 돌아가지 않는다.
      // 활엽수는 2×2 source_rect 라 좌측 열(262/292)로 읽혀야 한다(263 이 아래로 가면 나무가 깨진다).
      expect(derived.species).toEqual(base.species);
      expect(derived.dead).toEqual(base.dead);
      expect(derived.groundBase).toBe(base.groundBase);
      expect(derived.groundDark).toBe(base.groundDark);
      expect(derived.bush).toBe(base.bush);
    });

    it("길·꽃은 하네스가 선언한 본체를 따른다 — 그룹 밖 타일이 들어오지 않는다", () => {
      // 하드코딩(391·348)은 내 추측이었고, 그룹의 center 파트/대표 타일이 정본이다.
      // 값이 달라도 되지만 반드시 그 그룹 안에 있어야 한다.
      const slots = resolveMaterialSlots(combinedTownTileset());
      const derived = forestPaletteFromSlots(slots);
      expect(slots.path!.tiles).toContain(derived.path);
      expect(slots.flower!.tiles).toContain(derived.flower);
      // 본체는 오토타일 모서리(tileIds[0])가 아니어야 한다.
      expect(derived.path).toBe(slots.path!.body);
    });

    it("같은 시드는 팔레트가 같으면 같은 숲 — 유도 팔레트도 결정적이다", () => {
      const slots = resolveMaterialSlots(combinedTownTileset());
      const map = grassMap();
      const params = { density: 0.8, deadRatio: 0.15, underbrush: 0.6 };
      const a = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
      const b = buildForestWrites(map, REGION, params, 4242, forestPaletteFromSlots(slots));
      expect(a.writes).toEqual(b.writes);
      expect(a.trees).toBeGreaterThan(0);
    });

    it("슬롯이 비면 기본 팔레트로 떨어진다 — 재료가 없다고 기능이 죽지 않는다", () => {
      const palette = forestPaletteFromSlots({});
      expect(palette.groundBase).toBe(COMBINED_TOWN_FOREST_PALETTE.groundBase);
      expect(palette.species).toEqual(COMBINED_TOWN_FOREST_PALETTE.species);
    });

    it("낯선 칩셋의 타일로도 숲을 심는다 — 하드코딩에 묶이지 않는다", () => {
      const palette = forestPaletteFromSlots({
        ground: { id: "ground", label: "지면", tiles: [700, 701], layer: "lower", source: "user" },
        tree: {
          id: "tree", label: "나무", tiles: [800, 900],
          pair: { top: 800, bottom: 900 }, layer: "upper", source: "user",
        },
        path: { id: "path", label: "길", tiles: [750], layer: "lower", source: "user" },
      });
      expect(palette.groundBase).toBe(700);
      expect(palette.species).toEqual([[800, 900]]);
      expect(palette.path).toBe(750);

      // 그 팔레트로 실제 생성 — 낯선 타일만 쓰이는지 확인.
      const width = 24, height = 20;
      const map = {
        width, height,
        lowerTiles: Array.from({ length: width * height }, () => 700),
        upperTiles: Array.from({ length: width * height }, () => -1),
      };
      const built = buildForestWrites(map, REGION, { density: 0.9, underbrush: 0 }, 9, palette);
      expect(built.trees).toBeGreaterThan(0);
      const canopies = built.writes.filter((w) => w.layer === "upper").map((w) => w.tile);
      const trunks = built.writes.filter((w) => w.layer === "lower" && w.tile === 900);
      expect(new Set(canopies)).toEqual(new Set([800]));
      expect(trunks.length).toBe(built.trees);
      // combined_town 타일이 새어 들어오지 않는다.
      for (const write of built.writes) expect([260, 290, 261, 291, 240]).not.toContain(write.tile);
    });

    it("나무 재료가 없으면 지면만 칠하고 나무는 0", () => {
      const palette = forestPaletteFromSlots({
        ground: { id: "ground", label: "지면", tiles: [700], layer: "lower", source: "user" },
      });
      const noTrees = { ...palette, species: [], dead: null };
      const width = 20, height = 16;
      const map = {
        width, height,
        lowerTiles: Array.from({ length: width * height }, () => 700),
        upperTiles: Array.from({ length: width * height }, () => -1),
      };
      const built = buildForestWrites(map, REGION, { density: 0.9 }, 3, noTrees);
      expect(built.trees).toBe(0);
    });
  });
});

// 의도 파서 계약 — 모델의 출력 표면은 (op + params) JSON 하나뿐이고,
// 그 값조차 레지스트리 스펙으로 검증·클램프된 뒤에야 생성기에 닿는다.
describe("operatorIntent", () => {
  isolateTimers();
  const forest = () => {
    const def = getOperator("forest");
    if (!def) throw new Error("forest 등록 필요");
    return def;
  };
  describe("프롬프트 생성", () => {
    it("레지스트리에서 만들어진다 — 오퍼레이터를 늘려도 프롬프트를 손댈 필요가 없다", () => {
      const prompt = buildOperatorIntentPrompt();
      for (const operator of listOperators()) {
        expect(prompt).toContain(operator.id);
        expect(prompt).toContain(operator.label);
        for (const spec of operator.params) expect(prompt).toContain(spec.id);
      }
    });

    it("타일·좌표를 만들지 말라고 명시한다", () => {
      const prompt = buildOperatorIntentPrompt();
      expect(prompt).toContain("좌표");
      expect(prompt).toMatch(/타일 번호[^\n]*만들지 마라/);
    });
  });
  describe("모델 응답 검증", () => {
    it("정상 JSON 을 의도로 옮긴다", () => {
      const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":0.9,"path":false}}');
      expect(isOperatorIntentFailure(intent)).toBe(false);
      if (isOperatorIntentFailure(intent)) return;
      expect(intent.operatorId).toBe("forest");
      expect(intent.params.density).toBe(0.9);
      expect(intent.params.path).toBe(false);
      expect(intent.source).toBe("llm");
    });

    it("코드펜스·잡담이 섞여 와도 JSON 을 건진다", () => {
      const intent = parseOperatorIntentJson('```json\n{"op":"forest","params":{"density":0.8}}\n```');
      expect(isOperatorIntentFailure(intent)).toBe(false);
      const withChatter = parseOperatorIntentJson('알겠습니다 {"op":"forest","params":{}} 이렇게 하겠습니다');
      expect(isOperatorIntentFailure(withChatter)).toBe(false);
    });

    it("범위 밖·스펙 밖 값은 생성기에 닿기 전에 잘린다", () => {
      const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":99,"clearings":2.6,"tileId":306,"주입":"x"}}');
      expect(isOperatorIntentFailure(intent)).toBe(false);
      if (isOperatorIntentFailure(intent)) return;
      expect(intent.params.density).toBe(1);
      expect(intent.params.clearings).toBe(3);
      expect(intent.params).not.toHaveProperty("tileId");
      expect(intent.params).not.toHaveProperty("주입");
    });

    it("모르는 생성기·깨진 JSON 은 실패로 끝난다", () => {
      expect(isOperatorIntentFailure(parseOperatorIntentJson('{"op":"nuke","params":{}}'))).toBe(true);
      expect(isOperatorIntentFailure(parseOperatorIntentJson("설명만 하고 JSON 이 없음"))).toBe(true);
      expect(isOperatorIntentFailure(parseOperatorIntentJson('{"params":{}}'))).toBe(true);
    });
  });
  describe("키워드 폴백", () => {
    it("정도를 나타내는 말을 수치로 옮긴다", () => {
      const dense = heuristicOperatorIntent("숲을 울창하게 만들어줘");
      const sparse = heuristicOperatorIntent("나무를 듬성듬성 심어줘");
      if (isOperatorIntentFailure(dense) || isOperatorIntentFailure(sparse)) throw new Error("해석 실패");
      expect(dense.params.density).toBeGreaterThan(sparse.params.density as number);
      expect(dense.source).toBe("heuristic");
    });

    it("오솔길 유무를 읽는다", () => {
      const withPath = heuristicOperatorIntent("숲에 오솔길 하나");
      const without = heuristicOperatorIntent("숲인데 길 없이");
      if (isOperatorIntentFailure(withPath) || isOperatorIntentFailure(without)) throw new Error("해석 실패");
      expect(withPath.params.path).toBe(true);
      expect(without.params.path).toBe(false);
    });

    it("생성기를 특정 못 하면 추측하지 않고 실패한다", () => {
      const result = heuristicOperatorIntent("여기 뭔가 멋있게 해줘");
      expect(isOperatorIntentFailure(result)).toBe(true);
      if (!isOperatorIntentFailure(result)) return;
      expect(result.error).toContain("숲");
    });
  });
  describe("resolveOperatorIntent", () => {
    it("LLM 이 있으면 한 번만 부른다", async () => {
      const complete = vi.fn(async () => '{"op":"forest","params":{"density":0.85}}');
      const intent = await resolveOperatorIntent("울창한 숲", { complete });
      expect(complete).toHaveBeenCalledTimes(1);
      if (isOperatorIntentFailure(intent)) throw new Error("해석 실패");
      expect(intent.source).toBe("llm");
      expect(intent.params.density).toBe(0.85);
    });

    it("LLM 이 실패하면 키워드로 떨어지고 그 사실을 밝힌다", async () => {
      const complete = vi.fn(async () => { throw new Error("401"); });
      const intent = await resolveOperatorIntent("울창한 숲", { complete });
      if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
      expect(intent.source).toBe("heuristic");
      expect(intent.params.density).toBe(0.9);
    });

    it("모델이 형식을 어겨도 키워드로 구제한다", async () => {
      const complete = vi.fn(async () => "숲을 만들겠습니다!");
      const intent = await resolveOperatorIntent("울창한 숲", { complete });
      if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
      expect(intent.source).toBe("heuristic");
    });

    it("LLM 도 키워드도 못 읽으면 실패를 그대로 돌려준다", async () => {
      const complete = vi.fn(async () => "{}");
      const intent = await resolveOperatorIntent("아무 말", { complete });
      expect(isOperatorIntentFailure(intent)).toBe(true);
    });

    it("빈 문장은 부르지도 않는다", async () => {
      const complete = vi.fn(async () => "{}");
      const intent = await resolveOperatorIntent("   ", { complete });
      expect(complete).not.toHaveBeenCalled();
      expect(isOperatorIntentFailure(intent)).toBe(true);
    });
  });
  describe("describeIntent", () => {
    it("기본값과 다른 것만 적는다", () => {
      const def = forest();
      const defaults: Record<string, number | boolean> = {};
      for (const spec of def.params) defaults[spec.id] = spec.defaultValue;
      expect(describeIntent(def, defaults)).toContain("기본 설정");
      expect(describeIntent(def, { ...defaults, density: 0.95 })).toContain("밀도 0.95");
    });
  });
});
