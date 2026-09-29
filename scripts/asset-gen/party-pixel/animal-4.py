"""animal-4 젖소 — 셀 64, 칩 × 2. 걷기 칩(Animal 4, 얼룩 젖소) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=4, cell=64, kind='quad', outline='311800',
    parts=dict(tail=[(22, 18, 23, 25)], fore=[(5, 26, 12, 31)], hind=[(15, 26, 22, 31)], head=[(0, 10, 8, 22), (9, 10, 9, 15)]),
    dup=dict(fore=[(6, 25, 11, 25)], hind=[(16, 25, 21, 25)], head=[(9, 16, 10, 21)]),
    pivot=dict(center=(14, 21), head=(8, 18), fore=(8, 25), hind=(18, 25), tail=(22, 19)),
    eye=[(4, 15)], skin='6a6a6a', mouth=(0, 3, 21), mouthc='bd5a39',
    spark_c='ffd5a4', ghost_c='bdbdbd', ghost_o='7b7b7b', leg_h=4,
)

if __name__ == '__main__':
    build_sheet('animal-4', SPEC)
    check_sheet('animal-4', 64)
    board_chip('animal-4', 4, 64)
