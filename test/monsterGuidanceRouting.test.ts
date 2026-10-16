// 포켓몬라이크 깊이 감사(2026-10-16) 수리 ①②③④: 제작 프롬프트의 신기능 문장·분류기·find_tools 별칭·초기 도구.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다). 같은 표본은 scripts/qa/poke-audit-fix/*-probe.mts 로 bun 에서 돌렸다.
import { describe, expect, it } from "vitest";
import { classifyMonsterGameRequest, MONSTER_GAME_INITIAL_TOOLS, MONSTER_GAME_PRODUCTION_PROMPT } from "@/ai/piAgent/monsterGameRequest";
import { getTool } from "@/editor/tools";

describe("제작 프롬프트에 신기능이 statStage 문장과 같은 형식으로 들어 있다", () => {
  it.each([
    ["능력 단계", "statStageEffects"],
    ["독·맹독", "gen1MajorStatus"],
    ["혼란", "volatileStatus:'confusion'"],
    ["특성", "ability {name"],
    ["지닌 물건", "heldEffect {kind:"],
    ["날씨", "weather {kind:'sun'"],
    ["조건부 볼", "captureProfile.condition"],
    ["HM", "place_field_obstacle"],
    ["낚시", "configure_fishing"],
  ])("%s", (_label, needle) => {
    expect(MONSTER_GAME_PRODUCTION_PROMPT).toContain(needle);
  });
  it("초기 도구에 신기능 저작 도구가 있다", () => {
    for (const name of ["upsert_skill", "upsert_item", "upsert_state", "define_monster_species", "place_field_obstacle", "configure_fishing"]) {
      expect(MONSTER_GAME_INITIAL_TOOLS).toContain(name);
    }
  });
});

describe("몬스터 요청 분류", () => {
  const positives = [
    "포켓몬 라이크 만들어 줘", "포켓몬 라이크", "포켓몬 같은 RPG", "RPG 몬스터 수집 게임", "몬스터 수집 RPG", "pokemon-like game", "a pokemon like RPG",
    "바다 마을에서 시작하는 몬스터 수집 RPG, 체육관 3개, 배지를 모으면 챔피언",
    "내 몬스터 한 마리가 진화하며 라이벌과 경쟁하는 짧은 포켓몬 라이크, 낚시와 HM 로 길을 여는 구조",
  ];
  const negatives = [
    "연애 시뮬레이션 RPG 만들어 줘", "일반 RPG 게임 만들어 줘", "몬스터 헌터 같은 RPG 만들어 줘", "로그라이크 RPG 만들어 줘", "좀비 서바이벌 RPG",
    "포켓몬 게임 어떻게 만들어요?", "포켓몬 말고 연애 게임", "포켓몬 블랙 같은 게임 만들어", "포켓몬 NPC 추가해", "I like pokemon cards", "포켓몬 RPG 추천해 줘", "소울라이크 몬스터 헌터 게임",
  ];
  it.each(positives)("빈 프로젝트에서 캠페인: %s", (text) => expect(classifyMonsterGameRequest(text, true)).toBe("campaign"));
  it.each(negatives)("몬스터 제작이 아니다: %s", (text) => {
    expect(classifyMonsterGameRequest(text, true)).toBeNull();
    expect(classifyMonsterGameRequest(text, false)).toBeNull();
  });
  it("저작된 프로젝트에서 동사 없는 문장은 요청으로 받지 않는다", () => expect(classifyMonsterGameRequest("포켓몬 라이크", false)).toBeNull());
  it("동사 있는 「포켓몬 라이크 만들어 줘」는 빈 프로젝트가 아니어도 캠페인", () => expect(classifyMonsterGameRequest("포켓몬 라이크 만들어 줘", false)).toBe("campaign"));
});

describe("find_tools 별칭", () => {
  const top = (query: string) => {
    const result = getTool("find_tools")!.run({} as never, { query } as never, {} as never) as { data?: { matches?: { name: string }[] } };
    return (result.data?.matches ?? []).slice(0, 3).map((match) => match.name);
  };
  it.each([
    ["특성", "define_monster_species"], ["맹독", "upsert_state"], ["혼란", "upsert_state"], ["조건부 볼", "upsert_item"], ["지닌 물건", "upsert_item"],
    ["몬스터 전투 날씨", "upsert_skill"], ["weather rain sandstorm", "upsert_skill"], ["낚시", "configure_fishing"],
  ])("%s → %s 가 상위 셋 안", (query, tool) => expect(top(query)).toContain(tool));
  it("전투 날씨 질의는 일상 날씨 도구보다 upsert_skill 이 먼저", () => {
    const names = top("몬스터 날씨");
    expect(names.indexOf("upsert_skill")).toBeLessThan(names.indexOf("upsert_life_system") < 0 ? 99 : names.indexOf("upsert_life_system"));
  });
});
