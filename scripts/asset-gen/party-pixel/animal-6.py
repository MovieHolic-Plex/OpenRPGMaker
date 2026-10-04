"""animal-6 호랑이 — 셀 64, 칩 × 2. 걷기 칩(Animal 6, 주황 호랑이) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=6, cell=64, kind='quad', outline='410000',
    parts=dict(tail=[(21, 20, 23, 28)], fore=[(3, 25, 11, 31)], hind=[(13, 25, 20, 31)], head=[(0, 11, 9, 22)]),
    dup=dict(fore=[(5, 24, 10, 24)], hind=[(14, 24, 20, 24)], head=[(8, 17, 11, 22)]),
    pivot=dict(center=(14, 22), head=(8, 20), fore=(8, 25), hind=(17, 25), tail=(21, 21)),
    mouth=(1, 5, 21), mouthc='bd3908', fang=[2], fangc='fff6de',
    spark_c='fff6ac', ghost_c='e68310', ghost_o='bd3908', leg_h=4,
)

if __name__ == '__main__':
    build_sheet('animal-6', SPEC)
    check_sheet('animal-6', 64)
    board_chip('animal-6', 6, 64)
