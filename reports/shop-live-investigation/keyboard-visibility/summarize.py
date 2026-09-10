import json, hashlib, socket, struct, ast, subprocess
from pathlib import Path
P=Path(__file__).parent
load=lambda name:json.loads((P/name).read_text())
write=lambda name,value:(P/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
project=load('canonical-project.json');provenance=load('provenance.json')
provenance['title']=project['meta']['title'];write('provenance.json',provenance)
expected={'attack':{'current':45,'next':53,'delta':8},'defense':{'current':72,'next':72,'delta':0},'mind':{'current':48,'next':48,'delta':0},'agility':{'current':45,'next':45,'delta':0}}
rect=lambda node:[round(node['rect'][k],3) for k in ['x','y','width','height']]
stats=lambda capture,prefix:{k:{'values':capture['selectors'][prefix+k]['values'],'rowVisibility':capture['selectors'][prefix+k]['effectiveVisibility'],'rectXYWH':rect(capture['selectors'][prefix+k])} for k in expected}
rows=[]
for size in ['1024x768','640x480','320x240']:
 inline=load(size+'-inline.json');detail=load(size+'-detail-initial.json');opener=load(size+'-opener.json');returned=load(size+'-return.json')
 assert inline['viewport']['width']==int(size.split('x')[0]) and inline['viewport']['height']==int(size.split('x')[1])
 assert inline['focus']=='shop-sell-equip_sword'
 assert inline['selectors']['shop-sell-equip_sword']['ariaCurrent']=='true'
 assert opener['focus']=='shop-detail-open' and opener['selectors']['shop-detail-open']['disabled'] is False
 assert opener['selectors']['shop-detail-open']['effectiveVisibility']=='fully-visible'
 assert returned['focus']=='shop-detail-open' and not returned['selectors']['shop-comparison']['present']
 assert detail['selectors']['shop-comparison']['data']['previewKind']=='ready'
 assert detail['selectors']['shop-comparison']['data']['actorId']=='actor_hero'
 assert not inline['selectors']['shop-summary-reason']['present'] and not detail['selectors']['shop-preview-reason']['present']
 for k,v in expected.items():
  assert inline['selectors']['shop-summary-stat-'+k]['values']==v
  assert detail['selectors']['shop-stat-'+k]['values']==v
 scroll=detail['selectors']['shop-detail-scroll']
 reachable=set(k for k in expected if detail['selectors']['shop-stat-'+k]['effectiveVisibility']=='fully-visible')
 scrollEvidence=[]
 for f in sorted(P.glob(size+'-detail-keyboard-scroll*.json')):
  c=load(f.name);visible=[k for k in expected if c['selectors']['shop-stat-'+k]['effectiveVisibility']=='fully-visible'];reachable.update(visible)
  scrollEvidence.append({'file':f.name,'scrollTop':c['selectors']['shop-detail-scroll']['scrollTop'],'fullyVisibleRows':visible})
 assert reachable==set(expected)
 rows.append({'viewport':size,'shopRectXYWH':rect(inline['selectors']['shop-scene']),'inline':stats(inline,'shop-summary-stat-'),'inlineStatSlotDisplay':inline['selectors']['shop-stat-slot']['display'],'detailOpener':{'rectXYWH':rect(opener['selectors']['shop-detail-open']),'enabled':True,'keyboardOpened':True},'detailInitial':stats(detail,'shop-stat-'),'detailScroll':{'rectXYWH':rect(scroll),'clientHeight':scroll['clientHeight'],'scrollHeight':scroll['scrollHeight'],'initialScrollTop':scroll['scrollTop']},'keyboardScrollEvidence':scrollEvidence,'detailReturnFocus':returned['focus']})
write('visibility-table.json',{'projectId':provenance['projectId'],'title':provenance['title'],'rectUnits':'CSS px; XYWH rounded to 0.001; unrounded raw captures retain all ancestor geometry','visibilityMetric':'Row boxes intersected with browser viewport and clipping ancestors; not OCR or glyph-level visibility','rows':rows})
log=load('browser-session.json');assert not log['failedRequests']
prior=load('../loaded-bundle-evidence.json')
for item in prior:
 current=next(x for x in log['loadedCode'] if x['url']==item['url'])
 assert current['sha256']==item['sha256']
assert hashlib.sha256((P/'canonical-project.json').read_bytes()).hexdigest()==provenance['snapshotSha256']
assert provenance['identicalToPrior']
assert load('before-unequip.json')['inventory']=={}
assert load('after-unequip.json')['inventory']=={'equip_sword':1}
assert all(row['command']['op']!='mouse' for row in log['actions'])
assert all(x['closed'] for x in log['cleanup'])
control=load('browser-control.json');s=socket.socket();owned_listener=s.connect_ex(('127.0.0.1',control['port']))==0;s.close()
assert not owned_listener and not Path('/proc/'+str(control['pid'])).exists()
servers={}
for port in [9841,9888]:
 s=socket.socket();servers[str(port)]=s.connect_ex(('127.0.0.1',port))==0;s.close()
assert all(servers.values())
shots=[]
for f in sorted(P.glob('*.png')):
 data=f.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';width,height=struct.unpack('>II',data[16:24])
 if f.name[0].isdigit() and 'x' in f.name.split('-')[0]:assert f.name.startswith(f'{width}x{height}-')
 shots.append({'file':f.name,'width':width,'height':height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for f in P.glob('*.py'):ast.parse(f.read_text(),filename=str(f))
for name in ['browser-live.mjs','capture.js']:subprocess.run(['node','--check',str(P/name)],check=True)
write('verification.json',{'result':'PASS','checked':'three actual viewports; all 4 numeric attributes inline/detail; selected canonical row; keyboard opener and return focus; each detail row visibly reachable; snapshot and shipped bundle hash equality; screenshot sizes; script syntax; cleanup','screenshots':shots,'recordedObserverErrors':log['errors'],'observerErrorAssessment':'Evidence harness Missing observed state entries retained, including a mistaken child-focus predicate in the status menu. Actual menu used aria-activedescendant; resumed same browser and same gameplay, no reset. No failed network requests. These logs do not support a zero-error-run claim.','ownedPageContextBrowserClosed':log['cleanup'],'ownedProcessAbsent':True,'ownedControlListenerAbsent':True,'existingServersListening':servers,'imageReviewLimitation':'Model cannot view images; files captured and dimensions verified. Visibility judgments use DOM clipping geometry and source CSS, not subjective screenshot inspection.'})
print(json.dumps({'result':'PASS','viewports':len(rows),'screenshots':len(shots),'servers':servers,'observerErrorsRetained':len(log['errors'])}))
