"""Publish a small, read-only view of current artifacts; never read model reasoning.

The existing /data route serves the snapshot, so UI updates don't interrupt authors
or the shared publisher. One observer owns the output via flock.
"""
from datetime import datetime
import fcntl
import json
from pathlib import Path
import re
import sqlite3
import time

import activity
import gates
import sh
import store

TASKS = {
    'plan': ('용도·구역·동선을 정하고 텍스트 도면을 작성합니다.', '기획도와 기획 검수 결과'),
    'plan-review': ('기획자와 별도의 A/B 검수자가 공간 크기·동선·정체성을 확인합니다.', 'A/B 판정 → 통과하면 재료 조사'),
    'survey': ('실제로 쓸 수 있는 칩과 없는 칩을 구분하고 제작 목록을 정리합니다.', '필수 재료 목록과 부족한 칩의 주문서'),
    'material-review': ('재료의 시대·용도·조립 가능성을 실제 근거와 대조합니다.', '재료 승인 또는 보완 지시'),
    'art': ('도면·부품 치수·시점·조립 좌표를 맞추고 제작 주문서를 준비합니다.', '도면 독립 검수 → 통과하면 실제 칩 제작'),
    'art-native': ('전용 그림 하네스가 칩을 그리고 원본·조립 그림을 검수합니다.', '칩 그림과 공간에 배치한 예시'),
    'art-layout-review': ('그리기 전에 공간 여백·벽 접합·3/4 시점·통행을 검사합니다.', '도면 승인 후 칩 제작, 반려 시 명세 수정'),
    'art-demo': ('제작된 실제 타일로 공간 전체를 조립하고 있습니다.', '공간 전체 데모 → 독립 검수 → Allow / Deny'),
    'art-context-review': ('실제 칩을 배치한 예시에서 반복·가림·시점·공간 구성을 검사합니다.', '사용자가 Allow / Deny할 예시'),
    'art-review': ('생성된 예시와 선택·등록 상태를 확인하는 단계입니다.', '예시 선택 → 공용 등록·공간 조립'),
    'build': ('준비된 재료로 공간을 조립하고 결과 이미지를 만듭니다.', '공간 전체 이미지'),
    'review': ('완성 그림의 구조·시점·반복·빈 공간을 독립 검수합니다.', '시각 검수 결과'),
    'probe': ('조수가 같은 공간을 실제로 만들 수 있는지 배치 시험을 합니다.', '조수의 배치 결과와 시험 판정'),
    'judge': ('배치 시험 결과를 비교하고 공용 등록 가능 여부를 판정합니다.', '사용자가 확인할 최종 결과'),
    'result-review': ('최종 결과를 확인할 수 있습니다.', '수정 / Allow / Deny'),
    'bake': ('승인된 결과를 공용 자료에 반영합니다.', '등록 결과'),
}


def local(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('outside worktree')
    return path


def native(cid):
    """Only the current execution's isolated queue; PNGs here are unreviewed WIP."""
    root = Path(sh.DATA) / 'art-worktrees' / cid
    request = sh.read_json(sh.cdir(cid, 'art-execution.json'), {}) or {}
    counts, previews, outputs = {}, [], []
    try:
        if request.get('harness') == 'interior-props':
            data_dir = local(root, request['data'])
            seed = sh.read_json(data_dir / 'seed.json', {}) or {}
            content = local(root, seed.get('contentRoot', '.'))
            database = data_dir / 'harness.sqlite'
            with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=1) as db:
                db.row_factory = sqlite3.Row
                rows = db.execute('SELECT runs.*, rounds.item, rounds.root FROM runs JOIN rounds ON runs.round=rounds.id').fetchall()
            for row in rows:
                status = row['status']
                if status == 'running' and row['log']:
                    log = Path(row['log'])
                    if log.is_file(): outputs.append(log.stat().st_mtime)
                phase = row['phase'] if 'phase' in row.keys() else 'draw'
                key = 'reviewing' if status == 'running' and phase.startswith('review') else status
                counts[key] = counts.get(key, 0) + 1
                # A copied baseline outside this execution root is never an output.
                if Path(row['root']).resolve() != root.resolve():
                    continue
                slug = re.sub(r'[^A-Za-z0-9]+', '_', row['item']).strip('_')
                path = local(root, str(content.relative_to(root) / f"tiledata/hand-interior/pick/candidates/{slug}/h{row['round']}-{row['letter']}.png"))
                if not path.is_file():
                    continue
                # Fresh queues may reuse h1-A filenames from a prior request.
                started = datetime.fromisoformat(row['started']).timestamp() if row['started'] else None
                if row['ok'] is None and (started is None or path.stat().st_mtime < started):
                    continue
                if path.is_file():
                    previews.append(dict(path=str(path.relative_to(Path(sh.DATA))), v=path.stat().st_mtime_ns,
                        label='제작 중 칩 · 검수 전', kind='제작 중', modified=path.stat().st_mtime))
        elif request.get('harness') == 'modern-chipset':
            run = local(root, str(Path(request['runs']) / request['round']))
            state = sh.read_json(run / 'state.json', {}) or {}
            for letter, cand in state.get('cands', {}).items():
                key = cand.get('status', 'unknown')
                counts[key] = counts.get(key, 0) + 1
                if not re.fullmatch('[A-Za-z0-9_-]+', letter):
                    continue
                if key in ('drawing', 'reviewing'):
                    for suffix in ('.log', '.review.log'):
                        log = run / 'logs' / f"{letter}.a{int(cand.get('attempt') or 1)}{suffix}"
                        if log.is_file(): outputs.append(log.stat().st_mtime)
                digest = (cand.get('check') or {}).get('imageSha256')
                if digest:
                    previews += sh.verified_images(root, [{'path': str((run / (letter + '.png')).relative_to(root)),
                        'sha256': digest}], '제작 중 칩 · 최종 승인 전', '제작 중')
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error):
        return {'available': False, 'counts': {}, 'previews': [], 'outputAgeSeconds': None}
    return {'available': bool(counts), 'counts': counts, 'previews': previews,
            'outputAgeSeconds': max(0, int(time.time()-max(outputs))) if outputs else None}


