import type { MapBackground, MapBackgroundMapView, MapBackgroundFit, MapBackgroundLayer } from "@/project/types";
import { resolvePlayResolution } from "@/project/playResolution";
import { resolveCameraZoom } from "@/project/cameraZoom";

/**
 * 맵 배경(파노라마) 저작 규칙 — 타입·클램프·정리.
 *
 * 값의 진실 공급원을 한 곳에 둔다: 로드 정규화(`io/shape.ts`), AI 툴 스키마(`editor/tools/mapTools.ts`),
 * 편집기 입력(`editor/panels/mapProps.ts`)이 같은 상한을 봐야 「편집기로는 못 넣는 값이 툴로는
 * 들어가는」 구멍이 안 생긴다.
 */

/**
 * 스크롤 속도 상한(px/프레임, 60Hz 기준). 우리 단위는 **프레임당 px** 다.
 *
 * RPG Maker 계열의 파노라마 자동 스크롤은 서브픽셀 단위(커뮤니티 문서 기준 VX Ace 는 1/8px/프레임,
 * 최대 32)라 **숫자를 그대로 옮기면 8배 빠르다**. 이 저장소의 엔진은 60Hz 논리 프레임 위에서
 * float 로 움직이므로 서브픽셀 단위를 쓸 이유가 없고, 이미 저장된 값의 뜻을 바꾸는 마이그레이션도
 * 피한다 — RM 에서 넘어온 값은 ×8 해서 넣는다.
 */
export const MAP_BACKGROUND_SCROLL_LIMIT = 10;

/**
 * 한 축의 스크롤 속도. 유한한 수가 아니면 `undefined`(= 키 제거), 범위를 넘으면 클램프한다.
 * `0` 은 그대로 둔다 — 정지가 저작값일 수 있고, 기본값을 지우면 옛 JSON 이 바이트 그대로
 * 유지되지 않는다(맵 배경은 스키마 버전을 올리지 않고 자라야 한다).
 */
export function normalizeMapBackgroundScroll(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(MAP_BACKGROUND_SCROLL_LIMIT, Math.max(-MAP_BACKGROUND_SCROLL_LIMIT, value));
}

/**
 * 추가 레이어 수 상한. 첫 장을 빼고 8장을 더 얹을 수 있다(총 9장 스택).
 *
 * 왜 3 에서 올렸나: CraftPix 레이어 팩은 세트당 5~9장이고, 3장 상한이면 지면·나무가
 * 통째로 잘린다(소나무 숲 9장 → 4장). 상한 자체는 남겨 스택이 무한정 커지지 않게 한다.
 */
export const MAP_BACKGROUND_EXTRA_LAYER_LIMIT = 8;

/**
 * 카메라 따라가기(깊이) 상한. 0 = 화면 고정, 1 = 타일과 같이, 2 = 타일의 두 배로 지나가는 전경.
 * 음수는 받지 않는다 — 카메라 반대로 흐르는 배경은 깊이감이 아니라 멀미다.
 */
export const MAP_BACKGROUND_CAMERA_FOLLOW_LIMIT = 2;

/** 카메라 따라가기 비율. 유한한 수가 아니면 `undefined`, 범위 밖은 클램프, 0 은 «기본값» 이라 생략한다. */
export function normalizeMapBackgroundCameraFollow(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(MAP_BACKGROUND_CAMERA_FOLLOW_LIMIT, Math.max(0, value));
  return clamped === 0 ? undefined : clamped;
}

/**
 * 레이어 세트를 불러올 때 층마다 주는 기본 깊이(아래→위 = 먼→가까운).
 *
 * 맨 아래(하늘)는 0 으로 화면에 고정하고, 위로 갈수록 0.7 까지 커진다. 1 을 주지 않는 이유:
 * 세트의 맨 앞 층도 타일보다는 뒤에 있는 풍경이다 — 1 이면 타일과 붙어 움직여 「벽지」 처럼 보인다.
 * 값은 0.05 단위로 반올림해 편집기 입력과 같은 눈금에 둔다.
 */
export function defaultLayerCameraFollow(index: number, count: number): number {
  if (count <= 1 || index <= 0) return 0;
  const raw = (Math.min(index, count - 1) / (count - 1)) * 0.7;
  return Math.round(raw * 20) / 20;
}

