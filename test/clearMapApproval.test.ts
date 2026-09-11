import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposedCall } from "@/ai/assistantSession";
import { mapDestructionConfirmRequest, proposalHasMapDestruction } from "@/ai/mapDestructionConfirm";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import * as history from "@/editor/mapEditHistory";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import { store } from "@/project/store";

import type { Project } from "@/project/types";
const TARGET = "map_clear_target";

function projectFixture(): Project {
  // runTool 은 draft 를 ctx.project 로 되돌려준다 — 리터럴을 넘기면 생성 결과가 버려진다.
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", {
    id: TARGET, name: "청소 대상", width: 14, height: 12, bgm: { mode: "none" },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.issues));
  // 기본 생성 맵은 전부 잔디라 "안 바뀜"과 "청소됨"이 구별되지 않는다 — 청소가 보이도록 칠해 둔다.
  const painted = runTool(ctx, "paint_tiles", {
    mapId: TARGET, layer: "lower", mode: "rect",
    from: { x: 2, y: 2 }, to: { x: 8, y: 8 }, tile: TILE.PATH,
  });
  if (!painted.ok) throw new Error(JSON.stringify(painted.issues));
  return ctx.project;
}


/** store 를 건드리지 않는 초안 미리보기(runTool 은 draft 를 ctx 로 넘겨준다). */
function clearedPreview(): { proposed: Project; result: ToolResult } {
  const ctx: ToolContext = { project: store.getCurrent() };
  const result = runTool(ctx, "clear_map", { mapId: TARGET, confirmDestroy: true });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return { proposed: ctx.project, result };
}

function capture() {
  const current = store.getCurrent();
  return {
    base: captureProposalBase(current),
    baseline: new AuthoredProjectBaseline(current),
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(projectFixture());
  history.resetMapEditHistory();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("map destruction user approval payload", () => {
  function call(overrides: Partial<ProposedCall> = {}): ProposedCall {
    const result: ToolResult = {
      ok: true,
      summary: "clear_map",
      data: { mapId: TARGET, mapName: "청소 대상", fill: "grass", events: "keep", cells: 168, total: 168 },
    };
    return { name: "clear_map", args: { mapId: TARGET }, summary: "clear", result, destructive: true, ...overrides };
  }

  it("is required for clear_map and not for other destructive tools", () => {
    expect(proposalHasMapDestruction([call()])).toBe(true);
    expect(mapDestructionConfirmRequest([call()])).not.toBeNull();
    // 영역 청소·이벤트 삭제는 즉시 적용 + 되돌리기 정책 그대로다 — 이 모달을 태우지 않는다.
    expect(proposalHasMapDestruction([call({ name: "clear_region", destructive: true })])).toBe(false);
    expect(mapDestructionConfirmRequest([call({ name: "remove_event", destructive: true })])).toBeNull();
    expect(mapDestructionConfirmRequest([call({ name: "clear_map", result: { ok: true, summary: "s" } })])).not.toBeNull();
  });

  it("states the real numbers from the tool result, not the model's prose", () => {
    const request = mapDestructionConfirmRequest([call()]);
    expect(request?.title).toBe("맵 전체 청소 확인");
    expect(request?.confirmLabel).toBe("맵 비우기");
    expect(request?.message).toContain("'청소 대상'(map_clear_target)");
    expect(request?.message).toContain("168칸");
    expect(request?.message).toContain("잔디");
    expect(request?.message).toContain("이벤트는 유지");
    // 되돌리기로 복구된다는 사실을 모달이 직접 말한다(복구 경로가 바뀌면 여기서 깨진다).
    expect(request?.message).toContain("Ctrl+Z");
  });

  it("reports void fills and event removal when the run asked for them", () => {
    const request = mapDestructionConfirmRequest([call({
      result: {
        ok: true, summary: "clear_map",
        data: { mapId: TARGET, mapName: "청소 대상", fill: "empty", events: "remove", cells: 150, total: 168, keptCells: ["5,5"] },
      },
    })]);
    expect(request?.message).toContain("허공");
    expect(request?.message).toContain("이벤트까지 삭제");
    expect(request?.message).toContain("맵 168칸 중 통행 보장 칸 제외");
  });
});

describe("apply gate for unapproved map destruction", () => {
  it("refuses the batch and leaves the store untouched", async () => {
    const { base, baseline } = capture();
    const { proposed } = clearedPreview();
    const acceptedBytes = serialize(store.getCurrent());
    const snapshot = vi.spyOn(history, "recordProjectSnapshot");

    const result = await applyProposedProject(proposed, {
      base, baseline, source: "agent", summary: "맵 청소", toolNames: ["clear_map"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unapproved map destruction reached the store");
    expect(result.reason).toBe("map-destruction-unapproved");
    expect(result.issue).toContain("사용자 허가");
    expect(serialize(store.getCurrent())).toBe(acceptedBytes);
    expect(snapshot).not.toHaveBeenCalled();
    expect(history.getMapEditHistoryEntries()).toHaveLength(0);
    expect(store.getCurrent().maps[TARGET]?.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(false);
  });

  it("applies the same preview once the user approved it", async () => {
    const { base, baseline } = capture();
    const { proposed } = clearedPreview();

    const result = await applyProposedProject(proposed, {
      base, baseline, source: "agent", summary: "맵 청소", toolNames: ["clear_map"], mapDestructionApproved: true,
    });

    expect(result.ok, result.ok ? "" : `${result.reason} ${result.issue ?? ""}`).toBe(true);
    const map = store.getCurrent().maps[TARGET];
    expect(map?.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
    expect(map?.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    expect(history.getMapEditHistoryEntries()).toHaveLength(1);
  });
});
