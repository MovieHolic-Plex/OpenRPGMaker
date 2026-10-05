// editor/tools/eventCompile.ts
// place_npc 등이 받는 고수준 입력(SimplePage/graphic.query)을 EventPage/graphic으로 컴파일한다.
// graphic.query 해석은 charsetQuery의 별칭/자유 질의 매처에 위임한다.

import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";
import { sharedFaceFromEventGraphic, sharedFaceForCharset } from "@/project/sharedCharacterFaceResolver";
import { EASYRPG_RTP_ASSETS, charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { reconcileSharedFaceWithCharset as reconcileFaceWithCharset } from "@/project/sharedCharacterFaceResolver";
import { npcGraphicExampleLabels, pickNpcGraphic, queryNpcGraphics, type NpcGraphicPickOptions } from "@/assets/charsetQuery";
import { HARNESS_CHARACTER_PREFIX } from '@/project/sharedCharacters';
import { searchResources } from "@/assets/resourceSearch";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, FaceGraphic } from "@/project/types";
import { ToolError } from "./types";
import type { SimplePage, SimplePageChoice } from "./types";

const PASSIVE_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
// movement 를 안 준 페이지의 기본. 정지가 아니라 배회다 — AI 조수가 흔한 이름으로 NPC 를 깔았을 때
// 예전에는 전부 제자리에 얼어붙었다(2026-10-05 실측: place_npc 9개 중 7개 fixed).
// 제자리 이벤트가 필요하면 호출자가 movement:PASSIVE_MOVEMENT 를 명시한다.
const DEFAULT_NPC_MOVEMENT: EventPage["movement"] = { type: "random", speed: 2, frequency: 3 };
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
  | { readonly selectionId: string; readonly query?: string }
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
    // 번들 차셋 전부(스칼록시·농장 동물 포함). 빠지면 대응표에 행이 있는 닭·소를 place_npc 가 해석하지 못해 거절했다(2026-09-28).
    ...CHARSET_ASSETS.map((asset) => asset.textureKey),
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

function charsetKeyShape(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^tex/, "");
}

/** textureKey 자리에 시트 키가 아닌 라벨이 왔을 때 검색이 가리키는 시트와 칸. 시트 키면 null. */
function searchedCharsetSelection(input: string): CharsetGraphicSelection | null {
  const trimmed = input.trim();
  if (!trimmed || KNOWN_CHARSET_TEXTURE_KEYS.some((key) => key.toLowerCase() === trimmed.toLowerCase())) return null;
  const shape = charsetKeyShape(trimmed);
  if (shape && KNOWN_CHARSET_TEXTURE_KEYS.some((key) => charsetKeyShape(key) === shape)) return null;
  const top = searchResources("charset", trimmed)[0];
  return top ? parseCharsetSearchId(top.id) : null;
}

function resolveCharsetTextureKeyCandidate(input: string): string | null {
  const trimmed = input.trim();
  const exact = KNOWN_CHARSET_TEXTURE_KEYS.find((textureKey) => textureKey === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const folded = KNOWN_CHARSET_TEXTURE_KEYS.find((textureKey) => textureKey.toLowerCase() === lower);
  if (folded) return folded;
  // 리소스 id 표기(`easyrpg-charset-people1`)와 텍스처 키(`tex_easyrpg_charset_people1`)는 접두사·구분자만 다르다
  // (2026-09-24 헤드리스 「등대지기의 겨울」 place_npc 거부). 그 둘을 걷어 낸 모양이 키 하나에만 맞으면 그 키다.
  const shape = charsetKeyShape(trimmed);
  const shaped = KNOWN_CHARSET_TEXTURE_KEYS.filter((textureKey) => charsetKeyShape(textureKey) === shape);
  if (shape && shaped.length === 1) return shaped[0]!;
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
  // textureKey 자리에 「보물상자」 같은 라벨을 넣으면 검색이 칸까지 찾는다. 시트만 받고 칸을 0 으로 두면
  // 보물상자가 나무 문(object1#0)이 됐다(2026-09-27 전수 조사). 검색 결과의 칸을 함께 쓴다.
  const parsed = parseCharsetSearchId(textureKey) ?? searchedCharsetSelection(textureKey);
  const resolvedTextureKey = resolveCharsetTextureKey(textureKey);
  const resolvedCharacterIndex = parsed && (characterIndex === undefined || characterIndex === 0) ? parsed.characterIndex : characterIndex ?? 0;
  return { textureKey: resolvedTextureKey, characterIndex: resolvedCharacterIndex };
}

// textureKey + characterIndex → 아래방향 1프레임 그래픽.
export function charsetGraphic(textureKey: string, characterIndex: number | undefined = 0): EventPageGraphic {
  const graphic = resolveCharsetGraphicSelection(textureKey, characterIndex);
  return {
    sprite: { type: graphic.textureKey.startsWith(HARNESS_CHARACTER_PREFIX) ? "uploaded" : "bundled", id: graphic.textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: graphic.characterIndex, direction: "down", pattern: 1 }),
  };
}

// query 문자열을 별칭/자유 질의 매처로 해석해 charset 그래픽을 만든다.
export type GraphicQueryResolveOptions = NpcGraphicPickOptions;

