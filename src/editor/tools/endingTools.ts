import { validateEndingPresentation } from "@/project/io/shapeDatabaseFields";
import type { EndingPresentation } from "@/project/cinematicSettings";
import { BEAT_KIND_INFERRED_WARNING, canonicalizeSayBeatAliases, compileCutscene, CutsceneValidationError, SAY_BEAT_ALIAS_WARNING, withoutEndingBeats, type CutsceneBeat } from "@/editor/cutscene";
import { collectEndingWarnings } from "@/project/endings";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Command, EndingCondition, EndingDef, Project } from "@/project/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import { buildDeadlineEndingEvent, DEADLINE_ENDING_COMMON_EVENT_ID, DEADLINE_ENDING_VARIABLE_ID, ensureHeroineEndings, hasRomanceDeadlineSkeleton, retireGenericHappy } from "@/project/deadlineEnding";
import { ROMANCE_ENDING_HAPPY_AT, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_AT, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID } from "@/project/playableSegmentContract";
import { ANY_FRIENDSHIP_KEY } from "@/project/session";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { CONDITION_SCHEMA, CUTSCENE_BEAT_SCHEMA } from "./schemaShapes";

const VARIABLE_OPS = new Set(["==", ">=", "<=", ">", "<", "!="]);

function commandsTriggerEnding(commands: readonly Command[] | undefined): boolean {
  for (const command of commands ?? []) {
    if (!command || typeof command !== "object") continue;
    if (command.kind === "triggerEnding") return true;
    let nested: readonly (readonly Command[])[] = [];
    try { nested = nestedCommandLists(command); } catch { nested = []; }
    if (nested.some(list => commandsTriggerEnding(list))) return true;
  }
  return false;
}

/**
 * 엔딩을 정의해도 이벤트의 triggerEnding 이 없으면 실행되지 않는다. 등대지기 재시험(2026-09-23)에서
 * 구출 후 대사가 끝나도 게임이 끝나지 않았다 — 정의·호출 중 호출이 빠진 부류라 정의 시점에 알린다.
 */
function projectTriggersEnding(project: Project): boolean {
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (commandsTriggerEnding(event.commands)) return true;
      if ((event.pages ?? []).some(page => commandsTriggerEnding(page.commands))) return true;
    }
  }
  if ((project.commonEvents ?? []).some(common => commandsTriggerEnding(common.commands))) return true;
  return (project.database?.troops ?? []).some(troop =>
    (troop.battleEventPages ?? []).some(page => commandsTriggerEnding(page.commands))
    || troopAfterBattleLists(troop).some(list => commandsTriggerEnding(list.commands)));
}

/** endingId 를 지정해 이 엔딩을 직접 부르는 triggerEnding 이 프로젝트에 있는가. */
function commandsCallEndingId(commands: readonly Command[] | undefined, endingId: string): boolean {
  for (const command of commands ?? []) {
    if (!command || typeof command !== "object") continue;
    if (command.kind === "triggerEnding" && command.endingId === endingId) return true;
    let nested: readonly (readonly Command[])[] = [];
    try { nested = nestedCommandLists(command); } catch { nested = []; }
    if (nested.some(list => commandsCallEndingId(list, endingId))) return true;
  }
  return false;
}

/** endingId 없는 triggerEnding — 조건으로 엔딩을 고르므로 모든 조건 엔딩이 이 경로로 열릴 수 있다. */
function projectHasBareTriggerEnding(project: Project): boolean {
  const bare = (commands: readonly Command[] | undefined): boolean =>
    (commands ?? []).some((command) => {
      if (!command || typeof command !== "object") return false;
      if (command.kind === "triggerEnding" && !command.endingId) return true;
      let nested: readonly (readonly Command[])[] = [];
      try { nested = nestedCommandLists(command); } catch { nested = []; }
      return nested.some(bare);
    });
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (bare(event.commands) || (event.pages ?? []).some(page => bare(page.commands))) return true;
    }
  }
  if ((project.commonEvents ?? []).some(common => bare(common.commands))) return true;
  return (project.database?.troops ?? []).some(troop =>
    (troop.battleEventPages ?? []).some(page => bare(page.commands))
    || troopAfterBattleLists(troop).some(list => bare(list.commands)));
}

