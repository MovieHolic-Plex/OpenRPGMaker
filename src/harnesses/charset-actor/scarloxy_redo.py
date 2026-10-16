#!/usr/bin/env python3
"""1차 스크립트 칩 12종을 Argon 부분 편집 재제작분으로 갈아 끼우는 도구(2026-10-16 3차).

  python3 scarloxy_redo.py compare RUN_DIR [--out DIR]   RUN_DIR 의 통과 후보와 설치된 옛 칩을 나란히(방향별 8배) PNG 로 만든다(눈·독립 판정용).
  python3 scarloxy_redo.py stage MANIFEST                MANIFEST(redo.json)의 채택분을 scarloxy-people-chips/<key>/ 로 덮는다(옛 격자는 chip.v1.chr.txt·meta.v1.json 으로 보존)
                                                         + scarloxy_lock 12프레임 고정 검사 + 설치 명단의 같은 항목에 redo 표시·설명 갱신. 칸 번호·id·name·role 은 그대로.

manifest 항목: {key(설치된 옛 key), run(RUN_DIR), rkey(Argon 후보 폴더), desc(새 설명, 선택), verdict(독립 판정 기록)}
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import scarloxy_lock as L  # noqa: E402
import scarloxy_sheet2 as S2  # noqa: E402
from PIL import Image  # noqa: E402

PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
INSTALL = ROOT / 'harness-data/charset-actor/scarloxy-people-install.json'


def chip_img(grid_path):
    pal, _, frames = C.load(grid_path)
    return C.sheet_rgba(pal, frames)


def old_chip(key):
    """옛 칩(1차 스크립트)의 그림: 보존 격자 chip.v1.chr.txt 가 있으면 그것, 없으면 현재 chip.chr.txt."""
    d = PICKS / key
    return chip_img(d / 'chip.v1.chr.txt' if (d / 'chip.v1.chr.txt').exists() else d / 'chip.chr.txt')


def side_by_side(old, new, scale=8):
    a, b = S2.four(old, scale), S2.four(new, scale)
    out = Image.new('RGBA', (a.width, a.height * 2 + 10), (40, 40, 40, 255))
    out.alpha_composite(a, (0, 0))
    out.alpha_composite(b, (0, a.height + 10))
    return out


def cmd_compare(a):
    run = Path(a.run).expanduser()
    out = Path(a.out).expanduser() if a.out else run / 'cmp'
    out.mkdir(parents=True, exist_ok=True)
    for d in sorted(run.iterdir()):
        if not (d / 'chip.chr.txt').exists():
            continue
        # sp3-<직군>-a → 옛 key
        old_key = json.loads((ROOT / 'harness-data/charset-actor/scarloxy-people/redo-map.json').read_text(encoding='utf-8'))[d.name.rsplit('-', 1)[0]]
        side_by_side(old_chip(old_key), chip_img(d / 'chip.chr.txt')).save(out / f'{d.name}.png')
        print(out / f'{d.name}.png', '(위 옛 칩 / 아래 새 칩)')


def cmd_stage(a):
    manifest = json.loads(Path(a.manifest).read_text(encoding='utf-8'))
    runs = Path(a.runs).expanduser()
    install = json.loads(INSTALL.read_text(encoding='utf-8'))
    rows = {c['key']: c for s in install['sheets'] for c in s['characters']}
    bad = []
    for e in manifest['chips']:
        key = e['key']
        d = PICKS / key
        src = runs / e['run'] / e['rkey']
        m = json.loads((src / 'meta.json').read_text(encoding='utf-8'))
        if not m.get('ok'):
            raise SystemExit(f'{key}: Argon 런 {src} 가 ok 가 아니다')
        if not (d / 'chip.v1.chr.txt').exists():
            shutil.copy(d / 'chip.chr.txt', d / 'chip.v1.chr.txt')
            shutil.copy(d / 'meta.json', d / 'meta.v1.json')
        shutil.copy(src / 'chip.chr.txt', d / 'chip.chr.txt')
        shutil.copy(src / 'edit.json', d / 'edit.json')
        meta = dict(key=key, arch=m['arch'], base=m['base'], variant=m['variant'], model=m['model'], effort=m['effort'], ok=True, harness=m.get('harness'),
                    attempts=len(m['attempts']), warnings=m.get('warnings', [])[:3], metrics=m.get('metrics', {}), distinct=m.get('distinct'), repairs=m.get('repairs'),
                    run=f'{e["run"]}/{e["rkey"]}', redo='2026-10-16', verdict=e.get('verdict'))
        (d / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
        r = L.check(key)
        print('lock', key, r['cells'], '칸', '통과' if r['ok'] else f'실패 {r["bad"]}')
        if not r['ok']:
            bad.append(key)
        row = rows[key]
        row['redo'] = '2026-10-16'
        if e.get('desc'):
            row['desc'] = e['desc']
    if bad:
        raise SystemExit(f'고정 검사 실패: {bad}')
    if manifest.get('selection_note') and manifest['selection_note'] not in install['selection']['note']:
        install['selection']['note'] += ' | ' + manifest['selection_note']
    INSTALL.write_text(json.dumps(install, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('명단 갱신', len(manifest['chips']), '종')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('compare')
    c.add_argument('run')
    c.add_argument('--out')
    c.set_defaults(fn=cmd_compare)
    s = sub.add_parser('stage')
    s.add_argument('manifest')
    s.add_argument('--runs', default='~/spc-runs/redo')
    s.set_defaults(fn=cmd_stage)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
