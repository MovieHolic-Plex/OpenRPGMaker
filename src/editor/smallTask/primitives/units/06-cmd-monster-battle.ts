import { BATTLE_START_FORMATIONS, BATTLE_START_FORMATION_LABELS } from "@/battle/battleFormation";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { newCommand } from "@/editor/eventCommandFactory";
import {
  BATTLE_DEFEAT_BRANCH_INDEX, BATTLE_ESCAPE_BRANCH_INDEX, BATTLE_VICTORY_BRANCH_INDEX,
  PROMOTE_FAILURE_BRANCH_INDEX, PROMOTE_SUCCESS_BRANCH_INDEX, resolveCommandAtPath, resolveCommandListAtPath,
} from "@/editor/eventCommandPaths";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { FIELD_SPAWN_EVENT_PREFIX } from "@/player/fieldSpawns";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { battleTroopError } from "@/project/battleAdmission";
import { eventCommandHash, EventCommandEditError, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { findLocationById, locationRect } from "@/project/mapNamedLocations";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, EventPage, FieldSpawnDef, GameMap, Project, Rect } from "@/project/types";
import { commandListAt, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError, STALE_COMMAND_LIST } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "06-cmd-monster-battle";

type Args = Record<string, unknown>;
type Mode = "insert" | "update";
type CommandSpec = {
  title: string;
  fields: Record<string, JsonSchema>;
  required?: readonly string[];
};

const text = (description: string, minLength = 1): JsonSchema => ({ type: "string", minLength, description });
const integer = (description: string, minimum: number): JsonSchema => ({ type: "integer", minimum, description });
const toggle = (description: string): JsonSchema => ({ type: "boolean", description });
const choice = (description: string, values: readonly string[]): JsonSchema => ({ type: "string", enum: values, description });
const troopId = text("자료집에서 찾은 적 무리의 식별값.");
const level = { ...integer("받는 몬스터의 레벨. 1부터 99까지.", 1), maximum: 99 };
const nickname = text("받는 몬스터의 별명. 빈 문자열을 보내면 별명을 지웁니다.", 0);
// The player creates every live enemy and its event synchronously.
const MAX_FIELD_SPAWN_ALIVE = 64;

