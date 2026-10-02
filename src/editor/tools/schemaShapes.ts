// 툴 파라미터 스키마에서 반복되는 객체 shape 조각.
//
// `{ type: "object" }` 만 적고 실제 필드를 description 문자열에 적어두면, strict function-calling
// 경로에서 모델은 그 객체의 필드를 표현할 방법이 없어 `{}` 만 보낸다(2026-08-23 실측: set_build_spec
// `assets:[{}]` 10회 연속 실패 → 스펙 게이트가 후속 배치 툴까지 차단). properties 는 계약이고
// description 은 주석이다. 계약은 여기 조각들을 재사용해 선언한다.
//
// 유니온 shape 은 `oneOf`/`anyOf` 를 쓰지 않는다 — Gemini 계열 게이트웨이가 요청 전체를 400 으로
// 죽인다. 대신 키 합집합을 모두 선택 필드로 선언하고 required 를 비워 둔다.
import { RELATIONSHIP_STATES } from "@/project/relationshipState";
import { EVENT_ANIMATION_TYPES } from "@/project/types";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { CONCEPT_PLAN_ENUMS } from "@/editor/conceptPlan";
import { DIALOGUE_CONTAINER_IDS, DIALOGUE_CONTEXT_IDS, DIALOGUE_STYLE_IDS, dialogueContainerGuideLines, dialogueInlineTagGuideLines } from "@/project/dialogueStyles";
import type { JsonSchema } from "./types";

/** `{x,y}` 좌표. 두 필드 모두 필수. */
export const COORD_SCHEMA: JsonSchema = {
  type: "object",
  properties: { x: { type: "integer" }, y: { type: "integer" } },
  required: ["x", "y"],
};

/** `{x,y}` 좌표 — 부분 지정을 허용하는 자리(선택 필드). */
export const COORD_LOOSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: { x: { type: "integer" }, y: { type: "integer" } },
};

/** `{x,y,w,h}` 영역. 네 필드 모두 필수. */
export const RECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
  },
  required: ["x", "y", "w", "h"],
};

/**
 * 이벤트 커맨드 — 조건은 CONDITION_SCHEMA로 분리한다. `kind` 로 분기하는 넓은 유니온이다. 전 variant 를 나열하면 스키마가 수백 줄이
 * 되고 노출 토큰이 폭증하므로 `kind` 와 최빈 필드만 선언한다. 값 검증은 커맨드 컴파일러가 한다.
 */
