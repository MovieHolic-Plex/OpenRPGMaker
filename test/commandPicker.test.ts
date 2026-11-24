import { describe, expect, it, beforeAll } from "vitest";
import { eventCommandPickerSearchEntries, eventCommandPickerTabEntries, EVENT_COMMAND_PICKER_NATIVE_KINDS, EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS } from "@/editor/panels/eventEditor/commandPicker";
import { type M2CommandPickerPage, M2_COMMAND_CATALOG, type M2CommandCatalogEntry } from "@/project/eventCommands/m2Catalog";
import { COMMAND_PRESENTATION_DESCRIPTORS, commandPresentationDescriptor, commandPresentationGroupLabel } from "@/editor/eventCommands/commandPresentation";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import { mapScreenNativeSurfaceGroup, pickerPageForM2Command } from "@/project/eventCommands/m2PickerLayout";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import type { Command } from "@/project/types";
import { COMMAND_KIND_OPTIONS, PAGE_COMMAND_BUTTONS, commandKindLabel } from "@/editor/panels/eventEditor/options";
import { MODERN_COMMAND_ROWS, PDF_COMMAND_ROWS } from "@/project/eventCommands/m2CatalogData";
import { isolateTimers } from "./mergedTeardown";

// 명령 선택기 버튼의 data-testid 는 항목마다 유일해야 한다.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 실브라우저에서 명령 선택기의
// "문장 표시"를 클릭하려다 Playwright strict mode 위반이 났다 — 같은
// command-picker-add-text 를 단 버튼이 둘이었다(m2-001-show-text, m2-209-advanced-dialogue).
// testid 를 네이티브 종류(existingKind)로만 만들어서, 같은 종류로 접히는 카탈로그 항목이
// 둘이면 그대로 겹친다. 겹치면 e2e 가 어느 쪽인지 지목할 수 없다.
describe("commandPickerTestIds", () => {
  isolateTimers();
  const PICKER_PAGES: readonly M2CommandPickerPage[] = [1, 2, 3, 4];
  function duplicates(ids: readonly string[]): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    return [...dupes].sort();
  }
  describe("명령 선택기 testid", () => {
    it("검색 목록 전체에서 겹치는 testid 가 없다", () => {
      const entries = eventCommandPickerSearchEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(duplicates(entries.map((entry) => entry.testId))).toEqual([]);
    });

    it("각 탭 안에서도 겹치는 testid 가 없다", () => {
      for (const page of PICKER_PAGES) {
        const ids = eventCommandPickerTabEntries(page).map((entry) => entry.testId);
        expect(duplicates(ids), `${page} 탭`).toEqual([]);
      }
    });

    it("문장 표시는 종전 손잡이 command-picker-add-text 를 유지한다", () => {
      // 기존 e2e 스펙들이 이 이름으로 잡는다. 중복을 없애면서 이 계약은 깨면 안 된다.
      const entries = eventCommandPickerSearchEntries();
      const withTextHandle = entries.filter((entry) => entry.testId === "command-picker-add-text");
      expect(withTextHandle).toHaveLength(1);
      expect(withTextHandle[0]!.commandId).toBe("m2-001-show-text");
    });
  });
});

