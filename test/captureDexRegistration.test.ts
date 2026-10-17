// 포획 연출·도감 등록 문장 단위 테스트(2026-10-16, 작성만 — 실행은 감독자).
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { captureFailLine } from "@/player/battleDirectorDom";
import { approachScaleFor } from "@/player/battleActionBeats";
import type { Project } from "@/project/types";

function campaignProject(dexRegisteredText?: string): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.system.monsterCampaign = {
    id: "qa", name: "QA", speciesIds: ["species_wild_slime"], speciesNotes: {}, badges: [], locations: [], objectives: [],
    ...(dexRegisteredText ? { dexRegisteredText } : {}),
  };
  return project;
}

function capture(project: Project, switches: Record<string, boolean> = {}) {
  const runtime = createBattleRuntime({
    project, troopId: "troop_slime", canEscape: false, canLose: true, battleFlow: "strict",
    sessionState: { switches, variables: {}, inventory: { item_capture_orb: 3 } },
    captureLocation: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
    rng: () => 0,
  });
  runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
  return runtime.snapshot();
}

describe("capture dex registration line", () => {
  it("a first capture of a campaign species flags newDexEntry and records a dex line", () => {
    const snapshot = capture(campaignProject());
    expect(snapshot.lastCaptureResult?.success).toBe(true);
    expect(snapshot.lastCaptureResult?.newDexEntry).toBe(true);
    const line = snapshot.timeline.find((entry) => entry.kind === "special" && entry.aside === "dex");
    expect(line?.message).toMatch(/의 데이터가 도감에 등록되었다!$/u);
  });

  it("uses the authored wording with {name}", () => {
    const snapshot = capture(campaignProject("{name} 확보! 도감을 채웠다."));
    const line = snapshot.timeline.find((entry) => entry.kind === "special" && entry.aside === "dex");
    expect(line?.message).toMatch(/ 확보! 도감을 채웠다\.$/u);
    expect(line?.message).not.toContain("{name}");
  });

  it("stays silent for an already-caught species and for games without a campaign dex", () => {
    const again = capture(campaignProject(), { mx_caught_species_wild_slime: true });
    expect(again.lastCaptureResult?.success).toBe(true);
    expect(again.lastCaptureResult?.newDexEntry).toBeUndefined();
    expect(again.timeline.some((entry) => entry.aside === "dex")).toBe(false);

    const legacy = createBlankProject();
    legacy.system.monsterCollection = true;
    const plain = capture(legacy);
    expect(plain.lastCaptureResult?.newDexEntry).toBeUndefined();
    expect(plain.timeline.some((entry) => entry.aside === "dex")).toBe(false);
  });
});

describe("capture failure wording and campaign shape", () => {
  it("varies the non-emerald failure line by the roll while the emerald line stays fixed", () => {
    for (const shakes of [0, 1, 2, 3]) {
      const a = captureFailLine(shakes, 0.1, false);
      const b = captureFailLine(shakes, 0.1 + 1 / 997, false);
      expect(a).not.toBe(b);
      expect(captureFailLine(shakes, 0.1, true)).toBe(captureFailLine(shakes, 0.9, true));
    }
    expect(new Set([0, 1, 2, 3].map((n) => captureFailLine(n, 0.3, true))).size).toBe(4);
  });

  it("rejects a dexRegisteredText longer than 80 characters", () => {
    const base = { id: "a", name: "b", speciesIds: [], speciesNotes: {}, badges: [], locations: [], objectives: [] };
    expect(() => validateMonsterCampaign({ ...base, dexRegisteredText: "{name}!" })).not.toThrow();
    expect(() => validateMonsterCampaign({ ...base, dexRegisteredText: "가".repeat(81) })).toThrow();
  });

  it("scales the beat the way the sequencer divides the capture cinematic back out", () => {
    expect(approachScaleFor("light")).toBeLessThan(approachScaleFor("normal"));
    expect(approachScaleFor("normal")).toBe(1);
  });
});
