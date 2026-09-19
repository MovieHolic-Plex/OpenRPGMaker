// editor/panels/eventEditor/commandDiff.ts
// 두 명령 목록(before/after)을 트리 그대로 비교해 "무엇이 새로 생기고, 무엇이 사라지고,
// 무엇이 바뀌는지"를 계산한다. AI 초안을 명령 목록 자리에 겹쳐 보여주고 행 단위로 골라
// 적용하기 위한 순수 로직(DOM·스토어 접근 금지).
//
// 왜 AI 에게 편집 연산을 직접 시키지 않는가 —
// Command 에는 안정 id 가 없고, 위치는 [명령index, 분기index(음수 센티널), …] 교대 배열이다
// (eventCommandPaths.ts 의 FORK_ELSE_BRANCH_INDEX = -3 등). 모델에게 이 인덱스 산수를 시키면
// 여러 연산이 서로의 인덱스를 밀어 어긋난다. 그래서 모델은 "고친 뒤의 최종 목록"만 내고,
// 인덱스 계산과 비교는 이 모듈이 한다.

import type { Command } from "@/project/types";

export type CommandDiffStatus = "keep" | "add" | "remove" | "change";

export type CommandDiffBranch = {
  /** 분기 슬롯 키(forkThen / choiceOption:0 …). 되돌려 쓸 때 어느 필드인지 식별한다. */
  readonly key: string;
  /** 목록에 그대로 쓰이는 한국어 분기 머리글("조건이 맞을 때" 등). */
  readonly label: string;
  readonly rows: readonly CommandDiffRow[];
};

export type CommandDiffRow = {
  /** 제외 토글용 안정 id. 부모 id + 분기 키 + 순번으로 만든다. */
  readonly id: string;
  readonly status: CommandDiffStatus;
  readonly depth: number;
  /** keep / remove / change 에 있다. */
  readonly before?: Command;
  /** keep / add / change 에 있다. */
  readonly after?: Command;
  readonly branches: readonly CommandDiffBranch[];
};

export type CommandDiffCounts = {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
};

// ── 분기 슬롯 읽기/쓰기 ──────────────────────────────────────────────────────
// 머리글 문구는 commandList.ts 의 renderBranchDropLine 과 같은 말을 쓴다 — 미리보기와
// 실제 목록이 다른 단어를 쓰면 "적용하면 이렇게 된다"는 예측이 깨진다.

type BranchSlot = { readonly key: string; readonly label: string; readonly commands: readonly Command[] };

function branchSlots(command: Command): readonly BranchSlot[] {
  switch (command.kind) {
    case "choices": {
      const slots: BranchSlot[] = command.options.map((option, index) => ({
        key: `choiceOption:${index}`,
        label: option.text || `선택지 ${index + 1}`,
        commands: option.branch,
      }));
      if (command.cancelBehavior === "branch") {
        slots.push({ key: "choiceCancel", label: "취소할 때", commands: command.cancelBranch ?? [] });
      }
      return slots;
    }
    case "fork": {
      const slots: BranchSlot[] = [{ key: "forkThen", label: "조건이 맞을 때", commands: command.then }];
      if (command.else) slots.push({ key: "forkElse", label: "조건이 맞지 않을 때", commands: command.else });
      return slots;
    }
    case "loop":
      return [{ key: "loopBody", label: "반복", commands: command.body }];
    case "shop": {
      const slots: BranchSlot[] = [];
      if (command.transactionBranch) {
        slots.push({ key: "shopTransaction", label: "구매·판매했을 때", commands: command.transactionBranch });
      }
      if (command.failedTransactionBranch) {
        slots.push({ key: "shopFailure", label: "거래하지 못했을 때", commands: command.failedTransactionBranch });
      }
      return slots;
    }
    case "inn":
      return command.notEnoughBranch
        ? [{ key: "innNotEnough", label: "골드가 부족할 때", commands: command.notEnoughBranch }]
        : [];
    case "promoteActor": {
      const slots: BranchSlot[] = [];
      if (command.successBranch) slots.push({ key: "promotionSuccess", label: "승급 성공", commands: command.successBranch });
      if (command.failureBranch) slots.push({ key: "promotionFailure", label: "승급 실패", commands: command.failureBranch });
      return slots;
    }
    case "evolveMonster": {
      const slots: BranchSlot[] = [];
      if (command.successBranch) slots.push({ key: "evolutionSuccess", label: "진화 성공", commands: command.successBranch });
      if (command.failureBranch) slots.push({ key: "evolutionFailure", label: "진화 실패", commands: command.failureBranch });
      return slots;
    }
    case "battleProcessing": {
      const slots: BranchSlot[] = [];
      if (command.victoryBranch) slots.push({ key: "battleVictory", label: "전투 승리", commands: command.victoryBranch });
      if (command.defeatBranch) slots.push({ key: "battleDefeat", label: "전투 패배", commands: command.defeatBranch });
      if (command.escapeBranch) slots.push({ key: "battleEscape", label: "전투 도망", commands: command.escapeBranch });
      return slots;
    }
    default:
      return [];
  }
}

