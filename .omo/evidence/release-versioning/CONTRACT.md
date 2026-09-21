# Versioned game releases

## Authorization and completion

The user approved implementation of the editor/runtime versioning analysis in a
new worktree, a PR, deep repairs for every ultrabrain change request, repeated
ultrabrain review, and merge only after explicit ultrabrain approval.

Worktree: `/home/main/z-project/rpg-zzu-release-versioning`.
Branch: `agent/release-versioning`.
Starting revision: `5d2649d0c`.
Do not include unrelated dirty changes from the shared main worktree.

## Product contract

Published games must keep their exact project, executable runtime, and required
asset bytes when the editor or default runtime changes. This is a prospective
guarantee, not a claim to reconstruct engines used by legacy projects.

Keep editor version, runtime version/build identity, project schema, game
release identity, and save schema/compatibility separate.

1. Authoring data has a stable game identity independent of title, author, slug,
   and the editor's current LegacyDb connection.
2. Publication settings preserve an explicit runtime target and save
   compatibility identity. Reading or validating legacy data does not generate
   random identity or silently opt into a new engine.
3. A self-contained release binds exact project bytes, a trusted retained
   runtime, all required asset bytes, entry paths, and save compatibility.
   Existing SHA-256, ZIP/path collision, and SDK contracts are reused.
4. Every release payload is listed and hashed. The manifest excludes itself
   from its payload inventory and hashes a canonical body for release identity.
   Project bytes must not be normalized again when copying or serving releases.
5. Exported ZIP and standalone HTML retain provenance. Standalone JS/CSS and
   embedded asset payloads are verified; it cannot silently fetch current
   dependencies. Unsupported or unavailable targets fail visibly rather than
   falling back to the current engine.
6. Runtime archives survive normal dist rebuilds and retain old builds without
   overwriting content under an existing digest. New projects/publication may
   use the default build, but already selected targets remain selected.
7. Community publication stores self-contained immutable release bytes using
   existing PostgreSQL storage. Playback serves only that release's entries,
   with no current-editor deserialization or shared player/public fallback.
   Anonymous upload must not introduce arbitrary executable code: compare with
   operator-trusted runtime artifacts or assemble from those artifacts on the
   server. A supplied digest by itself is not executable trust.
8. Each listing has an immutable release association. New versions may be new
   listings; this work does not add anonymous ownership/update authorization.
   Release insertion and listing association are transactional.
9. Legacy community packages remain downloadable and unmodified. Legacy play
   uses explicitly retained compatibility runtime/assets, or a clear unavailable
   state when no retained compatibility runtime exists. GET performs no release
   creation, upgrade, normalization write, or asset installation.
10. Identity-bearing saves use game and compatibility namespaces. Save
    compatibility is directional and explicit, not inferred from equal project
    schema or engine version. Wrong games/lineages are rejected before apply.
    Accepted old saves are copied to the new namespace without overwriting the
    predecessor. Existing Save4/5 paths remain readable; legacy adoption is
    explicit, never a scan of arbitrary title/slug namespaces.
11. A usable editor action exposes identity/version/runtime target and explicit
    preparation, fork, and engine upgrade. Upgrade changes the draft, preserves
    game identity, and defaults to a new save compatibility lineage. Cancel
    changes nothing. Reuse current menu/modal/persistence primitives.
12. Preview must use the selected runtime or clearly identify a current-engine
    preview; do not imply selected-runtime parity while using a newer engine.
    Published releases never change during draft edits or upgrades.

## Scope and implementation discipline

- Keep the monorepo and existing Vite, npm, Vitest, Node test and PostgreSQL
  stack. No new blob platform, ownership system, general release orchestrator,
  engine behavior rewrite, or unrelated UI redesign.
- Add small contract modules rather than duplicating existing ZIP, manifest,
  hash, asset collector or modal logic. Do not build a second deserializer.
- Existing project schema4 and save migration semantics must remain usable;
  introduce an explicit new save wire version if older readers would lose new
  identity semantics.
- Asset closure and byte provenance matter more than an optimization. Preserve
  existing pruning only when it still proves the selected runtime's dependency
  closure. Do not weaken collision, stale-source or integrity guards.
- Use deterministic red-to-green tests at the real behavior seams. No sleeps,
  broad module mocks, prose assertions, failure suppressions, skipped tests, or
  loosening of existing assertions merely to pass.
- Source and test file edits use apply_patch. Read before editing.
- Only one coding agent edits this worktree at a time. The lead owns final gates,
  build, manual QA, commits/PR and merge. A child may commit verified coherent
  increments when explicitly authorized, but may not push or merge.
- This is engine/editor/platform code, not authored game content. Use isolated
  narrow fixtures and temporary database schemas for persistence verification.
  Do not publish test games into shared production rows.
- Update focused OpenWiki pages for the new contracts and operational commands.

## Acceptance evidence

1. Rename/save/project package round-trip keeps identity; explicit fork changes
   identity and isolates saves.
2. Legacy project versions still read; validation alone creates no random ID.
3. ZIP/HTML identify and verify their runtime and complete packaged dependencies.
4. Tampered, duplicate, traversing, missing, or undeclared files fail closed.
5. Release A plays with unchanged payload hashes after default runtime/assets
   are replaced or absent.
6. Explicit draft upgrade produces release B while A and A's saves stay usable.
7. Missing/unsupported target never silently substitutes the default runtime.
8. Wrong-game/unaccepted-lineage saves fail; accepted predecessor and explicit
   legacy import preserve original bytes and live state on failure.
9. Standalone gameplay boots offline through file:// using retained payloads.
10. Community upload and immutable URL work on the real route; arbitrary
    executable uploads cannot gain community-origin execution.
11. Transaction failures leave no partial listing/release association; concurrent
    duplicate publication cannot replace a retained release.
12. Legacy GET/download are read-only and use no current runtime fallback.
13. Editor prepare/upgrade/fork/cancel work through visible controls, preserve
    focus and normal persistence, and identify preview semantics accurately.
14. Typecheck, focused tests, Node artifact contracts, build, and full gates are
    measured against the clean starting revision. Pre-existing failures remain
    explicitly reported, never relabeled as passing.

## Starting evidence

- `npm run typecheck:app`: exit 0.
- Six focused export/save/migration Vitest files: 49 passed, exit 0.
  Report: `.omo/release-versioning-baseline-vitest.json`.
- `node scripts/run-node-tests.mjs playerArtifact playerRelease communityPlay playerBoot`:
  85 passed, exit 0.
- No implementation edits preceded these runs.
