"""w4 cave — 손으로 적은 16x16 글자 격자. k=wrock0(윤곽) b..g=wrock1..6, h=wrock1(구멍 안쪽 테), H=mout0(구멍), n m=wmead 풀 조금, ~ - 반투명 그늘."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit
LEG = {'k': ('wrock', 0), 'a': ('wrock', 0), 'b': ('wrock', 1), 'c': ('wrock', 2), 'd': ('wrock', 3), 'e': ('wrock', 4), 'f': ('wrock', 5), 'g': ('wrock', 6),
       'h': ('wrock', 1), 'H': ('mout', 0), 'n': ('wmead', 3), 'm': ('wmead', 2)}
ROWS = {}
ROWS['A'] = """
................
....kkkkkkk.....
..kkeeffeeddkk..
.kdeffffeeeddck.
.kefffffeeedddbk
kdeffffeeeeddcbk
kdeeeeeeeeeddcbk
kdeeddhhhhdddcbk
kdedhhHHHHhhdcbk
kdchHHHHHHHHhcbk
kechHHHHHHHHhcbk
kdbhHHHHHHHHhbbk
kcbhHHHHHHHHhcbk
knbhHHHHHHHHhbmk
.kbhHHHHHHHHhbk.
.....--~~~~~~~~~
""".split()
ROWS['B'] = """
................
....kkkkkkk.....
..kkfgggffeedkk.
.kefggggffeeddck
.kfgggggffeeddbk
kefgggffeeedddbk
kdffeeeedddddbbk
kdeeddhhhhddcbbk
kdedhhHHHHhhcbbk
kechHHHHHHHHhbak
kdchHHHHHHHHhbak
kcbhHHHHHHHHhbak
kdbhHHHHHHHHhbak
knbhHHHHHHHHhbmk
.kbhHHHHHHHHhbk~
...---~~~~~~~~~~
""".split()
ROWS['C'] = """
................
......kk........
.....kfek.......
....kfffedk.....
...kfffeeddk....
..kfffeeeeddck..
.kfffeeeeeddccbk
kfffffffeeeddcbk
kddhhhhhhhhhhcbk
kdchHHHHHHHHhcbk
kcbhHHHHHHHHhbbk
kcbhHHHHHHHHhbbk
kbbhHHHHHHHHhbbk
knbhHHHHHHHHhbmk
.kbhccccccccbbk.
....-----~~~~~~~
""".split()
if __name__ == '__main__':
    for v, rows in ROWS.items():
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), (v, [len(r) for r in rows])
        used = {ch: LEG[ch] for ch in set(''.join(rows)) if ch in LEG}
        t = {'A': '강남 결 낮은 대비 바위 둔덕', 'B': '명암·부피 강화', 'C': '뾰족한 언덕+벼랑 아래 아치 재해석'}[v]
        open(os.path.join(HERE, '..', f'w4-{v}.pxg'), 'w').write(emit(rows, used, f'cave w4-{v} — {t}'))