/** 분기 슬롯을 적용된 자식 목록으로 갈아끼운 새 명령을 만든다. 없는 키는 원본 그대로 둔다. */
function withBranchSlots(command: Command, byKey: ReadonlyMap<string, Command[]>): Command {
  if (byKey.size === 0) return command;
  switch (command.kind) {
    case "choices":
      return {
        ...command,
        options: command.options.map((option, index) => {
          const replacement = byKey.get(`choiceOption:${index}`);
          return replacement ? { ...option, branch: replacement } : option;
        }),
        ...(byKey.has("choiceCancel") ? { cancelBranch: byKey.get("choiceCancel") } : {}),
      };
    case "fork":
      return {
        ...command,
        then: byKey.get("forkThen") ?? command.then,
        ...(byKey.has("forkElse") ? { else: byKey.get("forkElse") } : {}),
      };
    case "loop":
      return { ...command, body: byKey.get("loopBody") ?? command.body };
    case "shop":
      return {
        ...command,
        ...(byKey.has("shopTransaction") ? { transactionBranch: byKey.get("shopTransaction") } : {}),
        ...(byKey.has("shopFailure") ? { failedTransactionBranch: byKey.get("shopFailure") } : {}),
      };
    case "inn":
      return { ...command, ...(byKey.has("innNotEnough") ? { notEnoughBranch: byKey.get("innNotEnough") } : {}) };
    case "promoteActor":
    case "evolveMonster": {
      const successKey = command.kind === "promoteActor" ? "promotionSuccess" : "evolutionSuccess";
      const failureKey = command.kind === "promoteActor" ? "promotionFailure" : "evolutionFailure";
      return {
        ...command,
        ...(byKey.has(successKey) ? { successBranch: byKey.get(successKey) } : {}),
        ...(byKey.has(failureKey) ? { failureBranch: byKey.get(failureKey) } : {}),
      };
    }
    case "battleProcessing":
      return {
        ...command,
        ...(byKey.has("battleVictory") ? { victoryBranch: byKey.get("battleVictory") } : {}),
        ...(byKey.has("battleDefeat") ? { defeatBranch: byKey.get("battleDefeat") } : {}),
        ...(byKey.has("battleEscape") ? { escapeBranch: byKey.get("battleEscape") } : {}),
      };
    default:
      return command;
  }
}

// ── 자기 필드만 남긴 서명(분기 내용은 제외) ─────────────────────────────────
// 분기 내용까지 서명에 넣으면 "fork 조건은 그대로인데 안쪽 대사만 바뀐" 경우가 fork 통째
// 교체로 보인다. 자기 필드만 비교하고 자식은 재귀로 따로 비교한다.

