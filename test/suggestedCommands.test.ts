import { describe, expect, it, beforeEach } from "vitest";
import { SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import {
  CONTEXT_REGION_COMMANDS,
  SUGGESTED_REGION_COMMANDS,
  nextSuggestedRegionCommands,
  nextStartScreenSuggestedCommands,
  regionCommandCategories,
  __resetSuggestedRegionRotationForTest,
  __resetStartScreenSuggestedRotationForTest,
} from "@/editor/regionTask/suggestedCommands";

/** 로테이션 기대값 — start 부터 count 개를 코퍼스 길이로 감아 집는다. */
const idsFrom = (start: number, count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => SUGGESTED_REGION_COMMANDS[(start + index) % SUGGESTED_REGION_COMMANDS.length].id,
  );

describe("suggestedCommands", () => {
  beforeEach(() => {
    __resetSuggestedRegionRotationForTest();
    __resetStartScreenSuggestedRotationForTest();
  });

  // 개수를 상수로 못박지 않는다: 명령이 하나 늘 때마다 무관한 테스트 3개가 빨개졌다(실측:
  // 13번째 명령이 들어온 뒤 이 파일의 로테이션 테스트가 기준선에서 이미 실패 상태였다).
  // 고정할 불변식은 "중복 id 없음 · 빈 지시문 없음 · 카테고리별로 고를 수 있을 만큼 있음" 이다.
  it("코퍼스 상수 — id 중복 없음, instruction 비어있지 않음", () => {
    expect(SUGGESTED_REGION_COMMANDS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SUGGESTED_REGION_COMMANDS.map((command) => command.id)).size)
      .toBe(SUGGESTED_REGION_COMMANDS.length);
    for (const command of SUGGESTED_REGION_COMMANDS) expect(command.instruction.length).toBeGreaterThan(5);
  });

  it("카테고리를 고르면 칩이 최소 2개 남는다 (빈 줄 방지)", () => {
    for (const category of regionCommandCategories()) {
      expect(category.commands.length, `${category.label} 카테고리`).toBeGreaterThanOrEqual(2);
    }
  });

  it("문맥 전용 명령도 카테고리 칩으로 볼 수 있다", () => {
    const all = regionCommandCategories().flatMap((category) => category.commands.map((command) => command.id));
    // 예전에는 regionContextSuggestions 안의 리터럴이라 주변 타일이 맞지 않으면 영영 안 보였다.
    for (const id of CONTEXT_REGION_COMMANDS.map((command) => command.id)) expect(all).toContain(id);
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
      "conifer-forest": "terrain",
      "dirt-path": "terrain",
      "scatter-rocks": "polish",
      "lantern-mood": "mood",
      "blend-surroundings": "polish",
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

  it("호출마다 로테이션 — 이어서 집고, 끝에서 처음으로 돌아온다", () => {
    const total = SUGGESTED_REGION_COMMANDS.length;
    // 코퍼스 길이가 4의 배수가 아니어도 성립하는 형태로 고정한다(모듈러 인덱싱).
    for (let call = 0; call < 6; call += 1) {
      const picked = nextSuggestedRegionCommands(4).map((command) => command.id);
      expect(picked, `${call + 1}번째 호출`).toEqual(idsFrom((call * 4) % total, 4));
    }
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
    const total = SUGGESTED_REGION_COMMANDS.length;
    for (let call = 0; call < 7; call += 1) {
      const picked = nextStartScreenSuggestedCommands(3).map((command) => command.id);
      expect(picked, `${call + 1}번째 호출`).toEqual(idsFrom((call * 3) % total, 3));
    }
  });
});
