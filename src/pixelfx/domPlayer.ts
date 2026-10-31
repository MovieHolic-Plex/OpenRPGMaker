// pixelfx 효과를 DOM <canvas> 하나로 튼다 — 전투 무대(battleAnimationDom)와 편집기 미리보기·고르기 창이 같이 쓴다.
// 캔버스는 효과의 게임 화소 크기이고 CSS 로 정수배 확대한다(image-rendering: pixelated). 원점이 래퍼의 (0,0)에 오게
// 캔버스를 음수로 민다 — 놓는 쪽은 래퍼를 앵커 점에 두기만 하면 된다.
import type { PixelFxSpec } from "@/project/types";
import { loadPixelFxModule } from "@/pixelfx/modules";
import { PixelFxRenderer } from "@/pixelfx/renderer";

export interface PixelFxDomOptions {
  /** CSS 화소 / 게임 화소. 전투 무대는 2(640×480 논리 = 320×240 의 두 배). 1 보다 작으면 줄여 보인다(고르기 창 칸). */
  readonly pixelScale: number;
  /** 한 번 효과를 끝나면 처음부터 다시(미리보기). 반복 효과는 늘 돈다. */
  readonly repeat?: boolean;
  /** 이 시간이 지나면 멈추고 사라지며 끝낸다(ms). 생략 = 효과 길이. */
  readonly maxMs?: number;
  /** 원점 대신 캔버스 가운데를 래퍼 (0,0)에 둔다(미리보기 칸 가운데 정렬). */
  readonly centered?: boolean;
}

export interface PixelFxDomPlayback {
  /** 크기 0 의 래퍼. 앵커 점에 놓는다(position:absolute 부모 안). */
  readonly element: HTMLElement;
  /** 효과가 끝나면 풀린다(반복 미리보기는 destroy 때). */
  readonly finished: Promise<void>;
  /** 효과를 불러 첫 장을 그렸으면 true(없는 효과면 false). */
  readonly ready: Promise<boolean>;
  destroy(): void;
}

export function mountPixelFxDom(spec: PixelFxSpec, options: PixelFxDomOptions): PixelFxDomPlayback {
  const element = document.createElement("div");
  element.className = "pixel-fx";
  element.dataset.pixelFx = spec.effectId;
  element.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;image-rendering:pixelated;image-rendering:crisp-edges";
  element.append(canvas);

  let raf = 0;
  let destroyed = false;
  let finish: () => void = () => {};
  const finished = new Promise<void>((resolve) => { finish = resolve; });

  const ready = loadPixelFxModule(spec.effectId).then((mod) => {
    if (!mod || destroyed) { finish(); return false; }
    const scale = Math.max(0.1, options.pixelScale) * (spec.scale ?? 1);
    let renderer = new PixelFxRenderer(mod, spec);
    const { width, height, anchorX, anchorY } = renderer.layout;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    const offX = options.centered ? -width / 2 : -anchorX + (spec.offsetX ?? 0);
    const offY = options.centered ? -height / 2 : -anchorY + (spec.offsetY ?? 0);
    canvas.style.left = `${offX * scale}px`;
    canvas.style.top = `${offY * scale}px`;
    element.dataset.pixelFxSize = `${width}x${height}`;
    const ctx = canvas.getContext("2d");
    if (!ctx) { finish(); return false; }
    const image = ctx.createImageData(width, height);
    const frameSec = 1 / renderer.fps;
    const limitMs = options.maxMs ?? (renderer.loop && !options.repeat ? renderer.durationSec * 1000 / renderer.speed : Infinity);
    let last = performance.now();
    const start = last;
    let shownFrame = -1;
    let stopping = false;
    const draw = (): void => {
      renderer.paintComposite("all", image);
      ctx.putImageData(image, 0, 0);
    };
    draw();
    let connected = false;
    const tick = (now: number): void => {
      if (destroyed) return;
      // 화면에서 떼어졌으면(폼 다시 그리기·대화상자 닫기) 스스로 멈춘다 — destroy 를 못 받은 미리보기가 rAF 를 붙잡지 않게.
      if (element.isConnected) connected = true;
      else if (connected) { destroyed = true; finish(); return; }
      const dt = (now - last) / 1000;
      last = now;
      renderer.advance(dt);
      if (!stopping && now - start >= limitMs) { stopping = true; renderer.stop(); }
      if (renderer.done()) {
        if (options.repeat && !stopping) {
          renderer = new PixelFxRenderer(mod, spec);
          shownFrame = -1;
        } else {
          ctx.clearRect(0, 0, width, height);
          finish();
          return;
        }
      }
      // 효과 fps(대개 30)로만 다시 그린다 — 60Hz 화면에서 그리기 비용이 반이다. 시뮬레이션은 advance 가 매번 걷는다.
      const frame = Math.floor(renderer.time / frameSec);
      if (frame !== shownFrame) { shownFrame = frame; draw(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return true;
  });

  return {
    element,
    finished,
    ready,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      element.remove();
      finish();
    },
  };
}

/**
 * 효과의 한 장면(t 초)을 캔버스에 그린다 — 고르기 창의 정지 견본. 캔버스 크기는 효과 크기로 맞춘다.
 * 시뮬레이션 효과는 0 초부터 걸어가야 하므로 t 가 클수록 비싸다(효과당 수 ms).
 */
export async function renderPixelFxStill(spec: PixelFxSpec, canvas: HTMLCanvasElement, atFraction = 0.35): Promise<boolean> {
  const mod = await loadPixelFxModule(spec.effectId);
  if (!mod) return false;
  const renderer = new PixelFxRenderer(mod, spec);
  const { width, height } = renderer.layout;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const image = ctx.createImageData(width, height);
  // 그 순간이 빈 장(아직 안 켜졌거나 다 꺼진 효과)이면 뒤로 걸어가며 처음 그려지는 장을 쓴다.
  // 시뮬레이션은 화면 프레임 간격으로 걷는다(advance 는 한 번에 0.25 초까지).
  let t = 0;
  for (const fraction of [atFraction, 0.55, 0.75, 0.9]) {
    const target = renderer.durationSec * fraction;
    for (; t < target; t += 1 / 30) renderer.advance(Math.min(1 / 30, target - t));
    image.data.fill(0);
    if (renderer.paintComposite("all", image)) break;
  }
  ctx.putImageData(image, 0, 0);
  return true;
}
