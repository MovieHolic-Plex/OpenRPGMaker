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
  return {
    imageId,
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(fit !== undefined ? { fit } : {}),
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
  return {
    imageId: record.imageId.trim(),
    ...(scrollX !== undefined ? { scrollX } : {}),
    ...(scrollY !== undefined ? { scrollY } : {}),
    ...(fit !== undefined ? { fit } : {}),
    // 반복이 기본값이다 — «끈 것» 만 적어 옛 JSON 과 바이트를 맞춘다.
    ...(record.loopX === false ? { loopX: false } : {}),
    ...(record.loopY === false ? { loopY: false } : {}),
    ...(layers ? { layers } : {}),
  };
}
