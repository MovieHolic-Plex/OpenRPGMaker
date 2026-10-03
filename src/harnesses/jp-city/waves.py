#!/usr/bin/env python3
"""jp-city 웨이브 구동기 (사용: waves.py houses,station 3 → 로그 /tmp/jp-waves-*.log) — 항목을 P 개씩 동시에 그린다(항목당 후보 5장, 판 id 는 초 단위라 시작을 3초씩 엇갈린다)."""
import json, subprocess, sys, time, os, concurrent.futures as cf
ROOT = '/home/main/z-project/rpg-zzu-jp-city'
H = f'{ROOT}/src/harnesses/jp-city/harness.py'
waves = sys.argv[1].split(','); P = int(sys.argv[2]) if len(sys.argv) > 2 else 3
seed = json.load(open(f'{ROOT}/harness-data/jp-city/seed.json', encoding='utf-8'))
items = [k for w in waves for k, v in seed['items'].items() if v.get('wave') == w]
log = open(f'/tmp/jp-waves-{"-".join(waves)}.log', 'a', buffering=1)
def run(i_k):
    i, k = i_k
    time.sleep(3 * i)
    t = time.time()
    r = subprocess.run([sys.executable, H, 'draw', k, '--n', '5', '--fg'], cwd=ROOT, capture_output=True, text=True)
    print(f'{time.strftime("%H:%M:%S")} {k} rc={r.returncode} {int(time.time()-t)}s {(r.stdout+r.stderr).strip()[-200:]!r}', file=log)
    return k
print(f'start {items}', file=log)
with cf.ThreadPoolExecutor(max_workers=P) as ex:
    # 시작 엇갈림은 첫 P 개에만 적용되도록 인덱스를 P 로 나눈 나머지로 쓴다
    list(ex.map(run, [(n % P, k) for n, k in enumerate(items)]))
print('ALL DONE', file=log)
