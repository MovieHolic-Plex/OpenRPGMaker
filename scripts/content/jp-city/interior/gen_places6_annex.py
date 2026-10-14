import json, os
"""places6 예제 맵 생성기(2026-10-14) — 평면·가구를 코드로 적는다. 고친 뒤 maps/interior.mjs --only <맵들> 로 다시 짓고 qa/check-interior-examples.mts 로 검사."""
EX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tiledata', 'jp-city', 'interior', 'examples')
def grid(W, H): return [['#'] * W for _ in range(H)]
def carve(g, x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = '.'
def S(g): return [''.join(r) for r in g]
O = []
def o(i, x, y): O.append(dict(id=i, x=x, y=y))

# ───────── 학교 특별교실동 1층: 취주악부실 · 인쇄실 · 계단 홀 · 현관 복도 ─────────
W, H = 26, 16
g = grid(W, H)
carve(g, 1, 1, 11, 8); carve(g, 13, 1, 18, 8); carve(g, 20, 1, 24, 8)   # 취주악부실 · 인쇄실 · 계단 홀
carve(g, 1, 10, 24, 14)                                                  # 복도(벽면 2줄 + 걸음 3줄)
g[9][6] = g[9][16] = '.'; g[9][22] = g[9][23] = '.'                     # 문 둘 · 계단 홀 트임
g[H - 1][11] = g[H - 1][12] = '.'                                        # 현관(남쪽 2칸)
# 취주악부실(x1-11): 북쪽 악기 선반·실로폰·팀파니, 지휘 보면대를 보는 의자 두 무리(가운데 통로), 뒤쪽 드럼 세트
o('window-sash', 3, 1); o('wall-clock', 6, 1); o('sx-pa-speaker', 9, 1)
o('sc-instrument-shelf', 1, 3); o('sx-xylophone', 3, 3); o('sx-timpani', 8, 3); o('sx-timpani', 9, 3); o('sc-instrument-shelf', 10, 3)
o('sc-music-stand', 6, 4); o('sc-music-stand', 6, 7)
for x in (2, 3, 4, 8, 9, 10): o('sc-music-chair-n', x, 6)
o('sx-drum-kit', 2, 8)
o('sc-classroom-door', 6, 9)
# 인쇄실(x13-18): 교원 우편 칸·찻장·서류장, 가운데 윤전 인쇄기·복사기, 남쪽 작업 책상·종이 분리수거
o('sc-key-box', 13, 1); o('sc-whiteboard', 15, 1)
o('sx-letter-shelf', 13, 3); o('sc-tea-shelf', 15, 3); o('of-cabinet', 18, 3)
o('sx-riso-printer', 14, 6); o('sc-copy-machine', 17, 6)
o('sc-staff-chair-s', 13, 7); o('sc-staff-desk', 13, 8); o('sx-recycle-bins', 17, 8)
o('sc-classroom-door', 16, 9)
# 계단 홀(x20-24): 위층 계단 · 미술 작품 전시 선반
o('sc-stairs-up', 20, 3); o('sx-art-display', 23, 3); o('sx-hall-bench', 20, 7); o('houseplant', 24, 7)
# 복도: 북쪽 벽면 걸이(게시판·학급 표찰·소화전), 북쪽 첫 줄 트로피 장, 남쪽 벽 곁 긴 의자·분리수거·소화기·우산꽂이
o('sc-notice-board', 2, 10); o('sx-class-plate', 7, 10); o('sx-hydrant-box', 9, 10); o('sc-notice-board', 13, 10); o('sx-class-plate', 17, 10); o('wall-clock', 20, 10)
o('sx-trophy-case', 11, 12)
o('sx-hall-bench', 2, 14); o('sx-recycle-bins', 5, 14); o('sx-extinguisher', 8, 14)
o('sx-umbrella-rack', 13, 14); o('sc-cleaning-locker', 16, 14); o('sx-mop-bucket', 17, 14); o('sx-hall-bench', 20, 14); o('houseplant', 24, 14)
exS = dict(name='학교 특별교실동 1층(취주악부실·인쇄실·현관 복도)', plan=S(g), floor='sc-corridor', wall='sc-wall', ceiling='default',
           zones=[dict(x0=1, y0=0, x1=11, y1=8, floor='sc-classroom-wood', wall='sc-soundwall'), dict(x0=13, y0=0, x1=18, y1=8, floor='pb-linoleum')],
           objects=O, tables=[], goods=[],
           rooms=[dict(room='bandroom', x0=0, y0=0, x1=11, y1=9), dict(room='printroom', x0=12, y0=0, x1=18, y1=9), dict(room='annexstairs', x0=19, y0=0, x1=25, y1=9),
                  dict(room='annexcorridor', x0=0, y0=10, x1=25, y1=H - 1)],
           start=[11, H - 2], exitWidth=2, links=[],
           open=[dict(x0=20, y0=3, x1=24, y1=11, why='계단 앞 층계참 — 복도에서 트인 계단 홀')])

# ───────── 사옥 1층 로비(경비 데스크·방문자 접수) ─────────
O = []
W, H = 16, 11
g = grid(W, H)
carve(g, 1, 1, 14, 9)
for y in (1, 2):
    for x in range(11, 15): g[y][x] = '#'                                # 북동 모서리 계단통 덩이(벽면이 한 칸 내려온다)
g[H - 1][7] = g[H - 1][8] = '.'
o('of-window-blind', 1, 1); o('wall-clock', 9, 1); o('of-directory', 12, 3)
o('of-stairs-up', 1, 3); o('of-elevator', 3, 3); o('of-elevator', 6, 3); o('ox-floor-guide', 9, 3)
o('ox-trash-column', 11, 9)
o('ox-security-desk', 2, 6); o('of-desk-chair-n', 2, 7); o('ox-visitor-kiosk', 5, 6)
o('ox-planter-box', 10, 6); o('of-plant-big', 14, 9); o('of-lobby-sofa-n', 12, 7); o('of-lobby-sofa-n', 3, 9)
o('ox-umbrella-bagger', 6, 9); o('ox-umbrella-bagger', 9, 9); o('cv-autodoor', 7, H - 1)
exL = dict(name='IT 회사 사옥 1층 로비', plan=S(g), floor='of-lobby-stone', wall='of-lobby-wall', ceiling='default',
           zones=[], objects=O, tables=[], goods=[],
           rooms=[dict(room='towerlobby', x0=0, y0=0, x1=W - 1, y1=H - 1)],
           start=[7, H - 2], exitWidth=2,
           open=[dict(x0=1, y0=3, x1=14, y1=5, why='계단·엘리베이터 앞 기다리는 줄'), dict(x0=6, y0=4, x1=9, y1=9, why='현관 자동문에서 엘리베이터까지 주 동선')],
           links=[dict(x=1, y=3, toMapId='jp-city-office-free', toX=20, toY=15, direction='up'),
                  dict(x=3, y=3, toMapId='jp-city-office-free', toX=15, toY=15, direction='up'), dict(x=4, y=3, toMapId='jp-city-office-free', toX=16, toY=15, direction='up'),
                  dict(x=6, y=3, toMapId='jp-city-office-free', toX=15, toY=15, direction='up'), dict(x=7, y=3, toMapId='jp-city-office-free', toX=16, toY=15, direction='up')])

# ───────── 사옥 자유석 층(フリーアドレス) ─────────
O = []
W, H = 24, 19
g = grid(W, H)
carve(g, 1, 1, 22, 10)                                                  # 자유석 사무 공간
carve(g, 1, 12, 7, 17); carve(g, 9, 12, 12, 17); carve(g, 14, 12, 22, 17)  # 회의실 · 급탕실 · 엘리베이터 홀
g[11][6] = '.'; g[11][10] = '.'; g[11][18] = g[11][19] = '.'
# 북쪽 벽: 1인 부스 셋, 파쇄기·복사기, 서류장 / 북동 스탠딩 회의 자리
o('of-window-blind', 5, 1); o('of-window-blind', 9, 1); o('of-window-blind', 13, 1); o('ox-whiteboard-wall', 18, 1)
o('ox-phone-booth', 1, 3); o('ox-phone-booth', 2, 3); o('ox-phone-booth', 3, 3)
o('ox-shredder', 6, 3); o('of-copier', 7, 3); o('of-cabinet', 10, 3); o('of-cabinet', 11, 3); o('ox-planter-box', 14, 3); o('of-server-rack', 17, 3)
o('ox-display-stand', 20, 3)
o('ox-bar-stool', 18, 6); o('ox-standing-table', 19, 6); o('ox-bar-stool', 21, 6); o('ox-bar-stool', 19, 7); o('ox-bar-stool', 20, 7)
# 자유석 긴 책상 세 섬(남북으로 마주 앉는다)
for x0 in (4, 9, 14):
    for k in range(3): o('of-desk-chair-s', x0 + k, 6)
    o('ox-bench-desk', x0, 7)
    for k in range(3): o('of-desk-chair-n', x0 + k, 8)
o('ox-desk-wagon', 17, 7)
# 서쪽 라운지 · 동쪽 화분
o('ox-lounge-sofa', 1, 9); o('ox-planter-box', 1, 6); o('of-plant-big', 22, 10); o('ox-trash-column', 22, 8)
# 회의실(x1-7): 북쪽 벽 천장 스크린을 보는 탁자, 동쪽 화이트보드
o('ox-projector-screen', 2, 12); o('of-whiteboard', 6, 16)
for x in (2, 3, 4): o('of-desk-n', x, 15); o('of-desk-chair-n', x, 16)
o('of-glass-door', 6, 11)
# 급탕실(x9-12): 커피 카운터·온수기·소형 냉장고
o('ox-water-boiler', 12, 12); o('of-fridge-small', 9, 14); o('ox-coffee-counter', 11, 14); o('ox-standing-table', 11, 16); o('ox-trash-column', 12, 17)
o('door-open-western', 10, 11)
# 엘리베이터 홀(x14-22)
o('of-elevator', 15, 14); o('of-stairwell-down', 21, 14); o('ox-floor-guide', 18, 17); o('ox-visitor-kiosk', 14, 17)
exF = dict(name='IT 회사 사옥 자유석 층', plan=S(g), floor='of-carpet-tile', wall='of-wall', ceiling='default',
           zones=[dict(x0=1, y0=11, x1=7, y1=17, floor='of-carpet-tile', wall='of-glass-wall'), dict(x0=9, y0=11, x1=12, y1=17, floor='of-pantry-tile', wall='of-wall'),
                  dict(x0=14, y0=11, x1=22, y1=17, floor='of-lobby-stone', wall='of-lobby-wall')],
           objects=O, tables=[], goods=[],
           rooms=[dict(room='freeoffice', x0=0, y0=0, x1=23, y1=10), dict(room='meetingroom', x0=0, y0=11, x1=8, y1=18), dict(room='pantry', x0=9, y0=11, x1=13, y1=18),
                  dict(room='elevatorhall', x0=14, y0=11, x1=23, y1=18)],
           start=[17, 15], inner=True,
           open=[dict(x0=14, y0=14, x1=22, y1=17, why='엘리베이터 홀 — 엘리베이터 앞 기다리는 자리와 계단 앞 회전 공간'), dict(x0=17, y0=8, x1=21, y1=10, why='엘리베이터 홀에서 사무 공간으로 들어오는 주 동선')],
           links=[dict(x=21, y=15, toMapId='jp-city-office-tower-1f', toX=2, toY=4, direction='down'), dict(x=22, y=15, toMapId='jp-city-office-tower-1f', toX=2, toY=4, direction='down'),
                  dict(x=15, y=14, toMapId='jp-city-office-tower-1f', toX=3, toY=4, direction='down'), dict(x=16, y=14, toMapId='jp-city-office-tower-1f', toX=4, toY=4, direction='down')])

for name, ex in (('school-annex', exS), ('office-tower-1f', exL), ('office-free', exF)):
    json.dump(ex, open(os.path.join(EX, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
places = [
    dict(file='school-annex', maps=['school-annex'], placeId='jp-city-school-annex-26x16', name='일본 학교 특별교실동 실내(취주악부실·인쇄실·현관 복도)', kind='school', kindKo='학교',
         alias=['特別教室棟', '吹奏楽部', '部室', '印刷室', '학교 별관', '취주악부', '밴드부실', '인쇄실', 'school annex', 'band room'], building='jp_school_annex',
         roomKinds={'bandroom': ['취주악부실(부실)', ['吹奏楽部室', '部室', '취주악부실', '밴드부실', 'band room']],
                    'printroom': ['인쇄실(교원 작업실)', ['印刷室', '作業室', '인쇄실', '교원 작업실', 'print room']],
                    'annexstairs': ['계단 홀', ['階段', '계단 홀']],
                    'annexcorridor': ['현관 복도', ['廊下', '昇降口', '복도', '현관']]},
         rules=['남쪽 2칸 현관 → 3줄 복도: 북쪽 벽면에 게시판·학급 표찰(문 곁)·소화전함, 북쪽 첫 줄에 트로피 유리장, 남쪽 벽 곁에 긴 의자·분리수거통·소화기·우산꽂이·청소 도구(가운데 2줄은 비워 둔다).',
                '취주악부실: 북쪽 벽에 악기 선반 둘 사이 실로폰·팀파니, 가운데 지휘 보면대를 보는 의자 두 무리(가운데 통로), 뒤쪽에 드럼 세트.',
                '인쇄실: 북쪽 벽 교원 우편 칸 선반·찻장·서류장, 윤전 인쇄기·복사기, 작업 책상과 의자, 분리수거.',
                '평면·가구는 tiledata/jp-city/interior/examples/school-annex.json. 거리 문과 잇기: link_jp_city_interior({door, place:"jp-city-school-annex-26x16"}).']),
    dict(file='office-tower-1f', maps=['office-tower-1f', 'office-free'], placeId='jp-city-office-tower-1f-16x11', name='일본 IT 회사 사옥 실내(1층 로비 + 자유석 층)', kind='office', kindKo='사무실 빌딩',
         alias=['フリーアドレス', 'IT企業', '本社', 'オフィス', '사옥', '자유석', '스타트업', '회사 사무실', 'free address office'], building='jp_office_tower',
         roomKinds={'towerlobby': ['사옥 1층 로비', ['ロビー', '受付', '警備', '로비', '경비', '방문자 접수']],
                    'freeoffice': ['자유석 사무 공간', ['フリーアドレス', '執務室', '자유석', '사무 공간']],
                    'meetingroom': ['회의실', ['会議室', '회의실']], 'pantry': ['급탕실', ['給湯室', '탕비실', '커피']],
                    'elevatorhall': ['엘리베이터 홀', ['エレベーターホール', '엘리베이터 홀']]},
         rules=['1층 로비: 남쪽 유리 자동문(양옆 우산 비닐 받침) → 서쪽 경비 데스크·방문자 접수 태블릿, 북쪽 벽 계단·엘리베이터 둘·층 안내판, 동쪽 화분 상자·소파.',
                '자유석 층: 북쪽 벽에 1인 부스·파쇄기·복사기·서류장, 가운데 3인 긴 책상 섬 셋(남북으로 마주 앉는다), 북동 스탠딩 회의(화면·높은 탁자·스툴), 서쪽 라운지 소파.',
                '칸막이 남쪽: 유리 회의실(천장 스크린·회의 화면) · 급탕실(커피 카운터·벽 온수기·냉장고·자판기) · 엘리베이터 홀.',
                '평면·가구는 tiledata/jp-city/interior/examples/office-tower-1f.json · office-free.json. 거리 문과 잇기: link_jp_city_interior({door, place:"jp-city-office-tower-1f-16x11"}).']),
]
json.dump(places, open(os.path.join(EX, 'places6-annex.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for ex in (exS, exL, exF): print('\n'.join(ex['plan'])); print()
