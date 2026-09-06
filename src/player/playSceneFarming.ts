import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import {
  autotileNeighborMask,
  autotileVariantForMask,
  type AutotileMapView,
} from "@/project/defaults/autotileEngine";
import { DEFAULT_FARMLAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { cropGraphicIndexForStage, cropGraphicStages } from "@/project/farmModel";
import { store } from "@/project/store";
import type { FarmPlotState } from "@/project/session";
import { cropStageForPlot } from "@/player/farming";
import type { CropRecord, TilesetDef } from "@/project/types";

type OverlayGameObject = {
  setOrigin?(x: number, y: number): void;
  setDepth?(depth: number): void;
  setAlpha?(alpha: number): void;
};

// 스텁 씬으로도 돌아가야 하므로 새 멤버는 전부 optional 이고, 없으면 조기 이탈/폴백한다.
type FarmOverlayScene = {
  readonly map: { readonly id: string; readonly tilesetId?: string; readonly width?: number; readonly height?: number };
  readonly session: { readonly farmPlots?: Record<string, Record<string, FarmPlotState>> };
  readonly tileLayer: { add(object: unknown): unknown };
  readonly resolveTilesetTexture?: (tileset: TilesetDef) => string;
  readonly add: {
    rectangle?: (x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number) => OverlayGameObject;
    image?: (x: number, y: number, texture: string, frame?: string | number) => OverlayGameObject;
    sprite?: (x: number, y: number, texture: string, frame?: string | number) => OverlayGameObject;
  };
};

const FARM_BASE_DEPTH = 90_000;
const FARM_CROP_DEPTH = 140_000;
// 물 준 흙은 전용 타일 아트가 없다(타일 그림판에 젖은 밭 변형 없음) — 실제 흙 타일 위에 옅은 어두운 틴트만 얹는다.
const WATERED_TINT_COLOR = 0x2a1a0c;
const WATERED_TINT_ALPHA = 0.18;

const FARMLAND_GROUP = DEFAULT_FARMLAND_AUTOTILE_GROUP;
const FARMLAND_MEMBER_TILES: ReadonlySet<number> = new Set(FARMLAND_GROUP.memberTileIds);
// 합성 뷰에서 "경작됨"을 표현할 대표 타일. variantMap 조회는 마스크만 쓰므로 몸통 타일로 충분하다.
const FARMLAND_SEED_TILE = FARMLAND_GROUP.variantMap[String(0xff)] ?? FARMLAND_GROUP.memberTileIds[0] ?? -1;

export function renderFarmOverlays(scene: FarmOverlayScene, crops: readonly CropRecord[] = []): void {
  const plots = scene.session.farmPlots?.[scene.map.id];
  if (!plots) return;
  const cropById = new Map(crops.map((crop) => [crop.id, crop]));
  const cells = parsePlotCells(plots, scene.map);
  if (cells.length === 0) return;
  const soil = createTilledSoilView(cells);
  const textureKey = resolveFarmTextureKey(scene);
  for (const cell of cells) {
    const { x, y, plot } = cell;
    if (plot.tilled) renderTilledSoil(scene, soil, textureKey, x, y, plot.dead === true);
    if (plot.watered) addRect(scene, x, y, WATERED_TINT_COLOR, WATERED_TINT_ALPHA, FARM_BASE_DEPTH + 1);
    if (!plot.cropId) continue;
    const crop = cropById.get(plot.cropId);
    renderCropMarker(scene, x, y, crop, crop ? cropStageForPlot(crop, plot) : plot.stage ?? 0, plot.dead === true);
  }
}

type FarmPlotCell = { readonly x: number; readonly y: number; readonly plot: FarmPlotState };

function parsePlotCells(
  plots: Record<string, FarmPlotState>,
  map: FarmOverlayScene["map"]
): readonly FarmPlotCell[] {
  const cells: FarmPlotCell[] = [];
  for (const [key, plot] of Object.entries(plots)) {
    const [xText, yText] = key.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    // 맵이 줄어들면 예전 밭 키가 세이밍에 남아 화면 밖 타일에 유령 밭이 그려진다.
    // 바운드를 알 수 있을 때만(헤드리스 스텀 씬은 모른다) 밖의 칸을 버린다.
    if (isOutsideMap(map, x, y)) continue;
    cells.push({ x, y, plot });
  }
  return cells;
}

function isOutsideMap(map: FarmOverlayScene["map"], x: number, y: number): boolean {
  if (x < 0 || y < 0) return true;
  if (map.width !== undefined && x >= map.width) return true;
  return map.height !== undefined && y >= map.height;
}

// 밭 상태는 세션 전용이므로 맵 타일 데이터를 쓰지 않는다. 오토타일 셰이핑에 필요한 이웃 정보는
// 경작된 칸들의 바운딩 박스(+1 여백) 위에 만든 합성 뷰로만 계산하고, map.lowerTiles 는 절대 건드리지 않는다.
type TilledSoilView = { readonly view: AutotileMapView; readonly originX: number; readonly originY: number };

function createTilledSoilView(cells: readonly FarmPlotCell[]): TilledSoilView {
  const tilled = cells.filter((cell) => cell.plot.tilled);
  const xs = tilled.map((cell) => cell.x);
  const ys = tilled.map((cell) => cell.y);
  const originX = (xs.length > 0 ? Math.min(...xs) : 0) - 1;
  const originY = (ys.length > 0 ? Math.min(...ys) : 0) - 1;
  const width = (xs.length > 0 ? Math.max(...xs) : 0) - originX + 2;
  const height = (ys.length > 0 ? Math.max(...ys) : 0) - originY + 2;
  const lowerTiles = new Array<number>(Math.max(0, width * height)).fill(-1);
  for (const cell of tilled) {
    lowerTiles[(cell.y - originY) * width + (cell.x - originX)] = FARMLAND_SEED_TILE;
  }
  return { view: { width, height, lowerTiles }, originX, originY };
}

function tilledSoilTile(soil: TilledSoilView, x: number, y: number): number | undefined {
  const mask = autotileNeighborMask(
    soil.view,
    x - soil.originX,
    y - soil.originY,
    (tile) => FARMLAND_MEMBER_TILES.has(tile),
    FARMLAND_GROUP.neighborhood ?? 4
  );
  return autotileVariantForMask(FARMLAND_GROUP, mask);
}

function resolveFarmTextureKey(scene: FarmOverlayScene): string | undefined {
  const tilesetId = scene.map.tilesetId;
  if (!tilesetId) return undefined;
  const tileset = store.getCurrent().tilesets[tilesetId] as TilesetDef | undefined;
  if (!tileset) return undefined;
  // 맵 렌더러(renderTile)와 동일한 해석 경로 — 픽셀 정합을 유지한다.
  return scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
}

// renderTile 의 프레임 이름 규칙(`tile_<id>`)과 같아야 한다. playSceneMapRuntime 쪽 헬퍼는 모듈 전용이라
// 재사용할 수 없으므로 규칙만 여기서 재현한다.
function farmTileFrameName(tile: number): string {
  return `tile_${tile}`;
}

function renderTilledSoil(
  scene: FarmOverlayScene,
  soil: TilledSoilView,
  textureKey: string | undefined,
  x: number,
  y: number,
  dead: boolean
): void {
  const tile = tilledSoilTile(soil, x, y);
  if (textureKey === undefined || tile === undefined || typeof scene.add.image !== "function") {
    // 타일셋/이미지 팩토리를 못 구하는 헤드리스 경로 — 기존 흙색 사각형으로 폴백.
    addRect(scene, x, y, 0x7a4a25, dead ? 0.52 : 0.38, FARM_BASE_DEPTH);
    return;
  }
  const image = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, textureKey, farmTileFrameName(tile));
  image.setOrigin?.(0, 0);
  image.setDepth?.(FARM_BASE_DEPTH + y);
  if (dead) image.setAlpha?.(0.75);
  scene.tileLayer.add(image);
}

