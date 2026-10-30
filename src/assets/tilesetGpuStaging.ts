// 큰 아틀라스를 GPU 에 줄 띠씩 나눠 올린다 — 한 번에 통째로 올리면(texImage2D) 버들항 2048×4992(40MB)가
// 소프트웨어 GL 에서 0.2~0.9초 메인 스레드를 막는다(2026-10-30 실측). 띠 하나를 시간 상한 안에서 texSubImage2D 로 올리고,
// 다 올리면 그 GL 텍스처를 Phaser 텍스처로 등록한다(tilesetImage.ts ensureTilesetTexture).
//
// Phaser 4 는 모든 그림 텍스처를 위아래를 뒤집어 올리고(TextureSource flipY 기본 true) 프레임 UV 도 그렇게 계산한다
// (Frame.updateUVs: v0 = 1 - y/h). 그래서 띠도 UNPACK_FLIP_Y 로 올리고, 이미지의 y 줄은 텍스처의 (높이 - y - 띠 높이) 줄에 놓는다.
import type Phaser from "phaser";

type Renderer = Phaser.Renderer.WebGL.WebGLRenderer;
export type StagedTextureWrapper = Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;

export interface StagedTextureUpload {
  readonly wrapper: StagedTextureWrapper;
  readonly bitmap: ImageBitmap;
  /** 다 올렸는가. */
  readonly done: boolean;
  /** 문맥 잃음 등으로 그만두었는가 — 그때 wrapper 는 지워졌다. */
  readonly cancelled: boolean;
  /** 상한(ms) 안에서 띠를 올린다. 다 올렸으면 true. */
  step(budgetMs: number): boolean;
  /** 남은 띠를 한 번에 올린다(장소 이동이 기다릴 때). */
  finish(): boolean;
  cancel(): void;
}

/** 첫 띠 높이(줄). 이후 띠는 잰 속도로 상한에 맞춘다. */
const FIRST_BAND_ROWS = 8;
/** 한 번 부를 때 올리는 최대 바이트 — 큰 한 번이 GPU 쪽 대기에 걸리면 상한을 크게 넘는다. */
const MAX_BAND_BYTES = 256 * 1024;

function webglRenderer(scene: Phaser.Scene): Renderer | null {
  const renderer = scene.sys.game.renderer as Partial<Renderer> | null;
  return renderer && renderer.gl && renderer.glTextureUnits && renderer.glWrapper ? renderer as Renderer : null;
}

/** 비어 있는 GL 텍스처를 잡고 띠 올리기를 준비한다. WebGL 이 아니면 null(그때는 통째로 올린다). */
export function stageTextureUpload(scene: Phaser.Scene, bitmap: ImageBitmap, pixels: Uint8ClampedArray, width: number, height: number): StagedTextureUpload | null {
  const renderer = webglRenderer(scene);
  if (!renderer || renderer.gl.isContextLost() || pixels.length !== width * height * 4) return null;
  // 비어 있는 텍스처 — TextureSource.init 이 그림 크기만으로 만들 때와 같은 인자(flipY true).
  const wrapper = renderer.createTextureFromSource(null as unknown as object, width, height, 0, undefined, true);
  if (!wrapper) return null;
  let row = 0;
  let msPerRow = 0;
  let cancelled = false;

  const uploadRows = (rows: number): void => {
    const gl = renderer.gl;
    const count = Math.max(1, Math.min(rows, height - row));
    renderer.glTextureUnits.bind(wrapper, 0);
    renderer.glWrapper.updateTexturing({ texturing: { flipY: wrapper.flipY, premultiplyAlpha: wrapper.pma } });
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, height - row - count, width, count, gl.RGBA, gl.UNSIGNED_BYTE,
      pixels.subarray(row * width * 4, (row + count) * width * 4));
    row += count;
  };

  const stage: StagedTextureUpload = {
    wrapper,
    bitmap,
    get done() { return !cancelled && row >= height; },
    get cancelled() { return cancelled; },
    step(budgetMs) {
      if (cancelled) return false;
      if (renderer.gl.isContextLost()) { stage.cancel(); return false; }
      const start = performance.now();
      while (row < height) {
        const left = budgetMs - (performance.now() - start);
        // 잰 속도로 남은 시간에 맞는 줄 수. 아직 모르면 작은 첫 띠.
        const rows = Math.min(msPerRow > 0 ? Math.floor(left / msPerRow) : FIRST_BAND_ROWS, Math.max(1, Math.floor(MAX_BAND_BYTES / (width * 4))));
        if (rows < 1) break;
        const before = performance.now();
        const rowsBefore = row;
        uploadRows(rows);
        const spent = performance.now() - before;
        // 느린 쪽으로 기운 추정 — 한 번 느렸으면 다음 띠를 줄인다.
        const measured = spent / Math.max(1, row - rowsBefore);
        msPerRow = Math.max(measured, msPerRow * 0.5, 0.0001);
      }
      return stage.done;
    },
    finish() {
      if (cancelled) return false;
      if (renderer.gl.isContextLost()) { stage.cancel(); return false; }
      if (row < height) uploadRows(height - row);
      return stage.done;
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      renderer.deleteTexture(wrapper);
    },
  };
  return stage;
}

/**
 * 다 올린 GL 텍스처를 Phaser 텍스처로 등록한다. 원본 그림(getSourceImage)은 비트맵으로 둔다 — 런타임은 타일 화소를
 * drawImage 로 읽는다(그림자 띠·햇빛·문 상자). 문맥을 잃었다 되살아날 때 Phaser 가 wrapper 를 다시 만들며
 * pixels 를 통째로 올리므로 비트맵을 거기에도 건다.
 */
export function addStagedTexture(scene: Phaser.Scene, key: string, stage: StagedTextureUpload): Phaser.Textures.Texture | null {
  if (!stage.done) return null;
  const texture = scene.textures.addGLTexture(key, stage.wrapper);
  if (!texture) return null;
  const source = texture.source[0];
  if (source) (source as unknown as { image: unknown }).image = stage.bitmap;
  (stage.wrapper as unknown as { pixels: unknown }).pixels = stage.bitmap;
  return texture;
}
