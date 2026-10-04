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
import { formatPackTownNote, type PackTownTarget } from "./packTownRoute";
import { formatBeodeulTownNote, type BeodeulTownTarget } from "./beodeulTownRoute";
import { formatJpCityNote, type JpCityTarget } from "@/ai/jpCityPolicy";
import type { AutonomyResolution } from "@/ai/autonomyLevels";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
import { formatVillageReferenceNote, villageReferenceExamples } from "@/ai/villageReferenceExamples";
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
export const DEFAULT_PI_TEAM = false;

/**
 * 옛 blob 호환 어휘. 경로 enum 이 있던 시절 `executionRoute` 키가 저장돼 있다:
 * `"pi-team"` 은 «Pi + 팀» 이었고, `"session"`·`"pi-agent"` 는 둘 다 «Pi» 다. 새 코드는 이 키를
 * 쓰지 않는다 — 읽는 곳은 `loadAiConfig` 의 승격 한 곳뿐이다(옛 값을 지우면 사용자의 팀 설정이
 * 조용히 사라지고, 남겨 두면 두 어휘가 살아 있는 것처럼 보인다).
 */
export const LEGACY_PI_TEAM_ROUTE = "pi-team";
/** 다이얼 한 값이 이번 실행에 대해 정하는 것 전부. */
export interface PiRunPlan {
  /** Request-local location guidance, declared from the user's instruction. */
  readonly viewNavigation?: boolean;
  readonly villageContract?: import("./villageContract").VillageContract;
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
  /** 기본 풀 아닌 타일이나 이벤트가 하나라도 있으면 true. author_village 가 bounds·fullMap 없이는 거절하는 맵이다. */
  readonly lived: boolean;
}

