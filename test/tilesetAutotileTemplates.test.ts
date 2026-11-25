import { beforeEach, describe, expect, it } from "vitest";
import { buildAnimatedWaterStrip, buildTemplateGroup, previewTemplateTiles } from "@/editor/panels/tilesetAutotileTemplates";
import { addAutotileGroupFromTemplate } from "@/editor/tilesetActions";
import { createBlankProject } from "@/project/defaults";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { DEFAULT_AUTOTILE_GROUPS, DEFAULT_COBBLE_AUTOTILE_GROUP, autotileGroupsForTileset, templateBlockFromAnchor, TERRAIN_TEMPLATE_ANCHORS } from "@/project/defaults/autotileGroups";
import { COBBLE_TILE, CHIPSET_TILE_GROUPS, isSolidChipsetTile, isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_TILESET_ID, DEFAULT_TILE_COUNT, DEFAULT_TILES_PER_ROW, TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { animationFrameForTile, animationStripForTile, CHIPSET_ANIMATION_FRAME_TILES } from "@/project/defaults/chipsetAnimation";
import { filledRoleCount, groupPatchFromRoles, inferAutotileLayoutKind, layoutLabel, rolesFromGroup, tilesInLayoutBlock } from "@/editor/panels/tilesetAutotileLayout";
import { isolateTimers } from "./mergedTeardown";

describe("autotileTemplates", () => {
  isolateTimers();
  // 오토타일 템플릿 위저드 회귀 테스트 — 순수 계산(buildTemplateGroup)과
  // 커밋 액션(addAutotileGroupFromTemplate)의 내장 폴백 승계/애니 스트립 추가를 고정한다.

  const R = DEFAULT_TILES_PER_ROW;   // 30
  const COUNT = DEFAULT_TILE_COUNT;   // 480
  const { N, E, S, W } = AUTOTILE_DIR;
  function mustBuild(kind: "oprn-3x4" | "grid-3x3" | "grid-3x2", anchor: number) {
    const built = buildTemplateGroup(kind, anchor, R, COUNT);
    if ("error" in built) throw new Error(`템플릿 생성 실패: ${built.error}`);
    return built;
  }
  describe("buildTemplateGroup", () => {
    it("(a) oprn-3x4 앵커 129 → 내장 포석(COBBLE_TILE) 정본과 완전 일치", () => {
      const built = mustBuild("oprn-3x4", 129);
      expect(built.neighborhood).toBe(8);
      // 내장 포석 그룹과 memberTileIds·variantMap 완전 일치(순서 포함).
      expect(built.memberTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
      expect(built.connectTileIds).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.connectTileIds);
      expect(built.variantMap).toEqual(DEFAULT_COBBLE_AUTOTILE_GROUP.variantMap);
      // COBBLE_TILE 상수 기준의 역할 배치도 직접 고정한다(내장 그룹 변경에 대한 이중 잠금).
      expect(built.memberTileIds).toEqual([
        COBBLE_TILE.BODY,
        COBBLE_TILE.EDGE_NORTH,
        COBBLE_TILE.EDGE_SOUTH,
        COBBLE_TILE.EDGE_WEST,
        COBBLE_TILE.EDGE_EAST,
        COBBLE_TILE.CORNER_NORTH_WEST,
        COBBLE_TILE.CORNER_NORTH_EAST,
        COBBLE_TILE.CORNER_SOUTH_WEST,
        COBBLE_TILE.CORNER_SOUTH_EAST,
        COBBLE_TILE.ISOLATED,
        COBBLE_TILE.INNER_CORNER,
      ]);
      expect(Object.keys(built.variantMap)).toHaveLength(256);
      expect(built.variantMap[String(0)]).toBe(COBBLE_TILE.ISOLATED);
      expect(built.variantMap[String(255)]).toBe(COBBLE_TILE.BODY);
      expect(built.variantMap[String(N | E | S | W)]).toBe(COBBLE_TILE.INNER_CORNER);
    });

    it("(b) grid-3x3: 앵커부터 row-major 9타일이 모서리/변/몸통으로 매핑된다", () => {
      const T = 33;
      const built = mustBuild("grid-3x3", T);
      expect(built.neighborhood).toBe(4);
      expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2, T + 2 * R, T + 2 * R + 1, T + 2 * R + 2]);
      expect(built.connectTileIds).toEqual(built.memberTileIds);
      expect(Object.keys(built.variantMap)).toHaveLength(16);
      expect(built.variantMap[String(N | E | S | W)]).toBe(T + R + 1); // 몸통
      expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // 북 변
      expect(built.variantMap[String(N | E | W)]).toBe(T + 2 * R + 1); // 남 변
      expect(built.variantMap[String(N | E | S)]).toBe(T + R); // 서 변
      expect(built.variantMap[String(N | S | W)]).toBe(T + R + 2); // 동 변
      expect(built.variantMap[String(E | S)]).toBe(T); // 북서 모서리
      expect(built.variantMap[String(S | W)]).toBe(T + 2); // 북동 모서리
      expect(built.variantMap[String(N | E)]).toBe(T + 2 * R); // 남서 모서리
      expect(built.variantMap[String(N | W)]).toBe(T + 2 * R + 2); // 남동 모서리
      expect(built.variantMap[String(0)]).toBe(T); // 이웃 전무 → 북서 모서리(엔진 판정 순서)
    });

    it("(c) grid-3x2: 없는 역할이 최근접(edgeW←cornerNW, edgeE←cornerNE, body←edgeN)으로 접힌다", () => {
      const T = 40;
      const built = mustBuild("grid-3x2", T);
      expect(built.neighborhood).toBe(4);
      expect(built.memberTileIds).toEqual([T, T + 1, T + 2, T + R, T + R + 1, T + R + 2]);
      expect(Object.keys(built.variantMap)).toHaveLength(16);
      expect(built.variantMap[String(N | E | S | W)]).toBe(T + 1); // body ← edgeN
      expect(built.variantMap[String(N | E | S)]).toBe(T); // edgeW ← cornerNW
      expect(built.variantMap[String(N | S | W)]).toBe(T + 2); // edgeE ← cornerNE
      expect(built.variantMap[String(E | S | W)]).toBe(T + 1); // edgeN (원본)
      expect(built.variantMap[String(N | E | W)]).toBe(T + R + 1); // edgeS (하단 행)
      expect(built.variantMap[String(E | S)]).toBe(T); // cornerNW
      expect(built.variantMap[String(N | W)]).toBe(T + R + 2); // cornerSE
    });

    it("(d) 시트 범위/행 넘침/음수 앵커는 한국어 오류를 반환한다", () => {
      // 마지막 타일(450+3R+2=542)이 count(480)를 초과.
      const overflow = buildTemplateGroup("oprn-3x4", 450, R, COUNT);
      expect("error" in overflow && overflow.error).toMatch(/시트 범위/);
      // 앵커 열 28 → 열+2 가 행(30)을 넘침.
      const rowOverflow = buildTemplateGroup("grid-3x3", 28, R, COUNT);
      expect("error" in rowOverflow && rowOverflow.error).toMatch(/넘칩니다/);
      const negative = buildTemplateGroup("grid-3x2", -1, R, COUNT);
      expect("error" in negative && negative.error).toMatch(/0 이상의 정수/);
      // 미리보기도 같은 검증을 공유한다.
      const preview = previewTemplateTiles("animated-water", 478, R, COUNT);
      expect("error" in preview).toBe(true);
    });
  });
  describe("addAutotileGroupFromTemplate", () => {
    beforeEach(() => {
      // 합본 마을 칩셋은 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다 — 그 칩셋이 남은 옛 저장본을 재현한다.
      store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
    });

    it("(e) 첫 커스텀 그룹 추가 시 내장 그룹(흙길/모래/포석/경작지)이 승계되어 살아남는다", () => {
      const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "grid-3x3", 33);
      expect(outcome.ok).toBe(true);
      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      const ids = (tileset.autotileGroups ?? []).map((group) => group.id);
      expect(ids).toContain("builtin_dirt_road");
      expect(ids).toContain("builtin_sand");
      expect(ids).toContain("builtin_cobble");
      expect(ids).toContain("builtin_farmland");
      expect(outcome.ok && outcome.groupId !== undefined && ids.includes(outcome.groupId)).toBe(true);
      // 유효 그룹 뷰에서도 내장 흙길이 죽지 않는다(폴백 승계 규약 — rmTypeExpander.ts 선례).
      const effective = autotileGroupsForTileset(tileset);
      expect(effective.some((group) => group.id === "builtin_dirt_road")).toBe(true);
      // 커스텀 1개 + 승계된 내장 전체 (내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조).
      expect(effective).toHaveLength(1 + DEFAULT_AUTOTILE_GROUPS.length);
    });

    it("(e-2) 검증 실패 시 프로젝트를 변경하지 않는다", () => {
      const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "oprn-3x4", 450);
      expect(outcome.ok).toBe(false);
      expect(store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID].autotileGroups).toBeUndefined();
    });

    it("(f) animated-water 는 그룹 대신 animationStrips 를 추가하고 직렬화 왕복이 보존된다", () => {
      const outcome = addAutotileGroupFromTemplate(COMBINED_TOWN_TILESET_ID, "animated-water", 120);
      expect(outcome.ok).toBe(true);
      expect(outcome.ok && outcome.groupId).toBeUndefined();
      const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
      expect(tileset.animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);
      expect(tileset.autotileGroups).toBeUndefined();

      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].animationStrips).toEqual([{ baseTile: 120, frames: 3, fps: 3 }]);

      // 순수 함수 계약: 행 넘침 검증 공유.
      const invalid = buildAnimatedWaterStrip(29, R, COUNT);
      expect("error" in invalid).toBe(true);
    });
  });
});

