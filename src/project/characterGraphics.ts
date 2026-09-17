import { projectCharsetAssets, findCharsetAsset } from "@/assets/charsetCatalog";
import { findCharsetSemantic, upsertCharsetLabelOverride } from "@/assets/charsetSemantics";
import { FACESET_FACE_ASSETS, LEGACY_FACESET_SHEET_IDS } from "@/assets/facesetFaceAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { PRODUCT_SLUG } from "@/brand";
import faceExpressionSources from "../../scripts/shared-face-expression-sources.json";
import { FACESET_PEOPLE1_FACES } from "@/assets/charsetFaceMap";
import type { Project, ResourceProfile } from "./types";

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
export interface CharacterSprite extends Omit<CharacterGraphicSlot, "graphicAttributes"> {
  textureKey: string;
  label: string;
  path: string;
  sheetName: string;
  attributes: GraphicAttributes;
}
export interface CharacterFace {
  resourceId: string;
  label: string;
  note: string;
  attributes: GraphicAttributes;
}
export interface CharacterGraphicsDocument {
  schema: typeof NPC_FACE_MAPPING_SCHEMA;
  version: 2;
  mappings: Array<Omit<CharacterSprite, "path" | "sheetName">>;
  faces: CharacterFace[];
}
export interface CharacterGraphicsImport {
  mappings: Array<Omit<CharacterSprite, "path" | "sheetName" | "attributes"> & { attributes?: GraphicAttributes }>;
  faces: CharacterFace[];
}

/** 캐릭터·얼굴 JSON 의 schema id. 내보내기는 항상 이 값을 쓴다. */
export const NPC_FACE_MAPPING_SCHEMA = `${PRODUCT_SLUG}-npc-face-mapping` as const;
/** 2026-09 제품명 스윕 전 schema id — **읽기 전용**. 사용자가 그때 내보낸 JSON 이 계속 열려야 하므로 parse 만 받는다. */
const LEGACY_NPC_FACE_MAPPING_SCHEMA = "rpg-zzu-npc-face-mapping";
const ACCEPTED_SCHEMAS: ReadonlySet<unknown> = new Set([NPC_FACE_MAPPING_SCHEMA, LEGACY_NPC_FACE_MAPPING_SCHEMA]);
export const graphicSpriteKey = (textureKey: string, characterIndex: number): string => `${textureKey}#${characterIndex}`;
const canonicalTexture = (id: string): string => findCharsetAsset(id)?.textureKey ?? id;

/** Only literal written traits, never inferred from a paired image or sheet index. Conflicts stay blank. */
export function seedGraphicAttributes(label: string): GraphicAttributes {
  const rules: Partial<Record<GraphicAttributeAxis, readonly (readonly [string, RegExp])[]>> = {
    kind: [["사람", /주민|남성|여성|소년|소녀|노파|노인|청년/], ["몬스터", /몬스터|슬라임|오크|해골|좀비|악마|드래곤/], ["동물", /고양이|강아지|닭|송아지/]],
    age: [["어린이", /아이|소년|소녀|어린이/], ["청년", /청년|젊은/], ["중년", /중년/], ["노년", /노인|노파|할머니|할아버지/]],
    gender: [["남성", /남성|남자|소년|할아버지/], ["여성", /여성|여자|소녀|노파|할머니/]],
    skin: [["어두운", /어두운 피부|검은 피부/], ["밝은", /밝은 피부|하얀 피부/]],
    hair: [["금발", /금발/], ["백발", /백발|흰 머리(?!띠|장식)/], ["검은 머리", /검은 머리|흑발/], ["붉은 머리", /붉은 머리|빨간 머리/], ["갈색 머리", /갈색 머리/], ["푸른 머리", /청발|푸른 머리|파란 머리/], ["보라 머리", /보라 머리|보라색 머리/], ["초록 머리", /초록 머리|녹색 머리|청록 머리/], ["대머리", /대머리/]],
    clothing: [["갑옷", /갑옷/], ["로브", /로브/], ["정장", /정장/], ["전통옷", /전통옷|전통 의상/]],
    role: [["상인", /상인/], ["기사", /기사/], ["병사", /병사/], ["마법사", /마법사/], ["메이드", /메이드|하녀/], ["집사", /집사/], ["수녀", /수녀/], ["승려", /승려/]],
  };
  const result: GraphicAttributes = {};
  for (const axis of GRAPHIC_ATTRIBUTE_AXES) {
    const matches = rules[axis]?.filter(([, pattern]) => pattern.test(label)) ?? [];
    if (matches.length === 1) result[axis] = matches[0]![0];
  }
  return result;
}

