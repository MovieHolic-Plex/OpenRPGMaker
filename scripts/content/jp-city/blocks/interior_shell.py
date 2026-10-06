#!/usr/bin/env python3
"""jp_city 블록 interior_shell — 일본 실내 구조: 바닥(짜임 주기)·벽면(2줄)·천장 띠·공허.
  python3 scripts/content/jp-city/blocks/interior_shell.py     # selftest + tiledata/jp-city/blocks/interior_shell/_all-x3.png
틀(그림자 변형·칸 자르기·사양)은 interior/ikit.py. 여기는 표면 그림만 그린다(세계 좌표 그림 — 주기 안에서 칸마다 같은 무늬가 되풀이되면 안 된다)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, default_ceiling, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_shell'
R = Registry(BLOCK, '일본 실내 구조')
R.add_void()


@R.ceiling('default', '기본 천장 띠', desc='벽 위 어두운 천장 띠, 실내 쪽 밝은 테두리')
def _ceil(c, bits): default_ceiling(c, bits)


@R.floor('flooring', '플로어링(나무 마루)', cols=4, rows=4, tags=('거실', 'LDK', '복도', '양실'), desc='밝은 나무 널 마루(フローリング) — 양실·LDK·복도.')
def _flooring(c):
    for y in range(64):
        for x in range(64):
            board = (y // 4) % 16
            seam = (x + board * 23) % 48 == 0
            col = K('yuka', 1) if (y % 4) in (1, 2) else K('yuka', 0)
            if y % 4 == 3: col = K('yuka', -1)
            if seam: col = K('yuka', -1)
            c.P(x, y, col)


@R.wall('cloth', '흰 벽지(クロス)', cols=4, tags=('거실', '양실', 'LDK'), desc='흰 비닐 벽지 — 아랫단에 걸레받이.')
def _cloth(c):
    for y in range(32):
        for x in range(64):
            col = K('shiro', 0) if y < 28 else (K('ita', 0) if y < 31 else K('ita', -2))
            if y == 27: col = K('shiro', -1)
            c.P(x, y, col)


# ── 자리표(placeholder): 작업자가 그림을 다시 그린다. id·이름·cols/rows 는 다른 블록 예제가 쓰므로 바꾸지 않는다 ──
def _flat(top, low=None, grout=None, period=None):
    def d(c):
        for y in range(c.h):
            for x in range(c.w):
                col = top
                if grout is not None and period and (x % period == 0 or y % period == 0): col = grout
                c.P(x, y, col)
    return d


for _id, _ko, _tags, _desc, _fn in (
        ('flooring-dark', '짙은 플로어링', ('거실', '복도', '침실'), '짙은 나무 마루 — 복도·양실.', _flat(K('ita', 0))),
        ('tatami', '다다미', ('화실', '和室'), '다다미(畳) — 화실. 한 장 = 1×2칸, 가장자리 헤리(縁).', _flat(K('kinari', 0), grout=K('lino', -1), period=16)),
        ('cushion', '쿠션 플로어', ('부엌', '화장실', '탈의실'), '비닐 쿠션 플로어 — 부엌·화장실·탈의실.', _flat(K('kinari', 1))),
        ('bathtile', '욕실 바닥 타일', ('욕실',), '작은 미끄럼 방지 타일 — 욕실.', _flat(K('conc', 1), grout=K('conc', -1), period=4)),
        ('tataki', '현관 타타키', ('현관',), '현관 신발 벗는 곳 바닥(돌·타일). 마루보다 한 단 낮다.', _flat(K('hodo', 0), grout=K('hodo', -1), period=8)),
        ('carpet', '카펫', ('침실', '아이방', '원룸'), '털 짧은 카펫 — 양실 침실.', _flat(K('kon', 1)))):
    R.floor(_id, _ko, cols=4, rows=4, tags=_tags, desc=_desc)(_fn)

for _id, _ko, _tags, _desc, _fn in (
        ('cloth-beige', '베이지 벽지', ('거실', '침실'), '연한 베이지 벽지 — 침실·아이방.', _flat(K('kinari', 1))),
        ('juraku', '화실 흙벽(聚楽)', ('화실', '和室'), '모래 섞인 흙벽 + 나무 기둥(柱)·나게시(長押) — 화실.', _flat(K('kinari', 0))),
        ('bathwall', '욕실 벽 패널', ('욕실',), '욕실 벽 패널/타일.', _flat(K('shiro', 1), grout=K('shiro', -1), period=8)),
        ('kitchen-panel', '부엌 벽 패널', ('부엌',), '조리대 뒤 키친 패널(타일 무늬).', _flat(K('shiro', 1), grout=K('conc', 0), period=8))):
    R.wall(_id, _ko, cols=4, tags=_tags, desc=_desc)(_fn)


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
