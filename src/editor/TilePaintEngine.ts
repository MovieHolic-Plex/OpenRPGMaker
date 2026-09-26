import type Phaser from "phaser";
import {
  paintTilesBulk,
  eraseVisibleTilesBulk,
  toggleCollision,
  fillTile,
  paintRelief,
} from "@/editor/actions";
import { comboBrushPlacement, evaluateComboBrushPlacement, isComboBrush } from "@/editor/comboBrush";
import { editorState } from "@/editor/editorState";
import {
  clusterRecoveryOffer,
  freehandPaintOptions,
  presentClusterRecovery,
} from "@/editor/clusterAssistRecovery";
import { revealPaletteTileFromMap } from "@/editor/panels/tilePalette";
import { selectTileRegion } from "@/editor/mapClipboard";
import { canEditMap, toastMapEditLockNotice } from "@/editor/mapEditLocks";
import { recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { beginKitStampCapture, checkKitStampConditions, commitKitStampCapture } from "@/editor/structurePlacementActions";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import { layerTilePickAt, visibleTilePickAt, type VisibleTilePick } from "@/editor/tilePicking";
import { store } from "@/project/store";
import type { MapId, TilesetDef } from "@/project/types";
import { reliefInverseMode } from "@/editor/reliefBrushMode";
import { toast } from "@/util/toast";

export type TileLayer = "lower" | "upper";

type TilePickTarget = {
  readonly mapId: MapId;
  readonly layer: TileLayer;
  readonly x: number;
  readonly y: number;
};

export type TilePaintEngineDeps = {
  readonly mapId: () => MapId | null;
  readonly pointerToTile: (ptr: Phaser.Input.Pointer) => { readonly x: number; readonly y: number };
  readonly updatePointerStatus: (ptr: Phaser.Input.Pointer) => void;
  readonly eventLayerClickCount: (target: {
    readonly mapId: MapId;
    readonly ptr: Phaser.Input.Pointer;
    readonly x: number;
    readonly y: number;
  }) => number;
  readonly pointerClickCount: (ptr: Phaser.Input.Pointer) => number;
  readonly offerEventLayerSwitchAt: (mapId: MapId, x: number, y: number, layer: string, clickCount: number) => boolean;
  readonly showEventLayerClickFeedback: (mapId: MapId, x: number, y: number) => void;
  readonly openExistingEventAt: (mapId: MapId, x: number, y: number) => boolean;
  readonly handleEventClick: (mapId: MapId, x: number, y: number, openEditor?: boolean) => void;
  readonly tilesetForMap: (mapId: MapId) => TilesetDef | undefined;
  readonly setLastPointerTile: (point: { readonly x: number; readonly y: number }) => void;
  readonly getPaintState: () => { readonly isPainting: boolean; readonly lastPaintKey: string };
  readonly setPaintState: (state: { readonly isPainting?: boolean; readonly lastPaintKey?: string }) => void;
};

export class TilePaintEngine {
  /**
   * 이 스트로크에서 배치 조건 안내를 이미 띄웠는지. 드래그로 같은 말을 수십 번 띄우지 않되,
   * 스트로크 도중 처음 거부되는 자리에서는 반드시 한 번 말하게 하는 자리 표시다.
   */
  private placementNoticeShown = false;
  private strokeSnapshotRecorded = false;
  private reliefStrokeBase = 0;
  /** 이 스트로크를 오른쪽 버튼으로 시작했는가 — 높이 붓은 왼쪽과 반대 방식으로 칠한다. */
  private reliefStrokeInverted = false;

  constructor(private readonly deps: TilePaintEngineDeps) {}

  applyAtPointer(ptr: Phaser.Input.Pointer): void {
    const mid = this.deps.mapId();
    if (!mid) return;
    const { x, y } = this.deps.pointerToTile(ptr);
    this.deps.setLastPointerTile({ x, y });
    this.deps.updatePointerStatus(ptr);

    const tool = editorState.get().tool;
    const layer = editorState.get().layer;
    if (!canEditMap(mid) && toolCanMutateMap(tool)) {
      this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
      toastMapEditLockNotice(mid);
      return;
    }
    const { activePaletteStamp, autoConnectMode, brushSize, clusterAssistMode, selectedTile } = editorState.get();
    const key = `${x},${y}`;
    const previousKey = this.deps.getPaintState().lastPaintKey;
    const firstStrokeTile = previousKey === "";
    if (firstStrokeTile) {
      this.placementNoticeShown = false;
      this.strokeSnapshotRecorded = false;
    }
    const repeatedNonEventCell = layer !== "event" && key === previousKey;
    const tileLayer: TileLayer = layer === "upper" ? "upper" : "lower";
    const clickCount =
      layer === "event" ? this.deps.eventLayerClickCount({ mapId: mid, ptr, x, y }) : this.deps.pointerClickCount(ptr);
    if (this.deps.offerEventLayerSwitchAt(mid, x, y, layer, clickCount)) return;
    if (repeatedNonEventCell) return;
    this.deps.setPaintState({ lastPaintKey: key });
    if (layer === "event") this.deps.showEventLayerClickFeedback(mid, x, y);

    if (layer === "event" && clickCount >= 2 && this.deps.openExistingEventAt(mid, x, y)) {
      return;
    }

    // Only freehand tile brushes interpolate. Stamps, fills and collision keep
    // their discrete gesture policy. Each pointer sample still uses one bulk edit.
    const continuous = layer !== "event" && (tool === "erase"
      || (tool === "paint" && !activePaletteStamp && editorState.get().paintShape === "pen"));
    const points = continuous
      ? strokeCenters(previousKey, x, y).flatMap((center) =>
        brushStrokePoints({ centerX: center.x, centerY: center.y, size: brushSize }))
      : brushStrokePoints({ centerX: x, centerY: y, size: brushSize });

    switch (tool) {
      case "paint":
        this.applyStrokeEdit(mid, () => {
          if (activePaletteStamp) {
            // Combo Brush 경계 판정 — 미리보기와 **같은** 모델(evaluateComboBrushPlacement)을 탄다.
            // 발자국이 통째로 맵 밖이면 아무 칸도 쓰지 않고 진단만 돌려준다 — 패턴이 반쪽만 남지 않는다.
            const comboMap = store.getCurrent().maps[mid];
            if (comboMap) {
              const verdict = evaluateComboBrushPlacement({
                bounds: { height: comboMap.height, width: comboMap.width },
                stamp: activePaletteStamp,
                x,
                y,
              });
              if (!verdict.ok) {
                if (!this.placementNoticeShown) {
                  this.placementNoticeShown = true;
                  toast(verdict.diagnostic.text, "error");
                }
                return;
              }
              if (verdict.warning && !this.placementNoticeShown) {
                this.placementNoticeShown = true;
                toast(verdict.warning.text, "info");
              }
            }
            // 배치 조건(kit.ai.placement) 검사 — 킷에 조건이 있을 때만 돈다.
            // hard 를 어기면 **칠하지 않는다**. 예전에는 조건이 산문뿐이라 아무 일도 일어나지 않았고,
            // 「화덕은 북벽에 붙는다」 같은 말이 지켜지는지 확인할 방법이 없었다.
            // 토스트는 스트로크 첫 타일에서만 — 드래그로 같은 말을 수십 번 띄우지 않는다.
            const conditions = checkKitStampConditions(mid, activePaletteStamp, x, y);
            if (conditions && conditions.verdict.blocked.length > 0) {
              // 스트로크 첫 타일이 아니라 **첫 거부**에서 알린다. 유효한 자리에서 드래그를 시작해
              // 안 되는 자리로 넘어가면 예전 규칙(firstStrokeTile)에서는 아무 말도 없이 칠이 멈춰,
              // 붓이 고장 난 것처럼 보였다.
              if (!this.placementNoticeShown) {
                this.placementNoticeShown = true;
                toast(
                  `여기엔 '${conditions.kit.name ?? "구조물"}'을 놓을 수 없습니다 — `
                  + conditions.verdict.blocked.map((failure) => failure.text).join(" / "),
                  "error",
                );
              }
              return;
            }
            if (conditions && conditions.verdict.warnings.length > 0 && !this.placementNoticeShown) {
              this.placementNoticeShown = true;
              toast(conditions.verdict.warnings.map((failure) => failure.text).join(" / "), "info");
            }
            // 구조물 배치 기록은 **스트로크의 첫 타일에서 한 번만** — 드래그로 배치가 수십 개 생기는 것을 막는다.
            // 구조물 킷이 아닌 스탬프(일반 드래그 선택·실내 오브젝트)는 beginKitStampCapture 가 null 을 준다.
            const capture = firstStrokeTile ? beginKitStampCapture(mid, activePaletteStamp, x, y) : null;
            applyPaletteStamp({
              autoConnect: autoConnectMode,
              bounds: comboMap ? { height: comboMap.height, width: comboMap.width } : null,
              mapId: mid,
              stamp: activePaletteStamp,
              x,
              y,
            });
            if (capture) commitKitStampCapture(capture);
            return;
          }
          if (selectedTile < 0) {
            // 덧그림 공백 붓 = 지우개. 바닥에서는 공백을 칠하지 않는다(체커 구멍).
            if (tileLayer === "upper") {
              eraseVisibleTilesBulk(
                mid,
                tileLayer,
                points,
                { autoConnect: autoConnectMode },
              );
            }
            return;
          }
          // 브러시 전 칸을 한 번의 updateMap 으로 (셀마다 clone 금지)
          //
          // 구조 보조(clusterAssistMode)는 이웃 연결과 **별개** 토글이다. 보조가 켜져 있으면
          // 동반 칸까지 원자적으로 배치하고, 막히면 그 자리에서 정확 배치를 제안한다.
          // 보조가 꺼져 있으면 고른 칸만 쓴다 — 그래도 보호셀·다른 덧그림은 덮지 않는다.
          paintTilesBulk(
            mid,
            points.map((point) => ({ ...point, layer: tileLayer, tile: selectedTile })),
            freehandPaintOptions({
              autoConnect: autoConnectMode,
              clusterAssist: clusterAssistMode,
              onRejected: (rejection) => {
                // 드래그 중 같은 말을 수십 번 띄우지 않되, 스트로크의 **첫 거부**에서는
                // 반드시 규칙·좌표와 복구 버튼을 보여 준다(붓이 잠긴 것처럼 보이던 원인).
                if (this.placementNoticeShown) return;
                this.placementNoticeShown = true;
                presentClusterRecovery(clusterRecoveryOffer(mid, rejection));
              },
            }),
          );
        });
        break;
      case "fill":
        if (firstStrokeTile) {
          if (selectedTile < 0 && tileLayer === "lower") break;
          this.applyStrokeEdit(mid, () => {
            fillTile(mid, tileLayer, x, y, selectedTile, { autoConnect: autoConnectMode });
          });
        }
        break;
      case "erase":
        this.applyStrokeEdit(mid, () => {
          eraseVisibleTilesBulk(mid, tileLayer, points, { autoConnect: autoConnectMode });
        });
        break;
      case "collision":
        this.applyStrokeEdit(mid, () => toggleCollision(mid, x, y), { includeTilesets: true });
        break;
      case "relief": {
        // 붓 크기 N = 반지름 N-1 원. 올리기/내리기는 스트로크 첫 칸 높이 ±1 을 상한으로 삼아
        // 드래그가 같은 언덕을 계속 쌓아 올리지 않게 한다. 평탄은 첫 칸 높이로 맞춘다.
        // 오른쪽 버튼 스트로크는 반대 방식(reliefInverseMode)이다.
        const { reliefLevel } = editorState.get();
        const relief = store.getCurrent().maps[mid]?.relief;
        if (firstStrokeTile) {
          this.reliefStrokeBase = relief ? relief.levels[y * relief.width + x] ?? 0 : 0;
          this.reliefStrokeInverted = ptr.button === 2 || ptr.rightButtonDown();
        }
        const selectedMode = editorState.get().reliefMode;
        const reliefMode = this.reliefStrokeInverted ? reliefInverseMode(selectedMode) : selectedMode;
        const base = this.reliefStrokeBase;
        const level = reliefMode === "raise" ? base + 1
          : reliefMode === "lower" ? base - 1
          : reliefMode === "set" && this.reliefStrokeInverted ? 0
          : reliefLevel;
        this.applyStrokeEdit(mid, () => {
          // 1칸 폭 돌기·홈은 렌더 규칙이 깎아 안 보인다 — 붓은 최소 반지름 1(3칸 폭)로 칠한다.
          paintRelief(mid, x, y, reliefMode, { radius: Math.max(1, brushSize - 1), level, flattenTo: base });
        });
        break;
      }
      case "event":
        this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
        this.deps.handleEventClick(mid, x, y, clickCount >= 2);
        break;
      case "select":
        selectTileRegion(mid, { mapId: mid, x, y, width: 1, height: 1 });
        break;
      case "eyedropper":
        this.pickVisibleTileAt(mid, x, y);
        break;
      case "pan":
        break;
    }
  }

  private applyStrokeEdit(mapId: MapId, edit: () => void, options: { readonly includeTilesets?: boolean } = {}): void {
    if (this.strokeSnapshotRecorded) edit();
    else this.strokeSnapshotRecorded = recordMapEditIfChanged(mapId, edit, options);
  }

  pickTileAtPointer(ptr: Phaser.Input.Pointer): void {
    const mapId = this.deps.mapId();
    if (!mapId) return;
    const { x, y } = this.deps.pointerToTile(ptr);
    this.pickVisibleTileAt(mapId, x, y);
  }

  /** 좌표 기반 스포이트. 우클릭 메뉴처럼 포인터가 이미 지나간 뒤 실행되는 경로가 쓴다. */
  pickVisibleTileAt(mapId: MapId, x: number, y: number): void {
    const map = store.getCurrent().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    const index = y * map.width + x;
    const layer = editorState.get().layer;
    const pick =
      layer === "upper" ? layerTilePickAt(map, index, "upper") : visibleTilePickAt(map, index);
    if (!pick) return;
    this.commitPick(pick);
  }

  pickTileAt(target: TilePickTarget): void {
    const map = store.getCurrent().maps[target.mapId];
    if (!map) return;
    if (target.x < 0 || target.y < 0 || target.x >= map.width || target.y >= map.height) return;
    const pick = layerTilePickAt(map, target.y * map.width + target.x, target.layer);
    if (!pick) return;
    this.commitPick(pick);
  }

  private commitPick(pick: VisibleTilePick): void {
    this.deps.setPaintState({ isPainting: false, lastPaintKey: "" });
    editorState.set({
      activePaletteStamp: null,
      selectedTile: pick.tile,
      layer: pick.layer,
      tool: "paint",
      paintShape: "pen",
    });
    // 전문가 모드: 우클릭 스포이트 후 팔레트 타일 그림판(하위/상위 레이어 시트)로 이동
    revealPaletteTileFromMap(pick.tile);
  }
}

// Even sizes retain the negative-side anchor: size 2 covers [-1, 0],
// size 4 covers [-2, -1, 0, 1]. Painting and hover use this same footprint.
export function brushStrokePoints(stroke: {
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
}): readonly { x: number; y: number }[] {
  const offset = Math.floor(stroke.size / 2);
  const points: { x: number; y: number }[] = [];
  for (let y = stroke.centerY - offset; y < stroke.centerY - offset + stroke.size; y += 1) {
    for (let x = stroke.centerX - offset; x < stroke.centerX - offset + stroke.size; x += 1) {
      points.push({ x, y });
    }
  }
  return points;
}

function strokeCenters(previousKey: string, x: number, y: number): readonly { x: number; y: number }[] {
  if (!previousKey) return [{ x, y }];
  const [startX, startY] = previousKey.split(",").map(Number);
  const steps = Math.max(Math.abs(x - startX), Math.abs(y - startY));
  const points: { x: number; y: number }[] = [];
  // Integer-weight interpolation gives the same 8-connected line in reverse,
  // including half-cell ties. Do not apply the previous endpoint twice.
  for (let step = 1; step <= steps; step += 1) {
    points.push({
      x: Math.round((startX * (steps - step) + x * step) / steps),
      y: Math.round((startY * (steps - step) + y * step) / steps),
    });
  }
  return points;
}

function applyPaletteStamp(input: {
  readonly autoConnect: boolean;
  /** 맵 크기. 있으면 칸 좌표를 미리보기와 같은 comboBrushPlacement 로 푼다. */
  readonly bounds: { readonly height: number; readonly width: number } | null;
  readonly mapId: MapId;
  readonly stamp: PaletteStamp;
  readonly x: number;
  readonly y: number;
}): void {
  // 여러 칸 스탬프는 "고른 그대로" 찍는다 — 클러스터 동반 확장이 셀마다 발화해
  // 스탬프 밖 이웃의 상위 레이어를 덮어쓰던 문제 차단 + 의도한 배열 보존.
  // 1칸 스탬프는 지형 오토타일(흙길/모래 등)이 기대대로 성형되도록 autoConnect 를 존중한다.
  const single = !isComboBrush(input.stamp);
  // 칸 좌표는 호버 미리보기와 **같은** comboBrushPlacement 에서 온다 — 두 번째 경계 계산 금지.
  // bounds 가 없으면(맵 조회 실패) 예전처럼 전량을 넘기고 paintTilesBulk 의 inMap 이 막는다.
  const cells = input.bounds
    ? comboBrushPlacement({ bounds: input.bounds, stamp: input.stamp, x: input.x, y: input.y })
      .paintableCells.map((placed) => ({ layer: placed.cell.layer, tile: placed.cell.tile, x: placed.x, y: placed.y }))
    : input.stamp.cells.map((cell) => ({ layer: cell.layer, tile: cell.tile, x: input.x + cell.dx, y: input.y + cell.dy }));
  paintTilesBulk(
    input.mapId,
    cells.map((cell) => ({
      layer: cell.layer,
      x: cell.x,
      y: cell.y,
      tile: cell.tile,
    })),
    {
      autoConnect: single ? input.autoConnect : false,
      preservePattern: !single,
      clusterExpand: false,
    },
  );
}

function toolCanMutateMap(tool: string): boolean {
  return tool === "paint" || tool === "fill" || tool === "erase" || tool === "collision" || tool === "event" || tool === "relief";
}

