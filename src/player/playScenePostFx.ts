import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import { ensureFilterShaderNode } from "@/player/playSceneFilterShader";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { resolvePostFx, type MapPostFx, type ResolvedPostFx } from "@/project/postFx";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";

/**
 * HD-2D 화면 전체 필름 후처리 렌더러 — 단일 Phaser 4 카메라 필터(`OprnFilmicPostFx`).
 *
 * - 원본 타일셋·캐릭터·156종 상호작용 기물 픽셀을 바꾸지 않고, 카메라 출력에
 *   ① 상하 틸트시프트 심도(DoF) ② 3-way 필름 색보정(LUT) ③ 발광체(Emissive) 고유색 보존
 *   ④ 발광 블룸(Bloom) ⑤ 대각선 햇살(God-rays) ⑥ 필름 비네트를 1패스로 합성한다.
 * - 대화창·메뉴·HUD는 DOM 층이라 선명하게 유지된다.
 */

const FILTER_NODE = "OprnFilmicPostFx";

const FRAG_SHADER = `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uTexel;
uniform float uIntensity;
uniform vec3 uSatContrastExpose;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform vec4 uParams; // x=bloom, y=dof, z=godRays, w=vignette
uniform vec3 uRayColor;
uniform float uPreserveEmissive;
varying vec2 outTexCoord;

float emissiveWeight(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float chroma = maxC - minC;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float coloredGlow = smoothstep(0.66, 0.92, maxC) * smoothstep(0.22, 0.48, chroma);
  float hotCore = smoothstep(0.90, 0.99, lum) * 0.65;
  return clamp(max(coloredGlow, hotCore), 0.0, 1.0);
}

vec3 filmicGrade(vec3 src) {
  vec3 x = clamp(src * uSatContrastExpose.z, 0.0, 1.0);
  float lum = dot(x, vec3(0.299, 0.587, 0.114));
  x = mix(vec3(lum), x, uSatContrastExpose.x);
  x = clamp((x - 0.5) * uSatContrastExpose.y + 0.5, 0.0, 1.0);
  x = clamp(x * (1.0 - uLift) + uLift, 0.0, 1.0);
  x = pow(max(x, vec3(0.0001)), 1.0 / max(uGamma, vec3(0.05)));
  return clamp(x * uGain, 0.0, 1.0);
}

vec3 sampleBlur(vec2 uv, vec2 r) {
  vec3 acc = texture2D(uMainSampler, uv).rgb * 0.24;
  acc += texture2D(uMainSampler, clamp(uv + vec2( r.x,  0.0), 0.0, 1.0)).rgb * 0.11;
  acc += texture2D(uMainSampler, clamp(uv + vec2(-r.x,  0.0), 0.0, 1.0)).rgb * 0.11;
  acc += texture2D(uMainSampler, clamp(uv + vec2( 0.0,  r.y), 0.0, 1.0)).rgb * 0.11;
  acc += texture2D(uMainSampler, clamp(uv + vec2( 0.0, -r.y), 0.0, 1.0)).rgb * 0.11;
  acc += texture2D(uMainSampler, clamp(uv + vec2( r.x,  r.y) * 0.72, 0.0, 1.0)).rgb * 0.08;
  acc += texture2D(uMainSampler, clamp(uv + vec2(-r.x,  r.y) * 0.72, 0.0, 1.0)).rgb * 0.08;
  acc += texture2D(uMainSampler, clamp(uv + vec2( r.x, -r.y) * 0.72, 0.0, 1.0)).rgb * 0.08;
  acc += texture2D(uMainSampler, clamp(uv + vec2(-r.x, -r.y) * 0.72, 0.0, 1.0)).rgb * 0.08;
  return acc;
}

vec3 brightTap(vec2 uv) {
  vec3 s = texture2D(uMainSampler, clamp(uv, 0.0, 1.0)).rgb;
  float em = emissiveWeight(s);
  float maxC = max(s.r, max(s.g, s.b));
  float gate = max(em, smoothstep(0.76, 0.98, maxC) * 0.45);
  return s * gate;
}

void main() {
  vec2 uv = outTexCoord;
  vec4 orig = texture2D(uMainSampler, uv);
  vec3 base = orig.rgb;

  // 1. 상하 틸트시프트 심도(DoF) — 중앙 67%는 도트 100% 선명, 상단 22%·하단 11%만 은은히 흐림
  if (uParams.y > 0.005) {
    float topBand = clamp((0.22 - uv.y) / 0.22, 0.0, 1.0);
    float botBand = clamp((uv.y - 0.89) / 0.11, 0.0, 1.0);
    float dofMask = clamp(pow(topBand, 1.6) + pow(botBand, 1.6), 0.0, 0.85) * uParams.y;
    if (dofMask > 0.01) {
      vec3 blurred = sampleBlur(uv, uTexel * (1.8 + 2.4 * dofMask));
      base = mix(base, blurred, dofMask);
    }
  }

  // 2. 3-way 필름 색보정 + 발광체(불·촛불·네온) 고유색 보존
  vec3 graded = filmicGrade(base);
  float em = emissiveWeight(orig.rgb);
  vec3 col = mix(graded, min(orig.rgb * 1.10, vec3(1.0)), em * uPreserveEmissive);

  // 3. 발광체 중심 블룸(Bloom) — 어두운 밤·공포·던전에서도 불빛만 부드럽게 번짐
  if (uParams.x > 0.005) {
    vec2 r1 = uTexel * 3.0;
    vec2 r2 = uTexel * 6.5;
    vec3 b = brightTap(uv) * 0.20;
    b += (brightTap(uv + vec2( r1.x,  0.0)) + brightTap(uv + vec2(-r1.x,  0.0)) +
          brightTap(uv + vec2( 0.0,  r1.y)) + brightTap(uv + vec2( 0.0, -r1.y))) * 0.11;
    b += (brightTap(uv + vec2( r2.x,  r2.y) * 0.7) + brightTap(uv + vec2(-r2.x,  r2.y) * 0.7) +
          brightTap(uv + vec2( r2.x, -r2.y) * 0.7) + brightTap(uv + vec2(-r2.x, -r2.y) * 0.7)) * 0.09;
    vec3 bloomAdd = clamp(b * uParams.x * 1.15, 0.0, 0.85);
    col = 1.0 - (1.0 - col) * (1.0 - bloomAdd);
  }

  // 4. 대각선 햇살 (God-rays)
  if (uParams.z > 0.005) {
    float diag = uv.x * 0.80 - uv.y * 0.56;
    float b1 = exp(-pow((diag - 0.04) / 0.11, 2.0)) * 0.82;
    float b2 = exp(-pow((diag - 0.34) / 0.09, 2.0)) * 0.68;
    float b3 = exp(-pow((diag + 0.24) / 0.10, 2.0)) * 0.56;
    float topFade = clamp(1.0 - uv.y * 0.84, 0.0, 1.0);
    col = clamp(col + (b1 + b2 + b3) * topFade * uRayColor * uParams.z, 0.0, 1.0);
  }

  // 5. 필름 비네트
  if (uParams.w > 0.005) {
    vec2 v = (uv - 0.5) * 2.0;
    float vr = length(v);
    float vig = 1.0 - pow(clamp((vr - 0.54) / 0.92, 0.0, 1.0), 1.8) * uParams.w;
    col *= vig;
  }

  gl_FragColor = vec4(mix(orig.rgb, clamp(col, 0.0, 1.0), uIntensity), orig.a);
}
`;

