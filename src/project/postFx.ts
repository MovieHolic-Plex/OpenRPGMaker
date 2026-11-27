/**
 * HD-2D 화면 전체 필름 후처리(PostFX) 규격 및 8종 프리셋 정본.
 *
 * - 원본 타일·캐릭터·156종 상호작용 기물의 픽셀을 건드리지 않고, 카메라 출력 전체를
 *   단일 WebGL 프래그먼트 셰이더(`OprnFilmicPostFx`)로 색보정·블룸·상하 심도(DoF)·햇살·비네트 처리한다.
 * - `preserveEmissive`(기본 true)가 켜져 있으면 모닥불·촛불·화로·네온·수정구 등 자체 발광 픽셀은
 *   전역 LUT에 덮어씌워지지 않고 자기 고유 발광색을 유지한다.
 */

export const POST_FX_PRESET_IDS = [
  "none",
  "hd2d-warm",
  "ghibli-day",
  "dawn-mist",
  "gothic-horror",
  "dungeon-torch",
  "cyber-neon",
  "eastern-ink",
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
  /** 불·촛불·네온 등 발광체 고유색 보존 (기본 true). */
  preserveEmissive?: boolean;
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
  },
  "gothic-horror": {
    id: "gothic-horror",
    label: "고딕 공포",
    summary: "호러 · 저택 · 폐병원 · 차가운 청회색",
    sat: 0.38,
    contrast: 1.24,
    expose: 0.70,
    lift: [0.014, 0.044, 0.092],
    gamma: [0.84, 0.95, 1.08],
    gain: [0.74, 0.86, 1.03],
    rayColor: [0.42, 0.68, 0.92],
    bloom: 0.42,
    dof: 0.62,
    godRays: 0.06,
    vignette: 0.62,
  },
  "dungeon-torch": {
    id: "dungeon-torch",
    label: "던전 횃불",
    summary: "던전 · 동굴 · 지하묘지 · 불빛 강조",
    sat: 0.66,
    contrast: 1.20,
    expose: 0.66,
    lift: [0.016, 0.018, 0.064],
    gamma: [0.90, 0.88, 0.94],
    gain: [0.88, 0.82, 0.86],
    rayColor: [1.0, 0.75, 0.45],
    bloom: 0.52,
    dof: 0.48,
    godRays: 0.03,
    vignette: 0.68,
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
    godRays: 0.11,
    vignette: 0.54,
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
  readonly preserveEmissive: boolean;
}

function clamp01(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

export function isPostFxPresetId(value: unknown): value is PostFxPresetId {
  return typeof value === "string" && (POST_FX_PRESET_IDS as readonly string[]).includes(value);
}

export function normalizePostFx(raw: unknown): MapPostFx {
  if (!raw || typeof raw !== "object") return { preset: "none" };
  const obj = raw as Record<string, unknown>;
  const preset: PostFxPresetId = isPostFxPresetId(obj.preset) ? obj.preset : "none";
  if (preset === "none") return { preset: "none" };
  const spec = POST_FX_PRESETS[preset];
  return {
    preset,
    intensity: clamp01(obj.intensity, 1),
    bloom: clamp01(obj.bloom, spec.bloom),
    dof: clamp01(obj.dof, spec.dof),
    godRays: clamp01(obj.godRays, spec.godRays),
    vignette: clamp01(obj.vignette, spec.vignette),
    preserveEmissive: obj.preserveEmissive !== false,
  };
}

export function patchPostFx(current: MapPostFx | undefined, patch: Partial<MapPostFx>): MapPostFx {
  const nextPreset: PostFxPresetId = patch.preset !== undefined
    ? (isPostFxPresetId(patch.preset) ? patch.preset : "none")
    : (current && isPostFxPresetId(current.preset) ? current.preset : "none");
  if (nextPreset === "none") return { preset: "none" };
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
      preserveEmissive: current?.preserveEmissive ?? true,
    }
    : normalizePostFx(current);
  return normalizePostFx({
    ...base,
    ...patch,
    preset: nextPreset,
  });
}

export function resolvePostFx(mapPostFx: MapPostFx | undefined, systemPostFx?: MapPostFx): ResolvedPostFx {
  const effective = mapPostFx && mapPostFx.preset !== "none"
    ? normalizePostFx(mapPostFx)
    : (mapPostFx?.preset === "none" ? { preset: "none" as const } : normalizePostFx(systemPostFx));
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
    preserveEmissive: effective.preserveEmissive !== false,
  };
}
