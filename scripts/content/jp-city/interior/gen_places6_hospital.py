import json, os
"""places6 예제 맵 생성기(2026-10-14) — 평면·가구를 코드로 적는다. 고친 뒤 maps/interior.mjs --only <맵들> 로 다시 짓고 qa/check-interior-examples.mts 로 검사."""
EX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'tiledata', 'jp-city', 'interior', 'examples')
def grid(W, H): return [['#'] * W for _ in range(H)]
def carve(g, x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = '.'
def S(g): return [''.join(r) for r in g]

# ───────── 1층: 외래 ─────────
W, H = 30, 19
g = grid(W, H)
for (a, b) in ((1, 5), (7, 11), (13, 18), (20, 24), (26, 28)): carve(g, a, 1, b, 8)   # 북쪽 방 띠
carve(g, 1, 10, 28, H - 2)                                                              # 대기실
for x in (4, 10, 16, 21, 22, 24, 27, 28): g[9][x] = '.'                                # 문 틈·투약 창구·계단 홀 트임
g[H - 1][14] = g[H - 1][15] = '.'                                                       # 출입구 2칸
O = []
def o(i, x, y): O.append(dict(id=i, x=x, y=y))
# 진찰실 1 (x1-5) — 문 x4 는 접수 안쪽 직원 줄로 난다(의사·간호사 동선)
o('curtain-window', 1, 1); o('hs-xray-viewer', 3, 1)
o('pb-doctor-desk', 1, 3); o('sc-sink', 3, 3); o('pb-med-cabinet', 5, 3)
o('pb-office-chair-n', 2, 4); o('hs-exam-stool', 3, 4)
o('pb-exam-bed', 5, 6); o('pb-curtain', 4, 7); o('hs-vitals-monitor', 1, 7)
o('hs-door-sliding', 4, 9)
# 진찰실 2 (x7-11) — 초음파
o('hs-xray-viewer', 8, 1); o('curtain-window', 10, 1)
o('pb-med-cabinet', 7, 3); o('sc-sink', 9, 3); o('pb-doctor-desk', 10, 3)
o('pb-office-chair-n', 11, 4); o('hs-exam-stool', 10, 4)
o('pb-exam-bed', 7, 5); o('pb-curtain', 8, 6); o('hs-ultrasound', 11, 7)
o('hs-door-sliding', 10, 9)
# 처치실 (x13-18)
o('hs-bed-headwall', 14, 1); o('wall-clock', 17, 1)
o('hs-patient-locker', 13, 3); o('hs-stretcher', 14, 3); o('hs-iv-stand', 16, 3); o('sc-sink', 17, 3); o('pb-med-cabinet', 18, 3)
o('hs-instrument-cart', 18, 5); o('hs-exam-stool', 15, 6)
o('hs-folding-screen', 13, 6); o('hs-med-cart', 18, 7); o('hs-sharps-bin', 13, 8)
o('hs-door-sliding', 16, 9)
# 원내 약국 (x20-24) — 칸막이 2칸 틈(x21-22)에 투약 창구, 직원 문 x24
o('hs-drug-drawers', 20, 3); o('hs-drug-drawers', 22, 3); o('hs-med-fridge', 24, 3)
o('hs-dispense-table', 21, 5); o('ox-bar-stool', 21, 6); o('ox-bar-stool', 22, 6)
o('hs-pickup-window', 21, 11); o('hs-door-sliding', 24, 9)
# 계단·엘리베이터 홀 (x26-28, 대기실로 2칸 트임)
o('of-stairs-up', 26, 3); o('of-elevator', 27, 3); o('of-plant-big', 28, 5); o('sx-extinguisher', 26, 8)
# 대기실 북쪽 벽(칸막이 남쪽 면) 걸이
o('wall-clock', 7, 10); o('hs-call-display', 11, 10); o('hs-tv-wall', 13, 10); o('sx-hydrant-box', 17, 10); o('hs-call-display', 18, 10); o('hs-aed', 20, 10)
# 종합 접수(서쪽) — 카운터 뒤 직원 자리 2줄(동쪽 끝 x7 로 드나든다), 정산기·재진 접수기
o('of-cabinet', 1, 12); o('pb-office-chair-s', 3, 13); o('pb-office-chair-s', 5, 13)
o('hs-front-counter', 1, 14); o('hs-front-counter', 4, 14)
o('hs-pay-machine', 8, 12); o('hs-reception-kiosk', 9, 12)
o('pb-magazine-rack', 25, 12)
# 대기 의자(북향 — 호출 화면을 본다): 가운데 통로 x14-15
for x in (11, 16, 19): o('hs-bench-row-n', x, 14)
o('hs-bench-row-n', 9, 17); o('hs-bench-row-n', 18, 17); o('hs-bench-row-n', 22, 17)
# 서쪽: 휠체어 대여 / 동쪽: 키즈 코너·냉온수기
o('hs-wheelchair', 1, 17); o('hs-wheelchair', 2, 17); o('pb-water-dispenser', 5, 17); o('of-plant-big', 7, 17)
o('hs-kids-mat', 24, 14); o('hs-toy-shelf', 26, 16); o('of-plant-big', 28, 17); o('of-plant-big', 28, 13)
# 출입구 둘레
o('cv-autodoor', 14, H - 1); o('ox-umbrella-bagger', 13, 17); o('hs-sanitizer-stand', 16, 17)
ex1 = dict(name='일본 종합병원 1층(외래)', plan=S(g), floor='hs-floor-sheet', wall='hs-wall', ceiling='default',
           zones=[dict(x0=0, y0=0, x1=6, y1=9, floor='hs-floor-ward', wall='hs-wall-room'), dict(x0=6, y0=0, x1=12, y1=9, floor='hs-floor-ward', wall='hs-wall-room'),
                  dict(x0=12, y0=0, x1=19, y1=9, floor='hs-floor-ward', wall='hs-wall-room'), dict(x0=19, y0=0, x1=25, y1=9, floor='hs-floor-sheet', wall='hs-wall-room')],
           objects=O, tables=[], goods=[dict(id='pb-stethoscope', x=1, y=3)],
           rooms=[dict(room='hosp-exam', x0=0, y0=0, x1=6, y1=9), dict(room='hosp-exam', x0=6, y0=0, x1=12, y1=9), dict(room='hosp-treat', x0=12, y0=0, x1=19, y1=9),
                  dict(room='hosp-pharmacy', x0=19, y0=0, x1=25, y1=9), dict(room='hosp-stairs', x0=25, y0=0, x1=29, y1=9), dict(room='hosp-lobby', x0=0, y0=10, x1=29, y1=H - 1)],
           start=[14, H - 2], exitWidth=2,
           open=[dict(x0=7, y0=12, x1=28, y1=16, why='외래 대기실 홀 — 진찰실·처치실·약국 문 앞 통로, 정산기·접수기·투약 창구 앞 대기 줄(일본 병원 대기실은 트인 홀이다)')],
           narrow=[dict(x0=21, y0=9, x1=22, y1=12, why='약 투약 창구 — 칸막이 틈 2칸에 창구 카운터, 안쪽 약사 자리·바깥 손님 자리')],
           links=[dict(x=26, y=3, toMapId='jp-city-hospital-2f', toX=26, toY=18, direction='up'),
                  dict(x=27, y=3, toMapId='jp-city-hospital-2f', toX=19, toY=17, direction='down'), dict(x=28, y=3, toMapId='jp-city-hospital-2f', toX=20, toY=17, direction='down')])

# ───────── 2층: 병동 ─────────
W, H = 30, 22
g = grid(W, H)
for (a, b) in ((1, 8), (10, 17), (19, 28)): carve(g, a, 1, b, 7)        # 2床 병실 둘 · 간호사 대기소
carve(g, 1, 9, 28, 12)                                                    # 복도(벽면 2줄 + 걸음 2줄)
for (a, b) in ((1, 8), (10, 17), (19, 28)): carve(g, a, 14, b, 20)      # 2床 병실 둘 · 계단·엘리베이터 홀
for x in (4, 13): g[8][x] = g[13][x] = '.'                               # 병실 문
for x in range(19, 29): g[8][x] = '.'                                     # 간호사 대기소는 복도로 트였다(카운터가 가른다)
for x in range(23, 25): g[13][x] = '.'                                    # 계단 홀 트임
O = []
def ward(x0, y0, north=True):
    # 2床 병실: [사물함][협탁][침대] … [침대][협탁][사물함], 침대 머리는 북쪽 벽(머리맡 단자), 발치에 오버 테이블,
    # 북쪽 병실은 침대 사이 벽 앞에 링거·칸막이 커튼, 남쪽 병실은 그 자리가 문 길이라 링거를 발치 쪽으로.
    o('hs-bed-headwall', x0 + 2, y0 - 2); o('hs-bed-headwall', x0 + 5, y0 - 2)
    o('hs-patient-locker', x0, y0); o('hs-bedside-cabinet', x0 + 1, y0); o('hs-ward-bed', x0 + 2, y0)
    o('hs-ward-bed', x0 + 5, y0); o('hs-bedside-cabinet', x0 + 6, y0); o('hs-patient-locker', x0 + 7, y0)
    o('hs-overbed-table', x0 + 2, y0 + 2); o('hs-overbed-table', x0 + 5, y0 + 2); o('gy-pipe-chair', x0 + 6, y0 + 2)
    if north: o('hs-iv-stand', x0 + 3, y0); o('pb-curtain', x0 + 4, y0)
    else: o('hs-iv-stand', x0 + 4, y0)
for x0 in (1, 10): ward(x0, 3)
for x0 in (1, 10): ward(x0, 16, north=False)
o('hs-door-sliding', 4, 8); o('hs-door-sliding', 13, 8); o('hs-door-sliding', 4, 13); o('hs-door-sliding', 13, 13)
o('pb-curtain', 3, 15) if False else None
# 간호사 대기소(x19-28): 뒤 벽 서류·약품·냉장·개수대·복사기, 가운데 작업대, 앞 카운터가 복도를 본다
o('wall-clock', 19, 1); o('hs-call-display', 21, 1)
o('sx-letter-shelf', 19, 3); o('hs-drug-drawers', 21, 3); o('hs-med-fridge', 23, 3); o('sc-sink', 24, 3); o('of-copier', 26, 3); o('of-cabinet', 28, 3)
o('hs-chart-cart', 19, 5); o('hs-dispense-table', 22, 5); o('hs-chart-cart', 26, 5); o('hs-med-cart', 27, 5); o('hs-exam-stool', 23, 6); o('hs-wheelchair', 26, 7); o('of-plant-big', 28, 8)
o('pb-office-chair-s', 21, 8); o('pb-office-chair-s', 24, 8)
o('hs-nurse-counter', 20, 9); o('hs-nurse-counter', 23, 9); o('of-plant-big', 19, 9)
# 복도 북쪽 벽면 걸이
o('wall-clock', 2, 9); o('sx-hydrant-box', 9, 9); o('hs-aed', 16, 9)
# 계단·엘리베이터 홀(x19-28)
o('of-elevator', 19, 16); o('ox-trash-column', 21, 16); o('of-stairwell-down', 26, 16)
o('hs-bench-row-n', 21, 20); o('hs-sanitizer-stand', 25, 20); o('sx-extinguisher', 28, 20)
ex2 = dict(name='일본 종합병원 2층(병동)', plan=S(g), floor='hs-floor-sheet', wall='hs-wall', ceiling='default',
           zones=[dict(x0=0, y0=0, x1=9, y1=8, floor='hs-floor-ward', wall='hs-wall-room'), dict(x0=9, y0=0, x1=18, y1=8, floor='hs-floor-ward', wall='hs-wall-room'),
                  dict(x0=0, y0=13, x1=9, y1=21, floor='hs-floor-ward', wall='hs-wall-room'), dict(x0=9, y0=13, x1=18, y1=21, floor='hs-floor-ward', wall='hs-wall-room')],
           objects=O, tables=[], goods=[],
           rooms=[dict(room='hosp-ward', x0=0, y0=0, x1=9, y1=8), dict(room='hosp-ward', x0=9, y0=0, x1=18, y1=8), dict(room='hosp-nurse', x0=18, y0=0, x1=29, y1=9),
                  dict(room='hosp-corridor', x0=0, y0=9, x1=17, y1=12),
                  dict(room='hosp-ward', x0=0, y0=13, x1=9, y1=21), dict(room='hosp-ward', x0=9, y0=13, x1=18, y1=21), dict(room='hosp-stairs', x0=18, y0=13, x1=29, y1=21)],
           start=[23, 19], inner=True,
           open=[dict(x0=19, y0=9, x1=28, y1=19, why='복도 동쪽 끝 — 간호사 대기소 카운터 앞과 엘리베이터·계단 홀(이송 침대·휠체어가 도는 자리)')],
           links=[dict(x=26, y=17, toMapId='jp-city-hospital-1f', toX=26, toY=4, direction='down'), dict(x=27, y=17, toMapId='jp-city-hospital-1f', toX=26, toY=4, direction='down'),
                  dict(x=19, y=16, toMapId='jp-city-hospital-1f', toX=27, toY=4, direction='down'), dict(x=20, y=16, toMapId='jp-city-hospital-1f', toX=28, toY=4, direction='down')])
for name, ex in (('hospital-1f', ex1), ('hospital-2f', ex2)):
    json.dump(ex, open(os.path.join(EX, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
places = [dict(file='hospital-1f', maps=['hospital-1f', 'hospital-2f'], placeId='jp-city-hospital-1f-30x19', name='일본 종합병원 실내(1층 외래 + 2층 병동)', kind='hospital', kindKo='종합병원',
               alias=['病院', '総合病院', '병원', '종합병원', '대학병원', 'hospital', '外来', '病棟'], building='jp_hospital',
               roomKinds={'hosp-lobby': ['외래 대기실·종합 접수', ['待合室', '総合受付', '대기실', '접수', '로비', 'waiting room']],
                          'hosp-exam': ['진찰실', ['診察室', '진료실', '진찰실', 'exam room']],
                          'hosp-treat': ['처치실', ['処置室', '처치실', '주사실', 'treatment room']],
                          'hosp-pharmacy': ['원내 약국', ['薬局', '薬剤部', '약국', '조제실', 'pharmacy']],
                          'hosp-stairs': ['계단·엘리베이터 홀', ['階段', 'エレベーターホール', '계단', '엘리베이터']],
                          'hosp-corridor': ['병동 복도', ['病棟廊下', '병동 복도', '복도']],
                          'hosp-ward': ['병실', ['病室', '병실', '입원실', '2床室', 'ward']],
                          'hosp-nurse': ['간호사 대기소', ['ナースステーション', '간호사실', '간호사 대기소', 'nurse station']]},
               rules=['1층(외래): 남쪽 유리 자동문(2칸, 우산 비닐 받침·손 소독) → 대기실: 서쪽 종합 접수(카운터 둘 + 안쪽 직원 줄 + 재진 접수기·자동 정산기), 가운데 북향 연결 의자 두 줄(가운데 2칸 통로) — 북쪽 벽 호출 화면·TV 를 본다, 동쪽 키즈 코너·냉온수기·잡지대.',
                      '대기실 북쪽 칸막이 너머: 진찰실 둘(의사 책상·의자·환자 회전 의자·진찰대+커튼·판독 라이트 박스·개수대·초음파) · 처치실(이송 침대·링거·칸막이·기구 카트·폐기물 통) · 원내 약국(약품 서랍장·약 냉장고·조제대, 남쪽 2칸 투약 창구 + 동쪽 직원 문) · 계단·엘리베이터 홀(대기실로 트임).',
                      '2층(병동, 거리 문과 잇지 않는다): 동서 복도(3줄) 북쪽에 2床 병실 둘 · 간호사 대기소(카운터가 칸막이 틈에서 복도를 본다), 남쪽에 2床 병실 둘 · 계단·엘리베이터 홀. 병실은 침대 머리를 북쪽 벽에 붙이고(머리맡 단자·협탁) 침대 사이 칸막이 커튼, 발치 오버 테이블·링거.',
                      '층 이동: 1층 계단 발칸 ↔ 2층 계단통 아랫줄, 1층 엘리베이터 ↔ 2층 엘리베이터 앞. 평면·가구는 tiledata/jp-city/interior/examples/hospital-1f.json · hospital-2f.json. 거리 건물 문과 잇기: link_jp_city_interior({door, place:"jp-city-hospital-1f-30x19"}).'])]
json.dump(places, open(os.path.join(EX, 'places6-hospital.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n'.join(ex1['plan'])); print(); print('\n'.join(ex2['plan']))
