// 대사창 읽기 보조(백로그·오토·스킵·숨기기) — 저작 스키마·순수 규칙·저장·메뉴·글자표 (2026-10-17).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { FIELD_MENU_COMMANDS, romanceFieldMenu, validateFieldMenu } from "@/project/fieldMenu";
import {
  BACKLOG_LIMIT_MAX, READ_FLAG_LIMIT, appendBacklog, autoAdvanceDelayMs, backlogEnabled, defaultDialogueSystem, dialogueReadKey,
  dialogueSystemHasControls, isDialogueRead, markDialogueRead, mergeDialogueSystem, normalizeBacklog, normalizeReadKeys,
  resolveDialogueSystem, romanceDialogueSystem, skipVerdict, stepStopReason, stopsReading, validateDialogueSystem, type BacklogHost,
} from "@/project/dialogueSystem";
import { DIALOGUE_UI_STRINGS, dialogueUiLocale, dialogueUiText } from "@/player/dialogueUiStrings";
import { scaleCssAlpha } from "@/player/dialogueWindowOpacity";
import { applyRomanceDefaults } from "@/project/romancePreset";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { startSession } from "@/project/session";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

function romanceProject() {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance" } as never;
  return project;
}

describe("authored schema", () => {
  it("accepts the default and romance systems and rejects unknown fields, bad enums and out-of-range numbers", () => {
    expect(() => validateDialogueSystem(defaultDialogueSystem())).not.toThrow();
    expect(() => validateDialogueSystem(romanceDialogueSystem())).not.toThrow();
    const bad = (mutate: (value: Record<string, unknown>) => void) => {
      const value = structuredClone(romanceDialogueSystem()) as unknown as Record<string, unknown>;
      mutate(value);
      return () => validateDialogueSystem(value);
    };
    expect(bad((v) => { v.extra = 1; })).toThrow(/unknown field/);
    expect(bad((v) => { v.version = 2; })).toThrow(/version 1/);
    expect(bad((v) => { v.language = "fr"; })).toThrow(/language/);
    expect(bad((v) => { (v.backlog as { limit: number }).limit = 5; })).toThrow(/limit/);
    expect(bad((v) => { (v.backlog as { limit: number }).limit = BACKLOG_LIMIT_MAX + 1; })).toThrow(/limit/);
    expect(bad((v) => { (v.backlog as { limit: number }).limit = 50.5; })).toThrow(/limit/);
    expect(bad((v) => { (v.auto as { enabled: unknown }).enabled = "yes"; })).toThrow(/enabled/);
    expect(bad((v) => { (v.defaults as { skipScope: string }).skipScope = "some"; })).toThrow(/skipScope/);
    expect(bad((v) => { (v.defaults as { windowOpacity: number }).windowOpacity = 0.1; })).toThrow(/windowOpacity/);
    expect(bad((v) => { (v.defaults as { windowOpacity: number }).windowOpacity = Number.NaN; })).toThrow(/windowOpacity/);
    expect(bad((v) => { (v.defaults as Record<string, unknown>).volume = 1; })).toThrow(/defaults/);
    expect(() => validateDialogueSystem(null)).toThrow();
    expect(() => validateDialogueSystem([])).toThrow();
  });

  it("merge fills only the supplied fields", () => {
    const merged = mergeDialogueSystem(romanceDialogueSystem(), { skip: false, defaults: { windowOpacity: 0.7 }, backlogLimit: 250 });
    expect(merged.skip.enabled).toBe(false);
    expect(merged.auto.enabled).toBe(true);
    expect(merged.backlog).toEqual({ enabled: true, limit: 250 });
    expect(merged.defaults).toEqual({ textSpeed: "normal", autoSpeed: "normal", skipScope: "read", windowOpacity: 0.7 });
    expect(() => validateDialogueSystem(merged)).not.toThrow();
  });

  it("survives project serialize -> deserialize and rejects a broken authored value at load", () => {
    const project = createBlankProject();
    project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { language: "en", defaults: { skipScope: "all" } });
    const loaded = deserialize(serialize(project));
    expect(loaded.meta.oprnDialogueSystem).toEqual(project.meta.oprnDialogueSystem);
    const wire = JSON.parse(serialize(project)) as { meta: { oprnDialogueSystem: Record<string, unknown> } };
    wire.meta.oprnDialogueSystem.language = "klingon";
    expect(() => deserialize(JSON.stringify(wire))).toThrow(/dialogueSystem/);
  });
});

