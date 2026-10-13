"""sky_steam 공용 등록·내보내기 모듈 — 하늘섬(A: sky_a_*.py)·증기 도시(B: steam_b_*.py)가 같이 쓴다. 이름 고정.

    from registry import Cv, K, OL, piece, run_cli
    @piece('sky-a-windvane', '바람개비', 1, 2, kind='column', line='A', solid=[(0,1)])
    def draw(c): ...                       # c = Cv(w*16, h*16), 투명 바탕
    if __name__ == '__main__': run_cli('A')   # export | status | batch

산출: tiledata/sky-steam/pieces/<line>/_gate/<id>.png (투명, 관문 입력) + manifest.json, /tmp/sky-<line>-batch.jsonl.
관문: npm run harness -- object-gate review --batch /tmp/sky-A-batch.jsonl 2>&1 | grep -E "^(PASS|FAIL)"
status 는 모델을 부르지 않고 영수증만 읽는다(그림 화소 해시 기준). 애니메이션(frames>1)은 모든 프레임이 통과해야 PASS.
"""
from __future__ import annotations
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
from palette import K, OL, RAMPS, all_colors  # noqa: E402,F401
from object_gate import pixel_sha256, read_receipt  # noqa: E402

TILE = 16
OUT_ROOT = os.path.join(REPO, 'tiledata', 'sky-steam', 'pieces')


class Cv:
    """RGBA 캔버스. 좌표는 화소. 범위 밖은 조용히 무시."""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    def P(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.a[y, x] = (*c[:3], 255)
    def R(self, x, y, w, h, c):
        x0, y0 = max(x, 0), max(y, 0); x1, y1 = min(x + w, self.w), min(y + h, self.h)
        if x1 > x0 and y1 > y0: self.a[y0:y1, x0:x1] = (*c[:3], 255)
    def HL(self, x, y, w, c): self.R(x, y, w, 1, c)
    def VL(self, x, y, h, c): self.R(x, y, 1, h, c)
    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): self.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def ell(self, cx, cy, rx, ry, c, only=None):
        """채운 타원. only(x,y)->bool 로 일부만."""
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and (only is None or only(x, y)): self.P(x, y, c)
    def op(self, x, y): return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0
    def outline(self, c=OL, diag=False):
        """불투명 덩어리 바깥 1화소 윤곽(투명 칸에만)."""
        m = self.a[:, :, 3] > 0; add = []
        for y in range(self.h):
            for x in range(self.w):
                if m[y, x]: continue
                nb = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] + ([(x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1)] if diag else [])
                if any(0 <= i < self.w and 0 <= j < self.h and m[j, i] for i, j in nb): add.append((x, y))
        for x, y in add: self.P(x, y, c)
    def image(self): return Image.fromarray(self.a, 'RGBA')


PIECES: dict = {}


def piece(id_, name, w, h, kind, line, solid=(), frames=1, tags=(), pad=0):
    """등록 데코레이터. 그림 함수는 draw(c) (frames>1 이면 draw(c, f)). w,h 는 칸 수(16px). pad = 윤곽용 가장자리 여유 화소(관문용 PNG 는 투명 여백 포함 칸 크기 그대로)."""
    def deco(fn):
        PIECES[id_] = dict(id=id_, name=name, w=w, h=h, kind=kind, line=line, solid=list(solid), frames=frames, tags=list(tags), draw=fn)
        return fn
    return deco


def render(p, f=0):
    c = Cv(p['w'] * TILE, p['h'] * TILE)
    p['draw'](c, f) if p['frames'] > 1 else p['draw'](c)
    return c.image()


def pieces_of(line, only=None):
    return [p for p in PIECES.values() if p['line'] == line and (not only or p['id'] in only)]


def out_dir(line): return os.path.join(OUT_ROOT, line, '_gate')


def export(line, only=None):
    d = out_dir(line); os.makedirs(d, exist_ok=True)
    man, rows = [], []
    for p in pieces_of(line, only):
        names = []
        for f in range(p['frames']):
            n = p['id'] + ('' if p['frames'] == 1 else f'.f{f}')
            render(p, f).save(os.path.join(d, n + '.png')); names.append(n)
            rows.append(dict(png=os.path.join(d, n + '.png'), kind=p['kind'], name=p['name'], label=f'sky-steam/{n}'))
        man.append(dict(id=p['id'], name=p['name'], w=p['w'], h=p['h'], kind=p['kind'], solid=p['solid'], frames=p['frames'], files=names, tags=p['tags']))
    json.dump(man, open(os.path.join(d, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    bp = f'/tmp/sky-{line}-batch.jsonl'
    open(bp, 'w').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n')
    return man, bp


def status_of(p):
    """'pass'|'fail'|'none' — 영수증(그림 해시) 기준, 모든 프레임."""
    res = []
    for f in range(p['frames']):
        r = read_receipt(pixel_sha256(render(p, f)))
        res.append('none' if not r else r['verdict'])
    return 'pass' if all(x == 'pass' for x in res) else ('none' if 'none' in res else 'fail')


def status(line, only=None):
    out = {p['id']: status_of(p) for p in pieces_of(line, only)}
    for k, v in out.items(): print(v.upper().ljust(5), k)
    n = sum(v == 'pass' for v in out.values()); print(f'\n{n}/{len(out)} pass')
    return out


def run_cli(line):
    a = sys.argv[1:] or ['export']; only = set(a[1:]) or None
    if a[0] in ('export', 'batch'):
        man, bp = export(line, only); print(f'{len(man)} pieces -> {out_dir(line)}\nbatch {bp}')
    elif a[0] == 'status': status(line, only)