function spriteProfiles(project: Project): Map<string, ResourceProfile> {
  const profiles = new Map<string, ResourceProfile>();
  for (const profile of project.resourceProfiles) {
    if (profile.kind !== "charset" || !profile.assetId) continue;
    const key = canonicalTexture(profile.assetId);
    // Bundled projects register both texture keys and resource IDs for the same sheet.
    // An unannotated alias must never hide the profile we edited.
    if (!profiles.has(key) || profile.characterSlots !== undefined) profiles.set(key, profile);
  }
  return profiles;
}

export function listCharacterSprites(project: Project): CharacterSprite[] {
  const assets = new Map(projectCharsetAssets(project).map((asset) => [asset.textureKey, { path: asset.path, name: asset.fileName }]));
  const profiles = spriteProfiles(project);
  for (const [textureKey, profile] of profiles) {
    if (!assets.has(textureKey)) assets.set(textureKey, { path: resolveAssetResourceUrl(profile.assetId, { project }) ?? "", name: profile.name });
  }
  const labels = new Map((project.charsetLabels ?? []).map((entry) => [graphicSpriteKey(entry.textureKey, entry.characterIndex), entry.label]));
  return [...assets].flatMap(([textureKey, asset]) => Array.from({ length: 8 }, (_, characterIndex) => {
    const profile = profiles.get(textureKey);
    const slot = profile?.characterSlots?.find((entry) => entry.characterIndex === characterIndex);
    const semantic = findCharsetSemantic(textureKey, characterIndex);
    const label = labels.get(graphicSpriteKey(textureKey, characterIndex)) ?? semantic?.label ?? `${asset.name} #${characterIndex}`;
    const authoredLabel = project.charsetLabels?.find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
    const written = authoredLabel ? [label, ...(authoredLabel.tags ?? [])] : [label, ...(semantic?.tags ?? [])];
    const defaults = seedGraphicAttributes(written.join(" "));
    if (!authoredLabel && semantic?.gender && semantic.gender !== "none") defaults.gender = semantic.gender === "male" ? "남성" : "여성";
    if (!authoredLabel && semantic?.age) defaults.age = ({ child: "어린이", youth: "청년", middle: "중년", elder: "노년" } as const)[semantic.age];
    return { textureKey, characterIndex, label, path: asset.path, sheetName: profile?.name ?? asset.name,
      attributes: slot?.graphicAttributes ?? defaults, status: slot?.status ?? "pending",
      faceResourceId: slot?.faceResourceId ?? null, quality: slot?.quality ?? "unspecified", note: slot?.note ?? "" };
  }));
}

