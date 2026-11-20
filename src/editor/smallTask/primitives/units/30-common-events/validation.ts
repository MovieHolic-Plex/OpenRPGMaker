import { withOpenEventDrafts, type SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { projectCommonEventReferenceMessage } from "@/editor/databaseReferences";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { newCommand, newM2Command } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { AMOUNT_OPS, VARIABLE_OPS } from "@/editor/eventCommands/schema/catalog";
import { displayText } from "@/editor/smallTask/target";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { changeTileProblems } from "@/project/changeTileValidation";
import { MAX_SHOWN_CHOICES } from "@/project/choiceView";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { equipmentSlots } from "@/project/equipmentSlots";
import { committedEventView, projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { eventDisplayName } from "@/project/eventDisplayName";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { EventCommandEditError } from "@/project/eventCommands/singleCommandOps";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { isPlayerMoveTarget } from "@/project/moveRouteTarget";
import { scriptCalls, scriptHasDynamic } from "@/project/script/effects";
import type { Command, CommonEvent, Condition, GameMap, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "../../errors";
import { scriptCommonEventCalls } from "./scriptCalls";

export function quotedName(name: string, fallback: string): string {
  const label = displayText(name, "").replace(/[{}[\]「」]/gu, "").trim();
  if (!label) return fallback;
  return `「${label.length > 25 ? label.slice(0, 24) + "…" : label}」`;
}

function commonEventCallId(command: Command): string | undefined {
  if (command.kind === "callCommonEvent") return command.commonEventId;
  if (command.kind !== "m2Command") return undefined;
  const parsed = parseM2BattleCommand(command);
  return parsed?.kind === "callCommonEvent" ? parsed.commonEventId.trim() : undefined;
}

type ScriptBody = Pick<Extract<Command, { kind: "script" }>, "compiled" | "effects">;

function usesOpaqueScriptCalls(script: ScriptBody): boolean {
  // The analyzer records direct game.callCommonEvent calls. Aliases, computed
  // methods and nested commands passed to game.cmd may be absent from effects.
  const otherCode = script.compiled.replace(/\bgame\.callCommonEvent\s*\(/gu, "");
  return /\b(?:cmd|callCommonEvent)\b|\bgame\s*\[/u.test(otherCode);
}

export function refuseReferencedRemoval(project: Project, id: string, live?: SmallTaskDraftSource): void {
  const callers = new Set<string>();
  const mayCallDynamically = (script: ScriptBody) =>
    scriptHasDynamic({ ...script, kind: "script" }, "commonEvent", { access: "call", library: project.scriptLibrary });
  let dynamicCall = false;
  const parsedScripts = new Map<string, ReturnType<typeof scriptCommonEventCalls>>();
  const readScript = (script: ScriptBody) => {
    let parsed = parsedScripts.get(script.compiled);
    if (!parsed) {
      parsed = scriptCommonEventCalls(script.compiled);
      parsedScripts.set(script.compiled, parsed);
    }
    dynamicCall ||= parsed.opaque || mayCallDynamically(script);
    return parsed.ids;
  };
  const scan = (source: Project) => visitProjectCommands(source, ({ command, location }) => {
    const scriptIds = command.kind === "script" ? readScript(command) : undefined;
    if (commonEventCallId(command) !== id &&
      !scriptIds?.has(id) && (command.kind !== "script" || !scriptCalls(command, "commonEvent", source).includes(id))) return;
    switch (location.kind) {
      case "commonEvent":
        callers.add(`공용 이벤트 ${quotedName(location.commonEventName === location.commonEventId ? "" : location.commonEventName, "이름 없음")}`);
        break;
      case "troopPage": {
        const troop = quotedName(location.troopName === location.troopId ? "" : location.troopName, "이름 없음");
        const page = quotedName(location.pageName === location.pageId ? "" : location.pageName, "전투 페이지");
        callers.add(`적 그룹 ${troop}의 ${page}`);
        break;
      }
      default: {
        const map = source.maps[location.mapId];
        const event = map?.events.find(row => row.id === location.eventId);
        const name = event ? eventDisplayName(event) : "";
        const mapName = quotedName(location.mapName === location.mapId ? "" : location.mapName, "맵");
        const owner = quotedName(name === location.eventId ? "" : name, "이름 없는 이벤트");
        const page = location.kind === "eventPage" && location.pageName !== location.pageId
          ? quotedName(location.pageName, "") : "";
        callers.add(`${mapName}의 ${owner}${page ? ` ${page} 페이지` : ""}`);
      }
    }
  });
  scan(project);
  const working = withOpenEventDrafts(project, live);
  if (working !== project) scan(working);
  const committed = projectViewWithoutEventDrafts(working);
  if (committed !== project && committed !== working) scan(committed);
  if (callers.size) {
    throw new PrimitiveError(`${[...callers].join(", ")}에서 호출 중이라 공용 이벤트를 지울 수 없습니다.`);
  }

  const { battleCommands, classes, skills } = project.database;
  const command = battleCommands?.find(row => row.commonEventId === id);
  if (command) throw new PrimitiveError(`자료집의 전투 명령 ${quotedName(command.name, "항목")}에서 사용 중이라 공용 이벤트를 지울 수 없습니다.`);
  const owner = classes.find(row => row.battleCommands?.some(entry => entry.commonEventId === id));
  if (owner) throw new PrimitiveError(`직업 ${quotedName(owner.name, "항목")}의 전투 명령에서 사용 중이라 공용 이벤트를 지울 수 없습니다.`);
  const skill = skills.find(row => row.fieldCommonEventId === id);
  if (skill) throw new PrimitiveError(`필드 스킬 ${quotedName(skill.name, "항목")}에서 사용 중이라 공용 이벤트를 지울 수 없습니다.`);

  const reference = projectCommonEventReferenceMessage(working, id);
  if (reference) {
    throw new PrimitiveError(`공용 이벤트를 지울 수 없습니다. ${displayText(reference, "아직 쓰는 곳이 있습니다.").replaceAll("커먼 이벤트", "공용 이벤트")}`);
  }
  if (project.scriptLibrary?.some(module => readScript(module).has(id))) {
    throw new PrimitiveError("공용 스크립트에서 호출 중이라 공용 이벤트를 지울 수 없습니다.");
  }
  if (dynamicCall) {
    throw new PrimitiveError("스크립트에서 이 공용 이벤트를 사용하는지 확인할 수 없습니다. 스크립트의 호출 대상을 먼저 확인해 주세요.");
  }
}

export function editCommands(edit: () => CommonEvent): CommonEvent {
  try {
    return edit();
  } catch (error) {
    if (!(error instanceof EventCommandEditError) || error.code === "stale-event-command") throw error;
    throw new PrimitiveError(/^[가-힣0-9 .]+$/u.test(error.message) ? error.message : "명령에 필요한 값과 형식을 확인해 주세요.");
  }
}

export function commandForInsert(input: Command): Command {
  if (!COMMAND_KINDS.includes(input.kind)) throw new PrimitiveError("추가할 명령의 종류를 확인해 주세요.");
  if (input.kind === "m2Command") {
    if (!input.commandId) throw new PrimitiveError("추가할 기타 명령을 골라 주세요.");
    const defaults = newM2Command(input.commandId);
    const fields = input.fields;
    if (fields === undefined) return defaults;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new PrimitiveError("명령에 필요한 값과 형식을 확인해 주세요.");
    }
    return { ...defaults, ...input, fields: { ...defaults.fields, ...fields } };
  }
  let defaults = newCommand(input.kind);
  if (defaults.kind === "fork") defaults = { ...defaults, then: [] };
  if (defaults.kind === "loop") defaults = { ...defaults, body: [] };
  if (defaults.kind === "ending") defaults = { ...defaults, title: "끝", message: "플레이해 주셔서 감사합니다." };
  return { ...defaults, ...input } as Command;
}

export function validateSingleInsert(command: Command): void {
  if (nestedCommandLists(command).some(branch => branch.length)) {
    throw new PrimitiveError("분기 안의 명령은 해당 줄을 골라 따로 넣어 주세요.");
  }
}

function calledCommandLists(project: Project, command: Command, callerMap?: GameMap): readonly Command[][] {
  // These calls push a new frame on the same interpreter stack. Their jumps can reach the caller's label.
  const commonLists = (eventIds: readonly string[]) =>
    project.commonEvents.filter(event => eventIds.includes(event.id)).map(event => event.commands);
  const commonId = commonEventCallId(command);
  if (commonId !== undefined) return commonLists([commonId]);
  if (command.kind === "runSchedule") {
    const schedule = project.database.schedules?.find(row => row.id === command.scheduleId);
    return schedule ? commonLists(schedule.activities.map(activity => activity.commonEventId)) : [];
  }
  const mapEventIds = command.kind === "callMapEvent" ? [command.eventId]
    : command.kind === "script" ? scriptCalls(command, "event", project) : [];
  const lists: Command[][] = [];
  if (command.kind === "script") lists.push(...commonLists(scriptCalls(command, "commonEvent", project)));
  for (const map of mapEventIds.length ? (callerMap ? [callerMap] : Object.values(project.maps)) : []) {
    for (const event of map.events) {
      if (!mapEventIds.includes(event.id)) continue;
      const committed = committedEventView(event);
      for (const body of callerMap ? [committed] : new Set([event, committed])) {
        if (!body) continue;
        lists.push(body.commands, ...(body.pages ?? []).map(page => page.commands));
      }
    }
  }
  return lists;
}

function callerHasLabel(project: Project, map: GameMap, event: CommonEvent, name: string): boolean {
  const seenWithLabel = new Set<readonly Command[]>();
  const seenWithoutLabel = new Set<readonly Command[]>();
  const visit = (list: readonly Command[], inherited: boolean): boolean => {
    const hasLabel = inherited || list.some(row => row.kind === "label" && row.name === name);
    const seen = hasLabel ? seenWithLabel : seenWithoutLabel;
    if (seen.has(list)) return false;
    seen.add(list);
    return list.some(command => {
      if (hasLabel && commonEventCallId(command) === event.id) return true;
      const calls = command.kind === "callMapEvent" || commonEventCallId(command) !== undefined
        ? calledCommandLists(project, command, map) : [];
      return [...nestedCommandLists(command), ...calls].some(child => visit(child, hasLabel));
    });
  };
  return map.events.some(row => {
    const saved = committedEventView(row);
    return saved && (saved.pages?.length ? saved.pages.some(page => visit(page.commands, false)) : visit(saved.commands, false));
  });
}

function scriptMayJumpToLabel(project: Project, command: Extract<Command, { kind: "script" }>): boolean {
  if (usesOpaqueScriptCalls(command) ||
    (["commonEvent", "event"] as const).some(kind =>
      scriptHasDynamic(command, kind, { access: "call", library: project.scriptLibrary }))) return true;
  const imports = new Set(scriptCalls(command, "library", project));
  return project.scriptLibrary?.some(module => imports.has(module.id) && usesOpaqueScriptCalls(module)) ?? false;
}

function projectHasLabel(project: Project, name: string): boolean {
  let found = false;
  visitProjectCommands(project, ({ command }) => {
    if (command.kind === "label" && command.name === name) found = true;
  });
  return found;
}

function usesLabel(project: Project, commands: readonly Command[], name: string, hasDestination = () => true): boolean {
  const seen = new Set<readonly Command[]>();
  let mayRedirectOpaqueJump: boolean | undefined;
  const visit = (list: readonly Command[]): boolean => {
    if (seen.has(list)) return false;
    seen.add(list);
    return list.some(command => (command.kind === "gotoLabel" && command.name === name) ||
      (command.kind === "script" && scriptMayJumpToLabel(project, command) && (mayRedirectOpaqueJump ??= hasDestination())) ||
      [...nestedCommandLists(command), ...calledCommandLists(project, command)].some(child =>
        !child.some(row => row.kind === "label" && row.name === name) && visit(child),
      ));
  };
  return visit(commands);
}

export function validateLabelEdit(
  project: Project, map: GameMap, event: CommonEvent, after: Command[], path: number[], current?: Command, next?: Command,
): void {
  const before = event.commands;
  if (current?.kind === "label" && (next?.kind !== "label" || current.name !== next.name)) {
    const list = resolveCommandListAtPath(before, path)!;
    if (list.find(row => row.kind === "label" && row.name === current.name) === current && usesLabel(project, list, current.name)) {
      throw new PrimitiveError("이 라벨로 이동하는 명령이 있어 이름을 바꾸거나 지울 수 없습니다.");
    }
  }
  if (next?.kind === "label" && (current?.kind !== "label" || current.name !== next.name)) {
    const list = resolveCommandListAtPath(after, path)!;
    if (list.some(row => row !== next && row.kind === "label" && row.name === next.name)) {
      throw new PrimitiveError("같은 목록에 이 이름의 라벨이 이미 있습니다.");
    }
    // A jump can leave this command list and reach a label in a caller's frame.
    const previous = resolveCommandListAtPath(before, path);
    if (previous && usesLabel(project, previous, next.name, () => projectHasLabel(project, next.name))) {
      throw new PrimitiveError("이 이름을 쓰면 기존 이동 명령이 다른 라벨로 이동합니다. 다른 이름을 골라 주세요.");
    }
  }
  if (next?.kind === "gotoLabel" && (current?.kind !== "gotoLabel" || current.name !== next.name)) {
    for (let end = path.length; end > 0; end -= 2) {
      const list = resolveCommandListAtPath(after, path.slice(0, end));
      if (list?.some(row => row.kind === "label" && row.name === next.name)) return;
    }
    if (!callerHasLabel(project, map, event, next.name)) throw new PrimitiveError("이 줄에서 이동할 라벨을 찾을 수 없습니다.");
  }
}

function ids(records: readonly { readonly id: string }[] = []): Set<string> {
  return new Set(records.map(record => record.id));
}

function validateScriptEdit(command: Extract<Command, { kind: "script" }>, current?: Command): void {
  const withoutName = ({ name: _name, ...body }: typeof command) => body;
  const previous = current?.kind === "script" ? current : { kind: "script" as const, source: "", compiled: "" };
  if (!jsonEqual(withoutName(command), withoutName(previous))) {
    throw new PrimitiveError("스크립트 코드는 스크립트 편집기에서 작성하거나 고쳐 주세요.");
  }
}

function validateM2Edit(command: Extract<Command, { kind: "m2Command" }>, current?: Command): void {
  if (current?.kind === "m2Command" && current.commandId !== command.commandId) {
    throw new PrimitiveError("한 줄을 고칠 때 명령 종류는 바꿀 수 없습니다.");
  }
  for (const { key, min, max } of m2CommandById(command.commandId)?.fields ?? []) {
    const value = command.fields[key];
    if (value === undefined || (current?.kind === "m2Command" && current.fields[key] === value)) continue;
    if ((min !== undefined && Number(value) < min) || (max !== undefined && Number(value) > max)) {
      throw new PrimitiveError("기타 명령에서 입력할 수 있는 숫자 범위를 확인해 주세요.");
    }
  }
}

function validateCommandInput(project: Project, map: GameMap, command: Command, current?: Command): void {
  if (command.kind === "m2Command") {
    validateM2Edit(command, current);
    const id = commonEventCallId(command);
    if (id !== undefined && !project.commonEvents.some(row => row.id === id)) {
      throw new PrimitiveError("호출할 공용 이벤트를 찾을 수 없습니다.");
    }
  }
  if (command.kind === "script") validateScriptEdit(command, current);
  if (command.kind === "text" && !command.body.trim()) throw new PrimitiveError("표시할 문장을 입력해 주세요.");
  if (command.kind === "choices" && command.prompt !== undefined && typeof command.prompt !== "string") {
    throw new PrimitiveError("선택지를 물어볼 문장을 글자로 입력해 주세요.");
  }
  if (command.kind === "choices" && (
    command.options.length === 0 || command.options.some(option => !option.text.trim()) ||
    (command.options.length > MAX_SHOWN_CHOICES && !(current?.kind === "choices" && current.options.length === command.options.length))
  )) throw new PrimitiveError(`문구가 있는 선택지를 1개부터 ${MAX_SHOWN_CHOICES}개까지 넣어 주세요.`);
  if ((command.kind === "wait" || command.kind === "inputWait") && command.variableId !== undefined &&
    typeof command.variableId !== "string") throw new PrimitiveError("대기에 사용할 변수를 골라 주세요.");
  if ((command.kind === "wait" || command.kind === "inputWait") && command.variableId
    && !project.variables.some(row => row.id === command.variableId)) {
    throw new PrimitiveError("대기에 사용할 변수를 찾을 수 없습니다.");
  }
  if (command.kind === "setVariable") {
    if (!VARIABLE_OPS.includes(command.op)) throw new PrimitiveError("변수에 값을 넣거나 더하고 빼는 등 계산 방식을 골라 주세요.");
    if (command.op === "/=" && command.value === 0) throw new PrimitiveError("0으로 나눌 수 없습니다.");
  }
  if ((command.kind === "changeGold" || command.kind === "changeItem") && !AMOUNT_OPS.includes(command.op)) {
    throw new PrimitiveError("수량을 정할지, 더할지, 뺄지 골라 주세요.");
  }
  if (command.kind === "changeParty") {
    if (!["add", "remove", "lead"].includes(command.action)) throw new PrimitiveError("파티 합류, 이탈, 선두 교대 중 하나를 골라 주세요.");
    if (!project.database.actors.some(actor => actor.id === command.actorId)) throw new PrimitiveError("파티를 편성할 배우를 찾을 수 없습니다.");
  }
  if (command.kind === "battleProcessing" && command.troopSource === "variable" &&
    !project.variables.some(row => row.id === command.troopVariableId)) {
    throw new PrimitiveError("적 그룹을 담을 변수를 찾을 수 없습니다.");
  }
  if (command.kind === "craftRecipe" || command.kind === "openCraftShop") {
    const recipes = command.kind === "craftRecipe" ? [command.recipeId] : command.recipeIds ?? [];
    if (recipes.some(id => !project.system.craftRecipes?.some(row => row.id === id))) {
      throw new PrimitiveError("사용할 제작법을 찾을 수 없습니다.");
    }
  }
  if (command.kind === "applyItemUpgrade" && !project.system.itemUpgrades?.some(row => row.id === command.upgradeId)) {
    throw new PrimitiveError("사용할 강화 규칙을 찾을 수 없습니다.");
  }
  if (command.kind === "setDifficulty" && !project.system.difficulties?.some(row => row.id === command.difficultyId)) {
    throw new PrimitiveError("설정할 난이도를 찾을 수 없습니다.");
  }
  if (command.kind === "callMapEvent" && !map.events.some(event => committedEventView(event)?.id === command.eventId)) {
    throw new PrimitiveError("작업을 시작한 맵에서 호출할 이벤트를 찾을 수 없습니다.");
  }
  if (command.kind === "moveEvent" || command.kind === "setEventGraphicPattern") {
    const optional = command.eventId === "";
    const player = command.kind === "moveEvent" && isPlayerMoveTarget(command.eventId);
    if (!optional && !player && !hasMapEvent(project, command.eventId)) {
      throw new PrimitiveError("대상 맵 이벤트를 찾을 수 없습니다.");
    }
  }
  if (command.kind === "transfer") {
    const map = Object.hasOwn(project.maps, command.mapId) ? project.maps[command.mapId] : undefined;
    if (map && (!Number.isSafeInteger(command.x) || !Number.isSafeInteger(command.y)
      || command.x < 0 || command.y < 0 || command.x >= map.width || command.y >= map.height)) {
      throw new PrimitiveError("대상 위치가 맵 범위를 벗어났습니다. 맵 안의 칸을 골라 주세요.");
    }
  }
  if (command.kind === "changeTile" && changeTileProblems(command, project).length) {
    throw new PrimitiveError("바꿀 타일의 맵, 층, 좌표와 타일 번호를 확인해 주세요.");
  }
}

function hasMapEvent(project: Project, id: string): boolean {
  return Object.values(project.maps).some(map => map.events.some(row => row.id === id));
}

function conditionReferencesExist(project: Project, context: ReferenceContext, condition: Condition): boolean {
  switch (condition.kind) {
    case "all":
    case "any":
      return condition.conditions.every(child => conditionReferencesExist(project, context, child));
    case "not": return conditionReferencesExist(project, context, condition.condition);
    case "switch": return context.switchIds.has(condition.switchId);
    case "variable": return context.variableIds.has(condition.variableId);
    case "actor":
    case "partyLeader": return context.actorIds.has(condition.actorId);
    case "actorStat": return condition.actorId === "leader" || context.actorIds.has(condition.actorId);
    case "actorState":
      return (condition.actorId === "leader" || condition.actorId === "anyone" || context.actorIds.has(condition.actorId)) &&
        project.database.states.some(row => row.id === condition.stateId);
    case "item":
    case "itemUsed": return context.itemIds.has(condition.itemId) || context.equipmentIds.has(condition.itemId);
    case "partyKnowsSkill": return context.skillIds.has(condition.skillId);
    case "endingSeen": return context.endingIds.has(condition.endingId);
    case "difficulty": return project.system.difficulties?.some(row => row.id === condition.difficultyId) ?? false;
    case "insideLocation":
      return Object.values(project.maps).some(map => map.locations?.some(row => row.id === condition.locationId) &&
        (!condition.eventId || map.events.some(row => row.id === condition.eventId)));
    case "pursuitActive":
    case "eventSeesPlayer": return !condition.eventId || hasMapEvent(project, condition.eventId);
    default: return true;
  }
}

export function validateCommandReferences(project: Project, map: GameMap, command: Command, current?: Command): void {
  validateCommandInput(project, map, command, current);
  const checked = structuredClone(command);
  // The shared validator descends into branches. Existing child rows are outside this edit.
  for (const { branchIndex } of eventCommandBranches(checked)) {
    const branch = resolveCommandListAtPath([checked], [0, branchIndex, 0]);
    if (branch) branch.length = 0;
  }
  const db = project.database;
  const context: ReferenceContext = {
    appearanceIds: ids(db.characterAppearances),
    actorIds: ids(db.actors),
    classIds: ids(db.classes),
    enemyIds: ids(db.enemies),
    itemIds: ids(db.items),
    equipmentIds: ids(db.equipment),
    equipmentSlotIds: ids(equipmentSlots(project)),
    skillIds: ids(db.skills),
    animationIds: ids(db.battleAnimations),
    switchIds: ids(project.switches),
    variableIds: ids(project.variables),
    commonEventIds: ids(project.commonEvents),
    scheduleIds: ids(db.schedules),
    endingIds: ids(project.endings),
    gameOverIds: ids(project.system.gameOvers),
    mapIds: new Set(Object.keys(project.maps)),
    troopIds: ids(db.troops),
    speciesIds: ids(db.monsterSpecies),
    resourceIds: collectResourceIds(project),
    factionIds: new Set([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID, ...(project.factions?.defs ?? []).map(row => row.id)]),
  };
  try {
    validateCommands([checked], context);
  } catch {
    throw new PrimitiveError("명령이 가리키는 대상을 찾을 수 없습니다.");
  }
  const conditions = checked.kind === "fork" ? [checked.condition] :
    checked.kind === "choices" ? checked.options.flatMap(option => [option.showWhen, option.enableWhen]) : [];
  if (conditions.some(condition => condition && !conditionReferencesExist(project, context, condition))) {
    throw new PrimitiveError("조건에서 가리키는 대상을 찾을 수 없습니다.");
  }
}
