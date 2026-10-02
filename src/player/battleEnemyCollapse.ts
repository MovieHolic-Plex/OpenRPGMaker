/**
 * 적이 쓰러지는 연출(EnemyRecord.collapseEffect) — FF6 픽셀 분해·보스 가라앉기·하얀 점멸·즉시.
 *
 * 왜 캔버스인가: 적 그림은 스킨마다 다른 길로 그려진다(정적 img·도트 시트 배경·확장 배틀러 배경)이고, 격파 CSS 도
 * 스킨마다 특정도가 높은 규칙이 겹쳐 있다(15-juice·27-retro-motion). 쓰러지는 순간의 모습을 캔버스에 떠서
 * 원래 그림은 숨기고(인라인 visibility — 어떤 규칙보다 앞선다) 캔버스만 움직이면 스킨과 무관하게 같은 연출이 된다.
 *
 * 노드의 `data-collapse` 가 연출 이름이다(battleFieldDom.enemyButton 이 레코드에서 심는다). 없으면 아무것도 하지 않고
 * 스킨 기본 소멸이 그대로 돈다. 한 노드에 한 번만 시작한다(`data-collapse-state`).
 */
import { snapshotSprite } from "@/player/battleSpriteSnapshot";
import { ENEMY_COLLAPSE_DURATION_MS, normalizeEnemyCollapseEffect } from "@/project/enemyCollapse";

type CollapseEffect = Exclude<ReturnType<typeof normalizeEnemyCollapseEffect>, undefined>;

const SPRITE_SELECTOR = ".battle-enemy-image";

/** 이 노드가 저작한 연출로 쓰러지면 시작하고 true. 기본 소멸이면 false(호출자가 기본 조각을 뿌린다). */
export function beginEnemyCollapse(node: HTMLElement): boolean {
  const effect = normalizeEnemyCollapseEffect(node.dataset.collapse);
  if (!effect) return false;
  if (node.dataset.collapseState) return true;
  const sprite = node.querySelector<HTMLElement>(SPRITE_SELECTOR);
  if (!sprite) return true;
  node.dataset.collapseState = "playing";
  if (effect === "instant" || prefersReducedMotion()) {
    hideSprite(sprite);
    node.dataset.collapseState = "done";
    return true;
  }
  void prepareShot(node, sprite).then((shot) => {
    hideSprite(sprite);
    if (!shot || !node.isConnected) {
      node.dataset.collapseState = "done";
      return;
    }
    node.append(shot.canvas);
    play(effect, shot, () => {
      shot.canvas.remove();
      node.dataset.collapseState = "done";
    });
  });
  return true;
}

/** 이미 쓰러진 채로 다시 그려진 노드 — 연출 없이 숨긴다. */
export function markEnemyCollapsed(node: HTMLElement): void {
  if (!normalizeEnemyCollapseEffect(node.dataset.collapse)) return;
  const sprite = node.querySelector<HTMLElement>(SPRITE_SELECTOR);
  if (sprite) hideSprite(sprite);
  node.dataset.collapseState = "done";
}

