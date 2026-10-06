"""Bind a real keeper to root's already performed native/source review."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import json

p = argparse.ArgumentParser()
p.add_argument('monster')
p.add_argument('--read-record', required=True, type=Path)
a = p.parse_args()
repo = Path.cwd()
evidence = repo / 'verify-shots/battle-monster-fifty'
record = json.loads(a.read_record.read_text())
assert record['passed'] is False and record['nativePosesActuallyViewed'] == 18
key = a.monster + '/fifty-v1'
assert record['key'] == key
public = repo / 'qa-runs/harnesses/battle-monster' / key
private = repo / 'qa-runs/battle-monster-fifty-wave/candidates' / key
d = public if public.exists() else private

def read(path):
    return json.loads(path.read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

check = read(d / 'check-suite.json')
q = read(d / 'critique-suite.json')
j = read(d / 'jobs' / q['jobId'] / 'job.json')
assert check['pass'] and q['recommendation'] == 'keep'
assert record['binding'] == check['binding'] == q['binding']
assert j['stage'] == 'critique' and j['preparedOnly'] is False
assert j['exitCode'] == 0 and j['finishedAt']
assert j['model'] == q['model'] == 'gpt-6.1-sol'
assert j['effort'] == q['effort'] == 'high'
assert j['imageHashes'] == q['imageHashes']
for path, digest in q['imageHashes'].items():
    assert sha(d / path) == digest
contact = repo / record['actualUnresizedNativeContact']
receipt = read(contact.with_suffix('.json'))
assert receipt['binding'] == q['binding']
assert receipt['nativePoses'] == 18 and receipt['noSourceWrites']
assert sha(contact) == record['nativeContactPngSha256'] == receipt['pngSha256']
for f in receipt['frames']:
    name = f['pose'] + '.pxgrid'
    src = next(p for p in [d / 'source/poses' / name, d / 'source/actions' / name] if p.exists())
    assert sha(src) == f['sourceSha256']
    assert sha(d / 'preview/suite' / (f['pose'] + '.png')) == f['nativePngSha256']
    assert f['rgbaMatchesNativeSource']
for path, digest in record['nativeWriterFilesRead'].items():
    assert sha(d / 'source' / path) == digest, path
notes = [record['observations'][0], *record['observations'][-2:]]
notes += ['Complete original writer/module reading and subsequent complete repair/diff reading are recorded in the binding-specific root drafts; exact current read writer hashes were rechecked. Native18/source/keeper4PNG/current technical binding all agree. Static pose/source review does not prove live battle contact or timing.']
doc = {
    'at': datetime.now(timezone.utc).isoformat(), 'passed': True, 'key': key,
    'binding': q['binding'], 'actualIndependentReviewJob': q['jobId'],
    'actualIndependentReviewModel': q['model'], 'actualIndependentReviewEffort': q['effort'],
    'actualPreviewHashes': q['imageHashes'], 'nativePoses': 18,
    'retainedIndependentMinorIssues': q['issues'], 'retainedIndependentSummary': q['summary'],
    'actualUnresizedNativeContact': record['actualUnresizedNativeContact'],
    'nativeContactPngSha256': record['nativeContactPngSha256'],
    'nativeWriterFilesRead': record['nativeWriterFilesRead'],
    'rootVisualAndSourceMethodObservations': notes,
    'actualReadRecord': str(a.read_record),
    'claimScope': 'Actual native18/complete current writers and actual independent keeper binding only. Selected ZIP/native GIF/archive/browser evidence is verified separately; entire50 completion remains pending.',
}
for dest in [evidence / ('root-review-' + a.monster + '.json'),
             repo / 'qa-runs/battle-monster-fifty-wave' / ('root-review-' + a.monster + '.json')]:
    dest.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'monster': a.monster, 'binding': q['binding'], 'actualKeeper': q['jobId'],
                  'rootActuallyViewed': 18, 'wholeWritersRead': len(record['nativeWriterFilesRead']),
                  'retainedFormalIssues': len(q['issues'])}))
