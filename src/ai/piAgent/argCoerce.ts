// 작은 모델용 인자 맞추기 — 스키마 검증에 실패한 호출만, 스키마가 정답을 하나로 정해 주는 모양 실수를 고친다.
//
// 2026-11-01 값싼 모델 대조(자물쇠 요청, 같은 체크포인트): gemini-3.8-flash 도구 호출 23번 중 14번이 인자 검증 실패였고,
// 실패한 칸은 전부 «뜻은 맞는데 모양이 다른» 것이었다(argRepair 의 감싸기·옮기기로는 못 고친다).
//   todo items[]{text, check:"talk"}              → {content, check:{kind:"talk"}}        (다른 이름 · 열거값 하나를 객체로)
//   run_scene_test steps[]{action:"interact"}     → {kind:"interact"}                      (다른 이름)
//   define_ending epilogue:"…"                     → [{…}]                                  (글 하나를 객체 목록으로)
//   upsert_event pages[]{trigger:0, priority:1, graphic.direction:2, list:[{code:401,…}]}
//                                                  → RPG Maker MV 숫자·명령 코드(모델의 사전 지식) — 숫자는 이름으로, list 는 commands 로
// Opus·Haiku 는 같은 판에서 이런 실수가 0이었다 — 따를 수 없는 스키마가 아니라 작은 모델이 익숙한 모양으로 쓰는 것이다.
//
// 원칙(argRepair 와 같다): 값을 지어내지 않는다. 스키마가 받는 모양이 하나로 정해질 때만 바꾸고, 바꾼 것은 영어 한 줄씩
// 모델에게 돌려준다(«Fixed call: …» — 다음 호출부터 맞는 모양을 쓰게). 그래도 검증에 실패하면 원래 오류가 간다.
// 순수 모듈 — 실행기(scripts/lib/piAgentRuntime.ts withArgRepair)가 argRepair 다음에 끼운다.

type Schema = {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly required?: readonly string[];
  readonly items?: Schema;
  readonly anyOf?: readonly Schema[];
  readonly oneOf?: readonly Schema[];
  readonly enum?: readonly unknown[];
  readonly additionalProperties?: unknown;
};
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const typeIs = (s: Schema | undefined, t: string): boolean => !!s && (s.type === t || (Array.isArray(s.type) && s.type.includes(t)));
const variants = (s: Schema | undefined): Schema[] => (s ? [s, ...(s.anyOf ?? []), ...(s.oneOf ?? [])] : []);
const objectOf = (s: Schema | undefined): Schema | undefined => variants(s).find((v) => typeIs(v, "object") || !!v.properties);
const arrayOf = (s: Schema | undefined): Schema | undefined => variants(s).find((v) => typeIs(v, "array"));
const accepts = (s: Schema | undefined, t: string): boolean => variants(s).some((v) => typeIs(v, t));
/** 모양을 정하지 않은 칸(설명뿐인 value 등)은 손대지 않는다. */
const untyped = (s: Schema | undefined): boolean => !s || (!s.type && !s.properties && !s.items && !s.enum && !s.anyOf && !s.oneOf);

/** 빠진 필수 칸 ← 모델이 대신 쓴 이름(스키마에 없는 열쇠일 때만 옮긴다). */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  content: ["text", "title", "task", "label", "name", "description"],
  kind: ["type", "action", "step", "op"],
  body: ["text", "message", "content", "line"],
  description: ["meaning", "desc", "summary", "note"],
  commands: ["cmds", "actions"],
};

/** RPG Maker MV/MZ 숫자 → 우리 열거값. 그 칸의 enum 에 이름이 있을 때만 쓴다. */
const MV_ENUMS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  direction: { 2: "down", 4: "left", 6: "right", 8: "up" },
  priority: { 0: "below", 1: "same", 2: "above" },
};
/** MV trigger 0 결정 키 · 1 플레이어 접촉 · 2 이벤트 접촉 · 3 자동 실행 · 4 병렬. */
const MV_TRIGGER: Readonly<Record<number, string>> = { 0: "action", 1: "playerTouch", 2: "eventTouch", 3: "auto", 4: "parallel" };

export interface ArgCoercion {
  readonly args: unknown;
  /** 고칠 수 없고 그대로 두면 조용히 버려지는 것(영어) — 실행하지 말고 이 글을 돌려준다. */
  readonly problems: readonly string[];
  /** 영어 한 줄씩 — 모델에게 «Fixed call:» 로 돌려준다. */
  readonly changes: readonly string[];
}

