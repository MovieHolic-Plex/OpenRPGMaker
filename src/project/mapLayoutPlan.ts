/**
 * 맵 bbox 설계도 — 시공 후 남는 구조 메타.
 * AI/사용자가 "가운데 파란 집" 등으로 영역을 가리킬 때 사용.
 */
import type { GameMap, MapLayoutPlan, MapLayoutRegion, Project } from "./types";

export function setMapLayoutPlan(map: GameMap, plan: MapLayoutPlan): void {
  map.layoutPlan = plan;
}

export function getMapLayoutPlan(map: GameMap): MapLayoutPlan | undefined {
  return map.layoutPlan;
}

export function listLayoutRegions(map: GameMap, role?: string): readonly MapLayoutRegion[] {
  const regions = map.layoutPlan?.regions ?? [];
  if (!role) return regions;
  return regions.filter((r) => r.role === role);
}

/** 라벨·role·kit·위치 키워드로 영역 검색 (간단한 한국어/영문 부분일치) */
export function findLayoutRegions(
  map: GameMap,
  query: string,
): MapLayoutRegion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...(map.layoutPlan?.regions ?? [])];
  const tokens = q.split(/\s+/).filter(Boolean);
  return (map.layoutPlan?.regions ?? []).filter((r) => {
    const hay = [
      r.id,
      r.role,
      r.label,
      r.kitId ?? "",
      r.shape ?? "",
      r.yardTheme ?? "",
      ...(r.tags ?? []),
      `${r.x},${r.y}`,
    ]
      .join(" ")
      .toLowerCase();
    return tokens.every((t) => hay.includes(t) || matchKoreanAlias(t, r));
  });
}

function matchKoreanAlias(token: string, r: MapLayoutRegion): boolean {
  if (token.includes("집") && r.role === "house") return true;
  if ((token.includes("상점") || token.includes("시장") || token.includes("장터")) && r.role === "market") return true;
  if (token.includes("광장") && r.role === "plaza") return true;
  if (token.includes("숲") && r.role === "forest") return true;
  if ((token.includes("호수") || token.includes("호숫")) && r.role === "lake") return true;
  if (token.includes("강") && r.role === "river") return true;
  if ((token.includes("파란") || token.includes("파랑") || token.includes("blue")) && (r.kitId?.includes("blue") || r.label.includes("파랑"))) {
    return true;
  }
  if ((token.includes("흰") || token.includes("회벽") || token.includes("plaster") || token.includes("밝은")) && (r.kitId?.includes("plaster") || r.label.includes("회벽"))) {
    return true;
  }
  if (token.includes("가운데") || token.includes("중앙")) {
    // 맵 중앙 근처 — 호출측에서 map 크기 필요할 수 있어 태그로만 약하게
    return (r.tags ?? []).includes("centerish") || r.role === "plaza" || r.role === "market";
  }
  return false;
}

/** 맵 중앙에 가까운 순으로 정렬 (쿼리 보조) */
export function rankRegionsByCenter(map: GameMap, regions: readonly MapLayoutRegion[]): MapLayoutRegion[] {
  const cx = map.width / 2;
  const cy = map.height / 2;
  return [...regions].sort((a, b) => {
    const da = Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy);
    const db = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    return da - db;
  });
}

export function projectMapLayoutSummary(project: Project, mapId: string): string {
  const map = project.maps[mapId];
  if (!map?.layoutPlan) return "(layoutPlan 없음)";
  const lines = map.layoutPlan.regions.map(
    (r) => `${r.role}\t${r.label}\t@${r.x},${r.y} ${r.w}x${r.h}${r.kitId ? ` kit=${r.kitId}` : ""}`,
  );
  return [`kind=${map.layoutPlan.kind} seed=${map.layoutPlan.seed ?? "-"} regions=${map.layoutPlan.regions.length}`, ...lines].join("\n");
}
