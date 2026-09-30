# 16px 손 도트 실내 기물 「후보 찍기 → 사용자가 고르기」 하네스 공통 경로·도우미.
# 정본 v5(tiledata/hand-interior/v5)는 읽기만 한다. 산출물은 전부 tiledata/hand-interior/pick/ 아래.
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
PICK = os.path.join(ROOT, 'tiledata/hand-interior/pick')
CAND = os.path.join(PICK, 'candidates')
PAL_DIR = os.path.join(PICK, 'palette')
SHARED_PAL = os.path.join(PAL_DIR, 'v5.pal')
PXGRID = os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid')
HARNESS = os.path.join(ROOT, 'scripts/content/pixel-harness')
WORKER_RE = re.compile(r'^(w[0-9]{1,2}|pilot)-([A-Z])\.pxg$')   # 작업자 id(w1…w99, pilot) + 방향 글자

def slug(i):
    return re.sub(r'[^A-Za-z0-9]+', '_', i).strip('_')

def load_meta():
    return json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))

def objects_by_id():
    return {o['id']: o for o in load_meta()['objects']}

def objects_by_slug():
    return {slug(o['id']): o for o in load_meta()['objects']}

_ATLAS = None
def v5_atlas():
    global _ATLAS
    if _ATLAS is None:
        from PIL import Image
        _ATLAS = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
    return _ATLAS

def v5_slot(o):
    """v5 아틀라스의 칸 자리(패딩 포함, 첫 프레임). 후보 캔버스 크기 = 이 크기."""
    a = o['atlas']
    return v5_atlas().crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))

def resize_for(s):
    """사용자가 크기를 바꾸라고 한 기물: candidates/<slug>/resize.json = {"canvas":[w,h],"footprint":{"w":2,"h":0},"why":"…"}.
    없으면 None → 기존 동작(v5 칸 자리 크기) 그대로."""
    p = os.path.join(CAND, s, 'resize.json')
    if not os.path.exists(p): return None
    try:
        r = json.load(open(p, encoding='utf-8'))
        w, h = r['canvas']; assert int(w) > 0 and int(h) > 0
    except (ValueError, KeyError, TypeError, AssertionError, OSError):
        return None
    return dict(canvas=[int(w), int(h)], footprint=r.get('footprint'), why=r.get('why', ''))

def geom(o):
    """후보가 따라야 할 캔버스·패딩·칸 수. resize.json 이 있으면 그 값(패딩 0), 없으면 v5 그대로."""
    rz = resize_for(slug(o['id']))
    if rz:
        return dict(canvas=rz['canvas'], padTop=0, footprint=rz['footprint'] or o['footprint'], resized=rz)
    a = o['atlas']
    return dict(canvas=[a['w'], a['h']], padTop=a['padTop'], footprint=o['footprint'], resized=None)

def atomic_write(path, text):
    tmp = path + '.tmp%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)

def v5_modules():
    """v5 방 조립 스크립트(rooms4·room4)를 불러온다. 스크립트가 상대 경로를 쓰므로 cwd 를 저장소 루트로."""
    os.chdir(ROOT)
    if V5 not in sys.path:
        sys.path.insert(0, V5)
    import rooms4, room4  # noqa
    return rooms4, room4
