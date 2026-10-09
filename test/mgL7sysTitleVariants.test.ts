import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { applyTitleVariant, normalizeTitleScreenVariants, resolveTitleVariant } from "@/project/titleVariants";
import { recordEndingClear, readClearRecord } from "@/player/clearRecord";
import { createSaveSnapshot, latestResumableSave, readLatestSave, saveToSlot, writeAutosave } from "@/player/saveSlots";
import type { Project, SaveSnapshot, TitleScreenSettings } from "@/project/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function titleProject(): Project {
  const project = createBlankProject();
  const title = project.system.titleScreen!;
  title.backgroundResourceId = "bg_default";
  title.musicResourceId = "bgm_default";
  title.variants = [
    { when: { kind: "endingSeen", endingId: "ending_true" }, backgroundResourceId: "bg_true", musicResourceId: "bgm_true" },
    { when: { kind: "clearCount", atLeast: 2 }, backgroundResourceId: "bg_two" },
    { when: { kind: "saveMapId", mapId: "map_castle" }, musicResourceId: "bgm_castle" },
  ];
  return project;
}

function snapshotAt(project: Project, mapId: string, savedAt: string): SaveSnapshot {
  const session = startSession(project, 1);
  session.currentMapId = mapId;
  return { ...createSaveSnapshot(project, session), savedAt };
}

describe("title variants and resume on launch (#17)", () => {
  it("picks the first matching variant by ending, clear count and last save map", () => {
    const title = titleProject().system.titleScreen!;
    expect(resolveTitleVariant(title, {})).toBeUndefined();
    expect(applyTitleVariant(title, { endingIds: ["ending_true"] }).backgroundResourceId).toBe("bg_true");
    const two = applyTitleVariant(title, { endingIds: ["ending_a", "ending_b"] });
    expect(two.backgroundResourceId).toBe("bg_two");
    // 변형이 음악을 비워 두면 기본 음악 그대로.
    expect(two.musicResourceId).toBe("bgm_default");
    const castle = applyTitleVariant(title, { lastSaveMapId: "map_castle" });
    expect(castle.backgroundResourceId).toBe("bg_default");
    expect(castle.musicResourceId).toBe("bgm_castle");
    // 순서가 우선순위다 — 참 엔딩이 성 저장보다 앞선다.
    expect(applyTitleVariant(title, { endingIds: ["ending_true"], lastSaveMapId: "map_castle" }).musicResourceId).toBe("bgm_true");
  });

  it("reads the ending ids that recordEndingClear writes", () => {
    const project = titleProject();
    const storage = new MemoryStorage();
    recordEndingClear(storage, project, startSession(project, 1), "ending_true");
    const endingIds = readClearRecord(storage)?.endingIds ?? [];
    expect(applyTitleVariant(project.system.titleScreen!, { endingIds }).backgroundResourceId).toBe("bg_true");
  });

  it("readLatestSave returns the newest of the manual slots and the autosave", () => {
    const project = titleProject();
    const storage = new MemoryStorage();
    expect(readLatestSave(storage)).toBeUndefined();
    saveToSlot(storage, 1, snapshotAt(project, project.startMapId, "2026-01-01T00:00:00.000Z"));
    writeAutosave(storage, snapshotAt(project, project.startMapId, "2026-03-01T00:00:00.000Z"));
    saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
    expect(readLatestSave(storage)?.source).toBe("autosave");
    saveToSlot(storage, 3, snapshotAt(project, project.startMapId, "2026-04-01T00:00:00.000Z"));
    const latest = readLatestSave(storage);
    expect(latest?.source === "slot" ? latest.slot : undefined).toBe(3);
  });

  it("resume on launch targets the newest save only when the option is on", () => {
    const project = titleProject();
    const storage = new MemoryStorage();
    saveToSlot(storage, 2, snapshotAt(project, project.startMapId, "2026-02-01T00:00:00.000Z"));
    expect(latestResumableSave(project, storage)).toBeUndefined();
    project.system.titleScreen!.resumeOnLaunch = true;
    const latest = latestResumableSave(project, storage);
    expect(latest?.source === "slot" ? latest.slot : undefined).toBe(2);
    expect(latestResumableSave(project, new MemoryStorage())).toBeUndefined();
  });

  it("keeps variants and resumeOnLaunch through serialize/deserialize and drops invalid rows", () => {
    // 로드 검증은 리소스 id 가 실재하는지 본다 — 기본 프로젝트가 가진 타이틀 배경·음악 id 를 변형에 쓴다.
    const project = createBlankProject();
    const title = project.system.titleScreen!;
    const background = title.backgroundResourceId ?? project.system.titleResourceId;
    const music = title.musicResourceId;
    title.variants = [
      { when: { kind: "clearCount", atLeast: 1 }, ...(background ? { backgroundResourceId: background } : {}), ...(music ? { musicResourceId: music } : {}) },
      { when: { kind: "saveMapId", mapId: project.startMapId } },
    ];
    title.resumeOnLaunch = true;
    const reloaded = deserialize(serialize(project)).system.titleScreen as TitleScreenSettings;
    expect(reloaded.variants).toEqual(project.system.titleScreen!.variants);
    expect(reloaded.resumeOnLaunch).toBe(true);
    const legacy = deserialize(serialize(createBlankProject())).system.titleScreen!;
    expect(legacy.variants).toBeUndefined();
    expect(legacy.resumeOnLaunch).toBeUndefined();
    const broken = createBlankProject();
    broken.system.titleScreen!.variants = [{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "missing_bg" }];
    expect(() => deserialize(serialize(broken))).toThrow(/variants\[0\]\.backgroundResourceId/);
    expect(normalizeTitleScreenVariants([
      { when: { kind: "endingSeen", endingId: " " } },
      { when: { kind: "nope" } },
      { when: { kind: "clearCount", atLeast: 0 }, backgroundResourceId: " bg " },
    ])).toEqual([{ when: { kind: "clearCount", atLeast: 1 }, backgroundResourceId: "bg" }]);
  });
});
