/**
 * Shared DB art prompt builder for item/equipment icons and monster battlers.
 * Scripts-first generation contract — no network side effects.
 *
 * Transparency contract (RM2k3-style):
 * - Model must paint a flat pure magenta #FF00FF chroma-key background (not white/black/checker).
 * - Postprocess (`magentaChromaPostprocess`) forces pure #FF00FF then exports keyed pixels as alpha 0.
 */

export type DbArtPromptKind = "icon" | "monster";

export type BuildDbArtPromptInput = {
  readonly kind: DbArtPromptKind;
  readonly name: string;
  readonly subject: string;
  readonly tags?: readonly string[];
};

/** Required negative / style constraints present for every kind (substring-checked in tests). */
export const DB_ART_PROMPT_NEGATIVES = [
  "no text",
  "no UI",
  "no logo",
  "no watermark",
  "no franchise",
  "no photorealism",
  "single subject",
  "16-bit JRPG",
  "pure magenta chroma key",
  "#FF00FF",
  "not white",
  "not black",
  "not checkerboard",
] as const;

/** Pure RM2k3-style transparent color key. */
export const DB_ART_MAGENTA_HEX = "#FF00FF";

const SHARED_TAIL =
  "16-bit JRPG pixel art, single subject only. " +
  "Background MUST be a flat solid pure magenta chroma key exactly #FF00FF (255,0,255) filling every empty pixel — " +
  "classic RPG Maker transparent color, not alpha, not white, not black, not gray, not checkerboard, not gradient. " +
  "Do not use pure magenta #FF00FF inside the subject silhouette. " +
  "No text, no UI, no logo, no watermark, no franchise copies, no photorealism.";

function normalizeTags(tags: readonly string[] | undefined): string {
  if (!tags?.length) return "";
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  if (!cleaned.length) return "";
  return ` Tags: ${cleaned.join(", ")}.`;
}

/**
 * Build a generation prompt for default DB art assets.
 * - icon: inventory item/equipment icon framing (centered square object)
 * - monster: battler full-body single creature
 */
export function buildDbArtPrompt(input: BuildDbArtPromptInput): string {
  const name = input.name.trim() || "unnamed";
  const subject = input.subject.trim() || name;
  const tagClause = normalizeTags(input.tags);

  if (input.kind === "icon") {
    return (
      `Create a single centered 16-bit JRPG inventory item icon of ${subject} ` +
      `(named "${name}"). Item/equipment icon framing: only the object, high-contrast silhouette, ` +
      `square composition, pixel-art friendly.${tagClause} ${SHARED_TAIL}`
    );
  }

  return (
    `Create a 16-bit JRPG monster battler of ${subject} (named "${name}"). ` +
    `Battler full-body single creature, readable compact silhouette, facing the viewer, ` +
    `game-ready enemy graphic.${tagClause} ${SHARED_TAIL}`
  );
}
