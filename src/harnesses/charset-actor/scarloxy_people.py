#!/usr/bin/env python3
"""Scarloxy People 칩 변형 도구(2026-10-16) — 뼈대 = Scarloxy MPWSP01 People1~2 의 10명(CC BY 4.0, public/assets/scarloxy/).

  python3 scarloxy_people.py bases        하네스 뼈대 사본(harness-data/charset-actor/scarloxy-base/Scarloxy{1,2}.png)을 만든다.
                                          Scarloxy 시트는 투명 배경 RGBA 라 하네스 규약(배경 키 색)으로 한 번 바꾼다. 반투명 화소(그림자 85칸, 물 보스 83·불 보스 2)는 투명으로 둔다.
  python3 scarloxy_people.py bases --check  사본이 원본 시트와 일치하는지만 확인.

뼈대 키는 `Scarloxy1:0` ~ `Scarloxy1:7`, `Scarloxy2:0` ~ `Scarloxy2:1` (harness.norm_base). 영역 분할(SPECS)은 scarloxy_specs.py 가 partedit.SPECS 에 합친다.
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

SRC = H.ROOT / 'public' / 'assets' / 'scarloxy'
SOURCES = {'Scarloxy1': SRC / 'scarloxy-charset-people1.png', 'Scarloxy2': SRC / 'scarloxy-charset-people2.png'}
COUNTS = {'Scarloxy1': 8, 'Scarloxy2': 2}


def normalised(sheet):
    rgba = Image.open(SOURCES[sheet]).convert('RGBA')
    out = Image.new('RGB', rgba.size, C.KEY)
    src, dst = rgba.load(), out.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = src[x, y]
            if a >= 128:
                if (r, g, b) == C.KEY:
                    raise SystemExit(f'{sheet} ({x},{y}): 배경 키 색과 같은 화소')
                dst[x, y] = (r, g, b)
    return out


def cmd_bases(a):
    H.SCARLOXY_BASE_DIR.mkdir(parents=True, exist_ok=True)
    same = True
    for sheet in H.SCARLOXY_BASE_SHEETS:
        img = normalised(sheet)
        path = H.SCARLOXY_BASE_DIR / f'{sheet}.png'
        if a.check:
            ok = path.exists() and Image.open(path).convert('RGB').tobytes() == img.tobytes()
            print(sheet, 'same' if ok else 'DIFF')
            same &= ok
        else:
            img.save(path)
            print(path.relative_to(H.ROOT))
    if a.check and not same:
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('bases')
    b.add_argument('--check', action='store_true')
    a = ap.parse_args()
    {'bases': cmd_bases}[a.cmd](a)


if __name__ == '__main__':
    main()
