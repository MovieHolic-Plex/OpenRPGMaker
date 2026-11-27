import type { EventDraftIssue } from "./eventDraftValidator";

/** Rule-owned text only: safe to export without copying authored names or values. */
const RULES: Readonly<Record<string, readonly [string, string, string, string]>> = {
  "event.missing": ["이벤트를 찾을 수 없습니다.", "현재 맵에 있는 이벤트", "이벤트를 다시 선택해 편집기를 여세요.", "event-editor-name"],
  "page.missing": ["이벤트 페이지가 없습니다.", "한 개 이상의 페이지", "페이지를 추가하세요.", "evt-page-add"],
  "event.position.out-of-bounds": ["이벤트 위치가 맵 밖입니다.", "맵 안의 타일 좌표", "맵에서 이벤트를 유효한 타일로 옮기세요.", "event-editor-coords"],
  "map.position.out-of-bounds": ["목적지 좌표가 맵 범위를 벗어났습니다.", "맵 안의 정수 X, Y 좌표", "목적지 맵과 X, Y를 확인하세요.", "event-inspector-body"],
  "map.area.out-of-bounds": ["생성 영역이 맵 범위를 벗어났습니다.", "맵 안의 양수 너비·높이 영역", "영역의 위치와 크기를 맵 안으로 줄이세요.", "event-inspector-body"],
  "label.empty": ["라벨 이름이 비어 있습니다.", "비어 있지 않은 라벨 이름", "이 실행 범위에서 고유한 이름을 입력하세요.", "event-command-label-name"],
  "label.duplicate": ["같은 실행 범위에 같은 라벨이 있습니다.", "실행 범위마다 고유한 라벨 이름", "중복 라벨을 바꾸고 이동 대상도 맞추세요.", "event-command-label-name"],
  "label.target-missing": ["이동할 라벨이 현재 실행 범위에 없습니다.", "현재 또는 바깥 실행 범위의 라벨", "이동 대상을 기존 라벨 이름과 맞추세요.", "event-command-goto-label-name"],
  "loop.break-outside-loop": ["반복 밖에 반복 탈출 명령이 있습니다.", "반복 본문 안의 탈출 명령", "이 명령을 반복 안으로 옮기거나 제거하세요.", "break-loop-editor"],
  "loop.empty-body": ["반복 내용이 비어 있습니다.", "반복 본문 안의 실행 명령", "반복 안에서 실행할 명령을 추가하거나 반복을 제거하세요.", "event-inspector-body"],
  "loop.no-break": ["반복 탈출이 없어 무한 반복될 수 있습니다.", "반복을 끝내는 반복 탈출 명령", "종료 조건 분기 안에 반복 탈출을 넣으세요.", "event-inspector-body"],
  "variable.divide-by-zero": ["0으로 나누기는 런타임에 무시됩니다.", "0이 아닌 나누기 피연산자", "나누는 값을 0이 아닌 수나 변수로 바꾸세요.", "event-command-variable-operand"],
  "shop.items.empty": ["상점에 판매할 상품이 없습니다.", "한 개 이상의 판매 상품", "상품 추가에서 판매할 상품을 선택하세요.", "shop-add-goods"],
  "shop.stock.orphan": ["상점 재고 항목이 판매 목록에 없습니다.", "판매 목록에 포함된 재고 아이템", "해당 아이템을 판매 목록에 추가하거나 재고에서 제거하세요.", "shop-add-goods"],
  "battle.troop.empty": ["전투 적 그룹에 적이 없습니다.", "한 명 이상의 적이 들어 있는 적 그룹", "데이터베이스에서 적 그룹에 적을 추가하거나 다른 적 그룹을 고르세요.", "battle-processing-troop-select"],
  "changeParty.action.invalid": ["파티 편성 동작 값이 올바르지 않습니다.", "합류(add)·이탈(remove)·선두(lead) 중 하나", "파티 편성 동작을 다시 선택하세요.", "change-party-action-select"],
  "openCraftShop.empty": ["제작 공방에 보여 줄 제작법이 없습니다.", "한 개 이상의 제작법", "제작법을 선택하거나 «모든 제작법»을 켜세요.", "craft-shop-all-recipes"],
  "page.trigger.location-empty": ["구역 드나듦 시작 방식에 구역이 비어 있습니다.", "현재 맵의 로케이션 구역", "시작 방식에서 대상 구역을 선택하세요.", "event-page-trigger-location"],
  "page.trigger.location-missing": ["시작 방식이 가리키는 구역이 삭제되었습니다.", "현재 프로젝트에 존재하는 로케이션 구역", "다른 구역을 고르거나 시작 방식을 바꾸세요.", "event-page-trigger-location"],
  "page.auto-parallel-ungated": ["자동/병렬 페이지에 종료·게이트 조건이 없습니다.", "반복을 멈출 조건 또는 셀프 스위치 전환", "페이지 조건을 걸거나 실행 뒤 다음 페이지로 넘기세요.", "event-classic-trigger"],
  "page.invisible-collision": ["보이지 않는 페이지가 캐릭터와 같은 높이에서 이동을 막습니다.", "투명/빈 그래픽 페이지의 의도된 충돌 설정", "지나가게 하려면 겹침 허용을 켜거나 높이를 아래로 바꾸세요.", "event-page-overlap-forbidden"],
  "page.shadowed": ["뒤쪽 페이지에 가려져 실행되지 않는 페이지입니다.", "뒤 페이지보다 좁지 않은 출현 조건 또는 페이지 순서 조정", "페이지 순서를 바꾸거나 뒤쪽 페이지에 조건을 추가하세요.", "evt-header-page-tabs"],
  "page.self-switch-unwritten": ["어디서도 켜지 않는 셀프 스위치가 조건으로 걸려 있습니다.", "같은 이벤트 안에서 해당 셀프 스위치를 켜는 명령", "이전 페이지에 셀프 스위치 켜기 명령을 추가하거나 조건을 수정하세요.", "evt-header-page-tabs"],
  "page.empty": ["실행 명령이 없는 빈 페이지입니다.", "명령 목록 또는 상태 표시용 빈 페이지", "동작이 필요하면 명령을 추가하고, 상태 표시용이면 그대로 두세요.", "event-command-empty-line"],
  "page.no-op": ["이 페이지의 명령은 실행 결과를 만들지 않습니다.", "실제 효과를 내는 이벤트 명령", "대사·상태 변경 등 실행 명령을 추가하세요.", "event-command-empty-line"],
  "condition.run.flag-empty": ["기억 이름이 비어 있습니다.", "비어 있지 않은 기억 이름", "검사할 기억 이름을 입력하세요.", "event-condition-run-flag"],
  "condition.insideLocation.empty": ["로케이션을 선택하지 않았습니다.", "현재 맵의 로케이션 구역", "조건에서 대상 로케이션을 선택하세요.", "event-condition-inside-location"],
  "condition.insideLocation.missing": ["조건이 가리키는 로케이션이 삭제되었습니다.", "현재 맵에 존재하는 로케이션 구역", "로케이션을 다시 지정하거나 조건을 삭제하세요.", "event-condition-inside-location"],
  "condition.insideLocation.other-map": ["조건이 다른 맵의 로케이션을 가리킵니다.", "현재 맵의 로케이션 구역", "런타임은 현재 맵만 보므로 현재 맵의 구역으로 바꾸세요.", "event-condition-inside-location"],
  "condition.all.empty": ["모두(AND) 조건에 하위 조건이 없습니다.", "한 개 이상의 하위 조건", "하위 조건을 추가하거나 빈 AND 조건을 제거하세요.", "event-condition-all-empty"],
  "condition.any.empty": ["하나(OR) 조건에 하위 조건이 없습니다.", "한 개 이상의 하위 조건", "하위 조건을 추가하거나 빈 OR 조건을 제거하세요.", "event-condition-any-empty"],
  "condition.gold.impossible": ["소지금 범위상 조건이 항상 참 또는 항상 거짓입니다.", "0 이상 최대 소지금 이하의 비교값", "비교 연산자와 금액을 현실적인 범위로 조정하세요.", "event-condition-gold-amount"],
  "condition.timer.always-true": ["타이머가 꺼져 있을 때도 조건이 참이 됩니다.", "타이머 시작 이후에만 참이 되는 비교 조건", "비교 기준을 조정하거나 스위치 조건을 함께 걸어 주세요.", "event-condition-timer-seconds"],
  "condition.timePhase.no-time-system": ["시간 시스템이 꺼져 있어 시간대 조건이 항상 거짓입니다.", "활성화된 시간 시스템", "프로젝트 시스템 설정에서 시간 시스템을 켜거나 조건을 제거하세요.", "event-condition-time-phase"],
  "condition.season.no-time-system": ["시간 시스템이 꺼져 있어 계절 조건이 항상 거짓입니다.", "활성화된 시간 시스템", "프로젝트 시스템 설정에서 시간 시스템을 켜거나 조건을 제거하세요.", "event-condition-season"],
  "condition.npcActivity.empty": ["NPC 활동 이름이 비어 있습니다.", "NPC 일정에 정의된 활동 이름", "비교할 활동 이름을 입력하세요.", "event-condition-npc-activity"],
  "condition.npcActivity.unknown": ["NPC 일정에 없는 활동 이름입니다.", "프로젝트 NPC 일정에 등록된 활동 이름", "「NPC와 일정」의 활동 이름과 똑같이 맞추세요.", "event-condition-npc-activity"],
  "condition.friendship.no-character-id": ["호감도 조건에 대상 NPC가 지정되지 않았습니다.", "인물 연결 또는 명시적 NPC 키", "「NPC와 일정」에서 인물을 연결하거나 NPC 키를 입력하세요.", "event-page-friendship-condition-npc-key"],
  "condition.relationship.no-character-id": ["관계 조건에 대상 NPC가 지정되지 않았습니다.", "인물 연결 또는 명시적 NPC 키", "「NPC와 일정」에서 인물을 연결하거나 NPC 키를 입력하세요.", "event-page-relationship-condition-npc-key"],
  "condition.eventSeesPlayer.watchers-empty": ["시선 조건에 일치하는 관찰자 이벤트가 이 맵에 없습니다.", "현재 맵의 이벤트와 일치하는 인물 키·이름·장소", "관찰자 조건을 현재 맵 이벤트에 맞게 수정하세요.", "event-condition-sees-watch-name"],
  "m2.coordinate.variable.unselected": ["좌표 소스가 변수이지만 변수를 고르지 않았습니다.", "좌표를 담을 변수 선택", "좌표 변수 선택기에서 변수를 고르세요.", "event-inspector-body"],
  "m2.coordinate.fixed.invalid": ["고정 좌표 값이 올바른 정수 칸 번호가 아닙니다.", "0 이상의 정수 타일 좌표", "좌표를 0 이상의 정수로 입력하세요.", "event-inspector-body"],
  "m2.required.empty": ["필수 설정 값이 비어 있습니다.", "비어 있지 않은 필수 입력값", "명령 설정 창에서 필수 항목을 선택하세요.", "event-inspector-body"],
  "callCommonEvent.cycle": ["공통 이벤트가 순환 호출됩니다.", "순환이 없는 호출 구조", "서로 다시 부르는 호출 고리를 끊어 주세요.", "event-command-call-common-event-select"],
  "callCommonEvent.recursionDepth": ["공통 이벤트 호출 깊이가 최대 한도를 넘었습니다.", "깊이 8 이하의 호출 체인", "중첩 호출 단계를 줄여 주세요.", "event-command-call-common-event-select"],
  "runtime.unclassified": ["명령의 실행 지원을 확인할 수 없습니다.", "지원되는 이벤트 명령", "명령을 지원되는 종류로 교체하세요.", "event-inspector-body"],
  "runtime.editor-only": ["에디터 전용 명령이라 실제 게임에서는 건너뜁니다.", "런타임에서 실행되는 이벤트 명령", "게임 동작이 필요하면 지원되는 명령으로 바꾸세요.", "event-inspector-body"],
  "runtime.partial": ["실제 게임에서 일부 효과만 실행되는 명령입니다.", "지원 범위 내의 명령 옵션", "미지원 옵션에 의존하지 않도록 테스트 플레이로 확인하세요.", "event-inspector-body"],
  "runtime.screenEffect.unsupported": ["선택한 화면 효과는 런타임 렌더러가 없습니다.", "페이드·플래시·색조·날씨 중 하나", "지원되는 화면 효과 종류로 변경하세요.", "event-inspector-body"],
  "callMapEvent.target-inert": ["맵 위 이벤트 부르기가 실행할 명령이 없는 대상을 가리킵니다.", "실행 명령이 있는 대상 이벤트", "대상 이벤트에 실행 명령을 추가하거나 호출 명령을 제거하세요.", "event-command-call-map-event-select"],
  "callMapEvent.transfer-target-missing": ["부를 대상 이벤트가 사라진 맵으로 이동하려 합니다.", "현재 프로젝트에 있는 맵으로 이동", "대상 이벤트의 맵 이동 목적지를 다시 선택하세요.", "event-command-call-map-event-select"],
  "callMapEvent.target-page-empty": ["이 이벤트를 부르는 맵 위 이벤트 부르기가 있는데 실행 명령이 없습니다.", "실행될 이벤트 명령", "이 이벤트에 실행 명령을 추가하거나 부르는 쪽의 호출 명령을 제거하세요.", "event-command-empty-line"],
};

