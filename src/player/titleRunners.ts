// player/titleRunners.ts
// 타이틀을 가로질러 달리는 캐릭터 칩(TitleScreenSettings.runners) — canvas rAF 렌더러.
//
// 계약:
//  - 위치·걸음 프레임은 시각 t(ms)의 순수 함수다(titleRunnerFrameAt). 같은 입력은 같은 프레임.
//  - 좌표는 타이틀 논리 좌표 320×240. canvas 도 그 크기로 만들고 CSS 로 늘린다(파티클과 같은 판).
//  - 24×32 칸 RM2000 시트(12열 8행, 288×256). 맵 배경색(좌상단 화소)을 지운 사본으로 그린다.
//  - 그림을 못 읽으면 조용히 그리지 않는다. fakeDom(getContext null)·reduced-motion 이면 정지 프레임도 그리지 않는다.
//  - canvas 가 DOM 에서 떨어지면 다음 프레임에 rAF 가 스스로 멈춘다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { keyedCharset } from "@/player/openingAnimaticRenderer";
import type { Project, TitleRunner } from "@/project/types";
import { TITLE_PARTICLE_STAGE } from "@/player/titleParticles";

const CELL = { width: 24, height: 32 } as const;
const COLUMNS = 12;
const DEFAULT_SPEED = 60;
const DEFAULT_EVERY_MS = 12000;
/** 걸음 한 번(발 바꿈)마다 달린 거리 — 배율 1에서 8px. */
const STRIDE_PX = 8;

export type TitleRunnerFrame = {
  readonly x: number;
  readonly y: number;
  /** 시트 안 칸 번호(행*12+열). */
  readonly cell: number;
  readonly width: number;
  readonly height: number;
};

/** 시각 t 의 한 달리기 칩. 화면 밖(대기 중)이면 null. */
export function titleRunnerFrameAt(runner: TitleRunner, timeMs: number, width: number = TITLE_PARTICLE_STAGE.width): TitleRunnerFrame | null {
  const scale = runner.scale ?? 1, speed = runner.speed ?? DEFAULT_SPEED;
  const w = CELL.width * scale, h = CELL.height * scale;
  const travelMs = ((width + w * 2) / speed) * 1000;
  const every = Math.max(runner.everyMs ?? DEFAULT_EVERY_MS, travelMs);
  const local = timeMs - (runner.delayMs ?? 0);
  if (local < 0) return null;
  const phase = local % every;
  if (phase > travelMs) return null;
  const distance = (phase / 1000) * speed;
  const right = runner.direction !== "left";
  const x = right ? -w + distance : width + w - distance - w;
  const step = Math.floor(distance / (STRIDE_PX * scale));
  // 걷기 세 칸(왼발·서기·오른발)을 서기→오른발→서기→왼발 순서로.
  const column = [1, 2, 1, 0][step % 4]!;
  const index = runner.characterIndex ?? 0;
  // 시트 방향 행: 위0·오른1·아래2·왼3(RM2000). 인물 넷이 한 줄, 두 줄(위·아래 반)로 여덟.
  const facingRow = Math.floor(index / 4) * 4 + (right ? 1 : 3);
  const hop = runner.hop ? (step % 2 === 0 ? 0 : -2 * scale) : 0;
  return {
    x: Math.round(x),
    y: Math.round(runner.y - h + hop),
    cell: facingRow * COLUMNS + (index % 4) * 3 + column,
    width: w,
    height: h,
  };
}

const activeFrames = new WeakMap<HTMLCanvasElement, number>();

/** 달리기 칩 canvas. 같은 설정의 재렌더에서는 fx 스택이 노드를 그대로 옮겨 붙인다. */
export function createTitleRunnersCanvas(runners: readonly TitleRunner[], project: Project): HTMLCanvasElement {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "rm-title-runners";
  canvas.width = TITLE_PARTICLE_STAGE.width;
  canvas.height = TITLE_PARTICLE_STAGE.height;
  canvas.dataset.testid = "title-runners";
  canvas.dataset.titleRunnerCount = String(runners.length);
  const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!context || typeof Image === "undefined") return canvas;
  if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return canvas;
  const sheets = new Map<string, CanvasImageSource>();
  for (const id of new Set(runners.map((runner) => runner.resourceId))) {
    const url = resolveAssetResourceUrl(id, { project });
    if (!url) continue;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => { sheets.set(id, keyedCharset(image)); };
    image.src = url;
  }
  if (typeof requestAnimationFrame !== "function") return canvas;
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  let seenConnected = false;
  const tick = (): void => {
    if (canvas.isConnected) seenConnected = true;
    else if (seenConnected) { activeFrames.delete(canvas); return; }
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    for (const runner of runners) {
      const sheet = sheets.get(runner.resourceId);
      const frame = sheet ? titleRunnerFrameAt(runner, now, canvas.width) : null;
      if (!sheet || !frame) continue;
      const sx = (frame.cell % COLUMNS) * CELL.width, sy = Math.floor(frame.cell / COLUMNS) * CELL.height;
      // 발밑 그림자 한 줄 — 하늘에 뜬 것처럼 보이지 않게.
      context.fillStyle = "rgba(10, 16, 32, 0.35)";
      context.fillRect(frame.x + Math.round(frame.width * 0.25), Math.round(runner.y - 2), Math.round(frame.width * 0.5), 2);
      context.drawImage(sheet, sx, sy, CELL.width, CELL.height, frame.x, frame.y, frame.width, frame.height);
    }
    activeFrames.set(canvas, requestAnimationFrame(tick));
  };
  activeFrames.set(canvas, requestAnimationFrame(tick));
  return canvas;
}
