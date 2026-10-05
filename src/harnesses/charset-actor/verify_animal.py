"""CI: 동물의 몸통/발 분리, 원본 봉인, 선택 준비 상태의 우회 방지."""
import copy
import json
import tempfile
from pathlib import Path

import animal_motion as A
import bulk as B
import chr as C
import delivery as D
import harness as H
import motion as M
import recipes as R


def verify(check, isolated_store):
    for slot in range(8):
        pal, frames = H.base_of(f'Animal:{slot}')
        check(f'animal-{slot}-original-gait-supported', A.analyze(pal, frames, A.profile(slot))['ok'])
    pal, frames = H.base_of('Animal:0')
    value = A.profile(0)

    def copy_region(target, direction, step, source, part):
        x0,y0,x1,y1 = value['directions'][direction][part]
        for y in range(y0,y1+1):
            row = list(target[direction,step][y]); row[x0:x1+1] = source[y][x0:x1+1]
            target[direction,step][y] = ''.join(row)

    frozen = copy.deepcopy(frames)
    for d in C.DIRS:
        for s in (0,2): copy_region(frozen,d,s,frames[d,1],'body')
    check('animal-head-tail-and-feet-cannot-hide-frozen-body', not A.analyze(pal,frozen,value)['ok'])
    for part in ('foreFeet','hindFeet'):
        frozen = copy.deepcopy(frames)
        copy_region(frozen,'right',2,frames['right',0],part)
        report = A.analyze(pal,frozen,value)
        check(f'animal-other-feet-cannot-replace-{part}', not report['ok'] and report['directions']['right']['feet'][part]['changedPixels'] == 0)
    check('animal-frontal-occluded-feet-not-pretended-visible',
          set(value['directions']['down']) == {'body','visibleFeet'})
    check('animal-bird-uses-two-visible-feet', all('foreFeet' not in r and 'visibleFeet' in r for r in A.profile(2)['directions'].values()))
    bob = copy.deepcopy(frames)
    for d in C.DIRS: copy_region(bob,d,2,frames[d,0],'body')
    check('animal-same-body-phase-at-two-strides-allows-bob', A.analyze(pal,bob,value)['ok'])
    shifted = copy.deepcopy(frames)
    for d in C.DIRS:
        for s,dy in ((0,-1),(2,-2)):
            shifted[d,s] = [frames[d,1][y-dy] if 0<=y-dy<C.FH else '.'*C.FW for y in range(C.FH)]
    check('animal-translated-standing-is-not-walking', not A.analyze(pal,shifted,value)['ok'])
    tinted = copy.deepcopy(frames); expanded = dict(pal)
    symbols = [chr(i) for i in range(33,127) if chr(i) not in pal and chr(i) not in '.#']
    used = sorted({c for row in frames['down',1] for c in row if c!='.'})
    mapping = dict(zip(used,symbols))
    for c,new in mapping.items():
        r,g,b = pal[c]; expanded[new] = (r^1,g,b)
    for s in (0,2): tinted['down',s] = [''.join(mapping.get(c,c) for c in row) for row in frames['down',1]]
    report = A.analyze(expanded,tinted,value)
    check('animal-palette-flicker-is-not-body-motion', not report['ok'] and report['directions']['down']['body']['0']['geometryPixels']==0)

    with tempfile.TemporaryDirectory(prefix='charset-animal-') as tmp, isolated_store(Path(tmp)):
        rid = R.create_creatures()['id']; recipe = R.load(H.DATA/'recipes'/rid,check_tools=True)
        check('animal-reference-does-not-fabricate-human-selection',
              recipe['sourceMode']=='bundled-animal-reference' and all('acceptance' not in s for s in recipe['seeds']) and not H.DECISIONS.exists())
        check('animal-reference-preserves-eight-exact-atlas-inputs',
              all((H.DATA/'recipes'/rid/s['folder']/'input.png').read_bytes() == H.base_sheet(s['base'])[0].read_bytes() for s in recipe['seeds']))
        root = H.run_dir('animal-fixture'); root.mkdir(parents=True)
        manifest = R.bind(root,rid,1); manifest['productionPolicy'] = dict(maxReviewPending=2,repairRounds=0)
        H.write_json_atomic(root/'manifest.json',manifest)
        batch,rows = B.prepare_batch(root.name,manifest['characters'],1); row = rows[0]; w = batch/row['folder']
        q = {c: (rgb[0]^2,rgb[1],rgb[2]) if rgb is not None else None for c,rgb in pal.items()}
        (w/'out.chr.txt').write_text(C.dump(q,{},frames))
        H.write_json_atomic(w/'desc.json',dict(label='CI fixture',attributes=dict(kind='동물',age='불명',hair='털',clothing='없음')))
        H.write_json_atomic(w/'meta.json',dict(run=root.name,brief=row['key'],base=row['base'],seed=row['seed'],
                                              engine='gpt',**H.ENGINES['gpt'],pid=0,strength='free',reviewMode='human',
                                              animationMode=H.FRAME_AUTHOR_MODE,recipe=manifest['recipe'],motionPolicy=None,
                                              animalPolicy=A.VERSION,animalProfile=row['animalProfile']))
        H.record_model_frames(w); gate = H.make_views(w/'out.chr.txt',w/'views',row['base'],'free')
        proof = D.publish(w,gate)
        check('animal-delivery-binds-own-motion-not-human-policy', proof['animalPolicy']==A.VERSION and 'motionPolicy' not in proof and H.human_ready(w,gate))
        for filename in ('views/motion.json','views/motion.png','views/motion.gif'):
            path=w/filename; raw=path.read_bytes(); path.write_bytes(raw+b'changed')
            check('animal-stale-'+filename+'-not-selectable',not H.human_ready(w,gate)); path.write_bytes(raw)
        meta_path=w/'meta.json'; meta_raw=meta_path.read_bytes(); altered=json.loads(meta_raw); altered.pop('animalPolicy')
        H.write_json_atomic(meta_path,altered)
        check('animal-missing-worker-policy-not-selectable',not H.human_ready(w,gate)); meta_path.write_bytes(meta_raw)
        wrong=copy.deepcopy(manifest); wrong.pop('animalPolicy'); wrong['characters'][0].pop('animalPolicy')
        H.write_json_atomic(root/'manifest.json',wrong)
        altered=json.loads(meta_raw); altered.pop('animalPolicy'); H.write_json_atomic(meta_path,altered)
        check('animal-policy-deletion-cannot-fall-back-to-human',not H.human_ready(w,gate))
        H.write_json_atomic(root/'manifest.json',manifest); meta_path.write_bytes(meta_raw)
        wrong=copy.deepcopy(manifest); wrong['characters'][0]['animalProfile']['directions']['down']['body']=[0,0,23,31]
        H.write_json_atomic(root/'manifest.json',wrong)
        check('animal-moving-region-goalposts-not-selectable',not H.human_ready(w,gate))
        H.write_json_atomic(root/'manifest.json',manifest)
        check('animal-restored-proof-restores-readiness',H.human_ready(w,gate))
