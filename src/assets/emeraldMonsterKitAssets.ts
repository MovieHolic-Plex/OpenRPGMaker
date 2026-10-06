// Original native variants; structural numbering remains owned by monsterKitSheets.
import index from "./emeraldMonsterKitIndex.json";
export const EMERALD_MONSTER_KIT_SHEETS = index;
export const EMERALD_MONSTER_KIT_CHIPSET_ASSETS = index.map(({ textureKey, path, name }) => ({ textureKey, path, name }));
const BY_TEXTURE = new Map(index.map((entry) => [entry.textureKey, entry]));
export function emeraldMonsterKitSheet(textureKey: string) { return BY_TEXTURE.get(textureKey); }
