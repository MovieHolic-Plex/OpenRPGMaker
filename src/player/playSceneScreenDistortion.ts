import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  interpolateScreenDistortion,
  NEUTRAL_SCREEN_DISTORTION,
  normalizeScreenDistortion,
  screenDistortionsEqual,
  type ScreenDistortion,
} from "@/project/eventCommands/screenDistortion";

/**
 * 화면 왜곡 렌더러 — 세션의 `m2Runtime.screen.distortion` 을 카메라 후처리로 그린다.
 *
 * - 물결·모자이크: 카메라에 붙이는 **사용자 정의 후처리 파이프라인 하나**(`OprnScreenDistort`).
 *   Phaser 내장 Pixelate 는 칸 네 귀퉁이를 섞어 번져 보여서 SNES 모자이크(딱 떨어지는 블록)가 안 된다.
 *   물결은 HDMA 처럼 **줄마다 가로로** 민다.
 * - 기울기: `camera.setRotation`. 캔버스 렌더러에서도 된다.
 *
 * WebGL 이 아니면(캔버스 렌더러) 물결·모자이크는 그리지 않는다 — 콘솔에 한 번만 알린다.
 * DOM 층(그림·대화창·색조 오버레이)은 캔버스 밖이라 왜곡되지 않는다. 게임 세계만 비튼다.
 *
 * 전환은 씬 시계(`scene.time.now`) 기준이다 — QA 프레임 제어로 굴려도 같은 그림이 나온다.
 */

const PIPELINE_KEY = "OprnScreenDistort";

/** 물결 한 주기의 세로 길이(게임 px). SNES 수중 물결 느낌의 촘촘함. */
const WAVE_PERIOD_PX = 24;
/** 물결이 흐르는 속도(rad/ms). */
const WAVE_SPEED = 0.004;

const FRAG_SHADER = `
#define SHADER_NAME OPRN_SCREEN_DISTORT_FS
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uAmp;
uniform float uLineScale;
uniform float uPhase;
uniform vec2 uBlock;
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord;
  if (uBlock.x > 0.0) uv = (floor(uv / uBlock) + 0.5) * uBlock;
  uv.x += sin(uv.y * uLineScale + uPhase) * uAmp;
  gl_FragColor = texture2D(uMainSampler, clamp(uv, 0.0, 1.0));
}
`;

type DistortPipeline = Phaser.Renderer.WebGL.Pipelines.PostFXPipeline & {
  amp: number;
  lineScale: number;
  phase: number;
  blockX: number;
  blockY: number;
};

type DistortionState = {
  displayed: ScreenDistortion;
  from: ScreenDistortion;
  to: ScreenDistortion;
  startedAt: number;
  durationMs: number;
  pipelineAttached: boolean;
};

const states = new WeakMap<object, DistortionState>();
let pipelineClass: (new (game: Phaser.Game) => DistortPipeline) | null = null;
let warnedNoWebgl = false;

function distortPipelineClass(): new (game: Phaser.Game) => DistortPipeline {
  if (pipelineClass) return pipelineClass;
  const PhaserRuntime = getLoadedPhaser();
  class OprnScreenDistortPipeline extends PhaserRuntime.Renderer.WebGL.Pipelines.PostFXPipeline {
    amp = 0;
    lineScale = 0;
    phase = 0;
    blockX = 0;
    blockY = 0;

    constructor(game: Phaser.Game) {
      super({ game, name: PIPELINE_KEY, fragShader: FRAG_SHADER });
    }

    onPreRender(): void {
      this.set1f("uAmp", this.amp);
      this.set1f("uLineScale", this.lineScale);
      this.set1f("uPhase", this.phase);
      this.set2f("uBlock", this.blockX, this.blockY);
    }
  }
  pipelineClass = OprnScreenDistortPipeline as unknown as new (game: Phaser.Game) => DistortPipeline;
  return pipelineClass;
}

function webglPipelines(scene: PlaySceneContext): Phaser.Renderer.WebGL.PipelineManager | null {
  const renderer = scene.renderer as Partial<Phaser.Renderer.WebGL.WebGLRenderer>;
  return renderer && "pipelines" in renderer && renderer.pipelines ? renderer.pipelines : null;
}

