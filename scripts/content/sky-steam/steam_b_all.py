"""줄 B 전체 등록 + export/status.  python3 steam_b_all.py export|status [ids…]"""
import os, sys, importlib, glob
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SKIP = {'steam_b_lib', 'steam_b_all', 'steam_b_preview', 'steam_b_pack', 'steam_b_scenes', 'steam_b_viz'}
for f in sorted(glob.glob(os.path.join(HERE, 'steam_b_*.py'))):
    n = os.path.basename(f)[:-3]
    if n not in SKIP: importlib.import_module(n)
from registry import run_cli
if __name__ == '__main__': run_cli('B')