const COMMAND_LEAF_SCHEMA: JsonSchema = {
  type: "object",
  description:
    'Command 예: {kind:"changeItem",itemId:"조회한 ID",op:"-=",amount:1}, ' +
    '{kind:"setSwitch",switchId:"조회한 ID",value:true}, {kind:"triggerEnding",endingId:"정의한 ID"}. ' +
    '대사는 {kind:"text",body:"…"} — say·fade 는 컷신(script_cutscene·epilogue) 비트 kind 라서 ' +
    '이벤트 commands 에 넣으면 kind enum 에서 거부된다. ' +
    'triggerEnding의 endingId 생략 시 조건으로 선택한다. switch/item은 조건 kind이며 실행 명령이 아니다.',
  properties: {
    // kind 를 자유 문자열로 두면 모델이 존재하지 않는 kind 를 만들어 보낸다(2026-08-23 실측:
    // pages[0].choices[0].commands[0].kind 가 unknown 으로 거부). 단일 진실 소스 enum 을 노출한다.
    kind: { type: "string", enum: [...COMMAND_KINDS] },
    text: { type: "string" },
    // 단일 type/union 금지 provider 계약 때문에 다형 값만 type을 생략한다.
    // 타입과 필수 값은 기존 kind별 커맨드 shape 검증기가 엄격히 검사한다.
    value: {
      description: 'setSwitch: boolean 또는 "toggle" 또는 {kind:"var",id}. setVariable: number 또는 {kind:"var",id}. setSelfSwitch/setFlag: boolean. changeFactionStance: number.',
    },
    op: { type: "string", enum: ["=", "+=", "-=", "*=", "/="], description: "changeItem/changeGold: =|+=|-=. setVariable: =|+=|-=|*=|/=. 아이템 지급은 changeItem + itemId + op:+= + amount." },
    endingId: { type: "string", description: "triggerEnding 대상 ending ID. 생략하면 조건에 맞는 엔딩을 선택." },
    id: { type: "string" },
    mapId: { type: "string" },
    x: { type: "integer" },
    y: { type: "integer" },
    amount: { type: "integer" },
    itemId: { type: "string" },
    speciesId: { type: "string", description: "giveMonster: 조회한 monsterSpecies ID" },
    level: { type: "integer", description: "giveMonster: 지급할 몬스터의 레벨" },
    // kind 별 필수 참조 필드. 여기 없으면 Gemini 계열은 선언된 칸(speaker·itemId·fields·text)에 id 를 밀어 넣는다
    // (2026-09-24 실측: battleProcessing troopId 를 13번 연속 다른 칸에 넣어 거부, changeParty 는 speciesId 로 보냄).
    troopId: { type: "string", description: "battleProcessing: 조회한 troop ID(트레이너·관장·야생 무리)" },
    canEscape: { type: "boolean", description: "battleProcessing: 도망 허용" },
    canLose: { type: "boolean", description: "battleProcessing: 져도 게임 오버 없이 계속" },
    actorId: { type: "string", description: "changeParty/changeExp/changeLevel/learnSkill/changeActorHp 등: 조회한 actor ID(몬스터 종 ID 아님)" },
    action: { type: "string", description: "changeParty: add|remove|lead(선두 교대 — 그 배우를 맨 앞으로, 필드 주인공 그림이 바뀐다). learnSkill: learn|forget." },
    skillId: { type: "string", description: "learnSkill: 조회한 skill ID" },
    eventId: { type: "string", description: "moveEvent/callMapEvent: 대상 이벤트 ID" },
    commonEventId: { type: "string", description: "callCommonEvent: 공통 이벤트 ID" },
    ms: { type: "integer", description: "wait: 기다릴 밀리초" },
    switchId: { type: "string" },
    variableId: { type: "string" },
    label: { type: "string" },
    key: { type: "string", description: "setSelfSwitch 키 A|B|C|D" },
    delta: { type: "integer", description: "changeFriendship 변화량" },
    speaker: { type: "string" },
    body: { type: "string", description: "text 대사 본문" },
    commandId: { type: "string", description: "m2Command id, 예: m2-098-change-enemy-hp. 주인공 모습 바꾸기(변신·효과·옷 갈아입기)는 m2-024-change-actor-graphic + fields {target:actorId, value:charset 검색 id(\"charset:<텍스처>:<칸>\") 또는 텍스처 키, characterIndex:0~7}" },
    fields: { type: "object", additionalProperties: true, description: 'm2Command 필수 필드 객체. 예: {target:"all",operation:"remove",value:10}' },
  },
  required: ["kind"],
  // variant 전용 필드는 커맨드 shape 검증기가 본다.
  additionalProperties: true,
};

