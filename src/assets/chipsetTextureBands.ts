// 칩셋 시트를 GL 한 장으로 올리지 않는다.
//
// 버들항 v6 는 2048×7664(61,312칸)다. 칸 737(잔디)은 시트 맨 위(y=80)에 있어도, 이 높이 전체를
// texImage2D 한 번으로 올리면 기기마다 통째로 실패하거나(MAX_TEXTURE_SIZE 4096) 소프트웨어 GL 이
// 업로드에서 멈춘다. 팔레트는 CSS 가 PNG 를 직접 그리므로 멀쩡해 보이고, 맵만 검은 빈칸이 된다.
// 2048(타일 128줄) 이하로 잘라 소스 여러 장에 올린다. 칸 번호는 바꾸지 않는다.

export const CHIPSET_TEXTURE_MAX_EDGE = 2048;
const BAND_COLUMNS = "__oprnBandCols";

type SizedImage = CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
type BandTexture = {
  key?: string;
  source?: { width?: number; height?: number }[];
  setSource?: (data: HTMLCanvasElement[], startIndex?: number, renew?: boolean) => void;
  [BAND_COLUMNS]?: number;
};

const chipsetTextureKeys = new Set<string>();
const chipsetTileSizes = new Map<string, number>();
/** 대형 시트(2048px 초과) 원본 비트맵 캐시 — 모든 번들 칩셋이 타일 이식에 쓰일 수 있도록 넉넉한 상한으로 유지하고 미분할 시트는 보호한다. */
const MAX_REMEMBERED_FULL_SHEETS = 64;
const fullSheets = new Map<string, SizedImage>();
const firstBandCanvases = new Map<string, HTMLCanvasElement>();

/** 로더가 이 키를 칩셋으로 알게 한다. 초상·그림은 자르지 않는다. tileSize 는 띠 경계가 칸을 가로지르지 않게 한다. */
export function markChipsetTextureKey(key: string, tileSize = 16): void {
  if (!key) return;
  chipsetTextureKeys.add(key);
  if (tileSize > 0) chipsetTileSizes.set(key, tileSize);
}

function tileSizeForKey(key: string | undefined): number {
  return (key && chipsetTileSizes.get(key)) || 16;
}

export function chipsetNeedsBands(width: number, height: number): boolean {
  return width > CHIPSET_TEXTURE_MAX_EDGE || height > CHIPSET_TEXTURE_MAX_EDGE;
}

/** 2048 이하이면서 칸 크기의 배수. 48px 칸은 2048 이 배수가 아니라 2016 에서 자른다. */
export function chipsetBandEdge(tileSize = 16): number {
  const step = Number.isFinite(tileSize) && tileSize > 0 && tileSize <= CHIPSET_TEXTURE_MAX_EDGE ? Math.floor(tileSize) : CHIPSET_TEXTURE_MAX_EDGE;
  return Math.max(step, Math.floor(CHIPSET_TEXTURE_MAX_EDGE / step) * step);
}

export function chipsetBandColumns(width: number, tileSize = 16): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.ceil(width / chipsetBandEdge(tileSize)));
}

/** 시트를 덮는 2048 이하 칸. 경계는 타일 줄에 맞춘다. 필요 없으면 null. */
export function chipsetBandRects(width: number, height: number, tileSize = 16): { x: number; y: number; width: number; height: number; columns: number }[] | null {
  if (!chipsetNeedsBands(width, height) || width <= 0 || height <= 0) return null;
  const edge = chipsetBandEdge(tileSize);
  const bandW = Math.min(width, edge);
  const bandH = Math.min(height, edge);
  const columns = Math.ceil(width / bandW);
  const rects: { x: number; y: number; width: number; height: number; columns: number }[] = [];
  for (let y = 0; y < height; y += bandH) {
    for (let x = 0; x < width; x += bandW) {
      rects.push({ x, y, width: Math.min(bandW, width - x), height: Math.min(bandH, height - y), columns });
    }
  }
  return rects;
}

function imageSize(image: SizedImage): { width: number; height: number } {
  return { width: image.naturalWidth || image.width || 0, height: image.naturalHeight || image.height || 0 };
}

function cropChipsetBand(image: SizedImage, rect: { x: number; y: number; width: number; height: number }): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
}

