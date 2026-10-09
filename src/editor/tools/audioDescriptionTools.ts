import { listAudioResources } from "@/assets/audioResourceCatalog";
import { searchResources } from "@/assets/resourceSearch";
import {
  resetAudioDescriptionOverride,
  setAudioDescriptionOverride,
  type AudioResourceRef,
} from "@/project/audioDescriptions";
import { ProjectFormatError } from "@/project/io/errors";
import type { AudioDescriptionOverrides, Project } from "@/project/types";
import { resolveMapBgm } from '@/project/mapMusic';
import { ToolError, type JsonSchema, type ToolDefinition } from "./types";

export function parseAudioResourceRef(kind: unknown, resourceId: unknown): AudioResourceRef {
  if (
    typeof resourceId !== "string" || resourceId.length === 0
    || resourceId !== resourceId.trim() || /^(bgm|se):/.test(resourceId)
  ) {
    throw new ToolError("resourceId는 검색 접두사가 없는 원본 ID여야 합니다.", { code: "invalid-args" });
  }
  switch (kind) {
    case "music":
    case "sound":
      return { kind, resourceId };
    default:
      throw new ToolError("오디오 kind는 music 또는 sound여야 합니다.", { code: "invalid-args" });
  }
}

/** Translate the model's input errors at the tool boundary; preserve its writer contract. */
export function audioDescriptionsForTool(
  overrides: AudioDescriptionOverrides | undefined,
  resource: AudioResourceRef,
  input: unknown,
): AudioDescriptionOverrides {
  try {
    return setAudioDescriptionOverride(overrides, resource, input);
  } catch (error) {
    if (!(error instanceof ProjectFormatError)) throw error;
    throw new ToolError(error.message, { code: "invalid-args" });
  }
}

/** Mutate only the supplied detached draft, preserving field absence after the last reset. */
export function resetAudioDescriptionOnProject(draft: Project, resource: AudioResourceRef): void {
  const overrides = resetAudioDescriptionOverride(draft.audioDescriptions, resource);
  if (overrides === undefined) delete draft.audioDescriptions;
  else draft.audioDescriptions = overrides;
}

function requireAudioResource(project: Project, args: Record<string, unknown>) {
  const ref = parseAudioResourceRef(args.kind, args.resourceId);
  const resource = listAudioResources(ref.kind, project).find(entry => entry.id === ref.resourceId);
  if (!resource) {
    throw new ToolError(`없는 오디오 리소스입니다: ${ref.resourceId}`, { code: "resource-not-found" });
  }
  return resource;
}

const AUDIO_REF_PROPERTIES = {
  kind: { type: "string", enum: ["music", "sound"] },
  resourceId: { type: "string", minLength: 1, description: "검색용 bgm:/se: 접두사 없는 원본 ID" },
} as const satisfies Record<string, JsonSchema>;

const getAudioResource: ToolDefinition = {
  name: "get_audio_resource",
  description: "음악·효과음의 원본 ID, 이름, 태그, 전체 설명과 설명 출처를 현재 프로젝트에서 조회한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: AUDIO_REF_PROPERTIES,
    required: ["kind", "resourceId"],
    additionalProperties: false,
  },
  run(project, args) {
    const resource = requireAudioResource(project, args);
    return { summary: `오디오 리소스 ${resource.id}`, data: { resource } };
  },
};

const BGM_SCENES = [
  "title",
  "battle",
  "night",
  "dungeon",
  "village",
  "forest",
  "field",
] as const;

type BgmScene = (typeof BGM_SCENES)[number];
// 장면 바늘은 bgmThemeRecommendation.ts의 THEME_RULES.categoryNeedles와 같은 집합이다.
const BGM_SCENE_NEEDLES: Readonly<Record<BgmScene, readonly string[]>> = {
  title: ["타이틀", "메뉴"],
  battle: ["전투", "보스"],
  night: ["야간 · 휴식", "밤"],
  dungeon: ["던전", "유적", "동굴", "광산", "광물"],
  village: ["마을", "광장", "길드", "회관", "시장 · 아침 생활", "축제", "과수원", "어촌", "찻집", "공원", "양봉"],
  forest: ["숲 · 탐험", "잎다리", "소나무", "양치식물", "사과꽃"],
  field: ["필드", "초원", "장거리"],
};

function searchBgmMatches(project: Project, query: string): Array<{ resourceId: string; score: number }> {
  return searchResources("bgm", query, { audioProject: project }).map((match) => ({
    resourceId: match.resourceId ?? match.id.replace(/^(?:bgm|se):/, ""),
    score: match.score,
  }));
}