export function resolveGraphicQuery(query: string, pick?: GraphicQueryResolveOptions): EventPageGraphic {
  // 못 찾으면 거절한다. 2026-09-18 부터 주민 그림으로 대체하고 경고만 남겼는데, 조수는 경고를 읽지 않아
  // 「가시덫」「경비병」「제단」이 전부 마을 사람으로 저장됐다(2026-09-27 전수 조사). 거절 문구에 후보를 준다.
  const entry = pickNpcGraphic(query, pick ?? {});
  if (!entry) {
    const examples = npcGraphicExampleLabels(12).join(", ");
    throw new ToolError(
      `그래픽 검색어에 맞는 charset 을 찾지 못했습니다: "${query}". 다른 그림으로 대체하지 않습니다. ` +
        `사람이면 list_npc_graphics 로 고르고, 물건이면 그 칸에 place_props·paint_tiles 로 물건 타일을 깔고 graphic:{transparent:true} 를 주세요. ` +
        `charset 라벨 예시: ${examples}.`,
      { code: "graphic-not-found" }
    );
  }
  return charsetGraphic(entry.textureKey, entry.characterIndex);
}

// GraphicSpec을 EventPageGraphic으로 변환.
export function resolveGraphic(spec: GraphicSpec | undefined, pick?: GraphicQueryResolveOptions): EventPageGraphic {
  if (!spec) return { transparent: true };
  if ("transparent" in spec) return { transparent: true };
  if ('selectionId' in spec) {
    const selected = parseCharsetSearchId(spec.selectionId);
    if (!selected || selected.characterIndex < 0 || selected.characterIndex > 7) throw new ToolError('selectionId는 칩 검색 결과의 charset:<시트>:<칸>이어야 합니다.', { code: 'graphic-not-found' });
    if (spec.query && !queryNpcGraphics(spec.query, 100, pick?.overrides).some(match => match.entry.textureKey === selected.textureKey && match.entry.characterIndex === selected.characterIndex)) {
      throw new ToolError(`selectionId ${spec.selectionId}는 요청한 외형 '${spec.query}'의 후보가 아닙니다. 같은 검색 결과의 selectionId를 쓰세요.`, { code: 'graphic-selection-mismatch' });
    }
    return charsetGraphic(selected.textureKey, selected.characterIndex);
  }
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
  const aliasFix = canonicalizeCommandFieldAlias(command);
  if (aliasFix) warnings?.push(`SimplePage 정규화: ${path}: ${aliasFix}`);
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
    const requested = options.face !== undefined ? options.face
      : page.face !== undefined ? faceFromSimplePage(page)
      : undefined;
    const face = requested === undefined ? sharedFaceFromEventGraphic(graphic)
      : requested === null ? null
      : explicitFaceForGraphic(requested, graphic, name, options.warnings);
    if (face) {
      commands.push({
        kind: "changeFace",
        resourceId: face.resourceId,
        position: face.position ?? "left",
        flipHorizontally: face.flipHorizontally ?? false,
      });
    } else if (requested === undefined) {
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
        branch: normalizeCommands(
          simpleChoiceCommands(choice, `${path}.choices[${choiceIndex}]`, options.warnings),
          `${path}.choices[${choiceIndex}].commands`,
          options.warnings,
        ),
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
    movement: options.movement ?? DEFAULT_NPC_MOVEMENT,
    commands,
  };
}

/**
 * SimplePage 선택지의 실행 명령. 정본 키는 `commands` 지만, 네이티브 choices 명령은 같은 자리를
 * `branch` 라고 부른다(upsert_event 예시·COMMAND_SCHEMA). 모델이 두 계약을 섞어 `branch` 로 보내면
 * 예전에는 경고 없이 버려져 선택지가 빈 분기가 됐다(2026-09-23 등대지기 재시험: 동료 합류·보스전
 * 분기 둘 다 `branch:[]`). 뜻이 하나로 정해지는 별칭만 옮기고 무엇을 옮겼는지 경고로 남긴다.
 */
const SIMPLE_CHOICE_COMMAND_ALIASES = ["branch", "then", "actions"] as const;

function simpleChoiceCommands(choice: SimplePageChoice, path: string, warnings: string[] | undefined): unknown {
  const record = choice as unknown as Record<string, unknown>;
  const aliased = SIMPLE_CHOICE_COMMAND_ALIASES.filter(key => record[key] !== undefined && record[key] !== null);
  if (aliased.length === 0) return choice.commands;
  const lists = [choice.commands, ...aliased.map(key => record[key])].filter(value => value !== undefined && value !== null);
  const flattened = lists.flatMap(value => Array.isArray(value) ? value : [value]);
  if (flattened.length > 0) {
    warnings?.push(`SimplePage 정규화: ${path}.${aliased.join("/")}를 선택지 commands로 읽었습니다(SimplePage 선택지의 정본 키는 commands).`);
  }
  return flattened;
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
  return faceFromArg(page.face);
}

/** 명시 얼굴을 이 페이지의 걷기 그림과 대조한다(reconcileFaceWithCharset). 투명·업로드 그림은 그대로 둔다. */
function explicitFaceForGraphic(face: FaceGraphic, graphic: EventPageGraphic, name: string, warnings: string[] | undefined): FaceGraphic | null {
  const sprite = graphic.transparent ? undefined : graphic.sprite;
  if (!sprite || sprite.type !== "bundled" || !sprite.id) return face;
  const characterIndex = decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex;
  const reconciled = reconcileFaceWithCharset(face.resourceId, sprite.id, characterIndex);
  if (reconciled.warning) warnings?.push(`NPC '${name}': ${reconciled.warning}`);
  return reconciled.faceResourceId === null ? null : { ...face, resourceId: reconciled.faceResourceId };
}

function faceFromArg(raw: unknown): FaceGraphic | null {
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

export { PASSIVE_MOVEMENT, DEFAULT_NPC_MOVEMENT };
