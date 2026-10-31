// editor/dialogue/dialogueIndex.ts
// 프로젝트의 «플레이어가 읽는 글» 을 한 줄씩 모은 색인과, 그 줄을 정확한 명령 자리에 되써 넣는 순수 함수.
// 편집기 자료집 「대사」 탭과 조수 도구(list_dialogue·get_dialogue_context·rewrite_dialogue)가 같은 색인을 쓴다.
// DOM·스토어를 모른다(조수 도구 워커도 import 한다).
//
// 줄 id 는 자리 주소다 — 내용이 아니라 «어느 명령의 어느 칸» 이다:
//   ev/<mapId>/<eventId>/<pageId|_>/<path>#<field>   맵 이벤트(페이지 없는 옛 이벤트는 _)
//   ce/<commonEventId>/<path>#<field>                 공용 이벤트
//   tp/<troopId>/<pageId>/<path>#<field>              적 그룹 전투 이벤트 페이지
//   ta/<troopId>/<victory|defeat|escape>/<path>#<field> 적 그룹 전투 뒤
//   db/<items|equipment|skills>/<recordId>#description  자료집 설명
//   qs/<questKey>#<title|summary|step<i>|node<i>>      퀘스트 일지에 뜨는 제목·요약·단계 이름(2026-10-27)
//   en/<endingId>#<name|kicker|credits>                 엔딩 화면 제목·머리말·크레딧
//   ep/<endingId>/<beatPath>#<text|line<i>>           엔딩 에필로그 say 비트(대화창에 뜬다)
// <path> 는 `eventCommandPaths` 의 명령 경로(짝수 칸=명령 번호, 홀수 칸=분기 번호, 음수 가능)를 점으로 이은 것이다.
// 명령을 끼우거나 지우면 뒤쪽 줄 id 가 바뀐다 — 그래서 모든 쓰기는 내용 해시(hash)를 함께 받아 낡은 id·낡은 원문을 거절한다.

import type { Command, Project } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { eventDisplayName } from "@/project/eventDisplayName";
import { contentFingerprint } from "@/util/fingerprint";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import { normalizeSpeakerName } from "@/project/dialogueDesk";
import { isQuestGraphDef, isStepQuestDef, type AnyQuestDef } from "@/project/quest/questDef";

export type DialogueLineKind = "text" | "choicePrompt" | "choiceOption" | "presentPrompt" | "ending" | "gameOver" | "description" | "quest";
export type DialogueLineScope = "map" | "common" | "troop" | "database" | "quest" | "ending";
export type DialogueDescriptionCollection = "items" | "equipment" | "skills";

export interface DialogueLine {
  readonly id: string;
  readonly kind: DialogueLineKind;
  readonly scope: DialogueLineScope;
  /** 말하는 이(대사 명령의 speaker). 선택지·설명은 빈 문자열. */
  readonly speaker: string;
  readonly text: string;
  /** 낙관적 동시성용 내용 해시. */
  readonly hash: string;
  /** 같은 무리(페이지·공용 이벤트·레코드) 안에서의 읽는 순서. */
  readonly order: number;
  /** 무리 열쇠 — 앞뒤 문맥은 같은 무리 안에서만 본다. */
  readonly groupKey: string;
  /** 사람이 읽는 자리: 「왕도 › 발렌 › 1쪽」. */
  readonly groupLabel: string;
  readonly mapId?: string;
  readonly mapName?: string;
  readonly eventId?: string;
  readonly eventName?: string;
  readonly pageId?: string;
  readonly pageIndex?: number;
  readonly commonEventId?: string;
  readonly troopId?: string;
  readonly questKey?: string;
  readonly endingId?: string;
  readonly collection?: DialogueDescriptionCollection;
  readonly recordId?: string;
  readonly path: readonly number[];
  readonly field: string;
  /** 명령에 붙은 감정·대사 종류(문맥 판단용). */
  readonly emotion?: string;
  readonly context?: string;
  /** 대사 창에 얼굴(얼굴 칸)이 떠 있는 상태로 읽히는가(앞선 changeFace 추적) — 글 폭이 좁아진다. */
  readonly withFace: boolean;
  /** 이벤트 편집기에서 지금 초안으로 열려 있다 — 고치지 않는다. */
  readonly drafted: boolean;
}