// 도구 하나에만 맞는 빈칸 채우기 — 그 칸이 «이름표»라 어떤 값이든 뜻이 같을 때만(값을 지어내도 동작이 안 바뀐다).
// declare_story_flag: id 는 kebab 이름표일 뿐이다. 2026-11-01 flash·argon 이 id 없이 {action, description} 만 보내 4번씩 거절됐다.
const TODO_KEY_CHECKS: Readonly<Record<string, string>> = { talk: "who", person: "name", place: "name", item: "name" };
const TOOL_FILLS: Readonly<Record<string, (args: Obj, changes: string[]) => Obj>> = {
  // upsert_event({eventId}) — 이벤트 id 칸 이름은 id 다(2026-11-01 cheap r7 argon: 세 번 다 «id 없음» 으로 거절).
  upsert_event(args, changes) {
    if ((args.id === undefined || args.id === "") && typeof args.eventId === "string" && args.eventId.trim() && !isObj(args.event)) {
      changes.push(`id: missing → "${args.eventId}" (from eventId — the event id field is named "id")`);
      return { ...args, id: args.eventId };
    }
    return args;
  },
  // todo 항목의 짧은 확인 표기 {talk:"책상"} → check:{kind:"talk", who:"책상"} (r7 argon: 확인 없는 항목이 되어 거짓 done 이 통과했다).
  todo(args, changes) {
    // done/block 에 항목을 «item» 칸으로 준 호출 → task(r10 flash: «Item «» not found»).
    if (typeof args.op === "string" && ["start", "done", "drop", "block"].includes(args.op) && args.task === undefined) {
      for (const k of ["id", "taskId", "item", "todo", "name", "content", "text"]) {
        if (typeof args[k] === "string" && (args[k] as string).trim()) { const { [k]: v, ...rest } = args; changes.push(`${k} → task (the item id or exact content goes in "task")`); return { ...rest, task: v }; }
      }
    }
    if (!Array.isArray(args.items)) return args;
    let touched = false;
    const items = args.items.map((it0, i) => {
      let it: unknown = it0;
      // machineCheck → check(r11 flash: 확인이 안 붙어 요청 뼈대가 같은 항목을 한 벌 더 붙였다).
      if (isObj(it) && it.check === undefined && isObj(it.machineCheck)) { const { machineCheck: mc, ...rest } = it; it = { ...rest, check: mc }; touched = true; changes.push(`items[${i}].machineCheck → items[${i}].check`); return it; }
      if (!isObj(it) || it.check !== undefined || it.machineCheck !== undefined) return it;
      for (const [k, field] of Object.entries(TODO_KEY_CHECKS)) {
        const v = (it as Obj)[k];
        if (typeof v !== "string" || !v.trim()) continue;
        const { [k]: _drop, ...rest } = it as Obj;
        touched = true;
        changes.push(`items[${i}].${k}: "${v}" → check {kind:"${k}", ${field}:"${v}"} (a machine check goes in "check")`);
        return { ...rest, check: { kind: k, [field]: v } };
      }
      return it;
    });
    return touched ? { ...args, items } : args;
  },
  // author_puzzle_chain 고리 role 별칭 — 2026-11-01 cheap r8 flash 가 role:"lock" 을 보내 스키마에서 거절됐다.
  // 번호 고리는 엔딩을 부르면(endingId·reward.ending) ending, 아니면 code.
  author_puzzle_chain(args, changes) {
    if (!Array.isArray(args.links)) return args;
    // 사슬 이름은 이름표(깃발 설명·엔딩 이름) — 없으면 자물쇠/마지막 고리 이름으로(r11 flash: name 없음으로 거절).
    if (typeof args.name !== "string" || !args.name.trim()) {
      const last = [...args.links].reverse().find((l) => isObj(l) && typeof l.name === "string" && l.name.trim()) as Obj | undefined;
      const nm = last ? `${String(last.name)} puzzle` : "puzzle";
      changes.push(`name: missing → "${nm}" (the chain name is a label)`);
      args = { ...args, name: nm };
    }
    let touched = false;
    const links = args.links.map((l0, i) => {
      if (!isObj(l0)) return l0;
      let l: Obj = l0;
      // 칸 이름 오타·다른 이름(r10 flash: needAny → 무시돼 단서 없이 번호를 넣을 수 있었다).
      for (const [from, to] of [["needAny", "needsAny"], ["needAll", "needsAll"], ["need", "needs"], ["requires", "needs"], ["requiresAll", "needsAll"], ["requiresAny", "needsAny"]] as const) {
        if (l[from] !== undefined && l[to] === undefined) { const { [from]: v, ...rest } = l; l = { ...rest, [to]: v }; touched = true; changes.push(`links[${i}].${from} → links[${i}].${to}`); }
      }
      const rw = isObj(l.reward) ? l.reward : undefined;
      if (rw && typeof rw.endingId === "string" && l.endingId === undefined) {
        const { endingId: e, ...rest } = rw; l = { ...l, endingId: e, reward: rest }; touched = true; changes.push(`links[${i}].reward.endingId → links[${i}].endingId`);
      }
      if (typeof l.role !== "string" || !l.role.trim()) {
        // role 없음(r10 flash 첫 사슬) — 칸으로 정해지면 채운다.
        const to = typeof l.code === "string" || typeof l.code === "number" ? (l.endingId !== undefined || isObj((l.reward as Obj | undefined)?.ending) ? "ending" : "code")
          : typeof l.learn === "string" ? "clue" : isObj(l.reward) && ((l.reward as Obj).item !== undefined) ? "pickup"
          : Array.isArray(l.lines) && l.lines.length ? "clue" : undefined;
        if (!to) return l;
        touched = true;
        changes.push(`links[${i}].role: missing → "${to}" (roles are clue | code | door | pickup | ending)`);
        return { ...l, role: to };
      }
      const r = l.role.trim().toLowerCase();
      if (["clue", "code", "door", "pickup", "ending"].includes(r)) return l;
      const reward = isObj(l.reward) ? l.reward : undefined;
      const to = /lock|keypad|password|combination|pin|safe|code|answer/u.test(r) ? (l.endingId !== undefined || isObj(reward?.ending) ? "ending" : "code")
        : /hint|note|examine|inspect|read|memo|clue/u.test(r) ? "clue"
        : /item|take|get|pick|key/u.test(r) ? "pickup"
        : /exit|gate|door|open/u.test(r) ? "door"
        : /end|escape|finish|goal|win/u.test(r) ? "ending" : undefined;
      if (!to) return l;
      touched = true;
      changes.push(`links[${i}].role: "${l.role}" → "${to}" (roles are clue | code | door | pickup | ending)`);
      return { ...l, role: to };
    });
    return touched ? { ...args, links } : args;
  },
  // patch_event_page 에서 set 없이 페이지 칸(commands·trigger…)을 맨 위에 둔 호출 → set 으로 감싼다(r10 flash 세 번 거절).
  patch_event_page(args, changes) {
    if (isObj(args.set)) return args;
    const PAGE_KEYS = ["commands", "conditions", "trigger", "graphic", "movement", "priority", "animationType", "through", "directionFix"];
    const moved = PAGE_KEYS.filter((k) => args[k] !== undefined);
    if (!moved.length) return args;
    const set: Obj = {}; const rest: Obj = { ...args };
    for (const k of moved) { set[k] = args[k]; delete rest[k]; }
    delete rest.set;
    changes.push(`${moved.join(", ")} → set.{${moved.join(", ")}} (page fields go inside "set")`);
    return { ...rest, set };
  },
  declare_story_flag(args, changes) {
    const out = { ...args };
    const text = [out.description, out.meaning, out.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
    if ((out.action === undefined || out.action === "declare") && (typeof out.id !== "string" || !out.id.trim()) && text) {
      let h = 7; for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) | 0;
      const ascii = text.normalize("NFKD").replace(/[^A-Za-z0-9]+/gu, "-").replace(/^-|-$/gu, "").toLowerCase().slice(0, 24);
      out.id = `flag-${ascii || Math.abs(h).toString(36)}`;
      changes.push(`id: missing → "${out.id}" (any kebab-case name works; pass id next time)`);
    }
    // description 은 사람이 읽는 설명 — 없으면 id 로 채운다(2026-11-01 cheap r9 deepseek: {id,kind,targetId} 만 보내 다섯 번 거절).
    if ((out.action === undefined || out.action === "declare") && !text && typeof out.id === "string" && out.id.trim()) {
      out.description = out.id;
      changes.push(`description: missing → "${out.id}" (from id; add a one-line description next time)`);
    }
    if ((out.action === undefined || out.action === "declare") && out.kind === undefined && text) {
      out.kind = /횟수|개수|번째|카운트|count|number|times|점수|수치/iu.test(text) ? "variable" : "switch";
      changes.push(`kind: missing → "${out.kind}" (a count is a variable, an on/off fact is a switch)`);
    }
    return out;
  },
};

