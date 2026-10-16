#!/usr/bin/env python3
"""romance_specs 를 등록한 뒤 partedit 를 실행한다(에이전트가 작업 폴더에서 `python3 romance_apply.py apply .` 로 부른다)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import romance_specs  # noqa: E402,F401
import partedit as P  # noqa: E402

if __name__ == '__main__':
    P.main()
