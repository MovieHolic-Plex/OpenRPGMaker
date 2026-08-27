// Authored resource register/delete. The resource manager can import/delete
// uploaded assets; list_resources is read-only. Tools stay typed and do not
// touch the user filesystem — callers pass an existing dataUrl or metadata.
import type { ResourceKind, UploadedAsset } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

/** 얼굴 한 칸의 변 길이(px). 레거시 시트도 48의 배수 정사각형이었다. */
const FACE_IMAGE_SIZE = 48;

export type FacesetUploadDecision =
  | { readonly accept: true }
  | { readonly accept: false; readonly reason: string };

/**
 * faceset 업로드 크기 판정(순수 함수 — pngInspection 결과의 width/height를 넣는다).
 * 규칙: 한 얼굴 = 48×48. 한 변이 48의 배수인 정사각형이면서 그보다 크면 시트로 보고
 * 거부한다(192×192 16칸, 96×96 4칸 모두 여기 해당). 비정사각·비배수는 저자가 만든
 * 낱장 아트로 보고 허용한다(48×96 포함). 0 이하 변은 유효하지 않은 이미지.
 */
export function decideFacesetUploadDimensions(width: number, height: number): FacesetUploadDecision {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { accept: false, reason: `유효하지 않은 이미지 크기입니다: ${width}×${height}` };
  }
  if (width === FACE_IMAGE_SIZE && height === FACE_IMAGE_SIZE) return { accept: true };
  const isSheetSquare = width === height && width > FACE_IMAGE_SIZE && width % FACE_IMAGE_SIZE === 0;
  if (isSheetSquare) {
    return {
      accept: false,
      reason: `얼굴 이미지는 48×48 한 장이어야 합니다. ${width}×${height} 이미지는 얼굴 시트로 보입니다 — ` +
        `48×48 얼굴 낱장을 잘라 등록하거나, 터미널에서 'npm run assets:slice-faces' 로 시트를 분할한 뒤 ` +
        `낱장 파일(예: Actor1/07.png)을 업로드하세요.`,
    };
  }
  return { accept: true };
}

/** dataUrl PNG 헤더(IHDR)에서 가로·세로를 읽는다. PNG이 아니면 null. */
function readPngSizeFromDataUrl(dataUrl: string): { width: number; height: number } | null {
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  // IHDR(가로·세로)은 파일 앞 24바이트 안에 있으므로 앞부분만 디코딩해 충분하다.
  const head = base64.slice(0, Math.min(base64.length - (base64.length % 4), 4096));
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(head), (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((b, i) => bytes[i] === b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

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
    const kind = parseKind(record.kind);
    const existing = draft.assets.uploaded[id];
    const dataUrl = typeof record.dataUrl === "string" && record.dataUrl.trim()
      ? record.dataUrl
      : existing?.dataUrl ?? "";
    // faceset 은 얼굴 한 장=파일 한 장 계약. 시트 모양(48 배수 정사각) 업로드는 조용히
    // 낱장으로 저장하지 않고 슬라이스 방법을 안내하며 거부한다.
    if (kind === "faceset" && dataUrl.startsWith("data:image/png")) {
      const size = readPngSizeFromDataUrl(dataUrl);
      if (size) {
        const decision = decideFacesetUploadDimensions(size.width, size.height);
        if (!decision.accept) throw new ToolError(decision.reason, { code: "invalid-args" });
      }
    }
    const asset: UploadedAsset = {
      id,
      name,
      kind,
      dataUrl,
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
