"""One-shot public archival preparation. No clobber, source edits, or payload output.

Not a recovery rerun. Operates only in this evidence directory and the exact
named Git-metadata retention directory. Does not stage/commit or run product QA.
"""
import datetime
import gzip
import importlib.util
import json
import os
import stat
from pathlib import Path

D = Path(__file__).resolve().parent
PRIVATE_PARENT = Path('/home/main/z-project/rpg-zzu/.git/life-full-20260906-forensic-private')
PRIVATE = PRIVATE_PARENT / '51'
REPO_REL = '.omo/evidence/life-full-20260906/51'
NEW_INPUTS = {'prepare-public.py', 'verify-public.py', 'PUBLIC-README.md'}
OUTPUTS = ['PUBLIC-PRIVATE-RETENTION.json', 'PUBLIC-SAFETY-SCAN.json', 'PUBLIC-PRESERVATION.json', 'PUBLIC-MANIFEST.json', 'PUBLIC-stage-list.txt', 'PUBLIC-VERIFY.json']
# Do not import with the normal loader: it may write __pycache__ unexpectedly.
namespace = {'__name__': 'public_safety_library'}
exec(compile((D/'verify-public.py').read_bytes(), str(D/'verify-public.py'), 'exec'), namespace)
sha = namespace['sha']
inspect_payload = namespace['inspect_payload']
payload = namespace['payload']


def exclusive(path, data, mode):
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
    fd = os.open(path, flags, mode)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    assert path.read_bytes() == data
    assert stat.S_IMODE(path.stat().st_mode) == mode


def public_json(name, value):
    exclusive(D/name, (json.dumps(value, indent=2)+'\n').encode(), 0o644)


def private_dir(path):
    # All paths below the named retention parent are newly created exclusively.
    os.mkdir(path, 0o700)
    assert not path.is_symlink() and stat.S_IMODE(path.stat().st_mode) == 0o700
    assert path.stat().st_uid == os.getuid()


assert D == Path('/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/51')
assert not PRIVATE_PARENT.exists() and not PRIVATE_PARENT.is_symlink()
for name in OUTPUTS:
    assert not (D/name).exists() and not (D/name).is_symlink(), 'Refusing output clobber: '+name
files = sorted(p for p in D.rglob('*') if p.is_file())
assert all(not p.is_symlink() for p in D.rglob('*'))
baseline = {str(p.relative_to(D)): p.read_bytes() for p in files}
assert len(set(baseline) - NEW_INPUTS) == 411, 'Evidence collection changed; inspect before proceeding'
original_provenance = json.loads(baseline['PROVENANCE.json'])
for row in original_provenance['artifacts']:
    data = baseline[row['artifact']]
    assert sha(data) == row['compressed_sha256']
    assert sha(gzip.decompress(data)) == row['sha256']
source_manifest = json.loads(baseline['SOURCE-MANIFEST.json'])
for row in source_manifest['files']:
    data = baseline[row['artifact']]
    assert sha(data) == row['compressed_sha256']
    assert sha(gzip.decompress(data)) == row['sha256']
assert sha(gzip.decompress(baseline[source_manifest['diff']['artifact']])) == source_manifest['diff']['sha256']

private_rows = []
scan_rows = []
block_count = 0
for name, raw in baseline.items():
    data = payload(raw, name)
    findings, blocks = inspect_payload(data, name)
    credential_findings = [hit for hit in findings if hit['category'].startswith('credential-candidate:')]
    assert not credential_findings, 'Credential candidate requires private review; payload not printed: '+name
    scan_rows.append(dict(path=name, sha256=sha(raw), decoded_sha256=sha(data), private_reasoning_blocks=blocks, finding_categories=sorted(set(hit['category'] for hit in findings)), recognized_credential_candidates=0))
    if findings:
        assert name.startswith('owned/') and '/events/' in name and name.endswith('.json.gz')
        event = json.loads(data)
        assert event['message']['role'] == 'assistant' and blocks > 0
        block_count += blocks
        private_rows.append(dict(path=name, bytes=len(raw), sha256=sha(raw), decoded_bytes=len(data), decoded_sha256=sha(data), event_id=event['id'], private_reasoning_blocks=blocks, classification='private-retained exact original event; excluded from public subset'))
assert len(private_rows) == 30 and block_count == 31
assert sum(row['private_reasoning_blocks']==2 for row in private_rows)==1

# Retain exact compressed bytes; never decompress into the private filesystem.
private_dir(PRIVATE_PARENT)
private_dir(PRIVATE)
created_dirs = {PRIVATE_PARENT, PRIVATE}
for row in private_rows:
    dest = PRIVATE/'originals'/row['path']
    missing = []
    cursor = dest.parent
    while cursor not in created_dirs:
        missing.append(cursor)
        cursor = cursor.parent
    for directory in reversed(missing):
        private_dir(directory)
        created_dirs.add(directory)
    data = baseline[row['path']]
    exclusive(dest, data, 0o600)
    retained = dest.read_bytes()
    assert retained == (D/row['path']).read_bytes() == data
    assert gzip.decompress(retained) == gzip.decompress(data)
    row.update(private_path=str(dest), compressed_bytes_equal=True, decoded_bytes_equal=True, file_mode='0600')
