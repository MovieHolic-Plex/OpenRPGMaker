"""animal-1 고양이 — 셀 48. 걷기 칩(Animal 1, 갈색 고양이) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=1, cell=48, kind='quad', outline='390820',
    parts=dict(tail=[(13, 19, 19, 23)], fore=[(6, 28, 10, 31)], hind=[(12, 28, 17, 31)], head=[(3, 15, 11, 22)]),
    dup=dict(fore=[(7, 27, 10, 27)], hind=[(13, 27, 16, 27)], head=[(6, 22, 10, 23)]),
    pivot=dict(center=(11, 24), head=(9, 22), fore=(8, 27), hind=(15, 27), tail=(13, 23)),
    eye=[(6, 21)], skin='ffffff', mouth=(4, 7, 23), mouthc='bd8339', fang=[5], fangc='ffffff',
    spark_c='f6bd7b', ghost_c='bd8339', ghost_o='945a18', leg_h=3,
)

if __name__ == '__main__':
    build_sheet('animal-1', SPEC)
    check_sheet('animal-1', 48)
    board_chip('animal-1', 1, 48)
