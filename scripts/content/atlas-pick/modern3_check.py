#!/usr/bin/env python3
"""현대 계열(일본·강남·학원) 공통 3판 팔레트 검사: PNG 의 불투명 화소 색이 palette/modern3.pal 밖이면 불합격(공용 검사기는 건드리지 않는다).
  python3 scripts/content/atlas-pick/modern3_check.py a.png b.png …    # 종료코드 0 = 밖의 색 0, 1 = 있음
  --used  램프별 사용 단 수까지 출력
정본 규칙: modern-style-bible.md §금지 「modern3 밖의 색 = 0」. 마커 #e040c0 이 남아도 불합격."""
import os, re, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
PAL = os.path.join(HERE, '..', '..', '..', 'tiledata/atlas-pick/palette/modern3.pal')

def load_pal(path=PAL):
    ramps = {}; order = []
    for ln in open(path, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
        if m:
            ramps[m.group(1)] = [int(h, 16) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
    return ramps

def check(png, ramps=None, quiet=False):
    ramps = ramps or load_pal()
    owner = {}
    for n, r in ramps.items():
        for i, c in enumerate(r): owner.setdefault(c, (n, i))
    a = np.array(Image.open(png).convert('RGBA'))
    px = a[..., :3].astype(np.uint32); key = (px[..., 0] << 16) | (px[..., 1] << 8) | px[..., 2]
    op = a[..., 3] > 0
    cols, cnt = np.unique(key[op], return_counts=True)
    out = {int(c): int(k) for c, k in zip(cols, cnt) if int(c) not in owner}
    if a[..., 3][op].min(initial=255) < 255: out[-1] = int((a[..., 3][op] < 255).sum())   # 반투명 화소
    marker = 0xe040c0 in cols.tolist()
    if not quiet:
        print('%s: 색 %d · modern3 밖 %d%s%s' % (os.path.basename(png), len(cols), len([k for k in out if k >= 0]),
              ' · 반투명 %d화소' % out[-1] if -1 in out else '', ' · 마커 색 남음' if marker else ''))
        for c, k in sorted(out.items(), key=lambda t: -t[1])[:12]:
            if c >= 0: print('   #%06x  %d화소' % (c, k))
    return out, marker, [(owner[int(c)], int(k)) for c, k in zip(cols, cnt) if int(c) in owner]

if __name__ == '__main__':
    files = [f for f in sys.argv[1:] if not f.startswith('--')]
    bad = 0; ramps = load_pal()
    for f in files:
        out, marker, used = check(f, ramps)
        bad += len(out) + (1 if marker else 0)
        if '--used' in sys.argv:
            per = {}
            for (n, i), k in used: per.setdefault(n, set()).add(i)
            print('   램프 %d개 · ' % len(per) + ' '.join('%s:%d단' % (n, len(s)) for n, s in sorted(per.items())))
    sys.exit(1 if bad else 0)