describe("builtinAutotileGroups", () => {
  isolateTimers();
  // 2026-07-17 지형 템플릿 앵커 격자 정본화(4행 밴드 × 열 0/3/6/9) 회귀 테스트.
  // openwiki/autotiles.md 의 앵커 카탈로그 표는 TERRAIN_TEMPLATE_ANCHORS 상수와 이 테스트가 보증한다.

  describe("지형 템플릿 앵커 카탈로그", () => {
    it("kind=group 앵커는 전부 내장 그룹으로 등록되어 있고, variantMap 고립(0) 출력이 앵커와 일치한다", () => {
      for (const entry of TERRAIN_TEMPLATE_ANCHORS) {
        if (entry.kind !== "group") continue;
        const group = DEFAULT_AUTOTILE_GROUPS.find((candidate) => candidate.id === entry.groupId);
        expect(group, `${entry.label}(앵커 ${entry.anchor}) 그룹 미등록`).toBeDefined();
        expect(group?.variantMap["0"], `${entry.label} 고립 출력`).toBe(entry.anchor);
      }
    });

    it("잔디 앵커 240은 기본 바닥(TILE.GRASS)이라 성형 그룹으로 승격하지 않는다", () => {
      expect(TILE.GRASS).toBe(240);
      const grassEntry = TERRAIN_TEMPLATE_ANCHORS.find((entry) => entry.anchor === 240);
      expect(grassEntry?.kind).toBe("base");
      for (const group of DEFAULT_AUTOTILE_GROUPS) {
        expect(group.memberTileIds, `${group.id} 가 기본 잔디 240 을 멤버로 가짐`).not.toContain(240);
      }
    });

    it("내장 그룹들의 memberTileIds 는 서로 겹치지 않는다", () => {
      const seen = new Map<number, string>();
      for (const group of DEFAULT_AUTOTILE_GROUPS) {
        for (const tileId of new Set(group.memberTileIds)) {
          const owner = seen.get(tileId);
          expect(owner, `타일 ${tileId} 이 ${owner} 와 ${group.id} 양쪽 멤버`).toBeUndefined();
          seen.set(tileId, group.id);
        }
      }
    });

    it("신규 7종 블록은 위저드 oprn-3x4 템플릿과 완전히 같은 그룹을 만든다 (공식 상호 대조)", () => {
      const anchors = [6, 9, 243, 246, 249, 366, 369];
      for (const anchor of anchors) {
        const entry = TERRAIN_TEMPLATE_ANCHORS.find((candidate) => candidate.anchor === anchor);
        const builtin = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === entry?.groupId);
        const template = buildTemplateGroup("oprn-3x4", anchor, DEFAULT_TILES_PER_ROW, 480);
        expect(builtin).toBeDefined();
        if (!builtin || "error" in template) throw new Error(`앵커 ${anchor} 템플릿 생성 실패`);
        expect(new Set(builtin.memberTileIds)).toEqual(new Set(template.memberTileIds));
        expect(builtin.variantMap).toEqual(template.variantMap);
      }
    });

    it("templateBlockFromAnchor 공식은 포석 정본(129 블록)과 일치한다", () => {
      const block = templateBlockFromAnchor(129);
      expect(block).toEqual({
        isolated: 129, inner: 131,
        cornerNW: 159, edgeN: 160, cornerNE: 161,
        edgeW: 189, body: 190, edgeE: 191,
        cornerSW: 219, edgeS: 220, cornerSE: 221,
      });
    });

    it("키큰 풀 NW/SW 모서리(273/333)는 잔디가 아니라 키큰 풀 소속이다", () => {
      expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(273);
      expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(333);
      const tallGrassGroup = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === "builtin_tall_grass");
      expect(tallGrassGroup?.memberTileIds).toContain(273);
      expect(tallGrassGroup?.memberTileIds).toContain(333);
    });
  });
  describe("얇은 런(폭/높이 1칸) 쿼터 합성 — 신규 그룹도 절반 합성을 받는다", () => {
    const GRASS = 240;
    const makeMap = (rows: number[][]): { width: number; height: number; lowerTiles: number[] } => ({
      width: rows[0]?.length ?? 0,
      height: rows.length,
      lowerTiles: rows.flat(),
    });
    const quarterMap = (sources: readonly { quarter: string; tile: number }[]): Record<string, number> =>
      Object.fromEntries(sources.map((source) => [source.quarter, source.tile]));

    it("포석 3×1 가로 런: 가운데 = N변 윗절반 + S변 아랫절반", async () => {
      const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
      // 저장 타일: [코너NW 159, 변N 160, 코너NE 161] — variantMap 이 실제로 저장하는 값.
      const map = makeMap([
        [GRASS, GRASS, GRASS, GRASS, GRASS],
        [GRASS, 159, 160, 161, GRASS],
        [GRASS, GRASS, GRASS, GRASS, GRASS],
      ]);
      const middle = terrainQuarterSources(map, 2, 1);
      expect(middle).not.toBeNull();
      expect(quarterMap(middle!)).toEqual({ nw: 160, ne: 160, sw: 220, se: 220 });
    });

    it("포석 3×1 왼쪽 끝 캡: 코너 열 절반(159/219) + 변 열 절반(160/220)", async () => {
      const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
      const map = makeMap([
        [GRASS, GRASS, GRASS, GRASS, GRASS],
        [GRASS, 159, 160, 161, GRASS],
        [GRASS, GRASS, GRASS, GRASS, GRASS],
      ]);
      const leftCap = terrainQuarterSources(map, 1, 1);
      expect(quarterMap(leftCap!)).toEqual({ nw: 159, ne: 160, sw: 219, se: 220 });
      const rightCap = terrainQuarterSources(map, 3, 1);
      expect(quarterMap(rightCap!)).toEqual({ nw: 160, ne: 161, sw: 220, se: 221 });
    });

    it("포석 1×3 세로 런: 가운데 = W변 왼절반 + E변 오른절반", async () => {
      const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
      const map = makeMap([
        [GRASS, 159, GRASS],
        [GRASS, 189, GRASS],
        [GRASS, 219, GRASS],
      ]);
      const middle = terrainQuarterSources(map, 1, 1);
      expect(quarterMap(middle!)).toEqual({ nw: 189, ne: 191, sw: 189, se: 191 });
    });

    it("2칸 폭 이상 몸통은 합성 불필요(null) — 기존 통짜 렌더 유지", async () => {
      const { terrainQuarterSources } = await import("@/project/defaults/terrainQuarterAutotile");
      const body = 190;
      const map = makeMap([
        [body, body, body],
        [body, body, body],
        [body, body, body],
      ]);
      expect(terrainQuarterSources(map, 1, 1)).toBeNull();
    });

    it("눈·어둠 등 신규 그룹 대상 타일도 쿼터 합성 대상으로 등록되어 있다", async () => {
      const { isTerrainQuarterTile } = await import("@/project/defaults/terrainQuarterAutotile");
      // 눈 변N 37, 어둠 변N 397, 키큰 풀 몸통 304, 석축 단 몸통 307/310, 경작지 변S 217.
      for (const tile of [37, 397, 304, 307, 310, 217]) {
        expect(isTerrainQuarterTile(tile), `타일 ${tile}`).toBe(true);
      }
      // 외딴 아트(129·6·243 등)는 통짜 렌더 유지 — target 제외.
      for (const tile of [129, 6, 243]) {
        expect(isTerrainQuarterTile(tile), `외딴 ${tile}`).toBe(false);
      }
    });
  });
  describe("석축 수로(관개수로) 애니메이션 배선", () => {
    it("3·33·63 기준 3프레임 스트립이 등록되어 있다", () => {
      for (const base of [3, 33, 63]) {
        const strip = animationStripForTile(base);
        expect(strip?.frames).toEqual([base, base + 1, base + 2]);
        expect(animationFrameForTile(base, 0)).toBe(base);
        expect(animationFrameForTile(base, 400)).toBe(base + 1);
        expect(animationFrameForTile(base, 700)).toBe(base + 2);
      }
    });

    it("수로 프레임 9칸은 물로 분류되어 통행 불가다", () => {
      for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65]) {
        expect(CHIPSET_ANIMATION_FRAME_TILES, `타일 ${tile} 애니 프레임 누락`).toContain(tile);
        expect(isWaterChipsetTile(tile), `타일 ${tile} 물 분류 누락`).toBe(true);
        expect(isSolidChipsetTile(tile), `타일 ${tile} 통행 차단 누락`).toBe(true);
      }
    });

    it("수로는 호수와 같은 쿼터 물 시스템의 석축 스킨이다 (2026-07-17 정본)", async () => {
      const { isLakeAutotileTile, lakeAutotileQuarterSources, CANAL_AUTOTILE_TILE } = await import("@/project/defaults/lakeAutotile");
      // 수로 프레임 전부(오목 93 포함) 쿼터 렌더 대상.
      for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65, 93, 94, 95]) {
        expect(isLakeAutotileTile(tile), `수로 프레임 ${tile}`).toBe(true);
      }
      // 5×5 수로 풀(전부 마커 3 저장): 중앙=몸통 120, 모서리 셀 nw 쿼터=볼록 3,
      // 상변 중앙 셀의 상단 쿼터=가로 변 63, 좌변 중앙 셀의 좌측 쿼터=세로 변 33.
      const size = 7;
      const lower = new Array<number>(size * size).fill(240);
      for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) lower[y * size + x] = 3;
      const map = { width: size, height: size, lowerTiles: lower };
      const center = lakeAutotileQuarterSources(map, 3, 3);
      expect(center.every((part) => part.tile === CANAL_AUTOTILE_TILE.BODY)).toBe(true);
      const cornerNW = lakeAutotileQuarterSources(map, 1, 1).find((part) => part.quarter === "nw");
      expect(cornerNW?.tile).toBe(CANAL_AUTOTILE_TILE.OUTER_CORNER);
      const topMid = lakeAutotileQuarterSources(map, 3, 1).find((part) => part.quarter === "nw");
      expect(topMid?.tile).toBe(CANAL_AUTOTILE_TILE.EDGE_NORTH);
      const leftMid = lakeAutotileQuarterSources(map, 1, 3).find((part) => part.quarter === "nw");
      expect(leftMid?.tile).toBe(CANAL_AUTOTILE_TILE.EDGE_WEST);
      // L자 오목: (1..5,1..5)에 (6..?, ...) 없음 — 대각만 땅인 지점을 만들기 위해 모서리 셀 검사:
      // 풀 안쪽 셀 (2,2)의 nw 쿼터는 직교 물·대각 물 → 몸통. 오목은 (1,1) 대각 이웃이 땅인 (2,2)가 아니라
      // 프레임 꺾임에서 나온다 — L자: (5,5) 밖 (6,6)이 땅이므로 (5,5) se 쿼터는 볼록이 아닌 코너 검사로 대체.
      const seCorner = lakeAutotileQuarterSources(map, 5, 5).find((part) => part.quarter === "se");
      expect(seCorner?.tile).toBe(CANAL_AUTOTILE_TILE.OUTER_CORNER);
      // 오목(93): 5×5에 (6,3)~(6,5) 확장 → (5,2)의 se 쿼터: 직교 물(동=6..아님)… 간단히 L자 풀로:
      const lower2 = new Array<number>(size * size).fill(240);
      for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 3; x += 1) lower2[y * size + x] = 3;
      for (let y = 3; y <= 5; y += 1) for (let x = 4; x <= 6; x += 1) lower2[y * size + x] = 3;
      const mapL = { width: size, height: size, lowerTiles: lower2 };
      // 오목 지점: (3,2)의 se 쿼터 — 동(4,2)=땅? (4,2)는 풀 밖(y=2,x=4 → lower2[2*7+4]=240) ✓,
      // 남(3,3)=물, 동(4,2)=땅 → se 쿼터는 세로 변. 진짜 오목은 (4,3)의 nw: 북(4,2)=땅? 직교(서(3,3)=물, 북(4,2)=땅)…
      // 오목 = 직교 둘 다 물 + 대각만 땅: (3,3)의 ne 쿼터 — 북(3,2)=물, 동(4,3)=물, 대각(4,2)=땅 → INNER ✓
      const innerNE = lakeAutotileQuarterSources(mapL, 3, 3).find((part) => part.quarter === "ne");
      expect(innerNE?.tile).toBe(CANAL_AUTOTILE_TILE.INNER_CORNER);
    });
  });
});