const specs = {
  giveMonster: {
    title: "몬스터 지급",
    fields: { speciesId: text("받는 몬스터 종의 식별값. 생략하면 기본 야생 슬라임."), level, nickname },
  },
  moveMonster: {
    title: "몬스터 이동",
    fields: { instanceId: text("옮길 몬스터 개체의 식별값."), to: choice("옮길 곳. 파티 또는 보관함.", ["party", "box"]) },
    required: ["instanceId"],
  },
  evolveMonster: {
    title: "몬스터 진화",
    fields: {
      instanceId: text("진화시킬 몬스터 개체의 식별값."),
      toSpeciesId: text("진화할 종의 식별값. 비우면 조건을 만족하는 첫 진화를 고릅니다.", 0),
    },
    required: ["instanceId"],
  },
  spawnFieldEnemy: {
    title: "필드 적 출현",
    fields: {
      spawnId: text("다른 명령에서 출현을 가리킬 때 쓰는 이름. 생략하면 기본 이름을 사용합니다."),
      troopId,
      x: integer("출현 영역 왼쪽 칸. 첫 칸은 0.", 0),
      y: integer("출현 영역 위쪽 칸. 첫 칸은 0.", 0),
      w: integer("출현 영역 너비의 칸 수.", 1),
      h: integer("출현 영역 높이의 칸 수.", 1),
      maxAlive: { ...integer(`동시에 출현할 최대 마릿수. 1부터 ${MAX_FIELD_SPAWN_ALIVE}까지.`, 1), maximum: MAX_FIELD_SPAWN_ALIVE },
      respawnSec: { type: "number", minimum: 0, maximum: Number.MAX_SAFE_INTEGER / 1000, description: "다시 나오기까지 기다리는 시간(초)." },
      chase: toggle("플레이어를 뒤쫓을지 여부."),
      locationId: text("선택한 맵의 이름 있는 구역 식별값. 비우면 사각형을 사용합니다.", 0),
      factionId: text("출현한 적의 진영 식별값. 비우면 원래 진영을 따릅니다.", 0),
      persistKill: toggle("쓰러뜨린 수를 저장할지 여부."),
      onKillSwitchId: text("적을 쓰러뜨렸을 때 켜지는 스위치의 식별값. 빈 문자열을 보내면 연결을 지웁니다.", 0),
    },
    required: ["troopId"],
  },
  despawnFieldEnemy: {
    title: "필드 적 제거",
    fields: { spawnId: text("선택한 맵에서 제거할 출현의 식별값.") },
    required: ["spawnId"],
  },
  removeMonster: {
    title: "몬스터 놓아주기",
    fields: { instanceId: text("놓아줄 몬스터 개체의 식별값. 비우면 보관함의 첫 몬스터.", 0) },
  },
  tradeMonster: {
    title: "몬스터 교환",
    fields: {
      fromSpeciesId: text("내줄 몬스터 종의 식별값."),
      toSpeciesId: text("받는 몬스터 종의 식별값."),
      level,
      nickname,
    },
    required: ["fromSpeciesId", "toSpeciesId"],
  },
  fuseMonsters: {
    title: "몬스터 합성",
    fields: {
      instanceIdA: text("합성에 넣을 첫 번째 몬스터 개체의 식별값."),
      instanceIdB: text("합성에 넣을 두 번째 몬스터 개체의 식별값."),
    },
    required: ["instanceIdA", "instanceIdB"],
  },
  battleProcessing: {
    title: "전투 시작",
    fields: {
      troopId,
      troopSource: choice("적 무리를 직접 고를지, 변수에서 읽을지 선택합니다.", ["fixed", "variable"]),
      troopVariableId: text("적 무리를 읽을 변수의 식별값."),
      canEscape: toggle("전투에서 도망칠 수 있는지 여부."),
      canLose: toggle("패배해도 게임을 이어갈 수 있는지 여부."),
      battleFlow: choice("게이지가 차면 행동할지, 차례대로 한 번씩 행동할지 선택합니다.", ["gauge", "strict"]),
      branchOnResult: toggle("결과에 따라 기존 승리·패배·도망 분기를 실행할지 여부."),
      formation: choice("시작 진형. 보통, 선제 공격, 뒤에서 공격, 협공, 기습 중 하나.", BATTLE_START_FORMATIONS),
    },
  },
  tacticsBattle: {
    title: "전술 전투 시작",
    fields: {
      troopId,
      width: { ...integer("격자 가로 칸 수(4~16). 기본값은 8.", 4), maximum: 16 },
      height: { ...integer("격자 세로 칸 수(2~12). 기본값은 6.", 2), maximum: 12 },
      canLose: toggle("패배해도 게임을 이어갈 수 있는지 여부."),
    },
    required: ["troopId"],
  },
} satisfies Record<string, CommandSpec>;

type Kind = keyof typeof specs;
type BattleCommand = Extract<Command, { kind: Kind }>;

function targetPage(ctx: PrimitiveContext) {
  const result = scopedPage(ctx);
  const { map, event, page } = result;
  if (ctx.target.kind !== "event" || map.id !== ctx.target.mapId ||
    map.events.filter(entry => entry.id === event.id).length !== 1 ||
    event.pages!.filter(entry => entry.id === page.id).length !== 1) {
    throw new PrimitiveError("고른 이벤트와 페이지를 하나로 확인할 수 없습니다. 대상을 다시 골라 주세요.");
  }
  return result;
}

function scope(ctx: PrimitiveContext) {
  const { map, event, page } = targetPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id } as const;
}

const spawnFields = ["troopId", "locationId", "maxAlive", "respawnSec", "chase", "factionId", "persistKill", "onKillSwitchId"] as const;

function validateSpawnRect(map: GameMap, { x, y, w, h }: Rect): void {
  if (![x, y, w, h].every(Number.isSafeInteger) ||
    x < 0 || y < 0 || w < 1 || h < 1 || x + w > map.width || y + h > map.height) {
    throw new PrimitiveError("범위 밖 요청입니다. 출현 영역을 선택한 맵 안에 지정해 주세요.");
  }
}

