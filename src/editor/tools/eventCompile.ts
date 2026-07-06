// editor/tools/eventCompile.ts
// place_npc 등이 받는 고수준 입력(SimplePage/graphic.query)을 EventPage/graphic으로 컴파일한다.
// graphic.query 해석은 0-4 시맨틱(charsetSemantics)에 위임한다.
// (resourceSearch.ts가 도입되면 이 모듈의 resolveGraphic만 교체하면 된다.)

import { EASYRPG_RTP_ASSETS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import { searchResources } from "@/assets/resourceSearch";
import type { Command, EventPage, EventPageCondition, EventPageGraphic } from "@/project/types";
import { ToolError } from "./types";
import type { SimplePage } from "./types";

const PASSIVE_MOVEMENT: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

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

// query 문자열을 시맨틱 검색(resourceSearch)으로 해석해 charset 그래픽을 만든다.
// 결과 id 형식: "charset:<textureKey>:<characterIndex>".
export function resolveGraphicQuery(query: string): EventPageGraphic {
  const top = searchResources("charset", query)[0];
  if (!top) {
    throw new ToolError(
      `그래픽 검색어에 맞는 charset 리소스를 찾지 못했습니다: "${query}". list_resources(kind:"charset")로 후보를 조회하거나 graphic을 {textureKey, characterIndex}로 직접 지정하세요.`,
      { code: "graphic-not-found" }
    );
  }
  const parts = top.id.split(":");
  const textureKey = parts[1];
  const characterIndex = Number(parts[2]);
  if (!textureKey || !Number.isInteger(characterIndex)) {
    throw new ToolError(`charset 검색 결과 형식이 올바르지 않습니다: ${top.id}`, { code: "graphic-not-found" });
  }
  return charsetGraphic(textureKey, characterIndex);
}

// GraphicSpec을 EventPageGraphic으로 변환.
export function resolveGraphic(spec: GraphicSpec | undefined): EventPageGraphic {
  if (!spec) return { transparent: true };
  if ("transparent" in spec) return { transparent: true };
  if ("query" in spec) return resolveGraphicQuery(spec.query);
  return charsetGraphic(spec.textureKey, spec.characterIndex);
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

// SimplePage[] → EventPage[]. 각 페이지는 lines(대사) → choices → commands(원시) 순으로 합성한다.
export function compileSimplePages(
  idPrefix: string,
  name: string,
  pages: readonly SimplePage[],
  graphic: EventPageGraphic,
  options: { readonly movement?: EventPage["movement"]; readonly priority?: EventPage["priority"] } = {}
): EventPage[] {
  return pages.map((page, index) => compileSimplePage(`${idPrefix}_p${index}`, name, page, graphic, options));
}

export function compileSimplePage(
  id: string,
  name: string,
  page: SimplePage,
  graphic: EventPageGraphic,
  options: { readonly movement?: EventPage["movement"]; readonly priority?: EventPage["priority"] } = {}
): EventPage {
  const commands: Command[] = [];
  for (const line of pageLines(page)) commands.push(textCommand(name, line));
  if (page.choices && page.choices.length > 0) {
    commands.push({
      kind: "choices",
      options: page.choices.map((choice) => ({
        text: choice.text,
        branch: [...((choice.commands ?? []) as Command[])],
      })),
      cancelBehavior: "choice2",
    });
  }
  for (const command of page.commands ?? []) commands.push(command as Command);
  const priority = options.priority ?? "same";
  return {
    id,
    name,
    conditions: [...((page.conditions ?? []) as EventPageCondition[])],
    graphic,
    trigger: { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    movement: options.movement ?? PASSIVE_MOVEMENT,
    commands,
  };
}

export { PASSIVE_MOVEMENT };
