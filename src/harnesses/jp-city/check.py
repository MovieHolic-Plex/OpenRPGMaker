"""jp-city 후보 깨짐 검사 — 기계로 잴 수 있는 것만. 3/4 시점·읽힘·일본식 디테일 판정은 독립 검수자와 사용자가 눈으로 한다(여기서 수치로 대신하지 않는다).

  python3 check.py FILE.pxg --item <seed id>   →  FILE.check.json  (hard 하나라도 있으면 exit 1)

시드 항목(`harness-data/jp-city/seed.json`)의 kind·size·flags·slots·cells 를 읽는다.
공통 hard: cell(@cell 16) · size(캔버스 = 칸 수×16) · mark(# 표시색 잔존·마커색 화소) · palette(modern3 밖의 색) · alpha(반투명 화소) · empty
building-part·prop(오브젝트): bg(귀퉁이 투명) · outline(가장자리가 짙은 재료단 80%↑) · ground(맨 아래 접지) · one(한 덩어리) · (building-part) style-bottom
  slots 가 있으면: slot_empty(빈 슬롯) · cover(슬롯 밖 불투명) · ground(슬롯마다)
tilesheet: opaque(꽉 찬 타일; flags 에 overlay 가 있으면 알파 0/255 만 허용) · seam(반복 이음, seam_axes 로 축 지정; 이음 차이가 칸 안 인접 열 쌍 최대 차이의 1.3배+8 초과)
kit: cell_empty · cover(이름 없는 칸의 화소) · opaque(opaque 칸) · seam(repeat 칸)
flags: overlay(투명 덧칠: 윤곽·접지·귀퉁이 검사 제외) · thin(1px 선 허용) · bleed(귀퉁이 불투명 허용) · no_outline
soft: 색 수·램프 수·실루엣·윤곽 짙은 비율·바닥 줄 짙은 비율(참고 수치일 뿐 합격 기준 아님)
"""
import argparse, json, os, re, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid'))
import pxgrid  # noqa: E402
import palette as PAL  # noqa: E402
from scipy import ndimage  # noqa: E402

SEED = os.path.join(ROOT, 'harness-data/jp-city/seed.json')


def _owner():
    """색(0xRRGGBB) → (램프 이름, 단 번호, 램프 단 수)."""
    own = {}
    for name, cols, _ in PAL.ramps():
        for i, h in enumerate(cols):
            own.setdefault(int(h[1:], 16), (name, i, len(cols)))
    return own


OWN = _owner()


def keyof(a): return (a[..., 0].astype(np.uint32) << 16) | (a[..., 1].astype(np.uint32) << 8) | a[..., 2].astype(np.uint32)


def is_dark(c):
    """윤곽으로 인정하는 색: 램프의 가장 어두운 두 단(0,1) 또는 sumi 전부. 「재료 가장 어두운 단」 규칙의 기계 근사."""
    o = OWN.get(int(c))
    return bool(o and (o[0] == 'sumi' or o[1] <= 1))


def read_cell_decl(path):
    for ln in open(path, encoding='utf-8'):
        m = re.match(r'\s*@cell\s+(\d+)', ln)
        if m: return int(m.group(1))
    return None


def edge_pixels(solid):
    pad = np.pad(solid, 1)
    return solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])


def seam_hard(rgba, axes, label, hard, soft):
    """반대편 가장자리와 이음: 이음(끝 열↔첫 열) 차이가 칸 안 인접 열(행) 쌍 중 **가장 큰 차이**의 1.3배(+8)를 넘으면 불합격. 알파 차이도 센다.
    줄눈이 칸 가장자리에 있는 설계(콘크리트 판)는 줄눈 쪽 경계의 차이가 이미 내부 최대라 통과하고, 이음에만 밝은/어두운 선이 몰린 그림은 걸린다."""
    t = rgba.astype(int)
    def diff(p, q): return np.abs(p - q).sum(axis=-1)
    ch = diff(t[:, 1:], t[:, :-1]).mean(axis=0); cv = diff(t[1:], t[:-1]).mean(axis=1)    # 인접 열 쌍·행 쌍마다 평균 차이
    sh = diff(t[:, 0], t[:, -1]).mean(); sv = diff(t[0], t[-1]).mean()
    soft[f'seam_{label}'] = f'inmax{ch.max():.0f}/{cv.max():.0f} seam{sh:.0f}/{sv:.0f}'
    if 'x' in axes and sh > ch.max() * 1.3 + 8: hard.append(f'seam: {label} 좌우 이음 {sh:.0f} > 내부 최대 {ch.max():.0f}×1.3+8')
    if 'y' in axes and sv > cv.max() * 1.3 + 8: hard.append(f'seam: {label} 상하 이음 {sv:.0f} > 내부 최대 {cv.max():.0f}×1.3+8')


