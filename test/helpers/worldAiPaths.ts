import { buildSystemPrompt } from "@/ai/contextBuilder";
import { reviewChanges } from "@/ai/independentReview";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { extractOriginalContext } from "@/ai/originalContext";
import { worldEntityNames } from "@/ai/npcCast";
import { buildProjectWikiPayload } from "@/ai/projectWikiClient";
import { projectWikiContext } from "@/ai/projectWikiContext";
import { computeWorldAiReach } from "@/ai/worldAiReach";
import { AUTHORING_PRESET_TOOLS } from "@/editor/tools/authoringPresetTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { PROJECT_WIKI_TOOLS } from "@/editor/tools/projectWikiTools";
import type { Project } from "@/project/types";
import { buildWorldDigest, type WorldEntity } from "@/project/world";

/** 숨긴 카드에만 들어 있는 표지 — 어느 모델 경로 출력에도 나오면 안 된다. */
export const HIDDEN_MARKER = "ZZ비밀표지ZZ";
export const HIDDEN_ID = "w_secret_boss";
export const HIDDEN_NAME = "비밀 흑막 카르딘";
export const PUBLIC_MARKER = "공개표지AA";
export const PUBLIC_ID = "w_open_harbor";

function card(id: string, name: string, marker: string, visibility?: "ai-hidden"): WorldEntity {
  return {
    id, type: "character", name, summary: `${name} ${marker} 항구 이야기`, body: `${name}의 본문. ${marker}. 항구 마을을 만들어 줘.`,
    tags: ["항구", marker], origin: "user", ...(visibility ? { visibility } : {}),
  };
}

/** 같은 세계에 공개 카드 하나와 (선택적으로) 숨긴 카드 하나. 숨긴 카드는 공개 카드와 관계로 이어져 있다. */
export function worldAiPathsProject(hide: boolean): Project {
  const project = createEmptyToolProject("world-ai-paths") as Project;
  const hidden = card(HIDDEN_ID, HIDDEN_NAME, HIDDEN_MARKER, "ai-hidden");
  return {
    ...project,
    world: {
      entities: [card(PUBLIC_ID, "열린 항구 리나", PUBLIC_MARKER), hide ? hidden : { ...hidden, visibility: undefined }],
      relations: [{ a: PUBLIC_ID, b: HIDDEN_ID, kind: "knows", note: `${HIDDEN_MARKER} 와 아는 사이` }],
    },
  } as Project;
}

/**
 * 모델로 가는 경로 전수. 새 경로를 만들면 여기에 한 줄을 더한다(project/world/visibility.ts).
 * 값은 그 경로가 모델에 보내는 문자열이다.
 */
export function modelPathOutputs(project: Project): Record<string, string> {
  const wikiRead = PROJECT_WIKI_TOOLS[0]!;
  const presetRead = AUTHORING_PRESET_TOOLS.find((tool) => tool.name === "read_authoring_preset")!;
  const query = "항구 마을을 만들어 줘";
  return {
    "system prompt (buildSystemPrompt)": buildSystemPrompt(project, { budgetChars: 40000, wikiQuery: query }),
    "projectWikiContext": projectWikiContext(project, { query }).text,
    "read_project_wiki query": JSON.stringify(wikiRead.run(project, { query })),
    "read_project_wiki ids (직접 지목)": JSON.stringify(wikiRead.run(project, { ids: [HIDDEN_ID, PUBLIC_ID] })),
    // /world 항목은 world 도메인 도구가 선언된 의도에서만 실린다 — 그 경로를 일부러 연다.
    "get_original_context (/world 항목)": JSON.stringify(extractOriginalContext(project, { snapshotId: "probe", intent: {
      mode: "create", space: "none", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [],
      needsPlan: false, resetsContext: false, tools: ["read_region_reference"],
    } as unknown as IntentDeclaration }).entries.filter((entry) => entry.id === "/world")),
    "read_authoring_preset (world-story)": JSON.stringify(presetRead.run(project, { presetId: "stronghold-liberation" })),
    "independent review (before→after)": JSON.stringify(reviewChanges(project, { ...project, world: { entities: [...project.world!.entities, card("w_new", "새 카드", "NEWNEW")], relations: project.world!.relations } } as Project)),
    "NPC 대사 작성기 다이제스트": buildWorldDigest(project.world!, { maxTokens: 600 }),
    "NPC 대사 작성기 이름 목록": worldEntityNames(project).join("\n"),
    "위키 추출기 입력": buildProjectWikiPayload({ project, userText: query, sources: [] }),
    "AI 참고 범위 패널 계산": JSON.stringify(computeWorldAiReach(project, { probeQuery: query })),
  };
}
