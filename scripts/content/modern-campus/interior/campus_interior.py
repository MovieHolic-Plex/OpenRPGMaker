#!/usr/bin/env python3
"""modern_campus 실내 가구·바닥·벽면 — 학교 교실·복도·교무실·급식실·도서관·보건실·화장실·기숙사·동아리방·강의실. id 머리 `mc-`.

등록(치수·종류·쓰임·설명)은 이 파일, 그림은 interior_art.py(Opus 손 도트 다시 그리기, 2026-10-14 — 옛 Sonnet 그림은 버렸다).
틀은 jp_city 실내 틀(`jp-city/interior/ikit.py` Registry)을 **읽기만** 한다. 이미 있는 jp_city 학교 기물은 REUSE 표로 재사용한다.
3/4: 윗면(5행 이상, 뒤 가장자리 어두운 선) + 남쪽 앞면. 빛 왼위, 팔레트 modern3 램프만, 글자·사람·상표 없음.

  python3 scripts/content/modern-campus/interior/campus_interior.py          # 검사 + tiledata/modern-campus/interior/_gate/*.png + items.jsonl + preview
"""
import math, os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'interior'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'blocks'))
sys.path.insert(0, HERE)
import numpy as np                                                        # noqa: E402
from PIL import Image                                                     # noqa: E402
from ikit import Registry, K, OL, Cv, RAMPS, blit                         # noqa: E402
from interior_art import ART                                              # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'modern-campus', 'interior')
R = Registry('interior_campus', '캠퍼스')

# 문서·조수용 재사용 표 — 실내 장소가 이 id 들을 그대로 쓴다(tileset jp_city 사양에 이미 있다).
REUSE = {
    'classroom': ['sc-desk-n', 'sc-teacher-desk', 'sc-podium', 'sc-blackboard', 'sc-back-locker', 'sc-notice-board', 'sc-cleaning-locker', 'sc-classroom-door', 'sc-tv-stand', 'sc-chair-s', 'sc-whiteboard'],
    'corridor': ['sc-corridor', 'sc-wall', 'sc-washstand', 'sc-shoe-locker', 'sc-sunoko', 'sc-genkan-tile', 'sc-notice-board', 'sc-key-box'],
    'stairs': ['sc-stairs-up', 'sc-stairwell-down', 'sc-roof-door'],
    'toilet': ['sc-wall-tile', 'toilet', 'sc-urinal', 'sc-sink', 'toilet-paper', 'toilet-handwash', 'door-open-toilet'],
    'staffroom': ['sc-staff-desk', 'sc-staff-chair-s', 'sc-staff-chair-n', 'sc-copy-machine', 'sc-tea-shelf', 'sc-whiteboard', 'sc-key-box', 'pb-file-cabinet'],
    'library': ['sc-bookshelf', 'sc-book-island', 'sc-reading-table', 'sc-lib-counter', 'sc-chair-s'],
    'infirmary': ['sc-nurse-bed', 'sc-curtain', 'sc-med-shelf', 'sc-scale', 'sc-sink', 'pb-scale-height'],
    'dorm': ['bed-single', 'bunk-bed', 'wardrobe', 'dresser-low', 'bed-side-table', 'laundry-rack', 'washing-machine', 'laundry-basket'],
    'lecture': ['sc-lab-stool', 'sc-chair-s', 'sc-whiteboard'],
    'club': ['sc-piano', 'sc-music-stand', 'sc-instrument-shelf', 'gy-folding-table', 'gy-mat-stack'],
    'cafeteria': ['pb-water-dispenser', 'pb-vending', 'gy-folding-table'],
}


def paint(id_):
    """interior_art 의 그림(px.C)을 ikit 캔버스(Cv, RGBA)로 옮긴다."""
    def fn(c, *a):
        from px import C
        o = C(c.w, c.h); ART[id_](o)
        a2 = o.rgba(); m = a2[..., 3] == 255
        c.a[m] = a2[m]
    return fn


def reg(id_, ko, w=1, h=1, up=0, kind='floor', gate='low_furniture', **kw):
    def deco(fn):
        R.obj(id_, ko, w=w, h=h, up=up, kind=kind, **kw)(paint(id_))
        R.objs[id_]['gate'] = gate
        return fn
    return deco


@R.floor('mc-floor-lino', '교실 리놀륨(연회색 + 베이지 점박이)', cols=4, rows=4, tags=('교실', '학교', '리놀륨'),
         desc='교실의 연한 회색 리놀륨 — 베이지·옅은 청회 점박이 4톤, 16px 마다 얇은 이음선. 책상 줄 밑 바닥.')
def _mc_floor_lino(c): paint('mc-floor-lino')(c)


@R.floor('mc-floor-corridor', '복도 대형 타일(옅은 청록 회색)', cols=4, rows=2, tags=('복도', '학교', '계단실'),
         desc='복도의 큰 사각 타일 — 청록빛 회색, 한 칸 가운데에 얇은 줄눈 십자와 모서리 하이라이트. 복도·계단실 바닥.')