// 화면에 나가는 낱말이다 — 영문 종류 이름(switch 등)을 그대로 보이지 않는다(2026-11-26 QA vm-qa15 #95).
const REFERENCE_LABELS: Readonly<Record<string, string>> = {
  actor: "주인공", animation: "애니메이션", class: "직업", "common-event": "다른 이벤트",
  difficulty: "난이도", ending: "엔딩", equipment: "장비", event: "이벤트",
  faction: "진영", gameOver: "게임 오버", item: "아이템", "life-skill": "생활 스킬",
  map: "맵", recipe: "제작법", resource: "리소스", schedule: "일정표",
  skill: "스킬", species: "몬스터 종", switch: "스위치", troop: "적 그룹",
  upgrade: "강화", variable: "변수",
};

export function eventDraftRuleGuidance(code: string) {
  const rule = RULES[code];
  if (rule) return { code, cause: rule[0], expected: rule[1], hint: rule[2], testId: rule[3], fallback: false as const };
  const reference = /^reference\.([a-zA-Z-]+)\.missing$/u.exec(code)?.[1];
  const refLabel = reference ? REFERENCE_LABELS[reference] : undefined;
  if (refLabel) return {
    code, cause: `필수 ${refLabel} 참조가 비어 있거나 삭제되었습니다.`, expected: `프로젝트에 있는 ${refLabel}`,
    hint: `누르면 열리는 창에서 ${refLabel} 하나를 다시 고르세요.`, testId: "event-inspector-body", fallback: false as const,
  };
  // Unknown/advisory rules never echo arbitrary input into a handoff.
  return { code: "validation.advisory", cause: "이벤트 설정을 검토해야 합니다.", expected: "의도한 실행 조건과 지원 명령",
    hint: "편집기의 해당 검토 항목을 확인하세요.", testId: "event-inspector-body", fallback: true as const };
}

