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


SPDIR = os.path.join(wzlib.TD, 'spaces')


def sources():
    """게시 대상: 빌더가 지은 공간(tiledata/wizarding/spaces, 4층, export_spaces.ts 가 통행 검증) + 빌더가 없는 장면의 모듈 예제(통행 한 덩이일 때만)."""
    out = []
    for f in sorted(os.listdir(SPDIR)) if os.path.isdir(SPDIR) else []:
        if not f.endswith('.json'): continue
        sp = json.load(open(os.path.join(SPDIR, f), encoding='utf-8'))
        out.append(dict(id=sp['id'], name=sp['name'], space=sp['space'], w=sp['w'], h=sp['h'], layers=(sp['lowerTiles'], sp['lowerOverlayTiles'], sp['upperTiles'], sp['upperOverlayTiles']),
                        png=os.path.join(SPDIR, sp['id'] + '.png'), start=sp['spawn'], kits=sorted({p['kit'] for p in sp['placed']}),
                        desc=f"build_wizarding_space({{space:'{sp['space']}'" + (f", variant:'{sp['variant']}'" if sp.get('variant') else '') + f", seed:{sp['seed']}}}) 결과. 문 칸 " + ' '.join(f"{d['side']}({d['x']},{d['y']})" for d in sp['doorCells'])))
    covered = {o['space'] for o in out}
    for f in sorted(os.listdir(EXDIR)):
        if not f.endswith('.json'): continue
        ex = json.load(open(os.path.join(EXDIR, f), encoding='utf-8'))
        if ex.get('skipped'): print('건너뜀(빠진 조각)', ex['id']); continue
        if ex['space'] in covered and ex['id'] not in KEEP_EXAMPLES: continue
        W, H = ex['w'], ex['h']
        if islands(W, H, ex['lower'], ex['upper']): print('건너뜀(갇힌 통행 주머니)', ex['id']); continue
        L2 = [t if is_flat(t) else -1 for t in ex['upper']]; L3 = [-1 if is_flat(t) else t for t in ex['upper']]
        out.append(dict(id=ex['id'], name=ex['name'], space=ex['space'], w=W, h=H, layers=(list(ex['lower']), L2, L3, [-1] * (W * H)),
                        png=os.path.join(EXDIR, ex['id'] + '.png'), start=None, kits=sorted({p[0] for p in ex['place']}), desc=ex.get('desc') or ''))
    return out


KEEP_EXAMPLES = {'wz-post-example-street', 'wz-nat-example-forest-edge'}   # 빌더 공간에 없는 장면(눈 마을 거리·숲 가장자리)


entries = []
for src in sources():
    W, H = src['w'], src['h']
    L1, L2, L3, L4 = (list(a) for a in src['layers'])
    if src['start']: sx, sy = src['start']['x'], src['start']['y']
    else:
        walk = [i for i in range(W * H) if L1[i] >= 0 and all(_pass(a[i]) for a in (L1, L2, L3, L4))]
        cx, cy = W // 2, H - 3
        sx, sy = min(((i % W, i // W) for i in walk), key=lambda p: abs(p[0] - cx) + abs(p[1] - cy)) if walk else (0, 0)
    slug = src['id'].replace('wz-', '')
    mid = f'wz-place-{slug}'
    name = f"마법 학교 · {src['name'] if not src['name'].startswith('wz-') else wzlib.SPACES[src['space']]}"
    MAP = dict(id=mid, name=name, width=W, height=H, tilesetId='wizarding_world', tileSize=16, lowerTiles=L1, lowerOverlayTiles=L2, upperTiles=L3,
               upperOverlayTiles=L4, events=[], climate=dict(mode='inherit'))
    proj = copy.deepcopy(TPL)
    proj['meta']['title'] = name
    proj['tilesets'] = {'wizarding_world': tileset_full}
    proj['maps'] = {mid: MAP}; proj['mapTree'] = dict(mapId=mid, children=[])
    proj['startMapId'] = mid; proj['startPos'] = dict(x=sx, y=sy); proj['mapConnections'] = []
    json.dump(proj, open(os.path.join(REGION, f'wz-{slug}.oprn.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    from PIL import Image
    Image.open(src['png']).save(os.path.join(REGION, f'wz-{slug}.png'), optimize=True)
    json.dump(dict(map=MAP, tileset=slim), open(os.path.join(ROOT, f'src/project/regionReferences/wz-{slug}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    pid = f'wz-{slug}-{W}x{H}'
    kits = src['kits']
    entries.append(dict(id=pid, name=name, kind='completed-place', placeKind='facility' if src['space'] in INDOOR else ('settlement' if src['space'] == 'postoffice' else 'natural'), revision=2, x=0, y=0, width=W, height=H,
                        tilesetId='wizarding_world', preview=f'/assets/region-references/wz-{slug}.png', tilesetPreview='/assets/wizarding-world/wizarding-world-chipset.png',
                        projectDownload=f'/assets/region-references/wz-{slug}.oprn.json', sourceProjectId=f'oprn-bundled-wz-{slug}', sourceMapId=mid,
                        snapshotProjectId=f'oprn-place-wz-{slug}-v2',
                        rules=[f"{W}×{H}칸 {wzlib.SPACES[src['space']]} 완성 맵(마법 학교·해리포터풍 번들 wizarding_world). 걸을 수 있는 칸은 한 덩이로 이어져 있다(통행 검사). {src['desc']}".strip(),
                               "쓴 키트: " + ', '.join(f'`{k}`' for k in kits[:30]) + ('…' if len(kits) > 30 else ''),
                               "다른 크기·문 위치로 새로 지으려면 build_wizarding_space, 키트 사전·정상/오류는 타일셋 참고문서 용도 `wz-space-" + src['space'] + "`."],
                        limitations='사람·생물은 이벤트 캐릭터(Wizarding 시트)로 따로 둔다 — 이 맵에는 이벤트가 없다. 움직이는 칸은 baseTile 만 칠해져 있다.'))
    print('게시', pid, f'시작 ({sx},{sy})')

# 옛 판 게시물 지우기(이번에 안 나온 wz- 장소 파일)
keep = {e['sourceMapId'].replace('wz-place-', 'wz-') for e in entries}
for d, exts in ((REGION, ('.oprn.json', '.png')), (os.path.join(ROOT, 'src/project/regionReferences'), ('.json',))):
    for f in os.listdir(d):
        if f.startswith('wz-') and f.endswith(exts) and f[:-len(next(e for e in exts if f.endswith(e)))] not in keep:
            os.remove(os.path.join(d, f)); print('지움', f)

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
