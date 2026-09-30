#!/usr/bin/env python3
"""옛 팔레트(jp·modern·school) 후보를 modern3 판으로 자동 재채색한다. 원본은 건드리지 않는다.
대응표 = tiledata/atlas-pick/remap-to-modern3.json, 기준 = modern-style-bible.md, 검사 = modern3_check.py.

  python3 scripts/content/atlas-pick/remap_modern3.py tiledata/atlas-pick/candidates-school/hall_wall/s1-A.pxg [...]
  python3 scripts/content/atlas-pick/remap_modern3.py candidates-modern/gn_car_h/v0.png            # PNG 도 된다(팔레트 이름 없이 색만)
  옵션: -o DIR   (기본 tiledata/atlas-pick/remap-trial/<세트>/<슬러그>/)   --suffix .m3

산출물(입력 hall_wall/s1-A.pxg 일 때):
  s1-A.m3.pxg · s1-A.m3.png · -x4.png · .txt   modern3 램프 열쇠로 다시 적은 .pxg 와 그 렌더(palette.pal = modern3.pal 사본)
  s1-A.m3.report.json                          화소 수 통계: 램프 대응·약한 대응·모호 대응·반투명 굽기·못 옮긴 색

규칙(모두 자동, 그림은 손대지 않는다 — 색만 바꾼다):
  1. 화소 열쇠 「램프:단」 → 옛 램프 이름으로 byRamp[램프] 를 먼저 찾고, 없거나 낱 글자 색이면 flat[색].
     모호 색(같은 색이 옛 램프 여럿에서 다른 modern3 램프로 갈리는 16개)은 램프 이름이 있으면 byRamp 가 갈라 주고,
     PNG(램프 이름 없음)에서는 flat 의 chosen 을 쓴다.
  2. 약한 대응(거리 ≥ 22): 가장 가까운 색 대신 「옛 램프의 몇 번째 단인가」를 새 램프에 비례해 옮긴다(단 순서를 지킨다).
  3. 반투명은 modern3 에 없다 → 합성 순서대로 밑 화소를 새 램프 안에서 굽는다: ~ 2단 어둡게 · - 1단 어둡게 · % 1단 밝게 · & 2단 밝게.
     밑이 빈 칸이면 굽지 못해 버리고 보고서에 센다.
  4. 실루엣 마커 #e040c0 이 있으면 오류(그 화소는 그대로 두고 종료코드 2).
  5. 대응표에 없는 색은 modern3 에서 가장 가까운 색으로 옮기고 보고서 unmapped 에 센다.
"""
import argparse, collections, json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
BASE = os.path.join(ROOT, 'tiledata', 'atlas-pick')
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'pixel-harness', 'pxgrid'))
import pxgrid  # noqa
from pxg_emit import emit  # noqa
import modern3_check  # noqa

TONES = '0123456789abcde'
MARKER = (0xe0, 0x40, 0xc0)
WEAK_DIST = 22.0
BAKE = {'~': -2, '-': -1, '%': +1, '&': +2}


