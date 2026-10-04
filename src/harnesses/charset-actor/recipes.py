"""현재 사람이 남긴 픽셀과 성공한 작업 계약을 보존한다. 취향을 설명으로 추론하지 않는다."""
import argparse
import hashlib
import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path

import chr as C
import harness as H

VERSION = 1
TOOLS = ('chr.py', 'harness.py', 'bulk.py', 'pixel_ops.py', 'recipes.py', 'delivery.py', 'audit.py')
VARIATIONS = (
    '깃·소매·허리띠의 형태와 작은 무늬를 새로 정한다.',
    '앞머리·묶음·옆머리의 작은 형태와 옷깃을 새로 정한다.',
    '조끼·겉옷·주머니의 형태와 배색을 새로 정한다.',
    '머리띠·목도리·작은 장신구 하나와 복식 세부를 새로 정한다.',
    '같은 계열의 다른 인물로 머리와 복식 세부를 새로 정한다.',
    '소매·옷자락·띠의 선과 명암을 다른 인물로 직접 찍는다.',
)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def safe_name(name):
    if not isinstance(name, str) or not name or Path(name).name != name or name in ('.', '..'):
        raise ValueError('잘못된 제작 기준 이름')
    return name


def load(root, expected=None, check_tools=False):
    root = Path(root)
    digest = sha(root / 'recipe.json')
    if json.loads((root / 'sealed.json').read_text()) != {'version': VERSION, 'sha256': digest} or (expected and expected != digest):
        raise ValueError('제작 기준 봉인이 변경되었습니다')
    recipe = json.loads((root / 'recipe.json').read_text())
    if recipe['version'] != VERSION or not recipe['seeds']:
        raise ValueError('지원하지 않거나 빈 제작 기준')
    for name, digest in recipe['files'].items():
        path = (root / name).resolve(strict=True)
        if not path.is_relative_to(root.resolve()) or sha(path) != digest:
            raise ValueError(f'제작 기준 파일 변경: {name}')
    if check_tools:
        if recipe['model'] != {k: H.ENGINES['gpt'][k] for k in ('model', 'effort')}:
            raise ValueError('기준 모델/effort가 변경되었습니다. 현재 계약으로 새 기준을 만드세요.')
        for name, digest in recipe['tools'].items():
            if sha(H.HERE / name) != digest:
                raise ValueError(f'기준 도구 변경: {name}. 현재 계약으로 새 기준을 만드세요.')
    return recipe


def create(source_run, name='남긴 그림 변주'):
    safe_name(source_run)
    source = H.run_dir(source_run)
    manifest = json.loads((source / 'manifest.json').read_text())
    rows = {r['key']: r for r in manifest['characters']}
    selected = []
    with H.data_lock('decisions'):
        decisions = H._decisions()
        for w in sorted(source.glob('*__gpt-r1')):
            if not (w / 'meta.json').is_file() or not (w / 'out.chr.txt').is_file():
                continue
            meta = json.loads((w / 'meta.json').read_text())
            gate = H.current_gate(w)
            record = decisions.get(f'{source_run}/{w.name}')
            if H.effective_decision(w, record, gate) != 'accept' or not H.quality(w, 'accept', gate)['eligible']:
                continue
            if (meta.get('animationMode') != H.FRAME_AUTHOR_MODE or meta.get('reviewMode') != 'human'
                    or any(meta.get(k) != H.ENGINES['gpt'][k] for k in ('model', 'effort'))):
                raise ValueError('GPT high의 사람 선택·12프레임 직접 저작 결과만 제작 기준으로 씁니다')
            selected.append((w, meta, record, rows[meta['brief']]))
        if not selected:
            raise ValueError('이 실행에서 현재 그림을 남긴 캐릭터가 없습니다')
        rid = datetime.now().strftime('%Y%m%d-%H%M%S') + '-kept-' + uuid.uuid4().hex[:8]
        root = H.DATA / 'recipes' / rid
        root.mkdir(parents=True)
        try:
            seeds, files = [], {}
            for index, (w, meta, record, row) in enumerate(selected):
                folder = root / 'seeds' / f'{index:03d}'
                folder.mkdir(parents=True)
                raw = (w / 'out.chr.txt').read_bytes()
                if hashlib.sha256(raw).hexdigest() != record['inspected']['sourceSha256']:
                    raise ValueError('기준 저장 중 남긴 그림이 바뀌었습니다')
                for filename in ('out.chr.txt', 'base.chr.txt', 'model-frames.json', 'desc.json', 'pixel-edits.json'):
                    if (w / filename).is_file():
                        shutil.copyfile(w / filename, folder / filename)
                pal, _, frames = C.parse(raw.decode('utf-8'))
                C.sheet_rgba(pal, frames).save(folder / 'source.png')
                iid, slots, _ = H.ingest(folder / 'source.png', str(name)[:120])
                base = f'input:{iid}:0'
                bp, bf = H.base_of(base)
                if slots != [0] or C.sheet_rgba(bp, bf).tobytes() != C.sheet_rgba(pal, frames).tobytes():
                    raise ValueError('남긴 원본의 색/투명 픽셀을 그대로 보존할 수 없습니다')
                mode = meta.get('authoringMode', 'grid')
                if mode not in ('grid', 'pixel-patches-v1'):
                    raise ValueError('지원하지 않는 기준 저작 방식')
                template = 'pixel-worker.md' if mode == 'pixel-patches-v1' else 'free-worker.md'
                shutil.copyfile(H.HERE / template, folder / 'worker.md')
                H.write_json_atomic(folder / 'source-meta.json', meta)
                prompt = w.resolve().parent.parent / 'prompt.md'
                if prompt.is_file():
                    shutil.copyfile(prompt, folder / 'source-prompt.md')
                # 입력 PNG도 별도로 봉인한다. ingest의 미래 색 축소 정책에 의존하지 않는다.
                shutil.copyfile(H.base_sheet(base)[0], folder / 'input.png')
                for file in folder.iterdir():
                    files[str(file.relative_to(root))] = sha(file)
                seeds.append(dict(index=index, sourceId=record['id'], acceptance=record, base=base,
                                  sourceBase=meta['base'], sourceBrief=row.get('brief', ''),
                                  authoringMode=mode, folder=str(folder.relative_to(root)),
                                  label=H._desc(w).get('label', row.get('name', '')), inputSha256=sha(folder / 'input.png')))
            recipe = dict(version=VERSION, id=rid, name=str(name)[:120], at=H.now(), sourceRun=source_run,
                          model={k: H.ENGINES['gpt'][k] for k in ('model', 'effort')},
                          animationMode=H.FRAME_AUTHOR_MODE, initialImages=0, seeds=seeds, files=files,
                          tools={file: sha(H.HERE / file) for file in TOOLS})
            H.write_json_atomic(root / 'recipe.json', recipe)
            H.write_json_atomic(root / 'sealed.json', dict(version=VERSION, sha256=sha(root / 'recipe.json')))
            load(root, check_tools=True)
            return dict(id=rid, sha256=sha(root / 'recipe.json'), seeds=len(seeds))
        except Exception:
            shutil.rmtree(root)
            raise


