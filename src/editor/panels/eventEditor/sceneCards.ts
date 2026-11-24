// 이벤트 편집기 「장면 카드」 모델. 저장 형식은 그대로 두고, 명령 목록을 사람이 읽는 장면 묶음으로 본다.
//
// 규칙(목업 v2, ~/claude-viz/event-editor-redesign-v2.html):
//  - 주석 명령(m2 「Comment」)은 카드 경계이자 카드 이름이다. 다음 주석까지가 한 카드다.
//  - 주석이 없으면 종류로 묶는다: 대사 줄(화자 있는 문장·표정·말풍선)은 대화, 연출(소리·화면·컷신·스위치)과
//    이벤트 움직임은 연출·등장, 상점·전투·갈림은 한 명령이 한 카드다.
//  - 얼굴 바꾸기·라벨·컷신 끝·기다리기·스위치·변수 같은 조용한 명령은 새 카드를 열지 않고 앞 카드에 붙는다.
//  - 「조건 → 전투 → 결과 갈림」 묶음(전투 명령 뒤 전투 결과 조건 분기)은 전투 카드 하나로 보고 이기면/지면 갈래를 단다.
// 카드는 보기일 뿐이다. 모든 카드는 자기가 덮는 명령의 경로를 들고 있어 고치기·지우기는 기존 경로 동작을 그대로 쓴다.
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import type { Command, Project } from "@/project/types";
import { josa } from "@/util/josa";
import { commandSummary, forkConditionSentence } from "./commandSummary";

export const SCENE_COMMENT_COMMAND_ID = "m2-088-comment";

export type SceneCardKind = "talk" | "narration" | "stage" | "move" | "shop" | "battle" | "branch" | "choice";

export const SCENE_CARD_KIND_LABEL: Readonly<Record<SceneCardKind, string>> = {
  talk: "대화",
  narration: "해설",
  stage: "연출",
  move: "등장",
  shop: "상점",
  battle: "전투",
  branch: "갈림",
  choice: "선택",
};

export interface SceneLine {
  readonly speaker: string;
  readonly body: string;
  readonly path: readonly number[];
}

export interface SceneShopItem {
  readonly name: string;
  readonly price: number | null;
}

export interface SceneBranch {
  readonly label: string;
  /** 이 갈래 명령 목록의 컨테이너 경로(명령 경로 규칙: [명령 위치, 분기 번호]). */
  readonly containerPath: readonly number[];
  readonly cards: readonly SceneCard[];
  readonly commandCount: number;
}

export interface SceneCard {
  readonly id: string;
  readonly kind: SceneCardKind;
  readonly title: string;
  readonly named: boolean;
  readonly paths: readonly (readonly number[])[];
  readonly commandCount: number;
  readonly lines: readonly SceneLine[];
  readonly bits: readonly string[];
  readonly shop?: { readonly title: string; readonly items: readonly SceneShopItem[]; readonly allowSell: boolean };
  readonly battle?: { readonly troop: string };
  readonly branches: readonly SceneBranch[];
  /** 쉬움·보통에서 내용을 보여 주지 못하는 명령(스크립트·범용 명령) 수. 「세부 명령 n개」. */
  readonly hiddenCount: number;
}

interface Draft {
  kind: SceneCardKind;
  title: string;
  named: boolean;
  paths: number[][];
  commandCount: number;
  lines: SceneLine[];
  bits: string[];
  shop?: SceneCard["shop"];
  battle?: SceneCard["battle"];
  branches: SceneBranch[];
  hiddenCount: number;
  moveTargets: string[];
}

export interface SceneCardContext {
  readonly project?: Project | null;
  readonly eventName?: (eventId: string) => string | undefined;
}

export function isSceneCommentCommand(command: Command): command is Extract<Command, { kind: "m2Command" }> {
  return command.kind === "m2Command" && command.commandId === SCENE_COMMENT_COMMAND_ID;
}