function hideSprite(sprite: HTMLElement): void {
  sprite.style.visibility = "hidden";
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Shot = {
  readonly canvas: HTMLCanvasElement;
  /** 원래 모습(캔버스 해상도). */
  readonly source: HTMLCanvasElement;
  /** 캔버스 px / 레이아웃 px. */
  readonly resolution: number;
};

/** 지금 모습을 뜬 그림 위에 같은 자리·크기의 연출 캔버스를 만든다(그리기는 play 가). */
async function prepareShot(node: HTMLElement, sprite: HTMLElement): Promise<Shot | null> {
  const snapshot = await snapshotSprite(node, sprite);
  if (!snapshot) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "battle-enemy-collapse";
  canvas.dataset.testid = "battle-enemy-collapse";
  canvas.dataset.collapse = node.dataset.collapse ?? "";
  canvas.setAttribute("aria-hidden", "true");
  canvas.width = snapshot.source.width;
  canvas.height = snapshot.source.height;
  Object.assign(canvas.style, {
    position: "absolute",
    left: `${snapshot.box.left}px`,
    top: `${snapshot.box.top}px`,
    width: `${snapshot.box.width}px`,
    height: `${snapshot.box.height}px`,
    pointerEvents: "none",
    zIndex: "2",
    imageRendering: snapshot.smooth ? "auto" : "pixelated",
    // 좌우를 뒤집어 그린 적(측면 배치)은 캔버스도 같은 방향으로.
    transform: snapshot.mirrored ? "scaleX(-1)" : "",
  });
  return { canvas, source: snapshot.source, resolution: snapshot.resolution };
}

function play(effect: CollapseEffect, shot: Shot, done: () => void): void {
  const duration = ENEMY_COLLAPSE_DURATION_MS[effect];
  const context = shot.canvas.getContext("2d");
  if (!context || duration <= 0) {
    done();
    return;
  }
  const draw = effect === "pixelBreak" ? pixelBreak(shot) : effect === "bossSink" ? bossSink(shot) : whiteFlash(shot);
  const started = performance.now();
  const step = (now: number): void => {
    if (!shot.canvas.isConnected) {
      done();
      return;
    }
    const elapsed = now - started;
    const progress = Math.min(1, elapsed / duration);
    context.clearRect(0, 0, shot.canvas.width, shot.canvas.height);
    draw(context, progress, elapsed);
    if (progress < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

type Painter = (context: CanvasRenderingContext2D, progress: number, elapsedMs: number) => void;

/** 원래 그림의 불투명한 픽셀만 한 색으로 칠한 사본. */
function tinted(source: HTMLCanvasElement, color: string, keepImage: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = keepImage ? "source-atop" : "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 결정적 의사 난수 — 같은 덩이는 매 프레임 같은 문턱을 가진다. */
function hash(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * FF6 식 픽셀 분해: 0~18% 동안 보랏빛으로 두 번 번쩍이고, 이후 덩이(4 논리 px)가 위에서부터 흩어지듯 꺼진다.
 * 꺼지기 직전의 덩이는 밝은 분홍으로 반짝인다 — 부서지는 앞줄이 보인다.
 */
function pixelBreak(shot: Shot): Painter {
  const purple = tinted(shot.source, "rgba(176, 72, 255, 0.62)", true);
  const block = Math.max(2, Math.round(4 * shot.resolution));
  const columns = Math.ceil(shot.source.width / block);
  const rows = Math.ceil(shot.source.height / block);
  const thresholds = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      thresholds[index] = 0.18 + 0.8 * ((row / rows) * 0.62 + hash(index) * 0.38);
    }
  }
  return (context, progress, elapsed) => {
    if (progress < 0.18) {
      context.drawImage(Math.floor(elapsed / 70) % 2 === 0 ? purple : shot.source, 0, 0);
      return;
    }
    context.drawImage(purple, 0, 0);
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = "rgba(255, 214, 255, 0.85)";
    for (let index = 0; index < thresholds.length; index += 1) {
      const threshold = thresholds[index]!;
      if (threshold > progress && threshold < progress + 0.07) {
        context.fillRect((index % columns) * block, Math.floor(index / columns) * block, block, block);
      }
    }
    context.globalCompositeOperation = "source-over";
    for (let index = 0; index < thresholds.length; index += 1) {
      if (thresholds[index]! <= progress) {
        context.clearRect((index % columns) * block, Math.floor(index / columns) * block, block, block);
      }
    }
  };
}

/**
 * 보스 가라앉기: 떨면서 붉게 깜빡이고, 줄마다 일렁이며 상자 바닥 아래로 내려간다(바닥이 땅이다).
 * 마지막 15% 는 흐려진다.
 */
function bossSink(shot: Shot): Painter {
  const red = tinted(shot.source, "rgba(255, 48, 48, 0.5)", true);
  const strip = Math.max(1, Math.round(2 * shot.resolution));
  const { width, height } = shot.source;
  return (context, progress, elapsed) => {
    const sink = height * Math.pow(progress, 1.4);
    const shake = Math.sin(elapsed * 0.09) * 3 * shot.resolution * (1 - progress * 0.6);
    const flicker = progress < 0.7 && Math.floor(elapsed / 110) % 2 === 0;
    const image = flicker ? red : shot.source;
    context.globalAlpha = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;
    for (let y = 0; y < height; y += strip) {
      const destY = y + sink;
      if (destY >= height) break;
      const wobble = Math.sin(y / (shot.resolution * 6) + elapsed * 0.014) * 6 * shot.resolution * progress;
      context.drawImage(image, 0, y, width, strip, shake + wobble, destY, width, strip);
    }
    context.globalAlpha = 1;
    // 땅에서 이는 흙먼지 — 바닥 줄에 옅은 덩이.
    context.fillStyle = `rgba(214, 200, 176, ${0.45 * (1 - progress)})`;
    for (let index = 0; index < 9; index += 1) {
      const x = (hash(index + Math.floor(elapsed / 90)) * 0.8 + 0.1) * width;
      const radius = (4 + hash(index * 3) * 6) * shot.resolution;
      context.beginPath();
      context.arc(x, height - radius * 0.6, radius, 0, Math.PI * 2);
      context.fill();
    }
  };
}

/** RM2000 식: 80ms 마다 하얀 실루엣과 빈칸을 번갈아, 끝은 흐려진다. */
function whiteFlash(shot: Shot): Painter {
  const white = tinted(shot.source, "#ffffff", false);
  return (context, progress, elapsed) => {
    if (Math.floor(elapsed / 80) % 2 === 1) return;
    context.globalAlpha = progress > 0.7 ? Math.max(0, (1 - progress) / 0.3) : 1;
    context.drawImage(white, 0, 0);
    context.globalAlpha = 1;
  };
}
