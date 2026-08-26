import { describe, expect, it, beforeEach } from "vitest";
import { SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import {
  SUGGESTED_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  nextStartScreenSuggestedCommands,
  regionCommandCategories,
  __resetSuggestedRegionRotationForTest,
  __resetStartScreenSuggestedRotationForTest,
} from "@/editor/regionTask/suggestedCommands";

describe("suggestedCommands", () => {
  beforeEach(() => {
    __resetSuggestedRegionRotationForTest();
    __resetStartScreenSuggestedRotationForTest();
  });

  it("12개 상수 — id 중복 없음, instruction 비어있지 않음", () => {
    expect(SUGGESTED_REGION_COMMANDS).toHaveLength(12);
    expect(new Set(SUGGESTED_REGION_COMMANDS.map((command) => command.id)).size).toBe(12);
    for (const command of SUGGESTED_REGION_COMMANDS) expect(command.instruction.length).toBeGreaterThan(5);
  });

  it("모든 명령이 SvgIconName 아이콘을 가진다 (ICON MAPPING 준수)", () => {
    const EXPECTED_COMMAND_ICONS: Readonly<Record<string, SvgIconName>> = {
      "round-pond": "terrain",
      "small-cottage": "structure",
      "flower-scatter": "polish",
      "treasure-chest": "chest",
      "storage-chest": "chest",
      "merchant-npc": "shop",
      "pasture-fence": "structure",
      garden: "polish",
      "gate-guards": "npc",
      "inn-guests": "structure",
      festival: "composite",
      "dark-mood": "mood",
      "encounter-zone": "combat",
    };
    for (const command of SUGGESTED_REGION_COMMANDS) {
      expect(SVG_ICON_NAMES).toContain(command.icon);
      expect(command.icon).toBe(EXPECTED_COMMAND_ICONS[command.id]);
    }
  });

  it("카테고리 아이콘이 SvgIconName 이다 (ICON MAPPING 준수)", () => {
    const EXPECTED_CATEGORY_ICONS: Readonly<Record<string, SvgIconName>> = {
      tiles: "terrain",
      structures: "structure",
      polish: "polish",
      npc: "npc",
      interaction: "chest",
      combat: "combat",
      mood: "mood",
      composite: "composite",
    };
    const categories = regionCommandCategories();
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      expect(SVG_ICON_NAMES).toContain(category.icon);
      if (EXPECTED_CATEGORY_ICONS[category.id]) {
        expect(category.icon).toBe(EXPECTED_CATEGORY_ICONS[category.id]);
      }
    }
  });

  it("모든 명령·카테고리 라벨에 이모지가 없다", () => {
    const labels = [
      ...SUGGESTED_REGION_COMMANDS.map((command) => command.label),
      ...SUGGESTED_REGION_COMMANDS.map((command) => command.instruction),
      ...regionCommandCategories().map((category) => category.label),
    ];
    for (const label of labels) expect(label).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("호출마다 로테이션 — 첫 호출 [0..3], 둘째 호출 [4..7], 랩어라운드", () => {
    const first = nextSuggestedRegionCommands(4);
    const second = nextSuggestedRegionCommands(4);
    const third = nextSuggestedRegionCommands(4);
    const fourth = nextSuggestedRegionCommands(4);
    expect(first.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
    expect(second.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(4, 8).map((command) => command.id));
    expect(third.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(8, 12).map((command) => command.id));
    expect(fourth[0].id).toBe(SUGGESTED_REGION_COMMANDS[0].id); // 랩어라운드
  });

  it("시작 화면 카드와 모달은 독립된 로테이션 카운터를 쓴다", () => {
    // 시작 화면 카드를 여러 번 소모해도 모달 쪽 카운터(rotation)는 전혀 영향받지 않는다.
    nextStartScreenSuggestedCommands(3);
    nextStartScreenSuggestedCommands(3);
    nextStartScreenSuggestedCommands(3);
    const modalFirst = nextSuggestedRegionCommands(4);
    expect(modalFirst.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 4).map((command) => command.id));
  });

  it("시작 화면 로테이션 자체도 순서대로 돌고 랩어라운드한다", () => {
    const first = nextStartScreenSuggestedCommands(3);
    const second = nextStartScreenSuggestedCommands(3);
    const third = nextStartScreenSuggestedCommands(3);
    const fourth = nextStartScreenSuggestedCommands(3);
    const fifth = nextStartScreenSuggestedCommands(3);
    expect(first.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(0, 3).map((command) => command.id));
    expect(second.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(3, 6).map((command) => command.id));
    expect(third.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(6, 9).map((command) => command.id));
    expect(fourth.map((command) => command.id)).toEqual(SUGGESTED_REGION_COMMANDS.slice(9, 12).map((command) => command.id));
    expect(fifth[0].id).toBe(SUGGESTED_REGION_COMMANDS[0].id); // 랩어라운드
  });
});
