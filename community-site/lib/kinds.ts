export const ASSET_KINDS = [
  "chipset", "charset", "faceset", "monster", "backdrop", "picture",
  "system", "system2", "title", "battle", "battleCharset", "battleWeapon",
  "gameOver", "music", "sound",
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const GALLERY_KIND_FILTERS: readonly AssetKind[] = ASSET_KINDS;

export const AUDIO_KINDS: ReadonlySet<string> = new Set(["music", "sound"]);

export const LICENSES = ["CC0", "CC-BY", "CC-BY-SA", "OGA-BY", "GPL-3.0", "All rights reserved"] as const;

export function isAssetKind(kind: unknown): kind is AssetKind {
  return typeof kind === "string" && (ASSET_KINDS as readonly string[]).includes(kind);
}

export function isLicense(value: unknown): value is string {
  return typeof value === "string" && (LICENSES as readonly string[]).includes(value);
}
