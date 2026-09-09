"""Archive integrity verification only: no tests, build, probe, or source writes."""
import datetime
import gzip
import hashlib
import json
import subprocess
from pathlib import Path
D = Path(__file__).resolve().parent
M = json.loads((D/'PROVENANCE.json').read_bytes())
S = json.loads((D/'SOURCE-MANIFEST.json').read_bytes())
sha = lambda b: hashlib.sha256(b).hexdigest()
checked = 0
source_cache = {}
for row in M['artifacts']:
    packed = (D/row['artifact']).read_bytes()
    data = gzip.decompress(packed)
    assert sha(packed) == row['compressed_sha256'], row['artifact']
    assert sha(data) == row['sha256'] and len(data) == row['bytes'], row['artifact']
    source = row.get('source')
    if source:
        if source not in source_cache: source_cache[source] = Path(source).read_bytes()
        original = source_cache[source]
        offset = row.get('source_offset', 0)
        length = row.get('source_length', len(original))
        segment = original[offset:offset+length]
        if 'source_event_sha256' in row: assert sha(segment) == row['source_event_sha256']
        if row['kind'].startswith('exact original JSONL event') or row['kind'].startswith('exact byte-range excerpt') or ('source_event_sha256' not in row):
            assert data == segment, row['artifact']
        if 'json_pointer' in row:
            value = json.loads(segment)
            for key in row['json_pointer'].strip('/').split('/'):
                value = value[int(key)] if isinstance(value,list) else value[key]
            assert value.encode() == data, row['artifact']
    checked += 1
for session in M['sessions']:
    data = Path(session['path']).read_bytes()
    assert sha(data) == session['sha256'] and len(data) == session['bytes']
for row in S['files']:
    packed = (D/row['artifact']).read_bytes()
    original = Path(row['source']).read_bytes()
    assert gzip.decompress(packed) == original
    assert sha(original) == row['sha256'] and len(original) == row['bytes']
    assert sha(packed) == row['compressed_sha256']
P = '/home/main/z-project/rpg-zzu-life-full-spatial-rights'
command = lambda *args: subprocess.check_output(['git','-C',P,*args])
assert command('rev-parse','HEAD').decode().strip() == S['base_sha']
assert command('status','--short').decode() == S['status']
diff = command('diff','--binary')
assert gzip.decompress((D/S['diff']['artifact']).read_bytes()) == diff
assert sha(diff) == S['diff']['sha256'] and len(diff) == S['diff']['bytes']
# Independent r2 captured diff equals current original binary diff bytes here.
assert gzip.decompress((D/'existing/verifier-r2/diff.stdout.gz').read_bytes()) == diff
# The post-loss producer hash receipt matches today's eight code/test files;
# wiki is independently preserved as the ninth file in SOURCE-MANIFEST.
post = gzip.decompress((D/'existing/post-loss-r2/remaining-source.sha256.gz').read_bytes()).decode()
for line in post.splitlines():
    digest, name = line.split(maxsplit=1)
    path = Path(name)
    if not path.is_absolute(): path = Path(P)/path
    assert sha(path.read_bytes()) == digest
parent = gzip.decompress((D/'existing/post-loss-r2/parent-originals.sha256.gz').read_bytes()).decode()
for line in parent.splitlines():
    digest, name = line.split(maxsplit=1)
    assert sha(Path(name).read_bytes()) == digest
report = dict(verified_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), verification='forensic integrity only, no product QA', provenance_artifacts_verified=checked, source_files_verified=9, binary_diff_verified=True, untracked_test_preserved=True, head_unchanged=S['base_sha'], dirty_status_unchanged=True, all_source_bytes_unchanged=True, all_four_owned_session_sources_unchanged=True, existing_evidence_sources_unchanged=True, independent_r2_diff_equals_current_bytes=True, post_loss_source_and_parent_hashes_match=True, first_summary_write_equals_verifier_copy=json.loads((D/'RECOVERED-SCRIPT-NOTES.json').read_bytes())['first_summary_write_equals_independent_copy'], gzip_artifact_bytes=sum(p.stat().st_size for p in D.rglob('*.gz')), limitations=['No original final-source.sha256 receipt recovered', 'Final probe decoded from recorded patches, no surviving final disk hash', 'No implementation, diagnostics, test, typecheck, build or public probe executed by recovery'])
(D/'INTEGRITY.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
