"""Reproduce literal pxgrids and preview files, within this source directory only.
No tests, repository gates, external registration or approval records.
"""
from pathlib import Path
import runpy
import sys
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root))
for name in ('author_pixels.py','motion_pixels.py','status_pixels.py','skill_pixels.py','collapse_pixels.py','correct_pixels.py','render_source.py'):
    runpy.run_path(str(root/name),run_name='__main__')
