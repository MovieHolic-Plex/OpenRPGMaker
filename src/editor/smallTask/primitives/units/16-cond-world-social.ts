import { CONDITION_OP_OPTIONS, seasonLabel, timePhaseLabel } from "@/editor/panels/eventEditor/options";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { findCharacterIdEntry } from "@/project/characterIdIndex";
import { WEEKDAY_LABELS } from "@/project/conditionActorQueries";
import { difficultiesOf } from "@/project/difficulty";
import { eventDisplayName } from "@/project/eventDisplayName";
import { SEASONS, TIME_PHASES } from "@/project/gameTime";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { findLocationById } from "@/project/mapNamedLocations";
import { RELATIONSHIP_STATES, relationshipStateName } from "@/project/relationshipState";
import { ROGUELIKE_FLOOR_MAX, ROGUELIKE_FLOOR_MIN } from "@/project/roguelikeRun";
import { FRIENDSHIP_MAX, FRIENDSHIP_MIN } from "@/project/session";
import { resolveSocialKey } from "@/project/socialKey";
import type { Condition, ConditionCompareOp, GameEvent, GameMap, Project } from "@/project/types";
import { josa, withJosa } from "@/util/josa";
import { scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { SmallTaskPrimitive } from "../types";

export const UNIT = "16-cond-world-social";

type Args = Record<string, unknown>;
const COMPARE_OPS = CONDITION_OP_OPTIONS.map(({ value }) => value);
const BATTLE_RESULTS = { victory: "이겼을", defeat: "졌을", escape: "도망쳤을" } as const;
const RUN_RESULTS = { completed: "마쳤을", failed: "실패했을", abandoned: "포기했을" } as const;
const DIRECTIONS = { up: "위쪽", down: "아래쪽", left: "왼쪽", right: "오른쪽" } as const;
const RELATIONS = {
  playerBehindEvent: "주인공이 이 이벤트의 등 뒤에 있을 때",
  eventBehindPlayer: "이 이벤트가 주인공의 등 뒤에 있을 때",
  playerFacingEvent: "주인공이 이 이벤트를 바라볼 때",
} as const;
const ACTIVITY_LABELS: Readonly<Record<string, string>> = {
  work: "일", rest: "휴식", sleep: "잠", shop: "장사", eat: "식사", walk: "산책",
};

function choices(values: readonly string[], description: string): JsonSchema {
  return { type: "string", enum: values, description };
}

function wording(description: string): JsonSchema {
  return { type: "string", minLength: 1, description };
}

function yesNo(description: string): JsonSchema {
  return { type: "boolean", description };
}

function count(minimum: number, maximum: number, description: string): JsonSchema {
  return { type: "integer", minimum, maximum, description };
}

function nonempty(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new PrimitiveError(message);
  return trimmed;
}

function comparisonClause(op: ConditionCompareOp, quantity: string): string {
  if (op === "==") return `${withJosa(quantity, "와/과")} 같을 때`;
  if (op === "!=") return `${withJosa(quantity, "와/과")} 다를 때`;
  return `${quantity} ${CONDITION_OP_OPTIONS.find((option) => option.value === op)?.label}일 때`;
}

function conditionLabel(name: string | undefined, id: string, fallback: string): string {
  if (!name || name.trim() === id) return fallback;
  const text = displayText(name.replace(/[.!?{}\[\]「」『』]/gu, " "), fallback);
  if (!/[가-힣]/u.test(text)) return fallback;
  return text.length <= 22 ? text : text.slice(0, 21) + "…";
}

type PageContext = ReturnType<typeof scopedPage> & { project: Project };

function localEvent(map: GameMap, id: string): GameEvent {
  const event = map.events.find((entry) => entry.id === id);
  if (!event) throw new PrimitiveError("이 맵에서 조건에 연결할 이벤트를 찾을 수 없습니다.");
  return event;
}

function localEventName(map: GameMap, id: string, fallback: string): string {
  return conditionLabel(eventDisplayName(localEvent(map, id)), id, fallback);
}

function localLocationName(map: GameMap, id: string): string {
  const location = findLocationById(map, id);
  if (!location) throw new PrimitiveError("이 맵에서 조건에 연결할 구역을 찾을 수 없습니다.");
  return conditionLabel(location.name, id, "선택한 구역");
}

function socialName({ project, event }: PageContext, npcKey?: string): string {
  const key = resolveSocialKey(event, npcKey);
  if (!key) throw new PrimitiveError("이 이벤트에 연결된 인물을 찾을 수 없습니다.");
  const character = findCharacterIdEntry(project, key);
  if (!character) throw new PrimitiveError("조건에 연결할 인물을 찾을 수 없습니다.");
  const host = character.hosts[0];
  const namedEvent = host && project.maps[host.mapId]?.events.find((entry) => entry.id === host.eventId);
  const name = character.profile?.displayName || namedEvent?.name;
  return conditionLabel(name === namedEvent?.id ? undefined : name, key, "연결된 인물");
}

type PageCondition<K extends Condition["kind"]> = Extract<Condition, { kind: K }>;
type ConditionFields<K extends Condition["kind"]> = Omit<PageCondition<K>, "kind">;
type PreparedCondition<K extends Condition["kind"]> = { condition: PageCondition<K>; clause: string };

function pageCondition<K extends Condition["kind"], A extends Args>(
  kind: K,
  title: string,
  properties: Record<keyof A, JsonSchema>,
  required: readonly (string & keyof A)[],
  prepare: (context: PageContext, args: A) => PreparedCondition<K>,
): SmallTaskPrimitive {
  function build(context: PageContext, args: Args) {
    // The runner validates the flat argument schema before calling the primitive.
    const result = prepare(context, args as A);
    try {
      validateConditionShape("등장 조건", result.condition);
    } catch {
      throw new PrimitiveError("등장 조건의 값을 다시 확인해 주세요.");
    }
    return result;
  }

  return {
    id: `cond.${kind}.page.set`,
    unit: UNIT,
    title,
    covers: { conditionKinds: [kind] },
    targets: ["event"],
    args: { type: "object", properties, required, additionalProperties: false },
    scope(ctx) {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", field: "conditions", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { clause } = build({ project: ctx.project, ...scopedPage(ctx) }, args);
      return `${clause} 보이도록 조건을 설정합니다.`;
    },
    apply(ctx, args) {
      const { condition } = build({ project: ctx.project, ...scopedPage(ctx) }, args);
      return updateScopedPage(ctx, (page) => {
        const index = page.conditions.findIndex((entry) => entry.kind === kind);
        if (index >= 0 && page.conditions.some((entry, i) => i > index && entry.kind === kind)) {
          throw new PrimitiveError("같은 종류의 조건이 여러 개라 바꿀 조건을 고를 수 없습니다.");
        }
        const conditions = page.conditions.slice();
        if (index < 0) conditions.push(condition);
        else conditions[index] = condition;
        return { ...page, conditions };
      });
    },
  };
}

type RunArgs = {
  query?: PageCondition<"run">["query"];
  value?: boolean | number;
  op?: ConditionCompareOp;
  flag?: string;
  result?: keyof typeof RUN_RESULTS;
};

function prepareRun(_context: PageContext, { query = "active", value, op, flag, result }: RunArgs): PreparedCondition<"run"> {
  switch (query) {
    case "active":
      if (op !== undefined || flag !== undefined || result !== undefined || typeof value === "number") break;
      return { condition: { kind: "run", query, value: value ?? true }, clause: value === false ? "탐험 중이 아닐 때" : "탐험 중일 때" };
    case "floor": {
      if (flag !== undefined || result !== undefined) break;
      if (typeof value !== "number" || value < ROGUELIKE_FLOOR_MIN || value > ROGUELIKE_FLOOR_MAX) {
        throw new PrimitiveError("확인할 탐험 층을 지정해 주세요.");
      }
      const comparison = op ?? ">=";
      return { condition: { kind: "run", query, value, op: comparison }, clause: `탐험 중 ${comparisonClause(comparison, `${value}층`)}` };
    }
    case "flag": {
      if (op !== undefined || result !== undefined || typeof value === "number") break;
      const key = nonempty(flag ?? "", "확인할 탐험 기록을 지정해 주세요.");
      const name = conditionLabel(key, "", "선택한 기록");
      return { condition: { kind: "run", query, flag: key, value: value ?? true }, clause: `탐험 기록 「${name}」 항목이 ${value === false ? "꺼져" : "켜져"} 있을 때` };
    }
    case "result":
      if (op !== undefined || flag !== undefined || value !== undefined || result === undefined) break;
      return { condition: { kind: "run", query, result }, clause: `탐험을 ${RUN_RESULTS[result]} 때` };
  }
  throw new PrimitiveError("탐험 조건의 종류와 값을 다시 확인해 주세요.");
}

type SightArgs = Omit<ConditionFields<"eventSeesPlayer">, "watchers" | "darkness"> & {
  watcherCharacterId?: string;
  watcherName?: string;
  watcherLocationId?: string;
  nightRange?: number;
  darkRange?: number;
  darkAmbient?: number;
};

const SIGHT_DISTANCE_MAX = Number.MAX_SAFE_INTEGER;

function prepareSight({ map, event, project }: PageContext, args: Partial<SightArgs>): PreparedCondition<"eventSeesPlayer"> {
  const {
    eventId, range = 5, sameRoom, requireFacing, hearRange, value = true, doorsBlock,
    watcherCharacterId, watcherName, watcherLocationId, nightRange, darkRange, darkAmbient,
  } = args;
  const characterId = watcherCharacterId === undefined ? undefined : nonempty(watcherCharacterId, "시야를 확인할 인물을 지정해 주세요.");
  const name = watcherName === undefined ? undefined : nonempty(watcherName, "시야를 확인할 이름을 입력해 주세요.");
  const locationId = watcherLocationId === undefined ? undefined : nonempty(watcherLocationId, "시야를 확인할 구역을 지정해 주세요.");
  const hasFilter = Boolean(characterId || name || locationId);
  if (eventId !== undefined && hasFilter) throw new PrimitiveError("보는 이벤트와 관찰자 조건 중 하나를 골라 주세요.");
  const watchedEventId = hasFilter ? "" : eventId ?? event.id;
  const locationName = locationId === undefined ? undefined : localLocationName(map, locationId);
  let characterName: string | undefined;
  if (characterId !== undefined) {
    const character = findCharacterIdEntry(project, characterId);
    if (!character?.hosts.some((host) => host.mapId === map.id)) {
      throw new PrimitiveError("이 맵에서 시야를 확인할 인물을 찾을 수 없습니다.");
    }
    const host = map.events.find((entry) => entry.characterId === characterId);
    characterName = conditionLabel(character.profile?.displayName || host?.name, characterId, "지정 인물");
  }
  const who = hasFilter
    ? [locationName && `「${locationName}」 안의`, characterName && `「${characterName}」인`, name && `이름에 「${conditionLabel(name, "", "지정한 말")}」이 든`, "이벤트"].filter(Boolean).join(" ")
    : watchedEventId === event.id ? "이 이벤트" : `「${localEventName(map, watchedEventId, "선택한 이벤트")}」 이벤트`;
  if (darkAmbient !== undefined && darkRange === undefined) {
    throw new PrimitiveError("어두울 때 시야 거리와 어둠 기준을 확인해 주세요.");
  }
  const condition: PageCondition<"eventSeesPlayer"> = {
    kind: "eventSeesPlayer", eventId: watchedEventId, range, value,
    ...(sameRoom === undefined ? {} : { sameRoom }),
    ...(requireFacing === undefined ? {} : { requireFacing }),
    ...(hearRange === undefined ? {} : { hearRange }),
    ...(doorsBlock === undefined ? {} : { doorsBlock }),
    ...(hasFilter ? { watchers: {
      ...(characterId === undefined ? {} : { characterId }),
      ...(name === undefined ? {} : { name }),
      ...(locationId === undefined ? {} : { locationId }),
    } } : {}),
    ...(nightRange !== undefined || darkRange !== undefined ? { darkness: {
      ...(nightRange === undefined ? {} : { night: nightRange }),
      ...(darkRange === undefined ? {} : { dark: darkRange }),
      ...(darkAmbient === undefined ? {} : { darkAmbient }),
    } } : {}),
  };
  const shortWho = who.length > 26 ? "지정한 관찰자" : who;
  const observer = hasFilter && !value ? `${shortWho} 중 아무도` : `${shortWho}가`;
  const detection = hearRange && hearRange > 0 ? "알아차릴" : "볼";
  const distanceLabel = hearRange && hearRange > 0 ? `시야 ${range}칸·소리 ${hearRange}칸에서` : `${range}칸 안에서`;
  const clause = `${observer} 주인공을 ${distanceLabel} ${detection} 수 ${value ? "있을" : "없을"} 때`;
  return {
    condition,
    clause: clause.length <= 63 ? clause : `지정한 관찰자가 주인공을 ${detection} 수 ${value ? "있을" : "없을"} 때`,
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  pageCondition<"timePhase", Partial<ConditionFields<"timePhase">>>("timePhase", "시간대에 따라 등장", {
    phase: choices(TIME_PHASES, "아침, 낮, 저녁, 밤 중 한 시간대입니다. 생략하면 낮입니다."),
  }, [], (_ctx, { phase = "day" }) => ({ condition: { kind: "timePhase", phase }, clause: `시간대가 ${timePhaseLabel(phase)}일 때` })),
  pageCondition<"season", Partial<ConditionFields<"season">>>("season", "계절에 따라 등장", {
    season: choices(SEASONS, "봄, 여름, 가을, 겨울 중 한 계절입니다. 생략하면 봄입니다."),
  }, [], (_ctx, { season = "spring" }) => ({ condition: { kind: "season", season }, clause: `${seasonLabel(season)}일 때` })),
  pageCondition<"weekday", Partial<ConditionFields<"weekday">>>("weekday", "요일에 따라 등장", {
    weekdays: { type: "array", items: count(0, 6, "일요일은 0, 월요일은 1, 토요일은 6입니다."), minItems: 1, maxItems: 7,
      description: "등장하는 요일의 목록입니다. 생략하면 토요일과 일요일입니다." },
  }, [], (_ctx, { weekdays = [0, 6] }) => {
    const days = [...new Set(weekdays)].sort((a, b) => a - b);
    return {
      condition: { kind: "weekday", weekdays: days },
      clause: `${days.length === 7 ? "모든 요일" : days.map((day) => `${WEEKDAY_LABELS[day]}요일`).join("·")}일 때`,
    };
  }),
  pageCondition<"npcActivity", Partial<ConditionFields<"npcActivity">>>("npcActivity", "인물 활동에 따라 등장", {
    activity: wording("이 이벤트의 일정에 적힌 활동입니다. 생략하면 일입니다."),
  }, [], (_ctx, { activity = "work" }) => {
    const key = nonempty(activity, "확인할 활동을 입력해 주세요.");
    const name = Object.hasOwn(ACTIVITY_LABELS, key) ? ACTIVITY_LABELS[key] : conditionLabel(key, "", "선택한 활동");
    return { condition: { kind: "npcActivity", activity: key }, clause: `이 인물의 활동이 「${name}」일 때` };
  }),
  pageCondition<"insideLocation", { locationId: string; inside?: boolean; eventId?: string }>("insideLocation", "구역 안팎에 따라 등장", {
    locationId: wording("선택한 맵에서 확인할 구역의 식별자입니다."),
    inside: yesNo("참이면 구역 안, 거짓이면 구역 밖입니다. 생략하면 구역 안입니다."),
    eventId: wording("위치를 확인할 같은 맵의 이벤트 식별자입니다. 생략하면 주인공의 위치를 봅니다."),
  }, ["locationId"], ({ map }, { locationId, eventId, inside = true }) => {
    const where = localLocationName(map, locationId);
    const subject = eventId === undefined ? "주인공이" : `「${localEventName(map, eventId, "선택한 이벤트")}」 이벤트가`;
    return {
      condition: { kind: "insideLocation", locationId, inside, ...(eventId === undefined ? {} : { eventId }) },
      clause: `${subject} 「${where}」 ${inside ? "안" : "밖"}에 있을 때`,
    };
  }),
  pageCondition<"friendshipAtLeast", Partial<ConditionFields<"friendshipAtLeast">>>("friendshipAtLeast", "호감도에 따라 등장", {
    npcKey: wording("호감도를 확인할 인물의 식별자입니다. 생략하면 이 이벤트에 연결된 인물입니다."),
    value: count(FRIENDSHIP_MIN, FRIENDSHIP_MAX, "최소 호감도입니다. 생략하면 100입니다."),
  }, [], (ctx, { npcKey, value = 100 }) => {
    const key = npcKey === undefined ? undefined : nonempty(npcKey, "호감도를 확인할 인물을 지정해 주세요.");
    const who = socialName(ctx, key);
    return {
      condition: { kind: "friendshipAtLeast", value, ...(key === undefined ? {} : { npcKey: key }) },
      clause: `「${who}」의 호감도가 ${value} 이상일 때`,
    };
  }),
  pageCondition<"relationshipAtLeast", Partial<ConditionFields<"relationshipAtLeast">>>("relationshipAtLeast", "관계 단계에 따라 등장", {
    npcKey: wording("관계를 확인할 인물의 식별자입니다. 생략하면 이 이벤트에 연결된 인물입니다."),
    state: choices(RELATIONSHIP_STATES, "최소 관계 단계입니다. 미혼, 연애 중, 약혼, 결혼 중 하나이며 생략하면 연애 중입니다."),
  }, [], (ctx, { npcKey, state = "dating" }) => {
    const key = npcKey === undefined ? undefined : nonempty(npcKey, "관계를 확인할 인물을 지정해 주세요.");
    const who = socialName(ctx, key);
    return {
      condition: { kind: "relationshipAtLeast", state, ...(key === undefined ? {} : { npcKey: key }) },
      clause: `「${who}」${josa(who, "와/과")}의 관계가 ${relationshipStateName(state)} 이상일 때`,
    };
  }),
  pageCondition<"battleResult", Partial<ConditionFields<"battleResult">>>("battleResult", "전투 결과에 따라 등장", {
    result: choices(Object.keys(BATTLE_RESULTS), "마지막 전투의 승리, 패배, 도망 중 하나입니다. 생략하면 승리입니다."),
  }, [], (_ctx, { result = "victory" }) => ({
    condition: { kind: "battleResult", result }, clause: `마지막 전투에서 ${BATTLE_RESULTS[result]} 때`,
  })),
  pageCondition<"run", RunArgs>("run", "탐험 상태에 따라 등장", {
    query: choices(["active", "floor", "flag", "result"], "탐험 중인지, 몇 층인지, 기록이 켜져 있는지, 어떤 결과인지 고릅니다. 생략하면 탐험 중인지 봅니다."),
    value: { type: ["boolean", "integer"], description: "진행 중 여부와 기록은 참 또는 거짓이며 생략하면 참입니다. 층 조건은 비교할 층 번호를 넣습니다." },
    op: choices(COMPARE_OPS, "층 조건의 비교 방식입니다. 생략하면 이상입니다."),
    flag: wording("기록 조건에서 확인할 탐험 기록의 이름입니다."),
    result: choices(Object.keys(RUN_RESULTS), "결과 조건에서 완료, 실패, 포기 중 하나를 고릅니다."),
  }, [], prepareRun),
  pageCondition<"facing", Partial<ConditionFields<"facing">>>("facing", "바라보는 방향에 따라 등장", {
    subject: choices(["player", "event"], "주인공과 이 이벤트 중 방향을 확인할 쪽입니다. 생략하면 주인공입니다."),
    dir: choices(Object.keys(DIRECTIONS), "위, 아래, 왼쪽, 오른쪽 중 한 방향입니다. 생략하면 위입니다."),
  }, [], (_ctx, { subject = "player", dir = "up" }) => ({
    condition: { kind: "facing", subject, dir },
    clause: `${subject === "player" ? "주인공이" : "이 이벤트가"} ${DIRECTIONS[dir]}을 바라볼 때`,
  })),
  pageCondition<"relativeFacing", Partial<ConditionFields<"relativeFacing">>>("relativeFacing", "시선과 상대 위치에 따라 등장", {
    relation: choices(Object.keys(RELATIONS), "주인공이 이벤트 등 뒤, 이벤트가 주인공 등 뒤, 주인공이 이벤트를 바라봄 중 하나입니다. 생략하면 주인공이 이벤트를 바라보는 경우입니다."),
  }, [], (_ctx, { relation = "playerFacingEvent" }) => ({ condition: { kind: "relativeFacing", relation }, clause: RELATIONS[relation] })),
  pageCondition<"hiding", Partial<ConditionFields<"hiding">>>("hiding", "숨은 상태에 따라 등장", {
    value: yesNo("참이면 주인공이 숨어 있을 때, 거짓이면 숨지 않았을 때입니다. 생략하면 참입니다."),
  }, [], (_ctx, { value = true }) => ({
    condition: { kind: "hiding", value }, clause: `주인공이 ${value ? "숨어 있을" : "숨지 않았을"} 때`,
  })),
  pageCondition<"pursuitActive", Partial<ConditionFields<"pursuitActive">>>("pursuitActive", "추격 상태에 따라 등장", {
    value: yesNo("참이면 추격 중, 거짓이면 추격하지 않는 상태입니다. 생략하면 참입니다."),
    eventId: wording("추격 상태를 확인할 같은 맵의 이벤트 식별자입니다. 생략하면 아무 추격자나 확인합니다."),
  }, [], ({ map }, { eventId, value = true }) => {
    const who = eventId === undefined
      ? value ? "누군가" : "아무도"
      : `「${localEventName(map, eventId, "선택한 추격자")}」 이벤트가`;
    return {
      condition: { kind: "pursuitActive", value, ...(eventId === undefined ? {} : { eventId }) },
      clause: `${who} 주인공을 ${value ? "쫓고 있을" : "쫓지 않을"} 때`,
    };
  }),
  pageCondition<"eventSeesPlayer", Partial<SightArgs>>("eventSeesPlayer", "주인공을 발견하면 등장", {
    eventId: wording("보는 쪽의 같은 맵 이벤트 식별자입니다. 다른 관찰자 조건도 생략하면 이 이벤트가 봅니다."),
    range: count(0, SIGHT_DISTANCE_MAX, "기본 시야 거리이며 단위는 칸입니다. 생략하면 다섯 칸입니다."),
    sameRoom: yesNo("같은 방에서만 봅니다. 생략하면 켜집니다."),
    requireFacing: yesNo("이벤트의 정면에 있는 주인공만 봅니다. 생략하면 켜집니다."),
    hearRange: count(0, SIGHT_DISTANCE_MAX, "소리를 알아차리는 거리이며 단위는 칸입니다. 생략하면 듣지 않습니다."),
    value: yesNo("참이면 주인공을 발견할 때, 거짓이면 발견하지 못할 때입니다. 생략하면 참입니다."),
    watcherCharacterId: wording("보는 쪽을 고를 때 쓸 같은 맵 인물의 식별자입니다."),
    watcherName: wording("보는 쪽의 이벤트 이름에 포함될 말입니다."),
    watcherLocationId: wording("보는 쪽이 서 있어야 하는 같은 맵 구역의 식별자입니다."),
    doorsBlock: yesNo("닫힌 문이 시야를 막는지 정합니다. 생략하면 문이 시야를 막지 않습니다."),
    nightRange: count(0, SIGHT_DISTANCE_MAX, "밤의 시야 거리이며 단위는 칸입니다. 생략하면 기본 거리를 씁니다."),
    darkRange: count(0, SIGHT_DISTANCE_MAX, "어두울 때 시야 거리이며 단위는 칸입니다. 생략하면 조명이 거리에 영향을 주지 않습니다."),
    darkAmbient: { type: "number", minimum: 0, maximum: 1, description: "어둡다고 보는 조명 값입니다. 어두울 때 시야 거리와 함께 지정합니다. 생략하면 0.6입니다." },
  }, [], prepareSight),
  pageCondition<"clearCount", Partial<ConditionFields<"clearCount">>>("clearCount", "클리어 횟수에 따라 등장", {
    op: choices(COMPARE_OPS, "클리어 횟수의 비교 방식입니다. 생략하면 이상입니다."),
    value: count(0, Number.MAX_SAFE_INTEGER, "비교할 클리어 횟수입니다. 생략하면 한 번입니다."),
  }, [], (_ctx, { op = ">=", value = 1 }) => {
    return { condition: { kind: "clearCount", op, value }, clause: `클리어 횟수가 ${comparisonClause(op, `${value}회`)}` };
  }),
  pageCondition<"endingSeen", { endingId: string; value?: boolean }>("endingSeen", "엔딩 기록에 따라 등장", {
    endingId: wording("보았는지 확인할 기존 엔딩의 식별자입니다."),
    value: yesNo("참이면 본 엔딩, 거짓이면 보지 않은 엔딩입니다. 생략하면 참입니다."),
  }, ["endingId"], ({ project }, { endingId, value = true }) => {
    const ending = project.endings?.find((entry) => entry.id === endingId);
    if (!ending) throw new PrimitiveError("조건에 연결할 엔딩을 찾을 수 없습니다.");
    const name = conditionLabel(ending.name, ending.id, "선택한 엔딩");
    return { condition: { kind: "endingSeen", endingId, value }, clause: `「${name}」 엔딩을 ${value ? "봤을" : "아직 보지 않았을"} 때` };
  }),
  pageCondition<"newGamePlus", Partial<ConditionFields<"newGamePlus">>>("newGamePlus", "다시 하기 회차에 따라 등장", {
    value: yesNo("참이면 강하게 다시 하기 회차, 거짓이면 일반 회차입니다. 생략하면 참입니다."),
  }, [], (_ctx, { value = true }) => ({
    condition: { kind: "newGamePlus", value }, clause: value ? "강하게 다시 하기 회차일 때" : "일반 회차일 때",
  })),
  pageCondition<"difficulty", ConditionFields<"difficulty">>("difficulty", "난이도에 따라 등장", {
    difficultyId: wording("확인할 기존 난이도의 식별자입니다."),
  }, ["difficultyId"], ({ project }, { difficultyId }) => {
    const difficulty = difficultiesOf(project.system).find((entry) => entry.id === difficultyId);
    if (!difficulty) throw new PrimitiveError("조건에 연결할 난이도를 찾을 수 없습니다.");
    const name = conditionLabel(difficulty.name, difficulty.id, "선택한 난이도");
    return { condition: { kind: "difficulty", difficultyId }, clause: `난이도가 「${name}」일 때` };
  }),
];