function targetOf(scene: PlaySceneContext): ScreenDistortion {
  const raw = scene.session.m2Runtime?.screen.distortion;
  return raw ? normalizeScreenDistortion(raw) : NEUTRAL_SCREEN_DISTORTION;
}

/** 매 프레임. 목표가 바뀌면 지금 보이는 값에서 새 전환을 시작하고, 진행분을 카메라에 적용한다. */
export function updateScreenDistortion(scene: PlaySceneContext): void {
  const now = scene.time?.now ?? 0;
  const target = targetOf(scene);
  let state = states.get(scene);
  if (!state) {
    // 첫 프레임(새 게임·불러오기)은 전환 없이 그 상태로 선다.
    state = { displayed: target, from: target, to: target, startedAt: now, durationMs: 0, pipelineAttached: false };
    states.set(scene, state);
  } else if (!screenDistortionsEqual(state.to, target)) {
    state.from = state.displayed;
    state.to = target;
    state.startedAt = now;
    state.durationMs = Math.max(0, scene.session.m2Runtime?.screen.distortionDurationMs ?? 0);
  }
  const progress = state.durationMs > 0 ? (now - state.startedAt) / state.durationMs : 1;
  state.displayed = progress >= 1 ? state.to : interpolateScreenDistortion(state.from, state.to, progress);
  applyScreenDistortion(scene, state, now);
}

function applyScreenDistortion(scene: PlaySceneContext, state: DistortionState, now: number): void {
  const camera = scene.cameras.main;
  const shown = state.displayed;
  const radians = (shown.rotate * Math.PI) / 180;
  // Phaser 타입 선언에는 rotation 필드가 없지만 런타임 카메라는 갖고 있다(setRotation 이 쓰는 값).
  if ((camera as unknown as { rotation: number }).rotation !== radians) camera.setRotation(radians);

  const needsShader = shown.wave > 0.01 || shown.mosaic > 1;
  const pipelines = webglPipelines(scene);
  if (!pipelines) {
    if (needsShader && !warnedNoWebgl) {
      warnedNoWebgl = true;
      console.warn("[player] 화면 왜곡(물결·모자이크)은 WebGL 렌더러에서만 그려집니다.");
    }
    return;
  }
  if (!needsShader) {
    if (state.pipelineAttached) {
      camera.removePostPipeline(PIPELINE_KEY);
      state.pipelineAttached = false;
    }
    return;
  }
  if (!pipelines.postPipelineClasses.has(PIPELINE_KEY)) {
    pipelines.addPostPipeline(PIPELINE_KEY, distortPipelineClass() as unknown as typeof Phaser.Renderer.WebGL.Pipelines.PostFXPipeline);
  }
  if (!state.pipelineAttached) {
    camera.setPostPipeline(PIPELINE_KEY);
    state.pipelineAttached = true;
  }
  const attached = camera.getPostPipeline(PIPELINE_KEY);
  const pipeline = (Array.isArray(attached) ? attached[0] : attached) as DistortPipeline | undefined;
  if (!pipeline) return;
  // 셰이더 uv 는 카메라 화면 0~1 이다. 게임 px(월드 px) 단위 세기를 화면에 보이는 월드 크기로 나눈다 —
  // 캔버스 해상도·화면 배율(고해상도 + 줌, 16px 칸 확대)이 무엇이든 «게임 px» 가 같은 크기로 보인다.
  // (캔버스 폭으로 나누던 첫 구현은 칸 확대 프로젝트에서 모자이크가 두 배로 컸다.)
  const viewWidth = Math.max(1, camera.worldView.width || camera.width / Math.max(0.0001, camera.zoom));
  const viewHeight = Math.max(1, camera.worldView.height || camera.height / Math.max(0.0001, camera.zoom));
  pipeline.amp = shown.wave / viewWidth;
  pipeline.lineScale = (2 * Math.PI * viewHeight) / WAVE_PERIOD_PX;
  pipeline.phase = now * WAVE_SPEED;
  pipeline.blockX = shown.mosaic > 1 ? shown.mosaic / viewWidth : 0;
  pipeline.blockY = shown.mosaic > 1 ? shown.mosaic / viewHeight : 0;
}
