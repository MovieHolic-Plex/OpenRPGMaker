import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { occurrenceOrigin } from "@/project/spatial/domain";
import type { SpatialOccurrence, SpatialProvenance } from "@/project/spatial/types";
import type { Project } from "@/project/types";

/**
 * 설계가 실제로 어디에 쓰였는가 — 장소 탭 카드의 「맵 N곳 · AI n · 직접 m」과
 * 배치 팝오버(어느 맵 어느 좌표, 누가 놓았나)의 데이터 원천.
 *
 * "쓰임" = spatialAuthoring.occurrences 중 source.id 가 이 설계를 가리키는 것 전부.
 * 루트뿐 아니라 다른 장소 안에 방으로 들어간 자식 배치도 센다 — 사용자 질문은
 * "이 설계가 어디 있나"이지 "루트로 시공된 곳이 어디냐"가 아니다.
 */
export type SpatialUsageRow = {
  readonly occurrenceId: string;
  readonly origin: SpatialProvenance["origin"];
  readonly mapId: string | null;
  readonly mapName: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type SpatialDesignUsage = {
  readonly rows: readonly SpatialUsageRow[];
  readonly ai: number;
  readonly direct: number;
};

const EMPTY_USAGE: SpatialDesignUsage = { rows: [], ai: 0, direct: 0 };

/** 자기 binding 이 없는 자식 배치는 부모 사슬에서 첫 지도를 찾는다 (실내 방 등). */
function boundExtent(
  occurrences: Readonly<Record<string, SpatialOccurrence>>,
  occurrence: SpatialOccurrence,
): { mapId: string; x: number; y: number; width: number; height: number } | null {
  let cursor: SpatialOccurrence | undefined = occurrence;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    const binding = cursor.bindings.find((entry) => entry.mapId);
    if (binding) {
      // 자식 자신의 binding 이면 정확한 사각형, 부모에서 빌린 것이면 부모 사각형이다 —
      // 좌표 없는 행보다 부모 영역으로라도 데려가는 쪽이 낫다.
      return { mapId: binding.mapId, ...binding.rect };
    }
    cursor = cursor.parentId === null ? undefined : occurrences[cursor.parentId];
  }
  return null;
}

const usageCache = new WeakMap<Project, Map<string, SpatialDesignUsage>>();

export function designUsage(project: Project, designId: string | undefined): SpatialDesignUsage {
  if (!designId || !project.spatialAuthoring) return EMPTY_USAGE;
  let byDesign = usageCache.get(project);
  if (!byDesign) {
    byDesign = new Map();
    usageCache.set(project, byDesign);
    const occurrences = project.spatialAuthoring.occurrences;
    for (const occurrence of Object.values(occurrences)) {
      const extent = boundExtent(occurrences, occurrence);
      const origin = occurrenceOrigin(occurrence);
      const row: SpatialUsageRow = {
        occurrenceId: occurrence.id,
        origin,
        mapId: extent?.mapId ?? null,
        mapName: extent ? (project.maps[extent.mapId]?.name || extent.mapId) : "지도 생성 전",
        x: extent?.x ?? occurrence.x,
        y: extent?.y ?? occurrence.y,
        width: extent?.width ?? 1,
        height: extent?.height ?? 1,
      };
      const key = occurrence.source.id;
      const current = byDesign.get(key) ?? EMPTY_USAGE;
      byDesign.set(key, {
        rows: [...current.rows, row],
        ai: current.ai + (row.origin === "ai" ? 1 : 0),
        direct: current.direct + (row.origin === "ai" ? 0 : 1),
      });
    }
  }
  return byDesign.get(designId) ?? EMPTY_USAGE;
}

export function usageSummary(usage: SpatialDesignUsage): string {
  if (usage.rows.length === 0) return "아직 안 쓰임";
  const parts = [`맵 ${usage.rows.length}곳`];
  if (usage.ai > 0) parts.push(`AI ${usage.ai}`);
  if (usage.direct > 0) parts.push(`직접 ${usage.direct}`);
  return parts.join(" · ");
}

export type SpatialUsageFilter = "all" | "placed" | "idle" | "ai";

/** 장소 갤러리 전용 표시 상태 — 세션이 아니라 크롬 상태다(프로젝트 전환 시 리셋 불필요).
 * galleryScrollTop 은 리프레시마다 이 다시 만들어지며 사라지는 스크롤 위치를 이어받기 위한 것이다. */
export const usageChromeState: { filter: SpatialUsageFilter; openPopoverCardId: string | null; galleryScrollTop: number } = {
  filter: "all",
  openPopoverCardId: null,
  galleryScrollTop: 0,
};

export function matchesUsageFilter(usage: SpatialDesignUsage, filter: SpatialUsageFilter): boolean {
  if (filter === "all") return true;
  if (filter === "placed") return usage.rows.length > 0;
  if (filter === "idle") return usage.rows.length === 0;
  return usage.ai > 0;
}

/**
 * DB 모달을 닫고 그 맵의 그 자리로 카메라를 보낸다. 자동 저장 모델이라 닫기는 안전하다.
 * databaseModal 은 지연 import 다 — 정적으로 걸면 모달 → DB 탭 → 갤러리 → 이 모듈로
 * 되돌아오는 순환이 생긴다 (editorReferenceNavigation 의 찾기 창과 같은 이유).
 */
export function jumpToUsageRow(row: SpatialUsageRow): boolean {
  if (!row.mapId) return false;
  void import("./databaseModal").then(({ requestDatabaseModalClose }) => requestDatabaseModalClose("x"));
  return focusEditorRegion(
    { mapId: row.mapId, x: row.x, y: row.y, w: row.width, h: row.height },
    { highlight: true },
  );
}
