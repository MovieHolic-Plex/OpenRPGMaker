#!/usr/bin/env python3
"""일본 세트 「조립형 킷」 조립기. 정의 = tiledata/atlas-pick/kits-jp.json, 절차 = tiledata/atlas-pick/WORKER-JP-KIT.md.

후보 하나 = 킷 부품 전부를 한 장에 찍은 부품 시트(candidates-jp/<킷>/<작업자>-<방향>.pxg, 예 k1-A.pxg).
부품 자리는 킷 정의 순서대로 선반 채우기(common.kit_pack) — `prepare` 가 info.json·slots.txt·guide.png 로 적는다.

  python3 scripts/content/atlas-pick/jp_kit_compose.py prepare                 # 킷 폴더 준비(info.json·palette.pal·slots.txt·guide.png). 후보 파일은 안 건드린다
  python3 scripts/content/atlas-pick/jp_kit_compose.py tiledata/atlas-pick/candidates-jp/kit_shopfront/k2-A.pxg [...]
                                                                               # 검사(check_candidate) + 조립 → 산출물
  python3 scripts/content/atlas-pick/jp_kit_compose.py --kit kit_shopfront     # 그 킷 후보 전부
  python3 scripts/content/atlas-pick/jp_kit_compose.py --all                   # 모든 킷 후보(다른 킷을 빌려 쓰는 조립 예를 새로 굽을 때)
  python3 scripts/content/atlas-pick/jp_kit_compose.py --worker k2             # 그 작업자 후보 전부

산출물(후보 이름 = k2-A 일 때, 킷 폴더 안):
  k2-A.png · -x4.png · .txt · .check.json   check_candidate 가 만든 시트 렌더·검사
  k2-A.parts.png                           부품 낱장(4배, 이름표)
  k2-A.ex-<예>.png                         조립 예 원 크기(바탕 없음)
  k2-A.ctx-<예>.png                        조립 예를 거리·바닥 위에 놓은 맥락(원 크기)
  k2-A.walk-<예>.png                       맥락 + 통행 표시(빨강 막힘 · 파랑 드나드는 칸 · 노랑 점 사람 위 · 초록 THROUGH 길)
  k2-A.seams.png                           이음 검사(반복 부품을 세 번 이어 붙인 4배 띠 + 튀는 이음)
  k2-A.board.png                           작업자 눈 검사용 한 장(모든 예 맥락·통행 3배 + 이음 띠)
  k2-A.kit.json                            조립 결과·오류 코드(화면이 읽는다)

설계도 문법은 kits-jp.json "grammar". 오류 코드(hard = 화면에 빨갛게):
  REF         설계도가 모르는 부품·킷을 부른다
  ROW_WIDTH   한 층의 줄마다 낱말 수가 다르다
  COVER       여러 칸 부품이 덮는 칸이 '+' 가 아니거나, '+' 인데 덮는 부품이 없다
  JOIN        부품의 left/right 이음 규칙을 어긴 이웃
  DOOR_REACH  드나드는 칸(door 부품의 F 칸)에 거리에서 걸어서 못 닿는다
  THROUGH     through='ns' 인 예에서 위 → 아래로 걸어서 못 지나간다(개찰구·도리이·건널목)
  PART_EMPTY  시트의 부품 자리가 비었다
  PART_HOLES  facade·ground 부품에 투명 화소(불투명이어야 한다)
  BORROW      다른 킷 부품을 빌리려는데 그 킷 후보가 아직 없다(회색 빗금으로 대신 그림 — 경고)
참고(warn): SEAM 반복·이웃 이음 경계가 부품 속보다 크게 튄다(점수 = 경계 차 / 부품 속 이웃 열 차), PART_OPAQUE 투명 층 부품이 꽉 찼다, DOOR_FRONT 문 바로 아래 칸이 막혔다.
"""
import argparse, collections, fnmatch, glob, json, os, shutil, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
sys.path.insert(0, PXGRID)

