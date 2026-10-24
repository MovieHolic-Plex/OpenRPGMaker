"""theme-walls-r10 — 마계 천장 테두리 다시 그림(2026-10-24). 패널 9 sonnet 「분홍 점박이 띠가 흐린 빛 번짐으로 읽힘 · 채도 높음 ·
  윗면/앞면 구분 없는 납작한 띠」 → 두 심사가 다 통과시킨 마법탑 갓돌 짜임(턱 · 갓돌 두 켜, 이음 엇갈림 · 그늘 · 끝선)을 그대로 쓰고
  색만 흑요석으로: 갓돌 = 보라 검은 돌(ostone 낮은 단), 턱 = 한 단 밝은 흑요석, 끝선 = 짙은 남보라(arcane0). 점박이 결 없음.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_walls_r9 as W9  # noqa: E402

WAVE = 'theme_walls'
L = W9.L
# 탑 갓돌과 같은 글자 뜻: j 끝 어둠 · a 줄눈 · b 그늘 · c 아랫켜 · d 윗켜 · e 턱 · n 끝선 · x/y/z 몸통 어둠
# r10b(object-gate 화풍 2/4 「4단·8색, 깨끗한 줄」): 단을 한 칸씩 올리고(갓돌 c=ostone2 d=ostone3 턱 e=ostone5),
# 갓돌마다(이음 사이) 둘째 색 줄(C D = 같은 밝기의 남보라 arcane) — 탑 갓돌처럼 돌마다 결이 다르다. 윗켜 결에 한 단 위 알갱이 f.
LOR = L('j:void1 a:void2 b:ostone1 c:ostone2 d:ostone3 e:ostone5 f:ostone4 n:arcane0 C:arcane0 D:arcane1 F:arcane2 x:void1 y:void2 z:ostone0')
LOR2 = L('j:void1 a:void2 b:ostone1 c:ostone2 d:ostone4 e:ostone5 f:ostone5 n:ostone0 C:ostone1 D:ostone3 F:ostone4 x:void1 y:void2 z:ostone0')


def _alt(v, seed):
    # 이음(n) 사이 돌마다 해시로 둘째 줄(C/D), 윗켜(d) 몇 화소는 한 단 위 알갱이 f
    out, stone = [], 0
    for i, ch in enumerate(v):
        if ch == 'n':
            stone += 1
        h = (stone * 2654435761 ^ seed * 97) & 0xff
        hh = (i * 40503 ^ seed * 31) & 0xff
        if ch in 'cd' and h % 2:
            ch = ch.upper()
        elif ch == 'd' and hh % 5 == 0:
            ch = 'f'
        out.append(ch)
    return ''.join(out)


UP = {'b': 'c', 'c': 'd', 'd': 'f', 'f': 'e', 'C': 'D', 'D': 'F'}
DN = {'c': 'b', 'd': 'c', 'f': 'd', 'e': 'f', 'D': 'C', 'C': 'b'}


def _grain(v, seed):
    # r10c(화풍 「갓돌 3단·결 없음」): 줄 안에서 셋에 하나 화소를 한 단 위/아래(버들항 마름돌 알갱이), 이음(n)·줄눈(b) 옆은 그대로
    out = list(v)
    for i, ch in enumerate(v):
        h = (i * 2246822519 ^ seed * 3266489917) & 0xff
        if ch in UP and h % 3 == 0 and 'n' not in v[max(0, i - 1):i + 2]:
            out[i] = (UP if (h >> 2) % 2 else DN)[ch] if ch in DN else UP[ch]
    return ''.join(out)


OR_GRAIN = {k: _grain(_alt(v, k), k + 7) for k, v in W9.TR_GRAIN.items()}


def other_rim(n=1):
    return W9.rim_autotile(W9.TR_TONE, OR_GRAIN, W9.RIM_BODY, LOR if n == 1 else LOR2)


W9.other_rim = other_rim   # room()/mk_rim 이 이 모듈 함수를 부른다


NOTES = {('wall.other_rim', 'A1'): '흑요석 갓돌 두 켜(이음 엇갈림) + 한 단 밝은 턱 + 남보라 끝선, 안쪽 허공 어둠',
         ('wall.other_rim', 'A2'): '같은 짜임, 턱 한 단 더 밝게·끝선 = 흑요석 어둠'}
FNS = {'wall.other_rim': {'A1': W9.mk_rim('other', 1), 'A2': W9.mk_rim('other', 2)}}
CANDIDATES = {item: {k: W9._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'wall.other_rim': W9.BOARD_REFS['wall.other_rim']}


def line_scenes():
    return {}