type PostFxController = Phaser.Filters.Controller & {
  texelX: number;
  texelY: number;
  intensity: number;
  sat: number;
  contrast: number;
  expose: number;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  bloom: number;
  dof: number;
  godRays: number;
  vignette: number;
  rayColor: [number, number, number];
  preserveEmissive: number;
};

type PostFxState = {
  filter: PostFxController | null;
};

const states = new WeakMap<object, PostFxState>();
let warnedNoWebgl = false;
let liveOverride: MapPostFx | null = null;

/** 테스트·라이브 미리보기용 런타임 임시 오버라이드. null 이면 맵/시스템 설정으로 되돌린다. */
export function setRuntimePostFxOverride(override: MapPostFx | null): void {
  liveOverride = override;
}

function webglNodes(scene: PlaySceneContext): Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager | null {
  const renderer = scene.game.renderer;
  if (!("renderNodes" in renderer)) return null;
  return renderer.renderNodes;
}

function ensureFilterNode(scene: PlaySceneContext): boolean {
  const nodes = webglNodes(scene);
  if (!nodes) return false;
  return ensureFilterShaderNode(nodes, {
    name: FILTER_NODE,
    fragmentSource: FRAG_SHADER,
    setupUniforms(node, controller) {
      const fx = controller as PostFxController;
      node.programManager.setUniform("uTexel", [fx.texelX, fx.texelY]);
      node.programManager.setUniform("uIntensity", fx.intensity);
      node.programManager.setUniform("uSatContrastExpose", [fx.sat, fx.contrast, fx.expose]);
      node.programManager.setUniform("uLift", fx.lift);
      node.programManager.setUniform("uGamma", fx.gamma);
      node.programManager.setUniform("uGain", fx.gain);
      node.programManager.setUniform("uParams", [fx.bloom, fx.dof, fx.godRays, fx.vignette]);
      node.programManager.setUniform("uRayColor", fx.rayColor);
      node.programManager.setUniform("uPreserveEmissive", fx.preserveEmissive);
    },
  });
}