function spawnPatch(ctx: PrimitiveContext, map: GameMap, current: Extract<BattleCommand, { kind: "spawnFieldEnemy" }>, fields: Args, mode: Mode): Args {
  const { spawn } = current;
  const locationId = (fields.locationId ?? spawn.locationId) as string | undefined;
  const location = locationId ? findLocationById(map, locationId) : undefined;
  const hasCoordinates = ["x", "y", "w", "h"].some(key => Object.hasOwn(fields, key));
  if (fields.locationId && !location) throw new PrimitiveError("선택한 맵에서 출현 구역을 찾을 수 없습니다.");
  if (locationId && hasCoordinates) {
    throw new PrimitiveError("이 출현은 이름 있는 구역을 따라갑니다. 칸을 직접 지정하려면 구역 지정을 비워 주세요.");
  }
  if (fields.locationId && location) validateSpawnRect(map, locationRect(location));
  const insert = mode === "insert";
  const selected = insert ? (location ? locationRect(location) : ctx.selection?.rect) : undefined;
  const base = selected ?? spawn.area;
  const x = (fields.x ?? base.x) as number;
  const y = (fields.y ?? base.y) as number;
  const w = (fields.w ?? (insert && !selected ? Math.min(base.w, map.width - x) : base.w)) as number;
  const h = (fields.h ?? (insert && !selected ? Math.min(base.h, map.height - y) : base.h)) as number;
  const area = insert || hasCoordinates ? { x, y, w, h } : spawn.area;
  if (insert || hasCoordinates || (fields.locationId === "" && spawn.locationId)) validateSpawnRect(map, area);
  if (!insert && fields.maxAlive === undefined && (spawn.maxAlive ?? 0) > MAX_FIELD_SPAWN_ALIVE) {
    const regionChanged = (locationId || undefined) !== (spawn.locationId || undefined) ||
      x !== spawn.area.x || y !== spawn.area.y || w !== spawn.area.w || h !== spawn.area.h;
    const effectiveArea = location ? locationRect(location) : area;
    if (regionChanged && effectiveArea.w * effectiveArea.h > MAX_FIELD_SPAWN_ALIVE) {
      throw new PrimitiveError(`이 출현 영역을 바꾸려면 동시 출현 마릿수를 ${MAX_FIELD_SPAWN_ALIVE} 이하로 지정해 주세요.`);
    }
  }
  let id = (fields.spawnId ?? spawn.id) as string;
  if (insert || id !== spawn.id) {
    if (!id.trim() || id !== id.trim()) throw new PrimitiveError("출현 이름을 입력하고 앞뒤 공백을 지워 주세요.");
    if (Object.hasOwn(Object.prototype, id)) throw new PrimitiveError("게임에서 예약한 이름입니다. 다른 출현 이름을 입력해 주세요.");
    const ids = new Set((map.fieldSpawns ?? []).map(entry => spawnEventIdPart(entry.id)));
    let skipCurrent = !insert;
    let referenced = false;
    for (const command of spawnCommandsOnMap(ctx.project, map)) {
      if (skipCurrent && command === current) {
        skipCurrent = false;
        continue;
      }
      if (command.kind === "spawnFieldEnemy") ids.add(spawnEventIdPart(command.spawn.id));
      if (isSpawnRemoval(command, spawn.id)) referenced = true;
    }
    if (insert && fields.spawnId === undefined) {
      for (let suffix = 2; ids.has(spawnEventIdPart(id)); suffix++) id = `${spawn.id}_${suffix}`;
    } else if (ids.has(spawnEventIdPart(id))) {
      throw new PrimitiveError("이미 쓰는 출현 이름입니다. 다른 이름을 입력해 주세요.");
    }
    if (mode === "update") {
      if (referenced || battlePagesReferenceSpawn(ctx.project, spawn.id) ||
        referencesSpawn(ctx.project, map, spawn.id, spawnEventIdPart(spawn.id) !== spawnEventIdPart(id))) {
        throw new PrimitiveError("이 출현 이름을 쓰는 명령이나 조건이 있거나 스크립트 참조를 확인할 수 없어 이름을 바꿀 수 없습니다.");
      }
      // Disabling persistence keeps the explicit false. Old saves still look up kills by this ID.
      if (spawn.persistKill !== undefined) {
        throw new PrimitiveError("처치 수 저장을 설정한 출현은 기존 기록을 이어가도록 이름을 유지해야 합니다.");
      }
    }
  }
  const next = { ...spawn, id, area };
  for (const key of spawnFields) {
    if (Object.hasOwn(fields, key)) Object.assign(next, { [key]: fields[key] });
  }
  for (const key of ["locationId", "onKillSwitchId", "factionId"] as const) {
    if (fields[key] === "") delete next[key];
  }
  return { spawn: next };
}

