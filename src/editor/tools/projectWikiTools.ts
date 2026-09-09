import { projectWikiContext } from "@/ai/projectWikiContext";
import type { ToolDefinition } from "./types";

export const PROJECT_WIKI_TOOLS: readonly ToolDefinition[] = [{
  name: "read_project_wiki",
  description: "프로젝트 설정집의 관련 문서를 읽는다. query로 찾거나 ids로 본문·근거를 읽는다. 현재 작업의 제작 규칙·인물·장소를 먼저 조회하라. 긴 본문은 offset으로 이어 읽는다. 과거 결정은 includeHistory로만 포함한다.",
  mode: "read",
  domains: ["core", "database"],
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
      mapId: { type: "string" },
      ids: { type: "array", items: { type: "string" } },
      offset: { type: "integer", minimum: 0 },
      includeHistory: { type: "boolean" },
    },
  },
  run(project, args) {
    const entities = project.world?.entities ?? [];
    const superseded = new Set(entities.flatMap((entity) => entity.wiki?.supersedes ?? []));
    const selected = Array.isArray(args.ids)
      ? args.ids.filter((id): id is string => typeof id === "string")
      : projectWikiContext(project, {
        query: typeof args.query === "string" ? args.query : "",
        mapId: typeof args.mapId === "string" ? args.mapId : null,
      }).selectedIds;
    const offset = typeof args.offset === "number" ? Math.max(0, Math.trunc(args.offset)) : 0;
    const documents = entities.filter((entity) => selected.includes(entity.id)
      && (args.includeHistory === true || !superseded.has(entity.id))).slice(0, 8).map((entity) => ({
        ...entity,
        body: entity.body?.slice(offset, offset + 12000),
        nextOffset: (entity.body?.length ?? 0) > offset + 12000 ? offset + 12000 : null,
      }));
    return { summary: `프로젝트 위키 ${documents.length}개 문서`, data: { documents } };
  },
}];