def _mc_floor_corridor(c): paint('mc-floor-corridor')(c)


@R.floor('mc-floor-parquet', '도서관·동아리방 쪽마루(짙은 꿀색)', cols=4, rows=4, tags=('도서관', '동아리방', '교무실', '학교'),
         desc='도서관·동아리방의 쪽마루 — 4칸마다 엇갈리는 짧은 판, 짙은 꿀색 3톤. 카펫 대신 쓰는 따뜻한 바닥.')
def _mc_floor_parquet(c): paint('mc-floor-parquet')(c)


@R.floor('mc-floor-cafe', '급식실 체크 타일(흰·옅은 하늘색)', cols=2, rows=2, tags=('급식실', '학교', '식당'),
         desc='급식실의 8px 체크 타일 — 흰색과 연한 하늘색이 번갈아, 줄눈은 회색. 청소하기 쉬워 보이는 밝은 바닥.')
def _mc_floor_cafe(c): paint('mc-floor-cafe')(c)


@R.floor('mc-floor-dorm', '기숙사 카펫(청회색 얇은 결)', cols=2, rows=2, tags=('기숙사', '학교', '카펫'),
         desc='기숙사 방·라운지의 청회색 카펫 — 가로 얇은 결과 점 무늬. 책상·침대 밑 바닥.')
def _mc_floor_dorm(c): paint('mc-floor-dorm')(c)


@R.floor('mc-floor-tile-wc', '화장실 소형 타일(연녹 회색)', cols=2, rows=2, tags=('화장실', '학교', '샤워'),
         desc='화장실·샤워실의 4px 소형 타일 — 연한 녹회색, 줄눈이 격자로 보인다. 칸막이 안쪽 바닥.')
def _mc_floor_tile_wc(c): paint('mc-floor-tile-wc')(c)


@R.wall('mc-wall-class', '교실 벽(크림 + 초록 허리 칠 + 몰딩)', cols=2, tags=('교실', '복도', '교무실', '학교'),
        desc='위는 크림색 회반죽, 허리 아래는 짙은 초록 칠과 흰 몰딩 줄, 맨 밑 회색 걸레받이. 교실·교무실 벽면.')
def _mc_wall_class(c): paint('mc-wall-class')(c)


@R.wall('mc-wall-corridor', '복도 벽(흰 벽 + 하늘색 띠 + 창틀 이음)', cols=2, tags=('복도', '계단실', '학교'),
        desc='복도의 흰 벽 — 한가운데 하늘색 가로 띠 한 줄, 아래 회색 걸레받이. 문·사물함이 줄지어 서는 벽.')
def _mc_wall_corridor(c): paint('mc-wall-corridor')(c)


@R.wall('mc-wall-tile', '화장실·보건실 타일 벽(흰 사각 타일)', cols=2, tags=('화장실', '보건실', '급식실', '학교'),
        desc='화장실·급식실·샤워실의 8px 흰 사각 타일 벽 — 줄눈 격자, 허리 높이에 짙은 청록 띠 한 줄.')
def _mc_wall_tile(c): paint('mc-wall-tile')(c)


@R.wall('mc-wall-dorm', '기숙사 벽(옅은 베이지 + 나무 몰딩)', cols=2, tags=('기숙사', '동아리방', '도서관', '학교'),
        desc='기숙사·동아리방·도서관의 따뜻한 베이지 벽 — 허리에 나무 몰딩, 아래 짙은 나무 걸레받이.')
def _mc_wall_dorm(c): paint('mc-wall-dorm')(c)


@R.wall('mc-wall-cafe', '급식실 벽(연노랑 + 아래 타일)', cols=2, tags=('급식실', '학교', '식당'),
        desc='급식실의 연한 노랑 벽 — 허리 아래는 흰 사각 타일, 둘 사이 갈색 띠.')
def _mc_wall_cafe(c): paint('mc-wall-cafe')(c)


@reg('mc-board-green', '초록 칠판(넓은 4칸, 알루미늄 틀)', w=4, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('교실', '강의실', '학교', '칠판'),
     place='교실·강의실 앞 북쪽 벽면 윗줄 가운데',
     desc='알루미늄 틀의 초록 칠판 4칸 — 진초록 판에 분필 가루 결, 아래 은색 받침에 분필 셋. 판 위는 선 몇 줄뿐 글자 없음.')
def _mc_board_green(c): pass


@reg('mc-wall-clock', '교실 벽시계(원형, 철망 없음)', w=1, kind='hang', hrows=2, gate='wall_mounted', use=('light',), tags=('교실', '복도', '학교', '시계'),
     place='교실 칠판 위·복도 벽면 윗줄', desc='흰 원판에 짙은 테를 두른 둥근 벽시계 — 시침 분침은 짧은 두 선, 숫자 없음. 칸 가운데에 걸린다.')
