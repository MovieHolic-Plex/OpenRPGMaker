// project/startRoutePaint.ts
// 첫 구간 길 맵을 칩셋별 재료로 깐다 — 길 한 줄이 입구에서 구간 끝까지 한 번 꺾여 가고, 끝에 마당이 앉는다.
//
// 왜 (2026-10-11 사용자 지적 「현대 타일은 아예 안 쓰고, 길 맵은 다 똑같이 나온다」):
//   뼈대의 길 맵은 늘 시작 맵의 타일셋(= 빈 시작 맵 = 버들항)으로 만들어졌고, 모험 장르는 길을 아예 깔지 않았다(빈 풀밭),
//   스토리는 늘 같은 광장(기둥·산울타리·벤치)이었다. 그리고 컨셉의 tilesetHint(jp_city·조선·마법 학교)는 기획서에 글 한 줄로만
//   들어가 코드가 한 번도 읽지 않았다 — 조수는 「보는 맵의 칩셋 계열」을 따르므로 버들항 빈 맵에서는 현대 거리도 로마풍으로 깔렸다.
// 이 모듈은 칩셋마다 길·마당 재료 이름을 두고, 길 모양은 기획 구상(startVariety)에서 가져온다.

import type { StartPlan } from "@/project/startVariety";

export interface RouteStyle {
  /** 길 폭(칸). */
  readonly roadWidth: number;
  /** fill_region material — 타일 라벨/그룹 이름. */
  readonly road: string;
  readonly yard: string;
  /** 맵 바탕 재료. 칩셋의 「빈 칸」 타일이 잔디가 아닐 때(일본 도시는 흙색 자갈) 길 맵·시작 맵을 이 재료로 먼저 덮는다. 없으면 빈 칸 그대로. */
  readonly ground?: string;
  /** true 면 시작 맵에 큰길을 깔지 않는다(성채 실내 같은 칩셋은 «거리» 가 아니다). */
  readonly noMainStreet?: boolean;
  /** 길 양옆 띠(보도 연석 같은 것). 없으면 생략. 못 칠하면 조용히 건너뛴다(장식이다). */
  readonly edge?: string;
}

/** 칩셋 id → 길 재료. 이름은 각 칩셋의 오토타일 그룹 이름이다(show: ensureBundledTilesets 의 autotileGroups). */
export const ROUTE_STYLES: Readonly<Record<string, RouteStyle>> = {
  beodeul_city: { roadWidth: 2, road: "버들항 길 포석", yard: "버들항 광장 판석" },
  jp_city: { roadWidth: 3, ground: "잔디", road: "생활도로", yard: "판석 광장", edge: "보도 연석" },
  joseon_baram: { roadWidth: 2, road: "조선 흙길", yard: "조선 마당" },
  wizarding_world: { roadWidth: 2, noMainStreet: true, road: "숲길 흙", yard: "성채 포석(오토타일)" },
  sengoku_edo: { roadWidth: 3, noMainStreet: true, ground: "풀밭", road: "다진 흙길", yard: "돌길(이시다타미)" },
  sky_island: { roadWidth: 1, noMainStreet: true, ground: "풀밭", road: "디딤돌 길(1)", yard: "광장 자갈 포석" },
  modern_campus: { roadWidth: 2, noMainStreet: true, ground: "캠퍼스 잔디", road: "보도블록", yard: "붉은 벽돌 포석" },
};

/**
 * 시작 맵 크기 — 컨셉의 칩셋으로 옮긴 빈 시작 맵(20×15)은 거리 한 줄·건물 한 채도 못 놓는다(2026-10-12 jp_city 도그푸딩: 조수가
 * 건물 사각형이 맵 밖이라 build_jp_city_building 을 거절당했다). 칩셋마다 거리·마을 한 장이 서는 크기를 씨앗으로 조금 흔든다.
 */