SET = 'jp'
T = 16
PAVE, ASPH = 3076, 3136
LAYER_ORDER = ('ground', 'main', 'upper')
SEAM_SCORE, SEAM_MIN = 1.3, 20.0   # 경계 차가 부품 속 가장 큰 열 사이 차의 1.3배를 넘고 20 이상이면 「튄다」
FONT = None

def font(sz=12):
    global FONT
    for f in ('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'):
        if os.path.exists(f):
            try: return ImageFont.truetype(f, sz)
            except OSError: pass
    return ImageFont.load_default()

def kits():
    kd = kits_def(SET) or {'kits': []}
    return kd, {k['slug']: kit_item(SET, k, kd) for k in kd['kits']}

def kit_dir(slug): return os.path.join(cand_dir(SET), slug)

# ── 킷 폴더 준비 ──
def prepare():
    kd, K = kits()
    for s, it in K.items():
        d = kit_dir(s); os.makedirs(d, exist_ok=True)
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n')
        shutil.copyfile(os.path.join(PAL_DIR, 'jp.pal'), os.path.join(d, 'palette.pal'))
        lines = [f'// {s} 부품 시트 {it["canvas"][0]}x{it["canvas"][1]}px ({it["cells"][0]}×{it["cells"][1]}칸). 부품 = 칸 자리(x y 는 px, 좌상단).',
                 '// slug  x  y  w  h  층  반복  통행  이름']
        for p in it['parts']:
            (cx, cy), (w, h) = p['at'], p['cells']
            wk = p['walk'] if isinstance(p['walk'], str) else '/'.join(p['walk'])
            lines.append(f'{p["slug"]:<16} {cx*T:>4} {cy*T:>4} {w*T:>3} {h*T:>3}  {p["layer"]:<7} {str(p.get("repeat") or "-"):<3} {wk:<5} {p["name"]}')
        atomic_write(os.path.join(d, 'slots.txt'), '\n'.join(lines) + '\n')
        guide(it).save(os.path.join(d, 'guide.png'))
        print(s, it['cells'], '부품', len(it['parts']), '예', len(it['examples']), '→', os.path.relpath(d, ROOT))

LAYER_TINT = {'facade': (120, 96, 70), 'ground': (70, 100, 70), 'object': (60, 80, 120), 'wall': (110, 70, 110), 'over': (120, 110, 50), 'decal': (70, 110, 110)}
def guide(it, k=4):
    W, H = it['canvas']; im = Image.new('RGBA', (W * k, H * k), (40, 36, 44, 255)); d = ImageDraw.Draw(im); f = font(11)
    for p in it['parts']:
        (cx, cy), (w, h) = p['at'], p['cells']
        x0, y0, x1, y1 = cx * T * k, cy * T * k, (cx + w) * T * k - 1, (cy + h) * T * k - 1
        d.rectangle([x0, y0, x1, y1], fill=LAYER_TINT.get(p['layer'], (90, 90, 90)) + (255,), outline=(230, 220, 200, 255))
        for yy in range(1, h): d.line([x0, y0 + yy * T * k, x1, y0 + yy * T * k], fill=(200, 190, 170, 120))
        d.text((x0 + 3, y0 + 3), p['slug'], fill=(255, 255, 255, 255), font=f)
        d.text((x0 + 3, y0 + 17), f'{w}x{h} {p["layer"]}', fill=(230, 230, 200, 255), font=f)
        d.text((x0 + 3, y0 + 31), 'rep ' + str(p.get('repeat') or '-'), fill=(230, 230, 200, 255), font=f)
    return im

# ── 시트 → 부품 ──
def sheet_png(pxg):
    png = pxg[:-4] + '.png'
    if not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(pxg):
        import pxgrid; pxgrid.render(pxg, png)
    return Image.open(png).convert('RGBA')

def slice_parts(it, sheet):
    out = {}
    for p in it['parts']:
        (cx, cy), (w, h) = p['at'], p['cells']
        out[p['slug']] = sheet.crop((cx * T, cy * T, (cx + w) * T, (cy + h) * T))
    return out

def cand_name(pxg): return os.path.basename(pxg)[:-4]

