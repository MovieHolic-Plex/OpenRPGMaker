#!/usr/bin/env python3
"""Argon 이 낸 edit.json 은 맞는데 몸체 안쪽 1~2px 구멍만 남아 거절된 후보를 모델 없이 살린다.
구멍(새로 생긴 닫힌 투명 칸)을 4이웃 최빈 색으로 메운 뒤 하네스 verify 를 다시 건다. 통과해야만 chip.* 를 쓴다(meta 에 repaired 기록).
  python3 scarloxy_repair.py RUN_DIR/KEY [...]     (CTFF6_PART_OUT 아래 run/key 폴더)
"""
import json
import shutil
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import argon_part as A  # noqa: E402,F401
import chr as C  # noqa: E402
import partedit as P  # noqa: E402

T = C.TRANSPARENT


def repair(cdir):
    cdir = Path(cdir)
    meta = json.loads((cdir / 'meta.json').read_text())
    attempts = sorted((cdir / 'attempts').iterdir(), key=lambda p: int(p.name))
    adir = attempts[-1]
    bkey = json.loads((adir / 'base.json').read_text())['base']
    edit = json.loads((adir / 'edit.json').read_text())
    pal, new, bframes, bpal, labels, zones, changed, kind, rep = P.apply_edits(bkey, edit)
    if rep['errors']:
        return False, rep['errors'][:3]
    filled = 0
    for k, rows in new.items():
        op = C._opaque(rows)
        holes = C._enclosed(op) - C._enclosed(C._opaque(bframes[k]))
        if not holes:
            continue
        g = [list(r) for r in rows]
        for (x, y) in sorted(holes):
            cnt = Counter(g[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                          if 0 <= x + dx < len(g[0]) and 0 <= y + dy < len(g) and g[y + dy][x + dx] != T)
            if cnt:
                g[y][x] = cnt.most_common(1)[0][0]
                filled += 1
        new[k] = [''.join(r) for r in g]
    errs, warns, m = P.verify(bkey, pal, new, bframes, bpal, labels, zones, changed, kind, gear_report=rep.get('gear'))
    errs = list(errs)
    if errs:
        return False, errs[:4]
    pal2 = {'.': None, **{c: v for c, v in pal.items() if any(c in r for rows in new.values() for r in rows)}}
    (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, new, header=f'{meta["key"]} — {meta["variant"]}\nbase {bkey} · {meta["model"]} + hole-fill {filled}px'))
    C.sheet_rgba(pal2, new).save(cdir / 'chip.png')
    shutil.copy(adir / 'edit.json', cdir / 'edit.json')
    meta.update(ok=True, warnings=warns, metrics=m, repaired=f'script hole-fill {filled}px (Argon edit.json 그대로)')
    (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return True, filled


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(p, repair(p))
