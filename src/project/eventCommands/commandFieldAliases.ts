// 명령 필드 표기 흔들림(op ↔ action)을 정본으로 되돌린다.
//
// 모델은 수치 명령(changeGold/changeItem/changeExp …)의 `op:"+="` 를 파티 편성에도 그대로 썼다
// (2026-09-23 도그푸딩: `{kind:"changeParty",actorId,op:"+="}`). 스키마는 `action:"add"|"remove"` 라
// 검증기는 배우만 보고 통과시켰고, 런타임은 action 이 "add" 가 아니면 **제외**로 처리해 동료가
// 합류하지 않았다. 반대 방향(수치 명령에 action:"add")도 같은 뿌리라 함께 정리한다.
//
// 뜻이 하나로 정해지는 표기만 옮긴다. 정해지지 않으면 그대로 두고 호출자(도구 검증)가 거부한다.

import type { Command } from "@/project/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";

type RecordValue = Record<string, unknown>;

const ADD_WORDS = new Set(["add", "join", "+", "+=", "합류", "추가", "gain", "increase"]);
const REMOVE_WORDS = new Set(["remove", "leave", "-", "-=", "이탈", "제외", "lose", "decrease"]);

const AMOUNT_OP_KINDS = new Set([
  "changeGold", "changeItem", "changeExp", "changeLevel", "changeActorHp", "changeActorMp", "changeLifeSkillExp",
]);

const CHOICE_OPTIONS_ALIASES = ["choices", "items", "answers"] as const;
const CHOICE_BRANCH_ALIASES = ["commands", "then", "actions"] as const;
const TRANSFER_DIRECTION_ALIASES = ["facing", "dir", "faceDirection"] as const;
const TRANSFER_DIRECTIONS = new Set(["retain", "up", "down", "left", "right"]);
const TEXT_BODY_ALIASES = ["text", "message", "content", "line", "dialogue"] as const;

function direction(value: unknown): "add" | "remove" | undefined {
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (ADD_WORDS.has(word)) return "add";
  if (REMOVE_WORDS.has(word)) return "remove";
  return undefined;
}

// 동료 합류를 몬스터 지급(giveMonster)처럼 `speciesId`+`level` 로 쓴 사례(2026-09-24 등대지기 3차:
// `{kind:"changeParty",speciesId:"actor_scout",level:1,action:"add"}`) — actorId 가 비어 런타임 파티에
// null 이 들어가고 보스전이 「Missing actor: undefined」로 멈췄다. changeParty 가 가리킬 수 있는 것은 배우뿐이라
// actorId 가 없을 때 별칭 하나의 문자열을 actorId 로 옮긴다. 그 값이 실제 배우인지는 DB 를 아는 호출자
// (도구의 assertPartyActorReferences, 런타임 changeParty)가 판정한다.
const PARTY_ACTOR_ALIASES = ["speciesId", "actor", "characterId", "memberId", "partyMemberId"] as const;
const PARTY_STRAY_FIELDS = ["level", "nickname"] as const;

function canonicalizePartyActorAlias(command: RecordValue): string | undefined {
  const fixes: string[] = [];
  if (typeof command.actorId !== "string" || !command.actorId.trim()) {
    const aliases = PARTY_ACTOR_ALIASES.filter(key => typeof command[key] === "string" && (command[key] as string).trim());
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.actorId = (command[alias] as string).trim();
      delete command[alias];
      fixes.push(`changeParty.${alias} 를 actorId:${JSON.stringify(command.actorId)} 로 옮겼습니다(파티 편성은 배우만 받는다).`);
    }
  }
  const stray = PARTY_STRAY_FIELDS.filter(key => key in command);
  if (stray.length > 0 && typeof command.actorId === "string") {
    for (const key of stray) delete command[key];
    fixes.push(`changeParty 에 쓰이지 않는 ${stray.join("·")} 를 지웠습니다.`);
  }
  return fixes.length > 0 ? fixes.join(" ") : undefined;
}