let problems: string[] = [];
export function coerceToolArgs(schema: unknown, args: unknown, toolName?: string): ArgCoercion {
  const changes: string[] = [];
  problems = [];
  const fill = toolName ? TOOL_FILLS[toolName] : undefined;
  if (fill && isObj(args)) args = fill(args, changes);
  if (isObj(args)) args = mvCommandsDeep(args, changes, "");
  // 맨 위에 있어야 할 필수 칸이 안쪽 객체 하나에만 있으면 위로 올린다(upsert_event({event:{mapId,…}}) — 2026-11-01 cheap r6 flash).
  const top = schema as Schema | undefined;
  if (isObj(args) && Array.isArray(top?.required) && top?.properties) {
    let lifted: Record<string, unknown> | undefined;
    for (const req of top.required) {
      if ((args as Record<string, unknown>)[req] !== undefined) continue;
      const holders = Object.entries(args as Record<string, unknown>).filter(([, v]) => isObj(v) && (v as Record<string, unknown>)[req] !== undefined && (typeof (v as Record<string, unknown>)[req] !== "object"));
      if (holders.length !== 1) continue;
      lifted ??= { ...(args as Record<string, unknown>) };
      lifted[req] = (holders[0]![1] as Record<string, unknown>)[req];
      changes.push(`${req}: copied from ${holders[0]![0]}.${req} (it belongs at the top level)`);
    }
    if (lifted) args = lifted;
  }
  const out = forkBranches(coerce(schema as Schema, args, "", changes), "", changes);
  const found = problems; problems = [];
  return changes.length ? { args: out, changes, problems: found } : { args, changes, problems: found };
}

