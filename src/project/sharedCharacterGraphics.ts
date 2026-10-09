import { applyCharacterGraphicsImport, exportCharacterGraphics, parseCharacterGraphicsImport, type CharacterGraphicsDocument } from "./characterGraphics";
import type { Project } from "./types";
import { emptySharedCharacterGraphics } from "./sharedCharacterGraphicsSchema";
import { ensureSharedCharacters, HARNESS_CHARACTER_PREFIX } from './sharedCharacters';
export { SHARED_CHARACTER_GRAPHICS_ENDPOINT, emptySharedCharacterGraphics } from "./sharedCharacterGraphicsSchema";

/** A catalog projection, never a game document: only the graphic model may consume it. */
export function sharedCharacterGraphicsProject(document = emptySharedCharacterGraphics()): Project {
  const project = { assets: { uploaded: {} }, resourceProfiles: [], charsetLabels: [] } as unknown as Project;
  ensureSharedCharacters(project);
  applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(availableMappings(document, project), project));
  return project;
}

export function validateSharedCharacterGraphics(value: unknown): CharacterGraphicsDocument {
  const projectForParse = sharedCharacterGraphicsProject();
  const parsed = parseCharacterGraphicsImport(availableMappings(value, projectForParse), projectForParse);
  // Imports may omit v1 attributes. Normalize against the bundled catalog before persisting.
  const project = sharedCharacterGraphicsProject();
  applyCharacterGraphicsImport(project, parsed);
  const complete = exportCharacterGraphics(project);
  const keys = new Set(parsed.mappings.map(row => `${row.textureKey}#${row.characterIndex}`));
  const faces = new Set(parsed.faces.map(row => row.resourceId));
  return { ...complete, mappings: complete.mappings.filter(row => keys.has(`${row.textureKey}#${row.characterIndex}`)), faces: complete.faces.filter(row => faces.has(row.resourceId)) };
}

/** Withdrawing a kept candidate must not make the remaining shared face catalog unreadable. */
function availableMappings(value: unknown, project: Project): unknown {
  const document = typeof value === 'string' ? JSON.parse(value) : value;
  if (!document || typeof document !== 'object') return document;
  const record = document as {mappings?: unknown};
  if (!Array.isArray(record.mappings)) return document;
  return {...document, mappings:record.mappings.filter((row: {textureKey?: unknown}) => typeof row?.textureKey !== 'string'
    || !row.textureKey.startsWith(HARNESS_CHARACTER_PREFIX) || !!project.assets.uploaded[row.textureKey])};
}
