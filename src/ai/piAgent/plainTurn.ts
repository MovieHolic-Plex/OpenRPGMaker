import { requestsEmeraldMonsterGame, classifyMonsterGameRequest, MONSTER_GAME_INITIAL_TOOLS, MONSTER_GAME_PRODUCTION_PROMPT, MONSTER_FREE_CAMPAIGN_NOTE, monsterScaleNote, MONSTER_FREE_KIT_NOTE, hasMonsterCollectIntent, isMonsterRequestTurn, MONSTER_TOURNAMENT_INITIAL_TOOLS, MONSTER_TOURNAMENT_PROMPT, MONSTER_EXPEDITION_INITIAL_TOOLS, MONSTER_EXPEDITION_PROMPT } from './monsterGameRequest';
// 평문 조수 턴의 순수 부분 — 의도 선언 → 실행 계획, 그리고 Pi 요청(계획 턴·실행 턴) 조립.
//
// 채팅 패널(`aiChatPanel.plainPiTurn` + `aiPiAgentCommand.runPiCommand`)과 헤드리스 생성기
// (`scripts/qa-game/gen.mts`)가 **같은 함수**를 부른다. 문장·상수를 두 곳에 베끼면 헤드리스 결과가
// 브라우저 결과를 대표하지 못한다 — 여기 하나만 고치면 두 경로가 같이 바뀐다.

