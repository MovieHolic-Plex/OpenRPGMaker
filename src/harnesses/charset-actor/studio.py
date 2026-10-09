"""자유 저작 → GIF 대기열 → 사람이 남긴 칩 다운로드. 모델 점수는 사용하지 않는다."""
import argparse
import base64
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from pathlib import Path
from datetime import datetime

from PIL import Image
import harness as H
import chr as C

MAX_ARTISTS = 6


def active_productions():
    """Count live producer reservations without inspecting every sprite."""
    result = []
    for file in (H.DATA / 'runs').glob('*/driver.json'):
        driver = json.loads(file.read_text())
        if not H._alive(driver.get('pid')):
            continue
        layout_file = file.parent / 'production.json'
        layout = json.loads(layout_file.read_text()) if layout_file.exists() else {}
        result.append(dict(run=file.parent.name, par=int(driver.get('par', layout.get('par', 4)))))
    return result


def reserve_artists(par, exclude=None):
    used = sum(r['par'] for r in active_productions() if r['run'] != exclude)
    if used + par > MAX_ARTISTS:
        raise ValueError(f'AI 작업 {used}/{MAX_ARTISTS}개가 진행 중입니다. 제작 관리에서 잠시 정지한 뒤 다시 시작하세요.')


def run_root(run):
    if not isinstance(run, str) or not run or Path(run).name != run or run in ('.', '..'):
        raise ValueError('잘못된 실행 이름')
    root = H.run_dir(run)
    if not (root / 'manifest.json').is_file():
        raise ValueError('실행을 찾을 수 없습니다')
    return root