// A finite schema avoids cyclic JSON/$ref on provider transports. Nested branch
// commands retain the same kind/field contract; runtime validates every depth.
export const COMMAND_SCHEMA: JsonSchema = {
  ...COMMAND_LEAF_SCHEMA,
  properties: {
    ...COMMAND_LEAF_SCHEMA.properties,
    prompt: { type: "string" },
    options: {
      type: "array",
      description:
        "choices: {text,branch} 선택지. presentItem: {itemId,branch} — 그 아이템을 냈을 때 실행할 Command[]. " +
        "증거 제시·아이템 보여주기는 choices+아이템 조건이 아니라 presentItem 으로 만든다. " +
        "battleProcessing 은 options 를 받지 않는다 — 전투 결과 분기는 branchOnResult:true + victoryBranch/defeatBranch/escapeBranch.",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "choices 전용 선택지 문구" },
          itemId: { type: "string", description: "presentItem 전용: 정답으로 받을 아이템 ID" },
          branch: { type: "array", items: COMMAND_LEAF_SCHEMA },
        },
        required: ["branch"],
      },
    },
    cancelBehavior: { type: "string", enum: ["disallow", "choice1", "choice2", "choice3", "choice4", "choice5", "branch"] },
    cancelBranch: { type: "array", items: COMMAND_LEAF_SCHEMA, description: "choices: 취소 분기. presentItem: 아무것도 안 내고 닫았거나 보여줄 후보가 없을 때." },
    itemIds: { type: "array", items: { type: "string" }, description: "shop: 파는 아이템 ID 목록(필수). presentItem: 목록 후보 — 생략하면 소지품 전체, 소지한 것만 뜬다." },
    otherwiseBranch: { type: "array", items: COMMAND_LEAF_SCHEMA, description: "presentItem: options 에 없는(틀린) 아이템을 냈을 때." },
    consume: { type: "boolean", description: "presentItem: true 면 맞는 아이템을 1개 소모." },
    troopId: { type: "string", description: "battleProcessing·tacticsBattle: 싸울 부대(troop) ID" },
    width: { type: "number", description: "tacticsBattle: 격자 가로 칸 수(기본 8). tacticsBattle 은 이동+인접 공격 턴제 격자 전투, 결과는 victoryBranch/defeatBranch." },
    height: { type: "number", description: "tacticsBattle: 격자 세로 칸 수(기본 6)" },
    canEscape: { type: "boolean", description: "battleProcessing: 도주 허용(기본 true)" },
    canLose: { type: "boolean", description: "battleProcessing: 패배해도 게임 오버 없이 진행(기본 false). defeatBranch 를 쓰려면 true." },
    formation: { type: "string", enum: ["normal", "preemptive", "surprise", "backAttack", "pincer"], description: "battleProcessing: 개시 진형 강제(선제 공격·기습·백어택·협공). 생략 = 시스템 설정" },
    branchOnResult: {
      type: "boolean",
      description:
        "battleProcessing: true 면 전투 결과로 분기한다. 보스 처치 후 스위치·셀프 스위치를 켜는 명령은 victoryBranch 에 넣는다. " +
        '예: {kind:"battleProcessing",troopId:"조회한 ID",canEscape:false,canLose:false,branchOnResult:true,victoryBranch:[{kind:"setSelfSwitch",key:"A",value:true}]}',
    },
    victoryBranch: { type: "array", items: COMMAND_LEAF_SCHEMA, description: "battleProcessing(branchOnResult:true): 이겼을 때 실행할 Command[]" },
    defeatBranch: { type: "array", items: COMMAND_LEAF_SCHEMA, description: "battleProcessing(branchOnResult:true, canLose:true): 졌을 때 실행할 Command[]" },
    escapeBranch: { type: "array", items: COMMAND_LEAF_SCHEMA, description: "battleProcessing(branchOnResult:true, canEscape:true): 도망쳤을 때 실행할 Command[]" },
  },
};

/** `GraphicSpec` (eventCompile.ts): `{query}` | `{textureKey,characterIndex?}` | `{transparent:true}`. */
export const GRAPHIC_SPEC_SCHEMA: JsonSchema = {
  type: "object",
  description: "{query} | {textureKey,characterIndex} | {transparent:true}",
  properties: {
    query: { type: "string", description: "별칭 또는 자유 질의(예: '할머니', 'old woman')" },
    textureKey: { type: "string", description: "charset textureKey 직접 지정" },
    characterIndex: { type: "integer", description: "charset 내 캐릭터 인덱스(기본 0)" },
    transparent: { type: "boolean", description: "true면 투명 이벤트" },
  },
};

/** `SimplePage.face` / place_npc `face` — 두 지정 방식의 키 합집합. */
export const FACE_SCHEMA: JsonSchema = {
  type: "object",
  description: "{resourceId} 또는 {textureKey,characterIndex}. resourceId는 얼굴 낱장 리소스 id(48×48 PNG 한 장). 생략 시 각 페이지 graphic의 공용 캐릭터·얼굴 매핑을 사용한다. 미검토·얼굴 없음·미등록은 얼굴을 추정하지 않는다.",
  properties: {
    resourceId: { type: "string", description: "얼굴 낱장 리소스 id. 예: easyrpg-faceset-actor1-07" },
    position: { type: "string", enum: ["left", "right"] },
    flipHorizontally: { type: "boolean" },
    textureKey: { type: "string" },
    characterIndex: { type: "integer" },
  },
};

