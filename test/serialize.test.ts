import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT_PALETTE, contactPalette, drawContactFrame } from "@/player/battleImpactDom";
import { normalizeActorRecord, normalizeActorPatch, normalizeBattleHitFlash } from "@/project/actorModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { FIELD_MENU_COMMANDS, romanceFieldMenu, validateFieldMenu } from "@/project/fieldMenu";
import { BACKLOG_LIMIT_MAX, READ_FLAG_LIMIT, appendBacklog, autoAdvanceDelayMs, backlogEnabled, defaultDialogueSystem, dialogueReadKey, dialogueSystemHasControls, isDialogueRead, markDialogueRead, mergeDialogueSystem, normalizeBacklog, normalizeReadKeys, resolveDialogueSystem, romanceDialogueSystem, skipVerdict, stepStopReason, stopsReading, validateDialogueSystem, type BacklogHost } from "@/project/dialogueSystem";
import { DIALOGUE_UI_STRINGS } from "@/player/dialogueUiStrings";
import { scaleCssAlpha } from "@/player/dialogueWindowOpacity";
import { applyRomanceDefaults } from "@/project/romancePreset";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { startSession } from "@/project/session";
import { ProjectFormatError } from "@/project/io/errors";
import { SHOP_MESSAGE_TYPES } from "@/project/shopMessages";
import type { Command, EventPage, GameEvent, MoveCommand, Project } from "@/project/types";
import { normalizeWorld } from "@/project/world/guards";
import { runTool } from "@/editor/tools";
import { runGameCheck } from "@/qa/gameCheck";
import { isolateTimers } from "./mergedTeardown";

describe("battleHitFlashTint", () => {
  isolateTimers();
  /** 착탄 섬광을 그릴 때 쓰인 색을 칠한 순서대로 모은다(캔버스 대신 기록기). */
  function paintedColors(frame: number, strength: number, palette?: Parameters<typeof drawContactFrame>[3]): string[] {
    const colors: string[] = [];
    const ctx = {
      fillStyle: "" as string,
      clearRect() {},
      fillRect() { colors.push(String(ctx.fillStyle)); },
    };
    drawContactFrame(ctx as unknown as CanvasRenderingContext2D, frame, strength, palette);
    return colors;
  }
  describe("battle hit flash tint", () => {
    it("draws today's white/gold contact when no tint is given", () => {
      expect(contactPalette(undefined)).toBe(DEFAULT_CONTACT_PALETTE);
      expect(DEFAULT_CONTACT_PALETTE).toEqual({ early: "#fff5b8", late: "#ffc75a", core: "#ffffff" });
      const early = new Set(paintedColors(0, 0));
      const late = new Set(paintedColors(3, 2));
      expect(early).toEqual(new Set(["#fff5b8", "#ffffff", "#ffc75a"]));
      expect(late).toEqual(new Set(["#ffc75a", "#ffffff"]));
      expect(paintedColors(1, 4)).toEqual(paintedColors(1, 4, DEFAULT_CONTACT_PALETTE));
    });

    it("draws only the given colours when a tint is set", () => {
      const palette = contactPalette({ core: "#e8eef4", edge: "#ff8a2a" });
      expect(palette).toEqual({ early: "#f4bc8f", late: "#ff8a2a", core: "#e8eef4" });
      const used = new Set([...paintedColors(0, 0, palette), ...paintedColors(4, 2, palette)]);
      expect(used).toEqual(new Set(["#f4bc8f", "#ff8a2a", "#e8eef4"]));
      for (const legacy of ["#fff5b8", "#ffc75a", "#ffffff"]) expect(used.has(legacy)).toBe(false);
      expect(paintedColors(2, 2, palette)).toHaveLength(paintedColors(2, 2).length);
    });

    it("accepts only #RRGGBB pairs on the actor record", () => {
      expect(normalizeBattleHitFlash({ core: "#E8EEF4", edge: " #ff8a2a " })).toEqual({ core: "#e8eef4", edge: "#ff8a2a" });
      for (const bad of [undefined, null, "#fff", { core: "#fff", edge: "#ff8a2a" }, { core: "red", edge: "#ff8a2a" }, { core: "#e8eef4" }, { core: "#e8eef4", edge: "url(x)" }]) {
        expect(normalizeBattleHitFlash(bad)).toBeUndefined();
      }
      const base = createBlankProject().database.actors[0]!;
      expect("battleHitFlash" in normalizeActorRecord(base)).toBe(false);
      expect(normalizeActorRecord({ ...base, battleHitFlash: { core: "#zzzzzz", edge: "#ff8a2a" } } as never).battleHitFlash).toBeUndefined();
      expect(normalizeActorPatch({ battleHitFlash: { core: "#112233", edge: "#445566" } }).battleHitFlash).toEqual({ core: "#112233", edge: "#445566" });
    });

    it("round-trips through save and load, and old projects load without it", () => {
      const project = createBlankProject();
      const before = deserialize(serialize(project));
      expect(before.database.actors.every((actor) => actor.battleHitFlash === undefined)).toBe(true);
      project.database.actors[0]!.battleHitFlash = { core: "#e8eef4", edge: "#ff8a2a" };
      const loaded = deserialize(serialize(project));
      expect(loaded.database.actors[0]!.battleHitFlash).toEqual({ core: "#e8eef4", edge: "#ff8a2a" });
    });
  });
});

