// editor/dialogue/storyScript.ts
// 대본(screenplay) — 프로젝트의 대사를 «맵 순서» 가 아니라 «이야기 순서» 로 엮는다. 사람(자료집 「대사 › 대본」)과
// 조수(read_story_script · get_story_outline)가 같은 구조를 읽는다. DOM·스토어를 모른다.
//
// 장면(scene) = 이벤트 쪽 하나 · 공용 이벤트 하나 · 적 그룹 전투 쪽/전투 뒤 하나. 장면 id 는 대사 색인의 groupKey 와 같다.
// 순서:
//   1. 대체 순서 = 시작 맵부터 맵 트리 순 → 이벤트 순 → 쪽 순(공용 이벤트·적 그룹은 그 뒤).
//   2. 간선(앞 장면 → 뒤 장면):
//      - 스위치를 켜는 장면 → 그 스위치를 쪽 조건으로 요구하는 장면
//      - 변수를 바꾸는 장면 → 그 변수를 쪽 조건으로 비교하는 장면
//      - 같은 이벤트의 앞 쪽 → 뒤 쪽(뒤 쪽이 «나중 상태» 다)
//      - 장소 이동하는 장면 → 도착 맵의 자동 시작·병렬 쪽(도착 컷신)
//      - 공용 이벤트·전투를 부르는 장면 → 그 공용 이벤트·적 그룹 장면
//   3. 위상 정렬(칸 순). 준비된 장면이 여럿이면 대체 순서가 앞선 것부터, 순환이면 대체 순서로 끊는다.
// 본줄/곁가지: 자동 시작·병렬 컷신, 이야기 스위치를 켜는 장면, 전투·엔딩이 든 장면은 본줄이다. 조건 없는 잡담·조사 글은 곁가지다.
// 막: 엔딩(triggerEnding · ending) 이 든 본줄 장면에서 막을 끊는다. 이름은 엔딩 이름. 표식이 없으면 한 막(「이야기」)이다.
// 장(section): 막 안에서 본줄 장면의 장소가 바뀌는 곳(2장면 이상 머무는 곳)에서 끊는다.

import type { Command, Condition, Project } from "@/project/types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { eventDisplayName } from "@/project/eventDisplayName";
import { EMOTE_LABELS } from "@/project/emotes";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import { collectDialogueLines, type DialogueLine } from "./dialogueIndex";

export type ScriptNode =
  | { readonly k: "line"; readonly line: DialogueLine }
  | { readonly k: "dir"; readonly text: string; readonly tone?: "progress" | "battle" | "move" | "end"; readonly movers?: readonly string[] }
  | { readonly k: "choice"; readonly prompt?: DialogueLine; readonly options: readonly ScriptBlock[] }
  | ScriptBlock;

export interface ScriptBlock {
  readonly k: "block";
  readonly label: string;
  readonly tone: "choice" | "cond" | "battle" | "other";
  /** 선택지 가지면 그 선택지 글(고칠 수 있는 줄). */
  readonly head?: DialogueLine;
  readonly children: readonly ScriptNode[];
}

export type SceneLane = "main" | "side";

export interface StoryScene {
  readonly id: string;
  /** 「S12」(본줄) · 「B3」(곁가지). */
  readonly ref: string;
  readonly lane: SceneLane;
  readonly scope: "map" | "common" | "troop";
  readonly place: string;
  readonly title: string;
  readonly trigger: string;
  readonly conditions: readonly string[];
  readonly nodes: readonly ScriptNode[];
  readonly lines: readonly DialogueLine[];
  readonly speakers: readonly string[];
  readonly autoSummary: string;
  readonly chapterId: string;
  /** 곁가지가 «이 뒤로 들을 수 있는» 본줄 장면. 없으면 막 처음부터. */
  readonly anchorId?: string;
  readonly mapId?: string;
  readonly eventId?: string;
  readonly pageId?: string;
  readonly commonEventId?: string;
  readonly troopId?: string;
  readonly endsChapter: boolean;
  /** 앞선 장면과 대사가 글자 하나 다르지 않다(계산대 쌍둥이 이벤트·같은 문의 다른 쪽 등). 그 장면 id. */
  readonly sameAs?: string;
}

export interface StorySection {
  readonly title: string;
  readonly sceneIds: readonly string[];
}

export interface StoryChapter {
  readonly id: string;
  readonly title: string;
  readonly source: "ending" | "inferred";
  readonly sections: readonly StorySection[];
  /** 본줄 장면(읽는 순서). */
  readonly mainIds: readonly string[];
  /** 이 막의 곁가지 장면(읽는 순서). */
  readonly sideIds: readonly string[];
}

export interface Story {
  readonly chapters: readonly StoryChapter[];
  readonly scenes: ReadonlyMap<string, StoryScene>;
  /** 대사가 있는 모든 장면, 이야기 순서. */
  readonly order: readonly string[];
  /** 줄 id → 장면 id · 장면 안 번호(1부터). */
  readonly lineRefs: ReadonlyMap<string, { readonly sceneId: string; readonly index: number }>;
}

// ─────────────────────────────────────────────────────────────── 이름 찾기

interface Names {
  readonly switchName: (id: string) => string;
  readonly variableName: (id: string) => string;
  readonly mapName: (id: string) => string;
  readonly itemName: (id: string) => string;
  readonly actorName: (id: string) => string;
  readonly troopName: (id: string) => string;
  readonly eventName: (mapId: string | undefined, id: string) => string;
  readonly commonName: (id: string) => string;
  readonly endingName: (id: string | undefined) => string;
}

function buildNames(project: Project): Names {
  const switches = new Map((project.switches ?? []).map((record) => [record.id, record.name?.trim() || ""]));
  const variables = new Map((project.variables ?? []).map((record) => [record.id, record.name?.trim() || ""]));
  const database = project.database;
  const items = new Map([...(database?.items ?? []), ...(database?.equipment ?? [])].map((record) => [record.id, record.name]));
  const actors = new Map((database?.actors ?? []).map((record) => [record.id, record.name]));
  const troops = new Map((database?.troops ?? []).map((record) => [record.id, record.name]));
  const commons = new Map((project.commonEvents ?? []).map((record) => [record.id, record.name]));
  const endings = new Map((project.endings ?? []).map((record) => [record.id, record.name]));
  return {
    switchName: (id) => { const name = switches.get(id); return name && name !== id ? name : id; },
    variableName: (id) => variables.get(id) || id,
    mapName: (id) => project.maps[id]?.name || id,
    itemName: (id) => items.get(id) || id,
    actorName: (id) => actors.get(id) || id,
    troopName: (id) => troops.get(id) || id,
    eventName: (mapId, id) => {
      if (id === PLAYER_MOVE_TARGET || id === "player") return "주인공";
      const event = mapId ? project.maps[mapId]?.events.find((candidate) => candidate.id === id) : undefined;
      return event ? eventDisplayName(event) : id;
    },
    commonName: (id) => commons.get(id) || id,
    endingName: (id) => (id && endings.get(id)) || "엔딩",
  };
}

