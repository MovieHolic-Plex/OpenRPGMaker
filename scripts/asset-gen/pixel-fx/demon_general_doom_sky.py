"""r2w5 b5 — demon_general_doom_sky 이펙트 시트(생성기는 r2w5_demon_general.py 에 등록, 이 파일은 한 장만 만드는 진입점)."""
from lib_r2w5 import make
import r2w5_demon_general  # noqa: F401  (@sheet 등록)

if __name__ == '__main__':
    make('demon_general_doom_sky')