export function dialogueTextHash(text: string): string {
  return contentFingerprint(text).slice(0, 12);
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function pathKey(path: readonly number[]): string {
  return path.join(".");
}

interface WalkOwner {
  readonly scope: DialogueLineScope;
  readonly prefix: string;
  readonly groupKey: string;
  readonly groupLabel: string;
  readonly drafted: boolean;
  readonly base: Partial<DialogueLine>;
}

function walkCommands(commands: readonly Command[], owner: WalkOwner, out: DialogueLine[], counter: { n: number }): void {
  const visit = (list: readonly Command[], container: readonly number[], inheritedFace: boolean): void => {
    let localFace = inheritedFace;
    list.forEach((command, index) => {
      const path = [...container, index];
      const push = (kind: DialogueLineKind, field: string, text: string, speaker = "", extra: Partial<DialogueLine> = {}): void => {
        out.push({
          ...owner.base,
          id: `${owner.prefix}/${pathKey(path)}#${field}`,
          kind,
          scope: owner.scope,
          speaker,
          text,
          hash: dialogueTextHash(text),
          order: counter.n++,
          groupKey: owner.groupKey,
          groupLabel: owner.groupLabel,
          path,
          field,
          withFace: localFace,
          drafted: owner.drafted,
          ...extra,
        } as DialogueLine);
      };
      switch (command.kind) {
        case "changeFace":
          localFace = Boolean(command.resourceId) && (command.presentation ?? "face") === "face";
          break;
        case "text":
          push("text", "body", command.body ?? "", normalizeSpeakerName(command.speaker ?? ""), {
            ...(command.emotion ? { emotion: command.emotion } : {}),
            ...(command.context ? { context: command.context } : {}),
          });
          break;
        case "choices":
          if (typeof command.prompt === "string" && command.prompt.length > 0) push("choicePrompt", "prompt", command.prompt);
          command.options.forEach((option, optionIndex) => push("choiceOption", `opt${optionIndex}`, option.text ?? ""));
          break;
        case "presentItem":
          if (typeof command.prompt === "string" && command.prompt.length > 0) push("presentPrompt", "prompt", command.prompt);
          break;
        case "ending":
          if (command.title) push("ending", "title", command.title);
          if (command.message) push("ending", "message", command.message);
          break;
        case "killPlayer":
          if (command.message) push("gameOver", "message", command.message);
          break;
        default:
          break;
      }
      for (const branch of eventCommandBranches(command)) {
        visit(branch.commands, [...path, branch.branchIndex], localFace);
      }
    });
  };
  visit(commands, [], false);
}


interface LooseSayBeat { kind?: unknown; speaker?: unknown; text?: unknown; lines?: unknown; beats?: unknown; emotion?: unknown; context?: unknown; face?: { resourceId?: unknown } }

/** 엔딩 레지스트리: 에필로그 say 비트(대화창 줄)는 늘, 제목·머리말·크레딧은 설명 글과 함께(withMeta). */
function collectEndingLines(project: Project, out: DialogueLine[], counter: { n: number }, withMeta: boolean): void {
  for (const ending of project.endings ?? []) {
    const label = `엔딩 › ${ending.name || ending.id}`;
    const base = { endingId: ending.id, eventName: ending.name || ending.id };
    const meta = (field: string, text: string | undefined): void => {
      if (!withMeta || !text?.trim()) return;
      out.push({
        ...base, id: `en/${encodeSegment(ending.id)}#${field}`, kind: "ending", scope: "ending", speaker: "", text,
        hash: dialogueTextHash(text), order: counter.n++, groupKey: `en/${ending.id}`, groupLabel: label, path: [], field, withFace: false, drafted: false,
      });
    };
    meta("name", ending.name);
    meta("kicker", ending.presentation?.kicker);
    meta("credits", ending.presentation?.credits);
    const visit = (beats: readonly unknown[], container: readonly number[]): void => {
      beats.forEach((raw, index) => {
        const beat = (raw && typeof raw === "object" ? raw : {}) as LooseSayBeat;
        const path = [...container, index];
        if (beat.kind === "parallel" && Array.isArray(beat.beats)) { visit(beat.beats, path); return; }
        if (beat.kind !== "say") return;
        const speaker = typeof beat.speaker === "string" ? normalizeSpeakerName(beat.speaker) : "";
        const fields: [string, string][] = Array.isArray(beat.lines) && beat.lines.length > 0
          ? beat.lines.map((line, lineIndex) => [`line${lineIndex}`, typeof line === "string" ? line : ""] as [string, string])
          : typeof beat.text === "string" && beat.text ? [["text", beat.text]] : [];
        for (const [field, text] of fields) {
          out.push({
            ...base, id: `ep/${encodeSegment(ending.id)}/${pathKey(path)}#${field}`, kind: "text", scope: "ending", speaker, text,
            hash: dialogueTextHash(text), order: counter.n++, groupKey: `ep/${ending.id}`, groupLabel: `${label} › 에필로그`, path, field,
            withFace: Boolean(beat.face && typeof beat.face === "object" && beat.face.resourceId), drafted: false,
            ...(typeof beat.emotion === "string" && beat.emotion ? { emotion: beat.emotion } : {}),
            ...(typeof beat.context === "string" && beat.context ? { context: beat.context } : {}),
          });
        }
      });
    };
    visit(ending.epilogue ?? [], []);
  }
}

function questKeyOf(quest: AnyQuestDef): string {
  return isQuestGraphDef(quest) ? quest.id : quest.key;
}

/** 퀘스트 일지(메뉴)에 뜨는 글. 단계 대사(lines)는 컴파일된 이벤트 명령으로 이미 색인에 있다. */
function collectQuestLines(project: Project, out: DialogueLine[], counter: { n: number }): void {
  for (const quest of project.quests ?? []) {
    const key = questKeyOf(quest);
    if (!key) continue;
    const push = (field: string, text: string | undefined): void => {
      if (!text?.trim()) return;
      out.push({
        id: `qs/${encodeSegment(key)}#${field}`, kind: "quest", scope: "quest", speaker: "", text, hash: dialogueTextHash(text),
        order: counter.n++, groupKey: `qs/${key}`, groupLabel: `퀘스트 › ${quest.title || key}`, questKey: key, eventName: quest.title || key,
        path: [], field, withFace: false, drafted: false,
      });
    };
    push("title", quest.title);
    push("summary", quest.summary);
    if (isQuestGraphDef(quest)) quest.nodes.forEach((node, index) => push(`node${index}`, node.description));
    else if (isStepQuestDef(quest)) quest.steps.forEach((step, index) => push(`step${index}`, step.label));
  }
}

/** 프로젝트의 모든 대사 줄. 읽는 순서(맵 → 이벤트 → 페이지 → 명령, 공용 이벤트, 적 그룹, 자료집 설명). */
export function collectDialogueLines(project: Project, options: { readonly includeDescriptions?: boolean } = {}): DialogueLine[] {
  const out: DialogueLine[] = [];
  const counter = { n: 0 };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      const eventName = eventDisplayName(event);
      const drafted = event.draft !== undefined;
      const pages = event.pages && event.pages.length > 0 ? event.pages : null;
      if (pages) {
        pages.forEach((page, pageIndex) => {
          walkCommands(page.commands ?? [], {
            scope: "map",
            prefix: `ev/${encodeSegment(map.id)}/${encodeSegment(event.id)}/${encodeSegment(page.id)}`,
            groupKey: `ev/${map.id}/${event.id}/${page.id}`,
            groupLabel: `${map.name} › ${eventName} › ${pageIndex + 1}쪽`,
            drafted,
            base: { mapId: map.id, mapName: map.name, eventId: event.id, eventName, pageId: page.id, pageIndex },
          }, out, counter);
        });
      } else {
        walkCommands(event.commands ?? [], {
          scope: "map",
          prefix: `ev/${encodeSegment(map.id)}/${encodeSegment(event.id)}/_`,
          groupKey: `ev/${map.id}/${event.id}/_`,
          groupLabel: `${map.name} › ${eventName}`,
          drafted,
          base: { mapId: map.id, mapName: map.name, eventId: event.id, eventName },
        }, out, counter);
      }
    }
  }
  for (const common of project.commonEvents ?? []) {
    walkCommands(common.commands ?? [], {
      scope: "common",
      prefix: `ce/${encodeSegment(common.id)}`,
      groupKey: `ce/${common.id}`,
      groupLabel: `공용 이벤트 › ${common.name || common.id}`,
      drafted: false,
      base: { commonEventId: common.id },
    }, out, counter);
  }
  for (const troop of project.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) {
      walkCommands(page.commands ?? [], {
        scope: "troop",
        prefix: `tp/${encodeSegment(troop.id)}/${encodeSegment(page.id)}`,
        groupKey: `tp/${troop.id}/${page.id}`,
        groupLabel: `적 그룹 › ${troop.name || troop.id} › 전투 중 ${page.name || page.id}`,
        drafted: false,
        base: { troopId: troop.id },
      }, out, counter);
    }
    for (const list of troopAfterBattleLists(troop)) {
      walkCommands(list.commands, {
        scope: "troop",
        prefix: `ta/${encodeSegment(troop.id)}/${list.outcome}`,
        groupKey: `ta/${troop.id}/${list.outcome}`,
        groupLabel: `적 그룹 › ${troop.name || troop.id} › 전투 뒤(${list.outcome})`,
        drafted: false,
        base: { troopId: troop.id },
      }, out, counter);
    }
  }
  collectEndingLines(project, out, counter, options.includeDescriptions !== false);
  if (options.includeDescriptions !== false) collectQuestLines(project, out, counter);
  if (options.includeDescriptions !== false) {
    const collections: readonly [DialogueDescriptionCollection, string][] = [["items", "아이템"], ["equipment", "장비"], ["skills", "스킬"]];
    for (const [collection, label] of collections) {
      const records = (project.database?.[collection] ?? []) as readonly { id: string; name: string; description?: string }[];
      for (const record of records) {
        const text = record.description ?? "";
        if (!text.trim()) continue;
        out.push({
          id: `db/${collection}/${encodeSegment(record.id)}#description`,
          kind: "description",
          scope: "database",
          speaker: "",
          text,
          hash: dialogueTextHash(text),
          order: counter.n++,
          groupKey: `db/${collection}`,
          groupLabel: `자료집 › ${label}`,
          collection,
          recordId: record.id,
          path: [],
          field: "description",
          withFace: false,
          drafted: false,
          ...(record.name ? { eventName: record.name } : {}),
        });
      }
    }
  }
  return out;
}

