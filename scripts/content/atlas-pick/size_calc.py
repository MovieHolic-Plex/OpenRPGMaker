#!/usr/bin/env python3
"""칸수 계산기 — 1칸 = 16px = 1m (modern-style-bible.md §12, 2026-09-30 사용자 확정).

  기준: 1 m = 16 px (한 칸 = 1 m). 주인공은 16x24 그대로(발자국 1칸). 주인공 24px 는 이 축척으론 1.5 m 다 —
        실사 170 cm 와 모순이지만 주인공은 축약 캐릭터라 그대로 두고, 표는 히어로가 아니라 「1칸 = 1 m」 에 묶는다.
  캔버스 폭(칸) = ceil(실제 폭 m)              (폭 px = W x 16 이 칸 경계에 그대로 맞는다. 1px 넘는 것만 1px 깎는다)
  앞면 F px     = 실제 높이 H(m) x 16
  윗면 T px     = 실제 깊이 D(m) x 16 x 압축계수 c   (원본 T0 = D x 16, 압축값 = T0 x c, 종류별 T 하한·상한 아래 KINDS)
  높이 칸 N     : F+T 가 16xN 에 들어가야 한다. N0 = ceil(F/16) 부터 늘려 가며 처음 들어가는 N.
                  넘치면(overflow o = F+T-16N) 아래 순서로 양보시킨다 — 단 o <= 6px 일 때만:
                    1) T 를 종류의 하한(tmin)까지 줄인다   2) 그래도 남으면 F 를 줄인다(F 는 최대 4px, 그리고 F 의 15% 이내)
                  F 를 그만큼 못 줄이면(서랍장: 16px 에서 4px = 25%) 그 N 은 포기하고 N+1.
                  → 「윗면(T)이 먼저 양보하고, 앞면(F)은 4px·15% 까지만」. 키 2 m(=32px)는 딱 2칸이라 T 4 를 위해 F 28 로 깎는다.
  막힘(blocked)  = 바닥 발자국 = 폭 칸 x 깊이 칸(max(1, round(D))). 벽 붙은 가구·기둥은 1. 그 위 칸은 walk-behind(over).

사용:
  python3 scripts/content/atlas-pick/size_calc.py 1.0 0.8 1.83            # 한 물건 (W D H, 종류 기본 free)
  python3 scripts/content/atlas-pick/size_calc.py 1.0 0.6 2.0 --kind wall
  python3 scripts/content/atlas-pick/size_calc.py --table                  # 표 출력
  python3 scripts/content/atlas-pick/size_calc.py --json                   # tiledata/atlas-pick/size-table.json 갱신
"""
import argparse, json, math, sys
from pathlib import Path

PX_PER_M = 16          # 1 칸 = 16 px = 1 m (사용자 확정 2026-09-30, 이전 잠정 기준은 14 px/m)
CELL = 16
HERO_PX, HERO_W_PX = 24, 16
HERO_M_BY_SCALE = HERO_PX / PX_PER_M      # 1.5 m — 실사 170 cm 와 모순(§12-1)
MAX_SHAVE = 6          # 한 칸 아끼려고 양보시킬 수 있는 총 높이(px)
MAX_F_CUT, MAX_F_CUT_RATIO = 4, 0.15
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'tiledata/atlas-pick/size-table.json'

# 종류: 압축계수 c, T 하한/상한(px), 발자국 깊이 방식
#   wall    벽 붙은 키 큰 가구(옷장·책장·냉장고·사물함): c=.6, T 4~6 (§11-1 「벽 붙은 키 큰 가구 T 4~6」)
#   free    자립 가구·소품(탁자·침대·자판기·벤치): c=.6 (침대·긴 판은 .5), T 하한 4, 상한 없음
#   thin    가는 기둥(가로등·전주·표지): c=.5, T 2 이상 — 검사기 EXEMPT
#   flat    벽 부착 평면(칠판·액자): T=0
#   veh_h   가로 진행 차(옆면+윗면): c=.30, T 하한 6 (§10-3 실측 T7 F29)
#   veh_v   세로 진행 차(앞뒤면+긴 지붕): c=.65 (§10-3 실측 T41 F14)
KINDS = {
    'wall':  dict(c=.6, tmin=4, tmax=6, bd_one=True),
    'free':  dict(c=.6, tmin=4, tmax=None),
    'thin':  dict(c=.5, tmin=2, tmax=None, bd_one=True),
    'flat':  dict(c=0., tmin=0, tmax=0, bd_one=True),
    'veh_h': dict(c=.30, tmin=6, tmax=None),
    'veh_v': dict(c=.65, tmin=6, tmax=None),
}


