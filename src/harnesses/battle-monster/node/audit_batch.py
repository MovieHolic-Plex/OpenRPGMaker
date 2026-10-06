"""Read authoritative source, reviews, selections and GIFs for an entire batch.

Never turns missing or weak evidence into a passed result. No source edits,
model calls, ledger mutations, or preview regeneration happen in this audit.
"""
import argparse
import json
from io import BytesIO
from pathlib import Path
import zipfile
from PIL import Image
from pipeline import Harness, REPO, POSES, EXTRA_POSES, load, save, sha, stamp
from motions import SCENES


def inspect(h, directory):
    brief, frames, report = h.pixels(directory, 'suite')
    if not report['pass']:
        raise ValueError('; '.join(report['errors']))
    baked = load(directory / 'check-suite.json')
    if not baked['pass'] or baked['binding'] != report['binding']:
        raise ValueError('Current baked suite does not match native source.')
    if any(sha((directory / path).read_bytes()) != digest
           for path, digest in baked['images'].items()):
        raise ValueError('Review PNG bytes changed after the bound check.')
    review = h.current_critique(directory, 'suite', baked)
    if not review or review['recommendation'] != 'keep':
        raise ValueError('Current real independent visual keep is required.')
    if review['model'] != brief['style']['reviewerModel'] or review['effort'] != 'high':
        raise ValueError('Reviewer model/effort differs from this species contract.')
    jobs = [load(p) for p in (directory / 'jobs').glob('*/job.json')]
    if not any(j['stage'] == 'author' and j.get('exitCode') == 0
               and j['model'] == brief['style']['authorModel'] and j['effort'] == 'high'
               for j in jobs):
        raise ValueError('A successful actual author job is missing.')
    decisions = {}
    for phase in ('idle', 'poses', 'suite'):
        _, _, phase_report = h.pixels(directory, phase)
        latest = h.latest_decision(directory, phase)
        if (not phase_report['pass'] or not latest or latest['choice'] != 'keep'
                or latest['binding'] != phase_report['binding']):
            raise ValueError('Current Allow is missing/stale for ' + phase)
        decisions[phase] = {'binding': latest['binding'], 'by': latest['by'],
                            'requestId': latest.get('requestId'), 'note': latest['note']}
    cell = brief['monster']['cell']
    names = POSES + EXTRA_POSES
    with Image.open(directory / 'preview/suite/sheet.png') as sheet:
        if sheet.size != (cell * 3, cell * 6):
            raise ValueError('Packed native sheet has the wrong dimensions.')
        for i, pose in enumerate(names):
            x, y = (i % 3) * cell, (i // 3) * cell
            if sheet.crop((x, y, x + cell, y + cell)).convert('RGBA').tobytes() != frames[pose].tobytes():
                raise ValueError('Sheet/source pixel mismatch: ' + pose)
    motions = load(directory / 'preview/motions/timing.json')
    if len(motions) != 8 or not all(m['available'] for m in motions):
        raise ValueError('All eight actual motion GIFs are required.')
    for motion, (name, _, sequence, timing) in zip(motions, SCENES):
        holds = [max(10, round(ms / 10) * 10) for ms in
                 (timing or [brief['monster']['idleFrameMs']] * len(sequence))]
        if motion['id'] != name or motion['sequence'] != list(sequence) or motion['durations'] != holds:
            raise ValueError('Motion sequence/holds differ from the production contract: ' + name)
        with Image.open(directory / 'preview/motions' / (name + '.gif')) as gif:
            if gif.size != (cell, cell) or gif.n_frames != len(sequence):
                raise ValueError('Native GIF size/frame count mismatch: ' + name)
            for i, pose in enumerate(sequence):
                gif.seek(i)
                if gif.info.get('duration') != holds[i] or gif.convert('RGBA').tobytes() != frames[pose].tobytes():
                    raise ValueError('Native GIF pixel/hold mismatch: ' + name + '/' + pose)
    request_id = decisions['suite']['requestId']
    if request_id:
        job = load(h.root / 'dashboard/requests' / (request_id + '.json'))
        if (job['key'] != str(directory.relative_to(h.root)) or job['action'] != 'allow'
                or job['state'] != 'done' or job.get('supersededBy') or not job.get('pack')
                or any(job['bindings'].get(phase) != item['binding'] for phase, item in decisions.items())):
            raise ValueError('The current selected dashboard pack request is not complete.')
        pack = Path(job['pack']).resolve()
        if not pack.is_relative_to((h.root / 'packs').resolve()):
            raise ValueError('Selected pack is outside this harness storage.')
    else:
        pack = h.root / 'packs' / (directory.parent.name + '-' + directory.name + '.zip')
    if not pack.exists():
        raise ValueError('The selected downloadable pack is not ready.')
    with zipfile.ZipFile(pack) as archive:
        if archive.testzip() is not None:
            raise ValueError('Selected ZIP did not reread successfully.')
        asset = 'assets/harnesses/battle-monster/' + directory.parent.name + '/'
        for pose in names:
            native_png = 'preview/suite/' + pose + '.png'
            with Image.open(BytesIO(archive.read('provenance/' + native_png))) as image:
                if image.size != (cell, cell) or image.convert('RGBA').tobytes() != frames[pose].tobytes():
                    raise ValueError('Selected ZIP native PNG differs from current source: ' + pose)
            source = 'source/' + ('poses/' if pose in POSES else 'actions/') + pose + '.pxgrid'
            if archive.read('provenance/' + source) != (directory / source).read_bytes():
                raise ValueError('Selected ZIP native grid differs from current source: ' + pose)
        if archive.read('provenance/source/palette.json') != (directory / 'source/palette.json').read_bytes():
            raise ValueError('Selected ZIP palette differs from current source.')
        metadata = json.loads(archive.read('sheets.json'))
        if len(metadata) != 1 or any(metadata[0].get(field) != brief['monster'][field]
                                     for field in ('resourceId', 'cell', 'motion', 'idleFrameMs')):
            raise ValueError('Selected ZIP resource metadata differs from the current brief.')
        with Image.open(BytesIO(archive.read(asset + 'sheet.png'))) as sheet:
            with Image.open(directory / 'preview/poses/sheet.png') as live:
                if sheet.convert('RGBA').tobytes() != live.convert('RGBA').tobytes():
                    raise ValueError('Selected ZIP core PNG differs from current source.')
        for motion in motions:
            name = 'motions/' + motion['id'] + '.gif'
            if archive.read(asset + name) != (directory / 'preview' / name).read_bytes():
                raise ValueError('Selected ZIP GIF differs from current source: ' + name)
    return {'nativeCell': cell, 'poses': len(frames), 'motionGifs': len(motions),
            'binding': report['binding'], 'sourceHashes': report['sources'],
            'idleRgbaSha256': sha(frames['idle_a'].tobytes()),
            'idleAlphaSha256': sha(frames['idle_a'].getchannel('A').tobytes()),
            'review': {'jobId': review['jobId'], 'recommendation': review['recommendation'],
                       'issues': review['issues'], 'userApproved': review['userApproved']},
            'decisions': decisions, 'pack': str(pack), 'packSha256': sha(pack.read_bytes()),
            'nativePngAndGifReread': True, 'selectedNativePosePngsReread': len(names),
            'selectedNativeGridsAndPaletteReread': True, 'selectedResourceMetadataReread': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--seed', default=str(REPO / 'harness-data/battle-monster/seed.json'))
    parser.add_argument('--root', default=str(REPO / 'qa-runs/harnesses/battle-monster'))
    args = parser.parse_args()
    plan = load(args.plan)
    ids = [row['id'] for row in plan['roster']]
    if len(ids) != plan['count'] or len(set(ids)) != len(ids):
        raise ValueError('Plan count/unique species mismatch.')
    results = []
    for monster in ids:
        h = Harness(argparse.Namespace(seed=args.seed, root=args.root, monster=monster, candidate=plan['candidate']))
        directory = h.directory()
        row = {'key': monster + '/' + plan['candidate'], 'passed': False}
        if not directory.exists():
            row['error'] = 'Not yet published.'
        else:
            try:
                row.update(inspect(h, directory), passed=True)
            except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
                row['error'] = str(error)
        results.append(row)
    passed = [r for r in results if r['passed']]
    duplicate = len({r['idleRgbaSha256'] for r in passed}) != len(passed)
    complete = len(passed) == plan['count'] and not duplicate
    save(args.out, {'at': stamp(), 'expectedSpecies': plan['count'], 'passedSpecies': len(passed),
                    'posesVerified': sum(r['poses'] for r in passed),
                    'motionGifsVerified': sum(r['motionGifs'] for r in passed),
                    'duplicateIdleImages': duplicate, 'passed': complete, 'items': results})
    print(f"Batch audit: {len(passed)}/{plan['count']}; complete={complete}")
    return 0 if complete else 1


if __name__ == '__main__':
    raise SystemExit(main())
