#!/usr/bin/env python3
"""슈퍼하네스 해리포터 데모 2곳(지팡이 가게·마법약 교실)의 합격 원본을 번들 재료로 가져온다.

  python3 scripts/content/wizarding/import_native.py

입력  ~/.local/share/oprn/super-harness/art-worktrees/<공간>/art-output/space-demos/<판>/*.recipe.json 이 실제로 쓴 원본
출력  tiledata/wizarding/native/<공간>/<품목>.png + .json(슬롯 정의·출처 해시), actors/<인물>/{walk,actions}.png
      tiledata/wizarding/native/manifest.json
그림은 그대로 복사한다(재색칠·크기 변경 없음). 출처 경로와 sha256 을 남긴다.
"""
import glob, hashlib, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.expanduser('~/.local/share/oprn/super-harness')
OUT = os.path.join(ROOT, 'tiledata', 'wizarding', 'native')
SPACES = {
    'wandshop': ('seed-3e7ac64c5c-4127fabc14a1', '5ee75ddcf3c1d09d', '다이애건 앨리 지팡이 가게 시험실'),
    'potions': ('seed-3e7ac64c5c-0657a3ba3e24', '5f5688e8e5c8e1ca', '호그와트 지하 마법약 교실과 재료 준비실'),
}


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def find_set(prep_content, slug):
    path = os.path.join(prep_content, 'tiledata', 'hand-interior', 'new', 'sets.json')
    if not os.path.isfile(path):
        return None
    for s in json.load(open(path))['sets']:
        if re.sub(r'[^A-Za-z0-9]+', '_', s['id']).strip('_').lower() == slug:
            return s
    return None


def main():
    manifest = {'version': 1, 'spaces': {}}
    for key, (cid, folder, title) in SPACES.items():
        root = os.path.join(DATA, 'art-worktrees', cid)
        used = {}
        for r in sorted(glob.glob(os.path.join(root, 'art-output', 'space-demos', folder, '*.recipe.json'))):
            j = json.load(open(r))
            for i in {o['source'] for o in j['placements']}:
                used[j['sources'][i]['path']] = j['sources'][i]['sha256']
        dest = os.path.join(OUT, key)
        shutil.rmtree(dest, ignore_errors=True)
        os.makedirs(dest)
        items = []
        for rel, digest in sorted(used.items()):
            src = os.path.join(root, rel)
            assert sha(src) == digest, rel
            m = re.search(r'art-output/([^/]+)/content/tiledata/hand-interior/pick/candidates/([^/]+)/(h\d+-A)\.png$', rel)
            if m:
                prep, slug, cand = m.groups()
                name = slug if not any(i['name'] == slug for i in items) else f'{slug}__{prep}'
                spec = find_set(os.path.join(root, 'art-output', prep, 'content'), slug)
                shutil.copyfile(src, os.path.join(dest, name + '.png'))
                meta = {'name': name, 'item': slug, 'candidate': cand, 'source': rel, 'sha256': digest, 'set': spec}
                json.dump(meta, open(os.path.join(dest, name + '.json'), 'w'), ensure_ascii=False, indent=1)
                items.append({'name': name, 'kind': 'tiles', 'slots': len(spec['slots']) if spec else 0})
                continue
            m = re.search(r'native-actors/(?:runs/[^/]+/_batches/\d+/characters/([^/_]+(?:-[^/_]+)*)__gpt-r1/views/sheet_rgba|actions/([^/]+)/([^/]+)/views/sheet)\.png$', rel)
            assert m, rel
            actor = m.group(1) or m.group(2)
            kind = 'walk' if m.group(1) else 'actions-' + m.group(3)
            adir = os.path.join(dest, 'actors', actor)
            os.makedirs(adir, exist_ok=True)
            shutil.copyfile(src, os.path.join(adir, kind + '.png'))
            if m.group(2):  # 행동 프레임 정의(이름·앵커·시간)
                px = os.path.join(os.path.dirname(os.path.dirname(src)), 'actions.px.json')
                doc = json.load(open(px))
                frames = [{k: f.get(k) for k in ('id', 'anchor', 'durationMs')} for f in doc['frames']]
                json.dump({'width': doc['width'], 'height': doc['height'], 'frames': frames, 'source': rel, 'sha256': digest},
                          open(os.path.join(adir, kind + '.json'), 'w'), ensure_ascii=False, indent=1)
            items.append({'name': f'{actor}/{kind}', 'kind': 'actor', 'source': rel, 'sha256': digest})
        manifest['spaces'][key] = {'concept': cid, 'title': title, 'demo': folder, 'items': items}
        print(key, len(items))
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