def rnd(x):
    return int(math.floor(x + 0.5))


def calc(W, D, H, kind='free', c=None):
    """실제 크기(m) → 칸수·px·T·F·막힘. 압축 전(F_raw·T_raw)과 압축 값(T_c)도 함께 돌려준다."""
    k = KINDS[kind]; cc = k['c'] if c is None else c
    wpx = max(1, rnd(W * PX_PER_M)); F0 = max(1, rnd(H * PX_PER_M)); T_raw = rnd(D * PX_PER_M)
    tmin, tmax = k['tmin'], k['tmax']
    T_c = 0 if kind == 'flat' else T_raw * cc
    T = 0 if kind == 'flat' else max(tmin, rnd(T_c))
    if tmax is not None: T = min(tmax, T)
    T_fit = T                                     # 종류 하한·상한을 적용한 압축 T (칸 맞추기 전)
    F = F0; trims = []
    N = max(1, math.ceil(F0 / CELL))
    while True:
        o = F + T - CELL * N
        if o <= 0: break
        if o <= MAX_SHAVE:
            dt = min(o, T - tmin); rest = o - dt
            if rest <= MAX_F_CUT and rest <= MAX_F_CUT_RATIO * F:
                T -= dt; F -= rest
                trims.append(f'높이 {o}px 초과 → ' + ', '.join(x for x in ((f'T -{dt}' if dt else ''), (f'F -{rest}' if rest else '')) if x))
                break
        N += 1
    cw = max(1, math.ceil(W - 1e-9))
    if cw > 1 and wpx - CELL * (cw - 1) == 1:     # 폭이 칸 경계를 1px 넘는다 → 1px 줄인다
        wpx -= 1; cw -= 1; trims.append('폭 1px 초과 → -1px')
    if wpx > CELL * cw: wpx = CELL * cw
    bd = 1 if k.get('bd_one') else max(1, rnd(D)); bd = min(bd, N)
    return dict(wpx=wpx, F_raw=F0, T_raw=T_raw, T_c=round(T_c, 1), F=F, T=T, total=F + T, cells=[cw, N], canvas=[cw * CELL, N * CELL],
                blocked=[cw, bd], walkbehind_rows=N - bd, kind=kind, c=cc, trims=trims)


