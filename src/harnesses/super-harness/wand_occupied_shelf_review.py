"""Native re-review of unchanged occupied shelf against frozen current recipes."""
import argparse
import copy
import json
from pathlib import Path
import shutil
import hashlib

from PIL import Image
import wand_vacancy_prepare as vacancy

ITEM = 'wandtrial shelves'
RECIPES = 'art-output/space-demos/0e39fdb0cd526604'
OLD_RECEIPT = 'art-output/scene-spec-repair-r3/collections/collect-fcc0800b5894bc08aa5e/receipt.json'
GROUP = 'art-output/scene-spec-repair-r3/registration-source.json'


def prepare(root, out, previous):
    if out.exists():
        raise ValueError('New isolated scope required')
    vacancy.verify_frozen(previous)
    previous_receipt = json.loads((previous/'receipt.json').read_text())
    if previous_receipt['nativeVerdict']['verdict'] != 'PASS' or previous_receipt['contextVerdict']['verdict'] != 'PASS':
        raise ValueError('Previous vacancy must be independently reviewed')
    out.mkdir(parents=True)
    shutil.copytree(previous/'native-harness', out/'native-harness', ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    refs = {}
    for path in (out/'native-harness').rglob('*'):
        if path.is_file():
            refs[str(path.relative_to(out))] = dict(snapshot=str(path), sha256=vacancy.sha(path))

    def freeze(relative, expected=None):
        source = (root/relative).resolve()
        if not source.is_relative_to(root):
            raise ValueError('Source escapes native root')
        digest = vacancy.sha(source)
        if expected and digest != expected:
            raise ValueError('Source hash changed: '+relative)
        target = out/'inputs'/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,target)
        if vacancy.sha(target) != digest or vacancy.sha(source) != digest:
            raise ValueError('Source changed during freeze')
        refs[relative] = dict(source=str(source),snapshot=str(target),sha256=digest)
        return json.loads(target.read_text()) if target.suffix=='.json' else target

    old = freeze(OLD_RECEIPT)
    old_run = next(r for r in old['runs'] if r['item']==ITEM)
    old_verdict = json.loads(old_run['review'])
    if old_verdict['verdict'] != 'FAIL' or old_verdict['codes'] != ['READ']:
        raise ValueError('Original READ fail changed')
    group = next(g for g in freeze(GROUP)['groups'] if g['id']==ITEM)
    freeze(vacancy.SHELF,vacancy.SHELF_SHA)
    freeze(str(Path(vacancy.SHELF).with_suffix('.pxg')))
    freeze(str(Path(vacancy.SHELF).parent/'palette.pal'))
    actors = freeze(vacancy.ACTORS)
    freeze(actors['receipt']['path'], actors['receipt']['sha256'])
    for actor in actors['actors']:
        for source in actor['sources']:
            freeze(source['path'],source['sha256'])
    recipe_paths = []
    for name in [f'space-state-{i}.recipe.json' for i in range(1,5)] + [f'response-frame-{i}.recipe.json' for i in range(1,9)]:
        relative = RECIPES+'/'+name
        recipe = freeze(relative)
        recipe_paths.append(relative)
        for source in recipe['sources']:
            freeze(source['path'],source['sha256'])
        freeze(str(Path(relative).with_suffix('.png')))
    # The reviewed vacant bed is a separate state, not a changed occupied source.
    vacant = out/'inputs/vacant-state.png'
    shutil.copy2(previous_receipt['candidate'],vacant)
    if vacancy.sha(vacant) != previous_receipt['candidateSha256']:
        raise ValueError('Reviewed vacancy changed')
    refs['vacancy'] = dict(snapshot=str(vacant),sha256=vacancy.sha(vacant))
    for name in ['receipt.json','context-verdict.json','context-evidence.json']:
        target = out/'inputs/vacancy-review'/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(previous/name,target)
        refs['vacancy-review/'+name] = dict(snapshot=str(target),sha256=vacancy.sha(target))
    content = out/'content/tiledata/hand-interior'
    for name in ['v5/interior-meta.json','v5/interior-atlas.png','pick/palette/v6.pal']:
        target=content/name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(previous/'content/tiledata/hand-interior'/name,target)
        refs['scaffold/'+name]=dict(snapshot=str(target),sha256=vacancy.sha(target))
    # Lock both complete source slots. There is no editable pixel in this order.
    group=copy.deepcopy(group)
    for slot in group['slots']:
        slot['locked']=True
    vacancy.save(content/'new/items.json',{'items':[]})
    vacancy.save(content/'new/sets.json',{'sets':[group]})
    candidate=content/'pick/candidates/wandtrial_shelves';candidate.mkdir(parents=True)
    for stem in ['seed','source-r1','h1-A']:
        shutil.copy2(out/'inputs'/vacancy.SHELF,candidate/(stem+'.png'))
    for stem in ['source-r1','h1-A']:
        shutil.copy2(out/'inputs'/Path(vacancy.SHELF).with_suffix('.pxg'),candidate/(stem+'.pxg'))
    vacancy.save(out/'input-manifest.json',dict(status='prepared-not-approved',sources=refs,recipes=recipe_paths,
        originalCandidate='h2-A',originalItem=ITEM,originalSha256=vacancy.SHELF_SHA,artworkRoot=str(root),nativeExecuted=False))
    vacancy.save(out/'initial-READ-verdict.json',old_verdict)
    vacancy.save(out/'request.json',dict(item=ITEM,sourceCandidate='h2-A',sourceSha256=vacancy.SHELF_SHA,
        sourceReceipt=refs[OLD_RECEIPT],originalVerdict=old_verdict,operation='independent re-review only; zero pixel changes',
        currentRecipes=recipe_paths[:4],retainFullRoomGeometryAndResponseFailures=True,runtimePassed=False))
    render_context(out)
    template=out/'review-original.md'
    template.write_text('Independent native re-review of ORIGINAL occupied wandtrial shelves h2-A. No drawing or editing. '
        'Candidate must remain sha256 '+vacancy.SHELF_SHA+'. Open {PACK}/cand-x8.png and seed.png; '
        'inspect both16x112 slots: eight actual boxes EACH, actual paper top3rows, open bed96rows, end face8px, '
        'transparent tail y104..111, source palette/lighting/projection. Read request.json and initial-READ-verdict.json. '
        'The previous FAIL was missing actual scene context, with both native source slots PASS. New actual frozen four '
        'states and eight response recipe images are in '+str(out/'context')+'. Open scene-state1..4.png and -x3.png, '
        'actor-west/east sequences for both actors and depth samples. Read context-evidence.json. '
        'Confirm occupied source placements screen west[16,88,32,192),east[144,88,160,192), preserved north stock, '
        'the box5 real actor contact/lift geometry and depth bands. The already reviewed vacant bed is a separate lifted '
        'state; ORIGINAL occupied source remains eight boxes per side and unchanged. Scope is local source suitability '
        'and the missing actual context evidence. This does NOT approve full room, doors/walls, overall geometry, response '
        'occlusion/timing or runtime: any existing full-room failures remain pending. If supplied context demonstrates '
        'a genuine shelf-specific incompatibility report FAIL with concrete coordinates; do not promote source PASS '
        'to full-room PASS. Do not fail solely because an unrelated generic scholar-room backdrop is absent; actual current '
        'context is supplied. Use actual frozen images, not model assertions. Write {PACK}/verdict.json with '
        'verdict PASS/FAIL,candidateSha256,scope="native-occupied-shelf-context",reasons,codes,fix, '
        'slotResults [{key,verdict,top_rows,top_y,side_elevation,boxCount,evidence}],contextEvidence, '
        'fullRoomApproved:false,runtimePassed:false.\n')
    vacancy.save(out/'data/seed.json',{'items':[ITEM],'reviewTemplate':str(template),'nativeAttempts':1,'candidateCount':1})
    harness=vacancy.environment(out)
    harness.draw([ITEM],n=1,note='Independent review ONLY of original h2-A unchanged bytes; no drawing. Actual current context supplied.',base='source-r1',start_pool=False)
    record=harness.store.runs()[0]
    harness._finish(record,0)
    record=harness.store.runs()[0]
    if not record['ok'] or record['phase']!='review':
        raise ValueError('Native machine inspection failed: '+str(record.get('error')))
    harness.store.update_run(record['id'],history=json.dumps([{'stage':'original-READ-evidence','sourceVerdict':old_verdict,'candidateSha256':vacancy.SHELF_SHA}],ensure_ascii=False))
    print(json.dumps({'scope':str(out),'phase':'review','originalBytesUnchanged':vacancy.sha(candidate/'h1-A.png')==vacancy.SHELF_SHA}))


