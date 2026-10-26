// 시각 공백 검사 — 「가운데 큰 검은 공백」(2026-10-14 몬스터 감사: 도장 체육관 미로가 통째로 어둠 덮개에 가려졌다).
//
// 맵 데이터는 멀쩡해도(바닥·칸막이 타일이 다 있다) 위층 덮개가 불투명에 가깝게 가리면 플레이어에게는 「검은 구멍」이다.
// 그래서 데이터가 아니라 **그려진 그림**을 칸 단위로 본다: 칸의 안쪽 픽셀이 거의 검은색이거나(dark),
// 두 층 모두 비어 아무것도 안 그려졌다(empty). 이웃한 어두운·빈 칸 덩이(blob)가 크고, 그 안에 「걸어 들어갈 수 있는 칸」이
// 많거나 방 안쪽에 갇힌 빈 구멍이면 결함이다. 통행 불가인 검은 덩이(유령관 낭떠러지·밤하늘·용암 틈)는 의도된 함정이라 통과다.
//
// 순수 함수만 둔다 — 칸을 그림에서 읽는 일은 `scripts/qa-game/lib/visualVoid.ts`(노드 전용, renderMapPng)가 한다.

import type { Finding } from "./types";

export interface VoidCell {
  /** 안쪽 픽셀이 거의 검다. */
  readonly dark: boolean;
  /** 두 층(위·아래) 모두 비어 아무것도 안 그려졌다. */
  readonly empty: boolean;
  /** 플레이어가 그 칸으로 걸어 들어갈 수 있다. */
  readonly passable: boolean;
}

export interface VoidBlob {
  readonly area: number;
  readonly passable: number;
  readonly empty: number;
  readonly touchesBorder: boolean;
  readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number;
}

/** 이 칸 수 미만의 작은 덩이는 소품 그림자·작은 구멍이므로 무시한다. */
export const VOID_MIN_AREA = 12;
/** 안쪽 평균 밝기(0~255)가 이 값 미만이면 어두운 칸. 어둠 덮개 칸은 약 25~30, 검은 바탕(바둑판 빈 칸)은 약 47. */
export const VOID_DARK_LUMA = 40;

/** 어두운·빈 칸의 4방향 연결 덩이. */
export function voidBlobs(width: number, height: number, cells: readonly VoidCell[]): VoidBlob[] {
  const seen = new Uint8Array(width * height);
  const blobs: VoidBlob[] = [];
  const isVoid = (i: number) => cells[i] !== undefined && (cells[i]!.dark || cells[i]!.empty);
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !isVoid(start)) continue;
    const queue = [start];
    seen[start] = 1;
    let area = 0, passable = 0, empty = 0, touchesBorder = false;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    while (queue.length > 0) {
      const i = queue.pop()!;
      const x = i % width, y = Math.floor(i / width);
      area += 1;
      if (cells[i]!.passable) passable += 1;
      if (cells[i]!.empty) empty += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (!seen[j] && isVoid(j)) { seen[j] = 1; queue.push(j); }
      }
    }
    blobs.push({ area, passable, empty, touchesBorder, x0, y0, x1, y1 });
  }
  return blobs;
}

/** 결함인 덩이만 — 걸어 들어갈 수 있는 어둠이 넓거나, 방 안에 갇힌 빈 구멍이거나, 맵 대부분이 비었다. */
export function offendingVoidBlobs(width: number, height: number, cells: readonly VoidCell[]): VoidBlob[] {
  return voidBlobs(width, height, cells).filter((blob) => {
    if (blob.area < VOID_MIN_AREA) return false;
    if (blob.passable >= 6 && blob.passable * 4 >= blob.area) return true;
    if (blob.empty >= VOID_MIN_AREA && !blob.touchesBorder) return true;
    return blob.empty * 5 >= width * height;
  });
}

export function voidFinding(map: { readonly id: string; readonly name?: string }, blob: VoidBlob): Finding {
  const kind = blob.passable > 0
    ? `걸어 들어갈 수 있는 칸 ${blob.passable}개가 검게 가려져 있습니다(위층 어둠·덮개)`
    : `아무것도 그려지지 않은 빈 칸 ${blob.empty}개가 방 안쪽에 있습니다`;
  return {
    severity: "warning", code: "visual-void",
    message: `시각 공백: 어두운 덩이 ${blob.area}칸(x ${blob.x0}~${blob.x1}, y ${blob.y0}~${blob.y1}) — ${kind}. 플레이어에게는 「가운데 검은 구멍」입니다. 덮개를 걷거나 바닥 그림을 보이게 하세요`,
    where: { mapId: map.id, ...(map.name ? { mapName: map.name } : {}), x: blob.x0, y: blob.y0 },
  };
}