/** 분기 명령의 다른 이름 갈래 — 명령 목록은 스키마가 느슨해(아무 객체) 검증을 지나고, 모르는 칸은 실행기가 말없이 버린다.
 * 2026-11-01 cheap r6 deepseek: fork 에 presentItem 의 `otherwiseBranch` 를 써서 «단서 없음»·«틀림» 갈래가 통째로 사라졌다. */
const TEXT_KINDS = new Set(["showText", "show_text", "message", "showMessage", "say", "dialogue", "dialog"]);
const FORK_ALIASES: Readonly<Record<string, string>> = { otherwiseBranch: "else", otherwise: "else", elseBranch: "else", elseCommands: "else", ifFalse: "else", thenBranch: "then", thenCommands: "then", ifTrue: "then" };
function forkBranches(value: unknown, path: string, changes: string[], depth = 0): unknown {
  if (depth > 40 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    let copy: unknown[] | undefined;
    value.forEach((v, i) => { const n = forkBranches(v, `${path}[${i}]`, changes, depth + 1); if (n !== v) { copy ??= [...value]; copy[i] = n; } });
    return copy ?? value;
  }
  let rec = value as Record<string, unknown>;
  // 대사 명령의 다른 이름(RPG Maker·다른 엔진 습관) — showText/message/say → text, 글은 body.
  if (typeof rec.kind === "string" && TEXT_KINDS.has(rec.kind) && (typeof rec.text === "string" || typeof rec.message === "string" || typeof rec.body === "string")) {
    const body = typeof rec.body === "string" ? rec.body : typeof rec.text === "string" ? rec.text : rec.message;
    const { text: _t, message: _m, ...rest } = rec;
    changes.push(`${path || "(top level)"}: {kind:"${rec.kind}"} → {kind:"text", body} (a line of dialogue is kind "text" with "body")`);
    rec = { ...rest, kind: "text", body };
  }
  if (rec.kind === "fork") {
    for (const [from, to] of Object.entries(FORK_ALIASES)) {
      if (rec[from] === undefined || rec[to] !== undefined) continue;
      const { [from]: moved, ...rest } = rec;
      rec = { ...rest, [to]: moved };
      changes.push(`${path || "(top level)"}.${from} → ${to} (a fork's branches are "then" and "else")`);
    }
  }
  let copy: Record<string, unknown> | undefined;
  for (const [k, v] of Object.entries(rec)) { const n = forkBranches(v, path ? `${path}.${k}` : k, changes, depth + 1); if (n !== v) { copy ??= { ...rec }; copy[k] = n; } }
  return copy ?? rec;
}