def hx(rgb): return '#%02x%02x%02x' % tuple(rgb[:3])
def rgb_of(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
def d2(a, b): return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


class Mapper:
    def __init__(self):
        self.tbl = json.load(open(os.path.join(BASE, 'remap-to-modern3.json'), encoding='utf-8'))
        self.new = modern3_check.load_pal()                         # 램프 → [int rgb]
        self.rev = collections.defaultdict(list)                   # hex → [(램프, 단)]
        for n, r in self.new.items():
            for i, c in enumerate(r): self.rev['#%06x' % c].append((n, i))
        self.lname = {n.lower(): n for n in self.new}
        self.by = self.tbl['byRamp']; self.flat = self.tbl['flat']
        self.amb = {a['from']: a for a in self.tbl['ambiguous']}
        self.stat = collections.Counter(); self.weaklog = collections.Counter(); self.unm = collections.Counter()
        self.ambuse = collections.Counter(); self.posmap = {}

    # 새 색 hex → (램프, 단). 여러 램프에 같은 색이 있으면 힌트 램프 이름을 우선
    def key_of(self, h, hint=None):
        c = self.rev.get(h)
        if not c: return None
        if hint:
            for n, i in c:
                if n.lower() == hint.lower(): return (n, i)
        return c[0]

    def nearest(self, rgb):
        best = None
        for n, r in self.new.items():
            for i, c in enumerate(r):
                d = d2(rgb, ((c >> 16) & 255, (c >> 8) & 255, c & 255))
                if best is None or d < best[0]: best = (d, (n, i))
        return best[1]

    def main_target(self, oldramp):
        """옛 램프가 가장 많이 가는 새 램프."""
        if oldramp in self.posmap: return self.posmap[oldramp]
        cnt = collections.Counter(m['step'].rstrip('+-0123456789').lower() for m in self.by[oldramp]['map'])
        self.posmap[oldramp] = self.lname.get(cnt.most_common(1)[0][0]) if cnt else None
        return self.posmap[oldramp]

    def map_color(self, rgb, oldramp=None, idx=None, nold=None):
        """옛 색 → (램프, 단). oldramp/idx/nold 가 있으면 램프 정보를 쓴다."""
        h = hx(rgb)
        ent = None
        if oldramp and oldramp in self.by:
            ent = next((m for m in self.by[oldramp]['map'] if m['from'] == h), None)
        if ent is not None:
            hint = ent['step'].rstrip('+-0123456789')
            k = self.key_of(ent['to'], hint)
            if ent['dist'] >= WEAK_DIST and idx is not None and nold and nold > 1:
                tg = self.main_target(oldramp)
                if tg:
                    j = round(idx * (len(self.new[tg]) - 1) / (nold - 1))
                    self.weaklog[(h, ent['to'], tg + str(j))] += 1; self.stat['weak'] += 1
                    return (tg, j)
                self.weaklog[(h, ent['to'], 'nearest')] += 1; self.stat['weak'] += 1
            else:
                self.stat['ramp'] += 1
            if h in self.amb: self.ambuse[h] += 1
            return k or self.nearest(rgb_of(ent['to']))
        f = self.flat.get(h)
        if f is not None:
            k = self.key_of(f)
            if h in self.amb: self.ambuse[h] += 1
            self.stat['flat'] += 1
            if k: return k
        self.stat['unmapped'] += 1; self.unm[h] += 1
        return self.nearest(rgb)


def convert_pxg(path, M):
    """pxg → 층마다 굽고 → {(x,y): (램프,단)} + 크기. 반투명은 굽는다."""
    doc = pxgrid.Doc(path)
    W, H = doc.W, doc.H
    old_len = {n: len(k) for n, k in doc.ramps.items()}
    cache = {}
    def conv(key):
        if key in cache: return cache[key]
        rgba = doc.pal[key]
        if ':' in key:
            rn, t = key.split(':'); r = M.map_color(rgba, rn, TONES.index(t), old_len.get(rn))
        else:
            r = M.map_color(rgba)
        cache[key] = r; return r
    grid = [[None] * W for _ in range(H)]
    marker = 0; dropped = 0; baked = collections.Counter(); dropch = collections.Counter()
    def bake(n, i, k, rgba):
        step = BAKE.get(k)
        if step is None:
            dark = (rgba[0] + rgba[1] + rgba[2]) < 384
            step = (-2 if rgba[3] >= 100 else -1) if dark else +1
        return (n, max(0, min(len(M.new[n]) - 1, i + step)))
    pending = []
    for ln in doc.order:
        g = doc.layers[ln]
        opaque_layer = any(c != '.' and doc.pal[c][3] == 255 for r in g for c in r)
        for y in range(H):
            for x in range(W):
                k = g[y][x]
                if k == '.': continue
                rgba = doc.pal[k]
                if tuple(rgba[:3]) == MARKER:
                    marker += 1; continue
                if rgba[3] < 255:
                    if grid[y][x] is None: pending.append((y, x, k, opaque_layer)); continue
                    n, i = grid[y][x]; grid[y][x] = bake(n, i, k, rgba); baked[k] += 1
                else:
                    grid[y][x] = conv(k)
    # 밑이 빈 칸인 반투명: 같은 층에 불투명 그림이 있고(그 층에서 유리 줄기처럼 밑그림을 덮어쓴 경우) 좌우나 상하가 모두 불투명이면
    # 이웃 램프에서 굽는다(& 는 garasu 이웃 우선). 그림자처럼 그림 바깥에 걸친 것은 못 굽고 버린다(바닥 램프를 알 수 없다).
    for y, x, k, oq in pending:
        def op(yy, xx): return grid[yy][xx] if 0 <= yy < H and 0 <= xx < W and (yy, xx) not in pset else None
        pset = {(a, b) for a, b, _, _ in pending}
        nb = []
        if oq:
            for a, b in (((y, x - 1), (y, x + 1)), ((y - 1, x), (y + 1, x))):
                u, v = op(*a), op(*b)
                if u and v: nb += [u, v]; break
        if not nb: dropped += 1; dropch[k] += 1; continue
        pick = next((t for t in nb if t[0] == 'garasu'), None) if k == '&' else None
        n, i = pick or nb[0]
        grid[y][x] = bake(n, i, k, doc.pal[k]); baked[k] += 1
    return W, H, grid, dict(marker=marker, translucentDropped=dropped, baked=dict(baked), droppedBy=dict(dropch)), doc.cell


def convert_png(path, M):
    im = Image.open(path).convert('RGBA'); W, H = im.size; px = im.load()
    grid = [[None] * W for _ in range(H)]; cache = {}; marker = 0; dropped = 0
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0: continue
            if (r, g, b) == MARKER: marker += 1; continue
            if a < 255: dropped += 1     # PNG 의 반투명은 이미 합성된 결과가 아니므로 못 굽는다(불투명으로 취급하지 않고 버림)
            k = (r, g, b)
            if k not in cache: cache[k] = M.map_color(k)
            if a >= 255: grid[y][x] = cache[k]
    return W, H, grid, dict(marker=marker, translucentDropped=dropped, baked={}), 16


def write_out(path, outdir, suffix, M):
    os.makedirs(outdir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(path))[0] + suffix
    M.stat.clear(); M.weaklog.clear(); M.unm.clear(); M.ambuse.clear()
    W, H, grid, extra, cell = (convert_png if path.lower().endswith('.png') else convert_pxg)(path, M)
    legend = {}; rows = []; letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for y in range(H):
        row = ''
        for x in range(W):
            k = grid[y][x]
            if k is None: row += '.'; continue
            if k not in legend: legend[k] = letters[len(legend)] if len(legend) < len(letters) else None
            row += legend[k]
        rows.append(row)
    if any(v is None for v in legend.values()): raise SystemExit(f'{path}: (램프,단) 조합이 {len(letters)}개를 넘는다')
    leg = {c: k for k, c in legend.items()}
    with open(os.path.join(outdir, 'palette.pal'), 'w', encoding='utf-8') as f:
        f.write(open(os.path.join(BASE, 'palette', 'modern3.pal'), encoding='utf-8').read())
    txt = emit(rows, leg, title=f'{os.path.basename(path)} → modern3 자동 재채색(remap_modern3.py)')
    txt = txt.replace('@cell 16', f'@cell {cell}', 1)
    pxg = os.path.join(outdir, stem + '.pxg'); open(pxg, 'w', encoding='utf-8').write(txt)
    png = os.path.join(outdir, stem + '.png'); pxgrid.render(pxg, png)
    out, marker, used = modern3_check.check(png, quiet=True)
    rep = dict(src=os.path.relpath(os.path.abspath(path), ROOT), out=os.path.relpath(pxg, ROOT), size=[W, H],
               stat=dict(M.stat), weak=[dict(frm=a, nearest=b, position=c, px=n) for (a, b, c), n in M.weaklog.most_common()],
               ambiguous={k: v for k, v in M.ambuse.items()}, unmapped={k: v for k, v in M.unm.items()},
               marker=extra['marker'], translucentDropped=extra['translucentDropped'], droppedBy=extra.get('droppedBy', {}), baked=extra['baked'],
               outOfPalette=len([k for k in out if k >= 0]), translucentPx=out.get(-1, 0), markerLeft=bool(marker),
               colors=len(used), ramps=sorted({n for (n, i), k in used}))
    open(os.path.join(outdir, stem + '.report.json'), 'w', encoding='utf-8').write(json.dumps(rep, ensure_ascii=False, indent=1) + '\n')
    return rep


def default_outdir(path):
    p = os.path.abspath(path); slug = os.path.basename(os.path.dirname(p)); sset = os.path.basename(os.path.dirname(os.path.dirname(p)))
    sset = re.sub(r'^candidates-', '', sset)
    return os.path.join(BASE, 'remap-trial', sset, slug)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('-o'); ap.add_argument('--suffix', default='.m3')
    a = ap.parse_args(); M = Mapper(); bad = 0
    for f in a.files:
        r = write_out(f, a.o or default_outdir(f), a.suffix, M)
        ok = r['outOfPalette'] == 0 and r['translucentPx'] == 0 and not r['markerLeft'] and r['marker'] == 0
        bad += 0 if ok else 1
        print(('합격 ' if ok else '불합격 ') + r['out'], '| 색', r['colors'], '| 밖 %d' % r['outOfPalette'], '| 약한 대응 %d화소' % r['stat'].get('weak', 0),
              '| 굽기', r['baked'] or '-', '| 빈 칸 위 반투명 버림', r['translucentDropped'], r['droppedBy'] or '', '| 마커', r['marker'], '| 표에 없는 색', len(r['unmapped']))
    sys.exit(2 if bad else 0)


if __name__ == '__main__':
    main()