/** 2D 캔버스로 자른 띠. document 가 없거나 한 장이면 null. */
export function sliceChipsetBandSources(image: SizedImage, tileSize = 16): { canvases: HTMLCanvasElement[]; columns: number } | null {
  const { width, height } = imageSize(image);
  const rects = chipsetBandRects(width, height, tileSize);
  if (!rects || rects.length < 2) return null;
  const canvases: HTMLCanvasElement[] = [];
  for (const rect of rects) {
    const canvas = cropChipsetBand(image, rect);
    if (!canvas) return null;
    canvases.push(canvas);
  }
  return { canvases, columns: rects[0]!.columns };
}

export function sliceChipsetBands(image: SizedImage, tileSize = 16): HTMLCanvasElement[] | null {
  return sliceChipsetBandSources(image, tileSize)?.canvases ?? null;
}

function evictRememberedOverflow(): void {
  if (fullSheets.size <= MAX_REMEMBERED_FULL_SHEETS) return;
  for (const key of fullSheets.keys()) {
    if (fullSheets.size <= MAX_REMEMBERED_FULL_SHEETS) break;
    // 아직 applyRememberedChipsetBands 가 돌지 않은 대기 시트는 배치 프리로드 중 퇴출하지 않는다.
    if (firstBandCanvases.has(key)) continue;
    fullSheets.delete(key);
  }
}

export function rememberChipsetImage(key: string, image: SizedImage, firstBand?: HTMLCanvasElement): void {
  if (!key) return;
  fullSheets.delete(key);
  fullSheets.set(key, image);
  if (firstBand) firstBandCanvases.set(key, firstBand);
  else firstBandCanvases.delete(key);
  evictRememberedOverflow();
}

/** 플레이어 종료/테스트 플레이 닫기 시 대형 디코딩 시트 비트맵 참조를 즉시 비운다. */
export function clearRememberedChipsetImages(): void {
  fullSheets.clear();
  firstBandCanvases.clear();
}

/** 로더가 남긴 시트 전체. GL 소스는 첫 띠뿐이라 이식 굽기는 이것을 쓴다. */
export function rememberedChipsetImage(key: string): SizedImage | null {
  const image = fullSheets.get(key);
  if (!image) return null;
  // LRU 갱신
  fullSheets.delete(key);
  fullSheets.set(key, image);
  return image;
}

/** 프레임을 만들기 전에, 기억된 시트가 있으면 텍스처 소스를 띠로 바꾼다. 첫 띠는 이미 잘라 둔 캔버스를 재사용한다. */
export function applyRememberedChipsetBands(texture: BandTexture): void {
  const key = texture.key;
  const image = key ? fullSheets.get(key) : undefined;
  if (!image || !texture.setSource || (texture.source?.length ?? 0) > 1) return;
  const tileSize = tileSizeForKey(key);
  const { width, height } = imageSize(image);
  const rects = chipsetBandRects(width, height, tileSize);
  if (!rects || rects.length < 2) return;
  const canvases: HTMLCanvasElement[] = [];
  const cachedFirst = key ? firstBandCanvases.get(key) : undefined;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    const canvas = index === 0 && cachedFirst && cachedFirst.width === rect.width && cachedFirst.height === rect.height
      ? cachedFirst
      : cropChipsetBand(image, rect);
    if (!canvas) return;
    canvases.push(canvas);
  }
  texture.setSource(canvases, 0, true);
  texture[BAND_COLUMNS] = rects[0]!.columns;
  if (key) firstBandCanvases.delete(key);
  evictRememberedOverflow();
}

/**
 * 칸 번호 → Phaser 프레임. 소스가 한 장이면 시트 좌표 그대로(sourceIndex 0).
 * 띠가 여러 장이면 그 칸이 든 소스와 그 안에서의 y.
 */
export function tileFrameOrigin(
  index: number,
  tilesPerRow: number,
  tileSize: number,
  sourceCount: number,
  bandWidth: number,
  bandHeight: number,
  columns: number,
): { sourceIndex: number; x: number; y: number } {
  const perRow = Math.max(1, tilesPerRow);
  const safeIndex = index < 0 ? 0 : index;
  const sx = (safeIndex % perRow) * tileSize;
  const sy = Math.floor(safeIndex / perRow) * tileSize;
  if (sourceCount <= 1 || bandHeight <= 0) return { sourceIndex: 0, x: sx, y: sy };
  const bandColumns = Math.max(1, columns);
  const bandCol = bandWidth > 0 ? Math.min(bandColumns - 1, Math.floor(sx / bandWidth)) : 0;
  const bandRow = Math.floor(sy / bandHeight);
  return {
    sourceIndex: Math.min(sourceCount - 1, bandRow * bandColumns + bandCol),
    x: sx - bandCol * (bandWidth > 0 ? bandWidth : 0),
    y: sy - bandRow * bandHeight,
  };
}

