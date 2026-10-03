"""Fresh species-specific native64 organic battlers, with nine anatomical poses."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from organic_core import Pen,pal,POSES
from organic_mammals import draw_mammal,DESCRIPTIONS as MAMMALS
from organic_arthropods import draw_bug,DESCRIPTIONS as BUGS
from organic_waterbirds import draw_other,DESCRIPTIONS as OTHERS
DESCRIPTIONS={**MAMMALS,**BUGS,**OTHERS}
def draw(slug,pose,cell):
 assert cell==64
 if slug in MAMMALS:return draw_mammal(slug,pose)
 if slug in BUGS:return draw_bug(slug,pose)
 if slug in OTHERS:return draw_other(slug,pose)
 raise ValueError(slug)
