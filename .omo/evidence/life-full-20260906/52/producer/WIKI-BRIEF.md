# Fact-only brief for final Astra docs step

Do not apply this brief during Task52 production: the three carryover wiki files must remain byte-identical until the final combined docs step.

Suggested location: `openwiki/runtime-project-schema.md`, player body / placement safety persistence context.

- Existing `SystemRecords.playerFootprint?` and `playerPassRows?` survive `normalizeSystemRecords`, which the public Project parser calls. This fixes loss of authored 3x3/passRows1 settings on reload; it introduces no setting or version bump.
- Direct system normalization reuses `normalizeCharacterFootprint` (axes 1..8, malformed axes resolve to1) and `normalizePassRows` (valid rows bounded by normalized height, malformed rows use the full height). Fields with undefined/absent input remain omitted independently.
- Strict public wire shape validation is unchanged: malformed geometry is rejected, not silently accepted. Direct in-memory normalization and public JSON validation are separate existing boundaries.
- Resolution remains session override -> project-authored field -> default; missing passage rows use resolved full body height. Player body, passage, movement and rendering rules are unchanged.
- Project4 and Save4-to-Save5 behavior remain unchanged. Do not claim session body override persistence: no new Save contract was added or tested as such.
- Public nonvisual proof retained at `.omo/evidence/life-full-20260906/52/producer/`: behavioral RED, 135/9 GREEN, actual disk Project input -> deserialize -> startSession -> resolvePlayerBody, repeat normalization/IO stability, Save5 creation/apply using authored body, diagnostics and app typecheck.
- ProjectSession does not declare authored farmPlots; new sessions intentionally start with empty plots. Native fixture QA must till or use declared valid Save input.
- This receipt does not certify native player.html behavior, Task12, Phase4 or the overall goal. Native prerequisites, final combined full build, docs generation and commit belong to the later delivery node.

After applying the final facts, regenerate INDEX with the canonical generator; do not hand-edit its coordinates.
