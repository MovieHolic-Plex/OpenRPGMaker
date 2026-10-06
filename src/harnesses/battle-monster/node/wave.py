"""AI-only bounded production wave, publishing complete reviewed candidates."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import uuid
from pipeline import Harness, REPO, load, save, lock, stamp
from motions import bake_motions


def shared_direction(args):
    # Read when a new artist/repair starts so queued work receives user steering.
    note_file = getattr(args, 'note_file', None)
    return note_file.read_text(encoding='utf-8') if note_file else getattr(args, 'note', '')

def produce(args, monster):
    task = args.work / 'tasks' / (monster + '.json')
    state = load(task) if task.exists() else {'monster': monster, 'state': 'queued', 'createdAt': stamp()}
    workargs = argparse.Namespace(seed=args.seed, root=str(args.work / 'candidates'), monster=monster,
        candidate=args.candidate, note=shared_direction(args), prepare_only=False, out=None)
    harness = Harness(workargs)
    directory = harness.directory()
    final = args.publish / monster / args.candidate
    if final.exists():
        report = harness.bake(final, 'suite')
        review = harness.current_critique(final, 'suite', report)
        if not report['pass'] or not review:
            raise ValueError('Existing published result is not this complete reviewed candidate.')
        if args.visual_repairs and review['recommendation'] != 'keep':
            raise ValueError('Published result lacks visual keep; preserve it and use a new repair candidate.')
        state.update(state='done', finishedAt=state.get('finishedAt', stamp()), candidate=monster + '/' + args.candidate)
        save(task, state)
        return state
    state.update(state='running', startedAt=stamp())
    save(task, state)
    try:
        if not directory.exists():
            harness.init(directory)
            if args.actions:
                parent = args.publish / monster / 'baseline'
                shutil.copytree(parent / 'source', directory / 'source', dirs_exist_ok=True)
                shutil.copyfile(parent / 'preview/poses/checker.png', directory / 'reference.png')
                provenance = load(directory / 'provenance.json')
                provenance.update(parent=monster + '/baseline', userCorrection='스킬·독·기절·수면 동작을 추가. 기본 전투 그림은 유지.')
                save(directory / 'provenance.json', provenance)
        with lock(directory / '.lock'):
            parent = args.publish / monster / 'baseline' if args.actions else None
            if parent is not None:
                state['coreBinding'] = harness.pixels(parent, 'poses')[2]['binding']
                save(task, state)
            if not state.get('authored'):
                for attempt in range(3):
                    before = len(load(directory / 'provenance.json')['jobs'])
                    try:
                        report = harness.work(directory, 'author', 'actions' if args.actions else 'complete')
                        if parent is not None and harness.pixels(directory, 'poses')[2]['binding'] != state['coreBinding']:
                            raise ValueError('Existing selected core poses/palette changed; restore original core bytes.')
                        if report['pass']:
                            state['authored'] = True
                            save(task, state)
                            break
                        error = '; '.join(report['errors'])
                    except ValueError as failure:
                        jobs = load(directory / 'provenance.json')['jobs']
                        if len(jobs) == before or jobs[-1].get('exitCode') != 0:
                            raise
                        error = str(failure)
                    archive = directory / 'technical-repairs' / uuid.uuid4().hex
                    shutil.copytree(directory / 'source', archive / 'source')
                    state.setdefault('technicalRepairs', []).append({'error':error,'at':stamp()})
                    save(task, state)
                    if parent is not None:
                        shutil.copyfile(parent / 'source/palette.json', directory / 'source/palette.json')
                        shutil.copytree(parent / 'source/poses', directory / 'source/poses', dirs_exist_ok=True)
                    if attempt == 2:
                        raise ValueError(error)
                    harness.args.note = (shared_direction(args) + '\nTechnical correction only: ' + error
                        + '. Preserve the intended design, repair literal row lengths/symbols/contact only. '
                          'Grounded idle_a contact touches y=cell-4. No ink below y=cell-4. Do not transform entire frames.')
            if parent is not None and harness.pixels(directory, 'poses')[2]['binding'] != state['coreBinding']:
                raise ValueError('Original selected core poses/palette must remain unchanged.')
            report = harness.bake(directory, 'suite')
            if not report['pass']:
                raise ValueError('; '.join(report['errors']))
            if not harness.current_critique(directory, 'suite', report):
                harness.work(directory, 'critique', 'suite')
            review = harness.current_critique(directory, 'suite', report)
            if args.visual_repairs:
                while review['recommendation'] != 'keep':
                    count = state.get('visualRepairCount', 0)
                    if count >= args.visual_repairs:
                        raise ValueError('Visual repair limit reached; result remains unpublished, not passed.')
                    archive = directory / 'visual-repairs' / f'{count + 1:03d}'
                    if archive.exists():
                        raise ValueError('Interrupted visual repair archive exists; inspect the live job before resuming.')
                    shutil.copytree(directory / 'source', archive / 'source')
                    shutil.copytree(directory / 'preview/suite', archive / 'review-images')
                    save(archive / 'critique-suite.json', review)
                    save(archive / 'repair-direction.json', {
                        'authorization': args.visual_repair_authorization.read_text(encoding='utf-8'),
                        'priorBinding': report['binding'], 'priorReviewJob': review['jobId'],
                        'issues': review['issues'], 'startedAt': stamp(),
                    })
                    state.update(visualRepairCount=count + 1, step='visual-repair',
                                 priorReviewJob=review['jobId'], priorBinding=report['binding'])
                    save(task, state)
                    shutil.copyfile(directory / 'preview/suite/checker.png', directory / 'reference.png')
                    harness.args.note = (shared_direction(args)
                        + '\nUser explicitly requested all batch results pass inspection. Repair this existing draft; '
                          'do not invent approval or edit reviewer results. Preserve good poses, identity and palette. '
                          'Inspect the attached current sheet and directly fix the following specific native-pixel issues: '
                        + str(review['issues'])
                        + '\nReviewer observations: ' + review['summary'])
                    repaired = harness.work(directory, 'author', 'complete')
                    if not repaired['pass']:
                        raise ValueError('Visual correction failed pixel contract: ' + '; '.join(repaired['errors']))
                    if repaired['binding'] == report['binding']:
                        raise ValueError('Visual correction did not change the reviewed source.')
                    report = repaired
                    state.update(step='independent-review', binding=report['binding'])
                    save(task, state)
                    harness.work(directory, 'critique', 'suite')
                    review = harness.current_critique(directory, 'suite', report)
                    if not review:
                        raise ValueError('Independent review is missing or stale.')
                state.update(visualRecommendation='keep', visualReviewJob=review['jobId'],
                             binding=report['binding'])
                save(task, state)
            brief, frames, _ = harness.pixels(directory, 'suite')
            bake_motions(directory, brief, frames)
            if final.exists():
                raise ValueError('Published candidate already exists; never overwrite user results.')
            # Same filesystem atomic rename; no half-authored source is shown.
            final.parent.mkdir(parents=True, exist_ok=True)
            directory.rename(final)
        state.update(state='done', finishedAt=stamp(), candidate=monster + '/' + args.candidate)
    except Exception as failure:
        state.update(state='failed', error=str(failure), finishedAt=stamp())
    save(task, state)
    print(monster + ': ' + state['state'], flush=True)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', default=str(REPO / 'harness-data/battle-monster/seed.json'))
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--publish', type=Path, default=REPO / 'qa-runs/harnesses/battle-monster')
    parser.add_argument('--candidate', default='motions-v1')
    parser.add_argument('--workers', type=int, default=3, choices=(1,2,3))
    parser.add_argument('--actions', action='store_true')
    parser.add_argument('--visual-repairs', type=int, default=0, choices=range(0, 9),
                        help='Explicitly authorized coordinate repairs; require real visual keep before publishing.')
    parser.add_argument('--visual-repair-authorization', type=Path,
                        help='UTF-8 original user instruction authorizing batch inspection and repairs.')
    notes = parser.add_mutually_exclusive_group()
    notes.add_argument('--note', default='', help='Shared art direction for every candidate.')
    notes.add_argument('--note-file', type=Path, help='UTF-8 shared art direction; retained during technical repairs.')
    parser.add_argument('monsters', nargs='+')
    args = parser.parse_args()
    if args.visual_repairs:
        if args.actions or not args.visual_repair_authorization:
            parser.error('Visual repairs require a new complete candidate and explicit user authorization file.')
        if not args.visual_repair_authorization.read_text(encoding='utf-8').strip():
            parser.error('Visual repair authorization must contain the actual user instruction.')
    if args.note_file:
        args.note = args.note_file.read_text(encoding='utf-8')
    args.work = args.work.resolve(); args.publish = args.publish.resolve()
    with lock(args.work / 'wave.lock'):
        for monster in args.monsters:
            task = args.work / 'tasks' / (monster + '.json')
            if not task.exists():
                save(task, {'monster': monster, 'state': 'queued', 'createdAt': stamp()})
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            results = list(pool.map(lambda monster: produce(args,monster), args.monsters))
    return int(any(result['state'] != 'done' for result in results))


if __name__ == '__main__':
    raise SystemExit(main())
