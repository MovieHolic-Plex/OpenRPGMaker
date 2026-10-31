import { z } from "zod";
import type { CharacterGraphicsDocument } from "./characterGraphics";
import reviewedCatalog from "../assets/sharedCharacterGraphics.json";
import corrections from "../assets/characterReferenceCorrections.json";

export const SHARED_CHARACTER_GRAPHICS_ENDPOINT = "/__oprn/shared-character-graphics";
const text = z.string().max(2000);
const id = z.string().min(1).max(300);
const attributes = z.object({ kind: text.max(80).optional(), age: text.max(80).optional(), gender: text.max(80).optional(), skin: text.max(80).optional(), hair: text.max(80).optional(), clothing: text.max(80).optional(), role: text.max(80).optional() }).strict();
const mapping = z.object({
  textureKey: id, characterIndex: z.number().int().min(0).max(7), label: text.max(200), attributes,
  status: z.enum(["pending", "mapped", "no-face"]), faceResourceId: id.nullable(),
  quality: z.enum(["unspecified", "exact", "approximate"]), note: text,
}).strict().refine(row => row.status === "mapped" ? row.faceResourceId !== null : row.faceResourceId === null, "얼굴과 검토 상태가 맞지 않습니다.");
const schema = z.object({
  schema: z.literal("oprn-npc-face-mapping"), version: z.literal(2),
  mappings: z.array(mapping).max(10000),
  faces: z.array(z.object({ resourceId: id, label: text.max(200), note: text, attributes }).strict()).max(10000),
}).strict().refine(document => new Set(document.mappings.map(row => `${row.textureKey}#${row.characterIndex}`)).size === document.mappings.length
  && new Set(document.faces.map(row => row.resourceId)).size === document.faces.length, "중복된 공용 자료입니다.");

/** Storage validates the wire shape. The editor additionally validates IDs against its installed assets. */
export function parseSharedCharacterGraphicsDocument(value: unknown): CharacterGraphicsDocument {
  const document = schema.parse(value);
  // Upgrade only untouched rows from the shipped catalog. A user's label, note,
  // attributes or pairing edits make the row ineligible for this migration.
  const equal = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => equal(left[key], right[key]));
  };
  // revisions: 번들 행을 다시 고친 기록(2026-10-31 다른 시트 얼굴을 빌리던 근사 짝 8칸 끊기). 옛 행 → 새 행으로 한 단계씩 따라간다.
  const mappingChanges = [...corrections.mappings, ...corrections.revisions];
  const upgrade = (row: (typeof document.mappings)[number]) => {
    let current = row;
    for (let step = 0; step < 4; step++) {
      const next = mappingChanges.find(change => equal(current, change.before))?.after;
      if (!next) break;
      current = next as unknown as typeof row;
    }
    return current;
  };
  const mappings = document.mappings.map(upgrade);
  const faces = document.faces.map(row => corrections.faces.find(change => equal(row, change.before))?.after ?? row);
  // 번들이 나중에 더한 현대 연애 칩 짝(2026-10-16 흉상·전신): 호스트에 이미 저장된 옛 대응표에는 이 행이 없다 — 없는 행만 채운다.
  // 사용자가 같은 칸을 이미 고쳐 두었으면(행이 있으면) 건드리지 않는다.
  const have = new Set(mappings.map(row => `${row.textureKey}#${row.characterIndex}`));
  const haveFaces = new Set(faces.map(row => row.resourceId));
  const addedMappings = (reviewedCatalog.mappings as typeof mappings).filter(row => BUNDLED_FORWARD_FILL.test(row.textureKey) && !have.has(`${row.textureKey}#${row.characterIndex}`));
  const addedFaces = (reviewedCatalog.faces as typeof faces).filter(row => addedMappings.some(m => m.faceResourceId === row.resourceId) && !haveFaces.has(row.resourceId));
  return schema.parse({ ...document, mappings: [...mappings, ...addedMappings], faces: [...faces, ...addedFaces] });
}
const BUNDLED_FORWARD_FILL = /^tex_oprn_charset_modern\d+$/u;

export function emptySharedCharacterGraphics(): CharacterGraphicsDocument {
  return { schema: "oprn-npc-face-mapping", version: 2, mappings: [], faces: [] };
}

/** Authored from the original sprite/portrait images, shipped to every installation. */
export function defaultSharedCharacterGraphics(): CharacterGraphicsDocument {
  return parseSharedCharacterGraphicsDocument(reviewedCatalog);
}
