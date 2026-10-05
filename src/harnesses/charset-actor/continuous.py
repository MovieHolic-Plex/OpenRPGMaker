"""Move unfinished sealed orders into bounded cohorts that finish before review.

The original recipes, published pixels and human decisions remain immutable.
Each cohort has at most 40 candidates, so the existing producer can finish its
entire order without blocking on its review buffer. Uses existing studio locks.
"""
import argparse
import copy
import json
import shutil
import time
import uuid
from datetime import datetime
from pathlib import Path

import harness as H
import recipes as R
import studio as S


def status(folder, phase, **values):
    H.write_json_atomic(folder / 'state.json', dict(phase=phase, at=H.now(), **values))


def completed(root, row):
    work = root / (row['key'] + '__gpt-r1')
    return (work / 'published.json').is_file() and H.human_ready(work, H.current_gate(work))


def prepare(folder, runs, cohort_size=40):
    if type(cohort_size) is not int or not 1 <= cohort_size <= 40:
        raise ValueError('Cohorts must have 1–40 candidates')
    originals = []
    with H.data_lock('studio'):
        for run in runs:
            root = S.run_root(run)
            manifest = json.loads((root / 'manifest.json').read_text())
            R.verify_run(root, manifest, check_tools=True)
            state_file = root / 'production-state.json'
            old_state = json.loads(state_file.read_text()) if state_file.exists() else {}
            if old_state.get('phase') in ('completed', 'continued'):
                continue
            pause_file = root / 'pause-request.json'
            previous_pause = json.loads(pause_file.read_text()) if pause_file.exists() else None
            S._control(run, False)
            originals.append(dict(run=run, pause=json.loads(pause_file.read_text()),
                                  previousPause=previous_pause, planned=len(manifest['characters'])))
    H.write_json_atomic(folder / 'request.json', dict(originals=originals, at=H.now()))
    status(folder, 'finishing-current-artists')
    deadline = time.monotonic() + 3600
    while True:
        alive = []
        for original in originals:
            driver_file = H.run_dir(original['run']) / 'driver.json'
            driver = json.loads(driver_file.read_text()) if driver_file.exists() else {}
            if H._alive(driver.get('pid')):
                alive.append(original['run'])
        if not alive:
            break
        if time.monotonic() > deadline:
            raise RuntimeError('Current artists have not settled; no duplicate producers started')
        time.sleep(5)
    jobs, transfers = [], []
    with H.data_lock('studio'):
        for original in originals:
            source = H.run_dir(original['run'])
            pause_file = source / 'pause-request.json'
            current_pause = json.loads(pause_file.read_text()) if pause_file.exists() else None
            driver_file = source / 'driver.json'
            driver = json.loads(driver_file.read_text()) if driver_file.exists() else {}
            if current_pause != original['pause'] or H._alive(driver.get('pid')):
                transfers.append(dict(run=source.name, skipped='user control changed'))
                continue
            manifest = json.loads((source / 'manifest.json').read_text())
            R.verify_run(source, manifest, check_tools=True)
            missing = [r for r in manifest['characters'] if not completed(source, r)]
            done = len(manifest['characters']) - len(missing)
            prepared = []
            try:
                for offset in range(0, len(missing), cohort_size):
                    rows = missing[offset:offset + cohort_size]
                    run = datetime.now().strftime('%Y%m%d-%H%M%S') + '-continuous-' + uuid.uuid4().hex[:8]
                    root = H.run_dir(run)
                    root.mkdir(parents=True)
                    prepared.append(root)
                    shutil.copytree(source / 'recipe', root / 'recipe')
                    next_manifest = copy.deepcopy(manifest)
                    next_manifest.update(run=run, continuationOf=source.name, collectionId=folder.name,
                                         title=(manifest.get('title') or '캐릭터') + f' · 이어 제작 {offset // cohort_size + 1}',
                                         characters=[], sourcePlanKeys=[r['key'] for r in rows])
                    next_manifest['productionPolicy'] = dict(manifest['productionPolicy'], maxReviewPending=len(rows))
                    for row in rows:
                        candidate = copy.deepcopy(row)
                        candidate['key'] = 'cont-' + run[-8:] + '-' + row['key']
                        next_manifest['characters'].append(candidate)
                    H.write_json_atomic(root / 'manifest.json', next_manifest)
                    H.write_json_atomic(root / 'production.json', dict(par=1, batchSize=1))
                    H.write_json_atomic(root / 'production-state.json', dict(phase='queued', at=H.now(),
                                                                           remaining=len(rows), active=0))
                    R.verify_run(root, next_manifest, check_tools=True)
                allocated = sum(len(json.loads((p / 'manifest.json').read_text())['characters']) for p in prepared)
                if allocated + done != original['planned']:
                    raise ValueError('Original order allocation count changed')
            except Exception:
                for root in prepared:
                    shutil.rmtree(root)
                raise
            names = [p.name for p in prepared]
            # Only production state changes; source manifest/recipe/output stay unchanged.
            H.write_json_atomic(source / 'production-state.json', dict(
                phase='continued' if names else 'completed', at=H.now(),
                continuedIn=names[0] if names else None, continuations=names,
                plannedHere=done, ordered=original['planned']))
            jobs.extend(dict(run=p.name, planned=len(json.loads((p / 'manifest.json').read_text())['characters']),
                             source=source.name) for p in prepared)
            transfers.append(dict(run=source.name, ordered=original['planned'], completed=done,
                                  remaining=len(missing), continuations=names,
                                  recipe=manifest['recipe']))
    # Small remainders first, then two larger cohorts work in parallel.
    jobs.sort(key=lambda r: r['planned'])
    record = dict(jobs=jobs, transfers=transfers, at=H.now())
    H.write_json_atomic(folder / 'allocation.json', record)
    return jobs, transfers