export interface ParsedDialogueLineId {
  readonly scope: "ev" | "ce" | "tp" | "ta" | "db" | "qs" | "en" | "ep";
  readonly segments: readonly string[];
  readonly path: readonly number[];
  readonly field: string;
}

export function parseDialogueLineId(id: string): ParsedDialogueLineId | null {
  const hash = id.lastIndexOf("#");
  if (hash <= 0) return null;
  const field = id.slice(hash + 1);
  const parts = id.slice(0, hash).split("/");
  const scope = parts[0];
  const decode = (value: string): string | null => {
    try { return decodeURIComponent(value); } catch { return null; }
  };
  const parsePath = (value: string | undefined): number[] | null => {
    if (value === undefined || value === "") return null;
    const numbers = value.split(".").map(Number);
    return numbers.every(Number.isInteger) && numbers.length % 2 === 1 ? numbers : null;
  };
  const expect = (count: number): string[] | null => {
    if (parts.length !== count) return null;
    const decoded = parts.slice(1, count - 1).map(decode);
    return decoded.every((value): value is string => value !== null) ? decoded : null;
  };
  switch (scope) {
    case "ev": {
      const segments = expect(5);
      const path = parsePath(parts[4]);
      return segments && path ? { scope, segments, path, field } : null;
    }
    case "ce": {
      const segments = expect(3);
      const path = parsePath(parts[2]);
      return segments && path ? { scope, segments, path, field } : null;
    }
    case "tp":
    case "ta": {
      const segments = expect(4);
      const path = parsePath(parts[3]);
      return segments && path ? { scope, segments, path, field } : null;
    }
    case "qs":
    case "en": {
      if (parts.length !== 2) return null;
      const key = decode(parts[1] ?? "");
      return key ? { scope, segments: [key], path: [], field } : null;
    }
    case "ep": {
      if (parts.length !== 3) return null;
      const endingId = decode(parts[1] ?? "");
      const path = parts[2] === "" || parts[2] === undefined ? null : parts[2].split(".").map(Number);
      return endingId !== null && path && path.every(Number.isInteger) ? { scope, segments: [endingId], path, field } : null;
    }
    case "db": {
      if (parts.length !== 3 || field !== "description") return null;
      const recordId = decode(parts[2] ?? "");
      return recordId === null ? null : { scope, segments: [parts[1] ?? "", recordId], path: [], field };
    }
    default:
      return null;
  }
}

