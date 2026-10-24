"""theme-walls-r6 — 마계 천장 테두리만(2026-10-24). r5 VQA 「얇은 테·네온 액자·조각표가 미로처럼 보임」 반영:
  두 검수자 모두 PASS 한 마법탑 테두리 A1 과 같은 짜임(밝은 턱 · 갓돌 윗면 평판 3줄 · 그늘 · 끝선 · 어둠, 이음을 칸 경계에서 4열 비킴)을
  앞면과 같은 자두빛 흑요석(ostone)으로. A1 = 끝선 void2, A2 = 끝선 ostone0 + 턱 한 단 어둡게.
마계·마법탑 앞면과 마법탑 테두리는 r5 모듈 그대로 쓴다(이 판은 테두리 한 항목만 그린다).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dot  # noqa: E402
import theme_climate_lib as lib  # noqa: E402
import theme_walls_r5 as W5  # noqa: E402

WAVE = 'theme_walls'
L = W5.L

OR_TONE = 'edcccbnj'
OR_GRAIN = {k: v[-4:] + v[:-4] for k, v in {0: 'eeeeeeebeeeeeeeb', 1: 'ddddddnbddddddnb', 2: 'ccdccbnbcccdccnb',
                                            3: 'cccccnbccccccnbc', 4: 'cdcccnbcccdccnbc'}.items()}
LOR = L('j:void1 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone4 n:void2 x:void0 y:void1 z:void2')
LOR2 = L('j:void1 a:ostone0 b:ostone1 c:ostone2 d:ostone3 e:ostone3 n:ostone0 x:void0 y:void1 z:void2')


def other_rim(n=1):
    return W5.rim_autotile(OR_TONE, OR_GRAIN, W5.RIM_BODY, LOR if n == 1 else LOR2)


W5.other_rim = other_rim


def mk_rim(n):
    def run():
        at = other_rim(n)
        img = lib.atlas47(at)
        return img, {'kind': 'autotile', 'autotiles': {'rim': at}, 'vignette': W5.scene('other', 1, rim_n=n),
                     'extras': [('body 6x6', dot.mosaic(at, 6, 6), 3), ('test map', W5.room('other', 1, W5.TEST, rim_n=n), 2)],
                     'note': '줄 공통 — ' + NOTES[n]}
    return run


NOTES = {1: '자두빛 흑요석 갓돌(탑 테두리와 같은 짜임), 끝선 = 허공 빛',
         2: '같은 갓돌, 턱 한 단 어둡게 · 끝선 = 가장 어두운 흑요석'}
CANDIDATES = {'wall.other_rim': {'A1': mk_rim(1), 'A2': mk_rim(2)}}


def line_scenes():
    return {}


BOARD_REFS = {'wall.other_rim': ['bd-pick-castle-catacombs-face-castle-3h']}
