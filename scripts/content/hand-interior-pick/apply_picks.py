#!/usr/bin/env python3
"""picks.json 대로 v5 아틀라스·메타 **사본**에 고른 후보를 넣고, v5 예제 방 전후 비교를 굽는다. 정본 v5 는 덮지 않는다.

  python3 scripts/content/hand-interior-pick/apply_picks.py [--rooms 8]
출력 (tiledata/hand-interior/pick/out/):
  interior-atlas.png · interior-meta.json   v5 사본 + 고른 후보(메타 기물에 "pick": {choice, at, file})
  applied.json                              넣은 것·건너뛴 것
크기를 바꾼 기물(candidates/<slug>/resize.json): 그림을 아틀라스 사본 **끝에 덧붙인 줄**에 넣고(v5 옛 칸은 비운다),
  메타 사본의 atlas 좌표·image·footprint 를 새 값으로 고치고 "resized" 를 단다. 나머지 기물은 그대로.
함께 쓰기(picks.json 의 "variants": [후보, …]): 주 선택과 별도로 아틀라스 사본 끝 빈 줄에 덧붙이고 메타 사본에 새 기물
  id "<원 id>#2", "#3"… 로 넣는다(이름·설명에 변형 번호, tags 는 원본 + "variant", "variantOf": 원 id). 방 전후 렌더에는 주 선택만.
  rooms/<방>-before.png · -after.png · -compare.png (2배, 왼쪽 v5 · 오른쪽 적용, 아래 띠에 방 안에서 못 바꾼 것·오류)
방 안 항목은 **그 기물 자신일 때만** 바꾼다. 선 자동 타일(kit5.LineKit — 깔개 줄·울타리·창살·선로·관)은 조각(4방 마스크)으로
  늘여 까는 것이라 한 칸 그림으로 못 바꾼다. id 가 같아도(예: 'rug red' 는 단품 3×2 양탄자이자 선 자동 타일 'line:rug red') v5 그대로 두고
  applied.json 의 roomSkips 에 남긴다. 그림 크기·칸 수가 메타와 다른 항목도 같다.
크기를 키운 기물이 방 견본의 원래 자리에서 방 밖으로 새면 같은 줄(y 그대로) 안에서 왼쪽/오른쪽으로 최소 이동한 빈 자리로
  옮긴다(다른 기물과 불투명 상자가 안 겹치게). 자리가 없으면 그 방에서만 v5, roomSkips 에 이유. 옮긴 것은 roomMoves·compare 띠.
방 밖 검사: 기물 그림의 불투명 화소가 방 칸(plan 의 '#' 아닌 칸) 밖에 새로 찍히면 오류(voidErrors, 종료 코드 1).
방은 고른 기물이 많이 놓인 v5 예제 방 순(최대 --rooms), 없으면 빵집·여관·저택 1층.
"""
import argparse, glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import context

OUT = os.path.join(PICK, 'out')

def cand_png(s, choice):
    base = os.path.join(CAND, s, choice); png = base + '.png'
    if not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(base + '.pxg'):
        sys.path.insert(0, PXGRID); import pxgrid
        pxgrid.render(base + '.pxg', png)
    return Image.open(png).convert('RGBA')

def swap_block(f, o):
    """방 안 항목 f 를 메타 기물 o 의 후보로 바꿔도 되나. 안 되면 이유 문자열."""
    if getattr(f, 'line', None):
        return f'선 자동 타일(line:{f.line}, {f.fw}×{f.fh}칸)로 늘여 깐 것 — 한 칸 그림으로 못 바꿔 v5 유지'
    img = (o['image']['w'], o['image']['h'])
    if f.im.size != img or (f.fw, f.fh) != (o['footprint']['w'], o['footprint']['h']):
        return f'방 그림 {f.im.size}·{f.fw}×{f.fh}칸이 메타 {img}·{o["footprint"]["w"]}×{o["footprint"]["h"]}칸과 달라 v5 유지'
    return None