/**
 * `CutsceneBeat` (editor/cutscene) — 13 variant 유니온. 전 variant 키를 나열하면 스키마가 비대해지므로
 * `kind` enum + 최빈 필드만 선언하고 variant 전용 필드는 `additionalProperties` 로 허용한다.
 */
export const CUTSCENE_BEAT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      // text·narrate 는 say 의 별칭 — 받아서 say 로 옮긴다(이벤트 명령 모양 {kind:"text",body} 가 enum 에서 통째로 튕기던 문제).
      enum: ["say", "moveActor", "camera", "picture", "music", "fade", "tint", "distort", "background", "flash", "shake", "wait", "parallel", "label", "jump", "switch", "transfer", "ending", "text", "narrate"],
    },
    // 진행 비트: switch{switchId|key,value} · transfer{mapId,x,y,facing,fade} · ending{endingId}
    switchId: { type: "string", description: "switch 비트: 켤 전역 스위치 id" },
    key: { type: "string", enum: ["A", "B", "C", "D"], description: "switch 비트: 이 이벤트의 셀프 스위치(switchId 대신)" },
    value: { type: "boolean", description: "switch 비트: 기본 true" },
    mapId: { type: "string", description: "transfer 비트: 옮길 맵 id" },
    facing: { type: "string", enum: ["up", "down", "left", "right", "retain"], description: "transfer 비트: 도착 후 방향" },
    fade: { type: "string", enum: ["black", "white", "none"], description: "transfer 비트: 전환 페이드(기본 black)" },
    endingId: { type: "string", description: "ending 비트: define_ending 으로 정의한 엔딩 id" },
    speaker: { type: "string" },
    text: { type: "string", description: `say 본문. 인라인 태그를 쓸 수 있다(여는 태그는 [/] 로 닫음):\n${dialogueInlineTagGuideLines().join("\n")}` },
    lines: { type: "array", items: { type: "string" } },
    emotion: { type: "string" },
    autoAdvance: { type: "boolean" },
    context: {
      type: "string",
      enum: [...DIALOGUE_CONTEXT_IDS],
      description: "say 전용 대사 종류. narration(내레이션)·thought(속마음)·whisper·shout·radio·sign(표지판)·letter(편지)·system(안내). 일반 대사는 생략.",
    },
    style: { type: "string", enum: [...DIALOGUE_STYLE_IDS], description: "say 전용. 이 대사만 다른 대화창. 보통 생략." },
    container: { type: "string", enum: [...DIALOGUE_CONTAINER_IDS], description: `say 전용 대사 그릇:\n${dialogueContainerGuideLines().join("\n")}\n마을 사람 잡담은 bark, 무전·동료 한마디는 corner.` },
    face: FACE_SCHEMA,
    direction: { type: "string", enum: ["in", "out"] },
    target: { type: "string" },
    eventId: { type: "string" },
    mode: { type: "string" },
    x: { type: "integer" },
    y: { type: "integer" },
    durationMs: { type: "integer" },
    label: { type: "string" },
    wait: { type: "boolean" },
    // 카메라 배율. CutsceneCameraBeat.zoom 이 이미 받고 있었지만 스키마에 없어 모델이 쓸 수
    // 없었다(실측 2026-09-22) — 고해상도 배경을 1:1로 쓰려면 이 값이 필요하다.
    zoom: {
      type: "number",
      minimum: 0.25,
      maximum: 6,
      description: "camera 비트 전용. 배율(0.25~6, 기본 1). 고해상도 화면에서 클래식 시야(20x15 타일)를 유지하려면 해상도/타일크기의 비율을 쓴다 — 1440x1080 이면 4.5.",
    },
    offsetX: { type: "integer" },
    offsetY: { type: "integer" },
    // 화면 왜곡 비트 — 수중·꿈·시간 왜곡·회상 진입. 끄려면 effect "clear".
    effect: {
      type: "string",
      enum: ["wave", "mosaic", "rotate", "clear"],
      description: "distort 비트 전용: wave=줄마다 흔들리는 물결, mosaic=모자이크 블록, rotate=화면 기울기, clear=왜곡 모두 끄기. 컷신이 끝나도 남으므로 끝에 clear 를 넣을지 정한다.",
    },
    amount: {
      type: "number",
      description: "distort 비트 전용 세기: wave px 0~16(기본 4), mosaic 블록 px 0~32(기본 8), rotate 도 -180~180(기본 8). 0 이면 그 효과만 끈다.",
    },
    blendMode: {
      type: "string",
      enum: ["normal", "add", "screen", "multiply"],
      description: "picture 비트의 겹치기: add=빛기둥·불꽃·유령(밝게 더함), screen=부드러운 빛, multiply=그림자·핏빛 물들임. 생략=normal.",
    },
    easing: {
      type: "string",
      enum: ["linear", "easeIn", "easeOut", "easeInOut"],
      description: "camera·picture 비트의 움직임 곡선. 생략=일정하게. 카메라가 인물로 다가가 멈출 때 easeOut, 무게 있는 팬은 easeInOut.",
    },
    // 먼 배경(파노라마) 비트 — 회상·꿈에서 구름을 서서히 멈추기. 맵 배경 저작은 set_map_properties.background.
    flowPercent: {
      type: "number",
      minimum: 0,
      maximum: 400,
      description: "background 비트 전용: 배경 흐름 배율 %(100=맵에 저작한 속도, 0=멈춤). durationMs 동안 서서히 바뀐다.",
    },
    imageId: { type: "string", description: "background 비트 전용: 첫 장 배경 그림을 이것으로 바꾼다(생략하면 그림 유지)." },
  },
  required: ["kind"],
  additionalProperties: true,
};

