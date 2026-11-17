import { DELETABLE_DB_COLLECTIONS, collectionRows, parseDeletableCollection, unusedRecords, type DeletableCollection } from "./dbRecordDelete";
import { hasBatchim } from "@/util/josa";
import { enemyCombatConditions } from "@/project/combatReferences";
// editor/tools/refactorTools.ts
// 전역 리팩토링 툴(Phase 5): rename_switch / prune_unused.
// find_switch_usage와 동일한 순회 규약으로 스위치/변수/아이템/트룹 참조를 전수 수집·치환한다.

import type { Command, Condition, GameEvent, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { allTools } from "./toolRegistry";
import { collectProjectItemReferenceIds } from "@/project/io/references";
import { projectDatabaseReferenceMessage, projectSwitchVariableReferenceMessage } from "@/editor/databaseRecordReferences";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";

// --- 공통 순회 ---

function eventAllCommands(event: GameEvent): Command[] {
  const commands: Command[] = [...event.commands];
  for (const page of event.pages ?? []) commands.push(...page.commands);
  return commands;
}

// 커맨드 트리를 재귀 순회하며 각 커맨드를 방문(fork/choices/loop 분기 포함).
function walkCommands(commands: readonly Command[], visit: (command: Command) => void): void {
  for (const command of commands) {
    visit(command);
    if (command.kind === "choices") {
      for (const option of command.options) walkCommands(option.branch, visit);
      if (command.cancelBranch) walkCommands(command.cancelBranch, visit);
    } else if (command.kind === "presentItem") {
      for (const branch of presentItemBranchLists(command)) walkCommands(branch, visit);
    } else if (command.kind === "fork") {
      walkCommands(command.then, visit);
      if (command.else) walkCommands(command.else, visit);
    } else if (command.kind === "loop") {
      walkCommands(command.body, visit);
    } else if (command.kind === "shop") {
      walkCommands(command.transactionBranch ?? [], visit);
      walkCommands(command.failedTransactionBranch ?? [], visit);
    } else if (command.kind === "battleProcessing") {
      walkCommands(command.victoryBranch ?? [], visit);
      walkCommands(command.defeatBranch ?? [], visit);
      walkCommands(command.escapeBranch ?? [], visit);
    } else if (command.kind === "tacticsBattle") {
      walkCommands(command.victoryBranch ?? [], visit);
      walkCommands(command.defeatBranch ?? [], visit);
    } else if (command.kind === "promoteActor" || command.kind === "evolveMonster") {
      walkCommands(command.successBranch ?? [], visit);
      walkCommands(command.failureBranch ?? [], visit);
    } else if (command.kind === "inn") {
      walkCommands(command.notEnoughBranch ?? [], visit);
    }
  }
}

// --- 참조 수집 ---

export interface ReferenceSets {
  readonly switches: Set<string>;
  readonly variables: Set<string>;
  readonly items: Set<string>;
  readonly troops: Set<string>;
  readonly enemies: Set<string>;
}

function addConditionRefs(condition: Condition | undefined, refs: ReferenceSets): void {
  if (!condition) return;
  if (condition.kind === "switch") refs.switches.add(condition.switchId);
  else if (condition.kind === "variable") refs.variables.add(condition.variableId);
  else if (condition.kind === "item") refs.items.add(condition.itemId);
  else if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) addConditionRefs(child, refs);
  } else if (condition.kind === "not") {
    addConditionRefs(condition.condition, refs);
  }
}

function addCommandRefs(command: Command, refs: ReferenceSets): void {
  switch (command.kind) {
    case "setSwitch":
      refs.switches.add(command.switchId);
      if (typeof command.value === "object" && command.value !== null && command.value.kind === "var") {
        refs.variables.add(command.value.id);
      }
      break;
    case "setVariable":
      refs.variables.add(command.variableId);
      if (typeof command.value === "object" && command.value.kind === "var") refs.variables.add(command.value.id);
      break;
    case "changeGold":
      if (typeof command.amount === "object" && command.amount.kind === "var") refs.variables.add(command.amount.id);
      break;
    case "changeExp":
      if (typeof command.amount === "object" && command.amount.kind === "var") refs.variables.add(command.amount.id);
      break;
    case "getFriendship":
      refs.variables.add(command.variableId);
      break;
    // wait/inputWait는 variableId가 옵셔널이므로 있을 때만 수집한다.
    case "wait":
    case "inputWait":
      if (command.variableId !== undefined) refs.variables.add(command.variableId);
      break;
    case "inputNumber":
      refs.variables.add(command.variableId);
      break;
    // 이동 경로 안의 setSwitch 무브도 스위치 참조다(databaseCommandReferences와 동일 규약).
    case "moveEvent":
      for (const move of command.route.moves) {
        if (move.kind === "setSwitch") refs.switches.add(move.switchId);
      }
      break;
    case "fork":
      addConditionRefs(command.condition, refs);
      break;
    case "choices":
      for (const option of command.options) {
        addConditionRefs(option.showWhen, refs);
        addConditionRefs(option.enableWhen, refs);
      }
      break;
    case "changeItem":
      refs.items.add(command.itemId);
      if (typeof command.amount === "object" && command.amount.kind === "var") refs.variables.add(command.amount.id);
      break;
    case "battleProcessing":
    case "tacticsBattle":
      refs.troops.add(command.troopId);
      break;
    case "spawnFieldEnemy":
      refs.troops.add(command.spawn.troopId);
      break;
    case "craftRecipe":
    case "applyItemUpgrade":
      if (command.resultVariableId) refs.variables.add(command.resultVariableId);
      break;
    case "openCraftShop":
      break;
    case "runSchedule":
      if (command.slotVariableId) refs.variables.add(command.slotVariableId);
      break;
    case "presentItem":
      for (const itemId of command.itemIds ?? []) refs.items.add(itemId);
      for (const option of command.options) refs.items.add(option.itemId);
      break;
    case "shop":
      for (const itemId of command.itemIds) refs.items.add(itemId);
      for (const entry of command.stock ?? []) refs.items.add(entry.itemId);
      break;
    default:
      break;
  }
}