def opaque_outside(m, items, room4):
    """items 그림의 불투명 화소 중 방 칸(plan '#' 아닌 칸) 밖인 것: {(X,Y)}."""
    plan = m['plan']; H = len(plan)
    inside = lambda cx, cy: 0 <= cy < H and 0 <= cx < len(plan[cy]) and plan[cy][cx] != '#'
    bad = set()
    for it in items:
        f, x, y = it[:3]
        im = f.frames[0] if getattr(f, 'frames', None) else f.im
        X0, Y0, _, _ = room4.item_rect(f, x, y); al = im.getchannel('A').load()
        for ly in range(im.height):
            for lx in range(im.width):
                if al[lx, ly] and not inside((X0 + lx) // 16, (Y0 + ly) // 16): bad.add((X0 + lx, Y0 + ly))
    return bad

def _obox(f, x, y, room4):
    """불투명 화소의 화면 상자 (X0, Y0, X1, Y1). 없으면 None."""
    im = f.frames[0] if getattr(f, 'frames', None) else f.im
    bb = im.getchannel('A').getbbox()
    if not bb: return None
    X0, Y0, _, _ = room4.item_rect(f, x, y)
    return (X0 + bb[0], Y0 + bb[1], X0 + bb[2], Y0 + bb[3])

def relocate(m, items, j, room4, reach=6):
    """크기를 키운 방 항목 items[j] 가 방 밖으로 새면 같은 줄(y 그대로 — 걸이는 벽 두 줄 안) 안에서 왼쪽/오른쪽으로
    최소 이동해 방 안이고 다른 기물(바닥 깔개 flat 제외)과 불투명 상자가 안 겹치는 자리. 반환: 새 x, 못 찾으면 None."""
    f, x, y = items[j][:3]
    others = [_obox(it[0], it[1], it[2], room4) for k2, it in enumerate(items) if k2 != j and it[0].kind != 'flat']
    others = [o for o in others if o]
    hit = lambda a, b: a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]
    for d in sorted(range(-reach, reach + 1), key=lambda d: (abs(d), d)):
        nx = x + d
        if nx < 0 or d == 0: continue
        if opaque_outside(m, [(f, nx, y)], room4): continue
        bx = _obox(f, nx, y, room4)
        if bx and any(hit(bx, o) for o in others): continue
        return nx
    return None

