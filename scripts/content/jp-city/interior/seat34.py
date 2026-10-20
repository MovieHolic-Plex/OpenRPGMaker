"""seats34 — 일본 실내 의자 3/4 다시 그리기에 쓰는 작은 부품(블록 파일들이 같이 쓴다).

규칙(interior-props-quality-rubric-1): 빛은 왼위 — 수평 윗면이 가장 밝고, 앞면은 가운데 단, 오른쪽·아래 테가 어둡다.
윤곽은 재질의 가장 어두운 단(또는 OL)을 바깥 실루엣에만, 안쪽은 재질 단 1px 이음으로 나눈다. 다리는 2px.
c = ikit Cv(P·R·HL·VL), m = 램프 이름, t = 단.
"""
from ikit import K


def ol(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def plane(c, x, y, w, h, m, t):
    """수평 윗면: 바탕 t, 맨 윗줄·왼 테 t+1, 오른 테 t-1."""
    c.R(x, y, w, h, K(m, t)); c.HL(x, y, w, K(m, t + 1)); c.VL(x, y, h, K(m, t + 1)); c.VL(x + w - 1, y + 1, h - 1, K(m, t - 1))


def face(c, x, y, w, h, m, t):
    """세로 앞면: 바탕 t, 왼 테 t+1, 오른 테·밑줄 t-1."""
    c.R(x, y, w, h, K(m, t)); c.VL(x, y, h, K(m, t + 1)); c.VL(x + w - 1, y, h, K(m, t - 1)); c.HL(x + 1, y + h - 1, w - 1, K(m, t - 1))


def leg(c, x, y, h, m, t=0):
    """2px 다리: 왼 열 밝게, 오른 열 두 단 어둡게, 발끝 한 단 더."""
    c.VL(x, y, h, K(m, t)); c.VL(x + 1, y, h, K(m, t - 2)); c.P(x, y + h - 1, K(m, t - 1)); c.P(x + 1, y + h - 1, K(m, t - 3))


def ell(cx, cy, rx, ry, W=16, H=48):
    return {(x, y) for y in range(H) for x in range(W) if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}


def edge_of(S, x, y):
    return any((x + dx, y + dy) not in S for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def round_seat(c, cx, cy, rx, ry, side, m, t, olc):
    """둥근 방석: 아래로 side 행 두께 면(t-1, 오른쪽 t-2) + 윗면 타원(t, 왼위 t+1·t+2), 윤곽 olc 는 바깥에만."""
    top = ell(cx, cy, rx, ry)
    body = set(top)
    for (x, y) in top:
        for k in range(1, side + 1): body.add((x, y + k))
    for (x, y) in body:
        if (x, y) in top: continue
        c.P(x, y, K(m, t - 2) if x + .5 > cx + rx * .45 else K(m, t - 1))
    for (x, y) in top:
        d = (x + .5 - cx) / rx * .7 + (y + .5 - cy) / ry * .8
        c.P(x, y, K(m, t + 2) if d < -.75 else K(m, t + 1) if d < -.2 else K(m, t))
    for (x, y) in body:
        if edge_of(body, x, y): c.P(x, y, olc)
    for (x, y) in top:                                                          # 윗면 앞 가장자리 선(두께 면과 갈림)
        if (x, y + 1) not in top and (x, y + 1) in body and not edge_of(body, x, y): c.P(x, y, K(m, t + 1))


def round_base(c, cx, cy, rx, ry, m, t, olc):
    """둥근 받침: 윗면 밝게, 아래 반은 한 단 어둡게, 바깥 윤곽."""
    S = ell(cx, cy, rx, ry)
    for (x, y) in S:
        c.P(x, y, olc if edge_of(S, x, y) else (K(m, t + 1) if y + .5 < cy else K(m, t - 1)))


def silhouette(c, col, x0=0, y0=0, x1=None, y1=None):
    """바깥 윤곽: (x0,y0)~(x1,y1) 안의 불투명 화소 중 투명(또는 캔버스 밖)과 맞닿은 것을 col 로 — 안쪽 부품 사이에는 선을 긋지 않는다."""
    import numpy as np
    a = c.a; H, W = a.shape[:2]
    x1 = W if x1 is None else x1; y1 = H if y1 is None else y1
    op = a[:, :, 3] > 0
    hits = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not op[y, x]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H) or not op[yy, xx]: hits.append((x, y)); break
    for (x, y) in hits: c.P(x, y, col)


# ══ seats study 2 (사람 합격 2026-10-20) ══
# 정본 그림 = tiledata/seats34/study2/art/jp_city/<id>.png, 사람 판정 = tiledata/seats34/study2/human-verdicts.json(화소 해시에 묶임).
# 그림 코드 = scripts/content/jp-city/interior/seats_study2/. 사람 합격은 3/4 관문 영수증을 대신하지 않는다 —
# 굽는 캔버스 그림에 object-gate pass 영수증(kind seat, 보정된 프로필)이 있는 id 만 굽는 그림을 바꾼다. 없으면 옛 그림 그대로.
import json as _json, os as _os, sys as _sys
_REPO = _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', '..', '..'))
STUDY2 = _os.path.join(_REPO, 'tiledata', 'seats34', 'study2')


def study2_items(tileset='jp_city_interior'):
    p = _os.path.join(STUDY2, 'human-verdicts.json')
    if not _os.path.exists(p): return {}
    return {it['id']: it for it in _json.load(open(p, encoding='utf-8'))['items'] if it['tileset'] == tileset and it['verdict'] == 'pass'}


def study2_draw(id_):
    """합격 그림을 캔버스 왼아래에 그대로 놓는다(캔버스가 더 높으면 위가 빈다 — gy-kid-chair-n 16×16 → 16×32)."""
    import numpy as np
    from PIL import Image
    png = np.array(Image.open(_os.path.join(_REPO, study2_items()[id_]['png'])).convert('RGBA'))
    def f(c):
        H, W = c.a.shape[:2]; h, w = png.shape[:2]
        assert w <= W and h <= H, (id_, '합격 그림이 칸보다 크다')
        c.a[:] = 0; c.a[H - h:H, 0:w] = png
    return f


def study2_gate(img):
    """굽는 그림의 관문 상태: None = 통과, 아니면 이유."""
    _sys.path.insert(0, _os.path.join(_REPO, 'src', 'harnesses', '_core'))
    import object_gate as OG
    from PIL import Image
    im = Image.fromarray(img, 'RGBA')
    r = OG.read_receipt(OG.pixel_sha256(im))
    if not r: return '영수증 없음'
    if r.get('kind') != 'seat' or r.get('verdict') != 'pass': return '%s/%s' % (r.get('kind'), r.get('verdict'))
    return OG.refusal(im, kind='seat', context='bundle')


def apply_study2(R):
    """블록 R 의 앉는 기물 중 사람 합격 + 관문 pass 인 것만 그림을 바꾼다. 바꾼 id·보류 id 를 돌려준다."""
    done, held = [], []
    for id_ in study2_items():
        if id_ not in R.objs: continue
        old = R.objs[id_]['draw']; R.objs[id_]['draw'] = study2_draw(id_)
        why = study2_gate(R.obj_image(id_)[0])
        if why is None: done.append(id_)
        else: R.objs[id_]['draw'] = old; held.append((id_, why))
    return done, held
# ══ /seats study 2 ══
