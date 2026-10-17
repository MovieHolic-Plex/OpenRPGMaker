// 미연시 수리(vn-review-2) — 기기 기록(엔딩·CG), 체크리스트 칸, 도구 경계, 요청 낱말, 장면 한 줄 정리 (2026-10-17).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { recordGalleryUnlock, GALLERY_UNLOCK_MAX } from "@/project/gallery";
import { endingChecklist, listGallerySlots, normalizeSceneLine, saveSceneLine, SCENE_LINE_MAX } from "@/project/vnExtras";
import { galleryRecordKey, readGalleryRecord, recordGalleryUnlockOnDevice, syncSessionWithDeviceRecords } from "@/player/deviceRecords";
import { recordEndingClear } from "@/player/clearRecord";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { VN_UI_STRINGS } from "@/player/vnExtrasStrings";
import { GAME_SYSTEM_REQUEST_PATTERN, PiGameSystemProduction } from "@/ai/piAgent/gameSystemProduction";
import type { Project } from "@/project/types";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  key(index: number): string | null { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
}

function romance(): Project {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance" } as never;
  return project;
}

function addCg(project: Project, ids: readonly string[]): void {
  project.maps[project.startMapId]!.events.push({
    id: "ev_cg", name: "CG", x: 1, y: 1,
    pages: [{ commands: ids.map((resourceId, index) => ({ kind: "showPicture", pictureId: index + 1, resourceId, recordInGallery: true })) }],
  } as never);
}

describe("B1/B3 device records", () => {
  it("restores the ending history and the opened CGs after any session replace, across slots and new games", () => {
    const project = romance();
    project.endings = [{ id: "end_a", name: "A", priority: 1, conditions: [] }] as never;
    addCg(project, ["cg_a", "cg_b"]);
    const storage = new MemoryStorage();
    const first = startSession(project, 1);
    recordEndingClear(storage, project, first, "end_a");
    recordGalleryUnlockOnDevice(storage, "cg_a", listGallerySlots(project));
    // 불러온 세션은 clearHistory 도 해금도 없다(옛 저장).
    const loaded = startSession(project, 2);
    delete loaded.clearHistory;
    syncSessionWithDeviceRecords(storage, project, loaded);
    expect(loaded.clearHistory?.endingIds).toContain("end_a");
    expect(loaded.galleryUnlocks).toEqual(["cg_a"]);
    // 새 게임도 같다.
    const fresh = startSession(project, 3);
    syncSessionWithDeviceRecords(storage, project, fresh);
    expect(fresh.galleryUnlocks).toEqual(["cg_a"]);
    expect(fresh.clearHistory?.endingIds).toContain("end_a");
  });

  it("migrates a per-slot unlock into the device record and keeps old saves compatible", () => {
    const project = romance();
    addCg(project, ["cg_a", "cg_b"]);
    const storage = new MemoryStorage();
    const old = startSession(project, 1);
    old.galleryUnlocks = ["cg_b"];
    syncSessionWithDeviceRecords(storage, project, old);
    expect(readGalleryRecord(storage)).toEqual(["cg_b"]);
    // 다른 칸의 옛 세이브가 들어와도 합쳐진다.
    const other = startSession(project, 2);
    other.galleryUnlocks = ["cg_a"];
    syncSessionWithDeviceRecords(storage, project, other);
    expect([...readGalleryRecord(storage)].sort()).toEqual(["cg_a", "cg_b"]);
    expect([...other.galleryUnlocks!].sort()).toEqual(["cg_a", "cg_b"]);
  });

  it("writes nothing for a game without unlocks and ignores a corrupt record", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    syncSessionWithDeviceRecords(storage, project, startSession(project, 1));
    expect(storage.length).toBe(0);
    storage.setItem(galleryRecordKey(), "{not json");
    expect(readGalleryRecord(storage)).toEqual([]);
  });

  it("keeps live gallery ids when the unlock list overflows (C9)", () => {
    const session: { galleryUnlocks?: string[] } = { galleryUnlocks: Array.from({ length: GALLERY_UNLOCK_MAX }, (_, i) => `old_${i}`) };
    recordGalleryUnlock(session, "cg_live", new Set(["cg_live", "old_199"]));
    expect(session.galleryUnlocks).toHaveLength(GALLERY_UNLOCK_MAX);
    expect(session.galleryUnlocks).toContain("cg_live");
    expect(session.galleryUnlocks).toContain("old_199");
    expect(session.galleryUnlocks).not.toContain("old_0");
    expect(session.galleryUnlocks).toContain("old_198");
  });
});

