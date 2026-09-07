# Plan49/50 retirement archive prepared; no teardown

Evidence is prepared, but removal is blocked pending secret-file disposition,
coordinator archival commit and fresh owner/activity checks. Both old trees
remain intact. No source verdict is changed and no product QA was performed.

## Identity and rules

Parent inspected: `f12c7a7909e48e0947f883b2254a883df254008a`. Both old HEADs are
`462a7f3425079abc94fefafe2142dfcd5b42b034`; the producer retains its branch and the verifier is detached.
Source commit ancestry and exact owned source/input bytes against the committed
parent were checked independently of ancestry. `readiness.receipt.json` records
all seven available owned source/input hashes per populated tree, lock metadata,
tracked status, ordinary and ignored untracked inventory, activity limitations,
resource measurements and removal blockers.

Read plan49/50, AGENTS worktree instructions and
`openwiki/agent-worktrees.md` retirement rules: uncommitted files are not protected
by Git, inspect ignored/new files before removal, retain branches and stop rather
than force away unknown data. Old core SUMMARY and independent VERIFY remain
historical evidence, including success, failure and setup errors. No new code,
scene/UI, whole task12 or overall approval is inferred from this archive.

## Complete recovery mapping

`coverage.manifest.json.gz` contains 23597 per-file records across both
roots. Each record maps an old absolute path to a reachable Git commit/blob,
byte-identical committed parent evidence (prefer verified gzip), or a new gzip
payload requiring coordinator commit. Populated files have SHA256 and size;
sparse-absent tracked entries have exact Git blob hashes and original paths.
Tracked public assets stay in reachable Git, not copied into this archive.
Tracked .env.example templates are mapped to reachable Git blobs without reading
their contents; they are not secret-disposal blockers.
CLAUDE.md is excluded by instruction. `.git`, dependency links and secret config
are metadata-only exceptions in the receipt, not silently claimed archived.

17 unique new gzip payloads preserve missing evidence without
text normalization. Existing committed evidence was read from Git objects, not
assumed committed from its working-copy location. All evidence kinds are mapped,
including independent source identity, error traces, probe scripts and public
state/save captures. No image interpretation or browser inspection occurred.

`archive.stage-list.txt` is the exact repository-relative list of NEW files for
coordinator review and commit. Reused committed paths are in the coverage
manifest and need no restaging. Do not recursively stage either old tree.

## Read and recover

From the parent repository root:

```sh
gzip -cd -- .omo/evidence/life-full-20260906/49-50/coverage.manifest.json.gz | less
```

For a manifest recovery record with a commit, use
`git show '<commit>:<path>'` to read the original when encoding is identity.
For gzip encoding use `git show '<commit>:<path>' | gzip -cd`.
For a new archive use `gzip -cd -- '<path>'` locally, or the same `git show`
command with the coordinator's future archival commit after it exists.
Check recovered SHA256 and size against the original record. Use gzip, not
unzip. Redirect only to a NEW recovery destination, never over an old original.
Symlink records represent link-target bytes, not target contents. Git blob IDs
for sparse-absent files can be checked using `git hash-object --stdin` on the
recovered bytes without writing an object.

`readiness.receipt.json` records an independent decode/reread pass and checks
that hashed originals retain bytes, modes and modification timestamps. Resource
counts do not follow dependency symlinks. Reclaimed space is exactly zero.

## Removal blockers and safe later sequence

Both `.env.local` files are regular ignored secret configurations, not symlinks.
Their contents were neither read, hashed nor archived. Ownership/disposition
must be explicitly resolved by the coordinator; apparent adopt provenance is
not proof that unique secrets may be discarded. Any process references or
unfamiliar files listed in the receipt are additional blockers. Process scans
are point-in-time and cannot certify idle external agent sessions are finished.

Before teardown: review and commit the complete stage list; verify recovery
from that committed archive; resolve secret disposition; confirm both old
owners are finished; recheck HEAD, tracked status, ordinary/ignored untracked
files and locks, and stop if anything differs from this receipt. Preserve the
producer branch and source commit reachability. Never touch active
spatial-rights or spatial-rights-verify-r2 trees or shared dependency targets.

These exact commands are documentation ONLY, conditional on all prerequisites
and separate coordinator teardown authorization. No command below was executed:

```sh
# Only if the old verifier is still locked and its owner has released it:
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree unlock /home/main/z-project/rpg-zzu-life-full-placement-core-verify
# No force flags; retain the producer branch and stop on any refusal:
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree remove /home/main/z-project/rpg-zzu-life-full-placement-core
git -C /home/main/z-project/rpg-zzu-life-full-p4 worktree remove /home/main/z-project/rpg-zzu-life-full-placement-core-verify
```

Do not substitute `rm -rf`, force removal, branch deletion or shared-cache
cleanup if Git refuses. The coordinator must record actual later removal and
space recovery separately; this preparation is not a removal receipt.