// 대사창 읽기 보조(백로그·오토·스킵·숨기기) — 저작 스키마·순수 규칙·저장·메뉴·글자표 (2026-10-17).
describe("dialogueSystem", () => {
  isolateTimers();
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
});

describe("eventCommandRemediationShopMessages", () => {
  isolateTimers();
  describe("shop message persistence", () => {
    it.each(SHOP_MESSAGE_TYPES)("reloads the authorable %s message without losing shop settings", (messageType) => {
      // Given: a real project containing a shop authored with a picker-supported value.
      const project = createBlankProject();
      project.commonEvents = [{
        id: "common_audit_shop",
        name: "Shop persistence",
        trigger: "none",
        commands: [{
          kind: "shop",
          itemIds: [],
          messageType,
          allowSell: false,
          merchantGold: 37,
          branchOnTransaction: true,
          transactionBranch: [{ kind: "text", body: "Purchased" }],
        }],
      }];

      // When: the complete project passes through the shipping persistence boundary.
      const reloaded = deserialize(serialize(project));

      // Then: both the selected message and adjacent authored behavior survive.
      expect(reloaded.commonEvents.find(event => event.id === "common_audit_shop")?.commands[0]).toMatchObject({
        kind: "shop",
        messageType,
        allowSell: false,
        merchantGold: 37,
        branchOnTransaction: true,
        transactionBranch: [{ kind: "text", body: "Purchased" }],
      });
    });

    it("rejects an unknown message type at the project load boundary", () => {
      // Given: malformed external project data, not a valid authored command.
      const raw = JSON.stringify({
        ...createBlankProject(),
        commonEvents: [{
          id: "common_audit_invalid",
          name: "Invalid shop",
          trigger: "none",
          commands: [{ kind: "shop", itemIds: [], messageType: "not-a-shop-message" }],
        }],
      });

      // When / Then: loading still rejects values outside the authorable contract.
      expect(() => deserialize(raw)).toThrow(ProjectFormatError);
    });
  });
});