/**
 * 레이어 세트(아래→위 그림 id 목록)를 맵 배경 저작값으로 편다 — 편집기 「레이어 세트」 와 조수 도구
 * `set_map_properties.background.layerSet` 가 같은 결과를 내도록 한 곳에 둔다.
 *
 * - 모든 층 fit: "cover" — 세트 그림은 1920×1080 이라 1:1 이면 좌상단 구석만 보인다.
 * - 층마다 기본 깊이(`defaultLayerCameraFollow`) — 세트를 고르는 것만으로 시차 스크롤이 된다.
 * - `cloudDrift` 를 주면 이름에 clouds/birds 가 든 층만 그 속도로 흐른다(나머지 풍경은 제자리).
 */
export function mapBackgroundFromLayerSet(
  layerIds: readonly string[],
  options: { readonly cloudDrift?: number } = {},
): MapBackground | undefined {
  const ids = layerIds.slice(0, MAP_BACKGROUND_EXTRA_LAYER_LIMIT + 1);
  if (ids.length === 0) return undefined;
  const drift = normalizeMapBackgroundScroll(options.cloudDrift);
  const drifting = (id: string): boolean => drift !== undefined && drift !== 0 && /clouds|birds/.test(id);
  const layer = (id: string, index: number): MapBackgroundLayer => {
    const follow = defaultLayerCameraFollow(index, ids.length);
    return {
      imageId: id,
      fit: "cover",
      ...(follow > 0 ? { cameraFollow: follow } : {}),
      ...(drifting(id) ? { scrollX: drift } : {}),
    };
  };
  const [base, ...rest] = ids.map(layer);
  return rest.length > 0 ? { ...base!, layers: rest } : { ...base! };
}

/**
 * 이벤트 명령 「먼 배경 변경」 의 흐름 배율(%) 상한. 100 = 저작한 속도 그대로, 0 = 멈춤,
 * 200 = 두 배. 회상 연출의 「구름이 서서히 멈춘다」 가 이 값을 전환 시간에 걸쳐 바꾸는 것이다.
 */
export const MAP_BACKGROUND_FLOW_PERCENT_LIMIT = 400;

/** 세션에 적힌 흐름 명령 — 목표 배율과 전환 시간. 값 문자열은 `"<percent>|<durationMs>"`. */
export type MapBackgroundFlowCommand = {
  readonly percent: number;
  readonly durationMs: number;
};

export function encodeMapBackgroundFlow(percent: number, durationMs: number): string {
  const safePercent = Math.min(MAP_BACKGROUND_FLOW_PERCENT_LIMIT, Math.max(0, Number.isFinite(percent) ? percent : 100));
  const safeDuration = Math.max(0, Number.isFinite(durationMs) ? Math.round(durationMs) : 0);
  return `${safePercent}|${safeDuration}`;
}

/** 못 읽는 값은 `undefined`(= 저작 속도 그대로). 세이브에 남은 깨진 값이 배경을 멈추게 두지 않는다. */
export function decodeMapBackgroundFlow(value: string | undefined): MapBackgroundFlowCommand | undefined {
  if (!value) return undefined;
  const [percentText, durationText] = value.split("|");
  const percent = Number(percentText);
  if (!Number.isFinite(percent)) return undefined;
  const duration = Number(durationText ?? 0);
  return {
    percent: Math.min(MAP_BACKGROUND_FLOW_PERCENT_LIMIT, Math.max(0, percent)),
    durationMs: Number.isFinite(duration) ? Math.max(0, duration) : 0,
  };
}

/** 그림 맞추기 기본값. 생략 = native(1:1) 이 옛 JSON 바이트를 유지한다. */
export function normalizeMapBackgroundFit(value: unknown): MapBackgroundFit | undefined {
  return value === "cover" || value === "native" ? value : undefined;
}

