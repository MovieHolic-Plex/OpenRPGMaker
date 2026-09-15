// Type declarations for oprnEnv.mjs (legacy RPG_ZZU_* / RPGZZU_* → OPRN_* environment aliases).

export interface LegacyEnvAlias {
  /** The old name that was found (kept in place). */
  readonly legacy: string;
  /** The OPRN_* name the value was copied to. */
  readonly next: string;
}

/**
 * Copies every `RPG_ZZU_X` / `RPGZZU_X` entry to `OPRN_X` when the new name is unset and warns once
 * per legacy name on stderr. Idempotent; works on `process.env` (default) or any env-shaped object
 * such as the result of Vite's `loadEnv`.
 */
export function applyLegacyEnvAliases(
  env?: Record<string, string | undefined>,
  warn?: (message: string) => void,
): readonly LegacyEnvAlias[];