export function frameOriginForTexture(
  texture: { source?: readonly { width?: number; height?: number }[]; [BAND_COLUMNS]?: number },
  index: number,
  tilesPerRow: number,
  tileSize: number,
): { sourceIndex: number; x: number; y: number } {
  const sources = texture.source ?? [];
  const first = sources[0];
  return tileFrameOrigin(index, tilesPerRow, tileSize, sources.length, first?.width ?? 0, first?.height ?? 0, texture[BAND_COLUMNS] ?? 1);
}

type ImageFileProto = {
  onProcess: () => void;
  onProcessComplete: () => void;
  onProcessError: () => void;
  data: CanvasImageSource;
  xhrLoader: XMLHttpRequest | null;
  crossOrigin?: string;
  state: number;
  key: string;
  __oprnDecode?: true;
};

/** `onProcessImage` 는 런타임 프로토타입에 있으나 phaser.d.ts 에는 없다. */
type ImageFileRuntime = ImageFileProto & {
  onProcessImage: (this: ImageFileProto) => void;
};

type UploadRuntime = {
  Loader: {
    FILE_PROCESSING: number;
    FILE_LOADED: number;
    FileTypes: { ImageFile: { prototype: ImageFileProto } };
  };
};

function keepFirstBand(file: ImageFileProto, image: SizedImage): void {
  if (!chipsetTextureKeys.has(file.key)) return;
  try {
    const { width, height } = imageSize(image);
    const rects = chipsetBandRects(width, height, tileSizeForKey(file.key));
    const first = rects && rects.length > 1 ? cropChipsetBand(image, rects[0]!) : null;
    if (!first) return;
    rememberChipsetImage(file.key, image, first);
    file.data = first;
  } catch (error) {
    console.warn(`[chipset] 시트 띠 나누기 실패: ${file.key}`, error);
  }
}

/**
 * 그림 디코드를 업로드 앞에 두고, 표시된 칩셋이 2048 을 넘으면 첫 띠만 올린다.
 * 나머지 띠는 프레임 등록 때 `applyRememberedChipsetBands` 가 붙인다.
 * data URL 은 인스턴스가 `onProcessImage` 를 쓰므로 그 경로도 같이 자른다.
 * 한 번만 깔린다(`__oprnDecode`).
 */
export function installChipsetUploadGuard(PhaserRuntime: UploadRuntime): void {
  const proto = PhaserRuntime.Loader.FileTypes.ImageFile.prototype as ImageFileRuntime;
  if (proto.__oprnDecode) return;
  proto.__oprnDecode = true;
  const PROCESSING = PhaserRuntime.Loader.FILE_PROCESSING;
  const LOADED = PhaserRuntime.Loader.FILE_LOADED;
  proto.onProcessImage = function (this: ImageFileProto): void {
    const loaded = this.state === LOADED;
    this.state = PROCESSING;
    if (!loaded) { this.onProcessError(); return; }
    keepFirstBand(this, this.data as SizedImage);
    this.onProcessComplete();
  };
  proto.onProcess = function (this: ImageFileProto): void {
    this.state = PROCESSING;
    const image = new Image();
    if (this.crossOrigin !== undefined) image.crossOrigin = this.crossOrigin;
    this.data = image;
    const response = this.xhrLoader?.response;
    if (!response) { this.onProcessError(); return; }
    const url = URL.createObjectURL(response as Blob);
    image.src = url;
    const finish = (ok: boolean): void => {
      URL.revokeObjectURL(url);
      if (ok) this.onProcessComplete();
      else this.onProcessError();
    };
    const accept = (): void => {
      keepFirstBand(this, image);
      finish(true);
    };
    // WebKit 등은 멀쩡한 큰 그림에도 decode() 를 거절한다 — 그때는 load 를 기다려 텍스처가 빠지지 않게 한다.
    image.decode().then(accept, () => {
      if (image.complete) {
        if (image.naturalWidth > 0) accept();
        else finish(false);
        return;
      }
      image.onload = () => accept();
      image.onerror = () => finish(false);
    });
  };
}
