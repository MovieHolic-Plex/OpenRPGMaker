"""building-kit 잠금 팔레트 — 테마마다 palette.json 을 뽑는다.

뽑는 법 (재현 가능, 손으로 색을 짓지 않는다):
  1. 공유 램프(모든 테마): 잔디·포석·기단 돌·나무·쇠. 출처는 버들항 공용 시트
     public/assets/beodeul-city/beodeul-city-chipset.png 의 실제 칸(타일 그룹 몸통, 키트의 벽/기단 줄)과
     src/assets/beodeulCityTileset.json 의 structureKits(tiles/upperTiles 칸 번호)다. 필요하면 색상 조건(pred)으로
     그 재료 화소만 거른다(예: 기단 줄에서 회색 돌만 — 문기둥 나무색은 뺀다).
  2. 테마 램프: seed palette.ramps.<이름> 의 출처를 쓴다.
     - from: beodeul → 출처 칸/키트 줄. 버들항 귀족 구역은 이것만 쓴다.
     - hex: [...] 손으로 지은 램프(사막 흙벽·돔, 북방 통나무·눈 지붕처럼 버들항에 없는 재료).
       단마다 밝기가 공유 7단 램프의 같은 단 범위 ±0.04 안이어야 한다(무림·조선 호환 규칙과 같은 검사). 벗어나면 실패.
  3. 출처의 불투명 화소를 밝기순으로 세우고 화소 수 기준 k 등분 → 칸마다 **가장 많이 쓰인 실제 색 하나**(평균을 내지 않는다).
  4. 버들항 출처 램프(공유·from beodeul)의 모든 색이 공용 시트에 실제로 있는지 대조한다.
     손 램프(hex)는 버들항에 없는 재료라 시트 대조 대신 7단 밝기 범위 검사를 받는다(7단이 아니면 실패).
  그림자는 버들항 시트에 실제로 있는 반투명 (12,14,20,α88) 하나만 허용한다(던전·무림과 같은 규칙).

  python3 src/harnesses/building-kit/palette.py --theme fantasy-kingdom          # palette.json 다시 쓰기
  python3 src/harnesses/building-kit/palette.py --theme fantasy-kingdom --check  # 다시 뽑아 지금 파일과 같은지만 본다
"""
import collections
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.environ.get('BUILDING_KIT_DATA') or os.path.join(REPO, 'harness-data', 'building-kit')
SHEET = os.path.join(REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')
TILESET = os.path.join(REPO, 'src', 'assets', 'beodeulCityTileset.json')
SHADOW = {'rgb': [12, 14, 20], 'alpha': 88, 'why': '버들항 시트에 실제로 있는 반투명 바닥 그림자(윗칸 기물·처마 전용)'}


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def grey(c):
    return max(c) - min(c) <= 28 and abs(c[0] - c[2]) <= 18


def warm(c):
    return c[0] > c[2] + 12


def cream(c):
    return lum(c) > 150 and max(c) - min(c) <= 60


def cool(c):
    return c[2] > c[0] + 8


def dark(c):
    return lum(c) < 110


def darkwarm(c):
    return warm(c) and lum(c) < 120


def green(c):
    return c[1] > c[0] + 6 and c[1] >= c[2]


def ironish(c):
    return max(c) - min(c) <= 40 and c[2] >= c[0]


def teal(c):
    return c[1] > c[0] + 20 and c[2] > c[0] + 20


def red(c):
    return c[0] > c[1] + 60 and c[0] > c[2] + 60


def light(c):
    return lum(c) > 150


def snowy(c):
    return lum(c) > 140 and c[2] >= c[0] - 4


def warmcream(c):
    return cream(c) and c[0] >= c[2]


PRED = {'grey': grey, 'warm': warm, 'cream': cream, 'cool': cool, 'dark': dark, 'darkwarm': darkwarm, 'green': green,
        'ironish': ironish, 'teal': teal, 'red': red, 'light': light, 'snowy': snowy, 'warmcream': warmcream}


# 공유 램프 — 테마 넷이 같은 출처를 쓴다. cells: {'tile': 칸 번호} 또는 {'kit': 키트 id, 'rows': [줄]} 또는 {'group': 타일 그룹 id}
SHARED = {
    'grass': {'cells': [{'kit': 'bd-ground-lawn-1'}, {'kit': 'bd-ground-lawn-4'}], 'k': 7,
              'why': '버들항 잔디(외곽 마당 잔디 키트 6×6 몸통)'},
    'cobble': {'cells': [{'group': 'beodeul:paving'}, {'group': 'beodeul:plaza'}], 'k': 7, 'pred': 'grey',
               'why': '버들항 길 포석·광장 판석(연석·판석 회색)'},
    'stone': {'cells': [{'kit': 'bd-house-h101_0', 'rows': [5]}, {'kit': 'bd-house-h109_0', 'rows': [5]}],
              'k': 7, 'pred': 'grey', 'why': '버들항 살림집 기단(맨 아래 줄 회색 주춧돌 — 문기둥 나무색은 뺀다)'},
    'wood': {'cells': [{'kit': 'bd-out-log-wall'}, {'kit': 'bd-out-plank-wall'}, {'kit': 'bd-out-plank-door'}],
             'k': 7, 'why': '버들항 외곽 통나무·널벽·널문 나무'},
    'iron': {'cells': [{'kit': 'bd-prop-lamp_double'}, {'kit': 'bd-prop-lamp_crook'}, {'kit': 'bd-out-hanging-sign'}],
             'k': 6, 'pred': 'ironish', 'why': '버들항 가로등 기둥·간판 걸이 쇠(푸른 회색 — 유리·등불 색은 뺀다)'},
}


def _sheet():
    return np.array(Image.open(SHEET).convert('RGBA'))


def _tileset():
    return json.load(open(TILESET, encoding='utf-8'))


def cell_pixels(sheet, per, idx):
    a = sheet[(idx // per) * 16:(idx // per) * 16 + 16, (idx % per) * 16:(idx % per) * 16 + 16]
    return a[a[:, :, 3] == 255][:, :3]


def source_pixels(sheet, ts, src):
    per = ts['tilesPerRow']
    if 'tile' in src:
        return cell_pixels(sheet, per, src['tile'])
    if 'group' in src:
        g = next((x for x in ts['tileGroups'] if x['id'] == src['group']), None)
        if g is None:
            raise SystemExit(f'타일 그룹 {src["group"]} 이 없다')
        parts = [cell_pixels(sheet, per, i) for i in g['tileIds'][:6]]
        return np.concatenate([p for p in parts if len(p)])
    k = next((x for x in ts['structureKits'] if x['id'] == src['kit']), None)
    if k is None:
        raise SystemExit(f'키트 {src["kit"]} 가 없다')
    rows = src.get('rows')
    out = []
    for j, row in enumerate(k['rows']):
        if rows is not None and j not in rows:
            continue
        for key in ('tiles', 'upperTiles'):
            for idx in row.get(key) or []:
                if idx is None or idx < 0:
                    continue
                p = cell_pixels(sheet, per, idx)
                if len(p):
                    out.append(p)
    return np.concatenate(out) if out else np.zeros((0, 3), np.uint8)


def ramp_from(px, k, pred=None):
    cnt = collections.Counter()
    for c in map(tuple, px.astype(int).tolist()):
        if pred is None or PRED[pred](c):
            cnt[c] += 1
    if not cnt:
        return [], 0
    total = sum(cnt.values())
    floor_n = max(2, int(total * 0.003))
    cols = sorted([c for c in cnt if cnt[c] >= floor_n], key=lum) or sorted(cnt, key=lum)
    if len(cols) <= k:
        return cols, total
    lo, hi = lum(cols[0]), lum(cols[-1])
    out = []
    for i in range(k):
        a, b = lo + (hi - lo) * i / k, lo + (hi - lo) * (i + 1) / k
        inside = [c for c in cols if a <= lum(c) < b or (i == k - 1 and lum(c) == hi)]
        if inside:
            best = max(inside, key=lambda c: cnt[c])
            if best not in out:
                out.append(best)
    return sorted(out, key=lum), total


def hx(c):
    return '#%02x%02x%02x' % tuple(c)


def envelope(ramps):
    """공유 7단 램프의 단별 밝기 범위 ±0.04 — 손 램프(hex)가 지켜야 하는 호환 범위."""
    seven = [v for v in ramps.values() if len(v) == 7]
    out = []
    for t in range(7):
        ls = [lum(c) / 255.0 for c in (r[t] for r in seven)]
        out.append((min(ls) - 0.04, max(ls) + 0.04))
    return out


def build(theme):
    seed = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    sheet, ts = _sheet(), _tileset()
    sheet_cols = set(map(tuple, sheet[sheet[:, :, 3] == 255][:, :3].astype(int).tolist()))
    ramps, srcs, fail = {}, {}, []

    for name, spec in SHARED.items():
        px = np.concatenate([source_pixels(sheet, ts, c) for c in spec['cells']]) if spec['cells'] else np.zeros((0, 3), np.uint8)
        cols, npx = ramp_from(px, spec['k'], spec.get('pred'))
        if not cols:
            fail.append(f'공유 램프 {name}: 출처에서 고를 화소가 없다')
            continue
        ramps[name] = [hx(c) for c in cols]
        srcs[name] = {'kind': 'shared', 'from': spec['cells'], 'pixels': npx, 'pred': spec.get('pred'), 'why': spec['why']}

    for name, spec in (seed.get('palette', {}).get('ramps') or {}).items():
        if 'hex' in spec:
            cols = [hx(tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))) for c in spec['hex']]
            ramps[name] = cols
            srcs[name] = {'kind': 'hex', 'from': spec['hex'], 'why': spec.get('why', '')}
            continue
        if spec.get('from') != 'beodeul':
            fail.append(f'테마 램프 {name}: from 은 beodeul 이거나 hex 여야 한다')
            continue
        px = np.concatenate([source_pixels(sheet, ts, c) for c in spec['cells']])
        cols, npx = ramp_from(px, spec.get('k', 7), spec.get('pred'))
        if not cols:
            fail.append(f'테마 램프 {name}: 출처에서 고를 화소가 없다')
            continue
        ramps[name] = [hx(c) for c in cols]
        srcs[name] = {'kind': 'beodeul', 'from': spec['cells'], 'pixels': npx, 'pred': spec.get('pred'), 'why': spec.get('why', '')}

    for name, cols in ramps.items():
        if srcs[name]['kind'] == 'hex':
            continue
        for c in cols:
            if tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) not in sheet_cols:
                fail.append(f'{name}: 공용 시트에 없는 색 {c}')

    shared7 = {k: v for k, v in ramps.items() if srcs[k]['kind'] == 'shared' and len(v) == 7}
    if not shared7:
        fail.append('공유 7단 램프가 없어 손 램프 밝기 범위를 잴 수 없다')
    env = envelope({k: [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in v] for k, v in shared7.items()}) if shared7 else []
    for name, cols in ramps.items():
        if srcs[name]['kind'] != 'hex':
            continue
        if len(cols) != 7:
            fail.append(f'{name}: 손 램프는 7단이어야 한다({len(cols)}단) — 버들항 7단 램프와 단마다 밝기를 맞춘다')
            continue
        for t, c in enumerate(cols):
            l = lum(tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))) / 255.0
            if not env[t][0] <= l <= env[t][1]:
                fail.append(f'{name}: {t}단 {c} 밝기 {l:.2f} 가 버들항 같은 단 범위 {env[t][0]:.2f}~{env[t][1]:.2f} 밖')
    if fail:
        raise SystemExit('팔레트를 뽑을 수 없다:\n  ' + '\n  '.join(fail))

    allowed = sorted({c for v in ramps.values() for c in v})
    return {
        'note': '자동 생성 — src/harnesses/building-kit/palette.py. 손으로 고치지 말 것. 단 0 = 가장 어두움(그 재료의 윤곽).',
        'theme': theme,
        'sheet': os.path.relpath(SHEET, REPO),
        'tileset': os.path.relpath(TILESET, REPO),
        'method': '출처 칸·키트 줄의 불투명 화소를 밝기순 화소 수 k등분 → 칸마다 최빈 실제색 → 공용 시트 존재 대조(손 램프는 같은 단 밝기 ±0.04)',
        'ramps': ramps, 'sources': srcs, 'envelope': [[round(a, 3), round(b, 3)] for a, b in env],
        'shadow': SHADOW, 'allowed': allowed, 'count': len(allowed),
    }


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    theme = None
    if '--theme' in argv:
        theme = argv[argv.index('--theme') + 1]
    if not theme:
        raise SystemExit('--theme <테마> 가 필요하다: ' + ', '.join(sorted(os.listdir(DATA))) if os.path.isdir(DATA) else '--theme <테마>')
    out = os.path.join(DATA, theme, 'palette.json')
    pal = build(theme)
    text = json.dumps(pal, ensure_ascii=False, indent=1) + '\n'
    if '--check' in argv:
        cur = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
        if cur != text:
            print(f'{theme}: palette.json 이 출처에서 다시 뽑은 것과 다르다 — palette 단계로 다시 쓴다')
            return 1
        print(f'{theme}: palette.json 최신 ({pal["count"]}색, 램프 {len(pal["ramps"])})')
        return 0
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(text)
    print(f'→ {os.path.relpath(out, REPO)}  {pal["count"]}색 · 램프 {len(pal["ramps"])}')
    for k, v in pal['ramps'].items():
        print(f'  {k:8} {" ".join(v)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
