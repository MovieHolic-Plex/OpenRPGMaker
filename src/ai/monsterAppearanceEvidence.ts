import { getMonsterResource } from "@/assets/monsterResourceCatalog";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import type { ChatMessage } from "./llmClient";

export const MONSTER_READ_TOOLS = ["list_monster_resources", "get_monster_resource"] as const;
export const MONSTER_APPEARANCE_WRITERS = ["upsert_enemy", "define_monster_species", "make_action_enemy"] as const;

// Bounded exclusion policy, not a species classifier. Unknown authored identity words remain legal.
const GENERIC_APPEARANCE_WORDS: ReadonlySet<string> = new Set([
  "monster", "monsters", "enemy", "enemies", "creature", "beast", "animal", "humanoid", "undead", "boss", "minion",
  "몬스터", "괴물", "적", "생물", "야수", "동물", "인간형", "언데드", "보스", "졸개",
  "green", "red", "blue", "yellow", "black", "white", "gray", "grey", "brown", "purple", "pink", "orange",
  "초록", "초록색", "녹색", "빨강", "빨간색", "붉은", "파랑", "파란색", "노랑", "노란색", "검정", "검은색", "흰색", "하양", "회색", "갈색", "보라", "보라색", "분홍", "분홍색", "주황", "주황색",
  "small", "large", "big", "tiny", "cute", "flying", "작은", "큰", "귀여운", "비행",
  "generated", "uploaded", "upload", "profile", "asset", "resource", "a", "an", "the", "and",
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function normalizeTag(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
function failure(code: string, summary: string): ToolResult {
  return { ok: false, summary, issues: [{ severity: "error", code, message: summary }] };
}

/** Request-local snapshots of full metadata actually delivered to the model. */
export class MonsterAppearanceEvidence {
  private readonly full = new Map<string, string>();
  private readonly pendingCalls = new Map<string, string>();

  clear(): void { this.full.clear(); this.pendingCalls.clear(); }

  executed(callId: string, result: ToolResult): void {
    if (result.ok) this.pendingCalls.set(callId, JSON.stringify(result.data));
    else this.pendingCalls.delete(callId);
  }

  observe(name: string, args: Record<string, unknown>, result: ToolResult): void {
    if (!result.ok || !object(result.data)) return;
    const data = result.data;
    const entries = name === "get_monster_resource" ? [data.resource]
      : name === "list_monster_resources" && args.include === "full" && Array.isArray(data.resources) ? data.resources : [];
    for (const entry of entries) {
      if (object(entry) && typeof entry.resourceId === "string" && typeof entry.description === "string") {
        this.full.set(entry.resourceId, JSON.stringify(entry));
      }
    }
  }

  /** Called on the transmission copy after context/budget compaction, not the execution batch. */
  observeRequest(messages: readonly ChatMessage[]): void {
    for (const message of messages) {
      if (message.role !== "tool" || !message.tool_call_id || !this.pendingCalls.has(message.tool_call_id)
        || !MONSTER_READ_TOOLS.some(name => name === message.name) || typeof message.content !== "string") continue;
      let result: unknown;
      try { result = JSON.parse(message.content); }
      catch (error) {
        if (error instanceof SyntaxError) continue; // Malformed historical responses cannot authorize art.
        throw error;
      }
      if (!object(result) || result.ok !== true || !object(result.data)
        || this.pendingCalls.get(message.tool_call_id) !== JSON.stringify(result.data)) continue;
      this.observe(message.name ?? "", { include: result.data.include }, { ok: true, summary: "", data: result.data });
    }
  }

  beforeWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult | null {
    if (!MONSTER_APPEARANCE_WRITERS.some(writer => writer === name)) return null;
    const input = name === "make_action_enemy" ? args : name === "upsert_enemy" ? args.enemy : args.species;
    if (!object(input)) return failure("invalid-args", "몬스터 레코드 객체가 필요합니다.");
    const id = name === "make_action_enemy" ? input.enemyId : input.id;
    const patch = name === "define_monster_species" ? input.graphic : input;
    const graphic = object(patch) ? patch : {};
    const existing = name === "define_monster_species"
      ? project.database.monsterSpecies?.find(entry => entry.id === id)?.graphic
      : project.database.enemies.find(entry => entry.id === id);
    const resourceId = graphic.monsterResourceId ?? existing?.monsterResourceId;
    const transparent = graphic.transparent ?? existing?.transparent;
    if (transparent === true) return null;
    if (existing && existing.transparent !== true && resourceId !== undefined && resourceId === existing.monsterResourceId) return null;
    if (typeof resourceId !== "string" || !resourceId) {
      return failure("monster-resource-required", "새 외형에는 조회한 정확한 monsterResourceId가 필요합니다. 이름으로 대체하지 않습니다.");
    }
    const resource = getMonsterResource(project, resourceId);
    if (!resource) return failure("monster-resource-required", `등록된 몬스터 소재가 아닙니다: ${resourceId}`);
    if (this.full.get(resourceId) !== JSON.stringify(resource)) {
      return failure("monster-resource-read-required", `get_monster_resource(resourceId:${JSON.stringify(resourceId)})로 현재 상세를 읽고 반환값을 확인한 다음 다시 호출하세요.`);
    }
    const tags = args.appearanceTags;
    if (!Array.isArray(tags) || tags.length === 0 || tags.length > 32
      || !tags.every((tag: unknown): tag is string => typeof tag === "string" && normalizeTag(tag).length > 0 && tag.length <= 64)) {
      return failure("monster-appearance-tags-required", "appearanceTags에 원하는 시각적 정체성 태그를 1~32개 선언하세요(태그당 1~64자). 적의 표시 이름과는 독립적입니다.");
    }
    const available = new Set(resource.tags.map(normalizeTag));
    if (!tags.every(tag => available.has(normalizeTag(tag)))) {
      return failure("monster-appearance-mismatch", `appearanceTags가 ${resourceId}의 현재 태그와 일치하지 않습니다. 다른 소재를 조회하거나 원하는 외형을 바로잡으세요.`);
    }
    const specificIdentity = tags.some(tag => normalizeTag(tag).split(/[\s_-]+/u)
      .some(word => /\p{L}/u.test(word) && !GENERIC_APPEARANCE_WORDS.has(word)));
    if (!specificIdentity) {
      return failure("monster-appearance-identity-required", "색상·크기·monster/enemy 같은 공통 분류만으로는 외형을 확인할 수 없습니다. 원하는 구체적 정체성 태그를 최소 하나 포함하세요.");
    }
    return null;
  }
}
