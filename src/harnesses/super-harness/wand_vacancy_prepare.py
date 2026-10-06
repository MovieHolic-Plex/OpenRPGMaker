"""Isolated native shelf vacancy order and lossless contextual evidence. No publication."""
import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import shutil
import sys
import subprocess

REPO = Path(__file__).resolve().parents[3]
ITEM = 'wand-shelf-vacancy'
SHELF = 'art-output/scene-spec-repair-r3/content/tiledata/hand-interior/pick/candidates/wandtrial_shelves/h2-A.png'
SHELF_SHA = 'a87dc7dff18736836eaa256e5b9e873939dec4cf2a49ebc74356438821b5bd16'
ACTORS = 'art-output/native-actors/runtime-packs/8dda17a6e4eb8db4/runtime-assets.json'
RECIPE = 'art-output/space-demos/d9b66483443e5a8f/space-state-0.recipe.json'
RECTS = [(2, 34, 12, 5), (18, 34, 12, 5)]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def environment(out):
    os.environ.update(PROP_HARNESS_DATA=str(out / 'data'), PROP_HARNESS_CONTENT_ROOT=str(out / 'content'),
                      HIP_DB=str(out / 'picks/picks.sqlite'), HIP_DATA=str(out / 'picks'), HIP_PICK=str(out / 'picks'),
                      PROP_HARNESS_WORK=str(out / 'work'), PROP_HARNESS_ENGINE='codex',
                      PROP_HARNESS_PAR='1', PROP_HARNESS_ATTEMPTS='1')
    native = out / 'native-harness'
    sys.path.insert(0, str(native))
    sys.path.insert(0, str(native / 'scripts/content/hand-interior-pick'))
    return importlib.import_module('src.harnesses.interior-props.harness')