// kind 별로 **그 kind 에서 분기인 필드만** 지운다. 필드 이름은 kind 사이에서 겹친다 —
// `loop.body` 는 Command[] 분기지만 `text.body` 는 대사 문구다. 이름만 보고 지우면 대사가
// 서명에서 빠져 «문구만 고친 줄» 이 «그대로» 로 보인다(2026-08-30 실측: 이 버그로 change 행이
// 아예 안 만들어졌다).
const BRANCH_FIELDS_BY_KIND: Readonly<Record<string, readonly string[]>> = {
  choices: ["cancelBranch"],
  fork: ["then", "else"],
  loop: ["body"],
  shop: ["transactionBranch", "failedTransactionBranch"],
  inn: ["notEnoughBranch"],
  promoteActor: ["successBranch", "failureBranch"],
  evolveMonster: ["successBranch", "failureBranch"],
  battleProcessing: ["victoryBranch", "defeatBranch", "escapeBranch"],
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function commandOwnFieldSignature(command: Command): string {
  const clone: Record<string, unknown> = { ...(command as unknown as Record<string, unknown>) };
  for (const field of BRANCH_FIELDS_BY_KIND[command.kind] ?? []) delete clone[field];
  // choices 는 options 안에 텍스트(자기 필드)와 branch(자식)가 섞여 있다.
  if (command.kind === "choices") {
    clone.options = command.options.map((option) => ({ text: option.text }));
  }
  return stableStringify(clone);
}

// ── LCS 정렬 ─────────────────────────────────────────────────────────────────

type AlignOp =
  | { readonly kind: "keep"; readonly beforeIndex: number; readonly afterIndex: number }
  | { readonly kind: "remove"; readonly beforeIndex: number }
  | { readonly kind: "add"; readonly afterIndex: number };

function alignBySignature(before: readonly string[], after: readonly string[]): AlignOp[] {
  const rows = before.length;
  const cols = after.length;
  // table[i][j] = before[i..] 와 after[j..] 의 최장 공통 부분수열 길이.
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops: AlignOp[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      ops.push({ kind: "keep", beforeIndex: i, afterIndex: j });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ kind: "remove", beforeIndex: i });
      i += 1;
    } else {
      ops.push({ kind: "add", afterIndex: j });
      j += 1;
    }
  }
  while (i < rows) { ops.push({ kind: "remove", beforeIndex: i }); i += 1; }
  while (j < cols) { ops.push({ kind: "add", afterIndex: j }); j += 1; }
  return ops;
}

// ── diff 본체 ────────────────────────────────────────────────────────────────

export function diffCommandLists(
  before: readonly Command[],
  after: readonly Command[],
): CommandDiffRow[] {
  return diffLists(before, after, "", 0);
}

function diffLists(
  before: readonly Command[],
  after: readonly Command[],
  idPrefix: string,
  depth: number,
): CommandDiffRow[] {
  const ops = alignBySignature(before.map(commandOwnFieldSignature), after.map(commandOwnFieldSignature));
  const rows: CommandDiffRow[] = [];
  const nextId = (): string => `${idPrefix}${rows.length}`;

  let cursor = 0;
  while (cursor < ops.length) {
    const op = ops[cursor];
    if (op.kind === "keep") {
      rows.push(keepRow(before[op.beforeIndex], after[op.afterIndex], nextId(), depth));
      cursor += 1;
      continue;
    }
    // 연속한 비-keep 구간을 모아 remove/add 를 짝지어 "바뀜"으로 승격한다.
    // (한 줄만 문구가 달라졌을 때 삭제 한 줄 + 추가 한 줄로 보이면 읽기 어렵다.)
    const removed: number[] = [];
    const added: number[] = [];
    while (cursor < ops.length && ops[cursor].kind !== "keep") {
      const segment = ops[cursor];
      if (segment.kind === "remove") removed.push(segment.beforeIndex);
      else if (segment.kind === "add") added.push(segment.afterIndex);
      cursor += 1;
    }
    const pairs = Math.min(removed.length, added.length);
    let paired = 0;
    while (paired < pairs && before[removed[paired]].kind === after[added[paired]].kind) {
      rows.push(changeRow(before[removed[paired]], after[added[paired]], nextId(), depth));
      paired += 1;
    }
    for (let index = paired; index < removed.length; index += 1) {
      rows.push(subtreeRow(before[removed[index]], "remove", nextId(), depth));
    }
    for (let index = paired; index < added.length; index += 1) {
      rows.push(subtreeRow(after[added[index]], "add", nextId(), depth));
    }
  }
  return rows;
}

function keepRow(before: Command, after: Command, id: string, depth: number): CommandDiffRow {
  return {
    id,
    status: "keep",
    depth,
    before,
    after,
    branches: pairedBranches(before, after, id, depth),
  };
}

function changeRow(before: Command, after: Command, id: string, depth: number): CommandDiffRow {
  return {
    id,
    status: "change",
    depth,
    before,
    after,
    branches: pairedBranches(before, after, id, depth),
  };
}

/** 추가/삭제된 명령은 하위 트리 전체가 같은 상태다. */
function subtreeRow(command: Command, status: "add" | "remove", id: string, depth: number): CommandDiffRow {
  const branches = branchSlots(command).map((slot) => ({
    key: slot.key,
    label: slot.label,
    rows: slot.commands.map((child, index) =>
      subtreeRow(child, status, `${id}/${slot.key}/${index}`, depth + 1)),
  }));
  return {
    id,
    status,
    depth,
    ...(status === "add" ? { after: command } : { before: command }),
    branches,
  };
}

