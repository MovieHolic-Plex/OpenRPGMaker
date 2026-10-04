"""animal-5 군마 — 셀 64, 칩 × 2. 걷기 칩(Animal 5, 갈색 말) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=5, cell=64, kind='quad', outline='311800',
    parts=dict(tail=[(21, 17, 23, 30)], fore=[(4, 24, 11, 31)], hind=[(13, 24, 20, 31)], head=[(0, 4, 10, 15)]),
    dup=dict(fore=[(5, 23, 10, 23)], hind=[(15, 23, 20, 23)], head=[(4, 16, 9, 17)]),
    pivot=dict(center=(13, 20), head=(7, 15), fore=(7, 23), hind=(17, 23), tail=(21, 18)),
    eye=[(3, 10)], skin='d5a462', mouth=(0, 3, 14), mouthc='7b2910',
    spark_c='ffffff', ghost_c='bd8339', ghost_o='8b5210', leg_h=5,
)

if __name__ == '__main__':
    build_sheet('animal-5', SPEC)
    check_sheet('animal-5', 64)
    board_chip('animal-5', 5, 64)
