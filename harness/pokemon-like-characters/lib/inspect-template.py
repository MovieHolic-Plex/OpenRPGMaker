"""Print literal source rows and palette for an author; never invent patches."""
import argparse,json
from pathlib import Path
from template import base,atlas
p=argparse.ArgumentParser();p.add_argument('--template',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
record,palette,frames=base(a.template);a.out.mkdir(parents=True,exist_ok=True)
(a.out/'original-grid.json').write_text(json.dumps({'source':record,'palette':palette,'frames':frames},indent=2)+'\n')
atlas(palette,frames).save(a.out/'original.png')
