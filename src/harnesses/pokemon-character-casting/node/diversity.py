"""Color-independent clone rejection for a candidate wave. Not aesthetic approval."""
from pathlib import Path
from PIL import Image
import argparse,itertools,json,hashlib
POLICY={'version':1,'bodyStartY':22,'silhouetteCloneIoU':.985,'lowerBodyCloneIoU':.985,'wholePalettePartitionClone':True,'lowerPalettePartitionClone':True}
def load(p):
 im=Image.open(p).convert('RGBA');assert im.size==(48,128);return list(im.get_flattened_data())
def partition(data,body=False):
 lookup={};result=[]
 for i,p in enumerate(data):
  if body and (i//48)%32<POLICY['bodyStartY']:continue
  if not p[3]:result.append(0);continue
  rgb=p[:3]
  if rgb not in lookup:lookup[rgb]=len(lookup)+1
  result.append(lookup[rgb])
 return result

def pair(a,b):
 assert len(a)==len(b)==48*128
 masks=[(bool(x[3]),bool(y[3]),i) for i,(x,y) in enumerate(zip(a,b))]
 def iou(body):
  selected=[(x,y) for x,y,i in masks if not body or (i//48)%32>=POLICY['bodyStartY']]
  union=sum(x or y for x,y in selected);assert union>0
  return sum(x and y for x,y in selected)/union
 whole=iou(False);lower=iou(True);whole_partition=partition(a)==partition(b);lower_partition=partition(a,True)==partition(b,True)
 reasons=[]
 if whole>=POLICY['silhouetteCloneIoU']:reasons.append('nearly-identical-whole-silhouette')
 if lower>=POLICY['lowerBodyCloneIoU']:reasons.append('nearly-identical-body-and-legs')
 if whole_partition:reasons.append('same-pixel-pattern-after-removing-color-labels')
 if lower_partition:reasons.append('same-body-and-leg-pattern-after-removing-color-labels')
 return {'silhouetteIoU':whole,'lowerBodyIoU':lower,'wholePalettePartitionIdentical':whole_partition,'lowerPalettePartitionIdentical':lower_partition,'clone':bool(reasons),'reasons':reasons}

def inspect(bundles):
 records=[];data={str(b):load(Path(b)/'charset.png') for b in bundles}
 for left,right in itertools.combinations(map(str,bundles),2):records.append({'left':left,'right':right,**pair(data[left],data[right])})
 return {'pass':all(not p['clone'] for p in records),'policy':POLICY,'implementationSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'pairs':records,'scope':'Reject repeated silhouette/body/palette-label pattern. Does not prove different age, gender, role, anatomy quality or artistic merit; user review required.'}

def controls():
 root=Path(__file__).resolve().parents[4];sheet=root/'harness-data/pokemon-character-casting/first-wave/rival/A/charset.png';original=load(sheet)
 recolor=[(255-p[0],255-p[1],255-p[2],p[3]) if p[3] else p for p in original]
 hair=original.copy()
 for i,p in enumerate(hair):
  if (i//48)%32<18 and p[3]:hair[i]=(42,71,97,255)
 a=pair(original,recolor);b=pair(original,hair)
 assert a['clone'] and b['clone']
 return [{'case':'same-body-palette-only-recolor','rejected':a['clone']},{'case':'head-only-change-shared-body-and-legs','rejected':b['clone']}]

def main():
 p=argparse.ArgumentParser();p.add_argument('--bundles',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();bundles=json.loads(a.bundles.read_text());report=inspect(bundles);report['negativeControls']=controls();a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':report['pass'],'pairCount':len(report['pairs']),'maximumSilhouetteIoU':max((x['silhouetteIoU'] for x in report['pairs']),default=None),'maximumLowerBodyIoU':max((x['lowerBodyIoU'] for x in report['pairs']),default=None)}));raise SystemExit(0 if report['pass'] else 1)
if __name__=='__main__':main()
