"""Supervise a distinct-monster order using native artists and bounded redraws."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import time
import uuid
from datetime import datetime

import harness as H
import recipes as R
import studio as S


def live_record(path):
    """Artist-owned records can be in the middle of a direct write."""
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def members(order):
    result = []
    for file in (H.DATA / 'runs').glob('*/manifest.json'):
        manifest = json.loads(file.read_text())
        if manifest.get('noveltyPolicy', {}).get('root') == order and file.parent.name != order:
            result.append((file.parent, manifest))
    return result


def transferred(root):
    file = root / 'novelty-transfers.json'
    return json.loads(file.read_text()) if file.exists() else []


def redraw(root, manifest, row, reason, evidence):
    attempt = row.get('noveltyAttempt', 0)
    if attempt >= 2:
        return None
    with H.data_lock('studio'):
        old = transferred(root)
        if any(t['key'] == row['key'] for t in old):
            return None
        name = datetime.now().strftime('%Y%m%d-%H%M%S') + '-monster-redraw-' + uuid.uuid4().hex[:8]
        target = H.run_dir(name)
        target.mkdir()
        try:
            shutil.copytree(root / 'recipe', target / 'recipe')
            next_manifest = copy.deepcopy(manifest)
            next_row = copy.deepcopy(row)
            next_row.update(key='redo-' + name[-8:] + '-' + row['key'], noveltyAttempt=attempt + 1)
            next_row['brief'] += (' 이번은 이전 후보의 재저작이다. 이전 후보는 ' + reason
                                  + ' 때문에 공개 대상이 아니다. 이번 몸 구조의 외곽과 큰 면, 지지부와 모든 이동 프레임을 직접 다시 설계한다.')
            next_manifest.update(run=name, continuationOf=root.name, characters=[next_row],
                                 title=f'몸 재저작 {row["planSlot"] + 1:03d} · {row["name"]}',
                                 productionPolicy=dict(manifest['productionPolicy'], maxReviewPending=1))
            H.write_json_atomic(target / 'manifest.json', next_manifest)
            H.write_json_atomic(target / 'production.json', dict(par=1, batchSize=1))
            H.write_json_atomic(target / 'production-state.json', dict(phase='queued', at=H.now(), active=0, remaining=1))
            R.verify_run(target, next_manifest, check_tools=True)
            transfer = dict(key=row['key'], planSlot=row['planSlot'], to=name, reason=reason, at=H.now())
            H.write_json_atomic(root / 'novelty-transfers.json', old + [transfer])
        except Exception:
            shutil.rmtree(target)
            raise
        alias = root / (row['key'] + '__gpt-r1')
        if alias.exists():
            spec = importlib.util.spec_from_file_location('native_discard', H.HERE / 'bulk-export.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            file = root / 'discarded.json'
            previous = json.loads(file.read_text())['characters'] if file.exists() else []
            record = dict(key=row['key'], dir=alias.name, reason=reason,
                          archive=str(H.DATA / 'discarded' / 'original-monster-redraws' / root.name / alias.name), state='pending')
            H.write_json_atomic(file, dict(run=root.name, characters=previous + [record]))
            module.finish_discard(root, record)
            H.write_json_atomic(file, dict(run=root.name, characters=previous + [record]))
        H.write_json_atomic(evidence / ('redraw-' + name[-8:] + '.json'), transfer)
        return name


def supervise(order, evidence):
    evidence = Path(evidence)
    parent = json.loads((H.run_dir(order) / 'manifest.json').read_text())
    wanted = {r['planSlot'] for r in parent['characters']}
    deadline = time.monotonic() + 24 * 3600
    while time.monotonic() < deadline:
        admitted, exhausted, queued = set(), {}, []
        for root, manifest in members(order):
            retired = {t['key'] for t in transferred(root)}
            state_file = root / 'production-state.json'
            state = live_record(state_file)
            driver_file = root / 'driver.json'
            driver = live_record(driver_file)
            alive = H._alive(driver.get('pid'))
            if state.get('phase') == 'queued' and not alive and not (root / 'pause-request.json').exists():
                queued.append((root, manifest))
            for row in manifest['characters']:
                if row['key'] in retired:
                    continue
                work = root / (row['key'] + '__gpt-r1')
                report_file = work / 'novelty.json'
                report = live_record(report_file)
                grid_file = work / 'out.chr.txt'
                meta_file = work / 'meta.json'
                meta = live_record(meta_file)
                if report and grid_file.exists() and report.get('sourceSha256') == R.sha(grid_file):
                    admitted_report = (report.get('bodyAdmissionVersion') == 1
                                       and report.get('referencesSha256') == manifest['noveltyPolicy']['referencesSha256'])
                    if report['eligible'] and admitted_report and (work / 'published.json').exists() and H.human_ready(work, H.current_gate(work)):
                        admitted.add(row['planSlot'])
                    elif not report['eligible'] and not H._alive(meta.get('pid')):
                        # Wait for the native producer's receipt before moving its folder.
                        complete = root / '_batches' / f'{meta.get("batch", 0):02d}' / 'complete.json'
                        if complete.exists():
                            reason = '같은 몸 형태/팔레트 치환 반복: ' + json.dumps(report['matches'][:2], ensure_ascii=False)
                            if redraw(root, manifest, row, reason, evidence) is None:
                                exhausted[row['planSlot']] = reason
                elif not alive and state.get('phase') in ('failed', 'completed') and (work / 'failure.json').exists():
                    reason = '기술 납품 미완료: ' + (work / 'failure.json').read_text()[:1600]
                    if redraw(root, manifest, row, reason, evidence) is None:
                        exhausted[row['planSlot']] = reason
        # Redraw small failures first, then start the six balanced initial cohorts.
        queued.sort(key=lambda pair: (len(pair[1]['characters']), min(r['planSlot'] for r in pair[1]['characters'])))
        with H.data_lock('studio'):
            active = S.active_productions()
            used = sum(r['par'] for r in active)
            for root, manifest in queued:
                if used >= S.MAX_ARTISTS:
                    break
                if (root / 'pause-request.json').exists() or any(a['run'] == root.name for a in active):
                    continue
                S._control(root.name, True)
                used += 1
        current = S.active_productions()
        active_here = [r for r in current if json.loads((H.run_dir(r['run']) / 'manifest.json').read_text()).get('noveltyPolicy', {}).get('root') == order]
        record = dict(at=H.now(),order=order,planned=len(wanted),admitted=len(admitted),remaining=len(wanted-admitted),
                      activeArtists=sum(r['par'] for r in active_here),maxArtists=S.MAX_ARTISTS,exhausted=exhausted,
                      phase='completed' if admitted==wanted else 'running')
        H.write_json_atomic(evidence / 'supervisor-state.json', record)
        if admitted == wanted:
            return
        if exhausted and not active_here and not queued:
            H.write_json_atomic(evidence / 'supervisor-state.json', dict(record, phase='needs-attention'))
            return
        time.sleep(5)
    raise RuntimeError('Production deadline reached; unfinished plans were not counted as delivered')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--order', required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    try:
        with H.data_lock('original-monster-supervisor-' + args.order):
            supervise(args.order, args.evidence)
    except Exception as error:
        H.write_json_atomic(args.evidence / 'supervisor-error.json', dict(at=H.now(), error=str(error)))
        raise