describe("opt-in resolution (old projects stay unchanged)", () => {
  it("a plain project resolves to nothing; relationship games get the romance default; authored wins", () => {
    const plain = createBlankProject();
    expect(resolveDialogueSystem(plain)).toBeUndefined();
    expect(backlogEnabled(plain)).toBe(false);
    expect(dialogueSystemHasControls(resolveDialogueSystem(plain))).toBe(false);
    const romance = romanceProject();
    expect(resolveDialogueSystem(romance)).toEqual(romanceDialogueSystem());
    expect(backlogEnabled(romance)).toBe(true);
    romance.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { backlog: false });
    expect(backlogEnabled(romance)).toBe(false);
  });

  it("the ESC menu of a plain project has no backlog entry and a romance project does", () => {
    const plain = createBlankProject();
    expect(listStatusMenuCommandIds(plain, plain.session as never)).not.toContain("backlog");
    const romance = romanceProject();
    expect(listStatusMenuCommandIds(romance, romance.session as never)).toContain("backlog");
    romance.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { backlog: false });
    expect(listStatusMenuCommandIds(romance, romance.session as never)).not.toContain("backlog");
  });

  it("applyRomanceDefaults installs the system once and never overwrites an authored one", () => {
    const project = romanceProject();
    project.gameDesignBrief = { interview: { genre: "romance" } } as never;
    const first = applyRomanceDefaults(project);
    if (first.length > 0) {
      expect(project.meta.oprnDialogueSystem).toEqual(romanceDialogueSystem());
      project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { auto: false });
      expect(applyRomanceDefaults(project)).not.toContain("dialogueSystem");
      expect(project.meta.oprnDialogueSystem.auto.enabled).toBe(false);
    }
  });
});

describe("field menu entry validation", () => {
  it("backlog is a known command, the romance menu carries it, duplicates and unknown ids are rejected", () => {
    expect(FIELD_MENU_COMMANDS).toContain("backlog");
    expect(() => validateFieldMenu(romanceFieldMenu())).not.toThrow();
    expect(romanceFieldMenu().entries.map((row) => row.command)).toContain("backlog");
    expect(() => validateFieldMenu({ version: 1, entries: [{ command: "backlog", label: "백로그" }, { command: "backlog", label: "또" }] })).toThrow(/duplicate/);
    expect(() => validateFieldMenu({ version: 1, entries: [{ command: "history", label: "기록" }] })).toThrow();
    expect(() => validateFieldMenu({ version: 1, entries: [{ command: "backlog", label: "열두글자를넘기는아주긴이름표" }] })).toThrow(/label/);
  });
});

