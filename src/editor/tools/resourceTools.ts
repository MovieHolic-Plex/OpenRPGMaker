// Authored resource register/delete. The resource manager can import/delete
// uploaded assets; list_resources is read-only. Tools stay typed and do not
// touch the user filesystem — callers pass an existing dataUrl or metadata.
import type { ResourceKind, UploadedAsset } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const RESOURCE_KINDS = [
  "chipset", "charset", "battle", "battleCharset", "battleWeapon", "backdrop",
  "gameOver", "monster", "faceset", "picture", "system", "system2", "title", "music", "sound",
] as const satisfies readonly ResourceKind[];

function parseKind(value: unknown): ResourceKind {
  if (typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value)) {
    return value as ResourceKind;
  }
  throw new ToolError(`지원하지 않는 리소스 kind입니다: ${String(value)}`, { code: "invalid-args" });
}

const upsertResource: ToolDefinition = {
  name: "upsert_resource",
  description: "리소스 가져오기: 업로드 소재를 등록/수정한다. id·name·kind와 선택 dataUrl. 파일 선택 UI 없이 저작 데이터를 쓴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      resource: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          kind: { type: "string", enum: [...RESOURCE_KINDS] },
          mimeType: { type: "string" },
          dataUrl: { type: "string" },
        },
        required: ["id", "name", "kind"],
        additionalProperties: false,
      },
    },
    required: ["resource"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const input = args.resource;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new ToolError("resource 객체가 필요합니다.", { code: "invalid-args" });
    }
    const record = input as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || !name) throw new ToolError("resource.id와 resource.name이 필요합니다.", { code: "invalid-args" });
    const existing = draft.assets.uploaded[id];
    const asset: UploadedAsset = {
      id,
      name,
      kind: parseKind(record.kind),
      dataUrl: typeof record.dataUrl === "string" && record.dataUrl.trim()
        ? record.dataUrl
        : existing?.dataUrl ?? "",
      meta: existing?.meta ?? {},
    };
    draft.assets.uploaded[id] = asset;
    return { summary: `리소스 ${name}`, data: { resource: { id: asset.id, name: asset.name, kind: asset.kind } } };
  },
};

const deleteResource: ToolDefinition = {
  name: "delete_resource",
  description: "업로드 리소스를 삭제한다. 맵/타일셋이 참조하면 거부한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { resourceId: { type: "string" } },
    required: ["resourceId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const resourceId = typeof args.resourceId === "string" ? args.resourceId.trim() : "";
    if (!resourceId) throw new ToolError("resourceId가 필요합니다.", { code: "invalid-args" });
    if (!draft.assets.uploaded[resourceId]) {
      throw new ToolError(`없는 리소스입니다: ${resourceId}`, { code: "resource-not-found" });
    }
    delete draft.assets.uploaded[resourceId];
    return { summary: `리소스 삭제 ${resourceId}`, data: { resourceId } };
  },
};

export const RESOURCE_TOOLS: readonly ToolDefinition[] = [upsertResource, deleteResource];
