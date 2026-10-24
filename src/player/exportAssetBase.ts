/**
 * Where the shipped player looks for authored public assets (`assets/...`).
 *
 * Two layouts ship the same `player.html`:
 * - Exported game (zip / desktop / runtime QA): `player.html` sits next to `assets/`, so the base is the
 *   player's own directory.
 * - Hosted editor build (`npm start`, Electron host, any static host of `dist/`): the player lives in the
 *   reserved bundle folder `/export-player/` (see WEB_PLAYER_BUNDLE_BASE) and the public art/BGM live one
 *   directory above, at `dist/assets/`. `export-player/assets/` only holds the player's own JS chunks, so
 *   resolving art there 404s every texture and track (pink-and-black tiles, silent title).
 *
 * The exporter never writes a folder named `export-player`, so the folder name identifies the host layout.
 */
export const HOSTED_PLAYER_FOLDER = "export-player";

export function exportAssetBaseFor(documentBaseUri: string, options: { readonly editorProbe?: boolean } = {}): URL {
  const here = new URL(".", documentBaseUri);
  const hosted = here.pathname.endsWith(`/${HOSTED_PLAYER_FOLDER}/`);
  return new URL(options.editorProbe === true || hosted ? "../" : ".", here);
}
