// OPRN 이 쓴 타입 선언(원본 pixelfx 에는 타입이 없다). 원본 core/index.js 중 OPRN 이 부르는 것만 적는다.
// 갱신 스크립트(scripts/vendor/sync-pixelfx.mjs)는 core/ 를 통째로 다시 복사하므로 이 파일을 다시 써 둔다.

/** 한 장: w×h 화소, 좌상단이 월드 (ox, oy). color 는 불투명·반투명 화소(ABGR), light 는 더하는 빛(ABGR). */
export interface PixelFxFrame {
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
  readonly color: Uint32Array;
  readonly light: Uint32Array;
}

export interface PixelFxMeta {
  readonly name?: string;
  readonly desc?: string;
  readonly tags?: readonly string[];
  readonly size?: readonly [number, number];
  readonly origin?: readonly [number, number];
  readonly duration?: number;
  readonly loop?: boolean;
  readonly fps?: number;
  readonly actor?: number;
  readonly options?: Readonly<Record<string, unknown>>;
}

/** 효과 파일 하나(src/vendor/pixelfx/fx/<분류>/<이름>.js). */
export interface PixelFxModule {
  readonly meta: PixelFxMeta;
  readonly create?: unknown;
  readonly draw?: unknown;
  readonly drawBack?: unknown;
  readonly actorAlpha?: (t: number, o: unknown) => number;
}

/** createFx 옵션. angle 은 라디안, palette 는 어두운→밝은 #hex 띠. */
export interface PixelFxCreateOptions {
  x?: number;
  y?: number;
  flip?: boolean;
  angle?: number;
  seed?: number;
  palette?: readonly string[];
  light?: number;
}

export interface PixelFxInstance {
  readonly meta: PixelFxMeta;
  readonly t: number;
  update(dt: number): void;
  draw(frame: PixelFxFrame, layer?: "back" | "front"): void;
  stop(): void;
  done(): boolean;
}

export function createFrame(w: number, h: number, ox?: number, oy?: number): PixelFxFrame;
export function clearFrame(frame: PixelFxFrame): PixelFxFrame;
export function createFx(mod: PixelFxModule, options?: PixelFxCreateOptions): PixelFxInstance;
export function composite(
  frame: PixelFxFrame,
  out: Uint8ClampedArray,
  bg?: number | Uint32Array | null,
  lightK?: number,
): Uint8ClampedArray;
