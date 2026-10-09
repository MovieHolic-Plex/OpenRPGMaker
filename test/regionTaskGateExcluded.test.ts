// 영역작업(AI) 뒤의 검증게이트 배제 계약 (2026-08-30).
//
// 이 파일이 지키는 것은 하나다: **AI 가 만든 영역 초안은 사용자 결정에만 종속된다.**
// 진단(reviewRegionDraft)은 사실을 보고하되 적용을 거부하지도, 초안을 고치지도 못한다.
// 유일하게 남은 거부 사유는 기준 프로젝트 변경(stale base)과 적용 자체의 실패다.
import { afterEach, describe, expect, it } from "vitest";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import {
  __clearPendingRegionApplyForTest,
  setPendingRegionApply,
} from "@/editor/regionTask/pendingRegionApply";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;

/** (1,1) 만 통행 가능하고 주변이 벽이라 시작 위치에서 갈 수 없는 초안. */
function isolatedCellDraft(base: Project): Project {
  const draft = structuredClone(base);
  const map = draft.maps[draft.startMapId]!;
  for (let y = 0; y <= 2; y += 1) {
    for (let x = 0; x <= 2; x += 1) {
      // (1,1) 도 "변경된 셀" 이어야 진단 대상이 된다 — 통행 가능한 다른 타일로 바꾼다.
      map.lowerTiles[y * map.width + x] = x === 1 && y === 1 ? TILE.DARK_GRASS : TILE.WALL;
    }
  }
  return draft;
}

afterEach(() => __clearPendingRegionApplyForTest());

describe("reviewRegionDraft — 진단만 하고 초안은 건드리지 않는다", () => {
  it("고립된 통행 셀을 error 로 보고하지만 원본으로 되돌리지 않는다", () => {
    const base = createBlankProject();
    const draft = isolatedCellDraft(base);
    const reviewed = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });

    expect(reviewed.report.issues.some((issue) =>
      issue.code === "disconnected-passable-cell" && issue.severity === "error")).toBe(true);
    // 예전에는 여기서 결정론 수리가 셀을 원본으로 복구했다 — 유령 미리보기와 적용 결과가 갈라졌다.
    expect([...reviewed.project.maps[base.startMapId]!.lowerTiles])
      .toEqual([...draft.maps[base.startMapId]!.lowerTiles]);
  });

  it("도달할 수 없는 자동 소품 조사 이벤트를 지우지 않는다", () => {
    const base = createBlankProject();
    const draft = isolatedCellDraft(base);
    draft.maps[base.startMapId]!.events.push({
      id: "ev_inspect_barrel",
      x: 1,
      y: 1,
      trigger: "action",
      commands: [{ kind: "text", body: "낡은 통이다" }],
    } as unknown as Project["maps"][string]["events"][number]);

    const reviewed = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });

    expect(reviewed.project.maps[base.startMapId]!.events.some((event) => event.id === "ev_inspect_barrel"))
      .toBe(true);
    expect(reviewed.report.issues.some((issue) => issue.code === "gameplay-event-unreachable")).toBe(true);
  });
});

describe("pendingRegionApply — 진단은 적용을 막지 못한다", () => {
  it("error 등급 소견이 있어도 사용자가 적용하면 적용된다", () => {
    const base = createBlankProject();
    const draft = isolatedCellDraft(base);
    let applied: Project | null = null;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: draft,
      mapId: base.startMapId,
      region: REGION,
      changedCells: 8,
      changedEvents: 0,
      instruction: "벽으로 막힌 칸을 만든다",
      report: reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION }).report,
      getCurrentProject: () => base,
      onApply: (project) => { applied = project; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    expect(pending.report?.issues.some((issue) => issue.severity === "error")).toBe(true);
    expect(pending.apply()).toMatchObject({ ok: true, applied: true });
    expect(applied).not.toBeNull();
    expect(pending.settled).toBe(true);
  });

  it("진단기가 예외를 던져도 적용은 진행된다", () => {
    const base = createBlankProject();
    let applies = 0;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: structuredClone(base),
      mapId: base.startMapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "진단 실패",
      getCurrentProject: () => base,
      reviewProject: () => { throw new Error("진단기 버그"); },
      onApply: () => { applies += 1; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    expect(pending.apply()).toMatchObject({ ok: true, applied: true });
    expect(applies).toBe(1);
    expect(pending.lastApplyError).toBeUndefined();
  });

  it("기준 프로젝트가 바뀌면 여전히 거부한다 — 이것은 검증이 아니라 동시편집 보호다", () => {
    const base = createBlankProject();
    const moved = structuredClone(base);
    moved.meta.title = "사용자가 그사이에 바꾼 프로젝트";
    let applies = 0;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: structuredClone(base),
      mapId: base.startMapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "stale base",
      getCurrentProject: () => moved,
      onApply: () => { applies += 1; },
      onDiscard: () => undefined,
      onSettle: () => undefined,
    });

    const outcome = pending.apply();
    expect(outcome).toMatchObject({ ok: false, applied: false });
    expect(outcome.error).toContain("기준 프로젝트");
    expect(applies).toBe(0);
  });
});