def render_context(out):
    manifest=vacancy.verify_frozen(out)
    refs=manifest['sources']
    def read(relative): return json.loads(Path(refs[relative]['snapshot']).read_text())
    def image(relative): return Image.open(refs[relative]['snapshot']).convert('RGBA')
    context=out/'context';context.mkdir(exist_ok=True)
    proofs=[]
    generated=[]
    recipes=[read(path) for path in manifest['recipes']]
    def composite(recipe,skip_actors=False,side=None,lift=False,actor_frame=None,actor_sole=None):
        canvas=Image.new('RGBA',tuple(recipe['canvas']))
        crops=[]; actor_inserted=False
        def insert_actor():
            nonlocal actor_inserted
            if actor_frame is not None and not actor_inserted:
                frame,anchor=actor_frame
                canvas.alpha_composite(frame,(actor_sole[0]-anchor[0],actor_sole[1]-anchor[1]))
                actor_inserted=True
        for op in recipe['placements']:
            source=recipe['sources'][op['source']]['path']
            if skip_actors and '/native-actors/' in source:continue
            native=image(source)
            if source==vacancy.SHELF:
                if actor_sole and op['at'][1]+op['rect'][3]>actor_sole[1]:insert_actor()
                if lift and op['at'][0]==(16 if side=='west' else 144):native=image('vacancy')
            x,y,w,h=op['rect'];crop=native.crop((x,y,x+w,y+h))
            canvas.alpha_composite(crop,tuple(op['at']))
            crops.append(dict(source=source,rect=op['rect'],at=op['at'],cropRgbaSha256=hashlib.sha256(crop.tobytes()).hexdigest()))
        insert_actor()
        return canvas,crops
    for i,recipe in enumerate(recipes):
        rendered,crops=composite(recipe)
        ref=image(str(Path(manifest['recipes'][i]).with_suffix('.png')))
        if rendered.tobytes()!=ref.tobytes():raise ValueError('Current recipe does not losslessly reproduce provided PNG')
        name='scene-state'+str(i+1) if i<4 else 'response-frame'+str(i-3)
        target=context/(name+'.png');rendered.save(target)
        rendered.resize((rendered.width*3,rendered.height*3),Image.Resampling.NEAREST).save(context/(name+'-x3.png'))
        proofs.append(dict(file=str(target),sha256=vacancy.sha(target),recipe=manifest['recipes'][i],crops=crops))
    actors=read(vacancy.ACTORS)
    for actor in actors['actors']:
        walk=image(actor['sources'][0]['path']);actions=image(actor['sources'][1]['path'])
        for side,sole,row,direction in [('west',(48,128),96,'left'),('east',(136,128),32,'right')]:
            sequence=[]
            frames=[a for a in actor['actions'] if a['id'].startswith('shelf-lift-'+direction+'-')]
            for i,state in enumerate(['before','contact','lift1','lift2']):
                if i==0:frame=walk.crop((24,row,48,row+32));anchor=[12,31];rect=[24,row,24,32]
                else:
                    native=frames[i-1];x,y,w,h=native['rect'];frame=actions.crop((x,y,x+w,y+h));anchor=native['anchor'];rect=native['rect']
                result,crops=composite(recipes[0],True,side,i>=2,(frame,anchor),sole)
                sequence.append(result)
                proofs.append(dict(actor=actor['id'],side=side,state=state,soleScreen=sole,soleWorld=[sole[0],sole[1]-32],
                    anchor=anchor,rect=rect,durationMs=None if i==0 else 200,nativeActionIndex=None if i==0 else actor['actions'].index(frames[i-1]),crops=crops))
            strip=Image.new('RGBA',(176*4,224))
            for i,result in enumerate(sequence):strip.alpha_composite(result,(176*i,0))
            for scale in [1,3]:strip.resize((strip.width*scale,strip.height*scale),Image.Resampling.NEAREST).save(context/(actor['id']+'-'+side+'-sequence'+('' if scale==1 else '-x3')+'.png'))
            # Each original run is split at the actual six ground south edges.
            depth=Image.new('RGBA',(176*6,224))
            for i,foot in enumerate([112,128,144,160,176,192]):
                idle=walk.crop((24,row,48,row+32))
                result,_=composite(recipes[0],True,actor_frame=(idle,[12,31]),actor_sole=(sole[0],foot))
                depth.alpha_composite(result,(176*i,0))
            depth.save(context/(actor['id']+'-'+side+'-depth.png'))
    for target in sorted(context.glob('*.png')):
        generated.append(dict(file=str(target),sha256=vacancy.sha(target)))
    vacancy.save(out/'context-evidence.json',dict(generated=generated,recipeRound=RECIPES,originalSourceSha256=vacancy.SHELF_SHA,
        proofCount=len(proofs),proofs=proofs,depthGroundSouthEdges=[112,128,144,160,176,192],
        composition='lossless native recipe; inserted native actors sorted at shelf depth bands',runtimePassed=False,
        fullRoomApproved=False))