describe("C2 ending checklist", () => {
  function twoPeople(): Project {
    const project = romance();
    project.endings = [
      { id: "ending_with_char_haru_normal", name: "하루와 평범", priority: 2, conditions: [{ kind: "friendshipAtLeast", npcKey: "char_haru", value: 25 }] },
      { id: "ending_with_char_mina_normal", name: "미나와 평범", priority: 2, conditions: [{ kind: "friendshipAtLeast", npcKey: "char_mina", value: 25 }] },
      { id: "ending_alone", name: "혼자", priority: 1, conditions: [] },
    ] as never;
    return project;
  }

  it("fills a person's cells only from that person's own endings and never shows a raw id", () => {
    const project = twoPeople();
    const rows = endingChecklist(project, ["ending_with_char_haru_normal"], "공통");
    const haru = rows.find((row) => row.characterId === "char_haru")!;
    const mina = rows.find((row) => row.characterId === "char_mina")!;
    expect(haru.tiers.find((t) => t.tier === "normal")?.seen).toBe(true);
    expect(mina.tiers.find((t) => t.tier === "normal")?.seen).toBe(false);
    expect(rows.some((row) => /char_/.test(row.name))).toBe(false);
    expect(haru.name).toBe("???");
    expect(rows.at(-1)?.name).toBe("공통");
  });

  it("uses a person's display name when the project knows one", () => {
    const project = twoPeople();
    project.maps[project.startMapId]!.events.push({ id: "ev_haru", name: "하루", x: 0, y: 0, npcKey: "char_haru", pages: [{ commands: [] }] } as never);
    const rows = endingChecklist(project, [], "공통");
    expect(rows.find((row) => row.characterId === "char_haru")?.name).not.toMatch(/^char_/);
  });
});

describe("B2 the ending list scrolls", () => {
  it("renders ten people without dropping any checklist row", () => {
    const project = romance();
    project.endings = Array.from({ length: 10 }, (_, i) => ({ id: `ending_with_c${i}_happy`, name: `해피 ${i}`, priority: 3, conditions: [{ kind: "friendshipAtLeast", npcKey: `c${i}`, value: 50 }] })) as never;
    const detail = createStatusMenuDetail({ project, session: startSession(project, 1), selectedCommand: "endings", slots: [], waitModeEnabled: true });
    expect(detail.entries.filter((entry) => entry.testId?.startsWith("status-menu-endings-checklist-"))).toHaveLength(10);
  });
});

describe("C3/C4 gallery rows", () => {
  it("does not repeat the picture number in the value column and carries no locked hint", () => {
    const project = romance();
    addCg(project, ["cg_a"]);
    const session = startSession(project, 1);
    session.galleryUnlocks = ["cg_a"];
    const detail = createStatusMenuDetail({ project, session, selectedCommand: "gallery", slots: [], waitModeEnabled: true });
    const row = detail.entries.find((entry) => entry.label.includes("1"));
    expect(row?.value ?? "").toBe("");
    expect(JSON.stringify(detail)).not.toContain("unavailableReason");
    expect(Object.keys(VN_UI_STRINGS)).not.toContain("gallery.lockedHint");
  });
});

describe("C5 default romance menu and save screens follow the authored language", () => {
  it("translates only the unauthored default labels", () => {
    const project = romance();
    project.meta.oprnDialogueSystem = { version: 1, language: "en", backlog: { enabled: true, limit: 100 }, auto: { enabled: true }, skip: { enabled: true }, hideButton: { enabled: true } } as never;
    expect(statusMenuCommandLabel("save", false, project)).toBe("Save");
    expect(statusMenuCommandLabel("relationships", false, project)).toBe("Affection");
    expect(statusMenuCommandLabel("to-title", false, project)).toBe("Title");
    const detail = createStatusMenuDetail({ project, session: startSession(project, 1), selectedCommand: "save", slots: [{ slot: 1, kind: "empty" } as never], waitModeEnabled: true });
    expect(detail.title).toBe("Save");
    expect(detail.entries[0]!.label).toBe("Slot 1");
    expect(detail.entries[0]!.value).toBe("Empty");
  });

  it("keeps Korean for ko, for a non-romance game, and for an author-written label", () => {
    const korean = romance();
    expect(statusMenuCommandLabel("save", false, korean)).toBe("저장");
    const plain = createBlankProject();
    plain.meta.oprnDialogueSystem = { version: 1, language: "en", backlog: { enabled: true, limit: 100 }, auto: { enabled: false }, skip: { enabled: false }, hideButton: { enabled: false } } as never;
    expect(statusMenuCommandLabel("save", false, plain)).toBe("저장");
    const authored = romance();
    authored.meta.oprnDialogueSystem = plain.meta.oprnDialogueSystem;
    authored.meta.oprnFieldMenu = { version: 1, entries: [{ command: "save", label: "기록" }] };
    expect(statusMenuCommandLabel("save", false, authored)).toBe("기록");
  });
});

