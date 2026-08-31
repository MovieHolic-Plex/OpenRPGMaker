import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  getMapEditHistoryDebugEntries,
  resetMapEditHistory,
} from "@/editor/mapEditHistory";
import {
  __clearPendingRegionApplyForTest,
  getPendingRegionApply,
  setPendingRegionApply,
} from "@/editor/regionTask/pendingRegionApply";
import { reviewRegionDraft, type HarnessReviewReport } from "@/editor/regionTask/harnessReview";
import { applyRegionProjectWithHistory } from "@/editor/regionTask/runRegionTask";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;

function clearReport(): HarnessReviewReport {
  return {
    issues: [],
    blockers: [],
    checkpoints: [],
    metrics: {
      changedCells: 0,
      changedEvents: 0,
      passableChangedCells: 0,
      isolatedChangedCells: 0,
      scheduledNpcs: 0,
      scheduleEntries: 0,
      timeSystemEnabled: false,
      roomSessions: 0,
      roomScoreAverage: null,
      deterministicRepairs: 0,
    },
    repairLimit: 8,
  };
}

afterEach(() => {
  __clearPendingRegionApplyForTest();
  resetMapEditHistory();
});

describe("tilemap harness safety review blockers", () => {
  it("counts only the initially active event page as a guaranteed transfer", () => {
    const base = createBlankProject();
    const draft = structuredClone(base);
    const source = draft.maps[draft.startMapId]!;
    const destinationId = "conditional_room";
    draft.maps[destinationId] = {
      ...structuredClone(source),
      id: destinationId,
      name: "Conditional room",
      events: [{
        id: "conditional-objective",
        x: draft.startPos.x,
        y: draft.startPos.y,
        trigger: "action",
        commands: [{ kind: "text", body: "Only reachable through a real door" }],
      } as unknown as Project["maps"][string]["events"][number]],
    };
    const movement = { type: "fixed", speed: 3, frequency: 3 };
    source.events.push({
      id: "conditional-door",
      x: draft.startPos.x,
      y: draft.startPos.y,
      trigger: "action",
      commands: [],
      pages: [
        { id: "closed", conditions: [], commands: [], movement },
        {
          id: "open-later",
          conditions: [{ kind: "switch", switchId: "sw_open_later", value: true }],
          commands: [{ kind: "transfer", mapId: destinationId, x: draft.startPos.x, y: draft.startPos.y }],
          movement,
        },
      ],
    } as unknown as Project["maps"][string]["events"][number]);

    const blocked = reviewRegionDraft({ base, draft, mapId: base.startMapId, region: REGION });
    expect(blocked.report.metrics.transferLinks).toBe(0);
    expect(blocked.report.issues.some((issue) => issue.code === "gameplay-event-unreachable"
      && issue.message.includes("conditional-objective"))).toBe(true);

    const initiallyOpen = structuredClone(draft);
    const openPage = initiallyOpen.maps[base.startMapId]!.events
      .find((event) => event.id === "conditional-door")!.pages![1]!;
    openPage.conditions = [{ kind: "switch", switchId: "sw_open_later", value: false }];
    const allowed = reviewRegionDraft({ base, draft: initiallyOpen, mapId: base.startMapId, region: REGION });
    expect(allowed.report.metrics.transferLinks).toBe(1);
    expect(allowed.report.issues.some((issue) => issue.code === "gameplay-event-unreachable"
      && issue.message.includes("conditional-objective"))).toBe(false);
  });

  it("keeps an apply failure retryable and settles only after success", () => {
    const base = createBlankProject();
    let attempts = 0;
    let settlements = 0;
    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: structuredClone(base),
      mapId: base.startMapId,
      region: REGION,
      changedCells: 1,
      changedEvents: 0,
      instruction: "retry apply",
      report: clearReport(),
      getCurrentProject: () => base,
      reviewProject: (project) => ({ project, report: clearReport() }),
      onApply: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("one-shot commit failure");
      },
      onDiscard: () => undefined,
      onSettle: () => { settlements += 1; },
    });

    expect(pending.apply()).toMatchObject({ ok: false, applied: false });
    expect(pending.lastApplyError).toContain("one-shot commit failure");
    expect(pending.settled).toBe(false);
    expect(getPendingRegionApply()).toBe(pending);
    expect(settlements).toBe(0);

    expect(pending.apply()).toMatchObject({ ok: true, applied: true });
    expect(attempts).toBe(2);
    expect(settlements).toBe(1);
    expect(getPendingRegionApply()).toBeNull();
  });

  it("rolls back authored state and history when store replacement throws", () => {
    const base = createBlankProject();
    store.replace(base, { preserveEventDrafts: false });
    resetMapEditHistory();
    const candidate = structuredClone(base);
    candidate.meta.title = "Atomic candidate";
    // 예외는 **교체 자체**에서 나게 만든다. store.emit 은 2026-08-29 부터 리스너 예외를
    // try/catch 로 격리하므로(구독자 하나가 나머지를 죽이던 실측 결함), 던지는 구독자로는
    // 더 이상 apply 경로에 예외가 도달하지 않는다 — 그 방식으로는 롤백이 검증되지 않는다.
    const replaceSpy = vi.spyOn(store, "replace").mockImplementationOnce(() => {
      throw new Error("store replacement failed after assignment");
    });

    try {
      const pending = setPendingRegionApply({
        baseProject: base,
        clippedProject: candidate,
        mapId: base.startMapId,
        region: REGION,
        changedCells: 0,
        changedEvents: 0,
        instruction: "atomic apply",
        report: clearReport(),
        getCurrentProject: () => store.getCurrent(),
        reviewProject: (project) => ({ project, report: clearReport() }),
        onApply: (project) => applyRegionProjectWithHistory(project, "atomic apply", base.startMapId),
        onDiscard: () => undefined,
        onSettle: () => undefined,
      });

      expect(pending.apply()).toMatchObject({ ok: false, applied: false });
      expect(store.getCurrent()).toEqual(base);
      expect(getMapEditHistoryDebugEntries()).toHaveLength(0);
      expect(pending.settled).toBe(false);

      expect(pending.apply()).toMatchObject({ ok: true, applied: true });
      expect(store.getCurrent().meta.title).toBe("Atomic candidate");
      expect(getMapEditHistoryDebugEntries()).toEqual([
        expect.objectContaining({ kind: "project", mapId: base.startMapId }),
      ]);
    } finally {
      replaceSpy.mockRestore();
      store.replace(createBlankProject(), { preserveEventDrafts: false });
    }
  });

  it("rejects a stale Vitest report when the current runner writes nothing", () => {
    const repoRoot = process.cwd();
    const temporaryRoot = mkdtempSync(join(tmpdir(), "rpg-zzu-gates-"));
    try {
      mkdirSync(join(temporaryRoot, "scripts"), { recursive: true });
      mkdirSync(join(temporaryRoot, ".omo"), { recursive: true });
      const reportPath = join(temporaryRoot, ".omo", "gates-vitest-report.json");
      const baselinePath = join(temporaryRoot, ".omo", "gates-baseline.json");
      writeFileSync(reportPath, JSON.stringify({
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        testResults: [{ name: "C:/old/test/known.test.ts", status: "failed" }],
      }));
      writeFileSync(baselinePath, JSON.stringify({ tests: { failedFiles: ["test/known.test.ts"] } }));
      writeFileSync(join(temporaryRoot, "scripts", "run-vitest.mjs"), "process.exit(1);\n");

      const result = spawnSync(process.execPath, [
        resolve(repoRoot, "scripts", "verify-gates.mjs"),
        "--only",
        "tests",
        "--json",
        "--baseline",
        baselinePath,
      ], { cwd: temporaryRoot, encoding: "utf8", timeout: 30_000 });

      expect(result.status).not.toBe(0);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
