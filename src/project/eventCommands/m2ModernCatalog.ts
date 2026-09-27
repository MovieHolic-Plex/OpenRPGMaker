import type { M2CommandFieldOption, M2CommandFieldSpec } from "./m2Catalog";

const CAMERA_MODE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "panTo", label: "좌표로 이동" },
  { value: "follow", label: "대상 추적" },
  { value: "zoom", label: "줌 변경" },
  { value: "lock", label: "고정" },
  // 런타임(cameraControlMode)은 처음부터 return 을 알았지만 선택지에 없어 카탈로그 검증이 컷신의 camera return 을
  // 전부 거부했다 — script_cutscene 은 되돌림 없는 컷신만 저장돼 카메라가 화면에 고정된 채 남았다(2026-09-24).
  { value: "return", label: "주인공에게 돌아가기" },
];

const MODERN_TARGET_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "player", label: "주인공" },
  { value: "this-event", label: "이 이벤트" },
  { value: "screen", label: "화면" },
];

// 노출: "고를 수 있는 옵션은 전부 렌더 경로가 있다" 를 테스트가 대조한다.
export const SCREEN_EFFECT_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "fadeIn", label: "페이드 인" },
  { value: "fadeOut", label: "페이드 아웃" },
  { value: "flash", label: "플래시" },
  { value: "tint", label: "색조" },
  // blur 는 렌더러가 없다. 고를 수 있게 두면 감독이 넣고 아무 일도 안 일어나는
  // 조용한 실패가 난다 — 목록에서 내린다. 기존 프로젝트에 남아 있는 값은
  // planScreenEffect 가 unsupported 로 돌려 fallbacks 에 기록된다.
  { value: "weather", label: "날씨" },
];

// OPRN-OUT-013: 좌표 목적지 이동. 저장 형태·기본값의 정본 주석은
// `src/project/eventCommands/coordinateDestination.ts` 머리말에 있다.
export const COORDINATE_TARGET_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "player", label: "주인공" },
  { value: "this-event", label: "이 이벤트" },
  { value: "event", label: "특정 이벤트" },
];

export const COORDINATE_SOURCE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "fixed", label: "숫자" },
  { value: "variable", label: "변수" },
];

export const COORDINATE_FAILURE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "continue", label: "계속 진행" },
  { value: "stop", label: "이벤트 중단" },
];

export const COORDINATE_FALLBACK_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "none", label: "없음" },
  { value: "nearest", label: "가장 가까운 통행 가능 칸" },
];

const WAIT_CONDITION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "switchOn", label: "스위치 켜짐" },
  { value: "switchOff", label: "스위치 꺼짐" },
  { value: "variable", label: "변수 조건" },
  { value: "region", label: "지역 진입" },
  { value: "eventIdle", label: "이벤트 이동 완료" },
];

const REGION_ACTION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "enter", label: "진입" },
  { value: "exit", label: "이탈" },
  { value: "stay", label: "체류" },
];

const QUEST_STATE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "start", label: "시작" },
  { value: "update", label: "갱신" },
  { value: "complete", label: "완료" },
  { value: "fail", label: "실패" },
];

const EMOTION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "neutral", label: "기본" },
  { value: "happy", label: "기쁨" },
  { value: "sad", label: "슬픔" },
  { value: "angry", label: "분노" },
  { value: "surprised", label: "놀람" },
];

const SOUND_CHANNEL_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "bgm", label: "BGM" },
  { value: "bgs", label: "BGS" },
  { value: "me", label: "ME" },
  { value: "se", label: "SE" },
  { value: "ambient", label: "앰비언트" },
];

const CUTSCENE_ACTION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "lockPlayer", label: "조작 잠금" },
  { value: "hideHud", label: "HUD 숨김" },
  { value: "skipPoint", label: "스킵 지점" },
];

const UI_SURFACE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "toast", label: "토스트" },
  { value: "hud", label: "HUD" },
  { value: "banner", label: "배너" },
  { value: "menuPrompt", label: "메뉴 프롬프트" },
];

const DEBUG_LEVEL_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "info", label: "정보" },
  { value: "warn", label: "경고" },
  { value: "error", label: "오류" },
];

