import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const REGION = { x: 0, y: 0, width: 4, height: 4 } as const;


afterEach(() => {
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

  // 삭제됨: 승인 게이트(setPendingRegionApply)의 재시도·원자성 테스트 2건.
  // approvalPolicy 상 승인 대기가 없어졌고 적용은 조수 경로(applyProposedProject)가 한다 —
  // 커밋 게이트 거부는 스토어를 건드리지 않고 false 를 돌려주며, 그 계약은
  // test/applyChangesetToStore.test.ts 가 고정한다.
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