// 보스전 명령에 부대 ID 를 `commandId` 로 쓴 사례(2026-09-24 헤드리스 「등대지기의 겨울」:
// `{kind:"battleProcessing",commandId:"troop_blizzard_spirit"}`) — 「troopId가 문자열이 아닙니다」로 이벤트가
// 통째로 거부됐고, 모델은 보스를 대사만 있는 NPC 로 다시 놓아 보스전이 사라졌다. battleProcessing 이 가리킬
// 수 있는 것은 부대뿐이라 troopId 가 없을 때 별칭 하나의 문자열을 옮긴다. 부대 실재 판정은 호출자 몫이다.
const BATTLE_TROOP_ALIASES = ["commandId", "troop", "troopRef", "battleId", "encounterId", "enemyGroupId"] as const;

// 같은 호출은 canEscape·canLose 도 비어 있었다 — 별칭만 고치면 다음 거부가 그 둘이다. 편집기 새 명령과 같은
// 기본값(도망 가능·패배=게임 오버, eventCommandFactory)을 채우고 알린다.
const BATTLE_FLAG_DEFAULTS = { canEscape: true, canLose: false } as const;

// 보스전 결과 분기를 선택지 모양(`options:[{text:"승리",branch:[…]}]`)으로 쓴 사례(2026-09-24 헤드리스 r0735
// 「등대지기의 겨울」) — 런타임은 battleProcessing.options 를 읽지 않아 승리 분기의 setSwitch·setSelfSwitch 가
// 한 번도 실행되지 않았고 엔딩 페이지가 영영 열리지 않았다. 결과 분기의 정본은 branchOnResult:true +
// victoryBranch/defeatBranch/escapeBranch 다. 선택지 문구로 결과를 알아볼 수 있으면 옮긴다.
type BattleBranchKey = "victoryBranch" | "defeatBranch" | "escapeBranch";
const BATTLE_OPTION_WORDS: readonly (readonly [BattleBranchKey, RegExp])[] = [
  ["victoryBranch", /승리|이기|이겼|이김|격파|처치|win|victor|success/i],
  ["defeatBranch", /패배|졌|지면|짐$|전멸|lose|lost|loss|defeat|fail|game\s*over/i],
  ["escapeBranch", /도주|도망|탈출|후퇴|escape|flee|fled|run\s*away|retreat/i],
];
const BATTLE_BRANCH_LABEL: Record<BattleBranchKey, string> = { victoryBranch: "승리", defeatBranch: "패배", escapeBranch: "도주" };

function battleOptionBranchKey(text: unknown): BattleBranchKey | undefined {
  if (typeof text !== "string" || !text.trim()) return undefined;
  const hits = BATTLE_OPTION_WORDS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
  return hits.length === 1 ? hits[0] : undefined;
}

function optionCommands(option: RecordValue): unknown[] | undefined {
  for (const key of ["branch", ...CHOICE_BRANCH_ALIASES] as const) {
    if (Array.isArray(option[key])) return option[key] as unknown[];
  }
  return undefined;
}

