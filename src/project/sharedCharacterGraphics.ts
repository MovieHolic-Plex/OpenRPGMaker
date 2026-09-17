import { applyCharacterGraphicsImport, exportCharacterGraphics, parseCharacterGraphicsImport, type CharacterGraphicsDocument } from "./characterGraphics";
import type { Project } from "./types";
import { emptySharedCharacterGraphics } from "./sharedCharacterGraphicsSchema";
export { SHARED_CHARACTER_GRAPHICS_ENDPOINT, emptySharedCharacterGraphics } from "./sharedCharacterGraphicsSchema";

/** A catalog projection, never a game document: only the graphic model may consume it. */
export function sharedCharacterGraphicsProject(document = emptySharedCharacterGraphics()): Project {
  const project = { assets: { uploaded: {} }, resourceProfiles: [], charsetLabels: [] } as unknown as Project;
  applyCharacterGraphicsImport(project, parseCharacterGraphicsImport(document, project));
  return project;
}

export function validateSharedCharacterGraphics(value: unknown): CharacterGraphicsDocument {
  const parsed = parseCharacterGraphicsImport(value, sharedCharacterGraphicsProject());
  // Imports may omit v1 attributes. Normalize against the bundled catalog before persisting.
  const project = sharedCharacterGraphicsProject();
  applyCharacterGraphicsImport(project, parsed);
  const complete = exportCharacterGraphics(project);
  const keys = new Set(parsed.mappings.map(row => `${row.textureKey}#${row.characterIndex}`));
  const faces = new Set(parsed.faces.map(row => row.resourceId));
  return { ...complete, mappings: complete.mappings.filter(row => keys.has(`${row.textureKey}#${row.characterIndex}`)), faces: complete.faces.filter(row => faces.has(row.resourceId)) };
}
