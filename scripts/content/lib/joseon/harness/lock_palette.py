"""조선 칩셋 팔레트 잠금.

규칙(pixel-object-authoring 0번): 색은 그 칩셋(버들항)이 실제로 쓰는 색만. 새 램프를 발명하지 않는다.
허용 색 = 버들항 시트 상위 256색(화소의 84%) ∪ 버들항 RAMPS_CHIP/OUT_CHIP 57색.
조선 램프는 이 허용 색 안에서만 고른다 — 하나라도 밖이면 이 스크립트가 실패한다.

    python3 harness/lock_palette.py      # palette.json 을 쓴다(커밋 대상)
"""
import json, os, re, sys
import numpy as np
from PIL import Image
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
SHEET = os.path.join(ROOT, 'public/assets/beodeul-city/beodeul-city-chipset.png')
PAL_PY = os.path.join(ROOT, 'scripts/content/lib/city_v6/palette.py')
TOP_N = 256

# 조선 소재 램프: [외곽(가장 어두움), 어두움 1 … 밝음 6]. 전부 버들항 색에서만.
JOSEON_RAMPS = {
    'giwa':      ['#1b1024', '#242c38', '#2e3441', '#4b556b', '#646d7b', '#797a84', '#a2a4a1'],   # 기와: 청회색 + 중성 회색
    'earth':     ['#2a1a0f', '#452a17', '#5e4c38', '#816a56', '#947c5c', '#c89a66', '#dcb680'],   # 황토
    'straw':     ['#312210', '#574234', '#877756', '#a88238', '#cca850', '#eccb86', '#f8e2a4'],   # 볏짚
    'dgreen':    ['#111719', '#153935', '#1c4a44', '#2a6a60', '#2e7979', '#338383', '#4b7c7a'],   # 단청 녹(뇌록)
    'dblue':     ['#071528', '#1c2631', '#2e2b66', '#30465c', '#4b556b', '#657290', '#cadaee'],   # 단청 청
    'persimmon': ['#3d220c', '#7a2e2c', '#b8280e', '#c27536', '#f06a14', '#dcaa4c', '#f6d498'],   # 감·주홍
    'pine':      ['#0c231a', '#133120', '#183f1a', '#285725', '#2f6e24', '#3b6a2d', '#4b8232'],   # 솔잎
}


def hexc(rgb):
    return '#%02x%02x%02x' % tuple(rgb)


def main():
    im = np.array(Image.open(SHEET).convert('RGBA'))
    px = im.reshape(-1, 4)
    px = px[px[:, 3] == 255][:, :3]
    cnt = Counter(map(tuple, px))
    top = [hexc(k) for k, _ in cnt.most_common(TOP_N)]
    src = open(PAL_PY).read()
    chip_block = src.split('RAMPS_CHIP')[1].split('MAP=')[0]
    chip = sorted(set(re.findall(r"'(#[0-9a-f]{6})'", chip_block)))
    # 버들항 램프(조선에서도 그대로 쓰는 것): 목재·돌·물·잎·회벽·붉은색
    ns = {}
    exec(src.split('def _mix')[0], ns)
    chip_ramps = {k: [ns['OUT_CHIP'][k]] + v for k, v in ns['RAMPS_CHIP'].items()
                  if k in ('wood', 'stone', 'water', 'leaf', 'plaster', 'red')}
    allowed = sorted(set(top) | set(chip))
    bad = {k: [c for c in v if c not in allowed] for k, v in JOSEON_RAMPS.items()}
    bad = {k: v for k, v in bad.items() if v}
    for k, v in chip_ramps.items():
        for c in v:
            if c not in allowed:
                bad.setdefault(k, []).append(c)
    if bad:
        print('허용 색 밖:', bad)
        sys.exit(1)
    ramps = {**chip_ramps, **JOSEON_RAMPS}
    out = {
        'source': 'public/assets/beodeul-city/beodeul-city-chipset.png',
        'rule': f'허용 = 시트 상위 {TOP_N}색 ∪ RAMPS_CHIP 57색. 램프는 허용 색 안에서만.',
        'allowed': allowed,
        'ramps': ramps,
        'shadow': '#1b1024',
    }
    json.dump(out, open(os.path.join(HERE, 'palette.json'), 'w'), indent=1)
    print(f'허용 {len(allowed)}색, 램프 {len(ramps)}개 잠금 완료')


if __name__ == '__main__':
    main()
