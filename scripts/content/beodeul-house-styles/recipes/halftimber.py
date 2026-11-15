"""halftimber(목골 상가주택) 조립 순서 — 집마다 덩어리(vols)와 붙는 것(feats). 좌표는 px, 붙는 것의 y 는 부품 맨 아랫줄 다음 줄.
칸 크기·문 칸은 tiledata/beodeul-house-styles/styles.json 이 정한다(문은 조립기가 문 칸 열에 놓는다 — door 는 문 부품 이름). roof: 'roof' 짙은 갈색 너와(기본) · 'tile' 붉은 기와."""
def R():
    H = {}
    H['gable'] = dict(vols=[dict(k='g', x=2, w=60, floors=[('stone', 9), ('plaster', 21)], rd=36, rise=22, ov=2)],
        feats=[('win-box', 39, 89), ('win-attic', 27, 60), ('chimney', 44, 34)])
    # ── 오두막 ──
    H['eave'] = dict(roof='tile', vols=[dict(k='e', x=2, w=76, floors=[('stone', 9), ('plaster', 23)], rh=38, ov=2, posts={1: [24]}, braces={1: [(4, 14, 1)]},
        feats=[('chimney', 12, 26), ('win-shutter', 4, 70), ('win-plain', 62, 69)])],
        feats=[('clutter', 30, 80, dict(crop=(0, 3, 16, 16)))])
    # ── 살림집 ──
    H['jetty'] = dict(vols=[dict(k='g', x=4, w=72, floors=[('stone', 30), ('plaster', 30)], rd=24, rise=26, ov=3, posts={1: [34]}, braces={1: [(4, 14, 1), (58, 68, -1)]})],
        feats=[('win-box', 11, 79), ('win-box', 51, 79), ('win-attic', 35, 46), ('win-plain', 58, 104), ('clutter', 8, 112, dict(crop=(36, 5, 44, 16)))])
    H['cross'] = dict(vols=[
        dict(k='e', x=2, w=108, floors=[('stone', 30), ('plaster', 30)], rh=40, ov=2, posts={1: [22]},
             feats=[('chimney', 14, 34), ('win-shutter', 4, 76), ('win-box', 12, 108), ('win-plain', 96, 75), ('win-plain', 96, 102)]),
        dict(k='g', x=46, w=48, floors=[('stone', 30), ('plaster', 30)], rd=22, rise=20, ov=2, feats=[('win-box', 61, 76), ('win-attic', 65, 47)])])
    H['stair'] = dict(roof='tile', vols=[dict(k='e', x=2, w=92, floors=[('stone', 28), ('plaster', 28)], rh=40, ov=2, posts={1: [34]},
        feats=[('dormer', 20, 40), ('chimney', 70, 30), ('win-shutter', 8, 60), ('win-plain', 52, 59), ('win-plain', 74, 59)])],
        feats=[('balcony', 40, 72, dict(w=54)), ('stair', 70, 96, dict(crop=(0, 16, 24, 44))), ('win-box', 42, 92)])
    # ── 큰 집 ──
    H['ell'] = dict(vols=[
        dict(k='e', x=2, w=70, base=94, floors=[('stone', 9), ('plaster', 23)], rh=36, ov=2, posts={1: [30]},
             feats=[('dormer', 22, 60), ('chimney', 8, 44), ('win-shutter', 6, 86), ('win-box', 40, 91)]),
        dict(k='g', x=68, w=58, floors=[('stone', 30), ('plaster', 30)], rd=26, rise=24, ov=2, feats=[('win-box', 73, 78), ('win-plain', 106, 76), ('win-attic', 92, 46), ('win-plain', 106, 104)])],
        feats=[('clutter', 4, 96, dict(crop=(0, 3, 22, 16)))])
    H['twin'] = dict(roof='tile', vols=[
        dict(k='e', x=50, w=44, floors=[('stone', 30), ('plaster', 28)], rh=30, ov=0, feats=[('win-plain', 66, 92)]),
        dict(k='g', x=2, w=56, floors=[('stone', 30), ('plaster', 30)], rd=30, rise=24, ov=2, feats=[('win-box', 10, 94), ('win-plain', 36, 92), ('win-attic', 25, 62), ('win-shutter', 14, 124)]),
        dict(k='g', x=88, w=54, floors=[('stone', 30), ('plaster', 24)], rd=22, rise=22, ov=2, feats=[('win-box', 106, 96), ('win-attic', 110, 68), ('cellar', 104, 128)])],
        feats=[('balcony', 56, 100, dict(w=34))])
    # ── 가게집 ──
    H['awning'] = dict(door='door-shop', vols=[dict(k='e', x=2, w=108, floors=[('stone', 28), ('plaster', 26)], rh=40, ov=2, posts={1: [34, 70]},
        feats=[('dormer', 44, 40), ('chimney', 90, 30), ('win-shutter', 6, 60), ('win-shutter', 40, 60), ('win-plain', 86, 59)])],
        feats=[('win-shop', 22, 92), ('sign-shop', 60, 90), ('clutter', 98, 96, dict(crop=(24, 0, 35, 16)))])
    H['shop'] = dict(door='door-shop', roof='tile', vols=[dict(k='g', x=3, w=90, floors=[('stone', 30), ('plaster', 26)], rd=26, rise=26, ov=3, posts={1: [28, 59]}, braces={1: [(4, 14, 1), (76, 86, -1)]})],
        feats=[('win-shop', 50, 108), ('win-shutter', 36, 76), ('win-plain', 12, 75), ('win-plain', 72, 75), ('win-attic', 43, 50), ('sign-shop', 30, 106)])
    H['inn'] = dict(vols=[
        dict(k='e', x=2, w=128, floors=[('stone', 30), ('plaster', 32)], rh=41, ov=2, posts={1: [30, 62, 94]},
             feats=[('chimney', 28, 42), ('dormer', 66, 62), ('win-shutter', 6, 86), ('win-shutter', 38, 86), ('win-shutter', 70, 86), ('win-plain', 108, 86)]),
        dict(k='g', x=133, w=57, floors=[('stone', 30), ('plaster', 30)], rd=36, rise=24, ov=2,
             feats=[('win-box', 152, 92), ('win-attic', 157, 56), ('cellar', 151, 128)])],
        feats=[('balcony', 28, 110, dict(w=100)), ('stair', 3, 128, dict(crop=(0, 12, 24, 44))), ('win-box', 36, 124), ('win-box', 66, 124), ('sign', 113, 104),
               ('clutter', 176, 128, dict(crop=(24, 0, 35, 16)))])
    return H