/** 이 특정 엔딩 id 를 부르는 곳이 있는가(직접 호출 또는 조건 선택형 bare 호출). */
function endingIsReachable(project: Project, endingId: string): boolean {
  if (projectHasBareTriggerEnding(project)) return true;
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (commandsCallEndingId(event.commands, endingId)) return true;
      if ((event.pages ?? []).some(page => commandsCallEndingId(page.commands, endingId))) return true;
    }
  }
  if ((project.commonEvents ?? []).some(common => commandsCallEndingId(common.commands, endingId))) return true;
  return (project.database?.troops ?? []).some(troop =>
    (troop.battleEventPages ?? []).some(page => commandsCallEndingId(page.commands, endingId))
    || troopAfterBattleLists(troop).some(list => commandsCallEndingId(list.commands, endingId)));
}

const ENDING_CONDITION_SCHEMA: JsonSchema = {
  ...CONDITION_SCHEMA,
  properties: {
    ...CONDITION_SCHEMA.properties,
    kind: { type: "string", enum: [...new Set([...(CONDITION_SCHEMA.properties?.kind?.enum ?? []), "newGamePlus"])] },
  },
};

const defineEnding: ToolDefinition = {
  name: "define_ending",
  description:
    '엔딩 정의만 저장한다. define_ending이나 setSwitch만으로는 실행되지 않는다. ' +
    '도달 가능한 이벤트 commands에 {"kind":"triggerEnding","endingId":"조회한 엔딩 id"}를 넣으면 그 엔딩을 실행한다. ' +
    '그 엔딩에 conditions가 있으면 호출 시점에도 검사한다 — 거짓이면 엔딩은 열리지 않고 다음 명령으로 넘어간다(호감 부족 고백이 성공으로 끝나면 안 된다). 조건이 없으면 바로 실행된다. ' +
    'endingId 없는 {"kind":"triggerEnding"}은 switch/variable conditions를 만족한 엔딩 중 priority가 가장 높은 항목을 선택한다. ' +
    'epilogue는 script_cutscene beat 배열이다. 아이템을 소비하는 출구는 완료 스위치로 선택되는 상위 페이지를 두어 재조사 시 재잠김·중복 소비를 막는다. ' +
    '정의 후 연결 전은 유효한 중간 편집이지만, 완료 전에는 실제 에필로그·종료와 재조사를 플레이로 검증해야 한다.',
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      conditions: {
        type: "array",
        description: 'switch/variable/friendshipAtLeast({kind:"friendshipAtLeast",npcKey,value}) 조건. 강하게 다시 하기 회차만(또는 첫 회차만) 여는 엔딩은 {"kind":"newGamePlus","value":true|false}.',
        items: ENDING_CONDITION_SCHEMA,
      },
      priority: { type: "integer", description: "높을수록 우선. 기본 0" },
      presentation: {
        type: "object", additionalProperties: false,
        description: "에필로그 뒤의 마지막 화면. credits는 줄바꿈을 유지하는 크레딧. tone은 warm 또는 dark.",
        properties: { musicResourceId: { type: "string" }, tone: { type: "string", enum: ["warm", "dark"] }, credits: { type: "string", maxLength: 20000 }, kicker: { type: "string", maxLength: 24, description: "제목 위 작은 줄. 비우면 연애 게임은 '두 사람의 이야기'" }, badge: { type: "string", maxLength: 40, description: "엔딩 CG 위 배지. 비우면 게임 언어로 HAPPY ENDING·다음 이야기에 계속 등을 고른다" }, finalTitle: { type: "string", maxLength: 40, description: "마지막 장의 큰 글자. 비우면 '끝', 막·장 끝(id 에 act1·chapter2)은 '제1막 끝' — 게임 언어" }, backgroundResourceId: { type: "string" } },
      },
      epilogue: { type: "array", description: "CutsceneBeat[]", items: CUTSCENE_BEAT_SCHEMA },
    },
    required: ["id", "name", "conditions"],
  },
  invalidArgsExample: {
    id: "ending_true",
    name: "진 엔딩",
    priority: 10,
    conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
    epilogue: [{ kind: "say", speaker: "나", text: "문이 열렸다." }],
  },
  run(draft, args): ToolExecResult {
    const id = cleanId(args.id);
    const name = cleanName(args.name);
    const flagWarnings: string[] = [];
    const conditions = parseEndingConditions(draft, args.conditions, flagWarnings);
    const priority = typeof args.priority === "number" ? Math.trunc(args.priority) : 0;
    const epilogueWarnings: string[] = [];
    const epilogue = parseEpilogue(draft, args.epilogue, epilogueWarnings);
    const prior = draft.endings?.find(entry => entry.id === id);
    let presentation = args.presentation === undefined ? prior?.presentation : args.presentation as EndingPresentation;
    // 크레딧·엔딩 글에 줄바꿈을 글자 「\n」로 두 번 이스케이프해 보내면 화면에 「\n」이 그대로 찍혔다(2026-10-25 G50·심판 J2).
    if (presentation && typeof presentation.credits === "string" && /(?:\\r)?\\n/u.test(presentation.credits)) presentation = { ...presentation, credits: presentation.credits.replace(/(?:\\r)?\\n/gu, "\n") };
    if (presentation !== undefined) {
      try { validateEndingPresentation(presentation); } catch (error) { throw new ToolError(String(error), { code: "invalid-args" }); }
      if (presentation.musicResourceId && !collectResourceIds(draft).has(presentation.musicResourceId)) throw new ToolError("엔딩 음악 리소스를 찾을 수 없습니다.", { code: "invalid-args" });
      if (presentation.backgroundResourceId && !collectResourceIds(draft).has(presentation.backgroundResourceId)) throw new ToolError("엔딩 배경 리소스를 찾을 수 없습니다.", { code: "invalid-args" });
    }
    const ending: EndingDef = {
      id,
      name,
      conditions,
      priority,
      ...(epilogue ? { epilogue } : {}),
      ...(presentation ? { presentation: structuredClone(presentation) } : {}),
    };
    draft.endings ??= [];
    const index = draft.endings.findIndex((entry) => entry.id === id);
    if (index >= 0) draft.endings[index] = ending;
    else draft.endings.push(ending);
    const warnings = [
      ...flagWarnings,
      ...epilogueWarnings,
      // priority 는 endingId 없는 triggerEnding 만 가른다 — 이름으로 부르는 엔딩(연애·기한)에는 「가려집니다」 경고가 소음이다.
      ...collectEndingWarnings(draft.endings, { priorityMatters: projectHasBareTriggerEnding(draft) }),
      ...(projectTriggersEnding(draft) ? [] : [
        "아직 어떤 이벤트도 triggerEnding 을 부르지 않습니다 — 마지막 사건(보스 승리 후 대화 등)의 commands 끝에 "
          + `{kind:"triggerEnding",endingId:"${id}"} 를 넣어야 이 엔딩이 실행됩니다.`
          + (conditions.length > 0 ? " 호출할 때도 위 조건이 참이어야 엔딩이 열립니다." : ""),
      ]),
      // 다른 엔딩은 연결됐는데 이 엔딩만 부르는 곳이 없으면(2026-09-24 연애 도그푸딩 r1·r3 실측:
      // 정의 후 전부 연결하면서 배드 엔딩만 빠졌다) 정의 시점에 그 사실을 알린다. 막지 않는다.
      ...(endingIsReachable(draft, id) ? [] : [
        `정의한 엔딩 '${name}'(${id}) 을 부르는 triggerEnding 이 아직 없습니다 — 이대로면 그 결말을 볼 수 없습니다. `
          + `실패·거절 분기나 마지막 사건 commands 에 {kind:"triggerEnding",endingId:"${id}"} 를 넣으세요. `
          + `endingId 없는 triggerEnding 으로 조건 선택형을 쓰면 조건이 맞는 때 자동으로 열립니다.`,
      ]),
    ];
    return {
      summary: `엔딩 '${name}' 정의 ${index >= 0 ? "수정" : "추가"} — 조건 ${conditions.length}개, priority ${priority}. 이벤트 commands의 triggerEnding 호출이 있어야 실행됩니다.`,
      data: { ending, warnings },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export { DEADLINE_ENDING_COMMON_EVENT_ID, DEADLINE_ENDING_VARIABLE_ID };

/**
 * 「N일 뒤 결말」 한 줄 경로(2026-10-16 연애 감사). 지금까지는 시간 시스템 → 변수 → 공통 이벤트 → fork → triggerEnding 을
 * 조수가 손으로 이어야 했고, 연애 한 판에서 어느 한 고리가 빠져 기한이 와도 아무 일도 안 일어났다.
 * 하루가 끝날 때(onDayEnd) 지난 날을 세고, N일째가 되면 호감 문턱 순서대로 엔딩을 부른다.
 */
const setDeadlineEnding: ToolDefinition = {
  name: "set_deadline_ending",
  description:
    "N일이 지나면 결말을 정한다(연애·관계 게임의 기한 엔딩). 시간 시스템이 켜져 있어야 한다 — 하루가 끝날 때마다 지난 날을 세고(변수 var_days_elapsed), days 번째 하루가 끝나면 tiers 를 위에서부터 보아 처음 맞는 엔딩을 실행한다. "
    + "tiers 는 호감이 높은 것부터 [{endingId, friendshipAtLeast, characterId?}] 로 적고, 마지막 항목은 friendshipAtLeast 를 생략해 기본 결말로 둔다. "
    + "인물이 여럿이면(다인 연애) 항목마다 characterId 를 줘 「그 사람의 호감이 문턱 이상이면 그 사람과의 결말」 로 적는다 — 위에서부터 처음 맞는 항목이 이기므로 여러 명이 문턱을 넘으면 먼저 적은 인물이 이긴다(그래서 더 아끼는 결말·높은 문턱을 위에 둔다). "
    + `characterId 를 「${ANY_FRIENDSHIP_KEY}」 로 주면 「가장 호감이 높은 사람」 기준이다(인물이 아직 없을 때·인물 무관 평범/혼자 결말). `
    + `tiers 를 생략하면(호감 대화 인물이 둘 이상이면 인물마다 「OO와 함께」 엔딩을 자동으로 만들어 맨 위에 얹고) 연애 뼈대의 엔딩(${ROMANCE_ENDING_HAPPY_ID} ≥${ROMANCE_ENDING_HAPPY_AT} → ${ROMANCE_ENDING_NORMAL_ID} ≥${ROMANCE_ENDING_NORMAL_AT} → ${SEGMENT_END_ENDING_ID}) 를 그대로 쓴다. 히로인별 결말은 define_ending 으로 먼저 정의한 뒤 tiers 맨 위에 그 인물 항목을 얹는다. `
    + "엔딩은 먼저 define_ending 으로 정의해 둔다(conditions 는 [] 로 둬도 된다 — 호감 문턱은 이 도구가 건다). 이 도구는 공통 이벤트 ce_deadline_ending 을 만들고 system.timeSystem.onDayEnd 로 연결한다. "
    + "이미 다른 onDayEnd 공통 이벤트가 있으면 그것을 먼저 부르고 이어서 기한 판정을 한다. 같은 호출을 다시 하면 갱신한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      days: { type: "integer", description: "결말이 나는 날 수(1 이상). 시작일을 1일째로 세어, days 번째 하루가 끝날 때 판정한다." },
      characterId: { type: "string", description: `호감을 읽을 기본 인물 키(place_npc/make_villager 의 characterId, 「${ANY_FRIENDSHIP_KEY}」=가장 호감 높은 사람). 한 사람 기준이면 여기에 한 번만 적는다. 다인이면 tiers[].characterId 로 항목마다 적는다.` },
      tiers: {
        type: "array",
        description: "위에서부터 처음 맞는 것이 실행된다. 마지막 항목은 friendshipAtLeast 없이 기본 결말. 생략하면 연애 뼈대의 해피·평범·혼자 세 엔딩.",
        items: {
          type: "object",
          properties: {
            endingId: { type: "string", description: "define_ending 으로 만든 엔딩 id" },
            friendshipAtLeast: { type: "integer", description: "이 호감 이상이면 이 엔딩. 생략하면 항상 맞는 기본 결말" },
            characterId: { type: "string", description: "이 항목이 호감을 읽을 인물(생략하면 상위 characterId). 다인 연애에서 인물마다 다른 결말을 줄 때." },
          },
          required: ["endingId"],
        },
      },
    },
    required: ["days"],
  },
  invalidArgsExample: {
    days: 7,
    characterId: "char_narae",
    tiers: [{ endingId: "ending_good", friendshipAtLeast: 60 }, { endingId: "ending_normal", friendshipAtLeast: 30 }, { endingId: "ending_bad" }],
  },
  run(draft, args): ToolExecResult {
    const days = typeof args.days === "number" && Number.isInteger(args.days) && args.days >= 1 ? args.days : undefined;
    if (days === undefined) throw new ToolError("days 는 1 이상의 정수여야 합니다.", { code: "invalid-args" });
    if (!draft.system.timeSystem?.enabled) {
      throw new ToolError("시간 시스템이 꺼져 있어 기한을 셀 수 없습니다 — configure_time_system({enabled:true}) 를 먼저 부르세요.", { code: "time-system-required" });
    }
    const skeletonTiersAll = [
      { endingId: ROMANCE_ENDING_HAPPY_ID, friendshipAtLeast: ROMANCE_ENDING_HAPPY_AT, characterId: ANY_FRIENDSHIP_KEY },
      { endingId: ROMANCE_ENDING_NORMAL_ID, friendshipAtLeast: ROMANCE_ENDING_NORMAL_AT, characterId: ANY_FRIENDSHIP_KEY },
      { endingId: SEGMENT_END_ENDING_ID },
    ];
    // tiers 를 생략했는데 호감 대화 인물이 둘 이상이면 인물마다 엔딩을 만들어 맨 위에 얹는다(romance-loop-2 rom-c: 인물 3명인데 엔딩은 호감 구간뿐이었다).
    const heroine = args.tiers === undefined && hasRomanceDeadlineSkeleton(draft)
      ? ensureHeroineEndings(draft) : { tiers: [], generated: [] as string[], heroines: 0 };
    // 인물 엔딩이 들어서면 같은 문턱의 일반 해피는 닿을 수 없는 죽은 엔딩이다 — 기한 판정에서 뺀다(정의는 판정을 심은 뒤에 지운다).
    const skeletonTiers = heroine.tiers.length > 0 ? skeletonTiersAll.filter((tier) => tier.endingId !== ROMANCE_ENDING_HAPPY_ID) : skeletonTiersAll;
    const generated = heroine.generated;
    const heroineTiers = heroine.tiers.map((tier) => ({ endingId: tier.endingId, friendshipAtLeast: tier.threshold!, characterId: tier.characterId! }));
    const tiers = Array.isArray(args.tiers) ? args.tiers as { endingId?: unknown; friendshipAtLeast?: unknown; characterId?: unknown }[]
      : args.tiers === undefined && hasRomanceDeadlineSkeleton(draft)
        ? [...heroineTiers, ...skeletonTiers] : [];
    if (tiers.length === 0) throw new ToolError("tiers 에 엔딩이 하나 이상 있어야 합니다.", { code: "invalid-args" });
    const characterId = typeof args.characterId === "string" && args.characterId.trim() ? args.characterId.trim() : undefined;
    const known = new Set((draft.endings ?? []).map((ending) => ending.id));
    const resolved = tiers.map((tier, index) => {
      const endingId = typeof tier?.endingId === "string" ? tier.endingId.trim() : "";
      if (!endingId || !known.has(endingId)) {
        throw new ToolError(`tiers[${index}].endingId '${endingId}' 인 엔딩이 없습니다 — define_ending 으로 먼저 정의하세요. 있는 엔딩: ${[...known].join(", ") || "없음"}`, { code: "ending-not-found" });
      }
      const threshold = tier.friendshipAtLeast;
      if (threshold !== undefined && (typeof threshold !== "number" || !Number.isFinite(threshold))) {
        throw new ToolError(`tiers[${index}].friendshipAtLeast 는 숫자여야 합니다.`, { code: "invalid-args" });
      }
      const tierCharacter = typeof tier?.characterId === "string" && tier.characterId.trim() ? tier.characterId.trim() : characterId;
      if (threshold !== undefined && !tierCharacter) {
        throw new ToolError(`tiers[${index}] 에 friendshipAtLeast 를 쓰려면 호감을 읽을 characterId 가 필요합니다 — 상위 characterId 또는 tiers[${index}].characterId 를 주세요.`, { code: "invalid-args" });
      }
      return { endingId, threshold: threshold === undefined ? undefined : Math.trunc(threshold as number), characterId: tierCharacter };
    });
    const last = resolved[resolved.length - 1]!;
    if (last.threshold !== undefined) {
      throw new ToolError("마지막 tiers 항목은 friendshipAtLeast 없이 기본 결말이어야 합니다 — 어느 문턱도 못 넘은 경우 결말이 없어 기한이 와도 게임이 끝나지 않습니다.", { code: "invalid-args" });
    }
    // 기본 결말은 「아무도 안 만난 사람」의 마지막 안전망이다. 그 엔딩에 conditions 가 있으면 triggerEnding(endingId) 이 호출 시점에 조건을 다시 보고
    // 거짓이면 다음 명령으로 넘어가 버려, 기한이 와도 게임이 끝나지 않는다(romance-loop-1 R1 「아무도 안 만남」: 기본 결말 「평범」 이 호감 ≥5 조건을 달고 있었다).
    const lastEnding = (draft.endings ?? []).find((ending) => ending.id === last.endingId);
    if (lastEnding && (lastEnding.conditions?.length ?? 0) > 0) {
      throw new ToolError(
        `기본 결말 '${last.endingId}'(마지막 tiers 항목)에 conditions 가 ${lastEnding.conditions!.length}개 있습니다 — 호출할 때도 조건을 다시 검사하므로, 호감이 낮은(아무도 안 만난) 플레이어는 기한이 와도 엔딩이 열리지 않아 게임이 끝나지 않습니다. `
        + "define_ending 으로 그 엔딩의 conditions 를 [] 로 다시 정의하거나(문턱은 이 도구가 건다), 조건 없는 엔딩(예: 「혼자 보낸 학기」)을 기본 결말로 두세요.",
        { code: "deadline-default-conditioned" },
      );
    }
    for (let index = 0; index < resolved.length - 1; index += 1) {
      if (resolved[index]!.threshold === undefined) {
        throw new ToolError(`tiers[${index}] 는 문턱이 없는데 뒤에 항목이 더 있습니다 — 기본 결말은 마지막에 하나만 둡니다.`, { code: "invalid-args" });
      }
    }
    ensureNamedVariable(draft, DEADLINE_ENDING_VARIABLE_ID, "지난 날");
    const timeSystem = draft.system.timeSystem;
    const previousHook = timeSystem.onDayEnd && timeSystem.onDayEnd !== DEADLINE_ENDING_COMMON_EVENT_ID ? timeSystem.onDayEnd : undefined;
    if (previousHook && !draft.commonEvents.some((event) => event.id === previousHook)) {
      throw new ToolError(`system.timeSystem.onDayEnd '${previousHook}' 인 공통 이벤트가 없습니다.`, { code: "common-event-not-found" });
    }
    const event = buildDeadlineEndingEvent(days, resolved, previousHook);
    const index = draft.commonEvents.findIndex((entry) => entry.id === DEADLINE_ENDING_COMMON_EVENT_ID);
    if (index >= 0) draft.commonEvents[index] = event; else draft.commonEvents.push(event);
    draft.system.timeSystem = { ...timeSystem, onDayEnd: DEADLINE_ENDING_COMMON_EVENT_ID };
    const retiredHappy = args.tiers === undefined && heroine.tiers.length > 0 && retireGenericHappy(draft);
    const warnings = [
      ...(retiredHappy ? [`일반 해피 엔딩 ${ROMANCE_ENDING_HAPPY_ID} 는 인물별 엔딩과 같은 문턱이라 닿을 수 없어 지웠습니다 — 인물 엔딩이 그 자리를 대신합니다.`] : []),
      ...(generated.length ? [`인물 엔딩 ${generated.join(", ")} 을(를) 기본 문구로 만들었습니다 — define_ending 으로 같은 id 의 에필로그를 그 인물에 맞게 다시 쓰세요(문턱은 이 도구가 건 호감 ${ROMANCE_ENDING_HAPPY_AT}).`] : []),
      ...(previousHook ? [`기존 onDayEnd '${previousHook}' 는 기한 판정 앞에서 먼저 실행하도록 이었습니다.`] : []),
      ...(timeSystem.forceSleep === true ? [] : ["forceSleep 이 꺼져 있으면 플레이어가 자지 않는 한 하루가 끝나지 않아 기한이 오지 않습니다 — 연애 게임은 하루 칸을 다 쓰면 자동으로 하루가 끝나도록 forceSleep 을 켜거나 잠자리 이벤트(sleepUntilMorning)를 두세요."]),
    ];
    return {
      summary: `${days}일째 하루가 끝날 때 결말 판정(${resolved.map((tier) => `${tier.endingId}${tier.threshold === undefined ? "(기본)" : `${tier.characterId && tier.characterId !== characterId ? ` ${tier.characterId}` : ""}≥${tier.threshold}`}`).join(" → ")}) — 공통 이벤트 ${DEADLINE_ENDING_COMMON_EVENT_ID}, onDayEnd 연결`,
      data: { commonEventId: DEADLINE_ENDING_COMMON_EVENT_ID, variableId: DEADLINE_ENDING_VARIABLE_ID, days, tiers: resolved },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

const listEndings: ToolDefinition = {
  name: "list_endings",
  description: "프로젝트 엔딩 레지스트리를 나열하고 조건 충돌/priority 그림자 warning을 함께 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {},
  },
  run(project): ToolExecResult {
    const endings = project.endings ?? [];
    const warnings = collectEndingWarnings(endings, { priorityMatters: projectHasBareTriggerEnding(project) });
    return {
      summary: `엔딩 ${endings.length}개`,
      data: { endings, warnings },
    };
  },
};

function cleanId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError("id(문자열)가 필요합니다.", { code: "ending-id" });
  return value.trim();
}

function cleanName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError("name(문자열)가 필요합니다.", { code: "ending-name" });
  return value.trim();
}

