import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import { applyStoredCameraState } from "@/player/playSceneCamera";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { boardedVehicleId, vehicleConfig } from "@/project/vehicles";

/**
 * 비행 시점 «의사 모드7» (2026-10-15, FF6급 감사 #31, 승인된 안 A).
 *
 * 비행선을 타고 `system.vehicles[비행선].flightView === "mode7"` 일 때만 켜진다. 생략(기본)이면 이 파일은 아무것도 하지 않는다 —
 * 카메라·필터·세션을 건드리지 않아 옛 프로젝트의 동작과 바이트가 같다.
 *
 * 구성:
 *  1) 카메라를 {@link ZOOM_OUT} 배 멀리 뺀다(더 넓은 세계가 그려진다).
 *  2) WebGL 이면 카메라 필터 `OprnMode7` 이 화면 아래쪽 땅을 원근으로 눕힌다 — 위로 갈수록 가로로 넓은 땅을 좁은 줄에 담고(지평선 쪽 축소),
 *     지평선 위는 하늘색으로 채운다. 진짜 모드7 처럼 지도를 회전시키지는 않는다(북쪽이 항상 위).
 *  3) 캔버스(비 WebGL) 렌더러면 멀리 보기(줌 아웃)만 하고 콘솔에 한 번 알린다.
 *  4) 프레임 시간이 평소의 1.8배(최소 34ms)를 넘으면 필터를 끄고 줌 아웃만 남긴다(60fps 가 안 나오는 기기의 낮은 비용 분기).
 *
 * 알려진 한계(문서화됨): 비행선·주인공 스프라이트도 같은 필터를 지나므로 원근으로 약간 납작해진다(스프라이트 스쿼시).
 * 대화창·그림·색조 오버레이는 캔버스 밖 DOM 이라 왜곡되지 않는다. 카메라 연출 명령이 비행 중 배율을 바꾸면 이 파일이 다시 덮어쓴다.
 * 화면 왜곡(playSceneScreenDistortion)과는 별개 필터라 둘이 같이 켜져도 충돌하지 않는다.
 */

const FILTER_NODE = "OprnMode7";
/** 비행 중 카메라 배율 배수. */
const ZOOM_OUT = 0.5;
/** 지평선이 화면 위에서 몇 % 에 놓이는가. */
const HORIZON = 0.2;
/** 지평선 쪽 땅이 가로로 몇 배 넓게 담기는가(원근 세기). */
const FAR_WIDTH = 1.7;
const SKY_TOP: readonly [number, number, number] = [0.36, 0.58, 0.9];
const SKY_LOW: readonly [number, number, number] = [0.78, 0.88, 0.98];
/** 켠 뒤 이 프레임 수의 평균으로 비용을 잰다. */
const MEASURE_FRAMES = 90;

const FRAG_SHADER = `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform float uHorizon;
uniform float uFar;
uniform vec3 uSkyTop;
uniform vec3 uSkyLow;
varying vec2 outTexCoord;
void main() {
  // 필터 텍스처는 y 가 아래에서 위로 자란다 — 위에서 아래로 읽는 좌표로 뒤집어 쓴다.
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  if (uv.y < uHorizon) {
    float k = uv.y / max(0.0001, uHorizon);
    gl_FragColor = vec4(mix(uSkyTop, uSkyLow, k), 1.0);
    return;
  }
  float t = (uv.y - uHorizon) / (1.0 - uHorizon);
  float near = 1.0 / uFar;
  float z = 1.0 / (t * (1.0 - near) + near);
  float d = (z - 1.0) / max(0.0001, uFar - 1.0);
  float sy = mix(0.62, 0.0, d);
  float sx = 0.5 + (uv.x - 0.5) * z;
  gl_FragColor = texture2D(uMainSampler, clamp(vec2(sx, 1.0 - sy), 0.0, 1.0));
}
`;

type Mode7Controller = Phaser.Filters.Controller;

type Mode7State = {
  active: boolean;
  baseZoom: number;
  filter: Mode7Controller | null;
  /** 필터를 비용 때문에 껐나(이번 탑승에서만). */
  shaderOff: boolean;
  frames: number;
  frameMsSum: number;
};

const states = new WeakMap<object, Mode7State>();
/** 평소(모드7 아닐 때) 프레임 시간의 지수 이동 평균 — 비용 분기의 기준. */
const baselineMs = new WeakMap<object, number>();
let warnedNoWebgl = false;
let warnedSlow = false;

/** 비행 시점이 켜질 조건 — 비행선을 탔고 그 설정이 mode7 이다. */
export function mode7Wanted(scene: PlaySceneContext): boolean {
  if (boardedVehicleId(scene.session) !== "airship") return false;
  return vehicleConfig(store.getCurrent(), "airship")?.flightView === "mode7";
}

function webglNodes(scene: PlaySceneContext): Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager | null {
  const renderer = scene.game.renderer;
  if (!("renderNodes" in renderer)) return null;
  return renderer.renderNodes;
}

