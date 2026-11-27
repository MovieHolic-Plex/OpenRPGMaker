import type Phaser from "phaser";
import { getLoadedPhaser } from "@/app/phaserRuntime";
import { ensureFilterShaderNode } from "@/player/playSceneFilterShader";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { resolvePostFx, type MapPostFx, type ResolvedPostFx } from "@/project/postFx";
import { resolveTimeSystem, timePhaseFor } from "@/project/gameTime";

/**
 * HD-2D + 2D 공포 통합 화면 후처리 렌더러 — 단일 Phaser 4 카메라 필터(`OprnFilmicPostFx`).
 *
 * 1패스 WebGL 프래그먼트 셰이더로 다음을 함께 처리한다:
 *  ① 상하 틸트시프트 심도(DoF)
 *  ② 가장자리 RGB 색수차(Chromatic Aberration — 공포/추격 패닉 연동)
 *  ③ 3-way 필름 색보정(LUT) + 불·촛불·네온 Emissive 고유색 보존
 *  ④ 발광 블룸(Bloom) + 대각선 햇살(God-rays, 비·폭풍·밤 자동 차단)
 *  ⑤ Signalis풍 4×4 Bayer 레트로 디더링 + 아날로그 필름 그레인
 *  ⑥ 필름 비네트 + 추격자 거리 연동 심장박동(Lub-Dub) 패닉 비네트
 *  ⑦ 옷장·고해실 은신 시 문틈(Slit) 엿보기 시야 마스크
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
uniform vec4 uParams;   // x=bloom, y=dof, z=godRays, w=vignette
uniform vec3 uRayColor;
uniform float uPreserveEmissive;
uniform float uTime;
uniform vec4 uHorror;   // x=grain, y=chromaticAberration, z=bayerDither, w=panic(0..1)
uniform float uHidingSlit;
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

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int x = int(q.x);
  int y = int(q.y);
  int idx = y * 4 + x;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = outTexCoord;
  float panic = uHorror.w;

  // 0. 추격 패닉 시 미세한 아드레날린 화면 흔들림 (VHS/긴장감)
  if (panic > 0.30) {
    float jitterAmp = (panic - 0.30) * 0.0022;
    float lineNoise = hash12(vec2(floor(uv.y * 90.0), floor(uTime * 18.0))) - 0.5;
    uv.x = clamp(uv.x + lineNoise * jitterAmp * step(0.86, hash12(vec2(floor(uTime * 12.0), floor(uv.y * 28.0)))), 0.0, 1.0);
  }

  vec4 orig = texture2D(uMainSampler, uv);
  vec3 base = orig.rgb;

  // 1. 상하 틸트시프트 심도(DoF) — 중앙 67%는 도트 100% 선명
  if (uParams.y > 0.005 && uIntensity > 0.005) {
    float topBand = clamp((0.22 - uv.y) / 0.22, 0.0, 1.0);
    float botBand = clamp((uv.y - 0.89) / 0.11, 0.0, 1.0);
    float dofMask = clamp(pow(topBand, 1.6) + pow(botBand, 1.6), 0.0, 0.85) * uParams.y;
    if (dofMask > 0.01) {
      vec3 blurred = sampleBlur(uv, uTexel * (1.8 + 2.4 * dofMask));
      base = mix(base, blurred, dofMask);
    }
  }

  // 2. 3-way 필름 색보정 + 발광체(불·촛불·네온) 고유색 보존
  vec3 col = base;
  if (uIntensity > 0.005) {
    vec3 graded = filmicGrade(base);
    float em = emissiveWeight(orig.rgb);
    vec3 mixed = mix(graded, min(orig.rgb * 1.10, vec3(1.0)), em * uPreserveEmissive);
    col = mix(base, mixed, uIntensity);

    // 3. 발광체 중심 블룸(Bloom)
    if (uParams.x > 0.005) {
      vec2 r1 = uTexel * 3.0;
      vec2 r2 = uTexel * 6.5;
      vec3 b = brightTap(uv) * 0.20;
      b += (brightTap(uv + vec2( r1.x,  0.0)) + brightTap(uv + vec2(-r1.x,  0.0)) +
            brightTap(uv + vec2( 0.0,  r1.y)) + brightTap(uv + vec2( 0.0, -r1.y))) * 0.11;
      b += (brightTap(uv + vec2( r2.x,  r2.y) * 0.7) + brightTap(uv + vec2(-r2.x,  r2.y) * 0.7) +
            brightTap(uv + vec2( r2.x, -r2.y) * 0.7) + brightTap(uv + vec2(-r2.x, -r2.y) * 0.7)) * 0.09;
      vec3 bloomAdd = clamp(b * uParams.x * 1.15 * uIntensity, 0.0, 0.85);
      col = 1.0 - (1.0 - col) * (1.0 - bloomAdd);
    }

    // 4. 대각선 햇살 (God-rays)
    if (uParams.z > 0.005) {
      float diag = uv.x * 0.80 - uv.y * 0.56;
      float b1 = exp(-pow((diag - 0.04) / 0.11, 2.0)) * 0.82;
      float b2 = exp(-pow((diag - 0.34) / 0.09, 2.0)) * 0.68;
      float b3 = exp(-pow((diag + 0.24) / 0.10, 2.0)) * 0.56;
      float topFade = clamp(1.0 - uv.y * 0.84, 0.0, 1.0);
      col = clamp(col + (b1 + b2 + b3) * topFade * uRayColor * uParams.z * uIntensity, 0.0, 1.0);
    }
  }

  // 5. RGB 색수차 (Chromatic Aberration — 프리셋 + 추격 패닉 가산)
  float caAmt = clamp(uHorror.y * uIntensity + panic * 0.70, 0.0, 1.0);
  if (caAmt > 0.01) {
    vec2 dir = uv - 0.5;
    float edge = smoothstep(0.18, 0.72, length(dir));
    vec2 off = dir * uTexel * (7.5 * caAmt * edge);
    float rCh = texture2D(uMainSampler, clamp(uv + off, 0.0, 1.0)).r;
    float bCh = texture2D(uMainSampler, clamp(uv - off, 0.0, 1.0)).b;
    vec3 caRgb = vec3(rCh, col.g, bCh);
    if (uIntensity > 0.005) {
      caRgb = mix(caRgb, filmicGrade(caRgb), uIntensity * 0.75);
    }
    col = mix(col, caRgb, 0.72 * caAmt * edge);
  }

  // 6. Signalis풍 4×4 Bayer 레트로 디더링 (어두운 음영 경계에 픽셀 도트 결)
  float ditherAmt = uHorror.z * uIntensity;
  if (ditherAmt > 0.01) {
    float lumD = dot(col, vec3(0.299, 0.587, 0.114));
    float shadowZone = 1.0 - smoothstep(0.08, 0.55, lumD);
    float bVal = bayer4(gl_FragCoord.xy * 0.5) - 0.5;
    float steps = mix(24.0, 10.0, ditherAmt);
    vec3 quant = floor((col + bVal / steps) * steps + 0.5) / steps;
    col = mix(col, clamp(quant, 0.0, 1.0), ditherAmt * (0.35 + 0.65 * shadowZone));
  }

  // 7. 아날로그 필름 그레인 (어둠에 은은히 살아 움직이는 입자감)
  float grainAmt = clamp(uHorror.x * uIntensity + panic * 0.24, 0.0, 1.0);
  if (grainAmt > 0.01) {
    float g = hash12(floor(gl_FragCoord.xy * 0.5) + vec2(fract(uTime * 17.3) * 193.0, fract(uTime * 11.7) * 257.0)) - 0.5;
    float lumG = dot(col, vec3(0.299, 0.587, 0.114));
    float darkBoost = 0.55 + 0.65 * (1.0 - lumG);
    col = clamp(col + g * grainAmt * 0.16 * darkBoost, 0.0, 1.0);
  }

  // 8. 필름 비네트 + 추격 심장박동(Lub-Dub) 패닉 비네트
  vec2 v = (uv - 0.5) * 2.0;
  float vr = length(v);
  float baseVig = uParams.w * uIntensity;
  float beatRate = mix(1.25, 2.65, panic);
  float phase = fract(uTime * beatRate);
  float lubDub = exp(-pow((phase - 0.12) / 0.055, 2.0)) + exp(-pow((phase - 0.28) / 0.065, 2.0)) * 0.65;
  float panicVig = panic * (0.42 + 0.24 * lubDub);
  float totalVig = clamp(baseVig + panicVig, 0.0, 0.92);
  if (totalVig > 0.005) {
    float vigStart = mix(0.54, 0.34, panic);
    float vig = 1.0 - pow(clamp((vr - vigStart) / 0.90, 0.0, 1.0), 1.75) * totalVig;
    col *= vig;
  }
  if (panic > 0.05) {
    float redRim = pow(clamp((vr - 0.56) / 0.68, 0.0, 1.0), 1.9) * panic * (0.28 + 0.30 * lubDub);
    col = clamp(col + vec3(0.58, 0.02, 0.05) * redRim, 0.0, 1.0);
  }

  // 9. 옷장·고해실 은신처 문틈(Slit) 엿보기 시야 마스크
  if (uHidingSlit > 0.01) {
    float distX = abs(uv.x - 0.5);
    float slitHalf = mix(0.65, 0.17, uHidingSlit);
    float slitMask = 1.0 - smoothstep(slitHalf - 0.035, slitHalf + 0.055, distX);
    // 미세한 나무 문살 틈새 느낌 (양쪽 어두운 영역에 3%만 실루엣 비침)
    float flank = mix(1.0, 0.035, uHidingSlit);
    float topBot = 1.0 - smoothstep(0.36, 0.52, abs(uv.y - 0.5)) * 0.45 * uHidingSlit;
    col *= mix(flank, 1.0, slitMask) * topBot;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), orig.a);
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
  timeSec: number;
  grain: number;
  chromaticAberration: number;
  bayerDither: number;
  panic: number;
  hidingSlit: number;
};

type PostFxState = {
  filter: PostFxController | null;
  smoothPanic: number;
  smoothSlit: number;
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
      node.programManager.setUniform("uTime", fx.timeSec);
      node.programManager.setUniform("uHorror", [fx.grain, fx.chromaticAberration, fx.bayerDither, fx.panic]);
      node.programManager.setUniform("uHidingSlit", fx.hidingSlit);
    },
  });
}

/** 추격자 거리(8칸→0, 1.2칸→1)와 은신 여부를 읽어 실시간 공포 긴장도(0..1)를 계산한다. */
function computeHorrorReactiveTargets(scene: PlaySceneContext): { readonly panic: number; readonly hiding: number } {
  const horror = scene.session?.horror;
  if (!horror) return { panic: 0, hiding: 0 };
  const mapId = scene.map?.id;
  const hiding = horror.hiding && horror.hiding.mapId === mapId ? 1 : 0;

  let minDist = Infinity;
  const px = scene.tileX;
  const py = scene.tileY;
  for (const [eventId, pursuit] of Object.entries(horror.pursuits)) {
    if (!pursuit?.active) continue;
    const pos = scene.eventPositions?.[eventId]
      ?? scene.session?.eventLocations?.[eventId]
      ?? scene.map?.events.find((e) => e.id === eventId);
    if (!pos) continue;
    if ("mapId" in pos && pos.mapId && pos.mapId !== mapId) continue;
    const d = Math.hypot(pos.x - px, pos.y - py);
    if (d < minDist) minDist = d;
  }

  // 8칸 밖 = 0, 1.2칸 이내 = 1.0 (부드러운 제곱 곡선)
  const rawPanic = Number.isFinite(minDist)
    ? Math.max(0, Math.min(1, (8.0 - minDist) / (8.0 - 1.2)))
    : 0;
  return { panic: rawPanic * rawPanic * (3 - 2 * rawPanic), hiding };
}