const DATA_QUERY_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "gold", label: "소지금" },
  { value: "itemCount", label: "아이템 수" },
  { value: "playerX", label: "주인공 X" },
  { value: "playerY", label: "주인공 Y" },
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  // 명작 공백 G1: 액터·파티·진행 조회. target = 배우 id 또는 "leader"(선두).
  { value: "actorLevel", label: "배우 레벨" },
  { value: "actorHp", label: "배우 HP" },
  { value: "actorMp", label: "배우 MP" },
  { value: "actorMaxHp", label: "배우 최대 HP" },
  { value: "actorHpPercent", label: "배우 HP(%)" },
  { value: "actorHasState", label: "배우 상태 보유(target=배우:상태)" },
  { value: "partyLeaderIndex", label: "선두 배우 번호(DB 순서, 0=없음)" },
  { value: "partySize", label: "파티 인원" },
  { value: "playerFacing", label: "주인공 방향(2·4·6·8)" },
  { value: "playtimeSeconds", label: "플레이 시간(초)" },
  { value: "steps", label: "걸음 수" },
  { value: "clearCount", label: "클리어 횟수" },
  { value: "weekday", label: "요일(0=일…6=토)" },
  { value: "stringLength", label: "문자열 변수 길이" },
];

const QTE_MODE_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "sequence", label: "순서대로 누르기" },
  { value: "mash", label: "연타(횟수 세기)" },
];

const HIGH_SCORE_ACTION_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "submit", label: "점수 제출(더 높으면 갱신)" },
  { value: "submitLow", label: "점수 제출(더 낮으면 갱신 — 시간 기록)" },
  { value: "read", label: "최고 점수 읽기" },
  { value: "reset", label: "지우기" },
];

export const SCREEN_COLOR_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "white", label: "흰색" },
  { value: "red", label: "빨강" },
  { value: "green", label: "초록" },
  { value: "blue", label: "파랑" },
  { value: "yellow", label: "노랑" },
  { value: "purple", label: "보라" },
  { value: "black", label: "검정" },
];

const SHAKE_INTENSITY_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "1", label: "약하게" },
  { value: "3", label: "보통" },
  { value: "6", label: "강하게" },
  { value: "10", label: "매우 강하게" },
];