// 프로젝트 전역에서 참조되는 스위치/변수/아이템/트룹 id를 수집한다.
export function collectReferences(project: Project): ReferenceSets {
  const refs: ReferenceSets = { switches: new Set(), variables: new Set(), items: new Set(collectProjectItemReferenceIds(project)), troops: new Set(), enemies: new Set() };
  for (const map of Object.values(project.maps)) {
    for (const troopId of map.troopIds ?? []) refs.troops.add(troopId);
    for (const entry of map.encounterTable ?? []) {
      refs.troops.add(entry.troopId);
      if (entry.conditions?.switchId) refs.switches.add(entry.conditions.switchId);
      if (entry.conditions?.variableId) refs.variables.add(entry.conditions.variableId);
    }
    for (const spawn of map.fieldSpawns ?? []) refs.troops.add(spawn.troopId);
    for (const event of map.events) {
      addConditionRefs(event.condition, refs);
      addGiftPreferenceRefs(event, refs);
      for (const page of event.pages ?? []) {
        for (const condition of page.conditions) addConditionRefs(condition, refs);
      }
      walkCommands(eventAllCommands(event), (command) => addCommandRefs(command, refs));
    }
  }
  for (const commonEvent of project.commonEvents) {
    if (commonEvent.conditionSwitchId) refs.switches.add(commonEvent.conditionSwitchId);
    walkCommands(commonEvent.commands, (command) => addCommandRefs(command, refs));
  }
  for (const troop of project.database.troops) {
    for (const enemyId of troop.enemyIds) refs.enemies.add(enemyId);
    for (const member of troop.members ?? []) refs.enemies.add(member.enemyId);
    for (const page of troop.battleEventPages ?? []) {
      for (const condition of page.conditions) {
        if (condition.kind === "switch" && condition.switchId) refs.switches.add(condition.switchId);
        if (condition.kind === "variable") refs.variables.add(condition.variableId);
      }
      walkCommands(page.commands ?? [], (command) => addCommandRefs(command, refs));
    }
    for (const list of troopAfterBattleLists(troop)) walkCommands(list.commands, (command) => addCommandRefs(command, refs));
  }
  for (const enemy of project.database.enemies) {
    for (const action of enemy.actions) {
      if (action.switchOnAfterAction.switchId) refs.switches.add(action.switchOnAfterAction.switchId);
      if (action.switchOffAfterAction.switchId) refs.switches.add(action.switchOffAfterAction.switchId);
    }
    if (enemy.rewards.dropItemId) refs.items.add(enemy.rewards.dropItemId);
    for (const drop of enemy.rewards.drops ?? []) refs.items.add(drop.itemId);
    for (const condition of enemyCombatConditions(enemy)) if (condition.kind === "switch") refs.switches.add(condition.switchId);
  }
  if (project.system.initialTroopId) refs.troops.add(project.system.initialTroopId);
  for (const itemId of Object.keys(project.session.inventory)) refs.items.add(itemId);
  return refs;
}

function addGiftPreferenceRefs(event: GameEvent, refs: ReferenceSets): void {
  for (const itemId of event.giftPrefs?.loved ?? []) refs.items.add(itemId);
  for (const itemId of event.giftPrefs?.liked ?? []) refs.items.add(itemId);
  for (const itemId of event.giftPrefs?.disliked ?? []) refs.items.add(itemId);
}

// --- rename_switch ---

function renameConditionSwitch(condition: Condition | undefined, oldId: string, newId: string): number {
  if (condition?.kind === "switch" && condition.switchId === oldId) {
    (condition as { switchId: string }).switchId = newId;
    return 1;
  }
  return 0;
}

/**
 * Immer draft 는 런타임에 쓰기를 허용하지만 시스템 정의류는 타입상 readonly 로 선언돼 있다.
 * 치환 자체는 정본 데이터 수정이므로 여기서 한 군데만 캐스트해 위임한다 — 호출부 인라인 캐스트 금지.
 */
function reassignReadonlySwitchId(holder: { readonly switchId?: string }, newId: string): void {
  const writable = holder as { switchId?: string };
  writable.switchId = newId;
}

