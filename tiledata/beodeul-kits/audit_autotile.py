#!/usr/bin/env python3
"""버들항 장소 16변형 오토타일 전수 감사(읽기 전용).

대상: tiledata/beodeul-variants/*/parts/autotile-*.png (64×64, 4×4칸, 칸 번호 = 위1 + 오른2 + 아래4 + 왼8).

하는 일
  1. 변형 16칸을 규약대로 이어 붙여 시험 덩이를 만든다 — 5×5 덩이, 코가 튀어나온 L자, 1칸 폭 나선, 들쭉날쭉 덩이.
  2. 5×5 덩이의 바깥 윤곽(네 변의 깊이 곡선)으로 「직선·직각 정도」를 잰다.
       (변 깊이 곡선은 폭 5 이동 중앙값으로 1~2px 톱니를 거른 뒤 잰다 — 잔톱니만 있는 곧은 변은 곧다고 본다)
       straight  : 변 길이 중 같은 깊이가 8px 이상 이어진 비율(곧은 줄)
       longest   : 한 깊이로 가장 길게 곧은 줄(px, 변 80px 중)
       amp       : 변 가운데(모서리 8px 제외) 깊이의 최댓값-최솟값(px, 울퉁불퉁 정도)
       corner    : 볼록 모서리가 변보다 얼마나 깎였나(px, 0이면 직각)
       turns     : 변 1px 당 깊이가 바뀌는 횟수(윤곽 꺾임 밀도)
       period    : 변 곡선이 16px 주기로 똑같이 되풀이되는 정도(1이면 칸마다 같은 물결)
       seam      : 칸 경계(16px 배수)에서 깊이가 튀는 최대값(px, 이음매)
       conv      : 규약 검사 — 이웃 있는 변인데 가장자리가 비었거나, 이웃 없는 변인데 칸 끝까지 꽉 찬 경우 수
     나쁨 점수 bad = 0.35·straight + 0.25·longest/80 + 0.2·(1-min(amp,6)/6) + 0.2·(1-min(corner,4)/4)  (0 = 둥글고 울퉁불퉁, 1 = 네모)
  3. 순위를 낸다. 울타리·난간·깔개·철로처럼 곧은 것이 맞는 구조물은 따로 「직선 허용」으로 분리한다.

쓰기
  python3 tiledata/beodeul-kits/audit_autotile.py                       # 순위만 출력
  python3 tiledata/beodeul-kits/audit_autotile.py --out DIR             # DIR/<slug>-<name>.png 시험 그림
  python3 tiledata/beodeul-kits/audit_autotile.py --json FILE           # 수치 저장
  python3 tiledata/beodeul-kits/audit_autotile.py --one PATH --out-file F.png   # 한 장만(전/후 비교용)
  python3 tiledata/beodeul-kits/audit_autotile.py --md FILE             # 순위표 마크다운

스토어 팩 품질 게이트 기준(덩이형): bad ≤ 0.45 이고 conv = 0, seam ≤ 3.
"""
import argparse, glob, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VAR = os.path.join(ROOT, 'tiledata', 'beodeul-variants')
T = 16
N_, E_, S_, W_ = 1, 2, 4, 8
GATE_BAD, GATE_SEAM = 0.45, 3

# 곧은 것이 맞는 구조물(울타리·난간·깔개·철로·통로·연석·경계선·다리·배수로)
STRAIGHT_OK_ROLES = {'fence', 'wall'}
STRAIGHT_OK_NAMES = {'carpet', 'cult-carpet', 'carpet-crimson', 'carpet-slate', 'rail', 'rails', 'platform', 'deck-edge',
                     'catwalk', 'curb', 'hazard', 'hazardline', 'starbridge', 'boardwalk', 'gutter', 'conveyor', 'pipe',
                     'glowcrack', 'crack@ice-cave', 'sunabed', 'flagpath', 'cloudpath', 'trail', 'dirtroad', 'dirtpath',
                     'ash-trail', 'gametrail', 'ashpath', 'gravelpath', 'gravel-path', 'dirt', 'weedydirt', 'lane-edge'}