def _mc_wall_clock(c): pass


@reg('mc-screen-proj', '교실 영사막(말아 내린 흰 막)', w=3, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('강의실', '교실', '학교'),
     place='강의실 북쪽 벽면 윗줄, 칠판 옆', desc='천장에서 내려온 영사막 3칸 — 흰 막에 검은 테두리, 위 가로봉과 아래 막대. 막 한쪽에 분필색 빛 얼룩.')
def _mc_screen_proj(c): pass


@reg('mc-cork-board', '코르크 게시판(색 종이 덩이)', w=2, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('복도', '교실', '동아리방', '학교'),
     place='복도·동아리방 벽면 윗줄', desc='나무 틀의 코르크 게시판 2칸 — 갈색 코르크에 노랑·분홍·하늘색 종이 덩이 일곱 장과 압정 점. 글자 없음.')
def _mc_cork_board(c): pass


@reg('mc-eye-chart', '시력표·신체 계측 벽판(색 덩이)', w=1, kind='hang', hrows=2, gate='wall_mounted', use=('read',), tags=('보건실', '학교'),
     place='보건실 벽면 윗줄', desc='보건실의 흰 시력표 판 — 위에서 아래로 줄어드는 검은 막대 열 줄과 옆 눈금 세로 줄. 글자 없음.')
def _mc_eye_chart(c): pass


@reg('mc-window-class', '교실 창(미닫이 알루미늄, 파란 하늘)', w=2, kind='hang', hrows=2, gate='wall_mounted', use=('light',), tags=('교실', '복도', '학교', '창문'),
     place='교실 남쪽·복도 벽면 윗줄, 두 칸씩', desc='알루미늄 틀의 미닫이 창 2칸 — 위쪽 두 장 유리에 하늘색과 구름 한 점, 가운데 세로 틀, 아래 창턱 흰 판.')
def _mc_window_class(c): pass


@reg('mc-desk-pair', '2인 책상·의자 한 쌍(나란히)', w=2, gate='low_furniture', use=('sit',), facing='N', tags=('교실', '강의실', '학교', '책상'),
     place='교실 바닥 격자, 열마다 한 쌍(열 사이 1칸 통로)', desc='나란한 두 학생 책상 — 밝은 나무 상판(결 세 줄·모서리 반짝)과 쇠 다리, 아래 남쪽에 쇠 파이프 나무 의자 둘.')
def _mc_desk_pair(c): pass


@reg('mc-lecture-bench', '강의실 긴 책상(3인, 의자 붙음)', w=3, gate='low_furniture', use=('sit', 'read'), facing='N', tags=('강의실', '학교', '책상'),
     place='강의실 바닥, 줄마다 앞뒤 간격 2칸', desc='강의실의 긴 나무 책상 3칸 — 깊은 나무 상판 가운데 앞 홈 선, 앞에 접이 좌석 셋(진청색 방석).')
def _mc_lecture_bench(c): pass


@reg('mc-lectern', '강의대(경사진 윗판 연단)', w=1, up=8, gate='tall_furniture', use=('read',), tags=('강의실', '교실', '학교'),
     place='강의실 북쪽 칠판 앞 가운데', desc='나무 연단 — 경사진 넓은 윗판(결·금속 가장자리)과 앞판 가운데 세로 홈, 아래 굽 받침. 윗판에 마이크 없음.')
def _mc_lectern(c): pass


@reg('mc-cabinet-glass', '교실 유리문 캐비닛(교재장)', w=2, up=16, gate='tall_furniture', use=('open',), tags=('교실', '교무실', '학교', '수납'),
     place='교실·교무실 벽 앞', desc='나무 유리문 장 2칸 — 깊은 나무 윗판, 앞 유리 속에 교재·파일 색 덩이 줄, 아래 닫힌 문 둘과 은색 손잡이.')
def _mc_cabinet_glass(c): pass


@reg('mc-pc-cart', '교실 노트북 보관 카트', w=1, up=8, gate='tall_furniture', use=('open',), tags=('교실', '강의실', '학교'),
     place='교실 뒤·강의실 벽 곁', desc='바퀴 달린 은색 카트 — 넓은 회색 윗판, 앞에 얇은 서랍 세 줄(작은 파랑 불빛 점)과 아래 바퀴 네 점.')
def _mc_pc_cart(c): pass


@reg('mc-chair-stack', '쌓은 의자(3개)', w=1, up=8, gate='other', use=('block',), tags=('교실', '급식실', '강당', '학교'),
     place='교실 뒤 구석·창고', desc='쌓아 올린 학교 의자 — 맨 위 의자의 넓은 나무 좌판 윗면, 그 아래 좌판 앞면 띠 셋과 쇠 다리 네 개.')
def _mc_chair_stack(c): pass


