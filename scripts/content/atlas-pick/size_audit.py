#!/usr/bin/env python3
"""칸수 전수 점검 — 기물마다 이름으로 §12 표 종류를 골라 「현재 칸」과 「표 칸」을 견준다.

  python3 scripts/content/atlas-pick/size_audit.py          # tiledata/atlas-pick/size-audit.json 갱신 + 요약 출력

범위: 현대(modern)·일본(jp)·학원(school)·호러(horror) 의 물체 층(layer=object) 기물. 월드맵은 필드 축척이라 제외,
바닥·벽·파사드 같은 지형 층·조립형 킷 부품도 제외(칸수가 주인공 축척이 아니라 무대 격자 기준).
판정: ok / too_small / too_big / mixed(가로는 작고 세로는 큰 식) / unclear(표에 맞는 종류를 이름만으로 못 고름).
scale_exempt(차·가로등·전봇대·가로수)는 축약이 관례라 판정은 내되 exempt=true 로 따로 집계한다.
"""
import json, os, sys
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, BASE, items, cand_dir, read_json
import size_calc as sc

TABLE = {r['id']: r for r in sc.rows()}

# slug → 표 id | (W, D, H, kind, 이름) 직접 치수(표에 없는 물건, 근거 = 통상 실물 치수 추정) | None(unclear)
# alt = 다른 해석(쌍·세트)일 때의 표 id
MAP = {
 # ── 현대
 'gn_bus': 'bus_v', 'gn_car_h': 'car_h', 'gn_car_v': 'car_v', 'mo_ped_signal': 'ped_signal',
 'gn_delivery_scooter': (1.8, 0.6, 1.1, 'free', '배달 오토바이'),
 'gn_media_pole': (0.5, 0.4, 2.5, 'thin', '미디어폴'),
 'gn_ginkgo': 'tree_street', 'gn_plane_tree': 'tree_street',
 'gn_fishbun_cart': (1.2, 0.8, 1.6, 'free', '붕어빵 노점 수레'), 'gn_street_stall': (2.0, 1.2, 2.0, 'free', '포장마차'),
 'mo_bench': 'bench', 'mo_hydrant': 'hydrant', 'mo_trash': 'street_trash',
 'mo_planter': (0.8, 0.4, 0.5, 'free', '화분 상자'), 'mo_cone': (0.35, 0.35, 0.7, 'free', '라바콘'),
 'gn_trash_bags': (0.6, 0.5, 0.5, 'free', '종량제 봉투 더미'),
 'gn_wall_ac': (0.8, 0.3, 0.6, 'free', '벽걸이 실외기'),
 'gn_vent': (1.6, 0.8, 0.9, 'free', '지하철 환기구'),
 'gn_bike_share': (2.7, 0.6, 1.0, 'free', '공공자전거 거치대(3대)'),
 'mo_sculpture': (1.0, 1.0, 1.8, 'free', '광장 조형물'),
 # ── 일본
 'vending_drink': ('vending_1', 'vending_pair'), 'vending_cig': ('vending_1', 'vending_pair'),
 'vending_coffee': ('vending_1', 'vending_pair'), 'vending_ice': ('vending_1', 'vending_pair'),
 'vending_gacha': 'vending_pair',
 'konbini_pole': (0.5, 0.5, 4.0, 'thin', '콘비니 기둥 간판'),
 'taxi_black': 'car_v', 'taxi_yellow': 'car_v', 'ped_signal': 'ped_signal', 'utility_pole': 'utility_pole',
 'jp_signal': (2.5, 0.4, 5.0, 'thin', '가로형 신호등'),
 'ac_unit': (0.8, 0.3, 0.6, 'free', '실외기'), 'mamachari': 'bicycle',
 'potted_plants': (1.8, 0.4, 0.7, 'free', '화분 줄'), 'curve_mirror': (0.7, 0.2, 3.0, 'thin', '도로 반사경'),
 'tomare_sign': 'road_sign', 'mailbox_red': 'mailbox', 'phone_booth': (0.8, 0.8, 2.0, 'free', '공중전화 부스'),
 'bus_stop_jp': 'road_sign', 'standing_sign': 'a_frame_sign',
 'stone_lantern': (0.8, 0.8, 1.6, 'free', '석등'), 'komainu_a': (0.5, 0.7, 0.9, 'free', '고마이누'), 'komainu_un': (0.5, 0.7, 0.9, 'free', '고마이누'),
 'fox_statue': (0.6, 0.6, 1.0, 'free', '여우 석상'), 'sakura_tree': 'tree_street',
 'saisen_box': (1.5, 0.8, 1.3, 'free', '새전함'), 'bicycle_parking': (2.5, 1.8, 1.0, 'free', '자전거 주차(3대)'),
 'garbage_station': (1.8, 0.8, 1.0, 'free', '쓰레기 집하장'),
 # ── 호러(저택·병원·폐교·묘지)
 'grandfather_clock': 'grandfather_clock', 'table_wood': 'table_dining', 'chair_wood': 'chair', 'chair_wood_back': 'chair',
 'bookshelf_manor': 'bookshelf', 'bed_manor': 'bed_single', 'dresser': 'chest_dresser', 'side_table': 'table_small',
 'hosp_bed': 'bed_single', 'medicine_cabinet': (0.7, 0.3, 1.2, 'wall', '약장'), 'bedside_cabinet': 'low_dresser',
 'hosp_chair': 'chair', 'ward_sink': (0.6, 0.5, 0.85, 'free', '세면대'), 'piano_dusty': 'piano_upright',
 'sofa_sheet': 'sofa', 'armchair_sheet': (0.9, 0.85, 0.9, 'free', '안락의자'), 'canopy_bed_rot': 'canopy_bed_rot',
 'wardrobe_ajar': 'wardrobe_1', 'bookshelf_fallen': None, 'fireplace_cold': 'fireplace', 'shelf_cellar': 'bookshelf',
 'broken_desk': 'school_desk', 'broken_locker': 'locker_2door', 'bench_gallery': 'bench',
 'gravestone_cross': (0.7, 0.2, 1.1, 'free', '십자 비석'), 'gravestone_round': (0.6, 0.2, 0.8, 'free', '둥근 비석'),
 'pillar_stone': (0.8, 0.8, 3.0, 'free', '돌기둥'),
 'wheelchair': 'wheelchair', 'operating_table': 'operating_table',
 'iron_fence': 'guardrail', 'doll_sitting': (0.4, 0.4, 0.5, 'free', '앉은 인형'), 'music_box': (0.3, 0.2, 0.2, 'free', '오르골'),
 # ── 학원
 'desk_set': (0.6, 0.9, 0.9, 'free', '학생 책상+의자'), 'desk_pair': (1.2, 0.5, 0.75, 'free', '두 사람 책상'), 'lectern': (1.3, 0.6, 1.0, 'free', '교탁'),
 'locker_row': 'locker_row6', 'cleaning_locker': 'locker_2door', 'shoe_locker': (1.8, 0.35, 1.0, 'wall', '신발장'),
 'lab_bench': (2.0, 0.9, 0.9, 'free', '실험대'), 'lab_cabinet': 'lab_cabinet', 'skeleton_model': (0.5, 0.5, 1.7, 'thin', '골격 모형'),
 'grand_piano': (1.5, 2.0, 1.0, 'free', '그랜드 피아노'), 'easel': (0.6, 0.6, 1.6, 'thin', '이젤'),
 'library_shelf': 'bookshelf_tall', 'library_counter': 'counter', 'nurse_bed': 'bed_single',
 'staff_desks': (2.8, 1.4, 0.75, 'free', '교무실 책상 섬'), 'copier': (0.7, 0.7, 1.0, 'free', '복사기'),
 'broadcast_desk': (2.0, 0.8, 0.9, 'free', '방송실 조정대'), 'gym_mat': None, 'vaulting_box': (1.2, 0.6, 1.1, 'free', '뜀틀'),
 'ball_basket': (0.6, 0.6, 0.8, 'free', '공 바구니'), 'cafeteria_table': (2.4, 0.9, 0.72, 'free', '급식 식탁'),
 'serving_counter': (2.4, 0.7, 1.0, 'free', '배식대'), 'kiosk_counter': 'counter', 'milk_crate': 'crate',
 'vending_school': 'vending_1', 'bunk_bed': (1.0, 2.0, 1.7, 'free', '이층 침대'), 'dorm_desk': 'office_desk',
 'dorm_closet': 'wardrobe_1', 'water_fountain': (1.0, 0.5, 0.9, 'free', '복도 세면대'), 'height_scale': (0.6, 0.5, 1.9, 'thin', '신장계'),
 'plaster_bust': (0.4, 0.4, 1.4, 'thin', '석고상 받침 포함'), 'music_stand': (0.5, 0.4, 1.2, 'thin', '보면대'),
 'water_tank': None, 'school_gate': None,
}

