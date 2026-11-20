import { BATTLE_START_FORMATIONS, BATTLE_START_FORMATION_LABELS } from "@/battle/battleFormation";
import { newCommand } from "@/editor/eventCommandFactory";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { battleTroopError } from "@/project/battleAdmission";
import { eventCommandHash, EventCommandEditError, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import type { Command, EventPage, GameMap, Project } from "@/project/types";
import { commandListAt, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
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
const nickname = text("받는 몬스터의 별명. 빈 글자로 별명을 비웁니다.", 0);

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
      spawnId: text("출현을 나중에 참조할 이름. 생략하면 기본 이름을 사용합니다."),
      troopId,
      x: integer("출현 영역 왼쪽 칸. 첫 칸은 0.", 0),
      y: integer("출현 영역 위쪽 칸. 첫 칸은 0.", 0),
      w: integer("출현 영역 너비의 칸 수.", 1),
      h: integer("출현 영역 높이의 칸 수.", 1),
      maxAlive: integer("동시에 출현할 최대 수.", 1),
      respawnSec: { type: "number", minimum: 0, description: "다시 나오기까지 기다리는 초." },
      chase: toggle("플레이어를 뒤쫓을지 여부."),
      locationId: text("선택한 맵의 이름 있는 구역 식별값. 비우면 사각형을 사용합니다.", 0),
      factionId: text("출현한 적의 진영 식별값. 비우면 원래 진영을 따릅니다.", 0),
      persistKill: toggle("쓰러뜨린 수를 저장할지 여부."),
      onKillSwitchId: text("쓰러뜨렸을 때 켤 스위치의 식별값. 빈 글자로 연결을 비웁니다.", 0),
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
      battleFlow: choice("게이지 진행 또는 엄격한 턴 진행.", ["gauge", "strict"]),
      branchOnResult: toggle("결과에 따라 기존 승리·패배·도망 분기를 실행할지 여부."),
      formation: choice("시작 진형. 보통, 선제 공격, 뒤에서 공격, 협공, 기습 중 하나.", BATTLE_START_FORMATIONS),
    },
  },
  tacticsBattle: {
    title: "전술 전투 시작",
    fields: {
      troopId,
      width: integer("전술 격자 너비의 칸 수. 기본값은 8.", 4),
      height: integer("전술 격자 높이의 칸 수. 기본값은 6.", 2),
      canLose: toggle("패배해도 게임을 이어갈 수 있는지 여부."),
    },
    required: ["troopId"],
  },
} satisfies Record<string, CommandSpec>;

type Kind = keyof typeof specs;
type BattleCommand = Extract<Command, { kind: Kind }>;

function scope(ctx: PrimitiveContext) {
  const { map, event, page } = scopedPage(ctx);
  return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id } as const;
}

const spawnFields = ["troopId", "locationId", "maxAlive", "respawnSec", "chase", "factionId", "persistKill", "onKillSwitchId"] as const;

function spawnPatch(ctx: PrimitiveContext, map: GameMap, current: Extract<BattleCommand, { kind: "spawnFieldEnemy" }>, fields: Args, mode: Mode): Args {
  const { spawn } = current;
  const locationId = fields.locationId;
  const areaChanged = mode === "insert" || ["x", "y", "w", "h"].some(key => Object.hasOwn(fields, key));
  const base = mode === "insert" ? ctx.selection?.rect ?? {
    ...spawn.area, w: Math.min(spawn.area.w, map.width), h: Math.min(spawn.area.h, map.height),
  } : spawn.area;
  const x = (fields.x ?? base.x) as number;
  const y = (fields.y ?? base.y) as number;
  const w = (fields.w ?? (mode === "insert" && !ctx.selection?.rect ? Math.min(base.w, map.width - x) : base.w)) as number;
  const h = (fields.h ?? (mode === "insert" && !ctx.selection?.rect ? Math.min(base.h, map.height - y) : base.h)) as number;
  if (areaChanged && (![x, y, w, h].every(Number.isSafeInteger) ||
    x < 0 || y < 0 || w < 1 || h < 1 || x + w > map.width || y + h > map.height)) {
    throw new PrimitiveError("범위 밖 요청입니다. 출현 영역을 선택한 맵 안에 지정해 주세요.");
  }
  if (locationId && !map.locations?.some(location => location.id === locationId)) {
    throw new PrimitiveError("선택한 맵에서 출현 구역을 찾을 수 없습니다.");
  }
  let id = (fields.spawnId ?? spawn.id) as string;
  if (mode === "insert" && fields.spawnId === undefined) {
    for (let suffix = 2; hasPossibleSpawn(ctx.project, map, id); suffix++) id = `${spawn.id}_${suffix}`;
  }
  const next = { ...spawn, id, area: areaChanged ? { x, y, w, h } : spawn.area };
  for (const key of spawnFields) {
    if (Object.hasOwn(fields, key)) Object.assign(next, { [key]: fields[key] });
  }
  for (const key of ["locationId", "onKillSwitchId", "factionId"] as const) {
    if (next[key] === "") delete next[key];
  }
  return { spawn: next };
}