function applyResolved(scene: PlaySceneContext, state: PostFxState, resolved: ResolvedPostFx): void {
  const camera = scene.cameras?.main;
  if (!camera?.filters?.internal) return;

  if (!resolved.active) {
    if (state.filter) {
      camera.filters.internal.remove(state.filter);
      state.filter = null;
    }
    return;
  }

  if (!ensureFilterNode(scene)) {
    if (!warnedNoWebgl) {
      warnedNoWebgl = true;
      console.warn("[player] HD-2D 필름 후처리 셰이더를 켤 수 없어 건너뜁니다(WebGL 아님 또는 셰이더 컴파일 실패).");
    }
    return;
  }

  if (!state.filter) {
    const filter = new (getLoadedPhaser()).Filters.Controller(camera, FILTER_NODE) as PostFxController;
    filter.texelX = 1 / 640;
    filter.texelY = 1 / 360;
    filter.intensity = 1;
    filter.sat = 1;
    filter.contrast = 1;
    filter.expose = 1;
    filter.lift = [0, 0, 0];
    filter.gamma = [1, 1, 1];
    filter.gain = [1, 1, 1];
    filter.bloom = 0;
    filter.dof = 0;
    filter.godRays = 0;
    filter.vignette = 0;
    filter.rayColor = [1, 1, 1];
    filter.preserveEmissive = 1;
    camera.filters.internal.add(filter);
    state.filter = filter;
  }

  const w = Math.max(64, camera.width || 640);
  const h = Math.max(64, camera.height || 360);
  const f = state.filter;

  // 날씨·밤 자동 정합 보정(adaptWeather): 비·폭풍·안개·밤에는 대각선 햇살(godRays)만 부드럽게 꺼서
  // 물리적 모순을 막고, 어둠·비네트는 공포 게임의 짙은 암흑 연출 여지를 그대로 보존한다.
  let godRays = resolved.godRays;
  let bloom = resolved.bloom;
  if (resolved.adaptWeather && godRays > 0.001) {
    const weather = scene.weatherDisplayed;
    if (weather && (weather.kind === "rain" || weather.kind === "storm" || weather.kind === "fog")) {
      const atten = Math.max(0, 1 - Math.min(1, weather.intensity * 1.35));
      godRays *= atten;
    }
    const project = store.getCurrent();
    const timeSys = resolveTimeSystem(project);
    if (timeSys?.enabled && scene.session?.gameTime) {
      const phase = timePhaseFor(scene.session.gameTime);
      if (phase === "night") {
        godRays = 0;
        bloom = Math.min(1, bloom + 0.08);
      }
    }
  }

  f.texelX = 1 / w;
  f.texelY = 1 / h;
  f.intensity = resolved.intensity;
  f.sat = resolved.sat;
  f.contrast = resolved.contrast;
  f.expose = resolved.expose;
  f.lift = [resolved.lift[0], resolved.lift[1], resolved.lift[2]];
  f.gamma = [resolved.gamma[0], resolved.gamma[1], resolved.gamma[2]];
  f.gain = [resolved.gain[0], resolved.gain[1], resolved.gain[2]];
  f.bloom = bloom;
  f.dof = resolved.dof;
  f.godRays = godRays;
  f.vignette = resolved.vignette;
  f.rayColor = [resolved.rayColor[0], resolved.rayColor[1], resolved.rayColor[2]];
  f.preserveEmissive = resolved.preserveEmissive ? 1 : 0;
}

/** 매 프레임 맵/시스템의 `postFx` 설정을 카메라 WebGL 후처리 필터에 동기화한다. */
export function updatePostFx(scene: PlaySceneContext): void {
  let state = states.get(scene);
  if (!state) {
    state = { filter: null };
    states.set(scene, state);
    const cleanup = (): void => {
      if (state?.filter && scene.cameras?.main?.filters?.internal) {
        scene.cameras.main.filters.internal.remove(state.filter);
      }
      if (state) state.filter = null;
      states.delete(scene);
    };
    scene.events?.once?.("shutdown", cleanup);
    scene.events?.once?.("destroy", cleanup);
  }
  const project = store.getCurrent();
  const effectiveMapFx = liveOverride ?? scene.map?.postFx;
  const resolved = resolvePostFx(effectiveMapFx, project?.system?.postFx);
  applyResolved(scene, state, resolved);
}