describe("backlog ring buffer", () => {
  it("never grows past the limit and keeps the newest entries", () => {
    const host: BacklogHost = {};
    for (let index = 0; index < 1200; index += 1) appendBacklog(host, { kind: "line", text: `line ${index}` }, 100);
    expect(host.dialogueBacklog).toHaveLength(100);
    expect(host.dialogueBacklog?.[0]).toEqual({ kind: "line", text: "line 1100" });
    expect(host.dialogueBacklog?.at(-1)).toEqual({ kind: "line", text: "line 1199" });
  });

  it("clamps an out-of-range limit to the hard cap", () => {
    const host: BacklogHost = {};
    for (let index = 0; index < BACKLOG_LIMIT_MAX + 50; index += 1) appendBacklog(host, { kind: "line", text: `l${index}` }, 99999);
    expect(host.dialogueBacklog).toHaveLength(BACKLOG_LIMIT_MAX);
  });

  it("normalizes hostile saved data: junk is dropped, strings are clipped, the list is re-cut to the project limit", () => {
    expect(normalizeBacklog("nope")).toBeUndefined();
    expect(normalizeBacklog([])).toBeUndefined();
    const cleaned = normalizeBacklog([
      null, 7, { kind: "line" }, { kind: "line", text: "  " }, { kind: "weird", text: "x" },
      { kind: "line", text: "x".repeat(5000), speaker: "S".repeat(500), extra: "drop" },
      { kind: "choice", picked: "yes", prompt: "p" },
      { kind: "choice", picked: "" },
    ]);
    expect(cleaned).toHaveLength(2);
    const first = cleaned?.[0];
    expect(first && first.kind === "line" && [...first.text].length).toBe(600);
    expect(first && first.kind === "line" && [...(first.speaker ?? "")].length).toBe(40);
    expect(first && "extra" in first).toBe(false);
    const many = Array.from({ length: 300 }, (_, index) => ({ kind: "line", text: `t${index}` }));
    expect(normalizeBacklog(many, 50)).toHaveLength(50);
    expect(normalizeBacklog(many, 50)?.[0]).toEqual({ kind: "line", text: "t250" });
    expect(normalizeBacklog(many)).toHaveLength(300);
  });
});

describe("read flags", () => {
  it("are stable per speaker+text, distinct across speakers, FIFO-capped, and sanitize hostile saves", () => {
    expect(dialogueReadKey("A", "hello")).toBe(dialogueReadKey("A", "hello"));
    expect(dialogueReadKey("A", "hello")).not.toBe(dialogueReadKey("B", "hello"));
    expect(dialogueReadKey(undefined, "hello")).not.toBe(dialogueReadKey("A", "hello"));
    const host: BacklogHost = {};
    markDialogueRead(host, "k1");
    expect(isDialogueRead(host, "k1")).toBe(true);
    expect(isDialogueRead(host, "k2")).toBe(false);
    for (let index = 0; index < READ_FLAG_LIMIT + 10; index += 1) markDialogueRead(host, `k${index.toString(36)}z`);
    expect(host.dialogueRead?.length).toBe(READ_FLAG_LIMIT);
    expect(normalizeReadKeys(["ok1", "ok1", "BAD KEY", 5, "a".repeat(20), "ok2"])).toEqual(["ok1", "ok2"]);
    expect(normalizeReadKeys("x")).toBeUndefined();
  });
});

