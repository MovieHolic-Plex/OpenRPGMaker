import { normalizeWorld } from "@/project/world/guards";
import { lintWorld } from "@/project/world/lint";
import {
  WORLD_ENTITY_TYPES,
  WORLD_REF_KINDS,
  WORLD_RELATION_KINDS,
  type ProjectWorld,
  type WikiSource,
  type WorldEntity,
  type WorldEntityType,
  type WorldRef,
  type WorldRelation,
  type WorldRelationKind,
} from "@/project/world/types";
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";

/**
 * 설정집(project.world) 쓰기 도구.
 *
 * 전에는 설정집에 쓰는 길이 대화 추출기(projectWikiCoordinator → applyProjectWikiPatch)와 화면의 수동 편집뿐이었다.
 * 조수가 장소·세력·인물·사건·용어 문서를 직접 넣고 고칠 수 없어서, 코드로 짓는 데모는 설정집이 늘 비었다(2026-10-29).
 *
 * 계약:
 * - 문서는 id 로 덮어쓴다(같은 id = 같은 문서 고치기). 잠긴 문서(locked)는 고치지 않는다.
 * - 출처는 manual 한 줄로 남긴다(kind knowledge · basis explicit). manual 출처가 붙은 문서는 대화 추출기가 덮지 못한다
 *   (wiki.ts protectedDocument) — 작가가 정한 설정이 자동 기록에 밀리지 않는다.
 * - visibility "ai-hidden" 은 작가 전용 비밀(반전·아직 밝히지 않은 진실)이다. 조수·대사 작성기 입력에서 빠진다(visibility.ts).
 * - 관계는 (a, b, kind) 로 같은 줄을 찾아 메모만 바꾼다. 없는 문서를 가리키는 관계는 거절한다.
 * - refs 가 가리키는 맵·이벤트·아이템·스킬·액터가 없으면 거절한다(lintWorld world-ref-missing).
 */

const MAX_ENTRIES = 32;
const MAX_RELATIONS = 64;

const REF_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...WORLD_REF_KINDS] },
    id: { type: "string" },
  },
  required: ["kind", "id"],
  additionalProperties: false,
};

const ENTRY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "문서 id. 영문·숫자·밑줄 권장(w_ 접두사는 자동). 같은 id 를 다시 보내면 그 문서를 고친다." },
    type: { type: "string", enum: [...WORLD_ENTITY_TYPES], description: "character 인물 · place 장소 · faction 세력 · event 사건 · item 물건 · concept 용어·전승 · guideline 제작 노트" },
    name: { type: "string", maxLength: 120 },
    summary: { type: "string", maxLength: 400, description: "카드에 보이는 한두 문장." },
    body: { type: "string", maxLength: 20_000, description: "본문. 문단은 빈 줄로 나눈다." },
    tags: { type: "array", items: { type: "string", maxLength: 40 } },
    refs: { type: "array", items: REF_SCHEMA, description: "이 문서가 가리키는 실제 게임 개체(맵·이벤트·아이템·스킬·액터)." },
    visibility: { type: "string", enum: ["public", "ai-hidden"], description: "ai-hidden = 작가 전용 비밀(반전·아직 밝히지 않은 진실). 조수에게도 보이지 않는다." },
    source: { type: "string", maxLength: 400, description: "근거 한 줄(대본 절·대사·기획 문서). 생략하면 도구 이름만 남는다." },
  },
  required: ["id", "type", "name", "summary"],
  additionalProperties: false,
};

const RELATION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    a: { type: "string" },
    b: { type: "string" },
    kind: { type: "string", enum: [...WORLD_RELATION_KINDS], description: "memberOf 소속 · locatedIn 위치 · knows 아는 사이 · enemyOf 적 · allyOf 편 · causedBy 원인 · owns 소유 · custom(note 필수)" },
    note: { type: "string", maxLength: 200 },
  },
  required: ["a", "b", "kind"],
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, max: number, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && value.trim().length === 0)) {
    throw new ToolError(`${label}는 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  const clean = value.trim();
  if (clean.length > max) throw new ToolError(`${label}는 ${max}자 이하여야 합니다.`, { code: "invalid-args" });
  return clean || undefined;
}

function worldId(value: string): string {
  return value.startsWith("w_") ? value : `w_${value}`;
}

function parseRefs(value: unknown, label: string): WorldRef[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError(`${label}는 배열이어야 합니다.`, { code: "invalid-args" });
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.kind !== "string" || !(WORLD_REF_KINDS as readonly string[]).includes(entry.kind) || typeof entry.id !== "string" || !entry.id.trim()) {
      throw new ToolError(`${label}[${index}] 는 {kind:${WORLD_REF_KINDS.join("|")}, id} 여야 합니다.`, { code: "invalid-args" });
    }
    return { kind: entry.kind as WorldRef["kind"], id: entry.id.trim() };
  });
}

function parseTags(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new ToolError(`${label}는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  }
  const tags = [...new Set(value.map((tag) => (tag as string).trim()).filter(Boolean))];
  return tags.length > 0 ? tags : undefined;
}

