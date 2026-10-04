"""묶음 a3 직업 장비 격자 (2026-09-29, r2w2) — 광전사·총사·무희·연금술사·소환사.

weapons.py 를 직접 고치면 다른 묶음과 충돌하므로 import 될 때 AXIAL/DIAGONAL/PALETTE/SPRITES 에 덧붙인다(기존 격자·글자 색 그대로).
왼쪽을 보는 규약: AXIAL 은 끝이 왼쪽(0도), DIAGONAL 은 왼쪽 위(45도), @ 는 손. 나머지 여섯 방향은 정수 4분 회전.
새 글자(다른 묶음과 겹치지 않게 고름): a A 부채 분홍 · z Z 연금 유리 초록 · i I 소환 보라 · x 총신 검쇠 · v 핏빛 도끼날.
"""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import weapons as W

NEW = {
    'a': (214, 70, 120, 255), 'A': (255, 176, 206, 255),
    'z': (40, 140, 90, 255), 'Z': (150, 240, 170, 255),
    'i': (90, 44, 150, 255), 'I': (200, 150, 255, 255),
    'x': (46, 48, 58, 255), 'v': (150, 30, 36, 255),
}
for k, c in NEW.items():
    assert W.PALETTE.get(k, c) == c, k
W.PALETTE.update(NEW)

AXIAL = {
    # 광전사 양손 전투도끼: 넓은 반달 날(핏빛 날선) + 긴 자루.
    'war_axe': '''
   DDD
  DMLLD
 vMLHLLD
 vMLLLLD
  DMLLDoooowwgwwgw@wwo
 vMLLLLD
 vMLHLLD
  DMLLD
   DDD
''',
    # 총사 장총: 긴 총신(x) + 방아쇠 손(@) + 개머리판.
    'musket_a3': '''
 HMMMMMMMMMMMDD
 xxxxxxxxxxxxxxwwwwwo
            gx@wwwwwo
             D   ooo
''',
    # 무희 부채: 펼친 부챗살(분홍) + 금 사북.
    'fan_a3': '''
 aAAa
 AaAAa
 aAaAAag@
 AaAAa
 aAAa
''',
    # 연금술사 플라스크 지팡이: 끝에 초록 약병.
    'flask_rod': '''
  ZZ
 ZzHzZ
 ZzzzZgwwgww@wwo
 ZzzzZ
  ZZ
''',
    # 소환사 초승달 지팡이: 뿔 두 개 사이 보라 보석.
    'summon_rod': '''
 I
  i
  IiIgwwgww@wwgwo
  i
 I
''',
}
DIAGONAL = {
    'war_axe': '''
     DDD
    DMLLD
   vMLHLD
   vMLLLD
  DDMLLDo
 vMLLDD  w
 vMLHD    g
  DMD      w
            w
             @
              w
               o
''',
    'musket_a3': '''
 H
 xM
  xM
   xM
    xM
     xM
      xMD
       xxg
        gx@
          xww
           www
            wwo
''',
    'fan_a3': '''
 aAa
 AaAAa
 aAaAa
  AaAa
   aA g
       @
''',
    'flask_rod': '''
  ZZ
 ZzHZ
 ZzzzZ
  ZzZg
     gw
      ow
       gw
        ow
         @w
          oo
''',
    'summon_rod': '''
 I  I
  i i
   IIg
     gw
      ow
       gw
        ow
         @w
          gw
           oo
''',
}

for kind in AXIAL:
    assert kind not in W.AXIAL, kind
    W.AXIAL[kind] = AXIAL[kind]
    W.DIAGONAL[kind] = DIAGONAL[kind]
    for angle, base in ((0, W.parse(AXIAL[kind])), (45, W.parse(DIAGONAL[kind]))):
        cur = base
        for turn in range(4):
            W.SPRITES[kind, (angle + turn * 90) % 360] = cur
            cur = W.quarter_turn(cur)

