#!/usr/bin/env python3
# 실내 16px 칩셋의 3/4 시점(쯔꾸르식 정면-위) 감사 — 판정과 증거만 만든다. 그림은 고치지 않는다.
#
# 3/4 시점 기준(사용자 계약):
#   * 벽 = 위에 천장 윗면 띠(어둡다) + 바닥 높이의 앞면(보통 2칸=32px). 옆벽은 윗면 띠만 보인다.
#   * 가구·기물 = 발자국 깊이만큼의 윗면(탁자 상판·침대 덮개·선반 윗면·카운터 상판) + 그 아래 앞면.
#   * 윗면 없는 앞면 판 = 위반(정면도). 앞면 없는 순수 위 = 위반(탑다운).
#   * 바닥 무늬·깔개(flat)·벽걸이(hang)는 면제.
#
# 11-2 유형표(modern-style-bible.md §11)와 맞춘 기준 — 벽에 붙는 키 큰 가구(옷장·책장·찬장·벽난로·선반·사물함·자판기·캐비닛 …):
#   윗면 T 4~6px(벽 쪽으로 보이는 뚜껑) + 아래 앞면 F(처마 그림자 2px 포함). T<=2 정면도, T=3 윗면 부족, T>8 과다.
#   T 는 「가장 밝은 줄(앞 모서리 하이라이트) 위쪽 줄 수 + 그 줄」로 잰다 — 처마 그림자·문 홈은 접힘선으로 오측정되므로 쓰지 않는다.
#   유형 판정은 이름 낱말(WALL_TALL_WORDS) + 높이 H>=32. 작업자 게이트는 CLI: --wall-tall PNG(벽 붙이 키 큰 가구) / --object PNG(그 밖의 기물).
#   (judge() 의 「키에 v34 가 있으면 기계 판정」 분기는 수집기가 그런 키를 만들지 않아 휴면이다 — CLI 가 실제 게이트.)
# 조각 그림에서 윗면과 앞면의 경계를 잰다. 손 도트(.pxg)는 재질 글자만 있고 윗면/앞면 라벨이 없어 렌더된 RGBA 로 추정한다:
#   손 도트 관례 = 어두운 윤곽선 -> 밝은 하이라이트 -> 중간 톤(윗면) -> 어두운 「접힘선」(윗면과 앞면 사이) -> 앞면.
#   t = 실루엣 맨 위 행부터 접힘선까지 픽셀 수(윤곽선 포함), f = 접힘선 아래 ~ 실루엣 맨 아래.
#   접힘선이 없으면 행 평균 밝기의 큰 낙차를 경계로 쓴다. 둘 다 없으면 「불명」 -> 눈으로 보고 OVERRIDES 에 적는다.
#
# 사용:
#   python3 scripts/content/atlas-pick/interior_view34_audit.py            # 측정 -> tiledata/atlas-pick/interior-view34-audit.json
#   python3 scripts/content/atlas-pick/interior_view34_audit.py --sheet v5 # 눈 확인용 확대 시트(/tmp/v34 로 뽑는다)
import io, json, os, sys, glob, sqlite3, base64, argparse
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT_JSON = os.path.join(ROOT, 'tiledata/atlas-pick/interior-view34-audit.json')
WT = os.path.abspath(os.path.join(ROOT, '..'))      # 형제 워크트리 묶음(~/.t3/worktrees/rpg-zzu)
V5_DIR = os.environ.get('V5_DIR', os.path.join(WT, 't3code-8b4b09de-atlas-interior/tiledata/hand-interior/v5'))
V5_MAPS = os.environ.get('V5_MAPS', os.path.join(WT, 't3code-8b4b09de-atlas-interior/tiledata/hand-interior/v5-maps'))
PICK_CAND = os.environ.get('PICK_CAND', os.path.join(WT, 't3code-8b4b09de-i16-pick/tiledata/hand-interior/pick/candidates'))
PICK_DB = os.environ.get('PICK_DB', os.path.expanduser('~/.local/share/oprn/hand-interior-pick/picks.sqlite'))
HORROR = os.path.join(ROOT, 'tiledata/atlas-pick/candidates-horror')
SCHOOL = os.path.join(ROOT, 'tiledata/atlas-pick/candidates-school')

# ---- 판정 기준 (픽셀) -------------------------------------------------------------------------
T_FRONT = 1      # t <= 1 : 정면도(윗면 없음)
T_RIM = 4        # 2 <= t <= 4 : 윗면 부족(테두리 수준)
F_MIN = 3        # f < 3 : 앞면 없음(탑다운)
CLASSES = ['ok', 'rim', 'front', 'topdown', 'flat', 'unclear']
CLASS_KO = {
    'ok': '3/4 준수', 'rim': '윗면 부족(1~4px 띠)', 'front': '정면도(윗면 없음)',
    'topdown': '탑다운(앞면 없음)', 'flat': '평면·벽걸이 예외', 'unclear': '불명(눈 판정)',
    'wallface': '벽면 조각(구조 검사)', 'ceil': '천장 윗면 조각',
}

