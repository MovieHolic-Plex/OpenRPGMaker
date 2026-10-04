"""r2w5 b3 — ghost_pal_parade_sky 이펙트 시트(생성기는 r2w5_ghost_pal.py 에 등록, 이 파일은 한 장만 만드는 진입점)."""
from lib_r2w5 import make
import r2w5_ghost_pal  # noqa: F401  (@sheet 등록)

if __name__ == '__main__':
    make('ghost_pal_parade_sky')