/** 줄 id 가 가리키는 명령 목록의 뿌리. 프로젝트(또는 초안)를 그대로 가리키므로 고치면 그 자리가 바뀐다. */
function rootCommandList(project: Project, parsed: ParsedDialogueLineId): { readonly commands: Command[]; readonly drafted: boolean } | null {
  switch (parsed.scope) {
    case "ev": {
      const [mapId, eventId, pageId] = parsed.segments;
      const event = project.maps[mapId!]?.events.find((candidate) => candidate.id === eventId);
      if (!event) return null;
      if (pageId === "_") return (event.pages?.length ?? 0) > 0 ? null : { commands: event.commands, drafted: event.draft !== undefined };
      const page = event.pages?.find((candidate) => candidate.id === pageId);
      return page ? { commands: page.commands, drafted: event.draft !== undefined } : null;
    }
    case "ce": {
      const common = project.commonEvents.find((candidate) => candidate.id === parsed.segments[0]);
      return common ? { commands: common.commands, drafted: false } : null;
    }
    case "tp": {
      const troop = project.database.troops.find((candidate) => candidate.id === parsed.segments[0]);
      const page = troop?.battleEventPages?.find((candidate) => candidate.id === parsed.segments[1]);
      return page ? { commands: page.commands, drafted: false } : null;
    }
    case "ta": {
      const troop = project.database.troops.find((candidate) => candidate.id === parsed.segments[0]);
      const outcome = parsed.segments[1] as "victory" | "defeat" | "escape";
      const commands = troop?.afterBattle?.[outcome];
      return commands ? { commands, drafted: false } : null;
    }
    default:
      return null;
  }
}

