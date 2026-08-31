// Authored resource register/delete. The resource manager can import/delete
// uploaded assets; list_resources is read-only. Tools stay typed and do not
// touch the user filesystem — callers pass an existing dataUrl or metadata.
import type { Project, ResourceKind, UploadedAsset } from "@/project/types";
import {
  faceCellSuffix,
  planFacesetSheetSplit,
  type FacesetSheetSplitPlan,
} from "@/assets/facesetSheetSlicing";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export type FacesetUploadDecision =
  | { readonly accept: true }
  | { readonly accept: false; readonly reason: string };

/**
 * faceset 업로드 크기 판정(순수 함수 — pngInspection 결과의 width/height를 넣는다).
 * 48 배수 정사각 시트도 통과시킨다 — 등록 지점이 planFacesetSheetSplit 으로 낱장으로
 * 쪼개므로 여기서 돌려보낼 이유가 없다. 0 이하 변은 유효하지 않은 이미지.
 */
export function decideFacesetUploadDimensions(width: number, height: number): FacesetUploadDecision {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { accept: false, reason: `유효하지 않은 이미지 크기입니다: ${width}×${height}` };
  }
  return { accept: true };
}

/**
 * 시트 업로드를 낱장 자산들로 등록한다.
 *
 * run() 은 동기라 canvas 로 픽셀을 자를 수 없다. 마이그레이션
 * (splitUploadedFacesetSheetAssets)과 같은 방식으로 각 칸이 시트 이미지를 물려받은 채
 * sheetCell/sheetSourceId 표식만 달아 두고, 실제 절단은 로드 직후
 * repairUploadedFacesetSheets 가 canvas 로 마무리한다.
 */
function splitSheetUpload(
  draft: Project,
  sheet: { readonly id: string; readonly name: string; readonly kind: ResourceKind; readonly dataUrl: string },
  plan: FacesetSheetSplitPlan
): ToolExecResult {
  const faceIds: string[] = [];
  for (let cell = 0; cell < plan.count; cell += 1) {
    const faceId = `${sheet.id}-${faceCellSuffix(cell)}`;
    draft.assets.uploaded[faceId] = {
      id: faceId,
      name: `${sheet.name} 얼굴 ${cell + 1}`,
      kind: sheet.kind,
      dataUrl: sheet.dataUrl,
      meta: {
        ...(draft.assets.uploaded[faceId]?.meta ?? {}),
        width: plan.cellSize,
        height: plan.cellSize,
        frames: 1,
        sheetCell: cell,
        sheetSourceId: sheet.id,
      },
    };
    faceIds.push(faceId);
  }
  // 통짜 시트는 남기지 않는다 — 남기면 얼굴 피커에 시트가 그대로 노출된다.
  delete draft.assets.uploaded[sheet.id];
  return {
    summary: `리소스 ${sheet.name} — ${plan.columns}×${plan.rows} 시트를 얼굴 ${plan.count}장으로 나눴습니다.`,
    data: { resource: { id: sheet.id, name: sheet.name, kind: sheet.kind }, faceIds },
  };
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
  "gameOver", "monster", "faceset", "picture", "movie", "system", "system2", "title", "music", "sound",
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
    // faceset 은 얼굴 한 장 = 파일 한 장 계약이다. 시트 모양(48 배수 정사각)으로 올라오면
    // 낱장으로 나눠 등록한다 — 이 배선이 없어서 AI 툴로 올린 192×192 가 통짜로 남았고,
    // 얼굴 피커에 그대로 나와 48px 칸에 16장이 뭉갠 채 보였다(실측 2026-08-28).
    if (kind === "faceset" && dataUrl.startsWith("data:image/png")) {
      const size = readPngSizeFromDataUrl(dataUrl);
      if (size) {
        const decision = decideFacesetUploadDimensions(size.width, size.height);
        if (!decision.accept) throw new ToolError(decision.reason, { code: "invalid-args" });
        const plan = planFacesetSheetSplit(size.width, size.height);
        if (plan !== null) return splitSheetUpload(draft, { id, name, kind, dataUrl }, plan);
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
