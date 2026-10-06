import { prepareReliefRead } from "./reliefGroundSurface";
import { mapTileSize } from "@/project/tileGeometry";
import { worldmapAutoTile } from '@/project/worldmapAutoBrush';
import type Phaser from "phaser";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { comboBrushPlacement } from "@/editor/comboBrush";
import { editorState } from "@/editor/editorState";
import { brushStrokePoints } from "@/editor/TilePaintEngine";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";
import { findReliefDoodad, RELIEF_DOODAD_HOVER_EVENT, type ReliefDoodadHoverDetail } from "@/editor/reliefDoodads";
import { planEditorTerrainDoodad, planEditorGroupMove } from "./terrainDoodadPlan";
import { groupAt } from "./terrainClusters";
import { terrainBrushPoints } from "./terrainBrush";
import { RELIEF_ROUGH_RADII } from "@/project/relief/roughBrush";
import { cellLift, reliefLiftField, reliefPickCell, reliefReadSignature as reliefSignature } from "@/project/relief/screen";
import { isTerrainDesignTool } from "./terrainDesignActions";
import { symmetricPoints, lineCells, polygonCells, symmetryVariants, transformPoint } from "./terrainDesignGeometry";
import { planTerrainStamp } from "./terrainStamps";
import { terrainLocked } from "@/project/terrainDesign";
import { planReliefDoodad } from "./reliefDoodads";
import { planQuickHouseDrag, quickHouseOptions } from "./quickHouse";
import { drawQuickHousePreview } from "./quickHousePreview";

function announceReliefDoodadHover(detail: ReliefDoodadHoverDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReliefDoodadHoverDetail>(RELIEF_DOODAD_HOVER_EVENT, { detail }));
}

/**
 * 「높이」 호버: 지형지물을 골랐으면 놓일 자리(초록 = 놓을 수 있음, 빨강 = 못 놓음), 아니면 러프 붓이 닿는 원.
 * 들린 언덕은 북쪽으로 올라가 그려지므로 둘 다 보이는 칸(reliefPickCell) 기준으로 그린다.
 */
