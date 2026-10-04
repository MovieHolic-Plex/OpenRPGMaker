import hashlib,json
from pathlib import Path
from PIL import Image
# This audits published bytes and review receipts, not visual quality or missing artwork.
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'src/editor/interviewSceneBank.json').read_text())
ledger=json.loads((root/'harness-data/interview-scene-bank/ledger.json').read_text())
seed=json.loads((root/'harness-data/interview-scene-bank/seed.json').read_text())
rows=[];hashes=set()
for key,scene in manifest['scenes'].items():
 image=root/'public'/scene['url'].lstrip('/');raw=image.read_bytes();digest=hashlib.sha256(raw).hexdigest()
 assert digest==scene['sha256'] and digest not in hashes,key
 hashes.add(digest)
 c=ledger['entries'][key][-1];r=c['review']
 assert c['sha256']==digest and c['promptSha256']==scene['promptSha256'],key
 request=root/'harness-data/interview-scene-bank/requests'/f"{c['generationPromptSha256']}.txt"
 assert hashlib.sha256(request.read_bytes()).hexdigest()==c['generationPromptSha256'],key
 assert r['sourceSha256']==digest and r['promptSha256']==c['promptSha256'] and not r['findings'],key
 assert all(r['checks'][k] is True for k in seed['visualChecks']) and c['gate']['ok'] is True,key
 with Image.open(image) as img:
  assert img.format=='PNG' and abs(img.width/img.height-seed['aspectRatio'])<=seed['aspectTolerance'],key
  img.load()
  if 'A' in img.getbands():assert img.getchannel('A').getextrema()==(255,255),key
  rows.append({'key':key,'sha256':digest,'generationPromptSha256':c['generationPromptSha256'],'width':img.width,'height':img.height})
report={'scope':'Every currently published background; remaining planned keys are explicitly incomplete','planned':manifest['planned'],'published':len(rows),'remaining':manifest['planned']-len(rows),'styleVersion':manifest['styleVersion'],'catalogSignature':manifest['catalogSignature'],'allPublishedIntegrityChecksPassed':True,'complete':len(rows)==manifest['planned'],'images':rows}
out=root/'verify-shots/interview-scene-bank-v2/published-integrity-proof.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='images'}))
