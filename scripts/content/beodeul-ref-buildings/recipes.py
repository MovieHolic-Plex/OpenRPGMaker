"""참고 건물 조립 순서 — 건물마다 덩어리(vols)와 붙는 것(feats). 좌표는 px, 붙는 것의 y 는 부품 맨 아랫줄 다음 줄.
칸 크기·문 칸은 types.json 이 정한다(문은 조립기가 문 칸 열에 놓는다 — door 는 문 부품 이름, 또는 (부품, x, 밑 y, 옵션), None 이면 없음).
roof: 'roof' 짙은 갈색 너와 · 'tile' 붉은 기와 · 'shake' 이끼 너와(풀빛 처마 띠) · 'slate' 보랏빛 슬레이트 · 'tealroof' 청록 너와. 덩어리마다 roof 를 따로 줄 수 있다.
block: 덩어리 밖에서 막히는 곳(데크·독 무더기·우리) · blockonly: 덩어리 없는 구조물(노점·기중기)."""
BAR = dict(crop=(24, 0, 35, 16))          # clutter 부품의 통
WOODP = dict(crop=(0, 3, 22, 16))         # clutter 부품의 장작
CRATE = dict(crop=(36, 5, 44, 16))        # clutter 부품의 사과 상자


def deck(x0, x1, y0, y1, step_x, H):
    """데크: 바닥 띠 [x0,x1)×[y0,y1) + 앞 난간(문 열은 디딤 계단)."""
    out = [('deckfloor', x0, y1, dict(w=x1 - x0, crop=(0, 0, x1 - x0, y1 - y0), shade=False))]
    if step_x > x0: out.append(('rail', x0, H, dict(w=step_x - x0, shade=False)))
    out.append(('decksteps', step_x, H, dict(shade=False)))
    if x1 > step_x + 16: out.append(('rail', step_x + 16, H, dict(w=x1 - step_x - 16, shade=False)))
    return out


