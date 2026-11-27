/**
 * HD-2D 화면 전체 필름 후처리(PostFX) 규격 · 10종 톤 프리셋 · 7종 원클릭 시네마틱 콤보 정본.
 *
 * - 원본 타일·캐릭터·156종 상호작용 기물의 픽셀을 건드리지 않고, 카메라 출력 전체를
 *   단일 WebGL 프래그먼트 셰이더(`OprnFilmicPostFx`)로 색보정·블룸·상하 심도(DoF)·햇살·비네트·
 *   필름 그레인·색수차·Bayer 디더링·추격 패닉·은신 문틈 시야까지 1패스로 처리한다.
 * - `preserveEmissive`(기본 true)가 켜져 있으면 모닥불·촛불·화로·네온·수정구 등 자체 발광 픽셀은
 *   전역 LUT에 덮어씌워지지 않고 자기 고유 발광색을 유지한다.
 * - `classic-clean` 콤보와 `none` 프리셋으로 언제든 아무 효과도 없는 순수 클래식 픽셀로 되돌릴 수 있다.
 */
import type { AtmosphereKind } from "./atmosphere";
import type { MapSunlight } from "./sunlight";

export const POST_FX_PRESET_IDS = [
  "none",
  "hd2d-warm",
  "ghibli-day",
  "dawn-mist",
  "gothic-horror",
  "dungeon-torch",
  "cyber-neon",
  "eastern-ink",
  "arctic-blizzard",
  "cataclysm-fire",
] as const;

export type PostFxPresetId = (typeof POST_FX_PRESET_IDS)[number];

export interface MapPostFx {
  preset: PostFxPresetId;
  /** 전체 후처리 강도 0..1 (기본 1). */
  intensity?: number;
  /** 광원 블룸 세기 0..1 (생략 시 프리셋 기본값). */
  bloom?: number;
  /** 상하 틸트시프트 심도(DoF) 세기 0..1 (생략 시 프리셋 기본값). */
  dof?: number;
  /** 대각선 햇살(God-ray) 세기 0..1 (생략 시 프리셋 기본값). */
  godRays?: number;
  /** 가장자리 비네트 세기 0..1 (생략 시 프리셋 기본값). */
  vignette?: number;
  /** 아날로그 필름 그레인 0..1 (공포·필름 질감, 생략 시 프리셋 기본값). */
  grain?: number;
  /** 가장자리 RGB 색수차 0..1 (생략 시 프리셋 기본값). */
  chromaticAberration?: number;
  /** Signalis풍 4×4 Bayer 레트로 디더링 0..1 (어둠 경계 픽셀 질감). */
  bayerDither?: number;
  /** 불·촛불·네온 등 발광체 고유색 보존 (기본 true). */
  preserveEmissive?: boolean;
  /** 비·폭풍·안개·밤일 때 대각선 햇살(godRays)을 자동으로 끄는 물리 정합 보정 (기본 true). */
  adaptWeather?: boolean;
  /** 추격자 거리(심장박동 비네트·색수차) 및 옷장 은신(문틈 시야) 자동 반응 (기본 true). */
  horrorReactive?: boolean;
  /** 모닥불·촛대·조명 옆을 지날 때 주인공 스프라이트 림라이트 물듦 (기본 true). */
  spriteRimLight?: boolean;
}

export interface PostFxPresetSpec {
  readonly id: PostFxPresetId;
  readonly label: string;
  readonly summary: string;
  readonly sat: number;
  readonly contrast: number;
  readonly expose: number;
  readonly lift: readonly [number, number, number];
  readonly gamma: readonly [number, number, number];
  readonly gain: readonly [number, number, number];
  readonly rayColor: readonly [number, number, number];
  readonly bloom: number;
  readonly dof: number;
  readonly godRays: number;
  readonly vignette: number;
  readonly grain: number;
  readonly chromaticAberration: number;
  readonly bayerDither: number;
}

