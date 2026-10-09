# 각 장소의 그림 함수 모듈을 이 폴더(src-<장소>/)로 복사한다. 원본은 읽기만 한다.
# 복사본은 원본보다 폴더 한 단 깊으므로 `os.path.join(X, '..'` 상대 경로에 '..' 하나를 더한다(같은 공용 라이브러리·같은 칩셋을 가리키게).
#   python3 copy_fn.py
import os, re, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.dirname(HERE)
PLACES = ['ruined-village', 'rain-ruin-town', 'empire-city', 'mansion-art-city', 'eastern-castle']
PAT = re.compile(r"os\.path\.join\((\w+), (['\"])\.\.\2")

def patch(src, dst):
    t = open(src, encoding='utf-8').read()
    t = PAT.sub(lambda m: "os.path.join(%s, %s..%s, %s..%s" % (m.group(1), m.group(2), m.group(2), m.group(2), m.group(2)), t)
    open(dst, 'w', encoding='utf-8').write(t)

for p in PLACES:
    sd, dd = os.path.join(VAR, p), os.path.join(HERE, 'src-' + p)
    if os.path.isdir(dd): shutil.rmtree(dd)
    os.makedirs(dd)
    for f in sorted(os.listdir(sd)):
        if f.endswith('.py') and not f.startswith('make_') and f != 'compare_ref.py':
            patch(os.path.join(sd, f), os.path.join(dd, f))
    if os.path.isdir(os.path.join(sd, 'vendor')):
        os.makedirs(os.path.join(dd, 'vendor'))
        for f in sorted(os.listdir(os.path.join(sd, 'vendor'))):
            if f.endswith('.py'): patch(os.path.join(sd, 'vendor', f), os.path.join(dd, 'vendor', f))
    print(p, len(os.listdir(dd)))

# ---- 버들항(beodeul-port): 원본 조각 화소를 그대로 복사(tiledata/beodeul-city/render/objects·anim)
import json
REND = os.path.join(VAR, '..', 'beodeul-city', 'render')
BD = os.path.join(HERE, 'src-beodeul'); os.makedirs(os.path.join(BD, 'sprites'), exist_ok=True)
objs = {}
for o in json.load(open(os.path.join(REND, 'city6_objects.json'))): objs.setdefault(o['name'], o)
WANT = ['h101_0', 'h102_1', 'h104_1', 'h107_1', 'h122_0', 'h117_1', 'h101_2', 'h123_1', 'inn', 'cafe', 'lamp_double', 'lamp_crook',
        'mooring_bollard', 'fish_barrel', 'net_rack', 'goods_pile', 'fish_crates', 'crate_fish', 'anchor_display', 'stall_veg',
        'planter_round', 'tree_planter', 'crate_apple', 'bench_wood']
for n in WANT: shutil.copy(os.path.join(REND, 'objects', objs[n]['hash'] + '.png'), os.path.join(BD, 'sprites', n + '.png'))
TREES = {'tree_round': '03a8f71f6ce978b5', 'tree_tall': 'd61d7e227c56b6a7', 'tree_small': 'f4f319b22bed71f6', 'cypress': '2e1ffe1b8d5fb105'}
for n, h in TREES.items(): shutil.copy(os.path.join(REND, 'objects', h + '.png'), os.path.join(BD, 'sprites', n + '.png'))
for n in ('boat_ship_0', 'boat_fishing_0', 'boat_rowboat_0', 'boat_barge_0'): shutil.copy(os.path.join(REND, 'anim', n + '.png'), os.path.join(BD, 'sprites', n + '.png'))
from PIL import Image
Image.open(os.path.join(REND, 'anim', 'water_0.png')).convert('RGBA').crop((176, 1504, 1408, 1552)).save(os.path.join(BD, 'sprites', 'water_crop.png'))
print('beodeul', len(os.listdir(os.path.join(BD, 'sprites'))))