function renderReliefHover(spec: HoverPreviewSpec, map: GameMap, tileSize: number): void {
  const state = editorState.get();
  const pick = reliefPickCell(map.relief, spec.centerX, spec.centerY);
  const doodad = findReliefDoodad(store.getCurrent().tilesets[map.tilesetId], state.reliefDoodad);
  const tileset=store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  if (isTerrainDesignTool(state.terrainBrush)) {
    const g = spec.scene.add.graphics(), lift = map.relief ? reliefLiftField(map.relief) : null;
    const draw = (x:number,y:number,color:number) => { g.fillStyle(color,.22);g.lineStyle(1,color,.85);const top=(y-(lift?cellLift(lift,x,y):0))*tileSize;g.fillRect(x*tileSize,top,tileSize,tileSize);g.strokeRect(x*tileSize,top,tileSize,tileSize); };
    if (state.terrainFeatureId || state.terrainVisionPreview) { spec.layer.add(g); return; }
    if (state.terrainBrush === "house") {
      const plan = planQuickHouseDrag(map, tileset, { mapId: map.id, start: pick, end: pick }, quickHouseOptions(state));
      drawQuickHousePreview(spec.scene, spec.layer, map, tileset, plan);
    } else if (state.terrainBrush === "stamp" && !state.terrainStampCapture) {
      const stamp=store.getCurrent().terrainStamps?.find(s=>s.id===state.terrainStampId);
      if(stamp){const plan=planTerrainStamp(map,tileset,stamp,pick,state.terrainStampRotation,state.terrainStampMirror);for(const i of plan.indices)draw(i%map.width,Math.floor(i/map.width),plan.ok?0x2f9e44:0xe03131);}
    } else {
      const pending=state.terrainPoints?.mapId===map.id?state.terrainPoints.points:[],shape=state.terrainAreaShape;
      for(const variant of symmetryVariants(state.terrainSymmetry,map.width,map.height)){
        let points=[...pending,pick].map(p=>transformPoint(p,map.width,map.height,variant));
        if(shape==="rect"&&points.length>=2&&["contour","lake","lock","stamp"].includes(state.terrainBrush)){const a=points[0]!,b=points.at(-1)!;points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];}
        const cells=points.length>=3&&["contour","lake","lock","stamp","finish"].includes(state.terrainBrush)&&shape!=="line"?polygonCells(points,map.width,map.height):lineCells(points);
        for(const p of cells)draw(p.x,p.y,terrainLocked(map.terrainDesign,p.y*map.width+p.x)?0xe0a236:0x329af0);
        if(state.terrainBrush==="mix"||state.terrainBrush==="mixedCluster"){const p=transformPoint(pick,map.width,map.height,variant);g.lineStyle(2,0x329af0,.9);g.strokeCircle((p.x+.5)*tileSize,(p.y+.5-(lift?cellLift(lift,p.x,p.y):0))*tileSize,state.terrainWidth*tileSize/2);}
      }
    }
    spec.layer.add(g);return;
  }
  if (state.terrainBrush === "group") {
    const plan=state.terrainMoveGroup?planEditorGroupMove(map,tileset,pick.x,pick.y):null;
    const group=groupAt(map,pick.x,pick.y);
    const selected=state.terrainSelectedGroup?.mapId===map.id?map.doodadGroups?.find(g=>g.id===state.terrainSelectedGroup?.id):null;
    const lift=map.relief?reliefLiftField(map.relief):null;
    const rects=plan?.rects??(group??selected)?.cells.map(c=>{const x=c.index%map.width,y=Math.floor(c.index/map.width);return{x,y:y-(lift?cellLift(lift,x,y):0),w:1,h:1};})??[];
    for (const rect of rects) spec.layer.add(spec.scene.add.rectangle(rect.x*tileSize,rect.y*tileSize,tileSize,tileSize,plan?.ok===false?0xe03131:0x329af0,.25).setOrigin(0,0).setStrokeStyle(1,0x329af0));
    return;
  }
  if (state.terrainBrush === "surface" || state.terrainBrush === "river") {
    const lift=map.relief?reliefLiftField(map.relief):null;
    for(const center of symmetricPoints(pick,state.terrainSymmetry,map.width,map.height))for (const p of terrainBrushPoints(map,center.x,center.y,state.terrainWidth,state.terrainBrush==="river"))spec.layer.add(spec.scene.add.rectangle(p.x*tileSize,(p.y-(lift?cellLift(lift,p.x,p.y):0))*tileSize,tileSize,tileSize,0x329af0,.22).setOrigin(0,0).setStrokeStyle(1,0x329af0));
    return;
  }
  if (doodad) {
    if (pick.x < 0 || pick.y < 0 || pick.x >= map.width || pick.y >= map.height) {
      announceReliefDoodadHover(null);
      return;
    }
    for(const variant of symmetryVariants(state.terrainSymmetry,map.width,map.height)){
    const at={...transformPoint(pick,map.width,map.height,variant),face:pick.face};
    const plan = doodad.kind==="bridge"&&state.reliefBridgeStart?planReliefDoodad(map,doodad,at,{width:state.reliefRampWidth,bridgeStart:transformPoint(state.reliefBridgeStart,map.width,map.height,variant)}):planEditorTerrainDoodad(map, tileset, doodad, at);
    const color = plan.ok ? 0x2f9e44 : 0xe03131;
    for (const rect of plan.rects) {
      const shape = spec.scene.add.rectangle(rect.x * tileSize, rect.y * tileSize, rect.w * tileSize, rect.h * tileSize, color, 0.18)
        .setOrigin(0, 0).setStrokeStyle(2, color, 0.95);
      spec.layer.add(shape);
    }
    announceReliefDoodadHover({ ok: plan.ok, reason: plan.reason, label: doodad.label });
    }
    return;
  }
  if (pick.x < 0 || pick.y < 0 || pick.x >= map.width || pick.y >= map.height) return;
  for(const point of symmetricPoints(pick,state.terrainSymmetry,map.width,map.height)){
  const lift = map.relief ? cellLift(reliefLiftField(map.relief), point.x, point.y) : 0;
  const radius = Math.max(1, RELIEF_ROUGH_RADII[state.reliefRoughSize]);
  const ring = spec.scene.add.circle((point.x + 0.5) * tileSize, (point.y - lift + 0.5) * tileSize, (radius + 0.5) * tileSize)
    .setStrokeStyle(2, 0xffffff, 0.85).setFillStyle(0xffffff, 0.06);
  const dot = spec.scene.add.rectangle(point.x * tileSize, (point.y - lift) * tileSize, tileSize, tileSize).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.9);
  spec.layer.add([ring, dot]);
  }
}

/** 페인트/드래그 중에는 팔레트 raw 호버를 그리지 않는다 — 성형 결과와 겹쳐 깜빡임이 난다. */
export function shouldShowPaintHoverPreview(input: {
  readonly isPainting: boolean;
  readonly dragActive: boolean;
}): boolean {
  return !input.isPainting && !input.dragActive;
}

type HoverPreviewSpec = {
  readonly centerX: number;
  readonly centerY: number;
  readonly layer: Phaser.GameObjects.Container;
  readonly mapId: MapId;
  readonly scene: Phaser.Scene;
  /** 이 맵의 좌표 단위(px). 렌더와 같은 값을 써야 미리보기가 칸에 정확히 앉는다. */
  readonly tileSize?: number;
};

const HOVER_PREVIEW_KEY = "oprnHoverPreviewKey";

