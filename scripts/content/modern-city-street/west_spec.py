"""서양 도시 세트(country:west) 사양 읽기 — tiledata/modern-city/west/*.txt.

objects-*.txt : `@set <장면 묶음>|<city|rural>` 아래 한 줄에 기물 하나
    id|w|h|place|flavour|gate kind|한국어 이름|영어 이름|한국어 낱말;…|그림 지시
    place: prop = 맨 아랫줄 막힘·윗줄은 사람 위(★) · flat = 밟고 지나가는 바닥 그림 · over = 걸쳐 놓는 띠(막지 않음, 사람 위)
buildings-*.txt : 건물 하나 = B 줄 + F(층 조립) + O(옥상 기물) + X(얹는 부품) + P(부품 그림 지시), M = 지붕 재질
    B|id|한국어|영어|flavour|tier|폭 칸|층수|지붕 칸|지붕 재질|program|문 열(0부터, 쉼표)|지붕 위로 솟는 칸|한국어 낱말;…|종류 설명
    F|아래층부터 ` / ` 로 층을 나눈다. 토큰 = 부품[*되풀이][~ 좌우 뒤집기]
    I|지붕 면을 정면보다 좌우로 들이는 화소      V|x0 칸|지붕 칸|재질 — 같은 건물의 둘째 덩이(바닥 맞춤)
    O|옥상 기물 id(왼쪽부터, `_` = 빈자리)      X|부품|가운데 x 화소|아래끝 y 화소(지붕·정면 경계 기준, +는 아래)
"""
import glob, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
WEST = os.path.join(ROOT, 'tiledata/modern-city/west')
T = 16
TIER_KO = {'small': '소형', 'medium': '중형', 'large': '대형', 'xlarge': '초대형', 'landmark': '랜드마크'}
SET_KO = {'main-street': '중심가 보도', 'shopfront': '가게 앞', 'cafe-terrace': '카페 테라스', 'market': '장터 좌판', 'park': '공원', 'alley': '뒷골목', 'construction': '공사장',
          'tram-bus': '전차·버스 정류장', 'seasonal': '계절 장식', 'rooftop': '옥상', 'farm': '농장', 'orchard': '과수원', 'vineyard': '포도밭', 'roadside': '시골 길가', 'village-green': '마을 풀밭'}
FLAVOUR_KO = {'na': '북미 중심가', 'eu': '유럽 구시가'}


def objects():
    out = []; cur = None
    for f in sorted(glob.glob(os.path.join(WEST, 'objects-*.txt'))):
        for l in open(f, encoding='utf-8'):
            l = l.rstrip('\n')
            if not l or l.startswith('#'): continue
            if l.startswith('@set '): cur = l[5:].split('|'); continue
            p = l.split('|'); assert len(p) == 10, l
            out.append(dict(id=p[0], kit='mc-prop-w-' + p[0], w=int(p[1]), h=int(p[2]), place=p[3], flavour=p[4], kind=p[5], ko=p[6], en=p[7], words=[x for x in p[8].split(';') if x], brief=p[9],
                            set=cur[0], setting=cur[1]))
    assert len({o['id'] for o in out}) == len(out)
    return out


def _tokens(row):
    out = []
    for tok in row.split():
        m = re.fullmatch(r'([a-z0-9-]+?)(~?)(?:\*(\d+))?', tok); assert m, tok
        out += [(m.group(1), bool(m.group(2)))] * int(m.group(3) or 1)
    return out


def buildings():
    """(건물 목록, 부품 {id: dict(w,h,brief,of)}, 지붕 재질 {id: brief})"""
    B = []; P = {}; M = {}; cur = None; vol = None
    for name in ('small', 'medium', 'large', 'xl'):
        for l in open(os.path.join(WEST, f'buildings-{name}.txt'), encoding='utf-8'):
            l = l.rstrip('\n')
            if not l or l.startswith('#'): continue
            k, *p = l.split('|')
            if k == 'M': M[p[0]] = p[1]
            elif k == 'B':
                vol = dict(x0=0, roofCells=int(p[7]), roof=p[8], rows=[], roofObjects=[], extras=[], inset=0)
                cur = dict(id=p[0], kit='mc-bld-w-' + p[0], ko=p[1], en=p[2], flavour=p[3], tier=p[4], w=int(p[5]), storeys=int(p[6]), program=p[9], doors=[int(x) for x in p[10].split(',')],
                           top=int(p[11]), words=[x for x in p[12].split(';') if x], type=p[13], volumes=[vol])
                B.append(cur)
            elif k == 'V':
                vol = dict(x0=int(p[0]), roofCells=int(p[1]), roof=p[2], rows=[], roofObjects=[], extras=[], inset=0); cur['volumes'].append(vol)
            elif k == 'F': vol['rows'] = [_tokens(r) for r in '|'.join(p).split(' / ')]
            elif k == 'I': vol['inset'] = int(p[0])
            elif k == 'O': vol['roofObjects'] = p[0].split()
            elif k == 'X': vol['extras'].append((p[0], int(p[1]), int(p[2])))
            elif k == 'P':
                assert p[0] not in P, p[0]
                P[p[0]] = dict(id=p[0], w=int(p[1]), h=int(p[2]), brief=p[3], of=cur['id'])
            else: raise AssertionError(l)
    return B, P, M


def geometry(b, P):
    """건물의 화소 기하: 덩이마다 (x0px, 폭, 정면 높이, 지붕 높이), 전체 높이 칸."""
    vols = []
    for v in b['volumes']:
        ws = [sum(P[t]['w'] for t, _ in r) for r in v['rows']]
        hs = [max(P[t]['h'] for t, _ in r) for r in v['rows']]
        assert len(set(ws)) == 1, (b['id'], ws)
        assert all(len({P[t]['h'] for t, _ in r}) == 1 for r in v['rows']), b['id']
        vols.append(dict(x0=v['x0'] * T, w=ws[0], front=sum(hs), roof=v['roofCells'] * T, rowH=hs))
    w = max(g['x0'] + g['w'] for g in vols); assert w == b['w'] * T, (b['id'], w, b['w'] * T)
    body = max(g['front'] + g['roof'] for g in vols)
    h = -(-(body + b['top'] * T) // T)
    return vols, h


if __name__ == '__main__':
    import collections
    O = objects(); B, P, M = buildings()
    print('objects', len(O), dict(collections.Counter(o['setting'] for o in O)), dict(collections.Counter(o['set'] for o in O)))
    print('buildings', len(B), dict(collections.Counter(b['tier'] for b in B)), dict(collections.Counter(b['flavour'] for b in B)), 'parts', len(P), 'materials', len(M))
    used = set()
    for b in B:
        vols, h = geometry(b, P); used |= {t for v in b['volumes'] for r in v['rows'] for t, _ in r} | {x[0] for v in b['volumes'] for x in v['extras']}
        g = vols[0]; door = [P[v_t]['id'] for v_t, _ in b['volumes'][0]['rows'][0]]
        print(f"  {b['kit']:28} {b['tier']:8} {b['flavour']} {b['w']}x{h} storeys {b['storeys']} doors {b['doors']} {b['program']}")
    print('unused parts', sorted(set(P) - used), 'missing', sorted(used - set(P)))
    oid = {o['id'] for o in O}
    print('missing rooftop objects', sorted({x for b in B for v in b['volumes'] for x in v['roofObjects'] if x != '_' and x not in oid}))
