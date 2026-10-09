import type { EventDraftIssue } from "./eventDraftValidator";

/** Rule-owned text only: safe to export without copying authored names or values. */
const RULES: Readonly<Record<string, readonly [string, string, string, string]>> = {
  "event.missing": ["이벤트를 찾을 수 없습니다.", "현재 맵에 있는 이벤트", "이벤트를 다시 선택해 편집기를 여세요.", "event-editor-name"],
  "page.missing": ["이벤트 페이지가 없습니다.", "한 개 이상의 페이지", "페이지를 추가하세요.", "event-page-tab-add"],
  "event.position.out-of-bounds": ["이벤트 위치가 맵 밖입니다.", "맵 안의 타일 좌표", "맵에서 이벤트를 유효한 타일로 옮기세요.", "event-editor-coords"],
  "map.position.out-of-bounds": ["목적지 좌표가 맵 범위를 벗어났습니다.", "맵 안의 정수 X, Y 좌표", "목적지 맵과 X, Y를 확인하세요.", "event-inspector-body"],
  "map.area.out-of-bounds": ["생성 영역이 맵 범위를 벗어났습니다.", "맵 안의 양수 너비·높이 영역", "영역의 위치와 크기를 맵 안으로 줄이세요.", "event-inspector-body"],
  "label.empty": ["라벨 이름이 비어 있습니다.", "비어 있지 않은 라벨 이름", "이 실행 범위에서 고유한 이름을 입력하세요.", "event-command-label-name"],
  "label.duplicate": ["같은 실행 범위에 같은 라벨이 있습니다.", "실행 범위마다 고유한 라벨 이름", "중복 라벨을 바꾸고 이동 대상도 맞추세요.", "event-command-label-name"],
  "label.target-missing": ["이동할 라벨이 현재 실행 범위에 없습니다.", "현재 또는 바깥 실행 범위의 라벨", "이동 대상을 기존 라벨 이름과 맞추세요.", "event-command-goto-label-name"],
  "loop.break-outside-loop": ["반복 밖에 반복 탈출 명령이 있습니다.", "반복 본문 안의 탈출 명령", "이 명령을 반복 안으로 옮기거나 제거하세요.", "break-loop-editor"],
  "shop.items.empty": ["상점에 판매할 상품이 없습니다.", "한 개 이상의 판매 상품", "상품 추가에서 판매할 상품을 선택하세요.", "shop-add-goods"],
  "condition.run.flag-empty": ["기억 이름이 비어 있습니다.", "비어 있지 않은 기억 이름", "검사할 기억 이름을 입력하세요.", "event-condition-run-flag"],
  "runtime.unclassified": ["명령의 실행 지원을 확인할 수 없습니다.", "지원되는 이벤트 명령", "명령을 지원되는 종류로 교체하세요.", "event-inspector-body"],
  "callMapEvent.target-inert": ["맵 위 이벤트 부르기가 아무 것도 하지 않는 것입니다.", "소리·전이 등 실행될 명령이 있는 대상 이벤트", "대상 문 본체에 열기 명령을 다시 입력하세요.", "event-command-call-map-event-select"],
  "callMapEvent.transfer-target-missing": ["부를 대상 이벤트가 사라진 맵으로 이동하려 합니다.", "현재 프로젝트에 있는 맵으로 이동", "대상 이벤트의 맵 이동 목적지를 다시 선택하세요.", "event-command-call-map-event-select"],
  "callMapEvent.target-page-empty": ["이 이벤트를 부르는 맵 위 이벤트 부르기가 있는데 실행 명령이 없습니다.", "소리·전이 등 실행될 명령", "문 본체에 열기 명령을 다시 입력하거나 부르는 명령을 제거하세요.", "event-page-tab-add"],
};

const REFERENCE_TYPES = new Set(["actor", "animation", "class", "common-event", "ending", "equipment", "event",
  "faction", "item", "life-skill", "map", "recipe", "resource", "skill", "species", "switch", "troop", "upgrade", "variable"]);

export function eventDraftRuleGuidance(code: string) {
  const rule = RULES[code];
  if (rule) return { code, cause: rule[0], expected: rule[1], hint: rule[2], testId: rule[3] };
  const reference = /^reference\.([a-z-]+)\.missing$/u.exec(code)?.[1];
  if (reference && REFERENCE_TYPES.has(reference)) return {
    code, cause: "필수 참조가 비어 있거나 대상이 삭제되었습니다.", expected: `현재 프로젝트에 있는 ${reference} 참조`,
    hint: "해당 선택기에서 존재하는 대상을 다시 선택하세요.", testId: "event-inspector-body",
  };
  // Unknown/advisory rules never echo arbitrary input into a handoff.
  return { code: "validation.advisory", cause: "이벤트 설정을 검토해야 합니다.", expected: "의도한 실행 조건과 지원 명령",
    hint: "편집기의 해당 검토 항목을 확인하세요.", testId: "event-inspector-body" };
}

export function withEventDraftIssueDetails(issue: EventDraftIssue) {
  const guidance = eventDraftRuleGuidance(issue.code);
  return { ...issue, cause: issue.message, expected: guidance.expected, hint: guidance.hint,
    field: issue.field ?? { testId: guidance.testId } };
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