# 길(trail·path)은 폭 2칸 줄로 쓰므로 변이 곧아도 덜 거슬린다 → 「길」 갈래로 따로 본다.
PATH_NAMES = {'trail', 'dirtroad', 'dirtpath', 'ash-trail', 'gametrail', 'ashpath', 'gravelpath', 'gravel-path', 'dirt',
              'weedydirt', 'lane-edge', 'flagpath', 'cloudpath'}

SHAPES = {
    'blob5': ["#####", "#####", "#####", "#####", "#####"],
    'L-nose': ["##.....", "##.....", "######.", "#######", "...##..", "...#..."],
    'spiral': ["#########", "........#", "#######.#", "#.....#.#", "#.###.#.#", "#.#...#.#", "#.#####.#", "#.......#", "#########"],
    'organic': [".####...", "######..", "#######.", ".#######", "..######", ".####.##", "..##..#."],
}


def load_meta(place):
    p = os.path.join(VAR, place, 'partmeta.json')
    if not os.path.exists(p): return {}
    try: return json.load(open(p))
    except Exception: return {}


def cells_of(sheet):
    a = np.array(sheet.convert('RGBA'))
    return [a[(n // 4) * T:(n // 4) * T + T, (n % 4) * T:(n % 4) * T + T] for n in range(16)]


def compose(cells, rows, margin=1):
    h, w = len(rows), max(len(r) for r in rows)
    m = np.zeros((h + 2 * margin, w + 2 * margin), bool)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '#': m[y + margin, x + margin] = True
    H, W = m.shape
    out = np.zeros((H * T, W * T, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            if not m[y, x]: continue
            n = (N_ if m[y - 1, x] else 0) | (E_ if m[y, x + 1] else 0) | (S_ if m[y + 1, x] else 0) | (W_ if m[y, x - 1] else 0)
            out[y * T:(y + 1) * T, x * T:(x + 1) * T] = cells[n]
    return out


def over(bg, rgba):
    a = rgba[..., 3:4].astype(float) / 255
    return (bg * (1 - a) + rgba[..., :3] * a).astype(np.uint8)


def ground(h, w):
    """밑 땅(중간 녹갈색 체크) — 위층 투명 덧그림이 보이게."""
    Y, X = np.mgrid[0:h, 0:w]
    base = np.where((((X // 8) + (Y // 8)) % 2 == 0)[..., None], np.array([92, 104, 78]), np.array([84, 96, 72]))
    return base.astype(np.uint8)


def profile(alpha, side, thr=64):
    """5×5 덩이(여백 1칸) 한 변의 깊이 곡선: 덩이 바깥 경계에서 첫 불투명 픽셀까지 거리(0..16)."""
    o, L = T, 5 * T            # 덩이는 [16, 96)
    p = np.full(L, T, float)
    for t in range(L):
        for d in range(T + 1):
            if side == 'N': y, x = o + d, o + t
            elif side == 'S': y, x = o + L - 1 - d, o + t
            elif side == 'W': y, x = o + t, o + d
            else: y, x = o + t, o + L - 1 - d
            if d == T: p[t] = T; break
            if alpha[y, x] >= thr: p[t] = d; break
    return p


def smooth(p, w=5):
    """이동 중앙값(폭 5) 후 반올림 — 1px 톱니는 「곧은 줄」로 본다."""
    h = w // 2
    q = np.pad(p, h, mode='edge')
    return np.round(np.array([np.median(q[i:i + w]) for i in range(len(p))]))


def runs(p):
    out, s = [], 0
    for i in range(1, len(p) + 1):
        if i == len(p) or p[i] != p[s]: out.append(i - s); s = i
    return out


def metrics(cells):
    blob = compose(cells, SHAPES['blob5'])
    al = blob[..., 3]
    raw = {k: profile(al, k) for k in 'NESW'}
    sides = {k: smooth(v) for k, v in raw.items()}      # 1~2px 잔물결은 걸러 큰 윤곽만 본다
    L = 5 * T
    straight = np.mean([sum(r for r in runs(p) if r >= 8) / L for p in sides.values()])
    longest = max(max(runs(p)) for p in sides.values())
    amp = np.mean([np.ptp(p[8:L - 8]) for p in sides.values()])
    turns = np.mean([np.count_nonzero(np.diff(p)) / L for p in raw.values()])
    corner = np.mean([max(0.0, np.mean(p[:2]) - np.median(p)) for p in sides.values()] +
                     [max(0.0, np.mean(p[-2:]) - np.median(p)) for p in sides.values()])
    period = np.mean([np.mean(p[16:64] == p[32:80]) for p in raw.values()])
    seam = max(max(abs(p[k] - p[k - 1]) for k in range(16, L, 16)) for p in raw.values())
    # 규약 검사(칸 단위)
    conv = 0
    for n, c in enumerate(cells):
        a = c[..., 3] >= 64
        band = {'N': a[0], 'S': a[-1], 'W': a[:, 0], 'E': a[:, -1]}
        bit = {'N': N_, 'E': E_, 'S': S_, 'W': W_}
        cov = a.mean()
        for k in 'NESW':
            f = band[k].mean()
            if (n & bit[k]) and f == 0 and cov > 0: conv += 1          # 이웃 쪽으로 이어지지 않음
            if not (n & bit[k]) and f >= 0.999 and n != 15: conv += 1  # 이웃 없는 쪽이 칸 끝까지 꽉 참(네모 변)
    full15 = float((cells[15][..., 3] >= 64).mean())
    bad = 0.35 * straight + 0.25 * longest / L + 0.2 * (1 - min(amp, 6) / 6) + 0.2 * (1 - min(corner, 4) / 4)
    return dict(bad=round(float(bad), 3), straight=round(float(straight), 3), longest=int(longest), amp=round(float(amp), 2),
                corner=round(float(corner), 2), turns=round(float(turns), 3), period=round(float(period), 2),
                seam=int(seam), conv=int(conv), full15=round(full15, 2))


def test_sheet(cells, scale=2, title=None):
    """시험 그림: [원본 시트 | 5×5 | L자 | 나선 | 들쭉날쭉] 을 밑 땅 위에 2배로."""
    parts = []
    sheet = np.zeros((4 * T + 2 * T, 4 * T + 2 * T, 4), np.uint8)
    for n, c in enumerate(cells):
        y, x = T + (n // 4) * T, T + (n % 4) * T
        sheet[y:y + T, x:x + T] = c
    parts.append(sheet)
    for k in ('blob5', 'L-nose', 'spiral', 'organic'):
        parts.append(compose(cells, SHAPES[k]))
    H = max(p.shape[0] for p in parts)
    gap = 8
    W = sum(p.shape[1] for p in parts) + gap * (len(parts) - 1)
    canvas = np.full((H, W, 3), 40, np.uint8)
    x = 0
    for i, p in enumerate(parts):
        bg = ground(p.shape[0], p.shape[1])
        if i == 0:   # 시트 칸 경계 표시
            bg = bg.copy()
        canvas[:p.shape[0], x:x + p.shape[1]] = over(bg, p)
        x += p.shape[1] + gap
    im = Image.fromarray(canvas, 'RGB').resize((W * scale, H * scale), Image.NEAREST)
    return im


def classify(place, name, pm):
    if pm.get('role') in STRAIGHT_OK_ROLES: return 'structure'
    if name in PATH_NAMES: return 'path'
    if name in STRAIGHT_OK_NAMES or f'{name}@{place}' in STRAIGHT_OK_NAMES: return 'structure'
    return 'blob'


def audit(paths, out=None):
    rows = []
    for f in paths:
        place = f.split(os.sep)[-3]
        name = os.path.basename(f)[len('autotile-'):-4]
        pm = load_meta(place).get('autotile-' + name, {})
        cells = cells_of(Image.open(f))
        m = metrics(cells)
        m.update(place=place, name=name, ko=pm.get('ko', ''), role=pm.get('role', ''), cls=classify(place, name, pm),
                 path=os.path.relpath(f, ROOT))
        m['gate'] = 'PASS' if (m['cls'] != 'blob' or (m['bad'] <= GATE_BAD and m['conv'] == 0 and m['seam'] <= GATE_SEAM)) else 'FAIL'
        rows.append(m)
        if out:
            os.makedirs(out, exist_ok=True)
            test_sheet(cells).save(os.path.join(out, f'{place}-{name}.png'))
    rows.sort(key=lambda r: (-r['bad']))
    return rows


def to_md(rows):
    lines = ['# 버들항 16변형 오토타일 전수 감사 — 직선·직각 순위', '',
             '생성: `python3 tiledata/beodeul-kits/audit_autotile.py --md tiledata/beodeul-kits/audit-autotile/RANKING.md`.',
             '시험 그림: `--out <폴더>` (원본 시트 | 5×5 덩이 | 코 L자 | 1칸 폭 나선 | 들쭉날쭉 덩이, 2배).', '',
             '## 스토어 팩 품질 게이트 (덩이형 오토타일)', '',
             f'- **bad ≤ {GATE_BAD}** (0 = 둥글고 울퉁불퉁, 1 = 네모). 5×5 덩이의 네 변 깊이 곡선으로 잰다.',
             '- **conv = 0** (규약 위1+오른2+아래4+왼8: 이웃 쪽 변은 이어지고, 이웃 없는 쪽 변은 칸 끝까지 꽉 차지 않는다).',
             f'- **seam ≤ {GATE_SEAM}px** (칸 경계에서 윤곽이 튀지 않는다).',
             '- 「구조」(울타리·난간·깔개·철로·관·통로)와 「길」(폭 2칸 흙길·오솔길)은 곧은 변이 의도라 게이트 대상이 아니다. 길은 참고로 수치만 본다.',
             '- 4방향(대각선 없는) 16변형은 오목 모서리를 그릴 칸이 없어 L자 안쪽 꺾임에 작은 계단이 남는다. 가장자리 들여쓰기(inset)가 작을수록 덜 보인다.', '',
             '열: bad 나쁨 점수 · straight 곧은 줄 비율(8px 이상 같은 깊이) · longest 가장 긴 곧은 줄(px/80) · amp 변 울퉁불퉁 폭(px) · corner 볼록 모서리 깎임(px) · turns 꺾임 밀도 · period 16px 되풀이 · seam 이음매 튐 · conv 규약 위반 수', '']
    for cls, title in (('blob', '덩이형 (게이트 대상)'), ('path', '길 (참고)'), ('structure', '구조 — 직선 허용 (참고)')):
        sub = [r for r in rows if r['cls'] == cls]
        lines += [f'## {title} — {len(sub)}개', '', '| # | 장소 | 오토타일 | 이름 | bad | straight | longest | amp | corner | turns | period | seam | conv | 게이트 |',
                  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
        for i, r in enumerate(sub, 1):
            lines.append(f"| {i} | {r['place']} | {r['name']} | {r['ko']} | {r['bad']} | {r['straight']} | {r['longest']} | {r['amp']} | {r['corner']} | {r['turns']} | {r['period']} | {r['seam']} | {r['conv']} | {r['gate']} |")
        lines.append('')
    return '\n'.join(lines) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out'); ap.add_argument('--json'); ap.add_argument('--md')
    ap.add_argument('--one'); ap.add_argument('--out-file')
    ap.add_argument('--top', type=int, default=30)
    a = ap.parse_args()
    if a.one:
        cells = cells_of(Image.open(a.one))
        m = metrics(cells); print(json.dumps(m, ensure_ascii=False))
        if a.out_file: test_sheet(cells).save(a.out_file)
        return
    paths = sorted(glob.glob(os.path.join(VAR, '*', 'parts', 'autotile-*.png')))
    rows = audit(paths, a.out)
    for r in [r for r in rows if r['cls'] == 'blob'][:a.top]:
        print(f"{r['bad']:.3f} {r['gate']} {r['place']:>20} {r['name']:<18} st={r['straight']} lg={r['longest']} amp={r['amp']} cor={r['corner']} seam={r['seam']} conv={r['conv']}")
    if a.json: json.dump(rows, open(a.json, 'w'), ensure_ascii=False, indent=1)
    if a.md: open(a.md, 'w').write(to_md(rows))


if __name__ == '__main__':
    main()