private_record = dict(format_version=1, kind='private retention inventory; hashes/paths only, no payload text', private_root=str(PRIVATE), created_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), directory_mode='0700', file_mode='0600', exclusive_no_clobber=True, original_files_untouched=True, artifacts=private_rows)
exclusive(PRIVATE/'RETENTION.json', (json.dumps(private_record,indent=2)+'\n').encode(), 0o600)
for directory in created_dirs:
    assert stat.S_IMODE(directory.stat().st_mode)==0o700
for path in PRIVATE.rglob('*'):
    assert not path.is_symlink()
    assert stat.S_IMODE(path.stat().st_mode)==(0o700 if path.is_dir() else 0o600)
public_json('PUBLIC-PRIVATE-RETENTION.json', {**private_record, 'private_inventory_sha256':sha((PRIVATE/'RETENTION.json').read_bytes()), 'retained_gzip_files':len(private_rows), 'reasoning_blocks':block_count, 'all_retained_byte_comparisons_passed':True, 'all_directory_and_file_modes_verified':True, 'private_inventory_not_stage_listed':True})
public_json('PUBLIC-SAFETY-SCAN.json', dict(format_version=1, inspection='UTF-8 gzip decode, JSON/JSONL structure, recursive JSON-string fields, typed reasoning/signature fields, embedded typed blocks, recognized credential patterns; no payload text emitted', inspected_initial_files=len(scan_rows), original_files=411, new_preparation_inputs=len(NEW_INPUTS), private_event_gzip_files=30, private_reasoning_blocks=31, recognized_credential_candidates=0, ordinary_prose_and_code_comments_not_removed=True, synthetic_redacted_originals_created=False, files=scan_rows, limits=['Recognized credential-pattern inspection is not a guarantee against arbitrary encoded secrets.', 'All public candidates and generated manifest are inspected again by the portable verifier.']))

# Compare every pre-existing byte again, without reading live task/session stores.
for name, data in baseline.items():
    assert (D/name).read_bytes()==data, 'Existing artifact changed: '+name
preserved = [dict(path=name, bytes=len(data), sha256=sha(data)) for name,data in baseline.items() if name not in NEW_INPUTS]
public_json('PUBLIC-PRESERVATION.json', dict(format_version=1, verification='archival preparation source preservation only; no live-source or product QA rerun', original_files_verified=len(preserved), all_preexisting_bytes_unchanged=True, source_backups_and_source_manifest_unchanged=True, original_provenance_and_integrity_checkers_unchanged=True, original_gzip_hashes_verified=384, original_source_backup_hashes_verified=9, binary_diff_backup_hash_verified=True, task_metadata_drift_policy='Parent exact two-task residency/updated_at exception retained as originally recorded; no checker/event validation changes.', artifacts=preserved))
private_names = {row['path'] for row in private_rows}
public_names = sorted(str(p.relative_to(D)) for p in D.rglob('*') if p.is_file() and str(p.relative_to(D)) not in private_names)
# Freeze a repository-relative allowlist, including both control files.
public_names += ['PUBLIC-MANIFEST.json','PUBLIC-stage-list.txt']
public_names.sort()
stage_bytes = ('\n'.join(REPO_REL+'/'+name for name in public_names)+'\n').encode()
exclusive(D/'PUBLIC-stage-list.txt',stage_bytes,0o644)
public_files = []
for name in public_names:
    if name=='PUBLIC-MANIFEST.json':continue
    raw = (D/name).read_bytes()
    data = payload(raw,name)
    findings, _ = inspect_payload(data,name)
    assert not findings, 'Public candidate failed inspection: '+name
    public_files.append(dict(path=name,bytes=len(raw),sha256=sha(raw),decoded_bytes=len(data),decoded_sha256=sha(data),classification='public-safe exact existing artifact' if name in baseline and name not in NEW_INPUTS else 'public-safe new archival preparation artifact'))
manifest = dict(format_version=1, kind='Public-safe subset allowlist; not a redacted-original collection or product approval', repository_relative_root=REPO_REL, manifest_self_hash='Excluded to avoid circular hashing; reported by the portable verifier for independent comparison.', public_files=public_files, private_retained=private_rows, private_root=str(PRIVATE), original_provenance='PROVENANCE.json is unchanged and contains full original hash/path references, including private-excluded events. References are not stage instructions.', source_record_requirement='Full forensic checking needs privately retained original event/source records and authorized immutable session files; public subset validation cannot establish full original provenance.', partial_evidence_limits='Unchanged: full r2 streams/state/import-resolution/final-source receipt remain unavailable; build failed; no plan47/48 or broader product approval.', local_post_manifest_receipt='PUBLIC-VERIFY.json is a local verification receipt, intentionally outside the frozen public subset.', preparation='No recover.py rerun, product validators, source mutations, sparse/read-tree, staging, or commit.')
manifest_bytes=(json.dumps(manifest,indent=2)+'\n').encode()
assert not inspect_payload(manifest_bytes,'PUBLIC-MANIFEST.json')[0]
exclusive(D/'PUBLIC-MANIFEST.json',manifest_bytes,0o644)
for name,data in baseline.items():
    assert (D/name).read_bytes()==data
print(json.dumps(dict(original_files_unchanged=len(preserved),private_originals_retained=len(private_rows),private_reasoning_blocks=block_count,private_root=str(PRIVATE),public_hashed_files=len(public_files),public_stage_paths=len(public_names),public_manifest_sha256=sha(manifest_bytes),public_stage_list_sha256=sha(stage_bytes),all_retained_bytes_and_permissions_verified=True,recognized_credential_candidates=0,product_qa_run=False,staged=False,committed=False),indent=2))
