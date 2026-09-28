"""r2w5 b1 — cat_hairball 이펙트 시트(생성기는 r2w5_cat.py 에 등록, 이 파일은 한 장만 만드는 진입점)."""
from lib_r2w5 import make
import r2w5_cat  # noqa: F401  (@sheet 등록)

if __name__ == '__main__':
    make('cat_hairball')
