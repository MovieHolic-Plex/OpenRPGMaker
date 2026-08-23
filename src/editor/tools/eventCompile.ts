// editor/tools/eventCompile.ts
// place_npc 등이 받는 고수준 입력(SimplePage/graphic.query)을 EventPage/graphic으로 컴파일한다.
// graphic.query 해석은 charsetQuery의 별칭/자유 질의 매처에 위임한다.

import { faceGraphicFromEventGraphic, faceGraphicForCharset } from "@/assets/charsetFaceMap";
import { EASYRPG_RTP_ASSETS, charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { npcGraphicExampleLabels, pickNpcGraphic, type NpcGraphicPickOptions } from "@/assets/charsetQuery";
import { searchResources } from "@/assets/resourceSearch";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, FaceGraphic } from "@/project/types";
import { ToolError } from "./types";
import type { SimplePage } from "./types";

const PASSIVE_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const COMMAND_KIND_SET: ReadonlySet<string> = new Set(COMMAND_KINDS);
const CONDITION_KIND_SET: ReadonlySet<string> = new Set(CONDITION_KINDS);
const SIMPLE_PAGE_EXAMPLE = `{"pages":[{"lines":["안녕하세요"],"conditions":[],"commands":[{"kind":"text","body":"안녕하세요"}]}]}`;

type EventCompileOptions = {
  readonly movement?: EventPage["movement"];
  readonly priority?: EventPage["priority"];
  readonly warnings?: string[];
  readonly path?: string;
  /** 대화 시 표시할 페이스. 생략 시 graphic charset에서 자동 매핑. */
  readonly face?: FaceGraphic | null;
  /** false면 changeFace를 넣지 않음(기본 true: NPC 대사는 페이스 필수). */
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
export function resolveGraphicQuery(query: string, pick?: NpcGraphicPickOptions): EventPageGraphic {
  const entry = pickNpcGraphic(query, pick ?? {});
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
export function resolveGraphic(spec: GraphicSpec | undefined, pick?: NpcGraphicPickOptions): EventPageGraphic {
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
  return new ToolError(
    `SimplePage 인자 오류: 필드: ${path}; 기대 타입: ${expected}; 실제 타입: ${describeValue(actual)}; 최소 예시: ${SIMPLE_PAGE_EXAMPLE}`,
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
  const kind = typeof rawKind === "string" ? rawKind : recoverCommandKind(command, path, warnings);
  if (!kind) {
    throw simplePageFieldError(`${path}.kind`, "string", rawKind);
  }
  command.kind = kind;
  if (!COMMAND_KIND_SET.has(kind)) {
    throw simplePageFieldError(`${path}.kind`, "known command kind string", kind);
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

function normalizeCondition(raw: unknown, path: string): EventPageCondition {
  if (!isRecord(raw)) throw simplePageFieldError(path, "EventPageCondition object", raw);
  if (typeof raw.kind !== "string") throw simplePageFieldError(`${path}.kind`, "string", raw.kind);
  if (!CONDITION_KIND_SET.has(raw.kind)) {
    throw simplePageFieldError(`${path}.kind`, "known condition kind string", raw.kind);
  }
  try {
    validateConditionShape(path, raw);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw simplePageShapeError(path, "valid EventPageCondition object", raw, detail);
  }
  return raw as EventPageCondition;
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
  return values.map((value, index) => normalizeCondition(value, `${path}[${index}]`));
}

// SimplePage[] → EventPage[]. 각 페이지는 lines(대사) → choices → commands(원시) 순으로 합성한다.
export function compileSimplePages(
  idPrefix: string,
  name: string,
  pages: readonly SimplePage[],
  graphic: EventPageGraphic,
  options: EventCompileOptions = {}
): EventPage[] {
  return pages.map((page, index) => compileSimplePage(`${idPrefix}_p${index}`, name, page, graphic, { ...options, path: `pages[${index}]` }));
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
  // NPC 대화에 페이스 타일 그림판 필수 — graphic charset → faceset 자동 매핑 (명시 face 우선)
  const injectFace = options.injectFace !== false;
  if (injectFace && hasText) {
    const face = options.face
      ?? faceFromSimplePage(page)
      ?? faceGraphicFromEventGraphic(graphic);
    if (face) {
      commands.push({
        kind: "changeFace",
        resourceId: face.resourceId,
        faceIndex: face.faceIndex,
        position: face.position ?? "left",
        flipHorizontally: face.flipHorizontally ?? false,
      });
    } else {
      options.warnings?.push(
        `NPC '${name}' 페이스 매핑 실패 — charset graphic에 대응 faceset이 없다. graphic을 people1/2·actor1/2로 지정하라.`,
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
  return {
    id,
    name,
    conditions: normalizeConditions(page.conditions, `${path}.conditions`, options.warnings),
    graphic,
    trigger: { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    movement: options.movement ?? PASSIVE_MOVEMENT,
    commands,
  };
}

function faceFromSimplePage(page: SimplePage): FaceGraphic | null {
  const raw = page.face;
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.resourceId === "string" && rec.resourceId.trim()) {
    return {
      resourceId: rec.resourceId.trim(),
      faceIndex: typeof rec.faceIndex === "number" ? rec.faceIndex : 0,
      position: rec.position === "right" ? "right" : "left",
      flipHorizontally: rec.flipHorizontally === true,
    };
  }
  if (typeof rec.textureKey === "string") {
    return faceGraphicForCharset(
      rec.textureKey,
      typeof rec.characterIndex === "number" ? rec.characterIndex : 0,
    );
  }
  return null;
}

export { PASSIVE_MOVEMENT };