// The runtime uses this part to build each spawned enemy's event ID.
function spawnEventIdPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function referencesSpawn(project: Project, map: GameMap, spawnId: string, eventIdChanges: boolean): boolean {
  const prefix = `${FIELD_SPAWN_EVENT_PREFIX}${spawnEventIdPart(spawnId)}_`;
  const matchesId = (id: string) => eventIdChanges && id.startsWith(prefix) && /^\d+$/u.test(id.slice(prefix.length));
  if (Object.keys(project.session.selfSwitches ?? {}).some(matchesId)) return true;

  function containsReference(value: unknown): boolean {
    if (typeof value === "string") return matchesId(value);
    if (value === null || typeof value !== "object") return false;
    const entry = value as Record<string, unknown>;
    // game.cmd can compute both the command kind and the raw or generated ID at runtime.
    // Script effects do not record spawn IDs, so keep the ID if executable code can reach this map.
    if (typeof entry.compiled === "string" && entry.compiled.trim()) return true;
    return Object.values(entry).some(containsReference);
  }
  return containsReference([
    map.events, map.encounterTable, project.commonEvents, project.database.troops,
    project.session.farmAnimals, project.quests, project.scriptLibrary,
  ]);
}

function* spawnCommandsOnMap(project: Project, map: GameMap) {
  for (const event of map.events) {
    yield* spawnCommands(event.commands);
    for (const page of event.pages ?? []) yield* spawnCommands(page.commands);
    if (event.draft?.kind === "edit" && event.draft.original) {
      yield* spawnCommands(event.draft.original.commands);
      for (const page of event.draft.original.pages ?? []) yield* spawnCommands(page.commands);
    }
  }
  for (const event of project.commonEvents) yield* spawnCommands(event.commands);
  for (const troop of project.database.troops) {
    for (const { commands } of troopAfterBattleLists(troop)) yield* spawnCommands(commands);
  }
}

type SpawnCommand = Extract<BattleCommand, { kind: "spawnFieldEnemy" | "despawnFieldEnemy" }>;

function* spawnCommands(commands: readonly Command[]): Generator<SpawnCommand> {
  for (const command of commands) {
    if (command.kind === "spawnFieldEnemy" || command.kind === "despawnFieldEnemy") yield command;
    for (const branch of nestedCommandLists(command)) yield* spawnCommands(branch);
  }
}

function isSpawnRemoval(command: SpawnCommand, id: string): boolean {
  return command.kind === "despawnFieldEnemy" && command.spawnId === id;
}

function battlePagesReferenceSpawn(project: Project, id: string): boolean {
  // Battle pages can contain authored references, but only field commands can create a spawn.
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      for (const command of spawnCommands(page.commands)) {
        if (isSpawnRemoval(command, id)) return true;
      }
    }
  }
  return false;
}

function findPossibleSpawn(project: Project, map: GameMap, id: string): FieldSpawnDef | undefined {
  const existing = map.fieldSpawns?.find(spawn => spawn.id === id);
  if (existing) return existing;
  for (const command of spawnCommandsOnMap(project, map)) {
    if (command.kind === "spawnFieldEnemy" && command.spawn.id === id) return command.spawn;
  }
  return undefined;
}