function pairedBranches(
  before: Command,
  after: Command,
  id: string,
  depth: number,
): CommandDiffBranch[] {
  const beforeSlots = new Map(branchSlots(before).map((slot) => [slot.key, slot]));
  const afterSlots = new Map(branchSlots(after).map((slot) => [slot.key, slot]));
  const keys = [...new Set([...beforeSlots.keys(), ...afterSlots.keys()])];
  return keys.map((key) => {
    const beforeSlot = beforeSlots.get(key);
    const afterSlot = afterSlots.get(key);
    return {
      key,
      label: afterSlot?.label ?? beforeSlot?.label ?? key,
      rows: diffLists(beforeSlot?.commands ?? [], afterSlot?.commands ?? [], `${id}/${key}/`, depth + 1),
    };
  });
}

// ── 적용 ─────────────────────────────────────────────────────────────────────

/**
 * diff 행에서 최종 명령 목록을 만든다. `excluded` 에 든 id 는 그 행의 변경을 되돌린다
 * (추가는 넣지 않고, 삭제는 되살리고, 바뀜은 원래 것을 쓴다).
 */
export function applyCommandDiff(
  rows: readonly CommandDiffRow[],
  excluded: ReadonlySet<string> = new Set(),
): Command[] {
  const out: Command[] = [];
  for (const row of rows) {
    switch (row.status) {
      case "add":
        if (!excluded.has(row.id) && row.after) out.push(rebuildRow(row.after, row, excluded));
        break;
      case "remove":
        // 제외 = "이 삭제를 하지 마라" → 원래 명령을 하위 트리째 되살린다.
        if (excluded.has(row.id) && row.before) out.push(structuredClone(row.before));
        break;
      case "change":
        if (excluded.has(row.id)) {
          if (row.before) out.push(structuredClone(row.before));
        } else if (row.after) {
          out.push(rebuildRow(row.after, row, excluded));
        }
        break;
      default: {
        const base = row.after ?? row.before;
        if (base) out.push(rebuildRow(base, row, excluded));
        break;
      }
    }
  }
  return out;
}

function rebuildRow(base: Command, row: CommandDiffRow, excluded: ReadonlySet<string>): Command {
  const clone = structuredClone(base);
  if (row.branches.length === 0) return clone;
  const byKey = new Map<string, Command[]>();
  for (const branch of row.branches) byKey.set(branch.key, applyCommandDiff(branch.rows, excluded));
  return withBranchSlots(clone, byKey);
}

// ── 세기 ─────────────────────────────────────────────────────────────────────

export function countCommandDiff(
  rows: readonly CommandDiffRow[],
  excluded: ReadonlySet<string> = new Set(),
): CommandDiffCounts {
  let added = 0;
  let removed = 0;
  let changed = 0;
  const walk = (list: readonly CommandDiffRow[]): void => {
    for (const row of list) {
      const skip = excluded.has(row.id);
      if (row.status === "add" && !skip) added += 1;
      if (row.status === "remove" && !skip) removed += 1;
      if (row.status === "change" && !skip) changed += 1;
      // 되돌린 추가/삭제/바뀜의 하위는 세지 않는다 — 그 자리는 원본으로 복원된다.
      if (skip && row.status !== "keep") continue;
      for (const branch of row.branches) walk(branch.rows);
    }
  };
  walk(rows);
  return { added, removed, changed };
}

export function hasCommandDiffChanges(
  rows: readonly CommandDiffRow[],
  excluded: ReadonlySet<string> = new Set(),
): boolean {
  const counts = countCommandDiff(rows, excluded);
  return counts.added + counts.removed + counts.changed > 0;
}

/** 변경이 있는 행 id 목록(제외 토글을 붙일 대상). */
export function changedRowIds(rows: readonly CommandDiffRow[]): string[] {
  const ids: string[] = [];
  const walk = (list: readonly CommandDiffRow[]): void => {
    for (const row of list) {
      if (row.status !== "keep") ids.push(row.id);
      for (const branch of row.branches) walk(branch.rows);
    }
  };
  walk(rows);
  return ids;
}
