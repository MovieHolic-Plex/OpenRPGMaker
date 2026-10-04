# Read-only adversarial audit — quality_gate.py

Scope: inspected implementation and call sites without editing source/art, forging files, running the gate or running suites. These are code-derived failure paths, not claimed executed exploits. The real v4 review remains a genuine recorded85/100 decision for its original PNG/GIF hashes.

## Confirmed defects

### P2:16pose comparisons omit four visible GIF columns(lines64–68)
The68px GIF layout compares x0..15,17..32,34..49,51..66. Columns16,33,50,67 are never validated. Each can contain opaque colored pixels in all32rows and all4frames; native poses remain identical and all16comparisons pass. Thus “actual GIF contains only these native poses” is stronger than the code guarantees. Check every gutter pixel for alpha0, or build/compare the full68x32 expected frame including gutters.

### P2:prepared decoded contact overlays native thumbnails over enlarged feet(lines103–105)
The enlarged frame occupies y25..152 for each160px band. The native strip occupies y120..151, x20..87, overlapping the first direction's enlarged lower body. Viewed v4/quality/decoded-gif-contact.png: the native sprites visibly run across the enlarged up-facing lower body/feet. This weakens precisely the gait evidence the critic needs. Place1x and4x strips in disjoint regions; expand height or horizontal layout. My independent v4contacts were generated without overlap, so this does not invalidate that specific review.

### P1:snapshot and digest are read at different times(lines48/53/78,154/159/161)
PNG is decoded before its path is hashed. GIF is decoded before its path is hashed. Reviews/package are parsed before final file SHA is computed. A file replacement during these intervals can bind a digest for uninspected/unjudged bytes to an earlier decoded/accepted object. This contradicts the stated same-bytes guarantee even though the normal current run may be stable. Read bytes once, compute SHA from those bytes, decode JSON/images from the same bytes, and carry those captured digests into the final artifact. If downstream shipping reopens paths, verify final emitted bytes again.

### P2:evidence validation accepts unrelated files(lines121–124,134,158)
Any existing file with a matching digest is sufficient; one text file or another character contact satisfies the check. Neither package evidence nor review evidence is derived/compared with the measured sheet/GIF. Replacing evidence entries while keeping correct sheet/GIF/rubric fields can therefore pass. At minimum require the prepared expected native and decoded contacts, bind them to the package snapshot, and require review attestation for this package; retain additional independent contacts as supplemental evidence.

## Trust and record limitations

### Declared independent identity can be the same artist(lines128–131)
`reviewer='root '` is nonblank and differs from the raw string'root', so it qualifies as independent. More fundamentally, clone a root review and change reviewer to any other name: no actor/session/origin authentication exists. Two JSON hashes prove two records, not two independent judgments. Normalize names and reject root aliases to avoid accidental bypass, then describe this as a trust-based review ledger unless trusted session identities/signatures are available. The limitation string at163 already acknowledges part of this limitation.

### Complete review and browser playback are not enforced(lines132–146)
The reviewer can explicitly provide allTwelvePosesViewed=false or browserPlaybackWatched=false and still pass; these fields are ignored. A15character generic reason reused on every axis passes as “specific.” decodedFrames=4 proves the inspector decoded4frames and the record copied that number; it does not prove the reviewer looked at all frames. Static contacts cannot establish subjective smoothness as strongly as actual animation playback. Add explicit coverage/loop attestations and browser evidence where required, while stating that attestations still rely on a trusted reviewer.

### Current artifact scope ends at reviewed PNG/GIF
The gate binds quality_gate.py, source sheet, GIF and rubric. It does not bind hero.py/builder, native adapter/output bytes, role/candidate provenance or canonical reload/runtime. A shipping process must verify emitted native bytes equal the approved sheet and require this gate. Current rg search in src/harnesses/pokemon-character-motion, scripts, harness-data/pokemon-character-motion and the focused wiki found quality_gate references only in quality_gate.py; integration was still in progress during this audit. Do not infer build enforcement from standalone pass:true.

### Fixed rubric does not make85an aesthetic fact
FrozenSHA prevents silent threshold relaxation. Exact score ranges/minima, recomputed sum and stale PNG/GIF rejection are useful. The gate still accepts structurally compliant bad art when trusted records award inflated scores; this is inherent to recorded human/agent art judgment. v4passed exactly85, with rectangular torso/flat pack/close navy values retained as explicit nonblocking limitations. Preserve these reasons alongside approval and independent playback inspection.

## Priority

1.Capture immutable bytes/digests together and repair contact overlap.
2.Validate transparent GIF gutters and derive mandatory evidence from approved snapshots.
3.Normalize identity; distinguish declared reviews from authenticated independent review.
4.Bind the actual shipping output and playback receipt rather than treating the JSON as proof of them.