function coerce(schema: Schema | undefined, value: unknown, path: string, changes: string[], key = ""): unknown {
  if (untyped(schema) || value === undefined) return value;
  const s = schema!;
  const at = path || "(top level)";
  // 숫자 → 열거 이름(MV 습관)
  if (typeof value === "number" && s.enum?.length && !s.enum.includes(value)) {
    const name = MV_ENUMS[key]?.[value];
    if (name && s.enum.includes(name)) { changes.push(`${at}: ${value} → "${name}" (names, not RPG Maker numbers)`); return name; }
    if (s.enum.includes(String(value))) { changes.push(`${at}: ${value} → "${value}" (string)`); return String(value); }
  }
  if (typeof value === "string" && s.enum?.length && !s.enum.includes(value)) {
    const n = Number(value);
    const name = Number.isInteger(n) ? MV_ENUMS[key]?.[n] : undefined;
    if (name && s.enum.includes(name)) { changes.push(`${at}: "${value}" → "${name}"`); return name; }
    const ci = s.enum.find((e) => typeof e === "string" && e.toLowerCase() === value.trim().toLowerCase());
    if (ci !== undefined) { changes.push(`${at}: "${value}" → "${String(ci)}"`); return ci; }
  }
  // 글 ↔ 숫자 ↔ 참거짓
  if (typeof value === "string" && !accepts(s, "string")) {
    const t = value.trim();
    if ((accepts(s, "integer") && /^-?\d+$/u.test(t)) || (accepts(s, "number") && t !== "" && Number.isFinite(Number(t)))) { changes.push(`${at}: "${value}" → ${Number(t)} (number)`); return Number(t); }
    if (accepts(s, "boolean") && (t === "true" || t === "false")) { changes.push(`${at}: "${value}" → ${t} (boolean)`); return t === "true"; }
  }
  if (typeof value === "number" && !accepts(s, "number") && !accepts(s, "integer") && accepts(s, "string") && !s.enum) {
    changes.push(`${at}: ${value} → "${value}" (string)`); return String(value);
  }
  const obj = objectOf(s);
  const arr = arrayOf(s);
  // 낱값 → 객체: 그 객체의 열거 칸이 이 값을 받으면 그 칸으로(check:"talk" → {kind:"talk"}, trigger:0 → {kind:"action"}).
  if (obj?.properties && !isObj(value) && !Array.isArray(value) && !accepts(s, typeof value === "number" ? "number" : typeof value)) {
    const wrapped = scalarToObject(obj, value, key);
    if (wrapped) { changes.push(`${at}: ${JSON.stringify(value)} → ${JSON.stringify(wrapped)} (this field takes an object)`); return coerce(s, wrapped, path, changes, key); }
  }
  // MV 페이지 출현 조건 {switch1Valid, switch1Id, …} → 조건 목록(빈 객체는 빈 목록)
  if (arr && isObj(value) && key === "conditions") {
    const mv = mvPageConditions(value);
    if (mv) { changes.push(`${at}: RPG Maker MV page conditions → ${JSON.stringify(mv)} (a list of {kind, …})`); return coerce(s, mv, path, changes, key); }
  }
  // 하나 → 목록
  if (arr && !Array.isArray(value) && !accepts(s, isObj(value) ? "object" : typeof value === "number" ? "number" : typeof value)) {
    changes.push(`${at}: wrapped the single value in a list`);
    return coerce(s, [value], path, changes, key);
  }
  if (Array.isArray(value) && arr?.items) return value.map((v, i) => coerce(arr.items, v, `${path}[${i}]`, changes, key));
  if (isObj(value) && obj?.properties) return coerceObject(obj, value, path, changes);
  return value;
}

function scalarToObject(obj: Schema, value: unknown, key: string): Obj | undefined {
  const props = obj.properties!;
  if (typeof value === "number" && key === "trigger" && MV_TRIGGER[value] && props.kind?.enum?.includes(MV_TRIGGER[value])) return { kind: MV_TRIGGER[value] };
  if (typeof value !== "string") return undefined;
  const byEnum = Object.entries(props).filter(([, p]) => p.enum?.includes(value));
  if (byEnum.length === 1) return { [byEnum[0]![0]]: value };
  // 글 한 줄 → 말하기 비트(epilogue:"…" → [{kind:"say", text:"…"}]).
  const sayKind = ["say", "narrate", "text"].find((k) => props.kind?.enum?.includes(k));
  if (sayKind && typeIs(props.text, "string")) return { kind: sayKind, text: value };
  // 열거가 없는 칸(run_scene_test 의 kind 처럼 설명만 있는 글)이 유일한 필수 칸이면 그 칸으로.
  const req = obj.required ?? [];
  if (req.length === 1 && typeIs(props[req[0]!], "string") && !props[req[0]!]!.enum) return { [req[0]!]: value };
  return undefined;
}

