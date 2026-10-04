# 파일럿: 음료 자판기 pilot-A/B/C — 손으로 적은 글자 격자를 pxg 로 옮긴다(scripts/content/atlas-pick/pxg_emit.py).
#   python3 tiledata/atlas-pick/candidates-jp/vending_drink/work/pilot_vending.py
import os, sys
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(D, '../../../../scripts/content/atlas-pick'))
from pxg_emit import emit

L = {  # 글자: (램프, 단)
    'o': ('mmetal', 1), 'O': ('mmetal', 2), 'w': ('mwhite', 0), 'W': ('mwhite', 2), 'V': ('mwhite', 3), 'H': ('mwhite', 5),
    'g': ('mdglass', 1), 'G': ('mdglass', 3), 'l': ('mglass', 6), 'm': ('mmetal', 4), 'M': ('mmetal', 6), 's': ('mmetal', 3),
    'r': ('akachin', 3), 'R': ('akachin', 5), 'b': ('kblue', 3), 'B': ('kblue', 5), 'e': ('kgreen', 3), 'E': ('kgreen', 5),
    'y': ('taxi', 3), 'Y': ('taxi', 5), 'k': ('lacq', 1), 'K': ('lacq', 3), 'n': ('neonc', 3), 'N': ('neonc', 5),
    'u': ('kblue', 2), 'U': ('kblue', 4), 'x': ('kblue', 1),
}

# A — 강남 조각 결: 흰 몸통, 쇠 윤곽, 윗면 두 줄, 오른쪽 옆면 한 단 어둡게, 캔 견본 세 줄
A = [
    "................",
    "................",
    "..oHHHHHHHHHHo..",
    ".oHHHHHHHHHHHWo.",
    ".oVVVVVVVVVVVWwo"[:16],
    ".oVggggggggggWwo"[:16],
    ".oVgrRgbBgeEgWwo"[:16],
    ".oVgrrgbbgeegWwo"[:16],
    ".oVGmmmmmmmmGWwo"[:16],
    ".oVgyYgrRgbBgWwo"[:16],
    ".oVgyygrrgbbgWwo"[:16],
    ".oVGmmmmmmmmGWwo"[:16],
    ".oVgeEgyYgrRgWwo"[:16],
    ".oVgeegyygrrgWwo"[:16],
    ".oVGmmmmmmmmGWwo"[:16],
    ".oVkykykykykkWwo"[:16],
    ".oVVVVVVVVVVVWwo"[:16],
    ".oVVsssVVkKKVWwo"[:16],
    ".oVVsNsVVkMKVWwo"[:16],
    ".oVVsssVVkKKVWwo"[:16],
    ".oVVVVVVVVVVVWwo"[:16],
    ".oVVVVVVVVVVVWwo"[:16],
    ".oWWWWWWWWWWWWwo"[:16],
    ".oVVkkkkkkkkVWwo"[:16],
    ".oVVkKKKKKKkVWwo"[:16],
    ".oVVkkkkkkkkVWwo"[:16],
    ".oVVVVVVVVVVVWwo"[:16],
    ".oOOOOOOOOOOOOOo"[:16],
    "..ooooooooooooo.",
    "................",
    "................",
    "................",
]

