// 미연시 2단계 — meta.oprnVnExtras 순수 규칙, 갤러리 잠금·엔딩 목록 상세, 세이브 카드 한 줄, set_vn_extras 도구, 네 언어 표 (2026-10-17).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { TOOL_LABELS } from "@/editor/panels/aiToolLabels";
import { createBlankProject } from "@/project/defaults";
import { fieldMenu, romanceFieldMenu } from "@/project/fieldMenu";
import {
  defaultVnExtras, endingChecklist, endingRecallLines, endingTierOf, galleryActive, galleryRows, listEndingRows, listGallerySlots,
  mergeVnExtras, normalizeSceneLine, resolveVnExtras, romanceVnExtras, saveSceneLine, validateVnExtras, vnExtrasLanguage,
} from "@/project/vnExtras";
import { VN_UI_STRINGS, vnUiText } from "@/player/vnExtrasStrings";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { createSaveSnapshot, saveToSlot, readSaveSlot, type SaveSlotIndex } from "@/player/saveSlots";
import { saveSlotCardModel, autosaveCardModel } from "@/player/playerLoadPanel";
import { startSession } from "@/project/session";
import { ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID } from "@/project/playableSegmentContract";
import type { Project } from "@/project/types";
import { PiGameSystemProduction } from "@/ai/piAgent/gameSystemProduction";

function romanceProject(): Project {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance" } as never;
  return project;
}

function withEndingsAndCg(project: Project): Project {
  project.endings = [
    { id: ROMANCE_ENDING_HAPPY_ID, name: "함께하는 봄", priority: 30, conditions: [{ kind: "friendshipAtLeast", npcKey: "npc_a", value: 60 }], epilogue: [{ kind: "say", speaker: "하루", text: "이제 같이 가자." }, { kind: "wait", frames: 10 }] },
    { id: ROMANCE_ENDING_NORMAL_ID, name: "좋은 친구", priority: 20, conditions: [{ kind: "friendshipAtLeast", npcKey: "npc_a", value: 25 }] },
    { id: SEGMENT_END_ENDING_ID, name: "혼자 걷는 길", priority: 1, conditions: [] },
  ] as never;
  const mapId = project.startMapId;
  project.maps[mapId]!.events.push({
    id: "ev_cg", name: "CG", x: 1, y: 1, pages: [{ commands: [{ kind: "showPicture", pictureId: 1, resourceId: "cg_a", recordInGallery: true }, { kind: "showPicture", pictureId: 2, resourceId: "cg_b", recordInGallery: true }, { kind: "showPicture", pictureId: 3, resourceId: "no_cg" }] }],
  } as never);
  return project;
}

describe("vnExtras resolution", () => {
  it("leaves a non-romance project untouched and turns everything on for a relationship game", () => {
    const plain = createBlankProject();
    expect(resolveVnExtras(plain)).toBeUndefined();
    expect(galleryActive(plain)).toBe(false);
    expect(listStatusMenuCommandIds(plain, startSession(plain, 1))).not.toContain("endings");
    const romance = romanceProject();
    expect(resolveVnExtras(romance)).toEqual(romanceVnExtras());
    // 엔딩 정의가 없으면 빈 항목을 만들지 않는다. 있으면 보인다.
    expect(listStatusMenuCommandIds(romance, startSession(romance, 1))).not.toContain("endings");
    const withEndings = withEndingsAndCg(romanceProject());
    expect(listStatusMenuCommandIds(withEndings, startSession(withEndings, 1))).toEqual(expect.arrayContaining(["endings", "gallery"]));
    expect(fieldMenu(romance)?.entries.map((e) => e.command) ?? romanceFieldMenu().entries.map((e) => e.command)).toContain("endings");
  });

  it("authored data wins over the default, and language falls back to the dialogue system then ko", () => {
    const romance = romanceProject();
    romance.meta.oprnVnExtras = { ...defaultVnExtras(), endings: { enabled: false, hideUnseen: true } };
    expect(resolveVnExtras(romance)?.endings.enabled).toBe(false);
    expect(vnExtrasLanguage(romance).language).toBe("ko");
    romance.meta.oprnDialogueSystem = { language: "en" } as never;
    expect(vnExtrasLanguage(romance).language).toBe("en");
    romance.meta.oprnVnExtras = { ...romanceVnExtras(), language: "ja" };
    expect(vnExtrasLanguage(romance).language).toBe("ja");
  });

  it("rejects unknown fields and wrong types instead of fixing them", () => {
    expect(() => validateVnExtras({ ...romanceVnExtras(), extra: 1 })).toThrow(/unknown field/);
    expect(() => validateVnExtras({ ...romanceVnExtras(), language: "fr" })).toThrow(/language/);
    expect(() => validateVnExtras({ ...romanceVnExtras(), gallery: { enabled: "yes", showLocked: true } })).toThrow(/boolean/);
    expect(() => validateVnExtras({ ...romanceVnExtras(), saveCards: { enabled: true, wat: 1 } })).toThrow(/unknown saveCards/);
    expect(() => validateVnExtras({ ...romanceVnExtras(), version: 2 })).toThrow(/version/);
    expect(() => validateVnExtras(romanceVnExtras())).not.toThrow();
    const merged = mergeVnExtras(romanceVnExtras(), { language: "en", endings: false });
    expect(merged.language).toBe("en");
    expect(merged.endings.enabled).toBe(false);
    expect(mergeVnExtras(merged, { language: "inherit" }).language).toBeUndefined();
  });
});

