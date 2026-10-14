#!/usr/bin/env python3
"""campus_plans.py --render 용 합성 그림. 실제 조각 그림(재사용 = jp_city 실내 블록, 새 것 = campus_interior)을 평면대로 놓는다.
**엔진(TS 조립기) 출력이 아니다** — 바닥·벽면·가구 발밑·그리는 순서(y+높이)만 근사한 코드 합성이라, 칸 번호·층 수·통행은 보지 않는다."""
import os, sys, importlib
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'interior')); sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'blocks'))
import campus_interior as CI
from ikit import blit, K, Registry
import campus_plans as CP
OUT = os.path.join(ROOT, 'public', 'assets', 'modern-campus-references')
_REGS = None


def regs():
    global _REGS
    if _REGS is None:
        _REGS = [CI.R]
        for m in ('interior_school', 'interior_wet', 'interior_doors', 'interior_bed', 'interior_public', 'interior_gym'):
            mod = importlib.import_module(m); _REGS.append(mod.R)
    return _REGS


def obj_img(id_):
    for R in regs():
        if id_ in R.objs: return R.obj_image(id_)
    raise KeyError(id_)


def reg_of(kind, id_):
    for R in regs():
        if id_ in getattr(R, kind): return R
    raise KeyError(id_)


def compose(P, M, mark=None):
    A = CP.Analysis(P['plan']); W, H = A.W, A.H
    img = np.zeros((H * 16, W * 16, 4), np.uint8); img[:, :, :3] = (30, 30, 42); img[:, :, 3] = 255
    zone = lambda x, y: next((z for z in P['zones'] if z['x0'] <= x <= z['x1'] and z['y0'] <= y <= z['y1']), None)
    for y in range(H):
        for x in range(W):
            if not A.inn(x, y): continue
            z = zone(x, y) or {}
            if A.face[y][x] == 0:
                fid = z.get('floor', P['floor']); R = reg_of('floors', fid)
                t = R.floor_cell(fid, x, y, 1 if (A.face[y - 1][x] == 2 if y > 0 else False) else 0)
            else:
                wid = z.get('wall', P['wall']); R = reg_of('walls', wid)
                t = R.wall_cell(wid, x, A.face[y][x], False)
            blit(img, t, x * 16, y * 16)
    draws = []
    for o in P['objects']:
        d = M[o['id']]; a, U = obj_img(o['id'])
        if d['kind'] == 'hang': draws.append((o['y'] * 16, a, o['x'] * 16, o['y'] * 16))
        elif d['kind'] == 'door': draws.append(((o['y'] + 3) * 16, a, o['x'] * 16, o['y'] * 16 + 16))
        elif d['kind'] == 'flat': draws.append((-1, a, o['x'] * 16, o['y'] * 16))
        else: draws.append(((o['y'] + d['h']) * 16, a, o['x'] * 16, (o['y'] + d['h'] - (a.shape[0] // 16)) * 16))
    for _, a, x, y in sorted(draws, key=lambda t: t[0]):
        blit(img, a, x, y)
    im = Image.fromarray(img, 'RGBA')
    if mark:
        dr = ImageDraw.Draw(im)
        for (x, y) in mark: dr.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], outline=(255, 40, 40, 255), width=2)
    return im


def render_all(P, M):
    os.makedirs(OUT, exist_ok=True)
    for k, p in P.items():
        im = compose(p, M); im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(OUT, 'interior-%s.png' % k))
        print('  render', k, im.size)
    # 정상/오류 나란히
    base = P['school-class-wing']
    tiles = []
    for t in CP.TAMPERS[:4]:
        Q = CP.tamper(base, t); iss = CP.validate_plan(Q, M)
        pts = [(x, y) for c, m, x, y in iss if c == t]
        tiles.append((t, compose(Q, M, pts), sorted({c for c, *_ in iss})))
    ok = compose(base, M)
    W = ok.width * 2 + 8; H = (ok.height + 22) * 1
    sheet = Image.new('RGBA', (W * 1, (ok.height + 24) * len(tiles)), (20, 20, 28, 255))
    dr = ImageDraw.Draw(sheet)
    for i, (t, im, codes) in enumerate(tiles):
        y0 = i * (ok.height + 24)
        sheet.alpha_composite(ok, (0, y0 + 20)); sheet.alpha_composite(im, (ok.width + 8, y0 + 20))
        dr.text((4, y0 + 4), 'ok', fill=(180, 255, 180, 255)); dr.text((ok.width + 12, y0 + 4), '%s -> %s' % (t, ','.join(codes)), fill=(255, 160, 160, 255))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(os.path.join(OUT, 'interior-err-compare.png'))
    # 새 조각 도감
    ims = [(i, CI.R.obj_image(i)[0]) for i in CI.R.objs]
    Wd = 560; x = y = 4; rowh = 0; place = []
    for i, a in ims:
        h, w = a.shape[:2]
        if x + w + 4 > Wd: x, y, rowh = 4, y + rowh + 6, 0
        place.append((x, y, a)); x += w + 6; rowh = max(rowh, h)
    sh = np.zeros((y + rowh + 4, Wd, 4), np.uint8); sh[:, :, :3] = (90, 90, 104); sh[:, :, 3] = 255
    for (x0, y0, a) in place: blit(sh, a, x0, y0)
    Image.fromarray(sh, 'RGBA').resize((Wd * 2, sh.shape[0] * 2), Image.NEAREST).save(os.path.join(OUT, 'interior-pieces.png'))
