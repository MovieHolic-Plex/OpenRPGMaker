"""묶음 a1·a2 직업 장비 격자 (2026-09-29, r2w1).

weapons.py 는 다른 묶음 에이전트와 같은 자리를 건드려 충돌하므로, 이 파일이 import 될 때 weapons.AXIAL / DIAGONAL /
PALETTE / SPRITES 에 격자를 덧붙인다(기존 격자·글자 색은 그대로). 왼쪽을 보는 규약: AXIAL 은 날끝이 왼쪽(0도),
DIAGONAL 은 날끝이 왼쪽 위(45도), @ 는 손. 나머지 여섯 방향은 weapons.py 가 정수 4분 회전으로 만든다.
새 글자: R 붉은 술 / E 암적 / q Q 흑자 · 자수정 / G u 금 · 암금 / e t 엘프 초록 / c C 시공 청록 / F 송곳니 뼈 / X 해골 · 뼈 그림자.
"""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import weapons as W

W.PALETTE.update({
    'R': (214, 52, 62, 255), 'E': (120, 26, 48, 255),
    'q': (38, 22, 58, 255), 'Q': (156, 84, 226, 255),
    'G': (255, 226, 120, 255), 'u': (150, 108, 40, 255),
    'e': (96, 200, 120, 255), 't': (44, 118, 70, 255),
    'c': (48, 150, 190, 255), 'C': (170, 236, 246, 255),
    'F': (238, 232, 208, 255), 'X': (150, 140, 122, 255),
})

AXIAL = {
    # 레이피어: 가는 날, 둥근 손잡이 보호대(R), 붉은 감개.
    'rapier': '''
             R
             RE
 HLLLLLLLLLLLRRk@kg
             RE
             R
''',
    'royal_rapier': '''
             G
             Gu
 HLLLLLLLLLLLGGw@wg
             Gu
             G
''',
    # 암흑검: 넓고 검은 날에 자수정 날선, 뿔 달린 보호대.
    'dark_blade': '''
                 q
   DQQQQQQQQQQQQQqq
 HDqkkkkkkkkkkkkkkqkk@kkQ
   DqqqqqqqqqqqqqQqq
                 q
''',
    # 시공 지팡이: 끝에 시계 고리(청록)와 모래 알갱이.
    'chrono_staff': '''
  ccc
 cCGCc
 cGCGcowwgww@wwgwo
 cCGCc
  ccc
''',
    # 조련사 막대: 끝에 휘어진 송곳니 두 개.
    'tamer_rod': '''
 F F
 FFXo
  FXowwgww@wwgwo
 FFXo
 F F
''',
    # 곡도(커틀러스): 휘어진 날, 조개 모양 보호대.
    'cutlass': '''
 HLL
   LLLLL
    MLLLLLLg
      DMMMMMMgw@wo
         DDDDg
''',
    # 해골 지팡이: 끝에 해골, 눈에 보라 불.
    'skull_staff': '''
  FFF
 FQFQF
 FFFFFwwgww@wwgwo
  XXX
   X
''',
    # 엘프 활: 잎 색 활.
    'elf_bow': '''
      Ge
    tNL
   tN L
  tN  L
 tN   L
 tN   L
 tN   L
 t@   L
 tN   L
 tN   L
 tN   L
  tN  L
   tN L
    tNL
      Ge
''',
    # 석궁: 가로로 든다. 활 가지가 세로 막대, 화살이 놓인 나무 몸통.
    'crossbow': '''
 H
  L
   L
    LDowwwgww@wwo
   L
  L
 H
''',
}
DIAGONAL = {
    'rapier': '''
 H
  L
   L
    L
     L
      L   E
       L R
        R
       R k
      E   @
           k
            g
''',
    'royal_rapier': '''
 H
  L
   L
    L
     L
      L   u
       L G
        G
       G w
      u   @
           w
            g
''',
    'dark_blade': '''
  q
 DQQ
 DqQQ
  DkQQ
   DkkQ
    DkkQ
     DkkQ
      DkkQ q
       DkkQQq
        DqQq
        q  k
          @
           k
            k
             Q
''',
    'chrono_staff': '''
  ccc
 cCGCc
 cGCGc
 cCGCc
  ccc o
      ow
       ow
        gw
         ow
          @w
           ow
            gw
             oo
''',
    'tamer_rod': '''
 F F
 FFX
  FXo
 FFXo
 F F ow
      gw
       ow
        ow
         gw
          @w
           ow
            gw
             oo
''',
    'cutlass': '''
 H
 LL
  LLL
   LLM
    LLM
     LLMD
      LLMDg
       LMMg
        MDg w
           g@
            w
             o
''',
    'skull_staff': '''
  FFF
 FQFQF
 FFFFF
  XXX
   X ow
      gw
       ow
        gw
         ow
          @w
           ow
            gw
             oo
''',
    'elf_bow': '''
          eG
        tN L
      tN  L
    tN   L
   tN   L
  t@   L
  tN  L
  tN L
   tN
    eG
''',
    'crossbow': '''
       H
      L
     L
    L
   Low
  L  ow
 L    gw
       ow
        gw
         ow
          @w
           ow
            gw
''',
}

for kind in AXIAL:
    assert kind not in W.AXIAL, kind
    W.AXIAL[kind] = AXIAL[kind]
    W.DIAGONAL[kind] = DIAGONAL[kind]
    s = W.parse(AXIAL[kind])
    d = W.parse(DIAGONAL[kind])
    for angle, base in ((0, s), (45, d)):
        cur = base
        for turn in range(4):
            W.SPRITES[kind, (angle + turn * 90) % 360] = cur
            cur = W.quarter_turn(cur)
