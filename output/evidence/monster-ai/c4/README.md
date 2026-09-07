# C4: stale uploaded-image identity authorization

Parent implementation: `22d660389dffad288b00501c9898de6300764f54`.

## Reproduction and fix

The gap was reproduced through real registered uploads, full read tools and the actual AssistantSession. Replacing `assets.uploaded[id].dataUrl` without changing effective metadata left the prior metadata-only fingerprint valid. The session executed both the stale and fresh assignments (`[true, true]`), rather than rejecting the stale attempt (`[false, true]`).

`monsterResourceSnapshot(project, resource)` is now the single full-response/authorization projection. Its `assetIdentity` is `sha256:` plus the digest of the raw ID, encoded upload image source and upload render metadata. Only this compact digest is returned; data URLs/base64 stay local. Both `get_monster_resource` and `list_monster_resources(include:"full")` return it, and the gate compares the same current snapshot.

The synchronous tool contract is preserved by exposing a small synchronous text wrapper over the repository's existing SHA-256 implementation, not introducing a dependency or a new hash algorithm. Standard vectors and an independent Node crypto digest verify it.

The default index remains unchanged. Existing unchanged-art and stat-only edits deliberately remain valid even after an independent upload replacement: this gate governs new/changed selections, not resource editing. Bundled/profile sources are assumed fixed within the running asset build; the digest does not fetch remote content hidden behind an unchanged URL. No model/catalog/schema/persistence/provider changes were made.

## RED / GREEN evidence

| Command/evidence | Observed result |
| --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1 test/monsterAppearanceAssetIdentity.test.ts` (`red.log`) | 11 failed / 10 passed; stale new/changed assignments accepted across three writers and both full readers; session `[true,true]`; asset identity absent |
| `npm test -- --maxWorkers=2 --minWorkers=1 test/sha256.test.ts` (`red-sync-digest.log`) | 3 failed / 3 passed because the synchronous digest entry point did not exist |
| Focused final command below (`green.log`) | 36/36 passed in one run, 4 files, 80.67s |
| `npm run typecheck:app` (`typecheck.log`) | Exit 0 |
| `npm run build:app` (`build-app.log`) | Exit 0; existing mixed-import/large-chunk warnings remain visible |

```sh
npm test -- --maxWorkers=2 --minWorkers=1 \
  test/monsterAppearanceAssetIdentity.test.ts test/sha256.test.ts \
  test/monsterAppearanceTransport.test.ts test/monsterResourceMetadataTools.test.ts
```

The focused suite covers new and changed assignment rejection, reread recovery, unchanged-art compatibility for all three writers, stat-only execution, both full-reader responses, digest equality against Node crypto, absence of image data in responses, existing budget-loss safeguards and the actual session replacement/reread sequence. No previously passing broad suite was repeated. The pre-existing `assistantReadContract` fixture was neither edited nor rerun.

All changed TS files received clean LSP diagnostics; `git diff --check` passed. `loc.txt` records source/test sizes (all below 200 pure LOC). The new snapshot helper has one responsibility and three consumers, no casts/type suppressions, no parameter mutation, no speculative state/cache, no variant switch, no added logging, and no redundant destructive verification. No credentials were reread; no live providers, remote writes, polling or sleeps were used. The child does not expose a monitor tool, so bounded foreground commands were used.

`raw-logs.tar.gz` preserves the byte-exact RED/GREEN/typecheck/build outputs.