export interface DialogueSlot {
  readonly text: string;
  readonly drafted: boolean;
  write(next: string): void;
  /** 대화창 이름표(화자 칸)가 있는 자리만 — 대사 명령 speaker, 에필로그 say 비트 speaker. 선택지·설명·퀘스트 글에는 없다. */
  readonly speaker?: { readonly value: string; write(name: string): void };
}

/** 줄 id → 지금 그 자리의 글과 쓰기 손잡이. 자리가 없거나 종류가 안 맞으면 null. */
export function resolveDialogueSlot(project: Project, id: string): DialogueSlot | null {
  const parsed = parseDialogueLineId(id);
  if (!parsed) return null;
  if (parsed.scope === "db") {
    const collection = parsed.segments[0] as DialogueDescriptionCollection;
    if (collection !== "items" && collection !== "equipment" && collection !== "skills") return null;
    const records = project.database[collection] as { id: string; description: string }[];
    const record = records.find((candidate) => candidate.id === parsed.segments[1]);
    if (!record) return null;
    return { text: record.description ?? "", drafted: false, write(next) { record.description = next; } };
  }
  if (parsed.scope === "qs" || parsed.scope === "en" || parsed.scope === "ep") return resolveRegistrySlot(project, parsed);
  const root = rootCommandList(project, parsed);
  if (!root) return null;
  const command = resolveCommandAtPath(root.commands, parsed.path);
  if (!command) return null;
  const field = parsed.field;
  switch (command.kind) {
    case "text":
      return field === "body" ? {
        text: command.body ?? "", drafted: root.drafted, write(next) { command.body = next; },
        speaker: { value: command.speaker ?? "", write(name) { command.speaker = name; } },
      } : null;
    case "choices": {
      if (field === "prompt") return { text: command.prompt ?? "", drafted: root.drafted, write(next) { command.prompt = next; } };
      const match = /^opt(\d+)$/u.exec(field);
      const option = match ? command.options[Number(match[1])] : undefined;
      return option ? { text: option.text ?? "", drafted: root.drafted, write(next) { option.text = next; } } : null;
    }
    case "presentItem":
      return field === "prompt" ? { text: command.prompt ?? "", drafted: root.drafted, write(next) { command.prompt = next; } } : null;
    case "ending":
      if (field === "title") return { text: command.title ?? "", drafted: root.drafted, write(next) { command.title = next; } };
      if (field === "message") return { text: command.message ?? "", drafted: root.drafted, write(next) { command.message = next; } };
      return null;
    case "killPlayer":
      return field === "message" ? { text: command.message ?? "", drafted: root.drafted, write(next) { command.message = next; } } : null;
    default:
      return null;
  }
}

