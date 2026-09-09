# Task12 attempt1 preservation only

This directory is a byte-preserving checkpoint, not approval, a new code handoff,
or authorization to stage or commit. No tests, builds, source/docs edits, image
interpretation, staging, commits or cleanup ran during this preservation.

`current/` contains all 14 current files as deterministic gzip streams, including
both untracked files. `base/` preserves the 12 files present in the base commit.
The two files absent from base are explicitly marked in MANIFEST.json.
`git-diff--binary.patch.gz` is exact stdout from `git diff --binary`; Git excludes
untracked files from that diff, so their full current gzip backups are essential.
All streams were decoded and compared byte-for-byte with their inputs.

SAFE-STAGE-LIST.txt is an explicit candidate source/test/wiki allowlist only.
It is not executed and does not authorize staging now. It intentionally excludes
all producer/build evidence, this preservation directory, unrelated parent
material, credentials and private reasoning. A future authorized delivery owner
must revalidate corrected bytes and criteria before using any stage list.

Upstream path correction: the coordinator confirms the correct core receipt is
`.omo/evidence/life-full-20260906/47-48/VERIFY.md`. It exists and was read in this
preservation turn. The earlier `parent47-48` shorthand was a coordinator wording
error, not an unavailable core receipt. The first missing-path diagnosis remains
unchanged as history in build/SUMMARY.md, build/NEEDS-FIX.json and associated
receipts. No producer/build evidence was rewritten. This correction neither
clears the recorded UI/test/native blockers nor grants any approval.

Only this new directory was written. MANIFEST.json records base/current commit
identities, per-file base/current hashes, compressed hashes, decoded equality,
initial/final dirty status equality and unchanged producer/build evidence hashes.