describe("skip safety rules", () => {
  const base = { enabled: true, scope: "all" as const, isRead: true, endingEpilogue: false, lockedText: false };
  it("allows read text, and unread text only in the all scope", () => {
    expect(skipVerdict(base)).toEqual({ ok: true });
    expect(skipVerdict({ ...base, scope: "read", isRead: false })).toEqual({ ok: false, reason: "unread" });
    expect(skipVerdict({ ...base, scope: "all", isRead: false })).toEqual({ ok: true });
  });
  it("never skips an ending epilogue or a no-skip line, in any scope", () => {
    for (const scope of ["read", "all"] as const) {
      expect(skipVerdict({ ...base, scope, endingEpilogue: true })).toEqual({ ok: false, reason: "ending" });
      expect(skipVerdict({ ...base, scope, lockedText: true })).toEqual({ ok: false, reason: "locked" });
    }
  });
  it("refuses when the system has skip disabled", () => {
    expect(skipVerdict({ ...base, enabled: false })).toEqual({ ok: false, reason: "disabled" });
  });
  it("auto and skip stop at every interactive or scene-changing step", () => {
    for (const kind of ["choices", "presentItem", "inputNumber", "enterHeroName", "timedChoice", "quickTimeEvent", "teleportMenu", "transfer", "battleProcessing", "tacticsBattle", "shop", "inn", "gameOver", "returnToTitle", "openSaveMenu", "openMenuScreen", "openLoadMenu", "openChest", "sleepUntilMorning", "playMovie", "inputWait"]) {
      expect(stopsReading(kind), kind).toBe(true);
    }
    for (const kind of ["text", "wait", "playAudio", "showPicture"]) expect(stopsReading(kind), kind).toBe(false);
    expect(stepStopReason("choices")).toBe("choices");
    expect(stepStopReason("returnToTitle")).toBe("ending");
    expect(stepStopReason("battleProcessing")).toBe("boundary");
  });
  it("auto waits longer for longer text and per speed, bounded", () => {
    expect(autoAdvanceDelayMs(50, "normal")).toBeGreaterThan(autoAdvanceDelayMs(5, "normal"));
    expect(autoAdvanceDelayMs(20, "slow")).toBeGreaterThan(autoAdvanceDelayMs(20, "normal"));
    expect(autoAdvanceDelayMs(20, "normal")).toBeGreaterThan(autoAdvanceDelayMs(20, "fast"));
    expect(autoAdvanceDelayMs(1e9, "slow")).toBeLessThanOrEqual(12000);
    expect(autoAdvanceDelayMs(Number.NaN, "fast")).toBeGreaterThanOrEqual(600);
  });
});

describe("save round trip", () => {
  it("carries the backlog and read flags through a real save slot, and an old save starts clean", () => {
    const project = romanceProject();
    const session = startSession(project) as unknown as BacklogHost & ReturnType<typeof startSession>;
    appendBacklog(session, { kind: "line", text: "안녕", speaker: "하루" }, 100);
    appendBacklog(session, { kind: "choice", picked: "인사한다", prompt: "어떻게 할까?" }, 100);
    markDialogueRead(session, dialogueReadKey("하루", "안녕"));
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot) as unknown as BacklogHost;
    expect(restored.dialogueBacklog).toEqual(session.dialogueBacklog);
    expect(isDialogueRead(restored, dialogueReadKey("하루", "안녕"))).toBe(true);
    // 옛 세이브: 새 필드가 아예 없는 파일.
    const plainSession = startSession(project);
    const oldStorage = new MemoryStorage();
    saveToSlot(oldStorage, 1, createSaveSnapshot(project, plainSession));
    const oldRead = readSaveSlot(oldStorage, 1);
    expect(oldRead.kind).toBe("present");
    if (oldRead.kind !== "present") return;
    const oldRestored = applySaveSnapshot(project, oldRead.snapshot) as unknown as BacklogHost;
    expect(oldRestored.dialogueBacklog ?? []).toEqual([]);
    expect(oldRestored.dialogueRead ?? []).toEqual([]);
  });

  it("re-cuts an oversized saved backlog to the project limit", () => {
    const project = createBlankProject();
    project.meta.oprnDialogueSystem = mergeDialogueSystem(romanceDialogueSystem(), { backlogLimit: 20 });
    const session = startSession(project) as unknown as BacklogHost & ReturnType<typeof startSession>;
    session.dialogueBacklog = Array.from({ length: 400 }, (_, index) => ({ kind: "line" as const, text: `t${index}` }));
    const storage = new MemoryStorage();
    saveToSlot(storage, 2, createSaveSnapshot(project, session));
    const read = readSaveSlot(storage, 2);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot) as unknown as BacklogHost;
    expect(restored.dialogueBacklog).toHaveLength(20);
    expect(restored.dialogueBacklog?.at(-1)).toEqual({ kind: "line", text: "t399" });
  });

  it("a hostile save file cannot smuggle junk into the backlog", () => {
    const project = romanceProject();
    const session = startSession(project) as unknown as BacklogHost & ReturnType<typeof startSession>;
    const storage = new MemoryStorage();
    saveToSlot(storage, 3, createSaveSnapshot(project, session));
    const key = storage.key(0) as string;
    const tampered = JSON.parse(storage.getItem(key) as string) as Record<string, unknown>;
    const inner = tampered.session as Record<string, unknown>;
    inner.dialogueBacklog = [{ kind: "line", text: "ok" }, { kind: "evil", text: "x" }, "str", { kind: "line", text: 5 }];
    inner.dialogueRead = ["good1", { a: 1 }, "BAD KEY!"];
    storage.setItem(key, JSON.stringify(tampered));
    const read = readSaveSlot(storage, 3);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    const restored = applySaveSnapshot(project, read.snapshot) as unknown as BacklogHost;
    expect(restored.dialogueBacklog).toEqual([{ kind: "line", text: "ok" }]);
    expect(restored.dialogueRead).toEqual(["good1"]);
  });
});