def run(out):
    vacancy.verify_frozen(out)
    harness=vacancy.environment(out)
    harness.pool()
    vacancy.verify_frozen(out)
    for proof in json.loads((out/'context-evidence.json').read_text())['generated']:
        if vacancy.sha(proof['file']) != proof['sha256']:
            raise ValueError('Reviewer changed actual context')
    record=harness.store.runs()[0]
    candidate=out/'content/tiledata/hand-interior/pick/candidates/wandtrial_shelves/h1-A.png'
    if vacancy.sha(candidate)!=vacancy.SHELF_SHA:raise ValueError('Native reviewer changed original source')
    if record['status']!='done' or not record['ok']:raise ValueError('Native review did not finish')
    verdict=json.loads(record['review'])
    if verdict.get('candidateSha256')!=vacancy.SHELF_SHA:raise ValueError('Verdict not bound to original source')
    vacancy.save(out/'receipt.json',dict(status='reviewed-not-selected',item=ITEM,originalCandidate='h2-A',
        originalSourceSha256=vacancy.SHELF_SHA,candidate=str(candidate),candidateSha256=vacancy.sha(candidate),
        verdict=verdict,initialVerdictFile=str(out/'initial-READ-verdict.json'),
        initialVerdictSha256=vacancy.sha(out/'initial-READ-verdict.json'),
        verdictFile=str(Path(record['brief'])/'review/A-a1/verdict.json'),
        verdictSha256=vacancy.sha(Path(record['brief'])/'review/A-a1/verdict.json'),
        contextEvidenceFile=str(out/'context-evidence.json'),contextEvidenceSha256=vacancy.sha(out/'context-evidence.json'),
        inputManifestSha256=vacancy.sha(out/'input-manifest.json'),fullRoomApproved=False,runtimePassed=False,
        publicRegistered=False,canonicalReload=False,selection=None))
    print(json.dumps({'receipt':str(out/'receipt.json'),'verdict':verdict['verdict']}))


def main():
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['prepare','run'])
    parser.add_argument('--root',type=Path);parser.add_argument('--previous',type=Path)
    parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    if args.phase=='prepare':prepare(args.root.resolve(),args.out.resolve(),args.previous.resolve())
    else:run(args.out.resolve())


if __name__=='__main__':main()
