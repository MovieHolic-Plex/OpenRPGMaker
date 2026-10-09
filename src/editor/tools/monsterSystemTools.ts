import type { ToolDefinition, ToolExecResult } from "./types";
import { configureMonsterPresentation } from "@/project/monsterPresentation";

// 몬스터 수집/포획 + 몬스터 전투 파티 모드를 켜고 끄는 저작 도구.
// 두 플래그는 별개 축이다:
//  - system.monsterCollection   : 전투에 '포획' 커맨드가 뜨는 게이트(battleCommands.ts).
//  - system.monsterBattleParty  : 전투를 영웅 대신 몬스터 파티로 진행(playSceneBattle 레거시 경로).
//  - system.battleParty:"monsters" : 런타임/시뮤레이트 정식 게이트(createBattleRuntime).
// battleParty:true 는 두 출전 플래그를 함께 켠다(이중 표기 호환).
const configureMonsterSystem: ToolDefinition = {
  name: "configure_monster_system",
  description:
    "몬스터 수집/포획 시스템을 켠다. enabled:true면 전투에 '포획' 커맨드가 뜬다. battleParty:true면 전투와 필드 메뉴·기술·회복약·저장 레벨이 실제 몬스터 파티를 사용한다. presentation:'collector'는 수집 게임 메뉴/HUD를 설정하고 미수정 기본 왕국 오프닝만 비활성화한다(저작한 오프닝은 보존). 설정 성공은 플레이 검증이 아니다. 동료 지급과 퍼즐 조작 뒤 run_scene_test의 playerCanMove/실제 이동을 검사하고 출하 플레이어도 확인한다. enabled:false면 포획/몬스터 전투 플래그를 제거한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "몬스터 수집/포획 게이트를 켤지 여부" },
      battleParty: { type: "boolean", description: "전투를 몬스터 파티로 진행할지(포켓몬식). 생략하면 현재 설정 유지, false 면 영웅이 싸운다." },
      presentation: { type: "string", enum: ["preserve", "collector"], description: "생략/preserve는 기존 화면 설정 유지. collector는 몬스터 수집용 메뉴/HUD를 설정하고 미수정 기본 오프닝만 끈다." },
      rules: { type:'string', enum:['preserve','gen1'], description:'gen1은 몬스터 대치 전투 규칙과 화면을 함께 설정. 생략/preserve는 기존 규칙 유지.' },
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
    if(args.rules==='gen1'){draft.system.battleModel='gen1';draft.system.battleUiStyle='pokemon';}
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
    const presentation = args.presentation === "collector" ? configureMonsterPresentation(draft) : undefined;
    return {
      summary: battleParty
        ? "몬스터 수집 활성화 + 전투를 몬스터 파티로 진행합니다(포획 커맨드 노출)."
        : "몬스터 수집 활성화 — 전투에 포획 커맨드가 뜹니다(전투 출전은 battleParty:true 필요).",
      data: {
        enabled: true, battleParty,
        partyPresentation: battleParty ? "monster-party" : "actor-party",
        ...(presentation ? { presentation: "collector", ...presentation } : {}),
        verificationScope: "configuration-only",
        verificationHint: "동료 지급·장치 작동 후 같은 위치에서 playerCanMove:true와 실제 이동을 검사하세요. 검사 전에 set/moveTo로 다른 칸에 옮기면 갇힘을 놓칩니다. 장면 시뮬레이션은 출하 플레이어/저장 재로드 증거와 별개입니다.",
      },
    };
  },
};

export const MONSTER_SYSTEM_TOOLS: readonly ToolDefinition[] = [configureMonsterSystem];