describe("gallery slots and ending rows", () => {
  it("lists only recordInGallery pictures and marks unopened ones locked", () => {
    const project = withEndingsAndCg(romanceProject());
    expect(listGallerySlots(project)).toEqual(["cg_a", "cg_b"]);
    expect(galleryRows(["cg_a", "cg_b"], ["cg_b", "old_cg"])).toEqual([
      { resourceId: "cg_a", locked: true }, { resourceId: "cg_b", locked: false }, { resourceId: "old_cg", locked: false },
    ]);
  });

  it("classifies endings into three outcomes and builds a per-character checklist", () => {
    const project = withEndingsAndCg(romanceProject());
    expect(project.endings!.map(endingTierOf)).toEqual(["happy", "normal", "solo"]);
    const rows = listEndingRows(project, [ROMANCE_ENDING_NORMAL_ID]);
    expect(rows.map((r) => r.id)).toEqual([ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID]);
    expect(rows.find((r) => r.id === ROMANCE_ENDING_NORMAL_ID)?.seen).toBe(true);
    expect(rows[0]!.characterId).toBe("npc_a");
    const checklist = endingChecklist(project, [ROMANCE_ENDING_NORMAL_ID], "공통");
    // 인물 행(npc_a: 해피·평범 정의) + 공통 행(혼자 걷는 길). 칸은 그 행 자신의 엔딩만 센다.
    expect(checklist).toHaveLength(2);
    expect(checklist[0]!.tiers.map((t) => [t.tier, t.defined, t.seen])).toEqual([["happy", true, false], ["normal", true, true], ["solo", false, false]]);
    expect(checklist[1]!.characterId).toBeUndefined();
    expect(checklist[1]!.tiers.map((t) => [t.tier, t.defined, t.seen])).toEqual([["happy", false, false], ["normal", false, false], ["solo", true, false]]);
  });

  it("recall lines keep only the written say beats", () => {
    const project = withEndingsAndCg(romanceProject());
    expect(endingRecallLines(project.endings![0]!)).toEqual([{ kind: "line", text: "이제 같이 가자.", speaker: "하루" }]);
    expect(endingRecallLines(project.endings![1]!)).toEqual([]);
  });
});

