// Phaser 4 는 모듈을 평가하면서 틴트용 캔버스를 만든다. happy-dom 의
// getContext("2d") 는 null 이라 onload 가 globalCompositeOperation 에서 죽는다.
// 실제 픽셀이 필요한 테스트가 아니라, 패널 DOM 이 나오기 전에 평가가 통과하면 된다.

const noop = (): undefined => undefined;

function stubContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return new Proxy({ canvas } as CanvasRenderingContext2D, {
    get(target, prop) {
      if (prop in target) return Reflect.get(target, prop);
      // Phaser CanvasFeatures 는 null 이면 기능 미지원으로 넘긴다. undefined 면 .data 에서 죽는다.
      if (prop === "getImageData") return () => null;
      if (prop === "measureText") return () => ({ width: 0 });
      return typeof prop === "string" ? noop : undefined;
    },
    set() {
      return true;
    },
  });
}

if (typeof HTMLCanvasElement !== "undefined") {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
    const real = original.call(this, type as never, options as never);
    return real ?? (type === "2d" || type === "webgl" || type === "webgl2" ? stubContext(this) : null);
  } as HTMLCanvasElement["getContext"];
}
