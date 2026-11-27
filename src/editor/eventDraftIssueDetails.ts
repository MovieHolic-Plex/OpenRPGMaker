import type { EventDraftIssue } from "./eventDraftValidator";

/** Rule-owned text only: safe to export without copying authored names or values. */
const RULES: Readonly<Record<string, readonly [string, string, string, string]>> = {
  "event.missing": ["이 이벤트를 찾을 수 없어요.", "현재 맵에 있는 이벤트", "맵에서 이벤트를 다시 눌러 열어 주세요.", "event-editor-name"],
  "page.missing": ["이벤트에 페이지가 하나도 없어요.", "한 개 이상의 페이지", "위쪽에서 페이지를 하나 추가해 주세요.", "evt-page-add"],
  "event.position.out-of-bounds": ["이벤트가 맵 바깥에 놓여 있어요.", "맵 안의 위치", "이벤트를 맵 안쪽으로 옮겨 주세요.", "event-editor-coords"],
  "map.position.out-of-bounds": ["이동할 위치가 맵 바깥이에요.", "맵 안의 위치", "목적지 맵과 X, Y 위치를 다시 확인해 주세요.", "event-inspector-body"],
  "map.area.out-of-bounds": ["지정한 범위가 맵 바깥으로 삐져나갔어요.", "맵 안의 범위", "범위의 위치나 크기를 맵 안쪽으로 줄여 주세요.", "event-inspector-body"],
  "label.empty": ["라벨 이름이 비어 있어요.", "라벨 이름", "찾아갈 수 있게 라벨 이름을 적어 주세요.", "event-command-label-name"],
  "label.duplicate": ["똑같은 라벨 이름이 여러 개 있어요.", "겹치지 않는 라벨 이름", "라벨 이름을 다르게 바꾸고 이동 대상도 맞춰 주세요.", "event-command-label-name"],
  "label.target-missing": ["이동할 라벨을 찾을 수 없어요.", "같은 페이지에 있는 라벨", "실제로 만들어 둔 라벨 이름으로 맞춰 주세요.", "event-command-goto-label-name"],
  "loop.break-outside-loop": ["'반복 끝내기'가 반복 바깥에 놓여 있어요.", "반복 안의 끝내기 명령", "반복 안쪽으로 옮기거나 필요 없으면 지워 주세요.", "break-loop-editor"],
  "loop.empty-body": ["반복 안이 비어 있어요.", "반복 안에서 할 일", "반복할 내용을 넣거나 빈 반복을 지워 주세요.", "event-inspector-body"],
  "loop.no-break": ["반복이 끝나는 곳이 없어 게임이 멈출 수 있어요.", "반복을 멈추는 명령", "반복 안에 '반복 끝내기'를 넣어 주세요.", "event-inspector-body"],
  "variable.divide-by-zero": ["0으로 나누면 계산이 되지 않고 그대로 넘어가요.", "0이 아닌 값", "나누는 숫자를 0이 아닌 값으로 바꿔 주세요.", "event-command-variable-operand"],
  "shop.items.empty": ["상점에 팔 물건이 하나도 없어요.", "한 개 이상의 상품", "상점에 팔 아이템을 하나 이상 추가해 주세요.", "shop-add-goods"],
  "shop.stock.orphan": ["재고에 적힌 아이템이 판매 목록에 없어요.", "판매 목록에 있는 아이템", "그 아이템을 판매 목록에 넣거나 재고에서 빼 주세요.", "shop-add-goods"],
  "battle.troop.empty": ["선택한 적 그룹에 몬스터가 한 마리도 없어요.", "적이 들어 있는 적 그룹", "적 그룹에 몬스터를 넣거나 다른 적 그룹을 골라 주세요.", "battle-processing-troop-select"],
  "changeParty.action.invalid": ["파티에 넣기/빼기 동작이 비어 있거나 잘못됐어요.", "합류·이탈·선두 중 하나", "파티 동작을 다시 골라 주세요.", "change-party-action-select"],
  "openCraftShop.empty": ["제작 공방에서 만들 수 있는 제작법이 비어 있어요.", "한 개 이상의 제작법", "제작법을 고르거나 '모든 제작법'을 켜 주세요.", "craft-shop-all-recipes"],
  "page.trigger.location-empty": ["'구역에 드나들면'으로 해 두었지만 구역을 안 골랐어요.", "현재 맵의 구역", "어느 구역에 들어갈 때 실행할지 골라 주세요.", "event-page-trigger-location"],
  "page.trigger.location-missing": ["골라 둔 구역이 삭제됐어요.", "현재 맵에 있는 구역", "다른 구역을 고르거나 시작 방식을 바꿔 주세요.", "event-page-trigger-location"],
  "page.auto-parallel-ungated": ["이 이벤트가 멈추지 않고 계속 반복돼요.", "반복을 멈출 조건 또는 다음 페이지 전환", "한 번만 실행되게 조건을 걸거나, 끝날 때 다음 페이지로 넘겨 주세요.", "event-classic-trigger"],
  "page.invisible-collision": ["투명한 이벤트가 투명 벽처럼 길을 막고 있어요.", "지나갈 수 있는 투명 이벤트", "플레이어가 지나가게 하려면 '지나갈 수 있음'을 켜거나 캐릭터 아래로 놓아 주세요.", "event-page-overlap-forbidden"],
  "page.shadowed": ["뒤쪽 페이지에 가려져 이 페이지는 열리지 않아요.", "뒤쪽 페이지에 조건 추가 또는 순서 조정", "뒤쪽 페이지에 조건을 붙이거나 페이지 순서를 바꿔 주세요.", "evt-header-page-tabs"],
  "page.self-switch-unwritten": ["이 페이지를 켜는 스위치를 아직 어디에서도 켜지 않았어요.", "같은 이벤트 안에서 스위치를 켜는 명령", "앞 페이지에서 그 스위치를 켜 주거나, 이 페이지의 조건을 바꿔 주세요.", "evt-header-page-tabs"],
  "page.empty": ["이 페이지는 아직 비어 있어요.", "실행할 내용", "할 일을 추가하거나, 모습을 바꾸는 용도라면 그대로 두셔도 돼요.", "event-command-empty-line"],
  "page.no-op": ["이 페이지는 실행돼도 아무 일이 일어나지 않아요.", "실제로 동작하는 명령", "대사나 아이템 주기 같은 동작을 넣어 주세요.", "event-command-empty-line"],
  "condition.run.flag-empty": ["확인할 기억 이름이 비어 있어요.", "기억 이름", "확인할 기억 이름을 적어 주세요.", "event-condition-run-flag"],
  "condition.insideLocation.empty": ["어느 구역인지 고르지 않았어요.", "현재 맵의 구역", "조건에서 구역을 하나 골라 주세요.", "event-condition-inside-location"],
  "condition.insideLocation.missing": ["조건에 걸린 구역이 삭제됐어요.", "현재 맵에 있는 구역", "다른 구역을 고르거나 이 조건을 지워 주세요.", "event-condition-inside-location"],
  "condition.insideLocation.other-map": ["조건이 다른 맵의 구역을 가리키고 있어요.", "현재 맵의 구역", "지금 맵 안에 있는 구역으로 바꿔 주세요.", "event-condition-inside-location"],
  "condition.all.empty": ["'모두 맞을 때' 조건 안이 비어 있어요.", "한 개 이상의 조건", "안에 조건을 넣거나 빈 묶음을 지워 주세요.", "event-condition-all-empty"],
  "condition.any.empty": ["'하나라도 맞을 때' 조건 안이 비어 있어요.", "한 개 이상의 조건", "안에 조건을 넣거나 빈 묶음을 지워 주세요.", "event-condition-any-empty"],
  "condition.gold.impossible": ["소지금 조건이 숫자가 맞지 않아 뜻대로 안 켜져요.", "0 이상의 현실적인 소지금 범위", "비교 기호와 금액을 다시 확인해 주세요.", "event-condition-gold-amount"],
  "condition.timer.always-true": ["타이머가 꺼져 있을 때도 이 조건이 켜질 수 있어요.", "타이머가 켜진 뒤에만 맞는 조건", "시간 기준을 바꾸거나 스위치 조건을 같이 걸어 주세요.", "event-condition-timer-seconds"],
  "condition.timePhase.no-time-system": ["시간 기능이 꺼져 있어 시간대 조건이 켜지지 않아요.", "켜져 있는 시간 기능", "프로젝트 설정에서 시간 기능을 켜거나 이 조건을 빼 주세요.", "event-condition-time-phase"],
  "condition.season.no-time-system": ["시간 기능이 꺼져 있어 계절 조건이 켜지지 않아요.", "켜져 있는 시간 기능", "프로젝트 설정에서 시간 기능을 켜거나 이 조건을 빼 주세요.", "event-condition-season"],
  "condition.npcActivity.empty": ["NPC 활동 이름이 비어 있어요.", "NPC 활동 이름", "확인할 활동 이름을 적어 주세요.", "event-condition-npc-activity"],
  "condition.npcActivity.unknown": ["NPC 일정에 없는 활동 이름이에요.", "NPC 일정에 등록된 활동 이름", "「NPC와 일정」에 적힌 활동 이름과 똑같이 맞춰 주세요.", "event-condition-npc-activity"],
  "condition.friendship.no-character-id": ["누구와의 호감도를 볼지 정해지지 않았어요.", "대상 NPC 연결", "「NPC와 일정」에서 인물을 연결하거나 대상 이름을 적어 주세요.", "event-page-friendship-condition-npc-key"],
  "condition.relationship.no-character-id": ["누구와의 관계를 볼지 정해지지 않았어요.", "대상 NPC 연결", "「NPC와 일정」에서 인물을 연결하거나 대상 이름을 적어 주세요.", "event-page-relationship-condition-npc-key"],
  "condition.eventSeesPlayer.watchers-empty": ["플레이어를 지켜볼 이벤트가 이 맵에 없어요.", "현재 맵에 있는 관찰자 이벤트", "지켜볼 대상 조건을 현재 맵 이벤트에 맞게 바꿔 주세요.", "event-condition-sees-watch-name"],
  "m2.coordinate.variable.unselected": ["위치를 변수로 가져오기로 했는데 변수를 안 골랐어요.", "위치를 담을 변수", "어느 변수를 쓸지 골라 주세요.", "event-inspector-body"],
  "m2.coordinate.fixed.invalid": ["위치 숫자가 올바른 칸 번호가 아니에요.", "0 이상의 숫자", "0 이상의 정수로 위치를 적어 주세요.", "event-inspector-body"],
  "m2.required.empty": ["꼭 채워야 하는 칸이 비어 있어요.", "비어 있지 않은 설정값", "열리는 창에서 빈 항목을 채워 주세요.", "event-inspector-body"],
  "callCommonEvent.cycle": ["공통 이벤트가 서로를 끝없이 다시 불러 게임이 멈출 수 있어요.", "서로 다시 부르지 않는 구조", "다시 부르는 고리를 하나 끊어 주세요.", "event-command-call-common-event-select"],
  "callCommonEvent.recursionDepth": ["공통 이벤트가 너무 여러 겹으로 겹쳐 불리고 있어요.", "8단계 이하의 호출", "겹쳐 부르는 단계를 조금 줄여 주세요.", "event-command-call-common-event-select"],
  "runtime.unclassified": ["이 명령은 아직 게임에서 실행할 수 없어요.", "게임에서 지원하는 명령", "다른 명령으로 바꿔 주세요.", "event-inspector-body"],
  "runtime.editor-only": ["메모·편집기용 명령이라 실제 게임에서는 지나가요.", "게임에서 실행되는 명령", "게임에서 동작하게 하려면 다른 명령으로 바꿔 주세요.", "event-inspector-body"],
  "runtime.partial": ["이 명령은 일부 옵션만 게임에 반영돼요.", "지원되는 명령 옵션", "테스트 실행으로 원하는 대로 움직이는지 확인해 보세요.", "event-inspector-body"],
  "runtime.screenEffect.unsupported": ["이 화면 효과는 아직 게임에서 나오지 않아요.", "페이드·플래시·색조·날씨 중 하나", "페이드·플래시·색조·날씨 중에서 골라 주세요.", "event-inspector-body"],
  "callMapEvent.target-inert": ["부르려는 이벤트가 비어 있어서 아무 일도 안 일어나요.", "내용이 들어 있는 이벤트", "그 이벤트에 할 일을 넣거나 부르기 명령을 지워 주세요.", "event-command-call-map-event-select"],
  "callMapEvent.transfer-target-missing": ["부르려는 이벤트가 사라진 맵으로 이동하게 되어 있어요.", "존재하는 맵으로 이동", "그 이벤트의 이동 목적지 맵을 다시 골라 주세요.", "event-command-call-map-event-select"],
  "callMapEvent.target-page-empty": ["다른 이벤트가 이 이벤트를 부르는데, 안에 할 일이 비어 있어요.", "실행할 내용", "여기에 할 일을 넣거나, 부르는 쪽의 명령을 지워 주세요.", "event-command-empty-line"],
};