describe("tilesetAutotileLayout", () => {
  isolateTimers();
  describe("autotile layout helpers", () => {
    it("내장 포석은 11칸으로 읽힌다", () => {
      expect(inferAutotileLayoutKind(DEFAULT_COBBLE_AUTOTILE_GROUP)).toBe("cells-11");
      expect(layoutLabel("cells-11")).toBe("11칸");
      const roles = rolesFromGroup(DEFAULT_COBBLE_AUTOTILE_GROUP);
      expect(roles.body).toBeDefined();
      expect(roles.isolated).toBeDefined();
      expect(filledRoleCount("cells-11", roles).filled).toBe(11);
    });

    it("3×3 템플릿은 9칸 패치로 다시 만들 수 있다", () => {
      const built = buildTemplateGroup("grid-3x3", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT);
      if ("error" in built) throw new Error(built.error);
      const group = { id: "t", ...built };
      expect(inferAutotileLayoutKind(group)).toBe("cells-9");
      const roles = rolesFromGroup(group);
      const patch = groupPatchFromRoles("cells-9", roles);
      expect(patch?.memberTileIds).toEqual(built.memberTileIds);
      expect(Object.keys(patch?.variantMap ?? {})).toHaveLength(16);
    });

    it("9칸 호버 블록은 앵커에서 3×3 인덱스를 만든다", () => {
      expect(tilesInLayoutBlock("cells-9", 33, DEFAULT_TILES_PER_ROW, DEFAULT_TILE_COUNT)).toEqual([
        33, 34, 35,
        33 + DEFAULT_TILES_PER_ROW, 34 + DEFAULT_TILES_PER_ROW, 35 + DEFAULT_TILES_PER_ROW,
        33 + DEFAULT_TILES_PER_ROW * 2, 34 + DEFAULT_TILES_PER_ROW * 2, 35 + DEFAULT_TILES_PER_ROW * 2,
      ]);
    });
  });
});