describe("status menu details", () => {
  function detail(project: Project, command: "gallery" | "endings", seen: string[], unlocked: string[]) {
    const session = startSession(project, 7);
    session.clearHistory = { endingIds: seen } as never;
    (session as { galleryUnlocks?: string[] }).galleryUnlocks = unlocked;
    return createStatusMenuDetail({ project, session, selectedCommand: command, slots: [], waitModeEnabled: true });
  }

  it("hides unseen ending names and shows progress and the checklist", () => {
    const project = withEndingsAndCg(romanceProject());
    const none = detail(project, "endings", [], []);
    expect(none.entries.find((e) => e.testId === "status-menu-endings-summary")?.value).toBe("0/3");
    expect(none.entries.filter((e) => e.testId?.match(/^status-menu-endings-\d/)).every((e) => e.label === "???")).toBe(true);
    expect(none.entries.some((e) => e.testId === "status-menu-endings-checklist-npc_a")).toBe(true);
    const some = detail(project, "endings", [ROMANCE_ENDING_HAPPY_ID], []);
    expect(some.entries.find((e) => e.testId === "status-menu-endings-0")?.label).toBe("함께하는 봄");
    expect(some.entries.find((e) => e.testId === "status-menu-endings-summary")?.value).toBe("1/3");
  });

  it("shows locked CG slots and a recall row only for seen endings", () => {
    const project = withEndingsAndCg(romanceProject());
    const first = detail(project, "gallery", [], ["cg_a"]);
    expect(first.entries.filter((e) => e.attributes?.["data-gallery-locked"] === "true")).toHaveLength(1);
    expect(first.entries.some((e) => e.testId?.startsWith("status-menu-gallery-ending-"))).toBe(false);
    const second = detail(project, "gallery", [ROMANCE_ENDING_HAPPY_ID], ["cg_a", "cg_b"]);
    expect(second.entries.some((e) => e.attributes?.["data-gallery-locked"] === "true")).toBe(false);
    expect(second.entries.filter((e) => e.testId?.startsWith("status-menu-gallery-ending-"))).toHaveLength(1);
    project.meta.oprnVnExtras = { ...romanceVnExtras(), gallery: { enabled: true, showLocked: false } };
    expect(detail(project, "gallery", [], []).entries.some((e) => e.attributes?.["data-gallery-locked"] === "true")).toBe(false);
  });

  it("an opted-out project keeps the legacy gallery behaviour", () => {
    const project = createBlankProject();
    const legacy = detail(project, "gallery", [], ["cg_a"]);
    expect(legacy.entries).toHaveLength(1);
    expect(legacy.entries[0]!.testId).toBe("status-menu-gallery-0");
  });
});

describe("save card scene line", () => {
  it("takes the last spoken line, truncates, and normalises stored values", () => {
    expect(saveSceneLine(undefined)).toBeUndefined();
    expect(saveSceneLine([{ kind: "line", text: "첫 줄" }, { kind: "choice", text: "선택" } as never, { kind: "line", text: "  마지막   줄 ", speaker: "하루" }])).toBe("하루: 마지막 줄");
    expect([...saveSceneLine([{ kind: "line", text: "가".repeat(100) }])!]).toHaveLength(44);
    expect(normalizeSceneLine(42)).toBeUndefined();
    expect(normalizeSceneLine("a\u0000b\n c")).toBe("a b c");
  });

  function slotWith(project: Project) {
    const session = startSession(project, 3);
    session.dialogueBacklog = [{ kind: "line", text: "안녕, 오늘도 잘 부탁해.", speaker: "하루" }];
    const snapshot = createSaveSnapshot(project, session);
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    return { snapshot, read: readSaveSlot(storage, 1 as SaveSlotIndex) };
  }

  it("is written and reloaded for a relationship game, shown on the card, and absent for others", () => {
    const romance = slotWith(romanceProject());
    expect(romance.snapshot.sceneLine).toBe("하루: 안녕, 오늘도 잘 부탁해.");
    expect(romance.read.kind).toBe("present");
    const model = saveSlotCardModel(romance.read);
    expect(model.scene).toBe("하루: 안녕, 오늘도 잘 부탁해.");
    expect(model.savedAt).toBeTruthy();
    expect(autosaveCardModel(romance.snapshot).scene).toBe(model.scene);
    const plain = slotWith(createBlankProject());
    expect(plain.snapshot.sceneLine).toBeUndefined();
    expect(saveSlotCardModel(plain.read).scene).toBeUndefined();
  });

  it("is off when the author turns saveCards off", () => {
    const project = romanceProject();
    project.meta.oprnVnExtras = { ...romanceVnExtras(), saveCards: { enabled: false } };
    expect(slotWith(project).snapshot.sceneLine).toBeUndefined();
  });
});

