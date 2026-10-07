"""wizarding_world 공간 예제 → 편집기 「장소」(완성 맵 참고본)로 게시한다. bake_wz.py 다음에.

  python3 scripts/content/wizarding/publish_places_wz.py

예제(tiledata/wizarding/examples/<id>.json) 하나마다:
  public/assets/region-references/wz-<id>.oprn.json (내려받기용 프로젝트 몸체) · public/assets/region-references/wz-<id>.png (원본 해상도)
  src/project/regionReferences/wz-<id>.json (스냅샷 {map, tileset 얇은 판}) · src/project/wizardingPlaceReferences.ts (장소 항목)
  src/project/regionReferenceSnapshots.ts 에 로더 한 줄.
검수 미통과로 빠진 조각이 있는 예제(skipped)는 게시하지 않는다.
"""
import copy, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import wzlib  # noqa: E402

ROOT = wzlib.ROOT
EXDIR = os.path.join(wzlib.TD, 'examples')
REGION = os.path.join(ROOT, 'public/assets/region-references')
TS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
REFS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldReferences.json'), encoding='utf-8'))
TPL = json.load(open(os.path.join(REGION, 'interior-inn-tavern-1f.oprn.json'), encoding='utf-8'))
INDOOR = {'owlery', 'potions', 'clocktower', 'wandshop', 'library', 'greenhouse', 'infirmary', 'honeydukes', 'shared'}
tileset_full = dict(id=TS['id'], name=TS['name'], image=dict(type='bundled', id=TS['textureKey']), kind='custom', family=TS['family'], tileSize=16,
                    tilesPerRow=TS['tilesPerRow'], count=TS['count'], passability=TS['passability'], priority=TS['priority'], terrain=TS['terrain'],
                    tileMeta=TS['tileMeta'], tileGroups=TS['tileGroups'], autotileGroups=TS['autotileGroups'], animationStrips=TS['animationStrips'],
                    structureKits=TS['structureKits'], referenceDocuments=REFS)
slim = dict(id=TS['id'], image=dict(type='bundled', id=TS['textureKey']), tileSize=16, tilesPerRow=TS['tilesPerRow'], count=TS['count'],
            passability=TS['passability'], priority=TS['priority'], terrain=TS['terrain'])


def _pass(t):
    return t < 0 or TS['passability'][t]['up']


def islands(W, H, lower, upper):
    ok = [lower[i] >= 0 and _pass(lower[i]) and _pass(upper[i]) for i in range(W * H)]
    seen = [False] * (W * H); comps = []
    for s0 in range(W * H):
        if not ok[s0] or seen[s0]: continue
        seen[s0] = True; stack = [s0]; cells = []
        while stack:
            i = stack.pop(); cells.append(i); x, y = i % W, i // W
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and ok[j] and not seen[j]: seen[j] = True; stack.append(j)
        comps.append(cells)
    comps.sort(key=len, reverse=True)
    return [i for c in comps[1:] for i in c]


def is_flat(t):
    return t >= 0 and TS['priority'][t] == 'lower' and TS['tileMeta'][t].get('locked') and TS['tileMeta'][t].get('defaultLayer') == 'upper'