const OP_TEXT: Record<string, string> = { "==": "=", ">=": "≥", "<=": "≤", ">": ">", "<": "<", "!=": "≠" };

function conditionText(condition: Condition, names: Names, mapId?: string): string {
  switch (condition.kind) {
    case "switch": return condition.value ? `〈${names.switchName(condition.switchId)}〉` : `〈${names.switchName(condition.switchId)}〉 아님`;
    case "variable": return `${names.variableName(condition.variableId)} ${OP_TEXT[condition.op] ?? condition.op} ${condition.value}`;
    case "selfSwitch": return condition.value ? `이 이벤트 표시 ${condition.key}` : `이 이벤트 표시 ${condition.key} 없음`;
    case "item": return condition.present ? `${names.itemName(condition.itemId)} 가짐` : `${names.itemName(condition.itemId)} 없음`;
    case "actor": return condition.present ? `${names.actorName(condition.actorId)} 동료` : `${names.actorName(condition.actorId)} 없음`;
    case "battleResult": return condition.result === "victory" ? "전투에 이겼을 때" : condition.result === "defeat" ? "전투에 졌을 때" : "전투에서 달아났을 때";
    case "gold": return `돈 ${OP_TEXT[condition.op] ?? condition.op} ${condition.amount}`;
    case "all": return (condition as { conditions?: Condition[] }).conditions?.map((inner) => conditionText(inner, names, mapId)).join(" 그리고 ") || "모두";
    case "any": return (condition as { conditions?: Condition[] }).conditions?.map((inner) => conditionText(inner, names, mapId)).join(" 또는 ") || "하나라도";
    case "not": return `아님(${conditionText((condition as { condition: Condition }).condition, names, mapId)})`;
    case "eventSeesPlayer": return "들켰을 때";
    case "facing": return "바라보는 방향";
    case "insideLocation": return "그 자리 안";
    default: return "조건";
  }
}

const TRIGGER_TEXT: Record<string, string> = {
  action: "말 걸기·조사",
  touch: "닿으면",
  playerTouch: "닿으면",
  eventTouch: "닿으면",
  auto: "자동 시작",
  parallel: "병렬",
  locationTransition: "장소 바뀔 때",
};

const M2_DIRECTIONS: Record<string, string> = {
  "m2-048-shake-screen": "화면이 흔들린다",
  "m2-047-flash-screen": "번쩍",
};

// ─────────────────────────────────────────────────────────────── 장면 짓기

interface SceneDraft {
  id: string;
  scope: "map" | "common" | "troop";
  place: string;
  title: string;
  trigger: string;
  triggerKind: string;
  conditionList: readonly Condition[];
  commands: readonly Command[];
  mapId?: string;
  eventId?: string;
  pageId?: string;
  commonEventId?: string;
  troopId?: string;
  fallback: number;
  // 그래프 재료
  setsSwitches: Set<string>;
  setsVariables: Set<string>;
  transfersTo: Set<string>;
  givesItems: Set<string>;
  callsCommon: Set<string>;
  battles: Set<string>;
  hasBattle: boolean;
  endsChapter: boolean;
  endingTitle?: string;
}

function scanCommands(commands: readonly Command[], draft: SceneDraft, names: Names): void {
  for (const command of commands) {
    switch (command.kind) {
      case "setSwitch":
        if (command.value !== false) draft.setsSwitches.add(command.switchId);
        break;
      case "setVariable":
        draft.setsVariables.add(command.variableId);
        break;
      case "transfer":
        draft.transfersTo.add(command.mapId);
        break;
      case "changeItem":
        if (command.op !== "-=") draft.givesItems.add(command.itemId);
        break;
      case "callCommonEvent":
        draft.callsCommon.add(command.commonEventId);
        break;
      case "battleProcessing":
        draft.hasBattle = true;
        if (command.troopId) draft.battles.add(command.troopId);
        break;
      case "triggerEnding":
        draft.endsChapter = true;
        draft.endingTitle ??= names.endingName(command.endingId);
        break;
      case "ending":
        draft.endsChapter = true;
        draft.endingTitle ??= command.title || "엔딩";
        break;
      default:
        break;
    }
    for (const branch of eventCommandBranches(command)) scanCommands(branch.commands, draft, names);
  }
}

function moveTargetName(eventId: string, mapId: string | undefined, names: Names): string {
  return names.eventName(mapId, eventId);
}

function directionFor(command: Command, names: Names, mapId: string | undefined, storySwitches: ReadonlySet<string>): ScriptNode | null {
  switch (command.kind) {
    case "transfer": return { k: "dir", text: `장소 이동 → ${names.mapName(command.mapId)}`, tone: "move" };
    case "battleProcessing": return { k: "dir", text: `전투: ${names.troopName(command.troopId)}`, tone: "battle" };
    case "moveEvent": return { k: "dir", text: `${moveTargetName(command.eventId, mapId, names)}, 움직인다`, movers: [moveTargetName(command.eventId, mapId, names)] };
    case "showEmote": {
      const who = command.target === "player" ? "주인공" : moveTargetName(command.target.eventId, mapId, names);
      return { k: "dir", text: `${who} ${EMOTE_LABELS[command.emote] ?? command.emote}` };
    }
    case "changeItem": {
      const amount = typeof command.amount === "number" ? command.amount : 1;
      if (command.op === "-=") return { k: "dir", text: `${names.itemName(command.itemId)} 건넴` };
      return { k: "dir", text: `${names.itemName(command.itemId)} 얻음${amount > 1 ? ` ×${amount}` : ""}` };
    }
    case "changeParty":
      return { k: "dir", text: command.action === "remove" ? `${names.actorName(command.actorId)} 이탈` : command.action === "add" ? `${names.actorName(command.actorId)} 합류` : `${names.actorName(command.actorId)} 앞장` };
    case "callCommonEvent": return { k: "dir", text: `공용 이벤트: ${names.commonName(command.commonEventId)}` };
    case "triggerEnding": return { k: "dir", text: `엔딩: ${names.endingName(command.endingId)}`, tone: "end" };
    case "gameOver": return { k: "dir", text: "게임 오버", tone: "end" };
    case "shop": return { k: "dir", text: "상점" };
    case "inn": return { k: "dir", text: "여관" };
    case "recoverAll": return { k: "dir", text: "모두 회복" };
    case "setSwitch":
      if (command.value === true && storySwitches.has(command.switchId)) {
        const name = names.switchName(command.switchId);
        return name === command.switchId ? null : { k: "dir", text: `진행: ${name}`, tone: "progress" };
      }
      return null;
    case "m2Command": {
      const text = M2_DIRECTIONS[command.commandId];
      return text ? { k: "dir", text } : null;
    }
    default: return null;
  }
}

