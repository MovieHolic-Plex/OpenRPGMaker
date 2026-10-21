"""일본 2층 단독주택 보강 조각 8종(2026-10-21, object-gen) — 그림·고른 기록·3/4 관문 확인 한 곳.

그림은 object-gen(MovieHolic-Plex/object-gen) 흐름으로 만들었다: 엄격한 3/4 탑뷰 참고 그림(모양만, 화소는 쓰지 않음, 시점 판정 통과분)
→ Opus 5.5 medium 손 도트 A/B → Opus 적대적 블라인드 검수 3회 과반(숨긴 반려 표본) → Opus 고르기(by: opus-picker, 화소 해시에 묶음).
기준 그림(화풍 닻)은 jp_city 실내 조각 8개: getabako·bathtub·bed-double·kitchen-sink·washing-machine·hs-drug-drawers·hs-dispense-table·hs-toy-shelf.

정본 그림 = tiledata/jp-city/interior/house3/<id>.png, 고른 기록 = tiledata/jp-city/interior/house3/picks.json.
**굽기는 3/4 관문(object-gate, 최종 판정 = Opus 5.5 medium 적대적 VQA) 통과분만** — 막힌 조각은 블록에 등록하지 않고(HELD),
분류표에서도 빠지며, 청사진(jpHouseBlueprint.ts)은 사양에 없는 조각 대신 옛 대역을 쓴다. 점수·기준을 낮춰 통과시키지 않는다.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
DIR = os.path.join(REPO, 'tiledata', 'jp-city', 'interior', 'house3')

# id -> 등록 종류(obj | wall | good), 크기·종류, 관문 종류(3/4 kind, 화풍 styleKind), 분류(categories.py 의 칸)
ITEMS = {
    'glass-cupboard': dict(reg='obj', w=1, h=1, up=16, kind='wall', gate='tall_furniture', style='prop', cat='kitchen',
                           ko='유리 식기장', tags=('부엌', '거실', '식당', '수납'), use=('open', 'search'), place='거실·식당·부엌 북쪽 벽 아래',
                           desc='유리문 식기장(食器棚) 1×2 — 위 유리문 안에 접시·그릇·찻잔이 보이고 아래는 나무 문 수납. 윗면이 보인다.'),
    'vanity-mirror': dict(reg='obj', w=2, h=1, up=16, kind='wall', gate='tall_furniture', style='prop', cat='dressing',
                          ko='세면화장대(큰 거울)', tags=('탈의실', '세면실'), use=('search',), place='탈의실 북쪽 벽 아래',
                          desc='세면화장대 2×1 — 흰 카운터에 세면볼·수전·컵, 벽에 넓은 거울장과 조명, 아래 수납장.'),
    'unit-bath': dict(reg='obj', w=3, h=1, up=32, kind='wall', gate='container', style='prop', cat='bath',
                      ko='유닛 배스(욕조+샤워 패널)', tags=('욕실',), use=('heal',), place='욕실 북쪽 벽 아래(욕실 폭 3칸 이상)',
                      desc='한 덩어리 성형 유닛 배스 3×1 — 왼쪽 두 칸 욕조(물과 테두리가 위에서 보인다), 오른쪽 한 칸 씻는 곳과 벽 샤워 패널(슬라이드 바·헤드·수전·선반·작은 거울).'),
    'genkan-vase': dict(reg='good', gate='container', style='prop', ko='현관 꽃병', desc='신발장 위 작은 도자기 꽃병과 꽃 몇 송이(생화 꽂이).'),
    'cloth-wainscot': dict(reg='wall', cols=4, gate='terrain', style='wall', src='wainscot', ko='허리벽(腰壁) 벽지',
                           tags=('거실', '복도', 'LDK'), desc='위 절반은 연한 벽지, 아래 절반은 나무 허리벽 판(腰壁)과 갓 몰딩·걸레받이.'),
    'wood-post': dict(reg='obj', w=1, kind='hang', hrows=2, gate='wall_mounted', style='wall', cat='wallhang',
                      ko='나무 기둥(柱)', tags=('거실', '복도', '방 사이'), place='벽면 윗줄에 건다(벽면 두 줄 높이) — 방 사이·트인 곳 양 옆',
                      desc='벽면에 드러난 네모 나무 기둥(柱) — 바닥에서 천장까지, 양옆은 투명이라 어느 벽면에나 건다.'),
    'toilet-shelf': dict(reg='obj', w=1, kind='hang', hrows=1, gate='other', style='prop', cat='toilet',
                         ko='화장실 선반', tags=('화장실',), place='화장실 벽면 윗줄',
                         desc='화장실 벽 선반 — 나무 선반 판(윗면이 보인다)에 여분 휴지·방향제·작은 화분.'),
    'serving-hatch': dict(reg='obj', w=2, kind='hang', hrows=2, gate='terrain', style='wall', cat='kitchen',
                          ko='배식 창(부엌↔거실)', tags=('거실', '식당', '부엌', 'LDK'), place='부엌과 맞닿은 거실·식당 북쪽 벽면 윗줄(벽면 두 줄 높이)',
                          desc='부엌과 거실 사이 벽의 배식 창(ハッチ) 2칸 — 나무 틀, 위에서 보이는 카운터 턱, 창 너머 어두운 부엌.'),
}
# 관문에 보내는 그림 = 고른 그림 그대로(wall 은 그린 원본 64×32, 굽기에서 천장 그늘만 더해진다)


def picks():
    p = os.path.join(DIR, 'picks.json')
    return json.load(open(p, encoding='utf-8'))['items'] if os.path.exists(p) else {}


def png_path(id_):
    return os.path.join(DIR, ITEMS[id_].get('src', id_) + '.png')


_STATE = None


def state():
    """{id: None(통과) | 이유}. 고른 기록이 없거나, 그림 해시가 기록과 다르거나, 3/4 관문(object-gate refusal, 출구 bundle)이 막으면 이유."""
    global _STATE
    if _STATE is not None: return _STATE
    sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
    import object_gate as OG
    P = picks(); out = {}
    for id_, it in ITEMS.items():
        png = png_path(id_)
        if id_ not in P or not os.path.exists(png): out[id_] = '고른 그림 없음'; continue
        sha = OG.pixel_sha256(png)
        if sha != P[id_].get('gateSha256'): out[id_] = '그림이 고른 기록과 다르다(%s)' % sha[:12]; continue
        out[id_] = OG.refusal(png, kind=it['gate'], context='bundle')
    _STATE = out
    return out


def passed():
    return [i for i, why in state().items() if why is None]


def held():
    return {i: why for i, why in state().items() if why is not None}
