#!/usr/bin/env python3
"""키트 자체 검사.

  python3 kit/selftest.py                 # 전부 (지형 렌더 약 2분)
  python3 kit/selftest.py --only errors   # 입력 오류 처리만(수 초). --only pixels | pick | errors
  python3 kit/selftest.py --cache /tmp/c  # 지형 캐시 재사용

pixels   fantasy 세트 + original 팔레트 + fantasy-5act 여정으로 만든 PNG 가 v9-final3 의 design-1x-final3.png(kit/ref/)와 화소 단위로 같은가.
         같지 않으면 다른 화소 수·범위·칸 수를 보여 준다. world.json 의 지형 배열이 map-v9-final3.json 과 같은지도 본다.
journey  빌더가 쓴 world.json 으로 돌린 여정 도달성 보고가 v9-final3 의 journey-check-final3.txt 와 글자 단위로 같은가.
errors   역할이 빠진 세트·칸 수가 틀린 세트·pins 가 틀린 세트·없는 팔레트·없는 여정이 명확한 메시지와 종료 코드 2 로 거절되는가.
종료 코드: 0 전부 통과, 1 실패.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
KIT = Path(__file__).resolve().parent
WM = KIT.parent
BUILD = KIT / 'build_world.py'
CHECK = KIT / 'check_journey.py'
RES = []


def report(name, ok, detail=''):
    RES.append((name, ok))
    print('%s %-34s %s' % ('PASS' if ok else 'FAIL', name, detail))


def run(cmd):
    p = subprocess.run([sys.executable] + cmd, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def pixels_and_journey(cache, only):
    import numpy as np
    from PIL import Image
    out = Path(tempfile.mkdtemp(prefix='wmk-self-'))
    cmd = [str(BUILD), '--iconset', 'fantasy', '--palette', 'original', '--journey', 'fantasy-5act', '--out', str(out)]
    if cache:
        cmd += ['--cache', cache]
    rc, txt = run(cmd)
    if rc != 0:
        report('build', False, txt.strip().splitlines()[-1] if txt.strip() else 'rc=%d' % rc)
        return
    a = np.array(Image.open(out / 'fantasy-original.png').convert('RGB'))
    b = np.array(Image.open(KIT / 'ref' / 'design-1x-final3.png').convert('RGB'))
    if a.shape != b.shape:
        report('pixels', False, 'shape %s vs %s' % (a.shape, b.shape))
    else:
        d = (a != b).any(2)
        if not d.any():
            report('pixels', True, 'fantasy+original == design-1x-final3.png, 차이 화소 0 / %d' % d.size)
        else:
            ys, xs = np.nonzero(d)
            cells = {(int(x) // 16, int(y) // 16) for y, x in zip(ys, xs)}
            report('pixels', False, '차이 화소 %d, 범위 x %d..%d y %d..%d, 칸 %d개' % (d.sum(), xs.min(), xs.max(), ys.min(), ys.max(), len(cells)))
    w = json.loads((out / 'world.json').read_text())
    r = json.loads((KIT / 'ref' / 'map-v9-final3.json').read_text())
    keys = ['ground', 'object', 'height_level', 'ramp', 'face', 'bridges', 'dune_sea']
    bad = [k for k in keys if w[k] != r[k]]
    if w['roads'] != r['routes']:
        bad.append('roads')
    if [(s['name'], s['x'], s['y'], s['w'], s['h']) for s in w['sites']] != [(s['name'], s['x'], s['y'], s['w'], s['h']) for s in r['sites']]:
        bad.append('sites')
    report('terrain json', not bad, 'world.json 지형 배열 == map-v9-final3.json' if not bad else '다른 항목: %s' % bad)
    ref_txt = (KIT / 'ref' / 'journey-check-final3.txt').read_text()
    got = (out / 'journey-check.txt').read_text()
    report('journey report', ref_txt == got, '도달성 보고 == journey-check-final3.txt (world.json 에서 복원한 지형으로)' if ref_txt == got else '보고 글자가 다르다')
    shutil.rmtree(out, ignore_errors=True)


def hash_selection(cache):
    """pins 를 뺀 세트로 두 번 만들면 같은 아이콘이 뽑히는가(장소 id crc32), 그리고 pins 가 없으면 원래 배정과 달라지는가."""
    import hashlib
    src = json.loads((WM / 'iconsets' / 'fantasy' / 'manifest.json').read_text())
    tmp = Path(tempfile.mkdtemp(prefix='wmk-hash-'))
    d = tmp / 't-nopins'
    d.mkdir()
    shutil.copyfile(WM / 'iconsets' / 'fantasy' / 'sheet.png', d / 'sheet.png')
    m = json.loads(json.dumps(src))
    m['id'] = 't-nopins'
    m['pins'] = {}
    (d / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False))
    hs, used = [], []
    for i in range(2):
        out = tmp / ('o%d' % i)
        rc, txt = run([str(BUILD), '--iconset', str(d), '--palette', 'original', '--journey', 'fantasy-5act', '--out', str(out), '--cache', cache, '--no-check'])
        if rc != 0:
            report('hash selection', False, txt.strip().splitlines()[-1])
            return
        hs.append(hashlib.sha1((out / 't-nopins-original.png').read_bytes()).hexdigest())
        used.append(json.loads((out / 'world.json').read_text())['places'])
    same = hs[0] == hs[1]
    differs = [p['id'] for p in used[0] if p['icon'] != src['pins'].get(p['id'])]
    report('hash selection', same, '같은 입력 -> 같은 PNG(sha1 %s…); pins 없이 원래 배정과 다른 장소 %d곳(역할 변형이 둘 이상인 곳만 달라진다)' % (hs[0][:8], len(differs)))
    shutil.rmtree(tmp, ignore_errors=True)


def errors():
    src = json.loads((WM / 'iconsets' / 'fantasy' / 'manifest.json').read_text())
    tmp = Path(tempfile.mkdtemp(prefix='wmk-sets-'))

    def make(name, edit):
        d = tmp / name
        d.mkdir()
        shutil.copyfile(WM / 'iconsets' / 'fantasy' / 'sheet.png', d / 'sheet.png')
        m = json.loads(json.dumps(src))
        m['id'] = name
        edit(m)
        (d / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False))
        return str(d)

    def no_cave(m):
        m['icons'] = [i for i in m['icons'] if i['role'] != 'cave']
        m['pins'] = {k: v for k, v in m['pins'].items() if v not in ('cave_rock', 'cave_vine')}

    def bad_cells(m):
        for i in m['icons']:
            if i['role'] == 'cave':
                i['cells'] = [1, 1]
        m['pins'] = {k: v for k, v in m['pins'].items() if v not in ('cave_rock', 'cave_vine')}

    def bad_pin(m):
        m['pins']['강가 마을'] = 'cave_rock'

    base = ['--journey', 'fantasy-5act', '--out', str(tmp / 'out')]
    cases = [
        ('missing role', [str(BUILD), '--iconset', make('t-nocave', no_cave), '--palette', 'original'] + base, ['cave', '2x2', '산기슭 동굴']),
        ('wrong cells', [str(BUILD), '--iconset', make('t-badcells', bad_cells), '--palette', 'original'] + base, ['cave', '칸 수가 다른 후보']),
        ('bad pin', [str(BUILD), '--iconset', make('t-badpin', bad_pin), '--palette', 'original'] + base, ['pins', '강가 마을']),
        ('unknown palette', [str(BUILD), '--iconset', 'fantasy', '--palette', 'nope'] + base, ['palettes/nope.json']),
        ('unknown journey', [str(BUILD), '--iconset', 'fantasy', '--palette', 'original', '--journey', 'nope', '--out', str(tmp / 'out')], ['journeys/nope.json']),
        ('check: missing role', [str(CHECK), '--journey', 'fantasy-5act', '--iconset', str(tmp / 't-nocave')], ['cave']),
    ]
    for name, cmd, needles in cases:
        rc, txt = run(cmd)
        ok = rc == 2 and all(n in txt for n in needles) and 'Traceback' not in txt
        report('error: ' + name, ok, 'rc=%d %s' % (rc, txt.strip().splitlines()[1][:90] if len(txt.strip().splitlines()) > 1 else txt.strip()[:90]))
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', choices=['pixels', 'errors', 'pick'])
    ap.add_argument('--cache')
    a = ap.parse_args()
    cache = a.cache or tempfile.mkdtemp(prefix='wmk-cache-')
    if a.only in (None, 'pixels'):
        pixels_and_journey(cache, a.only)
    if a.only in (None, 'pick'):
        hash_selection(cache)
    if a.only in (None, 'errors'):
        errors()
    bad = [n for n, ok in RES if not ok]
    print('결과: %s' % ('전부 통과 (%d)' % len(RES) if not bad else '실패 %d / %d — %s' % (len(bad), len(RES), ', '.join(bad))))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