export const POST_FX_PRESETS: Readonly<Record<PostFxPresetId, PostFxPresetSpec>> = {
  none: {
    id: "none",
    label: "없음 (원본)",
    summary: "무보정 클래식 픽셀",
    sat: 1.0,
    contrast: 1.0,
    expose: 1.0,
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    rayColor: [1, 1, 1],
    bloom: 0,
    dof: 0,
    godRays: 0,
    vignette: 0,
    grain: 0,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "hd2d-warm": {
    id: "hd2d-warm",
    label: "황혼 필름 (옥토패스풍)",
    summary: "판타지 · 마을 · 광장 · 저채도 웜톤",
    sat: 0.74,
    contrast: 1.14,
    expose: 0.96,
    lift: [0.022, 0.02, 0.075],
    gamma: [1.04, 0.99, 0.90],
    gain: [1.11, 1.01, 0.86],
    rayColor: [1.0, 0.84, 0.54],
    bloom: 0.36,
    dof: 0.58,
    godRays: 0.16,
    vignette: 0.42,
    grain: 0.05,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "ghibli-day": {
    id: "ghibli-day",
    label: "맑은 낮 (화사함)",
    summary: "모험 · 일상 · 몬스터 · 부드러운 햇살",
    sat: 0.94,
    contrast: 1.06,
    expose: 1.03,
    lift: [0.014, 0.03, 0.045],
    gamma: [1.01, 1.03, 0.98],
    gain: [1.05, 1.04, 0.97],
    rayColor: [1.0, 0.97, 0.84],
    bloom: 0.26,
    dof: 0.38,
    godRays: 0.13,
    vignette: 0.20,
    grain: 0,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "dawn-mist": {
    id: "dawn-mist",
    label: "새벽 여명",
    summary: "감성 · 연애 · 라벤더빛 안개",
    sat: 0.78,
    contrast: 1.09,
    expose: 1.00,
    lift: [0.055, 0.038, 0.105],
    gamma: [1.04, 1.00, 1.04],
    gain: [1.08, 1.01, 1.04],
    rayColor: [1.0, 0.86, 0.96],
    bloom: 0.34,
    dof: 0.52,
    godRays: 0.20,
    vignette: 0.32,
    grain: 0.04,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "gothic-horror": {
    id: "gothic-horror",
    label: "고딕 공포",
    summary: "호러 · 저택 · 폐병원 · 필름 그레인 & 청회색",
    sat: 0.38,
    contrast: 1.24,
    expose: 0.72,
    lift: [0.014, 0.044, 0.092],
    gamma: [0.84, 0.95, 1.08],
    gain: [0.74, 0.86, 1.03],
    rayColor: [0.42, 0.68, 0.92],
    bloom: 0.44,
    dof: 0.60,
    godRays: 0.0,
    vignette: 0.62,
    grain: 0.26,
    chromaticAberration: 0.18,
    bayerDither: 0.20,
  },
  "dungeon-torch": {
    id: "dungeon-torch",
    label: "던전 횃불",
    summary: "던전 · 동굴 · 지하묘지 · 불빛 강조",
    sat: 0.66,
    contrast: 1.20,
    expose: 0.68,
    lift: [0.016, 0.018, 0.064],
    gamma: [0.90, 0.88, 0.94],
    gain: [0.88, 0.82, 0.86],
    rayColor: [1.0, 0.75, 0.45],
    bloom: 0.54,
    dof: 0.48,
    godRays: 0.0,
    vignette: 0.66,
    grain: 0.14,
    chromaticAberration: 0.06,
    bayerDither: 0.12,
  },
  "cyber-neon": {
    id: "cyber-neon",
    label: "사이버 네온",
    summary: "현대 야경 · SF · 시안/마젠타 네오누아르",
    sat: 1.04,
    contrast: 1.20,
    expose: 0.78,
    lift: [0.012, 0.052, 0.115],
    gamma: [0.90, 0.98, 1.12],
    gain: [1.08, 0.94, 1.15],
    rayColor: [0.88, 0.40, 0.92],
    bloom: 0.54,
    dof: 0.52,
    godRays: 0.08,
    vignette: 0.52,
    grain: 0.12,
    chromaticAberration: 0.22,
    bayerDither: 0,
  },
  "eastern-ink": {
    id: "eastern-ink",
    label: "동양 한지·노을",
    summary: "조선 · 무림 · 사극 · 먹빛과 따뜻한 한지톤",
    sat: 0.60,
    contrast: 1.12,
    expose: 0.96,
    lift: [0.042, 0.036, 0.028],
    gamma: [1.04, 0.99, 0.89],
    gain: [1.08, 1.02, 0.87],
    rayColor: [1.0, 0.90, 0.70],
    bloom: 0.28,
    dof: 0.48,
    godRays: 0.13,
    vignette: 0.40,
    grain: 0.10,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "arctic-blizzard": {
    id: "arctic-blizzard",
    label: "설원 빙청 (북방 야영)",
    summary: "설원 · 생존 · 차가운 빙청 배경 + 모닥불 대비",
    sat: 0.50,
    contrast: 1.10,
    expose: 0.94,
    lift: [0.052, 0.082, 0.140],
    gamma: [0.91, 0.99, 1.11],
    gain: [0.89, 0.98, 1.13],
    rayColor: [0.80, 0.92, 1.0],
    bloom: 0.48,
    dof: 0.44,
    godRays: 0.04,
    vignette: 0.36,
    grain: 0.06,
    chromaticAberration: 0,
    bayerDither: 0,
  },
  "cataclysm-fire": {
    id: "cataclysm-fire",
    label: "화염 재앙 (보스전)",
    summary: "불타는 마을 · 클라이맥스 · 붉은 노을과 강한 블룸",
    sat: 0.86,
    contrast: 1.24,
    expose: 0.86,
    lift: [0.092, 0.022, 0.014],
    gamma: [1.11, 0.89, 0.75],
    gain: [1.18, 0.87, 0.68],
    rayColor: [1.0, 0.52, 0.22],
    bloom: 0.60,
    dof: 0.48,
    godRays: 0.10,
    vignette: 0.54,
    grain: 0.12,
    chromaticAberration: 0.14,
    bayerDither: 0,
  },
};

export const CINEMATIC_COMBO_IDS = [
  "classic-clean",
  "octopath-dusk",
  "flashlight-horror",
  "rainy-noir",
  "blossom-dawn",
  "arctic-camp",
  "cataclysm-boss",
] as const;

export type CinematicComboId = (typeof CINEMATIC_COMBO_IDS)[number];

export interface CinematicComboPreset {
  readonly id: CinematicComboId;
  readonly label: string;
  readonly summary: string;
  readonly postFx: MapPostFx | null;
  readonly sunlight?: Partial<MapSunlight> | null;
  readonly atmosphereEffects: ReadonlyArray<{ readonly kind: AtmosphereKind; readonly amount?: number; readonly opacity?: number }>;
  readonly lighting?: { readonly ambient: number; readonly color: string; readonly playerFlashlightRadius?: number } | null;
  readonly weather?: { readonly kind: "none" | "rain" | "storm" | "snow" | "fog"; readonly intensity: number };
}

export const CINEMATIC_COMBO_PRESETS: Readonly<Record<CinematicComboId, CinematicComboPreset>> = {
  "classic-clean": {
    id: "classic-clean",
    label: "없음 (원본 초기화)",
    summary: "후처리·환경효과·태양그림자·야간조명을 모두 끄고 순수 도트 원본으로 복원",
    postFx: null,
    sunlight: null,
    atmosphereEffects: [],
    lighting: null,
    weather: { kind: "none", intensity: 0 },
  },
  "octopath-dusk": {
    id: "octopath-dusk",
    label: "정통 HD-2D 황혼 (옥토패스풍)",
    summary: "황혼 필름 + 서쪽 긴 그림자 + 공기 먼지 + 상하 DoF + 캐릭터 림라이트",
    postFx: { preset: "hd2d-warm" },
    sunlight: { enabled: true, azimuth: 262, altitude: 22, opacity: 0.42, softness: 2, heightScale: 0.85 },
    atmosphereEffects: [{ kind: "dust", amount: 0.45, opacity: 0.55 }],
    lighting: null,
    weather: { kind: "none", intensity: 0 },
  },
  "flashlight-horror": {
    id: "flashlight-horror",
    label: "칠흑 손전등 호러 (패닉 · 은신 연동)",
    summary: "고딕 공포 + 필름 그레인·색수차·Bayer 디더링 + 손전등 + 추격 심장박동",
    postFx: { preset: "gothic-horror", godRays: 0, vignette: 0.64, grain: 0.28, bayerDither: 0.22, horrorReactive: true },
    sunlight: null,
    atmosphereEffects: [{ kind: "shades", amount: 0.35, opacity: 0.45 }],
    lighting: { ambient: 0.78, color: "#070b18", playerFlashlightRadius: 3.6 },
    weather: { kind: "fog", intensity: 0.45 },
  },
  "rainy-noir": {
    id: "rainy-noir",
    label: "비 오는 사이버 네오누아르",
    summary: "사이버 네온 + 폭우(햇살 자동 OFF) + 색수차·물방울 + 네온/불꽃 블룸",
    postFx: { preset: "cyber-neon", godRays: 0 },
    sunlight: null,
    atmosphereEffects: [{ kind: "leaks", amount: 0.45, opacity: 0.6 }],
    lighting: null,
    weather: { kind: "rain", intensity: 0.8 },
  },
  "blossom-dawn": {
    id: "blossom-dawn",
    label: "봄바람 벚꽃 여명",
    summary: "새벽 여명 + 흩날리는 꽃잎 + 아침 대각선 햇살",
    postFx: { preset: "dawn-mist" },
    sunlight: { enabled: true, azimuth: 105, altitude: 32, opacity: 0.28, softness: 2, heightScale: 0.7 },
    atmosphereEffects: [{ kind: "petals", amount: 0.6, opacity: 0.75 }],
    lighting: null,
    weather: { kind: "none", intensity: 0 },
  },
  "arctic-camp": {
    id: "arctic-camp",
    label: "눈보라 설원 야영",
    summary: "설원 빙청 톤 + 서리 결정 + 대설 + 모닥불 따뜻한 Emissive 오아시스",
    postFx: { preset: "arctic-blizzard", godRays: 0 },
    sunlight: null,
    atmosphereEffects: [{ kind: "frost", amount: 0.55, opacity: 0.65 }],
    lighting: null,
    weather: { kind: "snow", intensity: 0.85 },
  },
  "cataclysm-boss": {
    id: "cataclysm-boss",
    label: "불타는 마을 · 보스전",
    summary: "화염 재앙 톤 + 날리는 불씨·재 + 강한 블룸과 색수차",
    postFx: { preset: "cataclysm-fire" },
    sunlight: null,
    atmosphereEffects: [
      { kind: "embers", amount: 0.75, opacity: 0.85 },
      { kind: "ash", amount: 0.45, opacity: 0.55 },
    ],
    lighting: null,
    weather: { kind: "none", intensity: 0 },
  },
};

export interface ResolvedPostFx {
  readonly preset: PostFxPresetId;
  readonly active: boolean;
  readonly intensity: number;
  readonly sat: number;
  readonly contrast: number;
  readonly expose: number;
  readonly lift: readonly [number, number, number];
  readonly gamma: readonly [number, number, number];
  readonly gain: readonly [number, number, number];
  readonly rayColor: readonly [number, number, number];
  readonly bloom: number;
  readonly dof: number;
  readonly godRays: number;
  readonly vignette: number;
  readonly grain: number;
  readonly chromaticAberration: number;
  readonly bayerDither: number;
  readonly preserveEmissive: boolean;
  readonly adaptWeather: boolean;
  readonly horrorReactive: boolean;
  readonly spriteRimLight: boolean;
}

function clamp01(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

export function isPostFxPresetId(value: unknown): value is PostFxPresetId {
  return typeof value === "string" && (POST_FX_PRESET_IDS as readonly string[]).includes(value);
}

export function isCinematicComboId(value: unknown): value is CinematicComboId {
  return typeof value === "string" && (CINEMATIC_COMBO_IDS as readonly string[]).includes(value);
}

export function normalizePostFx(raw: unknown): MapPostFx {
  if (!raw || typeof raw !== "object") return { preset: "none" };
  const obj = raw as Record<string, unknown>;
  const preset: PostFxPresetId = isPostFxPresetId(obj.preset) ? obj.preset : "none";
  if (preset === "none") {
    return {
      preset: "none",
      ...(obj.horrorReactive === false ? { horrorReactive: false } : {}),
      ...(obj.spriteRimLight === false ? { spriteRimLight: false } : {}),
    };
  }
  const spec = POST_FX_PRESETS[preset];
  return {
    preset,
    intensity: clamp01(obj.intensity, 1),
    bloom: clamp01(obj.bloom, spec.bloom),
    dof: clamp01(obj.dof, spec.dof),
    godRays: clamp01(obj.godRays, spec.godRays),
    vignette: clamp01(obj.vignette, spec.vignette),
    grain: clamp01(obj.grain, spec.grain),
    chromaticAberration: clamp01(obj.chromaticAberration, spec.chromaticAberration),
    bayerDither: clamp01(obj.bayerDither, spec.bayerDither),
    preserveEmissive: obj.preserveEmissive !== false,
    adaptWeather: obj.adaptWeather !== false,
    horrorReactive: obj.horrorReactive !== false,
    spriteRimLight: obj.spriteRimLight !== false,
  };
}

export function patchPostFx(current: MapPostFx | undefined, patch: Partial<MapPostFx>): MapPostFx {
  const nextPreset: PostFxPresetId = patch.preset !== undefined
    ? (isPostFxPresetId(patch.preset) ? patch.preset : "none")
    : (current && isPostFxPresetId(current.preset) ? current.preset : "none");
  if (nextPreset === "none") {
    return normalizePostFx({
      preset: "none",
      ...(patch.horrorReactive !== undefined ? { horrorReactive: patch.horrorReactive } : {}),
      ...(patch.spriteRimLight !== undefined ? { spriteRimLight: patch.spriteRimLight } : {}),
    });
  }
  const presetChanged = !current || current.preset !== nextPreset;
  const spec = POST_FX_PRESETS[nextPreset];
  const base = presetChanged
    ? {
      preset: nextPreset,
      intensity: 1,
      bloom: spec.bloom,
      dof: spec.dof,
      godRays: spec.godRays,
      vignette: spec.vignette,
      grain: spec.grain,
      chromaticAberration: spec.chromaticAberration,
      bayerDither: spec.bayerDither,
      preserveEmissive: current?.preserveEmissive ?? true,
      adaptWeather: current?.adaptWeather ?? true,
      horrorReactive: current?.horrorReactive ?? true,
      spriteRimLight: current?.spriteRimLight ?? true,
    }
    : normalizePostFx(current);
  return normalizePostFx({
    ...base,
    ...patch,
    preset: nextPreset,
  });
}

export function resolvePostFx(mapPostFx: MapPostFx | undefined, systemPostFx?: MapPostFx): ResolvedPostFx {
  const effective = mapPostFx !== undefined
    ? normalizePostFx(mapPostFx)
    : normalizePostFx(systemPostFx);
  const spec = POST_FX_PRESETS[effective.preset];
  const intensity = effective.preset === "none" ? 0 : clamp01(effective.intensity, 1);
  return {
    preset: effective.preset,
    active: effective.preset !== "none" && intensity > 0.005,
    intensity,
    sat: spec.sat,
    contrast: spec.contrast,
    expose: spec.expose,
    lift: spec.lift,
    gamma: spec.gamma,
    gain: spec.gain,
    rayColor: spec.rayColor,
    bloom: effective.preset === "none" ? 0 : clamp01(effective.bloom, spec.bloom),
    dof: effective.preset === "none" ? 0 : clamp01(effective.dof, spec.dof),
    godRays: effective.preset === "none" ? 0 : clamp01(effective.godRays, spec.godRays),
    vignette: effective.preset === "none" ? 0 : clamp01(effective.vignette, spec.vignette),
    grain: effective.preset === "none" ? 0 : clamp01(effective.grain, spec.grain),
    chromaticAberration: effective.preset === "none" ? 0 : clamp01(effective.chromaticAberration, spec.chromaticAberration),
    bayerDither: effective.preset === "none" ? 0 : clamp01(effective.bayerDither, spec.bayerDither),
    preserveEmissive: effective.preserveEmissive !== false,
    adaptWeather: effective.adaptWeather !== false,
    horrorReactive: effective.horrorReactive !== false,
    spriteRimLight: effective.spriteRimLight !== false,
  };
}