/**
 * 퀘스트·엔딩 레지스트리 칸. 레지스트리 정의는 읽기 전용 타입이라 쓰기는 그 자리 객체를 직접 바꾼다
 * (스토어 변경기·도구 초안 안에서만 부른다 — 이벤트 명령 칸과 같다).
 */
function resolveRegistrySlot(project: Project, parsed: ParsedDialogueLineId): DialogueSlot | null {
  const slot = (holder: Record<string, unknown> | undefined, key: string): DialogueSlot | null => {
    if (!holder || typeof holder[key] !== "string") return null;
    return { text: holder[key] as string, drafted: false, write(next) { holder[key] = next; } };
  };
  if (parsed.scope === "qs") {
    const quest = (project.quests ?? []).find((candidate) => questKeyOf(candidate) === parsed.segments[0]);
    if (!quest) return null;
    const record = quest as unknown as Record<string, unknown>;
    if (parsed.field === "title" || parsed.field === "summary") return slot(record, parsed.field);
    const node = /^node(\d+)$/u.exec(parsed.field);
    if (node && isQuestGraphDef(quest)) return slot(quest.nodes[Number(node[1])] as unknown as Record<string, unknown> | undefined, "description");
    const step = /^step(\d+)$/u.exec(parsed.field);
    if (step && isStepQuestDef(quest)) return slot(quest.steps[Number(step[1])] as unknown as Record<string, unknown> | undefined, "label");
    return null;
  }
  const ending = (project.endings ?? []).find((candidate) => candidate.id === parsed.segments[0]);
  if (!ending) return null;
  if (parsed.scope === "en") {
    if (parsed.field === "name") return slot(ending as unknown as Record<string, unknown>, "name");
    if (parsed.field === "kicker" || parsed.field === "credits") return slot(ending.presentation as Record<string, unknown> | undefined, parsed.field);
    return null;
  }
  let beats: unknown[] | undefined = ending.epilogue;
  let beat: Record<string, unknown> | undefined;
  for (let depth = 0; depth < parsed.path.length; depth += 1) {
    const candidate = beats?.[parsed.path[depth]!];
    beat = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : undefined;
    if (!beat) return null;
    beats = depth < parsed.path.length - 1 ? (Array.isArray(beat.beats) ? beat.beats : undefined) : undefined;
  }
  if (!beat || beat.kind !== "say") return null;
  const sayBeat = beat;
  const speaker = { value: typeof sayBeat.speaker === "string" ? sayBeat.speaker : "", write(name: string) { sayBeat.speaker = name; } };
  if (parsed.field === "text") { const text = slot(beat, "text"); return text ? { ...text, speaker } : null; }
  const line = /^line(\d+)$/u.exec(parsed.field);
  if (line && Array.isArray(beat.lines)) {
    const list = beat.lines as unknown[];
    const index = Number(line[1]);
    if (typeof list[index] !== "string") return null;
    return { text: list[index] as string, drafted: false, write(next) { list[index] = next; }, speaker };
  }
  return null;
}