/** 선언 → Pi 본문 노트 재료. 전부 코드가 아는 값이다. */
export interface PiIntentNoteInput {
  readonly intent: IntentDeclaration;
  readonly project?: Pick<Project, "defaultVillagePresetId" | "villagePresets">;
  /** 선언이 가리킨 맵, 없으면 지금 열린 맵. 시공 규모 노트가 «키워라/충분하다» 를 이 크기로 판단한다. */
  readonly targetMap: PiIntentNoteTargetMap | null;
  /** 사용자의 선택 사각형. 있으면 «그 안에서» 경계와 author_village target 을 못박는다. */
  readonly selection: IntentSelectionFact | null;
  /** 요청이 팩 도시 타일셋(Rasak 등) 마을이면 그 타일셋 — 숲마을 노트 대신 build_pack_town 노트(packTownRoute). */
  readonly packTown?: PackTownTarget | null;
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
 * 끝났고, «author_village 로 지어라·권장 크기는 W×H·선택 사각형 안에서» 는 아무 모델도 못 봤다 —
 * 그래서 「마을을 만들어달라」가 paint_road 다섯 번으로 끝났다(2026-09-17 실측). 계획 턴은 읽기 전용이라
 * author_village 를 목록에서조차 볼 수 없으므로, 이 노트가 유일하게 이름을 알려 주는 자리다.
 *
 * clarifyBypassed 는 늘 true 다 — Pi 경로에는 되묻는 자리가 없어서 «가장 그럴듯한 해석으로 진행하고
 * 첫 문장에 밝혀라» 가 정직한 지시다.
 */
export function buildPiIntentNote(input: PiIntentNoteInput): string | null {
  // 개념 카드(미궁·카타콤…)는 맨 앞 — 재료·이벤트·금지 규칙이 뒤의 일반 노트보다 먼저 읽혀야 한다.
  const conceptNote = formatConceptCardNote(conceptCardsForText(input.requestText));
  const preset = defaultVillageDesign(input);
  // Generic scale advice must not override a saved design or resize before its validation.
  const noteIntent = preset ? { ...input.intent, construction: undefined } : input.intent;
  const intentNote = formatIntentNote(noteIntent, { clarifyBypassed: true, targetMap: input.targetMap });
  const villageNote = input.packTown ? formatPackTownNote(input.packTown, input.targetMap)
    : input.beodeulTown ? formatBeodeulTownNote(input.beodeulTown, input.targetMap)
    : input.jpCity ? formatJpCityNote(input.jpCity, input.targetMap)
    : formatPiVillageNote(input);
  const referenceNote = !input.packTown && !input.beodeulTown && !input.jpCity && villageNote && input.requestText !== undefined && input.project && "tilesets" in input.project
    ? formatVillageReferenceNote(villageReferenceExamples(input.project as Project, input.requestText))
    : null;
  const scopeNote = input.selection
    ? formatScopeNote({ mapId: input.selection.mapId, region: input.selection }, input.intent)
    : null;
  const parts = [conceptNote, intentNote, villageNote, referenceNote, scopeNote].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * 지시문 뒤에 노트를 붙인다. 사용자 문장이 먼저다 — 로그·보드·요약·조화 검수는 `command.task`(사용자
 * 문장)를 그대로 쓰고, 모델에 가는 문자열만 이걸 쓴다.
 */
export function composePiTask(task: string, intentNote: string | null | undefined): string {
  return intentNote ? `${task}\n\n${intentNote}` : task;
}

/**
 * 선언이 author_village 를 고른 턴의 마을 노트 — 마을 이론(집 → 길 → 나무 → 호수·마당)은 그 한 호출 안에 있다.
 *
 * 2026-09-17 실측(빈 20×15 맵, 「마을을 만들어달라」): 선언은 tools 첫 자리에 author_village 를 적었지만 그
 * 이름은 모델에 닿지 않았고, 수량이 없어 [시공 규모] 도 붙지 않았다. 계획 턴은 읽기 전용이라 author_village 를
 * 목록에서 볼 수도 없어 «fill_region 으로 길, author_house 2채, place_props» 를 짰고, 실행은 그 산문을 따라
 * 16턴을 다 쓰고 집 2채로 끝났다. 도구 계층은 이미 다 준비돼 있다 — 빈 기존 맵은 bounds 없이 전체 시공되고
 * 집 수에 필요한 크기로 스스로 넓힌다(authorVillageToolDef). 여기서는 그 사실을 모델에게 말로 전할 뿐이다.
 *
 * 평문 채팅은 현재 맵을 기본 대상으로 삼지만 scopeStrict=false여서 필요하면 새 맵을 만들 수 있다.
 * DB 기본 설계서가 있으면 일반 규모 기본값보다 설계서 계약을 우선한다.
 */
function defaultVillageDesign(input: PiIntentNoteInput) {
  if (!input.intent.tools.includes("author_village")) return undefined;
  const preset = input.project?.villagePresets?.find(p => p.id === input.project?.defaultVillagePresetId);
  return preset?.design ? preset : undefined;
}

function formatPiVillageNote(input: PiIntentNoteInput): string | null {
  const { intent, targetMap, selection } = input;
  if (intent.source !== "llm" || intent.mode === "question" || !intent.tools.includes("author_village")) return null;
  const preset = defaultVillageDesign(input);
  const declaredCount = intent.construction?.houseCount;
  const size = estimateVillageSize(preset
    ? { houseCount: declaredCount ?? preset.houseCount ?? preset.design!.houseCount.min }
    : intent.construction);
  const lines = [
    "[마을 시공] 선언이 author_village 를 골랐다. 집 한 채가 아니라 마을이므로 author_house 를 채마다 부르지 말고 "
      + "author_village 한 호출로 짓는다 — 집·길·나무·호수·광장·마당을 설계서 순서(집 → 길 → 나무 → 호수·마당)로 코드가 시공한다. "
      + "paint_road·fill_region·place_props 로 길과 나무를 손으로 깔지 말 것(마을 이론을 건너뛴 결과가 된다).",
  ];
  if (selection && intent.useSelection) {
    lines.push("target 은 아래 [선택 영역] 노트의 사각형이다.");
  } else if (intent.construction?.approach) {
    // 「위로 올라가면 마을」— 지금 맵은 출발지이고 마을은 그 너머의 새 맵이다. 지금 맵 위에 짓지 않는다.
    const from = targetMap ? `'${targetMap.id}'` : "지금 맵";
    lines.push(
      `마을은 ${from}의 ${intent.construction.approach} 쪽으로 나가면 나오는 새 맵이다 → target:{kind:"new", mapId, name}. ${from} 위에 짓지 않는다. `
        + `마을 계약이 있으면 출입구와 시작 위치는 코드가 잇는다. 계약이 없으면 시공 뒤 link_maps 로 ${from}의 ${intent.construction.approach} 끝과 마을의 반대쪽 끝을 잇는다.`,
    );
  } else if (targetMap && !targetMap.lived) {
    lines.push(
      `지금 맵 '${targetMap.id}'(${targetMap.width}×${targetMap.height})은 비어 있다 → target:{kind:"existing", mapId:"${targetMap.id}"} 로 맵 전체에 짓는다(bounds·fullMap 불필요). `
        + `집 수에 필요한 크기(${size.width}×${size.height})로 코드가 스스로 넓히니 resize_map 은 부르지 않는다.`,
    );
  } else if (targetMap) {
    lines.push(
      // 「새 맵은 버려진다」는 평문 턴이 언제나 맵 묶음으로 잘리던 시절의 사실이다. 2026-09-17
      // 이후 평문 턴은 잘리지 않으므로(aiPiAgentCommand 의 mergedFromBundles) 그 문장을 지웠다 —
      // 남겨 두면 모델이 할 수 있는 일을 못 한다고 믿고 「빈 맵을 열어 달라」며 거절한다.
      `지금 맵 '${targetMap.id}'(${targetMap.width}×${targetMap.height})에는 이미 내용이 있다. 되도록 이 맵 안에서 해결한다. `
        + `빈 땅이 있으면 그 사각형(16×16 이상)을 target:{kind:"existing", mapId:"${targetMap.id}", bounds:{x,y,w,h}} 로 지정해 거기에 짓고, 기존 마을을 손보는 요청이면 손볼 사각형을 bounds 로 준다. `
        + "fullMap:true 는 기존 내용을 지우므로 사용자가 «전부 다시» 라고 했을 때만. 빈 땅도 없고 그런 지시도 없으면 새 맵(target:{kind:\"new\"})을 만들어 거기에 짓고 무엇을 했는지 보고한다.",
    );
  } else {
    lines.push(preset
      ? '대상 맵이 없다 → target:{kind:"new", mapId, name}. width/height는 생략해 선택 설계서와 건물 크기로 계산하게 한다.'
      : `대상 맵이 없다 → target:{kind:"new", mapId, name, width:${size.width}, height:${size.height}}.`);
  }
  if (preset) {
    lines.push(`기본 마을 설계서 ${JSON.stringify(preset.id)}를 사용한다. 고정값은 생략해 도구가 설계서에서 채우게 한다. `
      + (declaredCount === undefined ? "houseCount는 생략한다(12채 등 코드 기본값을 넣지 않는다). " : `사용자가 명시한 houseCount:${declaredCount}를 유지하고 설계서와 충돌하면 차이를 보고한다. `)
      + (intent.construction?.npcCount === undefined ? "" : `사용자가 명시한 npcCount:${intent.construction.npcCount}도 유지한다. `)
      + "forestDensity는 고정 자연 설정이면 생략한다. 특히 숲 없음이면 지정하지 않는다. 자유 설정에서만 요청을 반영한다. "
      + "countPolicy:\"best-effort\". village-design-conflict는 설계서를 몰래 바꾸거나 우회하지 말고 보고한다. 끝나면 evaluate_village_look으로 확인한다.");
  } else lines.push(
    `houseCount:${size.houseCount}${declaredCount === undefined ? "(수량 선언이 없어 코드 기본값)" : ""}, countPolicy:"best-effort", forestDensity 는 반드시 넣는다. `
      + "끝나면 evaluate_village_look 한 번으로 확인하고 보고한다.",
  );
  return lines.join(" ");
}
