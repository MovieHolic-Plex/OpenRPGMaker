"""스테이징 raw/ → public/assets/se/ 배치 + placed.json 생성.

    python scripts/se/place-se-assets.py [--staging dist/se-staging]

재실행 안전(sha256 이 같으면 복사 생략). 라벨은 붙이지 않는다 — build-se-labels.py 담당.
팩별 하위 디렉터리를 쓰는 이유: `metal_01` 처럼 팩 간 파일명이 충돌해 평면 배치가 불가능하다.
"""
import argparse, json, os, re, shutil, hashlib, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# 팩 → (그룹 디렉터리, 리소스 id 접두사)
GROUPS = {
    'kenney_interface-sounds': ('kenney-interface', 'kif'),
    'kenney_ui-audio':         ('kenney-ui',        'kui'),
    'kenney_music-jingles':    ('kenney-jingles',   'kjg'),
    'kenney_rpg-audio':        ('kenney-rpg',       'kra'),
    'kenney_impact-sounds':    ('kenney-impact',    'kis'),
    'rpg_sound_pack':          ('oga-rpg-pack',     'orp'),
    '80-CC0-RPG-SFX':          ('oga-rpg-sfx',      'ors'),
    '100-CC0-SFX':             ('oga-sfx',          'osx'),
}

# 제외 규칙 — 근거를 함께 남긴다(왜 뺐는지 재검증 가능하게).
EXCLUDE = [
    (r'(^|/)Preview\.ogg$',                     '팩 프리뷰 컴필레이션(13~14초). 개별 SE 가 아니다'),
    (r'(^|/)(other|weird|noise)_\d+\.ogg$',     '의미 불명 - 라벨을 붙일 근거가 없다'),
    (r'(^|/)toilet_\d+\.ogg$',                  'RPG 에디터 기본 세트에 부적절'),
    (r'(^|/)microwave_door_(open|close)\.ogg$',  '현대 가전 - RPG 무관'),
]
# ui-audio 의 switch1~38: 이름에 정보가 0이고 kenney-interface 와 기능 중복. 보류.
EXCLUDE_UI_SWITCH = re.compile(r'^Audio/switch\d+\.ogg$')
EXCLUDE_IMPACT_DUPLICATE = re.compile(r'^Audio/footstep_carpet_(002|004)\.ogg$')


def excuse(pack, rel):
    for pat, why in EXCLUDE:
        if re.search(pat, rel):
            return why
    if pack == 'kenney_ui-audio' and EXCLUDE_UI_SWITCH.match(rel):
        return 'switch1~38: 이름에 의미 정보가 없고 kenney-interface 와 기능 중복 - 보류'
    if pack == 'kenney_impact-sounds' and EXCLUDE_IMPACT_DUPLICATE.match(rel):
        return '카펫 발소리 002/004: 각각 001/003과 sha256이 같은 완전 중복 - 제외'
    return None


def slug(text):
    return re.sub(r'-{2,}', '-', re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--staging', default=os.path.join(REPO, 'dist', 'se-staging'))
    args = ap.parse_args()
    staging = os.path.abspath(args.staging)
    dest_root = os.path.join(REPO, 'public', 'assets', 'se')

    rows = json.load(open(os.path.join(staging, 'inventory.json'), encoding='utf-8'))
    placed, skipped = [], []

    for r in sorted(rows, key=lambda r: (r['pack'], r['rel'])):
        why = excuse(r['pack'], r['rel'])
        if why:
            skipped.append(dict(pack=r['pack'], rel=r['rel'], reason=why))
            continue
        group, prefix = GROUPS[r['pack']]
        # 팩 내부 디렉터리는 카테고리 정보를 담고 있으므로 보존한다.
        inner = os.path.dirname(r['rel'])
        inner = re.sub(r'^RPG Sound Pack/?', '', inner)
        inner = re.sub(r'^Audio/?', '', inner)
        inner_slug = '/'.join(slug(p) for p in inner.split('/') if p)
        stem = os.path.splitext(os.path.basename(r['rel']))[0]
        dest_rel = '/'.join(x for x in (group, inner_slug, slug(stem) + r['ext']) if x)
        rid = 'cc0-se-' + '-'.join(
            [prefix] + ([inner_slug.replace('/', '-')] if inner_slug else []) + [slug(stem)])

        src = os.path.join(staging, 'raw', r['pack'], *r['rel'].split('/'))
        dst = os.path.join(dest_root, *dest_rel.split('/'))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        same = False
        if os.path.exists(dst):
            with open(dst, 'rb') as fh:
                same = hashlib.sha256(fh.read()).hexdigest() == r['sha256']
        if not same:
            shutil.copy2(src, dst)

        placed.append(dict(
            id=rid, path='assets/se/' + dest_rel, group=group,
            sourcePack=r['pack'], sourceRel=r['rel'], stem=stem,
            seconds=r['seconds'], bytes=r['bytes'], sha256=r['sha256'],
            codec=r['codec'], sampleRate=r['sampleRate'], channels=r['channels'],
            peak=r.get('peak'), rms=r.get('rms')))

    ids = [p['id'] for p in placed]
    dup_ids = [i for i in set(ids) if ids.count(i) > 1]
    assert not dup_ids, 'resource id 충돌: %s' % dup_ids[:5]
    paths = [p['path'] for p in placed]
    dup_paths = [p for p in set(paths) if paths.count(p) > 1]
    assert not dup_paths, '경로 충돌: %s' % dup_paths[:5]

    json.dump(dict(placed=placed, skipped=skipped),
              open(os.path.join(staging, 'placed.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    print('배치 %d개 / 제외 %d개' % (len(placed), len(skipped)))
    byg = {}
    for p in placed:
        byg.setdefault(p['group'], []).append(p)
    for g, ps in sorted(byg.items()):
        print('  %-18s %4d개  %5.2f MB' % (g, len(ps), sum(x['bytes'] for x in ps) / 1048576))
    print('  %-18s %4d개  %5.2f MB'
          % ('합계', len(placed), sum(x['bytes'] for x in placed) / 1048576))
    byr = {}
    for s in skipped:
        byr.setdefault(s['reason'], []).append(s['rel'])
    print()
    for why, rels in byr.items():
        print('제외 %2d개 - %s' % (len(rels), why))


if __name__ == '__main__':
    main()
