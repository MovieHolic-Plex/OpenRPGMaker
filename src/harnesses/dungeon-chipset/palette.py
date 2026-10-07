"""던전 칩셋(beodeul_dungeon) 잠금 팔레트 — 버들항 실제 그림에서 뽑는다.

뽑는 법 (재현 가능, 손으로 색을 짓지 않는다):
  1. 램프마다 버들항 변형 조각(tiledata/beodeul-variants/<장소>/parts/*.png, 공용 시트 꼬리 23,936~ 에 구워진 그림)을
     출처로 정한다. 필요하면 색상 조건(pred)으로 그 재료 화소만 거른다(예: 신전 벽의 이끼 초록).
  2. 출처의 불투명 화소를 밝기순으로 세우고 화소 수 기준 k 등분(기본 7)한다.
  3. 칸마다 **가장 많이 쓰인 실제 색 하나**를 고른다 — 평균을 내지 않으므로 모든 색이 버들항에 실제로 있는 화소 색이다.
  4. 중복을 빼고 어두운 순(단 0 = 가장 어두움 = 그 재료의 윤곽색)으로 놓는다.
  5. 모든 색이 공용 시트 public/assets/beodeul-city/beodeul-city-chipset.png 에 실제로 있는지 대조한다(없으면 실패).
  그림자는 버들항 조각에서 가장 흔한 반투명 그림자 (12,14,20,α88) 하나만 허용한다(윗층 기물의 바닥 그림자 전용).

  python3 src/harnesses/dungeon-chipset/palette.py          # palette.json 다시 쓰기
  python3 src/harnesses/dungeon-chipset/palette.py --check  # 다시 뽑아 지금 파일과 같은지만 본다
"""
import collections
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
VAR = os.path.join(REPO, 'tiledata', 'beodeul-variants')
SHEET = os.path.join(REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')
OUT = os.path.join(REPO, 'harness-data', 'dungeon-chipset', 'palette.json')


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def is_blue(c):
    return c[2] > c[0] + 10


def is_green(c):
    return c[1] > c[0] + 6 and c[1] >= c[2]


def is_teal(c):
    return c[1] > c[0] + 20 and c[2] > c[0] + 20


def not_void(c):
    return lum(c) > 40


def warm(c):
    return c[0] > c[2] + 4


# 램프: (출처 조각들, 거르기, k, 설명)
RAMPS = {
    'void':  (['sea-cave/ceiling_cave', 'castle-catacombs/ceiling'], lambda c: lum(c) < 30, 3,
              '천장 너머 어둠(버들항 동굴·지하묘지 천장 가운데)'),
    'rim':   (['sea-cave/ceiling_cave'], not_void, 7, '동굴 벽 윗면 테두리(버들항 바다 동굴 천장 띠)'),
    'cfloor': (['sea-cave/floor_cave'], None, 8, '동굴 흙바닥(버들항 바다 동굴 바닥 8색 그대로)'),
    'crock': (['sea-cave/face_cave_3h', 'sea-cave/face_cave_2h'], None, 7, '동굴 벽 앞면 녹회색 암반'),
    'stone': (['mining-valley/ground-rock', 'temple-ruins/stairs_down', 'castle-catacombs/coffin'],
              lambda c: abs(int(c[0]) - int(c[2])) < 14, 7, '다듬은 회색 돌(계단·석관·바위 바닥)'),
    'cata':  (['castle-catacombs/floor_cata'], None, 7, '지하묘지 판석 바닥'),
    'brick': (['castle-catacombs/face_cata_3h', 'castle-catacombs/face_cata_2h'], None, 7, '지하묘지 벽돌 앞면'),
    'water': (['sea-cave/water_sea'], is_blue, 6, '동굴 바닷물'),
    'pool':  (['aqueduct-sewer/water_sew'], lambda c: c[1] > c[0] and lum(c) < 140, 6, '하수 수로 물(검푸른 청록)'),
    'lava':  (['volcano-cave/lava-strip', 'volcano-cave/fire_crystal'], warm, 6, '용암(화산 동굴)'),
    'ice':   (['snowfield/ground-ice'], None, 5, '얼음판(설원)'),
    'vrock': (['volcano-cave/stalagmite', 'volcano-cave/spike_tall'], None, 6, '검푸른 화산암·석순'),
    'wood':  (['sea-cave/crate', 'temple-ruins/door_wood', 'castle-catacombs/barrel'], warm, 7, '나무(상자·문·통)'),
    'iron':  (['temple-ruins/door_wood', 'sea-cave/torch_wall', 'castle-catacombs/brazier'], lambda c: c[2] > c[0] + 8, 6,
              '쇠(문 띠·횃불 받침·화로)'),
    'fire':  (['sea-cave/torch_wall', 'castle-catacombs/brazier', 'castle-catacombs/candles'],
              lambda c: c[0] > c[2] + 60, 6, '불꽃'),
    'bone':  (['sea-cave/bones', 'castle-catacombs/skulls', 'castle-catacombs/bone_heap'],
              lambda c: c[0] >= c[2] and lum(c) > 60, 6, '뼈'),
    'moss':  (['temple-ruins/face_temple_3h', 'aqueduct-sewer/face_sewer_3h', 'temple-ruins/vines_2'], is_green, 6, '이끼·덩굴'),
    'glow':  (['sea-cave/glow_moss_floor', 'sea-cave/glow_mushroom'], is_teal, 6, '발광 이끼·수정 청록'),
}

# 공용 시트의 칩 램프(palette.RAMPS_CHIP) 가운데 던전에 쓸 것 — 시트에 실제로 있는지 대조한다.
CHIP_EXTRA = {
    'gold': (['#431d00', '#714210', '#845c1f', '#aa7a08', '#fbc10d', '#ecdb95'], '금장(버들항 칩 straw 램프)'),
    'red':  (['#562945', '#9e2514', '#a40100', '#dd2912', '#e0482a'], '붉은 천·장식(버들항 칩 red 램프)'),
}
SHADOW = {'rgb': [12, 14, 20], 'alpha': 88, 'why': '버들항 조각에서 가장 흔한 반투명 바닥 그림자(윗층 기물 전용)'}


def part(name):
    place, file = name.split('/')
    return os.path.join(VAR, place, 'parts', file + '.png')


def ramp_from(sources, pred, k):
    cnt = collections.Counter()
    for s in sources:
        a = np.array(Image.open(part(s)).convert('RGBA'))
        op = a[a[:, :, 3] == 255][:, :3]
        for c in map(tuple, op):
            c = tuple(int(v) for v in c)
            if pred is None or pred(c):
                cnt[c] += 1
    if not cnt:
        raise SystemExit(f'출처 {sources} 에서 고를 화소가 없다')
    total = sum(cnt.values())
    floor_n = max(2, int(total * 0.003))      # 잡티 몇 화소짜리 색은 램프 후보에서 뺀다
    cols = sorted([c for c in cnt if cnt[c] >= floor_n], key=lum) or sorted(cnt, key=lum)
    if len(cols) <= k:
        return cols, total
    lo, hi = lum(cols[0]), lum(cols[-1])
    out = []
    for i in range(k):                        # 밝기 구간을 k 등분 — 드문 윤곽색·빛색도 남는다
        a, b = lo + (hi - lo) * i / k, lo + (hi - lo) * (i + 1) / k
        inside = [c for c in cols if a <= lum(c) < b or (i == k - 1 and lum(c) == hi)]
        if inside:
            best = max(inside, key=lambda c: cnt[c])
            if best not in out:
                out.append(best)
    return sorted(out, key=lum), total


def hx(c):
    return '#%02x%02x%02x' % tuple(c)


def build():
    sheet = np.array(Image.open(SHEET).convert('RGBA'))
    sheet_cols = set(map(tuple, sheet[sheet[:, :, 3] == 255][:, :3].astype(int).tolist()))
    ramps, srcs, missing = {}, {}, []
    for name, (sources, pred, k, why) in RAMPS.items():
        cols, npx = ramp_from(sources, pred, k)
        ramps[name] = [hx(c) for c in cols]
        srcs[name] = {'from': [f'tiledata/beodeul-variants/{s.split("/")[0]}/parts/{s.split("/")[1]}.png' for s in sources],
                      'pixels': npx, 'why': why}
        missing += [(name, hx(c)) for c in cols if tuple(c) not in sheet_cols]
    for name, (cols, why) in CHIP_EXTRA.items():
        ramps[name] = cols
        srcs[name] = {'from': ['scripts/content/lib/city_v6/palette.py RAMPS_CHIP'], 'why': why}
        missing += [(name, c) for c in cols if tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) not in sheet_cols]
    if missing:
        raise SystemExit('공용 시트에 없는 색: ' + ', '.join(f'{n}:{c}' for n, c in missing))
    allowed = sorted({c for v in ramps.values() for c in v})
    return {
        'note': '자동 생성 — src/harnesses/dungeon-chipset/palette.py. 손으로 고치지 말 것. 단 0 = 가장 어두움(그 재료의 윤곽).',
        'sheet': os.path.relpath(SHEET, REPO),
        'method': '램프 출처 조각의 불투명 화소를 밝기순 화소 수 k등분 → 칸마다 최빈 실제색 → 공용 시트 존재 대조',
        'ramps': ramps, 'sources': srcs, 'shadow': SHADOW, 'allowed': allowed, 'count': len(allowed),
    }


def main():
    pal = build()
    text = json.dumps(pal, ensure_ascii=False, indent=1) + '\n'
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != text:
            print('palette.json 이 출처에서 다시 뽑은 것과 다르다 — palette 단계로 다시 쓴다')
            return 1
        print(f'palette.json 최신 ({pal["count"]}색, 램프 {len(pal["ramps"])})')
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(text)
    print(f'→ {os.path.relpath(OUT, REPO)}  {pal["count"]}색 · 램프 {len(pal["ramps"])}')
    for k, v in pal['ramps'].items():
        print(f'  {k:7} {" ".join(v)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
