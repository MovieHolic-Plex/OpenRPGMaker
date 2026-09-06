import { listAudioResources } from "@/assets/audioResourceCatalog";
import {
  resetAudioDescriptionOverride,
  setAudioDescriptionOverride,
  type AudioResourceRef,
} from "@/project/audioDescriptions";
import { ProjectFormatError } from "@/project/io/errors";
import type { AudioDescriptionOverrides, Project } from "@/project/types";
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

export const AUDIO_DESCRIPTION_TOOLS: readonly ToolDefinition[] = [getAudioResource, setAudioDescription];
