// 조수 채팅의 실행 계획 — 루프는 Pi 하나다(2026-09-11).
//
// 예전에는 「경로」 enum(`session | pi-agent | pi-team`)이 «어느 루프로 가는가» 를 답했다. 조수 세션을
// deprecated 하면서 답할 것이 없어졌다: 사용자가 고르는 값은 이제 «그 Pi 를 무엇까지 허용하는가»
// 하나이고, 그 답은 자율성 다이얼(`autonomyLevels`)에서 나온다.
//
// 팀도 경로가 아니다 — Pi 루프의 실행 모드(`PiAgentMode`)다. 그 비트의 자리는 `AiConfig.piTeam`
// 하나이고, 컴포저 「팀」 토글과 설정 「Pi 팀 실행」 이 같은 값을 읽는다. 경로 enum 으로 한 번 더
// 인코딩하면 라우트 → `/pi team` 문자열 → 파서 왕복이 생겨 한 비트를 네 곳에서 표현하게 된다.

import { conceptCardsForText, formatConceptCardNote } from "../conceptCards";
import { formatWorldmapChoiceNote } from '../worldmapChoiceNote';
import { formatBeodeulTownNote, type BeodeulTownTarget } from "./beodeulTownRoute";
import { formatJpCityNote, type JpCityTarget } from "@/ai/jpCityPolicy";
import type { AutonomyResolution } from "@/ai/autonomyLevels";
import {
  formatIntentNote,
  formatScopeNote,
  type IntentDeclaration,
  type IntentNoteTargetMap,
  type IntentSelectionFact,
} from "@/ai/intentDeclaration";
import type { Project } from "@/project/types";
import type { PiAgentThinkingLevel } from "./protocol";

export { DEFAULT_PI_APPLY, type PiApplyMode } from "./applyMode";
/** 팀 실행 기본값. 컴포저 「팀」 토글·설정 「Pi 팀 실행」 이 이 값을 덮는다. */
export { DEFAULT_PI_TEAM } from "./executionDefaults";

/**
 * 옛 blob 호환 어휘. 경로 enum 이 있던 시절 `executionRoute` 키가 저장돼 있다:
 * `"pi-team"` 은 «Pi + 팀» 이었고, `"session"`·`"pi-agent"` 는 둘 다 «Pi» 다. 새 코드는 이 키를
 * 쓰지 않는다 — 읽는 곳은 `loadAiConfig` 의 승격 한 곳뿐이다(옛 값을 지우면 사용자의 팀 설정이
 * 조용히 사라지고, 남겨 두면 두 어휘가 살아 있는 것처럼 보인다).
 */
export { LEGACY_PI_TEAM_ROUTE } from "./executionDefaults";
/** 다이얼 한 값이 이번 실행에 대해 정하는 것 전부. */
export interface PiRunPlan {
  /** Request-local location guidance, declared from the user's instruction. */
  readonly viewNavigation?: boolean;
  /** 이 턴을 어떻게 읽었는지 한 줄(classifyPlainPiTurn). 활동 로그의 「의도 판정」 행이 된다. 실행은 이 값을 읽지 않는다. */
  readonly routingAudit?: string;
  /** 기존 의도 선언이 확인한 단순 생성·수정. 별도 계획·시각 검토를 생략할 후보다. */
  readonly routineEdit?: boolean;
  /** 쓰기 툴 없이 조회·보고만 한다(읽기 전용 레벨·계획 턴). */
  readonly readOnly: boolean;
  /** 실행하지 않고 계획만 세운다. Pi 에는 세션 플래너가 없으므로 프롬프트 지시로 만들고, readOnly 와 함께 쓴다. */
  readonly planOnly: boolean;
  /** 다이얼의 **턴** 예산 → Pi 턴 상한. 도구 호출 예산(`budgetCap`)과 단위가 다르다. */
  readonly maxTurns: number;
  /** 다이얼의 추론 강도 → Pi thinking level. */
  readonly thinkingLevel: PiAgentThinkingLevel;
}

/**
 * 레벨을 Pi 노브로 푼다. 계획 턴은 쓰이면 안 된다 — 세션에서는 플래너가 실행을 막았고, 지금은
 * 쓰기 툴 미제공(`readOnly`)이 그 역할을 한다.
 */
export function resolvePiRunPlan(autonomy: AutonomyResolution): PiRunPlan {
  return {
    readOnly: autonomy.readOnly || autonomy.planOnly,
    planOnly: autonomy.planOnly,
    maxTurns: autonomy.piMaxTurns,
    thinkingLevel: autonomy.reasoningEffort,
  };
}


