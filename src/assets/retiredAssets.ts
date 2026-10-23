/**
 * Resource ids whose art was deleted from the repository and must never be resolved to a file again.
 *
 * 2026-10-07 copyright purge: every EasyRPG chipset sheet (`assets/easyrpg-chipset-*.png`, including the
 * old default "combined town" sheet) was removed. Projects saved before that still carry the texture keys
 * (`tex_easyrpg_chipset_*`) in tilesets and resource profiles. Resolving them to the old path produced a
 * request for a file that no longer exists, which made every web export fail.
 *
 * Callers check this only after normal resolution found no file, so a live asset is never skipped.
 * Export and release collection skip these ids and report them instead of failing.
 * The player draws nothing for them (same as before: the file was gone).
 */
const RETIRED_RESOURCE_ID_PREFIXES: readonly string[] = [
  "tex_easyrpg_chipset_",
  // Same purge, catalog ids of the removed EasyRPG categories (easyrpgRtp.ts now lists only
  // charset/faceset/music/sound). Live ids still resolve first; this only names what is gone.
  "easyrpg-chipset-",
  "easyrpg-battle-",
  "easyrpg-backdrop-",
  "easyrpg-title-",
  "easyrpg-system-",
  "easyrpg-system2-",
  "easyrpg-game-over-",
  "easyrpg-picture-",
];

export function isRetiredResourceId(id: string): boolean {
  return RETIRED_RESOURCE_ID_PREFIXES.some((prefix) => id.startsWith(prefix));
}
