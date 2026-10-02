#!/usr/bin/env python3
"""몬스터 수집 월드맵 아이콘 세트 재생성.  python3 build.py [함수 이름 …]"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
from buildset import main  # noqa: E402
main(__file__, sys.argv[1:] or None)