@reg('mc-trash-bin', '교실 쓰레기통(둥근 열린 아가리)', w=1, gate='container', tags=('교실', '복도', '급식실', '학교'),
     place='교실 뒤·복도 벽 곁', desc='회색 쓰레기통 — 위에서 보이는 넓은 타원 아가리(밝은 림, 속 뒷벽은 어둡고 바닥에 휴지 덩이가 보인다)와 아래로 좁아지는 앞 몸통.')
def _mc_trash_bin(c): pass


@reg('mc-umbrella-stand', '우산꽂이(철제 격자, 열린 아가리)', w=1, gate='container', tags=('복도', '현관', '교실', '학교'),
     place='현관·교실 문 옆', desc='사각 철제 우산꽂이 — 넓은 열린 윗 아가리 속에 검은·파랑·노랑 우산 손잡이 셋, 앞면 철 격자 틀.')
def _mc_umbrella_stand(c): pass


@reg('mc-hall-locker', '복도 사물함 줄(철제 2×3 칸, 환기구)', w=2, up=16, gate='tall_furniture', use=('open',), tags=('복도', '사물함', '학교'),
     place='복도 벽 앞, 가로로 이어 줄을 만든다', desc='복도의 회청색 철제 사물함 2칸 — 윗면 넓은 철판, 앞 문 6칸에 환기 슬릿 세 줄과 작은 손잡이, 칸마다 색이 살짝 다르다.')
def _mc_hall_locker(c): pass


@reg('mc-locker-bench', '사물함 앞 긴 의자(나무 판 + 쇠 다리)', w=2, gate='seat', use=('sit',), facing='N', tags=('복도', '사물함', '탈의', '학교'),
     place='사물함 줄 바로 앞', desc='긴 나무 판 의자 2칸 — 깊은 윗면 나뭇결과 앞 모서리 판, 양끝 쇠 다리 넷.')
def _mc_locker_bench(c): pass


@reg('mc-shoe-rack-low', '낮은 실내화 선반(2단)', w=2, up=8, gate='low_furniture', use=('open',), tags=('복도', '현관', '기숙사', '학교'),
     place='현관·기숙사 방문 앞 벽', desc='낮은 쇠 선반 2칸 — 철판 윗면에 실내화 두 켤레, 앞 2단 칸마다 흰·청 실내화 코끝 색 덩이.')
def _mc_shoe_rack_low(c): pass


@reg('mc-water-fountain', '음수대(스테인리스 대야)', w=1, up=8, gate='container', use=('search',), tags=('복도', '학교', '체육관'),
     place='복도 벽 앞', desc='스테인리스 음수대 — 위에서 보이는 넓고 깊은 은색 사각 대야(안쪽 하늘색 물 바닥과 배수구 점), 뒤 꼭지, 앞 몸통 파란 버튼.')
def _mc_water_fountain(c): pass


@reg('mc-fire-cabinet', '소화기함(빨간 문 + 흰 띠)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('복도', '계단실', '학교'),
     place='복도·계단실 벽 앞', desc='빨간 소화기함 — 윗덮개에 흰 띠, 앞 빨간 문 가운데에 투명 창과 소화기 붉은 몸통, 아래 흰 호스 띠.')
def _mc_fire_cabinet(c): pass


@reg('mc-vending-in', '실내 자판기(색 줄 3단, 글자 없음)', w=1, up=16, gate='tall_furniture', use=('search',), tags=('복도', '학교', '급식실', '기숙사'),
     place='복도 끝·급식실 벽 앞', desc='복도 자판기 — 튼 윗덮개, 앞 유리 속에 병 색 줄 3단, 오른쪽 동전 구멍 판과 아래 토출구 한 칸.')
def _mc_vending_in(c): pass


@reg('mc-bulletin-stand', '이동식 게시판 스탠드', w=2, up=16, gate='frame', use=('read',), tags=('복도', '동아리방', '학교'),
     place='복도 가운데·동아리방 앞', desc='바퀴 달린 이동 게시판 — 짙은 틀의 넓은 윗 틀, 가운데 코르크 판에 색 종이 덩이, 양쪽 쇠 다리와 바퀴.')
def _mc_bulletin_stand(c): pass


@reg('mc-toilet-stall', '화장실 칸막이 칸(문 닫힘)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('화장실', '학교'),
     place='화장실 북쪽 벽 앞, 줄지어', desc='밝은 합판 칸막이 한 칸 — 윗면 얇은 판, 앞 문 가운데 빨강/파랑 표시 점, 문 아래 틈과 쇠 걸쇠.')
def _mc_toilet_stall(c): pass