function coerceObject(obj: Schema, value: Obj, path: string, changes: string[]): Obj {
  const props = obj.properties!;
  let out: Obj = { ...value };
  // RPG Maker MV 명령 목록(list:[{code,parameters}]) → commands
  if (Array.isArray(out.list) && !("list" in props) && "commands" in props && out.commands === undefined && out.list.some((c) => isObj(c) && typeof c.code === "number")) {
    const converted = mvListToCommands(out.list as Obj[]);
    if (converted.ok) {
      const { list: _list, ...rest } = out;
      out = { ...rest, commands: converted.commands };
      changes.push(`${path || "(top level)"}: converted RPG Maker MV \`list\` codes into \`commands\` (${converted.summary}) — write commands as {kind:"text", body:"…"}, {kind:"setSwitch", switchId, value}, {kind:"fork", condition, then, else} next time`);
    }
  }
  if (Array.isArray(out.list) && !("list" in props) && "commands" in props && out.commands === undefined && out.list.some((c) => isObj(c) && typeof c.code === "number")) {
    const failed = mvListToCommands(out.list as Obj[]);
    if (!failed.ok) problems.push(`${path || "(top level)"}.list: RPG Maker MV event codes are not accepted here (code ${failed.code} has no equivalent). Write \`commands\` instead, e.g. [{kind:"text", body:"…"}, {kind:"inputNumber", variableId:"var_0001", digits:4}, {kind:"fork", condition:{kind:"variable", variableId:"var_0001", op:"==", value:7294}, then:[…], else:[…]}, {kind:"setSwitch", switchId:"sw_0004", value:true}, {kind:"setVariable", variableId:"var_0002", op:"+=", value:1}]. A \`list\` field is ignored, so the event would have no commands.${(out.list as Obj[]).some((c) => c?.code === 103 || c?.code === 303) ? " For a number lock (clues → code input → wrong-try count and hint → opening or ending), one author_puzzle_chain call builds all of it: links:[{role:\"clue\", eventId, learn, lines}, …, {role:\"ending\" or \"code\", eventId, needsAny:[clue learn names], code:\"7294\", lockedLines, wrongLines, hintAfter:3, hintLines, endingId or reward}]." : ""}`);
  }
  // 조건 목록이 필수인데 없다(define_ending 등) — 빈 목록 = «조건 없음, triggerEnding 으로만 닿는다».
  if ((obj.required ?? []).includes("conditions") && out.conditions === undefined && typeIs(props.conditions, "array")) {
    out.conditions = [];
    changes.push(`${path ? `${path}.` : ""}conditions: missing → [] (no conditions; it is reached only when a command triggers it by id)`);
  }
  // MV 페이지의 priorityType(0 아래 · 1 같은 층 · 2 위) → priority
  if (typeof out.priorityType === "number" && out.priority === undefined && "priority" in props && !("priorityType" in props) && MV_ENUMS.priority![out.priorityType] && props.priority!.enum?.includes(MV_ENUMS.priority![out.priorityType])) {
    out.priority = MV_ENUMS.priority![out.priorityType];
    delete out.priorityType;
    changes.push(`${path || "(top level)"}: priorityType → priority "${String(out.priority)}"`);
  }
  // 빠진 필수 칸 ← 다른 이름
  for (const need of obj.required ?? []) {
    if (out[need] !== undefined) continue;
    const alias = (ALIASES[need] ?? []).find((a) => out[a] !== undefined && !(a in props));
    if (!alias) continue;
    out[need] = out[alias];
    delete out[alias];
    changes.push(`${path ? `${path}.` : ""}${alias} → ${path ? `${path}.` : ""}${need} (the field is named "${need}")`);
  }
  for (const [k, v] of Object.entries(out)) {
    if (!(k in props)) continue;
    const next = coerce(props[k], v, path ? `${path}.${k}` : k, changes, k);
    if (next !== v) out[k] = next;
  }
  return out;
}

// ── RPG Maker MV 명령 코드 → 우리 명령 ─────────────────────────────────────────────
// 작은 모델이 이벤트를 MV JSON 으로 쓰는 습관을 그대로 받아 준다. 아는 코드만 바꾸고, 모르는 코드가 하나라도 있으면
// 바꾸지 않는다(반쯤 바꾼 이벤트를 저장하지 않는다 — 그때는 원래 검증 오류가 commands 모양을 알려 준다).
// 번호(1) · 번호 글("1") · 이미 우리 id("sw_0001"·"var_wrong_count") 셋 다 받는다 — flash 가 121 의 매개변수에 "sw_0001" 을 넣었다.
const idOf = (prefix: string, n: unknown): string | undefined => {
  if (typeof n === "number" && Number.isInteger(n) && n > 0) return `${prefix}_${String(n).padStart(4, "0")}`;
  if (typeof n === "string" && /^\d+$/u.test(n.trim()) && Number(n) > 0) return `${prefix}_${n.trim().padStart(4, "0")}`;
  if (typeof n === "string" && /^[A-Za-z][\w-]*$/u.test(n.trim())) return n.trim();
  return undefined;
};
const sw = (n: unknown): string | undefined => idOf("sw", n);
const vr = (n: unknown): string | undefined => idOf("var", n);
const MV_OPS = ["=", "+=", "-=", "*=", "/="] as const;
const MV_CMP = ["==", ">=", "<=", ">", "<", "!="] as const;