export function listCharacterFaces(project: Project): CharacterFace[] {
  const faces = new Map<string, CharacterFace>();
  const add = (resourceId: string, label: string, attributes?: GraphicAttributes, note = ""): void => {
    if (LEGACY_FACESET_SHEET_IDS.includes(resourceId)) return;
    faces.set(resourceId, { resourceId, label, attributes: attributes ?? seedGraphicAttributes(label), note });
  };
  // Reuse the independently authored face descriptions linked by source sheet/cell.
  // Do not copy walking-sprite traits into faces to make a pair appear consistent.
  const sourceNames = new Map(faceExpressionSources.map((source) => [
    `easyrpg-faceset-${source.baseSheet.toLowerCase()}-${String(source.baseCell).padStart(2, "0")}`, source.name,
  ]));
  for (const face of FACESET_FACE_ASSETS) add(face.id, sourceNames.get(face.id) ?? face.name);
  for (const face of FACESET_PEOPLE1_FACES) add(face.resourceId, face.label, {
    ...seedGraphicAttributes(face.label), gender: face.gender === "male" ? "남성" : face.gender === "female" ? "여성" : "",
    ...(face.age ? { age: ({ child: "어린이", youth: "청년", middle: "중년", elder: "노년" } as const)[face.age] } : {}),
  });
  for (const asset of Object.values(project.assets.uploaded)) if (asset.kind === "faceset") add(asset.id, asset.name);
  for (const profile of project.resourceProfiles) if (profile.kind === "faceset" && profile.assetId) {
    const bundled = FACESET_FACE_ASSETS.find((face) => face.id === profile.assetId);
    const existing = faces.get(profile.assetId);
    const label = bundled?.name === profile.name && existing ? existing.label : profile.name;
    add(profile.assetId, label, profile.graphicAttributes ?? (label === existing?.label ? existing.attributes : undefined), profile.graphicNote);
  }
  return [...faces.values()];
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: 객체가 필요합니다.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error(`${path}: ${max}자 이하 문자열이 필요합니다.`);
  return value;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: 배열이 필요합니다.`);
  return value;
}
function attributes(value: unknown, path: string): GraphicAttributes {
  const source = record(value, path);
  const result: GraphicAttributes = {};
  for (const key of Object.keys(source)) {
    if (!GRAPHIC_ATTRIBUTE_AXES.includes(key as GraphicAttributeAxis)) throw new Error(`${path}: 알 수 없는 속성 ${key}`);
    result[key as GraphicAttributeAxis] = text(source[key], `${path}.${key}`, 80);
  }
  return result;
}
function mapping(value: unknown, path: string, faceIds: ReadonlySet<string>): Omit<CharacterGraphicSlot, "graphicAttributes"> {
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

/** Parse every row before callers record history or update the store. Source commits are provenance, not an identity remapping rule. */
export function parseCharacterGraphicsImport(value: unknown, project: Project): CharacterGraphicsImport {
  const doc = record(typeof value === "string" ? JSON.parse(value) : value, "JSON");
  if (!ACCEPTED_SCHEMAS.has(doc.schema) || (doc.version !== 1 && doc.version !== 2)) throw new Error("지원하는 캐릭터·얼굴 JSON은 version 1 또는 2입니다.");
  const spriteKeys = new Set(listCharacterSprites(project).map((row) => graphicSpriteKey(row.textureKey, row.characterIndex)));
  const faceIds = new Set(listCharacterFaces(project).map((face) => face.resourceId));
  const seen = new Set<string>();
  const mappings = array(doc.mappings, "mappings").map((value, index) => {
    const path = `mappings[${index}]`;
    const row = record(value, path);
    const textureKey = text(row.textureKey, `${path}.textureKey`, 300);
    const parsed = mapping(row, path, faceIds);
    const key = graphicSpriteKey(textureKey, parsed.characterIndex);
    if (!spriteKeys.has(key) || seen.has(key)) throw new Error(`${path}: 알 수 없거나 중복된 캐릭터 칸 ${key}`);
    seen.add(key);
    return { ...parsed, textureKey, label: text(row.label, `${path}.label`, 200),
      ...(row.attributes !== undefined ? { attributes: attributes(row.attributes, `${path}.attributes`) } : {}) };
  });
  const seenFaces = new Set<string>();
  const faces = (doc.version === 2 ? array(doc.faces, "faces") : []).map((value, index) => {
    const path = `faces[${index}]`;
    const row = record(value, path);
    const resourceId = text(row.resourceId, `${path}.resourceId`, 300);
    if (!faceIds.has(resourceId) || seenFaces.has(resourceId)) throw new Error(`${path}: 알 수 없거나 중복된 얼굴 ${resourceId}`);
    seenFaces.add(resourceId);
    return { resourceId, label: text(row.label, `${path}.label`, 200), note: text(row.note, `${path}.note`, 2000), attributes: attributes(row.attributes, `${path}.attributes`) };
  });
  return { mappings, faces };
}

function ensureProfile(project: Project, kind: "charset" | "faceset", assetId: string, name: string): ResourceProfile {
  let profile = kind === "charset" ? spriteProfiles(project).get(assetId)
    : project.resourceProfiles.find((entry) => entry.kind === kind && entry.assetId === assetId);
  if (!profile) { profile = { kind, assetId, name }; project.resourceProfiles.push(profile); }
  return profile;
}

export function updateCharacterSprite(project: Project, row: Omit<CharacterSprite, "path" | "sheetName">): void {
  const profile = ensureProfile(project, "charset", row.textureKey, findCharsetAsset(row.textureKey)?.name ?? row.textureKey);
  const slot: CharacterGraphicSlot = { characterIndex: row.characterIndex, graphicAttributes: { ...row.attributes }, status: row.status, faceResourceId: row.faceResourceId, quality: row.quality, note: row.note };
  const slots = profile.characterSlots ??= [];
  const index = slots.findIndex((entry) => entry.characterIndex === row.characterIndex);
  if (index < 0) slots.push(slot); else slots[index] = slot;
}

export function updateCharacterSpriteLabel(project: Project, textureKey: string, characterIndex: number, label: string): void {
  const previous = project.charsetLabels?.find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
  project.charsetLabels = upsertCharsetLabelOverride(project.charsetLabels, { ...previous, textureKey, characterIndex, label, origin: "user" });
  // The existing teaching helper treats blank as reset; import/edit must retain an explicitly supplied blank too.
  const saved = project.charsetLabels.find((entry) => entry.textureKey === textureKey && entry.characterIndex === characterIndex);
  if (saved) {
    project.charsetLabels = project.charsetLabels.map((entry) => entry === saved ? { ...entry, label } : entry);
  } else project.charsetLabels.push({ textureKey, characterIndex, label, ...(previous?.tags ? { tags: previous.tags } : {}), origin: "user" });
}

export function updateCharacterFace(project: Project, row: CharacterFace): void {
  const profile = ensureProfile(project, "faceset", row.resourceId, row.label);
  profile.name = row.label;
  profile.graphicAttributes = { ...row.attributes };
  profile.graphicNote = row.note;
}

export function applyCharacterGraphicsImport(project: Project, imported: CharacterGraphicsImport): void {
  const current = new Map(listCharacterSprites(project).map((row) => [graphicSpriteKey(row.textureKey, row.characterIndex), row]));
  for (const row of imported.mappings) {
    const previous = current.get(graphicSpriteKey(row.textureKey, row.characterIndex))!;
    const authored = spriteProfiles(project).get(row.textureKey)?.characterSlots?.find((slot) => slot.characterIndex === row.characterIndex);
    updateCharacterSprite(project, { ...previous, ...row, attributes: row.attributes ?? authored?.graphicAttributes ?? seedGraphicAttributes(row.label) });
    updateCharacterSpriteLabel(project, row.textureKey, row.characterIndex, row.label);
  }
  for (const face of imported.faces) updateCharacterFace(project, face);
}

export function exportCharacterGraphics(project: Project): CharacterGraphicsDocument {
  return { schema: NPC_FACE_MAPPING_SCHEMA, version: 2, mappings: listCharacterSprites(project).map(({ path: _path, sheetName: _sheetName, ...row }) => row), faces: listCharacterFaces(project) };
}

/** Optional profile metadata is validated without seeding or modifying legacy projects. */
export function validateCharacterGraphicsProject(project: Project): void {
  const faceIds = new Set(listCharacterFaces(project).map((face) => face.resourceId));
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
