import type { MapBackground, MapBackgroundFit, MapBackgroundLayer } from "@/project/types";

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

function normalizeMapBackgroundLayer(value: unknown): MapBackgroundLayer | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.imageId !== "string") return undefined;
  const imageId = record.imageId.trim();
  if (!imageId) return undefined;
  const scrollX = normalizeMapBackgroundScroll(record.scrollX);
  const scrollY = normalizeMapBackgroundScroll(record.scrollY);
  const fit = normalizeMapBackgroundFit(record.fit);
  const cameraFollow = normalizeMapBackgroundCameraFollow(record.cameraFollow);
  return {
    imageId,
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(cameraFollow !== undefined ? { cameraFollow } : {}),
  };
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
  if (typeof record.imageId !== "string") return undefined;
  const scrollX = normalizeMapBackgroundScroll(record.scrollX);
  const scrollY = normalizeMapBackgroundScroll(record.scrollY);
  const layers = normalizeMapBackgroundLayers(record.layers);
  const fit = normalizeMapBackgroundFit(record.fit);
  const cameraFollow = normalizeMapBackgroundCameraFollow(record.cameraFollow);
  return {
    imageId: record.imageId.trim(),
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(fit !== undefined ? { fit } : {}),
    ...(cameraFollow !== undefined ? { cameraFollow } : {}),
    // 반복이 기본값이다 — «끈 것» 만 적어 옛 JSON 과 바이트를 맞춘다.
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(layers ? { layers } : {}),
  };
}
