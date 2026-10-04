"""animal-0 충견 — 셀 48. 걷기 칩(Animal 0, 노란 코기) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

SPEC = dict(
    idx=0, cell=48, kind='quad', outline='413100', dark=['201800'],
    # 칩 1배 좌표(칸 24×32 안). 머리 x2..12 y16..25, 몸 x7..20 y21..27, 앞다리 x7..10, 뒷다리 x16..19 (y28..30)
    parts=dict(tail=[(19, 22, 21, 26)], fore=[(6, 28, 11, 31)], hind=[(15, 28, 20, 31)], head=[(0, 15, 11, 25), (12, 15, 12, 21)]),
    dup=dict(fore=[(7, 27, 10, 27)], hind=[(16, 27, 19, 27)], head=[(7, 22, 12, 24)]),
    pivot=dict(center=(13, 24), head=(10, 23), fore=(8, 27), hind=(17, 27), tail=(19, 24)),
    eye=[(6, 20)], eyehi='ffffff', skin='ffb418', mouth=(2, 7, 24), mouthc='d56210', fang=[4], fangc='ffffff',
    spark_c='fff6ac', ghost_c='e68310', ghost_o='d56210', leg_h=3,
)

if __name__ == '__main__':
    build_sheet('animal-0', SPEC)
    check_sheet('animal-0', 48)
    board_chip('animal-0', 0, 48)

