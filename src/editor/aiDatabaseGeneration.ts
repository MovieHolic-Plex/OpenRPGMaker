import { chatCompletion, type AiConfig, type ChatMessage, type ChatResult } from "@/ai/llmClient";
import { generateAiImage, type GeneratedImageAsset } from "@/ai/imageGenerationClient";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";

export type AiDatabaseKind = "enemy" | "item";

export interface AiDatabaseGenerationInput {
  readonly kind: AiDatabaseKind;
  readonly brief: string;
  readonly config: AiConfig;
  readonly withArtwork: boolean;
  readonly signal?: AbortSignal;
}

export interface AiDatabaseGenerationOutcome {
  readonly kind: AiDatabaseKind;
  readonly recordId: string;
  readonly name: string;
  readonly resourceId?: string;
  readonly artworkDataUrl?: string;
  readonly artworkModel?: string;
  readonly summary: string;
}

export interface AiDatabaseGenerationDeps {
  readonly complete?: (
    config: AiConfig,
    request: { messages: readonly ChatMessage[]; signal?: AbortSignal },
  ) => Promise<ChatResult>;
  readonly generateImage?: (request: { prompt: string; signal?: AbortSignal }) => Promise<GeneratedImageAsset>;
  readonly flattenArtwork?: (dataUrl: string) => Promise<string>;
  readonly applyCalls?: (
    calls: readonly { name: string; args: Record<string, unknown> }[],
    options: { summary: string; source: "agent" },
  ) => ToolResult[];
  readonly currentProject?: () => Project;
}

export class AiDatabaseGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiDatabaseGenerationError";
  }
}

const ITEM_FIELDS = [
  "name", "description", "price", "type", "scope", "occasion", "consumable", "hpRecovery", "mpRecovery",
] as const;
const ENEMY_FIELDS = ["name", "stats", "rewards", "graphicHue", "transparent", "flying"] as const;

const ITEM_CONTRACT = `{"name":"짧은 한국어 이름","description":"한국어 한두 문장","price":정수,`
  + `"type":"medicine|normalGoods|book|seed|special","scope":"none|ally|allAllies|enemy",`
  + `"occasion":"always|battle|field|never","consumable":true|false,`
  + `"hpRecovery":{"flat":정수,"percentMax":정수},"mpRecovery":{"flat":정수,"percentMax":정수}}`;
const ENEMY_CONTRACT = `{"name":"짧은 한국어 이름","stats":{"maxHp":정수,"maxMp":정수,"attack":정수,`
  + `"defense":정수,"mind":정수,"agility":정수},"rewards":{"exp":정수,"gold":정수,"dropRatePercent":정수}}`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * 한글 이름은 슬러그가 빈 문자열이 되므로(ASCII 만 남긴다) 순번으로 떨어진다.
 * 타임스탬프 base36 을 쓰면 `enemy_ai_genmtgadhmo` 같은 읽을 수 없는 id 가 목록에 남는다.
 */