def prepare(root, out):
    if out.exists():
        raise ValueError('Output scope must be new')
    if sha(root / SHELF) != SHELF_SHA:
        raise ValueError('Shelf source changed')
    out.mkdir(parents=True)
    native = out / 'native-harness'
    for relative in ['src/harnesses/interior-props', 'scripts/content/hand-interior-pick', 'scripts/content/pixel-harness', 'scripts/content/hand-interior', 'tiledata/hand-interior/refmap-study']:
        shutil.copytree(root / relative, native / relative, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for relative in ['tiledata/atlas-pick/style-demo-view34/interior-new-bookshelf.png', 'tiledata/atlas-pick/style-demo-view34/interior-new-wardrobe.png', 'tiledata/hand-interior/pick/candidates/sideboard_2x1/v5.png', 'tiledata/atlas-pick/style-demo-view34/interior-new-fireplace.png']:
        target = native / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / relative, target)
    refs = {}
    for code in native.rglob('*'):
        if code.is_file():
            refs[str(code.relative_to(native))] = {'source': str(root / code.relative_to(native)), 'snapshot': str(code), 'sha256': sha(code)}

    def freeze(relative, expected=None):
        source = (root / relative).resolve()
        if not source.is_relative_to(root):
            raise ValueError('Source outside artwork root')
        digest = sha(source)
        if expected is not None and digest != expected:
            raise ValueError('Changed source: ' + str(source))
        dest = out / 'inputs' / source.relative_to(root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        if sha(dest) != digest or sha(source) != digest:
            raise ValueError('Source changed during snapshot')
        refs[relative] = {'source': str(source), 'snapshot': str(dest), 'sha256': digest}
        return json.loads(dest.read_text()) if dest.suffix == '.json' else dest

    shelf = freeze(SHELF, SHELF_SHA)
    freeze(str(Path(SHELF).with_suffix('.pxg')))
    freeze(str(Path(SHELF).parent / 'palette.pal'))
    recipe = freeze(RECIPE)
    for source in recipe['sources']:
        freeze(source['path'], source['sha256'])
    actors = freeze(ACTORS)
    freeze(actors['receipt']['path'], actors['receipt']['sha256'])
    for actor in actors['actors']:
        for source in actor['sources']:
            freeze(source['path'], source['sha256'])
    scaff = root / 'art-output/scene-spec-repair-r4-prep-rev4/content/tiledata/hand-interior'
    content = out / 'content/tiledata/hand-interior'
    for relative in ['v5/interior-meta.json', 'v5/interior-atlas.png', 'pick/palette/v6.pal']:
        source = scaff / relative
        dest = content / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        refs[str(source)] = {'source': str(source), 'snapshot': str(dest), 'sha256': sha(dest)}
    slots = []
    # Disjoint rectangles cover all 3584 pixels. Only the two existing boxes are editable.
    for key, rect, locked in [
        ('preserved-top', (0, 0, 32, 34), True), ('preserved-bottom', (0, 39, 32, 73), True),
        ('preserved-left-rim', (0, 34, 2, 5), True), ('preserved-middle-rims', (14, 34, 4, 5), True),
        ('preserved-right-rim', (30, 34, 2, 5), True),
        ('west-empty-bed', RECTS[0], False), ('east-empty-bed', RECTS[1], False)]:
        x, y, w, h = rect
        slots.append(dict(key=key, label=key, x=x, y=y, w=w, h=h, foot=[1, 1], layer=2,
                          mount='floor', origin=[0, 8], topMin=0, locked=locked,
                          see='Exact source pixels' if locked else 'Empty native oak bed of box5; no paper box or grip; opaque support remains'))
    note = ('Minimal native vacant shelf bed, not a new shelf. Copy source-r1.pxg exactly; edit ONLY '
            'XYWH[2,34,12,5] and [18,34,12,5]. Remove box5 paper lid, border and grip and reveal the '
            'existing oak bed under that box, using the same theme palette/projection/light. Do not erase '
            'to transparency, paint a black hole, duplicate another box, resize, mirror or remap colors. '
            'Every pixel outside these rectangles is locked to seed.png; seven other boxes per side, '
            'rims, grain, joins and transparent y104..111 remain exact. These are edit masks inside a '
            'continuous32x112 native sheet, NOT separate new furniture slots; ignore generic slot bottom '
            'grounding/transparency guidance for the edit masks. Source upper plane and bed height6 '
            'are preserved. Candidate has two independently drawn empty sockets, same source orientation. '
            'Actual west/east actor sole(48,128)/(136,128), contact(29,124)/(146,124), lifted hand '
            '(29,120)/(146,120); anchor24,31; actions200ms. Contact uses occupied shelf, lift uses vacant '
            'bed and original held-box actor pixels. Independent contextual review is required afterward.')
    group = dict(id=ITEM, name_ko='지팡이 상자5 빈 받침', category='shop', category_ko='지팡이 상점',
                 kind='floor', canvas=[32, 112], footprint={'w': 2, 'h': 1}, description=note,
                 parent=ITEM, derive='production', slots=slots, contract={'editMasksXYWH': RECTS, 'outside': 'exact locked seed pixels', 'source': SHELF, 'canvas': [32,112]})
    save(content / 'new/items.json', {'items': []})
    save(content / 'new/sets.json', {'sets': [group]})
    candidate = content / 'pick/candidates/wand_shelf_vacancy'
    candidate.mkdir(parents=True)
    shutil.copy2(shelf, candidate / 'seed.png')
    shutil.copy2(shelf, candidate / 'source-r1.png')
    shutil.copy2(out / 'inputs' / Path(SHELF).with_suffix('.pxg'), candidate / 'source-r1.pxg')
    save(out / 'request.json', dict(version=1, status='prepared-not-approved', source=refs[SHELF],
         editableRectsXYWH=RECTS, preserveOutside=True, candidateCount=1, nativeAttempts=1,
         actorPack=refs[ACTORS], recipe=refs[RECIPE], geometry={'westSole': [48, 128], 'eastSole': [136, 128],
         'anchor': [24, 31], 'durationMs': [200, 200, 200]}, approval=None, runtimePassed=False))
    save(out / 'data/seed.json', {'items': [ITEM], 'candidateCount': 1, 'nativeAttempts': 1,
                                 'preserveExisting': True, 'publicRegistered': False})
    (out / 'production-brief.md').write_text(note + '\n')
    save(out / 'input-manifest.json', dict(artworkRoot=str(root), sources=refs, recipe=RECIPE, actors=ACTORS,
                                        shelf=SHELF, status='prepared-not-approved'))
    harness = environment(out)
    harness.draw([ITEM], n=1, note=note, base='source-r1', start_pool=False)
    print(json.dumps({'output': str(out), 'queued': 1, 'nativeExecuted': False}))


def configure_native_context(out, harness):
    template = out / 'review-with-native-context.md'
    if not template.exists():
        template.write_text(
            'Independent native shelf-state review. Open {PACK}/cand-x8.png, {PACK}/pair-x8.png, '
            '{CAND} sibling PNG and seed.png. Inspect actual four actor/side sequences at ' + str(out/'context') +
            ' and read request.json/context-evidence.json. Frames before/contact/lift1/lift2. '
            'Require exact complement pixels, original palette/projection, opaque oak vacant box5 socket, '
            'seven remaining boxes per side, exact contact and one held target box in lifted frames. '
            'Edit masks are parts of a continuous shelf, not separate furniture; height/ground/rims remain source exact. '
            'Generic scholar-room backdrop and unrelated old style documents are not required for this isolated state. '
            'Original room wall FAIL stays unresolved. Do not alter source or candidate. '
            'Write {PACK}/verdict.json with verdict PASS/FAIL, reasons, codes, fix, top_rows/top_y/side_elevation '
            'and perActorSide observations. Judge actual PNGs, not notes or earlier assertions.\n')
    seed = out / 'data/seed.json'
    config = json.loads(seed.read_text())
    config['reviewTemplate'] = str(template)
    save(seed, config)
    original = harness._review_prompt

    def actual_prompt(run):
        collect(out)
        return original(run)

    harness._review_prompt = actual_prompt


def verify_frozen(out):
    manifest = json.loads((out / 'input-manifest.json').read_text())
    for entry in manifest['sources'].values():
        if sha(entry['snapshot']) != entry['sha256']:
            raise ValueError('Frozen input changed: ' + entry['snapshot'])
    return manifest


def collect(out):
    from PIL import Image
    import numpy as np
    manifest = verify_frozen(out)
    refs = manifest['sources']

    def source(relative):
        entry = refs[relative]
        path = Path(entry['snapshot'])
        if sha(path) != entry['sha256']:
            raise ValueError('Frozen input changed: ' + relative)
        return path

    candidate = out / 'content/tiledata/hand-interior/pick/candidates/wand_shelf_vacancy/h1-A.png'
    base = Image.open(source(SHELF)).convert('RGBA')
    vacant = Image.open(candidate).convert('RGBA')
    if vacant.size != base.size:
        raise ValueError('Candidate geometry changed')
    mask = np.zeros((112, 32), bool)
    for x, y, w, h in RECTS:
        mask[y:y+h, x:x+w] = True
    changed = (np.array(base) != np.array(vacant)).any(axis=2)
    if (changed & ~mask).any() or not all(changed[y:y+h, x:x+w].any() for x,y,w,h in RECTS):
        raise ValueError('Candidate violates exact change masks')
    if not set(map(tuple, np.array(vacant).reshape(-1,4))) <= set(map(tuple, np.array(base).reshape(-1,4))):
        raise ValueError('Candidate introduced new source colors')
    recipe = json.loads(source(RECIPE).read_text())
    actors = json.loads(source(ACTORS).read_text())
    proofs = []
    for actor in actors['actors']:
        for side, sole, direction in [('west', (48,128), 'left'), ('east', (136,128), 'right')]:
            walk = Image.open(source(actor['sources'][0]['path'])).convert('RGBA')
            action = Image.open(source(actor['sources'][1]['path'])).convert('RGBA')
            frames = [a for a in actor['actions'] if a['id'].startswith('shelf-lift-'+direction+'-')]
            if len(frames) != 3 or [a['durationMs'] for a in frames] != [200]*3:
                raise ValueError('Native action sequence changed')
            panels = []
            for index, state in enumerate(['before', 'contact', 'lift-1', 'lift-2']):
                image = Image.new('RGBA', tuple(recipe['canvas']))
                crops = []
                for op in recipe['placements']:
                    ref = recipe['sources'][op['source']]
                    if '/native-actors/' in ref['path']:
                        continue
                    native = Image.open(source(ref['path'])).convert('RGBA')
                    if ref['path'] == SHELF and index >= 2 and op['at'][0] == (16 if side=='west' else 144):
                        native = vacant
                    x,y,w,h = op['rect']
                    crop = native.crop((x,y,x+w,y+h))
                    image.alpha_composite(crop, tuple(op['at']))
                    crops.append({'source': ref['path'], 'rect': op['rect'], 'at': op['at'],
                                  'cropRgbaSha256': hashlib.sha256(crop.tobytes()).hexdigest()})
                if index == 0:
                    rect = [24, 96 if side=='west' else 32, 24, 32]
                    anchor = [12,31]
                    frame = walk.crop((rect[0],rect[1],rect[0]+24,rect[1]+32))
                else:
                    native_frame = frames[index-1]
                    rect = native_frame['rect']; anchor = native_frame['anchor']
                    x,y,w,h = rect; frame = action.crop((x,y,x+w,y+h))
                at = [sole[0]-anchor[0], sole[1]-anchor[1]]
                image.alpha_composite(frame, tuple(at))
                name = actor['id']+'-'+side+'-'+state
                file = out / 'context' / (name+'.png'); file.parent.mkdir(exist_ok=True)
                image.save(file)
                image.resize((image.width*3,image.height*3), Image.Resampling.NEAREST).save(file.with_name(name+'-x3.png'))
                panels.append(image)
                proofs.append(dict(file=str(file), sha256=sha(file), actor=actor['id'], side=side, state=state,
                                   soleScreen=sole, soleWorld=[sole[0],sole[1]-32], anchor=anchor, screenTL=at, worldTL=[at[0],at[1]-32], actorRectXYWH=rect,
                                   nativeActionIndex=None if index==0 else actor['actions'].index(frames[index-1]), durationMs=None if index==0 else 200,
                                   actorCropRgbaSha256=hashlib.sha256(frame.tobytes()).hexdigest(), crops=crops))
            strip = Image.new('RGBA', (176*4,224))
            for i,panel in enumerate(panels): strip.alpha_composite(panel,(176*i,0))
            strip.save(out / 'context' / (actor['id']+'-'+side+'-sequence.png'))
            strip.resize((strip.width*3,strip.height*3),Image.Resampling.NEAREST).save(out / 'context' / (actor['id']+'-'+side+'-sequence-x3.png'))
    save(out / 'context-evidence.json', dict(candidate=str(candidate), candidateSha256=sha(candidate),
         changedPixels=int(changed.sum()), changesOutsideMask=0, proofs=proofs, independentContextVerdict=None,
         runtimePassed=False, publicRegistered=False, canonicalReload=False))
    (out / 'context-review-prompt.md').write_text('Open the four actual *-sequence.png and *-sequence-x3.png files in '+str(out/'context')+
        '. Review before/contact/lift1/lift2 for both delivered actors and both shelves. Check native anchor and hand contacts, '
        'exact empty box5 bed, seven remaining boxes per side, exactly one held target box, no duplicate box on vacated socket, '
        'no black/transparent hole, unchanged projection/palette/other pixels. Compare request.json, context-evidence.json and '
        'native harness verdict. Do not edit source/candidate or approve on text alone. Write context-verdict.json with verdict '
        'PASS/FAIL, candidateSha256, perActorSide (four entries {actor,side,verdict,evidence}) and specific pixel coordinates for failures. This is contextual art '
        'review only; runtimePassed/publicRegistered/canonicalReload stay false. Existing old room-wall FAIL stays unresolved.\n')
    print(json.dumps({'candidate':str(candidate),'context':str(out/'context'),'changedPixels':int(changed.sum())}))


def review_context(out):
    verify_frozen(out)
    harness = environment(out)
    run = harness.store.runs()[0]
    verdict = json.loads(run.get('review') or '{}')
    if run['status'] != 'done' or not run['ok'] or verdict.get('verdict') != 'PASS':
        raise ValueError('Native independent PASS required before contextual review')
    collect(out)
    candidate = out/'content/tiledata/hand-interior/pick/candidates/wand_shelf_vacancy/h1-A.png'
    expected_candidate = sha(candidate)
    prompt = (out / 'context-review-prompt.md').read_text()
    work = out / 'context-review-work'; work.mkdir(exist_ok=True)
    cmd = [shutil.which('codex') or str(Path.home()/'.local/bin/codex'), 'exec', '-m', harness.CODEX_MODEL,
           '-c', 'model_reasoning_effort="medium"', '--skip-git-repo-check', '-s', 'workspace-write',
           '--add-dir', str(out), '-C', str(work), '-']
    with (out/'context-review.log').open('w') as log:
        result = subprocess.run(cmd, input=prompt, text=True, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        raise ValueError('Context reviewer failed; inspect context-review.log')
    verdict = json.loads((out/'context-verdict.json').read_text())
    verify_frozen(out)
    if sha(candidate) != expected_candidate:
        raise ValueError('Reviewer changed candidate; review invalid')
    evidence = json.loads((out/'context-evidence.json').read_text())
    for proof in evidence['proofs']:
        if sha(proof['file']) != proof['sha256']:
            raise ValueError('Reviewer changed contextual evidence')
    if verdict.get('verdict') not in ['PASS','FAIL'] or verdict.get('candidateSha256') != sha(candidate):
        raise ValueError('Context verdict missing or not hash bound')
    save(out/'receipt.json', dict(status='reviewed-not-selected', candidate=str(candidate), candidateSha256=sha(candidate),
         nativeVerdict=json.loads(run['review']), contextVerdict=verdict,
         contextVerdictFile=str(out/'context-verdict.json'), contextVerdictSha256=sha(out/'context-verdict.json'),
         contextEvidenceFile=str(out/'context-evidence.json'), contextEvidenceSha256=sha(out/'context-evidence.json'),
         selection=None,
         sourceManifestSha256=sha(out/'input-manifest.json'), publicRegistered=False, canonicalReload=False, runtimePassed=False))
    print(json.dumps({'receipt':str(out/'receipt.json'),'contextVerdict':verdict['verdict']}))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('phase', choices=['prepare','run','collect','review-context','recover-check'])
    parser.add_argument('--root', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args=parser.parse_args(); out=args.out.resolve()
    if args.phase=='prepare': prepare(args.root.resolve(),out)
    elif args.phase=='run':
        verify_frozen(out)
        harness = environment(out)
        configure_native_context(out, harness)
        harness.pool()
    elif args.phase=='recover-check':
        verify_frozen(out)
        harness = environment(out)
        run = harness.store.runs()[0]
        if run['status'] != 'failed' or run['phase'] != 'draw' or '기계 검사 실행 오류' not in (run.get('error') or ''):
            raise ValueError('Only infrastructure checker recovery allowed')
        harness._finish(run, 0)
    elif args.phase=='review-context': review_context(out)
    else: collect(out)


if __name__=='__main__': main()