def run(path, item_id):
    seed = json.load(open(SEED, encoding='utf-8'))
    it = seed['items'][item_id]; kind = it['kind']; flags = set(it.get('flags', []))
    cw, ch = it['size']; w, h = cw * 16, ch * 16
    hard, soft = [], {}
    cell = read_cell_decl(path)
    if cell != 16: hard.append(f'cell: @cell {cell} (필요: 파일 머리에 `@cell 16`)')
    d, im = pxgrid.render(path)
    a = np.array(im)
    if (a.shape[1], a.shape[0]) != (w, h): hard.append(f'size: {a.shape[1]}x{a.shape[0]} (필요 {w}x{h} = {cw}x{ch}칸)')
    H, W = a.shape[:2]
    alpha = a[..., 3]
    op = alpha > 0
    if ((alpha > 0) & (alpha < 255)).any(): hard.append(f'alpha: 반투명 화소 {int(((alpha > 0) & (alpha < 255)).sum())}개(알파는 0 또는 255 — modern3 규칙 4)')
    txt = open(os.path.splitext(path)[0] + '.txt', encoding='utf-8').read()
    if '#' in ''.join(l for l in txt.splitlines() if not l.startswith('//')): hard.append('mark: # 표시색이 남았다')
    key = keyof(a)
    if (op & (key == int(PAL.MARKER[1:], 16))).any(): hard.append('mark: 마커색 #e040c0 화소가 남았다')
    bad = {int(c) for c in np.unique(key[op])} - set(OWN)
    if bad: hard.append('palette: modern3 밖의 색 ' + ', '.join('#%06x' % c for c in sorted(bad)[:6]))
    soft['colors'] = int(len(np.unique(key[op]))); soft['ramps'] = int(len({OWN[int(c)][0] for c in np.unique(key[op]) if int(c) in OWN}))
    if not op.any():
        hard.append('empty: 그림이 없다'); return finish(path, hard, soft)

    if kind == 'tilesheet':
        if 'overlay' not in flags and (alpha < 255).any(): hard.append('opaque: 타일에 투명 화소가 있다(꽉 차야 한다 — 덧칠 타일이면 시드에 flags: overlay)')
        cols = cw; axes_map = it.get('seam_axes', {})
        for idx in it.get('seamless_cells', []):
            cx, cy = (idx % cols) * 16, (idx // cols) * 16
            seam_hard(a[cy:cy + 16, cx:cx + 16], axes_map.get(str(idx), 'xy'), f'칸{idx}', hard, soft)
        return finish(path, hard, soft)

    if kind == 'kit':
        named = {}
        for nm, c in it['cells'].items(): named[(c['x'], c['y'])] = (nm, c)
        for cy in range(ch):
            for cx in range(cw):
                sub = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]; n = int((sub[..., 3] > 0).sum())
                if (cx, cy) in named:
                    nm, c = named[(cx, cy)]
                    if n < 6: hard.append(f'cell_empty: 칸 {nm}({cx},{cy}) 비었다')
                    if c.get('opaque') and (sub[..., 3] < 255).any(): hard.append(f'opaque: 칸 {nm} 에 투명 화소(이 칸은 꽉 차야 한다)')
                    if c.get('repeat'): seam_hard(sub, c['repeat'], nm, hard, soft)
                elif n:
                    hard.append(f'cover: 이름 없는 칸 ({cx},{cy}) 에 화소 {n}개(자리 밖에 칠하지 마라)')
        if 'no_outline' not in flags and 'overlay' not in flags:
            ed = edge_pixels(alpha >= 200); ys, xs = np.nonzero(ed)
            frac = float(np.mean([is_dark(key[y, x]) for y, x in zip(ys, xs)])) if len(ys) else 0.0
            soft['outline_dark'] = round(frac, 3)
        return finish(path, hard, soft)

    # building-part · prop (오브젝트)
    solid = alpha >= 200
    overlay = 'overlay' in flags; slots = it.get('slots')
    if not overlay and 'bleed' not in flags and not slots:
        corners = [op[0, 0], op[0, W - 1], op[H - 1, 0], op[H - 1, W - 1]]
        if sum(corners) > 1: hard.append('bg: 귀퉁이가 불투명 — 투명 배경이어야 한다(경계까지 닿는 조각이면 시드에 flags: bleed)')
    if not overlay and 'no_outline' not in flags:
        ed = edge_pixels(solid); ys, xs = np.nonzero(ed)
        frac = float(np.mean([is_dark(key[y, x]) for y, x in zip(ys, xs)])) if len(ys) else 0.0
        soft['outline_dark'] = round(frac, 3)
        if frac < .80: hard.append(f'outline: 가장자리 {frac:.0%} 만 짙은 재료단이다(80% 이상 — 램프 단 0~1 또는 sumi 로 1px 윤곽)')
    if slots:
        covered = np.zeros((H, W), bool)
        for s in slots:
            x0, y0, x1, y1 = s['x'] * 16, s['y'] * 16, (s['x'] + s['w']) * 16, (s['y'] + s['h']) * 16
            covered[y0:y1, x0:x1] = True; sub = op[y0:y1, x0:x1]
            if sub.sum() < 12: hard.append(f'slot_empty: 슬롯 {s["id"]} 비었다')
            elif not overlay and 'hang' not in s.get('flags', []):
                rows = np.nonzero(sub.any(axis=1))[0]
                if rows.max() < (y1 - y0) - 3: hard.append(f'ground: 슬롯 {s["id"]} 맨 아래 불투명 줄 {rows.max()} (슬롯 바닥 {y1 - y0 - 1}, 3줄 안이어야 한다)')
        out = int((op & ~covered).sum())
        if out: hard.append(f'cover: 슬롯 밖 화소 {out}개(자리 밖에 칠하지 마라)')
    else:
        rows = np.nonzero(solid.any(axis=1))[0]
        if not overlay and 'hang' not in flags and len(rows) and rows.max() < H - 3: hard.append(f'ground: 맨 아래 불투명 줄 y={rows.max()} (캔버스 바닥 {H - 1}, 3줄 안이어야 한다)')
        lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
        sizes = ndimage.sum(solid, lab, range(1, n + 1)) if n else []
        stray = int(sum(1 for s in sizes if s < 3)); big = int(sum(1 for s in sizes if s >= 3))
        if stray > 6: hard.append(f'one: 흩어진 점 {stray}개(6 이하)')
        if big > 1 and not overlay and 'multi' not in flags: hard.append(f'one: 덩어리 {big}개(한 덩어리여야 한다 — 일부러 떨어진 조각이면 시드 flags: multi)')
    if kind == 'building-part' and not overlay and not slots:
        bottom = np.nonzero(solid.any(axis=1))[0].max()
        brow = [is_dark(key[bottom, x]) for x in range(W) if solid[bottom, x]]
        soft['bottom_ink'] = round(float(np.mean(brow)), 3) if brow else 0
        if soft['bottom_ink'] < .60: hard.append(f'style-bottom: 맨 아래 줄이 짙은 윤곽이 아니다({soft["bottom_ink"]:.0%}, 60% 이상)')
    ww = np.nonzero(solid.any(axis=0))[0]; rr = np.nonzero(solid.any(axis=1))[0]
    if len(ww) and len(rr): soft['silhouette'] = f'{ww.max() - ww.min() + 1}x{rr.max() - rr.min() + 1}'
    return finish(path, hard, soft)


def finish(path, hard, soft):
    res = {'ok': not hard, 'hard': hard, 'soft': soft}
    json.dump(res, open(os.path.splitext(path)[0] + '.check.json', 'w'), ensure_ascii=False, indent=1)
    return res


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('pxg'); ap.add_argument('--item', required=True)
    o = ap.parse_args(); r = run(o.pxg, o.item)
    print(('OK ' if r['ok'] else 'HARD ✗ ') + '; '.join(r['hard']) + f" | {r['soft']}"); sys.exit(0 if r['ok'] else 1)