# id, 이름, 실내/실외, W, D, H(m), 종류, (선택) c, 메모, scale_exempt(True: 게임 문법상 축약이 관례 — 판정은 별도 집계)
T = [
    # ── 실내 ──
    ('wardrobe_1', '옷장(1인)', '실내', 1.0, 0.6, 2.0, 'wall', None, '기준 예시(감독자). 호러 wardrobe_ajar 도 이 규격', False),
    ('wardrobe_2', '옷장(2문 큰 것)', '실내', 1.6, 0.6, 2.0, 'wall', None, '폭 1.6m', False),
    ('chest_dresser', '서랍장(3단 높은 것)', '실내', 1.0, 0.5, 1.0, 'free', None, '호러 dresser: 1x2 (옛 1x1 은 너무 납작)', False),
    ('low_dresser', '서랍장(낮은 것)', '실내', 1.1, 0.45, 0.8, 'free', None, '폭 15px → 1칸', False),
    ('bookshelf', '책장(보통)', '실내', 0.9, 0.3, 1.8, 'wall', None, '깊이가 얕아 T 는 하한 4', False),
    ('bookshelf_tall', '책장(천장 닿는 것)', '실내', 0.9, 0.35, 2.2, 'wall', None, '', False),
    ('locker_2door', '사물함(2칸 문)', '실내', 0.6, 0.5, 1.8, 'wall', None, '학교 사물함 낱개. 폭 1칸', False),
    ('locker_row6', '사물함 줄(6문)', '실내', 1.8, 0.5, 1.8, 'wall', None, '문 수에 따라 폭이 변한다: 문 0.3m x 6', False),
    ('lab_cabinet', '약품장(4문)', '실내', 1.5, 0.45, 1.8, 'wall', None, '위 유리문 2 + 아래 문 2', False),
    ('fridge', '냉장고(소형)', '실내', 0.7, 0.7, 1.7, 'wall', None, '', False),
    ('fridge_big', '냉장고(대형)', '실내', 0.9, 0.75, 1.8, 'wall', None, '', False),
    ('bed_single', '침대(1인)', '실내', 1.0, 2.0, 0.5, 'free', .5, '머리판 높이는 별도 조각으로. 깊이 2m 가 T 를 만든다', False),
    ('bed_double', '침대(2인)', '실내', 1.5, 2.0, 0.55, 'free', .5, '', False),
    ('table_dining', '식탁', '실내', 1.5, 0.9, 0.72, 'free', None, '', False),
    ('table_small', '작은 탁자', '실내', 0.8, 0.8, 0.7, 'free', None, '', False),
    ('school_desk', '학생 책상', '실내', 0.6, 0.45, 0.75, 'free', None, '의자는 별도', False),
    ('office_desk', '사무 책상', '실내', 1.4, 0.7, 0.75, 'free', None, '', False),
    ('chair', '의자(등받이)', '실내', 0.45, 0.45, 0.9, 'free', .5, '좌판 T + 다리·등받이 F', False),
    ('sofa', '소파(2인)', '실내', 1.6, 0.9, 0.85, 'free', None, '', False),
    ('counter', '카운터·판매대', '실내', 2.0, 0.6, 1.0, 'free', None, '', False),
    ('kitchen_counter', '주방 조리대', '실내', 1.8, 0.6, 0.9, 'free', None, '', False),
    ('piano_upright', '업라이트 피아노', '실내', 1.5, 0.6, 1.25, 'free', None, '', False),
    ('grandfather_clock', '괘종시계', '실내', 0.5, 0.35, 2.0, 'wall', None, '', False),
    ('fireplace', '벽난로', '실내', 1.6, 0.5, 1.2, 'wall', None, '', False),
    ('potted_plant', '화분(중형)', '실내', 0.4, 0.4, 0.8, 'free', .5, '', False),
    ('trash_can', '쓰레기통(실내)', '실내', 0.4, 0.4, 0.6, 'free', None, '', False),
    ('bathtub', '욕조', '실내', 1.6, 0.75, 0.55, 'free', .5, '', False),
    ('toilet', '변기', '실내', 0.4, 0.7, 0.8, 'free', .5, '', False),
    ('washing_machine', '세탁기', '실내', 0.6, 0.6, 0.85, 'free', None, '', False),
    ('coffin', '관(호러)', '실내', 0.7, 2.0, 0.6, 'free', .5, '', False),
    ('crate', '상자(작은 것)', '실내', 0.5, 0.5, 0.5, 'free', None, '', False),
    ('barrel', '통·항아리', '실내', 0.6, 0.6, 0.9, 'free', None, '', False),
    ('canopy_bed_rot', '캐노피 침대(썩은 천개)', '실내', 1.5, 2.0, 2.2, 'free', .5, '호러 v35-B: 기둥 높이 2.2m 라 F35 → 2x3(32x48). 위 천 지붕이 T, 늘어진 천·기둥·발판이 F', False),
    ('wheelchair', '휠체어', '실내', 0.85, 1.0, 0.9, 'free', .25, '호러 v35-B: 1x1. 실물 전폭 0.65 이나 10px 로는 바퀴·좌면이 안 읽혀 0.85(14px)로 축약, 깊이 1.0 은 발판까지지만 앉는 판은 열린 틀이라 c=.25 (T4)', False),
    ('operating_table', '수술대', '실내', 2.0, 0.6, 0.9, 'free', None, '호러 v35-B: 2x1 가로형. 긴 판 T4 + 앞면 F12 (T4 는 tmin)', False),
    ('door', '문(벽 부착)', '실내', 1.0, 0.1, 2.0, 'flat', None, '벽면에 붙은 평면. 1x2', False),
    ('blackboard', '칠판(벽 부착)', '실내', 3.6, 0.05, 1.2, 'flat', None, '평면 부착. T 없음', False),
    # ── 실외 ──
    ('vending_1', '자판기(1대)', '실외', 1.0, 0.8, 1.8, 'free', None, '일본 자판기 표준 W1.0 D0.8 H1.8. 1x2 (충돌 기록: §12-6)', False),
    ('vending_pair', '자판기 2대 나란히', '실외', 2.0, 0.8, 1.8, 'free', None, '사용자 「일본 자판기는 2x2」 는 이렇게 읽는다: 두 대 한 벌', False),
    ('mailbox', '우체통(원통)', '실외', 0.5, 0.5, 1.1, 'free', None, '', False),
    ('bench', '벤치(2인)', '실외', 1.5, 0.5, 0.85, 'free', None, '', False),
    ('street_trash', '가로 쓰레기통', '실외', 0.5, 0.5, 0.9, 'free', None, '', False),
    ('a_frame_sign', 'A형 입간판', '실외', 0.6, 0.5, 1.0, 'free', None, '', False),
    ('phone_booth', '공중전화 부스', '실외', 1.0, 1.0, 2.3, 'free', None, '', False),
    ('hydrant', '소화전', '실외', 0.3, 0.3, 0.7, 'thin', None, '', False),
    ('bicycle', '자전거', '실외', 1.8, 0.55, 1.0, 'free', .5, '', False),
    ('guardrail', '가드레일 한 마디', '실외', 2.0, 0.1, 0.8, 'thin', None, '', False),
    ('road_sign', '도로 표지(기둥+판)', '실외', 0.6, 0.1, 2.5, 'thin', None, '', False),
    ('ped_signal', '보행 신호기', '실외', 0.4, 0.3, 2.5, 'thin', None, '', False),
    ('street_lamp', '가로등', '실외', 0.3, 0.3, 4.5, 'thin', None, '실측 64px+. 4칸 이상은 화면 관례상 위를 화면 밖으로', True),
    ('traffic_light', '차량 신호등(기둥)', '실외', 0.4, 0.4, 5.5, 'thin', None, '', True),
    ('utility_pole', '전봇대', '실외', 0.3, 0.3, 10.0, 'thin', None, '실측 140px(9칸). 타일 게임은 위를 자른다', True),
    ('car_h', '승용차·택시(가로)', '실외', 4.4, 1.8, 1.45, 'veh_h', None, '§10-3 64x36 (T7 F29) 와 거의 일치: 표는 64x32', True),
    ('car_v', '승용차·택시(세로)', '실외', 1.8, 4.4, 1.45, 'veh_v', None, '§10-3 28x56 (T41 F14) 와 비슷: 표는 32x64', True),
    ('bus_h', '시내버스(가로)', '실외', 10.5, 2.5, 3.1, 'veh_h', None, '', True),
    ('bus_v', '시내버스(세로)', '실외', 2.5, 10.5, 3.1, 'veh_v', None, '', True),
    ('tree_street', '가로수', '실외', 3.0, 3.0, 6.0, 'flat', None, '수관이 곧 덩이(T 없음). 실측 42x84. §10-3 의 32x48 은 축약 관례', True),
]

