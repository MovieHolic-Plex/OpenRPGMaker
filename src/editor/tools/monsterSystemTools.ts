import type { ToolDefinition, ToolExecResult } from "./types";

// 몬스터 수집/포획 + 몬스터 전투 파티 모드를 켜고 끄는 저작 도구.
// 두 플래그는 별개 축이다:
//  - system.monsterCollection   : 전투에 '포획' 커맨드가 뜨는 게이트(battleCommands.ts).
//  - system.monsterBattleParty  : 전투를 영웅 대신 몬스터 파티로 진행(playSceneBattle 레거시 경로).
//  - system.battleParty:"monsters" : 런타임/시뮤레이트 정식 게이트(createBattleRuntime).
// battleParty:true 는 두 출전 플래그를 함께 켠다(이중 표기 호환).
const configureMonsterSystem: ToolDefinition = {
  name: "configure_monster_system",
  description:
    "몬스터 수집/포획 시스템을 켠다. enabled:true면 전투에 '포획' 커맨드가 뜨고 종족/타입표/사냥터/조우 저작이 실제 플레이로 연결된다. battleParty:true면 전투를 영웅 대신 잡은 몬스터 파티로 진행한다(포켓몬식 출전). enabled:false면 두 플래그를 모두 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "몬스터 수집/포획 게이트를 켤지 여부" },
      battleParty: { type: "boolean", description: "전투를 몬스터 파티로 진행할지(포켓몬식). 생략하면 현재 설정 유지, false 면 영웅이 싸운다." },
    },
    required: ["enabled"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    if (args.enabled !== true) {
      delete draft.system.monsterCollection;
      delete draft.system.monsterBattleParty;
      if (draft.system.battleParty === "monsters") delete draft.system.battleParty;
      return { summary: "몬스터 수집 비활성화 — 포획/몬스터 전투 플래그를 모두 제거했습니다.", data: { enabled: false, battleParty: false } };
    }
    draft.system.monsterCollection = true;
    // battleParty 를 생략하면 지금 설정을 지킨다. 몬스터 수집 프리셋은 이미 몬스터 파티 전투로 시작하는데,
    // 조수가 {enabled:true} 만 보내면 조용히 영웅 전투로 떨어뜨렸다(잡은 몬스터가 싸우지 않는 포켓몬풍).
    const current = draft.system.monsterBattleParty === true || draft.system.battleParty === "monsters";
    const battleParty = args.battleParty === undefined ? current : args.battleParty === true;
    if (battleParty) {
      draft.system.monsterBattleParty = true;
      draft.system.battleParty = "monsters";
    } else {
      delete draft.system.monsterBattleParty;
      if (draft.system.battleParty === "monsters") delete draft.system.battleParty;
    }
    return {
      summary: battleParty
        ? "몬스터 수집 활성화 + 전투를 몬스터 파티로 진행합니다(포획 커맨드 노출)."
        : "몬스터 수집 활성화 — 전투에 포획 커맨드가 뜹니다(전투 출전은 battleParty:true 필요).",
      data: { enabled: true, battleParty },
    };
  },
};

export const MONSTER_SYSTEM_TOOLS: readonly ToolDefinition[] = [configureMonsterSystem];
