#!/usr/bin/env python3
"""기물마다 외곽선을 정하는 규칙 — 검정 · 재료 자기 어두운 색 · 없음 중 하나를 그림과 놓일 바닥으로 고른다.

  python3 scripts/content/jp-city/interior/outline_rule.py --survey   # 대상 기물의 놓이는 바닥·벽 밝기를 다시 재서 표(outline-rule.json)를 쓴다
  python3 scripts/content/jp-city/interior/outline_rule.py --table    # 기물별 갈래·대비 표를 찍는다

규칙(위에서 먼저 걸리는 것이 이긴다):
  1 none     — 바닥에 깔리거나 벽에 붙은 납작한 것(kind flat 인 깔개·턱, 벽에 붙은 포스터·달력·액자). 외곽선 자리를 안쪽 재료색으로 메운다.
  2 light    — 테두리 재료가 아주 밝다(상대 휘도 중앙값 ≥ LIGHT). 재료 어두운 단은 바닥에 묻히므로 중간 회색 테(hodo 3단).
               밝은 바닥 위에서는 회색 테도 묻혀서, 놓이는 바닥·벽과 휘도 차가 RIM(0.15) 이상 날 때까지 hodo 를 한 단씩 내린다.
  3 small    — 1칸 이하·높이 20px 이하·쓰임이 있는 작은 물건(스위치·전화·작은 상자). 1배에서 읽히게 거의 검정.
  4 black    — 놓이는 바닥(키 큰 것은 뒤 벽 포함) 어느 하나와 테두리 재료 휘도 차가 T 미만. 팔레트에서 가장 어두운 무채색(sumi 0, #000 아님).
  5 material — 그 밖. 테두리 재료 램프의 가장 어두운 단.
선택 외곽선(selout): 위·왼쪽 테는 그 외곽선보다 한 단 밝게, 오른쪽은 외곽선 그대로, 바닥 닿는 맨 아랫줄은 늘 가장 어두운 무채색(물건을 앉힌다).

보정 기록(2026-10-20, 다섯 방 실측):
  · 「다섯 방의 바닥 전부」를 기대 바닥으로 쓰면 바닥 휘도가 0.014(게임센터 카펫)~0.716(급탕실 타일)에 걸쳐 모든 기물이 어딘가와 T 미만 → 전부 검정.
    그래서 기대 바닥은 그 기물이 실제로 놓인 예제 방(89장) 바닥·벽으로 좁히고, 어디에도 안 놓인 기물만 다섯 방 바닥 전부를 쓴다.
  · T 는 0.18 에서 시작해 0.05 로 내렸다: 0.18 이면 155종 중 66종이 검정, 재료 13종뿐이었다. 기물 테 재료의 가장 어두운 단(ita·tekko·kon 0단)은 상대 휘도 0.01~0.03 이라 바닥(0.08~0.72)과 이미 갈리므로, 검정이 꼭 필요한 것은 테 재료 자체가 바닥과 거의 같은 경우뿐이다(차 0.05 미만).
  · kind flat 이라도 대야·슬리퍼·신발은 바닥 위에 선 물건이라 none 에서 뺐다(STANDING_WORDS — 덮는 넓이로는 갈리지 않았다: 0.48~0.59 로 매트와 같다).
  · 어느 예제에도 안 놓인 기물은 다섯 방 바닥 전부 대신 같은 분류(categories.py) 형제들이 놓인 바닥·벽을 쓴다(다섯 방 전부면 최소 대비가 늘 0 근처).
  · LIGHT 는 0.55: 흰 가전·흰 카운터(shiro·conc 윗단) 테두리 중앙값이 0.58~0.90, 크림·밝은 나무·연회색 금속은 0.25~0.50 이라 재료 갈래로 둔다.
"""
import os, sys, json, re, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PAL = os.path.join(ROOT, 'tiledata', 'atlas-pick', 'palette', 'modern3.pal')
TABLE = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'outline-rule.json')
ROOMS5 = ('konbini', 'famires', 'office-floor', 'game-center', 'house-1f')

