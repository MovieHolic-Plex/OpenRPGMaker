// pngjs 는 타입 선언을 함께 배포하지 않는다(@types/pngjs 도 이 저장소에 없다).
// 스크린샷 픽셀을 읽는 용도로만 쓰므로, 쓰는 표면만 좁게 선언한다.
declare module "pngjs" {
  export class PNG {
    static readonly sync: {
      read(buffer: Buffer): { width: number; height: number; data: Uint8Array };
      write(png: unknown): Buffer;
    };
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Uint8Array;
  }
}