const MV_PAGE_KEYS = ["switch1Valid", "switch1Id", "switch2Valid", "switch2Id", "variableValid", "variableId", "variableValue", "selfSwitchValid", "selfSwitchCh", "itemValid", "itemId", "actorValid", "actorId"];
/** MV 는 «…Valid» 로 켜고 끈다 — Valid 를 빼고 id 만 준 작은 모델은 «쓰겠다»는 뜻이다. */
const on = (v: Obj, valid: string, id: string): boolean => v[valid] === true || (v[valid] === undefined && v[id] !== undefined && v[id] !== 0 && v[id] !== "");
function mvPageConditions(v: Obj): Obj[] | undefined {
  const keys = Object.keys(v);
  if (keys.length === 0) return [];
  if (!keys.every((k) => MV_PAGE_KEYS.includes(k))) return undefined;
  const out: Obj[] = [];
  if (on(v, "switch1Valid", "switch1Id") && sw(v.switch1Id)) out.push({ kind: "switch", switchId: sw(v.switch1Id), value: true });
  if (on(v, "switch2Valid", "switch2Id") && sw(v.switch2Id)) out.push({ kind: "switch", switchId: sw(v.switch2Id), value: true });
  if (on(v, "variableValid", "variableId") && vr(v.variableId) && typeof v.variableValue === "number") out.push({ kind: "variable", variableId: vr(v.variableId), op: ">=", value: v.variableValue });
  if (on(v, "selfSwitchValid", "selfSwitchCh") && typeof v.selfSwitchCh === "string") out.push({ kind: "selfSwitch", key: v.selfSwitchCh, value: true });
  if (on(v, "itemValid", "itemId") || on(v, "actorValid", "actorId")) return undefined; // 항목·배우 번호는 우리 id 로 옮길 수 없다
  return out;
}

function mvCondition(p: readonly unknown[]): Obj | undefined {
  const [type, a, b, c, d] = p;
  if (type === 0 && sw(a)) return { kind: "switch", switchId: sw(a), value: b === 0 };
  if (type === 1 && vr(a) && b === 0 && typeof c === "number") return { kind: "variable", variableId: vr(a), op: MV_CMP[(d as number) ?? 0] ?? "==", value: c };
  if (type === 2 && typeof a === "string") return { kind: "selfSwitch", key: a, value: b === 0 };
  return undefined;
}

/**
 * 어디에 있든 `commands` 가 MV 코드 목록([{code:101},{code:401,parameters:["…"]}])이면 우리 명령으로 바꾼다.
 * 스키마가 느슨한 자리(patch_event_page 의 set, upsert_event 의 pages)는 위 list 변환이 안 닿아 «kind 없음»으로 세 번 거절됐다(2026-11-01 cheap r11 flash).
 */
function mvCommandsDeep(value: Obj, changes: string[], path: string, depth = 0): Obj {
  if (depth > 6) return value;
  let out: Obj | undefined;
  for (const [k, v] of Object.entries(value)) {
    let next: unknown = v;
    if (k === "commands" && Array.isArray(v) && v.length && v.every((c) => isObj(c) && typeof c.code === "number" && c.kind === undefined)) {
      const converted = mvListToCommands(v as Obj[]);
      if (converted.ok) { next = converted.commands; changes.push(`${path ? `${path}.` : ""}commands: converted RPG Maker MV codes (${converted.summary}) — write {kind:"text", body:"…"} next time`); }
    } else if (Array.isArray(v)) {
      const arr = v.map((x, i) => (isObj(x) ? mvCommandsDeep(x, changes, `${path ? `${path}.` : ""}${k}[${i}]`, depth + 1) : x));
      if (arr.some((x, i) => x !== v[i])) next = arr;
    } else if (isObj(v)) {
      const o = mvCommandsDeep(v, changes, `${path ? `${path}.` : ""}${k}`, depth + 1);
      if (o !== v) next = o;
    }
    if (next !== v) { out = out ?? { ...value }; out[k] = next; }
  }
  return out ?? value;
}

