"""제공자 용량 오류(503)가 잦을 때 주문을 우선순위 순서로 적은 병렬·백오프로 다시 시도하는 구동기.

bulk.produce_batch 를 그대로 호출한다(모델·검사·납품 계약 불변). 주문당 최대 N회, 실패하면 백오프(2→5→10분) 뒤 대기열 끝으로.
  python3 retry_driver.py RUN --par 2 --attempts 3
"""
import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, FIRST_COMPLETED, wait

import bulk as B
import harness as H

BACKOFF = (120, 300, 600)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('run')
    ap.add_argument('--par', type=int, default=2)
    ap.add_argument('--attempts', type=int, default=3)
    ap.add_argument('--interleave', action='store_true', help='후보 글자(a,b,c..)별로 원형을 돌아가며 주문한다(모든 원형에 먼저 한 안씩)')
    a = ap.parse_args()
    root = H.run_dir(a.run)
    manifest = json.loads((root / 'manifest.json').read_text())
    rows = manifest['characters']
    queue = [dict(i=i, row=r, tries=0, ready_at=0.0) for i, r in enumerate(rows, 1)]
    if a.interleave:
        queue.sort(key=lambda q: (q['row']['key'].rsplit('-', 1)[1], q['i']))
    (root / 'pause-request.json').unlink(missing_ok=True)
    H.write_json_atomic(root / 'driver.json', dict(pid=__import__('os').getpid(), started=H.now(), run=a.run, par=a.par, batchSize=1))
    active = {}
    given_up = []
    with H.run_lock(root), ThreadPoolExecutor(max_workers=a.par) as pool:
        while queue or active:
            now = time.time()
            if (root / 'pause-request.json').exists():
                queue = []
            while queue and len(active) < a.par:
                due = [q for q in queue if q['ready_at'] <= now]
                if not due:
                    break
                q = due[0]
                queue.remove(q)
                q['tries'] += 1
                B.log(f'[재시도 구동기] {q["row"]["key"]} 시도 {q["tries"]}/{a.attempts}')
                active[pool.submit(B.produce_batch, a.run, [q['row']], q['i'])] = q
            if not active:
                time.sleep(15)
                continue
            done, _ = wait(active, timeout=15, return_when=FIRST_COMPLETED)
            for task in done:
                q = active.pop(task)
                try:
                    task.result()
                    B.log(f'[재시도 구동기] {q["row"]["key"]} 성공')
                except Exception as error:
                    B.log(f'[재시도 구동기] {q["row"]["key"]} 실패: {error!r}')
                    if q['tries'] < a.attempts:
                        q['ready_at'] = time.time() + BACKOFF[min(q['tries'] - 1, len(BACKOFF) - 1)]
                        queue.append(q)
                    else:
                        given_up.append(q['row']['key'])
    B.log(f'[재시도 구동기] 종료. 포기: {given_up}')


if __name__ == '__main__':
    main()