def lum(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

def measure(arr):
    """RGBA ndarray -> dict(t, f, top, bottom, H, W, method) 또는 None(빈 그림).
    행마다 불투명 픽셀 평균 밝기를 쓴다."""
    a = arr[..., 3] >= 128
    if not a.any():
        return None
    rows = np.where(a.any(1))[0]
    r0, r1 = int(rows[0]), int(rows[-1])
    L = lum(arr[..., :3].astype(float))
    n = a.sum(1)
    ml = np.array([L[r][a[r]].mean() if n[r] else 255.0 for r in range(arr.shape[0])])
    wmax = int(n.max())
    H = r1 - r0 + 1
    out = dict(H=H, W=int(np.where(a.any(0))[0][-1] - np.where(a.any(0))[0][0] + 1), top=r0, bottom=r1, t=None, f=None, method=None)
    # 1) 위 윤곽선(어두운 행) 건너뛰기
    s = r0
    while s <= r1 and ml[s] < 45 and n[s] >= 0.5 * wmax:
        s += 1
    # 2) 어두운 접힘선: 앞 행보다 20 이상 어둡고 밝기 < 70, 다음 행이 다시 밝아진다(또는 바닥)
    for r in range(s + 1, r1):
        if n[r] < 0.5 * wmax:
            continue
        if ml[r] < 70 and ml[r - 1] - ml[r] >= 20 and (r + 1 > r1 or ml[r + 1] - ml[r] >= 15):
            out.update(t=r - r0, f=r1 - r, method='crease')
            return out
    # 3) 밝기 큰 낙차
    for r in range(s + 1, r1):
        if n[r] < 0.5 * wmax:
            continue
        if ml[r - 1] - ml[r] >= 38:
            out.update(t=r - r0, f=r1 - r + 1, method='step')
            return out
    return out

# ---- 11-2: 벽에 붙는 키 큰 가구 ----------------------------------------------------------------
WALL_TALL_WORDS = ('옷장', '책장', '찬장', '벽난로', '선반', '사물함', '자판기', '캐비닛', '서랍장', '진열장', '수납장', '장식장', '서가',
                   'wardrobe', 'bookshelf', 'bookcase', 'cupboard', 'cabinet', 'fireplace', 'shelf', 'locker', 'vending', 'closet', 'dresser', 'rack')
WT_T_MAX = 8       # 측정 T(윗면 줄 + 앞 모서리 하이라이트 줄). 계약값 4~6 + 하이라이트 줄 허용
WT_H_MIN = 32

def is_wall_tall(name, H=None):
    n = (name or '').lower()
    return any(w in n for w in WALL_TALL_WORDS) and (H is None or H >= WT_H_MIN)

def measure_wall_tall(arr):
    """벽 붙이 키 큰 가구의 윗면 높이. 실루엣 맨 위 9줄 안에서 평균 밝기가 가장 높은 줄 = 앞 모서리 하이라이트.
    t = 그 줄까지의 줄 수(윗면 줄 + 하이라이트 줄). 하이라이트가 두 번째 줄이면(옛 그림 t=2) 윗면이 없다는 뜻이다."""
    m = measure(arr)
    if m is None:
        return None
    a = arr[..., 3] >= 128
    L = lum(arr[..., :3].astype(float))
    r0 = m['top']
    rows = list(range(r0, min(m['bottom'], r0 + 8) + 1))
    ml = [L[r][a[r]].mean() for r in rows]
    t = int(np.argmax(ml)) + 1
    out = dict(m)
    out.update(t=t, f=m['H'] - t, method='walltall')
    return out

def classify_wall_tall(m):
    t = m['t']
    if m['f'] < F_MIN + 12:
        return 'topdown'
    if t <= 2:
        return 'front'
    if t == 3:
        return 'rim'
    if t > WT_T_MAX:
        return 'topdown'
    return 'ok'

def classify(m, kind=None, force=None):
    if force:
        return force
    if kind in ('hang', 'flat') or kind == 'flat':
        return 'flat'
    if m is None or m['t'] is None:
        return 'unclear'
    t, f = m['t'], m['f']
    if f < F_MIN:
        return 'topdown'
    if t <= T_FRONT:
        return 'front'
    if t <= T_RIM:
        return 'rim'
    return 'ok'

def load_png(p):
    return Image.open(p).convert('RGBA')

def data_uri(im, scale=1):
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

# ---- 눈 판정으로 덮어쓴 값 (기계 측정이 잘못 잡은 것만; 근거는 확대 시트) ---------------------------
OVERRIDES = {}
def _ov(target, keys, cls, why):
    for k in keys:
        OVERRIDES[(target, str(k))] = (cls, why)

# v5 (키 = interior-meta.json objects 순번). 근거 = 4배 확대 시트 눈 확인.
_ov('v5', [101, 104, 105, 108], 'ok', '천·술 가장자리를 앞면으로 오측정 — 윗면 상판이 크고 술 늘어진 앞면이 있다')
_ov('v5', range(222, 229), 'ok', '찻상 — 상판 윗면이 크고 보 자락이 앞면. 접힘선 오측정')
_ov('v5', [164], 'ok', '항아리 — 둥근 아가리 윗면 + 몸통')
_ov('v5', [162, 247, 248], 'ok', '자루·광차·광석 더미 — 윗면(입구/더미 꼭대기)과 앞면이 다 보인다(마스크 얇아 불명 처리됐던 것)')
_ov('v5', [111, 119, 113, 126, 141, 136, 37, 43, 44], 'ok', '작은 그릇·도마·솥·물통·성수반·제단·상자 — 둥근/네모 윗면이 보이고 앞면이 있다')
_ov('v5', [103, 241, 242, 243, 252, 254, 260, 268, 294, 158, 231, 249, 282, 285, 124, 146, 127, 117, 121], 'front',
    '정면도 — 윗면 없이 앞면 판만 있다(기둥 t=33 은 몸통 명암 오측정)')
_ov('v5', [261, 286, 287], 'front', '오러리·긴 의자(옆모습): 윗면 없음')
_ov('v5', [153, 154, 155, 229, 230, 232], 'rim', '책장·장작 받침·발효 선반 — 윗면이 1~3px 얇은 뚜껑뿐(기계는 ok 로 봄)')
_ov('v5', [255, 256, 257, 258, 251, 272, 270, 281], 'flat', '용암 띠·달 웅덩이·무대 배경·커튼 날개·생물 스프라이트 — 평면/면제')
_ov('v5', [160, 210, 315, 316], 'ok', '더미·자루·광차 — 봉우리/윗입구 면 + 앞면이 함께 보임(눈 판정)')
_ov('v5', [288, 317, 363], 'front', '장작 단면·룬석·건초 — 앞면 판만 있고 윗면 없음(눈 판정)')
_ov('v5', [366], 'rim', '안장걸이 — 안장 윗면이 얇음(눈 판정)')
_ov('v5', [319, 353, 362], 'flat', '달 웅덩이(바닥)·무대 배경판(벽걸이)·초코보(생물 스프라이트) — 면제')

# ================================================================================================
# 수집: 대상마다 [dict(target,key,name,role,kind,arr,extra)] 를 만든다.
#   role: object(윗면+앞면 필요) / hang(벽걸이·면제) / flat(바닥 무늬·면제) / wallface(벽 앞면 조각·면제, 구조 검사 대상) / ceil(천장 윗면 조각)
# ================================================================================================
# ---- pick(18302 고르기 판) 눈 판정: 키 = 슬러그. 고른 후보 그림을 4배로 보고 정했다 ----
_ov('pick', ['alembic','armor_stand','apothecary_drawers','bookshelf_1w','bookshelf_2w','bread_shelf','bread_shelf_baguette','cabinet_bottle_bottler_bottley',
             'cabinet_candle','clock','coat_rack','choir_stall','column_dwarf','column_live','column_marble','column_steel','column_stone','column_wood',
             'confessional','cupboard','elven_harp','firewood_rack','firewood_rack_2w','herb_drying_rack','keg_rack','kitchen_sink','loom','magitek_armor',
             'mannequin','meat_hooks','music_stand','pipe_organ','proofing_rack','pulpit','scroll_rack','spinning_wheel','stone_throne','throne','tailor_mirror',
             'tall_vase_blue','tall_vase_red','telescope','timber_prop','wardrobe'],
    'front', '벽에 붙는 키 큰 가구·기둥·거울·악기 — 정면 판(윗면 0~3px). 위에서 본 윗면이 없다')
_ov('pick', ['anvil','cake_display_case','display_potion','holy_water_font','lectern','pew_E2','saddle_rack','theater_seat','washbasin','balance_scale'],
    'rim', '윗면이 얇은 테두리 수준(1~4px) 또는 병·저울이 정면으로만 서 있다')
_ov('pick', ['barrel','barrel_apple','basket_herb','basket_mushroom','bathtub','bar_stool','cheese_wheels','chest','chopping_block','conductor_podium','cradle','crate',
             'crystal_ball','hay_bale','mine_cart','mortar_and_pestle','ore_pile','plant','pot','quench_barrel','roundtable','royal_chest','sack_flour','sack_grain',
             'slop_bucket','table_bolt_yarn','treasure_pile','water_jar','white_tree'],
    'ok', '작은 그릇·통·궤·더미 — 둥근/네모 윗면(아가리·뚜껑·덩이 꼭대기)이 보이고 앞면이 붙는다(기계가 얇은 마스크로 오측정)')
_ov('pick', ['scenery_flat','curtain_wing'], 'flat', '무대 배경·커튼 — 면제')
_ov('pick', ['straw_bed'], 'topdown', '짚 침대 — 윗면만 있고 앞면(옆판)이 2px 뿐이라 탑다운')

# ---- 호러 2판: 키 = 슬러그(A/B/C/pilot 변형 전부에 적용). 4배 시트 눈 판정 ----
_ov('horror', ['bookshelf_manor','broken_anatomy','broken_locker','candelabra_drip','cemetery_gate','doll_shelf','fireplace_cold','grandfather_clock',
               'gravestone_cross','hosp_bed','hosp_screen','iron_fence','iv_stand','medicine_cabinet','mirror_cracked','pillar_marble','pillar_stone',
               'piano_dusty','rope_barrier','shelf_cellar','wardrobe_ajar','bench_gallery','bed_manor'],
    'front', '정면 판(키 큰 가구·기둥·침대 머리쪽) — 윗면이 없거나 1~3px. 위에서 본 면이 보이지 않는다')
_ov('horror', ['armchair_sheet','bedside_cabinet','broken_desk','chair_wood','chair_wood_back','doll_sitting','dresser','gravestone_round','pedestal',
               'sofa_sheet','table_wood','ward_sink','wheelchair'],
    'rim', '윗면이 얇은 테두리(1~4px)뿐이거나 앞모습 위주')
_ov('horror', ['bookshelf_fallen','candle_floor','candle_table','canopy_bed_rot','chandelier_fallen','hosp_chair','instrument_tray','music_box','old_well',
               'operating_table','side_table','specimen_jar','stairs_broken','stairs_up_stone','stairs_up_wood'],
    'ok', '윗면(상판·시트·아가리·계단 디딤)이 보이고 앞면이 있다')
_ov('horror', ['dead_tree'], 'flat', '식생 — 3/4 윗면 계약 대상 아님(면제)')

# ---- 학교: 키 = 슬러그 ----
_ov('school', ['broadcast_desk','bike_rack','basketball_hoop','bunk_bed','cleaning_locker','copier','dorm_closet','easel','height_scale','lab_cabinet','library_shelf',
               'locker_row','music_stand','nurse_bed','plaster_bust','privacy_screen','roof_fence','school_gate','shoe_locker','skeleton_model','soccer_goal',
               'vending_school'],
    'front', '정면 판 — 윗면 0~3px. 자판기·사물함·서가는 「윗면 없는 앞면 상자」(일본 칩셋에서 문제 된 유형 그대로)')
_ov('school', ['assembly_podium','genkan_step','lectern','water_fountain'], 'rim', '윗면이 1~4px 테두리 수준')
_ov('school', ['cafeteria_table','library_counter','serving_counter','kiosk_counter','lab_bench','desk_pair','desk_set','dorm_desk','staff_desks','teacher_platform',
               'grand_piano','gym_mat','vaulting_box','ball_basket','milk_crate','water_tank','slippers'],
    'ok', '상판·매트·뚜껑 윗면이 보이고 앞면이 붙는다')
_ov('school', ['meal_tray'], 'topdown', '식판 — 위에서 본 면뿐(앞면 1px)')

def v5_items():
    m = json.load(open(os.path.join(V5_DIR, 'interior-meta.json'), encoding='utf-8'))
    at = np.array(Image.open(os.path.join(V5_DIR, m['atlas']['file'])).convert('RGBA'))
    items = []
    for i, o in enumerate(m['objects']):
        a = o['atlas']
        arr = at[a['y']:a['y'] + a['h'], a['x']:a['x'] + a['w']]
        items.append(dict(id=o['id'], name=o.get('name_ko', ''), kind=o['kind'], footprint=o.get('footprint'),
                          overhang_px=o.get('overhang_px'), size=[a['w'], a['h']], frames=a.get('frames', 1), arr=arr))
    return m, at, items

ROLE_OF_KIND = {'floor': 'object', 'wall': 'object', 'hang': 'hang', 'flat': 'flat'}

def collect_v5():
    m, at, items = v5_items()
    out = []
    for k, x in enumerate(items):
        out.append(dict(target='v5', key='%d' % k, name='%s %s' % (x['id'], x['name']), role=ROLE_OF_KIND[x['kind']],
                        kind=x['kind'], footprint=x['footprint'], arr=x['arr'], extra=dict(overhang_px=x['overhang_px'])))
    return out

def pick_choices():
    con = sqlite3.connect('file:%s?mode=ro' % PICK_DB, uri=True)
    rows = con.execute('select item_id, choice from current').fetchall()
    con.close()
    return {r[0]: r[1] for r in rows}

def collect_pick():
    """18302 찍기 도구: 항목마다 고른 후보(없으면 v5.png)를 잰다. v5.png 도 같이 넣어 「고른 것이 v5 보다 나아졌나」를 본다."""
    ch = pick_choices()
    out = []
    for d in sorted(glob.glob(os.path.join(PICK_CAND, '*'))):
        info = json.load(open(os.path.join(d, 'info.json'), encoding='utf-8'))
        c = ch.get(info['id']) or 'v5'
        if not os.path.exists(os.path.join(d, c + '.png')):
            c = 'v5'
        arr = np.array(load_png(os.path.join(d, c + '.png')))
        base = np.array(load_png(os.path.join(d, 'v5.png')))
        out.append(dict(target='pick', key=info['slug'], name='%s %s' % (info['id'], info.get('name_ko', '')), role=ROLE_OF_KIND.get(info['kind'], 'object'),
                        kind=info['kind'], footprint=info.get('footprint'), arr=arr, extra=dict(choice=c, base=base, category=info.get('category'))))
    return out

def horror_role(info):
    if info['layer'] in ('ground', 'decal', 'over'):
        return 'flat'
    if info['layer'] == 'wall':
        return 'hang'
    if info['layer'] == 'facade':
        return 'ceil' if info.get('autotile') else 'wallface'
    return 'object'

def collect_horror():
    """호러 2판 후보 전부(A/B/C/pilot 변형마다). picks-horror.json 이 비어 있어 「고른 것」이 없다."""
    out = []
    for d in sorted(glob.glob(os.path.join(HORROR, '*'))):
        info = json.load(open(os.path.join(d, 'info.json'), encoding='utf-8'))
        for f in sorted(glob.glob(os.path.join(d, '*.png'))):
            b = os.path.basename(f)
            if any(t in b for t in ('.ctx', '-x4', 'ref-')):
                continue
            out.append(dict(target='horror', key='%s/%s' % (info['slug'], b[:-4]), name='%s %s' % (info['slug'], info.get('name', '')),
                            role=horror_role(info), kind=info['layer'], footprint=info.get('cells'), arr=np.array(load_png(f)),
                            extra=dict(slug=info['slug'], variant=b[:-4], stage=info.get('stage'))))
    return out

def collect_school():
    ch = {k: v.get('choice') for k, v in json.load(open(os.path.join(ROOT, 'tiledata/atlas-pick/picks-school.json'), encoding='utf-8')).items()}
    out = []
    for d in sorted(glob.glob(os.path.join(SCHOOL, '*'))):
        info = json.load(open(os.path.join(d, 'info.json'), encoding='utf-8'))
        c = ch.get(info['slug'])
        chosen = bool(c)
        if not c:   # 안 고른 7개는 A 로 잰다(표시는 unchosen)
            cs = sorted(x for x in glob.glob(os.path.join(d, 's*-A.png')))
            c = os.path.basename(cs[0])[:-4]
        arr = np.array(load_png(os.path.join(d, c + '.png')))
        role = horror_role(info)
        out.append(dict(target='school', key=info['slug'], name='%s %s' % (info['slug'], info.get('name', '')), role=role, kind=info['layer'],
                        footprint=info.get('cells'), arr=arr, extra=dict(choice=c, chosen=chosen, place=info.get('place'))))
    return out


def pack_sheet(entries, out, S=4, W=1560):
    """entries: [(label, arr, measure_dict|None, cls)] -> 촘촘히 채운 확대 시트. 빨간선=윗면/앞면 경계, 초록 막대=윗면 깊이."""
    x = y = rowh = 0
    cells = []
    for lab, arr, ms, cl in entries:
        w = max(arr.shape[1] * S, 150) + 6
        h = arr.shape[0] * S + 16
        if x + w > W:
            x, y, rowh = 0, y + rowh, 0
        cells.append((x, y, lab, arr, ms, cl))
        x += w
        rowh = max(rowh, h)
    im = Image.new('RGB', (W, y + rowh + 4), (40, 40, 48))
    d = ImageDraw.Draw(im)
    for cx, cy, lab, arr, ms, cl in cells:
        pic = Image.fromarray(arr).resize((arr.shape[1] * S, arr.shape[0] * S), Image.NEAREST)
        bg = Image.new('RGBA', pic.size, (90, 90, 100, 255)); bg.alpha_composite(pic)
        im.paste(bg.convert('RGB'), (cx + 2, cy + 14))
        if ms and ms.get('t') is not None:
            yy = cy + 14 + (ms['top'] + ms['t']) * S
            d.line([(cx + 2, yy), (cx + 2 + pic.width, yy)], fill=(255, 60, 60), width=1)
            d.line([(cx + 1, cy + 14 + ms['top'] * S), (cx + 1, yy)], fill=(80, 255, 80), width=2)
        d.text((cx + 2, cy + 1), lab, fill=(255, 255, 255))
    im.save(out)

COLLECT = dict(v5=collect_v5, pick=collect_pick, horror=collect_horror, school=collect_school)

def judge(e):
    """-> (cls, method, m). OVERRIDES[(target,key)] = (cls, 이유) 가 있으면 눈 판정이 이긴다."""
    m = measure(e['arr'])
    tall = is_wall_tall(e['name'] + ' ' + e['key'], m['H'] if m else None) and e['role'] == 'object'
    if tall and 'v34' in e['key']:
        mt = measure_wall_tall(e['arr'])
        return classify_wall_tall(mt), 'walltall', mt
    ov = OVERRIDES.get((e['target'], e['key'])) or OVERRIDES.get((e['target'], e['key'].split('/')[0]))
    if ov:
        return ov[0], 'eye', m
    if e['role'] in ('hang', 'flat'):
        return 'flat', 'role', m
    if e['role'] == 'wallface':
        return 'wallface', 'role', m
    if e['role'] == 'ceil':
        return 'ceil', 'role', m
    return classify(m), (m or {}).get('method') or 'none', m

def label(e, cl, m):
    return '%s %s t=%s f=%s %s' % (e['key'], e['name'][:16], m and m['t'], m and m['f'], cl)

def make_sheets(target, roles=('object',), per=60, S=4):
    os.makedirs('/tmp/v34', exist_ok=True)
    es = [e for e in COLLECT[target]() if e['role'] in roles]
    for si in range(0, len(es), per):
        ents = []
        for e in es[si:si + per]:
            cl, meth, m = judge(e)
            ents.append((label(e, cl, m), e['arr'], m, cl))
        pack_sheet(ents, '/tmp/v34/sheet_%s_%02d.png' % (target, si // per), S=S)
    print(target, 'items', len(es), 'sheets', (len(es) + per - 1) // per)


# =================================================================================================
# 집계
# =================================================================================================
RANK = {'ok': 0, 'ceil': 0, 'rim': 1, 'front': 2, 'topdown': 2}
CHECKED = ('ok', 'rim', 'front', 'topdown', 'unclear')     # 3/4 계약 대상(면제·구조 조각 제외)

def summarize(rows):
    import collections
    c = collections.Counter(r['cls'] for r in rows)
    n = sum(c[k] for k in CHECKED)
    return dict(counts=dict(c), checked=n, ok=c['ok'], pass_rate=round(c['ok'] / n, 3) if n else None,
                rim=c['rim'], front=c['front'], topdown=c['topdown'])

def row_of(e):
    cl, meth, m = judge(e)
    r = dict(key=e['key'], name=e['name'], role=e['role'], cls=cl, method=meth, t=m and m['t'], f=m and m['f'],
             size=[int(e['arr'].shape[1]), int(e['arr'].shape[0])], footprint=e.get('footprint'))
    ov = OVERRIDES.get((e['target'], e['key'])) or OVERRIDES.get((e['target'], e['key'].split('/')[0]))
    if ov:
        r['why'] = ov[1]
    return r

def pick_compare(es):
    """18302 찍기 결과(고른 후보) vs v5.png 기준선. 같은 측정기로 윗면 깊이 t 를 비교한다(눈 판정은 고른 쪽에만 있다)."""
    better = same = worse = skipped = 0
    rows = []
    for e in es:
        if e['role'] != 'object':
            continue
        c = e['extra']['choice']
        if c == 'v5':
            skipped += 1
            continue
        m1 = measure(e['arr']); m0 = measure(e['extra']['base'])
        if not m1 or not m0 or m1['t'] is None or m0['t'] is None:
            skipped += 1
            continue
        d = m1['t'] - m0['t']
        (better if d >= 2 else worse if d <= -2 else same).__class__   # noqa
        if d >= 2: better += 1
        elif d <= -2: worse += 1
        else: same += 1
        rows.append(dict(key=e['key'], choice=c, t_v5=m0['t'], t_pick=m1['t'], d=d))
    return dict(better=better, same=same, worse=worse, skipped=skipped, note='t 가 2px 이상 커지면 개선, 2px 이상 줄면 후퇴, 그 사이는 동일(기계 측정, 접힘선이 없으면 제외)', rows=rows)

def cap_thickness(render_path, x):
    """v5 방 렌더 한 세로줄에서 천장 평면 채움 위 벽 「윗면 띠」 두께(px). 천장 채움(어두운 체커)이 끝나고 벽면(16의 배수 경계)이 시작하기 전까지."""
    r = np.array(Image.open(render_path).convert('RGB')).astype(float)
    L = lum(r)
    col = L[:, x]
    y0 = next((y for y in range(len(col)) if col[y] > 70), None)
    if y0 is None:
        return None
    face = ((y0 + 15) // 16) * 16
    return face - y0, y0

def v5_structure(items_all):
    m, at, items = v5_items()
    walls = [dict(id=w['id'], faceRows=w['faceRows'], px=w['atlas']['h']) for w in m['walls']]
    wall_h = sorted({w['px'] for w in walls})
    ceil_flat = len(m['ceilings'])
    caps = {}
    for nm, x in (('bakery', 30), ('tavern', 30), ('inn', 30), ('throne', 60)):
        pth = os.path.join(V5_MAPS, 'render', nm + '.png')
        if os.path.exists(pth):
            try:
                caps[nm] = cap_thickness(pth, x)
            except Exception:
                pass
    overhang = sum(1 for o in m['objects'] if o.get('overhang_px'))
    tall = sum(1 for o in m['objects'] if o['kind'] == 'wall')
    shadow = sum(1 for x in items if ((x['arr'][..., 3] > 0) & (x['arr'][..., 3] < 255)).any())
    return dict(walls=len(walls), wall_face_px=wall_h, wall_face_rows=sorted({w['faceRows'] for w in walls}),
                ceiling_kinds=ceil_flat, ceiling_is_flat_rgb=True, cap_px_in_renders={k: v and v[0] for k, v in caps.items()},
                objects_with_overhang=overhang, wall_hugging_objects=tall, sprites_with_soft_shadow=shadow, total_objects=len(items))

def school_composite(S=2):
    """교실 한 칸: 창·칠판·벽면·바닥·교탁·책상·사물함을 조각 그대로 조립한다(천장 조각이 없어 위는 검정)."""
    es = {e['key']: e for e in collect_school()}
    W, H = 10, 8
    canvas = Image.new('RGBA', (W * 16, H * 16), (20, 18, 22, 255))
    def put(k, cx, cy):
        canvas.alpha_composite(Image.fromarray(es[k]['arr']), (cx * 16, cy * 16))
    for cx in range(W):
        for cy in range(2, H):
            put('classroom_floor', cx, cy)
    for cx in range(W):
        put('classroom_wall', cx, 1) if False else None
    wall = es['classroom_wall']['arr']      # 1x2 칸(16x32)
    for cx in range(W):
        canvas.alpha_composite(Image.fromarray(wall), (cx * 16, 1 * 16))
    put('blackboard', 1, 1) if es['blackboard']['arr'].shape[0] == 32 else canvas.alpha_composite(Image.fromarray(es['blackboard']['arr']), (16, 8))
    put('class_window', 6, 1)
    put('locker_row', 8, 3)
    put('staff_desks', 1, 3)
    put('desk_pair', 3, 5); put('desk_pair', 5, 5); put('desk_pair', 7, 5)
    put('desk_set', 3, 7); put('desk_set', 5, 7)
    return canvas

def horror_room_rows(rows_by_key):
    rep = json.load(open(os.path.join(ROOT, 'tiledata/atlas-pick/rooms-horror/report.json'), encoding='utf-8'))
    out = {}
    for room, v in rep.items():
        used = v.get('used', {})
        cl = {}
        for slug, path in used.items():
            var = os.path.basename(path)[:-4]
            k = '%s/%s' % (slug, var)
            cl[slug] = rows_by_key.get(k, {}).get('cls')
        out[room] = cl
    return out

def main():
    import collections
    data = {}
    for t in COLLECT:
        es = COLLECT[t]()
        rows = [row_of(e) for e in es]
        for r, e in zip(rows, es):
            if t == 'pick':
                r['choice'] = e['extra']['choice']
        data[t] = dict(items=rows, summary=summarize([r for r in rows if r['role'] in ('object',)]),
                       all_counts=dict(collections.Counter(r['cls'] for r in rows)))
        if t == 'pick':
            data[t]['compare_v5'] = pick_compare(es)
        if t == 'horror':
            best = collections.defaultdict(list)
            for r in rows:
                if r['role'] == 'object':
                    best[r['key'].split('/')[0]].append(r['cls'])
            item_ok = sum(1 for v in best.values() if 'ok' in v)
            data[t]['per_item'] = dict(items=len(best), at_least_one_variant_ok=item_ok,
                                       all_variants_bad=sum(1 for v in best.values() if 'ok' not in v))
            data[t]['rooms_used'] = horror_room_rows({r['key']: r for r in rows})
        if t == 'school':
            data[t]['unchosen'] = [e['key'] for e in es if not e['extra']['chosen']]
    data['v5']['structure'] = v5_structure(None)
    data['meta'] = dict(criteria=dict(T_FRONT=T_FRONT, T_RIM=T_RIM, F_MIN=F_MIN), classes=CLASS_KO,
                        method='기계 측정(접힘선/밝기 낙차) + 4배 확대 시트 눈 판정 덮어쓰기(row.method=eye, row.why=근거)')
    json.dump(data, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    for t in COLLECT:
        print(t, data[t]['summary'])
    print('pick vs v5', {k: v for k, v in data['pick']['compare_v5'].items() if k != 'rows'})
    print('horror per_item', data['horror']['per_item'])
    print('v5 structure', data['v5']['structure'])


# =================================================================================================
# 자체완결 HTML (data URI)
# =================================================================================================
def annotated(e, cl, m, S=4):
    """4배 확대 + 실루엣 위(녹색)/접힘선(노랑)/아래(빨강) 측정선. 캔버스 왼쪽에 t·f 를 적는다."""
    a = Image.fromarray(e['arr'])
    w, h = a.size
    pad = 44
    im = Image.new('RGBA', (w * S + pad, h * S), (54, 56, 66, 255))
    im.alpha_composite(a.resize((w * S, h * S), Image.NEAREST), (pad, 0))
    d = ImageDraw.Draw(im)
    if m and m['t'] is not None:
        y0 = m['top'] * S; ys = (m['top'] + m['t']) * S; y1 = (m['bottom'] + 1) * S
        d.line([(0, y0), (w * S + pad, y0)], fill=(80, 220, 110, 255), width=1)
        d.line([(0, ys), (w * S + pad, ys)], fill=(255, 220, 60, 255), width=1)
        d.line([(0, y1 - 1), (w * S + pad, y1 - 1)], fill=(240, 80, 80, 255), width=1)
        d.text((2, max(0, y0 + 1)), 't=%d' % m['t'], fill=(80, 220, 110, 255))
        d.text((2, min(h * S - 12, ys + 2)), 'f=%s' % m['f'], fill=(240, 90, 90, 255))
    return im

def pick_samples(es, wanted):
    by = {}
    for e in es:
        by.setdefault(e['key'].split('/')[0], e)
    out = []
    for k in wanted:
        e = by.get(k)
        if e:
            cl, meth, m = judge(e)
            out.append((e, cl, m))
    return out

def cards(items, S=4):
    h = ''
    for e, cl, m in items:
        im = annotated(e, cl, m, S)
        eye = judge(e)[1] == 'eye'
        h += ('<figure class="c %s"><img src="%s" width="%d"><figcaption><b>%s</b> %s<br><span>%s · t=%s f=%s%s</span></figcaption></figure>'
              % (cl, data_uri(im), im.width, e['key'].split('/')[0], e['name'] if e['name'] != e['key'] else '', CLASS_KO.get(cl, cl),
                 m and m['t'], m and m['f'], ' · 눈 판정' if eye else ''))
    return h

def spread(es, n=6):
    c = []
    for e in es:
        cl, meth, m = judge(e)
        if cl == 'ok' and e['role'] == 'object' and m and m['t'] and m['t'] >= 5 and m['f'] and m['f'] >= 6:
            c.append(e)
    step = max(1, len(c) // n)
    return [(e,) + tuple(judge(e)[0::2]) for e in c[::step][:n]]

HTML_HEAD = """<!doctype html><html lang="ko"><meta charset="utf-8"><title>실내 3/4 시점 감사</title>
<style>
body{background:#1b1d24;color:#e6e6ea;font:14px/1.55 system-ui,'Noto Sans KR',sans-serif;margin:24px auto;max-width:1500px;padding:0 20px}
h1{font-size:22px}h2{margin-top:36px;border-bottom:1px solid #444;padding-bottom:4px}h3{margin-top:28px}h4{margin:12px 0 4px;color:#aab}
table{border-collapse:collapse}td,th{border:1px solid #444;padding:5px 10px;text-align:right}td:first-child,th:first-child{text-align:left}
th{background:#2a2d38}.g{color:#7ddf8a}.y{color:#f0d060}.r{color:#f07a7a}
.row{display:flex;flex-wrap:wrap;gap:10px}.c{margin:0;background:#262933;padding:6px;border-radius:4px;border-top:3px solid #666}
.c.ok{border-color:#4cc76a}.c.rim{border-color:#e0c040}.c.front,.c.topdown{border-color:#e05a5a}
.c img{image-rendering:pixelated;display:block}figcaption{font-size:12px;max-width:260px}figcaption span{color:#99a}
.room{margin:0 0 14px}.room img{image-rendering:pixelated;max-width:100%}
.note{background:#262933;padding:10px 14px;border-left:4px solid #6a8;margin:10px 0}.bad{border-color:#e05a5a}
</style>"""

def build_html(out):
    D = json.load(open(OUT_JSON, encoding='utf-8'))
    ES = {t: COLLECT[t]() for t in COLLECT}
    TN = dict(v5='v5 손 도트 실내(381 기물)', pick='18302 찍기 선택(178항목, 고른 후보)', horror='호러 2판 기본 조각(변형 A/B/C/파일럿)', school='학교 교실 조각(68종, 고른 61)')
    rows = ''
    for t in ('v5', 'pick', 'horror', 'school'):
        S_ = D[t]['summary']; c = S_['counts']
        rows += ('<tr><td>%s</td><td>%d</td><td class="g">%d</td><td class="y">%d</td><td class="r">%d</td><td class="r">%d</td><td>%d</td><td><b>%.0f%%</b></td></tr>'
                 % (TN[t], S_['checked'], S_['ok'], S_['rim'], S_['front'], S_['topdown'], sum(c.get(k, 0) for k in ('flat', 'wallface', 'ceil')), 100 * S_['pass_rate']))
    W = {
        'v5': ['157', '166', '235', '238', '250', '291', '280', '239'],
        'horror': ['hosp_bed', 'grandfather_clock', 'iv_stand', 'pillar_marble', 'bookshelf_manor', 'medicine_cabinet', 'wardrobe_ajar', 'piano_dusty'],
        'school': ['vending_school', 'locker_row', 'library_shelf', 'lab_cabinet', 'school_gate', 'shoe_locker', 'broadcast_desk', 'copier'],
    }
    fr = [e for e in ES['pick'] if judge(e)[0] == 'front' and e['role'] == 'object']
    W['pick'] = [e['key'] for e in fr[:8]]
    body = ''
    for t in ('v5', 'pick', 'horror', 'school'):
        body += '<h3>%s</h3><h4>위반 표본 (4배, 녹색=실루엣 위, 노랑=윗면/앞면 경계, 빨강=아래)</h4><div class="row">%s</div>' % (TN[t], cards(pick_samples(ES[t], W[t])))
        body += '<h4>준수 표본</h4><div class="row">%s</div>' % cards(spread(ES[t]))
    rooms = ''
    for nm in ('bakery', 'tavern', 'inn', 'throne'):
        pth = os.path.join(V5_MAPS, 'render', nm + '.png')
        if os.path.exists(pth):
            rooms += '<figure class="room"><img src="%s"><figcaption>v5 %s</figcaption></figure>' % (data_uri(Image.open(pth).convert('RGB'), 3), nm)
    for nm in ('manor_hall-A', 'gallery_room-A', 'ward_room-A'):
        pth = os.path.join(ROOT, 'tiledata/atlas-pick/rooms-horror', nm + '.png')
        rooms += '<figure class="room"><img src="%s"><figcaption>호러 %s</figcaption></figure>' % (data_uri(Image.open(pth).convert('RGB'), 2), nm)
    rooms += '<figure class="room"><img src="%s"><figcaption>학교 교실 조립(교실 조각만, 천장 조각 없음)</figcaption></figure>' % data_uri(school_composite().convert('RGB'), 4)
    pc = D['pick']['compare_v5']; st = D['v5']['structure']; hp = D['horror']['per_item']
    caps = sorted(set(v for v in st['cap_px_in_renders'].values() if v))
    mid = """
<h1>실내 3/4 시점 감사 — v5 · 18302 찍기 · 호러 · 학교</h1>
<p>기준: 벽 = 위 천장 윗면 띠 + 앞면 2칸, 기물 = 윗면(발자국 깊이) + 앞면. 윗면 없는 앞면 판은 위반(정면도). 바닥 무늬·깔개·벽걸이는 면제.
측정: 조각 그림에서 윗면(t)과 앞면(f) 픽셀. t&le;1 정면도, 2~4 윗면 부족(띠), f&lt;3 탑다운. 기계 측정을 4배 확대 눈 판정으로 덮어쓴 항목은 「눈 판정」 표시.</p>
<h2>1. 대상별 준수율 (기물 기준, 면제·구조 조각 제외)</h2>
<table><tr><th>대상</th><th>검사 대상</th><th>3/4 준수</th><th>윗면 부족</th><th>정면도</th><th>탑다운</th><th>면제</th><th>준수율</th></tr>%s</table>
<div class="note bad"><b>가장 큰 위반 = 정면도.</b> 벽에 붙는 키 큰 가구(옷장·벽난로·빵 선반·주방 화덕·기둥·왕좌·고해소·병상 계열)가 앞면 판만 있고 윗면이 없다. 바닥에 놓이는 탁자·상자·침대·카운터는 대체로 준수.
호러: 준수 변형이 있는 조각은 52종 중 %d종뿐(나머지 %d종은 A/B/C 어느 변형도 위반). 학교: 사물함·서가·자판기가 정면도, 책상·교탁·카운터는 준수.</div>
<h2>2. 구조(v5)</h2>
<ul><li>벽 %d종, 전부 앞면 %s px(%s칸) 뿐 — 천장 윗면 조각이 아예 없다.</li>
<li>천장 %d종은 단색 평면 채움. 렌더러가 얹는 윗면 띠는 방 렌더 실측 <b>%s px</b>(기준 16px 이상 필요, 옆벽은 3px 선).</li>
<li>기물 %d 중 벽 밀착형 %d, 덮개(overhang) 있는 것 %d, 그림자 반투명 픽셀이 있는 스프라이트 <b>%d</b>(바닥 그림자 거의 없음).</li></ul>
<h2>3. 18302 찍기가 3/4 을 고쳤나</h2>
<p>고른 후보 vs v5.png 기준선(같은 측정기, t 2px 이상 변화): 개선 <b>%d</b> · 동일 <b>%d</b> · 후퇴 <b>%d</b> · 측정 불가/기준선 유지 %d. 고른 결과에 정면도 %d건이 그대로 남아 있어 찍기 과정은 시점 문제를 못 고쳤다(같은 설계 언어).</p>
<h2>4. 방 단위 판정</h2>
<div class="note bad">벽은 모두 「2칸 앞면 + 얇은 윗면 띠(약 4px) + 단색 천장」. 벽 윗면이 두꺼운 천장 슬래브로 읽히지 않아 방 전체가 정면 입면도 느낌. 바닥에 놓이는 탁자·침대는 3/4 로 읽히나 벽 가구는 판자처럼 서 있다. 학교 교실 조립: 천장 조각이 없어 검정 위에 벽 앞면이 바로 붙고, 사물함은 정면 판, 책상·교탁만 3/4.</div>
%s
<h2>5. 표본</h2>%s
</html>""" % (rows, hp['at_least_one_variant_ok'], hp['all_variants_bad'],
             st['walls'], st['wall_face_px'], st['wall_face_rows'], st['ceiling_kinds'], caps,
             st['total_objects'], st['wall_hugging_objects'], st['objects_with_overhang'], st['sprites_with_soft_shadow'],
             pc['better'], pc['same'], pc['worse'], pc['skipped'], D['pick']['summary']['front'], rooms, body)
    open(out, 'w', encoding='utf-8').write(HTML_HEAD + mid)
    print('html', out, len(HTML_HEAD + mid) // 1024, 'KB')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet')
    ap.add_argument('--stats', action='store_true')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--html')
    ap.add_argument('--object', nargs='+', metavar='PNG', help='벽 붙이가 아닌 기물 PNG 를 t/f 로 판정(접힘선 측정 — 참고값, 눈 판정이 최종)')
    ap.add_argument('--wall-tall', nargs='+', metavar='PNG', help='11-2 벽 붙이 키 큰 가구 PNG 를 T/F 표로 판정(후보 검수용)')
    a = ap.parse_args()
    if a.object:
        bad = 0
        for f in a.object:
            m = measure(np.array(load_png(f)))
            cl = classify(m) if m else 'unclear'
            bad += cl != 'ok'
            print('%-7s t=%s f=%s  %s' % (cl, m and m['t'], m and m['f'], f))
        sys.exit(1 if bad else 0)
    if a.wall_tall:
        bad = 0
        for f in a.wall_tall:
            mt = measure_wall_tall(np.array(load_png(f)))
            cl = classify_wall_tall(mt) if mt else 'unclear'
            bad += cl != 'ok'
            print('%-6s t=%s f=%s  %s' % (cl, mt and mt['t'], mt and mt['f'], f))
        sys.exit(1 if bad else 0)
    if a.sheet:
        make_sheets(a.sheet)
    if a.stats:
        import collections
        for t in COLLECT:
            c = collections.Counter()
            for e in COLLECT[t]():
                cl, meth, m = judge(e); c[cl] += 1
            print(t, dict(c))
    if a.json or not (a.sheet or a.stats or a.html):
        main()
    if a.html:
        build_html(a.html)