def spec_of(v):
    """MAP 값 → (근거 dict, 표 id or None)."""
    if isinstance(v, str):
        r = TABLE[v]; return dict(kind=r['kind'], W=r['W'], D=r['D'], H=r['H'], table=v, name=r['name'], scale_exempt=bool(r.get('scale_exempt')), src='표'), sc.calc(r['W'], r['D'], r['H'], r['kind'], r.get('c'))
    W, D, H, kind, nm = v
    return dict(kind=kind, W=W, D=D, H=H, table=None, name=nm, scale_exempt=False, src='통상 치수 추정(표 밖)'), sc.calc(W, D, H, kind)

def drawn_of(st, slug, picks, canvas):
    """고른 후보(없으면 h34-A → v34-A → 첫 PNG)의 불투명 bbox 크기. 잰 근거 파일도 돌려준다."""
    from PIL import Image
    d = os.path.join(cand_dir(st), slug)
    ch = (picks.get(slug) or {}).get('choice')
    for stem in [ch, 'h34-A', 'v34-A'] + sorted(f[:-4] for f in (os.listdir(d) if os.path.isdir(d) else []) if f.endswith('.png') and not f.endswith('-x4.png') and 'ctx' not in f and 'check' not in f):
        if not stem: continue
        p = os.path.join(d, stem + '.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            if list(im.size) != list(canvas): continue   # 캔버스가 다른 PNG(옛 크기·맥락 합성)는 재지 않는다
            b = im.getchannel('A').getbbox()
            return dict(file=stem, w=(b[2] - b[0]) if b else 0, h=(b[3] - b[1]) if b else 0)
    return None

def verdict(cur, spec):
    dw, dh = cur[0] - spec[0], cur[1] - spec[1]
    if dw == 0 and dh == 0: return 'ok'
    if dw <= 0 and dh <= 0: return 'too_small'
    if dw >= 0 and dh >= 0: return 'too_big'
    return 'mixed'

def main():
    out, summary = [], {}
    for st in ('modern', 'jp', 'school', 'horror'):
        picks = read_json(os.path.join(BASE, f'picks-{st}.json'), {}) or {}
        for it in items(st):
            if it.get('layer') != 'object': continue
            slug = it['slug']
            v = MAP.get(slug, 'MISSING')
            row = dict(set=st, slug=slug, name=it['name'], current=it['cells'], canvas=it['canvas'])
            if it.get('movedTo'): row['movedTo'] = it['movedTo']   # 조립형 킷으로 옮겨진 기물(참고용)
            if v == 'MISSING' or v is None:
                row.update(spec=None, verdict='unclear', basis=None,
                           reason='이름만으로 표 종류를 못 고른다(조립형·복합 구조물·지형 성격)' if v is None else '표 종류를 정하지 않음(장면 조각·조립 부품 성격)')
            else:
                alt = None
                if isinstance(v, tuple) and len(v) == 2 and all(isinstance(x, str) for x in v): v, alt = v
                basis, c = spec_of(v)
                row.update(spec=c['cells'], verdict=verdict(it['cells'], c['cells']), exempt=basis['scale_exempt'],
                           basis=dict(basis, wpx=c['wpx'], F=c['F'], T=c['T'], total=c['total'], spec_canvas=c['canvas']))
                if alt:
                    b2, c2 = spec_of(alt); row['alt'] = dict(table=alt, name=b2['name'], spec=c2['cells'], verdict=verdict(it['cells'], c2['cells']), note='쌍(두 대) 해석')
            dr = drawn_of(st, slug, picks, it['canvas'])
            if dr: row['drawn'] = dr
            out.append(row)
            s = summary.setdefault(st, dict(total=0, ok=0, too_small=0, too_big=0, mixed=0, unclear=0, exempt=0))
            s['total'] += 1; s[row['verdict']] += 1
            if row.get('exempt'): s['exempt'] += 1
    tot = {k: sum(s[k] for s in summary.values()) for k in ('total', 'ok', 'too_small', 'too_big', 'mixed', 'unclear', 'exempt')}
    doc = dict(version=1, rule='modern-style-bible.md §12 (1칸=16px=1m, 주인공 16x24 는 1.5m 축척 모순 기록)', scope='modern·jp·school·horror 물체층 기물(월드맵·지형·조립 킷 제외)',
               verdicts='ok=칸수 일치 / too_small=가로·세로 모두 표보다 작음 / too_big=모두 큼 / mixed=한쪽 작고 한쪽 큼 / unclear=표 종류 미정. exempt=차·가로등·전봇대·가로수 등 축약이 관례라 따로 센다.',
               summary=dict(by_set=summary, total=tot), items=out)
    (Path(BASE) / 'size-audit.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps(doc['summary'], ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
