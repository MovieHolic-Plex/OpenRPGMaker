import { describe, expect, it, vi } from "vitest";
import {
  createDefaultM2Fields,
  isM2CatalogEntrySelectableInBattleEvent,
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  m2CatalogEntryRuntimeSupport,
  m2CommandById,
} from "@/project/eventCommands/m2Catalog";
import { commandRuntimeSupport, m2CommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { newM2Command } from "@/editor/eventCommandFactory";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import type { Frame, InterpreterState } from "@/player/interpreter/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

describe("m2 event command catalog", () => {
  it("covers every non-front-matter PDF command row with stable ids", () => {
    const pdfEntries = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108);

    expect(pdfEntries).toHaveLength(108);
    expect(M2_COMMAND_CATALOG).toHaveLength(125);
    expect(new Set(M2_COMMAND_CATALOG.map((entry) => entry.id)).size).toBe(125);
    // 주석은 탭 1 저작면의 1급 카드가 아니다 — 시스템·도구 탭으로 옮겼다.
    expect(pageCount(1)).toBe(34);
    expect(pageCount(2)).toBeGreaterThan(0);
    expect(pageCount(3)).toBeGreaterThan(0);
    expect(pdfEntries.filter((entry) => entry.pickerPage === 4).length).toBeGreaterThan(0);
  });

  it("classifies the required validation commands explicitly", () => {
    expect(requireEntry("Display Text Settings").existingKind).toBe("displayTextSettings");
    expect(requireEntry("Return to Title Screen").existingKind).toBe("returnToTitle");
    expect(requireEntry("Shop Processing").existingKind).toBe("shop");
    expect(requireEntry("Inn Processing").existingKind).toBe("inn");
    expect(requireEntry("Input Number").existingKind).toBe("inputNumber");
    expect(requireEntry("Key Input Processing").existingKind).toBe("inputWait");
    expect(requireEntry("Wait").existingKind).toBe("wait");
    expect(requireEntry("Change Skills").existingKind).toBe("learnSkill");
    expect(requireEntry("Change Skills").runtimeSupport).toBe("runtime-full");
    expect(requireEntry("Change Equipment").existingKind).toBe("changeEquipment");
    expect(requireEntry("Change HP").existingKind).toBe("changeActorHp");
    expect(requireEntry("Change MP").existingKind).toBe("changeActorMp");
    expect(requireEntry("Recover All").existingKind).toBe("recoverAll");
    expect(requireEntry("Change EXP").existingKind).toBe("changeExp");
    expect(requireEntry("Change Level").existingKind).toBe("changeLevel");
    expect(M2_COMMAND_CATALOG.some((entry) => entry.title === "Ending")).toBe(false);
  });

  it("keeps the normal map picker limited to map-safe commands", () => {
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Show Text"))).toBe(true);
    expect(requireEntry("Comment").runtimeSupport).toBe("editor-only");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Comment"))).toBe(true);
    expect(requireEntry("Display Text Settings").runtimeSupport).toBe("runtime-full");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Display Text Settings"))).toBe(true);
    // 배지 정직성(2026-08-20): 카탈로그의 정적 runtimeSupport 는 컨텍스트를 모르는
    // 보수 판정(세 컨텍스트 중 최저)이다. Open Load Menu(m2-093)는 behaviorClass full
    // 이지만 M2_MAP_COMMON_FULL_IDS 밖이므로 map 컨텍스트에서도 partial 이다.
    expect(requireEntry("Open Load Menu").runtimeSupport).toBe("runtime-partial");
    expect(m2CatalogEntryRuntimeSupport(requireEntry("Open Load Menu"), "map")).toBe("runtime-partial");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Open Load Menu"))).toBe(true);
    expect(requireEntry("Break Loop").runtimeSupport).toBe("runtime-full");
    expect(requireEntry("Break Loop").existingKind).toBe("breakLoop");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Break Loop"))).toBe(true);
    expect(requireEntry("Loop").existingKind).toBe("loop");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Loop"))).toBe(true);
    // Move Picture(m2-052)는 map/common full, troop partial — 정적 값은 보수 partial,
    // 실제 편집 컨텍스트(map)에서는 full 로 표시된다.
    expect(requireEntry("Move Picture").runtimeSupport).toBe("runtime-partial");
    expect(m2CatalogEntryRuntimeSupport(requireEntry("Move Picture"), "map")).toBe("runtime-full");
    expect(requireEntry("Move Picture").bodyStrategy).toBe("generic");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Move Picture"))).toBe(true);
    // Change Enemy HP(m2-098)는 troop 전용 full — 정적 보수 값은 partial.
    expect(requireEntry("Change Enemy HP").runtimeSupport).toBe("runtime-partial");
    expect(m2CatalogEntryRuntimeSupport(requireEntry("Change Enemy HP"), "troop")).toBe("runtime-full");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Enemy HP"))).toBe(false);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Skills"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Equipment"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change HP"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Recover All"))).toBe(true);
  });

  it("selects every non-battle PDF row in the map picker and excludes battle-only rows", () => {
    const mapRows = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108 && isM2CatalogEntrySelectableInMap(entry));

    // m2-055(Show Animation 중복 등재)는 2026-08-27 초보자 UX 픽스로 맵 피커에서 제외됐다.
    // 판정 정본은 `DEPRECATED_M2_COMMAND_IDS` (은퇴 레지스트리) 다.
    expect(mapRows.map((entry) => entry.index)).toEqual(
      Array.from({ length: 97 }, (_, index) => index + 1).filter((index) => index !== 55),
    );
    const pageOneRows = mapRows.filter((entry) => entry.pickerPage === 1);
    const pageOneGroupsByTitle = new Map(pageOneRows.map((entry) => [entry.title, entry.pickerGroup]));
    expect(pageOneRows.map((entry) => entry.title)).toEqual(
      expect.arrayContaining([
      "Show Text",
      "Display Text Settings",
      "Change Faceset",
      "Show Choices",
      "Input Number",
      "Control Switches",
      "Control Variables",
      "Change Gold",
      "Change Items",
      "Shop Processing",
      "Inn Processing",
      "Transfer Player",
      "Move Event",
      "Wait for All Movement",
      "Wait",
      "Play BGM",
      "Fadeout BGM",
      "Play SE",
      "Conditional Branch",
      "Erase Event",
      // 2026-08-26 IA 수리: 흐름·시간·입력·BGM 기억은 시스템 탭이 아니라 탭 1 저작면이다.
      "Control Timer",
      "Name Input Processing",
      "Label",
      "Jump to Label",
      "Loop",
      "Break Loop",
      "End Event Processing",
      "Memorize Current BGM",
      "Play Memorized BGM",
      ])
    );
    expect(pageOneRows).toHaveLength(29);
    // 탭 1 헤딩은 RM 분류명이 아니라 저작면이다: 말하기 / 고르기 / 옮기기 / 거래 / 흐름 / 소리.
    expect(pageOneGroupsByTitle.get("Show Text")).toBe("말하기");
    expect(pageOneGroupsByTitle.get("Show Choices")).toBe("고르기");
    expect(pageOneGroupsByTitle.get("Control Switches")).toBe("흐름");
    expect(pageOneGroupsByTitle.get("Conditional Branch")).toBe("흐름");
    expect(pageOneGroupsByTitle.get("Transfer Player")).toBe("옮기기");
    expect(pageOneGroupsByTitle.get("Erase Event")).toBe("옮기기");
    expect(pageOneGroupsByTitle.get("Change Gold")).toBe("거래");
    expect(pageOneGroupsByTitle.get("Play BGM")).toBe("소리");
    expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change EXP");
    expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change System BGM");
    expect(new Set(pageOneRows.map((entry) => entry.pickerGroup))).toEqual(
      new Set(["말하기", "고르기", "옮기기", "거래", "흐름", "소리"])
    );
    for (const page of [1, 2, 3, 4] as const) {
      expect(new Set(mapRows.filter((entry) => entry.pickerPage === page).map((entry) => entry.pickerGroup)).size).toBeGreaterThan(
        0
      );
    }
  });

  it("allows battle-only commands only in troop battle event authoring", () => {
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Enemy Encounter"))).toBe(false);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Battleback"))).toBe(false);

    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Enemy Encounter"))).toBe(true);
    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Change Battleback"))).toBe(true);
    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Open Load Menu"))).toBe(true);
    expect(createDefaultM2Fields(requireEntry("Enemy Encounter"))).toEqual({ target: "" });
    expect(createDefaultM2Fields(requireEntry("Change Battleback"))).toEqual({ resourceId: "" });
  });

  it("keeps duplicate Show Animation sections as separate catalog features", () => {
    const showAnimations = M2_COMMAND_CATALOG.filter((entry) => entry.title === "Show Animation");

    expect(showAnimations).toHaveLength(3);
    expect(new Set(showAnimations.map((entry) => entry.id)).size).toBe(3);
  });

  it("creates typed default fields for every generic m2 command", () => {
    const genericEntries = M2_COMMAND_CATALOG.filter((entry) => !entry.existingKind);

    expect(genericEntries.length).toBeGreaterThan(70);
    for (const entry of genericEntries) {
      const command = newM2Command(entry.id);
      expect(command).toEqual({
        kind: "m2Command",
        commandId: entry.id,
        fields: createDefaultM2Fields(entry),
      });
      expect(m2CommandById(command.commandId)).toBe(entry);
    }
  });

  it("adds a complete modern command group without hiding it behind legacy PDF-only rows", () => {
    const modernTitles = [
      "Camera Control",
      "Screen Effect",
      "Spawn Event",
      "Remove Event",
      "Pathfind Move",
      "Wait Until",
      "Region Trigger",
      "Quest Objective",
      "Advanced Dialogue",
      "Sound Layer",
      "Weighted Branch",
      "Cutscene Control",
      "Checkpoint Save",
      "UI Command",
      "Debug Log",
      "Evaluate Expression",
      "Data Query",
    ];

    // 배지 정직성(2026-08-20): 정적 runtimeSupport 는 보수 판정. 모던 커맨드 중
    // Advanced Dialogue 만 네이티브 text 변환(runtime-full)이고, 나머지는 troop(및 일부는
    // map/common) 컨텍스트에서 partial 이므로 보수 값이 runtime-partial 이다.
    // map 컨텍스트 full 여부는 M2_MAP_COMMON_FULL_IDS 멤버십이 정본이다.
    // 2026-08-26 IA 수리: 모던 명령도 성격대로 탭을 받는다. 시스템·도구만 탭 4 에 남는다.
    const modernPageByTitle: Readonly<Record<string, number>> = {
      "Camera Control": 3,
      "Screen Effect": 3,
      "Spawn Event": 3,
      "Remove Event": 3,
      "Pathfind Move": 3,
      "Region Trigger": 3,
      "Cutscene Control": 3,
      "Wait Until": 1,
      "Weighted Branch": 1,
      "Quest Objective": 1,
      "Advanced Dialogue": 1,
      "Sound Layer": 1,
      "Checkpoint Save": 4,
      "UI Command": 4,
      "Debug Log": 4,
      "Evaluate Expression": 4,
      "Data Query": 4,
    };
    const mapFullModernTitles = new Set(["Camera Control", "Spawn Event", "Remove Event"]);
    for (const title of modernTitles) {
      const entry = requireEntry(title);
      expect(entry.runtimeSupport).toBe(title === "Advanced Dialogue" ? "runtime-full" : "runtime-partial");
      expect(m2CatalogEntryRuntimeSupport(entry, "map")).toBe(
        title === "Advanced Dialogue" || mapFullModernTitles.has(title) ? "runtime-full" : "runtime-partial"
      );
      if (title === "Advanced Dialogue") {
        expect(entry.bodyStrategy).toBe("existing");
        expect(entry.existingKind).toBe("text");
        expect(createDefaultM2Fields(entry)).toEqual({});
      } else {
        expect(entry.bodyStrategy).toBe("generic");
        expect(createDefaultM2Fields(entry)).not.toEqual({});
      }
      expect(entry.pickerPage).toBe(modernPageByTitle[title]);
      // Advanced Dialogue 는 「문장 표시」로 통합된 은퇴 행이다 — 새로 저작하는 경로가 없어야 한다.
      expect(isM2CatalogEntrySelectableInMap(entry)).toBe(title !== "Advanced Dialogue");
      expect(entry.label).not.toBe(title);
    }
  });

  it("publishes only the three runtime support grades", () => {
    // 배지 정직성(2026-08-20): 정적 카탈로그 값은 보수 판정이므로 세 등급이 모두 나타난다.
    // (M2_MAP_COMMON_FULL_IDS 와 M2_TROOP_FULL_IDS 는 서로소라 순수 m2 행은 모두 partial.)
    const grades = new Set(M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport));
    expect(grades).toEqual(new Set(["runtime-full", "runtime-partial", "editor-only"]));
    expect(M2_COMMAND_CATALOG.map((entry) => entry.supportStatus)).toEqual(
      M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport)
    );
    expect(requireEntry("Comment").supportStatus).toBe("editor-only");
    // inputWait is map-full but troop-partial, so its context-free native alias grade is conservative.
    expect(requireEntry("Key Input Processing").supportStatus).toBe("runtime-partial");
    expect(m2CatalogEntryRuntimeSupport(requireEntry("Key Input Processing"), "map")).toBe("runtime-full");
    expect(m2CatalogEntryRuntimeSupport(requireEntry("Key Input Processing"), "troop")).toBe("runtime-partial");
    expect(requireEntry("Show Text").supportStatus).toBe("runtime-full");
    // 아래 다섯 개는 M2_MAP_COMMON_FULL_IDS 멤버 — map/common 에서는 full 이지만
    // troop 에서는 partial 이므로 컨텍스트 없는 정적 값은 보수적으로 partial 이다.
    for (const title of ["Change Parameters", "Change State", "Damage Processing", "Change Actor Graphic", "Scroll Map"]) {
      expect(requireEntry(title).supportStatus).toBe("runtime-partial");
      expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "map")).toBe("runtime-full");
      expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "common")).toBe("runtime-full");
      expect(m2CatalogEntryRuntimeSupport(requireEntry(title), "troop")).toBe("runtime-partial");
    }
  });

  it("keeps the support table aligned with implemented battle M2 ids", () => {
    // 배틀 전용 커맨드의 full 판정은 troop 컨텍스트로 확인한다(정적 값은 보수 partial).
    const fullBattleIds = M2_COMMAND_CATALOG
      .filter((entry) => entry.index >= 98 && entry.index <= 108 && m2CatalogEntryRuntimeSupport(entry, "troop") === "runtime-full")
      .map((entry) => entry.id);

    expect(fullBattleIds).toEqual([
      "m2-098-change-enemy-hp",
      "m2-099-change-enemy-mp",
      "m2-100-change-enemy-state",
      "m2-101-enemy-encounter",
      "m2-102-change-battleback",
      "m2-103-show-animation",
      "m2-104-battle-events",
      "m2-105-abort-battle",
      "m2-106-call-common-event",
      "m2-107-force-escape",
      "m2-108-action-times",
    ]);
    for (const entry of M2_COMMAND_CATALOG.filter((candidate) => !candidate.existingKind)) {
      expect(m2CommandRuntimeSupport(entry.id)).toBe(entry.runtimeSupport);
      expect(commandRuntimeSupport(newM2Command(entry.id))).toBe(entry.runtimeSupport);
    }
  });

  it("does not let generic editor-only m2 commands fall through the interpreter unknown branch", () => {
    const entry = requireEntry("Comment");
    const command = newM2Command(entry.id);
    const frame: Frame = { commands: [command], pc: 0 };
    const state: InterpreterState = {
      stack: [frame],
      session: createSession(),
      maxStackDepth: 8,
      maxLoopIterations: 8,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = executeCommand(state, frame, command);

    expect(result).toEqual({ kind: "continue" });
    expect(frame.pc).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("applies display text settings in the map interpreter runtime path", () => {
    const entry = requireEntry("Display Text Settings");
    const command = newM2Command(entry.id);
    const frame: Frame = { commands: [command], pc: 0 };
    const state: InterpreterState = {
      stack: [frame],
      session: createSession(),
      maxStackDepth: 8,
      maxLoopIterations: 8,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = executeCommand(state, frame, command);

    expect(result).toEqual({ kind: "continue" });
    expect(frame.pc).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    expect(state.session.messageWindowSettings).toEqual({
      format: "normal",
      position: "bottom",
      preventObscuringPlayer: true,
      allowEventMovementDuringWait: false,
    });
    warn.mockRestore();
  });
});

function pageCount(page: 1 | 2 | 3 | 4): number {
  return M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page).length;
}

function requireEntry(title: string) {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`Missing m2 command catalog entry: ${title}`);
  return entry;
}

function createSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_test",
    x: 0,
    y: 0,
  };
}
