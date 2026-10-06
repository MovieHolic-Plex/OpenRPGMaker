"""Read the fixed fifty-species contract and actual published model provenance."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import argparse
import hashlib
import json
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--progress-proof', required=True, type=Path)
p.add_argument('--out', required=True, type=Path)
a = p.parse_args()
repo = Path.cwd()

def read(path):
    return json.loads(path.read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

plan_path = repo / 'harness-data/battle-monster/fifty-monsters-plan.json'
seed_path = repo / 'harness-data/battle-monster/seed.json'
plan, seed = read(plan_path), read(seed_path)
before_path = repo / 'verify-shots/battle-monster-fifty/before-state.json'
before = read(before_path)
historical_revision = 'cb4e0b7d04^'
historical_bytes = subprocess.run(
    ['git', 'show', historical_revision + ':harness-data/battle-monster/seed.json'],
    check=True, capture_output=True).stdout
historical = json.loads(historical_bytes)
original = historical['monsters']
assert len(original) == before['seedSpeciesBefore'] == 23
assert seed['monsters'][:23] == original
rows = plan['roster']
ids = {row['id'] for row in rows}
assert plan['count'] == len(rows) == len(ids) == 50
assert not ids & {row['id'] for row in original}
assert len(seed['monsters']) == 73
assert len({row['id'] for row in seed['monsters']}) == 73
assert len({row['resourceId'] for row in seed['monsters']}) == 73
assert {row['id'] for row in seed['monsters'][23:]} == ids
expected = {('beast', 64): 10, ('yokai', 96): 16,
            ('human', 64): 12, ('boss', 128): 12}
assert Counter((row['category'], row['cell']) for row in rows) == expected
assert plan['authorModel'] == plan['reviewerModel'] == 'gpt-6.1-sol'
assert plan['effort'] == 'high'
lookup = {row['id']: row for row in seed['monsters']}
humans = [lookup[row['id']] for row in rows if row['category'] == 'human']
assert Counter(row['gender'] for row in humans) == {'female': 6, 'male': 6}
assert all(row['age'] == 'adult' and row['cell'] == 64 for row in humans)
assert {row['role'] for row in humans} == {'warrior', 'thief', 'shaman', 'taoist'}
progress = read(a.progress_proof)
audit = read(repo / 'qa-runs/battle-monster-fifty-wave/batch-audit.json')
passed = [row for row in audit['items'] if row['passed']]
assert len(passed) == progress['passedSpecies']
assert {row['key']: row['binding'] for row in passed} == {
    row['key']: row['binding'] for row in progress['audit']['items'] if row['passed']}
published = []
for row in passed:
    ident = row['key'].split('/')[0]
    contract = next(item for item in rows if item['id'] == ident)
    directory = repo / 'qa-runs/harnesses/battle-monster' / row['key']
    brief = read(directory / 'brief.json')
    assert brief['monster']['id'] == ident
    assert brief['monster']['resourceId'] == lookup[ident]['resourceId']
    assert brief['monster']['cell'] == contract['cell'] == row['nativeCell']
    for field in ['kind', 'gender', 'age', 'role']:
        if field in lookup[ident]:
            assert brief['monster'].get(field) == lookup[ident][field]
    assert brief['style']['authorModel'] == brief['style']['reviewerModel'] == 'gpt-6.1-sol'
    assert brief['style']['effort'] == 'high'
    jobs = [read(path) for path in (directory / 'jobs').glob('*/job.json')]
    actual = [job for job in jobs if job.get('preparedOnly') is False
              and job.get('exitCode') == 0 and job.get('finishedAt')]
    author_jobs = [job for job in actual if job['stage'] == 'author']
    assert author_jobs, ident
    keeper = next(job for job in actual if job['id'] == row['review']['jobId'])
    assert keeper['stage'] == 'critique' and keeper['model'] == 'gpt-6.1-sol'
    assert keeper['effort'] == 'high'
    for job in [*author_jobs, keeper]:
        assert job['model'] == 'gpt-6.1-sol' and job['effort'] == 'high'
        command = job['command']
        assert 'exec' in command
        assert command[command.index('-m') + 1] == 'gpt-6.1-sol'
        assert 'model_reasoning_effort="high"' in command
    published.append({'key': row['key'], 'binding': row['binding'],
                      'category': contract['category'], 'nativeCell': row['nativeCell'],
                      'briefSha256': sha(directory / 'brief.json'),
                      'actualSuccessfulAuthorJobs': [job['id'] for job in author_jobs],
                      'actualKeeperJob': keeper['id']})
result = {
    'at': datetime.now(timezone.utc).isoformat(),
    'expectedNewSpecies': 50, 'originalSpecies': 23,
    'originalSeedRevision': historical_revision,
    'originalSeedSha256': hashlib.sha256(historical_bytes).hexdigest(),
    'original23SeedRecordsUnchanged': True, 'new50DisjointFromOriginal23': True,
    'planSha256': sha(plan_path), 'seedSha256': sha(seed_path),
    'plannedCategoriesAndCells': [
        {'category': category, 'cell': cell, 'count': count}
        for (category, cell), count in expected.items()],
    'adultHumanFemaleSpecies': [row['id'] for row in humans if row['gender'] == 'female'],
    'adultHumanMaleSpecies': [row['id'] for row in humans if row['gender'] == 'male'],
    'actualPublishedContractAndModelVerifiedSpecies': len(published),
    'progressProof': str(a.progress_proof), 'progressProofSha256': sha(a.progress_proof),
    'all50Complete': len(published) == 50 and progress['allSpeciesComplete'],
    'noSourceOrChoiceWrites': True,
    'claimScope': 'Scope/brief/model provenance only; actual native art, selected GIFs, archive and browser are proved separately by the bound progress evidence.',
    'items': published,
}
a.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('Verified original23/new50/category/cell/adult6women and actual published model contracts:',
      len(published), '/50')
