import type { ToolDefinition, ToolExecResult } from "./types";

// 몬스터 수집/포획 + 몬스터 전투 파티 모드를 켜고 끄는 저작 도구.
// 두 플래그는 별개 축이다:
//  - system.monsterCollection   : 전투에 '포획' 커맨드가 뜨는 게이트(battleCommands.ts).
//  - system.monsterBattleParty  : 전투를 영웅 대신 몬스터 파티로 진행(playSceneBattle.ts, 옵션 A).
const configureMonsterSystem: ToolDefinition = {
  name: "configure_monster_system",
  description:
    "몬스터 수집/포획 시스템을 켠다. enabled:true면 전투에 '포획' 커맨드가 뜨고 종족/타입표/사냥터/조우 저작이 실제 플레이로 연결된다. battleParty:true면 전투를 영웅 대신 잡은 몬스터 파티로 진행한다(포켓몬식 출전). enabled:false면 두 플래그를 모두 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "몬스터 수집/포획 게이트를 켤지 여부" },
      battleParty: { type: "boolean", description: "전투를 몬스터 파티로 진행할지(옵션 A). 기본 false" },
    },
    required: ["enabled"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    if (args.enabled !== true) {
      delete draft.system.monsterCollection;
      delete draft.system.monsterBattleParty;
      return { summary: "몬스터 수집 비활성화 — 포획/몬스터 전투 플래그를 모두 제거했습니다.", data: { enabled: false, battleParty: false } };
    }
    draft.system.monsterCollection = true;
    const battleParty = args.battleParty === true;
    if (battleParty) draft.system.monsterBattleParty = true;
    else delete draft.system.monsterBattleParty;
    return {
      summary: battleParty
        ? "몬스터 수집 활성화 + 전투를 몬스터 파티로 진행합니다(포획 커맨드 노출)."
        : "몬스터 수집 활성화 — 전투에 포획 커맨드가 뜹니다(전투 출전은 battleParty:true 필요).",
      data: { enabled: true, battleParty },
    };
  },
};

export const MONSTER_SYSTEM_TOOLS: readonly ToolDefinition[] = [configureMonsterSystem];
