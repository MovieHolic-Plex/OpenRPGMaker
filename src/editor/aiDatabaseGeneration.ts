import { chatCompletion, type AiConfig, type ChatMessage, type ChatResult } from "@/ai/llmClient";
import { MONSTER_CATALOG } from "@/assets/monsterCatalog";
import { PIXEL_ENEMY_PORTRAIT_URLS } from "@/assets/pixelEnemyPortraits";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
import type { WorldCanon } from "@/project/world/canon";
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

export type AiDatabaseGenerationPhase = "text" | "artwork" | "apply";

export interface AiDatabaseGenerationDeps {
  /** 단계 전환 알림 — 대화상자가 「정보 → 그림 → 등록」 을 보여 줄 수 있게. 실패해도 생성은 계속된다. */
  readonly onPhase?: (phase: AiDatabaseGenerationPhase) => void;
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
const ENEMY_FIELDS = ["name", "stats", "rewards", "monsterResourceId"] as const;

const ITEM_CONTRACT = `{"name":"짧은 한국어 이름","description":"한국어 한두 문장","price":정수,`
  + `"type":"medicine|normalGoods|book|seed|special","scope":"none|ally|allAllies|enemy",`
  + `"occasion":"always|battle|field|never","consumable":true|false,`
  + `"hpRecovery":{"flat":정수,"percentMax":정수},"mpRecovery":{"flat":정수,"percentMax":정수}}`;
const ENEMY_CONTRACT = `{"name":"짧은 한국어 이름","monsterResourceId":"아래 도트 몬스터 id 중 하나","stats":{"maxHp":정수,"maxMp":정수,"attack":정수,`
  + `"defense":정수,"mind":정수,"agility":정수},"rewards":{"exp":정수,"gold":정수,"dropRatePercent":정수}}`;

/**
 * 몬스터 그림은 만들지 않는다(2026-10-02) — 전투는 도트 측면이라 도트 시트 140종 중 하나를 고르게 한다.
 * 목록은 「id: 이름」 한 줄씩.
 */
function pixelMonsterChoices(): string {
  return Object.keys(PIXEL_ENEMY_PORTRAIT_URLS)
    .map((id) => `${id}: ${MONSTER_CATALOG[id]?.name ?? id}`)
    .join("\n");
}

const FALLBACK_PIXEL_MONSTER_ID = "generated-enemy-slime-01";

/** 목록 밖 id 는 id·이름 조각이 겹치는 도트 몬스터로, 못 찾으면 슬라임으로 맞춘다. */
function pickPixelMonsterId(raw: string, name: string): string {
  if (PIXEL_ENEMY_PORTRAIT_URLS[raw]) return raw;
  const words = `${raw} ${name}`.toLowerCase().split(/[^a-z0-9가-힣]+/u).filter((word) => word.length >= 2 && word !== "generated" && word !== "enemy");
  const ids = Object.keys(PIXEL_ENEMY_PORTRAIT_URLS);
  const hit = ids.find((id) => words.some((word) => id.includes(word) || (MONSTER_CATALOG[id]?.name ?? "").includes(word)));
  return hit ?? FALLBACK_PIXEL_MONSTER_ID;
}

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

export function buildRecordPrompt(
  kind: AiDatabaseKind,
  brief: string,
  existingNames: readonly string[],
  canon?: WorldCanon,
): ChatMessage[] {
  const contract = kind === "item" ? ITEM_CONTRACT : ENEMY_CONTRACT;
  const role = kind === "item" ? "아이템" : "몬스터(적)";
  const canonSection = worldCanonPromptSection(canon);
  return [
    {
      role: "system",
      content: [
        `너는 2D 탑뷰 JRPG 메이커의 데이터베이스 저작 보조다. ${role} 레코드 하나를 만든다.`,
        "출력은 JSON 객체 하나만. 코드펜스·설명·주석을 붙이지 마라.",
        `스키마: ${contract}`,
        "모르는 필드를 추가하지 마라. 수치는 초반~중반 난이도에 맞는 상식적인 값으로 정한다.",
        kind === "enemy" ? `monsterResourceId 는 설명에 가장 맞는 것을 이 목록에서만 고른다:\n${pixelMonsterChoices()}` : "",
        existingNames.length > 0 ? `이미 있는 이름(중복 금지): ${existingNames.slice(0, 40).join(", ")}` : "",
        canonSection ?? "",
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
    : `A pixel side-view battle monster of ${subject}.`; // 몬스터 그림은 생성하지 않는다(호환용 문장).
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

export function parseGeneratedRecord(kind: AiDatabaseKind, raw: string, canon?: WorldCanon): Record<string, unknown> {
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
  if (kind === "enemy") {
    patch.monsterResourceId = pickPixelMonsterId(typeof patch.monsterResourceId === "string" ? patch.monsterResourceId.trim() : "", name);
  }
  // 허용 필드 화이트리스트가 자르기 전 원시 응답 기준으로 검사한다 — 적 스키마에는
  // description 이 없어서 필터 뒤에는 금지어가 이미 사라져 있다.
  const rawDescription = typeof source.description === "string" ? source.description : "";
  const hits = findWorldCanonAbsenceHits(`${name} ${rawDescription}`, canon);
  if (hits.length > 0) {
    throw new AiDatabaseGenerationError(`「이 세계」에 없는 것을 썼습니다 — 빼고 다시 만드세요: ${hits.join(", ")}`);
  }
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

  const notify = (phase: AiDatabaseGenerationPhase): void => {
    try {
      deps.onPhase?.(phase);
    } catch {
      // 진행 표시 실패가 생성 자체를 막으면 안 된다.
    }
  };

  const project = currentProject();
  notify("text");
  const result = await complete(input.config, {
    messages: buildRecordPrompt(input.kind, brief, existingNamesOf(project, input.kind), project.worldCanon),
    signal: input.signal,
  });
  const answer = typeof result.message.content === "string"
    ? result.message.content
    : (result.message.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
  const patch = parseGeneratedRecord(input.kind, answer, project.worldCanon);
  const name = String(patch.name);

  const takenIds = (input.kind === "item" ? project.database.items : project.database.enemies).map((entry) => entry.id);
  const recordId = generatedRecordId(input.kind, name, takenIds);

  let artwork: { resourceId: string; dataUrl: string } | undefined;
  let artworkModel: string | undefined;
  // 그림은 아이템 아이콘만 만든다. 몬스터는 고른 도트 몬스터의 정지 그림을 보여 준다.
  if (input.withArtwork && input.kind === "item") {
    notify("artwork");
    const generateImage = deps.generateImage ?? ((request) => generateAiImage(request));
    const image = await generateImage({ prompt: artworkPromptFor(input.kind, name, brief), signal: input.signal });
    const flattened = deps.flattenArtwork ? await deps.flattenArtwork(image.dataUrl) : image.dataUrl;
    artwork = { resourceId: `${recordId}_art`, dataUrl: flattened };
    artworkModel = image.model;
  }

  if (input.signal?.aborted) {
    throw new AiDatabaseGenerationError("생성을 취소했습니다. 프로젝트에는 아무것도 쓰지 않았습니다.");
  }

  notify("apply");
  const calls = toolCallsForGeneration({ kind: input.kind, recordId, patch, artwork });
  const summary = `AI ${input.kind === "item" ? "아이템" : "몬스터"} 생성: ${name}`;
  const results = applyCalls(calls, { summary, source: "agent" });
  const failed = results.find((entry) => !entry.ok);
  if (failed) throw new AiDatabaseGenerationError(`적용 실패: ${failed.summary}`);

  return {
    kind: input.kind,
    recordId,
    name,
    resourceId: artwork?.resourceId ?? (input.kind === "enemy" ? String(patch.monsterResourceId) : undefined),
    artworkDataUrl: artwork?.dataUrl ?? (input.kind === "enemy" ? PIXEL_ENEMY_PORTRAIT_URLS[String(patch.monsterResourceId)] : undefined),
    artworkModel,
    summary,
  };
}