/** 대사도, 전투·진행·엔딩 표시도 없는 갈래(바라보는 방향 맞추기 같은 연출 분기)는 대본에서 뺀다. */
function carriesStory(nodes: readonly ScriptNode[]): boolean {
  return nodes.some((node) => {
    if (node.k === "line" || node.k === "choice") return true;
    if (node.k === "dir") return node.tone === "battle" || node.tone === "end" || node.tone === "progress";
    return carriesStory(node.children);
  });
}

function meaningful(nodes: ScriptNode[]): ScriptNode[] {
  return carriesStory(nodes) ? nodes : [];
}

function buildNodes(
  commands: readonly Command[],
  groupKey: string,
  linesByKey: ReadonlyMap<string, DialogueLine>,
  names: Names,
  mapId: string | undefined,
  storySwitches: ReadonlySet<string>,
): ScriptNode[] {
  const visit = (list: readonly Command[], container: readonly number[]): ScriptNode[] => {
    const out: ScriptNode[] = [];
    const lineAt = (path: readonly number[], field: string): DialogueLine | undefined => linesByKey.get(`${groupKey}|${path.join(".")}#${field}`);
    const pushDir = (node: ScriptNode | null): void => {
      if (!node) return;
      const last = out[out.length - 1];
      if (node.k === "dir" && last?.k === "dir" && last.text === node.text) return;
      // 이어진 «누가 움직인다» 는 한 줄로 — 군중이 흩어지는 장면이 지문 열 줄이 되지 않게.
      if (node.k === "dir" && node.movers && last?.k === "dir" && last.movers) {
        const movers = [...new Set([...last.movers, ...node.movers])];
        out[out.length - 1] = { k: "dir", text: `${movers.join(", ")}, 움직인다`, movers };
        return;
      }
      out.push(node);
    };
    list.forEach((command, index) => {
      const path = [...container, index];
      const branches = eventCommandBranches(command);
      switch (command.kind) {
        case "text": {
          const line = lineAt(path, "body");
          if (line) out.push({ k: "line", line });
          return;
        }
        case "choices": {
          const prompt = lineAt(path, "prompt");
          const options: ScriptBlock[] = branches.map((branch) => ({
            k: "block",
            label: branch.label,
            tone: "choice",
            ...(branch.kind === "choiceOption" ? { head: lineAt(path, `opt${branch.branchIndex}`) } : {}),
            children: visit(branch.commands, [...path, branch.branchIndex]),
          }));
          out.push({ k: "choice", ...(prompt ? { prompt } : {}), options });
          return;
        }
        case "fork": {
          const then = branches.find((branch) => branch.kind === "forkThen");
          const otherwise = branches.find((branch) => branch.kind === "forkElse");
          const condition = conditionText(command.condition, names, mapId);
          const thenNodes = then ? meaningful(visit(then.commands, [...path, then.branchIndex])) : [];
          const elseNodes = otherwise ? meaningful(visit(otherwise.commands, [...path, otherwise.branchIndex])) : [];
          if (thenNodes.length) out.push({ k: "block", label: `만약 ${condition}`, tone: "cond", children: thenNodes });
          if (elseNodes.length) out.push({ k: "block", label: thenNodes.length ? "아니면" : `만약 아님: ${condition}`, tone: "cond", children: elseNodes });
          return;
        }
        default: {
          const dir = directionFor(command, names, mapId, storySwitches);
          if (command.kind === "presentItem") {
            const prompt = lineAt(path, "prompt");
            if (prompt) out.push({ k: "line", line: prompt });
          }
          if (command.kind === "ending") {
            for (const field of ["title", "message"]) {
              const line = lineAt(path, field);
              if (line) out.push({ k: "line", line });
            }
          }
          pushDir(dir);
          for (const branch of branches) {
            const children = command.kind === "loop" ? visit(branch.commands, [...path, branch.branchIndex]) : meaningful(visit(branch.commands, [...path, branch.branchIndex]));
            if (children.length === 0) continue;
            if (command.kind === "loop") { out.push(...children); continue; }
            out.push({ k: "block", label: branch.label, tone: command.kind === "battleProcessing" ? "battle" : "other", children });
          }
        }
      }
    });
    // 내용 없는 진행 표시만 남은 목록은 그대로 둔다(뷰가 dir 만 있는 장면은 숨긴다).
    return out;
  };
  return visit(commands, []);
}

function sceneLines(nodes: readonly ScriptNode[], out: DialogueLine[] = []): DialogueLine[] {
  for (const node of nodes) {
    if (node.k === "line") out.push(node.line);
    else if (node.k === "choice") {
      if (node.prompt) out.push(node.prompt);
      for (const option of node.options) sceneLines([option], out);
    } else if (node.k === "block") {
      if (node.head) out.push(node.head);
      sceneLines(node.children, out);
    }
  }
  return out;
}