export function generatedRecordId(kind: AiDatabaseKind, name: string, taken: readonly string[]): string {
  const prefix = kind === "item" ? "item" : "enemy";
  const slug = slugify(name);
  if (slug) {
    const base = `${prefix}_ai_${slug}`;
    if (!taken.includes(base)) return base;
    let index = 2;
    while (taken.includes(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }
  let index = 1;
  while (taken.includes(`${prefix}_ai_${index}`)) index += 1;
  return `${prefix}_ai_${index}`;
}

export function buildRecordPrompt(kind: AiDatabaseKind, brief: string, existingNames: readonly string[]): ChatMessage[] {
  const contract = kind === "item" ? ITEM_CONTRACT : ENEMY_CONTRACT;
  const role = kind === "item" ? "아이템" : "몬스터(적)";
  return [
    {
      role: "system",
      content: [
        `너는 2D 탑뷰 JRPG 메이커의 데이터베이스 저작 보조다. ${role} 레코드 하나를 만든다.`,
        "출력은 JSON 객체 하나만. 코드펜스·설명·주석을 붙이지 마라.",
        `스키마: ${contract}`,
        "모르는 필드를 추가하지 마라. 수치는 초반~중반 난이도에 맞는 상식적인 값으로 정한다.",
        existingNames.length > 0 ? `이미 있는 이름(중복 금지): ${existingNames.slice(0, 40).join(", ")}` : "",
      ].filter(Boolean).join("\n"),
    },
    { role: "user", content: brief },
  ];
}

export function artworkPromptFor(kind: AiDatabaseKind, name: string, brief: string): string {
  const subject = `${name} — ${brief}`;
  return kind === "item"
    ? `A single 2D JRPG inventory item icon of ${subject}. Centered, front view, clean thick outline,`
      + ` flat saturated colors, no text, no frame, no shadow, on a pure flat white background.`
    : `A single 2D JRPG battle monster sprite of ${subject}. Full body, centered, front view facing the viewer,`
      + ` clean thick outline, flat saturated colors, no text, no ground shadow, on a pure flat white background.`;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
}

function firstJsonObject(text: string): string {
  const source = stripFence(text);
  const start = source.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

export function parseGeneratedRecord(kind: AiDatabaseKind, raw: string): Record<string, unknown> {
  const json = firstJsonObject(raw);
  if (!json) throw new AiDatabaseGenerationError("AI 응답에서 JSON 객체를 찾지 못했습니다.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new AiDatabaseGenerationError("AI 응답의 JSON 을 해석하지 못했습니다.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AiDatabaseGenerationError("AI 응답이 JSON 객체가 아닙니다.");
  }
  const allowed: readonly string[] = kind === "item" ? ITEM_FIELDS : ENEMY_FIELDS;
  const source = parsed as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (source[key] !== undefined) patch[key] = source[key];
  }
  const name = typeof patch.name === "string" ? patch.name.trim() : "";
  if (!name) throw new AiDatabaseGenerationError("AI 응답에 name 이 없습니다.");
  patch.name = name;
  return patch;
}

export function existingNamesOf(project: Project, kind: AiDatabaseKind): string[] {
  const list = kind === "item" ? project.database.items : project.database.enemies;
  return list.map((entry) => entry.name).filter((name) => name.length > 0);
}

export function toolCallsForGeneration(input: {
  readonly kind: AiDatabaseKind;
  readonly recordId: string;
  readonly patch: Record<string, unknown>;
  readonly artwork?: { readonly resourceId: string; readonly dataUrl: string };
}): { name: string; args: Record<string, unknown> }[] {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const record: Record<string, unknown> = { ...input.patch, id: input.recordId };
  if (input.artwork) {
    calls.push({
      name: "upsert_resource",
      args: {
        resource: {
          id: input.artwork.resourceId,
          name: `${String(input.patch.name)} (AI)`,
          kind: input.kind === "item" ? "picture" : "monster",
          dataUrl: input.artwork.dataUrl,
        },
      },
    });
    if (input.kind === "item") record.iconResourceId = input.artwork.resourceId;
    else record.monsterResourceId = input.artwork.resourceId;
  }
  calls.push(
    input.kind === "item"
      ? { name: "upsert_item", args: { item: record } }
      : { name: "upsert_enemy", args: { enemy: record } },
  );
  return calls;
}

export async function generateDatabaseRecordWithAi(
  input: AiDatabaseGenerationInput,
  deps: AiDatabaseGenerationDeps = {},
): Promise<AiDatabaseGenerationOutcome> {
  const brief = input.brief.trim();
  if (!brief) throw new AiDatabaseGenerationError("만들 대상 설명을 입력하세요.");

  const complete = deps.complete ?? chatCompletion;
  const currentProject = deps.currentProject ?? (() => store.getCurrent());
  const applyCalls = deps.applyCalls ?? applyToolSequenceToStore;

  const project = currentProject();
  const result = await complete(input.config, {
    messages: buildRecordPrompt(input.kind, brief, existingNamesOf(project, input.kind)),
    signal: input.signal,
  });
  const answer = typeof result.message.content === "string"
    ? result.message.content
    : (result.message.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
  const patch = parseGeneratedRecord(input.kind, answer);
  const name = String(patch.name);

  const takenIds = (input.kind === "item" ? project.database.items : project.database.enemies).map((entry) => entry.id);
  const recordId = generatedRecordId(input.kind, name, takenIds);

  let artwork: { resourceId: string; dataUrl: string } | undefined;
  let artworkModel: string | undefined;
  if (input.withArtwork) {
    const generateImage = deps.generateImage ?? ((request) => generateAiImage(request));
    const image = await generateImage({ prompt: artworkPromptFor(input.kind, name, brief), signal: input.signal });
    const flattened = deps.flattenArtwork ? await deps.flattenArtwork(image.dataUrl) : image.dataUrl;
    artwork = { resourceId: `${recordId}_art`, dataUrl: flattened };
    artworkModel = image.model;
  }

  if (input.signal?.aborted) {
    throw new AiDatabaseGenerationError("생성을 취소했습니다. 프로젝트에는 아무것도 쓰지 않았습니다.");
  }

  const calls = toolCallsForGeneration({ kind: input.kind, recordId, patch, artwork });
  const summary = `AI ${input.kind === "item" ? "아이템" : "몬스터"} 생성: ${name}`;
  const results = applyCalls(calls, { summary, source: "agent" });
  const failed = results.find((entry) => !entry.ok);
  if (failed) throw new AiDatabaseGenerationError(`적용 실패: ${failed.summary}`);

  return {
    kind: input.kind,
    recordId,
    name,
    resourceId: artwork?.resourceId,
    artworkDataUrl: artwork?.dataUrl,
    artworkModel,
    summary,
  };
}