/**
 * `Condition` (project/types/events) — 리프 + all/any/not 복합까지 17 variant.
 * `value` 는 boolean|number 로 갈리므로 단일 type을 강제하지 않는다.
 * 필수 값과 타입은 validateConditionShape가 kind별로 검사한다.
 */
export const CONDITION_SCHEMA: JsonSchema = {
  type: "object",
  description:
    "kind=switch → switchId + value(boolean). kind=variable → variableId + op + value(number). " +
    'kind=item → itemId + present(boolean), 예: {kind:"item",itemId:"조회한 ID",present:true}. ' +
    "kind=monsterSpecies → speciesId + present(boolean). 파티 또는 박스의 현재 보유 여부(과거 포획 이력 아님). " +
    "kind=all|any → conditions[]. kind=not → condition. kind=selfSwitch → key + value(boolean).",
  properties: {
    kind: {
      type: "string",
      // 손으로 복사한 목록은 드리프트한다 — 실측으로 `run`(로그라이크 런)이 빠져 모델이 쓸 수 없었다.
      // 단일 진실 소스는 commandKindRegistry.CONDITION_KINDS 다.
      enum: [...CONDITION_KINDS],
    },
    state: { type: "string", enum: [...RELATIONSHIP_STATES] },
    switchId: { type: "string" },
    variableId: { type: "string" },
    itemId: { type: "string" },
    actorId: { type: "string" },
    value: { description: "switch/selfSwitch: boolean 필수. variable/friendshipAtLeast: number 필수. run: query별 boolean 또는 number." },
    speciesId: { type: "string", description: "monsterSpecies 조건: 조회한 몬스터 종 ID" },
    present: { type: "boolean", description: "item/actor/monsterSpecies 조건: true=보유/합류, false=미보유/미합류. 필수." },
    op: { type: "string", enum: ["==", ">=", "<=", ">", "<", "!="] },
    amount: { type: "integer" },
    phase: { type: "string", enum: ["morning", "day", "evening", "night"] },
    season: { type: "string", enum: ["spring", "summer", "fall", "winter"] },
    activity: { type: "string" },
    result: { type: "string", enum: ["victory", "defeat", "escape"] },
    key: { type: "string", enum: ["A", "B", "C", "D"], description: "selfSwitch 키" },
    npcKey: { type: "string", description: "friendshipAtLeast 대상. 비우면 이 이벤트 characterId" },
  },
  required: ["kind"],
  additionalProperties: true,
};