def R():
    H = {}
    # ── 농장 ──
    H['plankfarm-a'] = dict(roof='shake', door='logdoor', vols=[
        dict(k='e', x=50, w=60, floors=[('fstone', 6), ('boards', 34), ('boards', 30)], rh=40, ov=2, inset=False,
             feats=[('chimney-grey', 92, 38), ('log-win-box', 56, 82), ('log-win-box', 86, 82), ('log-win-shutter', 68, 112)]),
        dict(k='e', x=2, w=50, floors=[('fstone', 6), ('boards', 34)], rh=30, ov=2, inset=False, feats=[('log-win-box', 32, 116)])])
    H['plankfarm-b'] = dict(roof='tealroof', door='logdoor', vols=[
        dict(k='e', x=36, w=90, floors=[('fstone', 6), ('boards', 40)], rh=44, ov=2, inset=False,
             feats=[('chimney-brick', 104, 44), ('logdormer', 48, 64), ('log-win-shutter', 42, 92), ('log-win-box', 102, 98)]),
        dict(k='e', x=2, w=36, floors=[('plankwall', 30)], rh=20, back=0, ov=2, feats=[('woodpile', 5, 110)])])
    H['deckfarm-a'] = dict(roof='tile', door=('logdoor', 32, 94, dict(shade=False)), vols=[
        dict(k='e', x=10, w=124, base=92, floors=[('fstone', 4), ('logwall', 38)], rh=40, ov=2, inset=False,
             feats=[('chimney-brick', 112, 34), ('logdormer', 62, 50), ('log-win-shutter', 58, 80), ('log-win-shutter', 100, 80)])],
        feats=deck(2, 142, 94, 104, 32, 112), block=[(2, 94, 142, 112)])
    H['deckfarm-b'] = dict(roof='shake', door=('logdoor', 112, 94, dict(shade=False)), vols=[
        dict(k='e', x=10, w=156, base=92, floors=[('fstone', 4), ('logwall', 38)], rh=40, ov=2, inset=False,
             feats=[('chimney-grey', 30, 32), ('logdormer', 60, 50), ('logdormer', 124, 50), ('log-win-shutter', 68, 80), ('log-win-box', 138, 84)])],
        feats=deck(2, 174, 94, 104, 112, 112) + [('jars', 16, 102)], block=[(2, 94, 174, 112)])
    H['tealfarm-a'] = dict(roof='tealroof', door=('logdoor', 112, 126, dict(shade=False)), vols=[
        dict(k='e', x=2, w=172, base=118, floors=[('fstone', 4), ('mauve', 40)], rh=50, ov=2, inset=False,
             feats=[('chimney-grey', 40, 50), ('logdormer', 58, 74), ('log-win-shutter', 12, 104), ('log-win-shutter', 54, 104)]),
        dict(k='g', x=96, w=64, base=126, floors=[('fstone', 4), ('mauve', 38)], rd=52, rise=24, ov=3, inset=False, feats=[('log-win-box', 136, 116), ('win-attic', 123, 80)])],
        feats=[('deckfloor', 2, 132, dict(w=94, crop=(0, 0, 94, 14), shade=False)), ('deckfloor', 160, 132, dict(w=14, crop=(0, 0, 14, 14), shade=False)),
               ('deckfloor', 96, 134, dict(w=64, crop=(0, 0, 64, 8), shade=False)), ('clutter', 22, 124, CRATE),
               ('rail', 2, 144, dict(w=110, shade=False)), ('decksteps', 112, 144, dict(shade=False)), ('rail', 128, 144, dict(w=46, shade=False))], block=[(2, 118, 174, 144)])
    H['dormerhall-a'] = dict(roof='shake', door=('logdoor2', 96, 128, dict(shade=False)), vols=[
        dict(k='e', x=2, w=204, base=100, floors=[('fstone', 6), ('logwall', 38)], rh=40, ov=2, inset=False,
             feats=[('chimney-grey', 40, 34), ('logdormer', 24, 56), ('logdormer', 170, 56), ('log-win-shutter', 10, 84), ('log-win-box', 46, 90), ('log-win-box', 150, 90), ('log-win-shutter', 176, 84)]),
        dict(k='g', x=80, w=64, floors=[('fstone', 6), ('logwall', 28)], gable='fstone', rd=34, rise=22, ov=3, inset=False, feats=[('win-attic', 107, 90)])],
        feats=[('rosevine', 147, 100, dict(crop=(0, 6, 14, 44))), ('jars', 150, 126)], block=[(150, 104, 196, 126)])
    H['dormerhall-b'] = dict(roof='roof', door='logdoor', vols=[
        dict(k='e', x=2, w=140, base=96, floors=[('fstone', 6), ('logwall', 36)], rh=40, ov=2, inset=False,
             feats=[('chimney-brick', 74, 34), ('logdormer', 98, 54), ('log-win-shutter', 70, 82), ('log-win-shutter', 108, 82)]),
        dict(k='g', x=16, w=48, floors=[('fstone', 6), ('logwall', 26)], gable='fstone', rd=28, rise=18, ov=3, inset=False, feats=[('win-attic', 35, 76)])],
        feats=[('jars', 86, 110)], block=[(86, 88, 132, 110)])
    H['barn-a'] = dict(roof='roof', door=('barndoor', 16, 144, dict(shade=False)), vols=[
        dict(k='e', x=64, w=78, floors=[('fstone', 6), ('logwall', 40)], rh=40, ov=2, inset=False, feats=[('logdormer', 92, 96), ('louvre', 76, 126), ('louvre', 112, 126)]),
        dict(k='g', x=2, w=62, floors=[('fstone', 6), ('plankwall', 56)], rd=44, rise=26, ov=2, inset=False, feats=[('loftdoor', 25, 104)])],
        feats=[('clutter', 128, 142, BAR)])
    H['barn-b'] = dict(roof='roof', door=('barndoor', 32, 128, dict(shade=False)), vols=[
        dict(k='g', x=2, w=92, floors=[('fstone', 6), ('plankwall', 48)], rd=36, rise=30, ov=2, inset=False, feats=[('loftdoor', 40, 88), ('louvre', 8, 112), ('louvre', 72, 112)])],
        feats=[('clutter', 4, 126, BAR)])
    H['stable-a'] = dict(vols=[dict(k='e', x=2, w=124, floors=[('stone', 38)], rh=44, ov=2, inset=False, feats=[('chimney', 18, 38), ('dormer', 60, 56)])],
        feats=[('haybay', 2, 94, dict(w=96, shade=False))])
    H['stable-b'] = dict(roof='roof', door='logdoor', vols=[
        dict(k='e', x=2, w=112, floors=[('fstone', 4), ('logwall', 34)], rh=44, ov=2, inset=False, feats=[('chimney-grey', 90, 38), ('logdormer', 50, 56)])],
        feats=[('haybay', 36, 94, dict(w=72, crop=(0, 0, 72, 36), shade=False)), ('penfence', 112, 94, dict(crop=(0, 0, 46, 24), shade=False))], block=[(114, 72, 160, 94)])
    H['rootcellar-a'] = dict(door=('cavedoor', 14, 48, dict(shade=False)), vols=[dict(k='f', x=0, w=48, base=46, foot=False, floors=[('fstone', 38)], inset=False)],
        feats=[('bankcap', 0, 14, dict(w=48, shade=True))])
    H['rootcellar-b'] = dict(door=('cavedoor', 14, 48, dict(shade=False)), vols=[dict(k='f', x=0, w=80, base=46, foot=False, floors=[('fstone', 38)], inset=False)],
        feats=[('bankcap', 0, 14, dict(w=80, shade=True)), ('cavedoor', 46, 48, dict(shade=False))])
    H['storeshed-a'] = dict(roof='tile', door='logdoor', vols=[
        dict(k='e', x=2, w=58, floors=[('fstone', 6), ('logwall', 32)], rh=40, ov=2, inset=False, feats=[('chimney-grey', 38, 36)]),
        dict(k='e', x=60, w=34, floors=[('plankwall', 28)], rh=18, back=0, ov=2)],
        feats=[('jars', 48, 94)])
    # ── 읍 ──
    H['tavern-a'] = dict(vols=[
        dict(k='e', x=46, w=96, floors=[('stone', 38), ('plaster', 36)], rh=36, ov=2, inset=False, posts={1: [30, 62]},
             feats=[('chimney', 112, 46), ('dormer', 70, 68), ('win-plain', 58, 89), ('win-plain', 88, 89), ('win-plain', 120, 89)]),
        dict(k='g', x=2, w=46, floors=[('stone', 30), ('plaster', 28), ('plaster', 26)], rd=30, rise=20, ov=2, feats=[('win-box', 16, 82), ('win-plain', 8, 108), ('win-attic', 20, 54)])],
        feats=[('undercroft', 46, 142, dict(w=96, shade=False)), ('lamp', 80, 121, dict(shade=False)), ('lamp', 128, 121, dict(shade=False)),
               ('balcony', 46, 104, dict(w=96, crop=(0, 0, 96, 14), shade=False)), ('sign', 26, 110)])
    H['tavern-b'] = dict(roof='tile', vols=[
        dict(k='e', x=2, w=124, floors=[('stone', 38), ('plaster', 32)], rh=34, ov=2, inset=False, posts={1: [40, 80]},
             feats=[('chimney', 100, 24), ('dormer', 40, 40), ('win-plain', 16, 57), ('win-plain', 50, 57), ('win-box', 96, 64)])],
        feats=[('undercroft', 2, 110, dict(w=72, crop=(0, 0, 72, 38), shade=False)), ('lamp', 36, 89, dict(shade=False)), ('lamp', 12, 89, dict(shade=False)),
               ('balcony', 2, 72, dict(w=72, crop=(0, 0, 72, 14), shade=False)), ('sign', 74, 98)])
    H['cellarhouse-a'] = dict(vols=[
        dict(k='e', x=2, w=102, floors=[('stone', 36), ('plaster', 32)], rh=42, ov=2, posts={1: [34, 66]},
             feats=[('chimney', 20, 48), ('dormer', 56, 72), ('win-shutter', 8, 92), ('win-plain', 44, 91), ('win-plain', 74, 91)]),
        dict(k='g', x=102, w=56, floors=[('stone', 36), ('plaster', 30), ('plaster', 26)], rd=26, rise=22, ov=2, feats=[('win-box', 121, 102), ('win-plain', 124, 74), ('win-attic', 125, 46)])],
        feats=[('cellar', 10, 142), ('cellar', 42, 142), ('balcony', 6, 115, dict(w=72)), ('stair', 76, 142, dict(crop=(0, 8, 24, 44))), ('clutter', 144, 142, BAR)])
    H['guildhall-a'] = dict(vols=[
        dict(k='e', x=2, w=124, floors=[('stone', 32), ('plaster', 34)], rh=38, ov=2,
             feats=[('chimney', 98, 26), ('dormer', 26, 44), ('dormer', 66, 44), ('latticeband', 10, 72, dict(w=108, shade=False)), ('slit-stone', 48, 100), ('slit-stone', 72, 100), ('slit-stone', 98, 100)])])
    H['guildhall-b'] = dict(roof='tile', vols=[
        dict(k='e', x=2, w=172, floors=[('stone', 34), ('plaster', 36)], rh=44, ov=2,
             feats=[('chimney', 18, 36), ('chimney', 146, 36), ('dormer', 46, 56), ('dormer', 108, 56), ('latticeband', 10, 86, dict(w=156, shade=False)),
                    ('slit-stone', 24, 116), ('slit-stone', 50, 116), ('slit-stone', 122, 116), ('slit-stone', 148, 116)])],
        feats=[('sign-shop', 98, 112)])
    H['longhouse-a'] = dict(vols=[
        dict(k='e', x=2, w=124, floors=[('stone', 8), ('plaster', 32), ('plaster', 30)], rh=34, ov=2, posts={1: [30, 60, 90], 2: [30, 60, 90]},
             braces={1: [(4, 14, 1)], 2: [(4, 14, 1), (108, 118, -1)]},
             feats=[('chimney', 62, 24), ('dormer', 22, 40), ('lattice-win', 12, 64), ('lattice-win', 42, 64), ('lattice-win', 72, 64), ('lattice-win', 102, 64),
                    ('lattice-win', 12, 96), ('lattice-win', 42, 96), ('lattice-win', 72, 96)])])
    H['lockup-a'] = dict(vols=[
        dict(k='g', x=92, w=48, floors=[('stone', 34), ('plaster', 28)], rd=22, rise=18, ov=2),
        dict(k='e', x=2, w=140, floors=[('stone', 34), ('plaster', 28)], rh=30, ov=2, posts={1: [34, 68, 102]},
             feats=[('chimney', 30, 34), ('win-plain', 14, 72), ('win-plain', 46, 72), ('win-plain', 80, 72), ('win-plain', 116, 72), ('barred', 14, 102), ('barred', 46, 102), ('barred', 80, 102)])])
    H['wallstore-a'] = dict(vols=[dict(k='f', x=0, w=96, base=62, floors=[('stone', 46)], inset=False)],
        feats=[('crenel-stone', 0, 21, dict(w=96, shade=False)), ('barred', 8, 40), ('barred', 58, 40), ('barred', 78, 40)])
    for n in ('blue', 'green', 'striped', 'cloth'):
        H[f'stall-{n}'] = dict(feats=[(f'stall-{n}', 2, 48, dict(shade=False))], blockonly=True, block=[(0, 16, 48, 48)])
    H['markethall-a'] = dict(vols=[dict(k='e', x=2, w=124, floors=[('stone', 40)], rh=42, ov=2, inset=False, feats=[('dormer', 26, 54), ('dormer', 82, 54)])],
        feats=[('hallbay', 2, 94, dict(w=124, crop=(0, 0, 124, 40), shade=False))])
    # ── 항구 ──
    WF = [('buff', 30), ('darkframe', 34), ('darkframe', 28)]
    H['warehouse-a'] = dict(roof='tile', door='whdoor', vols=[
        dict(k='g', x=2, w=52, floors=WF, rd=22, rise=24, ov=2, inset=False, feats=[('win-attic', 23, 48), ('hoist', 17, 76), ('loftbale', 20, 108)]),
        dict(k='g', x=56, w=54, floors=WF, rd=22, rise=24, ov=2, inset=False, feats=[('win-attic', 78, 48), ('hoist', 72, 76), ('win-plain', 77, 104), ('whdoor', 80, 144, dict(shade=False))])])
    H['warehouse-b'] = dict(roof='tile', door='whdoor', vols=[
        dict(k='g', x=2, w=60, floors=WF, rd=22, rise=24, ov=2, inset=False, feats=[('win-attic', 27, 48), ('hoist', 21, 76), ('loftbale', 24, 108)])],
        feats=[('clutter', 44, 142, BAR)])
    H['warehouse-c'] = dict(roof='tile', door='whdoor', vols=[
        dict(k='e', x=2, w=92, floors=[('buff', 30), ('darkframe', 30)], rh=38, ov=2, inset=False, feats=[('chimney-grey', 64, 30), ('dormer', 22, 50), ('win-plain', 12, 74), ('win-plain', 62, 74)]),
        dict(k='g', x=92, w=50, floors=[('buff', 30), ('darkframe', 30)], rd=22, rise=22, ov=2, inset=False, feats=[('hoist', 106, 74), ('whdoor', 109, 112, dict(shade=False))])],
        feats=[('clutter', 62, 110, BAR)])
    H['cranehouse-a'] = dict(roof='tile', door=None, vols=[
        dict(k='g', x=4, w=56, floors=[('darkframe', 40), ('darkframe', 34), ('darkframe', 28)], rd=26, rise=24, ov=2, feats=[('win-attic', 27, 52), ('hoist', 21, 82), ('loftbale', 24, 114)])],
        feats=[('stilts', 4, 158, dict(shade=False))])
    H['crane-a'] = dict(feats=[('crane-a', 1, 64, dict(shade=False))], blockonly=True, block=[(8, 32, 40, 64)])
    H['crane-b'] = dict(feats=[('crane-b', 2, 64, dict(shade=False))], blockonly=True, block=[(0, 48, 48, 64)])
    H['customs-a'] = dict(roof='tile', door='archdoor', vols=[
        dict(k='e', x=2, w=68, floors=[('buff', 32), ('cream', 34)], rh=40, ov=2, feats=[('chimney-grey', 48, 54), ('dormer', 20, 76), ('win-shutter', 8, 100), ('win-shutter', 38, 100)]),
        dict(k='g', x=68, w=58, floors=[('buff', 32), ('cream', 36), ('cream', 30)], rd=20, rise=22, ov=2, feats=[('talllattice', 75, 106), ('talllattice', 92, 106), ('talllattice', 109, 106), ('win-attic', 92, 42)])],
        feats=[('clutter', 30, 142, BAR), ('clutter', 46, 142, CRATE)])
    H['harbouroffice-a'] = dict(roof='tile', door='archdoor', vols=[
        dict(k='e', x=2, w=74, floors=[('buff', 44)], rh=40, ov=2, inset=False, feats=[('chimney-grey', 10, 46), ('dormer', 44, 66), ('bigarch', 24, 104)]),
        dict(k='g', x=74, w=52, floors=[('buff', 36), ('cream', 30)], rd=20, rise=20, ov=2, feats=[('win-plain', 106, 100), ('win-plain', 94, 68), ('win-attic', 95, 42)])])
    H['archgate-a'] = dict(feats=[('archgate', 0, 64, dict(shade=False))], blockonly=True, block=[(0, 16, 16, 64), (32, 16, 48, 64)])
    # ── 성읍 ──
    H['tower-a'] = dict(roof='slate', vols=[dict(k='s', x=8, w=48, floors=[('ashlar', 34), ('ashlar', 28)], sh=42, ov=4, inset=False,
        feats=[('towerband', 10, 64, dict(shade=False)), ('banner', 26, 92), ('slit', 14, 100), ('slit', 42, 100)])])
    H['tower-b'] = dict(roof='slate', door='vdoor', vols=[dict(k='s', x=8, w=48, floors=[('ashlar', 30), ('brick', 32), ('brick', 24)], sh=34, ov=4, inset=False,
        feats=[('towerband', 10, 56, dict(shade=False)), ('banner', 38, 86), ('slit', 14, 84), ('vwin-box', 36, 120)])])
    H['tower-c'] = dict(roof='slate', door='vdoor', vols=[dict(k='s', x=4, w=40, floors=[('ashlar', 32), ('ashlar', 24)], sh=30, ov=3, inset=False,
        feats=[('towerband', 4, 54, dict(crop=(2, 0, 42, 14), shade=False)), ('slit', 6, 84)])])
    H['wallgate-a'] = dict(vols=[dict(k='f', x=0, w=80, base=78, floors=[('ashlar', 62)], inset=False)],
        feats=[('crenel', 0, 21, dict(w=80, shade=False)), ('gateway', 32, 80, dict(shade=False)), ('gpost', 24, 80, dict(shade=False)), ('gpost', 48, 80, dict(shade=False)), ('banner', 8, 52), ('banner', 60, 52)])
    H['gatehall-a'] = dict(roof='slate', vols=[
        dict(k='e', x=2, w=220, floors=[('ashlar', 46), ('ashlar', 28)], rh=38, ov=2, inset=False,
             feats=[('chimney-brick', 78, 34), ('chimney-brick', 134, 34), ('sdormer', 70, 52, dict(lift=1)), ('sdormer', 102, 52, dict(lift=1)), ('sdormer', 134, 52, dict(lift=1)), ('vwin-box', 64, 78), ('vwin-box', 142, 78)]),
        dict(k='g', x=2, w=56, floors=[('ashlar', 46), ('ashlar', 30)], rd=24, rise=22, ov=2, inset=False, feats=[('vwin-box', 21, 78), ('vwin-tall', 22, 118)]),
        dict(k='g', x=166, w=56, floors=[('ashlar', 46), ('ashlar', 30)], rd=24, rise=22, ov=2, inset=False, feats=[('vwin-box', 185, 78), ('vwin-tall', 186, 118)])],
        feats=[('passage', 96, 128, dict(shade=False)), ('banner', 106, 78), ('banner', 86, 76), ('banner', 126, 76)])
    H['guardhouse-a'] = dict(roof='slate', door='vdoor', vols=[
        dict(k='e', x=2, w=80, floors=[('ashlar', 34), ('ashlar', 30)], rh=38, ov=2, inset=False,
             feats=[('chimney-brick', 60, 44), ('sdormer', 26, 60), ('vwin-box', 8, 90), ('vwin-box', 32, 90), ('vwin-box', 56, 90)]),
        dict(k='s', x=82, w=44, floors=[('ashlar', 34), ('ashlar', 30), ('ashlar', 22)], sh=38, ov=2, inset=False,
             feats=[('towerband', 82, 56, dict(shade=False)), ('banner', 98, 84), ('vwin-box', 95, 120)])],
        feats=[('gallery', 4, 100, dict(w=76)), ('banner', 10, 122), ('vwin-box', 54, 124)])
    H['galleryhouse-a'] = dict(roof='slate', door='vdoor', vols=[
        dict(k='e', x=2, w=92, floors=[('ashlar', 36), ('ashlar', 30)], rh=38, ov=2, inset=False,
             feats=[('chimney-brick', 70, 28), ('sdormer', 38, 42), ('vwin-box', 12, 68), ('vwin-box', 40, 68), ('vwin-box', 68, 68)])],
        feats=[('gallery', 4, 90, dict(w=88)), ('gpost', 4, 112, dict(shade=False)), ('gpost', 84, 112, dict(shade=False)), ('crates', 44, 110)])
    H['brickstore-a'] = dict(roof='slate', door='vdoor', vols=[
        dict(k='e', x=2, w=60, floors=[('ashlar', 8), ('brick', 30), ('brick', 28)], rh=36, ov=2, inset=False,
             feats=[('chimney-brick', 30, 28), ('sdormer', 8, 44), ('vwin-box', 10, 68), ('vwin-box', 36, 68), ('vwin-box', 38, 106)]),
        dict(k='g', x=60, w=50, floors=[('ashlar', 8), ('brick', 34), ('brick', 30)], rd=16, rise=20, ov=2, inset=False, feats=[('banner', 79, 62), ('vwin-tall', 66, 100)])],
        feats=[('gallery', 4, 84, dict(w=54)), ('jars', 84, 110, dict(crop=(0, 0, 28, 26)))])
    # ── 초대형: 성 본채 · 마을 대성당 · 수도원 · 큰 세관 (있는 부품만으로 조립) ──
    H['keep-a'] = dict(roof='slate', door='vdoor', vols=[
        dict(k='e', x=44, w=168, floors=[('ashlar', 46), ('ashlar', 34)], rh=42, ov=2, inset=False,
             feats=[('chimney-brick', 62, 76), ('chimney-brick', 180, 76), ('sdormer', 56, 94, dict(lift=1)), ('sdormer', 180, 94, dict(lift=1)), ('vwin-box', 54, 120), ('vwin-box', 184, 120), ('vwin-tall', 58, 164), ('vwin-tall', 182, 164)]),
        dict(k='g', x=88, w=64, floors=[('ashlar', 46), ('ashlar', 36)], rd=24, rise=24, ov=2, inset=False,
             feats=[('vwin-box', 111, 122), ('banner', 96, 120), ('banner', 132, 120), ('slit', 98, 160), ('slit', 134, 160)]),
        dict(k='s', x=2, w=44, floors=[('ashlar', 46), ('ashlar', 40), ('ashlar', 34)], sh=38, ov=2, inset=False,
             feats=[('towerband', 2, 68, dict(shade=False)), ('slit', 20, 96), ('banner', 18, 126), ('vwin-box', 15, 160)]),
        dict(k='s', x=210, w=44, floors=[('ashlar', 46), ('ashlar', 40), ('ashlar', 34)], sh=38, ov=2, inset=False,
             feats=[('towerband', 210, 68, dict(shade=False)), ('slit', 228, 96), ('banner', 226, 126), ('vwin-box', 223, 160)])])
    H['cathedral-a'] = dict(roof='roof', door='archdoor', vols=[
        dict(k='e', x=150, w=54, floors=[('stone', 48)], rh=30, ov=2, inset=False, feats=[('talllattice', 162, 182), ('talllattice', 184, 182)]),
        dict(k='g', x=58, w=92, floors=[('stone', 48), ('stone', 40), ('plaster', 26)], rd=28, rise=34, ov=2, inset=False,
             feats=[('win-attic', 99, 66), ('bigarch', 90, 130), ('talllattice', 68, 132), ('talllattice', 130, 132), ('talllattice', 72, 182), ('talllattice', 126, 182)]),
        dict(k='s', x=6, w=48, floors=[('stone', 48), ('stone', 40), ('stone', 36), ('plaster', 26)], sh=32, ov=2, inset=False,
             feats=[('louvre', 14, 62), ('louvre', 30, 62), ('slit-stone', 26, 100), ('win-plain', 24, 140), ('slit-stone', 26, 176)])])
    H['abbey-a'] = dict(roof='shake', door='archdoor', vols=[
        dict(k='e', x=58, w=124, floors=[('stone', 40), ('plaster', 30)], rh=38, ov=2, inset=False, posts={1: [30, 62, 92]},
             feats=[('chimney', 112, 70), ('dormer', 76, 90), ('dormer', 140, 90), ('win-plain', 68, 112), ('win-plain', 98, 112), ('win-plain', 130, 112), ('win-plain', 160, 112)]),
        dict(k='g', x=2, w=58, floors=[('stone', 40), ('stone', 36), ('plaster', 22)], rd=22, rise=26, ov=2, inset=False,
             feats=[('win-attic', 26, 58), ('bigarch', 17, 112), ('talllattice', 12, 152), ('talllattice', 40, 152)]),
        dict(k='g', x=180, w=58, floors=[('stone', 40), ('plaster', 34)], rd=22, rise=24, ov=2, inset=False,
             feats=[('lattice-win', 190, 108), ('lattice-win', 214, 108), ('win-attic', 204, 76), ('win-plain', 218, 146)])],
        feats=[('hallbay', 60, 158, dict(w=120, crop=(0, 0, 120, 40), shade=False))])
    H['customs-b'] = dict(roof='tile', door='archdoor', vols=[
        dict(k='e', x=2, w=146, floors=[('buff', 34), ('cream', 34)], rh=40, ov=2,
             feats=[('chimney-grey', 26, 72), ('chimney-grey', 112, 72), ('dormer', 50, 92), ('dormer', 84, 92), ('win-shutter', 10, 114), ('win-shutter', 44, 114), ('win-shutter', 78, 114), ('win-shutter', 112, 114), ('bigarch', 18, 154), ('bigarch', 92, 154)]),
        dict(k='g', x=148, w=90, floors=[('buff', 34), ('cream', 38), ('cream', 30)], rd=22, rise=26, ov=2,
             feats=[('win-attic', 188, 50), ('talllattice', 158, 120), ('talllattice', 172, 120), ('talllattice', 204, 120), ('talllattice', 218, 120), ('win-plain', 187, 86), ('win-shutter', 204, 150)])],
        feats=[('clutter', 56, 158, BAR), ('clutter', 70, 158, CRATE)])
    return H