function validateTroop(project: Project, id: string, missingMessage: string): void {
  if (!id.trim()) throw new PrimitiveError(missingMessage);
  const error = battleTroopError(project, id);
  if (error) {
    const message = error.code === "BATTLE_TROOP_EMPTY" ? "선택한 적 무리에 전투에 나올 적을 넣어 주세요."
      : error.code === "BATTLE_ENEMY_MISSING" ? "선택한 적 무리에 자료집에서 사라진 적이 있습니다. 무리 구성을 확인해 주세요."
      : missingMessage;
    throw new PrimitiveError(message);
  }
}

function validateSpecies(project: Project, id: string): void {
  if (!id.trim() || !project.database.monsterSpecies?.some(species => species.id === id)) {
    throw new PrimitiveError("자료집에서 몬스터 종을 찾을 수 없습니다.");
  }
}

function runtimeMonsterNumber(id: string): number | undefined {
  const match = /^monster_([1-9]\d*)$/u.exec(id);
  const number = Number(match?.[1]);
  return Number.isSafeInteger(number) ? number : undefined;
}

function validateReferences(project: Project, map: GameMap, command: BattleCommand, fields: Args): void {
  switch (command.kind) {
    case "giveMonster":
      validateSpecies(project, command.speciesId);
      return;
    case "moveMonster":
    case "evolveMonster":
    case "removeMonster":
    case "fuseMonsters": {
      const ids = command.kind === "fuseMonsters" ? [command.instanceIdA, command.instanceIdB] : [command.instanceId];
      // Runtime gifts and captures allocate numbered IDs independently of the starting roster.
      if (ids.some(id => {
        if (command.kind === "removeMonster" && id === "") return false;
        const knownId = id.trim() && (command.kind !== "removeMonster" || id === id.trim()) &&
          Object.hasOwn(project.session.monsterInstances ?? {}, id);
        return !knownId && runtimeMonsterNumber(id) === undefined;
      })) {
        throw new PrimitiveError("선택한 몬스터 개체를 찾을 수 없습니다.");
      }
      if (command.kind === "fuseMonsters" && command.instanceIdA === command.instanceIdB) {
        throw new PrimitiveError("서로 다른 몬스터 두 마리를 골라 주세요.");
      }
      if (command.kind === "evolveMonster" && command.toSpeciesId) validateSpecies(project, command.toSpeciesId);
      return;
    }
    case "tradeMonster":
      if (!command.fromSpeciesId.trim() || !command.toSpeciesId.trim()) throw new PrimitiveError("교환할 몬스터 종을 둘 다 골라 주세요.");
      validateSpecies(project, command.fromSpeciesId);
      validateSpecies(project, command.toSpeciesId);
      return;
    case "battleProcessing":
      if (command.troopSource === "variable") {
        if (Object.hasOwn(fields, "troopId")) throw new PrimitiveError("적 무리를 변수에서 읽도록 설정되어 있습니다. 적 무리를 직접 고르는 방식으로 바꿔 주세요.");
        if (!command.troopVariableId?.trim() || !project.variables.some(variable => variable.id === command.troopVariableId)) {
          throw new PrimitiveError("자료집에서 전투에 쓸 변수를 찾을 수 없습니다.");
        }
      } else {
        if (Object.hasOwn(fields, "troopVariableId")) throw new PrimitiveError("전투에 쓸 변수를 지정하려면 적 무리를 변수에서 읽는 방식으로 바꿔 주세요.");
        validateTroop(project, command.troopId, "자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.");
      }
      return;
    case "tacticsBattle":
      validateTroop(project, command.troopId, "자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.");
      return;
    case "spawnFieldEnemy": {
      const { spawn } = command;
      if (!spawn.id.trim()) throw new PrimitiveError("출현을 가리킬 이름을 입력해 주세요.");
      if (spawn.onKillSwitchId && !project.switches.some(entry => entry.id === spawn.onKillSwitchId)) {
        throw new PrimitiveError("자료집에서 쓰러뜨렸을 때 켤 스위치를 찾을 수 없습니다.");
      }
      if (spawn.factionId && spawn.factionId !== PLAYER_FACTION_ID && spawn.factionId !== DEFAULT_ENEMY_FACTION_ID &&
        !project.factions?.defs.some(entry => entry.id === spawn.factionId)) {
        throw new PrimitiveError("자료집에서 출현에 쓸 진영을 찾을 수 없습니다.");
      }
      validateTroop(project, spawn.troopId, "자료집에서 출현할 적 무리를 찾을 수 없습니다.");
      return;
    }
    case "despawnFieldEnemy": {
      const { spawnId } = command;
      if (!spawnId.trim() || !findPossibleSpawn(project, map, spawnId)) {
        throw new PrimitiveError("선택한 맵에서 제거할 적 무리의 출현을 찾을 수 없습니다.");
      }
      return;
    }
  }
}

