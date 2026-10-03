"""윗면+앞면 슬래브 방식 선형 조각(블록담·생울타리). 3/4 시점: 가로 방향은 윗면(뒤)+앞면(남쪽 정면)이 보이고,
세로 방향은 위에서 본 띠(윗면)만 보이며 남쪽 끝에서만 기둥 앞면이 보인다.
한 칸 안에서: 가로 막대 윗면 rows ty0..ty1, 앞면 rows ty1+1..fy1 · 세로 띠 윗면 x sx0..sx1(칸 위아래로 이웃과 이어짐) · 기둥(선택)."""
from .core import *

class Spec:
    def __init__(s, ty0=2, ty1=5, fy1=13, sx0=5, sx1=10, pillar=None, top_prof=None, side_prof=None):
        s.ty0, s.ty1, s.fy1, s.sx0, s.sx1 = ty0, ty1, fy1, sx0, sx1
        s.pillar = pillar                # dict(x0,x1,ty0,ty1,fy1) 또는 None
        s.top_prof = top_prof            # callable(x) -> 윗변을 아래로 깎는 px (월드 좌표 x, 주기 8)
        s.side_prof = side_prof          # callable(y) -> (왼쪽 깎기, 오른쪽 깎기)

def roles_for(mask, sp):
    r = Roles()
    n, e, s_, w = has(mask, N_), has(mask, E_), has(mask, S_), has(mask, W_)
    straight = (mask in (5, 10))
    tp = sp.top_prof or (lambda x: 0)
    spf = sp.side_prof or (lambda y: (0, 0))
    # 1) 가로 막대 (뒤)
    if e or w:
        x0 = -PAD if w else sp.sx0
        x1 = 15 + PAD if e else sp.sx1
        for x in range(x0, x1 + 1):
            ty0 = sp.ty0 + tp(x)
            for y in range(ty0, sp.ty1 + 1):
                dl, dr = spf(y)
                if (not w and x < sp.sx0 + dl) or (not e and x > sp.sx1 - dr): continue
                r.put(x, y, 1)
            for y in range(sp.ty1 + 1, sp.fy1 + 1):
                dl, dr = spf(y)
                if (not w and x < sp.sx0 + dl) or (not e and x > sp.sx1 - dr): continue
                r.put(x, y, 2)
    # 2) 세로 띠 위쪽(북쪽 이웃과 이어짐 · 기둥 뒤)
    if n or (not (e or w or s_)):
        y0 = -PAD if n else sp.ty0
        for y in range(y0, sp.ty1 + 1):
            dl, dr = spf(y)
            for x in range(sp.sx0 + dl, sp.sx1 - dr + 1):
                ty0 = sp.ty0 + tp(x) if (not n) else -99
                if y >= ty0: r.put(x, y, 1)
        if (not (e or w or s_)) and (not n or not sp.pillar):   # 외딴·북 연결 끝(기둥 없는 종류): 띠 끝 앞면
            for y in range(sp.ty1 + 1, sp.fy1 + 1):
                dl, dr = spf(y)
                for x in range(sp.sx0 + dl, sp.sx1 - dr + 1): r.put(x, y, 2)
    elif s_ and not (e or w):                             # 북 끝(남쪽으로만 이어짐): 띠 머리
        for y in range(sp.ty0, sp.ty1 + 1):
            dl, dr = spf(y)
            for x in range(sp.sx0 + dl, sp.sx1 - dr + 1):
                if y >= sp.ty0 + tp(x): r.put(x, y, 1)
    # 3) 기둥 (모서리·끝·T·십자·외딴)
    if sp.pillar and not straight:
        pl = sp.pillar
        for y in range(pl['ty0'], pl['ty1'] + 1):
            for x in range(pl['x0'], pl['x1'] + 1): r.put(x, y, 3)
        for y in range(pl['ty1'] + 1, pl['fy1'] + 1):
            for x in range(pl['x0'], pl['x1'] + 1): r.put(x, y, 4)
    # 4) 세로 띠 아래쪽(남쪽으로 이어짐: 관측자 쪽 = 앞)
    if s_:
        for y in range(sp.ty1 + 1, 15 + PAD + 1):
            dl, dr = spf(y)
            for x in range(sp.sx0 + dl, sp.sx1 - dr + 1): r.put(x, y, 1)
    despur(r)
    return r

def despur(r):
    """실루엣에서 삐져나온 외톨이 화소(이웃 1개 이하)를 지운다 — 생울타리 끝의 깎기 때문에 생긴 1px 가시."""
    for _ in range(2):
        kill = []
        for y in range(-PAD + 1, 16 + PAD - 1):
            for x in range(-PAD + 1, 16 + PAD - 1):
                if r.at(x, y) in (1, 2):
                    n = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if r.at(x + dx, y + dy))
                    if n <= 1: kill.append((x, y))
        for x, y in kill: r.put(x, y, 0)