function canonicalizeBattleResultOptions(command: RecordValue): string | undefined {
  if (!Array.isArray(command.options)) return undefined;
  const options = command.options.filter((option): option is RecordValue => option !== null && typeof option === "object" && !Array.isArray(option));
  if (options.length === 0) { delete command.options; return "battleProcessing.options 는 쓰이지 않아 지웠습니다(결과 분기는 branchOnResult:true + victoryBranch/defeatBranch/escapeBranch)."; }
  const plan: { key: BattleBranchKey; commands: unknown[]; text: string; guessed: boolean }[] = [];
  for (const option of options) {
    const key = battleOptionBranchKey(option.text) ?? (options.length === 1 ? "victoryBranch" : undefined);
    const commands = optionCommands(option);
    if (!key || !commands) {
      return "battleProcessing 에 options 가 있지만 런타임은 이를 읽지 않습니다 — 선택지 문구로 승리/패배/도주를 알아볼 수 없어 옮기지 않았습니다. "
        + "전투 결과 분기는 {kind:\"battleProcessing\",troopId,branchOnResult:true,victoryBranch:[…],defeatBranch:[…],escapeBranch:[…]} 로 쓰세요.";
    }
    if (plan.some(entry => entry.key === key) || (Array.isArray(command[key]) && (command[key] as unknown[]).length > 0)) {
      return `battleProcessing 에 options 가 있지만 런타임은 이를 읽지 않습니다 — ${BATTLE_BRANCH_LABEL[key]} 분기가 겹쳐 옮기지 않았습니다. `
        + "전투 결과 분기는 branchOnResult:true + victoryBranch/defeatBranch/escapeBranch 로 쓰세요.";
    }
    plan.push({ key, commands, text: typeof option.text === "string" ? option.text : "", guessed: battleOptionBranchKey(option.text) === undefined });
  }
  const notes: string[] = [];
  for (const entry of plan) {
    command[entry.key] = entry.commands;
    notes.push(`options「${entry.text}」→ ${entry.key}${entry.guessed ? "(문구로 결과를 알 수 없어 하나뿐인 분기를 승리로 봤습니다)" : ""}`);
  }
  delete command.options;
  command.branchOnResult = true;
  if (plan.some(entry => entry.key === "defeatBranch") && command.canLose !== true) { command.canLose = true; notes.push("패배 분기가 있어 canLose:true"); }
  if (plan.some(entry => entry.key === "escapeBranch") && command.canEscape !== true) { command.canEscape = true; notes.push("도주 분기가 있어 canEscape:true"); }
  return `battleProcessing 결과 분기를 선택지 모양(options)으로 받아 전투 결과 분기로 옮겼습니다: ${notes.join(", ")}, branchOnResult:true. `
    + "런타임은 battleProcessing.options 를 읽지 않습니다 — 다음부터 branchOnResult:true + victoryBranch/defeatBranch/escapeBranch 로 쓰세요.";
}

function canonicalizeBattleCommand(command: RecordValue): string | undefined {
  const fixes: string[] = [];
  const optionFix = canonicalizeBattleResultOptions(command);
  if (optionFix) fixes.push(optionFix);
  const hasTroop = typeof command.troopId === "string" && command.troopId.trim();
  if (!hasTroop && command.troopSource !== "variable") {
    const aliases = BATTLE_TROOP_ALIASES.filter(key => typeof command[key] === "string" && (command[key] as string).trim());
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.troopId = (command[alias] as string).trim();
      delete command[alias];
      fixes.push(`battleProcessing.${alias} 를 troopId:${JSON.stringify(command.troopId)} 로 옮겼습니다(전투 명령은 부대 ID 를 troopId 로 받는다).`);
    }
  }
  const filled = (Object.keys(BATTLE_FLAG_DEFAULTS) as (keyof typeof BATTLE_FLAG_DEFAULTS)[]).filter(key => command[key] === undefined);
  for (const key of filled) command[key] = BATTLE_FLAG_DEFAULTS[key];
  if (filled.length > 0) fixes.push(`battleProcessing 에 빠진 ${filled.map(key => `${key}:${BATTLE_FLAG_DEFAULTS[key]}`).join(", ")} 기본값을 채웠습니다.`);
  return fixes.length > 0 ? fixes.join(" ") : undefined;
}

// 조건 분기를 페이지 조건처럼 `conditions:[…]` 로 쓴 사례(2026-09-24 연애 도그푸딩:
// `{kind:"fork",conditions:[{kind:"variable",variableId:"var_day",op:">=",value:6}],then:[…]}`) —
// 「condition가 객체가 아닙니다」로 이벤트 전체가 거부됐다. 조건 하나면 그대로, 여럿이면 all 로 묶는다.
const FORK_THEN_ALIASES = ["thenBranch", "branch", "ifTrue", "commands"] as const;
const FORK_ELSE_ALIASES = ["elseBranch", "otherwise", "ifFalse"] as const;

