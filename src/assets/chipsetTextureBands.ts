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
const fullSheets = new Map<string, SizedImage>();

/** 로더가 이 키를 칩셋으로 알게 한다. 초상·그림은 자르지 않는다. */
export function markChipsetTextureKey(key: string): void {
  if (key) chipsetTextureKeys.add(key);
}

export function chipsetNeedsBands(width: number, height: number): boolean {
  return width > CHIPSET_TEXTURE_MAX_EDGE || height > CHIPSET_TEXTURE_MAX_EDGE;
}

export function chipsetBandColumns(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.ceil(width / CHIPSET_TEXTURE_MAX_EDGE));
}

/** 시트를 덮는 2048 이하 칸. 필요 없으면 null. */
export function chipsetBandRects(width: number, height: number): { x: number; y: number; width: number; height: number; columns: number }[] | null {
  if (!chipsetNeedsBands(width, height) || width <= 0 || height <= 0) return null;
  const bandW = Math.min(width, CHIPSET_TEXTURE_MAX_EDGE);
  const bandH = Math.min(height, CHIPSET_TEXTURE_MAX_EDGE);
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

/** 2D 캔버스로 자른 띠. document 가 없거나 한 장이면 null. */
export function sliceChipsetBandSources(image: SizedImage): { canvases: HTMLCanvasElement[]; columns: number } | null {
  if (typeof document === "undefined") return null;
  const { width, height } = imageSize(image);
  const rects = chipsetBandRects(width, height);
  if (!rects || rects.length < 2) return null;
  const canvases: HTMLCanvasElement[] = [];
  for (const rect of rects) {
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    canvases.push(canvas);
  }
  return { canvases, columns: rects[0]!.columns };
}

export function sliceChipsetBands(image: SizedImage): HTMLCanvasElement[] | null {
  return sliceChipsetBandSources(image)?.canvases ?? null;
}

export function rememberChipsetImage(key: string, image: SizedImage): void {
  if (key) fullSheets.set(key, image);
}

/** 로더가 남긴 시트 전체. GL 소스는 첫 띠뿐이라 이식 굽기는 이것을 쓴다. */
export function rememberedChipsetImage(key: string): SizedImage | null {
  return fullSheets.get(key) ?? null;
}

/** 프레임을 만들기 전에, 기억된 시트가 있으면 텍스처 소스를 띠로 바꾼다. */
export function applyRememberedChipsetBands(texture: BandTexture): void {
  const image = texture.key ? fullSheets.get(texture.key) : undefined;
  if (!image || !texture.setSource || (texture.source?.length ?? 0) > 1) return;
  const sliced = sliceChipsetBandSources(image);
  if (!sliced || sliced.canvases.length < 2) return;
  texture.setSource(sliced.canvases, 0, true);
  texture[BAND_COLUMNS] = sliced.columns;
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

type UploadRuntime = {
  Loader: {
    FILE_PROCESSING: number;
    FileTypes: { ImageFile: { prototype: ImageFileProto } };
  };
};

/**
 * 그림 디코드를 업로드 앞에 두고, 표시된 칩셋이 2048 을 넘으면 첫 띠만 올린다.
 * 나머지 띠는 프레임 등록 때 `applyRememberedChipsetBands` 가 붙인다.
 * 한 번만 깔린다(`__oprnDecode`).
 */
export function installChipsetUploadGuard(PhaserRuntime: UploadRuntime): void {
  const proto = PhaserRuntime.Loader.FileTypes.ImageFile.prototype;
  if (proto.__oprnDecode) return;
  proto.__oprnDecode = true;
  const PROCESSING = PhaserRuntime.Loader.FILE_PROCESSING;
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
      if (chipsetTextureKeys.has(this.key)) {
        try {
          const bands = sliceChipsetBands(image);
          if (bands && bands.length > 1) {
            rememberChipsetImage(this.key, image);
            this.data = bands[0]!;
          }
        } catch (error) {
          console.warn(`[chipset] 시트 띠 나누기 실패: ${this.key}`, error);
        }
      }
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