function parseEndingConditions(project: Project, value: unknown, warnings: string[]): EndingCondition[] {
  if (!Array.isArray(value)) throw new ToolError("conditions는 switch/variable/newGamePlus 조건 배열이어야 합니다.", { code: "ending-conditions" });
  return value.map((entry, index) => parseEndingCondition(project, entry, index, warnings));
}

function parseEndingCondition(project: Project, value: unknown, index: number, warnings: string[]): EndingCondition {
  // 강하게 다시 하기 판정 — 트리거 시점에 이번 회차가 NG+ 인지 본다. 일반 조건 목록(CONDITION_KINDS)에는 없다.
  if (typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "newGamePlus") {
    const flag = (value as { value?: unknown }).value;
    if (typeof flag !== "boolean") {
      throw new ToolError(`conditions[${index}].value는 boolean이어야 합니다(newGamePlus).`, { code: "ending-condition-shape" });
    }
    return { kind: "newGamePlus", value: flag };
  }
  try {
    validateConditionShape(`conditions[${index}]`, value);
  } catch (cause) {
    throw new ToolError(`conditions[${index}] 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "ending-condition-shape",
    });
  }
  const condition = value as EndingCondition;
  if (condition.kind !== "switch" && condition.kind !== "variable" && condition.kind !== "friendshipAtLeast") {
    throw new ToolError(`conditions[${index}]는 switch, variable, friendshipAtLeast 또는 newGamePlus 조건이어야 합니다.`, { code: "ending-condition-kind" });
  }
  if (condition.kind === "friendshipAtLeast" && !condition.npcKey?.trim()) {
    throw new ToolError(`conditions[${index}] friendshipAtLeast 엔딩 조건에는 npcKey(characterId)가 필요합니다 — 엔딩은 이벤트 밖에서도 판정돼 「이 NPC」 를 가리킬 수 없습니다.`, { code: "ending-condition-shape" });
  }
  // 아직 없는 플래그를 참조하면 만들어 준다. 엔딩 조건은 보통 "앞으로 켜질" 플래그를 가리키므로
  // 존재 여부로 막으면 순서 교착이 생긴다(2026-08-23 실측: 존재하지 않는 sw_clear 로 define_ending 거부).
  // create_quest/compile_puzzle 이 쓰는 ensureNamed* 와 같은 방침이다.
  if (condition.kind === "switch" && !project.switches.some((entry) => entry.id === condition.switchId)) {
    ensureNamedSwitch(project, condition.switchId, `엔딩 조건: ${condition.switchId}`);
    warnings.push(`conditions[${index}].switchId '${condition.switchId}' 가 없어 새로 만들었습니다.`);
  }
  if (condition.kind === "variable") {
    if (!project.variables.some((entry) => entry.id === condition.variableId)) {
      ensureNamedVariable(project, condition.variableId, `엔딩 조건: ${condition.variableId}`);
      warnings.push(`conditions[${index}].variableId '${condition.variableId}' 가 없어 새로 만들었습니다.`);
    }
    if (!VARIABLE_OPS.has(condition.op)) {
      throw new ToolError(
        `conditions[${index}].op가 잘못되었습니다: ${condition.op}. 허용: ${[...VARIABLE_OPS].join(", ")}`,
        { code: "ending-variable-op" },
      );
    }
  }
  return structuredClone(condition);
}

function parseEpilogue(project: Project, value: unknown, warnings: string[] = []): Record<string, unknown>[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError("epilogue는 beat 배열이어야 합니다.", { code: "ending-epilogue" });
  const aliased = canonicalizeSayBeatAliases(value);
  if (aliased.moved > 0) warnings.push(SAY_BEAT_ALIAS_WARNING(aliased.moved));
  if (aliased.inferred > 0) warnings.push(BEAT_KIND_INFERRED_WARNING(aliased.inferred));
  const raw = (aliased.beats as unknown[]).map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ToolError(`epilogue[${index}]는 객체여야 합니다.`, { code: "ending-epilogue-beat" });
    }
    return structuredClone(entry) as Record<string, unknown>;
  });
  const { beats: kept, removed } = withoutEndingBeats(raw as unknown as CutsceneBeat[]);
  if (removed > 0) warnings.push(`epilogue 의 ending beat ${removed}개를 뺐다 — 에필로그는 이미 엔딩 안에서 돌고, 끝나면 엔딩 화면이 자동으로 뜬다(다시 부르면 에필로그가 무한 반복된다).`);
  const beats = kept as unknown as Record<string, unknown>[];
  // 에필로그가 암전으로 끝나도 엔딩 화면이 바로 이어지니 «검은 화면에 조작이 돌아오는» 일이 없다 — 컷신 검사는 그래서 거절했다(2026-10-24 g2-two-endings·g3-bad-ending).
  // 검사에만 끝에 fade in 을 덧대 그 규칙을 비켜 간다(저장하는 비트는 그대로).
  const eventIds = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) eventIds.add(event.id);
  }
  try {
    compileCutscene([...beats, { kind: "fade", direction: "in", durationMs: 1 }] as unknown as CutsceneBeat[], { context: { eventIds, resourceIds: collectResourceIds(project) } });
  } catch (cause) {
    if (cause instanceof CutsceneValidationError) {
      throw new ToolError(`epilogue 검증 실패: ${cause.reasons.join(" / ")}`, { code: "ending-epilogue-validation" });
    }
    throw cause;
  }
  return beats;
}

export const ENDING_TOOLS: readonly ToolDefinition[] = [defineEnding, setDeadlineEnding, listEndings];
