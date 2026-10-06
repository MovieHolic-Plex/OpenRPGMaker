#!/usr/bin/env python3
"""Focused adversarial controls for the hero gate; fixture judgments never approve art."""
import argparse, copy, hashlib, importlib.util, json, tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('hero_quality',ROOT/'src/harnesses/pokemon-character-motion/node/quality_gate.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
p=argparse.ArgumentParser();p.add_argument('--pack',required=True);p.add_argument('--review',required=True);p.add_argument('--root-review',required=True);p.add_argument('--out',required=True);a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
pack=g.load(a.pack);ind=g.load(a.review);root=g.load(a.root_review);records=[]
# First require the genuine current approval. All mutations below are synthetic rejection fixtures.
g.gate(a.pack,a.review,a.root_review,out/'positive');records.append({'name':'genuine-current-two-reviews','accepted':True})
with tempfile.TemporaryDirectory(prefix='hero-negative-') as temp:
 d=Path(temp)
 def reject(name,change,which='ind'):
  pp,ii,rr=copy.deepcopy(pack),copy.deepcopy(ind),copy.deepcopy(root)
  change({'pack':pp,'ind':ii,'root':rr}[which]);pf=d/'pack.json';ifile=d/'ind.json';rf=d/'root.json';g.write(pf,pp)
  binding=g.sha(pf);ii['observationPackageSha256']=binding;rr['observationPackageSha256']=binding;g.write(ifile,ii);g.write(rf,rr)
  try:g.gate(pf,ifile,rf,d/'gate')
  except (ValueError,TypeError,KeyError,OSError) as error:records.append({'name':name,'accepted':False,'reason':str(error)})
  else:raise AssertionError('Hostile gate accepted '+name)
 reject('axis-below-minimum',lambda r:r['scores']['walking'].update(score=13))
 reject('quality-total-below85',lambda r:(r['scores']['silhouette'].update(score=15),r.update(total=84)))
 reject('critical-anatomy-failure',lambda r:r.update(criticalFailures=['CF2']))
 reject('redo-verdict',lambda r:r.update(verdict='redo'))
 reject('missing-axis',lambda r:r['scores'].pop('loop'))
 reject('empty-reason',lambda r:r['scores']['loop'].update(reason=''))
 reject('false-total',lambda r:r.update(total=100))
 reject('boolean-score',lambda r:r['scores']['loop'].update(score=True))
 reject('artist-as-independent',lambda r:r.update(reviewer='root'))
 reject('artist-with-whitespace',lambda r:r.update(reviewer='root '))
 reject('stale-sheet-review',lambda r:r.update(sheetSha256='0'*64))
 reject('stale-gif-review',lambda r:r.update(gifSha256='0'*64))
 reject('stale-rubric-review',lambda r:r.update(rubricSha256='0'*64))
 reject('incomplete-gif-review',lambda r:r.update(decodedFrames=3))
 reject('wrong-timing-review',lambda r:r.update(durationsMs=[90]*4))
 reject('not-all-poses-viewed',lambda r:r.update(allTwelvePosesViewed=False))
 reject('not-native-and-enlarged',lambda r:r.update(nativeAnd4xViewed=False))
 reject('missing-browser-proof',lambda r:r.pop('browserProof'),'root')
 reject('stale-implementation',lambda r:r.update(implementationSha256='0'*64),'pack')
 arbitrary=d/'arbitrary.png';Image.new('RGB',(3,3),'red').save(arbitrary)
 reject('arbitrary-contact-evidence',lambda r:r.update(evidence=[{'file':str(arbitrary),'sha256':g.sha(arbitrary)}]),'pack')
 reject('stale-visual-evidence',lambda r:r['evidence'][0].update(sha256='0'*64))
 # Browser-source byte problems are rejected before any review scores matter.
 gif=Image.open(pack['gif']);frames=[]
 for n in range(gif.n_frames):gif.seek(n);frames.append(gif.convert('RGBA'))
 for name,alter in [('opaque-gif-gutter',lambda f:f[0].putpixel((16,0),(0,0,0,255))),('wrong-gif-pose-order',lambda f:f.reverse()),('false-idle-walking',lambda f:f.__setitem__(0,f[1].copy()))]:
  ff=[f.copy() for f in frames];alter(ff);file=d/(name+'.gif');ff[0].save(file,save_all=True,append_images=ff[1:],loop=0,duration=140,disposal=2)
  try:g.inspect(pack['sheet'],file)
  except (ValueError,KeyError) as e:records.append({'name':name,'accepted':False,'reason':str(e)})
  else:raise AssertionError(name)
 original=g.RUBRIC;bad=d/'tampered-rubric.json';r=g.load(original);r['passRule']['minimumTotal']=70;g.write(bad,r);g.RUBRIC=bad
 try:g.inspect(pack['sheet'],pack['gif'])
 except ValueError as e:records.append({'name':'lowered-rubric-threshold','accepted':False,'reason':str(e)})
 else:raise AssertionError('threshold tampering')
 finally:g.RUBRIC=original
result={'pass':True,'checks':len(records),'records':records,'scope':'Focused gate controls. Only genuine recorded v4 judgments supply positive art approval. Negative mutations are disposable fixtures; no project or asset registration writes.'};g.write(out/'record.json',result);print(json.dumps(result))
