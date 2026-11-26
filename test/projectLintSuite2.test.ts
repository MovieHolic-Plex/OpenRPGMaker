import { describe, expect, it, beforeEach } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { lintBattleStateReach } from "@/project/lint/battleStateReachLint";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import type { EnemyRecord, Project, StateRecord, GameMap, MapId, ClusterRule, TileGroupMetadata } from "@/project/types";
import { applyExactPlacement, clusterRecoveryOffer, freehandPaintOptions } from "@/editor/clusterAssistRecovery";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, recordMapEditIfChanged, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { store } from "@/project/store";
import { startOnRetiredCombinedTown, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { runTool } from "@/editor/tools/toolRunner";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";

describe("battleStateReachLint", () => {
  isolateTimers();
  function withState(project: Project, state: Partial<StateRecord> & Pick<StateRecord, "id" | "name">): void {
    project.database.states.push(normalizeStateRecord(state));
  }
  describe("battle state reach lint", () => {
    it("is silent on a blank project", () => {
      expect(lintBattleStateReach(createBlankProject())).toEqual([]);
    });

    it("warns when a hero-identity (emotion) state rides a skill enemies also use", () => {
      const project = createBlankProject();
      withState(project, { id: "state_mark", name: "표식", emotion: { family: "mark", tier: 1 } } as never);
      const base = project.database.skills.find((row) => row.scope === "enemy")!;
      const skill = { ...structuredClone(base), id: "skill_test_mark_slash", stateEffects: [{ stateId: "state_mark", chance: 100, operation: "add" as const }] };
      project.database.skills.push(skill);
      const enemy = project.database.enemies[0]!;
      enemy.actions = [{ skillId: skill.id, priority: 5, condition: { kind: "always" } } as EnemyRecord["actions"][number]];
      const issues = lintBattleStateReach(project);
      expect(issues.map((issue) => issue.code)).toContain("skill-identity-state-shared-with-enemies");
      expect(issues.find((issue) => issue.code === "skill-identity-state-shared-with-enemies")!.message).toContain(`skill:${skill.id}`);
      enemy.actions = [];
      expect(lintBattleStateReach(project).map((issue) => issue.code)).not.toContain("skill-identity-state-shared-with-enemies");
    });

    it("counts enemies a weapon's on-hit state can land on, not only all-immune", () => {
      const project = createBlankProject();
      withState(project, { id: "state_wound", name: "상처" });
      const weapon = project.database.equipment.find((row) => row.slot === "weapon")!;
      weapon.stateInflictIds = ["state_wound"];
      weapon.stateInflictionChance = 20;
      const enemies = project.database.enemies;
      expect(enemies.length).toBeGreaterThan(4);
      for (const enemy of enemies) enemy.stateRates = { ...(enemy.stateRates ?? {}), state_wound: "E" };
      expect(lintBattleStateReach(project).find((issue) => issue.message.includes(`equipment:${weapon.id}`))?.code).toBe("state-reaches-no-enemy");
      enemies[0]!.stateRates = { ...enemies[0]!.stateRates, state_wound: "A" };
      const one = lintBattleStateReach(project).find((issue) => issue.message.includes(`equipment:${weapon.id}`))!;
      expect(one.code).toBe("state-reaches-few-enemies");
      expect(one.message).toContain(`1/${enemies.length}`);
      for (const enemy of enemies) enemy.stateRates = { ...enemy.stateRates, state_wound: "C" };
      expect(lintBattleStateReach(project).some((issue) => issue.message.includes(`equipment:${weapon.id}`))).toBe(false);
    });
  });
});

describe("clusterRuleValidators", () => {
  isolateTimers();
  // OPRN-OUT-017 — 손붓이 hard 클러스터 규칙에 막혔을 때 되살아날 길이 있는가.
  //
  // 원 보고: 합본마을 나무밑동 290~292 를 「이웃 연결: 수동」 에서도 아예 손댈 수 없었다.
  // 여기서 재는 것은 네 자리(맵 경계 / 위 칸 점유 / 보호셀 옆 / 정상 공터)와 되돌리기 단위,
  // 그리고 정확 배치가 남긴 위반이 lint 에 규칙·좌표와 함께 보이는가다.
  describe("clusterAssistRecovery", () => {
    isolateTimers();
    const TRUNKS = [290, 291, 292] as const;
    const TRUNK_CANOPY: Readonly<Record<number, number>> = { 290: 260, 291: 261, 292: 262 };
    function fixture(): { readonly mapId: MapId } {
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.width = 8;
      map.height = 8;
      map.lowerTiles = Array(64).fill(TILE.GRASS);
      map.upperTiles = Array(64).fill(TILE.EMPTY);
      map.events = [];
      // 시작 지점은 보호셀이다. 실험 자리와 멀리 떼어 놓고, 필요할 때만 옆으로 옮긴다.
      project.startPos = { x: 0, y: 7 };
      store.replace(project);
      resetMapEditHistory();
      return { mapId: project.startMapId };
    }
    function currentMap(mapId: MapId): GameMap {
      const map = store.getCurrent().maps[mapId];
      if (!map) throw new Error(`missing map ${mapId}`);
      return map;
    }
    function lowerAt(mapId: MapId, x: number, y: number): number {
      const map = currentMap(mapId);
      return map.lowerTiles[y * map.width + x];
    }
    function upperAt(mapId: MapId, x: number, y: number): number {
      const map = currentMap(mapId);
      return map.upperTiles[y * map.width + x];
    }
    /** 손붓 한 칸. clusterAssist 는 UI 토글과 같은 뜻이며 거부는 호출부로 돌아온다. */
    function freehandPaint(
      mapId: MapId,
      input: { readonly clusterAssist: boolean; readonly tile: number; readonly x: number; readonly y: number },
    ): TilePaintRejection | null {
      const rejections: TilePaintRejection[] = [];
      paintTilesBulk(
        mapId,
        [{ layer: "lower", tile: input.tile, x: input.x, y: input.y }],
        freehandPaintOptions({
          autoConnect: false,
          clusterAssist: input.clusterAssist,
          onRejected: (rejection) => rejections.push(rejection),
        }),
      );
      return rejections[0] ?? null;
    }
    beforeEach(() => {
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    });
    describe("보조 배치는 기본이고 원자적이다", () => {
      it.each(TRUNKS)("정상 공터에서 보조 배치가 밑동 %i 과 수관을 함께 놓는다", (trunk) => {
        const { mapId } = fixture();

        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: trunk, x: 3, y: 4 });

        expect(rejection).toBeNull();
        expect(lowerAt(mapId, 3, 4)).toBe(trunk);
        expect(upperAt(mapId, 3, 3)).toBe(TRUNK_CANOPY[trunk]);
        // 활엽수 292 는 2x2 원자 — 오른쪽 열까지 완성돼야 한다.
        if (trunk === 292) {
          expect(lowerAt(mapId, 4, 4)).toBe(293);
          expect(upperAt(mapId, 4, 3)).toBe(263);
        }
        expect(validateClusterRules(store.getCurrent(), mapId)).toEqual([]);
      });

      it("보조 배치는 기본 켜짐이고 이웃 연결과 별개 상태다", () => {
        expect(editorState.get().clusterAssistMode).toBe(true);
        editorState.set({ autoConnectMode: true });
        expect(editorState.get().clusterAssistMode).toBe(true);
        editorState.set({ clusterAssistMode: false });
        expect(editorState.get().autoConnectMode).toBe(true);
        editorState.set({ autoConnectMode: false, clusterAssistMode: true });
      });
    });
    describe("보조 배치가 불가능한 세 자리 — 거부는 보이고 복구는 실행 가능하다", () => {
      it.each(TRUNKS)("맵 위쪽 경계에서 밑동 %i 은 보조 배치가 거부되지만 정확 배치로 놓을 수 있다", (trunk) => {
        const { mapId } = fixture();

        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: trunk, x: 3, y: 0 });

        expect(rejection).not.toBeNull();
        expect(lowerAt(mapId, 3, 0)).toBe(TILE.GRASS);
        const offer = clusterRecoveryOffer(mapId, rejection!);
        // 규칙·동반 타일·좌표가 문장에 남는다.
        expect(offer.message).toContain(String(TRUNK_CANOPY[trunk]));
        expect(offer.message).toContain("(3,-1)");
        expect(rejection!.cluster?.kind).toBe("out-of-bounds");
        expect(rejection!.cluster?.ruleId).toBeTruthy();
        expect(offer.action).not.toBeNull();

        expect(applyExactPlacement(offer.action!)).toBe(true);
        expect(lowerAt(mapId, 3, 0)).toBe(trunk);
      });

      it.each(TRUNKS)("위 칸이 다른 덧그림 오브젝트일 때 밑동 %i 은 그 오브젝트를 보존하고 자기 칸만 받는다", (trunk) => {
        const { mapId } = fixture();
        store.updateMap(mapId, (m) => {
          m.upperTiles[3 * m.width + 3] = 237; // 나무 상자 — 수관이 아닌 남의 오브젝트
        });

        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: trunk, x: 3, y: 4 });

        expect(rejection).not.toBeNull();
        expect(rejection!.cluster?.kind).toBe("occupied-upper");
        expect(lowerAt(mapId, 3, 4)).toBe(TILE.GRASS);
        // 막힌 칸은 밑동 **바로 위**다. 사람에게 보여 줄 규칙도 그 세로 관계를 말해야 한다 —
        // 활엽수처럼 한 칸이 여러 규칙에 걸릴 때 옆 칸 규칙이 대신 나오면 안내가 어긋난다.
        expect(rejection!.cluster?.companionTile).toBe(TRUNK_CANOPY[trunk]);
        expect(rejection!.cluster?.companionY).toBe(3);
        expect(String(rejection!.cluster?.ruleMessage)).toContain(String(TRUNK_CANOPY[trunk]));
        expect(String(rejection!.cluster?.ruleMessage)).toContain(String(trunk));

        const offer = clusterRecoveryOffer(mapId, rejection!);
        expect(offer.action).not.toBeNull();
        expect(applyExactPlacement(offer.action!)).toBe(true);

        expect(lowerAt(mapId, 3, 4)).toBe(trunk);
        // 남의 오브젝트는 그대로. 수관이 강제로 심기지도 않는다.
        expect(upperAt(mapId, 3, 3)).toBe(237);
        expect(upperAt(mapId, 3, 4)).toBe(TILE.EMPTY);
      });

      it.each(TRUNKS)("보호셀이 동반 타일 자리인 밑동 %i 은 보호셀을 건드리지 않고 자기 칸만 받는다", (trunk) => {
        const { mapId } = fixture();
        // 수관이 갈 (3,3) 을 시작 지점으로 만든다 — 보호셀.
        store.update((project) => {
          project.startMapId = mapId;
          project.startPos = { x: 3, y: 3 };
        });

        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: trunk, x: 3, y: 4 });

        expect(rejection).not.toBeNull();
        expect(rejection!.cluster?.kind).toBe("protected");
        expect(rejection!.reason).toContain("(3,3)");
        expect(lowerAt(mapId, 3, 4)).toBe(TILE.GRASS);

        const offer = clusterRecoveryOffer(mapId, rejection!);
        expect(offer.action).not.toBeNull();
        expect(applyExactPlacement(offer.action!)).toBe(true);

        expect(lowerAt(mapId, 3, 4)).toBe(trunk);
        expect(upperAt(mapId, 3, 3)).toBe(TILE.EMPTY); // 보호셀은 비어 있는 그대로
      });

      it("복구 가능 여부를 미리 계산해도 보호셀 판정이 낡지 않는다", () => {
        // 실측 함정: 복구 미리보기가 보호셀 캐시를 채우면, 그 뒤에 생긴 이벤트가 보호셀로
        // 보이지 않아 두 번째 배치가 남의 이벤트 칸 위에 나무를 세운다.
        const { mapId } = fixture();

        // 첫 거부(경계) — 여기서 복구 가능 여부를 계산한다.
        expect(freehandPaint(mapId, { clusterAssist: true, tile: 290, x: 1, y: 0 })).not.toBeNull();

        // 그 다음에 이벤트가 생긴다. 수관 자리 (5,3). store 통지 없이 제자리에서 바꿔야
        // 캐시 무효화에 기대지 않고 **미리보기가 캐시를 태웠는지**만 재게 된다.
        currentMap(mapId).events.push({ id: "ev_under_tree", x: 5, y: 3, trigger: { kind: "action" }, commands: [] });

        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: 290, x: 5, y: 4 });

        expect(rejection?.cluster?.kind).toBe("protected");
        expect(lowerAt(mapId, 5, 4)).toBe(TILE.GRASS);
        expect(upperAt(mapId, 5, 3)).toBe(TILE.EMPTY);
      });

      it("정확 배치도 보호셀 자체는 덮지 않고, 그 사실을 복구 불가로 말한다", () => {
        const { mapId } = fixture();
        store.update((project) => {
          project.startMapId = mapId;
          project.startPos = { x: 3, y: 4 };
        });

        const rejections: TilePaintRejection[] = [];
        paintTilesBulk(mapId, [{ layer: "lower", tile: 290, x: 3, y: 4 }], {
          autoConnect: false,
          exactPlacement: true,
          onRejected: (rejection) => rejections.push(rejection),
        });

        expect(rejections).toHaveLength(1);
        expect(rejections[0]!.recoverable).toBe(false);
        expect(lowerAt(mapId, 3, 4)).toBe(TILE.GRASS);
        const offer = clusterRecoveryOffer(mapId, rejections[0]!);
        expect(offer.action).toBeNull();
        expect(offer.hint).toBeTruthy();
      });
    });
    describe("정확 배치는 고른 칸·레이어만 바꾸고 위반은 검사에 남는다", () => {
      it.each(TRUNKS)("보조를 끈 손붓은 밑동 %i 을 경계에서 그대로 놓고 hard 위반을 lint 로 드러낸다", (trunk) => {
        const { mapId } = fixture();

        const rejection = freehandPaint(mapId, { clusterAssist: false, tile: trunk, x: 3, y: 0 });

        expect(rejection).toBeNull();
        expect(lowerAt(mapId, 3, 0)).toBe(trunk);
        // 오직 그 칸. 위/옆 칸은 어떤 레이어도 바뀌지 않는다.
        expect(upperAt(mapId, 3, 0)).toBe(TILE.EMPTY);
        expect(lowerAt(mapId, 4, 0)).toBe(TILE.GRASS);

        const violations = validateClusterRules(store.getCurrent(), mapId);
        const hard = violations.filter((violation) => violation.severity === "error");
        expect(hard.length).toBeGreaterThan(0);
        // 규칙 + 요구되는 동반 타일 + 좌표가 모두 보인다.
        const mine = hard.find((violation) => violation.coords.some((coord) => coord.x === 3 && coord.y === 0));
        expect(mine).toBeTruthy();
        expect(String(mine!.rule.message)).toContain(String(TRUNK_CANOPY[trunk]));
        expect(mine!.code).toContain("cluster-rule:adjacency:");
      });

      it("정확 배치는 이웃의 완성된 나무를 조각내지 않는다", () => {
        const { mapId } = fixture();
        // 정상 침엽수 하나를 먼저 세운다.
        expect(freehandPaint(mapId, { clusterAssist: true, tile: 290, x: 5, y: 4 })).toBeNull();

        // 그 수관 칸(5,3)에 정확 배치로 다른 밑동을 시도 — 남의 덧그림이라 거부된다.
        const rejections: TilePaintRejection[] = [];
        paintTilesBulk(mapId, [{ layer: "upper", tile: 237, x: 5, y: 3 }], {
          autoConnect: false,
          exactPlacement: true,
          onRejected: (rejection) => rejections.push(rejection),
        });

        expect(rejections).toHaveLength(1);
        expect(upperAt(mapId, 5, 3)).toBe(260);
        expect(lowerAt(mapId, 5, 4)).toBe(290);
      });
    });
    describe("되돌리기/다시 실행은 보조·정확 배치를 각각 한 저작 행동으로 본다", () => {
      it("보조 배치 한 번은 되돌리기 한 번으로 동반 타일까지 사라지고 다시 실행으로 되돌아온다", () => {
        const { mapId } = fixture();
        const before = JSON.stringify(currentMap(mapId));

        // 손붓 한 스트로크 = 한 스냅샷 (엔진의 applyStrokeEdit 와 같은 경계).
        const rejections: TilePaintRejection[] = [];
        // 엔진의 스트로크 경계(applyStrokeEdit)와 같은 단위로 한 번 기록한다.
        const recorded = recordMapEditIfChanged(mapId, () => {
          paintTilesBulk(mapId, [{ layer: "lower", tile: 292, x: 3, y: 4 }], freehandPaintOptions({
            autoConnect: false,
            clusterAssist: true,
            onRejected: (rejection) => rejections.push(rejection),
          }));
        });

        expect(recorded).toBe(true);
        expect(rejections).toEqual([]);
        expect(getMapEditHistoryState().canUndo).toBe(true);
        expect(lowerAt(mapId, 3, 4)).toBe(292);
        expect(lowerAt(mapId, 4, 4)).toBe(293);

        expect(undoMapEdit()).toBe(true);
        expect(JSON.stringify(currentMap(mapId))).toBe(before);
        expect(getMapEditHistoryState().canUndo).toBe(false);

        expect(redoMapEdit()).toBe(true);
        expect(lowerAt(mapId, 3, 4)).toBe(292);
        expect(upperAt(mapId, 3, 3)).toBe(262);
      });

      it.each(TRUNKS)("복구 정확 배치(밑동 %i)도 되돌리기 한 번짜리 행동이다", (trunk) => {
        const { mapId } = fixture();
        const rejection = freehandPaint(mapId, { clusterAssist: true, tile: trunk, x: 3, y: 0 });
        expect(rejection).not.toBeNull();
        // 거부는 히스토리를 남기지 않는다 — 아무것도 바뀌지 않았다.
        expect(getMapEditHistoryState().canUndo).toBe(false);

        const offer = clusterRecoveryOffer(mapId, rejection!);
        expect(applyExactPlacement(offer.action!)).toBe(true);
        const state = getMapEditHistoryState();
        expect(state.canUndo).toBe(true);
        expect(lowerAt(mapId, 3, 0)).toBe(trunk);

        expect(undoMapEdit()).toBe(true);
        expect(lowerAt(mapId, 3, 0)).toBe(TILE.GRASS);
        expect(getMapEditHistoryState().canUndo).toBe(false);

        expect(redoMapEdit()).toBe(true);
        expect(lowerAt(mapId, 3, 0)).toBe(trunk);
      });
    });
    describe("스탬프·AI 경로의 기존 계약은 그대로다", () => {
      it("여러 칸 스탬프는 여전히 동반 확장 없이 고른 그대로 찍고 보호셀 검사를 새로 받지 않는다", () => {
        const { mapId } = fixture();

        paintTilesBulk(
          mapId,
          [
            { layer: "lower", tile: 290, x: 2, y: 5 },
            { layer: "lower", tile: 291, x: 3, y: 5 },
          ],
          { autoConnect: false, clusterExpand: false, preservePattern: true },
        );

        expect(lowerAt(mapId, 2, 5)).toBe(290);
        expect(lowerAt(mapId, 3, 5)).toBe(291);
        // preservePattern 은 나무 짝 보정을 건너뛴다 — 스탬프의 기존 계약.
        expect(upperAt(mapId, 2, 4)).toBe(TILE.EMPTY);
        expect(upperAt(mapId, 3, 4)).toBe(TILE.EMPTY);
      });
    });
  });
  describe("clusterRuleValidators", () => {
    isolateTimers();
    const MAP_ID = "map_cluster_rules";
    type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
    function blankMap(): GameMap {
      const width = 5;
      const height = 5;
      return {
        events: [],
        height,
        id: MAP_ID,
        lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
        name: "클러스터 규칙 테스트",
        tileSize: 16,
        tilesetId: COMBINED_TOWN_TILESET_ID,
        upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
        width,
      };
    }
    function at(map: GameMap, x: number, y: number): number {
      return y * map.width + x;
    }
    function groupWithRules(rules: readonly ClusterRule[], patternGrammar?: PatternGrammar): TileGroupMetadata {
      return {
        defaultLayer: "lower",
        description: "검증 대상 클러스터",
        id: "cluster-main",
        name: "검증 클러스터",
        placementRules: "테스트 규칙",
        role: "building",
        rules: [...rules],
        tileIds: [10, 11, 260, 290],
        ...(patternGrammar ? { patternGrammar } : {}),
      };
    }
    function projectWithRules(rules: readonly ClusterRule[], patternGrammar?: PatternGrammar): { readonly map: GameMap; readonly project: Project } {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const map = blankMap();
      project.maps = { [MAP_ID]: map };
      project.mapTree = { mapId: MAP_ID, children: [] };
      project.startMapId = MAP_ID;
      project.startPos = { x: 0, y: 0 };
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [groupWithRules(rules, patternGrammar)];
      return { map, project };
    }
    function verticalTreeGrammar(): PatternGrammar {
      return {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        minWidth: 1,
        parts: [
          { role: "top", tileIds: [260] },
          { role: "bottom", tileIds: [290] },
        ],
        preserveCaps: true,
        repeat: "body",
      };
    }
    describe("validateClusterRules", () => {
      it("adjacency 규칙은 모든 a 타일 좌표에서 지정 방향의 b 타일을 요구한다", () => {
        // Given: hard adjacency says 260 must be directly above 290.
        const { map, project } = projectWithRules([
          { id: "roof-on-wall", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
        ]);
        map.lowerTiles[at(map, 1, 1)] = 260;
        map.lowerTiles[at(map, 3, 1)] = 260;
        map.lowerTiles[at(map, 3, 2)] = 290;

        // When: cluster rules are validated.
        const violations = validateClusterRules(project);

        // Then: only the unsupported 260 coordinate is reported as a hard error.
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
          code: "cluster-rule:adjacency:cluster-main",
          groupId: "cluster-main",
          severity: "error",
        });
        expect(violations[0]?.coords).toEqual([{ mapId: MAP_ID, x: 1, y: 1 }]);
      });

      it("adjacency 규칙은 b 타일만 남은 반쪽 페어도 같은 hard 위반으로 보고한다", () => {
        // Given: hard adjacency says 260 must be directly above 290, but only the lower half exists.
        const { map, project } = projectWithRules([
          { id: "conifer-hard", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
        ]);
        map.upperTiles[at(map, 2, 3)] = 290;

        // When: cluster rules are validated.
        const violations = validateClusterRules(project);

        // Then: the orphan lower half is reported at its own coordinate.
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
          code: "cluster-rule:adjacency:cluster-main",
          severity: "error",
        });
        expect(violations[0]?.coords).toEqual([{ mapId: MAP_ID, x: 2, y: 3 }]);
      });

      it("spacing 규칙은 같은 그룹 인스턴스가 minGap 미만이면 두 좌표를 warning으로 모은다", () => {
        // Given: medium spacing requires a gap of at least 3 grid steps between group tiles.
        const { map, project } = projectWithRules([
          { id: "space-out", kind: "spacing", params: { minGap: 3 }, strength: "medium" },
        ]);
        map.lowerTiles[at(map, 0, 0)] = 10;
        map.upperTiles[at(map, 2, 0)] = 11;

        // When: cluster rules are validated.
        const violations = validateClusterRules(project);

        // Then: both close group instances are returned as a non-blocking warning.
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
          code: "cluster-rule:spacing:cluster-main",
          groupId: "cluster-main",
          severity: "warning",
        });
        expect(violations[0]?.coords).toEqual([
          { mapId: MAP_ID, x: 0, y: 0 },
          { mapId: MAP_ID, x: 2, y: 0 },
        ]);
      });

      it("count 규칙은 인스턴스 수 범위를 검사하고 soft 위반을 info로 반환한다", () => {
        // Given: soft count caps the group at 2 instances on each map.
        const { map, project } = projectWithRules([
          { id: "cap", kind: "count", params: { max: 2, perMap: true }, strength: "soft" },
        ]);
        map.lowerTiles[at(map, 1, 0)] = 10;
        map.lowerTiles[at(map, 1, 1)] = 11;
        map.lowerTiles[at(map, 1, 2)] = 260;

        // When: cluster rules are validated for the map.
        const violations = validateClusterRules(project, MAP_ID);

        // Then: the issue is informational and carries every over-limit group coordinate.
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({
          code: "cluster-rule:count:cluster-main",
          groupId: "cluster-main",
          severity: "info",
        });
        expect(violations[0]?.coords).toEqual([
          { mapId: MAP_ID, x: 1, y: 0 },
          { mapId: MAP_ID, x: 1, y: 1 },
          { mapId: MAP_ID, x: 1, y: 2 },
        ]);
      });

      it("spacing 규칙은 1x2 풋프린트의 자기 인접 셀을 위반으로 세지 않는다", () => {
        // Given: a vertical tree footprint occupies two adjacent cells as one instance.
        const { map, project } = projectWithRules([
          { id: "space-tree", kind: "spacing", params: { minGap: 2 }, strength: "hard" },
        ], verticalTreeGrammar());
        map.upperTiles[at(map, 1, 1)] = 260;
        map.upperTiles[at(map, 1, 2)] = 290;

        // When: cluster rules are validated.
        const violations = validateClusterRules(project);

        // Then: the top and bottom of the same tree do not violate their own minGap.
        expect(violations).toHaveLength(0);
      });

      it("spacing 규칙은 별도 풋프린트 인스턴스 사이 간격을 검사한다", () => {
        // Given: two complete 1x2 trees are touching horizontally.
        const { map, project } = projectWithRules([
          { id: "space-tree", kind: "spacing", params: { minGap: 1 }, strength: "hard" },
        ], verticalTreeGrammar());
        map.upperTiles[at(map, 1, 1)] = 260;
        map.upperTiles[at(map, 1, 2)] = 290;
        map.upperTiles[at(map, 2, 1)] = 260;
        map.upperTiles[at(map, 2, 2)] = 290;

        // When: cluster rules are validated.
        const violations = validateClusterRules(project);

        // Then: the two tree instances violate spacing, and all footprint cells are reported.
        expect(violations).toHaveLength(1);
        expect(violations[0]?.coords).toEqual([
          { mapId: MAP_ID, x: 1, y: 1 },
          { mapId: MAP_ID, x: 1, y: 2 },
          { mapId: MAP_ID, x: 2, y: 1 },
          { mapId: MAP_ID, x: 2, y: 2 },
        ]);
      });

      it("count 규칙은 다중 타일 풋프린트를 셀이 아니라 한 인스턴스로 센다", () => {
        // Given: one complete 1x2 tree and a max count of one.
        const { map, project } = projectWithRules([
          { id: "cap-tree", kind: "count", params: { max: 1, perMap: true }, strength: "hard" },
        ], verticalTreeGrammar());
        map.upperTiles[at(map, 1, 1)] = 260;
        map.upperTiles[at(map, 1, 2)] = 290;

        // When/Then: the two occupied cells count as one instance.
        expect(validateClusterRules(project)).toHaveLength(0);

        // When: a second complete tree is added.
        map.upperTiles[at(map, 3, 1)] = 260;
        map.upperTiles[at(map, 3, 2)] = 290;
        const violations = validateClusterRules(project);

        // Then: count now fails on two instances, not four cells.
        expect(violations).toHaveLength(1);
        expect(violations[0]).toMatchObject({ code: "cluster-rule:count:cluster-main", severity: "error" });
        expect(violations[0]?.coords).toHaveLength(4);
      });

      it("run_lint는 hard/medium/soft 클러스터 위반을 error/warning/info와 좌표로 노출한다", () => {
        // Given: one project carries all three cluster rule strengths.
        const { map, project } = projectWithRules([
          { id: "hard-pair", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
          { id: "medium-gap", kind: "spacing", params: { minGap: 3 }, strength: "medium" },
          { id: "soft-cap", kind: "count", params: { max: 2, perMap: true }, strength: "soft" },
        ]);
        project.startPos = { x: 4, y: 4 };
        map.upperTiles[at(map, 2, 3)] = 290;
        map.lowerTiles[at(map, 0, 0)] = 10;
        map.lowerTiles[at(map, 1, 0)] = 11;

        // When: the AI-facing lint tool is executed.
        const lint = runTool({ project }, "run_lint", {});
        const issues = (lint.data as { readonly issues: Array<{ readonly code: string; readonly severity: string; readonly x?: number; readonly y?: number }> }).issues;

        // Then: each strength maps to the expected public severity.
        expect(lint.ok, lint.summary).toBe(true);
        expect(issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: "cluster-rule:adjacency:cluster-main", severity: "error", x: 2, y: 3 }),
            expect.objectContaining({ code: "cluster-rule:spacing:cluster-main", severity: "warning", x: 0, y: 0 }),
            expect.objectContaining({ code: "cluster-rule:count:cluster-main", severity: "info" }),
          ])
        );
      });
    });
  });
});