function commentText(command: Extract<Command, { kind: "m2Command" }>): string {
  const value = command.fields?.comment;
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

export function countSceneCommands(commands: readonly Command[]): number {
  return commands.reduce(
    (sum, command) => sum + 1 + eventCommandBranches(command).reduce((inner, branch) => inner + countSceneCommands(branch.commands), 0),
    0,
  );
}

const NARRATION_CONTEXTS = new Set(["narration", "system", "sign", "letter"]);

function isSpokenText(command: Command): boolean {
  return command.kind === "text" && !!command.speaker?.trim() && !NARRATION_CONTEXTS.has(command.context ?? "");
}

/** 새 카드를 열지 않고 앞 카드에 붙는 명령. 맨 앞이면 연출 카드를 연다. */
const QUIET_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>([
  "changeFace", "label", "gotoLabel", "wait", "setSwitch", "setSelfSwitch", "setVariable", "changeItem", "changeGold",
  "recoverAll", "changeActorHp", "changeActorMp", "displayTextSettings",
]);

const MOVE_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>(["moveEvent"]);

/** 쉬움·보통에서 내용을 그릴 수 없는 명령 — 「세부 명령」으로 센다. */
function isHiddenCommand(command: Command): boolean {
  return command.kind === "script";
}

function safeSummary(command: Command): string {
  try {
    return commandSummary(command).replace(/\s+/gu, " ").trim();
  } catch {
    return String(command.kind);
  }
}

function itemOf(project: Project | null | undefined, itemId: string): SceneShopItem {
  const record = project?.database?.items?.find((item) => item.id === itemId)
    ?? project?.database?.equipment?.find((item) => item.id === itemId);
  return { name: record?.name?.trim() || itemId, price: typeof record?.price === "number" ? record.price : null };
}

function troopName(project: Project | null | undefined, troopId: string): string {
  return project?.database?.troops?.find((troop) => troop.id === troopId)?.name?.trim() || troopId;
}

function textLine(command: Extract<Command, { kind: "text" }>, path: readonly number[]): SceneLine {
  return {
    speaker: isSpokenText(command) ? command.speaker?.trim() ?? "" : "",
    body: textBodyOf(command).replace(/\s*\n\s*/gu, " ").trim(),
    path,
  };
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** 「전투 명령 → (조건 분기 battleResult)」 꼴이면 그 둘을 찾는다. */
function battleShape(commands: readonly Command[]): { battleIndex: number; resultIndex: number | null } | null {
  const battleIndex = commands.findIndex((command) => command.kind === "battleProcessing");
  if (battleIndex < 0) return null;
  const resultIndex = commands.findIndex((command, index) =>
    index > battleIndex && command.kind === "fork" && command.condition.kind === "battleResult");
  return { battleIndex, resultIndex: resultIndex >= 0 ? resultIndex : null };
}

function newDraft(kind: SceneCardKind): Draft {
  return { kind, title: "", named: false, paths: [], commandCount: 0, lines: [], bits: [], branches: [], hiddenCount: 0, moveTargets: [] };
}

function addCommand(draft: Draft, command: Command, path: number[]): void {
  draft.paths.push(path);
  draft.commandCount += countSceneCommands([command]);
  if (isHiddenCommand(command)) draft.hiddenCount += 1;
  if (command.kind === "text") {
    draft.lines.push(textLine(command, path));
    return;
  }
  if (SILENT_BIT_KINDS.has(command.kind) || isSceneCommentCommand(command)) return;
  if (isHiddenCommand(command) || eventCommandBranches(command).length > 0) return;
  const bit = compactBit(command);
  if (bit) draft.bits.push(bit);
}

/** 카드에 보일 필요가 없는 진행 표시(얼굴·라벨·컷신 시작/끝·움직임 경로 — 움직임은 제목이 말한다). */
const SILENT_BIT_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>([
  "changeFace", "label", "cutsceneControl", "moveEvent", "displayTextSettings",
]);

/**
 * 명령 요약을 카드 한 조각으로 줄인다: 「화면 효과: 레터박스 (위아래 검은 띠), 값 12」 → 「레터박스」,
 * 「이모트 표시: 놀람 / 주인공」 → 「주인공 놀람」. 요약 문구의 정본은 commandSummary 다.
 */
export function compactBit(command: Command): string {
  const summary = safeSummary(command);
  const colon = summary.indexOf(": ");
  const head = colon > 0 ? summary.slice(0, colon) : "";
  let rest = colon > 0 ? summary.slice(colon + 2) : summary;
  if (command.kind === "showEmote") {
    const [emote, target] = rest.split(" / ");
    return target ? `${target} ${emote}` : emote ?? rest;
  }
  rest = rest.split(/[,(]/u)[0]!.trim();
  if (command.kind === "playAudio") rest = `소리 ${rest}`;
  if (!rest) rest = head;
  return clip(rest, 24);
}

function branchesOf(command: Command, path: readonly number[], context: SceneCardContext): SceneBranch[] {
  return eventCommandBranches(command).map((branch) => {
    const containerPath = [...path, branch.branchIndex];
    return {
      label: branch.kind === "forkThen" ? "그렇다" : branch.kind === "forkElse" ? "아니다" : branch.label,
      containerPath,
      cards: buildSceneCards(branch.commands, context, containerPath),
      commandCount: countSceneCommands(branch.commands),
    };
  });
}

function battleBranchLabel(label: string, kind: string): string {
  if (kind === "forkThen" || kind === "battleVictory") return "이기면";
  if (kind === "forkElse" || kind === "battleDefeat") return "지면";
  if (kind === "battleEscape") return "도망치면";
  return label;
}

function battleBranches(command: Command, path: readonly number[], context: SceneCardContext): SceneBranch[] {
  return eventCommandBranches(command).map((branch) => {
    const containerPath = [...path, branch.branchIndex];
    return {
      label: battleBranchLabel(branch.label, branch.kind),
      containerPath,
      cards: buildSceneCards(branch.commands, context, containerPath),
      commandCount: countSceneCommands(branch.commands),
    };
  });
}

function finishDraft(draft: Draft, context: SceneCardContext): SceneCard {
  return {
    id: JSON.stringify(draft.paths[0] ?? []),
    kind: draft.kind,
    title: draft.named && draft.title ? draft.title : autoTitle(draft, context),
    named: draft.named,
    paths: draft.paths,
    commandCount: draft.commandCount,
    lines: draft.lines,
    bits: draft.bits,
    ...(draft.shop ? { shop: draft.shop } : {}),
    ...(draft.battle ? { battle: draft.battle } : {}),
    branches: draft.branches,
    hiddenCount: draft.hiddenCount,
  };
}

function autoTitle(draft: Draft, context: SceneCardContext): string {
  if (draft.title) return draft.title;
  switch (draft.kind) {
    case "talk": {
      const speakers = [...new Set(draft.lines.map((line) => line.speaker).filter(Boolean))];
      if (speakers.length === 0) return "대사";
      if (speakers.length === 1) return `${speakers[0]}${josa(speakers[0]!, "이/가")} 말한다`;
      const shown = speakers.slice(0, 3).join(" · ");
      return speakers.length > 3 ? `${shown} 외 ${speakers.length - 3}명 대화` : `${shown} 대화`;
    }
    case "narration":
      return clip(draft.lines[0]?.body ?? "해설", 24);
    case "move": {
      const names = draft.moveTargets.map((id) => (id === "@player" || id === "player" ? "주인공" : context.eventName?.(id) ?? id));
      const counts = new Map<string, number>();
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
      const parts = [...counts].map(([name, count]) => (count > 1 ? `${name} ${count}` : name));
      return parts.length > 0 ? `${clip(parts.slice(0, 3).join(" · "), 28)} 움직임` : "움직임";
    }
    case "stage": {
      const quote = draft.lines.find((line) => !line.speaker)?.body;
      if (quote) return clip(quote, 24);
      return clip(draft.bits.slice(0, 2).join(" · ") || "연출", 28);
    }
    case "battle":
      return draft.battle?.troop ? clip(draft.battle.troop, 28) : "전투";
    case "shop":
      return draft.shop?.title ?? "상점";
    default:
      return SCENE_CARD_KIND_LABEL[draft.kind];
  }
}

/** 「…켜져 있으면」 → 「…켜져 있나?」. 조건 문장은 commandSummary.forkConditionSentence 가 정본이다. */
export function conditionQuestion(sentence: string): string {
  if (/때$/u.test(sentence)) return `${sentence}?`;
  return `${sentence.replace(/으?면$/u, "")}나?`;
}

/**
 * 명령 목록을 장면 카드로 묶는다. 순수 함수 — 같은 명령이면 같은 카드다(요약 문구가 읽는 스토어 이름 제외).
 * `containerPath` 는 이 목록이 놓인 컨테이너 경로(최상위는 []).
 */
export function buildSceneCards(
  commands: readonly Command[],
  context: SceneCardContext = {},
  containerPath: readonly number[] = [],
): SceneCard[] {
  const cards: SceneCard[] = [];
  let current: Draft | null = null;
  // 얼굴 바꾸기처럼 다음 줄에 붙어야 하는 명령은 다음 카드가 정해질 때까지 기다린다.
  let pending: { command: Command; path: number[] }[] = [];

  const flush = (): void => {
    if (current) cards.push(finishDraft(current, context));
    current = null;
  };
  const open = (kind: SceneCardKind): Draft => {
    flush();
    const draft = newDraft(kind);
    for (const held of pending) addCommand(draft, held.command, held.path);
    pending = [];
    current = draft;
    return draft;
  };
  const join = (kind: SceneCardKind): Draft => {
    if (current && !current.named && current.kind === kind && current.branches.length === 0 && !current.shop) {
      for (const held of pending) addCommand(current, held.command, held.path);
      pending = [];
      return current;
    }
    if (current?.named) {
      for (const held of pending) addCommand(current, held.command, held.path);
      pending = [];
      return current;
    }
    return open(kind);
  };

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]!;
    const path = [...containerPath, index];

    if (isSceneCommentCommand(command)) {
      const draft = open("stage");
      draft.named = true;
      draft.title = commentText(command);
      addCommand(draft, command, path);
      continue;
    }

    // 주석이 붙인 카드 안: 종류만 첫 의미 있는 명령으로 정하고 모두 담는다.
    if (current && (current as Draft).named) {
      const draft = current as Draft;
      if (draft.paths.length === 1 && !QUIET_KINDS.has(command.kind)) draft.kind = namedKindOf(command);
      addCommand(draft, command, path);
      if (command.kind === "shop") draft.shop = shopOf(command, context);
      if (command.kind === "battleProcessing") draft.battle = { troop: troopName(context.project, command.troopId) };
      const nested = eventCommandBranches(command);
      if (nested.length > 0) draft.branches.push(...branchesOf(command, path, context));
      continue;
    }

    if (command.kind === "changeFace") {
      pending.push({ command, path });
      continue;
    }

    if (isSpokenText(command)) {
      join("talk");
      addCommand(current!, command, path);
      continue;
    }
    if (command.kind === "text") {
      // 해설은 연출·등장 카드에 붙고, 그렇지 않으면 해설 카드를 연다.
      const host = current as Draft | null;
      if (host && (host.kind === "stage" || host.kind === "move" || host.kind === "narration") && host.branches.length === 0) {
        for (const held of pending) addCommand(host, held.command, held.path);
        pending = [];
        addCommand(host, command, path);
      } else {
        open("narration");
        addCommand(current!, command, path);
      }
      continue;
    }
    if (command.kind === "showEmote") {
      const host = current as Draft | null;
      if (host && (host.kind === "talk" || host.kind === "stage" || host.kind === "move")) addCommand(host, command, path);
      else { open("stage"); addCommand(current!, command, path); }
      continue;
    }
    if (QUIET_KINDS.has(command.kind)) {
      if (current) addCommand(current, command, path);
      else { open("stage"); addCommand(current!, command, path); }
      continue;
    }
    if (command.kind === "cutsceneControl" && command.mode === "end" && current) {
      addCommand(current, command, path);
      continue;
    }
    if (command.kind === "shop") {
      const draft = open("shop");
      addCommand(draft, command, path);
      draft.shop = shopOf(command, context);
      draft.branches.push(...branchesOf(command, path, context));
      flush();
      continue;
    }
    if (command.kind === "battleProcessing") {
      const draft = open("battle");
      addCommand(draft, command, path);
      draft.battle = { troop: troopName(context.project, command.troopId) };
      const result = commands[index + 1];
      if (result?.kind === "fork" && result.condition.kind === "battleResult") {
        const resultPath = [...containerPath, index + 1];
        addCommand(draft, result, resultPath);
        draft.branches.push(...battleBranches(result, resultPath, context));
        index += 1;
      } else {
        draft.branches.push(...battleBranches(command, path, context));
      }
      flush();
      continue;
    }
    if (command.kind === "fork") {
      const battle = forkBattle(command, path, context);
      if (battle) {
        const draft = open("battle");
        addCommand(draft, command, path);
        draft.battle = battle.battle;
        draft.branches.push(...battle.branches);
        flush();
        continue;
      }
    }
    if (eventCommandBranches(command).length > 0) {
      const draft = open(command.kind === "choices" ? "choice" : "branch");
      addCommand(draft, command, path);
      draft.title = branchTitle(command);
      draft.branches.push(...branchesOf(command, path, context));
      flush();
      continue;
    }
    if (MOVE_KINDS.has(command.kind)) {
      const draft = current && ((current as Draft).kind === "move") ? current as Draft : open("move");
      for (const held of pending) addCommand(draft, held.command, held.path);
      pending = [];
      addCommand(draft, command, path);
      const target = (command as { eventId?: string }).eventId;
      if (target) draft.moveTargets.push(target);
      continue;
    }
    // 그 밖의 명령은 연출. 등장(움직임) 카드 뒤의 연출은 그 카드 꼬리에 붙는다.
    const host = current as Draft | null;
    if (host && host.kind === "move") addCommand(host, command, path);
    else { join("stage"); addCommand(current!, command, path); }
  }
  if (pending.length > 0) {
    const draft: Draft = current ?? newDraft("stage");
    for (const held of pending) addCommand(draft, held.command, held.path);
    pending = [];
    current = draft;
  }
  flush();
  return cards;
}

function namedKindOf(command: Command): SceneCardKind {
  if (isSpokenText(command)) return "talk";
  if (command.kind === "text") return "narration";
  if (command.kind === "shop") return "shop";
  if (command.kind === "battleProcessing") return "battle";
  if (command.kind === "choices") return "choice";
  if (command.kind === "fork") return "branch";
  if (MOVE_KINDS.has(command.kind)) return "move";
  return "stage";
}

function shopOf(command: Extract<Command, { kind: "shop" }>, context: SceneCardContext): NonNullable<SceneCard["shop"]> {
  return {
    title: command.title?.trim() || "상점",
    items: command.itemIds.map((itemId) => itemOf(context.project, itemId)),
    allowSell: command.allowSell !== false,
  };
}

function branchTitle(command: Command): string {
  if (command.kind === "fork") {
    try {
      return conditionQuestion(forkConditionSentence(command.condition));
    } catch {
      return safeSummary(command);
    }
  }
  if (command.kind === "choices") return command.prompt?.trim() ? clip(command.prompt.trim(), 28) : "선택지";
  return clip(safeSummary(command), 28);
}

/**
 * 조건 분기의 한 갈래가 「…전투 → 전투 결과 갈림」이면 전투 카드로 본다.
 * 갈래는 전투 결과 갈림의 이기면/지면이다(전투 밖 명령은 카드 명령 수에만 든다).
 */
function forkBattle(
  command: Extract<Command, { kind: "fork" }>,
  path: readonly number[],
  context: SceneCardContext,
): { battle: { troop: string }; branches: SceneBranch[] } | null {
  const elseCommands = command.else ?? [];
  if (elseCommands.length > 0) return null;
  const shape = battleShape(command.then);
  if (!shape) return null;
  const battleCommand = command.then[shape.battleIndex] as Extract<Command, { kind: "battleProcessing" }>;
  const thenPath = [...path, eventCommandBranches(command)[0]?.branchIndex ?? 0];
  if (shape.resultIndex === null) {
    return {
      battle: { troop: troopName(context.project, battleCommand.troopId) },
      branches: battleBranches(battleCommand, [...thenPath, shape.battleIndex], context),
    };
  }
  const result = command.then[shape.resultIndex]!;
  return {
    battle: { troop: troopName(context.project, battleCommand.troopId) },
    branches: battleBranches(result, [...thenPath, shape.resultIndex], context),
  };
}