def launch(root, par=4, batch_size=2):
    with (root / 'production.log').open('a') as log:
        child = subprocess.Popen([sys.executable, str(H.HERE / 'bulk.py'), str(root / 'manifest.json'),
                                  '--par', str(par), '--batch-size', str(batch_size)],
                                 stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    H.write_json_atomic(root / 'driver.json', dict(pid=child.pid, started=H.now(), run=root.name,
                                                par=par, batchSize=batch_size))
    return dict(run=root.name, pid=child.pid)


def runs(items=None, *, blocked_by_run=None, decisions=None):
    items = H._items() if items is None else items
    result = []
    decisions = H._decisions() if decisions is None else decisions
    for file in sorted((H.DATA / 'runs').glob('*/manifest.json'), reverse=True):
        manifest = json.loads(file.read_text())
        if manifest.get('reviewMode') != 'human':
            continue
        root = file.parent
        driver = json.loads((root / 'driver.json').read_text()) if (root / 'driver.json').exists() else {}
        layout = json.loads((root / 'production.json').read_text()) if (root / 'production.json').exists() else {}
        state = json.loads((root / 'production-state.json').read_text()) if (root / 'production-state.json').exists() else {}
        alive = H._alive(driver.get('pid'))
        rows = [it for it in items if it['run'] == root.name]
        ready = [it for it in rows if it['status'] == 'done']
        kept = sum(H.effective_decision(root / it['dir'], decisions.get(it['id']), it['gate']) == 'accept' for it in ready)
        rejected = sum(H.effective_decision(root / it['dir'], decisions.get(it['id']), it['gate']) == 'reject' for it in ready)
        current_phase = state.get('phase', 'running')
        transfer_file = root / 'novelty-transfers.json'
        transfers = json.loads(transfer_file.read_text()) if transfer_file.exists() else []
        planned = max(0, state.get('plannedHere', len(manifest['characters'])) - len(transfers))
        phase = ('pausing' if (root / 'pause-request.json').exists() else current_phase if current_phase in ('running', 'waiting-review', 'pausing') else 'running') if alive else state.get('phase', 'interrupted')
        if not alive and phase in ('running', 'waiting-review', 'pausing'):
            phase = 'interrupted'
        result.append(dict(run=root.name, planned=planned, ready=len(ready), kept=kept,
                           rejected=rejected, awaiting=len(ready)-kept-rejected, phase=phase, error=state.get('error'),
                           title=manifest.get('title'), artists=driver.get('par', layout.get('par', 4)),
                           recipe=manifest.get('recipe'), animalPolicy=manifest.get('animalPolicy'), continuedIn=state.get('continuedIn'),
                           continuationOf=manifest.get('continuationOf'), ordered=len(manifest['characters']),
                           maxReviewPending=manifest.get('productionPolicy', {}).get('maxReviewPending'),
                           blocked=blocked_by_run.get(root.name, 0) if blocked_by_run is not None else sum((p / 'views' / 'gate.json').exists() and not H.current_gate(p)['ok']
                                       for p in root.glob('*__*') if (p / 'out.chr.txt').exists())))
    return result


def create(options):
    with H.data_lock('studio'):
        return _create(options)


def _create(options):
    import motion
    count = int(options.get('count', 100))
    par = int(options.get('par', 2))
    batch_size = int(options.get('batchSize', 2))
    if not 1 <= count <= 500 or not 1 <= par <= MAX_ARTISTS or not 1 <= batch_size <= 8:
        raise ValueError(f'개수 1~500, 동시 작업 1~{MAX_ARTISTS}, 묶음 크기 1~8')
    reserve_artists(par)
    concepts = options.get('concepts', [])
    if not isinstance(concepts, list) or len(concepts) > 500 or any(not isinstance(c, str) or not c.strip() or len(c) > 500 for c in concepts):
        raise ValueError('캐릭터별 콘셉트는 500자 이하 문장의 목록입니다')
    if options.get('distinctSources') and not any(options.get(k) for k in ('allSources', 'creatures', 'recipe', 'seedRun')):
        raise ValueError('원본 중복 방지는 에디터 전체 원본·남긴 그림·동물 원본 제작에서 사용할 수 있습니다')
    if options.get('allSources'):
        return _create_catalog(options, count, par)
    if options.get('creatures') or options.get('recipe') or options.get('seedRun'):
        return _create_variations(options, count, par)
    root = H.run_dir(datetime.now().strftime('%Y%m%d-%H%M%S') + '-free-' + uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    prompt = str(options.get('prompt') or '한국풍·판타지·현대·SF 등 여러 장르의 다양한 에디터용 인물. 콘셉트와 복식은 자유롭게 정한다.')[:4000]
    source = None
    if options.get('image') or options.get('reference'):
        if options.get('image'):
            raw = base64.b64decode(str(options['image']).split(',', 1)[-1], validate=True)
            original = Image.open(io.BytesIO(raw))
        else:
            original = Image.open(Path(options['reference']).expanduser())
        source = root / 'source-original.png'
        original.save(source)
        iid, slots, _ = H.ingest(source, '자유 저작 참고')
        bases = [f'input:{iid}:{slot}' for slot in slots]
    else:
        bases = [f'{sheet}:{slot}' for sheet in H.BASE_SHEETS for slot in range(8)]
    # 원본부터 결손이 있는 칸을 새로운 후보의 몸체 기준으로 쓰지 않는다.
    bases = [b for b in bases if C.gate(*H.base_of(b), H.base_of(b), strength='free')['ok']]
    if not bases:
        raise ValueError('머리/투명 결손 없는 캐릭터 칸을 찾을 수 없습니다')
    characters = [dict(key=f'free-{root.name[-8:]}-{i+1:03d}', name=f'자유 캐릭터 {i+1:03d}',
                       base=bases[i % len(bases)], brief=prompt + (' 이번 캐릭터: ' + concepts[i % len(concepts)] if concepts else ''),
                       strength='free', reviewMode='human',
                       source='upload' if source else 'rtp', genre='자유', role='', gender='', age='',
                       animationMode=H.FRAME_AUTHOR_MODE, motionPolicy=motion.VERSION) for i in range(count)]
    manifest = dict(run=root.name, reviewMode='human', animationMode=H.FRAME_AUTHOR_MODE, characters=characters, genres=['자유'],
                    sourceOriginal=str(source) if source else None, motionPolicy=motion.VERSION,
                    title=str(options.get('title') or '자유 캐릭터')[:80])
    H.write_json_atomic(root / 'manifest.json', manifest)
    return dict(launch(root, par, batch_size), count=count)


def _create_catalog(options, count, par):
    import catalog_sources as S
    import recipes as R
    distinct = options.get('distinctSources', True)
    if any(options.get(k) for k in ('image', 'reference', 'creatures', 'seedRun', 'recipe')):
        raise ValueError('에디터 전체 원본 제작에 다른 원본 방식을 섞지 않습니다')
    animal_count = min(8, count // 12)
    if animal_count and par < 2:
        raise ValueError('사람/몬스터와 동물의 합동 제작은 동시 작업 2개 이상이 필요합니다')
    limit, rounds = int(options.get('maxReviewPending', 12)), int(options.get('repairRounds', 2))
    if not par <= limit <= 40 or not 0 <= rounds <= 2:
        raise ValueError('검토 대기는 동시작업~40명, 기술 수정은 0~2회입니다')
    title = str(options.get('title') or f'에디터 전체 원본 {count}종')[:80]
    cid = datetime.now().strftime('%Y%m%d-%H%M%S') + '-catalog-' + uuid.uuid4().hex[:8]
    collection = H.DATA / 'collections' / cid
    collection.mkdir(parents=True)
    H.write_json_atomic(collection / 'request.json', dict(options, count=count, par=par))
    prepared = []
    try:
        if options.get('catalogRecipe'):
            rid = R.safe_name(options['catalogRecipe'])
            recipe = R.load(H.DATA / 'recipes' / rid, check_tools=True)
            if recipe.get('sourceMode') != 'bundled-editor-reference':
                raise ValueError('에디터 전체 원본 기준이 아닙니다')
            sources = dict(id=rid, sha256=R.sha(H.DATA / 'recipes' / rid / 'recipe.json'),
                           seeds=len(recipe['seeds']), sheets=len({s['catalogReference']['assetId'] for s in recipe['seeds']}))
        else:
            sources = S.create()
        recipe = R.load(H.DATA / 'recipes' / sources['id'], check_tools=True)
        root = H.run_dir(cid)
        root.mkdir()
        prepared.append((root, par - bool(animal_count)))
        manifest = R.bind(root, sources['id'], count-animal_count)
        if distinct:
            import distinct_sources
            distinct_sources.spread_catalog(manifest, root / 'recipe', recipe)
        S.enrich_manifest(manifest, recipe)
        for index, row in enumerate(manifest['characters']):
            if options.get('prompt'):
                row['brief'] += ' ' + str(options['prompt'])[:4000]
            if options.get('concepts'):
                row['brief'] += ' 이번 캐릭터: ' + options['concepts'][index % len(options['concepts'])]
        manifest.update(title=title, collectionId=cid,
                        productionPolicy=dict(maxReviewPending=limit, repairRounds=rounds))
        H.write_json_atomic(root / 'manifest.json', manifest)
        H.write_json_atomic(root / 'production.json', dict(par=prepared[0][1], batchSize=1))
        R.verify_run(root, manifest, check_tools=True)
        if animal_count:
            animals = R.create_creatures(name=title+' · 동물')
            animal_root = H.run_dir(cid+'-animals-'+uuid.uuid4().hex[:8])
            animal_root.mkdir()
            prepared.append((animal_root, 1))
            animal_manifest = R.bind(animal_root, animals['id'], animal_count, options.get('prompt', ''))
            if distinct:
                distinct_sources.validate(animal_manifest, animal_root / 'recipe',
                                          R.load(animal_root / 'recipe', check_tools=True))
                if set(manifest['diversityPlan']['pixelHashes']) & set(animal_manifest['diversityPlan']['pixelHashes']):
                    raise ValueError('일반 원본과 동물 원본의 픽셀이 겹칩니다. 다른 원본을 추가하거나 원본 변주 방식으로 제작하세요.')
            animal_manifest.update(title=title+' · 동물', collectionId=cid,
                                   productionPolicy=dict(maxReviewPending=min(limit, max(1, animal_count)), repairRounds=rounds))
            H.write_json_atomic(animal_root / 'manifest.json', animal_manifest)
            H.write_json_atomic(animal_root / 'production.json', dict(par=1, batchSize=1))
            R.verify_run(animal_root, animal_manifest, check_tools=True)
    except Exception:
        for root, _ in prepared:
            shutil.rmtree(root)
        H.write_json_atomic(collection / 'state.json', dict(phase='failed', at=H.now()))
        raise
    record = dict(id=cid, title=title, planned=count, sourceRecipe=sources,
                  runs=[dict(run=root.name, planned=len(json.loads((root/'manifest.json').read_text())['characters']), par=slots)
                        for root, slots in prepared], started=[])
    H.write_json_atomic(collection / 'manifest.json', record)
    try:
        for root, slots in prepared:
            record['started'].append(launch(root, slots, 1))
            H.write_json_atomic(collection / 'state.json', dict(record, phase='running', at=H.now()))
    except Exception as error:
        H.write_json_atomic(collection / 'state.json', dict(record, phase='partial-start', error=str(error), at=H.now()))
        raise ValueError('일부 제작 시작 실패. 제작 관리에서 중단된 작업을 이어 만들 수 있습니다: '+cid) from error
    return dict(run=prepared[0][0].name, count=count, seeds=sources['seeds']+animal_count,
                sheets=sources['sheets']+bool(animal_count), collection=cid, runs=record['started'])


def annotate_catalog_items(items):
    """Expose immutable source labels without putting them in sealed artist metadata."""
    for run in {it['run'] for it in items}:
        file = H.run_dir(run) / 'manifest.json'
        if not file.exists():
            continue
        manifest = json.loads(file.read_text())
        if not manifest.get('catalogSources'):
            continue
        rows = {r['key']:r.get('catalogReference') for r in manifest['characters']}
        for item in items:
            if item['run'] == run and rows.get(item['dir'].split('__')[0]):
                item['catalog_reference'] = rows[item['dir'].split('__')[0]]
    return items


def _create_variations(options, count, par):
    import recipes
    limit = int(options.get('maxReviewPending', 12))
    rounds = int(options.get('repairRounds', 2))
    if not par <= limit <= 40 or not 0 <= rounds <= 2:
        raise ValueError('검토 대기는 동시작업~40명, 기술 수정은 0~2회입니다')
    if options.get('image') or options.get('reference'):
        raise ValueError('남긴 원본 변주에는 추가 참고 이미지를 섞지 않습니다')
    rid = options.get('recipe')
    if options.get('creatures'):
        if rid or options.get('seedRun'):
            raise ValueError('동물 원본 제작과 남긴 그림 변주를 함께 지정할 수 없습니다')
        rid = recipes.create_creatures()['id']
    if not rid:
        rid = recipes.create(options['seedRun'])['id']
    kind = '-monsters-' if options.get('creatures') else '-kept-'
    root = H.run_dir(datetime.now().strftime('%Y%m%d-%H%M%S') + kind + uuid.uuid4().hex[:8])
    root.mkdir(parents=True)
    try:
        manifest = recipes.bind(root, rid, count, options.get('prompt', ''), int(options.get('startIndex', 0)))
        if options.get('distinctSources'):
            import distinct_sources
            distinct_sources.validate(manifest, root / 'recipe', recipes.load(root / 'recipe', check_tools=True))
        concepts = options.get('concepts', [])
        for index, row in enumerate(manifest['characters']):
            if concepts:
                row['brief'] += ' 이번 캐릭터: ' + concepts[index % len(concepts)]
        manifest['title'] = str(options.get('title') or ('동물 몬스터' if options.get('creatures') else '남긴 캐릭터 변주'))[:80]
        manifest['productionPolicy'] = dict(maxReviewPending=limit, repairRounds=rounds)
        H.write_json_atomic(root / 'manifest.json', manifest)
        recipes.verify_run(root, manifest, check_tools=True)
    except Exception:
        shutil.rmtree(root)
        raise
    return dict(launch(root, par, 1), count=count, recipe=rid, seeds=len(recipes.load(root / 'recipe')['seeds']))


def control(run, resume):
    with H.data_lock('studio'):
        return _control(run, resume)


def _control(run, resume):
    root = run_root(run)
    if json.loads((root / 'manifest.json').read_text()).get('reviewMode') != 'human':
        raise ValueError('자유 저작 실행만 제어할 수 있습니다')
    driver = json.loads((root / 'driver.json').read_text()) if (root / 'driver.json').exists() else {}
    if resume:
        state = json.loads((root / 'production-state.json').read_text()) if (root / 'production-state.json').exists() else {}
        if state.get('phase') == 'continued':
            raise ValueError('생산은 다음 작업에서 이어집니다: ' + str(state.get('continuedIn', '')))
        if H._alive(driver.get('pid')):
            raise ValueError('현재 묶음이 끝날 때까지 기다려 주세요')
        layout = json.loads((root / 'production.json').read_text())
        reserve_artists(layout.get('par', 4), exclude=run)
        if json.loads((root / 'manifest.json').read_text()).get('recipe'):
            import recipes
            recipes.verify_run(root, check_tools=True)
        (root / 'pause-request.json').unlink(missing_ok=True)
        return launch(root, par=layout.get('par', 4), batch_size=layout['batchSize'])
    H.write_json_atomic(root / 'pause-request.json', dict(at=H.now()))
    if not H._alive(driver.get('pid')):
        state_file = root / 'production-state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        if state.get('phase') == 'queued':
            H.write_json_atomic(state_file, dict(state, phase='paused', at=H.now()))
    return dict(run=run, phase='pausing')


def export_kept(run='all', decisions=None):
    if run != 'all':
        if not isinstance(run, str) or Path(run).name != run or run in ('.', '..') or not H.run_dir(run).is_dir():
            raise ValueError('실행을 찾을 수 없습니다')
    decisions = H._decisions() if decisions is None else decisions
    selected = []
    for it in H._items():
        if run != 'all' and it['run'] != run:
            continue
        w = H.run_dir(it['run']) / it['dir']
        gate = H.current_gate(w) if (w / 'out.chr.txt').exists() else None
        rec = decisions.get(it['id'])
        if it['status'] != 'done' or H.effective_decision(w, rec, gate) != 'accept' or not H.quality(w, 'accept', gate)['eligible']:
            continue
        raw = (w / 'out.chr.txt').read_bytes()
        if hashlib.sha256(raw).hexdigest() != gate['sourceSha256']:
            raise ValueError('선택한 그림이 변경되었습니다. 다시 확인해 주세요.')
        pal, _, frames = C.parse(raw.decode('utf-8'))
        selected.append((it, w, raw, C.sheet_rgba(pal, frames), rec))
    if not selected:
        raise ValueError('남긴 캐릭터가 없습니다')
    downloads = H.DATA / 'downloads'; downloads.mkdir(parents=True, exist_ok=True)
    name = datetime.now().strftime('characters-kept-%Y%m%d-%H%M%S-') + uuid.uuid4().hex[:8] + '.zip'
    with tempfile.TemporaryDirectory(prefix='kept-', dir=downloads) as temp:
        out = Path(temp)
        (out / 'charsets').mkdir(); (out / 'transparent').mkdir(); (out / 'grids').mkdir(); (out / 'gifs').mkdir()
        catalog = []
        for offset in range(0, len(selected), 8):
            group = selected[offset:offset+8]
            sheet = Image.new('RGBA', (288, 256))
            filename = f'Kept{offset//8+1:02d}.png'
            for slot, (it, w, raw, sprite, rec) in enumerate(group):
                sheet.paste(sprite, (slot%4*72, slot//4*128))
                key = hashlib.sha256(it['id'].encode()).hexdigest()[:16]
                (out / 'grids' / f'{key}.chr.txt').write_bytes(raw)
                shutil.copy(w / 'views' / 'walk.gif', out / 'gifs' / f'{key}.gif')
                catalog.append(dict(id=it['id'], name=it['desc'].get('label') if it['desc'] else it['name'],
                                    charset=f'charsets/{filename}', characterIndex=slot, description=it['desc'],
                                    sourceBase=it['base'], acceptance=rec,
                                    frameAuthor=json.loads((w / 'model-frames.json').read_text()) if it['animation_mode']==H.FRAME_AUTHOR_MODE else None))
            sheet.save(out / 'transparent' / filename)
            bg = Image.new('RGBA', sheet.size, C.KEY+(255,)); bg.alpha_composite(sheet)
            bg.convert('RGB').save(out / 'charsets' / filename)
            reopened = Image.open(out / 'charsets' / filename).convert('RGB')
            restored = Image.new('RGBA', sheet.size)
            restored.putdata([(0,0,0,0) if all(abs(rgb[i]-C.KEY[i]) <= 8 for i in range(3)) else (*rgb,255) for rgb in reopened.getdata()])
            if restored.tobytes() != sheet.tobytes():
                raise ValueError('에디터 색 키 재읽기 불일치')
        lineage_bases = {it['base'] for it, *_ in selected}
        recipe_sources = {}

        def preserve_recipe(folder):
            import recipes
            recipe = recipes.load(folder)
            if recipe['id'] in recipe_sources:
                return
            recipe_sources[recipe['id']] = folder
            for seed in recipe['seeds']:
                lineage_bases.add(seed['sourceBase'])
                source_meta = json.loads((folder / seed['folder'] / 'source-meta.json').read_text())
                if source_meta.get('recipe'):
                    parent = H.DATA / 'recipes' / recipes.safe_name(source_meta['recipe']['id'])
                    recipes.load(parent, source_meta['recipe']['sha256'])
                    preserve_recipe(parent)

        for it, w, *_ in selected:
            if json.loads((w / 'meta.json').read_text()).get('recipe'):
                preserve_recipe(H.run_dir(it['run']) / 'recipe')
        if any(not base.startswith('input:') for base in lineage_bases):
            credits = out / 'licenses' / 'easyrpg'; credits.mkdir(parents=True)
            for file in ('AUTHORS.md', 'COPYING'):
                shutil.copy(H.RTP / file, credits / file)
        sources = out / 'sources'; sources.mkdir()
        for base in sorted(lineage_bases):
            if base.startswith('input:'):
                iid = base.split(':')[1]
                shutil.copy(H.INPUTS / f'{iid}.png', sources / f'{iid}.png')
                info = json.loads((H.INPUTS / f'{iid}.json').read_text())
                original = Path(info['src'])
                if original.is_file():
                    shutil.copy(original, sources / f'{iid}-original.png')
        for rid, folder in recipe_sources.items():
            shutil.copytree(folder, sources / 'recipes' / rid)
        H.write_json_atomic(out / 'characters.json', dict(count=len(catalog), characters=catalog))
        (out / 'README.md').write_text('사람이 GIF를 보고 남긴 캐릭터만 포함합니다.\ncharsets/의 288×256 PNG를 에디터에 올립니다. 한 시트 8명, 각 24×32 × 3걸음 × 4방향.\n투명 색 키 #009392, RGBA는 transparent/, GIF는 gifs/. 원본과 선택 해시는 characters.json에 기록했습니다.\n작업자 설명은 그림을 그린 AI의 설명이며 독립 시각 심사 점수가 아닙니다. 프로젝트에는 자동 설치하지 않습니다.\n', encoding='utf-8')
        temp_zip = downloads / ('.' + name)
        try:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
                for file in sorted(out.rglob('*')):
                    if file.is_file():
                        archive.write(file, file.relative_to(out))
            temp_zip.rename(downloads / name)
        finally:
            temp_zip.unlink(missing_ok=True)
    return dict(count=len(selected), url='/downloads/'+name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--count', type=int, default=100)
    parser.add_argument('--prompt', default='')
    parser.add_argument('--title', default='', help='공방에 표시할 제작 작업 이름')
    parser.add_argument('--concept', action='append', default=[], help='캐릭터별 짧은 콘셉트. 여러 번 지정할 수 있다')
    parser.add_argument('--reference', type=Path)
    parser.add_argument('--par', type=int)
    parser.add_argument('--batch-size', type=int, default=2)
    parser.add_argument('--seed-run', help='이 실행에서 현재 남긴 그림만 변주 원본으로 고정한다')
    parser.add_argument('--recipe', help='보존한 제작 기준 ID로 같은 조건의 새 실행을 만든다')
    parser.add_argument('--creatures', action='store_true', help='동물 8종을 원본으로 필드 몬스터를 직접 저작한다')
    parser.add_argument('--all-sources', action='store_true', help='에디터 Actor/People/Monster/Scarloxy/농장 동물을 섞어 변주한다')
    parser.add_argument('--distinct-sources', action='store_true', help='같은 원본 픽셀을 반복 배정하지 않는다. 전체 원본 제작은 몸 형태가 다른 원본부터 고른다')
    parser.add_argument('--start-index', type=int, default=0, help='새 기준에서 이어 만들 때 생략할 원본/콘셉트 순번 수')
    parser.add_argument('--max-review-pending', type=int, default=12)
    parser.add_argument('--repair-rounds', type=int, default=2)
    args = parser.parse_args()
    print(json.dumps(create(dict(count=args.count, prompt=args.prompt, reference=args.reference,
                                 title=args.title, concepts=args.concept, par=args.par if args.par is not None else 2,
                                 batchSize=args.batch_size, seedRun=args.seed_run, recipe=args.recipe, creatures=args.creatures, allSources=args.all_sources, distinctSources=args.distinct_sources or args.all_sources, startIndex=args.start_index,
                                 maxReviewPending=args.max_review_pending, repairRounds=args.repair_rounds)), ensure_ascii=False))
