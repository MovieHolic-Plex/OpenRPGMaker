"""animal-3 양 — 셀 48. 걷기 칩(Animal 3, 검은 얼굴 양) 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp1)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp1 import build_sheet, check_sheet, board_chip  # noqa: E402

# 부위 사각형·중심점은 칩 1배 좌표(칸 24×32 안).
SPEC = dict(
    idx=3, cell=48, kind='quad', outline='05060e',
    parts=dict(tail=[(19, 21, 22, 25)], fore=[(6, 27, 10, 31)], hind=[(15, 27, 19, 31)], head=[(0, 19, 7, 25), (8, 20, 8, 23)]),
    dup=dict(fore=[(7, 26, 10, 26)], hind=[(16, 26, 18, 26)], head=[(8, 24, 9, 25)]),
    pivot=dict(center=(12, 22), head=(7, 22), fore=(8, 27), hind=(17, 27), tail=(19, 23)),
    eye=[(4, 21)], skin='19262f', mouth=(1, 4, 24), mouthc='6a2000',
    spark_c='ffffff', ghost_c='cfb9a5', ghost_o='897558', leg_h=3,
)

if __name__ == '__main__':
    build_sheet('animal-3', SPEC)
    check_sheet('animal-3', 48)
    board_chip('animal-3', 3, 48)
