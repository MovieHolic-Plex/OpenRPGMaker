"""Freeze the editor's bundled walking references without changing sealed pixel tools."""
import hashlib
import json
import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from PIL import Image
import chr as C
import harness as H
import motion as M
import recipes as R

CATALOG_FILES = ('charsetCatalog.ts', 'easyrpgRtp.ts', 'scarloxyPack.ts',
                 'farmingSprites.ts', 'oprnMonsterCharsets.ts', 'wizardingCharsets.ts',
                 'wizardingCharsets.json', 'sharedCharacterGraphics.json')
WALKING_GROUPS = {'Actor', 'People', 'Monster', 'Animal', 'Scarloxy', 'Farm', 'Template'}


def wizarding_catalog(directory):
    """Read the baked wizarding sheets. The count lives in the roster, the shape in the template."""
    source = (directory / 'wizardingCharsets.ts').read_text()
    block = source.split('export const WIZARDING_CHARSET_ASSETS', 1)
    if len(block) != 2:
        raise ValueError('마법 학교 캐릭터 원본 목록을 찾을 수 없습니다')
    body = block[1].split('satisfies', 1)[0]
    fields = dict(re.findall(r'(\w+):\s*`([^`]*)`', body))
    group = re.search(r'group:\s*"([^"]+)"', body)
    count = json.loads((directory / 'wizardingCharsets.json').read_text()).get('sheets')
    if not group or not isinstance(count, int) or count < 1 or not all(fields.get(key) and '${n}' in fields[key] for key in ('id', 'name', 'path', 'textureKey')):
        raise ValueError('마법 학교 캐릭터 원본 목록 형식을 읽을 수 없습니다')
    return [dict(id=fields['id'].replace('${n}', str(number)),
                 name=fields['name'].replace('${n}', str(number)),
                 path=fields['path'].replace('${n}', str(number)),
                 textureKey=fields['textureKey'].replace('${n}', str(number)),
                 group=group[1]) for number in range(1, count + 1)]


def editor_catalog():
    """Read registered literal assets; fail closed if a new catalog provider appears."""
    directory = H.ROOT / 'src/assets'
    providers = re.findall(r'\.\.\.([A-Z_]+)', (directory / 'charsetCatalog.ts').read_text().split('export const CHARSET_ASSETS:')[1].split('];')[0])
    expected = {'EASYRPG_CHARSET_ASSETS', 'SCARLOXY_CHARSET_ASSETS',
                'FARMING_ANIMAL_CHARSET_ASSETS', 'OPRN_MONSTER_CHARSET_ASSETS',
                'WIZARDING_CHARSET_ASSETS'}
    if set(providers) != expected:
        raise ValueError('에디터 캐릭터 카탈로그 공급자가 바뀌었습니다. 원본 목록 연결을 갱신하세요.')
    result = []
    for filename, constant in (('easyrpgRtp.ts', 'EASYRPG_CHARSET_ASSETS'),
                               ('scarloxyPack.ts', 'SCARLOXY_CHARSET_ASSETS'),
                               ('farmingSprites.ts', 'FARMING_ANIMAL_CHARSET_ASSETS')):
        text = (directory / filename).read_text()
        prefix = re.search(r'const ASSET_DIR = "([^"]+)"', text)
        text = text.split('export const ' + constant + ' = [', 1)[1].split('] as ', 1)[0]
        for block in re.findall(r'\{\s*category:\s*"charset".*?\}\s*(?=,|\n)', text, re.S):
            entry = dict(re.findall(r'(\w+):\s*"([^"]*)"', block))
            path = re.search(r'\bpath:\s*`\$\{ASSET_DIR\}([^`]+)`', block)
            if path and prefix:
                entry['path'] = prefix[1] + path[1]
            if not all(entry.get(k) for k in ('id', 'path', 'textureKey', 'group')):
                raise ValueError('캐릭터 원본 목록 형식을 읽을 수 없습니다: ' + filename)
            result.append(entry)
    text = (directory / 'oprnMonsterCharsets.ts').read_text()
    for number, label in re.findall(r'\{ n: (\d+), name: "([^"]+)" \}', text):
        result.append(dict(id=f'easyrpg-charset-monster{number}', name=label,
                           path=f'assets/generated/charsets/Monster{number}.png',
                           textureKey=f'tex_easyrpg_charset_monster{number}', group='Monster'))
    result.extend(wizarding_catalog(directory))
    if len({r['id'] for r in result}) != len(result):
        raise ValueError('에디터 원본 ID가 중복됐습니다')
    return result


def normalize(image):
    """Keep native opaque RGB exactly; flatten only transparent pixels to the engine key."""
    rgba = image.convert('RGBA')
    alpha = rgba.getpixel((0, 0))[3] < 128
    key = rgba.getpixel((0, 0))[:3]
    pixels = list(rgba.getdata())
    if any(p[:3] == C.KEY and (p[3] >= 128 if alpha else p[:3] != key) for p in pixels):
        raise ValueError('원본 몸체가 에디터 투명 색 키를 사용합니다')
    flat = Image.new('RGB', image.size)
    flat.putdata([p[:3] if (p[3] >= 128 if alpha else p[:3] != key) else C.KEY for p in pixels])
    return flat


