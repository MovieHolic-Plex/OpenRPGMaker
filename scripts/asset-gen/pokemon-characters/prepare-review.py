"""Bring authored native files through the existing motion harness, preserving pixels."""
import subprocess,json
from pathlib import Path
import argparse
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('sandbox',type=Path);args=parser.parse_args()
manifest=json.loads((args.source/'authoring.json').read_text());selection={'walk':{},'trainers':{},'authoring':str(args.source/'authoring.json')}
cli=['node','src/harnesses/pokemon-character-motion/node/cli.mjs']
def call(*argv):
 p=subprocess.run(cli+list(map(str,argv)),capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr+p.stdout)
 return p.stdout.strip()
for role in manifest['roles']:
 name=role['role'];folder=args.source/name
 candidate=call('import','--native','--role',name,'--source',folder/'charset.png','--prompt-file',folder/'origin.txt','--sandbox',args.sandbox)
 call('check','--candidate',candidate);call('preview','--candidate',candidate);selection['walk'][name]=candidate
 candidate=call('portrait-import','--native','--role',name,'--source',folder/'portrait.png','--prompt-file',folder/'portrait-origin.txt','--sandbox',args.sandbox)
 call('check','--candidate',candidate);call('preview','--candidate',candidate);selection['trainers'][name]=candidate
candidate=call('portrait-import','--native','--role','hero_back','--source',args.source/'hero_back.png','--prompt-file',args.source/'hero-back-origin.txt','--sandbox',args.sandbox)
call('check','--candidate',candidate);call('preview','--candidate',candidate);selection['trainers']['hero_back']=candidate
candidate=call('clip-import','--native','--role','professor','--clip-id','professor-intro','--columns',6,'--rows',1,'--source',args.source/'professor-clip.png','--prompt-file',args.source/'professor-origin.txt','--sandbox',args.sandbox)
call('check','--candidate',candidate);call('preview','--candidate',candidate);selection['clip']=candidate
(args.sandbox/'selection.json').write_text(json.dumps(selection,indent=2));print(json.dumps({'selection':str(args.sandbox/'selection.json'),'nativePixelsUnchanged':True}))
