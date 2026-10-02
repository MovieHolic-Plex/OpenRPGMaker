#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '_scene3d'))
from buildset import main  # noqa: E402
main(__file__, sys.argv[1:] or None)
