/** Small props need a visible support surface, never a spare floor cell.
 * IDs are resolved through frozen graphic identity by the concept composer.
 * Large floor pots and storage vessels are deliberately absent.
 */
export const INTERIOR_SURFACE_PROP_IDS: ReadonlySet<string> = new Set([
  "cauldron", "vase_flowers", "jars", "bottle_set",
]);

/** Opaque tabletops and cabinet tops leave the upper layer available for props.
 * Aprons, seats, filled shelves and transparent upper-layer tables are not tops.
 */
export function isInteriorPropSurface(tile: number): boolean {
  return (tile >= 156 && tile <= 161) || (tile >= 186 && tile <= 191) || (tile >= 18 && tile <= 20) || tile === 148;
}
