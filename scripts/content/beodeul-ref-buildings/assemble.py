#!/usr/bin/env python3
"""버들항 참고 건물 조립: 부품 → 건물 그림.   python3 scripts/content/beodeul-ref-buildings/assemble.py [이름…] [--check]

쓰는 것: tiledata/beodeul-ref-buildings/buildings/<이름>.png (본체 한 장, 3층) · report.json (건물마다 칸 크기 · 문 칸 · 지나가는 칸 · 막힌 칸 · 지붕 옆선 수직 편차 px · 민무늬 몫 · 색 수).
--check 는 다시 조립해 저장된 그림과 같은지만 본다. 지붕 옆선 수직 편차가 1px 을 넘으면 멈춘다(직교 시점 — 사다리꼴·모임지붕 금지, 탑 뾰족지붕은 세모라 재지 않는다).
조립 규칙은 rb.py, 건물마다의 순서는 recipes.py, 목록은 types.json(types_src.py)."""
import json, sys
import numpy as np
from PIL import Image
import rb
def main():
    check = '--check' in sys.argv; bad = 0; names = [a for a in sys.argv[1:] if not a.startswith('--')] or None
    B = rb.build(names); out = rb.STORE / 'buildings'; out.mkdir(parents=True, exist_ok=True)
    rp = rb.STORE / 'report.json'; rep = json.loads(rp.read_text(encoding='utf-8')) if rp.exists() and names else {}
    for n, b in B.items():
        assert b['side'] <= 1, f'{n}: 지붕 옆선 수직 편차 {b["side"]}px > 1'
        f = out / f'{n}.png'
        if check:
            if not (f.exists() and np.array_equal(np.array(Image.open(f).convert('RGBA')), np.array(b['im']))): print(f'다르다: {f.relative_to(rb.ROOT)}'); bad += 1
        else: b['im'].save(f)
        rep[n] = dict(size=[b['spec']['w'], b['spec']['h']], door=b['door'], passage=b['passage'], blocked=b['blocked'], roofSideDeviationPx=b['side'], roofVolumes=b['roofs'], roof=b['roof'],
                      flatPercent=round(b['flat'], 1), colours=b['cols'])
        print(f'{n}: {b["spec"]["w"]}×{b["spec"]["h"]}칸 문 {b["door"]} 막힌 칸 {len(b["blocked"])} 지붕 {"+".join(b["roofs"])} 옆선 편차 {b["side"]}px 민무늬 {b["flat"]:.0f}% 색 {b["cols"]}')
    if not check: rp.write_text(json.dumps(rep, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    sys.exit(1 if bad else 0)
if __name__ == '__main__': main()
