"""animal-7 사자 — 셀 64, 칩 × 2. 걷기 칩(Animal 7, 갈기 사자) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=7, cell=64, kind='quad', outline='311800',
    parts=dict(tail=[(21, 26, 23, 29)], fore=[(3, 26, 11, 31)], hind=[(13, 26, 20, 31)], head=[(0, 10, 12, 25)]),
    dup=dict(fore=[(5, 25, 10, 25)], hind=[(14, 25, 20, 25)], head=[(13, 14, 13, 20)]),
    pivot=dict(center=(15, 22), head=(11, 22), fore=(7, 26), hind=(17, 26), tail=(21, 26)),
    mouth=(1, 5, 22), mouthc='6a2000', fang=[2], fangc='fff6de',
    spark_c='fff6de', ghost_c='d5a462', ghost_o='b47b31', leg_h=4,
)

if __name__ == '__main__':
    build_sheet('animal-7', SPEC)
    check_sheet('animal-7', 64)
    board_chip('animal-7', 7, 64)
