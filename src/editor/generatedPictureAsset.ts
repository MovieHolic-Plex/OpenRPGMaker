import { genId } from "@/util/id";
import type { Project } from "@/project/types";

export class GeneratedPictureError extends Error {
  readonly name = "GeneratedPictureError";
  constructor(message: string) {
    super(message);
  }
}

/** 몬스터(정면 그림)는 2026-10-02 뺐다 — 전투 몬스터는 도트 측면 시트만 쓴다. */
export type GeneratedPictureKind = "picture" | "faceset" | "title" | "backdrop";

export type InsertGeneratedPictureInput = {
  readonly name: string;
  readonly dataUrl: string;
  readonly width?: number;
  readonly height?: number;
  readonly id?: string;
  readonly kind?: GeneratedPictureKind;
};

export function insertGeneratedPictureAsset(project: Project, input: InsertGeneratedPictureInput): string {
  const dataUrl = input.dataUrl.trim();
  if (!dataUrl.startsWith("data:image/")) {
    throw new GeneratedPictureError("그림 dataUrl 이 아닙니다.");
  }
  const kind = input.kind ?? "picture";
  const idPrefix = kind === "picture" ? "picture" : kind === "faceset" ? "generated-face" : `${kind}_img`;
  const rawId = input.id?.trim() || genId(idPrefix);
  const id = kind === "faceset" && !rawId.includes("-bust") ? `${rawId}-bust` : rawId;
  const name = input.name.trim() || "생성 그림";
  project.assets.uploaded[id] = {
    id,
    name,
    kind,
    generatedBy: "image-generation",
    dataUrl,
    meta: {
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    },
  };
  project.resourceProfiles.push({
    kind,
    name,
    assetId: id,
    ...(input.width !== undefined ? { imageWidth: input.width } : {}),
    ...(input.height !== undefined ? { imageHeight: input.height } : {}),
  });
  return id;
}
