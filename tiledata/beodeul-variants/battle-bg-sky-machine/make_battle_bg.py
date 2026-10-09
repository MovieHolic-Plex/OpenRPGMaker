# 버들항 웨이브 5 — 전투 배경 6장(하늘·시간·기계 계열) 재생성.
#   python3 make_battle_bg.py            → 6장 + compare-ref.png + check-overlay.png
#   python3 make_battle_bg.py sky-city   → 한 장만
# 각 장의 그림은 bg_<slug>.py, 그림 함수는 lib/ 의 장소 모듈 복사본, 공용 틀은 bb_common.py.
import os, sys, importlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bb_common as BB

SLUGS = ['sky-city', 'airship', 'time-rift', 'future-ruins', 'machine-factory', 'final-tower']


def build(slug):
    mod = importlib.import_module('bg_' + slug.replace('-', '_'))
    img = mod.build()
    n, m = BB.finish(img, os.path.join(HERE, slug + '.png'))
    print(f'{slug}: colors {n} -> {m}')


if __name__ == '__main__':
    want = sys.argv[1:] or SLUGS
    for s in want:
        if s in SLUGS: build(s)
    if not sys.argv[1:] or 'qa' in sys.argv[1:]:
        import bb_qa
        bb_qa.compare_ref(SLUGS); bb_qa.check_overlay(SLUGS)