function canCreateBranch(page: EventPage, path: number[]): boolean {
  if (path.length < 2 || path.length % 2 !== 0) return false;
  const parent = commandListAt(page, path.slice(0, -2))[path.at(-2)!];
  return Boolean(parent && eventCommandBranches(parent).some(branch => branch.branchIndex === path.at(-1)));
}

function requireActiveBattleBranches(page: EventPage, path: readonly number[]): void {
  for (let depth = 0; depth < path.length; depth += 2) {
    const branch = path[depth + 1];
    if (branch !== BATTLE_VICTORY_BRANCH_INDEX && branch !== BATTLE_DEFEAT_BRANCH_INDEX && branch !== BATTLE_ESCAPE_BRANCH_INDEX) continue;
    const parent = resolveCommandAtPath(page.commands, path.slice(0, depth + 1));
    if (parent?.kind === "battleProcessing" && parent.branchOnResult !== true) {
      throw new PrimitiveError("이 전투의 결과 분기를 먼저 켠 뒤 분기 안의 명령을 고쳐 주세요.");
    }
  }
}

function validateBranchTarget(page: EventPage, list: Command[], path: number[], createBranch: boolean): void {
  if (!path.length) return;
  // Cloning a page preserves shared arrays and rows. Editing a shared branch would edit both paths.
  const parent = createBranch ? commandListAt(page, path.slice(0, -2))[path.at(-2)!] : undefined;
  let occurrences = 0;
  function visit(commands: readonly Command[]): void {
    if (commands === list) occurrences++;
    for (const command of commands) {
      if (command === parent) occurrences++;
      if (occurrences > 1) return;
      for (const branch of nestedCommandLists(command)) visit(branch);
    }
  }
  visit(page.commands);
  if (occurrences > 1) throw new PrimitiveError("명령 분기 위치를 하나로 확인할 수 없습니다. 페이지를 다시 확인해 주세요.");
}

function prepare(ctx: PrimitiveContext, kind: Kind, mode: Mode, args: Args) {
  const { map, page } = targetPage(ctx);
  const spec: CommandSpec = specs[kind];
  if (page.trigger.kind === "parallel" &&
    (kind === "spawnFieldEnemy" || kind === "despawnFieldEnemy" || kind === "tacticsBattle")) {
    throw new PrimitiveError(`병렬 실행 페이지에서는 ‘${spec.title}’ 명령이 실행되지 않습니다. 다른 페이지를 골라 주세요.`);
  }
  const branchPath = (args.branchPath ?? []) as number[];
  requireActiveBattleBranches(page, branchPath);
  const createBranch = mode === "insert" && !resolveCommandListAtPath(page.commands, [...branchPath, 0]) && canCreateBranch(page, branchPath);
  const list = createBranch ? [] : commandListAt(page, branchPath);
  validateBranchTarget(page, list, branchPath, createBranch);
  const index = (args.index ?? list.length) as number;
  if (!Number.isSafeInteger(index) || index < 0 || index >= list.length + Number(mode === "insert")) {
    throw new PrimitiveError("명령 줄의 위치가 올바르지 않습니다. 페이지에서 줄 번호를 다시 확인해 주세요.");
  }
  const path = [...branchPath, index];
  const current = mode === "insert" ? newCommand(kind) : list[index];
  if (current?.kind !== kind) throw new PrimitiveError("선택한 줄에서 이 종류의 명령을 찾을 수 없습니다.");
  if (mode === "update" && args.expectedHash !== eventCommandHash(current)) {
    throw new PrimitiveError(STALE_COMMAND_LIST);
  }
  const fields = Object.fromEntries(Object.keys(spec.fields).filter(key => Object.hasOwn(args, key)).map(key => [key, args[key]]));
  if (mode === "update" && Object.keys(fields).length === 0) throw new PrimitiveError("고칠 명령 내용을 입력해 주세요.");
  if (typeof fields.nickname === "string") fields.nickname = fields.nickname.trim();
  const patch = current.kind === "spawnFieldEnemy" ? spawnPatch(ctx, map, current, fields, mode) : fields;
  if (mode === "insert" && kind === "battleProcessing" && fields.branchOnResult === true) {
    Object.assign(patch, { victoryBranch: [], defeatBranch: [], escapeBranch: [] });
  }
  const command = { ...current, ...patch } as BattleCommand;
  validateReferences(ctx.project, map, command, fields);
  return { map, command, patch, current, path };
}

