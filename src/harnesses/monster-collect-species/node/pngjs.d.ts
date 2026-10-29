// pngjs 는 타입을 싣지 않는다. 하네스·QA 스크립트가 쓰는 부분만 적는다.
declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG): Buffer;
    };
    /** 사각 영역 복사(pngjs lib/png.js PNG.bitblt) — qa-game render·doorwayArchCheck 가 쓴다. */
    static bitblt(src: PNG, dst: PNG, srcX: number, srcY: number, width: number, height: number, deltaX: number, deltaY: number): void;
  }
}
