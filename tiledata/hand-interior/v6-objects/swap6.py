# v6 소품을 실제 칩셋·사양·예제 맵·참고문서에 넣는 스위치 (사용자가 좋다고 한 뒤에만).
#   python3 tiledata/hand-interior/v6-objects/swap6.py            → 할 일만 출력 (아무것도 안 바꿈)
#   python3 tiledata/hand-interior/v6-objects/swap6.py --apply    → 교체 빌드
#   되돌리기: git checkout 으로 산출물을 되돌리거나, HAND_INTERIOR_V6 없이 같은 세 단계를 다시 돌린다.
# 순서는 openwiki/atlas-biome-interior.md 와 같다: meta5(아틀라스·메타) → build_tileset(칸·사양·예제 26맵) → prepare-references.
# 뒤에 정본 저장(bun scripts/content/hand-interior/save.mts)과 조수 시험은 따로 한다.
import os, sys, subprocess
STEPS = [
    ['python3', '-c', "import sys,runpy; sys.path[:0]=['tiledata/hand-interior/v6-objects','tiledata/hand-interior/v5']; import apply6; apply6.install(); runpy.run_path('tiledata/hand-interior/v5/meta5.py', run_name='__main__')"],
    ['python3', 'scripts/content/hand-interior/build_tileset.py'],
    ['bun', 'scripts/content/hand-interior/prepare-references.mts'],
]
env = dict(os.environ, HAND_INTERIOR_V6='1')
for st in STEPS:
    print('HAND_INTERIOR_V6=1', ' '.join(st if len(st) < 3 or st[1] != '-c' else st[:2] + ['<install+meta5>']))
    if '--apply' in sys.argv:
        subprocess.run(st, env=env, check=True)
if '--apply' not in sys.argv: print('(dry run — --apply 로 실행)')
