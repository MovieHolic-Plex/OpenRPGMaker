import type { Project } from "@/project/types";
import { isWikiActivityRecord } from "@/project/world/activity";
import { resolveWorldCanon, worldCanonHasContent } from "@/project/world/canon";
import { estimateWorldTokens, selectWorldDigest } from "@/project/world/digest";
import { normalizeProjectWorld } from "@/project/world/guards";
import { isAiHiddenEntity } from "@/project/world/visibility";
import type { WorldEntity } from "@/project/world/types";
import { projectWikiContext, WIKI_EXTRACTOR_DOCUMENT_CAP, wikiExtractorDocuments } from "./projectWikiContext";
import { worldCanonPromptSection } from "./worldCanonContext";

/** NPC 대사 작성기가 받는 다이제스트 예산(assistantSession 의 buildWorldDigest 호출과 같은 값). */
export const WORLD_AI_NPC_DIGEST_MAX_TOKENS = 600;
/** 채팅 조수가 한 번에 받는 위키 문서 상한(projectWikiContext 의 상수). */
export const WORLD_AI_CHAT_MAX_DOCUMENTS = 8;
export const WORLD_AI_CHAT_MAX_CHARS = 6000;

export type WorldDocumentAiState = "reads" | "hidden" | "blank";

export interface WorldAiReach {
  /** 세계 개요(worldCanon) — 매 턴 고정 블록. */
  readonly canon: {
    readonly authored: boolean;
    readonly chars: number;
    readonly tokens: number;
    /** 세계 개요의 「비밀」은 숨김이 아니라 지시문이다 — AI 는 읽는다. */
    readonly secretIsInstruction: boolean;
  };
  /** 설정집 문서(진행 기록 제외). 숨김이 미작성보다 우선한다. */
  readonly documents: {
    readonly total: number;
    readonly reads: number;
    readonly hidden: number;
    readonly blank: number;
    readonly stateById: ReadonlyMap<string, WorldDocumentAiState>;
  };
  readonly channels: {
    /** 기록기가 읽는 기존 문서 수. */
    readonly extractor: { readonly documents: number; readonly cap: number };
    /** NPC 대사 작성기 다이제스트. */
    readonly npcDigest: { readonly lines: number; readonly omitted: number; readonly chars: number; readonly tokens: number };
    /** 채팅 조수 — 질문이 있을 때만 실제 선택을 보여 준다. */
    readonly chat: {
      readonly maxDocuments: number;
      readonly maxChars: number;
      readonly probe: { readonly query: string; readonly selected: readonly WorldEntity[]; readonly chars: number; readonly tokens: number } | null;
    };
  };
}

/** 이름만 있고 요약·본문이 모두 비었으면 미작성이다. */
export function isBlankWorldDocument(entity: Pick<WorldEntity, "summary" | "body">): boolean {
  return entity.summary.trim() === "" && (entity.body ?? "").trim() === "";
}

export function worldDocumentAiState(entity: WorldEntity): WorldDocumentAiState {
  if (isAiHiddenEntity(entity)) return "hidden";
  return isBlankWorldDocument(entity) ? "blank" : "reads";
}

/**
 * 「AI가 읽는 것」 패널의 값. **실제 프롬프트 조립 경로가 쓰는 함수를 그대로 부른다** —
 * 세계 개요는 `worldCanonPromptSection`, NPC 대사는 `selectWorldDigest`, 채팅 조수는 `projectWikiContext`,
 * 기록기는 `wikiExtractorDocuments`. 화면용 근사식을 따로 두지 마라(화면과 프롬프트가 어긋난다).
 */
export function computeWorldAiReach(project: Project, options: { readonly probeQuery?: string } = {}): WorldAiReach {
  const world = normalizeProjectWorld(project);
  const section = worldCanonPromptSection(project.worldCanon);
  const authored = worldCanonHasContent(project.worldCanon);

  const documents = world.entities.filter((entity) => !isWikiActivityRecord(entity));
  const stateById = new Map<string, WorldDocumentAiState>();
  let reads = 0, hidden = 0, blank = 0;
  for (const entity of documents) {
    const state = worldDocumentAiState(entity);
    stateById.set(entity.id, state);
    if (state === "reads") reads += 1; else if (state === "hidden") hidden += 1; else blank += 1;
  }

  const digest = selectWorldDigest(world, { maxTokens: WORLD_AI_NPC_DIGEST_MAX_TOKENS });
  const query = options.probeQuery?.trim() ?? "";
  const probe = query ? projectWikiContext(project, { query, mapId: null }) : null;
  const selectedEntities = probe
    ? probe.selectedIds.map((id) => world.entities.find((entity) => entity.id === id)).filter((entity): entity is WorldEntity => entity !== undefined)
    : [];

  return {
    canon: {
      authored,
      chars: section?.length ?? 0,
      tokens: section ? estimateWorldTokens(section) : 0,
      secretIsInstruction: resolveWorldCanon(project.worldCanon).visibility === "secret",
    },
    documents: { total: documents.length, reads, hidden, blank, stateById },
    channels: {
      extractor: { documents: wikiExtractorDocuments(project, new Set()).length, cap: WIKI_EXTRACTOR_DOCUMENT_CAP },
      npcDigest: {
        lines: digest.included.length,
        omitted: digest.omitted,
        chars: digest.included.length === 0 ? 0 : digest.text.length,
        tokens: digest.included.length === 0 ? 0 : estimateWorldTokens(digest.text),
      },
      chat: {
        maxDocuments: WORLD_AI_CHAT_MAX_DOCUMENTS,
        maxChars: WORLD_AI_CHAT_MAX_CHARS,
        probe: probe ? { query, selected: selectedEntities, chars: probe.text.length, tokens: estimateWorldTokens(probe.text) } : null,
      },
    },
  };
}