/** 「다른 맵을 줄여 그린 배경」 값 정리(MapBackgroundMapView). mapId 가 없으면 undefined. */
export const MAP_VIEW_SCALE_RANGE = { min: 0.15, max: 1, default: 0.4 } as const;
export function normalizeMapBackgroundMapView(value: unknown): MapBackgroundMapView | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  const mapId = typeof r.mapId === "string" ? r.mapId.trim() : "";
  if (!mapId) return undefined;
  const clamp = (v: unknown, lo: number, hi: number): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
  const scale = clamp(r.scale, MAP_VIEW_SCALE_RANGE.min, MAP_VIEW_SCALE_RANGE.max);
  const haze = clamp(r.haze, 0, 1);
  const desaturate = clamp(r.desaturate, 0, 1);
  const hazeColor = typeof r.hazeColor === "string" && /^#[0-9a-f]{6}$/i.test(r.hazeColor.trim()) ? r.hazeColor.trim() : undefined;
  const focusX = typeof r.focusX === "number" && Number.isFinite(r.focusX) ? Math.round(r.focusX * 100) / 100 : undefined;
  const focusY = typeof r.focusY === "number" && Number.isFinite(r.focusY) ? Math.round(r.focusY * 100) / 100 : undefined;
  const rr = r.region as Record<string, unknown> | undefined;
  const int = (v: unknown, lo: number): number | undefined => typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.round(v)) : undefined;
  const region = rr && typeof rr === "object" && !Array.isArray(rr)
    && int(rr.x, 0) !== undefined && int(rr.y, 0) !== undefined && int(rr.width, 1) !== undefined && int(rr.height, 1) !== undefined
    ? { x: int(rr.x, 0)!, y: int(rr.y, 0)!, width: int(rr.width, 1)!, height: int(rr.height, 1)! }
    : undefined;
  return {
    mapId,
    ...(scale !== undefined ? { scale } : {}),
    ...(haze !== undefined ? { haze } : {}),
    ...(desaturate !== undefined ? { desaturate } : {}),
    ...(hazeColor !== undefined ? { hazeColor } : {}),
    ...(focusX !== undefined ? { focusX } : {}),
    ...(focusY !== undefined ? { focusY } : {}),
    ...(region ? { region } : {}),
    ...(clamp(r.feather, 0, 0.5) ? { feather: clamp(r.feather, 0, 0.5)! } : {}),
  };
}

function normalizeMapBackgroundLayer(value: unknown): MapBackgroundLayer | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const fromMap = normalizeMapBackgroundMapView(record.fromMap);
  if (typeof record.imageId !== "string" && !fromMap) return undefined;
  const imageId = typeof record.imageId === "string" ? record.imageId.trim() : "";
  if (!imageId && !fromMap) return undefined;
  const scrollX = normalizeMapBackgroundScroll(record.scrollX);
  const scrollY = normalizeMapBackgroundScroll(record.scrollY);
  const fit = normalizeMapBackgroundFit(record.fit);
  const cameraFollow = normalizeMapBackgroundCameraFollow(record.cameraFollow);
  const offsetY = normalizeMapBackgroundOffset(record.offsetY);
  return {
    imageId: fromMap ? "" : imageId,
    ...(fromMap ? { fromMap } : {}),
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(cameraFollow !== undefined ? { cameraFollow } : {}),
    ...(offsetY !== undefined ? { offsetY } : {}),
  };
}

/** 층 세로 자리(논리 px). 0·잘못된 값은 생략(undefined), ±MAP_BACKGROUND_OFFSET_LIMIT 로 자른다. */
export const MAP_BACKGROUND_OFFSET_LIMIT = 2000;
export function normalizeMapBackgroundOffset(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.round(Math.min(MAP_BACKGROUND_OFFSET_LIMIT, Math.max(-MAP_BACKGROUND_OFFSET_LIMIT, value)));
  return clamped === 0 ? undefined : clamped;
}

/** 추가 레이어 목록 정리. 유효한 레이어가 없으면 필드 자체를 생략한다(레거시 JSON 바이트 유지). */
export function normalizeMapBackgroundLayers(value: unknown): MapBackgroundLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layers: MapBackgroundLayer[] = [];
  for (const entry of value.slice(0, MAP_BACKGROUND_EXTRA_LAYER_LIMIT)) {
    const layer = normalizeMapBackgroundLayer(entry);
    if (layer) layers.push(layer);
  }
  return layers.length > 0 ? layers : undefined;
}