export function startMapSizeFor(tilesetId: string, plan: StartPlan): { width: number; height: number } | undefined {
  const base = tilesetId === "jp_city" ? { w: 52, h: 34 } : tilesetId === "joseon_baram" ? { w: 48, h: 36 } : tilesetId === "wizarding_world" ? { w: 48, h: 36 } : tilesetId === "sengoku_edo" ? { w: 56, h: 48 } : tilesetId === "sky_island" ? { w: 50, h: 34 } : tilesetId === "modern_campus" ? { w: 48, h: 36 } : undefined;
  if (!base) return undefined;
  return { width: base.w + (plan.seed % 3) * 4, height: base.h + ((plan.seed >> 2) % 3) * 3 };
}

export function routeStyleFor(tilesetId: string): RouteStyle | undefined {
  return ROUTE_STYLES[tilesetId];
}

type Fill = (rect: { x: number; y: number; w: number; h: number }, material: string, optional?: boolean) => void;

/**
 * 길 모양: 입구(0,entryY) → 꺾이는 x → 끝 줄(endY) → 끝 마당(구간 끝 이벤트가 마당 안, x=width-2).
 * 꺾이는 x 와 마당 크기는 씨앗이 정한다. 같은 구상이면 같은 길이다.
 */
export function paintStartRoute(fill: Fill, style: RouteStyle, plan: StartPlan, route: { width: number; height: number; entryY: number; endY: number }): void {
  const { width: W, height: H, entryY, endY } = route;
  const w = style.roadWidth;
  if (style.ground) fill({ x: 0, y: 0, w: W, h: H }, style.ground, true);
  const bendX = Math.max(6, Math.min(W - 9, Math.round(W * (0.3 + ((plan.seed % 97) / 97) * 0.35))));
  const yardW = 4 + (plan.seed % 3);            // 4..6
  const yardH = 3 + ((plan.seed >> 3) % 3);     // 3..5
  const clampY = (y: number, h: number): number => Math.max(0, Math.min(H - h, y));
  const yardX = W - 1 - yardW;
  const yardY = clampY(endY - Math.floor(yardH / 2), yardH);
  const y1 = clampY(entryY, w), y2 = clampY(endY, w);
  if (style.edge) {
    // 보도 연석: 길 위·아래 한 줄(없는 칸은 건너뜀). 장식이라 실패해도 길은 선다.
    fill({ x: 0, y: Math.max(0, y1 - 1), w: bendX + w, h: 1 }, style.edge, true);
    fill({ x: 0, y: Math.min(H - 1, y1 + w), w: bendX + w, h: 1 }, style.edge, true);
  }
  fill({ x: 0, y: y1, w: bendX + w, h: w }, style.road);
  fill({ x: bendX, y: Math.min(y1, y2), w, h: Math.abs(y2 - y1) + w }, style.road);
  fill({ x: bendX, y: y2, w: W - bendX, h: w }, style.road);
  fill({ x: yardX, y: yardY, w: yardW, h: yardH }, style.yard);
  // 끝 이벤트 칸(W-2, endY)이 마당 밖이면 길로 덮는다.
  fill({ x: W - 2, y: y2, w: 1, h: 1 }, style.road);
}

/**
 * 시작 맵의 큰길 — 시작 칸 줄을 서쪽 끝에서 동쪽 끝(문)까지 가로지르는 길 한 줄. 컨셉 칩셋으로 옮긴 빈 시작 맵에 AI 가 건물을 앉힐 기준선이다.
 * 빈 땅 한 장에서 시작하면 조수가 거리의 뼈대부터 다시 짜야 해서 칩셋 도구(건물 조립·길 키트)를 쓰기 전에 턴이 끝난다.
 */
export function paintMainStreet(fill: Fill, style: RouteStyle, size: { width: number; height: number }, rowY: number): void {
  const w = style.roadWidth;
  const y0 = Math.max(1, Math.min(size.height - w - 1, rowY - Math.floor(w / 2)));
  if (style.edge) {
    fill({ x: 0, y: y0 - 1, w: size.width, h: 1 }, style.edge, true);
    fill({ x: 0, y: y0 + w, w: size.width, h: 1 }, style.edge, true);
  }
  fill({ x: 0, y: y0, w: size.width, h: w }, style.road);
}
