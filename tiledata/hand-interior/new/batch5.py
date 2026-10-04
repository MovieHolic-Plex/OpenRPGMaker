#!/usr/bin/env python3
"""새 기물 5차 — 선 문법 첫 시험 2종(2026-10-02, 사용자 「저거 적용해서 뭐 물건 한 2개만 만들어바」).
batch4 와 같은 규칙(대형 = 3/4 밑그림)에 선 게이트(check_candidate.line_check: 바깥 테 1칸 · 테가 안쪽보다 어둡다)가 붙은 첫 판.
  python3 tiledata/hand-interior/new/batch5.py   # items.json 에 덧붙인다(같은 id 는 건너뛴다)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import batch2  # noqa: E402
import batch4  # noqa: E402,F401  (분류 이름표: opera 등)

BO = batch4.BO

# (id, 이름, 분류, kind, 폭칸, 발밑칸, 캔버스W, H, 맥락 방, use, 설명, 놓는 곳, 짝, refs, 태그, 밑그림)
I = [
 ('great telescope', '거대 망원경', 'tower', 'floor', 3, 2, 48, 64, 'tower', ['read'],
  '돌림 받침 위에 놓인 놋쇠 거대 망원경(3×2칸, 32px 솟음). 받침의 **꼭대기 윗면 18행(밑그림 y=34~51)** — 위에서 본 둥근 나무 돌림판(가장자리 놋쇠 테, 눈금 홈)과 그 가운데 쇠 축받이. 그 아래 남쪽 면 밑그림 y=52~63: 돌림판 옆두께와 세 다리. '
  '받침 위로 놋쇠 경통이 북동쪽 하늘로 비스듬히 솟는다(경통 윗면이 밝고 아랫면이 어둡다, 끝의 렌즈 테, 작은 보조 망원경과 접안부가 남서쪽 아래로). 옆모습 금지.',
  '마법사의 탑 꼭대기 관측실·천문대 가운데.', ['telescope', 'star chart'], ['telescope', 'astrolabe'], ['마법사의 탑', '천문대', '관측실'],
  BO((34, 51), (52, 63), 0.6)),
 ('weaving loom', '베틀', 'home', 'floor', 3, 2, 48, 48, 'mead', ['search'],
  '나무 베틀(3×2칸, 16px 솟음), 짜는 사람이 남쪽에 앉는다. **남쪽 위에서 내려다본 3/4**: 꼭대기 윗면 22행(밑그림 y=6~27) — 위에서 본 네모난 나무 틀 안에 북쪽→남쪽으로 팽팽히 걸린 날실(밝은 실 여러 줄), 남쪽 끝에 감긴 붉은 천 두루마리와 북(배 모양 나무)이 날실 위에 얹혀 있다. '
  '그 아래 남쪽 면 밑그림 y=28~47: 앞 가로대·발판 둘·네 다리. 옆모습 금지.',
  '농가·여관 안채·직물 상점 구석.', ['spinning wheel'], ['spinning wheel', 'work 2x1'], ['농가', '살림', '상점'],
  BO((6, 27), (28, 47), 0.6)),
]
assert len({x[0] for x in I}) == len(I), '같은 id 가 둘'

if __name__ == '__main__':
    import common
    for row in I:
        o = dict(id=row[0], kind=row[3], footprint=dict(w=row[4], h=row[5]), description=row[10], image=dict(w=row[6], h=row[7]), **row[15])
        errs = common.spec_top_lint(o)
        if errs: raise SystemExit('\n'.join(errs))
    batch2.I = [r[:15] + (r[15],) for r in I]
    batch2.main()