function hoverPreviewKey(spec: HoverPreviewSpec): string {
  const state = editorState.get();
  const stamp = state.activePaletteStamp;
  const stampKey = stamp
    ? `${stamp.width}x${stamp.height}:${stamp.source.startTile}-${stamp.source.endTile}:${stamp.cells.length}`
    : "";
  return [
    spec.mapId, spec.centerX, spec.centerY, state.tool, state.layer,
    state.selectedTile, state.worldmapAutoBackground, state.brushSize, state.paintShape, stampKey,
    state.terrainSymmetry, state.terrainStampId, state.terrainStampRotation, state.terrainStampMirror, state.terrainStampCapture,
    state.terrainHouseStyle, state.terrainHouseKitId, state.terrainHouseWidth, state.terrainHouseStories, state.terrainHouseResize, state.terrainHouseRoofWidth, state.terrainRoadDrag,
    state.terrainAreaShape, state.terrainDelta, state.terrainSeed, JSON.stringify(state.terrainMixWeights), JSON.stringify(state.terrainPoints),
    ...(state.tool === "relief"
      ? [state.reliefDoodad ?? "", state.reliefRoughSize, state.terrainBrush, state.terrainMaterial, state.terrainWidth, state.reliefRampWidth, state.reliefClusterDensity, state.reliefClusterEnabled, JSON.stringify(state.reliefBridgeStart), JSON.stringify(state.terrainSelectedGroup), state.terrainMoveGroup, `${store.getVersionToken().lineage}:${store.getVersionToken().generation}`, reliefSignature(store.getCurrent().maps[spec.mapId]?.relief)]
      : []),
  ].join("|");
}

export function renderHoverTilePreview(spec: HoverPreviewSpec): void {
  const inputMap = store.getCurrent().maps[spec.mapId];
  if (inputMap) prepareReliefRead(inputMap);
  const key = hoverPreviewKey(spec);
  if (spec.layer.getData(HOVER_PREVIEW_KEY) === key && spec.layer.list.length > 0) return;
  spec.layer.setData(HOVER_PREVIEW_KEY, key);
  spec.layer.removeAll(true);
  const map = store.getCurrent().maps[spec.mapId];
  if (!map) return;
  const tileSize = spec.tileSize ?? mapTileSize(map);
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  if (!tileset) return;
  const state = editorState.get();
  if (state.tool === "relief") {
    renderReliefHover(spec, map, tileSize);
    return;
  }
  if (state.tool !== "paint" && state.tool !== "fill" && state.tool !== "erase") return;
  if (spec.centerX < 0 || spec.centerY < 0 || spec.centerX >= map.width || spec.centerY >= map.height) return;
  if (state.tool === "paint" && state.activePaletteStamp) {
    // 발자국은 comboBrushPlacement 하나로 푸다 — 여기서 두 번째 경계 계산을 하지 않는다.
    // 예전에는 미리보기와 페인트가 각자 `x < map.width` 를 세서 둘이 어긋날 수 있었고,
    // 잘리는 칸은 그냥 안 그려서 "누르면 몇 칸이 사라진다"는 사실이 누르기 전에 보이지 않았다.
    const placement = comboBrushPlacement({
      bounds: { height: map.height, width: map.width },
      stamp: state.activePaletteStamp,
      x: spec.centerX,
      y: spec.centerY,
    });
    for (const placed of placement.cells) {
      const { x, y } = placed;
      if (placed.inBounds) {
        const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, placed.cell.tile);
        preview.setAlpha(placed.cell.layer === "upper" ? 0.72 : 0.58);
        spec.layer.add(preview);
      }
      // 맵 밖 칸도 표시한다 — 붉은 슬롯이 계약대로 "이 칸은 잘린다"를 미리 말한다.
      const marker = spec.scene.add.rectangle(
        x * tileSize,
        y * tileSize,
        tileSize,
        tileSize,
        placed.inBounds ? 0x51cf66 : 0xff6b6b,
        placed.inBounds ? 0.12 : 0.22,
      );
      marker.setOrigin(0, 0);
      marker.setStrokeStyle(1, placed.inBounds ? 0xd3f9d8 : 0xffc9c9, placed.inBounds ? 0.72 : 0.9);
      spec.layer.add(marker);
    }
    return;
  }
  const erasing = state.tool === "erase" || state.selectedTile < 0;
  if (state.selectedTile < 0 && state.tool !== "erase" && state.layer !== "upper") return;
  const size = state.tool === "erase" || (state.tool === "paint" && state.paintShape === "pen") ? state.brushSize : 1;
  for (const { x, y } of brushStrokePoints({ centerX: spec.centerX, centerY: spec.centerY, size })) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (!erasing) {
      const tile = state.worldmapAutoBackground && state.clusterAssistMode
        ? worldmapAutoTile(map, tileset, state.selectedTile, x, y) : state.selectedTile;
      const preview = createChipsetTileObject(spec.scene, map, tileset, x, y, tile);
      preview.setAlpha(0.62);
      spec.layer.add(preview);
    }
    const marker = spec.scene.add.rectangle(x * tileSize, y * tileSize, tileSize, tileSize, erasing ? 0xff6b6b : 0x3bc9db, 0.18);
    marker.setOrigin(0, 0);
    marker.setStrokeStyle(1, 0xe7f5ff, 0.85);
    spec.layer.add(marker);
  }
}
