// Experiment-local install of the ramp/stair pieces: adds `pieces` to the relief art of the village style in THIS process only
// (rampArt.json on disk and the bundle are untouched; the game keeps its old stair art until someone bundles the pieces).
import rampArt from "../../../../src/project/relief/rampArt.json";
export const STYLE = "grass-steps";
/** pieces.json: { "<ramp|stairs>:n:<w>x1:<rise>": { w, h, rgba[] } } */
export function installPieces(pieces: Record<string, { w: number; h: number; rgba: number[] }>): void {
  const art = (rampArt as any)[STYLE];
  if (!art) throw new Error(`no relief art for ${STYLE}`);
  art.pieces = { ...(art.pieces ?? {}), ...pieces };
}
