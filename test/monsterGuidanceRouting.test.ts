// 포켓몬라이크 깊이 감사(2026-10-16) 수리 ①②③④: 제작 프롬프트의 신기능 문장·분류기·find_tools 별칭·초기 도구.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다). 같은 표본은 scripts/qa/poke-audit-fix/*-probe.mts 로 bun 에서 돌렸다.
import { describe, expect, it } from "vitest";
import { classifyMonsterGameRequest, hasMonsterCollectIntent, MONSTER_GAME_INITIAL_TOOLS, MONSTER_GAME_PRODUCTION_PROMPT } from "@/ai/piAgent/monsterGameRequest";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { createBlankProject } from "@/project/defaults";
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
    const result = getTool("find_tools")!.run({} as never, { query } as never) as { data?: { matches?: { name: string }[] } };
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

// 잠금 누수 감사(2026-10-16) #1 — 키트·잠금을 못 켜던 몬스터 의도 문장과, 켜면 안 되는 반례. 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다.
describe("몬스터 수집 의도 사전(hasMonsterCollectIntent)", () => {
  const positives = [
    "체육관 도는 게임", "트레이너가 돌아다니는 마을 만들어 줘", "pocket monsters clone", "다마고치 같은 육성 게임", "몬스터와 함께 모험하는 RPG",
    "테이머 RPG 만들어줘", "수집형 RPG 만들어줘", "펫 키우기 게임", "디지몬 같은 게임", "/goal 장르 프리셋: 몬스터 수집 — 첫 게임을 만들어줘",
    // 기존 표본이 계속 참이어야 한다.
    "포켓몬 라이크 만들어 줘", "RPG 몬스터 수집", "몬스터를 잡아서 키우는 게임", "몬스터 도감 채우는 게임 만들어줘", "monster collecting game", "creature collector RPG please",
    "몬스터 수집 마을 만들어 줘", "장르 프리셋: 몬스터 수집", "monster taming adventure with gyms", "pet raising game",
    // 3차 적대 감사(2026-10-16) D·라우팅: 몬스터·포켓몬 낱말 없이 말한 네 문장.
    "괴물 키우고 배틀하는 게임", "야생 동물 잡아서 싸우는 RPG", "리그 우승 노리는 트레이너 이야기", "마을 사이를 오가며 동료를 모으는 게임",
  ];
  const negatives = [
    "연애 시뮬레이션 RPG 만들어 줘", "일반 판타지 RPG 게임 만들어 줘", "몬스터 헌터 같은 RPG 만들어 줘", "로그라이크 RPG 만들어 줘", "좀비 서바이벌 RPG", "소울라이크 몬스터 헌터 게임",
    "헬스 트레이너가 나오는 연애 게임", "학교 체육관에서 만나는 연애 게임", "체육관 맵 만들어 줘", "카드 수집형 게임 만들어 줘", "아이템 수집형 던전 RPG", "던전에 몬스터 배치해 줘",
    "펫샵이 있는 마을 만들어 줘", "personal trainer romance game", "농장 동물 돌보는 게임", "보물 수집 퍼즐", "몬스터를 쓰러뜨리는 던전 RPG",
    "축구 리그 우승을 노리는 감독 시뮬레이션", "야구 리그 우승 노리는 트레이너 이야기", "마을 사이를 오가는 상인 게임", "동료와 함께 던전을 도는 RPG", "동료를 모으는 JRPG",
    "괴물이 나오는 공포 게임", "괴물을 물리치는 던전 RPG", "야생 동물을 사냥해 요리하는 서바이벌", "야생 동물 보호 농장 게임",
  ];
  it.each(positives)("의도로 읽는다: %s", (text) => expect(hasMonsterCollectIntent(text)).toBe(true));
  it.each(negatives)("의도가 아니다: %s", (text) => expect(hasMonsterCollectIntent(text)).toBe(false));

  it("돌보기만 하는 말(다마고치·펫 키우기)은 8체육관 캠페인으로 보내지 않는다 — 키트·잠금만 켠다", () => {
    expect(classifyMonsterGameRequest("다마고치 같은 육성 게임", true)).toBeNull();
    expect(classifyMonsterGameRequest("펫 키우기 게임", true)).toBeNull();
    expect(classifyMonsterGameRequest("펫 키우기 게임 만들어 줘, 체육관도 있어", true)).toBe("campaign");
  });
  it("체육관 순회·테이머·수집형·함께 모험은 캠페인 경로로 간다", () => {
    for (const text of ["체육관 도는 게임", "테이머 RPG 만들어줘", "수집형 RPG 만들어줘", "몬스터와 함께 모험하는 RPG", "디지몬 같은 게임", "pocket monsters clone"]) {
      expect(classifyMonsterGameRequest(text, true), text).toBe("campaign");
    }
  });
});

describe("키트·잠금 신호(classifyPlainPiTurn.monsterKit)", () => {
  const run = (text: string) => {
    const project = createBlankProject();
    return classifyPlainPiTurn({
      project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy: resolveAutonomy("autonomous"),
      declarer: () => async () => { throw new Error("의도 선언은 이 문장들에서 필요 없다"); }, piTeam: false,
    });
  };
  it("/goal 몬스터 수집 목표는 라우팅을 건너뛰어도 monsterKit 을 낸다", async () => {
    const out = await run("/goal 장르 프리셋: 몬스터 수집 — 첫 게임을 만들어줘");
    expect(out.mode).toBe("team");
    expect(out.monsterKit).toBe(true);
  });
  it("몬스터가 아닌 /goal 은 monsterKit 이 없다", async () => {
    expect((await run("/goal 연애 시뮬레이션 첫 게임을 만들어줘")).monsterKit).toBeUndefined();
  });
  it.each(["체육관 도는 게임", "테이머 RPG 만들어줘", "수집형 RPG 만들어줘", "몬스터와 함께 모험하는 RPG", "디지몬 같은 게임", "pocket monsters clone", "괴물 키우고 배틀하는 게임", "야생 동물 잡아서 싸우는 RPG", "마을 사이를 오가며 동료를 모으는 게임"])("캠페인 경로가 monsterKit 을 낸다: %s", async (text) => {
    expect((await run(text)).monsterKit).toBe(true);
  });
});
