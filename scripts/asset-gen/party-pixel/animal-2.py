"""animal-2 수탉 — 셀 48, 칩 × 2. 걷기 칩(Animal 2). 칩에 외곽선이 없어 1px 덧씌운다 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=2, cell=48, kind='bird', outline='4b120b', add_outline=True,
    order=['tail', 'legs', 'body', 'head'],
    parts=dict(tail=[(14, 19, 21, 23)], legs=[(9, 29, 15, 31)], head=[(4, 16, 11, 22), (7, 23, 8, 24)]),
    dup=dict(legs=[(10, 28, 14, 28)], head=[(9, 23, 11, 23)]),
    pivot=dict(center=(12, 25), head=(10, 22), legs=(12, 28), tail=(15, 23)),
    eye=[(9, 21)], skin='b71b0f',
    wing_root=(14, 23), wing_len=10, wing_cols=['ceaba4', '9f7d61'],
    spark_c='e4a928', ghost_c='ceaba4', ghost_o='9f7d61', leg_h=2,
)

if __name__ == '__main__':
    build_sheet('animal-2', SPEC)
    check_sheet('animal-2', 48)
    board_chip('animal-2', 2, 48)