COLS = ('id', 'name', 'group', 'W', 'D', 'H', 'kind', 'c_override', 'note', 'scale_exempt')


def rows():
    out = []
    for t in T:
        r = dict(zip(COLS, t))
        res = calc(r['W'], r['D'], r['H'], r['kind'], r['c_override'])
        r.pop('c_override')
        r.update(res)
        out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('dims', nargs='*', type=float, help='W D H (m)')
    ap.add_argument('--kind', default='free', choices=list(KINDS))
    ap.add_argument('--c', type=float, default=None, help='압축계수 직접 지정(가구 .5~.7)')
    ap.add_argument('--table', action='store_true'); ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    if a.json or a.table:
        rs = rows()
        if a.json:
            OUT.write_text(json.dumps(dict(
                basis=dict(hero_px=[HERO_W_PX, HERO_PX], hero_m_by_scale=HERO_M_BY_SCALE, hero_m_real=1.70, px_per_m=PX_PER_M, cell_px=CELL, cell_m=1.0,
                           contradiction='히어로 24px 는 1칸=1m 축척으로 1.5m — 실사 170cm 와 어긋난다. 히어로는 축약 캐릭터로 그대로 두고 표는 1칸=1m 에 묶는다.',
                           kinds=KINDS,
                           rules=['폭 칸 = ceil(W m), 폭px = W*16 (1px 넘으면 1px 깎음)', 'F = H*16', 'T0(원본) = D*16, T = T0*c (하한·상한은 kinds)', '높이 칸 N: N0=ceil(F/16) 부터 F+T<=16N 이 되는 첫 N',
                                  '넘침 o<=6px 이면 T 를 tmin 까지 → 남으면 F 를 (<=4px, <=15%) 깎아 N 유지, 아니면 N+1', '막힘 = 폭 칸 x 깊이 칸(max(1,round(D)), wall·thin 은 1), 나머지는 walk-behind']),
                rows=rs), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
            print('쓴 파일', OUT.relative_to(ROOT), len(rs), '행')
        else:
            for r in rs:
                print('%-18s %-4s %4.2fx%4.2fx%4.2f  폭%2d F%3d(원%3d) T%2d(원%2d 압%4.1f)  칸 %dx%d  막힘 %dx%d%s' % (
                    r['id'], r['group'], r['W'], r['D'], r['H'], r['wpx'], r['F'], r['F_raw'], r['T'], r['T_raw'], r['T_c'], *r['cells'], *r['blocked'], '  ' + '; '.join(r['trims']) if r['trims'] else ''))
        return
    if len(a.dims) != 3: ap.error('W D H 세 수(m)가 필요하다')
    r = calc(*a.dims, kind=a.kind, c=a.c)
    print(json.dumps(r, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
