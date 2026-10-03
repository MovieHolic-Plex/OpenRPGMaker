"""격리된 묶음 작업자가 도트를 저작하고 기존 비교 화면에 후보를 게시한다.

python3 bulk.py manifest.json --par 6
manifest: {run, characters:[{key,name,base,brief,gender,strength,...}]}
원본/산출물/카탈로그는 CHR_HARNESS_DATA 아래. 받기 결정은 변경하지 않는다.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import threading
import tempfile
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import harness as H
import chr as C

LOCK = threading.Lock()


def write_json(path, value):
    H.write_json_atomic(path, value)


def log(message):
    with LOCK:
        print(f'{H.now()} {message}', flush=True)


def prepare_batch(run, rows, index):
    root = H.run_dir(run)
    batch = root / '_batches' / f'{index:02d}'
    batch.mkdir(parents=True, exist_ok=True)
    assignments = []
    discarded_file = root / 'discarded.json'
    discarded = {r['key'] for r in json.loads(discarded_file.read_text())['characters']} if discarded_file.exists() else set()
    for row in rows:
        if row['key'] in discarded:
            continue  # 재개가 이미 버린 결과를 다시 생산해서는 안 된다.
        w = batch / 'characters' / f'{row["key"]}__gpt-r1'
        w.mkdir(parents=True, exist_ok=True)
        alias = root / w.name
        if alias.exists() and alias.resolve() != w.resolve():
            raise ValueError(f'다른 묶음을 가리키는 후보: {alias}')
        if not alias.exists():
            alias.symlink_to(w.relative_to(root), target_is_directory=True)
        pal, frames = H.base_of(row['base'])
        base = w / 'base.chr.txt'
        if not base.exists():
            base.write_text(C.dump(pal, {}, frames, header='저작 원본 — 수정하지 않는다'), encoding='utf-8')
            H.make_views(base, w / 'base-views', row['base'], row['strength'])
        assignments.append(dict(row, folder=str(w.relative_to(batch))))
    write_json(batch / 'assignments.json', assignments)
    return batch, assignments


def review_batch(batch, rows):
    """그림만 받은 Sonnet이 각 사람을 독립 판정하고 관찰 설명을 쓴다."""
    work = Path(tempfile.mkdtemp(prefix='inspection-', dir=batch))
    entries = []
    for row in rows:
        w = batch / row['folder']
        entries.append(dict(key=row['key'], name=row['name'], brief=row['brief'], strength=row['strength'], folder=str(w),
                            inspected=H.current_gate(w)))
    write_json(work / 'assignments.json', entries)
    reviewer = (H.HERE / 'reviewer.md').read_text(encoding='utf-8')
    describer = (H.HERE / 'describe.md').read_text(encoding='utf-8')
    prompt = f'''묶음의 캐릭터 {len(rows)}명을 각각 독립 검수하고 설명한다. 모델은 Claude Sonnet 5.5 medium이다.
작업 폴더: {work}. 여기에 results.json만 쓴다. 그림이나 notes.md를 수정/열람하지 않는다.
assignments.json의 각 folder에서 views/strip.png, views/sheet_x8.png, views/context.png,
views/gate.json, base-views/strip.png를 모두 직접 Read로 열어 본다. 그림이 정본이다.
아래 단일 캐릭터 검수 계약을 사람마다 적용하되 결과 파일은 묶어서 results.json에 쓴다.
지시는 assignments의 brief, 강도는 strength, 이름은 name이다.

{reviewer}

각 그림의 실제 관찰 설명도 다음 계약으로 쓴다. 지시에 있지만 안 보이면 보인다고 쓰지 않는다.
{describer}

출력 results.json 형식: {{"results":[{{"key":"assignment key","review":{{"verdict":"PASS|FAIL","score":0,
"discard":false,"fatal":[],"issues":[],"good":[]}},"description":{{"label":"실제 외형 이름","gender":"남|여|불명",
"attributes":{{"kind":"사람","age":"청년","hair":"관찰 머리"}},"role":"관찰 역할",
"appearance":"보이는 옷/머리 1~2문장","colors":[],"tags":[],"fits":"어울리는 쓰임"}}}}]}}
모든 지정 key를 정확히 한 번씩 넣는다. PASS는 score >=8, high/mid 이슈 없을 때만 가능하다.
notes나 작업자 로그는 보지 않는다. 다른 파일에는 쓰지 않는다. 질문하지 않는다.
'''
    (work / 'prompt.md').write_text(prompt, encoding='utf-8')
    process = H._spawn('sonnet', work, work / 'prompt.md', work / 'review.log')
    process.wait()
    if process.returncode != 0:
        raise RuntimeError(f'검수 프로세스 실패: {process.returncode}, {work}')
    results = json.loads((work / 'results.json').read_text(encoding='utf-8'))['results']
    if {r['key'] for r in results} != {r['key'] for r in rows} or len(results) != len(rows):
        raise ValueError('검수 key 누락/중복')
    by_key = {r['key']: r for r in results}
    for row in rows:
        w = batch / row['folder']
        review = by_key[row['key']]['review']
        if (review.get('discard') or review.get('fatal') or review.get('score', 0) < 8
                or any(i.get('severity') in ('high', 'mid') for i in review.get('issues', []))):
            review['verdict'] = 'FAIL'
        (w / 'review').mkdir(exist_ok=True)
        write_json(w / 'review' / 'verdict.json', review)
        H.bind_review(w, next(r['inspected'] for r in entries if r['key'] == row['key']))
        H.read_verdict(w)
        desc = by_key[row['key']]['description']
        desc.update(by=H.ENGINES['sonnet']['label'], at=H.now())
        write_json(w / 'desc.json', desc)


def produce_batch(run, rows, index):
    batch, assignments = prepare_batch(run, rows, index)
    active = [r['key'] for r in assignments if (batch / r['folder'] / 'meta.json').exists()
              and H._alive(json.loads((batch / r['folder'] / 'meta.json').read_text()).get('pid'))]
    if active:
        raise RuntimeError(f'기존 작업자가 아직 실행 중입니다: {active}')
    pending = [r for r in assignments if not (batch / r['folder'] / 'views' / 'gate.json').exists()
               or not (batch / r['folder'] / 'out.chr.txt').exists()]
    if pending:
        prompt = (H.HERE / 'bulk-worker.md').read_text(encoding='utf-8')
        prompt = prompt.replace('{TOOL}', f'python3 {H.HERE / "harness.py"}')
        prompt = prompt.replace('{STRENGTH_RULES}', '\n\n'.join(H.STRENGTH_RULES[s] for s in sorted({r['strength'] for r in pending})))
        prompt = prompt.replace('{ASSIGNMENTS}', json.dumps(pending, ensure_ascii=False, indent=2))
        (batch / 'prompt.md').write_text(prompt, encoding='utf-8')
        process = H._spawn('gpt', batch, batch / 'prompt.md', batch / 'worker.log')
        for row in pending:
            w = batch / row['folder']
            write_json(w / 'meta.json', dict(run=run, brief=row['key'], engine='gpt', **H.ENGINES['gpt'],
                                            pid=process.pid, started=H.now(), dir=str(w), base=row['base'],
                                            strength=row['strength'], batch=index, src=None))
        log(f'batch {index}: GPT high 시작 ({len(pending)}명), pid={process.pid}')
        process.wait()
        log(f'batch {index}: 작업자 종료={process.returncode}')
    ready = []
    for row in assignments:
        w = batch / row['folder']
        try:
            H.propagate_file(w / 'out.chr.txt', row['base'])
            gate = H.make_views(w / 'out.chr.txt', w / 'views', row['base'], row['strength'])
            if gate['ok']:
                ready.append(row)
            log(f'{row["key"]}: 그림 저장, 기계 검사={gate["ok"]}')
        except Exception as error:
            log(f'{row["key"]}: 산출 실패 {error!r}')
    unreviewed = [r for r in ready if not (batch / r['folder'] / 'desc.json').exists()
                  or not H.read_verdict(batch / r['folder'])
                  or H.read_verdict(batch / r['folder']).get('stale')]
    if unreviewed:
        log(f'batch {index}: Sonnet 검수·관찰 설명 시작 ({len(unreviewed)}명)')
        review_batch(batch, unreviewed)
    write_json(batch / 'complete.json', dict(at=H.now(), ready=[r['key'] for r in ready]))
    log(f'batch {index}: 완료 {len(ready)}/{len(rows)}')


def main(args):
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    run, rows = manifest['run'], manifest['characters']
    if not rows or len({r['key'] for r in rows}) != len(rows):
        raise ValueError('캐릭터 key가 비었거나 중복됨')
    if not 1 <= args.par <= 6 or not 1 <= args.batch_size <= 8:
        raise ValueError('동시 작업 1~6, 묶음 크기 1~8')
    for row in rows:
        if '/' in row['key'] or row['strength'] not in H.STRENGTH_RULES:
            raise ValueError('잘못된 key/강도')
        H.norm_base(row['base'])
    root = H.run_dir(run)
    root.mkdir(parents=True, exist_ok=True)
    layout = root / 'production.json'
    config = dict(batchSize=args.batch_size)
    if layout.exists() and json.loads(layout.read_text()) != config:
        raise ValueError('기존 실행의 묶음 크기를 변경할 수 없음')
    if not layout.exists():
        previous = sorted((root / '_batches').glob('*/assignments.json'))
        if previous and args.batch_size != len(json.loads(previous[0].read_text())):
            raise ValueError('기존 실행과 다른 묶음 크기')
    write_json(layout, config)
    snapshot = root / 'manifest.json'
    if snapshot.exists() and json.loads(snapshot.read_text()) != manifest:
        raise ValueError('기존 실행의 manifest를 변경할 수 없음')
    write_json(snapshot, manifest)
    local = json.loads(H.LOCAL_BRIEFS.read_text()) if H.LOCAL_BRIEFS.exists() else {}
    for row in rows:
        if row['key'] in local and local[row['key']] != row:
            raise ValueError(f'기존 지시 충돌: {row["key"]}')
        local[row['key']] = row
    write_json(H.LOCAL_BRIEFS, local)
    errors = []
    with ThreadPoolExecutor(max_workers=args.par) as pool:
        tasks = [pool.submit(produce_batch, run, rows[i:i + args.batch_size], i // args.batch_size + 1)
                 for i in range(0, len(rows), args.batch_size)]
        for task in as_completed(tasks):
            try:
                task.result()
            except Exception as error:
                log(f'묶음 오류: {error!r}')
                errors.append(repr(error))
    if errors:
        write_json(root / 'production-errors.json', dict(at=H.now(), errors=errors))
        raise RuntimeError(f'완료되지 않은 묶음 {len(errors)}개: {errors}')
    catalog = []
    for row in rows:
        w = root / f'{row["key"]}__gpt-r1'
        if not (w / 'out.chr.txt').exists():
            continue
        gate = H.current_gate(w)
        decision = H._decisions().get(f'{run}/{w.name}', {}).get('decision')
        if not H.quality(w, decision, gate)['eligible']:
            continue
        catalog.append(dict(key=row['key'], name=row['name'], genre=row.get('genre'), folder=w.name,
                            sha256=hashlib.sha256((w / 'out.chr.txt').read_bytes()).hexdigest(),
                            gate=gate,
                            review=H.read_verdict(w), description=H._desc(w)))
    write_json(root / 'catalog.json', dict(run=run, expected=len(rows), count=len(catalog), characters=catalog))
    log(f'전체 저장 {len(catalog)}/{len(rows)}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--par', type=int, default=6)
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--detach', action='store_true', help='터미널 종료와 독립된 생산 드라이버로 실행')
    args = parser.parse_args()
    run = json.loads(args.manifest.read_text())['run']
    if args.detach:
        root = H.run_dir(run)
        root.mkdir(parents=True, exist_ok=True)
        with (root / 'production.log').open('a') as log_file:
            child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), str(args.manifest.resolve()),
                                      '--par', str(args.par), '--batch-size', str(args.batch_size)],
                                     stdin=subprocess.DEVNULL, stdout=log_file, stderr=subprocess.STDOUT, start_new_session=True)
        write_json(root / 'driver.json', dict(pid=child.pid, started=H.now(), run=run))
        print(f'생산 드라이버 pid={child.pid}: {root / "production.log"}')
        sys.exit(0)
    with H.run_lock(H.run_dir(run)):
        main(args)
