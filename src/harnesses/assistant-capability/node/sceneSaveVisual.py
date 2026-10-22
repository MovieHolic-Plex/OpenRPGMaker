import json,sys,time
# usage: sceneSaveVisual.py <attempt dir> < verdict.json   — judge JSON + the sha256 of every image it was shown
d=sys.argv[1]; verdict=json.load(sys.stdin)
inp=json.load(open(d+'/judge-input.json'))
verdict['judge']={'model':'claude-opus-5-5 (fresh general-purpose subagent, read-only)','at':time.strftime('%Y-%m-%dT%H:%M:%S'),'images':[{'file':i['file'],'sha256':i['sha256']} for i in inp['images']]}
json.dump(verdict,open(d+'/visual.json','w'),ensure_ascii=False,indent=2); print('saved',d,verdict['verdict'],verdict['score'])