// 화면에 나가는 낱말이다 — 영문 종류 이름(switch 등)을 그대로 보이지 않는다(2026-11-26 QA vm-qa15 #95).
const REFERENCE_LABELS: Readonly<Record<string, string>> = {
  actor: "주인공", animation: "애니메이션", class: "직업", "common-event": "다른 이벤트",
  difficulty: "난이도", ending: "엔딩", equipment: "장비", event: "이벤트",
  faction: "진영", gameOver: "게임 오버", item: "아이템", "life-skill": "생활 스킬",
  map: "맵", recipe: "제작법", resource: "그림·소리", schedule: "일정표",
  skill: "스킬", species: "몬스터 종", switch: "스위치", troop: "적 그룹",
  upgrade: "강화", variable: "변수",
};

export function eventDraftRuleGuidance(code: string) {
  const rule = RULES[code];
  if (rule) return { code, cause: rule[0], expected: rule[1], hint: rule[2], testId: rule[3], fallback: false as const };
  const reference = /^reference\.([a-zA-Z-]+)\.missing$/u.exec(code)?.[1];
  const refLabel = reference ? REFERENCE_LABELS[reference] : undefined;
  if (refLabel) return {
    code, cause: `고른 ${refLabel} 항목이 비어 있거나 삭제됐어요.`, expected: `프로젝트에 있는 ${refLabel}`,
    hint: `누르면 열리는 창에서 ${refLabel} 하나를 다시 골라 주세요.`, testId: "event-inspector-body", fallback: false as const,
  };
  // Unknown/advisory rules never echo arbitrary input into a handoff.
  return { code: "validation.advisory", cause: "이 설정이 의도한 대로 맞는지 확인해 보세요.", expected: "의도한 설정",
    hint: "누르면 해당 자리로 바로 이동해요.", testId: "event-inspector-body", fallback: true as const };
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
