"""조립 순서를 적는 작은 도우미 — 덩어리를 놓고, 붙는 것을 «그 덩어리의 몇 층 · 지붕 · 땅» 에 견주어 놓는다(좌표를 손으로 더하지 않으려고).
B(칸 폭, 칸 높이) 로 집을 열고 e/g/f/w/r 로 덩어리를 놓으면 V 가 돌아온다. V.at(부품, dx, 층, lift) · V.roof(부품, dx, dy) · V.gable(부품, …) · V.ground(부품, dx) · B.add(부품, x, 밑 y)."""
T = 16


class V:
    def __init__(s, b, v): s.b, s.v = b, v
    @property
    def base(s): return s.v.get('base', s.b.H - 2)
    def band(s, i):
        """i 층 벽의 (윗줄, 밑줄 다음 줄) — 0 이 아래층, -1 이 맨 위층."""
        fl = s.v['floors']; i = i % len(fl); y = s.base
        for j, (_, fh) in enumerate(fl):
            if j == i: return y - fh, y
            y -= fh
    @property
    def top(s): return s.base - (s.v['wh'] if s.v['k'] == 'r' else sum(fh for _, fh in s.v['floors']))
    def at(s, part, dx, floor=-1, lift=5, **o):
        """벽에 붙는 것(창 …): 그 층 벽 밑줄에서 lift px 위가 부품 밑."""
        y1 = s.base if s.v['k'] == 'r' else s.band(floor)[1]
        s.v['feats'].append((part, s.v['x'] + dx, y1 - lift) + ((o,) if o else ())); return s
    def roof(s, part, dx, dy, **o):
        """지붕에 얹는 것(굴뚝·지붕창): 처마 정면은 지붕 윗줄에서, 박공 정면·평지붕은 벽 윗줄에서 dy px 아래가 부품 밑."""
        v = s.v; y0 = s.top - v['rh'] + 3 if v['k'] == 'e' else s.top - v['th'] if v['k'] == 'f' else s.top - v.get('rise', 0) - v.get('rd', 0) + 2
        v['feats'].append((part, v['x'] + dx, y0 + dy) + ((o,) if o else ())); return s
    def gable(s, part='win-attic', pw=10, up=3, dx=0, **o):
        """박공벽 가운데의 다락창: 벽 윗줄에서 up px 위가 부품 밑."""
        s.v['feats'].append((part, s.v['x'] + s.v['w'] // 2 - pw // 2 + dx, s.top - up) + ((o,) if o else ())); return s
    def ground(s, part, dx, **o):
        """벽 밑동에 선 것(장작·통·좌판): 부품 밑이 땅 줄."""
        s.v['feats'].append((part, s.v['x'] + dx, s.base + 2) + ((o,) if o else ())); return s


class B:
    def __init__(s, w, h, **kw): s.w, s.h, s.H, s.vols, s.feats, s.kw = w, h, h * T, [], [], kw
    def _v(s, v): v.setdefault('feats', []); s.vols.append(v); return V(s, v)
    def e(s, x, w, floors, rh, **k): return s._v(dict(k='e', x=x, w=w, floors=floors, rh=rh, **k))
    def g(s, x, w, floors, rd, rise, **k): return s._v(dict(k='g', x=x, w=w, floors=floors, rd=rd, rise=rise, **k))
    def f(s, x, w, floors, th, **k): return s._v(dict(k='f', x=x, w=w, floors=floors, th=th, **k))
    def wall(s, x, w, floors, **k): return s._v(dict(k='w', x=x, w=w, floors=floors, **k))
    def r(s, x, w, wh, cone, **k): return s._v(dict(k='r', x=x, w=w, wh=wh, cone=cone, floors=[], **k))
    def add(s, part, x, yb, **o): s.feats.append((part, x, yb) + ((o,) if o else ())); return s
    def over(s, part, x, yb): s.kw.setdefault('over', []).append((part, x, yb)); return s
    def done(s): return dict(w=s.w, h=s.h, vols=s.vols, feats=s.feats, **s.kw)
