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
import { M2_COMMAND_CATALOG, m2CommandById } from "@/project/eventCommands/m2Catalog";

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
  // 전투 설정을 같은 이름 칸 안에 한 번 더 감싼 사례(2026-10-06 몬스터 r2: `{kind:"battleProcessing",…,battleProcessing:{troopId,canLose}}`)
  // — 런타임은 무시하고 검사는 모르는 필드로만 남긴다. 바깥에 없는 값만 옮기고 지운다.
  if (isRecordValue(command.battleProcessing)) {
    const nested = command.battleProcessing;
    const moved = Object.keys(nested).filter(key => key !== "kind" && command[key] === undefined);
    for (const key of moved) command[key] = nested[key];
    delete command.battleProcessing;
    fixes.push(`battleProcessing 안의 battleProcessing 객체를 풀었습니다${moved.length ? `(${moved.join(", ")} 옮김)` : ""}.`);
  }
  // 결과 분기를 써 놓고 branchOnResult 를 빠뜨린 사례(같은 r2: 첫 관장의 승리 분기에 배지·엔딩) — 런타임은 branchOnResult 가
  // 참일 때만 분기를 돌려 배지도 엔딩도 나오지 않았다. 분기에 명령이 있으면 분기하려는 뜻이다.
  if (command.branchOnResult === undefined && (["victoryBranch", "defeatBranch", "escapeBranch"] as const).some(key => Array.isArray(command[key]) && (command[key] as unknown[]).length > 0)) {
    command.branchOnResult = true;
    fixes.push("battleProcessing 에 결과 분기가 있어 branchOnResult:true 를 채웠습니다.");
  }
  const filled = (Object.keys(BATTLE_FLAG_DEFAULTS) as (keyof typeof BATTLE_FLAG_DEFAULTS)[]).filter(key => command[key] === undefined);
  for (const key of filled) command[key] = BATTLE_FLAG_DEFAULTS[key];
  if (filled.length > 0) fixes.push(`battleProcessing 에 빠진 ${filled.map(key => `${key}:${BATTLE_FLAG_DEFAULTS[key]}`).join(", ")} 기본값을 채웠습니다.`);
  return fixes.length > 0 ? fixes.join(" ") : undefined;
}

// 조건 분기를 페이지 조건처럼 `conditions:[…]` 로 쓴 사례(2026-09-24 연애 도그푸딩:
// `{kind:"fork",conditions:[{kind:"variable",variableId:"var_day",op:">=",value:6}],then:[…]}`) —
// 「condition가 객체가 아닙니다」로 이벤트 전체가 거부됐다. 조건 하나면 그대로, 여럿이면 all 로 묶는다.
const FORK_THEN_ALIASES = ["thenBranch", "thenCommands", "branch", "ifTrue", "commands"] as const;
const FORK_ELSE_ALIASES = ["elseBranch", "elseCommands", "otherwiseBranch", "otherwise", "ifFalse"] as const;