entries = []
for f in sorted(os.listdir(EXDIR)):
    if not f.endswith('.json'): continue
    ex = json.load(open(os.path.join(EXDIR, f), encoding='utf-8'))
    if ex.get('skipped'):
        print('건너뜀(빠진 조각)', ex['id'], ex['skipped'][:5]); continue
    W, H = ex['w'], ex['h']
    isl = islands(W, H, ex['lower'], ex['upper'])
    if isl:
        print('건너뜀(갇힌 통행 주머니)', ex['id'], len(isl), '칸'); continue
    L1 = list(ex['lower']); L2 = [-1] * (W * H); L3 = []
    for t in ex['upper']:
        L3.append(-1 if is_flat(t) else t)
    for i, t in enumerate(ex['upper']):
        if is_flat(t): L2[i] = t
    walk = [i for i in range(W * H) if (L1[i] < 0 or TS['passability'][L1[i]]['up']) and (L3[i] < 0 or TS['passability'][L3[i]]['up']) and L1[i] >= 0]
    cx, cy = W // 2, H - 3
    sx, sy = min(((i % W, i // W) for i in walk), key=lambda p: abs(p[0] - cx) + abs(p[1] - cy)) if walk else (0, 0)
    slug = ex['id'].replace('wz-', '')
    mid = f'wz-place-{slug}'
    name = f"마법 학교 · {ex['name']}"
    MAP = dict(id=mid, name=name, width=W, height=H, tilesetId='wizarding_world', tileSize=16, lowerTiles=L1, lowerOverlayTiles=L2, upperTiles=L3,
               upperOverlayTiles=[-1] * (W * H), events=[], climate=dict(mode='inherit'))
    proj = copy.deepcopy(TPL)
    proj['meta']['title'] = name
    proj['tilesets'] = {'wizarding_world': tileset_full}
    proj['maps'] = {mid: MAP}; proj['mapTree'] = dict(mapId=mid, children=[])
    proj['startMapId'] = mid; proj['startPos'] = dict(x=sx, y=sy); proj['mapConnections'] = []
    json.dump(proj, open(os.path.join(REGION, f'wz-{slug}.oprn.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    from PIL import Image
    Image.open(os.path.join(EXDIR, ex['id'] + '.png')).save(os.path.join(REGION, f'wz-{slug}.png'), optimize=True)
    json.dump(dict(map=MAP, tileset=slim), open(os.path.join(ROOT, f'src/project/regionReferences/wz-{slug}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    pid = f'wz-{slug}-{W}x{H}'
    kits = sorted({p[0] for p in ex['place']})
    entries.append(dict(id=pid, name=name, kind='completed-place', placeKind='facility' if ex['space'] in INDOOR else ('settlement' if ex['space'] == 'postoffice' else 'natural'), revision=1, x=0, y=0, width=W, height=H,
                        tilesetId='wizarding_world', preview=f'/assets/region-references/wz-{slug}.png', tilesetPreview='/assets/wizarding-world/wizarding-world-chipset.png',
                        projectDownload=f'/assets/region-references/wz-{slug}.oprn.json', sourceProjectId=f'oprn-bundled-wz-{slug}', sourceMapId=mid,
                        snapshotProjectId=f'oprn-place-wz-{slug}-v1',
                        rules=[f"{W}×{H}칸 {wzlib.SPACES[ex['space']]} 완성 예제(마법 학교·해리포터풍 번들 wizarding_world). {ex.get('desc') or ''}".strip(),
                               f"바닥 `{ex['floor']}` 위에 키트 {len(ex['place'])}개를 뒤(북)에서 앞(남) 순서로 찍었다: " + ', '.join(f'`{k}`' for k in kits[:30]) + ('…' if len(kits) > 30 else ''),
                               "키트 사전·전체 배열·정상/오류는 타일셋 참고문서 용도 `wz-space-" + ex['space'] + "` 에 있다."],
                        limitations='조각 배치 참고 사례. 사람·생물은 이벤트 캐릭터(Wizarding 시트)로 따로 둔다 — 이 맵에는 이벤트가 없다. 움직이는 칸은 baseTile 만 칠해져 있다.'))
    print('게시', pid, f'시작 ({sx},{sy})')

ts_path = os.path.join(ROOT, 'src/project/wizardingPlaceReferences.ts')
open(ts_path, 'w', encoding='utf-8').write('// Generated by scripts/content/wizarding/publish_places_wz.py. 마법 학교(wizarding_world) 공간 예제 under 장소; snapshots in regionReferences/wz-*.json.\n'
                                            'export const WIZARDING_PLACE_REFERENCES = ' + json.dumps(entries, ensure_ascii=False, indent=2) + ' as const;\n')
snap_path = os.path.join(ROOT, 'src/project/regionReferenceSnapshots.ts')
snap = open(snap_path, encoding='utf-8').read()
snap = re.sub(r'  "wz-[^"]+": \(\) => import\("\./regionReferences/wz-[^"]+\.json"\),\n', '', snap)
anchor = '  "jp-city-shopstreet-48x40": () => import("./regionReferences/jp-city-shopstreet.json"),\n'
assert anchor in snap, '스냅샷 로더 자리 없음'
snap = snap.replace(anchor, anchor + ''.join(f'  "{e["id"]}": () => import("./regionReferences/{e["sourceMapId"].replace("wz-place-", "wz-")}.json"),\n' for e in entries))
open(snap_path, 'w', encoding='utf-8').write(snap)
print('장소', len(entries))