/** 노트가 판단에 쓰는 대상 맵 사실 — 크기와 «이미 내용이 있는가»(authorVillageScope.isLivedMap). */
export interface PiIntentNoteTargetMap extends IntentNoteTargetMap {
  /** 새 맵 바닥 칸 아닌 타일이나 이벤트가 하나라도 있으면 true(livedMap.ts). 시공 도구가 전체 재시공을 피해야 하는 맵이다. */
  readonly lived: boolean;
}

/** 선언 → Pi 본문 노트 재료. 전부 코드가 아는 값이다. */
export interface PiIntentNoteInput {
  readonly intent: IntentDeclaration;
  readonly project?: Pick<Project, "defaultVillagePresetId" | "villagePresets"> & { system?: Pick<Project['system'], 'genre'> } & Partial<Pick<Project, 'maps' | 'tilesets' | 'startMapId'>>;
  /** 선언이 가리킨 맵, 없으면 지금 열린 맵. 시공 규모 노트가 «키워라/충분하다» 를 이 크기로 판단한다. */
  readonly targetMap: PiIntentNoteTargetMap | null;
  /** 사용자의 선택 사각형. 있으면 «그 안에서» 경계를 못박는다. */
  readonly selection: IntentSelectionFact | null;
  /** 요청이 버들항 계열 마을이면 그 대상 — 숲마을 노트 대신 author_beodeul_town 노트(beodeulTownRoute). */
  readonly beodeulTown?: BeodeulTownTarget | null;
  /** 요청·대상 맵이 일본 도시(jp_city) 칩셋이면 그 대상 — 숲마을 노트 대신 build_jp_city_building 노트(jpCityPolicy). */
  readonly jpCity?: JpCityTarget | null;
  /**
   * 사용자 문장. 있으면 숲마을 노트에 요청에 가까운 완성 마을 사례([참고 마을])를 붙인다.
   * 2026-09-28: 사례 약 70곳이 Pi 프롬프트·노트·도구 결과 어디에도 없어 모델이 기본값(12채·강변촌)만 썼다.
   */
  readonly requestText?: string;
}

/**
 * 선언이 확정한 것을 Pi 본문(계획 턴·실행 턴·팀장)이 읽는 한 덩어리로 만든다.
 *
 * 세션 경로는 `formatIntentNote`·`formatScopeNote` 를 오케스트레이션 메시지로 밀어 넣었는데, 채팅이
 * Pi 로 이사한 2026-09-11 에 이 둘이 딸려 오지 않았다. 선언은 툴 도메인(`intentToolDomains`)만 열고
 * 끝났고, «어느 시공 도구로·권장 크기는 W×H·선택 사각형 안에서» 는 아무 모델도 못 봤다 —
 * 그래서 「마을을 만들어달라」가 paint_road 다섯 번으로 끝났다(2026-09-17 실측). 계획 턴은 읽기 전용이라
 * 시공 도구를 목록에서조차 볼 수 없으므로, 이 노트가 유일하게 이름을 알려 주는 자리다.
 *
 * clarifyBypassed 는 늘 true 다 — Pi 경로에는 되묻는 자리가 없어서 «가장 그럴듯한 해석으로 진행하고
 * 첫 문장에 밝혀라» 가 정직한 지시다.
 */
export function buildPiIntentNote(input: PiIntentNoteInput): string | null {
  // 개념 카드(미궁·카타콤…)는 맨 앞 — 재료·이벤트·금지 규칙이 뒤의 일반 노트보다 먼저 읽혀야 한다.
  const conceptNote = formatConceptCardNote(conceptCardsForText(input.requestText));
  const worldmapNote = formatWorldmapChoiceNote(input.requestText, input.project, input.targetMap?.id);
  const intentNote = formatIntentNote(input.intent, { clarifyBypassed: true, targetMap: input.targetMap });
  const villageNote = input.beodeulTown ? formatBeodeulTownNote(input.beodeulTown, input.targetMap)
    : input.jpCity ? formatJpCityNote(input.jpCity, input.targetMap)
    : null;
  const scopeNote = input.selection
    ? formatScopeNote({ mapId: input.selection.mapId, region: input.selection }, input.intent)
    : null;
  const parts = [conceptNote, worldmapNote, intentNote, villageNote, scopeNote].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * 지시문 뒤에 노트를 붙인다. 사용자 문장이 먼저다 — 로그·보드·요약·조화 검수는 `command.task`(사용자
 * 문장)를 그대로 쓰고, 모델에 가는 문자열만 이걸 쓴다.
 */
export function composePiTask(task: string, intentNote: string | null | undefined): string {
  return intentNote ? `${task}\n\n${intentNote}` : task;
}