export function mvListToCommands(list: readonly Obj[]): { ok: true; commands: Obj[]; summary: string } | { ok: false; code: number } {
  const used = new Map<string, number>();
  const note = (k: string) => used.set(k, (used.get(k) ?? 0) + 1);
  let i = 0;
  const block = (indent: number): Obj[] | number => {
    const outCmds: Obj[] = [];
    while (i < list.length) {
      const c = list[i]!;
      const code = c.code as number;
      const p = (Array.isArray(c.parameters) ? c.parameters : []) as unknown[];
      const ind = typeof c.indent === "number" ? c.indent : indent;
      if (ind < indent) return outCmds;
      if (code === 0) { i += 1; if (indent > 0) return outCmds; continue; }
      if (code === 108 || code === 408) { i += 1; continue; } // 주석
      if (code === 101) { i += 1; const lines: string[] = []; while (list[i]?.code === 401) { lines.push(String(((list[i]!.parameters as unknown[]) ?? [])[0] ?? "")); i += 1; } if (lines.length) { outCmds.push({ kind: "text", body: lines.join("\n") }); note("text"); } continue; }
      if (code === 401) { const lines: string[] = []; while (list[i]?.code === 401) { lines.push(String(((list[i]!.parameters as unknown[]) ?? [])[0] ?? "")); i += 1; } outCmds.push({ kind: "text", body: lines.join("\n") }); note("text"); continue; }
      if (code === 121) { // [start, end, 0=ON 1=OFF]
        const [a, b, v] = p as number[];
        if (!sw(a)) return code;
        if (typeof a !== "number") outCmds.push({ kind: "setSwitch", switchId: sw(a), value: v === 0 });
        else for (let n = a; n <= (typeof b === "number" ? b : a); n += 1) outCmds.push({ kind: "setSwitch", switchId: sw(n), value: v === 0 });
        note("setSwitch"); i += 1; continue;
      }
      if (code === 122) { // [start, end, op, operandType 0=const 1=var, operand]
        const [a, b, op, t, x] = p as number[];
        if (!vr(a) || (t !== 0 && t !== 1) || !MV_OPS[op ?? 0]) return code;
        const value = t === 0 ? x : { kind: "var", id: vr(x) };
        if (typeof a !== "number") outCmds.push({ kind: "setVariable", variableId: vr(a), op: MV_OPS[op ?? 0], value });
        else for (let n = a; n <= (typeof b === "number" ? b : a); n += 1) outCmds.push({ kind: "setVariable", variableId: vr(n), op: MV_OPS[op ?? 0], value });
        note("setVariable"); i += 1; continue;
      }
      // 303 은 MV 의 이름 입력인데, 작은 모델이 [변수, 자릿수] 로 숫자 입력 자리에 쓴다(2026-11-01 flash) — 그 모양일 때만 숫자 입력으로.
      if (code === 303 && vr(p[0]) && typeof p[1] === "number" && p[1] >= 1 && p[1] <= 8) { outCmds.push({ kind: "inputNumber", variableId: vr(p[0]), digits: p[1] }); note("inputNumber"); i += 1; continue; }
      if (code === 103) { const [a, digits] = p as number[]; if (!vr(a)) return code; outCmds.push({ kind: "inputNumber", variableId: vr(a), digits: Math.max(1, Math.min(6, digits ?? 4)) }); note("inputNumber"); i += 1; continue; }
      if (code === 201 && p[0] === 0 && typeof p[1] === "string" && p[1].trim() && typeof p[2] === "number" && typeof p[3] === "number") { outCmds.push({ kind: "transfer", mapId: p[1], x: p[2], y: p[3], ...(MV_ENUMS.direction![p[4] as number] ? { direction: MV_ENUMS.direction![p[4] as number] } : {}) }); note("transfer"); i += 1; continue; }
      if (code === 230) { outCmds.push({ kind: "wait", ms: Math.round(((p[0] as number) ?? 60) * (1000 / 60)) }); note("wait"); i += 1; continue; }
      if (code === 111) {
        const cond = mvCondition(p);
        if (!cond) return code;
        i += 1;
        const then = block(ind + 1);
        if (typeof then === "number") return then;
        let otherwise: Obj[] | undefined;
        if (list[i]?.code === 411) { i += 1; const e = block(ind + 1); if (typeof e === "number") return e; otherwise = e; }
        if (list[i]?.code === 412) i += 1;
        outCmds.push({ kind: "fork", condition: cond, then, ...(otherwise?.length ? { else: otherwise } : {}) });
        note("fork"); continue;
      }
      if (code === 411 || code === 412) return outCmds;
      return code;
    }
    return outCmds;
  };
  const result = block(0);
  if (typeof result === "number") return { ok: false, code: result };
  return { ok: true, commands: result, summary: [...used].map(([k, n]) => `${k}×${n}`).join(", ") || "empty" };
}