// 프로젝트 전역에서 스위치 id를 치환하고 치환 횟수를 반환한다.
export function renameSwitchEverywhere(project: Project, oldId: string, newId: string): number {
  let count = 0;
  for (const def of project.switches) {
    if (def.id === oldId) {
      def.id = newId;
      count += 1;
    }
  }
  if (Object.prototype.hasOwnProperty.call(project.session.switches, oldId)) {
    project.session.switches[newId] = project.session.switches[oldId];
    delete project.session.switches[oldId];
    count += 1;
  }
  const renameInCommand = (command: Command): void => {
    if (command.kind === "setSwitch" && command.switchId === oldId) {
      command.switchId = newId;
      count += 1;
    } else if (command.kind === "fork") {
      count += renameConditionSwitch(command.condition, oldId, newId);
    } else if (command.kind === "choices") {
      for (const option of command.options) {
        count += renameConditionSwitch(option.showWhen, oldId, newId) + renameConditionSwitch(option.enableWhen, oldId, newId);
      }
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) {
      if (entry.conditions?.switchId === oldId) {
        entry.conditions.switchId = newId;
        count += 1;
      }
    }
    for (const event of map.events) {
      count += renameConditionSwitch(event.condition, oldId, newId);
      for (const page of event.pages ?? []) {
        for (const condition of page.conditions) count += renameConditionSwitch(condition, oldId, newId);
      }
      walkCommands(eventAllCommands(event), renameInCommand);
    }
  }
  for (const commonEvent of project.commonEvents) {
    if (commonEvent.conditionSwitchId === oldId) {
      commonEvent.conditionSwitchId = newId;
      count += 1;
    }
    walkCommands(commonEvent.commands, renameInCommand);
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      for (const condition of page.conditions) {
        if (condition.kind === "switch" && condition.switchId === oldId) {
          (condition as { switchId: string }).switchId = newId;
          count += 1;
        }
      }
      walkCommands(page.commands ?? [], renameInCommand);
    }
    for (const list of troopAfterBattleLists(troop)) walkCommands(list.commands, renameInCommand);
  }
  for (const enemy of project.database.enemies) {
    for (const action of enemy.actions) {
      if (action.condition.kind === "switch" && action.condition.switchId === oldId) {
        action.condition.switchId = newId;
        count += 1;
      }
      if (action.switchOnAfterAction.switchId === oldId) {
        action.switchOnAfterAction.switchId = newId;
        count += 1;
      }
      if (action.switchOffAfterAction.switchId === oldId) {
        action.switchOffAfterAction.switchId = newId;
        count += 1;
      }
    }
  }
  for (const enemy of project.database.enemies) for (const drop of enemy.rewards.drops ?? []) {
    if (drop.condition.kind === "switch" && drop.condition.switchId === oldId) {
      drop.condition.switchId = newId;
      count += 1;
    }
  }
  // 퀘스트 메타의 스위치는 key에서 파생되므로 별도 치환 불필요.

  // DB 항목·스킬·진급·해금·번들·뮤지엄의 스위치 참조 — 안 바꾸면 무결성 검증이 커밋을 거부한다
  // (2026-09-24 감성 스토리 r3: item_gen2_*_relay switchId 로 11회 반복 커밋 거부).
  for (const item of project.database.items) {
    if (item.switchId === oldId) {
      item.switchId = newId;
      count += 1;
    }
  }
  for (const skill of project.database.skills) {
    if (skill.effect.kind === "switch" && skill.effect.switchId === oldId) {
      skill.effect = { kind: "switch", switchId: newId };
      count += 1;
    }
  }
  for (const klass of project.database.classes) {
    for (const promotion of klass.promotions ?? []) {
      if (promotion.requires.switchId === oldId) {
        promotion.requires = { ...promotion.requires, switchId: newId };
        count += 1;
      }
    }
  }
  for (const lifeSkill of project.database.lifeSkills ?? []) {
    for (const reward of lifeSkill.levelUpRewards) {
      if (reward.switchId === oldId) {
        reassignReadonlySwitchId(reward, newId);
        count += 1;
      }
    }
  }
  for (const unlock of project.system.worldUnlocks ?? []) {
    if (unlock.switchId === oldId) {
      reassignReadonlySwitchId(unlock, newId);
      count += 1;
    }
  }
  for (const bundle of project.system.bundles ?? []) {
    if (bundle.reward?.switchId === oldId) {
      reassignReadonlySwitchId(bundle.reward, newId);
      count += 1;
    }
  }
  for (const reward of project.system.museum?.rewards ?? []) {
    if (reward.reward?.switchId === oldId) {
      reassignReadonlySwitchId(reward.reward, newId);
      count += 1;
    }
  }
  // 필드 스폰·이동 경로·목적지 스위치는 런타임이 쓰는 자리다 — 안 바꾸면 옛 id 에 쓰게 된다.
  for (const map of Object.values(project.maps)) {
    for (const spawn of map.fieldSpawns ?? []) {
      if (spawn.onKillSwitchId === oldId) {
        spawn.onKillSwitchId = newId;
        count += 1;
      }
    }
    for (const event of map.events) {
      for (const move of event.moveRoute?.moves ?? []) {
        if (move.kind === "setSwitch" && move.switchId === oldId) {
          move.switchId = newId;
          count += 1;
        }
      }
      for (const page of event.pages ?? []) {
        for (const move of page.movement?.route?.moves ?? []) {
          if (move.kind === "setSwitch" && move.switchId === oldId) {
            move.switchId = newId;
            count += 1;
          }
        }
        for (const destination of page.movement?.living?.destinations ?? []) {
          if (destination.switchId === oldId) {
            destination.switchId = newId;
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

const RENAME_SWITCH_ACCEPTS =
  "rename_switch 는 대상(fromId·switchId·id·fromName 중 하나)과 바꿀 것(to=새 id, name=표시 이름 중 하나 이상)을 받습니다. "
  + "예: {switchId:\"sw_0001\",name:\"보스 격파\"} 또는 {fromId:\"sw_0001\",to:\"sw_boss_defeated\"}. "
  + "새 스위치를 id 부터 만들려면 대상 없이 {to,name} 만 주세요.";

const renameSwitch: ToolDefinition = {
  name: "rename_switch",
  description:
    "스위치의 표시 이름(name)을 바꾸거나 id(to)를 전 맵/커먼이벤트/트룹/적 행동/DB 항목에서 일괄 치환한다(정의·세션·참조 모두). "
    + "대상은 fromId(별칭 switchId·id) 또는 fromName. name 만 주면 id·참조는 그대로 두고 이름만 바꾸며, 정의가 없으면 만든다. "
    + "대상 없이 to+name 만 주면 그 id 로 새 스위치를 만든다.",
  mode: "write",
  invalidArgsExample: { switchId: "sw_0001", name: "보스 격파" },
  invalidArgsHint: RENAME_SWITCH_ACCEPTS,
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string", description: "대상 스위치 id(switchId·id·fromName과 택1)" },
      switchId: { type: "string", description: "fromId 별칭" },
      id: { type: "string", description: "fromId 별칭 — {id, name} 형태로 보낼 때" },
      fromName: { type: "string", description: "대상 스위치 이름(fromId와 택1)" },
      to: { type: "string", description: "새 스위치 id(참조까지 일괄 치환). 이름만 바꿀 때는 생략" },
      name: { type: "string", description: "새 표시 이름. id 는 그대로 둔다" },
    },
  },
  run(draft, args): ToolExecResult {
    const text = (key: string): string | undefined => {
      const value = args[key];
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const fromId = text("fromId");
    const switchId = text("switchId");
    const id = text("id");
    const fromName = text("fromName");
    const to = text("to");
    const name = text("name");
    const aliases = [fromId, switchId, id].filter((value): value is string => value !== undefined);
    if (new Set(aliases).size > 1) throw new ToolError(`대상 스위치 id 별칭이 서로 다릅니다: ${[...new Set(aliases)].join(", ")} — 하나만 주세요. ${RENAME_SWITCH_ACCEPTS}`, { code: "rename-target" });
    if (!to && !name) throw new ToolError(`바꿀 것이 없습니다 — to(새 id) 또는 name(새 표시 이름)이 필요합니다. ${RENAME_SWITCH_ACCEPTS}`, { code: "rename-target" });
    // 대상 스위치 해석: fromId/switchId/id 우선, 없으면 fromName으로 조회.
    let oldId: string | undefined = aliases[0];
    if (oldId === undefined && fromName !== undefined) {
      const matches = draft.switches.filter((def) => def.name === fromName);
      if (matches.length === 0) throw new ToolError(`이름으로 스위치를 찾을 수 없습니다: ${fromName}`, { code: "switch-not-found" });
      if (matches.length > 1) throw new ToolError(`이름이 중복되어 대상이 모호합니다: ${fromName}. fromId로 지정하세요.`, { code: "switch-ambiguous" });
      oldId = matches[0].id;
    }
    if (oldId === undefined) {
      // 대상 없이 to+name 만 오면 그 id 로 새 스위치를 만든다 — 모델이 upsert 처럼 쓴다
      // (2026-09-24 추격 호러 r7: 같은 거부로 다섯 번 연속 재시도하다 겨우 switchId 별칭으로 갔다).
      if (to && name) {
        if (draft.switches.some((def) => def.id === to)) throw new ToolError(`이미 존재하는 스위치 id입니다: ${to} — 이름을 바꾸려면 fromId(또는 switchId)도 지정하세요.`, { code: "switch-exists" });
        oldId = to;
      } else {
        throw new ToolError(`대상 스위치가 없습니다 — fromId(또는 switchId)나 fromName 중 하나가 필요합니다(새 스위치는 대상 없이 to+name). ${RENAME_SWITCH_ACCEPTS}`, { code: "rename-target" });
      }
    }
    const exists = draft.switches.some((def) => def.id === oldId);
    const notes: string[] = [];
    let replaced = 0;
    let finalId = oldId;
    if (to && to !== oldId) {
      if (!exists) throw new ToolError(`스위치를 찾을 수 없습니다: ${oldId} — id 를 바꾸려면 있는 스위치여야 합니다. 이름만 붙이려면 to 없이 name 만 주세요.`, { code: "switch-not-found" });
      if (draft.switches.some((def) => def.id === to)) throw new ToolError(`이미 존재하는 스위치 id입니다: ${to}`, { code: "switch-exists" });
      replaced = renameSwitchEverywhere(draft, oldId, to);
      finalId = to;
      notes.push(`'${oldId}' → '${to}' (${replaced}곳 치환)`);
    } else if (to === oldId && !name) {
      throw new ToolError("대상과 새 id가 같습니다. 이름을 바꾸려면 name 을 주세요.", { code: "rename-noop" });
    }
    if (name) {
      const def = draft.switches.find((entry) => entry.id === finalId);
      if (def) {
        const before = def.name;
        def.name = name;
        notes.push(`이름 ${before ? `'${before}'` : "(없음)"} → '${name}'`);
      } else {
        draft.switches.push({ id: finalId, name });
        draft.session.switches[finalId] ??= false;
        notes.push(`정의가 없어 새로 만들고 이름 '${name}'`);
      }
    }
    return {
      summary: `스위치 '${finalId}' ${notes.join(", ")}`,
      data: { fromId: oldId, to: finalId, name: draft.switches.find((entry) => entry.id === finalId)?.name, replaced },
    };
  },
};

// --- rename_variable ---

function renameConditionVariable(condition: Condition | undefined, oldId: string, newId: string): number {
  if (condition?.kind === "variable" && condition.variableId === oldId) {
    (condition as { variableId: string }).variableId = newId;
    return 1;
  }
  return 0;
}

// 프로젝트 전역에서 변수 id를 치환하고 치환 횟수를 반환한다(rename_switch의 변수판).
export function renameVariableEverywhere(project: Project, oldId: string, newId: string): number {
  let count = 0;
  for (const def of project.variables) {
    if (def.id === oldId) {
      def.id = newId;
      count += 1;
    }
  }
  if (Object.prototype.hasOwnProperty.call(project.session.variables, oldId)) {
    project.session.variables[newId] = project.session.variables[oldId];
    delete project.session.variables[oldId];
    count += 1;
  }
  const renameInCommand = (command: Command): void => {
    if (command.kind === "setVariable") {
      if (command.variableId === oldId) {
        command.variableId = newId;
        count += 1;
      }
      if (typeof command.value === "object" && command.value.kind === "var" && command.value.id === oldId) {
        command.value.id = newId;
        count += 1;
      }
    } else if (command.kind === "setSwitch") {
      if (typeof command.value === "object" && command.value !== null && command.value.kind === "var" && command.value.id === oldId) {
        command.value.id = newId;
        count += 1;
      }
    } else if (command.kind === "changeGold" || command.kind === "changeItem" || command.kind === "changeExp") {
      if (typeof command.amount === "object" && command.amount.kind === "var" && command.amount.id === oldId) {
        command.amount.id = newId;
        count += 1;
      }
    } else if ((command.kind === "inputNumber" || command.kind === "inputWait") && command.variableId === oldId) {
      command.variableId = newId;
      count += 1;
    } else if (command.kind === "fork") {
      count += renameConditionVariable(command.condition, oldId, newId);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const entry of map.encounterTable ?? []) {
      if (entry.conditions?.variableId === oldId) {
        entry.conditions.variableId = newId;
        count += 1;
      }
    }
    for (const event of map.events) {
      count += renameConditionVariable(event.condition, oldId, newId);
      for (const page of event.pages ?? []) {
        for (const condition of page.conditions) count += renameConditionVariable(condition, oldId, newId);
      }
      walkCommands(eventAllCommands(event), renameInCommand);
    }
  }
  for (const commonEvent of project.commonEvents) {
    walkCommands(commonEvent.commands, renameInCommand);
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      // 트룹 조건은 BattleEventCondition(전용 kind 포함)이라 변수 kind만 직접 검사한다.
      for (const condition of page.conditions) {
        if (condition.kind === "variable" && condition.variableId === oldId) {
          (condition as { variableId: string }).variableId = newId;
          count += 1;
        }
      }
      walkCommands(page.commands ?? [], renameInCommand);
    }
    for (const list of troopAfterBattleLists(troop)) walkCommands(list.commands, renameInCommand);
  }
  return count;
}

const RENAME_VARIABLE_ACCEPTS =
  "rename_variable 는 대상(fromId·variableId·fromName 중 하나)과 바꿀 것(to=새 id, name=표시 이름 중 하나 이상)을 받습니다. "
  + "예: {variableId:\"var_0001\",name:\"나래 호감\"} 또는 {fromId:\"var_0001\",to:\"var_narae_affection\"}. "
  + "새 변수를 id 부터 만들려면 대상 없이 {to,name} 만 주세요.";

// rename_switch 와 같은 계약. 예전에는 id 만 바꿀 수 있어, 모델이 {fromId:"var_0001",to:"나래호감"} 으로
// 「이름」을 붙이면 표시 이름은 빈 채로 남았다(2026-09-24 연애 도그푸딩: 호감 변수 넷이 이름 없음).
const renameVariable: ToolDefinition = {
  name: "rename_variable",
  description:
    "변수의 표시 이름(name)을 바꾸거나 id(to)를 전 맵/커먼이벤트/트룹에서 일괄 치환한다(정의·세션·setVariable·조건·숫자입력 참조 포함). "
    + "대상은 fromId(별칭 variableId) 또는 fromName. name 만 주면 id·참조는 그대로 두고 이름만 바꾸며, 정의가 없으면 만든다. "
    + "대상 없이 to+name 만 주면 그 id 로 새 변수를 만든다.",
  mode: "write",
  invalidArgsExample: { variableId: "var_0001", name: "나래 호감" },
  invalidArgsHint: RENAME_VARIABLE_ACCEPTS,
  parameters: {
    type: "object",
    properties: {
      fromId: { type: "string", description: "대상 변수 id(variableId·fromName과 택1)" },
      variableId: { type: "string", description: "fromId 별칭" },
      fromName: { type: "string", description: "대상 변수 이름(fromId와 택1)" },
      to: { type: "string", description: "새 변수 id(참조까지 일괄 치환). 이름만 바꿀 때는 생략" },
      name: { type: "string", description: "새 표시 이름. id 는 그대로 둔다" },
    },
  },
  run(draft, args): ToolExecResult {
    const text = (key: string): string | undefined => {
      const value = args[key];
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const fromId = text("fromId");
    const variableId = text("variableId");
    const fromName = text("fromName");
    const to = text("to");
    const name = text("name");
    if (fromId && variableId && fromId !== variableId) throw new ToolError(`fromId(${fromId})와 variableId(${variableId})가 다릅니다. 하나만 주세요. ${RENAME_VARIABLE_ACCEPTS}`, { code: "rename-target" });
    if (!to && !name) throw new ToolError(`바꿀 것이 없습니다 — to(새 id) 또는 name(새 표시 이름)이 필요합니다. ${RENAME_VARIABLE_ACCEPTS}`, { code: "rename-target" });
    let oldId: string | undefined = fromId ?? variableId;
    if (oldId === undefined && fromName !== undefined) {
      const matches = draft.variables.filter((def) => def.name === fromName);
      if (matches.length === 0) throw new ToolError(`이름으로 변수를 찾을 수 없습니다: ${fromName}`, { code: "variable-not-found" });
      if (matches.length > 1) throw new ToolError(`이름이 중복되어 대상이 모호합니다: ${fromName}. fromId로 지정하세요.`, { code: "variable-ambiguous" });
      oldId = matches[0].id;
    }
    if (oldId === undefined) {
      // rename_switch 와 같은 계약: 대상 없이 to+name 이면 그 id 로 새 변수를 만든다.
      if (to && name) {
        if (draft.variables.some((def) => def.id === to)) throw new ToolError(`이미 존재하는 변수 id입니다: ${to} — 이름을 바꾸려면 fromId(또는 variableId)도 지정하세요.`, { code: "variable-exists" });
        oldId = to;
      } else {
        throw new ToolError(`대상 변수가 없습니다 — fromId(또는 variableId)나 fromName 중 하나가 필요합니다(새 변수는 대상 없이 to+name). ${RENAME_VARIABLE_ACCEPTS}`, { code: "rename-target" });
      }
    }
    const exists = draft.variables.some((def) => def.id === oldId);
    const notes: string[] = [];
    let replaced = 0;
    let finalId = oldId;
    if (to && to !== oldId) {
      if (!exists) throw new ToolError(`변수를 찾을 수 없습니다: ${oldId} — id 를 바꾸려면 있는 변수여야 합니다. 이름만 붙이려면 to 없이 name 만 주세요.`, { code: "variable-not-found" });
      if (draft.variables.some((def) => def.id === to)) throw new ToolError(`이미 존재하는 변수 id입니다: ${to}`, { code: "variable-exists" });
      replaced = renameVariableEverywhere(draft, oldId, to);
      finalId = to;
      notes.push(`'${oldId}' → '${to}' (${replaced}곳 치환)`);
    } else if (to === oldId && !name) {
      throw new ToolError("대상과 새 id가 같습니다. 이름을 바꾸려면 name 을 주세요.", { code: "rename-noop" });
    }
    const def = draft.variables.find((entry) => entry.id === finalId);
    if (name) {
      if (def) {
        const before = def.name;
        def.name = name;
        notes.push(`이름 ${before ? `'${before}'` : "(없음)"} → '${name}'`);
      } else {
        draft.variables.push({ id: finalId, name });
        draft.session.variables[finalId] ??= 0;
        notes.push(`정의가 없어 새로 만들고 이름 '${name}'`);
      }
    } else if (def && !def.name.trim()) {
      // 이름 없는 빈 칸의 id 만 바꾸면 자료집에서 행이 보이지 않는다. 새 id 를 표시 이름으로도 쓴다.
      def.name = finalId;
      notes.push(`이름이 비어 있어 '${finalId}' 로 채움`);
    }
    return {
      summary: `변수 '${finalId}' ${notes.join(", ")}`,
      data: { fromId: oldId, to: finalId, name: draft.variables.find((entry) => entry.id === finalId)?.name, replaced },
    };
  },
};

// --- prune_unused ---

export interface PruneReport {
  readonly switches: readonly string[];
  readonly variables: readonly string[];
  readonly items: readonly string[];
  readonly troops: readonly string[];
  readonly enemies: readonly string[];
}

// 이름이 있는(사용자 명명) 스위치/변수 + DB 아이템/트룹/적 중 어디서도 참조되지 않는 id를 찾는다.
// 보수적: 상호참조(트룹→적, 드랍→아이템, 상점→아이템, 세션 인벤토리, 퀘스트 메타)를 모두 역참조한 뒤 판정.
export function findUnused(project: Project): PruneReport {
  const refs = collectReferences(project);
  const switches = project.switches.filter((def) => def.name !== "" && !refs.switches.has(def.id) && !projectSwitchVariableReferenceMessage(project, "switch", def.id)).map((def) => def.id);
  const variables = project.variables.filter((def) => def.name !== "" && !refs.variables.has(def.id) && !projectSwitchVariableReferenceMessage(project, "variable", def.id)).map((def) => def.id);
  const items = project.database.items.filter((item) => !refs.items.has(item.id)).map((item) => item.id);
  const troops = project.database.troops.filter((troop) => !refs.troops.has(troop.id)).map((troop) => troop.id);
  // 적은 남는 트룹(제거 대상이 아닌)이 참조하면 유지. 제거될 트룹만 참조하는 적은 함께 미사용으로 본다.
  const removedTroops = new Set(troops);
  const enemiesStillUsed = new Set<string>();
  for (const troop of project.database.troops) {
    if (removedTroops.has(troop.id)) continue;
    for (const enemyId of troop.enemyIds) enemiesStillUsed.add(enemyId);
    for (const member of troop.members ?? []) enemiesStillUsed.add(member.enemyId);
  }
  const remainingProject = { ...project, database: { ...project.database, troops: project.database.troops.filter((troop) => !removedTroops.has(troop.id)) } };
  const enemies = project.database.enemies.filter((enemy) => !enemiesStillUsed.has(enemy.id)
    && !projectDatabaseReferenceMessage(remainingProject, "enemies", enemy.id)).map((enemy) => enemy.id);
  return { switches, variables, items, troops, enemies };
}

const pruneUnused: ToolDefinition = {
  name: "prune_unused",
  description: "미참조 스위치/변수(명명된 것)와 아이템/트룹을 보고한다. apply=true면 제거까지 수행. collections 를 주면 그 자료집 묶음(skills·states·equipment·classes·actors 등)에서 어디에서도 가리키지 않는 레코드를 찾는다(전체 참조 색인).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      apply: { type: "boolean", description: "true면 실제 제거(기본 false, 보고만)" },
      collections: { type: "array", items: { type: "string", enum: [...DELETABLE_DB_COLLECTIONS] }, description: "이 묶음들에서 안 쓰는 레코드를 찾는다(주면 스위치/변수는 보지 않는다)" },
    },
  },
  run(draft, args): ToolExecResult {
    if (Array.isArray(args.collections) && args.collections.length > 0) return pruneCollections(draft, args.collections.map(parseDeletableCollection), args.apply === true);
    const report = findUnused(draft);
    const total = report.switches.length + report.variables.length + report.items.length + report.troops.length;
    const apply = args.apply === true;
    if (apply) {
      const nameReset = new Set(report.switches);
      // 스위치/변수는 슬롯 구조를 유지하기 위해 이름만 비운다(id 슬롯은 보존).
      for (const def of draft.switches) if (nameReset.has(def.id)) def.name = "";
      const varReset = new Set(report.variables);
      for (const def of draft.variables) if (varReset.has(def.id)) def.name = "";
      const removeItems = new Set(report.items);
      draft.database.items = draft.database.items.filter((item) => !removeItems.has(item.id));
      const removeTroops = new Set(report.troops);
      draft.database.troops = draft.database.troops.filter((troop) => !removeTroops.has(troop.id));
      const removeEnemies = new Set(report.enemies);
      draft.database.enemies = draft.database.enemies.filter((enemy) => !removeEnemies.has(enemy.id));
    }
    const destructiveCount = report.items.length + report.troops.length + report.enemies.length;
    return {
      summary: apply
        ? `미사용 정리: 아이템 ${report.items.length}·트룹 ${report.troops.length}·적 ${report.enemies.length} 제거, 스위치/변수 ${report.switches.length + report.variables.length} 이름 해제`
        : `미사용 ${total + report.enemies.length}건 발견(보고만)`,
      data: { report, applied: apply },
      warnings: apply && destructiveCount > 0 ? ["파괴적 작업: 미사용 아이템/트룹/적을 제거했습니다."] : undefined,
    };
  },
};

/** 묶음별 안 쓰는 레코드(전체 참조 색인 — dbRecordDelete.unusedRecords). 지우면 남은 것이 새로 고아가 될 수 있어(적 → 그 적만 쓰던 기술) 결과에 다시 부르라고 적는다. */
/** apply 가 되풀이하는 상한 — 기본 자료집은 2번이면 끝난다. 넘으면 남은 수를 결과에 적는다. */
export const PRUNE_MAX_PASSES = 8;
export function pruneCollections(draft: Project, collections: readonly DeletableCollection[], apply: boolean, maxPasses = PRUNE_MAX_PASSES): ToolExecResult {
  // apply 는 «안 쓰게 된 것» 이 없을 때까지 되풀이한다 — 아이템을 지우면 그 아이템만 쓰던 효과 스킬이 안 쓰는 것이 된다(실모델이 두 번 불렀다, 2026-11-16).
  const counts = new Map<DeletableCollection, number>(collections.map((c) => [c, 0]));
  const sample = new Map<DeletableCollection, { id: string; name: string }[]>(collections.map((c) => [c, []]));
  let rounds = 0;
  for (;;) {
    const found = unusedRecords(draft, collections);
    let round = 0;
    for (const [c, rows] of found) {
      round += rows.length;
      counts.set(c, (counts.get(c) ?? 0) + rows.length);
      sample.get(c)!.push(...rows.slice(0, Math.max(0, 40 - sample.get(c)!.length)).map((r) => ({ id: r.id, name: r.name ?? "" })));
    }
    if (!apply || round === 0) break;
    rounds += 1;
    for (const [c, rows] of found) {
      const gone = new Set(rows.map((r) => r.id));
      const list = collectionRows(draft, c);
      if (list) list.splice(0, list.length, ...list.filter((r) => !gone.has(r.id)));
    }
    if (rounds >= maxPasses) break;
  }
  // 상한에 닿아 멈췄으면 아직 남은 것을 센다 — «다 지웠다» 로 읽히지 않게.
  const left = apply && rounds >= maxPasses ? [...unusedRecords(draft, collections)].filter(([, rows]) => rows.length).map(([c, rows]) => `${c} ${rows.length}`) : [];
  const total = [...counts.values()].reduce((n, k) => n + k, 0);
  const lines = [...counts].map(([c, n]) => `${c} ${n}`);
  return {
    summary: `${apply ? "Deleted" : "Found"} ${total} unused record(s) — ${lines.join(", ")}${apply ? (rounds > 1 ? ` (in ${rounds} passes: deleting some left others unused)` : "") : " (report only — call again with apply:true to delete them)"}. Unused = no other record, map, event, common event or setting points at it.`
      + (left.length ? ` NOT FINISHED: stopped after ${maxPasses} passes and these are still unused — ${left.join(", ")}. Call prune_unused{apply:true} again to continue.` : ""),
    data: { unused: [...sample].map(([collection, records]) => ({ collection, count: counts.get(collection) ?? 0, records })), applied: apply, ...(left.length ? { stillUnused: left } : {}) },
  };
}

// ── 프로젝트 전체 글 바꾸기(폴른 스타 applyNorthForest 를 일반화) ──────────────────────────
// 대사·선택지·이벤트/맵 이름·퀘스트·공통 이벤트·아이템/장비/적/스킬 이름과 설명의 글자만 바꾼다. id·리소스 키·타일은 건드리지 않는다.
// 바꾼 낱말 바로 뒤 조사(은/는·이/가·을/를·와/과·으로/로)는 새 낱말 받침에 맞춘다.
const NON_TEXT_KEY = /^(id|kind|op|type|trigger|priority|direction|mode|preset|emote|key|style|layer|layers|sprite|graphic|dataUrl|tilesetId|lowerTiles|upperTiles|lowerOverlayTiles|upperOverlayTiles|passability|conditions?)$|(Id|Ids|Url|Key)$/u;
const JOSA_FIX: readonly [string, string][] = [["은", "는"], ["이", "가"], ["을", "를"], ["과", "와"]];
function replaceKeepingJosa(text: string, find: string, to: string): string {
  if (!text.includes(find)) return text;
  const toBatchim = hasBatchim(to);
  return text.split(find).reduce((acc, part, index) => {
    if (index === 0) return part;
    let rest = part;
    if (hasBatchim(find) !== toBatchim) {
      if (rest.startsWith("으로") && !toBatchim) rest = "로" + rest.slice(2);
      else if (rest.startsWith("로") && toBatchim) rest = "으로" + rest.slice(1);
      else for (const [withB, withoutB] of JOSA_FIX) {
        const from = toBatchim ? withoutB : withB, into = toBatchim ? withB : withoutB;
        if (rest.startsWith(from) && !/^[가-힣]/u.test(rest.slice(from.length, from.length + 1))) { rest = into + rest.slice(from.length); break; }
      }
    }
    return acc + to + rest;
  }, "");
}
/**
 * 글 하나에서 find 를 바꾼다. 이미 to 인 자리는 건드리지 않는다 — to 가 find 를 품을 때(「숲」→「속삭이는 숲」) 두 번 불러도
 * 「속삭이는 속삭이는 숲」이 되지 않는다(2026-11-16 리뷰: replace_text_in_project 두 번 적용).
 */
let schemaEnums: Map<string, Set<string>> | undefined;
/** Field name → the enum values the registered tool schemas declare for it (skill scope «enemy», item occasion «always», …).
 * A field holding one of those values is a setting, not text — rewriting it breaks the record. Derived from the schemas, not a word list. */
function enumValuesByField(): Map<string, Set<string>> {
  if (schemaEnums) return schemaEnums;
  const out = new Map<string, Set<string>>();
  const visit = (schema: unknown, field: string, seen: Set<unknown>): void => {
    if (!schema || typeof schema !== "object" || seen.has(schema)) return;
    seen.add(schema);
    const node = schema as { enum?: unknown; properties?: Record<string, unknown>; items?: unknown; anyOf?: unknown[]; oneOf?: unknown[]; additionalProperties?: unknown };
    if (field && Array.isArray(node.enum)) for (const value of node.enum) if (typeof value === "string") (out.get(field) ?? out.set(field, new Set()).get(field)!).add(value);
    for (const [key, child] of Object.entries(node.properties ?? {})) visit(child, key, seen);
    if (node.items) visit(node.items, field, seen);
    if (node.additionalProperties && typeof node.additionalProperties === "object") visit(node.additionalProperties, field, seen);
    for (const child of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) visit(child, field, seen);
  };
  for (const tool of allTools()) visit(tool.parameters, "", new Set());
  schemaEnums = out;
  return out;
}

function replaceOnce(text: string, find: string, to: string): { text: string; hits: number } {
  const guard = to.includes(find) && to !== find;
  const pieces = guard ? text.split(to) : [text];
  let hits = 0;
  const out = pieces.map((piece) => { if (!piece.includes(find)) return piece; hits += piece.split(find).length - 1; return replaceKeepingJosa(piece, find, to); });
  return { text: guard ? out.join(to) : out[0]!, hits };
}

const replaceTextInProject: ToolDefinition = {
  name: "replace_text_in_project",
  description:
    "프로젝트 전체의 글자를 한 번에 바꾼다 — 대사·선택지·화자 이름·이벤트 이름·맵 이름·퀘스트·공통 이벤트·아이템/장비/적/스킬 이름과 설명. "
    + "「대사에 나오는 '북쪽 숲'을 전부 '속삭이는 숲'으로」·「대장장이 이름을 볼칸으로(이름표+대사)」 같은 일괄 이름 바꾸기의 정본. "
    + "id·그림·타일·조건은 건드리지 않고, 바꾼 낱말 뒤 조사(은/는·이/가·을/를·와/과·으로/로)를 받침에 맞춘다. dryRun:true 면 바꿀 곳만 센다. "
    + "match:'exact' 면 글 전체가 find 와 같은 칸(이름표·레코드 이름)만 바꾼다 — 「포션」을 바꿔도 「하이포션」은 그대로. 이미 바뀐 자리는 다시 바꾸지 않는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      find: { type: "string", description: "찾을 글자(정확히 일치)" },
      replace: { type: "string", description: "바꿀 글자" },
      scope: { type: "string", enum: ["all", "dialogue"], description: "dialogue = 이벤트·공통 이벤트 명령 글만, all(기본) = 이름·DB 포함" },
      match: { type: "string", enum: ["contains", "exact"], description: "contains(기본) = 글 안의 모든 자리 · exact = 글 전체가 find 와 같은 칸만(이름 하나 바꾸기)" },
      mapIds: { type: "array", items: { type: "string" }, description: "이 맵들만(생략 = 전부)" },
      dryRun: { type: "boolean" },
    },
    required: ["find", "replace"],
  },
  invalidArgsExample: { find: "북쪽 숲", replace: "속삭이는 숲" },
  run(draft, args): ToolExecResult {
    const find = typeof args.find === "string" ? args.find : "";
    const to = typeof args.replace === "string" ? args.replace : "";
    if (!find.trim()) throw new ToolError("find is empty.");
    if (find === to) throw new ToolError("find and replace are the same.");
    const dry = args.dryRun === true;
    const dialogueOnly = args.scope === "dialogue";
    const exact = args.match === "exact";
    const only = Array.isArray(args.mapIds) && args.mapIds.length ? new Set(args.mapIds.map(String)) : null;
    // 자리마다 센다(맵·이벤트, 자료집 묶음·레코드) — 결과가 «어디를 바꿨나» 를 적는다.
    const hits = new Map<string, number>();
    const fix = (value: string, where: string): string => {
      if (exact) {
        if (value.trim() !== find) return value;
        hits.set(where, (hits.get(where) ?? 0) + 1);
        return dry ? value : value.replace(find, to);
      }
      if (!value.includes(find)) return value;
      const done = replaceOnce(value, find, to);
      if (!done.hits) return value;
      hits.set(where, (hits.get(where) ?? 0) + done.hits);
      return dry ? value : done.text;
    };
    const enums = enumValuesByField();
    const walk = (node: unknown, where: string, field = ""): unknown => {
      if (typeof node === "string") return enums.get(field)?.has(node) ? node : fix(node, where);
      if (Array.isArray(node)) { for (let i = 0; i < node.length; i += 1) node[i] = walk(node[i], where, field); return node; }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (NON_TEXT_KEY.test(k)) continue;
          if (dialogueOnly && k === "name") continue;
          (node as Record<string, unknown>)[k] = walk(v, where, k);
        }
      }
      return node;
    };
    const rec = (r: unknown): string => { const o = r as { id?: unknown } | null; return typeof o?.id === "string" ? o.id : "?"; };
    for (const [id, map] of Object.entries(draft.maps)) {
      if (only && !only.has(id)) continue;
      for (const event of map.events) walk(event, `map ${id} event ${event.id}`);
      if (!dialogueOnly) map.name = fix(map.name, `map ${id} name`);
    }
    if (!only) {
      for (const ce of draft.commonEvents ?? []) walk(ce, `commonEvents ${rec(ce)}`);
      if (!dialogueOnly) {
        for (const q of ((draft as unknown as { quests?: unknown[] }).quests ?? [])) walk(q, `quests ${rec(q)}`);
        const db = draft.database as unknown as Record<string, unknown>;
        // Every record list in the database (monsterSpecies, elements, crops, …), not a fixed few — a rename must reach every name the player sees.
        for (const [key, rows] of Object.entries(db)) if (Array.isArray(rows)) for (const r of rows) walk(r, `${key} ${rec(r)}`);
      }
    }
    const total = [...hits.values()].reduce((a, b) => a + b, 0);
    // 이미 바꾼 뒤 다시 부른 것인지 알린다 — «못 찾았다» 가 «안 바뀌었다» 로 읽혀 다른 방법으로 또 바꾸지 않게.
    if (!total && !exact && to.includes(find)) {
      let already = 0;
      const count = (node: unknown): void => { if (typeof node === "string") { if (node.includes(to)) already += 1; } else if (Array.isArray(node)) node.forEach(count); else if (node && typeof node === "object") for (const [k, v] of Object.entries(node as Record<string, unknown>)) if (!NON_TEXT_KEY.test(k)) count(v); };
      count(draft.maps); count(draft.commonEvents); count(draft.database);
      if (already) return { summary: `'${find}' appears only inside '${to}' now (${already} field(s)) — it was already replaced; nothing changed.`, data: { total: 0, alreadyReplaced: already, places: [] } };
    }
    if (!total) return { summary: `'${find}' not found${exact ? " as a whole field" : ""} — nothing changed.`, warnings: [`'${find}' 0 places — check spacing and attached particles with get_event, or use match:'contains'.`], data: { total: 0, places: [] } };
    const places = [...hits.entries()].map(([where, count]) => ({ where, count }));
    const shown = places.slice(0, 15).map((p) => `${p.where} ×${p.count}`).join("; ");
    return {
      summary: `${dry ? "(dry run — nothing saved) " : ""}'${find}' → '${to}': ${total} hit(s) in ${places.length} place(s)${exact ? " (whole-field matches only)" : ""}: ${shown}${places.length > 15 ? `; +${places.length - 15} more` : ""}.`,
      data: { total, places },
    };
  },
};

export const REFACTOR_TOOLS: readonly ToolDefinition[] = [renameSwitch, renameVariable, pruneUnused, replaceTextInProject];
