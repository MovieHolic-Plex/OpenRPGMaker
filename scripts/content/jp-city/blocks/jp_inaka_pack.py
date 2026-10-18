#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/jp-city/blocks/jp_inaka_pack.py
"""jp_city block bridge for `jp_inaka_pack` (delegates to `scripts/content/jp-inaka/bake_inaka.py`)."""
from __future__ import annotations

import os
import sys
from typing import Final

HERE: Final[str] = os.path.dirname(os.path.abspath(__file__))
INAKA_DIR: Final[str] = os.path.abspath(os.path.join(HERE, '..', '..', 'jp-inaka'))
if INAKA_DIR not in sys.path:
    sys.path.insert(0, INAKA_DIR)

from bake_inaka import BLOCK, OUTDIR, build, kinds, preview, selftest  # noqa: E402,F401

if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
