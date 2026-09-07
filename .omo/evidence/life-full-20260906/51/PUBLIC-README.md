# Public-safe plan51 archival subset

This is archival preparation only. No staging, commit, product QA, additional recovery, source edit, or approval was performed. The original partial-evidence limits in `RECOVERY.md` remain unchanged.

## Publication boundary

Use **only the exact repository-relative paths in `PUBLIC-stage-list.txt`** for any later authorized publication. Do not use `git add .`, directory-wide staging, globbed gzip staging, or the historical `SHA256SUMS`/`PROVENANCE.json` as a publication list. Those historical manifests deliberately reference the full forensic collection, including private-only records.

Original reasoning-bearing event gzip files remain untouched locally in evidence51 and are excluded from the public stage list. Exact copies are privately retained under:

`/home/main/z-project/rpg-zzu/.git/life-full-20260906-forensic-private/51/`

All retention directories have mode0700 and files mode0600. Creation was exclusive/no-clobber and both compressed and decoded bytes were compared. `PUBLIC-PRIVATE-RETENTION.json` records paths, hashes, permissions and comparison results without private payload text. The private directory's own `RETENTION.json` is a private hash/path inventory, not a publication artifact.

The structural scan finds **31 reasoning blocks in 30 original assistant-event gzip files**: event `st_01a07972` line98 has two blocks. Counts distinguish blocks from files. All 30 files are excluded; no synthetic redacted-original files were created. Existing exact decoded tool-call arguments/results, original tool-result events and safe structured event records are retained publicly where they pass inspection. Ordinary explanatory words in source comments, tool arguments or prose do not cause exclusion.

`PUBLIC-MANIFEST.json` is the authority for the public subset. Its `private_retained` entries are hash/path references only, explicitly excluded from publication. Full original `PROVENANCE.json` remains unchanged and public-safe as provenance references; it does not contain the referenced private event payloads. References are not inclusion instructions.

## Checks and limits

`PUBLIC-SAFETY-SCAN.json` records structural inspection and recognized credential-pattern results. Compressed files were decoded before inspection; JSON/JSONL, nested JSON-encoded fields and tool arguments/results were inspected. No reasoning/secret payload text is printed in scan receipts. Pattern-based credential checks cannot prove absence of every possible opaque/encoded secret.

`PUBLIC-PRESERVATION.json` records exact hashes of the pre-existing files and confirms they remained byte-identical. The source9 backup files, `SOURCE-MANIFEST.json`, recovery originals, original manifests, and original/parent forensic checkers were not modified. The two task-metadata lifecycle drifts documented by the parent remain precisely scoped; immutable event validation was not relaxed.

Run the portable subset validator, if needed, from a Python3 environment:

```
python3 .omo/evidence/life-full-20260906/51/verify-public.py
```

It reads only the public manifest and explicitly listed public files, compares compressed/plain and decoded hashes, checks the exact stage-list set, and repeats structural/credential inspection. It needs neither private Git metadata nor live session/product paths. It does not run tests/build/probes, reconstruct evidence, authenticate the manifest against an external authority, or establish original execution truth. Compare its reported manifest hash with the separate preparation receipt through a trusted channel.

`PUBLIC-VERIFY.json` is the local result of the actual portable verification execution. It is intentionally not in the frozen stage list or manifest: it is a post-manifest receipt, avoiding circular hashing. Its contents are safe to share separately as a receipt; do not silently add it to the frozen subset. The manifest itself is the one stage-listed control file without a self-hash entry. The stage list is hashed by the manifest and verified against the manifest set.

The original `verify-recovery.py` and the parent's precise-lifecycle-exception checker are **full local forensic tools**, not portable public-subset validators. Their event/source-offset checks require the complete privately retained reasoning-bearing source records plus the authorized immutable session files, source evidence and source tree; private event gzip copies alone do not replace complete original session files. They must not be weakened to accept absent private records or advertised as passing solely on the public export. Do not run the one-shot recovery/preparation scripts again or execute archived original commands as part of public verification.

No missing full r2 logs/state captures/import-resolution/final-source receipt were recovered in this turn, and none is fabricated. Counts/exit lines remain partial original evidence, the failed build remains failed, and no product approval follows from safe archival or hash verification.
