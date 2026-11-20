import { listAudioResources } from "@/assets/audioResourceCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { newM2Command } from "@/editor/eventCommandFactory";
import { displayText } from "@/editor/smallTask/target";
import type { JsonSchema } from "@/editor/tools/types";
import { inBounds } from "@/project/collision";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import {
  eventCommandHash, EventCommandEditError, updateEventCommand,
} from "@/project/eventCommands/singleCommandOps";
import { SYSTEM_BGM_CUES, SYSTEM_SE_CUES } from "@/project/systemAudioOverrides";
import type { M2CommandFields, Project } from "@/project/types";
import { commandListAt, insertAtIndex, koreanSentence, scopedPage, updateScopedPage } from "../core/helpers";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "11-m2-system-menu";

type Args = Record<string, unknown>;
type Entry = {
  number: string;
  title: string;
  properties: Record<string, JsonSchema>;
  required?: readonly string[];
  prepare: (ctx: PrimitiveContext, args: Args, previous: M2CommandFields, editing: boolean) => {
    fields: M2CommandFields;
    summary: string;
  };
};

const indexSchema: JsonSchema = { type: "integer", minimum: 0, description: "명령 줄 번호입니다. 첫 줄은 0입니다." };
const branchSchema: JsonSchema = {
  type: "array", items: { type: "integer" }, description: "분기 안에서 고칠 때 읽어 온 분기 경로입니다.",
};

const enabledSchema: JsonSchema = { type: "boolean", description: "허용할 때 참, 금지할 때 거짓을 입력합니다." };
const resourceSchema: JsonSchema = { type: "string", description: "자료에서 고른 리소스 식별자입니다." };
const audioCueLabels = {
  field: "필드 기본곡", battle: "전투곡", victory: "승리 음악", cursor: "이동음",
  confirm: "결정음", cancel: "취소음", buzzer: "실패음", attack: "공격음",
  damage: "피격음", critical: "치명타음", miss: "빗나감 소리", heal: "회복음",
  faint: "쓰러짐 소리", defend: "방어음", defeat: "패배음", escape: "도주음",
} as const;

function audio(number: string, title: string, kind: "music" | "sound"): Entry {
  const bgm = kind === "music";
  const cues = bgm ? ["field", ...SYSTEM_BGM_CUES] as const : SYSTEM_SE_CUES;
  const ownCues: readonly string[] = cues;
  const defaultCue = bgm ? "battle" : "defeat";
  return {
    number, title,
    properties: {
      cue: { type: "string", enum: cues, description: `바꿀 소리입니다. ${cues.map(cue => `${cue}는 ${audioCueLabels[cue]}`).join(", ")}입니다.` },
      operation: { type: "string", enum: ["set", "reset"], description: "소리 지정은 set, 기본값 복원은 reset입니다." },
      resourceId: { ...resourceSchema, description: "자료에서 고른 소리 식별자입니다. 무음으로 지정할 때는 빈 문자열을 입력합니다." },
      volume: { type: "integer", minimum: 0, maximum: 100, description: "소리 크기입니다. 기본값은 100입니다." },
    },
    prepare(ctx, args, previous) {
      const previousCue = previous.cue ?? previous.slot;
      const cue = (args.cue ?? (typeof previousCue === "string" && ownCues.includes(previousCue) ? previousCue : defaultCue)) as keyof typeof audioCueLabels;
      const operation = args.operation ?? (args.resourceId === undefined && previous.operation === "reset" ? "reset" : "set");
      const resourceId = operation === "reset" ? "" : String(args.resourceId ?? previous.resourceId ?? previous.value ?? "").trim();
      if (resourceId && !listAudioResources(kind, ctx.project).some(resource => resource.id === resourceId)) {
        throw new PrimitiveError(bgm ? "선택한 음악을 찾을 수 없습니다." : "선택한 효과음을 찾을 수 없습니다.");
      }
      const fields: M2CommandFields = { ...previous, resourceId };
      if (cue === "field") {
        if (operation === "set" && !resourceId) throw new PrimitiveError("필드 기본곡을 고르거나 기본값으로 되돌려 주세요.");
        if (args.volume !== undefined) throw new PrimitiveError("필드 기본곡은 명령에서 소리 크기를 정할 수 없습니다.");
        delete fields.cue;
        delete fields.operation;
        delete fields.volume;
        return { fields: { ...fields, slot: cue }, summary: operation === "reset" ? "필드 기본곡을 원래 설정으로 돌리도록" : "필드 기본곡을 선택한 음악으로 바꾸도록" };
      }
      return {
        fields: { ...fields, cue, operation: operation as string, volume: Number(args.volume ?? previous.volume ?? 100) },
        summary: `‘${audioCueLabels[cue]}’ 설정을 ${operation === "reset" ? "기본값으로 돌리도록" : resourceId ? "선택한 소리로 바꾸도록" : "무음으로 바꾸도록"}`,
      };
    },
  };
}