// 체공(점프·낙하) 저작값의 저장 왕복.
//
// `shapeCommandFields` 는 커맨드를 다시 만들지 않고 제자리에서 검증만 하므로 낙관적으로는
// 무조건 통과할 것 같지만, 여기서 잠그는 건 그 구현이 아니라 **계약**이다: 보스 강림 높이를
// 편집창에서 128px 로 잡아 놓고 저장 후 다시 열었을 때 기본값으로 돌아가면 플레이테스트까지
// 가서야 알게 된다(에디터 화면에는 아무 오류도 안 뜬다).
//
// 두 저작면을 모두 본다 — `moveEvent` 커맨드 경로(commandBodyRoute)와 페이지 자율 이동
// 경로(moveRouteDialog).
describe("hopPersistence", () => {
  isolateTimers();
  const AUTHORED_MOVES: readonly MoveCommand[] = [
    // 두 칸 건너뛰는 점프 + 높이·시간 저작. dx/dy 는 음수도 실려야 한다.
    { kind: "jump", dx: 2, dy: -1, heightPx: 48, durationMs: 1200 },
    // 보스 강림: 8칸(128px) 위에서 1.5 초 낙하.
    { kind: "dropIn", heightPx: 128, durationMs: 1500 },
    // 옵션을 생략한 형태도 그대로 남아야 한다(런타임 기본값을 따르는 저작 의도).
    { kind: "jump", dx: 0, dy: 0 },
    { kind: "dropIn" },
  ];
  function projectWithHopRoute(): ReturnType<typeof createBlankProject> {
    const project = createBlankProject();
    const commands: Command[] = [
      { kind: "moveEvent", eventId: "ev_boss", route: { moves: [...AUTHORED_MOVES], repeat: false, wait: true } },
    ];
    const page: EventPage = {
      id: "page_hop_roundtrip",
      name: "체공 왕복 테스트 페이지",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      // 페이지 자율 이동 경로(사용자 정의)에도 같은 저작값을 싣는다.
      movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [...AUTHORED_MOVES], repeat: true } },
      commands,
    };
    const event: GameEvent = {
      id: "ev_boss",
      characterId: "char_hop_roundtrip",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands,
      pages: [page],
    };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("blank project has no start map");
    map.events = [...map.events, event];
    return project;
  }
  describe("체공 저작값 persistence", () => {
    it("BREAK: heightPx/durationMs/dx/dy 가 serialize→deserialize 를 그대로 통과한다", () => {
      // 프로젝트 전체 toEqual 은 쓰지 않는다 — 타일셋 지식의 `undefined` 필드가 JSON 왕복에서
      // 사라지는 무관한 비대칭이 있다. 여기서 볼 것은 경로 저작값이다.
      const restored = deserialize(serialize(projectWithHopRoute()));
      // 두 번째 왕복도 같은 값 — 첫 왕복에서 기본값이 채워져 굳는 경로가 없다는 뜻.
      const twice = deserialize(serialize(restored));

      for (const project of [restored, twice]) {
        const event = project.maps[project.startMapId]?.events.at(-1);
        const command = event?.pages?.[0]?.commands[0];
        if (command?.kind !== "moveEvent") throw new Error("moveEvent command missing after round trip");
        expect(command.route.moves).toEqual(AUTHORED_MOVES);
        expect(event?.pages?.[0]?.movement.route?.moves).toEqual(AUTHORED_MOVES);
      }
    });

    it("BREAK: 체공 옵션의 타입을 검증한다 — 문자열 높이는 조용히 통과하지 않는다", () => {
      const raw = JSON.parse(serialize(projectWithHopRoute())) as {
        maps: Record<string, { events: { pages: { commands: { route: { moves: Record<string, unknown>[] } }[] }[] }[] }>;
        startMapId: string;
      };
      const moves = raw.maps[raw.startMapId]?.events.at(-1)?.pages[0]?.commands[0]?.route.moves;
      if (!moves?.[1]) throw new Error("dropIn move missing in serialized payload");
      moves[1].heightPx = "128";
      expect(() => deserialize(JSON.stringify(raw))).toThrow(/heightPx/);
    });
  });
});

describe("projectWikiDomain", () => {
  isolateTimers();
  const source = { id: "turn-1", kind: "user", text: "Use contact battles", at: 1 } as const;
  const wiki = { kind: "declaration", basis: "explicit", sources: [source], combatMode: "contact" } as const;
  const entity = { id: "w_battles", type: "guideline", name: "Battles", summary: "Contact battles", origin: "ai", wiki } as const;
  describe("project wiki persistence", () => {
    it("preserves optional wiki metadata when normalizing existing world entities", () => {
      const result = normalizeWorld({ entities: [entity], relations: [] });
      expect(result.entities[0]).toEqual(entity);
    });

    it("preserves metadata through actual project serialization and loading", () => {
      const project = createBlankProject();
      project.world = { entities: [entity], relations: [] };
      const result = deserialize(serialize(project));
      expect(result.world?.entities[0]).toEqual(entity);
    });

    it("leaves legacy records without wiki metadata unchanged", () => {
      const legacy = { id: "w_legacy", type: "concept", name: "Moon", summary: "Silver", origin: "user", locked: true } as const;
      const result = normalizeWorld({ entities: [legacy], relations: [] });
      expect(result.entities).toEqual([legacy]);
    });

    it.each([
      { ...wiki, basis: "guessed" },
      { ...wiki, kind: "todo" },
      { ...wiki, combatMode: "jrpg" },
      { ...wiki, sources: [] },
      { ...wiki, sources: [{ ...source, at: "yesterday" }] },
      { ...wiki, sources: [{ ...source, kind: "llm" }] },
    ])("rejects malformed stored metadata %#", (invalid) => {
      expect(() => normalizeWorld({ entities: [{ ...entity, wiki: invalid }], relations: [] })).toThrow();
    });

    it("rejects dangling supersedes references", () => {
      expect(() => normalizeWorld({ entities: [{ ...entity, wiki: { ...wiki, supersedes: ["w_missing"] } }], relations: [] })).toThrow();
    });
  });
});

