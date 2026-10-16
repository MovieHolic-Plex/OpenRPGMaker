import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { configureMonsterPresentation } from "@/project/monsterPresentation";
import { openBlankStartOnMonsterKit } from "@/project/genrePresets";
import { disableGenreLock, genreLockReleasedNotice } from "@/project/genreLock";
import { enableGenreLockSettled } from "@/project/genreLockCharsets";

// 몬스터 수집/포획 + 몬스터 전투 파티 모드를 켜고 끄는 저작 도구.
// 두 플래그는 별개 축이다:
//  - system.monsterCollection   : 전투에 '포획' 커맨드가 뜨는 게이트(battleCommands.ts).
//  - system.monsterBattleParty  : 전투를 영웅 대신 몬스터 파티로 진행(playSceneBattle 레거시 경로).
//  - system.battleParty:"monsters" : 런타임/시뮤레이트 정식 게이트(createBattleRuntime).
// battleParty:true 는 두 출전 플래그를 함께 켠다(이중 표기 호환).
const configureMonsterSystem: ToolDefinition = {
  name: "configure_monster_system",
  description:
    "몬스터 수집/포획 시스템을 켠다. enabled:true면 전투에 '포획' 커맨드가 뜬다. 포획 없는 몬스터 게임(대회형·트레이너 대전 중심)은 enabled:true + capture:false — 포획 커맨드는 끄고 몬스터 파티 전투만 켠다(「포획 없음」을 선언한 게임이라 검사기도 야생 조우·포획 도구를 요구하지 않는다). battleParty:true면 전투와 필드 메뉴·기술·회복약·저장 레벨이 실제 몬스터 파티를 사용한다. presentation:'collector'는 수집 게임 메뉴/HUD를 설정하고 미수정 기본 왕국 오프닝만 비활성화한다(저작한 오프닝은 보존). 설정 성공은 플레이 검증이 아니다. 동료 지급과 퍼즐 조작 뒤 run_scene_test의 playerCanMove/실제 이동을 검사하고 출하 플레이어도 확인한다. enabled:true 는 장르 칩셋 잠금도 켠다 — 이후 조수는 새 맵·칩셋에 몬스터 칩셋 계열만 쓸 수 있고 다른 계열은 거부된다. enabled:false면 포획/몬스터 전투 플래그를 제거하고 그 잠금도 푼다(「장르 잠금 해제됨」 경고가 결과·편집 기록에 남는다).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "몬스터 수집/포획 게이트를 켤지 여부" },
      capture: { type: "boolean", description: "생략/true 면 포획 커맨드가 뜨는 수집 게임. false 면 포획 없는 몬스터 게임(대회형·대전 중심) — monsterCollection=false 를 명시하고 battleParty 를 생략하면 몬스터 파티 전투를 켠다." },
      battleParty: { type: "boolean", description: "전투를 몬스터 파티로 진행할지(포켓몬식). 생략하면 현재 설정 유지, false 면 영웅이 싸운다." },
      presentation: { type: "string", enum: ["preserve", "collector"], description: "생략/preserve는 기존 화면 설정 유지. collector는 몬스터 수집용 메뉴/HUD를 설정하고 미수정 기본 오프닝만 끈다." },
      rules: { type:'string', enum:['preserve','gen1'], description:'gen1은 몬스터 대치 전투 규칙과 화면을 함께 설정하고, 패배 규칙이 아직 없으면 포켓몬식 블랙아웃(마지막 회복 센터 귀환 + 소지금 절반)을 심는다. 생략/preserve는 기존 규칙 유지.' },
      escapeGraceSteps: { type: 'integer', description: '도망에 성공한 뒤 야생 조우가 나오지 않는 걸음 수(0~99, 0 = 끔). 생략하면 기존 값을 두고, 값이 없으면 몬스터 파티 게임은 기본 4걸음이다.' },
      captureShakesVariableId: { type: 'string', description: '포획 던지기마다 흔들린 횟수(0~3, 잡히면 4)를 담을 변수 id(create_variable 로 먼저 만든다). 이벤트(전투 뒤 분기)가 읽어 「아깝다!」 같은 반응을 만든다. 빈 문자열이면 기록을 끈다. 화면 연출은 바뀌지 않는다.' },
    },
    required: ["enabled"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    if (args.enabled !== true) {
      const releasedLock = draft.system.genreLock;
      delete draft.system.monsterCollection;
      delete draft.system.monsterBattleParty;
      if (draft.system.battleParty === "monsters") delete draft.system.battleParty;
      // 잠금은 말없이 풀리지 않는다 — 결과 경고(채팅)와 편집 기록(applyAnnotation 이 이 문구를 읽는다)에 남긴다.
      const notice = releasedLock && disableGenreLock(draft) ? genreLockReleasedNotice(draft, releasedLock) : undefined;
      return {
        summary: `몬스터 수집 비활성화 — 포획/몬스터 전투 플래그를 모두 제거했습니다.${notice ? " 장르 잠금 해제됨." : ""}`,
        ...(notice ? { warnings: [notice] } : {}),
        data: { enabled: false, battleParty: false, ...(notice ? { genreLockReleased: true } : {}) },
      };
    }
    // 포획 없음은 「꺼짐(undefined)」이 아니라 명시한 false 다 — 검사기가 「포획을 켜는 걸 잊음」과 「포획 없는 게임」을 구분한다.
    const capture = args.capture !== false;
    draft.system.monsterCollection = capture;
    if(args.rules==='gen1'){
      draft.system.battleModel='gen1';draft.system.battleUiStyle='pokemon';
      // 패배 규칙이 없으면(저작자가 정한 게 없으면) 포켓몬식 블랙아웃을 심는다. 이미 있는 gameOver 는 건드리지 않는다.
      if (!draft.system.gameOver && !draft.system.gameOvers?.length) draft.system.gameOver = { outcome: 'recover', presentation: 'blackout', goldLossPercent: 50 };
    }
    if (args.escapeGraceSteps !== undefined) {
      if (typeof args.escapeGraceSteps !== 'number' || !Number.isInteger(args.escapeGraceSteps) || args.escapeGraceSteps < 0 || args.escapeGraceSteps > 99) throw new ToolError('escapeGraceSteps 는 0~99 의 정수여야 합니다.', { code: 'invalid-args' });
      draft.system.escapeGraceSteps = args.escapeGraceSteps;
    }
    if (args.captureShakesVariableId !== undefined) {
      const variableId = typeof args.captureShakesVariableId === 'string' ? args.captureShakesVariableId.trim() : '';
      if (!variableId) delete draft.system.captureShakesVariableId;
      else if (!draft.variables.some(v => v.id === variableId)) throw new ToolError(`captureShakesVariableId 변수가 없습니다: ${variableId} — create_variable 로 먼저 만들고 id 를 주세요(기존 변수: ${draft.variables.slice(0, 6).map(v => v.id).join(', ') || '없음'}).`, { code: 'variable-not-found' });
      else draft.system.captureShakesVariableId = variableId;
    }
    // battleParty 를 생략하면 지금 설정을 지킨다. 몬스터 수집 프리셋은 이미 몬스터 파티 전투로 시작하는데,
    // 조수가 {enabled:true} 만 보내면 조용히 영웅 전투로 떨어뜨렸다(잡은 몬스터가 싸우지 않는 포켓몬풍).
    const current = draft.system.monsterBattleParty === true || draft.system.battleParty === "monsters";
    const battleParty = args.battleParty === undefined ? (capture ? current : true) : args.battleParty === true;
    if (battleParty) {
      draft.system.monsterBattleParty = true;
      draft.system.battleParty = "monsters";
    } else {
      delete draft.system.monsterBattleParty;
      if (draft.system.battleParty === "monsters") delete draft.system.battleParty;
    }
    // 칩셋 계열은 첫 맵에서 정해진다 — 빈 시작 맵이 버들항이면 몬스터 게임 전체가 버들항으로 깔린다(손댄 맵은 건드리지 않는다).
    openBlankStartOnMonsterKit(draft);
    const lockedNow = enableGenreLockSettled(draft, "monster-collect");
    const presentation = args.presentation === "collector" ? configureMonsterPresentation(draft) : undefined;
    return {
      summary: !capture
        ? "포획 없는 몬스터 게임 — 몬스터 파티 전투만 켰습니다(포획 커맨드 없음, monsterCollection=false 선언). 포획구슬·야생 조우를 만들지 마세요."
        : battleParty
        ? "몬스터 수집 활성화 + 전투를 몬스터 파티로 진행합니다(포획 커맨드 노출)."
        : "몬스터 수집 활성화 — 전투에 포획 커맨드가 뜹니다(전투 출전은 battleParty:true 필요).",
      data: {
        enabled: true, capture, battleParty, ...(draft.system.genreLock ? { genreLock: draft.system.genreLock.preset, ...(lockedNow ? { genreLockEnabledNow: true } : {}) } : {}),
        partyPresentation: battleParty ? "monster-party" : "actor-party",
        ...(presentation ? { presentation: "collector", ...presentation } : {}),
        verificationScope: "configuration-only",
        verificationHint: "동료 지급·장치 작동 후 같은 위치에서 playerCanMove:true와 실제 이동을 검사하세요. 검사 전에 set/moveTo로 다른 칸에 옮기면 갇힘을 놓칩니다. 장면 시뮬레이션은 출하 플레이어/저장 재로드 증거와 별개입니다.",
      },
    };
  },
};

export const MONSTER_SYSTEM_TOOLS: readonly ToolDefinition[] = [configureMonsterSystem];
