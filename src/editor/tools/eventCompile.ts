// editor/tools/eventCompile.ts
// place_npc 등이 받는 고수준 입력(SimplePage/graphic.query)을 EventPage/graphic으로 컴파일한다.
// graphic.query 해석은 charsetQuery의 별칭/자유 질의 매처에 위임한다.

import { sharedFaceFromEventGraphic, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { EASYRPG_RTP_ASSETS, charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { npcGraphicExampleLabels, pickNpcGraphic, type NpcGraphicPickOptions } from "@/assets/charsetQuery";
import { searchResources } from "@/assets/resourceSearch";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, FaceGraphic } from "@/project/types";
import { ToolError } from "./types";
import type { SimplePage } from "./types";

const PASSIVE_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const CONDITION_KIND_SET: ReadonlySet<string> = new Set(CONDITION_KINDS);
const SIMPLE_PAGE_EXAMPLE = `{"pages":[{"lines":["안녕하세요"],"conditions":[],"commands":[{"kind":"text","body":"안녕하세요"}]}]}`;

/**
 * 모델이 반복해서 내는 커맨드 kind 오표기 → 정규 이름.
 *
 * 2026-08-28 실측: place_npc 가 `kind:"dialogue"` 로 한 번 튕기고 재시도해서야 통과했다.
 * 의미가 1:1 로 대응하는 표기만 넣는다 — 애매한 이름은 그대로 오류를 내야 모델이 스키마를 다시 본다.
 */
const COMMAND_KIND_ALIASES: Readonly<Record<string, string>> = {
  dialogue: "text",
  message: "text",
  say: "text",
  showtext: "text",
  showmessage: "text",
  choice: "choices",
  conditionalbranch: "fork",
  teleport: "transfer",
  transferplayer: "transfer",
};

const COMMAND_KIND_SET: ReadonlySet<string> = new Set(COMMAND_KINDS);
/** 대소문자·구분자만 다른 표기를 정규 이름으로 되돌리는 색인(`change_gold` → `changeGold`). */
const COMMAND_KIND_BY_NORMALIZED: ReadonlyMap<string, string> = new Map(
  COMMAND_KINDS.map((kind) => [kind.toLowerCase(), kind]),
);

/** 정규 이름이면 그대로, 알려진 오표기면 정규 이름으로, 그 외에는 null. */
export function resolveCommandKind(raw: string): string | null {
  if (COMMAND_KIND_SET.has(raw)) return raw;
  // 구분자 제거 + 소문자화로 snake_case/kebab-case/PascalCase 를 한 번에 흡수한다.
  const normalized = raw.replace(/[\s_-]/gu, "").toLowerCase();
  return COMMAND_KIND_BY_NORMALIZED.get(normalized) ?? COMMAND_KIND_ALIASES[normalized] ?? null;
}

type EventCompileOptions = {
  readonly movement?: EventPage["movement"];
  readonly priority?: EventPage["priority"];
  readonly warnings?: string[];
  readonly path?: string;
  /** 대화 시 표시할 페이스. 생략 시 graphic charset에서 자동 매핑. */
  readonly face?: FaceGraphic | null;
  /** false면 changeFace를 넣지 않음. 기본 true도 매핑된 얼굴만 삽입한다. */
  readonly injectFace?: boolean;
};

type RecordValue = Record<string, unknown>;

export type GraphicSpec =
  | { readonly query: string }
  | { readonly textureKey: string; readonly characterIndex?: number }
  | { readonly transparent: true };

type CharsetGraphicSelection = {
  readonly textureKey: string;
  readonly characterIndex: number;
};

const CHARSET_SEARCH_ID_PATTERN = /^charset:(.+):(\d+)$/;
const KNOWN_CHARSET_TEXTURE_KEYS = [
  ...new Set([
    ...EASYRPG_RTP_ASSETS.flatMap((asset) => (asset.category === "charset" && "textureKey" in asset ? [asset.textureKey] : [])),
    ...searchResources("charset", "*").flatMap((result) => {
      const parsed = parseCharsetSearchId(result.id);
      return parsed ? [parsed.textureKey] : [];
    }),
  ]),
];

function parseCharsetSearchId(input: string): CharsetGraphicSelection | null {
  const match = CHARSET_SEARCH_ID_PATTERN.exec(input.trim());
  if (!match) return null;
  const textureKey = match[1];
  const indexText = match[2];
  if (textureKey === undefined || indexText === undefined) return null;
  const characterIndex = Number(indexText);
  if (!Number.isInteger(characterIndex)) return null;
  return { textureKey, characterIndex };
}

function resolveCharsetTextureKeyCandidate(input: string): string | null {
  const trimmed = input.trim();
  const exact = KNOWN_CHARSET_TEXTURE_KEYS.find((textureKey) => textureKey === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const folded = KNOWN_CHARSET_TEXTURE_KEYS.find((textureKey) => textureKey.toLowerCase() === lower);
  if (folded) return folded;
  const top = searchResources("charset", trimmed)[0];
  if (!top) return null;
  return parseCharsetSearchId(top.id)?.textureKey ?? null;
}

function charsetTextureKeyCandidates(input: string): readonly string[] {
  const matches = searchResources("charset", input)
    .map((result) => parseCharsetSearchId(result.id)?.textureKey)
    .filter((textureKey) => textureKey !== undefined);
  const candidates = matches.length > 0 ? matches : KNOWN_CHARSET_TEXTURE_KEYS;
  return [...new Set(candidates)].slice(0, 5);
}

export function resolveCharsetTextureKey(input: string): string {
  const parsed = parseCharsetSearchId(input);
  const resolved = resolveCharsetTextureKeyCandidate(parsed?.textureKey ?? input);
  if (resolved) return resolved;
  const candidates = charsetTextureKeyCandidates(input).join(", ");
  throw new ToolError(
    `charset 그래픽 textureKey를 해석하지 못했습니다: "${input}". 후보 textureKey: ${candidates}. list_resources(kind:"charset")를 호출하거나 graphic을 {query}로 지정하세요.`,
    { code: "graphic-not-found" }
  );
}

function resolveCharsetGraphicSelection(textureKey: string, characterIndex: number | undefined): CharsetGraphicSelection {
  const parsed = parseCharsetSearchId(textureKey);
  const resolvedTextureKey = resolveCharsetTextureKey(textureKey);
  const resolvedCharacterIndex = parsed && (characterIndex === undefined || characterIndex === 0) ? parsed.characterIndex : characterIndex ?? 0;
  return { textureKey: resolvedTextureKey, characterIndex: resolvedCharacterIndex };
}

// textureKey + characterIndex → 아래방향 1프레임 그래픽.
export function charsetGraphic(textureKey: string, characterIndex: number | undefined = 0): EventPageGraphic {
  const graphic = resolveCharsetGraphicSelection(textureKey, characterIndex);
  return {
    sprite: { type: "bundled", id: graphic.textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: graphic.characterIndex, direction: "down", pattern: 1 }),
  };
}

// query 문자열을 별칭/자유 질의 매처로 해석해 charset 그래픽을 만든다.
export type GraphicQueryResolveOptions = NpcGraphicPickOptions & {
  /** 검색어가 카탈로그에 없어 기본 주민 그래픽으로 대체했을 때 호출된다(경고 전달용). */
  readonly onFallback?: (message: string) => void;
};

export function resolveGraphicQuery(query: string, pick?: GraphicQueryResolveOptions): EventPageGraphic {
  // 2026-09-18 거부 대신 기본값: "경비병" 같은 라벨이 카탈로그에 없으면 실패하던 것을 기본 주민 그래픽으로 대체한다.
  // 어떤 그림이든 서 있는 NPC 가 없는 NPC 보다 낫다. 정확한 그림이 필요하면 list_npc_graphics 로 고르면 된다.
  const { onFallback, ...pickOptions } = pick ?? {};
  let entry = pickNpcGraphic(query, pickOptions);
  if (!entry) {
    entry = pickNpcGraphic("villager", pickOptions) ?? pickNpcGraphic("주민", {});
    if (entry) onFallback?.(`graphic.query "${query}" 에 맞는 charset 이 없어 기본 주민 그래픽으로 대체했습니다. 정확한 그림은 list_npc_graphics 로 고르세요.`);
  }
  if (!entry) {
    const examples = npcGraphicExampleLabels(12).join(", ");
    throw new ToolError(
      `그래픽 검색어에 맞는 charset 리소스를 찾지 못했습니다: "${query}". 후보 라벨 예시: ${examples}. list_npc_graphics 또는 list_resources(kind:"charset")로 후보를 조회하거나 graphic을 {textureKey, characterIndex}로 직접 지정하세요.`,
      { code: "graphic-not-found" }
    );
  }
  return charsetGraphic(entry.textureKey, entry.characterIndex);
}

// GraphicSpec을 EventPageGraphic으로 변환.
export function resolveGraphic(spec: GraphicSpec | undefined, pick?: GraphicQueryResolveOptions): EventPageGraphic {
  if (!spec) return { transparent: true };
  if ("transparent" in spec) return { transparent: true };
  if ("query" in spec) return resolveGraphicQuery(spec.query, pick);
  return charsetGraphic(spec.textureKey, spec.characterIndex);
}

/** 맵 이벤트에 이미 쓰인 charset 슬롯 키 집합. */
export function usedCharsetGraphicKeysOnMap(map: {
  readonly events: readonly { readonly pages?: readonly { readonly graphic?: EventPageGraphic }[] }[];
}): Set<string> {
  const used = new Set<string>();
  for (const event of map.events) {
    for (const page of event.pages ?? []) {
      const g = page.graphic;
      const spriteId = g?.sprite?.id;
      if (!spriteId || g?.transparent) continue;
      const pattern = typeof g.pattern === "number" ? g.pattern : 0;
      const characterIndex = decodeCharsetFrameIndex(pattern).characterIndex;
      used.add(`${spriteId}#${characterIndex}`);
    }
  }
  return used;
}

// 대사 한 줄을 text 커맨드로.
function textCommand(speaker: string | undefined, body: string): Command {
  return speaker ? { kind: "text", speaker, body } : { kind: "text", body };
}

// SimplePage의 대사 소스 — lines 외에 LLM이 자주 쓰는 별칭(showText/messages/text)도 수용한다.
function pageLines(page: SimplePage): readonly string[] {
  if (page.lines && page.lines.length > 0) return page.lines;
  if (page.showText && page.showText.length > 0) return page.showText;
  if (page.messages && page.messages.length > 0) return page.messages;
  if (typeof page.text === "string" && page.text.length > 0) return [page.text];
  return [];
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length:${value.length})`;
  switch (typeof value) {
    case "object": {
      const keys = Object.keys(value as RecordValue).slice(0, 4);
      return keys.length > 0 ? `object(keys:${keys.join(",")})` : "object";
    }
    case "string": {
      const compact = value.length > 40 ? `${value.slice(0, 40)}…` : value;
      return `string(${JSON.stringify(compact)})`;
    }
    case "number":
      return Number.isFinite(value) ? `number(${value})` : "number(non-finite)";
    case "boolean":
      return `boolean(${value})`;
    case "bigint":
      return "bigint";
    case "function":
      return "function";
    case "symbol":
      return "symbol";
    case "undefined":
      return "undefined";
  }
  return "unknown";
}

function simplePageFieldError(path: string, expected: string, actual: unknown): ToolError {
  const conditionHint = path.includes(".conditions") ? ' 페이지 조건 예: {kind:"selfSwitch",key:"A",value:true} 또는 {kind:"switch",switchId:"조회한 ID",value:true}. 첫 페이지 conditions:[], 다음 페이지에 위 조건을 사용하세요.' : "";
  return new ToolError(
    `SimplePage 인자 오류: 필드: ${path}; 기대 타입: ${expected}; 실제 타입: ${describeValue(actual)}; 최소 예시: ${SIMPLE_PAGE_EXAMPLE}${conditionHint}`,
    { code: "invalid-args" }
  );
}

function simplePageShapeError(path: string, expected: string, actual: unknown, detail: string): ToolError {
  return new ToolError(
    `SimplePage 인자 오류: 필드: ${path}; 기대 타입: ${expected}; 실제 타입: ${describeValue(actual)}; 세부: ${detail}; 최소 예시: ${SIMPLE_PAGE_EXAMPLE}`,
    { code: "invalid-args" }
  );
}

function normalizeObjectList(
  raw: unknown,
  path: string,
  expected: string,
  singleObjectWarning: string,
  nullWarning: string,
  warnings: string[] | undefined
): unknown[] {
  if (raw === undefined) return [];
  if (raw === null) {
    warnings?.push(nullWarning);
    return [];
  }
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    warnings?.push(singleObjectWarning);
    return [raw];
  }
  throw simplePageFieldError(path, expected, raw);
}

function recoverCommandKind(command: RecordValue, path: string, warnings: string[] | undefined): string | null {
  const commandAlias = command.command;
  if (typeof commandAlias === "string") {
    delete command.command;
    warnings?.push(`SimplePage 정규화: ${path}.command 문자열을 kind로 사용했습니다.`);
    return commandAlias;
  }

  const kind = command.kind;
  if (!isRecord(kind)) return null;
  if (typeof kind.command === "string") {
    warnings?.push(`SimplePage 정규화: ${path}.kind.command 문자열을 kind로 사용했습니다.`);
    return kind.command;
  }
  if (typeof kind.kind === "string") {
    warnings?.push(`SimplePage 정규화: ${path}.kind.kind 문자열을 kind로 사용했습니다.`);
    return kind.kind;
  }
  return null;
}

function normalizeCommand(raw: unknown, path: string, warnings: string[] | undefined): Command {
  if (!isRecord(raw)) throw simplePageFieldError(path, "Command object", raw);
  const command: RecordValue = { ...raw };
  const rawKind = command.kind;
  const requestedKind = typeof rawKind === "string" ? rawKind : recoverCommandKind(command, path, warnings);
  if (!requestedKind) {
    const error = simplePageFieldError(`${path}.kind`, "string", rawKind);
    // The audited 101 ID is not a catalog alias. Reject it and suggest native text,
    // only when the entire payload unambiguously describes the supplied lines.
    const fields = command.fields;
    if (Object.keys(command).every(key => key === "commandId" || key === "fields")
      && (command.commandId === "m2-001-show-text" || command.commandId === "m2-101-show-text")
      && isRecord(fields) && Object.keys(fields).length === 1
      && Array.isArray(fields.lines) && fields.lines.length > 0 && fields.lines.every(line => typeof line === "string")) {
      const example = { kind: "text", body: fields.lines.join("\n") } satisfies Command;
      throw new ToolError(`${error.message}\nrepair: ${JSON.stringify({ path, example })}`, { code: error.code });
    }
    throw error;
  }
  const kind = resolveCommandKind(requestedKind);
  if (!kind) {
    const error = simplePageFieldError(`${path}.kind`, "known command kind string", requestedKind);
    // 교정 예시일 뿐 alias가 아니다: 조건 item을 실행 명령으로 자동 변환하지 않는다.
    if (requestedKind === "item" || requestedKind === "changeItems" || requestedKind === "gainItem") {
      const example = {
        kind: "changeItem",
        itemId: typeof command.itemId === "string" ? command.itemId : "ITEM_ID_FROM_get_database_records",
        op: "+=",
        amount: typeof command.amount === "number" && Number.isFinite(command.amount) ? command.amount : 1,
      } satisfies Command;
      throw new ToolError(
        `${error.message}\nrepair: ${JSON.stringify({ path, example })}\nitemId는 get_database_records로 조회한 실제 ID를 사용하세요.`,
        { code: error.code },
      );
    }
    throw error;
  }
  if (kind !== requestedKind) {
    warnings?.push(`SimplePage 정규화: ${path}.kind "${requestedKind}" 를 "${kind}" 로 해석했습니다.`);
  }
  command.kind = kind;
  if (kind === "text" && command.body === undefined && typeof command.text === "string") {
    command.body = command.text;
    delete command.text;
    warnings?.push(`SimplePage 정규화: ${path}.text를 text.body로 변환했습니다.`);
  }
  if (kind === "text" && command.body === undefined && Array.isArray(command.lines) && command.lines.every(line => typeof line === "string")) {
    command.body = command.lines.join("\n");
    delete command.lines;
    warnings?.push(`SimplePage 정규화: ${path}.lines를 text.body로 변환했습니다.`);
  }
  if (kind === "setSelfSwitch" && typeof command.key !== "string" && typeof command.id === "string") {
    command.key = command.id;
    delete command.id;
    warnings?.push(`SimplePage 정규화: ${path}.id를 setSelfSwitch.key로 사용했습니다.`);
  }
  if (kind === "setSwitch" && typeof command.switchId !== "string" && typeof command.id === "string") {
    command.switchId = command.id;
    delete command.id;
    warnings?.push(`SimplePage 정규화: ${path}.id를 setSwitch.switchId로 사용했습니다.`);
  }
  if ((kind === "setSelfSwitch" || kind === "setSwitch") && (command.value === "true" || command.value === "false")) {
    command.value = command.value === "true";
    warnings?.push(`SimplePage 정규화: ${path}.value 문자열을 boolean으로 변환했습니다.`);
  }
  if (
    (kind === "changeGold" || kind === "changeItem" || kind === "changeExp" || kind === "changeLevel"
      || kind === "changeActorHp" || kind === "changeActorMp" || kind === "changeLifeSkillExp")
    && typeof command.op !== "string"
  ) {
    command.op = "+=";
    warnings?.push(`SimplePage 정규화: ${path}.op 가 없어 += 로 채웠습니다.`);
  }
  if (kind === "setVariable" && typeof command.op !== "string") {
    command.op = "=";
    warnings?.push(`SimplePage 정규화: ${path}.op 가 없어 = 로 채웠습니다.`);
  }
  return command as Command;
}

function normalizeCommands(raw: unknown, path: string, warnings: string[] | undefined): Command[] {
  const values = normalizeObjectList(
    raw,
    path,
    "array<Command> 또는 Command object",
    `SimplePage 정규화: ${path} 단수 객체를 배열로 감쌌습니다.`,
    `SimplePage 정규화: ${path} null을 빈 배열로 처리했습니다.`,
    warnings
  );
  return values.map((value, index) => normalizeCommand(value, `${path}[${index}]`, warnings));
}

function normalizeCondition(raw: unknown, path: string, warnings: string[] | undefined): EventPageCondition {
  if (!isRecord(raw)) throw simplePageFieldError(path, "EventPageCondition object", raw);
  const condition: RecordValue = { ...raw };
  if (typeof condition.kind !== "string") throw simplePageFieldError(`${path}.kind`, "string", condition.kind);
  if (!CONDITION_KIND_SET.has(condition.kind)) {
    throw simplePageFieldError(`${path}.kind`, "known condition kind string", condition.kind);
  }
  if (condition.kind === "selfSwitch" && typeof condition.key !== "string" && typeof condition.id === "string") {
    condition.key = condition.id;
    delete condition.id;
    warnings?.push(`SimplePage 정규화: ${path}.id를 selfSwitch.key로 사용했습니다.`);
  }
  if (condition.kind === "switch" && typeof condition.switchId !== "string" && typeof condition.id === "string") {
    condition.switchId = condition.id;
    delete condition.id;
    warnings?.push(`SimplePage 정규화: ${path}.id를 switch.switchId로 사용했습니다.`);
  }
  if ((condition.kind === "selfSwitch" || condition.kind === "switch") && (condition.value === "true" || condition.value === "false")) {
    condition.value = condition.value === "true";
    warnings?.push(`SimplePage 정규화: ${path}.value 문자열을 boolean으로 변환했습니다.`);
  }
  try {
    validateConditionShape(path, condition);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw simplePageShapeError(path, "valid EventPageCondition object", condition, detail);
  }
  return condition as EventPageCondition;
}

function normalizeConditions(raw: unknown, path: string, warnings: string[] | undefined): EventPageCondition[] {
  const values = normalizeObjectList(
    raw,
    path,
    "array<EventPageCondition> 또는 EventPageCondition object",
    `SimplePage 정규화: ${path} 단수 객체를 배열로 감쌌습니다.`,
    `SimplePage 정규화: ${path} null을 빈 배열로 처리했습니다.`,
    warnings
  );
  return values.flatMap((value, index) => {
    if (isRecord(value) && (Object.keys(value).length === 0 || (value.kind === "none" && Object.keys(value).length === 1))) {
      warnings?.push(`SimplePage 정규화: ${path}[${index}] 빈/없음 조건을 제외했습니다.`);
      return [];
    }
    if (isRecord(value) && Object.keys(value).every(key => key === "selfSwitch" || key === "value")
      && (value.selfSwitch === "A" || value.selfSwitch === "B" || value.selfSwitch === "C" || value.selfSwitch === "D")
      && (value.value === undefined || typeof value.value === "boolean")) {
      // Same default as make_villager dialogue.when; guidance, not an acceptance alias.
      const condition = { kind: "selfSwitch", key: value.selfSwitch, value: value.value ?? true } satisfies EventPageCondition;
      const repair = Array.isArray(raw)
        ? { path: `${path}[${index}]`, example: condition }
        : { path, example: [condition] };
      const error = simplePageFieldError(`${path}[${index}].kind`, "string", value.kind);
      throw new ToolError(`${error.message}\nrepair: ${JSON.stringify(repair)}`, { code: error.code });
    }
    return [normalizeCondition(value, `${path}[${index}]`, warnings)];
  });
}

// SimplePage[] → EventPage[]. 각 페이지는 lines(대사) → choices → commands(원시) 순으로 합성한다.
export function compileSimplePages(
  idPrefix: string,
  name: string,
  pages: readonly SimplePage[],
  graphic: EventPageGraphic,
  options: EventCompileOptions = {}
): EventPage[] {
  const compiled = pages.map((page, index) =>
    compileSimplePage(
      `${idPrefix}_p${index}`,
      name,
      page,
      resolvePageGraphic(page, graphic),
      { ...options, path: `pages[${index}]` },
    )
  );
  // 죽은 페이지 판정은 여기서 하지 않는다. place_npc·make_villager 는 둘 다 뒤에서
  // assertEventShape(event, warnings) 로 끝나는데, 그쪽이 **나중에 덧붙는 페이지**
  // (friendshipUnlock·상점)까지 본다. 양쪽에서 내면 같은 결함이 두 번 보고돼 하나가 둘로 보인다.
  return compiled;
}

export function compileSimplePage(
  id: string,
  name: string,
  page: SimplePage,
  graphic: EventPageGraphic,
  options: EventCompileOptions = {}
): EventPage {
  const path = options.path ?? "page";
  const commands: Command[] = [];
  const lines = pageLines(page);
  const hasText = lines.length > 0
    || (page.choices && page.choices.length > 0)
    || (page.commands && page.commands.length > 0);
  // 명시 face 우선. 자동 얼굴은 공용 검토 자료만 사용하며 얼굴 없는 상태도 보존한다.
  const injectFace = options.injectFace !== false;
  if (injectFace && hasText) {
    const face = options.face !== undefined ? options.face
      : page.face !== undefined ? faceFromSimplePage(page)
      : sharedFaceFromEventGraphic(graphic);
    if (face) {
      commands.push({
        kind: "changeFace",
        resourceId: face.resourceId,
        position: face.position ?? "left",
        flipHorizontally: face.flipHorizontally ?? false,
      });
    } else {
      options.warnings?.push(
        `NPC '${name}' 공용 얼굴 매핑 없음(미검토·얼굴 없음 포함) — 얼굴을 자동 추정하지 않습니다.`,
      );
    }
  }
  for (const line of lines) commands.push(textCommand(name, line));
  if (page.choices && page.choices.length > 0) {
    commands.push({
      kind: "choices",
      options: page.choices.map((choice, choiceIndex) => ({
        text: choice.text,
        branch: normalizeCommands(choice.commands, `${path}.choices[${choiceIndex}].commands`, options.warnings),
      })),
      cancelBehavior: "choice2",
    });
  }
  commands.push(...normalizeCommands(page.commands, `${path}.commands`, options.warnings));
  const priority = options.priority ?? "same";
  const pageName = typeof page.name === "string" && page.name.trim() ? page.name.trim() : name;
  return {
    id,
    name: pageName,
    conditions: normalizeConditions(page.conditions, `${path}.conditions`, options.warnings),
    graphic,
    trigger: { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    movement: options.movement ?? PASSIVE_MOVEMENT,
    commands,
  };
}

function resolvePageGraphic(page: SimplePage, fallback: EventPageGraphic): EventPageGraphic {
  const spec = graphicSpecFromPage(page);
  return spec ? resolveGraphic(spec) : fallback;
}

function graphicSpecFromPage(page: SimplePage): GraphicSpec | undefined {
  const spec = page.graphic;
  if (!spec || typeof spec !== "object") return undefined;
  if (spec.transparent === true) return { transparent: true };
  if (typeof spec.query === "string" && spec.query.trim()) return { query: spec.query.trim() };
  if (typeof spec.textureKey === "string" && spec.textureKey.trim()) {
    return {
      textureKey: spec.textureKey.trim(),
      ...(typeof spec.characterIndex === "number" ? { characterIndex: spec.characterIndex } : {}),
    };
  }
  return undefined;
}

function faceFromSimplePage(page: SimplePage): FaceGraphic | null {
  const raw = page.face;
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.resourceId === "string" && rec.resourceId.trim()) {
    // 얼굴은 낱장 리소스 id 한 개로 지정한다(시트 id+칸 번호 계약은 폐기).
    return {
      resourceId: rec.resourceId.trim(),
      position: rec.position === "right" ? "right" : "left",
      flipHorizontally: rec.flipHorizontally === true,
    };
  }
  if (typeof rec.textureKey === "string") {
    return sharedFaceForCharset(
      rec.textureKey,
      typeof rec.characterIndex === "number" ? rec.characterIndex : 0,
    );
  }
  return null;
}

export { PASSIVE_MOVEMENT };