def bind(root, rid, count, prompt=''):
    source = H.DATA / 'recipes' / safe_name(rid)
    recipe = load(source, check_tools=True)
    shutil.copytree(source, root / 'recipe')
    digest = sha(root / 'recipe' / 'recipe.json')
    characters = []
    for i in range(count):
        seed = recipe['seeds'][i % len(recipe['seeds'])]
        wave = i // len(recipe['seeds'])
        brief = ('이 원본과 같은 계열의 다른 인물. 원본의 도트 밀도·몸 비율·네 방향 걷기의 연결을 기준으로 삼는다. '
                 + VARIATIONS[wave % len(VARIATIONS)] + ' 색만 일괄 바꾸지 말고 각 방향·각 걸음의 세부를 직접 찍는다. '
                 + (str(prompt)[:4000] if prompt else '콘셉트와 세부 복식은 자유롭게 정한다.'))
        characters.append(dict(key=f'kept-{root.name[-8:]}-{i+1:03d}', name=f'변주 캐릭터 {i+1:03d}',
                               base=seed['base'], seed=seed['index'], brief=brief, strength='free', reviewMode='human',
                               authoringMode=seed['authoringMode'], animationMode=H.FRAME_AUTHOR_MODE,
                               source='upload', genre='자유', role='', gender='', age=''))
    return dict(run=root.name, reviewMode='human', animationMode=H.FRAME_AUTHOR_MODE, characters=characters,
                genres=['자유'], sourceOriginal=None, recipe=dict(id=rid, sha256=digest))


def verify_run(root, manifest=None, check_tools=False):
    root = Path(root)
    manifest = manifest or json.loads((root / 'manifest.json').read_text())
    recipe = load(root / 'recipe', manifest['recipe']['sha256'], check_tools)
    if manifest['recipe']['id'] != recipe['id'] or manifest.get('visualReferences'):
        raise ValueError('제작 기준 ID/초기 이미지 계약이 변경되었습니다')
    for row in manifest['characters']:
        if type(row.get('seed')) is not int or not 0 <= row['seed'] < len(recipe['seeds']):
            raise ValueError('잘못된 원본 번호')
        seed = recipe['seeds'][row['seed']]
        if (seed['index'] != row['seed'] or row['base'] != seed['base'] or row['authoringMode'] != seed['authoringMode']
                or row['reviewMode'] != 'human' or row['strength'] != 'free'):
            raise ValueError('후보의 원본/제작 방식이 기준과 다릅니다')
        if sha(H.base_sheet(seed['base'])[0]) != seed['inputSha256']:
            raise ValueError('기준 입력 PNG가 변경되었습니다')
    return recipe


def source_for(root, row):
    recipe = verify_run(root)
    return Path(root) / 'recipe' / recipe['seeds'][row['seed']]['folder']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-run', required=True)
    parser.add_argument('--name', default='남긴 그림 변주')
    args = parser.parse_args()
    print(json.dumps(create(args.source_run, args.name), ensure_ascii=False))
