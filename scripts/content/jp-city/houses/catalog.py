#!/usr/bin/env python3
"""jp_city 건물 목록(레시피) — house_kit + shop_parts 로 조립.
  python3 scripts/content/jp-city/houses/catalog.py OUT_DIR [이름…]
각 항목: id → (한글 이름, 분류, 레시피). 레시피 형식은 house_kit.build 참고."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import house_kit as hk  # noqa: E402
import shop_parts  # noqa: E402,F401  (PARTS/ROOFS/JOINS 등록)
import landmark_parts as LP  # noqa: E402
from shop_parts import vsign, chimney, red_lamp  # noqa: E402
from house_kit import RECIPES as R0  # noqa: E402

S = 'siding'; P = 'plaster'; T = 'tile'; B = 'brick'; V = 'vboard'; W = 'board'; N = 'panel'
WH = ('shiro', 2); YE = ('kii', 3); BK = ('sumi', 0)


def fl(h, mat, base, kind, *items):
    return dict(h=h, mat=mat, base=base, kind=kind, items=list(items))


def shop1(mat, base, kind, front, sign, extra=(), w=None, h=50):
    """1층 가게: 간판(y1) + 차양/노렌 + 정면. front = 정면 부품 튜플들, sign = ('sign', …)."""
    return fl(h, mat, base, kind, sign, *front, *extra)


CATALOG = {}


def add(id_, name, cat, r):
    CATALOG[id_] = (name, cat, r)


# ── 주택(기존 6) ──
add('house_hip2', '2층 寄棟 단독주택', 'house', R0['hip2'])
add('house_gable_garage', '2층 박공 단독주택 · 차고', 'house', R0['gable2_garage'])
add('house_hiraya', '단층 寄棟 平屋', 'house', R0['hip1'])
add('house_shed_modern', '2층 片流れ 모던주택', 'house', R0['shed2'])
add('house_flat3', '3층 협소주택 · 차고', 'house', R0['flat3'])
add('apart_wood2', '2층 목조 아파트', 'apartment', R0['apart2'])

# ── 상점(1층 가게 + 2층 살림집) ──
add('shop_greengrocer', '八百屋 채소가게', 'shop', dict(
    w=6, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'kinari', 1, S, ('sign', 0, 96, 'やおや', 'midori', WH, 1, 18),
              ('shopopen', 0, 96, 'veg', 0, 23), ('awning', 0, 96, 'midori', 0, 23)),
            fl(28, 'kinari', 1, S, ('sash', 0, 24, 14, 10, 8, False, True), ('sash', 3, 32, 14, 8, 8, True, True))],
    joins=[('shop_band', {'mat': 'conc'})]))

add('shop_fish', '魚屋 생선가게', 'shop', dict(
    w=5, rmat='yoru', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'hodo', 1, P, ('sign', 0, 80, 'さかな', 'sora', WH, 1, 18),
              ('shopopen', 0, 80, 'fish', 0, 23), ('awning', 0, 80, 'sora', 0, 23)),
            fl(28, 'hodo', 2, P, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('shop_band', {})]))

add('shop_butcher', '肉屋 정육점', 'shop', dict(
    w=5, rmat='kawara', rbase=-1, roof=('gable_side', {}),
    floors=[fl(56, 'shiro', 1, T, ('sign', 0, 80, 'お肉', 'aka', WH, 1, 18),
              ('shopglass', 0, 80, 'meat', 0, 23, 'right'), ('awning', 0, 80, 'aka', 0, 23)),
            fl(28, 'kinari', 1, S, ('sash', 0, 24, 14, 8, 8, True, True), ('sash', 3, 16, 14, 6, 8, False, True))],
    joins=[('shop_band', {})]))

add('shop_bakery', 'パン屋 빵집', 'shop', dict(
    w=6, rmat='kawara', rbase=0, roof=('gable_front_big', {'rise': 30, 'depth': 12}),
    floors=[fl(56, 'yuka', 2, P, ('sign', 1, 64, 'パン', 'ita', YE, 1, 18),
              ('shopglass', 0, 96, 'bread', 0, 23, 'right'), ('awning', 0, 96, 'daidai', 0, 23), ('pots', 0, 2, 2)),
            fl(28, 'yuka', 2, P, ('sash', 1, 32, 16, 8, 6, True, True))],
    joins=[('shop_band', {'mat': 'ita'})]))

add('shop_flower', '花屋 꽃집', 'shop', dict(
    w=5, rmat='tekko', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'shiro', 1, P, ('sign', 0, 80, 'フラワー', 'midori', WH, 1, 18),
              ('shopopen', 0, 80, 'flower', 0, 23), ('awning', 0, 80, 'midori', 0, 23, False)),
            fl(28, 'shiro', 1, P, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('shop_band', {})]))

add('shop_books', '本屋 서점', 'shop', dict(
    w=6, rmat='tairu', rbase=-1, roof=('flat', {'items': (('ac', 60),)}),
    floors=[fl(56, 'conc', 1, N, ('sign', 0, 96, 'ブックス', 'kon', WH, 1, 18),
              ('shopglass', 0, 96, 'books', 0, 23), ('bikes', 4, 2, 2)),
            fl(28, 'conc', 1, N, ('sash', 0, 40, 14, 8, 8, False, False), ('sash', 3, 40, 14, 4, 8, True, False))],
    joins=[('shop_band', {})]))

add('shop_pharmacy', '薬局 약국', 'shop', dict(
    w=5, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 50),)}),
    floors=[fl(56, 'shiro', 2, T, ('sign', 0, 80, 'くすり', 'sora', WH, 1, 18),
              ('shopglass', 0, 80, 'drug', 0, 23)),
            fl(28, 'shiro', 2, T, ('sash', 0, 32, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('shop_band', {})]))

add('shop_cleaning', 'クリーニング 세탁소', 'shop', dict(
    w=5, rmat='yoru', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'hodo', 2, P, ('sign', 0, 80, '洗たく', 'sora', WH, 1, 18),
              ('shopglass', 0, 80, 'drug', 0, 23, 'left'), ('awning', 0, 80, 'sora', 0, 23)),
            fl(28, 'hodo', 2, P, ('sash', 0, 24, 14, 8, 8, True, True), ('sash', 3, 16, 14, 6, 8, False, True))],
    joins=[('shop_band', {})]))

add('shop_ramen', 'ラーメン屋', 'restaurant', dict(
    w=5, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'kinari', 1, W, ('sign', 0, 80, 'ラーメン', 'aka', YE, 1, 18),
              ('shopglass', 0, 80, 'sake', 0, 23, 'left'), ('noren', 0, 30, 'aka', '', 2), ('lantern', 4, 4, 24)),
            fl(28, 'kinari', 1, S, ('sash', 0, 24, 14, 8, 8, True, True), ('sash', 3, 16, 14, 6, 8, False, True))],
    joins=[('lean', {})]))

add('shop_soba', '蕎麦屋 소바집', 'restaurant', dict(
    w=6, rmat='tairu', rbase=-1, roof=('irimoya', {'run': 36}),
    floors=[fl(34, 'kinari', 0, W, ('lattice', 0, 32), ('noren', 0, 30, 'kon', '', 2), ('sash', 3, 32, 14, 8, 8, False, False),
              ('grille', 3, 8, 32, 8, 14), ('pots', 5, 2, 1))],
    joins=[], porch=[(0, 34)]))

add('shop_izakaya', '居酒屋 선술집', 'restaurant', dict(
    w=5, rmat='tairu', rbase=-1, roof=('gable_side', {}),
    floors=[fl(56, 'ita', 0, W, ('sign', 0, 80, 'いざかや', 'ita', YE, 1, 18),
              ('lattice', 1, 32), ('noren', 1, 32, 'kon', '', 0), ('lantern', 0, 6, 26), ('lantern', 3, 10, 26), ('crates', 4, 0, 3, 'kii')),
            fl(28, 'kinari', 0, S, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('lean', {})]))

add('shop_cafe', '喫茶店 찻집', 'restaurant', dict(
    w=5, rmat='renga', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'renga', 0, B, ('sign', 0, 80, '喫茶ルナ', 'ita', YE, 1, 18),
              ('shopglass', 0, 80, 'sweets', 0, 23, 'left'), ('awning', 0, 80, 'aka', 0, 23), ('pots', 4, 0, 2)),
            fl(28, 'renga', 0, B, ('sash', 0, 24, 14, 8, 8, True, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('shop_band', {'mat': 'kinari'})]))

add('shop_barber', '理髪店 이발소', 'shop', dict(
    w=4, rmat='yoru', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'shiro', 2, T, ('sign', 0, 64, 'とこや', 'sora', WH, 1, 18),
              ('shopglass', 0, 56, 'drug', 4, 23, 'left'), ('barber', 3, 6)),
            fl(28, 'shiro', 2, T, ('sash', 0, 24, 14, 8, 8, True, True))],
    joins=[('shop_band', {})]))

add('shop_tabako', 'たばこ屋 담배가게', 'shop', dict(
    w=4, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(34, 'kinari', 1, S, ('kiosk', 0, 4), ('door', 2, 6), ('vend', 3, 0)),
            fl(28, 'kinari', 1, S, ('sash', 0, 24, 14, 12, 8, False, True))],
    joins=[('lean', {})], porch=[(36, 20)]))


# ── 주택 2차 ──
add('house_hip2_wide', '2층 寄棟 넓은 집 · 카포트', 'house', dict(
    w=9, rmat='kawara', rbase=-2, roof=('hip', {'run': 40}),
    floors=[fl(30, 'shiro', 1, T, ('garage', 0, 44), ('genkan', 3), ('sash', 5, 32, 24, 0, 5, True, True), ('ac', 8, 0)),
            fl(28, 'shiro', 1, T, ('sash', 0, 24, 14, 12, 8, False, True), ('sash', 3, 24, 14, 6, 8, True, True), ('sash', 6, 32, 14, 8, 8, False, True))],
    joins=[('lean', {})], porch=[(46, 28)]))
add('house_machiya', '町家 2층 목조', 'house', dict(
    w=5, rmat='tairu', rbase=-1, roof=('gable_side', {}),
    floors=[fl(32, 'ita', 0, W, ('lattice', 0, 48), ('lattice', 3, 30)),
            fl(24, 'shiro', 1, P, ('mushiko', 0, 56, 10, 8), ('mushiko', 3, 16, 8, 8))],
    joins=[('lean', {})], porch=[(0, 50)]))
add('house_nagaya', '長屋 단층 연립', 'house', dict(
    w=12, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(32, 'ita', 0, W, ('lattice', 0, 30), ('sash', 2, 24, 14, 4, 8, False, False), ('lattice', 4, 30), ('sash', 6, 24, 14, 4, 8, True, False),
              ('lattice', 8, 30), ('sash', 10, 24, 14, 4, 8, False, False), ('pots', 3, 6, 1), ('pots', 7, 6, 2), ('bikes', 11, 0, 1))],
    joins=[], porch=[(0, 32), (64, 32), (128, 32)]))
add('house_western', '洋館 2층 벽돌집', 'house', dict(
    w=7, rmat='yoru', rbase=0, roof=('gable_front_big', {'rise': 32, 'depth': 14}),
    floors=[fl(32, 'renga', 0, B, ('door', 3, 0), ('sash', 0, 24, 18, 12, 6, True, True), ('sash', 4, 24, 18, 12, 6, True, True)),
            fl(30, 'kinari', 2, P, ('sash', 0, 16, 18, 12, 6, False, True), ('sash', 3, 16, 18, 0, 6, True, True), ('sash', 5, 16, 18, 4, 6, False, True))],
    joins=[('belt', {'mat': 'shiro'})], porch=[(46, 20)]))
add('house_nisetai', '二世帯 2층 주택', 'house', dict(
    w=10, rmat='tairu', rbase=-1, roof=('hip', {'run': 44}),
    floors=[fl(30, 'kinari', 0, P, ('genkan', 0), ('sash', 2, 32, 24, 0, 5, True, True), ('genkan', 6), ('sash', 8, 24, 14, 4, 8, False, True), ('ac', 5, 0)),
            fl(28, 'kinari', 0, P, ('sash', 0, 24, 14, 6, 8, False, True), ('sash', 2, 32, 22, 12, 6, True, True), ('sash', 7, 32, 22, 0, 6, True, True))],
    joins=[('lean_bal', {'bal': (2, 6)})], porch=[(-2, 28), (94, 28)]))
add('house_tile3', '3층 타일 주택', 'house', dict(
    w=5, rmat='tekko', rbase=-1, roof=('shed', {}),
    floors=[fl(30, 'tairu', 1, T, ('garage', 0, 44), ('door', 3, 6)),
            fl(28, 'tairu', 1, T, ('sash', 0, 32, 18, 6, 6, True, False), ('sash', 3, 16, 14, 6, 8, False, True)),
            fl(28, 'tairu', 1, T, ('sash', 0, 16, 14, 8, 8, False, True), ('sash', 2, 32, 14, 6, 8, False, True))],
    joins=[('belt', {}), ('belt', {})], porch=[(50, 20)]))
add('house_terrace', 'テラスハウス 2층 3세대', 'house', dict(
    w=12, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 20), ('ac', 84), ('ac', 148))}),
    floors=[fl(30, 'kinari', 1, S, ('door', 0, 8), ('sash', 1, 32, 22, 12, 6, True, False), ('door', 4, 8), ('sash', 5, 32, 22, 12, 6, False, False),
              ('door', 8, 8), ('sash', 9, 32, 22, 12, 6, True, False)),
            fl(28, 'kinari', 1, S, ('sash', 0, 40, 22, 8, 4, True, False), ('sash', 4, 40, 22, 8, 4, False, False), ('sash', 8, 40, 22, 8, 4, True, False))],
    joins=[('balcony_row', {'unit': 4, 'panel': 'kinari'})]))
add('house_hiraya_gable', '단층 박공집 · 툇마루', 'house', dict(
    w=7, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(30, 'kinari', 1, P, ('lattice', 0, 30), ('sash', 2, 64, 24, 4, 5, True, False), ('pots', 6, 2, 1))],
    joins=[], porch=[(-2, 34), (34, 68)]))

# ── 공동주택 ──
add('mansion4', '4층 맨션', 'apartment', dict(
    w=9, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 100), ('hatch', 10))}),
    floors=[fl(30, 'tairu', 2, T, ('shopglass', 3, 48, 'paper', 0, 2, 'mid'), ('sash', 0, 32, 14, 8, 8, False, True), ('sash', 6, 32, 14, 8, 8, True, True)),
            fl(28, 'tairu', 2, T, ('sash', 0, 32, 22, 8, 4, True, False), ('sash', 3, 32, 22, 8, 4, False, False), ('sash', 6, 32, 22, 8, 4, True, False)),
            fl(28, 'tairu', 2, T, ('sash', 0, 32, 22, 8, 4, False, False), ('sash', 3, 32, 22, 8, 4, True, False), ('sash', 6, 32, 22, 8, 4, False, False)),
            fl(28, 'tairu', 2, T, ('sash', 0, 32, 22, 8, 4, True, False), ('sash', 3, 32, 22, 8, 4, True, False), ('sash', 6, 32, 22, 8, 4, False, False))],
    joins=[('balcony_row', {'unit': 3}), ('balcony_row', {'unit': 3}), ('balcony_row', {'unit': 3})]))
add('mansion6_slim', '6층 슬림 맨션', 'apartment', dict(
    w=5, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 40),)}),
    floors=[fl(30, 'conc', 2, N, ('shopglass', 0, 48, 'paper', 0, 2, 'mid'), ('sash', 3, 16, 14, 6, 8, False, True))] +
           [fl(28, 'conc', 2, N, ('sash', 0, 40, 22, 8, 4, k % 2 == 0, False), ('sash', 3, 16, 14, 6, 8, False, True)) for k in range(5)],
    joins=[('balcony_row', {'unit': 5, 'panel': 'shiro'})] * 5))
add('apart_steel2', '2층 경량철골 아파트', 'apartment', dict(
    w=10, rmat='tekko', rbase=-1, roof=('shed', {}),
    floors=[fl(30, 'hodo', 2, V, ('door', 0, 4), ('sash', 1, 16, 12, 6, 8, True, True), ('door', 3, 4), ('sash', 4, 16, 12, 6, 8, False, True), ('door', 6, 4), ('sash', 7, 16, 12, 6, 8, False, True)),
            fl(28, 'hodo', 2, V, ('door', 0, 4), ('sash', 1, 16, 12, 6, 6, False, True), ('door', 3, 4), ('sash', 4, 16, 12, 6, 6, True, True), ('door', 6, 4), ('sash', 7, 16, 12, 6, 6, False, True))],
    joins=[('corridor', {})], stair=(7, 0)))
add('danchi5', '5층 団地', 'apartment', dict(
    w=14, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 104),)}),
    floors=[fl(30, 'conc', 2, N, ('sash', 0, 32, 14, 8, 8, False, True), ('stairwell', 3, 8), ('sash', 5, 32, 14, 8, 8, True, True), ('sash', 8, 32, 14, 8, 8, False, True), ('stairwell', 10, 8), ('sash', 12, 24, 14, 4, 8, False, True))] +
           [fl(28, 'conc', 2, N, ('sash', 0, 32, 22, 8, 4, k % 2 == 1, False), ('stairwell', 3, 8), ('sash', 5, 32, 22, 8, 4, False, False), ('sash', 8, 32, 22, 8, 4, k % 2 == 0, False), ('stairwell', 10, 8), ('sash', 12, 24, 22, 4, 4, False, False)) for k in range(4)],
    joins=[('balcony_row', {'unit': 14, 'panel': 'conc'})] * 4))

# ── 상점 2차 ──
add('shop_sushi', '寿司屋 초밥집', 'restaurant', dict(
    w=5, rmat='tairu', rbase=-1, roof=('gable_side', {}),
    floors=[fl(56, 'kinari', 1, W, ('sign', 0, 80, 'すし', 'ita', WH, 1, 18), ('lattice', 0, 48), ('noren', 0, 30, 'kon', '', 8), ('pots', 4, 0, 2)),
            fl(28, 'kinari', 1, P, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('lean', {})]))
add('shop_teishoku', '定食屋 백반집', 'restaurant', dict(
    w=5, rmat='yoru', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'kinari', 0, S, ('sign', 0, 80, 'めし処', 'aka', WH, 1, 18), ('shopglass', 0, 80, 'sake', 0, 23, 'left'), ('noren', 0, 26, 'kon', '', 4), ('awning', 0, 80, 'kinari', 0, 23, False)),
            fl(28, 'kinari', 0, S, ('sash', 0, 24, 14, 8, 8, True, True), ('sash', 3, 16, 14, 6, 8, False, True))],
    joins=[('shop_band', {})]))
add('shop_wagashi', '和菓子屋', 'shop', dict(
    w=5, rmat='tairu', rbase=-1, roof=('irimoya', {'inset': 16}),
    floors=[fl(56, 'shiro', 1, P, ('sign', 0, 80, 'だんご', 'ita', WH, 1, 18), ('shopglass', 0, 80, 'sweets', 0, 23, 'left'), ('noren', 0, 26, 'murasaki', '', 4))],
    joins=[]))
add('shop_dagashi', '駄菓子屋', 'shop', dict(
    w=5, rmat='tekko', rbase=-1, roof=('gable_side', {}),
    floors=[fl(56, 'ita', 0, W, ('sign', 0, 80, 'だがし', 'kii', BK, 1, 18), ('shopopen', 0, 80, 'sweets', 0, 23), ('vend', 4, 0)),
            fl(28, 'ita', 0, W, ('sash', 0, 24, 14, 8, 8, False, True))],
    joins=[('lean', {})]))
add('shop_sake', '酒屋 술가게', 'shop', dict(
    w=6, rmat='tairu', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'kinari', 1, W, ('sign', 0, 96, '酒のヤマ', 'ita', WH, 1, 18), ('shopglass', 0, 64, 'sake', 0, 23, 'right'), ('awning', 0, 64, 'midori', 0, 23, False), ('crates', 4, 0, 4, 'kii'), ('vend', 5, 0)),
            fl(28, 'kinari', 1, S, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 32, 14, 8, 8, True, True))],
    joins=[('shop_band', {})]))
add('shop_bicycle', '自転車屋', 'shop', dict(
    w=6, rmat='yoru', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'hodo', 1, V, ('sign', 0, 96, 'サイクル', 'sora', WH, 1, 18), ('shopopen', 0, 96, 'tools', 0, 23), ('bikes', 0, 2, 4)),
            fl(28, 'hodo', 1, V, ('sash', 0, 24, 14, 8, 8, False, True), ('sash', 3, 32, 14, 8, 8, True, True))],
    joins=[('shop_band', {})]))
add('shop_realestate', '不動産屋', 'shop', dict(
    w=5, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 40),)}),
    floors=[fl(56, 'shiro', 2, T, ('sign', 0, 80, '住まい', 'midori', WH, 1, 18), ('shopglass', 0, 80, 'paper', 0, 23, 'right')),
            fl(28, 'shiro', 2, T, ('sash', 0, 40, 14, 8, 8, False, True), ('sash', 3, 16, 14, 6, 8, True, True))],
    joins=[('shop_band', {})]))
add('shop_salon', '美容室', 'shop', dict(
    w=5, rmat='tekko', rbase=0, roof=('shed', {}),
    floors=[fl(56, 'shiro', 2, P, ('sign', 0, 80, 'ヘアー', 'pinku', WH, 1, 18), ('shopglass', 0, 80, 'drug', 0, 23, 'left'), ('pots', 4, 0, 2)),
            fl(28, 'tekko', 0, V, ('sash', 0, 48, 14, 8, 8, False, False))],
    joins=[('shop_band', {})]))

# ── 큰 상업·공공 ──
add('supermarket', 'スーパー 슈퍼마켓', 'commercial', dict(
    w=12, rmat='conc', rbase=0, roof=('flat_sign', {'sign': 'スーパー', 'bg': 'aka', 'sw': 6, 'sx': 3, 'items': (('ac', 10), ('ac', 160))}),
    floors=[fl(44, 'shiro', 2, N, ('shopglass', 0, 192, 'mart', 0, 8, 'mid'), ('awning', 0, 192, 'aka', 0, 4, False), ('bikes', 0, 0, 3), ('bikes', 10, 0, 2))],
    joins=[]))
add('conbini', 'コンビニ 편의점', 'commercial', dict(
    w=8, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 12), ('ac', 30))}),
    floors=[fl(44, 'shiro', 2, N, ('band', 0, 128, 2), ('shopglass', 0, 128, 'mart', 0, 14, 'mid'), ('vend', 7, 0))],
    joins=[]))
add('zakkyo5', '5층 雑居ビル', 'commercial', dict(
    w=5, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 10), ('ac', 50))}),
    floors=[fl(44, 'tairu', 1, T, ('shopglass', 0, 56, 'sake', 0, 8, 'left'), ('door', 4, 0), ('awning', 0, 56, 'aka', 0, 4))] +
           [fl(28, 'tairu', 1, T, ('sash', 0, 48, 14, 4, 8, k % 2 == 0, False)) for k in range(4)],
    joins=[('belt', {})] * 4, after=[lambda cv, g: vsign(cv, g['X1'] - 22, g['ys'][3] + 4, 'カラオケ', 'aka')]))
add('office6', '6층 오피스 빌딩', 'commercial', dict(
    w=7, rmat='conc', rbase=0, roof=('flat', {'items': (('hatch', 6), ('ac', 60), ('ac', 80))}),
    floors=[fl(40, 'conc', 1, N, ('shopglass', 1, 80, 'paper', 0, 6, 'mid'), ('canopy', 1, 80, 0, 2))] +
           [fl(28, 'garasu', 0, 'curtain') for _ in range(5)],
    joins=[('belt', {})] * 5))
add('post_office', '郵便局', 'public', dict(
    w=7, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 20),)}),
    floors=[fl(56, 'shiro', 2, T, ('sign', 1, 80, '郵便局', 'aka', WH, 1, 18), ('shopglass', 0, 96, 'paper', 0, 23, 'mid'), ('postbox', 6, 2)),
            fl(28, 'shiro', 2, T, ('sash', 0, 48, 14, 8, 8, False, True), ('sash', 4, 32, 14, 8, 8, False, True))],
    joins=[('shop_band', {})]))
add('koban', '交番 파출소', 'public', dict(
    w=4, rmat='yoru', rbase=0, roof=('gable_front_big', {'rise': 22, 'depth': 10}),
    floors=[fl(52, 'shiro', 2, T, ('sign', 0, 64, '交番', 'kon', WH, 1, 18), ('door', 1, 8), ('sash', 3, 12, 12, 0, 30, False, False))],
    joins=[], after=[lambda cv, g: red_lamp(cv, g['X0'] + 29, g['ys'][0] - 12)]))
add('clinic', '内科 의원', 'public', dict(
    w=7, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 90),)}),
    floors=[fl(56, 'shiro', 2, T, ('sign', 1, 80, 'やま医院', 'midori', WH, 1, 18), ('shopglass', 2, 48, 'paper', 0, 23, 'mid'), ('sash', 0, 24, 14, 4, 30, False, False), ('sash', 5, 24, 14, 4, 30, False, False), ('pots', 6, 4, 1)),
            fl(28, 'shiro', 2, T, ('sash', 0, 32, 14, 8, 8, False, True), ('sash', 4, 32, 14, 8, 8, True, True))],
    joins=[('shop_band', {})]))
add('sento', '銭湯 대중목욕탕', 'public', dict(
    w=9, rmat='tairu', rbase=-1, roof=('irimoya', {'inset': 30}),
    floors=[fl(62, 'kinari', 0, W, ('sign', 3, 48, '湯', 'kon', WH, 1, 18), ('lattice', 2, 80), ('karahafu', 2, 88, -4, 25), ('noren', 3, 40, 'kon', 'ゆ', 4, 40),
              ('sash', 0, 24, 14, 6, 34, False, False), ('sash', 7, 24, 14, 2, 34, False, False))],
    joins=[], after=[lambda cv, g: chimney(cv, g['X1'] - 16, g['yf'] - 60, 80)]))
add('kindergarten', '保育園', 'public', dict(
    w=9, rmat='aka', rbase=0, roof=('gable_side', {}),
    floors=[fl(34, 'kinari', 2, P, ('sign', 3, 48, '保育園', 'midori', WH, 0, 18) if False else ('door', 4, 0), ('sash', 0, 48, 24, 8, 6, True, False), ('sash', 6, 40, 24, 0, 6, True, False), ('pots', 3, 0, 2)),
            fl(28, 'kinari', 2, P, ('sign', 2, 80, 'さくら園', 'midori', WH, 4, 18), ('sash', 0, 24, 14, 4, 8, False, True), ('sash', 7, 24, 14, 4, 8, False, True))],
    joins=[('belt', {'mat': 'kii'})]))

# ── 시장·공장 ──
add('market_hall', '市場 시장 건물', 'commercial', dict(
    w=12, rmat='tekko', rbase=0, roof=('gable_front_big', {'rise': 30, 'depth': 12}),
    floors=[fl(56, 'conc', 1, N, ('sign', 3, 96, 'いちば', 'aka', WH, 1, 18),
              ('shopopen', 0, 56, 'veg', 4, 23), ('shopopen', 4, 56, 'fish', 4, 23), ('shopopen', 8, 56, 'fruit', 4, 23),
              ('awning', 0, 64, 'midori', 0, 23), ('awning', 4, 64, 'sora', 0, 23), ('awning', 8, 64, 'daidai', 0, 23))],
    joins=[]))
add('factory', '町工場 공장', 'industrial', dict(
    w=9, rmat='tekko', rbase=0, roof=('sawtooth', {'n': 3, 'rise': 18, 'depth': 10}),
    floors=[fl(44, 'hodo', 1, V, ('garage', 0, 64), ('door', 5, 0), ('sash', 6, 32, 12, 8, 8, False, False), ('sign', 5, 64, '工場', 'kon', WH, 22, 18) if False else ('crates', 7, 4, 2, 'sora'))],
    joins=[]))
add('warehouse', '倉庫 창고', 'industrial', dict(
    w=8, rmat='tekko', rbase=-1, roof=('gable_front_big', {'rise': 26, 'depth': 12}),
    floors=[fl(48, 'tekko', 0, V, ('garage', 1, 64), ('door', 6, 0))],
    joins=[]))
add('garage_carport_house', '단층 차고 딸린 집', 'house', dict(
    w=8, rmat='yoru', rbase=0, roof=('shed', {}),
    floors=[fl(30, 'kinari', 2, P, ('door', 0, 8), ('sash', 1, 40, 22, 12, 6, True, False), ('garage', 5, 44))],
    joins=[], porch=[(6, 22)]))


# ── 셔터 내린 가게(シャッター街, 빈 점포율 13.6% — 58% 는 간판을 단 채 셔터만 내림) ──
_FRONT = ('shopopen', 'shopglass', 'awning', 'noren', 'lattice', 'lantern', 'crates', 'bikes', 'pots', 'vend', 'barber', 'postbox')


def _shut(src, paper=False, sign=None):
    """src 가게의 1층 정면을 내린 셔터로 바꾼 사본. 정면 폭·높이는 원래 쇼윈도/열린 가게 부품에서 가져온다."""
    import copy
    name, cat, r = CATALOG[src]
    r = copy.deepcopy(r)
    f0 = r['floors'][0]
    front = next(it for it in f0['items'] if it[0] in ('shopopen', 'shopglass'))
    items = [it for it in f0['items'] if it[0] not in _FRONT]
    if sign is not None:
        items = [(it[:3] + (sign,) + it[4:]) if it[0] == 'sign' else it for it in items]
    items.append(('shutter', 0, front[2], front[4], front[5], paper))
    f0['items'] = items
    return r


for _src, _paper in (('shop_fish', False), ('shop_butcher', False), ('shop_books', True), ('shop_cleaning', False),
                     ('shop_bicycle', False), ('shop_sake', True), ('shop_flower', False), ('shop_realestate', False)):
    add(_src + '_shut', CATALOG[_src][0] + ' · 셔터 내림', 'shop', _shut(_src, _paper))
add('shop_vacant', '빈 점포 · テナント募集', 'shop', _shut('shop_pharmacy', True, ''))


# ── 동네 거점(조사 03: 역·학교·신사·코인 세탁소·町工場·주유소) ──
add('coin_laundry', 'コインランドリー 코인 세탁소', 'commercial', dict(
    w=6, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 14), ('ac', 60))}),
    floors=[fl(52, 'shiro', 2, T, ('sign', 0, 96, 'ランドリー', 'sora', WH, 1, 18), ('washers', 0, 96, 0, 23))],
    joins=[]))
add('machikoba_home', '町工場 · 2층 살림집', 'industrial', dict(
    w=6, rmat='tekko', rbase=0, roof=('shed', {}),
    floors=[fl(44, 'tekko', 0, V, ('garage', 0, 64), ('door', 4, 8)),
            fl(28, 'kinari', 1, S, ('sash', 0, 32, 14, 8, 8, True, True), ('sash', 3, 24, 14, 8, 8, False, True))],
    joins=[('belt', {})]))
add('station_small', 'さくら駅 작은 역사', 'public', dict(
    w=12, rmat='kawara', rbase=0, roof=('hip', {'run': 40}),
    floors=[fl(48, 'shiro', 2, P, ('sign', 3, 96, 'さくら駅', 'kon', WH, 1, 18), ('shopglass', 3, 96, 'paper', 0, 24, 'mid'),
              ('vend', 0, 6), ('vend', 1, 8), ('sash', 9, 40, 14, 4, 26, False, False))],
    joins=[], after=[lambda cv, g: LP.clock(cv, g['X0'] + 96, g['ys'][0] - 12, 6)]))
add('school', '小学校 교사(3층)', 'public', dict(
    w=18, rmat='conc', rbase=0, roof=('flat', {'items': (('tank', 24), ('hatch', 250))}),
    floors=[fl(38, 'shiro', 2, N, *[('sash', c, 40, 18, 4, 8, False, False) for c in (0, 3, 12, 15)], ('shopglass', 7, 64, 'paper', 0, 6, 'mid')),
            fl(38, 'shiro', 2, N, *[('sash', c, 40, 18, 4, 8, False, False) for c in (0, 3, 12, 15)], ('sash', 8, 32, 14, 0, 10, False, False)),
            fl(38, 'shiro', 2, N, *[('sash', c, 40, 18, 4, 8, False, False) for c in (0, 3, 12, 15)])],
    joins=[('belt', {'mat': 'conc'}), ('belt', {'mat': 'conc'})],
    after=[lambda cv, g: LP.clock(cv, g['X0'] + 144, g['ys'][2] + 16, 8)]))
add('school_gym', '小学校 체육관', 'public', dict(
    w=12, rmat='tekko', rbase=0, roof=('gable_side', {}),
    floors=[fl(56, 'conc', 1, N, *[('sash', c, 32, 10, 8, 6, False, False) for c in (0, 3, 6, 9)], ('door', 4, 0), ('door', 7, 0))],
    joins=[]))
add('shrine_haiden', '神社 拝殿', 'public', dict(
    w=6, rmat='kawara', rbase=-1, roof=('irimoya', {'inset': 22}),
    floors=[fl(44, 'ita', 0, W, ('lattice', 1, 64), ('saisen', 2, 4), ('suzu', 3, 0, 6, 16))],
    joins=[], after=[lambda cv, g: (LP.posts(cv, g['X0'] + 2, g['ys'][0], 44), LP.posts(cv, g['X1'] - 7, g['ys'][0], 44),
                                    LP.shimenawa(cv, g['X0'] + 10, g['X1'] - 10, g['ys'][0] + 2))]))
add('gas_office', '給油所 사무소', 'commercial', dict(
    w=5, rmat='conc', rbase=0, roof=('flat', {'items': (('ac', 40),)}),
    floors=[fl(46, 'shiro', 2, T, ('band', 0, 80, 2, (('aka', 1), ('shiro', 2), ('aka', 1))), ('shopglass', 0, 80, 'mart', 0, 14, 'left'))],
    joins=[]))


def render(out, names=None):
    os.makedirs(out, exist_ok=True)
    res = {}
    for id_, (name, cat, r) in CATALOG.items():
        if names and id_ not in names: continue
        cv, m = hk.build(r)
        cv.save(os.path.join(out, f'{id_}.png'))
        res[id_] = (cv, m)
    return res


def sheet(out, res, cols=6, z=2):
    """한 장 비교판: 바닥선 정렬, 이름 없이(캡션은 HTML 이 단다)."""
    from PIL import Image
    ids = list(res)
    rows = [ids[i:i + cols] for i in range(0, len(ids), cols)]
    pad = 8
    rh = [max(res[i][0].h for i in row) + pad for row in rows]
    W = max(sum(res[i][0].w for i in row) + pad * (len(row) + 1) for row in rows)
    im = Image.new('RGBA', (W, sum(rh) + pad), (104, 103, 122, 255))
    y = pad
    for row, h in zip(rows, rh):
        x = pad
        for i in row:
            a = res[i][0].img(); gy = y + h - pad - (res[i][0].h - res[i][1]['ground'])
            im.alpha_composite(a, (x, y + h - pad - a.height)); x += a.width + pad
        y += h
    im.resize((im.width * z, im.height * z), Image.NEAREST).save(out)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/jp-catalog'
    res = render(out, set(sys.argv[2:]) or None)
    sheet(os.path.join(out, '_sheet.png'), res)
    print(len(res), out)


def town(out, rows):
    """줄마다 건물을 붙여 세운 거리(보도 + 차도) — 비교·검토용 장면."""
    import numpy as np
    from house_kit import Cv, K, gravel, hero, blit
    built = {n: hk.build(CATALOG[n][2]) for row in rows for n in row}
    trim = {}
    for n, (cv, m) in built.items():
        a = cv.a; xs = np.where(a[:, :, 3].max(0) > 0)[0]
        trim[n] = (a[:, xs.min():xs.max() + 1], m)
    widths = [sum(trim[n][0].shape[1] for n in row) + 6 * (len(row) + 1) for row in rows]
    rowh = max(trim[n][0].shape[0] for row in rows for n in row) + 34
    S = Cv(max(widths), rowh * len(rows))
    for ri, row in enumerate(rows):
        oy = ri * rowh
        gravel(S, 0, oy, S.w, rowh - 34, 'hodo', 1)
        S.R(0, oy + rowh - 34, S.w, 12, K('hodo', 2)); S.HL(0, oy + rowh - 34, S.w, K('hodo', 3))
        for x in range(0, S.w, 16): S.VL(x, oy + rowh - 33, 11, K('hodo', 0))
        S.HL(0, oy + rowh - 22, S.w, K('hodo', -2))
        S.R(0, oy + rowh - 21, S.w, 21, K('yoru', 0))
        for x in range(S.w):
            for y in range(oy + rowh - 21, oy + rowh):
                if (x * 3 + y * 7) % 11 == 0: S.P(x, y, K('yoru', 1))
        gy = oy + rowh - 33
        x = 6
        for n in row:
            a, m = trim[n]; msk = a[:, :, 3] > 0
            top = gy - m['ground'] - 1
            S.a[top:top + a.shape[0], x:x + a.shape[1]][msk] = a[msk]
            x += a.shape[1] + 6
        hb = Cv(16, 24); hero(hb, 0, 0); blit(S, hb, 40 + ri * 90, gy - 16)
    S.save(out)
