#!/usr/bin/env python3
"""Read other role inputs explicitly; write only the local reproducible snapshot."""
import argparse,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--classes',type=Path,required=True)
parser.add_argument('--equipment',type=Path,required=True)
parser.add_argument('--prototype',type=Path,required=True)
a=parser.parse_args();c=json.loads(a.classes.read_text());e=json.loads(a.equipment.read_text());d=json.loads(a.prototype.read_text())
snapshot=dict(classes=[dict(id=r['id'],name=r['name'],parameterCurves={k:v[:20] for k,v in r['parameterCurves'].items()})
                     for r in c['classes'] if r['id']!='class_jf_novice'],
              equipment=[dict(id=r['id'],statBonuses=r['statBonuses']) for r in e['equipment']],
              fallbackSkill=next(s for s in d['skills'] if s['id']=='skill_attack'),
              sources={label:dict(path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest())
                       for label,path in [('classes',a.classes),('equipment',a.equipment),('prototype',a.prototype)]})
(ROOT/'source/balance-inputs.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
print('captured read-only 4-class × 20-level curves, equipment bonuses and existing skill_attack')