import { conceptCardsForText } from "../conceptCards";
import { beodeulTownTargetFor } from "./beodeulTownRoute";
import type { AutonomyResolution } from "@/ai/autonomyLevels";
import { formatIntentAudit, formatIntentClarifyMessage, type IntentDeclaration, type IntentSelectionFact } from "@/ai/intentDeclaration";
import { buildIntentFacts, declareIntentCached, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { RoleModel } from "@/ai/modelRoles";
import { buildSessionRegistryTools, SCENE_SETTING_NOTE, SCENE_SETTING_PATTERN } from "@/ai/sessionToolExposure";
import { monsterAssetsAllowed, toolHiddenByMonsterLock } from "@/project/genreLockMonsterAssets";
import { stripMonsterKitMentions } from "@/ai/intentDeclaration";
import { isLivedMap } from "@/editor/tools/livedMap";
import type { Project } from "@/project/types";
import type { PiApplyMode } from "./applyMode";
import { buildPiIntentNote, resolvePiRunPlan, type PiRunPlan } from "./executionRoute";
import type { PiAgentMode, PiAgentRequest, PiAgentThinkingLevel } from "./protocol";
import type { PiTeamSpec } from "./teamSpec";
// 정의는 잎 모듈(`./thinkingLevel`)에 둔다 — Bun 워커가 같은 함수를 권위 경계에서 부르는데, 이 파일은
// 편집기 모듈(sessionToolExposure·authorVillageScope)을 끌고 와서 워커가 임포트하면 그 프로세스가 깨질 수 있다.
// 기존 호출자·테스트가 이 모듈에서 쓰던 이름을 그대로 쓰도록 다시 내보낸다.
export { normalizePiThinkingLevel } from "./thinkingLevel";
import { normalizePiThinkingLevel } from "./thinkingLevel";
import { JP_CITY_EXPOSED_TOOLS, jpCityTargetFor } from '../jpCityPolicy';
import { OPENING_ANIMATIC_AUTHORING_TOOLS, requestsFullGameOpeningProduction, requestsOpeningProduction } from "./openingProduction";
import { isRomanceGameRequest } from "@/qa/gameCheck/romance";
import { GOTHIC_EXPOSED_TOOLS, gothicTargetFor } from '../gothicPolicy';
import { INTERIOR_PLUS_EXPOSED_TOOLS, interiorPlusTargetFor } from '../interiorPlusPolicy';
import { PIRATE_ISLES_EXPOSED_TOOLS, pirateIslesTargetFor } from '../pirateIslesPolicy';
import { SENGOKU_EXPOSED_TOOLS, sengokuTargetFor } from '../sengokuEdoPolicy';
import { SKY_ISLAND_EXPOSED_TOOLS, skyIslandTargetFor } from '../skyIslandPolicy';
import { STEAMPUNK_EXPOSED_TOOLS, steampunkTargetFor } from '../steampunkCityPolicy';
import { CAMPUS_EXPOSED_TOOLS, campusTargetFor } from '../campusPolicy';
import { MODERN_CITY_EXPOSED_TOOLS, modernCityTargetFor } from '../modernCityPolicy';
import { SF_STATION_EXPOSED_TOOLS, sfStationTargetFor } from '../sfStationPolicy';
import { PREHISTORIC_EXPOSED_TOOLS, prehistoricTargetFor } from '../prehistoricPolicy';
import { DESERT_EAST_EXPOSED_TOOLS, desertEastTargetFor } from '../desertEastPolicy';
import { SNOW_NORTH_EXPOSED_TOOLS, snowNorthTargetFor } from '../snowNorthPolicy';
import { villageTypeExposedTools, villageTypeForTurn, villageTypeSuppressesBeodeul, villageTypeSuppressesThemes } from '../villageTypeRoute';
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { KIT_AREA_EXPOSED_TOOLS, kitAreaNote } from "@/editor/tools/kitAreaTools";
import { PLAN_EXECUTION_PREAMBLE, ULTRABRAIN_PLAN_HEADING } from "./planExecution";
import { isGoalCommand } from "./goalCommand";

/**
 * 계획 턴의 지시문 머리. Pi 에는 세션 플래너가 없으므로 «실행하지 말고 계획만» 을 말로 만든다 —
 * 강제는 툴 목록이 한다(request.readOnly). 계획은 도구 결과가 아니라 말로 남으므로 항목 목록을 요구한다.
 */
export const PLAN_ONLY_PREFIX = "[계획 턴] 이번 실행에서는 프로젝트를 바꾸지 않는다. 쓰기 도구가 제공되지 않는다. "
  + "「이 작업」처럼 대상이 말로 주어지지 않았으면 사용자가 고른 영역·이벤트나 직전 대화의 작업을 계획하고, 그런 것이 없으면 무엇을 계획할지 되물어라 — 요청에 없는 작업(실내 시공 등)을 지어내지 마라. "
  + "요청을 실행 순서가 있는 항목 목록으로만 보고하라. 각 항목은 «무엇을 · 어디에 · 왜» 를 담고, 마지막에 예상 위험을 한 줄로 적어라. "
  // 2026-10-12 jp_city 도그푸딩: 읽기를 한 번에 하나씩 30번 해서 계획을 쓰기도 전에 턴 상한에 걸려 첫 제작 전체가 죽었다.
  + "턴은 30번뿐이다 — 서로 의존하지 않는 읽기(프로젝트 요약·맵 영역·이벤트·참고문서)는 한 응답에서 여러 도구를 함께 호출하고, 20번째 턴 전에는 계획을 써라. ";

/**
 * 계획 턴의 턴 상한. 계획은 말로만 남고 읽은 도구 결과는 실행 턴에 넘어가지 않는다 — 실행 턴이 어차피
 * 다시 읽는다. 예전엔 실행과 같은 상한(최대 200턴)을 받아 계획 하나에 수십 번 읽기가 쌓였다.
 */
export const PLAN_MAX_TURNS = 30;

const GENRE_PRESET_ROUTING = "intent:skipped(genre-preset) → 게임 전체 저작";
/** 계획 턴이 의도 목록과 상관없이 쥐는 읽기 도구. 나머지는 find_tools 로 찾는다. */
export const PLAN_READ_TOOLS = ["get_project_summary", "get_map_region", "tile_query", "find_tools"] as const;

export interface PlainPiTurnInput {
  readonly project: Project;
  readonly text: string;
  readonly currentMapId: string | null;
  readonly selection: IntentSelectionFact | null;
  /** 사용자가 편집기에서 골라 둔 이벤트 한 줄(`selectedEventFact`). 「이 NPC」「현재 이벤트」「이 문」이 가리키는 대상이다. */
  readonly selectedEvent?: string | null;
  readonly hasActivePlan: boolean;
  readonly autonomy: AutonomyResolution;
  /** 계획 전용 턴 이외에 요청 의도와 위치 안내 권한을 읽는다. */
  readonly declarer: () => IntentDeclarer;
  readonly piTeam: boolean;
  /** 선언 호출 직전 — 패널은 「의도 읽는 중…」 을 띄운다. */
  readonly onDeclaring?: () => void;
  /** 실행 모델의 컨텍스트 창. 주면 폴백 의도라도 창에 안 들어가는 전체 카탈로그를 보내지 않는다(buildSessionRegistryTools). */
  readonly contextWindow?: number;
}

export interface PlainPiTurnClassification {
  readonly mode: PiAgentMode;
  readonly plan: PiRunPlan;
  readonly questionPromoted: boolean;
  readonly initialToolNames?: readonly string[];
  readonly intentNote: string | null;
  /** 몬스터 수집 의도 — 호출자가 손대지 않은 빈 시작 맵을 몬스터 키트로 옮기고 장르 잠금을 건다(genrePresets.applyMonsterIntentStart). 전체 게임 제작 경로(build_monster_*)도 모델이 도구를 부르기 전에 같이 켠다. */
  readonly monsterKit?: boolean;
  /**
   * 이 턴을 어떻게 읽었는지 한 줄(`intent:llm mode=… construction=… → 마을 계약 …`). 활동 로그의 첫 상태 행이 된다.
   * 2026-09-28 실측: 「위로 올라가면 마을」이 잘못 읽혀 5번 헛돌았는데 사용 로그에는 판정이 한 줄도 없어서
   * 원인을 코드로 역추적해야 했다. 선언을 부르지 않은 턴(장르 프리셋·읽기 전용)은 그 사실을 적는다.
   */
  readonly routingAudit: string;
  /**
   * 선언이 「도구가 갈릴 만큼 모호하다」며 낸 되묻기(선택지 줄 포함). 있으면 호출자(입력창)는 실행하지 않고 이 질문을 사용자에게 보인다.
   * 2026-10-22 배경 조수 시험: 「배경 좀 예쁘게」 에 선언은 「맵 배경/맵 꾸미기」 를 물었지만 Pi 경로가 이 값을 버려 소품 꾸미기 56호출로 갔다.
   */
  readonly clarify?: string;
}

/** 되묻기에 대한 사용자 답을 원래 요청과 묶은 문장의 표지 — 이 표지가 있는 턴은 다시 되묻지 않는다. */
export const CLARIFY_ANSWER_MARKER = "[되묻기 답]";
export function clarifyFollowUpText(original: string, question: string, answer: string): string {
  return `${original}\n${CLARIFY_ANSWER_MARKER} 질문: ${question.split("\n")[0]} → 답: ${answer} — 이 뜻으로 진행한다. 다시 묻지 않는다.`;
}

interface SelectedEventSource {
  readonly maps: Readonly<Record<string, { readonly events?: ReadonlyArray<{ readonly id: string; readonly name?: string; readonly x: number; readonly y: number; readonly pages?: ReadonlyArray<{ readonly id: string; readonly name?: string }> }> } | undefined>>;
}

/**
 * 편집기에서 고른 이벤트를 모델에 주는 한 줄 사실. 영역 선택(`formatScopeNote`)과 같은 종류의 지시어 대상이다 —
 * 이 줄이 없으면 「이 이벤트를 접촉형으로」 같은 요청에서 모델이 맵의 이벤트를 훑어 비슷한 것 하나를 골라
 * 엉뚱한 이벤트를 고친다(2026-10-13 실측: 선택한 주민 대신 집 문의 트리거를 바꿨다). 고른 이벤트가 그 맵에 없으면 null.
 */
export function selectedEventFact(project: SelectedEventSource, mapId: string | null, eventId: string | null, pageId: string | null): string | null {
  if (!mapId || !eventId) return null;
  const event = project.maps[mapId]?.events?.find((candidate) => candidate.id === eventId);
  if (!event) return null;
  const pageIndex = pageId ? (event.pages ?? []).findIndex((page) => page.id === pageId) : -1;
  const page = pageIndex >= 0 ? ` · ${pageIndex + 1}번째 페이지` : "";
  return `[선택한 이벤트] ${event.name ? `${event.name} ` : ""}(${event.id}) 위치 (${event.x},${event.y})${page} — 「이 이벤트」「이 NPC」「이 문」「현재 이벤트」는 이 이벤트다. 다른 이벤트를 고르지 말고 get_event 로 이 id 를 읽어 고친다. 요청이 말하지 않은 다른 이벤트(반대쪽 맵의 문 포함)는 덮어쓰지 않는다 — 반대쪽 출입구가 필요하면 새 이벤트를 새 id 로 만든다.`;
}

/** 평문 한 줄 → 실행 계획. 팀 비트는 설정에서, 읽기 전용·계획은 자율성 다이얼에서 온다. */
export async function classifyPlainPiTurn(input: PlainPiTurnInput): Promise<PlainPiTurnClassification> {
  let plan = resolvePiRunPlan(input.autonomy);
  let questionPromoted = false;
  let initialToolNames: readonly string[] | undefined;
  let intentNote: string | null = null;
  let clarifyIntent: IntentDeclaration | null = null;
  // `/goal` is an explicit campaign command. It must bypass both intent routing and
  // the small genre-preset first-build contract, including the headless generator path
  // that calls this classifier before it can build a ParsedPiCommand.
  if (isGoalCommand(input.text)) {
    // 몬스터 수집 목표(「/goal 장르 프리셋: 몬스터 수집」)도 키트·잠금을 켠다 — 라우팅을 건너뛰어도 첫 맵의 칩셋 계열은 지금 정해진다(2026-10-16 잠금 누수 감사 #1).
    const monsterKit = hasMonsterCollectIntent(input.text);
    const routingAudit = "intent:skipped(goal) → 장기 캠페인 전체 저작" + (monsterKit ? " · 몬스터 수집 의도 → 몬스터 키트" : "");
    return {
      mode: "team",
      plan: { ...plan, readOnly: false, planOnly: false, routineEdit: false, routingAudit },
      questionPromoted: false,
      intentNote: null,
      routingAudit,
      ...(monsterKit ? { monsterKit } : {}),
    };
  }
  // 레거시 장르 프리셋 첫 요청(「장르 프리셋: …」)은 답이 정해져 있다. 새 웰컴 프리셋은 위에서
  // `/goal 장르 프리셋: …`으로 먼저 빠져나간다: 게임 전체를 새로 만드는 다단계 작업이다.
  // 의도 선언은 모델을 두 번 불러 10~24초를 쓰고, 30초 창을 넘기면 첫 생성이 시작조차 못 한다(2026-09-27 실측).
  // 도구는 좁히지 않는다(initialToolNames 없음 = 전체) — 게임 전체 저작은 DB·시스템·맵 도구를 모두 쓴다.
  if (!plan.readOnly && requestsEmeraldMonsterGame(input.text)) {
    const routingAudit = "intent:emerald-monster-game → 전체72맵/60종 제작";
    // One producer owns shared world/DB/session; never scatter a fresh campaign across map bundles.
    return { mode: "single", plan: { ...plan, routineEdit: false, routingAudit }, questionPromoted: false,
      initialToolNames: [...MONSTER_GAME_INITIAL_TOOLS], intentNote: MONSTER_GAME_PRODUCTION_PROMPT + monsterScaleNote(input.text), routingAudit, monsterKit: true };
  }
  // 포켓몬 낱말 없이 말한 몬스터 수집 게임·포획 없는 대회형(2026-10-14 자유도 감사 #3·#5) — 자유 경로로 빠지면 칩셋이 버들항·사막·숲 섞임이었다.
  if (!plan.readOnly) {
    const blank = !input.project.system.monsterCampaign && Object.keys(input.project.maps).length <= 1;
    const kind = classifyMonsterGameRequest(input.text, blank);
    if (kind === 'tournament') {
      const routingAudit = "intent:monster-tournament → 포획 없는 대회형 제작";
      return { mode: "single", plan: { ...plan, routineEdit: false, routingAudit }, questionPromoted: false,
        initialToolNames: [...MONSTER_TOURNAMENT_INITIAL_TOOLS], intentNote: MONSTER_TOURNAMENT_PROMPT, routingAudit, monsterKit: true };
    }
    if (kind === 'expedition') {
      const routingAudit = "intent:monster-expedition → 체육관 없는 도감 탐험 제작";
      return { mode: "single", plan: { ...plan, routineEdit: false, routingAudit }, questionPromoted: false,
        initialToolNames: [...MONSTER_EXPEDITION_INITIAL_TOOLS], intentNote: MONSTER_EXPEDITION_PROMPT, routingAudit, monsterKit: true };
    }
    if (kind === 'campaign') {
      const routingAudit = "intent:monster-collect-free → 몬스터 칩셋 캠페인 제작";
      return { mode: "single", plan: { ...plan, routineEdit: false, routingAudit }, questionPromoted: false,
        initialToolNames: [...MONSTER_GAME_INITIAL_TOOLS], intentNote: MONSTER_GAME_PRODUCTION_PROMPT + MONSTER_FREE_CAMPAIGN_NOTE + monsterScaleNote(input.text), routingAudit, monsterKit: true };
    }
  }
  if (isGenrePresetBriefRequest(input.text)) {
    const team = input.piTeam && !plan.readOnly;
    return { mode: team ? "team" : "single", plan: { ...plan, routineEdit: false, routingAudit: GENRE_PRESET_ROUTING }, questionPromoted: false, intentNote: null,
      routingAudit: GENRE_PRESET_ROUTING };
  }
  let routingAudit = plan.planOnly ? "intent:skipped(plan-only dial)" : "intent:none";
  if (!plan.planOnly) {
    input.onDeclaring?.();
    const { project, text, currentMapId, selection } = input;
    const declareFacts = buildIntentFacts({
      project,
      userText: text,
      currentMapId,
      selection,
      hasActivePlan: input.hasActivePlan,
    });
    let declared = await declareIntentCached(input.declarer(), declareFacts);
    // 공급자가 한 번 느렸다고 지시 전체를 버리지 않는다 — 시간 초과만 한 번 더 시도한다(분류 호출은 폴백을 캐시하지 않는다).
    // 실측 2026-10-13: 동시 실행 5건 중 2건이 「시간 초과(30000ms)」로 턴이 시작도 못 하고 끝났다.
    if (declared.intent.source === "fallback" && !plan.readOnly && /시간 초과/u.test(declared.error ?? "")) {
      declared = await declareIntentCached(input.declarer(), declareFacts);
    }
    if (declared.intent.source === "fallback" && !plan.readOnly) throw new Error(declared.error ?? "요청 범위를 확정하지 못했습니다. 다시 시도해 주세요.");
    plan = { ...plan, viewNavigation: declared.intent.source === "llm" && declared.intent.viewNavigation === true };
    if (declared.intent.source === "llm" && declared.intent.clarify && declared.intent.mode !== "question") clarifyIntent = declared.intent;
    // 선언이 확정한 것을 본문도 읽게 한다 — 세션 경로의 pushOrchestrationMessage(intentNote) 와 같은 자리.
    // Pi 이관(2026-09-11)에서 빠져 author_village·권장 크기·선택 사각형 지시가 모델에 닿지 않았다(2026-09-17 실측).
    const noteTargetMapId = declared.intent.targetMapId ?? currentMapId;
    const noteTargetMap = noteTargetMapId ? project.maps[noteTargetMapId] : undefined;
    // 일본 도시(jp_city) — 대상 맵이 jp_city 이거나 사용자가 칩셋·일본 거리를 말했을 때. 숲마을 계약·버들항 노트 대신 jp_city 노트가 간다(jpCityPolicy).
    // 실측(2026-10-04): 새 프로젝트(버들항 맵)에서 「일본 상가 거리」+author_village 선언이면 버들항 마을 노트가 먼저 잡아 jp_city 는 어디에도 안 나왔다 — 그래서 버들항보다 앞선다.
    // PAW 전용 게이트·팩 도시 타일셋(Rasak·REFMAP) 마을 노트는 2026-10-07 저작권 정리로 지웠다.
    // 테마 칩셋 노트는 하나만 간다. 순서가 곧 우선순위다 — 앞이 잡으면 뒤는 보지 않는다(각 정책은 그 칩셋이 프로젝트에 있을 때만 잡는다).
    // 시대·세계 낱말이 분명한 테마(전국·에도, 스팀펑크, SF, 선사, 사막·동양풍)는 jp_city 보다 먼저 본다 — «일본 전통 마을»·«증기기관 도시 거리»·«네온 거리»가
    // jp_city 의 «도시 거리» 낱말로 새지 않게. 고딕·해적 군도·하늘섬·캠퍼스·도쿄풍 도시(modern_city)는 jp_city 가 이긴다. 다 아니고 대상 계열이 버들항이면 author_beodeul_town.
    // 전국·에도(sengoku_edo) — 전국시대·에도 시대·사무라이·성하마을·일본 전통 …(sengokuEdoPolicy).
    // 마을 종류 표(villageTypeCatalog) — 「엘프 숲 마을」「해저 돔」처럼 그림이 없는 종류는 어떤 칩셋 노트도 붙이지 않고(짓지 말고 말하게),
    // 「조선 장터」「달 정착지」처럼 버들항이 아닌 칩셋의 종류는 버들항 마을 노트를 끈다(정책 낱말이 못 잡아도 버들항으로 새지 않게).
    const villageType = villageTypeForTurn(declared.intent, text);
    const themesOff = villageTypeSuppressesThemes(villageType);
    const sengoku = themesOff ? null : sengokuTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 스팀펑크 도시(steampunk_city) — 스팀펑크·증기·공장 지대·보일러실 낱말이나 대상 맵이 스팀펑크(steampunkCityPolicy).
    const steampunk = themesOff || sengoku ? null : steampunkTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // SF 정거장·네온 거리(sf_station) — 우주 정거장·연구 기지·달 기지·사이버펑크 거리(sfStationPolicy).
    const sfStation = themesOff || sengoku || steampunk ? null : sfStationTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 선사 원시 세계(prehistoric) — 선사·원시·석기·공룡·동굴 부족 낱말이나 대상 맵이 선사 칩셋(prehistoricPolicy). 그냥 동굴·던전은 잡지 않는다.
    const prehistoric = themesOff || sengoku || steampunk || sfStation ? null : prehistoricTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 사막·동양풍(desert_east) — 사막·오아시스·바자르·피라미드·아라비안·실크로드 낱말이나 대상 맵이 사막 칩셋(desertEastPolicy). «로마풍·버들항 사막»은 버들항.
    const desertEast = themesOff || sengoku || steampunk || sfStation || prehistoric ? null : desertEastTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 북방 설원(snow_north) — 북방·바이킹·설원 마을·얼어붙은 호수·얼음 동굴 입구 낱말이나 대상 맵이 snow_north(snowNorthPolicy).
    // 버들항 문맥(문장이 버들항을 말하거나 지금 맵이 버들항)의 일반 눈 낱말은 잡지 않는다 — 그건 아래 버들항 마을(theme:"snow") 몫이다.
    const snowNorth = themesOff || sengoku || steampunk || sfStation || prehistoric || desertEast ? null : snowNorthTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    const eraTheme = sengoku || steampunk || sfStation || prehistoric || desertEast || snowNorth;
    const jpCity = themesOff || eraTheme ? null : jpCityTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 박물관·배 안·투기장 실내(손 도트 실내 interior-plus) — 호러·고딕 낱말이 없을 때만(interiorPlusPolicy). 고딕 미술관·해적 군도 바깥보다 먼저 본다.
    const interiorPlus = themesOff || eraTheme || jpCity ? null : interiorPlusTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 고딕 저택(gothic_manor) — gothicPolicy.
    const gothic = themesOff || eraTheme || jpCity || interiorPlus ? null : gothicTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 해적 군도(pirate_isles) — pirateIslesPolicy.
    const pirateIsles = themesOff || eraTheme || jpCity || interiorPlus || gothic ? null : pirateIslesTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 하늘섬(sky_island) — 하늘섬·구름 위·비공정 낱말(skyIslandPolicy).
    const skyIsland = themesOff || eraTheme || jpCity || interiorPlus || gothic || pirateIsles ? null : skyIslandTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 캠퍼스(modern_campus) — 일본풍 학교는 jp_city, 마법 학교는 wizarding_world 가 이긴다(campusPolicy).
    const campus = themesOff || eraTheme || jpCity || interiorPlus || gothic || pirateIsles || skyIsland ? null : campusTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 도쿄풍 도시(modern_city) — 보는 맵이 modern_city 이거나 칩셋 이름을 불렀을 때만(거리·편의점 낱말은 jp_city, 학교는 캠퍼스 몫). 앞의 누구도 안 잡았을 때만 본다.
    const modernCity = themesOff || eraTheme || jpCity || interiorPlus || gothic || pirateIsles || skyIsland || campus ? null : modernCityTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    const beodeulTown = villageTypeSuppressesBeodeul(villageType) || eraTheme || jpCity || interiorPlus || gothic || pirateIsles || skyIsland || campus || modernCity ? null
      : beodeulTownTargetFor(project, declared.intent, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    intentNote = buildPiIntentNote({
      project,
      beodeulTown,
      jpCity,
      interiorPlus,
      gothic,
      pirateIsles,
      sengoku,
      skyIsland,
      steampunk,
      campus,
      modernCity,
      sfStation,
      prehistoric,
      desertEast,
      snowNorth,
      villageType,
      requestText: text,
      intent: declared.intent,
      targetMap: noteTargetMap
        ? { id: noteTargetMap.id, width: noteTargetMap.width, height: noteTargetMap.height, lived: isLivedMap(noteTargetMap) }
        : null,
      selection: selection ?? null,
    });
    // 계획 필요 여부가 규모 기준이다. 단순 생성도 수정과 같은 경로를 쓰며 실패·모호함은 제외한다.
    plan = { ...plan, routineEdit: !declared.error && declared.intent.source === "llm"
      && (declared.intent.mode === "create" || declared.intent.mode === "modify")
      && declared.intent.needsPlan === false
      && declared.intent.clarify === null };
    // 숲마을 author_village 의 「마을 계약」은 2026-10-07 저작권 정리로 시공기와 함께 지웠다 — 마을은 author_beodeul_town 이 짓는다.
    routingAudit = `${formatIntentAudit(declared.intent, declared.elapsedMs)}${declared.error ? ` — 선언 오류: ${declared.error}` : ""}`
      + (sengoku ? " → 전국·에도 맵" : steampunk ? " → 스팀펑크 도시 맵" : sfStation ? " → SF 맵" : prehistoric ? " → 선사 원시 세계 맵" : desertEast ? " → 사막·동양풍 맵" : snowNorth ? ` → 북방 설원 맵(${snowNorth.room ?? snowNorth.outdoor})`
        : jpCity ? " → 일본 도시 맵" : interiorPlus ? ` → 손 도트 실내(${interiorPlus.themes.join("·")})` : gothic ? " → 고딕 저택 맵" : pirateIsles ? " → 해적 군도 맵" : skyIsland ? ` → 하늘섬 맵(${skyIsland.style})`
        : campus ? " → 캠퍼스 맵" : modernCity ? (modernCity.indoor ? " → 도쿄풍 도시 실내" : " → 도쿄풍 도시 맵") : beodeulTown ? " → 버들항 마을" : "")
      + (villageType ? ` · 마을 종류 ${villageType.id}(${villageType.status})` : "");
    if (declared.intent.mode === "question") {
      plan = { ...plan, readOnly: true };
      questionPromoted = true;
    } else {
      // Send exact intent/adventure candidates through the real Pi request path.
      // This is exposure only: discovery can expand it, including full fallback.
      initialToolNames = [...new Set([
        ...buildSessionRegistryTools({ requestText: text, intent: declared.intent, contextWindow: input.contextWindow, hideTool: (toolName) => toolHiddenByMonsterLock(project, toolName, { monsterTurn: isMonsterRequestTurn(text) }) }).map(tool => tool.function.name),
        // jp_city 작업은 첫 요청부터 조립 도구·참고문서·도로 키트 스키마가 보인다 — 자연어 점수 승격은 «이자카야 빌딩 세워줘» 같은 문장을 놓친다.
        ...(jpCity ? JP_CITY_EXPOSED_TOOLS : []),
        ...(interiorPlus ? INTERIOR_PLUS_EXPOSED_TOOLS : []),
        ...(gothic ? GOTHIC_EXPOSED_TOOLS : []),
        ...(pirateIsles ? PIRATE_ISLES_EXPOSED_TOOLS : []),
        ...(sengoku ? SENGOKU_EXPOSED_TOOLS : []),
        ...(skyIsland ? SKY_ISLAND_EXPOSED_TOOLS : []),
        ...(steampunk ? STEAMPUNK_EXPOSED_TOOLS : []),
        ...(campus ? CAMPUS_EXPOSED_TOOLS : []),
        ...(modernCity ? MODERN_CITY_EXPOSED_TOOLS : []),
        ...(sfStation ? SF_STATION_EXPOSED_TOOLS : []),
        ...(prehistoric ? PREHISTORIC_EXPOSED_TOOLS : []),
        ...(desertEast ? DESERT_EAST_EXPOSED_TOOLS : []),
        ...(snowNorth ? SNOW_NORTH_EXPOSED_TOOLS : []),
        ...villageTypeExposedTools(villageType),
        ...(requestsOpeningProduction(text) || requestsFullGameOpeningProduction(text) || isRomanceGameRequest(text) ? OPENING_ANIMATIC_AUTHORING_TOOLS : []),
      ])];
      if (SCENE_SETTING_PATTERN.test(text)) intentNote = intentNote ? `${intentNote}\n\n${SCENE_SETTING_NOTE}` : SCENE_SETTING_NOTE;
      if ((requestsOpeningProduction(text) || requestsFullGameOpeningProduction(text) || isRomanceGameRequest(text)) && !(intentNote ?? "").includes("create_opening_animatic_shot")) {
        const openingNote = "[새로하기 오프닝·타이틀 — #2852 레이어드 도트 애니메틱 6샷 필수] 새 게임 제작 시 타이틀(set_title_screen title + backgroundResourceId:'oprn-still-...')과 새로하기 오프닝 **6샷(shot_1..shot_6)**도 반드시 함께 제작한다(generate_title_art·generate_opening_image 호출 금지, list_opening_media 의 oprn-still-kingdom-day·oprn-still-dark-citadel·oprn-still-snow-village·oprn-still-desert-ruin·oprn-still-farm-golden·oprn-still-forest-path·oprn-pack-still-sky-01·oprn-pack-still-sky-03 등 한 장면이 화면을 꽉 채우는 번들 배경 활용 — 분할 화면·게임 UI가 박힌 참고 스틸(suitableForOpening:false, 예 oprn-still-hero-dawn)은 거절된다): plan_opening(bible 포함, 6샷) → 6샷 각각 create_opening_animatic_shot(width:384,height:216,durationMs:6500) → set_opening_pixel_grid(384,216) → place_opening_background(6샷 서로 다른 oprn-still-*/oprn-pack-still-* 배경) → place_opening_charset_actor(charsetResourceId:'oprn-charset-heroes1', characterIndex:0..7, x:72, y:136, toX:200 걷기 포함) → upsert_opening_light_fx + animate_opening_camera → set_opening_caption(전 샷 #fff0dc 통일) → set_opening(6개 animatic shotId 연결) → review_opening. 제목 카드 한 장이나 정지 그림 슬라이드, 6샷 미만으로 끝내지 않는다.";
        intentNote = intentNote ? `${intentNote}\n\n${openingNote}` : openingNote;
      }
      // 개념 카드 노트가 붙는 요청이면 예제를 짓는 도구를 처음부터 쥐여 준다 — 노트가 이 도구 이름을 부른다.
      if (conceptCardsForText(text).length && !initialToolNames.includes("build_concept_example")) initialToolNames = [...initialToolNames, "build_concept_example"];
      // 키트 시트 야외 맵(몬스터 수집 마을 등)의 빈 터 꾸미기 — 도구를 보이게 하고 노트로 이름을 부른다(2026-10-07 이어 고치기 r8~r11).
      const kitNote = kitAreaNote(project, noteTargetMapId);
      if (kitNote) {
        initialToolNames = [...new Set([...initialToolNames, ...KIT_AREA_EXPOSED_TOOLS])];
        intentNote = intentNote ? `${intentNote}\n\n${kitNote}` : kitNote;
      }
    }
  }
  if (input.selectedEvent) intentNote = intentNote ? `${intentNote}\n${input.selectedEvent}` : input.selectedEvent;
  // 몬스터 자산 역방향 잠금: 몬스터 프로젝트가 아니고 이번 요청도 몬스터 수집 요청이 아니면 첫 노출 목록에서 포켓몬식 도구를 빼고, 의도 메모의 몬스터 키트 문구를 지운다.
  const monsterTurn = { monsterTurn: isMonsterRequestTurn(input.text) };
  if (!monsterAssetsAllowed(input.project, monsterTurn)) {
    if (initialToolNames) initialToolNames = initialToolNames.filter((toolName) => !toolHiddenByMonsterLock(input.project, toolName, monsterTurn));
    if (intentNote) intentNote = stripMonsterKitMentions(intentNote);
  }
  const monsterKit = !plan.readOnly && hasMonsterCollectIntent(input.text);
  if (monsterKit) {
    intentNote = intentNote ? `${intentNote}\n\n${MONSTER_FREE_KIT_NOTE}` : MONSTER_FREE_KIT_NOTE;
    routingAudit += " · 몬스터 수집 의도 → 몬스터 키트";
  }
  const team = input.piTeam && !plan.readOnly;
  const clarify = clarifyIntent && !plan.readOnly && !input.text.includes(CLARIFY_ANSWER_MARKER) ? formatIntentClarifyMessage(clarifyIntent) : undefined;
  if (clarify) routingAudit += " · 되묻기";
  return { mode: team ? "team" : "single", plan: { ...plan, routingAudit }, questionPromoted, ...(initialToolNames ? { initialToolNames } : {}), intentNote, routingAudit, ...(monsterKit ? { monsterKit } : {}), ...(clarify ? { clarify } : {}) };
}

/** Ultrabrain 계획 턴을 먼저 돌리는가 — 단독·쓰기·비일상 실행만. */
export function needsUltrabrainPlanTurn(input: {
  readonly readOnly: boolean;
  readonly team: boolean;
  readonly routineEdit: boolean;
  readonly applyMode: PiApplyMode;
}): boolean {
  return !input.readOnly && !input.team && !input.routineEdit && input.applyMode !== "yolo";
}

export interface UltrabrainModel {
  readonly providerId?: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}

/** 계획 턴 요청(읽기 전용). */
export function buildUltrabrainPlanRequest(input: {
  readonly projectKey?: string;
  readonly brain: UltrabrainModel;
  readonly modelTask: string;
  readonly mapIds: readonly string[];
  readonly currentMapId?: string;
  readonly approvedTilesetFamilies?: readonly string[];
  readonly editHistory?: PiAgentRequest["editHistory"];
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly maxTurns?: number;
  readonly initialToolNames?: readonly string[];
}): PiAgentRequest {
  return {
    mode: "single", provider: input.brain.providerId!, model: input.brain.model, projectKey: input.projectKey,
    task: `${PLAN_ONLY_PREFIX}${input.modelTask}`, mapIds: input.mapIds,
    ...(input.currentMapId ? { currentMapId: input.currentMapId } : {}), project: input.project,
    ...(input.approvedTilesetFamilies?.length ? { approvedTilesetFamilies: input.approvedTilesetFamilies } : {}),
    ...(input.editHistory?.length ? { editHistory: input.editHistory } : {}),
    scopeStrict: input.scopedByUser,
    readOnly: true, maxTurns: Math.min(input.maxTurns ?? PLAN_MAX_TURNS, PLAN_MAX_TURNS),
    thinkingLevel: input.brain.reasoningEffort as PiAgentThinkingLevel,
    ...(input.initialToolNames ? { initialToolNames: [...new Set([...input.initialToolNames, ...PLAN_READ_TOOLS])] } : {}),
  };
}

/**
 * 자율성 다이얼이 역할 저장값(Deep)을 이겨도 되는가. 「저장값이 있나」로는 판정할 수 없다 —
 * 설정 모달의 `collect()` 가 저장마다 역할 3개를 모두 쓰므로(aiSettingsModal), 설정을 한 번이라도
 * 만진 사용자는 전원 `roleModels.deep` 을 갖는다. 그래서 「저장값이 폴백과 다른가」로 본다:
 * 세 항목(공급자·모델·사고 강도)이 폴백과 같으면 사용자가 고른 것이 아니라 모달이 적어 준 값이다.
 * `derived` 는 호출자가 `modelForRole({ ...config, roleModels: undefined }, "deep")` 로 넘긴다.
 */
export function prefersCallerThinking(stored: RoleModel | undefined, derived: RoleModel): boolean {
  if (!stored) return true;
  return stored.provider === derived.provider && stored.model === derived.model
    && stored.thinkingLevel === derived.thinkingLevel;
}

/** 실행 턴이 읽는 지시문 = 모델 지시 + 「지금은 실행 턴」 + Ultrabrain 계획(planExecution.ts). */
export function withUltrabrainPlan(modelTask: string, plan: string): string {
  return `${modelTask}\n\n${PLAN_EXECUTION_PREAMBLE}\n\n${ULTRABRAIN_PLAN_HEADING}\n${plan}`;
}

/** 실행 턴(또는 계획 전용 턴) 요청. */
export function buildPiRunRequest(input: {
  readonly projectKey?: string;
  readonly team: boolean;
  readonly planOnly?: boolean;
  readonly readOnly: boolean;
  readonly applyMode: PiApplyMode;
  readonly brain: UltrabrainModel;
  readonly deep: RoleModel;
  readonly writer: RoleModel;
  readonly modelTask: string;
  readonly executionTask: string;
  readonly mapIds: readonly string[];
  readonly currentMapId?: string;
  readonly approvedTilesetFamilies?: readonly string[];
  readonly editHistory?: PiAgentRequest["editHistory"];
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly mapBundleMerge: boolean;
  readonly maxTurns?: number;
  readonly toolDomains?: readonly string[];
  readonly initialToolNames?: readonly string[];
  readonly teamSpec?: PiTeamSpec;
  /** 자율성 다이얼이 푼 사고 강도(`resolvePiRunPlan(...).thinkingLevel`). `preferCallerThinking` 없이는 쓰이지 않는다. */
  readonly callerThinkingLevel?: PiAgentThinkingLevel;
  /** 다이얼을 역할·Ultrabrain 설정보다 앞세운다. 두 입력을 다 비운 옛 호출자는 예전 그대로 역할 값을 쓴다. */
  readonly preferCallerThinking?: boolean;
  /** 다듬기 모드 — 그대로 요청에 싣는다(featureReview.ts). */
  readonly polish?: PiAgentRequest["polish"];
}): PiAgentRequest {
  const brainRun = input.planOnly || input.team;
  const effectiveProvider = brainRun ? input.brain.providerId! : input.deep.provider;
  // 다이얼을 안 실은 턴은 여전히 역할 값이다 — 계획·팀 턴은 Ultrabrain 강도로 돌아서 계획을 몰래 낮추지 않는다.
  const roleLevel = (brainRun ? input.brain.reasoningEffort : input.deep.thinkingLevel) as PiAgentThinkingLevel;
  // 다이얼은 **실행 턴만** 움직인다 — brainRun(계획 턴·팀 턴)은 다이얼을 실어도 Ultrabrain 강도를 지킨다.
  // 자율성 「확인」은 planOnly + reasoningEffort "low" 로 풀리고 패널은 그때도 preferCallerThinking 을
  // 같이 실으므로(aiPiAgentCommand 의 실행 턴 요청), brainRun 을 안 빼면 Ultrabrain 계획이 high → low 로
  // 조용히 떨어진다(2026-09-26 리뷰 실측). 두 입력을 다 비운 옛 호출자는 여전히 역할 값 그대로다.
  const level = !brainRun && input.preferCallerThinking && input.callerThinkingLevel ? input.callerThinkingLevel : roleLevel;
  return {
    mode: input.team ? "team" : "single",
    projectKey: input.projectKey,
    applyMode: input.applyMode,
    provider: brainRun ? input.brain.providerId! : input.deep.provider,
    model: brainRun ? input.brain.model : input.deep.model,
    ...(!input.planOnly ? { roleModels: { deep: input.deep, writer: input.writer } } : {}),
    task: input.planOnly ? `${PLAN_ONLY_PREFIX}${input.modelTask}` : input.executionTask,
    mapIds: input.mapIds,
    ...(input.currentMapId ? { currentMapId: input.currentMapId } : {}),
    ...(input.approvedTilesetFamilies?.length ? { approvedTilesetFamilies: input.approvedTilesetFamilies } : {}),
    ...(input.editHistory?.length ? { editHistory: input.editHistory } : {}),
    project: input.project,
    // 평문 턴의 기본 대상 맵은 계약이 아니다 — 계약으로 읽히면 모델이 DB·시스템을 손대지 않는다.
    scopeStrict: input.scopedByUser,
    ...(input.mapBundleMerge ? { mapBundleMerge: true } : {}),
    ...(input.readOnly ? { readOnly: true } : {}),
    ...(input.maxTurns === undefined ? {} : { maxTurns: input.maxTurns }),
    thinkingLevel: normalizePiThinkingLevel(effectiveProvider, level),
    ...(input.toolDomains && input.toolDomains.length > 0 ? { toolDomains: input.toolDomains } : {}),
    ...(input.initialToolNames ? { initialToolNames: input.initialToolNames } : {}),
    ...(input.teamSpec ? { team: input.teamSpec } : {}),
    ...(input.polish ? { polish: input.polish } : {}),
  };
}
