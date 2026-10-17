#!/usr/bin/env python3
"""Scarloxy 변형 칩의 얼굴·피부·손 화소 고정 검사(설치 관문, 2026-10-16 2차). 최종 격자(chip.chr.txt)만 보고 12프레임 전부를 원본과 화소 대조한다 —
생성 도구(Argon 하네스·스크립트)의 자기 보고를 믿지 않고 설치 직전에 다시 잰다.

  Argon 칩   : 뼈대(meta.base)의 분할(partedit.segment)에서 F 칸(눈·얼굴 상자·맨살·손) 전부가 색까지 같아야 한다.
  스크립트 칩 : 머리 주인의 얼굴 고정 칸(이식된 자리)과 몸 주인의 맨살·손 칸(피부 계열 변환값)이 같아야 한다(scarloxy_compose.face_fixed).
  공통       : 얼굴·피부·손 칸을 못 건드렸는지(=12프레임 화소 동일)만 본다. 몸 비율·실루엣 한도는 생성 때 partedit.verify / chr.gate 가 이미 건다.

  python3 scarloxy_lock.py KEY [KEY ...]     scarloxy-people-chips/<key>/ 를 검사 (0 이면 통과)
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
import partedit as P  # noqa: E402
import scarloxy_compose as S  # noqa: E402

T = C.TRANSPARENT
PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'


def hexof(pal, c):
    return None if c == T or pal.get(c) is None else '#%02x%02x%02x' % tuple(pal[c])


def lock_cells(meta):
    """→ {(dir, f): {(x, y): hex}} 고정 칸과 원래 색."""
    if str(meta.get('model', '')).startswith('script-compose'):
        _, _, fixed = S.compose(meta['head'], meta['body'])
        return fixed
    bkey = meta['base']
    bpal, bframes, labels, _, _ = P.segment(bkey)
    out = {}
    for fk, rows in bframes.items():
        out[fk] = {(x, y): '#%02x%02x%02x' % tuple(bpal[rows[y][x]])
                   for y in range(C.FH) for x in range(C.FW) if labels[fk][y][x] == 'F' and rows[y][x] != T}
    return out


def check(key):
    meta = json.loads((PICKS / key / 'meta.json').read_text(encoding='utf-8'))
    pal, _, frames = C.load(PICKS / key / 'chip.chr.txt')
    cells = lock_cells(meta)
    bad, total = [], 0
    for fk, fx in cells.items():
        for (x, y), want in fx.items():
            total += 1
            got = hexof(pal, frames[fk][y][x])
            if got != want:
                bad.append((fk, x, y, want, got))
    return dict(key=key, cells=total, frames=len(cells), bad=len(bad), ok=not bad, sample=bad[:3])


if __name__ == '__main__':
    code = 0
    for k in sys.argv[1:]:
        r = check(k)
        print(json.dumps(r, ensure_ascii=False))
        code |= 0 if r['ok'] else 1
    sys.exit(code)