function previewText(value: string, fallback: string): string {
  return displayText(value.replace(/[.!?。！？{}[\]"]/gu, " "), fallback).slice(0, 20);
}

function nameOf(records: readonly { id: string; name: string }[] | undefined, id: string | undefined, fallback: string): string {
  const record = records?.find(entry => entry.id === id);
  return record && record.name !== id ? previewText(record.name, fallback) : fallback;
}

function describeCommand(project: Project, map: GameMap, command: BattleCommand, args: Args): string {
  const species = (id: string) => nameOf(project.database.monsterSpecies, id, "선택한 몬스터");
  const troop = (id: string) => nameOf(project.database.troops, id, "선택한 적 무리");
  const instance = (id: string) => {
    const instances = project.session.monsterInstances ?? {};
    const known = Object.hasOwn(instances, id) ? instances[id] : undefined;
    if (known) return previewText(known.nickname ?? "", species(known.speciesId));
    return `개체 번호 ${runtimeMonsterNumber(id)}`;
  };
  const defeat = (canLose?: boolean) => canLose ? "져도 계속" : "지면 게임 오버";
  const alias = (value?: string) => value?.trim() ? ` · 별명 ${previewText(value, "설정")}` : Object.hasOwn(args, "nickname") ? " · 별명 지움" : "";
  switch (command.kind) {
    case "giveMonster":
      return `레벨 ${command.level} ${species(command.speciesId)} 한 마리 지급${alias(command.nickname)}`;
    case "moveMonster":
      return `${instance(command.instanceId)} · ${command.to === "party" ? "파티로" : "보관함으로"} 이동`;
    case "evolveMonster":
      return `${instance(command.instanceId)} · ${command.toSpeciesId ? `${species(command.toSpeciesId)} 진화` : "조건에 맞는 첫 진화 시도"}`;
    case "removeMonster":
      return `${command.instanceId ? instance(command.instanceId) : "보관함 첫 몬스터"} 놓아주기`;
    case "tradeMonster":
      return `${species(command.fromSpeciesId)} → ${species(command.toSpeciesId)} 교환${command.level ? ` · 레벨 ${command.level}` : ""}${alias(command.nickname)}`;
    case "fuseMonsters":
      return `${instance(command.instanceIdA)}와 ${instance(command.instanceIdB)} 합성`;
    case "spawnFieldEnemy": {
      const { spawn } = command;
      const location = spawn.locationId ? findLocationById(map, spawn.locationId) : undefined;
      return [
        `${troop(spawn.troopId)} 필드 출현`,
        location ? previewText(location.name, "지정한 구역") : `${spawn.area.w}×${spawn.area.h}칸`,
        spawn.maxAlive === undefined ? "" : `최대 ${spawn.maxAlive}마리`,
        spawn.respawnSec === undefined ? "" : `${spawn.respawnSec}초 뒤 재출현`,
        spawn.chase ? "추격" : "추격 안 함",
      ].filter(Boolean).join(" · ");
    }
    case "despawnFieldEnemy": {
      const spawn = findPossibleSpawn(project, map, command.spawnId);
      return spawn ? `${troop(spawn.troopId)} 필드에서 제거` : "필드에 나온 적 무리 제거";
    }
    case "battleProcessing": {
      const opponent = command.troopSource === "variable"
        ? nameOf(project.variables, command.troopVariableId, "변수") + "에서 읽은 적 무리"
        : troop(command.troopId);
      const details = [
        `전투 · ${opponent}`,
        command.canEscape ? "도망 가능" : "도망 불가",
        defeat(command.canLose),
        command.battleFlow === "strict" ? "엄격한 턴 진행" : command.battleFlow === "gauge" ? "게이지 진행" : "",
        command.formation ? BATTLE_START_FORMATION_LABELS[command.formation] : "",
        command.branchOnResult ? "결과 분기" : "",
      ];
      return details.filter(Boolean).join(" · ");
    }
    case "tacticsBattle":
      return `전술 전투 · ${troop(command.troopId)} · ${command.width ?? 8}×${command.height ?? 6}칸 · ${defeat(command.canLose)}`;
  }
}

function updateCommand(page: EventPage, path: number[], current: BattleCommand, patch: Args, hash: string) {
  const { branchOnResult, ...fields } = patch;
  if (current.kind !== "battleProcessing" || typeof branchOnResult !== "boolean") {
    return updateEventCommand(page, path, patch, hash);
  }
  // The single-line editor counts visible branch slots as branches. Store the flag separately
  // on its cloned row so enabling empty slots does not look like rewriting child commands.
  const edited = updateEventCommand(page, path, fields, hash);
  const list = resolveCommandListAtPath(edited.commands, path)!;
  const battle = list[path.at(-1)!] as typeof current;
  battle.branchOnResult = branchOnResult;
  if (battle.branchOnResult) {
    battle.victoryBranch ??= [];
    battle.defeatBranch ??= [];
    battle.escapeBranch ??= [];
  }
  return edited;
}

function primitive(kind: Kind, mode: Mode): SmallTaskPrimitive {
  const spec: CommandSpec = specs[kind];
  const update = mode === "update";
  const action = update ? "수정" : "추가";
  return {
    id: `cmd.${kind}.${mode}`,
    unit: UNIT,
    title: `${spec.title} ${action}`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      properties: {
        index: integer(update ? "고칠 줄 번호. 첫 줄은 0." : "끼워 넣을 줄 번호. 첫 줄은 0이며, 생략하면 목록 끝.", 0),
        branchPath: {
          type: "array", items: { type: "integer" },
          description: "get_event에서 읽은 줄의 분기 경로. 바깥 목록은 생략합니다. 빈 분기에는 부모 줄의 경로 뒤에 부모 줄 번호와 분기 번호를 붙입니다. " +
            `전투의 승리·패배·도망은 ${BATTLE_VICTORY_BRANCH_INDEX}, ${BATTLE_DEFEAT_BRANCH_INDEX}, ${BATTLE_ESCAPE_BRANCH_INDEX}. ` +
            `진화의 성공·실패는 ${PROMOTE_SUCCESS_BRANCH_INDEX}, ${PROMOTE_FAILURE_BRANCH_INDEX}.`,
        },
        ...(update ? { expectedHash: text("get_event에서 includeCommandHashes를 켜고 읽은 해당 줄의 hash. 그 사이 줄이 바뀌었는지 확인합니다.") } : {}),
        ...spec.fields,
      },
      required: update ? ["index", "expectedHash"] : spec.required,
      additionalProperties: false,
    },
    scope,
    describe(ctx, args) {
      const { map, command } = prepare(ctx, kind, mode, args);
      const details = describeCommand(ctx.project, map, command, args);
      return koreanSentence(`‘${details.length > 66 ? details.slice(0, 65) + "…" : details}’ 명령을 ${action}했습니다.`);
    },
    apply(ctx, args) {
      const { command, patch, current, path } = prepare(ctx, kind, mode, args);
      try {
        return updateScopedPage(ctx, page => update
          ? updateCommand(page, path, current, patch, args.expectedHash as string)
          : insertEventCommand(page, path, command));
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        if (error.code === "stale-event-command") throw error;
        throw new PrimitiveError("명령 줄의 위치나 내용이 올바르지 않습니다.");
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(specs) as Kind[])
  .flatMap(kind => [primitive(kind, "insert"), primitive(kind, "update")]);