/** Native EventPage input for the partial-update tool, not a SimplePage compiler. */
export const NATIVE_EVENT_PAGE_SCHEMA: JsonSchema = {
  type: "object",
  description: "EventPage. pages 지정은 페이지 배열 전체 교체다. 생략한 필수 페이지 필드는 기본값으로 보완한다. " +
    "대사/선택/효과는 commands에만 둔다: {kind:'choices',options:[{text:'선택',branch:[{kind:'triggerEnding',endingId:'정의한 ID'}]}]}. " +
    "page.choices/lines/showText/messages/text/face 및 graphic.query/textureKey/characterIndex는 지원하지 않는다. SimplePage는 place_npc/make_villager를 사용하라.",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    conditions: { type: "array", items: CONDITION_SCHEMA, description: "모든 조건이 참인 마지막 페이지를 실행. 기본 페이지를 먼저, 조건 페이지를 뒤에 둔다." },
    commands: { type: "array", items: COMMAND_SCHEMA },
    trigger: {
      type: "object",
      properties: { kind: { type: "string", enum: ["action", "touch", "playerTouch", "eventTouch", "auto", "parallel"] } },
      required: ["kind"],
    },
    graphic: {
      type: "object",
      properties: {
        sprite: {
          type: "object",
          properties: { id: { type: "string" }, type: { type: "string", enum: ["bundled", "uploaded"] } },
          required: ["id", "type"],
        },
        direction: { type: "string", enum: ["down", "left", "right", "up"] },
        pattern: {
          type: "integer",
          description: "스프라이트 시트의 프레임 번호이며 characterIndex(캐릭터 슬롯)가 아니다. " +
            "charset 슬롯 0~7의 아래방향 정지 프레임은 25,28,31,34,73,76,79,82. " +
            "list_resources(kind:'charset') / list_npc_graphics 결과의 nativeGraphic을 graphic에 그대로 사용하라.",
        },
        transparent: { type: "boolean" },
        scale: { type: "number" },
        blendMode: {
          type: "string",
          enum: ["normal", "add", "screen", "multiply"],
          description: "아래 화면과 섞는 법. add=불꽃·빛기둥·유령·마법진처럼 밝게, screen=부드러운 빛, multiply=그림자·물들임. 생략=normal.",
        },
      },
    },
    priority: { type: "string", enum: ["below", "same", "above"] },
    overlapForbidden: { type: "boolean" },
    animationType: {
      type: "string",
      enum: [...EVENT_ANIMATION_TYPES],
      description: "페이지 애니메이션 유형. 멈춰 있는 대상은 fixedGraphic(방향·프레임 고정), 걸어 다니는 캐릭터 기본은 normal. none 같은 값 금지 — 런타임이 조사 조작을 죽인다.",
    },
    footprint: {
      type: "object",
      properties: { width: { type: "integer" }, height: { type: "integer" } },
      required: ["width", "height"],
    },
    passRows: { type: "integer" },
    interaction: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["pushable", "hiding"] },
        directions: { type: "array", items: { type: "string", enum: ["down", "left", "right", "up"] } },
      },
      required: ["kind"],
    },
    movement: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["fixed", "random", "approach", "custom", "living", "chase"] },
        speed: { type: "number" },
        frequency: { type: "number" },
        sightRange: { type: "number" },
        giveUpRange: { type: "number" },
        pathfind: { type: "boolean" },
        moveIntervalMs: { type: "number" },
      },
      description: "EventPageMovement. custom는 route:MoveRoute, living은 living:NpcLivingMovement, chase는 pursuit:ChaseAcrossMaps를 추가할 수 있다.",
      additionalProperties: true,
    },
  },
};