function sceneDirections(nodes: readonly ScriptNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.k === "dir" && node.tone && node.tone !== "progress") out.push(node.text);
    else if (node.k === "choice") node.options.forEach((option) => sceneDirections(option.children, out));
    else if (node.k === "block") sceneDirections(node.children, out);
  }
  return out;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function autoSummaryOf(lines: readonly DialogueLine[], nodes: readonly ScriptNode[]): string {
  const speakers = [...new Set(lines.map((line) => line.speaker).filter(Boolean))];
  const first = lines.find((line) => line.kind === "text") ?? lines[0];
  const extras = [...new Set(sceneDirections(nodes))].slice(0, 2);
  const who = speakers.length ? speakers.slice(0, 3).join("·") : "내레이션";
  return `${who}${first ? ` — «${clip(first.text, 34)}»` : ""}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

// ─────────────────────────────────────────────────────────────── 맵 순서

function mapOrder(project: Project): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (id: string): void => {
    if (!seen.has(id) && project.maps[id]) { seen.add(id); order.push(id); }
  };
  const start = (project as { startMapId?: string }).startMapId;
  const tree = (project as { mapTree?: unknown }).mapTree as { mapId?: string; children?: unknown[] } | undefined;
  const walk = (node: { mapId?: string; children?: unknown[] } | undefined): void => {
    if (!node) return;
    if (node.mapId) add(node.mapId);
    for (const child of node.children ?? []) walk(child as { mapId?: string; children?: unknown[] });
  };
  if (start) add(start);
  if (Array.isArray(tree)) tree.forEach((node) => walk(node as { mapId?: string; children?: unknown[] }));
  else walk(tree);
  for (const id of Object.keys(project.maps)) add(id);
  return order;
}

// ─────────────────────────────────────────────────────────────── 이야기 짓기

const cache = new WeakMap<Project, { readonly story: Story; readonly parts: readonly unknown[] }>();

function storyParts(project: Project): readonly unknown[] {
  const loose = project as unknown as Record<string, unknown>;
  return [project.maps, loose.commonEvents, loose.troops, loose.switches, loose.variables, loose.items, loose.actors, loose.endings, loose.mapTree];
}

/** 이야기 순서 대본. 같은 프로젝트 객체·같은 맵/이벤트 묶음이면 다시 계산하지 않는다.
 *  조수 도구처럼 초안을 제자리에서 고치는 쪽은 fresh 로 부른다. */
export function buildStory(project: Project, options: { readonly fresh?: boolean } = {}): Story {
  const parts = storyParts(project);
  const cached = options.fresh ? undefined : cache.get(project);
  if (cached && cached.parts.every((part, index) => part === parts[index])) return cached.story;
  const story = buildStoryUncached(project);
  cache.set(project, { story, parts });
  return story;
}

function buildStoryUncached(project: Project): Story {
  const names = buildNames(project);
  const lines = collectDialogueLines(project, { includeDescriptions: false });
  const linesByKey = new Map<string, DialogueLine>();
  for (const line of lines) linesByKey.set(`${line.groupKey}|${line.path.join(".")}#${line.field}`, line);

  // 1. 장면 초안 + 대체 순서
  const drafts: SceneDraft[] = [];
  const blank = (): Pick<SceneDraft, "setsSwitches" | "setsVariables" | "transfersTo" | "givesItems" | "callsCommon" | "battles" | "hasBattle" | "endsChapter"> => ({
    setsSwitches: new Set(), setsVariables: new Set(), transfersTo: new Set(), givesItems: new Set(), callsCommon: new Set(), battles: new Set(), hasBattle: false, endsChapter: false,
  });
  for (const mapId of mapOrder(project)) {
    const map = project.maps[mapId]!;
    for (const event of map.events) {
      const eventName = eventDisplayName(event);
      const pages = event.pages && event.pages.length > 0 ? event.pages : null;
      if (pages) {
        pages.forEach((page, pageIndex) => {
          const pageName = page.name?.trim();
          drafts.push({
            id: `ev/${map.id}/${event.id}/${page.id}`,
            scope: "map",
            place: map.name,
            title: pages.length > 1 && pageName && !/^\d+$/u.test(pageName) && pageName !== eventName ? `${eventName} · ${pageName}` : pages.length > 1 ? `${eventName} (${pageIndex + 1})` : eventName,
            trigger: TRIGGER_TEXT[page.trigger?.kind ?? "action"] ?? page.trigger?.kind ?? "",
            triggerKind: page.trigger?.kind ?? "action",
            conditionList: page.conditions ?? [],
            commands: page.commands ?? [],
            mapId: map.id, eventId: event.id, pageId: page.id,
            fallback: drafts.length,
            ...blank(),
          });
        });
      } else if (event.commands?.length) {
        drafts.push({
          id: `ev/${map.id}/${event.id}/_`, scope: "map", place: map.name, title: eventName, trigger: "말 걸기·조사", triggerKind: "action",
          conditionList: [], commands: event.commands, mapId: map.id, eventId: event.id, fallback: drafts.length, ...blank(),
        });
      }
    }
  }
  for (const common of project.commonEvents ?? []) {
    drafts.push({
      id: `ce/${common.id}`, scope: "common", place: "공용 이벤트", title: common.name || common.id, trigger: "불렀을 때", triggerKind: "call",
      conditionList: [], commands: common.commands ?? [], commonEventId: common.id, fallback: drafts.length, ...blank(),
    });
  }
  for (const troop of project.database?.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) {
      drafts.push({
        id: `tp/${troop.id}/${page.id}`, scope: "troop", place: `전투 · ${troop.name || troop.id}`, title: page.name || "전투 중", trigger: "전투 중", triggerKind: "battle",
        conditionList: [], commands: page.commands ?? [], troopId: troop.id, fallback: drafts.length, ...blank(),
      });
    }
    for (const list of troopAfterBattleLists(troop)) {
      drafts.push({
        id: `ta/${troop.id}/${list.outcome}`, scope: "troop", place: `전투 · ${troop.name || troop.id}`,
        title: list.outcome === "victory" ? "이긴 뒤" : list.outcome === "defeat" ? "진 뒤" : "달아난 뒤", trigger: "전투 뒤", triggerKind: "battle",
        conditionList: [], commands: list.commands, troopId: troop.id, fallback: drafts.length, ...blank(),
      });
    }
  }
  for (const draft of drafts) scanCommands(draft.commands, draft, names);

  // 2. 이야기 스위치 = 어느 조건이든 묻는 스위치
  const storySwitches = new Set<string>();
  const collectConditionSwitches = (condition: Condition): void => {
    if (condition.kind === "switch") storySwitches.add(condition.switchId);
    const inner = condition as { conditions?: Condition[]; condition?: Condition };
    inner.conditions?.forEach(collectConditionSwitches);
    if (inner.condition) collectConditionSwitches(inner.condition);
  };
  const scanForkConditions = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === "fork") collectConditionSwitches(command.condition);
      for (const branch of eventCommandBranches(command)) scanForkConditions(branch.commands);
    }
  };
  // 다른 이벤트의 쪽 조건이 묻는 스위치 → 이야기 진행 스위치(제 이벤트 다음 쪽만 여는 스위치는 «그 사람의 사정» 이다).
  const gateOwners = new Map<string, Set<string>>();
  for (const draft of drafts) {
    for (const condition of draft.conditionList) {
      if (condition.kind !== "switch") continue;
      const owners = gateOwners.get(condition.switchId) ?? new Set<string>();
      owners.add(draft.eventId ?? draft.id);
      gateOwners.set(condition.switchId, owners);
    }
  }
  const crossGates = (draft: SceneDraft): boolean => [...draft.setsSwitches].some((id) => [...(gateOwners.get(id) ?? [])].some((owner) => owner !== (draft.eventId ?? draft.id)));
  for (const draft of drafts) {
    draft.conditionList.forEach(collectConditionSwitches);
    scanForkConditions(draft.commands);
  }

  // 3. 간선
  const index = new Map(drafts.map((draft, position) => [draft.id, position]));
  const succ: Set<number>[] = drafts.map(() => new Set());
  const pred: Set<number>[] = drafts.map(() => new Set());
  const edge = (from: number, to: number): void => {
    if (from === to) return;
    succ[from]!.add(to);
    pred[to]!.add(from);
  };
  // 문(gate) 간선만 따로 — 본줄 판정(엔딩까지의 사슬)은 이것과 «잠긴 길로 그 맵에 들어가는 장면» 만 따라간다.
  const gatePred: Set<number>[] = drafts.map(() => new Set());
  const gated = new Array<boolean>(drafts.length).fill(false);
  const gateEdge = (from: number, to: number): void => {
    edge(from, to);
    if (from !== to) { gatePred[to]!.add(from); gated[to] = true; }
  };
  const itemSetters = new Map<string, number[]>();
  drafts.forEach((draft, position) => {
    for (const id of draft.givesItems) itemSetters.set(id, [...(itemSetters.get(id) ?? []), position]);
  });
  const switchSetters = new Map<string, number[]>();
  const variableSetters = new Map<string, number[]>();
  drafts.forEach((draft, position) => {
    for (const id of draft.setsSwitches) switchSetters.set(id, [...(switchSetters.get(id) ?? []), position]);
    for (const id of draft.setsVariables) variableSetters.set(id, [...(variableSetters.get(id) ?? []), position]);
  });

  drafts.forEach((draft, position) => {
    const requireCondition = (condition: Condition): void => {
      if (condition.kind === "switch" && condition.value) for (const setter of switchSetters.get(condition.switchId) ?? []) gateEdge(setter, position);
      if (condition.kind === "variable") for (const setter of variableSetters.get(condition.variableId) ?? []) gateEdge(setter, position);
      if (condition.kind === "item" && condition.present) for (const setter of itemSetters.get(condition.itemId) ?? []) gateEdge(setter, position);
      const inner = condition as { conditions?: Condition[] };
      inner.conditions?.forEach(requireCondition);
    };
    draft.conditionList.forEach(requireCondition);
    // 쪽 본문이 통째로 조건 분기 안에 있으면(맨 위 줄에 대사가 없고 분기만 있다) 그 분기 조건도 이 장면의 문이다 — 열쇠로 여는 문 같은 것.
    const topLevelLines = draft.commands.some((command) => command.kind === "text" || command.kind === "choices");
    if (!topLevelLines) for (const command of draft.commands) if (command.kind === "fork") requireCondition(command.condition);
    for (const id of draft.callsCommon) { const target = index.get(`ce/${id}`); if (target !== undefined) edge(position, target); }
    for (const troopId of draft.battles) {
      drafts.forEach((candidate, candidatePosition) => { if (candidate.scope === "troop" && candidate.troopId === troopId) edge(position, candidatePosition); });
    }
  });
  // 같은 이벤트: 앞 쪽 → 뒤 쪽
  for (let position = 1; position < drafts.length; position += 1) {
    const previous = drafts[position - 1]!;
    const current = drafts[position]!;
    if (current.scope === "map" && previous.eventId === current.eventId && previous.mapId === current.mapId && current.pageId) edge(position - 1, position);
  }

  // 4. 본줄 = 엔딩까지 이어지는 사슬. 엔딩 장면에서 문 간선과 «그 맵에 들어가는 길» 을 거꾸로 걸어 닿는 장면(조상),
  //    그 사슬이 지나는 맵의 도착·자동 컷신, 그리고 그것들이 부르는 전투·공용 이벤트.
  // 그 맵에 들어가는 길: 잠긴 문(문 간선이 있는 장면)이나 대사 없는 순수 출입구. 시작 맵과 제자리 이동, 대사 있는 «쫓겨남» 은 길로 치지 않는다.
  const startMap = mapOrder(project)[0];
  const hasLines = (draft: SceneDraft): boolean => {
    const visit = (commands: readonly Command[]): boolean => commands.some((command) => command.kind === "text"
      || eventCommandBranches(command).some((branch) => visit(branch.commands)));
    return visit(draft.commands);
  };
  // 맵 트리에서 자식 맵 → 조상 맵으로 가는 문은 «되돌아 나가는 길» 이다(지하 4층 → 3층). 들어가는 길로 치지 않는다 — 그러면 문마다 순환이 생긴다.
  const parentMap = new Map<string, string>();
  const walkTree = (node: { mapId?: string; children?: unknown[] } | undefined, parent?: string): void => {
    if (!node) return;
    if (node.mapId && parent && !parentMap.has(node.mapId)) parentMap.set(node.mapId, parent);
    for (const child of node.children ?? []) walkTree(child as { mapId?: string; children?: unknown[] }, node.mapId ?? parent);
  };
  const tree = (project as { mapTree?: unknown }).mapTree;
  if (Array.isArray(tree)) tree.forEach((node) => walkTree(node as { mapId?: string; children?: unknown[] }));
  else walkTree(tree as { mapId?: string; children?: unknown[] } | undefined);
  const isInside = (mapId: string, ancestor: string): boolean => {
    let cursor = parentMap.get(mapId);
    for (let guard = 0; cursor && guard < 64; guard += 1) {
      if (cursor === ancestor) return true;
      cursor = parentMap.get(cursor);
    }
    return false;
  };
  const entrants = new Map<string, number[]>();
  drafts.forEach((draft, position) => {
    if (!gated[position] && hasLines(draft)) return;
    for (const mapId of draft.transfersTo) {
      if (mapId === startMap || mapId === draft.mapId) continue;
      if (draft.mapId && isInside(draft.mapId, mapId)) continue;
      entrants.set(mapId, [...(entrants.get(mapId) ?? []), position]);
    }
  });
  const endingAncestors = new Set<number>();
  const walkBack = (position: number): void => {
    const mapId = drafts[position]!.mapId;
    const parents = [...gatePred[position]!, ...(mapId ? entrants.get(mapId) ?? [] : [])];
    for (const parent of parents) if (!endingAncestors.has(parent)) { endingAncestors.add(parent); walkBack(parent); }
  };
  drafts.forEach((draft, position) => { if (draft.endsChapter) { endingAncestors.add(position); walkBack(position); } });
  const anyEnding = endingAncestors.size > 0;
  const mainMaps = new Set([...endingAncestors].map((position) => drafts[position]!.mapId).filter((id): id is string => Boolean(id)));
  const mapMain = (draft: SceneDraft, position: number): boolean => {
    if (anyEnding) {
      if (endingAncestors.has(position)) return true;
      return (draft.triggerKind === "auto" || draft.triggerKind === "parallel") && Boolean(draft.mapId && mainMaps.has(draft.mapId));
    }
    if (draft.triggerKind === "auto" || draft.triggerKind === "parallel") return true;
    // 다른 이벤트의 쪽 조건이 묻는 스위치를 켜는 장면 = 이야기를 앞으로 미는 장면.
    return crossGates(draft);
  };
  const callers: Set<number>[] = drafts.map(() => new Set());
  drafts.forEach((draft, position) => {
    for (const id of draft.callsCommon) { const target = index.get(`ce/${id}`); if (target !== undefined) callers[target]!.add(position); }
    for (const troopId of draft.battles) drafts.forEach((candidate, candidatePosition) => { if (candidate.scope === "troop" && candidate.troopId === troopId) callers[candidatePosition]!.add(position); });
  });
  const mainSet = new Set<number>();
  drafts.forEach((draft, position) => { if (draft.scope === "map" && mapMain(draft, position)) mainSet.add(position); });
  for (let round = 0; round < 3; round += 1) {
    drafts.forEach((draft, position) => { if (draft.scope !== "map" && [...callers[position]!].some((caller) => mainSet.has(caller))) mainSet.add(position); });
  }
  // 장면은 그 맵에 들어가는 길 뒤에 온다(순서용 간선). 곁가지도 — 동굴 안 광부는 동굴로 들어가는 장면 뒤에 닻을 둔다.
  for (let position = 0; position < drafts.length; position += 1) {
    if (drafts[position]!.scope !== "map") continue;
    const mapId = drafts[position]!.mapId;
    if (!mapId || mapId === startMap) continue;
    for (const entrant of entrants.get(mapId) ?? []) edge(entrant, position);
  }

  // 5. 위상 정렬. 준비된 장면 가운데 본줄 먼저, 방금 꺼낸 장면에 가장 가까이 이어지는 것(이야기 실을 따라가기), 그다음 대체 순서.
  //    막을 끝내는 장면은 다른 준비된 장면이 하나도 없을 때만 꺼낸다. 순환이면 대체 순서로 끊는다.
  // 순환(문끼리 서로 오가는 숲길, 같은 퀘스트를 주고받는 계산대 쌍둥이)은 강결합 덩이로 묶고 덩이 안 간선을 버린다 —
  // 그래야 위상 정렬이 순환 하나 때문에 엉뚱한 장면부터 끊지 않는다. 덩이 안 순서는 대체 순서를 따른다.
  const component = new Array<number>(drafts.length).fill(-1);
  {
    let counter = 0;
    let componentCount = 0;
    const visitIndex = new Array<number>(drafts.length).fill(-1);
    const low = new Array<number>(drafts.length).fill(0);
    const stack: number[] = [];
    const onStack = new Array<boolean>(drafts.length).fill(false);
    for (let root = 0; root < drafts.length; root += 1) {
      if (visitIndex[root]! >= 0) continue;
      const frames: { node: number; next: Iterator<number> }[] = [];
      const open = (node: number): void => {
        visitIndex[node] = counter; low[node] = counter; counter += 1;
        stack.push(node); onStack[node] = true;
        frames.push({ node, next: succ[node]![Symbol.iterator]() });
      };
      open(root);
      while (frames.length > 0) {
        const frame = frames[frames.length - 1]!;
        const step = frame.next.next();
        if (!step.done) {
          const next = step.value;
          if (visitIndex[next]! < 0) open(next);
          else if (onStack[next]) low[frame.node] = Math.min(low[frame.node]!, visitIndex[next]!);
          continue;
        }
        frames.pop();
        const parent = frames[frames.length - 1];
        if (parent) low[parent.node] = Math.min(low[parent.node]!, low[frame.node]!);
        if (low[frame.node] === visitIndex[frame.node]) {
          let member: number;
          do { member = stack.pop()!; onStack[member] = false; component[member] = componentCount; } while (member !== frame.node);
          componentCount += 1;
        }
      }
    }
  }
  drafts.forEach((_, from) => {
    for (const to of [...succ[from]!]) {
      if (component[from] === component[to]) { succ[from]!.delete(to); pred[to]!.delete(from); }
    }
  });
  // 깊이 = 시작에서 이 장면까지 가장 긴 사슬의 길이. 같은 깊이의 장면은 이야기에서 «같은 무렵» 이다 —
  // 한 실을 끝까지 따라가면(숲 → 지하 → 용) 다른 갈래(숲의 발렌)가 통째로 뒤로 밀리므로, 깊이가 얕은 것부터 꺼낸다.
  const depth = new Array<number>(drafts.length).fill(0);
  {
    const remaining = drafts.map((_, position) => pred[position]!.size);
    const queue: number[] = [];
    remaining.forEach((value, position) => { if (value === 0) queue.push(position); });
    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head]!;
      for (const next of succ[node]!) {
        if (depth[node]! + 1 > depth[next]!) depth[next] = depth[node]! + 1;
        remaining[next]! -= 1;
        if (remaining[next] === 0) queue.push(next);
      }
    }
  }
  const indegree = drafts.map((_, position) => pred[position]!.size);
  const done = new Array<boolean>(drafts.length).fill(false);
  const emittedAt = new Array<number>(drafts.length).fill(-1);
  const order: number[] = [];
  const ready = new Set<number>();
  indegree.forEach((value, position) => { if (value === 0) ready.add(position); });
  const threadRank = (position: number): number => {
    let rank = -1;
    for (const parent of pred[position]!) if (emittedAt[parent]! > rank) rank = emittedAt[parent]!;
    return rank;
  };
  // 본줄 장면을 막고 있는 곁 장면(대사 없는 출입구, 같은 이벤트의 앞 쪽)도 본줄과 같이 서둘러 꺼낸다 —
  // 안 그러면 본줄이 곁가지가 다 나올 때까지 기다리느라 뒤로 밀린다.
  const feedsMain = new Set<number>(mainSet);
  {
    const stack = [...mainSet];
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const parent of pred[node]!) if (!feedsMain.has(parent)) { feedsMain.add(parent); stack.push(parent); }
    }
  }
  const better = (a: number, b: number): boolean => {
    const mainA = feedsMain.has(a) ? 1 : 0;
    const mainB = feedsMain.has(b) ? 1 : 0;
    if (mainA !== mainB) return mainA > mainB;
    // 부른 장면이 이미 나온 전투·공용 이벤트는 그 장면에 붙여 바로 꺼낸다.
    const calledA = drafts[a]!.scope !== "map" ? 1 : 0;
    const calledB = drafts[b]!.scope !== "map" ? 1 : 0;
    if (calledA !== calledB) return calledA > calledB;
    if (depth[a] !== depth[b]) return depth[a]! < depth[b]!;
    // 같은 무렵이면 조건이 차자마자 저절로 도는 컷신(자동 시작) 먼저.
    const autoA = drafts[a]!.triggerKind === "auto" ? 1 : 0;
    const autoB = drafts[b]!.triggerKind === "auto" ? 1 : 0;
    if (autoA !== autoB) return autoA > autoB;
    const rankA = threadRank(a);
    const rankB = threadRank(b);
    if (rankA !== rankB) return rankA > rankB;
    return a < b;
  };
  while (order.length < drafts.length) {
    let pick = -1;
    for (const candidate of ready) {
      if (drafts[candidate]!.endsChapter) continue;
      if (pick < 0 || better(candidate, pick)) pick = candidate;
    }
    if (pick < 0) {
      // 준비된 것이 엔딩뿐이거나 아무것도 없다 — 엔딩이 아닌 장면이 순환에 묶여 남아 있으면 그 순환부터 끊는다.
      pick = done.findIndex((value, position) => !value && !ready.has(position) && mainSet.has(position) && !drafts[position]!.endsChapter);
      if (pick < 0) pick = done.findIndex((value, position) => !value && !ready.has(position) && !drafts[position]!.endsChapter);
      if (pick < 0) for (const candidate of ready) if (pick < 0 || better(candidate, pick)) pick = candidate;
      if (pick < 0) pick = done.findIndex((value) => !value);
    }
    ready.delete(pick);
    if (done[pick]) continue;
    done[pick] = true;
    emittedAt[pick] = order.length;
    order.push(pick);
    for (const next of succ[pick]!) {
      indegree[next]! -= 1;
      // 전투·공용 이벤트는 본줄 장면 하나가 부르면 바로 나온다(다시 도전하기 같은 다른 호출을 기다리지 않는다).
      const calledByMain = drafts[next]!.scope !== "map" && mainSet.has(pick) && callers[next]!.has(pick);
      if ((indegree[next]! <= 0 || calledByMain) && !done[next]) ready.add(next);
    }
  }

  const built = new Map<number, { nodes: ScriptNode[]; lines: DialogueLine[] }>();
  for (const position of order) {
    const draft = drafts[position]!;
    const nodes = buildNodes(draft.commands, draft.id, linesByKey, names, draft.mapId, storySwitches);
    const sceneLineList = sceneLines(nodes);
    if (sceneLineList.length > 0) built.set(position, { nodes, lines: sceneLineList });
  }
  const laneOf = new Map<number, SceneLane>();
  for (const position of order) laneOf.set(position, mainSet.has(position) ? "main" : "side");

  // 6. 막·곁가지 닻
  type ChapterBuild = { id: string; title: string; source: "ending" | "inferred"; main: number[]; side: number[] };
  const chapters: ChapterBuild[] = [];
  let current: ChapterBuild = { id: "ch1", title: anyEnding ? "" : "이야기", source: anyEnding ? "ending" : "inferred", main: [], side: [] };
  chapters.push(current);
  const chapterOf = new Map<number, ChapterBuild>();
  const anchorOf = new Map<number, number>();
  const mainAncestor = (position: number, seen = new Set<number>()): number | undefined => {
    let best: number | undefined;
    for (const parent of pred[position]!) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      const candidate = laneOf.get(parent) === "main" && built.has(parent) ? parent : mainAncestor(parent, seen);
      if (candidate !== undefined && (best === undefined || order.indexOf(candidate) > order.indexOf(best))) best = candidate;
    }
    return best;
  };
  const pendingSide: number[] = [];
  for (const position of order) {
    const draft = drafts[position]!;
    const lane = laneOf.get(position)!;
    if (lane === "main") {
      if (built.has(position)) { current.main.push(position); chapterOf.set(position, current); }
      if (draft.endsChapter) {
        current.title ||= draft.endingTitle ?? `제${chapters.length}막`;
        current = { id: `ch${chapters.length + 1}`, title: "", source: "ending", main: [], side: [] };
        chapters.push(current);
      }
    } else if (built.has(position)) {
      pendingSide.push(position);
    }
  }
  for (const position of pendingSide) {
    const anchor = mainAncestor(position);
    const chapter = anchor !== undefined ? chapterOf.get(anchor) ?? chapters[0]! : chapters[0]!;
    if (anchor !== undefined) anchorOf.set(position, anchor);
    chapter.side.push(position);
    chapterOf.set(position, chapter);
  }
  chapters.forEach((chapter, chapterIndex) => {
    if (!chapter.title) chapter.title = chapterIndex === chapters.length - 1 && anyEnding ? "그 뒤 (아직 끝맺지 않은 이야기)" : `제${chapterIndex + 1}막`;
  });
  const liveChapters = chapters.filter((chapter) => chapter.main.length > 0 || chapter.side.length > 0);
  // 대사가 똑같은 쌍둥이 장면(같은 문을 칸마다 깐 것)은 원본 바로 뒤에 모은다 — 사이에 전투가 끼어 읽기 흐름이 끊기지 않게.
  const twinKey = (position: number): string => built.get(position)!.lines.map((line) => `${line.speaker}\u0001${line.text}`).join("\u0002");
  const gatherTwins = (list: number[]): number[] => {
    const groups = new Map<string, number[]>();
    for (const position of list) { const key = twinKey(position); groups.set(key, [...(groups.get(key) ?? []), position]); }
    const placed = new Set<number>();
    const result: number[] = [];
    for (const position of list) {
      if (placed.has(position)) continue;
      for (const member of groups.get(twinKey(position))!) { placed.add(member); result.push(member); }
    }
    return result;
  };
  for (const chapter of liveChapters) {
    chapter.main = gatherTwins(chapter.main);
    chapter.side = gatherTwins(chapter.side);
  }

  // 7. 번호·장면 객체
  const scenes = new Map<string, StoryScene>();
  const lineRefs = new Map<string, { sceneId: string; index: number }>();
  let mainNumber = 0;
  let sideNumber = 0;
  const finalOrder: string[] = [];
  const conditionLabel = (draft: SceneDraft, refOf: (position: number) => string | undefined): string[] => draft.conditionList
    .filter((condition) => condition.kind !== "selfSwitch")
    .map((condition) => {
      if (condition.kind === "switch" && condition.value && names.switchName(condition.switchId) === condition.switchId) {
        const setter = (switchSetters.get(condition.switchId) ?? []).map(refOf).find(Boolean);
        return setter ? `${setter} 뒤` : conditionText(condition, names, draft.mapId);
      }
      return conditionText(condition, names, draft.mapId);
    });
  const refs = new Map<number, string>();
  for (const chapter of liveChapters) {
    for (const position of chapter.main) refs.set(position, `S${++mainNumber}`);
  }
  for (const chapter of liveChapters) {
    for (const position of chapter.side) refs.set(position, `B${++sideNumber}`);
  }
  const refOf = (position: number): string | undefined => refs.get(position);
  const firstWithText = new Map<string, string>();
  const sceneOrder = [...liveChapters.flatMap((chapter) => chapter.main), ...liveChapters.flatMap((chapter) => chapter.side)];
  const chapterByPosition = new Map<number, ChapterBuild>();
  for (const chapter of liveChapters) for (const position of [...chapter.main, ...chapter.side]) chapterByPosition.set(position, chapter);
  {
    for (const position of sceneOrder) {
      const chapter = chapterByPosition.get(position)!;
      const draft = drafts[position]!;
      const content = built.get(position)!;
      const sceneId = draft.id;
      const lane = laneOf.get(position)!;
      content.lines.forEach((line, lineIndex) => lineRefs.set(line.id, { sceneId, index: lineIndex + 1 }));
      const textKey = content.lines.map((line) => `${line.speaker}\u0001${line.text}`).join("\u0002");
      const twin = firstWithText.get(textKey);
      if (!twin) firstWithText.set(textKey, sceneId);
      scenes.set(sceneId, {
        id: sceneId,
        ref: refs.get(position)!,
        lane,
        scope: draft.scope,
        place: draft.place,
        title: draft.title,
        trigger: draft.trigger,
        conditions: conditionLabel(draft, refOf),
        nodes: content.nodes,
        lines: content.lines,
        speakers: [...new Set(content.lines.map((line) => line.speaker).filter(Boolean))],
        autoSummary: autoSummaryOf(content.lines, content.nodes),
        chapterId: chapter.id,
        ...(anchorOf.has(position) ? { anchorId: drafts[anchorOf.get(position)!]!.id } : {}),
        ...(draft.mapId ? { mapId: draft.mapId } : {}),
        ...(draft.eventId ? { eventId: draft.eventId } : {}),
        ...(draft.pageId ? { pageId: draft.pageId } : {}),
        ...(draft.commonEventId ? { commonEventId: draft.commonEventId } : {}),
        ...(draft.troopId ? { troopId: draft.troopId } : {}),
        endsChapter: draft.endsChapter,
        ...(twin ? { sameAs: twin } : {}),
      });
    }
  }
  for (const chapter of liveChapters) for (const position of chapter.main) finalOrder.push(drafts[position]!.id);
  for (const chapter of liveChapters) for (const position of chapter.side) finalOrder.push(drafts[position]!.id);

  // 8. 장(장소가 바뀌는 곳)
  const storyChapters: StoryChapter[] = liveChapters.map((chapter) => {
    const mainIds = chapter.main.map((position) => drafts[position]!.id);
    const runs: { place: string; ids: string[] }[] = [];
    for (const id of mainIds) {
      const scene = scenes.get(id)!;
      const place = scene.scope === "map" ? scene.place : runs[runs.length - 1]?.place ?? scene.place;
      const last = runs[runs.length - 1];
      if (last && last.place === place) last.ids.push(id);
      else runs.push({ place, ids: [id] });
    }
    const sections: { title: string; sceneIds: string[] }[] = [];
    for (const run of runs) {
      const last = sections[sections.length - 1];
      if (last && run.ids.length < 2) { last.sceneIds.push(...run.ids); continue; }
      sections.push({ title: run.place, sceneIds: [...run.ids] });
    }
    return {
      id: chapter.id,
      title: chapter.title,
      source: chapter.source,
      sections,
      mainIds,
      sideIds: chapter.side.map((position) => drafts[position]!.id),
    };
  });

  return { chapters: storyChapters, scenes, order: finalOrder, lineRefs };
}