def pick_for(kit_slug, direction, exclude=None):
    """다른 킷 부품을 빌릴 후보: 사용자가 고른 것 → 같은 방향 글자 → pilot → 아무거나."""
    fs = sorted(glob.glob(os.path.join(kit_dir(kit_slug), '*.pxg')))
    fs = [f for f in fs if WORKER_RE.match(os.path.basename(f)) and f != exclude]
    if not fs: return None
    try:
        import picks_db
        ch = (picks_db.current_all(None, SET).get(kit_slug) or {}).get('choice')
        for f in fs:
            if cand_name(f) == ch: return f
    except Exception:
        pass
    same = [f for f in fs if cand_name(f).endswith('-' + direction) and not cand_name(f).startswith('pilot')]
    return (same or [f for f in fs if cand_name(f).startswith('pilot')] or fs)[0]

# ── 설계도 ──
class Inst:
    def __init__(s, layer, kit, slug, x, y, w, h, img, part, mirror):
        s.layer, s.kit, s.slug, s.x, s.y, s.w, s.h, s.img, s.part, s.mirror = layer, kit, slug, x, y, w, h, img, part, mirror

def walk_of(part, dx, dy):
    wk = part.get('walk', 'X')
    if isinstance(wk, str): return wk[0] if wk else 'X'
    row = wk[min(dy, len(wk) - 1)]
    return row[min(dx, len(row) - 1)]

def parse_example(it, ex, parts, borrow, errs, warns):
    """→ (W, H, instances[], ctx_tiles{(x,y): tile})"""
    aliases = it.get('aliases', {})
    layers = ex.get('layers') or {'main': ex.get('grid', [])}
    rows = {ln: [r.split() for r in layers[ln]] for ln in LAYER_ORDER if ln in layers}
    W = max((len(r) for g in rows.values() for r in g), default=0); H = max((len(g) for g in rows.values()), default=0)
    insts, ctx = [], {}
    for ln, g in rows.items():
        for y, r in enumerate(g):
            if len(r) != W: errs.append(['ROW_WIDTH', 0, y, f'{ln} 층 {y}번 줄 낱말 {len(r)}개 ≠ {W}'])
        cover = {}
        for y, r in enumerate(g):
            for x, tok in enumerate(r):
                if tok in ('.', '+'): continue
                if tok.startswith('='):
                    t = {'=pave': PAVE, '=asph': ASPH}.get(tok)
                    if t is None: errs.append(['REF', x, y, f'모르는 바탕 {tok}'])
                    else: ctx[(x, y)] = t
                    continue
                mirror = tok.endswith('!'); tok = tok.rstrip('!')
                kit = it['slug']
                if ':' in tok:
                    a, tok = tok.split(':', 1); kit = aliases.get(a, a)
                if kit == it['slug']:
                    src = parts; pdef = {p['slug']: p for p in it['parts']}
                else:
                    if kit not in borrow:
                        errs.append(['REF', x, y, f'모르는 킷 {kit}']); continue
                    src, pdef = borrow[kit]
                if tok not in pdef:
                    errs.append(['REF', x, y, f'{kit} 에 부품 {tok} 없음']); continue
                p = pdef[tok]; w, h = p['cells']
                img = src.get(tok) if src else None
                if img is None:
                    img = hatch(w, h)
                img = img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img
                insts.append(Inst(ln, kit, tok, x, y, w, h, img, p, mirror))
                for dy in range(h):
                    for dx in range(w):
                        X, Y = x + dx, y + dy
                        if (dx or dy):
                            if Y >= len(g) or X >= len(g[Y]) or g[Y][X] != '+':
                                errs.append(['COVER', X, Y, f'{tok}({w}×{h}) 가 덮는 칸이 + 가 아니다']); continue
                        if (X, Y) in cover: errs.append(['COVER', X, Y, f'{tok} 와 {cover[(X, Y)]} 가 겹친다'])
                        cover[(X, Y)] = tok
        for y, r in enumerate(g):
            for x, tok in enumerate(r):
                if tok == '+' and (x, y) not in cover: errs.append(['COVER', x, y, f'{ln} 층 + 인데 덮는 부품이 없다'])
    return W, H, insts, ctx