function applyResolved(
  scene: PlaySceneContext,
  state: PostFxState,
  resolved: ResolvedPostFx,
  panic: number,
  hidingSlit: number,
): void {
  const camera = scene.cameras?.main;
  if (!camera?.filters?.internal) return;

  const needsShader = resolved.active || panic > 0.015 || hidingSlit > 0.015;
  if (!needsShader) {
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
    filter.intensity = 0;
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
    filter.timeSec = 0;
    filter.grain = 0;
    filter.chromaticAberration = 0;
    filter.bayerDither = 0;
    filter.panic = 0;
    filter.hidingSlit = 0;
    camera.filters.internal.add(filter);
    state.filter = filter;
  }

  const w = Math.max(64, camera.width || 640);
  const h = Math.max(64, camera.height || 360);
  const f = state.filter;

  // 날씨·밤 자동 정합 보정(adaptWeather): 비·폭풍·안개·밤에는 대각선 햇살(godRays)만 부드럽게 차단.
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
  f.intensity = resolved.active ? resolved.intensity : 0;
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
  f.timeSec = (scene.time?.now ?? 0) * 0.001;
  f.grain = resolved.grain;
  f.chromaticAberration = resolved.chromaticAberration;
  f.bayerDither = resolved.bayerDither;
  f.panic = panic;
  f.hidingSlit = hidingSlit;
}

/** 매 프레임 맵/시스템의 `postFx` + 공포 추격·은신 상태를 카메라 WebGL 후처리 필터에 동기화한다. */
export function updatePostFx(scene: PlaySceneContext): void {
  let state = states.get(scene);
  if (!state) {
    state = { filter: null, smoothPanic: 0, smoothSlit: 0 };
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

  const targets = resolved.horrorReactive
    ? computeHorrorReactiveTargets(scene)
    : { panic: 0, hiding: 0 };
  state.smoothPanic += (targets.panic - state.smoothPanic) * 0.12;
  state.smoothSlit += (targets.hiding - state.smoothSlit) * 0.16;
  if (state.smoothPanic < 0.005) state.smoothPanic = 0;
  if (state.smoothSlit < 0.005) state.smoothSlit = 0;

  applyResolved(scene, state, resolved, state.smoothPanic, state.smoothSlit);
}
