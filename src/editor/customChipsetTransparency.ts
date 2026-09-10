// 커스텀 칩셋 투명도 감지 — 브라우저 배선(캔버스 → ImageData → 캐시).
//
// 경계 (OPRN-OUT-026 의 핵심이자 이 모듈이 절대 넘지 않는 선):
//   **감지는 메타를 바꾸지 않는다.** 여기서 나오는 것은 오직 "검토 신호" 이고,
//   실제 적용(상위 오버레이 / 하위+받침 / 투명 하위 유지 / 자동)은 사용자가 항목마다 고른다.
//   가져오기·준비 단계의 일괄 자동 재분류는 금지다.
//
// 내장 타운 칩셋 경로는 **건드리지 않는다** — 빌드 타임 생성 목록
// (`generatedChipsetTransparency.ts`, `scripts/generateChipsetTransparency.mjs`)이 정본이다.
// 이 모듈은 그 목록이 없는 사용자 업로드 칩셋에만 붙는다.
//
// 캐시: 큰 아틀라스를 매 렌더마다 다시 스캔하면 안 되므로 이미지 신원 + 기하로 키를 만든다.
// 이미지가 바뀌면(업로드 교체·이식 베이크·투명색 키 변경) 키가 달라져 자동으로 무효화된다.
// 순수 판정은 `src/project/tileAlphaScan.ts` 에 있다(브라우저 없이 테스트된다).
import { tilesetImageUrl } from "@/editor/tilesetImage";
import {
  scanTileAlpha,
  unknownTileAlphaScan,
  type TileAlphaClass,
  type TileAlphaSample,
  type TileAlphaScan,
} from "@/project/tileAlphaScan";
import { isCustomTileset } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";

/** 스캔이 끝나 캐시에 들어갔을 때 쏘는 이벤트 — 검토 목록이 이걸 듣고 다시 그린다. */
export const CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT = "oprn:custom-chipset-alpha-scanned";

const scanCache = new Map<string, TileAlphaScan>();
const inFlight = new Map<string, Promise<TileAlphaScan>>();

/** 테스트/이미지 교체용 — 캐시와 진행 중 작업을 모두 버린다. */
export function clearCustomChipsetAlphaCache(): void {
  scanCache.clear();
  inFlight.clear();
}

/**
 * 캐시 키 = 이미지 신원 + 아틀라스 기하.
 *
 * `tilesetImageUrl` 은 업로드 바이트(dataURL)·번들 경로·이식 베이크 결과를 모두 반영하므로
 * **이미지가 바뀌면 URL 이 바뀐다** — 그래서 이미지 변경이 곧 캐시 무효화다.
 * dataURL 은 길 수 있으니 앞뒤 지문 + 길이로 줄인다(같은 길이·같은 양 끝이면서 가운데만
 * 다른 PNG 는 사실상 나오지 않고, 나와도 오답이 아니라 재스캔 누락일 뿐이라 뒤에서 설명한다).
 */
export function customChipsetAlphaCacheKey(tileset: TilesetDef): string {
  return alphaCacheKeyForUrl(tileset, tilesetImageUrl(tileset));
}

function alphaCacheKeyForUrl(tileset: TilesetDef, url: string): string {
  return JSON.stringify({
    image: imageFingerprint(url),
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    count: tileset.count,
    transparentColor: tileset.transparentColor ?? null,
  });
}

// dataURL 전체를 키로 쓰면 수 MB 문자열이 Map 키로 남는다. 길이 + 양 끝 표본으로 줄인다.
const FINGERPRINT_EDGE = 64;
function imageFingerprint(url: string): string {
  if (url.length <= FINGERPRINT_EDGE * 2) return url;
  return `${url.length}:${url.slice(0, FINGERPRINT_EDGE)}…${url.slice(-FINGERPRINT_EDGE)}`;
}

/**
 * 캐시에 있으면 그 결과, 없으면 null 을 돌려주고 스캔을 예약한다(동기 렌더 경로용).
 * 스캔이 끝나면 `CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT` 가 떠서 다음 렌더에 반영된다.
 */