function renderCropMarker(
  scene: FarmOverlayScene,
  x: number,
  y: number,
  crop: CropRecord | undefined,
  stage: number,
  dead: boolean
): void {
  // 저작된 그래픽이 없으면 cropGraphicStages 가 등록 스프라이트에서 파생한다(프로젝트엔 안 새긴다).
  const stages = crop ? cropGraphicStages(crop) : [];
  // 마지막 그림은 수확 가능 전용이다 — 단순 clamp 로 고르면 익기 전과 익은 뒤가 같은 그림이 된다.
  const index = cropGraphicIndexForStage(stages.length, crop?.stages.length ?? 0, stage);
  const graphic = index < 0 ? undefined : stages[index];
  if (graphic?.resourceId && typeof scene.add.sprite === "function") {
    const sprite = scene.add.sprite(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, graphic.resourceId, graphic.frame);
    sprite.setOrigin?.(0.5, 0.5);
    sprite.setDepth?.(FARM_CROP_DEPTH + y);
    if (dead) sprite.setAlpha?.(0.45);
    scene.tileLayer.add(sprite);
    return;
  }
  // 스프라이트를 못 찾으면 색 사각형까지만. 숫자/문자 라벨은 디버그 출력이라 맵에 그리지 않는다.
  addRect(scene, x, y, dead ? 0x5f6166 : 0x2f8f45, dead ? 0.52 : 0.42, FARM_CROP_DEPTH + y);
}

function addRect(scene: FarmOverlayScene, x: number, y: number, color: number, alpha: number, depth: number): void {
  const rect = scene.add.rectangle?.(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, color, alpha);
  if (!rect) return;
  rect.setOrigin?.(0, 0);
  rect.setDepth?.(depth + y);
  scene.tileLayer.add(rect);
}