/**
 * 맵 배경 전체 정리. 객체가 아니거나 `imageId` 가 문자열이 아니면 `undefined`(= 필드 제거).
 *
 * `imageId` 가 빈 문자열인 상태는 **지우지 않는다**: 편집기의 「맵 배경 사용」 을 켜고 아직 그림을
 * 고르지 않은 저작 상태이고, 그 상태를 지우면 체크박스가 스스로 풀린다(런타임은 빈 id 를 «배경
 * 없음» 으로 읽고, 참조 검증도 빈 id 는 건너뛴다).
 */
export function normalizeMapBackground(value: unknown): MapBackground | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const fromMap = normalizeMapBackgroundMapView(record.fromMap);
  if (typeof record.imageId !== "string" && !fromMap) return undefined;
  const scrollX = normalizeMapBackgroundScroll(record.scrollX);
  const scrollY = normalizeMapBackgroundScroll(record.scrollY);
  const layers = normalizeMapBackgroundLayers(record.layers);
  const fit = normalizeMapBackgroundFit(record.fit);
  const cameraFollow = normalizeMapBackgroundCameraFollow(record.cameraFollow);
  return {
    imageId: fromMap ? "" : String(record.imageId).trim(),
    ...(fromMap ? { fromMap } : {}),
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(cameraFollow !== undefined ? { cameraFollow } : {}),
    ...(record.showInEmptyCells === true ? { showInEmptyCells: true } : {}),
    // 반복이 기본값이다 — «끈 것» 만 적어 옛 JSON 과 바이트를 맞춘다.
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(layers ? { layers } : {}),
  };
}

/**
 * 움직임 프리셋 — 숫자 칸(흐름 px/프레임·깊이 %)을 몰라도 고를 수 있는 다섯 가지. 편집기 「움직임」 버튼과
 * 조수 `set_map_properties.background.motion` 이 같은 함수를 쓴다. 스택 전체(첫 장 + layers)에 건다.
 *
 * - fixed: 화면에 붙어 움직이지 않는다(RM2K3 기본).
 * - slowParallax: 먼 층은 천천히, 가까운 층은 조금 더 카메라를 따라간다(깊이 0.1 → 0.5). 자동 흐름은 둔다.
 * - flowX / flowY: 카메라와 무관하게 그 축으로 계속 흐른다(구름·별·흐르는 물). 그 축은 반복을 켠다.
 * - followCamera: 타일과 같이 움직인다(깊이 100%) — 위에서 본 바다처럼 「바닥」 같은 배경.
 */
export const MAP_BACKGROUND_MOTIONS = ["fixed", "slowParallax", "flowX", "flowY", "followCamera"] as const;
export type MapBackgroundMotion = (typeof MAP_BACKGROUND_MOTIONS)[number];

export const MAP_BACKGROUND_MOTION_LABELS: Readonly<Record<MapBackgroundMotion, { readonly name: string; readonly hint: string }>> = {
  fixed: { name: "고정", hint: "화면에 붙어 움직이지 않음" },
  slowParallax: { name: "느린 시차", hint: "걸으면 먼 층은 천천히, 가까운 층은 조금 빨리" },
  flowX: { name: "가로 흐름", hint: "계속 옆으로 흐름(구름·별)" },
  flowY: { name: "세로 흐름", hint: "계속 위아래로 흐름(폭포·눈·우주 비행)" },
  followCamera: { name: "타일과 같이", hint: "바닥처럼 맵과 함께 움직임(위에서 본 바다)" },
};

type MotionLayer = MapBackground | MapBackgroundLayer;