# B — 명암·그림자 강화: 윗면 밝게, 왼 테 밝은 줄, 오른쪽 옆면 두 단, 유리칸 속 빛(청록), 발치 그림자·불빛 번짐
B = [
    "................",
    "................",
    "..oHHHHHHHHHHo..",
    ".oHHHHHHHHHHHVo.",
    ".oHVVVVVVVVVVWwo",
    ".oHnnnnnnnnnnWwo",
    ".oHnrRnbBneEnWwo",
    ".oHnrrnbbneenWwo",
    ".oHNMMMMMMMMNWwo",
    ".oHnyYnrRnbBnWwo",
    ".oHnyynrrnbbnWwo",
    ".oHNMMMMMMMMNWwo",
    ".oHneEnyYnrRnWwo",
    ".oHneenyynrrnWwo",
    ".oHNMMMMMMMMNWwo",
    ".oHkYkYkYkYkkWwo",
    ".oHVVVVVVVVVVWwo",
    ".oHVsssVVkKKVWwo",
    ".oHVsNsVVkMKVWwo",
    ".oHVsssVVkKKVWwo",
    ".oHVVVVVVVVVVWwo",
    ".oWWWWWWWWWWWwwo",
    ".oWWWWWWWWWWWwwo",
    ".oWWkkkkkkkkWwwo",
    ".oWWkKKKKKKkWwwo",
    ".oWWkkkkkkkkWwwo",
    ".oWWWWWWWWWWWwwo",
    ".oOOOOOOOOOOOOOo",
    ".%oooooooooooooo~",
    ".%%%%%%%%%%%%%~~",
    "..-------------~",
    "................",
]
B = [r[:16] for r in B]

# C — 실루엣 재해석: 파란 옆판(3px 옆면이 보이는 3/4 각), 흰 앞면에 병 견본 두 줄(가는 병 1×3), 큰 불 켜진 머리 띠, 둥근 윗모서리
C = [
    "................",
    "...xxxxxxxxxxx..",
    "..xUUUUUUUUUUUx.",
    ".xUHHHHHHHHHHuux",
    ".xHNNNNNNNNNNuux",
    ".xHNNNNNNNNNNuux",
    ".xHggggggggggUux",
    ".xHgRgBgEgYgRgux"[:16],
    ".xHgrgbgegygrgux"[:16],
    ".xHgrgbgegygrgux"[:16],
    ".xHGMMMMMMMMMGux"[:16],
    ".xHgEgYgRgBgEgux"[:16],
    ".xHgegygrgbgegux"[:16],
    ".xHgegygrgbgegux"[:16],
    ".xHGMMMMMMMMMGux"[:16],
    ".xHkykykykykykux"[:16],
    ".xHVVVVVVVVVVUux",
    ".xHVkKVVVssVVUux",
    ".xHVkMVVVsNVVUux",
    ".xHVkKVVVssVVUux",
    ".xHVVVVVVVVVVUux",
    ".xHWWWWWWWWWWUux",
    ".xHWkkkkkkkkWUux",
    ".xHWkKKKKKKkWUux",
    ".xHWkkkkkkkkWUux",
    ".xHWWWWWWWWWWUux",
    ".xHWWWWWWWWWWUux",
    ".xoooooooooooouux"[:16],
    ".xxxxxxxxxxxxxx~",
    "..------------~~",
    "................",
    "................",
]
C = [r[:16] for r in C]

notes = {
    'A': '강남 조각 결: 흰 몸통·쇠 윤곽, 윗면 두 줄, 오른 옆 한 단 어둡게, 캔 견본 세 줄(색 2px), 버튼 줄·동전판·꺼내는 입구',
    'B': '명암 강화: 왼 테 밝은 줄, 유리칸 속 청록 빛, 선반 밝게, 오른 옆 두 단, 발치 불빛 번짐(%)과 오른쪽 아래 그림자',
    'C': '실루엣 재해석: 파란 옆판이 보이는 3/4 각, 불 켜진 머리 띠, 가는 병 견본 두 줄(1×3), 입구 넓게',
}
A = ["." * 16] * 2 + [r[:16] for r in A][:-2]   # 바닥선을 캔버스 아래로(검사 anchor)
for k, rows in (("A", A), ('B', B), ('C', C)):
    assert len(rows) == 32 and all(len(r) == 16 for r in rows), (k, [len(r) for r in rows])
    open(os.path.join(D, f'pilot-{k}.pxg'), 'w').write(emit(rows, L, f'vending_drink pilot-{k}'))
    open(os.path.join(D, f'pilot-{k}.note'), 'w').write(notes[k] + '\n')
print('ok')
