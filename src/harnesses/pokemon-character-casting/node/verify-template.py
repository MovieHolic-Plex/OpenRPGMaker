"""Focused replay controls. Only temporary copies are mutated."""
import argparse,json,copy,tempfile,shutil
from pathlib import Path
from PIL import Image
from template import replay,verified_lineage
from diversity import inspect,controls
p=argparse.ArgumentParser();p.add_argument('--bundle',type=Path,required=True);p.add_argument('--reference',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();checks=[]
def check(name,ok):
 checks.append({'name':name,'pass':bool(ok)});assert ok,name
recipe=json.loads((a.bundle/'recipe.json').read_text());spec=recipe['templateSpec'];source,final,audit=replay(spec)
check('declared original and explicit patches exactly reproduce submitted PNG',final.tobytes()==Image.open(a.bundle/'charset.png').convert('RGBA').tobytes())
check('twelve poses preserve original leg and foot index geometry',len(audit['frames'])==12 and all(f['lowerFourRowsUnchanged'] for f in audit['frames']))
report=inspect([a.bundle,a.reference]);check('verified shared template body passes with a visible warning',report['pass'] and report['pairs'][0]['verifiedSharedTemplate'] and report['pairs'][0]['clone'])
check('legacy undeclared palette-only and head-only copies remain rejected',all(c['rejected'] for c in controls()))
for name,modify in [('wrong source hash',lambda s:s.update(templateSourceSha256='0'*64)),('no authored edits',lambda s:s.update(patches=[])),('protected feet modified',lambda s:s['patches'].append({'frame':'down_idle','y':29,'rows':['................']}))]:
 bad=copy.deepcopy(spec);modify(bad)
 try:replay(bad);rejected=False
 except (AssertionError,ValueError):rejected=True
 check(name+' rejected',rejected)
with tempfile.TemporaryDirectory() as tmp:
 target=Path(tmp)/'candidate';shutil.copytree(a.bundle,target)
 check('renamed identical template art remains rejected',not inspect([a.bundle,target])['pass'])
 im=Image.open(target/'charset.png').convert('RGBA');im.putpixel((0,0),(255,255,255,255));im.save(target/'charset.png')
 try:verified_lineage(target);rejected=False
 except AssertionError:rejected=True
 check('tampered template result rejected',rejected)
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps({'pass':True,'checks':checks,'templateComparison':report},indent=2)+'\n');print(json.dumps({'pass':True,'checks':len(checks)}))
