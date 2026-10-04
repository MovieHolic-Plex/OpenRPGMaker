import type { CharsetSemanticEntry, CharsetAge } from '@/assets/charsetSemantics';
import type { Project } from './types';
import type { SharedCharacter, SharedContentSnapshot } from './sharedContentSchema';
import type { GraphicAttributes } from './characterGraphics';
import { jsonEqual } from '@/util/structuralJson';

export const HARNESS_CHARACTER_PREFIX = 'shared_charset_actor_';
let snapshot: SharedContentSnapshot = { revision: '', libraries: {} };
export function installSharedCharacters(value: SharedContentSnapshot): void { snapshot = value; }
export function sharedCharacters(): SharedCharacter[] {
  return Object.values(snapshot.libraries).filter(library => library.projectDefaults)
    .flatMap(library => Object.values(library.characters ?? {}));
}
export function sharedCharacterIndices(assetId: string): number[] | undefined {
  if (!assetId.startsWith(HARNESS_CHARACTER_PREFIX)) return undefined;
  return sharedCharacters().filter(row => row.assetId === assetId).map(row => row.characterIndex);
}
export function sharedCharacterAttributes(row: SharedCharacter): GraphicAttributes {
  const d = row.description;
  return { ...d.attributes, ...(d.gender ? { gender: d.gender.slice(0, 80) } : {}), ...(d.role ? { role: d.role.slice(0, 80) } : {}) };
}
export function sharedCharacterSemantics(): CharsetSemanticEntry[] {
  const ages: Record<string, CharsetAge> = { child:'child', youth:'youth', middle:'middle', elder:'elder', 어린이:'child', 청년:'youth', 중년:'middle', 노인:'elder', 노년:'elder' };
  return sharedCharacters().map(row => {
    const d = row.description, a = sharedCharacterAttributes(row);
    const gender = /^(여|여성|female)$/.test(a.gender ?? '') ? 'female' : /^(남|남성|male)$/.test(a.gender ?? '') ? 'male' : 'none';
    return { textureKey:row.assetId, characterIndex:row.characterIndex, spriteType:'uploaded', label:d.label, gender,
      ...(a.age && ages[a.age] ? {age:ages[a.age]} : {}), appearance:d.appearance,
      tags:[...new Set([...(d.tags ?? []), ...Object.values(a), d.role, d.fits, d.appearance].filter((value): value is string => typeof value === 'string' && !!value))] };
  });
}
/** Add descriptions without changing authored events, residents, or manual face mappings. */
export function ensureSharedCharacters(project: Pick<Project, 'assets' | 'resourceProfiles' | 'charsetLabels'>): boolean {
  let changed = false;
  const semanticsBySlot = new Map(sharedCharacterSemantics().map(entry => [`${entry.textureKey}#${entry.characterIndex}`, entry]));
  for (const library of Object.values(snapshot.libraries)) {
    if (!library.projectDefaults) continue;
    for (const row of Object.values(library.characters ?? {})) {
      const asset = library.assets[row.assetId];
      if (!asset || !row.assetId.startsWith(HARNESS_CHARACTER_PREFIX)) continue;
      const current = project.assets.uploaded[row.assetId];
      if (!current) { project.assets.uploaded[row.assetId] = structuredClone(asset); changed = true; }
      const semantics = semanticsBySlot.get(`${row.assetId}#${row.characterIndex}`)!;
      const label = {textureKey:row.assetId, characterIndex:row.characterIndex, label:row.description.label, tags:semantics.tags, origin:'ai' as const};
      const labels = project.charsetLabels ??= [];
      const index = labels.findIndex(entry => entry.textureKey === row.assetId && entry.characterIndex === row.characterIndex);
      if (index < 0) { labels.push(label); changed = true; }
      else if (labels[index]?.origin === 'ai' && !jsonEqual(labels[index], label)) { labels[index] = label; changed = true; }
      let profile = project.resourceProfiles.find(entry => entry.kind === 'charset' && entry.assetId === row.assetId);
      if (!profile) {
        profile = {kind:'charset', assetId:row.assetId, name:row.description.label, imageWidth:288, imageHeight:256, tileWidth:24, tileHeight:32};
        project.resourceProfiles.push(profile); changed = true;
      }
      const slots = profile.characterSlots ??= [];
      if (!slots.some(slot => slot.characterIndex === row.characterIndex)) {
        slots.push({characterIndex:row.characterIndex, graphicAttributes:sharedCharacterAttributes(row), status:'no-face', faceResourceId:null, quality:'unspecified', note:[row.description.appearance, row.description.fits].filter(Boolean).join('\n').slice(0, 2000)}); changed = true;
      }
    }
  }
  return changed;
}
