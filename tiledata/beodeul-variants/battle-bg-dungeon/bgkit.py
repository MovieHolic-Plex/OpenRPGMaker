# 전투 배경(던전 계열) 공용 도구. 장소 그림 함수는 src/<장소>/ 사본에서 가져오고, 여기는 화면 조립·마감만 한다.
# 규칙(WAVE-BRIEF-3 A): 640x360, 불투명, 색 <= 96, 배틀러 자리(x 120~560, y 190~330)에 키 큰 물체·밝은 점 금지,
# 하늘은 단색 띠 + 손 구름, 블러·안티앨리어싱 금지(알파는 0/255 로 자른다).
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 640, 360
HORIZON = 172          # 벽 밑선(지평선) 기본값
SAFE = (120, 190, 560, 330)


def src(place):
    """src/<place> 를 import 경로 맨 앞에 넣는다(장소마다 다른 프로세스에서 부른다)."""
    p = os.path.join(HERE, 'src', place)
    if p not in sys.path: sys.path.insert(0, p)
    return p


def canvas(c=(0, 0, 0)):
    a = np.zeros((H, W, 3), np.uint8); a[:] = c; return a


def fill(a, x0, y0, x1, y1, f, mask=None, ox=0, oy=0):
    """화소 함수 f(X, Y) -> (r,g,b) 로 [x0,x1)x[y0,y1) 를 칠한다. mask(x, y) 가 False 인 곳은 건너뛴다."""
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            if mask is not None and not mask(x, y): continue
            c = f(x + ox, y + oy)
            a[y, x] = c[:3]


def paste(a, im, x, y, k=1, flip=False, dim=1.0, cut=128):
    """RGBA 그림을 왼쪽 위 (x, y) 에 붙인다. 정수 배 k, 좌우 뒤집기, 밝기 dim. 알파는 cut 기준 0/255."""
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if k != 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    s = np.array(im.convert('RGBA'))
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(W, x + w), min(H, y + h)
    if X1 <= X0 or Y1 <= Y0: return
    ss = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = ss[..., 3] >= cut
    col = ss[..., :3].astype(np.float32)
    if dim != 1.0: col = col * dim
    reg = a[Y0:Y1, X0:X1]
    reg[m] = np.clip(col[m], 0, 255).astype(np.uint8)


def paste_bl(a, im, x, ybot, **kw):
    """왼쪽 아래 기준(지도 조각 규약)으로 붙인다: (x, ybot) = 그림 왼쪽 아래 다음 줄."""
    k = kw.get('k', 1)
    paste(a, im, x, ybot - im.height * k, **kw)


def glow(a, cx, cy, r, color, steps=((1.0, .16), (.66, .26), (.36, .38))):
    """빛 웅덩이: 블러 없이 동심 타원 3단(각 단은 한 번 섞은 단색) — 색 수를 늘리지 않게 단계로만."""
    yy, xx = np.mgrid[0:H, 0:W]
    d = ((xx - cx) / r) ** 2 + ((yy - cy) / (r * .62)) ** 2
    out = a.astype(np.float32)
    for rr, t in steps:
        m = d <= rr * rr
        out[m] = out[m] * (1 - t * .5) + np.array(color, np.float32) * (t * .5)
    a[:] = np.clip(out, 0, 255).astype(np.uint8)


def shade_rows(a, y0, y1, k, x0=0, x1=W):
    a[y0:y1, x0:x1] = (a[y0:y1, x0:x1].astype(np.float32) * k).astype(np.uint8)


def ellipse_shadow(a, cx, cy, rx, ry, k=.62):
    yy, xx = np.mgrid[0:H, 0:W]
    m = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    a[m] = (a[m].astype(np.float32) * k).astype(np.uint8)


def ncolors(a): return len(np.unique(a.reshape(-1, 3), axis=0))