function access(number: string, title: string, subject: string, toggle = false): Entry {
  return {
    number, title, properties: {
      enabled: toggle ? { ...enabledSchema, description: "켤 때 참, 끌 때 거짓을 입력합니다." } : enabledSchema,
    },
    prepare(_ctx, args, previous) {
      const enabled = args.enabled ?? (String(previous.enabled ?? "true") === "true");
      const summary = toggle ? `${subject} ${enabled ? "켜도록" : "끄도록"}`
        : `${subject} ${enabled ? "허용하도록" : "금지하도록"}`;
      return { fields: { ...previous, enabled: String(enabled) }, summary };
    },
  };
}

function location(number: string, title: string, teleport: boolean): Entry {
  return {
    number, title,
    properties: {
      mapId: { type: "string", minLength: 1, description: "목적지 맵입니다. 새 줄에서 생략하면 선택한 이벤트의 맵을 씁니다." },
      x: { type: "integer", minimum: 0, description: "목적지 가로 칸입니다. 왼쪽 끝은 0입니다." },
      y: { type: "integer", minimum: 0, description: "목적지 세로 칸입니다. 위쪽 끝은 0입니다." },
      ...(teleport ? { label: { type: "string", maxLength: 80, description: "순간이동 목록에 표시할 이름입니다." } } satisfies Record<string, JsonSchema> : {}),
    },
    prepare(ctx, args, previous, editing) {
      const target = ctx.target;
      if (target.kind !== "event") throw new PrimitiveError("범위 밖: 이벤트 페이지를 먼저 선택하세요.");
      const mapId = String(args.mapId ?? previous.mapId ?? "") || target.mapId;
      const map = Object.hasOwn(ctx.project.maps, mapId) ? ctx.project.maps[mapId] : undefined;
      if (!map) throw new PrimitiveError("목적지 맵을 찾을 수 없습니다.");
      const dynamic = teleport && editing && !args.mapId && !previous.mapId;
      const x = Number(args.x ?? previous.x ?? (mapId === target.mapId ? target.x : 0));
      const y = Number(args.y ?? previous.y ?? (mapId === target.mapId ? target.y : 0));
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !inBounds(map, x, y)) {
        throw new PrimitiveError("목적지 칸이 맵 범위 밖에 있습니다.");
      }
      const name = textSnippet(map.name === map.id ? "" : map.name, "선택한 맵").slice(0, 36);
      const fields: M2CommandFields = { ...previous, ...(typeof args.label === "string" ? { label: args.label } : {}) };
      if (dynamic) {
        if (args.x !== undefined) fields.x = x;
        if (args.y !== undefined) fields.y = y;
        return { fields, summary: "순간이동 위치 설정을" };
      }
      return { fields: { ...fields, mapId, x, y }, summary: `${name}의 가로 ${x}, 세로 ${y} 칸을 ${title}로 정하도록` };
    },
  };
}

function shell(number: string, title: string, summary: string): Entry {
  return { number, title, properties: {}, prepare: () => ({ fields: {}, summary }) };
}

