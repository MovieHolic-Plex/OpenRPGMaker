# Completed lossless nonvisual evidence archive

Mechanical archival only. The original `VERIFY.md` and all original evidence
remain unchanged. Validation identity is
`b5c679efc6c5e575f7a1afb65dfa86939aade325`: **224/224 tests across 14/14
nonvisual files passed**, while the independent recovery-rights criterion
returned **exit1, a genuine conservation failure**. The earlier clone fixture
error remains separate. This archive does not approve product behavior, whole
task12, Phase4, or the overall goal, and does not represent source corrections
or new validation.

## Authoritative archival files

- `ARCHIVE.originals.json`: original inventory, byte counts, SHA256 hashes,
  modes and modification timestamps captured before archival writes.
- `ARCHIVE.manifest.json`: all 63 originals mapped to exact archive paths,
  original/archive hashes, encoding and decoded-byte equality. Paths are
  relative to this evidence directory.
- `ARCHIVE.receipt.json`: preserved historical partial-failure receipt.
- `ARCHIVE.stage-list.txt`: preserved historical 67-path partial list.
- `ARCHIVE.completion.json`: completion receipt with fresh original/decoded
  equality results and hashes of every other file in the complete stage list.
- `ARCHIVE.stage-list.complete.txt`: authoritative complete 70-path handoff,
  newline-delimited and relative to the repository root. It includes both
  historical metadata files and all three completion additions.

The previous missing `apply_patch` executable was a tooling setup error, not
an evidence or product failure and not a remaining blocker. Documentation was
completed using the already installed official Codex apply-patch engine with
`--codex-run-as-apply-patch`, without installation or a wrapper. The original
partial-failure receipt was not rewritten or relabeled.

All 63 original files remain in place. The archive uses 46 existing lossless
gzip copies and 17 directly readable originals. Raw stdout/stderr/log/txt/sha256
artifacts and whitespace-unsafe originals are represented by gzip rather than
trimmed text. Gzip copies, the manifest and prior receipts were not rewritten.
The complete list excludes raw originals represented by gzip, without deleting
them. No QA/tests/build, source/config edits, UI inspection, staging, commits,
or shared-state cleanup occurred. Other evidence and `EXECUTED_PLAN.md`,
including parent additions47/48, remain outside this task's scope.

## Read and restore

From this evidence directory:

```sh
gzip -cd -- tests.stdout.gz
gzip -cd -- recovery-rights.stderr.gz
gzip -cd -- tracked-before.sha256.gz | less
```

Use `gzip -cd`, not `unzip`. Do not redirect over existing originals. To restore
all original bytes from an archived checkout into a NEW directory, run the
following from this evidence directory. It refuses an existing destination,
checks archive and decoded hashes, and does not execute validators:

```sh
python3 - <<'RESTORE'
import gzip, hashlib, json
from pathlib import Path
manifest = json.loads(Path('ARCHIVE.manifest.json').read_text())
dest = Path('restored-evidence')
dest.mkdir(exist_ok=False)
for entry in manifest['files']:
    encoded = Path(entry['archive_path']).read_bytes()
    assert hashlib.sha256(encoded).hexdigest() == entry['archive_sha256']
    data = gzip.decompress(encoded) if entry['encoding'] == 'gzip' else encoded
    assert hashlib.sha256(data).hexdigest() == entry['original_sha256']
    assert len(data) == entry['original_bytes']
    target = dest / entry['original_path']
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as output:
        output.write(data)
print('All original evidence bytes restored and hash-verified.')
RESTORE
```

Restoration above preserves bytes, not filesystem timestamps or modes; original
metadata is recorded in `ARCHIVE.originals.json`. Completion hashes deliberately
exclude the completion receipt itself to avoid self-referential hashing.

The complete stage list is a precise handoff, not staging authorization. With
separate authorization, Git can consume it via `--pathspec-from-file` from the
repository root. Do not recursively stage the directory: that would include
raw originals intentionally omitted from the archive-ready list.