export function peekCustomChipsetAlphaScan(tileset: TilesetDef): TileAlphaScan | null {
  if (!isCustomTileset(tileset)) return null;
  const key = customChipsetAlphaCacheKey(tileset);
  const cached = scanCache.get(key);
  if (cached) return cached;
  void ensureCustomChipsetAlphaScan(tileset);
  return null;
}

/** 캐시에 이미 있는 결과만. 스캔을 예약하지 않는다(테스트·계측용). */
export function cachedCustomChipsetAlphaScan(tileset: TilesetDef): TileAlphaScan | null {
  return scanCache.get(customChipsetAlphaCacheKey(tileset)) ?? null;
}

/** 스캔을 보장한다. 같은 키의 중복 요청은 하나의 작업으로 합친다. */
export function ensureCustomChipsetAlphaScan(tileset: TilesetDef): Promise<TileAlphaScan> {
  if (!isCustomTileset(tileset)) {
    return Promise.resolve(unknownTileAlphaScan("기본 칩셋은 생성된 투명 목록을 씁니다."));
  }
  const url = tilesetImageUrl(tileset);
  const key = alphaCacheKeyForUrl(tileset, url);
  const cached = scanCache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const geometry = {
    tileSize: tileset.tileSize,
    tilesPerRow: tileset.tilesPerRow,
    count: tileset.count,
  };
  const pending = scanImageAlpha(url, geometry)
    .catch((cause: unknown) => unknownTileAlphaScan(`타일 그림판을 읽지 못했습니다: ${describeCause(cause)}`))
    .then((scan) => {
      scanCache.set(key, scan);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(CUSTOM_CHIPSET_ALPHA_SCANNED_EVENT, {
            detail: { tilesetId: tileset.id, status: scan.status },
          }),
        );
      }
      return scan;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, pending);
  return pending;
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

type ScanGeometry = { readonly tileSize: number; readonly tilesPerRow: number; readonly count: number };

/**
 * 이미지를 캔버스에 그려 픽셀을 읽는다.
 *
 * 정직한 저하: CORS 오염(`getImageData` 가 SecurityError)·로드 실패·2D 컨텍스트 부재는
 * 전부 **"모름"** 이다. `opaque` 로 낙관하면 사용자가 검은 구멍을 나중에 발견하게 된다.
 */
async function scanImageAlpha(url: string, geometry: ScanGeometry): Promise<TileAlphaScan> {
  if (typeof document === "undefined") {
    return unknownTileAlphaScan("브라우저 캔버스가 없어 픽셀을 읽지 못했습니다.");
  }
  const image = await loadScanImage(url);
  if (!image) return unknownTileAlphaScan("타일 그림판 이미지를 불러오지 못했습니다.");
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) return unknownTileAlphaScan("타일 그림판 크기가 0입니다.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return unknownTileAlphaScan("2D 캔버스 컨텍스트를 얻지 못했습니다.");
  context.drawImage(image, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, width, height).data;
  } catch (cause) {
    // 대표 사례: 다른 출처에서 온 이미지라 캔버스가 오염됨(SecurityError).
    return unknownTileAlphaScan(`픽셀을 읽을 수 없습니다(교차 출처 이미지일 수 있음): ${describeCause(cause)}`);
  }
  return scanTileAlpha(data, { width, height, ...geometry });
}

function loadScanImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // 서버가 허용하면 오염을 피한다. 거부하면 onerror → "모름" 으로 정직하게 떨어진다.
    if (!url.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** 감지된 부류(캐시에 있을 때만). 없으면 null — 호출자는 "아직 모름" 으로 다룬다. */
export function detectedTileAlphaClass(tileset: TilesetDef, tile: number): TileAlphaClass | null {
  const scan = peekCustomChipsetAlphaScan(tileset);
  if (!scan) return null;
  if (scan.status === "unknown") return "unknown";
  return scan.samples[tile]?.cls ?? null;
}

/** 감지 표본(캐시에 있을 때만) — 검토 목록이 실측 픽셀 수를 그대로 보여준다. */
export function detectedTileAlphaSample(tileset: TilesetDef, tile: number): TileAlphaSample | null {
  const scan = cachedCustomChipsetAlphaScan(tileset);
  if (!scan || scan.status === "unknown") return null;
  return scan.samples[tile] ?? null;
}
