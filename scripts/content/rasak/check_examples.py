# Rasak 예제 맵 품질 검사 — 조수는 예제를 그대로 따라 하므로 예제가 먼저 기준을 넘어야 한다.
#
#   python3 scripts/content/rasak/check_examples.py --assets ~/third-party-assets/rasak [--map <layers.map.json> ...]
#
# 기준은 제작자 프리뷰 재구성 맵(p01 정원·p28 늪·p27a 동굴)에서 잰 값이다(2026-09-25 적대적 시각 QA):
#   빈 바닥 %      = 바닥 칸 중 3×3 이웃에 2·3층이 하나도 없는 칸. 제작자 0~27(p02 절벽 들판 27), 옛 예제 46~60.
#   가장 큰 빈 정사각형 = 2·3층이 없는 바닥으로만 된 정사각형 한 변. 제작자 2~5, 옛 예제 5~8.
#   좌우 대칭 배수 = 3층 칸 중 좌우 거울 칸도 3층인 비율 ÷ 3층 밀도. 우연이면 1. 제작자 1.0~2.0, 옛 도시 4.8.
#   허공 %        = 실내 맵에서 1층이 천장(A4 윗면)이거나 비어 있는 칸. 조수 방 하나 맵은 60%.
# 그림자 칸 중 왼쪽에 벽·지붕·3층이 없는 칸은 알림만 한다(제작자도 손으로 그림자를 그린다 — p02 16칸).
import argparse, json, os, sys
from pathlib import Path

LIMITS = {
    'exterior': {'empty': 30, 'square': 5, 'mirror': 2.2},
    'interior': {'empty': 30, 'square': 4, 'mirror': 2.2, 'void': 45},
}


def load(path):
    return json.loads(Path(path).read_text())


def slot_of(man, t):
    if t is None or t < 0 or t >= len(man['entries']):
        return None
    e = man['entries'][t]
    return e.get('slot') if e else None


def measure(m, man, interior):
    w, h = m['width'], m['height']
    n = w * h
    L1 = m['lowerTiles']
    L2 = m.get('lowerOverlayTiles') or [-1] * n
    L3 = m.get('upperTiles') or [-1] * n
    SH = m.get('shadowBits') or [0] * n

    def is_wall(i):
        s = slot_of(man, L1[i])
        e = man['entries'][L1[i]] if L1[i] is not None and 0 <= L1[i] < len(man['entries']) else None
        return s == 'A3' or (s == 'A4')

    def is_ceiling(i):
        if L1[i] is None or L1[i] < 0:
            return True
        e = man['entries'][L1[i]]
        return bool(e) and e.get('slot') == 'A4' and not e.get('wall')

    floor = [L1[i] is not None and L1[i] >= 0 and not is_wall(i) and L3[i] < 0 for i in range(n)]
    occ = [L2[i] >= 0 or L3[i] >= 0 for i in range(n)]

    def near(i):
        x, y = i % w, i // w
        return any(occ[(y + dy) * w + x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if 0 <= x + dx < w and 0 <= y + dy < h)

    fl = [i for i in range(n) if floor[i]]
    empty = round(100 * sum(1 for i in fl if not near(i)) / max(1, len(fl)))
    best = 0
    dp = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if floor[i] and not occ[i]:
                dp[y + 1][x + 1] = min(dp[y][x + 1], dp[y + 1][x], dp[y][x]) + 1
                best = max(best, dp[y + 1][x + 1])
    obj = {(i % w, i // w) for i in range(n) if L3[i] >= 0}
    mirror = 0.0
    if obj:
        xs = [x for x, _ in obj]
        cx = min(xs) + max(xs)
        twins = sum(1 for x, y in obj if cx - x != x and (cx - x, y) in obj)
        mirror = round((twins / len(obj)) / (len(obj) / n), 1)
    orphan = []
    for i in range(n):
        if SH[i]:
            x, y = i % w, i // w
            left = i - 1 if x > 0 else None
            if left is None or not (is_wall(left) or L3[left] >= 0 or is_ceiling(left)):
                orphan.append((x, y))
    out = {'empty': empty, 'square': best, 'mirror': mirror, 'orphanShadow': len(orphan)}
    if interior:
        out['void'] = round(100 * sum(1 for i in range(n) if is_ceiling(i)) / n)
    return out, orphan[:6]


def verdict(stats, interior):
    lim = LIMITS['interior' if interior else 'exterior']
    bad = []
    if stats['empty'] > lim['empty']:
        bad.append(f"빈 바닥 {stats['empty']}% > {lim['empty']}%")
    if stats['square'] > lim['square']:
        bad.append(f"빈 정사각형 {stats['square']}칸 > {lim['square']}칸")
    if stats['mirror'] > lim['mirror']:
        bad.append(f"좌우 대칭 {stats['mirror']}배 > {lim['mirror']}배")
    if interior and stats['void'] > lim['void']:
        bad.append(f"허공 {stats['void']}% > {lim['void']}%")
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--assets', default='~/third-party-assets/rasak')
    ap.add_argument('--map', action='append', help='검사할 layers.map.json(없으면 maps/rasak_preview_ex_*)')
    a = ap.parse_args()
    root = Path(os.path.expanduser(a.assets))
    paths = a.map or sorted(str(p) for p in (root / 'maps').glob('rasak_preview_ex_*.layers.map.json'))
    fails = 0
    for p in paths:
        m = load(p)
        man = load(root / 'baked' / m['tilesetId'] / 'manifest.json')
        interior = m['tilesetId'] == 'rasak_interior'
        stats, orphan = measure(m, man, interior)
        bad = verdict(stats, interior)
        fails += bool(bad)
        print(('FAIL ' if bad else 'ok   ') + Path(p).name, json.dumps(stats, ensure_ascii=False), '; '.join(bad), orphan if orphan else '')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