/** `SimplePage` (types.ts) — place_npc/make_villager 등이 받는 고수준 페이지. */
export const SIMPLE_PAGE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    lines: { type: "array", description: "대사 줄", items: { type: "string" } },
    showText: { type: "array", description: "lines 별칭", items: { type: "string" } },
    messages: { type: "array", description: "lines 별칭", items: { type: "string" } },
    text: { type: "string", description: "단일 대사" },
    name: { type: "string", description: "페이지 표시 이름(예: '촌장 · 기본'). 생략 시 NPC 이름" },
    graphic: GRAPHIC_SPEC_SCHEMA,
    face: FACE_SCHEMA,
    choices: {
      type: "array",
      description: "선택지. 선택 결과(합류 changeParty·전투 battleProcessing·setSwitch 등)는 각 선택지의 commands에 넣는다 — 비우면 골라도 아무 일도 없다.",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          commands: { type: "array", description: "이 선택지를 고르면 실행할 Command[] (branch로 보내도 commands로 읽는다)", items: COMMAND_SCHEMA },
        },
        required: ["text"],
      },
    },
    conditions: {
      type: "array",
      description:
        "이 페이지가 활성화되는 '등장 조건'(EventPageCondition[]). 모든 조건이 참이어야 활성 후보가 된다. 빈 배열=무조건. "
        + "런타임은 조건이 맞는 **마지막** 페이지 하나만 실행하므로, 조건 없는 페이지를 여러 장 만들면 마지막 1장만 나오고 앞 장은 죽는다. "
        + "상태별 NPC는 페이지마다 서로 다른 조건을 걸어라(기본=빈 배열, 그다음 selfSwitch/switch/timePhase/friendshipAtLeast 등).",
      items: CONDITION_SCHEMA,
    },
    commands: { type: "array", description: "Command[]", items: COMMAND_SCHEMA },
  },
};

/** `LightSource` (project/types/events). `at` 은 `{x,y}` | `{eventId}` | `"player"` 유니온이라 키 합집합. */
export const LIGHT_SOURCE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    at: {
      type: "object",
      description: "{x,y} 또는 {eventId}. 'player' 문자열도 허용된다(문자열로 보낼 때는 이 객체를 쓰지 않는다).",
      properties: { x: { type: "integer" }, y: { type: "integer" }, eventId: { type: "string" } },
    },
    radius: { type: "number" },
    intensity: { type: "number" },
    color: { type: "string" },
    flicker: { type: "boolean" },
  },
  required: ["id", "radius"],
  // at 을 'player' 문자열로 보내는 경로를 스키마가 막지 않도록 자유 필드를 허용한다.
  additionalProperties: true,
};

/** `{itemId, amount}` 보상/재고 항목. */
export const ITEM_AMOUNT_SCHEMA: JsonSchema = {
  type: "object",
  properties: { itemId: { type: "string" }, amount: { type: "integer" } },
  required: ["itemId"],
};

/** 마을 집 계획 — plan_village/author_village/village 세션이 공유하는 `houses`/`housePlans` 항목. */
export const VILLAGE_HOUSE_PLAN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    fence: { type: "boolean", description: "이 집만 울타리(기본 없음). 중요한 집에만 지정." },
    kitId: { type: "string", description: "집 킷 id" },
    ownerName: { type: "string" },
    interior: { type: "boolean", description: "내부 맵 생성 여부" },
    door: { type: "boolean", description: "문 자동(기본 true)" },
    wings: { type: "array", description: "집 동 bbox", items: RECT_SCHEMA },
    yard: {
      type: "array",
      description:
        "마당 꾸밈 태그(firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|chair|sign). 개수는 같은 태그를 여러 번.",
      items: { type: "string" },
    },
  },
};

/**
 * 방 하네스 세션/파이프라인의 파괴적 재시공 옵트인.
 *
 * 기본은 거부(`map-exists`)다 — 존재 검사 없이 대입하던 시절 기존 실내 맵이 무음으로 지워졌다
 * (2026-08-29 modify 진단). 모델이 정말 폐기를 의도할 때만 이 플래그를 켠다.
 */