describe("commandPresentation", () => {
  isolateTimers();
  describe("command presentation descriptor", () => {
    it("derives every support, stability, owner, and selectability value from guarantees", () => {
      expect(COMMAND_PRESENTATION_DESCRIPTORS.map((entry) => entry.kind)).toEqual(COMMAND_KINDS);
      for (const descriptor of COMMAND_PRESENTATION_DESCRIPTORS) {
        const guarantee = COMMAND_GUARANTEES[descriptor.kind];
        expect(descriptor.support).toBe(guarantee.supportByContext.map);
        expect(descriptor.stability).toBe(guarantee.stability);
        expect(descriptor.executionOwner).toBe(guarantee.executionOwner);
        expect(descriptor.selectable).toBe(
          guarantee.authoringSurfaces.includes("mainPicker") && guarantee.supportByContext.map === "full"
        );
      }
    });

    it("keeps native picker membership aligned with descriptor selectability", () => {
      for (const descriptor of COMMAND_PRESENTATION_DESCRIPTORS) {
        if (descriptor.kind === "m2Command") continue;
        expect(EVENT_COMMAND_PICKER_NATIVE_KINDS.includes(descriptor.kind)).toBe(descriptor.selectable);
      }
    });

    it("derives every native-only picker page and group from its descriptor", () => {
      for (const placement of EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS) {
        const descriptor = commandPresentationDescriptor(placement.kind);
        expect(placement.page).toBe(descriptor.page);
        // 탭 3 저작면은 가족 라벨보다 정밀하다 — 조명·날씨 / 그림 / 화면 연출 헤딩을 kind 단위로 잡는다.
        const surfaceGroup = placement.page === 3 ? mapScreenNativeSurfaceGroup(placement.kind) : undefined;
        expect(placement.group).toBe(surfaceGroup ?? commandPresentationGroupLabel(descriptor.group));
      }
    });

    it("publishes representative interpreter, player, and battle owners from the registry", () => {
      expect(commandPresentationDescriptor("setSwitch").executionOwner).toBe("interpreter");
      expect(commandPresentationDescriptor("transfer").executionOwner).toBe("player");
      expect(commandPresentationDescriptor("battleProcessing").executionOwner).toBe("battle");
    });

    it("keeps partial and direct-hidden commands searchable but outside selectable native kinds", () => {
      for (const kind of ["advanceTime", "checkpointSave", "setTime"] as const) {
        const descriptor = commandPresentationDescriptor(kind);
        expect(descriptor.selectable).toBe(false);
        expect(descriptor.alternateRoute).toBeTruthy();
        expect(EVENT_COMMAND_PICKER_NATIVE_KINDS).not.toContain(kind);
      }
    });
  });
});

