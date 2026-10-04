"""Legacy batch command; all outputs now use the refreshed native-grid source."""
import sys,json
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'refresh'))
from registry import draw_entry,export_species,helper
NAMES=helper.POSES

def render(slug,pose):return SimpleNamespace(im=draw_entry(slug,pose))
def main():
 entries=json.loads((HERE/'species.json').read_text())
 reports=export_species([entry['slug'] for entry in entries])
 path=helper.ROOT/'verify-shots/monster-refresh'/('organic'+ '-legacy-entry.json')
 path.write_text(json.dumps(reports,indent=2)+'\n')
 return reports
if __name__=='__main__':main()