T = 0.05
LIGHT = 0.55
RIM = 0.15
STANDING_WORDS = ('대야', '슬리퍼', '신발', '바가지', '상자', '바구니', '쓰레기')
NONE_WORDS = ('포스터', '달력', '액자', '게시', '안내판', '메뉴판', '시간표', '표어', '족자', '지도판')

# 규칙을 쓰는 기물 = outline-rule.json 의 items(3/4 다시 그리기 83종 redraw83 + 다섯 예제 방의 의자·문 아닌 기물). --survey 가 다시 쓴다.

_R = {}
for ln in open(PAL, encoding='utf-8'):
    m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
    if m: _R[m.group(1)] = [int(h, 16) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
_OWN = {}
for _n, _r in _R.items():
    for _i, _c in enumerate(_r): _OWN.setdefault(_c, (_n, _i))


def _key(p): return (int(p[0]) << 16) | (int(p[1]) << 8) | int(p[2])
def _rgb(c): return ((c >> 16) & 255, (c >> 8) & 255, c & 255)
def _lum(p): return 0.299 * int(p[0]) + 0.587 * int(p[1]) + 0.114 * int(p[2])


def rl(p):
    """상대 휘도(sRGB 선형, 0~1)."""
    def f(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(int(p[0])) + 0.7152 * f(int(p[1])) + 0.0722 * f(int(p[2]))


INK = _rgb(_R['sumi'][0])                       # 가장 어두운 무채색(#100a1a)
INK_HI = _rgb(_R['sumi'][1])


def _ramp(p):
    return _OWN.get(_key(p))


def _darkest(p):
    o = _ramp(p)
    return (_rgb(_R[o[0]][0]), _rgb(_R[o[0]][1])) if o else (INK, INK_HI)


def edges(a):
    """테두리 외곽선 화소 [(x, y, fill, sides)] — 투명과 맞닿은 불투명 화소 가운데 안쪽 재료보다 확실히 어두운 것."""
    h, w = a.shape[:2]; op = a[..., 3] > 0
    def T_(x, y): return not (0 <= x < w and 0 <= y < h) or not op[y, x]
    out = []
    for y in range(h):
        for x in range(w):
            if not op[y, x]: continue
            tu, td, tl, tr = T_(x, y - 1), T_(x, y + 1), T_(x - 1, y), T_(x + 1, y)
            if not (tu or td or tl or tr): continue
            cand = []
            if tu and not T_(x, y + 1): cand.append((x, y + 1))
            if tl and not T_(x + 1, y): cand.append((x + 1, y))
            if tr and not T_(x - 1, y): cand.append((x - 1, y))
            if td and not T_(x, y - 1): cand.append((x, y - 1))
            if not cand: continue
            fx, fy = cand[0]; fill = a[fy, fx]
            if _lum(fill) < _lum(a[y, x]) + 20:                          # 안쪽도 테면 한 칸 더 안쪽
                nx, ny = fx + (fx - x), fy + (fy - y)
                if 0 <= nx < w and 0 <= ny < h and op[ny, nx]: fill = a[ny, nx]
            p = a[y, x]
            if not (_lum(p) <= _lum(fill) - 18 or _lum(p) < 46): continue
            out.append((x, y, tuple(int(v) for v in fill[:3]), (tu, td, tl, tr)))
    return out


def ring_rl(a, e=None):
    """테두리 재료 휘도 — 외곽선 화소 안쪽 재료의 상대 휘도 중앙값(바닥 닿는 줄 제외)."""
    e = edges(a) if e is None else e
    v = [rl(f) for x, y, f, s in e if not s[1]]
    if not v:
        v = [rl(f) for x, y, f, s in e]
    return float(np.median(v)) if v else 0.0


def is_none(meta, a=None):
    if meta.get('kind') == 'flat':                                   # 깔개·턱만 — 바닥에 놓인 작은 물건(대야·슬리퍼·신발)은 높이가 있어 아래 갈래로
        return not any(wd in meta.get('ko', '') for wd in STANDING_WORDS)
    if meta.get('kind') == 'hang':
        txt = (meta.get('ko', '') + ' ' + ' '.join(meta.get('tags', [])))
        return any(wd in txt for wd in NONE_WORDS)
    return False


def is_small(meta, a):
    if meta.get('w', 1) > 1 or meta.get('h', 1) > 1 or not meta.get('use'): return False
    ys = np.where((a[..., 3] > 0).any(axis=1))[0]
    return len(ys) > 0 and (ys[-1] - ys[0] + 1) <= 20


def classify(a, meta, surf):
    """→ (갈래, 최소 대비, 테두리 휘도). surf = 놓이는 바닥·벽 상대 휘도 목록."""
    e = edges(a); r = ring_rl(a, e)
    con = min((abs(r - s) for s in surf), default=1.0)
    if is_none(meta, a): return 'none', con, r
    if r >= LIGHT: return 'light', con, r
    if is_small(meta, a): return 'small', con, r
    if con < T: return 'black', con, r
    return 'material', con, r


def grey_for(surf):
    """밝은 물건의 회색 테 — hodo 3단(중간 회색)에서 시작해, 놓이는 바닥·벽 어느 것과도 휘도 차가 RIM 이상 날 때까지 한 단씩 내린다."""
    hodo = _R['hodo']
    for i in range(3, 0, -1):
        if all(abs(rl(_rgb(hodo[i])) - s) >= RIM for s in surf): return _rgb(hodo[i]), _rgb(hodo[i + 1])
    return _rgb(hodo[0]), _rgb(hodo[1])


def apply(a, branch, surf=()):
    """갈래대로 테두리 외곽선 화소를 다시 칠한다. 팔레트 밖 색은 만들지 않는다."""
    out = a.copy()
    grey = grey_for(surf)
    for x, y, fill, (tu, td, tl, tr) in edges(a):
        if branch == 'none':
            out[y, x, :3] = fill; continue
        if td:                                                       # 바닥 닿는 줄 — 늘 가장 어두운 무채색
            out[y, x, :3] = INK; continue
        if branch == 'material': lo, hi = _darkest(fill)
        elif branch == 'light': lo, hi = grey
        else: lo, hi = INK, INK_HI
        out[y, x, :3] = hi if (tu or tl) and not tr else lo
    return out


_TAB = None


def _table():
    global _TAB
    if _TAB is None:
        _TAB = json.load(open(TABLE, encoding='utf-8')) if os.path.exists(TABLE) else {'items': {}}
    return _TAB


def ruled(id_):
    return id_ in _table()['items']


def outline(a, id_, meta):
    """ikit.Registry.obj_image 가 부른다. 표에 없는 기물은 그대로."""
    it = _table()['items'].get(id_)
    mode = os.environ.get('OPRN_OUTLINE', 'rule')                   # 비교용: off(그린 그대로) · black · material
    if not it or mode == 'off': return a
    branch = mode if mode in ('black', 'material') else classify(a, meta, it['surf'])[0]
    return apply(a, branch, it['surf'])


# ───────── 표 다시 재기(--survey) ─────────
def _survey(ids):
    sys.path.insert(0, HERE)
    import preview
    lib = preview.Lib()
    def mean_rl(arr):
        m = arr[..., 3] > 0; px = arr[m][:, :3]
        return float(np.mean([rl(p) for p in px[::3]]))
    fl, wl = {}, {}
    def F(f):
        if f not in fl:
            r = lib.floor[f]; d = r.floors[f]; fl[f] = round(mean_rl(r._period(('f', f), d['draw'], d['cols'] * 16, d['rows'] * 16)), 3)
        return fl[f]
    def Wl(w):
        if w not in wl:
            r = lib.wall[w]; wl[w] = round(mean_rl(np.concatenate([r.wall_cell(w, x, row, 0) for x in range(2) for row in (1, 2)])), 3)
        return wl[w]
    used = {}
    exdir = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'examples')
    all5 = set()
    for fn in sorted(os.listdir(exdir)):
        if not fn.endswith('.json'): continue
        room = json.load(open(os.path.join(exdir, fn), encoding='utf-8'))
        if 'plan' not in room: continue
        def mat(x, y):
            f, w = room.get('floor'), room.get('wall')
            for z in room.get('zones', []):
                if z['x0'] <= x <= z['x1'] and z['y0'] <= y <= z['y1']: f, w = z.get('floor') or f, z.get('wall') or w
            return f, w
        if fn[:-5] in ROOMS5:
            all5.add(('f', room['floor'])); all5.add(('w', room['wall']))
            for z in room.get('zones', []):
                if z.get('floor'): all5.add(('f', z['floor']))
        for o in room.get('objects', []):
            f, w = mat(o['x'], o['y'])
            s = used.setdefault(o['id'], set())
            if f in lib.floor: s.add(('f', f))
            if w in lib.wall: s.add(('w', w))
    items = {}
    for id_ in ids:
        r = lib.obj.get(id_)
        if not r: continue
        d = r.objs[id_]
        tall = d['up'] >= 16 or d['kind'] in ('wall', 'hang')
        src = used.get(id_)
        if not src:                                                  # 어느 예제에도 안 놓였다 → 같은 분류 형제들이 놓인 바닥·벽
            import categories as CATS
            cat = CATS.BY_ID.get(id_)
            sib = [i for i, c in CATS.BY_ID.items() if c == cat and i in used] if cat else []
            src = set().union(*(used[i] for i in sib)) if sib else {x for x in all5 if x[0] == 'f'}
        surf = sorted({F(n) for k, n in src if k == 'f' and d['kind'] != 'hang'} | ({Wl(n) for k, n in src if k == 'w'} if tall else set()))
        if not surf: surf = sorted({F(n) for k, n in all5 if k == 'f'})
        items[id_] = dict(surf=surf, on=sorted('%s:%s' % x for x in src))
    return items


def _target_ids():
    sys.path.insert(0, HERE)
    import preview
    lib = preview.Lib()
    ids = list(json.load(open(TABLE, encoding='utf-8')).get('redraw83', [])) if os.path.exists(TABLE) else []
    exdir = os.path.join(ROOT, 'tiledata', 'jp-city', 'interior', 'examples')
    for rn in ROOMS5:
        for o in json.load(open(os.path.join(exdir, rn + '.json'), encoding='utf-8')).get('objects', []):
            r = lib.obj.get(o['id'])
            if not r: continue
            d = r.objs[o['id']]
            if d['kind'] in ('door', 'sidedoor') or '문' in d['tags'] or 'sit' in d['use']: continue
            if o['id'] not in ids: ids.append(o['id'])
    return ids


if __name__ == '__main__':
    if '--survey' in sys.argv:
        old = json.load(open(TABLE, encoding='utf-8')) if os.path.exists(TABLE) else {}
        ids = _target_ids()
        tab = dict(note='outline_rule.py --survey 가 쓴다. items = 규칙을 쓰는 기물과 놓이는 바닥·벽 상대 휘도. redraw83 = 3/4 다시 그리기 83종.',
                   T=T, LIGHT=LIGHT, redraw83=old.get('redraw83', []), items=_survey(ids))
        json.dump(tab, open(TABLE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('%s · 기물 %d' % (TABLE, len(tab['items'])))
    if '--table' in sys.argv:
        sys.path.insert(0, HERE)
        import preview
        lib = preview.Lib(); _TAB = None
        for id_, it in _table()['items'].items():
            r = lib.obj[id_]; d = r.objs[id_]
            a = r._canvas(d['draw'], d['w'] * 16, (2 if d['kind'] == 'door' else d['hrows'] if d['kind'] == 'hang' else math.ceil(d['up'] / 16) + d['h']) * 16)
            b, con, ring = classify(a, d, it['surf'])
            print('%-24s %-8s 대비 %.3f 테 %.3f  %s' % (id_, b, con, ring, ','.join(it['on'])))
