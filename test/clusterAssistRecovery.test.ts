// OPRN-OUT-017 — 손붓이 hard 클러스터 규칙에 막혔을 때 되살아날 길이 있는가.
//
// 원 보고: 합본마을 나무밑동 290~292 를 「이웃 연결: 수동」 에서도 아예 손댈 수 없었다.
// 여기서 재는 것은 네 자리(맵 경계 / 위 칸 점유 / 보호셀 옆 / 정상 공터)와 되돌리기 단위,
// 그리고 정확 배치가 남긴 위반이 lint 에 규칙·좌표와 함께 보이는가다.

import { beforeEach, describe, expect, it } from "vitest";
import {
  applyExactPlacement,
  clusterRecoveryOffer,
  freehandPaintOptions,
} from "@/editor/clusterAssistRecovery";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { editorState } from "@/editor/editorState";
import {
  getMapEditHistoryState,
  recordMapEditIfChanged,
  redoMapEdit,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject, TILE } from "@/project/defaults";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

const TRUNKS = [290, 291, 292] as const;
const TRUNK_CANOPY: Readonly<Record<number, number>> = { 290: 260, 291: 261, 292: 262 };

function fixture(): { readonly mapId: MapId } {
  const project = createBlankProject();
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
