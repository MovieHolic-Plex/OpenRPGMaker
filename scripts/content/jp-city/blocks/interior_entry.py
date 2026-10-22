#!/usr/bin/env python3
"""jp_city 블록 interior_entry — 일본 실내: 현관(아가리카마치·게타바코)·계단·문·창·벽걸이.
  python3 scripts/content/jp-city/blocks/interior_entry.py     # selftest + tiledata/jp-city/blocks/interior_entry/_all-x3.png
1칸 = 16px = 1m. 모든 물건은 재질 짙은 테두리 + 밝은 윗면 + 어두운 앞면 + 아래 그늘. 문은 벽면 장식(실제 통로 아님)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, default_ceiling, run_block, ROOT   # noqa: E402,F401
import stairart as SA   # noqa: E402

BLOCK = 'interior_entry'
R = Registry(BLOCK, '현관·계단·창')

W_ = lambda t: K('ita', t)          # 나무
SH = lambda t: K('shiro', t)        # 흰 벽·종이
ST = lambda t: K('tekko', t)        # 알루미늄·쇠
GL = lambda t: K('garasu', t)       # 유리


def box(c, x, y, w, h, fill, edge):
    """테두리 있는 칠한 사각형."""
    c.R(x, y, w, h, edge); c.R(x + 1, y + 1, w - 2, h - 2, fill)


# ───────────────────────── 현관 ─────────────────────────
@R.obj('agarikamachi', '현관 단(上がり框)', kind='flat', cat='home', cat_ko='집', tags=('현관', '단', '玄関'), place='마루 바닥 맨 아랫줄(타타키와 맞닿는 줄)에 가로로 이어 깐다',
       desc='마루와 타타키 사이 나무 단 가장자리(上がり框). 가로로 이어 붙는 1×1. 마루 맨 아랫줄에 한 줄로 깐다 — 위쪽은 투명이라 마루 무늬가 보인다.')
def _agari(c):
    # 위 8줄은 투명(마루가 보인다). 밝은 모서리 두 줄 → 마루보다 한 단 어두운 단 앞면(챌판) → 맨 아래 그늘 = 타타키보다 높은 단.
    c.HL(0, 8, 16, W_(-3))
    c.R(0, 9, 16, 2, W_(2)); c.HL(0, 9, 16, W_(3))
    c.R(0, 11, 16, 4, W_(-1)); c.HL(0, 11, 16, W_(0))
    for x in (5, 13): c.VL(x, 12, 3, W_(-2))                    # 앞면 판 이음
    c.HL(0, 15, 16, W_(-3))


def _getabako(c, w):
    pw = w * 16
    c.R(0, 8, pw, 24, W_(-3))                         # 테두리
    c.R(1, 9, pw - 2, 4, W_(2)); c.HL(1, 9, pw - 2, W_(3))   # 윗면
    c.HL(1, 13, pw - 2, W_(1))
    c.HL(1, 14, pw - 2, W_(-3)); c.HL(1, 15, pw - 2, W_(-2))  # 처마 그늘
    c.R(1, 16, pw - 2, 14, W_(0))
    n = w                                              # 문짝 수 = 칸 수
    dw = (pw - 2) // n
    for i in range(n):
        x0 = 1 + i * dw
        c.R(x0, 16, dw - 1, 14, W_(-2))
        c.R(x0 + 1, 17, dw - 3, 12, W_(1))
        for ly in (19, 22, 25):                        # 루버 칸살
            c.HL(x0 + 2, ly, dw - 5, W_(-1)); c.HL(x0 + 2, ly + 1, dw - 5, W_(2))
        c.R(x0 + dw - 4 if i % 2 == 0 else x0 + 2, 22, 1, 3, ST(2))   # 손잡이
    c.HL(1, 30, pw - 2, W_(-2)); c.HL(0, 31, pw, W_(-3))


@R.obj('getabako', '신발장(下駄箱)', kind='floor', w=2, h=1, up=16, surface=True, tags=('현관', '신발장', '수납'), place='현관 타타키 한쪽(옆벽 곁) — 북쪽 벽이 없어도 선다', pair=('shoes-pair', 'slippers', 'umbrella-stand'),
        desc='루버 문 두 짝 신발장(下駄箱). 윗면에 열쇠·꽃병 같은 탁상 물건을 올릴 수 있다. 2×1.')
def _gb2(c): _getabako(c, 2)


@R.obj('getabako-narrow', '좁은 신발장', kind='floor', w=1, h=1, up=16, surface=True, tags=('현관', '신발장', '수납'), place='현관 타타키 한쪽(옆벽 곁)', pair=('umbrella-stand',),
        desc='한 칸 폭 신발장. 윗면에 물건을 올릴 수 있다.')
def _gb1(c): _getabako(c, 1)


@R.obj('genkan-mat', '현관 매트', w=2, h=1, kind='flat', tags=('현관', '매트', '깔개'), place='아가리카마치 바로 위 마루(신발을 벗고 올라선 자리)',
       desc='현관 마루 쪽 매트(玄関マット). 2×1 평면 깔개 — 베이지 바탕·붉은 갈색 테두리·양 끝 술. 아가리카마치 띠 바로 위 마루 줄에 깐다(타타키가 아니다).')
def _mat(c):
    MO, MB, ML, MD = K('soil', -2), K('kinari', 0), K('kinari', 1), K('kinari', -1)
    c.R(3, 3, 26, 10, MO)                                         # 외곽
    c.R(4, 4, 24, 8, K('daidai', -1))                             # 테두리
    c.R(6, 5, 20, 6, MB); c.HL(6, 5, 20, ML)                      # 바탕 + 위 빛
    for x in range(8, 25, 4):                                     # 짠 무늬(마름모 점)
        c.P(x, 7, MD); c.P(x + 1, 8, MD); c.P(x, 9, MD); c.P(x - 1, 8, MD)
    c.HL(4, 11, 24, K('daidai', -2))                              # 아래 테두리 그늘
    for y in range(4, 12):                                        # 양 끝 술(두 칸 폭, 한 줄씩 밝음·어두움)
        col = ML if y % 2 == 0 else MD
        c.R(1, y, 2, 1, col); c.R(29, y, 2, 1, col)
    c.HL(4, 13, 24, K('ita', -3))                                 # 바닥 그늘


@R.obj('slippers', '슬리퍼', kind='flat', tags=('현관', '슬리퍼', '신발'), place='아가리카마치 위 마루(매트 옆), 발끝이 집 안(북쪽)을 향하게',
       desc='현관 마루에 가지런히 놓인 손님용 슬리퍼 한 켤레(위에서 본 납작한 모양: 남색 발등 띠 + 밝은 바닥 깔창). 1×1 평면.')
def _slip(c):
    G = ('.oooo.',
         'oBBBBo',
         'oBbbBo',
         'oBBBBo',
         'oddddo',
         'oiiiio',
         'oiIiio',
         'oiiiio',
         'oiiiio',
         '.oiio.',
         '..oo..')
    COL = {'o': K('yoru', -2), 'B': K('kon', 0), 'b': K('kon', 1), 'd': K('kon', -2), 'i': K('kinari', 0), 'I': K('kinari', 1)}
    for x0 in (2, 8):
        for r, row in enumerate(G):
            for i, ch in enumerate(row):
                if ch in COL: c.P(x0 + i, 2 + r + (1 if x0 == 8 else 0), COL[ch])
        c.HL(x0 + 1, 13 + (1 if x0 == 8 else 0), 4, K('ita', -3))   # 그늘


@R.obj('shoes-pair', '신발 한 켤레', kind='flat', tags=('현관', '신발', '타타키'), place='타타키 위, 신발장 앞', desc='타타키에 벗어 둔 구두 한 켤레. 1×1 평면.')
def _shoes(c):
    # 비스듬히 내려다본 구두 두 짝(뒤꿈치 왼쪽·코 오른쪽, 옆면이 보인다). 13×7 글자 지도:
    # o 외곽 · b 몸통 · h 입구 테 · d 입구 구멍 · t 혀(끈 자리) · s 코 캡 이음 · c 코 윤 · l 밑창 · m 밑창 그늘
    G = ('.oooooo......',
         'ohhhhhho.....',
         'ohddddhtto...',
         'obbbbbbtbbbo.',
         'obbbbbbbsbccbo'[:13],
         'ollllllllllllo'[:13],
         '.mmmmmmmmmmm.')
    COL = {'o': K('yoru', -3), 'b': K('yoru', 1), 'h': K('yoru', 3), 'd': K('yoru', -3), 't': K('yoru', 2),
           's': K('yoru', -1), 'c': K('yoru', 3), 'l': K('ita', 2), 'm': K('ita', -2)}
    for (x0, y0) in ((1, 2), (2, 9)):
        for r, row in enumerate(G):
            for i, ch in enumerate(row):
                if ch in COL: c.P(x0 + i, y0 + r, COL[ch])


@R.obj('umbrella-stand', '우산꽂이', up=8, kind='floor', tags=('현관', '우산', '소품'), place='현관 신발장 옆', pair=('getabako',),
       desc='우산 두 자루가 꽂힌 통(傘立て). 1×1, 위로 우산 손잡이가 솟는다.')
def _umb(c):
    # 우산 (뒤에서)
    c.R(5, 8, 1, 14, ST(-1)); c.R(10, 10, 1, 12, ST(-1))
    c.R(4, 6, 3, 2, W_(0)); c.P(4, 5, W_(1)); c.R(4, 5, 1, 1, W_(-2))
    c.R(9, 8, 3, 2, W_(0)); c.P(11, 7, W_(1))
    c.R(4, 13, 3, 9, K('kon', -1)); c.VL(4, 13, 9, K('kon', -2)); c.VL(5, 13, 9, K('kon', 0))
    c.R(9, 15, 3, 7, K('aka', -1)); c.VL(9, 15, 7, K('aka', -2)); c.VL(10, 15, 7, K('aka', 0))
    # 통
    c.R(3, 21, 10, 11, ST(-3)); c.R(4, 22, 8, 9, ST(0))
    c.R(4, 21, 8, 2, ST(-2)); c.HL(5, 21, 6, ST(-3))              # 입구 타원
    c.VL(4, 23, 7, ST(2)); c.VL(11, 23, 7, ST(-2)); c.HL(4, 30, 8, ST(-2)); c.HL(3, 31, 10, ST(-3))


# ───────────────────────── 계단 ─────────────────────────
def _stairs(c, w):
    """북쪽 벽 앞에 서서 천장 구멍으로 오르는 나무 계단 — interior/stairart.py up_stairs(2026-10-22 다시 그림)."""
    SA.up_stairs(c, w, 'wood', left='wall', right='balustrade')


@R.obj('stairs-up-wood', '나무 계단(올라가는, 1칸 폭)', w=1, h=1, up=32, kind='wall', walk=[(0, 0)], stairs='up', use=('travel',), tags=('계단', '2층', '階段'),
       place='복도 북쪽 벽 바로 아래(벽 가구 자리)', desc='북쪽 벽 앞에 서서 천장 구멍(위층 바닥 밑 어둠)으로 오르는 한 칸 폭 나무 계단. 단마다 밝은 디딤판 + 어두운 챌판, 위로 갈수록 단이 낮고 어두워진다. 왼쪽 벽 손잡이, 오른쪽(트인 쪽) 난간동자·손잡이·아래 기둥. 올라가는 계단 — 들어서는 쪽: 남쪽 앞 칸(발칸 바로 아래 바닥). 오를 때 보는 방향: 북쪽(화면 위). 발칸에서 북쪽으로 걸으면 위층으로 이동하고, 위층 stairwell-down-wood(내려가는 계단 구멍) 남쪽 앞 칸에 계단을 등지고 남쪽(아래)을 보고 선다.')
def _st1(c): _stairs(c, 1)


@R.obj('stairs-up-wood-wide', '나무 계단(올라가는, 2칸 폭)', w=2, h=1, up=32, kind='wall', walk=[(0, 0), (1, 0)], stairs='up', use=('travel',), tags=('계단', '2층', '階段'),
       place='복도 북쪽 벽 바로 아래', desc='2칸 폭 나무 계단 — 한 칸 폭과 같은 짜임(밝은 디딤판·어두운 챌판, 위로 갈수록 어둡게 천장 구멍으로), 왼쪽 벽 손잡이, 오른쪽 난간·아래 기둥. 올라가는 계단 — 들어서는 쪽: 남쪽 앞 칸(발칸 바로 아래 바닥). 오를 때 보는 방향: 북쪽(화면 위). 발칸에서 북쪽으로 걸으면 위층으로 이동하고, 위층 stairwell-down-wood(내려가는 계단 구멍) 남쪽 앞 칸에 계단을 등지고 남쪽(아래)을 보고 선다.')
def _st2(c): _stairs(c, 2)


@R.obj('stairwell-down-wood', '내려가는 나무 계단 구멍(난간)', w=2, h=2, up=16, kind='floor', use=('travel',), stairs='down', walk=((0, 1), (1, 1)), tags=('계단', '2층', '階段', '난간'),
       place='2층 복도 한쪽', desc='2층 바닥에 뚫린 2×2 계단 구멍. 북·동·서 바닥 턱 위에 나무 난간, 남쪽만 열린 입구. 디딤판이 북쪽으로 한 단씩 낮아지며 어두워지고 북쪽 끝은 검은 구멍 벽. 윗줄(구멍)은 막히고 아랫줄 두 칸을 밟는다. 내려가는 계단 — 들어서는 쪽: 남쪽 앞 칸(키트 바로 아래 바닥, 북·동·서는 난간·턱으로 막힘). 내려갈 때 보는 방향: 북쪽(화면 위, 구멍 속 어둠 쪽). 아랫줄 두 칸(밟는 칸)에 들어서면 아래층으로 이동하고, 아래층 stairs-up-wood(올라가는 계단) 남쪽 앞 칸에 계단을 등지고 남쪽(아래)을 보고 선다. 바닥 세 줄(구멍 줄·밟는 줄·앞 칸)이 필요하다 — 벽면 아랫줄 바로 아래 첫 바닥 줄부터 놓는다(난간 윗부분이 벽면 아랫줄 위로 솟는다).')
def _well(c):
    SA.down_well(c, 'wood')


# ───────────────────────── 문 (벽면 장식 + 이벤트 자리 — 실제 통로 아님) ─────────────────────────
DOOR_NOTE = ' 벽면 위의 닫힌 문 그림(장식+이벤트 칸, use 열기/이동) — 실제 통로가 아니며 칸막이 틈에 걸지 않는다.'


@R.obj('door-western', '양실 문', w=1, kind='hang', hrows=2, use=('open', 'travel'), tags=('문', '방', '양실', 'ドア'), place='방 북쪽 벽면', desc='나무 여닫이 문(洋室ドア). 패널 2장·손잡이.' + DOOR_NOTE)
def _dw(c):
    c.R(1, 0, 14, 32, W_(-3)); c.R(2, 1, 12, 31, W_(-1))
    c.R(3, 2, 10, 30, W_(0))
    box(c, 4, 4, 8, 11, W_(1), W_(-1)); c.HL(5, 5, 6, W_(3)); c.VL(5, 5, 9, W_(2))
    box(c, 4, 17, 8, 12, W_(1), W_(-1)); c.HL(5, 18, 6, W_(3)); c.VL(5, 18, 10, W_(2))
    c.R(11, 15, 2, 2, ST(2)); c.P(11, 15, ST(3)); c.R(11, 17, 2, 1, ST(-2))     # 손잡이
    c.HL(1, 31, 14, W_(-3)); c.HL(2, 30, 12, W_(-2))


def _shoji_paper(c, x, y, w, h, gx=6, gy=6):
    c.R(x, y, w, h, SH(1))
    for i in range(x, x + w, gx): c.VL(i, y, h, W_(1))
    for j in range(y, y + h, gy): c.HL(x, j, w, W_(1))
    c.HL(x, y + h - 1, w, SH(-1))


@R.obj('oshiire', '오시이레(押入れ)', w=2, kind='hang', hrows=2, use=('open',), tags=('문', '화실', '수납', '押入れ'), place='화실 벽면', desc='위·아래 두 칸 붙박이장. 오른쪽 위 칸이 열려 이불이 보인다.' + DOOR_NOTE)
def _oshi(c):
    c.R(1, 0, 30, 32, W_(-3)); c.R(2, 1, 28, 31, W_(-1))
    # 왼쪽: 닫힌 후스마 위·아래
    for (y0, h) in ((2, 13), (17, 13)):
        c.R(3, y0, 13, h, K('kinari', 1)); c.HL(3, y0, 13, K('kinari', 2)); c.HL(3, y0 + h - 1, 13, K('kinari', 0))
        c.R(13, y0 + h // 2 - 1, 2, 3, W_(-3))
    # 오른쪽 아래: 닫힘
    c.R(17, 17, 12, 13, K('kinari', 1)); c.HL(17, 17, 12, K('kinari', 2)); c.HL(17, 29, 12, K('kinari', 0)); c.R(18, 22, 2, 3, W_(-3))
    # 오른쪽 위: 열림 — 안쪽 어둠 + 이불 더미
    c.R(17, 2, 12, 13, K('yoru', -2)); c.HL(17, 2, 12, K('yoru', -3))
    c.R(18, 4, 10, 3, K('yoru', -1)); c.R(18, 8, 10, 6, SH(0))
    c.R(18, 8, 10, 2, SH(2)); c.HL(18, 11, 10, K('kon', 0)); c.R(18, 12, 10, 2, K('aka', 0)); c.HL(18, 13, 10, K('aka', -1))
    c.HL(18, 14, 10, SH(-2))
    c.R(16, 15, 14, 2, W_(0)); c.HL(16, 15, 14, W_(2)); c.HL(16, 16, 14, W_(-2))   # 가운데 선반
    c.HL(1, 31, 30, W_(-3))


# ───────────────────────── 창 ─────────────────────────
def _sill(c, x, y, w):
    c.R(x - 1, y, w + 2, 2, ST(2)); c.HL(x - 1, y, w + 2, ST(3)); c.HL(x - 1, y + 1, w + 2, ST(0))
    c.HL(x, y + 2, w, SH(-2))


@R.obj('window-sash', '새시 창 + 레이스 커튼', w=2, kind='hang', hrows=2, tags=('창', '새시', '거실', '커튼', '窓'), place='거실·방 벽면', desc='알루미늄 새시 미닫이 창 + 양옆 레이스 커튼. 가운데 문틀.')
def _sash(c):
    c.R(2, 4, 28, 22, ST(-3)); c.R(3, 5, 26, 20, ST(0))
    for x0 in (4, 16):
        c.R(x0, 6, 12, 18, ST(-2)); c.R(x0 + 1, 7, 10, 16, GL(0))
        c.R(x0 + 1, 7, 10, 3, GL(1)); c.R(x0 + 2, 8, 1, 6, GL(2))
    c.R(15, 6, 2, 18, ST(-1))
    c.HL(2, 4, 28, ST(2)); c.HL(1, 3, 30, W_(-2)); c.HL(1, 2, 30, W_(0))             # 커튼 봉
    for (x0, x1) in ((3, 11), (21, 29)):                                         # 레이스 커튼 — 세로 주름 줄무늬(4px 주기: 접힌 골·면·밝은 마루·면)
        for y in range(3, 25):
            for x in range(x0, x1):
                if y < 5: col = SH(1)                                          # 윗단(봉에 모인 부분)
                else: col = (SH(0), SH(2), SH(3), SH(2))[(x - x0) % 4]
                c.P(x, y, col)
        c.VL(x0, 3, 22, SH(-1)); c.VL(x1 - 1, 3, 22, SH(-1)); c.HL(x0, 24, x1 - x0, SH(0))
    _sill(c, 3, 25, 26)


@R.obj('window-sash-small', '작은 불투명 창', w=1, kind='hang', hrows=1, tags=('창', '작은 창', '화장실', '욕실', '窓'), place='화장실·욕실·계단참 벽면', desc='알루미늄 틀의 작은 불투명 유리창. 1칸, 벽면 윗줄에만 걸린다.')
def _sashs(c):
    c.R(2, 2, 12, 11, ST(-3)); c.R(3, 3, 10, 9, ST(0)); c.R(4, 4, 8, 7, GL(-1))
    for (x, y) in ((5, 5), (7, 7), (9, 5), (6, 9), (10, 9), (8, 5), (5, 8)): c.P(x, y, GL(1))
    c.R(4, 4, 8, 1, GL(2)); c.VL(7, 4, 7, ST(-1))
    c.HL(2, 2, 12, ST(2)); c.HL(1, 13, 14, ST(3)); c.HL(1, 14, 14, ST(0)); c.HL(2, 15, 12, SH(-2))


@R.obj('shoji-window', '쇼지 창', w=2, kind='hang', hrows=2, tags=('창', '화실', '障子'), place='화실 벽면', desc='나무틀에 격자 + 흰 종이를 바른 쇼지 창. 밑에 창턱.')
def _shojiw(c):
    c.R(2, 3, 28, 23, W_(-3)); c.R(3, 4, 26, 21, W_(0))
    _shoji_paper(c, 4, 5, 24, 19, 6, 6)
    c.R(15, 4, 2, 21, W_(-1)); c.VL(15, 4, 21, W_(1))
    c.HL(2, 3, 28, W_(2))
    c.R(1, 25, 30, 2, W_(2)); c.HL(1, 25, 30, W_(3)); c.HL(1, 26, 30, W_(-1)); c.HL(2, 27, 28, SH(-2))


@R.obj('curtain-window', '두꺼운 커튼 창', w=2, kind='hang', hrows=2, tags=('창', '커튼', '침실', '거실', 'カーテン'), place='침실·거실 벽면', desc='두꺼운 주름 커튼 + 가운데로 보이는 유리. 침실·거실.')
def _curt(c):
    c.R(8, 5, 16, 19, ST(-3)); c.R(9, 6, 14, 17, GL(0)); c.R(9, 6, 14, 3, GL(1)); c.R(10, 7, 1, 8, GL(2))
    c.R(15, 6, 2, 17, ST(-1))
    for (x0, x1) in ((2, 11), (21, 30)):
        for x in range(x0, x1):
            t = (x - x0) % 3
            col = K('midori', 1 if t == 1 else (0 if t == 0 else -1))
            c.VL(x, 3, 24, col)
        c.VL(x0, 3, 24, K('midori', -2)); c.VL(x1 - 1, 3, 24, K('midori', -2)); c.HL(x0, 26, x1 - x0, K('midori', -2))
    c.R(1, 1, 30, 3, W_(-2)); c.HL(1, 1, 30, W_(2)); c.HL(1, 3, 30, W_(-3))                    # 봉
    for x in range(3, 30, 4): c.P(x, 4, W_(-3))
    c.HL(2, 27, 28, SH(-2))


# ───────────────────────── 벽걸이 ─────────────────────────
@R.obj('ac-unit', '에어컨', w=2, kind='hang', hrows=1, tags=('벽걸이', '에어컨', '가전', 'エアコン'), place='거실·방 벽면 윗줄', desc='벽걸이 에어컨. 2칸 폭, 벽면 맨 윗줄.')
def _ac(c):
    c.R(1, 2, 30, 10, K('conc', -2)); c.R(2, 3, 28, 8, SH(0))
    c.HL(2, 3, 28, SH(2)); c.HL(2, 4, 28, SH(1))
    c.R(2, 9, 28, 2, SH(-1)); c.HL(3, 9, 26, SH(-2)); c.HL(2, 11, 28, K('conc', -1))
    c.R(24, 6, 2, 1, K('midori', 1)); c.P(27, 6, K('aka', 0))
    c.HL(2, 12, 28, SH(-2))


@R.obj('wall-clock', '벽시계', kind='hang', hrows=1, tags=('벽걸이', '시계', '時計'), place='벽면 윗줄', desc='둥근 벽시계. 1칸.')
def _clock(c):
    for (x, y) in ((6, 2), (7, 2), (8, 2), (9, 2), (5, 3), (10, 3), (4, 4), (11, 4), (4, 5), (11, 5), (4, 6), (11, 6), (4, 7), (11, 7), (4, 8), (11, 8), (5, 9), (10, 9), (6, 10), (7, 10), (8, 10), (9, 10)):
        c.P(x, y, W_(-3))
    c.R(5, 3, 6, 7, SH(2)); c.R(6, 4, 4, 5, SH(2)); c.R(4, 5, 8, 3, SH(2)); c.P(5, 4, SH(1)); c.P(10, 4, SH(1))
    c.R(7, 4, 1, 3, K('yoru', -2)); c.R(8, 6, 2, 1, K('yoru', -2)); c.P(8, 6, K('aka', 0))
    for (x, y) in ((7, 3), (10, 6), (7, 9), (5, 6)): c.P(x, y, K('conc', 0))
    c.HL(6, 11, 4, SH(-2))


@R.obj('calendar', '달력', kind='hang', hrows=2, tags=('벽걸이', '달력', 'カレンダー'), place='벽면', desc='종이 달력. 위가 빨간 머리, 아래 격자.')
def _cal(c):
    c.R(3, 3, 10, 15, K('conc', -2)); c.R(4, 4, 8, 13, SH(2))
    c.R(4, 4, 8, 4, K('aka', 0)); c.HL(4, 4, 8, K('aka', 1)); c.HL(5, 6, 6, SH(2))
    for y in (9, 11, 13, 15):
        for x in (5, 7, 9, 11): c.P(x, y, K('conc', 0))
    c.P(9, 11, K('aka', 0))
    c.P(8, 2, K('conc', -3)); c.P(8, 3, K('conc', -2))
    c.HL(4, 18, 8, SH(-2))


@R.obj('intercom', '인터폰', kind='hang', hrows=2, tags=('벽걸이', '인터폰', 'インターホン'), place='현관 문 옆 벽면', desc='현관 옆 인터폰(모니터+버튼). 1칸 폭, 눈높이(그림 아래쪽)에 달려 있다. 작다.')
def _icom(c):
    y = 14
    c.R(3, y, 10, 14, OL); c.R(4, y + 1, 8, 12, SH(1)); c.HL(4, y + 1, 8, SH(2))
    c.R(5, y + 2, 6, 5, GL(-2)); c.R(6, y + 3, 4, 3, GL(0)); c.HL(6, y + 3, 2, GL(2))
    c.R(7, y + 9, 2, 2, K('aka', 0)); c.P(7, y + 9, K('aka', 1)); c.HL(4, y + 12, 8, SH(-1))
    c.HL(4, y + 14, 8, SH(-2))


@R.obj('light-switch', '전등 스위치', kind='hang', hrows=2, tags=('벽걸이', '스위치', 'スイッチ'), place='문 옆 벽면', desc='벽 스위치판. 아주 작다(1칸 안 6×9px), 허리 높이(그림 아래쪽)에 달려 있다.')
def _sw(c):
    y = 18
    c.R(5, y, 6, 9, OL); c.R(6, y + 1, 4, 7, SH(2)); c.HL(6, y + 1, 4, SH(1))
    c.R(7, y + 2, 2, 3, K('conc', 0)); c.P(7, y + 2, K('conc', 1)); c.P(7, y + 6, K('conc', -1)); c.P(8, y + 6, K('conc', -1))
    c.HL(6, y + 10, 4, SH(-2))


@R.obj('kamidana', '카미다나(神棚)', w=2, kind='hang', hrows=1, tags=('벽걸이', '신단', '神棚', '선반'), place='거실 벽면 윗줄', desc='벽 높이 단 신단 선반. 작은 신사 지붕과 비쭈기나무 가지.')
def _kami(c):
    c.R(2, 11, 28, 3, W_(-3)); c.R(3, 11, 26, 2, W_(2)); c.HL(3, 11, 26, W_(3)); c.HL(3, 13, 26, W_(-1))
    c.R(9, 1, 14, 3, K('kawara', -2)); c.R(10, 1, 12, 2, K('kawara', 0)); c.HL(10, 1, 12, K('kawara', 2))
    c.R(8, 3, 16, 1, K('kawara', -3))
    c.R(10, 4, 12, 7, W_(-3)); c.R(11, 5, 10, 6, W_(1)); c.R(14, 6, 4, 5, W_(-2)); c.R(15, 7, 2, 4, K('yoru', -2))
    c.R(4, 6, 4, 5, K('midori', -1)); c.P(5, 5, K('midori', 0)); c.R(5, 7, 2, 1, K('midori', 1))
    c.R(24, 6, 4, 5, K('midori', -1)); c.P(26, 5, K('midori', 0)); c.R(25, 7, 2, 1, K('midori', 1))
    c.HL(3, 14, 26, SH(-2))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