/** 앞뒤 문맥: 같은 무리 안에서 before 줄 앞, after 줄 뒤. */
export function dialogueContext(lines: readonly DialogueLine[], id: string, before = 3, after = 3): {
  readonly line: DialogueLine;
  readonly previous: readonly DialogueLine[];
  readonly next: readonly DialogueLine[];
} | null {
  const index = lines.findIndex((line) => line.id === id);
  if (index < 0) return null;
  const line = lines[index]!;
  const previous: DialogueLine[] = [];
  for (let i = index - 1; i >= 0 && previous.length < before; i -= 1) {
    if (lines[i]!.groupKey !== line.groupKey) break;
    previous.unshift(lines[i]!);
  }
  const next: DialogueLine[] = [];
  for (let i = index + 1; i < lines.length && next.length < after; i += 1) {
    if (lines[i]!.groupKey !== line.groupKey) break;
    next.push(lines[i]!);
  }
  return { line, previous, next };
}

export function dialogueKindLabel(kind: DialogueLineKind): string {
  switch (kind) {
    case "text": return "대사";
    case "choicePrompt": return "선택 질문";
    case "choiceOption": return "선택지";
    case "presentPrompt": return "제시 질문";
    case "ending": return "엔딩";
    case "gameOver": return "게임 오버";
    case "description": return "설명";
    case "quest": return "퀘스트";
  }
}

/** 퀘스트·엔딩 화면 글이 어느 칸인지(제목·요약·단계 N·머리말·크레딧). 그 밖의 줄은 undefined. */
export function registryFieldLabel(line: Pick<DialogueLine, "scope" | "kind" | "field">): string | undefined {
  if (line.scope === "quest") {
    if (line.field === "title") return "퀘스트 제목";
    if (line.field === "summary") return "퀘스트 요약";
    const step = /^(?:step|node)(\d+)$/u.exec(line.field);
    return step ? `퀘스트 ${Number(step[1]) + 1}단계` : "퀘스트";
  }
  if (line.scope === "ending" && line.kind === "ending") {
    return line.field === "name" ? "엔딩 제목" : line.field === "kicker" ? "엔딩 머리말" : line.field === "credits" ? "엔딩 크레딧" : "엔딩";
  }
  return undefined;
}

/** 창 넘침 판정 대상인가 — 대화창에 뜨는 줄만(선택지 항목·설명·엔딩은 다른 창이다). */
export function dialogueLineUsesMessageWindow(line: Pick<DialogueLine, "kind">): boolean {
  return line.kind === "text" || line.kind === "choicePrompt" || line.kind === "presentPrompt";
}

export function speakerSummary(lines: readonly DialogueLine[]): { readonly speaker: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const line of lines) if (line.speaker) counts.set(line.speaker, (counts.get(line.speaker) ?? 0) + 1);
  return [...counts.entries()].map(([speaker, count]) => ({ speaker, count })).sort((a, b) => b.count - a.count || a.speaker.localeCompare(b.speaker, "ko"));
}