describe("eventEditorCommandLabels", () => {
  isolateTimers();
  const EXPECTED_COMMAND_KINDS = [
    "text",
    "displayTextSettings",
    "changeFace",
    "choices",
    "presentItem",
    "fork",
    "setSwitch",
    "setVariable",
    "timer",
    "advanceTime",
    "advanceCropGrowth",
    "setTime",
    "sleepUntilMorning",
    "inputNumber",
    "inputWait",
    "label",
    "gotoLabel",
    "loop",
    "breakLoop",
    "transfer",
    "moveEvent",
    "setEventGraphicPattern",
    "changeTile",
    "callCommonEvent",
    "callMapEvent",
    "planSchedule",
    "runSchedule",
    "script",
    "battleProcessing",
    "learnSkill",
    "changeExp",
    "changeLifeSkillExp",
    "spawnFieldEnemy",
    "despawnFieldEnemy",
    "tacticsBattle",
    "changeLevel",
    "promoteActor",
    "changeEquipment",
    "changeActorHp",
    "changeActorMp",
    "recoverAll",
    "enterHeroName",
    "changeGold",
    "changeItem",
    "craftRecipe",
    "openCraftShop",
    "applyItemUpgrade",
    "equipTool",
    "openChest",
    "changeFriendship",
    "setRelationship",
    "changeFactionStance",
    "getFriendship",
    "changeParty",
    "giveMonster",
    "moveMonster",
    "evolveMonster",
    "removeMonster",
    "tradeMonster",
    "fuseMonsters",
    "storeParty",
    "recallParty",
    "setDifficulty",
    "addFollower",
    "removeFollower",
    "setLighting",
    "addLight",
    "removeLight",
    "setWeather",
    "showAnimation",
    "showEmote",
    "showPicture",
    "erasePicture",
    "playAudio",
    "stopAudio",
    "playMovie",
    "cutsceneControl",
    "shop",
    "inn",
    "checkpointSave",
    "runControl",
    "killPlayer",
    "triggerEnding",
    "gameOver",
    "ending",
    "returnToTitle",
    "openSaveMenu",
    "wait",
    "setFlag",
    "setSelfSwitch",
    "m2Command",
  ] as const satisfies readonly Command["kind"][];
  type MissingCommandKind = Exclude<Command["kind"], (typeof EXPECTED_COMMAND_KINDS)[number]>;
  const allCommandKindsCovered: MissingCommandKind extends never ? true : never = true;
  beforeAll(() => {
    void allCommandKindsCovered;
  });
  describe("event editor command labels", () => {
    it("uses Korean labels for shop and inn commands", () => {
      expect(commandKindLabel("shop")).toBe("상점");
      expect(commandKindLabel("inn")).toBe("여관");
    });

    it("has one display option for every command kind", () => {
      expect(COMMAND_KIND_OPTIONS.map((option) => option.value)).toEqual(EXPECTED_COMMAND_KINDS);
    });

    it("uses each command kind option label instead of the fallback value", () => {
      for (const option of COMMAND_KIND_OPTIONS) {
        expect(commandKindLabel(option.value)).toBe(option.label);
        expect(commandKindLabel(option.value)).not.toBe(option.value);
      }
    });

    it("does not surface internal M2 jargon as the m2Command display label", () => {
      expect(commandKindLabel("m2Command")).toBe("기타 명령");
      expect(commandKindLabel("m2Command")).not.toMatch(/M2|현대/);
    });

    it("exposes transfer as an event page quick command", () => {
      expect(PAGE_COMMAND_BUTTONS).toContainEqual({
        kind: "transfer",
        testId: "command-add-transfer",
        label: "장소 이동",
      });
    });

    it.each([
      ["craftRecipe", "command-add-craft", "제작"],
      ["openCraftShop", "command-add-craft-shop", "제작 공방"],
      ["applyItemUpgrade", "command-add-upgrade", "업그레이드"],
      ["equipTool", "command-add-equip-tool", "도구 장착"],
      ["openChest", "command-add-open-chest", "보관 상자"],
    ] as const)("exposes %s through the page quick-authoring route", (kind, testId, label) => {
      expect(PAGE_COMMAND_BUTTONS).toContainEqual({ kind, testId, label });
      expect(commandKindLabel(kind)).toBe(label);
      expect(EVENT_COMMAND_PICKER_NATIVE_KINDS).toContain(kind);
    });

  });
});