function hasSpawn(commands: readonly Command[], id: string): boolean {
  return commands.some(command =>
    (command.kind === "spawnFieldEnemy" && command.spawn.id === id) ||
    nestedCommandLists(command).some(branch => hasSpawn(branch, id)));
}

function hasPossibleSpawn(project: Project, map: GameMap, id: string): boolean {
  return Boolean(
    map.fieldSpawns?.some(spawn => spawn.id === id) ||
    map.events.some(event => hasSpawn(event.commands, id) || event.pages?.some(page => hasSpawn(page.commands, id))) ||
    project.commonEvents.some(event => hasSpawn(event.commands, id)),
  );
}

function validateTroop(project: Project, id: string, missingMessage: string): void {
  const error = battleTroopError(project, id);
  if (error) {
    throw new PrimitiveError(error.code === "BATTLE_TROOP_MISSING" ? missingMessage : "선택한 적 무리에 전투에 나올 적을 넣어 주세요.");
  }
}

function referenceContext(project: Project): ReferenceContext {
  // These commands reference species, troops and variables. Branch commands keep their original context.
  const empty = new Set<string>();
  return {
    actorIds: empty, classIds: empty, enemyIds: empty, itemIds: empty, equipmentIds: empty,
    skillIds: empty, animationIds: empty, switchIds: empty, commonEventIds: empty,
    endingIds: empty, gameOverIds: empty, mapIds: empty, resourceIds: empty,
    speciesIds: new Set(project.database.monsterSpecies?.map(species => species.id)),
    troopIds: new Set(project.database.troops.map(troop => troop.id)),
    variableIds: new Set(project.variables.map(variable => variable.id)),
  };
}

function validateReferences(project: Project, map: GameMap, command: BattleCommand): void {
  let leaf: Command = command;
  let message = "자료집에서 몬스터 종을 찾을 수 없습니다.";
  switch (command.kind) {
    case "moveMonster":
    case "evolveMonster":
    case "removeMonster":
    case "fuseMonsters": {
      const ids = command.kind === "fuseMonsters" ? [command.instanceIdA, command.instanceIdB] : [command.instanceId];
      // Runtime gifts and captures allocate numbered IDs independently of the starting roster.
      if (ids.some(id => !(command.kind === "removeMonster" && id === "") &&
        !Object.hasOwn(project.session.monsterInstances ?? {}, id) && !/^monster_[1-9]\d*$/u.test(id))) {
        throw new PrimitiveError("선택한 몬스터 개체를 찾을 수 없습니다.");
      }
      if (command.kind === "fuseMonsters" && command.instanceIdA === command.instanceIdB) {
        throw new PrimitiveError("서로 다른 몬스터 두 마리를 골라 주세요.");
      }
      if (command.kind === "evolveMonster") leaf = { ...command, successBranch: [], failureBranch: [] };
      break;
    }
    case "tradeMonster":
      if (!command.fromSpeciesId.trim() || !command.toSpeciesId.trim()) throw new PrimitiveError("교환할 몬스터 종을 둘 다 골라 주세요.");
      break;
    case "battleProcessing":
      if (command.troopSource === "variable") {
        message = "자료집에서 전투에 쓸 변수를 찾을 수 없습니다.";
        if (!command.troopVariableId?.trim()) throw new PrimitiveError(message);
      } else {
        message = "자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.";
      }
      leaf = { ...command, victoryBranch: [], defeatBranch: [], escapeBranch: [] };
      break;
    case "tacticsBattle":
      message = "자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.";
      leaf = { ...command, victoryBranch: [], defeatBranch: [] };
      break;
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
      if (!spawnId.trim() || !hasPossibleSpawn(project, map, spawnId)) {
        throw new PrimitiveError("선택한 맵에서 제거할 적의 출현을 찾을 수 없습니다.");
      }
      return;
    }
  }
  try {
    validateCommands([leaf], referenceContext(project));
  } catch {
    throw new PrimitiveError(message);
  }
  if ((leaf.kind === "battleProcessing" && leaf.troopSource !== "variable") || leaf.kind === "tacticsBattle") {
    validateTroop(project, leaf.troopId, message);
  }
}