def interleave(sheets, count):
    """Visit every sheet before another slot from the same sheet; retain all unique seeds."""
    ordered = []
    groups = ('Monster', 'Actor', 'People', 'Scarloxy', 'Farm', 'Template')
    buckets = {g: [s for s in sheets if s['group'] == g] for g in groups}
    while any(buckets.values()):
        for group in groups:
            if buckets[group]:
                ordered.append(buckets[group].pop(0))
    pool = []
    for index in range(max((len(s['seeds']) for s in ordered), default=0)):
        for sheet in ordered:
            if index < len(sheet['seeds']):
                pool.append(sheet['seeds'][index])
    if not pool:
        raise ValueError('사용할 수 있는 에디터 걷기 원본이 없습니다')
    return [pool[i % len(pool)] for i in range(max(count, len(pool)))]


def create(name='에디터 전체 캐릭터 원본'):
    rid = datetime.now().strftime('%Y%m%d-%H%M%S') + '-catalog-' + uuid.uuid4().hex[:8]
    root = H.DATA / 'recipes' / rid
    root.mkdir(parents=True)
    source_dir = H.ROOT / 'src/assets'
    mappings = json.loads((source_dir / 'sharedCharacterGraphics.json').read_text())['mappings']
    labels = {(m['textureKey'], m['characterIndex']): m for m in mappings}
    sheets, skipped, files = [], [], {}
    try:
        for entry in editor_catalog():
            if entry['group'] == 'Wizarding':
                skipped.append(dict(assetId=entry['id'], reason='마법 학교 시트는 카탈로그에 연결돼 있고, 봉인된 20시트 걷기 원본에는 넣지 않는다'))
                continue
            if entry['group'] not in WALKING_GROUPS or entry['group'] == 'Animal':
                skipped.append(dict(assetId=entry['id'], reason='Animal은 고정한 동물 영역의 별도 실행으로 제작' if entry['group'] == 'Animal' else '문·기물·탈것은 걷는 캐릭터 원본이 아님'))
                continue
            path = (H.ROOT / 'public' / entry['path']).resolve(strict=True)
            if not path.is_relative_to((H.ROOT / 'public/assets').resolve()):
                raise ValueError('원본이 에디터 자산 경로 밖에 있습니다')
            image = Image.open(path)
            if image.size != (288, 256):
                raise ValueError(f'지원하지 않는 원본 크기: {entry["id"]} {image.size}')
            flat = normalize(image)
            iid = 'catalog-' + hashlib.sha256(flat.tobytes()).hexdigest()[:20]
            H.INPUTS.mkdir(parents=True, exist_ok=True)
            target = H.INPUTS / (iid + '.png')
            if target.exists():
                if Image.open(target).convert('RGB').tobytes() != flat.tobytes():
                    raise ValueError('저장된 원본 입력 해시가 다릅니다')
            else:
                flat.save(target)
            attribution = (H.ROOT / 'public/assets/ATTRIBUTION.md').read_text()
            metadata = dict(name=entry['name'], src=str(path), catalogReference=entry,
                            originalSha256=R.sha(path), normalization='native RGB; alpha >= 128 if top-left transparent, otherwise top-left RGB key; no resize or palette quantization',
                            licenses=dict(attribution=attribution))
            if entry['path'].startswith('assets/easyrpg/'):
                metadata['licenses'].update({f:(H.RTP / f).read_text() for f in ('AUTHORS.md', 'COPYING')})
            H.write_json_atomic(H.INPUTS / (iid + '.json'), metadata)
            seeds = []
            for slot in range(8):
                try:
                    pal, _, frames = C.from_actor(target, slot)
                    gate = C.gate(pal, frames, (pal, frames), strength='free', check_changed=False)
                    if not gate['ok']:
                        raise ValueError('; '.join(gate['fails']))
                    if all(frames[d, 0] == frames[d, 1] == frames[d, 2] for d in C.DIRS):
                        raise ValueError('이동 프레임이 없는 칸')
                    regions = {d:M._regions(frames[d, 1]) for d in C.DIRS}
                    actual = C.sheet_rgba(pal, frames)
                    block = flat.crop((slot%4*72, slot//4*128, slot%4*72+72, slot//4*128+128))
                    expected = Image.new('RGBA', block.size)
                    expected.putdata([(0, 0, 0, 0) if rgb == C.KEY else (*rgb, 255) for rgb in block.getdata()])
                    # Invisible RGB is immaterial; every alpha and opaque RGB is exact.
                    if list(actual.getdata()) != list(expected.getdata()):
                        raise ValueError('원본 RGBA 재읽기 불일치')
                    base = f'input:{iid}:{slot}'
                    mapping = labels.get((entry['textureKey'], slot), {})
                    kind = 'monster' if entry['group'] == 'Monster' else 'animal' if entry['group'] == 'Farm' or mapping.get('attributes', {}).get('kind') in ('동물', '몬스터') else 'person'
                    label = mapping.get('label', f'{Path(entry["path"]).stem} {slot+1}번')
                    seeds.append(dict(base=base, entry=entry, slot=slot, pal=pal, frames=frames,
                                      label=label, kind=kind, regions=regions))
                except (ValueError, C.GridError) as error:
                    skipped.append(dict(assetId=entry['id'], slot=slot, reason=str(error)))
            if seeds:
                sheets.append(dict(group=entry['group'], seeds=seeds))
        seeds = []
        for index, candidate in enumerate(interleave(sheets, 0)):
            folder = root / 'seeds' / f'{index:03d}'
            folder.mkdir(parents=True)
            pal, frames, entry = candidate['pal'], candidate['frames'], candidate['entry']
            base = candidate['base']
            reference = dict(assetId=entry['id'], textureKey=entry['textureKey'], path=entry['path'],
                             sheet=Path(entry['path']).stem, slot=candidate['slot'],
                             label=candidate['label'], kind=candidate['kind'])
            (folder / 'out.chr.txt').write_text(C.dump(pal, {}, frames, header='에디터 번들 원본 — 사용자 선택 아님'))
            C.sheet_rgba(pal, frames).save(folder / 'source.png')
            shutil.copyfile(H.base_sheet(base)[0], folder / 'input.png')
            shutil.copyfile(H.ROOT / 'public' / entry['path'], folder / 'source-original.png')
            shutil.copyfile(H.HERE / 'catalog-worker.md', folder / 'worker.md')
            H.write_json_atomic(folder / 'source-meta.json', dict(base=base, sourceMode='bundled-editor-reference',
                                generatedByAI=False, catalogReference=reference, regions=candidate['regions']))
            for file in folder.iterdir():
                files[str(file.relative_to(root))] = R.sha(file)
            seeds.append(dict(index=index, sourceId=f'bundled:{entry["id"]}:{candidate["slot"]}', base=base,
                              sourceBase=base, sourceBrief='', authoringMode='grid',
                              folder=str(folder.relative_to(root)), label=candidate['label'],
                              catalogReference=reference, inputSha256=R.sha(folder / 'input.png')))
        for filename in CATALOG_FILES:
            file = root / 'catalog' / filename
            file.parent.mkdir(exist_ok=True)
            shutil.copyfile(source_dir / filename, file)
            files[str(file.relative_to(root))] = R.sha(file)
        for original in (H.ROOT / 'public/assets/ATTRIBUTION.md', H.RTP / 'AUTHORS.md', H.RTP / 'COPYING'):
            file = root / 'licenses' / original.name
            file.parent.mkdir(exist_ok=True)
            shutil.copyfile(original, file)
            files[str(file.relative_to(root))] = R.sha(file)
        H.write_json_atomic(root / 'source-intake.json', dict(sheets=len(sheets), seeds=len(seeds), skipped=skipped))
        files['source-intake.json'] = R.sha(root / 'source-intake.json')
        recipe = dict(version=R.VERSION, id=rid, name=str(name)[:120], at=H.now(), sourceRun=None,
                      sourceMode='bundled-editor-reference', model={k:H.ENGINES['gpt'][k] for k in ('model', 'effort')},
                      animationMode=H.FRAME_AUTHOR_MODE, motionPolicy=M.VERSION, animalPolicy=None, initialImages=0,
                      seeds=seeds, files=files, tools={f:R.sha(H.HERE / f) for f in R.TOOLS + ('catalog_sources.py',)})
        H.write_json_atomic(root / 'recipe.json', recipe)
        H.write_json_atomic(root / 'sealed.json', dict(version=R.VERSION, sha256=R.sha(root / 'recipe.json')))
        R.load(root, check_tools=True)
        return dict(id=rid, sha256=R.sha(root / 'recipe.json'), seeds=len(seeds), sheets=len(sheets))
    except Exception:
        shutil.rmtree(root)
        raise


def enrich_manifest(manifest, recipe):
    for index, row in enumerate(manifest['characters']):
        seed = recipe['seeds'][row['seed']]
        reference = seed['catalogReference']
        row['catalogReference'] = reference
        row['name'] = reference['label'] + ' 변주'
        direction = ('머리와 복식의 형태·배색을 직접 새로 정한다.' if reference['kind'] == 'person'
                     else '원본의 종·체형·이동 방식을 유지하고 얼굴·몸의 재질·문양·작은 형태를 새로 정한다. 슬라임/유령에 사람 다리를 덧붙이지 않는다.')
        row['brief'] = f'{reference["label"]} 계열의 새 캐릭터 {index+1:03d}. 원본의 작은 비율·도트 밀도·네 방향 연결을 기준으로 한다. {direction} 색만 치환하지 말고 12프레임을 직접 저작한다.'
    manifest['catalogSources'] = True