/** 다음 출처 순번 — 기존 출처의 at 최댓값 다음. 같은 입력이면 같은 결과(굽기 재현). */
function nextSourceAt(world: ProjectWorld): number {
  let max = 0;
  for (const entity of world.entities) for (const source of entity.wiki?.sources ?? []) max = Math.max(max, source.at);
  return Math.floor(max) + 1;
}

function sameRelation(left: WorldRelation, right: Pick<WorldRelation, "a" | "b" | "kind">): boolean {
  return left.a === right.a && left.b === right.b && left.kind === right.kind;
}

export const UPSERT_WORLD_CODEX_TOOL: ToolDefinition = {
  name: "upsert_world_codex",
  description: "설정집(자료집 → 이야기 → 설정집) 문서를 넣거나 고친다. 장소·세력·인물·사건·물건·용어 문서와 그 사이 관계를 한 번에 최대 32개 저장한다. "
    + "같은 id 를 다시 보내면 그 문서를 통째로 고친다(보내지 않은 칸은 지워진다 — 고칠 때도 name·summary 를 함께 보낸다). 잠긴 문서는 못 고친다. "
    + "세계 전체의 뼈대(이름·전제·톤·법칙)는 set_world_canon, 말하는 인물의 이름 색·목소리는 upsert_character_profile 이고, 이 도구는 그 밖의 세부 설정을 문서로 남긴다. "
    + "반전·아직 밝히지 않은 진실은 visibility:\"ai-hidden\" 으로 따로 둔다. refs 로 실제 맵·이벤트·아이템·액터를 이으면 설정집에서 바로 그 개체로 간다.",
  mode: "write",
  domains: ["world", "database"],
  parameters: {
    type: "object",
    properties: {
      entries: { type: "array", items: ENTRY_SCHEMA, maxItems: MAX_ENTRIES },
      relations: { type: "array", items: RELATION_SCHEMA, maxItems: MAX_RELATIONS, description: "a·b 는 문서 id(이번 entries 또는 이미 있는 문서)." },
    },
    additionalProperties: false,
  },
  invalidArgsExample: {
    entries: [{ id: "place_harbor", type: "place", name: "버들 항구", summary: "강 하구의 작은 항구 마을.", tags: ["마을"] }],
    relations: [{ a: "place_harbor", b: "faction_guild", kind: "custom", note: "길드 본부가 있다" }],
  },
  run(draft, args) {
    const rawEntries = args.entries === undefined ? [] : args.entries;
    const rawRelations = args.relations === undefined ? [] : args.relations;
    if (!Array.isArray(rawEntries) || !Array.isArray(rawRelations)) {
      throw new ToolError("entries·relations 는 배열이어야 합니다.", { code: "invalid-args" });
    }
    if (rawEntries.length === 0 && rawRelations.length === 0) {
      throw new ToolError("entries 나 relations 중 하나는 있어야 합니다.", { code: "invalid-args" });
    }
    if (rawEntries.length > MAX_ENTRIES) throw new ToolError(`entries 는 한 번에 ${MAX_ENTRIES}개까지입니다.`, { code: "invalid-args" });
    if (rawRelations.length > MAX_RELATIONS) throw new ToolError(`relations 는 한 번에 ${MAX_RELATIONS}개까지입니다.`, { code: "invalid-args" });

    const world: ProjectWorld = draft.world ?? { entities: [], relations: [] };
    let at = nextSourceAt(world);
    const written = new Map<string, WorldEntity>();
    const created: string[] = [];
    const updated: string[] = [];

    rawEntries.forEach((raw: unknown, index: number) => {
      const label = `entries[${index}]`;
      if (!isRecord(raw)) throw new ToolError(`${label} 는 객체여야 합니다.`, { code: "invalid-args" });
      const id = worldId(text(raw.id, `${label}.id`, 120, true)!);
      if (written.has(id)) throw new ToolError(`${label}.id 가 이번 호출 안에서 겹칩니다: ${id}`, { code: "invalid-args" });
      if (typeof raw.type !== "string" || !(WORLD_ENTITY_TYPES as readonly string[]).includes(raw.type)) {
        throw new ToolError(`${label}.type 은 ${WORLD_ENTITY_TYPES.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
      }
      const visibility = raw.visibility === undefined ? "public" : raw.visibility;
      if (visibility !== "public" && visibility !== "ai-hidden") {
        throw new ToolError(`${label}.visibility 는 public 또는 ai-hidden 입니다.`, { code: "invalid-args" });
      }
      const existing = world.entities.find((entity) => entity.id === id);
      if (existing?.locked) {
        throw new ToolError(`잠긴 설정집 문서는 고칠 수 없습니다: ${id} (${existing.name}). 화면에서 잠금을 푼 뒤 다시 시도하세요.`, { code: "locked" });
      }
      const name = text(raw.name, `${label}.name`, 120, true)!;
      const summary = text(raw.summary, `${label}.summary`, 400, true)!;
      const body = text(raw.body, `${label}.body`, 20_000, false);
      const tags = parseTags(raw.tags, `${label}.tags`);
      const refs = parseRefs(raw.refs, `${label}.refs`);
      const sourceNote = text(raw.source, `${label}.source`, 400, false);
      const source: WikiSource = {
        id: `codex_${id.slice(2)}_${at}`,
        kind: "manual",
        text: [`upsert_world_codex · ${name}`, sourceNote].filter(Boolean).join("\n"),
        at,
      };
      at += 1;
      const entity: WorldEntity = {
        id,
        type: raw.type as WorldEntityType,
        name,
        summary,
        ...(body ? { body } : {}),
        ...(tags ? { tags } : {}),
        ...(refs && refs.length > 0 ? { refs } : {}),
        // 사람이 만든 문서를 조수가 고쳐도 출처(origin)는 사람으로 남는다.
        origin: existing?.origin ?? "ai",
        ...(visibility === "ai-hidden" ? { visibility: "ai-hidden" as const } : {}),
        wiki: { kind: "knowledge", basis: "explicit", sources: [source] },
      };
      written.set(id, entity);
      (existing ? updated : created).push(id);
    });

    const entities = world.entities.map((entity) => written.get(entity.id) ?? entity);
    for (const [id, entity] of written) if (!world.entities.some((existing) => existing.id === id)) entities.push(entity);
    // 고친 문서가 옛 판본을 대체(supersedes)한다고 적혀 있던 줄은 그대로 둔다 — 대체 관계는 대화 추출기의 몫이다.
    const knownIds = new Set(entities.map((entity) => entity.id));

    const relations: WorldRelation[] = [...world.relations];
    rawRelations.forEach((raw: unknown, index: number) => {
      const label = `relations[${index}]`;
      if (!isRecord(raw)) throw new ToolError(`${label} 는 객체여야 합니다.`, { code: "invalid-args" });
      const a = worldId(text(raw.a, `${label}.a`, 120, true)!);
      const b = worldId(text(raw.b, `${label}.b`, 120, true)!);
      if (typeof raw.kind !== "string" || !(WORLD_RELATION_KINDS as readonly string[]).includes(raw.kind)) {
        throw new ToolError(`${label}.kind 는 ${WORLD_RELATION_KINDS.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
      }
      for (const end of [a, b]) {
        if (!knownIds.has(end)) throw new ToolError(`${label} 가 없는 문서를 가리킵니다: ${end}. 먼저 entries 로 만들거나 기존 문서 id 를 쓰세요.`, { code: "reference-not-found" });
      }
      if (a === b) throw new ToolError(`${label} 는 자기 자신과 이을 수 없습니다: ${a}`, { code: "invalid-args" });
      const kind = raw.kind as WorldRelationKind;
      const note = text(raw.note, `${label}.note`, 200, false);
      if (kind === "custom" && !note) throw new ToolError(`${label}: custom 관계는 note 가 필요합니다.`, { code: "invalid-args" });
      const relation: WorldRelation = { a, b, kind, ...(note ? { note } : {}) };
      const at2 = relations.findIndex((existing) => sameRelation(existing, relation));
      if (at2 >= 0) relations[at2] = relation;
      else relations.push(relation);
    });

    let next: ProjectWorld;
    try {
      next = normalizeWorld({ entities, relations });
    } catch (error) {
      throw new ToolError(`설정집을 저장하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, { code: "invalid-args" });
    }
    const missing = lintWorld({ entities: [...written.values()], relations: [] }, draft).filter((issue) => issue.code === "world-ref-missing");
    if (missing.length > 0) {
      throw new ToolError(missing.map((issue) => issue.message).join("; "), { code: "reference-not-found" });
    }
    draft.world = next;
    const hidden = [...written.values()].filter((entity) => entity.visibility === "ai-hidden").length;
    return {
      summary: `설정집 저장 — 새 문서 ${created.length}개 · 고친 문서 ${updated.length}개 · 관계 ${rawRelations.length}줄${hidden ? ` · 작가 전용 ${hidden}개` : ""} (전체 ${next.entities.length}개)`,
      data: { created, updated, relationCount: next.relations.length, entityCount: next.entities.length },
    };
  },
};

export const WORLD_CODEX_TOOLS: readonly ToolDefinition[] = [UPSERT_WORLD_CODEX_TOOL];