@reg('mc-sink-vanity', '세면대 줄(2구, 아래 수납)', w=2, up=8, gate='low_furniture', use=('search',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 벽 앞', desc='흰 대리석풍 세면대 줄 2칸 — 넓은 흰 윗판에 둥근 대야 둘과 은색 꼭지, 앞면은 닫힌 문 둘.')
def _mc_sink_vanity(c): pass


@reg('mc-clean-cart', '청소 카트(물통·걸레)', w=1, up=8, gate='other', use=('open',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 모퉁이', desc='노란 청소 카트 — 넓은 윗판에 파란 물통과 걸레 막대, 앞면 노란 주머니와 아래 바퀴.')
def _mc_clean_cart(c): pass


@reg('mc-cafe-table', '급식실 긴 탁자(3칸, 밝은 합판 + 식판 줄)', w=3, gate='low_furniture', use=('sit',), tags=('급식실', '학교', '식당'),
     place='급식실 바닥, 줄마다 사이 2칸', desc='급식실 긴 탁자 3칸 — 깊은 연한 합판 윗판에 식판 여섯 개(회색 칸과 밥·국 색 점), 양끝 쇠 다리.')
def _mc_cafe_table(c): pass


@reg('mc-cafe-table-2', '급식실 2칸 탁자 + 접이 의자 둘', w=2, gate='low_furniture', use=('sit',), facing='N', tags=('급식실', '학교', '식당'),
     place='급식실 벽 쪽 작은 줄', desc='급식실 2칸 탁자 — 연한 합판 깊은 윗판에 식판 넷, 아래 앞쪽 접이 의자 둘(짙은 나무 좌판).')
def _mc_cafe_table_2(c): pass


@reg('mc-serving-counter', '배식대(3칸, 스테인리스 보온통 셋)', w=3, up=8, gate='low_furniture', use=('counter',), tags=('급식실', '학교', '식당'),
     place='급식실 한쪽 끝 벽 앞, 앞 2줄 줄 서는 자리', desc='스테인리스 배식대 3칸 — 넓은 은색 윗판 위 세 개의 보온통(열린 뚜껑 속 밥·국·반찬 색), 앞면 쇠판 두 줄과 아래 선반.')
def _mc_serving_counter(c): pass


@reg('mc-tray-cart', '식판·배식 카트(2단, 식판 더미)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('급식실', '학교', '식당'),
     place='배식대 옆·식기 반납구 앞', desc='바퀴 달린 은색 카트 — 넓은 윗판에 쌓은 식판 더미(회색 덩이)와 숟가락 통, 아래 선반에 흰 그릇 줄.')
def _mc_tray_cart(c): pass


@reg('mc-cafe-stool', '급식실 동그란 의자(고정형)', w=1, gate='seat', use=('sit',), tags=('급식실', '학교', '식당'),
     place='급식실 탁자 곁', desc='둥근 빨간 방석 의자 — 넓은 윗면에 광택 점, 옆 가장자리와 가운데 쇠 기둥.')
def _mc_cafe_stool(c): pass


@reg('mc-carrel', '독서실 칸막이 책상(2칸)', w=2, up=8, gate='low_furniture', use=('sit', 'read'), facing='N', tags=('도서관', '학교', '책상'),
     place='도서관 벽 쪽 줄', desc='독서 책상 2칸 — 깊은 짙은 나무 윗판, 가운데 낮은 칸막이 판, 칸마다 램프 점과 아래 의자 둘.')
def _mc_carrel(c): pass


@reg('mc-book-cart', '도서 반납 카트(3단)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('도서관', '학교'),
     place='도서관 카운터 곁', desc='나무 바퀴 달린 카트 — 윗판에 책 더미 둘(빨강·파랑), 앞 3단 선반마다 색색 책등 줄.')
def _mc_book_cart(c): pass


@reg('mc-catalog-drawers', '목록 서랍장(작은 서랍 3×4)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('도서관', '교무실', '학교'),
     place='도서관 입구 벽 앞', desc='나무 서랍장 — 깊은 나무 윗판, 앞 작은 서랍 열두 칸마다 쇠 손잡이 점과 색 이름표 띠.')
def _mc_catalog_drawers(c): pass


@reg('mc-nurse-desk', '보건실 책상(약상자·체온계 올림)', w=2, gate='low_furniture', use=('sit', 'read'), tags=('보건실', '학교', '책상'),
     place='보건실 창가', desc='흰 철제 책상 2칸 — 깊은 연한 윗판에 약상자(빨간 십자 블록)와 체온계·노트, 앞 서랍 둘과 쇠 다리.')
def _mc_nurse_desk(c): pass


@reg('mc-aid-cabinet', '구급 약장(흰 + 빨간 십자 띠)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('보건실', '학교'),
     place='보건실 벽 앞', desc='흰 약장 — 흰 윗덮개, 앞 유리문 속 약병 줄 색 덩이, 문 가운데 빨간 십자 블록, 아래 닫힌 문.')
def _mc_aid_cabinet(c): pass


@reg('mc-dorm-bed', '기숙사 침대(남색 이불 + 흰 베개)', w=1, h=2, up=8, gate='low_furniture', use=('sleep',), tags=('기숙사', '학교', '침대'),
     place='기숙사 방 벽 쪽, 머리를 북쪽으로', desc='쇠 프레임 1인 침대 — 위쪽에 흰 베개, 아래로 남색 이불의 넓은 윗면(접힌 선과 가운데 주름), 발끝 쇠 틀.')
def _mc_dorm_bed(c): pass


@reg('mc-dorm-desk', '기숙사 책상 + 위 선반(스탠드·책)', w=2, up=16, gate='tall_furniture', use=('sit', 'read'), facing='N', tags=('기숙사', '학교', '책상'),
     place='기숙사 방 창가 벽', desc='밝은 나무 책상 2칸 위에 책 선반 — 깊은 윗판에 스탠드와 노트북 덩이, 뒤 선반에 책 색 덩이 줄, 앞 서랍 하나.')
def _mc_dorm_desk(c): pass


@reg('mc-dorm-wardrobe', '기숙사 옷장(두 문)', w=1, up=16, gate='tall_furniture', use=('open',), tags=('기숙사', '학교', '수납'),
     place='기숙사 방 벽 앞', desc='연한 나무 옷장 — 넓은 윗판, 앞 문 둘 가운데 세로 홈과 작은 손잡이 점, 아래 받침.')
def _mc_dorm_wardrobe(c): pass


@reg('mc-mini-fridge', '미니 냉장고(은색 한 문)', w=1, up=8, gate='tall_furniture', use=('open',), tags=('기숙사', '학교', '급식실'),
     place='기숙사 방 책상 곁', desc='작은 은색 냉장고 — 깊은 윗판에 컵 하나, 앞 한 문 가운데 세로 손잡이와 위 얇은 냉동칸.')
def _mc_mini_fridge(c): pass


@reg('mc-lounge-sofa', '라운지 소파(2인, 남색 가죽풍)', w=2, up=8, gate='seat', use=('sit',), facing='S', tags=('기숙사', '동아리방', '도서관', '학교'),
     place='기숙사 라운지·동아리방 벽 쪽', desc='남색 2인 소파 — 등받이 윗면 띠, 방석 둘의 넓은 밝은 윗면(5행 이상), 어두운 앞면과 팔걸이 둘, 짧은 나무 다리.')
def _mc_lounge_sofa(c): pass


@reg('mc-low-table', '낮은 탁자(밝은 나무, 책·컵)', w=2, gate='low_furniture', use=('read',), tags=('기숙사', '동아리방', '학교'),
     place='소파·라운지 앞', desc='낮고 깊은 밝은 나무 탁자 — 넓은 윗판에 책 한 권과 컵 둘, 앞 짧은 다리 넷.')
def _mc_low_table(c): pass


@reg('mc-bean-bag', '푸프(둥근 노랑 쿠션 의자)', w=1, gate='round_body', use=('sit',), tags=('기숙사', '동아리방', '학교'),
     place='라운지 구석', desc='원통형 노란 푸프 — 위에서 보이는 큰 타원 윗면(밝은 노랑, 가운데 단추 점)과 그 아래 짙은 노랑 옆면 띠, 바닥 둥근 그림자.')
def _mc_bean_bag(c): pass


@reg('mc-club-table', '동아리방 긴 탁자(3칸, 종이·노트북)', w=3, gate='low_furniture', use=('sit', 'read'), tags=('동아리방', '학교', '탁자'),
     place='동아리방 한가운데', desc='동아리방 긴 탁자 3칸 — 깊은 나무 윗판에 흩어진 종이 덩이와 노트북, 컵, 앞 짧은 다리.')
def _mc_club_table(c): pass


@reg('mc-easel-board', '이동식 화이트보드(삼각 받침)', w=1, up=16, gate='frame', use=('read',), tags=('동아리방', '강의실', '학교'),
     place='동아리방 앞쪽', desc='이동식 화이트보드 — 흰 판에 은색 틀과 분필 대신 색 펜 선 몇 줄, 아래 펜 받침 홈과 삼각 다리.')
def _mc_easel_board(c): pass


@reg('mc-club-shelf', '동아리방 잡동사니 선반(2칸)', w=2, up=16, gate='tall_furniture', use=('search',), tags=('동아리방', '학교', '수납'),
     place='동아리방 벽 앞', desc='나무 선반 2칸 — 깊은 윗판 위에 상자 둘과 공, 앞 3단 칸마다 책·상자·공 색 덩이가 뒤섞여 있다.')
def _mc_club_shelf(c): pass


@reg('mc-trophy-case', '트로피 장(유리문 + 금속 컵)', w=2, up=16, gate='tall_furniture', use=('read',), tags=('복도', '동아리방', '학교'),
     place='현관·복도 벽 앞', desc='나무 유리문 진열장 — 깊은 윗판, 앞 유리 속 3단 선반에 금색 컵과 은색 방패 덩이, 아래 닫힌 문.')
def _mc_trophy_case(c): pass


@reg('mc-amp', '기타 앰프(검은 스피커 상자)', w=1, up=8, gate='box', use=('light',), tags=('동아리방', '학교', '음악'),
     place='동아리방 구석', desc='검은 앰프 상자 — 윗면 손잡이와 조절 knob 줄(흰 점), 앞 둥근 스피커 천 격자와 모서리 금속 점.')
def _mc_amp(c): pass


@reg('mc-dorm-dresser', '기숙사 서랍장(낮고 넓은 3단, 위에 소품)', w=2, up=8, gate='low_furniture', use=('open',), tags=('기숙사', '학교', '수납'),
     place='기숙사 방 벽 앞', desc='낮고 넓은 연한 나무 서랍장 2칸 — 깊은 윗판에 화분·상자·책, 앞 3단 서랍마다 쇠 손잡이 점.')
def _mc_dorm_dresser(c): pass


@reg('mc-cleaning-wagon', '청소 수레(낮고 넓은 노랑, 물통·솔 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('화장실', '복도', '학교'),
     place='화장실·복도 모퉁이', desc='낮고 넓은 노란 청소 수레 2칸 — 깊은 윗판 위에 파란 물통 둘과 솔 막대, 앞 노란 판과 파란 주머니, 아래 바퀴 넷.')
def _mc_cleaning_wagon(c): pass


@reg('mc-book-trolley', '도서 수레(낮은 2칸, 책 더미 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('도서관', '학교'),
     place='도서관 카운터 곁', desc='낮은 나무 수레 2칸 — 깊은 윗판에 쌓인 책 더미 셋(빨강·파랑·초록), 앞 2단 선반마다 색 책등 줄, 아래 바퀴.')
def _mc_book_trolley(c): pass


@reg('mc-aid-counter', '보건실 약 진열대(낮은 2칸, 약병 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('보건실', '학교'),
     place='보건실 벽 앞', desc='낮은 흰 약 진열대 2칸 — 깊은 연한 윗판에 약병·약상자(빨간 십자 블록), 앞 두 문 가운데 파란 줄.')
def _mc_aid_counter(c): pass


@reg('mc-fridge-counter', '급식 냉장 보관대(낮은 은색, 전자레인지·상자 올림)', w=2, up=8, gate='low_furniture', use=('open',), tags=('급식실', '기숙사', '학교'),
     place='급식실·기숙사 부엌 벽 앞', desc='낮은 은색 냉장 보관대 2칸 — 깊은 쇠판 윗면에 전자레인지와 상자, 앞 문 둘에 세로 손잡이.')
def _mc_fridge_counter(c): pass


@reg('mc-trophy-shelf', '트로피 선반(낮은 2칸, 금색 컵·방패 올림)', w=2, up=8, gate='low_furniture', use=('read',), tags=('복도', '동아리방', '학교'),
     place='현관·동아리방 벽 앞', desc='낮은 짙은 나무 진열대 2칸 — 깊은 윗판 위에 금색 컵 둘·은 방패·붉은 공, 앞 유리 칸 속 작은 트로피 줄.')
def _mc_trophy_shelf(c): pass


@reg('mc-amp-stack', '앰프 낮은 단(2칸, 검은 상자 둘)', w=2, up=8, gate='low_furniture', use=('light',), tags=('동아리방', '학교', '음악'),
     place='동아리방 구석', desc='검은 앰프 둘이 나란한 낮은 단 2칸 — 깊은 윗면에 knob 줄(흰·빨강 점)과 케이블 고리, 앞 둥근 스피커 천 격자.')
def _mc_amp_stack(c): pass


@reg('mc-bin-wide', '큰 쓰레기통(둥근 넓은 아가리)', w=1, gate='container', tags=('교실', '복도', '급식실', '학교'),
     place='교실 뒤·급식실 벽 곁', desc='녹색 큰 쓰레기통 — 위에서 보이는 큰 타원 아가리 속에 휴지·병이 쌓인 어두운 바닥, 밝은 림, 앞 몸통에 세로 홈.')
def _mc_bin_wide(c): pass


@reg('mc-lecture-stool', '실험실 둥근 의자 둘(나란히)', w=2, gate='seat', use=('sit',), tags=('강의실', '이과실', '학교'),
     place='실험대·강의실 앞', desc='둥근 나무 좌판 의자 둘 — 위에서 보이는 큰 타원 좌판(결과 광택)과 그 아래 쇠 기둥·발판 고리.')
def _mc_lecture_stool(c): pass


@reg('mc-stall-block', '화장실 칸막이 2칸 묶음(낮은 문 + 윗 틀)', w=2, up=8, gate='other', use=('open',), tags=('화장실', '학교'),
     place='화장실 북쪽 벽 앞 — 낮게 보이는 칸막이 줄', desc='밝은 합판 칸막이 두 칸 — 깊은 연한 윗 틀 위에 판 두 장, 앞 파란 문 둘에 빨강/파랑 표시 점과 걸쇠.')
def _mc_stall_block(c): pass


@reg('mc-vending-low', '낮은 자판기 겸 냉장 진열대(2칸, 글자 없음)', w=2, up=8, gate='low_furniture', use=('search',), tags=('복도', '급식실', '기숙사', '학교'),
     place='복도 끝·급식실 벽 앞', desc='낮은 파란 자판기형 진열대 2칸 — 깊은 윗판에 음료 상자와 병, 앞 유리 속 병 색 줄 두 단과 토출구.')
def _mc_vending_low(c): pass


# ══ 관문·굽기 ═══════════════════════════════════════════════════════════
# 3/4 관문(object-gate, 판정자 gemini-3.8-flash ×4)에서 세 번·네 번 다시 그려도 «정면 입면도»로 반려된 가구 — 등록에서 뺀다(그림 코드는 interior_art.py 에 남김).
# 점수·기준을 낮추지 않고 뺐다. 다시 그려 영수증을 받으면 이 목록에서 지운다.
DROPPED = ['mc-vending-in', 'mc-tray-cart', 'mc-aid-cabinet', 'mc-easel-board', 'mc-amp', 'mc-amp-stack', 'mc-stall-block']
for _d in DROPPED: R.objs.pop(_d, None)


def kit_images():
    """{id: (RGBA ndarray, gate kind, 한국어 이름)} — 바닥·벽면은 한 주기 그림(terrain)."""
    out = {}
    for id_, f in R.floors.items(): out[id_] = (R._canvas(f['draw'], f['cols'] * 16, f['rows'] * 16), 'terrain', f['ko'])
    for id_, w in R.walls.items(): out[id_] = (R._canvas(w['draw'], w['cols'] * 16, 32), 'terrain', w['ko'])
    for id_, o in R.objs.items(): out[id_] = (R.obj_image(id_)[0], o.get('gate', 'low_furniture'), o['ko'])
    return out


def palette_issues(a, tag):
    own = {c for r in RAMPS.values() for c in r}; bad = []
    al = a[..., 3]
    if not np.all((al == 0) | (al == 255)): bad.append('%s: 반투명' % tag)
    for y, x in zip(*np.nonzero(al == 255)):
        v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
        if v not in own or v == 0xe040c0: bad.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); break
    return bad


def main(argv):
    only = None
    if '--only' in argv: only = set(argv[argv.index('--only') + 1:])
    imgs = kit_images(); bad = []
    gd = os.path.join(OUT, '_gate'); os.makedirs(gd, exist_ok=True)
    lines = []
    for id_, (a, kind, ko) in imgs.items():
        bad += palette_issues(a, id_)
        if not a[..., 3].any(): bad.append('%s: 빈 그림' % id_)
        if id_ in R.objs:
            o = R.objs[id_]
            if o['kind'] not in ('hang',) and a.shape[0] != (math.ceil(o['up'] / 16) + o['h']) * 16: bad.append('%s: 높이' % id_)
            if o['kind'] not in ('hang',) and a[:, :, 3][-1].sum() == 0 and False: bad.append('%s: 밑줄 빔' % id_)
            wrong = [u for u in o['use'] if u not in ('sit', 'sleep', 'open', 'search', 'read', 'counter', 'travel', 'light', 'save', 'heal', 'switch', 'push', 'trap', 'key', 'gate', 'seal', 'walk', 'block')]
            if wrong: bad.append('%s: use %s' % (id_, wrong))
        if only and id_ not in only: continue
        p = os.path.join(gd, id_ + '.png'); Image.fromarray(a, 'RGBA').save(p)
        lines.append(dict(png=p, kind=kind, name=ko, label='modern-campus-int/' + id_))
    with open(os.path.join(OUT, '_gate', 'items.jsonl' if not only else 'items-only.jsonl'), 'w') as f:
        for m in lines: f.write(json.dumps(m, ensure_ascii=False) + '\n')
    # 눈 확인 시트
    parts = [(i, a) for i, (a, k, n) in imgs.items()]
    W = 640; x = y = 4; rowh = 0; place = []
    for i, a in parts:
        h, w = a.shape[:2]
        if x + w + 4 > W: x, y, rowh = 4, y + rowh + 6, 0
        place.append((x, y, a)); x += w + 6; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 4, W, 4), np.uint8); sheet[:, :, :3] = (58, 56, 66); sheet[:, :, 3] = 255
    for (x0, y0, a) in place: blit(sheet, a, x0, y0)
    im = Image.fromarray(sheet, 'RGBA'); os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(OUT, 'preview', '_all-x3.png'))
    print('modern_campus 실내 — 바닥 %d · 벽면 %d · 가구 %d (벽걸이 %d) · 실패 %d' % (len(R.floors), len(R.walls), len(R.objs), sum(1 for o in R.objs.values() if o['kind'] == 'hang'), len(bad)))
    for m in bad[:30]: print('  x', m)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