function withMotion<T extends MotionLayer>(layer: T, motion: MapBackgroundMotion, index: number, count: number): T {
  const next = { ...layer } as T & { scrollX?: number; scrollY?: number; cameraFollow?: number; loopX?: boolean; loopY?: boolean };
  const clear = (key: "scrollX" | "scrollY" | "cameraFollow"): void => { delete next[key]; };
  switch (motion) {
    case "fixed":
      clear("scrollX"); clear("scrollY"); clear("cameraFollow");
      break;
    case "slowParallax": {
      const follow = count <= 1 ? 0.3 : Math.round((0.1 + (0.4 * index) / (count - 1)) * 20) / 20;
      next.cameraFollow = follow;
      break;
    }
    case "flowX":
      clear("scrollY"); clear("cameraFollow");
      next.scrollX = Math.round((0.25 + 0.25 * index) * 100) / 100;
      delete next.loopX;
      break;
    case "flowY":
      clear("scrollX"); clear("cameraFollow");
      next.scrollY = Math.round((0.25 + 0.25 * index) * 100) / 100;
      delete next.loopY;
      break;
    case "followCamera":
      next.cameraFollow = 1;
      break;
  }
  return next;
}

/** 배경 스택 전체에 움직임 프리셋을 건다. 그림·맞추기·빈 칸 설정은 그대로 둔다. */
export function applyMapBackgroundMotion(background: MapBackground, motion: MapBackgroundMotion): MapBackground {
  const layers = background.layers ?? [];
  const count = 1 + layers.length;
  const base = withMotion(background, motion, 0, count);
  if (layers.length === 0) return base;
  return { ...base, layers: layers.map((layer, at) => withMotion(layer, motion, at + 1, count)) };
}

/** 지금 저작값이 어느 프리셋과 같은가(편집기 버튼 강조용). 손으로 고친 값이면 undefined. */
export function detectMapBackgroundMotion(background: MapBackground): MapBackgroundMotion | undefined {
  const strip = (bg: MapBackground): string => JSON.stringify([bg, ...(bg.layers ?? [])].map((layer) => [
    layer.scrollX ?? 0, layer.scrollY ?? 0, layer.cameraFollow ?? 0, layer.loopX !== false, layer.loopY !== false,
  ]));
  const current = strip(background);
  return MAP_BACKGROUND_MOTIONS.find((motion) => strip(applyMapBackgroundMotion(background, motion)) === current);
}

/**
 * 플레이 화면이 보여 주는 월드 영역(논리 px) = 해상도 / 기본 카메라 배율. cover 배율은 이 크기를 덮게 잡는다.
 * 편집기 캔버스·배경 탭 미리보기가 이 값으로 배율을 맞춰야 「편집기에서 본 크기 = 게임에서 본 크기」 가 된다
 * (예전 편집기 미리보기는 편집기 창 크기를 기준으로 덮어 게임과 배율이 달랐다).
 */
export function mapBackgroundGameViewport(
  system: Parameters<typeof resolvePlayResolution>[0] & Parameters<typeof resolveCameraZoom>[0],
): { readonly width: number; readonly height: number } {
  const resolution = resolvePlayResolution(system);
  const zoom = resolveCameraZoom(system);
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { width: Math.ceil(resolution.width / safeZoom), height: Math.ceil(resolution.height / safeZoom) };
}

/** 그림을 게임 화면에 맞추는 배율 — 플레이(`mapBackgroundFitScale`)와 같은 식. */
/**
 * 「화면에 맞춤」 으로 넘치는 축을 가운데에 맞추는 위상(논리 px). 넘치지 않는 축과 native 는 0.
 * 예전에는 왼쪽 위에 붙여 16:9 그림을 4:3 화면에 깔면 오른쪽 1/4 이 늘 잘렸다(2026-10-21 감사).
 * 플레이(`playSceneMapBackground`)·탭 미리보기·편집기 캔버스가 같은 값을 쓴다.
 */
export function mapBackgroundCoverCentre(
  fit: MapBackgroundFit | undefined,
  viewport: { readonly width: number; readonly height: number },
  source: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  if (fit !== "cover") return { x: 0, y: 0 };
  const scale = mapBackgroundCoverScale(fit, viewport, source);
  return {
    x: Math.max(0, Math.round((source.width * scale - viewport.width) / 2)),
    y: Math.max(0, Math.round((source.height * scale - viewport.height) / 2)),
  };
}

export function mapBackgroundCoverScale(
  fit: MapBackgroundFit | undefined,
  viewport: { readonly width: number; readonly height: number },
  source: { readonly width: number; readonly height: number },
): number {
  if (fit !== "cover") return 1;
  return Math.max(viewport.width / Math.max(1, source.width), viewport.height / Math.max(1, source.height));
}
