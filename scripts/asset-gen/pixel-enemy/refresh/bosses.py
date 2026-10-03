"""Compatibility API; the rejected batch has been archived, fresh art owns output."""
import sys
sys.dont_write_bytecode = True
from registry import draw_entry, helper

def draw(slug, pose, cell=None):
    return draw_entry(slug, pose)

if __name__ == '__main__':
    helper.run_group('bosses', draw)