export const REPLACE_EXISTING_SCHEMA: JsonSchema = {
  type: "boolean",
  description:
    "기존 맵 id 를 대상으로 삼을 때만 true. 그 맵의 타일·이벤트가 전부 삭제되고 빈 방으로 교체된다. "
    + "기존 맵을 고치려는 요청이면 이 플래그를 쓰지 말고 furnish_interior_space/fill_region/tile_erase 를 써라.",
};

/** 마을 NPC 계획 — `{name, lines?}`. */
export const VILLAGE_NPC_PLAN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
  },
};


/**
 * 개념 시설 설계(place_concept.plan · author_house.interiorPlan 공용).
 * 설계는 정본이다 — 생략하거나 템플릿을 그대로 복사하면 시공이 거부된다(2026-09-11: 모든 실내가 같은 도면으로 찍히던 결함).
 */
export const CONCEPT_PLAN_SCHEMA: JsonSchema = {
  type: "object",
  description:
    "설계한 시설 도면. get_concept_facility(query) 가 돌려준 템플릿을 요청에 맞게 고쳐 넘긴다 — 방 수(count)·크기(size)·바닥·층·구역(zone)·물건 추가/제외. "
    + "좌표는 코드가 정한다. objectId 는 vocabulary[].id 에서만. 템플릿의 required 물건을 빼면 경고(거부 아님). "
    + "**생략하거나 템플릿을 그대로 복사하면 거부된다** — 그러면 모든 실내가 같은 도면으로 찍힌다. 장소 수·크기·물건 중 둘 이상이 템플릿과 달라야 한다.",
  properties: {
    layout: {
      type: "string",
      enum: [...CONCEPT_PLAN_ENUMS.layouts],
      description: "도면 문법. row=방 줄→복도→홀(기본). double-row=객실은 복도 북쪽, 날개(주방·창고)는 홀 옆.",
    },
    wall: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.walls], description: "벽 재질. 생략=cream" },
    places: {
      type: "array",
      description: "장소 목록. entrance(정문 홀) 하나, walkway(복도) 0~1, 나머지 room. row 는 홀→복도→방 줄, double-row 는 북 방 줄→복도→홀+남쪽 날개.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          role: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.roles], description: "생략=room" },
          shape: { type: "string", enum: ["rect", "l", "alcove", "l-right", "bay", "notch", "cross"], description: "방 바닥 형태. 생략=rect" },
          size: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.sizes], description: "s 5×3 · m 7×4 · l 9×5. 생략=m" },
          count: { type: "integer", description: `같은 장소 개수 1..${CONCEPT_PLAN_ENUMS.countMax}(객실 ×3). 생략=1` },
          floor: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.floors], description: "생략=wood" },
          level: { type: "integer", description: `층 1..${CONCEPT_PLAN_ENUMS.levelMax}. 2 이상은 <mapId>_<n>f 별도 맵 + 계단. 생략=1` },
          zone: { type: "string", enum: [...CONCEPT_PLAN_ENUMS.zones], description: "double-row 에서 north=복도 위 객실, south=홀 옆 날개. 생략 시 주방·창고 라벨은 south" },
        },
        required: ["id"],
      },
    },
    things: {
      type: "array",
      description: "물건 목록. 각 물건은 어느 장소(placeIds)에 놓이는지와 능력 칩(chips)을 가진다.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          objectId: { type: "string", description: "get_concept_facility 의 vocabulary[].id" },
          placeIds: { type: "array", items: { type: "string" } },
          chips: {
            type: "array",
            items: { type: "string" },
            description: `내장 ${Object.entries(CONCEPT_PLAN_ENUMS.chipLabels).map(([id, label]) => `${id}=${label}`).join(" · ")} · 자유 칩(영문·숫자·-_·1~32자, 엔진 무동작 메모)도 된다`,
          },
          required: { type: "boolean", description: "자리가 없으면 경고를 내는 핵심 물건" },
        },
        required: ["objectId", "placeIds"],
      },
    },
  },
  required: ["places"],
};
