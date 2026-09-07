# Dependency-closure repair preparation

These are lead investigation notes for the second deep repair, not an approved
implementation or a relaxation of the reviewer criteria.

## Existing behavior to reuse

- `src/project/webExportAssets.ts:18` owns the actual export collector.
  It includes fixed runtime dependencies, bundled texture references, generated
  assets, battler idle sheets, fallback party art, used uploaded assets, and
  catalog BGM mapping from resource ID to local playback path.
- `collectProjectStrings` deliberately omits `audioDescriptions` and unused
  audio catalog rows, while retaining non-audio resource profiles. Do not turn
  unused audio catalog rows into mandatory playback dependencies.
- `src/project/io/resourceReferenceValidation.ts` contains existing read-only
  resource-ID and authored-field checks. It does not itself prove path closure.
- `src/assets/generatedAssetResourceResolver.ts:293` resolves runtime resource
  IDs through several data catalogs. Those catalogs and fallback rules can
  change independently of Project4. Upload validation cannot use their current
  versions to judge an older retained runtime.
- The existing collector silently omits strings whose URL cannot be resolved
  to a local path. Calling it alone is not sufficient for the reviewer's
  unresolved/external-reference acceptance cases.

## Required architectural boundary

The dependency rule set and resource resolution data must be bound to the
selected operator-retained runtime, not only labeled with a number while
calling live editor modules.

One viable bounded approach is to bundle the existing read-only collector and
its resource catalogs as a self-contained build artifact, retain/hash it with
the runtime, and run only operator-verified collector bytes when validating a
release. A complete immutable declarative contract is also acceptable. Avoid a
second hand-maintained resource-ID catalog or a generic code/plugin platform.

If using bundled collector code:

- It must be self-contained and read-only: no current source, mutable public
  directory, network lookup, or uploader-provided executable authority.
- Bind collector bytes/version into runtime provenance and verify them before
  execution. Do not trust a collector supplied by a release merely because its
  own manifest contains a matching hash.
- Preserve raw project JSON bytes. Analysis must not replace or reserialize the
  release's project payload. Do not import the live editor deserializer as an
  upload-time shortcut.
- Require resolved public dependencies in the verified inventory. Embedded
  upload data must be genuinely valid embedded media, not an external URL
  disguised as an uploaded asset.
- Unknown/external authored references must fail explicitly rather than be
  skipped. Keep the collector's existing distinction between authored usage
  and unused catalog availability.

## Integration with P1

P1 is adding an honest capability boundary for community save isolation.
Preserve that contract and its legacy-manifest handling. Old runtimes lacking
the required shared-origin protection are not eligible for new community
publication; their immutable bytes and independent exports remain untouched.

The older-runtime closure regression should use two supported retained
runtimes with the necessary capabilities, then change/remove current editor
catalogs/assets and verify the older complete release. This must not silently
bless a pre-capability runtime or require current-source equality at upload.

## Decisive tests

Use real declared project dependencies outside `runtime.requiredAssets`:
`cc0-bgm-field` resolves to `assets/cc0/audio/bgm/field-of-dreams.mp3`.
Remove that audio file and a project-used PNG, recompute the manifest/ZIP, and
reject before persistence. Also cover unresolved/external authored references,
complete older-runtime acceptance, and byte-for-byte unchanged project input.

## Feasibility measured by the lead

The existing `webExportAssets.ts` and its data catalogs were bundled in memory
with `Bun.build` (`target: browser`, `format: esm`, minified, `import.meta.env`
defined as an empty object). No repository files were written.

- One output module: 668,997 bytes, no build diagnostics.
- Imported successfully from a data URL and ran on the actual retained
  candidate's project JSON.
- Returned 720 dependencies, including the omitted BGM from the review probe.
- The project object serialized identically before and after collection.
- No external import was found in the generated-source probe.

This demonstrates that freezing the existing collector is practical. It does
not by itself add missing/unresolved-reference checks or prove the final
operator-trust and persistence boundary.

P1 is now committed at `f76bdbe06ff98128b6c9e2bbfef66faba07add44`.
Its optional `RuntimeManifest.capabilities` preserves absence for old manifests,
and current factories bind `community-save-isolation-v1` into the digest.
Community ingress requires that capability. `collectorVersion` remains 1.