def describe(c, item):
    cid, folder = c['id'], Path(sh.cdir(c['id']))
    plan = gates.planning_report(folder, approved=False)
    approved = gates.planning_report(folder)
    material = gates.material_report(folder)
    candidates = sh.candidate_images(cid)
    plans = sh.planning_images(cid)
    assembled = sh.demo_images(cid) or (sh.example_images(cid) if not sh.before_build(c) else [])
    reviews = {k: sh.read_json(folder / 'reviews' / f'{c["attempt"]}-{k}.json') for k in ('A', 'B')}
    visual = bool(assembled) and gates.visual_report(folder, reviews)['ok']
    tested = visual and c['stage'] in ('result-review', 'bake', 'done')
    milestones = [
        ('기획 작성', plan['ok']), ('기획 승인', approved['ok']),
        ('재료 준비', material['ok']), ('칩 그림 확보', bool(candidates) or material['ok']),
        ('공간 조립', bool(assembled)), ('시각 검수', visual),
        ('조수 시험', tested), ('공용 등록', c['stage'] == 'done'),
    ]
    current = next((j['kind'] for j in item['jobs'] if j['alive']), c['stage'])
    task, deliverable = TASKS.get(current, (item['note'] or item['label'], item['next']))
    if any(j['kind'] == 'art' and '결과 정리' in j['label'] for j in item['jobs']):
        task, deliverable = '제작된 그림과 검수 결과를 모으고 사용자 예시를 준비합니다.', 'Allow / Deny할 실제 예시'
    elif current == 'art' and c['reasons']:
        task = '이전 검수에서 반려된 도면·치수·시점·조립 명세를 수정하고 있습니다.'
    progress = native(cid)
    # WIP collection is separate from validated artifacts and never satisfies a gate.
    images = [dict(im, kind=im.get('kind', '공간 결과'), modified=im['v']) for im in assembled + candidates + plans]
    seen = {im['path'] for im in images}
    images += [im for im in progress['previews'] if im['path'] not in seen]
    completed = sum(bool(done) for _, done in milestones)
    layout = sh.read_json(folder / 'art-layout-input.json', {}) or {}
    verdict = sh.read_json(folder / 'art-layout-review.json', {}) or {}
    fresh_verdict = verdict.get('verdict') if layout.get('fingerprint') and layout.get('fingerprint') == verdict.get('fingerprint') else None
    gaps = material.get('missing', [])
    drawing_count = len(candidates) + len([im for im in progress['previews'] if im['path'] not in {p['path'] for p in candidates}])
    return dict(id=cid, title=c['title'], task=task, deliverable=deliverable,
        percent=round(completed / len(milestones) * 100), completed=completed, total=len(milestones),
        milestones=[dict(label=label, done=bool(done)) for label, done in milestones],
        images=images[:8], imageCounts=dict(plans=len(plans), chips=drawing_count, spaces=len(assembled)),
        imageNote=('기획도는 배치 설명용입니다. 실제 칩·공간 그림과 별도로 셉니다.' if plans else '현재 기획도 미리보기도 아직 확인되지 않았습니다.'),
        native=progress['counts'], nativeAvailable=progress['available'], nativeOutputAgeSeconds=progress['outputAgeSeconds'],
        layoutVerdict=fresh_verdict, missing=[g.get('what') or g.get('id') for g in gaps][:12], missingCount=len(gaps),
        events=activity.events(cid), updated=time.time())


def snapshot():
    state = activity.snapshot()
    items = []
    for item in state['items']:
        if not (item['managed'] or item['jobs']):
            continue
        try:
            items.append(describe(store.concept(item['id']), item))
        except Exception:
            items.append(dict(id=item['id'], title=item['title'], error='산출물 확인이 지연되고 있습니다. 작업 실행 상태는 계속 갱신합니다.'))
    return dict(at=time.time(), items=items)


def main():
    folder = Path(sh.DATA) / 'monitoring' / 'space-progress'
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / 'observer.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        while True:
            sh.write_json(folder / 'latest.json', snapshot())
            time.sleep(10)


if __name__ == '__main__':
    main()
