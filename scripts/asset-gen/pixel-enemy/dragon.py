"""Compatibility entry for the refreshed hand-pixel monster.
The editable drawing source is redraw/bosses.py; earlier geometry is retired.
"""
import sys
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent/'refresh'))
from registry import draw_entry,export_species,helper
CELL = 96
NAMES=helper.POSES
SLUG='dragon'

def draw_pose(pose):return draw_entry(SLUG,pose)
def draw(pose):return SimpleNamespace(im=draw_pose(pose))
def main():return export_species([SLUG])
if __name__=='__main__':main()