function isRecordValue(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const M2_SCREEN_COLORS = new Set(["white", "red", "green", "blue", "yellow", "purple", "black"]);
const M2_TINT_COLORS = new Set(["neutral", "red", "green", "blue", "yellow", "purple", "black", "white", "sepia", "night", "sunset", "morning"]);

function mapCustomScreenColor(raw: string, allowTintPresets: boolean): { color: string; value?: string } {
  const trimmed = raw.trim().toLowerCase();
  if ((allowTintPresets ? M2_TINT_COLORS : M2_SCREEN_COLORS).has(trimmed)) return { color: trimmed };
  if (/gold|amber|orange|황금|금색/u.test(trimmed)) return { color: "yellow", value: raw.trim() };
  if (/cyan|ice|aqua|하늘|청록/u.test(trimmed)) return { color: "blue", value: raw.trim() };
  if (/violet|magenta|pink|보라|자주/u.test(trimmed)) return { color: "purple", value: raw.trim() };
  if (/crimson|scarlet|blood|진홍|핏빛/u.test(trimmed)) return { color: "red", value: raw.trim() };
  const hex = /^#?([0-9a-f]{6})$/iu.exec(trimmed);
  if (hex) {
    const h = hex[1]!;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    let mapped = allowTintPresets ? "neutral" : "white";
    if (r < 40 && g < 40 && b < 40) mapped = "black";
    else if (r > 200 && g > 170 && b < 120) mapped = "yellow";
    else if (r > 160 && b > 160 && g < 150) mapped = "purple";
    else if (r > g + 50 && r > b + 50) mapped = "red";
    else if (g > r + 40 && g >= b) mapped = "green";
    else if (b > r + 40 && b > g) mapped = "blue";
    return { color: mapped, value: `#${h}` };
  }
  return { color: allowTintPresets ? "neutral" : "white", value: raw.trim() };
}

function canonicalizeM2Command(command: RecordValue): string | undefined {
  const fixes: string[] = [];
  if (!isRecordValue(command.fields)) {
    command.fields = {};
  }
  const fields = command.fields as RecordValue;
  for (const key of ["color", "durationMs", "intensity", "value", "effect", "target", "eventId", "animationId", "wait", "mode", "x", "y", "zoom", "stateId", "enemyIndex"]) {
    if (command[key] !== undefined && fields[key] === undefined) {
      fields[key] = command[key];
      delete command[key];
    }
  }
  if (typeof command.commandId === "string") {
    const rawId = command.commandId.trim();
    const slug = rawId.replace(/^m2-\d+-/iu, "").toLowerCase();
    if (slug === "emote-bubble" || slug === "show-emote" || slug === "balloon-icon") {
      const targetRaw = typeof fields.target === "string" ? fields.target.trim() : typeof fields.eventId === "string" ? fields.eventId.trim() : "player";
      const emoteRaw = typeof fields.emote === "string" ? fields.emote : typeof fields.value === "string" ? fields.value : typeof fields.effect === "string" ? fields.effect : "exclamation";
      const durationMs = typeof fields.durationMs === "number" ? fields.durationMs : 800;
      for (const k of Object.keys(command)) delete command[k];
      command.kind = "showEmote";
      command.target = targetRaw === "player" ? "player" : { eventId: targetRaw === "this" || targetRaw === "self" || targetRaw === "this-event" ? "" : targetRaw };
      command.emote = emoteRaw;
      command.durationMs = durationMs;
      return `m2Command('${rawId}') 를 네이티브 showEmote 명령으로 변환했습니다.`;
    }
    if (!m2CommandById(rawId)) {
      if (slug === "fadeout-screen" || slug === "fade-out-screen" || slug === "fadeout") {
        command.commandId = "m2-202-screen-effect";
        fields.effect ??= "fadeOut";
        fields.durationMs ??= 600;
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-202-screen-effect'(fadeOut) 로 고쳤습니다.`);
      } else if (slug === "fadein-screen" || slug === "fade-in-screen" || slug === "fadein") {
        command.commandId = "m2-202-screen-effect";
        fields.effect ??= "fadeIn";
        fields.durationMs ??= 600;
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-202-screen-effect'(fadeIn) 로 고쳤습니다.`);
      } else if (slug === "character-look") {
        command.commandId = "m2-225-sprite-look";
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-225-sprite-look' 로 고쳤습니다.`);
      } else if (slug === "show-battle-animation") {
        command.commandId = "m2-103-show-animation";
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-103-show-animation' 로 고쳤습니다.`);
      } else if (slug === "change-enemy-condition") {
        command.commandId = "m2-100-change-enemy-state";
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-100-change-enemy-state' 로 고쳤습니다.`);
      } else if (slug === "tint-screen") {
        command.commandId = "m2-046-tint-screen";
        fixes.push(`m2Command.commandId '${rawId}' 를 'm2-046-tint-screen' 로 고쳤습니다.`);
      } else {
        const bySlug = M2_COMMAND_CATALOG.find((entry) => entry.id.replace(/^m2-\d+-/iu, "").toLowerCase() === slug)
          ?? M2_COMMAND_CATALOG.find((entry) => entry.title.toLowerCase().replace(/[^a-z0-9]+/gu, "-") === slug);
        if (bySlug) {
          command.commandId = bySlug.id;
          fixes.push(`m2Command.commandId '${rawId}' 를 카탈로그 정본 '${bySlug.id}' 로 고쳤습니다.`);
        }
      }
    }
  }
  if (command.commandId === "m2-100-change-enemy-state" && fields.value === undefined && typeof fields.stateId === "string") {
    fields.value = fields.stateId;
    delete fields.stateId;
    fixes.push("m2-100-change-enemy-state fields.stateId 를 fields.value 로 옮겼습니다.");
  }
  if (command.commandId === "m2-046-tint-screen" && (fields.color === 0 || fields.color === "0" || fields.color === "reset" || fields.color === "none" || fields.color === "normal")) {
    fields.color = "neutral";
    fixes.push("m2-046-tint-screen fields.color 를 'neutral' 로 정규화했습니다.");
  }
  if ((command.commandId === "m2-046-tint-screen" || command.commandId === "m2-047-flash-screen") && typeof fields.color === "string") {
    const allowTint = command.commandId === "m2-046-tint-screen";
    const mapped = mapCustomScreenColor(fields.color, allowTint);
    if (mapped.color !== fields.color || mapped.value !== undefined) {
      fields.color = mapped.color;
      if (mapped.value !== undefined && fields.value === undefined) fields.value = mapped.value;
      fixes.push(`${command.commandId} fields.color 를 카탈로그 색상 '${mapped.color}' 로 정규화했습니다.`);
    }
  }
  const catalog = typeof command.commandId === "string" ? m2CommandById(command.commandId) : undefined;
  if (catalog) {
    for (const spec of catalog.fields) {
      const v = fields[spec.key];
      if (v === undefined) continue;
      if ((spec.type === "text" || spec.type === "textarea" || spec.type === "select") && (typeof v === "number" || typeof v === "boolean")) {
        fields[spec.key] = String(v);
      }
    }
  }
  return fixes.length > 0 ? fixes.join(" ") : undefined;
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

/** wait 의 시간 별칭과 밀리초 환산 배율. 초·프레임(1/60초) 표기도 받는다. */
const WAIT_MS_ALIASES: readonly (readonly [string, number])[] = [
  ["durationMs", 1], ["duration", 1], ["milliseconds", 1], ["time", 1],
  ["seconds", 1000], ["sec", 1000], ["frames", 1000 / 60],
];

/** 명령 하나(중첩 분기 제외)를 제자리에서 고친다. 무엇을 고쳤는지 문장으로 돌려준다. */
export function canonicalizeCommandFieldAlias(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const command = raw as RecordValue;
  let unwrappedFieldsFix: string | undefined;
  if (command.kind !== "m2Command" && isRecordValue(command.fields)) {
    for (const [k, v] of Object.entries(command.fields)) {
      if (k !== "kind" && command[k] === undefined) command[k] = v;
    }
    delete command.fields;
    unwrappedFieldsFix = `${String(command.kind)}.fields 객체를 최상위 필드로 풀었습니다.`;
  }
  if (command.kind === "flash" || command.kind === "flashScreen") {
    const color = typeof command.color === "string" ? command.color : "white";
    const durationMs = typeof command.durationMs === "number" ? command.durationMs : typeof command.ms === "number" ? command.ms : 300;
    const wait = command.wait !== false;
    for (const k of Object.keys(command)) delete command[k];
    command.kind = "m2Command";
    command.commandId = "m2-047-flash-screen";
    command.fields = { color, durationMs, wait };
    return joinFixes(unwrappedFieldsFix, "flash 명령을 m2-047-flash-screen 으로 변환했습니다.", canonicalizeM2Command(command));
  }
  if (command.kind === "m2Command") return joinFixes(unwrappedFieldsFix, canonicalizeM2Command(command));
  if (command.kind === "changeParty") {
    const actorFix = canonicalizePartyActorAlias(command);
    if (command.action === "add" || command.action === "remove" || command.action === "lead") {
      if ("op" in command) { delete command.op; return joinFixes(unwrappedFieldsFix, actorFix, `changeParty.op 는 쓰이지 않아 지웠습니다(action:"${command.action}" 유지).`); }
      return joinFixes(unwrappedFieldsFix, actorFix);
    }
    const resolved = direction(command.action) ?? direction(command.op) ?? direction(command.mode) ?? direction(command.type);
    if (!resolved) return joinFixes(unwrappedFieldsFix, actorFix);
    const from = command.action !== undefined ? `action:${JSON.stringify(command.action)}` : command.op !== undefined ? `op:${JSON.stringify(command.op)}` : "별칭";
    delete command.op; delete command.mode; delete command.type;
    command.action = resolved;
    return joinFixes(unwrappedFieldsFix, actorFix, `changeParty ${from} 를 action:"${resolved}"(${resolved === "add" ? "합류" : "이탈"}) 로 고쳤습니다.`);
  }
  if (command.kind === "transfer" && command.direction === undefined) {
    // 도착 방향을 `facing`/`dir` 로 쓴 사례(2026-09-24 JRPG ember-4: 보스 처치 뒤 귀환 transfer 에 facing:"down")
    // — 런타임은 direction 만 읽어 방향이 조용히 버려졌다. 값이 방향 하나일 때만 옮긴다.
    const aliases = TRANSFER_DIRECTION_ALIASES.filter(key => typeof command[key] === "string" && TRANSFER_DIRECTIONS.has(command[key] as string));
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.direction = command[alias];
      delete command[alias];
      return joinFixes(unwrappedFieldsFix, `transfer.${alias} 를 direction 으로 옮겼습니다(장소 이동의 도착 방향 칸은 direction).`);
    }
    return unwrappedFieldsFix;
  }
  if (command.kind === "wait" && typeof command.ms !== "number") {
    // 기다리기를 카메라·페이드 비트처럼 durationMs 로 쓴 사례(2026-09-24 꿈 세계 r3). 런타임은 ms 만 읽어
    // setTimeout(NaN) 으로 즉시 넘어갔다 — 컷신의 뜸이 통째로 사라졌다.
    const alias = WAIT_MS_ALIASES.find(([key]) => typeof command[key] === "number" && Number.isFinite(command[key]));
    if (!alias) return unwrappedFieldsFix;
    const [key, toMs] = alias;
    command.ms = Math.max(0, Math.round((command[key] as number) * toMs));
    delete command[key];
    return joinFixes(unwrappedFieldsFix, `wait.${key} 를 ms(밀리초 ${command.ms}) 로 옮겼습니다(기다리기의 시간 칸은 ms).`);
  }
  if (command.kind === "battleProcessing") return joinFixes(unwrappedFieldsFix, canonicalizeBattleCommand(command));
  if (command.kind === "fork") return joinFixes(unwrappedFieldsFix, canonicalizeForkCommand(command));
  if (command.kind === "setVariable" && command.value === undefined && typeof command.amount === "number") {
    // 변수 대입을 수치 명령(changeGold·changeItem)처럼 amount 로 쓴 사례(2026-09-24 갤러리 호러 r3:
    // `{kind:"setVariable",variableId,op:"=",amount:5}`) — 「value가 객체가 아닙니다」로 공용 이벤트가 통째로 거부됐다.
    command.value = command.amount;
    delete command.amount;
    return joinFixes(unwrappedFieldsFix, "setVariable.amount 를 value 로 옮겼습니다(변수 명령의 값 칸은 value).");
  }
  if (command.kind === "inputNumber" && typeof command.digits !== "number") {
    // 숫자 입력 자릿수를 amount·length 로 쓴 사례(2026-09-24 추격 호러 r5: `{kind:"inputNumber",variableId,amount:4}`)
    // — 「digits가 숫자가 아닙니다」로 금고 이벤트가 거부됐고, 모델은 정답을 적은 선택지로 물러났다.
    const alias = (["amount", "length", "maxDigits", "digitCount", "size"] as const).find(key => typeof command[key] === "number");
    if (alias) {
      command.digits = Math.max(1, Math.min(6, Math.trunc(command[alias] as number)));
      delete command[alias];
      return joinFixes(unwrappedFieldsFix, `inputNumber.${alias} 를 digits(자릿수) 로 옮겼습니다.`);
    }
    return unwrappedFieldsFix;
  }
  if (command.kind === "text") {
    let bodyFix: string | undefined;
    if (typeof command.body !== "string") {
      const aliases = TEXT_BODY_ALIASES.filter(key => typeof command[key] === "string");
      if (aliases.length === 1) {
        const alias = aliases[0]!;
        command.body = command[alias];
        delete command[alias];
        bodyFix = `text.${alias} 를 body 로 옮겼습니다(문장 명령의 본문 칸은 body).`;
      }
    }
    if (typeof command.body === "string" && /\\n(?!\[)/u.test(command.body)) {
      command.body = command.body.replace(/\\n(?!\[)/gu, "\n");
      bodyFix = joinFixes(bodyFix, "text.body 의 리터럴 \\n 을 줄바꿈으로 고쳤습니다.");
    }
    return joinFixes(unwrappedFieldsFix, bodyFix);
  }
  if (command.kind === "changeFace") {
    const fixes: string[] = [];
    if (typeof command.resourceId !== "string") {
      const alias = (["value", "faceId", "id", "face"] as const).find((k) => typeof command[k] === "string");
      if (alias) {
        command.resourceId = command[alias];
        delete command[alias];
        fixes.push(`changeFace.${alias} 를 resourceId 로 옮겼습니다.`);
      } else {
        command.resourceId = "";
      }
    }
    if (command.position !== "left" && command.position !== "right") {
      command.position = "left";
      fixes.push('changeFace.position 기본값 "left" 를 채웠습니다.');
    }
    if (typeof command.flipHorizontally !== "boolean") {
      command.flipHorizontally = false;
      fixes.push("changeFace.flipHorizontally 기본값 false 를 채웠습니다.");
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "cutsceneControl") {
    const action = typeof command.action === "string" ? command.action.trim() : "";
    if (action === "fadeOut" || action === "fadeIn") {
      const ms = typeof command.durationMs === "number" ? command.durationMs : 600;
      const wait = command.wait !== false;
      for (const k of Object.keys(command)) delete command[k];
      command.kind = "m2Command";
      command.commandId = "m2-202-screen-effect";
      command.fields = { effect: action, durationMs: ms, wait };
      return joinFixes(unwrappedFieldsFix, `cutsceneControl(${action}) 를 m2-202-screen-effect 로 옮겼습니다.`);
    }
    if (command.mode !== "begin" && command.mode !== "end") {
      if (command.value === true || /^(lock|begin|start|on|enter)$/iu.test(action)) {
        command.mode = "begin";
      } else if (command.value === false || /^(unlock|end|stop|off|exit)$/iu.test(action)) {
        command.mode = "end";
      } else {
        command.mode = "begin";
      }
      delete command.value;
      delete command.action;
      return joinFixes(unwrappedFieldsFix, `cutsceneControl.mode 를 "${String(command.mode)}" 로 정규화했습니다.`);
    }
    return unwrappedFieldsFix;
  }
  if (command.kind === "showAnimation") {
    const fixes: string[] = [];
    if (typeof command.animationId !== "string") {
      const alias = (["id", "value", "resourceId", "animation"] as const).find((k) => typeof command[k] === "string");
      if (alias) {
        command.animationId = command[alias];
        delete command[alias];
        fixes.push(`showAnimation.${alias} 를 animationId 로 옮겼습니다.`);
      }
    }
    if (command.target === undefined) {
      if (typeof command.eventId === "string" && command.eventId.trim()) {
        const evId = command.eventId.trim();
        command.target = evId === "player" ? "player" : { eventId: evId === "this" || evId === "self" ? "this-event" : evId };
        delete command.eventId;
        fixes.push("showAnimation.eventId 를 target 으로 옮겼습니다.");
      } else if (typeof command.x === "number" && typeof command.y === "number") {
        command.target = { x: command.x, y: command.y };
        delete command.x;
        delete command.y;
        fixes.push("showAnimation.x/y 를 target 으로 옮겼습니다.");
      } else {
        command.target = "player";
        fixes.push('showAnimation.target 기본값 "player" 를 채웠습니다.');
      }
    } else if (typeof command.target === "string" && command.target !== "player") {
      const t = command.target.trim();
      command.target = { eventId: t === "this" || t === "self" ? "this-event" : t };
      fixes.push("showAnimation 문자열 target 을 {eventId} 객체로 옮겼습니다.");
    }
    if (typeof command.wait !== "boolean") {
      command.wait = true;
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "showEmote") {
    const fixes: string[] = [];
    if (typeof command.emote !== "string") {
      const alias = (["value", "id", "emotion", "icon"] as const).find((k) => typeof command[k] === "string");
      if (alias) {
        command.emote = command[alias];
        delete command[alias];
        fixes.push(`showEmote.${alias} 를 emote 로 옮겼습니다.`);
      }
    }
    if (command.target === undefined) {
      if (typeof command.eventId === "string" && command.eventId.trim()) {
        const evId = command.eventId.trim();
        command.target = evId === "player" ? "player" : { eventId: evId === "this" || evId === "self" || evId === "this-event" ? "" : evId };
        delete command.eventId;
        fixes.push("showEmote.eventId 를 target 으로 옮겼습니다.");
      } else {
        command.target = "player";
        fixes.push('showEmote.target 기본값 "player" 를 채웠습니다.');
      }
    } else if (typeof command.target === "string" && command.target !== "player") {
      const t = command.target.trim();
      command.target = { eventId: t === "this" || t === "self" || t === "this-event" ? "" : t };
      fixes.push("showEmote 문자열 target 을 {eventId} 객체로 옮겼습니다.");
    }
    if (typeof command.durationMs !== "number") {
      command.durationMs = 800;
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "playAudio") {
    const fixes: string[] = [];
    if (typeof command.resourceId !== "string") {
      const alias = (["id", "text", "value", "sound", "se", "bgm", "audioId", "soundId", "bgmId", "seId"] as const).find((k) => typeof command[k] === "string");
      if (alias) {
        command.resourceId = command[alias];
        delete command[alias];
        fixes.push(`playAudio.${alias} 를 resourceId 로 옮겼습니다.`);
      }
    }
    if (command.channel !== "bgm" && command.channel !== "se") {
      command.channel = typeof command.resourceId === "string" && /bgm/iu.test(command.resourceId) ? "bgm" : "se";
      fixes.push(`playAudio.channel 기본값 "${String(command.channel)}" 를 채웠습니다.`);
    }
    if (typeof command.loop !== "boolean") {
      command.loop = command.channel === "bgm";
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "setEventGraphicPattern") {
    const fixes: string[] = [];
    if (typeof command.eventId !== "string" && typeof command.target === "string") {
      const t = command.target.trim();
      command.eventId = t === "this" || t === "self" || t === "this-event" ? "" : t;
      delete command.target;
      fixes.push("setEventGraphicPattern.target 을 eventId 로 옮겼습니다.");
    } else if (typeof command.eventId !== "string") {
      command.eventId = "";
      fixes.push('setEventGraphicPattern.eventId 기본값 "" 를 채웠습니다.');
    }
    if (typeof command.pattern !== "number") {
      const alias = (["index", "frame", "value"] as const).find((k) => typeof command[k] === "number");
      command.pattern = alias ? (command[alias] as number) : 0;
      if (alias) delete command[alias];
      fixes.push(`setEventGraphicPattern.pattern 값을 ${String(command.pattern)} 로 채웠습니다.`);
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "setWeather") {
    const fixes: string[] = [];
    if (typeof command.weather !== "string") {
      const alias = (["action", "effect", "type", "value", "kindName"] as const).find((k) => typeof command[k] === "string");
      if (alias) {
        command.weather = command[alias];
        delete command[alias];
        fixes.push(`setWeather.${alias} 를 weather 로 옮겼습니다.`);
      } else {
        command.weather = "none";
      }
    }
    if (command.weather === "clear" || command.weather === "off" || command.weather === "stop") {
      command.weather = "none";
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "setLighting") {
    const fixes: string[] = [];
    if (isRecordValue(command.lighting)) {
      for (const [k, v] of Object.entries(command.lighting)) {
        if (command[k] === undefined) command[k] = v;
      }
      delete command.lighting;
      fixes.push("setLighting.lighting 객체를 최상위로 풀었습니다.");
    }
    if (typeof command.ambient !== "number") {
      command.ambient = command.color === "neutral" || command.color === "#ffffff" ? 1 : 0.7;
      fixes.push(`setLighting.ambient 기본값 ${String(command.ambient)} 를 채웠습니다.`);
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  if (command.kind === "addLight") {
    if (!isRecordValue(command.source)) {
      const rawAt = command.at === "player" ? "player" : isRecordValue(command.at) ? command.at : undefined;
      const x = typeof command.x === "number" ? command.x : isRecordValue(rawAt) && typeof rawAt.x === "number" ? rawAt.x : 0;
      const y = typeof command.y === "number" ? command.y : isRecordValue(rawAt) && typeof rawAt.y === "number" ? rawAt.y : 0;
      command.source = {
        id: typeof command.id === "string" && command.id.trim() ? command.id.trim() : "light_1",
        at: rawAt ?? (typeof command.eventId === "string" && command.eventId.trim() ? { eventId: command.eventId.trim() } : { x, y }),
        radius: typeof command.radius === "number" ? command.radius : 4,
        color: typeof command.color === "string" && command.color.trim() ? command.color.trim() : "#ffaa44",
        intensity: typeof command.intensity === "number" ? command.intensity : 0.8,
        ...(typeof command.flicker === "boolean" ? { flicker: command.flicker } : {}),
      };
      delete command.id; delete command.x; delete command.y; delete command.at; delete command.eventId;
      delete command.radius; delete command.color; delete command.intensity; delete command.flicker;
      return joinFixes(unwrappedFieldsFix, "addLight 최상위 광원 필드를 source 객체로 묶었습니다.");
    }
    const source = command.source;
    if (source.at === undefined) {
      if (typeof source.eventId === "string" && source.eventId.trim()) {
        source.at = { eventId: source.eventId.trim() };
        delete source.eventId;
      } else {
        source.at = {
          x: typeof source.x === "number" ? source.x : 0,
          y: typeof source.y === "number" ? source.y : 0,
        };
        delete source.x;
        delete source.y;
      }
      return joinFixes(unwrappedFieldsFix, "addLight.source 좌표 필드를 source.at 으로 옮겼습니다.");
    }
    return unwrappedFieldsFix;
  }
  if (command.kind === "moveEvent") {
    const fixes: string[] = [];
    if (typeof command.eventId !== "string" && typeof command.target === "string") {
      const t = command.target.trim();
      command.eventId = t === "player" ? "__player__" : t === "this-event" || t === "self" || t === "this" ? "" : t;
      delete command.target;
      fixes.push("moveEvent.target 을 eventId 로 옮겼습니다.");
    }
    if (!isRecordValue(command.route) && Array.isArray(command.moves)) {
      command.route = { moves: command.moves, repeat: false, wait: command.wait !== false };
      delete command.moves;
      fixes.push("moveEvent.moves 를 route.moves 로 옮겼습니다.");
    }
    if (isRecordValue(command.route)) {
      const route = command.route;
      if (!Array.isArray(route.moves) && Array.isArray(route.steps)) {
        route.moves = route.steps;
        delete route.steps;
        fixes.push("moveEvent.route.steps 를 route.moves 로 옮겼습니다.");
      }
      if (typeof route.repeat !== "boolean") route.repeat = false;
      if (typeof route.wait !== "boolean") route.wait = true;
      if (Array.isArray(route.moves)) {
        for (const rawMove of route.moves) {
          if (!isRecordValue(rawMove)) continue;
          if (rawMove.kind === "stepForward") rawMove.kind = "moveForward";
          else if (rawMove.kind === "stepBackward") rawMove.kind = "moveBackward";
          if ((rawMove.kind === "move" || rawMove.kind === "turn") && typeof rawMove.dir !== "string" && typeof rawMove.direction === "string") {
            rawMove.dir = rawMove.direction;
            delete rawMove.direction;
          }
        }
      }
    }
    return joinFixes(unwrappedFieldsFix, ...fixes);
  }
  let optionsFix: string | undefined;
  let promptFix: string | undefined;
  if (command.kind === "choices" && command.prompt === undefined && typeof command.text === "string" && command.text.trim()) {
    // 선택지 질문을 text 로 쓴 사례(2026-09-24 회상 스토리: 기억의 문 `{kind:"choices",text:"다이브하시겠습니까?",options}`).
    // 질문 칸은 prompt 라 런타임은 text 를 버리고, 검사는 모르는 필드로만 남긴다.
    command.prompt = command.text.trim();
    delete command.text;
    promptFix = "choices.text 를 prompt 로 옮겼습니다(선택지 질문의 정본 키는 prompt).";
  }
  if (command.kind === "choices" && command.prompt === undefined && typeof command.body === "string" && command.body.trim()) {
    // 선택지 질문을 text 명령의 본문 칸인 body 로 쓴 사례(2026-09-24 갤러리 호러 r3: 레버·초상화 3점·엔딩 등
    // 선택지 6건이 `{kind:"choices",body:"당겨보겠습니까?",options}` — upsert_event 는 받았지만 런타임이 body 를
    // 버려 플레이어는 물음 없는 선택지만 보았다). 질문 칸은 prompt 라 옮긴다.
    command.prompt = command.body.trim();
    delete command.body;
    promptFix = "choices.body 를 prompt 로 옮겼습니다(선택지 질문의 정본 키는 prompt).";
  }
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
    return joinFixes(unwrappedFieldsFix, promptFix, optionsFix, moved.length > 0 ? `choices ${moved.join(", ")} 를 branch 로 옮겼습니다(선택지 분기의 정본 키는 branch).` : undefined);
  }
  if (promptFix) return joinFixes(unwrappedFieldsFix, promptFix);
  if (typeof command.kind === "string" && AMOUNT_OP_KINDS.has(command.kind) && typeof command.op !== "string") {
    const resolved = direction(command.action);
    if (!resolved) return unwrappedFieldsFix;
    delete command.action;
    command.op = resolved === "add" ? "+=" : "-=";
    return joinFixes(unwrappedFieldsFix, `${command.kind} action 을 op:"${command.op}" 로 고쳤습니다.`);
  }
  return unwrappedFieldsFix;
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
