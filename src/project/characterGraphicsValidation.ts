import { findCharsetAsset } from "@/assets/charsetCatalog";
import { FACESET_PEOPLE1_FACES } from "@/assets/charsetFaceMap";
import { FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { MODERN_PORTRAIT_SETS, SHARED_PORTRAIT_ASSETS } from "@/assets/sharedPortraitAssets";
import type { Project } from "./types";

export const GRAPHIC_ATTRIBUTE_AXES = ["kind", "age", "gender", "skin", "hair", "clothing", "role"] as const;
export type GraphicAttributeAxis = typeof GRAPHIC_ATTRIBUTE_AXES[number];
export type GraphicAttributes = Partial<Record<GraphicAttributeAxis, string>>;
export type GraphicMappingStatus = "pending" | "mapped" | "no-face";
export type GraphicMatchQuality = "unspecified" | "exact" | "approximate";
export interface CharacterGraphicSlot {
  characterIndex: number;
  graphicAttributes: GraphicAttributes;
  status: GraphicMappingStatus;
  faceResourceId: string | null;
  quality: GraphicMatchQuality;
  note: string;
}

export const graphicSpriteKey = (textureKey: string, characterIndex: number): string => `${textureKey}#${characterIndex}`;
export const canonicalTexture = (id: string): string => findCharsetAsset(id)?.textureKey ?? id;

export const MODERN_BUST_FACES = SHARED_PORTRAIT_ASSETS.filter((asset) => asset.mode === "bust" && asset.expression === "base"
  && MODERN_PORTRAIT_SETS.some((set) => asset.setId === `shared-${set.stem}-expressions`));

export function validCharacterFaceIds(project: Project): Set<string> {
  const faceIds = new Set<string>();
  const add = (resourceId: string): void => {
    if (!LEGACY_FACESET_SHEET_IDS.includes(resourceId)) faceIds.add(resourceId);
  };
  for (const face of FACESET_FACE_ASSETS) add(face.id);
  for (const portrait of MODERN_BUST_FACES) add(portrait.id);
  for (const face of FACESET_PEOPLE1_FACES) add(face.resourceId);
  for (const asset of Object.values(project.assets.uploaded)) if (asset.kind === "faceset") add(asset.id);
  for (const profile of project.resourceProfiles) if (profile.kind === "faceset" && profile.assetId) add(profile.assetId);
  return faceIds;
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: 객체가 필요합니다.`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`${path}: ${max}자 이하 문자열이 필요합니다.`);
  return value;
}
export function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: 배열이 필요합니다.`);
  return value;
}
export function attributes(value: unknown, path: string): GraphicAttributes {
  const source = record(value, path);
  const result: GraphicAttributes = {};
  for (const key of Object.keys(source)) {
    if (!GRAPHIC_ATTRIBUTE_AXES.includes(key as GraphicAttributeAxis)) throw new Error(`${path}: 알 수 없는 속성 ${key}`);
    result[key as GraphicAttributeAxis] = text(source[key], `${path}.${key}`, 80);
  }
  return result;
}
export function mapping(value: unknown, path: string, faceIds: ReadonlySet<string>): Omit<CharacterGraphicSlot, "graphicAttributes"> {
  const row = record(value, path);
  const index = row.characterIndex;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 7) throw new Error(`${path}: 캐릭터 칸은 0~7입니다.`);
  const status = row.status;
  if (status !== "pending" && status !== "mapped" && status !== "no-face") throw new Error(`${path}: 검토 상태가 잘못되었습니다.`);
  const faceResourceId = row.faceResourceId;
  if (status === "mapped" ? typeof faceResourceId !== "string" || !faceIds.has(faceResourceId) : faceResourceId !== null) throw new Error(`${path}: 얼굴 ID와 검토 상태가 맞지 않거나 알 수 없는 얼굴입니다.`);
  const quality = row.quality ?? "unspecified";
  if (quality !== "unspecified" && quality !== "exact" && quality !== "approximate") throw new Error(`${path}: 일치 품질이 잘못되었습니다.`);
  return { characterIndex: index, status, faceResourceId: faceResourceId as string | null, quality, note: text(row.note, `${path}.note`, 2000) };
}

/** Optional profile metadata is validated without seeding or modifying legacy projects. */
export function validateCharacterGraphicsProject(project: Project): void {
  const faceIds = validCharacterFaceIds(project);
  const seen = new Set<string>();
  for (const profile of project.resourceProfiles) {
    if (profile.graphicAttributes !== undefined || profile.graphicNote !== undefined) {
      if (profile.kind !== "faceset" || !profile.assetId || LEGACY_FACESET_SHEET_IDS.includes(profile.assetId)) throw new Error("얼굴 메타데이터에는 낱장 faceset 리소스가 필요합니다.");
      if (profile.graphicAttributes !== undefined) attributes(profile.graphicAttributes, `${profile.assetId}.graphicAttributes`);
      if (profile.graphicNote !== undefined) text(profile.graphicNote, `${profile.assetId}.graphicNote`, 2000);
    }
    if (profile.characterSlots === undefined) continue;
    if (profile.kind !== "charset" || !profile.assetId) throw new Error("캐릭터 칸에는 charset 리소스 ID가 필요합니다.");
    for (const value of array(profile.characterSlots, "characterSlots")) {
      const row = record(value, "characterSlots");
      const parsed = mapping(row, "characterSlots", faceIds);
      attributes(row.graphicAttributes, "characterSlots.graphicAttributes");
      const key = graphicSpriteKey(canonicalTexture(profile.assetId), parsed.characterIndex);
      if (seen.has(key)) throw new Error(`중복 캐릭터 칸: ${key}`);
      seen.add(key);
    }
  }
}