describe("C1 review_game_systems", () => {
  const issues = (project: Project): string[] => ((runTool({ project }, "read_game_systems", {}).data as { issues: string[] }).issues);

  it("does not warn about missing CGs for the unauthored romance default", () => {
    const project = romance();
    expect(issues(project).some((text) => text.includes("CG 칸이 비어"))).toBe(false);
  });

  it("warns when the author turned the gallery on without any CG", () => {
    const project = romance();
    const ctx = { project };
    runTool(ctx, "set_vn_extras", { gallery: true });
    expect(issues(ctx.project).some((text) => text.includes("CG 칸이 비어"))).toBe(true);
  });

  it("flags an old authored menu without a gallery entry when there is something to open", () => {
    const project = romance();
    addCg(project, ["cg_a"]);
    project.meta.oprnFieldMenu = { version: 1, entries: [{ command: "items", label: "소지품" }, { command: "endings", label: "엔딩" }, { command: "save", label: "저장" }] };
    expect(issues(project).some((text) => text.includes("갤러리 항목이 없어"))).toBe(true);
  });
});

describe("C6 tool boundaries", () => {
  it("spells the menu notice without a stray particle", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "configure_field_menu", { preset: "romance" });
    expect(result.summary).toContain("갤러리·엔딩 항목이 있어");
    expect(result.summary).not.toContain("엔딩가");
  });

  it("does not turn an explicit off back on when the menu is re-applied", () => {
    const ctx = { project: romance() };
    runTool(ctx, "set_vn_extras", { gallery: false });
    const result = runTool(ctx, "configure_field_menu", { preset: "romance" });
    expect(ctx.project.meta.oprnVnExtras?.gallery.enabled).toBe(false);
    expect(result.summary).toContain("꺼 둔 상태");
  });

  it("writes nothing for an empty set_vn_extras on a non-romance project", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "set_vn_extras", {});
    expect(result.ok).toBe(true);
    expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
  });

  it("clears and returns to automatic for preset default even with other fields", () => {
    const ctx = { project: romance() };
    runTool(ctx, "set_vn_extras", { saveCards: false });
    const result = runTool(ctx, "set_vn_extras", { preset: "default", gallery: true });
    expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
    expect(result.summary).toContain("적용하지 않았습니다");
  });

  it("sees a set_vn_extras change in the completion fingerprint", () => {
    const ctx = { project: romance() };
    const production = new PiGameSystemProduction();
    const read = runTool(ctx, "read_game_systems", {});
    production.record("read_game_systems", read, ctx.project);
    production.record("review_game_systems", { ...read, data: { issues: [] } } as never, ctx.project);
    production.record("configure_field_menu", read, ctx.project);
    expect(production.inspect(ctx.project)).toEqual([]);
    runTool(ctx, "set_vn_extras", { saveCards: false });
    expect(production.inspect(ctx.project).length).toBeGreaterThan(0);
  });
});

describe("C8 request words", () => {
  it.each(["미술관 갤러리 호러 게임 만들어 줘", "make a horror gallery game", "저장 칸을 5개로", "ギャラリーを舞台にしたホラー"])("does not match %s", (text) => {
    expect(GAME_SYSTEM_REQUEST_PATTERN.test(text)).toBe(false);
  });
  it.each(["CG 갤러리 화면 추가해 줘", "갤러리 화면에 엔딩 회상", "add a CG gallery", "gallery screen with locked slots", "저장 칸 카드에 마지막 대사", "CGギャラリーを付けて", "엔딩 목록 만들어 줘"])("matches %s", (text) => {
    expect(GAME_SYSTEM_REQUEST_PATTERN.test(text)).toBe(true);
  });
});

describe("C9 scene lines and the slot cache", () => {
  it("drops bidirectional controls", () => {
    expect(normalizeSceneLine("abc‮def")).toBe("abcdef");
    expect(saveSceneLine([{ kind: "line", text: "x⁦y⁩z" }])).toBe("xyz");
  });

  it("never cuts an emoji sequence in the middle", () => {
    const family = "👨‍👩‍👧‍👦";
    const line = normalizeSceneLine(family.repeat(SCENE_LINE_MAX + 5))!;
    expect(line.endsWith("…")).toBe(true);
    const body = line.slice(0, -1);
    expect(body.length % family.length).toBe(0);
    expect(body.startsWith(family)).toBe(true);
  });

  it("notices an in-place edit of the same project object", () => {
    const project = romance();
    addCg(project, ["cg_a"]);
    expect(listGallerySlots(project)).toEqual(["cg_a"]);
    const event = project.maps[project.startMapId]!.events.find((e) => e.id === "ev_cg")!;
    event.pages[0]!.commands.push({ kind: "showPicture", pictureId: 9, resourceId: "cg_z", recordInGallery: true } as never);
    expect(listGallerySlots(project)).toEqual(["cg_a", "cg_z"]);
  });
});
