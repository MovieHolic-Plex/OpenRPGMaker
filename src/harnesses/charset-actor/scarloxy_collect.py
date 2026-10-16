#!/usr/bin/env python3
"""Scarloxy 변형 칩 채택분을 scarloxy-people-chips/ 로 모으고 설치 명단(scarloxy-people-install.json)에 **덧붙인다**(2026-10-16 2차).

  python3 scarloxy_collect.py harness-data/charset-actor/scarloxy-people/round2.json [--runs ~/spc-runs] [--dry]

round2.json 항목: {key, source: 'argon'|'script', run, rkey(Argon 런 폴더 키)|recipe(recipes-2.json 의 key), id, name, desc, role, gender, age, tags}
처리: ① 최종 격자·edit.json·meta 를 scarloxy-people-chips/<key>/ 에 복사(스크립트 칩은 compose 로 다시 만들어 격자를 쓴다)
      ② scarloxy_lock 으로 얼굴·피부·손 12프레임 화소 고정 검사 — 실패하면 거절
      ③ 서로 너무 비슷한 칩 거름: 가장 가까운 기존·채택 칩과 다른 화소 비율이 MIN(기본 0.30) 미만이면 거절(결과를 round2-distinct.json 에 기록)
      ④ 칸 번호는 덧붙이기 전용: 마지막 시트의 빈 칸부터 채우고 넘치면 새 시트. 이미 명단에 있는 key 는 건드리지 않는다.
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import scarloxy_compose as S  # noqa: E402
import scarloxy_distinct as D  # noqa: E402
import scarloxy_lock as L  # noqa: E402

PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
INSTALL = ROOT / 'harness-data/charset-actor/scarloxy-people-install.json'
RECIPES = ROOT / 'harness-data/charset-actor/scarloxy-people/recipes-2.json'
MIN = float(os.environ.get('SPC_COLLECT_MIN', '0.30'))


def chip_array(key):
    pal, _, frames = C.load(PICKS / key / 'chip.chr.txt')
    return np.array(C.sheet_rgba(pal, frames)).astype(int)


def stage(entry, runs):
    d = PICKS / entry['key']
    d.mkdir(parents=True, exist_ok=True)
    if entry['source'] == 'argon':
        src = runs / entry['run'] / entry['rkey']
        m = json.loads((src / 'meta.json').read_text(encoding='utf-8'))
        if not m.get('ok'):
            raise SystemExit(f'{entry["key"]}: Argon 런 {src} 가 ok 가 아니다')
        shutil.copy(src / 'chip.chr.txt', d / 'chip.chr.txt')
        shutil.copy(src / 'edit.json', d / 'edit.json')
        meta = dict(key=entry['key'], arch=m['arch'], base=m['base'], variant=m['variant'], model=m['model'], effort=m['effort'], ok=True,
                    harness=m.get('harness'), attempts=len(m['attempts']), warnings=m.get('warnings', [])[:3], metrics=m.get('metrics', {}),
                    distinct=m.get('distinct'), repairs=m.get('repairs'), run=f'{entry["run"]}/{entry["rkey"]}')
    else:
        recs = {r['key']: r for r in json.loads(RECIPES.read_text(encoding='utf-8'))['chips']}
        rec = recs[entry['recipe']]
        pal, rows, errs, warns = S.build_one(rec)
        if errs:
            raise SystemExit(f'{entry["key"]}: 스크립트 빌드 실패 {errs[:2]}')
        (d / 'chip.chr.txt').write_text(C.dump(pal, {}, rows, header=f'{entry["key"]} — script-compose head={rec["head"]} body={rec["body"]}'), encoding='utf-8')
        meta = dict(key=entry['key'], name=rec.get('name'), head=rec['head'], body=rec['body'], recolor=rec.get('recolor', []), ok=True,
                    warnings=warns[:3], model='script-compose(no model call)', recipe=entry['recipe'])
    (d / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('manifest')
    ap.add_argument('--runs', default=os.path.expanduser('~/spc-runs'))
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    runs = Path(a.runs)
    manifest = json.loads(Path(a.manifest).read_text(encoding='utf-8'))
    install = json.loads(INSTALL.read_text(encoding='utf-8'))
    have = {c['key'] for s in install['sheets'] for c in s['characters']}   # vacant(사용자가 뺀 칸)도 key 를 가지므로 다시 채택되지 않는다
    todo = [e for e in manifest['chips'] if e['key'] not in have]
    for e in todo:
        stage(e, runs)
    # ② 고정 검사
    bad = []
    for e in todo:
        r = L.check(e['key'])
        print('lock', e['key'], r['cells'], '칸', '통과' if r['ok'] else f'실패 {r["bad"]}')
        if not r['ok']:
            bad.append(e['key'])
    # ③ 서로 비슷한지: 기존 설치 시트 + 이번 채택 전체(자기 자신 제외)
    base = [(n, c) for n, c in ((n, c) for n, c in D.existing()) if not n.startswith('accepted:')]
    pool = {e['key']: chip_array(e['key']) for e in todo}
    report = {}
    for e in todo:
        me = pool[e['key']]
        best = (9.0, '')
        for n, c in base:
            s = D.score(me, c)
            if s < best[0]:
                best = (s, n)
        for k, c in pool.items():
            if k != e['key']:
                s = D.score(me, c)
                if s < best[0]:
                    best = (s, k)
        report[e['key']] = dict(score=round(float(best[0]), 3), nearest=best[1])
        print('distinct', e['key'], f'{best[0]:.2f}', best[1], '' if best[0] >= MIN else '  ← 너무 비슷')
        if best[0] < MIN:
            bad.append(e['key'])
    (ROOT / 'harness-data/charset-actor/scarloxy-people/round2-distinct.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    if bad:
        print('거절:', bad)
        sys.exit(1)
    if a.dry:
        return
    # ④ 덧붙이기
    sheets = install['sheets']
    for e in todo:
        if sheets[-1]['n'] < 5 or len(sheets[-1]['characters']) >= 8:   # vacant 칸도 한 칸으로 센다   # ScarloxyPeople1~4 는 불변: 새 칩은 5번 시트부터
            sheets.append(dict(n=sheets[-1]['n'] + 1, characters=[]))
        sheets[-1]['characters'].append(dict(key=e['key'], id=e['id'], name=e['name'], desc=e['desc'], role=e['role'], gender=e.get('gender'), age=e.get('age'),
                                             tags=e['tags'], genre='몬스터 수집'))
    if manifest.get('selection_note'):
        install['selection']['note'] = install['selection']['note'] + ' | ' + manifest['selection_note']
    INSTALL.write_text(json.dumps(install, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('명단에 덧붙임', len(todo), '종 → 시트', [s['n'] for s in sheets])


if __name__ == '__main__':
    main()
