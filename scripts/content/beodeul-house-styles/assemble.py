#!/usr/bin/env python3
"""버들항 집 양식 조립: 부품 → 집 그림.   python3 scripts/content/beodeul-house-styles/assemble.py <양식>… [--check]

쓰는 것(양식마다): tiledata/beodeul-house-styles/<양식>/houses/<집>.png (본체, 3층) · <집>-shadow.png (바닥 그림자, 2층) · <집>-foundation.png (기초·굴뚝 연기, 4층) ·
report.json (집마다 칸 크기 · 문 칸 · 막힌 칸 · 지붕 옆선 수직 편차 px · 민무늬 몫 · 색 수). --check 는 다시 조립해 저장된 그림과 같은지만 본다.
지붕 옆선 수직 편차가 1px 을 넘으면 멈춘다(직교 시점 — 사다리꼴·모임지붕 금지). 조립 규칙은 hs.py, 집마다의 순서는 recipes/<양식>.py."""
import json, sys
import numpy as np
from PIL import Image
import hs
def main():
    check = '--check' in sys.argv; bad = 0
    for style in [a for a in sys.argv[1:] if not a.startswith('--')]:
        code = hs.HERE / 'code_parts.py'
        B = hs.build(style); out = hs.STORE / style / 'houses'; out.mkdir(parents=True, exist_ok=True); rep = {}
        for n, b in B.items():
            assert b['side'] <= 1, f'{style}/{n}: 지붕 옆선 수직 편차 {b["side"]}px > 1'
            for suffix, im in (('', b['im']), ('-shadow', b['shadow']), ('-foundation', b['foundation'])):
                f = out / f'{n}{suffix}.png'
                if check:
                    same = f.exists() and np.array_equal(np.array(Image.open(f).convert('RGBA')), np.array(im))
                    if not same: print(f'다르다: {f.relative_to(hs.ROOT)}'); bad += 1
                else: im.save(f)
            rep[n] = dict(size=[b['spec']['w'], b['spec']['h']], door=b['door'], blocked=b['blocked'], groundLines=b['lines'], roofSideDeviationPx=b['side'], roofVolumes=b['roofs'], roof=b['roof'],
                          flatPercent=round(b['flat'], 1), colours=b['cols'])
            print(f'{style}/{n}: {b["spec"]["w"]}×{b["spec"]["h"]}칸 문 {tuple(b["door"])} 막힌 칸 {len(b["blocked"])} 지붕 {"+".join(b["roofs"])} 옆선 편차 {b["side"]}px 민무늬 {b["flat"]:.0f}% 색 {b["cols"]}')
        if not check: (hs.STORE / style / 'report.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    sys.exit(1 if bad else 0)
if __name__ == '__main__': main()
