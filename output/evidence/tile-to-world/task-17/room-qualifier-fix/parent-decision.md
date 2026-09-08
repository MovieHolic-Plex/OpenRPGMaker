# Canonical room alias decision

Scope: T17-AV-4 compatibility lookup only. No conversion/schema changes and no parsing opaque canonical IDs.

1. An exact canonical space ID remains authoritative; the binder retains its explicit foreign-atlas error.
2. Scope discovery to the requested/default atlas. For legacy room-name/tag discovery, eligible sources are receipt-mapped original spaces plus non-legacy canonical sources. Unmapped legacy layout-context copies remain available by exact ID, but are not interchangeable short aliases. Do not revive a deleted mapped source from its layout copy. Native user/AI/builtin sources are not hidden behind receipt precedence: genuine same-atlas duplicate names/tags still reject.
3. Reuse the EXISTING PLACE_ALIASES rule in interiorConceptPlan.ts (for example bedroom -> [house,bedroom]) through receipt sourceKey matching. Share the existing table if needed; do not invent another table or select by record order. Apply that legacy shorthand when its qualified mapped original exists, otherwise keep the normal qualified alias lookup. This preserves the unchanged ordinary-interior bedroom test.
4. Name/tag and receipt alias candidates are deduplicated by canonical ID. Multiple eligible candidates remain spatial-ambiguous. Never parse canonical ID spelling or read archived legacy JSON as active authority.
5. Add tests for native-plus-mapped ambiguity, exact access to a layout-context record, deletion of a mapped original, and the existing default shorthand. Preserve the reported converted-label fixture and its expected original-room identity, existing same-atlas duplicate rejection, and legacy interior tests without weakening them.

This is a parent implementation decision within the already authorized compatibility scope, not a new user approval gate.
