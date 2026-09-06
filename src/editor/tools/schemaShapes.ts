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
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
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
 * 이벤트 커맨드/조건 — `kind` 로 분기하는 넓은 유니온이다. 전 variant 를 나열하면 스키마가 수백 줄이
 * 되고 노출 토큰이 폭증하므로 `kind` 와 최빈 필드만 선언한다. 값 검증은 커맨드 컴파일러가 한다.
 */
const COMMAND_LEAF_SCHEMA: JsonSchema = {
  type: "object",
  description:
    'Command 예: {kind:"changeItem",itemId:"조회한 ID",op:"-=",amount:1}, ' +
    '{kind:"setSwitch",switchId:"조회한 ID",value:true}, {kind:"triggerEnding",endingId:"정의한 ID"}. ' +
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
    op: { type: "string", enum: ["=", "+=", "-=", "*=", "/="], description: "changeItem/changeGold: =|+=|-=. setVariable: =|+=|-=|*=|/=." },
    endingId: { type: "string", description: "triggerEnding 대상 ending ID. 생략하면 조건에 맞는 엔딩을 선택." },
    id: { type: "string" },
    mapId: { type: "string" },
    x: { type: "integer" },
    y: { type: "integer" },
    amount: { type: "integer" },
    itemId: { type: "string" },
    switchId: { type: "string" },
    variableId: { type: "string" },
    label: { type: "string" },
    key: { type: "string", description: "selfSwitch 키 A|B|C|D" },
    delta: { type: "integer", description: "changeFriendship 변화량" },
    speaker: { type: "string" },
    body: { type: "string", description: "text 대사 본문" },
    commandId: { type: "string", description: "m2Command id, 예: m2-211-weighted-branch" },
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
      description: "choices 실행 선택지. 각 branch는 선택 시 실행할 Command[].",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          branch: { type: "array", items: COMMAND_LEAF_SCHEMA },
        },
        required: ["text", "branch"],
      },
    },
    cancelBehavior: { type: "string", enum: ["disallow", "choice1", "choice2", "choice3", "choice4", "choice5", "branch"] },
    cancelBranch: { type: "array", items: COMMAND_LEAF_SCHEMA },
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
  description: "{resourceId} 또는 {textureKey,characterIndex}. resourceId는 얼굴 낱장 리소스 id(48×48 PNG 한 장). 생략 시 graphic에서 자동 매핑.",
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
      enum: ["say", "moveActor", "camera", "picture", "music", "fade", "tint", "flash", "shake", "wait", "parallel", "label", "jump"],
    },
    speaker: { type: "string" },
    text: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
    emotion: { type: "string" },
    autoAdvance: { type: "boolean" },
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
    "kind=all|any → conditions[]. kind=not → condition.",
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
    present: { type: "boolean", description: "item/actor 조건: true=보유/합류, false=미보유/미합류. 필수." },
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
        pattern: { type: "integer" },
        transparent: { type: "boolean" },
        scale: { type: "number" },
      },
    },
    priority: { type: "string", enum: ["below", "same", "above"] },
    overlapForbidden: { type: "boolean" },
    animationType: { type: "string" },
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
      description: "선택지",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          commands: { type: "array", items: COMMAND_SCHEMA },
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
