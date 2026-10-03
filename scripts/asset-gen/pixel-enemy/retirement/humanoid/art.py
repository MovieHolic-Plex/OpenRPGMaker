"""Compatibility drawing API; geometry is owned by the current refresh sources."""
import sys
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'refresh'))
from registry import draw_entry,helper
NAMES=helper.POSES

def draw(slug,pose):return SimpleNamespace(im=draw_entry(slug,pose))