const recommendBgm: ToolDefinition = {
  name: "recommend_bgm",
  description: "분위기/장면 질의로 BGM 후보를 고른다. 제목 목록이 아니라 후보마다 전체 설명을 함께 돌려주므로, 이 결과를 보고 bgmResourceId를 정한다. 자동 선택(create_map/generate_map) 대신 곡을 고를 때 쓴다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "분위기/장면 질의(예: 슬픈 마을, 밤 숲). scene과 둘 중 하나는 필수." },
      scene: { type: "string", enum: [...BGM_SCENES], description: "query 없이 장면만으로 고를 때. query가 있으면 query가 우선." },
      limit: { type: "integer", minimum: 1, maximum: 20, description: "후보 수(기본 10, 최대 20)" },
    },
    additionalProperties: false,
  },
  run(project, args) {
    const limit = args.limit === undefined ? 10 : args.limit;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new ToolError("limit은 1~20의 정수여야 합니다.", { code: "invalid-args" });
    }
    const hasQuery = typeof args.query === "string" && args.query.trim().length > 0;
    const scene = BGM_SCENES.find((entry) => entry === args.scene);
    if (!hasQuery && scene === undefined) {
      throw new ToolError("query와 scene 중 하나는 필요합니다.", { code: "invalid-args" });
    }
    const catalog = listAudioResources("music", project);
    const byId = new Map(catalog.map((resource) => [resource.id, resource]));
    // scene만 있으면 카테고리 바늘로 모으고, query가 있으면 의미 검색 점수로 세운다.
    const ordered: Array<{ resourceId: string; score: number }> = hasQuery
      ? searchBgmMatches(project, args.query as string)
      : catalog
        .filter((resource) => BGM_SCENE_NEEDLES[scene as BgmScene].some((needle) => resource.name.includes(needle)))
        .map((resource) => ({ resourceId: resource.id, score: 1 }));
    const usedOnMaps = new Map<string, string[]>();
    for (const map of Object.values(project.maps)) {
      const effective = resolveMapBgm(project, map.id);
      if (effective.kind === 'play') usedOnMaps.set(effective.resourceId, [...(usedOnMaps.get(effective.resourceId) ?? []), map.id]);
    }
    ordered.sort((a, b) => b.score - a.score || (usedOnMaps.get(a.resourceId)?.length ?? 0) - (usedOnMaps.get(b.resourceId)?.length ?? 0));
    const total = ordered.length;
    const seen = new Set<string>();
    const candidates = [];
    for (const { resourceId, score } of ordered) {
      if (candidates.length >= limit) break;
      if (seen.has(resourceId)) continue;
      seen.add(resourceId);
      const resource = byId.get(resourceId);
      if (!resource) continue;
      candidates.push({
        resourceId: resource.id,
        name: resource.name,
        tags: [...resource.tags],
        description: resource.description,
        descriptionTruncated: false,
        descriptionSource: resource.descriptionSource,
        score,
        usedOnMaps: usedOnMaps.get(resourceId) ?? [],
      });
    }
    // 검색 0건이면 장면 폴백이 아니라 빈 목록 — 엉뚱한 1등을 "추천"으로 착각하게 하지 않는다.
    return {
      summary: `BGM 후보 ${candidates.length}건${hasQuery ? `("${(args.query as string).trim()}")` : `(${scene})`}`,
      data: { candidates, total, originalCompositionTool: "generate_original_bgm", guidance: "같은 분위기의 동점 후보는 미사용 곡 우선. 원곡 요청/장면 변화/부적합한 반복은 직접 작곡하고 맵에 연결하세요." },
    };
  },
};

const setAudioDescription: ToolDefinition = {
  name: "set_audio_description",
  description: "음악·효과음 설명을 수정한다. set은 description 문자열이 필요하며 빈 문자열은 설명 비우기다. reset은 description 없이 기본 설명을 복원한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      ...AUDIO_REF_PROPERTIES,
      action: { type: "string", enum: ["set", "reset"] },
      description: { type: "string", description: "set에만 사용. 앞뒤 공백 제거 후 최대 4,000 UTF-16 code units." },
    },
    required: ["kind", "resourceId", "action"],
    additionalProperties: false,
  },
  run(draft, args) {
    const resource = requireAudioResource(draft, args);
    const ref: AudioResourceRef = { kind: resource.kind, resourceId: resource.id };
    switch (args.action) {
      case "set":
        draft.audioDescriptions = audioDescriptionsForTool(draft.audioDescriptions, ref, args.description);
        break;
      case "reset":
        if (Object.hasOwn(args, "description")) {
          throw new ToolError("reset에는 description을 지정할 수 없습니다.", { code: "invalid-args" });
        }
        resetAudioDescriptionOnProject(draft, ref);
        break;
      default:
        throw new ToolError("action은 set 또는 reset이어야 합니다.", { code: "invalid-args" });
    }
    return {
      summary: `오디오 설명 ${resource.id}: ${args.action}`,
      data: { ...ref, action: args.action },
    };
  },
};

export const AUDIO_DESCRIPTION_TOOLS: readonly ToolDefinition[] = [getAudioResource, recommendBgm, setAudioDescription];