def _font(sz):
    for f in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/nanum/NanumSquareB.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--rooms', type=int, default=8); a = ap.parse_args()
    picks = json.load(open(os.path.join(PICK, 'picks.json'), encoding='utf-8')) if os.path.exists(os.path.join(PICK, 'picks.json')) else {}
    meta = load_meta(include_new=False)   # 새 기물은 아틀라스 자리가 없어 미리보기 아틀라스에 넣지 않는다 (굽기는 install_picks)
    by = {o['id']: o for o in meta['objects']}
    import copy; orig = {i: copy.deepcopy(o) for i, o in by.items()}   # 크기 바꾸기 전 메타 (방 항목 대조용)
    atlas = v5_atlas().copy(); applied, skipped, swaps = [], [], {}
    extra = []   # 크기를 바꾼 기물: (o, im) — 루프 뒤에 아틀라스 끝 줄로
    var_jobs = []   # 함께 쓰기: (i, 후보 이름, 번호, p) — 주 선택을 다 넣은 뒤 아틀라스 끝 줄로
    for i, p in sorted(picks.items()):
        ch = (p or {}).get('choice')
        if i not in by: skipped.append(dict(id=i, why='v5 에 없는 기물')); continue
        if not ch or ch == 'v5': skipped.append(dict(id=i, why='v5 유지' if ch == 'v5' else '선택 없음')); continue
        o = by[i]; s = slug(i); t = o['atlas']
        if not os.path.exists(os.path.join(CAND, s, ch + '.pxg')): skipped.append(dict(id=i, why=f'후보 파일 없음 {ch}')); continue
        for k, v in enumerate((p or {}).get('variants') or [], start=2):
            var_jobs.append((i, v, k, p))
        im = cand_png(s, ch)
        G = geom(o)
        if list(im.size) != G['canvas']: skipped.append(dict(id=i, why=f'크기 {im.size} ≠ ' + ('resize.json 캔버스' if G['resized'] else '칸 자리'))); continue
        if t['frames'] > 1: skipped.append(dict(id=i, why='애니메이션 기물(12프레임)은 아직 적용 안 함')); continue
        if G['resized']:
            o['pick'] = dict(choice=ch, at=p.get('at'), file=f'tiledata/hand-interior/pick/candidates/{s}/{ch}.pxg')
            extra.append((o, im, G)); swaps[i] = (im, G['footprint']['w']); applied.append(dict(id=i, choice=ch, resized=G['canvas'])); continue
        atlas.paste(Image.new('RGBA', im.size), (t['x'], t['y'])); atlas.alpha_composite(im, (t['x'], t['y']))
        o['pick'] = dict(choice=ch, at=p.get('at'), file=f'tiledata/hand-interior/pick/candidates/{s}/{ch}.pxg')
        swaps[i] = (context.to_item_image(o, im), None); applied.append(dict(id=i, choice=ch))
    if extra:   # 덧붙인 줄: 왼쪽부터 채우고 폭이 넘으면 다음 줄. 줄 높이 = 그 줄의 가장 큰 그림
        W0, y, x, rowh, place = atlas.width, atlas.height, 0, 0, []
        for o, im, G in extra:
            if x + im.width > W0: y += rowh; x = 0; rowh = 0
            place.append((o, im, G, x, y)); x += im.width; rowh = max(rowh, im.height)
        big = Image.new('RGBA', (W0, y + rowh)); big.alpha_composite(atlas, (0, 0)); atlas = big
        for o, im, G, x, y in place:
            t = o['atlas']; atlas.paste(Image.new('RGBA', (t['w'], t['h'])), (t['x'], t['y']))   # v5 옛 칸 비움
            o['resized'] = dict(fromAtlas=dict(t), canvas=G['canvas'], why=G['resized']['why'])
            o['atlas'] = dict(t, x=x, y=y, w=im.width, h=im.height, padTop=0)
            o['image'] = dict(w=im.width, h=im.height); o['footprint'] = G['footprint']
            atlas.alpha_composite(im, (x, y))
    var_applied, var_skipped, var_im = [], [], []
    applied_ids = {a['id'] for a in applied}
    for i, v, k, p in var_jobs:
        o = by[i]; s = slug(i)
        if i not in applied_ids: var_skipped.append(dict(id=i, variant=v, why='주 선택이 적용되지 않음')); continue
        if not os.path.exists(os.path.join(CAND, s, v + '.pxg')): var_skipped.append(dict(id=i, variant=v, why='후보 파일 없음')); continue
        im = cand_png(s, v)
        if [im.width, im.height] != [o['atlas']['w'], o['atlas']['h']]:
            var_skipped.append(dict(id=i, variant=v, why=f'크기 {im.size} ≠ 주 선택 칸 {o["atlas"]["w"]}×{o["atlas"]["h"]}')); continue
        var_im.append((o, v, k, p, im))
    if var_im:   # 주 선택과 같은 방식: 아틀라스 끝에 새 줄
        W0, y, x, rowh, place = atlas.width, atlas.height, 0, 0, []
        for e in var_im:
            im = e[-1]
            if x + im.width > W0: y += rowh; x = 0; rowh = 0
            place.append(e + (x, y)); x += im.width; rowh = max(rowh, im.height)
        big = Image.new('RGBA', (W0, y + rowh)); big.alpha_composite(atlas, (0, 0)); atlas = big
        for o, v, k, p, im, x, y in place:
            n = copy.deepcopy(o); s = slug(o['id'])
            n['id'] = f"{o['id']}#{k}"; n['variantOf'] = o['id']
            for f in ('name_ko', 'name_en'):
                if n.get(f): n[f] = f"{n[f]} 변형 {k}" if f == 'name_ko' else f"{n[f]} variant {k}"
            n['description'] = f"{o.get('description', '')} (변형 {k} — 후보 {v}, 주 선택 {o['pick']['choice']}과 함께 쓴다)"
            if n.get('summary'): n['summary'] = f"{n['summary']} (변형 {k})"
            n['tags'] = list(o.get('tags', [])) + ['variant']
            n['atlas'] = dict(o['atlas'], x=x, y=y, w=im.width, h=im.height)
            n['pick'] = dict(choice=v, at=p.get('at'), file=f'tiledata/hand-interior/pick/candidates/{s}/{v}.pxg', variantOf=o['id'])
            meta['objects'].append(n); atlas.alpha_composite(im, (x, y))
            var_applied.append(dict(id=n['id'], variantOf=o['id'], choice=v, atlas=[x, y, im.width, im.height]))
    os.makedirs(os.path.join(OUT, 'rooms'), exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'rooms', '*.png')): os.remove(f)
    atlas.save(os.path.join(OUT, 'interior-atlas.png'))
    meta['pickedFrom'] = dict(base='tiledata/hand-interior/v5', picks='tiledata/hand-interior/pick/picks.json', applied=len(applied), variants=len(var_applied))
    atomic_write(os.path.join(OUT, 'interior-meta.json'), json.dumps(meta, ensure_ascii=False, indent=1) + '\n')
    # 방 전후
    rooms4, room4 = v5_modules(); maps = [m for b in rooms4.B.values() for m in b['maps']]
    score = lambda m: sum(1 for it in m['items'] if getattr(it[0], 'id', None) in swaps and not swap_block(it[0], orig[it[0].id]))
    chosen = sorted([m for m in maps if score(m)], key=lambda m: -score(m))[:a.rooms]
    if not chosen:
        chosen = [m for m in maps if m['key'] in ('bakery', 'inn', 'manor_1f')]
    rooms, room_skips, void_errors, room_moves = [], [], [], []
    for m in chosen:
        k = m['key']; items, notes = [], {}
        for it in m['items']:
            i = getattr(it[0], 'id', None)
            if i in swaps:
                why = swap_block(it[0], orig[i])
                if why: notes.setdefault((i, why), []).append(tuple(it[1:3])); items.append(it); continue
                items.append((context._swap(it[0], *swaps[i]),) + tuple(it[1:]))
            else: items.append(it)
        n = dict(m); n['items'] = items
        moved = []   # 크기를 키운 기물이 원래 자리에서 방 밖으로 새면 같은 줄 가까운 빈 자리로. 없으면 이 방에서만 v5
        for j, it in enumerate(items):
            i = getattr(it[0], 'id', None)
            if i not in swaps or swaps[i][1] is None or it is m['items'][j]: continue
            if not (opaque_outside(n, [it], room4) - opaque_outside(m, [m['items'][j]], room4)): continue
            nx = relocate(n, items, j, room4)
            if nx is None:
                items[j] = m['items'][j]
                notes.setdefault((i, '크기를 키운 그림이 방 밖으로 새고 같은 줄에 들어갈 빈 자리가 없어 이 방에서만 v5 유지'), []).append(tuple(it[1:3]))
            else:
                items[j] = (it[0], nx) + tuple(it[2:]); moved.append(dict(room=k, id=i, fromX=it[1], toX=nx, y=it[2]))
        room_moves += moved
        rs = [dict(room=k, id=i, why=why, at=at) for (i, why), at in notes.items()]; room_skips += rs
        new_void = opaque_outside(n, items, room4) - opaque_outside(m, m['items'], room4)
        if new_void:
            xs = [p[0] for p in new_void]; ys = [p[1] for p in new_void]
            void_errors.append(dict(room=k, pixels=len(new_void), box=[min(xs), min(ys), max(xs) + 1, max(ys) + 1]))
        b, z = room4.compose(m), room4.compose(n)
        b.save(os.path.join(OUT, 'rooms', f'{k}-before.png')); z.save(os.path.join(OUT, 'rooms', f'{k}-after.png'))
        lines = [f'방 밖 공허에 새로 찍힌 화소 {len(new_void)}개 (빨간 상자)'] if new_void else []
        lines += [f'옮김: {mv["id"]} x{mv["fromX"]} -> x{mv["toX"]} (크기를 키워 방 밖으로 새서 같은 줄 빈 자리로)' for mv in moved]
        lines += [f'못 바꿈: {r["id"]} ×{len(r["at"])} — {r["why"]}' for r in rs]
        band = 8 + 22 * len(lines) if lines else 0
        c = Image.new('RGBA', (b.width * 4 + 16, b.height * 2 + band), (20, 18, 22, 255))
        c.alpha_composite(b.resize((b.width * 2, b.height * 2), Image.NEAREST), (0, 0))
        c.alpha_composite(z.resize((z.width * 2, z.height * 2), Image.NEAREST), (b.width * 2 + 16, 0))
        d = ImageDraw.Draw(c)
        if new_void:
            X0, Y0, X1, Y1 = void_errors[-1]['box']; ox = b.width * 2 + 16
            d.rectangle((ox + X0 * 2 - 3, Y0 * 2 - 3, ox + X1 * 2 + 2, Y1 * 2 + 2), outline=(255, 40, 40, 255), width=3)
        fnt = _font(16)
        for j, t in enumerate(lines):
            d.text((8, b.height * 2 + 4 + 22 * j), t, font=fnt, fill=(255, 90, 90, 255) if t.startswith('방 밖') else (240, 200, 120, 255))
        c.save(os.path.join(OUT, 'rooms', f'{k}-compare.png'))
        rooms.append(dict(key=k, name=m.get('name'), swapped=sum(1 for a, b2 in zip(m['items'], items) if a is not b2), skippedInRoom=sum(len(r['at']) for r in rs)))
    atomic_write(os.path.join(OUT, 'applied.json'), json.dumps(dict(applied=applied, skipped=skipped, variants=var_applied, variantSkips=var_skipped, roomSkips=room_skips, roomMoves=room_moves, voidErrors=void_errors, rooms=rooms), ensure_ascii=False, indent=1) + '\n')
    print(f'적용 {len(applied)} · 함께 쓰기 변형 {len(var_applied)} · 건너뜀 {len(skipped)} · 방 {len(rooms)} → {OUT}')
    for r in var_skipped: print('   변형 건너뜀', r)
    for r in rooms: print('  ', r['key'], r['name'], '바뀐 기물', r['swapped'], '· 방 안에서 못 바꿈', r['skippedInRoom'])
    for r in room_moves: print('   옮김', r['room'], r['id'], f"x{r['fromX']}→x{r['toX']}")
    for r in room_skips: print('   못 바꿈', r['room'], r['id'], len(r['at']), '곳 —', r['why'])
    if void_errors:
        for e in void_errors: print('   오류: 방 밖 공허에 화소', e)
        sys.exit(1)

if __name__ == '__main__':
    main()
