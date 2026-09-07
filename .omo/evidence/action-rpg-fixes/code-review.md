# Lead code review

This is the lead's code review record, not an independent approval. The single
gate reviewer separately inspected the original frozen tree and ran 53 passing
tests; its final verdict is held until the current-main integration is reviewed.

## Programming and state ownership

- `assistantSession.ts` captures an owned action receipt before serializing tool
  output. The ledger checks map and current project content, rather than accepting
  model-supplied `pass` fields or JSON copies.
- Intent-owned action targets and explicit verification obligations survive
  replanning. Skipped mandatory checks remain distinct from scheduling completion.
- The current-main integration preserves NPC reward acceptance, per-map build
  specifications, dependent-call deferral and target-specific retry accounting.
  It does not replace them with the action-only contract.
- `sceneTestRunner.ts` validates the full script before executing it, including
  upstream reward checkpoints, targeted interactions and reward-delta assertions.
  Malformed navigation remains an execution error; valid failed navigation
  remains a negative scenario result.
- Coordinate normalization must not invent `to` for a schema that owns `x/y`.
  A failing regression and the actual scene-repair consumer establish this
  distinction while existing nested-rectangle coercion remains covered.
- New-project title propagation uses the existing title defaults and respects a
  separately authored title. The transactional path still clones before save.

## Runtime, cancellation and side effects

- The probe uses a copied project and the actual compiled player/store shim.
  Outcome hooks sit at real hit, damage, dodge-rejection and reward paths.
- Cancellation and deadlines remove listeners, frame and blob URL. Normal
  exports do not enable the private probe merely by containing these modules.
- Receipt identity, revision/map mismatch, stale proof, cancelled runs and
  forged copies have focused negative tests. Full-project hashing is kept out
  of per-frame evaluation; measured cost is recorded rather than hidden.
- Enemy resource/map/troop validation precedes mutation. Explicit spawn IDs
  update one definition; omitted IDs retain append semantics.

## User surface and regression evidence

- The HUD reads the same effective equipment projection used by combat and
  includes weapon identity/name in its update signature.
- The HUD unit test proves name rendering, not the projection alone. Actual
  player/menu inspection and keyboard combat supply the integration evidence.
- Generated guide text shares the canonical bindings. Its predicate-validity
  test is not exhaustive proof against every future omitted key; the current
  displayed controls were also checked in the authored guide and player HUD.
- Default guide portraits are not guessed; explicit portrait authoring and
  ordinary NPC behavior are retained.
- Non-action battle contact and mixed farming/action HUD were exercised in the
  real player. No pixel-level aesthetic approval is claimed because image
  attachments were unavailable to the review models.

No unrelated baseline failures, snapshots or CSS thresholds were changed to
manufacture a green repository gate. The comparison and real-surface evidence
are recorded in `verification.md` and `baseline-comparison.json`.
