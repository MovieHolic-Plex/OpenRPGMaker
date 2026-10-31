#!/usr/bin/env python3
"""Hard-logic battery — readability judge for one run (reuses ../ab2/readability.py prompt; shots in <batch>/shots/<run>/)."""
import os, runpy, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0], *sys.argv[1:]]
runpy.run_path(os.path.join(HERE, "..", "ab2", "readability.py"), run_name="__main__")