function prepare(ctx: PrimitiveContext, kind: Kind, mode: Mode, args: Args) {
  const { map, page } = scopedPage(ctx);
  const spec: CommandSpec = specs[kind];
  const branchPath = (args.branchPath ?? []) as number[];
  const list = commandListAt(page, branchPath);
  const index = (args.index ?? list.length) as number;
  const path = [...branchPath, index];
  const current = mode === "insert" ? newCommand(kind) : list[index];
  if (current?.kind !== kind) throw new PrimitiveError("선택한 줄에서 이 종류의 명령을 찾을 수 없습니다.");
  const fields = Object.fromEntries(Object.keys(spec.fields).filter(key => Object.hasOwn(args, key)).map(key => [key, args[key]]));
  if (mode === "update" && Object.keys(fields).length === 0) throw new PrimitiveError("고칠 명령 내용을 입력해 주세요.");
  const patch = current.kind === "spawnFieldEnemy" ? spawnPatch(ctx, map, current, fields, mode) : fields;
  if (mode === "insert" && kind === "battleProcessing" && fields.branchOnResult === true) {
    Object.assign(patch, { victoryBranch: [], defeatBranch: [], escapeBranch: [] });
  }
  const command = { ...current, ...patch } as BattleCommand;
  validateReferences(ctx.project, map, command);
  return { command, patch, current, path };
}

function previewText(value: string, fallback: string): string {
  return displayText(value.replace(/[.!?。！？{}[\]"]/gu, " "), fallback).slice(0, 20);
}

function nameOf(records: readonly { id: string; name: string }[] | undefined, id: string | undefined, fallback: string): string {
  const record = records?.find(entry => entry.id === id);
  return record && record.name !== id ? previewText(record.name, fallback) : fallback;
}

function describeCommand(project: Project, command: BattleCommand, args: Args): string {
  const species = (id: string) => nameOf(project.database.monsterSpecies, id, "선택한 몬스터");
  const troop = (id: string) => nameOf(project.database.troops, id, "선택한 적 무리");
  const defeat = (canLose?: boolean) => canLose ? "져도 계속" : "지면 게임 오버";
  const alias = (value?: string) => value ? ` · 별명 ${previewText(value, "설정")}` : args.nickname === "" ? " · 별명 비움" : "";
  switch (command.kind) {
    case "giveMonster":
      return `레벨 ${command.level} ${species(command.speciesId)} 한 마리 지급${alias(command.nickname)}`;
    case "evolveMonster":
      return command.toSpeciesId ? `몬스터 진화 · ${species(command.toSpeciesId)}` : "조건을 충족하는 첫 진화 실행";
    case "tradeMonster":
      return `${species(command.fromSpeciesId)} → ${species(command.toSpeciesId)} 교환${command.level ? ` · 레벨 ${command.level}` : ""}${alias(command.nickname)}`;
    case "spawnFieldEnemy": {
      const { spawn } = command;
      return [
        `${troop(spawn.troopId)} 필드 출현`,
        spawn.maxAlive === undefined ? "" : `최대 ${spawn.maxAlive}마리`,
        spawn.respawnSec === undefined ? "" : `${spawn.respawnSec}초 뒤 재출현`,
        `${spawn.area.w}×${spawn.area.h}칸`,
        spawn.chase ? "추격" : "추격 안 함",
      ].filter(Boolean).join(" · ");
    }
    case "despawnFieldEnemy":
      return "필드에 나온 적 무리 제거";
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
    default:
      return commandSummary(command).replace(": ", " · ");
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
        branchPath: { type: "array", items: { type: "integer" }, description: "분기 안의 줄이면 조회한 분기 경로. 바깥 목록은 생략합니다." },
        ...(update ? { expectedHash: text("조회한 명령의 내용 확인값. 주면 내용이 달라진 줄을 수정하지 않습니다.") } : {}),
        ...spec.fields,
      },
      required: update ? ["index"] : spec.required,
      additionalProperties: false,
    },
    scope,
    describe(ctx, args) {
      const { command } = prepare(ctx, kind, mode, args);
      const details = describeCommand(ctx.project, command, args);
      return koreanSentence(`‘${details.length > 66 ? details.slice(0, 65) + "…" : details}’ 명령을 ${action}했습니다.`);
    },
    apply(ctx, args) {
      const { command, patch, current, path } = prepare(ctx, kind, mode, args);
      try {
        return updateScopedPage(ctx, page => update
          ? updateCommand(page, path, current, patch, (args.expectedHash as string | undefined) ?? eventCommandHash(current))
          : insertEventCommand(page, path, command));
      } catch (error) {
        if (!(error instanceof EventCommandEditError)) throw error;
        throw new PrimitiveError(error.code === "stale-event-command" ? error.message : "명령 줄의 위치나 내용이 올바르지 않습니다.");
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(specs) as Kind[])
  .flatMap(kind => [primitive(kind, "insert"), primitive(kind, "update")]);