def hatch(w, h):
    a = np.zeros((h * T, w * T, 4), np.uint8)
    for y in range(h * T):
        for x in range(w * T):
            a[y, x] = (120, 120, 120, 200) if (x + y) % 6 < 2 else (70, 70, 70, 160)
    return Image.fromarray(a)

_SH = None
def tile_img(t):
    global _SH
    if _SH is None: _SH = Image.open(MODERN_SHEET).convert('RGBA')
    return _SH.crop(((t % 30) * T, (t // 30) * T, (t % 30) * T + T, (t // 30) * T + T))

def margins(ctx):
    return {'street': (1, 0, 1, 4), 'floor': (1, 1, 1, 1), 'none': (0, 0, 0, 0)}.get(ctx or 'street', (1, 0, 1, 4))   # 왼·위·오른·아래 칸

def compose(it, ex, parts, borrow, cand):
    errs, warns = [], []
    W, H, insts, ctxt = parse_example(it, ex, parts, borrow, errs, warns)
    ml, mt, mr, mb = margins(ex.get('ctx'))
    CW, CH = W + ml + mr, H + mt + mb
    # 바닥: 보도 전부, street 면 아래 두 줄 차도, 설계도의 =pave/=asph
    bg = Image.new('RGBA', (CW * T, CH * T)); tiles = {}
    for y in range(CH):
        for x in range(CW):
            t = ASPH if (ex.get('ctx', 'street') == 'street' and y >= CH - 2) else PAVE
            tiles[(x, y)] = t
    for (x, y), t in ctxt.items(): tiles[(x + ml, y + mt)] = t
    for (x, y), t in tiles.items(): bg.paste(tile_img(t), (x * T, y * T))
    exim = Image.new('RGBA', (W * T, H * T))
    for ln in LAYER_ORDER:
        for i in insts:
            if i.layer == ln: exim.alpha_composite(i.img, (i.x * T, i.y * T))
    ctx = bg.copy(); ctx.alpha_composite(exim, (ml * T, mt * T))
    # 통행: X 가 하나라도 있으면 막힘, 아니면 걸음. door = door 부품의 F 칸
    walk = [['.'] * CW for _ in range(CH)]; door = set(); over = set()
    for i in insts:
        for dy in range(i.h):
            for dx in range(i.w):
                c = walk_of(i.part, (i.w - 1 - dx) if i.mirror else dx, dy); X, Y = i.x + dx + ml, i.y + dy + mt
                if c == 'X': walk[Y][X] = 'X'
                elif c == 'F' and walk[Y][X] != 'X':
                    walk[Y][X] = 'F'
                    if i.part.get('door'): door.add((X, Y))
                elif c == 'C': over.add((X, Y))
    for y, r in enumerate(ex.get('walk') or []):
        for x, c in enumerate(r):
            if c != ' ' and 0 <= y < H and 0 <= x < W: walk[y + mt][x + ml] = c if c in 'XF' else '.'
    ok = lambda x, y: 0 <= x < CW and 0 <= y < CH and walk[y][x] != 'X'
    def bfs(srcs, allow=None):
        seen = {s: None for s in srcs if ok(*s)}; q = collections.deque(seen)
        while q:
            x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if ok(nx, ny) and (nx, ny) not in seen and (allow is None or allow(nx, ny)): seen[(nx, ny)] = (x, y); q.append((nx, ny))
        return seen
    border = [(x, y) for x in range(CW) for y in range(CH) if x in (0, CW - 1) or y in (0, CH - 1)]
    reach = bfs(border)
    for (x, y) in sorted(door):
        if (x, y) not in reach: errs.append(['DOOR_REACH', x - ml, y - mt, '드나드는 칸에 거리에서 못 닿는다'])
        elif not ok(x, y + 1): warns.append(['DOOR_FRONT', x - ml, y - mt, '문 바로 아래 칸이 막혔다'])
    path = []
    if ex.get('through') == 'ns':
        inside = lambda x, y: ml <= x < ml + W
        seen = bfs([(x, 0) for x in range(ml, ml + W)], inside)
        end = [(x, CH - 1) for x in range(ml, ml + W) if (x, CH - 1) in seen]
        if not end: errs.append(['THROUGH', 0, 0, '위 가장자리에서 아래 가장자리로 걸어서 못 지나간다'])
        else:
            c = end[len(end) // 2]
            while c is not None: path.append(c); c = seen[c]
    # 이음 규칙(left/right)
    grid = {}
    for i in insts:
        for dy in range(i.h):
            for dx in range(i.w): grid[(i.layer, i.x + dx, i.y + dy)] = i
    for i in insts:
        for side, dxx in (('left', -1), ('right', 1)):
            pats = i.part.get(side)
            if not pats: continue
            xs = i.x - 1 if dxx < 0 else i.x + i.w
            for dy in range(i.h):
                n = grid.get((i.layer, xs, i.y + dy)); name = n.slug if n else '|'
                if not any(fnmatch.fnmatch(name, p) for p in pats):
                    errs.append(['JOIN', i.x, i.y + dy, f'{i.slug} 의 {"왼" if dxx < 0 else "오른"}쪽에 {name} — 허용 {pats}']); break
    # 이웃 이음(서로 다른 부품 경계)
    seams = []
    for ln in LAYER_ORDER:
        L = Image.new('RGBA', (W * T, H * T))
        for i in insts:
            if i.layer == ln: L.alpha_composite(i.img, (i.x * T, i.y * T))
        a = np.array(L)
        for (lnn, x, y), i in grid.items():
            if lnn != ln: continue
            for nx, ny, axis in ((x + 1, y, 'x'), (x, y + 1, 'y')):
                n = grid.get((ln, nx, ny))
                if n is None or n is i: continue
                A = a[y * T:(y + 1) * T, x * T:(x + 1) * T]; B = a[ny * T:(ny + 1) * T, nx * T:(nx + 1) * T]
                if n.slug != i.slug or n.kit != i.kit: continue   # 다른 부품끼리의 경계는 원래 다르다(끝 마감·간판 테) — 같은 부품을 이은 자리만 본다
                sc, d = seam_score(A, B, axis)
                if sc > SEAM_SCORE and d > SEAM_MIN:
                    seams.append(dict(a=i.slug, b=n.slug, axis=axis, x=x, y=y, score=round(sc, 2), d=round(d, 1)))
    return dict(W=W, H=H, margins=[ml, mt, mr, mb], errs=errs, warns=warns, walk=walk, door=door, over=over, path=path, seams=seams), exim, ctx

def seam_score(A, B, axis):
    """A 의 오른(아래) 가장자리 한 줄과 B 의 왼(위) 가장자리 한 줄 차 / 두 칸 속 이웃 줄 차. 투명·불투명이 갈리면 255 차."""
    A = A.astype(np.float32); B = B.astype(np.float32)
    if axis == 'y': A = A.transpose(1, 0, 2); B = B.transpose(1, 0, 2)
    def diff(p, q):
        pa, qa = p[..., 3] > 0, q[..., 3] > 0
        dd = np.abs(p[..., :3] - q[..., :3]).max(-1)
        dd = np.where(pa & qa, dd, np.where(pa ^ qa, 255.0, np.nan))
        return dd
    import warnings; warnings.filterwarnings('ignore')
    edge = diff(A[:, -1], B[:, 0])
    if np.all(np.isnan(edge)): return 0.0, 0.0
    # 부품 속 열 사이(줄무늬·틀 같은 뜻있는 이음 포함) 가운데 가장 큰 것과 견준다 — 경계가 그보다 크면 이어 붙인 자리가 보인다
    inner = [np.nanmean(diff(X[:, k], X[:, k + 1])) for X in (A, B) for k in range(T - 1)]
    inner = [v for v in inner if not np.isnan(v)]
    d = float(np.nanmean(edge)); m = max(inner) if inner else 0.0
    return d / max(m, 6.0), d

def repeat_seams(it, parts):
    """반복 부품을 세 번 이어 붙였을 때 경계 점수. → [(slug, axis, score, d, strip RGBA)]"""
    out = []
    for p in it['parts']:
        rep = p.get('repeat') or ''
        img = parts.get(p['slug'])
        if img is None: continue
        for axis in ('x', 'y'):
            if axis not in rep: continue
            w, h = img.size
            strip = Image.new('RGBA', (w * 3, h) if axis == 'x' else (w, h * 3))
            for k in range(3): strip.alpha_composite(img, (k * w, 0) if axis == 'x' else (0, k * h))
            a = np.array(img)
            if axis == 'x': sc = max(seam_score(a[r * T:(r + 1) * T, -T:], a[r * T:(r + 1) * T, :T], 'x') for r in range(h // T))
            else: sc = max(seam_score(a[-T:, c * T:(c + 1) * T], a[:T, c * T:(c + 1) * T], 'y') for c in range(w // T))
            out.append((p['slug'], axis, sc[0], sc[1], strip))
    return out

def walk_img(ctx, R):
    im = ctx.copy(); ov = Image.new('RGBA', im.size); d = ImageDraw.Draw(ov)
    for y, r in enumerate(R['walk']):
        for x, c in enumerate(r):
            x0, y0 = x * T, y * T
            if c == 'X': d.rectangle([x0, y0, x0 + T - 1, y0 + T - 1], fill=(220, 40, 40, 90))
            elif (x, y) in R['over']: d.rectangle([x0 + 7, y0 + 7, x0 + 8, y0 + 8], fill=(250, 220, 60, 230))
    for (x, y) in R['door']: d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(60, 160, 255, 255))
    for (x, y) in R['path']: d.rectangle([x * T + 5, y * T + 5, x * T + 10, y * T + 10], fill=(60, 220, 90, 230))
    im.alpha_composite(ov); return im

def part_issues(it, parts):
    hard, warn = [], []
    for p in it['parts']:
        a = np.array(parts[p['slug']])
        if not (a[..., 3] > 0).any(): hard.append(f'PART_EMPTY: {p["slug"]} 자리(시트 {p["at"][0]*T},{p["at"][1]*T})가 비었다'); continue
        if p['layer'] in ('facade', 'ground') and (a[..., 3] < 255).any():
            hard.append(f'PART_HOLES: {p["slug"]}({p["layer"]}) 투명 화소 {int((a[..., 3] < 255).sum())}개 — 불투명이어야 한다')
        if p['layer'] not in ('facade', 'ground') and (a[..., 3] == 255).all():
            warn.append(f'PART_OPAQUE: {p["slug"]}({p["layer"]}) 칸이 꽉 찼다 — 투명 배경 층')
    return hard, warn

def parts_img(it, parts, k=4):
    f = font(12); pad = 18
    cols = 6; boxes = []
    for p in it['parts']:
        im = parts[p['slug']]; boxes.append((p, im.resize((im.width * k, im.height * k), Image.NEAREST)))
    cw = max(b.width for _, b in boxes) + 16; rows = [boxes[i:i + cols] for i in range(0, len(boxes), cols)]
    rh = [max(b.height for _, b in r) + pad + 10 for r in rows]
    out = Image.new('RGBA', (cw * min(cols, len(boxes)), sum(rh)), (40, 36, 44, 255)); d = ImageDraw.Draw(out); y = 0
    for r, h in zip(rows, rh):
        for c, (p, b) in enumerate(r):
            x = c * cw + 8; d.text((x, y + 2), f'{p["slug"]} · {p["name"]}', fill=(235, 225, 210, 255), font=f)
            out.paste((60, 54, 64, 255), (x, y + pad, x + b.width, y + pad + b.height)); out.alpha_composite(b, (x, y + pad))
        y += h
    return out

def seams_img(rs, k=4):
    f = font(12); pad = 18
    if not rs: return Image.new('RGBA', (320, 30), (40, 36, 44, 255))
    tiles = []
    for slug, axis, sc, d, strip in rs:
        tiles.append((f'{slug} {axis}×3  점수 {sc:.1f}', strip.resize((strip.width * k, strip.height * k), Image.NEAREST), sc > SEAM_SCORE and d > SEAM_MIN))
    W = max(max(t[1].width for t in tiles) + 16, 320); H = sum(t[1].height + pad + 8 for t in tiles)
    out = Image.new('RGBA', (W, H), (40, 36, 44, 255)); dr = ImageDraw.Draw(out); y = 0
    for lab, im, bad in tiles:
        dr.text((8, y + 2), lab + ('  ← 이음이 튄다' if bad else ''), fill=(240, 110, 90, 255) if bad else (200, 200, 190, 255), font=f)
        out.paste((60, 54, 64, 255), (8, y + pad, 8 + im.width, y + pad + im.height)); out.alpha_composite(im, (8, y + pad))
        if bad: dr.rectangle([6, y + pad - 2, 9 + im.width, y + pad + im.height + 1], outline=(240, 80, 60, 255))
        y += im.height + pad + 8
    return out

def board(title, exs, seams, k=3):
    f = font(14); blocks = []
    for ex, ctx, wimg, R in exs:
        a = ctx.resize((ctx.width * k, ctx.height * k), Image.NEAREST); b = wimg.resize((wimg.width * k, wimg.height * k), Image.NEAREST)
        blocks.append((f'{ex["id"]} · {ex.get("name", "")}' + (f'  ✗ {len(R["errs"])}' if R['errs'] else ''), a, b, bool(R['errs'])))
    W = max([a.width + b.width + 30 for _, a, b, _ in blocks] + [seams.width + 16, 600]); H = 30 + sum(a.height + 30 for _, a, _, _ in blocks) + seams.height + 30
    out = Image.new('RGBA', (W, H), (30, 28, 34, 255)); d = ImageDraw.Draw(out); d.text((8, 6), title, fill=(255, 230, 160, 255), font=f); y = 30
    for lab, a, b, bad in blocks:
        d.text((8, y), lab, fill=(240, 110, 90, 255) if bad else (230, 225, 215, 255), font=f)
        out.alpha_composite(a, (8, y + 22)); out.alpha_composite(b, (a.width + 22, y + 22)); y += a.height + 30
    d.text((8, y), '이음 검사(반복 ×3)', fill=(230, 225, 215, 255), font=f); out.alpha_composite(seams, (8, y + 22))
    return out

def run(pxg, K, quiet=False):
    import check_candidate
    pxg = os.path.abspath(pxg); kit = os.path.basename(os.path.dirname(pxg)); it = K.get(kit)
    if it is None: raise SystemExit(f'{kit} 는 킷이 아니다 (kits-jp.json)')
    name = cand_name(pxg); base = pxg[:-4]; direction = name.split('-')[-1]
    ck = check_candidate.check(pxg, quiet=True)
    res = dict(file=os.path.relpath(pxg, ROOT), kit=kit, cand=name, hard=[], warn=[], examples=[], borrowed={})
    if [h for h in ck.get('hard', []) if h.startswith(('size', 'pxgrid'))]:
        res['hard'] += ck['hard']; return finish(res, base, quiet)
    sheet = sheet_png(pxg); parts = slice_parts(it, sheet)
    h, w = part_issues(it, parts); res['hard'] += h; res['warn'] += w
    borrow = {}
    for kk in {v for v in it.get('aliases', {}).values()} | {t.split(':')[0] for ex in it['examples'] for g in (ex.get('layers') or {}).values() for r in g for t in r.split() if ':' in t}:
        kk = it.get('aliases', {}).get(kk, kk)
        if kk not in K or kk == kit: continue
        f = pick_for(kk, direction)
        pdef = {p['slug']: p for p in K[kk]['parts']}
        if f is None:
            borrow[kk] = (None, pdef); res['warn'].append(f'BORROW: {kk} 후보가 아직 없다 — 빌린 부품을 회색 빗금으로 대신 그렸다')
        else:
            borrow[kk] = (slice_parts(K[kk], sheet_png(f)), pdef); res['borrowed'][kk] = cand_name(f)
    exs = []
    for ex in it['examples']:
        R, exim, ctx = compose(it, ex, parts, borrow, name)
        eid = ex['id']; wimg = walk_img(ctx, R)
        exim.save(f'{base}.ex-{eid}.png'); ctx.save(f'{base}.ctx-{eid}.png'); wimg.save(f'{base}.walk-{eid}.png')
        exs.append((ex, ctx, wimg, R))
        res['examples'].append(dict(id=eid, name=ex.get('name', ''), cells=[R['W'], R['H']], ctxSize=list(ctx.size), through=ex.get('through'),
                                    errs=R['errs'], warns=R['warns'], seams=R['seams'], doors=len(R['door'])))
        for e in R['errs']: res['hard'].append(f'{e[0]}: [{eid}] ({e[1]},{e[2]}) {e[3]}')
        for e in R['warns']: res['warn'].append(f'{e[0]}: [{eid}] ({e[1]},{e[2]}) {e[3]}')
        for s in R['seams']: res['warn'].append(f'SEAM: [{eid}] {s["a"]}|{s["b"]} ({s["axis"]}) 점수 {s["score"]}')
    rs = repeat_seams(it, parts)
    res['repeat'] = [dict(slug=s, axis=a, score=round(sc, 2), d=round(d, 1), bad=bool(sc > SEAM_SCORE and d > SEAM_MIN)) for s, a, sc, d, _ in rs]
    for r in res['repeat']:
        if r['bad']: res['warn'].append(f'SEAM: {r["slug"]} 를 {r["axis"]} 로 이어 붙이면 경계가 튄다(점수 {r["score"]})')
    si = seams_img(rs); si.save(f'{base}.seams.png'); parts_img(it, parts).save(f'{base}.parts.png')
    board(f'{kit} {name}', exs, si).save(f'{base}.board.png')
    res['check'] = dict(ok=ck.get('ok'), hard=ck.get('hard', []), lint=ck.get('lint', {}), easyMax=ck.get('easyrpg', {}).get('max'), refmapMax=ck.get('refmap', {}).get('max'))
    res['hard'] += [h for h in ck.get('hard', []) if h not in res['hard']]
    return finish(res, base, quiet)

def finish(res, base, quiet):
    res['ok'] = not res['hard']
    atomic_write(base + '.kit.json', json.dumps(res, ensure_ascii=False, indent=1) + '\n')
    if not quiet:
        print(('합격 ' if res['ok'] else '불합격 ') + res['file'], '| 조립 예', len(res['examples']), '| 빌림', res.get('borrowed') or '-')
        for h in res['hard']: print('   ✗', h)
        for w in res['warn'][:30]: print('   ·', w)
        if len(res['warn']) > 30: print(f'   · … 경고 {len(res["warn"]) - 30}개 더')
        print('   눈으로 볼 것:', os.path.relpath(base + '.board.png', ROOT))
    return res

def main():
    if sys.argv[1:2] == ['prepare']:
        prepare(); return
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='*'); ap.add_argument('--kit'); ap.add_argument('--all', action='store_true')
    ap.add_argument('--worker'); ap.add_argument('--quiet', action='store_true'); a = ap.parse_args()
    kd, K = kits(); files = list(a.files)
    for s in K:
        if a.all or a.kit == s or a.worker:
            files += [f for f in sorted(glob.glob(os.path.join(kit_dir(s), '*.pxg')))
                      if WORKER_RE.match(os.path.basename(f)) and (not a.worker or os.path.basename(f).startswith(a.worker + '-'))]
    if not files: raise SystemExit('조립할 후보가 없다')
    rs = [run(f, K, a.quiet) for f in dict.fromkeys(files)]
    print(f'{sum(r["ok"] for r in rs)}/{len(rs)} 합격')
    sys.exit(0 if all(r['ok'] for r in rs) else 1)

if __name__ == '__main__':
    main()