export function modernFieldsFor(title: string): readonly M2CommandFieldSpec[] | undefined {
  switch (title) {
    case "Camera Control":
      return [
        { key: "mode", label: "동작", type: "select", defaultValue: "panTo", options: CAMERA_MODE_OPTIONS },
        { key: "target", label: "누구에게", type: "select", defaultValue: "player", options: MODERN_TARGET_OPTIONS },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
        { key: "zoom", label: "줌", type: "number", defaultValue: 1, min: 0.25, max: 6, step: 0.25 },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 300 },
      ];
    case "Screen Effect":
      return [
        { key: "effect", label: "효과", type: "select", defaultValue: "fadeIn", options: SCREEN_EFFECT_OPTIONS },
        { key: "value", label: "값", type: "text", defaultValue: "" },
        // 런타임 clampMs(commandCatalog.ts) 가 50~5000ms 로 자른다 — 폼도 같은 범위를 말해야 한다.
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 300, min: 50, max: 5000, step: 100 },
      ];
    case "Spawn Event":
      return [
        { key: "prefabId", label: "프리팹 ID", type: "text", defaultValue: "" },
        { key: "eventId", label: "이벤트 ID", type: "text", defaultValue: "" },
        { key: "mapId", label: "맵", type: "text", defaultValue: "" },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
      ];
    case "Remove Event":
      return [{ key: "eventId", label: "이벤트", type: "text", defaultValue: "" }];
    case "Pathfind Move":
      // 키를 늘리기만 한다. 옛 저장본에는 새 키가 없고, 없으면 defaultValue
      // (fixed/continue/none)로 읽혀 예전 고정 좌표 동작과 완전히 같다.
      return [
        { key: "target", label: "누구에게", type: "text", defaultValue: "this-event" },
        { key: "xSource", label: "X 값은", type: "select", defaultValue: "fixed", options: COORDINATE_SOURCE_OPTIONS },
        { key: "x", label: "X", type: "number", defaultValue: 0 },
        { key: "xVariableId", label: "X 변수", type: "text", defaultValue: "" },
        { key: "ySource", label: "Y 값은", type: "select", defaultValue: "fixed", options: COORDINATE_SOURCE_OPTIONS },
        { key: "y", label: "Y", type: "number", defaultValue: 0 },
        { key: "yVariableId", label: "Y 변수", type: "text", defaultValue: "" },
        { key: "speed", label: "속도", type: "number", defaultValue: 4 },
        { key: "wait", label: "완료까지 대기", type: "boolean", defaultValue: true },
        { key: "onFailure", label: "실패하면", type: "select", defaultValue: "continue", options: COORDINATE_FAILURE_OPTIONS },
        { key: "fallback", label: "대체 목적지", type: "select", defaultValue: "none", options: COORDINATE_FALLBACK_OPTIONS },
        { key: "resultVariableId", label: "결과 변수", type: "text", defaultValue: "" },
        { key: "resultSwitchId", label: "도착 스위치", type: "text", defaultValue: "" },
      ];
    case "Wait Until":
      return [
        { key: "condition", label: "조건", type: "select", defaultValue: "switchOn", options: WAIT_CONDITION_OPTIONS },
        { key: "target", label: "누구에게", type: "text", defaultValue: "" },
        { key: "value", label: "값", type: "text", defaultValue: "" },
        { key: "timeoutMs", label: "최대 대기(ms)", type: "number", defaultValue: 0 },
      ];
    case "Region Trigger":
      return [
        { key: "regionId", label: "지역 ID", type: "text", defaultValue: "" },
        { key: "eventId", label: "이벤트", type: "text", defaultValue: "" },
        { key: "action", label: "동작", type: "select", defaultValue: "enter", options: REGION_ACTION_OPTIONS },
        { key: "switchId", label: "스위치", type: "text", defaultValue: "" },
      ];
    case "Quest Objective":
      return [
        { key: "questId", label: "퀘스트 ID", type: "text", defaultValue: "" },
        { key: "objectiveId", label: "목표 ID", type: "text", defaultValue: "" },
        { key: "state", label: "상태", type: "select", defaultValue: "start", options: QUEST_STATE_OPTIONS },
        { key: "text", label: "내용", type: "textarea", defaultValue: "" },
      ];
    case "Advanced Dialogue":
      return [
        { key: "speaker", label: "화자", type: "text", defaultValue: "" },
        { key: "portraitId", label: "초상화", type: "text", defaultValue: "" },
        { key: "emotion", label: "감정", type: "select", defaultValue: "neutral", options: EMOTION_OPTIONS },
        { key: "body", label: "대사", type: "textarea", defaultValue: "" },
        { key: "autoAdvance", label: "자동 넘김", type: "boolean", defaultValue: false },
      ];
    case "Sound Layer":
      return [
        { key: "channel", label: "채널", type: "select", defaultValue: "bgm", options: SOUND_CHANNEL_OPTIONS },
        { key: "resourceId", label: "리소스", type: "text", defaultValue: "" },
        { key: "volume", label: "볼륨", type: "number", defaultValue: 100 },
        { key: "fadeMs", label: "페이드(ms)", type: "number", defaultValue: 0 },
      ];
    case "Weighted Branch":
      return [
        { key: "table", label: "가중치 표", type: "textarea", defaultValue: "성공=1\n실패=1" },
        { key: "resultVariableId", label: "결과 변수", type: "text", defaultValue: "" },
      ];
    case "Cutscene Control":
      return [
        { key: "action", label: "동작", type: "select", defaultValue: "lockPlayer", options: CUTSCENE_ACTION_OPTIONS },
        { key: "enabled", label: "상태", type: "boolean", defaultValue: true },
      ];
    case "Checkpoint Save":
      return [
        { key: "slotId", label: "슬롯", type: "text", defaultValue: "auto" },
        { key: "label", label: "이름", type: "text", defaultValue: "" },
        { key: "restoreOnGameOver", label: "게임오버 시 복귀", type: "boolean", defaultValue: true },
      ];
    case "UI Command":
      return [
        { key: "surface", label: "표시 위치", type: "select", defaultValue: "toast", options: UI_SURFACE_OPTIONS },
        { key: "message", label: "메시지", type: "textarea", defaultValue: "" },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 1600 },
      ];
    case "Debug Log":
      return [
        { key: "level", label: "수준", type: "select", defaultValue: "info", options: DEBUG_LEVEL_OPTIONS },
        { key: "message", label: "메시지", type: "textarea", defaultValue: "" },
      ];
    case "Evaluate Expression":
      return [
        { key: "expression", label: "식", type: "textarea", defaultValue: "" },
        { key: "resultVariableId", label: "결과 변수", type: "text", defaultValue: "" },
      ];
    case "Flash Screen":
      return [
        { key: "color", label: "색상", type: "select", defaultValue: "white", options: SCREEN_COLOR_OPTIONS },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 300 },
      ];
    case "Shake Screen":
      return [
        { key: "intensity", label: "강도", type: "select", defaultValue: "3", options: SHAKE_INTENSITY_OPTIONS },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 400 },
      ];
    case "Tint Screen":
      return [
        { key: "color", label: "색상", type: "select", defaultValue: "white", options: SCREEN_COLOR_OPTIONS },
        { key: "value", label: "색(R,G,B 또는 hex)", type: "text", defaultValue: "" },
      ];
    case "Move Enemy":
      // 좌표는 트룹 members 와 같은 전투장 좌표계(x 0~320, y 0~240).
      return [
        { key: "target", label: "적(enemy-1 또는 적 id)", type: "text", defaultValue: "enemy-1" },
        { key: "x", label: "X", type: "number", defaultValue: 80, min: 0, max: 320 },
        { key: "y", label: "Y", type: "number", defaultValue: 100, min: 0, max: 240 },
        { key: "durationMs", label: "시간(ms)", type: "number", defaultValue: 400, min: 0, max: 5000, step: 100 },
      ];
    case "Key Poll":
      return [
        { key: "dirVariableId", label: "방향 변수(0/2/4/6/8)", type: "text", defaultValue: "" },
        { key: "confirmSwitchId", label: "결정 키 스위치", type: "text", defaultValue: "" },
        { key: "cancelSwitchId", label: "취소 키 스위치", type: "text", defaultValue: "" },
        { key: "dashSwitchId", label: "달리기 키 스위치", type: "text", defaultValue: "" },
      ];
    case "Timed Choice":
      return [
        { key: "prompt", label: "질문", type: "text", defaultValue: "" },
        { key: "options", label: "선택지(줄마다)", type: "textarea", defaultValue: "예\n아니오" },
        { key: "timeLimitMs", label: "제한 시간(ms)", type: "number", defaultValue: 3000, min: 500, max: 60000, step: 100 },
        { key: "resultVariableId", label: "결과 변수(1부터, 시간 초과 0)", type: "text", defaultValue: "" },
      ];
    case "Quick Time Event":
      return [
        { key: "mode", label: "방식", type: "select", defaultValue: "sequence", options: QTE_MODE_OPTIONS },
        { key: "keys", label: "순서(예: up,down,z)", type: "text", defaultValue: "z" },
        { key: "windowMs", label: "키 하나당 시간(ms) / 연타 시간", type: "number", defaultValue: 1200, min: 200, max: 20000, step: 100 },
        { key: "resultVariableId", label: "결과 변수(성공 1·실패 0·연타 수)", type: "text", defaultValue: "" },
        { key: "resultSwitchId", label: "성공 스위치", type: "text", defaultValue: "" },
      ];
    case "High Score":
      return [
        { key: "scoreId", label: "점수 이름", type: "text", defaultValue: "score" },
        { key: "action", label: "동작", type: "select", defaultValue: "submit", options: HIGH_SCORE_ACTION_OPTIONS },
        { key: "valueVariableId", label: "점수 변수", type: "text", defaultValue: "" },
        { key: "resultVariableId", label: "최고 점수를 쓸 변수", type: "text", defaultValue: "" },
        { key: "recordSwitchId", label: "새 기록이면 켤 스위치", type: "text", defaultValue: "" },
      ];
    case "Teleport Menu":
      return [
        { key: "prompt", label: "질문", type: "text", defaultValue: "어디로 갈까요?" },
        { key: "resultVariableId", label: "결과 변수(고른 번호, 취소 0, 금지 -1)", type: "text", defaultValue: "" },
        { key: "transfer", label: "고르면 바로 이동", type: "boolean", defaultValue: true },
      ];
    case "Data Query":
      return [
        { key: "query", label: "조회", type: "select", defaultValue: "gold", options: DATA_QUERY_OPTIONS },
        { key: "target", label: "누구에게", type: "text", defaultValue: "" },
        { key: "variableId", label: "결과 변수", type: "text", defaultValue: "" },
      ];
    default:
      return undefined;
  }
}