describe("qaGameMystery", () => {
  isolateTimers();
  const BRIEF = "추리 게임. 저택 독살 사건, 용의자 둘, 틀린 사람을 지목하면 배드 엔딩.";
  function mysteryProject(): Project {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const result = runTool(ctx, "author_mystery_case", {
      caseId: "qa", title: "저택 독살 사건", victim: { name: "바론" }, culprit: "butler",
      suspects: [
        { id: "butler", name: "집사 토마스", at: { mapId, x: 3, y: 3 }, alibi: ["부엌에 있었습니다."], motive: ["퇴직금 문제."],
          lie: { claim: "찻잔엔 손도 안 댔습니다.", contradictedBy: "teacup", truth: ["…제가 차를 올렸습니다."] } },
        { id: "elena", name: "약초상 엘레나", at: { mapId, x: 7, y: 3 }, alibi: ["약방에 있었어요."], motive: ["임대료."] },
      ],
      clues: [
        { id: "teacup", name: "독이 남은 찻잔", at: { mapId, x: 3, y: 10 }, description: "집사의 은쟁반 위 찻잔에 쓴 가루.", implicates: ["butler"], obtainedBy: "examine" },
        { id: "receipt", name: "약방 영수증", at: { mapId, x: 8, y: 12 }, description: "사건 시각 엘레나가 약방에서 발행한 영수증.", excludes: ["elena"], obtainedBy: "examine" },
      ],
      accuser: { name: "경비대장 로버트", at: { mapId, x: 14, y: 5 } },
      endings: { solved: { name: "사건 해결", lines: ["집사를 체포하겠네."] }, wrong: { name: "미궁", lines: ["엉뚱한 사람을 잡았군…"] } },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    return deserialize(serialize(ctx.project));
  }
  describe("qa gameCheck — 추리 장르", () => {
    it("author_mystery_case 사건은 정답·오답 엔딩 둘 다 자동 플레이로 닿고 추리 경고가 없다", () => {
      const report = runGameCheck(mysteryProject(), { briefText: BRIEF, autoPlayBudgetMs: 30_000 });
      const runs = report.autoPlay?.runs ?? [];
      expect(report.autoPlay?.skipped).toBeUndefined();
      expect(runs.map((run) => [run.label.startsWith("다른 엔딩") ? "다른 엔딩" : run.label, run.ok])).toEqual([["기본 경로", true], ["다른 엔딩", true]]);
      expect(new Set(runs.map((run) => run.endingReached)).size).toBe(2);
      expect(report.findings.filter((f) => f.code.startsWith("mystery-"))).toEqual([]);
    });

    it("증거 없이 말만 걸면 닿는 엔딩을 짚는다", () => {
      const project = mysteryProject();
      project.maps[project.startMapId].events.push({
        id: "ev_shortcut", name: "수상한 노인", x: 12, y: 12, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {}, commands: [{ kind: "triggerEnding", endingId: project.endings?.[0]?.id ?? "ending_x" }] }],
      } as never);
      const report = runGameCheck(project, { briefText: BRIEF, skipAutoPlay: true });
      const finding = report.findings.find((f) => f.code === "mystery-ending-unconditioned");
      expect(finding?.where?.eventId).toBe("ev_shortcut");
    });

    it("추리가 아닌 기획에는 아무것도 내지 않는다", () => {
      const report = runGameCheck(createBlankProject(), { briefText: "눈 내리는 마을 모험", skipAutoPlay: true });
      expect(report.findings.filter((f) => f.code.startsWith("mystery-"))).toEqual([]);
    });
  });
});