export function withEventDraftIssueDetails(issue: EventDraftIssue) {
  const guidance = eventDraftRuleGuidance(issue.code);
  const omitGenericAdvisory = guidance.fallback && issue.severity !== "error";
  return {
    ...issue,
    cause: issue.cause ?? issue.message,
    ...(omitGenericAdvisory ? {} : { expected: issue.expected ?? guidance.expected, hint: issue.hint ?? guidance.hint }),
    field: issue.field ?? { testId: guidance.testId },
  };
}

/** Existing command form anchors; reference checks must identify the operand, not just the command. */
export function commandReferenceField(kind: string, label: string): { readonly testId: string } {
  const key = `${kind}:${label}`;
  const fields: Readonly<Record<string, string>> = {
    "gameOver:게임 오버": "event-command-game-over-id", "killPlayer:게임 오버": "event-command-game-over-id",
    "setSwitch:스위치": "event-command-switch-target", "setSwitch:스위치 값 변수": "event-command-switch-operand",
    "setVariable:변수": "event-command-variable-target", "setVariable:변수 피연산자": "event-command-variable-operand",
    "wait:대기 변수": "event-wait-variable", "inputWait:입력 대기 변수": "event-command-input-wait-variable",
    "inputNumber:숫자 입력 변수": "input-number-variable", "changeFace:얼굴 리소스": "event-command-face-resource-set",
    "transfer:맵": "transfer-player-map-tree", "changeTile:맵": "change-tile-map-select",
    "moveEvent:이동 대상 이벤트": "move-route-event-id-input",
    "setEventGraphicPattern:외형 변경 이벤트": "set-event-graphic-pattern-event-input",
    "callCommonEvent:다른 이벤트": "event-command-call-common-event-select",
    "callMapEvent:맵 위 이벤트": "event-command-call-map-event-select",
    "planSchedule:일정표": "plan-schedule-schedule-id-picker", "runSchedule:일정표": "run-schedule-schedule-id-picker",
    "battleProcessing:적 그룹": "battle-processing-troop-select", "battleProcessing:적 그룹 변수": "battle-processing-troop-variable",
    "learnSkill:배우": "learn-skill-actor-select", "learnSkill:스킬": "learn-skill-browser",
    "changeLevel:배우": "change-level-actor-select", "changeActorHp:배우": "change-actor-hp-actor-select",
    "changeActorMp:배우": "change-actor-mp-actor-select", "changeExp:배우": "change-exp-actor-select",
    "changeExp:경험치 변수": "change-exp-amount-input",
    "changeLifeSkillExp:생활 스킬": "change-life-skill-exp-skill-id-input",
    "changeLifeSkillExp:생활 스킬 경험치 변수": "change-life-skill-exp-amount-select",
    "changeParty:배우": "change-party-actor-select", "promoteActor:배우": "promote-actor-select",
    "promoteActor:전직 직업": "promote-class-select", "changeEquipment:배우": "change-equipment-actor-select",
    "changeEquipment:장비": "change-equipment-browser", "recoverAll:배우": "recover-all-actor-select",
    "enterHeroName:배우": "enter-hero-name-actor-select", "changeItem:아이템": "change-item-item-id-picker",
    "changeItem:아이템 수량 변수": "change-item-amount-select", "changeGold:골드 변수": "change-gold-amount-select",
    "craftRecipe:제작법": "craft-recipe-select", "applyItemUpgrade:업그레이드": "apply-item-upgrade-select",
    "equipTool:도구 아이템": "equip-tool-item-select", "getFriendship:호감도 저장 변수": "event-variable-picker-open",
    "giveMonster:몬스터 종": "give-monster-species-select", "evolveMonster:진화 대상 종": "evolve-monster-species-select",
    "addFollower:동료 배우": "event-command-add-follower-actor-id", "addFollower:동료 그래픽": "event-command-add-follower-graphic-id",
    "showAnimation:전투 애니메이션": "show-animation-animationId-select", "showAnimation:애니메이션 대상 이벤트": "show-animation-event-id-input",
    "showEmote:이모트 대상 이벤트": "show-emote-event-id-input", "addLight:빛 위치 이벤트": "add-light-event-id-input",
    "showPicture:그림 리소스": "show-picture-resource-picker", "playAudio:오디오 리소스": "play-audio-resource-picker",
    "playMovie:동영상 리소스": "play-movie-resource-select", "triggerEnding:엔딩": "event-command-trigger-ending-id",
    "spawnFieldEnemy:필드 적 그룹": "event-command-spawn-troop",
    "spawnFieldEnemy:필드 적 처치 스위치": "event-command-spawn-switch",
    "spawnFieldEnemy:필드 적 그래픽": "event-command-spawn-graphic",
    "shop:상점 아이템": "shop-add-goods", "shop:상점 재고 아이템": "shop-add-goods",
  };
  return { testId: fields[key] ?? "event-inspector-body" };
}