def execute(folder, jobs, transfers, par):
    if type(par) is not int or not 1 <= par <= S.MAX_ARTISTS:
        raise ValueError(f'Use 1–{S.MAX_ARTISTS} artists')
    pending = jobs.copy()
    started = []
    status(folder, 'starting', pending=pending, started=started, transfers=transfers)
    deadline = time.monotonic() + 24 * 3600
    while pending:
        if time.monotonic() > deadline:
            raise RuntimeError('Start wait expired; prepared orders remain available in the workshop')
        with H.data_lock('studio'):
            active = S.active_productions()
            used = sum(r['par'] for r in active)
            waiting = []
            for job in pending:
                root = H.run_dir(job['run'])
                state = json.loads((root / 'production-state.json').read_text())
                if any(r['run'] == root.name for r in active):
                    started.append(dict(job, alreadyRunning=True))
                elif state.get('phase') in ('completed', 'continued'):
                    started.append(dict(job, alreadyComplete=True))
                elif (root / 'pause-request.json').exists():
                    started.append(dict(job, userPaused=True))
                else:
                    waiting.append(job)
            if len(waiting) != len(pending):
                pending = waiting
                status(folder, 'running', pending=pending, started=started, transfers=transfers)
            while pending and used < par:
                job = pending.pop(0)
                root = H.run_dir(job['run'])
                if any(r['run'] == root.name for r in active):
                    started.append(dict(job, alreadyRunning=True))
                    continue
                state = json.loads((root / 'production-state.json').read_text())
                if state.get('phase') in ('completed', 'continued'):
                    started.append(dict(job, alreadyComplete=True))
                    continue
                if (root / 'pause-request.json').exists():
                    started.append(dict(job, userPaused=True))
                    continue
                launched = S._control(root.name, True)
                started.append(dict(job, **launched, at=H.now()))
                used += 1
                status(folder, 'running', pending=pending, started=started, transfers=transfers)
        if pending:
            time.sleep(5)
    status(folder, 'all-cohorts-started', started=started, transfers=transfers)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='append', required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--par', type=int, default=2)
    parser.add_argument('--cohort-size', type=int, default=40)
    args = parser.parse_args()
    if not 1 <= args.par <= S.MAX_ARTISTS or len(args.run) != len(set(args.run)) or not 1 <= args.cohort_size <= 40:
        raise ValueError(f'Use 1–{S.MAX_ARTISTS} artists and unique source orders')
    if args.out.exists():
        raise ValueError('Use a new evidence folder; do not replace an existing allocation')
    args.out.mkdir(parents=True)
    try:
        jobs, transfers = prepare(args.out, args.run, args.cohort_size)
        execute(args.out, jobs, transfers, args.par)
    except Exception as error:
        status(args.out, 'needs-attention', error=str(error))
        raise


if __name__ == '__main__':
    main()