describe("m2PickerPage4", () => {
  isolateTimers();
  /**
   * 탭 4(시스템 · 도구)는 시스템/도구 명령만 담는다. 대화·흐름·전투 전용·화면 연출 그룹이
   * 남아 있으면 IA 쓰레기통이다. 정보 행(선택 불가)은 탭 그리드에서 빠지고 검색에만 나온다.
   */
  const SYSTEM_TOOL_GROUPS: readonly string[] = ["시스템/고급", "모던 명령"];
  function normalizedLabel(label: string): string {
    return label.replace(/(\.\.\.|…)$/u, "").trim();
  }
  function page4CatalogEntries(): readonly M2CommandCatalogEntry[] {
    return M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === 4);
  }
  describe("picker page 4 is system/tools only", () => {
    it("leaves no dialogue, flow, battle-only, or presentation group on page 4", () => {
      const leftovers = page4CatalogEntries()
        .filter((entry) => !SYSTEM_TOOL_GROUPS.includes(entry.pickerGroup))
        .map((entry) => `${entry.id}:${entry.pickerGroup}`);

      expect(leftovers).toEqual([]);
    });

    it("routes labels, loops, timers, and end-event to the page 1 flow tab", () => {
      for (const title of [
        "Label",
        "Jump to Label",
        "Loop",
        "Break Loop",
        "End Event Processing",
        "Control Timer",
        "Name Input Processing",
        "Wait Until",
        "Weighted Branch",
      ]) {
        expect(pageOf(title)).toBe(1);
      }
    });

    it("routes battle-only rows 98-108 to the page 2 battle tab", () => {
      for (const row of PDF_COMMAND_ROWS.filter((entry) => entry.index >= 98 && entry.index <= 108)) {
        expect(pickerPageForM2Command(row)).toBe(2);
      }
    });

    it("routes camera, screen effect, cutscene, and movie to the page 3 presentation tab", () => {
      for (const title of ["Camera Control", "Screen Effect", "Cutscene Control", "Play Movie", "Change Screen Transition"]) {
        expect(pageOf(title)).toBe(3);
      }
    });

    it("keeps save, menu, system media, shutdown, tooling, and teleport flags on page 4", () => {
      for (const title of [
        "Open Save Menu",
        "Change Save Access",
        "Open Load Menu",
        "Open Menu Screen",
        "Change Menu Access",
        "Change System BGM",
        "Change System SE",
        "Change System Graphic",
        "Game Over",
        "Return to Title Screen",
        "Exit Game",
        "UI Command",
        "Debug Log",
        "Evaluate Expression",
        "Data Query",
        "Checkpoint Save",
        "Set Teleportation Point",
        "Teleportation On/Off",
        "Change Escape Access",
      ]) {
        expect(pageOf(title)).toBe(4);
      }
    });

    it("refuses to default unclassified rows onto page 4", () => {
      expect(() =>
        pickerPageForM2Command({
          index: 96_001,
          title: "Totally Unclassified Command",
          pdfTitle: "[Totally Unclassified Command]",
          pdfFile: "none",
          sourcePages: "none",
        })
      ).toThrow(/Totally Unclassified Command/u);
    });

    it("derives system, compatibility, and time family pages without a system dumping ground", () => {
      expect(commandPresentationDescriptor("gameOver").page).toBe(4);
      expect(commandPresentationDescriptor("setFlag").page).toBe(4);
      expect(commandPresentationDescriptor("timer").page).toBe(1);
      expect(commandPresentationDescriptor("setTime").page).toBe(1);
    });
  });
  describe("picker tab grid hides informational rows", () => {
    it("shows only selectable commands on every tab grid", () => {
      for (const page of [1, 2, 3, 4] as const) {
        const informational = eventCommandPickerTabEntries(page)
          .filter((entry) => !entry.selectable)
          .map((entry) => entry.commandId);
        expect(informational).toEqual([]);
        expect(eventCommandPickerTabEntries(page).length).toBeGreaterThan(0);
      }
    });

    it("keeps informational rows searchable with an alternate-route hint", () => {
      const checkpointInfo = eventCommandPickerSearchEntries().find((entry) => entry.commandId === "checkpointSave");

      expect(checkpointInfo).toBeDefined();
      expect(checkpointInfo?.selectable).toBe(false);
      expect(checkpointInfo?.alternateRoute).toBeTruthy();
    });

    it("shows the checkpoint and ending labels at most once on the page 4 grid", () => {
      const labels = eventCommandPickerTabEntries(4).map((entry) => normalizedLabel(entry.label));

      expect(labels.filter((label) => label === "체크포인트 저장")).toHaveLength(1);
      expect(labels.filter((label) => label === "엔딩")).toHaveLength(1);
      expect(labels.filter((label) => label.includes("체크포인트"))).toHaveLength(1);
      expect(labels.filter((label) => label === "저장 메뉴 열기")).toHaveLength(1);
    });

    it("groups the page 4 grid under system and tooling headings only", () => {
      const groups = [...new Set(eventCommandPickerTabEntries(4).map((entry) => entry.group))].sort();

      expect(groups.filter((group) => !SYSTEM_TOOL_GROUPS.includes(group))).toEqual([]);
    });
  });
  function pageOf(title: string): number {
    const row = [...PDF_COMMAND_ROWS, ...MODERN_COMMAND_ROWS].find((entry) => entry.title === title);
    if (!row) throw new Error(`Missing catalog row: ${title}`);
    return pickerPageForM2Command(row);
  }
});