/** Specialized M2 forms keep their historical anchors; generic forms use semantic pickers. */
export function m2ReferenceField(title: string, key: string): { readonly testId: string } {
  const specialized: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    "Get Player Location": { variableId: "get-player-location-variable" },
    "Move to Variable Location": { mapVariableId: "move-to-variable-location-map-variable", xVariableId: "move-to-variable-location-x-variable", yVariableId: "move-to-variable-location-y-variable" },
    "Set Vehicle Location": { mapId: "set-vehicle-location-map-select", x: "set-vehicle-location-x-input", y: "set-vehicle-location-y-input" },
    "Set Event Location": { mapId: "set-event-location-map-select", eventId: "set-event-location-event-select", x: "set-event-location-x-input", y: "set-event-location-y-input" },
    "Swap Event Location": { eventA: "swap-event-location-event-a", eventB: "swap-event-location-event-b" },
    "Get Terrain ID": { variableId: "get-terrain-id-variable", x: "get-terrain-id-x-input", y: "get-terrain-id-y-input" },
    "Get Event ID": { variableId: "get-event-id-variable", x: "get-event-id-x-input", y: "get-event-id-y-input" },
    "Show Animation": { animationId: "show-animation-m2-animation-select", eventId: "show-animation-m2-event-select" },
    "Change Parallax Back": { resourceId: "change-parallax-back-resource-picker" },
    "Change Tile": { mapId: "change-tile-m2-map-select", x: "change-tile-m2-x-input", y: "change-tile-m2-y-input" },
  };
  const specific = specialized[title]?.[key];
  if (specific) return { testId: specific };
  if (key === "resourceId") return { testId: "m2-command-resourceId-picker" };
  if (["actorId", "animationId", "eventId", "itemId", "mapId", "skillId", "switchId", "troopId", "variableId"].includes(key))
    return { testId: `m2-command-${key}-record-select` };
  return { testId: `m2-command-${key}-input` };
}