describe("set_vn_extras", () => {
  it("is registered with a label and a strict schema", () => {
    expect(TOOL_LABELS.set_vn_extras).toBeTruthy();
    const tool = toOpenAiTools().find((entry) => entry.function.name === "set_vn_extras");
    expect(tool).toBeTruthy();
    const params = tool!.function.parameters as { additionalProperties?: unknown; properties: Record<string, { type?: string; enum?: string[] }> };
    expect(params.additionalProperties).toBe(false);
    expect(params.properties.language?.enum).toEqual(["ko", "en", "ja", "zh", "auto", "inherit"]);
    expect(params.properties.preset?.enum).toEqual(["romance", "default"]);
    for (const key of ["gallery", "galleryShowLocked", "endings", "endingsHideUnseen", "saveCards"]) expect(params.properties[key]?.type).toBe("boolean");
  });

  it("changes only the given fields on top of the relationship default", () => {
    const ctx = { project: romanceProject() };
    const result = runTool(ctx, "set_vn_extras", { endings: false, language: "en" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.meta.oprnVnExtras).toMatchObject({ language: "en", gallery: { enabled: true }, endings: { enabled: false }, saveCards: { enabled: true } });
    expect((result.data as { vnExtras: { source: string } }).vnExtras.source).toBe("authored");
    const reset = runTool(ctx, "set_vn_extras", { preset: "default" });
    expect(reset.ok).toBe(true);
    expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
  });

  it("rejects wrong types and unknown arguments with a hint", () => {
    const ctx = { project: createBlankProject() };
    // 문자열 "true"/"false" 는 #3226(1150b31d27, jsonSchema coerceForSchema)부터 불리언으로 읽는다 — 틀린 타입 표본은 "yes".
    for (const args of [{ endings: "yes" }, { language: "fr" }, { preset: "visual" }, { endingsHideUnseen: 1 }, { cgs: true }]) {
      const result = runTool(ctx, "set_vn_extras", args as never);
      expect(result.ok, JSON.stringify(args)).toBe(false);
      expect(result.summary.length).toBeGreaterThan(10);
    }
    expect(ctx.project.meta.oprnVnExtras).toBeUndefined();
  });

  it("adding an endings/gallery menu entry also turns the feature on", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "configure_field_menu", { preset: "custom", entries: [{ command: "items", label: "소지품" }, { command: "endings", label: "엔딩" }, { command: "gallery", label: "갤러리" }, { command: "to-title", label: "타이틀로" }] });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.meta.oprnVnExtras).toMatchObject({ endings: { enabled: true }, gallery: { enabled: true } });
  });

  it("review flags a menu entry whose feature is off and counts as a system request", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "configure_field_menu", { preset: "custom", entries: [{ command: "items", label: "소지품" }, { command: "endings", label: "엔딩" }, { command: "to-title", label: "타이틀로" }] });
    runTool(ctx, "set_vn_extras", { endings: false });
    const view = runTool(ctx, "read_game_systems", {});
    expect(JSON.stringify(view.data)).toContain("엔딩 항목이 있지만");
    expect(new PiGameSystemProduction().requested).toBe(false);
  });
});

describe("four-language string table", () => {
  it("fills every language and keeps placeholders identical", () => {
    for (const [key, row] of Object.entries(VN_UI_STRINGS)) {
      for (const lang of ["ko", "en", "ja", "zh"] as const) expect(row[lang]?.trim(), `${key}.${lang}`).toBeTruthy();
      const slots = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join(",");
      for (const lang of ["en", "ja", "zh"] as const) expect(slots(row[lang]), `${key}.${lang}`).toBe(slots(row.ko));
    }
    expect(vnUiText({ language: "en" }, "endings.progress", 2, 5)).toBe("2/5");
    expect(vnUiText({ language: "ja" }, "gallery.locked")).toBe("未開放");
    expect(vnUiText(undefined, "gallery.locked")).toBe("잠김");
  });
});