function isRecordValue(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function moveSingleAlias(command: RecordValue, target: "then" | "else", aliases: readonly string[]): string | undefined {
  if (Array.isArray(command[target])) return undefined;
  const present = aliases.filter(key => Array.isArray(command[key]));
  if (present.length !== 1) return undefined;
  command[target] = command[present[0]!];
  delete command[present[0]!];
  return `fork.${present[0]} 를 ${target} 로 옮겼습니다.`;
}

function canonicalizeForkCommand(command: RecordValue): string | undefined {
  const fixes: string[] = [];
  if (!isRecordValue(command.condition) && Array.isArray(command.conditions)) {
    const conditions = command.conditions.filter(isRecordValue);
    if (conditions.length > 0 && conditions.length === command.conditions.length) {
      command.condition = conditions.length === 1 ? conditions[0] : { kind: "all", conditions };
      delete command.conditions;
      fixes.push(`fork.conditions(배열 ${conditions.length}개)를 condition${conditions.length > 1 ? `:{kind:"all"}` : ""} 로 옮겼습니다(조건 분기는 condition 객체 하나).`);
    }
  }
  const thenFix = moveSingleAlias(command, "then", FORK_THEN_ALIASES);
  if (thenFix) fixes.push(thenFix);
  const elseFix = moveSingleAlias(command, "else", FORK_ELSE_ALIASES);
  if (elseFix) fixes.push(elseFix);
  return fixes.length > 0 ? fixes.join(" ") : undefined;
}

function joinFixes(...fixes: (string | undefined)[]): string | undefined {
  const present = fixes.filter((fix): fix is string => Boolean(fix));
  return present.length > 0 ? present.join(" ") : undefined;
}

/** 명령 하나(중첩 분기 제외)를 제자리에서 고친다. 무엇을 고쳤는지 문장으로 돌려준다. */
export function canonicalizeCommandFieldAlias(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const command = raw as RecordValue;
  if (command.kind === "changeParty") {
    const actorFix = canonicalizePartyActorAlias(command);
    if (command.action === "add" || command.action === "remove") {
      if ("op" in command) { delete command.op; return joinFixes(actorFix, `changeParty.op 는 쓰이지 않아 지웠습니다(action:"${command.action}" 유지).`); }
      return actorFix;
    }
    const resolved = direction(command.action) ?? direction(command.op) ?? direction(command.mode) ?? direction(command.type);
    if (!resolved) return actorFix;
    const from = command.action !== undefined ? `action:${JSON.stringify(command.action)}` : command.op !== undefined ? `op:${JSON.stringify(command.op)}` : "별칭";
    delete command.op; delete command.mode; delete command.type;
    command.action = resolved;
    return joinFixes(actorFix, `changeParty ${from} 를 action:"${resolved}"(${resolved === "add" ? "합류" : "이탈"}) 로 고쳤습니다.`);
  }
  if (command.kind === "transfer" && command.direction === undefined) {
    // 도착 방향을 `facing`/`dir` 로 쓴 사례(2026-09-24 JRPG ember-4: 보스 처치 뒤 귀환 transfer 에 facing:"down")
    // — 런타임은 direction 만 읽어 방향이 조용히 버려졌다. 값이 방향 하나일 때만 옮긴다.
    const aliases = TRANSFER_DIRECTION_ALIASES.filter(key => typeof command[key] === "string" && TRANSFER_DIRECTIONS.has(command[key] as string));
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.direction = command[alias];
      delete command[alias];
      return `transfer.${alias} 를 direction 으로 옮겼습니다(장소 이동의 도착 방향 칸은 direction).`;
    }
    return undefined;
  }
  if (command.kind === "battleProcessing") return canonicalizeBattleCommand(command);
  if (command.kind === "fork") return canonicalizeForkCommand(command);
  if (command.kind === "setVariable" && command.value === undefined && typeof command.amount === "number") {
    // 변수 대입을 수치 명령(changeGold·changeItem)처럼 amount 로 쓴 사례(2026-09-24 갤러리 호러 r3:
    // `{kind:"setVariable",variableId,op:"=",amount:5}`) — 「value가 객체가 아닙니다」로 공용 이벤트가 통째로 거부됐다.
    command.value = command.amount;
    delete command.amount;
    return "setVariable.amount 를 value 로 옮겼습니다(변수 명령의 값 칸은 value).";
  }
  if (command.kind === "inputNumber" && typeof command.digits !== "number") {
    // 숫자 입력 자릿수를 amount·length 로 쓴 사례(2026-09-24 추격 호러 r5: `{kind:"inputNumber",variableId,amount:4}`)
    // — 「digits가 숫자가 아닙니다」로 금고 이벤트가 거부됐고, 모델은 정답을 적은 선택지로 물러났다.
    const alias = (["amount", "length", "maxDigits", "digitCount", "size"] as const).find(key => typeof command[key] === "number");
    if (alias) {
      command.digits = Math.max(1, Math.min(6, Math.trunc(command[alias] as number)));
      delete command[alias];
      return `inputNumber.${alias} 를 digits(자릿수) 로 옮겼습니다.`;
    }
    return undefined;
  }
  if (command.kind === "text" && typeof command.body !== "string") {
    // 대사 본문을 `text` 로 쓴 사례(2026-09-24 갤러리 호러: `{kind:"text",text:"엄마: …"}` 가 한 이벤트에 여섯 줄)
    // — 「대사는 string body가 필요합니다」로 upsert_event 4건이 통째로 반려됐다. 문장 명령의 본문 칸은 body 하나라
    // body 가 없고 별칭 하나에만 문자열이 있으면 옮긴다.
    const aliases = TEXT_BODY_ALIASES.filter(key => typeof command[key] === "string");
    if (aliases.length !== 1) return undefined;
    const alias = aliases[0]!;
    command.body = command[alias];
    delete command[alias];
    return `text.${alias} 를 body 로 옮겼습니다(문장 명령의 본문 칸은 body).`;
  }
  let optionsFix: string | undefined;
  if (command.kind === "choices" && !Array.isArray(command.options)) {
    // 보기 목록을 `choices` 로 쓴 사례(2026-09-24 JRPG 도그푸딩: 여관 주인 `{kind:"choices",choices:[{text,branch}]}`)
    // — place_npc 가 「command.options is not iterable」 TypeError 로 죽었다. 보기 목록 칸은 options 하나라 옮긴다.
    const aliases = CHOICE_OPTIONS_ALIASES.filter(key => Array.isArray(command[key]));
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.options = command[alias];
      delete command[alias];
      optionsFix = `choices.${alias} 를 options 로 옮겼습니다(선택지 보기 목록의 정본 키는 options).`;
    }
  }
  if (command.kind === "choices" && Array.isArray(command.options)) {
    // 네이티브 선택지 분기는 `branch` 다. SimplePage 선택지(`commands`)나 fork(`then`) 표기가 섞이면
    // 분기가 비거나 검증에서 거부됐다. branch 가 비어 있고 별칭 하나에만 명령이 있으면 옮긴다.
    const moved: string[] = [];
    for (const [index, rawOption] of command.options.entries()) {
      if (rawOption === null || typeof rawOption !== "object" || Array.isArray(rawOption)) continue;
      const option = rawOption as RecordValue;
      if (Array.isArray(option.branch) && option.branch.length > 0) continue;
      const aliases = CHOICE_BRANCH_ALIASES.filter(key => Array.isArray(option[key]) && (option[key] as unknown[]).length > 0);
      if (aliases.length !== 1) continue;
      const alias = aliases[0]!;
      option.branch = option[alias];
      delete option[alias];
      moved.push(`options[${index}].${alias}`);
    }
    return joinFixes(optionsFix, moved.length > 0 ? `choices ${moved.join(", ")} 를 branch 로 옮겼습니다(선택지 분기의 정본 키는 branch).` : undefined);
  }
  if (typeof command.kind === "string" && AMOUNT_OP_KINDS.has(command.kind) && typeof command.op !== "string") {
    const resolved = direction(command.action);
    if (!resolved) return undefined;
    delete command.action;
    command.op = resolved === "add" ? "+=" : "-=";
    return `${command.kind} action 을 op:"${command.op}" 로 고쳤습니다.`;
  }
  return undefined;
}

/** 명령 목록과 모든 중첩 분기를 제자리에서 고친다. */
export function canonicalizeCommandFieldAliases(commands: readonly unknown[] | undefined, onFix?: (message: string) => void): void {
  if (!Array.isArray(commands)) return;
  for (const command of commands) {
    const fixed = canonicalizeCommandFieldAlias(command);
    if (fixed) onFix?.(fixed);
    if (command && typeof command === "object" && typeof (command as RecordValue).kind === "string") {
      let branches: readonly (readonly Command[])[] = [];
      try { branches = nestedCommandLists(command as Command); } catch { branches = []; }
      for (const branch of branches) canonicalizeCommandFieldAliases(branch as readonly unknown[], onFix);
    }
  }
}