function textSnippet(text: string, fallback: string): string {
  return displayText(text, fallback)
    .replace(/\bm2[-.]\d+(?:[-.][a-z\d]+)*/giu, "…")
    .replace(/[{}[\]"]/gu, "")
    .replace(/[.!?。！？]+/gu, " ")
    .trim().slice(0, 46) || fallback;
}

const entries: readonly Entry[] = [
  audio("027", "시스템 음악 바꾸기", "music"),
  audio("028", "시스템 효과음 바꾸기", "sound"),
  {
    number: "029", title: "메뉴 모습 바꾸기",
    properties: { resourceId: resourceSchema },
    required: ["resourceId"],
    prepare({ project }, args, previous) {
      const id = String(args.resourceId ?? previous.value ?? "");
      const builtIn = id.startsWith("windowskin-") && resolveAssetResourceUrl(id) !== null;
      if (!builtIn && (!id || !(project.resourceProfiles.some(profile => profile.assetId === id && (profile.kind === "system" || profile.kind === "system2"))
        || (Object.hasOwn(project.assets.uploaded, id) && ["system", "system2"].includes(project.assets.uploaded[id].kind))))) {
        throw new PrimitiveError("선택한 메뉴 그림을 찾을 수 없습니다.");
      }
      return { fields: { ...previous, value: id }, summary: "선택한 그림으로 메뉴 모습을 바꾸도록" };
    },
  },
  location("072", "순간이동 위치", true),
  access("073", "순간이동 허가", "순간이동을"),
  location("074", "탈출 위치", false),
  access("075", "탈출 허가", "탈출을"),
  access("077", "저장 허가", "저장을"),
  {
    number: "078", title: "메뉴 열기",
    properties: {
      screen: { type: "string", enum: ["main", "skills", "monster-box"], description: "기본 메뉴는 main, 스킬 장착은 skills, 몬스터 보관함은 monster-box입니다." },
      actorId: { type: "string", description: "스킬 장착 화면을 열 배우입니다. 비우면 일행의 첫 배우를 표시합니다." },
    },
    prepare({ project }, args, previous) {
      const screen = args.screen ?? (previous.screen === "skills" || previous.screen === "monster-box" ? previous.screen : "main");
      const actorId = String(args.actorId ?? (screen === "skills" ? previous.actorId ?? "" : "")).trim();
      if (actorId && screen !== "skills") throw new PrimitiveError("배우는 스킬 장착 화면에서만 고를 수 있습니다.");
      const actor = actorId ? project.database.actors.find(record => record.id === actorId) : undefined;
      if (actorId && !actor) throw new PrimitiveError("선택한 배우를 찾을 수 없습니다.");
      const fields = { ...previous };
      if (screen === "main") delete fields.screen;
      else fields.screen = screen as string;
      if (actorId) fields.actorId = actorId;
      else delete fields.actorId;
      const summary = screen === "monster-box" ? "몬스터 보관함을 열도록"
        : screen === "skills" ? "스킬 장착 화면을 열도록" : "게임 메뉴를 열도록";
      return { fields, summary };
    },
  },
  access("079", "메뉴 허가", "메뉴 열기를"),
  {
    number: "088", title: "주석 쓰기",
    properties: {
      comment: { type: "string", minLength: 1, description: "이벤트 목록에 남길 주석입니다." },
      color: { type: "string", enum: ["green", "yellow", "cyan", "pink", "gray", "white"], description: "주석의 글자색입니다. 초록, 노랑, 청록, 분홍, 회색, 흰색 순입니다." },
    },
    required: ["comment"],
    prepare(_ctx, args, previous) {
      const comment = String(args.comment ?? previous.comment ?? "");
      if (!comment.trim()) throw new PrimitiveError("주석 내용을 입력하세요.");
      return {
        fields: { ...previous, comment, color: String(args.color ?? previous.color ?? "green") },
        summary: `‘${textSnippet(comment, "편집 메모")}’ 주석을`,
      };
    },
  },
  shell("093", "불러오기 메뉴 열기", "불러오기 메뉴를 열도록"),
  shell("094", "게임 종료", "게임을 끝내고 시작 화면으로 돌아가도록"),
  access("095", "전투 대기 모드 전환", "전투 대기 모드를", true),
  access("096", "전체 화면 전환", "전체 화면을", true),
  shell("097", "화면 설정 열기", "화면 설정을 열도록"),
];

function primitive(entry: Entry, update: boolean): SmallTaskPrimitive {
  const catalog = M2_COMMAND_CATALOG.find(row => row.index === Number(entry.number))!;
  const scope: SmallTaskPrimitive["scope"] = ctx => {
    const { map, event, page } = scopedPage(ctx);
    return { kind: "eventPage", mapId: map.id, eventId: event.id, pageId: page.id };
  };
  function prepare(ctx: PrimitiveContext, args: Args) {
    const { page } = scopedPage(ctx);
    const branchPath = (args.branchPath ?? []) as number[];
    const commands = commandListAt(page, branchPath);
    const index = (args.index ?? commands.length) as number;
    const current = commands[index];
    if (update && (current?.kind !== "m2Command" || current.commandId !== catalog.id)) {
      throw new PrimitiveError("선택한 줄에서 이 종류의 명령을 찾을 수 없습니다.");
    }
    if (update && args.expectedHash !== undefined && eventCommandHash(current!) !== args.expectedHash) {
      throw new PrimitiveError("그 줄의 내용이 바뀌었습니다. 다시 읽은 뒤 수정하세요.");
    }
    const defaults = newM2Command(catalog.id);
    const result = entry.prepare(ctx, args, current?.kind === "m2Command" && update ? current.fields : defaults.fields, update);
    return { current, index, branchPath, command: { ...defaults, fields: result.fields }, summary: result.summary };
  }
  return {
    id: `m2.${entry.number}.${update ? "update" : "insert"}`, unit: UNIT,
    title: `${entry.title} ${update ? "수정" : "추가"}`,
    covers: { m2Ids: [`m2-${entry.number}`] },
    targets: ["event"],
    args: {
      type: "object",
      description: update && !Object.keys(entry.properties).length ? "기존 명령 줄의 설정을 기본값으로 정리합니다." : undefined,
      properties: {
        ...entry.properties, index: indexSchema, branchPath: branchSchema,
        ...(update ? { expectedHash: { type: "string", minLength: 1, description: "읽어 온 명령 줄의 변경 확인값입니다." } } : {}),
      },
      required: update ? ["index"] : entry.required ?? [],
      additionalProperties: false,
    },
    scope,
    describe(ctx, args) {
      const { summary } = prepare(ctx, args);
      return koreanSentence(`${summary}${summary.endsWith("도록") ? " 명령을" : ""} ${update ? "수정합니다." : "추가합니다."}`);
    },
    apply(ctx, args): Project {
      const { current, index, branchPath, command } = prepare(ctx, args);
      try {
        if (!update) return insertAtIndex(ctx, command, index, branchPath);
        return updateScopedPage(ctx, page =>
          updateEventCommand(page, [...branchPath, index], { fields: command.fields }, eventCommandHash(current!)));
      } catch (error) {
        if (error instanceof EventCommandEditError) throw new PrimitiveError("명령 줄의 위치나 설정을 확인해 주세요.");
        throw error;
      }
    },
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = entries.flatMap(entry => [primitive(entry, false), primitive(entry, true)]);