def finish(a, path, maxc=96, pal=None):
    """pal(장소 램프 묶음)이 있으면 그림 전체를 그 램프 색에 붙인다(그늘·빛으로 생긴 중간색 제거).
    그래도 색이 넘으면 디더 없이 중앙 분할로 줄이고 저장. 크기·불투명·색 수를 검사해 돌려준다."""
    n = ncolors(a)
    if pal is not None:
        P = np.unique(np.asarray(pal, np.uint8).reshape(-1, 3), axis=0)
        a = snap(a.reshape(-1, 3), P).reshape(a.shape)
    if ncolors(a) > maxc: a = reduce_colors(a, maxc)
    im = Image.fromarray(a, 'RGB')
    im.save(path)
    chk = np.array(Image.open(path).convert('RGBA'))
    ok = chk.shape[:2] == (H, W) and (chk[..., 3] == 255).all()
    nc = ncolors(chk[..., :3])
    return dict(path=os.path.basename(path), before=n, colors=nc, ok=bool(ok and nc <= maxc))


def safe_report(a, base):
    """배틀러 자리 안에서 바닥 평균보다 아주 밝은 화소 수(밝은 점 검사용)."""
    x0, y0, x1, y1 = SAFE
    reg = a[y0:y1, x0:x1].astype(np.float32).mean(axis=2)
    return int((reg > base).sum())


def snap(cols, pal):
    """cols (N,3) 를 팔레트 pal (M,3) 의 가장 가까운 색으로 — 새 색을 만들지 않고 램프 단 위에 머문다."""
    cols = np.asarray(cols, np.float32); pal = np.asarray(pal, np.float32)
    out = np.empty(cols.shape, np.uint8)
    for i in range(0, len(cols), 20000):
        c = cols[i:i + 20000]
        d = ((c[:, None, :] - pal[None, :, :]) ** 2).sum(-1)
        out[i:i + 20000] = pal[d.argmin(1)].astype(np.uint8)
    return out


def palette_of(a, extra=()):
    p = np.unique(a.reshape(-1, 3), axis=0)
    if len(extra): p = np.concatenate([p, np.asarray(extra, np.uint8).reshape(-1, 3)])
    return p


def shade(a, mask, k, pal=None):
    """mask 영역을 k 배 어둡게(또는 밝게) 한 뒤 그림의 기존 색으로 붙인다(단 하나 내리기)."""
    pal = palette_of(a) if pal is None else pal
    v = a[mask].astype(np.float32) * k
    a[mask] = snap(v, pal)


def rows_mask(y0, y1, x0=0, x1=W):
    m = np.zeros((H, W), bool); m[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] = True; return m


def tint(a, mask, color, t, pal=None):
    """빛 웅덩이용: color 쪽으로 t 만큼 섞고 팔레트(+빛 색 램프)에 붙인다."""
    pal = palette_of(a) if pal is None else pal
    v = a[mask].astype(np.float32) * (1 - t) + np.array(color, np.float32) * t
    a[mask] = snap(v, pal)


def glow_steps(a, cx, cy, r, color, pal, steps=((1.0, .10), (.6, .2))):
    yy, xx = np.mgrid[0:H, 0:W]
    d = ((xx - cx) / r) ** 2 + ((yy - cy) / (r * .62)) ** 2
    for rr, t in steps:
        tint(a, d <= rr * rr, color, t, pal)


def reduce_colors(a, maxc=96, base=78):
    """디더 없이 색 줄이기: 중앙 분할로 base 색을 고른 뒤, 남은 칸은 「가장 크게 틀린 원래 색」을 하나씩 그대로 더한다.
    → 넓은 바닥·벽은 중앙 분할 대표색, 작은 등불·결정 같은 드문 색은 원래 색이 살아남는다."""
    flat = a.reshape(-1, 3)
    uc, inv, cnt = np.unique(flat, axis=0, return_inverse=True, return_counts=True)
    q = Image.fromarray(a, 'RGB').quantize(colors=base, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:base * 3], np.uint8).reshape(-1, 3)
    pal = np.unique(pal, axis=0)
    ucf = uc.astype(np.float32)
    def nearest(P):
        d = ((ucf[:, None, :] - P.astype(np.float32)[None]) ** 2).sum(-1)
        return d.argmin(1), np.sqrt(d.min(1))
    while len(pal) < maxc:
        idx, err = nearest(pal)
        score = err * np.sqrt(cnt)
        j = int(score.argmax())
        if err[j] < 6: break
        pal = np.concatenate([pal, uc[j:j + 1]])
    idx, _ = nearest(pal)
    return pal[idx][inv.reshape(-1)].reshape(a.shape).astype(np.uint8)