/** 이 어둡기(0~1) 이상이면 광원 밖 바닥이 플레이 화면에서 거의 검다. */
export const UNLIT_AMBIENT = 0.7;

/** 맵 기본 조명에 주인공을 따라다니는 광원(손전등·횃불)이 있다. */
export function playerCarriesLight(lighting: { readonly sources?: readonly { readonly at: unknown; readonly radius: number; readonly intensity?: number }[] } | undefined): boolean {
  return (lighting?.sources ?? []).some((source) => source.at === "player" && source.radius >= 2 && (source.intensity ?? 1) > 0);
}

/**
 * 짙은 어둠인데 주인공이 들고 다니는 빛이 없다 — 광원 밖 걸을 수 있는 바닥이 통째로 「검은 구멍」이 된다(2026-10-26 판정 J89).
 * 주인공 광원이 있는 어둠은 연출이다: 걸어가는 곳마다 바닥이 밝혀지므로 시각 공백 검사는 조명을 뺀 그림으로 한다.
 */
export function unlitDarkFinding(map: { readonly id: string; readonly name?: string; readonly defaultLighting?: { readonly ambient: number; readonly sources?: readonly { readonly at: unknown; readonly radius: number }[] } }): Finding | undefined {
  const lighting = map.defaultLighting;
  if (!lighting || lighting.ambient < UNLIT_AMBIENT || playerCarriesLight(lighting)) return undefined;
  return {
    severity: "warning", code: "visual-void",
    message: `시각 공백: 어둡기 ${lighting.ambient} 인데 주인공을 따라다니는 빛이 없습니다 — 광원 밖 걸을 수 있는 바닥이 플레이 화면에서 검게 가려집니다. set_lighting_volume 의 sources 에 {at:'player', radius:3~4} 를 더하세요`,
    where: { mapId: map.id, ...(map.name ? { mapName: map.name } : {}) },
  };
}

/** 한 가지 바닥 타일이 맵의 대부분을 덮고 그 위에 아무것도 없다 — 「새로 지은 마을」이 회색 판 한 장에 집 하나로 남는 식의 빈 판. */
export const FLAT_MIN_CELLS = 100;
export const FLAT_DOMINANT_RATIO = 0.8;
export const FLAT_DECOR_RATIO = 0.1;

export function flatMapFinding(map: { readonly id: string; readonly name?: string; readonly width: number; readonly height: number; readonly lowerTiles: readonly number[]; readonly upperTiles: readonly number[]; readonly lowerOverlayTiles?: readonly number[]; readonly upperOverlayTiles?: readonly number[] }): Finding | undefined {
  const total = map.width * map.height;
  if (total < FLAT_MIN_CELLS) return undefined;
  const counts = new Map<number, number>();
  for (const t of map.lowerTiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  let dominant = 0, tile = -1;
  for (const [t, n] of counts) if (n > dominant) { dominant = n; tile = t; }
  let decor = 0;
  for (let i = 0; i < total; i++) {
    const others = [map.upperTiles[i], map.lowerOverlayTiles?.[i], map.upperOverlayTiles?.[i]];
    if (others.some((t) => t !== undefined && t >= 0) || map.lowerTiles[i] !== tile) decor += 1;
  }
  if (dominant / total < FLAT_DOMINANT_RATIO || decor / total > FLAT_DECOR_RATIO) return undefined;
  return {
    severity: "warning", code: "visual-flat",
    message: `시각 공백: 바닥 타일 ${tile} 한 가지가 맵의 ${Math.round(dominant / total * 100)}%를 덮고 그 위 장식은 ${Math.round(decor / total * 100)}% 뿐입니다 — 플레이어에게는 「무늬 없는 빈 판」입니다. 길·나무·건물·물을 더하거나 마을 판(composeTown)을 쓰세요`,
    where: { mapId: map.id, ...(map.name ? { mapName: map.name } : {}) },
  };
}
