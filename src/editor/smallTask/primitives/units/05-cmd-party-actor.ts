import { CHARSET_CHARACTER_COUNT, charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { newCommand } from "@/editor/eventCommandFactory";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { EventCommandEditError, insertEventCommand, updateEventCommand } from "@/project/eventCommands/singleCommandOps";
import { charsetFollowerGraphic } from "@/project/followers";
import { normalizePartySetId } from "@/project/partySets";
import type { Command, EventPage, Project } from "@/project/types";
import { commandListAt, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { SmallTaskPrimitive } from "../types";
import { validatePartyActorCommand, validatePartyActorRename } from "./05-cmd-party-actor/references";
import { describePartyActorCommand } from "./05-cmd-party-actor/describe";

export const UNIT = "05-cmd-party-actor";

const key = (description: string): JsonSchema => ({ type: "string", description });
const choice = (description: string, ...values: string[]): JsonSchema => ({ ...key(description), enum: values });
const actor = key("자료집에서 확인한 주인공의 식별자.");
const optionalActor = key("자료집에서 확인한 주인공의 식별자. 파티 전체를 대상으로 할 때는 빈 문자열을 입력합니다.");
const op = choice("지정한 값으로 설정하거나 더하거나 뺍니다.", "=", "+=", "-=");
const amount = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER, description: "직접 지정할 0 이상의 정수." } satisfies JsonSchema;
const variable = { ...key("수치를 읽어 올 변수의 식별자. 직접 지정하는 수치와 함께 쓰지 않습니다."), minLength: 1 };
const mode = choice("고정 수치 또는 최대치에 대한 백분율.", "flat", "percent");
const partySet = { ...key("게임 중 파티를 저장하거나 불러올 때 사용하는 이름."), minLength: 1, maxLength: 32 };
const coordinate = { type: "integer", minimum: 0 } as const;

const commands = {
  learnSkill: {
    title: "스킬 변경", required: ["skillId"],
    fields: { actorId: optionalActor, skillId: key("자료집에서 확인한 스킬의 식별자."), action: choice("배우기 또는 잊기.", "learn", "forget") },
  },
  changeExp: {
    title: "경험치 변경", required: [],
    fields: { actorId: optionalActor, op, amount, amountVariableId: variable },
  },
  changeLevel: {
    title: "레벨 변경", required: ["actorId"], fields: { actorId: actor, op, amount: { ...amount, description: "직접 지정할 정수. 레벨을 특정 값으로 맞출 때는 1부터 99까지입니다." } },
  },
  changeLifeSkillExp: {
    title: "생활 스킬 경험치 변경", required: ["skillId"],
    fields: { skillId: key("자료집에서 확인한 생활 스킬의 식별자."), op, amount, amountVariableId: variable },
  },
  promoteActor: {
    title: "승급", required: ["actorId"],
    fields: { actorId: actor, toClassId: key("승급할 직업의 식별자. 게임에서 자동 선택하게 할 때는 빈 문자열을 입력합니다.") },
  },
  changeEquipment: {
    title: "장비 변경", required: ["actorId"],
    fields: { actorId: actor, slot: key("자료집에서 확인한 장비 부위의 식별자."), equipmentId: key("착용할 장비의 식별자. 장비를 벗길 때는 빈 문자열을 입력합니다.") },
  },
  changeActorHp: {
    title: "체력 변경", required: ["actorId"], fields: { actorId: optionalActor, op, amount, amountMode: mode },
  },
  changeActorMp: {
    title: "마력 변경", required: ["actorId"], fields: { actorId: optionalActor, op, amount, amountMode: mode },
  },
  recoverAll: {
    title: "완전 회복", required: [], fields: { actorId: optionalActor },
  },
  changeParty: {
    title: "파티 멤버 변경", required: ["actorId"],
    fields: { actorId: actor, action: choice("파티에 추가하거나 제외하거나 선두로 옮깁니다.", "add", "remove", "lead") },
  },
  storeParty: {
    title: "파티 저장", required: [],
    fields: {
      partySetId: partySet,
      actorIds: { type: "array", minItems: 1, items: key("구성원의 주인공 식별자."), description: "미리 지정할 구성원 목록. 생략하면 현재 파티를 저장합니다." },
      mapId: key("미리 정할 위치의 맵 식별자. 지정할 때는 가로·세로 좌표를 모두 입력합니다. 생략하면 실행 시의 맵을 사용합니다."),
      x: { ...coordinate, description: "미리 정할 위치의 가로 칸. 생략하면 실행 시의 위치를 사용합니다." },
      y: { ...coordinate, description: "미리 정할 위치의 세로 칸. 생략하면 실행 시의 위치를 사용합니다." },
    },
  },
  recallParty: {
    title: "파티 불러오기", required: [], fields: { partySetId: partySet },
  },
  addFollower: {
    title: "동행자 추가", required: [],
    fields: {
      actorId: key("동행할 주인공의 식별자. 걷기 그림만 사용하는 동행자로 바꾸려면 빈 문자열을 입력합니다."),
      name: key("게임에 표시할 동행자 이름. 기본 이름을 쓰려면 빈 문자열을 입력합니다."),
      spriteId: key("자료 보관함에서 확인한 걷기 그림의 식별자."),
      characterIndex: { ...coordinate, maximum: CHARSET_CHARACTER_COUNT - 1, description: "걷기 그림에서 쓸 캐릭터 칸. 첫 칸은 0입니다." },
    },
  },
  removeFollower: {
    title: "동행자 제거", required: [],
    fields: { name: key("떠나게 할 동행자의 이름."), all: { type: "boolean", description: "동행자 전원을 떠나게 할 때 켭니다." } },
  },
} satisfies Record<string, { title: string; required: readonly string[]; fields: Record<string, JsonSchema> }>;

type Kind = keyof typeof commands;
export type PartyActorCommand = Extract<Command, { kind: Kind }>;
type Action = "insert" | "update";

const partyPresetFields = ["actorIds", "mapId", "x", "y"] as const;

function editFields(project: Project, args: Record<string, unknown>, current: PartyActorCommand): Record<string, unknown> {
  const fields = Object.fromEntries(Object.keys(commands[current.kind].fields).filter(key => Object.hasOwn(args, key)).map(key => [key, args[key]]));
  if (current.kind === "changeExp" || current.kind === "changeLifeSkillExp") {
    const { amountVariableId, ...patch } = fields;
    if (amountVariableId === undefined) return patch;
    if (patch.amount !== undefined) throw new PrimitiveError("수치와 변수 중 하나만 골라 주세요.");
    return { ...patch, amount: { kind: "var", id: amountVariableId } };
  }
  if (current.kind === "addFollower") {
    const { spriteId, characterIndex, ...patch } = fields;
    if (typeof patch.name === "string" && patch.name) {
      patch.name = patch.name.trim();
      if (!patch.name) throw new PrimitiveError("동행자 이름을 입력해 주세요. 기본 이름을 쓰려면 입력란을 비워 주세요.");
    }
    if (spriteId === undefined && characterIndex === undefined) return patch;
    const previous = current.graphic;
    const id = (spriteId as string | undefined) ?? previous?.sprite?.id;
    if (!id) throw new PrimitiveError("동행자의 걷기 그림을 골라 주세요.");
    const texture = Object.hasOwn(Object.prototype, id) ? null : resolveEventSpriteTexture(project, id, previous?.pattern);
    if (!texture || !isCharsetSpriteTexture(texture)) throw new PrimitiveError("자료 보관함에서 걷기 그림을 골라 주세요.");
    const image = project.assets.sprites[id]?.image;
    const priorFrame = previous?.pattern === undefined ? undefined : decodeCharsetFrameIndex(previous.pattern);
    const selectedIndex = (characterIndex as number | undefined) ?? priorFrame?.characterIndex ?? 0;
    const next = charsetFollowerGraphic(texture.texture, selectedIndex);
    const sprite = spriteId === undefined ? previous?.sprite
      : image ? { type: image.type, id }
        : texture.charset ? { type: "uploaded", id }
          : next.sprite;
    const pattern = priorFrame ? charsetFrameIndex({ ...priorFrame, characterIndex: selectedIndex }) : next.pattern;
    return { ...patch, graphic: { ...next, ...previous, sprite, pattern } };
  }
  if (current.kind === "removeFollower" && typeof fields.name === "string") {
    const name = fields.name.trim();
    if (!name) throw new PrimitiveError("떠나게 할 동행자의 이름을 입력해 주세요.");
    if (fields.all === true) throw new PrimitiveError("동행자 한 명을 고르거나 전원을 선택해 주세요.");
    return { ...fields, name, all: false };
  }
  if (typeof fields.partySetId === "string") fields.partySetId = normalizePartySetId(fields.partySetId);
  if (current.kind === "storeParty") {
    for (const key of partyPresetFields) if (fields[key] === null) fields[key] = undefined;
  }
  return fields;
}

function editCommand(project: Project, page: EventPage, kind: Kind, action: Action, args: Record<string, unknown>) {
  const index = args.index as number | undefined;
  const branch = (args.branchPath as number[] | undefined) ?? [];
  let list;
  try {
    list = commandListAt(page, branch);
  } catch (error) {
    if (!(error instanceof PrimitiveError)) throw error;
    throw new PrimitiveError("범위 밖이에요. 선택한 페이지의 명령 분기를 확인해 주세요.");
  }
  const row = index ?? list.length;
  if (!Number.isSafeInteger(row) || row < 0 || row >= list.length + Number(action === "insert")) {
    throw new PrimitiveError("범위 밖이에요. 선택한 페이지에서 명령 줄을 확인해 주세요.");
  }
  const path = [...branch, row];
  const current = action === "insert" ? newCommand(kind) : list[row];
  if (current?.kind !== kind) throw new PrimitiveError("범위 밖이에요. 고칠 종류에 맞는 명령 줄을 골라 주세요.");
  const patch = editFields(project, args, current);
  const command = { ...current, ...patch } as PartyActorCommand;
  return { current, list, path, patch, command };
}

function isSharedCommandList(root: readonly Command[], selected: readonly Command[]): boolean {
  let found = false;
  const visit = (list: readonly Command[]): boolean => {
    if (list === selected) {
      if (found) return true;
      found = true;
    }
    return list.some(command => nestedCommandLists(command).some(visit));
  };
  return visit(root);
}

function primitive(kind: Kind, action: Action): SmallTaskPrimitive {
  const { fields, required, title } = commands[kind];
  const properties: Record<string, JsonSchema> = { ...fields };
  if (kind === "storeParty" && action === "update") {
    for (const key of partyPresetFields) {
      const field = commands.storeParty.fields[key];
      properties[key] = { oneOf: [field, { type: "null" }], description: `${field.description} 수정할 때 생략하면 기존 값을 유지하고, null을 넣으면 미리 정한 값을 지웁니다.` };
    }
  }
  return {
    id: `cmd.${kind}.${action}`,
    unit: UNIT,
    title: action === "insert" ? `${title} 명령 넣기` : `${title} 명령 고치기`,
    covers: { commandKinds: [kind] },
    targets: ["event"],
    args: {
      type: "object",
      properties: {
        ...properties,
        index: { ...coordinate, description: action === "insert" ? "끼워 넣을 줄의 위치. 첫 줄은 0이며 생략하면 끝에 추가합니다." : "고칠 줄의 위치. 첫 줄은 0입니다." },
        branchPath: { type: "array", items: { type: "integer" }, description: "분기 안의 줄이라면 이벤트에서 확인한 분기 경로. 바깥 목록이면 생략합니다." },
        ...(action === "update" ? { expectedHash: { ...key("이벤트에서 읽은 해당 명령 줄의 지문."), minLength: 1 } } : {}),
      },
      required: action === "insert" ? required : ["index", "expectedHash"],
      additionalProperties: false,
    },
    scope(ctx) {
      const { map, event, page } = scopedPage(ctx);
      return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
    },
    describe(ctx, args) {
      const { command } = editCommand(ctx.project, scopedPage(ctx).page, kind, action, args);
      const detail = displayText(describePartyActorCommand(ctx.project, command), title);
      const ending = action === "insert" ? " 명령을 넣어요." : " 명령을 고쳐요.";
      const budget = 80 - ending.length;
      return `${detail.length <= budget ? detail : detail.slice(0, budget - 1) + "…"}${ending}`;
    },
    apply(ctx, args) {
      const { map } = scopedPage(ctx);
      return updateScopedPage(ctx, page => {
        const { current, list, path, patch, command } = editCommand(ctx.project, page, kind, action, args);
        // The shared edit helper clones the page, which preserves aliases between branch lists.
        if (path.length > 1 && isSharedCommandList(page.commands, list)) {
          throw new PrimitiveError("여러 분기가 이 명령 목록을 함께 쓰고 있어요. 선택한 분기만 고칠 수 없어요.");
        }
        try {
          const edited = action === "insert"
            ? insertEventCommand(page, path, command)
            : updateEventCommand(page, path, patch, args.expectedHash as string);
          validatePartyActorCommand(ctx.project, map, command, patch);
          if (action === "update") validatePartyActorRename(ctx.project, current, command);
          return edited;
        } catch (error) {
          if (!(error instanceof EventCommandEditError)) throw error;
          if (error.code === "stale-event-command") throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 확인한 뒤 수정해 주세요.");
          throw new PrimitiveError("명령의 위치나 입력값을 확인해 주세요.");
        }
      });
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = (Object.keys(commands) as Kind[])
  .flatMap(kind => [primitive(kind, "insert"), primitive(kind, "update")]);