/** 장면 요약 — 저장한 요약(사람·조수)이 있으면 그것, 없으면 자동 요약. */
export function sceneSummary(project: Project, scene: StoryScene): { readonly text: string; readonly auto: boolean } {
  const note = project.dialogueDesk?.sceneNotes?.find((entry) => entry.sceneId === scene.id);
  return note?.summary ? { text: note.summary, auto: false } : { text: scene.autoSummary, auto: true };
}

/** 「S12」·「S12.3」·「B4.2」 를 장면/줄로 푼다. */
export function resolveStoryRef(story: Story, ref: string): { readonly scene: StoryScene; readonly line?: DialogueLine } | undefined {
  const match = /^\s*([SB]\d+)(?:\.(\d+))?\s*$/iu.exec(ref);
  if (!match) return undefined;
  const sceneRef = match[1]!.toUpperCase();
  for (const scene of story.scenes.values()) {
    if (scene.ref !== sceneRef) continue;
    if (!match[2]) return { scene };
    const line = scene.lines[Number(match[2]) - 1];
    return line ? { scene, line } : undefined;
  }
  return undefined;
}

export function lineRefLabel(story: Story, lineId: string): string | undefined {
  const at = story.lineRefs.get(lineId);
  if (!at) return undefined;
  const scene = story.scenes.get(at.sceneId);
  return scene ? `${scene.ref}.${at.index}` : undefined;
}

export function sceneHeading(scene: StoryScene): string {
  return `${scene.ref}. ${scene.place} — ${scene.title}`;
}

export function sceneMeta(scene: StoryScene): string {
  return [scene.trigger, ...(scene.conditions.length ? [`조건: ${scene.conditions.join(", ")}`] : [])].filter(Boolean).join(" · ");
}