describe("four-language string table", () => {
  const locales = ["ko", "en", "ja", "zh"] as const;
  it("has a non-empty entry in every language and identical placeholders", () => {
    for (const [key, row] of Object.entries(DIALOGUE_UI_STRINGS)) {
      const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort().join(",");
      for (const locale of locales) {
        expect(row[locale]?.trim(), `${key}/${locale}`).toBeTruthy();
        expect(row[locale], `${key}/${locale} garbled`).not.toMatch(/�/);
        expect(placeholders(row[locale]), `${key}/${locale} placeholders`).toBe(placeholders(row.ko));
      }
    }
  });
  it("english, japanese and chinese differ from korean for visible labels and the language switch works", () => {
    for (const key of ["option.autoSpeed", "option.skipScope", "backlog.title", "option.windowOpacity"] as const) {
      const row = DIALOGUE_UI_STRINGS[key];
      expect(row.en).not.toBe(row.ko);
      expect(row.ja).not.toBe(row.ko);
      expect(row.zh).not.toBe(row.ko);
    }
    expect(dialogueUiText({ language: "ko" }, "backlog.close")).toBe("닫기");
    expect(dialogueUiText({ language: "en" }, "backlog.close")).toBe("Close");
    expect(dialogueUiText({ language: "ja" }, "backlog.count", 3)).toBe("3行");
    expect(dialogueUiText(undefined, "backlog.close")).toBe("닫기");
    expect(dialogueUiLocale("auto")).toMatch(/^(ko|en|ja|zh)$/);
  });
  it("keeps the legacy options screen wording in korean", () => {
    expect(dialogueUiText(undefined, "option.title")).toBe("설정");
    expect(dialogueUiText(undefined, "option.textSpeed")).toBe("대사 속도");
    expect(dialogueUiText(undefined, "option.menuMotion")).toBe("메뉴 움직임 줄이기");
  });
});

describe("window opacity", () => {
  it("scales the alpha of every color function and leaves url images alone", () => {
    expect(scaleCssAlpha("rgba(12, 15, 30, 0.82)", 0.5)).toBe("rgba(12, 15, 30, 0.41)");
    expect(scaleCssAlpha("rgb(10, 20, 30)", 0.4)).toBe("rgb(10, 20, 30, 0.4)");
    expect(scaleCssAlpha("color(srgb 0.1 0.2 0.3 / 0.5)", 0.5)).toBe("color(srgb 0.1 0.2 0.3 / 0.25)");
    expect(scaleCssAlpha("linear-gradient(rgba(0, 0, 0, 0.2), rgb(1, 2, 3))", 0.5)).toBe("linear-gradient(rgba(0, 0, 0, 0.1), rgb(1, 2, 3, 0.5))");
    expect(scaleCssAlpha("rgba(0, 0, 0, 0.5)", 5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(scaleCssAlpha("rgba(0, 0, 0, 0.5)", Number.NaN)).toBe("rgba(0, 0, 0, 0.5)");
  });
});