function ensureFilterNode(scene: PlaySceneContext): boolean {
  const nodes = webglNodes(scene);
  if (!nodes) return false;
  if (nodes.getNode(FILTER_NODE)) return true;
  const PhaserRuntime = getLoadedPhaser();
  const node = new PhaserRuntime.Renderer.WebGL.RenderNodes.BaseFilterShader(FILTER_NODE, nodes, undefined, FRAG_SHADER);
  const shader = node as Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader & {
    setupUniforms(controller: Phaser.Filters.Controller, _drawingContext: Phaser.Renderer.WebGL.DrawingContext): void;
  };
  shader.setupUniforms = function (_controller, _drawingContext) {
    this.programManager.setUniform("uHorizon", HORIZON);
    this.programManager.setUniform("uFar", FAR_WIDTH);
    this.programManager.setUniform("uSkyTop", [...SKY_TOP]);
    this.programManager.setUniform("uSkyLow", [...SKY_LOW]);
  };
  nodes.addNode(FILTER_NODE, node);
  return true;
}

function setBoundsForZoom(scene: PlaySceneContext, camera: Phaser.Cameras.Scene2D.Camera): void {
  const tile = mapTileSize(scene.map);
  const mapWidth = Math.max(tile, scene.map.width * tile);
  const mapHeight = Math.max(tile, scene.map.height * tile);
  const viewWidth = camera.width / camera.zoom;
  const viewHeight = camera.height / camera.zoom;
  const paddingX = Math.max(0, (viewWidth - mapWidth) / 2);
  const paddingY = Math.max(0, (viewHeight - mapHeight) / 2);
  camera.setBounds(-paddingX, -paddingY, Math.max(viewWidth, mapWidth), Math.max(viewHeight, mapHeight));
}

function detachFilter(scene: PlaySceneContext, state: Mode7State): void {
  if (!state.filter) return;
  scene.cameras.main.filters.internal.remove(state.filter);
  state.filter = null;
}

/** 매 프레임 한 번. 비행 시점이 꺼져 있으면 평소 프레임 시간만 기록하고 돌아온다(비용 거의 0). */
export function updateMode7(scene: PlaySceneContext, deltaMs: number): void {
  let state = states.get(scene);
  const wanted = mode7Wanted(scene);
  if (!wanted && !state?.active) {
    if (deltaMs > 0 && deltaMs < 250) baselineMs.set(scene, baselineMs.has(scene) ? baselineMs.get(scene)! * 0.95 + deltaMs * 0.05 : deltaMs);
    return;
  }
  const camera = scene.cameras.main;
  if (!state) {
    state = { active: false, baseZoom: camera.zoom, filter: null, shaderOff: false, frames: 0, frameMsSum: 0 };
    states.set(scene, state);
  }
  if (!wanted) {
    // 내렸거나 맵이 바뀜 — 필터를 떼고 저작 배율·경계를 되돌린다.
    detachFilter(scene, state);
    state.active = false;
    state.shaderOff = false;
    applyStoredCameraState(scene);
    return;
  }
  if (!state.active) {
    state.active = true;
    state.baseZoom = camera.zoom;
    state.shaderOff = false;
    state.frames = 0;
    state.frameMsSum = 0;
  }
  const desired = state.baseZoom * ZOOM_OUT;
  if (Math.abs(camera.zoom - desired) > 1e-6) {
    camera.setZoom(desired);
    setBoundsForZoom(scene, camera);
  }
  if (state.shaderOff) return;
  if (!ensureFilterNode(scene)) {
    if (!warnedNoWebgl) {
      warnedNoWebgl = true;
      console.warn("[player] 비행 시점(모드7)은 WebGL 렌더러에서만 그려집니다 — 멀리 보기(줌 아웃)만 적용합니다.");
    }
    state.shaderOff = true;
    return;
  }
  if (!state.filter) {
    const filter = new (getLoadedPhaser()).Filters.Controller(camera, FILTER_NODE);
    camera.filters.internal.add(filter);
    state.filter = filter;
  }
  // 비용 분기 — 켠 직후 MEASURE_FRAMES 프레임의 평균이 평소의 1.8배(최소 34ms)를 넘으면 필터를 끈다.
  if (state.frames < MEASURE_FRAMES && deltaMs > 0 && deltaMs < 250) {
    state.frames += 1;
    state.frameMsSum += deltaMs;
    if (state.frames === MEASURE_FRAMES) {
      const average = state.frameMsSum / MEASURE_FRAMES;
      const base = baselineMs.get(scene) ?? 16.7;
      if (average > Math.max(34, base * 1.8)) {
        detachFilter(scene, state);
        state.shaderOff = true;
        if (!warnedSlow) {
          warnedSlow = true;
          console.warn(`[player] 비행 시점(모드7) 필터가 프레임 시간을 ${base.toFixed(1)}ms → ${average.toFixed(1)}ms 로 늘려 끄고 멀리 보기만 남깁니다.`);
        }
      }
    }
  }
}

/** QA·진단용 — 지금 비행 시점이 어떤 상태인가. */
export function mode7Debug(scene: object): { readonly active: boolean; readonly filter: boolean; readonly shaderOff: boolean; readonly frames: number; readonly avgMs: number | null; readonly baselineMs: number | null } {
  const state = states.get(scene);
  return {
    active: state?.active === true,
    filter: state?.filter != null,
    shaderOff: state?.shaderOff === true,
    frames: state?.frames ?? 0,
    avgMs: state && state.frames > 0 ? state.frameMsSum / state.frames : null,
    baselineMs: baselineMs.get(scene) ?? null,
  };
}
